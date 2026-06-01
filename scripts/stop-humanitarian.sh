#!/usr/bin/env bash
set -uo pipefail
source "$(dirname "$0")/_lib.sh"
stop_pidfile "free-world" "free-world" || true
stop_match 'zion-free-world' "free-world"
