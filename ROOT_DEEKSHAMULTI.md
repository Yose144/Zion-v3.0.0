# DeekshaMulti — Multi-Algorithm GPU Mining Suite

> **Status:** Active development (V3/L1)  
> **Last updated:** 2026-06-07  
> **Hardware reference:** AMD RX 5700 XT (gfx1010, RDNA) via AMD OpenCL  

## Overview

DeekshaMulti is the Zion L1 multi-algorithm GPU mining backend. It provides three complementary proof-of-work profiles that can be selected at runtime based on pool negotiation, thermal requirements, or user preference:

| Algorithm | Profile name | Purpose | Typical hashrate* |
|---|---|---|---|
| **Deeksha Lite v1** | `deeksha_lite_v1` | Fast, balanced GPU/CPU hybrid | ~5.5 KH/s |
| **Cosmic Harmony Ekam Deeksha v2** | `cosmic_harmony_ekam_deeksha_v2` | Full 6-layer memory-hard ASIC resistance | ~1.8 KH/s |
| **Deeksha Lite Fire** | `deeksha_lite_fire` | Maximum thermal / ALU stress (heat generation) | ~4.9 KH/s |

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
- **Thermal loop:** 8 independent `ulong` integer chains + 2 float `fma` chains with rotate-xor-mul-add mixing, executed **65 536 iterations** per hash.
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
#define THERMAL_ITERS    65536     // main heat source (v3.0)
```

#### Thermal loop design

The `thermal_loop()` function is the primary heat generator. It uses **8 parallel ulong chains** + **2 float `fma` chains** to saturate both INT and FP ALU pipelines simultaneously:

```c
void thermal_loop(__private uchar data[32], ulong nonce)
{
    /* 8 independent ulong integer chains */
    ulong a = nonce ^ 0x9E3779B97F4A7C15UL;
    ulong b = nonce ^ 0xBF58476D1CE4E5B9UL;
    ulong c = nonce ^ 0x94D049BB133111EBUL;
    ulong d = nonce ^ 0x5851F42D4C957F2DUL;
    ulong e = nonce ^ 0xC0FFEE123456789AUL;
    ulong f = nonce ^ 0xDEADBEEFCAFEBABEUL;
    ulong g = nonce ^ 0xBADC0FFEE0DDF00DUL;
    ulong h = nonce ^ 0xFEEDFACECAFEBEEFUL;

    /* 2 independent float fma chains */
    float f1 = (float)(nonce & 0xFFFFu) * 0.0001f;
    float f2 = (float)((nonce >> 16) & 0xFFFFu) * 0.0001f;

    for (int i = 0; i < THERMAL_ITERS; i++) {
        /* Integer ALU stress (8 chains) */
        a = ROL64(a, 17) + b;  b = ROL64(b, 31) ^ a;
        c = ROL64(c, 13) + d;  d = ROL64(d, 47) ^ c;
        e = ROL64(e, 23) + f;  f = ROL64(f, 41) ^ e;
        g = ROL64(g, 11) + h;  h = ROL64(h, 53) ^ g;
        a = a * 0xFF51AFD7ED558CCDUL;  b = b + 0xFF51AFD7ED558CCDUL;
        c = c * 0x94D049BB133111EBUL;  d = d + 0x5851F42D4C957F2DUL;
        e = e * 0xC0FFEE123456789AUL;  f = f + 0xDEADBEEFCAFEBABEUL;
        g = g * 0xBADC0FFEE0DDF00DUL;  h = h + 0xFEEDFACECAFEBEEFUL;
        a ^= (ulong)data[(i    ) & 0x1F];  b ^= (ulong)data[(i + 8) & 0x1F];
        c ^= (ulong)data[(i + 16) & 0x1F]; d ^= (ulong)data[(i + 24) & 0x1F];
        e ^= (ulong)data[(i + 4) & 0x1F];  f ^= (ulong)data[(i + 12) & 0x1F];
        g ^= (ulong)data[(i + 2) & 0x1F];  h ^= (ulong)data[(i + 6) & 0x1F];

        /* Float ALU stress (2 fma chains) */
        f1 = fma(f1, 1.618033988f, f2);
        f2 = fma(f2, 2.718281828f, f1);
        f1 = fma(f1, 3.141592653f, f2);
        f2 = fma(f2, 1.414213562f, f1);
    }
    /* ... results folded back into data[32] */
}
```

- **No branching** — fully divergent-free.
- **`fma()` only** — no `sin`, `cos`, `half`, `double`, or `native_*`. `fma` is a single instruction on GCN, RDNA, CUDA, and Metal.
- **Results folded back into output** via `as_uint()` — prevents dead-code elimination.
- Build flags for RDNA (v3.0): `-cl-std=CL1.2 -cl-mad-enable -cl-single-precision-constant` (no `-cl-fast-relaxed-math` for better precision and driver compatibility).

---

## Benchmarking

### Run all algorithms

```bash
# Requires OpenCL feature
cargo run --release --manifest-path V3/L1/miner/Cargo.toml --bin zion-miner \
  --features gpu-opencl -- --gpu-benchmark-all --gpu-device 1
```

### Latest results (2026-06-07 — Fire v3.0 Winter Mode, 65536 iters)

AMD RX 5700 XT — `gfx1010:xnack-` — 10 s benchmark window:

| Algorithm | Throughput | Batch size | Local WS | Build opts |
|---|---|---|---|---|
| `deeksha_lite_v1` | **5.48 KH/s** | 262 144 | 128 | `-cl-fast-relaxed-math` |
| `cosmic_harmony_ekam_deeksha_v2` | **1.79 KH/s** | 6 128 | 128 | `-cl-fast-relaxed-math` |
| `deeksha_lite_fire` | **4.92 KH/s** | 8 192 | 128 | `-cl-mad-enable -cl-single-precision-constant` |

### Key observations

- **Fire v3.0** now stresses **both INT and FP ALU pipelines** simultaneously (`fma` float chains + 8 integer chains). This gives more heat per watt than pure integer stress because the GPU runs both pipelines at once without increasing memory traffic.
- **Live stratum hashrate** can be higher than benchmark because the benchmark includes init overhead per batch. Peak observed: ~4.6 KH/s with 32768 iters; ~4.9 KH/s with 65536 iters.
- **Full v2** is the slowest because of heavy Blake3/SHA3 scratchpad I/O and 6-layer validation.
- Set pool `ZION_NONCE_COUNT=4096` (or higher) for better GPU utilisation in live stratum.
- **Compatibility:** Fire uses only `fma()`, `rotate()`, `+`, `^`, `*` — no `sin`, `cos`, `half`, `double`, or `native_*`. Works on AMD GCN, AMD RDNA, NVIDIA CUDA, and Apple Metal.
- **Build opts:** Fire v3.0 intentionally avoids `-cl-fast-relaxed-math` to prevent the OpenCL compiler from aggressively simplifying the thermal loop. This improves cross-driver consistency.

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

### 2026-06-07 — Full Fire end-to-end integration

Fire is now a **first-class algorithm** across the entire V3 stack:

| Layer | Change |
|---|---|
| **Core** (`zion-core`) | `RpcRequest::SubmitCandidate` carries `algorithm`. `validate_candidate_with_algorithm()` computes the hash with the correct algorithm instead of hard-coding `deeksha_lite_v1`. |
| **Node** (`node` bin) | `submit_candidate_rpc` reads `algorithm` from the RPC request and validates the PoW with `hash_candidate_with_algorithm`. |
| **Pool** (`server` bin) | `submit_candidate_to_node` forwards the session algorithm to the node. Share validation already used `hash_with_algorithm`. |
| **Miner** (`zion-miner`) | Already read `algorithm` from `PoolMessage::Job` and switched GPU backend at runtime. |
| **CLI** (`zion mine start`) | New `--algorithm` flag sets `ZION_MINER_ALGORITHM` env var, passed to the miner binary. |

This means a Fire miner can now discover a valid block, the pool will submit it to the node, and the node will accept it using the Fire hash function.

### 2026-06-07 — Fire v3.0 (Winter Mode) — universal heat-per-watt optimization

The Fire kernel was redesigned for **maximum heat per watt** while staying compatible with **all GPU architectures** (AMD GCN, AMD RDNA, NVIDIA CUDA, Apple Metal).

| Design choice | Reason |
|---|---|
| **8 integer chains** (was 6) | Better ILP on RDNA; still fine on GCN |
| **2 float `fma` chains** added | Stresses FP units alongside INT ALU — both pipelines active = more heat for same wattage |
| **`THERMAL_ITERS 32768`** (was 8192 → 16384) | Sustained ALU saturation without exploding kernel compile time |
| **Only `fma(a,b,c)`** — no `sin`, `cos`, `half`, `double` | `fma` is a single instruction on GCN, RDNA, CUDA, and Metal. No driver compatibility issues. |
| **128 KiB scratchpad** kept | Memory bandwidth stays idle; heat comes purely from ALU |
| **Results mixed back into output** | Prevents compiler from dead-code eliminating the float work |

**Winter vs Summer mode:**

| Mode | Algorithm | Use case | ALU load | Expected GPU temp |
|---|---|---|---|---|
| **Winter (Fire)** | `deeksha_lite_fire` | Cold months, thermal testing, stability burn-in | ~90–95 % ALU | +10–15 °C over Lite |
| **Summer (Lite)** | `deeksha_lite_v1` | Normal mining, hot weather | ~40–50 % ALU | Baseline |

Switch at runtime:  
`zion mine start --algorithm deeksha_lite_fire` (winter)  
`zion mine start --algorithm deeksha_lite_v1` (summer)

---

### 2026-06-07 — Fire v3.0 Final Deploy (E2E verified)

Full end-to-end deployment across all infrastructure:

| Component | Host | Status | Binary version |
|---|---|---|---|
| **Edge Node 1** | `77.42.71.94` | active | `965d30c5` |
| **Edge Node 2** | `77.42.71.94` | active | `965d30c5` |
| **Edge Pool** | `77.42.71.94:8444` | active | `965d30c5` |
| **Local Miner** | Windows dev | tested | `965d30c5` |
| **Local Node** | Windows dev | build OK | `965d30c5` |
| **Local Pool** | Windows dev | build OK | `965d30c5` |
| **CLI** | Windows dev | build OK | `965d30c5` |

**Tests passed:**
- `cargo test -p zion-cosmic-harmony` — **132/132 passed**
- `cargo test -p zion-core` — passed
- Local Fire benchmark (`--ekam-bench`) — **4.92 KH/s** on RX 5700 XT
- Live stratum mining to Edge pool — **100 % share acceptance** (2 shares, 0 rejected)
- Algorithm-aware block validation (`BlockCandidate::hash()` reads algorithm from RPC)
- Pool forwards algorithm to node via `submit_candidate_to_node()`

**Commit:** `965d30c5` on `main`

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
