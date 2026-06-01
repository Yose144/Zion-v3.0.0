#!/usr/bin/env bash
# ZION V3 — Start Bridge relay daemon (L2). Uses testnet config by default.
set -euo pipefail
source "$(dirname "$0")/_lib.sh"

CFG="${ZION_BRIDGE_CONFIG:-$REPO_ROOT/V3/L2/bridge/config/bridge-testnet.toml}"
export ZION_BRIDGE_CONFIG="$CFG"

EXE="$(find_exe zion-bridge)" || { zlog "[ERROR] zion-bridge not built."; exit 1; }
if [[ ! -f "$CFG" ]]; then
    zlog "[WARN] Bridge config not found: $CFG (daemon may exit). Set ZION_BRIDGE_CONFIG."
fi
start_bg "bridge" "$EXE" --config "$CFG" >/dev/null
zlog "Bridge started (config: $CFG)"
