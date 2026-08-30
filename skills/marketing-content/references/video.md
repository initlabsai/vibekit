# Promo and demo videos

Record the real TUI with `vhs`, cut in HTML title cards, concat and score in
one ffmpeg pass. The footage is always the real product — no mockups, no
sped-up fakery beyond honest jump cuts.

Working tapes: `scripts/segA.tape` (paste IDs → cards, no AI) and
`scripts/segB.tape` (english → the agent wakes up). They're a starting shape,
not a template to fill in blindly.

## Storyboard first

A promo is beats, not features. The shape that works:

1. **open on the payoff.** Hide the launch, the `network mainnet`, the
   waiting. `Hide` … `Show` around setup so the video opens on the
   interesting frame.
2. **one mechanic per segment.** A segment shows a single thing working.
3. **card between segments** — states the idea the next segment proves.
4. **close on the claim**, product name and a short line.

Record each segment as its own tape. Re-rolling one segment then doesn't
touch the others, which matters a lot once AI segments are involved.

`references/demos/apps-call.md` is a fully storyboarded shoot (the ARC-56
method-call demo) — read it as an example of the beat breakdown, not as a
recipe to re-run; its app IDs and paths are from that day.

## Recording

Run vhs **from the directory the tape needs** — for TUI recordings that's
usually the repo root, and for anything that scans a project (ARC-56 specs,
deployed apps) it must be that project dir. `Set WorkingDirectory` does not
affect the scan; `cd` before `vhs`.

Match the terminal background to the brand ground or the cut between a shell
segment and a TUI segment visibly jumps:

```
Set Theme { "background": "#0a0b0e", "foreground": "#e9e1d4", "cursor": "#ffb454" }
```

**Wait on text, not on time.** `Wait+Screen /regex/` beats `Sleep` for
anything network-dependent. Wait on strings you have verified appear — card
kickers like `ASSET`, `APPLICATION`, `CONFIRMED`, or the composer's idle hint
`Ask anything`.

Two ways that bites:

- `Wait+Screen` matches the *visible buffer*. A kicker inside a tall card that
  renders below the fold never matches. Prefer a footer or composer string
  that is always on screen.
- **A modal you didn't know about looks exactly like a hang.** The Explorer's
  explain flow opens a cost-approval modal (`EXPLAIN THIS CONTRACT?` /
  `[enter] run`); a tape that never presses Enter sits at `working…` until vhs
  times out. When a recording stalls, re-run with no waits and a fixed
  `Sleep`, then look at the last frame. Guessing costs takes; the diagnostic
  costs one.

**Jump-cut long waits.** For an AI response: show ~3s of "Working…", then
`Hide` → `Wait+Screen /Ask anything/` → `Show`. Dead air kills the pace, and
nobody believes the wait was the point.

**Scroll to the bottom, not a fixed amount.** Reply length varies wildly
between rolls. `Tab` (focus feed) then `Down@8ms 400` — extra presses at the
bottom are no-ops, so the final frame composes itself. A fixed scroll lands
somewhere different every take.

**Type at human speed when the typing is the demo.** `Type@120ms` for the one
line the viewer is supposed to read; `Set TypingSpeed 6ms` for pasted IDs
nobody reads.

**Time cuts to informational value.** Hold a confirmation long enough to read
the decisive status, then move. Don't leave a resolved screen up just because
there's runtime to fill.

Parser gotchas: `Screenshot` paths can't start with a digit, and absolute
paths fail — run vhs from the output dir with relative names.

## AI segments are a gacha

Every roll differs. It may dump raw state, 404 on a deleted entity, or
confidently speculate (a "rekey scam" that isn't, a wrong protocol name).
Treat a take as unusable until you've read it:

```sh
ffmpeg -y -sseof -1 -i segB.mp4 -frames:v 1 -update 1 segB_last.png
```

Read the prose in that frame. Re-roll until it's promo-safe. Pick demo
entities that still exist on mainnet — curl the indexer first — so tool calls
can't 404 on camera.

**Never tell the model to skip tools to save time.** It says so on camera
("you asked me to answer without tools, so I'll go from what a standard file
contains rather than reading it") and the beat dies. Let it read the file;
that *is* the demo.

Good demo IDs: asset `31566704` (USDC), app `1002541853` (Tinyman v2), txns
from `packages/vibekit/test/recorded/mainnet-graph-corpus.json`.

## Driving `claude` in a tape

Three specific gotchas:

- First launch shows a trust prompt and an MCP-enable prompt. Send an `Enter`
  for each before typing, or your prompt lands in a dialog and the turn never
  runs.
- The turn-complete footer verb is randomised (`Crunched for 9s`, `Cooked for
  9s`, `Worked for 9s`). Wait on `/ for [0-9]+s/`, never on one verb.
- `unset CLAUDE_CODE_CHILD_SESSION` or a nested session prints a transcript
  warning over the footage.

## Assembly

Title cards are HTML — `scripts/make-card.sh`, see `cards.md`. Match the card
size to the tape size.

Concat and score in one pass. TOTAL is the sum of all clip durations (`ffprobe`
each); audio fades out over the last 3s, video fades to black over 0.74s:

```sh
ffmpeg -y -i card0.mp4 -i card1.mp4 -i segA.mp4 -i card2.mp4 -i segB.mp4 \
  -i music.mp3 \
  -filter_complex "[0:v][1:v][2:v][3:v][4:v]concat=n=5:v=1:a=0,fade=t=out:st=<TOTAL-0.74>:d=0.74[v];\
[5:a]atrim=0:<TOTAL>,afade=t=in:d=0.5,afade=t=out:st=<TOTAL-3>:d=3,volume=0.9[a]" \
  -map "[v]" -map "[a]" -c:v libx264 -crf 20 -preset slow -pix_fmt yuv420p \
  -c:a aac -b:a 160k -movflags +faststart <repo-root>/out/<name>.mp4
```

Or keep the video silent and score it separately with `scripts/add-music.sh` —
which is the better habit, since it leaves you a silent master in `out/silent/`
and lets you swap tracks without re-encoding video. Track offsets are in
`brand.md`.

## QA before you call it done

Verify frames, not vibes. Extract stills across the whole cut and actually
look at them:

```sh
for t in 1.1 3.2 8 15 20 30; do
  ffmpeg -y -ss $t -i out/<name>.mp4 -frames:v 1 -update 1 qa_$t.png
done
```

Check: no seam at card/footage cuts, the AI prose is defensible, no text runs
off the right edge, scanlines survived encoding, and the last frame holds long
enough to read.
