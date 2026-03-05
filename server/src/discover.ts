#!/usr/bin/env node
/**
 * tuivio-discover - Discover active tuivio-record live sessions.
 *
 * Usage: tuivio-discover [--json] [--clean]
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { discoverSessions, sendRequest, type LiveSession } from './live-client.js';

const args = process.argv.slice(2);
const jsonMode = args.includes('--json');
const cleanMode = args.includes('--clean');

async function main(): Promise<void> {
  const sessions = discoverSessions();

  if (sessions.length === 0) {
    if (jsonMode) {
      console.log('[]');
    } else {
      console.error('No active tuivio-record sessions found.');
      console.error('Start a recording with: tuivio-record <command>');
    }
    process.exit(1);
  }

  // Ping each session to verify liveness
  const alive: (LiveSession & { uptime?: number })[] = [];
  const stale: LiveSession[] = [];

  for (const session of sessions) {
    try {
      const status = await sendRequest(session.socketPath, { type: 'status' }, 2000) as any;
      if (status.ok) {
        alive.push({ ...session, uptime: status.uptime });
      } else {
        stale.push(session);
      }
    } catch {
      stale.push(session);
    }
  }

  // Clean stale files if requested
  if (cleanMode && stale.length > 0) {
    for (const s of stale) {
      try { fs.unlinkSync(s.socketPath); } catch { /* ignore */ }
      const metaPath = path.join(path.dirname(s.socketPath), `live-${s.pid}.json`);
      try { fs.unlinkSync(metaPath); } catch { /* ignore */ }
      // Also clean global metadata
      const globalMeta = path.join(os.tmpdir(), 'tuivio', `live-${s.pid}.json`);
      try { fs.unlinkSync(globalMeta); } catch { /* ignore */ }
    }
    if (!jsonMode) {
      console.error(`Cleaned ${stale.length} stale session(s).`);
    }
  }

  if (jsonMode) {
    console.log(JSON.stringify(alive, null, 2));
  } else {
    if (alive.length === 0) {
      console.error('No live sessions (found stale metadata only).');
      if (!cleanMode) {
        console.error('Run with --clean to remove stale files.');
      }
      process.exit(1);
    }

    console.log('Active tuivio-record sessions:\n');
    console.log(
      'PID'.padEnd(8) +
      'Command'.padEnd(30) +
      'Size'.padEnd(10) +
      'Uptime'.padEnd(12) +
      'Socket'
    );
    console.log('-'.repeat(80));

    for (const s of alive) {
      const uptime = s.uptime ? formatUptime(s.uptime) : '?';
      console.log(
        String(s.pid).padEnd(8) +
        s.command.slice(0, 28).padEnd(30) +
        `${s.cols}x${s.rows}`.padEnd(10) +
        uptime.padEnd(12) +
        s.socketPath
      );
    }

    if (stale.length > 0 && !cleanMode) {
      console.log(`\n${stale.length} stale session(s) found. Run with --clean to remove.`);
    }
  }

  process.exit(alive.length > 0 ? 0 : 1);
}

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

main().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
