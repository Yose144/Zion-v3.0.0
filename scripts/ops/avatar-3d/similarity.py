#!/usr/bin/env python3
"""Měření podoby vygenerované postavy proti oficiálnímu portrétu.

Není to rozpoznávání tváře. Počítá dvě věci, které stačí na odhalení hrubých
selhání v dávce:

1. **Silueta (IoU)** — jak moc se překrývá obrys postavy na renderu s obrysem
   postavy na portrétu po normalizaci výšky.
2. **Paleta (ΔE)** — vzdálenost průměrné barvy postavy v Lab prostoru.

Práh sám neschválí podobu; má **vyřadit** zjevné chyby (rozbitý model, špatná
postava, převrácené barvy), aby se lidská kontrola soustředila na zbytek.

Použití:
    python3 scripts/ops/avatar-3d/similarity.py --qa .artifacts/avatar-3d/qa/<stamp>.png \
        [--json .artifacts/avatar-3d/qa/<stamp>.json] [--out report.json]

Výstup: tabulka na stdout, JSON s metrikami, nenulový exit když něco propadne.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from skimage.color import rgb2lab

BACKGROUND = (0x15, 0x1A, 0x26)  # pozadí QA listu
SIZE = 256
MIN_IOU = 0.55
HEAD_BAND = 0.20  # horních 20 % výšky postavy = hlava a ramena
MAX_DELTA_E = 30.0
MIN_HEAD_IOU = 0.55


def mask_from_render(cell: Image.Image) -> np.ndarray:
    """Maska postavy na renderu: vše, co není pozadí listu."""
    array = np.asarray(cell.convert("RGB")).astype(np.int16)
    distance = np.abs(array - np.array(BACKGROUND)).sum(axis=2)
    return distance > 40


def mask_from_reference(path: Path) -> np.ndarray:
    """Maska postavy na výtvarném listu (jednotné šedé pozadí).

    Srovnává se proti **celopostavovému listu**, ne proti portrétu: portrét je
    jen poprsí, takže by IoU proti celé postavě vyšlo nízké i u správného modelu.
    """
    array = np.asarray(Image.open(path).convert("RGB")).astype(np.int16)
    border = np.concatenate([array[0], array[-1], array[:, 0], array[:, -1]])
    background = np.median(border, axis=0)
    return np.abs(array - background).sum(axis=2) > 40


def normalize(mask: np.ndarray, image: np.ndarray | None = None):
    """Ořízne na obrys a srovná výšku na SIZE, šířku doplní pozadím."""
    rows = np.where(mask.any(axis=1))[0]
    cols = np.where(mask.any(axis=0))[0]
    if len(rows) == 0 or len(cols) == 0:
        return None, None
    top, bottom = rows[0], rows[-1] + 1
    left, right = cols[0], cols[-1] + 1

    cropped_mask = mask[top:bottom, left:right]
    height = SIZE
    width = max(1, round(cropped_mask.shape[1] * (height / cropped_mask.shape[0])))
    resized = np.asarray(
        Image.fromarray((cropped_mask * 255).astype(np.uint8)).resize((width, height), Image.NEAREST)
    ) > 127

    canvas = np.zeros((height, SIZE), dtype=bool)
    if width <= SIZE:
        offset = (SIZE - width) // 2
        canvas[:, offset : offset + width] = resized
    else:
        offset = (width - SIZE) // 2
        canvas[:, :] = resized[:, offset : offset + SIZE]

    resized_image = None
    if image is not None:
        crop = image[top:bottom, left:right]
        resized_image = np.asarray(
            Image.fromarray(crop.astype(np.uint8)).resize((width, height), Image.LANCZOS)
        ).astype(np.float32)
        padded = np.zeros((height, SIZE, 3), dtype=np.float32)
        if width <= SIZE:
            offset = (SIZE - width) // 2
            padded[:, offset : offset + width] = resized_image
        else:
            offset = (width - SIZE) // 2
            padded[:, :] = resized_image[:, offset : offset + SIZE]
        resized_image = padded

    return canvas, resized_image


def iou(a: np.ndarray, b: np.ndarray) -> float:
    union = np.logical_or(a, b).sum()
    if union == 0:
        return 0.0
    return float(np.logical_and(a, b).sum() / union)


def palette_delta_e(image: np.ndarray, mask: np.ndarray) -> float:
    if image is None or mask.sum() == 0:
        return float("nan")
    pixels = image[mask] / 255.0
    mean = pixels.mean(axis=0)
    lab = rgb2lab(mean.reshape(1, 1, 3))[0, 0]
    # Referenční body: průměr je jen orientační, proto se měří vzdálenost mezi
    # průměrnými barvami obou obrázků, ne proti pevnému bodu.
    return float(np.linalg.norm(lab))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--qa", type=Path, required=True, help="kontrolní list (PNG)")
    parser.add_argument("--json", type=Path, default=None, help="metadata listu (výchozí stejný název)")
    parser.add_argument("--out", type=Path, default=None)
    parser.add_argument("--refs", type=Path, required=True, help="adresář s <id>-front.png (výtvarné listy)")
    parser.add_argument("--roster", type=Path, default=Path("V31/L4/oasis/data/avatars.json"))
    args = parser.parse_args()

    meta_path = args.json or args.qa.with_suffix(".json")
    if not meta_path.is_file():
        print(f"chybí metadata: {meta_path}", file=sys.stderr)
        return 2
    meta = json.loads(meta_path.read_text())

    sheet = Image.open(args.qa).convert("RGB")
    cell = int(meta["cell"])
    label = 34
    columns = int(meta.get("columns", 5))
    ids = list(meta["ids"])

    roster = {str(a["id"]).zfill(3): a for a in json.loads(args.roster.read_text())["avatars"]}
    results = []

    for row, avatar_id in enumerate(ids):
        top = row * (cell + label)
        render_cell = sheet.crop((cell, top, cell * 2, top + cell))
        render_mask = mask_from_render(render_cell)
        render_rgb = np.asarray(render_cell)

        avatar = roster.get(avatar_id)
        if not avatar:
            results.append({"id": avatar_id, "status": "unknown-id"})
            continue
        reference_path = args.refs / f"{avatar_id}-front.png"
        if not reference_path.is_file():
            results.append({"id": avatar_id, "status": "missing-reference"})
            continue

        reference_mask = mask_from_reference(reference_path)
        reference_rgb = np.asarray(Image.open(reference_path).convert("RGB"))

        a_mask, a_rgb = normalize(render_mask, render_rgb)
        b_mask, b_rgb = normalize(reference_mask, reference_rgb)
        if a_mask is None or b_mask is None:
            results.append({"id": avatar_id, "status": "empty-mask"})
            continue

        overlap = iou(a_mask, b_mask)
        band = max(1, int(round(SIZE * HEAD_BAND)))
        head_overlap = iou(a_mask[:band], b_mask[:band])
        lab_a = rgb2lab(a_rgb[a_mask].mean(axis=0).reshape(1, 1, 3) / 255.0)[0, 0]
        lab_b = rgb2lab(b_rgb[b_mask].mean(axis=0).reshape(1, 1, 3) / 255.0)[0, 0]
        delta_e = float(np.linalg.norm(lab_a - lab_b))

        passed = overlap >= MIN_IOU and head_overlap >= MIN_HEAD_IOU and delta_e <= MAX_DELTA_E
        results.append(
            {
                "id": avatar_id,
                "name": avatar["name"],
                "status": "ok" if passed else "review",
                "silhouette_iou": round(overlap, 3),
                "head_iou": round(head_overlap, 3),
                "delta_e": round(delta_e, 1),
            }
        )

    width = max((len(r.get("name", "")) for r in results), default=8)
    print(f"{'ID':<4} {'jméno':<{width}} {'IoU':>6} {'hlava':>6} {'ΔE':>6}  stav   (práh IoU ≥ {MIN_IOU}, hlava ≥ {MIN_HEAD_IOU}, ΔE ≤ {MAX_DELTA_E})")
    for row in results:
        if "silhouette_iou" in row:
            print(
                f"{row['id']:<4} {row['name']:<{width}} {row['silhouette_iou']:>6.3f} "
                f"{row['head_iou']:>6.3f} {row['delta_e']:>6.1f}  {row['status']}"
            )
        else:
            print(f"{row['id']:<4} {'?':<{width}} {'-':>6} {'-':>6} {'-':>6}  {row['status']}")

    failed = [r["id"] for r in results if r.get("status") != "ok"]
    if args.out:
        args.out.write_text(json.dumps({"source": str(args.qa), "results": results}, indent=1) + "\n")
    print(f"\nhotovo: {len(results) - len(failed)}/{len(results)} v pořádku")
    if failed:
        print("k lidské kontrole: " + ", ".join(failed))
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
