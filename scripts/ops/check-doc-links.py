#!/usr/bin/env python3
"""check-doc-links.py — najde rozbité relativní odkazy v markdownu.

Proč: při přesunu dokumentů (např. root .md → docs/3.3/ 2. 11. 2026)
zůstávají odkazy na starých cestách a nikdo si toho nevšimne, dokud
někdo neklikne. Tenhle skript to chytí za pár sekund.

Použití:
    python3 scripts/ops/check-doc-links.py            # živý strom (výchozí)
    python3 scripts/ops/check-doc-links.py --all      # i archive/, PUBLIC/, docs2.9/
    python3 scripts/ops/check-doc-links.py --quiet    # jen souhrn + exit kód

Exit kód: 0 = čisto, 1 = nalezeny rozbité odkazy (vhodné do CI).

Co se NEHLÁSÍ (záměrně):
  - http(s)/mailto/tel a absolutní cesty typu /nirvana/cist (webové routy)
  - odkazy uvnitř fenced code bloků
  - stromy mimo --all: archive/, PUBLIC/, docs/docs2.9/, apps/*/archive-content/
"""
from __future__ import annotations

import argparse
import os
import re
import sys
import urllib.parse
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# živý dokumentační strom — historické snapshoty se nekontrolují.
# `docs/` se nebere celý: obsahuje i dokumenty z éry 2.9/3.0, které
# odkazují na layout před reorganizací a nemá smysl je opravovat.
LIVE_DIRS = ["infra", "canon", "V31", "ZION_OS", "scripts", "Kingdom",
             "docs/3.2", "docs/3.3", "docs/plans", "docs/ops",
             "docs/WP-Mainet", "docs/marketing", "docs/security",
             "docs/mainnet", "docs/oasis"]
LIVE_ROOT_FILES = [
    "AGENTS.md", "README.md", "ROADMAP.md", "REPO-MAP.md", "PLAN.md",
    "CHANGELOG.md", "SECURITY.md", "CONTRIBUTING.md", "CODE_OF_CONDUCT.md",
]
LIVE_EXCLUDE = {
    "V31/docs", "ZION_OS/docs", "canon/l6/proEricku",
    "apps/website-v2.9/archive-content",
    # Distribuční balíček knih: markdown se sem kopíruje z canon/books/<edice>/
    # a relativní odkazy uvnitř textu míří na repo layout, ne na balíček
    # (build_edition.py je nepřepisuje). Není to dokumentace repa — je to
    # export pro čtenáře, proto se stejným zacházením jako archive/.
    "canon/Kralovstvi_srdce_Zion_CZ_EN_FR_ES_PT_PRODEJ",
}
SKIP_DIRNAMES = {".git", "node_modules", ".next", "target", ".artifacts",
                 "dist", "build", "Cache", "Autotune", "BACKUP", "__pycache__"}

LINK_RE = re.compile(r'(?<!!)\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)')


def is_web_route(path: str) -> bool:
    """Absolutní cesta bez přípony = routa webu, ne soubor."""
    if not path.startswith("/"):
        return False
    return not os.path.splitext(path.split("#")[0])[1]


def collect(all_files: bool):
    if all_files:
        for dp, dn, fn in os.walk(ROOT):
            dn[:] = [d for d in dn if d not in SKIP_DIRNAMES]
            for f in fn:
                if f.endswith(".md"):
                    yield os.path.join(dp, f)
        return

    for f in LIVE_ROOT_FILES:
        p = os.path.join(ROOT, f)
        if os.path.exists(p):
            yield p
    for d in LIVE_DIRS:
        base = os.path.join(ROOT, d)
        if not os.path.isdir(base):
            continue
        for dp, dn, fn in os.walk(base):
            rel = os.path.relpath(dp, ROOT).replace(os.sep, "/")
            if any(rel == e or rel.startswith(e + "/") for e in LIVE_EXCLUDE):
                dn[:] = []
                continue
            dn[:] = [x for x in dn if x not in SKIP_DIRNAMES]
            for f in fn:
                if f.endswith(".md"):
                    yield os.path.join(dp, f)


def check(target: str, src_dir: str) -> bool:
    t = target.split("#")[0].split("?")[0].strip()
    if not t or t.startswith(("http://", "https://", "mailto:", "tel:", "#")):
        return True
    if is_web_route(t):
        return True
    t = urllib.parse.unquote(t)
    base = ROOT if t.startswith("/") else src_dir
    return os.path.exists(os.path.normpath(os.path.join(base, t.lstrip("/"))))


def main() -> int:
    ap = argparse.ArgumentParser(description="Najde rozbité relativní odkazy v markdownu.")
    ap.add_argument("--all", action="store_true", help="včetně archivních stromů")
    ap.add_argument("--quiet", action="store_true", help="jen souhrn")
    args = ap.parse_args()

    broken = defaultdict(list)
    for path in collect(args.all):
        rel = os.path.relpath(path, ROOT)
        src_dir = os.path.dirname(path)
        try:
            text = open(path, encoding="utf-8", errors="replace").read()
        except OSError:
            continue
        # fenced code bloky pryč — obsahují příklady, ne odkazy
        stripped = re.sub(r"^```.*?^```", "", text, flags=re.S | re.M)
        for m in LINK_RE.finditer(stripped):
            if not check(m.group(1), src_dir):
                line = stripped[: m.start()].count("\n") + 1
                broken[rel].append((line, m.group(1)))

    total = sum(len(v) for v in broken.values())
    scope = "vše (včetně archivu)" if args.all else "živý strom"
    print(f"check-doc-links: {scope} | souborů: {sum(1 for _ in collect(args.all))} "
          f"| rozbitých odkazů: {total}")

    if not args.quiet:
        for rel in sorted(broken):
            print(f"\n{rel}")
            for line, tgt in broken[rel]:
                print(f"  :{line}  ->  {tgt}")

    return 1 if total else 0


if __name__ == "__main__":
    sys.exit(main())
