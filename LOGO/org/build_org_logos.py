#!/usr/bin/env python3
"""Build the LOGO/org brand package from the canonical raster logo.

Usage:
    python3 LOGO/org/build_org_logos.py
    python3 LOGO/org/build_org_logos.py --source LOGO/symbol.png

Requires: Pillow (already used by other LOGO build scripts).
On macOS, iconutil must be available for .icns output.
The default canonical source is LOGO/ZionLogo.png.
"""

import argparse
import base64
import shutil
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

LOGO_DIR = Path(__file__).resolve().parent.parent
DEFAULT_SRC = LOGO_DIR / "ZionLogo.png"
OUT = LOGO_DIR / "org"

FONT_PATH = "/System/Library/Fonts/Helvetica.ttc"
FONT_BOLD_IDX = 1
FONT_REGULAR_IDX = 0

SYMBOL_SIZES = [1024, 512, 256, 200]
FAVICON_SIZES = [16, 32, 48, 64, 128, 144, 180, 192, 256, 512]


def load_font(size, bold=False):
    idx = FONT_BOLD_IDX if bold else FONT_REGULAR_IDX
    return ImageFont.truetype(FONT_PATH, size, index=idx)


def remove_top_left_watermark(img, size=100):
    """Paint over the small top-left watermark using the corner color."""
    corner = img.getpixel((0, 0))
    for y in range(size):
        for x in range(size):
            img.putpixel((x, y), corner)


def flood_fill_background(img, threshold=45):
    """Flood fill the background from all four corners."""
    w, h = img.size
    for sx, sy in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
        ImageDraw.floodfill(img, (sx, sy), (0, 0, 0, 0), thresh=threshold)


def remove_white_holes(img):
    """Remove internal white/bright background holes while preserving the symbol.

    Only relevant for the legacy symbol.png which had a bright background and
    occasional stray bright pixels inside the symbol.
    """
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


def clean_symbol(src, new_logo=True):
    img = Image.open(src).convert("RGBA")

    remove_top_left_watermark(img)
    flood_fill_background(img, threshold=45)

    if not new_logo:
        remove_white_holes(img)

    # Crop to content and center on a square transparent canvas.
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
    ico.save(
        OUT / "favicon.ico",
        sizes=[
            (16, 16), (32, 32), (48, 48), (64, 64),
            (128, 128), (256, 256), (512, 512),
        ],
    )


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
    bg = Image.new("RGBA", (1200, 630), (10, 15, 25, 255))
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
    glow = sym.filter(ImageFilter.GaussianBlur(radius=25))
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


def make_desktop_ico(source_png, out_path):
    """Create a Windows .ico from a 1024x1024 source."""
    sizes = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    ico = resize_to(source_png, 512)
    ico.save(out_path, format="ICO", sizes=sizes)


def make_desktop_icns(source_png, out_path):
    """Create a macOS .icns from a 1024x1024 source using iconutil."""
    iconset = tempfile.mkdtemp(prefix="zion_iconset_")
    try:
        iconset_path = Path(iconset) / "ZionLogo.iconset"
        iconset_path.mkdir()

        sizes = [
            (16, 16),
            (16, 16),
            (32, 32),
            (32, 32),
            (128, 128),
            (128, 128),
            (256, 256),
            (256, 256),
            (512, 512),
            (512, 512),
        ]
        names = [
            "icon_16x16.png",
            "icon_16x16@2x.png",
            "icon_32x32.png",
            "icon_32x32@2x.png",
            "icon_128x128.png",
            "icon_128x128@2x.png",
            "icon_256x256.png",
            "icon_256x256@2x.png",
            "icon_512x512.png",
            "icon_512x512@2x.png",
        ]

        for (w, h), name in zip(sizes, names):
            # @2x entries are double the logical size.
            if "@2x" in name:
                out_size = w * 2
            else:
                out_size = w
            img = resize_to(source_png, out_size)
            img.save(iconset_path / name)

        subprocess.run(["iconutil", "-c", "icns", "-o", str(out_path), str(iconset_path)], check=True)
    finally:
        shutil.rmtree(iconset, ignore_errors=True)


def make_mobile_splash(source_png, out_path):
    """Create a 1242x2208 splash screen for Expo / mobile."""
    canvas = Image.new("RGBA", (1242, 2208), (10, 12, 28, 255))
    sym = resize_to(source_png, 720)
    x = (1242 - sym.width) // 2
    y = (2208 - sym.height) // 2
    canvas.paste(sym, (x, y), sym)
    save_png(canvas, out_path)


def make_svg_wrappers():
    """Create SVG wrappers that embed the generated bitmap for compatibility."""
    def svg_wrap(width, height, b64, mime="image/png"):
        return (
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}">\n'
            f'  <image href="data:{mime};base64,{b64}" width="{width}" height="{height}"/>\n'
            f'</svg>\n'
        )

    b64_symbol = base64.b64encode((OUT / "symbol-512x512.png").read_bytes()).decode()
    (OUT / "symbol.svg").write_text(svg_wrap(512, 512, b64_symbol))

    b64_fav = base64.b64encode((OUT / "favicon-256.png").read_bytes()).decode()
    (OUT / "favicon.svg").write_text(svg_wrap(256, 256, b64_fav))


def build(source, new_logo=True):
    print(f"Cleaning {source}...")
    symbol = clean_symbol(source, new_logo=new_logo)
    save_png(symbol, OUT / "symbol-1024x1024.png")

    print("Building icon sizes and favicons...")
    make_icon_variants(symbol)

    print("Building wordmarks...")
    make_wordmark(
        symbol,
        "zion-wordmark-dark.png",
        bg=(18, 22, 32, 255),
        text_color=(255, 255, 255, 255),
        sub_color=(200, 200, 200, 255),
        is_dark=True,
    )
    make_wordmark(
        symbol,
        "zion-wordmark-light.png",
        bg=(255, 255, 255, 255),
        text_color=(20, 45, 25, 255),
        sub_color=(80, 100, 80, 255),
        is_dark=False,
    )

    print("Building social banner...")
    make_banner(symbol)

    print("Building app icon variants...")
    make_app_icons(symbol)

    print("Building exchange marks...")
    make_exchange_marks(symbol)

    print("Building desktop .ico and .icns...")
    cosmic = Image.open(OUT / "zion-primary-cosmic.png").convert("RGBA")
    make_desktop_ico(cosmic, OUT / "zion-desktop.ico")
    make_desktop_icns(cosmic, OUT / "zion-desktop.icns")

    print("Building mobile splash and adaptive icon...")
    save_png(symbol, OUT / "zion-mobile-adaptive-icon.png")
    make_mobile_splash(cosmic, OUT / "zion-mobile-splash.png")

    print("Building SVG wrappers...")
    make_svg_wrappers()

    print(f"Done. Assets written to {OUT}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Build the ZION brand package.")
    parser.add_argument(
        "--source",
        default=str(DEFAULT_SRC),
        help="Path to the canonical raster logo (default: LOGO/ZionLogo.png).",
    )
    parser.add_argument(
        "--legacy-symbol",
        action="store_true",
        help="Use legacy symbol.png cleaning (white background).",
    )
    args = parser.parse_args()
    build(Path(args.source), new_logo=not args.legacy_symbol)
