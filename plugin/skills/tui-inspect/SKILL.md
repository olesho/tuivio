---
name: tui-inspect
description: View and analyze the current TUI screen state. Use when you want to see what's currently displayed in the terminal UI.
---

# TUI Inspect Skill

Capture and analyze the current state of the running TUI application.

## Usage

```
/tui-inspect [terminal_id]
```

## Examples

```
/tui-inspect
/tui-inspect terminal_abc123
```

## Workflow

1. **List active terminals** - Check what's running
2. **View the screen** - Capture current state
3. **Analyze and report** - Describe what's visible

## Instructions

When the user invokes this skill:

1. First, use `mcp__tui__list_tabs` to see all active terminals
2. If a terminal_id is provided, view that specific terminal
3. If no terminal_id is provided, view the focused/most-recent terminal
4. Use `mcp__tui__view_screen` to capture the screen
5. Analyze and report:
   - Current screen contents
   - UI elements visible (menus, inputs, lists, etc.)
   - Any error messages or warnings
   - Cursor position (if metadata requested)
   - Overall application state

If no TUI is running, inform the user and suggest using `/tui-run` to launch one.

## Analysis Checklist

- [ ] Is the UI rendering correctly?
- [ ] Are all expected elements visible?
- [ ] Is there proper alignment and formatting?
- [ ] Are there any error messages?
- [ ] Is the application responsive (not frozen)?
