#!/usr/bin/env bash
# =============================================================================
# list_channels.sh — List open and pending Lightning channels
# =============================================================================
# Usage:
#   ./list_channels.sh
# =============================================================================
set -euo pipefail

LND_CONTAINER="${LND_CONTAINER:-zion-lnd}"
NETWORK="${LN_NETWORK:-testnet}"

echo "============================================"
echo "  ZION WARP — Lightning Channels"
echo "============================================"
echo ""

echo "── Open Channels ──────────────────────────"
docker exec "$LND_CONTAINER" lncli --network="$NETWORK" listchannels 2>/dev/null || \
  echo "  (no open channels or LND not running)"
echo ""

echo "── Pending Channels ───────────────────────"
docker exec "$LND_CONTAINER" lncli --network="$NETWORK" pendingchannels 2>/dev/null || \
  echo "  (no pending channels or LND not running)"
echo ""

echo "── Channel Balance Summary ────────────────"
docker exec "$LND_CONTAINER" lncli --network="$NETWORK" channelbalance 2>/dev/null || \
  echo "  (unable to get balance or LND not running)"
echo ""

echo "── Node Info ──────────────────────────────"
docker exec "$LND_CONTAINER" lncli --network="$NETWORK" getinfo 2>/dev/null || \
  echo "  (unable to get info or LND not running)"
