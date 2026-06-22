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

**✅ Deployed — 5/5 bridge is live.**

The website `https://zionterranova.com/defi` already advertises live Base Mainnet contracts. A new 5/5 bridge has been deployed and wZION `BRIDGE_ROLE` migrated.

| Contract | Address | Status |
|----------|---------|--------|
| wZION | `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` | ✅ Exists, totalSupply > 0 |
| ZIONBridge (new, 5/5) | `0x89504D6eD6993d726438E1A9C18aaC79e8d0eF88` | ✅ threshold = 5, validatorCount = 5 |
| BridgeValidator (new, 5/5) | `0x9C138dC6ebA8A883AB3802F6Dcb79C772a835627` | ✅ threshold = 5, guardianCount = 5 |
| ZIONBridge (old, single-sig) | `0xa5a09b2C09A7182BBA9623A2D2cd46cD7D041721` | ❌ BRIDGE_ROLE revoked |
| UniV3Pool | `0xa88C4C89EB4597Df2e29A8061895300FcDF44FBB` | ✅ Listed on website |

**Guardian / validator addresses (funded):**

| # | Address | Balance (Base mainnet) | Role |
|---|---------|------------------------|------|
| 1 | `0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186` | 0.002102 ETH | Deployer + Guardian + Validator |
| 2 | `0x24d986841E56e5571489B25951eE8C1Ae761FA82` | 0.001000 ETH | Guardian + Validator |
| 3 | `0x665c55eDCF25c2c5A1dfF1B20eE950cBDC58d3d0` | 0.001000 ETH | Guardian + Validator |
| 4 | `0x8E644b3E9FaBf52eE321DC5B3D5AA06d6e3E66C6` | 0.001000 ETH | Guardian + Validator |
| 5 | `0x7e0D2eD71d78B9CFB5034A83333e82e304bc4CB2` | 0.001000 ETH | Guardian + Validator |

All 5 addresses are funded with minimum operational ETH (~0.0061 ETH total). Recommended: top up to ≥0.01 ETH each before high-volume operations.

Target date: **DONE** — 2026-06-22. Next step: start mainnet relay and monitor.
