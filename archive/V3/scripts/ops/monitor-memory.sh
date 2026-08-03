#!/bin/bash
# Monitor zion-node + zion-node2 memory usage — log RSS every 5 min, alert if > threshold
# Threshold: 500MB (Node1), 300MB (Node2) — if exceeded, log ALERT + restart if > 800MB
#
# Install: copy to /usr/local/bin/zion-monitor-memory.sh, chmod +x
# Cron:    */5 * * * * /usr/local/bin/zion-monitor-memory.sh
# Logs:    journalctl -t zion-monitor

ALERT_NODE1=500000   # 500MB in KB
ALERT_NODE2=300000   # 300MB in KB
RESTART_NODE1=800000 # 800MB — auto-restart
RESTART_NODE2=600000 # 600MB — auto-restart

# Get PIDs
PID1=$(pgrep -x zion-node | head -1)
PID2=$(pgrep -x zion-node | tail -1)

# Node1
if [ -n "$PID1" ]; then
  RSS1=$(cat /proc/$PID1/status 2>/dev/null | grep VmRSS | awk '{print $2}')
  if [ -n "$RSS1" ]; then
    HEIGHT=$(curl -s --max-time 5 http://127.0.0.1:8443/rpc -d '{"jsonrpc":"2.0","method":"getChainInfo","id":1}' 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin)['result']['chain_height'])" 2>/dev/null)
    logger -t zion-monitor "OK: Node1 PID=$PID1 RSS=${RSS1}KB height=${HEIGHT:-?}"
    if [ "$RSS1" -gt "$RESTART_NODE1" ] 2>/dev/null; then
      logger -t zion-monitor "CRITICAL: Node1 RSS=${RSS1}KB > ${RESTART_NODE1}KB — auto-restarting"
      systemctl restart zion-node
    elif [ "$RSS1" -gt "$ALERT_NODE1" ] 2>/dev/null; then
      logger -t zion-monitor "ALERT: Node1 RSS=${RSS1}KB > ${ALERT_NODE1}KB (threshold)"
    fi
  fi
else
  logger -t zion-monitor "ALERT: Node1 process not found — service may be down"
fi

# Node2
if [ -n "$PID2" ] && [ "$PID2" != "$PID1" ]; then
  RSS2=$(cat /proc/$PID2/status 2>/dev/null | grep VmRSS | awk '{print $2}')
  if [ -n "$RSS2" ]; then
    logger -t zion-monitor "OK: Node2 PID=$PID2 RSS=${RSS2}KB"
    if [ "$RSS2" -gt "$RESTART_NODE2" ] 2>/dev/null; then
      logger -t zion-monitor "CRITICAL: Node2 RSS=${RSS2}KB > ${RESTART_NODE2}KB — auto-restarting"
      systemctl restart zion-node2
    elif [ "$RSS2" -gt "$ALERT_NODE2" ] 2>/dev/null; then
      logger -t zion-monitor "ALERT: Node2 RSS=${RSS2}KB > ${ALERT_NODE2}KB (threshold)"
    fi
  fi
fi

# System memory
MEMINFO=$(free -m | awk '/Mem:/{print $2,$3,$7}')
TOTAL=$(echo $MEMINFO | awk '{print $1}')
USED=$(echo $MEMINFO | awk '{print $2}')
AVAIL=$(echo $MEMINFO | awk '{print $3}')
logger -t zion-monitor "OK: System memory total=${TOTAL}MB used=${USED}MB avail=${AVAIL}MB"

# Swap usage
SWAP=$(free -m | awk '/Swap:/{print $3}')
if [ -n "$SWAP" ] && [ "$SWAP" -gt 1000 ] 2>/dev/null; then
  logger -t zion-monitor "ALERT: Swap usage ${SWAP}MB > 1000MB — memory pressure"
fi
