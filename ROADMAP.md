# ZION TerraNova — Master Roadmap

> **Cíl:** MainNet Genesis — **31. prosince 2026**  
> **Poslední aktualizace:** 2. dubna 2026  
> **Aktivní kódová linie:** `V3/` (clean-room mainnet)

---

## Aktuální Stav

| Oblast | Status |
|--------|--------|
| **L1 Chain** | ✅ V3 mainnet běží na 3 serverech (Praha, USA, Singapur) |
| **Konsensus** | ✅ Cosmic Harmony Ekam Deeksha v2 PoW, LWMA DAA |
| **Mining** | ✅ Pool mining s PPLNS, fee-split 89/5/5/1 |
| **L2 Bridge** | ✅ wZION na Base Mainnet — lock→relay→mint funguje |
| **Smart kontrakty** | ✅ wZION, ZIONBridge, ZIONStaking, ZIONGovernance, ZIONFarm na Base |
| **Explorer** | ✅ Web explorer (bloky, TX, adresy, richlist) |
| **Desktop Agent** | ✅ Electron — mining GUI + wallet |
| **Mobile App** | ✅ React Native — 9 screens |
| **Testy** | ✅ 1,300+ testů, 157 bridge testů |

---

## Fáze vývoje

### ✅ Fáze 1 — L1 Core (Q1 2026) — HOTOVO

- CHv3 PoW s Ekam Deeksha v2 (ASIC-hardened)
- UTXO + Account model, Ed25519 podpisy
- LMDB storage, P2P mesh, IBD sync
- Mempool s fee-rate evickcí
- JSON-RPC 2.0 (17 metod)
- Pool mining (Stratum v2, PPLNS)
- Decade Decay emise, 100% fee burn
- Coinbase fee-split: miner 89% / humanitarian 5% / issobella 5% / pool 1%

### ✅ Fáze 2 — L2 Bridge & Kontrakty (Q1-Q2 2026) — HOTOVO

- wZION ERC-20 na Base Mainnet
- Bridge relay (L1→Base mint, 60-bloková finalita)
- ZIONStaking (APR 12%, 7-day cooldown)
- ZIONGovernance (stake-weighted voting)
- ZIONFarm (MasterChef yield farming)
- ZIONAtomicSwap (HTLC cross-chain)
- DAO governance daemon (65 testů)

### 🔄 Fáze 3 — DeFi Ecosystem (Q2-Q3 2026) — AKTIVNÍ

Detailní plán: [`docs/DEFI_FULL_ROADMAP.md`](docs/DEFI_FULL_ROADMAP.md)

**Wave 1 — Bridge Hardening (duben)**
- [ ] Burn→Unlock směr (Base→L1)
- [ ] 3/5 multisig validator threshold
- [ ] Rate limiter, auto-reconnect
- [ ] Bridge monitoring dashboard

**Wave 2 — RPC & Infrastructure (duben—květen)**
- [ ] HTTP REST wrapper pro node RPC
- [ ] WebSocket subscriptions
- [ ] Rozšířené RPC metody (getAddressHistory, searchTransactions)
- [ ] Wallet SDK (TypeScript)

**Wave 3 — DEX & Swap (květen—červen)**
- [ ] Uniswap V3 seed likvidita (wZION/ETH)
- [ ] Swap UI na webu — one-click ZION→ETH
- [ ] Price feed oracle
- [ ] Swap integrace do desktop/mobile

**Wave 4 — Explorer Upgrade (červen)**
- [ ] Real-time WebSocket updates
- [ ] Bridge TX tracker
- [ ] Staking & DAO dashboard
- [ ] Full-text vyhledávání

**Wave 5 — Desktop & Mobile (červen—červenec)**
- [ ] Desktop: bridge + swap + staking UI
- [ ] Mobile: bridge + swap s biometrickým potvrzením
- [ ] Push notifikace pro TX/bridge/staking

**Wave 6 — Web & Public Launch (červenec—srpen)**
- [ ] Full DeFi dashboard na webu
- [ ] API dokumentace
- [ ] Mining calculator
- [ ] BitcoinTalk / Crypto Twitter announcement

### ⬜ Fáze 4 — Hardening & Audit (Q3 2026)

- [ ] 3rd party security audit
- [ ] BFG repo scrub (premine klíče z git historie)
- [ ] Stress testy (1000+ TX/s, fork simulace)
- [ ] Bug bounty program
- [ ] Dokumentace: whitepaper v3, mining guide, API reference

### ⬜ Fáze 5 — MainNet Launch (Q4 2026)

- [ ] Genesis ceremony
- [ ] Public node binaries (GitHub Releases)
- [ ] Exchange listing prep
- [ ] Mining pool otevřen pro veřejnost
- [ ] Desktop/Mobile distribuce (App Store, web download)

---

## Layer Architecture — Dlouhodobá Vize

```
╭──────────────────────────╮
L6  │  🔭  ZION Issobella      │  2040+
╰────────────┬─────────────╯
╭────────────┴─────────────╮
L5  │  🌍  ZION Free World     │  2030
╰────────────┬─────────────╯
╭────────────┴─────────────╮
L4  │  🎮  ZION Oasis          │  2029
╰────────────┬─────────────╯
╭────────────┴─────────────╮
L3  │  🧠  AI Native / NCL     │  2028
╰────────────┬─────────────╯
╭────────────┴─────────────╮
L2  │  💱  DeFi / Bridge / DAO │  2026-27
╰────────────┬─────────────╯
╭─────────────────┴─────────────────╮
L1  │  ⛏️  ZION TerraNova               │  2026
╰───────────────────────────────────╯
```

| Layer | Rok | Popis |
|-------|-----|-------|
| **L1** | 2026 | PoW blockchain — CHv3, UTXO, 144B supply, Decade Decay |
| **L2** | 2026-27 | DeFi — wZION bridge, DEX, staking, DAO governance |
| **L3** | 2028 | AI Native — NCL compute marketplace, Warp bridges, agent SDK |
| **L4** | 2029 | ZION Oasis — game economy, XP, NFT, Play-to-Mine |
| **L5** | 2030 | Free World — humanitarian missions, free energy |
| **L6** | 2040+ | ZION Issobella — Earth orbital observatory |

---

## Klíčové Parametry

| Parametr | Hodnota |
|----------|---------|
| Total Supply | 144,000,000,000 ZION |
| Block Reward | 5,400.067 ZION (Decade Decay -20%/10y) |
| Tail Emission | ~724.785 ZION/block (perpetual) |
| Block Time | 60 sekund |
| Konsensus | Proof of Work — Cosmic Harmony v3 |
| TX Model | UTXO + Ed25519 |
| Fee Policy | 100% burn |
| Mining Horizon | 100+ let |

---

## Dokumentace

| Dokument | Popis |
|----------|-------|
| [V3/ROADMAP.md](V3/ROADMAP.md) | V3 implementační detail — source of truth |
| [docs/DEFI_FULL_ROADMAP.md](docs/DEFI_FULL_ROADMAP.md) | DeFi ecosystem plán (6 waves) |
| [docs/MAINNET_CONSTITUTION.md](docs/MAINNET_CONSTITUTION.md) | Neměnné parametry protokolu |
| [docs/v2.9.6/](docs/v2.9.6/) | Specifikace v2.9.6 (konsensus, P2P, tokenomika) |
| [docs/whitepaper/](docs/whitepaper/) | Technický whitepaper |

---

*"On the Star — building for 100 years, not for a hype cycle."* ⭐
