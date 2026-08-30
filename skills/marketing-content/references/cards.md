# Cards and stills

Every graphic here is HTML → headless chromium → png, then ffmpeg only if it
moves. Same shell (`assets/card.css`), same grammar (`brand.md`), so a video
card and a link preview are visibly the same object.

The copy on a card is copy — `voice.md` applies to it exactly as it does to a
tweet.

## Title cards (video)

```sh
make-card.sh out.mp4 "KICKER" "line one" "amber line two" [seconds] [center|split]
W=1400 H=1150 make-card.sh ...    # match the tape you're cutting against
GLITCH=0 make-card.sh ...         # disable the glitch flash
```

The 4th argument renders in hero amber under the 3rd — that's the payoff line.
Pass `""` to omit it.

House shape: brass top rule, spaced brass kicker (`2026 // TRANSMISSION
RECEIVED`), one statement in warm neutral with the payoff in amber, scanlines.
One idea, ~2.5s.

The statement glitches like the site hero — two clipped copies of the text,
teal and hero amber, offset sideways and flashed for a frame or two. CSS
animation can't be screenshotted, so each glitch state renders as its own
frozen PNG and cuts in on chosen frames.

**Typewriter cards must be readable at every frame.** If a card types itself
in, keep the copy compact (3–5 short lines), reveal at human reading pace, and
keep every completed line on screen while the next one types — do not clear
between events or simulate typing with brief discontinuous captions. Hold the
finished card ~1s before cutting. Inspect one in-progress frame and one
completed frame *in the encoded master*, not in the source PNGs.

## OG images and quote cards

Same script, `PNG=1`, which stops at the still:

```sh
PNG=1 W=1200 H=630 make-card.sh og.png "VIBEKIT // ALPHA" "from prompt" "to mainnet"
```

1200×630 is the link-preview size — it's what `apps/website/public/og-image.png`
is, and what `Landing.astro` declares in `og:image` / `twitter:image`. Scrapers
don't resolve relative paths, so the site passes an absolute URL; if you
replace the OG image, replace the file rather than the URL.

A quote card is the same thing with the quote as the statement and the payoff
clause in amber. Any size works; 1200×630 travels best.

## Lore dossier cards

The /lore series. A personnel record from the 2036 transmission archive: the
quote is the headline, the name attributes it underneath, telemetry sits below
as a muted strip.

```sh
NAME="Dr. Vera Solano" ROLE="DIRECTOR, RETROCAUSAL PAYLOAD" \
SUB="signed the order to send VibeKit backwards." \
QUOTE="I sent one sentence|into a decade of silence,|and a stranger finished it." \
META="CHANNEL=entangled pair 004;PAYLOAD=one (1) prompt" \
make-lore-card.sh out.png
```

`QUOTE` splits on `|` and the last line renders in hero amber — put the payoff
there. Optional: `KICKER`, `DATE`, `CAP`, `FOOT_L`, `FOOT_R`, `COLS`, `W`/`H`.

Pair with a lore-register post (`voice.md`) — played straight, never winking.

### The portrait

A photograph rendered as ASCII: `scripts/lore-portrait-prep.py` to prepare,
then `scripts/lore-ascii.py` to sample it. Tone comes from the character ramp
(`. , : ; + = x X $ & @`) with an amber tint riding the same value — colour
alone cannot separate tones at glyph density.

**It has to be a photograph.** Three rounds went into hand-drawn vector faces —
flat facets, then soft gradients — and both failed identically: smooth shading
gives the ramp almost nothing inside the skin, so the face flattens to one
glyph and reads as a blob. Photographic micro-variation is the entire
mechanism.

Prep matters as much as sampling. Pull luminance from the **red channel** — a
cool studio backdrop and warm hair collapse to the same grey in a standard
luma conversion. Lift the black point until the backdrop is truly black, or it
renders as a field of punctuation competing with the face.

Everyone in the Directorate sits for the same portrait, so one face serves the
whole series and the name carries the character. Ask the user for a
royalty-free photograph rather than sourcing one; keep the credit beside the
file if the license asks for attribution. Current source is
`assets/lore-portrait.png`.

## TUI stills

A screenshot of the real TUI is a one-line tape — worth having, because a
still from the actual product beats a mocked one and takes a minute:

```
Output frame.png
Set Width 1400
Set Height 1150
Set FontSize 20
Set Padding 12
Set Theme { "background": "#0a0b0e", "foreground": "#e9e1d4", "cursor": "#ffb454" }

Hide
Type "bun run apps/tui/src/index.tsx"
Enter
Wait+Screen /Ask anything/
Type "31566704"
Enter
Wait+Screen /USDC/
Show
Screenshot frame.png
```

`Screenshot` filenames can't start with a digit and absolute paths fail — run
vhs from the output dir. Everything under `Hide` is setup the still shouldn't
show.

## GIFs

For tweet loops, render frames then convert with a generated palette —
`paletteuse` without `palettegen` produces visible banding on the amber:

```sh
ffmpeg -y -i frames/%05d.png -vf "palettegen" palette.png
ffmpeg -y -i frames/%05d.png -i palette.png -lavfi "paletteuse" out.gif
```

Post an MP4 alongside for X, which handles it better than a large GIF. See
`qt314.md` — `scripts/qt314-loop.py` is the working example at 1200×675/12fps.
