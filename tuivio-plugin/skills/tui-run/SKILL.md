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

## Workflow

1. **Stop any existing TUI** - Clean up previous session
2. **Launch the application** - Using `mcp__tui__run_tui`
3. **Wait for initialization** - 1000ms default
4. **Capture and return screen** - Using `mcp__tui__view_screen`

## Instructions

When the user invokes this skill:

1. Parse the command from the arguments (first word is command, rest are args)
2. If a TUI is already running, stop it first with `mcp__tui__stop_tui`
3. Launch the new TUI with `mcp__tui__run_tui`
4. Wait 1000ms with `mcp__tui__wait` for the app to initialize
5. View the screen with `mcp__tui__view_screen`
6. Report what you see:
   - Is the app running correctly?
   - What's displayed on screen?
   - Are there any errors or crashes?

If no command is provided, ask the user what TUI application they want to run.
