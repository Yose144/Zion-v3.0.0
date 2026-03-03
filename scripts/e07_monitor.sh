#!/bin/bash
# E-07 Canary Monitor — run periodically to check canary status
# Usage: bash /tmp/e07_monitor.sh
AUDIT_LOG="/root/e07_audit.log"

echo "=== E-07 Canary Status @ $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
echo ""

# Pool status
echo "--- Pool ---"
if docker ps --format "{{.Names}}: {{.Status}}" | grep -q zion-pool; then
  docker ps --format "{{.Names}}: {{.Status}}" | grep zion-pool
  # Scheduler mode check
  if curl -sf http://localhost:8080/api/scheduler/status > /dev/null 2>&1; then
    echo "Scheduler status:"
    curl -sf http://localhost:8080/api/scheduler/status 2>/dev/null | python3 -c "import sys,json;d=json.load(sys.stdin);print('  mode:', d.get('mode','?'), '| miners:', d.get('total_miners','?'))" 2>/dev/null || echo "  (json parse failed)"
  fi
  # Revenue status check
  if curl -sf http://localhost:8080/api/revenue/status > /dev/null 2>&1; then
    echo "Revenue status:"
    curl -sf http://localhost:8080/api/revenue/status 2>/dev/null | python3 -c "import sys,json;d=json.load(sys.stdin);print('  streams:', d.get('active_streams','?'))" 2>/dev/null || echo "  (json parse failed)"
  fi
else
  echo "WARN: zion-pool NOT running!"
fi

echo ""
echo "--- XMR Miner ---"
if docker ps --format "{{.Names}}: {{.Status}}" | grep -q zion-dero-miner; then
  docker ps --format "{{.Names}}: {{.Status}}" | grep dero-miner
  echo "Last xmrig output:"
  docker logs zion-dero-miner --tail 5 2>&1 | grep -E 'speed|accepted|rejected|difficulty' | head -3
else
  echo "zion-dero-miner NOT running"
  # Check if still building
  if docker ps --format "{{.Names}}: {{.Status}}" | grep -q dero-miner; then
    docker logs zion-dero-miner --tail 3 2>&1
  fi
fi

echo ""
echo "--- Mysterium/NKN Revenue ---"
docker ps --format "{{.Names}}: {{.Status}}" | grep -E 'mysterium|nkn'

echo ""
echo "--- MoneroOcean Check ---"
curl -sf "https://api.moneroocean.stream/miner/42m86RBWf4PeuRf8P5rwA96XvmCKAfF77doWYJRv3KKAKrT8GTb5b3pbHTtaZsbJ4BERW1NHgh8WQgpAxAoEiXF82skcKsK/stats" 2>/dev/null | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print('  totalHashes:', d.get('totalHashes', '?'))
    print('  amtDue:', d.get('amtDue', '?'), 'XMR pending')
    print('  amtPaid:', d.get('amtPaid', '?'), 'XMR paid total')
    print('  lastShare:', d.get('lastShare', '?'))
except Exception as e:
    print('  (parse error:', e, ')')
" 2>/dev/null || echo "  (MoneroOcean API unavailable)"

echo ""
echo "--- Canary Timer ---"
if [ -f "$AUDIT_LOG" ]; then
  START=$(grep E07_START "$AUDIT_LOG" | cut -d= -f2)
  TARGET=$(grep E07_END_TARGET "$AUDIT_LOG" | cut -d= -f2)
  if [ -n "$START" ]; then
    echo "  Started: $START"
    echo "  Target:  $TARGET"
  fi
fi
echo ""
echo "Audit log: $AUDIT_LOG ($(wc -l < "$AUDIT_LOG" 2>/dev/null || echo 0) lines)"
