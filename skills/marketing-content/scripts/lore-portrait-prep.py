#!/usr/bin/env python3
"""Prepare a photograph as the lore card's portrait source.

    lore-portrait-prep.py in.jpg out.png [BLACK] [WHITE]

Crops head-and-shoulders, then lifts the black point so the backdrop falls to
true black. That matters more than it sounds: the converter maps brightness to
glyph density, so any backdrop above black becomes a field of punctuation
competing with the face. The vignette does the same job at the corners.

Luminance comes from the RED channel, not a grey conversion. Studio backdrops
are usually cool and skin and warm hair are not, so red separates subject from
wall where grey collapses them — on the shot this was built for, the wall and
the shadowed hair sit within two levels of each other in grey.
"""
import sys
from PIL import Image, ImageDraw, ImageFilter

src, dst = sys.argv[1], sys.argv[2]
black = int(sys.argv[3]) if len(sys.argv) > 3 else 38
white = int(sys.argv[4]) if len(sys.argv) > 4 else 252

im = Image.open(src).convert("RGB").split()[0]   # red channel; see docstring
w, h = im.size
cw = int(h * 0.70)                 # 4:5, top-anchored — the crown matters, the shoulders do not
cx = int(w * 0.500)
im = im.crop((cx - cw // 2, 0, cx + cw // 2, min(h, int(cw * 1.25)))).resize((620, 775), Image.LANCZOS)

im = im.point(lambda v: max(0, min(255, round((v - black) * 255 / (white - black)))))

w, h = im.size
mask = Image.new("L", (w, h), 0)
ImageDraw.Draw(mask).ellipse((-w * 0.34, -h * 0.26, w * 1.34, h * 1.26), fill=255)
mask = mask.filter(ImageFilter.GaussianBlur(w * 0.10))
im = Image.composite(im, Image.new("L", (w, h), 0), mask)
im.save(dst, optimize=True)
print(dst, im.size)
