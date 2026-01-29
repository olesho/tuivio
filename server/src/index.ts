#!/usr/bin/env node
/**
 * TUI MCP Server - Model Context Protocol server for controlling Terminal UI applications
 *
 * This server provides tools for Claude Code to interact with TUI applications:
 * - view_screen: Get the current terminal screen content
 * - type_text: Send text input to the TUI
 * - press_key: Send key presses (arrows, enter, escape, etc.)
 * - get_screen_size: Get terminal dimensions
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { PtyManager } from './pty-manager.js';
import { TerminalRegistry } from './terminal-registry.js';
import * as fs from 'fs';

// Parse command line arguments
const args = process.argv.slice(2);
let command: string | undefined;
let commandArgs: string[] = [];
let cols = 80;
let rows = 24;
let cwd: string | undefined;
let liveDisplay = false;
let liveFilePath: string | undefined;
let logFilePath: string = './tuivio.log';

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--cols' && args[i + 1]) {
    cols = parseInt(args[++i], 10);
  } else if (arg === '--rows' && args[i + 1]) {
    rows = parseInt(args[++i], 10);
  } else if (arg === '--cwd' && args[i + 1]) {
    cwd = args[++i];
  } else if (arg === '--live' || arg === '-l') {
    liveDisplay = true;
  } else if (arg === '--live-file' && args[i + 1]) {
    liveFilePath = args[++i];
  } else if (arg === '--log-file' && args[i + 1]) {
    logFilePath = args[++i];
  } else if (!command) {
    command = arg;
  } else {
    commandArgs.push(arg);
  }
}

// Live display: renders the TUI screen to stderr for human observation
// Only works when stderr is a TTY
const isTTY = process.stderr.isTTY;
if (liveDisplay && !isTTY) {
  console.error('Warning: --live flag ignored because stderr is not a TTY');
  liveDisplay = false;
}

// ANSI escape sequences for terminal control
const ESC = '\x1b';
const CSI = `${ESC}[`;

// Terminal control functions (write to stderr)
const term = {
  // Move cursor to position (1-indexed)
  moveTo: (row: number, col: number) => `${CSI}${row};${col}H`,
  // Clear entire screen
  clear: () => `${CSI}2J`,
  // Hide cursor
  hideCursor: () => `${CSI}?25l`,
  // Show cursor
  showCursor: () => `${CSI}?25h`,
  // Save cursor position
  saveCursor: () => `${ESC}7`,
  // Restore cursor position
  restoreCursor: () => `${ESC}8`,
  // Set foreground color (256 color)
  fg: (color: number) => `${CSI}38;5;${color}m`,
  // Set background color (256 color)
  bg: (color: number) => `${CSI}48;5;${color}m`,
  // Reset colors
  reset: () => `${CSI}0m`,
  // Bold
  bold: () => `${CSI}1m`,
  // Dim
  dim: () => `${CSI}2m`,
  // Reverse video (swap fg/bg)
  reverse: () => `${CSI}7m`,
};

// Status bar height (for tool call display)
const STATUS_BAR_HEIGHT = 3;

// Last tool call info for display
let lastToolCall = '';
let lastToolTime = Date.now();

/**
 * Render the TUI screen to stderr for live observation
 */
function renderLiveDisplay(ptyManager: PtyManager): void {
  if (!liveDisplay || !isTTY) return;

  const screen = ptyManager.getScreen();
  const termCols = process.stderr.columns || 80;
  const termRows = process.stderr.rows || 24;

  // Calculate available space for TUI display (leave room for status bar)
  const displayRows = Math.min(screen.rows, termRows - STATUS_BAR_HEIGHT);

  let output = '';

  // Move to top-left and hide cursor during render
  output += term.hideCursor();
  output += term.moveTo(1, 1);

  // Draw a border/header
  const title = ' TUI Live View ';
  const headerLine = '─'.repeat(Math.floor((termCols - title.length) / 2)) +
                     title +
                     '─'.repeat(Math.ceil((termCols - title.length) / 2));
  output += term.bold() + term.fg(45) + headerLine.slice(0, termCols) + term.reset() + '\n';

  // Render each line of the screen buffer
  for (let i = 0; i < displayRows; i++) {
    const line = screen.lines[i] || '';
    // Pad or truncate line to fit terminal width
    const displayLine = line.length > termCols ? line.slice(0, termCols) : line.padEnd(termCols, ' ');
    output += displayLine + '\n';
  }

  // Draw separator before status bar
  const separator = '─'.repeat(termCols);
  output += term.bold() + term.fg(45) + separator + term.reset() + '\n';

  // Status bar: show last tool call
  const timeSince = Math.floor((Date.now() - lastToolTime) / 1000);
  const timeStr = timeSince < 60 ? `${timeSince}s ago` : `${Math.floor(timeSince / 60)}m ago`;
  const statusLine = lastToolCall
    ? `Last: ${lastToolCall}`.slice(0, termCols - timeStr.length - 3) + ` (${timeStr})`
    : 'Waiting for MCP tool calls...';
  output += term.dim() + statusLine.padEnd(termCols, ' ') + term.reset();

  // Show cursor again
  output += term.showCursor();

  process.stderr.write(output);
}

/**
 * Write the TUI screen to a file for external observation (e.g., tail -f)
 */
function writeLiveFile(ptyManager: PtyManager): void {
  if (!liveFilePath) return;

  const screen = ptyManager.getScreen();
  const timestamp = new Date().toISOString();

  let output = '';
  const title = 'TUI Live View';
  const headerContent = title + timestamp.padStart(76 - title.length);
  output += `╔${'═'.repeat(78)}╗\n`;
  output += `║ ${headerContent} ║\n`;
  output += `╠${'═'.repeat(78)}╣\n`;

  // Render each line of the screen buffer
  for (let i = 0; i < screen.rows; i++) {
    const line = screen.lines[i] || '';
    const displayLine = line.trimEnd().slice(0, 76);
    output += `║ ${displayLine.padEnd(76)} ║\n`;
  }

  output += `╠${'═'.repeat(78)}╣\n`;

  // Status bar: show last tool call
  const timeSince = Math.floor((Date.now() - lastToolTime) / 1000);
  const timeStr = timeSince < 60 ? `${timeSince}s ago` : `${Math.floor(timeSince / 60)}m ago`;
  const statusLine = lastToolCall
    ? `Last: ${lastToolCall}`.slice(0, 66) + ` (${timeStr})`
    : 'Waiting for MCP tool calls...';
  output += `║ ${statusLine.padEnd(76)} ║\n`;
  output += `╚${'═'.repeat(78)}╝\n`;

  try {
    fs.writeFileSync(liveFilePath, output);
  } catch (err) {
    // Silently ignore write errors
  }
}

/**
 * Log MCP tool calls and results to file
 */
function logToFile(type: 'TOOL_CALL' | 'TOOL_RESULT', toolName: string, data: string): void {
  try {
    const timestamp = new Date().toISOString();
    const entry = `[${timestamp}] [${type}] ${toolName}: ${data}\n`;
    fs.appendFileSync(logFilePath, entry);
  } catch (err) {
    // Silently ignore write errors to avoid blocking MCP operations
  }
}

/**
 * Broadcast to all live outputs (TTY and/or file)
 */
function broadcastLiveDisplay(ptyManager: PtyManager): void {
  if (liveDisplay && isTTY) {
    renderLiveDisplay(ptyManager);
  }
  if (liveFilePath) {
    writeLiveFile(ptyManager);
  }
}

/**
 * Initialize live display mode
 */
function initLiveDisplay(): void {
  if (!liveDisplay || !isTTY) return;

  // Clear screen and set up
  process.stderr.write(term.clear() + term.moveTo(1, 1));

  // Handle terminal resize
  process.stderr.on('resize', () => {
    const manager = getFocusedManager();
    if (manager?.running) {
      broadcastLiveDisplay(manager);
    }
  });
}

/**
 * Get the currently focused PtyManager for live display
 */
function getFocusedManager(): PtyManager | null {
  // Try focused terminal first
  if (focusedTerminalId) {
    const manager = terminalRegistry.getManager(focusedTerminalId);
    if (manager) return manager;
  }
  // Fall back to most recent terminal
  const lastId = terminalRegistry.getLastTerminalId();
  if (lastId) {
    return terminalRegistry.getManager(lastId) || null;
  }
  // Fall back to legacy manager
  return legacyPtyManager;
}

/**
 * Clean up live display on exit
 */
function cleanupLiveDisplay(): void {
  if (!liveDisplay || !isTTY) return;

  // Reset terminal state
  process.stderr.write(term.showCursor() + term.reset() + '\n');
}

// Command is now optional - can be started later via run_tui tool

// Initialize Terminal Registry for managing multiple terminals
const terminalRegistry = new TerminalRegistry({ defaultCols: cols, defaultRows: rows });

// Track the focused terminal (for backwards compatibility when terminal_id is omitted)
let focusedTerminalId: string | null = null;

// Legacy single PtyManager for backwards compatibility when command is passed via CLI
let legacyPtyManager: PtyManager | null = null;

/**
 * Resolve which terminal to use based on the provided terminal_id
 * Returns the terminal ID, or 'legacy' for the legacy manager, or throws an error
 */
function resolveTerminalId(terminalId?: string): string {
  // If specific ID provided, validate it exists
  if (terminalId !== undefined) {
    // Special case for legacy terminal
    if (terminalId === 'legacy' && legacyPtyManager) {
      return 'legacy';
    }
    const terminal = terminalRegistry.get(terminalId);
    if (!terminal) {
      const availableIds = terminalRegistry.getTerminalIds();
      if (legacyPtyManager) {
        availableIds.unshift('legacy');
      }
      if (availableIds.length === 0) {
        throw new Error(`Terminal not found: ${terminalId}. No terminals available. Use create_process to start a TUI application.`);
      }
      throw new Error(`Terminal not found: ${terminalId}. Use list_tabs to see available terminals. Available: ${availableIds.join(', ')}`);
    }
    return terminalId;
  }

  // Use focused terminal if set and still exists
  if (focusedTerminalId && terminalRegistry.get(focusedTerminalId)) {
    return focusedTerminalId;
  }

  // Fall back to most recently created terminal in registry
  const lastId = terminalRegistry.getLastTerminalId();
  if (lastId) {
    return lastId;
  }

  // Fall back to legacy manager if it exists and is running
  if (legacyPtyManager && legacyPtyManager.running) {
    return 'legacy';
  }

  // No terminals available
  throw new Error('No terminals available. Use create_process to start a TUI application.');
}

/**
 * Get the PtyManager for the resolved terminal ID
 */
function getManagerForTerminal(terminalId?: string): PtyManager {
  const id = resolveTerminalId(terminalId);

  // Handle legacy manager
  if (id === 'legacy') {
    if (!legacyPtyManager) {
      throw new Error('Legacy terminal manager not found');
    }
    return legacyPtyManager;
  }

  const manager = terminalRegistry.getManager(id);
  if (!manager) {
    throw new Error(`Terminal ${id} manager not found`);
  }
  return manager;
}

// Create MCP server
const server = new Server(
  {
    name: 'tui-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'view_screen',
        description:
          'Get the current terminal screen content as text. Returns the visible screen buffer of the TUI application.',
        inputSchema: {
          type: 'object',
          properties: {
            terminal_id: {
              type: 'string',
              description: 'The terminal ID to view. If omitted, uses the focused/most-recent terminal.',
            },
            includeMetadata: {
              type: 'boolean',
              description: 'Include cursor position and screen size in the response',
              default: false,
            },
          },
        },
      },
      {
        name: 'type_text',
        description:
          'Type text into the TUI application. The text will be sent as keyboard input, character by character.',
        inputSchema: {
          type: 'object',
          properties: {
            terminal_id: {
              type: 'string',
              description: 'The terminal ID to type into. If omitted, uses the focused/most-recent terminal.',
            },
            text: {
              type: 'string',
              description: 'The text to type',
            },
          },
          required: ['text'],
        },
      },
      {
        name: 'press_key',
        description:
          'Press a key in the TUI application. Supports special keys like enter, escape, tab, arrow keys, function keys, and control combinations.',
        inputSchema: {
          type: 'object',
          properties: {
            terminal_id: {
              type: 'string',
              description: 'The terminal ID to send key to. If omitted, uses the focused/most-recent terminal.',
            },
            key: {
              type: 'string',
              description:
                'The key to press. Examples: "enter", "escape", "tab", "up", "down", "left", "right", "backspace", "delete", "home", "end", "pageup", "pagedown", "f1"-"f12", "ctrl+c", "ctrl+d", "space"',
            },
          },
          required: ['key'],
        },
      },
      {
        name: 'get_screen_size',
        description: 'Get the terminal dimensions (columns and rows)',
        inputSchema: {
          type: 'object',
          properties: {
            terminal_id: {
              type: 'string',
              description: 'The terminal ID to get size for. If omitted, uses the focused/most-recent terminal.',
            },
          },
        },
      },
      {
        name: 'wait',
        description: 'Wait for a specified duration to let the TUI application render or process input',
        inputSchema: {
          type: 'object',
          properties: {
            terminal_id: {
              type: 'string',
              description: 'The terminal ID to wait on. If omitted, uses the focused/most-recent terminal.',
            },
            ms: {
              type: 'number',
              description: 'Duration to wait in milliseconds',
              default: 100,
            },
          },
        },
      },
      {
        name: 'run_tui',
        description:
          'Start a TUI application in the focused terminal. If another TUI is already running in that terminal, it will be stopped first. For managing multiple terminals, use create_process instead.',
        inputSchema: {
          type: 'object',
          properties: {
            command: {
              type: 'string',
              description: 'The command to run (e.g., "vim", "htop", "node app.js")',
            },
            args: {
              type: 'array',
              items: { type: 'string' },
              description: 'Arguments to pass to the command',
            },
            cwd: {
              type: 'string',
              description: 'Working directory for the process',
            },
            cols: {
              type: 'number',
              description: 'Terminal width in columns (default: 80)',
            },
            rows: {
              type: 'number',
              description: 'Terminal height in rows (default: 24)',
            },
          },
          required: ['command'],
        },
      },
      {
        name: 'stop_tui',
        description: 'Stop the TUI application in the focused terminal.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'create_process',
        description:
          'Launch a new TUI application in a new terminal tab. Returns the terminal_id which can be used to interact with this terminal.',
        inputSchema: {
          type: 'object',
          properties: {
            command: {
              type: 'string',
              description: 'The command to run (e.g., "vim", "htop", "node app.js")',
            },
            args: {
              type: 'array',
              items: { type: 'string' },
              description: 'Arguments to pass to the command',
            },
            cwd: {
              type: 'string',
              description: 'Working directory for the process',
            },
            cols: {
              type: 'number',
              description: 'Terminal width in columns (default: 80)',
            },
            rows: {
              type: 'number',
              description: 'Terminal height in rows (default: 24)',
            },
          },
          required: ['command'],
        },
      },
      {
        name: 'kill_process',
        description: 'Terminate a terminal by its ID.',
        inputSchema: {
          type: 'object',
          properties: {
            terminal_id: {
              type: 'string',
              description: 'The terminal ID to kill',
            },
          },
          required: ['terminal_id'],
        },
      },
      {
        name: 'list_tabs',
        description: 'List all active terminals with their IDs, commands, and status.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: toolArgs } = request.params;

  // Log tool calls to stderr (stdout is used for MCP protocol)
  const argsStr = toolArgs ? JSON.stringify(toolArgs) : '{}';
  lastToolCall = `${name}(${argsStr})`;
  lastToolTime = Date.now();

  // Log tool call to file
  logToFile('TOOL_CALL', name, argsStr);

  // Always log to stderr when not in TTY live display mode
  if (!liveDisplay) {
    console.error(`[MCP Tool] ${name}(${argsStr})`);
  }

  // Broadcast to live display (TTY and/or file)
  if (liveDisplay || liveFilePath) {
    const manager = getFocusedManager();
    if (manager) {
      broadcastLiveDisplay(manager);
    }
  }

  let result: { content: Array<{ type: string; text: string }>; isError?: boolean };

  try {
    switch (name) {
      case 'view_screen': {
        const { terminal_id, includeMetadata } = toolArgs as { terminal_id?: string; includeMetadata?: boolean };
        const manager = getManagerForTerminal(terminal_id);
        const screen = manager.getScreen();

        if (includeMetadata) {
          result = {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    terminal_id: resolveTerminalId(terminal_id),
                    screen: screen.lines.map((l) => l.trimEnd()).join('\n'),
                    cursor: { row: screen.cursorRow, col: screen.cursorCol },
                    size: { cols: screen.cols, rows: screen.rows },
                  },
                  null,
                  2
                ),
              },
            ],
          };
        } else {
          result = {
            content: [
              {
                type: 'text',
                text: manager.getScreenText(),
              },
            ],
          };
        }
        break;
      }

      case 'type_text': {
        const { terminal_id, text } = toolArgs as { terminal_id?: string; text: string };
        if (!text) {
          throw new Error('text parameter is required');
        }
        const manager = getManagerForTerminal(terminal_id);
        manager.typeText(text);
        // Give the TUI a moment to process
        await manager.wait(50);
        result = {
          content: [
            {
              type: 'text',
              text: `Typed: "${text}"`,
            },
          ],
        };
        break;
      }

      case 'press_key': {
        const { terminal_id, key } = toolArgs as { terminal_id?: string; key: string };
        if (!key) {
          throw new Error('key parameter is required');
        }
        const manager = getManagerForTerminal(terminal_id);
        manager.pressKey(key);
        // Give the TUI a moment to process
        await manager.wait(50);
        result = {
          content: [
            {
              type: 'text',
              text: `Pressed: ${key}`,
            },
          ],
        };
        break;
      }

      case 'get_screen_size': {
        const { terminal_id } = toolArgs as { terminal_id?: string };
        const manager = getManagerForTerminal(terminal_id);
        const size = manager.getSize();
        result = {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ terminal_id: resolveTerminalId(terminal_id), ...size }),
            },
          ],
        };
        break;
      }

      case 'wait': {
        const { terminal_id, ms } = toolArgs as { terminal_id?: string; ms?: number };
        const manager = getManagerForTerminal(terminal_id);
        const waitMs = ms ?? 100;
        await manager.wait(waitMs);
        result = {
          content: [
            {
              type: 'text',
              text: `Waited ${waitMs}ms`,
            },
          ],
        };
        break;
      }

      case 'run_tui': {
        const { command: cmd, args: cmdArgs, cwd: cmdCwd, cols: cmdCols, rows: cmdRows } = toolArgs as {
          command: string;
          args?: string[];
          cwd?: string;
          cols?: number;
          rows?: number;
        };

        if (!cmd) {
          throw new Error('command parameter is required');
        }

        // Create a new terminal (or restart the focused one if it exists)
        let terminalId: string;
        if (focusedTerminalId && terminalRegistry.get(focusedTerminalId)) {
          // Restart the focused terminal
          const manager = terminalRegistry.getManager(focusedTerminalId)!;
          manager.restart({
            command: cmd,
            args: cmdArgs ?? [],
            cwd: cmdCwd,
            cols: cmdCols,
            rows: cmdRows,
          });
          terminalId = focusedTerminalId;
        } else {
          // Create a new terminal
          const info = terminalRegistry.create({
            command: cmd,
            args: cmdArgs ?? [],
            cwd: cmdCwd,
            cols: cmdCols,
            rows: cmdRows,
          });
          terminalId = info.id;
          focusedTerminalId = terminalId;
        }

        // Give the TUI a moment to initialize
        const manager = terminalRegistry.getManager(terminalId)!;
        await manager.wait(500);

        // Render live display after starting
        if (liveDisplay || liveFilePath) {
          broadcastLiveDisplay(manager);
        }

        result = {
          content: [
            {
              type: 'text',
              text: `Started TUI application: ${cmd}${cmdArgs?.length ? ' ' + cmdArgs.join(' ') : ''} (terminal_id: ${terminalId})`,
            },
          ],
        };
        break;
      }

      case 'stop_tui': {
        if (!focusedTerminalId || !terminalRegistry.get(focusedTerminalId)) {
          result = {
            content: [
              {
                type: 'text',
                text: 'No TUI application is currently running in the focused terminal',
              },
            ],
          };
          break;
        }

        const stopManager = terminalRegistry.getManager(focusedTerminalId);
        if (!stopManager?.running) {
          result = {
            content: [
              {
                type: 'text',
                text: 'No TUI application is currently running in the focused terminal',
              },
            ],
          };
          break;
        }

        terminalRegistry.kill(focusedTerminalId);
        const stoppedId = focusedTerminalId;
        focusedTerminalId = terminalRegistry.getLastTerminalId() || null;

        result = {
          content: [
            {
              type: 'text',
              text: `TUI application stopped (terminal_id: ${stoppedId})`,
            },
          ],
        };
        break;
      }

      case 'create_process': {
        const { command: cmd, args: cmdArgs, cwd: cmdCwd, cols: cmdCols, rows: cmdRows } = toolArgs as {
          command: string;
          args?: string[];
          cwd?: string;
          cols?: number;
          rows?: number;
        };

        if (!cmd) {
          throw new Error('command parameter is required');
        }

        const info = terminalRegistry.create({
          command: cmd,
          args: cmdArgs ?? [],
          cwd: cmdCwd,
          cols: cmdCols,
          rows: cmdRows,
        });

        // Set as focused terminal
        focusedTerminalId = info.id;

        // Give the TUI a moment to initialize
        await info.manager.wait(500);

        // Render live display after starting
        if (liveDisplay || liveFilePath) {
          broadcastLiveDisplay(info.manager);
        }

        result = {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                terminal_id: info.id,
                command: cmd + (cmdArgs?.length ? ' ' + cmdArgs.join(' ') : ''),
                message: `Created new terminal with ID ${info.id}`,
              }),
            },
          ],
        };
        break;
      }

      case 'kill_process': {
        const { terminal_id } = toolArgs as { terminal_id: string };

        if (!terminal_id) {
          throw new Error('terminal_id parameter is required');
        }

        if (!terminalRegistry.get(terminal_id)) {
          const availableIds = terminalRegistry.getTerminalIds();
          if (availableIds.length === 0) {
            throw new Error(`Terminal not found: ${terminal_id}. No terminals available.`);
          }
          throw new Error(`Terminal not found: ${terminal_id}. Use list_tabs to see available terminals. Available: ${availableIds.join(', ')}`);
        }

        terminalRegistry.kill(terminal_id);

        // Update focused terminal if we killed the focused one
        if (focusedTerminalId === terminal_id) {
          focusedTerminalId = terminalRegistry.getLastTerminalId() || null;
        }

        result = {
          content: [
            {
              type: 'text',
              text: `Killed terminal ${terminal_id}`,
            },
          ],
        };
        break;
      }

      case 'list_tabs': {
        const terminals = terminalRegistry.list();

        // Include legacy terminal if it exists and is running
        if (legacyPtyManager && legacyPtyManager.running) {
          const legacySize = legacyPtyManager.getSize();
          terminals.unshift({
            id: 'legacy',
            command: command + (commandArgs.length > 0 ? ' ' + commandArgs.join(' ') : ''),
            running: legacyPtyManager.running,
            cols: legacySize.cols,
            rows: legacySize.rows,
          });
        }

        if (terminals.length === 0) {
          result = {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  terminals: [],
                  focused: null,
                  message: 'No terminals available. Use create_process to start a TUI application.',
                }),
              },
            ],
          };
          break;
        }

        // Determine focused terminal ID (including legacy)
        const effectiveFocused = focusedTerminalId ||
          (legacyPtyManager?.running ? 'legacy' : terminalRegistry.getLastTerminalId()) ||
          null;

        result = {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                terminals,
                focused: effectiveFocused,
              }),
            },
          ],
        };
        break;
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    result = {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }

  // Log tool result to file
  const resultText = result.content.map((c) => c.text).join('');
  logToFile('TOOL_RESULT', name, resultText);

  return result;
});

/**
 * Set up live display event listeners on the terminal registry
 */
function setupLiveDisplayListeners(): void {
  // Skip if neither TTY live display nor file output is enabled
  if (!liveDisplay && !liveFilePath) return;

  // Debounce rendering to avoid overwhelming the terminal
  let renderTimeout: NodeJS.Timeout | null = null;
  const RENDER_DEBOUNCE_MS = 16; // ~60fps max

  terminalRegistry.on('data', ({ terminalId }: { terminalId: string }) => {
    // Only render if this is the focused terminal
    const currentFocused = focusedTerminalId || terminalRegistry.getLastTerminalId();
    if (terminalId !== currentFocused) return;

    if (renderTimeout) return;
    renderTimeout = setTimeout(() => {
      renderTimeout = null;
      const manager = getFocusedManager();
      if (manager) {
        broadcastLiveDisplay(manager);
      }
    }, RENDER_DEBOUNCE_MS);
  });

  terminalRegistry.on('exit', ({ terminalId }: { terminalId: string }) => {
    lastToolCall = `TUI process exited (terminal ${terminalId})`;
    lastToolTime = Date.now();
    const manager = getFocusedManager();
    if (manager) {
      broadcastLiveDisplay(manager);
    }
  });

  // Also handle legacy pty manager if used
  if (legacyPtyManager) {
    legacyPtyManager.on('data', () => {
      if (!focusedTerminalId && !terminalRegistry.hasTerminals()) {
        if (renderTimeout) return;
        renderTimeout = setTimeout(() => {
          renderTimeout = null;
          if (legacyPtyManager) {
            broadcastLiveDisplay(legacyPtyManager);
          }
        }, RENDER_DEBOUNCE_MS);
      }
    });

    legacyPtyManager.on('exit', () => {
      if (!focusedTerminalId && !terminalRegistry.hasTerminals()) {
        lastToolCall = 'TUI process exited';
        lastToolTime = Date.now();
        if (legacyPtyManager) {
          broadcastLiveDisplay(legacyPtyManager);
        }
      }
    });
  }
}

// Start the server
async function main() {
  // Initialize live display mode
  initLiveDisplay();

  // Start the TUI application if a command was provided via CLI args
  if (command) {
    // Create a legacy pty manager for backwards compatibility
    legacyPtyManager = new PtyManager({
      command,
      args: commandArgs,
      cwd,
      cols,
      rows,
    });
    legacyPtyManager.start();
    // Give it a moment to initialize
    await legacyPtyManager.wait(500);

    // Render initial display
    if (liveDisplay || liveFilePath) {
      broadcastLiveDisplay(legacyPtyManager);
    }
  }

  // Set up live display listeners (after legacyPtyManager is potentially created)
  setupLiveDisplayListeners();

  // Connect to stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Handle cleanup
  process.on('SIGINT', () => {
    cleanupLiveDisplay();
    terminalRegistry.killAll();
    if (legacyPtyManager) {
      legacyPtyManager.stop();
    }
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    cleanupLiveDisplay();
    terminalRegistry.killAll();
    if (legacyPtyManager) {
      legacyPtyManager.stop();
    }
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('Failed to start TUI MCP server:', error);
  process.exit(1);
});
