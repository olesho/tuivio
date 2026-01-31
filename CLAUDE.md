# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Tuivio is a TUI (Terminal User Interface) development system with two components:
- **MCP Server** (`server/`) - Model Context Protocol server for controlling TUI applications via node-pty
- **Claude Code Plugin** (`plugin/`) - Agent and skills for TUI development workflows

## Build Commands

```bash
# Build server
cd server && npm install && npm run build

# Development mode (auto-rebuild + restart)
npm run dev                    # from root, or
cd server && npm run dev

# Install globally after building
cd server && npm link          # creates global 'tuivio' and 'tuivio-server' commands

# Run sample TUI for testing
cd examples/sample-tui && npm install && npm start
```

## Architecture

### Data Flow
```
Claude Code → Plugin (.mcp.json) → MCP Client → tuivio-server → PTY Manager → TUI App
                                                     ↓
                                              Screen Buffer → view_screen tool → Agent
```

### Server Components (`server/src/`)
- **index.ts** - MCP server setup, 10 tool definitions and handlers, CLI argument parsing
- **pty-manager.ts** - node-pty wrapper, screen buffer capture, key sequence handling
- **terminal-registry.ts** - Multi-terminal management with auto-generated IDs

### Plugin Components (`plugin/`)
- **.mcp.json** - MCP server connection config (uses `npx -y tuivio`)
- **agents/tuivio-dev.md** - Agent with `mcp__tui__*` tools and TUI development patterns
- **skills/** - `/tui-run`, `/tui-inspect`, `/tui-iterate` workflows

### MCP Tools
| Tool | Purpose |
|------|---------|
| `run_tui` / `stop_tui` | Launch/stop TUI in focused terminal |
| `create_process` / `kill_process` | Manage additional terminals |
| `view_screen` | Capture terminal as text |
| `type_text` / `press_key` | Send input (keys: enter, arrows, ctrl+x, f1-f12) |
| `wait` | Pause for rendering (ms) |
| `get_screen_size` / `list_tabs` | Query terminal state |

## Key Implementation Details

- **ES Modules**: Project uses `"type": "module"` - import/export syntax throughout
- **Strict TypeScript**: `strict: true` in tsconfig - no implicit any
- **PID Isolation**: Log files and live-file paths auto-inject PID to avoid conflicts between instances
- **stdio Protocol**: MCP uses stdin/stdout for protocol; logs go to file or stderr
- **Screen Capture**: Raw terminal output as text lines; some escape sequences may appear in output

## Server Options

```bash
tuivio-server [options] [command] [args...]
  --cols <n>           # Terminal width (default: 80)
  --rows <n>           # Terminal height (default: 24)
  --cwd <path>         # Working directory for launched apps
  --live               # Live display to stderr (TTY only)
  --live-file <path>   # Write live display to file
  --log-file <path>    # Log tool calls (default: /tmp/tuivio-${pid}.log)
```

## Plugin Development

Agent and skill changes in `plugin/` take effect immediately on plugin reload. The plugin uses `npx -y tuivio` which auto-installs the published npm package.

For local development with unpublished changes:
```bash
./install-plugin.sh --local   # Updates .mcp.json with absolute paths to local build
```
