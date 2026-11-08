#!/usr/bin/env python3
"""Převede GLB z generátoru na herní verzi pro Nirvanu — bez re-encodingu.

Co dělá (vše jako úprava JSON chunku GLB, textura zůstává beze změny):
1. srovná model do metrů: výška 1,75 m, chodidla na y = 0, střed v X/Z,
2. otočí ho čelem ke kameře (výchozí 180°),
3. vypne kov (metallicFactor = 0) — Nirvana nemá environment mapu a kov bez ní
   zčerná; baseColor textura zůstává.

Proč ne trimesh export: ten přebalí texturu (u TRELLIS.2 4,8 MB → 12 MB).

Použití:
    python3 scripts/ops/avatar-3d/game-ready.py --input in.glb --output out.glb \
        [--height 1.75] [--rotate 180]
"""

from __future__ import annotations

import argparse
import json
import math
import struct
from pathlib import Path

import numpy as np
import trimesh


def read_glb(path: Path) -> tuple[dict, bytes, tuple[int, int]]:
    raw = path.read_bytes()
    magic, version, _ = struct.unpack_from("<III", raw, 0)
    json_len, json_type = struct.unpack_from("<II", raw, 12)
    doc = json.loads(raw[20 : 20 + json_len])
    return doc, raw[20 + json_len :], (magic, version)


def write_glb(path: Path, doc: dict, tail: bytes, header: tuple[int, int]) -> None:
    magic, version = header
    payload = json.dumps(doc, separators=(",", ":")).encode()
    payload += b" " * ((4 - len(payload) % 4) % 4)
    raw = struct.pack("<III", magic, version, 12 + 8 + len(payload) + len(tail))
    path.write_bytes(raw + struct.pack("<II", len(payload), 0x4E4F534A) + payload + tail)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--height", type=float, default=1.75)
    parser.add_argument("--rotate", type=float, default=180.0)
    args = parser.parse_args()

    scene = trimesh.load(str(args.input), force="scene")
    bounds = np.asarray(scene.bounds, dtype=float)
    size = bounds[1] - bounds[0]
    if size[1] <= 0:
        raise SystemExit("model nemá výšku")

    scale = args.height / float(size[1])
    angle = math.radians(args.rotate)
    cos, sin = math.cos(angle), math.sin(angle)

    # R_y(θ) · S(s): x' = s·(cos·x + sin·z); z' = s·(−sin·x + cos·z); y' = s·y
    # Translace srovná střed X/Z a chodidla na 0.
    center_x = (bounds[0][0] + bounds[1][0]) / 2.0
    center_z = (bounds[0][2] + bounds[1][2]) / 2.0
    tx = -scale * (cos * center_x + sin * center_z)
    tz = -scale * (-sin * center_x + cos * center_z)
    ty = -scale * bounds[0][1]

    matrix = [
        scale * cos, 0.0, -scale * sin, 0.0,
        0.0, scale, 0.0, 0.0,
        scale * sin, 0.0, scale * cos, 0.0,
        tx, ty, tz, 1.0,
    ]

    doc, tail, header = read_glb(args.input)
    roots = doc.get("scenes", [{}])[0].get("nodes", [])
    if not roots:
        raise SystemExit("GLB nemá kořenové uzly")

    nodes = doc.setdefault("nodes", [])
    nodes.append({"name": "GameReady", "matrix": matrix, "children": list(roots)})
    doc.setdefault("scenes", [{}])[0]["nodes"] = [len(nodes) - 1]

    for material in doc.get("materials", []):
        pbr = material.setdefault("pbrMetallicRoughness", {})
        pbr["baseColorFactor"] = [1.0, 1.0, 1.0, 1.0]
        pbr["metallicFactor"] = 0.0
        pbr.setdefault("roughnessFactor", 0.85)

    write_glb(args.output, doc, tail, header)
    print(
        json.dumps(
            {
                "output": str(args.output),
                "bytes": args.output.stat().st_size,
                "scale": round(scale, 4),
                "rotate_deg": args.rotate,
            }
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
