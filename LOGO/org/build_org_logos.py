#!/usr/bin/env python3
"""Build the LOGO/org brand package from LOGO/symbol.png.

Run from repo root:
    python3 LOGO/org/build_org_logos.py

Requires: Pillow (already used by LOGO/gem/ and LOGO/gtp/ build scripts).
The canonical source is the new raster symbol in LOGO/symbol.png.
"""

import base64
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

LOGO_DIR = Path(__file__).resolve().parent.parent
SRC = LOGO_DIR / "symbol.png"
OUT = LOGO_DIR / "org"

FONT_PATH = "/System/Library/Fonts/Helvetica.ttc"
FONT_BOLD_IDX = 1
FONT_REG_IDX = 0

SYMBOL_SIZES = [1024, 512, 256, 200]
FAVICON_SIZES = [16, 32, 48, 64, 128, 144, 180, 192, 256, 512]


def load_font(size, bold=False):
    idx = FONT_BOLD_IDX if bold else FONT_REG_IDX
    return ImageFont.truetype(FONT_PATH, size, index=idx)


def clean_symbol(src):
    img = Image.open(src).convert("RGBA")
    w, h = img.size

    # Paint over the small top-left AI/stray mark with the corner background.
    # The real symbol does not extend into this corner.
    corner = img.getpixel((0, 0))
    for y in range(100):
        for x in range(100):
            img.putpixel((x, y), corner)

    # Flood-fill background from all four corners.
    for sx, sy in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
        ImageDraw.floodfill(img, (sx, sy), (0, 0, 0, 0), thresh=45)

    # Remove internal white/bright background holes while preserving the
    # colored symbol (gold, emerald, red, brown).
    data = list(img.getdata())
    cleaned = []
    for r, g, b, a in data:
        if a and (r > 235 and g > 235 and b > 235):
            cleaned.append((0, 0, 0, 0))
        elif a:
            mx, mn = max(r, g, b), min(r, g, b)
            if mx > 230 and (mx - mn) < 25:
                cleaned.append((0, 0, 0, 0))
            else:
                cleaned.append((r, g, b, a))
        else:
            cleaned.append((0, 0, 0, 0))
    img.putdata(cleaned)

    # Crop to content and place on a square transparent canvas.
    bbox = img.getbbox()
    if not bbox:
        return img
    cropped = img.crop(bbox)
    cw, ch = cropped.size
    side = max(cw, ch)
    sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    sq.paste(cropped, ((side - cw) // 2, (side - ch) // 2), cropped)
    return sq


def resize_to(img, size, resample=Image.Resampling.LANCZOS):
    return img.resize((size, size), resample)


def save_png(img, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, "PNG")


def make_icon_variants(symbol):
    for size in SYMBOL_SIZES:
        save_png(resize_to(symbol, size), OUT / f"symbol-{size}x{size}.png")
    for size in FAVICON_SIZES:
        save_png(resize_to(symbol, size), OUT / f"favicon-{size}.png")
    save_png(resize_to(symbol, 512), OUT / "favicon.png")
    ico = resize_to(symbol, 512)
    ico.save(OUT / "favicon.ico", sizes=[
        (16, 16), (32, 32), (48, 48), (64, 64),
        (128, 128), (256, 256), (512, 512)
    ])


def make_wordmark(symbol, name, bg, text_color, sub_color, is_dark=True):
    canvas = Image.new("RGBA", (1200, 600), bg)
    sym = resize_to(symbol, 320)
    canvas.paste(sym, (110, 140), sym)
    draw = ImageDraw.Draw(canvas)
    main_font = load_font(170, bold=True)
    sub_font = load_font(56, bold=False)
    draw.text((510, 205), "ZION", font=main_font, fill=text_color)
    draw.text((515, 370), "TERRA NOVA", font=sub_font, fill=sub_color)
    save_png(canvas, OUT / name)


def make_banner(symbol):
    # dark cosmic background
    bg = Image.new("RGBA", (1200, 630), (10, 15, 25, 255))
    # subtle starfield dots
    draw = ImageDraw.Draw(bg)
    for x, y in [(120, 95), (980, 120), (1040, 90), (160, 570), (1070, 540), (90, 350)]:
        draw.ellipse((x, y, x + 3, y + 3), fill=(230, 230, 240, 180))
    sym = resize_to(symbol, 410)
    bg.paste(sym, (90, 110), sym)
    main_font = load_font(150, bold=True)
    sub_font = load_font(60, bold=False)
    draw.text((560, 220), "ZION", font=main_font, fill=(255, 255, 255, 255))
    draw.text((565, 390), "TERRA NOVA", font=sub_font, fill=(180, 180, 180, 255))
    save_png(bg, OUT / "zion-social-banner.png")


def make_app_icons(symbol):
    # primary cosmic - dark space background, symbol centered with soft glow
    primary = Image.new("RGBA", (1024, 1024), (13, 17, 30, 255))
    sym = resize_to(symbol, 720)
    # soft gold-tinted glow behind the symbol
    glow = sym.filter(ImageFilter.GaussianBlur(radius=25))
    # tint glow gold by blending with a gold layer
    gold_layer = Image.new("RGBA", glow.size, (255, 210, 80, 80))
    glow = Image.blend(glow, gold_layer, alpha=0.5)
    primary.paste(glow, (152, 152), glow)
    primary.paste(sym, (152, 152), sym)
    save_png(primary, OUT / "zion-primary-cosmic.png")

    # gold-emerald gradient background
    gem = Image.new("RGBA", (1024, 1024))
    d = ImageDraw.Draw(gem)
    for y in range(1024):
        t = y / 1023
        r = int(255 * (1 - t) + 0 * t)
        g = int(215 * (1 - t) + 150 * t)
        b = int(0 * (1 - t) + 80 * t)
        d.line([(0, y), (1023, y)], fill=(r, g, b, 255))
    gem.paste(resize_to(symbol, 640), (192, 192), resize_to(symbol, 640))
    save_png(gem, OUT / "zion-gold-emerald.png")

    # light background
    light = Image.new("RGBA", (1024, 1024), (245, 247, 250, 255))
    sym = resize_to(symbol, 680)
    light.paste(sym, (172, 172), sym)
    save_png(light, OUT / "zion-light-background.png")


def make_exchange_marks(symbol):
    for size in (200, 256, 512):
        save_png(resize_to(symbol, size), OUT / f"zion-exchange-mark-{size}.png")


def make_svg_wrappers(symbol_data):
    """Create SVG wrappers that embed the bitmap for compatibility.

    These are not true vector files. They are provided for convenience so
    `*.svg` deliverables exist, matching the `gtp` package structure. A real
    vector version would need an original SVG source.
    """
    def svg_wrap(width, height, b64, mime="image/png"):
        return (
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}">\n'
            f'  <image href="data:{mime};base64,{b64}" width="{width}" height="{height}"/>\n'
            f'</svg>\n'
        )

    # symbol.svg (512-based, keeps file size reasonable)
    b64_symbol = base64.b64encode((OUT / "symbol-512x512.png").read_bytes()).decode()
    (OUT / "symbol.svg").write_text(svg_wrap(512, 512, b64_symbol))

    # favicon.svg
    b64_fav = base64.b64encode((OUT / "favicon-256.png").read_bytes()).decode()
    (OUT / "favicon.svg").write_text(svg_wrap(256, 256, b64_fav))


def build():
    print("Cleaning LOGO/symbol.png...")
    symbol = clean_symbol(SRC)
    save_png(symbol, OUT / "symbol-1024x1024.png")

    print("Building icon sizes and favicons...")
    make_icon_variants(symbol)

    print("Building wordmarks...")
    make_wordmark(symbol, "zion-wordmark-dark.png",
                  bg=(18, 22, 32, 255),
                  text_color=(255, 255, 255, 255),
                  sub_color=(200, 200, 200, 255),
                  is_dark=True)
    make_wordmark(symbol, "zion-wordmark-light.png",
                  bg=(255, 255, 255, 255),
                  text_color=(20, 45, 25, 255),
                  sub_color=(80, 100, 80, 255),
                  is_dark=False)

    print("Building social banner...")
    make_banner(symbol)

    print("Building app icon variants...")
    make_app_icons(symbol)

    print("Building exchange marks...")
    make_exchange_marks(symbol)

    print("Building SVG wrappers...")
    make_svg_wrappers(None)

    print(f"Done. Assets written to {OUT}")


if __name__ == "__main__":
    build()
