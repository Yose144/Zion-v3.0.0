# ZION DeFi ÔÇö Stav a Mainnet n├ívod (2. b┼Öezna 2026)

> ┼Żiv├Ż dokument. Aktualizuj p┼Öi ka┼żd├ęm miln├şku.  
> S├ş┼ą: **Base Sepolia (testnet)** Ôťů Ôćĺ **Base Mainnet** (po auditu)

---

## P┼Öehled architektury

```
L1 (ZION chain)
  ÔööÔöÇÔöÇ ZIONCore (Rust/axum)
        ÔöťÔöÇÔöÇ bridge vault        ÔÇö wZION Ôćö ZION (live Ôťů)
        ÔööÔöÇÔöÇ swap escrow         ÔÇö HTLC atomic swaps (S-01..S-05 Ôťů)

L2 (Base / EVM)
  ÔöťÔöÇÔöÇ wZION.sol                 ERC-20 wrapped ZION           Ôťů LIVE testnet + mainnet ready
  ÔöťÔöÇÔöÇ ZIONBridge.sol            lock/mint/burn bridge         Ôťů LIVE testnet
  ÔöťÔöÇÔöÇ ZIONGovernance.sol        token governance + staking    Ôťů LIVE Base Sepolia
  ÔöťÔöÇÔöÇ ZIONTreasury.sol          multi-sig treasury + DAO      Ôťů LIVE Base Sepolia (1-of-1)
  ÔöťÔöÇÔöÇ ZIONStaking.sol           stake wZION, earn APR 12%     Ôťů LIVE Base Sepolia
  ÔöťÔöÇÔöÇ Uniswap V3 pool           wZION/WETH 0.3%               Ôťů LIVE Base Sepolia (seed pending)
  ÔöťÔöÇÔöÇ ZIONAtomicSwap.sol        EVM HTLC (ETH/ERC-20)         Ôťů LIVE Base Sepolia
  ÔööÔöÇÔöÇ ZIONFarm.sol              MasterChef yield farming       Ôťů LIVE Base Sepolia (500 wZION)

L2/atomic-swap (Rust daemon)
  ÔöťÔöÇÔöÇ HTLC watcher              ─Źte L1 SWAP:LOCK/CLAIM/REFUND Ôťů hotovo
  ÔöťÔöÇÔöÇ Executor                  podepisuje + odes├şl├í L1 TX    Ôťů hotovo
  ÔööÔöÇÔöÇ HTTP API                  /swap/claim /swap/refund      Ôťů hotovo
```

---

## Adresy ÔÇö Base Sepolia testnet

| Kontrakt | Adresa | Pozn├ímka |
|---|---|---|
| wZION ERC-20 | `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` | |
| ZIONBridge | `0xF4BF85443ad6c9b88f3a5314cC3Fb59C32Cedca1` | relay b─Ť┼ż├ş |
| ZIONAtomicSwap | `0xAf1E0645Ac409485EDA5EabD87b4eE3C3a5BA3Fc` | |
| ZIONFarm | `0x1B8BA92C401d53cBcEc422BAD4b83fABcb0A3843` | Pool 0: 500 wZION seeded |
| ZIONGovernance | `0x039F730e3e1c3f36da95187697118791762290a1` | staking linked |
| ZIONTreasury | `0x178d85323dC94Ce2477269Dfb93a12D04B9bE537` | 1-of-1, testnet only |
| ZIONStaking | `0x487D87E243f87b1DDEEDEB890c40F2cEcCf67913` | APR 12%, 7d cooldown |
| wZION/WETH Uni V3 | `0xcCEaD51568E8d701f7db7e6699F3986031F07C7B` | 0.3%, tick -99040, seed pending |

> `L2/contracts/deployed-defi.json` obsahuje kompletn├ş v├Żstup deploy skript┼».

---

## Ôťů Testnet ÔÇö co je hotovo (Base Sepolia)

| Komponenta | Stav | Commit |
|---|---|---|
| wZION ERC-20 + ZIONBridge | Ôťů LIVE | ÔÇö |
| BridgeBurnWidget (web) | Ôťů | `3d7e8e3` |
| ZIONAtomicSwap.sol (19/19 test┼») | Ôťů LIVE | `c696d99` |
| evm_watcher.rs (15/15 test┼») | Ôťů | `c696d99` |
| ZIONFarm.sol (17/17 test┼», Pool 0 500 wZION) | Ôťů LIVE | `c696d99` |
| ZIONGovernance.sol | Ôťů LIVE | `34dc5c2` |
| ZIONTreasury.sol (1-of-1) | Ôťů LIVE | `34dc5c2` |
| ZIONStaking.sol (APR 12%) | Ôťů LIVE | `34dc5c2` |
| Uniswap V3 pool (inicializov├ín) | Ôťů LIVE | `34dc5c2` |

## ­čö▓ Testnet ÔÇö zb├Żv├í dokon─Źit

| # | ├Ükol | P┼Ö├şkaz | Pozn├ímka |
|---|------|--------|----------|
| T-1 | Seed Uni V3 likvidity | `npm run dex:seed:sepolia` | Pot┼Öeba ~0.01 ETH + 100 wZION ÔÇö z├şskat z faucetu |
| T-2 | Fund ZIONStaking reward pool | viz n├ş┼że | Z deployer adresy, 100 wZION sta─Ź├ş na testnet |
| T-3 | E2E atomic swap test | manu├íln├ş | ZION Ôćĺ lock Ôćĺ EVM claim Ôćĺ ZION release |
| T-4 | Ov─Ť┼Öen├ş kontrakt┼» na BaseScan | `npm run verify:sepolia` | Voliteln├ę |

```powershell
# T-1: seed Uniswap V3 likvidity
cd L2/contracts
npx hardhat run scripts/seed-liquidity.ts --network base-sepolia

# T-2: fund staking rewards
# V Hardhat skriptu nebo p┼Ö├şmo:
npx hardhat console --network base-sepolia
# > const staking = await ethers.getContractAt("ZIONStaking", "0x487D87E243f87b1DDEEDEB890c40F2cEcCf67913")
# > const wzion = await ethers.getContractAt("WZION", "0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6")
# > await wzion.approve(staking.target, ethers.parseUnits("100", 8))
# > await staking.fundRewardPool(ethers.parseUnits("100", 8))
```

---

## ­čÜÇ Mainnet ÔÇö p┼Ö├şprava (podrobn├Ż n├ívod)

> P┼Öedpoklady: L1 mainnet spu┼ít─Ťn, bridge audit hotov, minim├íln─Ť 3 podpisovatel├ę pro treasury.

### Krok 1 ÔÇö Prerekvizity

**1.1 P┼Öiprav multisig adresy** (3ÔÇô5 ─Źlen┼» core teamu):
```
TREASURY_SIGNER1=0x<tvoje-adresa>
TREASURY_SIGNER2=0x<druh├Ż-─Źlen>
TREASURY_SIGNER3=0x<t┼Öet├ş-─Źlen>
```
Na mainnet vy┼żaduje `ZIONTreasury.sol` minimum **3 podpisy** (konstruktor i `updateRequiredSignatures`).  
Doporu─Źen├Ż threshold: **3-of-5**.

**1.2 Bezpe─Źnost deployer kl├ş─Źe**:
- Mainnet deployer = ─Źist├í adresa, pou┼żita pouze pro deploy, pak zahodit nebo p┼Öesunout do hardware wallet
- Po deployi p┼Öedat `DEFAULT_ADMIN_ROLE` na multisig a deployer renounce

**1.3 P┼Öiprav ETH na Base Mainnet**:
- Deploy 8 kontrakt┼» + inicializace + grant role = cca **0.02ÔÇô0.05 ETH** (Base mainnet je levn├Ż)
- Seed likvidity: z├íle┼ż├ş na po┼żadovan├ę hloubce (doporu─Źeno min. 0.1 ETH + 10 000 wZION)

---

### Krok 2 ÔÇö Opravy pro mainnet

**2.1 ZIONTreasury.sol** ÔÇö obnovit minimum 3 podpisy:
```solidity
// sol/ZIONTreasury.sol ┼Ö├ídky 122 a 501
// TESTNET (aktu├íln─Ť):
require(_required >= 1, "Minimum 1 signature required"); // mainnet: use >=3
// MAINNET ÔÇö zm─Ťnit na:
require(_required >= 3, "Minimum 3 signatures required");
```

**2.2 dex-config.ts** ÔÇö nastavit mainnet wZION adresu:
```typescript
// scripts/dex-config.ts ÔÇö BASE_MAINNET_CONFIG
wzionAddress: "0x<wZION-mainnet-adresa>",  // po deployi wZION na Base mainnet
```

**2.3 config/mainnet.toml** ÔÇö ov─Ť┼Ö bridge vault a relay adresu.

**2.4 deploy-defi.ts** ÔÇö mainnet price check:
```typescript
// Zkontroluj, ┼że APR je spr├ívn├Ż:
const DEFAULT_APR_BPS = 800; // nap┼Ö├şklad 8% pro mainnet start
// initialPriceWethPerWzion v dex-config.ts BASE_MAINNET_CONFIG:
initialPriceWethPerWzion: 100_000_000_000_000n, // 0.0001 ETH/ZION ÔÇö upravit p┼Öed launchem
```

---

### Krok 3 ÔÇö Deploy po┼Öad├ş (mainnet)

```
1. wZION + ZIONBridge        (deploy.ts)
2. ZIONAtomicSwap             (deploy-atomic-swap.ts)
3. ZIONFarm                   (deploy-farm.ts)
4. ZIONGovernance             (deploy-defi.ts ÔÇö krok 1)
5. ZIONTreasury               (deploy-defi.ts ÔÇö krok 2, 3-of-5 signers)
6. ZIONStaking                (deploy-defi.ts ÔÇö krok 3)
7. Uniswap V3 pool            (deploy-pool.ts)
8. Seed likvidity             (seed-liquidity.ts)
```

**Env vars pro mainnet deploy** (ulo┼ż do `.env.mainnet`, NIKDY necommituj):
```env
DEPLOYER_PRIVATE_KEY=0x<mainnet-deployer-key>
WZION_ADDRESS=0x<wZION-mainnet>
GUARDIAN_ADDRESS=0x<guardian-multisig>
TREASURY_SIGNER2=0x<signer2>
TREASURY_SIGNER3=0x<signer3>
TREASURY_SIGNER4=0x<signer4>      # voliteln├ę
STAKING_APR_BPS=800               # 8% pro mainnet start
STAKING_SEED_AMOUNT=0             # nejd┼Ö├şv deploy, pak seed p┼Öes governance
```

**Spu┼ít─Ťn├ş:**
```powershell
cd L2/contracts
# Zkop├şruj env
Copy-Item .env.mainnet .env

# Deploy v po┼Öad├ş
npx hardhat run scripts/deploy.ts --network base
npx hardhat run scripts/deploy-atomic-swap.ts --network base
npx hardhat run scripts/deploy-farm.ts --network base
npx hardhat run scripts/deploy-defi.ts --network base
npx hardhat run scripts/deploy-pool.ts --network base
npx hardhat run scripts/seed-liquidity.ts --network base

# Ov─Ť┼Öen├ş na BaseScan (pot┼Öeba BASESCAN_API_KEY v .env)
npx hardhat run scripts/verify.ts --network base
```

---

### Krok 4 ÔÇö Post-deploy setup (mainnet)

**4.1 P┼Öed├ín├ş admin pr├ív na multisig:**
```typescript
// Pro ka┼żd├Ż kontrakt s AccessControl:
await governance.transferOwnership(MULTISIG_ADDR);
await staking.grantRole(DEFAULT_ADMIN_ROLE, MULTISIG_ADDR);
await staking.renounceRole(DEFAULT_ADMIN_ROLE, DEPLOYER_ADDR);
await farm.grantRole(DEFAULT_ADMIN_ROLE, MULTISIG_ADDR);
await farm.renounceRole(DEFAULT_ADMIN_ROLE, DEPLOYER_ADDR);
```

**4.2 Fund ZIONStaking reward pool:**
- Reward pool je financov├ín p┼Öes `staking.fundRewardPool(amount)` s `REWARD_FUNDER_ROLE`
- Na mainnet: treasury dostane `REWARD_FUNDER_ROLE` Ôćĺ governance proposal Ôćĺ treasury po┼íle rewards

**4.3 Fund ZIONFarm reward pool:**
- `farm.fundRewards(amount)` ÔÇö odeslat pl├ínovan├ę odm─Ťny (nap┼Ö. 10M wZION na prvn├ş rok)
- Distribuci kontroluje `rewardsPerSecond` ÔÇö nastavit dle tokenomiky

**4.4 Nastavit spr├ívnou cenu v Uniswap V3:**
- `initialPriceWethPerWzion` mus├ş odpov├şdat re├íln├ę launch cen─Ť
- Spo─Ź├ştat p┼Öed deployi na z├íklad─Ť premine valuation + circulating supply

**4.5 Ov─Ť┼Öit BaseScan + Uniswap UI:**
- Verify v┼íechny kontrakty (sourcecode verified = d┼»v─Ťryhodnost)
- Zkusit swap p┼Öes [app.uniswap.org](https://app.uniswap.org) ÔÇö p┼Öidat custom token `wZION`

---

### Krok 5 ÔÇö Bezpe─Źnostn├ş checklist p┼Öed mainnetem

```
Ôľí ZIONTreasury min. 3 signers (obnov require >= 3 v .sol)
Ôľí Deploy kl├ş─Ź != treasury signer
Ôľí V┼íechny admin role p┼Öed├íny na multisig
Ôľí Deployer DEFAULT_ADMIN_ROLE renounced
Ôľí Bridge vault key v HSM nebo hardware wallet
Ôľí Staking cooldown ponech├ín 7 dn├ş (ochrana p┼Öed flash-loan governance attack)
Ôľí Governance proposal threshold nastaven (min. 1M ZION pro proposal)
Ôľí Audit report zve┼Öejn─Ťn p┼Öed launchem
Ôľí Base Sepolia E2E testy prob─Ťhly bezchybn─Ť
Ôľí seed-liquidity.ts spu┼ít─Ťn s re├íln├Żmi hodnotami (ne testnet 50 000 gwei/ZION)
Ôľí POOL_FEE_TIER ov─Ť┼Öen (0.3% = 3000 pro nov├Ż token, 0.05% = 500 a┼ż po stabilit─Ť)
```

---

## HTLC Memo protokol (L1)

```
LOCK:    SWAP:LOCK:<hash64hex>:<timeout_min>:<chain>:<counterparty_addr>
CLAIM:   SWAP:CLAIM:<hash64hex>:<preimage64hex>
REFUND:  SWAP:REFUND:<hash64hex>
```

---

## Rychl├Ż start pro p┼Ö├ş┼ít├ş session

```powershell
# Seed Uniswap V3 likvidity (testnet ÔÇö zb├Żv├í)
cd L2/contracts
npx hardhat run scripts/seed-liquidity.ts --network base-sepolia

# Fund staking (testnet)
npx hardhat console --network base-sepolia

# Atomic-swap daemon lok├íln─Ť
$env:ZION_SWAP_ESCROW_KEY = "..."
$env:ZION_RPC_TOKEN = "..."
cargo run -p zion-atomic-swap -- --config L2/atomic-swap/atomic-swap-testnet.toml
```


---

## P┼Öehled architektury

```
L1 (ZION chain)
  ÔööÔöÇÔöÇ ZIONCore (Rust/axum)
        ÔöťÔöÇÔöÇ bridge vault     ÔÇö wZION Ôćö ZION (live Ôťů)
        ÔööÔöÇÔöÇ swap escrow      ÔÇö HTLC atomic swaps (S-01..S-05 Ôťů)

L2 (Base / EVM)
  ÔöťÔöÇÔöÇ wZION.sol              ERC-20 wrapped ZION           Ôťů LIVE
  ÔöťÔöÇÔöÇ ZIONBridge.sol         lock/mint/burn bridge         Ôťů LIVE
  ÔöťÔöÇÔöÇ ZIONGovernance.sol     token governance + staking    Ôťů LIVE (Base Sepolia)
  ÔöťÔöÇÔöÇ ZIONTreasury.sol       multi-sig treasury + DAO      Ôťů LIVE (Base Sepolia)
  ÔöťÔöÇÔöÇ ZIONStaking.sol        stake wZION, earn APR         Ôťů LIVE (Base Sepolia)
  ÔöťÔöÇÔöÇ Uniswap V3 pool        wZION/WETH 0.3%               Ôťů LIVE (Base Sepolia) ÔÇö seed pending
  ÔöťÔöÇÔöÇ ZIONAtomicSwap.sol     EVM HTLC (ETH/ERC-20 strana)  Ôťů LIVE (Base Sepolia)
  ÔööÔöÇÔöÇ ZIONFarm.sol           MasterChef yield farming       Ôťů LIVE (Base Sepolia)

L2/atomic-swap (Rust daemon)
  ÔöťÔöÇÔöÇ HTLC watcher           ─Źte L1 SWAP:LOCK/CLAIM/REFUND Ôťů hotovo
  ÔöťÔöÇÔöÇ Executor               podepisuje + odes├şl├í L1 TX    Ôťů hotovo
  ÔööÔöÇÔöÇ HTTP API               /swap/claim /swap/refund      Ôťů hotovo
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

> Stav k **2026-03-** ÔÇö Base Sepolia. P┼Öed Mainnetem nutn├Ż audit + testery.  
> `deployed-defi.json` ulo┼żen v `L2/contracts/`.

---

## Ôťů Hotovo

### Infrastruktura
- [x] **wZION ERC-20** ÔÇö nasazeno na Base Sepolia `0x0c4937...`
- [x] **ZIONBridge** ÔÇö nasazeno, bridge relay b─Ť┼ż├ş, vault key SET
- [x] **BridgeBurnWidget** ÔÇö MetaMask widget na webu (page.tsx), commit `3d7e8e3`
- [x] **BRIDGE_VAULT_ADDR** ÔÇö opravena adresa v desktop-agent, commit `2ac8194`

### DeFi kontrakty (naps├íno, kompiluje, 94/96 test┼» Ôťů)
- [x] **ZIONStaking.sol** ÔÇö Synthetix-style staking, APR bps, 7-day cooldown
  - `stake()` / `queueUnstake()` / `unstake()` / `claimRewards()`
  - `GUARDIAN_ROLE` + `REWARD_FUNDER_ROLE` + emergency withdraw
  - `votingWeight(address)` ÔÇö p┼Öid├ív├í v├íhu ke governance
- [x] **ZIONGovernance.sol** ÔÇö ERC20-votes governance + staking weight
  - `_votingPower(addr) = balance + stakingContract.votingWeight(addr)`
  - `setStakingContract(addr)` onlyOwner
- [x] **ZIONTreasury.sol** ÔÇö multi-sig treasury, milestones, spending proposals
- [x] **deploy-defi.ts** ÔÇö deploys Governance Ôćĺ Treasury Ôćĺ Staking
  - testnet: auto-pad na 3 sgnery (deployer├Ś3)
  - ulo┼ż├ş `deployed-defi.json`
- [x] **dex-config.ts** ÔÇö opravena wZION adresa, Uniswap V3 konfig p┼Öipraven
- [x] **deploy-pool.ts** ÔÇö skript na deploy wZION/WETH Uni V3 pool
- [x] **seed-liquidity.ts** ÔÇö skript pro seed likvidity
- [x] **hardhat.config.ts** ÔÇö `viaIR: true` (fix stack-too-deep)

### Atomic Swaps ÔÇö `L2/atomic-swap/` Rust crate (8/8 test┼» Ôťů)
- [x] **S-01 types.rs** ÔÇö `SwapHash`, `SwapPreimage`, `HtlcRecord`, `SwapMemo`
  - parser: `SWAP:LOCK/CLAIM/REFUND` memo form├ít
- [x] **S-02 db.rs** ÔÇö SQLite persistence, watcher state
- [x] **S-03 watcher.rs** ÔÇö L1 block scanner, detekuje LOCK/CLAIM/REFUND
- [x] **S-04 executor.rs** ÔÇö coin-select + podpis + odesl├ín├ş L1 release TX
- [x] **S-05 handlers.rs + main.rs** ÔÇö axum HTTP API
  - `GET /swap/escrow-address`
  - `GET /swap/:hash`
  - `POST /swap/claim { hash_hex, preimage_hex, recipient }`
  - `POST /swap/refund { hash_hex }`
  - `GET /swap/pending`
- [x] **L1 `/api/swap/escrow-address`** ÔÇö endpoint v L1 core (methods.rs)

---

## ­čö▓ Pl├ín ÔÇö co zb├Żv├í

### F├íze 1 ÔÇö Deploy DeFi kontrakt┼» na Base Sepolia (priorita HIGH)

| # | ├Ükol | Skript | Odhadovan├Ż ─Źas |
|---|------|--------|----------------|
| D-01 | Deploy Governance + Treasury + Staking | `deploy-defi.ts` | 30 min |
| D-02 | Ov─Ť┼Öen├ş na BaseScan | `verify.ts` | 30 min |
| D-03 | Seed reward┼» do ZIONStaking (fundRewardPool) | ru─Źn├ş TX | 15 min |
| D-04 | Nastavit `stakingContract` v Governance | deploy-defi.ts auto | ÔÇö |

```bash
# D-01
cd L2/contracts
npx hardhat run scripts/deploy-defi.ts --network base-sepolia
```

### F├íze 2 ÔÇö Uniswap V3 Pool + likvidita (priorita HIGH)

| # | ├Ükol | Skript | Odhadovan├Ż ─Źas |
|---|------|--------|----------------|
| P-01 | Deploy wZION/WETH pool (0.3% fee tier) | `deploy-pool.ts` | 20 min |
| P-02 | Seed po─Ź├íte─Źn├ş likvidity (full-range position) | `seed-liquidity.ts` | 30 min |
| P-03 | Ov─Ť┼Öit cenu + tick na BaseScan / Uniswap UI | ru─Źn├ş | 15 min |

```bash
# P-01
npx hardhat run scripts/deploy-pool.ts --network base-sepolia

# P-02
npx hardhat run scripts/seed-liquidity.ts --network base-sepolia
```

### F├íze 3 ÔÇö EVM HTLC kontrakt Ôťů DONE

| # | ├Ükol | Stav |
|---|------|------|
| S-06 | `ZIONAtomicSwap.sol` ÔÇö HTLC pro ETH/ERC-20 | Ôťů LIVE `0xAf1E0645...` |
| S-07 | Testy ZIONAtomicSwap (19/19) | Ôťů |
| S-08 | Deploy na Base Sepolia | Ôťů commit `c696d99` |
| S-09 | EVM watcher (`evm_watcher.rs`, 15/15 test┼») | Ôťů commit `c696d99` |
| S-10 | E2E test: ZION Ôćö ETH swap (testnet) | ­čö▓ pending |

### F├íze 4 ÔÇö Yield Farming Ôťů DONE

| # | ├Ükol | Stav |
|---|------|------|
| F-01 | `ZIONFarm.sol` ÔÇö MasterChef, stake LP, earn wZION | Ôťů LIVE `0x1B8BA9...` |
| F-02 | 17/17 test┼» | Ôťů |
| F-03 | Pool 0 seeded (500 wZION) | Ôťů |
| F-04 | Frontend widget | ­čö▓ pending |

### F├íze 5 ÔÇö Mainnet deploy (po auditu)

| # | ├Ükol | Podm├şnka |
|---|------|----------|
| M-01 | Audit ZIONBridge + ZIONStaking + ZIONGovernance | extern├ş auditor |
| M-02 | Deploy v┼íech kontrakt┼» na Base Mainnet | po auditu |
| M-03 | P┼Öesun likvidity testnet Ôćĺ mainnet | po M-02 |
| M-04 | Ve┼Öejn├ę ozn├ímen├ş DeFi launch | po M-03 |

---

## HTLC Memo protokol (L1)

V┼íechny SWAP transakce jdou na **escrow adresu** (odvozena z `ZION_SWAP_ESCROW_KEY`):

```
LOCK:    SWAP:LOCK:<hash64hex>:<timeout_min>:<chain>:<counterparty_addr>
CLAIM:   SWAP:CLAIM:<hash64hex>:<preimage64hex>
REFUND:  SWAP:REFUND:<hash64hex>
```

---

## P┼Öehledov├í tabulka stavu

| Komponenta | Stav | Commit/Adresa |
|---|---|---|
| wZION ERC-20 | Ôťů LIVE | `0x0c4937...` |
| ZIONBridge | Ôťů LIVE | `0xF4BF85...` |
| BridgeBurnWidget (web) | Ôťů hotovo | `3d7e8e3` |
| ZIONAtomicSwap.sol | Ôťů LIVE Base Sepolia | `0xAf1E06...` |
| ZIONFarm.sol + Pool 0 seeded | Ôťů LIVE Base Sepolia | `0x1B8BA9...` |
| **ZIONGovernance.sol** | **Ôťů LIVE Base Sepolia** | **`0x039F73...`** |
| **ZIONTreasury.sol** (1-of-1 testnet) | **Ôťů LIVE Base Sepolia** | **`0x178d85...`** |
| **ZIONStaking.sol** (APR 12%) | **Ôťů LIVE Base Sepolia** | **`0x487D87...`** |
| **wZION/WETH Uni V3 pool** (0.3%) | **Ôťů LIVE Base Sepolia** | **`0xcCEaD5...`** |
| seed-liquidity (LP pozice) | ­čö▓ TODO | ÔÇö |
| E2E atomic swap test | ­čö▓ TODO | ÔÇö |
| Mainnet deploy | ­čö▓ po auditu | ÔÇö |

---

## Rychl├Ż start pro dal┼í├ş session

```powershell
# Seed likvidity do Uniswap V3 poolu
cd L2/contracts
npx hardhat run scripts/seed-liquidity.ts --network base-sepolia

# Spustit atomic-swap daemon lok├íln─Ť
$env:ZION_SWAP_ESCROW_KEY = "..."
$env:ZION_RPC_TOKEN = "..."
cargo run -p zion-atomic-swap -- --config L2/atomic-swap/atomic-swap-testnet.toml
```
