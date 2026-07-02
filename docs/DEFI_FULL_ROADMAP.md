# ZION L2 — Full DeFi Roadmapa (Realistický plán)

> **Datum:** 2026-06-24 (přepsáno — realistická analýza stavu, fázovaný plán)
> **Status:** Pool seeded / zítra. Most implementovaných věcí EXISTUJE v kódu — chybí E2E spuštění.
> **Cíl:** Funkční L2 ekosystém do veřejného launche 2026-12-31

---

## Jak to reálně funguje — co existuje vs. co ještě nefunguje

### ✅ Funguje v produkci (živé, ověřené)

```
L1 BLOCKCHAIN
  ✅ Chain běží 24/7 — Core (VPN) + Edge (77.42.71.94)
  ✅ ~12 400+ bloků, 60s target, LWMA DAA
  ✅ Ekam Deeksha v2 PoW — GPU/CPU mining funguje
  ✅ Coinbase fee-split 89/5/5/1 on-chain enforced
  ✅ UTXO model, mempool, reorg, IBD sync
  ✅ ~1 300 testů, 0 failures
  ✅ P2P + RPC TCP JSON-RPC na :8443
  ✅ Mining pool stratum na :8444 (PPLNS)

BRIDGE RELAY (Rust)
  ✅ L1Watcher — sleduje L1 bloky, detekuje lock TX do bridge vault
  ✅ EvmWatcher — eth_getLogs na Base Mainnet, detekuje BridgeBurn eventi
  ✅ Relayer — submitLockProof() odesílá 5 TX / lock (5 validátor klíčů)
  ✅ Timelock poller — executeTimelockedMint() po expiry automaticky
  ✅ Exponential backoff, RPC fallback (Ankr), SQLite stav, graceful shutdown
  ✅ REÁLNĚ OVĚŘENO: 30 TX potvrzeno, 5/5 confirmací pro 6 locků (~100M ZION)
  ✅ ~100M wZION mintováno na 0xdde17506... (po timelock expiry 2026-06-24)

SMART KONTRAKTY — Base Mainnet (deployed, ověřeno)
  ✅ wZION ERC-20: 0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6
  ✅ ZIONBridge 5/5 (live): 0x72c8f0Dc60E27aB7A83fe3B416fab4F0600a6467
  ✅ BridgeValidator: 0x9C138dC6ebA8A883AB3802F6Dcb79C772a835627
  ✅ ZIONStaking (12% APR, 7-day cooldown): deployed
  ✅ ZIONGovernance: deployed
  ✅ ZIONTreasury (multi-sig): deployed
  ✅ ZIONFarm (MasterChef): deployed
  ✅ UniV3Pool (wZION/WETH 0.3%): 0xa88C4C89EB4597Df2e29A8061895300FcDF44FBB — deployed

WEBSITE (Next.js, live na zionterranova.com)
  ✅ Explorer — bloky, TX, adresy, richlist
  ✅ MissionControl dashboard — live stats, mining, bridge status
  ✅ /defi — SwapWidget kód (ethers.js + QuoterV2 + SwapRouter02)
  ✅ /defi — BridgeBurnWidget kód (wZION.bridgeBurn flow)
  ✅ /defi — DefiBalances (čte pool slot0, živé ETH/USD z Chainlink)
  ✅ Price API — seed fallback $0.00002, live z Uni V3 slot0 po seeding
```

### ⚠️ Existuje v kódu, ale nikdy neběželo E2E

```
BRIDGE REVERSE (EVM → L1)
  ⚠️ handle_evm_burn() v relayer.rs — kód je napsán, NIKDY NETESTOVÁNO v produkci
     Problém: L1 unlock TX odesílání — spoléhá na l1_rpc.send_raw_tx() metodu
     která nemusí existovat / nebyla testována proti live L1 nodu
  ⚠️ BridgeBurnWidget na webu — kód existuje, ale burn→unlock flow nebyl E2E ověřen

STAKING (ZIONStaking.sol)
  ⚠️ Kontrakt zatím jen na Base Sepolia — deploy na Base Mainnet čeká
     Problém: notifyRewardAmount() NEBYL nikdy zavolán → rewards pool = 0
     Uživatel může stakovat, ale dostane 0 rewards (bez chyby!)
     Musí se zavolat: wZION.approve(stakingContract, 20M×1e18)
                      stakingContract.notifyRewardAmount(20M×1e18)
  ✅ Web UI mainnet-ready: wallet connect, stake/unstake/claim, cooldown tracking,
     live APR z kontraktu, approve+stake flow, TX status s basescan linky
     (commit 107a121, 2026-06-24)

YIELD FARMING (ZIONFarm.sol)
  ⚠️ Kontrakt zatím jen na Base Sepolia — deploy na Base Mainnet čeká
  ⚠️ Rewards seed nebyl vložen (rewardPerSecond = 0)
  ✅ Web UI mainnet-ready: wallet connect, pool list s APR odhadem,
     deposit/withdraw/claim, per-user positions, approve+deposit flow
     (commit 107a121, 2026-06-24)

SWAP (UniV3 SwapWidget)
  ⚠️ Kód správný — QuoterV2 + SwapRouter02 + approve flow
     Problém: Pool neinicializovaný (sqrtPriceX96 = 0) → QuoterV2 reverts → UI
     zobrazuje "could not get quote" / nulový output
     Po pool seeding bude IHNED fungovat (kód je připraven)

EXPLORER BRIDGE TRACKER
  ✅ BridgeTracker komponenta na /bridge — live pipeline:
     L1→L2 (lock→confirm→mint) + L2→L1 (burn→submit→unlock)
     s Prometheus metrics, 10s polling, refresh button
     (commit 107a121, 2026-06-24)
```

### ❌ Chybí / není implementováno

```
  ❌ Wallet SDK (npm balíček) — žádný zion-wallet-core pro web/mobile
  ❌ WebSocket L1 (subscribeNewBlocks, subscribePendingTx) — endpoint neexistuje
  ❌ Mobile DeFi screens — placeholder, React Native bridge/swap/staking nefunguje
  ❌ NCL (Neural Consciousness Layer) — stuby, žádné live ONNX endpointy
  ✅ WARP Bitcoin/Solana adapter — implemented (BtcSigner P2WPKH + SolanaSigner SPL mintTo)
  ⚠️ WARP Cardano/Aptos/Sui/TON — signer ready, TX builder pending (CBOR/BCS/TL-B)
  ⚠️ WARP Lightning — BOLT11 parser + LND REST client ready, LND node infra pending
  ❌ TX history API (getTransactionHistory pro adresu) — RPC metoda chybí
  ❌ CoinGecko/CMC listing — cena null (čeká na live pool)
  ❌ Atomic Swap UI (HTLC) — ZIONAtomicSwap deployed, žádné UI
```

---

## Fázovaný plán — co dělat v jakém pořadí

### Fáze 0 — Pool Seeding + Kritické E2E testy (IHNED — dnes/zítra)

> **Blocker pro vše ostatní.** Bez pool seeding nefunguje swap, price, staking APR.

| # | Úkol | Stav | ETH / akce |
|---|------|------|------------|
| 0.1 | Ověřit ~100M wZION mintováno na `0xdde17506...` | ⏳ | `cast call wZION "balanceOf(address)"` |
| 0.2 | Top-up validator ETH (5 adres, min 0.01 ETH každá) | ⏳ | 0.05 ETH celkem |
| 0.3 | **Seed UniV3Pool** — approve + NonfungiblePositionManager.mint | ⏳ | **≥ 0.80 ETH celkem** |
| 0.4 | Ověřit pool slot0 — sqrtPriceX96 != 0, tick = -182328 | ⏳ | `cast call pool "slot0()"` |
| 0.5 | **E2E reverse bridge test** — burn 100 wZION → ověřit L1 unlock | ⏳ | Kritické! Zatím netestováno |
| 0.6 | **Seed ZIONStaking** — notifyRewardAmount(20M wZION) | ⏳ | wZION approve + call |
| 0.7 | Seed ZIONFarm — addPool() + rewardPerSecond | ⏳ | wZION approve + call |

**Výstup:** Swap funguje, staking má APR, reverse bridge otestován.

---

### Fáze 1 — Reverse Bridge oprava + Explorer tracker (týden 1–2)

> Reverse bridge (EVM→L1) je největší technické riziko — kód existuje, ale nikdy neběžel v produkci.

| # | Úkol | Priorita | Popis |
|---|------|----------|-------|
| 1.1 | **E2E reverse bridge debug** | P0 | Burn 100 wZION na testovacím wallettu, sledovat relay logy, ověřit L1 unlock. Opravit `handle_evm_burn()` pokud selhává. |
| 1.2 | L1 RPC: ověřit `send_raw_tx` endpoint | P0 | Relay ho volá pro L1 unlock — ověřit že L1 node ho má implementovaný (`V3/L1/core/src/rpc.rs`). |
| 1.3 | Bridge tracker na webu | ✅ DONE | BridgeTracker komponenta na /bridge — live L1→L2 + L2→L1 pipeline s Prometheus metrics (107a121). |
| 1.4 | Bridge status bannery na webu | P1 | Homepage + /defi: "Bridge online · 5/5 validators · last mint: Xm ago" |
| 1.5 | BridgeBurnWidget E2E fix | P1 | Opravit frontend flow po reverse bridge debug. |

---

### Fáze 2 — Swap + Staking UI (týden 2–3)

> Po pool seeding bude SwapWidget fungovat okamžitě. Staking/Farming UI je mainnet-ready (commit 107a121).

| # | Úkol | Priorita | Popis |
|---|------|----------|-------|
| 2.1 | Ověřit SwapWidget po pool seeding | P0 | QuoterV2 quote, approve wZION, SwapRouter02.exactInputSingle. |
| 2.2 | Swap price display — live z UniV3 slot0 | P0 | `/api/defi/price` seed fallback → live po pool init (HOTOVO v kódu). |
| 2.3 | Staking UI — live APR, stake/unstake/claim | ✅ DONE | Mainnet-ready: wallet connect, stake/unstake/claim, cooldown, TX status (107a121). |
| 2.4 | Staking APR kalkulačka | ✅ DONE | `annualRateBps()` z kontraktu + live TVL zobrazení (107a121). |
| 2.5 | Farming UI `/defi/farming` | ✅ DONE | Mainnet-ready: pool list, deposit/withdraw/claim, APR odhad, per-user positions (107a121). |
| 2.6 | Portfolio panel — ZION + wZION + staked + LP | P1 | DefiBalances.tsx rozšíření. |
| 2.7 | Price chart (základní) | P2 | TradingView lightweight chart napojený na `/api/defi/price` historii (ukládat do Redis/SQLite). |

---

### Fáze 3 — Explorer Upgrade (týden 3–4)

| # | Funkce | Priorita |
|---|--------|----------|
| 3.1 | TX history pro adresu (stránkovaný) | P0 — explorery to čekají |
| 3.2 | Network stats — hashrate chart, difficulty, block time avg | P0 |
| 3.3 | Supply dashboard — circulating, mined, bridged, staked, burned | P0 |
| 3.4 | Bridge tracker live — lock→confirm→mint s live countdown | P0 |
| 3.5 | Mempool viewer — pending TX, fee-sorted | P1 |
| 3.6 | Coinbase tracker — fee-split vizualizace (89/5/5/1) | P1 |
| 3.7 | Staking stats — TVL, APR, top stakers | P1 |
| 3.8 | Validator status panel — bridge relay health, latence, last TX | P1 |

**Potřebné RPC metody na L1 node** (musí být implementovány):
```
getTransactionHistory(address, page, limit)   ← chybí
getAddressInfo(address)                        ← chybí
getNetworkStats()                              ← částečně
subscribeNewBlocks (WebSocket)                 ← chybí
```

---

### Fáze 4 — RPC Rozšíření + Wallet SDK (měsíc 2)

> Wallet SDK je blocker pro mobile a pro integraci třetích stran.

| # | Úkol | Platforma |
|---|------|-----------|
| 4.1 | `getTransactionHistory` RPC metoda | L1 Rust node |
| 4.2 | `getAddressInfo` RPC | L1 Rust node |
| 4.3 | `estimateFee` RPC | L1 Rust node |
| 4.4 | `subscribeNewBlocks` WebSocket | L1 Rust node |
| 4.5 | `subscribePendingTx` WebSocket | L1 Rust node |
| 4.6 | HTTP REST wrapper `/api/v1/` | Next.js nebo Express proxy |
| 4.7 | `zion-wallet-core` Rust lib (keygen, sign, address, send) | Rust |
| 4.8 | TypeScript SDK (npm: `@zion/wallet-sdk`) | Web + Mobile |
| 4.9 | WalletConnect v2 integrace | Web |

---

### Fáze 5 — Mobile DeFi (měsíc 2–3)

> React Native app existuje ale DeFi screens jsou placeholder.

| # | Funkce | Priorita |
|---|--------|----------|
| 5.1 | Bridge screen (real — burn/lock flow) | P0 |
| 5.2 | Swap screen (wZION ↔ ETH) | P0 |
| 5.3 | Portfolio view (ZION + wZION + staked) | P0 |
| 5.4 | Biometric auth (FaceID/TouchID pro TX) | P0 |
| 5.5 | Staking screen | P1 |
| 5.6 | Push notifikace (TX, bridge done, block) | P1 |
| 5.7 | QR scan (ZION + EVM adresa) | P1 |
| 5.8 | WalletConnect v2 | P2 |

---

### Fáze 6 — DAO Aktivace (měsíc 3–12 + 2027)

> DAO treasury cliff = ~525 600 bloků od genesis (červen 2027). Do té doby: příprava infrastruktury.

| # | Úkol | ETA |
|---|------|-----|
| 6.1 | Snapshot off-chain voting (Discord/web) | Q3 2026 |
| 6.2 | Web DAO dashboard `/defi/dao` — proposals view | Q4 2026 |
| 6.3 | `zion-cli dao propose` + `vote` CLI | ✅ hotovo |
| 6.4 | Multi-sig treasury UI (5/7 signatáři) | Q4 2026 |
| 6.5 | Treasury cliff ověření on-chain | Q2 2027 |
| 6.6 | First governance proposal + quorum hlasování | Q2 2027 |
| 6.7 | Grant program aktivace | Q3 2027 |

**DAO parametry (ZIONGovernance.sol, deployed):**
- Práh pro návrh: 1 000 000 ZION
- Hlasovací období: 7 dní
- Timelock: 48h
- Quorum: 10 % oběžného množství
- Treasury cliff: DAO_TREASURY_LOCK_HEIGHT ≈ 525 600 bloků (~červen 2027)

---

### Fáze 7 — NCL + WARP (měsíc 3–12)

> Stuby existují. Aktivace po stabilizaci core L2.

#### NCL (Neural Consciousness Layer) — AI Compute Marketplace

| # | Úkol | Stav |
|---|------|------|
| 7.1 | ONNX compute backend — inference task executor | stub → implementovat |
| 7.2 | Pricing engine aktivace | ✅ crate hotov |
| 7.3 | Worker reputation systém | ✅ crate hotov |
| 7.4 | REST API endpointy (`/api/ncl/`) | stub → live |
| 7.5 | ZION/wZION billing pro inference | design fáze |
| 7.6 | Hiran v2.3 integrace do NCL marketplace | plánováno Q4 |

#### WARP — Cross-Chain Bridge

| # | Chain | Stav |
|---|-------|------|
| 7.7 | Base (EVM) | ✅ aktivní přes bridge relay |
| 7.8 | Bitcoin (HTLC atomic swap) | stub → implementovat |
| 7.9 | Solana | stub |
| 7.10 | Cosmos | stub |
| 7.11 | Atomic swap UI (web + desktop) | chybí |

---

### Fáze 8 — Public Launch (2026-Q4 → 2026-12-31)

| # | Materiál / Úkol | Status |
|---|-----------------|--------|
| 8.1 | BitcoinTalk ANN thread | ⏳ příprava |
| 8.2 | Technical Whitepaper v3.0 (PDF + web) | ✅ dokument existuje |
| 8.3 | DeFi Guide (jak bridgovat, swapovat, stakovat) | ⏳ |
| 8.4 | Mining Guide (aktualizovaný pro desktop agent) | ✅ existuje |
| 8.5 | Tokenomics infographic | ⏳ |
| 8.6 | CoinGecko listing | ⏳ (cena null dokud pool prázdný) |
| 8.7 | CoinMarketCap listing | ⏳ |
| 8.8 | Social media assets | ⏳ |

---

## Prioritní seznam — co dělat nejdřív

### Blokery (musí být hotovo před dalším krokem)

```
BLOK A — Pool seeding (IHNED)
  → Seed UniV3Pool: ≥ 0.80 ETH + 60M wZION
  → Seed ZIONStaking: 20M wZION rewards
  → Seed ZIONFarm: 10M wZION rewards + addPool()

BLOK B — Reverse bridge E2E test (do 1 týdne)
  → Burn 100 wZION → ověřit L1 unlock
  → Opravit relayer.rs handle_evm_burn() pokud selhává
  → Ověřit L1 RPC send_raw_tx endpoint

BLOK C — TX history RPC (do 2 týdnů)
  → Implementovat getTransactionHistory v L1 node
  → Explorer pak může zobrazit historii adres
```

### Po odblokování

```
Týden 1–2: Swap UI live, Staking UI live, Bridge tracker
Týden 2–4: Explorer upgrade, Farming UI
Měsíc 2: Mobile DeFi, Wallet SDK
Měsíc 3+: DAO příprava, NCL stuby → live
Q4 2026:  BitcoinTalk ANN, CoinGecko, public launch
```

---

## Realistická metrika stavu (2026-06-24)

| Oblast | % hotovo | Blocker |
|--------|----------|---------|
| L1 blockchain | **95%** | TBD mainnet, audit |
| Bridge L1→EVM (mint) | **95%** | — funguje |
| Bridge EVM→L1 (burn) | **60%** | E2E test neproběhl |
| UniV3Pool (DEX) | **70%** | Čeká na seed ETH |
| Staking (web UI) | **90%** | Deploy kontraktu na mainnet + notifyRewardAmount() |
| Farming (web UI) | **85%** | Deploy kontraktu na mainnet + addPool() + seed |
| Swap UI (web) | **85%** | Funguje po pool seeding |
| Explorer | **75%** | Chybí TX history; bridge tracker ✅ hotovo |
| Desktop Agent | **60%** | DeFi UI placeholder |
| Mobile App | **40%** | DeFi screens placeholder |
| DAO (on-chain) | **30%** | Cliff červen 2027 |
| NCL / WARP | **15%** | Stuby |
| Wallet SDK | **5%** | Neexistuje |

---

## Technická architektura — živý stav

```
┌─────────────────────────────────────────────────────────────────┐
│                    UŽIVATELSKÁ ROZHRANÍ                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────────┐  │
│  │ Desktop  │  │  Mobile  │  │ Website  │  │ zion-cli       │  │
│  │ Electron │  │ RN+Expo  │  │ Next.js  │  │ Rust binary    │  │
│  │ ✅ mining│  │ ⚠️ DeFi  │  │ ✅ live  │  │ ✅ full        │  │
│  │ ⚠️ DeFi │  │ placeholder  │ ⚠️ swap  │  │                │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └───────┬────────┘  │
└───────┼─────────────┼─────────────┼─────────────────┼───────────┘
        │             │             │                 │
┌───────▼─────────────▼─────────────▼─────────────────▼───────────┐
│                        BACKEND SERVICES                          │
│  ZION L1 Node (:8443)          Bridge Relay (Rust)               │
│  ✅ consensus, RPC, P2P        ✅ L1Watcher + EvmWatcher         │
│  ❌ TX history API             ✅ submitLockProof (5/5)           │
│  ❌ WebSocket streams          ⚠️ handle_evm_burn (netestováno)  │
│                                ✅ timelock poller                │
│  Mining Pool (:8444)           Swap Aggregator (Next.js)         │
│  ✅ PPLNS, stratum             ✅ UniV3 route kód hotov           │
│  ✅ dual algo                  ❌ čeká na pool seeding            │
└──────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────▼────────────────────────────────────┐
│                         BLOCKCHAINS                              │
│  ZION L1 (mainnet)                Base Mainnet                   │
│  ✅ ~12 400+ bloků               ✅ wZION ERC-20 deployed        │
│  ✅ bridge vault (keyless)       ✅ ZIONBridge 5/5 deployed      │
│  ✅ ~100M ZION locked            ✅ UniV3Pool deployed            │
│                                  ⏳ Pool neinicializovaný        │
│                                  ⏳ Staking/Farm neplněné        │
│                                  ✅ ~100M wZION mintováno (dnes) │
└──────────────────────────────────────────────────────────────────┘
```

---

*Viz také:*
- [`LIQUIDITY_PLAN.md`](../LIQUIDITY_PLAN.md) — přesné ETH čísla pro pool seeding
- [`BRIDGE_MAINNET_READINESS.md`](../BRIDGE_MAINNET_READINESS.md) — bridge stav
- [`V3/ROADMAP.md`](../V3/ROADMAP.md) — technická L1 roadmapa
- [`StatusV3.md`](../StatusV3.md) — aktuální live stav

*Generated with [Devin](https://devin.ai)*
