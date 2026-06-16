Fix a TUI issue, restart, and verify the fix with visual feedback.

Issue to fix: $ARGUMENTS

1. Analyze the issue using the description and previous screen views.
2. Locate the relevant source file(s).
3. Make the fix.
4. Restart and verify:
   - Check for a live session: `tuivio-discover --json 2>/dev/null`
     - If one exists, interact over the socket:
       `printf '%s\n' '{"type":"screen"}' | nc -U <socketPath>`
       (to send keys, use the `printf '%s\n' '...'` forms from the tui-attach prompt —
        the `%s` form keeps `\u001b`/`\r`/`\t` literal so the socket can JSON-parse them)
   - Otherwise restart with tuivio-start (NOT raw tmux):
     `tmux kill-session -t tuivio 2>/dev/null; tuivio-start <same command as before>`
     `tmux capture-pane -t tuivio -p`
5. Report: did the fix work, is the issue resolved, are there new issues? If not fixed,
   analyze what went wrong and iterate again.
