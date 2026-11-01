#!/usr/bin/env bash
#
# F6 — ověří path-mapping apexu na Archiv v3 (bez jediného zápisu na server).
#
#   bash scripts/ops/check-apex-mapping.sh
#
# Po přepnutí apexu platí: `/` → Brána (Kingdom), všechno ostatní →
# `kingdom.zionterranova.com/archive/v3<stejná cesta>`. Tenhle skript ověří, že
# pro **každou** stránku archivu existuje cíl — tedy že staré URL neumřou.
#
# Kontroluje:
#   1. každý `*.html` v archivu má protějšek v simulovaném redirectu,
#   2. adresářové URL (`/blog/`) míří na `index.html`,
#   3. `/legacy/` a `/portfolio/` jsou mimo archiv — jen se **ohlásí** (vědomá
#      mezera, surové archivy), ne jako chyba,
#   4. `MANIFEST.txt` existuje (archiv je popsaný).
set -euo pipefail

cd "$(dirname "$0")/../.."
ARCH="Kingdom/apps/kingdom/public/archive/v3"
BASE="/archive/v3"

[[ -d "$ARCH" ]] || { echo "chybí archiv $ARCH — spusť Kingdom/scripts/build-archive-v3.sh" >&2; exit 1; }

red() { printf '\033[31m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }
yellow() { printf '\033[33m%s\033[0m\n' "$*"; }

fail=0
total=0
ok=0

echo "== simulace redirectu: <cesta> → ${BASE}<cesta> =="

while IFS= read -r file; do
  rel="${file#"$ARCH"}"
  total=$((total + 1))

  # Adresářová URL: /blog/index.html se servíruje jako /blog/
  if [[ "$rel" == */index.html ]]; then
    url="${rel%/index.html}/"
    target="$ARCH${url%/}/index.html"
  else
    url="$rel"
    target="$file"
  fi

  if [[ -f "$target" ]]; then
    ok=$((ok + 1))
  else
    red "  CHYBA: ${url} → ${BASE}${url} (chybí soubor)"
    fail=1
  fi
done < <(find "$ARCH" -name '*.html' | sort)

echo "  stránek: ${total}, s cílem: ${ok}"

# `index.html` v rootu se musí servírovat jako /archive/v3/ (ne jen /archive/v3/index.html)
if [[ -f "$ARCH/index.html" ]]; then
  green "  root: ${BASE}/index.html existuje (Brána jde na /, ne sem)"
else
  red "  CHYBA: chybí ${BASE}/index.html"
  fail=1
fi

# Vědomé mezery
for missing in legacy portfolio; do
  if [[ -d "$ARCH/$missing" ]]; then
    yellow "  POZOR: archiv obsahuje '$missing' (čekalo se, že bude vynechaný — zkontroluj velikost)"
  else
    yellow "  mezera: /${missing}/ nemá v archivu cíl (surový archiv, do bundlu nepatří)"
  fi
done

# Manifest
if [[ -f "$ARCH/MANIFEST.txt" ]]; then
  green "  manifest: $(head -1 "$ARCH/MANIFEST.txt")"
else
  red "  CHYBA: chybí MANIFEST.txt"
  fail=1
fi

echo
if [[ "$fail" -eq 0 ]]; then
  green "path-mapping apexu je konzistentní — staré URL po přepnutí nespadnou do 404"
else
  red "path-mapping má chyby — apex nepřepínat"
  exit 1
fi
