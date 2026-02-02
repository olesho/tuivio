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
const header = blessed.box({
  parent: screen,
  top: 0,
  left: 0,
  width: '100%',
  height: 3,
  content: '{center}Crash Test TUI - Tuivio Testing{/center}',
  tags: true,
  style: {
    fg: 'white',
    bg: 'red',
    bold: true,
  },
});

// Menu items for different crash scenarios
const menuItems = [
  '1. Normal action (update status)',
  '2. Throw uncaught exception',
  '3. Exit with code 1 (error)',
  '4. Exit with code 139 (simulates segfault)',
  '5. Exit normally (code 0)',
];

const menu = blessed.list({
  parent: screen,
  label: ' Crash Test Menu (arrows + Enter) ',
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
  content: 'Select an option to test crash handling.\nUse arrows to navigate, Enter to select.',
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
const footer = blessed.box({
  parent: screen,
  bottom: 0,
  left: 0,
  width: '100%',
  height: 3,
  content: '{center}q/Esc: Quit | Ctrl+C: Force Exit{/center}',
  tags: true,
  style: {
    fg: 'black',
    bg: 'white',
  },
});

// Track action count for normal actions
let actionCount = 0;

// Menu selection handler
menu.on('select', (item, index) => {
  switch (index) {
    case 0: // Normal action
      actionCount++;
      statusBox.setContent(`Normal action #${actionCount} executed.\nEverything is working fine!`);
      screen.render();
      break;

    case 1: // Throw exception
      statusBox.setContent('Throwing uncaught exception in 1 second...');
      screen.render();
      setTimeout(() => {
        throw new Error('Deliberate crash! This is a test exception.');
      }, 1000);
      break;

    case 2: // Exit with code 1
      statusBox.setContent('Exiting with error code 1...');
      screen.render();
      setTimeout(() => {
        console.error('Error: Deliberate exit with code 1');
        process.exit(1);
      }, 500);
      break;

    case 3: // Exit with code 139 (segfault simulation)
      statusBox.setContent('Simulating segfault (exit code 139)...');
      screen.render();
      setTimeout(() => {
        console.error('Segmentation fault (simulated)');
        process.exit(139);
      }, 500);
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
