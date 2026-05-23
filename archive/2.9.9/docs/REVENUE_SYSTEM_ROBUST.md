# ZION Revenue System — Robustní produkční verze

> **Verze:** 1.1 (aktualizováno po Deeksha Stream Layers)  
> **Status:** Implementováno — 113 testů pass  
> **Cíl:** Odstranit 6 kritických slabin + integrovat revenue stream telemetry přímo do Deeksha pipeline.

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

## 2. Novinka — Deeksha Stream Layers (v1.1)

### 2.1 Motivace

Historické CHv3 docs (`COSMIC_HARMONY_DEEKSHA_SPEC.md`, `DEEKSHA_EKAM_CONCEPT_BRIDGE.md`) explicitně vyžadují **Rule D — Revenue Dharma Continuity**: zachovat CHv3 revenue funkčnost a integrovat ji do Deeksha pipeline. Dosud byly revenue streamy (ZION, KeccakBonus, Sha3Bonus, NclAi) řízeny jen pool schedulery — hashovací pipeline o nich nevěděla.

**Deeksha Stream Layers** přinášejí revenue-aware telemetry přímo do každého kroku pipeline, **bez doteku konsenzu**.

### 2.2 Architektura

```
┌─────────────────────────────────────────────────────────────────┐
│  Deeksha Pipeline (konsenzus — NEZMĚNĚN)                       │
│                                                                 │
│  Input → Keccak256 → SHA3-512 → GoldenMatrix → MemoryHard     │
│            │            │              │              │         │
│            ▼            ▼              ▼              ▼         │
│         [Keccak    [SHA3        [ZION       [ZION            │
│          Bonus]      Bonus]        Main]      Core]           │
│                                                                 │
│  → NPU Mix → CosmicFusion → Hash32                              │
│       │            │                                            │
│       ▼            ▼                                            │
│    [NCL AI]     [ZION Final]                                    │
│                                                                 │
│  Side-channel telemetry (stream_layers.rs) — additive only     │
└─────────────────────────────────────────────────────────────────┘
```

### 2.3 Konsenzusní bezpečnost

| Garance | Jak je splněna |
|---------|---------------|
| Hash output se nemění | `with_streams` funkce volají **stejné** step funkce jako canonical verze |
| Zero breaking change | Původní `cosmic_harmony_ekam_deeksha_v2()` je **100% beze změny** |
| Testovatelnost | Parity testy `with_streams_produces_same_hash_as_v2` pro každý build |
| Žádný performance hit na default path | `with_streams` je **opt-in wrapper**; miner/pool si volá, co potřebuje |

### 2.4 Work-unit model

Celková pipeline = 100 work unitů, rozděleno podle skutečné náročnosti:

| Step | Work units | Stream | Důvod |
|------|-----------|--------|-------|
| Keccak256 | 5 | KeccakBonus | Lehký hash |
| SHA3-512 | 5 | Sha3Bonus | Lehký hash |
| GoldenMatrix | 10 | ZION | Matrix transform |
| MemoryHard | 55 | ZION | ASIC-resistant core (nejtěžší) |
| NPU Mix | 15 | NclAi | AI compute layer |
| CosmicFusion | 10 | ZION | Finalizace |

> **ZION celkem: 75 %** (GoldenMatrix + MemoryHard + CosmicFusion)  
> **NCL AI: 15 %**  
> **Keccak byproduct: 5 %**  
> **SHA3 byproduct: 5 %**

### 2.5 API

```rust
// Compute hash + collect telemetry
let (hash, telemetry) = cosmic_harmony_ekam_deeksha_v2_with_streams(
    header, nonce, height
);

// Use telemetry for granular revenue tracking
collector.track_deeksha_streams(&telemetry, value_usd, Some(height));

// Query per-stream percentage
let zion_pct = telemetry.pct_for(RevenueSource::Zion);  // 75.0
let ncl_pct = telemetry.pct_for(RevenueSource::NclAi);  // 15.0
```

---

## 3. Architektura celého systému

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
│  ┌──────────────────┐  │  │ track_zion_block()   │  │     │
│  │ DeekshaStream    │  │  │ 89/5/5/1 split       │  │     │
│  │ Telemetry (opt)  │──▶│  └──────────────────────┘  │     │
│  └──────────────────┘  │  ┌──────────────────────┐  │     │
│                        │  │ track_deeksha_streams│  │     │
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

## 4. Detailní změny

### 4.1 RevenueJournal — persistovaný audit log

- **Format:** JSON Lines (`.jsonl`), jeden objekt = jedna revenue akce.
- **Path:** `ZION_REVENUE_JOURNAL_DIR` (default `./data/revenue_journal/`).
- **Rotace:** Denní soubory `revenue_YYYY-MM-DD.jsonl`, zachováno 90 dní.
- **Atomický zápis:** `write + flush + sync` per entry.
- **Struktura entry:**
  ```json
  {"ts":"2026-05-14T16:11:00Z","type":"zion_block","height":42,"subsidy":5400067000000000,"pool_fee":54000670000000,"humanitarian":270003350000000,"issobella":270003350000000,"miner":4806060123300000,"tx_hash":"abc123..."}
  ```

### 4.2 Protocol fee split 89/5/5/1

`track_zion_block(height, subsidy, pool_fee_pct, tx_hash)` nyní dělí:

| Slot | % | Výpočet | Kam jde |
|------|---|---------|---------|
| miner | 89 % | `subsidy * 89 / 100` | `miner_payout_zion` |
| humanitarian | 5 % | `subsidy * 5 / 100` | `humanitarian_zion` |
| issobella | 5 % | `subsidy * 5 / 100` | `issobella_zion` |
| pool | 1 % | `subsidy * 1 / 100` | `zion_fees_zion` |

### 4.3 Idempotence guard

`RevenueCollector` drží `seen_heights: HashSet<u64>`. Duplicitní height = ignored.

### 4.4 RevenueHealth

Circuit breaker: 10 consecutive failures → open, reset po 60 s.

### 4.5 RevenueSnapshot rozšíření

Nová pole: `humanitarian_zion`, `issobella_zion`, `last_block_height`, `last_block_ts`.

### 4.6 DeekshaStreamTelemetry

- `DeekshaStep` enum pro 6 pipeline kroků
- `work_units()` — relativní váha náročnosti
- `revenue_stream()` — mapování na `RevenueSource`
- `pct_for(source)` — procento celkové práce
- `stream_breakdown: HashMap<String, u64>` — agregace

---

## 5. Implementační checklist

- [x] Vytvořit `V3/L1/cosmic-harmony/src/revenue_journal.rs`
- [x] Rozšířit `V3/L1/cosmic-harmony/src/revenue.rs`:
  - [x] `RevenueEvent` → timestamp, block_height, tx_hash
  - [x] `track_zion_block` → 89/5/5/1 split + idempotence
  - [x] `RevenueHealth` struct + circuit breaker
  - [x] `track_deeksha_streams` → granularní allocation
  - [x] Integrace `RevenueJournal`
- [x] Aktualizovat `V3/L1/cosmic-harmony/src/lib.rs` — exporty
- [x] Vytvořit `V3/L1/cosmic-harmony/src/stream_layers.rs` — Deeksha Stream Layers
- [x] Rozšířit `V3/L1/core/src/lib.rs` — `RevenueSnapshot` + `From<RevenueStats>`
- [x] Propojit pool server — `record_zion_block_revenue` s novými parametry
- [x] `cargo check --manifest-path V3/Cargo.toml -p zion-cosmic-harmony -p zion-core -p zion-pool`
- [x] `cargo test --manifest-path V3/Cargo.toml -p zion-cosmic-harmony` — **113/113 pass**
- [x] Commit + push

---

## 6. Operacní poznámky

### Env vars (nové)

| Proměnná | Default | Popis |
|----------|---------|-------|
| `ZION_REVENUE_JOURNAL_DIR` | `./data/revenue_journal` | Cesta k journal složce |
| `ZION_REVENUE_JOURNAL_DAYS` | `90` | Retenční doba `.jsonl` souborů |
| `ZION_REVENUE_CIRCUIT_THRESHOLD` | `10` | Počet failů pro otevření circuit breaker |
| `ZION_REVENUE_CIRCUIT_RESET_SECS` | `60` | Sekundy do resetu circuit breaker |
| `ZION_STREAM_TELEMETRY` | `false` | Zapnout Deeksha stream telemetry v poolu |

### Použití stream telemetry v poolu (opt-in)

```rust
// Místo:
let hash = cosmic_harmony_ekam_deeksha_v2(header, nonce, height);

// Použít:
let (hash, telemetry) = cosmic_harmony_ekam_deeksha_v2_with_streams(header, nonce, height);
if accepted {
    collector.track_deeksha_streams(&telemetry, revenue_value_usd, Some(height));
}
```

> **Důležité:** Telemetry je **opt-in**. Pool může nadále používat pouze `track_event` bez streamů. Stream vrstvy se aktivují jen explicitně.

---

*Generováno jako součást robustní revenue revize větev `main`.*
