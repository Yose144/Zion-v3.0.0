# ZION TerraNova — Master Roadmap

> **Cíl:** MainNet Genesis — **31. prosince 2026**  
> **Poslední aktualizace:** 12. května 2026  
> **Aktivní kódová linie:** `V3/` (clean-room mainnet)  
> **Provozní pravda:** [`StatusV3.md`](StatusV3.md) + [`V3/ROADMAP.md`](V3/ROADMAP.md)

---

## Aktuální stav (květen 2026)

| Oblast | Status |
|--------|--------|
| **L1 Chain (V3)** | ✅ Cosmic Harmony **Ekam Deeksha v2** PoW, LWMA DAA; **TX hash v2** + **F2 BLAKE3 body root (BODY_ROOT_V2)** aktivní od výšky **0** na novém řetězci (viz `V3/L1/cosmic-harmony`, `StatusV3.md`) |
| **Provozní uzly** | 🔄 Dříve tři uzly včetně Prahy — **legacy Praha deprecated** (2026-05-07); cíl Genesis #0 = **3 nové servery**, čistý datadir, žádný carry-over deploy klíčů |
| **Mining** | ✅ Pool PPLNS, fee-split **89/5/5/1** (on-chain ověřeno ve V3 éře) |
| **L2 Bridge** | ✅ Relayer **fail-closed** (žádné syntetické proof sloty); **staging** konfigurace validátorů stále **1/2** → produkce **3/5** + provisioning klíčů (viz `V3/L2/bridge/config/bridge-mainnet.toml`, `StatusV3.md` §1.4) |
| **Smart kontrakty** | ✅ wZION, ZIONBridge, ZIONStaking, ZIONGovernance, ZIONFarm na Base (viz bridge docs) |
| **Explorer / web** | ✅ Provozní stack dle nasazení; web v `APP&WEB/` |
| **Desktop Agent** | ✅ Electron — mining GUI + wallet |
| **Mobile App** | ✅ React Native |
| **Testy (V3 workspace)** | ✅ řádově **~1 470+** testů, 0 fail při posledním clean gate (`StatusV3.md` §5) |
| **Repo bezpečnost** | ✅ **2026-05-07** `git filter-repo` + rotace credentialů (ZION_KEYS, archivy odstraněny z historie `main`); staré klony považovat za rizikové |

---

## Květen 2026 — nově dodaná práce (git `main`, výběr)

### ZION OASIS (dokumentace / příprava L4)

- Rozšíření lore a **avatar rosteru** v [`docs/docs2.9/ZION_OASIS/`](docs/docs2.9/ZION_OASIS/) — zejména `SACRED_TRINITY/` (řada commitů `91cfbd8f` → `55d2490a`: roster přes **150+** až **~201** postav včetně vlny **Ancient Egypt #192–201**).
- Související herní / cosmické texty v `GOLDEN_EGG_GAME/` a indexy v kořeni `ZION_OASIS/`.

### TerraNova + Forsita (dokumentace)

- Rozšíření **TerraNova** materiálů (Hawaii, Tibet, Sámové, knižní koncepty) a **Forsita** mainnet guide pro laiky (`c84bc048`, `65696453`, `282f19aa`, `6a5f6996`, …).

### Hiran v2.1 (doménový agent + školicí továrna)

- Struktura pod [`HiranV2.1/`](HiranV2.1/): kurikulum, **finetune stack** přesunutý do `HiranV2.1/finetune/` (`c41d1f5f`).
- **RAG / corpus / Vast** budget pipeline a LoRA merge opravy (`6b927882`).
- Dokumentace **UE5 Oasis** podpory (`dbd6010c`); kanonický plán: [`HiranV2.1/Hiran_v2.1.md`](HiranV2.1/Hiran_v2.1.md).
- Následující práce: verzovaný RAG index, ONNX/export cesta, držet velké shardy mimo git (viz `.gitignore` v HiranV2.1).

### Repo procesy

- Sjednocení statusů, `AGENTS.md`, merge konfliktů status + Hiran (`a0029c0f`, `8af66e1f`); pre-commit whitespace pass (`5ed2ac87`).

---

## Fáze vývoje

### ✅ Fáze 1 — L1 Core (Q1 2026) — HOTOVO

- **Cosmic Harmony — Ekam Deeksha v2** PoW (256 KiB scratchpad, ASIC-hardened; jednotný mainnet profil od genesis — viz `V3/L1/cosmic-harmony`)
- UTXO + Account model, Ed25519 podpisy
- LMDB storage, P2P mesh, IBD sync
- Mempool s fee-rate evikcí
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
- [x] **Uniklé cesty v gitu** (ZION_KEYS, `V3-src*`, tokenové stringy) — **`git filter-repo` + force-push hotovo 2026-05-07** (viz `StatusV3.md`)
- [ ] **Premine / provozní klíče** — koordinovaný postup dle `V3/ROADMAP.md` Phase 24 + constitution; ověřit **všechny staré klony/for** bez pre-scrub historie
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
| **L1** | 2026 | PoW blockchain — Cosmic Harmony **Ekam Deeksha v2**, hybridní účet+UTXO, 144B supply, Decade Decay |
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
| Konsensus | Proof of Work — Cosmic Harmony **Ekam Deeksha v2** |
| TX Model | UTXO + Ed25519 |
| Fee Policy | 100% burn |
| Mining Horizon | 100+ let |

---

## Dokumentace

| Dokument | Popis |
|----------|-------|
| [V3/ROADMAP.md](V3/ROADMAP.md) | V3 implementační detail — source of truth (dlouhý sprintový log + supplement 2026-05) |
| [StatusV3.md](StatusV3.md) | Mainnet polish, bezpečnostní cleanup, test pyramida, P0/P1 |
| [HiranV2.1/Hiran_v2.1.md](HiranV2.1/Hiran_v2.1.md) | Hiran v2.1 agent + kurikulum + RAG/OASIS vazby |
| [docs/docs2.9/ZION_OASIS/](docs/docs2.9/ZION_OASIS/) | OASIS (L4) — `SACRED_TRINITY` avatary, Golden Egg, cosmic map |
| [docs/DEFI_FULL_ROADMAP.md](docs/DEFI_FULL_ROADMAP.md) | DeFi ecosystem plán (6 waves) |
| [docs/MAINNET_CONSTITUTION.md](docs/MAINNET_CONSTITUTION.md) | Neměnné parametry protokolu |
| [docs/v2.9.6/](docs/v2.9.6/) | Specifikace v2.9.6 (konsensus, P2P, tokenomika) |
| [docs/whitepaper/](docs/whitepaper/) | Technický whitepaper |

---

*"On the Star — building for 100 years, not for a hype cycle."* ⭐
