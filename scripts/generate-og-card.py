"""Generate public/og-card.svg, the 1200x630 social preview source.

The PNG (public/og-card.png) is rendered from this SVG in a browser with the
Geist font loaded; see docs/robinhood-relaunch-runbook.md. Run:
    python -I scripts/generate-og-card.py <repo-root>
"""
import base64
import os
import sys

repo = sys.argv[1]
portrait = base64.b64encode(
    open(os.path.join(repo, "public", "brand", "kyra.jpg"), "rb").read()
).decode("ascii")

SANS = "'Geist Variable', Geist, 'Segoe UI', Helvetica, Arial, sans-serif"
MONO = "'Geist Mono Variable', 'Geist Mono', ui-monospace, Consolas, monospace"

nodes = [(700, 70), (790, 40), (880, 110), (990, 60), (1100, 120), (1160, 40),
         (760, 200), (1060, 230), (1150, 300), (690, 330)]
links = [(0, 1), (1, 2), (2, 3), (3, 4), (4, 5), (0, 6), (6, 2), (4, 7), (7, 8), (6, 9), (3, 7)]
tones = ["#7aa8ff", "#8ef0c4", "#b29bff"]
link_svg = "".join(
    f'<line x1="{nodes[a][0]}" y1="{nodes[a][1]}" x2="{nodes[b][0]}" y2="{nodes[b][1]}" stroke="#7aa8ff" stroke-opacity="0.22" stroke-width="1.2"/>'
    for a, b in links
)
node_svg = "".join(
    f'<circle cx="{x}" cy="{y}" r="{3.5 if i % 2 else 4.5}" fill="{tones[i % 3]}" fill-opacity="0.85"/>'
    for i, (x, y) in enumerate(nodes)
)

path_steps = ["Telegram", "Kyra", "Dashboard", "Wallet", "Robinhood Chain"]
chips = []
x = 64
for index, label in enumerate(path_steps):
    width = 22 + len(label) * 8.4
    last = index == len(path_steps) - 1
    chips.append(
        f'<rect x="{x:.0f}" y="512" width="{width:.0f}" height="34" rx="17" fill="{"#132033" if not last else "#12291f"}" stroke="{"#24324a" if not last else "#2c6a52"}"/>'
        f'<text x="{x + 11:.0f}" y="534" font-family="{SANS}" font-size="15" font-weight="600" fill="{"#c9d6ea" if not last else "#8ef0c4"}">{label}</text>'
    )
    x += width
    if not last:
        chips.append(f'<path d="M{x + 6:.0f} 529h12m-4-4l4 4l-4 4" fill="none" stroke="#5d6b7e" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>')
        x += 24
chip_svg = "".join(chips)

svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="Kyra Agent: your AI agent on Robinhood Chain. Telegram-native, and your wallet approval decides every onchain action.">
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#070b14"/><stop offset="1" stop-color="#03050a"/></linearGradient>
  <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8fb6ff"/><stop offset="0.5" stop-color="#8ef0c4"/><stop offset="1" stop-color="#b29bff"/></linearGradient>
  <radialGradient id="auroraBlue" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#4b86f7" stop-opacity="0.45"/><stop offset="1" stop-color="#4b86f7" stop-opacity="0"/></radialGradient>
  <radialGradient id="auroraViolet" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#8a6cff" stop-opacity="0.38"/><stop offset="1" stop-color="#8a6cff" stop-opacity="0"/></radialGradient>
  <radialGradient id="auroraGreen" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#3cdcaa" stop-opacity="0.22"/><stop offset="1" stop-color="#3cdcaa" stop-opacity="0"/></radialGradient>
  <pattern id="grid" width="36" height="36" patternUnits="userSpaceOnUse"><path d="M36 0H0V36" fill="none" stroke="#1a2436" stroke-width="1"/></pattern>
  <filter id="duotone" color-interpolation-filters="sRGB">
    <feColorMatrix type="saturate" values="0"/>
    <feComponentTransfer>
      <feFuncR type="table" tableValues="0.02 0.62"/>
      <feFuncG type="table" tableValues="0.04 0.72"/>
      <feFuncB type="table" tableValues="0.10 1"/>
    </feComponentTransfer>
  </filter>
  <linearGradient id="portraitFade" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#fff" stop-opacity="0"/>
    <stop offset="0.32" stop-color="#fff" stop-opacity="1"/>
    <stop offset="1" stop-color="#fff" stop-opacity="1"/>
  </linearGradient>
  <linearGradient id="portraitFadeV" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0.55" stop-color="#fff" stop-opacity="1"/>
    <stop offset="1" stop-color="#fff" stop-opacity="0.15"/>
  </linearGradient>
  <mask id="portraitMask"><rect x="560" y="0" width="640" height="630" fill="url(#portraitFade)"/></mask>
  <mask id="portraitMaskV"><rect x="560" y="0" width="640" height="630" fill="url(#portraitFadeV)"/></mask>
  <filter id="softShadow" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="18" stdDeviation="22" flood-color="#000" flood-opacity="0.55"/></filter>
  <filter id="amberGlow" x="-30%" y="-60%" width="160%" height="220%"><feDropShadow dx="0" dy="0" stdDeviation="14" flood-color="#f6c978" flood-opacity="0.45"/></filter>
  <clipPath id="frame"><rect width="1200" height="630"/></clipPath>
</defs>
<g clip-path="url(#frame)">
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#grid)" opacity="0.55"/>
  <circle cx="170" cy="90" r="360" fill="url(#auroraBlue)"/>
  <circle cx="420" cy="660" r="340" fill="url(#auroraViolet)"/>
  <circle cx="1120" cy="80" r="300" fill="url(#auroraGreen)"/>

  <g mask="url(#portraitMask)">
    <g mask="url(#portraitMaskV)">
      <image x="600" y="-40" width="640" height="790" preserveAspectRatio="xMidYMin slice" filter="url(#duotone)" opacity="0.92" href="data:image/jpeg;base64,{portrait}"/>
    </g>
  </g>
  <rect x="560" y="0" width="640" height="630" fill="#4b86f7" opacity="0.06"/>
  <g>{link_svg}{node_svg}</g>

  <g font-family="{SANS}">
    <rect x="64" y="58" width="352" height="38" rx="19" fill="#0d1524" stroke="#26344c"/>
    <circle cx="88" cy="77" r="5.5" fill="#8ef0c4"/>
    <text x="104" y="83" font-family="{MONO}" font-size="15" font-weight="600" letter-spacing="2" fill="#c9d6ea">KYRA AGENT &#183; ROBINHOOD CHAIN</text>

    <text x="60" y="210" font-size="70" font-weight="800" letter-spacing="-2.4" fill="#f3f7ff">Your AI agent.</text>
    <text x="60" y="292" font-size="70" font-weight="800" letter-spacing="-2.4" fill="url(#accent)">Your wallet decides.</text>

    <text x="64" y="356" font-size="25" fill="#a7b6cb">Telegram-native agents that plan and explain.</text>
    <text x="64" y="392" font-size="25" fill="#a7b6cb">Nothing moves onchain until you sign.</text>

    <text x="64" y="488" font-family="{MONO}" font-size="13" font-weight="600" letter-spacing="2.4" fill="#5d6b7e">EVERY ACTION, YOUR APPROVAL</text>
    {chip_svg}

    <text x="64" y="598" font-family="{MONO}" font-size="18" font-weight="600" fill="#7aa8ff">kyraagent.xyz</text>
  </g>

  <g filter="url(#softShadow)" font-family="{SANS}">
    <g transform="translate(792 352) rotate(-3)">
      <rect width="330" height="46" rx="16" x="40" fill="#3f78e8"/>
      <text x="62" y="29" font-family="{MONO}" font-size="16" font-weight="600" fill="#ffffff">Swap 10 USDC to ETH now</text>
    </g>
    <g transform="translate(748 414) rotate(-3)">
      <rect width="388" height="84" rx="16" fill="#0f1828" stroke="#2a3a55"/>
      <circle cx="26" cy="27" r="11" fill="#7aa8ff"/>
      <text x="26" y="32" text-anchor="middle" font-size="13" font-weight="800" fill="#ffffff">K</text>
      <text x="46" y="32" font-size="16" font-weight="700" fill="#f3f7ff">Kyra cannot execute that from Telegram.</text>
      <text x="20" y="62" font-size="15" fill="#93a3b9">Review it in your dashboard first.</text>
    </g>
    <g transform="translate(820 520) rotate(-3)" filter="url(#amberGlow)">
      <rect width="300" height="56" rx="18" fill="#1c1608" stroke="#f6c978" stroke-opacity="0.85"/>
      <rect x="18" y="16" width="26" height="22" rx="5" fill="none" stroke="#f6c978" stroke-width="2"/>
      <circle cx="37" cy="27" r="3" fill="#f6c978"/>
      <text x="58" y="34" font-size="17" font-weight="700" fill="#f6c978">Wallet signature required</text>
    </g>
  </g>
</g>
<rect x="0.5" y="0.5" width="1199" height="629" fill="none" stroke="#1d2a3f"/>
</svg>
"""

with open(os.path.join(repo, "public", "og-card.svg"), "w", encoding="utf-8", newline="\n") as handle:
    handle.write(svg)

print("wrote public/og-card.svg", len(svg), "bytes")
