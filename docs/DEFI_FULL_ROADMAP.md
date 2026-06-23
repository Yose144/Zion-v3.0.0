# ZION L2 DeFi + DAO — Kompletní Roadmapa k Veřejnému Launchi

> **Datum:** 2026-06-23 (aktualizováno — 5/5 bridge confirmací, timelock aktivní, wZION mint pending)
> **Verze:** 2.0
> **Status:** Bridge fully confirmed on-chain, 24h timelock, liquidity plan ready
> **Cíl:** Plnohodnotný DeFi + DAO ekosystém — DEX, Swap, Staking, Farming, DAO Governance, Explorer, Desktop, Mobile, Web

---

## Aktuální Stav (2026-06-23)

```
CORE CHAIN (L1)
  ✅ V3 mainnet běží — Core + Edge (77.42.71.94 + 100.76.16.108)
  ✅ Chain height: ~12 400+, bloky každých ~60s (LWMA DAA)
  ✅ Cosmic Harmony Ekam Deeksha v2 PoW (ASIC + NPU hardened)
  ✅ Coinbase fee-split: miners 89% | humanitarian 5% | issobella 5% | pool 1%
  ✅ UTXO + Account dual model
  ✅ ~1 300 testů, 0 failures

BRIDGE (L2)
  ✅ ZIONBridge 5/5 multisig: 0x89504D6eD6993d726438E1A9C18aaC79e8d0eF88
  ✅ 100M ZION locked on L1 (6 UTXO TX, bloky 11611–11612)
  ✅ 5/5 on-chain confirmací pro všech 6 locků (30 submitLockProof TX)
  ✅ Multi-validator relay: 5 klíčů na jedné instanci (commit c4a4841)
  ✅ 24h timelock aktivní — expiry 2026-06-24 16:52 UTC
  ⏳ ~100M wZION mintováno po timelock expiry
  ⏳ Burn→Unlock (reverse) E2E test

SMART KONTRAKTY (Base Mainnet)
  ✅ wZION ERC-20: 0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6
  ✅ ZIONBridge 5/5: 0x89504D6eD6993d726438E1A9C18aaC79e8d0eF88
  ✅ BridgeValidator 5/5: 0x9C138dC6ebA8A883AB3802F6Dcb79C772a835627
  ✅ ZIONStaking (APR 12%, 7-day cooldown) — deployed
  ✅ ZIONGovernance (stake-weighted voting) — deployed
  ✅ ZIONTreasury (multi-sig) — deployed
  ✅ ZIONFarm (MasterChef yield farming) — deployed
  ⏳ UniV3Pool: 0xa88C4C89EB4597Df2e29A8061895300FcDF44FBB — seed liquidity pending

FRONTEND
  ✅ Website: Next.js 16 + React 19 + Spline 3D (live na zionterranova.com)
  ✅ Explorer: bloky, TX, adresy, richlist (7 stránek)
  ✅ Desktop Agent: Electron, mining GUI, wallet
  ✅ Mobile App: React Native + Expo 54
  ⚠️  DeFi stránky jsou placeholder — bridge, swap, staking, DAO potřebují real UI

DAO (L2)
  ✅ zion-dao crate: proposal engine, voting, treasury, timelock, humanitarian modul
  ✅ 5-of-7 multi-sig treasury (4B ZION z genesis premine)
  ✅ CLI: zion-cli dao subcommandy
  ⏳ On-chain governance aktivace (treasury cliff ~1 rok od genesis = červen 2027)
  ⏳ Web UI pro DAO voting
  ⏳ First community proposals
```

---

## Roadmapa — 8 Fází

### Fáze 0: wZION Mint + Likvidita Seed ⏳ (aktuální — 2026-06-24)

**Cíl:** ~100M wZION mintováno a seed likvidita na UniV3Pool.

| # | Úkol | Stav | ETA |
|---|------|------|-----|
| 0.1 | executeTimelockedMint automaticky relay | ⏳ | 2026-06-24 16:52 UTC |
| 0.2 | Ověřit ~100M wZION balance na `0xdde17506...` | ⏳ | Po expiry |
| 0.3 | Top-up validator ETH (0.01 ETH × 5) | ⏳ | Souběžně |
| 0.4 | Seed UniV3Pool: wZION/WETH, fee 0.3%, full range | ⏳ | Po mint |
| 0.5 | E2E reverse bridge test: burn wZION → unlock L1 | ⏳ | Po mint |
| 0.6 | Dokumentovat ZION/ETH počáteční cenu a tick range | ⏳ | Po mint |

**Výstup:** Live DEX likvidita, první swap možný. Viz [`LIQUIDITY_PLAN.md`](../LIQUIDITY_PLAN.md) pro detaily.

---

### Fáze 1: Bridge UI + Swap Frontend (1–2 týdny po mint)

**Cíl:** Uživatel může bridgovat a swapovat z webu i desktopu.

| # | Úkol | Priorita |
|---|------|----------|
| 1.1 | Web `/bridge` — real wallet connect (MetaMask + zion-cli) | P0 |
| 1.2 | Bridge status tracker (lock → confirm → mint progress bar) | P0 |
| 1.3 | Web `/defi/swap` — wZION↔ETH přes UniV3 | P0 |
| 1.4 | Swap price quote (UniV3 TWAP oracle) | P0 |
| 1.5 | Slippage protection + deadline | P1 |
| 1.6 | Desktop Agent bridge UI (Electron) | P1 |
| 1.7 | Desktop Agent swap UI | P1 |
| 1.8 | Mobile bridge screen (real, ne mockup) | P1 |
| 1.9 | Swap history (lokální DB + web) | P2 |

**Swap flow (ZION → ETH):**
```
User zadá: "1000 ZION → ETH"
  1. App sestaví UTXO lock TX (memo: BRIDGE:base:<user_evm>)
  2. Bridge relay: lock → 60 bloků finality → mint 1000 wZION
  3. Swap aggregator: approve(wZION) → exactInputSingle(wZION→WETH)
  4. unwrapWETH → ETH na uživatelův wallet
UI: "Locking..." → "Bridging (12/60)..." → "Swapping..." → "✅ 0.XX ETH"
```

---

### Fáze 2: Staking + Farming (2–3 týdny)

**Cíl:** Uživatel může stakovat wZION a farmovat LP tokeny.

| # | Úkol | Detail | Priorita |
|---|------|--------|----------|
| 2.1 | ZIONStaking seed | Vložit wZION jako staking rewards pool | P0 |
| 2.2 | Web `/defi/staking` | Stake/unstake/claim UI, APR kalkulačka | P0 |
| 2.3 | Desktop staking UI | Electron panel pro staking | P1 |
| 2.4 | UniV3 LP token farming | Deposit LP → earn ZION rewards | P1 |
| 2.5 | Web `/defi/farming` | Farming pool dashboard | P1 |
| 2.6 | Mobile staking screen | Stake/claim z mobilu | P1 |
| 2.7 | APR oracle | Real-time APR based on pool TVL | P2 |
| 2.8 | Compound strategie | Auto-compound stake rewards | P2 |

**Staking parametry (ZIONStaking.sol):**
- APR: 12% (konfigurovatelné governance)
- Cooldown: 7 dní po unstake
- Minimální stake: TBD

---

### Fáze 3: Explorer Upgrade (2–3 týdny)

**Cíl:** Explorer na úrovni Etherscan — bridge tracker, live stats, charts.

| # | Funkce | Priorita |
|---|--------|----------|
| 3.1 | Bridge Tracker — lock TX → confirmations → mint (live) | P0 |
| 3.2 | Network Stats — hashrate, difficulty, block time chart | P0 |
| 3.3 | Supply Dashboard — circulating, mined, bridged, staked, burned | P0 |
| 3.4 | Address TX History — stránkovaný seznam TX pro adresu | P0 |
| 3.5 | Mempool Viewer — pending TX, fee-sorted | P1 |
| 3.6 | Coinbase Tracker — fee-split vizualizace | P1 |
| 3.7 | Staking Dashboard — TVL, APR, rewards history | P1 |
| 3.8 | DAO Proposals — aktivní návrhy, hlasování | P2 |
| 3.9 | Price Chart — TradingView-style (po pool launch) | P2 |
| 3.10 | Validator Status — bridge relay health, latence | P2 |

---

### Fáze 4: RPC + Wallet Infrastructure (3–4 týdny)

**Cíl:** Robustní API pro všechny klienty, wallet SDK pro web/desktop/mobile.

#### Nové RPC metody

| # | Metoda | Účel |
|---|--------|------|
| 4.1 | `getTransactionHistory` | TX history pro adresu (stránkování) |
| 4.2 | `getAddressInfo` | Balance, tx count, first/last seen |
| 4.3 | `estimateFee` | Fee estimation pro novou TX |
| 4.4 | `getBlockRange` | N bloků najednou (explorer sync) |
| 4.5 | `getNetworkStats` | Hashrate, difficulty, block time avg |
| 4.6 | `subscribeNewBlocks` (WS) | WebSocket stream nových bloků |
| 4.7 | `subscribePendingTx` (WS) | WebSocket stream mempool TX |
| 4.8 | `getTokenInfo` | wZION bridge stats — locked/minted total |
| 4.9 | HTTP REST wrapper | `/api/v1/` REST nad JSON-RPC |

#### Wallet SDK

| # | Úkol | Platforma |
|---|------|-----------|
| 4.10 | `zion-wallet-core` Rust lib | Všechny |
| 4.11 | TypeScript/JS wallet SDK (npm) | Web + Desktop + Mobile |
| 4.12 | Wallet Create/Import/Export (BIP-39, keystore JSON) | Desktop + Mobile |
| 4.13 | Multi-wallet management | Desktop + Mobile |
| 4.14 | EVM wallet (MetaMask / integrovaná) | Web + Desktop |
| 4.15 | WalletConnect v2 | Web + Mobile |

---

### Fáze 5: DAO Governance Aktivace (2026–2027)

**Cíl:** Plně funkční on-chain DAO s real treasury a community governance.

#### 5A. Technická Aktivace

| # | Úkol | Detail | ETA |
|---|------|--------|-----|
| 5.1 | Treasury cliff verification | DAO_TREASURY_LOCK_HEIGHT ověřit (~525 600 bloků) | 2027-06 |
| 5.2 | First governance proposal | Navrhnout první alokaci grantů z treasury | 2027-06 |
| 5.3 | Web DAO dashboard `/defi/dao` | Proposals, voting, treasury view | 2027-Q1 |
| 5.4 | `zion-cli dao propose` | Submit proposal z CLI | ✅ hotovo |
| 5.5 | `zion-cli dao vote` | Hlasovat z CLI | ✅ hotovo |
| 5.6 | Snapshot integration | Off-chain voting (před on-chain) | 2026-Q3 |
| 5.7 | Multi-sig treasury UI | 5/7 signatáři pro velké výdaje | 2026-Q4 |
| 5.8 | Grant program | Formální grantový proces | 2027 |

#### 5B. DAO Hierarchie a Governance Struktura

```
                    ⭐ CENTRUM ⭐
          Co-Admins: Maitreya Buddha + Sarah Issabela
              (Supreme Authority — 50/50)
                       │
    ┌──────────────────┼──────────────────┐
    │                  │                  │
┌───▼────┐      ┌──────▼──────┐     ┌────▼──────┐
│Koncil 9│      │Round Table  │     │ Sacred    │
│(2+7)   │      │(12 AI Adv.) │     │ Trinity   │
└────────┘      └─────────────┘     └───────────┘
```

**20-Year Transition Plan:**

| Fáze | Roky | Maitreya kontrola | DAO kontrola |
|------|------|-------------------|--------------|
| Centralizovaná stabilita | 2025–2030 | 100 % | 0 % |
| Hybridní governance | 2030–2037 | 70 % | 30 % |
| Přechod | 2037–2045 | 25–50 % | 50–75 % |
| Plné DAO | 2045+ | 0 % (honorary) | 100 % |

#### 5C. DAO Treasury Parametry

| Parametr | Hodnota |
|----------|---------|
| Treasury total | 4,000,000,000 ZION |
| Multi-sig | 5 z 7 signatářů |
| Denní limit výdajů | 100,000,000 ZION |
| Práh pro návrh | 1,000,000 ZION |
| Hlasovací období | 7 dní |
| Timelock pro velké výdaje | 48 hodin |
| Quorum | 10 % oběžného množství |
| Treasury cliff | ~525,600 bloků (~1 rok od genesis) |

---

### Fáze 6: NCL + AI-Native + Warp (L3 — 2026–2027)

**Cíl:** Plnohodnotné L3 — AI compute marketplace, cross-chain bridges, autonomous agents.

#### 6A. NCL (Neural Consciousness Layer)

| # | Úkol | Status |
|---|------|--------|
| 6.1 | ONNX compute backend (inference tasks) | ⏳ stub → implementovat |
| 6.2 | Pricing engine aktivace | ✅ crate hotov |
| 6.3 | Worker reputation systém | ✅ crate hotov |
| 6.4 | REST API endpointy | ⏳ scaffold → live |
| 6.5 | Hiran v2.3 integrace do NCL | ⏳ plánováno |
| 6.6 | NCL billing přes ZION/wZION | ⏳ design fáze |

#### 6B. WARP (Cross-Chain Bridge)

| # | Úkol | Chains | Status |
|---|------|--------|--------|
| 6.7 | EVM adapter live (Base) | Base ✅ | aktivní přes bridge relay |
| 6.8 | Bitcoin adapter | BTC | ⏳ stub → implementovat HTLC |
| 6.9 | Solana adapter | SOL | ⏳ stub |
| 6.10 | Cosmos adapter | ATOM, OSMO | ⏳ stub |
| 6.11 | Atomic swap UI | Web + Desktop | ⏳ |

#### 6C. AI-Native (Autonomous Agent Framework)

| # | Úkol | Status |
|---|------|--------|
| 6.12 | Pool Optimizer agent (live mining data) | ⏳ stub → živá data |
| 6.13 | Warp Agent (cross-chain routing) | ⏳ stub |
| 6.14 | Consciousness Engine (Hiran integrace) | ⏳ plánováno |
| 6.15 | Agent marketplace | ⏳ design fáze |

---

### Fáze 7: Desktop Agent + Mobile App — Full DeFi (3–4 týdny)

**Cíl:** One-click DeFi z desktopu i mobilu. UX na úrovni Trust Wallet / Exodus.

#### Desktop Agent (Electron) — nové funkce

| # | Funkce | Priorita |
|---|--------|----------|
| 7.1 | Portfolio Dashboard (ZION + wZION + staked + LP) | P0 |
| 7.2 | EVM Wallet (integrovaná nebo MetaMask) | P0 |
| 7.3 | Bridge UI (lock/burn, live status) | P0 |
| 7.4 | Swap UI (ZION↔ETH/USDC) | P0 |
| 7.5 | TX History (filtrovaný, všechny typy) | P0 |
| 7.6 | Staking UI | P1 |
| 7.7 | DAO Voting UI | P2 |
| 7.8 | Node Status Panel | P1 |
| 7.9 | Auto-update node/miner/bridge binaries | P1 |
| 7.10 | Yield Farming dashboard | P2 |

#### Mobile App (React Native) — nové funkce

| # | Funkce | Priorita |
|---|--------|----------|
| 7.11 | Biometric Auth (FaceID/TouchID pro TX) | P0 |
| 7.12 | Portfolio View (ZION + wZION + staked) | P0 |
| 7.13 | Bridge Screen (real, ne mockup) | P0 |
| 7.14 | Swap Screen | P0 |
| 7.15 | Staking Screen | P1 |
| 7.16 | Push Notifications (TX, bridge done, block) | P1 |
| 7.17 | WalletConnect v2 | P2 |
| 7.18 | QR Scan (ZION + EVM adresa + amount) | P1 |

---

### Fáze 8: Web + Marketing + Public Launch (2026-Q4)

**Cíl:** Profesionální web + kompletní materiály pro BitcoinTalk, CT, Reddit.

#### Website stránky

| Stránka | Stav | Akce |
|---------|------|------|
| `/` Landing | ✅ Existuje | Refresh: live price, stats, recent blocks |
| `/bridge` | ✅ 798 LOC | Real wallet connect, progress tracker |
| `/defi` | ⚠️ Placeholder | Full DeFi hub: swap, staking, farming |
| `/defi/swap` | ⬜ Nová | Swap interface + UniV3 integracion |
| `/defi/staking` | ⬜ Nová | Staking + APR kalkulačka |
| `/defi/farming` | ⬜ Nová | Yield farming pools |
| `/defi/dao` | ⬜ Nová | Proposals, voting, treasury |
| `/explorer` | ✅ Existuje | Bridge tracker, network stats, charts |
| `/docs` | ✅ Existuje | API reference, bridge guide, tutorials |
| `/whitepaper` | ⬜ Nová | Technický whitepaper (PDF + web) |
| `/roadmap` | ✅ Existuje | Aktualizovat dle tohoto dokumentu |

#### Marketing materiály

| # | Materiál | Status |
|---|----------|--------|
| 8.1 | BitcoinTalk ANN thread | ⏳ |
| 8.2 | Technical Whitepaper (PDF + web) | ⏳ `V3/docs/ZION_Mainnet_Whitepaper_v3.0_Canonical.md` existuje |
| 8.3 | DeFi Guide (jak swapovat, stakovat, farmat) | ⏳ |
| 8.4 | Mining Guide (update pro desktop agent) | ✅ existuje, update needed |
| 8.5 | Tokenomics Infographic | ⏳ |
| 8.6 | Social media assets (logo, banery, OG images) | ⏳ |
| 8.7 | CoinGecko listing | ⏳ `docs/listings/COINGECKO.md` připraveno |
| 8.8 | CoinMarketCap listing | ⏳ `docs/listings/COINMARKETCAP.md` připraveno |

---

## Technická Architektura — Cílový Stav

```
┌────────────────────────────────────────────────────────────────────┐
│                        UŽIVATELSKÉ ROZHRANÍ                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────────┐    │
│  │ Desktop  │  │  Mobile  │  │ Website  │  │ CLI (zion-cli) │    │
│  │ Electron │  │ RN+Expo  │  │ Next.js  │  │ Rust binary    │    │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └───────┬────────┘    │
│       └──────┬───────┴──────┬──────┘                │             │
│       ┌──────▼──────┐ ┌─────▼──────┐                │             │
│       │ zion-wallet │ │ EVM Wallet │                │             │
│       │ SDK (TS/JS) │ │  MetaMask  │                │             │
│       └──────┬──────┘ └─────┬──────┘                │             │
└──────────────┼──────────────┼───────────────────────┼─────────────┘
               │              │                       │
┌──────────────▼──────────────▼───────────────────────▼─────────────┐
│                          BACKEND SERVICES                          │
│  ┌────────────────┐ ┌─────────────────┐ ┌───────────────────────┐ │
│  │ ZION Node      │ │ Bridge Relay    │ │ Swap Aggregator       │ │
│  │ (RPC :8443)    │ │ (L1↔Base, 5/5) │ │ (bridge+UniV3 route)  │ │
│  └───────┬────────┘ └────────┬────────┘ └───────────────────────┘ │
│  ┌───────▼────────┐ ┌────────▼────────┐ ┌───────────────────────┐ │
│  │ Pool (:8444)   │ │ DAO Daemon      │ │ NCL (AI Compute)      │ │
│  │ Mining Pool    │ │ Governance      │ │ ONNX / WASM           │ │
│  └────────────────┘ └─────────────────┘ └───────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────▼──────────────────────────────────────┐
│                           BLOCKCHAINS                              │
│  ┌────────────────────────────┐   ┌──────────────────────────────┐ │
│  │ ZION L1 (mainnet)          │   │ Base (L2 EVM)                │ │
│  │ • PoW Ekam Deeksha v2      │◄─►│ • wZION ERC-20              │ │
│  │ • UTXO + Account dual      │   │ • ZIONBridge 5/5 multisig   │ │
│  │ • Fee-split 89/5/5/1       │   │ • ZIONStaking (12% APR)     │ │
│  │ • Bridge vault (keyless)   │   │ • ZIONFarm (yield farming)  │ │
│  │ • DAO treasury lock        │   │ • ZIONGovernance            │ │
│  └────────────────────────────┘   │ • UniV3Pool (wZION/WETH)   │ │
│                                   └──────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────┘
```

---

## Klíčové Metriky pro Launch Readiness

| Metrika | Minimum | Ideální | Status |
|---------|---------|---------|--------|
| Bridge L1→Base (mint) | ✅ funguje | 5/5 threshold | ✅ **5/5 confirmed** |
| Bridge Base→L1 (burn) | E2E test | ≥ 3 úspěšné | ⏳ pending |
| UniV3Pool TVL | ≥ $10K | ≥ $100K | ⏳ seed pending |
| Swap UI | web funguje | desktop + mobile | ⏳ |
| Explorer | live bloky | bridge tracker | ✅ částečně |
| Staking | kontrakt live | web UI | ⏳ |
| DAO | crate hotov | web UI + proposals | ⏳ UI chybí |
| Desktop Agent | mining + wallet | full DeFi | ⏳ |
| Mobile App | wallet + send | bridge + swap | ⏳ |
| Dokumentace | whitepaper | full API reference | ✅ částečně |

---

## Prioritní seznam pro nejbližší dny

### Dnes–zítra (2026-06-24)
1. ⏳ Ověřit `executeTimelockedMint` — ~100M wZION mintováno
2. ⏳ Přidat seed likviditu na UniV3Pool (viz `LIQUIDITY_PLAN.md`)
3. ⏳ Top-up validator ETH na ≥ 0.01 ETH každý
4. ⏳ E2E burn→unlock test

### Tento týden (2026-06-25 – 06-30)
5. Web `/bridge` real wallet connect
6. Web `/defi/swap` — první real swap UI
7. Explorer bridge tracker
8. Dokumentovat počáteční ZION/ETH cenu

### Příští 2–4 týdny
9. Staking UI web + desktop
10. Mining guide update
11. BitcoinTalk ANN příprava
12. CoinGecko / CMC listing podání

---

*Viz také:*
- [`LIQUIDITY_PLAN.md`](../LIQUIDITY_PLAN.md) — detailní plán UniV3 likvidity
- [`BRIDGE_MAINNET_READINESS.md`](../BRIDGE_MAINNET_READINESS.md) — bridge stav
- [`V3/L2/dao/docs/README.md`](../V3/L2/dao/docs/README.md) — DAO governance dokumentace
- [`V3/ROADMAP.md`](../V3/ROADMAP.md) — technická roadmapa L1/L2/L3

*Generated with [Devin](https://devin.ai)*
