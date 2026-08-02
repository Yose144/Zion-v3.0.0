#!/usr/bin/env python3
"""Build the ZION Z-Tree professional vector identity.

The mark merges three existing ideas: the broad faceted Tree of Life in
root/logo.jpeg, the neon-green matrix legacy in Z.gif, and a bold Z suitable
for small crypto-directory icons. Output is deterministic SVG/PNG/ICO.
"""

from pathlib import Path
import subprocess
from PIL import Image

OUT = Path(__file__).parent


def defs(palette: str) -> str:
    if palette == "emerald":
        gold_a, gold_b, gold_c, gold_d = "#c9ff72", "#3dff9d", "#0bab6a", "#064b34"
        glow, matrix, ring = "#2aff93", "#57ffb0", "#36ed92"
        bg_a, bg_b, bg_c = "#072016", "#020c08", "#000302"
    elif palette == "mono":
        gold_a, gold_b, gold_c, gold_d = "#163f2c", "#0d2d20", "#082318", "#04120c"
        glow, matrix, ring = "#137a4b", "#137a4b", "#0d6a40"
        bg_a, bg_b, bg_c = "#ffffff", "#ffffff", "#ffffff"
    else:
        gold_a, gold_b, gold_c, gold_d = "#fff0a8", "#f7c83f", "#e28a16", "#713909"
        glow, matrix, ring = "#f6bd35", "#27e58b", "#d99a23"
        bg_a, bg_b, bg_c = "#12182a", "#060a12", "#010205"

    return f'''<defs>
  <radialGradient id="bg" cx="50%" cy="42%" r="68%">
    <stop offset="0" stop-color="{bg_a}"/><stop offset="0.58" stop-color="{bg_b}"/><stop offset="1" stop-color="{bg_c}"/>
  </radialGradient>
  <linearGradient id="zGold" x1="15%" y1="0%" x2="90%" y2="100%">
    <stop offset="0" stop-color="{gold_a}"/><stop offset="0.32" stop-color="{gold_b}"/><stop offset="0.73" stop-color="{gold_c}"/><stop offset="1" stop-color="{gold_d}"/>
  </linearGradient>
  <linearGradient id="trunk" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="{gold_a}"/><stop offset="0.52" stop-color="{gold_c}"/><stop offset="1" stop-color="{gold_d}"/>
  </linearGradient>
  <radialGradient id="halo"><stop offset="0" stop-color="{glow}" stop-opacity=".30"/><stop offset=".48" stop-color="{glow}" stop-opacity=".08"/><stop offset="1" stop-color="{glow}" stop-opacity="0"/></radialGradient>
  <filter id="glow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="8" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <filter id="soft" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="5"/></filter>
</defs>''', (gold_a, gold_b, gold_c, gold_d, glow, matrix, ring)


def canopy(palette: str) -> str:
    """Deliberate low-poly wide tree canopy, inspired by logo.jpeg.

    It stays within a known silhouette: an oak-like wide crown with just
    enough facets to be rich but still legible at exchange icon sizes.
    """
    if palette == "emerald":
        colors = ["#0b7b4d", "#109d5c", "#2adf87", "#75f4a9", "#117a58", "#b3ff56"]
        vein = "#62ffab"
    elif palette == "mono":
        colors = ["#064b34", "#075c3f", "#0b704b", "#0c824f", "#0a5c3a", "#0b6b43"]
        vein = "#137a4b"
    else:
        colors = ["#0a7148", "#119b5b", "#1dd880", "#80ed6d", "#f3c43a", "#e79b21", "#167b63"]
        vein = "#5dffae"

    # Each facet is a hand-set triangular leaf: point, left base, right base.
    # Spans x 60..452 and y 72..262. The layered grouping follows a dome.
    facets = [
        ((256, 58), (222, 147), (287, 147)),
        ((205, 76), (158, 162), (237, 152)), ((308, 76), (275, 152), (354, 162)),
        ((150, 104), (82, 192), (185, 168)), ((364, 104), (327, 168), (430, 192)),
        ((112, 141), (48, 218), (151, 191)), ((400, 141), (361, 191), (464, 218)),
        ((174, 128), (129, 220), (220, 185)), ((338, 128), (292, 185), (383, 220)),
        ((250, 102), (208, 202), (269, 181)), ((265, 102), (242, 181), (304, 202)),
        ((95, 183), (39, 245), (150, 223)), ((418, 183), (362, 223), (473, 245)),
        ((135, 178), (87, 257), (185, 218)), ((377, 178), (327, 218), (425, 257)),
        ((192, 176), (149, 259), (231, 222)), ((320, 176), (281, 222), (363, 259)),
        ((244, 154), (204, 252), (268, 213)), ((271, 154), (244, 213), (308, 252)),
        ((72, 220), (43, 272), (129, 248)), ((440, 220), (383, 248), (469, 272)),
        ((170, 219), (125, 276), (215, 247)), ((342, 219), (297, 247), (387, 276)),
        ((231, 211), (181, 270), (257, 243)), ((281, 211), (255, 243), (331, 270)),
    ]
    parts = []
    for i, tri in enumerate(facets):
        points = " ".join(f"{x},{y}" for x, y in tri)
        parts.append(f'<polygon points="{points}" fill="{colors[i % len(colors)]}"/>')

    # Simple facet veins give structure without noisy particle clutter.
    branches = [
        "M256 242 C240 205 221 180 205 150", "M255 240 C275 202 295 175 309 143",
        "M220 210 C181 201 150 190 112 169", "M290 210 C330 200 365 187 402 168",
        "M184 226 C145 225 113 218 82 205", "M327 226 C368 225 400 218 431 205",
        "M244 190 C238 152 246 112 256 82",
    ]
    veins = "".join(f'<path d="{path}" fill="none" stroke="{vein}" stroke-width="3" opacity=".42" stroke-linecap="round"/>' for path in branches)
    return f'<g id="canopy">{"".join(parts)}{veins}</g>'


def tree_branches(palette: str) -> str:
    if palette == "emerald":
        stroke, highlight = "#087047", "#4dff9f"
    elif palette == "mono":
        stroke, highlight = "#0a4e34", "#136f48"
    else:
        stroke, highlight = "#b66d18", "#f5d550"
    paths = [
        ("M255 337 C250 292 235 260 205 235 C181 215 157 211 125 205", 14),
        ("M258 337 C267 291 287 261 311 235 C337 214 370 211 404 203", 14),
        ("M215 250 C184 247 157 240 127 228", 8),
        ("M298 250 C332 247 358 240 388 228", 8),
        ("M239 269 C231 235 225 201 213 174", 8),
        ("M277 268 C284 231 294 199 307 169", 8),
        ("M255 247 C253 204 255 153 256 102", 8),
    ]
    out = []
    for d, w in paths:
        out.append(f'<path d="{d}" fill="none" stroke="{stroke}" stroke-width="{w}" stroke-linecap="round"/>')
        out.append(f'<path d="{d}" fill="none" stroke="{highlight}" stroke-width="{max(1.5,w*.16)}" opacity=".55" stroke-linecap="round"/>')
    return '<g id="branches">' + ''.join(out) + '</g>'


def roots(palette: str) -> str:
    if palette == "emerald":
        stroke, highlight = "#075238", "#4dff9f"
    elif palette == "mono":
        stroke, highlight = "#063d29", "#126f48"
    else:
        stroke, highlight = "#a75b12", "#f4c84d"
    paths = [
        ("M256 382 C250 426 249 461 256 492", 13),
        ("M236 379 C220 422 196 451 159 474", 12),
        ("M218 376 C186 407 152 424 111 443", 10),
        ("M199 374 C164 395 122 403 78 410", 8),
        ("M275 379 C293 422 316 451 353 474", 12),
        ("M294 376 C327 407 361 424 402 443", 10),
        ("M313 374 C348 395 390 403 434 410", 8),
    ]
    out = []
    for d, w in paths:
        out.append(f'<path d="{d}" fill="none" stroke="{stroke}" stroke-width="{w}" stroke-linecap="round"/>')
        out.append(f'<path d="{d}" fill="none" stroke="{highlight}" stroke-width="{max(1.2,w*.16)}" opacity=".54" stroke-linecap="round"/>')
    return '<g id="roots">' + ''.join(out) + '</g>'


def fruit(palette: str) -> str:
    if palette == "emerald": colors = ["#d9ff46", "#2dff9a", "#46c7ff", "#ffe553"]
    elif palette == "mono": colors = ["#0c764b", "#1a995d", "#2c6e50", "#0b5738"]
    else: colors = ["#ffe56d", "#2cff9d", "#52c7ff", "#ef75ff"]
    positions = [(114,209,8),(165,163,9),(211,126,8),(257,93,10),(307,130,8),(354,164,9),(402,208,8),(181,221,7),(330,221,7)]
    chunks = []
    for i, (x,y,r) in enumerate(positions):
        c = colors[i % len(colors)]
        chunks.append(f'<circle cx="{x}" cy="{y}" r="{r*2.4}" fill="{c}" opacity=".34" filter="url(#soft)"/>')
        chunks.append(f'<circle cx="{x}" cy="{y}" r="{r}" fill="{c}"/>')
        chunks.append(f'<circle cx="{x-r*.25}" cy="{y-r*.25}" r="{r*.3}" fill="#fff" opacity=".92"/>')
    return '<g id="fruit">' + ''.join(chunks) + '</g>'


def z_mark() -> str:
    # Strong, simple Z that remains legible at 32 px. This sits in front of
    # the tree; tree branches visually emerge from its top bar.
    return '''<path d="M142 276
 C142 264 151 255 165 255
 L364 255 C379 255 385 272 373 282
 L235 382 L365 382 C378 382 386 391 386 403
 C386 416 377 424 364 424
 L148 424 C133 424 128 406 140 396
 L280 297 L164 297 C151 297 142 289 142 276 Z"
 fill="url(#zGold)" filter="url(#glow)"/>
 <path d="M169 271 L337 271 M328 283 L164 401 M177 409 L355 409" fill="none" stroke="#fff7c9" stroke-width="4" opacity=".38" stroke-linecap="round"/>'''


def compose(kind: str, with_background: bool, with_wordmark: bool, width: int, height: int) -> str:
    palette = {"cosmic":"cosmic", "matrix":"emerald", "gold":"gold", "light":"mono", "transparent":"cosmic"}[kind]
    # Brand glyph stays 512x512 internally; use viewbox transform for graphic.
    if kind == "matrix": ring, text, sub = "#32ee94", "#5cffad", "#92ffc7"
    elif kind == "light": ring, text, sub = "#0a3f2a", "#145c3f", "#0b704b"
    else: ring, text, sub = "#e2ae31", "#f5ca42", "#72efad"

    background = ""
    if with_background:
        background = '<rect width="512" height="512" rx="82" fill="url(#bg)"/><circle cx="256" cy="255" r="225" fill="url(#halo)"/>'
        # sparse intentional stars / matrix rain - no clutter
        if kind == "matrix":
            background += ''.join(f'<path d="M{x} {y}v{length}" stroke="#33ef93" stroke-width="2" opacity=".2" stroke-dasharray="2 6"/>' for x,y,length in [(55,55,95),(79,102,72),(440,44,108),(464,165,63),(38,360,97),(475,348,105)])
        else:
            background += ''.join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="{c}" opacity=".65"/>' for x,y,r,c in [(65,105,2,"#baf7ff"),(94,383,1.6,"#fff1a8"),(432,98,2,"#baf7ff"),(448,379,1.6,"#fff1a8"),(110,58,1.2,"#fff"),(402,444,1.4,"#fff")])
    ring_markup = ""
    if with_background:
        ring_markup = f'''<circle cx="256" cy="256" r="226" fill="none" stroke="{ring}" stroke-width="2.5" opacity=".55"/>
        <circle cx="256" cy="256" r="214" fill="none" stroke="{ring}" stroke-width="1" stroke-dasharray="5 8" opacity=".4"/>
        <path d="M34 256h26m392 0h26M256 34v26m0 392v26" stroke="{ring}" stroke-width="2" opacity=".75"/>'''
    glyph = tree_branches(palette) + canopy(palette) + fruit(palette) + z_mark() + roots(palette)

    if with_wordmark:
        # Center glyph over the top 62% of a 1200x630 card, then clean lockup.
        bg = f'<rect width="{width}" height="{height}" fill="url(#bg)"/>' if with_background else ''
        return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="{width}" height="{height}">
{defs(palette)}
{bg}
<g transform="translate({width/2-256} 0) scale(1)">{ring_markup}{glyph}</g>
<text x="{width/2}" y="{height-68}" text-anchor="middle" font-family="Inter, Helvetica Neue, Arial, sans-serif" font-weight="800" font-size="46" letter-spacing="14" fill="{text}">ZION</text>
<text x="{width/2}" y="{height-28}" text-anchor="middle" font-family="Inter, Helvetica Neue, Arial, sans-serif" font-weight="600" font-size="15" letter-spacing="8" fill="{sub}">TERRA NOVA</text>
</svg>'''

    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="{width}" height="{height}">
{defs(palette)}
{background}
{ring_markup}
{glyph}
</svg>'''


def render(name: str, kind: str, background: bool, wordmark: bool, size: tuple[int, int]):
    svg = compose(kind, background, wordmark, *size)
    (OUT / f"{name}.svg").write_text(svg, encoding="utf-8")
    subprocess.run(["rsvg-convert", "-w", str(size[0]), "-h", str(size[1]), "-o", str(OUT / f"{name}.png"), str(OUT / f"{name}.svg")], check=True)


def main():
    assets = [
        ("zion-primary-cosmic", "cosmic", True, False, (1024,1024)),
        ("zion-matrix-legacy", "matrix", True, False, (1024,1024)),
        ("zion-gold-emerald", "gold", True, False, (1024,1024)),
        ("zion-exchange-transparent", "transparent", False, False, (1024,1024)),
        ("zion-light-background", "light", False, False, (1024,1024)),
        ("zion-wordmark-dark", "cosmic", True, True, (1200,630)),
        ("zion-wordmark-light", "light", True, True, (1200,630)),
        ("zion-social-banner", "matrix", True, True, (1200,630)),
        ("favicon", "cosmic", True, False, (512,512)),
    ]
    for args in assets:
        render(*args)
    for px in (16,32,48,64,128,180,192,256,512):
        subprocess.run(["rsvg-convert", "-w", str(px), "-h", str(px), "-o", str(OUT / f"favicon-{px}.png"), str(OUT / "favicon.svg")], check=True)
    imgs = [Image.open(OUT / f"favicon-{px}.png").convert("RGBA") for px in (16,32,48)]
    imgs[0].save(OUT / "favicon.ico", format="ICO", sizes=[(16,16),(32,32),(48,48)], append_images=imgs[1:])

if __name__ == "__main__":
    main()
