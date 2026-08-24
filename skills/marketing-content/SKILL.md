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
ffmpeg commands).

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
9. **Title cards must look native to the terminal.** Use the same monospace
   family and palette as the recording. A static card is usually ~2s: one
   visual idea, one big line, and at most one muted subtitle.
10. **Typewriter cards must remain readable at every frame.** Keep the copy
    compact (normally 3–5 short lines), reveal it at a human-readable pace,
    and render each completed line continuously while the next one types. Do
    not clear text between events or simulate typing with brief, discontinuous
    captions. After the final character, hold the complete card for at least
    ~1s before cutting. Inspect one in-progress frame and one completed frame
    in the encoded master.
11. **Time state changes to their informational value.** Hold confirmations,
    approvals, and results long enough to read the decisive status, then cut
    forward. Do not leave a resolved screen on display merely because the
    recording has spare runtime. Music: trim to video length, `afade` in 0.5s
    / out 3s, and add a matching video `fade=t=out` at the end.

Recording against live mainnet needs: keystore daemon
(`bun run apps/cli/src/index.ts keystore status`), and for AI segments the
configured agent provider (zs-proxy for zerosignal — probe its `/v1/models`).
Good demo IDs: asset `31566704` (USDC), app `1002541853` (Tinyman v2),
txns from `packages/explorer/test/recorded/mainnet-graph-corpus.json`.

## Tweets

Draft 3–4 options, different angles: one plain statement of the feature, one
pun/structural gag, one user-benefit framing. Recommend one. Keep each under
~200 chars; line breaks are fine, hashtags are not. Match the examples in
`references/tweets.md` before sending anything.
