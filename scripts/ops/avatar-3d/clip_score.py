#!/usr/bin/env python3
"""CLIP skóre: jak blízko má vygenerovaná postava k výtvarnému listu.

Na rozdíl od `similarity.py` (geometrie + barva) používá sémantický embedding
(`openai/clip-vit-base-patch32`, MIT). Umí rozlišit víc, ale **ne dost na
automatické schvalování** — naměřeno na prvním avatarovi:

    dobrý model vs list    0,549
    vadný model vs list    0,499      (rozdíl 0,05)
    dobrý model vs portrét 0,438
    vadný model vs portrét 0,424      (rozdíl 0,014, nepoužitelné)

Proto se skóre používá k **seřazení k lidské kontrole** a k výběru nejlepší
varianty z několika generací, ne jako práh „prošlo/neprošlo".

Použití:
    python3 scripts/ops/avatar-3d/clip_score.py --qa <list.png> --refs <adresář> \
        [--json <list.json>] [--portraits] [--sort]

Výstup: tabulka ID → skóre, volitelně JSON.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import torch
import torch.nn.functional as F
from PIL import Image
from transformers import CLIPImageProcessor, CLIPModel

MODEL = "openai/clip-vit-base-patch32"


class Scorer:
    def __init__(self) -> None:
        self.model = CLIPModel.from_pretrained(MODEL).eval()
        self.processor = CLIPImageProcessor.from_pretrained(MODEL)

    def embed(self, image: Image.Image) -> torch.Tensor:
        with torch.no_grad():
            features = self.model.get_image_features(
                **self.processor(images=image, return_tensors="pt")
            )
        return F.normalize(features, dim=-1)


def crop_cell(sheet: Image.Image, row: int, cell: int, label: int, column: int = 1) -> Image.Image:
    top = row * (cell + label)
    return sheet.crop((column * cell, top, (column + 1) * cell, top + cell))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--qa", type=Path, required=True)
    parser.add_argument("--json", type=Path, default=None)
    parser.add_argument("--refs", type=Path, required=True, help="adresář s <id>-front.png")
    parser.add_argument("--portraits", type=Path, default=Path("apps/website-v2.9/public/oasis-assets/final_portraits"))
    parser.add_argument("--roster", type=Path, default=Path("V31/L4/oasis/data/avatars.json"))
    parser.add_argument("--with-portrait", action="store_true", help="spočítat i skóre proti portrétu")
    parser.add_argument("--sort", action="store_true", help="seřadit od nejhoršího")
    parser.add_argument("--out", type=Path, default=None)
    args = parser.parse_args()

    meta = json.loads((args.json or args.qa.with_suffix(".json")).read_text())
    ids = list(meta["ids"])
    cell = int(meta["cell"])
    label = 34

    roster = {str(a["id"]).zfill(3): a for a in json.loads(args.roster.read_text())["avatars"]}
    scorer = Scorer()
    sheet = Image.open(args.qa).convert("RGB")

    rows = []
    for index, avatar_id in enumerate(ids):
        avatar = roster.get(avatar_id)
        reference = args.refs / f"{avatar_id}-front.png"
        if not avatar or not reference.is_file():
            rows.append({"id": avatar_id, "name": avatar["name"] if avatar else "?", "score": None})
            continue
        render = scorer.embed(crop_cell(sheet, index, cell, label))
        ref = scorer.embed(Image.open(reference).convert("RGB"))
        score = float(render @ ref.T)
        row = {"id": avatar_id, "name": avatar["name"], "score": round(score, 4)}
        if args.with_portrait:
            portrait = args.portraits / avatar["image_url"].split("/")[-1]
            if portrait.is_file():
                row["portrait"] = round(
                    float(render @ scorer.embed(Image.open(portrait).convert("RGB")).T), 4
                )
        rows.append(row)

    ordered = sorted(
        [r for r in rows if r["score"] is not None], key=lambda r: r["score"], reverse=not args.sort
    )
    width = max((len(r["name"]) for r in ordered), default=8)
    print(f"{'ID':<4} {'jméno':<{width}} {'CLIP':>7}" + ("  portrét" if args.with_portrait else ""))
    for row in ordered:
        line = f"{row['id']:<4} {row['name']:<{width}} {row['score']:>7.3f}"
        if args.with_portrait and "portrait" in row:
            line += f"  {row['portrait']:>7.3f}"
        print(line)
    for row in rows:
        if row["score"] is None:
            print(f"{row['id']:<4} {row['name']:<{width}} {'—':>7}  chybí podklad")

    if args.out:
        args.out.write_text(json.dumps({"source": str(args.qa), "rows": rows}, indent=1) + "\n")
    print(
        "\nSkóre slouží k seřazení k lidské kontrole; samo o sobě nerozhoduje."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
