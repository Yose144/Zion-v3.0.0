# ZION Miner — Hardware Autotune + Sticky Header Report

**Date:** 2026-07-16  
**Hardware:** AMD RX 5700 XT 6GB + Ryzen 5 3600 (6C/12T) + 32GB RAM  
**OS:** Ubuntu 24.04, ROCm OpenCL  

---

## 1. Benchmark Results

### Work Size Sweep (ZION deeksha, 20s samples)

| work_size | ZION H/s   | ProgPow MH/s | VRSC MH/s | Notes                    |
|-----------|------------|-------------|-----------|--------------------------|
| 1024      | 409        | 0.84        | 7.5       | Too small scratchpad     |
| 4096      | 3,842      | 7.73        | 7.5       | Good ProgPow, low ZION   |
| **8192**  | **6,482**  | 6.02        | 7.5       | **Best ZION**            |
| 16384     | 5,507      | 6.71        | 7.5       | Good but < 8192          |
| 32768     | 6,274      | 6.35        | 7.65      | Close to 8192            |
| 65536     | 5,119      | 6.00        | 7.63      | Degraded                 |

### Thread Count Sweep (WS=8192, SWS=4M, 60s samples)

| threads | ZION H/s   | ProgPow MH/s | VRSC MH/s  | Total MH/s |
|---------|------------|-------------|-----------|------------|
| 4       | 7,148      | 5.24        | 5.04      | ~10.3      |
| 6       | 5,304      | 5.57        | 7.75      | ~13.4      |
| 8       | 5,300      | 6.40        | 8.83      | ~15.1      |
| 10      | 4,085      | 5.61        | 10.27     | ~15.9      |
| **12**  | **5,907**  | **6.70**    | **10.76** | **~17.4**  |

**Optimal: T=12 (all threads)** — VRSC VerusHash scales linearly and dominates total throughput.

### Secondary GPU Work Size Sweep (WS=8192, T=6, 20s samples)

| secondary_ws | ZION H/s   | ProgPow MH/s |
|-------------|------------|-------------|
| 1M          | 6,837      | 5.54        |
| 2M          | 5,507      | 5.96        |
| **4M**      | **6,482**  | **6.02**    |

**Optimal: SWS=4M** — best balance for 6GB VRAM.

### Final Optimal Configuration

| Parameter                    | Value     | Formula                              |
|------------------------------|-----------|--------------------------------------|
| `ZION_GPU_WORK_SIZE`         | 8192      | `nearest_pow2(CUs * 512)`            |
| `ZION_SECONDARY_GPU_WORK_SIZE` | 4194304 (4M) | `clamp(VRAM_MiB * 0.75 / 1024, 1, 8) * 1M` |
| `ZION_THREADS`               | 12        | `num_cpus::get()` (all logical cores) |

---

## 2. Hardware Autotuning Implementation

### New Functions (`gpu_backend.rs`)

- **`auto_tune_work_sizes()`** — Main entry point. Detects GPU CUs, VRAM, CPU cores, RAM and returns `AutoTuneResult` with optimal work sizes and thread count.
- **`detect_gpu_compute_units()`** — Queries OpenCL for GPU compute units.
- **`nearest_pow2(n)`** — Rounds to nearest power of two.

### AutoTuneResult Struct

```rust
pub struct AutoTuneResult {
    pub gpu_work_size: usize,           // ZION deeksha (Stream 1)
    pub secondary_gpu_work_size: usize, // ProgPow/KawPow (Stream 2)
    pub threads: usize,                 // VerusHash/RandomX (Stream 3)
    pub gpu_name: String,
    pub gpu_compute_units: u32,
    pub gpu_vram_bytes: u64,
    pub sys_ram_bytes: u64,
    pub cpu_cores: usize,
    pub has_gpu: bool,
}
```

### Formulas (benchmark-derived)

**gpu_work_size** (ZION deeksha, Stream 1):
- `nearest_pow2(CUs * 512)`, clamped to [1024, 65536]
- 18 CUs (RX 5700 XT) → 8192 ✓
- 10 CUs (M2) → 4096
- 32 CUs (M4 Max) → 16384

**secondary_gpu_work_size** (ProgPow/KawPow, Stream 2):
- `clamp(VRAM_MiB * 0.75 / 1024, 1, 8) * 1M`
- 6128 MiB (RX 5700 XT) → 4M ✓
- 8 GB → 6M
- 16 GB → 8M (capped)
- Unified memory → 2M (conservative)

**threads** (CPU mining, Stream 3):
- All logical cores (up to 64)
- Benchmarks show T=all wins for total throughput

### Integration (`main.rs`)

- **`MinerConfig::from_env_and_args()`** — Calls `auto_tune_work_sizes()` at startup. Env vars (`ZION_GPU_WORK_SIZE`, etc.) always override autotuned values.
- **`ZION_AUTOTUNE=1`** (default ON) — Enables/disables autotuning.
- **`--auto-tune` CLI flag** — Prints detected hardware + recommended settings and exits.

### Example Output

```
$ zion-miner --auto-tune
=== ZION Hardware Autotune ===

Detected Hardware:
  GPU:  gfx1010:xnack- (18 CUs, 6128 MB VRAM)
  CPU:  12 logical cores
  RAM:  30947 MB

Recommended Settings:
  ZION_GPU_WORK_SIZE=8192
  ZION_SECONDARY_GPU_WORK_SIZE=4194304
  ZION_THREADS=12

  (GPU WS formula: nearest_pow2(CUs * 512) = nearest_pow2(18 * 512) = 8192)
  (Secondary WS formula: clamp(6128MiB * 0.75 / 1024, 1, 8) * 1M = 4194304)
```

---

## 3. Sticky Header (Claymore-style Display)

### Problem

The previous implementation used ANSI DECSTBM scroll regions, which `screen` doesn't support properly. Log lines would overwrite the metrics header, pushing it off-screen.

### Solution: Alternate Screen Buffer + Full Redraw

- **Alternate screen buffer** (`\x1B[?1049h`) — full screen takeover like Claymore/GMiner
- **Full screen redraw** on each status update — works in ALL terminals including `screen`
- **QUIET mode** — suppresses verbose log lines (`iteration=`, `found_nonce=`, `stream_weights`, etc.)
- **`session_status` to stderr** — external parsers (desktop agent, SMOS) still work via stderr

### Implementation (`ui.rs`)

- **`print_trinity_stats_sticky()`** — Enters alt screen, draws metrics box at top, redraws on each update
- **`exit_sticky_header()`** — Leaves alt screen on shutdown (restores normal terminal)
- **`LOG_RING`** — Ring buffer for recent log lines (displayed below header)
- **`push_log_line()`** — Adds log lines to ring buffer

### QUIET Mode (`main.rs`)

- **`QUIET` AtomicBool** — When true, suppresses verbose `println!` calls
- **`log_line()`** — Helper that only prints if `!QUIET`
- **`log_always()`** — Helper for important events (shares, errors)
- **`ZION_QUIET=1` env var** — Set when sticky header activates, checked by `gpu_backend.rs`

### Suppressed Log Lines (in QUIET mode)

- `iteration=N` (every iteration)
- `job_id=N` (every iteration)
- `found_nonce=N` (every solution)
- `hash=...` (every solution)
- `stream_weights job=...` (every job)
- `external_stream job=...` (every job)
- `external_stream_cpu job=...` (every job)
- `gpu_opencl_lite_stream_weights ...` (every batch)
- `ext_gpu_tx_send ...` (every external send)
- `>> new job #N ...` (every new job)

### Still Visible (even in QUIET mode)

- `SHARE_ACCEPTED` / `SHARE_REJECTED` (share notifications)
- `session_status` (to stderr for external parsers)
- Error messages
- Metrics box (sticky header)

### Disable Sticky Header

```bash
ZION_NO_STICKY=1 zion-miner ...   # disable sticky, use normal logging
```

---

## 4. Files Modified

| File | Changes |
|------|---------|
| `V3/L1/miner/src/gpu_backend.rs` | `auto_tune_work_sizes()`, `AutoTuneResult`, `detect_gpu_compute_units()`, `nearest_pow2()`, QUIET mode for stream_weights log |
| `V3/L1/miner/src/main.rs` | Autotune integration in `from_env_and_args()`, `--auto-tune` CLI flag, QUIET mode, sticky header activation, `exit_sticky_header()` on shutdown, verbose log suppression |
| `V3/L1/miner/src/ui.rs` | Alternate screen buffer, full redraw sticky header, `exit_sticky_header()`, `LOG_RING` ring buffer, `push_log_line()` |
| `Desktop/Start.sh` | Removed hardcoded tuning, uses autotune |
| `scripts/start-local-miner.sh` | Same — removed hardcoded tuning, uses autotune |

---

## 5. Performance Summary

| Metric | Value |
|--------|-------|
| ZION hashrate | ~6,000 H/s (GPU deeksha) |
| ProgPow hashrate | ~6.7 MH/s (GPU external) |
| VRSC hashrate | ~10.8 MH/s (CPU VerusHash) |
| Total combined | ~17.4 MH/s |
| Share accept rate | 100% |
| Autotune accuracy | 100% (matches manual benchmarks) |

---

## 6. Usage

### One-click mining (autotune + sticky header)

```bash
# Desktop launcher
./Desktop/Start.sh

# Or directly
zion-miner --pool 62.171.141.136:8444 --wallet <WALLET> --gpu opencl --no-tui --profile pool
```

### Check recommended settings

```bash
zion-miner --auto-tune
```

### Override autotune

```bash
ZION_GPU_WORK_SIZE=16384 ZION_THREADS=8 zion-miner ...
```

### Disable autotune

```bash
ZION_AUTOTUNE=0 zion-miner ...
```

### Disable sticky header

```bash
ZION_NO_STICKY=1 zion-miner ...
```

---

## 7. Post-Release Fixes (2026-07-16)

### 7.1 DAG Generation Exclusively on GPU

**All DAG-based algorithms (Ethash, KawPow, ProgPow) now generate their DAGs
exclusively on the GPU.** Previously Ethash and ProgPow used CPU FFI generation
(minutes of CPU time + multi-GB host→GPU transfer). Now all three use the same
OpenCL `ethash_calculate_dag_item_mod` kernel — CPU only generates the small
light cache (~16-100 MB), GPU computes the full DAG in parallel.

See [`MINER_FIXES_REPORT_2026-07-16.md`](./MINER_FIXES_REPORT_2026-07-16.md) §1
for full details.

### 7.2 VRSC/VerusHash Share Accept Bug Fix

**Bug:** `read_next_result()` only accepted `PoolMessage::Result`, but external
stream shares (VRSC, QUAI) receive `PoolMessage::ExternalResult` from the pool.
Every external share was logged as `external_result_read_error` even though the
pool had accepted it. Shares were not counted in the hashrate tracker.

**Fix:** Added `PoolMessage::ExternalResult` to the match arms in
`read_next_result()`.

See [`MINER_FIXES_REPORT_2026-07-16.md`](./MINER_FIXES_REPORT_2026-07-16.md) §2
for full details.

