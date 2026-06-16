Launch a TUI application and view its initial screen.

Target: $ARGUMENTS (the command and args to run, e.g. `python3 todo.py`).

1. If $ARGUMENTS is empty, ask which TUI application to run.
2. Launch it (use tuivio-start, NEVER raw `tmux new-session`):
   `tuivio-start $ARGUMENTS`
3. Capture the screen:
   `tmux capture-pane -t tuivio -p`
4. Report: is the app running correctly, what is displayed, and are there any errors or
   crashes (tracebacks, blank screen, shell prompt reappearing)?
