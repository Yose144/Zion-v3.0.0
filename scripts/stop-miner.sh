#!/usr/bin/env bash
# ZION V3 — Stop Miner
set -uo pipefail
source "$(dirname "$0")/_lib.sh"
stop_match 'V3/target/release/zion-miner' "miner"
stop_match 'V3/target/debug/zion-miner' "miner(debug)"
