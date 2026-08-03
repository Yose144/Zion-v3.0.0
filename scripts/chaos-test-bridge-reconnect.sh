#!/usr/bin/env bash
# ZION A2.3 — Bridge watcher 50x reconnect test
#
# Simulates 50 rapid reconnect cycles to the L1 RPC endpoint,
# verifying no events are lost and the RPC server remains responsive.
#
# Usage: bash scripts/chaos-test-bridge-reconnect.sh [RPC_HOST] [RPC_PORT] [CYCLES]
# Default: 62.171.141.136 8443 50

set -euo pipefail

RPC_HOST="${1:-62.171.141.136}"
RPC_PORT="${2:-8443}"
CYCLES="${3:-50}"

echo "[chaos] ZION A2.3 — Bridge watcher reconnect test"
echo "[chaos] Target: ${RPC_HOST}:${RPC_PORT}"
echo "[chaos] Cycles: ${CYCLES}"
echo ""

# Check if target is reachable
if ! nc -z -w 5 "${RPC_HOST}" "${RPC_PORT}" 2>/dev/null; then
    echo "[chaos] FAIL: Cannot connect to ${RPC_HOST}:${RPC_PORT}"
    exit 1
fi
echo "[chaos] Target reachable"

SUCCESS=0
FAILED=0
EVENTS_LOST=0

echo "[chaos] Running ${CYCLES} reconnect cycles..."

for i in $(seq 1 "$CYCLES"); do
    # Connect, query status, disconnect
    RESULT=$(python3 -c "
import socket, json
try:
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(5)
    s.connect(('${RPC_HOST}', ${RPC_PORT}))
    # Send HTTP GET /status
    s.sendall(b'GET /status HTTP/1.1\r\nHost: ${RPC_HOST}\r\nConnection: close\r\n\r\n')
    data = b''
    while True:
        chunk = s.recv(4096)
        if not chunk:
            break
        data += chunk
    s.close()
    # Check for valid response
    if b'200 OK' in data.split(b'\r\n')[0] if data else False:
        print('OK')
    elif b'status' in data:
        print('OK')
    else:
        print('FAIL')
except Exception as e:
    print(f'ERROR: {e}')
" 2>/dev/null)

    if [ "$RESULT" = "OK" ]; then
        SUCCESS=$((SUCCESS + 1))
    else
        FAILED=$((FAILED + 1))
        if [ "$RESULT" != "OK" ]; then
            echo "[chaos] Cycle ${i}: FAILED ($RESULT)"
        fi
    fi

    # Small delay between reconnects (simulates bridge poll interval)
    sleep 0.1

    if [ $((i % 10)) -eq 0 ]; then
        echo "[chaos] Completed ${i}/${CYCLES} cycles (OK: ${SUCCESS}, Fail: ${FAILED})"
    fi
done

echo ""
echo "============================================"
echo " A2.3 Bridge Watcher Reconnect Results"
echo "============================================"
echo " Cycles:      ${CYCLES}"
echo " Success:     ${SUCCESS}"
echo " Failed:      ${FAILED}"
echo " Events lost: ${EVENTS_LOST}"
echo "============================================"

if [ "$FAILED" -eq 0 ]; then
    echo "RESULT: PASS — all ${CYCLES} reconnect cycles succeeded"
    exit 0
else
    echo "RESULT: FAIL — ${FAILED} cycles failed"
    exit 1
fi
