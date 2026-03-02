# ZION DeFi — Plán a stav (březen 2026)

> Živý dokument. Aktualizuj při každém milníku.  
> Síť: **Base Sepolia (testnet)** → **Base Mainnet** (po auditu)

---

## Přehled architektury

```
L1 (ZION chain)
  └── ZIONCore (Rust/axum)
        ├── bridge vault     — wZION ↔ ZION (live ✅)
        └── swap escrow      — HTLC atomic swaps (S-01..S-05 ✅)

L2 (Base / EVM)
  ├── wZION.sol              ERC-20 wrapped ZION           ✅ LIVE
  ├── ZIONBridge.sol         lock/mint/burn bridge         ✅ LIVE
  ├── ZIONGovernance.sol     token governance + staking    ✅ LIVE (Base Sepolia)
  ├── ZIONTreasury.sol       multi-sig treasury + DAO      ✅ LIVE (Base Sepolia)
  ├── ZIONStaking.sol        stake wZION, earn APR         ✅ LIVE (Base Sepolia)
  ├── Uniswap V3 pool        wZION/WETH 0.3%               ✅ LIVE (Base Sepolia) — seed pending
  ├── ZIONAtomicSwap.sol     EVM HTLC (ETH/ERC-20 strana)  ✅ LIVE (Base Sepolia)
  └── ZIONFarm.sol           MasterChef yield farming       ✅ LIVE (Base Sepolia)

L2/atomic-swap (Rust daemon)
  ├── HTLC watcher           čte L1 SWAP:LOCK/CLAIM/REFUND ✅ hotovo
  ├── Executor               podepisuje + odesílá L1 TX    ✅ hotovo
  └── HTTP API               /swap/claim /swap/refund      ✅ hotovo
```

---

## Adresy (Base Sepolia testnet)

| Kontrakt | Adresa |
|---|---|
| wZION ERC-20 | `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` |
| ZIONBridge | `0xF4BF85443ad6c9b88f3a5314cC3Fb59C32Cedca1` |
| **ZIONGovernance** | **`0x039F730e3e1c3f36da95187697118791762290a1`** |
| **ZIONTreasury** | **`0x178d85323dC94Ce2477269Dfb93a12D04B9bE537`** (1-of-1, testnet) |
| **ZIONStaking** | **`0x487D87E243f87b1DDEEDEB890c40F2cEcCf67913`** (APR 12%) |
| **wZION/WETH Uni V3 pool** | **`0xcCEaD51568E8d701f7db7e6699F3986031F07C7B`** (0.3%, initialized) |
| **ZIONAtomicSwap** | **`0xAf1E0645Ac409485EDA5EabD87b4eE3C3a5BA3Fc`** |
| **ZIONFarm** | **`0x1B8BA92C401d53cBcEc422BAD4b83fABcb0A3843`** (Pool 0: 500 wZION seeded) |

> Stav k **2026-03-** — Base Sepolia. Před Mainnetem nutný audit + testery.  
> `deployed-defi.json` uložen v `L2/contracts/`.

---

## ✅ Hotovo

### Infrastruktura
- [x] **wZION ERC-20** — nasazeno na Base Sepolia `0x0c4937...`
- [x] **ZIONBridge** — nasazeno, bridge relay běží, vault key SET
- [x] **BridgeBurnWidget** — MetaMask widget na webu (page.tsx), commit `3d7e8e3`
- [x] **BRIDGE_VAULT_ADDR** — opravena adresa v desktop-agent, commit `2ac8194`

### DeFi kontrakty (napsáno, kompiluje, 94/96 testů ✅)
- [x] **ZIONStaking.sol** — Synthetix-style staking, APR bps, 7-day cooldown
  - `stake()` / `queueUnstake()` / `unstake()` / `claimRewards()`
  - `GUARDIAN_ROLE` + `REWARD_FUNDER_ROLE` + emergency withdraw
  - `votingWeight(address)` — přidává váhu ke governance
- [x] **ZIONGovernance.sol** — ERC20-votes governance + staking weight
  - `_votingPower(addr) = balance + stakingContract.votingWeight(addr)`
  - `setStakingContract(addr)` onlyOwner
- [x] **ZIONTreasury.sol** — multi-sig treasury, milestones, spending proposals
- [x] **deploy-defi.ts** — deploys Governance → Treasury → Staking
  - testnet: auto-pad na 3 sgnery (deployer×3)
  - uloží `deployed-defi.json`
- [x] **dex-config.ts** — opravena wZION adresa, Uniswap V3 konfig připraven
- [x] **deploy-pool.ts** — skript na deploy wZION/WETH Uni V3 pool
- [x] **seed-liquidity.ts** — skript pro seed likvidity
- [x] **hardhat.config.ts** — `viaIR: true` (fix stack-too-deep)

### Atomic Swaps — `L2/atomic-swap/` Rust crate (8/8 testů ✅)
- [x] **S-01 types.rs** — `SwapHash`, `SwapPreimage`, `HtlcRecord`, `SwapMemo`
  - parser: `SWAP:LOCK/CLAIM/REFUND` memo formát
- [x] **S-02 db.rs** — SQLite persistence, watcher state
- [x] **S-03 watcher.rs** — L1 block scanner, detekuje LOCK/CLAIM/REFUND
- [x] **S-04 executor.rs** — coin-select + podpis + odeslání L1 release TX
- [x] **S-05 handlers.rs + main.rs** — axum HTTP API
  - `GET /swap/escrow-address`
  - `GET /swap/:hash`
  - `POST /swap/claim { hash_hex, preimage_hex, recipient }`
  - `POST /swap/refund { hash_hex }`
  - `GET /swap/pending`
- [x] **L1 `/api/swap/escrow-address`** — endpoint v L1 core (methods.rs)

---

## 🔲 Plán — co zbývá

### Fáze 1 — Deploy DeFi kontraktů na Base Sepolia (priorita HIGH)

| # | Úkol | Skript | Odhadovaný čas |
|---|------|--------|----------------|
| D-01 | Deploy Governance + Treasury + Staking | `deploy-defi.ts` | 30 min |
| D-02 | Ověření na BaseScan | `verify.ts` | 30 min |
| D-03 | Seed rewardů do ZIONStaking (fundRewardPool) | ruční TX | 15 min |
| D-04 | Nastavit `stakingContract` v Governance | deploy-defi.ts auto | — |

```bash
# D-01
cd L2/contracts
npx hardhat run scripts/deploy-defi.ts --network base-sepolia
```

### Fáze 2 — Uniswap V3 Pool + likvidita (priorita HIGH)

| # | Úkol | Skript | Odhadovaný čas |
|---|------|--------|----------------|
| P-01 | Deploy wZION/WETH pool (0.3% fee tier) | `deploy-pool.ts` | 20 min |
| P-02 | Seed počáteční likvidity (full-range position) | `seed-liquidity.ts` | 30 min |
| P-03 | Ověřit cenu + tick na BaseScan / Uniswap UI | ruční | 15 min |

```bash
# P-01
npx hardhat run scripts/deploy-pool.ts --network base-sepolia

# P-02
npx hardhat run scripts/seed-liquidity.ts --network base-sepolia
```

### Fáze 3 — EVM HTLC kontrakt ✅ DONE

| # | Úkol | Stav |
|---|------|------|
| S-06 | `ZIONAtomicSwap.sol` — HTLC pro ETH/ERC-20 | ✅ LIVE `0xAf1E0645...` |
| S-07 | Testy ZIONAtomicSwap (19/19) | ✅ |
| S-08 | Deploy na Base Sepolia | ✅ commit `c696d99` |
| S-09 | EVM watcher (`evm_watcher.rs`, 15/15 testů) | ✅ commit `c696d99` |
| S-10 | E2E test: ZION ↔ ETH swap (testnet) | 🔲 pending |

### Fáze 4 — Yield Farming ✅ DONE

| # | Úkol | Stav |
|---|------|------|
| F-01 | `ZIONFarm.sol` — MasterChef, stake LP, earn wZION | ✅ LIVE `0x1B8BA9...` |
| F-02 | 17/17 testů | ✅ |
| F-03 | Pool 0 seeded (500 wZION) | ✅ |
| F-04 | Frontend widget | 🔲 pending |

### Fáze 5 — Mainnet deploy (po auditu)

| # | Úkol | Podmínka |
|---|------|----------|
| M-01 | Audit ZIONBridge + ZIONStaking + ZIONGovernance | externí auditor |
| M-02 | Deploy všech kontraktů na Base Mainnet | po auditu |
| M-03 | Přesun likvidity testnet → mainnet | po M-02 |
| M-04 | Veřejné oznámení DeFi launch | po M-03 |

---

## HTLC Memo protokol (L1)

Všechny SWAP transakce jdou na **escrow adresu** (odvozena z `ZION_SWAP_ESCROW_KEY`):

```
LOCK:    SWAP:LOCK:<hash64hex>:<timeout_min>:<chain>:<counterparty_addr>
CLAIM:   SWAP:CLAIM:<hash64hex>:<preimage64hex>
REFUND:  SWAP:REFUND:<hash64hex>
```

---

## Přehledová tabulka stavu

| Komponenta | Stav | Commit/Adresa |
|---|---|---|
| wZION ERC-20 | ✅ LIVE | `0x0c4937...` |
| ZIONBridge | ✅ LIVE | `0xF4BF85...` |
| BridgeBurnWidget (web) | ✅ hotovo | `3d7e8e3` |
| ZIONAtomicSwap.sol | ✅ LIVE Base Sepolia | `0xAf1E06...` |
| ZIONFarm.sol + Pool 0 seeded | ✅ LIVE Base Sepolia | `0x1B8BA9...` |
| **ZIONGovernance.sol** | **✅ LIVE Base Sepolia** | **`0x039F73...`** |
| **ZIONTreasury.sol** (1-of-1 testnet) | **✅ LIVE Base Sepolia** | **`0x178d85...`** |
| **ZIONStaking.sol** (APR 12%) | **✅ LIVE Base Sepolia** | **`0x487D87...`** |
| **wZION/WETH Uni V3 pool** (0.3%) | **✅ LIVE Base Sepolia** | **`0xcCEaD5...`** |
| seed-liquidity (LP pozice) | 🔲 TODO | — |
| E2E atomic swap test | 🔲 TODO | — |
| Mainnet deploy | 🔲 po auditu | — |

---

## Rychlý start pro další session

```powershell
# Seed likvidity do Uniswap V3 poolu
cd L2/contracts
npx hardhat run scripts/seed-liquidity.ts --network base-sepolia

# Spustit atomic-swap daemon lokálně
$env:ZION_SWAP_ESCROW_KEY = "..."
$env:ZION_RPC_TOKEN = "..."
cargo run -p zion-atomic-swap -- --config L2/atomic-swap/atomic-swap-testnet.toml
```
