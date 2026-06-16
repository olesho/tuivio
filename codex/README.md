# Tuivio for Codex

Codex doesn't use Claude Code's plugin marketplace, but Tuivio's engine — `tmux` plus the
`tuivio-*` CLI tools — is just shell, so it works in Codex once you give Codex the
instructions. This directory ports the plugin to Codex's formats.

## 1. Install the CLI tools and tmux

```bash
# from the repo root
cd server && npm install && npm run build && npm link
# tmux: brew install tmux   (macOS)   |   apt install tmux   (Linux)
```

This puts `tuivio-start`, `tuivio-record`, `tuivio-attach`, `tuivio-discover`,
`tuivio-mark`, and `tuivio-summarize` on your `$PATH`.

## 2. Give Codex the guidance (AGENTS.md)

Codex automatically reads `AGENTS.md` from the project root (and `~/.codex/AGENTS.md`
globally). Use whichever scope you want:

```bash
# Per project: drop it next to the TUI you're building
cp codex/AGENTS.md /path/to/your-tui-project/AGENTS.md

# Or globally, for every Codex session:
cat codex/AGENTS.md >> ~/.codex/AGENTS.md
```

## 3. (Optional) Install the prompts — the analog of skills

Codex supports reusable prompts in `~/.codex/prompts/*.md`, invoked as `/tui-run`,
`/tui-inspect`, etc. (the filename becomes the command):

```bash
mkdir -p ~/.codex/prompts
cp codex/prompts/*.md ~/.codex/prompts/
```

| Prompt | Purpose |
|--------|---------|
| `/tui-run <command>` | Launch a TUI and view its initial screen |
| `/tui-inspect` | Capture and analyze the current screen |
| `/tui-iterate <issue>` | Fix an issue, restart, and verify |
| `/tui-attach` | Connect to an externally-running `tuivio-record` session |
| `/tui-replay <file>` | Diagnose a `.jsonl` recording |

## What does NOT carry over

- The Claude Code SessionStart hook (the tmux availability check) has no Codex equivalent —
  just make sure tmux is installed.
- `claude plugin install …` — there is no Codex marketplace; the steps above replace it.
