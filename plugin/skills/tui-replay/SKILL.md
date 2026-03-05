---
name: tui-replay
description: Analyze a TUI recording to diagnose bugs. Use when you have a .jsonl recording file from tuivio-record and want AI-assisted debugging.
arguments:
  - name: recording_file
    description: Path to the JSONL recording file
    required: true
  - name: bug_description
    description: Description of the bug or unexpected behavior
    required: false
---

# TUI Recording Replay & Diagnosis

You are analyzing a TUI recording file to diagnose a bug. Follow these steps:

## 1. Read the Recording

Read the recording file at `$ARGUMENTS.recording_file`.

If the file is large (>500 lines of JSONL), run the summarizer first:
```bash
tuivio-summarize "$ARGUMENTS.recording_file"
```

If the file is small enough, read it directly and parse the JSONL events.

## 2. Understand Context

From the `header` event, note:
- **Command**: What TUI application was running
- **Working directory**: Where it was launched from
- **Terminal size**: cols x rows
- **Start time**: When the session began

## 3. Walk Through the Session

Process events chronologically:
- **input** events: What the user typed/pressed
- **screen** events: What the TUI showed (reconstruct from diffs)
- **marker** events: Points the user flagged as important — focus analysis here
- **resize** events: Terminal size changes

Build a mental model of what the user was doing and what the TUI showed.

## 4. Focus on Markers

If there are `marker` events, they indicate where the user noticed the bug. Pay special attention to:
- The screen state just before the marker
- The inputs leading up to the marker
- The screen state right after the marker

## 5. Read Source Code

Based on the command from the header, find and read the TUI application source code. Look for:
- The code that handles the inputs near the bug
- The rendering logic for the screen elements that look wrong
- State management that could cause the observed behavior

## 6. Diagnose

{{ if $ARGUMENTS.bug_description }}
The user reports: **$ARGUMENTS.bug_description**
{{ end }}

Correlate the recording events with the source code to identify:
- What the user expected to happen
- What actually happened
- The root cause in the code

## 7. Propose Fix

Provide a specific code fix with:
- The file and line numbers to change
- The exact modification needed
- An explanation of why this fixes the bug
