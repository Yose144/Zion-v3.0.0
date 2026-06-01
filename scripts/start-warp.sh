#!/usr/bin/env bash
# ZION V3 — Start WARP cross-chain relay (L3). Uses WARP_CONFIG if set, else dev defaults.
set -euo pipefail
source "$(dirname "$0")/_lib.sh"

[[ -n "${WARP_CONFIG:-}" ]] && export WARP_CONFIG
EXE="$(find_exe zion-warp-server)" || { zlog "[ERROR] zion-warp-server not built."; exit 1; }
start_bg "warp" "$EXE" >/dev/null
zlog "WARP relay started"
