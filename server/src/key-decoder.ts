/**
 * Key Decoder - Maps raw terminal input bytes to human-readable key names.
 * Handles escape sequence buffering across stdin chunks and mouse events.
 */

import { KEY_SEQUENCES, CTRL_KEYS } from './pty-manager.js';

export interface DecodedKey {
  raw: string;
  key: string;
}

// Build inverse maps: escape sequence → key name
// KEY_SEQUENCES takes priority over CTRL_KEYS for friendlier names (enter > ctrl+m, tab > ctrl+i)
const inverseKeyMap = new Map<string, string>();

for (const [name, seq] of Object.entries(CTRL_KEYS)) {
  inverseKeyMap.set(seq, name);
}

// KEY_SEQUENCES override CTRL_KEYS entries, but skip aliases (keep first name per sequence)
const seenSeqs = new Set<string>();
for (const [name, seq] of Object.entries(KEY_SEQUENCES)) {
  if (!seenSeqs.has(seq)) {
    inverseKeyMap.set(seq, name);
    seenSeqs.add(seq);
  }
}

// SS3 application-mode arrow keys (terminals may send these instead of CSI variants)
inverseKeyMap.set('\x1bOA', 'up');
inverseKeyMap.set('\x1bOB', 'down');
inverseKeyMap.set('\x1bOC', 'right');
inverseKeyMap.set('\x1bOD', 'left');
// SS3 Home/End variants
inverseKeyMap.set('\x1bOH', 'home');
inverseKeyMap.set('\x1bOF', 'end');

// Sort by length descending for matching
const sortedSequences = [...inverseKeyMap.entries()].sort((a, b) => b[0].length - a[0].length);

/**
 * Decode a complete buffer of raw stdin bytes into human-readable key descriptions.
 * Assumes the buffer contains complete sequences (use InputBuffer to coalesce chunks).
 */
function decodeComplete(str: string): DecodedKey[] {
  const results: DecodedKey[] = [];
  let i = 0;

  while (i < str.length) {
    let matched = false;

    if (str[i] === '\x1b') {
      // Try known multi-byte sequences (longest first, skip bare \x1b)
      for (const [seq, name] of sortedSequences) {
        if (seq.length > 1 && seq.startsWith('\x1b') && str.startsWith(seq, i)) {
          results.push({ raw: seq, key: name });
          i += seq.length;
          matched = true;
          break;
        }
      }
      if (matched) continue;

      const remaining = str.slice(i);

      // Mouse tracking: X10 mode — \x1b[M followed by 3 bytes (button, col, row)
      if (str.length >= i + 6 && str[i + 1] === '[' && str[i + 2] === 'M') {
        const btn = str.charCodeAt(i + 3);
        const col = str.charCodeAt(i + 4) - 32;
        const row = str.charCodeAt(i + 5) - 32;
        const raw = str.slice(i, i + 6);
        const buttonType = (btn & 3) === 0 ? 'left' : (btn & 3) === 1 ? 'middle' : (btn & 3) === 2 ? 'right' : 'release';
        const motion = (btn & 32) ? 'mouse-move' : (btn & 3) === 3 ? 'mouse-release' : 'mouse-click';
        results.push({ raw, key: `${motion}(${buttonType},${col},${row})` });
        i += 6;
        continue;
      }

      // SGR mouse: \x1b[<btn;col;rowM or \x1b[<btn;col;rowm
      const sgrMatch = remaining.match(/^\x1b\[<(\d+);(\d+);(\d+)([Mm])/);
      if (sgrMatch) {
        const btn = parseInt(sgrMatch[1], 10);
        const col = parseInt(sgrMatch[2], 10);
        const row = parseInt(sgrMatch[3], 10);
        const press = sgrMatch[4] === 'M';
        const motion = (btn & 32) ? 'mouse-move' : press ? 'mouse-click' : 'mouse-release';
        const buttonType = (btn & 3) === 0 ? 'left' : (btn & 3) === 1 ? 'middle' : (btn & 3) === 2 ? 'right' : 'none';
        results.push({ raw: sgrMatch[0], key: `${motion}(${buttonType},${col},${row})` });
        i += sgrMatch[0].length;
        continue;
      }

      // Unknown CSI sequence
      const csiMatch = remaining.match(/^\x1b\[([0-9;]*)([A-Za-z~])/);
      if (csiMatch) {
        results.push({ raw: csiMatch[0], key: `esc-[${csiMatch[1]}${csiMatch[2]}]` });
        i += csiMatch[0].length;
        continue;
      }

      // Unknown SS3 sequence
      const ss3Match = remaining.match(/^\x1bO([A-Za-z])/);
      if (ss3Match) {
        results.push({ raw: ss3Match[0], key: `esc-O${ss3Match[1]}` });
        i += ss3Match[0].length;
        continue;
      }

      // Bare escape
      results.push({ raw: '\x1b', key: 'escape' });
      i++;
      continue;
    }

    // Single-byte control characters / known keys
    const char = str[i];
    if (inverseKeyMap.has(char)) {
      results.push({ raw: char, key: inverseKeyMap.get(char)! });
      i++;
      continue;
    }

    // Printable characters — batch consecutive
    if (char >= ' ' && char <= '~') {
      let text = '';
      while (i < str.length && str[i] >= ' ' && str[i] <= '~') {
        text += str[i];
        i++;
      }
      if (text.length === 1) {
        results.push({ raw: text, key: text });
      } else {
        results.push({ raw: text, key: `"${text}"` });
      }
      continue;
    }

    // Other byte
    const code = char.charCodeAt(0);
    results.push({ raw: char, key: `0x${code.toString(16).padStart(2, '0')}` });
    i++;
  }

  return results;
}

/**
 * InputBuffer coalesces stdin chunks that may split escape sequences.
 * Buffers data and flushes after a short timeout or when a complete
 * non-escape sequence is detected.
 */
export class InputBuffer {
  private buffer = '';
  private timer: NodeJS.Timeout | null = null;
  private callback: (decoded: DecodedKey[], raw: Buffer) => void;
  private rawChunks: Buffer[] = [];
  private readonly TIMEOUT_MS = 10; // 10ms — fast enough to not add perceptible latency

  constructor(callback: (decoded: DecodedKey[], raw: Buffer) => void) {
    this.callback = callback;
  }

  push(data: Buffer): void {
    this.buffer += data.toString('utf-8');
    this.rawChunks.push(data);

    if (this.timer) {
      clearTimeout(this.timer);
    }

    // If the buffer doesn't end mid-escape-sequence, flush immediately
    if (!this.mightBeIncomplete()) {
      this.flush();
      return;
    }

    // Otherwise wait briefly for more bytes
    this.timer = setTimeout(() => this.flush(), this.TIMEOUT_MS);
  }

  private mightBeIncomplete(): boolean {
    const buf = this.buffer;
    if (buf.length === 0) return false;

    // Check if the buffer ends with an incomplete escape sequence
    // Bare \x1b at end — could be start of \x1b[ or \x1bO sequence
    if (buf[buf.length - 1] === '\x1b') return true;

    // \x1b[ without terminator — CSI sequence in progress
    const lastEsc = buf.lastIndexOf('\x1b');
    if (lastEsc >= 0) {
      const after = buf.slice(lastEsc);
      // \x1b alone
      if (after.length === 1) return true;
      // \x1b[ with no terminating letter
      if (after[1] === '[') {
        // CSI: need a letter terminator
        if (!/[A-Za-z~]/.test(after[after.length - 1]) || after.length <= 2) return true;
        // Mouse \x1b[M needs 3 more bytes
        if (after.length >= 3 && after[2] === 'M' && after.length < 6) return true;
      }
      // \x1bO with no letter yet
      if (after[1] === 'O' && after.length < 3) return true;
    }

    return false;
  }

  flush(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (this.buffer.length === 0) return;

    const decoded = decodeComplete(this.buffer);
    const raw = Buffer.concat(this.rawChunks);
    this.buffer = '';
    this.rawChunks = [];
    this.callback(decoded, raw);
  }
}

// Legacy single-shot API (for testing or when buffering isn't needed)
export function decodeInput(buffer: Buffer): DecodedKey[] {
  return decodeComplete(buffer.toString('utf-8'));
}
