# Tuivio MCP Server

A Model Context Protocol (MCP) server for controlling Terminal User Interface applications.

## Features

- Launch and control TUI applications via MCP tools
- Capture terminal screen content as text
- Send keyboard input (text, special keys, control combinations)
- Manage multiple terminals simultaneously
- Live display for debugging (TTY or file)

## Installation

```bash
npm install
npm run build

# Install globally (optional)
npm link
```

## Usage

### As MCP Server

The server communicates via stdio using the MCP protocol:

```bash
node dist/index.js
```

### Command Line Options

```
tuivio-server [options] [command] [args...]

Options:
  --cols <n>           Terminal width (default: 80)
  --rows <n>           Terminal height (default: 24)
  --cwd <path>         Working directory for launched apps
  --live               Show live display on stderr (TTY only)
  --live-file <path>   Write live display to a file
  --log-file <path>    Log all tool calls (default: ./tuivio.log)
```

### Development Mode

```bash
npm run dev  # Watch + auto-restart
```

## MCP Tools

| Tool | Description |
|------|-------------|
| `run_tui` | Launch a TUI application in the focused terminal |
| `stop_tui` | Stop the TUI in the focused terminal |
| `view_screen` | Get terminal screen content as text |
| `type_text` | Send text input character by character |
| `press_key` | Send a key press (enter, arrows, ctrl+c, etc.) |
| `wait` | Wait for rendering (ms) |
| `get_screen_size` | Get terminal dimensions |
| `create_process` | Launch TUI in a new terminal tab |
| `kill_process` | Terminate a terminal by ID |
| `list_tabs` | List all active terminals |

## Supported Keys

### Special Keys
`enter`, `tab`, `escape`, `backspace`, `delete`, `space`,
`up`, `down`, `left`, `right`, `home`, `end`, `pageup`, `pagedown`,
`f1`-`f12`, `insert`

### Control Combinations
`ctrl+a` through `ctrl+z`

## Architecture

```
src/
├── index.ts              # MCP server & tool handlers
├── pty-manager.ts        # PTY abstraction & screen buffer
└── terminal-registry.ts  # Multi-terminal management
```

## License

MIT
