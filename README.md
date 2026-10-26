# ZION TerraNova — Mainnet Beta (V31)

> **Proof of Work Layer 1 for the next 100 years.**
> From blockchain to the stars.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Status

> **Last updated: 2026-10-21 (EDGE → EDGE2 split hotov — 2 boxy, EDGE2 = primary + celý app stack, EDGE = ingress + pool + followeři; chain ~90 400 bloků; G8 stall RCA + 3 fixy nasazeny; `zion-ncl` živý na :8098)**

- **Topologie (2026-10-21, split v3):**
  - **EDGE2** `207.180.217.100` (vmi3684458, 6c EPYC / 11 G / 193 G) — V31 **primary** node (RPC 9445, P2P 8335), bitcoind mainnet (8332, pruned), quantus (9944 + QUIC 9833), pearl stack (44207/8477), PostgreSQL 16 (5432), WARP (8453/8454), ZIS (8096), db-sync, DAO (8456), OASIS (8094), free-world (8095), issobella (8097), NCL (8098), website (3000), marketplace (3100), ai-native (8001), btcunlock (8779).
  - **EDGE** `62.171.141.136` (vmi3425821) — nginx ingress (všechny veřejné vhosty), **pool** 8444/8445 (stratum + TLS) + API 8080, fallback-miner, node2 (9446) + node3 (9447) followeři, regtest BTC, dashboard (8766), grafana, prometheus, fail2ban.
  - **Tunely:** `zion-chain-tunnel` (edge→EDGE2) a `zion-edge-tunnel` (EDGE2→edge), oba s `permitopen` whitelist. Latence edge↔EDGE2 ≈ 1 ms.
  - **Pool zůstává na EDGI záměrně** — stratum musí vidět reálné IP minerů (`ZION_POOL_MAX_SESSIONS_PER_IP=10` + IP ban); stream proxy by je sjednotil pod jednu IP a rozbil per-IP limity.
  - Plán + execution log + rollback skripty: [`INFRA-SPLIT-PLAN.md`](INFRA-SPLIT-PLAN.md).
- **Lifecycle (2026-10-26):** **3.2.0 Mainnet Beta** — stupeň zralosti, NE Mainnet Stable ani nový chain/fork. Runtime verze zůstává `3.2.0`; handshake ID `zion-v3-node/3.1.0-alpha` je záměrně zachováno (verze protokolu ≠ stupeň). Topologie: **EDGE2** = primary node + web ingress + app stack, **EDGE** = pool + followeři + ops. Detailní plán: [`docs/3.2/3.2.1-3.2.9_PLAN.md`](docs/3.2/3.2.1-3.2.9_PLAN.md).
- **Active mainnet track:** `V31/` workspace — verze `3.2.0`, protokol `zion-v3-node/3.1.0-alpha`. V31 cutover (2026-08-04) dokončen, V3 archivován v `archive/V3/`.
- **Chain:** ~90 400+ bloků, difficulty ~16k (LWMA-60, `MIN_SOLVE_TIME=6`, `MAX_SOLVE_TIME=360`, ±50 % clamp na blok). Genesis hash (V31 native): `96109423298542a836edc10b9ba5ff9b29a1970418db543c2ee5cd952fe35bdb` · (V3 compat): `4cf7560f9140deb9376fa6567e76eacaa8bd1b733ca3c91b00830a08f332ef71`.
- **Public RPC:** `rpc.zionterranova.com:8443` → V31 (přes edge nginx). **Pool stratum:** `pool.zionterranova.com:8444` (+ TLS 8445), `https://pool.zionterranova.com/public/v1` public API tier.
- **V3.2 "One Love" canonical docs:** Public whitepapers a onboarding (CZ/EN) jsou kanonizované v [`canon/books/`](canon/books/README.md); launch plán [`OneLoveV3.2.md`](docs/3.2/OneLoveV3.2.md), technický execution plán [`V31/PLAN_TO_3.2.md`](V31/PLAN_TO_3.2.md).
- **V3.3 "NIRVANA" execution:** stav a jednotlivé gate jsou v [`NIRVANA-V3.3-CHECKLIST.md`](NIRVANA-V3.3-CHECKLIST.md). Důležité otevřené blokátory: nové schválené 30denní G8 okno, externí bezpečnostní audit a rozhodnutí o vydání v3.2.0. **BTC swap zůstává vypnutý** (`WARP_BTC_SWAP_ENABLED=0`) do dokončení hardeningu, auditu a výslovného schválení pilotu; **PRL payout zůstává v dry-run** (`PRL_PAYOUT_DRY_RUN=1`) a vyžaduje kontrolu dávky i operátorský souhlas. Stav UI či hotový kód samy o sobě tyto provozní gate neuzavírají.
- **ZIS Multichain Wallet:** ZIS → L2 multichain → Uniswap V3 architektura v [`docs/3.2/ZIS_WALLET_PLAN.md`](docs/3.2/ZIS_WALLET_PLAN.md). (Původní [`ZionDexZis.md`](docs/3.2/ZionDexZis.md) plán je superseded — historický.)
- **Hard genesis reset (2026-08-06):** kompletní rotace klíčů — nové premine, canonical, admin, DAO guardian a EVM validator klíče. Viz [`HARD_RESET_PLAYBOOK.md`](docs/3.2/HARD_RESET_PLAYBOOK.md).
- **Validace:** příkazy pro build a testy jsou v části Quick start. Výsledky testů závisejí na zvolených features a dostupném hardware; historické výsledky nejsou tvrzením o aktuálním stavu celé workspace.
- **Public launch target:** postponed (TBD).

---

## Quick links

| What | Where |
|------|-------|
| **V31 workspace entry** | [`V31/README.md`](V31/README.md) |
| **V31 build / cutover plan** | [`V31/ALPHA_BUILD_PLAN.md`](V31/ALPHA_BUILD_PLAN.md) |
| **V31 operational rules** | [`V31/AGENTS.md`](V31/AGENTS.md) |
| **3.2 "One Love" launch & marketing plan** | [`OneLoveV3.2.md`](docs/3.2/OneLoveV3.2.md) |
| **3.2 technical execution plan** | [`V31/PLAN_TO_3.2.md`](V31/PLAN_TO_3.2.md) |
| **Canonical public docs / whitepapers** | [`canon/books/README.md`](canon/books/README.md) |
| **Live status + topology** | [`StatusV3.md`](docs/3.2/StatusV3.md) |
| **EDGE → EDGE2 split plan + execution log** | [`INFRA-SPLIT-PLAN.md`](INFRA-SPLIT-PLAN.md) |
| **V3.3 NIRVANA execution checklist** | [`NIRVANA-V3.3-CHECKLIST.md`](NIRVANA-V3.3-CHECKLIST.md) |
| **Post-cutover execution plan** | [`PLAN_TO_3.1_RECONCILED.md`](./docs/3.1/PLAN_TO_3.1_RECONCILED.md) |
| **V31 detailed status** | [`V31/STATUS.md`](V31/STATUS.md) |
| **V3 archive (read-only)** | [`archive/V3/`](archive/V3/) |
| **Operator runbook + pravidla** | [`AGENTS.md`](AGENTS.md) |
| **Provozní log (2026-07-08 → 2026-10-21)** | [`docs/3.2/ops/AGENTS-CHRONOLOGY.md`](docs/3.2/ops/AGENTS-CHRONOLOGY.md) |
| **Historical incidents + public-subtree rules** | [`AGENTS.md`](AGENTS.md) |
| **Hard reset procedure (genesis + keys)** | [`HARD_RESET_PLAYBOOK.md`](docs/3.2/HARD_RESET_PLAYBOOK.md) |
| **Public (MIT) subtree** | [`public/`](public/) |
| **ZionDex + ZIS Multichain Wallet plan** | [`ZionDexZis.md`](docs/3.2/ZionDexZis.md) |

---

## What is ZION?

ZION is a decentralized **Layer 1 blockchain** built from scratch in **Rust**, running a canonical Proof-of-Work consensus with CPU and GPU acceleration. The current mainnet-track development happens in the clean `V31/` workspace; the previous V3 tree is archived in `archive/V3/`.

V31 features a height-aware PoW fork gate, triple-stream mining (ZION + AuxPoW GPU + CPU fallback), a unified Multi-Chain crate (bridge/DAO/WARP/HTLC/DEX), and a `zion` operator CLI.

---

## Quick start

### Run from source (V31)

```bash
cd V31
cargo check
cargo test
cargo build --release
```

Tyto příkazy ověřují lokální build; nezapínají produkční služby ani nepotvrzují provozní readiness. GPU testy mohou vyžadovat odpovídající ovladač a hardware.

### Run a local V31 node

```bash
RUST_LOG=info ./target/release/zion-node --config config/node.toml
```

### Run the pool

```bash
./target/release/zion-pool --config config/pool.toml
```

### Run the miner

Triple-stream mining (ZION + ZANO GPU + VRSC CPU) with CUDA backend:

```bash
./target/release/zion-miner \
  --pool 62.171.141.136:8444 \
  --wallet <your-44-char-zion1-address> \
  --worker my-rig \
  --gpu cuda \
  --v3-trinity \
  --threads 10
```

Use `~/Desktop/Start.sh` for automatic wallet backup discovery, build checks, and screen-based background mode:

```bash
~/Desktop/Start.sh --bg
```

CUDA DAG disk cache (enabled by default): the first run generates and saves the ProgPoW/Ethash/Kawpow DAG to `~/.zion/dag-cache/{algo}_epoch{N}.bin` (~2 GB for epoch 126). Set `ZION_DAG_CACHE_DISABLE=1` to disable, or `ZION_DAG_CACHE_DIR=/path` to use a custom cache directory.

Force a specific coin on stream 3:

```bash
ZION_STREAM3_FORCE_COIN=MONERO ./target/release/zion-miner \
  --pool 62.171.141.136:8444 \
  --wallet <your-44-char-zion1-address> \
  --worker my-rig \
  --gpu cuda \
  --v3-trinity \
  --threads 10
```

---

## Network topology

Aktuální rozdělení EDGE/EDGE2 je shrnuté také v úvodu [`AGENTS.md`](AGENTS.md); detailní stav a rollback postup jsou v [`INFRA-SPLIT-PLAN.md`](INFRA-SPLIT-PLAN.md). [`StatusV3.md`](docs/3.2/StatusV3.md) obsahuje starší technický/statusový kontext a nemusí odrážet poslední změny infrastruktury. Stručně:

- **EDGE2** `207.180.217.100` — V31 **primary** node, chain stack (bitcoind/quantus/pearl), multichain/WARP, DAO, OASIS, Free World, Issobella, NCL, ZIS, db-sync, PostgreSQL, website, marketplace, ai-native, btcunlock.
- **EDGE** `62.171.141.136` — nginx public ingress, **pool** (stratum 8444/8445 + API 8080), fallback-miner, follower nodes node2/node3, regtest BTC, dashboard, grafana/prometheus.
- Public RPC is served by nginx TCP stream on port 8443 (edge → EDGE2 chain tunnel).
- Two SSH tunnels (`zion-chain-tunnel` / `zion-edge-tunnel`) connect the boxes; `permitopen` whitelist only.

---

## Documentation hierarchy

This repository has one source of truth per topic:

| Topic | Canonical doc |
|-------|---------------|
| **Live operational status** | [`StatusV3.md`](docs/3.2/StatusV3.md) |
| **V31 workspace + build notes** | [`V31/README.md`](V31/README.md) |
| **V31 security / ops rules** | [`V31/AGENTS.md`](V31/AGENTS.md) |
| **3.2 "One Love" launch plan** | [`OneLoveV3.2.md`](docs/3.2/OneLoveV3.2.md) |
| **3.2 technical execution plan** | [`V31/PLAN_TO_3.2.md`](V31/PLAN_TO_3.2.md) |
| **Canonical public docs / whitepapers** | [`canon/books/README.md`](canon/books/README.md) |
| **3.1 archived reports** | [`docs/3.1/README.md`](docs/3.1/README.md) |
| **Post-cutover execution plan** | [`docs/3.1/PLAN_TO_3.1_RECONCILED.md`](docs/3.1/PLAN_TO_3.1_RECONCILED.md) |
| **V31 detailed status** | [`V31/STATUS.md`](V31/STATUS.md) |
| **V3 archive** | [`archive/V3/README.md`](archive/V3/README.md) |
| **EDGE → EDGE2 split plan + rollback** | [`INFRA-SPLIT-PLAN.md`](INFRA-SPLIT-PLAN.md) |
| **V3.3 NIRVANA execution checklist** | [`NIRVANA-V3.3-CHECKLIST.md`](NIRVANA-V3.3-CHECKLIST.md) |
| **MarketPlace ZION L1 bonus payout** | [`apps/MarketPlace/PAYOUT.md`](apps/MarketPlace/PAYOUT.md) |
| **Operator runbook + pravidla** | [`AGENTS.md`](AGENTS.md) |
| **Provozní log (2026-07-08 → 2026-10-21)** | [`docs/3.2/ops/AGENTS-CHRONOLOGY.md`](docs/3.2/ops/AGENTS-CHRONOLOGY.md) |
| **Historical incidents + backup rules** | [`AGENTS.md`](AGENTS.md) |

---

## License

MIT — see [LICENSE](LICENSE).

---

*Last updated: 2026-10-21 · Version: 3.2.0 (V31 Mainnet Alpha, protocol 3.1.0-alpha) · Topologie: EDGE2 primary + EDGE ingress/pool (viz [`INFRA-SPLIT-PLAN.md`](INFRA-SPLIT-PLAN.md)) · 3.3 NIRVANA: [`NIRVANA-V3.3-CHECKLIST.md`](NIRVANA-V3.3-CHECKLIST.md) · 3.2 "One Love" docs: [`canon/books/README.md`](canon/books/README.md) · 3.1 archived reports: [`docs/3.1/README.md`](docs/3.1/README.md) · Live status: [`StatusV3.md`](docs/3.2/StatusV3.md) · [`V31/STATUS.md`](V31/STATUS.md)*
