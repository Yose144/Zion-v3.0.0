# ZION Issobella — L6 Space Layer

> *"The star is not the destination — it is the beginning."*

ZION Issobella is the L6 (space) layer of the ZION TerraNova V31 Mainnet Alpha. It is a long-term vision for a community-funded orbital research station, a decentralized SETI / deep-science program, and the bridge between planetary (L1–L5) and cosmic governance.

This crate implements the `zion-issobella` daemon: an Axum HTTP service backed by SQLite, with an L1 block-reward scanner, DAO proposal bridge, Hiran AI integration, and Prometheus metrics.

---

## What is L6 / Issobella?

- **Orbital station vision** — a modular Low-Earth-Orbit (LEO) research platform by 2040+.
- **Decentralized science funding** — 5 % of every L1 block reward flows into the Issobella fund.
- **Open research** — missions, observations, and research proposals tracked on-chain and in the L6 database.
- **DAO governance** — large allocations are submitted to the ZION DAO for approval.
- **Hiran AI co-steward** — optional AI evaluation of mission plans and research abstracts.

---

## Architecture

```text
              zion-issobella daemon
        ┌─────────────────────────────────┐
        │  HTTP API (Axum)                │
        │  /api/v1/missions               │
        │  /api/v1/observations           │
        │  /api/v1/proposals              │
        │  /api/v1/fund/balance           │
        │  /api/v1/ai/*                   │
        ├─────────────────────────────────┤
        │  SQLite (missions, observations,│
        │  proposals, fund_balance)       │
        ├─────────────────────────────────┤
        │  L1 Scanner  │  DAO Client      │
        │  Hiran Bridge│  Prometheus      │
        └─────────────────────────────────┘
                       │
              5 % block reward
              L1 TerraNova
```

---

## Quick start

```bash
# Build
cd /home/zionserver/2.9.6-main
 cargo build --release -p zion-issobella

# Run with defaults
./V31/target/release/zion-issobella

# Override via env
ISSOBELLA_PORT=8097 \
ISSOBELLA_DB=./issobella.db \
ISSOBELLA_L1_RPC=http://127.0.0.1:9445/jsonrpc \
ISSOBELLA_FUND_ADDRESS=zion1z4s3a54266f2x7j4x7c27297k49752t7k52l0f0 \
 cargo run --bin zion-issobella
```

---

## Configuration

Priority (highest first):

1. TOML file passed with `--config`
2. Environment variables
3. Defaults in `config.rs`

| Variable | Default | Description |
|----------|---------|-------------|
| `ISSOBELLA_PORT` | `8097` | HTTP API port |
| `ISSOBELLA_BIND` | `127.0.0.1` | Bind address |
| `ISSOBELLA_DB` | `./issobella.db` | SQLite path |
| `ISSOBELLA_L1_RPC` | `http://127.0.0.1:9445/jsonrpc` | L1 RPC URL |
| `ISSOBELLA_API_KEY` | — | Optional API key |
| `ISSOBELLA_FUND_ADDRESS` | `zion1z4s3a54266f2x7j4x7c27297k49752t7k52l0f0` | Issobella fund address |
| `ISSOBELLA_HIRAN_URL` | `http://localhost:8002` | Hiran AI endpoint |
| `ISSOBELLA_HIRAN_ENABLED` | `false` | Enable Hiran AI bridge |
| `ZION_DAO_API_ADDR` | `http://127.0.0.1:8456` | DAO API URL |
| `ZION_DAO_API_KEY` | — | DAO API key |
| `ZION_DAO_PROPOSER` | — | DAO proposer address |
| `ZION_DAO_PROPOSER_BALANCE` | `0` | Required proposer balance |
| `ZION_DAO_SNAPSHOT_BLOCK` | `0` | DAO snapshot block |

---

## HTTP API

See `docs/V31_SOFTWARE.md` for the full endpoint specification and request/response schemas.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Service health |
| `GET` | `/metrics` | Prometheus metrics |
| `GET` | `/api/v1/fund/balance` | Current fund balance |
| `GET` | `/api/v1/fund/disbursements` | List fund disbursements |
| `GET` | `/api/v1/missions` | List missions |
| `POST` | `/api/v1/missions` | Create a mission |
| `POST` | `/api/v1/missions/:id/launch` | Mark mission as launched |
| `POST` | `/api/v1/missions/:id/status` | Generic mission status transition |
| `POST` | `/api/v1/missions/:id/spend` | Spend from a mission budget |
| `GET` | `/api/v1/missions/:id/observations` | Observations for a mission |
| `POST` | `/api/v1/missions/:id/submit-to-dao` | Submit mission funding to DAO |
| `GET` | `/api/v1/proposals` | List research proposals |
| `POST` | `/api/v1/proposals` | Submit a research proposal |
| `POST` | `/api/v1/proposals/:id/approve` | Approve a proposal |
| `POST` | `/api/v1/proposals/:id/reject` | Reject a proposal |
| `GET` | `/api/v1/observations` | List observations |
| `POST` | `/api/v1/observations` | Record an observation |
| `POST` | `/api/v1/ai/evaluate-mission` | Hiran: evaluate mission plan |
| `POST` | `/api/v1/ai/analyze-proposal` | Hiran: summarize research |
| `POST` | `/api/v1/ai/optimize-network` | Hiran: network topology suggestion |
| `POST` | `/api/v1/ai/mission-log` | Hiran: generate mission log |
| `GET` | `/api/v1/ai/hiran-health` | Hiran bridge health |

---

## CLI

The `zion` CLI includes the `issobella` subcommand:

```bash
zion issobella status
zion issobella missions
zion issobella proposals
zion issobella observations
zion issobella balance
zion issobella disbursements
zion issobella create-mission --name "LEO Observatory" --type observatory --budget-zion 50000000
zion issobella launch-mission <id>
zion issobella update-status <id> --status operational
zion issobella spend <id> 1000000 --satellite-count 4
zion issobella submit-to-dao <id>
zion issobella hiran-evaluate --name "LEO Observatory" --description "LEO optical observatory" --budget-zion 50000000
zion issobella hiran-optimize --nodes sat-1 --nodes sat-2 --constraints "low latency"
```

See `docs/CLI.md` for the complete command reference.

---

## Tests

```bash
cargo test -p zion-issobella
cargo clippy -p zion-issobella
```

---

## Documentation

- `docs/README.md` — documentation index
- `docs/STANICE_ISSOBELLA.md` — station vision, philosophy, and cosmic family
- `docs/FINANCOVANI.md` — funding model and tokenomics
- `docs/CASOVA_OSA.md` — timeline and roadmap
- `docs/V31_SOFTWARE.md` — detailed software documentation
- `docs/CLI.md` — CLI command reference

### Research context (L6data)

- `L6data/Architektura.md` — station architecture and modules
- `L6data/Kvantovy_Motor.md` — quantum motor research proposal
- `L6data/Umela_Gravitace.md` — artificial gravity design
- `L6data/Lidske_Faktory.md` — crew biomedicine and psychology
- `L6data/GPT_Podklady.md` — compact GPT-ready context

---

## License

Same as the ZION TerraNova repository. See repository root for the license file.
