#!/usr/bin/env python3
"""Zapíše MANIFEST.json s SHA-256 a velikostí každého .md v zadaných RAG výstupech (idempotence / audit)."""

from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1 << 16), b""):
            h.update(block)
    return h.hexdigest()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--roots",
        nargs="+",
        default=[
            "HiranV2.1/data/rag/buddhism-classical/generated",
            "HiranV2.1/data/rag/buddhism-tibetan/generated",
        ],
    )
    ap.add_argument(
        "--output",
        type=Path,
        default=Path("HiranV2.1/data/rag/INGEST_MANIFEST.json"),
    )
    args = ap.parse_args()

    entries: list[dict] = []
    for rel in args.roots:
        root = Path(rel)
        if not root.is_dir():
            continue
        for p in sorted(root.rglob("*.md")):
            st = p.stat()
            entries.append(
                {
                    "path": str(p).replace("\\", "/"),
                    "bytes": st.st_size,
                    "sha256": sha256_file(p),
                }
            )

    manifest = {
        "version": 1,
        "generated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "file_count": len(entries),
        "files": entries,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {len(entries)} files -> {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
