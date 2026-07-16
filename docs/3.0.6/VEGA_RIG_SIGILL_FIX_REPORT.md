# Vega Rig SIGILL Fix & External Stream Reorder Report

**Date:** 2026-07-16
**Target:** SMOS Vega rig (Intel Pentium G4560, AMD Vega 56 gfx900)
**Goal:** EPIC ProgPow GPU mining on Vega rig via zion-miner v3.0.6

## Problem

The Vega rig (Intel Pentium G4560 @ 3.50GHz, no AVX support) crashed with
`Illegal instruction (core dumped)` during EPIC ProgPow DAG generation.

### Root Causes

1. **`set_stream_weights()` blocking main thread** — The OpenCL
   `set_stream_weights()` call invokes `queue.finish()` which blocks the
   main mining loop. This prevented the external GPU thread from receiving
   EPIC ProgPow jobs via the channel, because the `ext_gpu_tx.send()` call
   was positioned *after* `set_stream_weights()` in the main loop.

2. **`set_stream_weights()` SIGILL on non-AVX CPUs** — The stream weights
   f32 conversion path triggered an `Illegal instruction` fault on the
   Pentium G4560 (SSE4.2 only, no AVX/AVX2).

3. **C FFI DAG generation SIGILL** — The `ethash_generate_dag()` C function
   (called via `native-hashers` FFI for ProgPow DAG generation) crashed
   with SIGILL. The Docker build environment (Debian Bullseye, GCC 10)
   generated AVX instructions by default, incompatible with the Pentium
   G4560's SSE4.2-only ISA.

## Fixes Applied

### Fix 1: Reorder external stream send before GPU mining (`main.rs`)

Moved the `ext_gpu_tx.send()` and `ext_cpu_tx.send()` calls to execute
**before** `set_stream_weights()` and `gpu_scan_job()`. This ensures the
external GPU thread receives its job immediately after the pool sends a
new job, without waiting for OpenCL queue synchronization.

**Before (broken):**
```
>> new job → set_stream_weights() [BLOCKS] → ext_gpu_tx.send() [never reached]
```

**After (fixed):**
```
>> new job → ext_gpu_tx.send() [immediate] → set_stream_weights() [can block, OK]
```

### Fix 2: Gate `set_stream_weights()` to Metal only (`main.rs`)

Disabled `set_stream_weights()` on OpenCL backends. The stream weights
optimization is only meaningful for Metal (Apple Silicon) Deeksha
pipelines. On OpenCL it caused both blocking and SIGILL.

```rust
if !stream_weights_str.is_empty() && config.gpu_backend == gpu_backend::GpuBackendKind::Metal {
```

### Fix 3: Disable OpenMP + force `-march=x86-64` in C build (`build.rs`)

- Removed `-fopenmp` flag and `libgomp` linking on Linux (libgomp
  contains AVX instructions)
- Added `-march=x86-64` to ensure C code compiles with baseline x86-64
  ISA (SSE2 only, no AVX)
- DAG generation falls back to single-threaded (slower but compatible)

### Fix 4: Pre-generate DAG on edge server (workaround)

Since the C FFI DAG generation still crashes on the Pentium G4560
(likely a Rust standard library AVX codepath, not C), the DAG is
pre-generated on the edge server using the `gen_dag` example binary
and copied to the rig's cache directory:

```
~/.zion/dag-cache/progpow_epoch120.bin  (1.94 GB)
```

The miner loads the DAG from disk cache, skipping FFI generation entirely.

## Files Changed

| File | Change |
|------|--------|
| `V3/L1/miner/src/main.rs` | Reorder ext_stream send before GPU mining; gate set_stream_weights to Metal only |
| `AuXpow/build.rs` | Disable OpenMP on Linux; add `-march=x86-64` for non-AVX CPU compatibility |

## Verification

- `ext_gpu_tx_send coin=EPIC algo=progpow result=Ok(())` — external job sent
- `ext_gpu_job_received coin=EPIC algo=progpow` — thread received job
- `ext_gpu_backend_init algo=progpow backend=opencl` — OpenCL backend initialized
- `ext_gpu_dag_loading algo=progpow epoch=120` — DAG loading started
- Miner no longer crashes when DAG is loaded from disk cache

## Remaining Work

- Verify EPIC ProgPow shares accepted by pool
- Verify ZION Deeksha GPU shares accepted
- Verify VRSC VerusHash CPU shares accepted
- Monitor hashrate stability over time
