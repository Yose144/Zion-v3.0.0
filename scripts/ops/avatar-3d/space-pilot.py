"""Pilot TRELLIS.2 přes oficiální Hugging Face Space (zdarma, ZeroGPU).

Proč Space a ne vlastní GPU: TRELLIS.2 potřebuje gated DINOv3 váhy, na které
nemáme HF token; Space je má načtené a vystavuje i export GLB s volbou
decimace a velikosti textury. Výsledky jsou proto srovnatelné s naší M1
pipeline (stejné decimaci parametry jako herní LOD).

Použití:
    uvx --from gradio_client python .artifacts/avatar-3d/vast/space-pilot.py \
        .artifacts/avatar-3d/batch-01/inputs/000-front.png [...]

Výstup: .artifacts/avatar-3d/trellis2/<id>-game.glb (30k tris, 2048²)
        a <id>-master.glb (150k tris, 4096²)
"""

from __future__ import annotations

import os
import shutil
import sys
import time
from pathlib import Path

from gradio_client import Client, handle_file

ROOT = Path(".artifacts/avatar-3d/trellis2")
ROOT.mkdir(parents=True, exist_ok=True)

SPACE = "microsoft/TRELLIS.2"
RESOLUTION = "1024"


def path_of(value) -> str | None:
    if isinstance(value, str) and os.path.exists(value):
        return value
    if isinstance(value, dict):
        candidate = value.get("path") or value.get("name")
        if candidate and os.path.exists(candidate):
            return candidate
    return None


def main() -> int:
    client = Client(SPACE, verbose=False)
    try:
        client.predict(api_name="/start_session")
    except Exception as error:  # noqa: BLE001 - start_session je jen zahřátí
        print("start_session:", str(error)[:200], flush=True)

    for source in sys.argv[1:]:
        avatar = os.path.basename(source).split("-")[0]
        started = time.time()
        print(f"== {avatar} ==", flush=True)

        prompt = client.predict(handle_file(source), api_name="/preprocess_image")
        print(f"preprocess  {time.time() - started:5.1f}s", flush=True)

        client.predict(
            prompt,
            0,
            RESOLUTION,
            7.5,
            0.7,
            12,
            5.0,
            7.5,
            0.5,
            12,
            3.0,
            1.0,
            0.0,
            12,
            3.0,
            api_name="/image_to_3d",
        )
        print(f"image_to_3d {time.time() - started:5.1f}s", flush=True)

        for label, tris, texture in (("game", 30000, 2048), ("master", 150000, 4096)):
            result = client.predict(tris, texture, api_name="/extract_glb")
            candidates = result if isinstance(result, (list, tuple)) else [result]
            saved = None
            for candidate in candidates:
                local = path_of(candidate)
                if not local:
                    continue
                target = ROOT / f"{avatar}-{label}.glb"
                shutil.copyfile(local, target)
                saved = target
                break
            if saved:
                print(
                    f"{label:<6} {time.time() - started:5.1f}s "
                    f"{saved.name} {saved.stat().st_size / 1048576:.1f} MB",
                    flush=True,
                )
            else:
                print(f"{label}: GLB se nepodařilo získat ({result})", flush=True)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
