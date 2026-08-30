#!/usr/bin/env python3
"""Render a portrait photograph as ASCII. Prints HTML for a <pre>.

    lore-ascii.py [cols] [image]        default: 76, ../assets/lore-portrait.png

Run the photo through lore-portrait-prep.py first — this stage does no
correction, it only samples. Tone comes from the character ramp, not from
colour: each cell picks a glyph by the mean brightness of the image block under
it and takes an amber tint from the same value. Colour alone cannot separate
tones at glyph density, which is why a flat-shaded vector source never worked
here; a photograph carries the micro-variation the ramp needs.
"""
import sys, pathlib
from PIL import Image, ImageOps

ASPECT = 0.6                      # JetBrains Mono advance width, in em; cell height == font-size
RAMP = " .,:;+=xX$&@"             # darkest first
TINTS = ["#5f4c2f", "#7c6340", "#c4a06a", "#e2c795", "#ffb454"]

cols = int(sys.argv[1]) if len(sys.argv) > 1 else 76
src = sys.argv[2] if len(sys.argv) > 2 else pathlib.Path(__file__).parent.parent / "assets" / "lore-portrait.png"

img = ImageOps.autocontrast(Image.open(src).convert("L"), cutoff=0)
rows = max(1, round(cols * ASPECT * img.height / img.width))
img = img.resize((cols, rows), Image.BOX)          # box average == one sample per cell

out = []
for y in range(rows):
    line, run, tint = "", "", None
    for x in range(cols):
        v = img.getpixel((x, y)) / 255
        if (t := TINTS[min(len(TINTS) - 1, int(v * len(TINTS)))]) != tint:
            if run:
                line += run if not run.strip() else f'<span style="color:{tint}">{run}</span>'
            run, tint = "", t
        run += RAMP[min(len(RAMP) - 1, int(v * len(RAMP)))]
    if run:
        line += run if not run.strip() else f'<span style="color:{tint}">{run}</span>'
    out.append(line.rstrip())
while out and not out[-1]:
    out.pop()
print("\n".join(out))
