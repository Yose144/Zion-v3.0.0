#!/bin/bash
# ============================================================================
# combine_v4.sh — Sestaví cosmic_harmony_v4_native.c ze zdrojových částí
#
# Části:
#   cosmic_harmony_v4_native_p1.c  — hlavičky, includes, konstanty
#   npu_weights_c.txt               — CHV4_WEIGHT_BYTES[16960] (generováno BLAKE3)
#   cosmic_harmony_v4_native_p2.c  — všechny funkce + exportované API
#
# Váhový soubor generujte přes:
#   cd /tmp/dump_npu_weights && cargo run --release > npu_weights_c.txt
# ============================================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

P1="cosmic_harmony_v4_native_p1.c"
P2="cosmic_harmony_v4_native_p2.c"
OUT="cosmic_harmony_v4_native.c"

WEIGHTS="${1:-/tmp/npu_weights_c.txt}"

if [ ! -f "$WEIGHTS" ]; then
    echo "❌ Váhový soubor nenalezen: $WEIGHTS"
    echo "   Spusťte: cd /tmp/dump_npu_weights && cargo run --release > /tmp/npu_weights_c.txt"
    exit 1
fi

echo "🔧 Sestavuji $OUT z:"
echo "   $P1"
echo "   $WEIGHTS"
echo "   $P2"

cat "$P1" "$WEIGHTS" "$P2" > "$OUT"

LINES=$(wc -l < "$OUT")
echo "✅ $OUT vytvořen ($LINES řádků)"
