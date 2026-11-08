#!/usr/bin/env python3
"""Sestaví přenosný balíček pro generaci avatarů na PC (GTX 1070 Ti).

Balíček obsahuje:
- pipeline skripty z `scripts/ops/avatar-3d/`,
- patchovaný klon TripoSR (jen zdrojový kód `tsr/` + LICENSE, žádné váhy),
- vstupní ZIP listů z `heros/Avatars/` (pokud existuje),
- roster `V31/L4/oasis/data/avatars.json`,
- `PC-README.md` s příkazy pro Windows.

Váhy (TripoSR 1,68 GB, InstantMesh ~4–5 GB) si PC stahuje z Hugging Face
samostatně — balíček zůstává malý a snadno přenositelný.

Použití:
    python3 scripts/ops/avatar-3d/make-pc-bundle.py \
        --out .artifacts/avatar-3d/pc-bundle/avatar3d-pc-bundle.zip \
        [--triposr-src /path/to/triposr-clone]

Výstup: ZIP + souhrn na stdout (velikost, obsah, SHA-256).
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import zipfile
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]

# Výchozí místo lokálního patchovaného klonu TripoSR (viz runbook §2–§3).
DEFAULT_TRIPOSR = os.environ.get(
    "TRIPOSR_SRC",
    "/private/var/folders/_5/_7p3jjw926jbb74rbt7__4h80000gn/T/opencode/triposr-source",
)

SCRIPTS = [
    "generate.py",
    "rig.py",
    "crop-sheet.py",
    "similarity.py",
    "clip_score.py",
    "compare_variants.py",
    "qa.mjs",
]

INPUT_ZIP = "heros/Avatars/ZION_OASIS_3D_PODKLADY_25_DAVKA_01.zip"
ROSTER = "V31/L4/oasis/data/avatars.json"
README = "PC-README.md"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--triposr-src", type=Path, default=Path(DEFAULT_TRIPOSR))
    args = parser.parse_args()

    out = args.out
    out.parent.mkdir(parents=True, exist_ok=True)
    manifest: list[dict] = []
    included = 0

    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as bundle:
        def add(source: Path, arcname: str) -> None:
            nonlocal included
            if not source.is_file():
                print(f"chybí (přeskočeno): {source}")
                return
            bundle.write(source, arcname)
            manifest.append(
                {
                    "file": arcname,
                    "bytes": source.stat().st_size,
                    "sha256": sha256(source),
                }
            )
            included += 1

        for name in SCRIPTS:
            add(REPO / "scripts/ops/avatar-3d" / name, f"scripts/{name}")
        add(REPO / "docs/3.2" / "AVATAR-3D-PIPELINE.md", "docs/AVATAR-3D-PIPELINE.md")
        add(REPO / "PLAN_3D_AVATARI_1070TI.md", "PLAN_3D_AVATARI_1070TI.md")
        add(REPO / INPUT_ZIP, "inputs/" + Path(INPUT_ZIP).name)
        add(REPO / ROSTER, "roster/avatars.json")
        add(REPO / "scripts/ops/avatar-3d" / README, "PC-README.md")

        # Ukázkové oříznuté listy pro P0 smoke (3 postavy, pár MB).
        crops = Path(
            os.environ.get(
                "AVATAR_SHEET_SRC",
                "/private/var/folders/_5/_7p3jjw926jbb74rbt7__4h80000gn/T/opencode/sheet-test",
            )
        )
        if crops.is_dir():
            for path in sorted(crops.glob("*")):
                add(path, f"inputs/sheet-test/{path.name}")
        else:
            print(f"pozor: oříznutý vzorek listů nenalezen ({crops}) — P0 si jich musí připravit vlastní")

        # Patchovaný TripoSR: zdrojový kód jedině. Žádné .git, váhy, cache.
        blocker = {".git", "__pycache__", "weight"}
        if (args.triposr_src / "tsr").is_dir():
            for path in sorted(args.triposr_src.rglob("*")):
                if blocker & set(path.parts):
                    continue
                if not path.is_file() or path.suffix in {".ckpt", ".pth", ".pyc"}:
                    continue
                if path.stat().st_size > 5 << 20:
                    continue
                rel = path.relative_to(args.triposr_src)
                if any(part in {"figures", "examples"} for part in rel.parts):
                    continue
                add(path, f"triposr/{rel}")
        else:
            print(f"pozor: TRIPOSR clone nenalezen ({args.triposr_src}) — doplň ručně")

        list_json = json.dumps(
            {"created_from": str(REPO), "files": manifest},
            ensure_ascii=False,
            indent=1,
        ).encode()
        bundle.writestr("bundle-manifest.json", list_json)
        included += 1

    size = out.stat().st_size
    digest = sha256(out)
    print(f"Sestaveno: {out}")
    print(
        f"Souborů: {included}, velikost {size / 1048576:.1f} MiB, SHA-256 {digest[:16]}…"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
