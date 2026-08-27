---
name: marketing-content
internal: true
description: Make vibekit marketing content — promo videos of the TUI recorded with VHS, tweet drafts in the vibekit voice, and the brand palette/fonts. Use when asked for a promo/demo video, a tweet or announcement, social copy, or anything needing vibekit's colors, voice, or the video pipeline.
---

# vibekit marketing content

How we make promo videos of the TUI, write tweets, and stay on brand. Everything
here was learned by doing; the reference tapes in `references/` are the working
pipeline from the "AI is optional" promo (Aug 2026), kept as a starting point.

## Brand

**Voice** (see `references/tweets.md` for real examples):

- lowercase, casual, short. no corporate case, no exclamation-mark enthusiasm.
- subtle memes/puns are good; *visibly trying* to meme is not. If the joke
  needs a hashtag or an explanation, cut it.
- confident, a little playful, never begging ("please check out…" is banned).
- second person works ("see that lil green bar? that's your context window").

**Palette** — the source of truth is `apps/tui/src/theme.ts` (Init Labs
amber-phosphor). Read it before styling anything; the philosophy is two hues
and a ground: amber is structure and figures, teal is alive/touchable, red is
danger only. Key values:

| role | hex |
|---|---|
| background (ground) | `#0a0b0e` |
| card surface | `#111318` |
| brass (amber, structure) | `#c4a06a` |
| brass bright (hero) | `#ffb454` |
| teal (signal, live) | `#6fd3d3` |
| text (warm neutral) | `#e9e1d4` |
| muted | `#8e8476` |
| red (danger only) | `#e07c7c` |

For title cards in videos we used `#08090c` bg (sampled from the actual
rendered frame — sample, don't assume), `0xd9a353` amber for the product name,
`0xe6e0d2` for headings, `0x9aa0aa` for subtitles.

**Font**: JetBrains Mono (on this machine:
`/usr/share/fonts/TTF/JetBrainsMonoNerdFont-{Regular,Bold}.ttf`). Everything is
monospace — title cards too, so they feel like part of the terminal. For
ffmpeg/libass, resolve the actual installed family with `fc-match`; use the
reported family name (currently `JetBrainsMono Nerd Font`), not an assumed
family name that silently falls back to a sans-serif font.

## Promo videos (VHS + ffmpeg)

Pipeline: record the real TUI with `vhs` (terminal recorder, in PATH), make
title cards with ffmpeg `drawtext`, concat + music in one ffmpeg pass.
Finished videos go in `out/` at the repo root (gitignored) — never commit
video files; work files (tapes, cards, QA frames) stay in a temp dir.
Working tapes: `references/segA.tape` (paste IDs → cards),
`references/segB.tape` (english → AI), `references/assemble.md` (the exact
ffmpeg commands), `references/make-card.sh` (title cards),
`references/add-music.sh` (the music pass).

`vhs` needs `ttyd` installed (`sudo pacman -S ttyd`) or every recording fails
with "ttyd is not installed".

Match the terminal background to the brand ground or the cut between a shell
segment and a TUI segment visibly jumps:

    Set Theme { "background": "#0a0b0e", "foreground": "#e9e1d4", "cursor": "#ffb454" }

Lessons that cost time — don't relearn them:

1. **Hide the setup, show the payoff.** Wrap launch/`network mainnet` in
   `Hide` … `Show`. The video opens on the interesting part.
2. **Jump-cut long waits.** For AI responses: show ~3s of "Working…", then
   `Hide` → `Wait+Screen /Ask anything/` → `Show`. Dead air kills snappy.
3. **`Wait+Screen /regex/` beats `Sleep`** for anything network-dependent.
   Wait on text you verified appears (card kickers like `ASSET`,
   `APPLICATION`, `CONFIRMED`; the composer's idle hint `Ask anything`).
4. **VHS parser gotchas**: `Screenshot` paths can't start with a digit and
   absolute paths fail — run vhs from the output dir with relative names.
5. **Scroll to the *bottom*, not a fixed amount.** AI reply length varies
   wildly between rolls. `Tab` (focus feed) then `Down@8ms 400` — extra
   presses at the bottom are no-ops. The prose is always last, so the final
   frame composes itself.
6. **AI segments are a gacha.** Each roll differs: it may render raw state
   dumps, hit 404s on deleted entities, or confidently speculate ("rekey
   scam", wrong protocol names). Screenshot the last frame
   (`ffmpeg -sseof -1 … -frames:v 1`), *read the prose*, and re-roll until
   it's promo-safe. Pick demo entities whose apps/assets still exist on
   mainnet (curl the indexer first) so tool calls can't 404.
7. **Record segments as separate tapes**, then concat with title cards
   between. Re-rolling one segment doesn't touch the others.
8. **Verify frames, not vibes**: extract QA frames at several timestamps and
   actually look at them before calling it done.
9. **Title cards are HTML, not `drawtext`.** Render them with
    `references/make-card.sh` (HTML → headless chromium → png → mp4). ffmpeg
    `drawtext` cards look like conference slides; the HTML ones look like the
    website, because they are built from the same CSS. The house style is a
    brass top rule, a spaced brass kicker (`2026 // TRANSMISSION RECEIVED`),
    one big statement in warm neutral with the payoff line in hero amber, and
    CSS scanlines. Keep to one visual idea and ~2.5s. Never hand-roll a
    `drawtext` card because it seems quicker — it is, and it looks it.
10. **Typewriter cards must remain readable at every frame.** Keep the copy
    compact (normally 3–5 short lines), reveal it at a human-readable pace,
    and render each completed line continuously while the next one types. Do
    not clear text between events or simulate typing with brief, discontinuous
    captions. After the final character, hold the complete card for at least
    ~1s before cutting. Inspect one in-progress frame and one completed frame
    in the encoded master.
11. **Use archival/CRT treatment only when the creative direction calls for
    it.** Keep it on title cards, not the live TUI: hairline frames,
    deliberately visible low-opacity scanlines, and at most a small piece of
    non-semantic telemetry outside the copy. Preserve legibility and inspect
    the effect after final encoding; compression can erase subtle scanlines.
12. **Driving `claude` in a tape: three gotchas.** First launch shows a trust
    prompt and an MCP-enable prompt — send an `Enter` for each before typing,
    or the prompt lands in a dialog and the turn never runs. The turn-complete
    footer verb is randomised (`Crunched for 9s`, `Cooked for 9s`, `Worked for
    9s`), so wait on `/ for [0-9]+s/`, never on one verb. And `unset
    CLAUDE_CODE_CHILD_SESSION` or a nested session prints a transcript warning
    over the footage.
13. **Never tell the model not to use tools to save time.** It says so on
    camera ("you asked me to answer without tools, so I'll go from what a
    standard file contains rather than reading it") and the whole point of the
    beat dies. Let it read the file; that is the demo.
14. **Wait on text that is actually on screen.** `Wait+Screen` matches the
    visible buffer, so a card kicker inside a tall card that renders below the
    fold never matches. Prefer a footer or composer string that is always
    visible.
15. **A modal you did not know about looks exactly like a hang.** The
    Explorer's explain flow opens a cost-approval modal (`EXPLAIN THIS
    CONTRACT?` / `[enter] run`); a tape that never presses Enter sits at
    `working…` until vhs times out. When a recording stalls, re-run the tape
    with no waits and a fixed `Sleep`, then look at the last frame. Guessing
    cost three failed takes; the diagnostic took one.
12. **Time state changes to their informational value.** Hold confirmations,
    approvals, and results long enough to read the decisive status, then cut
    forward. Do not leave a resolved screen on display merely because the
    recording has spare runtime. Music: trim to video length, `afade` in 0.5s
    / out 3s, and add a matching video `fade=t=out` at the end.

Recording against live mainnet needs: keystore daemon
(`bun run apps/cli/src/index.ts keystore status`), and for AI segments the
configured agent provider (zs-proxy for zerosignal — probe its `/v1/models`).
Good demo IDs: asset `31566704` (USDC), app `1002541853` (Tinyman v2),
txns from `packages/explorer/test/recorded/mainnet-graph-corpus.json`.

## Music

The four site tracks live in `apps/website/public/music/` and are already
credited in `apps/website/src/scripts/music.ts` — use those, do not go find a
new track. Lay them down with `references/add-music.sh`, which trims to the
cut, fades in 0.5s, fades out over the tail, and ducks to 0.85.

Start past a quiet intro rather than opening on nothing. Measured, not
guessed (`ffmpeg -hide_banner -ss N -t 6 -i t.mp3 -af volumedetect -f null
/dev/null` — the default log level, since `-v error` hides the summary):

| track | use |
| --- | --- |
| `retro` | hot from 0 — short clips |
| `neon-drive` | settles at 30s — feature reels |
| `neon-horizon` | quiet intro, start at 15s — long story cuts |
| `80s-retro` | dips around 75s; don't land an ending there |

Keep a silent master of every cut (`out/silent/`) so the track can be swapped
without re-encoding video.

## Tweets

Draft 3–4 options, different angles: one plain statement of the feature, one
pun/structural gag, one user-benefit framing. Recommend one. Keep each under
~200 chars; line breaks are fine, hashtags are not. Match the examples in
`references/tweets.md` before sending anything.

For lore tweets (the /lore page series), the image is a personnel-record card:
`references/make-lore-card.sh` (env-var fields -> 1600x900 png). The quote is
the headline and the name attributes it underneath; the channel/payload/target
telemetry sits below as a muted strip. `QUOTE` splits on `|` and the last line
renders in hero amber, so put the payoff there.

The portrait is a photograph rendered as ASCII — `references/lore-portrait-prep.py`
prep, then `references/lore-ascii.py` to sample it. Tone comes from the
character ramp (`. , : ; + = x X $ & @`) with an amber tint riding the same
value; colour alone cannot separate tones at glyph density.

It has to be a photograph. Three rounds went into hand-drawn vector faces —
flat facets, then soft gradients — and both failed the same way: smooth shading
gives the ramp almost nothing inside the skin, so the face flattens to one
glyph and reads as a blob. Photographic micro-variation is the whole mechanism.
Prep matters too: pull luminance from the RED channel, because a cool studio
backdrop and warm hair collapse to the same grey, and lift the black point
until the backdrop is truly black or it renders as a field of punctuation
competing with the face.

Everyone in the Directorate sits for the same portrait, so one face serves the
series. Current source: a royalty-free Pexels portrait supplied by Gabe on
2026-08-27 — record the photographer credit alongside it before this ships
anywhere public.
