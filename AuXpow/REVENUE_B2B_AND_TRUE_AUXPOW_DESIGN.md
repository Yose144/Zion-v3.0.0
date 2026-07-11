# AuXpow — Revenue B2b + True AuxPoW Design & Implementation

> **Scope:** Všechny nové nápady, kód a dokumentace zůstávají v `AuXpow/` — žádné změny ve `V3/` dokud design není ověřen.
> **Cíl:** Nabídnout ZION poolu dvě revenue/bezpečnostní cesty, které se dají později integrovat do `V3/L1/pool`:
> 1. **B2b — Pool-side job multiplexing** (krátkodobý revenue z minerů na ZION poolu).
> 2. **C — True AuxPoW** (dlouhodobá bezpečnostní + revenue integrace).
> **Default BTC payout wallet:** `bc1q9c06f4wpf638xp2280j07qgdrpz0sdms7peqkh`
> **Build status:** `cargo test -p zion-auxpow` — **78 testů PASS** (default i `--features native-hashers`), clippy čisté, release build OK.

---

## 0. Aktuální stav (2026-07-11)

| Komponenta | Stav | Poznámka |
|------------|------|----------|
| `AuxPowClient` (Stratum v1 + EthStratum) | ✅ Hotovo | Single background reader, response routing, KAS/ALPH/DCR/ERG/RVN/ETC notify parsing |
| `ExternalHashers` (Blake3, kHeavyHash, Autolykos, KawPow, Ethash) | ✅ Hotovo | Pure-Rust fallback + `native-hashers` C FFI; ověřeno proti rusty-kaspa a luminousmining |
| `NativeFFI` (C hashers) | ✅ Hotovo | `csrc/` zkopírováno z V3/L1/native-ffi; `native-hashers` feature kompiluje C |
| `GpuMiner` (OpenCL) | ✅ Skeleton | Kernel sources v `csrc/opencl/`; Rust API čeká na `opencl3`/`ocl` crate |
| `JobMultiplexer` (B2b) | ✅ Hotovo | Connect/disconnect/rotate, job packaging |
| `ShareForwarder` (B2b) | ✅ Hotovo | Target check → submit, mock testy |
| `MinerHarness` (CPU scan) | ✅ Hotovo | Blake3 + kHeavyHash + Autolykos + KawPow + Ethash (pure-Rust fallback) |
| `DualStratumMiner` (Phase 2 prep) | ✅ Skeleton | Nonce split, share disposition, assignment counting |
| `TrueAuxPoW` (C) | ✅ Skeleton | AuxPoW Merkle root, validation, proof builder |
| `ParentChains` (DCR/ALPH headers) | ✅ Skeleton | DcrHeader 180B, AlphHeader, CoinbaseCommitment |
| `AuxPowScheduler` (profit switch) | ✅ Hotovo | Hysteresis, circuit breaker, env config |
| KAS E2E (connect/auth/notify/mine) | ✅ Funguje | 2miners, Kryptex, HeroMiners |
| KAS E2E (live submit accept) | ⚠️ Nelze ověřit CPU | Pool difficulty 2^-44 až 2^-52; potřebný ASIC |
| ALPH E2E (connect/auth/notify/mine) | ✅ Funguje | HeroMiners, WoolyPooly |
| ALPH E2E (live submit accept) | ⚠️ Nelze ověřit CPU | WoolyPooly ~2^-43, HeroMiners ~2^224 |
| DCR E2E | ❌ Pooly nedostupné | threepool.tech, miningandco, suprnova — všechny offline |
| Integrace do V3 | ❌ Zatím ne | Až bude AuXpow plně ověřen |

---

## 1. Rozdíl B2b vs C

| | B2b Pool-side multiplexing | C True AuxPoW |
|---|---|---|
| **Miner zůstává na ZION poolu** | ✅ Ano | ✅ Ano |
| **Jeden hash platí pro dvě sítě** | ❌ Ne | ✅ Ano |
| **Potřebuje consensus fork** | ❌ Ne | ✅ Ano |
| **Revenue** | Externí pool payouty (BTC) | Parent chain block rewards (DCR/ALPH) |
| **Pool musí posílat externí joby** | ✅ Ano | ✅ Ano (parent header v ZION jobu) |
| **Pool musí forwardovat externí share** | ✅ Ano | ✅ Ano |
| **Čas do produkce** | Týdny | Měsíce |
| **Kde se vyvíjí** | `src/multiplexer.rs` + `src/share_forwarder.rs` | `src/true_auxpow.rs` + `src/parent_chains.rs` |

---

## 2. B2b — Pool-side Job Multiplexing

### 2.1 Princip

1. **ZION pool** udržuje externí Stratum spojení k 2miners/ZPool/WoolyPooly přes `AuxPowClient`.
2. Pool stáhne externí `mining.notify` job (`job_id`, `header`, `target`).
3. Pool přebalí externí job do vlastního `JobPackage` formátu, který rozumí ZION miner.
4. Pool pošle minerovi `PoolMessage::Job` s `algorithm = "blake3"` (nebo `"kheavyhash"`, …).
5. Miner spočítá hash pomocí externího algoritmu (stejným CPU/GPU kódem jako ZION hash, jen jiná funkce).
6. Miner pošle share zpět do poolu.
7. Pool:
   - Ověří hash proti externímu targetu.
   - Pokud splní → forwardne share na externí pool jako `mining.submit` → **BTC revenue**.
   - Pokud splní ZION target → submitne do ZION nody → **ZION block reward**.
8. Tento proces se opakuje v cyklu podle nastaveného splitu (např. 70 % ZION / 30 % externí).

### 2.2 Implementované moduly

| Soubor | Účel | Stav |
|--------|------|------|
| `src/auxpow_client.rs` | `AuxPowClient` — Stratum v1 klient, single background reader, notify parsing pro KAS/ALPH/DCR, submit dialekty | ✅ |
| `src/multiplexer.rs` | `JobMultiplexer` — spravuje externí klienta, připojí se, rotuje coiny, přebaluje joby | ✅ |
| `src/share_forwarder.rs` | `ShareForwarder` — přijme hash od mineru, zkontroluje target, pošle `mining.submit` | ✅ |
| `src/miner_harness.rs` | `mine()` — brute-force scan pro externí `JobPackage` (Blake3 / kHeavyHash / kHeavyHash+extranonce1) | ✅ |
| `src/dual_stratum.rs` | **Phase 2 prep** — `DualStratumJob`, `DualStratumMiner`, nonce split, share routing | ✅ skeleton |
| `src/auxpow_scheduler.rs` | `AuxPowScheduler` — profit-switch s hysteresis + circuit breaker, env config | ✅ |
| `src/types.rs` | `JobPackage`, `ShareForwardResult`, `SplitConfig`, `ExternalCoin`, `CoinProfile`, `AuxPowConfig` | ✅ |

### 2.3 Rozhraní

```rust
// src/multiplexer.rs
pub struct JobMultiplexer { /* ... */ }

impl JobMultiplexer {
    pub fn new(wallet: impl Into<String>, worker_name: impl Into<String>) -> Self;
    pub fn with_preference(mut self, preference: PoolPreference, region: impl Into<String>) -> Self;
    pub async fn connect(&mut self, coin: ExternalCoin) -> Result<()>;
    pub async fn disconnect(&mut self);
    pub async fn current_job(&self) -> Option<JobPackage>;
    pub async fn wait_for_job(&self, timeout_ms: u64) -> Result<Option<JobPackage>>;
    pub fn active_coin(&self) -> Option<ExternalCoin>;
    pub fn client(&self) -> Option<Arc<AuxPowClient>>;
}

// src/share_forwarder.rs
pub struct ShareForwarder { client: Arc<AuxPowClient> }

impl ShareForwarder {
    pub fn new(client: Arc<AuxPowClient>) -> Self;
    pub async fn try_forward(
        &self,
        job_id: &str,
        nonce: u64,
        hash: &[u8; 32],
        target: &[u8; 32],
    ) -> Result<ShareForwardResult>;
    pub async fn try_forward_blake3(
        &self,
        job_id: &str,
        header: &[u8],
        nonce: u64,
        target: &[u8; 32],
    ) -> Result<ShareForwardResult>;
}

// src/auxpow_client.rs
pub struct AuxPowClient { /* ... */ }

impl AuxPowClient {
    pub fn new(profile: CoinProfile) -> Self;
    pub async fn connect(&self, payout_wallet: &str) -> Result<()>;
    pub async fn current_job(&self) -> Option<ExternalJob>;
    pub async fn wait_for_job(&self, timeout_ms: u64) -> Result<Option<ExternalJob>>;
    pub async fn submit_share(&self, job_id: &str, nonce: u64, hash_hex: &str) -> Result<ShareResult>;
    pub async fn is_connected(&self) -> bool;
    pub async fn current_difficulty(&self) -> f64;
    pub async fn extranonce1(&self) -> Vec<u8>;
    pub async fn share_target(&self) -> [u8; 32];
    pub async fn disconnect(&self) -> Result<()>;
    pub fn profile(&self) -> &CoinProfile;
    pub fn protocol(&self) -> StratumProtocol;
}

// src/types.rs
pub struct JobPackage {
    pub external_coin: ExternalCoin,
    pub external_job_id: String,
    pub algorithm: String,
    pub header_bytes: Vec<u8>,
    pub target_bytes: [u8; 32],
    pub timestamp: u64,
    pub start_nonce: u64,
    pub nonce_count: u64,
}

pub enum ShareForwardResult {
    BelowTarget,
    Accepted,
    Rejected(String),
    Unknown,
    NotConnected,
}

pub struct SplitConfig {
    pub zion_weight: u32,
    pub external_weight: u32,
}
```

### 2.4 Ukázkový flow

```text
Miner ──Stratum──→ ZION Pool
                      │
                      ├── 70 % času: issue ZION job (algorithm=deeksha_lite_v1)
                      │              Miner hash → ZION node
                      │
                      └── 30 % času: fetch KAS job from kas.2miners.com:2020
                                     issue KAS job (algorithm=kheavyhash)
                                     Miner hash → ShareForwarder
                                         meets target? → submit to 2miners
```

### 2.5 Testování

Unit testy používají lokální `MockStratumServer` (bind na `127.0.0.1:0`), takže nepotřebují žádnou živou síť:

- `multiplexer::tests::multiplexer_receives_job_for_dcr` — ověří, že multiplexer obdrží DCR job.
- `multiplexer::tests::multiplexer_switch_connects_and_disconnects` — připojení/přepnutí a odpojení.
- `share_forwarder::tests::share_below_target_is_not_forwarded` — pod-target share se nepošle.
- `share_forwarder::tests::share_meeting_target_is_accepted` — share splňující target je přijat.
- `share_forwarder::tests::share_meeting_target_can_be_rejected` — externí pool může odmítnout.
- `auxpow_client::tests::client_connect_subscribe_authorize` — full connect/subscribe/authorize round-trip.
- `auxpow_client::tests::client_rejected_share` — pool reject handling.
- `auxpow_client::tests::kas_round_trip_notify_and_submit` — KAS notify parsing + submit formát.
- `auxpow_client::tests::alph_round_trip_notify_and_submit` — ALPH notify parsing + submit formát.

---

## 3. C — True AuxPoW

### 3.1 Princip

1. ZION blokový header bude obsahovat hash rodičovského externího bloku (DCR/ALPH).
2. Miner hashuje ZION header, který zároveň slouží jako hash pro rodičovskou síť.
3. Pokud hash splní **rodičovský target** → pool forwardne parent block na parent síť → **parent block reward**.
4. Pokud hash splní **ZION target** → submitne se do ZION nody → **ZION block reward**.
5. Jeden hash může splnit oba targety → **dvojí reward**.

### 3.2 Implementované moduly

| Soubor | Účel | Stav |
|--------|------|------|
| `src/true_auxpow.rs` | `validate_auxpow()`, `validate_auxpow_full()`, `AuxPowData`, `AuxPowProofBuilder`, `ParentAlgorithm`, `ParentHeader` | ✅ skeleton |
| `src/parent_chains.rs` | `DcrHeader` (180B), `AlphHeader`, `CoinbaseCommitment` (Namecoin-style magic), header parsing | ✅ skeleton |

### 3.3 Rozhraní

```rust
// src/true_auxpow.rs
pub enum ParentAlgorithm {
    DCR,  // Blake3-256
    ALPH, // double Blake3-256
}

pub struct AuxPowData {
    pub aux_hash: [u8; 32],
    pub parent_header: Vec<u8>,
    pub parent_target: [u8; 32],
    pub parent_algo: ParentAlgorithm,
    pub coinbase_merkle_root: [u8; 32],
    pub aux_branch: Vec<[u8; 32]>,
    pub aux_index: u32,
}

pub struct AuxPowValidation {
    pub parent_hash_meets_target: bool,
    pub aux_included_in_coinbase: bool,
}

impl AuxPowValidation {
    pub fn is_valid(&self) -> bool;
}

pub fn validate_auxpow(data: &AuxPowData) -> Result<AuxPowValidation>;
pub fn compute_aux_merkle_root(
    leaf: [u8; 32],
    index: u32,
    branch: &[[u8; 32]],
) -> Option<[u8; 32]>;
```

### 3.4 DCR vs ALPH rozdíly

| | DCR | ALPH |
|---|---|---|
| Header size | 180 bytes (plné parsování TODO) | ~110 bytes (plné parsování TODO) |
| Nonce | 4 bytes | 24 bytes |
| Hash function | Blake3 | Double Blake3 |
| Parent header hash v POC | `hash_blake3_raw(header)` | `hash_blake3_raw(hash_blake3_raw(header))` |
| Extra data | 32 bytes (`ExtraData`) | chain-index + blob |

Testy `true_auxpow::tests::*` ověřují:
- správné počítání AuxPoW Merkle rootu pro 4 listy,
- validní syntetický AuxPoW blok,
- selhání při špatném rootu,
- rozdíl mezi DCR a ALPH parent hashováním.

---

## 4. Společné komponenty

### 4.1 `ExternalAlgorithm` a hashers

V `src/external_hashers.rs` jsou hotové:

| Funkce | Algoritmus | Použití | Native C |
|--------|-----------|---------|----------|
| `hash_blake3(header, timestamp, nonce)` | Blake3-256 | DCR, obecný Blake3 | ✅ `native-hashers` |
| `hash_blake3_raw(input)` | Blake3-256 (raw) | Parent header hashing | ✅ `native-hashers` |
| `hash_blake3_alph(header_blob, extranonce1, nonce)` | Double Blake3 | ALPH (WoolyPooly/HeroMiners) | ✅ `native-hashers` |
| `hash_kheavyhash(pre_pow_hash, timestamp, nonce)` | kHeavyHash (cSHAKE256) | KAS | ✅ `native-hashers` |
| `hash_kheavyhash_extranonce(pre_pow_hash, timestamp, nonce, en1)` | kHeavyHash + extranonce1 | KAS s pool extranonce | ✅ `native-hashers` |
| `hash_autolykos(header, nonce, height)` | Autolykos v2 (Blake2b) | ERG | ✅ `native-hashers` |
| `hash_kawpow(header, nonce, height)` | KawPow (ProgPow) | RVN, CLORE | ✅ `native-hashers` (DAG) |
| `hash_ethash(header, nonce, height)` | Ethash/EtcHash | ETC | ✅ `native-hashers` (DAG) |
| `meets_target(hash, target)` | Target comparison | Všechny | — |
| `parse_target_hex(hex)` | Hex → 32B target | Všechny | — |
| `hash_to_hex(hash)` | 32B → hex string | Submit | — |

**Feature flagy:**
- `native-hashers` — kompiluje C zdrojáky z `csrc/` (blake3, kheavyhash, autolykos, kawpow, etchash) přes `cc` crate. Pure-Rust fallback je vždy dostupný bez feature.
- `gpu-opencl` — načítá OpenCL kernely z `csrc/opencl/` (blake3_alph, kheavyhash). Rust API skeleton v `src/gpu_miner.rs` čeká na `opencl3`/`ocl` crate dependency.

**Reference ověření:**
- `kheavyhash_known_vector` test — shoda s rusty-kaspa referencí.
- `hash_blake3_alph` — shoda s luminousmining implementací (big-endian candidate nonce, double Blake3).

**Poznámka:** KawPow a Ethash vyžadují DAG (directed acyclic graph) počítaný per-epoch. Pure-Rust fallback NENÍ validní pro reálný mining — produkuje deterministický hash, ale nesplňuje algoritmus. Pro reálný mining použijte `native-hashers` feature s C implementací, která obsahuje DAG.

### 4.2 Coin selection / profit switching

`AuxPowScheduler` a `select_best_coin` z `src/types.rs` se použijí pro B2b i C:
- B2b: vybírá, který externí coin se aktuálně těží.
- C: vybírá, který parent chain je aktuálně nejvýhodnější.

`AuxPowScheduler` má:
- **Hysteresis** — zabraňuje flapping mezi coiny při malých rozdílech v profitu.
- **Circuit breaker** — po N selháních disconnectne a po timeoutu se znovu pokusí.
- **Env config** — `AuxPowConfig::from_env()` pro runtime konfiguraci.

### 4.3 Podporované coiny

| Coin | Algoritmus | Protokol | BTC payout | E2E stav |
|------|-----------|----------|-----------|----------|
| KAS | kheavyhash | Stratum | ✅ (zpool) | connect/auth/notify ✅, submit ⚠️ |
| ALPH | blake3 (double) | Stratum | ❌ (vlastní adresa) | connect/auth/notify ✅, submit ⚠️ |
| DCR | blake3 | Stratum | ✅ (zpool) | pooly offline ❌ |
| ERG | autolykos | EthStratum | TBD | TODO |
| RVN | kawpow | EthStratum | TBD | TODO |
| ETC | ethash | EthStratum | TBD | TODO |
| XMR | randomx | Stratum | TBD | TODO |
| FLUX | zelhash | Stratum | TBD | TODO |

---

## 5. Testování a build

```bash
# všechny testy crate
cargo test -p zion-auxpow

# clippy
cargo clippy -p zion-auxpow --all-targets -- -D warnings

# release build
cargo build -p zion-auxpow --release
```

**Aktuální výsledek (2026-07-11):**
- Unit testů: **78 PASS** (0 failed, 0 ignored)
- Clippy: čisté (žádná warning)
- Release build: OK

**Test pokrytí:**
- `external_hashers::tests::*` — Blake3, kHeavyHash known vector, target comparison
- `auxpow_client::tests::*` — connect/subscribe/authorize, KAS round-trip, ALPH round-trip, reject handling
- `multiplexer::tests::*` — job receive, switch connect/disconnect
- `share_forwarder::tests::*` — below target, accepted, rejected
- `true_auxpow::tests::*` — Merkle root, validation, DCR vs ALPH
- `types::tests::*` — coin identification, profit selection, hysteresis, config
- `auxpow_scheduler::tests::*` — circuit breaker auto-reset
- `miner_harness::tests::*` — harness returns none when no share
- `dual_stratum::tests::*` — nonce split, assignment counting

---

## 6. E2E test proti živému poolu

Nástroj: `AuXpow/examples/e2e_pool_test.rs`.

### 6.1 Použití

```bash
AUXPOW_E2E_RUN=1 \
AUXPOW_E2E_COIN=kas \
AUXPOW_E2E_POOL=heavyhash.mine.zpool.ca:5138 \
AUXPOW_E2E_MINE_SECS=2 \
AUXPOW_E2E_SUBMIT=1 \
cargo run -p zion-auxpow --example e2e_pool_test --release
```

Proměnné:
- `AUXPOW_E2E_RUN=1` — povinné, bez něj nástroj skončí (bezpečnostní pojistka).
- `AUXPOW_E2E_COIN` — výchozí `dcr`.
- `AUXPOW_E2E_POOL` — nepovinný override host:port.
- `AUXPOW_E2E_WALLET` — payout wallet (default podle coin).
- `AUXPOW_E2E_MINE_SECS` — kolik sekund CPU-minovat (0 = jen connect/auth/job).
- `AUXPOW_E2E_SUBMIT=1` — odeslat nalezený share (bez toho se jen vytěží a vypíše).
- `AUXPOW_E2E_JOB_TIMEOUT_MS` — timeout na první job (default 30 000 ms).

### 6.2 KAS E2E — 2miners, Kryptex, HeroMiners

**Adresa:** oficiální Kaspa adresa (`kaspa:qpzpfwcsqsxhxwup26r55fd0ghqlhyugz8cp6y3wxuddc02vcxtjg75pspnwz`) funguje pro autorizaci na všech třech poolech.

**Protokol:** standardní Stratum s `mining.subscribe`/`mining.authorize` a notify formátem `[jobId, [u64_le × 4], timestamp_ms]`.

**Hashování:**
- `parse_notify_params` pro KAS rekonstruuje `pre_pow_hash` ze čtyř little-endian `u64` hodnot.
- `hash_kheavyhash()` ověřen testem `kheavyhash_known_vector` proti rusty-kaspa referenci.
- **Max target:** Kaspa stratum bridge používá **224-bit max target** (`2^224 - 1`). `share_target()` pro KAS vrací `max_target / difficulty` s 32B hodnotou `[0u8; 4] || [0xFFu8; 28]`.
- **Nonce formát:** bridge parsuje nonce jako `u64::from_str_radix(nonce_hex, 16)` (big-endian hex číslo). `submit_share` pro KAS odesílá `[wallet.worker, jobId, full_nonce_hex]` kde `full_nonce_hex = format!("{:016x}", u64::from_le_bytes(extranonce1 || nonce_le))`.

**Submit výsledek:**
| Pool | Difficulty | Share target | CPU pravděpodobnost | Stav |
|------|-----------|-------------|-------------------|------|
| `kas.2miners.com:2020` | 512 | 224-bit / 512 | 2^-44 | ⚠️ nelze ověřit CPU |
| `kas.kryptex.network:7011` | 4096 | `0x00000000000fffff...` | 2^-52 | ⚠️ nelze ověřit CPU |
| `de.kaspa.herominers.com:1206` | 4 | ~2^222 | ~2^-222 | ⚠️ nelze ověřit CPU |

**Stav:** kryptografická část je hotová a ověřená proti rusty-kaspa referenci + mock round-trip testem. Live submit nelze ověřit CPU; je třeba ASIC, nízký difficulty test pool, nebo packet capture fungujícího mineru.

### 6.3 ALPH E2E — HeroMiners, WoolyPooly

**Generování adresy:** Alephium base58 adresa je `type_byte (0x00) || blake2b(pubkey, 32)` — žádný checksum. Po opravě `gen_addrs.py` autorizace na obou poolech prochází.

**Notify formát:** objekt (nebo pole objektů pro WoolyPooly):
```json
{ "jobId": "...", "fromGroup": 3, "toGroup": 3, "txsBlob": "...", "headerBlob": "...", "targetBlob": "..." }
```
`parse_notify_params` zpracuje obě varianty (samotný objekt i pole objektů — vybere první).

**Hashování a submit:**
- `hash_blake3_alph()` počítá `blake3(blake3(24B_nonce || headerBlob))`, kde plný 24B nonce = `candidate.to_be_bytes() || nuly`. `candidate = extranonce1_base + scanned_nonce`, `extranonce1_base` je extranonce1 interpretováno jako big-endian číslo. Odpovídá luminousmining implementaci.
- `submit_share` pro ALPH odesílá JSON objekt `{jobId, fromGroup, toGroup, nonce, worker}`, kde `nonce` je plný 48-znakový hex a `worker = wallet.worker`.

**Submit výsledek:**
| Pool | Share target | CPU pravděpodobnost | Stav |
|------|-------------|-------------------|------|
| `pool.woolypooly.com:3106` | `0x00000000001203af...` | ~2^-43 | ⚠️ nelze ověřit CPU |
| `de.alephium.herominers.com:1199` | ~2^224 (network target) | ~2^-224 | ⚠️ nelze ověřit CPU |

**Stav:** submit formát ověřen proti luminousmining zdrojáku. Live accept nelze ověřit bez GPU/ASIC nebo poolu s nízkou difficultou.

### 6.4 DCR E2E

Veřejné DCR pooly jsou všechny nedostupné:
- `dcr.threepool.tech:5550` — DNS neexistuje
- `decred.miningandco.com:5550` — connection refused
- `dcr.suprnova.cc:3256` — connection refused

DCR lze testovat přes zpool (`blake2s.mine.zpool.ca:5034`) s BTC payout, ale DCR používá Blake-256 (ne Blake3), takže vyžaduje vlastní hasher.

### 6.5 Co ještě chybí pro plně funkční E2E

1. **KAS live submit** — kryptografická část hotová, mock test PASS. CPU nenalezne share při reálné pool difficulty. Je třeba ASIC, nízký difficulty test pool, nebo packet capture.
2. **ALPH live submit** — submit formát ověřen proti luminousmining. `targetBlob` je pro CPU nenalezitelný. Stejný problém jako KAS.
3. **DCR E2E** — pooly offline. Alternativa: zpool s BTC payout, ale vyžaduje Blake-256 hasher (ne Blake3).
4. **GPU/ASIC podpora** — miner harness je CPU-only. Pro reálnou difficultou je potřeba GPU (pro ALPH Blake3) nebo ASIC (pro KAS kHeavyHash).

---

## 7. Architektura `AuxPowClient`

`AuxPowClient::connect()` spouští **jednu background poll smyčku**, která je jediným čtenářem TCP streamu:

```
TCP stream → poll_messages()
                ├── JSON-RPC response (id matches) → pending_requests map → send_request() oneshot
                └── notification (method field)     → handle_notification()
                                                         ├── mining.set_difficulty → update difficulty
                                                         ├── mining.notify         → parse + store job
                                                         └── mining.set_extranonce → update extranonce1
```

**Výhody:**
- Žádné race conditions při čtení z TCP.
- `send_request()` čeká na odpověď přes `oneshot` channel — clean async API.
- Notifikace se dispatchují odděleně od request/response cyklu.

**Submit dialekty:**
| Coin | Formát | Parametry |
|------|--------|-----------|
| KAS | `[wallet.worker, jobId, nonce_hex]` | nonce = big-endian hex číslo |
| ALPH | `{jobId, fromGroup, toGroup, nonce, worker}` | nonce = plný 48 hex chars |
| Standard (DCR/zpool) | `[wallet.worker, jobId, nonce_hex, extranonce2]` | standard Stratum v1 |

---

## 8. Integrační plán do V3 (až bude design hotový)

> **Teď se NEintegruje do V3.** Až bude AuXpow crate hotový a otestovaný, následuje:

1. `V3/L1/pool/src/bin/server.rs` — použije `AuXpow::JobMultiplexer` pro issue externích jobů.
2. `V3/L1/pool/src/lib.rs` — `MiningPool` bude forwardovat externí share přes `AuXpow::ShareForwarder`.
3. `V3/L1/miner/src/parallel.rs` — rozšířit `hash_candidate` o externí algoritmy (`blake3`, `kheavyhash`).
4. `V3/L1/core/src/*` — až pro C (true AuxPoW) — přidat `AUXPOW_FORK_HEIGHT`, nový header format, validaci.
5. `V3/L1/pool/src/config.rs` — přidat `AuxPowConfig` sekci (enable, split, coin preference, wallet).

---

## 9. Bezpečnostní poznámky

- Všechny nové moduly jsou **mimo V3** → nehrozí poškození mainnet poolu/nodu.
- Externí payout wallet je **pouze public address** — žádné private keys v AuXpow.
- Externí pool spojení používá circuit breaker, aby pool nezůstal viset na mrtvém endpointu.
- Před integrací do V3 musí projít unit testy + E2E test na testnetu.
- `gen_addrs.py` generuje pouze public adresy z public klíčů — žádné soukromé klíče.

---

## 10. Next steps

### Hotovo ✅
1. ✅ Commit implementovaných změn.
2. ✅ Vybrat první živý coin — KAS (kHeavyHash) + ALPH (Blake3).
3. ✅ E2E test — connect/subscribe/authorize/job/nalezení share FUNKČNÍ.
4. ✅ Převod `mining.set_difficulty` → share target.
5. ✅ `hash_kheavyhash()` podle oficiální Kaspa reference.
6. ✅ KAS share target: 224-bit max target.
7. ✅ KAS submit nonce formát: big-endian hex číslo.
8. ✅ ALPH Blake3 E2E pipeline (extranonce1, 24B nonce, double-Blake3, object-style notify).
9. ✅ ALPH base58 adresa (bez checksumu); autorizace na HeroMiners/WoolyPooly.
10. ✅ Single background reader s routováním odpovědí.
11. ✅ ALPH submit formát podle luminousmining (`{jobId, fromGroup, toGroup, nonce, worker}`).
12. ✅ Mock round-trip testy pro KAS i ALPH (78 testů PASS).

### Zbývá ⚠️
1. ⚠️ **Live KAS submit accept** — CPU nenalezne share při reálné pool difficulty (2^-44 až 2^-52). Je třeba ASIC, nízký difficulty test pool, nebo packet capture fungujícího mineru.
2. ⚠️ **Live ALPH submit accept** — WoolyPooly ~2^-43, HeroMiners ~2^224. Stejný problém.
3. ⚠️ **DCR E2E** — pooly offline. Alternativa: zpool s BTC payout + Blake-256 hasher.
4. ⚠️ **GPU/ASIC podpora** — miner harness je CPU-only. Pro reálnou difficultou je potřeba GPU (ALPH) nebo ASIC (KAS).

### Budoucí rozšíření
5. Doplnit `randomx` / `ethash` / `kawpow` / `autolykos` / `zelhash` hashe — vlastním Rust kódem nebo feature-gated FFI.
6. Pro C (true AuxPoW): doplnit reálné parsování DCR/ALPH headerů a získat reálná sample data z parent chainů.
7. Integrace do V3 pool serveru.
8. Profit-switch scheduler napojit na live API (WhatToMine, MiningPoolStats) pro reálná profit data.
