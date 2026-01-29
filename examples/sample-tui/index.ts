#!/usr/bin/env node
/**
 * Sample TUI Application for testing the TUI MCP Server
 *
 * Features:
 * - Menu navigation (arrow keys)
 * - Text input field
 * - Status display
 * - Action buttons
 */

import blessed from 'blessed';

// Create the screen
const screen = blessed.screen({
  smartCSR: true,
  title: 'TUI MCP Test Application',
});

// Header
const header = blessed.box({
  parent: screen,
  top: 0,
  left: 0,
  width: '100%',
  height: 3,
  content: '{center}TUI MCP Test Application{/center}',
  tags: true,
  style: {
    fg: 'white',
    bg: 'blue',
    bold: true,
  },
});

// Menu list
const menuItems = ['Option 1: Say Hello', 'Option 2: Show Time', 'Option 3: Toggle Mode', 'Option 4: Clear Status', 'Option 5: Exit'];

const menu = blessed.list({
  parent: screen,
  label: ' Menu (↑/↓ to navigate, Enter to select) ',
  top: 4,
  left: 0,
  width: '50%',
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
      fg: 'cyan',
    },
    selected: {
      fg: 'black',
      bg: 'cyan',
    },
    item: {
      fg: 'white',
    },
  },
});

// Text input
const inputBox = blessed.textbox({
  parent: screen,
  label: ' Text Input (Tab to focus, Enter to submit) ',
  top: 4,
  left: '50%',
  width: '50%',
  height: 3,
  inputOnFocus: true,
  border: {
    type: 'line',
  },
  style: {
    border: {
      fg: 'green',
    },
    focus: {
      border: {
        fg: 'yellow',
      },
    },
  },
});

// Status display
const statusBox = blessed.box({
  parent: screen,
  label: ' Status ',
  top: 8,
  left: '50%',
  width: '50%',
  height: 6,
  content: 'Ready. Use Tab to switch focus.\nArrows to navigate menu.\nEnter to select.',
  border: {
    type: 'line',
  },
  style: {
    border: {
      fg: 'magenta',
    },
  },
});

// Mode indicator
let darkMode = false;
const modeBox = blessed.box({
  parent: screen,
  top: menuItems.length + 6,
  left: 0,
  width: '50%',
  height: 3,
  content: '{center}Mode: Light{/center}',
  tags: true,
  border: {
    type: 'line',
  },
  style: {
    border: {
      fg: 'yellow',
    },
  },
});

// Footer with instructions
const footer = blessed.box({
  parent: screen,
  bottom: 0,
  left: 0,
  width: '100%',
  height: 3,
  content: '{center}Tab: Switch Focus | q/Esc: Quit | Ctrl+C: Force Exit{/center}',
  tags: true,
  style: {
    fg: 'black',
    bg: 'white',
  },
});

// Track current input value
let currentInput = '';
let menuHasFocus = true;

// Menu selection handler
menu.on('select', (item, index) => {
  switch (index) {
    case 0: // Say Hello
      statusBox.setContent(`Hello! You selected Option 1.\nInput was: "${currentInput}"`);
      break;
    case 1: // Show Time
      statusBox.setContent(`Current time:\n${new Date().toLocaleString()}`);
      break;
    case 2: // Toggle Mode
      darkMode = !darkMode;
      modeBox.setContent(`{center}Mode: ${darkMode ? 'Dark' : 'Light'}{/center}`);
      statusBox.setContent(`Mode toggled to: ${darkMode ? 'Dark' : 'Light'}`);
      break;
    case 3: // Clear Status
      statusBox.setContent('Status cleared.');
      currentInput = '';
      inputBox.clearValue();
      break;
    case 4: // Exit
      screen.destroy();
      process.exit(0);
  }
  screen.render();
});

// Input submission handler
inputBox.on('submit', (value) => {
  currentInput = value;
  statusBox.setContent(`Input received:\n"${value}"\n\nPress Enter on menu to use it.`);
  menu.focus();
  menuHasFocus = true;
  screen.render();
});

// Cancel input handler
inputBox.on('cancel', () => {
  menu.focus();
  menuHasFocus = true;
  screen.render();
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

// Tab to switch focus
screen.key(['tab'], () => {
  if (menuHasFocus) {
    inputBox.focus();
    menuHasFocus = false;
  } else {
    menu.focus();
    menuHasFocus = true;
  }
  screen.render();
});

// Initial focus
menu.focus();
menu.select(0);

// Render the screen
screen.render();
