#!/usr/bin/env bash
set -uo pipefail
source "$(dirname "$0")/_lib.sh"
stop_pidfile "oasis" "oasis" || true
stop_match 'zion-oasis' "oasis"
