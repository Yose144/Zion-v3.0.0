# 🔬 GPU Mining Research Report — ZION v2.9.5

**Date**: 7. února 2026  
**Author**: AI Native Team  
**Scope**: Complete audit of GPU mining support across all ZION components  

---

## 📋 Executive Summary

ZION v2.9.5 has **comprehensive GPU mining support** across 3 GPU backends (Metal, CUDA, OpenCL) and 3 algorithms (Cosmic Harmony v3, Autolykos2/ERG, Ethash/ETC). The Rust Universal Miner has the most mature implementation. **CPU mining is stream-aware (StreamScheduler v2), but GPU mining is NOT stream-aware yet** — this is the primary gap to address.

| Component | Metal | CUDA | OpenCL | Stream-Aware |
|-----------|-------|------|--------|-------------|
| Universal Miner (Rust) | ✅ Complete | ✅ Complete | ✅ Complete | ❌ NOT YET |
| CH v3 Crate | ✅ Production | ❌ N/A | ✅ Production | ❌ NOT YET |
| Autolykos2 Metal | ✅ Complete (TABLELESS) | ❌ N/A | ❌ N/A | ❌ NOT YET |
| Ethash Metal | ✅ Complete | ❌ N/A | ❌ N/A | ❌ NOT YET |
| Python Miner | ✅ Via FFI/Ctypes | ❌ N/A | ✅ PyOpenCL | ❌ NOT YET |

---

## 1. Rust Universal Miner — GPU Module

**Location**: `2.9.5/zion-universal-miner/src/miner/gpu/`

### 1.1 Module Root (`mod.rs`) — ✅ COMPLETE

**Status**: Fully functional orchestration layer.

**Key structures**:
- `GpuPlatform` enum — `Cuda`, `OpenCL`, `Metal`
- `GpuDevice` struct — `id`, `name`, `platform`, `compute_units`, `memory_mb`
- `GpuMiner` trait — Interface with `init()`, `mine_batch()`, `device_info()`, `hashrate()`

**Key functions**:
- `detect_gpus()` — Auto-detects GPUs in priority order: Metal → CUDA → OpenCL (deduplicating NVIDIA between CUDA/OpenCL)
- `create_miner(device)` → `Box<dyn GpuMiner>` — Factory creating platform-specific miner (Metal batch_size=500K)

**Algorithms on GPU**: Only **Cosmic Harmony v3** (all 3 backends mine CHv3).

**What's missing for StreamScheduler v2**: 
- No `StreamState` integration — GPU always mines CHv3
- No dynamic algorithm switching capability
- Need `process_job()` / `take_pending_switch()` hooks

---

### 1.2 Metal Backend (`metal.rs`) — ✅ COMPLETE

**Status**: Production-ready, delegates to `zion-cosmic-harmony-v3::gpu::metal_miner::MetalMiner`.

**Key struct**: `MetalGpuMiner` wraps `zion_cosmic_harmony_v3::gpu::metal_miner::MetalMiner`.

**Algorithm**: Cosmic Harmony v3 only (full pipeline: Keccak→SHA3→GoldenMatrix→CosmicFusion).

**Conditional compilation**: `#[cfg(all(feature = "metal", target_os = "macos"))]`

**Methods**:
- `new(batch_size)` — Creates `MetalMiner` from CH v3 crate, reads device info
- `mine_batch(header, target, nonce_start, batch_size)` — Processes in configured chunks, calls `inner.mine()`
- `benchmark(duration_secs)` — Returns hashrate in H/s
- `detect_metal_devices()` — Creates temporary `MetalMiner` to detect Apple GPU

**Performance**: 2-3+ MH/s on M1 (8 GPU cores), documented up to 21+ MH/s.

**What's missing for StreamScheduler v2**:
- Cannot switch algorithms (hardcoded CHv3)
- Would need to also hold `AutolykosMetalMiner` and `EthashMetalMiner` references
- Need a `mine_batch_algo(algo, ...)` method that dispatches to correct inner miner

---

### 1.3 CUDA Backend (`cuda.rs`) — ✅ COMPLETE

**Status**: Fully implemented with `cudarc` crate. Feature-gated: `#[cfg(feature = "cuda")]`.

**Key struct**: `CudaMiner` with CUDA device, header/results/result_count buffers.

**Algorithm**: Cosmic Harmony v3 (loads kernel from `kernels/cosmic_harmony_v3.cu`).

**Methods**:
- `new(device_id)` — Detects CUDA device
- `init()` — Compiles PTX from CUDA source, allocates buffers (80B header, 2×u64 results, 1×u32 count)
- `mine_batch(header, target, nonce_start, batch_size)` — Launches kernel with 256 threads/block, up to 65535 blocks
- `detect_cuda_devices()` — Enumerates NVIDIA GPUs

**Kernel launch**: `cosmic_harmony_v3_mine(header, header_len, start_nonce, target_difficulty, results, result_count)`

**What's missing for StreamScheduler v2**:
- Only has CHv3 kernel compiled — no Ethash/Autolykos CUDA kernels
- Would need additional `.cu` kernels per algorithm
- Target comparison uses simplified u64 from `target[24..32]` (differs from Metal's state0 u32 comparison)

---

### 1.4 OpenCL Backend (`opencl.rs`) — ✅ COMPLETE

**Status**: Fully implemented with `ocl` crate. Feature-gated: `#[cfg(feature = "gpu")]`.

**Key struct**: `OpenCLMiner` with ProQue, header/results/result_count buffers.

**Algorithm**: Cosmic Harmony v3 (loads kernel from `kernels/cosmic_harmony_v3.cl`).

**Methods**:
- `new(device_id)` — Lists OpenCL devices, selects by ID
- `init()` — Builds kernel program, allocates buffers (144B header, 2×u64 results, 1×u32 count)
- `mine_batch(...)` — Enqueues kernel with global work size = batch_size, local = 256
- `detect_opencl_devices()` — Enumerates GPU-type OpenCL devices with compute units and memory

**What's missing for StreamScheduler v2**: Same as CUDA — only CHv3 kernel.

---

### 1.5 GPU Benchmark Module (`benchmark.rs`) — ✅ COMPLETE

**Status**: Fully functional auto-tuning and benchmarking.

**Key structures**:
- `BenchmarkResult` — Per-batch-size hashrate/timing
- `DeviceBenchmark` — Complete device results with optimal batch size and peak hashrate
- `AutoTuneConfig` — min/max batch, iterations, warmup

**Key functions**:
- `calculate_optimal_batch_size(device)` — Memory-based estimate × platform factor (Metal 1.5×, CUDA 1.2×, OpenCL 1.0×)
- `run_benchmark(miner, config)` — Tests logarithmic range of batch sizes with warmup
- `auto_tune(miner)` — Quick benchmark around estimated optimal
- `print_benchmark_results()` — Formatted table output

---

### 1.6 GPU Kernels (`gpu/kernels/`)

#### `cosmic_harmony.cl` (v1 — Legacy) — ⚠️ SIMPLIFIED/LEGACY
- Blake3-based simplified hash (NOT the real CHv3 pipeline)
- Old kernel name: `mine_cosmic_harmony` (vs v3's `cosmic_harmony_v3_mine`)
- Only 7 Blake3 mixing rounds — **NOT production-grade**

#### `cosmic_harmony_v3.cu` (CUDA) — ✅ COMPLETE
- Full CHv3 pipeline: Keccak256 → SHA3-512 → GoldenMatrix → CosmicFusion
- 24-round Keccak-f[1600], proper SHA3 padding (0x06), PHI_POWERS constants
- Target check: `final_state[3] <= target_difficulty` (u64 comparison on high word)
- Kernel: `cosmic_harmony_v3_mine(header, header_len, start_nonce, target_difficulty, results, result_count)`

#### `cosmic_harmony_v3.cl` (OpenCL) — ✅ COMPLETE
- Mirror of CUDA kernel in OpenCL C
- Same pipeline, same constants, same target check logic
- Uses `atomic_xchg` instead of CUDA's `atomicExch`

**⚠️ IMPORTANT NOTE**: CUDA/OpenCL kernels use a DIFFERENT target check than Metal shader:
- **CUDA/OpenCL**: `stage2[3] ^ stage2[7] <= target_difficulty` (u64 high word)
- **Metal shader**: `state0 (u32 LE from hash[0..4]) <= target_u32 (BE from target[28..32])`

This discrepancy could cause hash validity issues across backends.

---

## 2. How GPU Mining is Started (`main.rs`)

### 2.1 CLI Arguments

```
--gpu                   Enable GPU mining
--gpu-devices "0,1"     GPU device IDs  
--mode gpu|dual         Alternative GPU enable flag
--benchmark             Run GPU benchmark only
--auto-tune             Auto-tune GPU batch size
```

### 2.2 Initialization Flow

1. `main()` parses CLI, detects GPUs via `miner::detect_gpus()` if `--gpu` or `--mode gpu/dual`
2. Logs found devices with platform, CUs, memory
3. GPU info stored in `MinerConfig { gpu_enabled, gpu_devices }`
4. If `--benchmark`/`--auto-tune`: calls `run_benchmark_mode()` → `detect_gpus()` → `create_miner()` → `miner.init()` → `run_benchmark()`/`auto_tune()`
5. For mining: `UniversalMiner::new_with_ncl(config, ncl_client)` is created and `start()` called

### 2.3 ⚠️ GPU MINING NOT USED IN MAIN LOOP

**Critical finding**: The `UniversalMiner::start()` method (in `mod.rs`) only spawns `CpuMiner`. **The GPU miner is NOT started in the mining loop!** GPU is only used for:
- Benchmark/auto-tune mode
- Python fallback (`--python-fallback chv3`)

The `CpuMiner` has full StreamScheduler v2 integration (`stream_aware.rs`), but there is **no `GpuMiningLoop`** that would:
1. Receive jobs from stratum
2. Call `GpuMiner::mine_batch()`
3. Submit shares from GPU results
4. Handle algorithm switching

---

## 3. CPU Stream-Aware Integration (Reference)

**Location**: `2.9.5/zion-universal-miner/src/miner/cpu.rs` + `stream_aware.rs`

### 3.1 `StreamState` (`stream_aware.rs`) — ✅ COMPLETE

Key structures:
- `StreamGroup` enum: `Zion`, `Revenue`, `Unknown`
- `StreamState` struct with:
  - `current_algo: RwLock<Algorithm>` — dynamically changes
  - `current_group: RwLock<StreamGroup>` — ZION or Revenue
  - `algo_switch_pending: AtomicBool` — signals threads to reload
  - `switch_count: RwLock<u64>` — switch counter

Key methods:
- `process_job(job)` → bool — Detects algo change from job's `algo` field and `job_id` prefix (`ext-erg-xxx`)
- `take_pending_switch()` → `Option<Algorithm>` — Threads poll this
- `detect_algo_from_job_id()` — Maps `ext-erg-*` → Autolykos, `ext-etc-*` → Ethash, etc.

Helper:
- `compute_stream_hash(algo, header, nonce, height)` — Dispatches to correct algorithm
- `meets_stream_target(algo, hash, target_hex, ...)` — Algorithm-specific target comparison

### 3.2 CPU Mining Loop Integration (`cpu.rs`)

In `mining_loop()`:
```rust
// ═══ Stream Scheduler v2: Dynamic algorithm detection ═══
let job_algo = job.algo.as_deref()
    .and_then(Algorithm::from_str)
    .unwrap_or(algorithm);

if job_algo != active_algorithm {
    log::info!("🔄 Stream switch: {} → {}", active_algorithm.name(), job_algo.name());
    active_algorithm = job_algo;
    batch_size = Self::batch_size_for_algo(active_algorithm);
    // Re-init RandomX if needed
}
```

The CPU loop checks `job.algo` on every new job and switches algorithms dynamically.

---

## 4. CH v3 Crate GPU Support

**Location**: `2.9.5/zion-cosmic-harmony-v3/src/gpu/`

### 4.1 Module Structure (`mod.rs`)

Exports 3 Metal miners + OpenCL:
- `metal_miner::MetalMiner` — CHv3 on Metal
- `ethash_metal_miner::EthashMetalMiner` — ETC on Metal  
- `autolykos2_metal_miner::AutolykosMetalMiner` — ERG on Metal (TABLELESS)
- `gpu_miner::GpuMiner` — CHv3 on OpenCL
- `metal_ffi` — C FFI for Python/Swift integration

### 4.2 MetalMiner (`metal_miner.rs`) — ✅ PRODUCTION

**Algorithm**: Cosmic Harmony v3  
**Status**: Production, verified struct layout with runtime offset checks.

Key structs (packed, `#[repr(C)]`):
- `CHv3MiningParams` (124→128 bytes): `start_nonce: u64`, `header_len: u32`, `header: [u8;80]`, `target: [u8;32]`
- `CHv3MiningResult` (44→48 bytes): `found_nonce: u64`, `found_hash: [u8;32]`, `found: u32`

**Runtime validation**: Checks `header` offset == 12 and `target` offset == 92 to match Metal shader.

Methods:
- `mine(header, target, start_nonce)` → `Option<(u64, [u8;32])>` — Dispatches Metal compute kernel
- `batch_hash(header, start_nonce, count)` → `Vec<[u8;32]>` — Benchmark kernel (no target check)
- `benchmark(duration_secs)` → hashrate in H/s

### 4.3 Metal Shader (`metal_shader.metal`) — ✅ PRODUCTION (462 lines)

**Full CHv3 pipeline on GPU**:
1. `keccak256_gpu()` — Rate=136, Keccak padding (0x01)
2. `sha3_512_gpu()` — Rate=72, SHA3 padding (0x06)
3. `golden_matrix_gpu()` — 8×8 matrix with PHI_POWERS fixed-point multiplication, 128-bit safe
4. `cosmic_fusion_gpu()` — 4 rounds: Keccak-256 + COSMIC_XOR_MASK + final SHA3-512

**Mining kernel** (`cosmic_harmony_v3_mine`):
- Target check: `state0 (u32 LE from hash[0..4]) <= target_u32 (u32 BE from target[28..32])`
- Atomic result write via `atomic_compare_exchange_weak_explicit`

**Benchmark kernel** (`cosmic_harmony_v3_benchmark`):
- Same hash computation, writes output hashes to buffer

### 4.4 EthashMetalMiner (`ethash_metal_miner.rs`) — ✅ COMPLETE (742 lines)

**Algorithm**: Ethash (ETC mining)

Key features:
- DAG buffer (~2.4 GB for current ETC epoch)
- Epoch calculation from block height (30,000 blocks/epoch) or seed hash
- DAG generation on CPU → upload to Metal buffer
- Returns `(nonce, mix_digest, result_hash)` — pool needs `mix_digest`

Structs:
- `EthashMiningParams`: `start_nonce`, `dag_num_items`, `header_hash[32]`, `target[32]`
- `EthashMiningResult`: `found_nonce`, `mix_digest[32]`, `result_hash[32]`, `found`
- `EthashEpoch`: `number`, `seed_hash`, `dataset_size`, `cache_size`
- `EthashDagGenerator` — CPU-side DAG generation

### 4.5 Ethash Metal Shader (`ethash_shader.metal`) — ✅ COMPLETE (485 lines)

- Full Ethash pipeline: Keccak-512 seed → FNV-1 DAG lookup (64 accesses) → FNV-compress → Keccak-256 result
- Uses **Keccak padding (0x01)**, NOT SHA3 (0x06) — correct for Ethash
- FNV_PRIME = 0x01000193

### 4.6 AutolykosMetalMiner (`autolykos2_metal_miner.rs`) — ✅ COMPLETE (614 lines)

**Algorithm**: Autolykos v2 (ERG mining) — **TABLELESS mode**

**Innovation**: Instead of pre-computing 63+ GB R-table, computes R values on-the-fly via Blake2b256:
- Only 8 KB M constant buffer (vs 63 GB table)
- Works on ANY GPU regardless of memory
- Trade: 36 Blake2b256 hashes per nonce (~2,180 compressions) vs table O(1)

Key features:
- `AutolykosTableInfo::from_height(height)` — Calculates N with 5% growth every 51,200 blocks
- `prepare_for_height(height)` — Just sets N (no table generation!)
- `autolykos2_hash_cpu()` — CPU reference implementation for share verification
- `mine(header_hash, target, height, start_nonce)` — Metal GPU mining

Structs:
- `AutolykosMiningParams`: `start_nonce`, `height`, `n`, `header_hash[32]`, `target[32]`
- `AutolykosMiningResult`: `found_nonce`, `result_hash[32]`, `found`

### 4.7 Autolykos2 Metal Shader (`autolykos2_shader.metal`) — ✅ COMPLETE (582 lines)

**Optimization**: v4 — Fully unrolled Blake2b (12 rounds inline, no sigma lookup)
- Based on CUDA reference: `mhssamadani/Autolykos2_NV_Miner`
- `B2B_G()` macro for maximum inlining
- `blake2b_compress()` — All 12 rounds explicitly written out
- `compute_r_element()` — On-the-fly R computation from M buffer
- `gen_indexes()` — Index generation with Blake2b256 seed
- BigInt accumulation in-place (32 bytes, big-endian)

Kernels:
- `autolykos2_mine` — Full mining with target check
- `autolykos2_benchmark` — Same computation, no target check

### 4.8 Metal FFI (`metal_ffi.rs`) — ✅ COMPLETE (255 lines)

C-compatible interface for Python/Swift:
- `metal_miner_create(batch_size)` → `*mut MetalMinerHandle`
- `metal_miner_destroy(miner)`
- `metal_miner_mine(miner, header, header_len, target, start_nonce, out_nonce, out_hash)` → bool
- `metal_miner_benchmark(miner, duration_secs)` → f64
- `metal_miner_get_device_name(miner)` → `*const c_char`
- `metal_miner_batch_hash(miner, header, ..., out_hashes)` → bool

Platform stubs for non-macOS return null/0.

### 4.9 OpenCL GpuMiner (`gpu_miner.rs`) — ✅ COMPLETE (361 lines)

Uses `opencl3` crate (different from universal miner's `ocl` crate):
- Full kernel build from `opencl_kernel.rs` source
- `mine(block_header, start_nonce, target)` → `Option<(u64, [u8;32])>`
- Two kernels: `cosmic_harmony_v3_mine` + `cosmic_harmony_v3_batch`
- Proper buffer management with read/write patterns

### 4.10 OpenCL Kernel (`opencl_kernel.rs`) — ✅ COMPLETE (441 lines)

Full CHv3 pipeline in OpenCL C (embedded as `const &str`):
- `keccak256()`, `sha3_512()`, `golden_matrix()`, `cosmic_fusion()`
- Main kernel: `cosmic_harmony_v3_mine`
- Batch kernel: `cosmic_harmony_v3_batch` (compute multiple hashes)
- Uses `COSMIC_XOR_MASK` matching Metal shader

---

## 5. Python Miner GPU Support

**Location**: `desktop-agent/resources/zion_native_miner_v2_9.py` (root copy is similar)

### 5.1 GPU Import Chain

```python
# Priority: GPU (~15 kH/s) > Native C (~350 H/s) > Numba JIT (~50 H/s) > Python (~0.1 H/s)

# 1. PyOpenCL for generic GPU
import pyopencl as cl       # → GPU_AVAILABLE = True/False

# 2. Cosmic Harmony v2 Unified (can be GPU or CPU)
from cosmic_harmony_v2_unified import CosmicHarmonyV2Unified
# → COSMIC_V2_GPU = _cosmic_v2_unified_hasher.is_gpu

# 3. Autolykos v2 GPU engine
from mining.gpu_autolykos_v2_engine import GPUAutolykosMiner, GPUBackend
# → ZION_GPU_ENGINE = True/False

# 4. Cosmic Harmony v1 TURBO GPU (8.48 GH/s)
from mining.cosmic_harmony_v1_turbo import CosmicHarmonyV1Turbo, GPU_AVAILABLE as CV1_GPU

# 5. Cosmic Harmony v3 Native Rust FFI + GPU (21+ MH/s)  
from cosmic_harmony_v3_gpu import CosmicHarmonyV3GPU, GPU_AVAILABLE as CV3_GPU
# → COSMIC_V3_GPU_AVAILABLE, _cosmic_v3_gpu = CosmicHarmonyV3GPU(batch_size=500_000)
```

### 5.2 GPUMiner Class (PyOpenCL)

```python
class GPUMiner:
    """GPU Mining using OpenCL - Optimized"""
    # Initializes PyOpenCL context, builds kernel, manages buffers
    # mine_batch() → executes OpenCL kernel, profiles timing
```

### 5.3 Mining Mode Selection

Config:
```python
@dataclass
class MinerConfig:
    gpu_batch_size: int = 500000
    gpu_work_size: int = 256
    gpu_id: int = 0
    use_gpu_autolykos: bool = True

class MiningMode(Enum):
    GPU = "gpu"
    # ... AUTO, CPU
```

Initialization: If `mode == GPU or AUTO` and `GPU_AVAILABLE`, creates `GPUMiner(work_size=config.gpu_work_size)`.

### 5.4 Python GPU Status
- **Cosmic Harmony v1**: GPU via PyOpenCL (8+ GH/s TURBO mode)
- **Cosmic Harmony v3**: GPU via Rust FFI (ctypes → `metal_miner_mine()`) — 21+ MH/s
- **Autolykos v2**: GPU via `GPUAutolykosMiner` engine
- **Not stream-aware**: No StreamScheduler v2 integration

---

## 6. Autolykos GPU Miner (Python Legacy)

**Location**: `scripts/legacy/zion_gpu_autolykos_miner.py`

**Status**: Legacy Python script, imports from `mining/` modules.

Features:
- `GPUAutolykosMiner` — Multi-GPU OpenCL + CUDA
- `NativeAutolykosMiner` — Native C/C++ acceleration
- Pool mining support, auto-detection, real-time monitoring

This is superseded by the Rust Autolykos2 Metal miner in `zion-cosmic-harmony-v3`.

---

## 7. StreamScheduler v2 — GPU Gap Analysis

### 7.1 What CPU Already Does (Reference)

In `cpu.rs` `mining_loop()`:
1. On new job: reads `job.algo` field
2. If algo changed → `active_algorithm = job_algo`
3. Adjusts `batch_size = batch_size_for_algo(algo)`
4. Dispatches via `native_algos::compute_hash(native_algo, ...)`
5. Uses `meets_target(active_algorithm, hash, target_hex, ...)` with algo-specific logic

### 7.2 What GPU Needs for Stream-Awareness

#### A. New `GpuMiningLoop` (similar to `CpuMiner::mining_loop()`)

```rust
// Pseudocode — new file: src/miner/gpu_loop.rs
pub struct GpuMiningLoop {
    gpu_miners: GpuMinerSet,  // Holds all available GPU miners per algorithm
    stream_state: Arc<StreamState>,
    stats: Arc<AsyncRwLock<MinerStats>>,
    job_state: Arc<RwLock<Option<Job>>>,
    stratum: Arc<StratumClient>,
}

struct GpuMinerSet {
    chv3_metal: Option<MetalGpuMiner>,
    chv3_opencl: Option<OpenCLMiner>,
    chv3_cuda: Option<CudaMiner>,
    autolykos_metal: Option<AutolykosMetalMiner>,  // from CH v3 crate
    ethash_metal: Option<EthashMetalMiner>,         // from CH v3 crate
    // Future: autolykos_cuda, ethash_cuda, etc.
}
```

#### B. Algorithm-Specific GPU Dispatch

```rust
fn gpu_mine_batch(&mut self, algo: Algorithm, job: &Job, nonce_start: u64) -> Result<Option<Share>> {
    match algo {
        Algorithm::CosmicHarmony => {
            // Use MetalGpuMiner / CudaMiner / OpenCLMiner
            self.gpu_miners.chv3_metal.mine_batch(header, target, nonce_start, batch_size)
        }
        Algorithm::Autolykos => {
            // Use AutolykosMetalMiner
            let autolykos = self.gpu_miners.autolykos_metal.as_mut()?;
            autolykos.prepare_for_height(job.height);
            autolykos.mine(header_hash, target, height, nonce_start)
        }
        Algorithm::Ethash => {
            // Use EthashMetalMiner
            let ethash = self.gpu_miners.ethash_metal.as_mut()?;
            ethash.mine(header_hash, seed_hash, nonce_start, target, dag_num_items)
        }
        _ => {
            // Fallback to CPU for unsupported GPU algos
            log::warn!("Algorithm {:?} not supported on GPU, using CPU", algo);
            Err(anyhow!("Unsupported GPU algo"))
        }
    }
}
```

#### C. Stream Switch Detection in GPU Loop

```rust
// In GPU mining loop:
if last_job_id != job.job_id {
    let job_algo = job.algo.as_deref()
        .and_then(Algorithm::from_str)
        .unwrap_or(default_algo);
    
    if job_algo != active_algorithm {
        log::info!("🔄 GPU Stream switch: {} → {}", active_algorithm.name(), job_algo.name());
        active_algorithm = job_algo;
        gpu_batch_size = gpu_batch_size_for_algo(active_algorithm);
        
        // Algorithm-specific init (e.g., Ethash DAG, Autolykos height)
        match active_algorithm {
            Algorithm::Autolykos => {
                if let Some(ref mut a) = self.gpu_miners.autolykos_metal {
                    a.prepare_for_height(job.height as u64)?;
                }
            }
            Algorithm::Ethash => {
                // Check epoch change, regenerate DAG if needed
            }
            _ => {}
        }
    }
}
```

#### D. Target Comparison Harmonization

**CRITICAL**: Target check differs between backends:
| Backend | Method | Field |
|---------|--------|-------|
| Metal CHv3 | `state0 (u32 LE) <= target_u32 (u32 BE from [28..32])` | First 4 bytes |
| CUDA/OpenCL CHv3 | `stage2[3]^stage2[7] (u64) <= target_difficulty` | High 8 bytes |
| CPU (Rust) | `state0 (u32 LE) <= target_u32` | First 4 bytes |

**Recommendation**: CUDA/OpenCL kernels should be updated to match Metal/CPU logic for consistency.

#### E. Changes to `main.rs`

```rust
// After CpuMiner::start(), also start GPU loop:
if config.gpu_enabled {
    let gpu_loop = GpuMiningLoop::new(
        stream_state.clone(),
        stats.clone(),
        job_state.clone(),
        stratum.clone(),
    );
    tokio::task::spawn_blocking(move || {
        gpu_loop.run();  // Blocking GPU mining loop with stream awareness
    });
}
```

### 7.3 Estimated Work Items

| Task | Effort | Priority |
|------|--------|----------|
| Create `GpuMiningLoop` struct | 4-6h | 🔴 HIGH |
| Wire GPU loop in `UniversalMiner::start()` | 2h | 🔴 HIGH |
| Add Autolykos/Ethash dispatch in GPU loop | 3-4h | 🟡 MEDIUM |
| Harmonize target check across backends | 2-3h | 🟡 MEDIUM |
| Add GPU batch size per algorithm | 1h | 🟢 LOW |
| CUDA kernels for Ethash/Autolykos | 8-12h | 🔵 FUTURE |
| OpenCL kernels for Ethash/Autolykos | 8-12h | 🔵 FUTURE |
| GPU hashrate in stats reporting | 1-2h | 🟢 LOW |

---

## 8. Summary of All GPU Algorithms

| Algorithm | Metal Shader | CUDA Kernel | OpenCL Kernel | Rust Miner | Status |
|-----------|-------------|-------------|---------------|------------|--------|
| Cosmic Harmony v3 | `metal_shader.metal` (462 lines) | `cosmic_harmony_v3.cu` (269 lines) | `cosmic_harmony_v3.cl` (242 lines) + `opencl_kernel.rs` (441 lines) | `MetalMiner` / `CudaMiner` / `OpenCLMiner` | ✅ All 3 backends |
| Autolykos v2 (ERG) | `autolykos2_shader.metal` (582 lines, v4 unrolled) | ❌ Not implemented | ❌ Not implemented | `AutolykosMetalMiner` (614 lines, TABLELESS) | ✅ Metal only |
| Ethash (ETC) | `ethash_shader.metal` (485 lines) | ❌ Not implemented | ❌ Not implemented | `EthashMetalMiner` (742 lines) | ✅ Metal only |
| Cosmic Harmony v1 | ❌ | ❌ | ✅ (Python PyOpenCL) | `CosmicHarmonyV1Turbo` (Python) | ⚠️ Legacy |
| Blake3 (legacy) | ❌ | ❌ | `cosmic_harmony.cl` (simplified) | ❌ | ⚠️ Not CHv3 |

---

## 9. Key Files Reference

| File | Lines | Role |
|------|-------|------|
| `zion-universal-miner/src/miner/gpu/mod.rs` | 120 | GPU orchestration, GpuMiner trait |
| `zion-universal-miner/src/miner/gpu/metal.rs` | 177 | Metal wrapper → CHv3 MetalMiner |
| `zion-universal-miner/src/miner/gpu/cuda.rs` | 212 | CUDA miner with PTX compilation |
| `zion-universal-miner/src/miner/gpu/opencl.rs` | 269 | OpenCL miner with ProQue |
| `zion-universal-miner/src/miner/gpu/benchmark.rs` | 236 | Auto-tune and benchmarking |
| `zion-universal-miner/src/miner/gpu/kernels/cosmic_harmony_v3.cu` | 269 | CUDA CHv3 kernel |
| `zion-universal-miner/src/miner/gpu/kernels/cosmic_harmony_v3.cl` | 242 | OpenCL CHv3 kernel |
| `zion-universal-miner/src/miner/stream_aware.rs` | 216 | StreamScheduler v2 state |
| `zion-universal-miner/src/miner/cpu.rs` | 466 | CPU loop (stream-aware reference) |
| `zion-universal-miner/src/main.rs` | 518 | Entry point, GPU init/benchmark |
| `zion-cosmic-harmony-v3/src/gpu/metal_miner.rs` | 457 | Core Metal CHv3 miner |
| `zion-cosmic-harmony-v3/src/gpu/metal_shader.metal` | 462 | CHv3 Metal compute shader |
| `zion-cosmic-harmony-v3/src/gpu/autolykos2_metal_miner.rs` | 614 | Autolykos2 TABLELESS miner |
| `zion-cosmic-harmony-v3/src/gpu/autolykos2_shader.metal` | 582 | Autolykos2 v4 shader (unrolled) |
| `zion-cosmic-harmony-v3/src/gpu/ethash_metal_miner.rs` | 742 | Ethash Metal miner + DAG |
| `zion-cosmic-harmony-v3/src/gpu/ethash_shader.metal` | 485 | Ethash Metal shader |
| `zion-cosmic-harmony-v3/src/gpu/metal_ffi.rs` | 255 | C FFI for Python/Swift |
| `zion-cosmic-harmony-v3/src/gpu/gpu_miner.rs` | 361 | OpenCL CHv3 miner |
| `zion-cosmic-harmony-v3/src/gpu/opencl_kernel.rs` | 441 | OpenCL CHv3 kernel source |

**Total GPU code**: ~6,000+ lines of Rust + ~2,300+ lines of GPU shaders (Metal/CUDA/OpenCL)

---

## 🎯 Conclusion

The ZION GPU mining codebase is **architecturally mature and feature-rich**. All 3 GPU backends work for CHv3, and Metal has additional Ethash + Autolykos support. The primary gap is the **missing GPU mining loop** in the Universal Miner — GPU miners exist but are not wired into the main mining flow. Creating a `GpuMiningLoop` with StreamScheduler v2 awareness (mirroring `CpuMiner::mining_loop()`) is the #1 priority to unlock GPU stream-aware mining.

🌟 *"Where technology meets spirit"* 🌟
