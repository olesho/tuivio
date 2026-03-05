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
4. **Restart the TUI** - Check for a live session first, otherwise use tmux:

```bash
# Check for live tuivio-record session
tuivio-discover --json 2>/dev/null
```

If a live session exists, use socket commands to interact and verify:
```bash
echo '{"type":"screen"}' | nc -U <socketPath>
echo '{"type":"keys","input":"..."}' | nc -U <socketPath>
```

Otherwise, restart using `tuivio-start` (do NOT use `tmux new-session` directly):
```bash
tuivio-start <same command as before>
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
