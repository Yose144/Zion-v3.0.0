# QTU Native Stratum for SRBMiner — Deployment Report

**Date:** 2026-10-10 · **Status:** DEPLOYED to Edge (`62.171.141.136:8444`), live-verified
**Commits:** `a78ce63c3` (implementation + fixes), `54b3794a3` (ops notes)

## Summary

The ZION V31 pool now natively speaks the **XMRig/miningcore JSON-RPC stratum dialect** that
SRBMiner-MULTI uses for `--algorithm quantus`. External QPoW miners can point straight at the
pool — no LuckyPool, no local bridge. Verified end-to-end in production: SRBMiner hashing
~230–250 MH/s against the native pool with shares accepted every few seconds, **~93 % of them
on native `qtun:` jobs** (locally validated by `qtc_native`, winning nonces forwarded to our
own Quantus node).

## Why a new protocol path

| What exists | Protocol | Problem for SRBMiner |
|---|---|---|
| Simplified Stratum V1 (`stratum_v1.rs`) | `mining.subscribe/notify/submit`, custom 5-param notify | Explicitly NOT compatible with external miners (docs say so) |
| V3 protocol (`v3_protocol.rs`) | `external_stream` jobs incl. QTU | Only our `zion-miner` speaks it |
| **Wire capture vs `eu.lproute.com:5660`** | `login`/`job`/`submit`/`keepalive` JSON-RPC | What SRBMiner actually sends — captured live |

Captured SRBMiner `login`:
```json
{"id":1,"method":"login","params":{"login":"<wallet>.<worker>","pass":"x","agent":"SRBMiner-MULTI/3.6.9"}}
```
Pool response shape (mirrors upstream):
```json
{"result":{"extensions":["keepalive"],"id":"<session>","status":"OK",
 "job":{"algo":"qpow-poseidon2","job_id":"...","mining_hash":"<64hex>",
        "target":"<128hex>","extranonce":"<8hex>","difficulty":N,"seq":N}}}
```
Job push: `{"jsonrpc":"2.0","method":"job","params":{"clean_jobs":true,"job":{...}}}`
Submit: `{"method":"submit","params":{"id","job_id","nonce":"<128hex>","result":"<128hex>"}}`

## Implementation

- **`V31/L1/pool/src/stratum_qtu.rs`** (new, 369 LOC) — codec: `is_qtu_stratum` detector,
  `parse_login`, `parse_submit`, `login_ok`, `job_wire`, `job_notify`, `submit_ok`,
  `submit_err`, `keepalive_ok`. Unit tests for every wire shape.
- **`V31/L1/pool/src/stratum.rs`** — session handler + dispatch. QTU detection runs
  **before** `is_stratum_v1` in both plain-TCP and TLS accept paths (V1's detector accepts
  any JSON with a `method` field — ordering is load-bearing). Polls job rotation at 1.5 s,
  pushes `job` notifications on change, resyncs a fresh job after stale submits.
- **Job source:** `qtu_current_job()` = `MultiAuxPowBridge::native_pick_job()` (native
  `qtun:` jobs marked `serve_native`) → fallback `latest_job_for_coin(Quantus)` (upstream
  lproute via `auxpow_runtime`).
- **Submit routing:** `qtun:` → `qtc_native::submit_share` (local QPoW validation + block
  forwarding to our Quantus node); upstream → `forward_by_ticker("QTU")` →
  `AuxPowClient::submit_qpow_share`. PPLNS + telemetry via `record_external_share`
  (stream key is lowercase `"qtu"`).
- **Feature gate:** `ZION_POOL_QTU_STRATUM=0` disables (default ON).

## Bugs found & fixed along the way

1. **Notifier startup panic (pre-existing deploy-blocker).**
   `Notifier::new` → `reqwest::blocking::Client::builder().build()` panics inside an async
   context (`#[tokio::main]`): *"Cannot drop a runtime in a context where blocking is not
   allowed"* (tokio `blocking/shutdown.rs:51`). Old Edge binary predated the regression —
   **any rebuild would have died at startup.** Fix: build the client on a dedicated std
   thread in `notifications.rs` (verified: build-on-thread + drop-in-async-ctx is safe).
   Masked secondary causes: default `ZION_POOL_MINER_ADDRESS=zion1pool` is not a valid
   bech32 (early `?` → teardown panic), and default `ZION_POOL_API_BIND=127.0.0.1:8080`
   collided with a local SSH forward (bind error doesn't propagate — `select!` exits).

2. **`extranonce mismatch` rejects post-deploy.**
   Upstream QTU jobs must carry the **upstream-assigned** extranonce — it is a 4-byte
   prefix the miner embeds in the nonce (`qpow_cuda.rs` comment). First version sent a
   per-session generated value → upstream rejected. Fix: `qtu_job_en1()` helper —
   `JobPackage.extranonce1_hex` when set, session fallback otherwise (same pattern as
   V3's `en1_hex_final`).

3. **E2E test runtime-drop panic.** `StratumServer` owns a `Notifier` (reqwest blocking
   client) — must be constructed and dropped on a plain thread, not inside `block_on`.
   Test restructured: server built on the sync test thread, clone passed into a dedicated
   current-thread runtime.

## Verification

| Layer | Result |
|---|---|
| `stratum_qtu` codec unit tests | 6/6 |
| `qtu_stratum_end_to_end` (real TCP listener, real QPoW share @ diff 4, telemetry assert) | PASS |
| Full pool suite | **214/214** |
| Local binary smoke (standalone stratum) | login → `result{id,status:OK}`, V1 subscribe regression clean |
| **Production wire test** | `login` → `result.job` = `qtun:` native job, `keepalive` → `KEEPALIVED` |
| **Live SRBMiner** (`62.171.141.136:8444`, worker `dest-zion`) | `share accepted` every ~5–7 s, latency 55–160 ms |

## Live production metrics (first ~25 min)

- SRBMiner total: **~249 MH/s @ ~249 W** (5600XT ~111 + Vega ~139), `A:25 R:0` post-fix
- Edge `qtu_stratum share ok`: **40 accepted** / 25 min
- Job mix served: **`qtun:` native 42 / upstream 3** (~93 % native leg)
- V3 shares unchanged: **730 accepted** / 25 min
- Services: `zion-v31-node`, `zion-v31-pool`, `zion-quantus-node`, `zion-bitcoind` — all active

## Deploy path (reusable)

- Edge repo `/opt/zion/V31` is a git checkout with **diverged local edits** — do NOT build
  there. Used `git worktree add /tmp/zion-qtu-build <commit>` + `git apply` + copy of the
  new file, then:
  `PATH=/root/.cargo/bin:$PATH CARGO_TARGET_DIR=/opt/zion/V31/target cargo build --release -p zion-pool`
  (reuses the shared dep cache; first build ~13 min, incremental ~5.5 min).
- glibc: local 2.43 > Edge 2.39 — **never rsync a locally-built binary**.
- Backup before swap: `zion-pool.bak-pre-qtu` (rollback = `cp` + restart).
- Desktop agent: `miner_config.json` → `srbminerPool=62.171.141.136:8444`. NOTE: a running
  agent does not re-read the file — respawns use the renderer's in-memory config; the new
  value applies only after a full app restart.

## Ops notes

- `ZION_POOL_QTU_STRATUM=0` in `/etc/zion/edge-environment.sh` turns the listener path off.
- Qtu sessions log as `qtu_stratum: <ip> login/share/job push …` in the pool journal.
- Difficulty served: native `QTC_NATIVE_SHARE_DIFF` (1e9) for `qtun:` jobs; upstream jobs
  carry their own target/difficulty.
- Remaining risk is low: sessions are isolated per-connection; a QTU session crash can't
  affect V1/V3 paths. Soak over the next hours will confirm share-rate stability.
