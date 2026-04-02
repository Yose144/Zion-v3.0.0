# 🚀 ZION v2.9.6 Changelog — Pre-Mainnet Fork

> *Archive note: tento changelog zachycuje tehdejsi pre-mainnet framing. Aktualni verejny launch stav se ridi novou launch gate linii a zustava NO-GO.*

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
  - Historical v2.9.6 snapshot: Helsinki + Germany multi-node testnet
  - Current live model (2026-03-12): Zion2 primary host `91.98.122.165` + internal seed containers
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
