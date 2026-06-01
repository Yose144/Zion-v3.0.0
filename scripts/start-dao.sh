#!/usr/bin/env bash
# ZION V3 — Start DAO governance daemon (L2), API on 8081
set -euo pipefail
source "$(dirname "$0")/_lib.sh"

export DAO_API_PORT="${DAO_API_PORT:-8081}"
export DAO_DB_PATH="${DAO_DB_PATH:-$DATA_DIR/dao.db}"
export ZION_NODE_RPC_ADDR="${ZION_NODE_RPC_ADDR:-127.0.0.1:8443}"

EXE="$(find_exe zion-dao)" || { zlog "[ERROR] zion-dao not built."; exit 1; }
start_bg "dao" "$EXE" >/dev/null
zlog "DAO -> http://localhost:$DAO_API_PORT"
