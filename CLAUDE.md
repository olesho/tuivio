# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Tuivio is a TUI (Terminal User Interface) development plugin for Claude Code. It provides agents and skills for developing, testing, and debugging TUI applications using tmux for terminal control.

- **Plugin** (`plugin/`) - Agent, skills, and hooks for TUI development workflows
- **Server** (`server/`) - CLI tools package (`tuivio-start`, `tuivio-record`, `tuivio-attach`, etc.)

## Architecture

### Data Flow
```
Claude Code → Plugin → Agent/Skills → Bash tool → tuivio-start → tmux + tuivio-record → TUI App
                                                                          ↓
                                                                    capture-pane → Screen text → Agent
```

### Plugin Components (`plugin/`)
- **agents/tuivio-dev.md** - Agent with tmux command reference and TUI development patterns
- **skills/** - `/tui-run`, `/tui-inspect`, `/tui-iterate`, `/tui-attach`, `/tui-replay` workflows
- **hooks/** - SessionStart hook to verify tmux is installed

### Key Commands
| Action | Command |
|--------|---------|
| Launch TUI | `tuivio-start <command> [args...]` |
| View screen | `tmux capture-pane -t tuivio -p` |
| Type text | `tmux send-keys -t tuivio -l 'text'` |
| Press key | `tmux send-keys -t tuivio KeyName` |
| Stop TUI | `tmux kill-session -t tuivio` |
| Screen size | `tmux display-message -t tuivio -p '#{pane_width}x#{pane_height}'` |

**Important**: Always use `tuivio-start` to launch TUIs — do NOT use `tmux new-session` directly. `tuivio-start` handles tmux session creation and enables recording/live-attach support.

## Build Commands

```bash
# Run sample TUI for testing
cd examples/sample-tui && npm install && npm start

# Build CLI tools
cd server && npm install && npm run build && npm link
```

## Key Implementation Details

- **tmux-based**: All TUI control uses tmux via the Bash tool
- **Session naming**: Primary session is `tuivio`, additional sessions use `tuivio-2`, `tuivio-3`, etc.
- **Plugin changes**: Agent and skill changes in `plugin/` take effect immediately on plugin reload

## CLI Tools (`server/`)

The `server/` directory contains the CLI tools package. Build and install with:

```bash
cd server && npm install && npm run build && npm link
```

Available tools: `tuivio-start`, `tuivio-record`, `tuivio-attach`, `tuivio-discover`, `tuivio-mark`, `tuivio-summarize`.

## Recording & Debugging

The recording system captures TUI sessions for AI-assisted debugging:

```bash
# Record a TUI session (transparent PTY proxy)
tuivio-record python3 app.py

# Add markers from another terminal
tuivio-mark "Bug happens here"

# Summarize a recording for AI context
tuivio-summarize recording.jsonl
tuivio-summarize recording.jsonl --full
```

Use the `/tui-replay` skill in Claude Code to analyze recordings.

## Plugin Development

```bash
# Install plugin
./install-plugin.sh

# Use with Claude Code
claude --plugin-dir plugin/
```
