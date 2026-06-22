#!/usr/bin/env bash
# ZION V3 — Bridge Contract Deployment Script (Foundry)
#
# Usage:
#   export PRIVATE_KEY=0x...
#   export BASE_RPC=https://base-mainnet.publicnode.com
#   ./scripts/deploy-bridge-base.sh [base|base-sepolia]
#
# Prerequisites:
#   - Foundry (forge, cast, anvil): https://foundry.paradigm.xyz
#   - ETH in deployer wallet for gas
#   - Contracts in V3/L2/bridge/contracts/ (or external repo)

set -euo pipefail

NETWORK="${1:-base-sepolia}"
PRIVATE_KEY="${PRIVATE_KEY:-}"
RPC_URL="${BASE_RPC:-}"

if [ -z "$PRIVATE_KEY" ]; then
    echo "ERROR: PRIVATE_KEY env var not set"
    echo "  export PRIVATE_KEY=0x..."
    exit 1
fi

if [ -z "$RPC_URL" ]; then
    case "$NETWORK" in
        base)
            RPC_URL="https://base-mainnet.publicnode.com"
            ;;
        base-sepolia)
            RPC_URL="https://sepolia.base.org"
            ;;
        *)
            echo "ERROR: Unknown network: $NETWORK"
            echo "Supported: base, base-sepolia"
            exit 1
            ;;
    esac
    echo "Using default RPC for $NETWORK: $RPC_URL"
fi

echo "════════════════════════════════════════════════════════════"
echo "  ZION Bridge Contract Deployment"
echo "  Network: $NETWORK"
echo "  RPC:     $RPC_URL"
echo "════════════════════════════════════════════════════════════"

# Verify forge is installed
if ! command -v forge &> /dev/null; then
    echo "ERROR: forge not found. Install Foundry:"
    echo "  curl -L https://foundry.paradigm.xyz | bash"
    exit 1
fi

# TODO: Add actual contract paths when Solidity source is available.
# Expected layout:
#   V3/L2/bridge/contracts/
#     wZION.sol
#     ZIONBridge.sol
#     BridgeValidator.sol

CONTRACTS_DIR="V3/L2/bridge/contracts"
if [ ! -d "$CONTRACTS_DIR" ]; then
    echo "WARN: Contract source dir not found at $CONTRACTS_DIR"
    echo "      Create it and add wZION.sol, ZIONBridge.sol, BridgeValidator.sol"
    echo ""
    echo "Deployment steps (manual until contracts are committed):"
    echo "  1. forge create --rpc-url $RPC_URL --private-key $PRIVATE_KEY src/wZION.sol:wZION"
    echo "  2. forge create --rpc-url $RPC_URL --private-key $PRIVATE_KEY src/ZIONBridge.sol:ZIONBridge"
    echo "  3. forge create --rpc-url $RPC_URL --private-key $PRIVATE_KEY src/BridgeValidator.sol:BridgeValidator"
    echo ""
    echo "After deployment, update:"
    echo "  - V3/L2/bridge/tests/mainnet_readiness.rs (wzion_address, bridge_contract_address)"
    echo "  - V3/L3/warp/src/adapter/evm.rs (wzion_contract base address)"
    echo "  - V3/docker/.env.mainnet (bridge env vars)"
    exit 0
fi

echo "Building contracts..."
forge build --root "$CONTRACTS_DIR"

echo ""
echo "Deploying wZION..."
WZION_ADDR=$(forge create --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY" --root "$CONTRACTS_DIR" "src/wZION.sol:wZION" --json | jq -r '.deployedTo')
echo "  wZION deployed at: $WZION_ADDR"

echo ""
echo "Deploying ZIONBridge..."
BRIDGE_ADDR=$(forge create --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY" --root "$CONTRACTS_DIR" "src/ZIONBridge.sol:ZIONBridge" --constructor-args "$WZION_ADDR" --json | jq -r '.deployedTo')
echo "  ZIONBridge deployed at: $BRIDGE_ADDR"

echo ""
echo "Deploying BridgeValidator (5/5 multisig)..."
VALIDATOR_ADDR=$(forge create --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY" --root "$CONTRACTS_DIR" "src/BridgeValidator.sol:BridgeValidator" --constructor-args 5 5 --json | jq -r '.deployedTo')
echo "  BridgeValidator deployed at: $VALIDATOR_ADDR"

echo ""
echo "════════════════════════════════════════════════════════════"
echo "  Deployment Summary ($NETWORK)"
echo "════════════════════════════════════════════════════════════"
echo "  wZION:           $WZION_ADDR"
echo "  ZIONBridge:      $BRIDGE_ADDR"
echo "  BridgeValidator: $VALIDATOR_ADDR"
echo ""
echo "  Next steps:"
echo "    1. Update V3/L2/bridge/tests/mainnet_readiness.rs"
echo "    2. Update V3/L3/warp/src/adapter/evm.rs"
echo "    3. Enable 'enabled: true' for base mainnet in bridge config"
echo "    4. Fund validator wallets with ETH for relay gas"
echo "════════════════════════════════════════════════════════════"
