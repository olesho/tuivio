/**
 * Recording Writer - JSONL recording file writer with screen diffing.
 */

import * as fs from 'fs';

export interface RecordingHeader {
  type: 'header';
  version: number;
  command: string;
  cwd: string;
  cols: number;
  rows: number;
  startTime: string;
}

export interface RecordingInput {
  type: 'input';
  time: number;
  raw: string;
  key: string;
}

export interface RecordingScreenFull {
  type: 'screen';
  time: number;
  mode: 'full';
  lines: string[];
}

export interface RecordingScreenDiff {
  type: 'screen';
  time: number;
  mode: 'diff';
  changes: Record<string, string>;
}

export interface RecordingMarker {
  type: 'marker';
  time: number;
  label: string;
}

export interface RecordingResize {
  type: 'resize';
  time: number;
  cols: number;
  rows: number;
}

export interface RecordingFooter {
  type: 'footer';
  endTime: string;
  duration: number;
  exitCode: number | null;
  signal: string | null;
  totalInputs: number;
  totalScreenChanges: number;
}

export type RecordingEvent =
  | RecordingHeader
  | RecordingInput
  | RecordingScreenFull
  | RecordingScreenDiff
  | RecordingMarker
  | RecordingResize
  | RecordingFooter;

export class RecordingWriter {
  private fd: number;
  private previousLines: string[] | null = null;
  private screenChangeCount: number = 0;
  private inputCount: number = 0;
  private startTime: number;

  constructor(outputPath: string) {
    this.fd = fs.openSync(outputPath, 'w');
    this.startTime = Date.now();
  }

  private write(event: RecordingEvent): void {
    const line = JSON.stringify(event) + '\n';
    fs.writeSync(this.fd, line);
  }

  writeHeader(command: string, cols: number, rows: number, cwd: string): void {
    this.write({
      type: 'header',
      version: 1,
      command,
      cwd,
      cols,
      rows,
      startTime: new Date(this.startTime).toISOString(),
    });
  }

  writeInput(timeMs: number, raw: string, decodedKey: string): void {
    this.inputCount++;
    this.write({
      type: 'input',
      time: timeMs,
      raw: escape(raw),
      key: decodedKey,
    });
  }

  writeScreen(timeMs: number, lines: string[]): void {
    // Skip if identical to previous snapshot
    if (this.previousLines && linesEqual(this.previousLines, lines)) {
      return;
    }

    this.screenChangeCount++;

    // Full snapshot every 10th change or if no previous snapshot exists
    if (!this.previousLines || this.screenChangeCount % 10 === 0) {
      this.write({
        type: 'screen',
        time: timeMs,
        mode: 'full',
        lines,
      });
    } else {
      // Diff mode: only emit changed lines
      const changes: Record<string, string> = {};
      for (let i = 0; i < Math.max(lines.length, this.previousLines.length); i++) {
        const prev = this.previousLines[i] ?? '';
        const curr = lines[i] ?? '';
        if (prev !== curr) {
          changes[String(i)] = curr;
        }
      }
      this.write({
        type: 'screen',
        time: timeMs,
        mode: 'diff',
        changes,
      });
    }

    this.previousLines = [...lines];
  }

  writeMarker(timeMs: number, label: string): void {
    this.write({
      type: 'marker',
      time: timeMs,
      label,
    });
  }

  writeResize(timeMs: number, cols: number, rows: number): void {
    this.write({
      type: 'resize',
      time: timeMs,
      cols,
      rows,
    });
  }

  writeFooter(exitCode: number | null, signal: string | null): void {
    const endTime = Date.now();
    this.write({
      type: 'footer',
      endTime: new Date(endTime).toISOString(),
      duration: endTime - this.startTime,
      exitCode,
      signal,
      totalInputs: this.inputCount,
      totalScreenChanges: this.screenChangeCount,
    });
  }

  get totalInputsSoFar(): number {
    return this.inputCount;
  }

  get totalScreenChangesSoFar(): number {
    return this.screenChangeCount;
  }

  close(): void {
    try {
      fs.closeSync(this.fd);
    } catch {
      // ignore
    }
  }
}

function escape(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/\x1b/g, '\\x1b')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t')
    .replace(/[\x00-\x1f]/g, (c) => `\\x${c.charCodeAt(0).toString(16).padStart(2, '0')}`);
}

function linesEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
