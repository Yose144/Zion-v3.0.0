# ZION Pool → Professional-Grade Upgrade Plan

> **Datum:** 2026-07-21
> **Autor:** Devin (na základě auditu `V3/L1/pool` + Edge live stavu)
> **Stav:** Plán — čeká na implementaci
> **Cílová verze:** pool 3.1.0 (po 3.0.9, v rámci V3.1 migrace)

---

## 0. Executive Summary

Současný pool (`zion-pool` crate, `V3/L1/pool/src/bin/server.rs` — 9 314 řádků) je
**funkční pro Mainnet Beta s 2–10 vlastními minery**, ale **neškáluje na tisíce
externích minerů** a chybí mu většina funkcí, které profesionální pooly
(F2Pool, AntPool, 2miners, Binance Pool, Braiins) považují za standard.

**Současný stav (audit 2026-07-21 16:30 CEST):**
- Pool hashrate: 50 KH/s (24h: 106 KH/s)
- Aktivní mineri: 2 (`local-miner` → `vega-smos` + `local-gpu`)
- Accept rate: 98.62 % (5 581 / 5 659)
- Bloky nalezeny: 82
- PPLNS window: 500 000, used 61
- Triple-stream pipeline: ZION (GPU) + ZANO (GPU ProgPow) + VRSC (CPU VerusHash) — funguje
- AuxPow multi-bridge: 24 coinů, 22/22 GPU kernels

**Hlavní technické dluhy (detail v §2):**
1. **Thread-per-connection** (`std::thread::spawn` per miner) — neškáluje nad ~1 000 minerů
2. **`std::sync::Mutex`** držený přes I/O — lock contention, poisoning na panic
3. **Pouze custom JSON protokol** (`zion-v3-stratum/0.2`) — žádný externí miner se nepřipojí
4. **Žádná databáze** — PPLNS state v JSON souboru, žádný share log, žádná payout historie
5. **Žádný TLS/SSL stratum port** — plain TCP only (DPI/firewall blokuje)
6. **Polling block template každé 3 s** místo push subscription (1.5 s průměrná ztráta)
7. **`println!` logování** — žádný structured logging, žádné log levels, žádná rotace

**Cíl:** Po implementaci tohoto plánu bude pool schopen obsloužit **10 000+ minerů**
s podporou **Stratum v1 + v2**, **TLS stratum**, **PostgreSQL backendem**,
**push block template subscription**, **structured loggingem** a **kompletní
REST API s autentizací** — paritní s 2miners/Braiins.

---

## 1. Reference: Co profesionální pooly mají a my ne

| Feature | F2Pool | AntPool | 2miners | Braiins | **ZION (nyní)** |
|---------|--------|---------|---------|---------|-----------------|
| Stratum v1 | ✅ | ✅ | ✅ | ✅ | ❌ (pouze custom JSON) |
| Stratum v2 (SRI) | ⏳ | ⏳ | ❌ | ✅ | ❌ |
| TLS/SSL stratum port | ✅ | ✅ | ✅ | ✅ | ❌ |
| Multi-port difficulty stratification | ✅ | ✅ | ✅ | ✅ | ❌ (single port 8444) |
| Async I/O (epoll/kqueue) | ✅ | ✅ | ✅ | ✅ | ❌ (thread-per-conn) |
| PostgreSQL/Redis backend | ✅ | ✅ | ✅ | ✅ | ❌ (JSON file) |
| Share log (audit trail) | ✅ | ✅ | ✅ | ✅ | ❌ (jen countery) |
| Block template push subscription | ✅ | ✅ | ✅ | ✅ | ❌ (3s polling) |
| Long-poll (LP) endpoint | ✅ | ✅ | ✅ | ✅ | ❌ |
| Vardiff per-miner | ✅ | ✅ | ✅ | ✅ | ✅ (základní) |
| PPLNS / PPS+ / SOLO | ✅ | ✅ | ✅ | ✅ | ✅ (PPLNS only) |
| Anonymous mining (wallet as username) | ✅ | ✅ | ✅ | ✅ | ❌ (vyžaduje Hello handshake) |
| Miner API (stats, payouts, hashrate) | ✅ | ✅ | ✅ | ✅ | ✅ (bez auth) |
| Prometheus metrics | ✅ | ✅ | ✅ | ✅ | ✅ (částečně) |
| Grafana dashboard | ✅ | ✅ | ✅ | ✅ | ❌ (jen vlastní HTML) |
| Pool luck tracking | ✅ | ✅ | ✅ | ✅ | ❌ |
| Orphan/stale block monitoring | ✅ | ✅ | ✅ | ✅ | ❌ |
| Email/Telegram notifications | ✅ | ✅ | ✅ | ✅ | ❌ |
| Scheduled batch payouts | ✅ | ✅ | ✅ | ✅ | ⚠️ (deferred retry, ne scheduled) |
| Miner worker name validation | ✅ | ✅ | ✅ | ✅ | ❌ |
| Connection rate limiting | ✅ | ✅ | ✅ | ✅ | ⚠️ (jen IP session limit) |
| Share spam protection | ✅ | ✅ | ✅ | ✅ | ⚠️ (jen NoSolution throttle) |
| Geographic failover (multi-region) | ✅ | ✅ | ✅ | ✅ | ❌ (single Edge) |
| Merge mining (AuxPoW consensus) | ✅ | ✅ | ✅ | ✅ | ❌ (jen share forwarding) |

---

## 2. Audit — konkrétní problémy v současném kódu

### 2.1 Architektura I/O (kritické)

**`src/bin/server.rs:1677`** — každý miner dostává vlastní `std::thread::spawn`:
```rust
handles.push(thread::spawn(move || {
    handle_client(stream, pool, revenue_scheduler, ...);
}));
```
- **Stack:** 8 MB default × 10 000 minerů = 80 GB virtuální paměti (nerealistické)
- **Scheduler overhead:** 10 000 kernel threads → context-switch storm
- **Realistický limit:** ~500–1 000 minerů na současném Contabo VPS (7.8 GB RAM)
- **Pro pooly:** async I/O (tokio/mio) — 10 000+ spojení na 1 thread pool

### 2.2 Zamykání (kritické)

Všechny sdílené struktury používají `std::sync::Mutex`:
- `pool: Arc<Mutex<MiningPool>>` — drženo přes `expire_stale_jobs()`, `record_*_share()`
- `pplns_engine: Arc<Mutex<PplnsEngine>>` — drženo přes `record_share_with_diff()`, `snapshot()`
- `routing_stats: Arc<Mutex<RoutingStats>>` — drženo přes `record()` za každý share
- `miner_telemetry: Arc<Mutex<MinerTelemetryRegistry>>` — drženo přes každý share
- `revenue_scheduler: Arc<Mutex<RevenueScheduler>>` — drženo přes `assign_auto_group()`

**Problémy:**
1. **Lock contention:** 10 000 minerů čeká na jeden PPLNS lock → serializace
2. **Lock poisoning:** panic v jednom threadu → `expect("lock poisoned")` zabije celý pool
3. **Lock držen přes I/O:** `relay_share_fire_and_forget()` volá `std::net::TcpStream::connect()` while holding PPLNS lock (server.rs:3214–3232)

### 2.3 Protokol (kritické pro veřejný launch)

**`src/lib.rs:15`** — `PROTOCOL_VERSION: "zion-v3-stratum/0.2"` — custom JSON line protokol:
```
{"type":"hello","miner_id":"...","worker_name":"...","algorithm":"...","payout_address":"..."}
{"type":"welcome","protocol_version":"...","algorithm":"...","job_ttl_ms":15000}
{"type":"job","job_id":615,"algorithm":"deeksha_lite_v1","start_nonce":...,"nonce_count":...,"target_hex":"...","header_hex":"...","height":615,"stream_weights":"...","external_stream":{...}}
{"type":"submit","job_id":615,"miner_id":"...","worker_name":"...","nonce":...,"hash_hex":"..."}
{"type":"result","accepted":true,"status":"Accepted"}
```

**Žádný externí miner (ccminer, xmrig, lolminer, trex, bzminer, teamread) tento protokol neumí.**
Pro Mainnet Beta to je OK (pouze vlastní `zion-miner`), ale pro veřejný launch 2026-12-31 musíme podporovat **Stratum v1** (`mining.subscribe`/`mining.authorize`/`mining.notify`/`mining.submit`), jinak nepřijdou externí mineri.

### 2.4 Persistenci (kritické)

**PPLNS state:** `/data/zion/pplns-state.json` — JSON soubor, ukládán každých 10 s:
```rust
// server.rs:1169
thread::spawn(move || loop {
    thread::sleep(Duration::from_secs(save_interval_s));  // 10s
    let snapshot = { pplns_ref.lock()...snapshot() };
    PplnsEngine::write_snapshot_to_path(&snapshot, &state_path);
});
```
**Problémy:**
1. **10s okno ztráty:** crash mezi saves → ztráta až 10 s shares (PPLNS window se zkrátí)
2. **Není atomic:** `write_snapshot_to_path` píše přímo do souboru — crash mid-write → corrupt JSON
3. **Není queryable:** nelze dotázat "kolik share měl miner X v posledních 24 h"
4. **Není audit trail:** žádný záznam o tom, kdo kdy jaký share odeslal
5. **Není payout historie:** `paid_per_miner` je jen counter, ne seznam TX IDs

### 2.5 Block template (výkonnost)

**`server.rs:876`** — `TemplateCache` s 3 s TTL:
```rust
let template_cache = Arc::new(Mutex::new(TemplateCache::new(Duration::from_secs(3))));
```
Pool polluje node RPC `getblocktemplate` každé 3 s. **Pro pooly:** push subscription přes WebSocket nebo long-poll — nový template do 100 ms po bloku na chainu. Naše 3 s polling = průměrně 1.5 s ztráta → mineri mine na stale template → reject rate +.

### 2.6 Logování (operabilita)

**`println!`** všude — 9 314 řádků server.rs, žádný `tracing`/`log` crate, žádné log levels, žádná rotace:
```rust
println!("session_start active_sessions={session_count} session_id={session_id}");
println!("wire_hello={}", hello_line);
println!("BLOCK_FOUND miner={} height={} nonce={} hash={}", ...);
```
**Problémy:**
1. **Žádné log levels** — nelze filtrovat DEBUG/INFO/WARN/ERROR
2. **Žádná rotace** — journald rotuje, ale strukturované query nelze
3. **Žádné correlation ID** — nelze sledovat jeden share napříč funkcemi
4. **`println!` je synchronized** — 10 000 threadů čeká na stdout lock

### 2.7 Stats display bug (nalezeno 2026-07-21)

`/stats` endpoint hlásí `auxpow.shares_accepted: 0, shares_rejected: 6` i když VRSC reálně přijímá shares (multi-bridge path). Důvod: stats čte ze **standalone AuxPowScheduler** (`ZION_AUXPOW_*` env vars), ale skutečné VRSC mining jde přes **MultiAuxPowBridge** (`ZION_POOL_AUXPOW_CPU_*`). Dva paralelní systémy, stats ukazuje špatný.

### 2.8 Další problémy

- **Žádný share rate limit** — miner může poslat 1000 shares/s, pool je všechny validuje
- **Žádné miner_id auth** — kdokoli může claimnout `local-miner` a přijímat jeho payouty
- **Žádné orphan monitoring** — block found → submit → ale nevíme, jestli chain přijal
- **Žádné pool luck** — expected vs actual shares per block
- **Žádné block broadcast** — mineri neví, že pool našel blok (dostanou jen nový job)
- **Žádné graceful shutdown** — ctrlc nastaví flag, ale aktivní session se neuzavřou korektně
- **Žádné connection rate limit** — pouze `max_sessions_per_ip`, ne `connects/sec`
- **Single binary** — pool + metrics + payouts v jednom procesu, crash payouts → crash pool

---

## 3. Implementační plán — fáze

> **Pravidlo:** Každá fáze musí končit **deploy na Edge + ověření že existující 2 mineri stále fungují**. Žádné big-bang rewritety — inkrementální migrace.

### Fáze 1: Operabilita (1–2 dny) — P0

> **Cíl:** Pool se stává operovatelný — structured logging, atomic PPLNS persistenci, správné stats.

| ID | Task | Soubor | Priorita |
|----|------|--------|----------|
| F1.1 | Migrace `println!` → `tracing` crate s levels (INFO/WARN/ERROR) | `server.rs` (all) | P0 |
| F1.2 | JSON file atomic write (`write_to_tmp + rename`) | `pplns.rs` | P0 |
| F1.3 | PPLNS save interval 10s → 5s + save-on-block-found | `server.rs:1169` | P0 |
| F1.4 | Fix `/stats` auxpow display — číst z MultiAuxPowBridge, ne standalone scheduler | `server.rs:5798` | P0 |
| F1.5 | Orphan block monitoring — po submit pollovat `getblock` 10 bloků, označit orphan | `server.rs` (new) | P0 |
| F1.6 | Pool luck tracking — expected_shares vs actual_shares per block | `pplns.rs` (new) | P1 |
| F1.7 | Graceful shutdown — ctrlc → uzavřít listener, počkat 30s na session drain | `server.rs:1298` | P1 |

**Dodávka:** `tracing-subscriber` už je v `Cargo.toml`. Žádné nové deps pro F1.2–F1.7.

### Fáze 2: Stratum v1 protokol (3–5 dní) — P0 pro veřejný launch

> **Cíl:** Externí mineri (ccminer, xmrig, lolminer, trex, bzminer) se mohou připojit bez našeho klienta.

| ID | Task | Soubor | Priorita |
|----|------|--------|----------|
| F2.1 | `StratumV1Codec` — parser `mining.subscribe`/`authorize`/`submit`/`notify` | `src/stratum_v1.rs` (new) | P0 |
| F2.2 | `StratumV1Session` — mapování Stratum job_id ↔ ZION job_id, extranonce1 | `src/stratum_v1.rs` (new) | P0 |
| F2.3 | Multi-protocol listener — detekce protokolu na prvním řádku (JSON-RPC vs zion-v3) | `server.rs:1593` | P0 |
| F2.4 | Anonymous mining — username = `WALLET.worker` (jako 2miners), žádný Hello | `stratum_v1.rs` | P0 |
| F2.5 | Long-poll endpoint — `/LP` HTTP, drží request 60s nebo do new template | `server.rs:5495` | P1 |
| F2.6 | Stratum v1 vardiff — `mining.suggest_difficulty` + `mining.set_difficulty` | `stratum_v1.rs` | P1 |
| F2.7 | Test: `stratum-proxy` / `cpuminer` se připojí a přijme share | `tests/` (new) | P0 |

**Dodávka:** Žádné nové crate deps (JSON-RPC je jen JSON). Extranonce1 = session_id hex.

**Riziko:** Naše `deeksha_lite_v1` algoritmus není žádný standardní Stratum algoritmus. Externí mineri ho neumí. **Řešení:** Stratum v1 listener bude podporovat **pouze AuxPow stream** (VRSC, KAS, ALPH, atd.) — mineri se připojí pro merge mining externích coinů, ZION zůstává na custom protokolu pro vlastní `zion-miner`. To je paritní s Braiins (Stratum v2 pro BTC, custom pro merge-mined coin).

### Fáze 3: Async I/O migrace (5–7 dní) — P1

> **Cíl:** Pool škáluje na 10 000+ minerů. **Největší riziko — musí se udělat inkrementálně.**

| ID | Task | Soubor | Priorita |
|----|------|--------|----------|
| F3.1 | `tokio` runtime pro accept loop + session handling | `server.rs:806` | P0 |
| F3.2 | `tokio::net::TcpListener` + `tokio::io::AsyncBufRead` | `server.rs:1611` | P0 |
| F3.3 | `tokio::sync::Mutex` pro PPLNS, telemetry, routing_stats | all `Arc<Mutex<>>` | P0 |
| F3.4 | `tokio::sync::RwLock` pro read-heavy struktury (template_cache, telemetry) | `server.rs:876` | P1 |
| F3.5 | Connection rate limiter (`tower::limit` nebo custom token bucket) | `server.rs:1611` | P1 |
| F3.6 | Share rate limiter per-session (token bucket, default 10 shares/s) | `handle_client` | P1 |
| F3.7 | Benchmark: 10 000 konexí přes `tokio` load test | `examples/` (new) | P0 |

**Riziko:** `handle_client` je 1 560 řádků synchronního kódu s blokujícím I/O. Migrace na async vyžaduje přepsání celé funkce. **Mitigace:** Nejdřív async accept loop, `handle_client` zůstává sync ale běží na `tokio::task::spawn_blocking`. Plně async až v F3.3.

### Fáze 4: Database backend (3–5 dní) — P1

> **Cíl:** Share log, payout historie, miner stats queryable. Konec JSON souboru.

| ID | Task | Soubor | Priorita |
|----|------|--------|----------|
| F4.1 | `sqlx` dep (PostgreSQL, `runtime-tokio-rustls`) | `Cargo.toml` | P0 |
| F4.2 | Schema: `shares`, `payouts`, `blocks`, `miners`, `worker_stats` | `migrations/` (new) | P0 |
| F4.3 | `ShareStore` trait — `record_share()`, `query_shares()`, `share_count_window()` | `src/store.rs` (new) | P0 |
| F4.4 | Migrace PPLNS window z in-memory `VecDeque` → DB-backed (with in-memory cache) | `pplns.rs` | P0 |
| F4.5 | Payout historie → DB (TX ID, height, confirmations) | `server.rs:8663` | P1 |
| F4.6 | Block historie → DB (height, hash, miner, orphan?, confirmations) | `server.rs` (new) | P1 |
| F4.7 | Migration script: `pplns-state.json` → PostgreSQL | `scripts/` (new) | P0 |
| F4.8 | SQLite fallback pro single-node deploy (feature flag `sqlite`) | `Cargo.toml` | P2 |

**Dodávka:** PostgreSQL už běží na Edge pro dashboard. Nové deps: `sqlx`, `refinery` (migrace).

**Riziko:** PPLNS window je nyní in-memory `VecDeque` s u32 indexy (P7-P10 optimalizace). DB-backed znamená `SELECT ... ORDER BY timestamp DESC LIMIT N` na každý share — pomalé. **Mitigace:** In-memory cache + DB jen pro persistenci (write-through, ne read-through).

### Fáze 5: TLS stratum + multi-port (2–3 dny) — P1

> **Cíl:** TLS port pro minery za DPI/firewally. Multi-port difficulty stratification.

| ID | Task | Soubor | Priorita |
|----|------|--------|----------|
| F5.1 | TLS stratum listener (`tokio-rustls` + Let's Encrypt cert) | `server.rs` (new) | P0 |
| F5.2 | Multi-port: 8444 (low diff, CPU), 8445 (mid diff, GPU), 8446 (high diff, ASIC/farm) | `ServerConfig` | P1 |
| F5.3 | Per-port vardiff defaults + per-port min/max difficulty | `ServerConfig` | P1 |
| F5.4 | nginx TCP stream proxy pro TLS termination (alternativa k app-level TLS) | `edge-deploy/` | P2 |
| F5.5 | Stratum v1 over TLS (`stratum+ssl://` URL) | `stratum_v1.rs` | P0 |

**Dodávka:** Let's Encrypt cert už existuje na Edge (`/etc/letsencrypt/live/zionterranova.com/`). `tokio-rustls` už je v deps přes `reqwest`.

### Fáze 6: Push block template subscription (2 dny) — P1

> **Cíl:** Nový template do 100 ms po bloku na chainu (nyní 3 s polling).

| ID | Task | Soubor | Priorita |
|----|------|--------|----------|
| F6.1 | WebSocket subscription na node RPC (`subscribe_block_template`) | `V3/L1/core` (new RPC method) | P0 |
| F6.2 | `TemplateSubscriber` — tokio task, push do `template_cache` | `server.rs:876` | P0 |
| F6.3 | Fallback: polling 3s pokud WS nedostupný | `server.rs` | P0 |
| F6.4 | Broadcast `mining.notify` všem mineri na new template (Stratum v1) | `stratum_v1.rs` | P0 |
| F6.5 | Broadcast `Job` všem mineri na new template (zion-v3 protokol) | `server.rs` | P1 |

**Riziko:** Node (`V3/L1/core`) musí podporovat WS push. Pokud ne, fallback na 1s polling (z 3s na 1s = 3x lepší).

### Fáze 7: REST API + auth + Grafana (2–3 dny) — P2

> **Cíl:** Miner API s autentizací, Grafana dashboard pro pool ops.

| ID | Task | Soubor | Priorita |
|----|------|--------|----------|
| F7.1 | API key auth (`Authorization: Bearer <key>`) pro `/api/v1/miner/:address/*` | `server.rs:6238` | P1 |
| F7.2 | Nové endpoints: `/api/v1/miner/:address/hashrate-history`, `/blocks`, `/payouts` | `server.rs` (new) | P1 |
| F7.3 | ✅ Pool op API: `/api/v1/op/miners`, `/op/blocks`, `/op/revenue` (admin key) | `server.rs` (new) | P2 ✅ |
| F7.4 | ✅ Grafana dashboard JSON — pool hashrate, miners, blocks, luck, payouts | `grafana/` (new) | P2 ✅ |
| F7.5 | Prometheus metrics rozšířit: pool_luck, orphan_rate, share_rate, conn_rate | `server.rs:5692` | P1 |
| F7.6 | ✅ OpenAPI spec (statický JSON, bez utoipa dep) | `V3/L1/pool/openapi.json` | P2 ✅ |

### Fáze 8: Notifications + monitoring (1–2 dny) — P2

> **Cíl:** Pool ops dostává alert na problém. Mineri dostávají notifikaci o payoutu.

| ID | Task | Soubor | Priorita |
|----|------|--------|----------|
| F8.1 | ✅ Telegram bot alert: pool down, accept_rate < 95%, orphan block, payout fail | `server.rs` (TelegramNotifier) | P2 ✅ |
| F8.2 | ✅ Email notifikace minerovi o payoutu (SMTP, opt-in) | `server.rs` (SmtpNotifier) | P2 ✅ |
| F8.3 | Webhook na block found (pro dashboard real-time update) | `server.rs` | P2 |
| F8.4 | Health check endpoint `/health` pro watchdog | `server.rs:5495` | P1 |

### Fáze 9: HA + failover (5+ dní) — P3 (post-public-launch)

> **Cíl:** Pool přežije výpadek Edge serveru. Multi-region stratum.

| ID | Task | Soubor | Priorita |
|----|------|--------|----------|
| F9.1 | Active-passive: backup pool na druhém serveru, hot standby | `edge-deploy/` | P3 |
| F9.2 | DNS failover (Cloudflare) — `pool.zionterranova.com` → backup IP | DNS | P3 |
| F9.3 | Share relay Edge → Core (již implementováno `ShareRelay` messsage) | `server.rs:2216` | P3 |
| F9.4 | Multi-region stratum: EU + US + ASIA endpoints, anycast | infra | P3 |
| F9.5 | PostgreSQL replication Edge → backup | infra | P3 |

---

## 4. Pořadí implementace a závislosti

```
Fáze 1 (Operabilita) ──┐
                       ├─→ Fáze 3 (Async I/O) ──→ Fáze 4 (DB) ──→ Fáze 9 (HA)
Fáze 2 (Stratum v1) ──┤                    │
                       ├─→ Fáze 5 (TLS) ───┤
                       │                  │
                       └─→ Fáze 6 (Push) ─┤
                                          │
                              Fáze 7 (API) ┤
                                          │
                              Fáze 8 (Notify) ┘
```

**Kritická cesta:** F1 → F2 → F3 → F4 (pro veřejný launch 2026-12-31)
**Paralelizovatelné:** F5, F6, F7, F8 (po F3)

## 5. Nové závislosti (Cargo.toml)

```toml
# Fáze 1 — žádné nové (tracing-subscriber již je)

# Fáze 2 — žádné nové (JSON-RPC je JSON)

# Fáze 3 — tokio už je (features doplnit: "rt-multi-thread" již je)
tower = { version = "0.5", features = ["limit"] }  # F3.5 rate limiter

# Fáze 4
sqlx = { version = "0.8", features = ["postgres", "runtime-tokio-rustls", "macros", "migrate"] }
refinery = { version = "0.8", features = ["tokio-postgres"] }  # alternativně sqlx migrate

# Fáze 5
tokio-rustls = "0.26"  # TLS stratum

# Fáze 7
utoipa = { version = "5", features = ["axum"] }  # OpenAPI (volitelné)

# Fáze 8
teloxide = { version = "0.13", default-features = false, features = ["rustls"] }  # Telegram bot
lettre = { version = "0.11", default-features = false, features = ["rustls-tls", "smtp"] }  # email
```

## 6. Konfigurace — nové env vars

```bash
# Fáze 1
ZION_POOL_LOG_LEVEL=info              # trace|debug|info|warn|error
ZION_POOL_PPLNS_SAVE_INTERVAL_S=5     # (nyní 10)
ZION_POOL_ORPHAN_CHECK_BLOCKS=10      # kolik bloků pollovat pro orphan detekci

# Fáze 2
ZION_POOL_STRATUM_V1_ENABLED=1        # zapne Stratum v1 listener na stejném portu
ZION_POOL_STRATUM_V1_ANON=1           # anonymous mining (wallet.workername jako username)

# Fáze 3
ZION_POOL_MAX_CONNECTIONS=10000       # hard limit spojení
ZION_POOL_CONN_RATE_LIMIT=100         # nové spojení/s
ZION_POOL_SHARE_RATE_LIMIT=10         # shares/s per session

# Fáze 4
ZION_POOL_DB_URL=postgres://zion:***@127.0.0.1/zion_pool
ZION_POOL_DB_MAX_CONNECTIONS=20

# Fáze 5
ZION_POOL_TLS_BIND=0.0.0.0:8443       # TLS stratum port
ZION_POOL_TLS_CERT=/etc/letsencrypt/live/zionterranova.com/fullchain.pem
ZION_POOL_TLS_KEY=/etc/letsencrypt/live/zionterranova.com/privkey.pem
ZION_POOL_PORT_LOW_DIFF=8444          # CPU mineri
ZION_POOL_PORT_MID_DIFF=8445          # GPU mineri
ZION_POOL_PORT_HIGH_DIFF=8446         # farmy/ASIC

# Fáze 6
ZION_POOL_TEMPLATE_PUSH=1             # WS push subscription
ZION_POOL_TEMPLATE_POLL_FALLBACK=1    # fallback na polling

# Fáze 7
ZION_POOL_API_ADMIN_KEY=<secret>      # admin API key
ZION_POOL_API_MINER_KEY=<secret>      # miner API key (nebo per-miner)

# Fáze 8
ZION_POOL_TELEGRAM_BOT_TOKEN=<token>
ZION_POOL_TELEGRAM_CHAT_ID=<chat_id>
ZION_POOL_SMTP_URL=smtp://...
```

## 7. Test plán

| Fáze | Test | Jak |
|------|------|-----|
| F1 | PPLNS crash recovery | Kill -9 pool, restart, ověřit unpaid balance |
| F2 | Stratum v1 E2E | `stratum-proxy` → pool, submit share, ověřit accept |
| F3 | 10k connections | `tokio` load test script, 10k idle conns, ověřit RAM < 1GB |
| F4 | DB migration | `pplns-state.json` → PostgreSQL, ověřit unpaid balance shodný |
| F5 | TLS stratum | `openssl s_client -connect pool:8443`, ověřit cert + handshake |
| F6 | Push template | Mine blok na node, ověřit < 200ms do pool.notify |
| F7 | API auth | `curl -H "Authorization: Bearer wrong"`, ověřit 401 |
| F8 | Telegram alert | Stop pool, ověřit alert do Telegramu |

## 8. Rizika a mitigace

| Riziko | Pravděpodobnost | Dopad | Mitigace |
|--------|----------------|-------|----------|
| F3 async migrace rozbije existující mineri | Střední | Vysoký | Inkrementální: spawn_blocking nejdřív, plně async až po ověření |
| F4 DB migrace ztratí PPLNS state | Nízká | Vysoký | Backup JSON před migrací, rollback script, paralelní běh 24h |
| F2 Stratum v1 nepodporuje deeksha_lite_v1 | Jisté | Střední | Stratum v1 jen pro AuxPow stream, ZION zůstává na custom protokolu |
| F6 Node nepodporuje WS push | Střední | Nízký | Fallback na 1s polling (3x zlepšení oproti 3s) |
| F5 TLS cert renewal rozbije pool | Nízká | Vysoký | Cert reload bez restartu (`tokio-rustls` hot reload) |
| Současný 9 314-řádkový `server.rs` je neudržovatelný | Jisté | Střední | Fáze 3 = příležitost rozdělit na moduly (`session.rs`, `accept.rs`, `payout.rs`) |

## 9. Co NENÍ v tomto plánu

- **Stratum v2 (SRI/Braiins)** — příliš brzy, BTC komunita ho sama teprv adoptuje. Fáze 2 (Stratum v1) je dostatečná pro veřejný launch.
- **PPS+ / SOLO payout scheme** — PPLNS je dostatečné pro Mainnet Beta. PPS+ až při 1 000+ minerech (potřebuje pool hash reserve).
- **True AuxPoW consensus (merge mining)** — R8 v StatusV3.md, future. Současný "share forwarding" je OK pro Beta.
- **Vlastní pool frontend (web UI)** — `dashboard.zionterranova.com` již existuje. Grafana (F7.4) pro pool ops.
- **Multi-coin payout v ZION** — externí coiny platí upstream pool přímo do BTC wallet. ZION payouty jen pro ZION bloky.

## 10. Časový odhad

| Fáze | Odhad | Kritická cesta? |
|------|-------|-----------------|
| F1 Operabilita | 1–2 dny | Ano |
| F2 Stratum v1 | 3–5 dní | Ano |
| F3 Async I/O | 5–7 dní | Ano |
| F4 Database | 3–5 dní | Ano |
| F5 TLS + multi-port | 2–3 dny | Ne (paralelně s F4) |
| F6 Push template | 2 dny | Ne (paralelně s F4) |
| F7 API + Grafana | 2–3 dny | Ne (po F4) |
| F8 Notifications | 1–2 dny | Ne (po F7) |
| F9 HA + failover | 5+ dní | Ne (post-launch) |
| **Celkem (kritická cesta)** | **14–21 dní** | |

> **Poznámka k odhadům:** Per AGENTS.md nebudu dávat konkrétní časové odhady pro dokončení. Výše uvedené jsou relativní velikosti fází, ne závazné termíny. Implementuji co nejrychleji, ale kvalita > rychlost.

## 11. Úspěšné kritéria

Po implementaci F1–F6 (před veřejným launchem 2026-12-31):

- [ ] Pool běží 30 dní bez restartu, žádný lock poisoning
- [ ] PPLNS state přežije `kill -9` bez ztráty (> 5s starých) shares
- [ ] Externí miner (ccminer/xmrig) se připojí přes Stratum v1 a přijímá shares
- [ ] TLS stratum port funguje s `stratum+ssl://`
- [ ] 10 000 simulovaných spojení → RAM < 1 GB, CPU < 50 %
- [ ] Nový block template dorazí k minerům do 200 ms
- [ ] `/stats` ukazuje správné auxpow stats (multi-bridge, ne standalone scheduler)
- [ ] Orphan block detekován do 10 bloků
- [ ] Pool luck tracking v Grafaně
- [ ] Structured logs s levels, žádné `println!`

---

## 12. Reference

- Současný pool kód: `V3/L1/pool/src/bin/server.rs` (9 314 řádků), `src/pplns.rs` (1 604), `src/lib.rs` (1 424)
- Status: `StatusV3.md` §6 (Pool config), §5 (AuxPow), §8 (milestones 07-21)
- AuxPow integration: `AuXpow/` crate, `MultiAuxPowBridge` v `server.rs:4217`
- Edge deploy: `/etc/zion/edge-environment.sh`, `zion-edge-pool.service`
- Stratum v1 spec: https://en.bitcoin.it/wiki/Stratum_mining_protocol
- Stratum v2 (SRI): https://stratumprotocol.org/
- Braiins pool (reference impl): https://github.com/braiins/braiins-pool
- 2miners architecture: https://github.com/2miners/stratum-proxy

---

**Další krok:** Začít implementací **Fáze 1** (Operabilita) — `tracing` migrace + atomic PPLNS persistenci + stats fix. To je nejnižší riziko a nejvyšší okamžitá hodnota.
