#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# E2E Trinity Test — cycles through all GPU coins
#
# Architecture:
#   - Pool server runs on Edge (zion-new / 62.171.141.136:8444)
#   - Miner runs on Vast.ai (ssh5.vast.ai:33324, RTX 3090)
#
# Usage: bash e2e_test_all.sh
# ═══════════════════════════════════════════════════════════════

set -uo pipefail

EDGE_SSH="ssh -o StrictHostKeyChecking=no -o ConnectTimeout=30 zion-new"
VAST_SSH="ssh -o StrictHostKeyChecking=no -o ConnectTimeout=30 -i ~/.ssh/vast_hiran_key -p 33324 root@ssh5.vast.ai"

# Coins to test with their algorithms
COINS=("KAS:kheavyhash" "ALPH:blake3" "DCR:blake3" "ERG:autolykos" "RVN:kawpow" "ETC:ethash" "FLUX:zelhash" "CLORE:kawpow")

RESULTS_FILE="/tmp/e2e_results.txt"
> "$RESULTS_FILE"

echo "=== E2E Trinity Test ===" | tee -a "$RESULTS_FILE"
echo "Started at: $(date)" | tee -a "$RESULTS_FILE"
echo "" | tee -a "$RESULTS_FILE"

for ENTRY in "${COINS[@]}"; do
    COIN="${ENTRY%%:*}"
    ALGO="${ENTRY##*:}"

    echo "========================================" | tee -a "$RESULTS_FILE"
    echo "Testing: $COIN ($ALGO)" | tee -a "$RESULTS_FILE"
    echo "========================================" | tee -a "$RESULTS_FILE"

    # 1. Kill existing pool on Edge
    $EDGE_SSH 'pkill -9 -f "target/release/server" 2>/dev/null; sleep 3; ss -tlnp | grep 8444 && echo "PORT STILL IN USE" || echo "port free"' || true

    # 2. Start pool with this coin on Edge
    $EDGE_SSH "nohup bash /tmp/pool_cycle.sh $COIN > /tmp/pool_${COIN}.log 2>&1 & echo PID=\$!" || true

    # 3. Wait for pool to start
    echo "Waiting 12s for pool to start..."
    sleep 12

    # 4. Check pool is running
    POOL_STATUS=$($EDGE_SSH 'ss -tlnp | grep -q 8444 && echo "running" || echo "failed"')
    if [ "$POOL_STATUS" != "running" ]; then
        echo "FAIL: pool did not start for $COIN" | tee -a "$RESULTS_FILE"
        $EDGE_SSH "tail -5 /tmp/pool_${COIN}.log 2>/dev/null" | tee -a "$RESULTS_FILE"
        echo "" | tee -a "$RESULTS_FILE"
        continue
    fi
    echo "Pool started OK for $COIN" | tee -a "$RESULTS_FILE"

    # 5. Kill any existing miner on Vast.ai
    $VAST_SSH 'pkill -9 -f zion-miner 2>/dev/null; sleep 2' || true

    # 6. Run miner for 30 seconds on Vast.ai
    echo "Running miner for 30s..."
    $VAST_SSH "timeout 35 bash -c 'source ~/.cargo/env 2>/dev/null; ZION_GPU_WORK_SIZE=8192 ZION_AUTOTUNE=0 ZION_NO_TUI=1 RUST_LOG=info /root/repo/V3/target/release/zion-miner --pool 62.171.141.136:8444 --wallet zion1s6m204400290l660k622r3r0c6u040g5j6cu2x5 --worker vast-rtx3090 --algorithm deeksha_lite_fire --gpu cuda --loops 100 --no-tui' > /tmp/miner_${COIN}.log 2>&1" || true

    # 7. Collect results from miner
    GPU_SHARES=$($VAST_SSH "grep -c 'ext_gpu_share_found' /tmp/miner_${COIN}.log 2>/dev/null || echo 0" 2>/dev/null || echo 0 | tail -1)
    CPU_SHARES=$($VAST_SSH "grep -c 'VRSC_SHARE_FOUND\|ext_cpu_share' /tmp/miner_${COIN}.log 2>/dev/null || echo 0" 2>/dev/null || echo 0 | tail -1)
    GPU_ERRORS=$($VAST_SSH "grep -c 'ext_gpu.*error\|kernel.*fail\|launch.*fail\|init_failed' /tmp/miner_${COIN}.log 2>/dev/null || echo 0" 2>/dev/null || echo 0 | tail -1)
    GPU_INIT=$($VAST_SSH "grep 'gpu_cuda_ext_init\|gpu_cuda_init\|gpu_init' /tmp/miner_${COIN}.log 2>/dev/null | head -1" 2>/dev/null || echo "")

    # 8. Collect results from pool
    POOL_EXT_SHARES=$($EDGE_SSH "grep -c 'external_share_received.*$COIN' /tmp/pool_${COIN}.log 2>/dev/null || echo 0" 2>/dev/null || echo 0 | tail -1)
    POOL_BRIDGE=$($EDGE_SSH "grep 'auxpow_bridge.*$COIN' /tmp/pool_${COIN}.log 2>/dev/null | head -3" 2>/dev/null || echo "")

    echo "coin=$COIN algo=$ALGO" | tee -a "$RESULTS_FILE"
    echo "  gpu_init: $GPU_INIT" | tee -a "$RESULTS_FILE"
    echo "  gpu_shares_found: $GPU_SHARES" | tee -a "$RESULTS_FILE"
    echo "  cpu_shares_found: $CPU_SHARES (VRSC)" | tee -a "$RESULTS_FILE"
    echo "  gpu_errors: $GPU_ERRORS" | tee -a "$RESULTS_FILE"
    echo "  pool_ext_shares_received: $POOL_EXT_SHARES" | tee -a "$RESULTS_FILE"
    if [ -n "$POOL_BRIDGE" ]; then
        echo "  pool_bridge: $POOL_BRIDGE" | tee -a "$RESULTS_FILE"
    fi

    if [ "$GPU_SHARES" -gt 0 ]; then
        echo "  status=PASS" | tee -a "$RESULTS_FILE"
    elif [ "$GPU_ERRORS" -gt 0 ]; then
        echo "  status=FAIL (GPU errors)" | tee -a "$RESULTS_FILE"
        $VAST_SSH "grep -i 'error\|fail' /tmp/miner_${COIN}.log 2>/dev/null | head -5" | tee -a "$RESULTS_FILE"
    else
        echo "  status=WARN (no shares — may need more time or target too hard)" | tee -a "$RESULTS_FILE"
    fi

    echo "" | tee -a "$RESULTS_FILE"
done

# Cleanup
$EDGE_SSH 'pkill -9 -f "target/release/server" 2>/dev/null' || true
$VAST_SSH 'pkill -9 -f zion-miner 2>/dev/null' || true

echo "=== E2E Test Complete ===" | tee -a "$RESULTS_FILE"
echo "Finished at: $(date)" | tee -a "$RESULTS_FILE"
