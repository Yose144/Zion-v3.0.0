# AuXpow — Kompletní vývojový plán

> **Crate:** `zion-auxpow` (`AuXpow/`)
> **Verze:** 0.1.0
> **Poslední aktualizace:** 2026-07-11
> **Build status:** `cargo test -p zion-auxpow` — **78 testů PASS** (default + `--features native-hashers`), clippy čisté
> **Default BTC payout wallet:** `bc1q9c06f4wpf638xp2280j07qgdrpz0sdms7peqkh`

---

## 0. Architektura — kde jsme teď

```
┌─────────────────────────────────────────────────────────────────┐
│  ZION Pool Server (V3/L1/pool/src/bin/server.rs)                │
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │  MiningPool  │    │  PPLNS Engine │    │  AuxPowScheduler │  │
│  │  (std::thread)│   │  (pplns.rs)   │    │  (tokio runtime) │  │
│  │              │    │              │    │  ✅ stats + metrics│  │
│  │  PoolMessage │    │              │    │  ✅ profit switch │  │
│  │  ::Job       │    │              │    │  ⚠️ CPU-only mine │  │
│  │  ::Submit    │    │              │    └──────────────────┘  │
│  │  ::Result    │    │              │                          │
│  └──────┬───────┘    └──────────────┘                          │
│         │                                                       │
│    ❌ Neposílá externí joby minerům                             │
│    ❌ Neforwarduje externí share                                │
│    ❌ Neintegruje JobMultiplexer / ShareForwarder               │
└─────────┼───────────────────────────────────────────────────────┘
          │ Stratum (JSON over TCP)
          ▼
┌─────────────────────────────────────────────────────────────────┐
│  ZION Miner (V3/L1/miner/src/parallel.rs)                       │
│                                                                 │
│  hash_candidate(candidate, algorithm) → [u8; 32]               │
│    ├── "deeksha_lite_v1"     → ZION PoW (cosmic-harmony)        │
│    ├── "deeksha_lite_fire"   → ZION PoW (Metal)                 │
│    ├── "cosmic_harmony_v3"   → ZION PoW (full)                  │
│    └── ❌ "blake3" / "kheavyhash" / "autolykos" / ...           │
│                                                                 │
│  GPU backends: OpenCL (ocl), CUDA (cudarc), Metal (metal)      │
│  Native FFI: 8 algoritmů wired v Cargo.toml, ale NEpoužívány   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  AuXpow Crate (samostatný, bez V3 závislostí)                   │
│                                                                 │
│  ✅ AuxPowClient      — Stratum v1 + EthStratum klient          │
│  ✅ JobMultiplexer    — fetch externích jobů                    │
│  ✅ ShareForwarder    — forward share na externí pool           │
│  ✅ AuxPowScheduler   — profit switch + circuit breaker         │
│  ✅ ExternalHashers   — Blake3, kHeavyHash, Autolykos, KawPow,  │
│                         Ethash (pure-Rust + C FFI)              │
│  ✅ NativeFFI         — C hashers (feature: native-hashers)     │
│  ✅ MinerHarness      — CPU scan pro všechny algoritmy          │
│  ✅ DualStratumMiner  — nonce split ZION/externí                │
│  ✅ TrueAuxPoW        — AuxPoW Merkle root + validace           │
│  ✅ ParentChains      — DCR/ALPH header parsing                 │
│  ⚠️ GpuMiner          — OpenCL skeleton (kernel sources hotové) │
│  ✅ Types             — ExternalCoin, Config, SplitConfig       │
│                                                                 │
│  csrc/ — C algoritmy zkopírované z V3/L1/native-ffi/csrc/       │
│  csrc/opencl/ — OpenCL kernely (blake3, kheavyhash)             │
│  build.rs — cc kompilace C zdrojů (feature: native-hashers)     │
└─────────────────────────────────────────────────────────────────┘
```

### Co funguje
- AuXpow crate je self-contained, 78 testů PASS, clippy čistý
- AuxPowScheduler běží v pool serveru (stats + metrics endpoint)
- Stratum klient umí connect/auth/notify/submit pro KAS, ALPH, DCR, ERG, RVN, ETC
- Mock round-trip testy pro KAS i ALPH
- C FFI hashery kompilují s `native-hashers` feature
- OpenCL kernel zdrojáky existují v `csrc/opencl/`

### Co nefunguje / chybí
- Pool server **neposílá externí joby** minerům (jen ZION joby)
- Pool server **neforwarduje** externí share (jen ZION share)
- Miner **neumí** hashovat s externími algoritmy (jen ZION PoW)
- GPU miner je **skeleton** — OpenCL API není napojené
- Live E2E submit accept **nelze ověřit** CPU (pool difficulty je příliš vysoká)
- KawPow/Ethash pure-Rust fallback **není validní** (potřebuje DAG)
- RandomX **není implementovaný**

---

## 1. Fáze vývoje

### Fáze 1 — V3 Pool Integration (B2b Pool-side Multiplexing) ★ NEJVYŠŠÍ PRIORITA

**Cíl:** ZION pool server posílá minerům externí joby (KAS/ALPH) a forwarduje nalezené share na externí pool.

**Prerekvizit:** AuXpow crate je hotový a otestovaný ✅

#### 1.1 Pool server: JobMultiplexer integrace

**Soubor:** `V3/L1/pool/src/bin/server.rs`

```rust
// V server.rs, vedle AuxPowScheduler:
use zion_auxpow::{JobMultiplexer, ShareForwarder, ExternalCoin, JobPackage};

struct PoolState {
    // ... existující pole ...
    /// Multiplexer pro externí joby (B2b)
    job_multiplexer: Arc<Mutex<Option<JobMultiplexer>>>,
    /// Forwarder pro externí share
    share_forwarder: Arc<Mutex<Option<ShareForwarder>>>,
    /// Split konfigurace (ZION vs externí)
    split_config: SplitConfig,
}
```

**Flow:**
1. Pool přijme `mining.notify` od ZION node → normální ZION job
2. `JobMultiplexer` přijme `mining.notify` od externího poolu → `JobPackage`
3. Pool rozhodne podle `SplitConfig` (např. 70/30):
   - 70 % jobů → `PoolMessage::Job { algorithm: "deeksha_lite_v1", ... }`
   - 30 % jobů → `PoolMessage::Job { algorithm: "blake3", header_hex: external.header_hex, ... }`
4. Miner dostane job, hashuje, pošle `PoolMessage::Submit`

**Úkoly:**
- [ ] Přidat `JobMultiplexer` do pool serveru (vedle `AuxPowScheduler`)
- [ ] Implementovat split logiku (round-robin nebo weighted random)
- [ ] Převést `JobPackage` na `PoolMessage::Job` s správným `algorithm` polem
- [ ] Přidat `SplitConfig` do pool configu (env: `ZION_AUXPOW_SPLIT_ZION=70`, `ZION_AUXPOW_SPLIT_EXT=30`)
- [ ] Test: pool server s mock externím poolem → miner dostane externí job

#### 1.2 Pool server: ShareForwarder integrace

**Soubor:** `V3/L1/pool/src/bin/server.rs`

**Flow:**
1. Miner pošle `PoolMessage::Submit { algorithm: "blake3", hash_hex: "...", nonce: 42, ... }`
2. Pool zkontroluje `algorithm`:
   - `"deeksha_lite_v1"` → normální ZION validace
   - `"blake3"` / `"kheavyhash"` / `"autolykos"` → `ShareForwarder::try_forward()`
3. `ShareForwarder` ověří hash proti externímu targetu
4. Pokud splní → `submit_share()` na externí pool → BTC revenue
5. Pool zaznamená share do PPLNS (pro distribuci revenue minerům)

**Úkoly:**
- [ ] Detekce externího algoritmu v `PoolMessage::Submit` handleru
- [ ] Volání `ShareForwarder::try_forward()` pro externí share
- [ ] PPLNS zápis externího share (revenue_source = External)
- [ ] Test: mock externí pool → submit → accept → PPLNS update

#### 1.3 Pool config rozšíření

**Soubor:** `V3/L1/pool/src/bin/server.rs` (config sekce)

```rust
struct AuxPowIntegrationConfig {
    enabled: bool,                          // ZION_AUXPOW_ENABLED
    split_zion_weight: u32,                 // ZION_AUXPOW_SPLIT_ZION (default 70)
    split_external_weight: u32,             // ZION_AUXPOW_SPLIT_EXT (default 30)
    force_coin: Option<ExternalCoin>,       // ZION_AUXPOW_COIN
    payout_wallet: String,                  // ZION_AUXPOW_WALLET
    worker_name: String,                    // ZION_AUXPOW_WORKER
    pool_preference: PoolPreference,        // ZION_AUXPOW_POOL_PREFERENCE
    region: String,                         // ZION_AUXPOW_REGION
}
```

**Úkoly:**
- [ ] Parsování configu z env variables
- [ ] Validace (enabled + wallet required)
- [ ] Default hodnoty
- [ ] Test: config parsing

#### 1.4 Miner: externí algoritmy v `hash_candidate`

**Soubor:** `V3/L1/miner/src/parallel.rs`

```rust
pub fn hash_candidate(candidate: &BlockCandidate, algorithm: &str) -> [u8; 32] {
    match algorithm {
        "deeksha_lite_v1" => deeksha_lite::deeksha_lite(&candidate.header.to_bytes(), candidate.nonce),
        "deeksha_lite_fire" => deeksha_lite_fire::deeksha_lite_fire(&candidate.header.to_bytes(), candidate.nonce),
        "cosmic_harmony_v3" => cosmic_harmony_with_height(&candidate.header.to_bytes(), candidate.nonce, candidate.height),
        // ── Externí algoritmy (AuXpow) ──
        "blake3" => zion_auxpow::hash_blake3(&candidate.header.to_bytes(), 0, candidate.nonce),
        "kheavyhash" => zion_auxpow::hash_kheavyhash(&candidate.header.to_bytes(), 0, candidate.nonce),
        "autolykos" => zion_auxpow::hash_autolykos(&candidate.header.to_bytes(), candidate.nonce, candidate.height as u32),
        "kawpow" => zion_auxpow::hash_kawpow(&candidate.header.to_bytes()[..32].try_into().unwrap(), candidate.nonce, candidate.height as u32).1,
        "ethash" => zion_auxpow::hash_ethash(&candidate.header.to_bytes(), candidate.nonce, candidate.height as u32),
        other => panic!("unsupported algorithm: {other}"),
    }
}
```

**Úkoly:**
- [ ] Přidat `zion-auxpow` dependency do `V3/L1/miner/Cargo.toml`
- [ ] Rozšířit `hash_candidate` o externí algoritmy
- [ ] Test: miner s mock pool serverem → externí job → hash → submit
- [ ] GPU backend: přidat externí algoritmy do `gpu_backend.rs`

---

### Fáze 2 — GPU Mining Backend ★ VYSOKÁ PRIORITA

**Cíl:** GPU miner umí hashovat Blake3 (ALPH) a kHeavyHash (KAS) s vysokým hashrate, aby mohl najít share při reálné pool difficulty.

#### 2.1 OpenCL backend pro Blake3 (ALPH)

**Soubory:**
- `AuXpow/csrc/opencl/blake3_kernel.cl` — kernel zdroj ✅ hotový
- `AuXpow/src/gpu_miner.rs` — Rust API skeleton ⚠️ potřeba doplnit

**Úkoly:**
- [ ] Přidat `ocl` crate do `AuXpow/Cargo.toml` (feature: `gpu-opencl`)
- [ ] Implementovat `GpuMiner::new()` — init OpenCL context + compile kernel
- [ ] Implementovat `GpuMiner::mine_blake3_alph()` — buffer creation + NDRange + read results
- [ ] Benchmark: změřit hashrate na referenční GPU (target: >100 MH/s)
- [ ] Test: GPU miner najde share s easy target (mock pool)

#### 2.2 OpenCL backend pro kHeavyHash (KAS)

**Soubory:**
- `AuXpow/csrc/opencl/kheavyhash_kernel.cl` — kernel zdroj ✅ hotový (simplified)
- `AuXpow/src/gpu_miner.rs` — Rust API

**Úkoly:**
- [ ] Doplnit kHeavyHash kernel o správnou Kaspa matici (64×64)
- [ ] Implementovat `GpuMiner::mine_kheavyhash()`
- [ ] Benchmark: změřit hashrate (target: >1 GH/s na GPU)
- [ ] Test: GPU miner najde KAS share s easy target

#### 2.3 GPU miner integrace do V3 miner

**Soubor:** `V3/L1/miner/src/gpu_backend.rs`

**Úkoly:**
- [ ] Přidat externí algoritmy do GPU backendu
- [ ] Detekce algoritmu z `PoolMessage::Job.algorithm`
- [ ] Fallback na CPU pokud GPU nedostupný
- [ ] Test: GPU miner s mock pool serverem

#### 2.4 CUDA backend (volitelné)

**Úkoly:**
- [ ] Přepsat Blake3 kernel do CUDA (`blake3_kernel.cu`)
- [ ] Přepsat kHeavyHash kernel do CUDA
- [ ] Integrace přes `cudarc` crate
- [ ] Benchmark vs OpenCL

---

### Fáze 3 — Live E2E Validace ★ VYSOKÁ PRIORITA

**Cíl:** Ověřit, že share submission je skutečně přijata externím poolem.

#### 3.1 GPU E2E test — ALPH WoolyPooly

**Soubor:** `AuXpow/examples/e2e_pool_test.rs`

**Úkoly:**
- [ ] Přidat GPU miner do E2E testu (feature-gated)
- [ ] Spustit GPU miner proti `pool.woolypooly.com:3106`
- [ ] Ověřit: connect → auth → notify → GPU mine → submit → **ACCEPT**
- [ ] Pokud reject: debug pomocí packet capture (Wireshark)
- [ ] Dokumentovat výsledek

#### 3.2 GPU E2E test — KAS 2miners

**Úkoly:**
- [ ] Spustit GPU miner proti `kas.2miners.com:2020`
- [ ] Ověřit: connect → auth → notify → GPU mine → submit → **ACCEPT**
- [ ] Pokud reject: packet capture analýza
- [ ] Dokumentovat výsledek

#### 3.3 Low-difficulty test pool

**Úkoly:**
- [ ] Najít nebo zřídit test pool s nízkou difficultou (share target ~2^-16)
- [ ] Testovat CPU miner proti test poolu
- [ ] Ověřit submit accept bez GPU

#### 3.4 Packet capture validace

**Úkoly:**
- [ ] Zachytit komunikaci fungujícího mineru (np. lolMiner, T-Rex) proti WoolyPooly
- [ ] Porovnat packet formát s AuXpow submit formátem
- [ ] Opravit případné rozdíly

---

### Fáze 4 — Další algoritmy ★ STŘEDNÍ PRIORITA

#### 4.1 Autolykos (ERG) — plná implementace

**Stav:** Pure-Rust fallback (Blake3 placeholder) + C FFI deklarace

**Úkoly:**
- [ ] Ověřit C implementaci `csrc/autolykos_native.c` proti ERG test vektorům
- [ ] Přidat `blake2b` crate do dependencies (pro pure-Rust fallback)
- [ ] Implementovat správný pure-Rust autolykos (ne Blake3 placeholder)
- [ ] E2E test: ERG pool (2miners, Herominers) — connect/auth/notify
- [ ] GPU kernel: Autolykos OpenCL (volitelné)

#### 4.2 KawPow (RVN, CLORE) — plná implementace

**Stav:** C FFI deklarace + pure-Rust fallback (Blake3 placeholder)

**Úkoly:**
- [ ] Ověřit C implementaci `csrc/kawpow_native.c` proti RVN test vektorům
- [ ] Implementovat DAG generaci (nebo použít `ethash` crate)
- [ ] E2E test: RVN pool (2miners, WoolyPooly) — connect/auth/notify
- [ ] GPU kernel: KawPow OpenCL (ProgPow)

#### 4.3 Ethash/EtcHash (ETC) — plná implementace

**Stav:** C FFI deklarace + pure-Rust fallback (Blake3 placeholder)

**Úkoly:**
- [ ] Ověřit C implementaci `csrc/etchash_native.c` proti ETC test vektorům
- [ ] Implementovat DAG generaci
- [ ] E2E test: ETC pool (2miners, Ethermine) — connect/auth/notify
- [ ] GPU kernel: Ethash OpenCL

#### 4.4 RandomX (XMR) — nová implementace

**Stav:** Není implementováno (scheduler fallback na Blake3)

**Úkoly:**
- [ ] Integrovat `randomx` crate (nebo C++ Tevador/randomx přes FFI)
- [ ] Implementovat `hash_randomx(header, nonce)` v `external_hashers.rs`
- [ ] Přidat RandomX do `ExternalAlgorithm` match armů
- [ ] E2E test: XMR pool (2miners, MoneroOcean) — connect/auth/notify

#### 4.5 ZelHash (FLUX) — nová implementace

**Stav:** Není implementováno

**Úkoly:**
- [ ] Zjistit ZelHash specifikaci (Equihash 125,4 varianta)
- [ ] Implementovat nebo integrovat přes FFI
- [ ] E2E test: FLUX pool (2miners, MinerPool)

---

### Fáze 5 — True AuxPoW (C — Merge Mining) ★ NÍZKÁ PRIORITA (dlouhodobá)

**Cíl:** ZION consensus fork — jeden hash platí pro ZION i parent chain (DCR/ALPH).

#### 5.1 Consensus příprava

**Úkoly:**
- [ ] Definovat `AUXPOW_FORK_HEIGHT` v `V3/L1/core/`
- [ ] Rozšířit ZION block header o `parent_hash` pole
- [ ] Implementovat `validate_auxpow()` v consensus validaci
- [ ] Coinbase commitment: `AUXPOW_COINBASE_MAGIC` v coinbase TX
- [ ] Test: forge AuxPoW blok na testnetu

#### 5.2 Parent chain integrace

**Úkoly:**
- [ ] DCR: plné parsování 180B headeru (nyní skeleton)
- [ ] ALPH: plné parsování headeru (nyní stub — `raw: Vec<u8>`)
- [ ] Parent chain RPC klient (fetch latest parent header)
- [ ] Parent chain submit klient (submit parent block)

#### 5.3 Pool server: True AuxPoW job issuance

**Úkoly:**
- [ ] Pool fetchne parent header z parent chain RPC
- [ ] Pool vloží parent hash do ZION block template
- [ ] Miner hashuje ZION header (obsahuje parent hash)
- [ ] Pool zkontroluje: splňuje ZION target? → ZION block
- [ ] Pool zkontroluje: splňuje parent target? → parent block submit

---

### Fáze 6 — Produkční tvrdění ★ NÍZKÁ PRIORITA (po Fázi 1-3)

#### 6.1 Monitoring a alerting

**Úkoly:**
- [ ] Prometheus metrics pro AuXpow (shares, revenue, pool status)
- [ ] Grafana dashboard pro AuXpow
- [ ] Alerting: circuit breaker open, pool disconnect, share reject rate

#### 6.2 Bezpečnost

**Úkoly:**
- [ ] Audit: žádné private keys v AuXpow
- [ ] Audit: externí pool spojení TLS ( pokud podporováno)
- [ ] Rate limiting na share submission (anti-spam)
- [ ] Share validation: nonce range check, job ID check

#### 6.3 Performance

**Úkoly:**
- [ ] Profiling: pool server s 1000+ minerů + AuXpow
- [ ] Optimalizace: zero-copy header bytes
- [ ] Connection pooling pro externí Stratum klienty
- [ ] Batch share submission

---

## 2. Algoritmus matice

| Algoritmus | Coins | Pure Rust | C FFI | GPU OpenCL | GPU CUDA | E2E | Priorita |
|-----------|-------|-----------|-------|------------|----------|-----|----------|
| Blake3 | DCR, ALPH | ✅ Complete | ✅ Complete | ⚠️ Skeleton | ❌ | ⚠️ CPU nelze | Fáze 2 |
| kHeavyHash | KAS | ✅ Complete | ✅ Complete | ⚠️ Skeleton | ❌ | ⚠️ CPU nelze | Fáze 2 |
| Autolykos | ERG | ⚠️ Placeholder | ✅ Complete | ❌ | ❌ | ❌ TODO | Fáze 4 |
| KawPow | RVN, CLORE | ⚠️ Placeholder | ✅ Complete | ❌ | ❌ | ❌ TODO | Fáze 4 |
| Ethash | ETC | ⚠️ Placeholder | ✅ Complete | ❌ | ❌ | ❌ TODO | Fáze 4 |
| RandomX | XMR | ❌ | ⚠️ Stub | ❌ | ❌ | ❌ TODO | Fáze 4 |
| VerusHash | VRSC | ✅ Complete (ZcashStratum) | ✅ Native C++ (Haraka+CLHash) | ❌ | ❌ | ❌ TODO | Fáze 4 |
| ZelHash | FLUX | ❌ | ❌ | ❌ | ❌ | ❌ TODO | Fáze 4 |
| Deeksha Lite | ZION | ✅ (cosmic-harmony) | ✅ Complete | ✅ (ocl) | ✅ (cudarc) | ✅ Produkce | — |

## 3. Coin matice

| Coin | Ticker | Algoritmus | Protokol | BTC Payout | Pool | E2E Stav |
|------|--------|-----------|----------|-----------|------|----------|
| Kaspa | KAS | kheavyhash | Stratum | ✅ (zpool) | 2miners, Kryptex, HeroMiners | connect ✅, submit ⚠️ |
| Alephium | ALPH | blake3 (double) | Stratum | ❌ (vlastní) | WoolyPooly, HeroMiners | connect ✅, submit ⚠️ |
| Decred | DCR | blake3 | Stratum | ✅ (zpool) | pooly offline ❌ | ❌ |
| Ergo | ERG | autolykos | EthStratum | TBD | 2miners, HeroMiners | ❌ TODO |
| Ravencoin | RVN | kawpow | EthStratum | TBD | 2miners, WoolyPooly | ❌ TODO |
| Ethereum Classic | ETC | ethash | EthStratum | TBD | 2miners, Ethermine | ❌ TODO |
| Clore.ai | CLORE | kawpow | EthStratum | TBD | WoolyPooly | ❌ TODO |
| Monero | XMR | randomx | Stratum | TBD | 2miners, MoneroOcean | ❌ TODO |
| Verus | VRSC | verushash v2.2 | ZcashStratum | ❌ (vlastní) | LuckPool | protocol ✅, live E2E TODO |
| Flux | FLUX | zelhash | Stratum | TBD | 2miners, MinerPool | ❌ TODO |

## 4. V3 Pool Integration body

### 4.1 Existující integrace (hotové)

| Komponenta | Soubor | Stav |
|-----------|--------|------|
| `AuxPowScheduler` | `V3/L1/pool/src/bin/server.rs:465` | ✅ Stats + metrics |
| `AuxPowStats` v `/metrics` endpoint | `server.rs:2816` | ✅ JSON output |
| `zion-auxpow` dependency | `V3/L1/pool/Cargo.toml:31` | ✅ |

### 4.2 Chybějící integrace (TODO)

| Komponenta | Soubor | Stav | Fáze |
|-----------|--------|------|------|
| `JobMultiplexer` v pool serveru | `server.rs` | ❌ | 1.1 |
| `ShareForwarder` v pool serveru | `server.rs` | ❌ | 1.2 |
| Split logika (ZION vs externí) | `server.rs` | ❌ | 1.1 |
| Externí algoritmy v mineru | `V3/L1/miner/src/parallel.rs` | ❌ | 1.4 |
| `AuxPowIntegrationConfig` | `server.rs` | ❌ | 1.3 |
| GPU externí algoritmy v mineru | `V3/L1/miner/src/gpu_backend.rs` | ❌ | 2.3 |

### 4.3 PoolMessage protokol

Existující `PoolMessage::Job` už má `algorithm: String` pole — **žádná změna protokolu není potřeba**:

```rust
PoolMessage::Job {
    job_id: u64,
    algorithm: String,       // ← "blake3", "kheavyhash", ...
    start_nonce: u64,
    nonce_count: u64,
    target_hex: String,      // ← externí pool target
    header_hex: String,      // ← externí pool header blob
    height: u64,
}
```

`PoolMessage::Submit` už má `hash_hex` a `nonce` — **žádná změna není potřeba**:

```rust
PoolMessage::Submit {
    job_id: u64,
    miner_id: String,
    worker_name: String,
    nonce: u64,
    hash_hex: String,        // ← hash od mineru
    ...
}
```

Pool server jen potřebuje:
1. Rozpoznat `algorithm != "deeksha_lite_v1"` → externí share
2. Zavolat `ShareForwarder::try_forward()` místo ZION node submit

---

## 5. V3 Native FFI — existující infrastructure

V3/L1/native-ffi už má **8 algoritmů** s plným FFI:

| Algoritmus | C Source | Rust FFI | Stav |
|-----------|----------|----------|------|
| Etchash | `csrc/etchash/etchash_native.c` (398 lines) | ✅ | ✅ Full |
| KawPow | `csrc/kawpow/kawpow_native.c` (302 lines) | ✅ | ✅ Full |
| Autolykos | `csrc/autolykos/autolykos_native.c` (383 lines) | ✅ | ✅ Full |
| kHeavyHash | `csrc/kheavyhash/kheavyhash_native.c` (263 lines) | ✅ | ✅ Full |
| Blake3 | `csrc/blake3/blake3_native.c` (426 lines) | ✅ | ✅ Full |
| Cosmic Harmony v3 | `csrc/cosmic_harmony/...` (733 lines) | ✅ | ✅ Full |
| VerusHash | `csrc/verushash/...` (131 lines) + `V3/L1/native-ffi/csrc/verushash/real/` (11744+ lines) | ✅ | ✅ **Native C++ production** (Haraka+CLHash z 2.9.9), build passing, `native-verushash` feature v AuXpow |
| RandomX | `csrc/randomx/...` (129 lines) | ✅ | ⚠️ Stub |

**Miner Cargo.toml** už má features: `native-etchash`, `native-kawpow`, `native-autolykos`, `native-kheavyhash`, `native-blake3-algo`, `native-cosmic-harmony`, `native-verushash`, `native-randomx`, `native-all`

**Ale:** Miner **nepoužívá** native FFI v `parallel.rs` — `hash_candidate()` volá jen Rust `zion-cosmic-harmony` funkce.

**Akce:** AuXpow `csrc/` je nezávislá kopie — pro integraci do V3 mineru použít buď:
- **Option A:** AuXpow `native-hashers` feature (vlastní C kompilace)
- **Option B:** V3 `zion-native-ffi` crate (sdílená C kompilace, už wired v Cargo.toml)

Doporučeno: **Option B** pro V3 miner, **Option A** pro standalone AuXpow.

---

## 6. GPU Mining — existující infrastructure

V3 miner už má GPU backends:

| Backend | Crate | Algoritmy | Stav |
|---------|-------|-----------|------|
| OpenCL | `ocl` | Ekam Deeksha + DCR Blake3 | ✅ Produkce |
| CUDA | `cudarc` | NVIDIA | ✅ Produkce |
| Metal | `metal` | Apple Silicon | ✅ Produkce |

**AuXpow GPU:**
- `csrc/opencl/blake3_kernel.cl` — Blake3/ALPH kernel ✅
- `csrc/opencl/kheavyhash_kernel.cl` — kHeavyHash/KAS kernel ✅
- `src/gpu_miner.rs` — Rust API ⚠️ skeleton

**Akce:**
1. Přidat `ocl` crate do AuXpow Cargo.toml (feature: `gpu-opencl`)
2. Implementovat `GpuMiner::new()` a `mine_blake3_alph()` v `gpu_miner.rs`
3. Pro V3 miner: rozšířit `gpu_backend.rs` o externí algoritmy

---

## 7. Testování

### 7.1 Unit testy (aktuální: 78 PASS)

```bash
cargo test -p zion-auxpow
cargo test -p zion-auxpow --features native-hashers
cargo clippy -p zion-auxpow --all-targets -- -D warnings
cargo clippy -p zion-auxpow --all-targets --features native-hashers -- -D warnings
```

### 7.2 E2E testy

```bash
# KAS — 2miners
AUXPOW_E2E_RUN=1 AUXPOW_E2E_COIN=kas \
AUXPOW_E2E_POOL=kas.2miners.com:2020 \
AUXPOW_E2E_MINE_SECS=10 AUXPOW_E2E_SUBMIT=1 \
cargo run -p zion-auxpow --example e2e_pool_test --release

# ALPH — WoolyPooly
AUXPOW_E2E_RUN=1 AUXPOW_E2E_COIN=alph \
AUXPOW_E2E_POOL=pool.woolypooly.com:3106 \
AUXPOW_E2E_MINE_SECS=10 AUXPOW_E2E_SUBMIT=1 \
cargo run -p zion-auxpow --example e2e_pool_test --release

# GPU E2E (po Fázi 2)
AUXPOW_E2E_RUN=1 AUXPOW_E2E_COIN=alph \
AUXPOW_E2E_POOL=pool.woolypooly.com:3106 \
AUXPOW_E2E_GPU=1 AUXPOW_E2E_MINE_SECS=60 \
cargo run -p zion-auxpow --example e2e_pool_test --release --features gpu-opencl
```

### 7.3 V3 Pool integration testy (po Fázi 1)

```bash
# Pool server s AuXpow integration
ZION_AUXPOW_ENABLED=1 \
ZION_AUXPOW_COIN=kas \
ZION_AUXPOW_SPLIT_ZION=70 \
ZION_AUXPOW_SPLIT_EXT=30 \
ZION_AUXPOW_WALLET=bc1q9c06f4wpf638xp2280j07qgdrpz0sdms7peqkh \
cargo run -p zion-pool --bin server --release
```

### 7.4 Parity testy (C vs Rust)

**Úkoly:**
- [ ] Blake3: C `blake3_hash()` vs Rust `blake3::hash()` — 1000 random inputs
- [ ] kHeavyHash: C `kheavyhash_hash()` vs Rust `hash_kheavyhash()` — 1000 random inputs
- [ ] Autolykos: C `autolykos_hash()` vs Rust `hash_autolykos()` — 100 random inputs
- [ ] KawPow: C `kawpow_hash()` vs reference (T-Rex output)
- [ ] Ethash: C `ethash_hash()` vs reference (ethash crate)

---

## 8. Milestones a časový plán

### Milestone 1: V3 Pool Integration (Fáze 1)
**Cíl:** Pool server posílá externí joby a forwarduje share.

| Úkol | Priorita | Závislost |
|------|----------|-----------|
| 1.1 JobMultiplexer v pool serveru | Kritický | — |
| 1.2 ShareForwarder v pool serveru | Kritický | 1.1 |
| 1.3 Pool config rozšíření | Vysoký | — |
| 1.4 Miner: externí algoritmy | Kritický | — |
| 1.5 Integration test (mock pool) | Vysoký | 1.1-1.4 |

### Milestone 2: GPU Mining (Fáze 2)
**Cíl:** GPU miner najde share při reálné pool difficulty.

| Úkol | Priorita | Závislost |
|------|----------|-----------|
| 2.1 OpenCL Blake3 (ALPH) | Kritický | — |
| 2.2 OpenCL kHeavyHash (KAS) | Vysoký | — |
| 2.3 GPU miner v V3 | Vysoký | 2.1-2.2 |
| 2.4 CUDA backend | Nízký | 2.1-2.2 |

### Milestone 3: Live E2E Validace (Fáze 3)
**Cíl:** Share accept od reálného poolu.

| Úkol | Priorita | Závislost |
|------|----------|-----------|
| 3.1 GPU E2E ALPH WoolyPooly | Kritický | M2 |
| 3.2 GPU E2E KAS 2miners | Vysoký | M2 |
| 3.3 Low-difficulty test pool | Střední | — |
| 3.4 Packet capture validace | Střední | 3.1-3.2 |

### Milestone 4: Další algoritmy (Fáze 4)
**Cíl:** ERG, RVN, ETC, XMR, FLUX podpora.

| Úkol | Priorita | Závislost |
|------|----------|-----------|
| 4.1 Autolykos (ERG) full | Střední | M1 |
| 4.2 KawPow (RVN) full | Střední | M1 |
| 4.3 Ethash (ETC) full | Střední | M1 |
| 4.4 RandomX (XMR) | Nízký | M1 |
| 4.5 ZelHash (FLUX) | Nízký | M1 |

### Milestone 5: True AuxPoW (Fáze 5)
**Cíl:** Consensus fork pro merge mining.

| Úkol | Priorita | Závislost |
|------|----------|-----------|
| 5.1 Consensus příprava | Nízký | M1-M3 |
| 5.2 Parent chain integrace | Nízký | 5.1 |
| 5.3 Pool: True AuxPoW jobs | Nízký | 5.1-5.2 |

### Milestone 6: Produkční tvrdění (Fáze 6)
**Cíl:** Produkční kvalita, monitoring, bezpečnost.

| Úkol | Priorita | Závislost |
|------|----------|-----------|
| 6.1 Monitoring + alerting | Střední | M1-M3 |
| 6.2 Bezpečnost audit | Střední | M1-M3 |
| 6.3 Performance optimalizace | Nízký | M1-M3 |

---

## 9. Technický dluh a známé problémy

### 9.1 Pure-Rust fallback hashe (nevalidní)

| Algoritmus | Problém | Řešení |
|-----------|---------|--------|
| Autolykos | Používá Blake3 místo Blake2b | Přidat `blake2b` crate nebo použít `native-hashers` |
| KawPow | Používá Blake3, chybí DAG | Použít `native-hashers` s C DAG |
| Ethash | Používá Blake3, chybí DAG | Použít `native-hashers` s C DAG |
| RandomX | Není implementováno | Integrovat Tevador/randomx |

### 9.2 OpenCL kernely (simplified)

| Kernel | Problém | Řešení |
|--------|---------|--------|
| blake3_kernel.cl | Zpracovává jen 1 blok (64B), ALPH header je ~302B | Víceblokový Blake3 s chaining |
| kheavyhash_kernel.cl | Používá identity matici místo Kaspa matice | Generovat správnou 64×64 matici |

### 9.3 Pool integration

| Problém | Řešení |
|---------|--------|
| Pool server používá `std::thread`, AuXpow používá `tokio` | Už vyřešeno: `AuxPowScheduler::spawn_on(&runtime)` |
| `PoolMessage::Job` nemá `extranonce1` pole | Přidat do `PoolMessage::Job` nebo použít `header_hex` |
| Miner neumí externí algoritmy | Přidat do `hash_candidate()` (Fáze 1.4) |

### 9.4 ALPH header layout

`AlphHeader` v `parent_chains.rs` je stub (`raw: Vec<u8>`) — přesný layout ALPH headeru není zdokumentován. Potřebuje:
- [ ] Získat ALPH header specifikaci z oficiální dokumentace
- [ ] Implementovat plné parsování
- [ ] Test s reálným ALPH headerem

---

## 10. Konfigurace (env variables)

### AuXpow (existující)

| Variable | Default | Popis |
|----------|---------|-------|
| `ZION_AUXPOW_ENABLED` | `0` | Povolit AuXpow scheduler |
| `ZION_AUXPOW_COIN` | auto | Vynucený coin (kas, alph, dcr, ...) |
| `ZION_AUXPOW_ALLOCATION_PCT` | `25.0` | % hashrate pro externí |
| `ZION_AUXPOW_POOL_PREFERENCE` | `auto` | zpool, herominers, woolypooly, 2miners |
| `ZION_AUXPOW_REGION` | `eu` | Region (eu, us, asia) |
| `ZION_AUXPOW_CHECK_INTERVAL` | `60` | Profit check interval (secs) |
| `ZION_AUXPOW_HYSTERESIS_PCT` | `5.0` | Hysteresis pro coin switch |
| `ZION_AUXPOW_WALLET` | BTC default | Payout wallet |
| `ZION_AUXPOW_WORKER` | `zion-auxpow` | Worker name |
| `ZION_AUXPOW_CB_THRESHOLD` | `5` | Circuit breaker threshold |
| `ZION_AUXPOW_CB_RESET_SECS` | `300` | Circuit breaker reset |

### AuXpow (nové — Fáze 1)

| Variable | Default | Popis |
|----------|---------|-------|
| `ZION_AUXPOW_SPLIT_ZION` | `70` | Váha ZION jobů |
| `ZION_AUXPOW_SPLIT_EXT` | `30` | Váha externích jobů |
| `ZION_AUXPOW_FORWARD_SHARES` | `1` | Forward externí share na pool |

### E2E test

| Variable | Default | Popis |
|----------|---------|-------|
| `AUXPOW_E2E_RUN` | `0` | Povinné — bez toho test neskočí |
| `AUXPOW_E2E_COIN` | `dcr` | Coin |
| `AUXPOW_E2E_POOL` | auto | Pool host:port override |
| `AUXPOW_E2E_WALLET` | auto | Payout wallet |
| `AUXPOW_E2E_MINE_SECS` | `0` | Sekundy CPU minování |
| `AUXPOW_E2E_SUBMIT` | `0` | Odeslat share |
| `AUXPOW_E2E_JOB_TIMEOUT_MS` | `30000` | Timeout na první job |
| `AUXPOW_E2E_GPU` | `0` | Použít GPU miner (po Fázi 2) |

---

## 11. Soubory a struktura

```
AuXpow/
├── Cargo.toml              # Features: native-hashers, gpu-opencl
├── build.rs                # cc kompilace C zdrojů
├── REVENUE_B2B_AND_TRUE_AUXPOW_DESIGN.md  # Design doc
├── AuXpowDev.md            # Tento soubor — vývojový plán
├── csrc/                   # C algoritmy (kopie z V3/L1/native-ffi/csrc/)
│   ├── blake3_native.c
│   ├── kheavyhash_native.c
│   ├── autolykos_native.c
│   ├── kawpow_native.c
│   ├── etchash_native.c
│   ├── randomx_stub.c
│   └── opencl/
│       ├── blake3_kernel.cl       # OpenCL kernel pro ALPH
│       └── kheavyhash_kernel.cl   # OpenCL kernel pro KAS
├── examples/
│   └── e2e_pool_test.rs    # E2E test proti živému poolu
└── src/
    ├── lib.rs              # Veřejné exports
    ├── types.rs            # ExternalCoin, Config, SplitConfig, JobPackage
    ├── auxpow_client.rs    # Stratum v1 + EthStratum klient
    ├── auxpow_scheduler.rs # Profit switch + circuit breaker
    ├── multiplexer.rs      # JobMultiplexer — fetch externích jobů
    ├── share_forwarder.rs  # ShareForwarder — forward share
    ├── external_hashers.rs # Blake3, kHeavyHash, Autolykos, KawPow, Ethash
    ├── native_ffi.rs       # C FFI wrappers (feature: native-hashers)
    ├── gpu_miner.rs        # OpenCL GPU miner (feature: gpu-opencl)
    ├── miner_harness.rs    # CPU scan harness
    ├── dual_stratum.rs     # Dual-stratum miner (nonce split)
    ├── true_auxpow.rs      # True AuxPoW validace
    └── parent_chains.rs    # DCR/ALPH header parsing
```

### V3 integrační body

```
V3/L1/pool/
├── Cargo.toml              # zion-auxpow dependency ✅
└── src/
    ├── lib.rs              # PoolMessage (Job, Submit, Result)
    ├── bin/server.rs       # Pool server — AuxPowScheduler ✅, JobMultiplexer ❌
    ├── pplns.rs            # PPLNS engine
    ├── ncl_gateway.rs      # NCL gateway
    └── revenue_proxy.rs    # Revenue proxy

V3/L1/miner/
├── Cargo.toml              # native-* features ✅, zion-auxpow ❌
└── src/
    ├── parallel.rs         # hash_candidate() — ZION only ❌
    ├── gpu_backend.rs      # GPU backends — ZION only ❌
    ├── main.rs             # Miner entry point
    └── ...

V3/L1/native-ffi/
├── Cargo.toml              # 8 native features
├── build.rs                # cc kompilace
└── src/lib.rs              # FFI bindings pro 8 algoritmů
```

---

## 12. Rizika a mitigace

| Riziko | Pravděpodobnost | Dopad | Mitigace |
|--------|----------------|-------|----------|
| Pool difficulty příliš vysoká pro CPU/GPU | Vysoká | Nelze ověřit submit | GPU miner (Fáze 2) nebo low-diff test pool |
| Externí pool změní protokol | Střední | Submit přestane fungovat | Circuit breaker + monitoring |
| C FFI nesouhlasí s Rust implementací | Střední | Špatné hashe | Parity testy (Fáze 6) |
| OpenCL kernel nesouhlasí s referencí | Vysoká | Špatné hashe | Known-vector testy před E2E |
| Pool server performance degradace | Nízká | Pomalý share forwarding | Profiling + async forward |
| Konsensus fork pro True AuxPoW | Nízká | Chain split | Testnet validace, height-gated |

---

## 13. Reference

- **AuXpow design doc:** `AuXpow/REVENUE_B2B_AND_TRUE_AUXPOW_DESIGN.md`
- **V3 pool server:** `V3/L1/pool/src/bin/server.rs`
- **V3 miner:** `V3/L1/miner/src/parallel.rs`
- **V3 native FFI:** `V3/L1/native-ffi/src/lib.rs`
- **Kaspa stratum bridge:** https://github.com/kaspanet/rusty-kaspa (stratum bridge)
- **Alephium mining:** https://github.com/luminousmining (WoolyPooly reference)
- **Namecoin AuxPoW:** https://en.bitcoin.it/wiki/Merged_mining_specification
- **Decred AuxPoW:** https://docs.decred.org/proof-of-work/merge-mining/
