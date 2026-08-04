#!/usr/bin/env python3
"""Build the ZION Davinci brand package from LOGO/Davinci.png.

Davinci.png is a 3D rendered raster master (2048x2048, white background,
JPEG despite .png extension). This script produces the standard brand
deliverables:

  - App / social / web avatar
  - Dark and light wordmarks and banners
  - Exchange mark
  - Favicon bundle (ico + sizes)
  - SVG wrappers (PNG embedded; not true vector)

The SVGs are raster-in-vector wrappers. They scale fine at the sizes
listed below, but they are NOT a replacement for a real vector master.
For a true vector SVG the render must be retraced in Illustrator/Inkscape
or regenerated from a 3D/vector source.

Requires: python3, Pillow
"""

from pathlib import Path
import base64
import io
import subprocess
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance, ImageChops

SRC = Path("/Users/yeshuae/Projects/2.9.6/LOGO/Davinci.png")
OUT = Path(__file__).parent

# Brand colours extracted from Davinci.png
ZION_GREEN = "#00ff88"
FOREST_GREEN = "#0b7b4d"
GOLD = "#d4af37"
DARK_BG = "#0a0f0a"
LIGHT_BG = "#ffffff"
SUB_TEXT = "#7a9e8a"

# Try to find a usable sans-serif font for wordmarks
FONT_PATHS = [
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
]


def find_font():
    for p in FONT_PATHS:
        if Path(p).exists():
            return str(p)
    return None


def load_source():
    """Load Davinci.png and pre-crop tightly to the circular content.

    Davinci.png is 2048x2048 but the visible circular logo sits in the
    middle with a radius of ~770 px. Cropping to a 1560x1560 square
    around the content lets the ring fill the output circle.
    """
    img = Image.open(SRC).convert("RGBA")
    # Content center is slightly offset from the image center.
    cx, cy = 1022, 1026
    # Outer ring radius is ~770 px. Add a small safety margin.
    radius = 790
    crop_size = radius * 2
    left = max(0, cx - radius)
    top = max(0, cy - radius)
    right = left + crop_size
    bottom = top + crop_size
    return img.crop((left, top, right, bottom))


def make_circular_mask(size, radius=None):
    """Return an L-mode circular mask of `size` (inset slightly to avoid edge)."""
    mask = Image.new("L", size, 0)
    draw = ImageDraw.Draw(mask)
    w, h = size
    r = radius or (min(w, h) // 2 - 2)
    cx, cy = w // 2, h // 2
    draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=255)
    return mask


def circular_crop(img, size, padding=0.02):
    """Crop img to a circle on a transparent background, then resize to `size`."""
    # First crop to a square around the largest inscribed circle
    src_w, src_h = img.size
    assert src_w == src_h, "Source must be square"

    # Work on a copy
    sq = img.copy()

    # Mask outside the circle as transparent
    mask = make_circular_mask(sq.size)
    r, g, b, a = sq.split()
    out = Image.merge("RGBA", (r, g, b, ImageChops.multiply(a, mask)))

    # Resize to target
    if padding:
        # Compute target with padding, then paste centered
        p = int(min(size) * padding)
        target = min(size) - 2 * p
        scaled = out.resize((target, target), Image.Resampling.LANCZOS)
        canvas = Image.new("RGBA", size, (0, 0, 0, 0))
        canvas.paste(scaled, (p, p), scaled)
        return canvas
    else:
        return out.resize(size, Image.Resampling.LANCZOS)


def add_glow_ring(img, color=ZION_GREEN, width=3, blur=8, radius=None):
    """Draw a soft neon ring around the circular logo."""
    w, h = img.size
    ring = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(ring)
    r = radius or (min(w, h) // 2)
    cx, cy = w // 2, h // 2
    for i in range(width, 0, -1):
        alpha = int(120 / (i + 1))
        c = parse_color(color) + (alpha,)
        draw.ellipse((cx - r - i, cy - r - i, cx + r + i, cy + r + i),
                     outline=c, width=1)
    ring = ring.filter(ImageFilter.GaussianBlur(blur))
    return Image.alpha_composite(ring, img)


def parse_color(c):
    c = c.lstrip("#")
    return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4))


def make_solid_background(size, color):
    return Image.new("RGBA", size, parse_color(color) + (255,))


def make_radial_background(size, center_color, edge_color):
    """Create a radial gradient background (approximate with concentric circles)."""
    w, h = size
    cx, cy = w // 2, h // 2
    bg = Image.new("RGBA", size, parse_color(edge_color) + (255,))
    draw = ImageDraw.Draw(bg)
    c1 = parse_color(center_color)
    c2 = parse_color(edge_color)
    max_r = int((w ** 2 + h ** 2) ** 0.5 / 2)
    for r in range(max_r, 0, -2):
        t = r / max_r
        col = tuple(int(c1[i] * (1 - t) + c2[i] * t) for i in range(3))
        draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=col + (255,))
    return bg


def draw_text(draw, text, font, xy, color, anchor="lt", letter_spacing=0):
    """Draw text with optional letter spacing."""
    x, y = xy
    if letter_spacing == 0:
        draw.text(xy, text, font=font, fill=color, anchor=anchor)
        return
    # Draw character by character
    for ch in text:
        bbox = draw.textbbox((0, 0), ch, font=font)
        w = bbox[2] - bbox[0]
        draw.text((x, y), ch, font=font, fill=color, anchor=anchor)
        x += w + letter_spacing


def make_wordmark(size, *, dark=False, logo_scale=0.55, text="ZION", sub="TERRA NOVA"):
    """Create a 1200x630 wordmark/social banner."""
    w, h = size
    bg_color = DARK_BG if dark else LIGHT_BG
    text_color = LIGHT_BG if dark else DARK_BG
    sub_color = "#7a9e8a" if dark else "#4a6e5a"

    if dark:
        bg = make_radial_background(size, "#0f1a12", bg_color)
    else:
        bg = make_solid_background(size, LIGHT_BG)

    # Prepare logo, scaled and cropped circular. Fill 96% of the wordmark
    # circle so the ring sits close to the circular edge.
    logo_size = int(min(w, h) * logo_scale)
    src = load_source()
    logo = circular_crop(src, (logo_size, logo_size), padding=0.0)
    # For dark mode add a subtle glow ring
    if dark:
        logo = add_glow_ring(logo, color=ZION_GREEN, width=4, blur=12,
                             radius=logo_size // 2)

    # Position logo on the left
    logo_x = int(w * 0.12)
    logo_y = (h - logo_size) // 2
    bg.paste(logo, (logo_x, logo_y), logo)

    # Text on the right
    font_bold = find_font()
    if font_bold:
        font_zion = ImageFont.truetype(font_bold, 96)
        font_sub = ImageFont.truetype(font_bold, 22)
    else:
        font_zion = ImageFont.load_default()
        font_sub = ImageFont.load_default()

    draw = ImageDraw.Draw(bg)
    text_x = logo_x + logo_size + int(w * 0.08)
    text_y = h // 2 - 60

    draw_text(draw, text, font_zion, (text_x, text_y), text_color,
              anchor="lt", letter_spacing=14)

    # Subtext
    sub_y = text_y + 105
    draw_text(draw, sub, font_sub, (text_x + 4, sub_y), sub_color,
              anchor="lt", letter_spacing=8)

    return bg


def make_favicon_bundle():
    """Favicon with high contrast: dark circular background, no transparent edges.

    The light/white version is invisible in browser tabs; the dark version
    keeps the Z tree legible at 16x16.
    """
    src = load_source()
    size = 512
    # Build a dark background canvas and place a large, circular logo on it.
    canvas = make_solid_background((size, size), DARK_BG)
    logo_size = int(size * 0.96)
    logo = circular_crop(src, (logo_size, logo_size), padding=0.0)
    # Add a bright green glow ring so the mark pops at small sizes.
    logo = add_glow_ring(logo, color=ZION_GREEN, width=4, blur=10,
                         radius=logo_size // 2)
    x = (size - logo_size) // 2
    y = (size - logo_size) // 2
    canvas.paste(logo, (x, y), logo)
    favicon = canvas
    favicon.save(OUT / "favicon.png")

    # Save individual sizes
    sizes = [16, 32, 48, 64, 128, 180, 192, 256, 512]
    imgs = []
    for px in sizes:
        ico = favicon.resize((px, px), Image.Resampling.LANCZOS)
        ico.save(OUT / f"favicon-{px}.png")
        if px in (16, 32, 48):
            imgs.append(ico)

    # Multi-resolution ICO
    imgs[0].save(
        OUT / "favicon.ico",
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48)],
        append_images=imgs[1:],
    )


def make_avatar(name, size, *, background="white", glow=False, fill=0.96):
    """Create a square avatar: white bg, dark bg, or transparent."""
    src = load_source()
    logo_size = int(size * fill)
    logo = circular_crop(src, (logo_size, logo_size), padding=0.0)
    if glow:
        logo = add_glow_ring(logo, color=ZION_GREEN, width=4, blur=14,
                             radius=logo_size // 2)

    if background == "transparent":
        canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    elif background == "dark":
        canvas = make_radial_background((size, size), "#0f1a12", DARK_BG)
    else:
        canvas = make_solid_background((size, size), LIGHT_BG)

    x = (size - logo_size) // 2
    y = (size - logo_size) // 2
    canvas.paste(logo, (x, y), logo)
    canvas.save(OUT / f"{name}.png")

    # SVG wrapper with embedded PNG
    svg = wrap_png_in_svg(OUT / f"{name}.png", size, size, name)
    (OUT / f"{name}.svg").write_text(svg, encoding="utf-8")


def make_exchange_mark():
    """Simplified mark for exchange listings: circular, fills 98% of circle."""
    src = load_source()
    mark = circular_crop(src, (1024, 1024), padding=0.0)
    mark = add_glow_ring(mark, color=ZION_GREEN, width=3, blur=8, radius=510)
    mark.save(OUT / "zion-exchange-mark.png")

    svg = wrap_png_in_svg(OUT / "zion-exchange-mark.png", 1024, 1024,
                          "zion-exchange-mark")
    (OUT / "zion-exchange-mark.svg").write_text(svg, encoding="utf-8")


def wrap_png_in_svg(png_path, width, height, name):
    """Create an SVG that displays the PNG at 1:1 pixel size."""
    data = png_path.read_bytes()
    b64 = base64.b64encode(data).decode("ascii")
    return f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     viewBox="0 0 {width} {height}" width="{width}" height="{height}">
  <title>ZION Davinci — {name}</title>
  <desc>PNG-in-SVG wrapper. True vector source not available; generated from {SRC.name}.</desc>
  <image width="{width}" height="{height}" xlink:href="data:image/png;base64,{b64}"/>
</svg>'''


def make_wordmark_assets():
    wd = make_wordmark((1200, 630), dark=True, logo_scale=0.48)
    wd.save(OUT / "zion-wordmark-dark.png")
    (OUT / "zion-wordmark-dark.svg").write_text(
        wrap_png_in_svg(OUT / "zion-wordmark-dark.png", 1200, 630,
                        "zion-wordmark-dark"),
        encoding="utf-8")

    wl = make_wordmark((1200, 630), dark=False, logo_scale=0.48)
    wl.save(OUT / "zion-wordmark-light.png")
    (OUT / "zion-wordmark-light.svg").write_text(
        wrap_png_in_svg(OUT / "zion-wordmark-light.png", 1200, 630,
                        "zion-wordmark-light"),
        encoding="utf-8")

    # Social banner — slightly smaller text, larger logo
    social = make_wordmark((1200, 630), dark=True, logo_scale=0.52,
                           text="ZION TERRANOVA", sub="Proof-of-Work · 144B hard cap · Mainnet Alpha")
    social.save(OUT / "zion-social-banner.png")
    (OUT / "zion-social-banner.svg").write_text(
        wrap_png_in_svg(OUT / "zion-social-banner.png", 1200, 630,
                        "zion-social-banner"),
        encoding="utf-8")


def main():
    print("Building ZION Davinci brand package...")
    if not SRC.exists():
        raise FileNotFoundError(f"Source not found: {SRC}")

    OUT.mkdir(parents=True, exist_ok=True)

    # Primary app/social/website avatar (light bg) — logo fills 96% of circle
    make_avatar("zion-primary-cosmic", 1024, background="white", glow=False, fill=0.96)

    # Dark bg with glow ring (for dark mode / OASIS)
    make_avatar("zion-gold-emerald", 1024, background="dark", glow=True, fill=0.96)

    # Light background (documents, light interfaces)
    make_avatar("zion-light-background", 1024, background="white", glow=False, fill=0.96)

    # Transparent (for overlay on arbitrary backgrounds)
    make_avatar("zion-transparent", 1024, background="transparent", glow=False, fill=0.96)

    # Exchange mark
    make_exchange_mark()

    # Wordmarks and banner
    make_wordmark_assets()

    # Favicon bundle
    make_favicon_bundle()

    print(f"Done. Outputs in {OUT}/")


if __name__ == "__main__":
    main()
