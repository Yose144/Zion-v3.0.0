# Dashboard + zion-cli + zion-core Utility Integration Plan

> **Datum:** 2026-05-21
> **Cíl:** Zapojit `zion-cli` a nový `zion-core-util` do dashboardu bez duplikace kódu v V3.

---

## Analýza stávající architektury

| Komponenta | Binárka | Role | Analogy Bitcoin |
|---|---|---|---|
| `zion-core` lib + `node` bin | `node.exe` | Daemon — P2P, RPC, chain state, mempool | `bitcoind` |
| `zion-cli` | `zion.exe` | RPC klient + operátor nástroj | `bitcoin-cli` |
| `zion-pool` | `server.exe` | Pool daemon | `stratum server` |
| `zion-miner` | `zion-miner.exe` | Miner daemon | `cpuminer` |
| **Chybí** | `core-util.exe` | Offline chain state utility (dump, verify, export) | `bitcoin-tx`, `bitcoin-wallet` |

**Dashboard (`dashboard/app.py`)** má vlastní Python log-parser pro `build_status()` — nevolá `zion.exe`. To znamená, že dashboard nevyužívá `zion-cli` vůbec.

---

## Část 1: Dashboard CLI Console (zion-cli integrace)

### Cíl
Umožnit operátorovi volat `zion-cli` příkazy přímo z dashboardu (Controls tab).

### Soubory
- `scripts/zion-cli-run.ps1` — wrapper, spustí `zion.exe <args>`, zachytí stdout/stderr, vrátí JSON
- `dashboard/app.py` — nový endpoint `/api/cli/run` (POST)
- `dashboard/dashboard.html` — nový panel "CLI Console" v Controls
- `dashboard/dashboard.js` — `runCliCommand()`, `loadCliQuickCmd()`

### API
- `POST /api/cli/run` — payload `{cmd: "node status"}` → volá `zion.exe node status`, vrací `{ok, stdout, stderr, exit_code}`
- Timeout 30s. Whitelist příkazů pro bezpečnost (node, wallet, pool, mine, doctor, status, explorer, monitor).

### UI
- Input field pro příkaz
- Run button
- Output terminál (stdout/stderr)
- Quick Command tlačítka: `node status`, `node blocks 10`, `wallet balance`, `pool status`, `doctor`, `status`

---

## Část 2: zion-cli jako datový zdroj pro dashboard

### Cíl
Dashboard bude volat `zion-cli` pro data, která nejsou dostupná z logů (nebo jako fallback).

### Soubory
- `dashboard/app.py` — nový endpoint `/api/cli/node-status` (GET)
- `dashboard/dashboard.html` — nový widget "CLI Node Status" v Overview
- `dashboard/dashboard.js` — `loadCliNodeStatus()`

### API
- `GET /api/cli/node-status` — volá `zion.exe node status`, parsuje height, tip hash, peers, mempool. Vrací strukturovaný JSON.
- `GET /api/cli/status` — volá `zion.exe status`, vrací celkový health stacku.

### UI
- Nový widget v Overview pod Service Cards — zobrazuje:
  - Height, Tip Hash (truncated), Peers, Mempool txs
  - Auto-refresh každých 10s
  - Indikátor "CLI Connected / Disconnected"

### Bezpečnost
- Nepřepisujeme existující `build_status()` — jen doplníme o nový widget.
- Fallback: pokud `zion.exe` není dostupný (např. nebuilděný), widget zobrazí "CLI not available".

---

## Část 3: zion-core utility binární soubor (`core-util`)

### Cíl
Vytvořit offline chain state nástroj, který čte LMDB přímo bez běžícího node (jako `bitcoin-tx`/`bitcoin-wallet`).

### Důvod
- `zion-cli` potřebuje běžící node pro RPC.
- Pro zálohování, diagnostiku a forenzní analýzu potřebujeme číst chain state přímo z disku.
- `verify-chain.ps1` kontroluje jen existence souborů — `core-util` bude kontrolovat strukturu LMDB.

### Soubory
- `V3/L1/core/src/bin/core-util.rs` — nový binární soubor
- `V3/L1/core/Cargo.toml` — přidat `[[bin]] name = "core-util"`

### Příkazy
```
core-util export-state  <db_path>  [--out <json_file>]
core-util verify-db     <db_path>
core-util dump-blocks   <db_path>  [--limit N] [--out <json_file>]
core-util dump-utxos    <db_path>  [--out <json_file>]
core-util get-block     <db_path>  <height_or_hash>
core-util get-tx        <db_path>  <txid>
core-util tip-height    <db_path>
core-util get-balance   <db_path>  <address>
```

### Implementace
- Používá existující `ChainDb::open()` a public metody (`get_meta`, `get_block_by_height`, `get_utxo`, `tip_height`, `export_blocks`, `get_balance`).
- Žádná duplikace kódu — všechno volá existující `storage.rs` API.
- CLI parsing pomocí `clap` (už je workspace dependency).

### Dashboard integrace
- Nový endpoint `/api/cli/core-util` — POST `{cmd: "verify-db", db: "V3/data/zion-node-state.db"}`
- Nové tlačítko v Backup & Recovery panelu: "Deep Verify (LMDB)" — volá `core-util verify-db`
- Nové tlačítko: "Export State (JSON)" — volá `core-util export-state`

---

## Sjednocení — jak se to propojí

```
┌─────────────────────────────────────────────────────────────┐
│                     DASHBOARD (Browser)                      │
├─────────────────────────────────────────────────────────────┤
│ Overview          │ Controls          │ Backup & Recovery    │
│ ───────────────   │ ───────────────   │ ─────────────────    │
│ Service Cards     │ Launch Full Stack  │ Create Backup        │
│ CLI Node Status*  │ Open Terminal     │ Verify (file)*       │
│                   │ Install/Build      │ Deep Verify (LMDB)**│
│                   │ CLI Console*      │ Export State (JSON)**│
│                   │   └─ zion node    │ Restore / Delete     │
│                   │      status       │                      │
│                   │      wallet bal   │                      │
│                   │      doctor       │                      │
└─────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
           dashboard/app.py      scripts/*.ps1
           ─────────────────     ─────────────────
           /api/cli/run          zion-cli-run.ps1
           /api/cli/node-status  backup-chain.ps1
           /api/cli/core-util    restore-chain.ps1
           /api/backup/*         verify-chain.ps1
                    │
            ┌───────┴───────┐
            ▼               ▼
        zion.exe        core-util.exe
        ─────────       ─────────────
        zion-cli        zion-core util
        (RPC klient)    (LMDB reader)
            │               │
            ▼               ▼
        node.exe        V3/data/*.db
        (daemon)        (LMDB files)
```

\* = nové v této integraci
\*\* = závisí na `core-util.exe` (potřebuje build)

---

## Build instrukce

```bash
# Build zion-cli (existuje)
cargo build --release --manifest-path V3/Cargo.toml -p zion-cli

# Build zion-core-util (nové)
cargo build --release --manifest-path V3/Cargo.toml -p zion-core --bin core-util

# Všechny bináře najednou
cargo build --release --manifest-path V3/Cargo.toml --workspace
```

---

## Commity

| Commit | Soubory | Popis |
|---|---|---|
| `feat(cli-console)` | `scripts/zion-cli-run.ps1`, `dashboard/app.py`, `dashboard/dashboard.html`, `dashboard/dashboard.js` | CLI Console panel v Controls |
| `feat(cli-datasource)` | `dashboard/app.py`, `dashboard/dashboard.html`, `dashboard/dashboard.js` | zion-cli jako datový zdroj (node-status widget) |
| `feat(core-util)` | `V3/L1/core/src/bin/core-util.rs`, `V3/L1/core/Cargo.toml`, `dashboard/app.py`, `dashboard/dashboard.html`, `dashboard/dashboard.js`, `dashboard/README.md` | Nový offline LMDB utility + dashboard integrace |
| `docs(integration)` | `dashboard/README.md`, `V3/docs/DASHBOARD_CLI_INTEGRATION_PLAN.md` | Dokumentace |
