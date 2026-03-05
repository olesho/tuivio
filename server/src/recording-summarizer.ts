#!/usr/bin/env node
/**
 * Recording Summarizer - Converts JSONL recordings to human-readable text for AI context.
 *
 * Usage: tuivio-summarize <recording.jsonl> [--full]
 */

import * as fs from 'fs';
import type { RecordingEvent, RecordingScreenFull, RecordingScreenDiff } from './recording-writer.js';

interface ParsedArgs {
  inputFile: string;
  full: boolean;
}

function parseArgs(): ParsedArgs {
  const args = process.argv.slice(2);
  let inputFile = '';
  let full = false;

  for (const arg of args) {
    if (arg === '--full') {
      full = true;
    } else if (!arg.startsWith('-')) {
      inputFile = arg;
    }
  }

  if (!inputFile) {
    console.error('Usage: tuivio-summarize <recording.jsonl> [--full]');
    process.exit(1);
  }

  return { inputFile, full };
}

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const millis = ms % 1000;
  if (minutes > 0) {
    return `${minutes}m${secs.toString().padStart(2, '0')}s`;
  }
  if (seconds > 0) {
    return `${seconds}.${Math.floor(millis / 100)}s`;
  }
  return `${ms}ms`;
}

function renderScreen(lines: string[]): string {
  const nonEmpty = lines.filter(l => l.trim() !== '');
  return nonEmpty.map(l => `  | ${l}`).join('\n');
}

function summarize(events: RecordingEvent[], full: boolean): string {
  const output: string[] = [];

  // Track screen state for diff reconstruction
  let currentLines: string[] = [];
  const screenSnapshots: { time: number; lines: string[] }[] = [];
  const markerIndices: number[] = [];
  let eventIndex = 0;

  // First pass: reconstruct all screens and find markers
  const allEvents: { event: RecordingEvent; screenIndex: number | null }[] = [];

  for (const event of events) {
    let screenIndex: number | null = null;

    if (event.type === 'screen') {
      if (event.mode === 'full') {
        currentLines = [...(event as RecordingScreenFull).lines];
      } else {
        const diff = event as RecordingScreenDiff;
        for (const [idx, line] of Object.entries(diff.changes)) {
          currentLines[parseInt(idx, 10)] = line;
        }
      }
      screenIndex = screenSnapshots.length;
      screenSnapshots.push({ time: event.time, lines: [...currentLines] });
    }

    if (event.type === 'marker') {
      markerIndices.push(screenSnapshots.length - 1);
    }

    allEvents.push({ event, screenIndex });
    eventIndex++;
  }

  // Find header
  const header = events.find(e => e.type === 'header');
  if (header && header.type === 'header') {
    output.push('# TUI Recording Summary');
    output.push('');
    output.push(`Command: ${header.command}`);
    output.push(`Working directory: ${header.cwd}`);
    output.push(`Terminal size: ${header.cols}x${header.rows}`);
    output.push(`Started: ${header.startTime}`);
    output.push('');
  }

  // Find footer
  const footer = events.find(e => e.type === 'footer');
  if (footer && footer.type === 'footer') {
    output.push(`Duration: ${formatTime(footer.duration)}`);
    output.push(`Exit code: ${footer.exitCode ?? 'unknown'}`);
    output.push(`Total inputs: ${footer.totalInputs}, Screen changes: ${footer.totalScreenChanges}`);
    output.push('');
  }

  output.push('---');
  output.push('');

  if (full) {
    // Full mode: show all events
    for (const { event, screenIndex } of allEvents) {
      if (event.type === 'header' || event.type === 'footer') continue;

      if (event.type === 'input') {
        output.push(`[${formatTime(event.time)}] INPUT: ${event.key}`);
      } else if (event.type === 'screen' && screenIndex !== null) {
        output.push(`[${formatTime(event.time)}] SCREEN:`);
        output.push(renderScreen(screenSnapshots[screenIndex].lines));
        output.push('');
      } else if (event.type === 'marker') {
        output.push(`[${formatTime(event.time)}] >>> MARKER: ${event.label} <<<`);
        output.push('');
      } else if (event.type === 'resize') {
        output.push(`[${formatTime(event.time)}] RESIZE: ${event.cols}x${event.rows}`);
      }
    }
  } else {
    // Smart trimming: show first 3 screens, marker neighborhoods, last 3 screens
    const importantScreenIndices = new Set<number>();

    // First 3
    for (let i = 0; i < Math.min(3, screenSnapshots.length); i++) {
      importantScreenIndices.add(i);
    }

    // Last 3
    for (let i = Math.max(0, screenSnapshots.length - 3); i < screenSnapshots.length; i++) {
      importantScreenIndices.add(i);
    }

    // Marker neighborhoods (±2)
    for (const mi of markerIndices) {
      for (let i = Math.max(0, mi - 2); i <= Math.min(screenSnapshots.length - 1, mi + 2); i++) {
        importantScreenIndices.add(i);
      }
    }

    const sortedIndices = [...importantScreenIndices].sort((a, b) => a - b);
    let lastShownIndex = -1;
    let lastInputTime = -1;
    const inputsBetween: string[] = [];

    for (const { event, screenIndex } of allEvents) {
      if (event.type === 'header' || event.type === 'footer') continue;

      if (event.type === 'input') {
        inputsBetween.push(event.key);
        lastInputTime = event.time;
        continue;
      }

      if (event.type === 'marker') {
        output.push(`[${formatTime(event.time)}] >>> MARKER: ${event.label} <<<`);
        output.push('');
        continue;
      }

      if (event.type === 'resize') {
        output.push(`[${formatTime(event.time)}] RESIZE: ${event.cols}x${event.rows}`);
        continue;
      }

      if (event.type === 'screen' && screenIndex !== null) {
        if (!importantScreenIndices.has(screenIndex)) {
          continue;
        }

        // Show gap indicator
        if (lastShownIndex >= 0 && screenIndex - lastShownIndex > 1) {
          const skipped = screenIndex - lastShownIndex - 1;
          output.push(`  ... (${skipped} screen change${skipped > 1 ? 's' : ''} omitted) ...`);
          output.push('');
        }

        // Show accumulated inputs
        if (inputsBetween.length > 0) {
          const inputSummary = inputsBetween.length <= 5
            ? inputsBetween.join(', ')
            : `${inputsBetween.slice(0, 3).join(', ')} ... +${inputsBetween.length - 3} more`;
          output.push(`[${formatTime(lastInputTime)}] INPUTS: ${inputSummary}`);
          inputsBetween.length = 0;
        }

        output.push(`[${formatTime(screenSnapshots[screenIndex].time)}] SCREEN:`);
        output.push(renderScreen(screenSnapshots[screenIndex].lines));
        output.push('');

        lastShownIndex = screenIndex;
      }
    }
  }

  return output.join('\n');
}

function main(): void {
  const { inputFile, full } = parseArgs();

  if (!fs.existsSync(inputFile)) {
    console.error(`File not found: ${inputFile}`);
    process.exit(1);
  }

  const content = fs.readFileSync(inputFile, 'utf-8');
  const events: RecordingEvent[] = content
    .split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line) as RecordingEvent);

  const summary = summarize(events, full);
  process.stdout.write(summary + '\n');
}

main();
