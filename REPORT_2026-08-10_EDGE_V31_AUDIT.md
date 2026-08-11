# ZION V31 Edge + Workspace Audit Report

**Date:** 2026-08-11
**Target:** Live Edge deployment (`62.171.141.136` / `vmi3425821.contaboserver.net`) vs. local V31 workspace `/Users/yeshuae/Projects/2.9.6`
**Auditor:** Devin
**Scope:** V31 services, binaries, configuration, network posture, documentation consistency, and open security/follow-up items

---

## 1. Executive Summary

The Edge server is running a **V31 mainnet-alpha deployment** built from local workspace version `3.1.0-beta`. Core L1 services (`zion-v31-node`, `zion-v31-pool`, `zion-v31-miner`, `zion-v31-dao`, `zion-v31-oasis`) and the web/dashboard services are active. The V31 pool is accepting shares, the PPLNS window is healthy (`window_total_difficulty ≈ 500 M`, `window_used = 5,075`), and recent payouts are being generated at chain heights 1594–1598.

**Key risks / inconsistencies found:**

1. **`zion-v31-multichain` (`warpd`) is `inactive (dead)`** — it has not run for ~21 hours, contradicting `StatusV3.md` and `AGENTS.md` which list it as V31 production active.
2. **Running Edge binaries are built from an *uncommitted* working tree** — `/opt/zion` has 20+ modified files and 30+ untracked files, including V31 core/pool/miner source. This means the live deployment cannot be reproduced from a clean commit.
3. **Multiple service/config mismatches:**
   - `zion-v31-miner` is a CPU-only `--no-gpu` lite miner, not the documented triple-stream GPU+CPU setup.
   - `zion-v31-pool` listens on `0.0.0.0:8080` for its HTTP API (docs say localhost-only).
   - `zion-dao` listens on `0.0.0.0:8456` (V31/AGENTS.md says `127.0.0.1:8456`).
   - `nginx` `/api/dao` proxy points to `127.0.0.1:8450`, but DAO is actually on `8456`.
   - `edge-v31-pool-environment.sh` still references stale port `8446` and window `10000`, while the live service uses `8444` and `500000000`.
4. **Public RPC `getStatus` returns `chain_height: 0` / `protocol_version: "3.0.5"`** while `getUtxos` on the same endpoint returns valid V31-native data. This indicates a stale or default response path.
5. **OASIS logs show a persistent JSON parse error** (`floating point 5400.067, expected u64`) on every new block.
6. **Several plaintext secrets remain on the Edge filesystem** (private keys, API keys, token, dev seed) in `edge-environment.sh`, `dao-v31.toml`, and `APP&WEB/MarketPlace/.env`. They are not in the tracked git working tree, but they are on the production host.
7. **The `ANKR` API key** from `docs/3.0.0/KeyForMainetLaunch.md` was previously committed in plaintext (per `SECURITY_AUDIT_REPORT.md`) and still needs rotation.
8. **UFW exposes many more ports to `Anywhere`** than the V31/AGENTS.md port matrix describes (e.g., `8445`, `8452-8454`, `8461-8463`, `9443`, `9999`), increasing attack surface while multichain/bridge are not actually listening.
9. **`logrotate.service` and `zion-dashboard-web.service` are failed** — system state is `degraded`.

---

## 2. Edge Deployment Audit

### 2.1 Host & SSH

| Item | Value |
|------|-------|
| Host | `vmi3425821.contaboserver.net` |
| IPv4 | `62.171.141.136` |
| IPv6 | `2a02:c207:2342:5821::1` |
| OS | Ubuntu 24.04.4 LTS |
| Disk | 43 GB / 145 GB used (30 %) |
| RAM | 1.7 GB / 7.8 GB used (26 %) |
| systemctl state | `degraded` |

SSH access was intermittent during the audit (port 2222 refused for short periods, then recovered). This is consistent with the `sshd` fail2ban jail (`maxretry 3`, `bantime 24h`) and/or UFW `LIMIT` on ports 22/2222 documented in `V31/AGENTS.md` §8.1 and the Edge `ufw` rules.

### 2.2 systemd Services

Running (`systemctl list-units --type=service --state=running | grep zion`):

```text
zion-edge-python-dashboard.service loaded active running ZION V31 Dashboard (Python, zero-dep, port 8766)
zion-marketplace.service           loaded active running ZION MarketPlace (Next.js — OASIS Artifact Marketplace)
zion-oasis-web.service             loaded active running ZION OASIS Web (oasis.zionterranova.com) — Next.js standalone
zion-v31-dao.service               loaded active running ZION V31 DAO Governance API
zion-v31-node.service              loaded active running ZION V31 Node (Primary)
zion-v31-node2.service             loaded active running ZION V31 Node 2 (Follower, P2P sync to Node 1)
zion-v31-node3.service             loaded active running ZION V31 Node 3 (Follower, P2P sync to Node 1)
zion-v31-oasis.service             loaded active running ZION V31 OASIS Game API
zion-v31-pool.service              loaded active running ZION V31 Pool (Primary)
zion-website.service               loaded active running ZION Website (Next.js)
```

Notable non-running / failed units (`systemctl list-units --all | grep zion`):

| Service | State | Note |
|---------|-------|------|
| `zion-v31-multichain.service` | `inactive (dead)` | Stopped ~21h ago (Aug 10 10:19 CEST). Binary `warpd` exists but service is down. |
| `zion-v31-watchdog.service` | `inactive (dead)` | One-shot triggered by timer; last run exited `0/SUCCESS`. |
| `zion-v31-miner.service` | active | Described as “ZION + VRSC CPU, no GPU, 0.5 CPU core”. |
| `zion-dashboard-web.service` | failed | Legacy Flask dashboard; superseded by `zion-edge-python-dashboard`. |
| `zion-node.service` / `zion-pool.service` | inactive (dead) | Legacy V3 units, expected post-cutover. |
| `logrotate.service` | failed | Duplicate log-entry config in `zion-edge` and `zion-pool` drop-ins. |

Node status:
- Primary node height **~1588–1598** (logs show accepted blocks up to `height=1588`; pool payouts reference blocks up to `height=1598`).
- Follower nodes `node2` (RPC `9446`, P2P `8336`) and `node3` (RPC `9447`, P2P `8337`) are synced behind the primary.

### 2.3 Binaries in `/opt/zion/V31/target/release/`

| Binary | Version (via `--version`) | Build date | Size | Owner | Notes |
|--------|---------------------------|------------|------|-------|-------|
| `zion-node` | `zion-core 3.1.0-beta` | 2026-08-10 12:34 | 5.1 MB | `zion:zion` | Primary/follower binary |
| `zion-pool` | `zion-pool 3.1.0-beta` | 2026-08-10 23:34 | 8.0 MB | `root:root` | Fresh rebuild after PPLNS fix |
| `zion-miner` | `zion-miner 3.1.0-beta` | 2026-08-10 13:01 | 8.0 MB | `root:root` | After VRSC fix + tuning |
| `warpd` (multichain) | `warpd 3.1.0-beta` | 2026-08-08 17:47 | 14.6 MB | `root:root` | `zion-multichain` binary is named `warpd`; service currently inactive |
| `zion-dao` | (not queryable, runs when invoked) | 2026-08-08 17:40 | 5.1 MB | `root:root` | Built from same tree |
| `zion-oasis` | (not queryable, runs when invoked) | 2026-08-07 07:33 | 7.3 MB | `zion:zion` | Oldest of the V31 binaries |

**`zion-multichain` is missing as a binary name.** The V31 crate builds to `warpd`. The `zion-v31-multichain.service` ExecStart is `/opt/zion/V31/target/release/warpd --config /etc/zion/warp.toml --listen 127.0.0.1:8453 --db /data/zion/warp.db`. This is not aligned with the requested binary name `zion-multichain`.

### 2.4 Git State on Edge

```text
HEAD:    8c165911c0806489523633bc56a7564650e74f6f
Branch:  main
Status:  working tree is NOT clean
```

`git status --short` from `/opt/zion` showed:

```text
 M AGENTS.md
 M Cargo.toml
 M README.md
 M V31/L1/core/src/node.rs
 M V31/L1/core/src/p2p.rs
 M V31/L1/core/src/peer_manager.rs
 M V31/L1/core/src/rpc.rs
 M V31/L1/miner/src/runtime.rs
 M V31/L1/miner/src/v3_pool_client.rs
 M V31/L1/pool/src/auxpow_bridge.rs
 M V31/L1/pool/src/auxpow_runtime.rs
 M V31/L1/pool/src/pool.rs
 M V31/L1/pool/src/share.rs
MM V31/L1/pool/src/stratum.rs
 M ZION_OS/dashboard/app.py
 ...
?? 30D_RUN_PLAN.md
?? ALPHA_BUILD_PLAN.md
?? ...
?? V31-build/
?? ...
```

The last commit in `/opt/zion` is `8c165911c IntroPage: replace main navigation with Marketplace rasta style.` (a UI/website change), but the running L1/pool/miner binaries are built from **uncommitted source changes** (V31 L1 files). This makes the exact deployed code non-reproducible from a git commit.

### 2.5 Environment & Config

The following environment/config files were inspected. **Real private keys, API keys, and tokens have been redacted to `[REDACTED]`.**

#### 2.5.1 `/etc/zion/edge-environment.sh`

Primary environment file used by most V31 services. Contains the correct V31 RPC bind and pool wallet address, but also several plaintext secrets:

- `ZION_POOL_WALLET=zion1n4k4n5e4p0z3g7z2e0z0j7c8w7y0v5m8c6hf8c2`
- `ZION_POOL_PAYOUT_SK_HEX=[REDACTED]` (64-char hex pool payout secret key)
- `ZION_POOL_WALLET_KEY=[REDACTED]` (same key duplicated)
- `ZION_SWAP_ESCROW_KEY=[REDACTED]`
- `ZION_SWAP_BEARER_TOKEN=[REDACTED]`
- `ZION_DAO_API_KEY=[REDACTED]`
- `DASHBOARD_USERS=Yose:[REDACTED-HASH],Issy:[REDACTED-HASH]`
- `ZION_POOL_AUXPOW_WALLET_ZANO=Zx...` (public ZANO address — shown)
- `ZION_POOL_AUXPOW_WALLET_VRSC=RLF...` (public VRSC address — shown)

The file is owned by `root` and readable by services, but it is **broader than the `EnvironmentFile` recommendations in `V31/AGENTS.md` §5.2**, which suggest `/etc/zion/V31/*.env` or `~/.zion/V31/*.env`.

#### 2.5.2 `/etc/zion/edge-v31-pool-environment.sh`

This file is **stale / unused** by the live service:

```text
ZION_POOL_BIND=0.0.0.0:8446          # live service uses 8444
ZION_POOL_PPLNS_WINDOW=10000         # live service uses 500000000
```

This can cause confusion during restart or manual launch.

#### 2.5.3 `/etc/zion/config/dao-v31.toml`

- `api_key = "[REDACTED]"` (line 5) — a hardcoded DAO API key in a `.toml` config file. `V31/AGENTS.md` §5.2 says secrets should be read from env / `EnvironmentFile` and never hardcoded.
- `l1_rpc_url = "127.0.0.1:9445"` — correct.

#### 2.5.4 `/opt/zion/APP&WEB/MarketPlace/.env`

Contains the pool wallet **secret key** in plaintext:

```text
ZION_L1_POOL_WALLET_SECRET_KEY="[REDACTED]"
ADMIN_API_KEY="[REDACTED]"
SHOP_SEED_SECRET="[REDACTED]"
ADMIN_USERS="Yose:[REDACTED],Issy:[REDACTED]"
```

Several third-party keys are left as empty strings (`IPFS_API_KEY`, `STRIPE_SECRET_KEY`, `RESEND_API_KEY`, `DEPLOYER_KEY`), which is better than committing secrets, but the dev seed and API key should not be hardcoded.

#### 2.5.5 `/etc/zion/config/chains.toml`

Public chain RPC inventory. Uses `https://rpc.ankr.com/eth` as a fallback (line 12). The actual Ankr API key is not present in this file, but `docs/3.0.9/SECURITY_AUDIT_REPORT.md` flags a historical Ankr key compromise.

### 2.6 PPLNS / Pool State

From `/opt/zion/data/v31/pool-pplns.json` (live):

| Metric | Value |
|--------|-------|
| `window_size` | `500000000` |
| `window_total_difficulty` | `499,952,000` |
| `window_used` | 5,075 |
| `payout_rounds` | 981 |
| `total_paid_flowers` | 4,714,744,497,030 |
| `total_unpaid_flowers` | 0 |
| `registered_miners` | 49 |
| `miners_with_unpaid` | 0 |
| Top active worker | `zion1d2k5...vega-smos` (5,075 shares in window) |

From the pool HTTP API `http://127.0.0.1:8080/stats`:

- **AuxPoW enabled coins:** `ZANO`, `VRSC`
- **Total accept rate:** 99.8 %
- **ZION shares:** 6,414 accepted / 0 rejected
- **verushash_external:** 83 / 91 accepted (91.2 %)
- **progpow_external:** 69 / 71 accepted (97.2 %)

From `http://127.0.0.1:8080/miners`:

| Worker | Valid Shares | Hashrate | Blocks Found |
|--------|-------------|----------|--------------|
| `zion1d2k5...vega-smos` | 6,559 | 806 kH/s | 70 |
| `zion1d2k5...edge-lite` | 3 | 125 H/s | 0 |
| `local-miner.barker` | 0 | 0 | 0 |

`http://127.0.0.1:8080/api/v1/payouts?limit=5` shows recent payouts at heights 1594–1598 to `zion1d2k5...vega-smos`, all with `confirmed: false`, `confirmations: 0` at audit time.

### 2.7 Pool Wallet UTXOs

`getUtxos` for `zion1n4k4n5e4p0z3g7z2e0z0j7c8w7y0v5m8c6hf8c2` via public RPC:

| Field | Value |
|-------|-------|
| `model` | `v31-native` |
| `count` | 912 |
| `total` (raw flowers) | 4,253,036,589,480 |
| Top output size (raw) | 4,806,059,630 |

### 2.8 Network Listeners & Firewall

`ss -tlnp` summary:

| Process | Listen Address:Port | Expected per docs |
|---------|---------------------|-------------------|
| `zion-node` (primary) | `127.0.0.1:9445`, `0.0.0.0:8335` | ✅ |
| `zion-node` (node2) | `127.0.0.1:9446`, `0.0.0.0:8336` | ✅ |
| `zion-node` (node3) | `127.0.0.1:9447`, `0.0.0.0:8337` | ✅ |
| `zion-pool` | `0.0.0.0:8444`, `0.0.0.0:8080` | Stratum ✅, HTTP API should be localhost |
| `zion-dao` | `0.0.0.0:8456` | Should be `127.0.0.1:8456` per `V31/AGENTS.md` |
| `zion-oasis` | `127.0.0.1:8094` | ✅ |
| `python3` (dashboard) | `0.0.0.0:8766` | Public per UFW, but docs say operator-only |
| `next-server` (website) | `0.0.0.0:3000` | Behind nginx — OK |
| `next-server` (marketplace) | `0.0.0.0:3100` | Behind nginx — OK |
| `next-server` (oasis-web) | `127.0.0.1:3002` | ✅ |
| `nginx` | `0.0.0.0:80`, `0.0.0.0:443`, `0.0.0.0:8443` | ✅ |
| `sshd` | `0.0.0.0:2222`, `[::]:2222` | ✅ |
| `warpd` (multichain) | **Not listening** | Should be `127.0.0.1:8453/8454` |

`ufw status` is **active** and far more permissive than the `V31/AGENTS.md` default-deny port matrix:

- Ports `80/443`, `8333-8338`, `8443-8446`, `8452-8454`, `8461-8463`, `8766`, `9443`, `9999` are `ALLOW IN Anywhere`.
- `22` and `2222` are `LIMIT IN Anywhere`.
- Several old operator IPv4/IPv6 are explicitly allowed; the current operator IPv6 (`2a00:11b1:...`) is **not** in the `fail2ban` `sshd` `ignoreip` list, which explains intermittent SSH lockouts.

### 2.9 nginx Status

- `nginx.service` is **active**.
- TCP stream `0.0.0.0:8443` → `127.0.0.1:9445` for public RPC.
- HTTPS `rpc.zionterranova.com:443` also proxies to `127.0.0.1:9445`.
- `/etc/nginx/sites-enabled/zion-nginx.conf` proxies `/api/dao` to `127.0.0.1:8450`, but the DAO service actually listens on `8456` — this nginx route is broken.
- `/api/warp/` and `/v1/` proxy to `127.0.0.1:8453` / `8454`; because `warpd` is not running, these will return 502s.

### 2.10 fail2ban Status

- `fail2ban.service` is **active**.
- `zion-p2p` jail: `maxretry=50`, `bantime=24h`, `findtime=10m`, `backend=systemd`, `ignoreip` includes the known operator IPs.
- `sshd` jail: `maxretry=3`, `bantime=24h`, `findtime=10m`, `action=ufw`, `ignoreip` list is IPv4-only and does not include the current operator IPv6.

---

## 3. V31 Workspace Audit

### 3.1 Local Git

```text
Workspace:   /Users/yeshuae/Projects/2.9.6
HEAD:        3955f2f46 docs: add PPLNS payout fix report
Branch:      main
Status:      clean (no modified files)
```

`git log --oneline -20`:

```text
3955f2f46 docs: add PPLNS payout fix report
458fb5bb9 fix(pool): record vardiff share weight in PPLNS instead of network difficulty
b4600bcb9 fix(dashboard): use correct input vout index when marking UTXOs spent
29ddd937d docs: VRSC rejection fix + performance tuning report and status update
1c0ce2e42 perf(gpu): increase ProgPoW GWS to 1M + revert VRSC batch to 2M
4f6f8dd89 perf(miner): tune GPU sharing gap=0 + nonce_batch=10M for +14% hashrate
f1ccdb2c6 perf(gpu): increase ProgPoW GWS to 524288 + larger batch sizes for dedicated mode
9cbaa6302 fix(miner): eliminate VRSC share rejection via per-coin result channels
c0218b587 fix(opencl): local_size fix for MultiGpuMiner + dedicated mode + new wallet
f0798d58c docs: add Windows 11 miner setup guide (ZION Trinity CUDA)
7a13ac2f4 docs: OpenCL target check fix report + SMOS wrapper dedicated mode
08ef9dbf1 fix(opencl): on-device target check for Deeksha — 50x ZION hashrate on AMD
41d5ae050 chore: gitignore V31 custom cargo target dirs (13K build artifacts)
fa8d902aa chore(miner): update Start.sh launcher for ZION GPU + auto-detect + structured logging
c63799225 feat(miner): ZION GPU + auto-detect + structured logging + hashrate optimization
ef214da88 fix(smos): fix RX 5600 XT not mining — remove ZION_NO_GCN_S4_MODE, restore v90 tuning
e99e226d5 fix(miner): VRSC hashrate reporting + nonce cursor + async share submission
8586df40c fix(miner): wire ZION_NONCE_COUNT/ZION_STREAM2_BATCH and tune SMOS wrapper
49c81b02e VRSC VerusHash max performance tuning ported from V3 archive.
297bb22e8 docs: update AGENTS.md, README.md and StatusV3.md with DAG cache validation
```

The commits that correspond to the live Edge fix are `9cbaa6302` (VRSC fix) and `4f6f8dd89` (perf tuning), matching the description in `AGENTS.md` and `StatusV3.md`.

### 3.2 Workspace Version

`V31/Cargo.toml` line 24:

```toml
[workspace.package]
version = "3.1.0-beta"
```

All Edge binaries also report `3.1.0-beta`, so the version string is consistent.

### 3.3 Key Documentation

| Document | Key fact |
|----------|----------|
| `V31/AGENTS.md` §4 (line 70) | Port matrix: RPC `127.0.0.1:9445`, WARP/DEX `127.0.0.1:8453/8454`, Pool stratum `0.0.0.0:8444`, Dashboard/Pool HTTP operator-only/localhost. |
| `V31/AGENTS.md` §5 | Secrets must live in env/`EnvironmentFile`; never hardcoded. |
| `V31/AGENTS.md` §6.3 | Backup list includes env files, TOMLs, systemd, nginx, certs, SQLite DBs. |
| `StatusV3.md` line 13 | V31 cutover complete; V31 services active; public RPC on `8443`. |
| `StatusV3.md` line 96-108 | Expected Edge topology table lists `zion-v31-multichain` as active. |
| `StatusV3.md` line 470-485 | Blocking: EVM contract redeploy, external audit, `systemd User=zion` for dashboard+dex. Non-blocking: 7 non-EVM chains, LND, etc. |
| `V31/STATUS.md` line 136 | `cargo test --workspace` 2,178 pass; `cargo clippy` clean. |
| `V31/STATUS.md` line 421-436 | Open items: non-EVM WARP contracts (31 placeholders), OASIS static export, ZIS deploy, public subtree sync, real GPU rig E2E. |
| `V31/STATUS.md` line 465-471 | Notes a historical V31 UTXO gap blocking payout verification. **This appears resolved** in the current live deployment (payouts are generated). |
| `docs/3.0.9/SECURITY_AUDIT_REPORT.md` line 57 | ANKR API key was in plaintext in `docs/3.0.0/KeyForMainetLaunch.md`, appears in 15+ commits; **must be rotated**. |
| `docs/3.0.9/SECURITY_AUDIT_REPORT.md` line 87-97 | Edge hardening: SSH key-only, UFW default-deny, fail2ban `sshd` + `zion-p2p` jails — all marked ✅. |
| `docs/3.0.0/KeyForMainetLaunch.md` line 1 | ANKR API key now stored in 1Password; working tree is clean. |

**Note:** `V31/ROADMAP.md` does **not exist**. The forward planning appears to live in `V31/PLAN_TO_3.2.md` and root `ROADMAP.md`.

---

## 4. Code vs. Docs Comparison / Inconsistencies

### 4.1 Service Topology — `StatusV3.md` / `AGENTS.md` vs. Reality

| Expected (docs) | Actual (`systemctl` + `ss`) | Severity |
|-----------------|-----------------------------|----------|
| `zion-v31-multichain` active on `8453/8454` | `inactive (dead)`, `warpd` not listening | **High** |
| `zion-v31-miner` triple-stream (ZION+ZANO+VRSC) GPU+CPU | `zion-v31-miner` is `--no-gpu --threads 1` CPU-only | Medium |
| `zion-v31-pool` HTTP API on `127.0.0.1:8080` | `0.0.0.0:8080` (UFW blocks externally, but binding is wrong) | Medium |
| `zion-v31-dao` on `127.0.0.1:8456` | `0.0.0.0:8456` | Medium |
| Dashboard `8766` operator-only / Basic Auth | `0.0.0.0:8766`, `ufw ALLOW IN Anywhere`, no Basic Auth visible in nginx | Medium |
| `nginx` `/api/dao` → `127.0.0.1:8450` | DAO on `8456`; route is non-functional | Medium |
| WARP/DEX ports `8453/8454` | Open in UFW but no process listening | Low |

### 4.2 Configuration Drift

- `/etc/zion/edge-v31-pool-environment.sh` is stale (port `8446`, window `10000`).
- `/etc/zion/edge-node2-environment.sh` references V3 follower ports `8334/8448/8449` and an old state path — this is legacy.
- `/etc/zion/edge-v31-environment.sh` is mostly correct but very short; it does not set `ZION_BLOCK_RETENTION=0`, so the node falls back to `edge-environment.sh`.

### 4.3 RPC / Chain Height Inconsistency

Public RPC `rpc.zionterranova.com:8443`:

- `getUtxos` for the pool wallet returns `v31-native`, `count: 912`, valid UTXOs.
- `getStatus` returns `chain_height: 0`, `protocol_version: "3.0.5"`, `tip_hash: 000...`.

This suggests either:
1. `getStatus` is hitting a V3-compatibility or default fallback path in the V31 node, or
2. The public RPC `8443` TCP stream sometimes lands on a different backend.

Either way, the response is misleading and should be reconciled with the live chain height (`~1598`).

### 4.4 OASIS Block Parsing Error

`zion-v31-oasis.service` logs show, for every new block:

```text
ERROR zion_oasis::blockchain_listener: L1 getBlockByHeight(1584) failed:
  failed to parse block: invalid type: floating point `5400.067`, expected u64; skipping
```

This repeats for heights 1584–1588. The OASIS service is therefore not processing V31 block data correctly.

### 4.5 Deployment Reproducibility

`/opt/zion` has a dirty working tree with modified V31 L1 source. The live binaries were built from this tree, but the exact diff is not committed. This breaks the canonical “deploy from a clean commit” workflow described in `V31/AGENTS.md` §9.

---

## 5. Security Items

### 5.1 ANKR API Key (A1.5-URGENT)

`docs/3.0.9/SECURITY_AUDIT_REPORT.md` line 57 and `REPORT_2026-08-10_V31_POOL_PPLNS_PAYOUT_FIX.md` line 93–95 both state that an **ANKR API key was committed in plaintext** in `docs/3.0.0/KeyForMainetLaunch.md` across 15+ commits and must be rotated.

Current state:
- `docs/3.0.0/KeyForMainetLaunch.md` line 1 now says the key is in 1Password (working tree clean).
- `V3/docker/.env` was not found on Edge, so it is unclear whether the key has been rotated in the deployed environment.
- `chains.toml` still lists `https://rpc.ankr.com/eth` as a fallback RPC.

**Action:** Verify rotation in the Ankr dashboard and update Edge env/config files if not already done.

### 5.2 Plaintext Secrets on Edge

| File | Secret / Risk |
|------|---------------|
| `/etc/zion/edge-environment.sh` | `ZION_POOL_PAYOUT_SK_HEX`, `ZION_POOL_WALLET_KEY`, `ZION_SWAP_ESCROW_KEY`, `ZION_SWAP_BEARER_TOKEN`, `ZION_DAO_API_KEY` — all in one world-readable shell file |
| `/etc/zion/config/dao-v31.toml` | `api_key` hardcoded (line 5) |
| `/opt/zion/APP&WEB/MarketPlace/.env` | `ZION_L1_POOL_WALLET_SECRET_KEY`, `ADMIN_API_KEY`, `SHOP_SEED_SECRET`, `ADMIN_USERS` |

These are **not** in the tracked git working tree, but they are on the production host. Per `V31/AGENTS.md` §5, secrets should be in `EnvironmentFile` only and never hardcoded in TOMLs or web app `.env` files on the server.

### 5.3 fail2ban / UFW Exposure

- `ufw` allows many unused/legacy ports globally (`8445`, `8452-8454`, `8461-8463`, `9443`, `9999`).
- `zion-p2p` fail2ban `ignoreip` looks reasonable, but the **`sshd` jail `ignoreip` is IPv4-only** and missing the current operator IPv6, causing temporary lockouts.
- The `sshd` jail `maxretry=3` is strict; rapid scripted SSH probes (like an audit) can trigger a 24h ban.

### 5.4 Service Binding Security

- `zion-pool` HTTP API and `zion-dao` bound to `0.0.0.0` instead of `127.0.0.1`. Even if UFW blocks them, accidental rule changes or container breakouts could expose them.
- `zion-edge-python-dashboard` on `0.0.0.0:8766` with UFW `ALLOW IN Anywhere` and no visible Basic Auth or IP allowlist in nginx. This is the broadest exposure.

---

## 6. Recommendations and Follow-ups

### Immediate (this week)

1. **Start/enable `zion-v31-multichain` (`warpd`)** or update `StatusV3.md` / `AGENTS.md` to reflect that multichain is intentionally offline. If it is broken, fix the crash cause before re-enabling.
2. **Rotate the ANKR API key** if not already done; verify in `V3/docker/.env` or `chains.toml` usage.
3. **Fix the OASIS block parse error** (`floating point 5400.067, expected u64`) so the game API can process V31 blocks.
4. **Fix the public RPC `getStatus` response** so it returns the live V31 height and protocol version.
5. **Fix `/etc/nginx/sites-enabled/zion-nginx.conf`** `/api/dao` proxy to `127.0.0.1:8456`.
6. **Bind pool HTTP API and DAO API to `127.0.0.1`** in their systemd service files or command-line args; remove `0.0.0.0` bindings.
7. **Resolve `logrotate.service` and `zion-dashboard-web.service` failures** — clean up duplicate logrotate entries and remove or mask the legacy dashboard.

### Short-term (next sprint)

8. **Reconcile the Edge working tree** with `main`: either commit the current V31 L1 changes (pool PPLNS fix, miner runtime fix, etc.) or rebuild from a known clean commit. Right now the live deployment is non-reproducible.
9. **Remove or update stale env files** (`edge-v31-pool-environment.sh`, `edge-node2-environment.sh`) so operators do not accidentally use wrong ports/window sizes.
10. **Move hardcoded secrets out of TOML/web `.env` files** into `EnvironmentFile=` or a secrets manager. At minimum, set `chmod 600` on all files containing private keys and ensure they are owned by the service user.
11. **Add the current operator IPv6** to `/etc/fail2ban/jail.d/zion-sshd.conf` `ignoreip` and to UFW allow rules for SSH/dashboard to prevent lockouts.
12. **Audit UFW rules** — close `Anywhere` rules for ports that are not actually in use (`8445`, `8452-8454`, `8461-8463`, `9443`, `9999`) or document why they are open.
13. **Document whether `zion-v31-miner` is intentionally a CPU-only backup**; if the Edge triple-stream miner is meant to be local, state this in `StatusV3.md`.
14. **Confirm payout confirmation sweep** is actually working — recent payouts in `/api/v1/payouts` are `confirmed: false` with `confirmations: 0`, which may be normal for brand-new payouts but should be verified within a few blocks.

### Strategic (pre-mainnet)

15. **Complete the `StatusV3.md` blocking items** (`line 470-473`):
    - EVM contract redeploy with new admin keys + multisig
    - External audit
    - `systemd User=zion` for dashboard + marketplace (currently still `User=zion` actually; the docs say dashboard+dex still root, but marketplace is `zion`, dashboard is `zion`)
16. **Complete `V31/STATUS.md` open items** (`line 421-436`):
    - Real non-EVM WARP contracts (31 placeholders)
    - Foundry/Hardhat project for `zion deploy`
    - OASIS Web `output: 'export'` vs. ZIS server-side routes
    - ZIS Edge deploy
    - Public `subtree` sync
    - Real GPU rig E2E (≥90 % accept rate) and 30-day continuous run
17. **Create `V31/ROADMAP.md`** if `V31/PLAN_TO_3.2.md` is the canonical one, or add a symlink/rename to reduce confusion.
18. **Address architectural VRSC stale-job latency** from `REPORT_2026-08-09_TRINITY_TUNING_FINAL.md` line 137 (direct miner → upstream submission) if VRSC accept rate drops again.

---

## Appendix A: Commands Used for Edge Collection

```bash
ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no \
  -i ~/.ssh/zion-edge-post-wipe-2026-07-29 -p 2222 \
  root@vmi3425821.contaboserver.net

systemctl list-units --type=service --state=running | grep zion
systemctl list-units --type=service --all | grep zion
for s in <services>; do systemctl status --no-pager -l "$s" | head -n 35; done
for b in zion-node zion-pool zion-miner zion-multichain zion-dao zion-oasis; do
  /opt/zion/V31/target/release/$b --version
  ls -l /opt/zion/V31/target/release/$b
done
git -C /opt/zion rev-parse HEAD
git -C /opt/zion status --short
ss -tlnp
ufw status numbered
cat /etc/fail2ban/jail.d/zion-p2p.conf
cat /etc/fail2ban/jail.d/zion-sshd.conf
curl -s http://127.0.0.1:8080/stats | python3 -m json.tool
python3 - <<'PY'  # pplns summary
import json
with open('/opt/zion/data/v31/pool-pplns.json') as f: d=json.load(f)
print(d['window_total_difficulty'], len(d['window']), d['payout_rounds'])
PY
curl -s -X POST -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"getUtxos","params":["zion1n4k4n5e4p0z3g7z2e0z0j7c8w7y0v5m8c6hf8c2"],"id":1}' \
  http://rpc.zionterranova.com:8443
```

---

## Appendix B: Redacted Secrets List

The following secret values were observed on Edge but are **not printed** in this report:

- `ZION_POOL_PAYOUT_SK_HEX` (`/etc/zion/edge-environment.sh`)
- `ZION_POOL_WALLET_KEY` (`/etc/zion/edge-environment.sh`)
- `ZION_SWAP_ESCROW_KEY` (`/etc/zion/edge-environment.sh`)
- `ZION_SWAP_BEARER_TOKEN` (`/etc/zion/edge-environment.sh`)
- `ZION_DAO_API_KEY` (`/etc/zion/edge-environment.sh` and `/etc/zion/config/dao-v31.toml`)
- `ZION_L1_POOL_WALLET_SECRET_KEY` (`/opt/zion/APP&WEB/MarketPlace/.env`)
- `ADMIN_API_KEY`, `SHOP_SEED_SECRET`, `ADMIN_USERS` (`/opt/zion/APP&WEB/MarketPlace/.env`)
- Dashboard user password hashes (`DASHBOARD_USERS`)
- Any ANKR/API keys referenced in git history

---

*Report generated by Devin. No git push was performed.*
