# ZION Edge & Docs vs Reality — Deep Audit Report

> **Date:** 2026-07-23  
> **Scope:** Edge server (`62.171.141.136`), local backup node, `V3` code, root status docs  
> **Auditor:** Devin  
> **Methodology:** SSH to Edge, RPC queries, systemd inspection, local process/log/database checks, source-code grep, backup integrity verification.

---

## 1. Executive Summary

- The **chain was hard-reset to a fresh genesis on 2026-07-20** because of the block-retention bug documented in `docs/3.0.5/INCIDENT_REPORT_2026-07-20_BLOCK_RETENTION_AND_GENESIS_RESET.md`.
- The current live chain height is **~2584** (and growing), **not 10911+ or 11608** as several root docs still claim.
- The **local backup node is online and synced** — `StatusV3.md` and `AGENTS.md` incorrectly state it is offline.
- **Most root docs are stale** after the reset: heights, circulating supply, service counts, resource usage, and the "local backup offline" claim do not reflect reality.
- A **critical operational issue** was found: the Edge bridge is configured with `start_block_height = 4000`, which is **above the current chain height**, so it is **not scanning L1** for bridge locks on the fresh chain.
- The `zion-rtm-debug-pool` service is failed, `zion-free-world` and `zion-issobella` are disabled on Edge despite being listed as active in `StatusV3.md`, and `backup-data.sh` references Redis/LMDB that no longer exist.

The **only canonical truth for the current state** is `docs/3.0.5/INCIDENT_REPORT_2026-07-20_BLOCK_RETENTION_AND_GENESIS_RESET.md`. The root `StatusV3.md`, `README.md`, `ROADMAP.md`, and `3.0.7.md` need to be reconciled with that incident report and with live data.

---

## 2. Ground Truth — Edge Server

### 2.1 Chain state

| Metric | Live value (2026-07-23 ~06:43 CEST) | Source |
|--------|--------------------------------------|--------|
| **Chain height** | 2584 | Edge RPC `getChainInfo` |
| **Accepted blocks** | 2585 | Edge RPC `getChainInfo` |
| **Protocol version** | `zion-v3-node/3.0.6` | Edge RPC `getNodeInfo` |
| **Genesis hash** | `4f75a0dfe6dde3b167287d445aa1ade56577b0e9166c641ed288b4c20a79bd6e` | RPC + `V3/L1/core/src/genesis.rs` |
| **Consensus profile** | `deeksha_lite_v1` | RPC |
| **Tip hash** | `00001431934893b4e1da61e34698620c805da34c9e02b9560026478226f40430` | RPC |
| **Transaction model** | `hybrid` | RPC |
| **Flowers per ZION** | 1,000,000 (6 decimals) | RPC `getNodeInfo` |

Both Edge node1 (`127.0.0.1:9443`) and node2 (`127.0.0.1:8448`) agree, and the local backup node (`127.0.0.1:8446`) returns the same tip hash.

### 2.2 Services

`systemctl list-units 'zion*'` on Edge:

| Service | Status | Note |
|---------|--------|------|
| `zion-edge-node1` | active | Primary |
| `zion-edge-node2` | active | Follower |
| `zion-edge-pool` | active | Stratum 8444 |
| `zion-edge-bridge` | active | But not scanning L1 (see 4.1) |
| `zion-edge-dao` | active | |
| `zion-edge-atomic-swap` | active | |
| `zion-edge-warp` | active | |
| `zion-edge-dex` | active | |
| `zion-edge-oasis` | active | |
| `zion-edge-dashboard` | active | |
| `zion-edge-python-dashboard` | active | Port 8766 |
| `zion-edge-backup` | inactive | Timer-triggered one-shot |
| `zion-edge-maintenance` | inactive | Timer-triggered one-shot |
| `zion-edge-watchdog` | inactive | Timer-triggered one-shot |
| `zion-edge-agent` | inactive | Disabled |
| `zion-rtm-debug-pool` | **failed** | Timeout/killed on 2026-07-22 |
| `zion-free-world` | **disabled/inactive** | Service file uses old `/usr/local/bin/zion-free-world` and `zion-node.service` |
| `zion-issobella` | **disabled/inactive** | Service file uses old `/usr/local/bin/zion-issobella` and `zion-node.service` |
| `nginx` | active | |
| `docker` / `zion-web` | active | Next.js container, `https://zionterranova.com` returns 200 |
| `fail2ban` | active | 2 jails: `sshd`, `zion-p2p` |

### 2.3 Pool telemetry

`/stats` endpoint (2026-07-23 06:43):

- Active miners: **1**
- Pool hashrate: ~31 KH/s
- Blocks found: **5** (all `pending`)
- Current AuxPow stream: `verushash` / VRSC / `eu.luckpool.net:3956`
- `multi_auxpow` shows VRSC submitted 14, accepted 13 (accept rate 93%).
- Fee split in runtime: `miner_pct=90`, `humanitarian_pct=5`, `issobella_pct=5`, `pool_fee_pct=0`.
- Block-level fee split from `accepted_blocks` confirms `miner_reward_zion` is 89% of `subsidy_zion` (e.g. 4806.05963 ZION / 5400.067 ZION), matching the documented 89/5/5/1 model.

### 2.4 Backups

Edge `/opt/zion/backups/daily/`:

- Latest: `zion-edge-20260723_061901.tar.gz` (8.4 MB, height 2577 at time of backup).
- Growth from 730 KB on 2026-07-21 to 8.4 MB on 2026-07-23 confirms the chain started fresh around 2026-07-20/21.
- No weekly backups present (`weekly/` empty).

Local `/home/zionserver/2.9.6-main/backups/`:

- Latest `backup_edge_2026-07-23_06-36-34.tar.gz` (2.4 MB) and `backup_local_2026-07-23_06-36-34.tar.gz` (1.2 MB).
- Integrity verified with `tar tzf`.
- `backup-system.sh` is the active backup script; its log contains a timestamp bug: it uses `+Y-%m-%d` instead of `%Y-%m-%d`, producing literal `[Y-07-23 ...]`.

### 2.5 Resources

| Resource | Edge actual | StatusV3.md claim |
|----------|-------------|-------------------|
| RAM | 7.8 GB total, **5.6 GB used** | "~2.7 GB / 7.8 GB" |
| Disk | 145 GB total, **66 GB used (46%)** | "62 GB / 145 GB" |
| Node RSS | Not 3.5 MB; the server is using 5.6 GB with Docker + L2/L3 | "~3.5 MB" |

---

## 3. Ground Truth — Local Backup Node

| Metric | Value | Source |
|--------|-------|--------|
| `zion-backup-node.service` | active (user systemd) | `systemctl --user is-active zion-backup-node` |
| RPC | `127.0.0.1:8446` | `ss -tlnp` |
| P2P | `0.0.0.0:8333` | `ss -tlnp` |
| Chain height | 2584 | Local RPC `getChainInfo` |
| Tip hash | matches Edge | Local RPC |
| Peers | 2 (`62.171.141.136:8333`, `:8334`) | `getPeerInfo` |
| State file | `/home/zionserver/2.9.6-main/V3/data/zion-node-state.db` (~8.2 MB JSON) | process env |
| `ZION_BLOCK_RETENTION` | 0 (unlimited) | process env |

The local node state JSON is valid, loads without errors, and contains 2585 accepted blocks. Note that `~/.zion/node-state.db` is a stale, unused genesis-only file and should not be confused with the live state.

---

## 4. Critical Findings

### 4.1 Bridge `start_block_height` is above current chain height

**Severity: High — bridge is not scanning L1 for new bridge locks.**

- Edge bridge service uses `ZION_BRIDGE_CONFIG=/opt/zion/V3/L2/bridge/config/bridge-mainnet.toml`.
- That file contains:
  ```toml
  start_block_height  = 4000  # Local/Edge L1 nodes retain ~1000 accepted blocks; scan from a height that exists after the 3.0.4 genesis reset
  ```
- `/etc/zion/config/bridge-mainnet.toml` contains `start_block_height = 5333`.
- Current chain height is **2584**, so the L1 scanner skips everything until block 4000/5333.
- On a fresh genesis reset, `start_block_height` should be `0` (or the current height at the moment of reset).
- The comment about "1000 accepted blocks" is also wrong: `ZION_BLOCK_RETENTION=0` on both nodes, so all blocks are retained.

### 4.2 Root docs are stale after the 2026-07-20 genesis reset

| Document | Stale/incorrect claim | Reality |
|----------|----------------------|---------|
| `StatusV3.md` | "Height 10911+" | 2584 |
| `StatusV3.md` | "local backup offline" | local backup is online and synced |
| `StatusV3.md` | "15/15 services active" including `zion-free-world` and `zion-issobella` | Those two are disabled on Edge; `zion-rtm-debug-pool` is failed |
| `StatusV3.md` | `ZION_BLOCK_RETENTION=1000` | `0` in Edge env and local env |
| `StatusV3.md` | RAM 2.7 GB / 7.8 GB, disk 62 GB, node RSS 3.5 MB | 5.6 GB RAM, 66 GB disk, node RSS much larger |
| `StatusV3.md` | Circulating 16.81B ZION | ~16.692B ZION on fresh chain |
| `README.md` | "Chain Height 10911+" | 2584 |
| `README.md` | "3.0.7 Triple Stream All Green planning" as current status | Deployed protocol is `3.0.6` |
| `ROADMAP.md` | "Health check 2026-07-14: Chain height 5800+" | Chain reset; current height 2584 |
| `3.0.7.md` / `TRIPLE_STREAM_ALL_GREEN_PLAN.md` | Claims verified at height 11608 on 2026-07-19 | Pre-reset chain; no longer valid |
| `AGENTS.md` | "local backup node currently offline" | Online |

The **single source of truth** for the reset is `docs/3.0.5/INCIDENT_REPORT_2026-07-20_BLOCK_RETENTION_AND_GENESIS_RESET.md`. Root docs were not updated to reflect it.

### 4.3 `zion-rtm-debug-pool` service is failed

- `systemctl status zion-rtm-debug-pool.service` shows `failed (Result: timeout)` since 2026-07-22.
- The unit is disabled. UFW does allow port 8460 for it, but the service is not running.

### 4.4 `zion-free-world` and `zion-issobella` are not running on Edge

- `systemctl is-enabled` returns `disabled` for both.
- Their service files reference `/usr/local/bin/zion-free-world`/`zion-issobella` and `zion-node.service`, which are legacy names.
- Their databases (`free_world.db`, `issobella.db`) are 0 bytes.
- Yet `StatusV3.md` lists them as active.

### 4.5 Backup script `backup-data.sh` is obsolete

- `scripts/backup-data.sh` expects Redis and LMDB (`data.mdb`) in `/data/zion`.
- Edge has **no Redis** and **no LMDB**; the node state is a JSON file (`/data/zion/state`).
- This script is not used by the active timer (`zion-backup.service` runs `backup-system.sh`), but its presence is misleading.

### 4.6 `backup-system.sh` log timestamp bug

```bash
echo "[$(date '+Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
```
The `+Y` should be `%Y`. Logs show literal `[Y-07-23 ...]`. The bug is cosmetic only.

### 4.7 Protocol version mismatch between code/docs

- `V3/Cargo.toml` and `V3/L1/core/src/lib.rs` declare version/protocol `3.0.6`.
- `README.md`, `3.0.7.md`, and `TRIPLE_STREAM_ALL_GREEN_PLAN.md` frame the live work as `3.0.7`.
- The deployed binary (`/opt/zion/V3/target/release/node`) and RPC respond with `3.0.6`.
- Recommendation: distinguish **deployed code (3.0.6)** from **planning milestone (3.0.7)** in docs.

---

## 5. Code vs Config vs Reality

| Topic | Code / repo | Edge config | Reality |
|-------|-------------|-------------|---------|
| Block retention guard | `rt.set_block_retention(config.block_retention)` always (`V3/L1/core/src/bin/node.rs:179`) | `ZION_BLOCK_RETENTION=0` | All blocks retained; fix is live |
| State storage | JSON file (`zion-node-state.db`) | `/data/zion/state` | 8.4 MB JSON on Edge, 8.2 MB JSON local |
| LMDB / Redis | Referenced by `backup-data.sh` | Not used | Not present on either server |
| Bridge mainnet `start_block_height` | `4000` in `V3/L2/bridge/config/bridge-mainnet.toml` | `4000` in `/opt/zion/V3/...`, `5333` in `/etc/zion/...` | Current height 2584, so bridge does not scan L1 |
| `start-backup-node.sh` comment | "Edge runs retention=1000" | `ZION_BLOCK_RETENTION=0` | Comment is wrong |
| `StatusV3.md` node config | `ZION_BLOCK_RETENTION=1000` | `ZION_BLOCK_RETENTION=0` | Docs wrong |
| `StatusV3.md` services | 15 active | 10-11 active + failed/disabled | Overcount |
| `StatusV3.md` local backup | Offline | `zion-backup-node` active, synced | Wrong |

---

## 6. Recommendations

1. **Reconcile `StatusV3.md` and `README.md` with the 2026-07-20 incident report.** Update chain height, local backup status, service list, resource usage, and circulating supply.
2. **Fix bridge `start_block_height`.** For the fresh chain, set it to `0` in both `V3/L2/bridge/config/bridge-mainnet.toml` and `/etc/zion/config/bridge-mainnet.toml`, then restart `zion-edge-bridge`. Update the stale comment about "1000 accepted blocks".
3. **Decide `zion-free-world` / `zion-issobella`.** Either enable and fix their service files (`/usr/local/bin/...` paths and `zion-node.service` dependency) or update `StatusV3.md` to show them as not running.
4. **Fix or remove `zion-rtm-debug-pool`.** It is failed and disabled; either repair and enable or remove from the active service list in docs.
5. **Fix `backup-system.sh` log timestamp.** Change `+Y` to `%Y`.
6. **Archive or rewrite `scripts/backup-data.sh`.** It describes Redis + LMDB that no longer exist; it should describe the actual JSON state backup.
7. **Clarify version narrative.** State that the live binary is `3.0.6` and `3.0.7` is the in-progress milestone.
8. **Re-run `sync-edge-backups.sh` / `zion-offsite-sync.timer`.** Verify off-site sync continues after the reset; local `backups/edge/` has daily backups but no weekly ones.

---

## 7. Appendix — Key Commands & Outputs

### Edge RPC

```bash
ssh zion-new 'curl -s -X POST http://127.0.0.1:9443 -H "Content-Type: application/json" -d "{\"jsonrpc\":\"2.0\",\"method\":\"getChainInfo\",\"params\":[],\"id\":1}"'
# => height 2584, accepted_blocks 2585, protocol zion-v3-node/3.0.6
```

### Local RPC

```bash
curl -s -X POST http://127.0.0.1:8446 -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"getChainInfo","params":[],"id":1}'
# => same tip hash and height as Edge
```

### Edge services (active only)

```
zion-edge-atomic-swap.service
zion-edge-bridge.service
zion-edge-dao.service
zion-edge-dashboard.service
zion-edge-dex.service
zion-edge-node1.service
zion-edge-node2.service
zion-edge-oasis.service
zion-edge-pool.service
zion-edge-python-dashboard.service
zion-edge-warp.service
```

### Backup growth on Edge (post-reset)

```
2026-07-21 02:18  zion-edge-20260721_021846.tar.gz   730K
2026-07-22 02:18  zion-edge-20260722_021854.tar.gz   2.5M
2026-07-23 06:19  zion-edge-20260723_061901.tar.gz   8.4M
```

### Bridge config inconsistency

```bash
# Edge service uses:
/opt/zion/V3/L2/bridge/config/bridge-mainnet.toml  -> start_block_height = 4000
# But also exists:
/etc/zion/config/bridge-mainnet.toml                -> start_block_height = 5333
# Current chain height: 2584
```

---

*Generated with Devin — ZION V3 Mainnet Beta.*
