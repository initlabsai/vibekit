#!/usr/bin/env python3
"""Render a portrait as ASCII. Prints HTML for a <pre>.

    lore-ascii.py [cols] [source]

Source defaults to lore-mask.svg (rendered through headless chromium); pass any
png/jpg to use a photograph instead — a real photo is what makes this read like
a photograph, and the pipeline is the same either way.

Tone comes from the character ramp, not from colour: each cell picks a glyph by
the luminance of the image block under it, then takes an amber tint from the
same value. Colour alone does not separate tones at glyph density.
"""
import subprocess, sys, tempfile, pathlib
from PIL import Image, ImageOps

ASPECT = 0.6                      # JetBrains Mono advance width, in em; cell height == font-size
RAMP = " .,:;+=xX$&@"             # darkest first
TINTS = ["#5f4c2f", "#7c6340", "#c4a06a", "#e2c795", "#ffb454"]
GAMMA = 0.82                      # < 1 lifts midtones so the face keeps detail

cols = int(sys.argv[1]) if len(sys.argv) > 1 else 58
src = pathlib.Path(sys.argv[2] if len(sys.argv) > 2 else pathlib.Path(__file__).parent / "lore-mask.svg")

with tempfile.TemporaryDirectory() as tmp:
    if src.suffix.lower() == ".svg":
        png = pathlib.Path(tmp) / "r.png"
        subprocess.run(["chromium", "--headless", "--disable-gpu", "--hide-scrollbars",
                        "--window-size=800,960", f"--screenshot={png}", f"file://{src.resolve()}"],
                       check=True, capture_output=True)
        src = png
    img = ImageOps.autocontrast(Image.open(src).convert("L"), cutoff=1)

rows = max(1, round(cols * ASPECT * img.height / img.width))
img = img.resize((cols, rows), Image.BOX)          # box average == one sample per cell

out = []
for y in range(rows):
    line, run, tint = "", "", None
    for x in range(cols):
        v = (img.getpixel((x, y)) / 255) ** GAMMA
        ch = RAMP[min(len(RAMP) - 1, int(v * len(RAMP)))]
        t = TINTS[min(len(TINTS) - 1, int(v * len(TINTS)))]
        if t != tint:
            if run:
                line += run if not run.strip() else f'<span style="color:{tint}">{run}</span>'
            run, tint = "", t
        run += ch
    if run:
        line += run if not run.strip() else f'<span style="color:{tint}">{run}</span>'
    out.append(line.rstrip())
while out and not out[-1]:
    out.pop()
print("\n".join(out))
