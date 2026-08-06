#!/usr/bin/env bash
# =============================================================================
# get_macaroon.sh — Extract admin macaroon hex for WARP_LN_MACAROON env var
# =============================================================================
# Usage:
#   ./get_macaroon.sh [invoice|admin|readonly]
#
# Outputs the hex-encoded macaroon suitable for the WARP_LN_MACAROON
# environment variable. Default: admin macaroon.
#
# The WARP adapter needs the admin macaroon to both create invoices
# (inbound) and send payments (outbound).
# =============================================================================
set -euo pipefail

LND_CONTAINER="${LND_CONTAINER:-zion-lnd}"
NETWORK="${LN_NETWORK:-testnet}"
MACAROON_TYPE="${1:-admin}"

# Macaroon path inside the LND container
MACAROON_PATH="/root/.lnd/data/chain/bitcoin/${NETWORK}/${MACAROON_TYPE}.macaroon"

echo "============================================"
echo "  ZION WARP — Extract LND Macaroon"
echo "============================================"
echo "  Container:  $LND_CONTAINER"
echo "  Network:    $NETWORK"
echo "  Type:       $MACAROON_TYPE"
echo "  Path:       $MACAROON_PATH"
echo "============================================"
echo ""

# Check if the macaroon file exists
if ! docker exec "$LND_CONTAINER" test -f "$MACAROON_PATH" 2>/dev/null; then
  echo "ERROR: Macaroon file not found at $MACAROON_PATH"
  echo ""
  echo "Make sure:"
  echo "  1. LND container is running: docker compose up -d"
  echo "  2. LND wallet has been created: docker exec -it $LND_CONTAINER lncli --network=$NETWORK create"
  echo "  3. Network is correct (current: $NETWORK)"
  exit 1
fi

# Extract hex-encoded macaroon
MACAROON_HEX=$(docker exec "$LND_CONTAINER" xxd -p -c 1000 "$MACAROON_PATH")

echo "Macaroon (hex-encoded):"
echo ""
echo "$MACAROON_HEX"
echo ""
echo "────────────────────────────────────────────────────────"
echo "Set this as the WARP_LN_MACAROON environment variable:"
echo ""
echo "  export WARP_LN_MACAROON=$MACAROON_HEX"
echo ""
echo "Or add to edge-deploy/config/edge-environment.sh:"
echo "  WARP_LN_MACAROON=$MACAROON_HEX"
echo "────────────────────────────────────────────────────────"
