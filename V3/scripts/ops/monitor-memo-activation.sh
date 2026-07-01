#!/usr/bin/env bash
# Monitor ZION account-model memo v1 hard fork activation height.
# Logs to stdout and can be used with a systemd timer to notify when ready.
#
# Usage: ZION_ACCOUNT_TX_MEMO_V1_HEIGHT=24000 ZION_NODE_RPC=http://127.0.0.1:8443 \
#          ./V3/scripts/ops/monitor-memo-activation.sh

set -uo pipefail

RPC="${ZION_NODE_RPC:-http://127.0.0.1:8443}"
ACTIVATION_HEIGHT="${ZION_ACCOUNT_TX_MEMO_V1_HEIGHT:-24000}"
LOG_FILE="${ZION_ACTIVATION_LOG:-/var/log/zion-memo-activation.log}"

log() {
  local msg="[$(date -Iseconds)] $*"
  echo "$msg"
  echo "$msg" >> "$LOG_FILE" 2>/dev/null || true
}

chain_height() {
  curl -s -X POST "$RPC" \
    -H 'Content-Type: application/json' \
    -d '{"jsonrpc":"2.0","id":1,"method":"getChainInfo","params":{}}' \
    | python3 -c 'import sys, json; print(json.load(sys.stdin)["result"]["chain_height"])' 2>/dev/null
}

h=$(chain_height)
if [ -z "$h" ]; then
  log "Could not query chain height from $RPC"
  exit 1
fi

remaining=$((ACTIVATION_HEIGHT - h))
log "Activation height: $ACTIVATION_HEIGHT | Current height: $h | Remaining: $remaining"

if [ "$h" -ge "$ACTIVATION_HEIGHT" ]; then
  log "ACTIVATION REACHED. Ready to run E2E tests: V3/scripts/ops/account-memo-e2e.sh"
  exit 0
fi

exit 1
