import os, subprocess, sys, html
W, H, FPS = 1200, 675, 12
DUR = 9.4
OUT = sys.argv[1]
CALM, BLINK = "(^‿^)", "(-‿-)"
THINK = ["(・・?)", "(・・?)", "(￣ω￣;)", "(￣ω￣;)"]
WORK = ["(>'-')>", "<('-'<)"]
BRIGHT = "\\(^▽^)/"
GRID = "".join(f'<i style="left:{100+i*100}px"></i>' for i in range(11)) + "".join(f'<b style="top:{75+i*100}px"></b>' for i in range(6))

def typed(text, start, t, cps=14):
    n = max(0, int((t - start) * cps))
    return text[:n]

def frame(t):
    # face + mood
    mood, face, color = "calm", CALM, "#ffb454"
    if 1.65 <= t < 1.85: face = BLINK
    if 3.7 <= t < 4.5: mood, face, color = "thinking", THINK[int((t-3.7)*4) % 4], "#6fd3d3"
    if 4.5 <= t < 5.6: mood, face, color = "working", WORK[int((t-4.5)*3) % 2], "#6fd3d3"
    if 5.6 <= t < 7.4: mood, face, color = "bright", BRIGHT, "#ffb454"
    # copy
    l1 = typed("hi. i'm qt314.", 0.25, t)
    l2 = typed("i read algorand for you.", 1.05, t) if t >= 1.05 else ""
    cmd = typed("who is algorand.algo?", 2.1, t) if t >= 2.1 else ""
    caret = "▌" if (t < 3.7 and int(t*3) % 2 == 0) else ""
    status = ""
    if 3.7 <= t < 4.5: status = "thinking" + "." * (1 + int((t-3.7)*6) % 3)
    elif 4.5 <= t < 5.6: status = "→ resolve_nfd → get_account_portfolio"
    elif 5.6 <= t < 7.4: status = "got it. an account, its assets, its last moves — as cards."
    # end card
    end = t >= 7.4
    if end:
        l1, l2, cmd, caret, status = "agent.getvibekit.ai", "alpha · testnet usdc · your wallet signs", "", "", ""
        color = "#ffb454"
    # glitch ghost on a few frames
    ghost = ""
    for g0, clip, dx, col in ((1.2, "inset(20% 0 55% 0)", -8, "#6fd3d3"), (5.0, "inset(60% 0 10% 0)", 7, "#ffb454"), (8.1, "inset(5% 0 70% 0)", 6, "#6fd3d3")):
        if g0 <= t < g0 + 2/FPS:
            ghost = f'<div class="face ghost" style="color:{col};clip-path:{clip};transform:translate({dx}px,0)">{html.escape(face)}</div>'
    hero_css = "font-size:50px" if end else "font-size:56px"
    face_px = 132 if len(face) <= 5 else 92
    stage_top = 200 if end else 150
    l1_html = html.escape(l1)
    if not end and l1.startswith("hi. i'm ") :
        l1_html = html.escape("hi. i'm ") + f'<span style="color:#ffb454">{html.escape(l1[8:])}</span>'
    if end:
        l1_html = f'<span style="color:#6fd3d3">{html.escape(l1)}</span>'
    return f'''<!doctype html><html><head><meta charset="utf-8"><style>
*{{box-sizing:border-box;margin:0}}
body{{background:#0a0b0e;color:#e9e1d4;width:{W}px;height:{H}px;overflow:hidden;font-family:"JetBrainsMono Nerd Font","JetBrains Mono",monospace;position:relative}}
.grid i{{position:absolute;top:0;bottom:0;width:1px;background:rgba(42,39,35,.5)}}
.grid b{{position:absolute;left:0;right:0;height:1px;background:rgba(42,39,35,.5)}}
.rule{{position:absolute;top:0;left:0;right:0;height:6px;background:#c4a06a}}
.kicker{{position:absolute;top:44px;left:64px;font-size:20px;letter-spacing:.22em;color:#605c56}}
.kicker em{{color:#ffb454;font-style:normal;font-weight:700}}
.stage{{position:absolute;left:64px;right:64px;top:{stage_top}px;display:flex;align-items:center;gap:56px}}
.facewrap{{position:relative;width:440px;flex:none;display:flex;justify-content:center}}
.face{{font-size:{face_px}px;font-weight:500;letter-spacing:-3px;line-height:1;color:{color};text-shadow:0 0 40px {color}88;white-space:nowrap}}
.ghost{{position:absolute;top:0;left:0}}
.copy{{display:flex;flex-direction:column;gap:14px;min-width:0}}
.l1{{{hero_css};font-weight:700;letter-spacing:-2px;white-space:nowrap}}
.l2{{font-size:{"22px" if end else "30px"};color:#8e8476;white-space:nowrap}}
.composer{{position:absolute;left:64px;right:64px;bottom:120px;border-left:3px solid #ffb454;background:#111318;padding:18px 24px;font-size:28px;display:flex;gap:14px;align-items:center}}
.composer span.p{{color:#ffb454}}
.status{{position:absolute;left:64px;bottom:66px;font-size:20px;color:{"#6fd3d3" if mood in ("thinking","working") else "#8e8476"};letter-spacing:.04em}}
.scan{{position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(180deg,rgba(255,255,255,.025) 0 1px,transparent 1px 3px)}}
</style></head><body>
<div class="grid">{GRID}</div><div class="rule"></div>
<p class="kicker">◆ VIBEKIT <em>AGENT</em></p>
<div class="stage"><div class="facewrap"><div class="face">{html.escape(face)}</div>{ghost}</div>
<div class="copy"><p class="l1">{l1_html}</p><p class="l2">{html.escape(l2)}</p></div></div>
{'' if end else f'<div class="composer"><span class="p">›</span><span>{html.escape(cmd)}{caret}</span></div><p class="status">{html.escape(status)}</p>'}
<div class="scan"></div></body></html>'''

n = int(DUR * FPS)
for i in range(n):
    t = i / FPS
    p = f"{OUT}/f{i:04d}.html"
    open(p, "w").write(frame(t))
    subprocess.run(["chromium", "--headless", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1", f"--window-size={W},{H}", f"--screenshot={OUT}/f{i:04d}.png", f"file://{p}"], stderr=subprocess.DEVNULL, check=True)
print("frames", n)
