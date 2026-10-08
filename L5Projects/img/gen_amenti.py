#!/usr/bin/env python3
"""Amenti — Giza, Egypt: interim PIL art for the L5 vision node.

Outputs:
  Amenti.png        (1600x900 render — desert dusk over the Giza plateau,
                     three pyramids + sphinx, the emerald glow of the Halls
                     beneath the sand, the Nile at the horizon)
  AmentiProject.png (1600x1000 navy masterplan board — plateau section with
                     the mythic Halls below (MYTH layer marked), Nile ribbon,
                     32-throne ring + seven virtues spec block)
"""
from PIL import Image, ImageDraw, ImageFilter, ImageFont
import math, random

SER = "/System/Library/Fonts/Supplemental/Times New Roman.ttf"
SANS = "/System/Library/Fonts/Helvetica.ttc"

EMER = (52, 211, 153)   # #34d399 — emerald of the Tablets
GOLD = (232, 200, 120)
SAND_LIT = (176, 138, 84)
SAND_DARK = (86, 64, 44)

# ============================================================ RENDER
W, H = 1600, 900
img = Image.new("RGB", (W, H), (16, 12, 26))
d = ImageDraw.Draw(img, "RGBA")

# --- dusk sky gradient (deep violet → amber horizon) ---
for y in range(H):
    t = y / H
    if t < 0.62:
        u = t / 0.62
        r = int(18 + 150 * u)
        g = int(14 + 84 * u)
        b = int(34 + 56 * u)
    else:
        u = (t - 0.62) / 0.38
        r = int(168 + 30 * u)
        g = int(98 - 30 * u)
        b = int(90 - 60 * u)
    d.line([(0, y), (W, y)], fill=(r, g, b))

# --- stars (upper sky) ---
random.seed(41)
for _ in range(240):
    x = random.randint(0, W - 1)
    y = random.randint(0, int(H * 0.38))
    s = random.choice([1, 1, 1, 2])
    a = random.randint(40, 200)
    d.rectangle([x, y, x + s, y + s], fill=(235, 235, 250, a))

# --- sun disc setting behind the pyramids ---
sx, sy = int(W * 0.66), int(H * 0.58)
sun = Image.new("RGBA", (W, H), (0, 0, 0, 0))
sd = ImageDraw.Draw(sun)
for rad in range(300, 60, -12):
    a = max(0, int(60 * (1 - rad / 300)))
    sd.ellipse([sx - rad, sy - rad, sx + rad, sy + rad], fill=(255, 190, 90, a))
sd.ellipse([sx - 62, sy - 62, sx + 62, sy + 62], fill=(255, 214, 130, 230))
img = Image.alpha_composite(img.convert("RGBA"), sun).convert("RGB")
d = ImageDraw.Draw(img, "RGBA")

# --- distant dune ridge ---
d.polygon([(x, int(H * 0.62) + math.sin(x / 260) * 12 + math.sin(x / 110 + 2) * 6)
           for x in range(0, W + 12, 12)] + [(W, H), (0, H)], fill=(94, 66, 46))

# --- Nile ribbon on the horizon (right edge) ---
d.polygon([(int(W * 0.86), int(H * 0.615)), (W, int(H * 0.60)),
           (W, int(H * 0.635)), (int(W * 0.86), int(H * 0.64))], fill=(40, 80, 110))
for _ in range(40):
    x = random.randint(int(W * 0.87), W - 4)
    y = random.randint(int(H * 0.612), int(H * 0.632))
    d.line([(x, y), (min(W, x + random.randint(14, 60)), y)],
           fill=(140, 190, 220, random.randint(18, 50)))

# --- THREE PYRAMIDS (Giza diagonal — Khufu back, Khafre mid, Menkaure front) ---
def pyramid(cx, base_y, half_w, hgt, lit_l, lit_r):
    d.polygon([(cx - half_w, base_y), (cx, base_y - hgt), (cx, base_y)], fill=lit_l)
    d.polygon([(cx, base_y - hgt), (cx + int(half_w * 0.8), base_y), (cx, base_y)], fill=lit_r)
    # casing edge
    d.line([(cx - half_w, base_y), (cx, base_y - hgt)], fill=(235, 200, 140, 200), width=2)
    # block courses
    for f in (0.30, 0.55, 0.78):
        yy = base_y - hgt + hgt * f
        xl = cx - half_w * (1 - f) * 0.95
        d.line([(xl, yy), (cx, yy)], fill=(120, 90, 55, 130), width=2)

py_ = int(H * 0.64)
pyramid(int(W * 0.30), py_ - 10, 210, 250, (206, 158, 92), (120, 84, 52))   # Khufu
pyramid(int(W * 0.52), py_ + 4, 170, 205, (186, 140, 82), (104, 74, 48))   # Khafre
pyramid(int(W * 0.68), py_ + 14, 120, 140, (164, 122, 72), (92, 66, 44))   # Menkaure
# Khafre cap-stone band
d.polygon([(int(W * 0.52) - 34, py_ - 190), (int(W * 0.52), py_ - 201),
           (int(W * 0.52) + 26, py_ - 190), (int(W * 0.52), py_ - 176)], fill=(228, 200, 150))

# --- Sphinx silhouette (foreground left, facing east/right) ---
spx, spy = int(W * 0.16), int(H * 0.70)
d.polygon([(spx - 110, spy), (spx - 10, spy - 34), (spx + 26, spy - 30),
           (spx + 34, spy - 60), (spx + 10, spy - 78), (spx - 18, spy - 76),
           (spx - 30, spy - 44), (spx - 96, spy - 18), (spx - 110, spy)],
          fill=(60, 42, 30))
d.ellipse([spx - 4, spy - 96, spx + 16, spy - 66], fill=(62, 44, 32))  # head
d.polygon([(spx - 12, spy - 92), (spx + 24, spy - 92), (spx + 30, spy - 60), (spx - 18, spy - 60)],
          fill=(56, 40, 30))  # nemes flaps

# --- the emerald glow of the Halls beneath the plateau (MYTH layer) ---
gx, gy = int(W * 0.50), int(H * 0.72)
hall = Image.new("RGBA", (W, H), (0, 0, 0, 0))
hd = ImageDraw.Draw(hall)
for rad in range(300, 30, -12):
    a = max(0, int(70 * (1 - rad / 300)))
    hd.ellipse([gx - rad, gy - rad * 0.35, gx + rad, gy + rad * 0.35],
               fill=(52, 211, 153, a))
img = Image.alpha_composite(img.convert("RGBA"), hall).convert("RGB")
d = ImageDraw.Draw(img, "RGBA")
# faint emerald shaft rising through the sand to the sky (the Flower of Light)
d.polygon([(gx - 10, gy - 8), (gx + 10, gy - 8), (gx + 3, gy - 260), (gx - 3, gy - 260)],
          fill=(120, 235, 190, 90))
for rr in range(26, 6, -4):
    a = int(110 * (1 - rr / 26))
    d.ellipse([gx - rr, gy - 262 - rr, gx + rr, gy - 262 + rr], fill=(200, 255, 225, a))

# --- foreground dunes ---
d.polygon([(x, int(H * 0.74) + math.sin(x / 200 + 1) * 10 + math.sin(x / 86) * 5)
           for x in range(0, W + 12, 12)] + [(W, H), (0, H)], fill=(120, 88, 56))
d.polygon([(x, int(H * 0.84) + math.sin(x / 150 + 3) * 14) for x in range(0, W + 12, 12)]
          + [(W, H), (0, H)], fill=(84, 60, 40))

# --- pilgrim path: dotted line of records-seekers ---
for i in range(46):
    t = i / 45
    x = int(W * 0.12 + t * W * 0.62)
    y = int(H * 0.90 - math.sin(t * math.pi) * H * 0.075 + math.sin(t * 8) * 3)
    r = 4 - i * 0.02
    d.ellipse([x - r, y - r / 2, x + r, y + r / 2], fill=(196, 160, 110))

# --- caption band ---
d.rectangle([0, H - 100, W, H], fill=(14, 10, 22, 140))
f1 = ImageFont.truetype(SER, 34)
f2 = ImageFont.truetype(SER, 16)
t1 = "A M E N T I"
w1 = d.textlength(t1, font=f1)
d.text(((W - w1) / 2, H - 84), t1, font=f1, fill=(190, 240, 215))
t2 = "GÍZA · EGYPT — SÍNĚ ZÁZNAMU · KVĚTOUCÍ PLAMEN"
w2 = d.textlength(t2, font=f2)
d.text(((W - w2) / 2, H - 40), t2, font=f2, fill=(200, 190, 160))
d.line([(W / 2 - 220, H - 94), (W / 2 + 220, H - 94)], fill=EMER + (150,), width=1)

img.save("Amenti.png")
print("saved Amenti.png", img.size)

# ============================================================ BOARD
BW, BH = 1600, 1000
b = Image.new("RGB", (BW, BH), (10, 16, 34))
bd = ImageDraw.Draw(b, "RGBA")

for x in range(0, BW, 50):
    bd.line([(x, 0), (x, BH)], fill=(26, 36, 64))
for y in range(0, BH, 50):
    bd.line([(0, y), (BW, y)], fill=(26, 36, 64))
for x in range(0, BW, 250):
    bd.line([(x, 0), (x, BH)], fill=(34, 46, 80))
for y in range(0, BH, 250):
    bd.line([(0, y), (BW, y)], fill=(34, 46, 80))

GOLD_DIM = (150, 132, 92)
CYAN = (110, 200, 235)
PAPER = (226, 220, 205)
WHITE = (240, 242, 248)
EMER_D = (90, 200, 160)

f_title = ImageFont.truetype(SANS, 56)
f_sub = ImageFont.truetype(SANS, 22)
f_lab = ImageFont.truetype(SANS, 15)
f_key = ImageFont.truetype(SANS, 17)
f_val = ImageFont.truetype(SANS, 17)
f_small = ImageFont.truetype(SANS, 13)

def ctext(cx, y, s, font, fill, spacing=0):
    if spacing:
        wsum = sum(bd.textlength(ch, font=font) for ch in s) + spacing * (len(s) - 1)
        x = cx - wsum / 2
        for ch in s:
            bd.text((x, y), ch, font=font, fill=fill)
            x += bd.textlength(ch, font=font) + spacing
    else:
        bd.text((cx - bd.textlength(s, font=font) / 2, y), s, font=font, fill=fill)

def arrow(x0, y0, x1, y1, color, w=3):
    bd.line([(x0, y0), (x1, y1)], fill=color + (210,), width=w)
    ang = math.atan2(y1 - y0, x1 - x0)
    for da in (2.6, -2.6):
        bd.line([(x1, y1), (x1 - math.cos(ang + da) * 16, y1 - math.sin(ang + da) * 16)],
                fill=color + (210,), width=w)

# --- header ---
t = "AMENTI — MASTERPLAN"
bd.text(((BW - bd.textlength(t, font=f_title)) / 2, 60), t, font=f_title, fill=WHITE)
ctext(BW / 2, 138, "L5 node · the halls of records · cradle of the scribe", f_sub, GOLD_DIM)

# --- center: plateau section diagram ---
ecx = BW // 2 - 80
surf = 400          # surface line
dep = 680           # halls depth

# surface (sand line)
bd.line([(ecx - 380, surf), (ecx + 380, surf)], fill=SAND_LIT + (255,), width=3)
ctext(ecx + 240, surf - 26, "GIZA PLATEAU — 4 500 yr of record", f_small, PAPER)

# three pyramid outlines on the surface
for i, (dx, w_, h_) in enumerate([(-260, 90, 120), (-110, 74, 95), (30, 52, 64)]):
    bd.polygon([(ecx + dx - w_, surf), (ecx + dx, surf - h_), (ecx + dx + w_, surf)],
               outline=WHITE + (240,), width=3)
# sphinx block (right)
bd.rectangle([ecx + 200, surf - 30, ecx + 268, surf], outline=WHITE + (220,), width=2)
bd.ellipse([ecx + 258, surf - 52, ecx + 278, surf - 30], outline=WHITE + (220,), width=2)

# subsurface (darker earth)
bd.rectangle([ecx - 380, surf, ecx + 380, dep], fill=(14, 20, 40, 120))

# --- the Halls beneath (MYTH) — emerald chamber ring with 32 throne dots ---
hx, hy = ecx, surf + (dep - surf) // 2 + 10
ring_r = 150
bd.ellipse([hx - ring_r, hy - ring_r * 0.62, hx + ring_r, hy + ring_r * 0.62],
           outline=EMER_D + (230,), width=3)
for i in range(32):
    a = math.radians(i * 360 / 32 - 90)
    x = hx + math.cos(a) * ring_r * 0.86
    y = hy + math.sin(a) * ring_r * 0.62 * 0.86
    bd.ellipse([x - 4, y - 4, x + 4, y + 4], fill=EMER_D + (200,))
# the Flower of Light — central emerald flame glyph
for f_, hgt in enumerate((56, 40, 26)):
    shade = [(60, 220, 170), (140, 240, 200), (215, 255, 235)][f_]
    bd.polygon([(hx - 14 + f_ * 5, hy + 12), (hx + 14 - f_ * 5, hy + 12),
                (hx, hy + 12 - hgt)], fill=shade + (235,))
ctext(hx, hy + 130, "SÍNĚ AMENTI — MYTH LAYER", f_lab, EMER_D)
ctext(hx, hy + 150, "halls of the dead & the living — 32 thrones + the Flower of Light", f_small, GOLD_DIM)
ctext(hx, hy + 168, "Emerald Tablets = modern esoteric text, not egyptology", f_small, (200, 120, 110))

# access shaft from surface to the hall (dashed)
for yy in range(surf + 6, hy - 80, 18):
    bd.line([(hx, yy), (hx, yy + 10)], fill=EMER_D + (170,), width=2)
ctext(hx + 30, surf + 34, "the shaft of remembrance", f_small, EMER_D)

# --- Nile ribbon at right ---
bd.line([(ecx + 380, surf - 4), (ecx + 500, surf - 4)], fill=CYAN + (200,), width=4)
ctext(ecx + 460, surf - 30, "NILE", f_lab, CYAN)
ctext(ecx + 460, surf - 12, "~20 km E", f_small, GOLD_DIM)

# --- left annotations ---
lx = 110
ctext(lx + 90, 300, "KHUFU · KHAFRE · MENKAURE", f_lab, GOLD)
ctext(lx + 90, 322, "+ GREAT SPHINX — the last Wonder standing", f_small, GOLD_DIM)
arrow(lx + 200, 330, ecx - 250, surf - 60, (150, 140, 110), 2)

ctext(lx + 90, 520, "SEVEN LORDS = SEVEN VIRTUES", f_lab, EMER_D)
for i, v in enumerate(["Ahimsa · Satya · Asteya · Brahmacharya", "Aparigraha · Karuna · Dana",
                       "L3 dharma gate before every AI output"]):
    ctext(lx + 90, 544 + i * 22, v, f_small, PAPER if i < 2 else GOLD_DIM)

# --- right annotations ---
rx = BW - 330
ctext(rx + 90, 300, "AMENTI LIBRARY — LIVE", f_lab, EMER_D)
ctext(rx + 90, 322, "the digital halls already run:", f_small, GOLD_DIM)
ctext(rx + 90, 342, "Quantum Revolution · 11 languages", f_small, PAPER)
arrow(rx + 60, 330, ecx + 300, surf - 10, EMER_D, 2)

ctext(rx + 90, 560, "EMERALD RECORD = LEDGER", f_lab, GOLD)
ctext(rx + 90, 582, "as above, so below —", f_small, GOLD_DIM)
ctext(rx + 90, 600, "every node holds the whole", f_small, GOLD_DIM)

# --- spec block (bottom left) ---
bx, by = 110, 760
specs = [
    ("NODE", "vision · relationship (like Uluru, Boa, Ekam, Kailash)"),
    ("PURPOSE", "the Record — halls of records at the cradle of the scribe"),
    ("MYTH", "Halls of Amenti — 32 Children of Light, the Flower (MYTH)"),
    ("LIVE", "Amenti Library already serving · L3 seven-virtue gate"),
    ("HOLDERS", "Supreme Council of Antiquities · Egyptian community"),
    ("ACCESS", "no parcel · no build on the plateau · Alexandria leg TBD"),
]
for i, (k, v) in enumerate(specs):
    yy = by + i * 34
    bd.text((bx, yy), k, font=f_key, fill=EMER_D)
    bd.text((bx + 160, yy), v, font=f_val, fill=PAPER)

# --- bottom-right caption ---
ctext(BW - 260, BH - 90, "SÍNĚ ZÁZNAMU", f_lab, WHITE)
ctext(BW - 260, BH - 64, "the twelfth & last node", f_small, GOLD_DIM)
bd.line([(BW - 400, BH - 100), (BW - 120, BH - 100)], fill=EMER_D + (160,), width=1)

b.save("AmentiProject.png")
print("saved AmentiProject.png", b.size)
