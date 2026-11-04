#!/usr/bin/env python3
"""Obálky osmi edic Království srdce (600×900, JPEG).

Nejsou to ilustrace ani fotky — je to typografická obálka, která drží jednotný
vizuál mřížky edic na detailu produktu. Skutečné obálky PDF/EPUB řeší sazečka
`canon/.../EDITION/_scripts/build_edition.py`.

Použití:  python3 apps/MarketPlace/scripts/gen-edition-covers.py
"""
from __future__ import annotations

import pathlib
from PIL import Image, ImageDraw, ImageFont

W, H = 600, 900
ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "shop" / "img" / "books" / "editions"

FONT_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
FONT_REG = "/System/Library/Fonts/Supplemental/Arial.ttf"
GOLD = (252, 209, 22)

EDITIONS = [
    ("nova-plavba", "NOVÁ PLOVBA", "Ilustrovaná vlajková edice", (252, 209, 22), "13 880 slov"),
    ("klasicka", "KLASICKÁ", "Původní midraš, deset zastavení", (196, 154, 108), "5 220 slov"),
    ("cloude", "CEDROVÝ KÝL", "Literární rozšíření", (92, 156, 122), "15 338 slov"),
    ("gemini", "SVORNÍK", "Korpus čtyřiadvaceti kapitol", (122, 148, 210), "24 863 slov"),
    ("gpt", "TESAŘ", "Který zůstává u práce", (210, 132, 96), "6 435 slov"),
    ("groq", "LOĎ, KTERÁ SE PTÁ", "Otázky místo odpovědí", (132, 178, 206), "7 441 slov"),
    ("quen", "ÚČETNICE", "Loď, která nemá uzavřený účet", (170, 140, 190), "5 903 slov"),
    ("deepseek", "KNIHA KÝLU", "Vyprávěno dřevem", (198, 104, 96), "22 986 slov"),
]


def vgrad(w: int, h: int, top: tuple[int, int, int], bottom: tuple[int, int, int]) -> Image.Image:
    img = Image.new("RGB", (1, h))
    px = img.load()
    for y in range(h):
        t = y / max(1, h - 1)
        px[0, y] = tuple(round(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
    return img.resize((w, h), Image.BILINEAR)


def wrap(text: str, font: ImageFont.FreeTypeFont, max_w: int) -> list[str]:
    words, lines, cur = text.split(), [], ""
    for w in words:
        trial = f"{cur} {w}".strip()
        if font.getlength(trial) <= max_w or not cur:
            cur = trial
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def cover(slug: str, title: str, line: str, accent: tuple[int, int, int], words: str) -> None:
    base = vgrad(W, H, (16, 16, 20), (26, 22, 14)).convert("RGBA")
    d = ImageDraw.Draw(base)

    # horní barevný pás = identita edice
    d.rectangle((0, 0, W, 10), fill=accent + (255,))
    d.rounded_rectangle((36, 36, W - 36, H - 36), radius=18, outline=(255, 255, 255, 34), width=1)

    f_title = ImageFont.truetype(FONT_BOLD, 62)
    f_line = ImageFont.truetype(FONT_REG, 26)
    f_small = ImageFont.truetype(FONT_REG, 22)
    f_mini = ImageFont.truetype(FONT_BOLD, 18)

    # Řada edic
    d.text((64, 76), "KRÁLOVSTVÍ SRDCE", font=f_mini, fill=accent + (255,))

    lines = wrap(title, f_title, W - 128)
    y = 300 - (len(lines) * 72) // 2
    for ln in lines:
        d.text((64, y), ln, font=f_title, fill=(244, 244, 244))
        y += 72

    # zlatá linka
    d.rectangle((64, y + 24, 156, y + 27), fill=accent + (255,))

    y += 56
    for ln in wrap(line, f_line, W - 128):
        d.text((64, y), ln, font=f_line, fill=(176, 176, 182))
        y += 36

    # dolní metadata
    d.text((64, H - 132), words, font=f_small, fill=(140, 140, 148))
    d.text((64, H - 100), "PDF · EPUB", font=f_small, fill=(140, 140, 148))
    d.text((64, H - 64), "ZION · TerraNova", font=f_mini, fill=(96, 96, 104))

    OUT.mkdir(parents=True, exist_ok=True)
    p = OUT / f"{slug}.jpg"
    base.convert("RGB").save(p, "JPEG", quality=88, optimize=True, progressive=True)
    print("wrote", p.relative_to(ROOT))


if __name__ == "__main__":
    for slug, title, line, accent, words in EDITIONS:
        cover(slug, title, line, accent, words)
