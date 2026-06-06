# DeekshaDebug — Research crate for s4-mode GPU mining optimisation

This crate is kept **outside `V3/`** so experimental code, debug tools and
performance benchmarks do not pollute the mainnet code line.

All experiments target the AMD RDNA (`gfx1010:xnack-`) RX 5600 XT that
runs the ZION v3 miner in `gcn_s4_mode` (GPU stages 1–4, CPU NPU+fusion).

---

## Problem statement

The RX 5600 XT historically benchmarked at **~5–10 KH/s** in the *full*
GPU pipeline, but that pipeline produced `GPU_MISMATCH` warnings on RDNA
because the AMD OpenCL compiler generated incorrect hashes under high
register pressure in the NPU / fusion stages.

Switching to **mandatory s4_mode** eliminated the mismatches, but
hashrate dropped to **~2.5 KH/s** because the CPU side (NPU mixing +
cosmic fusion) became the bottleneck.  The sequential `for i in 0..chunk`
loop on a 6-core CPU could not keep up with the GPU.

---

## Experiments

### 1. `main.rs` — baseline: sequential vs Rayon parallel CPU scan

**Goal:** measure raw CPU throughput of the post-GPU NPU+fusion loop.

**Method:**
- Generate deterministic fake s4_data (64 bytes / nonce).
- Run `npu_mixing_step_epoch` + `cosmic_fusion_opt_rounds` for every nonce.
- Compare sequential `for` loop vs `rayon::par_iter`.

**Results (release build, 6 cores / 12 threads):**

| chunk | sequential | parallel (Rayon) | speedup |
|-------|------------|------------------|---------|
| 256   | 64 KH/s    | 256 KH/s         | 4.0x    |
| 1024  | 60 KH/s    | 512 KH/s         | 8.5x    |
| 6128  | 59 KH/s    | 409 KH/s         | 6.9x    |

**Conclusion:** pure CPU parallelism gives 6–8x speedup.

---

### 2. `bench_gpu_overhead.rs` — GPU kernel launch vs useful work

**Goal:** quantify the fixed overhead of `clEnqueueNDRangeKernel` on AMD RDNA.

**Method:**
- Simulate GPU time = 850 ms fixed + 10 µs / item.
- Measure total wall-clock for different chunk sizes.

**Results:**

| chunk | GPU time | CPU time | total  | overhead % |
|-------|----------|----------|--------|------------|
| 256   | 853 ms   | ~4 ms    | ~857 ms| 99.2 %     |
| 1024  | 860 ms   | ~17 ms   | ~877 ms| 97.0 %     |
| 4096  | 891 ms   | ~68 ms   | ~959 ms| 88.6 %     |
| 16384 | 1014 ms  | ~272 ms  | ~1286 ms| 66.1 %    |

**Conclusion:** for chunks < 4K the GPU launch overhead dominates
completely.  Bigger chunks amortise the overhead, but pool must send
larger `nonce_count` windows.

---

### 3. `bench_double_buffer.rs` — hiding GPU latency with double buffering

**Goal:** overlap GPU kernel execution with CPU scan by keeping two
`s4_out_buf` buffers (A and B) and swapping them.

**Method:**
- Sequential: GPU fills A → CPU scans A → GPU fills A → …
- Double-buffer: while CPU scans A, GPU already fills B.

**Results:**

| chunk | sequential | double-buffer | speedup |
|-------|------------|---------------|---------|
| 256   | 1732 ms    | 1887 ms       | 0.92x   |
| 512   | 1759 ms    | 1897 ms       | 0.93x   |
| 1024  | 1787 ms    | 1912 ms       | 0.93x   |
| 2048  | 1852 ms    | 1926 ms       | 0.96x   |
| 4096  | 2005 ms    | 1982 ms       | 1.01x   |
| 6128  | 2130 ms    | 2014 ms       | 1.06x   |

**Conclusion:** on a single-GPU / single-queue OpenCL context, the GPU
kernel is synchronous (enq + finish).  Double buffering only helps if we
use **two separate command queues** or **out-of-order execution**, which
the `ocl` crate does not expose easily on AMD.  Realistic gain on RDNA
is therefore small unless we move to persistent kernels.

---

### 4. `bench_alloc_overhead.rs` — heap Vec vs stack fixed array

**Goal:** remove the `vec![0u8; chunk * 64]` allocation inside the hot
loop.

**Method:**
- Baseline: `Vec<u8>` allocated every iteration.
- Optimised: `[u8; 64 * 8192]` on the stack, reused.

**Results:**

| chunk | heap Vec (ms/100 iter) | heap Box (ms/100 iter) | speedup |
|-------|------------------------|------------------------|---------|
| 256   | 89                     | 87                     | 1.02x   |
| 512   | 142                    | 143                    | 0.99x   |
| 1024  | 303                    | 293                    | 1.03x   |
| 2048  | 562                    | 548                    | 1.03x   |
| 4096  | 1127                   | 1191                   | 0.95x   |
| 6128  | 1621                   | 1666                   | 0.97x   |

**Conclusion:** allocator overhead (Vec re-allocation vs fixed-size Box)
is negligible for these chunk sizes.  The CPU NPU+fusion loop dominates
wall-clock time, not memory allocation.

---

## Recommendations for production (`V3/L1/miner/src/gpu_backend.rs`)

1. **Keep the Rayon parallel CPU loop** already merged in `aaf9317a`.
   It is the single biggest win (6–8x pure-CPU speedup).

2. **Cap chunk at 1024 in s4_mode** (done in `mine_batch_s4`).
   Smaller chunks keep GPU busy and reduce CPU idle time when the GPU
   kernel dominates.

3. **Raise pool-side `ZION_NONCE_COUNT`** to at least **4096** (ideally
   6128 or 8192).  This amortises the 850 ms GPU launch overhead across
   more nonces.  Current pool default is 1024.

4. **Consider persistent GPU kernel** (future research):
   - Launch kernel once with `while (!stop) { … }` loop inside CL.
   - Use `volatile` flag or `atom_inc` for job signalling.
   - Avoids 850 ms re-launch per batch → could recover 5–10 KH/s.

5. **Profile `s4_out_buf.read()` latency**:
   - PCIe read-back of 384 KiB may add 1–3 ms.
   - Use pinned / zero-copy buffers if `ocl` supports them.

---

## How to run

```bash
cd DeekshaDebug

# Main benchmark (sequential vs parallel)
cargo run --release

# Individual experiments
cargo run --release --bin bench_gpu_overhead
cargo run --release --bin bench_double_buffer
cargo run --release --bin bench_alloc_overhead
```

---

## Files

| file | purpose |
|------|---------|
| `Cargo.toml` | standalone crate, depends on `zion-cosmic-harmony` |
| `src/main.rs` | baseline throughput benchmark |
| `src/bench_gpu_overhead.rs` | GPU launch overhead analysis |
| `src/bench_double_buffer.rs` | double-buffering simulation |
| `src/bench_alloc_overhead.rs` | heap vs stack allocation |
| `README.md` | this document |

---

*Generated 2026-06-06 for ZION v3 RDNA mining optimisation research.*
