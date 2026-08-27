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
#
# The statement glitches like the site hero: two clipped copies of the text,
# teal and hero amber, offset sideways and flashed for a frame or two. CSS
# animation can't be screenshotted, so each glitch state is rendered as its own
# frozen PNG and cut in on chosen frames. GLITCH=0 disables.
set -eu
OUT="$1"; KICKER="$2"; LINE1="$3"; LINE2="${4:-}"; DUR="${5:-2.5}"; MODE="${6:-split}"
W="${W:-1920}"; H="${H:-1080}"; GLITCH="${GLITCH:-1}"; FPS=30
# type scales with frame width so a 1400px card is not a blown-up 1920 one
FS=$(awk "BEGIN{printf \"%d\", 78*$W/1920}"); KS=$(awk "BEGIN{printf \"%d\", 26*$W/1920}")
PAD=$(awk "BEGIN{printf \"%d\", 110*$W/1920}"); PADX=$(awk "BEGIN{printf \"%d\", 130*$W/1920}")
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
JUSTIFY=$([ "$MODE" = center ] && echo center || echo space-between)
AMBER=""; PLAIN="$LINE1"
[ -n "$LINE2" ] && { AMBER="<br><span style=\"color:#ffb454\">$LINE2</span>"; PLAIN="$LINE1<br>$LINE2"; }

# clip-path inset + x/y offset per glitch state, mirroring site.css glitch-a/b.
STATES=(
  "inset(20% 0 55% 0)|-9px|0|#6fd3d3"
  "inset(60% 0 10% 0)|7px|2px|#ffb454"
  "inset(5% 0 80% 0)|6px|0|#6fd3d3"
  "inset(45% 0 30% 0)|-11px|1px|#ffb454"
  "inset(70% 0 5% 0)|5px|0|#6fd3d3"
)

render() { # $1=out.png  $2=ghost css (empty for base)
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
.wrap{position:relative}
.stmt{font-size:${FS}px;font-weight:500;letter-spacing:-.045em;line-height:1.34}
.ghost{position:absolute;top:0;left:0;pointer-events:none}
$2
</style></head><body><div class="card">
  <p class="kicker">$KICKER</p>
  <div class="wrap">
    <p class="stmt">$LINE1$AMBER</p>
    <p class="stmt ghost" id="g">$PLAIN</p>
  </div>
  <p class="kicker" style="color:#605c56">&nbsp;</p>
</div></body></html>
HTML
  chromium --headless --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --window-size=$W,$H --screenshot="$1" "file://$TMP/c.html" 2>/dev/null
}

render "$TMP/base.png" "#g{opacity:0}"
if [ "$GLITCH" = 1 ]; then
  i=0
  for s in "${STATES[@]}"; do
    IFS='|' read -r clip dx dy col <<< "$s"
    render "$TMP/g$i.png" "#g{opacity:1;color:$col;clip-path:$clip;transform:translate($dx,$dy)}"
    i=$((i+1))
  done
fi

# Frame list: base everywhere, glitch states cut in for 1-2 frames at ~8%, ~42%, ~74%.
TOTAL=$(awk "BEGIN{printf \"%d\", $DUR*$FPS}")
LIST="$TMP/frames.txt"; : > "$LIST"
pick() { # frame index -> png
  n=$1
  if [ "$GLITCH" = 1 ]; then
    a=$(awk "BEGIN{printf \"%d\", $TOTAL*0.10}"); b=$(awk "BEGIN{printf \"%d\", $TOTAL*0.44}"); c=$(awk "BEGIN{printf \"%d\", $TOTAL*0.76}")
    case $n in
      $a|$((a+1))) echo "$TMP/g0.png"; return;;
      $((a+2)))    echo "$TMP/g1.png"; return;;
      $b|$((b+1))) echo "$TMP/g2.png"; return;;
      $c)          echo "$TMP/g3.png"; return;;
      $((c+1)))    echo "$TMP/g4.png"; return;;
    esac
  fi
  echo "$TMP/base.png"
}
n=0
while [ $n -lt "$TOTAL" ]; do
  printf "file '%s'\nduration %s\n" "$(pick $n)" "$(awk "BEGIN{print 1/$FPS}")" >> "$LIST"
  n=$((n+1))
done
printf "file '%s'\n" "$(pick $((TOTAL-1)))" >> "$LIST"

FO=$(awk "BEGIN{printf \"%.2f\", $DUR-0.25}")
ffmpeg -y -loglevel error -f concat -safe 0 -i "$LIST" \
  -vf "fps=$FPS,fade=t=in:d=0.25,fade=t=out:st=$FO:d=0.25,format=yuv420p" \
  -c:v libx264 -crf 18 -preset slow "$OUT"
echo "wrote $OUT"
