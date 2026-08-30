---
name: marketing-content
internal: true
description: Make any vibekit or qt314 promotional asset — tweets and threads, promo videos of the TUI, title cards, OG/link-preview images, quote cards, lore dossier cards, qt314 animations, GIFs, and TUI screenshots — in the vibekit voice and on the brand palette. Use whenever asked to write social copy, announce or launch something, draft a tweet/thread/dev-diary post, make a promo or demo video, produce any image or video destined for social media, or use vibekit's colors, fonts, or kaomoji.
---

# vibekit marketing content

Everything that goes out in public: the copy, the images, the video. One voice
across all of it, because a follower sees the tweet and the card in the same
scroll — if they sound like different companies, the brand is doing nothing.

## Pick your asset

Read the linked file before making the thing; each has the recipe and the
failure modes.

| you want | read | make it with |
|---|---|---|
| tweet, thread, dev diary, announcement, reply | `references/voice.md` | — |
| promo or demo video of the TUI | `references/video.md` | `scripts/*.tape` + ffmpeg |
| title card between video segments | `references/cards.md` | `scripts/make-card.sh` |
| OG / link-preview image, quote card | `references/cards.md` | `PNG=1 scripts/make-card.sh` |
| lore dossier card (the /lore series) | `references/cards.md` | `scripts/make-lore-card.sh` |
| qt314 animation, GIF loop | `references/qt314.md` | `scripts/qt314-*.py` |
| a still of the TUI | `references/cards.md` | a one-line vhs tape |
| colors, fonts, sizes | `references/brand.md` | `assets/card.css` |

Everything visual is HTML → headless chromium → png, then ffmpeg if it moves.
That is one pipeline with different templates, not four pipelines, and it is
why a still and a video card can't drift apart. Never hand-roll an ffmpeg
`drawtext` card because it looks quicker — it is, and it looks it.

## Preflight

Check before starting, not after a failed take:

- `vhs` **and** `ttyd` — vhs fails every recording with "ttyd is not installed"
  and the message arrives after you've written the whole tape.
- `chromium`, `ffmpeg`, `python3` — the card and qt314 renderers.
- JetBrains Mono. Resolve the family with `fc-match "JetBrains Mono"` and use
  the name it reports (currently `JetBrainsMono Nerd Font`); an assumed family
  name silently falls back to sans-serif and the card stops looking like a
  terminal.
- Recording live mainnet also needs the keystore daemon
  (`bun run apps/cli/src/index.ts keystore status`), and AI segments need the
  configured agent provider reachable (probe zs-proxy's `/v1/models`).

Finished assets go in `out/` at the repo root — gitignored, and they stay that
way. Never commit a video. Work files (tapes, frames, QA stills) go in a temp
dir. Keep a silent master of every cut in `out/silent/` so a track can be
swapped without re-encoding video.

## Voice, in one paragraph

lowercase, short, one idea per post. Say the mechanism, not the adjective —
"the keys never left the OS keychain" beats "secure key management", because
the mechanism is the thing that's actually impressive. Alpha is stated as a
feature, not apologized for. Kaomoji are vocabulary, not decoration, and
qt314 is a character with her own register who signs her own posts. No
hashtags, no "please check out", no visible effort to meme — if the joke needs
explaining, cut it. `references/voice.md` has the corpus, the sigils, the
thread format, and the drafts that get rejected; read it before writing copy,
including image copy.

## Brand, in one paragraph

Two hues and a ground: amber is structure and figures, teal is alive and
touchable, red is danger only and never decoration. The palette's source of
truth is `apps/tui/src/theme.ts`, mirrored for rendering in `assets/card.css`
— use the CSS variables rather than pasting hex, so a theme change doesn't
leave stale cards behind. Everything is monospace, title cards included, so
the graphics read as part of the terminal. `references/brand.md` has the
values, sizes, and card grammar.

## Reference images

When an asset needs a photograph (the lore portraits are the current case),
ask the user for a royalty-free image rather than sourcing one. Save the
credit next to the file when the license asks for attribution.
