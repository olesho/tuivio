---
name: tui-inspect
description: View and analyze the current TUI screen state. Use when you want to see what's currently displayed in the terminal UI.
---

# TUI Inspect Skill

Capture and analyze the current state of the running TUI application.

## Usage

```
/tui-inspect [session-name]
```

## Examples

```
/tui-inspect
/tui-inspect tuivio-2
```

## Instructions

When the user invokes this skill:

1. Check for running tuivio sessions:

```bash
tmux list-sessions 2>/dev/null | grep tuivio
```

2. Capture the screen (use provided session name, or default `tuivio`):

```bash
tmux capture-pane -t tuivio -p
```

3. Analyze and report:
   - Current screen contents
   - UI elements visible (menus, inputs, lists, etc.)
   - Any error messages or warnings
   - Overall application state

If no TUI is running, inform the user and suggest using `/tui-run` to launch one.

## Analysis Checklist

- Is the UI rendering correctly?
- Are all expected elements visible?
- Is there proper alignment and formatting?
- Are there any error messages?
- Is the application responsive (not frozen)?
