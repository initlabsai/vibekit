# demo: apps page → method line → signed call

The beat: a deployed ARC-56 contract shows up on its own, you call a method
by typing one line, and you sign exactly the bytes you see. ~25s of tape.

## setup (hidden in the tape)

- localnet up, keystore daemon running with a funded account (`SMOKE1`).
- a project dir with `artifacts/<Name>.arc56.json` and at least one deploy —
  `~/vk` has `HiWorld` (`hi(string)string`, app 1018). Fresh instance:
  `cd ~/vk && npm run deploy` (stamps the deployer note, so the card detects it).
- run vhs **from that project dir** so the spec scan finds the artifacts:
  `Set WorkingDirectory` is not enough for the scan — `cd ~/vk` before `vhs`.
- launch: `bun run /home/gabe/Code/@initlabs/vibekit/apps/tui/src/index.tsx`
  inside `Hide` … `Show`; wait on `Ask anything`.

## the tape, beat by beat

1. `Type "apps"` `Enter` → `Wait+Screen /MY APPS/`. Show the card:
   `● [1] HIWORLD ARC56 … LOCALNET`, hero `#1018`, `creator … · this account`,
   the `greeting  box · AVMString` key, the method row. Sleep 2s.
2. `Type "1"` (card lights, `open ▸`, methods numbered) — Sleep 1s —
   `Type "1"` (method line opens: `hi(name: string) ❯`). Sleep 1.5s.
3. `Type@120ms 'name="world"'` — the typing *is* the demo; keep it slow.
   Sleep 1s. `Enter`.
4. `Wait+Screen /APPROVE THIS CALL/`. The modal: graph, then
   `HiWorld.hi  → app 1018` with `name  "world"` on its own line, `SIMULATED OK`,
   footer "Composed from what you typed — these decoded bytes are exactly what
   gets signed." Sleep 3s — this is the money frame.
5. `Enter` → `Wait+Screen /Call confirmed on-chain/`. Then `Tab`,
   `Down@8ms 200` to reach the TRANSACTION card: `method hi`, `name world`,
   `return Hi, world`. Sleep 3s. End.

Optional second segment (gacha, re-roll until clean): in the composer
`Type 'call hi with "again" on HiWorld'` `Enter` → same modal via the agent.
Same wait regex. Shows the spec is the agent's tool too.

## cards + copy

- open: `your contracts, in the terminal` / `arc-56 in. typed calls out.`
- between segments (if two): `same spec, same modal` / `type it, or ask.`
- close: `vibekit explore` / `sign what you see`

## tweet angles

- plain: `vibekit explore now finds your deployed contracts and turns the
  arc-56 spec into a method line. type the args, sign the bytes you see.`
- gag: `lora has forms. we have one line. hi(name: string) ❯ "world"`
- benefit: `deploy from your project, open ^2, your app is already there —
  creator, state keys, methods. call one. the approval card shows the decoded
  args before you sign.`

Recommend the plain one; the gag second if the thread has room.

## gotchas

- `^2` doesn't pass through tmux/vhs reliably; `apps` + Enter does.
- the modal's kicker is `APPROVE THIS CALL?` for one app call — wait on that,
  not `GROUP`.
- keys go to the method input once it's open; `o`/digits are inert there.
- if a write is already awaiting approval the next one is refused with a note
  on the card — deny (`Esc`) before re-rolling.
