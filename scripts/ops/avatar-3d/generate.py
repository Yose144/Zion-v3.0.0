#!/usr/bin/env python3
"""Dávkové generování 3D avatarů z výtvarných listů (TripoSR na jednom zařízení).

Model se načte **jednou** a v cyklu se pouze počítá, takže inicializace (6–13 s)
se neplatí za každou postavu. Skript je opakovatelný: hotové soubory přeskočí,
chybu jedné postavy zapíše a pokračuje dál.

Předpoklad: klon TripoSR se čtyřmi záplatami z docs/3.2/AVATAR-3D-PIPELINE.md
(cesta v TRIPOSR_SRC). Skript sám nic nepatchuje.

Použití:
    TRIPOSR_SRC=…/triposr-source python3 scripts/ops/avatar-3d/generate.py \
        --input <adresar s <id>-front.png> --out <staging> [--ids 000,001] \
        [--device mps|cuda|cpu] [--mc 192] [--resolution 1024] [--force]

Výstup na postavu: <out>/<id>/<id>.glb, <out>/<id>/<id>-metrics.json
Souhrn: <out>/report.jsonl (jeden řádek na pokus, i neúspěšný).
"""

from __future__ import annotations

import argparse
import json
import os
import struct
import sys
import time
from pathlib import Path

import numpy as np
import rembg
from PIL import Image


def load_pipeline(triposr_src: Path, device: str):
    sys.path.insert(0, str(triposr_src))
    import torch  # noqa: F401  (import až po sys.path, kvůli tsr balíčku)
    from tsr.system import TSR

    model = TSR.from_pretrained(
        os.environ.get("TRIPOSR_MODEL", "stabilityai/TripoSR"),
        config_name="config.yaml",
        weight_name="model.ckpt",
    )
    model.renderer.set_chunk_size(int(os.environ.get("TRIPOSR_CHUNK", "512")))
    model.to(device)
    model.eval()
    return model


def read_image(path: Path, resolution: int) -> Image.Image:
    """Příprava vstupu stejná jako v originálním `run.py`.

    TripoSR očekává **postavu vyplňující ~85 % plátna** na šedém pozadí.
    Kdyby se zmenšovalo celé plátno i s prázdným okolím, model dostane malý
    objekt a výsledkem je nafouklý blob (naměřeno: hloubka ≈ výška).
    """
    from tsr.utils import remove_background, resize_foreground

    session = rembg.new_session("u2net")
    image = remove_background(Image.open(path), session)
    image = resize_foreground(image, 0.85)
    array = np.array(image).astype(np.float32) / 255.0
    array = array[:, :, :3] * array[:, :, 3:4] + (1 - array[:, :, 3:4]) * 0.5
    return Image.fromarray((array * 255.0).astype(np.uint8))


def fix_glb_material(path: Path) -> None:
    """baseColorFactor 0.4 → 1.0 a metallicFactor 0 (jinak je model tmavý/černý)."""
    raw = path.read_bytes()
    magic, version, _ = struct.unpack_from("<III", raw, 0)
    json_len, json_type = struct.unpack_from("<II", raw, 12)
    doc = json.loads(raw[20 : 20 + json_len])
    tail = raw[20 + json_len :]
    for material in doc.get("materials", []):
        pbr = material.setdefault("pbrMetallicRoughness", {})
        pbr["baseColorFactor"] = [1.0, 1.0, 1.0, 1.0]
        pbr["metallicFactor"] = 0.0
        pbr.setdefault("roughnessFactor", 0.9)
    payload = json.dumps(doc, separators=(",", ":")).encode()
    payload += b" " * ((4 - len(payload) % 4) % 4)
    header = struct.pack("<III", magic, version, 12 + 8 + len(payload) + len(tail))
    path.write_bytes(header + struct.pack("<II", len(payload), json_type) + payload + tail)


def metrics_of(path: Path) -> dict:
    import trimesh

    scene = trimesh.load(str(path), force="scene")
    tris = 0
    has_uv = False
    for geometry in scene.geometry.values():
        tris += len(geometry.faces)
        visual = getattr(geometry, "visual", None)
        has_uv = has_uv or bool(getattr(visual, "uv", None) is not None)
    return {
        "tris": int(tris),
        "bytes": path.stat().st_size,
        "extents": [round(float(v), 4) for v in scene.extents],
        "has_uv": has_uv,
    }


def collect_ids(input_dir: Path, only: list[str] | None) -> list[tuple[str, Path]]:
    found: list[tuple[str, Path]] = []
    for path in sorted(input_dir.glob("*-front.png")):
        avatar_id = path.name.split("-")[0]
        if only and avatar_id not in only:
            continue
        found.append((avatar_id, path))
    return found


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--ids", default=None, help="čárkami oddělený seznam, např. 000,003")
    parser.add_argument("--device", default=os.environ.get("TRIPOSR_DEVICE", "mps"))
    parser.add_argument("--mc", type=int, default=192, help="rozlišení marching cubes")
    parser.add_argument("--resolution", type=int, default=1024, help="rozlišení textury")
    parser.add_argument(
        "--max-tris",
        type=int,
        default=0,
        help="cíl pro decimaci před zapékáním textury (0 = bez decimace)",
    )
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    triposr_src = Path(os.environ.get("TRIPOSR_SRC", "")).expanduser()
    if not (triposr_src / "tsr").is_dir():
        print("TRIPOSR_SRC neukazuje na klon TripoSR s balíčkem tsr/", file=sys.stderr)
        return 2

    only = [x.strip() for x in args.ids.split(",")] if args.ids else None
    todo = collect_ids(args.input, only)
    if not todo:
        print("nenalezen žádný vstup *-front.png", file=sys.stderr)
        return 2

    args.out.mkdir(parents=True, exist_ok=True)
    report_path = args.out / "report.jsonl"
    print(json.dumps({"queued": len(todo), "device": args.device, "mc": args.mc}))

    import torch
    import trimesh

    model = load_pipeline(triposr_src, args.device)
    from tsr.bake_texture import bake_texture

    for avatar_id, image_path in todo:
        target = args.out / avatar_id / f"{avatar_id}.glb"
        started = time.time()
        record: dict = {"id": avatar_id, "input": image_path.name}
        if target.is_file() and not args.force:
            record.update(status="skipped")
            with report_path.open("a") as handle:
                handle.write(json.dumps(record) + "\n")
            print(json.dumps(record))
            continue

        try:
            (args.out / avatar_id).mkdir(parents=True, exist_ok=True)
            image = read_image(image_path, args.resolution)

            t0 = time.time()
            with torch.no_grad():
                scene_codes = model([image], device=args.device)
            t_infer = time.time() - t0

            t0 = time.time()
            meshes = model.extract_mesh(scene_codes, False, resolution=args.mc)
            t_mesh = time.time() - t0

            # Decimace PŘED zapékáním: textura se pak počítá na finální síti,
            # takže UV i barvy zůstanou správně (decimovat až hotový GLB by UV rozbilo).
            source_mesh = meshes[0]
            if args.max_tris and len(source_mesh.faces) > args.max_tris:
                import fast_simplification

                reduction = 1 - (args.max_tris / len(source_mesh.faces))
                vertices, faces = fast_simplification.simplify(
                    source_mesh.vertices.astype(np.float32),
                    source_mesh.faces.astype(np.int32),
                    target_reduction=float(min(0.95, max(0.0, reduction))),
                )
                source_mesh = trimesh.Trimesh(vertices=vertices, faces=faces, process=False)

            t0 = time.time()
            baked = bake_texture(source_mesh, model, scene_codes[0], args.resolution)
            t_bake = time.time() - t0

            mesh = trimesh.Trimesh(
                vertices=source_mesh.vertices[baked["vmapping"]],
                faces=baked["indices"],
                vertex_normals=source_mesh.vertex_normals[baked["vmapping"]],
                process=False,
            )
            mesh.visual = trimesh.visual.TextureVisuals(
                uv=baked["uvs"],
                image=Image.fromarray((baked["colors"] * 255.0).astype(np.uint8)).transpose(Image.FLIP_TOP_BOTTOM),
            )
            # Model je Z-up, glTF je Y-up.
            mesh.apply_transform(trimesh.transformations.rotation_matrix(-np.pi / 2, [1.0, 0.0, 0.0]))
            mesh.export(str(target))
            fix_glb_material(target)

            stats = metrics_of(target)
            record.update(
                status="ok",
                seconds=round(time.time() - started, 1),
                infer_s=round(t_infer, 1),
                mesh_s=round(t_mesh, 1),
                bake_s=round(t_bake, 1),
                **stats,
            )
            (args.out / avatar_id / f"{avatar_id}-metrics.json").write_text(
                json.dumps(record, indent=1) + "\n"
            )
        except Exception as error:  # noqa: BLE001 - dávka musí pokračovat
            record.update(status="failed", error=f"{type(error).__name__}: {error}")
        finally:
            with report_path.open("a") as handle:
                handle.write(json.dumps(record) + "\n")
            print(json.dumps(record))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
