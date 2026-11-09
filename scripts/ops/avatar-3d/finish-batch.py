#!/usr/bin/env python3
"""Dokončí dávku avatarů: herní kopie, QA mosaiky, CLIP skóre, manifest.

Navazuje na `generate.py` + `rig.py` (ty jen vyrobí GLB). Skript:
1. sestaví `stage-game/<id>/<id>.glb` (rigged, pokud existuje; jinak raw),
2. vyrenderuje kontrolní listy po skupinách přes `qa.mjs`,
3. spočítá CLIP proti předlohám (`clip_score.py`),
4. zapíše `manifest.json` (id, jméno, soubory, tris, CLIP, stav) a vypíše souhrn.

Použití:
    <venv>/bin/python scripts/ops/avatar-3d/finish-batch.py \
        --root .artifacts/avatar-3d batch-01 batch-02 batch-03
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import socket
import subprocess
import sys
import time
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
ROSTER = REPO / "V31/L4/oasis/data/avatars.json"


def static_server_up(port: int = 8769) -> bool:
    with socket.socket() as sock:
        sock.settimeout(0.3)
        return sock.connect_ex(("127.0.0.1", port)) == 0


def ensure_static(port: int = 8769) -> None:
    if static_server_up(port):
        return
    subprocess.Popen(
        [sys.executable, "-m", "http.server", str(port), "--bind", "127.0.0.1"],
        cwd=str(REPO),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        start_new_session=True,
    )
    for _ in range(30):
        time.sleep(0.2)
        if static_server_up(port):
            return
    raise SystemExit("statický server na :8769 se nepodařilo spustit")


def chunks(items: list[str], size: int) -> list[list[str]]:
    return [items[i : i + size] for i in range(0, len(items), size)]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(".artifacts/avatar-3d"))
    parser.add_argument("batches", nargs="+")
    parser.add_argument("--chunk", type=int, default=9)
    args = parser.parse_args()

    roster = {
        str(a["id"]).zfill(3): a.get("name", "?")
        for a in json.loads(ROSTER.read_text())["avatars"]
    }
    ensure_static()

    for batch in args.batches:
        directory = args.root / batch
        stage = directory / "stage"
        if not stage.is_dir():
            print(f"{batch}: chybí {stage}, přeskakuji")
            continue

        game = directory / "stage-game"
        if game.exists():
            shutil.rmtree(game)
        game.mkdir(parents=True)

        ids = sorted(
            p.name for p in stage.iterdir() if p.is_dir() and p.name.isdigit()
        )
        for avatar in ids:
            rigged = stage / avatar / f"{avatar}-rigged.glb"
            raw = stage / avatar / f"{avatar}.glb"
            source = rigged if rigged.is_file() else raw
            if not source.is_file():
                continue
            target = game / avatar
            target.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, target / f"{avatar}.glb")

        qa_dirs: list[Path] = []
        for index, group in enumerate(chunks(sorted(ids), args.chunk), start=1):
            out = directory / f"qa-{index}"
            if out.exists():
                shutil.rmtree(out)
            subprocess.run(
                [
                    "node",
                    str(REPO / "scripts/ops/avatar-3d/qa.mjs"),
                    "--ids",
                    ",".join(group),
                    "--model-dir",
                    str(game.relative_to(REPO)),
                    "--out",
                    str(out.relative_to(REPO)),
                ],
                cwd=str(REPO),
                check=False,
                stdout=subprocess.DEVNULL,
            )
            png = next(iter(sorted(out.glob("*.png"))), None)
            if png:
                shutil.move(str(png), str(out / f"qa-{index}.png"))
                meta = next(iter(sorted(out.glob("*.json"))), None)
                if meta:
                    shutil.move(str(meta), str(out / f"qa-{index}.json"))
                qa_dirs.append(out)

        scores: dict[str, float | None] = {avatar: None for avatar in ids}
        for out in qa_dirs:
            png = out / f"{out.name}.png"
            if not png.is_file():
                continue
            result = subprocess.run(
                [
                    sys.executable,
                    str(REPO / "scripts/ops/avatar-3d/clip_score.py"),
                    "--qa",
                    str(png),
                    "--refs",
                    str(directory / "inputs"),
                    "--out",
                    str(out / "clip.json"),
                ],
                cwd=str(REPO),
                capture_output=True,
                text=True,
            )
            clip = out / "clip.json"
            if clip.is_file():
                for row in json.loads(clip.read_text())["rows"]:
                    scores[row["id"]] = row.get("score")
            else:
                print(f"{out.name}: CLIP selhal — {result.stderr[-200:]}")

        records = []
        for avatar in ids:
            rigged = stage / avatar / f"{avatar}-rigged.glb"
            raw = stage / avatar / f"{avatar}.glb"
            source = rigged if rigged.is_file() else raw
            tris = None
            if source.is_file():
                try:
                    import trimesh

                    scene = trimesh.load(str(source), force="scene")
                    tris = int(sum(len(g.faces) for g in scene.geometry.values()))
                except Exception:  # noqa: BLE001 - metriky nesmí shodit dávku
                    tris = None
            records.append(
                {
                    "id": avatar,
                    "name": roster.get(avatar, "?"),
                    "model": str(source.relative_to(REPO)) if source.is_file() else None,
                    "rigged": rigged.is_file(),
                    "tris": tris,
                    "bytes": source.stat().st_size if source.is_file() else None,
                    "clip": scores.get(avatar),
                    "status": "k_revizi",
                }
            )

        scored = [r["clip"] for r in records if r["clip"] is not None]
        manifest = {
            "batch": batch,
            "createdAt": time.strftime("%Y-%m-%dT%H:%M:%S"),
            "count": len(records),
            "clipMean": round(sum(scored) / len(scored), 4) if scored else None,
            "avatars": records,
        }
        (directory / "manifest.json").write_text(
            json.dumps(manifest, ensure_ascii=False, indent=1) + "\n"
        )
        print(
            f"{batch}: {len(records)} modelů, CLIP průměr "
            f"{manifest['clipMean']}, manifest {directory / 'manifest.json'}"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
