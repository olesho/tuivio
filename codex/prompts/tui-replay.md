Analyze a TUI recording (.jsonl) to diagnose a bug.

Arguments: $ARGUMENTS = <recording_file> [bug description].

1. Read the recording. If large (>500 lines), summarize first:
   `tuivio-summarize <recording_file>`   (add --full for every event)
   Otherwise read and parse the JSONL directly.
2. From the `header` event note: command, working directory, terminal size, start time.
3. Walk events chronologically — `input` (keys pressed), `screen` (reconstruct from
   diffs), `marker` (user-flagged points — focus here), `resize`.
4. For each `marker`, study the screen state and inputs just before and after it.
5. Read the application source (from the header command). Look at input handlers,
   rendering logic for the wrong elements, and relevant state management.
6. Diagnose: what the user expected, what actually happened, and the root cause in code.
7. Propose a specific fix: file + line numbers, exact modification, and why it works.
