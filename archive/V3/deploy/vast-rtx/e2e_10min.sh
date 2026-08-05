#!/bin/bash
# E2E 10-minute test with REAL pool targets
# Tests: KAS, ALPH, ETC, RVN (NiceHash + 2miners)
# 10 minutes per coin to find real shares

set -uo pipefail

EDGE_SSH="ssh -o StrictHostKeyChecking=no -o ConnectTimeout=30 zion-new"
VAST_SSH="ssh -o StrictHostKeyChecking=no -o ConnectTimeout=30 -i ~/.ssh/vast_hiran_key -p 33324 root@ssh5.vast.ai"

# Test coins with pool preference: COIN:ALGO:POOL_PREF
# RVN-NH = NiceHash (test nonce fix), RVN-2M = 2miners (standard)
COINS=("KAS:kheavyhash:default" "ALPH:blake3:default" "ETC:ethash:default" "RVN:kawpow:nicehash" "RVN:kawpow:default")

RESULTS_FILE="/tmp/e2e_10min_results.txt"
> "$RESULTS_FILE"

echo "=== E2E 10min Real Target Test ===" | tee -a "$RESULTS_FILE"
echo "Started at: $(date)" | tee -a "$RESULTS_FILE"
echo "" | tee -a "$RESULTS_FILE"

for ENTRY in "${COINS[@]}"; do
    COIN="${ENTRY%%:*}"
    REST="${ENTRY#*:}"
    ALGO="${REST%%:*}"
    POOL_PREF="${REST##*:}"
    LABEL="${COIN}_${POOL_PREF}"

    echo "========================================" | tee -a "$RESULTS_FILE"
    echo "Testing: $COIN ($ALGO) pool=$POOL_PREF — 600s" | tee -a "$RESULTS_FILE"
    echo "========================================" | tee -a "$RESULTS_FILE"

    # 1. Kill existing pool
    $EDGE_SSH 'pkill -9 -f "target/release/server" 2>/dev/null; sleep 3; ss -tlnp | grep 8444 || echo "port free"' || true

    # 2. Start pool with real targets and specified pool preference
    $EDGE_SSH "export ZION_POOL_AUXPOW_POOL_PREFERENCE=$POOL_PREF; nohup bash /tmp/pool_real_target.sh $COIN > /tmp/pool_10min_${LABEL}.log 2>&1 & echo PID=\$!" || true

    # 3. Wait for pool to start and bridge to connect
    echo "Waiting 15s for pool + bridge..."
    sleep 15

    # 4. Check pool and bridge status
    POOL_STATUS=$($EDGE_SSH 'ss -tlnp | grep -q 8444 && echo "running" || echo "failed"' 2>/dev/null || echo "unknown")
    BRIDGE_STATUS=$($EDGE_SSH "grep -E 'auxpow_bridge.*(connected|failed|error)' /tmp/pool_10min_${LABEL}.log 2>/dev/null | tail -1" 2>/dev/null || echo "unknown")

    echo "pool=$POOL_STATUS bridge=$BRIDGE_STATUS" | tee -a "$RESULTS_FILE"

    if [ "$POOL_STATUS" != "running" ]; then
        echo "FAIL: pool did not start for $LABEL" | tee -a "$RESULTS_FILE"
        continue
    fi

    # 5. Kill existing miner
    $VAST_SSH 'pkill -9 -f zion-miner 2>/dev/null; sleep 2' || true

    # 6. Run miner for 600 seconds (10 min)
    echo "Running miner for 600s (10 min)..."
    $VAST_SSH "timeout 605 bash -c 'source ~/.cargo/env 2>/dev/null; ZION_GPU_WORK_SIZE=8192 ZION_AUTOTUNE=0 ZION_NO_TUI=1 RUST_LOG=info /root/repo/V3/target/release/zion-miner --pool 62.171.141.136:8444 --wallet zion1s6m204400290l660k622r3r0c6u040g5j6cu2x5 --worker vast-rtx3090 --algorithm deeksha_lite_fire --gpu cuda --loops 5000 --no-tui' > /tmp/miner_10min_${LABEL}.log 2>&1" || true

    # 7. Collect miner results
    GPU_SHARES=$($VAST_SSH "grep -c 'ext_gpu_share_found' /tmp/miner_10min_${LABEL}.log 2>/dev/null || echo 0" 2>/dev/null || echo 0)
    CPU_SHARES=$($VAST_SSH "grep -c 'VRSC_SHARE_FOUND\|ext_cpu_share' /tmp/miner_10min_${LABEL}.log 2>/dev/null || echo 0" 2>/dev/null || echo 0)
    NH_NONCE=$($VAST_SSH "grep 'ext_gpu_nicehash_nonce' /tmp/miner_10min_${LABEL}.log 2>/dev/null | head -1" 2>/dev/null || echo "")

    # 8. Collect pool results
    EXT_ACCEPTED=$($EDGE_SSH "grep -c 'external_share_result.*${COIN}.*accepted=true' /tmp/pool_10min_${LABEL}.log 2>/dev/null || echo 0" 2>/dev/null || echo 0)
    EXT_REJECTED=$($EDGE_SSH "grep -c 'external_share_result.*${COIN}.*accepted=false' /tmp/pool_10min_${LABEL}.log 2>/dev/null || echo 0" 2>/dev/null || echo 0)
    VRSC_ACCEPTED=$($EDGE_SSH "grep -c 'external_share_result.*VRSC.*accepted=true' /tmp/pool_10min_${LABEL}.log 2>/dev/null || echo 0" 2>/dev/null || echo 0)

    # Show rejection reasons
    REJECT_REASONS=$($EDGE_SSH "grep 'external_share_result.*${COIN}.*accepted=false' /tmp/pool_10min_${LABEL}.log 2>/dev/null | sed 's/.*status=//' | sort | uniq -c | sort -rn | head -3" 2>/dev/null || echo "none")

    echo "coin=$COIN algo=$ALGO pool=$POOL_PREF" | tee -a "$RESULTS_FILE"
    echo "  gpu_shares_found: $GPU_SHARES" | tee -a "$RESULTS_FILE"
    echo "  cpu_shares_found: $CPU_SHARES (VRSC)" | tee -a "$RESULTS_FILE"
    if [ -n "$NH_NONCE" ]; then
        echo "  nicehash_nonce: $NH_NONCE" | tee -a "$RESULTS_FILE"
    fi
    echo "  EXT ACCEPTED: $EXT_ACCEPTED | REJECTED: $EXT_REJECTED" | tee -a "$RESULTS_FILE"
    echo "  VRSC ACCEPTED: $VRSC_ACCEPTED" | tee -a "$RESULTS_FILE"
    echo "  reject_reasons: $REJECT_REASONS" | tee -a "$RESULTS_FILE"

    if [ "$EXT_ACCEPTED" -gt 0 ]; then
        echo "  status=PASS (real shares accepted by external pool!)" | tee -a "$RESULTS_FILE"
    elif [ "$GPU_SHARES" -gt 0 ]; then
        echo "  status=FOUND_BUT_REJECTED (shares found, pool rejected)" | tee -a "$RESULTS_FILE"
    else
        echo "  status=NO_SHARES (no shares found in 10min — difficulty too high)" | tee -a "$RESULTS_FILE"
    fi

    echo "" | tee -a "$RESULTS_FILE"
done

# Cleanup
$EDGE_SSH 'pkill -9 -f "target/release/server" 2>/dev/null' || true
$VAST_SSH 'pkill -9 -f zion-miner 2>/dev/null' || true

# Restore original pool
$EDGE_SSH 'systemctl start zion-edge-pool 2>/dev/null' || true

echo "=== E2E 10min Test Complete ===" | tee -a "$RESULTS_FILE"
echo "Finished at: $(date)" | tee -a "$RESULTS_FILE"
