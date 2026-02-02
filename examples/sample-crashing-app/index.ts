#!/usr/bin/env node
/**
 * Sample Crashing TUI Application for testing Tuivio crash log capture
 *
 * This app provides menu options to trigger various crash scenarios:
 * - Throw an uncaught exception
 * - Exit with error code 1
 * - Exit with code 139 (simulates segfault)
 * - Normal exit (code 0)
 */

import blessed from 'blessed';

// Create the screen
const screen = blessed.screen({
  smartCSR: true,
  title: 'Crash Test TUI',
});

// Header
blessed.box({
  parent: screen,
  top: 0,
  left: 0,
  width: '100%',
  height: 3,
  content: '{center}Crash Test TUI{/center}',
  tags: true,
  style: {
    fg: 'white',
    bg: 'red',
    bold: true,
  },
});

// Menu items for crash scenarios
const menuItems = [
  '1. Normal action (update status)',
  '2. Throw uncaught exception',
  '3. Exit with code 1 (error)',
  '4. Exit with code 139 (segfault)',
  '5. Exit normally (code 0)',
];

const menu = blessed.list({
  parent: screen,
  label: ' Crash Test Menu ',
  top: 4,
  left: 'center',
  width: '60%',
  height: menuItems.length + 2,
  items: menuItems,
  keys: true,
  vi: true,
  mouse: true,
  border: {
    type: 'line',
  },
  style: {
    border: {
      fg: 'yellow',
    },
    selected: {
      fg: 'black',
      bg: 'yellow',
    },
    item: {
      fg: 'white',
    },
  },
});

// Status display
const statusBox = blessed.box({
  parent: screen,
  label: ' Status ',
  top: menuItems.length + 7,
  left: 'center',
  width: '60%',
  height: 5,
  content: 'Select an option to test crash scenarios.\nUse arrow keys to navigate, Enter to select.',
  border: {
    type: 'line',
  },
  style: {
    border: {
      fg: 'cyan',
    },
  },
});

// Footer
blessed.box({
  parent: screen,
  bottom: 0,
  left: 0,
  width: '100%',
  height: 3,
  content: '{center}Use arrows to navigate | Enter to select | q to quit{/center}',
  tags: true,
  style: {
    fg: 'black',
    bg: 'white',
  },
});

// Action counter
let actionCount = 0;

// Menu selection handler
menu.on('select', (_item, index) => {
  switch (index) {
    case 0: // Normal action
      actionCount++;
      statusBox.setContent(`Action performed ${actionCount} times.\nEverything is working normally.`);
      screen.render();
      break;

    case 1: // Throw uncaught exception
      statusBox.setContent('Throwing uncaught exception in 1 second...');
      screen.render();
      setTimeout(() => {
        // Write to stderr before crashing (this should appear in the output)
        console.error('ERROR: Deliberate crash triggered!');
        console.error('Stack trace will follow...');
        throw new Error('Deliberate uncaught exception for testing!');
      }, 1000);
      break;

    case 2: // Exit with code 1
      statusBox.setContent('Exiting with code 1 in 1 second...');
      screen.render();
      setTimeout(() => {
        console.error('Exiting with error code 1');
        screen.destroy();
        process.exit(1);
      }, 1000);
      break;

    case 3: // Exit with code 139 (simulates segfault)
      statusBox.setContent('Exiting with code 139 (simulating segfault) in 1 second...');
      screen.render();
      setTimeout(() => {
        console.error('Simulating segmentation fault (exit code 139)');
        screen.destroy();
        process.exit(139);
      }, 1000);
      break;

    case 4: // Normal exit
      statusBox.setContent('Exiting normally...');
      screen.render();
      setTimeout(() => {
        screen.destroy();
        process.exit(0);
      }, 500);
      break;
  }
});

// Global key bindings
screen.key(['escape', 'q'], () => {
  screen.destroy();
  process.exit(0);
});

screen.key(['C-c'], () => {
  screen.destroy();
  process.exit(0);
});

// Initial focus
menu.focus();
menu.select(0);

// Render the screen
screen.render();
