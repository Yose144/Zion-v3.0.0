# 🛰️ V3 Software — `zion-issobella`

> Technická dokumentace L6 daemonu pro ZION Issobella. Crate implementuje správu vesmírných misí, výzkumných návrhů a pozorování, včetně L1 scanneru a DAO governance integrace.

---

## Přehled architektury

```
┌─────────────────────────────────────────┐
│           zion-issobella daemon          │
│              (Axum HTTP API)               │
├─────────────────────────────────────────┤
│  API Router  │  Metrics  │  L1 Scanner  │
├─────────────────────────────────────────┤
│  DAO Client  │  SQLite (rusqlite)      │
├─────────────────────────────────────────┤
│  Config (TOML + env vars)               │
└─────────────────────────────────────────┘
```

---

## Moduly

### `config.rs` — Konfigurace

```rust
pub struct IssobellaConfig {
    pub name: String,                    // "zion-issobella"
    pub bind: String,                  // "0.0.0.0"
    pub port: u16,                     // 8096
    pub db_path: String,               // "./issobella.db"
    pub l1_rpc_url: String,            // "http://127.0.0.1:8443/jsonrpc"
    pub scan_interval_secs: u64,       // 60
    pub api_key: String,
    pub issobella_fund_address: String, // "zion1issobella..."
    pub min_mission_budget_zion: u64,  // 10_000
    pub max_mission_budget_zion: u64,  // 100_000_000
}
```

**Konfigurační priority:**
1. TOML soubor (pokud zadán přes `--config`)
2. Environment variables (`ISSOBELLA_PORT`, `ISSOBELLA_BIND`, `ISSOBELLA_DB`, `ISSOBELLA_L1_RPC`, `ISSOBELLA_API_KEY`)
3. Výchozí hodnoty v kódu

### `db.rs` — SQLite persistence

**Tabulky:**

| Tabulka | Účel |
|---------|------|
| `missions` | Vesmírné mise — název, typ, rozpočet, status, cílové datum startu, orbitální výška, počet satelitů |
| `observations` | Pozorování z mise — typ, data URL, metadata, timestamp, publikační status |
| `research_proposals` | Výzkumné návrhy — titul, výzkumník, instituce, abstrakt, požadovaný rozpočet, status recenze |
| `funds` | Správa alokace financí pro mise a návrhy |

**Klíčové metody:**
- `list_missions(filter)` — výpis misí podle statusu
- `create_mission(...)` — vytvoření nové mise
- `create_observation(...)` — záznam pozorování
- `create_proposal(...)` — podání výzkumného návrhu
- `update_mission_status(id, status)` — změna stavu mise

### `api.rs` — HTTP API (Axum)

**Endpointy:**

| Metoda | Cesta | Popis |
|--------|-------|-------|
| `GET` | `/health` | Healthcheck |
| `GET` | `/api/v1/missions` | Seznam misí |
| `POST` | `/api/v1/missions` | Vytvoření mise |
| `POST` | `/api/v1/missions/:id/submit-to-dao` | Odeslání mise ke schválení DAO |
| `GET` | `/api/v1/observations` | Seznam pozorování |
| `POST` | `/api/v1/observations` | Záznam nového pozorování |
| `GET` | `/api/v1/proposals` | Seznam výzkumných návrhů |
| `POST` | `/api/v1/proposals` | Podání nového návrhu |
| `POST` | `/api/v1/proposals/:id/approve` | Schválení návrhu |
| `POST` | `/api/v1/proposals/:id/reject` | Zamítnutí návrhu |

**Middleware:** CORS, tracing, API key auth (na základě konfigurace).

### `l1_scanner.rs` — L1 Blockchain Scanner

- Periodicky dotazuje L1 RPC (`get_block_count`, `get_coinbase_distribution`)
- Sleduje příchozí transakce na `issobella_fund_address`
- Aktualizuje `funds` tabulku o nové alokace z block reward splitu
- Interval: `scan_interval_secs` (výchozí 60 sekund)

### `dao_client.rs` — DAO Governance Integrace

- Proxy klient pro L2 DAO REST API (`ZION_DAO_API_ADDR`)
- `submit_mission_proposal()` — převede misi na DAO treasury proposal
- Typ proposalu: `"treasury"`
- OAuth: `x-api-key` header

### `metrics.rs` — Prometheus Metrics

- `zion_issobella_missions_total` — počet misí podle statusu
- `zion_issobella_observations_total` — počet pozorování
- `zion_issobella_proposals_total` — počet návrhů
- `zion_issobella_fund_balance` — aktuální zůstatek fondu (ZION)
- `zion_issobella_l1_scans_total` — počet L1 scan cyklů
- `zion_issobella_dao_proposals_submitted_total` — počet návrhů odeslaných do DAO

### `error.rs` — Error typy

```rust
pub enum IssobellaError {
    Db(rusqlite::Error),
    Io(std::io::Error),
    Serde(serde_json::Error),
    InvalidMissionTransition { from: String, to: String },
    MissionNotFound(String),
    ObservationNotFound(String),
    InsufficientFunds { required: u64, available: u64 },
    L1Rpc(String),
    Unauthorized,
    Other(String),
}
```

---

## Spuštění

### Lokálně z cargo

```bash
cargo run --manifest-path V3/Cargo.toml -p zion-issobella
```

S custom konfigurací:
```bash
ISSOBELLA_PORT=8096 ISSOBELLA_L1_RPC=http://127.0.0.1:8443/jsonrpc \
  cargo run --manifest-path V3/Cargo.toml -p zion-issobella
```

### Docker

```bash
docker compose -f V3/docker/docker-compose.yml up -d issobella
```

Port: `8096`
Healthcheck: `GET /health`

### Přes CLI

```bash
# Spuštění
cargo run --manifest-path V3/Cargo.toml -p zion-cli -- issobella start

# Status
cargo run --manifest-path V3/Cargo.toml -p zion-cli -- issobella status

# Logs
cargo run --manifest-path V3/Cargo.toml -p zion-cli -- issobella logs
```

---

## Testy

### Integrační testy

```bash
cargo test --manifest-path V3/Cargo.toml -p zion-issobella
```

| Test | Popis |
|------|-------|
| `test_mission_lifecycle` | Vytvoření → aktualizace → dokončení mise |
| `test_proposal_lifecycle` | Podání → recenze → schválení/zamítnutí návrhu |
| `test_fund_balance` | Sledování zůstatku fondu a alokace |

---

## Environment Variables

| Proměnná | Výchozí | Popis |
|------------|-----------|-------|
| `ISSOBELLA_PORT` | `8096` | HTTP API port |
| `ISSOBELLA_BIND` | `0.0.0.0` | Bind adres |
| `ISSOBELLA_DB` | `./issobella.db` | Cesta k SQLite |
| `ISSOBELLA_L1_RPC` | `http://127.0.0.1:8443/jsonrpc` | L1 RPC URL |
| `ISSOBELLA_API_KEY` | — | API klíč (volitelné) |
| `ZION_DAO_API_ADDR` | `http://127.0.0.1:8080` | L2 DAO API URL |
| `ZION_DAO_API_KEY` | — | DAO API klíč |

---

## Závislosti (Cargo.toml)

- `tokio` — async runtime
- `axum` — HTTP web framework
- `rusqlite` — SQLite persistence
- `reqwest` — HTTP klient pro DAO API
- `serde` + `serde_json` — serializace
- `chrono` — timestampy
- `uuid` — generování ID
- `tracing` — logging

---

## Relace k ostatním crate

| Crate | Vztah |
|-------|-------|
| `zion-core` (L1) | Block rewards, RPC, coinbase distribution |
| `zion-dao` (L2) | Governance, treasury proposals, schvalování misí |
| `zion-free-world` (L5) | Pozemní podpora, kvantový motor, energetická nezávislost |
| `zion-cli` | Operator CLI — lifecycle management |

---

## Bezpečnostní poznámky

- **API key auth** je volitelné pro development; v produkci povinné
- **Multi-sig wallet** pro výběr z fondu — 3 z 5 signatářů
- **Emergency veto** Issobely pro projekty škodící dětem
- **Transparentní reportování** — každá transakce sledovatelná na blockchainu

---

*„Každý block, který najdete = jídlo pro hladové dítě. Každý share, který submitnete = kniha pro studenta. Každý ZION, který držíte = naděje pro budoucnost."*
