# ZION TerraNova — Changelog v2.9.7

> **Datum:** 24. února 2026  
> **Navazuje na:** v2.9.6 "On the Star"  
> **Codename:** Code Freeze Gate

---

## Přehled změn

v2.9.7 uzavírá všechny podstatné technické dluhy před mainnet code freeze.
Klíčové oblasti: CHv3 ASIC hardening + AES-NI optimalizace, oprava Windows/MSVC buildu,
dokončení revenue systému, infrastrukturní stabilizace.

---

## [CHv4.1] Golden Middle — Parametry a Implementace

**Commit:** `b7496ad` (5. března 2026)  
**Soubory:** `scratchpad.rs`, `algorithms_opt.rs`, GPU kernels (OpenCL/CUDA/Metal), C native lib, Python miner

### Přehled změn oproti CHv4 Heavy

| Parametr | CHv4 Heavy (previous) | CHv4.1 Golden Middle |
|----------|----------------------|---------------------|
| SCRATCHPAD_SIZE | 512 KiB | **64 KiB** (L2 cache-resident) |
| BLOCK_COUNT | 1024 | 1024 |
| PASSES | 2 | 2 |
| RANDOM_READS | 64 | 64 |
| CPU/GPU poměr | ~1:8 | **~1:2** (zlatý střed) |

### Výsledky
- Rust testy: **64/64 PASS**
- Pool E2E testy: **11/11 PASS**
- Rust/C native parity: **shoda** ✅
- Reference hash: `655348e35abb6732cf0229a3b5fa0827ee5424f36d92e515827030b843cdc4b0`

---

## [CHv4.2] Merkabah Dual-Spin — Plná Implementace

**Commit:** `b7496ad` (5. března 2026, 13 souborů, 743 insertions)  
**Soubory:** `hic.rs` (nový), `scratchpad.rs`, `algorithms_opt.rs`, OpenCL/CUDA/Metal kernely, C native, Python miner

### Nové parametry (nad CHv4.1)

| Parametr | Hodnota | Filosofický základ |
|----------|---------|-------------------|
| BACKWARD_PASSES | 2 | Merkabah Ka↓/Ra↑ dualita |
| KABALA_READS | 22 | 22 pólů vědomí (Sefirot) |
| KEY_ROUNDS | 22 | 22 pismen hebrejské abecedy |
| HIC[22] | φ-odvozené konstanty | Hiranyagarbha Initialization Constants |

### Nový modul `hic.rs`
```rust
pub const HIC: [u64; 22] = [
    0x9E3779B97F4A7C15, // φ fraction × 2^64  = Kether
    // ... 22 konstant, HIC[21] = 0xDB0C2E0D64F98FA7 (Ain Soph Aur = Brahma-jyoti)
];
pub const BACKWARD_PASSES: usize = 2;
pub const KABALA_READS: usize = 22;
pub const KEY_ROUNDS: usize = 22;
```

### Nové funkce v `scratchpad.rs`
- `memory_hard_transform_v4_2(input: &[u8; 64]) -> Hash64`
  - Fáze 3: `merkabah_backward_passes()` — reverzní průchod s HIC indexováním
  - Fáze 5: `kabala_phase()` — 22 čtení s `HIC[k] XOR state_u64 % blocks`
  - Fáze 6: `brahma_jyoti_finalize()` — Keccak per round + HIC[r]

### Fork dispatch v `algorithms_opt.rs`
```rust
pub const CHV4_2_FORK_HEIGHT: u64 = u64::MAX; // Deaktivováno — čeká mainnet vote
// Testnet: chv4_2_fork_height = 10000 (testnet.toml)
```

### Výsledky
- Rust testy: **72/72 PASS** (8 nových CHv4.2 testů)  
- Pool E2E testy: **11/11 PASS**
- Rust/C native parity: **100% shoda** ✅
- Reference hash CHv4.2: `4fa66192c0e9b154e3d33c94c1533850ae871f2affa8ccc74952ee9ca074f32f`
- ASIC odolnost: +~6× oproti CHv4.1

### Server Deployment
| Server | IP | Build | Status |
|--------|-----|-------|--------|
| Helsinki 🇫🇮 | 77.42.31.72 | 2026-03-05 | ✅ UP, `zion-core + zion-pool:2.9.6-testnet` |
| USA 🇺🇸 | 178.156.240.160 | 2026-03-05 | ✅ UP, `zion-core + zion-miner:2.9.7-amd64` |
| Asia 🌏 | 5.223.43.93 | 2026-03-05 | ✅ UP, `zion-core:2.9.7 + zion-miner:2.9.6-testnet` |


---

## [CHv3] ASIC Resistance Hardening

**Commit:** `8a2b295`  
**Soubory:** `L1/cosmic-harmony/src/algorithms_opt.rs`, `L1/cosmic-harmony/src/scratchpad.rs`

### Změny

| Parametr | Před (2.9.6) | Po (2.9.7) | Důvod |
|---|---|---|---|
| Fork výška | `50 000` | **`100 000`** | Více času pro testnet provoz před aktivací |
| `SCRATCHPAD_SIZE` | 256 KiB | **512 KiB** | Přesahuje L1/L2 ASIC cache; vynucuje DRAM |
| `PASSES` | 4 | **4** | 4 × 512 KiB = 2 MiB R/W per hash |
| `RANDOM_READS` | 512 | **256** | Data-dependent, dostatečné pokrytí |
| XOR maska | statická `COSMIC_XOR_MASK` | **data-dependent** per-round | ASIC nemůže hardwirovat |
| Env overrides | dostupné vždy | **zakázány v `--release`** | Produkce řízena výhradně výškou bloku |

### Benchmark výsledky (release build, 12-jádrový CPU)

| Scénář | Výsledek |
|--------|---------|
| Legacy pipeline (1 vlákno) | ~108 kH/s |
| Full CHv3 pipeline (1 vlákno) | **~10.5 H/s** |
| Full CHv3 pipeline (12 vláken) | **~70.3 H/s** |
| Zpomalení vůči legacy | **~10 000×** |

---

## [CHv3] AES-NI Haraka-Inspired Mask (Cosmic Fusion)

**Commit:** `c6189c4`  
**Soubory:** `L1/cosmic-harmony/src/algorithms_opt.rs`, `L1/cosmic-harmony/Cargo.toml`  
**Nová závislost:** `aes = "0.8.4"` (RustCrypto, auto-detekce AES-NI)

### Změna

Druhý `Keccak256` v `fusion_round()` nahrazen AES-128 blokovým šifrováním (Haraka-inspired):

```
Předchozí:  second_hash = Keccak256(state[32..64] || round || 0xAB)   ≈ 50 ns

Nové:       intermediate = Keccak256(state[0..32] || round)
            block0 = AES128_encrypt(key=intermediate[0..16], state[32..48])    ≈ 1–2 ns (AES-NI)
            block1 = AES128_encrypt(key=intermediate[0..16]^tweak, state[48..64])
```

### Výhody

- CPU s AES-NI (`AESENC` instrukce): **25× rychlejší** mask computation
- ASIC musí implementovat **AES hardware + Keccak hardware** = dvojitá bariéra
- Technika identická s **Haraka sponge z VerusHash 2.2** (ověřená v produkci)
- Data-dependent klíč — není co hardwirovat

### Testy (release build)

```
cargo test -p zion-cosmic-harmony-v3 --release
test result: ok. 52 passed; 0 failed  (35s)
```

---

## [Build] Windows MSVC Compatibility Fix

**Commit:** `243e4b8`  
**Soubory:** `L1/native-libs/verushash-native/build.rs`, `L1/native-libs/verushash-native/csrc/haraka.c`, `L1/core/Cargo.toml`

### Opravené problémy

| # | Soubor | Chyba | Oprava |
|---|--------|-------|--------|
| 1 | `csrc/haraka.c` | `#include "crypto/haraka.h"` — cesta neexistuje | `#include "haraka.h"` |
| 2 | `csrc/haraka_portable.c` | VLA `unsigned char t[r]` — MSVC nepodporuje | `#ifdef _MSC_VER` → fixed 256B buffer |
| 3 | `build.rs` | cc-rs nenacházel `stdio.h` / `immintrin.h` | `add_msvc_includes()`: auto-detekce Windows SDK (ucrt/um) + MSVC include cest |
| 4 | `build.rs` | GCC arch flags (`-mpclmul`, `-maes`) předány MSVC | Skip arch flags na MSVC |
| 5 | `build.rs` | `stdc++` linkování na MSVC | Skip `stdc++` na MSVC |
| 6 | `L1/core/Cargo.toml` | `verushash` v `default` features — blokuje Windows build | `default = []`; verushash opt-in; blake3 fallback pro `#[cfg(not(feature = "verushash"))]` |

### Výsledek

```
cargo check -p zion-core   → exit 0  ✅
cargo check -p zion-pool   → exit 0  ✅
cargo check -p zion-miner  → exit 0  ✅
```

> Pro produkční Linux build s VerusHash: `cargo build --features verushash`

---

## [Revenue] Systém implementován v L1/pool

**Architektura:** 50/25/25 model (ZION / Revenue / NCL)

Systém byl plánován pro 2.9.8, ale **kompletní implementace existuje již v 2.9.6/2.9.7 codebase**:

| Modul | Soubor | Stav |
|-------|--------|------|
| Revenue proxy (Stratum klienti pro ext. pooly) | `L1/pool/src/revenue_proxy.rs` (1 869 řádků) | ✅ implementováno |
| Stream scheduler (50/25/25 allocation) | `L1/pool/src/stream_scheduler.rs` | ✅ implementováno |
| Profit switcher (WhatToMine API) | `L1/pool/src/profit_switcher.rs` | ✅ implementováno |
| External pool miner | `L1/pool/src/pool_external_miner.rs` | ✅ implementováno |
| Revenue config | `config/ch3_revenue_settings.json` | ✅ hotovo |
| Docker compose | `docker/docker-compose.revenue.yml` | ✅ hotovo |

### Stratum protokoly podporované revenue proxem

| Protokol | Coiny |
|----------|-------|
| EthStratum | ETC, ERG, RVN, KAS |
| CryptoNoteStratum | XMR, ZEPH (MoneroOcean) |
| ZcashStratum | VRSC/VerusHash |
| StandardStratum | ALPH, FLUX, NEXA |

### 5 Revenue streamů

| # | Stream | Compute | Revenue |
|---|--------|---------|---------|
| 1 | ZION / CosmicHarmony | 50% | ZION block rewards |
| 2 | ETC / Keccak | FREE byproduct | ETC merged mining |
| 3 | NXS / SHA3 | FREE byproduct | Nexus merged mining |
| 4 | GPU: ERG/RVN/KAS **nebo** CPU: XMR/MoneroOcean | 25% | BTC payouty |
| 5 | NCL AI inference | 25% | ZION bonus + AI credits |

### Co zbývá pro produkční aktivaci (2.9.8)

- [ ] Nastavit reálné wallet adresy v `ch3_revenue_settings.json`
- [ ] Testnet 72h run s revenue proxem aktivní
- [ ] MoneroOcean XMR payout ověřit na reálném serveru
- [ ] BuyBack modul aktivovat (převodem BTC výdělků na ZION)
- [ ] Mysterium + NKN nody spustit (pasivní bandwidth revenue)

---

## [Infra] Serversová topologie uzavřena (3 nody)

**Session:** 53 + 54 (24. 2. 2026)

| Server | IP | Arch | Role |
|--------|----|------|------|
| TreeOfLife-Zion (Helsinki) 🇫🇮 | `77.42.31.72` | ARM64 | Seed + Pool + Web + Monitoring |
| Usa 🇺🇸 | `178.156.240.160` | amd64 | Seed node |
| Asia 🌏 | `5.223.43.93` | amd64 | Seed node |

- SeedDE + Usa1: **decommissioned**
- Usa + Asia: opraveny na `zion-core:2.9.6-amd64` (byl `exec format error` s arm64 image)
- Helsinki: nový compose file s čistými SEED_PEERS
- P2P mesh: všechny 3 nody v meshu ✅
- 168h stability window: start **2026-02-24 11:48 UTC**, cíl 2026-03-03

---

## [Desktop Agent] AI Afterburner

**Commit:** `30005af`  
**Session:** 55 (24. 2. 2026)

- `ai/zion_ai_afterburner.py` (813 řádků) — portován z 2.9 history
- GPU power monitoring: WMI util% → TDP odhad → H/W výpočet
- Live: RX 5600 XT = 59.5 MH/s @ 150W = **~397 kH/W**
- Rolling averages 10s / 60s

---

## [Docs] Dokumentace přidána

| Soubor | Obsah |
|--------|-------|
| `asic.md` | CHv3 ASIC resistance — technická spec., pipeline, parametry, benchmark, kompatibilita |
| `REPORT.md` (Session 56) | Benchmark výsledky, L1 kompatibilita matrix, test výsledky |
| `docs/2.9.7/CHANGELOG_2.9.7.md` | Tento soubor |

---

## Kompatibilita L1 (ověřeno)

Všechny komponenty volají `cosmic_harmony_v3_with_height(blob, nonce, height)`:

| Komponenta | Soubor | Stav |
|------------|--------|------|
| Core block validation | `L1/core/src/blockchain/block.rs:99` | ✅ |
| Core mining alias | `L1/core/src/algorithms/cosmic_harmony.rs:24` | ✅ |
| Miner native | `L1/miner/src/miner/native_algos.rs:637` | ✅ |
| Miner GPU thread | `L1/miner/src/miner/mod.rs:910` | ✅ |
| Pool share validator | `L1/pool/src/shares/validator.rs:301` | ✅ |

---

## Git log (relevantní commity)

| Commit | Změna |
|--------|-------|
| `8a2b295` | CHv3 ASIC hardening: fork@100k, scratchpad, dynamic mask, env lockout |
| `c66f9bc` | docs: asic.md — CHv3 ASIC resistance dokumentace |
| `5037e8b` | CHv3: tuning 512 KiB/4 průchody/256 čtení + benchmark |
| `c6189c4` | CHv3: AES-NI Haraka-inspired maska v Cosmic Fusion |
| `55a5b75` | docs: Session 56 — ASIC hardening, L1 kompatibilita, test výsledky |
| `243e4b8` | fix(core): Windows MSVC build pro verushash-native + zion-core |
| `773c931` | fix(p2p): peers_connected leak (ConnectionGuard RAII) + ephemeral port reconnect |

---

## [P2P] Hot-patch: peers_connected leak + ephemeral port bug (2026-03-05)

**Commit:** `773c931`  
**Soubory:** `L1/core/src/p2p/mod.rs`, `L1/core/src/p2p/persistence.rs`

### P2P-BUG-01: peers_connected counter leak

**Problém:** Funkce `handle_peer_connection()` měla 13+ `return Err()` exit cest, které nikdy nesqualy
`peers_connected` counter. Způsobovalo to zdánlivě high peer count (17+ zobrazeno) i když byly sockety zavřeny.

**Oprava:** `ConnectionGuard` RAII struct — při `drop()` automaticky volá `remove_peer()` + `fetch_sub(1)`.

### P2P-BUG-02: Dead reconnect na ephemeral porty

**Problém:** `peers.json` ukládal ephemeral source porty (>32768) inbound spojení. Heartbeat se pak
pokoušel reconnectovat na tyto mrtvé porty (systém je náhodně přiděluje, jsou platné jen po dobu spojení).

**Oprava 1:** `get_best_peers()` filtruje porty ≥32768.  
**Oprava 2:** Přeskočení saved peers jejichž IP je už v `--peers` seed listu (dedup).

### Server Ops (2026-03-05)

- USA + Asia: zastavena XMR těžba (`zion-xmr-x86`), CPU load 47→6 (USA), 7.77→5 (Asia)
- USA + Asia: minery upgradovány na CHv4 (`zion-miner:2.9.7-amd64 --algorithm cosmic_harmony`)
- Helsinki pool: opraveny 3 problémy (xmrig restart loop, stale payout TX, VarDiff oscilace)
