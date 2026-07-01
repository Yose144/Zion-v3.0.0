#!/usr/bin/env bash
# E2E test for account-model memo v1 hard fork.
# Polls the Edge L1 node until chain_height >= ZION_ACCOUNT_TX_MEMO_V1_HEIGHT,
# then sends three account transactions with memos and verifies the watchers
# detect them.
#
# Required environment variables (set in a systemd drop-in or sourced env file):
#   ZION_E2E_WALLET_FILE      - path to wallet JSON (must match the funded address)
#   ZION_E2E_PASSWORD_ENV      - name of the env var holding the wallet password
#   ZION_E2E_EVM_ADDRESS      - counterparty EVM address for bridge/swap memos
#   ZION_E2E_BRIDGE_VAULT     - bridge vault zion1... address (default: API lookup)
#   ZION_E2E_DAO_ADDRESS      - DAO treasury zion1... address (default: API lookup)
#   ZION_E2E_SWAP_ESCROW     - atomic swap escrow zion1... address (default: API lookup)
#   ZION_NODE_RPC             - L1 node RPC, default http://127.0.0.1:8443
#   ZION_ACCOUNT_TX_MEMO_V1_HEIGHT - activation height (default: 24000)
#
# Usage (run on Edge after deploy):
#   export ZION_E2E_PASSWORD="..."
#   ZION_E2E_WALLET_FILE=/root/...json \
#   ZION_E2E_PASSWORD_ENV=ZION_E2E_PASSWORD \
#   ZION_E2E_EVM_ADDRESS=0x... \
#     ./V3/scripts/ops/account-memo-e2e.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
RPC="${ZION_NODE_RPC:-http://127.0.0.1:8443}"
ACTIVATION_HEIGHT="${ZION_ACCOUNT_TX_MEMO_V1_HEIGHT:-24000}"
CLI="${ROOT}/V3/target/release/zion"
BRIDGE_API="${ZION_BRIDGE_API:-http://127.0.0.1:8451}"
DAO_API="${ZION_DAO_API:-http://127.0.0.1:8450}"
SWAP_API="${ZION_SWAP_API:-http://127.0.0.1:8452}"

log() { echo "[$(date -Iseconds)] $*"; }

fail() { log "ERROR: $*"; exit 1; }

require_env() {
  local var="$1"
  [ -n "${!var:-}" ] || fail "$var is not set"
}

chain_height() {
  curl -s -X POST "$RPC" \
    -H 'Content-Type: application/json' \
    -d '{"jsonrpc":"2.0","id":1,"method":"getChainInfo","params":{}}' \
    | python3 -c 'import sys, json; print(json.load(sys.stdin)["result"]["chain_height"])'
}

wait_for_activation() {
  log "Waiting for activation height $ACTIVATION_HEIGHT..."
  while true; do
    local h
    h=$(chain_height) || { sleep 10; continue; }
    log "Current height: $h"
    if [ "$h" -ge "$ACTIVATION_HEIGHT" ]; then
      log "Activation height reached!"
      break
    fi
    sleep 30
  done
}

send_account_tx() {
  local to="$1"
  local memo="$2"
  local amount="${3:-1}"
  # fee is fixed by the CLI at MIN_TX_FEE

  log "Sending account TX: to=$to memo=$memo amount=$amount"
  "$CLI" wallet send \
    --to "$to" \
    --amount "$amount" \
    --memo "$memo" \
    --wallet "$ZION_E2E_WALLET_FILE" \
    --password-env "$ZION_E2E_PASSWORD_ENV" \
    --node-rpc "$RPC"
}

# --- Resolve target addresses from services if not provided ---

if [ -z "${ZION_E2E_BRIDGE_VAULT:-}" ]; then
  ZION_E2E_BRIDGE_VAULT=$(curl -s "$BRIDGE_API/api/bridge/vault-address" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("address",""))' 2>/dev/null || true)
fi
if [ -z "${ZION_E2E_DAO_ADDRESS:-}" ]; then
  ZION_E2E_DAO_ADDRESS=$(curl -s "$DAO_API/api/dao/config" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("treasury_address",""))' 2>/dev/null || true)
fi
if [ -z "${ZION_E2E_SWAP_ESCROW:-}" ]; then
  ZION_E2E_SWAP_ESCROW=$(curl -s "$SWAP_API/swap/escrow-address" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("address",""))' 2>/dev/null || true)
fi

require_env ZION_E2E_WALLET_FILE
require_env ZION_E2E_PASSWORD_ENV
require_env ZION_E2E_EVM_ADDRESS

[ -n "$ZION_E2E_BRIDGE_VAULT" ] || fail "Could not resolve bridge vault address"
[ -n "$ZION_E2E_DAO_ADDRESS" ] || fail "Could not resolve DAO treasury address"
[ -n "$ZION_E2E_SWAP_ESCROW" ] || fail "Could not resolve atomic swap escrow address"

# --- Precompute hashlock for atomic swap test ---
PREIMAGE=$(openssl rand -hex 32)
HASHLOCK=$(printf "%s" "$PREIMAGE" | xxd -r -p | sha256sum | cut -d' ' -f1)

wait_for_activation

log "=== Test 1/3: Bridge lock (account model) ==="
SEND_BRIDGE=$(send_account_tx "$ZION_E2E_BRIDGE_VAULT" "BRIDGE:base:$ZION_E2E_EVM_ADDRESS" 1 0.01)
log "Bridge TX submitted: $SEND_BRIDGE"

log "=== Test 2/3: DAO vote (account model) ==="
SEND_DAO=$(send_account_tx "$ZION_E2E_DAO_ADDRESS" "DAO:vote:1:yes" 1 0.01)
log "DAO TX submitted: $SEND_DAO"

log "=== Test 3/3: Atomic swap lock (account model) ==="
SEND_SWAP=$(send_account_tx "$ZION_E2E_SWAP_ESCROW" "SWAP:LOCK:$HASHLOCK:120:base:$ZION_E2E_EVM_ADDRESS" 1 0.01)
log "Atomic swap LOCK TX submitted: $SEND_SWAP"

log "Waiting 60s for watchers to detect memos..."
sleep 60

# --- Verify watchers detected the transactions ---
log "=== Verification ==="

log "Bridge locks:"
curl -s "$BRIDGE_API/api/bridge/locks" | python3 -m json.tool | head -50 || true

log "DAO proposal 1 votes:"
curl -s "$DAO_API/api/dao/proposals/1" | python3 -m json.tool || true

log "Atomic swap $HASHLOCK:"
curl -s "$SWAP_API/swap/$HASHLOCK" | python3 -m json.tool || true

log "E2E test sequence complete. Inspect watcher APIs above for confirmation."
