#!/usr/bin/env bash
# Kontrola, že se v kódu nevrátila stará (přemrštěná) výše vánočních bonusů.
#
# Historie: do 4. 11. 2026 měly tři vánoční produkty 1 000 ZION/Kč, zatímco
# zbytek katalogu 10 ZION/Kč (SHOP_ZION_PER_CZK). 👤 rozhodl snížit je o řád
# na 100 ZION/Kč: 108 000 → 10 800, 216 000 → 21 600, 432 000 → 43 200.
#
# Skript hlídá jen **bonusové** formulace (`… ZION`), ne holá čísla — 108 000
# ZION je i minimum pro validator staking ve whitepaperu, což je jiný kontext.
#
# Použití:  bash scripts/ops/check-bonus-copy.sh
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

fail=0

check() {
  local label="$1" pattern="$2"
  local hits
  # Whitepapery mají vlastní ekonomická čísla (např. 108 000 ZION jako minimum
  # pro validator staking) — s bonusy v e-shopu nesouvisí, proto se přeskakují.
  hits=$(git grep -n -I -E "$pattern" -- \
      apps ':!*/node_modules/*' ':!*/.next/*' ':!*/dist/*' \
      ':!*/whitepaper/*' ':!*/docs/whitepaper/*' 2>/dev/null || true)
  if [[ -n "$hits" ]]; then
    echo "✗ $label — nalezeno:" >&2
    echo "$hits" | sed 's/^/    /' >&2
    fail=1
  else
    echo "✓ $label"
  fi
}

check "staré bonusy v ZION (108/216/432 tisíc)" \
  '(108|216|432)[ ,]?000[ ]?ZION|ZION[ ]?(108|216|432)[ ,]?000'

check "stará formulace „tisíc ZION za korunu\"" \
  'tisíc ZION za každou korunu|a thousand ZION for every crown'

exit "$fail"
