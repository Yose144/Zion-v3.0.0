#!/usr/bin/env python3
"""Vybere z výtvarného listu panel s celou postavou a ořízne ho.

Proč vlastní skript a ne `crop-sheet.py`: listy nejsou jednotné a proporcionální
dělení na čtvrtiny selhává čtyřmi způsoby, které tiše zničí kvalitu modelu
(TripoSR dostane bustu, dvě postavy nebo popředí s rekvizitami):

1. **Pás rekvizit** pod postavou (lotos, miska, kniha) → popředí je celý list,
   postava se zmenší a vygeneruje se „nafouklý blob".
2. **Tenká rekvizita spojí pásy** (Šivův trojzubec vede od poprsí dolů) →
   rozdělení na pásy nefunguje a modelem je „bust + předměty".
3. **Poprsí je někdy první panel** (ID 118, 143, 149, 150…) → proporcionální
   ořez vrátí portrét, ne celou postavu.
4. **Pruh sousedního panelu** u okraje → rozšíří ohraničující box.

Postup: panely se hledají jako svislé pásy obsahu v horní části listu (pod
rekvizitami), každý se ohne na hlavní pás (řádek patří postavě, jen když zabírá
≥ 15 % šířky panelu — tenký předmět tím vypadne) a vybere se **nejlevější panel
s poměrem výška/šířka > 2,0** (u hada/orla/pavouka nejvyšší poměr).

Použití:
    python scripts/ops/avatar-3d/pick-front.py <list.png> <výstup> --id 084
    python scripts/ops/avatar-3d/pick-front.py <list.png> <výstup> --id 137 \
        --box 448,760            # vynucený rozsah sloupců (pixely)
    python scripts/ops/avatar-3d/pick-front.py <list.png> <výstup> --id 148 \
        --box 0,560,0,470        # x0,x1,y0,y1

Výstup: <výstup>/<id>-front.png (jen přední pohled — TripoSR je single-view).

Potřebuje Pillow a numpy (venv pipeline, viz docs/3.2/AVATAR-3D-PIPELINE.md §2).
"""
from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image

BG_TOL = 14          # odchylka od barvy pozadí, která se ještě počítá jako pozadí
COL_GAP = 4          # mezera (sloupce) mezi panely
ROW_GAP = 10         # mezera (řádky) mezi pásy obsahu
FIGURE_REGION = 0.62  # horní část listu, kde se hledají panely (bez pásu rekvizit)
FULL_BODY_ASPECT = 2.0
MIN_PANEL_WIDTH = 60  # px; menší pásy jsou šum nebo zbytky
ROW_FILL = 0.15      # řádek patří postavě, jen když zabírá ≥ 15 % šířky panelu


def bg_color(a: np.ndarray) -> np.ndarray:
    """Barva pozadí = nejčastější barva na okrajích listu."""
    edge = np.concatenate([
        a[0, :, :3].reshape(-1, 3), a[-1, :, :3].reshape(-1, 3),
        a[:, 0, :3].reshape(-1, 3), a[:, -1, :3].reshape(-1, 3),
    ])
    vals, counts = np.unique(edge, axis=0, return_counts=True)
    return vals[counts.argmax()]


def mask_of(a: np.ndarray) -> np.ndarray:
    bg = bg_color(a).astype(np.int16)
    return np.abs(a.astype(np.int16) - bg).max(axis=2) > BG_TOL


def bands(occ: np.ndarray, gap: int) -> list[tuple[int, int]]:
    """Souvislé úseky `True` s tolerancí mezery `gap`."""
    idx = np.flatnonzero(occ)
    if idx.size == 0:
        return []
    out: list[tuple[int, int]] = []
    start = prev = int(idx[0])
    for i in idx[1:]:
        i = int(i)
        if i - prev > gap:
            out.append((start, prev))
            start = i
        prev = i
    out.append((start, prev))
    return out


def panels(mask: np.ndarray) -> list[tuple[int, int]]:
    """Svislé panely zjištěné v horní části listu."""
    h = mask.shape[0]
    region = mask[: int(h * FIGURE_REGION)]
    occ = region.sum(axis=0) > 3
    found = [b for b in bands(occ, COL_GAP) if b[1] - b[0] > MIN_PANEL_WIDTH]
    if len(found) >= 3:
        return found
    # fallback: proporcionální čtvrtiny (když gutter detekce selže úplně)
    w = mask.shape[1]
    step = w // 4
    return [(i * step, (i + 1) * step - 1) for i in range(4)]


def trim(mask: np.ndarray, box: tuple[int, int]) -> tuple[int, int, int, int] | None:
    """Ohne panel na hlavní postavu (pásy řádků + sloupců)."""
    x0, x1 = box
    sub = mask[:, x0:x1 + 1]
    width = max(1, sub.shape[1])
    rows = bands(sub.sum(axis=1) > width * ROW_FILL, ROW_GAP)
    if not rows:
        return None
    y0, y1 = max(rows, key=lambda b: b[1] - b[0])
    cols = bands(sub[y0:y1 + 1].sum(axis=0) > 3, COL_GAP)
    if not cols:
        return None
    cx0, cx1 = max(cols, key=lambda b: b[1] - b[0])
    return (x0 + cx0, y0, x0 + cx1 + 1, y1 + 1)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("sheet", type=Path)
    ap.add_argument("out", type=Path)
    ap.add_argument("--id", required=True)
    ap.add_argument("--box", default=None,
                    help="vynutit rozsah x0,x1[,y0,y1] (pixely nebo 0–1) místo volby panelu")
    args = ap.parse_args()

    image = Image.open(args.sheet).convert("RGB")
    mask = mask_of(np.asarray(image))

    if args.box:
        w, h = image.size
        parts = [float(p) for p in args.box.split(",")]
        if len(parts) == 2:
            parts += [0.0, 1.0]
        x0, x1, y0, y1 = parts
        scale = lambda v, size: int(round(v * size)) if v <= 1.0 else int(v)  # noqa: E731
        px0, px1 = scale(x0, w), scale(x1, w)
        py0, py1 = scale(y0, h), scale(y1, h)
        sub = mask[py0:py1, px0:px1]
        rows = bands(sub.sum(axis=1) > 3, ROW_GAP)
        cols = bands(sub.sum(axis=0) > 3, COL_GAP)
        if rows and cols:
            ry0, ry1 = max(rows, key=lambda b: b[1] - b[0])
            cx0, cx1 = max(cols, key=lambda b: b[1] - b[0])
            box = (px0 + cx0, py0 + ry0, px0 + cx1 + 1, py0 + ry1 + 1)
        else:
            box = (px0, py0, px1, py1)
        args.out.mkdir(parents=True, exist_ok=True)
        image.crop(box).save(args.out / f"{args.id}-front.png")
        print(f"{args.id}: vynucený box {box}")
        return 0

    boxes: list[tuple[tuple[int, int, int, int], float]] = []
    for panel in panels(mask):
        box = trim(mask, panel)
        if not box:
            continue
        x0, y0, x1, y1 = box
        boxes.append((box, (y1 - y0) / max(1, (x1 - x0))))
    if not boxes:
        print(f"{args.id}: žádný panel nenalezen", flush=True)
        return 1

    tall = [b for b in boxes if b[1] > FULL_BODY_ASPECT]
    if tall:
        chosen, aspect = sorted(tall, key=lambda b: b[0][0])[0]
    else:
        chosen, aspect = max(boxes, key=lambda b: b[1])

    args.out.mkdir(parents=True, exist_ok=True)
    image.crop(chosen).save(args.out / f"{args.id}-front.png")
    desc = ", ".join(f"[{b[0]}-{b[2]}] {a:.2f}" for b, a in boxes)
    print(f"{args.id}: panel {chosen} aspect={aspect:.2f} | kandidáti: {desc}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
