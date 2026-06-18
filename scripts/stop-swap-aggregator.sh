#!/usr/bin/env bash
# ZION V3 — Stop Swap Aggregator daemon
set -euo pipefail
source "$(dirname "$0")/_lib.sh"

stop_bg "swap-aggregator"
zlog "Swap Aggregator stopped"
