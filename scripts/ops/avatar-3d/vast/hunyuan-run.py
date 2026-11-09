"""Hunyuan3D-2.1: shape + PBR textura pro 3–4 pilotní listy.

Spouští se na instanci po `hunyuan-setup.sh`:
    python hunyuan-run.py /root/work/inputs/000-front.png ...

Postupně (kvůli 24 GB VRAM): nejdřív shape model (10 GB), pak texturovací
model (21 GB). Mezi fázemi se uvolní paměť. Výstup:
    /root/work/out/<id>-hunyuan.glb
"""

from __future__ import annotations

import gc
import os
import sys
import time

sys.path.insert(0, "/root/Hunyuan3D-2.1/hy3dshape")
sys.path.insert(0, "/root/Hunyuan3D-2.1/hy3dpaint")

from PIL import Image
import torch

WEIGHTS = "/root/weights"
OUT = "/root/work/out"
os.makedirs(OUT, exist_ok=True)


def main() -> int:
    from hy3dshape.pipelines import Hunyuan3DDiTFlowMatchingPipeline

    print("loading shape pipeline", flush=True)
    shape = Hunyuan3DDiTFlowMatchingPipeline.from_pretrained(
        WEIGHTS, subfolder="hunyuan3d-dit-v2-1"
    )

    meshes: dict[str, str] = {}
    for src in sys.argv[1:]:
        avatar = os.path.basename(src).split("-")[0]
        started = time.time()
        mesh = shape(image=src, num_inference_steps=30, guidance_scale=5.0, octree_resolution=256)[0]
        path = os.path.join(OUT, f"{avatar}-shape.glb")
        mesh.export(path)
        meshes[avatar] = path
        print(f"SHAPE {avatar} {time.time() - started:.1f}s {os.path.getsize(path)/1048576:.1f}MB", flush=True)

    del shape
    gc.collect()
    torch.cuda.empty_cache()

    from textureGenPipeline import Hunyuan3DPaintConfig, Hunyuan3DPaintPipeline

    print("loading paint pipeline", flush=True)
    paint = Hunyuan3DPaintPipeline(Hunyuan3DPaintConfig(max_num_view=6, resolution=512))

    for avatar, mesh_path in meshes.items():
        started = time.time()
        textured = paint(mesh_path, image_path=f"/root/work/inputs/{avatar}-front.png")
        target = os.path.join(OUT, f"{avatar}-hunyuan.glb")
        textured.export(target)
        print(
            f"DONE {avatar} {time.time() - started:.1f}s "
            f"{os.path.getsize(target)/1048576:.1f}MB",
            flush=True,
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
