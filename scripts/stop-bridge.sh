#!/usr/bin/env bash
set -uo pipefail
source "$(dirname "$0")/_lib.sh"
stop_pidfile "bridge" "bridge" || true
stop_match 'zion-bridge' "bridge"
