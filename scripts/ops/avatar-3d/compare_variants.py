#!/usr/bin/env python3
"""Srovnání variant generovaných z TripoSR na jedné mosaikě + CLIP skóre.

Skládá se k `qa.mjs`, který pro každou variantu vykreslí mosaiku
(portrét + 4 pohledy modelu). Tenhle skript:

1. načte mosaiky (PNG + JSON se stejným stem, layout z `qa.mjs`),
2. vyřeže buňky pohledů (sloupce 1–4, hledám zvolený řádek),
3. spočítá CLIP kosinovou podobnost proti předlohám z výtvarného listu
   (front→front, side→side, back→back),
4. poskládá vertikální mosaiku všech variant s popisky a skóre.

CLIP je **řadicí** signál, ne schvalovací brána (viz AVATAR-3D-PIPELINE §9b);
rozhodující je lidské oko nad srovnávací mosaikou.

Použití (uvnitř venv z TripoSR experimentu):
    python3 scripts/ops/avatar-3d/compare_variants.py \
        --mosaics old=.artifacts/.../qa-old.png a=.artifacts/.../qa-a.png ... \
        --id 000 --base-refs <adresář s {id}-{front,side,back}.png> \
        --out .artifacts/.../compare.png
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw

LABEL_W = 34
VIEW_SLOTS = ["front", "front3-4", "side", "back"]
REF_SLOTS = ["front", "front", "side", "back"]


def cells_of(root: Path, row: int, cell: int, label: int) -> list[Image.Image]:
    """Vyřeže celý řádek mosaiky (sloupec 0 = portrét, 1–4 = pohledy)."""
    page = Image.open(root).convert("RGB")
    top = row * (cell + label)
    return [page.crop((col * cell, top, (col + 1) * cell, top + cell)) for col in range(5)]


def layout_of(mosaic: Path, row_of: dict[str, int], avatar_id: str) -> tuple[int, int, int]:
    meta = json.loads(mosaic.with_suffix(".json").read_text())
    cell = int(meta["cell"])
    label = 34
    ids = [str(i).zfill(3) for i in meta["ids"]]
    if avatar_id not in ids:
        raise SystemExit(f"{mosaic.name}: id {avatar_id} není v mosaice ({ids})")
    return row_of.get(avatar_id, ids.index(avatar_id)), cell, label


def main() -> int:
    import torch
    import torch.nn.functional as F
    from transformers import CLIPImageProcessor, CLIPModel

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--mosaics",
        nargs="+",
        required=True,
        help="název=cesta_k_PNG (mínus malé varianty, plus 'old' pro původní model)",
    )
    parser.add_argument("--id", required=True, help="ID postavy, např. 000")
    parser.add_argument("--refs", type=Path, required=True, help="adresář s {id}-{front,side,back}.png")
    parser.add_argument("--out", type=Path, required=True, help="výstupní srovnávací PNG")
    parser.add_argument("--hf-home", type=Path, default=None)
    args = parser.parse_args()

    if args.hf_home:
        args.hf_home.mkdir(parents=True, exist_ok=True)

    model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32").eval()
    processor = CLIPImageProcessor.from_pretrained("openai/clip-vit-base-patch32")

    def embed(image: Image.Image) -> torch.Tensor:
        with torch.no_grad():
            feats = model.get_image_features(**processor(images=image, return_tensors="pt"))
        return F.normalize(feats, dim=-1)

    refs = {
        slot: embed(Image.open(args.refs / f"{args.id}-{slot}.png").convert("RGB"))
        for slot in ("front", "side", "back")
    }

    rows = []
    for spec in args.mosaics:
        name, _, path = spec.partition("=")
        mosaic = Path(path)
        row, cell, label = layout_of(mosaic, {}, args.id)
        cells = cells_of(mosaic, row, cell, label)
        views = {}  # popisek pohledu → skóre proti odpovídající předloze
        for view_label, ref_slot in zip(VIEW_SLOTS, REF_SLOTS):
            render = embed(cells[1 + VIEW_SLOTS.index(view_label)])
            views[view_label] = float(render @ refs[ref_slot].T)
        rows.append(
            {
                "name": name,
                "front": round(views["front"], 4),
                "side": round(views["side"], 4),
                "back": round(views["back"], 4),
                "avg": round((views["front"] + views["front3-4"] + views["side"] + views["back"]) / 4, 4),
                "cells": cells,
            }
        )

    width = max(len(r["name"]) for r in rows)
    print(f"{'varianta':<{width}} {'front':>7} {'side':>7} {'back':>7} {'avg':>7}")
    for row in rows:
        print(
            f"{row['name']:<{width}} {row['front']:>7.4f} {row['side']:>7.4f}"
            f" {row['back']:>7.4f} {row['avg']:>7.4f}"
        )

    # Srovnávací mosaika: portrét + 4 pohledy na každý řádek, s popiskem.
    _, cell, label = (0, None, LABEL_W)  # banyak šum; mosaika je single-row
    _, cell, _ = layout_of(Path(args.mosaics[0].partition("=")[2]), {}, args.id)
    top = 0
    out_image = Image.new("RGB", (cell * 5, (cell + label) * len(rows) + label), "#0e1018")
    draw = ImageDraw.Draw(out_image)
    for index, row in enumerate(rows):
        top = label + index * (cell + label)
        col = 0
        for cell_img in row["cells"]:
            out_image.paste(cell_img, (col * cell, top))
            col += 1
        draw.text(
            (10, label + index * (cell + label) - 24),
            f"{row['name']}  front {row['front']:.3f}  side {row['side']:.3f}  "
            f"back {row['back']:.3f}",
            fill="#e6ebf5",
        )
    args.out.parent.mkdir(parents=True, exist_ok=True)
    out_image.save(args.out)
    print(f"mosaika: {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
