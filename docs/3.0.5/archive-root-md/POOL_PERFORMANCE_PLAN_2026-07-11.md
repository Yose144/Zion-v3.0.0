# Pool Performance Plan — 1000-Miner Scale (2026-07-11)

## Současný stav

Pool server běží na Edge serveru (`62.171.141.136`, 4× AMD EPYC, 7.8 GB RAM).
Aktuálně obsluhuje ~18 minerů. Cíl: **1000+ souběžných minerů** bez degradace.

## Audit — identifikované bottlenecks

### B1: Thread-per-connection bez reaping (Kritické)

**Lokace:** `server.rs:465-546`

```rust
let mut handles = Vec::new();
// ...
handles.push(thread::spawn(move || { handle_client(...) }));
```

- Každý miner dostává vlastní OS thread (`thread::spawn`)
- `handles` Vec roste neomezeně — thread handles se nikdy nereapují
- Po 1000 disconnect/connect cyklech je 1000 mrtvých handle entries v paměti
- Default thread stack = 8MB → 1000 threadů = 8GB virtual memory

**Řešení:** Reap finished handles v accept loopu (stejně jako node už dělá pro RPC handles).

### B2: `pool` Mutex — 6+ lock acquisitions per share (Kritické)

**Lokace:** `server.rs:834, 872, 980, 1176, 1397, 1411`

Každý share submission lockuje `pool` mutex 6x:
1. `expire_stale_jobs()` — iteruje `active_jobs` HashMap
2. `issue_job_from_template()` — insert do `active_jobs`
3. `is_job_stale()` — read z `active_jobs`
4. `record_accepted_share()` / `record_rejected_share()`
5. `stale_message()` / `cancel_message()`
6. `result_message()`

S 1000 minery @ ~10 shares/sec = ~10,000 lock acquisitions/sec na `pool` mutex.

**Řešení:**
- `accepted_shares` / `rejected_shares` / `stale_shares` → `AtomicU64` (žádný mutex pro countery)
- `active_jobs` → per-session (každý session má svůj job, nepotřebuje globální HashMap)
- `expire_stale_jobs` → per-session (každý session expiruje vlastní job)

### B3: Synchronous `println!` logging (Vysoké)

**Lokace:** `server.rs` — ~10 `println!` per share submission

Stdout je line-buffered → každý `println!` flushuje. S 1000 minery:
- ~10 shares/sec × 10 println/share = 100,000 println/sec
- Každý println = syscall (write) + kernel buffer flush

**Řešení:** Batched log channel — log messages se posílají do mpsc channel, background thread je batchuje a zapisuje.

### B4: PPLNS persistence blokuje mutex (Střední)

**Lokace:** `server.rs:367-373`, `pplns.rs:241-251`

```rust
let pplns = pplns_ref.lock().expect("pplns lock poisoned");
pplns.save_to_path(&state_path);  // serializes + writes to disk WHILE HOLDING LOCK
```

`save_to_path` serializuje celý PPLNS state (window + HashMaps) do JSON a zapisuje na disk — vše pod zámkem. S 1000 minery a 500K shares v okně může JSON být desítky MB.

**Řešení:** Snapshot pod zámkem (rychlé clone), serializace + I/O mimo zámek.

### B5: Payout execution blokuje miner thread (Vysoké)

**Lokace:** `server.rs:1284-1363`

Když miner najde blok, `execute_pool_payout` se volá synchronně v miner threadu:
- Iteruje všechny payouts (12+ minerů)
- Pro každého volá `submit_account_transaction` (synchronní RPC na node)
- 12 RPC calls × ~50ms = ~600ms blokace miner threadu
- S 1000 minery: 1000 payouts × 50ms = 50 sekund blokace!

**Řešení:** Payout execution v background threadu — miner thread jen zaznamená block found a pokračuje.

### B6: Metrics endpoint lockuje 3 mutexy najednou (Střední)

**Lokace:** `server.rs:2572-2577`

```rust
let stats = routing_stats.lock();
let telemetry = miner_telemetry.lock();
let pplns = pplns_engine.lock();
```

Dashboard polling každých pár sekund zablokuje všechny minery během snapshotu.

**Řešení:** Pořadí lockování vždy stejné (deadlock prevence), try_lock s fallback na stale data.

### B7: PPLNS `distribute_to_miners` O(n) (Nízké)

**Lokace:** `pplns.rs:465-533`

Iteruje celý window (až 500K shares) pro výpočet payoutů. Voláno jen při block found (sekundy mezi bloky), takže není na hot path. S 1000 minery bude `share_weights` HashMap mít 1000 entries — stále rychlé.

**Řešení:** Prozatím OK. Pokud se window zvětší nad 1M, přejít na inkrementální weight tracking.

## Implementační plán

### Fáze 1: Thread handle reaping (B1)
- V accept loopu: `handles.retain(|h| !h.is_finished())` při každém accept iteraci
- Omezení: max 2000 handles (bezpečnostní limit)

### Fáze 2: Atomic share counters (B2)
- `MiningPool`: `accepted_shares`, `rejected_shares`, `stale_shares` → `AtomicU64`
- Odstraní 2 lock acquisitions per share (record_accepted/rejected_share)
- `bye_message` a `stats` čtou z AtomicU64 bez locku

### Fáze 3: Per-session job tracking (B2)
- `active_jobs` z `MiningPool` → per-session lokální proměnná
- `expire_stale_jobs` → per-session (miner expiruje vlastní job)
- `is_job_stale` → per-session
- Odstraní 3 lock acquisitions per share
- `MiningPool` se tak stane téměř lock-free na share path

### Fáze 4: Batched logging (B3)
- `LogSender` mpsc channel s background thread
- `log_line(msg)` → `tx.send(msg)` (non-blocking, try_send)
- Background thread: batchuje 100 lines nebo flush každých 100ms
- `println!` na hot path → `log_line!` makro

### Fáze 5: Async payout execution (B5)
- `execute_pool_payout` se volá v `thread::spawn`
- Miner thread: record block found → spawn payout thread → pokračuje
- Payout thread: compute payouts → execute → update telemetry
- PPLNS rollback se děje v payout threadu při selhání

### Fáze 6: PPLNS persistence optimization (B4)
- `save_to_path`: snapshot (clone) pod zámkem, serializace + write mimo zámek
- Nebo: `snapshot()` pod zámkem → `serde_json::to_vec` + `fs::write` mimo zámek

## Očekávaný dopad

| Bottleneck | Před | Po | Zlepšení |
|-----------|------|-----|----------|
| Thread handles | Unbounded growth | Reaped every accept | O(1) memory |
| Pool mutex locks/share | 6 | 1 (jen issue_job) | 83% reduction |
| Logging I/O | 100K syscalls/sec | 1K batched writes/sec | 99% reduction |
| Payout latency | 600ms-50s blocking | 0ms (async) | 100% reduction |
| PPLNS save | Lock held during I/O | Lock held only for clone | 90% reduction |

## Testování

- `cargo test -p zion-pool` — existující testy musí projít
- Nový test: 1000 simulovaných sessions se share submission
- Deploy na Edge server + monitorování s 18 reálnými minery
- Postupné škálování: 100 → 500 → 1000 minerů
