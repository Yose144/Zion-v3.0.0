#!/usr/bin/env python3
"""Vygeneruje brandované dlaždice pro produkty, kterým v repu chybí fotka.

Proč: 7 produktů odkazovalo na obrázky, které v `public/shop/img/**` vůbec
nejsou → karta spadla na ikonový fallback. Tyhle dlaždice nejsou náhradou
fotky, jen drží vizuální jazyk e-shopu (tmavá plocha + zlatý akcent + název),
dokud se nedodá skutečný produktový snímek.

Použití:  python3 apps/MarketPlace/scripts/gen-placeholder-images.py
Závislosti: Pillow
"""
from __future__ import annotations

import pathlib
from PIL import Image, ImageDraw, ImageFont

W = H = 1200
ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "shop" / "img"

FONT_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
FONT_REG = "/System/Library/Fonts/Supplemental/Arial.ttf"

GOLD = (252, 209, 22)


def gradient(w: int, h: int, top: tuple[int, int, int], bottom: tuple[int, int, int]) -> Image.Image:
    img = Image.new("RGB", (1, h))
    px = img.load()
    for y in range(h):
        t = y / max(1, h - 1)
        px[0, y] = tuple(round(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
    return img.resize((w, h), Image.BILINEAR)


def glow(base: Image.Image, center_x: int, center_y: int, radius: int) -> None:
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    steps = 26
    for i in range(steps, 0, -1):
        r = int(radius * i / steps)
        alpha = int(26 * (1 - i / steps) ** 1.4) + 2
        d.ellipse(
            (center_x - r, center_y - r, center_x + r, center_y + r),
            fill=GOLD + (alpha,),
        )
    base.alpha_composite(layer)


def wrap(text: str, font: ImageFont.FreeTypeFont, max_w: int) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        trial = f"{current} {word}".strip()
        if font.getlength(trial) <= max_w or not current:
            current = trial
        else:
            lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def tile(path: pathlib.Path, eyebrow: str, title: str) -> None:
    base = gradient(W, H, (14, 14, 18), (28, 22, 8)).convert("RGBA")
    glow(base, W // 2, int(H * 0.42), int(W * 0.55))

    d = ImageDraw.Draw(base)
    # jemný zlatý rám
    d.rounded_rectangle((48, 48, W - 48, H - 48), radius=28, outline=GOLD + (70,), width=2)

    f_eyebrow = ImageFont.truetype(FONT_BOLD, 30)
    f_title = ImageFont.truetype(FONT_BOLD, 92)
    f_foot = ImageFont.truetype(FONT_REG, 28)

    # eyebrow s prostrkáním
    spaced = " ".join(eyebrow.upper())
    ew = f_eyebrow.getlength(spaced)
    d.text(((W - ew) / 2, int(H * 0.30)), spaced, font=f_eyebrow, fill=GOLD)

    lines = wrap(title, f_title, int(W * 0.78))
    total_h = len(lines) * 108
    y = int(H * 0.42) - total_h // 2
    for line in lines:
        lw = f_title.getlength(line)
        d.text(((W - lw) / 2, y), line, font=f_title, fill=(245, 245, 245))
        y += 108

    foot = "ZION · Království srdce"
    fw = f_foot.getlength(foot)
    d.text(((W - fw) / 2, int(H * 0.83)), foot, font=f_foot, fill=(255, 255, 255, 150))

    path.parent.mkdir(parents=True, exist_ok=True)
    base.convert("RGB").save(path, "JPEG", quality=86, optimize=True, progressive=True)
    print("wrote", path.relative_to(ROOT), base.size)


ITEMS = [
    ("woodart/dom.jpeg", "WoodArt", "Dětský domek na stromě"),
    ("engraving/qrcode.jpg", "Gravírování", "QR kód vizitka"),
    ("digital/dev.jpg", "Digitální", "Web Development"),
    ("digital/lotos2.jpg", "Digitální", "Fullstack aplikace"),
    ("digital/miner-pro.jpg", "Software", "Miner Pro Desktop"),
    ("digital/pool-license.jpg", "Software", "DAO Pool License"),
    ("digital/farm-bundle.jpg", "Hardware", "Zion RTX 5060 Rig"),
]


if __name__ == "__main__":
    for rel, eyebrow, title in ITEMS:
        tile(OUT / rel, eyebrow, title)
