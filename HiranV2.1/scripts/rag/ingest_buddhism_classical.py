#!/usr/bin/env python3
"""Stáhne vybrané překlady z SuttaCentral bilara-data → markdown do RAG adresáře.

Zdroj: https://github.com/suttacentral/bilara-data (published větev)
Licence jednotlivých překladů: viz stránku překladu na SuttaCentral — Bhikkhu Sujato EN je typicky CC0.

Používá pouze Python stdlib.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

RAW_BASE_DEFAULT = (
    "https://raw.githubusercontent.com/suttacentral/bilara-data/"
    "published/translation/en/sujato/"
)

TAG_RE = re.compile(r"<[^>]+>")
WS_RE = re.compile(r"[ \t\n]{2,}")


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def strip_segments(text: str) -> str:
    text = TAG_RE.sub("", text)
    return WS_RE.sub(" ", text).strip()


def segment_sort_key(seg_id: str) -> tuple[str, tuple[tuple[int, object], ...]]:
    """Řadicí klíč pro segmenty typu mn118:1.3 — vždy srovnatelný (žádné porovnání str vs int)."""
    if ":" not in seg_id:
        return (seg_id, ())
    sutta_id, rest = seg_id.split(":", 1)
    parts: list[tuple[int, object]] = []
    for chunk in rest.split("."):
        if chunk.isdigit():
            parts.append((0, int(chunk)))
        else:
            parts.append((1, chunk))
    return (sutta_id, tuple(parts))


def uid_from_translation_path(rel: str) -> str:
    # …/mn118_translation-en-sujato.json → mn118
    name = Path(rel).name
    if "_translation-" in name:
        return name.split("_translation-", 1)[0]
    return Path(name).stem


def sutta_slug(uid: str) -> str:
    return uid.replace(":", "-")


def fetch_json(url: str, timeout: int = 60) -> dict:
    req = Request(
        url,
        headers={
            "User-Agent": "ZionHiranBuddhismRag/1.0 (+https://github.com/zion-project; classical ingest)",
        },
        method="GET",
    )
    with urlopen(req, timeout=timeout) as resp:
        data = resp.read().decode("utf-8")
    return json.loads(data)


def write_file(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "--manifest",
        type=Path,
        default=Path("HiranV2.1/data/rag/manifest_buddhism_classical.json"),
        help="JSON manifest (repo-relative or absolute)",
    )
    ap.add_argument(
        "--out-dir",
        type=Path,
        default=Path("HiranV2.1/data/rag/buddhism-classical/generated"),
        help="Výstupní adresář pro .md",
    )
    ap.add_argument("--raw-base", default=RAW_BASE_DEFAULT, help="Base URL bilara JSON")
    ap.add_argument(
        "--max-chars",
        type=int,
        default=500_000,
        help="Max znaků těla na jednu sútru; delší text ořízni s varováním",
    )
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    files: list[str] = manifest["files"]
    license_note = manifest.get(
        "license_note",
        "See SuttaCentral per-sutta copyright; Sujato EN tree is CC0 on SuttaCentral.",
    )

    written = 0
    errors: list[str] = []
    for rel in files:
        rel = rel.strip().lstrip("/")
        url = args.raw_base.rstrip("/") + "/" + rel
        uid = uid_from_translation_path(rel)
        slug = sutta_slug(uid)
        out_path = args.out_dir / f"{slug}.md"
        try:
            if args.dry_run:
                print(f"[dry-run] would fetch {url} -> {out_path}")
                written += 1
                continue
            seg_map = fetch_json(url)
            if not isinstance(seg_map, dict):
                errors.append(f"{rel}: expected JSON object")
                continue
            body_parts_ordered = sorted(seg_map.keys(), key=segment_sort_key)
            body_chunks: list[str] = []
            for k in body_parts_ordered:
                body_chunks.append(strip_segments(str(seg_map[k])))
            body = "\n\n".join(p for p in body_chunks if p)
            truncated = ""
            if len(body) > args.max_chars:
                body = body[: args.max_chars].rsplit("\n\n", 1)[0]
                truncated = "\n\n_(Text truncated for RAG chunking — see full text on SuttaCentral.)_"
            sc_url = f"https://suttacentral.net/{uid}"
            md = (
                "---\n"
                f'rag_index: buddhism-classical\n'
                f"source: suttacentral-bilara-data\n"
                f"uid: {uid}\n"
                f"translator: sujato\n"
                f"language: en\n"
                f"license_note: {license_note}\n"
                f"sutta_central_url: {sc_url}\n"
                f"ingested_at: {utc_now()}\n"
                f"bilara_path: {rel}\n"
                "---\n\n"
                f"# {uid}\n\n"
                f"{body}{truncated}\n"
            )
            write_file(out_path, md)
            written += 1
            print(f"OK {uid} -> {out_path} ({len(md)} chars)")
        except Exception as e:  # noqa: BLE001 — CLI tool
            errors.append(f"{rel}: {e}")

    if errors:
        print("ERRORS:", file=sys.stderr)
        for e in errors:
            print(f"  {e}", file=sys.stderr)
        return 1
    print(f"Done: {written} markdown files")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
