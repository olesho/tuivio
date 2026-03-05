/**
 * PTY Manager - Handles launching and managing TUI applications in a pseudo-terminal
 */

import * as pty from 'node-pty';
import { EventEmitter } from 'events';
import { AnsiParser } from './ansi-parser.js';

export interface PtyOptions {
  /** Path to the application to run */
  command: string;
  /** Arguments to pass to the application */
  args?: string[];
  /** Working directory */
  cwd?: string;
  /** Environment variables */
  env?: Record<string, string>;
  /** Terminal columns (default: 80) */
  cols?: number;
  /** Terminal rows (default: 24) */
  rows?: number;
}

export interface ScreenBuffer {
  /** Raw screen content as lines */
  lines: string[];
  /** Current cursor row (0-indexed) */
  cursorRow: number;
  /** Current cursor column (0-indexed) */
  cursorCol: number;
  /** Terminal width */
  cols: number;
  /** Terminal height */
  rows: number;
}

/**
 * Special key mappings to their escape sequences
 */
export const KEY_SEQUENCES: Record<string, string> = {
  // Navigation
  enter: '\r',
  return: '\r',
  tab: '\t',
  escape: '\x1b',
  esc: '\x1b',
  backspace: '\x7f',
  delete: '\x1b[3~',

  // Arrow keys
  up: '\x1b[A',
  down: '\x1b[B',
  right: '\x1b[C',
  left: '\x1b[D',

  // Home/End/Page
  home: '\x1b[H',
  end: '\x1b[F',
  pageup: '\x1b[5~',
  pagedown: '\x1b[6~',
  insert: '\x1b[2~',

  // Function keys
  f1: '\x1bOP',
  f2: '\x1bOQ',
  f3: '\x1bOR',
  f4: '\x1bOS',
  f5: '\x1b[15~',
  f6: '\x1b[17~',
  f7: '\x1b[18~',
  f8: '\x1b[19~',
  f9: '\x1b[20~',
  f10: '\x1b[21~',
  f11: '\x1b[23~',
  f12: '\x1b[24~',

  // Space
  space: ' ',
};

/**
 * Control key mappings (Ctrl+key produces ASCII 1-26)
 */
export const CTRL_KEYS: Record<string, string> = {
  'ctrl+a': '\x01',
  'ctrl+b': '\x02',
  'ctrl+c': '\x03',
  'ctrl+d': '\x04',
  'ctrl+e': '\x05',
  'ctrl+f': '\x06',
  'ctrl+g': '\x07',
  'ctrl+h': '\x08',
  'ctrl+i': '\x09',
  'ctrl+j': '\x0a',
  'ctrl+k': '\x0b',
  'ctrl+l': '\x0c',
  'ctrl+m': '\x0d',
  'ctrl+n': '\x0e',
  'ctrl+o': '\x0f',
  'ctrl+p': '\x10',
  'ctrl+q': '\x11',
  'ctrl+r': '\x12',
  'ctrl+s': '\x13',
  'ctrl+t': '\x14',
  'ctrl+u': '\x15',
  'ctrl+v': '\x16',
  'ctrl+w': '\x17',
  'ctrl+x': '\x18',
  'ctrl+y': '\x19',
  'ctrl+z': '\x1a',
};

export interface ExitInfo {
  exitCode: number;
  signal?: number;
}

export class PtyManager extends EventEmitter {
  private ptyProcess: pty.IPty | null = null;
  private ansiParser: AnsiParser;
  private rawBuffer: string = '';
  private cols: number;
  private rows: number;
  private isRunning: boolean = false;
  private lastExitInfo: ExitInfo | null = null;

  constructor(private options: PtyOptions) {
    super();
    this.cols = options.cols ?? 80;
    this.rows = options.rows ?? 24;
    this.ansiParser = new AnsiParser(this.cols, this.rows);
  }

  /**
   * Start the TUI application
   */
  start(): void {
    if (this.isRunning) {
      throw new Error('PTY is already running');
    }

    if (!this.options.command) {
      throw new Error('No command specified. Use run_tui tool to start a TUI application.');
    }

    const env = {
      ...process.env,
      ...this.options.env,
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
    };

    this.ptyProcess = pty.spawn(this.options.command, this.options.args ?? [], {
      name: 'xterm-256color',
      cols: this.cols,
      rows: this.rows,
      cwd: this.options.cwd ?? process.cwd(),
      env: env as Record<string, string>,
    });

    this.isRunning = true;
    this.lastExitInfo = null;
    this.rawBuffer = '';
    this.ansiParser = new AnsiParser(this.cols, this.rows);

    this.ptyProcess.onData((data) => {
      this.rawBuffer += data;
      this.ansiParser.processOutput(data);
      this.emit('data', data);
    });

    this.ptyProcess.onExit(({ exitCode, signal }) => {
      this.isRunning = false;
      this.lastExitInfo = { exitCode, signal };
      this.emit('exit', { exitCode, signal });
    });

    this.emit('start');
  }

  /**
   * Get the current screen content
   */
  getScreen(): ScreenBuffer {
    const state = this.ansiParser.getState();
    return {
      lines: state.lines,
      cursorRow: state.cursorRow,
      cursorCol: state.cursorCol,
      cols: state.cols,
      rows: state.rows,
    };
  }

  /**
   * Get screen content as a single string
   */
  getScreenText(): string {
    return this.ansiParser.getScreenText();
  }

  /**
   * Get information about the last process exit (exit code and signal)
   */
  getLastExitInfo(): ExitInfo | null {
    return this.lastExitInfo;
  }

  /**
   * Get the last N lines from the raw output buffer
   * Useful for debugging when a TUI crashes
   */
  getLastOutput(lines: number = 20): string {
    // Split the raw buffer into lines
    const allLines = this.rawBuffer.split('\n');
    // Get the last N lines
    const lastLines = allLines.slice(-lines);
    return lastLines.join('\n');
  }

  /**
   * Send text input to the TUI application
   */
  typeText(text: string): void {
    if (!this.ptyProcess || !this.isRunning) {
      throw new Error('PTY is not running');
    }
    this.ptyProcess.write(text);
  }

  /**
   * Send a key press to the TUI application
   */
  pressKey(key: string): void {
    if (!this.ptyProcess || !this.isRunning) {
      throw new Error('PTY is not running');
    }

    const normalizedKey = key.toLowerCase().trim();

    // Check for control key combinations
    if (CTRL_KEYS[normalizedKey]) {
      this.ptyProcess.write(CTRL_KEYS[normalizedKey]);
      return;
    }

    // Check for special keys
    if (KEY_SEQUENCES[normalizedKey]) {
      this.ptyProcess.write(KEY_SEQUENCES[normalizedKey]);
      return;
    }

    // If it's a single character, just send it
    if (key.length === 1) {
      this.ptyProcess.write(key);
      return;
    }

    throw new Error(`Unknown key: ${key}`);
  }

  /**
   * Resize the terminal
   */
  resize(cols: number, rows: number): void {
    this.cols = cols;
    this.rows = rows;

    if (this.ptyProcess && this.isRunning) {
      this.ptyProcess.resize(cols, rows);
    }

    this.ansiParser.resize(cols, rows);
  }

  /**
   * Stop the TUI application
   */
  stop(): void {
    if (this.ptyProcess && this.isRunning) {
      this.ptyProcess.kill();
      this.isRunning = false;
    }
  }

  /**
   * Restart the PTY with new options
   */
  restart(options: Partial<PtyOptions>): void {
    this.stop();

    // Update options
    if (options.command) this.options.command = options.command;
    if (options.args !== undefined) this.options.args = options.args;
    if (options.cwd !== undefined) this.options.cwd = options.cwd;
    if (options.env !== undefined) this.options.env = options.env;
    if (options.cols !== undefined) {
      this.options.cols = options.cols;
      this.cols = options.cols;
    }
    if (options.rows !== undefined) {
      this.options.rows = options.rows;
      this.rows = options.rows;
    }

    this.start();
  }

  /**
   * Check if the PTY is running
   */
  get running(): boolean {
    return this.isRunning;
  }

  /**
   * Get terminal dimensions
   */
  getSize(): { cols: number; rows: number } {
    return { cols: this.cols, rows: this.rows };
  }

  /**
   * Wait for a specified duration (useful for letting the TUI render)
   */
  async wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
