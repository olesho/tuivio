#!/usr/bin/env node
/**
 * Test script for the TUI MCP components
 * Launches the sample TUI and demonstrates screen capture and input
 */

import { PtyManager } from './pty-manager.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  console.log('=== TUI MCP Test ===\n');

  // Create PTY manager for the sample TUI
  const pty = new PtyManager({
    command: 'node',
    args: [join(__dirname, 'sample-tui', 'index.js')],
    cols: 80,
    rows: 24,
  });

  console.log('Starting sample TUI...\n');
  pty.start();

  // Wait for TUI to initialize
  await pty.wait(1000);

  // Capture and display initial screen
  console.log('--- Initial Screen ---');
  console.log(pty.getScreenText());
  console.log('----------------------\n');

  // Test navigation - press down arrow
  console.log('Pressing DOWN arrow...');
  pty.pressKey('down');
  await pty.wait(200);

  console.log('--- After DOWN ---');
  console.log(pty.getScreenText());
  console.log('------------------\n');

  // Press down again
  console.log('Pressing DOWN arrow again...');
  pty.pressKey('down');
  await pty.wait(200);

  console.log('--- After second DOWN ---');
  console.log(pty.getScreenText());
  console.log('-------------------------\n');

  // Press Enter to select "Show Time"
  console.log('Pressing ENTER to select...');
  pty.pressKey('enter');
  await pty.wait(200);

  console.log('--- After ENTER ---');
  console.log(pty.getScreenText());
  console.log('-------------------\n');

  // Test Tab to switch to input
  console.log('Pressing TAB to switch to input...');
  pty.pressKey('tab');
  await pty.wait(200);

  // Type some text
  console.log('Typing "Hello from MCP"...');
  pty.typeText('Hello from MCP');
  await pty.wait(200);

  console.log('--- After typing ---');
  console.log(pty.getScreenText());
  console.log('--------------------\n');

  // Submit the input
  console.log('Pressing ENTER to submit input...');
  pty.pressKey('enter');
  await pty.wait(200);

  console.log('--- Final Screen ---');
  console.log(pty.getScreenText());
  console.log('--------------------\n');

  // Get screen metadata
  const screen = pty.getScreen();
  console.log('Screen metadata:');
  console.log(`  Size: ${screen.cols}x${screen.rows}`);
  console.log(`  Cursor: row=${screen.cursorRow}, col=${screen.cursorCol}`);

  // Cleanup
  console.log('\nStopping TUI...');
  pty.stop();
  console.log('Test complete!');
}

main().catch(console.error);
