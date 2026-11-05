#!/usr/bin/env python3
"""
LOD lucerny pro hru Lumi.

Model z Království srdce (`Lampion_Kralovstvi_srdce_v6.glb`) má 242 648
trojúhelníků — víc než celá scéna MOBY. Na obrazovce je přitom jen ~100 px
vysoký, takže drtivá většina geometrie je neviditelná a jen stojí výkon.

Skript ho zjednoduší (`fast_simplification` — quadrická dekurace) a spojí
osm dílů do jednoho meshe:
  - méně trojúhelníků (cíl ~20 000, tj. 12×),
  - jeden draw call místo osmi,
  - materiál se zahazuje (hra si stejně nastavuje vlastní zlatý emissive).

Zdroj zůstává v `heros/`; zapisuje se jen herní kopie
`apps/nirvana/public/models/lampion.glb`.

Použití:
    python3 scripts/ops/lumi-lantern-lod.py            # cíl 20 000
    python3 scripts/ops/lumi-lantern-lod.py --target 12000
"""

from __future__ import annotations

import argparse
import pathlib
import sys

import numpy as np
import trimesh
from fast_simplification import simplify


def sanitize(mesh: trimesh.Trimesh) -> trimesh.Trimesh:
    """Zahodí plochy odkazující mimo pole vrcholů a přečísluje.

    Zdrojový GLB má primitivy, kde indexy nesedí s počtem vrcholů (trimesh
    ho načte s `process=False` a `concatenate` pak vyrobí neplatné indexy).
    Bez tohohle kroku clustering padá na `IndexError`.
    """
    vertices = np.asarray(mesh.vertices, dtype=np.float64)
    faces = np.asarray(mesh.faces, dtype=np.int64)
    if len(faces) == 0:
        return mesh
    valid = (faces < len(vertices)).all(axis=1) & (faces >= 0).all(axis=1)
    faces = faces[valid]
    if len(faces) == 0:
        return trimesh.Trimesh(vertices=vertices[:0], faces=np.zeros((0, 3), dtype=np.int64), process=False)
    used = np.unique(faces)
    remap = np.full(len(vertices), -1, dtype=np.int64)
    remap[used] = np.arange(len(used))
    return trimesh.Trimesh(vertices=vertices[used], faces=remap[faces], process=False)


def cluster_simplify(mesh: trimesh.Trimesh, target_faces: int, max_rounds: int = 12) -> trimesh.Trimesh:
    """Vertex clustering: kvantizace na mřížku a slití vrcholů.

    Quadrická dekurace (`fast_simplification`) na tomhle modelu skončila na
    65 % — jsou to tenké ozdobné panely, kde každá hrana něco drží. Mřížka
    je pro takový tvar robustní a hlavně **říditelná**: hledá se velikost
    buňky, dokud se počet trojúhelníků netrefí do cíle.
    """
    # Pojistka: po `concatenate` se může stát, že indexy odkazují mimo pole
    # (díly byly skládané s `process=False`). Nejdřív zahodit neplatné plochy,
    # jinak clustering spadne na IndexError.
    vertices = np.asarray(mesh.vertices, dtype=np.float64)
    faces = np.asarray(mesh.faces, dtype=np.int64)
    valid = (faces < len(vertices)).all(axis=1) & (faces >= 0).all(axis=1)
    faces = faces[valid]
    used = np.unique(faces)
    remap = np.full(len(vertices), -1, dtype=np.int64)
    remap[used] = np.arange(len(used))
    vertices = vertices[used]
    faces = remap[faces]
    size = np.ptp(vertices, axis=0)
    diagonal = float(np.linalg.norm(size)) or 1.0

    def cluster_with(cell: float) -> trimesh.Trimesh:
        keys = np.round(vertices / cell).astype(np.int64)
        _, inverse, counts = np.unique(keys, axis=0, return_inverse=True, return_counts=True)
        # nový vrchol = průměr clusteru (ne střed mřížky) — líp sedí na tvar
        summed = np.zeros((len(counts), 3), dtype=np.float64)
        np.add.at(summed, inverse, vertices)
        merged_vertices = summed / counts[:, None]

        merged_faces = inverse[faces]
        # zahoď trojúhelníky, které se slitím zdegenerovaly
        keep = (
            (merged_faces[:, 0] != merged_faces[:, 1])
            & (merged_faces[:, 1] != merged_faces[:, 2])
            & (merged_faces[:, 0] != merged_faces[:, 2])
        )
        merged_faces = merged_faces[keep]
        # a duplicity (dvě plochy na stejných vrcholech)
        order = np.sort(merged_faces, axis=1)
        _, unique_index = np.unique(order, axis=0, return_index=True)
        merged_faces = merged_faces[np.sort(unique_index)]
        return trimesh.Trimesh(vertices=merged_vertices, faces=merged_faces, process=False)

    # Mřížku zkoušíme od jemné k hrubé a bereme **největší** kandidát, který
    # se do cíle vejde. Binární půlení dřív přestřelilo (cíl 20k → 3k), protože
    # se zastavilo na prvním kandidátovi pod cílem.
    best: trimesh.Trimesh | None = None
    steps = 14
    for step in range(steps + 1):
        cell = diagonal / (2000 * (0.72 ** step))
        candidate = cluster_with(cell)
        # POZOR: nesmí se to jmenovat `faces` — přepsalo by to vnější pole,
        # které čte closure `cluster_with` (a spadlo to na IndexError).
        count = len(candidate.faces)
        if 0 < count <= target_faces:
            if best is None or count > len(best.faces):
                best = candidate
            break
    return best if best is not None else cluster_with(diagonal / 40)

ROOT = pathlib.Path(__file__).resolve().parents[2]
SOURCE = ROOT / "heros/shop/Lumi/Lampion_Kralovstvi_srdce_3D_v6/Lampion_Kralovstvi_srdce_v6.glb"
TARGET = ROOT / "apps/nirvana/public/models/lampion.glb"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--target", type=int, default=20_000, help="cílový počet trojúhelníků")
    parser.add_argument("--source", type=pathlib.Path, default=SOURCE)
    parser.add_argument("--out", type=pathlib.Path, default=TARGET)
    args = parser.parse_args()

    if not args.source.exists():
        print(f"chybí zdroj: {args.source}", file=sys.stderr)
        return 1

    scene = trimesh.load(args.source)
    if not isinstance(scene, trimesh.Scene):
        print("zdroj není scéna", file=sys.stderr)
        return 1

    parts = [g for g in scene.geometry.values() if len(g.faces) > 0]
    total_faces = sum(len(g.faces) for g in parts)
    print(f"zdroj: {len(parts)} dílů, {total_faces} trojúhelníků")

    # Rovnou clustering: quadrická dekurace na tenkých vyřezávaných panelech
    # končila na 65 % a vracela nekonzistentní indexy (fast_simplification
    # + concatenate). Mřížka je předvídatelná a cíl trefí.
    parts = [sanitize(part) for part in parts]
    parts = [part for part in parts if len(part.faces) > 0]
    merged = trimesh.util.concatenate(parts)
    if len(merged.faces) > args.target * 1.15:
        merged = cluster_simplify(merged, args.target)
    # `process=True` při concatenate by mohl mazat detaily; uklidíme jen to,
    # co by rozbilo render (degenerované a duplicitní trojúhelníky).
    merged.update_faces(merged.nondegenerate_faces())
    merged.update_faces(merged.unique_faces())
    merged.remove_unreferenced_vertices()
    merged.fix_normals()

    # Materiál: hra si nastavuje vlastní, ale kdyby se model otevřel jinde,
    # ať není růžový default.
    merged.visual = trimesh.visual.TextureVisuals()
    merged.visual.material = trimesh.visual.material.PBRMaterial(
        name="lampion",
        baseColorFactor=[0.85, 0.72, 0.42, 1.0],
        metallicFactor=0.65,
        roughnessFactor=0.45,
        emissiveFactor=[1.0, 0.85, 0.54],
    )

    out = args.out
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(trimesh.Scene({"lampion": merged}).export(file_type="glb"))

    size_mb = out.stat().st_size / 1e6
    print(f"výsledek: {len(merged.faces)} trojúhelníků, {len(merged.vertices)} vrcholů, {size_mb:.2f} MB")
    print(f"redukce: {total_faces} → {len(merged.faces)} ({100 * (1 - len(merged.faces) / total_faces):.1f} %)")
    print(f"zapsáno: {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
