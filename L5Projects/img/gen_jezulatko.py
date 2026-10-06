#!/usr/bin/env python3
"""Malý princ — Pražské Jezulátko, patron flotily Tres Marias.
Interim PIL render: zlatá postavička s korunkou a jablkem (orbem) v dlani,
stojící nad mořem; pod ní tři vlny roucha — červená, bílá, zlatá.
"""
from PIL import Image, ImageDraw, ImageFilter
import math, random

W, H = 1280, 900
img = Image.new("RGB", (W, H), (7, 12, 28))
d = ImageDraw.Draw(img, "RGBA")

# --- night sky gradient ---
for y in range(H):
    t = y / H
    r = int(7 + 18 * t)
    g = int(12 + 16 * t)
    b = int(28 + 30 * t)
    d.line([(0, y), (W, y)], fill=(r, g, b))

# --- stars ---
random.seed(7)
for _ in range(240):
    x = random.randint(0, W - 1)
    y = random.randint(0, int(H * 0.62))
    s = random.choice([1, 1, 1, 2])
    a = random.randint(60, 200)
    d.rectangle([x, y, x + s, y + s], fill=(255, 244, 210, a))

# --- sea ---
sea_top = int(H * 0.66)
for y in range(sea_top, H):
    t = (y - sea_top) / (H - sea_top)
    d.line([(0, y), (W, y)], fill=(int(10 + 12 * t), int(24 + 14 * t), int(48 + 10 * t)))
for _ in range(90):
    x = random.randint(0, W)
    y = random.randint(sea_top + 4, H - 6)
    w = random.randint(14, 90)
    d.line([(x, y), (x + w, y)], fill=(140, 190, 235, random.randint(14, 48)))

# --- glow behind the child ---
glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
gd = ImageDraw.Draw(glow)
cx, cy = W // 2, int(H * 0.40)
for rad in range(340, 40, -8):
    a = max(0, int(46 * (1 - rad / 340)))
    gd.ellipse([cx - rad, cy - rad, cx + rad, cy + rad], fill=(255, 208, 92, a))
img.paste(Image.alpha_composite(img.convert("RGBA"), glow).convert("RGB"), (0, 0))
d = ImageDraw.Draw(img, "RGBA")

GOLD = (245, 206, 92)
GOLD_HI = (255, 236, 160)
GOLD_DK = (150, 108, 34)

fig_cx = cx
head_y = cy - 150
head_r = 52

# --- mandorla / halo ring ---
d.ellipse([fig_cx - head_r - 26, head_y - head_r - 26,
           fig_cx + head_r + 26, head_y + head_r + 26],
          outline=(255, 226, 140, 160), width=6)
d.ellipse([fig_cx - head_r - 14, head_y - head_r - 14,
           fig_cx + head_r + 14, head_y + head_r + 14],
          outline=(255, 226, 140, 70), width=2)

# --- crown (behind head top) ---
cr_w = 62
cr_h = 34
cr_y = head_y - head_r - cr_h + 10
d.polygon([
    (fig_cx - cr_w, head_y - head_r + 12),
    (fig_cx - cr_w, cr_y + cr_h - 8),
    (fig_cx - cr_w + 10, cr_y + 10),
    (fig_cx - cr_w + 24, cr_y + cr_h - 14),
    (fig_cx, cr_y),
    (fig_cx + cr_w - 24, cr_y + cr_h - 14),
    (fig_cx + cr_w - 10, cr_y + 10),
    (fig_cx + cr_w, cr_y + cr_h - 8),
    (fig_cx + cr_w, head_y - head_r + 12),
], fill=GOLD, outline=GOLD_DK)
# cross on crown
d.line([(fig_cx, cr_y - 16), (fig_cx, cr_y + 2)], fill=GOLD_HI, width=5)
d.line([(fig_cx - 9, cr_y - 9), (fig_cx + 9, cr_y - 9)], fill=GOLD_HI, width=5)

# --- robe (bell silhouette) ---
robe_top = head_y + head_r - 6
robe_bot = sea_top - 8
shoulder_w = 66
hem_w = 150
d.polygon([
    (fig_cx - shoulder_w, robe_top),
    (fig_cx + shoulder_w, robe_top),
    (fig_cx + hem_w, robe_bot),
    (fig_cx - hem_w, robe_bot),
], fill=(196, 148, 44), outline=GOLD_DK)
# robe highlight + trim
d.polygon([
    (fig_cx - shoulder_w + 14, robe_top + 6),
    (fig_cx + shoulder_w - 14, robe_top + 6),
    (fig_cx + hem_w - 26, robe_bot - 6),
    (fig_cx - hem_w + 26, robe_bot - 6),
], fill=(222, 176, 62))
d.line([(fig_cx - hem_w + 8, robe_bot - 16), (fig_cx + hem_w - 8, robe_bot - 16)], fill=GOLD_HI, width=5)
# center stole line
d.line([(fig_cx, robe_top + 4), (fig_cx, robe_bot - 20)], fill=GOLD_DK, width=4)

# --- head ---
d.ellipse([fig_cx - head_r, head_y - head_r, fig_cx + head_r, head_y + head_r],
          fill=(238, 198, 122), outline=GOLD_DK, width=3)

# --- right hand raised in blessing ---
hx = fig_cx + shoulder_w + 40
hy = robe_top + 60
d.line([(fig_cx + shoulder_w - 6, robe_top + 46), (hx - 8, hy + 16)], fill=(222, 176, 62), width=20)
d.ellipse([hx - 18, hy - 18, hx + 18, hy + 18], fill=(238, 198, 122), outline=GOLD_DK, width=2)
# two blessing fingers
d.line([(hx - 2, hy - 16), (hx - 2, hy - 40)], fill=(238, 198, 122), width=7)
d.line([(hx + 8, hy - 14), (hx + 8, hy - 36)], fill=(238, 198, 122), width=7)

# --- left hand holding the orb (globus cruciger = the world in a child's palm) ---
ox = fig_cx - shoulder_w - 46
oy = robe_top + 78
d.line([(fig_cx - shoulder_w + 6, robe_top + 50), (ox + 14, oy + 26)], fill=(222, 176, 62), width=20)
orb_r = 34
d.ellipse([ox - orb_r, oy - orb_r, ox + orb_r, oy + orb_r], fill=(64, 130, 200), outline=GOLD_HI, width=4)
# meridian lines on the orb
d.arc([ox - orb_r + 6, oy - orb_r, ox + orb_r - 6, oy + orb_r], 90, 270, fill=(160, 205, 250), width=3)
d.line([(ox - orb_r + 4, oy), (ox + orb_r - 4, oy)], fill=(160, 205, 250), width=3)
# cross atop the orb
d.line([(ox, oy - orb_r - 18), (ox, oy - orb_r + 4)], fill=GOLD_HI, width=5)
d.line([(ox - 10, oy - orb_r - 10), (ox + 10, oy - orb_r - 10)], fill=GOLD_HI, width=5)

# --- reflection in the sea ---
refl = Image.new("RGBA", (W, H), (0, 0, 0, 0))
rd = ImageDraw.Draw(refl)
for i in range(46):
    y = sea_top + 8 + i * 5
    w = int(130 * (1 - i / 60))
    a = int(70 * (1 - i / 46))
    rd.line([(fig_cx - w, y), (fig_cx + w, y)], fill=(240, 200, 100, a))
img = Image.alpha_composite(img.convert("RGBA"), refl).convert("RGB")
d = ImageDraw.Draw(img, "RGBA")

# --- three robe waves at the bottom (red / white / gold = the three Marys' colors he wears) ---
wave_y = H - 74
def wave(color, offset, amp=14, length=420):
    pts = []
    for x in range(0, W + 8, 8):
        y = wave_y + offset + math.sin((x / length) * 2 * math.pi + offset * 0.13) * amp
        pts.append((x, y))
    pts += [(W, H), (0, H)]
    d.polygon(pts, fill=color)

wave((168, 44, 44, 200), 0)
wave((238, 238, 230, 170), 24)
wave((232, 190, 80, 190), 48)

img.save("Jezulatko.png")
print("saved Jezulatko.png", img.size)
