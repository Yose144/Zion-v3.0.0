#!/usr/bin/env python3
"""Rozdělí výtvarný list (front | side | back | detail) na samostatné obrázky.

Listy z ImageGen mají konzistentní rozvržení, ale šířky sloupců se mírně liší.
Proto se hranice hledají jako plné svislé pruhy pozadí (guttery); když se najdou
méně než tři, použije se proporcionální fallback.

Použití:
    python3 scripts/ops/avatar-3d/crop-sheet.py <list.png> <vystupni-adresar> \
        [--id 000] [--debug]

Výstup: <id>-front.png, <id>-side.png, <id>-back.png, <id>-detail.png
a <id>-crop.json s nalezenými hranicemi (pro dohledatelnost).
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from PIL import Image


def background_color(image: Image.Image) -> tuple[int, int, int]:
    """Barva pozadí = nejčastější barva na okrajích."""
    rgb = image.convert("RGB")
    w, h = rgb.size
    edge = []
    for x in range(w):
        edge.append(rgb.getpixel((x, 0)))
        edge.append(rgb.getpixel((x, h - 1)))
    counts: dict[tuple[int, int, int], int] = {}
    for pixel in edge:
        counts[pixel] = counts.get(pixel, 0) + 1
    return max(counts, key=counts.get)


def column_is_empty(image: Image.Image, bg: tuple[int, int, int], x: int, tolerance: int = 12) -> bool:
    """True, když je celý sloupec pozadí (s tolerancí kvůli kompresi)."""
    rgb = image.convert("RGB")
    _, h = rgb.size
    step = max(1, h // 64)
    for y in range(0, h, step):
        r, g, b = rgb.getpixel((x, y))
        if abs(r - bg[0]) > tolerance or abs(g - bg[1]) > tolerance or abs(b - bg[2]) > tolerance:
            return False
    return True


def find_gutters(image: Image.Image, bg: tuple[int, int, int]) -> list[tuple[int, int]]:
    """Vrátí intervaly [start, end) sloupců, které jsou celé pozadí."""
    width, _ = image.size
    gutters: list[tuple[int, int]] = []
    start: int | None = None
    for x in range(width):
        if column_is_empty(image, bg, x):
            if start is None:
                start = x
        elif start is not None:
            gutters.append((start, x))
            start = None
    if start is not None:
        gutters.append((start, width))
    return gutters


def split_bounds(image: Image.Image, force_ratio: bool = False) -> tuple[list[tuple[int, int]], str]:
    """Najde hranice čtyř panelů; vrací intervaly a použitou metodu."""
    width, _ = image.size
    bg = background_color(image)
    gutters = [g for g in find_gutters(image, bg) if g[1] - g[0] >= max(3, width // 400)]

    # Vnitřní guttery (bez okrajů) rozdělují panel na sloupce.
    inner = [g for g in gutters if g[0] > width * 0.02 and g[1] < width * 0.98]
    if len(inner) >= 3 and not force_ratio:
        cuts = [0] + [int((a + b) / 2) for a, b in inner[:3]] + [width]
        method = "gutter"
    else:
        ratios = [0.0, 0.278, 0.496, 0.742, 1.0]
        cuts = [int(width * r) for r in ratios]
        method = "ratio"
    bounds = [(cuts[i], cuts[i + 1]) for i in range(len(cuts) - 1)]
    return bounds, method


def trim(image: Image.Image, bg: tuple[int, int, int], tolerance: int = 12) -> Image.Image:
    """Ořízne prázdné okraje panelu, aby postava vyplnila rám."""
    rgb = image.convert("RGB")
    w, h = rgb.size
    left, right, top, bottom = w, -1, h, -1
    for x in range(w):
        for y in range(h):
            r, g, b = rgb.getpixel((x, y))
            if abs(r - bg[0]) > tolerance or abs(g - bg[1]) > tolerance or abs(b - bg[2]) > tolerance:
                left = min(left, x)
                right = max(right, x)
                top = min(top, y)
                bottom = max(bottom, y)
    if right < 0:
        return image
    pad = 6
    return image.crop((max(0, left - pad), max(0, top - pad), min(w, right + pad), min(h, bottom + pad)))


def square_on_background(image: Image.Image, bg: tuple[int, int, int], size: int = 1024) -> Image.Image:
    """Vloží postavu do čtverce s pozadím, aby ji generátor viděl celou."""
    scale = min(size / image.width, size / image.height)
    resized = image.resize((max(1, round(image.width * scale)), max(1, round(image.height * scale))), Image.LANCZOS)
    canvas = Image.new("RGB", (size, size), bg)
    canvas.paste(resized, ((size - resized.width) // 2, size - resized.height))
    return canvas


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("sheet", type=Path)
    parser.add_argument("out", type=Path)
    parser.add_argument("--id", default=None, help="ID postavy, jinak se vezme z názvu souboru")
    parser.add_argument(
        "--method",
        choices=["auto", "ratio"],
        default="auto",
        help="auto = guttery (výchozí), ratio = vynutit proporcionální hranice",
    )
    parser.add_argument("--size", type=int, default=1024)
    parser.add_argument("--debug", action="store_true")
    args = parser.parse_args()

    if not args.sheet.is_file():
        print(f"chybí vstup: {args.sheet}", file=sys.stderr)
        return 2

    avatar_id = args.id or "".join(c for c in args.sheet.stem.split("-")[0] if c.isdigit()).zfill(3)
    image = Image.open(args.sheet).convert("RGB")
    bg = background_color(image)
    bounds, method = split_bounds(image, force_ratio=args.method == "ratio")
    names = ["front", "side", "back", "detail"]

    args.out.mkdir(parents=True, exist_ok=True)
    written = []
    for name, (x0, x1) in zip(names, bounds):
        panel = image.crop((x0, 0, x1, image.height))
        panel = trim(panel, bg)
        if name in ("front", "side", "back"):
            panel = square_on_background(panel, bg, args.size)
        target = args.out / f"{avatar_id}-{name}.png"
        panel.save(target)
        written.append({"panel": name, "bounds": [x0, x1], "size": panel.size, "file": target.name})

    meta = {
        "sheet": args.sheet.name,
        "id": avatar_id,
        "background": list(bg),
        "method": method,
        "panels": written,
        "debug": args.debug,
    }
    (args.out / f"{avatar_id}-crop.json").write_text(json.dumps(meta, indent=1, ensure_ascii=False) + "\n")

    print(json.dumps({"id": avatar_id, "method": method, "panels": [w["panel"] for w in written]}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
