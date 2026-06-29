# ZION DeFi Contracts — Hardhat Deploy (3.0.4)

Tento adresář obsahuje Hardhat deploy projekt pro ZION DeFi kontrakty na Base Mainnet.

## Kontrakty

| Kontrakt | Popis | Prerequisita |
|----------|-------|-------------|
| `ZIONGovernance.sol` | On-chain governance (proposals, voting weight) | wZION |
| `ZIONTreasury.sol` | Multisig treasury (5-of-7 po provisioning) | wZION |
| `ZIONStaking.sol` | Single-asset staking (wZION → wZION rewards, 12% APR, 7d cooldown) | wZION |
| `ZIONFarm.sol` | Multi-pool yield farming (MasterChef v2, halving každých 90d) | wZION |

## Stav

- **Sepolia testnet:** deployed 2026-03-02 (viz `../legacy/` pro adresy)
- **Base Mainnet:** ❌ PENDING — čeká na 3.0.4 deploy (~0.005 ETH gas potřeba)

## Prerekvizity

- Node.js 18+
- Deployer wallet `0xdde17506...` s ~0.005 ETH na Base Mainnet
- Basescan API key

## Rychlý start

```bash
# 1. Zkopíruj source files z archive
cp ../../../../../../archive/2.9.9/legacy-code/L2/contracts/sol/ZIONStaking.sol sol/
cp ../../../../../../archive/2.9.9/legacy-code/L2/contracts/sol/ZIONFarm.sol sol/
cp ../../../../../../archive/2.9.9/legacy-code/L2/contracts/sol/ZIONGovernance.sol sol/
cp ../../../../../../archive/2.9.9/legacy-code/L2/contracts/sol/ZIONTreasury.sol sol/

# 2. Zkopíruj deploy skripty
cp ../../../../../../archive/2.9.9/legacy-code/L2/contracts/scripts/deploy-defi.ts scripts/
cp ../../../../../../archive/2.9.9/legacy-code/L2/contracts/scripts/deploy-farm.ts scripts/
cp ../../../../../../archive/2.9.9/legacy-code/L2/contracts/scripts/fund-staking.ts scripts/
cp ../../../../../../archive/2.9.9/legacy-code/L2/contracts/scripts/fund-farm.ts scripts/
cp ../../../../../../archive/2.9.9/legacy-code/L2/contracts/scripts/verify-base-mainnet-basescan.ts scripts/
cp ../../../../../../archive/2.9.9/legacy-code/L2/contracts/hardhat.config.ts .
cp ../../../../../../archive/2.9.9/legacy-code/L2/contracts/package.json .

# 3. Nastav environment
cp .env.mainnet.example .env
# Vyplň DEPLOYER_PRIVATE_KEY, BASE_MAINNET_RPC, BASESCAN_API_KEY

# 4. Instaluj závislosti
npm install

# 5. Deploy
npx hardhat run scripts/deploy-defi.ts --network base    # → deployed-defi.json
npx hardhat run scripts/deploy-farm.ts --network base    # → deployed-farm-base.json

# 6. Verify
npx hardhat run scripts/verify-base-mainnet-basescan.ts --network base
```

## Po deployi — aktualizuj web konfiguraci

```typescript
// APP&WEB/website-v2.9/src/lib/defi-contracts.ts
// Base Mainnet (deployed 3.0.4)
ZIONStaking:    '0x<from deployed-defi.json>',
ZIONFarm:       '0x<from deployed-farm-base.json>',
ZIONGovernance: '0x<from deployed-defi.json>',
ZIONTreasury:   '0x<from deployed-defi.json>',

export const STAKING_DEPLOYED    = true;
export const FARM_DEPLOYED       = true;
export const GOVERNANCE_DEPLOYED = true;
```

## Parametry kontraktů

### ZIONStaking
- **Min stake:** 100 wZION
- **Cooldown:** 7 dní (před unstake)
- **APR:** 12% initial (konfigurovatelné, max 50%)
- **Voting weight:** staked balance = governance vote power

### ZIONFarm
- **Pool 0:** wZION single-asset (100 alloc pts)
- **Pool 1:** wZION/USDT LP positions (50 alloc pts, přidá se po deploy)
- **Reward rate:** 1 wZION/s initial (~86,400 wZION/den)
- **Halving:** každých 90 dní

## Adresář legacy

Původní deploy skripty a kontrakty jsou v:
`archive/2.9.9/legacy-code/L2/contracts/`

- `deployed-defi.json` — Sepolia testnet deploy (2026-03-02)
- `deployed-farm-base-sepolia.json` — Sepolia farm deploy (2026-03-02)
