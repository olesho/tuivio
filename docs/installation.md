# Installing Tuivio Plugin for Claude Code

This guide explains how to install and configure the Tuivio TUI Development plugin for Claude Code.

## Prerequisites

- Claude Code CLI installed
- Node.js v18 or higher
- npm

## Quick Install (Recommended)

Use the installation script to build and configure the plugin:

```bash
cd /path/to/tuivio
./install-plugin.sh
```

The script will:
1. Check prerequisites (Node.js v18+, npm)
2. Build the MCP server in the `server/` directory
3. Configure the plugin with absolute paths

Then start Claude Code with the plugin:

```bash
claude --plugin-dir /path/to/tuivio/plugin
```

**Tip:** Add an alias to your shell profile for convenience:

```bash
# Add to ~/.bashrc or ~/.zshrc
alias claude-tui='claude --plugin-dir /path/to/tuivio/plugin'
```

## Manual Installation

### 1. Build the MCP Server

```bash
cd /path/to/tuivio/server
npm install
npm run build
```

This compiles the TypeScript source to `server/dist/`.

### 2. Configure the MCP Server Path

Edit `plugin/.mcp.json` to use the absolute path:

```json
{
  "mcpServers": {
    "tui": {
      "command": "node",
      "args": ["/path/to/tuivio/server/dist/index.js"]
    }
  }
}
```

### 3. Start Claude Code with the Plugin

```bash
claude --plugin-dir /path/to/tuivio/plugin
```

You can load the plugin in any project directory - just run the above command from wherever you're working.

## Verifying Installation

Once installed, you can verify the plugin is working:

1. **Check MCP tools are available:**
   ```
   Ask Claude: "List your available MCP tools"
   ```
   You should see tools like `mcp__tui__run_tui`, `mcp__tui__view_screen`, etc.

2. **Check the agent is available:**
   ```
   Ask Claude to use the tuivio-dev agent
   ```

## Project Structure

```
tuivio/
├── server/                  # MCP Server (standalone)
│   ├── src/                 # TypeScript source
│   ├── dist/                # Compiled JavaScript
│   ├── bin/                 # CLI entry point
│   └── package.json         # Server dependencies
├── plugin/                  # Claude Code Plugin
│   ├── .claude-plugin/
│   │   └── plugin.json      # Plugin manifest
│   ├── .mcp.json            # MCP server configuration
│   ├── agents/
│   │   └── tuivio-dev.md    # TUI development agent
│   └── skills/
│       ├── tui-run/         # Launch TUI skill
│       ├── tui-inspect/     # Inspect screen skill
│       └── tui-iterate/     # Fix and verify skill
├── docs/                    # Documentation
├── install-plugin.sh        # Installation script
└── package.json             # Root orchestration
```

## Available Features

### Agent: tuivio-dev

A specialized agent for TUI development with visual feedback. Use it when developing, testing, or debugging terminal user interface applications.

### Skills

| Skill | Usage | Description |
|-------|-------|-------------|
| `/tui-run` | `/tui-run python3 app.py` | Launch a TUI and view initial screen |
| `/tui-inspect` | `/tui-inspect` | View current TUI screen state |
| `/tui-iterate` | `/tui-iterate fix alignment` | Fix an issue and verify |

### MCP Tools

| Tool | Description |
|------|-------------|
| `run_tui` | Launch a TUI application |
| `stop_tui` | Stop the current TUI |
| `view_screen` | Capture terminal screen as text |
| `type_text` | Send text input |
| `press_key` | Send key press (arrows, enter, etc.) |
| `wait` | Pause for rendering |
| `get_screen_size` | Get terminal dimensions |
| `create_process` | Launch TUI in new terminal tab |
| `kill_process` | Terminate a specific terminal |
| `list_tabs` | List all active terminals |

## Troubleshooting

### Plugin not loading

1. Make sure you're using `--plugin-dir` flag when starting Claude Code
2. Verify the plugin path is absolute and correct
3. Check that `plugin/.claude-plugin/plugin.json` exists

### MCP server fails to start

1. Ensure the server is built: `cd server && npm run build`
2. Check that `plugin/.mcp.json` contains the correct absolute path
3. Check node-pty permissions (macOS):
   ```bash
   chmod +x server/node_modules/node-pty/prebuilds/darwin-arm64/spawn-helper
   ```

### Screen capture shows garbage

Some TUI frameworks emit escape sequences that aren't fully processed. This is usually cosmetic and doesn't affect functionality.

## Next Steps

- Try developing a simple TUI application with Claude's help
- Use `/tui-run` to launch your app and see it visually
- Use `/tui-iterate` to fix issues with immediate feedback
