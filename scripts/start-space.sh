#!/usr/bin/env bash
# ZION V3 — Start Issobella space daemon (L6), API on 8096
set -euo pipefail
source "$(dirname "$0")/_lib.sh"

export ISSOBELLA_PORT="${ISSOBELLA_PORT:-8096}"
export ISSOBELLA_BIND="${ISSOBELLA_BIND:-0.0.0.0}"
export ISSOBELLA_DB="${ISSOBELLA_DB:-$DATA_DIR/issobella.db}"

EXE="$(find_exe zion-issobella)" || { zlog "[ERROR] zion-issobella not built."; exit 1; }
start_bg "issobella" "$EXE" >/dev/null
zlog "Issobella -> http://localhost:$ISSOBELLA_PORT"
