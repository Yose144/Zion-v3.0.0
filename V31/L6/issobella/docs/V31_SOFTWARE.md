# V31 Software — `zion-issobella`

> Technická dokumentace L6 daemonu pro ZION Issobella. Crate implementuje správu vesmírných misí, výzkumných návrhů a pozorování, včetně L1 scanneru a DAO governance integrace.

---

## Přehled architektury

```text
┌─────────────────────────────────────────┐
│           zion-issobella daemon          │
│              (Axum HTTP API)              │
├─────────────────────────────────────────┤
│  API Router  │  Metrics  │  L1 Scanner  │
├─────────────────────────────────────────┤
│  DAO Client  │  SQLite (rusqlite)        │
├─────────────────────────────────────────┤
│  Config (TOML + env vars)               │
└─────────────────────────────────────────┘
```

---

## Moduly

### `config.rs` — Konfigurace

```rust
pub struct IssobellaConfig {
    pub name: String,
    pub bind: String,
    pub port: u16,
    pub db_path: String,
    pub l1_rpc_url: String,
    pub scan_interval_secs: u64,
    pub api_key: String,
    pub issobella_fund_address: String,
    pub min_mission_budget_zion: u64,
    pub max_mission_budget_zion: u64,
    pub hiran_endpoint: Option<String>,
    pub hiran_enabled: bool,
    pub dao_api_url: String,
    pub dao_api_key: String,
    pub dao_proposer: String,
    pub dao_proposer_balance: u64,
    pub dao_snapshot_block: u64,
}
```

**Konfigurační priority:**
1. TOML soubor (pokud zadán přes `--config`)
2. Environment variables
3. Výchozí hodnoty v kódu

### `db.rs` — SQLite persistence

**Tabulky:**

| Tabulka | Účel |
|---------|------|
| `missions` | Vesmírné mise — název, typ, rozpočet, status, cílové datum startu, orbitální výška, počet satelitů |
| `observations` | Pozorování z mise — typ, data URL, metadata, timestamp, publikační status |
| `disbursements` | Výdaje z fondu — mise, částka, příjemce, tx hash, čas výdaje |
| `research_proposals` | Výzkumné návrhy — titul, výzkumník, instituce, abstrakt, požadovaný rozpočet, status recenze |
| `fund_balance` | Správa alokace financí z L1 scanneru |

**Klíčové metody:**
- `list_missions(filter)` — výpis misí podle statusu
- `create_mission(...)` — vytvoření nové mise
- `create_observation(...)` — záznam pozorování
- `record_disbursement(...)` — záznam výdaje
- `create_proposal(...)` — podání výzkumného návrhu
- `update_mission_status(id, status)` — změna stavu mise
- `update_mission_spent_and_satellites(...)` — aktualizace utracené částky a satelitů
- `update_proposal_status(...)` — recenze návrhu
- `get_fund_balance()` — aktuální zůstatek fondu

### `api.rs` — HTTP API (Axum)

**Endpointy:**

| Metoda | Cesta | Popis |
|--------|-------|-------|
| `GET` | `/health` | Healthcheck |
| `GET` | `/metrics` | Prometheus metrics |
| `GET` | `/api/v1/fund/balance` | Zůstatek fondu |
| `GET` | `/api/v1/fund/disbursements` | Seznam výdajů z fondu |
| `GET` | `/api/v1/missions` | Seznam misí |
| `POST` | `/api/v1/missions` | Vytvoření mise |
| `POST` | `/api/v1/missions/:id/launch` | Označení mise jako `launched` |
| `POST` | `/api/v1/missions/:id/status` | Obecný přechod stavu mise |
| `POST` | `/api/v1/missions/:id/spend` | Výdaj z rozpočtu mise |
| `GET` | `/api/v1/missions/:id/observations` | Pozorování dané mise |
| `POST` | `/api/v1/missions/:id/submit-to-dao` | Odeslání mise ke schválení DAO |
| `GET` | `/api/v1/proposals` | Seznam výzkumných návrhů |
| `POST` | `/api/v1/proposals` | Podání nového návrhu |
| `POST` | `/api/v1/proposals/:id/approve` | Schválení návrhu |
| `POST` | `/api/v1/proposals/:id/reject` | Zamítnutí návrhu |
| `GET` | `/api/v1/observations` | Seznam pozorování |
| `POST` | `/api/v1/observations` | Záznam nového pozorování |
| `POST` | `/api/v1/ai/evaluate-mission` | Hiran: ohodnocení mise |
| `POST` | `/api/v1/ai/analyze-proposal` | Hiran: shrnutí návrhu |
| `POST` | `/api/v1/ai/optimize-network` | Hiran: návrh topologie sítě |
| `POST` | `/api/v1/ai/mission-log` | Hiran: generování záznamu deníku |
| `GET` | `/api/v1/ai/hiran-health` | Hiran bridge health |

**Middleware:** CORS, tracing, API key auth (na základě konfigurace).

### `l1_scanner.rs` — L1 Blockchain Scanner

- Periodicky dotazuje L1 RPC (`get_block_count`, coinbase data).
- Sleduje příchozí transakce na `issobella_fund_address`.
- Aktualizuje `fund_balance` o nové alokace z block reward splitu.
- Interval: `scan_interval_secs` (výchozí 60 sekund).

### `dao_client.rs` — DAO Governance Integrace

- Proxy klient pro L2 DAO REST API (`ZION_DAO_API_ADDR`).
- `submit_mission_proposal()` — převede misi na DAO treasury proposal.
- Typ proposalu: `Treasury`.
- OAuth: `x-api-key` header.

### `hiran_bridge.rs` — Hiran AI Integrace

- `evaluate_mission_plan(name, description, budget)` — AI ohodnocení feasibility mise.
- `summarize_research(title, abstract)` — AI shrnutí a kvalitativní posudek návrhu.
- `optimize_network_topology(nodes, constraints)` — AI návrh satelitní topologie.
- `generate_mission_log(mission_name, event, timestamp)` — AI generování záznamu deníku.
- `health()` — kontrola dostupnosti Hiran endpointu.
- Aktivuje se pouze pokud `hiran_enabled = true`.

### `metrics.rs` — Prometheus Metrics

| Metric | Popis |
|--------|-------|
| `zion_issobella_blocks_scanned` | Počet proscanovaných L1 bloků |
| `zion_issobella_missions_planning` | Počet misí ve stavu `planning` |
| `zion_issobella_missions_launched` | Počet misí ve stavu `launched` |
| `zion_issobella_missions_operational` | Počet misí ve stavu `operational` |
| `zion_issobella_observations_recorded` | Počet zaznamenaných pozorování |
| `zion_issobella_proposals_submitted` | Počet podaných návrhů |
| `zion_issobella_total_accumulated_zion` | Celkem akumulováno ZION |
| `zion_issobella_total_disbursed_zion` | Celkem rozděleno ZION |

### `error.rs` — Error typy

```rust
pub enum IssobellaError {
    Database error,
    IO error,
    Serialization error,
    Invalid mission status transition,
    Invalid proposal status transition,
    Mission not found,
    Observation not found,
    Proposal not found,
    Disbursement not found,
    Invalid status value,
    Insufficient funds,
    L1 RPC error,
    Unauthorized,
    Other,
}
```

---

## Spuštění

### Lokálně z cargo

```bash
cargo run -p zion-issobella
```

S custom konfigurací:
```bash
ISSOBELLA_PORT=8097 ISSOBELLA_L1_RPC=http://127.0.0.1:9445/jsonrpc \
  cargo run -p zion-issobella
```

### Docker / systemd

Systemd unit: `V31/deploy/systemd/zion-v31-issobella.service`

```bash
sudo systemctl start zion-v31-issobella
```

Port: `8097`
Healthcheck: `GET /health`

### Přes CLI

```bash
zion issobella status
zion issobella missions
zion issobella proposals
```

---

## Testy

```bash
cargo test -p zion-issobella
cargo clippy -p zion-issobella
```

| Test | Popis |
|------|-------|
| `test_mission_lifecycle` | Vytvoření → aktualizace stavu |
| `test_proposal_lifecycle` | Podání návrhu a jeho výpis |
| `test_fund_balance` | Sledování zůstatku fondu a alokace |

---

## Environment Variables

| Proměnná | Výchozí | Popis |
|------------|-----------|-------|
| `ISSOBELLA_PORT` | `8097` | HTTP API port |
| `ISSOBELLA_BIND` | `127.0.0.1` | Bind adresa |
| `ISSOBELLA_DB` | `./issobella.db` | Cesta k SQLite |
| `ISSOBELLA_L1_RPC` | `http://127.0.0.1:9445/jsonrpc` | L1 RPC URL |
| `ISSOBELLA_API_KEY` | — | API klíč (volitelné) |
| `ISSOBELLA_FUND_ADDRESS` | `zion1z4s3a54266f2x7j4x7c27297k49752t7k52l0f0` | L6 fund address |
| `ISSOBELLA_HIRAN_URL` | `http://localhost:8002` | Hiran AI endpoint |
| `ISSOBELLA_HIRAN_ENABLED` | `false` | Povolit Hiran bridge |
| `ZION_DAO_API_ADDR` | `http://127.0.0.1:8456` | L2 DAO API URL |
| `ZION_DAO_API_KEY` | — | DAO API klíč |
| `ZION_DAO_PROPOSER` | — | DAO proposer adresa |
| `ZION_DAO_PROPOSER_BALANCE` | `0` | Minimální balance pro předkládání |
| `ZION_DAO_SNAPSHOT_BLOCK` | `0` | Snapshot block pro voting power |

---

## Závislosti (Cargo.toml)

- `tokio` — async runtime
- `axum` — HTTP web framework
- `rusqlite` — SQLite persistence
- `reqwest` — HTTP klient pro DAO a Hiran API
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
| `zion-free-world` (L5) | Pozemní podpora, kvantový motor |
| `zion-cli` | Operator CLI — lifecycle management |

---

## Bezpečnostní poznámky

- **API key auth** je volitelné pro development; v produkci povinné.
- **Multi-sig wallet** pro výběr z fondu — 3 z 5 signatářů.
- **Emergency veto** Issobely pro projekty škodící dětem.
- **Transparentní reportování** — každá transakce sledovatelná na blockchainu.
- Hiran AI je pouze poradní nástroj, nikoliv finální rozhodovací autorita.

---

*"Každý block, který najdete = jídlo pro hladové dítě. Každý share, který submitnete = kniha pro studenta. Každý ZION, který držíte = naděje pro budoucnost."*
