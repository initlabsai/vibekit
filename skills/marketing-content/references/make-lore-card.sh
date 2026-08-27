#!/usr/bin/env bash
# Lore dossier card for tweets: HTML -> headless chromium -> 1600x900 png.
# House style from make-card.sh (brass top rule, spaced kicker, scanlines), laid
# out as a personnel record from the 2036 transmission archive. The quote is the
# headline; the name attributes it and the telemetry sits under it as a whisper.
#
#   NAME="Dr. Vera Solano" ROLE="DIRECTOR, RETROCAUSAL PAYLOAD" \
#   SUB="signed the order to send VibeKit backwards." \
#   QUOTE="I sent one sentence|into a decade of silence,|and a stranger finished it." \
#   META="CHANNEL=entangled pair 004;PAYLOAD=one (1) prompt" \
#   make-lore-card.sh out.png
#
# QUOTE splits on `|`; the last line renders in hero amber, so put the payoff
# there. Optional: KICKER, DATE, CAP, FOOT_L, FOOT_R, W/H.
#
# The face is lore-mask.svg — flat polygons, the editable source — rendered to
# ASCII by lore-ascii.py. Everyone in the Directorate sits for the same portrait,
# so one face serves the series and the name carries the character.
set -eu
OUT="$1"
KICKER="${KICKER:-PRIOR ART DIRECTORATE // PERSONNEL 001}"; DATE="${DATE:-2036-02-11}"
FOOT_L="${FOOT_L:-END OF TRANSMISSION}"; FOOT_R="${FOOT_R:-MAKE IT UBIQUITOUS}"
CAP="${CAP:-ARCHIVE PORTRAIT // 4,096 BITS}"; W="${W:-1600}"; H="${H:-900}"
DIR=$(cd "$(dirname "$0")" && pwd)
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT

MASK=$(python3 "$DIR/lore-ascii.py" ${COLS:-58})

QH=""; IFS='|' read -ra QL <<< "${QUOTE:-}"
for i in "${!QL[@]}"; do
  if [ "$i" -eq $(( ${#QL[@]} - 1 )) ]; then QH+="<b>${QL[i]}</b>"; else QH+="${QL[i]}<br>"; fi
done

STRIP=""; IFS=';' read -ra PAIRS <<< "${META:-}"
for p in "${PAIRS[@]}"; do
  [ -z "$p" ] && continue
  [ -n "$STRIP" ] && STRIP+="<em>&middot;</em>"
  STRIP+="<b>${p%%=*}</b> ${p#*=}"
done

cat > "$TMP/c.html" <<HTML
<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0}
body{background:#0a0b0e;color:#e9e1d4;width:${W}px;height:${H}px;overflow:hidden;
 font-family:"JetBrainsMono Nerd Font","JetBrains Mono",monospace}
.card{border-top:8px solid #c4a06a;height:100%;padding:52px 76px 48px;position:relative;
 display:flex;flex-direction:column;justify-content:space-between}
.card::after{content:"";position:absolute;inset:0;pointer-events:none;
 background:repeating-linear-gradient(180deg,rgba(255,255,255,.03) 0 1px,transparent 1px 3px)}
.bar{display:flex;justify-content:space-between;color:#c4a06a;font-size:21px;font-weight:700;letter-spacing:.16em}
.bar .dim{color:#605c56}
.body{display:flex;gap:70px;align-items:center;flex:1;padding:26px 0}
.frame{border:1px solid #2a251d;padding:16px 20px;background:#0d0f13}
.frame pre{font-size:13px;line-height:13px;white-space:pre}
.cap{color:#4f4b45;font-size:14px;letter-spacing:.14em;margin-top:14px;text-align:center}
blockquote{font-size:42px;line-height:1.36;letter-spacing:-.035em;text-indent:-.55em}
blockquote b{color:#ffb454;font-weight:inherit}
.by{margin-top:44px;border-left:2px solid #c4a06a;padding-left:22px}
.by h1{font-size:29px;font-weight:500;letter-spacing:-.02em}
.by .role{color:#c4a06a;font-size:17px;font-weight:700;letter-spacing:.16em;margin-top:9px}
.by .sub{color:#8e8476;font-size:19px;margin-top:7px}
.strip{margin-top:30px;color:#5c574f;font-size:15px;letter-spacing:.04em}
.strip b{color:#8a7048;font-weight:700;letter-spacing:.14em}
.strip em{color:#3a352c;font-style:normal;padding:0 .55em}
</style></head><body><div class="card">
  <p class="bar"><span>$KICKER</span><span class="dim">$DATE</span></p>
  <div class="body">
    <div>
      <div class="frame"><pre>$MASK</pre></div>
      <p class="cap">$CAP</p>
    </div>
    <div>
      <blockquote>&ldquo;$QH&rdquo;</blockquote>
      <div class="by">
        <h1>${NAME:-}</h1>
        <p class="role">${ROLE:-}</p>
        <p class="sub">${SUB:-}</p>
      </div>
      <p class="strip">$STRIP</p>
    </div>
  </div>
  <p class="bar"><span>$FOOT_L</span><span class="dim">$FOOT_R</span></p>
</div></body></html>
HTML
chromium --headless --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
  --window-size=$W,$H --screenshot="$OUT" "file://$TMP/c.html" 2>/dev/null
echo "wrote $OUT"
