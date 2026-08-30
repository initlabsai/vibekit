# english -> the agent wakes up
# Run vhs from the repo root: `vhs skills/marketing-content/scripts/segB.tape`
# (vhs rejects absolute Output paths, so it writes beside your cwd.)
Output segB.mp4
Set Width 1400
Set Height 1150
Set FontSize 20
Set Padding 12
Set WaitTimeout 90s
Set Framerate 30
Set Theme { "background": "#0a0b0e", "foreground": "#e9e1d4", "cursor": "#ffb454" }

Hide
Type "bun run apps/tui/src/index.tsx"
Enter
Wait+Screen /paste an id/
Type "network mainnet"
Enter
Sleep 3s
Show
Sleep 1s
Set TypingSpeed 30ms
Type "hey tell me about this txn "
Set TypingSpeed 6ms
Type "KMNBSQ4ZFX252G7S4VYR4ZDZ3RXIET5CNYQVJUO5OXXPMHAMJCCQ"
Sleep 500ms
Enter
Sleep 3s
Hide
Wait+Screen /Ask anything/
Sleep 500ms
Show
Sleep 1.5s
Tab
Sleep 500ms
Down@8ms 400
Sleep 5s
Hide
Ctrl+C
Sleep 1s
