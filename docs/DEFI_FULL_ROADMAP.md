# ZION L2 DeFi — Kompletní Roadmapa k Veřejnému Launchi

> **Datum:** 2. dubna 2026  
> **Verze:** 1.0  
> **Status:** Bridge LIVE na Base Mainnet, první wZION minty potvrzeny  
> **Cíl:** Plnohodnotný DeFi ekosystém — DEX, Swap, DAO, Explorer, Desktop Agent, Mobile App, Web — připraveno pro veřejné oznámení (BitcoinTalk, Crypto Twitter, Reddit)

---

## 📊 Aktuální Stav (Duben 2026)

```
CORE CHAIN (L1)
  ✅ V3 mainnet běží — 3 servery (Praha, USA, Singapur)
  ✅ Chain height: ~6960+, bloky každých ~3-4 min
  ✅ Cosmic Harmony Ekam Deeksha v2 PoW (ASIC-hardened)
  ✅ Coinbase fee-split: miners 89% | humanitarian 5% | issobella 5% | pool 1%
  ✅ UTXO + Account dual model, 157 bridge testů, 1300+ celkem
  ✅ JSON-RPC 2.0: 17 live metod (getBalance, getBlock, sendRawTransaction...)

BRIDGE (L2)
  ✅ wZION na Base Mainnet: 0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6
  ✅ ZIONBridge kontrakt: 0xa5a09b2C09A7182BBA9623A2D2cd46cD7D041721
  ✅ 200 wZION úspěšně zmintováno (první 2 test TX)
  ✅ 3. test TX v procesu (správný příjemce 0xdde175...)
  ✅ Relayer běží na Praze, 60-bloková finalita
  ⚠️  Zatím 1/2 validator threshold (produkce potřebuje 3/5)

SMART KONTRAKTY (Base)
  ✅ Verified na BaseScan: wZION, ZIONBridge, ZIONAtomicSwap
  ✅ ZIONStaking (APR 12%, 7-day cooldown)
  ✅ ZIONGovernance (stake-weighted voting)
  ✅ ZIONTreasury (multi-sig)
  ✅ ZIONFarm (MasterChef yield farming)
  ⬜ Uniswap V3 pool (inicializován, seed likvidita pending)

FRONTEND
  ✅ Website s Next.js 16 + React 19 + Spline 3D
  ✅ Explorer (bloky, transakce, adresy, richlist)
  ✅ Desktop Agent (Electron 39, mining GUI, wallet)
  ✅ Mobile App (React Native + Expo 54)
  ⚠️  Většina DeFi stránek je placeholder/mockup
```

---

## 🎯 Cíl: Co Potřebujeme Pro Veřejný Launch

### Kritéria "Release Ready"

| Oblast | Minimum Viable | Ideální |
|--------|---------------|---------|
| **Bridge** | L1→Base mint funguje, Base→L1 burn funguje | 3/5 multisig, rate limiter, monitoring |
| **Swap** | wZION/ETH swap přes Uniswap V3 | Vlastní swap UI s best-price routing |
| **Explorer** | Bloky, TX, adresy, bridge TX | Live mempool, bridge tracker, staking dashboard |
| **Desktop** | One-click mine, send/receive, bridge | Integrated swap, staking, DAO voting |
| **Mobile** | Wallet, send/receive, bridge status | Swap, staking, push notifikace |
| **Web** | Landing, explorer, bridge UI, docs | Full DeFi dashboard, live stats, API docs |
| **Docs** | Whitepaper, mining guide, node setup | API reference, bridge guide, DeFi tutorial |

---

## 🗺️ Roadmapa — 6 Fází

### Fáze 0: Bridge Hardening (Aktuálně — 1-2 týdny)

**Cíl:** Bridge je production-ready, E2E ověřený s reálnými wZION tokeny.

| # | Úkol | Priorita | Stav |
|---|------|----------|------|
| 0.1 | Ověřit 3. test TX (správný příjemce na MetaMask) | P0 | ⏳ Čeká na 60 bloků finality |
| 0.2 | Přebuildit bridge image s recipient safety guard | P0 | ⬜ |
| 0.3 | Burn→Unlock směr (Base→L1): E2E test | P0 | ⬜ |
| 0.4 | Zvýšit validator threshold na 3/5 | P1 | ⬜ |
| 0.5 | Rate limiter pro bridge requests | P1 | ⬜ |
| 0.6 | EVM WebSocket auto-reconnect | P1 | ⬜ |
| 0.7 | Bridge monitoring dashboard (Grafana) | P2 | ✅ Základní existuje |

**Výstup:** Bridge spolehlivě funguje oběma směry, validator bezpečnost, monitoring.

---

### Fáze 1: RPC Robustnost + Wallet Infrastructure (2-3 týdny)

**Cíl:** Node RPC je dostatečně robustní pro všechny DeFi operace. Wallet infra pro desktop/mobile/web.

#### 1A. Node RPC Rozšíření

Aktuální RPC metody:
```
✅ getBalance, getAccountBalance, getBlock, getBlockByHeight
✅ getTransaction, getAccountTransaction, getUtxos
✅ sendRawTransaction, submitTransaction, submitAccountTransaction
✅ getBlockTemplate, getMempoolInfo, getPeerInfo, getChainInfo
✅ getNodeInfo, submitBlock, getSupplyInfo, getBalanceAtHeight
✅ getBridgeLocks, getBridgeVaultBalance, submitBridgeUnlock
```

Chybí pro plný DeFi:

| # | Nová RPC Metoda | Účel | Složitost |
|---|----------------|------|-----------|
| 1.1 | `getTransactionHistory` | Seznam TX pro adresu (stránkování) | Střední |
| 1.2 | `getAddressInfo` | Kompletní info: balance, tx count, first/last seen | Nízká |
| 1.3 | `estimateFee` | Odhad fee pro novou TX | Nízká |
| 1.4 | `getBlockRange` | Vrátit N bloků najednou (pro explorer sync) | Nízká |
| 1.5 | `getNetworkStats` | Hashrate, difficulty history, block time avg | Střední |
| 1.6 | `subscribeNewBlocks` (WS) | WebSocket stream nových bloků | Střední |
| 1.7 | `subscribePendingTx` (WS) | WebSocket stream nových mempool TX | Střední |
| 1.8 | `getTokenInfo` | wZION bridge stats, total locked/minted | Nízká |
| 1.9 | HTTP REST wrapper | Curl-friendly `/api/v1/` REST nad TCP JSON-RPC | Střední |

#### 1B. Wallet SDK / Library

| # | Úkol | Účel | Platforma |
|---|------|------|-----------|
| 1.10 | `zion-wallet-core` Rust lib | Sdílená wallet logika (keygen, sign, UTXO select) | Všechny |
| 1.11 | TypeScript/JS wallet SDK | Pro web + desktop + mobile | npm balíček |
| 1.12 | Wallet Create/Import/Export | Mnemonic (BIP-39), keystore JSON, raw key | Desktop + Mobile |
| 1.13 | Multi-wallet management | Přepínání peněženek, labeling | Desktop + Mobile |
| 1.14 | Transaction builder | Compose + sign + broadcast z UI | Všechny |

**Výstup:** API schopné obsluhovat libovolného klienta. Wallet SDK pro všechny platformy.

---

### Fáze 2: DEX & Swap (2-3 týdny)

**Cíl:** Uživatel může swapovat ZION↔ETH/USDC jedním kliknutím.

#### Architektura Swap Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    ZION SWAP FLOW                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Uživatel chce: 1000 ZION → ETH                            │
│                                                             │
│  1. Desktop/Mobile/Web: Klik "Swap"                         │
│     └─ Zadá: 1000 ZION, vybere ETH                         │
│                                                             │
│  2. Frontend sestaví Bridge Lock TX:                        │
│     └─ Send 1000 ZION → vault (zion1w0r0a5...)             │
│     └─ Memo: BRIDGE:base:<user_evm_wallet>                  │
│     └─ Podepíše lokálním klíčem                             │
│                                                             │
│  3. Bridge relay (automaticky, ~60 bloků):                  │
│     └─ Detekuje lock → submitLockProof na Base              │
│     └─ Mintne 1000 wZION na uživatelův EVM wallet          │
│                                                             │
│  4. Swap na Uniswap V3 (automaticky):                       │
│     └─ approve(wZION, Uniswap Router)                       │
│     └─ exactInputSingle(wZION → WETH → ETH)                │
│     └─ ETH přistane na uživatelově EVM wallet               │
│                                                             │
│  Alternativy:                                               │
│  - wZION → USDC (přes Uni V3 multi-hop)                    │
│  - wZION → wBTC (přes Uni V3 multi-hop)                    │
│  - ETH → wZION → ZION (reverse bridge: burn→unlock)        │
│                                                             │
│  ZJEDNODUŠENÍ (One-Click cíl):                              │
│  - Backend service "Swap Aggregator" orchestruje kroky 2-4   │
│  - Uživatel jen zadá amount + pair, podepíše 1 TX           │
│  - Status tracking: "Locking..." → "Bridging..." → "Done!" │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### Implementační Kroky

| # | Úkol | Detail | Odhad |
|---|------|--------|-------|
| 2.1 | Seed Uniswap V3 likviditu | 100+ wZION + ETH, nastavit fee tier 0.3% | 1 den |
| 2.2 | Swap Aggregator backend | Rust service: orchestruje bridge+swap, tracking | 5 dní |
| 2.3 | Price feed / oracle | Čte Uni V3 TWAP, poskytuje ZION/USD, ZION/ETH | 3 dny |
| 2.4 | Swap UI komponent | React: amount input, pair selector, price quote, progress | 3 dny |
| 2.5 | EVM wallet connect | MetaMask/WalletConnect integrace pro web | 2 dny |
| 2.6 | Reverse swap (ETH→ZION) | Burn wZION na Base → unlock na L1 | 3 dny |
| 2.7 | Slippage protection | Max slippage setting, deadline, min output | 1 den |
| 2.8 | Swap history | Uložit a zobrazit historii swapů | 1 den |

**Výstup:** Funkční swap ZION↔ETH/USDC. One-click flow z desktop/mobile/web.

---

### Fáze 3: Explorer & Dashboard Upgrade (2-3 týdny)

**Cíl:** Explorer na úrovni Etherscan/Blockchair — plnohodnotný, profesionální.

#### Aktuální Explorer Stránky
```
✅ /explorer             — Dashboard (bloky, TX)
✅ /explorer/blocks      — Seznam bloků
✅ /explorer/block/[id]  — Detail bloku
✅ /explorer/tx/[id]     — Detail transakce
✅ /explorer/address/[a] — Detail adresy
✅ /explorer/richlist     — Top adresy
✅ /explorer/transactions — Seznam TX
```

#### Nové Explorer Funkce

| # | Funkce | Popis | Priorita |
|---|--------|-------|----------|
| 3.1 | Bridge Tracker | Live view: lock TX → bridge processing → mint na Base | P0 |
| 3.2 | Mempool Viewer | Pending TX, fee-sorted, live updates | P1 |
| 3.3 | Network Stats | Hashrate graf, difficulty historie, block time chart | P0 |
| 3.4 | Supply Dashboard | Circulating, mined, locked in bridge, staked, burned | P0 |
| 3.5 | Address TX History | Stránkovaný list všech TX pro adresu | P0 |
| 3.6 | UTXO Set View | Unspent outputs pro adresu | P1 |
| 3.7 | Coinbase Tracker | Vizualizace fee-split payoutů (miner/humanitarian/etc) | P1 |
| 3.8 | Search Upgrade | Hledat bloky, TX, adresy z jednoho search baru | P0 |
| 3.9 | API Documentation | Interactive API docs (Swagger/OpenAPI style) | P1 |
| 3.10 | Validator Status | Bridge validator health, relay latence | P2 |
| 3.11 | Staking Dashboard | Staked wZION, APR, rewards history | P1 |
| 3.12 | DAO Proposals | Aktivní návrhy, hlasování, výsledky | P2 |
| 3.13 | Charts & Graphs | TradingView-style price chart (po Uni V3 pool) | P2 |

**Výstup:** Explorer srovnatelný s Etherscan/Blockchair. Profesionální dojem pro návštěvníky.

---

### Fáze 4: Desktop Agent & Mobile App (3-4 týdny)

**Cíl:** One-click DeFi z desktopu i mobilu. Plná integrace všech L2 služeb.

#### 4A. Desktop Agent (Electron)

Aktuální funkce:
```
✅ Mining GUI (start/stop/config)
✅ Wallet (generate, backup)
✅ Basic send/receive
```

Nové funkce:

| # | Funkce | Detail | Priorita |
|---|--------|-------|----------|
| 4.1 | Bridge UI | Lock ZION→wZION, Burn wZION→ZION, live status | P0 |
| 4.2 | Swap UI | One-click ZION↔ETH/USDC, price quote, history | P0 |
| 4.3 | Staking UI | Stake wZION, claim rewards, unstake + cooldown | P1 |
| 4.4 | DAO Voting UI | Zobrazit proposals, hlasovat, delegate | P2 |
| 4.5 | Portfolio Dashboard | Celkový přehled: ZION + wZION + staked + LP | P0 |
| 4.6 | Transaction History | Filtrovaný seznam TX (send/receive/bridge/swap) | P0 |
| 4.7 | EVM Wallet | Integrovaná EVM peněženka (nebo MetaMask connect) | P0 |
| 4.8 | Auto-update | Stahovat novou verzi node/miner/bridge binaries | P1 |
| 4.9 | Node Status | Dashboard s peer count, chain height, sync status | P1 |
| 4.10 | Yield Farming | Zobrazit farmy, deposit LP tokeny, claim rewards | P2 |

#### 4B. Mobile App (React Native)

Aktuální obrazovky:
```
✅ DashboardScreen, WalletScreen, SendScreen, ReceiveScreen
✅ MiningScreen, BridgeScreen, NetworkScreen, SettingsScreen
✅ TransactionHistoryScreen
```

Nové funkce:

| # | Funkce | Detail | Priorita |
|---|--------|-------|----------|
| 4.11 | Real Bridge Integration | Funkční bridge (ne mockup), status tracking | P0 |
| 4.12 | Swap Screen | ZION↔ETH/USDC s price feed | P0 |
| 4.13 | Staking Screen | Stake/unstake/claim | P1 |
| 4.14 | Push Notifications | TX přijata, bridge dokončen, block nalezen | P1 |
| 4.15 | QR Scan Improvements | Skenovat ZION adresu + EVM adresu + amount | P1 |
| 4.16 | Biometric Auth | FaceID/TouchID pro podepisování TX | P0 |
| 4.17 | WalletConnect | Connect s DeFi dApps na Base | P2 |
| 4.18 | Portfolio View | ZION + wZION + staked shrnutí | P0 |

**Výstup:** Desktop i mobilní klient s plnou DeFi funkcionalitou. UX na úrovni Trust Wallet / Exodus.

---

### Fáze 5: Website & Marketing Ready (2-3 týdny)

**Cíl:** Web je profesionální landing page + plný DeFi hub. Připraveno pro Bitcoin Talk, Crypto Twitter.

#### 5A. Website Upgrade

| # | Stránka / Funkce | Stav | Akce |
|---|-------------------|------|------|
| 5.1 | `/` Landing Page | ✅ Existuje | Refresh: live stats, price feed, recent blocks |
| 5.2 | `/bridge` | ✅ 798 LOC | → Funkční bridge UI s real wallet connect |
| 5.3 | `/defi` | ⚠️ 446 LOC | → Plná DeFi stránka: swap, staking, farm, DAO |
| 5.4 | `/defi/swap` | ⬜ Nová | Swap interface s Uniswap V3 integrací |
| 5.5 | `/defi/staking` | ⬜ Nová | Staking dashboard + APR kalkulačka |
| 5.6 | `/defi/farming` | ⬜ Nová | Yield farming pools |
| 5.7 | `/defi/dao` | ⬜ Nová | DAO governance: proposals, voting, treasury |
| 5.8 | `/explorer` | ✅ Existuje | Vylepšit: bridge tracker, network stats, charts |
| 5.9 | `/docs` | ✅ Existuje | Rozšířit: API reference, bridge guide, tutorials |
| 5.10 | `/api-reference` | ⬜ Nová | Interactive JSON-RPC API dokumentace |
| 5.11 | `/download` | ✅ Existuje | Přidat: release binaries, checksums, install guide |
| 5.12 | `/roadmap` | ✅ Existuje | Aktualizovat s tímto plánem |
| 5.13 | `/whitepaper` | ⬜ Nová | Technický whitepaper (PDF + web verze) |

#### 5B. Marketing Materiály

| # | Materiál | Formát | Účel |
|---|----------|--------|------|
| 5.14 | BitcoinTalk ANN | Forum post | Oficiální oznámení + diskuze |
| 5.15 | One-pager | PDF | Rychlý přehled projektu pro investory |
| 5.16 | Technical Whitepaper | PDF + Web | Kompletní technická dokumentace |
| 5.17 | DeFi Guide | Web | Tutorial: jak swapovat, stakovat, farmat |
| 5.18 | Mining Guide | Web | ✅ Existuje, aktualizovat pro desktop agent |
| 5.19 | Social media assets | Obrázky | Logo, banery, OG images pro sdílení |
| 5.20 | Tokenomics infographic | Obrázek | Supply breakdown, emission schedule chart |

**Výstup:** Profesionální web + kompletní marketingové materiály pro launch.

---

## 📐 Technická Architektura — Cílový Stav

```
┌─────────────────────────────────────────────────────────────────────┐
│                         UŽIVATELSKÉ ROZHRANÍ                        │
│                                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │ Desktop  │  │ Mobile   │  │ Website  │  │ CLI (zion-wallet)│   │
│  │ Agent    │  │ App      │  │ (Next.js)│  │                  │   │
│  │ Electron │  │ RN+Expo  │  │ React 19 │  │ Rust binary      │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────────┬─────────┘   │
│       │              │              │                 │             │
│       └──────┬───────┴──────┬───────┘                 │             │
│              │              │                         │             │
│       ┌──────▼──────┐ ┌────▼──────┐                   │             │
│       │ zion-wallet │ │ EVM Wallet│                   │             │
│       │ SDK (TS/JS) │ │ (MetaMask)│                   │             │
│       └──────┬──────┘ └────┬──────┘                   │             │
└──────────────┼─────────────┼──────────────────────────┼─────────────┘
               │             │                          │
┌──────────────▼─────────────▼──────────────────────────▼─────────────┐
│                         BACKEND SERVICES                             │
│                                                                     │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────────────┐   │
│  │ ZION Node     │  │ Bridge Relay  │  │ Swap Aggregator       │   │
│  │ (RPC :8443)   │  │ (L1↔Base)     │  │ (bridge+Uni routing)  │   │
│  │               │  │               │  │                       │   │
│  │ • getBalance  │  │ • L1 watcher  │  │ • Price oracle        │   │
│  │ • sendTx      │  │ • EVM watcher │  │ • Best route calc     │   │
│  │ • getBlock    │  │ • Relayer     │  │ • Status tracking     │   │
│  │ • getUtxos    │  │ • Validator   │  │ • Slippage protect    │   │
│  │ • WS subs     │  │ • Metrics     │  │                       │   │
│  └───────┬───────┘  └───────┬───────┘  └───────┬───────────────┘   │
│          │                  │                   │                   │
└──────────┼──────────────────┼───────────────────┼───────────────────┘
           │                  │                   │
┌──────────▼──────────────────▼───────────────────▼───────────────────┐
│                         BLOCKCHAINS                                  │
│                                                                     │
│  ┌─────────────────────┐         ┌─────────────────────────────┐   │
│  │ ZION L1             │         │ Base (L2 EVM)                │   │
│  │                     │  bridge │                              │   │
│  │ • PoW Ekam Deeksha  │ ◄─────►│ • wZION (ERC-20)            │   │
│  │ • UTXO + Account    │         │ • ZIONBridge                 │   │
│  │ • Fee-split coinbase│         │ • ZIONStaking (APR 12%)     │   │
│  │ • Bridge vault addr │         │ • ZIONGovernance             │   │
│  │                     │         │ • ZIONFarm (yield farming)   │   │
│  │                     │         │ • Uniswap V3 (wZION/WETH)   │   │
│  └─────────────────────┘         └─────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Swap Flow — Detailní Implementace

### A) ZION → ETH (One-Click)

```
Uživatel v Desktop/Mobile/Web:
  1. Vybere: "Swap 1000 ZION → ETH"
  2. App zobrazí: ~0.XX ETH (z Uni V3 oracle), fee ~0.X ZION
  3. Uživatel potvrdí → App podepíše lokálním klíčem

Backend:
  4. Odešle lock TX na L1: 1000 ZION → bridge vault
     memo: BRIDGE:base:<user_evm_addr>
  5. Bridge detekuje lock → čeká 60 bloků
  6. Bridge mintne 1000 wZION na user_evm_addr
  7. Swap Aggregator:
     a. approve(wZION, UniswapRouter)
     b. exactInputSingle(wZION → WETH, user_evm_addr)
     c. unwrapWETH → ETH na user_evm_addr

UI status:
  "Locking ZION..." → "Waiting for confirmations (12/60)..."
  → "Bridging to Base..." → "Swapping on Uniswap..."
  → "✅ 0.XX ETH received!"

Celkový čas: ~60 bloků × 60s = ~60 min (s optimalizací: ~20-30 min)
```

### B) ETH → ZION (Reverse)

```
Uživatel:
  1. Vybere: "Swap 0.1 ETH → ZION"
  2. Připojí MetaMask (nebo integrovaná EVM peněženka)

Backend:
  3. Swap ETH → wZION na Uni V3
  4. Burn wZION na ZIONBridge kontraktu (recipient = L1 adresa)
  5. Bridge detekuje Burn event → čeká na Base finality
  6. Bridge odešle unlock TX na L1 → ZION přistane na L1 adrese

UI status:
  "Swapping ETH → wZION..." → "Burning wZION..."
  → "Bridging to ZION L1..." → "✅ XXXX ZION received!"
```

### C) Optimalizace — Snížení Čekací Doby

| Vylepšení | Efekt | Složitost |
|-----------|-------|-----------|
| Snížit finality z 60 na 20 bloků (pro malé TX) | 3× rychlejší | Nízká |
| Tiered finality: <100 ZION = 10 bloků, >10K = 60 | Rychlé malé swapy | Střední |
| "Fast bridge" — pre-fund wZION pool pro instant mint | Téměř okamžitý | Vysoká |
| Liquidity pool pre-funding (LP provozovaný námi) | Instant swaps | Vysoká |

---

## 🧑‍💻 Implementační Pořadí (Priority Queue)

```
WAVE 1 — Bridge Production (TEĎ, 1-2 týdny)
├── 0.1  Ověřit 3. test TX na MetaMask
├── 0.2  Rebuild bridge s safety guard
├── 0.3  Burn→Unlock E2E (reverse bridge)
├── 2.1  Seed Uni V3 likviditu
└── 1.9  HTTP REST wrapper pro node RPC

WAVE 2 — Core Infrastructure (2-3 týdny)
├── 1.1  getTransactionHistory RPC
├── 1.2  getAddressInfo RPC
├── 1.5  getNetworkStats RPC
├── 1.11 TypeScript wallet SDK
├── 1.12 Wallet Create/Import/Export
└── 1.14 Transaction builder

WAVE 3 — DEX & Swap (2-3 týdny)
├── 2.2  Swap Aggregator backend
├── 2.3  Price feed / oracle
├── 2.4  Swap UI komponent
├── 2.5  EVM wallet connect (MetaMask)
├── 2.6  Reverse swap (ETH→ZION)
└── 2.7  Slippage protection

WAVE 4 — Explorer & Dashboard (2-3 týdny)
├── 3.1  Bridge Tracker
├── 3.3  Network Stats
├── 3.4  Supply Dashboard
├── 3.5  Address TX History
├── 3.8  Search Upgrade
└── 3.11 Staking Dashboard

WAVE 5 — Desktop & Mobile (3-4 týdny)
├── 4.1  Desktop Bridge UI
├── 4.2  Desktop Swap UI
├── 4.5  Desktop Portfolio Dashboard
├── 4.7  Desktop EVM Wallet
├── 4.11 Mobile Real Bridge
├── 4.12 Mobile Swap Screen
├── 4.16 Mobile Biometric Auth
└── 4.18 Mobile Portfolio View

WAVE 6 — Website & Launch (2-3 týdny)
├── 5.2  Funkční bridge page
├── 5.4  Swap page
├── 5.5  Staking page
├── 5.9  API documentation
├── 5.13 Whitepaper
├── 5.14 BitcoinTalk ANN
└── 5.15 One-pager
```

---

## 📊 Souhrnný Odhad

| Wave | Oblast | Odhad | LOC | Testů |
|------|--------|-------|-----|-------|
| 1 | Bridge Production | 1-2 týdny | +500 | +20 |
| 2 | Core Infrastructure | 2-3 týdny | +3,000 | +80 |
| 3 | DEX & Swap | 2-3 týdny | +4,000 | +60 |
| 4 | Explorer & Dashboard | 2-3 týdny | +5,000 | +40 |
| 5 | Desktop & Mobile | 3-4 týdny | +8,000 | +50 |
| 6 | Website & Launch | 2-3 týdny | +3,000 | — |
| **CELKEM** | | **12-18 týdnů** | **+23,500 LOC** | **+250** |

---

## 🔐 Bezpečnostní Checklist Pro Launch

| # | Oblast | Požadavek | Stav |
|---|--------|----------|------|
| S1 | Bridge klíče | 3/5 multisig, HSM nebo encrypted at rest | ⬜ |
| S2 | Smart kontrakty | Audit (alespoň interní + 1 external review) | ⬜ |
| S3 | Node RPC | Rate limiting, auth pro write metody | ⬜ |
| S4 | Wallet encryption | AES-256, platform keychain, biometric | Částečně ✅ |
| S5 | PREMINE klíče | Scrub z git historie (BFG) před public repo | ⬜ KRITICKÉ |
| S6 | Frontend CORS | Omezit na vlastní domény | ⬜ |
| S7 | SSL/TLS | HTTPS pro web + RPC endpoint | ⬜ |
| S8 | Monitoring | Alerting na anomálie (velké bridgy, neznámé peery) | Částečně ✅ |
| S9 | Bug bounty | Program po public launch | ⬜ |
| S10 | Backup & DR | Chain state backup, bridge state backup, key backup | ⬜ |

---

## 🎯 Milníky & Go/No-Go Gates

### Milestone 1: "Bridge Complete" ✅→⏳
- [x] L1→Base mint funguje
- [ ] Base→L1 unlock funguje
- [ ] 3/5 validator threshold
- [ ] Rate limiter + monitoring

### Milestone 2: "DeFi MVP"
- [ ] wZION/ETH swap funguje (Uniswap)
- [ ] Wallet SDK (TS) published
- [ ] Explorer bridge tracker live
- [ ] Staking funkční na mainnetu

### Milestone 3: "App Ready"
- [ ] Desktop Agent: mine + send + bridge + swap
- [ ] Mobile App: wallet + bridge + swap
- [ ] Web: full DeFi dashboard

### Milestone 4: "Launch Ready" 🚀
- [ ] Whitepaper published
- [ ] API docs complete
- [ ] Security audit passed
- [ ] PREMINE keys scrubbed from git
- [ ] BitcoinTalk ANN posted
- [ ] Social media presence (Twitter/X, Telegram, Discord)

---

## 📝 Reference & Existující Docs

| Dokument | Stav | Relevance |
|----------|------|-----------|
| [docs/L2_DEFI_PLAN.md](L2_DEFI_PLAN.md) | Aktuální | Detailní L2 implementace |
| [docs/L2_WZION_BRIDGE.md](L2_WZION_BRIDGE.md) | Aktuální | Bridge architektura + testnet info |
| [docs/L1-L4_ROADMAP.md](L1-L4_ROADMAP.md) | Aktuální | Master roadmapa celého stacku |
| [V3/ROADMAP.md](../V3/ROADMAP.md) | Aktuální | V3 mainnet track detail |
| [V3/docs/MINING_GUIDE.md](../V3/docs/MINING_GUIDE.md) | Published | Veřejný mining guide |
| [V3/docs/NODE_OPERATOR_GUIDE.md](../V3/docs/NODE_OPERATOR_GUIDE.md) | Published | Node operator dokumentace |
| [docs/WARP_ARCHITECTURE.md](WARP_ARCHITECTURE.md) | Design | 7-chain universal bridge (budoucí) |

---

*ZION L2 DeFi Roadmap v1.0 — 2. dubna 2026*  
*Bridge LIVE → DEX → Explorer → Desktop → Mobile → Web → Launch 🚀*
