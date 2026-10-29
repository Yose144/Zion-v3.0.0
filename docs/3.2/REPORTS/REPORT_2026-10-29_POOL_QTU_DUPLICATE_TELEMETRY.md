# Report — Pool QTU duplicate telemetry (2026-10-29)

**Status:** **FIXED & LIVE** (2026-10-29) — dual-SRB per GPU + pool EN1 entropy fix; canary 0 local_dedup.  
**Operator:** desktop-agent QTU rejects → miner partition + pool EN1 + telemetry.

---

## 1. Symptom (desktop agent)

- Desktop agent on dest-zion runs **SRBMiner-MULTI 3.7.6** (`qtcEngine=auto` → SRB) against **ZION pool** `62.171.141.136:8444` (not direct lproute).
- Wallet/worker: `qzjoHwaJ2GfiRSHyYkYcpoJFbHct9pb9EAbs7sE51Uhj8r2zb.dest-zion`
- GPUs: RX 5600 XT + GTX 1070 Ti (`srbminerGpuId=0,1`)
- SRB API at peak of incident window: **~242 accepted / ~105 rejected (~30 %)**
- `srbminer.log`: **100 % of rejects = `[duplicate]`** (no low-diff / stale / invalid job)

## 2. Where the reject happens

| Layer | Finding |
|---|---|
| Upstream lproute | EDGE journal: **178× `auxpow[QTU] … Accepted` / 0× Rejected** in 3 h sample → not upstream |
| Pool QTU stratum | `reserve_external_share("qtu", job_id, nonce:result)` fails → `Err("duplicate")` **before** forward |
| Pool `/miners` | dest-zion QTU showed `valid_shares>0`, **`invalid_shares=0`**, `reject_reasons=null` — **UI lie** |
| Prometheus | `zion_pool_coin_shares_rejected{coin="qtu"}=0` while SRB rejected heavily |

**Root class:** local share dedup (correct anti-double-credit / anti-upstream-spam), **not** a ZION vardiff/job-target regression (`a12c97645` is ZION-only).

**Likely why so many dups:** one SRB process, one session extranonce, **two GPUs** scanning overlapping nonce space (`gpu_rejected` ≈ 56/51). Secondary worker `vast-58077390-qtu` on same wallet is fine if EN1 differs; dual-GPU same session is the main pressure.

## 3. Code changes (local repo — not finished EDGE cutover)

Files:

- `V31/L1/pool/src/stratum.rs`
  - **QTU** `qtu_handle_submit`: on local dedup miss → INFO `status=duplicate (local_dedup)` + `record_external_share(..., false)` + `record_reject_reason(..., "duplicate")` + routing_stats reject
  - **V3 external**: post-accept PPLNS dedup miss no longer `continue`s without telemetry (`v3_external_duplicate` log + reject_reason)
  - **Pearl**: same — mutate to `duplicate` and fall through telemetry (was early `return`)
- `V31/L1/pool/src/telemetry.rs`
  - regression test `test_local_duplicate_rejects_accumulate` ✅

**Not a behaviour change to accept/reject economics** — only observability + routing reject accounting for shares already rejected as duplicate.

Desktop-agent debug instrumentation (`apps/desktop-agent/src/main.js` `#region agent log`) was added for the debug session — **leave or strip separately**; not required for the pool fix.

## 4. EDGE deploy attempt (aborted)

| Step | Result |
|---|---|
| Sync `stratum.rs` → `/opt/zion/V31/...` | done (sha `ac5993d5…`) |
| Build in `/opt/zion/V31` | **FAIL** — broken workspace (`chacha20poly1305` missing from `workspace.dependencies`) |
| Build in `/opt/zion-rel/build/V31` | waited on competing `cargo build -p zion-pool` (~25 min, EXIT=0) |
| Incremental rebuild + install | started; **stopped on operator request** (other pool work) |
| Running pool @ abort time | still pre-fix or partial; **do not assume cutover** — verify `strings $(pool exe) \| grep local_dedup` + `/health.build` before claiming live |

Backup path prepared/intended: `/root/pool-deploy-backup-20261029-dedup-telem` (may be incomplete if install aborted mid-script).

**Rollback (if a bad binary was swapped):** restore `zion-pool.running` from that backup dir over `/opt/zion/V31/target/release/zion-pool` + `systemctl restart zion-v31-pool`.

## 5. Fix shipped (2026-10-29 ~14:40–14:57 CET)

### Root causes

1. **Dual-GPU / one SRB session** (`srbminerGpuId=0,1`) → one extranonce → overlapping nonce → `reserve_external_share` `duplicate`.
2. **Pool EN1 entropy bug:** session EN1 used BE high-4-bytes of nanos (constant ~4.3 s) → two logins in the same window got the **same** EN1 even with separate workers.

### Changes

| Layer | Change |
|---|---|
| Desktop agent | [`apps/desktop-agent/src/main.js`](../../../apps/desktop-agent/src/main.js): multi-ID `srbminerGpuId` → **N SRB processes** (`dest-zion.gpu0` / `.gpu1`, API 21550+) |
| Pool | [`stratum.rs`](../../../V31/L1/pool/src/stratum.rs) QTU EN1 = LE low-4-bytes + seq mix (EDGE build deployed) |
| Pool unit | [`zion-v31-pool.service`](../../../V31/deploy/systemd/zion-v31-pool.service) ExecStart primary-only `:9445` (anti tip-affinity fork) |

### Canary (post dual-SRB + EN1 fix, ~3 min)

- Pool journal: **0× local_dedup**, **11×** QTU accepted
- SRB gpu0: **A:2 R:0** (~103 MH/s); gpu1: **A:2 R:0** (~61 MH/s)
- Tips primary/node2/node3 aligned during window

### What this does *not* change

- Pool dedup stays strict (correct anti-double-credit).
- Historical SRB lifetime A/R counters from before restart are irrelevant — use post-restart logs.

## 6. Resume checklist (when pool lane is free)

1. Confirm no other `cargo build -p zion-pool` on EDGE.
2. Ensure `stratum.rs` with `local_dedup` is in the **healthy** build tree (`/opt/zion-rel/build/V31` or fixed `/opt/zion/V31`).
3. `cargo build --release -p zion-pool` (EDGE glibc; prefer without `--locked` if cache drift).
4. Backup running exe + store.db + pplns (`V31/deploy/POOL-DEPLOY-RUNBOOK.md`).
5. Atomic install + drain restart.
6. Canary 15 min: ZION accept-rate ≥ baseline−5 pb; QTU `reject_reasons.duplicate` should rise when SRB still dual-GPU; journal `local_dedup`.

## 7. Related evidence pointers

- Live SRB: `~/.config/zion-desktop-agent/srbminer.log`, API `:21550`
- Pool API: `http://127.0.0.1:8080/miners` (via EDGE tunnel), metrics `zion_pool_coin_shares_*{coin="qtu"}`
- EDGE journal: `journalctl -u zion-v31-pool \| grep -E 'qtu_stratum|auxpow\[QTU\]|local_dedup'`

---

*Written 2026-10-29 — session paused pool deploy to avoid colliding with parallel pool work.*

---

## Appendix — deploy collision note (same day)

While attempting EDGE cutover, a parallel `cargo build -p zion-pool` was already running under `/opt/zion-rel/`. Operator asked to stop colliding; this QTU telemetry cutover was **not** completed as a controlled canary. A later `/health.build` of `c95ca3437` may belong to that other lane — verify provenance before attributing `local_dedup` strings to this change set.
