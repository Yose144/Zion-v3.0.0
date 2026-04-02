# L2 Mainnet Status — 30. března 2026

> Kompletní přehled stavu L2 DeFi ekosystému: co je hotové, co je nasazené, co chybí pro Base mainnet.

---

## Souhrnná matice

| Oblast | Kód | Testy | Testnet Deploy | Mainnet Config | Mainnet Deploy |
|---|---|---|---|---|---|
| wZION ERC-20 | ✅ | ✅ ~50 | ✅ Base Sepolia | placeholder | ❌ |
| ZIONBridge (multisig) | ✅ | ✅ ~44 | ✅ Base Sepolia | placeholder | ❌ |
| ZIONAtomicSwap (HTLC) | ✅ | ✅ ~19 | ✅ Base Sepolia | prázdný addr | ❌ |
| ZIONFarm (MasterChef) | ✅ | ✅ ~25 | ✅ Base Sepolia | — | ❌ |
| ZIONGovernance (voting) | ✅ | ⚠️ chybí dedikovaný | ✅ Base Sepolia | — | ❌ |
| ZIONTreasury (multisig) | ✅ | ⚠️ chybí dedikovaný | ✅ Base Sepolia (1/1) | — | ❌ |
| ZIONStaking (APR) | ✅ | ⚠️ chybí dedikovaný | ✅ Base Sepolia | — | ❌ |
| Uniswap V3 Pool | ✅ | — | ✅ seeded | dex-config ready | ❌ |
| Bridge relay (Rust) | ✅ | ✅ 157 | Docker ready | placeholder | ❌ |
| DAO daemon (Rust) | ✅ | ✅ 65 | Docker ready | **chybí config** | ❌ |
| Atomic swap (Rust) | ✅ | ✅ 18 | Docker ready | prázdný addr | ❌ |
| E2E bridge lifecycle | ✅ | ✅ ~21 | — | — | — |

**Celkem: 132 Hardhat testů ✅ · ~240 Rust testů ✅**

---

## ✅ HOTOVÉ (kód kompletní + testy prochází)

### Solidity kontrakty — 7 kontraktů (`L2/contracts/sol/`)

| Kontrakt | LOC | Popis |
|---|---|---|
| `wZION.sol` | 276 | Wrapped ZION ERC-20 (18 dec), BRIDGE_ROLE mint/burn, EIP-2612 permit, MAX_SUPPLY 144B |
| `ZIONBridge.sol` | 412 | Multisig validator controller, timelock >1M wZION, daily limits, pause/unpause |
| `ZIONAtomicSwap.sol` | ~250 | HTLC swap (ETH + ERC-20), lock/claim/refund, fee system, pause |
| `ZIONFarm.sol` | ~300 | MasterChef-style yield farming, multi-pool, halving, emergency withdraw |
| `ZIONGovernance.sol` | ~200 | Token-weighted voting, proposal lifecycle, quorum, timelock |
| `ZIONTreasury.sol` | ~180 | Multi-sig treasury, spend proposals, approval threshold |
| `ZIONStaking.sol` | ~220 | Fixed APR staking (12%), cooldown period, reward pool funding |

### Rust L2 služby — 3 crates (`V3/L2/`)

| Crate | Testů | Moduly |
|---|---|---|
| `zion-bridge` | 157 | ankr, config, db, evm_rpc, evm_tx, evm_watcher, l1_watcher, relayer, validator, metrics |
| `zion-dao` | 65 | api, config, db, executor, humanitarian, l1_scanner, metrics, proposal, quorum, timelock, treasury, voting |
| `zion-atomic-swap` | 18 | config, db, evm_watcher (+Ankr fallback), executor, handlers, watcher |

### Deploy skripty — 9 produkčních (`L2/contracts/scripts/`)

| Skript | Účel |
|---|---|
| `deploy.ts` | wZION + ZIONBridge (grant/revoke BRIDGE_ROLE) |
| `deploy-atomic-swap.ts` | ZIONAtomicSwap (admin + guardian) |
| `deploy-defi.ts` | ZIONGovernance + ZIONTreasury + ZIONStaking |
| `deploy-farm.ts` | ZIONFarm (reward rate + initial pool) |
| `deploy-pool.ts` | Uniswap V3 wZION/WETH pool |
| `seed-liquidity.ts` | Seed LP pozice do Uni V3 |
| `fund-staking.ts` | Fund staking reward pool |
| `fund-farm.ts` | Fund farm rewards |
| `verify.ts` | BaseScan source verification |

### Hardhat config (`hardhat.config.ts`)

- Solidity 0.8.20, optimizer 200 runs, viaIR, EVM Paris
- Networks: `hardhat`, `base-sepolia` (84532), `base` (8453), `arbitrum-sepolia`, `arbitrum`, `bsc-testnet`
- Accounts: `DEPLOYER_PRIVATE_KEY` env var
- Etherscan: BaseScan + ArbScan API keys

### Infra / Docker

- `V3/docker/Dockerfile.bridge` — multi-stage Rust build, bookworm-slim, non-root
- `V3/docker/Dockerfile.dao` — multi-stage Rust build
- `V3/docker/Dockerfile.swap` — multi-stage Rust build
- `V3/docker/docker-compose.v3-l2.yml` — all 3 L2 services + volumes + host networking

---

## ✅ NASAZENO NA TESTNET (Base Sepolia, chain ID 84532)

### Smart kontrakty

| Kontrakt | Adresa | Poznámka |
|---|---|---|
| wZION | `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` | 700 wZION mintováno |
| ZIONBridge | `0xF4BF85443ad6c9b88f3a5314cC3Fb59C32Cedca1` | threshold=1, 2 validátory |
| ZIONAtomicSwap | `0xAf1E0645Ac409485EDA5EabD87b4eE3C3a5BA3Fc` | |
| ZIONGovernance | `0x039F730e3e1c3f36da95187697118791762290a1` | |
| ZIONTreasury | `0x178d85323dC94Ce2477269Dfb93a12D04B9bE537` | 1-of-1 (testnet) |
| ZIONStaking | `0x487D87E243f87b1DDEEDEB890c40F2cEcCf67913` | APR 12%, 7d cooldown, 50 wZION funded |
| ZIONFarm | `0x1B8BA92C401d53cBcEc422BAD4b83fABcb0A3843` | Pool 0: 500 wZION, 3 wZION/s reward rate |
| wZION/WETH Pool | `0xcCEaD51568E8d701f7db7e6699F3986031F07C7B` | Uni V3, 0.3%, 100 wZION + 0.005 WETH |

- Deployer: `0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186`
- Validator 2: `0x8cc6F931edDAf5F14D0071727Ed1640752B5c787`

### L1 server (produkce)

- Prague `91.98.122.165` — L1 nody běží, chain výška 472+, fee-split 89/5/5/1
- 5 seed nodů: EU Prague, EU Frankfurt, US×2, Asia Singapore

---

## ❌ CHYBÍ PRO BASE MAINNET

### Blokovací položky (musí být hotové před deploy)

| # | Položka | Detail | Priorita |
|---|---|---|---|
| 1 | **ETH na Base mainnet** | Deployer `0xdde175...` má 0 ETH na Base mainnet. Potřeba ~0.02-0.05 ETH. | 🔴 |
| 2 | **Chybějící testy: Governance** | `ZIONGovernance.sol` nemá dedikovaný test soubor (`ZIONGovernance.test.ts`) | 🔴 |
| 3 | **Chybějící testy: Treasury** | `ZIONTreasury.sol` nemá dedikovaný test soubor (`ZIONTreasury.test.ts`) | 🔴 |
| 4 | **Chybějící testy: Staking** | `ZIONStaking.sol` nemá dedikovaný test soubor (`ZIONStaking.test.ts`) | 🔴 |
| 5 | **Treasury multisig 3-of-5** | Aktuálně 1-of-1 (testnet). Mainnet vyžaduje min. 3-of-5 signers. | 🔴 |
| 6 | **`dao-mainnet.toml` neexistuje** | Chybí mainnet config pro DAO daemon. | 🟡 |
| 7 | **Stale adresy v testnet config** | `swap-testnet.toml` + `bridge-testnet.toml` odkazují na starý bridge `0xa5a09b...` | 🟡 |
| 8 | **BaseScan verifikace** | Kontrakty nejsou source-verified. Potřeba `BASESCAN_API_KEY`. | 🟡 |
| 9 | **Bridge mainnet placeholder adresy** | `bridge-mainnet.toml`: `wzion_address` + `bridge_contract_address` = `0x0000...` | 🟡 |
| 10 | **Swap mainnet prázdný contract_addr** | `swap-mainnet.toml`: `contract_addr = ""` | 🟡 |

### Podmíněné položky (po deploy kontraktů)

| # | Položka | Detail |
|---|---|---|
| 11 | Aktualizovat `bridge-mainnet.toml` s reálnými adresami + `enabled = true` | |
| 12 | Aktualizovat `swap-mainnet.toml` s `contract_addr` | |
| 13 | Vytvořit `dao-mainnet.toml` s mainnet treasury + governance adresami | |
| 14 | Docker compose přepnout na mainnet configs | |
| 15 | Nasadit L2 služby (bridge, swap, DAO) na server | |
| 16 | Nastavit Ankr premium API key (`ANKR_API_KEY`) | |
| 17 | Nastavit API bearer tokeny pro swap + DAO | |

### Naplánované ale neimplementované (roadmap)

| Feature | Stav | Poznámka |
|---|---|---|
| L1 `/api/bridge/unlock` RPC endpoint | ❌ | Kritické pro EVM→L1 unlock; plánováno jako soft fork |
| Arbitrum deploy | ❌ | Config template existuje, kontrakty ne |
| BSC deploy | ❌ | Config template existuje, kontrakty ne |
| BTC atomic swap | ❌ | bitcoin-rpc integrace v roadmapě, žádný kód |
| XMR atomic swap | ❌ | monero-rpc integrace v roadmapě, žádný kód |
| Uni V3 LP token farming | ❌ | ZIONFarm podporuje jen single-staking (pool 0 = wZION) |
| EVM WebSocket auto-reconnect | ❌ | Bridge TODO B-02 |
| Bridge rate limiter | ❌ | Bridge TODO B-07 |
| DAO executor finalizace | ⚠️ | 3× TODO v `executor.rs` (parameter change, emergency, guardian) |
| Grafana L2 dashboardy | ❌ | Bridge Prometheus port existuje, žádný dashboard |
| CMC / CoinGecko listing | ❌ | Post-DEX, post-volume |

---

## 🚀 DEPLOY POSTUP (až bude ETH na Base mainnet)

```bash
cd L2/contracts

# 1. wZION + ZIONBridge
VALIDATOR2_ADDRESS=0x8cc6F931edDAf5F14D0071727Ed1640752B5c787 \
  npx hardhat run scripts/deploy.ts --network base

# 2. ZIONAtomicSwap
npx hardhat run scripts/deploy-atomic-swap.ts --network base

# 3. DeFi: Governance + Treasury + Staking
npx hardhat run scripts/deploy-defi.ts --network base

# 4. ZIONFarm
npx hardhat run scripts/deploy-farm.ts --network base

# 5. Uniswap V3 pool (potřebuje wZION liquidity)
npx hardhat run scripts/deploy-pool.ts --network base

# 6. Seed liquidity
npx hardhat run scripts/seed-liquidity.ts --network base

# 7. Fund staking + farm rewards
npx hardhat run scripts/fund-staking.ts --network base
npx hardhat run scripts/fund-farm.ts --network base

# 8. BaseScan verifikace
BASESCAN_API_KEY=... npx hardhat run scripts/verify.ts --network base
```

Po deploy aktualizovat:
- `V3/L2/bridge/config/bridge-mainnet.toml` — `wzion_address`, `bridge_contract_address`, `enabled = true`
- `V3/L2/atomic-swap/config/swap-mainnet.toml` — `contract_addr`
- Vytvořit `V3/L2/dao/config/dao-mainnet.toml`
- Rsync configs na server, rebuild Docker images, restart L2 stack

---

## Závěr

**Kód je kompletní.** Všech 7 Solidity kontraktů je napsáno, 4 mají plné testy (wZION, Bridge, AtomicSwap, Farm), 3 potřebují dedikované testy (Governance, Treasury, Staking). Všechny 3 Rust L2 daemony jsou implementované s ~240 testy. Všechno je nasazené na Base Sepolia testnet.

**Mainnet deploy blokuje** primárně: absence ETH na Base mainnet pro gas, chybějící dedikované Hardhat testy pro 3 DeFi kontrakty, a security audit. Kód a infrastruktura jsou připravené — jakmile jsou blokery odstraněny, deploy na Base mainnet je jen série `npx hardhat run` příkazů + config update.
