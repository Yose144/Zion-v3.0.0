#!/usr/bin/env bash
# backup-beacon.sh — Report local backup node status to Edge dashboard
# Runs via cron every 15s. Reads RPC from local node (127.0.0.1:8446) and
# POSTs the status to the Edge dashboard /api/backup-beacon endpoint.
set -euo pipefail

RPC_HOST="127.0.0.1"
RPC_PORT="8446"
EDGE_URL="https://dashboard.zionterranova.com/api/backup-beacon"
EDGE_USER="Yose"
EDGE_PASS="3nityOne13"
HOSTNAME_LABEL="$(hostname -s)"

# Read chain info from local node RPC
CHAIN_INFO=$(curl -sf -m 5 -X POST "http://${RPC_HOST}:${RPC_PORT}" \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"getChainInfo","params":[],"id":1}' 2>/dev/null || echo "")

if [ -z "$CHAIN_INFO" ]; then
  # Node not running — send offline beacon
  PAYLOAD='{"running":false,"host":"'"${HOSTNAME_LABEL}"'","node_id":"local-backup-node"}'
else
  NODE_INFO=$(curl -sf -m 5 -X POST "http://${RPC_HOST}:${RPC_PORT}" \
    -H 'Content-Type: application/json' \
    -d '{"jsonrpc":"2.0","method":"getNodeInfo","params":[],"id":1}' 2>/dev/null || echo "{}")

  PEER_INFO=$(curl -sf -m 5 -X POST "http://${RPC_HOST}:${RPC_PORT}" \
    -H 'Content-Type: application/json' \
    -d '{"jsonrpc":"2.0","method":"getPeerInfo","params":[],"id":1}' 2>/dev/null || echo '{"result":{"count":0}}')

  # Extract fields using python3
  PAYLOAD=$(python3 -c "
import json,sys
ci = json.loads('''${CHAIN_INFO}''').get('result',{})
ni = json.loads('''${NODE_INFO}''').get('result',{})
pi = json.loads('''${PEER_INFO}''').get('result',{})
print(json.dumps({
  'running': True,
  'chain_height': ci.get('chain_height'),
  'tip_hash': ci.get('tip_hash'),
  'known_peers': pi.get('count', 0),
  'mempool_size': ci.get('mempool_transactions', 0),
  'network': ci.get('network'),
  'protocol_version': ci.get('protocol_version'),
  'consensus_profile': ci.get('consensus_profile'),
  'accepted_blocks': ci.get('accepted_blocks'),
  'node_id': ni.get('node_id', 'local-backup-node'),
  'p2p_bind': ni.get('p2p_bind', '0.0.0.0:8333'),
  'rpc_bind': ni.get('rpc_bind', '127.0.0.1:8446'),
  'host': '${HOSTNAME_LABEL}',
}))
" 2>/dev/null || echo '{"running":false,"host":"'"${HOSTNAME_LABEL}"'"}')
fi

# POST beacon to Edge dashboard
curl -sf -m 10 -X POST "$EDGE_URL" \
  -u "${EDGE_USER}:${EDGE_PASS}" \
  -H 'Content-Type: application/json' \
  -d "$PAYLOAD" > /dev/null 2>&1 || true

echo "$(date '+%Y-%m-%d %H:%M:%S') beacon sent: $(echo $PAYLOAD | head -c 120)"
