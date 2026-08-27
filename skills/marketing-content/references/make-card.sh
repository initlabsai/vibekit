#!/usr/bin/env bash
# Title cards, the good way: HTML -> headless chromium -> png -> mp4.
# ffmpeg drawtext cards look like slides; this looks like the website.
#
#   make-card.sh out.mp4 "KICKER" "line one" "amber line two" [seconds] [center|split]
#
# The 4th arg renders in hero amber under the 3rd; pass "" to omit.
# W/H env vars set the frame (default 1920x1080). Match them to the vhs tape
# size — letterboxing a 1400x1150 terminal into 16:9 throws away half the frame.
#   W=1400 H=1150 make-card.sh ...
set -eu
OUT="$1"; KICKER="$2"; LINE1="$3"; LINE2="${4:-}"; DUR="${5:-2.5}"; MODE="${6:-split}"
W="${W:-1920}"; H="${H:-1080}"
# type scales with frame width so a 1400px card is not a blown-up 1920 one
FS=$(awk "BEGIN{printf \"%d\", 78*$W/1920}"); KS=$(awk "BEGIN{printf \"%d\", 26*$W/1920}")
PAD=$(awk "BEGIN{printf \"%d\", 110*$W/1920}"); PADX=$(awk "BEGIN{printf \"%d\", 130*$W/1920}")
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
JUSTIFY=$([ "$MODE" = center ] && echo center || echo space-between)
AMBER=""
[ -n "$LINE2" ] && AMBER="<br><span style=\"color:#ffb454\">$LINE2</span>"

cat > "$TMP/c.html" <<HTML
<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0}
body{background:#0a0b0e;color:#e9e1d4;height:${H}px;width:${W}px;overflow:hidden;
 font-family:"JetBrainsMono Nerd Font","JetBrains Mono",monospace}
.card{border-top:8px solid #c4a06a;height:100%;padding:${PAD}px ${PADX}px;position:relative;
 display:flex;flex-direction:column;justify-content:$JUSTIFY}
/* scanlines: 1px lit, 2px gap. Survives x264 over type; vanishes on black, which is correct. */
.card::after{content:"";position:absolute;inset:0;pointer-events:none;
 background:repeating-linear-gradient(180deg,rgba(255,255,255,.025) 0 1px,transparent 1px 3px)}
.kicker{color:#c4a06a;font-size:${KS}px;font-weight:700;letter-spacing:.16em}
.stmt{font-size:${FS}px;font-weight:500;letter-spacing:-.045em;line-height:1.34}
</style></head><body><div class="card">
  <p class="kicker">$KICKER</p>
  <div><p class="stmt">$LINE1$AMBER</p></div>
  <p class="kicker" style="color:#605c56">&nbsp;</p>
</div></body></html>
HTML

chromium --headless --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
  --window-size=$W,$H --screenshot="$TMP/c.png" "file://$TMP/c.html" 2>/dev/null
FO=$(awk "BEGIN{printf \"%.2f\", $DUR-0.25}")
ffmpeg -y -loglevel error -loop 1 -t "$DUR" -i "$TMP/c.png" \
  -vf "fps=30,fade=t=in:d=0.25,fade=t=out:st=$FO:d=0.25,format=yuv420p" \
  -c:v libx264 -crf 18 -preset slow "$OUT"
echo "wrote $OUT"
