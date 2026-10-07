#!/usr/bin/env python3
"""GenesisProject.png board — relocate labels Algarve -> Sabacheira/Tomar.

Writes GenesisProject_Sabacheira.png.
  1. 'ALGARVE · PORTUGAL'      -> 'SABACHEIRA · TOMAR · PORTUGAL' (header)
  2. legend 'Pobřežní stezka k oceánu' -> 'Cesta k pramenu Nabão'
  3. caption 'POHLED OD OCEÁNU' -> 'POHLED OD VODY'
"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter

SRC = "GenesisProject.png"
DST = "GenesisProject_Sabacheira.png"
im = Image.open(SRC).convert("RGB")
W, H = im.size
px = im.load()

def blur_fill(x0, x1, y0, y1, pad=6, radius=8):
    """Replace region with a heavily blurred version of itself (with pad)."""
    box = (max(0, x0 - pad), max(0, y0 - pad), min(W, x1 + pad), min(H, y1 + pad))
    reg = im.crop(box).filter(ImageFilter.GaussianBlur(radius))
    inner = (pad, pad, reg.width - pad, reg.height - pad)
    im.paste(reg.crop(inner), (x0, y0))

def draw_spaced(d, cx, y, text, font, fill, spacing=4):
    widths = [d.textlength(ch, font=font) for ch in text]
    total = sum(widths) + spacing * (len(text) - 1)
    x = cx - total / 2
    for ch, w in zip(text, widths):
        d.text((x, y), ch, font=font, fill=fill)
        x += w + spacing
    return total

SER = "/System/Library/Fonts/Supplemental/Times New Roman.ttf"
SANS = "/System/Library/Fonts/Helvetica.ttc"

# ── 1. Header: 'ALGARVE · PORTUGAL' at x473-648, y~128-152 ──
blur_fill(420, 700, 124, 156, pad=10, radius=11)
im2 = im.crop((410, 116, 710, 164)).filter(ImageFilter.GaussianBlur(1.4))
im.paste(im2, (410, 116))
d = ImageDraw.Draw(im)
f_hdr = ImageFont.truetype(SER, 11)
draw_spaced(d, 560, 133, "SABACHEIRA · TOMAR · PORTUGAL", f_hdr, (118, 96, 52), spacing=3)

# ── 2. Legend 13: white text x~1420-1553, y399-416; keep number circle left ──
blur_fill(1408, 1562, 395, 420, pad=8, radius=7)
d = ImageDraw.Draw(im)
f_leg = ImageFont.truetype(SANS, 12)
t = "Cesta k pramenu Nabão"
tw = d.textlength(t, font=f_leg)
d.text((1555 - tw, 400), t, font=f_leg, fill=(250, 248, 244),
       stroke_width=1, stroke_fill=(58, 60, 48))

# ── 3. Caption 'POHLED OD OCEÁNU' -> flat paper fill + redraw ──
d = ImageDraw.Draw(im)
d.rectangle([1330, 750, 1567, 776], fill=(243, 239, 235))
f_cap = ImageFont.truetype(SER, 13)
draw_spaced(d, 1450, 755, "POHLED OD VODY", f_cap, (90, 78, 60), spacing=3)

im.save(DST)
print("saved", DST, im.size)
