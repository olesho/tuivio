# Installing Tuivo Plugin for Claude Code

This guide explains how to install and configure the Tuivo TUI Development plugin for Claude Code.

## Prerequisites

- Claude Code CLI installed
- Node.js v18 or higher
- npm

## Quick Install (Recommended)

Use the installation script to build and configure the plugin:

```bash
cd /path/to/tuivo
./install-plugin.sh
```

The script will:
1. Check prerequisites (Node.js v18+, npm)
2. Build the MCP server
3. Configure the plugin with absolute paths

Then start Claude Code with the plugin:

```bash
claude --plugin-dir /path/to/tuivo/tuivo-plugin
```

**Tip:** Add an alias to your shell profile for convenience:

```bash
# Add to ~/.bashrc or ~/.zshrc
alias claude-tui='claude --plugin-dir /path/to/tuivo/tuivo-plugin'
```

## Manual Installation

### 1. Build the MCP Server

```bash
cd /path/to/tuivo
npm install
npm run build
```

This compiles the TypeScript source to `dist/`.

### 2. Configure the MCP Server Path

Edit `tuivo-plugin/.mcp.json` to use the absolute path:

```json
{
  "mcpServers": {
    "tui": {
      "command": "node",
      "args": ["/path/to/tuivo/dist/index.js"]
    }
  }
}
```

### 3. Start Claude Code with the Plugin

```bash
claude --plugin-dir /path/to/tuivo/tuivo-plugin
```

You can load the plugin in any project directory - just run the above command from wherever you're working.

## Verifying Installation

Once installed, you can verify the plugin is working:

1. **Check MCP tools are available:**
   ```
   Ask Claude: "List your available MCP tools"
   ```
   You should see tools like `mcp__tui__run_tui`, `mcp__tui__view_screen`, etc.

2. **Test with a simple TUI:**
   ```
   /tui-run node /path/to/tuivo/dist/sample-tui/index.js
   ```

3. **Check the agent is available:**
   ```
   Ask Claude to use the tuivo-dev agent
   ```

## Plugin Structure

```
tuivo-plugin/
├── .claude-plugin/
│   └── plugin.json      # Plugin manifest
├── .mcp.json            # MCP server configuration
├── agents/
│   └── tuivo-dev.md     # TUI development agent
└── skills/
    ├── tui-run/         # Launch TUI skill
    ├── tui-inspect/     # Inspect screen skill
    └── tui-iterate/     # Fix and verify skill
```

## Available Features

### Agent: tuivo-dev

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
3. Check that `tuivo-plugin/.claude-plugin/plugin.json` exists

### MCP server fails to start

1. Ensure the project is built: `npm run build`
2. Check that `tuivo-plugin/.mcp.json` contains the correct absolute path
3. Check node-pty permissions (macOS):
   ```bash
   chmod +x node_modules/node-pty/prebuilds/darwin-arm64/spawn-helper
   ```

### Screen capture shows garbage

Some TUI frameworks emit escape sequences that aren't fully processed. This is usually cosmetic and doesn't affect functionality.

## Next Steps

- Try developing a simple TUI application with Claude's help
- Use `/tui-run` to launch your app and see it visually
- Use `/tui-iterate` to fix issues with immediate feedback
