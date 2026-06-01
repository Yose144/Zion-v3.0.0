#!/usr/bin/env bash
# ZION V3 — Start Atomic Swap daemon (L2), API on 8888 (built-in default)
set -euo pipefail
source "$(dirname "$0")/_lib.sh"

CFG="${ZION_SWAP_CONFIG:-$REPO_ROOT/V3/L2/atomic-swap/config/swap-testnet.toml}"
EXE="$(find_exe zion-atomic-swap)" || { zlog "[ERROR] zion-atomic-swap not built."; exit 1; }

# Ensure escrow key is available (generate once and persist for testnet)
ESCROW_KEY_FILE="$DATA_DIR/atomic-swap-escrow.key"
if [[ -z "${ZION_SWAP_ESCROW_KEY:-}" ]]; then
    if [[ -f "$ESCROW_KEY_FILE" ]]; then
        ZION_SWAP_ESCROW_KEY="$(cat "$ESCROW_KEY_FILE")"
    else
        ZION_SWAP_ESCROW_KEY="$(python3 -c 'import secrets; print(secrets.token_hex(32))')"
        echo "$ZION_SWAP_ESCROW_KEY" > "$ESCROW_KEY_FILE"
        zlog "Generated new ZION_SWAP_ESCROW_KEY at $ESCROW_KEY_FILE"
    fi
    export ZION_SWAP_ESCROW_KEY
fi

if [[ -f "$CFG" ]]; then
    start_bg "atomic-swap" "$EXE" --config "$CFG" >/dev/null
    zlog "Atomic Swap started (config: $CFG)"
else
    start_bg "atomic-swap" "$EXE" >/dev/null
    zlog "Atomic Swap started (built-in dev defaults)"
fi
