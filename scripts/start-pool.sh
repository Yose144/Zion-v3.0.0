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
# WARNING: ZION_POOL_WALLET and ZION_POOL_PAYOUT_SK_HEX must be a matched pair.
# The SK_HEX below corresponds to the OLD pool wallet. Update both together.
export ZION_POOL_WALLET='zion16825y2v5f3q507e5c2e0j8n666z43558l3zt604'
export ZION_POOL_PAYOUT_SK_HEX='<SET_VIA_SECURE_ENVIRONMENT_DO_NOT_COMMIT>'
export ZION_NONCE_COUNT='4096'
export ZION_VARDIFF_START_DIFF='1'
export ZION_VARDIFF_MAX_DIFF='1000000'

POOL_EXE="$REPO_ROOT/V3/target/release/server"
if [[ ! -x "$POOL_EXE" ]]; then
    echo "[ERROR] Pool binary not found: $POOL_EXE"
    echo "        Run Install / Build first."
    exit 1
fi

nohup "$POOL_EXE" > "$LOG_DIR/pool.log" 2> "$LOG_DIR/pool.err" &
echo $! > "$LOG_DIR/pool.pid"
echo "Started Pool   PID=$!"
