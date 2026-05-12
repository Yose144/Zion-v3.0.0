#!/usr/bin/env python3
"""
Merge v1-era and v2 SFT shards into one canonical Hiranyagarbha v2.1 JSONL corpus.

Dedupes conversations by fingerprints of non-system turns (later shards win).

Default inputs live under `HiranV2.1/data/shards/` (repo root-relative).
"""

from __future__ import annotations

import argparse
import json
import re
from collections import OrderedDict
from pathlib import Path

# Canonical merge order — older domain first; v2 synthesized corpus; optional supplemental shards last so they win overlaps.
DEFAULT_SHARD_NAMES = (
    "zion_train.jsonl",
    "zion_train_seed_books_refresh.jsonl",
    "zion_train_full_books_refresh.jsonl",
    "zion_train_backup_20260330.jsonl",
    "zion_train_hiran_v2.jsonl",
    # Optional — place JSONL files in HiranV2.1/data/shards/ (gitignored):
    #   zion_train_oer_sciences.jsonl   — curated OER STEM/social excerpts + synthetic Q&A
    #   zion_train_vedic_guided.jsonl     — short guided Q&A referencing Vedabase/BBT (see PLAN_v2.1.md legal note)
    #   zion_train_buddhism_guided.jsonl   — classical + Tibetan Buddhism guided Q&A (heavy lifting still RAG; see PLAN_v2.1.md)
    "zion_train_oer_sciences.jsonl",
    "zion_train_vedic_guided.jsonl",
    "zion_train_buddhism_guided.jsonl",
)


# Single-line legacy pointer files in HiranV2.1/data/ pointed at shards/ — resolve when present.
POINTER_LINE_RE = re.compile(r"^shards/[\w._-]+\.jsonl\s*$")


def resolve_shard_path(shard_dir: Path, name: str) -> Path | None:
    """
    Return a path to read for this shard name.

    Tries `data/shards/<name>` first, then `data/<name>` (some checkouts used pointer stubs there).
    """
    direct = shard_dir / name
    if direct.is_file():
        try:
            sz = direct.stat().st_size
        except OSError:
            return None
        if sz < 512:
            txt = direct.read_text(encoding="utf-8").strip()
            if "\n" not in txt and POINTER_LINE_RE.fullmatch(txt):
                target = shard_dir / Path(txt).name
                return target if target.is_file() else None
        return direct

    legacy = shard_dir.parent / name
    if legacy.is_file():
        try:
            sz = legacy.stat().st_size
        except OSError:
            return None
        if sz < 512:
            txt = legacy.read_text(encoding="utf-8").strip()
            if "\n" not in txt and POINTER_LINE_RE.fullmatch(txt):
                target = shard_dir / Path(txt).name
                return target if target.is_file() else None
        return legacy
    return None


def fingerprint(obj: dict) -> str:
    msgs = obj.get("messages") or []
    body = [(m.get("role", ""), m.get("content", "")) for m in msgs if m.get("role") != "system"]
    return json.dumps(body, ensure_ascii=False)


def load_lines(path: Path) -> list[dict]:
    out: list[dict] = []
    with path.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                out.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return out


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument(
        "--shard-dir",
        default="HiranV2.1/data/shards",
        help="Directory holding JSONL shards (relative to project root)",
    )
    p.add_argument(
        "--names",
        nargs="*",
        default=list(DEFAULT_SHARD_NAMES),
        help="Shard filenames in merge order",
    )
    p.add_argument(
        "--output",
        default="HiranV2.1/data/hiran_curriculum_v2.1.jsonl",
        help="Merged JSONL path (relative to project root)",
    )
    args = p.parse_args()

    project = Path(".").resolve()
    shard_dir = (project / args.shard_dir).resolve()
    outp = project / args.output
    outp.parent.mkdir(parents=True, exist_ok=True)

    merged: OrderedDict[str, dict] = OrderedDict()
    counts: OrderedDict[str, int] = OrderedDict()

    for name in args.names:
        shard_path = resolve_shard_path(shard_dir, name)
        if shard_path is None:
            continue
        n = 0
        for obj in load_lines(shard_path):
            fp = fingerprint(obj)
            if fp in merged:
                del merged[fp]
            merged[fp] = obj
            n += 1
        try:
            src = str(shard_path.relative_to(project))
        except ValueError:
            src = str(shard_path)
        counts[src] = n

    with outp.open("w", encoding="utf-8") as f:
        for obj in merged.values():
            f.write(json.dumps(obj, ensure_ascii=False) + "\n")

    try:
        rel_out = str(outp.relative_to(project))
    except ValueError:
        rel_out = str(outp)
    print(f"Wrote {len(merged)} conversations -> {rel_out}")
    for name in args.names:
        p = resolve_shard_path(shard_dir, name)
        if p is None:
            print(f"  skipped (missing)       {name}")
        else:
            try:
                key = str(p.relative_to(project))
            except ValueError:
                key = str(p)
            loaded = counts.get(key, 0)
            print(f"  scanned {loaded:>5} lines  {name}  [{key}]")


if __name__ == "__main__":
    main()
