"""qt314 ecosystem promo: four read cards from live data captured the day of
rendering — Vestige candles, August 2026 headlines, a Haystack quote, Alpha Arcade.

Usage:
  python3 qt314-ecosystem.py <framedir> <candles.json>
  python3 qt314-ecosystem.py <framedir> <candles.json> preview
"""
import hashlib, html, json, os, random, shutil, subprocess, sys

W, H, FPS = 1920, 1080, 24
OUT, CANDLES = sys.argv[1], json.load(open(sys.argv[2]))
PREVIEW = len(sys.argv) > 3 and sys.argv[3] == "preview"

CALM, BLINK = "(^‿^)", "(-‿-)"
THINK = ["(・・?)", "(￣ω￣;)"]
WORK = ["(>'-')>", "<('-'<)"]
GRID = "".join(f'<i style="left:{160 + i * 160}px"></i>' for i in range(11)) + "".join(
    f'<b style="top:{120 + i * 160}px"></b>' for i in range(6)
)

def typed(text, start, t, cps=20):
    return text[: max(0, int((t - start) * cps))]

def compact_usd(n):
    if n >= 1e6:
        return f" ${n / 1e6:.2f}M"
    if n >= 1e3:
        return f" ${n / 1e3:.1f}K"
    return f" ${n:.2f}"

closes = [c["close"] for c in CANDLES]
lo_c, hi_c = min(closes), max(closes)
lo_w, hi_w = min(c["low"] for c in CANDLES), max(c["high"] for c in CANDLES)
first, last = CANDLES[0]["open"], closes[-1]
change = (last - first) / first * 100
vol = sum(c["volume"] for c in CANDLES)


def chart_card(k):
    n, vw, vh, pad = len(closes), 1000, 168, 10
    rng = hi_c - lo_c or 1
    xs = [i / (n - 1) * vw for i in range(n)]
    ys = [vh - pad - (c - lo_c) / rng * (vh - 2 * pad) for c in closes]
    show = max(2, int(round((n - 1) * k)) + 1)
    line = " ".join(f"{xs[i]:.1f},{ys[i]:.1f}" for i in range(show))
    lx, ly = xs[show - 1], ys[show - 1]
    fill = f"0,{vh} {line} {lx},{vh}"
    dot = (
        f'<circle cx="{lx:.1f}" cy="{ly:.1f}" r="6" fill="#6fd3d3" stroke="#0a0b0e" stroke-width="2"/>'
        if k >= 1
        else ""
    )
    chips = "".join(
        f'<span class="chip{" on" if r == "30d" else ""}">{r}</span>' for r in ("1d", "7d", "30d", "90d", "1y")
    )
    return f'''<section class="card">
<header class="hd"><span><span class="kick">PRICE</span><span class="ch">VESTIGE</span></span><span class="pill">MAINNET</span></header>
<p class="hero"><span class="hv">ALGO</span><span class="hu">${last:.4f}</span><span class="hu up">{change:+.1f}% · 30d</span></p>
<p class="cap">{len(closes)} candles · 4h each</p>
<svg viewBox="0 0 {vw} {vh}" class="tps" preserveAspectRatio="none"><polygon points="{fill}" fill="rgba(111,211,211,.18)"/><polyline points="{line}" fill="none" stroke="#6fd3d3" stroke-width="2.4" stroke-linejoin="round"/>{dot}</svg>
<p class="chips">{chips}</p>
<dl class="facts"><div><dt>low</dt><dd>${lo_w:.4f}</dd></div><div><dt>high</dt><dd>${hi_w:.4f}</dd></div><div><dt>volume</dt><dd>{compact_usd(vol).strip()}</dd></div></dl>
</section>'''


NEWS = [
    ("Algorand v5 is live — native post-quantum accounts", "algorand.co", "Aug 22"),
    ("Foundation ships AC2: passkey-signed agent approvals", "algorand.co", "Aug 25"),
    ("1,500+ node runners upgraded in four days", "x.com/AlgoFoundation", "Aug 16"),
]


def web_card(k):
    n = max(1, min(3, int(len(NEWS) * min(1, k * 1.6 + 0.34))))
    rows = "".join(
        f'<li><i>{i + 1}</i><span class="t">{html.escape(t)}</span><span class="m">{html.escape(d)} · {w}</span></li>'
        for i, (t, d, w) in enumerate(NEWS[:n])
    )
    return f'''<section class="card">
<header class="hd"><span><span class="kick">WEB</span><span class="ch">EXA</span></span><span class="pill ok">{n}</span></header>
<p class="q">“good news about algorand this month”</p>
<ol class="web">{rows}</ol>
</section>'''


def quote_card(k):
    a = min(1, k * 1.6)
    return f'''<section class="card">
<header class="hd"><span><span class="kick">QUOTE</span><span class="ch">HAYSTACK</span></span><span class="hd-end"><span class="btn">swap ▸</span><span class="pill">MAINNET</span></span></header>
<p class="hero"><span class="hv">10 USDC → 115.87 ALGO</span><span class="hu">1 USDC ≈ 11.59 ALGO</span></p>
<div class="route"><span style="width:{100 * a:.1f}%;background:#6fd3d3">Pact</span></div>
<dl class="facts"><div><dt>price impact</dt><dd>0.32%</dd></div><div><dt>usd</dt><dd>$10.00 → $9.97</dd></div><div><dt>type</dt><dd>sell exactly</dd></div></dl>
</section>'''


MARKETS = [
    ("Netanyahu out by end of 2026?", 48, "$16.0K", "in 125d"),
    ("Clarity Act signed into law in 2026?", 13, "$11.6K", "in 125d"),
    ("Catastrophic job losses from AI this year?", 29, "$10.0K", "in 125d"),
    ("Mitch McConnell steps down before term ends?", 13, "$7.1K", "in 128d"),
]


def markets_card(k):
    n = max(1, min(len(MARKETS), int(len(MARKETS) * min(1, k * 1.5 + 0.28))))
    rows = "".join(
        f'<tr><td>{html.escape(t)}</td><td class="p"><i style="width:{max(8, y * 0.9):.0f}px"></i>{y}%</td><td class="r">{v}</td><td class="r">{e}</td></tr>'
        for t, y, v, e in MARKETS[:n]
    )
    return f'''<section class="card">
<header class="hd"><span><span class="kick">MARKETS</span><span class="ch">ALPHA ARCADE</span></span><span class="pill ok">{n}</span></header>
<table><thead><tr><th>market</th><th class="r">yes</th><th class="r">volume</th><th class="r">ends</th></tr></thead><tbody>{rows}</tbody></table>
<p class="foot">mainnet · YES price is the implied probability</p>
</section>'''


CARDS = {"chart": chart_card, "web": web_card, "quote": quote_card, "markets": markets_card}

# (start, prompt, tool, card-id, reply, face)
SCENES = [
    (0.8, "show algorand's chart (wince)", "get_asset_price_history", "chart",
     "un-wince. it's green.\nthat dip tho.", "(＾▽＾)"),
    (8.8, "any good news on the internet?", "web_search", "web",
     "pretty good week actually.\nyou're welcome.", "(◕‿◕)"),
    (16.6, "ummm ok swap usdc to algo", "get_swap_quote", "quote",
     "ok i got you a quote.\nqt doesn't press buttons.", "(¬‿¬)"),
    (24.4, "btw any betting markets live?", "get_live_markets", "markets",
     "yeah they're live.\nnetanyahu's a coin flip.", "(・_・)"),
]
END, DUR = 31.4, 35.0
CPS, RCPS = 20, 26


def scene_times(start, prompt):
    typing_end = start + len(prompt) / CPS
    t1 = typing_end + 0.28
    t2 = t1 + 0.95
    return typing_end, t1, t2


CSS = """
*{box-sizing:border-box;margin:0}
body{background:#0a0b0e;color:#e9e1d4;width:1920px;height:1080px;overflow:hidden;font-family:"JetBrainsMono Nerd Font","JetBrains Mono",monospace;position:relative}
.grid i{position:absolute;top:0;bottom:0;width:1px;background:rgba(42,39,35,.5)}
.grid b{position:absolute;left:0;right:0;height:1px;background:rgba(42,39,35,.5)}
.rule{position:absolute;top:0;left:0;right:0;height:8px;background:#c4a06a}
.kicker{position:absolute;top:52px;left:110px;font-size:22px;letter-spacing:.22em;color:#605c56;font-weight:700}
.kicker em{color:#ffb454;font-style:normal}
.stage{position:absolute;left:110px;right:110px;top:120px;bottom:210px;display:flex;gap:56px;align-items:flex-start}
.facecol{width:400px;flex:none;padding-top:18px}
.facewrap{position:relative;display:flex;justify-content:center;min-height:150px;align-items:center}
.face{font-weight:500;letter-spacing:-3px;line-height:1;white-space:nowrap}
.ghost{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%)}
.reply{margin-top:28px;font-size:24px;line-height:1.45;color:#e9e1d4;white-space:pre-wrap}
.cards{flex:1;min-width:0}
.card{background:#111318;border:1px solid #2a2723;border-left:3px solid #c4a06a;padding:28px 36px 32px}
.hd{align-items:center;border-bottom:1px solid #2a2723;display:flex;justify-content:space-between;padding-bottom:16px}
.kick{color:#c4a06a;font-size:15px;font-weight:700;letter-spacing:.16em}
.ch{color:#8e8476;font-size:15px;letter-spacing:.08em;margin-left:14px}
.hd-end{align-items:center;display:flex;gap:14px}
.pill{background:#2a2723;color:#c4a06a;font-size:13px;font-weight:700;letter-spacing:.12em;padding:4px 10px}
.pill.ok{background:#6fd3d3;color:#0a0b0e}
.hero{align-items:baseline;display:flex;flex-wrap:wrap;gap:18px;margin:22px 0 0}
.hv{color:#ffb454;font-size:44px;font-weight:500;letter-spacing:-.04em;line-height:1}
.hu{color:#8e8476;font-size:18px;letter-spacing:.1em}
.up{color:#7fbf7f}
.cap{color:#605c56;font-size:16px;margin:14px 0 8px}
.tps{display:block;width:100%;height:168px;margin-top:4px}
.chips{display:flex;gap:8px;margin-top:14px}
.chip{border:1px solid #2a2723;color:#8e8476;font-size:14px;letter-spacing:.08em;padding:4px 12px}
.chip.on{border-color:#6fd3d3;color:#6fd3d3}
.facts{display:flex;gap:36px;margin-top:18px}
.facts div{border-top:1px solid #2a2723;padding-top:10px;min-width:140px}
.facts dt{color:#605c56;font-size:12px;letter-spacing:.14em;text-transform:uppercase}
.facts dd{margin:4px 0 0;font-size:20px;color:#e9e1d4}
.q{color:#8e8476;font-style:italic;margin:18px 0 4px;font-size:20px}
.web{list-style:none;padding:0;margin:8px 0 0}
.web li{border-top:1px solid #2a2723;padding:16px 0;display:flex;gap:16px;align-items:baseline;font-size:22px}
.web i{color:#605c56;font-style:normal;font-size:14px;width:18px}
.web .t{color:#c4a06a;flex:1}
.web .m{color:#605c56;font-size:15px;white-space:nowrap}
.route{display:flex;gap:2px;height:28px;margin:22px 0 0;overflow:hidden}
.route span{color:#0a0b0e;font-size:14px;padding:0 12px;line-height:28px;white-space:nowrap;overflow:hidden}
.btn{border:1px solid #6fd3d3;color:#6fd3d3;font-size:16px;padding:6px 14px;letter-spacing:.04em}
table{width:100%;border-collapse:collapse;margin-top:18px;font-size:20px}
th{color:#605c56;font-weight:400;font-size:12px;letter-spacing:.14em;text-transform:uppercase;text-align:left;padding:0 0 10px}
td{border-top:1px solid #2a2723;padding:14px 0}
.r{text-align:right}
.p{text-align:right;white-space:nowrap}
.p i{display:inline-block;height:8px;background:rgba(111,211,211,.35);margin-right:10px;vertical-align:middle}
.foot{color:#605c56;font-size:14px;margin-top:16px}
.composer{position:absolute;left:110px;right:110px;bottom:118px;border-left:4px solid #ffb454;background:#111318;padding:20px 28px;font-size:30px;display:flex;gap:16px;align-items:center}
.composer .p{color:#ffb454}
.composer .ph{color:#605c56}
.status{position:absolute;left:110px;bottom:70px;font-size:20px;color:#6fd3d3;letter-spacing:.04em}
.endcard{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;padding-bottom:40px}
.endcard .face{font-size:150px;color:#ffb454;text-shadow:0 0 48px #ffb45488;letter-spacing:-4px}
.l1{font-size:72px;font-weight:700;color:#6fd3d3;letter-spacing:-2px}
.l2{font-size:32px;color:#e9e1d4}
.l3{font-size:22px;letter-spacing:.16em;color:#8e8476}
.kicker.foot{top:auto;bottom:64px;color:#c4a06a}
.scan{position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(180deg,rgba(255,255,255,.025) 0 1px,transparent 1px 3px)}
"""


def frame(i):
    t = i / FPS
    rng = random.Random(i)
    face, color, status, cmd, card, reply, caret = CALM, "#ffb454", "", "", "", "", ""
    placeholder = True
    kicker = "◆ VIBEKIT <em>AGENT</em>  ·  ECOSYSTEM TOOLS"
    current = None
    for idx, scene in enumerate(SCENES):
        if t >= scene[0]:
            current = idx
        else:
            break
    if current is not None and t < END:
        placeholder = False
        start, prompt, tool, card_id, line, mood_face = SCENES[current]
        typing_end, t1, t2 = scene_times(start, prompt)
        cmd = typed(prompt, start, t, CPS)
        if t < typing_end + 0.25 and int(t * 3) % 2 == 0:
            caret = "▌"
        if t < t2 and current > 0:
            prev = SCENES[current - 1]
            card = CARDS[prev[3]](1)
            reply, face, color = prev[4], prev[5], "#ffb454"
        if t1 <= t < t2:
            if t < t1 + 0.35:
                face, color, status = THINK[int((t - t1) * 6) % 2], "#6fd3d3", "thinking" + "." * (1 + int((t - t1) * 6) % 3)
            else:
                face, color, status = WORK[int((t - t1) * 4) % 2], "#6fd3d3", f"→ {tool}"
        elif t >= t2:
            k = min(1.0, (t - t2) / 0.7)
            card = CARDS[card_id](k)
            face, color = mood_face, "#ffb454"
            reply = typed(line, t2 + 0.45, t, RCPS)
            status = ""
    if placeholder and int(t * 2) % 16 == 15:
        face = BLINK
    end = t >= END
    ghost = ""
    if not end:
        for start, prompt, tool, card_id, line, mood_face in SCENES:
            _, _, t2 = scene_times(start, prompt)
            if t2 <= t < t2 + 2 / FPS:
                clip, dx, col = rng.choice(
                    (("inset(20% 0 55% 0)", -10, "#6fd3d3"), ("inset(60% 0 10% 0)", 8, "#ffb454"))
                )
                ghost = f'<div class="face ghost" style="color:{col};clip-path:{clip};transform:translate(calc(-50% + {dx}px),-50%)">{html.escape(face)}</div>'
    face_px = 118 if len(face) <= 5 else 86
    if end:
        body = f'''<div class="endcard">
<div class="face">{html.escape(CALM)}</div>
<p class="l1">agent.getvibekit.ai</p>
<p class="l2">qt reads. you sign.</p>
<p class="l3">charts · news · swaps · markets</p>
</div>
<p class="kicker foot">END OF TRANSMISSION  //  THE REST OF THE CHAIN</p>'''
    else:
        ph = '<span class="ph">Ask anything</span>' if placeholder and not cmd else ""
        body = f'''<div class="stage">
<div class="facecol"><div class="facewrap"><div class="face" style="font-size:{face_px}px;color:{color};text-shadow:0 0 40px {color}88">{html.escape(face)}</div>{ghost}</div>
{f'<p class="reply">{html.escape(reply)}</p>' if reply else ""}</div>
<div class="cards">{card}</div></div>
<div class="composer"><span class="p">›</span><span>{html.escape(cmd)}{caret}{ph}</span></div>
{f'<p class="status">{html.escape(status)}</p>' if status else ""}'''
    return f"""<!doctype html><html><head><meta charset="utf-8"><style>{CSS}</style></head><body>
<div class="grid">{GRID}</div><div class="rule"></div>
{'' if end else f'<p class="kicker">{kicker}</p>'}
{body}<div class="scan"></div></body></html>"""


def shot(html_str, dest):
    p = dest.replace(".png", ".html")
    open(p, "w").write(html_str)
    subprocess.run(
        [
            "chromium",
            "--headless",
            "--disable-gpu",
            "--hide-scrollbars",
            "--force-device-scale-factor=1",
            f"--window-size={W},{H}",
            f"--screenshot={dest}",
            f"file://{p}",
        ],
        stderr=subprocess.DEVNULL,
        check=True,
    )


os.makedirs(OUT, exist_ok=True)
if PREVIEW:
    times = [0.4, 2.0, 3.2, 6.5, 9.6, 14.2, 17.6, 22.2, 25.4, 29.6, 32.4]
    for t in times:
        i = int(t * FPS)
        shot(frame(i), f"{OUT}/qa-{t}.png")
        print("preview", t)
    print("preview frames", len(times))
    raise SystemExit(0)

n = int(DUR * FPS)
cache = {}
for i in range(n):
    h = frame(i)
    digest = hashlib.sha1(h.encode()).hexdigest()
    dest = f"{OUT}/f{i:04d}.png"
    if digest in cache:
        shutil.copyfile(cache[digest], dest)
    else:
        shot(h, dest)
        cache[digest] = dest
    if i % 48 == 0:
        print(f"frame {i}/{n} unique {len(cache)}", flush=True)
print("frames", n, "unique", len(cache))
