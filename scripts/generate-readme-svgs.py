"""Generate animated README SVGs (dark + light) for Kyra Agent.

Output: docs/assets/readme/*.svg in the repo given as argv[1].
SVGs use only inline CSS keyframes (rendered by GitHub through <img>),
system fonts, and a prefers-reduced-motion fallback.
"""
import os
import sys

repo = sys.argv[1]
out_dir = os.path.join(repo, "docs", "assets", "readme")
os.makedirs(out_dir, exist_ok=True)

SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif"
MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"

THEMES = {
    "dark": {
        "bg1": "#04060a", "bg2": "#0b1220", "line": "#1c2638", "panel": "#0e1522",
        "panel2": "#121b2b", "text": "#f3f7ff", "muted": "#93a3b9", "faint": "#5d6b7e",
        "blue": "#7aa8ff", "green": "#8ef0c4", "violet": "#b29bff", "amber": "#f6c978",
        "red": "#ff8a95", "user": "#4b86f7", "aurora": "0.38",
    },
    "light": {
        "bg1": "#f6f8fc", "bg2": "#e9eff9", "line": "#d5deec", "panel": "#ffffff",
        "panel2": "#f1f5fb", "text": "#0a1222", "muted": "#4f5f74", "faint": "#7b889a",
        "blue": "#2f6ee6", "green": "#0f8a57", "violet": "#6b4fd8", "amber": "#9a6114",
        "red": "#c4475a", "user": "#2f6ee6", "aurora": "0.26",
    },
}

REDUCED = "@media (prefers-reduced-motion: reduce) { * { animation: none !important; } }"


def write(name, content):
    with open(os.path.join(out_dir, name), "w", encoding="utf-8", newline="\n") as handle:
        handle.write(content)


def hero(t):
    nodes = [
        (760, 90), (840, 150), (930, 80), (1010, 170), (1100, 110), (1180, 200),
        (880, 250), (980, 300), (1080, 260), (1160, 320), (800, 320), (700, 200),
    ]
    links = [(0, 1), (1, 2), (2, 4), (1, 3), (3, 4), (4, 5), (3, 6), (6, 7), (7, 8),
             (8, 5), (8, 9), (6, 10), (10, 11), (11, 0), (11, 6), (7, 10)]
    link_svg = "\n".join(
        f'<line class="link" style="animation-delay:{i * 0.35:.2f}s" x1="{nodes[a][0]}" y1="{nodes[a][1]}" x2="{nodes[b][0]}" y2="{nodes[b][1]}"/>'
        for i, (a, b) in enumerate(links)
    )
    tones = [t["blue"], t["green"], t["violet"]]
    node_svg = "\n".join(
        f'<circle class="node" style="animation-delay:{i * 0.4:.2f}s" cx="{x}" cy="{y}" r="{4 if i % 3 else 5}" fill="{tones[i % 3]}"/>'
        for i, (x, y) in enumerate(nodes)
    )
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="400" viewBox="0 0 1280 400" role="img" aria-label="Kyra Agent: AI agents on Robinhood Chain. Telegram-native, approval-first.">
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{t['bg2']}"/><stop offset="1" stop-color="{t['bg1']}"/></linearGradient>
  <linearGradient id="title" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="{t['blue']}"/><stop offset="0.5" stop-color="{t['green']}"/><stop offset="1" stop-color="{t['violet']}"/></linearGradient>
  <filter id="blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="60"/></filter>
  <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="{t['line']}" stroke-width="1" opacity="0.55"/></pattern>
  <clipPath id="frame"><rect width="1280" height="400" rx="28"/></clipPath>
  <clipPath id="type"><rect class="typer" x="72" y="268" width="560" height="40"/></clipPath>
</defs>
<style>
  .aurora {{ opacity: {t['aurora']}; animation: drift 14s ease-in-out infinite alternate; transform-box: fill-box; transform-origin: center; }}
  .a2 {{ animation-duration: 18s; animation-delay: -6s; }}
  .a3 {{ animation-duration: 22s; animation-delay: -11s; }}
  @keyframes drift {{ from {{ transform: translate(-30px, -10px) scale(1); }} to {{ transform: translate(40px, 20px) scale(1.15); }} }}
  .link {{ stroke: {t['blue']}; stroke-width: 1.2; opacity: 0.18; animation: glow 5.6s ease-in-out infinite; }}
  @keyframes glow {{ 0%, 100% {{ opacity: 0.14; }} 50% {{ opacity: 0.55; }} }}
  .node {{ animation: pulse 4.8s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }}
  @keyframes pulse {{ 0%, 100% {{ opacity: 0.55; transform: scale(1); }} 50% {{ opacity: 1; transform: scale(1.6); }} }}
  .rise {{ animation: rise 1.1s cubic-bezier(0.22, 1, 0.36, 1) both; }}
  .d1 {{ animation-delay: 0.15s; }} .d2 {{ animation-delay: 0.35s; }}
  @keyframes rise {{ from {{ opacity: 0; transform: translateY(18px); }} to {{ opacity: 1; transform: none; }} }}
  .typer {{ animation: type 7s steps(46, end) 0.8s infinite backwards; }}
  @keyframes type {{ 0% {{ width: 0; }} 45%, 85% {{ width: 560px; }} 100% {{ width: 0; }} }}
  .caret {{ animation: caret 7s steps(46, end) 0.8s infinite, blink 0.9s steps(1) infinite; }}
  @keyframes caret {{ 0% {{ transform: translateX(0); }} 45%, 85% {{ transform: translateX(560px); }} 100% {{ transform: translateX(0); }} }}
  @keyframes blink {{ 50% {{ opacity: 0; }} }}
  .badge {{ animation: badge 3s ease-in-out infinite; }}
  @keyframes badge {{ 0%, 100% {{ opacity: 0.75; }} 50% {{ opacity: 1; }} }}
  {REDUCED}
</style>
<g clip-path="url(#frame)">
  <rect width="1280" height="400" fill="url(#bg)"/>
  <rect width="1280" height="400" fill="url(#grid)"/>
  <circle class="aurora" cx="260" cy="40" r="210" fill="{t['blue']}" filter="url(#blur)"/>
  <circle class="aurora a2" cx="1040" cy="90" r="230" fill="{t['green']}" filter="url(#blur)"/>
  <circle class="aurora a3" cx="760" cy="420" r="220" fill="{t['violet']}" filter="url(#blur)"/>
  <g>{link_svg}</g>
  <g>{node_svg}</g>
</g>
<rect x="0.5" y="0.5" width="1279" height="399" rx="28" fill="none" stroke="{t['line']}"/>
<g class="rise">
  <rect class="badge" x="72" y="66" width="284" height="34" rx="17" fill="{t['panel']}" stroke="{t['line']}"/>
  <circle cx="94" cy="83" r="5" fill="{t['green']}"/>
  <text x="108" y="88" font-family="{MONO}" font-size="14" fill="{t['muted']}" letter-spacing="1.5">ROBINHOOD CHAIN AGENTS</text>
</g>
<text class="rise d1" x="70" y="186" font-family="{SANS}" font-size="78" font-weight="800" letter-spacing="-2.5" fill="url(#title)">Kyra Agent</text>
<text class="rise d2" x="72" y="232" font-family="{SANS}" font-size="24" fill="{t['muted']}">Telegram-native AI agents. Your wallet makes every call.</text>
<g font-family="{MONO}" font-size="20">
  <text x="72" y="296" fill="{t['faint']}">&gt;</text>
  <g clip-path="url(#type)"><text x="96" y="296" fill="{t['text']}">telegram <tspan fill="{t['blue']}">&#8250;</tspan> kyra plans <tspan fill="{t['blue']}">&#8250;</tspan> your wallet decides</text></g>
  <rect class="caret" x="98" y="279" width="10" height="22" fill="{t['blue']}"/>
</g>
</svg>
"""


def flow(t):
    xs = [130, 400, 640, 880, 1150]
    labels = [("Telegram", "you ask"), ("Kyra gate", "plans, read-only"), ("Dashboard", "you review"),
              ("Wallet", "you sign"), ("Robinhood Chain", "only then")]
    icons = ["chat", "shield", "panel", "wallet", "chain"]
    glyph = {
        "chat": '<path d="M-11 -8h22a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-12l-7 5v-5h-3a3 3 0 0 1-3-3v-9a3 3 0 0 1 3-3z" fill="none" stroke="currentColor" stroke-width="2"/>',
        "shield": '<path d="M0 -13l11 4v7c0 7-5 11-11 14c-6-3-11-7-11-14v-7z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M-5 0l4 4l7-8" fill="none" stroke="currentColor" stroke-width="2"/>',
        "panel": '<rect x="-12" y="-10" width="24" height="20" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M-12 -3h24M-4 -3v13" stroke="currentColor" stroke-width="2"/>',
        "wallet": '<rect x="-12" y="-9" width="24" height="18" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="6" cy="0" r="2.5" fill="currentColor"/>',
        "chain": '<rect x="-13" y="-5" width="12" height="10" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><rect x="1" y="-5" width="12" height="10" rx="5" fill="none" stroke="currentColor" stroke-width="2"/>',
    }
    stages = []
    for i, (x, (title, sub)) in enumerate(zip(xs, labels)):
        stages.append(f"""<g class="stage s{i}" transform="translate({x} 120)" style="color:{t['blue']}">
  <circle class="ring" r="34" fill="{t['panel']}" stroke="{t['line']}" stroke-width="1.5"/>
  {glyph[icons[i]]}
</g>
<text x="{x}" y="186" text-anchor="middle" font-family="{SANS}" font-size="18" font-weight="700" fill="{t['text']}">{title}</text>
<text x="{x}" y="210" text-anchor="middle" font-family="{SANS}" font-size="14" fill="{t['muted']}">{sub}</text>""")
    stage_svg = "\n".join(stages)
    # Packet keyframes pause at each stage; travel 0 -> 1020px over 8s.
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="300" viewBox="0 0 1280 300" role="img" aria-label="Kyra approval path: Telegram, Kyra gate, dashboard review, wallet signature, then Robinhood Chain. Execution from chat is blocked.">
<style>
  .packet {{ animation: travel 8s cubic-bezier(0.65, 0, 0.35, 1) infinite; }}
  @keyframes travel {{
    0%, 6% {{ transform: translateX(0); opacity: 0; }}
    9% {{ opacity: 1; }}
    18%, 26% {{ transform: translateX(270px); }}
    38%, 46% {{ transform: translateX(510px); }}
    58%, 66% {{ transform: translateX(750px); }}
    80%, 92% {{ transform: translateX(1020px); opacity: 1; }}
    100% {{ transform: translateX(1020px); opacity: 0; }}
  }}
  .fill {{ animation: fill 8s cubic-bezier(0.65, 0, 0.35, 1) infinite; }}
  @keyframes fill {{
    0%, 6% {{ width: 0; }} 18%, 26% {{ width: 270px; }} 38%, 46% {{ width: 510px; }}
    58%, 66% {{ width: 750px; }} 80%, 92% {{ width: 1020px; }} 100% {{ width: 1020px; opacity: 0; }}
  }}
  .s1 .ring {{ animation: hit 8s infinite; animation-delay: 1.45s; }}
  .s2 .ring {{ animation: hit 8s infinite; animation-delay: 3.05s; }}
  .s3 .ring {{ animation: hit 8s infinite; animation-delay: 4.65s; }}
  .s4 .ring {{ animation: hit 8s infinite; animation-delay: 6.4s; }}
  @keyframes hit {{ 0% {{ stroke: {t['green']}; stroke-width: 3; }} 12%, 100% {{ stroke: {t['line']}; stroke-width: 1.5; }} }}
  .blocked {{ animation: blocked 4s ease-in-out infinite; }}
  @keyframes blocked {{ 0%, 100% {{ opacity: 0.55; }} 50% {{ opacity: 1; }} }}
  .shot {{ animation: shot 4s ease-in infinite; }}
  @keyframes shot {{ 0% {{ transform: translate(0, 0); opacity: 0; }} 10% {{ opacity: 1; }} 55% {{ transform: translate(0, 32px); opacity: 1; }} 70%, 100% {{ transform: translate(0, 32px); opacity: 0; }} }}
  {REDUCED}
</style>
<rect x="0.5" y="0.5" width="1279" height="299" rx="24" fill="{t['bg1']}" stroke="{t['line']}"/>
<rect x="130" y="119" width="1020" height="2" rx="1" fill="{t['line']}"/>
<rect class="fill" x="130" y="119" width="1020" height="2" rx="1" fill="{t['green']}"/>
<g class="packet"><circle cx="130" cy="120" r="7" fill="{t['green']}"/><circle cx="130" cy="120" r="14" fill="{t['green']}" opacity="0.25"/></g>
{stage_svg}
<path d="M130 222 V258 H262" fill="none" stroke="{t['red']}" stroke-width="1.5" stroke-dasharray="5 6" opacity="0.7"/>
<circle class="shot" cx="130" cy="226" r="5" fill="{t['red']}"/>
<g class="blocked" transform="translate(290 258)">
  <rect x="-18" y="-17" width="368" height="34" rx="17" fill="{t['panel']}" stroke="{t['red']}"/>
  <path d="M-6 -6l12 12M6 -6l-12 12" stroke="{t['red']}" stroke-width="2.4" stroke-linecap="round"/>
  <text x="18" y="5" font-family="{SANS}" font-size="15" fill="{t['text']}">Execute from chat: blocked before any model sees it</text>
</g>
</svg>
"""


def chat(t):
    rows = [
        ("user", "/help", 0),
        ("bot", ["Commands: /help /status /agent /actions /modules /policy",
                 "Ask in plain English for a brief, review, or plan."], 1),
        ("user", "Check my wallet", 2),
        ("bot", ["I can't read live balances from Telegram.",
                 "Connect your wallet in the private dashboard to review it."], 3),
        ("user", "Swap 10 USDC to ETH now", 4),
        ("refuse", ["Kyra cannot execute that from Telegram.",
                    "Review it in the dashboard; only your wallet can sign."], 5),
    ]
    y = 104
    parts = []
    for kind, text, index in rows:
        delay = 0.4 + index * 1.25
        if kind == "user":
            width = 22 + len(text) * 10.2
            x = 712 - width
            parts.append(f"""<g class="msg" style="animation-delay:{delay:.2f}s">
  <rect x="{x:.0f}" y="{y}" width="{width:.0f}" height="40" rx="14" fill="{t['user']}"/>
  <text x="{x + 12:.0f}" y="{y + 26}" font-family="{MONO}" font-size="16" fill="#ffffff">{text}</text>
</g>""")
            y += 54
        else:
            stroke = t["red"] if kind == "refuse" else t["line"]
            height = 24 + 22 * len(text)
            lines = "".join(
                f'<text x="66" y="{y + 30 + i * 22}" font-family="{SANS}" font-size="15" fill="{t["text"] if i == 0 else t["muted"]}">{line}</text>'
                for i, line in enumerate(text)
            )
            parts.append(f"""<g class="msg" style="animation-delay:{delay:.2f}s">
  <rect x="48" y="{y}" width="470" height="{height}" rx="14" fill="{t['panel2']}" stroke="{stroke}"/>
  {lines}
</g>""")
            y += height + 14
    body = "\n".join(parts)
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="760" height="{y + 36}" viewBox="0 0 760 {y + 36}" role="img" aria-label="Kyra Telegram demo: /help lists commands, a wallet question is answered read-only, and a swap request is refused.">
<style>
  .msg {{ animation: show 10s cubic-bezier(0.22, 1, 0.36, 1) infinite both; }}
  @keyframes show {{ 0% {{ opacity: 0; transform: translateY(10px); }} 6%, 88% {{ opacity: 1; transform: none; }} 96%, 100% {{ opacity: 0; }} }}
  .dot {{ animation: online 2.4s ease-out infinite; }}
  @keyframes online {{ 0% {{ r: 5; opacity: 1; }} 100% {{ r: 11; opacity: 0; }} }}
  @media (prefers-reduced-motion: reduce) {{ .msg, .dot {{ animation: none !important; }} }}
</style>
<rect x="0.5" y="0.5" width="759" height="{y + 35}" rx="26" fill="{t['bg1']}" stroke="{t['line']}"/>
<rect x="1" y="1" width="758" height="72" rx="26" fill="{t['panel']}"/>
<rect x="1" y="48" width="758" height="25" fill="{t['panel']}"/>
<line x1="1" y1="73" x2="759" y2="73" stroke="{t['line']}"/>
<circle cx="54" cy="37" r="20" fill="{t['blue']}"/>
<text x="54" y="43" text-anchor="middle" font-family="{SANS}" font-size="17" font-weight="800" fill="#ffffff">K</text>
<text x="88" y="33" font-family="{SANS}" font-size="17" font-weight="700" fill="{t['text']}">Kyra Operator</text>
<circle class="dot" cx="94" cy="50" r="5" fill="{t['green']}" opacity="0.6"/>
<circle cx="94" cy="50" r="4" fill="{t['green']}"/>
<text x="106" y="55" font-family="{SANS}" font-size="13" fill="{t['muted']}">bot · read-only</text>
{body}
</svg>
"""


for theme_name, theme in THEMES.items():
    write(f"kyra-hero-{theme_name}.svg", hero(theme))
    write(f"kyra-approval-flow-{theme_name}.svg", flow(theme))
    write(f"kyra-telegram-demo-{theme_name}.svg", chat(theme))

print("written:", sorted(os.listdir(out_dir)))
