#!/usr/bin/env python3
"""Rasterize lore-mask.svg into ASCII. Prints HTML for a <pre>.

The SVG polygons stay the editable source; this is the render. Each facet gets
ONE character for its whole area, so every plane stays flat — no dithering. The
character still has to track the fill's brightness: colour alone does not
separate tones at glyph density, and a face rendered in a single glyph reads as
a blob. Hence the ramp `. : + # @` over the five fills, darkest first.

    lore-ascii.py [cols]      (rows follow from the 200x230 viewBox)
"""
import itertools, re, sys, pathlib

VB_W, VB_H = 200, 230
ASPECT = 0.6  # JetBrains Mono advance width, in em. Cell height == font-size.
CHARS = {"#5f4c2f": ".", "#7c6340": ":", "#c4a06a": "+", "#e2c795": "#", "#ffb454": "@"}

cols = int(sys.argv[1]) if len(sys.argv) > 1 else 44
rows = round(cols * ASPECT * VB_H / VB_W)
svg = (pathlib.Path(__file__).parent / "lore-mask.svg").read_text()
facets = [
    ([tuple(map(float, p.split(","))) for p in pts.split()], fill)
    for pts, fill in re.findall(r'points="([^"]+)"\s+fill="([^"]+)"', svg)
]

def inside(pt, poly):
    x, y = pt
    hit = False
    for i in range(len(poly)):
        (x1, y1), (x2, y2) = poly[i - 1], poly[i]
        if (y1 > y) != (y2 > y) and x < x1 + (y - y1) * (x2 - x1) / (y2 - y1):
            hit = not hit
    return hit

out = []
for r in range(rows):
    y = (r + 0.5) * VB_H / rows
    cells = []
    for c in range(cols):
        x = (c + 0.5) * VB_W / cols
        fill = next((f for poly, f in reversed(facets) if inside((x, y), poly)), None)
        cells.append((CHARS.get(fill, " "), fill))
    line = ""
    for fill, run in itertools.groupby(cells, key=lambda t: t[1]):
        text = "".join(ch for ch, _ in run)
        line += text if fill is None or text.isspace() else f'<span style="color:{fill}">{text}</span>'
    out.append(line.rstrip())
while out and not out[-1]:
    out.pop()
print("\n".join(out))
