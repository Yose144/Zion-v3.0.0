# ZION Revenue System — Robustní produkční verze

> **Verze:** 1.0  
> **Status:** Implementace v průběhu  
> **Cíl:** Odstranit 6 kritických slabin identifikovaných v audit revenue systému.

---

## 1. Původní slabiny a jejich řešení

| # | Slabina | Dopad | Řešení | Soubor(y) |
|---|---------|-------|--------|-----------|
| 1 | In-memory only — ztráta po restartu | Zmizí earnings, fees, block count | **Persistovaný RevenueJournal** (append-only JSON Lines, rotace) | `revenue_journal.rs` |
| 2 | Nezohledňuje protocol fee split 89/5/5/1 | Nesoulad s on-chain coinbase | **Rozšířit `track_zion_block`** o 4-way split + audit trail | `revenue.rs` |
| 3 | Žádný audit trail (timestamp, height, tx) | Nemožné řešit dispute, rekonstruovat historii | **Rozšířit `RevenueEvent`** o `timestamp`, `block_height`, `tx_hash` | `revenue.rs` |
| 4 | Chybí idempotence guard | Dvojí započítání stejného bloku při retry | **`seen_heights: HashSet<u64>`** v `RevenueCollector` | `revenue.rs` |
| 5 | Externí streamy bez health monitoringu | Blind spot na DCR/ALPH stratum outage | **`RevenueHealth`** per source + circuit breaker logika | `revenue.rs` |
| 6 | RevenueSnapshot neobsahuje split detaily | Operator nevidí, kam peníze jdou | **Rozšířit `RevenueSnapshot`** o split pole | `zion-core/lib.rs` |

---

## 2. Architektura po vylepšení

```
┌─────────────────────────────────────────────────────────────┐
│  Pool Server (zion-pool)                                    │
│                                                             │
│  ┌──────────────┐      ┌──────────────────────────────┐     │
│  │ RevenueScheduler│    │ RevenueCollector            │     │
│  │ (50/25/25)    │───▶│  ┌──────────────────────┐  │     │
│  └──────────────┘      │  │ RevenueJournal       │  │     │
│                        │  │ (append-only JSONL)   │  │     │
│  ┌──────────────┐      │  └──────────────────────┘  │     │
│  │ RevenueHealth │───▶│  ┌──────────────────────┐  │     │
│  │ per source    │      │  │ seen_heights: HashSet│  │     │
│  └──────────────┘      │  └──────────────────────┘  │     │
│                        │  ┌──────────────────────┐  │     │
│  On-chain submit  ────▶│  │ track_zion_block()   │  │     │
│  (block found)         │  │ 89/5/5/1 split       │  │     │
│                        │  └──────────────────────┘  │     │
│                        └──────────────────────────────┘     │
│                              │                              │
│                              ▼                              │
│                        ┌──────────────┐                    │
│                        │ RevenueSnapshot│                   │
│                        │ (RPC response)│                   │
│                        └──────────────┘                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Detailní změny

### 3.1 RevenueJournal — persistovaný audit log

- **Format:** JSON Lines (`.jsonl`), jeden objekt = jedna revenue akce.
- **Path:** `ZION_REVENUE_JOURNAL_DIR` (default `./data/revenue_journal/`).
- **Rotace:** Denní soubory `revenue_YYYY-MM-DD.jsonl`, zachováno 90 dní.
- **Atomický zápis:** `write + flush + sync` per entry. Při crashu je maximálně 1 entry poškozená (ignorována při replay).
- **Replay při startu:** Načte všechny `.jsonl` soubory, rekonstruuje `RevenueStats` + `seen_heights`.
- **Struktura entry:**
  ```json
  {"ts":"2026-05-14T16:11:00Z","type":"zion_block","height":42,"subsidy":5400067000000000,"pool_fee":54000670000000,"humanitarian":270003350000000,"issobella":270003350000000,"miner":4806060123300000,"tx_hash":"abc123..."}
  ```

### 3.2 Protocol fee split 89/5/5/1

`track_zion_block(height, subsidy, pool_fee_pct, tx_hash)` nyní dělí:

| Slot | % | Výpočet | Kam jde |
|------|---|---------|---------|
| miner | 89 % | `subsidy * 89 / 100` | `miner_payout_zion` |
| humanitarian | 5 % | `subsidy * 5 / 100` | `humanitarian_zion` |
| issobella | 5 % | `subsidy * 5 / 100` | `issobella_zion` |
| pool | 1 % | `subsidy * 1 / 100` | `zion_fees_zion` |

> **Poznámka:** `pool_fee_pct` zůstává pro konfigurovatelnost, ale default je 1 %. Celková kontrola: `89+5+5+1 = 100`.

### 3.3 Idempotence guard

`RevenueCollector` drží `seen_heights: HashSet<u64>`. Při volání `track_zion_block`:
1. Pokud `height` už je v setu → `return` (nic nezapočítá).
2. Jinak vloží height, provede split, zapíše do journalu.

> Guard platí pro celý životnost instance. Při restartu se replay journalu nepřidává duplicity, protože entry typu `zion_block` obsahuje height.

### 3.4 RevenueHealth — per-source monitoring

```rust
pub struct RevenueHealth {
    pub source: RevenueSource,
    pub last_success_ts: Option<DateTime<Utc>>,
    pub consecutive_failures: u32,
    pub total_events: u64,
    pub circuit_open: bool,
}
```

- Při každém accepted event se resetuje `consecutive_failures` a aktualizuje `last_success_ts`.
- Při rejected / timeout se inkrementuje `consecutive_failures`.
- Když `consecutive_failures > CIRCUIT_BREAKER_THRESHOLD` (default 10), `circuit_open = true` → externí source se dočasně vypne (pool přesměruje do fallback lane).
- Circuit se zavře (obnoví) po `CIRCUIT_BREAKER_RESET_SECS` (default 60 s) od posledního failu nebo ručně.

### 3.5 RevenueSnapshot rozšíření

Nová pole v `zion-core::RevenueSnapshot`:

```rust
pub struct RevenueSnapshot {
    // USD side (unchanged)
    pub total_earnings_usd: f64,
    pub zion_fees_usd: f64,
    pub miner_payout_usd: f64,
    // ZION side — canonical block split
    pub total_zion: u64,
    pub zion_fees_zion: u64,          // pool 1%
    pub humanitarian_zion: u64,       // 5%
    pub issobella_zion: u64,          // 5%
    pub miner_payout_zion: u64,       // 89%
    pub blocks_found: u64,
    // Audit
    pub last_block_height: u64,
    pub last_block_ts: Option<String>, // RFC3339
}
```

---

## 4. Implementační checklist

- [ ] Vytvořit `V3/L1/cosmic-harmony/src/revenue_journal.rs`
- [ ] Rozšířit `V3/L1/cosmic-harmony/src/revenue.rs`:
  - [ ] `RevenueEvent` → timestamp, block_height, tx_hash
  - [ ] `track_zion_block` → 89/5/5/1 split + idempotence
  - [ ] `RevenueHealth` struct + circuit breaker
  - [ ] Integrace `RevenueJournal`
- [ ] Aktualizovat `V3/L1/cosmic-harmony/src/lib.rs` — exporty
- [ ] Rozšířit `V3/L1/core/src/lib.rs` — `RevenueSnapshot` + `From<RevenueStats>`
- [ ] Propojit pool server — `record_zion_block_revenue` s novými parametry
- [ ] `cargo check --manifest-path V3/Cargo.toml -p zion-cosmic-harmony -p zion-core -p zion-pool`
- [ ] `cargo test --manifest-path V3/Cargo.toml -p zion-cosmic-harmony`
- [ ] Commit + push

---

## 5. Operacní poznámky

### Env vars (nové)

| Proměnná | Default | Popis |
|----------|---------|-------|
| `ZION_REVENUE_JOURNAL_DIR` | `./data/revenue_journal` | Cesta k journal složce |
| `ZION_REVENUE_JOURNAL_DAYS` | `90` | Retenční doba `.jsonl` souborů |
| `ZION_REVENUE_CIRCUIT_THRESHOLD` | `10` | Počet failů pro otevření circuit breaker |
| `ZION_REVENUE_CIRCUIT_RESET_SECS` | `60` | Sekundy do resetu circuit breaker |

### Migrace z předchozí verze

1. Starý in-memory `RevenueCollector` neobsahoval journal — po deploy se začne psát nový journal.
2. Při prvním startu se `seen_heights` bude prázdný, takže první nový block se započítá správně.
3. `RevenueSnapshot` má nová pole — starý RPC klient je ignoruje (JSON), nový je použije.
4. **Breaking:** `track_zion_block` signatura se mění (`height: u64` před `subsidy`). Pool `server.rs` musí být aktualizován současně.

---

*Generováno jako součást robustní revenue revize větev `main`.*
