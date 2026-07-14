#!/usr/bin/env bash
# E2E test for miner stats API endpoints
# Usage: ./scripts/e2e-miner-stats.sh [BASE_URL]
set -euo pipefail

BASE_URL="${1:-https://zionterranova.com}"
TEST_MINER="zion1g5u0m3j5x5w2t730c8s4h4m5a5v4a7p6p0c07y7"
TIMEOUT=60
FAIL=0

log() { echo "[e2e] $*"; }
assert_ok() {
  local field="$1"; local val="$2"; local label="$3"
  if [[ -z "$val" || "$val" == "null" ]]; then
    log "FAIL: $label is missing/null"; FAIL=1
  else
    log "OK: $label = $val"
  fi
}
assert_positive() {
  local val="$1"; local label="$2"
  if [[ -n "$val" && "$val" != "null" && "$val" -gt 0 ]]; then
    log "OK: $label is positive ($val)"
  else
    log "FAIL: $label is not positive ($val)"; FAIL=1
  fi
}
warn_if_null() {
  local val="$1"; local label="$2"; local note="$3"
  if [[ -z "$val" || "$val" == "null" || "$val" == "0" ]]; then
    log "WARN: $label is missing/empty ($val) — $note"
  else
    log "OK: $label = $val"
  fi
}

log "Testing base URL: $BASE_URL"

# 1. Health check
log "--- /api/health ---"
health=$(curl -sS -m ${TIMEOUT} "${BASE_URL}/api/health")
echo "$health" | python3 -m json.tool
if echo "$health" | grep -q '"status":"ok"'; then
  log "OK: health check"
else
  log "FAIL: health check"; FAIL=1
fi

# 2. Pool stats
log "--- /api/pool/stats ---"
pool_stats=$(curl -sS -m ${TIMEOUT} "${BASE_URL}/api/pool/stats")
echo "$pool_stats" | python3 -m json.tool
ok=$(echo "$pool_stats" | python3 -c "import sys,json; print(json.load(sys.stdin).get('ok',''))")
if [[ "$ok" == "True" ]]; then
  log "OK: pool/stats"
else
  log "FAIL: pool/stats"; FAIL=1
fi

# 3. Miner stats by address
log "--- /api/pool/miner/${TEST_MINER} ---"
miner_stats=$(curl -sS -m ${TIMEOUT} "${BASE_URL}/api/pool/miner/${TEST_MINER}")
echo "$miner_stats" | python3 -m json.tool
ok=$(echo "$miner_stats" | python3 -c "import sys,json; print(json.load(sys.stdin).get('ok',''))")
address=$(echo "$miner_stats" | python3 -c "import sys,json; print(json.load(sys.stdin).get('address',''))" || true)
worker=$(echo "$miner_stats" | python3 -c "import sys,json; print(json.load(sys.stdin).get('worker_name',''))" || true)
blocks=$(echo "$miner_stats" | python3 -c "import sys,json; print(json.load(sys.stdin).get('stats',{}).get('blocks_found',''))" || true)
total_paid=$(echo "$miner_stats" | python3 -c "import sys,json; print(json.load(sys.stdin).get('stats',{}).get('total_paid',''))" || true)
if [[ "$ok" == "True" && "$address" == "$TEST_MINER" ]]; then
  log "OK: miner stats address match"
else
  log "FAIL: miner stats"; FAIL=1
fi
assert_positive "$total_paid" "stats.total_paid"
warn_if_null "$worker" "worker_name" "pool does not expose worker name for external payout address"
warn_if_null "$blocks" "blocks_found" "pool does not expose blocks_found for external payout address"

# 4. Blockchain address (payouts and balance)
log "--- /api/blockchain/address?addr=${TEST_MINER} ---"
addr_data=$(curl -sS -m ${TIMEOUT} "${BASE_URL}/api/blockchain/address?addr=${TEST_MINER}")
addr=$(echo "$addr_data" | python3 -c "import sys,json; print(json.load(sys.stdin).get('address',''))" || true)
is_miner=$(echo "$addr_data" | python3 -c "import sys,json; print(json.load(sys.stdin).get('is_miner',''))" || true)
if [[ "$addr" == "$TEST_MINER" && "$is_miner" == "True" ]]; then
  log "OK: blockchain address is_miner"
else
  log "FAIL: blockchain address"; FAIL=1
fi

# 5. Miner metrics
log "--- /api/pool/miner/${TEST_MINER}/metrics ---"
miner_metrics=$(curl -sS -m ${TIMEOUT} "${BASE_URL}/api/pool/miner/${TEST_MINER}/metrics")
echo "$miner_metrics" | python3 -m json.tool
metrics_ok=$(echo "$miner_metrics" | python3 -c "import sys,json; print(json.load(sys.stdin).get('ok',''))" || true)
metrics_hashrate=$(echo "$miner_metrics" | python3 -c "import sys,json; print(json.load(sys.stdin).get('metrics',{}).get('hashrate',''))" || true)
metrics_blocks=$(echo "$miner_metrics" | python3 -c "import sys,json; print(json.load(sys.stdin).get('metrics',{}).get('blocks_found',''))" || true)
if [[ "$metrics_ok" == "True" ]]; then
  log "OK: miner metrics returned"
else
  log "FAIL: miner metrics"; FAIL=1
fi
warn_if_null "$metrics_hashrate" "metrics.hashrate" "pool does not expose hashrate for external payout address"
warn_if_null "$metrics_blocks" "metrics.blocks_found" "pool does not expose blocks_found for external payout address"

# 6. Miner page returns HTML with expected amount formatting
log "--- /pool/miner/${TEST_MINER} ---"
page=$(curl -sS -m ${TIMEOUT} "${BASE_URL}/pool/miner/${TEST_MINER}")
if echo "$page" | grep -q "blocks_found\|worker_name\|${TEST_MINER}"; then
  log "OK: miner page rendered"
else
  log "FAIL: miner page did not render expected content"; FAIL=1
fi

if [[ "$FAIL" -eq 0 ]]; then
  log "All E2E checks passed"
  exit 0
else
  log "Some E2E checks failed"
  exit 1
fi
