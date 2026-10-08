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
    'genesis-garden': ('Zahrada Genesis_ Cesta k nové Zemi.png', 'GenesisProject_Sabacheira.png'),
    'dharma-temple': ('Dharma.png', 'DharmaProject.png'),
    'te-piko-ora': ('Piko.png', 'PikoProject.png'),
    'golden-republic-bohemia': ('Bohemia.jpg', 'BohemiaProjekt.jpg'),
    'bodhi-lanka': ('Lanka.jpg', 'LankaProject.jpg'),
    'lumi-nova-amerika': ('Lumi.png', 'Lumi project.png'),
    'uluru': ('Uluru copy.png', 'UluruProject.png'),
    # TODO(interim): board is placeholder art — replace with real vessel masterplan
    'maria-del-camino': ('L5Hero.png', 'MariaDelCaminoProject.png'),
    # TODO(interim): board is placeholder art — replace with real cape masterplan
    'boa-esperanca': ('BoaEsp.jpg', 'BoaEsperancaProject.png'),
    # TODO(interim): board is placeholder art — replace with real temple masterplan
    'ekam': ('Ekam.png', 'EkamProject.png'),
    'kailash': ('Kailash_ Brána k sobě.png', 'KailashProject.png'),
    # TODO(interim): board is placeholder art — replace with real halls masterplan
    'amenti': ('Amenti.jpg', 'AmentiProject.png'),
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

hero_src = Image.open(IMG.parent / 'Hero.png')
save_webp(hero_src.copy(), DIST / 'assets/img/hero.webp', 1920, 84)
save_webp(hero_src, DIST / 'assets/img/hero-m.webp', 900, 82)

# brand marks — original ZION tree-Z mark (nav + favicon) and the wide
# chain-link glyph (footer brand). Sources live in IntroPage public/.
INTRO_PUBLIC = REPO / 'APP&WEB/IntroPage/public'
(DIST / 'assets/img').mkdir(parents=True, exist_ok=True)
for src, dst, size in [
    (INTRO_PUBLIC / 'symbol-200x200.png', 'mark.png', 200),
    (INTRO_PUBLIC / 'symbol-200x200.png', 'favicon.png', 64),
    (INTRO_PUBLIC / 'glyph-transparent.png', 'glyph.png', 800),
]:
    if src.exists():
        im = Image.open(src)
        if im.width > size:
            im = im.resize((size, int(im.height * size / im.width)), Image.LANCZOS)
        out = DIST / 'assets/img' / dst
        im.save(out)
        print(f'  {out.relative_to(DIST)} {im.size}')
    else:
        print(f'  !! missing {src}')
