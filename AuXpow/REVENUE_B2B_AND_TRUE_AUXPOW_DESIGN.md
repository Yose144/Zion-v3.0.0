# AuXpow — Revenue B2b + True AuxPoW Design & Implementation

> **Scope:** Všechny nové nápady, kód a dokumentace zůstávají v `AuXpow/` — žádné změny ve `V3/` dokud design není ověřen.  
> **Cíl:** Nabídnout ZION poolu dvě revenue/bezpečnostní cesty, které se dají později integrovat do `V3/L1/pool`:  
> 1. **B2b — Pool-side job multiplexing** (krátkodobý revenue z minerů na ZION poolu).  
> 2. **C — True AuxPoW** (dlouhodobá bezpečnostní + revenue integrace).  
> **Default BTC payout wallet:** `bc1q9c06f4wpf638xp2280j07qgdrpz0sdms7peqkh`
> **Build status:** `cargo test -p zion-auxpow` — 75 testů PASS, clippy čisté, release build OK.

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
| **Kde se vyvíjí** | `AuXpow/src/multiplexer.rs` | `AuXpow/src/true_auxpow.rs` |

---

## 2. B2b — Pool-side Job Multiplexing

### 2.1 Princip

1. **ZION pool** udržuje externí Stratum spojení k 2miners/ZPool/MoneroOcean přes `AuxPowClient`.
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

| Soubor | Účel |
|--------|------|
| `src/multiplexer.rs` | `JobMultiplexer` — spravuje externí klienta, připojí se, rotuje coiny, přebaluje joby |
| `src/share_forwarder.rs` | `ShareForwarder` — přijme hash od mineru, zkontroluje target, pošle `mining.submit` |
| `src/miner_harness.rs` | `mine()` — brute-force scan pro externí `JobPackage` (Blake3 / kHeavyHash) |
| `src/dual_stratum.rs` | **Phase 2 prep** — `DualStratumJob`, `DualStratumMiner`, nonce split, share routing |
| `src/types.rs` | `JobPackage`, `ShareForwardResult`, `SplitConfig` |

`src/pool_adapter.rs` z původního draftu zatím není potřeba — adaptace na ZION `MiningJob` se udělá až při integraci do `V3/`.

### 2.3 Rozhraní

```rust
// src/multiplexer.rs
pub struct JobMultiplexer { /* ... */ }

impl JobMultiplexer {
    pub fn new(wallet: impl Into<String>, worker_name: impl Into<String>) -> Self;
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
}

// src/types.rs
pub struct JobPackage {
    pub external_coin: ExternalCoin,
    pub external_job_id: String,
    pub algorithm: String,
    pub header_bytes: Vec<u8>,
    pub target_bytes: [u8; 32],
    pub timestamp: u64,        // pro kHeavyHash/KAS PowHash
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

---

## 3. C — True AuxPoW

### 3.1 Princip

1. ZION blokový header bude obsahovat hash rodičovského externího bloku (DCR/ALPH).
2. Miner hashuje ZION header, který zároveň slouží jako hash pro rodičovskou síť.
3. Pokud hash splní **rodičovský target** → pool forwardne parent block na parent síť → **parent block reward**.
4. Pokud hash splní **ZION target** → submitne se do ZION nody → **ZION block reward**.
5. Jeden hash může splnit oba targety → **dvojí reward**.

### 3.2 Implementované moduly

| Soubor | Účel |
|--------|------|
| `src/true_auxpow.rs` | `validate_auxpow()`, `validate_auxpow_full()`, `AuxPowData`, `AuxPowProofBuilder`, `ParentAlgorithm`, `ParentHeader` |

| `src/parent_chains.rs` | **Phase 3 prep** — `DcrHeader` (180B), `AlphHeader`, `CoinbaseCommitment` (Namecoin-style magic), header parsing |

`src/parent_chains.rs` byl znovu zaveden z `src/true_auxpow.rs` — nyní obsahuje parsování DCR/ALPH headerů a coinbase commitmentů.

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

### 4.1 `ExternalAlgorithm` rozšíření

V `src/external_hashers.rs` jsou hotové:
- `hash_blake3(header, nonce)`
- `hash_kheavyhash(header, nonce)`
- `meets_target(hash, target)`
- `parse_target_hex(hex)` / `hash_to_hex(hash)`

Pro B2b miner harness jsou podporovány přímo `blake3` a `kheavyhash`. Těžké algoritmy (`randomx`, `autolykos`, `ethash`, `kawpow`, `zelhash`) zůstávají pro miner jako budoucí rozšíření — AuXpow crate jim prozatím pouze připravuje rozhraní a může je delegovat na GPU/FFI vrstvu, aniž by závisel na `V3/`.

### 4.2 Coin selection / profit switching

`AuxPowScheduler` a `select_best_coin` z `src/types.rs` se použijí pro B2b i C:
- B2b: vybírá, který externí coin se aktuálně těží.
- C: vybírá, který parent chain je aktuálně nejvýhodnější.

### 4.3 Circuit breaker a health

`AuxPowScheduler` už má circuit breaker. Stejný pattern se znovupoužije pro externí pool spojení v multiplexeru při pozdější integraci.

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
- Unit testů: 75 PASS
- Clippy: čisté (žádná warning)
- Release build: OK

---

## 5. E2E test proti živému poolu

Nový nástroj: `AuXpow/examples/e2e_pool_test.rs`.

### 5.1 Použití

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
- `AUXPOW_E2E_MINE_SECS` — kolik sekund CPU-minovat (0 = jen connect/auth/job).
- `AUXPOW_E2E_SUBMIT=1` — odeslat nalezený share (bez toho se jen vytěží a vypíše).
- `AUXPOW_E2E_JOB_TIMEOUT_MS` — timeout na první job (default 30 000 ms).

### 5.2 Výsledek testu 2026-07-11

Pool: `heavyhash.mine.zpool.ca:5138` (zpool heavyhash / kHeavyHash).  
Wallet: `bc1q9c06f4wpf638xp2280j07qgdrpz0sdms7peqkh` (BTC, `c=BTC` password).

- ✅ TCP connect
- ✅ `mining.subscribe` — odpověď OK
- ✅ `mining.authorize` jako `bc1q...zion_e2e` — autorizováno
- ✅ `mining.set_difficulty` + `mining.notify` — job přijat (`id=61c2`, `algorithm=kheavyhash`, `header_len=32`, `target=ffffffff`)
- ✅ CPU hash nalezl share během několika sekund (při `difficulty=0.5` je share target `0xffffffff...`, takže prakticky jakýkoliv hash projde)
- ⚠️ Submit share: pool uzavře spojení. Bylo vyzkoušeno několik variant:
  - klasický Stratum `[worker, job_id, nonce_hex]`
  - nonce s `0x` prefixem
  - nonce v little-endian i big-endian hex
  - alternativní 80B work buffer (Pyrin-like) i oficiální Kaspa 80B buffer
  - timestamp jako sekundy i jako milisekundy
  - Všechny varianty končí stejně — pool spojení ukončí.
- **Příčina:** zpool `heavyhash` algoritmus těží více kHeavyHash coinů (KAS/PYRIN/Sedra/...). Bez explicitního výběru coinu nelze spolehlivě určit, jaký přesný PoW-buffer, doménový řetězec a submit formát pool očekává. Náš `hash_kheavyhash()` je implementován podle oficiálního Kaspa `cSHAKE256("ProofOfWorkHash") → cSHAKE256("HeavyHash")` reference, ale proti živému zpool mixu to nestačí.

### 5.4 E2E proti Kryptex ALPH (Blake3)

Byla vyzkoušena ALPH pool `alph.kryptex.network:7010` (Blake3) s vygenerovanou testovací ALPH adresou:

- ✅ TCP connect
- ✅ `mining.subscribe` — odpověď `"00000000"` (Alephium/Kryptex vrací extranonce1 jako plain hex string)
- ✅ `mining.authorize` jako `17Kp3Ke7SkyzzFZ6ZJpAS2pPQcJgnzyJz3bcNjUroKt6x.zion_e2e`
- ✅ `mining.set_difficulty` = 512 → `share_target = 0x007fffffffffffff...`
- ✅ `mining.notify` — job přijat jako objekt `[{jobId, headerBlob, targetBlob, height, fromGroup, toGroup, txsBlob}]`, `header_len=302`
- ✅ CPU hash nalezl share během několika sekund (`nonce=696`, hash začíná `004d4f62...`)
- ⚠️ `mining.submit` ve formátu `[jobId, nonceSansExtraNonce]` (40 hex znaků = 20B suffix 24B nonce) zatím **nevrátilo odpověď** — spojení čeká na pool. Možné příčiny:
  - Špatné umístění scanned nonce v 24B nonce (mělo by být na offsetu, který miner mění; používáme offset `en1_len + 12`).
  - Špatná endianita nonce v `nonceSansExtraNonce`.
  - Pool očekává jiný submit formát (např. s workerId nebo s `0x` prefixem).
  - Kryptex stratum má specifickou variantu oproti oficiálnímu Alephium mining-pool.

### 5.3 Co ještě chybí pro plně funkční E2E

1. **Doladit Alephium submit / nonce layout** — ověřit proti oficiálnímu `alephium-mining-pool` nebo známému mineru, jaký přesně formát nonce a submitu Kryptex očekává. Potenciálně vyzkoušet i jiné pooly (`alph.woolypooly.com`, `alph.herominers.com`).
2. **KAS E2E** — pokud bude vygenerována `kaspa:` adresa, otestovat proti `kas.2miners.com:2020` a potvrdit, že `hash_kheavyhash()` dává akceptované share.
3. **Pool difficulty → share target** — opraveno `difficulty_to_target()`; pro `difficulty=512` nyní vrací správný target `0x007fff...`.
4. **DCR E2E** — Decred po DCP-0011 používá standardní Blake3; najít veřejný pool s přímým `address.name` přihlašováním.

---

## 6. Integrační plán do V3 (až bude design hotový)

> **Teď se NEintegruje do V3.** Až bude AuXpow crate hotový a otestovaný, následuje:

1. `V3/L1/pool/src/bin/server.rs` — použije `AuXpow::JobMultiplexer` pro issue externích jobů.
2. `V3/L1/pool/src/lib.rs` — `MiningPool` bude forwardovat externí share přes `AuXpow::ShareForwarder`.
3. `V3/L1/miner/src/parallel.rs` — rozšířit `hash_candidate` o externí algoritmy (`blake3`, `kheavyhash`).
4. `V3/L1/core/src/*` — až pro C (true AuxPoW) — přidat `AUXPOW_FORK_HEIGHT`, nový header format, validaci.

---

## 7. Bezpečnostní poznámky

- Všechny nové moduly jsou **mimo V3** → nehrozí poškození mainnet poolu/nodu.
- Externí payout wallet je **pouze public address** — žádné private keys v AuXpow.
- Externí pool spojení používá circuit breaker, aby pool nezůstal viset na mrtvém endpointu.
- Před integrací do V3 musí projít unit testy + E2E test na testnetu.

---

## 8. Otevřené otázky / next steps

1. ✅ **Push** implementovaných změn na `origin`.
2. ✅ **Vybrat první živý coin** pro end-to-end demo — vybrán **zpool heavyhash** (kHeavyHash) s BTC payout walletou.
3. ✅ **E2E test** proti reálnému externímu poolu — connect/subscribe/authorize/job nalezení share FUNKČNÍ; submit share vyžaduje doladění pool difficulty + submit formátu.
4. **Doladit E2E submit:**
   - ✅ Implementovat převod `mining.set_difficulty` → share target (`difficulty_to_target`).
   - ✅ Zprovoznit `hash_kheavyhash()` podle oficiální Kaspa reference.
   - ✅ Implementovat Alephium Blake3 E2E pipeline (extranonce1, 24B nonce, double-Blake3, object-style notify).
   - ⚠️ Zůstává problém: zpool `heavyhash` těží mix coinů (KAS/Pyrin/…). ALPH submit zatím nevrací odpověď — potřeba doladit nonce layout/submit formát.
5. Doplnit `randomx` / `ethash` / `kawpow` hashe — buď vlastním Rust kódem, nebo feature-gated FFI.
6. Pro C: doplnit reálné parsování DCR/ALPH headerů a získat reálná sample data z parent chainů.
