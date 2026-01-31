# Tuivio

MCP server and Claude Code plugin for TUI (Terminal User Interface) application development with visual feedback.

## Overview

Tuivio provides two components:

1. **MCP Server** (`server/`) - A generic Model Context Protocol server for controlling TUI applications. Can be used by any MCP-compatible client.

2. **Claude Code Plugin** (`plugin/`) - A plugin for Claude Code that provides agents and skills for TUI development workflows.

## Development Lifecycle

```
════════════════════════════════════════════════════════════════════════
              TUIVIO SERVER is started by Coding Agent
════════════════════════════════════════════════════════════════════════

┌────────────────┐
│  WRITE/BUILD   │◄─────────────────────────────────────┐
│     Code       │                                      │
└───────┬────────┘                                      │
        │                                               │
        ▼                                               │
 ╔═════════════════════════════════════════════╗        │
 ║         INTERACTION (TUI running)           ║        │
 ║                                             ║        │
 ║    ┌──────────────┐      ┌───────────┐      ║        │
 ║    │ VIEW SCREEN  │◄────►│ INTERACT  │      ║        │
 ║    │              │      │ (keys/txt)│      ║        │
 ║    └──────────────┘      └───────────┘      ║        │
 ║                                             ║        │
 ╚══════════════════════╤══════════════════════╝        │
                        │                               │
                        ▼                               │
                 ┌─────────────┐                        │
                 │   ANALYZE   │────────────────────────┘
                 └─────────────┘
```

The coding agent (Claude Code) runs the TUI application via Tuivio's MCP server, then repeatedly views the screen and interacts with it. After interaction, the agent analyzes the results and loops back to write/build code as needed.

## Quick Start (Claude Code)

**Add the Tuivio marketplace source:**

```bash
/plugin marketplace add olesho/tuivio
```

This adds the marketplace configuration from https://github.com/olesho/tuivio.

**Install the plugin:**

```bash
/plugin install tuivio-tui-dev@tuivio-marketplace --scope user
```

For manual installation or standalone server usage, see [Installation Guide](docs/installation.md).

## Project Structure

```
tuivio/
├── server/           # MCP Server (generic, reusable)
│   ├── src/          # TypeScript source
│   ├── dist/         # Compiled JavaScript
│   └── package.json  # Server dependencies
├── plugin/           # Claude Code Plugin
│   ├── .mcp.json     # MCP server configuration
│   ├── agents/       # Agent definitions
│   └── skills/       # Skill definitions
├── examples/         # Sample TUI applications
│   └── sample-tui/   # Test app using blessed
└── install-plugin.sh # Installation script
```

## MCP Server

The MCP server provides 10 tools for TUI interaction:

| Tool | Description |
|------|-------------|
| `run_tui` | Launch a TUI application |
| `stop_tui` | Stop the current TUI |
| `view_screen` | Capture terminal screen as text |
| `type_text` | Send text input |
| `press_key` | Send key presses (arrows, enter, ctrl+c, etc.) |
| `wait` | Wait for rendering |
| `get_screen_size` | Get terminal dimensions |
| `create_process` | Launch TUI in a new terminal tab |
| `kill_process` | Terminate a terminal |
| `list_tabs` | List all active terminals |

### Using the Server Standalone

The MCP server can be used independently of the Claude Code plugin:

```bash
cd server
npm install
npm run build

# Run directly
node dist/index.js

# Or install globally
npm link
tuivio-server
```

### Server Options

```
tuivio-server [options] [command] [args...]

Options:
  --cols <n>           Terminal width (default: 80)
  --rows <n>           Terminal height (default: 24)
  --cwd <path>         Working directory
  --live               Live display to stderr (TTY only)
  --live-file <path>   Write live display to file
  --log-file <path>    Log tool calls to file
```

## Claude Code Plugin

The plugin provides:

- **tuivio-dev Agent** - Specialized agent for TUI development
- **Skills**:
  - `/tui-run` - Launch a TUI and view its screen
  - `/tui-inspect` - View current screen state
  - `/tui-iterate` - Fix issues with visual verification

See [plugin/README.md](plugin/README.md) for detailed plugin documentation.

## Installation Options

### Global Installation (Recommended)

```bash
./install-plugin.sh --global
```

This installs `tuivio-server` as a global command and configures the plugin to use it.

### Local Development

```bash
./install-plugin.sh --local
```

This configures the plugin with absolute paths to the local build.

## Development

### Building the Server

```bash
cd server
npm install
npm run build
```

### Running the Sample TUI

```bash
cd examples/sample-tui
npm install
npm start
```

### Development Mode

```bash
cd server
npm run dev  # Watches for changes and restarts
```

## Requirements

- Node.js v18+
- Claude Code CLI (for the plugin)

## Supported TUI Frameworks

The server works with any terminal application:

- **Python**: curses, textual, rich, prompt_toolkit
- **Node.js**: blessed, ink, terminal-kit
- **Go**: bubbletea, tview, termui
- **Rust**: ratatui, crossterm, cursive
- Any other terminal-based application

## License

MIT
