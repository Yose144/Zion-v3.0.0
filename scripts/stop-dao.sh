#!/usr/bin/env bash
set -uo pipefail
source "$(dirname "$0")/_lib.sh"
stop_pidfile "dao" "dao" || true
stop_match 'zion-dao' "dao"
