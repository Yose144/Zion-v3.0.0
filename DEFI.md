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
  ├── ZIONGovernance.sol     token governance + staking    🔨 ready → deploy
  ├── ZIONTreasury.sol       multi-sig treasury + DAO      🔨 ready → deploy
  ├── ZIONStaking.sol        stake wZION, earn APR         🔨 ready → deploy
  ├── Uniswap V3 pool        wZION/WETH 0.3%               🔲 deploy + seed
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
| ZIONGovernance | *nasadit* |
| ZIONTreasury | *nasadit* |
| ZIONStaking | *nasadit* |
| wZION/WETH Uni V3 pool | *nasadit* |
| **ZIONAtomicSwap** | **`0xAf1E0645Ac409485EDA5EabD87b4eE3C3a5BA3Fc`** |
| **ZIONFarm** | **`0x1B8BA92C401d53cBcEc422BAD4b83fABcb0A3843`** |

> Po deployi aktualizuj tabulku z `deployed-defi.json`.

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

### Fáze 3 — EVM HTLC kontrakt (Atomic Swaps EVM strana)

| # | Úkol | Soubor | Odhadovaný čas |
|---|------|--------|----------------|
| S-06 | Napsat `ZIONAtomicSwap.sol` — HTLC pro ETH/ERC-20 | `L2/contracts/sol/` | 4h |
| S-07 | Testy ZIONAtomicSwap | `test/` | 2h |
| S-08 | Deploy na Base Sepolia | `scripts/deploy-atomic-swap.ts` | 30 min |
| S-09 | Propojit s Rust daemonem (watcher pro EVM HTLC events) | `L2/atomic-swap/src/evm_watcher.rs` | 4h |
| S-10 | E2E test: ZION ↔ ETH swap (testnet) | ruční + skript | 2h |

```solidity
// ZIONAtomicSwap.sol — rozhraní
interface IZIONAtomicSwap {
    function lock(bytes32 hash, address token, uint amount, uint timelock) external payable;
    function claim(bytes32 hash, bytes32 preimage) external;
    function refund(bytes32 hash) external;
}
```

### Fáze 4 — Yield Farming / Liquidity Mining

| # | Úkol | Soubor | Odhadovaný čas |
|---|------|--------|----------------|
| F-01 | `ZIONFarm.sol` — stake LP tokeny, earn wZION | `L2/contracts/sol/` | 6h |
| F-02 | Reward schedule (halving každých 90 dní) | `ZIONFarm.sol` | 1h |
| F-03 | Frontend widget (staking + farming dashboard) | `website-v2.9/` | 4h |
| F-04 | Deploy + seed farmingových rewardů | `deploy-farm.ts` | 1h |

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

**Příklad (ZION ↔ BTC):**
1. Alice vygeneruje `S` (32B náhodný), spočítá `H = SHA256(S)`
2. Alice pošle 10 ZION na escrow adresu, memo: `SWAP:LOCK:<H>:120:btc:bc1qbobaddress`
3. Bob vidí LOCK, vytvoří BTC HTLC s `H`, timelock 1h
4. Alice claimne BTC (odhalí `S` na BTC chain)
5. Bob pošle CLAIM TX (nebo zavolá `POST /swap/claim`): `SWAP:CLAIM:<H>:<S>`
6. Daemon ověří `SHA256(S) == H`, uvolní 10 ZION Bobovi
7. Pokud Bob neclaimne do 2h → daemon auto-refunduje ZION Alici

---

## Přehledová tabulka stavu

| Komponenta | Stav | Commit |
|---|---|---|
| wZION ERC-20 nasazen | ✅ LIVE | — |
| ZIONBridge nasazen | ✅ LIVE | — |
| BridgeBurnWidget (web) | ✅ hotovo | `3d7e8e3` |
| ZIONStaking.sol | ✅ kompiluje | `847336b` |
| ZIONGovernance.sol | ✅ kompiluje | `847336b` |
| ZIONTreasury.sol | ✅ kompiluje | `847336b` |
| deploy-defi.ts | ✅ hotovo | `847336b` |
| deploy-pool.ts + dex-config | ✅ hotovo | `847336b` |
| zion-atomic-swap daemon | ✅ 8/8 testů | `93da81c` |
| L1 /api/swap/escrow-address | ✅ hotovo | `93da81c` |
| **Deploy DeFi kontraktů (testnet)** | 🔲 TODO | — |
| **Uniswap V3 pool + seed** | 🔲 TODO | — |
| **ZIONAtomicSwap.sol (EVM HTLC)** | ✅ LIVE Base Sepolia | `c696d99` |
| **ZIONFarm.sol (yield farming)** | ✅ LIVE Base Sepolia | `c696d99` |
| **Mainnet deploy** | 🔲 po auditu | — |

---

## Rychlý start pro další session

```powershell
# 1. Deploy DeFi kontraktů
cd L2/contracts
$env:DEPLOYER_PRIVATE_KEY = "..."
npx hardhat run scripts/deploy-defi.ts --network base-sepolia

# 2. Uniswap V3 pool
npx hardhat run scripts/deploy-pool.ts --network base-sepolia
npx hardhat run scripts/seed-liquidity.ts --network base-sepolia

# 3. Spustit atomic-swap daemon lokálně
$env:ZION_SWAP_ESCROW_KEY = "..."
$env:ZION_RPC_TOKEN = "..."
cargo run -p zion-atomic-swap -- --config L2/atomic-swap/atomic-swap-testnet.toml
```
