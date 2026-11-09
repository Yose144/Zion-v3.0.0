"""Hunyuan3D-2.1 — druhá fáze: textura hotových shape GLB.

`Hunyuan3DPaintPipeline(...)` vrací podle verze buď mesh, nebo cestu; skript
proto sbírá soubory, které pipeline zapíše (`textured_mesh.glb`), a ukládá je
pod jménem `<id>-hunyuan.glb`. Shape fáze se neopakuje.

Použití (na instanci):
    cd /root/Hunyuan3D-2.1 && python /root/hunyuan-paint.py 000 003 038 051
"""

from __future__ import annotations

import glob
import os
import shutil
import sys
import time

sys.path.insert(0, "/root/Hunyuan3D-2.1/hy3dshape")
sys.path.insert(0, "/root/Hunyuan3D-2.1/hy3dpaint")

from textureGenPipeline import Hunyuan3DPaintConfig, Hunyuan3DPaintPipeline

OUT = "/root/work/out"
INPUTS = "/root/work/inputs"


def newest(pattern: str) -> str | None:
    files = sorted(glob.glob(pattern), key=os.path.getmtime)
    return files[-1] if files else None


def main() -> int:
    paint = Hunyuan3DPaintPipeline(Hunyuan3DPaintConfig(max_num_view=6, resolution=512))
    for avatar in sys.argv[1:]:
        mesh_path = os.path.join(OUT, f"{avatar}-shape.glb")
        image_path = os.path.join(INPUTS, f"{avatar}-front.png")
        if not (os.path.exists(mesh_path) and os.path.exists(image_path)):
            print(f"SKIP {avatar}", flush=True)
            continue
        started = time.time()
        result = paint(mesh_path, image_path=image_path)
        target = os.path.join(OUT, f"{avatar}-hunyuan.glb")
        produced = newest(os.path.join(OUT, "textured_mesh.glb")) or newest(
            os.path.join(OUT, "textured_mesh.obj")
        )
        if produced:
            shutil.copyfile(produced, target)
            print(
                f"HUNYUAN {avatar} {time.time() - started:.1f}s "
                f"{os.path.getsize(target) / 1048576:.1f}MB",
                flush=True,
            )
        else:
            print(f"MISS {avatar} result={type(result).__name__}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
