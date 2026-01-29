---
name: tui-iterate
description: Fix TUI issues and restart to verify. Use when you've identified a problem and want to fix it with immediate visual feedback.
---

# TUI Iterate Skill

Fix an identified issue, restart the TUI, and verify the fix worked.

## Usage

```
/tui-iterate <description of issue to fix>
```

## Examples

```
/tui-iterate menu items are not aligned
/tui-iterate crash when pressing enter on empty list
/tui-iterate colors not showing correctly
```

## Workflow

1. **Understand the issue** - What needs to be fixed
2. **Make the fix** - Edit the relevant code
3. **Stop current TUI** - Clean slate
4. **Restart TUI** - Launch fresh instance
5. **Verify fix** - View screen and confirm

## Instructions

When the user invokes this skill:

1. **Analyze the issue** - Understand what's broken based on the description and previous screen views
2. **Locate the code** - Find the relevant file(s) to fix
3. **Make the fix** - Use Edit tool to modify the code
4. **Stop the TUI** - Use `mcp__tui__stop_tui` to stop the current instance
5. **Restart** - Use `mcp__tui__run_tui` with the same command as before
6. **Wait** - Use `mcp__tui__wait(ms: 1000)` for initialization
7. **View and verify** - Use `mcp__tui__view_screen` to check the fix
8. **Report results**:
   - Did the fix work?
   - Is the issue resolved?
   - Are there any new issues?

If the fix didn't work, analyze what went wrong and iterate again.

## Common Fix Patterns

### Layout Issues
- Check spacing, padding, margins
- Verify terminal size assumptions
- Check for hardcoded positions

### Crash Fixes
- Add error handling
- Check for null/undefined values
- Validate user input

### Rendering Issues
- Check refresh/redraw calls
- Verify color codes
- Check for terminal compatibility
