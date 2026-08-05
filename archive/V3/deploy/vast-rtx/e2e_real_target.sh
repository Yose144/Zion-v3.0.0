#!/bin/bash
# E2E Triple-Stream Test with REAL pool targets
# Runs each coin for 120s to find real shares

set -uo pipefail

EDGE_SSH="ssh -o StrictHostKeyChecking=no -o ConnectTimeout=30 zion-new"
VAST_SSH="ssh -o StrictHostKeyChecking=no -o ConnectTimeout=30 -i ~/.ssh/vast_hiran_key -p 33324 root@ssh5.vast.ai"

# Test coins — focus on ones with reachable pools and fast hashrate
COINS=("KAS:kheavyhash" "ALPH:blake3" "DCR:blake3" "RVN:kawpow" "ETC:ethash" "ERG:autolykos")

RESULTS_FILE="/tmp/e2e_real_results.txt"
> "$RESULTS_FILE"

echo "=== E2E Real Target Triple-Stream Test ===" | tee -a "$RESULTS_FILE"
echo "Started at: $(date)" | tee -a "$RESULTS_FILE"
echo "NO EASY TARGET — real pool difficulty" | tee -a "$RESULTS_FILE"
echo "" | tee -a "$RESULTS_FILE"

for ENTRY in "${COINS[@]}"; do
    COIN="${ENTRY%%:*}"
    ALGO="${ENTRY##*:}"

    echo "========================================" | tee -a "$RESULTS_FILE"
    echo "Testing: $COIN ($ALGO) — 120s" | tee -a "$RESULTS_FILE"
    echo "========================================" | tee -a "$RESULTS_FILE"

    # 1. Kill existing pool
    $EDGE_SSH 'pkill -9 -f "target/release/server" 2>/dev/null; sleep 3; ss -tlnp | grep 8444 || echo "port free"' || true

    # 2. Start pool with real targets
    $EDGE_SSH "nohup bash /tmp/pool_real_target.sh $COIN > /tmp/pool_real_${COIN}.log 2>&1 & echo PID=\$!" || true

    # 3. Wait for pool to start and connect to external pool
    echo "Waiting 15s for pool + bridge to connect..."
    sleep 15

    # 4. Check pool and bridge status
    POOL_STATUS=$($EDGE_SSH 'ss -tlnp | grep -q 8444 && echo "running" || echo "failed"' 2>/dev/null || echo "unknown")
    BRIDGE_STATUS=$($EDGE_SSH "grep -E 'auxpow_bridge.*connected|auxpow_bridge.*failed|auxpow_bridge.*error' /tmp/pool_real_${COIN}.log 2>/dev/null | tail -1" 2>/dev/null || echo "unknown")

    echo "pool=$POOL_STATUS bridge=$BRIDGE_STATUS" | tee -a "$RESULTS_FILE"

    if [ "$POOL_STATUS" != "running" ]; then
        echo "FAIL: pool did not start for $COIN" | tee -a "$RESULTS_FILE"
        continue
    fi

    # 5. Kill existing miner
    $VAST_SSH 'pkill -9 -f zion-miner 2>/dev/null; sleep 2' || true

    # 6. Run miner for 120 seconds
    echo "Running miner for 120s..."
    $VAST_SSH "timeout 125 bash -c 'source ~/.cargo/env 2>/dev/null; ZION_GPU_WORK_SIZE=8192 ZION_AUTOTUNE=0 ZION_NO_TUI=1 RUST_LOG=info /root/repo/V3/target/release/zion-miner --pool 62.171.141.136:8444 --wallet zion1s6m204400290l660k622r3r0c6u040g5j6cu2x5 --worker vast-rtx3090 --algorithm deeksha_lite_fire --gpu cuda --loops 500 --no-tui' > /tmp/miner_real_${COIN}.log 2>&1" || true

    # 7. Collect miner results
    GPU_SHARES=$($VAST_SSH "grep -c 'ext_gpu_share_found' /tmp/miner_real_${COIN}.log 2>/dev/null || echo 0" 2>/dev/null || echo 0)
    CPU_SHARES=$($VAST_SSH "grep -c 'VRSC_SHARE_FOUND\|ext_cpu_share' /tmp/miner_real_${COIN}.log 2>/dev/null || echo 0" 2>/dev/null || echo 0)

    # 8. Collect pool results — check for ACCEPTED shares
    EXT_ACCEPTED=$($EDGE_SSH "grep -c 'external_share_result.*$COIN.*accepted=true' /tmp/pool_real_${COIN}.log 2>/dev/null || echo 0" 2>/dev/null || echo 0)
    EXT_REJECTED=$($EDGE_SSH "grep -c 'external_share_result.*$COIN.*accepted=false' /tmp/pool_real_${COIN}.log 2>/dev/null || echo 0" 2>/dev/null || echo 0)
    VRSC_ACCEPTED=$($EDGE_SSH "grep -c 'external_share_result.*VRSC.*accepted=true' /tmp/pool_real_${COIN}.log 2>/dev/null || echo 0" 2>/dev/null || echo 0)
    VRSC_REJECTED=$($EDGE_SSH "grep -c 'external_share_result.*VRSC.*accepted=false' /tmp/pool_real_${COIN}.log 2>/dev/null || echo 0" 2>/dev/null || echo 0)

    # Show rejection reasons
    REJECT_REASONS=$($EDGE_SSH "grep 'external_share_result.*$COIN.*accepted=false' /tmp/pool_real_${COIN}.log 2>/dev/null | sed 's/.*status=//' | sort | uniq -c | sort -rn | head -3" 2>/dev/null || echo "none")

    echo "coin=$COIN algo=$ALGO" | tee -a "$RESULTS_FILE"
    echo "  gpu_shares_found: $GPU_SHARES" | tee -a "$RESULTS_FILE"
    echo "  cpu_shares_found: $CPU_SHARES (VRSC)" | tee -a "$RESULTS_FILE"
    echo "  EXT ACCEPTED: $EXT_ACCEPTED | REJECTED: $EXT_REJECTED" | tee -a "$RESULTS_FILE"
    echo "  VRSC ACCEPTED: $VRSC_ACCEPTED | REJECTED: $VRSC_REJECTED" | tee -a "$RESULTS_FILE"
    echo "  reject_reasons: $REJECT_REASONS" | tee -a "$RESULTS_FILE"

    if [ "$EXT_ACCEPTED" -gt 0 ]; then
        echo "  status=PASS (real shares accepted!)" | tee -a "$RESULTS_FILE"
    else
        echo "  status=NO_ACCEPT (shares found but not accepted by external pool)" | tee -a "$RESULTS_FILE"
    fi

    echo "" | tee -a "$RESULTS_FILE"
done

# Cleanup
$EDGE_SSH 'pkill -9 -f "target/release/server" 2>/dev/null' || true
$VAST_SSH 'pkill -9 -f zion-miner 2>/dev/null' || true

# Restore original pool
$EDGE_SSH 'systemctl start zion-edge-pool 2>/dev/null' || true

echo "=== E2E Real Target Test Complete ===" | tee -a "$RESULTS_FILE"
echo "Finished at: $(date)" | tee -a "$RESULTS_FILE"
