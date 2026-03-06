# Tuivio CLI Tools

Command-line tools for launching, recording, and interacting with TUI applications. Used by the Tuivio Claude Code plugin.

## Installation

```bash
npm install
npm run build

# Install CLI tools globally
npm link
```

## CLI Tools

| Tool | Description |
|------|-------------|
| `tuivio-start <command>` | Launch a TUI inside tmux with recording support |
| `tuivio-record <command>` | Record a TUI session as JSONL for later analysis |
| `tuivio-attach` | Attach to a live `tuivio-record` session (watch or interact) |
| `tuivio-discover` | Find active `tuivio-record` sessions |
| `tuivio-mark <label>` | Add a marker to an active recording |
| `tuivio-summarize <file>` | Summarize a recording file for AI context |

### tuivio-start

Launch a TUI app inside a tmux session with `tuivio-record` wrapping it for live-attach and recording support.

```bash
tuivio-start [options] <command> [args...]

Options:
  --cols <n>     Terminal width (default: 80)
  --rows <n>     Terminal height (default: 24)
  --name <name>  tmux session name (default: tuivio)
```

### tuivio-record

Transparent PTY proxy that captures keystrokes and screen states to a JSONL file while the user interacts with the TUI normally.

```bash
tuivio-record [options] <command> [args...]

Options:
  --output <path>   Output recording file (default: auto-generated)
  --cols <n>        Terminal width (default: current terminal)
  --rows <n>        Terminal height (default: current terminal)
```

Also exposes a Unix socket for live session access (used by `tuivio-attach`, `tuivio-discover`, and the `/tui-attach` skill).

### tuivio-attach

Attach to a running `tuivio-record` session to watch the TUI output in real-time and optionally forward keystrokes.

```bash
tuivio-attach [options]

Options:
  --read-only, -r   Watch only, don't forward input
  --pid <pid>, -p   Connect to a specific session by PID
```

### tuivio-discover

Find active `tuivio-record` sessions and their socket paths.

```bash
tuivio-discover [--json] [--clean]
```

### tuivio-mark

Add a labeled marker to an active recording session. Useful for flagging moments of interest (e.g., when a bug occurs).

```bash
tuivio-mark <label>
```

### tuivio-summarize

Summarize a JSONL recording file into a compact format suitable for AI analysis.

```bash
tuivio-summarize <recording.jsonl> [--full]
```

## Development

```bash
npm run dev  # Watch + auto-restart
```

## Source Structure

```
src/
├── start.ts               # tuivio-start CLI
├── record.ts              # tuivio-record CLI (PTY proxy + recording)
├── attach.ts              # tuivio-attach CLI
├── discover.ts            # tuivio-discover CLI
├── mark.ts                # tuivio-mark CLI
├── recording-summarizer.ts # tuivio-summarize CLI
├── recording-writer.ts    # JSONL recording file writer
├── live-client.ts         # Unix socket client for session discovery
├── ansi-parser.ts         # ANSI escape sequence parser
├── key-decoder.ts         # Input keystroke decoder
├── pty-manager.ts         # PTY abstraction & screen buffer
├── terminal-registry.ts   # Multi-terminal management
└── index.ts               # Legacy MCP server entry point
```

## License

MIT
