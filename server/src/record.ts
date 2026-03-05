#!/usr/bin/env node
/**
 * tuivio-record - PTY proxy recorder for TUI applications.
 *
 * Transparently captures user keystrokes and screen state changes while the user
 * interacts with a TUI app, producing a JSONL recording file for later AI analysis.
 *
 * Usage: tuivio-record [options] <command> [args...]
 */

import * as pty from 'node-pty';
import * as net from 'net';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { AnsiParser } from './ansi-parser.js';
import { InputBuffer, decodeInput } from './key-decoder.js';
import { RecordingWriter } from './recording-writer.js';
import type { LiveSession } from './live-client.js';

// Parse arguments
const argv = process.argv.slice(2);
let outputPath = '';
let cols = 0;
let rows = 0;
let snapshotInterval = 200;
let command = '';
let commandArgs: string[] = [];

for (let i = 0; i < argv.length; i++) {
  const arg = argv[i];
  if (arg === '--output' && argv[i + 1]) {
    outputPath = argv[++i];
  } else if (arg === '--cols' && argv[i + 1]) {
    cols = parseInt(argv[++i], 10);
  } else if (arg === '--rows' && argv[i + 1]) {
    rows = parseInt(argv[++i], 10);
  } else if (arg === '--snapshot-interval' && argv[i + 1]) {
    snapshotInterval = parseInt(argv[++i], 10);
  } else if (arg === '--headless') {
    // Explicit headless flag (also auto-detected when no TTY)
  } else if (arg === '--help' || arg === '-h') {
    console.log(`Usage: tuivio-record [options] <command> [args...]

Options:
  --output <path>              Recording file (default: ./tuivio-recording-<timestamp>.jsonl)
  --cols <N>                   Terminal width (default: inherit from terminal)
  --rows <N>                   Terminal height (default: inherit from terminal)
  --snapshot-interval <ms>     Debounce interval for screen captures (default: 200)
  --headless                   Run without local stdin/stdout (auto-detected when no TTY)
  -h, --help                   Show this help

Examples:
  tuivio-record python3 todo.py
  tuivio-record --output session.jsonl npm start
  tuivio-record --cols 120 --rows 36 ./my-tui-app`);
    process.exit(0);
  } else if (!command) {
    command = arg;
  } else {
    commandArgs.push(arg);
  }
}

if (!command) {
  console.error('Error: No command specified.');
  console.error('Usage: tuivio-record [options] <command> [args...]');
  console.error('Run tuivio-record --help for more information.');
  process.exit(1);
}

// Determine terminal size
if (!cols) cols = process.stdout.columns || 80;
if (!rows) rows = process.stdout.rows || 24;

// Default output path
if (!outputPath) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  outputPath = `./tuivio-recording-${timestamp}.jsonl`;
}

// State
const startTime = Date.now();
const parser = new AnsiParser(cols, rows);
const writer = new RecordingWriter(outputPath);
let snapshotTimer: NodeJS.Timeout | null = null;
let lastCtrlCTime = 0;
let exitCode: number | null = null;
let exitSignal: string | null = null;
let exited = false;
let inputBuffer: InputBuffer | null = null;
let socketServer: net.Server | null = null;

// Subscriber connections (tuivio-attach clients in raw mode)
const subscribers: Set<net.Socket> = new Set();

function elapsed(): number {
  return Date.now() - startTime;
}

function scheduleSnapshot(): void {
  if (snapshotTimer) return;
  snapshotTimer = setTimeout(() => {
    snapshotTimer = null;
    writer.writeScreen(elapsed(), parser.getLines());
  }, snapshotInterval);
}

function flushSnapshot(): void {
  if (snapshotTimer) {
    clearTimeout(snapshotTimer);
    snapshotTimer = null;
  }
  writer.writeScreen(elapsed(), parser.getLines());
}

// .tuivio/ directory and socket/metadata paths
const tuivioDir = path.join(process.cwd(), '.tuivio');
const globalTuivioDir = path.join(os.tmpdir(), 'tuivio');
const pid = process.pid;
const socketPath = path.join(tuivioDir, `live-${pid}.sock`);
const metadataPath = path.join(tuivioDir, `live-${pid}.json`);
const globalMetadataPath = path.join(globalTuivioDir, `live-${pid}.json`);

function ensureTuivioDir(): void {
  if (!fs.existsSync(tuivioDir)) {
    fs.mkdirSync(tuivioDir, { recursive: true });
    // Hint about .gitignore
    const gitignorePath = path.join(process.cwd(), '.gitignore');
    try {
      const gitignore = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf-8') : '';
      if (!gitignore.includes('.tuivio')) {
        console.error('Hint: Add .tuivio/ to your .gitignore');
      }
    } catch { /* ignore */ }
  }
  if (!fs.existsSync(globalTuivioDir)) {
    fs.mkdirSync(globalTuivioDir, { recursive: true });
  }
}

function writeMetadata(): void {
  const metadata: LiveSession = {
    pid,
    command: [command, ...commandArgs].join(' '),
    cwd: process.cwd(),
    startTime: new Date(startTime).toISOString(),
    cols,
    rows,
    socketPath,
    recordingFile: path.resolve(outputPath),
  };
  const json = JSON.stringify(metadata, null, 2) + '\n';
  fs.writeFileSync(metadataPath, json);
  try { fs.writeFileSync(globalMetadataPath, json); } catch { /* ignore */ }
}

function cleanupTuivioDir(): void {
  try { fs.unlinkSync(socketPath); } catch { /* ignore */ }
  try { fs.unlinkSync(metadataPath); } catch { /* ignore */ }
  try { fs.unlinkSync(globalMetadataPath); } catch { /* ignore */ }
  // Remove .tuivio/ if empty
  try {
    const remaining = fs.readdirSync(tuivioDir);
    if (remaining.length === 0) fs.rmdirSync(tuivioDir);
  } catch { /* ignore */ }
  try {
    const remaining = fs.readdirSync(globalTuivioDir);
    if (remaining.length === 0) fs.rmdirSync(globalTuivioDir);
  } catch { /* ignore */ }
}

function cleanup(): void {
  if (exited) return;
  exited = true;

  // Restore terminal
  if (process.stdin.isTTY) {
    try { process.stdin.setRawMode(false); } catch { /* ignore */ }
  }

  // Flush any buffered input (ignore errors — PTY may be dead)
  try { if (inputBuffer) inputBuffer.flush(); } catch { /* ignore */ }

  // Flush final snapshot
  try { flushSnapshot(); } catch { /* ignore */ }

  // Write footer
  try {
    writer.writeFooter(exitCode, exitSignal);
    writer.close();
  } catch { /* ignore */ }

  // Close all subscriber connections
  for (const sub of subscribers) {
    try { sub.end(); } catch { /* ignore */ }
  }
  subscribers.clear();

  // Close socket server and clean up .tuivio/ files
  try { if (socketServer) socketServer.close(); } catch { /* ignore */ }
  cleanupTuivioDir();

  console.error(`\nRecording saved to: ${outputPath}`);
}

// Headless mode: explicit flag or auto-detect when no TTY
const headless = argv.includes('--headless') || !process.stdin.isTTY;

// Write header
writer.writeHeader(
  [command, ...commandArgs].join(' '),
  cols,
  rows,
  process.cwd()
);

// Spawn the TUI process
const ptyProcess = pty.spawn(command, commandArgs, {
  name: 'xterm-256color',
  cols,
  rows,
  cwd: process.cwd(),
  env: {
    ...process.env,
    TERM: 'xterm-256color',
    COLORTERM: 'truecolor',
  } as Record<string, string>,
});

if (!headless) {
  // Set stdin to raw mode
  process.stdin.setRawMode(true);
  process.stdin.resume();

  // Input buffer coalesces escape sequences split across stdin chunks
  inputBuffer = new InputBuffer((decoded, raw) => {
    for (const d of decoded) {
      writer.writeInput(elapsed(), d.raw, d.key);
    }
    // Forward to PTY (skip if already exiting)
    if (!exited) {
      ptyProcess.write(raw.toString('utf-8'));
    }
    // Schedule screen capture after input
    scheduleSnapshot();
  });

  // Forward stdin → PTY and log input
  process.stdin.on('data', (data: Buffer) => {
    // Double Ctrl+C within 1s → force quit
    const str = data.toString();
    if (str === '\x03') {
      const now = Date.now();
      if (now - lastCtrlCTime < 1000) {
        exitSignal = 'SIGTERM';
        ptyProcess.kill();
        cleanup();
        process.exit(130);
      }
      lastCtrlCTime = now;
    }

    inputBuffer!.push(data);
  });
}

// Forward PTY output → stdout and update parser
ptyProcess.onData((data) => {
  // Write to stdout only in interactive mode
  if (!headless) {
    process.stdout.write(data);
  }

  // Broadcast to all attached subscribers
  for (const sub of subscribers) {
    try { sub.write(data); } catch { subscribers.delete(sub); }
  }

  // Feed to ANSI parser
  parser.processOutput(data);

  // Schedule screen capture
  scheduleSnapshot();
});

// Handle PTY exit
ptyProcess.onExit(({ exitCode: code, signal }) => {
  exitCode = code;
  if (signal !== undefined) exitSignal = String(signal);
  cleanup();
  process.exit(code);
});

// Handle terminal resize (only when TTY)
if (!headless) {
  process.stdout.on('resize', () => {
    const newCols = process.stdout.columns || cols;
    const newRows = process.stdout.rows || rows;
    if (newCols !== cols || newRows !== rows) {
      cols = newCols;
      rows = newRows;
      ptyProcess.resize(cols, rows);
      parser.resize(cols, rows);
      writer.writeResize(elapsed(), cols, rows);
    }
  });
}

// Unix socket for live communication
ensureTuivioDir();
writeMetadata();

function handleRequest(msg: any): object {
  switch (msg.type) {
    case 'screen': {
      const state = parser.getState();
      return { ok: true, lines: state.lines, cursorRow: state.cursorRow, cursorCol: state.cursorCol, cols: state.cols, rows: state.rows };
    }
    case 'status': {
      return {
        ok: true,
        command: [command, ...commandArgs].join(' '),
        cwd: process.cwd(),
        uptime: elapsed(),
        inputCount: writer.totalInputsSoFar,
        screenChangeCount: writer.totalScreenChangesSoFar,
        pid,
        cols,
        rows,
      };
    }
    case 'marker': {
      if (!msg.label) return { ok: false, error: 'Missing "label" field' };
      writer.writeMarker(elapsed(), msg.label);
      return { ok: true, message: `Marker added: "${msg.label}" at ${elapsed()}ms` };
    }
    case 'keys': {
      if (!msg.input) return { ok: false, error: 'Missing "input" field' };
      const input = msg.input as string;
      // Decode and record the injected keys
      const buf = Buffer.from(input, 'utf-8');
      const decoded = decodeInput(buf);
      for (const d of decoded) {
        writer.writeInput(elapsed(), d.raw, `[socket] ${d.key}`);
      }
      // Forward to PTY
      if (!exited) {
        ptyProcess.write(input);
      }
      scheduleSnapshot();
      return { ok: true, bytes: buf.length };
    }
    case 'resize': {
      const newCols = msg.cols;
      const newRows = msg.rows;
      if (!newCols || !newRows || typeof newCols !== 'number' || typeof newRows !== 'number') {
        return { ok: false, error: 'Missing or invalid "cols"/"rows" fields' };
      }
      cols = newCols;
      rows = newRows;
      ptyProcess.resize(cols, rows);
      parser.resize(cols, rows);
      writer.writeResize(elapsed(), cols, rows);
      return { ok: true, cols, rows };
    }
    default:
      return { ok: false, error: `Unknown request type: "${msg.type}"` };
  }
}

socketServer = net.createServer((connection) => {
  let buffer = '';
  let subscribed = false;

  connection.on('data', (data) => {
    if (subscribed) {
      // In subscribe mode: raw bytes from attacher go to PTY
      const input = data.toString('utf-8');
      const decoded = decodeInput(Buffer.from(input, 'utf-8'));
      for (const d of decoded) {
        writer.writeInput(elapsed(), d.raw, `[attach] ${d.key}`);
      }
      if (!exited) {
        ptyProcess.write(input);
      }
      scheduleSnapshot();
      return;
    }

    buffer += data.toString();
    // Process complete lines
    const lines = buffer.split('\n');
    buffer = lines.pop()!; // Keep incomplete line in buffer
    for (const line of lines) {
      if (line.trim()) {
        const wasSubscribed = processMessage(connection, line.trim());
        if (wasSubscribed) {
          subscribed = true;
          // Any remaining buffer data after subscribe is raw input
          if (buffer.length > 0) {
            const remaining = buffer;
            buffer = '';
            const input = remaining;
            const decoded = decodeInput(Buffer.from(input, 'utf-8'));
            for (const d of decoded) {
              writer.writeInput(elapsed(), d.raw, `[attach] ${d.key}`);
            }
            if (!exited) {
              ptyProcess.write(input);
            }
            scheduleSnapshot();
          }
          return;
        }
      }
    }
  });

  connection.on('end', () => {
    if (subscribed) {
      subscribers.delete(connection);
      return;
    }
    // Try to parse remaining buffer (for clients that don't send trailing newline)
    if (buffer.trim()) {
      processMessage(connection, buffer.trim());
      buffer = '';
    }
  });

  connection.on('error', () => {
    subscribers.delete(connection);
  });
});

/** Process a JSON message. Returns true if the connection entered subscribe mode. */
function processMessage(connection: net.Socket, raw: string): boolean {
  try {
    const msg = JSON.parse(raw);
    if (msg.type === 'subscribe') {
      handleSubscribe(connection, msg);
      return true;
    }
    const response = handleRequest(msg);
    connection.write(JSON.stringify(response) + '\n');
  } catch {
    connection.write(JSON.stringify({ ok: false, error: 'Invalid JSON' }) + '\n');
  }
  return false;
}

function handleSubscribe(connection: net.Socket, msg: any): void {
  subscribers.add(connection);

  // Force the TUI app to fully redraw by briefly resizing the PTY.
  // This causes the app to re-render with proper ANSI sequences (colors,
  // box-drawing character sets, etc.) which the subscriber receives as
  // live stream data — much better than sending parsed plain text.
  if (!exited) {
    ptyProcess.resize(cols - 1, rows);
    setTimeout(() => {
      if (!exited) ptyProcess.resize(cols, rows);
    }, 50);
  }
}

// Clean up stale socket
try { fs.unlinkSync(socketPath); } catch { /* ignore */ }

socketServer.listen(socketPath, () => {
  // Socket ready
});

socketServer.on('error', () => {
  // Non-fatal: live communication just won't work
});

// Capture initial screen after a brief delay
setTimeout(() => {
  writer.writeScreen(elapsed(), parser.getLines());
}, 500);

// Safety nets for terminal restoration
process.on('exit', () => {
  if (!exited) cleanup();
});

process.on('uncaughtException', (err) => {
  console.error(`\ntuivio-record error: ${err.message}`);
  exitCode = 1;
  cleanup();
  process.exit(1);
});

process.on('SIGTERM', () => {
  exitSignal = 'SIGTERM';
  ptyProcess.kill();
  cleanup();
  process.exit(143);
});

process.on('SIGINT', () => {
  exitSignal = 'SIGINT';
  ptyProcess.kill();
  cleanup();
  process.exit(130);
});

process.on('SIGHUP', () => {
  exitSignal = 'SIGHUP';
  ptyProcess.kill();
  cleanup();
  process.exit(129);
});
