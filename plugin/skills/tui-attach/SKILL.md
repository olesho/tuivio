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
echo '{"type":"screen"}' | nc -U <socketPath from discover output>
```

4. Report what you see:
   - What's displayed on screen
   - UI elements visible
   - Any errors or issues
   - The socket path (so you can send keys later)

5. Ask the user what they'd like to do next. You can interact with the session using:

```bash
# Send keystrokes
echo '{"type":"keys","input":"<key>"}' | nc -U <socketPath>

# Read screen again
echo '{"type":"screen"}' | nc -U <socketPath>

# Add a marker to the recording
echo '{"type":"marker","label":"description"}' | nc -U <socketPath>
```

### Common key escape sequences

| Key       | Escape sequence |
|-----------|----------------|
| Enter     | `\r`           |
| Escape    | `\u001b`       |
| Tab       | `\t`           |
| Up        | `\u001b[A`     |
| Down      | `\u001b[B`     |
| Right     | `\u001b[C`     |
| Left      | `\u001b[D`     |
| Backspace | `\u007f`       |
| Ctrl+C    | `\u0003`       |
