#!/usr/bin/env node
/**
 * tuivio-attach - Attach to a live tuivio-record session.
 *
 * Connects to a running tuivio-record session and displays the TUI output
 * in real-time. Optionally forwards keystrokes to the TUI.
 *
 * Usage: tuivio-attach [--read-only] [--pid <pid>]
 */

import * as net from 'net';
import { execSync, spawnSync } from 'child_process';
import { discoverSessions, sendRequest, type LiveSession } from './live-client.js';

// Parse arguments
const argv = process.argv.slice(2);
let readOnly = false;
let targetPid: number | null = null;

for (let i = 0; i < argv.length; i++) {
  const arg = argv[i];
  if (arg === '--read-only' || arg === '-r') {
    readOnly = true;
  } else if ((arg === '--pid' || arg === '-p') && argv[i + 1]) {
    targetPid = parseInt(argv[++i], 10);
  } else if (arg === '--help' || arg === '-h') {
    console.log(`Usage: tuivio-attach [options]

Attach to a live tuivio-record session to watch (and optionally interact with) the TUI.

Options:
  --read-only, -r    Watch only — don't forward keystrokes
  --pid <pid>, -p    Connect to a specific session by PID
  -h, --help         Show this help

Controls:
  Ctrl+C twice       Detach from session (within 1 second)

Examples:
  tuivio-attach                 # Auto-discover and attach
  tuivio-attach --read-only     # Watch without interacting
  tuivio-attach --pid 12345     # Attach to specific session`);
    process.exit(0);
  }
}

function findTmuxSession(): string | null {
  try {
    const output = execSync('tmux list-sessions -F "#{session_name}" 2>/dev/null', { encoding: 'utf-8' });
    const sessions = output.trim().split('\n').filter(s => s.startsWith('tuivio'));
    return sessions.length > 0 ? sessions[0] : null;
  } catch {
    return null;
  }
}

function fallbackToTmux(): never {
  const tmuxSession = findTmuxSession();
  if (tmuxSession) {
    console.error(`No tuivio-record session found, but tmux session "${tmuxSession}" exists.`);
    console.error(`Attaching via tmux...\n`);
    spawnSync('tmux', ['attach-session', '-t', tmuxSession], { stdio: 'inherit' });
    process.exit(0);
  }
  console.error('No active tuivio sessions found.');
  console.error('Start one with: tuivio-start <command>');
  process.exit(1);
}

async function pickSession(): Promise<LiveSession> {
  const sessions = discoverSessions();

  if (sessions.length === 0) {
    fallbackToTmux();
  }

  // Verify liveness
  const alive: (LiveSession & { uptime?: number })[] = [];
  for (const session of sessions) {
    try {
      const status = await sendRequest(session.socketPath, { type: 'status' }, 2000) as any;
      if (status.ok) {
        alive.push({ ...session, uptime: status.uptime });
      }
    } catch {
      // Skip stale sessions
    }
  }

  if (alive.length === 0) {
    fallbackToTmux();
  }

  if (targetPid !== null) {
    const match = alive.find(s => s.pid === targetPid);
    if (!match) {
      console.error(`No live session with PID ${targetPid}.`);
      console.error('Available sessions:');
      for (const s of alive) {
        console.error(`  PID ${s.pid}: ${s.command}`);
      }
      process.exit(1);
    }
    return match;
  }

  if (alive.length === 1) {
    return alive[0];
  }

  // Multiple sessions — list them and ask user to pick with --pid
  console.error('Multiple live sessions found. Use --pid to select one:\n');
  for (const s of alive) {
    const uptime = s.uptime ? formatUptime(s.uptime) : '?';
    console.error(`  PID ${String(s.pid).padEnd(8)} ${s.command.slice(0, 40).padEnd(42)} ${s.cols}x${s.rows}  ${uptime}`);
  }
  console.error('');
  process.exit(1);
  throw new Error('unreachable'); // TypeScript needs this
}

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

async function main(): Promise<void> {
  const session = await pickSession();

  // Check terminal size mismatch
  const termCols = process.stdout.columns || 80;
  const termRows = process.stdout.rows || 24;
  if (termCols !== session.cols || termRows !== session.rows) {
    console.error(`Warning: Your terminal is ${termCols}x${termRows}, but the session is ${session.cols}x${session.rows}.`);
    console.error(`Resize your terminal to ${session.cols}x${session.rows} for best results.\n`);
  }

  // Print banner
  console.error(`Attaching to PID ${session.pid}: ${session.command} (${session.cols}x${session.rows})${readOnly ? ' [read-only]' : ''}`);
  console.error('Press Ctrl+C twice to detach.\n');

  // Connect to socket
  const client = net.createConnection(session.socketPath, () => {
    // Send subscribe request
    client.write(JSON.stringify({ type: 'subscribe', readOnly }) + '\n');
  });

  let lastCtrlCTime = 0;
  let rawModeSet = false;

  // Pipe socket output → stdout (raw PTY output)
  client.on('data', (data) => {
    process.stdout.write(data);
  });

  // Set stdin to raw mode and pipe to socket (unless read-only)
  if (process.stdin.isTTY && !readOnly) {
    process.stdin.setRawMode(true);
    rawModeSet = true;
    process.stdin.resume();

    process.stdin.on('data', (data: Buffer) => {
      const str = data.toString();
      // Double Ctrl+C within 1s → detach
      if (str === '\x03') {
        const now = Date.now();
        if (now - lastCtrlCTime < 1000) {
          detach(client, rawModeSet);
          return;
        }
        lastCtrlCTime = now;
      }
      // Forward keystrokes to the session
      client.write(data);
    });
  } else if (!readOnly && !process.stdin.isTTY) {
    console.error('Warning: stdin is not a TTY. Running in read-only mode.');
    readOnly = true;
  }

  // In read-only mode, still handle Ctrl+C for detach
  if (readOnly && process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    rawModeSet = true;
    process.stdin.resume();

    process.stdin.on('data', (data: Buffer) => {
      const str = data.toString();
      if (str === '\x03') {
        const now = Date.now();
        if (now - lastCtrlCTime < 1000) {
          detach(client, rawModeSet);
          return;
        }
        lastCtrlCTime = now;
      }
      // Discard all other input in read-only mode
    });
  }

  client.on('end', () => {
    detach(client, rawModeSet, 'Session ended.');
  });

  client.on('error', (err) => {
    detach(client, rawModeSet, `Connection error: ${err.message}`);
  });

  // Handle terminal signals
  process.on('SIGINT', () => {
    // Let the Ctrl+C double-press handler manage this
  });

  process.on('SIGTERM', () => {
    detach(client, rawModeSet);
  });
}

let detached = false;

function detach(client: net.Socket, rawModeSet: boolean, message?: string): void {
  if (detached) return;
  detached = true;

  // Restore terminal
  if (rawModeSet && process.stdin.isTTY) {
    try { process.stdin.setRawMode(false); } catch { /* ignore */ }
  }
  process.stdin.pause();

  try { client.end(); } catch { /* ignore */ }

  // Clear screen artifacts and print message
  console.error(message ? `\n${message}` : '\nDetached.');
  process.exit(0);
}

main().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
