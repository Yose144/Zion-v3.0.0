# 🚀 ZION v2.9.6 Changelog — Pre-Mainnet Fork

> *Co je nového od v2.9.5. Cílový mainnet: 31. prosince 2026.*

---

## Verze 2.9.6 (Pre-Mainnet) — Únor 2026

### ⚙️ Konsenzus

- **CHv3 unifikace** — Cosmic Harmony v3 je nyní jediný PoW algoritmus
  - CH v1 (12 rundů, u32 nonce, XOR bridge) — odstraněn, archivován
  - CH v2 (4 MB scratchpad, 8 rundů) — odstraněn, archivován
  - Jediná kanonická funkce: `cosmic_harmony_v3_with_height(blob, nonce, height)`
  - Miner, pool i node volají identickou hash funkci — žádná divergence
- **Memory-hard scratchpad** (Phase 4) — 256 KiB, 4 průchody, 512 random reads
  - Fork height: 50 000 (`CHV3_MEMORY_HARD_FORK_HEIGHT`)
  - Runtime overrides pro testování: `ZION_CHV3_MEMORY_HARD_FORCE`, `ZION_CHV3_MEMORY_HARD_DISABLE`
- **ASIC resistance score**: 75 → 90 (díky memory-hard vrstvě)
- **Nonce**: u32 → u64 (64-bit nonce pro budoucí GPU mining)
- **Decade Decay emission** — Model A schválen a implementován
  - -20% block reward každých 10 let (5,256,000 bloků)
  - Base: 5,400.067 ZION → Tail: 724.785 ZION/block (od 2126, navždy)
  - Mining horizont prodloužen z 45 let na 100+ let + tail emission
- **Block reward distribuce** — 89% miner / 5% humanitarian / 5% L5/L6 Issobella / 1% pool
  - Humanitární tithe snížen z 10% na 5%
  - Nový 5% fond pro L5 Free World + L6 ZION Issobella
  - ZION Oasis (L4) revenue share jako doplňkový off-chain zdroj
- **L6 vesmírná stanice pojmenována** — **ZION Issobella** ✅

### ⛏️ Mining

- **Paralelní dual-mining** — ZION 3T + VRSC 1T (ne time-switching)
  - PerMiner group support v pool scheduleru
  - Miner `--group zion|revenue` CLI flag
  - Pool `g=` password hint (`user.worker:p=zion,g=zion`)
  - `ZION_SCHEDULER_PERMINER_MIN_MINERS=2` env variable
- **VerusHash 2.2 nativní ARM64** — FFI binding k C/C++ knihovně
  - LuckPool ZcashStratum proxy v pool
  - E2E funkční: 2/2 accepted shares
- **GPU mining** — Metal shader pro CHv3 (macOS), OpenCL kernel (Linux)
  - GPU ↔ CPU parity validace
  - EthashMetalMiner + KawPow GPU support

### 🌐 Pool

- **Share validator** — sjednocen na CHv3 (odstraněny v1/v2/v3 varianty enum)
  - Jediný `CosmicHarmony` = CHv3 v pool Algorithm enum
  - state0 (u32 LE) target porovnání
  - Duplicate detection s miner_id (cross-miner nonce overlap safe)
- **PerMiner group scheduler** — paralelní mining skupiny
  - Skupina `zion` = ZION native mining (CHv3)
  - Skupina `revenue` = external pool mining (VRSC/ETC/RVN)
  - Auto-detection přes `g=` hint v stratum password
- **CHv3 byproduct export** — 4-vrstvá stream architektura (scaffolding)
- **VRSC vardiff** — `ZION_ZC_PASS` pro VerusHash difficulty (default d=0.01)

### 🏗️ Infrastruktura

- **Servery**:
  - Helsinki (77.42.31.72) — seed node + web
  - Germany (46.225.126.243) — seed node
- **Docker** — `docker-compose.native-2.9.5.yml` (bude aktualizován na 2.9.6)
- **Config** — `config/mainnet.toml`, `testnet.toml`, `devnet.toml`

### 📦 Codebase

- **Rust workspace**: 4 crate (`core`, `cosmic-harmony`, `pool`, `miner`)
- **Build**: `cargo build --workspace` — 0 errors
- **Testy**: core 233/233, pool 35/35, chv3 47/47 ✅
- **Archiv**: `archive/legacy-algorithms/` (CH v1 + v2 zdrojáky + README)

### 📄 Dokumentace

- `docs/v2.9.6/consensus.md` — kompletní CHv3 specifikace
- `docs/v2.9.6/tokenomics.md` — 5 návrhů emission schedule (100-letá vize)
- `docs/v2.9.6/layer-architecture.md` — 6-vrstvá architektura (L1–L6)
- `docs/v2.9.6/changelog.md` — tento soubor
- `docs/v2.9.6/p2p.md` — P2P protokol
- `docs/v2.9.6/launch-plan.md` — Mainnet launch plán

---

## Session 9–17 Únor + 24. Únor 2026 — L2/L3/L4 implementace

### 🔗 L2 — Bridge + DAO

- **Ankr integrace** — odstraněna závislost na `ethers-rs` v2, nahrazena čistým
  Ankr HTTP JSON-RPC clientem (`AnkrClient`)
  - `evm_watcher.rs` přepsán — `get_logs`, `get_block_number`, sledování EVM bridge events
  - Rust native HTTP (`reqwest`) místo heavyweight Web3 Ethers stacku
  - 157 testů (`zion-bridge`) — E2E mock testy, AnkrClient unit testy
- **L2/dao** — 65 testů
  - `governance.rs` — Proposal lifecycle (Draft→Active→Passed/Failed→Executed)
  - `treasury.rs` — Treasury 4B ZION, allokace, emergency withdrawal
  - `humanitarian.rs` — Humanitarian fund tracking, verified recipients
  - `voting.rs` — Weighted voting, quorum 20%, majority 60%
  - REST API (Axum, port 8093) + SQLite persistence
- **Dokumentace**: `docs/ankr.md` — Ankr integrace, wZION plán, průvodce pro laiky

### 🧠 L3 — WARP + AI

- **zion-warp** — 164 testů (největší test suite v projektu)
  - REST API (Axum, port 8092) — chain status, cross-chain swap quotes, order book
  - SQLite persistence — `WarpDb` s kompletním swap history
  - 7 chain family adapters: Cosmos, EVM (via Ankr), Bitcoin, Solana, Near, Polkadot, TON
  - XP Bridge — on-chain XP akumulace přes WARP swapy
  - 58 REST API testů, 45 adapter testů, 35 DB testů, 26 XP bridge testů
- **CHv3 ASIC hardening** — Session 56 (únor 2026)
  - `AES-NI Haraka-inspired` mask v Cosmic Fusion (Phase 5)
  - Fork height `ASIC_HARD_FORK_HEIGHT = 100_000`
  - L1 kompatibilita s VRSC dual-mining zachována
  - Docs: `docs/v2.9.6/L3_AI_ARCHITECTURE.md`

### 🎮 L4 — ZION Oasis

- **SQLite persistence** (`db.rs`) — 9 nových testů
  - `OasisDb`: `save_player`, `get_player`, `get_or_create_player`
  - `save_guild`, `get_guild`, `list_guilds`
  - `top_players`, `player_rank`, `player_count`, `guild_count`
  - Thread-safe `Arc<Mutex<Connection>>`, opravena deadlock podmínka v `player_rank`
- **Axum REST API** (`server.rs`, port 8094) — 7 nových testů
  - 9 endpointů: health, player, xp award, leaderboard, guild CRUD, territory map, reward pools
  - `OasisState { db, config, xp_sys }` — sdílený stav přes Axum Extension
  - `TerritoryMap` — přidán `#[derive(Serialize)]`
  - `RewardSlot::all()` + `RewardPool::new(slot)` — dynamické generování 5 poolů
- **Binary** (`main.rs`) — env overrides: `OASIS_PORT`, `OASIS_BIND`, `OASIS_DB`
- **Celkem tesů zion-oasis**: 56 (bylo 40 před touto session)
- **Dokumentace**: `docs/v2.9.6/L4_OASIS_ARCHITECTURE.md`

### 📊 Celkový přehled testů (Únor 2026)

| Crate | Testů | Vrstva |
|-------|-------|--------|
| `zion-warp` | 164 | L3 |
| `zion-bridge` | 157 | L2 |
| `zion-oasis` | 56 | L4 |
| `zion-dao` | 65 | L2 |
| `zion-ai-native` | 45 | L3 |
| `zion-ncl` | 40 | L3 |
| `zion-cosmic-harmony-v3` | 47 | L1 |
| L1 core/pool/miner | ~268 | L1 |
| **Celkem** | **~842** | všechny vrstvy |
- `docs/v2.9.6/migration.md` — Migrační průvodce
- `docs/v2.9.6/audit.md` — Bezpečnostní audit

---

## Verze 2.9.5 (NativeAwakening) — Leden 2026

Předchozí verze. Klíčové milníky:
- Nativní Rust implementace (přechod z Python referenční impl.)
- CHv3 crate (`zion-cosmic-harmony-v3`)
- Multi-chain mining framework
- VerusHash ARM64 FFI
- Pool stratum server (XMRig kompatibilní)
- P2P síť (2 seed nody)
- Genesis blok s Strom Života ASCII art

---

## Plánováno pro v2.9.7+ (Mainnet)

- [ ] Algorithm rotation (DAO governance vote)
- [ ] Halving / emission curve finalizace
- [ ] Full security audit (3rd party)
- [ ] Exchange listing (Tier 5)
- [ ] Mobile wallet (React Native)
- [ ] Block explorer (veřejný)
- [ ] Documentation anglicky
