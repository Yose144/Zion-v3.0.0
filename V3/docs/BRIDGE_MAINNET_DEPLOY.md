# ZION Bridge — Base Mainnet Deployment Runbook

> **Status:** Pre-deployment — contracts not yet deployed on Base Mainnet.
> **Mainnet guardian model:** 5-of-5 multisig.

## Pre-Flight Checklist

Before deploying to Base Mainnet, ALL items must be checked:

| # | Item | Status |
|---|------|--------|
| 1 | Contracts audited by external firm | ☐ |
| 2 | 5/5 Guardian multisig provisioned | ☐ |
| 3 | BaseScan API key ready | ☐ |
| 4 | Deployer wallet funded with ≥0.05 ETH on Base | ☐ |
| 5 | Guardian wallets funded with ≥0.01 ETH each (relay gas) | ☐ |
| 6 | Testnet 2/2 deployment verified and battle-tested | ✅ |
| 7 | `bridge-mainnet.toml` configured with 5/5 placeholders | ✅ |
| 8 | Relay Docker image built and tested | ☐ |
| 9 | Website bridge page updated with mainnet addresses | ☐ |
| 10 | Alertmanager Discord webhook configured | ☐ |

## Step 1: Environment Setup

```bash
# On Edge server (Hetzner) or secure deploy machine
export PRIVATE_KEY=0x...        # Deployer hardware wallet
export BASE_RPC=https://base-mainnet.publicnode.com
export ETHERSCAN_API_KEY=...    # From basescan.org/apis

# Verify balance
cast balance $(cast wallet address --private-key $PRIVATE_KEY) --rpc-url $BASE_RPC
```

## Step 2: Deploy Contracts

```bash
./scripts/deploy-bridge-base.sh base
```

Expected output:
```
wZION deployed at:     0x...
ZIONBridge deployed at: 0x...
BridgeValidator deployed at: 0x...
```

Record addresses in `V3/config/bridge-mainnet.toml`.

## Step 3: Verify on BaseScan

```bash
export WZION_ADDRESS=0x...
export BRIDGE_ADDRESS=0x...
export VALIDATOR_ADDRESS=0x...
./scripts/verify-bridge-base.sh base
```

## Step 4: Configure 5/5 Multisig

```bash
cast send $VALIDATOR_ADDRESS \
  "addGuardian(address)" 0xGuardian2 \
  --private-key $PRIVATE_KEY --rpc-url $BASE_RPC

# Repeat for Guardian 3, 4, 5

cast send $VALIDATOR_ADDRESS \
  "addGuardian(address)" 0xGuardian3 \
  --private-key $PRIVATE_KEY --rpc-url $BASE_RPC

# Verify guardian count
cast call $VALIDATOR_ADDRESS "guardianCount()" --rpc-url $BASE_RPC
# → 5
```

## Step 5: Configure Relay

Edit `V3/config/bridge-mainnet.toml`:

```toml
[bridge]
name = "ZION Bridge Relay V3"
version = "3.0.2"
network = "mainnet"

[[evm_chains]]
chain_id = "base"
evm_chain_id = 8453
wzion_address = "0x..."
bridge_contract_address = "0x..."
enabled = true
start_block = 0  # set to deployment block

[validator]
threshold = 5
total_validators = 5
validator_addresses = [
  "0xGuardian1",
  "0xGuardian2",
  "0xGuardian3",
  "0xGuardian4",
  "0xGuardian5",
]
```

## Step 6: Start Relay

```bash
docker compose -f V3/docker/docker-compose.yml --profile mainnet up -d bridge
```

## Step 7: Website Sync

Update these files with mainnet addresses:
- `APP&WEB/website-v2.9/src/lib/bridge-api.ts`
  - `BRIDGE_CONTRACTS.chain_id = 8453`
  - `BRIDGE_CONTRACTS.network = "Base Mainnet"`
  - `BRIDGE_CONTRACTS.explorer_base = "https://basescan.org/address/"`
  - `BASE_SEPOLIA_CHAIN_ID` → rename back to `BASE_CHAIN_ID = 8453`
  - `switchToBaseSepolia()` → `switchToBase()` with mainnet RPC

- `APP&WEB/website-v2.9/src/app/bridge/page.tsx`
  - All "Base Sepolia Testnet" → "Base Mainnet"

- `APP&WEB/desktop-agent/src/ui/index.html`
  - `bridge-status-chip` text

## Step 8: Monitor & Alert

Verify relay metrics are flowing:
```bash
curl http://localhost:9102/metrics | grep zion_bridge
```

Confirm Alertmanager fires on:
- `zion_bridge_errors_total > 0`
- `zion_bridge_last_evm_block` stale for > 5 min
- `zion_bridge_last_l1_height` stale for > 10 min

## Rollback Plan

If critical issue detected within 24h:
1. Guardian multisig calls `pause()` on ZIONBridge
2. Stop relay: `docker compose stop bridge`
3. Investigate on Base Sepolia testnet
4. Deploy fixed contracts and migrate state (if possible)

## Current Mainnet Status

**Not yet deployed.**

Template `V3/config/bridge-mainnet.toml` is configured for 5/5 multisig with placeholder addresses.
Target date: TBD — pending external audit completion and 5/5 Guardian provisioning.
