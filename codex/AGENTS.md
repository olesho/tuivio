# Tuivio — TUI Development for Codex

This file teaches Codex how to develop, test, and debug Terminal User Interface (TUI)
applications using a visual feedback loop: write code, launch the TUI in tmux, capture
the screen, analyze it, and iterate.

All TUI interaction happens through shell commands. The engine is `tmux` plus the
`tuivio-*` CLI tools (install with `cd server && npm install && npm run build && npm link`).

## Core Workflow

1. **Write** — create or modify the TUI code.
2. **Launch** — `tuivio-start <command> <args>` (NEVER `tmux new-session` directly —
   `tuivio-start` sets up the session AND enables recording / live-attach).
3. **View** — `tmux capture-pane -t tuivio -p`.
4. **Analyze** — check for correct rendering, errors, or crashes.
5. **Iterate** — fix and repeat. Kill the session before relaunching the same name.

## Command Reference

| Action | Command |
|--------|---------|
| Launch TUI | `tuivio-start <cmd> <args>` |
| View screen | `tmux capture-pane -t tuivio -p` |
| Type text | `tmux send-keys -t tuivio -l 'text'` |
| Press key | `tmux send-keys -t tuivio <KeyName>` |
| Stop TUI | `tmux kill-session -t tuivio` |
| Wait | `sleep 1` (1s after launch, 0.1s after a keypress) |
| Screen size | `tmux display-message -t tuivio -p '#{pane_width}x#{pane_height}'` |
| List sessions | `tmux list-sessions 2>/dev/null \| grep tuivio` |
| Multi-terminal | Use session names: `tuivio-2`, `tuivio-3`, … |

### Key names for `send-keys`

`Enter` `Escape` `Tab` `Space` `BSpace` (backspace) `DC` (delete) `Up` `Down` `Left`
`Right` `Home` `End` `PPage` (page up) `NPage` (page down) `F1`–`F12` `C-c` (Ctrl+C)
`C-d` `C-z` `C-l`.

## Patterns

**Test navigation**
```bash
tmux send-keys -t tuivio Down
sleep 0.1
tmux capture-pane -t tuivio -p
```

**Test text input**
```bash
tmux send-keys -t tuivio -l 'Hello World'
tmux send-keys -t tuivio Enter
sleep 0.1
tmux capture-pane -t tuivio -p
```

**Crash detection** — after capturing the screen, look for: Python tracebacks, error
messages, blank screens, "Segmentation fault", or the shell prompt reappearing (the app
exited).

**Multi-terminal testing**
```bash
tuivio-start python3 server.py
tuivio-start --name tuivio-2 python3 client.py
tmux capture-pane -t tuivio -p
tmux capture-pane -t tuivio-2 -p
```

## Live Sessions (tuivio-record)

When a TUI runs under `tuivio-record` (e.g. the user started it), talk to it over its
Unix socket — no tmux needed. Always check `tuivio-discover --json` first; if a live
session exists, prefer the socket.

```bash
tuivio-discover --json                                                   # find sessions + socketPath
printf '%s\n' '{"type":"screen"}'                | nc -U <socketPath>     # current screen (+ highlights)
printf '%s\n' '{"type":"status"}'                | nc -U <socketPath>     # uptime, event counts
printf '%s\n' '{"type":"keys","input":"\u001b[B"}' | nc -U <socketPath>    # Down arrow
printf '%s\n' '{"type":"keys","input":"\r"}'     | nc -U <socketPath>     # Enter
printf '%s\n' '{"type":"marker","label":"Bug here"}' | nc -U <socketPath> # mark the recording
```

IMPORTANT: use `printf '%s\n' '<json>'`, NOT `printf '<json>\n'`. The socket needs the
JSON to contain the **literal** escape text (`\u001b` for ESC, `\r` for Enter, `\t` for Tab),
which it JSON-parses into the real byte. If the escape goes in printf's format string, printf
expands it to a raw control byte and the socket replies `{"ok":false,"error":"Invalid JSON"}`.
A good send returns `{"ok":true,"bytes":N}` (an arrow is 3 bytes). The `highlights` array in the
screen response shows styled lines (reverse video, background colors), which in many apps reveals
which item is selected or focused. Re-read the screen after every keypress.

## Recording & Replay

```bash
tuivio-record python3 app.py           # transparent proxy; records keystrokes + screens to .jsonl
tuivio-mark "Bug happens here"         # add a marker from another terminal
tuivio-summarize recording.jsonl       # human-readable summary (add --full for every event)
```

To diagnose a recording: read/summarize it, walk events chronologically (`input`,
`screen`, `marker`, `resize`), focus on `marker` events, then read the app source to
correlate the observed behavior with the code and propose a fix.

## Best Practices

- Wait after launch; TUIs need time to render.
- Capture the screen after every significant action.
- Kill sessions when done: `tmux kill-session -t tuivio`.
- Kill before relaunching a session of the same name.
- Test each feature incrementally.

## Supported frameworks

Python (curses, textual, rich, prompt_toolkit) · Node.js (blessed, ink, terminal-kit) ·
Go (bubbletea, tview, termui) · Rust (ratatui, crossterm, cursive).
