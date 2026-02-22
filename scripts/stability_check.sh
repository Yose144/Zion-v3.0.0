#!/bin/bash
# ZION Stability Checker v4 — 5-node network, runs every 30 min via cron
# Updated 2026-02-22: JSON-RPC on port 8444, removed Germany, 5 new nodes
LOG="/opt/zion/stability_log.jsonl"
TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)

rpc() {
  curl -s --connect-timeout 5 "http://$1:8444/jsonrpc" -X POST \
    -H 'Content-Type: application/json' \
    -d '{"jsonrpc":"2.0","method":"get_info","params":{},"id":1}' 2>/dev/null
}
jv() { python3 -c "import sys,json; d=json.load(sys.stdin).get('result',{}); print(d.get('$2', $3))" 2>/dev/null || echo "$3"; }

H=$(rpc 77.42.31.72)
S=$(rpc 46.225.126.243)
U1=$(rpc 5.78.178.227)
U2=$(rpc 178.156.240.160)
A3=$(rpc 5.223.43.93)

get_h() { echo "$1" | python3 -c "import sys,json; print(json.load(sys.stdin).get('result',{}).get('height',0))" 2>/dev/null || echo 0; }
get_t() { echo "$1" | python3 -c "import sys,json; print(json.load(sys.stdin).get('result',{}).get('top_block_hash','')[:16])" 2>/dev/null || echo ""; }
get_p() { echo "$1" | python3 -c "import sys,json; d=json.load(sys.stdin).get('result',{}); print(d.get('incoming_connections_count',0)+d.get('outgoing_connections_count',0))" 2>/dev/null || echo 0; }

H_HEIGHT=$(get_h "$H"); S_HEIGHT=$(get_h "$S"); U1_HEIGHT=$(get_h "$U1")
U2_HEIGHT=$(get_h "$U2"); A3_HEIGHT=$(get_h "$A3")
H_TIP=$(get_t "$H");   S_TIP=$(get_t "$S")
H_PEERS=$(get_p "$H")

# Fork detection — compare Helsinki tip to other nodes at same height
FORK="false"
for NODE_H in "$S_HEIGHT" "$U1_HEIGHT" "$U2_HEIGHT" "$A3_HEIGHT"; do
  [ "$NODE_H" = "0" ] && continue
  DIFF=$(( H_HEIGHT > NODE_H ? H_HEIGHT - NODE_H : NODE_H - H_HEIGHT ))
  [ "$DIFF" -gt 3 ] && FORK="true" && break
done

# Nodes-online count
ONLINE=0
for hh in "$H_HEIGHT" "$S_HEIGHT" "$U1_HEIGHT" "$U2_HEIGHT" "$A3_HEIGHT"; do
  [ "$hh" != "0" ] && [[ "$hh" =~ ^[0-9]+$ ]] && ONLINE=$((ONLINE+1))
done

echo "{\"ts\":\"$TS\",\"helsinki\":$H_HEIGHT,\"seedde\":$S_HEIGHT,\"usa1\":$U1_HEIGHT,\"usa2\":$U2_HEIGHT,\"asia3\":$A3_HEIGHT,\"h_tip\":\"$H_TIP\",\"h_peers\":$H_PEERS,\"nodes_online\":$ONLINE,\"fork_detected\":$FORK}" >> "$LOG"
