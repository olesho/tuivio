Connect to an externally-running TUI session (started via tuivio-record).

1. Discover running sessions:
   `tuivio-discover --json`
   - If none found, tell the user to start one: `tuivio-record <command>`.
2. Read the screen via the live socket:
   `printf '%s\n' '{"type":"screen"}' | nc -U <socketPath>`
   The response is JSON with `lines` (screen text) and a `highlights` array (styled
   lines — reverse video / background colors), which reveals selection/focus in apps
   that use those styles.
3. Report what is displayed, the visible UI elements, the `highlights`, and any errors.
4. Ask the user what to do next.

Sending keys: the socket needs the JSON to carry the **literal** escape text `\u001b`,
which it JSON-parses into the real ESC byte. Always use `printf '%s\n' '<json>'` — the
`%s` form passes backslash escapes through verbatim. Do NOT put the escape in printf's
format string (`printf '{...\u001b...}'`): printf would expand it to a raw ESC byte and the
socket rejects that with `{"ok":false,"error":"Invalid JSON"}`. The same applies to `\r`
(Enter) and `\t` (Tab) — keep them literal.

  Up:    `printf '%s\n' '{"type":"keys","input":"\u001b[A"}' | nc -U <socketPath>`
  Down:  `printf '%s\n' '{"type":"keys","input":"\u001b[B"}' | nc -U <socketPath>`
  Enter: `printf '%s\n' '{"type":"keys","input":"\r"}'      | nc -U <socketPath>`
  Esc:   `printf '%s\n' '{"type":"keys","input":"\u001b"}'   | nc -U <socketPath>`
  Tab:   `printf '%s\n' '{"type":"keys","input":"\t"}'      | nc -U <socketPath>`
  Text:  `printf '%s\n' '{"type":"keys","input":"hello"}'    | nc -U <socketPath>`

A successful send returns `{"ok":true,"bytes":N}` (an arrow key is 3 bytes). After sending
keys, re-read the screen to see the result.

Add a marker: `printf '%s\n' '{"type":"marker","label":"description"}' | nc -U <socketPath>`
