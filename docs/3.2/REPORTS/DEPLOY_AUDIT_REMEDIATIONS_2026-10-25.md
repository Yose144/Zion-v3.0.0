# Deployment Report — Audit Remediations (2026-10-25)

**Scope:** production rollout of the audit-remediated `warpd` and `zion-pool`
binaries built from commit `6c8165d4ae1ccbcde9ff7a3f044425b93253c28f` (source
tree identical to remediation commit `4108a52d0b47702dd97fbd1d6f4919ceb1aca6a4`).

**Operator approvals on record:**
- SSH deployment to EDGE + EDGE2, binary swap and controlled restart of
  `zion-v31-pool` (EDGE) and `zion-v31-multichain` (EDGE2). No key changes,
  no financial transactions, no L1 node restarts.
- Explicit approval of the `seen_txs` schema migration (copy → DROP → rename
  to composite `(tx_hash, chain)` primary key) on `/data/zion/warp.db`, with
  verified backup first.

## 1. Build provenance

| Item | Value |
|---|---|
| Source archive | `git archive 6c8165d4a V31 \| gzip -n`, SHA256 `b8f34c49efe937f6264b4a51bb0b849ca3102ac465db9bf49c1a17d735a91fdf` |
| Build host | EDGE (`zion-v6`, vmi3425821), staged under `/root/build/audit-6c8165d4a-20261025/` |
| Toolchain | host rustc/cargo 1.97.1, target glibc 2.39 (both deploy hosts) |
| Command | `cargo build --release --offline --locked -j 2 -p zion-pool --bin zion-pool -p zion-multichain --bin warpd` |
| Resource cap | transient unit `zion-audit-build-6c8165d4a`: Nice=19, CPUQuota=200%, MemoryHigh=3G, MemoryMax=4G, IOWeight=10 |
| Result | `success` (ExecMainStatus=0), 19m45s, ~2.9G peak |
| `Cargo.lock` SHA256 | `806a03049e3253b115a4801b8b63c0d7700d94675b75fc2fd079adc01b7af90f` |
| Offline deps | 3 crates copied over SSH from local cache (`chacha20poly1305-0.10.1`, `poly1305-0.8.0`, `chacha20-0.9.1`); each `.crate` SHA256 verified against `Cargo.lock`, extracted trees byte-identical |

## 2. Artifacts

| Binary | SHA256 | Checks |
|---|---|---|
| `warpd` (19,720,800 B) | `bbc353c32bdf3820c35512627ee148fdc9a523c0e591bd65b486ff5e3ddfe54f` | ELF x86-64 PIE stripped, max `GLIBC_2.34`, `ldd` clean, `--version` → `warpd 3.2.0` |
| `zion-pool` (11,200,960 B) | `968f56aaeb9a83481eb827cd77e2958668005fd481422731b6b0330c6f8dc36c` | ELF x86-64 PIE stripped, max `GLIBC_2.34`, `ldd` clean, `--help` exit 0 |

## 3. Rollback artifacts (all `integrity_check` = ok)

| Host | Backup dir | Contents |
|---|---|---|
| EDGE | `/root/audit-deploy-6c8165d4a-pool-20261025T193126Z/` | old `zion-pool` (`8a3d85b6…`), `pool-store.db` snapshot, `pool-pplns.json`, unit + drop-in |
| EDGE2 | `/root/audit-deploy-6c8165d4a-warp-20261025T192938Z/` | old `warpd` (`54a71a81…`), `warp.db` + `warp_multichain.db` snapshots, `warp.toml`, unit |

An earlier pre-flight backup pair exists at `…-20261025T183724Z` (pool) and
`…-20261025T183726Z` (warp). Rollback = stop service, restore binary + DBs,
start service; both DB backups were taken with `sqlite3` online backup API.

## 4. Deployment execution

### EDGE2 — `zion-v31-multichain` (`warpd`)

- Pre-stop recheck: 0 non-terminal WARP transfers, 0 `pending`/`executing`
  withdrawals → safe to stop. `systemctl stop` → cutover backup → atomic
  `install`+`mv` binary swap → `systemctl start`.
- New PID `1500453`, `ActiveState=active`, listening `0.0.0.0:8453` + `:8454`.
- **Migration verified:** `seen_txs` primary key is now `(tx_hash, chain)`;
  all 7 rows preserved (row-set SHA256 `6068301d…` identical to backup).
- Health: `GET :8453/health` → `{"ok":true,"transfers_total":7,"transfers_pending":0,"version":"3.2.0"}`; `GET :8454/health` → `ok`.
- Startup log review: 0 errors/panics. Expected safety holds confirmed in
  logs: `WARP_API_KEY unset — mutating API routes disabled`,
  `no WARP_L1_RELEASE_KEYS — inbound transfers will hold in AwaitingFinality`,
  `WARP_VALIDATOR_KEYS loaded 1 keys, but quorum is 5`, `WARP_BTC_SWAP_ENABLED=0`,
  `PRL_PAYOUT_DRY_RUN=1`, qtc payouts deferred (treasury insufficient — pre-existing).
- `zion-v31-node` (PID 33968) untouched and active throughout.

### EDGE — `zion-v31-pool`

- `systemctl stop` → cutover backup (incl. `pool-pplns.json` and
  `99-zion-tuning.conf` drop-in) → atomic binary swap → `systemctl start`.
- New PID `714591`, `ActiveState=active`, listening `0.0.0.0:8444` + `:8445`.
- Health: `GET :8080/health` → `{"status":"ok"}`; `/stats` → `sessions` reconnecting
  (2 within ~30 s), PPLNS restored from state file: 214 registered miners,
  `payout_rounds` 95386 continuity preserved.
- Payout sidecar (`pool-pplns.json.payouts.json`) is created on first payout
  event by the new code — file absent at verify time (expected; no payout
  triggered during verification).
- Startup log review: 0 errors; stratum broadcasting `mining.notify`, auxpow
  legs and qtc_native jobs flowing.
- `zion-v31-node2`/`node3` (PIDs 1418682/1418683) untouched and active.

## 5. What was verified (and what was not)

Verified: binary hashes match staged artifacts exactly on both hosts;
services `active (running)` under original units/environment files (no env or
config changes); WARP `seen_txs` migration preserved all rows; health
endpoints return 200; no non-terminal transfers or withdrawals were in-flight
at cutover; no payout, mint, unlock, or release transaction was submitted
during verification; safety holds (no release keys → `AwaitingFinality` hold,
write API disabled without key, BTC swap off, PRL dry-run) are active in logs.

Not verified / residual: live-chain integration tests were not run; the new
deferred-payout retry path and the new payout sidecar will only exercise on a
real payout event; `qtc_sweeper` still reports 918 stalled queued payouts
(pre-existing operator item, treasury insufficient); `WARP_API_KEY` remains
unset by design; inbound L1 release remains a manual/operator path until
`WARP_L1_RELEASE_KEYS` are provisioned; the QTC payout treasury deficit is
unchanged by this deployment.

## 6. Deployed revision record

| Service | Host | Binary | SHA256 | Revision |
|---|---|---|---|---|
| `zion-v31-multichain` (`warpd`) | EDGE2 (207.180.217.100) | `/opt/zion/V31/target/release/warpd` | `bbc353c32b…e54f` | `6c8165d4a` |
| `zion-v31-pool` | EDGE (62.171.141.136) | `/opt/zion/V31/target/release/zion-pool` | `968f56aaeb…36c` | `6c8165d4a` |

Deployed 2026-10-25 ~19:30 UTC. No force-push, no L1 changes, no secret
material touched. `L4data/` remains untouched and untracked.
