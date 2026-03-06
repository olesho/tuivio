# Tuivio

A Claude Code plugin for TUI (Terminal User Interface) development with visual feedback. Write code, launch your TUI, see the screen, and iterate — all within Claude Code.

## How It Works

Tuivio gives Claude Code the ability to see and interact with terminal UIs. Two workflows are supported:

### Claude-launched (recommended for development)

Claude starts the TUI, views the screen, and iterates on the code:

```
/tui-run python3 todo.py
```

Claude launches the app in tmux, captures the screen, and reports what it sees. Use `/tui-iterate` to fix issues with immediate visual verification.

### User-launched (for debugging existing apps)

You run the app yourself; Claude connects to observe and help:

```bash
# In your terminal
tuivio-record python3 todo.py
```

```
# In Claude Code
/tui-attach
```

Claude connects to the live session, sees the screen, and can send input. Useful for debugging apps that are already running or need specific environment setup.

## Installation

### Plugin

```bash
claude plugin install tuivio-tui-dev@tuivio-marketplace
```

### CLI Tools

```bash
cd server && npm install && npm run build && npm link
```

This installs `tuivio-start`, `tuivio-record`, `tuivio-attach`, and other CLI tools globally.

### Prerequisites

- **tmux** — install via `brew install tmux` or `apt install tmux`
- **Node.js** v18+ — for CLI tools

## Skills

| Skill | Description |
|-------|-------------|
| `/tui-run <command>` | Launch a TUI app and view its initial screen |
| `/tui-inspect` | View and analyze the current TUI screen state |
| `/tui-iterate <issue>` | Fix a TUI issue and restart to verify the fix |
| `/tui-attach` | Connect to an externally-running TUI session |
| `/tui-replay <file>` | Analyze a `.jsonl` recording to diagnose bugs |

## CLI Tools

Installed from the `server/` package via `npm link`:

| Tool | Description |
|------|-------------|
| `tuivio-start <command>` | Launch a TUI inside tmux with recording support |
| `tuivio-record <command>` | Record a TUI session as JSONL for later analysis |
| `tuivio-attach` | Attach to a live `tuivio-record` session (watch or interact) |
| `tuivio-discover` | Find active `tuivio-record` sessions |
| `tuivio-mark <label>` | Add a marker to an active recording |
| `tuivio-summarize <file>` | Summarize a recording file for AI context |

## Quick Start

1. **Create a TUI app**:
   ```
   Create a TODO list TUI in Python using curses
   ```

2. **Launch and view**:
   ```
   /tui-run python3 todo.py
   ```

3. **Fix issues**:
   ```
   /tui-iterate the menu is not centered
   ```

4. **Inspect anytime**:
   ```
   /tui-inspect
   ```

## Recording & Debugging

Record a TUI session to capture the exact sequence of inputs and screen states:

```bash
# Record a session
tuivio-record python3 app.py

# Mark important moments from another terminal
tuivio-mark "Bug happens here"

# Summarize for AI analysis
tuivio-summarize recording.jsonl
```

Then use `/tui-replay recording.jsonl` in Claude Code to get AI-assisted diagnosis.

## Supported TUI Frameworks

Works with any terminal application:

- **Python**: curses, textual, rich, prompt_toolkit
- **Node.js**: blessed, ink, terminal-kit
- **Go**: bubbletea, tview, termui
- **Rust**: ratatui, crossterm, cursive

## Architecture

Tuivio is a pure plugin — no server required. The plugin provides agent markdown and skill definitions that Claude Code executes using its built-in Bash tool.

```
Claude Code -> Plugin Skills -> Bash tool -> tuivio-start/tmux -> TUI App
                                                    |
                                              capture-pane -> Screen text -> Claude
```

### Project Structure

```
tuivio/
├── plugin/           # Claude Code Plugin
│   ├── agents/       # Agent definitions (tuivio-dev)
│   ├── skills/       # Skill definitions (tui-run, tui-inspect, etc.)
│   └── hooks/        # SessionStart hook (tmux check)
├── server/           # CLI Tools package
│   ├── src/          # TypeScript source
│   ├── dist/         # Compiled JavaScript
│   └── package.json  # Dependencies & bin entries
├── examples/         # Sample TUI applications
│   └── sample-tui/   # Test app using blessed
└── install-plugin.sh # Installation script
```

## License

MIT
