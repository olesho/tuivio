/**
 * Live Client - Shared discovery and connection library for tuivio-record live sessions.
 *
 * Scans .tuivio/live-*.json metadata files to discover running sessions,
 * and provides a helper to send JSON requests over Unix sockets.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as net from 'net';

export interface LiveSession {
  pid: number;
  command: string;
  cwd: string;
  startTime: string;
  cols: number;
  rows: number;
  socketPath: string;
  recordingFile: string;
}

const TUIVIO_DIR = '.tuivio';
const GLOBAL_TUIVIO_DIR = path.join(os.tmpdir(), 'tuivio');

/**
 * Discover live tuivio-record sessions by scanning live-*.json metadata files.
 * Checks both the global /tmp/tuivio/ directory and the local .tuivio/ in cwd.
 */
export function discoverSessions(searchDir?: string): LiveSession[] {
  const dirs: string[] = [GLOBAL_TUIVIO_DIR];

  // Also check local .tuivio/ in the given or current directory
  const localDir = path.join(searchDir || process.cwd(), TUIVIO_DIR);
  if (localDir !== GLOBAL_TUIVIO_DIR) {
    dirs.push(localDir);
  }

  const seen = new Set<number>(); // dedupe by PID
  const sessions: LiveSession[] = [];

  for (const tuivioDir of dirs) {
    if (!fs.existsSync(tuivioDir)) continue;
    try {
      const files = fs.readdirSync(tuivioDir)
        .filter(f => f.startsWith('live-') && f.endsWith('.json'));

      for (const file of files) {
        try {
          const content = fs.readFileSync(path.join(tuivioDir, file), 'utf-8');
          const session: LiveSession = JSON.parse(content);
          if (!seen.has(session.pid)) {
            seen.add(session.pid);
            sessions.push(session);
          }
        } catch {
          // Skip malformed metadata files
        }
      }
    } catch {
      // Directory read failed
    }
  }

  return sessions;
}

/**
 * Discover sessions using legacy /tmp/tuivio-record-*.sock pattern (backward compat).
 */
export function discoverLegacySockets(): string[] {
  try {
    return fs.readdirSync('/tmp')
      .filter(f => f.startsWith('tuivio-record-') && f.endsWith('.sock'))
      .map(f => path.join('/tmp', f));
  } catch {
    return [];
  }
}

/**
 * Send a JSON request to a Unix socket and return the parsed JSON response.
 */
export function sendRequest(
  socketPath: string,
  request: object,
  timeoutMs: number = 5000
): Promise<object> {
  return new Promise((resolve, reject) => {
    const client = net.createConnection(socketPath, () => {
      client.write(JSON.stringify(request) + '\n');
    });

    let data = '';
    const timer = setTimeout(() => {
      client.destroy();
      reject(new Error('Timeout waiting for response'));
    }, timeoutMs);

    client.on('data', (chunk) => {
      data += chunk.toString();
      // Try to parse each line
      const lines = data.split('\n');
      for (const line of lines) {
        if (line.trim()) {
          try {
            const result = JSON.parse(line.trim());
            clearTimeout(timer);
            client.end();
            resolve(result);
            return;
          } catch {
            // Not complete JSON yet
          }
        }
      }
    });

    client.on('end', () => {
      clearTimeout(timer);
      if (data.trim()) {
        try {
          resolve(JSON.parse(data.trim()));
        } catch {
          reject(new Error(`Invalid JSON response: ${data.trim()}`));
        }
      } else {
        reject(new Error('Empty response'));
      }
    });

    client.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}
