#!/usr/bin/env bash
# ZION V3 — Bridge Guardian Key Provisioning Script
#
# Usage:
#   ./scripts/provision-bridge-validators.sh [network]
#
# Generates 5 EVM guardian addresses, stores private keys OFF-REPO,
# creates guardians.json (public addresses only), and prints deploy commands.
#
# Prerequisites:
#   - Foundry (cast): https://foundry.paradigm.xyz
#   - ETH in deployer wallet for gas (Sepolia or Mainnet)
#
# SECURITY: Private keys are NEVER committed. They are written to
#   .bridge-validators/*.key (already in .gitignore).

set -euo pipefail

NETWORK="${1:-base-sepolia}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
KEYS_DIR="${REPO_ROOT}/.bridge-validators"
CONFIG_DIR="${REPO_ROOT}/V3/config"

mkdir -p "${KEYS_DIR}" "${CONFIG_DIR}"

echo "════════════════════════════════════════════════════════════"
echo "  ZION Bridge Guardian Provisioning"
echo "  Network: ${NETWORK}"
echo "════════════════════════════════════════════════════════════"
echo ""

# Verify cast is available
if ! command -v cast &> /dev/null; then
    echo "ERROR: cast (Foundry) not found. Install:"
    echo "  curl -L https://foundry.paradigm.xyz | bash"
    exit 1
fi

# ── Step 1: Generate 5 wallets ──────────────────────────────

echo "Generating 5 guardian wallets..."
echo "Private keys will be saved to: ${KEYS_DIR}/"
echo ""

GUARDIAN_JSON='{"guardians":['
FIRST=true

for i in $(seq 1 5); do
    KEY_FILE="${KEYS_DIR}/guardian_${i}.key"
    if [ -f "${KEY_FILE}" ]; then
        echo "  Guardian ${i}: already exists (${KEY_FILE}) — skipping generation"
        PRIV_KEY=$(cat "${KEY_FILE}")
    else
        # Generate new wallet via cast
        WALLET_JSON=$(cast wallet new --json)
        PRIV_KEY=$(echo "${WALLET_JSON}" | jq -r '.[0].private_key')
        ADDRESS=$(echo "${WALLET_JSON}" | jq -r '.[0].address')
        echo "${PRIV_KEY}" > "${KEY_FILE}"
        chmod 600 "${KEY_FILE}"
        echo "  Guardian ${i}: ${ADDRESS}  →  ${KEY_FILE}"
    fi

    ADDRESS=$(cast wallet address --private-key "${PRIV_KEY}")

    if [ "${FIRST}" = true ]; then
        FIRST=false
    else
        GUARDIAN_JSON="${GUARDIAN_JSON},"
    fi
    GUARDIAN_JSON="${GUARDIAN_JSON}{\"index\":${i},\"address\":\"${ADDRESS}\",\"role\":\"guardian\"}"
done

GUARDIAN_JSON="${GUARDIAN_JSON}],\"threshold\":3,\"total\":5,\"network\":\"${NETWORK}\"}"

# ── Step 2: Write public config ───────────────────────────

GUARDIANS_FILE="${CONFIG_DIR}/guardians-${NETWORK}.json"
echo "${GUARDIAN_JSON}" | jq . > "${GUARDIANS_FILE}"
echo ""
echo "Public guardian list saved: ${GUARDIANS_FILE}"
echo ""

# ── Step 3: Print deploy instructions ─────────────────────

echo "════════════════════════════════════════════════════════════"
echo "  Next Steps (MANUAL — requires deployer private key)"
echo "════════════════════════════════════════════════════════════"
echo ""

DEPLOYER_KEY="${DEPLOYER_PRIVATE_KEY:-<YOUR_DEPLOYER_PRIVATE_KEY>}"

case "$NETWORK" in
    base)
        RPC_URL="https://base-mainnet.publicnode.com"
        CHAIN_ID=8453
        ;;
    base-sepolia)
        RPC_URL="https://sepolia.base.org"
        CHAIN_ID=84532
        ;;
    *)
        echo "ERROR: Unknown network: $NETWORK"
        exit 1
        ;;
esac

# Extract addresses for the deploy commands
ADDRS=$(echo "${GUARDIAN_JSON}" | jq -r '.guardians[].address')

# Deployer is Guardian #1 by default (already in config)
DEPLOYER_ADDR=$(echo "${GUARDIAN_JSON}" | jq -r '.guardians[0].address')

echo "1) Ensure deployer wallet has ETH for gas:"
echo "   cast balance ${DEPLOYER_ADDR} --rpc-url ${RPC_URL}"
echo ""

echo "2) Deploy BridgeValidator contract (3/5 multisig):"
echo "   export PRIVATE_KEY=${DEPLOYER_KEY}"
echo "   export RPC_URL=${RPC_URL}"
echo ""

# If Solidity source exists, use forge create; otherwise cast send to existing bytecode
CONTRACTS_DIR="V3/L2/bridge/contracts"
if [ -d "${REPO_ROOT}/${CONTRACTS_DIR}" ]; then
    echo "   forge create --rpc-url \$RPC_URL --private-key \$PRIVATE_KEY \\"
    echo "     --root ${CONTRACTS_DIR} src/BridgeValidator.sol:BridgeValidator \\"
    echo "     --constructor-args 3 5"
else
    echo "   # BridgeValidator.sol not found at ${CONTRACTS_DIR}"
    echo "   # Deploy manually or copy source from archive, then:"
    echo "   # forge create --rpc-url \$RPC_URL --private-key \$PRIVATE_KEY \\"
    echo "   #   --root ${CONTRACTS_DIR} src/BridgeValidator.sol:BridgeValidator --constructor-args 3 5"
fi

echo ""
echo "3) Add remaining 4 guardians (run each after deploy):"

IDX=2
for ADDR in ${ADDRS}; do
    if [ "${IDX}" -gt 1 ]; then
        # Skip deployer (Guardian 1) — already added by constructor
        echo "   cast send <VALIDATOR_CONTRACT_ADDRESS> \"addGuardian(address)\" ${ADDR} \\"
        echo "     --private-key \$PRIVATE_KEY --rpc-url \$RPC_URL"
    fi
    IDX=$((IDX + 1))
done

echo ""
echo "4) Verify on BaseScan:"
echo "   export ETHERSCAN_API_KEY=<your_key>"
echo "   forge verify-contract --chain ${CHAIN_ID} --etherscan-api-key \$ETHERSCAN_API_KEY \\"
echo "     --watch <VALIDATOR_CONTRACT_ADDRESS> \\"
echo "     ${CONTRACTS_DIR}/BridgeValidator.sol:BridgeValidator \\"
echo "     --constructor-args \$(cast abi-encode 'constructor(uint256,uint256)' 3 5)"
echo ""

echo "5) Update relay config:"
echo "   cp ${GUARDIANS_FILE} V3/config/bridge-${NETWORK}.toml  # merge into TOML"
echo ""

echo "════════════════════════════════════════════════════════════"
echo "  CRITICAL SECURITY REMINDERS"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "• NEVER commit ${KEYS_DIR}/ to git (already in .gitignore)."
echo "• Store each .key file on a SEPARATE hardware wallet (Ledger/Trezor)."
echo "• Distribute guardians geographically (≥3 time zones)."
echo "• Run 'shred -n 3 -z -u' on .key files AFTER importing to hardware."
echo "• Keep 1 guardian as cold-storage (air-gapped, never online)."
echo ""

echo "Guardian addresses:"
echo "${GUARDIAN_JSON}" | jq -r '.guardians[] | "  [\(.index)] \(.address)  (\(.role))"'
