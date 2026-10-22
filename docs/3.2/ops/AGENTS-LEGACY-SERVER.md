# AGENTS-LEGACY-SERVER — superseded reference

> **Část [`AGENTS.md`](../../../AGENTS.md) — 3/3.** Historická / superseded reference část
> původního kořenového `AGENTS.md` (50 KB). **Verbatim, beze změny** — kvůli odkazům
> v interní dokumentaci a kvůli zachování auditní stopy.
>
> **Co je tady:**
> - `## 2) V3 runtime topology (L1)` · `## 3) V3 service layers above L1` · `## 4) Operator/control surface` — V3-era (před cutoverem na V31)
> - `## 6) Canonical Operational Settings (v3.0.4 Mainnet — Post Hard Reset)` — porty/env z éry v3.0.4
> - `## Current Status (2026-07-13 — Post Hard Reset + Chv3 + AuxPow RVN/XMR Live)` — snapshot ze 13. 7. 2026
> - `## Vega 64 SMOS Deploy & Tuning (2026-06-13)` + `## New Server Complete Reference (v3.0.4 — 62.171.141.136)` — starší tuning/env tabulky
> - `## Memory pressure incident 2026-07-24` — `MALLOC_ARENA_MAX=1` past (trik je stále platný, viz `## 6` níže)
>
> **Aktuální realita** (EDGE2 split, 2026-10-21) je v kořenovém [`AGENTS.md`](../../../AGENTS.md)
> a v [`INFRA-SPLIT-PLAN.md`](../../../INFRA-SPLIT-PLAN.md).

---

## 2) V3 runtime topology (L1)

- `V3/L1/core` (`zion-core`, `node` bin):
  - Owns chain state, consensus validation, mempool, P2P, and RPC surfaces.
  - Exposes P2P listener, RPC listener, and metrics endpoint.
  - Persists/loads state and manages peer discovery/sync/propagation.
- `V3/L1/pool` (`server` bin):
  - Accepts miner sessions over TCP.
  - Pulls block templates from node RPC and submits solved candidates back to node RPC.
  - Handles share validation/session lifecycle and PPLNS payout logic.
- `V3/L1/miner` (`zion-miner` bin):
  - Mines in local mode or remote pool mode.
  - Supports CPU/GPU backends and emits telemetry/metrics.
  - Talks to pool using line-based protocol messages (`hello`/`job`/`submit`/`result`/etc.).

In practice: **node is source of chain truth**, pool is coordination layer, miner is hash producer.

## 3) V3 service layers above L1

- `V3/L2/bridge`:
  - Relay daemon with L1 watcher + EVM watcher(s) + relayer loop.
  - Uses SQLite persistence and exposes Prometheus metrics.
- `V3/L2/dao`:
  - DAO daemon combining L1 scanner and Axum HTTP API.
  - Uses SQLite backend and treasury/governance modules.
- `V3/L2/atomic-swap`:
  - HTLC swap daemon with config-driven startup, L1 watcher, refund loop, optional EVM watcher, and Axum API.
- `V3/L3/warp`:
  - Cross-chain relay daemon (Axum API + background watcher), config-first startup with optional SQLite persistence.

## 4) Operator/control surface

- `V3/cli` (`zion` binary) is the unified operator entrypoint.
- It orchestrates lifecycle actions (`start/stop/restart/logs/status/doctor`) and routes into L1/L2/L3 subcommands.
- Prefer this CLI for operational tasks before writing ad-hoc scripts.


## 6) Canonical Operational Settings (v3.0.4 Mainnet — Post Hard Reset)

### Network Topology

> **UPDATED 2026-07-09:** 3-node P2P mesh deployed. Edge server has 2 L1 nodes (primary + follower), local backup node is 3rd peer. All synced at height 230. Edge git re-cloned to latest `510838ea`.
>
> **UPDATED 2026-07-07:** Old Edge server (`77.42.71.94`) is **DECOMMISSIONED**. All services rebuilt on new server following 3.0.4 hard genesis reset.

Current live topology is **3-node P2P mesh** (Edge primary + Edge follower + Local backup). The old Edge server was decommissioned after security compromise.

```
Edge Server (VPS) — 62.171.141.136
    ├── Node 1 (primary, mining) — RPC 9443, P2P 8333
    ├── Node 2 (follower) — RPC 8448, P2P sync from Node 1
    ├── Pool (Stratum, main) — 8444
    ├── RTM Debug Pool (Stratum, RTM-only) — 8460  ← separate service for RTM debugging
    ├── Bridge (L2) — 9101
    ├── DAO (L2) — 8450
    ├── WARP (L3) — 8453
    ├── OASIS (L4) — 8094
    ├── Free World (L5)
    ├── Dashboard — 8766
    └── nginx — 80/443

Local Machine — zionserver-144 (public IP 109.81.27.87)
    ├── Backup Node — RPC 8448, P2P 8333 (peer to Edge)
    ├── Dashboard — 8766
    ├── Stack (L2/L3: free-world, ai-native-api, issobella, dao, oasis, atomic-swap, ollama)
    └── SSH Tunnel — 9 local + 2 reverse forwards to Edge

Web: https://zionterranova.com (nginx → Docker Next.js)
Dashboard: https://dashboard.zionterranova.com (nginx → Python)
```

| Role | Host | Public IP | Ports |
|------|------|-----------|-------|
| Edge Node 1 (primary) | VPS (Ubuntu 24.04.4) | 62.171.141.136 | P2P: 8333, RPC: 9443 (localhost), Pool: 8444, RTM Debug Pool: 8460, WS: 8445, DAO: 8450, WARP: 8453, ZionDex: 8454 (live), OASIS: 8094 (API) / 9102 (metrics), LND REST: 8080 (pending), LND gRPC: 10009 (pending), LND P2P: 9735 (pending), Web: 80/443, Dashboard: 8766 |
| Edge Node 2 (follower) | VPS (same) | 62.171.141.136 | P2P: 8334, RPC: 8448 (localhost) |
| Local Backup Node | zionserver-144 | 109.81.27.87 | RPC: 8448 (localhost), P2P: 8333 |

### Canonical Ports & Services (v3.0.4 — New Server)

| Service | Port | Bind | Protocol | Notes |
|---------|------|------|----------|-------|
| Node 1 P2P | 8333 | 0.0.0.0 | TCP | Peer-to-peer sync (primary) |
| Node 1 RPC | 9443 | 127.0.0.1 | TCP | JSON-RPC 2.0 (nginx TCP stream proxy 8443 → 9443) |
| Node 2 P2P | 8334 | 0.0.0.0 | TCP | Follower P2P (seeds from Node 1) |
| Node 2 RPC | 8448 | 127.0.0.1 | TCP | Follower node RPC |
| Node 2 WebSocket | 8449 | 127.0.0.1 | TCP | Follower node event stream |
| Node 2 metrics | 9116 | 127.0.0.1 | HTTP | Follower node metrics |
| Node WebSocket | 8445 | 127.0.0.1 | TCP | Node event stream |
| Node metrics | 9100 | 127.0.0.1 | HTTP | Prometheus metrics |
| Pool Stratum | 8444 | 0.0.0.0 | TCP | Miner connections (public) |
| RTM Debug Pool | 8460 | 0.0.0.0 | TCP | Separate RTM-only debug pool (zion-rtm-debug-pool service, doesn't interfere with main pool) |
| Pool stats HTTP | 8455 | 127.0.0.1 | HTTP | Pool routing metrics + /stats + /miners API |
| Bridge metrics | 9101 | 127.0.0.1 | HTTP | Prometheus metrics (bridge) |
| OASIS API | 8094 | 127.0.0.1 | HTTP | Avatar hub API |
| OASIS metrics | 9102 | 127.0.0.1 | HTTP | Prometheus metrics (OASIS) |
| DAO API | 8450 | 127.0.0.1 | HTTP | DAO daemon API (via nginx /api/dao) |
| WARP Relay | 8453 | 0.0.0.0 | HTTP | Cross-chain relay API |
| ZionDex Router | 8454 | 0.0.0.0 | HTTP | Cross-chain DEX router API (live, 7 chains) |
| LND REST | 8080 | 127.0.0.1 | HTTP | Lightning Network REST API (Docker, pending) |
| LND gRPC | 10009 | 127.0.0.1 | gRPC | Lightning Network gRPC (Docker, pending) |
| LND P2P | 9735 | 0.0.0.0 | TCP | Lightning Network peer connections (pending) |
| bitcoind RPC | 18332 | 127.0.0.1 | HTTP | Bitcoin testnet RPC (Docker, pending) |
| bitcoind P2P | 18333 | 0.0.0.0 | TCP | Bitcoin testnet peer connections (Docker, pending) |
| OASIS (L4) | 8094 | 127.0.0.1 | HTTP | OASIS Avatar Hub |
| Dashboard | 8766 | 127.0.0.1 | HTTP | ZION_OS Dashboard (via nginx, Basic Auth) |
| Website (Next.js) | 3000 | 127.0.0.1 | HTTP | Docker `zion-web` (via nginx) |
| Nginx HTTP | 80 | 0.0.0.0 | HTTP | Redirect to HTTPS |
| Nginx HTTPS | 443 | 0.0.0.0 | HTTP/2 | SSL Let's Encrypt, reverse proxy |
| Local Backup Node RPC | 8446 | 127.0.0.1 | TCP | Backup node on zionserver-144 (via SSH tunnel reverse forward) |

### Canonical URLs & Endpoints (v3.0.4)

| Purpose | URL |
|---------|-----|
| **Pool (public mining)** | `62.171.141.136:8444` |
| **RPC (server localhost only)** | `http://127.0.0.1:9443/jsonrpc` |
| **RPC (via nginx proxy)** | `https://zionterranova.com/api/rpc` (nginx 8443 → 9443) |
| **DAO API (via nginx proxy)** | `https://zionterranova.com/api/dao` |
| **WARP API** | `http://127.0.0.1:8453` (internal) / `http://62.171.141.136:8453` (external) |
| **ZionDex Router API** | `http://127.0.0.1:8454` (live, 7 chains) |
| **Website production** | `https://zionterranova.com` |
| **Dashboard** | `https://dashboard.zionterranova.com` (Basic Auth: Yose/Issy) |

### SSH Access (v3.0.4 — New Server, updated 2026-07-19)

- **SSH config:** `ssh zion-new` (alias in `~/.ssh/config`, port 2222)
- **SSH ports:** `22` (default alias) + `2222` (primary), both IPv4 + IPv6
- **SSH key:** `~/.ssh/zion-edge-post-wipe-2026-07-29` (ed25519, fingerprint `SHA256:UOjWE5K22kyJ0Xgxdt/+cySZlErHFQ/y+M9uM/2zmY4`)
- **IPv6 fallback:** `ssh -i ~/.ssh/zion-edge-post-wipe-2026-07-29 -p 2222 -6 root@2a02:c207:2342:5821::1` (when IPv4 refused but server up)
- **Password auth:** DISABLED (keys only)
- **Never commit private keys.** Private SSH keys, Ed25519 signing keys, EVM private keys, and mnemonics must NEVER be placed in the repo root or any tracked directory — even if `.gitignore` covers them. The only valid location for SSH keys is `~/.ssh/` (chmod 600). A stray `newzionssh.md` containing the production SSH private key was found and deleted 2026-07-09; do not recreate it.

### New Server Deployment (Autonomous 24/7)

The new server runs as the canonical primary node + pool + full stack. It must survive reboots without local PC intervention.

**Systemd services** (installed via `edge-deploy/systemd/`):
- `zion-edge-node1.service` — Core node (P2P:8333, RPC:9443)
- `zion-edge-node2.service` — Follower node (P2P:8334, RPC:8448)
- `zion-edge-pool.service` — Mining pool (Stratum:8444)
- `zion-edge-bridge.service` — Bridge relay (L2)
- `zion-edge-dao.service` — DAO scanner (L2)
- `zion-edge-atomic-swap.service` — Atomic swap (L2)
- `zion-edge-warp.service` — WARP relay (L3)
- `zion-edge-dex.service` — ZionDex router (L3)
- `zion-edge-oasis.service` — OASIS avatar hub (L4)
- `zion-edge-python-dashboard.service` — ZION V3 Dashboard (Python, port 8766)
- `zion-website.service` — Next.js 16.2.9 web2.9 (`app.zionterranova.com`)
- `zion-edge-watchdog.timer` — Health monitor (2-minute timer)
- `zion-edge-backup.timer` — Database backup
- `nginx` — Reverse proxy + SSL (ports 80/443)

**Web / public landing:**
- Public web `https://zionterranova.com` — OASIS intro landing page served by system nginx from `/var/www/maintenance/maintenance.html`
- `zion-website.service` — Next.js 16.2.9 web2.9 (`https://app.zionterranova.com`, `127.0.0.1:3000`)
- `zion-web` Docker image — legacy fallback path (currently not used)

**Environment file:** `/root/zion/edge-environment.sh` (chmod 600, `<REPLACE_*>` placeholders for air-gapped keys)

**Data directory:** `/data/zion/` (state, bridge DB, DAO DB)

**Persistence:**
- Node state: `/data/zion/state/`
- Bridge DB: `/data/zion/bridge-mainnet.db`
- DAO DB: `/data/zion/dao-mainnet.db`
- Repo: `/root/zion/2.9.6/` (git clone at commit `bed8ed2c`)

### Miner Deployment (v3.0.4 — New Server)

The new server HAS a Rust toolchain (1.96.1 stable). To deploy an updated miner binary:

1. **Build on server:**
   ```bash
   ssh zion-new 'cd /root/zion/2.9.6 && source ~/.cargo/env && cargo build --release -p zion-miner'
   ```

2. **Or build locally and scp:**
   ```bash
   scp V3/target/release/zion-miner zion-new:/usr/local/bin/zion-miner
   ```

3. **Run headless CPU miner (required: `ZION_INTERACTIVE=false`):**
   ```bash
   export ZION_POOL_ADDR=127.0.0.1:8444
   export ZION_WORKER_NAME=edge-cpu
   export ZION_MINER_ID=edge-cpu-01
   export ZION_LOOP_COUNT=1000000
   export ZION_PAYOUT_ADDRESS=zion16825y2v5f3q507e5c2e0j8n666z43558l3zt604
   export ZION_MINER_ALGORITHM=deeksha_lite_v1
   export ZION_THREADS=2
   export ZION_INTERACTIVE=false
   nohup /usr/local/bin/zion-miner >> /var/log/zion-miner.log 2>&1 &
   ```

### Backup Infrastructure (Local + New Server)

**New server backup (v3.0.4):**
- Script: TBD (create `zion-backup.sh` — backup `/data/zion/` + systemd units + nginx config + docker-compose)
- Destination: `/data/zion/backups/`
- Includes: node state, bridge DB, DAO DB, systemd units, nginx config, docker-compose, environment file
- Recommended: `cron` job every 15 min or systemd timer

**Local W11 backup:**
- Script: `scripts/local-core-backup.ps1`
- Launcher: `ZionStart/windows/backup-local-core.bat`
- Destination: `C:\ZION-AutoBackups\`
- Includes: V3/data, all `.db` files, configs, git ref, health.json

**Dashboard Backups tab:**
- Endpoint: `/api/backup/status`
- Shows: Local Core health + server health
- Auto-refresh: 15 seconds

**Known issue — Czech locale:**
PowerShell `ConvertTo-Json` emits Czech decimal commas on Czech Windows. Fix: wrap generation in `[System.Globalization.CultureInfo]::InvariantCulture`.

### Genesis Configuration (v3.0.0 Mainnet)

**Current Genesis Hash (post-regeneration 2026-06-07):**
```
7543004c76b11416ef32e2f1f5a4c72f0178f841d4559bf476e29e15a9602728
```

**Premine Distribution (16.78B total):**
- ZION OASIS (Slots 1-3): 1.65B each → 4.95B total (Slots 4 & 5 repurposed to L5 Free World Projects — 3.3B total)
- L6 Issobella — Orbital Station & Quantum Research (Slot 6): 2.5B (repurposed from DAO Treasury; LOCKED height 144,000)
- DAO Treasury - Grants (Slot 7): 1B (LOCKED height 144,000)
- DAO Treasury - Bootstrap (Slot 8): 0.5B (LOCKED height 144,000)
- Core Development Fund (Slot 9): 1B
- Network Infrastructure (Slot 10): 1B
- Genesis Projects (Slot 11): 590M (0.59B)
- Bridge Seed Fund (Slot 12): 0.4B
- Humanitarian (Slot 13): 1.44B
- Bridge Vault UTXO (Slot 14): 0.1B

**Canonical Addresses (V2 JSON 2026-08-06):**
- Humanitarian: `zion1y3w4z0c755v4y7t3f0k6s54390x0h3k3y5hv8c8`
- ISSOBELLA: `zion1z4s3a54266f2x7j4x7c27297k49752t7k52l0f0`
- Pool Fee: `zion1l0h428f536s6u3x7h5f0d5c2z644j7t8u8va3x0`
- Default Miner: `zion1074344t7k686j6n8a0l6t0f4c8d828y083xh4m2`
- Pool Payout: `zion1d2k5v0p6p2z667l7g522v2z0w0y6e7w742zq8k6`
- Genesis Projects: `zion122v8f8g55398f4g884k7j482h3z845j6c6ta4f8` (590M ZION, premine slot 11)
- Bridge Vault: `zion1j3w3h7k8m635h734y786j5804305m822t5uk546` (100M ZION, premine slot 14)
- Bridge Seed Fund: `zion1t6z3c0f0p3h0v233a3h432k5h764j0r3n5ml756` (400M ZION, premine slot 13)

**Fee Split Configuration:**
- Miners: 89%
- Humanitarian: 5%
- ISSOBELLA: 5%
- Pool Fee: 1%

**Canonical Units (FLOWERS_PER_ZION):**

> **⚠️ CRITICAL: All amounts in L1 core, RPC, wallet code, and on-chain transactions are in FLOWERS (10^-6 ZION), not ZION.** *(updated to 6-decimal in 3.0.3 fork)*

- **1 ZION = 1,000,000 flowers** (10^6, one million)
- Canonical constant: `FLOWERS_PER_ZION = 1_000_000` (Rust) / `1000000` (JS/TS)
- Defined in: `V3/L1/core/src/emission.rs:11` (canonical source), `wallet.rs:156`, `blockchain.js:17`
- RPC returns amounts in flowers: `balance_flowers`, `amount_flowers`, `fee_zion` (confusingly named but contains flowers)
- UI/dashboard converts: `flowers / 1_000_000` → ZION for display
- Account transactions: `amount_zion` field contains flowers (1000 = 0.001 ZION)
- UTXO transactions: `amount` field contains flowers (same unit)

**Conversion examples:**
- 0.001 ZION = `1_000` flowers (1 thousand)
- 1 ZION = `1_000_000` flowers (1 million)
- 1000 ZION = `1_000_000_000` flowers (1 billion)
- Genesis Projects (Slot 11): 590 million ZION = `590_000_000_000_000` flowers (590 trillion)

**Verification:**
```javascript
const FLOWERS_PER_ZION = 1_000_000n;
const flowers = 590_000_000_000_000n; // Genesis Projects balance
const zion = flowers / FLOWERS_PER_ZION; // = 590_000_000 ZION = 590 million
```

**⚠️ Common mistake:** RPC returns `balance_flowers: "590000000000000"` which is 590 **million** ZION, not 590 billion. Always divide by 10^6 to get ZION.

**⚠️ Live RPC contract drift (verified 2026-06-25 against old Edge `http://77.42.71.94:8443/jsonrpc` — HISTORICAL, server decommissioned):**

The L1 wire format currently uses **three coexisting suffix conventions**.
Until the next non-breaking contract bump lands, agents and clients MUST
be aware of all three. Full per-method JSON samples are documented in
[`docs/CANONICAL_UNITS_AUDIT.md`](../../../docs/CANONICAL_UNITS_AUDIT.md) §3b.

| Convention | Where it appears | How to consume |
|------------|------------------|----------------|
| `_flowers` ✅ canonical | `getBalance` (`balance_flowers`, `account_balance_flowers`, `utxo_balance_flowers`), pool metrics, wallet endpoints | Divide by `FLOWERS_PER_ZION` for display ZION |
| `_atomic` ⚠️ naming drift | `getSupplyInfo` (`block_reward_atomic`, `circulating_supply_atomic`, `mined_so_far_atomic`, `total_supply_atomic`, etc.), DAO daemon (`available_atomic`, `amount_atomic`) | **Treat as flowers** — same math, only the suffix is non-canonical |
| `_zion` containing flowers ❌ BUG | `getBlockTemplate` (`reward_zion`, `estimated_miner_reward_zion`, `total_fees_zion`) | **Treat as flowers** — DO NOT render directly as ZION; the field is mis-named. Divide by `FLOWERS_PER_ZION` first |

**Rule for new RPC methods:** Use only `_flowers` (on-the-wire) and
`_zion` (genuine display floats, ≤ 6 decimal places). Never overload
`_zion` with raw flowers values. Cross-chain bridge code adds `_wei`
for EVM-side amounts (18 decimals; `flowers × 10¹² = wei`).

**Authoritative docs for unit work:**
- [`docs/CANONICAL_UNITS_AUDIT.md`](../../../docs/CANONICAL_UNITS_AUDIT.md) —
  full audit, live JSON samples, recommended L1 contract bump (§3b.5),
  backend endpoint matrix, explorer endpoint canon.
- [`docs/WARP_ARCHITECTURE.md`](../../../docs/WARP_ARCHITECTURE.md) —
  cross-chain decimal table (corrected 2026-06-25: L1 = 6 decimals,
  updated 3.0.3 fork).

### Genesis Backup/Restore (Dashboard Integration)

**New Feature (2026-06-03):**
- **Location:** Dashboard tab "Launch Day" → "💾 Genesis Backup/Restore"
- **API Endpoint:** `/api/genesis-backup` with actions: list, create, restore, delete
- **Encryption:** 256-bit AES with HMAC verification
- **Multi-redundancy:** 3 copies per backup (original + 2 redundant copies)
- **Backup Location:** `backups/genesis-backup/` in repository root
- **Supported Files:**
  - Encrypted wallet keys (PREMINE_KEYS_ENCRYPTED_2026-06-03.txt, POOL_PAYOUT_KEY_ENCRYPTED_2026-06-03.txt, BRIDGE_VALIDATOR_KEYS_ENCRYPTED_2026-06-03.txt)
  - Genesis configuration (genesis.rs, fee.rs, crypto.rs)
  - Public addresses (PREMINE_ADDRESSES_PUBLIC.txt)
  - Documentation (AGENTS.md)

**Usage:**
1. Open dashboard at `http://127.0.0.1:8766`
2. Navigate to "Launch Day" tab
3. Scroll to "💾 Genesis Backup/Restore" section
4. Use buttons: List Backups, Create Backup, Restore Backup, Delete Backup
5. Automatic 3-copy redundancy for data safety


## Current Status (2026-07-13 — Post Hard Reset + Chv3 + AuxPow RVN/XMR Live)

**System Status (new server 62.171.141.136):**
- ✅ Hard Genesis Reset: Complete (2026-07-07) — new genesis hash `4f75a0dfe6dde3b167287d445aa1ade56577b0e9166c641ed288b4c20a79bd6e`
- ✅ zion-edge-node1: Running (P2P 8333, RPC 127.0.0.1:9443, WS 127.0.0.1:8445, metrics 127.0.0.1:9100) — **height 4357+** (pool-mined blocks accepted)
- ✅ zion-edge-node2: Running (follower, P2P 8334, RPC 127.0.0.1:8448)
- ✅ zion-edge-pool: Running (Stratum 0.0.0.0:8444, metrics 127.0.0.1:8455, fee split 89/5/5/1) — 10+ mineri, ~336 KH/s, 146 blocks found, 100% accept rate
- ✅ zion-edge-bridge: Running (metrics 127.0.0.1:9101, EVM: OP, Base, ARB, AVAX)
- ✅ zion-edge-dao: Running (API 127.0.0.1:8450, scanner → 127.0.0.1:9443)
- ✅ zion-edge-warp: Running (0.0.0.0:8453, 499 tests, 13 chain adapters + Solana + Stellar)
- ✅ zion-edge-atomic-swap: Running (Base HTLC, scanner → 127.0.0.1:9443)
- ✅ zion-edge-python-dashboard: Running (127.0.0.1:8766, Basic Auth via DASHBOARD_USERS env) — Revenue System + R4 per-source report live
- ✅ zion-free-world: Running
- ✅ zion-issobella: Running
- ✅ zion-edge-oasis: Running (API 127.0.0.1:8094, metrics 127.0.0.1:9102)
- ✅ zion-edge-watchdog: Running (timer, 2 min interval, RPC → 127.0.0.1:9443)
- ✅ zion-edge-dex: Running (127.0.0.1:8454, 7 chains live, 28 tests, cross-chain AMM routing)
- 🔲 zion-edge-lnd: Pending deploy (Docker: LND 8080/10009/9735 + bitcoind 18332/18333)
- ✅ nginx: Running (80/443, SSL Let's Encrypt, HTTP/2)
- ✅ Website: Running (Docker `zion-web`, Next.js 16.2.9, 73+ routes, port 127.0.0.1:3000)
- ✅ Dashboard: Running (`https://dashboard.zionterranova.com`, Basic Auth Yose/Issy)
- ✅ AuxPow: **LIVE** — RVN/KawPow E2E ✅ via `rvn.2miners.com:6060`, XMR/RandomX pool-side ready via `gulf.moneroocean.stream:10001` (awaiting RandomX rig miner)
- ✅ DeekshaChv3: Phase A deployed (alias, fork at H=4500) + Phase B deployed (stream telemetry)
- ✅ Chain: Height 5800+ (post-hard-reset), premine 16.78B ZION, 31.33M mined, block reward 5400.067 ZION
- ✅ OS: SSH keys-only, UFW (22/80/443), fail2ban, Docker 29.6.1
- ✅ Monitoring: 3 cron jobs + systemd watchdog timer (2 min)
- ✅ SSL: 3 Let's Encrypt certs (zionterranova.com, www, dashboard) — auto-renew

**Old Edge server (77.42.71.94): DECOMMISSIONED** — all services migrated to new server.

**Pending (owner akce):**
1. ~~Air-gapped klíče~~ ✅ DONE — key rotation proběhla, escrow SK aplikován, EVM/guardian SKs na flash disku
2. Minery — připojit k `62.171.141.136:8444`
3. DNS aplikace — `dns.md` zónový soubor v Webglobe admin console
4. ~~F4.7 aktivace~~ ✅ DONE — `ZION_MAX_TX_AMOUNT_HEIGHT=1` aktivní
5. ~~Key rotation F4.x~~ ✅ DONE — owner air-gapped
6. ~~Git history scrub~~ ✅ DONE — BFG scrub proběhl
7. EVM contract redeploy (ZION-2026-005) — nové kontrakty s novými admin klíči + multisig
8. Externí audit genesis konfigurace — před public launch
9. Re-clone repo (all collaborators) — git history přepsána filter-repo

### F5 Coinbase Balance Fix + Pool Logging + Template Cache (2026-07-12)

**Root cause:** Node stuck at height 3886 — pool repeatedly found block 3887 but node silently rejected it. Debugging via manual RPC `submit_candidate` revealed: `"locally mined block failed validation: peer block TX from zion1e4489793c5x2r0a0a4d8z7r4u5d6k0s4k3ht5m2 has insufficient balance: 394477888 < 480605963"`. The F5 balance check was incorrectly applied to **coinbase transactions** — coinbase TXs create new coins and have no sender balance to validate.

**Fixes deployed (2026-07-12):**

1. **F5 Coinbase Exempt** (`V3/L1/core/src/lib.rs`):
   - `validate_peer_block()`: Added `transaction.from != "coinbase" && transaction.from != "genesis"` to F5 balance check condition
   - `insert_transaction()`: Same exempt for mempool TXs (defense-in-depth)
   - Coinbase and genesis TXs are now exempt from sender balance validation in both code paths

2. **Pool: Node Rejection Logging** (`V3/L1/pool/src/bin/server.rs`):
   - `submit_candidate_to_node()` now logs `node_rejected_block height=X nonce=Y reason=Z` when node rejects a block (previously silent — root cause was obscured)
   - Also logs `node_accepted_block height=X nonce=Y` on successful submission for full visibility

3. **Pool: Template Cache Invalidation** (`V3/L1/pool/src/bin/server.rs`):
   - `TemplateCache::invalidate()` method added
   - Called immediately after block acceptance (`block_accepted == true`) so miners get fresh template (height+1) without waiting for 3s TTL
   - Prevents miners from working on stale template after a block is found

**Result:** Node synced 3886→4035 via P2P from Node2, then accepted first pool-mined block 4036 (`node_accepted_block height=4036 nonce=21000320582`). Pool: 3100 shares, 100% accept rate, 0 rejected. AuxPow scheduler reconnected to KAS automatically.

**Commits:** `0a58b5be4` (dashboard AuxPow panel expansion — same deploy session)

**Windows 11 GPU Miner Build Workaround (2026-06-07):**
- `cargo build --release` fails on Windows 11 because `zion-miner.exe` in `V3/target/release/` is locked (Defender/antivirus).
- **Use absolute `CARGO_TARGET_DIR` to a fresh directory:**
  ```bash
  CARGO_TARGET_DIR="/c/Users/yosef/Desktop/Zion/2.9.6-main/V3/target3" cargo build --release --manifest-path V3/Cargo.toml -p zion-miner --features gpu-opencl
  ```
- Canonical launch script: `ZionStart/windows/start-miner-target3.bat` (reads from `V3/target3/release/`).
- Do NOT commit `target2/` or `target3/` to git.

**GPU Benchmark Results (RX 5700 XT, gfx1010:xnack-, work_size=8192, 2026-06-07):**
- DeekshaLite v1: **7.24 KH/s** (was ~3.89 KH/s before kernel optimization — +86%)
- Cosmic Harmony v2: **3.08 KH/s** (was ~1.1 KH/s before — +180%)
- Optimizations: host-precomputed Keccak256 header state + vectorized `ulong4` scratchpad ops.

**Next Steps:**
- Fix auto-backup script to capture live DB state
- ~~Complete bridge validator 3/5 setup~~ → ✅ 5/5 validators configured (2026-06-29)
- ~~Reverse bridge (EVM→L1)~~ → ✅ FULLY OPERATIONAL — E2E test passed (2026-06-29)
- Deploy ZIONStaking + ZIONFarm on Base Mainnet (needs ETH for gas)
- External audit of genesis configuration
- **MAINNET LAUNCH READY** — All critical systems operational

### Bridge Vault — Canonical Reference (IMPORTANT)

**Live vault (post V2 reset 2026-08-06):** `zion1j3w3h7k8m635h734y786j5804305m822t5uk546` (100M ZION genesis premine, slot 14)
**Source:** `V31_PREMINE_V2_KEYS_2026-08-06.json` — mnemonic wallet, not a keyless seed. `V31/L1/core/src/fee.rs::BRIDGE_VAULT_ADDRESS` and `V31/L1/core/src/v3_compat.rs::PREMINE_OUTPUTS[13]`.

**Old vault (pre-V2 reset):** `zion1j53677g5k83030x3s2z2z644e7h07792q0u02t7` (keyless, seed `"ZION Bridge Vault V3 Mainnet v2 2026-07-06-HARD-RESET"`)
This address is no longer active after the 2026-08-06 V2 hard genesis reset.

**Bridge validators drop-in (v3.0.4):** Validator keys configured via `ZION_BRIDGE_VALIDATOR_SK_1..5` in `/root/zion/edge-environment.sh` (placeholder `<REPLACE_EVM_VALIDATOR_SK_*>` — air-gapped generation pending).
- `ZION_BRIDGE_VALIDATOR_PUBKEYS` = 5 compressed secp256k1 pubkeys (comma-separated)
- `ZION_BRIDGE_VALIDATOR_THRESHOLD` = `5`

---


## Vega 64 SMOS Deploy & Tuning (2026-06-13)

### Overview
Vega 64 (gfx900:xnack-, 64 CUs, 8GB HBM2) deployed on SMOS rig 518837 via custom miner ZIP.

### SMOS ZIP Structure Requirement
SMOS requires **exactly one folder** inside the ZIP; files must be inside `foldername/`, not loose in root:
```
zion-sm3042c-fire-vX.zip
└── zion-sm3042c-fire-vX/
    ├── miner          # wrapper script (sets ZION_MINER_ALGORITHM + execs binary)
    └── zion-miner     # actual binary
```
**Critical:** Each new version must use a **different ZIP filename** to bypass SMOS local cache.

### Docker Build (Ubuntu 20.04 → GLIBC 2.28 compatible)
Build on new server (62.171.141.136) using `V3/Dockerfile.miner-smos`:
- Ubuntu 20.04 builder + runner
- Rust 1.85.0
- Remove bundled `libOpenCL.so` (compiled for newer GLIBC)
- Provide local `gettid()` syscall wrapper to avoid GLIBC_2.30 dependency
- Binary max GLIBC: 2.28-2.29 (SMOS-compatible)

### Deployed Versions
| Version | ZIP URL | Changes |
|---------|---------|---------|
| v1 | `zion-sm3042c-fire-v1.zip` | Initial Fire ZIP, stale binary |
| v3 | `zion-sm3042c-fire-v3.zip` | Fresh Docker build, GPU fallback fix |
| v4 | `zion-sm3042c-fire-v4.zip` | crossterm dep, missing sources fixed |
| v5 | `zion-sm3042c-fire-v5.zip` | GPU manager permanent disable fix |
| v6 | `zion-sm3042c-fire-v6.zip` | work_size up, `-cl-mad-enable` removed, pool nonce 262144→524288 |
| v7 | `zion-sm3042c-fire-v7.zip` | local_ws 256→64, `-cl-denorms-are-zero`, remove `aligned(8)` — **caused error, reverted** |
| **v8** | `zion-sm3042c-fire-v8.zip` | **Reverted to stable v6 params: local_ws=256, aligned(8) restored** |

### SMOS Group Config (1773590 ZionLiteFire)
```
http://62.171.141.136/zion-miner/zion-sm3042c-fire-v8.zip \
  --algorithm deeksha_lite_fire \
  --pool 62.171.141.136:8444 \
  --wallet zion1m883u5h7t8l2q6y44670c6q5l067v4u2a3ku332 \
  --worker vega-smos
```

### Vega 64 Tuning Parameters (v8)
| Param | Value | Rationale |
|-------|-------|-----------|
| work_size (Fire) | 16384 | 2× v6; fills 8GB HBM2 efficiently |
| work_size (Lite v1) | 16384 | Same for both algorithms |
| local_ws | 256 | Stable work-group size for GCN memory coalescing |
| vram_pct | 85% | Safe HBM2 utilization with headroom |
| build_opts | `-cl-std=CL1.2` | Minimal flags, avoids driver regressions |
| Pool nonce_count_gpu | 524288 | Bigger batches = less CPU-GPU sync overhead |

### Code Changes in This Session
1. **`V3/L1/miner/src/main.rs`** — GPU no longer permanently disabled on init failure; retries every iteration
2. **`V3/L1/miner/src/gpu_guard.rs`** — Vega 64 tuning: work_size ↑ to 16384, local_ws=256 (stable), vram_pct=85%
3. **`V3/L1/cosmic-harmony/src/gpu/kernels/deeksha_lite_fire.cl`** — Kept `__attribute__((aligned(8)))` on thermal_loop (stable on GCN)
4. **`V3/L1/miner/Cargo.toml`** (Edge only) — Added `crossterm = "0.28"` dependency
5. **`V3/L1/miner/src/interactive.rs`** / **`ui.rs`** — Restored missing source files on Edge

### Performance Timeline
| Stage | Fire Hashrate | Notes |
|-------|---------------|-------|
| Initial (stale binary) | ~4.5 KH/s | Wrong algo (Lite v1), old binary |
| v5 (GPU fix) | ~8.5 KH/s | Fire finally running, work_size=8192 |
| v6 (tuning) | ~8.5 KH/s | work_size↑, pool nonce↑ |
| v7 (wavefront) | unstable | local_ws=64, `-cl-denorms-are-zero` — caused runtime error |
| v8 (revert) | **~8.5 KH/s** | Reverted to stable v6 params |
| + 1450 MHz OC | **~10 KH/s** | Core clock from 1250→1450 MHz |

### How to Update Miner on SMOS
1. Build new Docker image on Edge: `docker build -f Dockerfile.miner-smos -t zion-miner-smos .`
2. Extract binary, create ZIP with **new filename**
3. Upload to `/var/www/zion-miner/`
4. Update SMOS group `minerOptions` via API or dashboard
5. Restart rig via SMOS dashboard (Actions → Restart)

### Operational Scripts (root repo)
- `check_rig.py` — poll SMOS rig status
- `check_group.py` — poll SMOS group config
- `deploy_*.py` — various deploy scripts (SMOS API)
- `explore_smos_api.py` — SMOS API exploration

### Pool Environment (New Server v3.0.4)
File: `/root/zion/edge-environment.sh` (v3.0.4 — new server, chmod 600, `<REPLACE_*>` placeholders for air-gapped keys)
```
ZION_POOL_BIND=0.0.0.0:8444
ZION_POOL_LOOP_COUNT=1000000
ZION_NONCE_COUNT=1048576
ZION_NONCE_COUNT_GPU=524288
ZION_JOB_TTL_MS=60000
```
Restart after change: `systemctl restart zion-pool.service`
```

---

## New Server Complete Reference (v3.0.4 — 62.171.141.136)

### Server Specs

| Param | Value |
|-------|-------|
| IP | `62.171.141.136` |
| Hostname | `vmi3425821` |
| OS | Ubuntu 24.04.4 LTS |
| CPU | 4× AMD EPYC |
| RAM | 7.8 GB |
| Disk | 145 GB (6% used) |
| Rust | 1.96.1 stable (rustup) |
| Docker | 29.6.1 + Compose v5.3.1 |

### SSH Access

| Param | Value |
|-------|-------|
| Alias | `ssh zion-new` (in `~/.ssh/config`) |
| Key | `~/.ssh/zion-edge-post-wipe-2026-07-29` (ed25519) |
| Fingerprint | `SHA256:UOjWE5K22kyJ0Xgxdt/+cySZlErHFQ/y+M9uM/2zmY4` |
| Password auth | DISABLED (keys only) |
| VNC fallback | `95.111.232.25:63061` (RFB, password `<retrieve from password manager>`) |

### Firewall (UFW)

| Port | Protocol | Source | Purpose |
|------|----------|--------|---------|
| 22 | TCP | Anywhere | SSH |
| 80 | TCP | Anywhere | HTTP (nginx redirect) |
| 443 | TCP | Anywhere | HTTPS (nginx SSL) |

All other ports (8333, 8444, 8453) are **not** in UFW — they bind to 0.0.0.0 but are blocked by firewall. P2P (8333) and Pool (8444) need UFW ALLOW when miners/peers connect from public internet.

### fail2ban

- Jail: `sshd` — SSH brute-force protection
- Status: `fail2ban-client status sshd`

### Genesis (v3.0.4 Hard Reset)

| Param | Value |
|-------|-------|
| Genesis hash | `4f75a0dfe6dde3b167287d445aa1ade56577b0e9166c641ed288b4c20a79bd6e` |
| Premine | 16,780,000,000 ZION |
| Block reward | 5400.067 ZION |
| Mining emission | 127,220,000,000 ZION |
| Fee split | 89% miner / 5% humanitarian / 5% issobella / 1% burn |
| Bridge vault seed | `"ZION Bridge Vault V3 Mainnet v2 2026-07-06-HARD-RESET"` |
| Migration height | 1 (fresh chain, `ZION_MIGRATION_HEIGHT=1`) |

### Binaries (in `/usr/local/bin/`)

| Binary | Source | Size |
|--------|--------|------|
| `zion-node` | `cargo build --release -p zion-core --bin node` | 2.96 MB |
| `zion-pool-server` | `cargo build --release -p zion-pool --bin server` | 2.35 MB |
| `zion-bridge` | `cargo build --release -p zion-bridge` | 10.1 MB |
| `zion-dao` | `cargo build --release -p zion-dao` | 5.47 MB |
| `zion-warp-server` | `cargo build --release -p zion-warp` | 9.23 MB |

### Data Directories

| Path | Content |
|------|---------|
| `/data/zion/state/` | Node blockchain state |
| `/data/zion/bridge-mainnet.db` | Bridge relay SQLite DB |
| `/data/zion/dao-mainnet.db` | DAO scanner SQLite DB |
| `/root/zion/2.9.6/` | Git repo (clone at commit `bed8ed2c`) |
| `/root/zion/edge-environment.sh` | Environment file (chmod 600) |
| `/root/zion-web-next/` | Next.js web source + Dockerfile + docker-compose.yml |
| `/root/zion-dashboard/` | ZION_OS dashboard (Python) |

### Config Files

| Config | Path | Purpose |
|--------|------|---------|
| Bridge | `/root/zion/2.9.6/V3/L2/bridge/config/bridge-mainnet.toml` | Bridge relay config (6 EVM chains, DB path `/data/zion/bridge-mainnet.db`) |
| DAO | `/root/zion/2.9.6/V3/L2/dao/config/dao-mainnet.toml` | DAO config (DB path `/data/zion/dao-mainnet.db`) |
| WARP | `/root/zion/2.9.6/V3/L3/warp/config/warp-mainnet.toml` | WARP relay config |
| Nginx | `/etc/nginx/sites-available/zion` | Reverse proxy + SSL + security headers |
| Environment | `/root/zion/edge-environment.sh` | All env vars (chmod 600) |

### Environment Variables (`edge-environment.sh`)

Key variables (no `export` prefix — systemd `EnvironmentFile` format):

```
# L1 Node
ZION_NODE_ID="zion-new-mainnet-primary"
ZION_NODE_STATE_PATH="/data/zion/state"
ZION_P2P_BIND="0.0.0.0:8333"
ZION_RPC_BIND="127.0.0.1:9443"
ZION_WEBSOCKET_BIND="127.0.0.1:8445"
ZION_METRICS_BIND="127.0.0.1:9100"
ZION_SEED_PEERS="127.0.0.1:8333"
ZION_MIGRATION_HEIGHT=1

# Pool
ZION_POOL_BIND="0.0.0.0:8444"
ZION_POOL_SK="<REPLACE_POOL_SK>"

# Bridge
ZION_BRIDGE_CONFIG="/root/zion/2.9.6/V3/L2/bridge/config/bridge-mainnet.toml"
ZION_BRIDGE_DB="/data/zion/bridge-mainnet.db"
ZION_BRIDGE_VALIDATOR_SK_1..5="<REPLACE_EVM_VALIDATOR_SK_*>"

# DAO
DAO_CONFIG="/root/zion/2.9.6/V3/L2/dao/config/dao-mainnet.toml"
ZION_DAO_BIND="127.0.0.1:8450"
ZION_DAO_DB="/data/zion/dao-mainnet.db"
ZION_DAO_GUARDIAN_SK_1..7="<REPLACE_GUARDIAN_SK_*>"

# WARP
ZION_WARP_CONFIG="/root/zion/2.9.6/V3/L3/warp/config/warp-mainnet.toml"
ZION_WARP_DB="/data/zion/warp.db"

# Logging
RUST_LOG=info
ZION_LOG_BLOCK_SUBMITTER=1
```

### Docker

| Process | Type | Port | Purpose |
|---------|------|------|---------|
| `zion-website.service` | systemd / `npm start` (`next start`) | 127.0.0.1:3000 | Web2.9 Next.js at `app.zionterranova.com` |
| `zion-web` Docker image | `zion-web` | 127.0.0.1:3000 | Fallback/legacy Docker path (currently not used) |
| OASIS intro | `nginx` (system) | 80/443 | One-page intro at `zionterranova.com` |
| OASIS Web | `nginx` (system) | 80/443 | Visual OASIS at `oasis.zionterranova.com` |

**Web2.9 service:** `zion-website.service` — `next start` on `127.0.0.1:3000`, runs as `zion` user from `/opt/zion/APP&WEB/website-v2.9/`, source updated via `deploy-web2.9.sh`.
**Legacy Docker compose:** `/root/zion-web-next/docker-compose.yml` — not currently used.

### Nginx Reverse Proxy

| Domain | Upstream | SSL Cert |
|--------|----------|----------|
| `zionterranova.com` | `/var/www/maintenance/maintenance.html` (static intro) | Let's Encrypt (zionterranova.com + www) |
| `app.zionterranova.com` | `127.0.0.1:3000` (Next.js web2.9) | Let's Encrypt (app.zionterranova.com) |
| `oasis.zionterranova.com` | `/var/www/oasis/index.html` (static OASIS) | Let's Encrypt (oasis.zionterranova.com) |
| `dashboard.zionterranova.com` | `127.0.0.1:8766` (Dashboard) | Let's Encrypt (dashboard.zionterranova.com) |
| `/api/rpc` | `127.0.0.1:9443` (node RPC, nginx 8443 → 9443) | (via main domain) |
| `/api/dao` | `127.0.0.1:8450` (DAO API) | (via main domain) |

**Security headers:** HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy
**HTTP/2:** enabled
**HTTP→HTTPS redirect:** enabled

### Monitoring

| Job | Interval | Script | Purpose |
|-----|----------|--------|---------|
| Forged TX monitor | 5 min | `/usr/local/bin/zion-monitor-forged.sh` | Scan node logs for forged/invalid signature |
| Height monitor | 5 min | `/usr/local/bin/zion-monitor-height.sh` | Check RPC reachable, auto-restart node if down |
| P2P alert | 2 min | `/usr/local/bin/zion-monitor-p2p.sh` | Alert on high P2P connection rate |
| Watchdog | 2 min | `/usr/local/bin/zion-watchdog.sh` (systemd timer) | RPC + TCP health, auto-restart |

### SSL Certificates (Let's Encrypt)

| Domain | Cert Path | Expiry | Auto-renew |
|--------|-----------|--------|------------|
| `zionterranova.com` + `www.zionterranova.com` | `/etc/letsencrypt/live/zionterranova.com/` | 2026-10-05 | ✅ |
| `dashboard.zionterranova.com` | `/etc/letsencrypt/live/dashboard.zionterranova.com/` | 2026-10-05 | ✅ |

### Dashboard Access

| Param | Value |
|-------|-------|
| URL | `https://dashboard.zionterranova.com` |
| Auth | HTTP Basic Auth (handled by `app.py`) |
| User 1 | `Yose` (password: `<configured via DASHBOARD_USERS>`) |
| User 2 | `Issy` (password: `<configured via DASHBOARD_USERS>`) |
| Title | "ZION Mainnet — Launch Command Center" |

### Deploy Files (in repo)

All deploy files are in `V3/deploy/new-server/`:

| File | Purpose |
|------|---------|
| `edge-environment.sh` | Environment template (chmod 600, `<REPLACE_*>` placeholders) |
| `zion-node.service` | systemd unit for zion-node |
| `zion-pool.service` | systemd unit for zion-pool |
| `zion-bridge.service` | systemd unit for zion-bridge |
| `zion-dao.service` | systemd unit for zion-dao |
| `zion-warp.service` | systemd unit for zion-warp |
| `zion-watchdog.sh` | Health check script |
| `zion-watchdog.service` | systemd oneshot for watchdog |
| `zion-watchdog.timer` | systemd timer (2-min interval) |

### Common Operations

```bash
# SSH
ssh zion-new

# Check all services
systemctl is-active zion-node zion-pool zion-bridge zion-dao zion-warp zion-dashboard nginx

# Check chain height
curl -s http://127.0.0.1:9443/jsonrpc -d '{"jsonrpc":"2.0","method":"getSupplyInfo","id":1}' | python3 -c "import sys,json; d=json.load(sys.stdin)['result']; print(f'height={d[\"height\"]} supply={d[\"circulating_supply_zion\"]:,}ZION')"

# Check genesis hash
journalctl -u zion-node --no-pager -n 50 | grep tip_hash_hex | tail -1

# Deploy web2.9 (Next.js) to app.zionterranova.com
cd <repo>/apps/website-v2.9 && bash deploy/deploy-web2.9.sh  # build, rsync to /opt/zion/APP&WEB/website-v2.9, chown, restart zion-website.service

# Update OASIS intro landing page (served from /var/www/maintenance)
cd <repo>/apps/website-v2.9 && bash deploy/deploy-oasis-intro.sh  # rsync public/maintenance.html + stargate/ + reload nginx

# View logs
journalctl -u zion-node -f
journalctl -u zion-pool -f
docker logs zion-web -f

# Update environment
vi /root/zion/edge-environment.sh
systemctl daemon-reload
systemctl restart zion-node zion-pool zion-bridge zion-dao zion-warp

# Rebuild binaries after code change
cd /root/zion/2.9.6 && source ~/.cargo/env
cargo build --release -p zion-core --bin node -p zion-pool --bin server -p zion-bridge -p zion-dao -p zion-warp
cp V3/target/release/node /usr/local/bin/zion-node
cp V3/target/release/server /usr/local/bin/zion-pool-server
cp V3/target/release/zion-bridge /usr/local/bin/zion-bridge
cp V3/target/release/zion-dao /usr/local/bin/zion-dao
cp V3/target/release/zion-warp-server /usr/local/bin/zion-warp-server
systemctl restart zion-node zion-pool zion-bridge zion-dao zion-warp
```


## Memory pressure incident 2026-07-24

**Symptom:** Edge server `62.171.141.136` showed `used` memory climbing to ~6.7 GiB and swap use, with `PageTables` ~870 MiB and each `zion-node` process mapping ~210 GiB of virtual address space (~211 k VMAs per process).

**Root cause:** `MALLOC_ARENA_MAX=1` was set in `/etc/zion/edge-environment.sh` and `/etc/zion/edge-node2-environment.sh`. With a single glibc arena, every short-lived P2P/RPC thread caused glibc to `mmap` new 2 MiB heap regions for the 256 KiB scratchpad `Vec` allocations used by `deeksha_lite` / `deeksha_chv3` / `deeksha_lite_fire`. The regions were not released, accumulating 100 k+ 2 MiB mappings per node and blowing up the kernel page-table memory.

**Fix applied:**
1. Removed `MALLOC_ARENA_MAX=1` from both Edge node environment files.
2. Restarted `zion-edge-node2.service` then `zion-edge-node1.service` (rolling restart).
3. Reduced `vm.nr_hugepages` from `1250` to `256` in `/etc/sysctl.conf`, `/etc/sysctl.d/99-hugepages.conf`, and `/etc/sysctl.d/99-sysctl.conf` (freed ~2 GiB of reserved but unused huge-page memory; kept 512 MiB in case a RandomX/XMR stream is activated later).

**Result:**
- `/proc/meminfo` `PageTables` dropped from ~870 MiB to ~15 MiB.
- `free` showed `used` drop from ~6.7 GiB to ~2.5 GiB, `available` up to ~5.3 GiB, swap use down to ~710 MiB.
- Each restarted node process now has ~200–400 VMAs instead of ~211 k.
- Node health, pool stratum listener, web, dashboard, and RPC all recovered.

**Prevention:** Do not set `MALLOC_ARENA_MAX=1` for the node/pool binaries. The default glibc arena count scales with core count and avoids single-arena `mmap` bloat. If huge pages are reserved, keep only what the active workload (e.g. RandomX dataset) actually needs.

### RTM GhostRider share validation fix (2026-07-27)

- **Symptom:** `rtm_live_test` against `ghostrider.eu.mine.zpool.ca:5354` submitted shares and received `[25,"Invalid share",null]`; CPU mined for tens of minutes with no accepted shares.
- **Root cause:** `V3/L1/native-ffi/csrc/ghostrider/real/gr.c` replicated `Raptor3um/yiimp-ghostrider`'s buggy `getAlgoString`: reverse byte order, high nibble first, and a loop that dropped the last selected algorithm. It also omitted the post-CryptoNight `memset` of the upper 32 bytes of the 64-byte hash buffer, so the next 64-byte core input was polluted by the previous 64-byte core output.
- **Fix:** Ported `gr.c` to the reference logic used by `cpuminer-gr-avx2`, `xmrig`, and the Raptoreum daemon:
  - `getAlgoString` reads previous-block hash bytes **forward**, **low nibble first**.
  - The final selected algorithm is written to the output array.
  - After each CN stage, `memset(&hash[8], 0, 32)` zeroes the upper half.
- **Verification:**
  ```bash
  cd /opt/zion/AuXpow && . /root/.cargo/env
  cargo build --release --features native-ghostrider --bin rtm_live_test
  cd /opt/zion && ./target/release/rtm_live_test
  ```
  Live run on Edge produced `*** SHARE ACCEPTED! ***` for job `22500` after ~10 min.
- **Notes:** The `mining.submit` 5-param format `[worker, job_id, extranonce2, ntime, nonce]` with `nonce` as the 8-char big-endian hex of the 32-bit value and `extranonce2 = "00000000"` is what zpool accepted; no `auxpow_client.rs` format change was required.

### Windows 11 AMD RX 5700 XT triple-stream tuning (2026-07-24)

- **Autotune (`zion-miner.exe --auto-tune`) reports:**
  - GPU: `gfx1010:xnack-` 18 CU / 6128 MiB
  - `ZION_GPU_WORK_SIZE=8192` (autotuned from `nearest_pow2(CUs * 512)`)
  - `ZION_SECONDARY_GPU_WORK_SIZE=4194304`
  - `ZION_THREADS=6`
  - `ZION_EXT_CPU_NONCE_COUNT=2000000`
- **Working `.bat` settings for ZION + ZANO + VRSC on a single RX 5700 XT:**
  ```batch
  set ZION_THREADS=12
  set ZION_GPU_WORK_SIZE=8192
  set ZION_SECONDARY_GPU_WORK_SIZE=4194304
  set ZION_EXT_GPU_BATCH_SIZE=2097152
  set ZION_EXT_CPU_NONCE_COUNT=2000000
  set ZION_AUXPOW_GPU_DAG_LWS=128
  set ZION_DAG_CACHE_DIR=%USERPROFILE%\.zion\dag-cache
  ```
- **Why:** `ZION_GPU_WORK_SIZE=16000` gets rounded to 16384 and produced a high rate of `SHARE_REJECTED` / `NoSolution` on ZION. Using the autotuned `8192` drops the reject rate. `ZION_EXT_GPU_BATCH_SIZE` should stay at the 2 M default on a shared GPU; 4 M starves the ZION stream and increases stale shares.
- **Dashboard `miner` service health:** The Edge dashboard `miner` health check was pointing at `http://127.0.0.1:8444` (stratum port, not HTTP) and failing with `Remote end closed connection`. Change the `miner` service `health_endpoint` to `http://127.0.0.1:8455/metrics` and parse `zion_pool_active_sessions` / `zion_pool_miners_tracked` instead. The Windows remote miner is then reflected as active when the pool has connected sessions.

### AuXpow algorithm verification status (2026-07-27)

- RTM/GhostRider is the only coin that has been live-verified to produce a pool-accepted share (`*** SHARE ACCEPTED! ***` on zpool).
- A full readiness matrix and gap checklist is maintained in [`V3/docs/AUXPOW_ALGORITHM_VERIFICATION_REPORT.md`](../../../archive/V3/docs/AUXPOW_ALGORITHM_VERIFICATION_REPORT.md).
- The main blockers for "full green all algos" are:
  - KawPow/Ethash CPU scans need per-epoch DAG management (`generate_kawpow_dag` / `generate_ethash_dag`).
  - ProgPow variants (EVR, MEWC, EPIC, ZANO) and Pearl (PRL) need real algorithms or GPU-only dispatch.
  - Several coins have no `miner_harness.rs` route or no implementation at all (FLUX/zelhash, BEAM/beamhash, VTC, IRON, NEXA, DNX, KRX, CKB, CFX, ZEC, PHX).

### GPU CUDA debug-pool verification (2026-07-27)

- **Hardware:** local Windows rig, NVIDIA GeForce GTX 1070 Ti 8 GB (compute 6.1), driver 581.57.
- **NVRTC install:** `py -m pip install --target C:\Zion\nvrtc_tmp nvidia-cuda-nvrtc-cu12`, then add `C:\Zion\nvrtc_tmp\nvidia\cuda_nvrtc\bin` to `PATH` before running the miner.
- **Build:** `cd V3; cargo build --release -p zion-miner --features gpu-cuda`.
- **Debug pool switch:**
  ```bash
  ssh zion-new
  systemctl stop zion-edge-debug-pool@<OLD>
  mkdir -p /etc/systemd/system/zion-edge-debug-pool@<COIN>.service.d
  # write coin.conf with ZION_POOL_AUXPOW_COIN / ZION_POOL_AUXPOW_WALLET / ZION_POOL_AUXPOW_WORKER_NAME
  systemctl daemon-reload && systemctl start zion-edge-debug-pool@<COIN>
  ```
- **Miner run for a fixed coin:**
  ```powershell
  $env:PATH = "C:\Zion\nvrtc_tmp\nvidia\cuda_nvrtc\bin;" + $env:PATH
  $env:ZION_AUTOTUNE = "0"
  $env:ZION_GPU_WORK_SIZE = "8192"
  $env:ZION_SECONDARY_GPU_WORK_SIZE = "5242880"
  $env:ZION_EXT_GPU_BACKEND = "cuda"
  $env:ZION_LOOP_COUNT = "1000000"
  $env:ZION_RECONNECT = "true"
  $env:ZION_STREAM3_ENABLED = "0"
  .\zion-miner.exe --pool 62.171.141.136:8461 --wallet <zion1-address> --worker <name> --gpu cuda --algorithm <algo> --no-tui
  ```
- **Key findings from this session:**
  - `zion-miner --gpu-benchmark-all` compiled and ran all CUDA kernels against an easy target.
  - `ETC`/`ethash` DAG generation is now fixed: `cuda_external.rs` launches `ethash_calculate_dag` in 524,288-node batches with a sync every 4 batches; epoch-0 DAG (~1 GB) builds in ~7 s on GTX 1070 Ti. The `ethash_mine` kernel was corrected to FNV-1 and `fnv(i ^ seed0, mix[i % 32])`; `gpu_backend.rs` now passes the 32-byte `header_hash` directly to `mine_batch_raw`. Benchmark finds a nonce; live share still pending.
  - `KAS`/`kheavyhash` long test ran at ~3.3 MH/s on GTX 1070 Ti through the debug pool for 120 s but the `GPU PROFIT` row remained `0/0`; only primary ZION shares were accepted. A longer run or lower test target is needed.
  - `autolykos` table is now cached per `(header, height)` and `cuda_external.rs` uses the 32-byte pre-pow hash and the real block height.
  - `auxpow_client.rs` now submits the correct 2miners `nonce2` (lower 6 bytes of the full 64-bit nonce). The Edge `zion-pool` `server` binary was rebuilt (`pool/Cargo.toml` needs `tracing-subscriber/env-filter` feature).
  - `ERG`/`autolykos` live test reaches `erg.2miners.com` and receives `[23,"Low difficulty share"]`. The remaining blocker is that the `autolykos_mine` CUDA kernel in `AuXpow/csrc/cuda/autolykos_kernel.cu` is a simplified placeholder (9-iteration table walk + single BLAKE2b) and does **not** implement the real Autolykos v2 algorithm (permutation indices, 32 table lookups summed, final BLAKE2b over the 32-byte sum). Shares therefore fail upstream validation.
  - `evrprogpow` / `meowpow` are now recognised by `CudaExtAlgo::from_name()` and routed to the ProgPow CUDA kernel with a 12000-block epoch. `CoinProfile::epoch_length()` for EVR/MEWC was corrected from 7500 to 12000.
  - **CUDA kernel verification sweep (2026-07-27):** `V3\target\release\zion-miner.exe --test-cuda-kernel <algo>` was run for the 10 GPU-relevant algorithms `kheavyhash`, `blake3_alph`, `blake3_dcr`, `autolykos`, `zelhash`, `ethash`, `kawpow`, `progpow`, `evrprogpow`, and `meowpow`. All 10 compiled with NVRTC (arch `compute_61`) and completed a 3 s benchmark. `ethash` CPU/GPU match confirmed (`ETHASH_CPU_GPU_MATCH`, ~117.6 MH/s with default work_size). `verushash` CUDA init was not tested because VRSC is intentionally CPU-mined via `native-verushash` / `hash_verushash`; the GPU `verushash` kernel is not a 3.0.7 blocker.
  - `AuXpow/src/external_hashers.rs::hash_ethash()` and `hash_ethash_with_dag()` were changed to always use the canonical `ethash` 0.4 crate (`hashimoto_light`/`hashimoto_full`), removing a `native-hashers` C-FFI shortcut that caused `ETHASH_CPU_GPU_MISMATCH` in builds with `native-hashers` enabled.
  - For coins not on 2miners/zpool BTC payout, coin-specific payout addresses are required; test wallets were saved to the desktop.
  - **GhostRider (RTM) native-ghostrider Windows/MSVC fix (2026-07-28):** The `native-ghostrider` feature (RTM / Raptoreum) could not be compiled with MSVC on Windows. Five root causes were identified and fixed in `V3/L1/native-ffi/`: (1) **VLA in `gr.c`** — `bool selectedAlgo[algoCount]` (C99 variable-length array, unsupported by MSVC) replaced with fixed-size `bool selectedAlgo[15]` (`HASH_FUNC_COUNT` is 15); (2) **VLA in `sph/fugue.c`** — the `ROR(n, s)` macro used `sph_u32 tmp[n]`, replaced with `sph_u32 tmp[15]` (n is at most 15); (3) **`#ifdef WIN32` → `#ifdef _WIN32`** in `oaes_lib.c` — MSVC defines `_WIN32`, not `WIN32`, so the POSIX branch (`<unistd.h>`) was taken on Windows; (4) **unguarded `#include <unistd.h>`** in all 8 `cryptonight*.c` files wrapped in `#ifndef _WIN32 … #else #include <io.h> #endif`; (5) **`alloca` linker error** — MSVC uses `_alloca` (from `<malloc.h>`), so `build.rs` now adds `b.define("alloca", "_alloca")` for MSVC builds. Additionally `/utf-8` is passed to MSVC (some sphlib sources contain em-dash/en-dash in comments; without `/utf-8` MSVC fails silently). Build command: `cargo build --release -p zion-miner --features "gpu-opencl,native-randomx,native-ghostrider,native-verushash"`. **Live verification:** miner run with `--cpu-coin RTM` against Edge pool `62.171.141.136:8444` (payout `zion16825y2v5f3q507e5c2e0j8n666z43558l3zt604`) produced RTM GhostRider shares at ~125–430 H/s; the Edge pool forwarded them to upstream zpool.ca and received `result=true` (accepted) — `external_share_result miner=local-miner coin=RTM accepted=true status=accepted`. Two RTM shares accepted upstream within ~90 s of mining. The `native-ghostrider` feature is now production-ready on Windows/MSVC alongside Linux.

### OASIS web (2026-07-30)

- **Location:** `apps/OasisWeb`
- **Stack:** Next.js 16 + React 19 + TypeScript, Tailwind CSS v4, React Three Fiber (`@react-three/fiber` + `@react-three/drei`), `three`, `zustand`, `framer-motion`.
- **Purpose:** Interactive 3D multiverse portal — display and explore OASIS worlds.
- **Build:** `cd apps/OasisWeb && npm install && npm run build`.
- **Deploy (static export):** `dist/` is exported to `/var/www/oasis` on Edge; nginx serves `https://oasis.zionterranova.com` (Let’s Encrypt SSL, HTTP/2).
