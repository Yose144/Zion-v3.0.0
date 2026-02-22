#!/bin/bash
# ZION Mission Control — data collector v3
# 5-node network: Helsinki + SeedDE + Usa1 + Usa2 + Asia3
# Runs every 30s via cron — generates /var/www/html/dash/data.json
# Updated: 2026-02-22 — fixed JSON-RPC, new peer list

OUT="/var/www/html/dash/data.json"
mkdir -p /var/www/html/dash

rpc() {
  curl -s --max-time 4 "http://$1:8444/jsonrpc" -X POST \
    -H 'Content-Type: application/json' \
    -d '{"jsonrpc":"2.0","method":"get_info","params":{},"id":1}' 2>/dev/null
}

# ── Helsinki (local) ──
H_INFO=$(rpc 77.42.31.72)
H_HEIGHT=$(echo "$H_INFO" | python3 -c "import sys,json; d=json.load(sys.stdin)['result']; print(d.get('height','?'))"        2>/dev/null || echo "?")
H_P_IN=$(echo "$H_INFO"  | python3 -c "import sys,json; d=json.load(sys.stdin)['result']; print(d.get('incoming_connections_count',0))" 2>/dev/null || echo "?")
H_P_OUT=$(echo "$H_INFO" | python3 -c "import sys,json; d=json.load(sys.stdin)['result']; print(d.get('outgoing_connections_count',0))" 2>/dev/null || echo "?")
H_DIFF=$(echo "$H_INFO"  | python3 -c "import sys,json; d=json.load(sys.stdin)['result']; print(d.get('difficulty','?'))"     2>/dev/null || echo "?")
H_TIP=$(echo "$H_INFO"   | python3 -c "import sys,json; d=json.load(sys.stdin)['result']; print(d.get('top_block_hash','')[:16])" 2>/dev/null || echo "")
H_POOL=$(curl -s --max-time 3 http://localhost:8080/stats 2>/dev/null || echo '{}')
H_POOL_UP=$(echo "$H_POOL" | python3 -c "import sys,json; print(json.load(sys.stdin).get('pool',{}).get('uptime_secs',0))" 2>/dev/null || echo 0)

H_MEM_USED=$(free -m | awk '/Mem:/ {print $3}')
H_MEM_TOTAL=$(free -m | awk '/Mem:/ {print $2}')
H_DISK=$(df / | tail -1 | awk '{print $5}' | tr -d '%')
H_LOAD=$(cat /proc/loadavg | awk '{print $1}')
H_HEALTHY=$(docker ps --filter "health=healthy" --format '.' 2>/dev/null | wc -l | tr -d ' ')
H_TOTAL=$(docker ps --format '.' 2>/dev/null | wc -l | tr -d ' ')

# ── Seed nodes (RPC heights) ──
SEEDDE_H=$(rpc 46.225.126.243 | python3 -c "import sys,json; d=json.load(sys.stdin)['result']; print(d.get('height','?'))" 2>/dev/null || echo "?")
USA1_H=$(rpc   5.78.178.227   | python3 -c "import sys,json; d=json.load(sys.stdin)['result']; print(d.get('height','?'))" 2>/dev/null || echo "?")
USA2_H=$(rpc   178.156.240.160| python3 -c "import sys,json; d=json.load(sys.stdin)['result']; print(d.get('height','?'))" 2>/dev/null || echo "?")
ASIA3_H=$(rpc  5.223.43.93    | python3 -c "import sys,json; d=json.load(sys.stdin)['result']; print(d.get('height','?'))" 2>/dev/null || echo "?")

# Online count
ONLINE=0
for hh in "$H_HEIGHT" "$SEEDDE_H" "$USA1_H" "$USA2_H" "$ASIA3_H"; do
  [ "$hh" != "?" ] && ONLINE=$((ONLINE+1))
done

# ── 168h Stability Run — started 2026-02-22T21:30:45Z ──
START_EPOCH=1771795845
START_ISO="2026-02-22T21:30:45Z"
NOW_EPOCH=$(date +%s)
ELAPSED=$(( NOW_EPOCH - START_EPOCH ))
DURATION=$((168 * 3600))
REMAINING=$(( DURATION - ELAPSED ))
[ $REMAINING -lt 0 ] && REMAINING=0
PCT=$(( ELAPSED * 100 / DURATION ))
[ $PCT -gt 100 ] && PCT=100

# ── Write to stability log ──
LOG_FILE="/root/stability_run_v2.log"
MEM_PCT=0
[ "${H_MEM_TOTAL:-0}" -gt 0 ] && MEM_PCT=$(( H_MEM_USED * 100 / H_MEM_TOTAL ))

ELAPSED_FMT=$(printf "%02dh%02dm" $((ELAPSED/3600)) $(((ELAPSED%3600)/60)))

# Status based on actual data
if [ "$H_HEIGHT" != "?" ] && [ "$ONLINE" -ge 4 ]; then
  LINE_STATUS="OK"
elif [ "$H_HEIGHT" = "?" ]; then
  LINE_STATUS="[HELSINKI_RPC_FAIL]"
else
  LINE_STATUS="[NODES_PARTIAL_${ONLINE}/5]"
fi

echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) | ${ELAPSED_FMT} | H:${H_HEIGHT} P:${H_P_IN}+${H_P_OUT} DIFF:${H_DIFF} | TIP:${H_TIP} | NODES:${ONLINE}/5 POOL:${H_POOL_UP}s | MEM:${H_MEM_USED}/${H_MEM_TOTAL}MB(${MEM_PCT}%) DISK:${H_DISK}% LOAD:${H_LOAD} | CTR:${H_TOTAL}/${H_HEALTHY} | ${LINE_STATUS}" >> "$LOG_FILE"
tail -500 "$LOG_FILE" > "${LOG_FILE}.tmp" && mv "${LOG_FILE}.tmp" "$LOG_FILE"

LOG_TAIL=$(tail -24 "$LOG_FILE" 2>/dev/null | sed 's/\\/\\\\/g' | sed 's/"/\\"/g' | awk '{printf "%s\\n", $0}')

cat > "$OUT" << ENDJSON
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "stability_run": {
    "start": "$START_ISO",
    "elapsed_secs": $ELAPSED,
    "remaining_secs": $REMAINING,
    "duration_secs": $DURATION,
    "progress_pct": $PCT,
    "nodes_online": $ONLINE,
    "nodes_total": 5
  },
  "helsinki": {
    "ip": "77.42.31.72",
    "height": ${H_HEIGHT//\?/0},
    "peers_in": ${H_P_IN//\?/0},
    "peers_out": ${H_P_OUT//\?/0},
    "difficulty": "${H_DIFF}",
    "pool_uptime": $H_POOL_UP,
    "mem": {"used": $H_MEM_USED, "total": $H_MEM_TOTAL},
    "disk": {"used_pct": $H_DISK},
    "load": $H_LOAD,
    "containers_up": $H_TOTAL,
    "containers_healthy": $H_HEALTHY
  },
  "nodes": {
    "seedde": {"ip": "46.225.126.243", "height": ${SEEDDE_H//\?/0}},
    "usa1":   {"ip": "5.78.178.227",   "height": ${USA1_H//\?/0}},
    "usa2":   {"ip": "178.156.240.160","height": ${USA2_H//\?/0}},
    "asia3":  {"ip": "5.223.43.93",    "height": ${ASIA3_H//\?/0}}
  },
  "log_tail": "$LOG_TAIL"
}
ENDJSON
