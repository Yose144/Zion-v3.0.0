#!/usr/bin/env bash
# ZION V3 — Start Free World humanitarian daemon (L5), API on 8095
set -euo pipefail
source "$(dirname "$0")/_lib.sh"

export FREE_WORLD_PORT="${FREE_WORLD_PORT:-8095}"
export FREE_WORLD_BIND="${FREE_WORLD_BIND:-0.0.0.0}"
export FREE_WORLD_DB="${FREE_WORLD_DB:-$DATA_DIR/free_world.db}"

EXE="$(find_exe zion-free-world)" || { zlog "[ERROR] zion-free-world not built."; exit 1; }
start_bg "free-world" "$EXE" >/dev/null
zlog "Free World -> http://localhost:$FREE_WORLD_PORT"
