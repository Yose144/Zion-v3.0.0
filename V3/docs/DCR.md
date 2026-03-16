# DCR Dual-Mining — V3 Stealth Implementation

> **Status**: Design  
> **Target**: v3.0.1  
> **Revenue slot**: Blake3External (2 % fee)  
> **Pools**: 2miners (BTC payout) — jedna BTC adresa pro všechny coiny

---

## 1. Motivace

ZION CosmicHarmony pipeline už interně používá **Blake3 XOF** (scratchpad
init v `scratchpad_ekam.rs`).  Decred přešel na **čistý Blake3** v říjnu
2022 (DCP-0011).  Sdílíme hash-funkci — stačí jednu nit routovat na DCR
pool a máme čistý dual-mining s minimálním code-overhead.

Dual-stream běží **skrytě** jako background thread v `zion-miner`.
Navenek se miner tváří jako standardní CosmicHarmony miner, ale jedno CPU
jádro (nebo konfigurovaný počet) tiše hashe pro DCR a posílá share
na 2miners Stratum.

### Jedna BTC adresa = všechny 2miners pooly

2miners vyplácí **vždy v BTC** na zadanou Bitcoin adresu. Není potřeba
mít DCR wallet, ALPH wallet, KAS wallet atd. — stačí **jedna BTC
adresa** a funguje to automaticky pro všech 7 coinů:

| Coin | Pool | Algo | Payout |
|------|------|------|--------|
| **DCR** | `dcr.2miners.com:3333` | Blake3 | → BTC |
| **ALPH** | `alph.2miners.com:4545` | Blake3 | → BTC |
| **KAS** | `kas.2miners.com:4444` | kHeavyHash | → BTC |
| **ERG** | `erg.2miners.com:3056` | Autolykos | → BTC |
| **RVN** | `rvn.2miners.com:6060` | KawPow | → BTC |
| **ETC** | `etc.2miners.com:1010` | Ethash | → BTC |
| **FLUX** | `flux.woolypooly.com:3000` | ZelHash | → BTC* |

\* FLUX přes WoolyPooly — jiný pool, ale stejný princip BTC payoutu.

Stratum authorize = `BTC_ADRESA.worker_name` — pool automaticky pozná
že jde o BTC payout podle formátu adresy (`bc1q...` / `1...` / `3...`).

---

## 2. Architektura

```
┌─────────────────────────────────────────────────────────┐
│  zion-miner                                             │
│                                                         │
│  ┌──────────────┐          ┌────────────────────────┐   │
│  │ Primary ZION │  thread  │  DCR Stealth Worker    │   │
│  │ mining loop  │    0     │  (background thread)   │   │
│  │              │          │                        │   │
│  │ cosmic_harm… │          │  blake3::hash(header‖n)│   │
│  │ pool ← TCP  │          │  stratum v1 → 2miners  │   │
│  └──────┬───────┘          └────────┬───────────────┘   │
│         │                           │                   │
│    RevenueSource::Zion         RevenueSource::Blake3Ext │
│         │                           │                   │
│         └───────────┬───────────────┘                   │
│                     ▼                                   │
│            RevenueCollector                              │
│            (unified stats)                              │
└─────────────────────────────────────────────────────────┘
```

### Principy

| Princip | Detail |
|---------|--------|
| **Stealth** | Žádný viditelný output dokud není `ZION_BTC_WALLET` nastaven. Žádný extra CLI flag — pouze env vars. |
| **1 jádro default** | `ZION_DCR_THREADS=1` (default). Miner alokuje přesně tolik OS threadů pro DCR. Primary ZION loop zůstane nedotčen. |
| **Shared blake3** | V3 workspace už má `blake3 = "1"`. DCR hash = `blake3::hash(header ‖ nonce)`, 32 B output. Žádná nová dependency. |
| **Stratum v1** | Mining.subscribe → mining.authorize → mining.notify → mining.submit. Plaintext JSON-RPC přes TCP. |
| **Revenue tracking** | Každý accepted DCR share → `RevenueCollector.track_event(Blake3External, usd_value)`. Statistiky se promítnou do `PoolStats` / `Bye` zprávy. |
| **Graceful shutdown** | Background DCR worker reaguje na `AtomicBool` stop flag. Primary loop nastaví flag při ukončení. |

---

## 3. Blake3 v ZION — co máme k dispozici

### 3.1 Rust crate (V3 — aktuální)

```toml
# V3/Cargo.toml [workspace.dependencies]
blake3 = "1"

# V3/L1/core/Cargo.toml
blake3.workspace = true

# V3/L1/cosmic-harmony/Cargo.toml
blake3 = "1"
```

Blake3 Rust crate automaticky detekuje CPU features a zapíná:
- **SSE2/SSE4.1/AVX2/AVX-512** na x86_64
- **NEON** na aarch64

Žádný manual SIMD setup. Crate má vlastní `build.rs` s `cc`, kompiluje
optimalizovaný asm. **Tohle je naše Blake3 nativní knihovna** — stačí
volat `blake3::hash()`.

### 3.2 Legacy C FFI (L1 — reference)

```
L1/native-libs/all/blake3_native.c    # 280 řádků, full C impl
L1/native-libs/all/libblake3_zion.dylib # macOS prebuilt
L1/cosmic-harmony/build.rs            # cc::Build s feature "native-blake3"
```

V V3 **nepoužíváme** legacy C FFI. Rust crate `blake3` je rychlejší
(auto-SIMD + multithreading v `Hasher::update_rayon`) a nevyžaduje
cross-compile.

### 3.3 Benchmark — co očekávat

| Setup | Throughput (1 jádro) |
|-------|---------------------|
| `blake3::hash()` 80B input, x86_64 AVX2 | ~800 MH/s |
| `blake3::hash()` 80B input, x86_64 SSE4.1 | ~400 MH/s |
| DCR mainnet difficulty (Mar 2026) | ~PH/s sítě → GPU/ASIC dominance |

Na CPU solo-mining nemáme šanci najít DCR blok. Ale **2miners pool platí
v BTC** za share, takže i malý hashrate = revenue. S 1 jádrem na
background threadu dostaneme ~400–800 MH/s čistého Blake3
— dostatečný pro pool share submission.

---

## 4. Konfigurace (env vars)

### 4.1 Sdílená BTC peněženka (povinná)

| Proměnná | Default | Popis |
|----------|---------|-------|
| `ZION_BTC_WALLET` | `bc1qvujra09wlsm35tmhc0v0fnxpsj0cuaq88hd8mw` | BTC adresa pro 2miners payout. **Pokud prázdná, žádný dual worker se nespustí.** Jedna adresa pro DCR, ALPH, KAS, ERG, RVN, ETC, FLUX. |

### 4.2 Per-coin nastavení

| Proměnná | Default | Popis |
|----------|---------|-------|
| `ZION_DCR_POOL` | `dcr.2miners.com:3333` | Stratum v1 endpoint |
| `ZION_DCR_THREADS` | `1` | Počet OS threadů pro DCR hashing |
| `ZION_DCR_WORKER` | `zion_stealth` | Worker name pro pool stats |
| `ZION_DCR_INTENSITY` | `100` | 0–100 %, throttle pokud chceme šetřit CPU |
| `ZION_DCR_ENABLED` | `true` | Zapnout DCR dual? (ignorováno pokud chybí `ZION_BTC_WALLET`) |
| `ZION_POOL_PREFERENCE` | `default` | `nicehash` \/ `herominers` \/ `zpool` \/ `default` pool hierarchy |
| `ZION_POOL_REGION` | `eu` | region mapping pro NiceHash/HeroMiners/ZPool endpointy |

Stejný vzor pro budoucí coiny: `ZION_ALPH_POOL`, `ZION_KAS_POOL` atd.
Všechny sdílí `ZION_BTC_WALLET` — **žádné per-coin wallet adresy**.

### 4.3 Stealth chování

- **Bez `ZION_BTC_WALLET`** = žádný output, žádný síťový traffic, nulový overhead
- **S `ZION_BTC_WALLET`** = jediný řádek při startu:

```
dcr_stealth=enabled threads=1 pool=dcr.2miners.com:3333 payout=bc1q...d8mw
```

Wallet v logu zkrácen na `bc1q...` + poslední 4 znaky.

### Poznámka k NiceHash (ověřeno proti legacy testnet implementaci)

- NiceHash je vhodný pro **KAS/ETC/RVN/ERG** (jedna BTC adresa pro všechny tyto algos).
- NiceHash **aktuálně nepodporuje Blake3 endpoint** pro `DCR`/`ALPH`, takže pro tyto coiny se fallbackuje na HeroMiners/ZPool/default.
- Fallback hierarchy ve V3 profit-routeru je: `nicehash -> herominers -> zpool -> default`.

---

## 5. Stratum v1 protokol pro DCR

### 5.1 Handshake

```json
→ {"id":1,"method":"mining.subscribe","params":["zion-miner/3.0","dcr"]}
← {"id":1,"result":[[["mining.notify","session-id"]],"extranonce1","extranonce2_size"]}

→ {"id":2,"method":"mining.authorize","params":["bc1qvujra09wlsm35tmhc0v0fnxpsj0cuaq88hd8mw.zion_stealth","x"]}
← {"id":2,"result":true}
```

### 5.2 Job notification (server → miner)

```json
← {"id":null,"method":"mining.notify","params":[
    "job_id",        // hex string
    "prev_hash",     // 32B hex LE
    "header_prefix", // merkle root + extras
    "ntime",         // hex timestamp
    "nbits",         // target compact
    "clean_jobs"     // bool
  ]}
```

### 5.3 Share submission (miner → server)

```json
→ {"id":3,"method":"mining.submit","params":[
    "bc1qvujra09wlsm35tmhc0v0fnxpsj0cuaq88hd8mw.zion_stealth",
    "job_id",
    "nonce"          // 4B hex LE (u32)
  ]}
← {"id":3,"result":true}
```

### 5.4 DCR Blake3 hash function

Decred Blake3 (DCP-0011) hash:

```rust
fn dcr_hash(header: &[u8; 180]) -> [u8; 32] {
    blake3::hash(header).into()
}
```

Decred block header = 180 bytů. Hash = `blake3(header)`, 32 B output.
Target comparison: `hash <= target` (LE byte order).

---

## 6. Implementační plán

### Fáze 1: DCR Stratum client (`dcr_stratum.rs`)

Nový soubor v `V3/L1/miner/src/dcr_stratum.rs`:

```rust
pub struct DcrStratumClient {
    stream: TcpStream,
    reader: BufReader<TcpStream>,
    wallet: String,
    worker: String,
    extranonce1: Vec<u8>,
    extranonce2_size: usize,
}

impl DcrStratumClient {
    pub fn connect(pool_addr: &str, wallet: &str, worker: &str) -> Result<Self>;
    pub fn subscribe(&mut self) -> Result<()>;
    pub fn authorize(&mut self) -> Result<()>;
    pub fn read_job(&mut self) -> Result<DcrJob>;
    pub fn submit_share(&mut self, job_id: &str, nonce: u32) -> Result<bool>;
}
```

Minimální Stratum v1 klient — žádný async, čistý `std::net::TcpStream`
+ `BufReader` (konzistentní s existujícím V3 pool kódem).

### Fáze 2: DCR hasher (`dcr_worker.rs`)

```rust
pub struct DcrWorker {
    config: DcrConfig,
    stop: Arc<AtomicBool>,
    revenue: Arc<RevenueCollector>,
    stats: Arc<Mutex<DcrStats>>,
}

pub struct DcrConfig {
    pub btc_wallet: String,   // shared ZION_BTC_WALLET — one addr for all 2miners
    pub pool_addr: String,
    pub threads: usize,
    pub worker_name: String,
    pub intensity: u8,
}

pub struct DcrStats {
    pub accepted_shares: u64,
    pub rejected_shares: u64,
    pub hashrate_hps: f64,
    pub revenue_btc: f64,
}

impl DcrWorker {
    /// Spustí DCR mining na N background threadech.
    /// Vrací JoinHandle pro graceful shutdown.
    pub fn spawn(self) -> Vec<thread::JoinHandle<()>>;

    /// Hlavní hashovací smyčka jednoho threadu.
    fn mine_loop(&self, thread_id: usize);
}
```

Hash loop per thread:

```rust
fn mine_loop(&self, thread_id: usize) {
    let mut client = DcrStratumClient::connect(...);
    client.subscribe().unwrap();
    client.authorize().unwrap();

    while !self.stop.load(Ordering::Relaxed) {
        let job = client.read_job().unwrap();
        let (start, end) = nonce_range_for_thread(thread_id, self.config.threads);

        for nonce in start..end {
            if self.stop.load(Ordering::Relaxed) { break; }

            let hash = dcr_hash(&job.build_header(nonce));
            if hash_meets_target(&hash, &job.target) {
                let accepted = client.submit_share(&job.id, nonce).unwrap_or(false);
                if accepted {
                    self.revenue.track_event(RevenueEvent {
                        source: RevenueSource::Blake3External,
                        value_usd: estimate_dcr_share_value(),
                        qualifies: true,
                    });
                }
            }
        }
    }
}
```

### Fáze 3: Integrace do `main.rs`

```rust
fn main() -> Result<()> {
    let config = MinerConfig::from_env()?;

    // ── Stealth DCR worker ──
    let dcr_handles = if let Some(dcr_config) = DcrConfig::from_env()? {
        println!("dcr_stealth=enabled threads={} pool={}", 
                 dcr_config.threads, dcr_config.pool_addr);
        let stop = Arc::new(AtomicBool::new(false));
        let worker = DcrWorker::new(dcr_config, stop.clone(), revenue.clone());
        Some((worker.spawn(), stop))
    } else {
        None
    };

    // ── Primary ZION mining (unchanged) ──
    let outcome = match config.pool_addr.as_deref() {
        Some(pool_addr) => run_remote_session(&config, pool_addr)?,
        None => run_local_session(&config)?,
    };

    // ── Shutdown DCR ──
    if let Some((handles, stop)) = dcr_handles {
        stop.store(true, Ordering::Relaxed);
        for h in handles { let _ = h.join(); }
    }

    // ... print outcome
}
```

### Fáze 4: Testy

```
V3/L1/miner/src/dcr_stratum.rs  — unit testy pro message parsing
V3/L1/miner/src/dcr_worker.rs   — mock Stratum server test
tests/mock_dcr_pool.rs           — integration test: miner → mock DCR pool
```

---

## 7. Souborová struktura

```
V3/L1/miner/
  src/
    main.rs               # +15 řádků: DcrConfig::from_env, spawn, shutdown
    dcr_stratum.rs         # NEW: ~200 řádků, Stratum v1 klient
    dcr_worker.rs          # NEW: ~180 řádků, background hash worker
    dcr_hash.rs            # NEW: ~30 řádků, dcr_hash() + target comparison

V3/L1/cosmic-harmony/
  src/
    profit_router.rs       # beze změn (DCR profil už existuje)
    revenue.rs             # beze změn (Blake3External už existuje)
```

Odhadovaný nový kód: **~430 řádků Rustu** + testy.

---

## 8. Bezpečnostní úvahy

| Riziko | Mitigace |
|--------|----------|
| Wallet leak v logu | Wallet se nikdy neprintuje celý — max prvních 8 znaků + `...` |
| Pool MitM | Stratum v1 je plaintext. Pro produkci zvážit Stratum v2 (šifrovaný). Pro 2miners stačí TLS wrapper (`stunnel`). |
| CPU starvation | `ZION_DCR_THREADS=1` default, primary ZION loop má prioritu. DCR worker yield-uje po každém nonce batchi. |
| Revenue attribution | Každý accepted DCR share má explicitní `RevenueSource::Blake3External` tag. Oddělené od ZION share. |
| Nonce collision | Každý thread dostane exkluzivní nonce rozsah: `thread_id * stride .. (thread_id+1) * stride`. Extranonce2 z poolu zajišťuje globální unikátnost. |

---

## 9. Timeline

| Krok | Rozsah | Prerekvizity |
|------|--------|-------------|
| `dcr_hash.rs` | 30 ř. | — |
| `dcr_stratum.rs` | 200 ř. | — |
| `dcr_worker.rs` | 180 ř. | dcr_hash, dcr_stratum |
| `main.rs` integrace | 15 ř. | dcr_worker |
| Unit testy | 150 ř. | vše |
| Mock pool integ. test | 100 ř. | dcr_stratum |
| **Celkem** | **~675 ř.** | |

---

## 10. Postup buildu

```bash
# Build
cd V3
cargo build --bin zion-miner

# Test (bez DCR — stealth off)
ZION_LOOP_COUNT=1 cargo run --bin zion-miner

# Test s DCR dual-mining (stačí jedna BTC adresa)
ZION_BTC_WALLET="bc1qvujra09wlsm35tmhc0v0fnxpsj0cuaq88hd8mw" \
ZION_DCR_THREADS=1 \
ZION_LOOP_COUNT=5 \
ZION_POOL_ADDR="127.0.0.1:8445" \
cargo run --bin zion-miner

# Pool a worker se doplní automaticky z defaults:
# DCR_POOL = dcr.2miners.com:3333
# DCR_WORKER = zion_stealth
# Authorize = bc1qvujra09wlsm35tmhc0v0fnxpsj0cuaq88hd8mw.zion_stealth
```

Očekávaný výstup:

```
ZION v3 miner
consensus=cosmic_harmony_ekam_deeksha
dcr_stealth=enabled threads=1 pool=dcr.2miners.com:3333
mode=remote
pool_addr=127.0.0.1:8445
...
iteration=1
share_status="Accepted"
...
revenue_total_usd=3.75      ← includes both ZION + DCR shares
```

---

## 11. Rozšíření (budoucí)

- **ALPH dual**: Stejný vzor — `alph_stratum.rs` + `alph_worker.rs`. ALPH je taky Blake3, pool `alph.2miners.com:4545`. **Sdílí `ZION_BTC_WALLET`** — žádná nová wallet konfigurace.
- **Multi-coin stealth**: S jednou BTC adresou můžeme přidat KAS, ERG, RVN, ETC — každý na svém threadu, všechny payouty jdou na stejný BTC wallet přes 2miners.
- **GPU offload**: Pokud přidáme OpenCL/CUDA backend, DCR worker může přepnout z CPU na GPU compute pipeline.
- **Profit switching**: `select_best_coin()` z `profit_router.rs` může dynamicky přepínat mezi DCR a ALPH podle aktuální profitability. Wallet zůstává stejný — mění se jen pool endpoint.
- **Stratum v2**: Šifrovaný + binární protokol. Decred ho zatím nepodporuje, ale 2miners může přidat.

---

## 12. Wallet summary

```
ZION_BTC_WALLET=bc1qvujra09wlsm35tmhc0v0fnxpsj0cuaq88hd8mw
    ├── dcr.2miners.com:3333   authorize: bc1qvujr...d8mw.zion_stealth
    ├── alph.2miners.com:4545  authorize: bc1qvujr...d8mw.zion_stealth
    ├── kas.2miners.com:4444   authorize: bc1qvujr...d8mw.zion_stealth
    ├── erg.2miners.com:3056   authorize: bc1qvujr...d8mw.zion_stealth
    ├── rvn.2miners.com:6060   authorize: bc1qvujr...d8mw.zion_stealth
    ├── etc.2miners.com:1010   authorize: bc1qvujr...d8mw.zion_stealth
    └── flux.woolypooly:3000   authorize: bc1qvujr...d8mw.zion_stealth
```

Všech 7 poolů → BTC payout → `bc1qvujra09wlsm35tmhc0v0fnxpsj0cuaq88hd8mw`.
