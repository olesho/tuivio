/**
 * ANSI Parser - Standalone screen buffer management and ANSI escape sequence parsing.
 * Extracted from pty-manager.ts for reuse in the recording system.
 */

export interface CellStyle {
  fg: number;       // -1 = default
  bg: number;       // -1 = default
  bold: boolean;
  reverse: boolean;
}

export interface LineHighlight {
  line: number;
  text: string;
  style: string;  // e.g. "reverse", "bg:cyan", "bold+reverse"
}

export interface ScreenState {
  lines: string[];
  cursorRow: number;
  cursorCol: number;
  cols: number;
  rows: number;
  highlights?: LineHighlight[];
}

const DEFAULT_STYLE: CellStyle = { fg: -1, bg: -1, bold: false, reverse: false };

const COLOR_NAMES: Record<number, string> = {
  0: 'black', 1: 'red', 2: 'green', 3: 'yellow',
  4: 'blue', 5: 'magenta', 6: 'cyan', 7: 'white',
};

export class AnsiParser {
  private screenBuffer: string[] = [];
  private styleBuffer: CellStyle[][] = [];
  private cursorRow: number = 0;
  private cursorCol: number = 0;
  private pendingWrap: boolean = false;
  private currentStyle: CellStyle = { ...DEFAULT_STYLE };

  constructor(private cols: number = 80, private rows: number = 24) {
    this.initializeBuffer();
  }

  private initializeBuffer(): void {
    this.screenBuffer = Array(this.rows).fill(''.padEnd(this.cols, ' '));
    this.styleBuffer = Array.from({ length: this.rows }, () =>
      Array.from({ length: this.cols }, () => ({ ...DEFAULT_STYLE }))
    );
    this.cursorRow = 0;
    this.cursorCol = 0;
    this.currentStyle = { ...DEFAULT_STYLE };
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
          this.styleBuffer.shift();
          this.styleBuffer.push(
            Array.from({ length: this.cols }, () => ({ ...DEFAULT_STYLE }))
          );
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
            this.styleBuffer[r] = Array.from({ length: this.cols }, () => ({ ...DEFAULT_STYLE }));
          }
        } else if (mode === 1) {
          for (let r = 0; r < this.cursorRow; r++) {
            this.screenBuffer[r] = ''.padEnd(this.cols, ' ');
            this.styleBuffer[r] = Array.from({ length: this.cols }, () => ({ ...DEFAULT_STYLE }));
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
          this.styleBuffer[this.cursorRow] = Array.from({ length: this.cols }, () => ({ ...DEFAULT_STYLE }));
        }
        break;
      }

      case 'm':
        this.handleSGR(args);
        break;
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

  private handleSGR(args: number[]): void {
    if (args.length === 0) args = [0];
    for (let i = 0; i < args.length; i++) {
      const code = args[i];
      if (code === 0) {
        this.currentStyle = { ...DEFAULT_STYLE };
      } else if (code === 1) {
        this.currentStyle.bold = true;
      } else if (code === 7) {
        this.currentStyle.reverse = true;
      } else if (code === 22) {
        this.currentStyle.bold = false;
      } else if (code === 27) {
        this.currentStyle.reverse = false;
      } else if (code >= 30 && code <= 37) {
        this.currentStyle.fg = code - 30;
      } else if (code === 38) {
        // Extended fg: 38;5;N or 38;2;R;G;B
        if (args[i + 1] === 5 && args[i + 2] !== undefined) {
          this.currentStyle.fg = args[i + 2];
          i += 2;
        } else if (args[i + 1] === 2 && args[i + 4] !== undefined) {
          this.currentStyle.fg = 256; // mark as RGB (exact color not tracked)
          i += 4;
        }
      } else if (code === 39) {
        this.currentStyle.fg = -1;
      } else if (code >= 40 && code <= 47) {
        this.currentStyle.bg = code - 40;
      } else if (code === 48) {
        // Extended bg: 48;5;N or 48;2;R;G;B
        if (args[i + 1] === 5 && args[i + 2] !== undefined) {
          this.currentStyle.bg = args[i + 2];
          i += 2;
        } else if (args[i + 1] === 2 && args[i + 4] !== undefined) {
          this.currentStyle.bg = 256;
          i += 4;
        }
      } else if (code === 49) {
        this.currentStyle.bg = -1;
      } else if (code >= 90 && code <= 97) {
        this.currentStyle.fg = code - 90 + 8; // bright colors
      } else if (code >= 100 && code <= 107) {
        this.currentStyle.bg = code - 100 + 8; // bright bg colors
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
        this.styleBuffer.shift();
        this.styleBuffer.push(
          Array.from({ length: this.cols }, () => ({ ...DEFAULT_STYLE }))
        );
        this.cursorRow = this.rows - 1;
      }
    }

    const line = this.screenBuffer[this.cursorRow];
    const before = line.slice(0, this.cursorCol);
    const after = line.slice(this.cursorCol + 1);
    this.screenBuffer[this.cursorRow] = before + char + after;
    this.styleBuffer[this.cursorRow][this.cursorCol] = { ...this.currentStyle };

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
    for (let c = start; c < end && c < this.cols; c++) {
      this.styleBuffer[row][c] = { ...DEFAULT_STYLE };
    }
  }

  getScreenText(): string {
    return this.screenBuffer.map((line) => line.trimEnd()).join('\n');
  }

  getLines(): string[] {
    return this.screenBuffer.map((line) => line.trimEnd());
  }

  getHighlightedLines(): LineHighlight[] {
    const highlights: LineHighlight[] = [];
    for (let r = 0; r < this.rows; r++) {
      const lineText = this.screenBuffer[r].trimEnd();
      if (!lineText) continue;

      // Check if any visible cell on this line has non-default styling
      let hasReverse = false;
      let hasBg = false;
      let bgColor = -1;
      let hasBold = false;

      for (let c = 0; c < lineText.length; c++) {
        const s = this.styleBuffer[r][c];
        if (s.reverse) hasReverse = true;
        if (s.bg >= 0) { hasBg = true; bgColor = s.bg; }
        if (s.bold) hasBold = true;
      }

      if (hasReverse || hasBg) {
        const parts: string[] = [];
        if (hasReverse) parts.push('reverse');
        if (hasBg) {
          const name = COLOR_NAMES[bgColor] || (bgColor < 256 ? `color${bgColor}` : 'rgb');
          parts.push(`bg:${name}`);
        }
        if (hasBold) parts.push('bold');
        highlights.push({ line: r, text: lineText, style: parts.join('+') });
      }
    }
    return highlights;
  }

  getState(): ScreenState {
    const highlights = this.getHighlightedLines();
    return {
      lines: [...this.screenBuffer],
      cursorRow: this.cursorRow,
      cursorCol: this.cursorCol,
      cols: this.cols,
      rows: this.rows,
      ...(highlights.length > 0 ? { highlights } : {}),
    };
  }

  resize(cols: number, rows: number): void {
    this.cols = cols;
    this.rows = rows;

    while (this.screenBuffer.length < rows) {
      this.screenBuffer.push(''.padEnd(cols, ' '));
      this.styleBuffer.push(
        Array.from({ length: cols }, () => ({ ...DEFAULT_STYLE }))
      );
    }
    while (this.screenBuffer.length > rows) {
      this.screenBuffer.pop();
      this.styleBuffer.pop();
    }
    this.screenBuffer = this.screenBuffer.map((line) => {
      if (line.length < cols) return line.padEnd(cols, ' ');
      if (line.length > cols) return line.slice(0, cols);
      return line;
    });
    this.styleBuffer = this.styleBuffer.map((row) => {
      while (row.length < cols) row.push({ ...DEFAULT_STYLE });
      if (row.length > cols) row.length = cols;
      return row;
    });
  }
}
