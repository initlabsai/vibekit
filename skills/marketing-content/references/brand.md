# Brand

## Palette

Init Labs amber-phosphor. Two hues and a ground: **amber is structure and
figures, teal is alive and touchable, red is danger only.** A card that tints
something teal because teal is pretty has broken the system — teal means the
thing responds.

The source of truth is `apps/tui/src/theme.ts`. It is mirrored for rendering
in `assets/card.css` as CSS variables; use the variables, not pasted hex, so
one edit moves every card.

| role | var | hex |
|---|---|---|
| ground (terminal background) | `--ground` | `#0a0b0e` |
| card surface | `--surface` | `#111318` |
| brass — structure, rules, kickers | `--brass` | `#c4a06a` |
| hero — the payoff, one per card | `--hero` | `#ffb454` |
| teal — signal, live, touchable | `--teal` | `#6fd3d3` |
| text — warm neutral | `--text` | `#e9e1d4` |
| muted | `--muted` | `#8e8476` |
| dim | `--dim` | `#605c56` |
| danger, only | `--danger` | `#e07c7c` |

**Sample, don't assume.** When a graphic sits against real footage, pull the
background out of an actual rendered frame rather than trusting the theme
value — terminal emulators and encoders both shift it slightly, and a card
that is 2% off the footage shows a visible seam at the cut.

## Type

JetBrains Mono, everywhere, including title cards — the graphics should read
as part of the terminal rather than as slides about the terminal.

Resolve the installed family with `fc-match "JetBrains Mono"` and use the name
it reports (currently `JetBrainsMono Nerd Font`). A guessed family name fails
silently into sans-serif, which is the single most common way a card ends up
looking wrong for reasons nobody can name.

The kaomoji live in this font too. Measure them in a rendered frame, never by
eye in a text editor — the wide faces (`(>'-')>`, `\(^▽^)/`) run into adjacent
copy at sizes that look fine in source.

## Card grammar

The house style, shared by every rendered graphic:

- a **brass top rule** (8px) across the full width
- a **spaced brass kicker** in caps — `2026 // TRANSMISSION RECEIVED`,
  `PRIOR ART DIRECTORATE // PERSONNEL 001`
- **one statement** in warm neutral, with the payoff line in hero amber.
  One hero line per card; a second one means neither is the payoff.
- **CSS scanlines**, low opacity, deliberately visible
- one visual idea per card

Keep archival/CRT treatment (hairline frames, scanlines, non-semantic
telemetry) on the cards, not on live TUI footage. The footage is already the
real thing; dressing it up reads as not trusting it. And check the effect
*after* final encoding — compression erases subtle scanlines, so what you
tuned at source may not survive to the upload.

## Sizes

| asset | size | notes |
|---|---|---|
| TUI recording | 1400×1150 | the tape's terminal, not a video size |
| video, 16:9 | 1920×1080 | title cards match the segment they cut against |
| tweet loop | 1200×675 | GIF only — odd height; pad to 676 for mp4 |
| OG / link preview | 1200×630 | `PNG=1` mode of `make-card.sh` |
| lore dossier card | 1600×900 | `make-lore-card.sh` default |

Two sizing traps, both cost a re-render:

- **libx264 refuses odd heights.** 1200×675 will not encode. Pad to 676 or
  shoot 1920×1080.
- **Match the card to the tape.** Letterboxing a 1400×1150 terminal into a
  16:9 card throws away half the frame. Pass `W=1400 H=1150` to
  `make-card.sh` when cutting against a tape of that size; the type scales
  with the frame so it isn't a blown-up 1920 card.

## Music

Four tracks, in `apps/website/public/music/`, already credited in
`apps/website/src/scripts/music.ts`. Use them; don't go find a new track.
`scripts/add-music.sh` lays one down — trims to the cut, fades in 0.5s, fades
out over the tail, ducks to 0.85.

Start past a quiet intro rather than opening on nothing. These offsets were
measured, not guessed (`ffmpeg -hide_banner -ss N -t 6 -i t.mp3 -af
volumedetect -f null /dev/null` — needs the default log level; `-v error`
hides the summary):

| track | use |
|---|---|
| `retro` | hot from 0 — short clips |
| `neon-drive` | settles at 30s — feature reels |
| `neon-horizon` | quiet intro, start at 15s — long story cuts |
| `80s-retro` | dips around 75s; don't land an ending there |
