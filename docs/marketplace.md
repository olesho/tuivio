# Marketplace Installation

Tuivio can be installed through the Claude Code plugin marketplace system, which provides a streamlined installation experience.

## What is the Plugin Marketplace?

The Claude Code plugin marketplace allows you to install plugins from Git repositories without manually cloning or configuring them. Tuivio provides its own marketplace configuration that can be added to Claude Code.

## Adding the Tuivio Marketplace

First, add the Tuivio marketplace source to Claude Code:

```
/plugin marketplace add olesho/tuivio
```

This adds the marketplace configuration from `https://github.com/olesho/tuivio`.

## Installing the Plugin

Once the marketplace is added, install the plugin:

```
/plugin install tuivio-tui-dev@tuivio-marketplace --scope user
```

This will:
1. Download the plugin from the Git repository
2. Build the MCP server automatically
3. Configure Claude Code to use the plugin

## Verifying Installation

After installation, verify the plugin is working:

1. **Check MCP tools are available:**
   ```
   Ask Claude: "List your available MCP tools"
   ```
   You should see tools like `mcp__tui-dev__run_tui`, `mcp__tui-dev__view_screen`, etc.

2. **Check the agent is available:**
   ```
   Ask Claude to use the tuivio-dev agent
   ```

## Updating the Plugin

To update to the latest version:

```
/plugin update tuivio-tui-dev
```

## Uninstalling

To remove the plugin:

```
/plugin uninstall tuivio-tui-dev
```

To remove the marketplace source:

```
/plugin marketplace remove tuivio-marketplace
```

## Differences from Manual Installation

| Aspect | Marketplace | Manual |
|--------|-------------|--------|
| Setup complexity | Single command | Multiple steps |
| Updates | `/plugin update` | `git pull` + rebuild |
| Customization | Limited | Full control |
| Location | Claude Code plugin directory | Your chosen directory |

## When to Use Manual Installation Instead

Choose manual installation if you:
- Want to contribute to Tuivio development
- Need to customize the MCP server configuration
- Want the plugin in a specific directory
- Prefer to manage updates via git

See [Installation Guide](installation.md) for manual installation methods.
