#!/bin/bash
set -e

# Tuivio Plugin Installation Script
# Installs the MCP server and prepares the plugin for use with Claude Code
#
# Installation methods:
#   1. Clone and install:  git clone git@github.com:olesho/tuivio.git && cd tuivio && ./install-plugin.sh
#   2. Direct npm install: npm install -g git+ssh://git@github.com:olesho/tuivio.git

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_DIR="$SCRIPT_DIR/tuivio-plugin"
DIST_DIR="$SCRIPT_DIR/dist"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_step() {
    echo -e "${GREEN}==>${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}Warning:${NC} $1"
}

print_error() {
    echo -e "${RED}Error:${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_info() {
    echo -e "${BLUE}${NC} $1"
}

# Show usage
usage() {
    echo "Usage: $0 [options]"
    echo ""
    echo "Installs the Tuivio MCP server and configures the plugin for Claude Code."
    echo ""
    echo "Options:"
    echo "  --global    Install globally via npm link (recommended)"
    echo "  --local     Use local paths (for development)"
    echo "  --help      Show this help message"
    echo ""
    echo "Installation from git repository:"
    echo ""
    echo "  # Method 1: Clone and install (recommended)"
    echo "  git clone git@github.com:olesho/tuivio.git"
    echo "  cd tuivio"
    echo "  ./install-plugin.sh --global"
    echo ""
    echo "  # Method 2: Direct npm install"
    echo "  npm install -g git+ssh://git@github.com:olesho/tuivio.git"
    echo ""
    echo "After installation, start Claude Code with:"
    echo "  claude --plugin-dir $PLUGIN_DIR"
    echo ""
    exit 0
}

# Check prerequisites
check_prerequisites() {
    print_step "Checking prerequisites..."

    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js v18 or higher."
        exit 1
    fi

    NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        print_error "Node.js v18+ required. Found: $(node -v)"
        exit 1
    fi
    print_success "Node.js $(node -v)"

    # Check npm
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed."
        exit 1
    fi
    print_success "npm $(npm -v)"

    # Check Claude Code
    if ! command -v claude &> /dev/null; then
        print_warning "Claude Code CLI not found. Install it to use the plugin."
    else
        print_success "Claude Code $(claude --version 2>/dev/null | head -1 || echo 'installed')"
    fi
}

# Build the MCP server
build_server() {
    print_step "Building MCP server..."

    cd "$SCRIPT_DIR"

    # Check if node_modules exists
    if [ ! -d "node_modules" ]; then
        print_step "Installing dependencies..."
        npm install
    fi

    # Build if needed
    if [ ! -d "$DIST_DIR" ] || [ ! -f "$DIST_DIR/index.js" ]; then
        print_step "Compiling TypeScript..."
        npm run build
    else
        # Check if source is newer than dist
        NEWEST_SRC=$(find src -name "*.ts" -newer "$DIST_DIR/index.js" 2>/dev/null | head -1)
        if [ -n "$NEWEST_SRC" ]; then
            print_step "Source changed, recompiling..."
            npm run build
        else
            print_success "Build is up to date"
        fi
    fi

    # Fix node-pty permissions on macOS
    SPAWN_HELPER="$SCRIPT_DIR/node_modules/node-pty/prebuilds/darwin-arm64/spawn-helper"
    if [ -f "$SPAWN_HELPER" ] && [ ! -x "$SPAWN_HELPER" ]; then
        print_step "Fixing node-pty permissions..."
        chmod +x "$SPAWN_HELPER"
    fi

    print_success "MCP server ready at $DIST_DIR/index.js"
}

# Install globally via npm link
install_global() {
    print_step "Installing tuivio-server globally..."

    cd "$SCRIPT_DIR"

    # Link the package globally
    npm link

    # Verify the command is available
    if command -v tuivio-server &> /dev/null; then
        print_success "tuivio-server command is now available globally"
    else
        print_warning "tuivio-server not found in PATH. You may need to restart your shell."
    fi
}

# Configure the plugin for local development (absolute paths)
configure_plugin_local() {
    print_step "Configuring plugin for local development..."

    # Update .mcp.json with absolute path to built server
    local MCP_CONFIG="$PLUGIN_DIR/.mcp.json"
    cat > "$MCP_CONFIG" << EOF
{
  "mcpServers": {
    "tui": {
      "command": "node",
      "args": [
        "$DIST_DIR/index.js",
        "--live-file", "./tuivio-live.txt",
        "--log-file", "./tuivio.log"
      ]
    }
  }
}
EOF
    print_success "Configured MCP with local absolute path"
}

# Configure the plugin for global installation (uses tuivio-server command)
configure_plugin_global() {
    print_step "Configuring plugin for global installation..."

    # Update .mcp.json to use the global command
    local MCP_CONFIG="$PLUGIN_DIR/.mcp.json"
    cat > "$MCP_CONFIG" << EOF
{
  "mcpServers": {
    "tui": {
      "command": "tuivio-server",
      "args": [
        "--live-file", "./tuivio-live.txt",
        "--log-file", "./tuivio.log"
      ]
    }
  }
}
EOF
    print_success "Configured MCP to use global tuivio-server command"
}

# Verify the plugin is ready
verify_plugin() {
    print_step "Verifying plugin..."

    local ALL_OK=true

    # Check plugin files
    if [ -f "$PLUGIN_DIR/.claude-plugin/plugin.json" ]; then
        print_success "Plugin manifest exists"
    else
        print_error "Missing plugin.json"
        ALL_OK=false
    fi

    if [ -f "$PLUGIN_DIR/.mcp.json" ]; then
        print_success "MCP config exists"
    else
        print_error "Missing .mcp.json"
        ALL_OK=false
    fi

    if [ -d "$PLUGIN_DIR/agents" ]; then
        print_success "Agents directory exists"
    else
        print_error "Missing agents directory"
        ALL_OK=false
    fi

    if [ -d "$PLUGIN_DIR/skills" ]; then
        print_success "Skills directory exists"
    else
        print_error "Missing skills directory"
        ALL_OK=false
    fi

    # Check MCP server
    if [ -f "$DIST_DIR/index.js" ]; then
        print_success "MCP server built"
    else
        print_error "MCP server not built"
        ALL_OK=false
    fi

    if [ "$ALL_OK" = true ]; then
        return 0
    else
        return 1
    fi
}

# Main
main() {
    local INSTALL_MODE="global"

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --help|-h)
                usage
                ;;
            --global)
                INSTALL_MODE="global"
                shift
                ;;
            --local)
                INSTALL_MODE="local"
                shift
                ;;
            *)
                print_error "Unknown option: $1"
                usage
                ;;
        esac
    done

    echo "Tuivio TUI Development Plugin Setup"
    echo "==================================="
    echo "Plugin: $PLUGIN_DIR"
    echo "Mode: $INSTALL_MODE"
    echo ""

    check_prerequisites
    build_server

    if [ "$INSTALL_MODE" = "global" ]; then
        install_global
        configure_plugin_global
    else
        configure_plugin_local
    fi

    if verify_plugin; then
        echo ""
        echo -e "${GREEN}Plugin is ready!${NC}"
        echo ""
        echo "To use the plugin, start Claude Code with:"
        echo ""
        echo -e "  ${BLUE}claude --plugin-dir $PLUGIN_DIR${NC}"
        echo ""
        echo "Or add an alias to your shell profile:"
        echo ""
        echo "  alias claude-tui='claude --plugin-dir $PLUGIN_DIR'"
        echo ""
        echo "Once loaded, you can:"
        echo "  - Use /tui-run to launch TUI applications"
        echo "  - Use /tui-inspect to view the current screen"
        echo "  - Use /tui-iterate to fix issues with visual feedback"
        echo ""
    else
        echo ""
        print_error "Plugin setup incomplete. Please check the errors above."
        exit 1
    fi
}

main "$@"
