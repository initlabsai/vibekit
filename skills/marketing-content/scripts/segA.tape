# paste IDs -> cards, no AI
# Run vhs from the repo root: `vhs skills/marketing-content/scripts/segA.tape`
# (vhs rejects absolute Output paths, so it writes beside your cwd.)
Output segA.mp4
Set Width 1400
Set Height 1150
Set FontSize 20
Set Padding 12
Set WaitTimeout 45s
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
Set TypingSpeed 8ms
Type "31566704"
Sleep 400ms
Enter
Wait+Screen /USDC/
Sleep 2.5s
Type "1002541853"
Sleep 400ms
Enter
Wait+Screen /APPLICATION/
Sleep 2.5s
Type "KMNBSQ4ZFX252G7S4VYR4ZDZ3RXIET5CNYQVJUO5OXXPMHAMJCCQ"
Sleep 400ms
Enter
Wait+Screen /CONFIRMED/
Sleep 3s
Hide
Ctrl+C
Sleep 1s
