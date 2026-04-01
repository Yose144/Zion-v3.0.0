# GPU OpenCL Optimization — 2026-04-01

**Commit:** `7179fe8f` (main)  
**Hardware:** AMD RX 5600 XT (gfx1010, RDNA1, 36 CU, 6 GB VRAM)  
**Before:** 5.5 KH/s → **After:** 8.83 KH/s (+60%)

---

## 1. Problem

V3 Rust miner GPU mining was working but performance on AMD RX 5600 XT was only ~5.5 KH/s — barely 2× the Apple M1 CPU rate (~3 KH/s). The memory-hard Ekam Deeksha algorithm (256 KiB scratchpad per thread) was bottlenecked by:

- **Cache thrashing**: 70% VRAM default = 17K threads × 256 KiB = 4.5 GB scratchpads overwhelmed 4 MB L2 cache
- **Register pressure**: `int cur[256]`/`int nxt[256]` NPU arrays (2 KiB private memory per thread) regardless of actual topology size
- **Suboptimal work-group size**: local_size=64 for RDNA1 (Wave32) wastes scheduling potential
- **Redundant staging buffers**: 6 separate `uint[64]` arrays in kernel hot loop

## 2. OpenCL Kernel Optimizations

**File:** `V3/L1/cosmic-harmony/src/gpu/kernels/cosmic_harmony_deeksha.cl`

### 2.1 NPU_MAX_DIM compile-time define
```c
#ifndef NPU_MAX_DIM
#define NPU_MAX_DIM 256
#endif
```
- `npu_mix_packed()` now uses `int cur[NPU_MAX_DIM]`/`int nxt[NPU_MAX_DIM]`
- For Deep topology (epoch 3): NPU_MAX_DIM=64 → 512 bytes vs 2 KiB (4× reduction)
- For Standard: NPU_MAX_DIM=128, ThreeLayer: 128, Wide: 256

### 2.2 WGS work-group size hint
```c
#ifndef WGS
#define WGS 64
#endif
__attribute__((reqd_work_group_size(WGS, 1, 1)))
```
- Compiler optimizes register allocation and barrier behavior for exact group size

### 2.3 BLAKE3 quarter-round macro
```c
#define B3_G(a,b,c,d,mx,my) do { ... } while(0)
```
- Replaces `b3_g()` function call overhead (function-call ABI on GPU is expensive)

### 2.4 Scalar b3_permute
- Replaced `uint tmp[16]` array with 16 scalar variables `uint t0…t15`
- Eliminates private memory spill to scratch memory

### 2.5 Buffer reuse
- `ekam_deeksha_mine`: 6 staged arrays → 2 reused `buf_a[64]`/`buf_b[64]`
- Saves 408 bytes private memory per thread

## 3. Rust GPU Backend Optimizations

**File:** `V3/L1/miner/src/gpu_backend.rs`

### 3.1 VRAM percentage: 50% → 25%
```rust
let pct: f64 = std::env::var("ZION_OCL_VRAM_PCT")
    .ok().and_then(|s| s.parse().ok()).unwrap_or(25.0);
```
- Fewer concurrent threads = better L2 cache residency for 256 KiB scratchpads
- Sweet spot for RX 5600 XT: ~6,128 work items using 1.5 GB of 6 GB VRAM

### 3.2 local_work_size: 64 → 256 for AMD
```rust
fn detect_local_work_size(device: &Device) -> usize {
    // All AMD GPUs default to 256
    // RDNA1+ benefits from 8 wavefronts per work-group
}
```
- `ZION_OCL_LOCAL_SIZE` env var overrides

### 3.3 Topology-aware kernel recompile
- On epoch change, if `npu_max_dim` differs, full kernel recompile:
  ```
  gpu_opencl_recompile epoch=3 npu_max_dim=128->64
  ```
- Rebuilds ALL buffers on new ProQue with correct build options
- Stores `platform`, `device`, `kernel_src` for recompilation

### 3.4 Environment variables
| Variable | Default | Description |
|----------|---------|-------------|
| `ZION_OCL_VRAM_PCT` | 25 | % of VRAM for scratchpads |
| `ZION_OCL_LOCAL_SIZE` | 256 (AMD) | Work-group size |
| `ZION_OCL_WORK_CAP` | — | Max global work items cap |

## 4. Benchmark Results

Systematic testing: 15+ combinations on RX 5600 XT (gfx1010, RDNA1):

| VRAM % | local_size | work_size | KH/s | Notes |
|--------|-----------|-----------|------|-------|
| 50% | 64 | 12,256 | **2.54** | Original default — cache thrashing |
| 40% | 256 | 9,804 | 5.68 | Still too many threads |
| 35% | 256 | 8,579 | 6.67 | |
| 30% | 256 | 7,353 | 8.11 | |
| 30% | 64 | 7,353 | 5.55 | Original observed speed |
| **25%** | **256** | **6,128** | **8.83** | **WINNER** |
| 25% | 128 | 6,128 | 6.10 | |
| 25% | 64 | 6,128 | 6.47 | |
| 25% | 32 | 6,128 | 6.59 | |
| 25% | 512 | 6,128 | ERROR | CL_INVALID_WORK_GROUP_SIZE |
| 20% | 256 | 4,902 | 7.79 | |
| 20% | 64 | 4,902 | 6.26 | |
| 15% | 64 | 3,676 | 5.08 | Too few threads |

**Confirmation run** (20s): 25% / 256 → **8.61 KH/s** (stable)

### Key insight
Memory-hard algorithms benefit from **fewer** concurrent threads with better cache residency. Counter-intuitive but confirmed: reducing VRAM from 50% to 25% (+60% speedup) because the 256 KiB scratchpads trash the 4 MB L2 cache when too many run simultaneously.

## 5. Desktop Agent — [METRICS] in LOGS Panel

**Files:** `APP&WEB/desktop-agent/src/main.js`, `APP&WEB/desktop-agent/src/ui/renderer.js`

### 5.1 [METRICS] line emitted every 10s
```
[METRICS] hr=8.62 kH/s | 10s=8.51 kH/s | 60s=8.43 kH/s | 15m=8.38 kH/s | A:5 R:0 100.0% | up=00:05:30 | h=6789 | epoch=3 | gpu=gfx1010:xnack- | gpu_hr=8.62 kH/s | backend=opencl
```

### 5.2 Renderer colorizer
- Hashrate values highlighted in green (`mc-hr`)
- Accepted/Rejected share counts in green/red (`mc-accepted`/`mc-rejected`)
- GPU device and backend with distinct colors
- Epoch and height highlighted

### 5.3 Agent log (desktop_agent.log)
- `mining-metrics` entry every 10s for diagnostics and post-mortem analysis

## 6. Live Pool Verification

- Connected to V3 pool at `91.98.122.165:3333`
- Protocol `zion-v3-stratum/0.2` handshake OK
- Epoch 3 (Deep topology) kernel recompile: NPU_MAX_DIM=128→64 — correct
- 500K nonces processed, no solution at difficulty 789 (expected at this hashrate)
- Effective live hashrate: ~6.6 KH/s (includes recompile overhead + real-world conditions)

## 7. Recommended Settings for AMD GPUs

| Generation | VRAM % | local_size | Notes |
|------------|--------|-----------|-------|
| RDNA1 (RX 5xxx) | 25% | 256 | Verified |
| RDNA2 (RX 6xxx) | 20–25% | 256 | Larger Infinity Cache helps |
| RDNA3 (RX 7xxx) | 20% | 256 | 96 MB cache → try 15% too |
| GCN (RX 580 etc) | 30% | 64 | Wave64, smaller registers |

## 8. Files Changed

| File | Change |
|------|--------|
| `V3/L1/cosmic-harmony/src/gpu/kernels/cosmic_harmony_deeksha.cl` | NPU_MAX_DIM, WGS, B3_G macro, scalar permute, buffer reuse |
| `V3/L1/miner/src/gpu_backend.rs` | VRAM 25%, local_size 256, epoch recompile, env vars |
| `APP&WEB/desktop-agent/src/main.js` | [METRICS] emitter, mining-metrics in agent log |
| `APP&WEB/desktop-agent/src/ui/renderer.js` | [METRICS] colorizer, unblock from console filter |
| `APP&WEB/desktop-agent/resources/mining/cosmic_harmony_deeksha.cl` | Synced kernel copy |
| `APP&WEB/desktop-agent/resources/gpu-tuning-config.json` | Updated tuning defaults |
| `APP&WEB/desktop-agent/resources/v3_gpu_miner.py` | New V3 GPU miner Python fallback |
| `V3/L1/pool/Cargo.toml` | Pool dependency updates |
| `V3/L1/pool/src/bin/server.rs` | Pool server updates |
| `V3/L1/pool/src/pplns.rs` | PPLNS reward calculation updates |
| `docker/docker-compose.v3-mainnet.yml` | V3 mainnet compose config |
| `scripts/deploy-v3-mainnet.sh` | V3 mainnet deploy script |
