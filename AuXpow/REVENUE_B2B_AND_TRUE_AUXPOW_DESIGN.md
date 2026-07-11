# AuXpow — Revenue B2b + True AuxPoW Design & Implementation

> **Scope:** Všechny nové nápady, kód a dokumentace zůstávají v `AuXpow/` — žádné změny ve `V3/` dokud design není ověřen.  
> **Cíl:** Nabídnout ZION poolu dvě revenue/bezpečnostní cesty, které se dají později integrovat do `V3/L1/pool`:  
> 1. **B2b — Pool-side job multiplexing** (krátkodobý revenue z minerů na ZION poolu).  
> 2. **C — True AuxPoW** (dlouhodobá bezpečnostní + revenue integrace).  
> **Default BTC payout wallet:** `bc1q9c06f4wpf638xp2280j07qgdrpz0sdms7peqkh`
> **Build status:** `cargo test -p zion-auxpow` — 76 testů PASS, clippy čisté, release build OK.

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
- Unit testů: 76 PASS (přibyl test `kheavyhash_known_vector` ověřující shodu s rusty-kaspa)
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

### 5.2 Výsledek testu 2026-07-11 — zpool heavyhash (historický)

Pool: `heavyhash.mine.zpool.ca:5138` (zpool heavyhash / kHeavyHash).  
Wallet: `bc1q9c06f4wpf638xp2280j07qgdrpz0sdms7peqkh` (BTC, `c=BTC` password).

- ✅ TCP connect
- ✅ `mining.subscribe` — odpověď OK
- ✅ `mining.authorize` jako `bc1q...zion_e2e` — autorizováno
- ✅ `mining.set_difficulty` + `mining.notify` — job přijat (`id=61c2`, `algorithm=kheavyhash`, `header_len=32`, `target=ffffffff`)
- ✅ CPU hash nalezl share během několika sekund (při `difficulty=0.5` je share target `0xffffffff...`, takže prakticky jakýkoliv hash projde)
- ⚠️ Submit share: pool uzavře spojení. zpool `heavyhash` těží mix kHeavyHash coinů (KAS/Pyrin/…), bez explicitního výběru coinu nelze určit přesný PoW-buffer a submit formát.

### 5.3 KAS E2E — 2miners & HeroMiners (aktualizace)

**Adresa:** bylo ověřeno, že oficiální Kaspa adresa z dokumentace (`kaspa:qpzpfwcsqsxhxwup26r55fd0ghqlhyugz8cp6y3wxuddc02vcxtjg75pspnwz`) funguje pro autorizaci na `kas.2miners.com:2020` i `de.kaspa.herominers.com:1206`.

**Protokol:** oba pooly používají standardní Stratum s `mining.subscribe`/`mining.authorize` a notify formátem `[jobId, [u64_le × 4], timestamp_ms]`. Dříve se mylně předpokládal EthereumStratum/1.0.0; klient nyní správně mapuje KAS na `StratumProtocol::Stratum`.

**Hashování:**
- `parse_notify_params` pro KAS rekonstruuje `pre_pow_hash` ze čtyř little-endian `u64` hodnot.
- `hash_kheavyhash()` byl ověřen testem `kheavyhash_known_vector` proti rusty-kaspa referenci (`cSHAKE256("ProofOfWorkHash") → cSHAKE256("HeavyHash")` přes 80B buffer).
- `submit_share` pro KAS odesílá `[wallet.worker, jobId, full_nonce_hex]`, kde `full_nonce = extranonce1 || scanned_nonce_le` (8B celkem).

**Submit výsledek:**
- `kas.2miners.com:2020` — autorizace OK, share se najde okamžitě (`difficulty=512`), ale vrací `Rejected("unknown")`.
- `de.kaspa.herominers.com:1206` — autorizace OK (`difficulty=4`), share se najde, ale vrací `Invalid share`.
- **Pravděpodobná příčina:** pooly používají pro share validaci jiný target než jednoduché `max_target / difficulty`. Zejména u 2miners (diff 512) je skutečný pool target pravděpodobně odvozen z kompaktního 64bit targetu nebo z network targetu, což je pro CPU příliš těžké. Náš hash je kryptograficky správný, ale nalezené share nesplňují poolův skutečný target (nebo jsou odmítnuty jako stale). Bez přístupu k logům poolu nebo k fungujícímu CPU mineru nelze dále pokračovat.

### 5.4 ALPH E2E — HeroMiners (aktualizace)

**Generování adresy:** původní `alph_address_base58()` chybně přidávala 4B checksum podobně jako Bitcoin. Alephium base58 adresa je pouze `type_byte (0x00) || blake2b(pubkey, 32)` — žádný checksum. Po opravě gen_addrs.py autorizace na `de.alephium.herominers.com:1199` prochází.

**Notify formát:** HeroMiners posílá objekt:
```json
{ "jobId": "...", "fromGroup": 3, "toGroup": 3, "txsBlob": "...", "headerBlob": "...", "targetBlob": "..." }
```
`parse_notify_params` tento formát už parzuje.

**Hashování:**
- `hash_blake3_alph()` počítá `blake3(blake3(24B_nonce || headerBlob))`, kde scanned nonce je v little-endian bajtech hned za `extranonce1`.
- `submit_share` pro ALPH posílá `[jobId, hex(24B_full_nonce)]`.

**Submit výsledek:**
- Autorizace OK, notify přijat, ale `targetBlob` vypadá jako network target (`0000000100...00`, tedy ~2^224), což je pro CPU prakticky nenalezitelné. Formát `mining.submit` (full 24B nonce vs. `nonceSansExtraNonce`) potřebuje ověřit proti známému mineru.

### 5.5 Co ještě chybí pro plně funkční E2E

1. **KAS live submit** — potřebujeme pool s nízkou difficultou, na kterém ověříme, že správně počítáme hash i formát nonce. Nebo porovnat traffic s fungujícím ASIC/FPGA minerem.
2. **ALPH live submit** — potřebujeme ověřit submit formát proti HeroMiners (jestli očekává full 24B nonce nebo `nonceSansExtraNonce`) a zjistit, zda `targetBlob` je skutečně share target, nebo zda se share target počítá z `mining.set_difficulty` jinak.
3. **DCR E2E** — veřejné DCR pooly (`dcr.threepool.tech:5550`, `decred.miningandco.com:5550`) jsou stále nedostupné.
4. **Architektura čtečky** — `AuxPowClient::connect()` nyní spouští jednu background poll smyčku, která je jediným čtenářem TCP streamu. Odpovědi na JSON-RPC požadavky jsou směrovány přes `pending_requests` mapu do `send_request()`, notifikace se dispatchují odděleně.

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

1. ✅ **Commit** implementovaných změn (`ebbdc7b1b`); push na `origin` čeká na explicitní pokyn.
2. ✅ **Vybrat první živý coin** pro end-to-end demo — vybrán **zpool heavyhash** (kHeavyHash) s BTC payout walletou.
3. ✅ **E2E test** proti reálnému externímu poolu — connect/subscribe/authorize/job nalezení share FUNKČNÍ; submit share vyžaduje doladění pool difficulty + submit formátu.
4. **Doladit E2E submit:**
   - ✅ Implementovat převod `mining.set_difficulty` → share target (`difficulty_to_target`).
   - ✅ Zprovoznit `hash_kheavyhash()` podle oficiální Kaspa reference.
   - ✅ Implementovat Alephium Blake3 E2E pipeline (extranonce1, 24B nonce, double-Blake3, object-style notify).
   - ✅ Opravit generování Alephium base58 adresy (bez checksumu); autorizace na HeroMiners ALPH nyní funguje.
   - ✅ Předělat čtení z TCP streamu na jedinou background smyčku s routováním odpovědí.
   - ⚠️ Zůstává problém: live submit na KAS a ALPH pooly stále vrací `Invalid share` / `unknown`. Pravděpodobnou příčinou je pool target nebo submit nonce formát, který nelze ověřit CPU těžbou při vysoké difficultě.
5. Doplnit `randomx` / `ethash` / `kawpow` hashe — buď vlastním Rust kódem, nebo feature-gated FFI.
6. Pro C: doplnit reálné parsování DCR/ALPH headerů a získat reálná sample data z parent chainů.
