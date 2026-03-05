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

## Instructions

When the user invokes this skill:

1. **Analyze the issue** - Understand what's broken based on the description and previous screen views
2. **Locate the code** - Find the relevant file(s) to fix
3. **Make the fix** - Use Edit tool to modify the code
4. **Restart the TUI** - Kill, relaunch, wait, and capture:

```bash
tmux kill-session -t tuivio 2>/dev/null
tmux new-session -d -s tuivio -x 80 -y 24 '<same command as before>'
sleep 1
tmux capture-pane -t tuivio -p
```

5. **Report results**:
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
