View and analyze the current TUI screen state.

Optional argument: $ARGUMENTS = a tmux session name (default `tuivio`).

1. Check for a live tuivio-record session first:
   `tuivio-discover --json 2>/dev/null`
   - If found, read the screen via its socket:
     `printf '%s\n' '{"type":"screen"}' | nc -U <socketPath>`
2. Otherwise fall back to tmux:
   `tmux list-sessions 2>/dev/null | grep tuivio`
   `tmux capture-pane -t ${ARGUMENTS:-tuivio} -p`
3. Analyze and report: current screen contents, visible UI elements (menus, inputs,
   lists), any error messages, and the overall application state. Check whether the UI
   renders correctly, elements are aligned, and the app is responsive (not frozen).

If no TUI is running, say so and suggest the tui-run prompt to launch one.
