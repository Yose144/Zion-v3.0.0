#!/usr/bin/env bash
# ZION V3 — Start Pool with log redirect
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$REPO_ROOT/logs"
mkdir -p "$LOG_DIR"

export ZION_POOL_BIND='0.0.0.0:8444'
export ZION_NODE_RPC_ADDR='127.0.0.1:8443'
export ZION_POOL_LOOP_COUNT='1000000'
export ZION_MAX_SESSIONS_PER_IP='10'
export ZION_POOL_WALLET='zion182e2v4x4r3u2j5r5t305k0d5y643q6l3n6je5f8'
export ZION_POOL_PAYOUT_SK_HEX='b8d7341c97b9402b67ad2a961ef055c66e3b7fb2568cf48cc78f7b1ffd2098d0'
export ZION_NONCE_COUNT='4096'

POOL_EXE="$REPO_ROOT/V3/target/release/server"
if [[ ! -x "$POOL_EXE" ]]; then
    echo "[ERROR] Pool binary not found: $POOL_EXE"
    echo "        Run Install / Build first."
    exit 1
fi

nohup "$POOL_EXE" > "$LOG_DIR/pool.log" 2> "$LOG_DIR/pool.err" &
echo "Started Pool   PID=$!"
