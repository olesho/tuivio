/**
 * Terminal Registry - Manages multiple TUI applications simultaneously
 */

import { EventEmitter } from 'events';
import { PtyManager, PtyOptions, ScreenBuffer } from './pty-manager.js';

export interface TerminalInfo {
  id: string;
  manager: PtyManager;
  command: string;
  args: string[];
  running: boolean;
  createdAt: Date;
}

export interface TerminalSummary {
  id: string;
  command: string;
  running: boolean;
  cols: number;
  rows: number;
}

export interface RegistryOptions {
  defaultCols?: number;
  defaultRows?: number;
}

export class TerminalRegistry extends EventEmitter {
  private terminals: Map<string, TerminalInfo> = new Map();
  private nextId: number = 1;
  private defaultCols: number;
  private defaultRows: number;

  constructor(options: RegistryOptions = {}) {
    super();
    this.defaultCols = options.defaultCols ?? 80;
    this.defaultRows = options.defaultRows ?? 24;
  }

  /**
   * Create a new terminal with a TUI application
   */
  create(options: {
    command: string;
    args?: string[];
    cwd?: string;
    cols?: number;
    rows?: number;
  }): TerminalInfo {
    const id = String(this.nextId++);
    const cols = options.cols ?? this.defaultCols;
    const rows = options.rows ?? this.defaultRows;

    const manager = new PtyManager({
      command: options.command,
      args: options.args ?? [],
      cwd: options.cwd,
      cols,
      rows,
    });

    const info: TerminalInfo = {
      id,
      manager,
      command: options.command,
      args: options.args ?? [],
      running: false,
      createdAt: new Date(),
    };

    this.terminals.set(id, info);

    // Forward events with terminal ID context
    manager.on('data', (data: string) => {
      this.emit('data', { terminalId: id, data });
    });

    manager.on('exit', (exitInfo: { exitCode: number; signal?: number }) => {
      info.running = false;
      this.emit('exit', { terminalId: id, ...exitInfo });
    });

    manager.on('start', () => {
      info.running = true;
      this.emit('start', { terminalId: id });
    });

    // Start the terminal
    manager.start();
    info.running = true;

    this.emit('created', { terminalId: id, command: options.command });

    return info;
  }

  /**
   * Get terminal info by ID
   */
  get(id: string): TerminalInfo | undefined {
    return this.terminals.get(id);
  }

  /**
   * Get the PtyManager for a terminal by ID
   */
  getManager(id: string): PtyManager | undefined {
    return this.terminals.get(id)?.manager;
  }

  /**
   * Kill a terminal by ID
   */
  kill(id: string): boolean {
    const info = this.terminals.get(id);
    if (!info) {
      return false;
    }

    info.manager.stop();
    info.running = false;
    this.terminals.delete(id);
    this.emit('killed', { terminalId: id });

    return true;
  }

  /**
   * List all terminals
   */
  list(): TerminalSummary[] {
    const summaries: TerminalSummary[] = [];
    for (const [id, info] of this.terminals) {
      const size = info.manager.getSize();
      summaries.push({
        id,
        command: info.command + (info.args.length > 0 ? ' ' + info.args.join(' ') : ''),
        running: info.running,
        cols: size.cols,
        rows: size.rows,
      });
    }
    return summaries;
  }

  /**
   * Kill all terminals
   */
  killAll(): void {
    for (const [id, info] of this.terminals) {
      info.manager.stop();
      info.running = false;
      this.emit('killed', { terminalId: id });
    }
    this.terminals.clear();
  }

  /**
   * Check if any terminals exist
   */
  hasTerminals(): boolean {
    return this.terminals.size > 0;
  }

  /**
   * Get the number of terminals
   */
  get count(): number {
    return this.terminals.size;
  }

  /**
   * Get the ID of the most recently created terminal
   */
  getLastTerminalId(): string | undefined {
    if (this.terminals.size === 0) {
      return undefined;
    }
    // Get the highest ID (most recently created)
    let lastId: string | undefined;
    for (const id of this.terminals.keys()) {
      if (!lastId || parseInt(id, 10) > parseInt(lastId, 10)) {
        lastId = id;
      }
    }
    return lastId;
  }

  /**
   * Get all terminal IDs
   */
  getTerminalIds(): string[] {
    return Array.from(this.terminals.keys());
  }
}
