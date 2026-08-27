#!/usr/bin/env bash
# Lore dossier card for tweets: HTML -> headless chromium -> 1600x900 png.
# Same house style as make-card.sh (brass top rule, spaced kicker, scanlines),
# laid out as a personnel record from the 2036 transmission archive.
#
#   NAME="Dr. N. Bittencourt" ROLE="DIRECTOR, RETROCAUSAL PAYLOAD" \
#   SUB="signed the order to send VibeKit backwards." \
#   META="CHANNEL=entangled pair 004;PAYLOAD=one (1) prompt" \
#   QUOTE="we could not send the software.|so we sent the instructions." \
#   make-lore-card.sh out.png
#
# Optional: KICKER, DATE, CAP, FOOT_L, FOOT_R, W/H.
# The face is lore-mask.txt: the Directorate wears masks, so every card shares it
# and the character is carried by the name and role. `@` cells become lit eyes.
set -eu
OUT="$1"
KICKER="${KICKER:-PRIOR ART DIRECTORATE // PERSONNEL 001}"; DATE="${DATE:-2036-02-11}"
FOOT_L="${FOOT_L:-END OF TRANSMISSION}"; FOOT_R="${FOOT_R:-MAKE IT UBIQUITOUS}"
W="${W:-1600}"; H="${H:-900}"; CAP="${CAP:-IDENTITY WITHHELD // MASK ON FILE}"
DIR=$(cd "$(dirname "$0")" && pwd)
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT

PORTRAIT=$(sed 's|@|<i>█</i>|g' "$DIR/lore-mask.txt")
ROWS=""; IFS=';' read -ra PAIRS <<< "${META:-}"
for p in "${PAIRS[@]}"; do
  [ -z "$p" ] && continue
  ROWS+="<b>${p%%=*}</b><span>${p#*=}</span>"
done
QL=${QUOTE:-}; QUOTE_HTML="${QL//|/<br>}"

cat > "$TMP/c.html" <<HTML
<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0}
body{background:#0a0b0e;color:#e9e1d4;width:${W}px;height:${H}px;overflow:hidden;
 font-family:"JetBrainsMono Nerd Font","JetBrains Mono",monospace}
.card{border-top:8px solid #c4a06a;height:100%;padding:56px 76px 52px;position:relative;
 display:flex;flex-direction:column;justify-content:space-between}
.card::after{content:"";position:absolute;inset:0;pointer-events:none;
 background:repeating-linear-gradient(180deg,rgba(255,255,255,.03) 0 1px,transparent 1px 3px)}
.bar{display:flex;justify-content:space-between;color:#c4a06a;font-size:21px;font-weight:700;letter-spacing:.16em}
.bar .dim{color:#605c56}
.body{display:flex;gap:64px;align-items:center;flex:1;padding:34px 0}
.frame{border:1px solid #3a352c;padding:22px 26px;background:#111318}
.frame pre{color:#c4a06a;font-size:26px;line-height:26px;white-space:pre;
 text-shadow:0 0 14px rgba(196,160,106,.35)}
.frame i{color:#ffb454;font-style:normal;text-shadow:0 0 18px rgba(255,180,84,.9)}
.cap{color:#605c56;font-size:15px;letter-spacing:.14em;margin-top:14px;text-align:center}
.role{color:#c4a06a;font-size:21px;font-weight:700;letter-spacing:.16em}
h1{font-size:76px;font-weight:500;letter-spacing:-.045em;line-height:1.1;margin:.18em 0 .1em}
.sub{color:#8e8476;font-size:24px}
.meta{margin-top:40px;border-left:2px solid #c4a06a;padding-left:22px;
 display:grid;grid-template-columns:auto 1fr;gap:10px 26px;font-size:22px;color:#8e8476}
.meta b{color:#c4a06a;font-weight:700;letter-spacing:.14em;font-size:19px;align-self:center}
.quote{margin-top:42px;color:#ffb454;font-size:34px;line-height:1.42;letter-spacing:-.02em}
</style></head><body><div class="card">
  <p class="bar"><span>$KICKER</span><span class="dim">$DATE</span></p>
  <div class="body">
    <div>
      <div class="frame"><pre>$PORTRAIT</pre></div>
      <p class="cap">$CAP</p>
    </div>
    <div>
      <p class="role">${ROLE:-}</p>
      <h1>${NAME:-}</h1>
      <p class="sub">${SUB:-}</p>
      <div class="meta">$ROWS</div>
      <p class="quote">&ldquo;$QUOTE_HTML&rdquo;</p>
    </div>
  </div>
  <p class="bar"><span>$FOOT_L</span><span class="dim">$FOOT_R</span></p>
</div></body></html>
HTML
chromium --headless --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
  --window-size=$W,$H --screenshot="$OUT" "file://$TMP/c.html" 2>/dev/null
echo "wrote $OUT"
