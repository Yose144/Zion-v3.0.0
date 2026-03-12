#!/bin/bash
# ZION Stability Checker v5 — single-host topology, runs every 30 min via cron
# Updated 2026-03-12: canonical Zion2 primary host
LOG="/opt/zion/stability_log.jsonl"
TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)

rpc() {
  curl -s --connect-timeout 5 "http://$1:8444/jsonrpc" -X POST \
    -H 'Content-Type: application/json' \
    -d '{"jsonrpc":"2.0","method":"get_info","params":{},"id":1}' 2>/dev/null
}
jv() { python3 -c "import sys,json; d=json.load(sys.stdin).get('result',{}); print(d.get('$2', $3))" 2>/dev/null || echo "$3"; }

H=$(rpc 91.98.122.165)

get_h() { echo "$1" | python3 -c "import sys,json; print(json.load(sys.stdin).get('result',{}).get('height',0))" 2>/dev/null || echo 0; }
get_t() { echo "$1" | python3 -c "import sys,json; print(json.load(sys.stdin).get('result',{}).get('top_block_hash','')[:16])" 2>/dev/null || echo ""; }
get_p() { echo "$1" | python3 -c "import sys,json; d=json.load(sys.stdin).get('result',{}); print(d.get('incoming_connections_count',0)+d.get('outgoing_connections_count',0))" 2>/dev/null || echo 0; }

H_HEIGHT=$(get_h "$H")
H_TIP=$(get_t "$H")
H_PEERS=$(get_p "$H")

# Fork detection — single-host mode cannot cross-check external peers here
FORK="false"

# Nodes-online count
ONLINE=0
[ "$H_HEIGHT" != "0" ] && [[ "$H_HEIGHT" =~ ^[0-9]+$ ]] && ONLINE=1

echo "{\"ts\":\"$TS\",\"zion2\":$H_HEIGHT,\"h_tip\":\"$H_TIP\",\"h_peers\":$H_PEERS,\"nodes_online\":$ONLINE,\"fork_detected\":$FORK}" >> "$LOG"
