# ZION Cosmic Harmony Deeksha — GPU Kernel Plan

> Version 2.9.8 · 10 March 2026 · Canonical Deeksha GPU Mining

---

## 1. Executive Summary

The Deeksha proof-of-work algorithm is ZION's canonical mining hash function since v2.9.8.
This document describes the complete GPU kernel implementation, its pipeline stages,
architecture decisions, verification strategy, and future optimization roadmap.

**Key results:**
- The canonical OpenCL kernel achieves **~15,000 H/s** on AMD RDNA 1 GPU
  (RX 5600/5700 class), a **~100× speedup** over the single-thread CPU native path (~155 H/s).
- The canonical native Metal backend now runs on **Apple M1** via PyObjC Metal,
  passes bit-exact CPU/native verification, and was validated against the live pool at
  **~1.1 kH/s** with accepted shares.

---

## 2. Problem Statement

The original GPU kernels (`cosmic_harmony_deeksha.cl`, `.metal`, `.cu`) implemented the
**legacy CHv4.2 (Merkabah Dual-Spin)** pipeline, not the Deeksha canonical pipeline.
All shares found by the GPU were rejected by the pool with "Does not meet target difficulty"
because the hash output was completely different from what the pool expected.

### Root Cause

| Component | Expected | Actual (legacy GPU) |
|-----------|----------|---------------------|
| Step 1 | Keccak-256 (pad 0x01, rate 136) | SHA3-256 (pad 0x06) |
| Step 3 | Golden Matrix (φ^k FP multiply) | Merkabah rotation |
| Step 4 | Memory-hard (64 KiB, 2 passes) | Missing entirely |
| Step 5 | NPU Mix (INT8 MLP) | Missing entirely |
| Step 6 | Cosmic Fusion (AES-128) | Simple XOR fusion |

**Solution:**
- Write a canonical OpenCL kernel (`cosmic_harmony_deeksha_canonical.cl`) that implements
  the exact same pipeline as the Rust reference implementation, bit-for-bit.
- Port the same canonical pipeline to Metal (`cosmic_harmony_deeksha.metal`) and keep the
  legacy alias asset (`cosmic_harmony_v42.metal`) synchronized to the same implementation.
- Fix Stratum telemetry so `shares_sent`, `shares_accepted`, and `shares_rejected` reflect
  actual pool responses rather than local candidate discovery.

---

## 3. Canonical Deeksha Pipeline

The pipeline has 6 sequential stages. Input is `header` (≤80 bytes, zero-padded to 80)
concatenated with `nonce` (8 bytes, little-endian) = 88 bytes total.

### 3.1 Step 1 — Keccak-256 (Input Commitment)

```
Input:  header[80] || nonce[8]  = 88 bytes
Output: 32 bytes
```

- **Algorithm:** Raw Keccak-256 (NOT SHA3-256)
- **Padding byte:** `0x01` (Keccak), not `0x06` (SHA3)
- **Rate:** 136 bytes (1088 bits)
- **Capacity:** 64 bytes (512 bits)
- **Permutation:** Keccak-f[1600], 24 rounds
- **Output:** First 32 bytes of squeezed state

### 3.2 Step 2 — SHA3-512 (State Expansion)

```
Input:  32 bytes (from Step 1)
Output: 64 bytes
```

- **Algorithm:** SHA3-512 (standard FIPS 202)
- **Padding byte:** `0x06` (SHA3 domain separation)
- **Rate:** 72 bytes (576 bits)
- **Output:** 64 bytes

### 3.3 Step 3 — Golden Matrix (φ-Transform)

```
Input:  64 bytes (8 × u64 values)
Output: 64 bytes (8 × u64 values)
```

- **Matrix:** 8×8 transform using golden ratio powers
- **Constants:** `PHI_POWERS_FP[k] = floor(φ^k × 2^32)` for k = 0..15

```
PHI_FP[0]  = 4294967296      PHI_FP[8]  = 201772039223
PHI_FP[1]  = 6949403065      PHI_FP[9]  = 326474017443
PHI_FP[2]  = 11244370361     PHI_FP[10] = 528246056666
PHI_FP[3]  = 18193773427     PHI_FP[11] = 854720074109
PHI_FP[4]  = 29438143788     PHI_FP[12] = 1382966130776
PHI_FP[5]  = 47631917215     PHI_FP[13] = 2237686204885
PHI_FP[6]  = 77070061004     PHI_FP[14] = 3620652335660
PHI_FP[7]  = 124701978219    PHI_FP[15] = 5858338540545
```

- **Operation (per cell):**
  ```
  acc = 0
  for j in 0..8:
      phi_idx = (i + j) % 16
      acc += (input[j] as u128 * PHI_FP[phi_idx] as u128) >> 32
  output[i] = acc as u64
  ```

### 3.4 Step 4 — Memory-Hard Phase

```
Input:  64 bytes (from Step 3)
Output: 64 bytes
```

The memory-hard phase has three sub-stages:

#### 3.4.1 Scratchpad Initialization

- **Size:** 64 KiB (65,536 bytes) = 1024 blocks × 64 bytes
- **Method:** SHA3-512 chain
  - Block 0 = input (64 bytes)
  - Block i = SHA3-512(Block[i-1]) for i = 1..1023

#### 3.4.2 Sequential Passes (2 passes)

- **Pass 0 (forward):** i = 0, 1, 2, ..., 1023
- **Pass 1 (backward):** i = 1023, 1022, ..., 0
- **Mix operation per block:**
  ```
  prev_idx = (i - 1) mod 1024
  rand_idx = u64_le(block[i][0..8]) mod 1024
  new = SHA3-512(block[i] || block[prev_idx] || block[rand_idx] || pass_byte || idx_le64)
  block[i] ^= new    // 64-byte XOR
  ```

#### 3.4.3 Random Read Mix

- **64 random reads** from the scratchpad
- Starting state = scratchpad block 0
- Per read:
  ```
  block_idx = u64_le(state[0..8]) mod 1024
  state ^= scratchpad[block_idx]
  state = Keccak-256(state)   // 64 bytes → 32 bytes, then zero-extend to 64
  ```
- Final: SHA3-512(state) → 64 bytes output

### 3.5 Step 5 — NPU Mix (Neural Processing)

```
Input:  64 bytes
Output: 64 bytes
```

- **Architecture:** INT8 Multi-Layer Perceptron (MLP)
- **Layers:** 64 → 128 (hidden) → 64 (output)
- **Activation:** GELU approximation on INT8
- **Normalization:** Layer normalization with learned scale
- **Residual connection:** output = NPU(input) + input (byte-wise wrapping add)

#### Weight Layout (16,960 bytes total)

| Weight | Shape | Bytes | Offset |
|--------|-------|-------|--------|
| W1 | 128 × 64 | 8,192 | 0 |
| b1 | 128 | 128 | 8,192 |
| W2 | 64 × 128 | 8,192 | 8,320 |
| b2 | 64 | 64 | 16,512 |
| scale1 | 128 (i16 LE) | 256 | 16,576 |
| scale2 | 64 (i16 LE) | 128 | 16,832 |
| **Total** | | **16,960** | |

#### Weight Derivation

Weights are deterministically generated using **Blake3** keyed hash:

```
seed_key = blake3("ZION_CHv4_mixing_v1_genesis_seed")  // 32 bytes
hasher = blake3::Hasher::new_keyed(seed_key)
hasher.update(b"CHv4_weights_v1")
raw = hasher.finalize_xof().take(544 * 32)  // 17,408 bytes
```

W1, b1, W2, b2 are filled sequentially from `raw`. Scale factors:
```
scale[i] = (224 + (raw_byte & 0x3F)) as i16   // range [224, 287]
```

Pre-computed binary: `deeksha_npu_weights.bin` (SHA256: `18fbd27fe16a820e4138d5ccb977462c0f1883121bbe829cacc7bafe865306a0`)

### 3.6 Step 6 — Cosmic Fusion

```
Input:  64 bytes (from Step 5)
Output: 32 bytes (final hash)
```

- **4 fusion rounds**, each:
  1. `round_hash = Keccak-256(state || round_byte)`  (65 bytes → 32 bytes)
  2. `key = round_hash[0..16]`  (first 16 bytes, AES-128 key)
  3. `block_a = state[0..16]` → AES-128-ECB encrypt with `key` → `enc_a`
  4. `block_b = state[16..32]` → AES-128-ECB encrypt with `key` → `enc_b`
  5. `mask = round_hash[16..32]`  (last 16 bytes)
  6. XOR combine: `state[0..16] ^= enc_a ^ mask`, `state[16..32] ^= enc_b ^ mask`

- **Final:** SHA3-512(state) → take first 32 bytes = **final Deeksha hash**

### 3.7 Target Check

```
result = u32_le(hash[0..4])
accepted = (result <= target_u32)
```

First 4 bytes of the hash interpreted as little-endian u32, compared against pool target.

---

## 4. Implementation Architecture

### 4.1 File Structure

```
APP&WEB/desktop-agent/resources/mining/
├── cosmic_harmony_deeksha_canonical.cl   ← NEW: Canonical GPU kernel (1045 lines)
├── deeksha_npu_weights.bin               ← NEW: Pre-computed NPU weights (16,960 B)
├── cosmic_harmony_v42_gpu.py             ← MODIFIED: OpenCL + Metal backend wrapper
├── cosmic_harmony_deeksha_fallback.py    ← MODIFIED: Stratum telemetry + candidate re-verification
├── cosmic_harmony_deeksha.metal          ← MODIFIED: Canonical native Metal shader
├── cosmic_harmony_v42.metal              ← MODIFIED: Synced alias of canonical Metal shader
├── cosmic_harmony_deeksha.cl             ← LEGACY: Old CHv4.2 kernel (kept for compat)
├── cosmic_harmony_deeksha.dll            ← Native DLL (CPU fallback)
└── ...
```

### 4.2 Backend Auto-Detection Priority

```
1. Metal          — Canonical native Metal on macOS arm64 (preferred on Apple Silicon)
2. DeekshaOpenCL  — Canonical GPU kernel via pyopencl
3. Native DLL     — cosmic_harmony_deeksha.dll via ctypes (CPU fallback)
4. CPU Python     — Pure Python reference (last resort)
```

The auto-detection logic lives in `CHv42GPU._setup()`. On Apple Silicon it now resolves to
native Metal when the canonical shader compiles successfully; otherwise it falls back to the
canonical OpenCL path or exact CPU/native verification path.

### 4.3 OpenCL Kernel Interface

```c
__kernel void deeksha_mine(
    __global const uchar *g_header,      // header bytes (80 B max)
    const          uint   header_len,     // actual header length
    const          ulong  nonce_base,     // starting nonce for this batch
    const          uint   target,         // difficulty target (u32 LE)
    __global       uint  *g_found,        // atomic flag: 1 = share found
    __global       ulong *g_nonce,        // found nonce output
    __global       uchar *g_hash,         // found hash output (32 B)
    __constant     char  *npu_w1,         // NPU weight W1 [128×64]
    __constant     char  *npu_b1,         // NPU bias b1 [128]
    __constant     char  *npu_w2,         // NPU weight W2 [64×128]
    __constant     char  *npu_b2,         // NPU bias b2 [64]
    __constant     short *npu_scale1,     // NPU LayerNorm scale1 [128]
    __constant     short *npu_scale2      // NPU LayerNorm scale2 [64]
)
```

### 4.4 Memory Requirements Per Work-Item

| Resource | Size | Notes |
|----------|------|-------|
| Scratchpad | 64 KiB | `uchar scratch[65536]` in private memory |
| Keccak state | 200 B | `ulong state[25]` |
| Input buffer | 200 B | Padded to rate boundary |
| Temp state | ~512 B | Working variables |
| **Total** | **~66 KiB** | Per work-item private memory |

### 4.5 Batch Size Tuning

| Batch Size | Hashrate (AMD gfx1010) | VRAM Usage |
|------------|------------------------|------------|
| 64 | ~415 H/s | ~4 MiB |
| 128 | ~896 H/s | ~8 MiB |
| 256 | ~1,908 H/s | ~16 MiB |
| 512 | ~4,336 H/s | ~32 MiB |
| 1024 | ~8,371 H/s | ~64 MiB |
| 2048 | ~15,243 H/s | ~128 MiB |

Default max batch size: **2048** (limited by 64 KiB scratchpad per thread).
GPU devices with >4 GiB VRAM can safely handle batch 2048.

---

## 5. Verification Strategy

### 5.1 Bit-Exact Hash Verification

The GPU kernel was verified against the native DLL (`cosmic_harmony_deeksha.dll`) using a
canonical test vector:

```
Header: "ZION_DEEKSHA_GENESIS_V298_CANONICAL" (zero-padded to 80 B)
Nonce:  0x2980000100000001
```

**Both GPU and native DLL produce identical hash:**
```
f72031a1f648050f05e6719fd6df895bbd319590277267857316ba6e6444f700
```

### 5.2 End-to-End Share Verification

The fallback miner includes a re-verification gate: every GPU-found share is re-hashed with
the exact `hash_deeksha()` function before submission to the pool. With the canonical kernel,
all GPU shares now pass this check (hash matches bit-for-bit).

**Test result:** GPU found nonce `0x29800001000003e0` with hash
`c682b309dfbba5d4e199fee806cc2903a97583fa4a2c7f48cb242a8608e8b309` —
matched exact canonical hash, zero false positives.

### 5.3 Pool Acceptance

Shares mined with the canonical GPU kernel are accepted by the pool at
`91.98.122.165:3333` without difficulty rejections.

### 5.4 Native Metal Verification

The native Metal backend was validated in three stages on Apple M1:

1. **Forced single-result correctness**
  - `CHv42GPU(backend="metal")` returned a candidate hash that matched `hash_deeksha()` bit-for-bit.
2. **Batch winner correctness**
  - Over a 2048-nonce batch, Metal returned the same first winning nonce and hash as the CPU/native reference.
3. **Live Stratum validation**
  - A live pool run with `--backend metal` sustained roughly **1.1 kH/s** and produced accepted shares.

Example live result summary:

```json
{
  "backend": "gpu_metal",
  "hashrate": 1113.509,
  "shares_sent": 17,
  "shares_accepted": 17,
  "shares_rejected": 0,
  "hashes_total": 61440,
  "uptime_secs": 55.2
}
```

---

## 6. Integration Points

### 6.1 Electron Main Process (main.js)

- OpenCL device detection regex updated to catch `[DeekshaOpenCL]` log lines
- Runtime backend mapping: `deeksha-opencl` → `GPU (OpenCL Deeksha)`
- Functions: `mapDeekshaRuntimeBackend()`, `syncDeekshaResolvedBackend()`

### 6.2 Dashboard UI (renderer.js)

- Backend label: `deeksha-opencl` → `"Deeksha GPU (OpenCL)"`
- Status pill correctly shows GPU indicator when using canonical kernel

### 6.3 Fallback Miner (cosmic_harmony_deeksha_fallback.py)

- GPU candidate re-verification gate: `hash_deeksha()` check before pool submission
- Safety net against any future kernel regression
- Stratum stats JSON now separates `shares_found`, `shares_sent`, `shares_accepted`, and
  `shares_rejected`, so the desktop dashboard reflects actual pool acknowledgements.

---

## 7. Future Optimization Roadmap

### 7.1 Short Term (v2.9.8 polish)

- [ ] **Loop unrolling** in `keccak_f1600()` — unroll inner θ/ρ/π/χ/ι rounds
- [ ] **ulong-aligned absorb** — read 8 bytes at a time instead of byte-by-byte XOR
- [ ] **Reduce register pressure** — reuse temp arrays across pipeline stages
- [ ] **Work-group cooperative scratchpad** — use local memory for random reads if
      scratchpad fits in 64-KiB LDS (not feasible at current 64 KiB/thread, would need tiling)

### 7.2 Medium Term (v2.9.9+)

- [ ] **CUDA port** — translate canonical kernel to `.cu` for NVIDIA GPUs
  - Target: sm_70+ (Volta/Turing/Ampere/Ada)
  - INT8 MLP via `__dp4a` intrinsic for Tensor Core acceleration
  - Expected: ~30-50 kH/s on RTX 3060 class
- [ ] **Metal optimization pass** — reduce register pressure and improve throughput of the
      canonical `.metal` shader on Apple Silicon
  - Current verified baseline: ~1.1 kH/s on M1 via PyObjC Metal runtime
  - Focus areas: keccak absorb/finalize reuse, scratchpad traffic, batch sizing, optional ANE/NPU mix acceleration
- [ ] **Multi-GPU support** — split nonce range across multiple devices
- [ ] **Persistent kernel** — keep kernel running across Stratum jobs, update header via
      device-mapped memory

### 7.3 Long Term (v3.0)

- [ ] **FPGA/ASIC resistance audit** — verify memory-hard phase provides adequate
      ASIC resistance with 64 KiB scratchpad and random access pattern
- [ ] **L2 bridge integration** — lightweight hash verification in smart contracts
- [ ] **Power efficiency tuning** — clock/voltage profiles for mining rigs
- [ ] **Stratum V2** — direct kernel↔pool protocol without Python intermediary

---

## 8. Platform Compatibility Matrix

| Platform | GPU | Backend | Status | Expected Hashrate |
|----------|-----|---------|--------|-------------------|
| Windows x64 | AMD RDNA 1+ | DeekshaOpenCL | ✅ Verified | ~15 kH/s |
| Windows x64 | AMD RDNA 2/3 | DeekshaOpenCL | 🟡 Expected | ~20-30 kH/s |
| Windows x64 | NVIDIA (CUDA) | Native DLL fallback | ✅ Works (CPU) | ~155 H/s |
| Windows x64 | Intel Arc | DeekshaOpenCL | 🟡 Expected | ~5-10 kH/s |
| Linux x64 | AMD | DeekshaOpenCL | 🟡 Expected | ~15 kH/s |
| Linux x64 | NVIDIA | CUDA (planned) | ❌ Not yet | — |
| macOS arm64 | Apple M1 | Metal | ✅ Verified | ~1.1 kH/s |
| macOS arm64 | Apple M2-M5 | Metal | 🟡 Expected | ~1-5 kH/s before optimization |

---

## 9. Security Considerations

- **Weight determinism:** NPU weights are derived from a fixed Blake3 seed — all miners
  produce identical weights, ensuring consensus compatibility.
- **No network-dependent data:** The kernel uses only header + nonce as input.
  All constants are compiled into the kernel or loaded from deterministic weight files.
- **Re-verification gate:** Even if a GPU produces incorrect hashes (driver bugs, hardware
  errors), the fallback miner re-verifies every candidate before pool submission.
- **AES S-box:** FIPS 197 standard S-box, constant-time lookup in `__constant` memory.

---

## 10. Reference Files

| File | Lines | Purpose |
|------|-------|---------|
| `APP&WEB/desktop-agent/resources/mining/cosmic_harmony_deeksha_canonical.cl` | 1,045 | Canonical OpenCL GPU kernel |
| `APP&WEB/desktop-agent/resources/mining/deeksha_npu_weights.bin` | — | NPU weights binary (16,960 B) |
| `APP&WEB/desktop-agent/resources/mining/cosmic_harmony_v42_gpu.py` | ~1,100 | GPU backend wrapper + auto-detection |
| `APP&WEB/desktop-agent/resources/mining/cosmic_harmony_deeksha.metal` | ~800 | Canonical native Metal shader |
| `APP&WEB/desktop-agent/resources/mining/cosmic_harmony_v42.metal` | ~800 | Synced legacy alias of canonical Metal shader |
| `APP&WEB/desktop-agent/resources/mining/cosmic_harmony_deeksha_fallback.py` | ~600 | Stratum miner + re-verification + accepted-share telemetry |
| `APP&WEB/desktop-agent/src/main.js` | ~2,000 | Electron orchestrator |
| `APP&WEB/desktop-agent/src/ui/renderer.js` | ~500 | Dashboard UI |
| `L1/core/src/consensus/algorithms_opt.rs` | — | Rust reference implementation |
| `L1/core/src/consensus/algorithms_npu.rs` | — | Rust NPU weight generation |

---

*Document authored by ZION AI Native Team — March 2026*
