---
name: tui-attach
description: Connect to an externally-running TUI session. Use when a TUI is already running outside Claude Code (via tuivio-record) and you want to view and interact with it.
---

# TUI Attach Skill

Connect to a TUI application that was started externally (e.g. by the user running `tuivio-record` in their terminal).

## Usage

```
/tui-attach
```

## Instructions

When the user invokes this skill:

1. Discover running tuivio-record sessions:

```bash
tuivio-discover --json
```

2. If no sessions are found, tell the user to start one:
   - `tuivio-record <command>` in their terminal

3. If a session is found, read the screen via the live socket:

```bash
printf '{"type":"screen"}\n' | nc -U <socketPath from discover output>
```

4. Report what you see:
   - What's displayed on screen
   - UI elements visible
   - **Check the `highlights` array** — it shows lines with non-default styling (reverse video, background colors). This reveals which menu item is selected, focused elements, etc.
   - Any errors or issues

5. Ask the user what they'd like to do next.

## Sending keys

IMPORTANT: Use `printf` (not `echo`) to send keys — escape sequences must be passed correctly.

```bash
# Send Up arrow
printf '{"type":"keys","input":"\\u001b[A"}\n' | nc -U <socketPath>

# Send Down arrow
printf '{"type":"keys","input":"\\u001b[B"}\n' | nc -U <socketPath>

# Send Enter
printf '{"type":"keys","input":"\\r"}\n' | nc -U <socketPath>

# Send Escape
printf '{"type":"keys","input":"\\u001b"}\n' | nc -U <socketPath>

# Send Tab
printf '{"type":"keys","input":"\\t"}\n' | nc -U <socketPath>

# Send a text string
printf '{"type":"keys","input":"hello"}\n' | nc -U <socketPath>
```

After sending keys, always read the screen again to see the result. Pay attention to `highlights` to detect selection changes.

## Other socket commands

```bash
# Add a marker to the recording
printf '{"type":"marker","label":"description"}\n' | nc -U <socketPath>

# Get session status
printf '{"type":"status"}\n' | nc -U <socketPath>
```
