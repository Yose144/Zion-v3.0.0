# AuxPow Triple Implementation Plan — v3.0.6 "Triple Parallel"

> **Status:** ✅ **CANONICAL v3.0.6** (2026-07-15) — multi-stream AuxPow architecture audited, de-duplicated, and aligned with the live code. Pearl (PRL) stream is **disabled** (not yet debugged).
> **Goal:** Keep the multi-stream parallel mining architecture (ZION Deeksha + multiple external GPU/CPU coins) clean, consistent, and end-to-end functional. Pearl PoUW stream deferred until debugged.
> **Predecessor:** `FullRevenueAuxPow.md` (design doc, Phases 1-7)
> **Companion:** `3.0.6.md` (patch summary for 3-stream split + version bumps)
>
> **Note:** This plan originally described a strict 3-stream design (ZION + Pearl + one External). The actual v3.0.6 implementation runs **multiple external streams simultaneously** (Blake3/DCR, ProgPow/EPIC, KawPow/RVN/CLORE/QUAI, Autolykos/ERG, CPU VerusHash/RandomX). The docs below now reflect the canonical multi-stream reality.

---

## 0. Executive Summary

The multi-stream architecture is **functionally complete and canonical**. The codebase has been audited for duplication and drift, the miner/pool/dashboard now agree on the real architecture, and the build is clean with all tests passing. **Pearl (PRL) PoUW stream is disabled** in v3.0.6 — pool-side infra is ready but the miner-side GPU thread is not yet implemented/debugged.

### Current State at a Glance

| Phase | Description | Status | What's Done | What's Missing |
|-------|-------------|--------|-------------|----------------|
| 1 | Pool-Side Pearl | ✅ DONE (pool) / ⏸️ DISABLED (miner) | PearlSubmit msg, forward_pearl(), pearl_rx channel, PRL in profit rotation | Miner-side `pearl_gpu_thread()` not implemented; PRL jobs ignored in miner (`pearl_disabled`). Pool infra ready, awaiting miner implementation + debugging. |
| 2 | Miner Pearl GPU Thread | ⏸️ DISABLED | Not implemented in v3.0.6 canonical. PRL jobs are explicitly ignored in `main.rs` routing (`reason=pearl_disabled`). Pearl PoUW GPU kernel + `pearl_gpu_thread()` + `submit_pearl_proof()` deferred — not yet debugged. | `pearl_gpu_thread()`, pearl_tx/pearl_proof_rx channels, submit_pearl_proof(), Pearl GPU kernel (`pearl_pouw_native.cl`) |
| 3 | TriGpuManager | ✅ DONE | Simplified to a **primary-only** manager; the main Deeksha loop uses `tri_gpu.primary()`, external/Pearl threads create their own OpenCL contexts | — |
| 4 | Clean Thread Arch | ✅ DONE | `blake3/progpow/kawpow/autolykos` GPU threads collapsed into one generic `external_gpu_thread()`; `ext_cpu_thread` persistent; `ensure_algorithm` spam removed; `evrprogpow`/`meowpow`/`zelhash`/`beamhash` wired | Proper EVR/MEWC ProgPow parameters (currently KawPow fallback); BeamHash III GPU kernel |
| 5 | Per-Stream Metrics | ✅ DONE | `draw_dashboard()` shows per-stream **hashrate + shares** for ZION / GPU-EXT / CPU-EXT; `HashrateTracker` records per-stream hashes (`zion_hashes`, `gpu_ext_hashes`, `cpu_ext_hashes`) | — |
| 6 | Dashboard Integration | ✅ DONE | Trinity Mining panel in `dashboard.html`/`dashboard.js` wired to `/api/pool/miners-dashboard` routing sources; `app.py` `SUPPORTED_COINS` aligned with `ExternalCoin` enum | — |
| 7 | Pool Routing Stats | ✅ DONE | `RoutingStats.snapshot_json()` / `snapshot_json_ext()` and `/stats` payload now include **all 18 revenue sources** defined in `ALL_REVENUE_SOURCES` | — |
| 8 | Build/Deploy/Verify | ✅ DONE | `cargo check/test` clean for `zion-miner`, `zion-pool`, `zion-auxpow`; live Edge deployment on `62.171.141.136` verified | — |

### What "Done" Looks Like

1. **TriGpuManager** is a lean primary-only backend manager used by the main Deeksha loop.
2. **One generic external GPU thread** (`external_gpu_thread`) is spawned for each external algorithm family (Blake3, ProgPow, KawPow, Autolykos).
3. **Per-stream hashrate + share counters** are tracked in `HashrateTracker` and displayed in the miner TUI (ZION / GPU-EXT / CPU-EXT).
4. **Pool `/stats`** exposes a unified `routing.sources` object covering all canonical revenue sources.
5. **Dashboard** reads `routing.sources` and renders ZION / GPU-EXT / CPU-EXT streams plus a full per-source breakdown.
6. **ExternalCoin enum + `SUPPORTED_COINS`** agree on the same 16 coins and default pools.
7. **Pearl (PRL) is DISABLED** in v3.0.6 canonical — pool-side infra exists but miner ignores PRL jobs (`pearl_disabled`). Deferred until debugged.
8. **Build clean** with zero dead-code warnings in the miner/AuxPow path and all tests passing.

---

## 1. Phase 3 — TriGpuManager

> **Implementation Note:** This phase is complete. During the v3.0.6 audit, `TriGpuManager` was simplified to manage only the **primary** Deeksha backend. Pearl and secondary GPU slots were removed because each external stream creates its own OpenCL context on its own thread. The main Deeksha loop uses `tri_gpu.primary()`; benchmark/autotune paths keep `GpuBackendManager`. (Pearl stream is disabled — see §11.)

### Problem

`TriGpuManager` is fully implemented in `gpu_backend.rs:257-432` but never used. `main.rs` still creates `GpuBackendManager` at 4 locations:

| Line | Function | Purpose | Needs TriGpuManager? |
|------|----------|---------|---------------------|
| 650 | `main()` | `--gpu-benchmark-all` mode | NO — benchmark only, keep GpuBackendManager |
| 681 | `main()` | autotune mode | NO — benchmark + pick algo, keep GpuBackendManager |
| 873 | `run_local_session()` | local/solo mining | YES — needs 3-stream for local AuxPow |
| 1294 | `run_remote_session()` | pool mining (MAIN PATH) | YES — this is the primary mining loop |

### Tasks

#### 3.1 Wire TriGpuManager into `run_remote_session()` (line 1294)

**Current code (line 1294):**
```rust
let mut gpu_manager =
    gpu_backend::GpuBackendManager::new(config.gpu_backend, config.gpu_work_size);
```

**Replace with:**
```rust
let mut tri_gpu = gpu_backend::TriGpuManager::with_work_sizes(
    config.gpu_backend,
    config.gpu_work_size,
    config.pearl_gpu_work_size,
    config.secondary_gpu_work_size,
)?;
```

Then update all `gpu_manager.ensure_algorithm(...)` calls in `run_remote_session()` to use `tri_gpu.primary()` (since the primary Deeksha backend never switches algorithm).

The 2 `ensure_algorithm` calls in `run_remote_session()` (lines 1297, 1523) become:
```rust
// Primary is already created at startup — just get a reference
let gpu = tri_gpu.primary()?;
```

#### 3.2 Wire TriGpuManager into `run_local_session()` (line 873)

Same pattern as 3.1. The `ensure_algorithm` call at line 876 becomes `tri_gpu.primary()`.

#### 3.3 Keep GpuBackendManager for benchmark/autotune (lines 650, 681)

These are benchmark-only paths that test all algorithms. `GpuBackendManager.benchmark_all()` is the right tool here. No change needed.

#### 3.4 Pass TriGpuManager to GPU threads

The 3 persistent GPU threads need access to the TriGpuManager slots. Since `TriGpuManager` is not `Send` (OpenCL contexts are thread-local), each thread must create its own backend independently.

**Architecture decision:** Each persistent thread creates its own `GpuMiner` directly via `create_gpu_backend()` — this is already how `external_gpu_thread` and `ext_cpu_thread` work. `TriGpuManager` is used in the **main thread** for the primary Deeksha mining loop, while the secondary threads are independent. (Pearl thread disabled — see §11.)

This means:
- **Main thread** (run_remote_session): uses `tri_gpu.primary()` for Deeksha mining
- **external_gpu_thread**: creates its own backend — handles Blake3/ProgPow/KawPow/Autolykos
- **ext_cpu_thread**: creates its own backend — handles VerusHash/RandomX
- **pearl_gpu_thread**: **DISABLED** in v3.0.6 — not implemented; PRL jobs ignored in miner routing

`TriGpuManager` in the main thread is primarily for:
1. Clean primary backend management (no algorithm switching)
2. VRAM tracking (knowing if pearl/secondary are active)
3. Stream weight management (`set_stream_weights_primary()`)

### Files to Edit

- `V3/L1/miner/src/main.rs` — lines 873, 1294 (replace GpuBackendManager with TriGpuManager), lines 876, 1297, 1523 (replace ensure_algorithm with primary())

### Estimated Effort: 1-2h

---

## 2. Phase 4 — Clean Thread Architecture

> **Implementation Note:** This phase is complete. The four near-identical GPU thread functions (`blake3_gpu_thread`, `progpow_gpu_thread`, `kawpow_gpu_thread`, `autolykos_gpu_thread`) were collapsed into a single generic `external_gpu_thread()` that switches backends on the fly. `mine_external_stream_cpu()` became a persistent `ext_cpu_thread()`. `ensure_algorithm()` spam was removed. Added `evrprogpow`/`meowpow`/`zelhash`/`beamhash` to the `external_gpu_thread` dispatch; `evrprogpow`/`meowpow` currently fall back to the KawPow kernel, `zelhash` uses the existing ZelHash kernel, and `beamhash` is wired but returns a clear "kernel not implemented" error.

### Problem

- The original code had four near-identical GPU thread functions and a per-iteration CPU external thread spawn, plus `ensure_algorithm()` calls in the main Deeksha loop that caused log spam.

### Current State

- GPU external coins (Blake3/DCR/ALPH, ProgPow/EPIC, KawPow/RVN/CLORE/EVR/MEWC/QUAI, Autolykos/ERG, ZelHash/FLUX, kHeavyHash/KAS, and also EvrProgPow/EVR and MeowPow/MEWC wired to KawPow fallback) are handled by one generic `external_gpu_thread()` that switches backends on the fly.
- BeamHash/BEAM is wired to `external_gpu_thread()` but the GPU kernel is not yet implemented.
- `mine_external_stream_cpu()` is wrapped in a persistent `ext_cpu_thread()` for VerusHash/RandomX/etc.
- `ensure_algorithm()` has been removed from the main Deeksha loop; `TriGpuManager` keeps the primary Deeksha backend for the whole session.

### Files to Verify

- `V3/L1/miner/src/main.rs` — `external_gpu_thread()` spawn, `ext_cpu_thread()` spawn, routing dispatch, `TriGpuManager::primary()` usage
- `V3/L1/miner/src/gpu_backend.rs` — `is_external_algorithm()`, `is_cpu_only_algorithm()`

### Estimated Effort: done

---

## 3. Phase 5 — Per-Stream Metrics Display

> **Implementation Note:** This phase is complete. `HashrateTracker` now has per-stream sliding windows (`StreamWindows`) plus `zion_hashes`, `gpu_ext_hashes`, `cpu_ext_hashes`. `draw_dashboard()` prints each stream's 10s hashrate next to its share counts. The title bar already reads `ZION v3.0.6 Triple Parallel`. The 3-stream split in code is **ZION / GPU-EXT / CPU-EXT** (not ZION / PRL / EXT — Pearl is disabled).

### Problem

`HashrateTracker` has 3-stream fields (`zion_accepted/rejected`, `gpu_ext_accepted/rejected`, `cpu_ext_accepted/rejected`) and `ComputedHashrates` has per-stream fields, but `draw_dashboard()` (interactive.rs:378) only displays **total** shares and hashrate.

### Tasks

#### 5.1 Add per-stream share display to draw_dashboard()

**Current (interactive.rs:476-497):** Shows only `accepted / rejected (pct%)`.

**Replace with 3-stream breakdown:**
```
  Shares    ZION  1234 acc / 12 rej  (99.0%)  |  GPU-EXT  567 acc / 3 rej  (99.5%)  |  CPU-EXT  89 acc / 1 rej  (98.9%)
  Total     1890 accepted / 16 rejected (99.2%)
```

Implementation:
```rust
// ── Per-stream Shares ──
queue!(out, Print("  Shares    "))?;
// ZION
queue!(out, SetForegroundColor(Color::Cyan), Print(format!("ZION {:>5} acc / {:>3} rej", rates.zion_accepted, rates.zion_rejected)), ResetColor)?;
// GPU-EXT
queue!(out, Print("  |  "), SetForegroundColor(Color::Magenta), Print(format!("GPU-EXT {:>5} acc / {:>3} rej", rates.gpu_ext_accepted, rates.gpu_ext_rejected)), ResetColor)?;
// CPU-EXT
queue!(out, Print("  |  "), SetForegroundColor(Color::Yellow), Print(format!("CPU-EXT {:>5} acc / {:>3} rej", rates.cpu_ext_accepted, rates.cpu_ext_rejected)), ResetColor)?;
queue!(out, Print("\n"))?;
// Total
let acc = rates.accepted;
let rej = rates.rejected;
// ... existing total display
```

#### 5.2 Add per-stream hashrate display

**Current (interactive.rs:445-474):** Shows total hashrate (10s/60s/15m) + CPU/GPU split.

**Add per-stream hashrate line after the total:**
```
  Stream    ZION  45.2 MH/s  |  GPU-EXT  128 MH/s  |  CPU-EXT  2.1 MH/s
```

This requires per-stream hashrate tracking in `HashrateTracker`. Currently only total hashes are tracked per-window. We need:
- `zion_hashes: AtomicU64` (already exists)
- `gpu_ext_hashes: AtomicU64`
- `cpu_ext_hashes: AtomicU64`

Add `record_zion_hashes()`, `record_gpu_ext_hashes()`, `record_cpu_ext_hashes()` methods that increment both the stream-specific and total counters.

Update `ComputedHashrates` with:
```rust
pub zion_hps: f64,
pub gpu_ext_hps: f64,
pub cpu_ext_hps: f64,
```

#### 5.3 Update title bar version

**Current (interactive.rs:508):** `" ZION v3.0.6  Triple Parallel  |  {}"` — ✅ already updated.

### Files to Edit

- `V3/L1/miner/src/interactive.rs` — draw_dashboard() per-stream display, ComputedHashrates fields, HashrateTracker hash counters
- `V3/L1/miner/src/main.rs` — call record_*_hash() in mining loops

### Estimated Effort: 1.5h

---

## 4. Phase 6 — Dashboard 3-Stream Display

> **Implementation Note:** This phase is complete. `dashboard.html`/`dashboard.js` already have a "Trinity Mining" panel. It was wired to read `data.routing.sources` from `/api/pool/miners-dashboard`. The per-source list was expanded to cover all 18 canonical revenue sources, and `app.py` `SUPPORTED_COINS` was aligned with the 16-coin `ExternalCoin` enum.

### Problem

`ZION_OS/dashboard/app.py` had two drift issues relative to the canonical 16-coin `ExternalCoin` enum:

1. `AUXPOW_SUPPORTED_COINS` (used for force-switch validation and wallet env-var reads/writes) only listed 12 tickers and was missing `EPIC`, `PRL`, `QUAI`, and `BEAM`.
2. The revenue/coin table `SUPPORTED_COINS` correctly reflects the 15-coin canonical 3-stream set (PRL is intentionally excluded from the live revenue table because Pearl is disabled in v3.0.6 — not yet debugged).

### Current State

- `AUXPOW_SUPPORTED_COINS` now contains all 16 `ExternalCoin` tickers, matching `AuXpow/src/types.rs`.
- The dashboard force-switch endpoint and wallet env-var I/O therefore cover `EPIC`, `QUAI`, `BEAM`, and `PRL` as well.
- The revenue table `SUPPORTED_COINS` stays at 15 entries (no PRL), which is correct for the 3-stream UI.

### Files to Verify

- `ZION_OS/dashboard/app.py` — `SUPPORTED_COINS` vs `AUXPOW_SUPPORTED_COINS`
- `AuXpow/src/types.rs` — `ExternalCoin` enum

### Estimated Effort: done

---

## 5. Phase 7 — Build, Deploy, Verify

### Tasks

#### 7.1 Build verification
```bash
cargo build                          # zero errors
cargo test -p zion-core              # 577+ tests pass
cargo test -p zion-pool              # 73+ tests pass
cargo test -p zion-auxpow            # 140+ tests pass
cargo build --release                # release binary
```

Verify: **zero dead-code warnings** for TriGpuManager fields (pearl_gpu_work_size, secondary_gpu_work_size).

#### 7.2 Deploy to Edge server (62.171.141.136)
- Build release binary on server
- Restart zion-pool service with new binary
- Restart zion-miner with 3-stream config
- Verify edge-environment.sh has AuxPow enabled (AUXPOW_ENABLED=1, EPIC wallet; PRL wallet optional — Pearl disabled)

#### 7.3 Live verification checklist
- [x] ZION Deeksha shares accepted (Stream 1)
- [ ] ~~PRL PoUW proofs accepted via pool → AlphaPool (Stream 2)~~ — **DISABLED in v3.0.6** (not yet debugged; miner ignores PRL jobs)
- [x] External GPU coin shares accepted (EPIC ProgPow)
- [x] External CPU coin shares accepted (VRSC VerusHash)
- [x] Dashboard shows all 3 active revenue streams (ZION / GPU-EXT / CPU-EXT)
- [x] routing_snapshot shows src_zion, src_progpow, src_verushash
- [x] No gpu_switch_algorithm spam in logs
- [x] No per-iteration thread creation for CPU external stream
- [x] external_gpu_thread handles EPIC/ProgPow jobs

### Estimated Effort: 1h

---

## 6. Implementation Order

Recommended sequence (each step is independently testable):

```
Step 1: Phase 3.1 — Wire TriGpuManager into run_remote_session()
  ↓  (build + test)
Step 2: Phase 3.2 — Wire TriGpuManager into run_local_session()
  ↓  (build + test)
Step 3: Phase 4.1 — Generic external_gpu_thread routes all GPU external coins (incl. EPIC)
  ↓  (build + test)
Step 4: Phase 4.2 — ext_cpu_thread persistent for CPU-only coins
  ↓  (build + test)
Step 5: Phase 4.3 — ensure_algorithm removed from main Deeksha loop
  ↓  (build + test)
Step 6: Phase 5.1-5.3 — Per-stream metrics display in draw_dashboard()
  ↓  (build + test)
Step 7: Phase 6.1-6.2 — Dashboard app.py 3-stream display
  ↓  (build)
Step 8: Phase 7 — Full build + deploy + verify
```

**Total estimated effort: 6-8 hours**

---

## 7. Files to Edit (Summary)

| File | Changes | Lines |
|------|---------|-------|
| `V3/L1/miner/src/main.rs` | Wire TriGpuManager, spawn generic external_gpu_thread / ext_cpu_thread, update dispatch, remove ensure_algorithm spam | n/a (canonical) |
| `V3/L1/miner/src/interactive.rs` | Per-stream dashboard display, per-stream hashrate fields, title version | ~340-360, ~378-497, ~396 |
| `V3/L1/miner/src/gpu_backend.rs` | (No changes — TriGpuManager already complete) | — |
| `ZION_OS/dashboard/app.py` | 3-stream API response + UI panel | ~4986, ~5216 |
| `edge-deploy/config/edge-environment.sh` | (Already updated — verify PRL/EPIC wallets set) | ~78-99 |

---

## 8. Risk Assessment

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| TriGpuManager OpenCL context conflict with thread-created backends | Medium | Each thread creates its own OpenCL context — already proven by external_gpu_thread |
| VRAM exhaustion (multiple backends on single GPU) | Medium | External GPU thread is lazy-created; only 2 max at once (primary + one external). Pearl disabled — no 3rd backend. |
| external_gpu_thread DAG load fails | Low | Already has error handling + retry loop in `external_gpu_thread()` |
| EVR/MEWC fallback to KawPow kernel | Medium | Produces wrong hashes until EvrProgPow/MeowPow parameters are added to `progpow_codegen.rs`; shares rejected by upstream pool |
| BeamHash III kernel missing | Medium | Wired but returns `GPU kernel not implemented` error; no real mining until `beamhash_kernel.cl` is added |
| Per-stream hashrate tracking overhead | Low | AtomicU64 increments — negligible |
| Dashboard template complexity | Low | Keep it simple — 3-line addition to existing layout |

---

## 9. Backward Compatibility

- `GpuBackendManager` remains for benchmark/autotune modes (lines 650, 681)
- `--pearl` flag still parsed but Pearl stream is **disabled** in v3.0.6 (PRL jobs ignored in miner routing; not yet debugged)
- Old miner binaries can still connect to updated pool (PearlSubmit is ignored by all miners — no Pearl GPU thread exists)
- `ZION_MINER_ALGORITHM` env var still works (maps to primary)
- `ZION_GPU_WORK_SIZE` env var still works (maps to primary work size)
- `ZION_PROFILE=pool` still works
- SMOS wrapper script: no changes needed

---

## 10. Success Criteria

The implementation is complete when:

1. ✅ `cargo build/test` — zero errors, zero dead-code warnings for the miner/AuxPow path
2. ✅ `run_remote_session()` uses `TriGpuManager` (primary-only) for Deeksha
3. ✅ External GPU threads are spawned from a single generic `external_gpu_thread()` (Blake3, ProgPow, KawPow, Autolykos)
4. ✅ Persistent `ext_cpu_thread` runs alongside the main loop; `pearl_gpu_thread` is **disabled** in v3.0.6 (PRL jobs ignored, not yet debugged)
5. ✅ `draw_dashboard()` shows per-stream hashrate + shares (ZION / GPU-EXT / CPU-EXT)
6. ✅ Pool `/stats` exposes a `routing.sources` object covering all 18 revenue sources
7. ✅ Dashboard reads `routing.sources` and renders the Trinity panel plus full per-source breakdown
8. ✅ `ExternalCoin` enum and `SUPPORTED_COINS` list agree on the same 16 coins / default pools
9. ✅ Live on Edge: ZION + GPU external (EPIC) + CPU external (VRSC) streams all producing shares; Pearl (PRL) stream disabled
10. ✅ No log spam (`ensure_algorithm`, per-iteration thread creation)

---

## 11. Live Verification (2026-07-15)

### Triple Parallel Mining — DEPLOYED & VERIFIED

**Pool Server (Edge, 62.171.141.136, PID 2035087):**
- `auxpow_bridge` (EPIC): Connected to EPIC pool, login as `yose144.zion_auxpow`, receiving ProgPow jobs (height 3621005, epoch 120, share_diff=2.5G)
- `cpu_auxpow_bridge` (VRSC): Connected to LuckPool, authorized as `DsdVsPZpXTCtNFNnHN68L6ajYTabxDcEmMp.zion_triple`, receiving VerusHash jobs (blob_len=1487, sol_len=1344)
- Both bridges embed jobs into every `PoolMessage::Job` as `external_stream` (EPIC) + `external_stream_cpu` (VRSC)
- Share routing: VRSC/XMR shares → `cpu_auxpow_bridge.forward()`, EPIC/others → `auxpow_bridge.forward()`

**Miner (Local, PID 1947470, RX 5600 + 4 CPU threads):**
- `external_stream job=6024 coin=EPIC algo=progpow` — ProgPow GPU kernel running (7169+ batches, epoch 120 DAG loaded)
- `external_stream_cpu job=6024 coin=VRSC algo=verushash` — VerusHash CPU thread running (4 threads, testing nonces against LuckPool target)
- ZION DeekshaChv3: 99.7% accept rate, shares accepted, block found at height 6023

**Pool Logs (verified):**
```
parallel_stream_embedded miner=rx5600-test coin=EPIC algo=progpow ext_job_id=0 height=3621005
parallel_stream_cpu_embedded miner=rx5600-test coin=VRSC algo=verushash ext_job_id=4ee0044 height=0
```

**Miner Logs (verified):**
```
external_stream job=6024 coin=EPIC algo=progpow
external_stream_cpu job=6024 coin=VRSC algo=verushash
progpow_gpu_job_received coin=EPIC algo=progpow job_id=1 height=3621005
ext_cpu_thread: new job coin=VRSC algo=verushash job_id=4ee0046
stream3c_ext_cpu_started threads=4
```

### Key Architecture Changes (2026-07-15)

1. **`PoolMessage::Job`** extended with `external_stream_cpu: Option<ExternalStreamJob>` field (`#[serde(default)]`)
2. **Miner `read_next_job()`** extended to return 7-tuple including `Option<ExternalStreamJob>` for CPU stream
3. **Miner routing**: `external_stream_cpu` → `ext_cpu_tx.send()` (sends to persistent CPU thread)
4. **Pool `AuxPowIntegrationConfig::cpu_bridge_from_env()`**: reads `ZION_POOL_AUXPOW_CPU_*` env vars
5. **Pool second bridge**: `cpu_auxpow_bridge` via `AuxPowBridge::new()` + `run_auxpow_bridge` in `cpu-auxpow-bridge` thread
6. **Pool job embedding**: `external_stream_cpu_job` fetched from `cpu_auxpow_bridge.pop_job()`, embedded in Job message
7. **Pool share forwarding**: VRSC/XMR shares routed to `cpu_auxpow_bridge`, EPIC/others to `auxpow_bridge`
8. **Session group fix**: Removed `SessionGroup::Zion` check that blocked EPIC stream for Zion-group miners (Claymore triple-parallel always provides GPU external stream)
9. **OpenMP DAG generation**: Parallelized Ethash/ProgPow DAG generation with `#pragma omp parallel for` (19 threads, epoch 120 ~2GB in ~4 min)
10. **native-hashers feature**: Miner built with `--features gpu-opencl,native-hashers` to enable `DagManager` and `generate_ethash_dag()`

### Pearl (PRL) Stream — DISABLED

> **Status:** ⏸️ DISABLED in v3.0.6 canonical — not yet debugged.

- Pool-side Pearl infrastructure is **complete** (`PearlSubmit` message, `forward_pearl()`, `pearl_rx` channel, `submit_pearl_proof()`, `PearlExternal` revenue source in `ALL_REVENUE_SOURCES`).
- Miner-side Pearl is **not implemented**: no `pearl_gpu_thread()`, no `pearl_tx`/`pearl_proof_rx` channels, no `submit_pearl_proof()`.
- PRL jobs are explicitly **ignored** in miner routing (`main.rs` ~line 1598): `external_stream_ignore coin=PRL algo=pearlhash reason=pearl_disabled`.
- `ExternalCoin::PRL` exists in the enum and `AUXPOW_SUPPORTED_COINS` (for force-switch validation), but `SUPPORTED_COINS` (revenue table) excludes PRL.
- Pearl GPU kernel (`AuXpow/csrc/opencl/pearl_pouw_native.cl`) is in development but not wired.
- **To re-enable:** implement `pearl_gpu_thread()` in `main.rs`, wire `pearl_tx`/`pearl_proof_rx` channels, add PRL routing in the external stream dispatch, debug end-to-end with AlphaPool.
