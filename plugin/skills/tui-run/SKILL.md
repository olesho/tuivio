---
name: tui-run
description: Launch a TUI application and view its initial screen. Use when you want to start a terminal UI app and see what it looks like.
---

# TUI Run Skill

Launch the specified TUI application and return its initial screen state.

## Usage

```
/tui-run <command> [args...]
```

## Examples

```
/tui-run python3 todo.py
/tui-run node app.js
/tui-run ./my-tui-app
```

## Instructions

When the user invokes this skill:

1. If no command is provided, ask the user what TUI application they want to run.

2. Run EXACTLY these two commands (do NOT use raw tmux — you MUST use tuivio-start):

```bash
tuivio-start <command> <args>
```

```bash
tmux capture-pane -t tuivio -p
```

IMPORTANT: Always use `tuivio-start` to launch. Do NOT run `tmux new-session` directly.
`tuivio-start` handles tmux session creation AND enables recording/live-attach support.

3. Report what you see:
   - Is the app running correctly?
   - What's displayed on screen?
   - Are there any errors or crashes?
