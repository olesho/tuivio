# Tuivio TUI Development Plugin

A Claude Code plugin that provides a visual feedback loop for TUI (Terminal User Interface) development.

## Features

- **Visual Feedback Loop**: Write code → Launch TUI → View screen → Analyze → Iterate
- **Tuivio Agent**: Specialized agent for TUI development tasks
- **Skills**: Quick commands for common TUI workflows
- **tmux-based**: Uses tmux via Bash tool for terminal control — no server required

## Installation

### Method 1: Clone and Install (Recommended)

```bash
# Clone the repository
git clone git@github.com:olesho/tuivio.git
cd tuivio

# Run the installation script (installs globally)
./install-plugin.sh

# Start Claude Code with the plugin
claude --plugin-dir ./plugin
```

### Method 2: Direct npm Install

```bash
# Install globally from git
npm install -g git+ssh://git@github.com:olesho/tuivio.git

# Clone just to get the plugin directory
git clone git@github.com:olesho/tuivio.git
claude --plugin-dir ./tuivio/plugin
```

### Development Mode

For local development with absolute paths:

```bash
./install-plugin.sh --local
```

## Skills

### `/tui-run`

Launch a TUI application and view its initial screen.

```
/tui-run python3 todo.py
/tui-run node app.js
```

### `/tui-inspect`

View and analyze the current TUI screen state.

```
/tui-inspect
/tui-inspect terminal_abc123
```

### `/tui-iterate`

Fix an issue and restart to verify the fix.

```
/tui-iterate menu items are not aligned
/tui-iterate crash when pressing enter
```

### `/tui-attach`

Connect to an externally-running TUI session (started via `tuivio-record`).

```
/tui-attach
```

### `/tui-replay`

Analyze a `.jsonl` recording file to diagnose bugs.

```
/tui-replay recording.jsonl
```

## Agent

The `tuivio-dev` agent is specialized for TUI development. It uses tmux commands via the Bash tool for all terminal control.

## Workflow Example

1. **Create a TUI app**:
   ```
   Create a TODO list TUI in Python using curses
   ```

2. **Launch and view**:
   ```
   /tui-run python3 todo.py
   ```

3. **Test interaction**:
   - The agent uses tmux `send-keys` to test the UI
   - Captures the screen after each action

4. **Fix issues**:
   ```
   /tui-iterate the menu is not centered
   ```

## Supported TUI Frameworks

- **Python**: curses, textual, rich, prompt_toolkit
- **Node.js**: blessed, ink, terminal-kit
- **Go**: bubbletea, tview, termui
- **Rust**: ratatui, crossterm, cursive

## Directory Structure

```
plugin/
├── .claude-plugin/
│   └── plugin.json           # Plugin manifest
├── agents/
│   └── tuivio-dev.md         # Tuivio Development Agent
├── skills/
│   ├── tui-run/SKILL.md      # Launch TUI
│   ├── tui-inspect/SKILL.md  # View screen
│   ├── tui-iterate/SKILL.md  # Fix and verify
│   ├── tui-attach/SKILL.md   # Connect to external session
│   └── tui-replay/SKILL.md   # Analyze recordings
├── .mcp.json                 # Plugin config
└── README.md                 # This file
```

## Requirements

- Claude Code CLI
- tmux
- Node.js v18+ (for CLI tools)
