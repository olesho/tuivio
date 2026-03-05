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

1. Parse the command from the arguments (first word is command, rest are args)
2. Kill any existing tuivio session, then launch the app, wait, and capture:

```bash
tmux kill-session -t tuivio 2>/dev/null
tmux new-session -d -s tuivio -x 80 -y 24 '<command> <args>'
sleep 1
tmux capture-pane -t tuivio -p
```

3. Report what you see:
   - Is the app running correctly?
   - What's displayed on screen?
   - Are there any errors or crashes?

If no command is provided, ask the user what TUI application they want to run.
