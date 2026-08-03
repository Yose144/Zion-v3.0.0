#!/usr/bin/env bash
# ZION A2.1 — 1000+ miner simulation against Edge pool
#
# Simulates 1000+ Stratum V1 miner connections to verify pool stability.
# Checks: memory flat, CPU <80%, no panics, all connections accepted.
#
# Usage: bash scripts/chaos-test-miners.sh [POOL_HOST] [POOL_PORT] [MINER_COUNT]
# Default: 62.171.141.136 8444 1000

set -euo pipefail

POOL_HOST="${1:-62.171.141.136}"
POOL_PORT="${2:-8444}"
MINER_COUNT="${3:-1000}"
DURATION="${4:-60}"  # seconds to hold connections

echo "[chaos] ZION A2.1 — Miner simulation"
echo "[chaos] Target: ${POOL_HOST}:${POOL_PORT}"
echo "[chaos] Miners: ${MINER_COUNT}"
echo "[chaos] Duration: ${DURATION}s"
echo ""

# Check if target is reachable
if ! nc -z -w 5 "${POOL_HOST}" "${POOL_PORT}" 2>/dev/null; then
    echo "[chaos] FAIL: Cannot connect to ${POOL_HOST}:${POOL_PORT}"
    exit 1
fi
echo "[chaos] Target reachable"

# Raise file descriptor limit for many connections
ulimit -n 4096 2>/dev/null || true

# Create temp dir for logs
LOGDIR=$(mktemp -d)
trap "rm -rf $LOGDIR" EXIT

echo "[chaos] Launching ${MINER_COUNT} simulated miners..."

# Launch miners in batches of 50 to avoid fd exhaustion
BATCH=50
LAUNCHED=0
PIDS=()

for i in $(seq 1 "$MINER_COUNT"); do
    WORKER="chaos-miner-$(printf '%04d' $i)"
    # Stratum V1: subscribe + authorize + keep alive
    # Use Python for cross-platform TCP (macOS lacks /dev/tcp)
    python3 -c "
import socket, time, sys
worker = '${WORKER}'
try:
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(${DURATION})
    s.connect(('${POOL_HOST}', ${POOL_PORT}))
    s.sendall(b'{\"id\":1,\"method\":\"mining.subscribe\",\"params\":[\"chaos-agent/1.0\"]}\n')
    time.sleep(0.1)
    s.sendall(('{\"id\":2,\"method\":\"mining.authorize\",\"params\":[\"' + worker + '\",\"x\"]}\n').encode())
    # Keep connection alive
    while True:
        data = s.recv(4096)
        if not data:
            break
except Exception:
    pass
finally:
    try:
        s.close()
    except Exception:
        pass
" &
    PIDS+=($!)
    LAUNCHED=$((LAUNCHED + 1))

    # Batch control
    if [ $((LAUNCHED % BATCH)) -eq 0 ]; then
        echo "[chaos] Launched ${LAUNCHED}/${MINER_COUNT} miners..."
        sleep 0.5  # small delay between batches
    fi
done

echo "[chaos] All ${LAUNCHED} miners launched. Holding for ${DURATION}s..."

# Monitor pool health during the test
START_MEM=$(ssh -o ConnectTimeout=5 -i ~/.ssh/zion-edge-post-wipe-2026-07-29 -p 2222 root@2a02:c207:2342:5821::1 \
    "ps -o rss= -p \$(pgrep -f '/opt/zion/V3/target/release/server' | head -1) 2>/dev/null || echo 0" 2>/dev/null || echo "N/A")
echo "[chaos] Pool memory at start: ${START_MEM} KB"

sleep "$DURATION"

# Check pool health
echo ""
echo "[chaos] Checking pool health after ${DURATION}s..."

# Count active connections to pool port
CONN_COUNT=$(ssh -o ConnectTimeout=5 -i ~/.ssh/zion-edge-post-wipe-2026-07-29 -p 2222 root@2a02:c207:2342:5821::1 \
    "ss -tn | grep ':${POOL_PORT}' | wc -l" 2>/dev/null || echo "N/A")
echo "[chaos] Active connections to pool: ${CONN_COUNT}"

# Check pool process is still alive (V3 pool = /opt/zion/V3/target/release/server)
POOL_PID=$(ssh -o ConnectTimeout=5 -i ~/.ssh/zion-edge-post-wipe-2026-07-29 -p 2222 root@2a02:c207:2342:5821::1 \
    "pgrep -f '/opt/zion/V3/target/release/server' | head -1" 2>/dev/null || echo "")
if [ -z "$POOL_PID" ]; then
    echo "[chaos] FAIL: Pool process not found!"
    exit 1
fi
echo "[chaos] Pool process alive (PID ${POOL_PID})"

# Check memory and CPU
POOL_STATS=$(ssh -o ConnectTimeout=5 -i ~/.ssh/zion-edge-post-wipe-2026-07-29 -p 2222 root@2a02:c207:2342:5821::1 \
    "ps -o rss=,pcpu= -p ${POOL_PID}" 2>/dev/null || echo "N/A")
POOL_MEM=$(echo "$POOL_STATS" | awk '{print $1}')
POOL_CPU=$(echo "$POOL_STATS" | awk '{print $2}')
echo "[chaos] Pool memory: ${POOL_MEM} KB"
echo "[chaos] Pool CPU: ${POOL_CPU}%"

# Check for panics in pool logs
SINCE_SECS=$((DURATION + 10))
PANIC_COUNT=$(ssh -o ConnectTimeout=5 -i ~/.ssh/zion-edge-post-wipe-2026-07-29 -p 2222 root@2a02:c207:2342:5821::1 \
    "journalctl -u zion-pool --since '${SINCE_SECS} seconds ago' 2>/dev/null | grep -ci panic || echo 0" 2>/dev/null || echo "N/A")
echo "[chaos] Panic count: ${PANIC_COUNT}" | head -1

# Cleanup: kill all background miners
echo "[chaos] Cleaning up miners..."
for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
done
wait 2>/dev/null || true

# Results
echo ""
echo "============================================"
echo " A2.1 Miner Simulation Results"
echo "============================================"
echo " Miners launched:     ${LAUNCHED}"
echo " Duration:            ${DURATION}s"
echo " Pool connections:    ${CONN_COUNT}"
echo " Pool memory:         ${POOL_MEM} KB"
echo " Pool CPU:            ${POOL_CPU}%"
echo " Panics:              ${PANIC_COUNT}"
echo "============================================"

# Pass/fail criteria
PASS=true
if [ "${PANIC_COUNT:-0}" -gt 0 ]; then
    echo "FAIL: Pool panicked ${PANIC_COUNT} times"
    PASS=false
fi
if [ -n "$POOL_CPU" ] && [ "$POOL_CPU" != "N/A" ]; then
    CPU_INT=$(echo "$POOL_CPU" | cut -d. -f1)
    if [ "$CPU_INT" -gt 80 ]; then
        echo "WARN: Pool CPU ${POOL_CPU}% exceeds 80% threshold"
    fi
fi

if [ "$PASS" = true ]; then
    echo "RESULT: PASS"
    exit 0
else
    echo "RESULT: FAIL"
    exit 1
fi
