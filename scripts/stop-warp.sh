#!/usr/bin/env bash
set -uo pipefail
source "$(dirname "$0")/_lib.sh"
stop_pidfile "warp" "warp" || true
stop_match 'zion-warp-server' "warp"
