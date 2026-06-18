#!/usr/bin/env bash
# ZION V3 — Start Swap Aggregator daemon (L2 DeFi), API on 8456 (built-in default)
set -euo pipefail
source "$(dirname "$0")/_lib.sh"

EXE="$(find_exe zion-swap-aggregator)" || { zlog "[ERROR] zion-swap-aggregator not built."; exit 1; }

# Optional: override config via env
export SWAP_AGGREGATOR_BIND="${SWAP_AGGREGATOR_BIND:-0.0.0.0:8456}"
export SWAP_AGGREGATOR_DB="${SWAP_AGGREGATOR_DB:-$DATA_DIR/swap-aggregator.db}"

start_bg "swap-aggregator" "$EXE" >/dev/null
zlog "Swap Aggregator started (bind: $SWAP_AGGREGATOR_BIND)"
