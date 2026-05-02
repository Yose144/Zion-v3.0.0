#!/usr/bin/env bash
# Stitch FINAL/*.md → composer/edition/Full.md (Czech canonical unified edition).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TERRANOVA_HOME="$(cd "$SCRIPT_DIR/../.." && pwd)"
FINAL="$TERRANOVA_HOME/FINAL"
OUT_DIR="$TERRANOVA_HOME/composer/edition"
OUT_FILE="$OUT_DIR/Full.md"

ORDER=(
  "00-PROLOG.md"
  "01-MOST.md"
  "02-KOSMOLOGIE.md"
  "03-VOLNA-ENERGIE.md"
  "04-KOMUNITY.md"
  "05-AI-NATIVE.md"
  "06-MEDICINA.md"
  "07-ARCHITEKTURA.md"
  "08-SVOBODA.md"
  "09-ISSOBELLA.md"
  "10-WARP.md"
  "11-KOMPAS.md"
  "A-NVIDIA.md"
  "B-PROROCTVI.md"
  "C-ZJEVENI.md"
  "D-BHAGAVAD-GITA.md"
)

mkdir -p "$OUT_DIR"

{
  cat << 'PREAMBLE'
<!-- Generated file — do not edit by hand. Regenerate with composer/scripts/build-full-md.sh -->

# Terra Nova — Composer unified edition (single file)

**Čtvrtá kniha projektu ZION · Zlatý Kompas Nové Země**

Tento soubor je strojovým sloučením kapitol z adresáře `docs/TerraNova/FINAL/`.
Kanonicalitu drží jednotlivé `.md` soubory tam; charta práce je v `composer/edition/00-EDITORIAL-CHARTER.md`.

PREAMBLE

  for name in "${ORDER[@]}"; do
    src="$FINAL/$name"
    if [[ ! -f "$src" ]]; then
      echo "missing source file: $src" >&2
      exit 1
    fi
    printf '\n---\n\n<!-- composer-part: FINAL/%s -->\n\n' "$name"
    cat "$src"
    printf '\n'
  done
} >"$OUT_FILE"

echo "Wrote $OUT_FILE"
