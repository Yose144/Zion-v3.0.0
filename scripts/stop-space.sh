#!/usr/bin/env bash
set -uo pipefail
source "$(dirname "$0")/_lib.sh"
stop_pidfile "issobella" "issobella" || true
stop_match 'zion-issobella' "issobella"
