"""Sestaví QA kontaktní list z vyrenderovaných pohledů (front/3q/side/back).

Používá se po dávce avatarů: jeden PNG = všechny postavy × čtyři pohledy,
takže se dá dávka zkontrolovat očima v jediném obrázku.

Použití:
    python scripts/ops/avatar-3d/qa-sheet.py <adresář> <výstup.png> [sloupců]

Adresář obsahuje podsložky podle ID (078/{front,threequarter,side,back}.png).
"""
import glob
import os
import sys

from PIL import Image, ImageDraw

src = sys.argv[1]
out = sys.argv[2]
per_row = int(sys.argv[3]) if len(sys.argv) > 3 else 5

ids = sorted(os.path.basename(d) for d in glob.glob(os.path.join(src, "*")) if os.path.isdir(d))
if not ids:
    raise SystemExit("žádné renderované adresáře")

w, h = Image.open(os.path.join(src, ids[0], "front.png")).size
strip_w, strip_h = w * 4, h
rows = (len(ids) + per_row - 1) // per_row
sheet = Image.new("RGB", (strip_w * per_row, (strip_h + 16) * rows), (18, 18, 18))
draw = ImageDraw.Draw(sheet)
for k, aid in enumerate(ids):
    x = (k % per_row) * strip_w
    y = (k // per_row) * (strip_h + 16)
    draw.text((x + 4, y + 2), aid, fill=(240, 210, 110))
    for j, name in enumerate(("front", "threequarter", "side", "back")):
        p = os.path.join(src, aid, f"{name}.png")
        if os.path.exists(p):
            sheet.paste(Image.open(p).convert("RGB"), (x + j * w, y + 16))
sheet.save(out)
print(len(ids), sheet.size)
