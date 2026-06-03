#!/usr/bin/env bash
# ZION V3 — Bridge Contract Verification Script (Foundry)
#
# Usage:
#   export ETHERSCAN_API_KEY=YourBaseScanApiKey
#   export BASE_RPC=https://sepolia.base.org
#   ./scripts/verify-bridge-base.sh base-sepolia
#
# Prerequisites:
#   - Foundry (forge, cast): https://foundry.paradigm.xyz
#   - Contracts compiled and deployed
#   - ETHERSCAN_API_KEY with access to basescan.org or sepolia.basescan.org

set -euo pipefail

NETWORK="${1:-base-sepolia}"
ETHERSCAN_API_KEY="${ETHERSCAN_API_KEY:-}"

if [ -z "$ETHERSCAN_API_KEY" ]; then
    echo "ERROR: ETHERSCAN_API_KEY env var not set"
    echo "  Get one at https://basescan.org/apis"
    exit 1
fi

case "$NETWORK" in
    base)
        CHAIN_ID=8453
        VERIFIER_URL="https://api.basescan.org/api"
        ;;
    base-sepolia)
        CHAIN_ID=84532
        VERIFIER_URL="https://api-sepolia.basescan.org/api"
        ;;
    *)
        echo "ERROR: Unknown network: $NETWORK"
        exit 1
        ;;
esac

echo "════════════════════════════════════════════════════════════"
echo "  ZION Bridge Contract Verification"
echo "  Network: $NETWORK (chain $CHAIN_ID)"
echo "════════════════════════════════════════════════════════════"

if ! command -v forge &> /dev/null; then
    echo "ERROR: forge not found. Install Foundry:"
    echo "  curl -L https://foundry.paradigm.xyz | bash"
    exit 1
fi

# ── Configuration ─────────────────────────────────────────────
# Update these addresses after each deployment
WZION_ADDRESS="${WZION_ADDRESS:-0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6}"
BRIDGE_ADDRESS="${BRIDGE_ADDRESS:-0xF4BF85443ad6c9b88f3a5314cC3Fb59C32Cedca1}"
VALIDATOR_ADDRESS="${VALIDATOR_ADDRESS:-}"

CONTRACTS_DIR="V3/L2/bridge/contracts"

if [ ! -d "$CONTRACTS_DIR" ]; then
    echo "WARN: Contract source dir not found at $CONTRACTS_DIR"
    echo "      Commit Solidity sources before verification."
    echo ""
    echo "Manual verify commands:"
    echo "  forge verify-contract \\"
    echo "    --chain $CHAIN_ID \\"
    echo "    --etherscan-api-key \$ETHERSCAN_API_KEY \\"
    echo "    --verifier-url $VERIFIER_URL \\"
    echo "    --watch \\"
    echo "    <DEPLOYED_ADDR> \\"
    echo "    src/wZION.sol:wZION"
    exit 0
fi

echo ""
echo "Verifying wZION at $WZION_ADDRESS..."
forge verify-contract \
    --chain "$CHAIN_ID" \
    --etherscan-api-key "$ETHERSCAN_API_KEY" \
    --verifier-url "$VERIFIER_URL" \
    --watch \
    "$WZION_ADDRESS" \
    "$CONTRACTS_DIR/wZION.sol:wZION" \
    || echo "WARN: wZION verification failed or already verified"

echo ""
echo "Verifying ZIONBridge at $BRIDGE_ADDRESS..."
forge verify-contract \
    --chain "$CHAIN_ID" \
    --etherscan-api-key "$ETHERSCAN_API_KEY" \
    --verifier-url "$VERIFIER_URL" \
    --watch \
    --constructor-args "$(cast abi-encode 'constructor(address)' "$WZION_ADDRESS")" \
    "$BRIDGE_ADDRESS" \
    "$CONTRACTS_DIR/ZIONBridge.sol:ZIONBridge" \
    || echo "WARN: ZIONBridge verification failed or already verified"

if [ -n "$VALIDATOR_ADDRESS" ]; then
    echo ""
    echo "Verifying BridgeValidator at $VALIDATOR_ADDR..."
    forge verify-contract \
        --chain "$CHAIN_ID" \
        --etherscan-api-key "$ETHERSCAN_API_KEY" \
        --verifier-url "$VERIFIER_URL" \
        --watch \
        --constructor-args "$(cast abi-encode 'constructor(uint256,uint256)' 3 5)" \
        "$VALIDATOR_ADDRESS" \
        "$CONTRACTS_DIR/BridgeValidator.sol:BridgeValidator" \
        || echo "WARN: BridgeValidator verification failed or already verified"
fi

echo ""
echo "════════════════════════════════════════════════════════════"
echo "  Verification complete"
echo "════════════════════════════════════════════════════════════"
echo "  Check status at:"
echo "    wZION:      ${VERIFIER_URL/api-/}/address/$WZION_ADDRESS"
echo "    ZIONBridge: ${VERIFIER_URL/api-/}/address/$BRIDGE_ADDRESS"
