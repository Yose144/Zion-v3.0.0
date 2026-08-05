#!/usr/bin/env bash
# ZION V3 — Upgrade existing ZIONBridge to 3/5 validator multisig
# Network: Base Mainnet
#
# Prerequisites:
#   - Foundry (cast) installed
#   - Deployer private key set as PRIVATE_KEY env var
#   - ETH for gas on deployer wallet
#
# Existing contracts (from 2026-04-01 deploy):
#   wZION:      0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6
#   ZIONBridge: 0xa5a09b2C09A7182BBA9623A2D2cd46cD7D041721
#
# Current config: 2 validators, threshold 1
# Target config:  5 validators, threshold 3

set -euo pipefail

BRIDGE="0xa5a09b2C09A7182BBA9623A2D2cd46cD7D041721"
RPC_URL="${BASE_RPC:-https://base-mainnet.publicnode.com}"
PRIVATE_KEY="${PRIVATE_KEY:-}"

if [ -z "$PRIVATE_KEY" ]; then
    echo "ERROR: PRIVATE_KEY env var not set"
    exit 1
fi

# ── Validator addresses (5 total) ──────────────────────────────────────────
# Existing:
VAL1="0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186"  # deployer (already validator)
VAL2="0x8cc6F931edDAf5F14D0071727Ed1640752B5c787"  # existing validator
# New (generated 2026-06-03):
VAL3="0x0279C8e3cbd6D4828917ccD513F54fDaA42e649c"
VAL4="0x294942CfEd1e1F37cdd5FBa70686171Eb1A5Be4b"
VAL5="0x8CA71cA7f3aDa7ca5c1308b93698B47759d9D28c"

echo "════════════════════════════════════════════════════════════"
echo "  ZIONBridge Mainnet Upgrade — 1/2 → 3/5"
echo "  Bridge: $BRIDGE"
echo "  RPC:    $RPC_URL"
echo "════════════════════════════════════════════════════════════"

# Step 1: Update threshold from 1 → 3
echo ""
echo "[1/4] Updating threshold to 3..."
cast send "$BRIDGE" "updateThreshold(uint8)" 3 \
  --private-key "$PRIVATE_KEY" --rpc-url "$RPC_URL"

# Step 2: Add 3 new validators
echo ""
echo "[2/4] Adding validator 3 ($VAL3)..."
cast send "$BRIDGE" "addValidator(address)" "$VAL3" \
  --private-key "$PRIVATE_KEY" --rpc-url "$RPC_URL"

echo ""
echo "[3/4] Adding validator 4 ($VAL4)..."
cast send "$BRIDGE" "addValidator(address)" "$VAL4" \
  --private-key "$PRIVATE_KEY" --rpc-url "$RPC_URL"

echo ""
echo "[4/4] Adding validator 5 ($VAL5)..."
cast send "$BRIDGE" "addValidator(address)" "$VAL5" \
  --private-key "$PRIVATE_KEY" --rpc-url "$RPC_URL"

# Verify
echo ""
echo "════════════════════════════════════════════════════════════"
echo "  Verification"
echo "════════════════════════════════════════════════════════════"
echo "Threshold:   $(cast call "$BRIDGE" "threshold()" --rpc-url "$RPC_URL")"
echo "Validators:  $(cast call "$BRIDGE" "validatorCount()" --rpc-url "$RPC_URL")"
echo ""
echo "Next: update V3/config/bridge-mainnet.toml with real addresses"
echo "      and set enabled = true when L1 vault is funded."
echo "════════════════════════════════════════════════════════════"
