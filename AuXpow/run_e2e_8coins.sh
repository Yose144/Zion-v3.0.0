#!/bin/bash
# E2E connect/auth/notify test for 8 new GPU-mineable coins
# Tests stratum protocol layer: connect, subscribe, authorize, receive job
set -uo pipefail

BIN="/home/zionserver/2.9.6-main/target/release/examples/e2e_pool_test"
WALLET="bc1q9c06f4wpf638xp2280j07qgdrpz0sdms7peqkh"
RESULTS_DIR="/tmp/e2e_results"
mkdir -p "$RESULTS_DIR"

# Coin configs: coin|password|pool
COINS=(
  "ZCL|c=BTC|equihash192.eu.mine.zpool.ca:2144"
  "VTC|c=BTC|verthash.eu.mine.zpool.ca:4533"
  "QTC|x|qtc.suprnova.cc:5555"
  "RTM|c=BTC|ghostrider.eu.mine.zpool.ca:5354"
  "IRON|x|fr.grandpool.io:2027"
  "KLS|x|karlsencoin.cedric-crispin.com:4154"
  "NEXA|x|nexa.2miners.com:5050"
  "DNX|x|pool.deepminerz.com:3333"
)

echo "============================================"
echo "  E2E Test: 8 New GPU-Mineable Coins"
echo "  Phase: connect / auth / notify"
echo "============================================"
echo ""

PASS=0
FAIL=0
RESULTS=()

for entry in "${COINS[@]}"; do
  IFS='|' read -r COIN PASSWD POOL <<< "$entry"
  LOG="$RESULTS_DIR/${COIN}.log"
  echo "--- Testing $COIN ($POOL) ---"

  # Run with 30s job timeout, no mining, no submit
  timeout 45 env \
    AUXPOW_E2E_RUN=1 \
    AUXPOW_E2E_COIN="$COIN" \
    AUXPOW_E2E_WALLET="$WALLET" \
    AUXPOW_E2E_PASSWORD="$PASSWD" \
    AUXPOW_E2E_POOL="$POOL" \
    AUXPOW_E2E_MINE_SECS=0 \
    AUXPOW_E2E_SUBMIT=0 \
    AUXPOW_E2E_JOB_TIMEOUT_MS=30000 \
    "$BIN" > "$LOG" 2>&1
  EXIT_CODE=$?

  # Check if we got a job (step 2/4)
  if grep -q "\[2/4\] Received job:" "$LOG"; then
    echo "  PASS — connect/auth/notify OK"
    # Extract job details
    grep "\[2/4\] Received job:" "$LOG" | head -1 | sed 's/^/  /'
    PASS=$((PASS + 1))
    RESULTS+=("PASS|$COIN|connect+auth+notify")
  elif grep -q "\[1/4\] Connected and authorized" "$LOG"; then
    echo "  PARTIAL — connected but no job received (timeout)"
    grep -E "\[1/4\]|timed out" "$LOG" | head -3 | sed 's/^/  /'
    FAIL=$((FAIL + 1))
    RESULTS+=("PARTIAL|$COIN|connected_no_job")
  else
    echo "  FAIL — exit=$EXIT_CODE"
    tail -5 "$LOG" | sed 's/^/  /'
    FAIL=$((FAIL + 1))
    RESULTS+=("FAIL|$COIN|exit=$EXIT_CODE")
  fi
  echo ""
done

echo "============================================"
echo "  SUMMARY: $PASS pass, $FAIL fail/partial"
echo "============================================"
echo ""
echo "Detailed results:"
for r in "${RESULTS[@]}"; do
  IFS='|' read -r STATUS COIN DETAIL <<< "$r"
  printf "  %-8s %-6s %s\n" "$STATUS" "$COIN" "$DETAIL"
done
echo ""
echo "Logs: $RESULTS_DIR/*.log"
