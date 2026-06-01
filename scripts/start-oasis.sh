#!/usr/bin/env bash
# ZION V3 — Start OASIS Avatar Hub (L4), API on 8094
set -euo pipefail
source "$(dirname "$0")/_lib.sh"

export OASIS_PORT="${OASIS_PORT:-8094}"
export OASIS_BIND="${OASIS_BIND:-0.0.0.0}"
export OASIS_DB="${OASIS_DB:-$DATA_DIR/oasis.db}"

EXE="$(find_exe zion-oasis)" || { zlog "[ERROR] zion-oasis not built."; exit 1; }
start_bg "oasis" "$EXE" >/dev/null
zlog "OASIS -> http://localhost:$OASIS_PORT"
