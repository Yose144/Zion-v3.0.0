# W11 Desktop Agent + GPU Tuning Report

> **Datum:** 2026-07-27
> **Platform:** Windows 11 (GTX 1070 Ti, OpenCL backend)
> **Branch:** `main` (commits `cc022c3ff`, `d93cd232d`, `d8e8b4f3e`)

---

## 1. Desktop Agent UI Enhancements

### 1.1 GPU Hardware Panel

The Hardware card in the desktop agent dashboard now shows live GPU details
alongside the device name:

| Field | Source | Example (GTX 1070 Ti) |
|-------|--------|----------------------|
| Device | `gpu_name` from stats.json | NVIDIA GeForce GTX 1070 Ti |
| CUs | `gpu_compute_units` | 19 |
| VRAM | `gpu_vram_mib` | 8191 MiB |
| Clock | `gpu_clock_mhz` | 1683 MHz |
| Temp | `gpu_temp_c` (refreshed every 3s) | 52 °C |
| Power | `gpu_power_w` (refreshed every 3s) | 44 W |

Temperature is color-coded:
- **Green** (< 70°C): normal
- **Orange** (70-79°C): warning
- **Red** (≥ 80°C): critical

Rows are hidden when the miner doesn't report a GPU (CPU-only mode).

### 1.2 Share Log Panel

A new "Share Log" panel below the Trinity dashboard shows the last 50 share
events with timestamps, newest first:

```
14:32:15  ✓  ZION  job=42 h=6445 187ms   deeksha_lite_v1
14:32:12  ✗  ZION  job=42 reason=stale   deeksha_lite_v1
14:32:08  ✓  ZION  job=41 h=6445 203ms   deeksha_lite_v1
```

Share events are parsed from miner stdout in real-time:
- `SHARE_ACCEPTED job=N height=N nonce=N algo=... latency_ms=N`
- `SHARE_REJECTED job=N height=N nonce=N algo=... reason="..." hash=...`
- `external_share_accepted coin=VRSC status=...`
- `external_share_rejected coin=VRSC status=...`

### 1.3 Hashrate Sparkline

The Hashrate card now includes a canvas-based sparkline showing the last
120 hashrate samples (~2 minutes at 1 sample/sec). Uses a cyan gradient
fill with a 1.5px line. Shows "collecting…" until 2+ samples are available.

---

## 2. Miner Stats JSON Extensions

### 2.1 New Fields in `stats.json`

The V3 miner now writes these additional fields to the stats file:

```json
{
  "gpu_name": "NVIDIA GeForce GTX 1070 Ti",
  "gpu_compute_units": 19,
  "gpu_vram_mib": 8191,
  "gpu_clock_mhz": 1683,
  "gpu_temp_c": 52,
  "gpu_power_w": 44
}
```

### 2.2 GPU Temp/Power Refresh

GPU temperature and power are refreshed every 3 seconds (throttled to
match the stats file write interval):

- **NVIDIA:** `nvidia-smi --query-gpu=temperature.gpu,power.draw --format=csv,noheader,nounits`
- **AMD:** `rocm-smi --showtemp --showpower --json`

Power draw is parsed as `f64` (e.g. "10.21" W) and truncated to `u32`.
The `nvidia-smi` fallback is used because OpenCL doesn't expose temperature
via standard queries.

### 2.3 HTTP /stats Endpoint

The same GPU fields are exposed via the HTTP `/stats` endpoint:
`gpu_name`, `gpu_compute_units`, `gpu_vram_mib`, `gpu_clock_mhz`,
`gpu_temp_c`, `gpu_power_w`.

---

## 3. CUDA Backend Optimizations (ekam kernel)

The `cuda_deeksha` module (cosmic_harmony ekam kernel) was brought up to
the same optimization level as `cuda_deeksha_lite` and `cuda_deeksha_lite_fire`.

### 3.1 v5 — Async Host-to-Device Copies

**Before:** All 6 `htod_sync_copy_into` calls blocked the host until the
PCIe copy completed.

**After:** Replaced with `htod_copy_into` (async), which queues the copy
on the default CUDA stream and returns immediately. The kernel launch
that follows is also async, so the host never blocks until the final
`dev.synchronize()`.

Affected copies:
- Header upload (hot path, every batch)
- Sentinel reset (hot path, every batch)
- NPU weights/biases/scales/meta upload (cold path, epoch change only)

**Expected gain:** ~5-8% (based on RTX 3090 lite kernel measurements).

### 3.2 v6 — Pool I/O Pipelining (launch_batch / collect_batch)

**Before:** `CudaDeekshaMiner` used the default `launch_batch`/`collect_batch`
from the `GpuMiner` trait, which fell back to synchronous `mine_batch`.

**After:** Added true async `launch_batch` and `collect_batch`:
- `launch_batch`: queues htod copies + all kernel chunk launches on the
  default stream WITHOUT syncing, stores pending info, returns immediately.
- `collect_batch`: single `dev.synchronize()` + dtoh result read.

The main mining loop can now overlap GPU compute with pool I/O when
`ZION_GPU_PIPELINE=1` is enabled.

### 3.3 PTXAS O3 Hang Fix

**Problem:** `--ptxas-options=-O3` caused ptxas to hang indefinitely on
the ekam kernel (1187 lines, complex NPU code). The kernel had no
`__launch_bounds__` annotation, so ptxas attempted overly aggressive
register allocation.

**Fix:**
1. Added `__launch_bounds__(256)` to all three kernel entry points
   (`deeksha_mine`, `ekam_deeksha_mine`, `ekam_deeksha_debug`).
2. Switched from no ptxas optimization (implicit -O0) to `-O2`.
3. Added `-lineinfo` for profiling (now safe with `__launch_bounds__`).
4. Added `ZION_CUDA_PTXAS_OPT` env var override (default: `-O2`).
5. Added `ZION_CUDA_MAXREG` env var override for `--maxrregcount`.

**Usage:**
```bash
# Default (safe): -O2 with lineinfo
ZION_BACKEND=cuda ./zion-miner

# Aggressive (may hang on some GPUs):
ZION_CUDA_PTXAS_OPT=-O3 ./zion-miner

# Conservative:
ZION_CUDA_PTXAS_OPT=-O1 ./zion-miner

# Limit registers (helps if -O3 causes spilling):
ZION_CUDA_PTXAS_OPT=-O3 ZION_CUDA_MAXREG=128 ./zion-miner
```

---

## 4. OpenCL Backend (W11 + GTX 1070 Ti)

### 4.1 Build

```powershell
cd V3
cargo build --release -p zion-miner `
  --features "gpu-opencl,native-etchash,native-kawpow,native-autolykos,native-kheavyhash,native-blake3-algo,native-cosmic-harmony,native-verushash,native-hashers" `
  --bin zion-miner
```

### 4.2 Solo Mining Test

```powershell
$env:ZION_BACKEND = "opencl"
$env:ZION_GPU_WORK_SIZE = "8192"
$env:ZION_THREADS = "2"
$env:ZION_STATS_FILE = "$env:TEMP\zion-stats.json"
$env:ZION_METRICS_REPORT_SECS = "2"
.\target\release\zion-miner.exe
```

### 4.3 Verified Output

```
gpu_name          : NVIDIA GeForce GTX 1070 Ti
gpu_compute_units : 19
gpu_vram_mib      : 8191
gpu_clock_mhz     : 1683
gpu_temp_c        : 52
gpu_power_w       : 44
backend           : opencl
```

---

## 5. Stale Job Reject Fix (2026-07-27)

### Problem

GPU shares had **41% reject rate** (`NoSolution` reason) on GTX 1070 Ti.
Root cause: default `ZION_GPU_MAX_BATCH=262144` → each GPU batch took
~10s at 25 KH/s, but the pool rotates ZION jobs every ~5s → stale nonces.

### Fix

Reduced default batch size from 262144 → **65536** in all three code paths:
- `gpu_backend.rs::gpu_scan_job()` (local/benchmark mode)
- `main.rs` pool mode synchronous scan
- `gpu_backend.rs::GpuPipelineState::step()` (pipelined mode)

Desktop agent now sets `ZION_GPU_MAX_BATCH=65536` explicitly.
Override with `ZION_GPU_MAX_BATCH` env var or `config.gpuMaxBatch`.

### Results

| Metric | Before | After |
|--------|--------|-------|
| Batch size | 262144 | 65536 |
| Batch time | ~7.4s | ~1.9s |
| Accept rate | 59% (41% reject) | **100% (0 reject)** |
| GPU hashrate | 25 KH/s | 20-35 KH/s |
| GPU temp (ZION only) | 64°C | 60°C |

---

## 6. Thermal Management

### Observed Temperatures

| Mode | GPU Temp | GPU Power | Notes |
|------|----------|-----------|-------|
| Idle | 50°C | 11W | Fan 45% |
| ZION only (deeksha_lite) | 60°C | 44W | Single stream |
| Triple-stream (ZION+ZANO+VRSC) | **81°C** | 43W | **Red zone** |

### Recommendations for GTX 1070 Ti

The 81°C under triple-stream is caused by the ZANO ProgPoW stream which
is GPU-intensive. While the GTX 1070 Ti can handle up to 94°C, sustained
81°C reduces GPU lifespan.

**Option 1: Power limit (recommended)**
```powershell
# Reduce power limit from 144W to 120W (requires admin)
nvidia-smi -pl 120
# Restore default
nvidia-smi -pl 144
```
This reduces temp by ~8-10°C with minimal hashrate loss (~5%).

**Option 2: Disable ZANO stream**
Set `ZION_STREAM2_ENABLED=0` in miner config or disable triple-stream
in desktop agent settings. GPU only mines ZION → temp drops to ~60°C.

**Option 3: Custom fan curve**
Use MSI Afterburner or EVGA Precision XOC to set a more aggressive
fan curve (e.g., 80% fan at 70°C).

---

## 7. Files Changed

| File | Change |
|------|--------|
| `V3/L1/miner/src/main.rs` | MinerMetricsSnapshot GPU fields, stats.json, HTTP /stats, GPU refresh, batch size fix (pool mode), local mode telemetry fix, init_verushash cfg guard |
| `V3/L1/miner/src/gpu_backend.rs` | nvidia-smi/rocm-smi helpers, v5 async copies, v6 launch_batch/collect_batch, PTXAS opts, batch size fix (local + pipeline mode) |
| `V3/L1/miner/src/cosmic_harmony_deeksha.cu` | __launch_bounds__(256) on all kernels |
| `V3/L1/miner/build.rs` | V3/L1/native-libs link search path |
| `APP&WEB/desktop-agent/src/main.js` | GPU field parsing, share event parsing, IPC, ZION_GPU_MAX_BATCH env setup |
| `APP&WEB/desktop-agent/src/preload.js` | onShareEvent IPC channel |
| `APP&WEB/desktop-agent/src/ui/renderer.js` | GPU panel, share log, sparkline rendering |
| `APP&WEB/desktop-agent/src/ui/index.html` | GPU rows, share log panel, sparkline canvas, CSS |

---

## 8. Commits

| Commit | Description |
|--------|-------------|
| `cc022c3ff` | feat(miner+desktop): GPU hardware panel, share log, hashrate sparkline |
| `d93cd232d` | feat(cuda): v5 async htod copies + v6 pool I/O pipelining for ekam kernel |
| `d8e8b4f3e` | fix(cuda): resolve PTXAS O3 hang for ekam kernel |
| `ec45b37b1` | feat(desktop-agent): professional TUI mode for terminal mining dashboard |
| `366820af5` | fix(gpu): reduce default batch size to 65536 to eliminate stale job rejects |
