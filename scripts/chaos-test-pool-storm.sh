#!/usr/bin/env bash
# ZION A2.4 — Pool reconnect storm test
#
# Simulates rapid connect/disconnect cycles from a single IP to verify
# the pool handles reconnect storms gracefully (max 1 reconnect/min per IP
# is the success criterion, but we test that the pool doesn't crash).
#
# Usage: bash scripts/chaos-test-pool-storm.sh [POOL_HOST] [POOL_PORT] [CYCLES]
# Default: 62.171.141.136 8444 100

set -euo pipefail

POOL_HOST="${1:-62.171.141.136}"
POOL_PORT="${2:-8444}"
CYCLES="${3:-100}"

echo "[chaos] ZION A2.4 — Pool reconnect storm test"
echo "[chaos] Target: ${POOL_HOST}:${POOL_PORT}"
echo "[chaos] Cycles: ${CYCLES}"
echo ""

# Check if target is reachable
if ! nc -z -w 5 "${POOL_HOST}" "${POOL_PORT}" 2>/dev/null; then
    echo "[chaos] FAIL: Cannot connect to ${POOL_HOST}:${POOL_PORT}"
    exit 1
fi
echo "[chaos] Target reachable"

SUCCESS=0
FAILED=0
CRASHED=0

echo "[chaos] Running ${CYCLES} rapid reconnect cycles..."

for i in $(seq 1 "$CYCLES"); do
    # Rapid connect + immediate disconnect
    RESULT=$(python3 -c "
import socket
try:
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(3)
    s.connect(('${POOL_HOST}', ${POOL_PORT}))
    # Immediately send subscribe and disconnect
    s.sendall(b'{\"id\":1,\"method\":\"mining.subscribe\",\"params\":[\"storm-agent/1.0\"]}\n')
    s.close()
    print('OK')
except Exception as e:
    print(f'ERROR: {e}')
" 2>/dev/null)

    if [ "$RESULT" = "OK" ]; then
        SUCCESS=$((SUCCESS + 1))
    else
        FAILED=$((FAILED + 1))
    fi

    # Very short delay (simulates reconnect storm)
    sleep 0.05

    if [ $((i % 20)) -eq 0 ]; then
        echo "[chaos] Completed ${i}/${CYCLES} cycles (OK: ${SUCCESS}, Fail: ${FAILED})"
    fi
done

# Check if pool is still alive
echo ""
echo "[chaos] Checking pool health after storm..."

# Try a clean connection
FINAL_CHECK=$(python3 -c "
import socket
try:
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(5)
    s.connect(('${POOL_HOST}', ${POOL_PORT}))
    s.sendall(b'{\"id\":1,\"method\":\"mining.subscribe\",\"params\":[\"post-storm-check/1.0\"]}\n')
    data = s.recv(4096)
    s.close()
    if data:
        print('ALIVE')
    else:
        print('DEAD')
except Exception as e:
    print(f'DEAD: {e}')
" 2>/dev/null)

echo ""
echo "============================================"
echo " A2.4 Pool Reconnect Storm Results"
echo "============================================"
echo " Cycles:       ${CYCLES}"
echo " Success:      ${SUCCESS}"
echo " Failed:       ${FAILED}"
echo " Pool status:  ${FINAL_CHECK}"
echo "============================================"

if [ "$FINAL_CHECK" = "ALIVE" ]; then
    echo "RESULT: PASS — pool survived ${CYCLES} reconnect cycles"
    exit 0
else
    echo "RESULT: FAIL — pool unresponsive after storm"
    exit 1
fi
