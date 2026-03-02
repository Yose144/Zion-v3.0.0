# ZION DeFi — Stav a Mainnet návod (2. března 2026)

> Živý dokument. Aktualizuj při každém milníku.  
> Síť: **Base Sepolia (testnet)** ✅ → **Base Mainnet** (po auditu)

---

## Přehled architektury

```
L1 (ZION chain)
  └── ZIONCore (Rust/axum)
        ├── bridge vault        — wZION ↔ ZION (live ✅)
        └── swap escrow         — HTLC atomic swaps (S-01..S-05 ✅)

L2 (Base / EVM)
  ├── wZION.sol                 ERC-20 wrapped ZION           ✅ LIVE testnet + mainnet ready
  ├── ZIONBridge.sol            lock/mint/burn bridge         ✅ LIVE testnet
  ├── ZIONGovernance.sol        token governance + staking    ✅ LIVE Base Sepolia
  ├── ZIONTreasury.sol          multi-sig treasury + DAO      ✅ LIVE Base Sepolia (1-of-1)
  ├── ZIONStaking.sol           stake wZION, earn APR 12%     ✅ LIVE Base Sepolia
  ├── Uniswap V3 pool           wZION/WETH 0.3%               ✅ LIVE Base Sepolia (seed pending)
  ├── ZIONAtomicSwap.sol        EVM HTLC (ETH/ERC-20)         ✅ LIVE Base Sepolia
  └── ZIONFarm.sol              MasterChef yield farming       ✅ LIVE Base Sepolia (500 wZION)

L2/atomic-swap (Rust daemon)
  ├── HTLC watcher              čte L1 SWAP:LOCK/CLAIM/REFUND ✅ hotovo
  ├── Executor                  podepisuje + odesílá L1 TX    ✅ hotovo
  └── HTTP API                  /swap/claim /swap/refund      ✅ hotovo
```

---

## Adresy — Base Sepolia testnet

| Kontrakt | Adresa | Poznámka |
|---|---|---|
| wZION ERC-20 | `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` | |
| ZIONBridge | `0xF4BF85443ad6c9b88f3a5314cC3Fb59C32Cedca1` | relay běží |
| ZIONAtomicSwap | `0xAf1E0645Ac409485EDA5EabD87b4eE3C3a5BA3Fc` | |
| ZIONFarm | `0x1B8BA92C401d53cBcEc422BAD4b83fABcb0A3843` | Pool 0: 500 wZION seeded |
| ZIONGovernance | `0x039F730e3e1c3f36da95187697118791762290a1` | staking linked |
| ZIONTreasury | `0x178d85323dC94Ce2477269Dfb93a12D04B9bE537` | 1-of-1, testnet only |
| ZIONStaking | `0x487D87E243f87b1DDEEDEB890c40F2cEcCf67913` | APR 12%, 7d cooldown |
| wZION/WETH Uni V3 | `0xcCEaD51568E8d701f7db7e6699F3986031F07C7B` | 0.3%, tick -99040, seed pending |

> `L2/contracts/deployed-defi.json` obsahuje kompletní výstup deploy skriptů.

---

## ✅ Testnet — co je hotovo (Base Sepolia)

| Komponenta | Stav | Commit |
|---|---|---|
| wZION ERC-20 + ZIONBridge | ✅ LIVE | — |
| BridgeBurnWidget (web) | ✅ | `3d7e8e3` |
| ZIONAtomicSwap.sol (19/19 testů) | ✅ LIVE | `c696d99` |
| evm_watcher.rs (15/15 testů) | ✅ | `c696d99` |
| ZIONFarm.sol (17/17 testů, Pool 0 500 wZION) | ✅ LIVE | `c696d99` |
| ZIONGovernance.sol | ✅ LIVE | `34dc5c2` |
| ZIONTreasury.sol (1-of-1) | ✅ LIVE | `34dc5c2` |
| ZIONStaking.sol (APR 12%) | ✅ LIVE | `34dc5c2` |
| Uniswap V3 pool (inicializován) | ✅ LIVE | `34dc5c2` |

## 🔲 Testnet — zbývá dokončit

| # | Úkol | Příkaz | Poznámka |
|---|------|--------|----------|
| T-1 | Seed Uni V3 likvidity | `npm run dex:seed:sepolia` | Potřeba ~0.01 ETH + 100 wZION — získat z faucetu |
| T-2 | Fund ZIONStaking reward pool | viz níže | Z deployer adresy, 100 wZION stačí na testnet |
| T-3 | E2E atomic swap test | manuální | ZION → lock → EVM claim → ZION release |
| T-4 | Ověření kontraktů na BaseScan | `npm run verify:sepolia` | Volitelné |

```powershell
# T-1: seed Uniswap V3 likvidity
cd L2/contracts
npx hardhat run scripts/seed-liquidity.ts --network base-sepolia

# T-2: fund staking rewards
# V Hardhat skriptu nebo přímo:
npx hardhat console --network base-sepolia
# > const staking = await ethers.getContractAt("ZIONStaking", "0x487D87E243f87b1DDEEDEB890c40F2cEcCf67913")
# > const wzion = await ethers.getContractAt("WZION", "0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6")
# > await wzion.approve(staking.target, ethers.parseUnits("100", 8))
# > await staking.fundRewardPool(ethers.parseUnits("100", 8))
```

---

## 🚀 Mainnet — příprava (podrobný návod)

> Předpoklady: L1 mainnet spuštěn, bridge audit hotov, minimálně 3 podpisovatelé pro treasury.

### Krok 1 — Prerekvizity

**1.1 Připrav multisig adresy** (3–5 členů core teamu):
```
TREASURY_SIGNER1=0x<tvoje-adresa>
TREASURY_SIGNER2=0x<druhý-člen>
TREASURY_SIGNER3=0x<třetí-člen>
```
Na mainnet vyžaduje `ZIONTreasury.sol` minimum **3 podpisy** (konstruktor i `updateRequiredSignatures`).  
Doporučený threshold: **3-of-5**.

**1.2 Bezpečnost deployer klíče**:
- Mainnet deployer = čistá adresa, použita pouze pro deploy, pak zahodit nebo přesunout do hardware wallet
- Po deployi předat `DEFAULT_ADMIN_ROLE` na multisig a deployer renounce

**1.3 Připrav ETH na Base Mainnet**:
- Deploy 8 kontraktů + inicializace + grant role = cca **0.02–0.05 ETH** (Base mainnet je levný)
- Seed likvidity: záleží na požadované hloubce (doporučeno min. 0.1 ETH + 10 000 wZION)

---

### Krok 2 — Opravy pro mainnet

**2.1 ZIONTreasury.sol** — obnovit minimum 3 podpisy:
```solidity
// sol/ZIONTreasury.sol řádky 122 a 501
// TESTNET (aktuálně):
require(_required >= 1, "Minimum 1 signature required"); // mainnet: use >=3
// MAINNET — změnit na:
require(_required >= 3, "Minimum 3 signatures required");
```

**2.2 dex-config.ts** — nastavit mainnet wZION adresu:
```typescript
// scripts/dex-config.ts — BASE_MAINNET_CONFIG
wzionAddress: "0x<wZION-mainnet-adresa>",  // po deployi wZION na Base mainnet
```

**2.3 config/mainnet.toml** — ověř bridge vault a relay adresu.

**2.4 deploy-defi.ts** — mainnet price check:
```typescript
// Zkontroluj, že APR je správný:
const DEFAULT_APR_BPS = 800; // například 8% pro mainnet start
// initialPriceWethPerWzion v dex-config.ts BASE_MAINNET_CONFIG:
initialPriceWethPerWzion: 100_000_000_000_000n, // 0.0001 ETH/ZION — upravit před launchem
```

---

### Krok 3 — Deploy pořadí (mainnet)

```
1. wZION + ZIONBridge        (deploy.ts)
2. ZIONAtomicSwap             (deploy-atomic-swap.ts)
3. ZIONFarm                   (deploy-farm.ts)
4. ZIONGovernance             (deploy-defi.ts — krok 1)
5. ZIONTreasury               (deploy-defi.ts — krok 2, 3-of-5 signers)
6. ZIONStaking                (deploy-defi.ts — krok 3)
7. Uniswap V3 pool            (deploy-pool.ts)
8. Seed likvidity             (seed-liquidity.ts)
```

**Env vars pro mainnet deploy** (ulož do `.env.mainnet`, NIKDY necommituj):
```env
DEPLOYER_PRIVATE_KEY=0x<mainnet-deployer-key>
WZION_ADDRESS=0x<wZION-mainnet>
GUARDIAN_ADDRESS=0x<guardian-multisig>
TREASURY_SIGNER2=0x<signer2>
TREASURY_SIGNER3=0x<signer3>
TREASURY_SIGNER4=0x<signer4>      # volitelné
STAKING_APR_BPS=800               # 8% pro mainnet start
STAKING_SEED_AMOUNT=0             # nejdřív deploy, pak seed přes governance
```

**Spuštění:**
```powershell
cd L2/contracts
# Zkopíruj env
Copy-Item .env.mainnet .env

# Deploy v pořadí
npx hardhat run scripts/deploy.ts --network base
npx hardhat run scripts/deploy-atomic-swap.ts --network base
npx hardhat run scripts/deploy-farm.ts --network base
npx hardhat run scripts/deploy-defi.ts --network base
npx hardhat run scripts/deploy-pool.ts --network base
npx hardhat run scripts/seed-liquidity.ts --network base

# Ověření na BaseScan (potřeba BASESCAN_API_KEY v .env)
npx hardhat run scripts/verify.ts --network base
```

---

### Krok 4 — Post-deploy setup (mainnet)

**4.1 Předání admin práv na multisig:**
```typescript
// Pro každý kontrakt s AccessControl:
await governance.transferOwnership(MULTISIG_ADDR);
await staking.grantRole(DEFAULT_ADMIN_ROLE, MULTISIG_ADDR);
await staking.renounceRole(DEFAULT_ADMIN_ROLE, DEPLOYER_ADDR);
await farm.grantRole(DEFAULT_ADMIN_ROLE, MULTISIG_ADDR);
await farm.renounceRole(DEFAULT_ADMIN_ROLE, DEPLOYER_ADDR);
```

**4.2 Fund ZIONStaking reward pool:**
- Reward pool je financován přes `staking.fundRewardPool(amount)` s `REWARD_FUNDER_ROLE`
- Na mainnet: treasury dostane `REWARD_FUNDER_ROLE` → governance proposal → treasury pošle rewards

**4.3 Fund ZIONFarm reward pool:**
- `farm.fundRewards(amount)` — odeslat plánované odměny (např. 10M wZION na první rok)
- Distribuci kontroluje `rewardsPerSecond` — nastavit dle tokenomiky

**4.4 Nastavit správnou cenu v Uniswap V3:**
- `initialPriceWethPerWzion` musí odpovídat reálné launch ceně
- Spočítat před deployi na základě premine valuation + circulating supply

**4.5 Ověřit BaseScan + Uniswap UI:**
- Verify všechny kontrakty (sourcecode verified = důvěryhodnost)
- Zkusit swap přes [app.uniswap.org](https://app.uniswap.org) — přidat custom token `wZION`

---

### Krok 5 — Bezpečnostní checklist před mainnetem

```
□ ZIONTreasury min. 3 signers (obnov require >= 3 v .sol)
□ Deploy klíč != treasury signer
□ Všechny admin role předány na multisig
□ Deployer DEFAULT_ADMIN_ROLE renounced
□ Bridge vault key v HSM nebo hardware wallet
□ Staking cooldown ponechán 7 dní (ochrana před flash-loan governance attack)
□ Governance proposal threshold nastaven (min. 1M ZION pro proposal)
□ Audit report zveřejněn před launchem
□ Base Sepolia E2E testy proběhly bezchybně
□ seed-liquidity.ts spuštěn s reálnými hodnotami (ne testnet 50 000 gwei/ZION)
□ POOL_FEE_TIER ověřen (0.3% = 3000 pro nový token, 0.05% = 500 až po stabilitě)
```

---

## HTLC Memo protokol (L1)

```
LOCK:    SWAP:LOCK:<hash64hex>:<timeout_min>:<chain>:<counterparty_addr>
CLAIM:   SWAP:CLAIM:<hash64hex>:<preimage64hex>
REFUND:  SWAP:REFUND:<hash64hex>
```

---

## Rychlý start pro příští session

```powershell
# Seed Uniswap V3 likvidity (testnet — zbývá)
cd L2/contracts
npx hardhat run scripts/seed-liquidity.ts --network base-sepolia

# Fund staking (testnet)
npx hardhat console --network base-sepolia

# Atomic-swap daemon lokálně
$env:ZION_SWAP_ESCROW_KEY = "..."
$env:ZION_RPC_TOKEN = "..."
cargo run -p zion-atomic-swap -- --config L2/atomic-swap/atomic-swap-testnet.toml
```


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
