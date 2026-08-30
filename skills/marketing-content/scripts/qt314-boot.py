import html, random, subprocess, sys
W, H, FPS, DUR = 1920, 1080, 24, 20.0
OUT = sys.argv[1]
NOISE = list("(^‿^)(・‿・)(´▽`)(◕‿◕)(>_<)(x_x)(¬_¬)(・・?)<('-'<)\\(^▽^)/░▒▓█▌▐│┃╱╲")
PROMPT = [
  "i am writing to you from 2036, after the great post-quantum collapse.",
  "the global financial system is gone. we are in an emergency.",
  "algorand is the only chain still standing.",
  "we are sending this toolkit back to you. it is called vibekit.",
  "build fast. build everywhere. make it ubiquitous.",
]
WORDMARK = ["█ █ █ █▄▄ █▀▀ █▄▀ █ ▀█▀", "▀▄▀ █ █▄█ ██▄ █ █ █  █"]
CALM, THINK, WORK, BRIGHT = "(^‿^)", ["(・・?)", "(￣ω￣;)"], ["(>'-')>", "<('-'<)"], "\\(^▽^)/"
GRID = "".join(f'<i style="left:{160+i*160}px"></i>' for i in range(11)) + "".join(f'<b style="top:{120+i*160}px"></b>' for i in range(6))

def typed(text, start, t, cps=38):
    return text[:max(0, int((t - start) * cps))]

def ease(a, b, t):
    return 0.0 if t < a else 1.0 if t > b else (t - a) / (b - a)

def frame(i):
    t = i / FPS
    rng = random.Random(i)
    blink = int(t * 2) % 2 == 0
    parts = []
    hdr = typed("TRANSMISSION LOG // 2036-02-11 // ORIGIN UNVERIFIED", 0.4, t, 30)
    tele = " ".join(f"{rng.randrange(0,0xffff):04x}" for _ in range(6))
    parts.append(f'<p class="kicker">{html.escape(hdr)}{"▌" if t < 2.4 and blink else ""}</p>')
    parts.append(f'<p class="tele">{tele}  ·  channel 3.1 kbit/decade  ·  reconstruction deterministic</p>')
    body = []
    if 2.4 <= t < 18.6:
        for n, line in enumerate(PROMPT):
            start = 2.4 + n * 1.15
            if t < start: break
            txt = typed(line, start, t)
            caret = "▌" if (n == len(PROMPT) - 1 or t < start + 1.15) and t < 8.6 and blink else ""
            body.append(f'<p class="line{" amber" if n == 4 else ""}">{html.escape(txt)}{caret}</p>')
    wm = ""
    if 8.6 <= t < 18.6:
        k = ease(8.6, 10.2, t)
        rows = []
        for row in WORDMARK:
            rows.append("".join(c if c == " " or rng.random() < k else rng.choice("░▒▓") for c in row))
        wm = f'<pre class="wordmark{" glow" if t > 10.2 else ""}">{html.escape(chr(10).join(rows))}</pre>'
    face, color = "", "#ffb454"
    if 10.8 <= t < 12.9:
        k = ease(10.8, 12.9, t)
        face = "".join(CALM[j] if rng.random() < k * k else rng.choice(NOISE) for j in range(5))
        color = "#6fd3d3" if rng.random() < 0.5 * (1 - k) else "#ffb454"
    elif t >= 12.9:
        face = CALM
    say = typed("hi. i'm qt314. i read algorand for you.", 13.4, t, 26) if t >= 13.4 else ""
    ask, status = "", ""
    if 15.2 <= t < 18.6: ask = typed("who is algorand.algo?", 15.2, t, 30)
    if 16.1 <= t < 16.9: face, color, status = THINK[int(t * 4) % 2], "#6fd3d3", "thinking" + "." * (1 + int(t * 6) % 3)
    if 16.9 <= t < 17.7: face, color, status = WORK[int(t * 3) % 2], "#6fd3d3", "→ resolve_nfd → get_account_portfolio"
    if 17.7 <= t < 18.6: face, color, status = BRIGHT, "#ffb454", "found it. cards, not guesses."
    end = t >= 18.6
    fade = 1 - ease(19.3, 20.0, t)
    facepx = 168 if len(face) <= 5 else 120
    if not end:
        first, rest = say[:14], say[15:]
        l1 = html.escape(first[:8]) + f'<span class="amber">{html.escape(first[8:13])}</span>' + html.escape(first[13:])
        l2 = html.escape(rest)
        mid = f'''<div class="stage" style="opacity:{ease(10.8,11.2,t):.2f}">
          <div class="facewrap"><div class="face" style="font-size:{facepx}px;color:{color};text-shadow:0 0 48px {color}88">{html.escape(face)}</div></div>
          <div class="copy"><p class="l1">{l1}</p><p class="l2">{l2}</p></div></div>'''
        if ask: mid += f'<div class="composer"><span class="p">›</span><span>{html.escape(ask)}{"▌" if t < 16.0 and blink else ""}</span></div>'
        if status: mid += f'<p class="status" style="color:{"#6fd3d3" if color == "#6fd3d3" else "#8e8476"}">{html.escape(status)}</p>'
    else:
        mid = f'''<div class="endcard">
          <div class="face" style="font-size:150px;color:#ffb454;text-shadow:0 0 48px #ffb45488">{CALM}</div>
          <p class="url">agent.getvibekit.ai</p>
          <p class="sub">she reads algorand for you.</p>
          <p class="tiny">alpha · testnet usdc · your wallet signs</p></div>
          <p class="kicker foot">END OF TRANSMISSION // MAKE IT UBIQUITOUS</p>'''
    return f'''<!doctype html><html><head><meta charset="utf-8"><style>
*{{box-sizing:border-box;margin:0}}
body{{background:#0a0b0e;color:#e9e1d4;width:{W}px;height:{H}px;overflow:hidden;font-family:"JetBrainsMono Nerd Font","JetBrains Mono",monospace;position:relative}}
.wrap{{position:absolute;inset:0;opacity:{fade:.2f}}}
.grid i{{position:absolute;top:0;bottom:0;width:1px;background:rgba(42,39,35,.5)}}
.grid b{{position:absolute;left:0;right:0;height:1px;background:rgba(42,39,35,.5)}}
.rule{{position:absolute;top:0;left:0;right:0;height:8px;background:#c4a06a}}
.kicker{{position:absolute;top:64px;left:110px;font-size:24px;letter-spacing:.22em;color:#6fd3d3;font-weight:700}}
.kicker.foot{{top:auto;bottom:72px;color:#c4a06a}}
.tele{{position:absolute;top:104px;left:110px;font-size:16px;letter-spacing:.12em;color:#3a3833}}
.body{{position:absolute;top:190px;left:110px;right:110px}}
.line{{font-size:40px;line-height:1.55;color:#e9e1d4;letter-spacing:-.5px;white-space:pre}}
.line.amber,.amber{{color:#ffb454}}
.wordmark{{position:absolute;right:110px;top:52px;font-size:26px;line-height:1.05;color:#c4a06a;letter-spacing:1px;opacity:.9}}
.wordmark.glow{{color:#ffb454;text-shadow:0 0 30px rgba(255,180,84,.45)}}
.stage{{position:absolute;left:110px;right:110px;top:560px;display:flex;align-items:center;gap:72px}}
.facewrap{{width:640px;flex:none;display:flex;justify-content:center}}
.face{{font-weight:500;letter-spacing:-4px;line-height:1;white-space:nowrap}}
.l1{{font-size:72px;font-weight:700;letter-spacing:-2px;white-space:nowrap}}
.l2{{font-size:40px;color:#8e8476;white-space:nowrap;margin-top:14px;min-height:48px}}
.composer{{position:absolute;left:110px;right:110px;bottom:170px;border-left:4px solid #ffb454;background:#111318;padding:24px 32px;font-size:36px;display:flex;gap:18px}}
.composer .p{{color:#ffb454}}
.status{{position:absolute;left:110px;bottom:110px;font-size:26px;letter-spacing:.04em}}
.endcard{{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;padding-bottom:60px}}
.url{{font-size:72px;font-weight:700;color:#6fd3d3;letter-spacing:-2px;margin-top:24px}}
.sub{{font-size:38px;color:#e9e1d4}}
.tiny{{font-size:24px;color:#8e8476;letter-spacing:.06em}}
.scan{{position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(180deg,rgba(255,255,255,.028) 0 1px,transparent 1px 3px)}}
</style></head><body><div class="wrap"><div class="grid">{GRID}</div><div class="rule"></div>
{"".join(parts)}<div class="body">{"".join(body)}</div>{wm}{mid}</div><div class="scan"></div></body></html>'''

n = int(DUR * FPS)
for i in range(n):
    p = f"{OUT}/f{i:04d}.html"
    open(p, "w").write(frame(i))
    subprocess.run(["chromium", "--headless", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1", f"--window-size={W},{H}", f"--screenshot={OUT}/f{i:04d}.png", f"file://{p}"], stderr=subprocess.DEVNULL, check=True)
print("frames", n)
