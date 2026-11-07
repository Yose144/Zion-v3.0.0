#!/usr/bin/env python3
"""fix-doc-links.py — navrhne (a s --write provede) opravy rozbitých odkazů.

Proč: `check-doc-links.py` umí najít rozbité relativní odkazy, ale neříká,
které z nich jsou jen „špatná hloubka cesty" a které opravdu chybí. Při
přesunech dokumentů (root .md → docs/3.3/, knihy → canon/books/) vzniká
typická chyba: cesta je o úroveň vedle, soubor přitom v repu existuje.

Co skript dělá:
  1. bere stejný seznam souborů, stejný LINK_RE a stejnou definici „rozbitý"
     jako check-doc-links.py (importuje ho, žádná druhá pravda),
  2. pro každý rozbitý odkaz zkusí najít cíl podle jména v ŽIVÉM stromu
     (archiv/PUBLIC/docs2.9 se záměrně neberou — odkaz do archivu není oprava),
  3. když je cíl jednoznačný (jediný soubor, nebo nejdelší shoda koncových
     segmentů cesty), přepíše jen cíl odkazu; kotvu i query zachová,
  4. co zůstane, vypíše jako content gap — chybějící dokument je editorské
     rozhodnutí, ne automatická oprava.

Použití:
    python3 scripts/ops/fix-doc-links.py                # dry-run + souhrn
    python3 scripts/ops/fix-doc-links.py --write        # provést opravy
    python3 scripts/ops/fix-doc-links.py --show-gaps    # vypsat chybějící cíle

Exit kód: 0 = čisto, 1 = zbývají mezery, 2 = jen návrhy (dry-run).
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import os
import sys
import urllib.parse
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))

# stromy, které se do indexu cílů neberou: odkaz do archivu není oprava
INDEX_SKIP_TOP = {"archive", "PUBLIC", "node_modules", ".git", ".next", "target",
                  ".artifacts", "dist", "build", "__pycache__", "BACKUP"}
INDEX_SKIP_PREFIX = ("docs/docs2.9/", "apps/website-v2.9/archive-content/",
                     "canon/l6/proEricku/")


def load_checker():
    path = os.path.join(HERE, "check-doc-links.py")
    spec = importlib.util.spec_from_file_location("check_doc_links", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def build_index(checker):
    """basename -> [repo-relative path] pro soubory i adresáře v živém stromu."""
    by_name = defaultdict(list)
    for dirpath, dirnames, filenames in os.walk(ROOT):
        rel_dir = os.path.relpath(dirpath, ROOT).replace(os.sep, "/")
        rel_dir = "" if rel_dir == "." else rel_dir
        if rel_dir.split("/")[0] in INDEX_SKIP_TOP:
            dirnames[:] = []
            continue
        if rel_dir and rel_dir.startswith(INDEX_SKIP_PREFIX):
            dirnames[:] = []
            continue
        dirnames[:] = [d for d in dirnames
                       if d not in checker.SKIP_DIRNAMES and d not in INDEX_SKIP_TOP]
        for name in dirnames:
            by_name[name].append(f"{rel_dir}/{name}" if rel_dir else name)
        for name in filenames:
            if "." in name:
                by_name[name].append(f"{rel_dir}/{name}" if rel_dir else name)
    return by_name


def suffix_score(target: str, candidate: str) -> int:
    """Kolik koncových segmentů cesty mají společných."""
    t = [s for s in urllib.parse.unquote(target).split("/") if s not in ("", ".", "..")]
    c = candidate.split("/")
    score = 0
    while score < len(t) and score < len(c) and t[-1 - score] == c[-1 - score]:
        score += 1
    return score


def pick(target: str, by_name: dict):
    base = os.path.basename(urllib.parse.unquote(target).rstrip("/"))
    candidates = by_name.get(base, [])
    if not candidates:
        return None, "missing"
    if len(candidates) == 1:
        return candidates[0], "unique"
    scored = sorted(((suffix_score(target, c), c) for c in candidates), reverse=True)
    best = scored[0]
    second_score = scored[1][0] if len(scored) > 1 else -1
    if best[0] > second_score and best[0] >= 1:
        return best[1], "suffix"
    return None, "ambiguous"


def code_spans(text: str):
    """(start, end) fenced code bloků — odkazy uvnitř se nepočítají."""
    spans, start = [], None
    offset = 0
    for line in text.splitlines(keepends=True):
        fence = line.lstrip().startswith("```")
        if fence and start is None:
            start = offset
        elif fence and start is not None:
            spans.append((start, offset + len(line)))
            start = None
        offset += len(line)
    if start is not None:
        spans.append((start, len(text)))
    return spans


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true", help="provést opravy (jinak dry-run)")
    ap.add_argument("--show-gaps", action="store_true", help="vypsat chybějící cíle")
    ap.add_argument("--show-fixes", action="store_true", help="vypsat navržené opravy")
    ap.add_argument("--json", action="store_true", help="strojový souhrn")
    args = ap.parse_args()

    checker = load_checker()
    by_name = build_index(checker)

    stats = Counter()
    edits_by_file = defaultdict(list)
    gaps = defaultdict(list)
    ambiguous = defaultdict(list)
    unfixable = []

    for path in checker.collect(False):
        src_dir = os.path.dirname(path)
        rel = os.path.relpath(path, ROOT)
        text = open(path, encoding="utf-8", errors="replace").read()
        spans = code_spans(text)
        for m in checker.LINK_RE.finditer(text):
            target = m.group(1)
            if any(s <= m.start(1) < e for s, e in spans):
                continue
            if checker.check(target, src_dir):
                continue
            t = target.strip()
            if t.startswith(("http://", "https://", "mailto:", "tel:", "#", "?")):
                continue
            core, _, anchor = t.partition("#")
            query = ""
            if "?" in core:
                core, query = core.split("?", 1)
            if checker.is_web_route(urllib.parse.unquote(core)):
                continue
            found, how = pick(core, by_name)
            if not found:
                (gaps if how == "missing" else ambiguous)[rel].append((m.start(), core))
                stats[how] += 1
                continue
            src_rel_dir = os.path.dirname(rel)
            if core.startswith("/"):
                new_core = "/" + found
            else:
                new_core = os.path.relpath(found, src_rel_dir or ".").replace(os.sep, "/")
            if " " in new_core:
                new_core = new_core.replace(" ", "%20")
            new_target = new_core + (("?" + query) if query else "") + (("#" + anchor) if anchor else "")
            if new_target == target or not checker.check(new_target, src_dir):
                stats["unfixable"] += 1
                unfixable.append((rel, core, new_target))
                continue
            edits_by_file[path].append((m.start(1), m.end(1), target, new_target))
            stats["fixed"] += 1

    if args.write:
        for path, edits in edits_by_file.items():
            text = open(path, encoding="utf-8", errors="replace").read()
            for s, e, old, new in sorted(edits, reverse=True):
                if text[s:e] != old:          # sanity: nikdy nepřepisuj naslepo
                    print(f"SKIP {path}: offset {s} neodpovídá '{old}'", file=sys.stderr)
                    continue
                text = text[:s] + new + text[e:]
            open(path, "w", encoding="utf-8").write(text)

    if args.json:
        print(json.dumps({
            "fixed": stats["fixed"], "missing": stats["missing"],
            "ambiguous": stats["ambiguous"], "unfixable": stats["unfixable"],
            "written": bool(args.write),
        }, ensure_ascii=False))
    else:
        print(f"fix-doc-links: opravitelných {stats['fixed']} | chybějící cíl {stats['missing']} "
              f"| nejednoznačných {stats['ambiguous']} | nešlo aplikovat {stats['unfixable']} "
              f"| {'ZAPSÁNO' if args.write else 'dry-run'}")
        if args.show_fixes:
            for path, edits in sorted(edits_by_file.items()):
                rel = os.path.relpath(path, ROOT)
                print(f"\n{rel}")
                for _, _, old, new in sorted(edits)[:8]:
                    print(f"   {old}  ->  {new}")
        if args.show_gaps:
            for rel in sorted(gaps):
                print(f"\n[chybí cíl] {rel}")
                for _, tgt in gaps[rel][:12]:
                    print(f"   -> {tgt}")

    if stats["missing"] or stats["ambiguous"] or stats["unfixable"]:
        return 1
    return 2 if stats["fixed"] else 0


if __name__ == "__main__":
    sys.exit(main())
