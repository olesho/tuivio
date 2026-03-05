#!/usr/bin/env node
/**
 * tuivio-mark - Send a marker to an active tuivio-record session.
 *
 * Usage: tuivio-mark [label]
 *
 * Discovers sessions via .tuivio/live-*.json first, falls back to legacy /tmp sockets.
 */

import * as path from 'path';
import { discoverSessions, discoverLegacySockets, sendRequest } from './live-client.js';

const label = process.argv.slice(2).join(' ') || 'marker';

async function main(): Promise<void> {
  // Try .tuivio/ discovery first
  const sessions = discoverSessions();
  if (sessions.length > 0) {
    if (sessions.length > 1) {
      console.error(`Multiple recording sessions found. Using PID ${sessions[0].pid}.`);
    }
    const socketPath = sessions[0].socketPath;
    try {
      const response = await sendRequest(socketPath, { type: 'marker', label }) as any;
      if (response.ok) {
        console.log(response.message);
      } else {
        console.error(`Error: ${response.error}`);
        process.exit(1);
      }
    } catch (err: any) {
      console.error(`Failed to connect to recording session: ${err.message}`);
      process.exit(1);
    }
    return;
  }

  // Fall back to legacy /tmp sockets
  const legacySockets = discoverLegacySockets();
  if (legacySockets.length === 0) {
    console.error('No active tuivio-record session found.');
    console.error('Start a recording with: tuivio-record <command>');
    process.exit(1);
  }

  if (legacySockets.length > 1) {
    console.error(`Multiple recording sessions found. Using the most recently modified one.`);
  }

  // Use the most recently modified socket
  const { statSync } = await import('fs');
  const socketPath = legacySockets
    .map(f => ({ path: f, mtime: statSync(f).mtime.getTime() }))
    .sort((a, b) => b.mtime - a.mtime)[0].path;

  try {
    const response = await sendRequest(socketPath, { type: 'marker', label }) as any;
    // Handle both new JSON responses and legacy plain-text responses
    if (typeof response === 'object') {
      if (response.ok) {
        console.log(response.message);
      } else {
        console.error(`Error: ${response.error}`);
        process.exit(1);
      }
    } else {
      console.log(String(response));
    }
  } catch (err: any) {
    console.error(`Failed to connect to recording session: ${err.message}`);
    console.error('The recording session may have ended.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
