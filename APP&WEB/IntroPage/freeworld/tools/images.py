#!/usr/bin/env python3
"""Optimize Free World imagery into dist/assets/img (webp, capped width)."""
import sys
from pathlib import Path
from PIL import Image

DIST = Path(sys.argv[1])
REPO = Path(__file__).resolve().parents[4]
IMG = REPO / 'L5Projects/img'
WEB_IMG = REPO / 'APP&WEB/website-v2.9/public/images'

# slug -> (render source, board source)
SOURCES = {
    'genesis-garden': ('Genesis.png', 'GenesisProject.png'),
    'dharma-temple': ('Dharma.png', 'DharmaProject.png'),
    'te-piko-ora': ('Piko.png', 'PikoProject.png'),
    'golden-republic-bohemia': ('Bohemia.jpg', 'BohemiaProjekt.jpg'),
    'bodhi-lanka': ('Lanka.jpg', 'LankaProject.jpg'),
    'lumi-nova-amerika': ('Lumi.png', 'Lumi project.png'),
}

def save_webp(im: Image.Image, out: Path, max_w: int, q: int):
    if im.width > max_w:
        im = im.resize((max_w, int(im.height * max_w / im.width)), Image.LANCZOS)
    out.parent.mkdir(parents=True, exist_ok=True)
    im.convert('RGB').save(out, 'WEBP', quality=q, method=6)
    print(f'  {out.relative_to(DIST)} {im.size}')

for slug, (render, board) in SOURCES.items():
    save_webp(Image.open(IMG / render), DIST / f'assets/img/{slug}/render.webp', 1400, 82)
    save_webp(Image.open(IMG / board), DIST / f'assets/img/{slug}/board.webp', 1600, 80)

save_webp(Image.open(IMG / 'L5FreeWorlds.jpg'), DIST / 'assets/img/hero.webp', 1920, 82)

# logo + favicon from main site assets
(DIST / 'assets/img').mkdir(parents=True, exist_ok=True)
for src, dst in [(WEB_IMG / 'logo144.png', 'glyph.png'), (WEB_IMG / 'favicon.png', 'favicon.png')]:
    if src.exists():
        im = Image.open(src)
        out = DIST / 'assets/img' / dst
        im.save(out)
        print(f'  {out.relative_to(DIST)} {im.size}')
    else:
        print(f'  !! missing {src}')
