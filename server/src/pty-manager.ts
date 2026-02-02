/**
 * PTY Manager - Handles launching and managing TUI applications in a pseudo-terminal
 */

import * as pty from 'node-pty';
import { EventEmitter } from 'events';

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
const KEY_SEQUENCES: Record<string, string> = {
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
const CTRL_KEYS: Record<string, string> = {
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
  private screenBuffer: string[] = [];
  private rawBuffer: string = '';
  private cols: number;
  private rows: number;
  private cursorRow: number = 0;
  private cursorCol: number = 0;
  private isRunning: boolean = false;
  private lastExitInfo: ExitInfo | null = null;

  constructor(private options: PtyOptions) {
    super();
    this.cols = options.cols ?? 80;
    this.rows = options.rows ?? 24;
    this.initializeBuffer();
  }

  /**
   * Initialize the screen buffer with empty lines
   */
  private initializeBuffer(): void {
    this.screenBuffer = Array(this.rows).fill(''.padEnd(this.cols, ' '));
    this.cursorRow = 0;
    this.cursorCol = 0;
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
    this.initializeBuffer();

    this.ptyProcess.onData((data) => {
      this.rawBuffer += data;
      this.processOutput(data);
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
   * Process terminal output and update screen buffer
   * This is a simplified ANSI parser - handles common sequences
   */
  private processOutput(data: string): void {
    let i = 0;
    while (i < data.length) {
      const char = data[i];

      if (char === '\x1b') {
        // ESC sequence
        const remaining = data.slice(i);

        // CSI sequence: ESC [ ... letter
        const csiMatch = remaining.match(/^\x1b\[([0-9;]*)([A-Za-z@`])/);
        if (csiMatch) {
          this.handleCSI(csiMatch[1], csiMatch[2]);
          i += csiMatch[0].length;
          continue;
        }

        // OSC sequence: ESC ] ... BEL or ST
        const oscMatch = remaining.match(/^\x1b\].*?(?:\x07|\x1b\\)/);
        if (oscMatch) {
          i += oscMatch[0].length;
          continue;
        }

        // Simple ESC sequences
        if (remaining.length > 1) {
          const next = remaining[1];
          if (next === 'c') {
            // Reset
            this.initializeBuffer();
            i += 2;
            continue;
          }
          if (next === '7') {
            // Save cursor (ignore for now)
            i += 2;
            continue;
          }
          if (next === '8') {
            // Restore cursor (ignore for now)
            i += 2;
            continue;
          }
          if (next === '(' || next === ')') {
            // Character set selection
            i += 3;
            continue;
          }
        }

        i++;
        continue;
      }

      // Control characters
      if (char === '\r') {
        this.cursorCol = 0;
        i++;
        continue;
      }

      if (char === '\n') {
        this.cursorRow++;
        if (this.cursorRow >= this.rows) {
          // Scroll up
          this.screenBuffer.shift();
          this.screenBuffer.push(''.padEnd(this.cols, ' '));
          this.cursorRow = this.rows - 1;
        }
        i++;
        continue;
      }

      if (char === '\b') {
        if (this.cursorCol > 0) this.cursorCol--;
        i++;
        continue;
      }

      if (char === '\t') {
        this.cursorCol = Math.min(this.cols - 1, (Math.floor(this.cursorCol / 8) + 1) * 8);
        i++;
        continue;
      }

      if (char === '\x07') {
        // Bell - ignore
        i++;
        continue;
      }

      // Printable character
      if (char >= ' ') {
        this.putChar(char);
        i++;
        continue;
      }

      // Skip other control characters
      i++;
    }
  }

  /**
   * Handle CSI (Control Sequence Introducer) sequences
   */
  private handleCSI(params: string, command: string): void {
    const args = params ? params.split(';').map((n) => parseInt(n, 10) || 0) : [];

    switch (command) {
      case 'H': // Cursor position
      case 'f':
        this.cursorRow = Math.max(0, Math.min(this.rows - 1, (args[0] || 1) - 1));
        this.cursorCol = Math.max(0, Math.min(this.cols - 1, (args[1] || 1) - 1));
        break;

      case 'A': // Cursor up
        this.cursorRow = Math.max(0, this.cursorRow - (args[0] || 1));
        break;

      case 'B': // Cursor down
        this.cursorRow = Math.min(this.rows - 1, this.cursorRow + (args[0] || 1));
        break;

      case 'C': // Cursor forward
        this.cursorCol = Math.min(this.cols - 1, this.cursorCol + (args[0] || 1));
        break;

      case 'D': // Cursor back
        this.cursorCol = Math.max(0, this.cursorCol - (args[0] || 1));
        break;

      case 'J': // Erase in display
        {
          const mode = args[0] || 0;
          if (mode === 0) {
            // Clear from cursor to end
            this.clearLine(this.cursorRow, this.cursorCol, this.cols);
            for (let r = this.cursorRow + 1; r < this.rows; r++) {
              this.screenBuffer[r] = ''.padEnd(this.cols, ' ');
            }
          } else if (mode === 1) {
            // Clear from start to cursor
            for (let r = 0; r < this.cursorRow; r++) {
              this.screenBuffer[r] = ''.padEnd(this.cols, ' ');
            }
            this.clearLine(this.cursorRow, 0, this.cursorCol + 1);
          } else if (mode === 2 || mode === 3) {
            // Clear entire screen
            this.initializeBuffer();
          }
        }
        break;

      case 'K': // Erase in line
        {
          const mode = args[0] || 0;
          if (mode === 0) {
            this.clearLine(this.cursorRow, this.cursorCol, this.cols);
          } else if (mode === 1) {
            this.clearLine(this.cursorRow, 0, this.cursorCol + 1);
          } else if (mode === 2) {
            this.screenBuffer[this.cursorRow] = ''.padEnd(this.cols, ' ');
          }
        }
        break;

      case 'm': // SGR (Select Graphic Rendition) - colors/styles, ignore
        break;

      case 'r': // Set scrolling region - ignore for now
        break;

      case 'h': // Set mode
      case 'l': // Reset mode
        // Ignore mode changes
        break;

      case '@': // Insert characters
        {
          const count = args[0] || 1;
          const line = this.screenBuffer[this.cursorRow];
          const before = line.slice(0, this.cursorCol);
          const after = line.slice(this.cursorCol, -count || undefined);
          this.screenBuffer[this.cursorRow] = (before + ''.padEnd(count, ' ') + after).slice(0, this.cols);
        }
        break;

      case 'P': // Delete characters
        {
          const count = args[0] || 1;
          const line = this.screenBuffer[this.cursorRow];
          const before = line.slice(0, this.cursorCol);
          const after = line.slice(this.cursorCol + count);
          this.screenBuffer[this.cursorRow] = (before + after).padEnd(this.cols, ' ');
        }
        break;
    }
  }

  /**
   * Put a character at the current cursor position
   */
  private putChar(char: string): void {
    if (this.cursorRow < 0 || this.cursorRow >= this.rows) return;

    const line = this.screenBuffer[this.cursorRow];
    const before = line.slice(0, this.cursorCol);
    const after = line.slice(this.cursorCol + 1);
    this.screenBuffer[this.cursorRow] = before + char + after;

    this.cursorCol++;
    if (this.cursorCol >= this.cols) {
      this.cursorCol = 0;
      this.cursorRow++;
      if (this.cursorRow >= this.rows) {
        // Scroll
        this.screenBuffer.shift();
        this.screenBuffer.push(''.padEnd(this.cols, ' '));
        this.cursorRow = this.rows - 1;
      }
    }
  }

  /**
   * Clear part of a line
   */
  private clearLine(row: number, start: number, end: number): void {
    if (row < 0 || row >= this.rows) return;
    const line = this.screenBuffer[row];
    const before = line.slice(0, start);
    const cleared = ''.padEnd(end - start, ' ');
    const after = line.slice(end);
    this.screenBuffer[row] = before + cleared + after;
  }

  /**
   * Get the current screen content
   */
  getScreen(): ScreenBuffer {
    return {
      lines: [...this.screenBuffer],
      cursorRow: this.cursorRow,
      cursorCol: this.cursorCol,
      cols: this.cols,
      rows: this.rows,
    };
  }

  /**
   * Get screen content as a single string
   */
  getScreenText(): string {
    return this.screenBuffer.map((line) => line.trimEnd()).join('\n');
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

    // Resize buffer
    while (this.screenBuffer.length < rows) {
      this.screenBuffer.push(''.padEnd(cols, ' '));
    }
    while (this.screenBuffer.length > rows) {
      this.screenBuffer.pop();
    }
    this.screenBuffer = this.screenBuffer.map((line) => {
      if (line.length < cols) return line.padEnd(cols, ' ');
      if (line.length > cols) return line.slice(0, cols);
      return line;
    });
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
