#!/usr/bin/env python3
"""Stáhne plain-text extracty z anglické Wikipedie jako markdown pro RAG „buddhism-tibetan“ seed.

DŮLEŽITÉ: Jedná se o encyklopedický kontext (CC BY-SA), ne o kanonické tibetské překlady.
Pro Kanjur/Tangyur a moderní překlady doplň vlastní korpus (84000, BDRC…) dle licence.

Používá pouze Python stdlib. Respektujte https://foundation.wikimedia.org/wiki/Policy:User-Agent_policy
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def wiki_api(params: dict[str, str], timeout: int = 60) -> dict:
    qs = urllib.parse.urlencode(params)
    url = f"https://en.wikipedia.org/w/api.php?{qs}"
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "ZionHiranBuddhismRag/1.0 (+https://github.com/zion-project; Tibetan topic seed)",
            "Accept": "application/json",
        },
        method="GET",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def fetch_extract(title: str) -> tuple[str, str]:
    payload = wiki_api(
        {
            "action": "query",
            "format": "json",
            "titles": title.replace("_", " "),
            "prop": "extracts",
            "explaintext": "1",
            "exsectionformat": "plain",
            "redirects": "1",
        }
    )
    pages = payload.get("query", {}).get("pages", {})
    if not pages:
        return title, ""
    page = next(iter(pages.values()))
    if page.get("missing"):
        return title, ""
    extract = page.get("extract") or ""
    canonical = page.get("title") or title
    return canonical, extract


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "--manifest",
        type=Path,
        default=Path("HiranV2.1/data/rag/manifest_buddhism_tibetan_wiki.json"),
    )
    ap.add_argument(
        "--out-dir",
        type=Path,
        default=Path("HiranV2.1/data/rag/buddhism-tibetan/generated"),
    )
    ap.add_argument("--delay", type=float, default=0.35, help="sekundy mezi requesty")
    ap.add_argument("--max-chars", type=int, default=200_000, help="max délka extractu")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    data = json.loads(args.manifest.read_text(encoding="utf-8"))
    titles: list[str] = data["titles"]

    errors: list[str] = []
    ok = 0
    args.out_dir.mkdir(parents=True, exist_ok=True)

    for raw_title in titles:
        safe_slug = raw_title.strip()
        if not safe_slug:
            continue
        out_path = args.out_dir / f"{safe_slug}.md"

        try:
            if args.dry_run:
                print(f"[dry-run] would fetch Wikipedia:{safe_slug} -> {out_path}")
                ok += 1
                continue
            canonical, extract = fetch_extract(safe_slug)
            if not extract.strip():
                errors.append(f"{safe_slug}: empty or missing extract")
                time.sleep(args.delay)
                continue
            if len(extract) > args.max_chars:
                extract = extract[: args.max_chars].rsplit("\n\n", 1)[0]
                extract += "\n\n_(Extract truncated for RAG — see Wikipedia for full article.)_"

            enc_title = safe_slug.replace(" ", "_")
            page_url = "https://en.wikipedia.org/wiki/" + urllib.parse.quote(enc_title, safe="/():%")

            md = (
                "---\n"
                "rag_index: buddhism-tibetan\n"
                "source: wikipedia-en\n"
                f"title: {canonical}\n"
                f"page_url: {page_url}\n"
                "license: CC-BY-SA-4.0 (Wikipedia text; attribute authors)\n"
                f"ingested_at: {utc_now()}\n"
                "disclaimer: Encyclopedia summary, not canonical Tibetan scripture.\n"
                "---\n\n"
                f"# {canonical} (Wikipedia EN)\n\n"
                "Per Wikimedia Terms of Use, text is available under CC BY-SA; "
                "cite the article and check page history for attribution.\n\n"
                "---\n\n"
                f"{extract}\n"
            )
            out_path.write_text(md, encoding="utf-8")
            ok += 1
            print(f"OK {canonical} -> {out_path}")
        except urllib.error.HTTPError as e:
            errors.append(f"{safe_slug}: HTTP {e.code}")
        except Exception as e:  # noqa: BLE001
            errors.append(f"{safe_slug}: {e}")

        time.sleep(args.delay)

    print(f"Done: {ok} files")
    if errors:
        print("WARNINGS:", file=sys.stderr)
        for e in errors:
            print(f"  {e}", file=sys.stderr)
        return 0 if ok else 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
