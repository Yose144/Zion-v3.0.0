# AuxPow Triple Implementation Plan — v3.0.6 "Triple Parallel"

> **Status:** PLANNING — created 2026-07-14
> **Goal:** Complete the 3-stream parallel mining architecture (ZION Deeksha + Pearl PoUW + External GPU) so all 7 phases of `FullRevenueAuxPow.md` are fully DONE.
> **Predecessor:** `FullRevenueAuxPow.md` (design doc, Phases 1-7)
> **Companion:** `3.0.6.md` (patch summary for 3-stream split + version bumps)

---

## 0. Executive Summary

The 3-stream architecture has been **partially implemented** across 7 phases. Phases 1-2 (pool-side Pearl + miner pearl_gpu_thread) are DONE. Phases 3-6 are PARTIAL — data structures and scaffolding exist but are not wired together. This plan completes the remaining work.

### Current State at a Glance

| Phase | Description | Status | What's Done | What's Missing |
|-------|-------------|--------|-------------|----------------|
| 1 | Pool-Side Pearl | ✅ DONE | PearlSubmit msg, forward_pearl(), pearl_rx channel, PRL in profit rotation | — |
| 2 | Miner Pearl GPU Thread | ✅ DONE | pearl_gpu_thread() at main.rs:2738, pearl_tx/pearl_proof_rx channels, submit_pearl_proof() | — |
| 3 | TriGpuManager | ⚠️ SCAFFOLD | Struct defined in gpu_backend.rs:257, all methods implemented | NOT wired into main.rs (still uses GpuBackendManager at 4 locations) |
| 4 | Clean Thread Arch | ⚠️ PARTIAL | blake3_gpu_thread + progpow_gpu_thread persistent, pearl_gpu_thread persistent | progpow_gpu_thread never spawned, ensure_algorithm spam in main loop, mine_external_stream_cpu still per-iteration |
| 5 | Per-Stream Metrics | ⚠️ PARTIAL | HashrateTracker has 3-stream fields + record methods, ComputedHashrates has per-stream fields | draw_dashboard() still shows only total shares, no per-stream display |
| 6 | Dashboard app.py | ⚠️ PARTIAL | PRL in SUPPORTED_COINS, stream_profit endpoint exists | No 3-stream hashrate display in dashboard UI |
| 7 | Build/Deploy/Verify | ✅ Build clean | 577 core + 73 pool + 129 auxpow tests pass | Deployment + live verification pending |

### What "Done" Looks Like

1. **TriGpuManager** replaces `GpuBackendManager` in `run_remote_session()` and `run_local_session()`
2. **3 persistent GPU threads** run in parallel: Deeksha (primary), Pearl (lazy), External GPU (lazy)
3. **progpow_gpu_thread** is spawned for EPIC ProgPow jobs (or routed via TriGpuManager secondary slot)
4. **Dashboard** shows per-stream hashrate + shares: `ZION xxx H/s | PRL xxx H/s | EXT xxx H/s`
5. **No dead code**: `mine_external_stream_cpu` removed or made persistent, `ensure_algorithm` spam gone
6. **Build clean** with zero dead-code warnings for TriGpuManager fields

---

## 1. Phase 3 — Wire TriGpuManager into main.rs

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

**Architecture decision:** Each persistent thread creates its own `GpuMiner` directly via `create_gpu_backend()` — this is already how `blake3_gpu_thread` and `pearl_gpu_thread` work. `TriGpuManager` is used in the **main thread** for the primary Deeksha mining loop, while the secondary threads are independent.

This means:
- **Main thread** (run_remote_session): uses `tri_gpu.primary()` for Deeksha mining
- **blake3_gpu_thread**: already creates its own backend (line 2384) — no change
- **pearl_gpu_thread**: already creates its own backend (line 2738) — no change
- **progpow_gpu_thread**: already creates its own backend (line 2547) — needs to be SPAWNED

`TriGpuManager` in the main thread is primarily for:
1. Clean primary backend management (no algorithm switching)
2. VRAM tracking (knowing if pearl/secondary are active)
3. Stream weight management (`set_stream_weights_primary()`)

### Files to Edit

- `V3/L1/miner/src/main.rs` — lines 873, 1294 (replace GpuBackendManager with TriGpuManager), lines 876, 1297, 1523 (replace ensure_algorithm with primary())

### Estimated Effort: 1-2h

---

## 2. Phase 4 — Clean Thread Architecture

### Problem

- `progpow_gpu_thread()` (line 2547) is defined but **never spawned** — EPIC ProgPow jobs have no GPU handler
- `mine_external_stream_cpu()` (line 2896) is spawned **per-iteration** (line 1592) — creates a new thread every mining cycle for VerusHash/etc
- `ensure_algorithm()` is called in the main loop (lines 1297, 1523) causing log spam when algorithm doesn't change

### Tasks

#### 4.1 Spawn progpow_gpu_thread for EPIC jobs

Add a persistent ProgPow GPU thread, similar to blake3_gpu_thread and pearl_gpu_thread.

**Near line 1355 (after pearl_gpu_thread spawn), add:**
```rust
// ── Persistent ProgPow GPU thread (EPIC) ──
let (progpow_tx, progpow_rx) = std::sync::mpsc::channel::<zion_pool::ExternalStreamJob>();
let (progpow_share_tx, progpow_share_rx) = std::sync::mpsc::channel::<ExternalShareResult>();
if dual_gpu_enabled {
    let ws = config.secondary_gpu_work_size;
    thread::spawn(move || {
        progpow_gpu_thread(progpow_rx, progpow_share_tx, ws);
    });
    println!("[{}] progpow_gpu_thread_started work_size={}", log_timestamp(), ws);
}
```

**Update ext stream dispatch (line 1577) to route EPIC/ProgPow:**
```rust
if let Some(ref ext) = external_stream {
    if ext.coin.eq_ignore_ascii_case("PRL") || ext.algorithm.eq_ignore_ascii_case("pearlhash") {
        let _ = pearl_tx.send(ext.clone());
    } else if matches!(ext.algorithm.as_str(), "blake3" | "blake3_dcr" | "blake3_alph") {
        let _ = ext_gpu_tx.send(ext.clone());
    } else if matches!(ext.algorithm.as_str(), "progpow" | "progpow_epic") {
        let _ = progpow_tx.send(ext.clone());
    }
}
```

**Update CPU fallback condition (line 1588) to exclude ProgPow:**
```rust
let is_progpow = matches!(ext.algorithm.as_str(), "progpow" | "progpow_epic");
if !is_pearl && !is_blake3 && !is_progpow {
    // CPU parallel thread for VerusHash, RandomX, etc.
    ...
}
```

**Add progpow share drain in main loop** (near pearl_proof_rx drain at line 1665):
```rust
// Drain progpow shares
while let Ok(share) = progpow_share_rx.try_recv() {
    // Submit to pool as external share
    ...
}
```

#### 4.2 Make mine_external_stream_cpu persistent (VerusHash/RandomX)

Currently a new thread is spawned every iteration (line 1592). Convert to a persistent thread like the others.

**Add near line 1360:**
```rust
// ── Persistent CPU external thread (VerusHash, RandomX, etc.) ──
let (ext_cpu_tx, ext_cpu_rx) = std::sync::mpsc::channel::<zion_pool::ExternalStreamJob>();
let (ext_cpu_share_tx, ext_cpu_share_rx) = std::sync::mpsc::channel::<ExternalShareResult>();
thread::spawn(move || {
    ext_cpu_thread(ext_cpu_rx, ext_cpu_share_tx, threads);
});
```

**Create `ext_cpu_thread()` function** (replaces per-iteration spawn):
```rust
fn ext_cpu_thread(
    rx: std::sync::mpsc::Receiver<zion_pool::ExternalStreamJob>,
    tx: std::sync::mpsc::Sender<ExternalShareResult>,
    threads: usize,
) {
    let mut current_job: Option<zion_pool::ExternalStreamJob> = None;
    loop {
        match rx.try_recv() {
            Ok(job) => { current_job = Some(job); }
            Err(std::sync::mpsc::TryRecvError::Disconnected) => return,
            Err(std::sync::mpsc::TryRecvError::Empty) => {}
        }
        if let Some(ref ext) = current_job {
            if let Some(result) = mine_external_stream_cpu(ext, threads) {
                let _ = tx.send(result);
                current_job = None; // Wait for next job
            }
        }
        std::thread::sleep(std::time::Duration::from_millis(100));
    }
}
```

**Update dispatch (line 1588):** Route VerusHash/RandomX to `ext_cpu_tx` instead of spawning per-iteration.

#### 4.3 Remove ensure_algorithm spam from main loop

With TriGpuManager, the primary backend never switches. Remove the `ensure_algorithm` calls at lines 1297, 1523 in `run_remote_session()` and line 876 in `run_local_session()`. The primary is created at startup and stays Deeksha forever.

### Files to Edit

- `V3/L1/miner/src/main.rs` — spawn progpow_gpu_thread, create ext_cpu_thread, update dispatch routing, remove ensure_algorithm spam

### Estimated Effort: 2h

---

## 3. Phase 5 — Per-Stream Metrics Display

### Problem

`HashrateTracker` has 3-stream fields (`zion_accepted/rejected`, `pearl_accepted/rejected`, `ext_accepted/rejected`) and `ComputedHashrates` has per-stream fields, but `draw_dashboard()` (interactive.rs:378) only displays **total** shares and hashrate.

### Tasks

#### 5.1 Add per-stream share display to draw_dashboard()

**Current (interactive.rs:476-497):** Shows only `accepted / rejected (pct%)`.

**Replace with 3-stream breakdown:**
```
  Shares    ZION  1234 acc / 12 rej  (99.0%)  |  PRL  567 acc / 3 rej  (99.5%)  |  EXT  89 acc / 1 rej  (98.9%)
  Total     1890 accepted / 16 rejected (99.2%)
```

Implementation:
```rust
// ── Per-stream Shares ──
queue!(out, Print("  Shares    "))?;
// ZION
queue!(out, SetForegroundColor(Color::Cyan), Print(format!("ZION {:>5} acc / {:>3} rej", rates.zion_accepted, rates.zion_rejected)), ResetColor)?;
// PRL
queue!(out, Print("  |  "), SetForegroundColor(Color::Magenta), Print(format!("PRL {:>5} acc / {:>3} rej", rates.pearl_accepted, rates.pearl_rejected)), ResetColor)?;
// EXT
queue!(out, Print("  |  "), SetForegroundColor(Color::Yellow), Print(format!("EXT {:>5} acc / {:>3} rej", rates.ext_accepted, rates.ext_rejected)), ResetColor)?;
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
  Stream    ZION  45.2 MH/s  |  PRL  1.20 GH/s  |  EXT  128 MH/s
```

This requires per-stream hashrate tracking in `HashrateTracker`. Currently only total hashes are tracked per-window. We need:
- `zion_hashes: AtomicU64` (already exists as `zion_accepted` for shares, but need hash count)
- `pearl_hashes: AtomicU64`
- `ext_hashes: AtomicU64`

Add `record_zion_hash()`, `record_pearl_hash()`, `record_ext_hash()` methods that increment both the stream-specific and total counters.

Update `ComputedHashrates` with:
```rust
pub zion_hps: f64,
pub pearl_hps: f64,
pub ext_hps: f64,
```

#### 5.3 Update title bar version

**Current (interactive.rs:396):** `" ZION v3.0.1  GPU Miner"` — should be `" ZION v3.0.6  Triple Parallel"`.

### Files to Edit

- `V3/L1/miner/src/interactive.rs` — draw_dashboard() per-stream display, ComputedHashrates fields, HashrateTracker hash counters
- `V3/L1/miner/src/main.rs` — call record_*_hash() in mining loops

### Estimated Effort: 1.5h

---

## 4. Phase 6 — Dashboard app.py 3-Stream Display

### Problem

`ZION_OS/dashboard/app.py` has PRL in `SUPPORTED_COINS` and `stream_profit` endpoint, but the dashboard UI doesn't show per-stream hashrate or 3-stream revenue breakdown.

### Tasks

#### 6.1 Add 3-stream hashrate to pool stats endpoint

The pool already tracks per-stream routing stats (`src_pearl`, `src_zion`, `src_verushash`). Expose these in the dashboard API response.

**In app.py (near line 5216 where stream_profit is added):**
```python
result["stream_hashrates"] = {
    "zion": pool_rev.get("zion_hashrate_hps", 0),
    "pearl": pool_rev.get("pearl_hashrate_hps", 0),
    "ext": pool_rev.get("ext_hashrate_hps", 0),
}
result["stream_shares"] = {
    "zion": {"accepted": ..., "rejected": ...},
    "pearl": {"accepted": ..., "rejected": ...},
    "ext": {"accepted": ..., "rejected": ...},
}
```

#### 6.2 Add 3-stream display to dashboard HTML template

Add a "Triple Stream" panel showing:
- ZION Deeksha: hashrate + shares + revenue $/day
- Pearl PoUW: hashrate + proofs + revenue $/day
- External (current coin): hashrate + shares + revenue $/day

This requires updating the dashboard HTML/JS template in app.py (or a separate template file if used).

### Files to Edit

- `ZION_OS/dashboard/app.py` — stream_hashrates/stream_shares in API response, HTML template update

### Estimated Effort: 1h

---

## 5. Phase 7 — Build, Deploy, Verify

### Tasks

#### 7.1 Build verification
```bash
cargo build                          # zero errors
cargo test -p zion-core              # 577+ tests pass
cargo test -p zion-pool              # 73+ tests pass
cargo test -p zion-auxpow            # 129+ tests pass
cargo build --release                # release binary
```

Verify: **zero dead-code warnings** for TriGpuManager fields (pearl_gpu_work_size, secondary_gpu_work_size).

#### 7.2 Deploy to Edge server (62.171.141.136)
- Build release binary on server
- Restart zion-pool service with new binary
- Restart zion-miner with 3-stream config
- Verify edge-environment.sh has AuxPow enabled (AUXPOW_ENABLED=1, PRL wallet, EPIC wallet)

#### 7.3 Live verification checklist
- [ ] ZION Deeksha shares accepted (Stream 1)
- [ ] PRL PoUW proofs accepted via pool → AlphaPool (Stream 2)
- [ ] External coin shares accepted (Stream 3 — VRSC or EPIC)
- [ ] Dashboard shows all 3 revenue streams
- [ ] routing_snapshot shows src_pearl, src_zion, src_ext
- [ ] No gpu_switch_algorithm spam in logs
- [ ] No per-iteration thread creation for CPU external stream
- [ ] progpow_gpu_thread starts when EPIC job arrives

### Estimated Effort: 1h

---

## 6. Implementation Order

Recommended sequence (each step is independently testable):

```
Step 1: Phase 3.1 — Wire TriGpuManager into run_remote_session()
  ↓  (build + test)
Step 2: Phase 3.2 — Wire TriGpuManager into run_local_session()
  ↓  (build + test)
Step 3: Phase 4.1 — Spawn progpow_gpu_thread + route EPIC jobs
  ↓  (build + test)
Step 4: Phase 4.2 — Make ext_cpu_thread persistent
  ↓  (build + test)
Step 5: Phase 4.3 — Remove ensure_algorithm spam
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
| `V3/L1/miner/src/main.rs` | Wire TriGpuManager, spawn progpow_gpu_thread, ext_cpu_thread, update dispatch, remove ensure_algorithm spam | ~873, ~1294, ~1346, ~1577, ~1588, ~1592, ~1665, ~1297, ~1523 |
| `V3/L1/miner/src/interactive.rs` | Per-stream dashboard display, per-stream hashrate fields, title version | ~340-360, ~378-497, ~396 |
| `V3/L1/miner/src/gpu_backend.rs` | (No changes — TriGpuManager already complete) | — |
| `ZION_OS/dashboard/app.py` | 3-stream API response + UI panel | ~4986, ~5216 |
| `edge-deploy/config/edge-environment.sh` | (Already updated — verify PRL/EPIC wallets set) | ~78-99 |

---

## 8. Risk Assessment

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| TriGpuManager OpenCL context conflict with thread-created backends | Medium | Each thread creates its own OpenCL context — already proven by blake3_gpu_thread |
| VRAM exhaustion (3 backends on single GPU) | Medium | Pearl + secondary are lazy-created; only 2 max at once (primary + one secondary) |
| progpow_gpu_thread DAG load fails | Low | Already has error handling + retry loop (line 2645) |
| Per-stream hashrate tracking overhead | Low | AtomicU64 increments — negligible |
| Dashboard template complexity | Low | Keep it simple — 3-line addition to existing layout |

---

## 9. Backward Compatibility

- `GpuBackendManager` remains for benchmark/autotune modes (lines 650, 681)
- `--pearl` flag still works as direct AlphaPool fallback
- Old miner binaries can still connect to updated pool (PearlSubmit is ignored by old miners)
- `ZION_MINER_ALGORITHM` env var still works (maps to primary)
- `ZION_GPU_WORK_SIZE` env var still works (maps to primary work size)
- `ZION_PROFILE=pool` still works
- SMOS wrapper script: no changes needed

---

## 10. Success Criteria

The implementation is complete when:

1. ✅ `cargo build` — zero errors, zero dead-code warnings for TriGpuManager
2. ✅ `cargo test` — all 779+ tests pass
3. ✅ `run_remote_session()` uses `TriGpuManager`, not `GpuBackendManager`
4. ✅ 4 persistent GPU/CPU threads: Deeksha (primary), Pearl, ProgPow, Ext-CPU
5. ✅ `draw_dashboard()` shows per-stream shares + hashrate
6. ✅ Dashboard app.py shows 3-stream revenue
7. ✅ Live on Edge: all 3 streams producing shares
8. ✅ No log spam (ensure_algorithm, per-iteration thread creation)
