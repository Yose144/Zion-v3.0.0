#!/usr/bin/env bash
# =============================================================================
# open_channel.sh — Open a Lightning channel to a well-known node
# =============================================================================
# Usage:
#   ./open_channel.sh [pubkey@host:port] [amount_sats]
#
# Defaults to a testnet node with 500,000 sats capacity.
# Always verify the current pubkey at 1ml.com/testnet before opening.
# =============================================================================
set -euo pipefail

# Configuration
LND_CONTAINER="${LND_CONTAINER:-zion-lnd}"
NETWORK="${LN_NETWORK:-testnet}"

# Default target — a well-known testnet node.
# IMPORTANT: Testnet pubkeys change frequently. Verify the current
# pubkey at https://1ml.com/testnet or https://amboss.space before
# opening a channel. Update LN_PEER env var with the correct node.
#
# Example well-known testnet nodes (verify before use!):
#   ACINQ:        03864ef025fde8fb587d989186ce6a4a186f95e0a90e484aaa0d467c7e5fb9cdb8@node.acinq.co:9735
#   Lightning Labs: check 1ml.com/testnet for current nodes
DEFAULT_NODE="${LN_PEER:-03864ef025fde8fb587d989186ce6a4a186f95e0a90e484aaa0d467c7e5fb9cdb8@node.acinq.co:9735}"
DEFAULT_AMOUNT="${LN_CHANNEL_AMOUNT:-500000}"

PEER="${1:-$DEFAULT_NODE}"
AMOUNT="${2:-$DEFAULT_AMOUNT}"

echo "============================================"
echo "  ZION WARP — Open Lightning Channel"
echo "============================================"
echo "  Node:    $PEER"
echo "  Amount:  $AMOUNT sats"
echo "  Network: $NETWORK"
echo "============================================"
echo ""

# Step 1: Connect to the peer
echo "[1/2] Connecting to peer..."
docker exec "$LND_CONTAINER" lncli --network="$NETWORK" connect "$PEER"
echo ""

# Wait for connection to establish
echo "Waiting 3s for peer connection to establish..."
sleep 3

# Step 2: Open channel
echo ""
echo "[2/2] Opening channel..."
docker exec "$LND_CONTAINER" lncli --network="$NETWORK" \
  openchannel --node_key="$(echo "$PEER" | cut -d@ -f1)" \
  --local_amt="$AMOUNT" \
  --push_amt=0 \
  --min_confs=1

echo ""
echo "✓ Channel open request submitted."
echo ""
echo "Monitor channel status:"
echo "  docker exec $LND_CONTAINER lncli --network=$NETWORK listchannels"
echo "  docker exec $LND_CONTAINER lncli --network=$NETWORK pendingchannels"
