#!/usr/bin/env bash
# Stitch FINAL/en/*.md → composer/edition/Full-en.md (English unified edition).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TERRANOVA_HOME="$(cd "$SCRIPT_DIR/../.." && pwd)"
FINAL_EN="$TERRANOVA_HOME/FINAL/en"
OUT_DIR="$TERRANOVA_HOME/composer/edition"
OUT_FILE="$OUT_DIR/Full-en.md"

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
<!-- Generated file — do not edit by hand. Regenerate with composer/scripts/build-full-en-md.sh -->

# Terra Nova — Composer unified edition (English)

**Fourth book of the ZION complex · Golden Compass of the New Earth**

This file is a mechanical stitch of chapters under `docs/TerraNova/FINAL/en/`.
Canonical content lives in those individual `.md` files; editorial charter (CS): `composer/edition/00-EDITORIAL-CHARTER.md`.

PREAMBLE

  for name in "${ORDER[@]}"; do
    src="$FINAL_EN/$name"
    if [[ ! -f "$src" ]]; then
      echo "missing source file: $src" >&2
      exit 1
    fi
    printf '\n---\n\n<!-- composer-part: FINAL/en/%s -->\n\n' "$name"
    cat "$src"
    printf '\n'
  done
} >"$OUT_FILE"

echo "Wrote $OUT_FILE"
