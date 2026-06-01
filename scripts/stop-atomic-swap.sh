#!/usr/bin/env bash
set -uo pipefail
source "$(dirname "$0")/_lib.sh"
stop_pidfile "atomic-swap" "atomic-swap" || true
stop_match 'zion-atomic-swap' "atomic-swap"
