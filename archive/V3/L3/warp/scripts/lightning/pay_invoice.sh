#!/usr/bin/env bash
# =============================================================================
# pay_invoice.sh — Pay a BOLT11 invoice via LND REST API
# =============================================================================
# Usage:
#   ./pay_invoice.sh <bolt11_invoice> [fee_limit_msat]
#
# Pays a Lightning invoice via LND REST API (port 8080).
# This is the same API the WARP adapter uses for outbound transfers.
#
# Examples:
#   ./pay_invoice.sh lntb1u1pj...
#   ./pay_invoice.sh lntb1u1pj... 5000
# =============================================================================
set -euo pipefail

LND_HOST="${LND_HOST:-localhost}"
LND_REST_PORT="${LND_REST_PORT:-8080}"
NETWORK="${LN_NETWORK:-testnet}"
MACAROON_PATH="${MACAROON_PATH:-/root/.lnd/data/chain/bitcoin/${NETWORK}/admin.macaroon}"
LND_CONTAINER="${LND_CONTAINER:-zion-lnd}"

INVOICE="${1:?Usage: ./pay_invoice.sh <bolt11_invoice> [fee_limit_msat]}"
FEE_LIMIT_MSAT="${2:-10000}"

echo "============================================"
echo "  ZION WARP — Pay Lightning Invoice"
echo "============================================"
echo "  Invoice:    ${INVOICE:0:50}..."
echo "  Fee limit:  $FEE_LIMIT_MSAT msat"
echo "  Network:    $NETWORK"
echo "============================================"
echo ""

# Validate invoice prefix
if [[ ! "$INVOICE" =~ ^ln(bc|tb|bcrt) ]]; then
  echo "ERROR: Invalid BOLT11 invoice. Expected lnbc.../lntb.../lnbcrt..."
  exit 1
fi

# Get macaroon hex from the LND container
MACAROON_HEX=$(docker exec "$LND_CONTAINER" xxd -p -c 1000 "$MACAROON_PATH" 2>/dev/null || \
  echo "MACAROON_NOT_FOUND")

if [ "$MACAROON_HEX" = "MACAROON_NOT_FOUND" ]; then
  echo "ERROR: Could not read macaroon from LND container."
  echo "Make sure LND is running and wallet is created."
  exit 1
fi

# Pay invoice via LND REST API
# The WARP adapter uses this same endpoint: POST /v1/channels/transactions
RESPONSE=$(curl -s -k -X POST \
  "https://${LND_HOST}:${LND_REST_PORT}/v1/channels/transactions" \
  -H "Grpc-Metadata-macaroon: ${MACAROON_HEX}" \
  -H "Content-Type: application/json" \
  -d "{\"payment_request\": \"${INVOICE}\", \"fee_limit_msat\": ${FEE_LIMIT_MSAT}, \"timeout_seconds\": 60}")

echo "LND REST Response:"
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
echo ""

# Check for payment error
PAYMENT_ERROR=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('payment_error',''))" 2>/dev/null || echo "")

if [ -n "$PAYMENT_ERROR" ] && [ "$PAYMENT_ERROR" != "" ]; then
  echo "────────────────────────────────────────────────────────"
  echo "ERROR: Payment failed: $PAYMENT_ERROR"
  echo "────────────────────────────────────────────────────────"
  exit 1
fi

# Extract preimage
PREIMAGE=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('payment_preimage',''))" 2>/dev/null || echo "")

if [ -n "$PREIMAGE" ] && [ "$PREIMAGE" != "" ]; then
  echo "────────────────────────────────────────────────────────"
  echo "✓ Payment settled!"
  echo "  Preimage: $PREIMAGE"
  echo "────────────────────────────────────────────────────────"
fi
