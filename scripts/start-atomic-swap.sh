#!/usr/bin/env bash
# ZION V3 — Start Atomic Swap daemon (L2), API on 8888 (built-in default)
set -euo pipefail
source "$(dirname "$0")/_lib.sh"

CFG="${ZION_SWAP_CONFIG:-$REPO_ROOT/V3/L2/atomic-swap/config/swap-testnet.toml}"
EXE="$(find_exe zion-atomic-swap)" || { zlog "[ERROR] zion-atomic-swap not built."; exit 1; }

if [[ -f "$CFG" ]]; then
    start_bg "atomic-swap" "$EXE" --config "$CFG" >/dev/null
    zlog "Atomic Swap started (config: $CFG)"
else
    start_bg "atomic-swap" "$EXE" >/dev/null
    zlog "Atomic Swap started (built-in dev defaults)"
fi
