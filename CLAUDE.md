# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Tuivio is a TUI (Terminal User Interface) development plugin for Claude Code. It provides agents and skills for developing, testing, and debugging TUI applications using tmux for terminal control.

- **Plugin** (`plugin/`) - Agent, skills, and hooks for TUI development workflows
- **Server** (`server/`) - Optional MCP server (legacy mode) for controlling TUI applications via node-pty

## Architecture

### Data Flow
```
Claude Code → Plugin → Agent/Skills → Bash tool → tmux commands → TUI App
                                                       ↓
                                                 capture-pane → Screen text → Agent
```

### Plugin Components (`plugin/`)
- **agents/tuivio-dev.md** - Agent with tmux command reference and TUI development patterns
- **skills/** - `/tui-run`, `/tui-inspect`, `/tui-iterate` workflows
- **hooks/** - SessionStart hook to verify tmux is installed

### tmux Commands Used
| Action | Command |
|--------|---------|
| Launch TUI | `tmux new-session -d -s tuivio -x 80 -y 24 'cmd'` |
| View screen | `tmux capture-pane -t tuivio -p` |
| Type text | `tmux send-keys -t tuivio -l 'text'` |
| Press key | `tmux send-keys -t tuivio KeyName` |
| Stop TUI | `tmux kill-session -t tuivio` |
| Screen size | `tmux display-message -t tuivio -p '#{pane_width}x#{pane_height}'` |

## Build Commands

```bash
# Run sample TUI for testing
cd examples/sample-tui && npm install && npm start

# Build MCP server (optional legacy mode)
cd server && npm install && npm run build
```

## Key Implementation Details

- **tmux-based**: All TUI control uses tmux via the Bash tool — no MCP server required
- **Session naming**: Primary session is `tuivio`, additional sessions use `tuivio-2`, `tuivio-3`, etc.
- **Plugin changes**: Agent and skill changes in `plugin/` take effect immediately on plugin reload

## Server (Optional Legacy Mode)

The `server/` directory contains an MCP server that can be used as an alternative to tmux. See `server/README.md` for details.

```bash
cd server && npm install && npm run build && npm link
```

## Plugin Development

```bash
# Install plugin
./install-plugin.sh

# Use with Claude Code
claude --plugin-dir plugin/
```
