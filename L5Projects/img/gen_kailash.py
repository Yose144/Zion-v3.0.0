#!/usr/bin/env python3
"""Kailash — Ngari, Tibet: interim PIL art for the L5 vision node.

Outputs:
  Kailash.png        (1600x900 render — dusk over the four-sided pyramid,
                      kora path of pilgrims, the primordial fire at its foot)
  KailashProject.png (1600x1000 navy masterplan board — kora ellipse,
                      four rivers radiating, spec block)
"""
from PIL import Image, ImageDraw, ImageFilter, ImageFont
import math, random

SER = "/System/Library/Fonts/Supplemental/Times New Roman.ttf"
SANS = "/System/Library/Fonts/Helvetica.ttc"

# ============================================================ RENDER
W, H = 1600, 900
img = Image.new("RGB", (W, H), (10, 14, 30))
d = ImageDraw.Draw(img, "RGBA")

# --- cold dusk sky gradient ---
for y in range(H):
    t = y / H
    r = int(10 + 40 * t)
    g = int(14 + 34 * t)
    b = int(30 + 40 * t)
    d.line([(0, y), (W, y)], fill=(r, g, b))

# --- stars ---
random.seed(23)
for _ in range(300):
    x = random.randint(0, W - 1)
    y = random.randint(0, int(H * 0.55))
    s = random.choice([1, 1, 1, 2])
    a = random.randint(50, 210)
    d.rectangle([x, y, x + s, y + s], fill=(235, 240, 255, a))
# milky-way band
for _ in range(220):
    x = int(random.gauss(W * 0.30, W * 0.22))
    y = int(random.gauss(H * 0.16, H * 0.07))
    if 0 <= x < W and 0 <= y < int(H * 0.4):
        d.rectangle([x, y, x + 1, y + 1], fill=(220, 228, 252, random.randint(20, 90)))

# --- snow-glow behind the pyramid ---
mx, my = int(W * 0.52), int(H * 0.60)
glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
gd = ImageDraw.Draw(glow)
for rad in range(520, 80, -10):
    a = max(0, int(40 * (1 - rad / 520)))
    gd.ellipse([mx - rad, my - 160 - rad, mx + rad, my - 160 + rad], fill=(150, 180, 235, a))
img = Image.alpha_composite(img.convert("RGBA"), glow).convert("RGB")
d = ImageDraw.Draw(img, "RGBA")

# --- distant ridge ---
d.polygon([(x, int(H * 0.60) + math.sin(x / 300) * 14 + math.sin(x / 130 + 2) * 7)
           for x in range(0, W + 12, 12)] + [(W, H), (0, H)], fill=(38, 42, 54))

# --- THE PYRAMID (four-sided sacred mountain, moonlit west face) ---
base_y = my + 8
half_w = 300
peak_y = base_y - 330
# left (lit) face
d.polygon([(mx - half_w, base_y), (mx, peak_y), (mx, base_y)], fill=(196, 210, 230))
# right (shadow) face
d.polygon([(mx, peak_y), (mx + half_w * 0.72, base_y), (mx, base_y)], fill=(120, 132, 158))
# snow strata on the lit face (the famous stepped layers)
for f in (0.22, 0.40, 0.58, 0.74):
    yy = peak_y + (base_y - peak_y) * f
    xl = mx - half_w * (1 - f) * 0.92
    d.line([(xl, yy), (mx, yy)], fill=(235, 242, 252, 150), width=4)
# dark rock bands between snow
for f in (0.30, 0.49, 0.66):
    yy = peak_y + (base_y - peak_y) * f
    xl = mx - half_w * (1 - f) * 0.94
    d.line([(xl, yy), (mx, yy)], fill=(88, 96, 118, 190), width=3)
# bright edge on the ridge line
d.line([(mx - half_w, base_y), (mx, peak_y)], fill=(240, 248, 255, 220), width=3)
d.line([(mx + half_w * 0.72, base_y), (mx, peak_y)], fill=(190, 205, 230, 170), width=2)
# summit halo (the never-climbed crown)
for rr in range(30, 8, -4):
    a = int(90 * (1 - rr / 30))
    d.ellipse([mx - rr, peak_y - 24 - rr, mx + rr, peak_y - 24 + rr], fill=(255, 240, 190, a))

# --- Manasarovar: lake band to the right ---
lake_y0 = int(H * 0.68)
d.polygon([(int(W * 0.70), lake_y0), (W, lake_y0 - 6), (W, lake_y0 + 60), (int(W * 0.70), lake_y0 + 52)],
          fill=(30, 46, 74))
for _ in range(60):
    x = random.randint(int(W * 0.70), W)
    y = random.randint(lake_y0, lake_y0 + 52)
    w_ = random.randint(20, 120)
    d.line([(x, y), (min(W, x + w_), y)], fill=(150, 190, 230, random.randint(15, 55)))
# mountain reflection in lake
for i in range(24):
    y = lake_y0 + 4 + i * 2
    t = i / 24
    wl = int(120 * (1 - t * 0.7))
    xr = int(W * 0.70) + int(60 * t)
    d.line([(xr, y), (xr + wl, y)], fill=(170, 190, 220, int(60 * (1 - t))))

# --- desert floor (Ngari plain) ---
d.polygon([(x, int(H * 0.70) + math.sin(x / 210 + 1) * 10 + math.sin(x / 90) * 5)
           for x in range(0, W + 12, 12)] + [(W, H), (0, H)], fill=(52, 44, 38))
d.polygon([(x, int(H * 0.80) + math.sin(x / 170 + 3) * 12) for x in range(0, W + 12, 12)] + [(W, H), (0, H)],
          fill=(40, 34, 30))

# --- kora path: dotted pilgrim line sweeping around ---
pts = []
for i in range(60):
    t = i / 59
    x = int(W * 0.10 + t * W * 0.75)
    y = int(H * 0.86 - math.sin(t * math.pi) * H * 0.10 + math.sin(t * 9) * 4)
    pts.append((x, y))
for i, (x, y) in enumerate(pts):
    r = 4 - i * 0.02
    d.ellipse([x - r, y - r / 2, x + r, y + r / 2], fill=(190, 170, 130))
# prayer-flag flags along the path (tiny colored ticks)
FLAG = [(60, 130, 220), (240, 240, 240), (200, 60, 50), (60, 160, 90), (230, 200, 70)]
for i in range(3, len(pts), 6):
    x, y = pts[i]
    d.line([(x, y - 2), (x, y - 22)], fill=(150, 140, 110), width=2)
    for j, c in enumerate(FLAG):
        d.rectangle([x + 2 + j * 6, y - 22 - j * 2, x + 7 + j * 6, y - 18 - j * 2], fill=c + (200,))

# --- the primordial fire at the mountain's foot (left of center) ---
fx, fy = int(W * 0.36), int(H * 0.80)
fire_glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
fg = ImageDraw.Draw(fire_glow)
for rad in range(160, 10, -6):
    a = max(0, int(120 * (1 - rad / 160)))
    fg.ellipse([fx - rad, fy - 20 - rad, fx + rad, fy - 20 + rad], fill=(255, 150, 60, a))
img = Image.alpha_composite(img.convert("RGBA"), fire_glow).convert("RGB")
d = ImageDraw.Draw(img, "RGBA")
# stone ring
for ang in range(0, 360, 36):
    rx = fx + int(math.cos(math.radians(ang)) * 34)
    ry = fy + int(math.sin(math.radians(ang)) * 10)
    d.ellipse([rx - 7, ry - 5, rx + 7, ry + 5], fill=(90, 82, 70))
# flame core
for f_ in range(5):
    hgt = 60 - f_ * 9
    wdt = 26 - f_ * 4
    yy = fy - f_ * 7
    shade = [(255, 240, 190), (255, 210, 110), (250, 170, 60), (235, 120, 40), (200, 70, 30)][f_]
    d.polygon([(fx - wdt, yy), (fx + wdt, yy), (fx + (f_ - 2) * 4, yy - hgt)], fill=shade + (220,))
# seated silhouettes around the fire — the masters' council
for ang, dist in [(205, 56), (150, 62), (105, 60), (245, 60), (285, 66), (335, 58)]:
    sx = fx + int(math.cos(math.radians(ang)) * dist)
    sy = fy + int(math.sin(math.radians(ang)) * dist * 0.34)
    d.ellipse([sx - 7, sy - 26, sx + 7, sy - 12], fill=(24, 18, 14))
    d.polygon([(sx - 12, sy), (sx + 12, sy), (sx + 6, sy - 14), (sx - 6, sy - 14)], fill=(20, 15, 12))

# --- caption band ---
d.rectangle([0, H - 100, W, H], fill=(10, 14, 26, 130))
f1 = ImageFont.truetype(SER, 34)
f2 = ImageFont.truetype(SER, 16)
t1 = "K A I L A S H"
w1 = d.textlength(t1, font=f1)
d.text(((W - w1) / 2, H - 84), t1, font=f1, fill=(238, 226, 190))
t2 = "NGARI · TIBET — POUŠŤ OČIŠTĚNÍ · PRASTARÝ OHEŇ"
w2 = d.textlength(t2, font=f2)
d.text(((W - w2) / 2, H - 40), t2, font=f2, fill=(200, 190, 160))
d.line([(W / 2 - 220, H - 94), (W / 2 + 220, H - 94)], fill=(190, 170, 120, 150), width=1)

img.save("Kailash.png")
print("saved Kailash.png", img.size)

# ============================================================ BOARD
BW, BH = 1600, 1000
b = Image.new("RGB", (BW, BH), (10, 16, 34))
bd = ImageDraw.Draw(b, "RGBA")

# grid
for x in range(0, BW, 50):
    bd.line([(x, 0), (x, BH)], fill=(26, 36, 64))
for y in range(0, BH, 50):
    bd.line([(0, y), (BW, y)], fill=(26, 36, 64))
# heavier major grid
for x in range(0, BW, 250):
    bd.line([(x, 0), (x, BH)], fill=(34, 46, 80))
for y in range(0, BH, 250):
    bd.line([(0, y), (BW, y)], fill=(34, 46, 80))

GOLD = (232, 200, 120)
GOLD_DIM = (150, 132, 92)
CYAN = (110, 200, 235)
EMER = (110, 215, 160)
PAPER = (226, 220, 205)
WHITE = (240, 242, 248)

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

# --- header ---
t = "KAILASH — MASTERPLAN"
bd.text(((BW - bd.textlength(t, font=f_title)) / 2, 60), t, font=f_title, fill=WHITE)
ctext(BW / 2, 138, "L5 node · desert of purification · the primordial fire", f_sub, GOLD_DIM)

# --- center: kora ellipse around mountain glyph ---
ecx, ecy = BW // 2 - 60, 470
ew, eh = 340, 190
bd.ellipse([ecx - ew, ecy - eh, ecx + ew, ecy + eh], outline=GOLD + (220,), width=3)
# dashed inner ellipse (inner kora)
for ang in range(0, 360, 14):
    a0, a1 = math.radians(ang), math.radians(ang + 8)
    x0, y0 = ecx + math.cos(a0) * ew * 0.72, ecy + math.sin(a0) * eh * 0.72
    x1, y1 = ecx + math.cos(a1) * ew * 0.72, ecy + math.sin(a1) * eh * 0.72
    bd.line([(x0, y0), (x1, y1)], fill=GOLD_DIM + (200,), width=2)

# mountain glyph (pyramid + summit dot)
ph = 200
pw = 150
bd.polygon([(ecx - pw, ecy + 60), (ecx, ecy + 60 - ph), (ecx + pw, ecy + 60)], outline=WHITE + (240,), width=3)
for f in (0.28, 0.5, 0.72):
    yy = ecy + 60 - ph + ph * f
    bd.line([(ecx - pw * (1 - f), yy), (ecx + pw * (1 - f), yy)], fill=WHITE + (150,), width=2)
bd.ellipse([ecx - 6, ecy + 60 - ph - 26, ecx + 6, ecy + 60 - ph - 14], fill=GOLD)
ctext(ecx, ecy + 78, "GANG RINPOCHE — 6 638 m", f_small, PAPER)
ctext(ecx, ecy + 96, "never climbed — the mountain is walked around", f_small, GOLD_DIM)

# direction note on the kora
ctext(ecx - ew - 130, ecy - 14, "KORA ~52 km", f_lab, GOLD)
ctext(ecx - ew - 130, ecy + 8, "cw · ccw (Bön)", f_small, GOLD_DIM)
bd.line([(ecx - ew - 40, ecy), (ecx - ew - 12, ecy)], fill=GOLD + (200,), width=2)
bd.polygon([(ecx - ew - 12, ecy - 5), (ecx - ew - 12, ecy + 5), (ecx - ew, ecy)], fill=GOLD + (200,))

# --- four rivers radiating ---
def arrow(x0, y0, x1, y1, color):
    bd.line([(x0, y0), (x1, y1)], fill=color + (210,), width=3)
    ang = math.atan2(y1 - y0, x1 - x0)
    for da in (2.6, -2.6):
        bd.line([(x1, y1), (x1 - math.cos(ang + da) * 16, y1 - math.sin(ang + da) * 16)],
                fill=color + (210,), width=3)

RIVER_COL = (90, 160, 220)
arrow(ecx + ew + 40, ecy - 60, ecx + ew + 210, ecy - 140, RIVER_COL)   # Indus (W)
ctext(ecx + ew + 250, ecy - 160, "INDUS", f_lab, (150, 190, 235))
arrow(ecx + ew + 40, ecy + 40, ecx + ew + 200, ecy + 130, RIVER_COL)   # Sutlej (S)
ctext(ecx + ew + 240, ecy + 140, "SUTLEJ · GANGA", f_lab, (150, 190, 235))
arrow(ecx - ew - 40, ecy - 60, ecx - ew - 200, ecy - 140, RIVER_COL)   # Brahmaputra (E)
ctext(ecx - ew - 280, ecy - 160, "BRAHMAPUTRA", f_lab, (150, 190, 235))
arrow(ecx - ew - 40, ecy + 40, ecx - ew - 190, ecy + 130, RIVER_COL)   # Karnali (SW)
ctext(ecx - ew - 260, ecy + 140, "KARNALI", f_lab, (150, 190, 235))
ctext(ecx, ecy - eh - 46, "FOUR RIVERS OF ASIA — ONE SOURCE", f_small, (120, 160, 200))

# --- Manasarovar note ---
ctext(250, 640, "MANASAROVAR", f_lab, CYAN)
ctext(250, 662, "lake made of mind", f_small, GOLD_DIM)

# --- primordial fire glyph (right of kora) ---
fxb, fyb = ecx + ew + 160, ecy + 210
for ang in range(0, 360, 45):
    rx = fxb + int(math.cos(math.radians(ang)) * 22)
    ry = fyb + int(math.sin(math.radians(ang)) * 7)
    bd.ellipse([rx - 5, ry - 4, rx + 5, ry + 4], fill=(110, 100, 88))
for f_, hgt in enumerate((40, 30, 20)):
    shade = [(250, 170, 60), (255, 210, 110), (255, 240, 190)][f_]
    bd.polygon([(fxb - 12 + f_ * 4, fyb - f_ * 6), (fxb + 12 - f_ * 4, fyb - f_ * 6),
                (fxb, fyb - f_ * 6 - hgt)], fill=shade + (230,))
ctext(fxb + 6, fyb + 16, "THE PRIMORDIAL FIRE", f_lab, GOLD)
ctext(fxb + 6, fyb + 38, "council of masters —", f_small, GOLD_DIM)
ctext(fxb + 6, fyb + 54, "from the Carpenter to Babaji", f_small, GOLD_DIM)

# --- compass (top right) ---
ccx, ccy, cr = BW - 190, 250, 70
bd.ellipse([ccx - cr, ccy - cr, ccx + cr, ccy + cr], outline=GOLD_DIM + (180,), width=2)
for ang in range(0, 360, 30):
    x0 = ccx + math.cos(math.radians(ang)) * (cr - 8)
    y0 = ccy + math.sin(math.radians(ang)) * (cr - 8)
    x1 = ccx + math.cos(math.radians(ang)) * cr
    y1 = ccy + math.sin(math.radians(ang)) * cr
    bd.line([(x0, y0), (x1, y1)], fill=GOLD_DIM + (180,), width=2)
bd.polygon([(ccx, ccy - cr + 14), (ccx - 7, ccy), (ccx + 7, ccy)], fill=GOLD)
bd.polygon([(ccx, ccy + cr - 14), (ccx - 7, ccy), (ccx + 7, ccy)], fill=(90, 100, 130))
ctext(ccx, ccy - cr - 30, "N — NO SUMMIT", f_small, GOLD)

# --- spec block (left) ---
bx, by = 110, 700
specs = [
    ("NODE", "vision · relationship (like Uluru, Boa, Ekam)"),
    ("PURPOSE", "the Purification — desert kora around the mountain"),
    ("COUNCIL", "primordial fire — masters of all lineages (MYTH layer)"),
    ("TRADITIONS", "hindu · buddhist · bön · jain — one mountain, four names"),
    ("WATER", "Indus · Sutlej · Brahmaputra · Karnali + Manasarovar"),
    ("PEOPLE", "custodians of four traditions · FPIC-equivalent"),
    ("ACCESS", "TAR permits · seasonal window · Nepal / Lhasa corridor"),
]
for i, (k, v) in enumerate(specs):
    yy = by + i * 36
    bd.text((bx, yy), k, font=f_key, fill=GOLD)
    bd.text((bx + 160, yy), v, font=f_val, fill=PAPER)

# --- bottom-right caption ---
ctext(BW - 260, BH - 90, "SCHÁZIŠTĚ MISTRŮ", f_lab, WHITE)
ctext(BW - 260, BH - 64, "the council at the fire", f_small, GOLD_DIM)
bd.line([(BW - 400, BH - 100), (BW - 120, BH - 100)], fill=GOLD_DIM + (160,), width=1)

b.save("KailashProject.png")
print("saved KailashProject.png", b.size)
