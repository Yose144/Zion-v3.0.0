#!/usr/bin/env bash
# ZION V3 — Stop Mining Pool
set -uo pipefail
source "$(dirname "$0")/_lib.sh"
stop_pidfile "pool" "pool" || true
stop_match 'V3/target/release/server' "pool"
stop_match 'V3/target/debug/server' "pool(debug)"
