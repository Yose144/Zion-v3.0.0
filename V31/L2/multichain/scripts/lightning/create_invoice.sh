#!/usr/bin/env bash
# =============================================================================
# create_invoice.sh — Create a test BOLT11 invoice via LND REST API
# =============================================================================
# Usage:
#   ./create_invoice.sh [amount_sats] [memo]
#
# Creates a Lightning invoice via LND REST API (port 8080).
# This is the same API the WARP adapter uses.
#
# Examples:
#   ./create_invoice.sh 1000 "WARP test"
#   ./create_invoice.sh 50000 "ZION inbound transfer"
# =============================================================================
set -euo pipefail

LND_HOST="${LND_HOST:-localhost}"
LND_REST_PORT="${LND_REST_PORT:-8080}"
NETWORK="${LN_NETWORK:-testnet}"
MACAROON_PATH="${MACAROON_PATH:-/root/.lnd/data/chain/bitcoin/${NETWORK}/admin.macaroon}"
LND_CONTAINER="${LND_CONTAINER:-zion-lnd}"

AMOUNT_SATS="${1:-1000}"
MEMO="${2:-WARP test invoice}"

# Convert sats to msat (LND REST expects value_msat)
AMOUNT_MSAT=$((AMOUNT_SATS * 1000))

echo "============================================"
echo "  ZION WARP — Create Lightning Invoice"
echo "============================================"
echo "  Amount:  $AMOUNT_SATS sats ($AMOUNT_MSAT msat)"
echo "  Memo:    $MEMO"
echo "  Network: $NETWORK"
echo "============================================"
echo ""

# Get macaroon hex from the LND container
MACAROON_HEX=$(docker exec "$LND_CONTAINER" xxd -p -c 1000 "$MACAROON_PATH" 2>/dev/null || \
  echo "MACAROON_NOT_FOUND")

if [ "$MACAROON_HEX" = "MACAROON_NOT_FOUND" ]; then
  echo "ERROR: Could not read macaroon from LND container."
  echo "Make sure LND is running and wallet is created."
  exit 1
fi

# Create invoice via LND REST API
# The WARP adapter uses this same endpoint: POST /v1/invoices
RESPONSE=$(curl -s -k -X POST \
  "https://${LND_HOST}:${LND_REST_PORT}/v1/invoices" \
  -H "Grpc-Metadata-macaroon: ${MACAROON_HEX}" \
  -H "Content-Type: application/json" \
  -d "{\"value_msat\": ${AMOUNT_MSAT}, \"memo\": \"${MEMO}\", \"expiry\": 3600}")

echo "LND REST Response:"
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
echo ""

# Extract payment request
PAY_REQ=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('payment_request',''))" 2>/dev/null || echo "")

if [ -n "$PAY_REQ" ] && [ "$PAY_REQ" != "" ]; then
  echo "────────────────────────────────────────────────────────"
  echo "BOLT11 Invoice:"
  echo "  $PAY_REQ"
  echo "────────────────────────────────────────────────────────"
  echo ""
  echo "Pay this invoice with:"
  echo "  ./pay_invoice.sh $PAY_REQ"
fi
