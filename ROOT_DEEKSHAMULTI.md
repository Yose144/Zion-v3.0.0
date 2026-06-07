# DeekshaMulti — Multi-Algorithm GPU Mining Suite

> **Status:** Active development (V3/L1)  
> **Last updated:** 2026-06-07  
> **Hardware reference:** AMD RX 5700 XT (gfx1010, RDNA) via AMD OpenCL  

## Overview

DeekshaMulti is the Zion L1 multi-algorithm GPU mining backend. It provides three complementary proof-of-work profiles that can be selected at runtime based on pool negotiation, thermal requirements, or user preference:

| Algorithm | Profile name | Purpose | Typical hashrate* |
|---|---|---|---|
| **Deeksha Lite v1** | `deeksha_lite_v1` | Fast, balanced GPU/CPU hybrid | ~12–13 KH/s |
| **Cosmic Harmony Ekam Deeksha v2** | `cosmic_harmony_ekam_deeksha_v2` | Full 6-layer memory-hard ASIC resistance | ~2.4 KH/s |
| **Deeksha Lite Fire** | `deeksha_lite_fire` | Maximum thermal / ALU stress (heat generation) | ~7.2 KH/s |

\* *Measured on AMD RX 5700 XT (gfx1010) with `--gpu-work-size 256 --gpu-local-size 256` and 10-second benchmark window. Real-world stratum hashrate depends on `ZION_NONCE_COUNT` pool setting.*

---

## Architecture

All three algorithms live in the `zion-cosmic-harmony` crate (`V3/L1/cosmic-harmony`) and are exposed to the miner via the `GpuMiner` trait in `zion-miner` (`V3/L1/miner/src/gpu_backend.rs`).

```
Pool / CLI ──► zion-miner ──► GpuMiner trait ──► OpenCL backend
                                    │
                                    ├── DeekshaLiteV1
                                    ├── CosmicHarmonyFull
                                    └── DeekshaLiteFire
```

### OpenCL backend support

Compile the miner with GPU support:

```bash
# AMD / Intel / generic OpenCL
cargo build --release --manifest-path V3/Cargo.toml -p zion-miner --features gpu-opencl

# macOS Metal
cargo build --release --manifest-path V3/Cargo.toml -p zion-miner --features gpu-metal
```

---

## Algorithm Details

### 1. Deeksha Lite v1 (`deeksha_lite_v1`)

- **Layers:** 4 (S1–S4)  
- **S4:** Blake3 + SHA-3-512 memory-hard scratchpad (512 KiB per thread)  
- **Best for:** Maximum throughput, general mining  
- **Kernel file:** `deeksha_lite.cl`

### 2. Cosmic Harmony Ekam Deeksha v2 (`cosmic_harmony_ekam_deeksha_v2`)

- **Layers:** 6 (S1–S6)  
- **S4:** Blake3 + SHA-3-512 memory-hard (512 KiB)  
- **S5:** Golden-ratio nonce mixing + AES-128  
- **S6:** Neural / fusion layer (GPU-friendly matrix ops)  
- **Best for:** Highest ASIC/FPGA resistance, longest validation path  
- **Kernel file:** `cosmic_harmony_deeksha.cl`

### 3. Deeksha Lite Fire (`deeksha_lite_fire`)

- **Purpose:** Deliberately maximize GPU core temperature and ALU utilisation for thermal testing, stability burn-in, or pool-side algorithm rotation.
- **Memory footprint:** Small — **128 KiB scratchpad per thread** (intentionally reduced so the bottleneck is ALU/FP32/INT64, not memory bandwidth).
- **Thermal loop:** 6 independent `ulong` integer chains with rotate-xor-mul-add mixing, executed **16 384 iterations** per hash.
- **AES rounds:** Full 10-round AES-128 with `__constant` S-box (no local-memory T-tables).
- **Random reads:** 512 scattered 32-byte reads from scratchpad to keep cache pressure low but prevent pure register optimisation.
- **Kernel file:** `deeksha_lite_fire.cl`

#### Fire kernel constants (current)

```c
#define SCRATCHPAD_SIZE  131072   // 128 KiB per thread
#define BLOCK_SIZE       32
#define BLOCK_COUNT      4096
#define PASSES           16
#define RANDOM_READS     512
#define AES_FULL_ROUNDS  10
#define THERMAL_ITERS    16384     // main heat source
```

#### Thermal loop design

The `thermal_loop()` function is the primary heat generator. It uses **6 parallel ulong chains** to saturate integer ALU ports and prevent common-subexpression elimination:

```c
void thermal_loop(__private uchar data[32], ulong nonce)
{
    ulong a = nonce ^ 0x9E3779B97F4A7C15UL;
    ulong b = nonce ^ 0xBF58476D1CE4E5B9UL;
    ulong c = nonce ^ 0x94D049BB133111EBUL;
    ulong d = nonce ^ 0x5851F42D4C957F2DUL;
    ulong e = nonce ^ 0xC0FFEE123456789AUL;
    ulong f = nonce ^ 0xDEADBEEFCAFEBABEUL;

    for (int i = 0; i < THERMAL_ITERS; i++) {
        a = ROL64(a, 17) + b;
        b = ROL64(b, 31) ^ a;
        c = ROL64(c, 13) + d;
        d = ROL64(d, 47) ^ c;
        e = ROL64(e, 23) + f;
        f = ROL64(f, 41) ^ e;
        a = a * 0xFF51AFD7ED558CCDUL;
        b = b + 0xFF51AFD7ED558CCDUL;
        c = c * 0x94D049BB133111EBUL;
        d = d + 0x5851F42D4C957F2DUL;
        e = e * 0xC0FFEE123456789AUL;
        f = f + 0xDEADBEEFCAFEBABEUL;
        a ^= (ulong)data[(i    ) & 0x1F];
        b ^= (ulong)data[(i + 8) & 0x1F];
        c ^= (ulong)data[(i + 16) & 0x1F];
        d ^= (ulong)data[(i + 24) & 0x1F];
        e ^= (ulong)data[(i + 4) & 0x1F];
        f ^= (ulong)data[(i + 12) & 0x1F];
    }
    // ... results folded back into data[32]
}
```

- **No branching** — fully divergent-free.
- **No `float` ops** in the current revision (pure 64-bit integer stress keeps kernel size small and compile times fast; `-cl-fast-relaxed-math` is still passed for potential future FP expansion).
- Build flags for RDNA: `-cl-std=CL1.2 -cl-mad-enable -cl-fast-relaxed-math -cl-single-precision-constant`

---

## Benchmarking

### Run all algorithms

```bash
# Requires OpenCL feature
cargo run --release --manifest-path V3/L1/miner/Cargo.toml --bin zion-miner \
  --features gpu-opencl -- --gpu-benchmark-all --gpu-device 1
```

### Latest results (2026-06-07)

AMD RX 5700 XT — `gfx1010:xnack-` — 10 s benchmark window:

| Algorithm | Throughput | Batch size | Local WS |
|---|---|---|---|
| `deeksha_lite_v1` | **12.68 KH/s** | 262 144 | 256 |
| `cosmic_harmony_ekam_deeksha_v2` | **2.38 KH/s** | 262 144 | 256 |
| `deeksha_lite_fire` | **7.24 KH/s** | 8 192 | 128 |

### Key observations

- **Fire is ~3× slower than Lite v1** but generates significantly more heat per watt because ALU utilisation is near 100 % (memory bandwidth is almost idle).
- **Full v2** is the slowest because of heavy Blake3/SHA3 scratchpad I/O and 6-layer validation.
- Live stratum hashrate will be lower than benchmark if the pool sends small nonce batches (`ZION_NONCE_COUNT`). Set pool `ZION_NONCE_COUNT=4096` (or higher) for GPU efficiency.

---

## Recent Changes

### 2026-06-07 — Fire kernel intensification + benchmark accuracy fix

1. **Benchmark accuracy fix** (`ce29d665`)  
   Missing `queue.finish()` after OpenCL buffer reads caused kernels to report completion before they actually finished. This artificially inflated Fire/V2 hashrates to impossible values (e.g., 18 MH/s). Added `finish()` after every `enqueue_read_buffer` and `enqueue_write_buffer` in `gpu_backend.rs`.

2. **Fire thermal loop strengthening** (`da6fca81`, follow-up)  
   - Scratchpad reduced from 512 KiB → **128 KiB** (moves bottleneck from VRAM bandwidth to ALU).
   - Thermal iterations raised from 1024 → **8192 → 16 384**.
   - Integer chains expanded from 4 → **6** independent `ulong` chains.
   - Build flags tightened for RDNA (`-cl-single-precision-constant`).

3. **Consensus profile switch**  
   `core_uses_canonical_profile` test updated to expect `"deeksha_lite_v1"` as the canonical L1 profile.

---

## Build & Test

```bash
# Run targeted tests
cargo test --manifest-path V3/Cargo.toml -p zion-cosmic-harmony fire -- --test-threads=1

# Run full GPU benchmark
cargo run --release --manifest-path V3/L1/miner/Cargo.toml --bin zion-miner \
  --features gpu-opencl -- --gpu-benchmark-all --gpu-device 1

# Live mining (example)
$env:ZION_POOL_ADDR='77.42.71.94:8444'
$env:ZION_WORKER_NAME='worker1'
$env:ZION_PAYOUT_ADDRESS='zion1...'
$env:ZION_LOOP_COUNT='1000000'
cargo run --release --manifest-path V3/L1/miner/Cargo.toml --bin zion-miner --features gpu-opencl
```

---

## Notes

- **Windows file-lock warning:** On Windows, keep only one Cargo target directory active at a time. Parallel builds into different `CARGO_TARGET_DIR` values can trigger linker locks (`LNK1104`).
- **Fire scratchpad:** 128 KiB per thread × 8 192 threads = 1 GiB total VRAM. Ensure your GPU has at least ~2 GiB free before starting Fire.
- **Algorithm auto-switch:** The miner supports runtime algorithm switching. The pool can negotiate `deeksha_lite_v1` (default) or request `deeksha_lite_fire` for thermal-heavy epochs.

---

*Generated with [Devin](https://cli.devin.ai/docs)*
