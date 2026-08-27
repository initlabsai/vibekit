#!/usr/bin/env bun
// Phosphor portrait in block glyphs for lore cards. `lore-portrait.mjs [seed]`
// The lore says the channel carried a few thousand bits, so the image is meant
// to look barely reconstructed. Seed varies the head so a series isn't one face.
const seed = Number(process.argv[2] ?? 0);
const r = (n) => ((Math.sin(seed * 12.9898 + n * 78.233) + 1) / 2);
const W = 34, H = 23, ramp = [' ', '░', '▒', '▓', '█'];
const rx = 6.6 + r(1) * 1.4, hair = 8 + r(2) * 3, brow = 14 + r(3) * 1.5;
const rows = [];
for (let y = 0; y < H; y++) {
  let line = '';
  for (let x = 0; x < W; x++) {
    const px = x + 0.5, py = (y + 0.5) * 1.9;
    let shade = 0;
    const hx = (px - 17) / rx, hy = (py - 17) / 15, d = hx * hx + hy * hy;
    if (d <= 1) {
      const nz = Math.sqrt(Math.max(0, 1 - d));
      shade = 1 + Math.round(Math.min(1, Math.max(0, 0.02 - hx * 0.26 - hy * 0.16 + nz * 0.52)) * 3);
      if (py < hair || d > 0.9) shade = 4;
      if (py > brow && py < brow + 2.5 && (Math.abs(px - 14) < 1.4 || Math.abs(px - 20) < 1.4)) shade = 0;
      if (py > 26 && py < 28.5 && Math.abs(px - 17) < 2.6) shade = 1;
    }
    if (py > 30 && py < 36 && Math.abs(px - 17) < 2.6) shade = 3;
    const sy = (py - 56) / (22 + r(4) * 5), sx = (px - 17) / 17;
    if (py >= 34 && sx * sx + sy * sy <= 1) shade = px < 16 ? 4 : 3;
    line += ramp[shade];
  }
  rows.push(line.replace(/\s+$/, ''));
}
// channel dropout — kept off the face, or it reads as a second pair of eyes.
rows[17] = rows[17].replace(/./g, (c, i) => (i % 3 ? c : ' '));
rows[20] = rows[20].replace(/./g, (c, i) => (i % 5 === 0 ? '░' : c));
console.log(rows.join('\n'));
