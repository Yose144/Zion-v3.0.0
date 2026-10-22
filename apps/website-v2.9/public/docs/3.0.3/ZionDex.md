# ZionDex — Cross-Chain DEX Concept

> **Status:** Concept / Vision document
> **Date:** 2026-06-30
> **Goal:** Top 100 coins on CoinMarketCap

## Projekt název

**ZionDex** (nebo **WarpSwap**)

Dva názvy, dvě funkce:
- **ZionDex** = DEX layer (swapování, likvidita, trading)
- **WARP** = Bridge layer (cross-chain přenos ZION)

Spolu = **ZionDex powered by WARP** — první cross-chain DEX který bridgeuje native L1 asset na 13 chain family v jedné transakci.

---

## Proč je to revoluce

### Problém dnešního DeFi
Uživatel chce swapovat USDC (Solana) → ETH (Base). Dnes musí:
1. Swap USDC → SOL na Raydium
2. Bridge SOL Solana → Ethereum (Wormhole / Portal)
3. Swap ETH → USDC na Uniswap
4. 3 transakce, 3x fees, 3x čekání, 3x riziko

### Řešení ZionDex + WARP
Uživatel chce swapovat USDC (Solana) → ZION (Base). S ZionDex:
1. **Jedna transakce** — ZionDex najde nejlepší cestu
2. WARP bridgeuje ZION nativně mezi chainy
3. AMM swapuje na každém chainu lokálně
4. Výsledek: cross-chain swap v jednom TX

**Tohle nedělá nikdo.** Thorchain (RUNE) dělá cross-chain swap ale jen pro BTC/ETH/LTC. Wormhole dělá bridge ale ne swap. LI.FI agreguje ale nepřenáší native L1 asset.

ZION + WARP + ZionDex = **první univerzální cross-chain DEX na 13 chain family.**

---

## Architektura konceptu

```
┌─────────────────────────────────────────────────────────┐
│                    ZionDex Frontend                       │
│         (web + mobile + desktop agent)                    │
├─────────────────────────────────────────────────────────┤
│                  ZionDex Router                            │
│   (najde nejlepší cestu: swap + bridge + swap)            │
├─────────────────┬─────────────────┬───────────────────────┤
│   AMM Layer     │   WARP Bridge   │   Liquidity Layer     │
│  (per-chain)    │   (cross-chain) │   (ZION pools)        │
├─────────────────┼─────────────────┼───────────────────────┤
│  Uniswap (EVM)  │  ZION L1 vault  │  ZION/USDC pools      │
│  Raydium (SOL)  │  13 adapters    │  ZION/ETH pools       │
│  Orca (SOL)     │  3/5 quorum     │  ZION/BTC pools       │
│  SunSwap (TRX)  │  BCS/CBOR/      │  ZION/SOL pools       │
│  Minswap (ADA)  │  TL-B/BOC       │  ZION/ADA pools       │
│  Ref.Finance    │                 │  ZION/TON pools       │
│  (NEAR)         │                 │  ...                  │
│  STON.fi (TON)  │                 │                       │
│  Cetus (Sui)    │                 │                       │
│  Liquidswap     │                 │                       │
│  (Aptos)        │                 │                       │
└─────────────────┴─────────────────┴───────────────────────┘
```

---

## Fáze implementace

### Fáze 1: Likvidita (Q3 2026) — nejrychlejší
- Deploy ZION/USDC liquidity pools na existující DEXy:
  - **EVM:** Uniswap V3 (Base, Arbitrum, Optimism, BSC, Polygon, Avalanche)
  - **Solana:** Raydium nebo Orca — ZION/USDC pool
  - **Tron:** SunSwap — ZION/USDT pool
  - **Cardano:** Minswap — ZION/ADA pool
  - **Aptos:** Liquidswap — ZION/USDC pool
  - **Sui:** Cetus — ZION/USDC pool
  - **NEAR:** Ref.Finance — ZION/USDC pool
  - **TON:** STON.fi — ZION/USDT pool
  - **Stellar:** StellarX — ZION/USDC pool
- **Liquidity incentives:** ZIONFarm rewarduje LPs (již existuje na Base, rozšířit)
- **LI.FI widget** už to agreguje — uživatel vidí nejlepší cestu
- **Výsledek:** ZION je obchodovatelný na všech 13 chainech

### Fáze 2: Cross-chain swap (Q4 2026) — unikátní feature
- **ZionDex Router** — smart contract / off-chain router který:
  1. Přijme swap request (src_chain, src_token, dest_chain, dest_token, amount)
  2. Najde nejlepší cestu (lokální swap → WARP bridge → lokální swap)
  3. Execution v jedné transakci (nebo atomic HTLC pro non-EVM)
- **Příklad:** User má USDC na Solana → chce ZION na Base
  1. Swap USDC → ZION na Raydium (Solana)
  2. WARP bridge ZION Solana → Base (burn ZION na Solana, mint wZION na Base)
  3. Výsledek: User má wZION na Base v jednom TX
- **Killer feature:** Žádný jiný DEX nedělá cross-chain swap s native L1 assetem

### Fáze 3: Vlastní AMM (2027) — maximum kontroly
- Vlastní AMM smart kontrakty na každém chainu
- ZION-specifické features:
  - Nižší fees pro ZION pairs (0.15% vs 0.30%)
  - Concentrated liquidity (Uniswap V3 style)
  - Cross-chain liquidity routing
- **ZionDex Token (ZDX)** — governance token pro AMM
  - Reward LPs
  - Vote on fee tiers
  - Staking → share of DEX revenue

### Fáze 4: Aggregator (future)
- ZionDex agreguje všechny DEXy na všech chainech
- Nejlepší cena pro jakýkoliv swap na jakémkoliv chainu
- WARP jako preferovaný bridge (nižší fees pro ZION pairs)

---

## Proč se dostaneme do Top 100

### 1. Unikátní technologie (WARP)
- **Jediný bridge** který přenáší native L1 asset na 13 chain family
- Žádný konkurent — Wormhole, LayerZero, Across dělají jen EVM↔EVM
- Thorchain dělá cross-chain swap ale jen pro 5-6 assetů
- WARP dělá cross-chain pro ZION na 13 chainech + BTC Lightning

### 2. Network effect (13 chainů)
- Čím více chainů, tím více likvidity
- Čím více likvidity, tím více uživatelů
- Čím více uživatelů, tím vyšší TVL
- Čím vyšší TVL, tím vyšší market cap

### 3. Real utility (ne jen spekulace)
- ZION se reálně používá pro:
  - Cross-chain swap (ZionDex)
  - Bridge fee payment (WARP)
  - Staking (12% APR)
  - Yield farming (ZIONFarm)
  - Governance (ZIONGovernance)
  - L1 transakce (ZION blockchain)

### 4. Tokenomics
- ZION L1 = native coin (max supply, emission schedule)
- ZION na non-EVM = nativní reprezentace (1:1 peg, backed by bridge vault)
- wZION na EVM = ERC-20 wrapped (1:1 peg, backed by bridge vault)
- Bridge vault = ~100M ZION locked (transparent, on-chain)
- Fee model: 0.5% bridge fee + 0.15-0.30% swap fee → revenue pro stakers/governance

### 5. Story / Narrative
- "First universal cross-chain DEX powered by native L1 bridge"
- "ZION is on 13 chains natively — no wrapped synthetic, no IOU"
- "Swap anything to anything across 13 chains in one transaction"
- "BTC Lightning + Solana + EVM + Cardano + TON — all connected by ZION"

---

## Konkurenční analýza

| Projekt | Co dělá | Co nedělá | ZION výhoda |
|---------|---------|-----------|-------------|
| Thorchain (RUNE) | Cross-chain swap BTC/ETH | Pouze 5-6 assetů, žádný Solana/TON/Cardano | WARP = 13 chain family |
| Wormhole | Token bridge | Pouze EVM+SOL, žádný swap | WARP = native L1 + ZionDex swap |
| LayerZero | Omnichain messaging | Pouze EVM, žádný native asset | WARP = native L1 ZION |
| LI.FI | DEX aggregator | Agreguje cizí bridgey | ZionDex = vlastní bridge + AMM |
| Uniswap | AMM DEX | Pouze EVM, žádný cross-chain | ZionDex = 13 chainů cross-chain |
| Chainlink CCIP | Cross-chain | Pouze EVM, messaging only | WARP = native asset transfer |

---

## Co potřebujeme k realizaci

### Technické
1. **WARP** — ✅ hotovo (13 adapterů, 499 testů)
2. **ZION kontrakty** — ⚠️ EVM hotovo (6 chainů), non-EVM pending
3. **Liquidity pools** — deploy na existující DEXy (Fáze 1)
4. **ZionDex Router** — off-chain router pro cross-chain swap (Fáze 2)
5. **Vlastní AMM** — smart kontrakty (Fáze 3)

### Marketing / Business
1. **Liquidity bootstrapping** — seed ZION/USDC pools na každém chainu
2. **Liquidity mining** — ZIONFarm rewarduje LPs (již existuje na Base)
3. **Partnerships** — integrace s existujícími DEXy (Raydium, Minswap, STON.fi)
4. **Listing** — CoinMarketCap, CoinGecko (ZION L1 + wZION ERC-20)
5. **Community** — cross-chain ZION community na 13 chainech

### Tokenomics
1. **Bridge fee** — 0.5% z každého WARP transferu → ZION stakers
2. **Swap fee** — 0.15-0.30% z každého ZionDex swapu → LPs + ZDX stakers
3. **L1 fees** — transakční fees na ZION blockchainu → miners/validators
4. **Staking** — 12% APR pro ZION stakers (již běží na Base)
5. **Yield farming** — ZIONFarm rewarduje LPs (již běží na Base)

---

## Shrnutí

**WARP je revoluce. ZionDex je jak ji monetizovat.**

- WARP = unikátní technologie (nikdo jiný to nedělá)
- ZionDex = produkt který tu technologii prodává uživatelům
- ZION = asset který to vše pohání
- 13 chainů = network effect který vede k Top 100

**Cesta k Top 100:**
1. Deploy ZION na 13 chainů (WARP ✅, kontrakty pending)
2. Liquidity pools na každém chainu (Fáze 1)
3. Cross-chain swap jako killer feature (Fáze 2)
4. Marketing: "first universal cross-chain DEX" (narrative)
5. TVL growth → market cap growth → Top 100

---

## Názvy pro celý ekosystém

| Komponenta | Název | Popis |
|-----------|-------|-------|
| L1 blockchain | **ZION** | Native blockchain (PoW, cosmic-harmony) |
| Cross-chain bridge | **WARP** | Bridge ZION na 13 chain family |
| DEX layer | **ZionDex** | Swap + likvidita + cross-chain swap |
| EVM token | **wZION** | ERC-20 wrapped ZION (EVM chains) |
| Non-EVM token | **ZION** | Nativní reprezentace (Solana, TON, etc.) |
| DEX token (future) | **ZDX** | ZionDex governance token |
| Staking | **ZIONStaking** | 12% APR staking (již na Base) |
| Yield farming | **ZIONFarm** | LP rewards (již na Base) |
| Governance | **ZIONGovernance** | DAO (již na Base) |
| Treasury | **ZIONTreasury** | 3-of-3 multisig (již na Base) |
| AI layer | **Hiran** | AI inference + cross-chain intelligence |
| Website | **zionterranova.com** | Hlavní web s LiFi widgetem |

**Celý ekosystém: ZION L1 + WARP bridge + ZionDex + Hiran AI**
