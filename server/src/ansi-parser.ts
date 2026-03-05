/**
 * ANSI Parser - Standalone screen buffer management and ANSI escape sequence parsing.
 * Extracted from pty-manager.ts for reuse in the recording system.
 */

export interface ScreenState {
  lines: string[];
  cursorRow: number;
  cursorCol: number;
  cols: number;
  rows: number;
}

export class AnsiParser {
  private screenBuffer: string[] = [];
  private cursorRow: number = 0;
  private cursorCol: number = 0;
  private pendingWrap: boolean = false;

  constructor(private cols: number = 80, private rows: number = 24) {
    this.initializeBuffer();
  }

  private initializeBuffer(): void {
    this.screenBuffer = Array(this.rows).fill(''.padEnd(this.cols, ' '));
    this.cursorRow = 0;
    this.cursorCol = 0;
  }

  processOutput(data: string): void {
    let i = 0;
    while (i < data.length) {
      const char = data[i];

      if (char === '\x1b') {
        const remaining = data.slice(i);

        // CSI sequence: ESC [ (optional private prefix) params (optional intermediate) final byte
        // Handles standard CSI, private modes (?), and intermediate bytes (space, etc.)
        const csiMatch = remaining.match(/^\x1b\[([?>=!]?)([0-9;]*)([\x20-\x2f]*)([\x40-\x7e])/);
        if (csiMatch) {
          const prefix = csiMatch[1];
          const params = csiMatch[2];
          const finalByte = csiMatch[4];
          this.handleCSI(params, finalByte, prefix);
          i += csiMatch[0].length;
          continue;
        }

        // OSC sequence: ESC ] ... BEL or ST
        const oscMatch = remaining.match(/^\x1b\].*?(?:\x07|\x1b\\)/);
        if (oscMatch) {
          i += oscMatch[0].length;
          continue;
        }

        // DCS, PM, APC sequences: ESC P ... ST, ESC ^ ... ST, ESC _ ... ST
        const dcsMatch = remaining.match(/^\x1b[P^_].*?(?:\x1b\\|\x07)/);
        if (dcsMatch) {
          i += dcsMatch[0].length;
          continue;
        }

        // Simple ESC sequences
        if (remaining.length > 1) {
          const next = remaining[1];
          if (next === 'c') {
            this.initializeBuffer();
            i += 2;
            continue;
          }
          // Save/restore cursor, keypad modes, reverse/forward index
          if ('78=>DEHM'.includes(next)) {
            i += 2;
            continue;
          }
          // Character set designation: ESC ( X, ESC ) X
          if (next === '(' || next === ')') {
            i += 3;
            continue;
          }
        }

        i++;
        continue;
      }

      if (char === '\r') {
        this.cursorCol = 0;
        this.pendingWrap = false;
        i++;
        continue;
      }

      if (char === '\n') {
        this.pendingWrap = false;
        this.cursorRow++;
        if (this.cursorRow >= this.rows) {
          this.screenBuffer.shift();
          this.screenBuffer.push(''.padEnd(this.cols, ' '));
          this.cursorRow = this.rows - 1;
        }
        i++;
        continue;
      }

      if (char === '\b') {
        if (this.cursorCol > 0) this.cursorCol--;
        this.pendingWrap = false;
        i++;
        continue;
      }

      if (char === '\t') {
        this.cursorCol = Math.min(this.cols - 1, (Math.floor(this.cursorCol / 8) + 1) * 8);
        i++;
        continue;
      }

      if (char === '\x07') {
        i++;
        continue;
      }

      if (char >= ' ') {
        this.putChar(char);
        i++;
        continue;
      }

      i++;
    }
  }

  private handleCSI(params: string, command: string, prefix: string = ''): void {
    // Private mode sequences (?, >, =, !) are no-ops for screen buffer purposes
    if (prefix) return;

    // Any CSI command clears the pending wrap state
    this.pendingWrap = false;

    const args = params ? params.split(';').map((n) => parseInt(n, 10) || 0) : [];

    switch (command) {
      case 'H':
      case 'f':
        this.cursorRow = Math.max(0, Math.min(this.rows - 1, (args[0] || 1) - 1));
        this.cursorCol = Math.max(0, Math.min(this.cols - 1, (args[1] || 1) - 1));
        break;

      case 'A':
        this.cursorRow = Math.max(0, this.cursorRow - (args[0] || 1));
        break;

      case 'B':
        this.cursorRow = Math.min(this.rows - 1, this.cursorRow + (args[0] || 1));
        break;

      case 'C':
        this.cursorCol = Math.min(this.cols - 1, this.cursorCol + (args[0] || 1));
        break;

      case 'D':
        this.cursorCol = Math.max(0, this.cursorCol - (args[0] || 1));
        break;

      case 'J': {
        const mode = args[0] || 0;
        if (mode === 0) {
          this.clearLine(this.cursorRow, this.cursorCol, this.cols);
          for (let r = this.cursorRow + 1; r < this.rows; r++) {
            this.screenBuffer[r] = ''.padEnd(this.cols, ' ');
          }
        } else if (mode === 1) {
          for (let r = 0; r < this.cursorRow; r++) {
            this.screenBuffer[r] = ''.padEnd(this.cols, ' ');
          }
          this.clearLine(this.cursorRow, 0, this.cursorCol + 1);
        } else if (mode === 2 || mode === 3) {
          this.initializeBuffer();
        }
        break;
      }

      case 'K': {
        const mode = args[0] || 0;
        if (mode === 0) {
          this.clearLine(this.cursorRow, this.cursorCol, this.cols);
        } else if (mode === 1) {
          this.clearLine(this.cursorRow, 0, this.cursorCol + 1);
        } else if (mode === 2) {
          this.screenBuffer[this.cursorRow] = ''.padEnd(this.cols, ' ');
        }
        break;
      }

      case 'm':
      case 'r':
      case 'h':
      case 'l':
        break;

      case '@': {
        const count = args[0] || 1;
        const line = this.screenBuffer[this.cursorRow];
        const before = line.slice(0, this.cursorCol);
        const after = line.slice(this.cursorCol, -count || undefined);
        this.screenBuffer[this.cursorRow] = (before + ''.padEnd(count, ' ') + after).slice(0, this.cols);
        break;
      }

      case 'P': {
        const count = args[0] || 1;
        const line = this.screenBuffer[this.cursorRow];
        const before = line.slice(0, this.cursorCol);
        const after = line.slice(this.cursorCol + count);
        this.screenBuffer[this.cursorRow] = (before + after).padEnd(this.cols, ' ');
        break;
      }
    }
  }

  private putChar(char: string): void {
    if (this.cursorRow < 0 || this.cursorRow >= this.rows) return;

    // Deferred wrap: if the previous character landed on the last column,
    // the wrap is deferred until the next printable character arrives.
    if (this.pendingWrap) {
      this.pendingWrap = false;
      this.cursorCol = 0;
      this.cursorRow++;
      if (this.cursorRow >= this.rows) {
        this.screenBuffer.shift();
        this.screenBuffer.push(''.padEnd(this.cols, ' '));
        this.cursorRow = this.rows - 1;
      }
    }

    const line = this.screenBuffer[this.cursorRow];
    const before = line.slice(0, this.cursorCol);
    const after = line.slice(this.cursorCol + 1);
    this.screenBuffer[this.cursorRow] = before + char + after;

    this.cursorCol++;
    if (this.cursorCol >= this.cols) {
      // Don't wrap yet — set pending flag. Wrap happens on next printable char.
      this.cursorCol = this.cols - 1;
      this.pendingWrap = true;
    }
  }

  private clearLine(row: number, start: number, end: number): void {
    if (row < 0 || row >= this.rows) return;
    const line = this.screenBuffer[row];
    const before = line.slice(0, start);
    const cleared = ''.padEnd(end - start, ' ');
    const after = line.slice(end);
    this.screenBuffer[row] = before + cleared + after;
  }

  getScreenText(): string {
    return this.screenBuffer.map((line) => line.trimEnd()).join('\n');
  }

  getLines(): string[] {
    return this.screenBuffer.map((line) => line.trimEnd());
  }

  getState(): ScreenState {
    return {
      lines: [...this.screenBuffer],
      cursorRow: this.cursorRow,
      cursorCol: this.cursorCol,
      cols: this.cols,
      rows: this.rows,
    };
  }

  resize(cols: number, rows: number): void {
    this.cols = cols;
    this.rows = rows;

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
}
