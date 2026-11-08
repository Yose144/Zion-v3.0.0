"""TRELLIS.2: dávka z frontálních listů → GLB pro srovnání s M1 modelem.

Spouští se v conda env `trellis2` na pronajaté instanci:
    python trellis-run.py /root/work/inputs/000-front.png ...

Pro každý vstup exportuje dvě varianty:
  <id>-game.glb   decimace 30k tris, textura 2048  (herní LOD, srovnatelné s M1)
  <id>-master.glb decimace 150k tris, textura 4096 (kvalitativní strop)
"""

from __future__ import annotations

import os
import sys
import time

os.environ["OPENCV_IO_ENABLE_OPENEXR"] = "1"
os.environ["PYTORCH_CUDA_ALLOC_CONF"] = "expandable_segments:True"

from PIL import Image
import torch
from trellis2.pipelines import Trellis2ImageTo3DPipeline
import o_voxel

WEIGHTS = "/root/weights"
OUT = "/root/work/out"


def export(mesh, path: str, tris: int, texture: int) -> None:
    glb = o_voxel.postprocess.to_glb(
        vertices=mesh.vertices,
        faces=mesh.faces,
        attr_volume=mesh.attrs,
        coords=mesh.coords,
        attr_layout=mesh.layout,
        voxel_size=mesh.voxel_size,
        aabb=[[-0.5, -0.5, -0.5], [0.5, 0.5, 0.5]],
        decimation_target=tris,
        texture_size=texture,
        remesh=True,
        remesh_band=1,
        remesh_project=0,
        verbose=False,
    )
    glb.export(path, extension_webp=True)


def main() -> int:
    os.makedirs(OUT, exist_ok=True)
    pipeline = Trellis2ImageTo3DPipeline.from_pretrained(WEIGHTS)
    pipeline.cuda()

    for src in sys.argv[1:]:
        avatar_id = os.path.basename(src).split("-")[0]
        image = Image.open(src).convert("RGB")
        started = time.time()
        mesh = pipeline.run(image)[0]
        infer = time.time() - started
        print(f"INFER {avatar_id} {infer:.1f}s", flush=True)

        game = os.path.join(OUT, f"{avatar_id}-game.glb")
        export(mesh, game, tris=30000, texture=2048)
        master = os.path.join(OUT, f"{avatar_id}-master.glb")
        export(mesh, master, tris=150000, texture=4096)
        print(
            f"DONE {avatar_id} infer={infer:.1f}s "
            f"game={os.path.getsize(game) / 1048576:.1f}MB "
            f"master={os.path.getsize(master) / 1048576:.1f}MB",
            flush=True,
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
