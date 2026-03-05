#!/bin/bash
set -e

# Tuivio Plugin Installation Script
# Verifies tmux is installed and prints the command to use the plugin with Claude Code
#
# Installation:
#   git clone git@github.com:olesho/tuivio.git && cd tuivio && ./install-plugin.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_DIR="$SCRIPT_DIR/plugin"

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

# Show usage
usage() {
    echo "Usage: $0 [options]"
    echo ""
    echo "Verifies tmux is installed and configures the plugin for Claude Code."
    echo ""
    echo "Options:"
    echo "  --help      Show this help message"
    echo ""
    echo "Installation:"
    echo ""
    echo "  git clone git@github.com:olesho/tuivio.git"
    echo "  cd tuivio"
    echo "  ./install-plugin.sh"
    echo ""
    echo "After installation, start Claude Code with:"
    echo "  claude --plugin-dir $PLUGIN_DIR"
    echo ""
    exit 0
}

# Check prerequisites
check_prerequisites() {
    print_step "Checking prerequisites..."

    # Check tmux
    if ! command -v tmux &> /dev/null; then
        print_error "tmux is not installed."
        echo ""
        echo "Install tmux:"
        echo "  macOS:  brew install tmux"
        echo "  Ubuntu: sudo apt install tmux"
        echo "  Fedora: sudo dnf install tmux"
        exit 1
    fi
    print_success "tmux $(tmux -V)"

    # Check Claude Code
    if ! command -v claude &> /dev/null; then
        print_warning "Claude Code CLI not found. Install it to use the plugin."
    else
        print_success "Claude Code $(claude --version 2>/dev/null | head -1 || echo 'installed')"
    fi
}

# Verify the plugin directory
verify_plugin() {
    print_step "Verifying plugin..."

    local ALL_OK=true

    if [ -f "$PLUGIN_DIR/.claude-plugin/plugin.json" ]; then
        print_success "Plugin manifest exists"
    else
        print_error "Missing plugin.json"
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

    if [ "$ALL_OK" = true ]; then
        return 0
    else
        return 1
    fi
}

# Main
main() {
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --help|-h)
                usage
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
    echo ""

    check_prerequisites

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
