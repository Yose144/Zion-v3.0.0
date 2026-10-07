#!/usr/bin/env python3
"""Genesis Garden — Sabacheira, Tomar: interim PIL render.
Údolí Nabão za úsvitu — tři skleněné pyramidy mezi olivovými háji,
uprostřed Strom života, řeka k pramenu Agroal, poutní stezka.
"""
from PIL import Image, ImageDraw, ImageFilter, ImageFont
import math, random

W, H = 1280, 900
img = Image.new("RGB", (W, H), (30, 40, 52))
d = ImageDraw.Draw(img, "RGBA")

# --- dawn sky gradient (warm inland morning) ---
for y in range(H):
    t = y / H
    r = int(48 + 175 * t)
    g = int(66 + 130 * t)
    b = int(84 + 66 * t)
    d.line([(0, y), (W, y)], fill=(r, g, b))

# --- stars fading in dawn ---
random.seed(11)
for _ in range(120):
    x = random.randint(0, W - 1)
    y = random.randint(0, int(H * 0.35))
    a = random.randint(18, 80)
    d.rectangle([x, y, x + 1, y + 1], fill=(255, 246, 214, a))

# --- sun low over the hills (right of center) ---
sun_x, sun_y, sun_r = int(W * 0.68), int(H * 0.30), 42
glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
gd = ImageDraw.Draw(glow)
for rad in range(380, sun_r, -6):
    a = max(0, int(80 * (1 - rad / 380)))
    gd.ellipse([sun_x - rad, sun_y - rad, sun_x + rad, sun_y + rad], fill=(255, 188, 92, a))
img.paste(Image.alpha_composite(img.convert("RGBA"), glow).convert("RGB"), (0, 0))
d = ImageDraw.Draw(img, "RGBA")
d.ellipse([sun_x - sun_r, sun_y - sun_r, sun_x + sun_r, sun_y + sun_r], fill=(255, 226, 152))

# --- distant ridge ---
d.polygon([(x, int(H*0.46) + math.sin(x/260)*18 + math.sin(x/97+2)*8) for x in range(0, W+12, 12)] + [(W, H), (0, H)],
          fill=(88, 96, 54))

# --- mid valley floor ---
d.polygon([(x, int(H*0.56) + math.sin(x/190+0.8)*24 + math.sin(x/80+1.2)*9) for x in range(0, W+12, 12)] + [(W, H), (0, H)],
          fill=(74, 88, 46))
# near meadow
d.polygon([(x, int(H*0.70) + math.sin(x/170+3.1)*18 + math.sin(x/70+0.4)*7) for x in range(0, W+12, 12)] + [(W, H), (0, H)],
          fill=(58, 74, 38))

# --- olive grove dots on the mid ridge ---
for _ in range(110):
    x = random.randint(0, W)
    y = random.randint(int(H * 0.57), int(H * 0.70))
    r = random.randint(3, 9)
    shade = random.choice([(66, 84, 40, 210), (78, 96, 44, 210), (58, 74, 34, 210)])
    d.ellipse([x - r, y - r, x + r, y + r], fill=shade)

# --- river Nabão: continuous polygon from spring (right) toward viewer ---
bank_l, bank_r = [], []
rx = int(W * 0.64)
for i in range(48):
    y = int(H * 0.565) + i * ((H - int(H*0.565)) / 47)
    t = i / 47
    x = rx + math.sin(t * 5.2) * (26 + t * 70) + t * 60
    halfw = 7 + t * 42
    bank_l.append((x - halfw, y)); bank_r.append((x + halfw, y))
d.polygon(bank_l + bank_r[::-1], fill=(108, 146, 168))
# lighter inner channel + sun glitter
inner_l = [(x + 3, y) for x, y in bank_l]; inner_r = [(x - 3, y) for x, y in bank_r]
d.polygon(inner_l + inner_r[::-1], fill=(132, 172, 194))
for i in range(0, 48, 2):
    t = i / 47
    x = rx + math.sin(t * 5.2) * (26 + t * 70) + t * 60
    y = int(H * 0.565) + i * ((H - int(H*0.565)) / 47)
    w = (7 + t * 42) * 0.55
    d.line([(x - w, y), (x + w, y)], fill=(255, 216, 140, 110))

# --- three glass pyramids on the mid ridge ---
def pyramid(cx, base_y, half_w, h, tint):
    d.polygon([(cx - half_w, base_y), (cx, base_y - h), (cx + half_w, base_y)],
              fill=(170, 205, 218, 70), outline=(235, 246, 240, 210))
    d.polygon([(cx - half_w * 0.5, base_y - 5), (cx, base_y - h + 10), (cx + half_w * 0.5, base_y - 5)],
              fill=tint)
    for f in (0.3, 0.6, 0.85):
        yy = base_y - h * f
        ww = half_w * (1 - f)
        d.line([(cx - ww, yy), (cx + ww, yy)], fill=(240, 248, 242, 160), width=2)
    d.line([(cx - half_w, base_y), (cx, base_y - h)], fill=(248, 250, 244, 230), width=3)
    d.line([(cx + half_w, base_y), (cx, base_y - h)], fill=(248, 250, 244, 170), width=3)

pyr_y = int(H * 0.565) + 22
pyramid(int(W * 0.50), pyr_y, 160, 180, (255, 216, 130, 100))      # Budoucnost — center, tallest
pyramid(int(W * 0.325), pyr_y + 26, 115, 125, (215, 228, 200, 80)) # Paměť
pyramid(int(W * 0.675), pyr_y + 26, 115, 125, (205, 224, 238, 80)) # Vědomí

# --- Tree of Life between the pyramids ---
tx, ty = int(W * 0.50), pyr_y + 44
d.line([(tx, ty), (tx, ty - 64)], fill=(64, 44, 28), width=10)
for dx_, dy_, r_ in [(-36, -76, 30), (36, -76, 30), (0, -92, 34), (-14, -64, 26), (16, -64, 26)]:
    d.ellipse([tx + dx_ - r_, ty + dy_ - r_, tx + dx_ + r_, ty + dy_ + r_],
              fill=(56, 92, 40, 240))
d.ellipse([tx - 7, ty - 112, tx + 7, ty - 98], fill=(128, 170, 76))

# --- pilgrim path to the albergue (left foreground, drawn as filled ribbon) ---
pl, pr = [], []
px0, py0 = int(W * 0.10), H - 12
for i in range(40):
    t = i / 39
    x = px0 + t * 300 + math.sin(t * 4.4) * 26
    y = py0 - t * (H * 0.20)
    halfw = 26 - t * 16
    pl.append((x - halfw, y)); pr.append((x + halfw, y))
d.polygon(pl + pr[::-1], fill=(186, 168, 122))
d.polygon([(x + 3, y) for x, y in pl] + [(x - 3, y) for x, y in pr][::-1], fill=(206, 190, 142))
# stepping stones
for i in range(0, 40, 5):
    t = i / 39
    x = px0 + t * 300 + math.sin(t * 4.4) * 26
    y = py0 - t * (H * 0.20)
    r = max(2, 8 - t * 5)
    d.ellipse([x - r, y - r / 2, x + r, y + r / 2], fill=(140, 126, 92))

# --- grass tufts ---
for _ in range(240):
    x = random.randint(0, W)
    y = random.randint(int(H * 0.78), H - 4)
    d.line([(x, y), (x, y - random.randint(3, 10))], fill=(86, 108, 48, 190))

# --- soft mist band over the valley ---
mist = Image.new("RGBA", (W, H), (0, 0, 0, 0))
md = ImageDraw.Draw(mist)
md.rectangle([0, int(H * 0.52), W, int(H * 0.66)], fill=(240, 228, 198, 30))
mist = mist.filter(ImageFilter.GaussianBlur(30))
img = Image.alpha_composite(img.convert("RGBA"), mist).convert("RGB")

# --- caption band ---
d = ImageDraw.Draw(img, "RGBA")
d.rectangle([0, H - 110, W, H], fill=(18, 26, 20, 120))
f1 = ImageFont.truetype("/System/Library/Fonts/Supplemental/Times New Roman.ttf", 30)
f2 = ImageFont.truetype("/System/Library/Fonts/Supplemental/Times New Roman.ttf", 15)
t1 = "GENESIS GARDEN"
w1 = d.textlength(t1, font=f1)
d.text(((W - w1) / 2, H - 92), t1, font=f1, fill=(244, 220, 146))
t2 = "SABACHEIRA · TOMAR · PORTUGAL — CAMINHO DO JARDIM"
w2 = d.textlength(t2, font=f2)
d.text(((W - w2) / 2, H - 48), t2, font=f2, fill=(226, 206, 156))
d.line([(W / 2 - 200, H - 102), (W / 2 + 200, H - 102)], fill=(206, 182, 114, 170), width=1)

img.save("GenesisSabacheira.png")
print("saved GenesisSabacheira.png", img.size)
