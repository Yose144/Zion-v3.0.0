# Persistent GPU Kernel Design — ZION v3 s4-mode

**Status:** Research / Proof-of-Concept  
**Target:** AMD RDNA (gfx1010:xnack-) RX 5600 XT  
**Goal:** Eliminate ~850 ms `clEnqueueNDRangeKernel` launch overhead per batch.

---

## Problem

In s4-mode the current flow is:

```
CPU: write header + nonce_range to GPU buffers
CPU: clEnqueueNDRangeKernel(s4_kernel)
CPU: clFinish()  ← 850 ms wait (GPU launch overhead)
GPU: execute s4 kernel (stages 1-4)
CPU: read s4_out_buf
CPU: scan nonces with NPU+fusion (Rayon, ~15 ms for 4096)
CPU: if no solution → repeat
```

The 850 ms GPU launch dominates everything.  Even with Rayon parallel CPU
and 4096-nonces batches, effective hashrate is ~2.5 KH/s instead of the
potential 5–10 KH/s.

---

## Solution: Persistent Kernel

Launch the OpenCL kernel **once** and keep it resident on the GPU.
The kernel loops internally, reading job parameters from a shared
"command slot" and writing results to a "response slot".

```
CPU (once): clEnqueueNDRangeKernel(persistent_kernel, GLOBAL_SIZE)
CPU: clFlush()  ← returns immediately, GPU runs in background

Loop:
  CPU: write new job to command_slot
  CPU: spin/poll response_slot for result
  GPU (in kernel): read command_slot → execute s4 → write response_slot
  CPU: read winning nonce from response_slot
  CPU: if no solution in window → write next job, repeat
```

---

## OpenCL Data Structures

### Command Slot (CPU writes, GPU reads)

```c
struct __attribute__((packed)) S4Command {
    volatile uint  valid;      // 1 = new job ready, 0 = consumed
    uint           header_len; // ≤ 80
    uchar          header[80]; // mining header bytes
    ulong          nonce_base;
    uint           nonce_count;
};
```

### Response Slot (GPU writes, CPU reads)

```c
struct __attribute__((packed)) S4Response {
    volatile uint  ready;      // 1 = result available
    uint           winner_idx; // index within nonce_count (0xFFFFFFFF = none)
    uchar          winner_hash[32];
};
```

---

## Kernel Design

```c
__kernel void persistent_s4_kernel(
    __global S4Command  *cmd,
    __global S4Response *resp,
    __global uchar      *scratchpad_pool,
    __global uchar      *s4_out
) {
    uint tid = get_global_id(0);
    uint local_id = get_local_id(0);

    while (1) {
        // ── Wait for new command ──
        // Only work-item 0 polls; others barrier-wait.
        if (tid == 0) {
            while (cmd->valid == 0) {
                // AMD-specific: micro-sleep to avoid busy-spin storm
                // On some drivers this may need sleep(1) or mem_fence
            }
        }
        barrier(CLK_GLOBAL_MEM_FENCE);

        // Read command parameters (broadcast by WI 0)
        __local uint  l_header_len;
        __local ulong l_nonce_base;
        __local uint  l_nonce_count;
        __local uchar l_header[80];

        if (tid == 0) {
            l_header_len = cmd->header_len;
            l_nonce_base = cmd->nonce_base;
            l_nonce_count = cmd->nonce_count;
            for (int i = 0; i < 80; i++) l_header[i] = cmd->header[i];
            cmd->valid = 0;  // acknowledge consumption
        }
        barrier(CLK_LOCAL_MEM_FENCE);

        // ── Execute s4 for this work-item ──
        if (tid < l_nonce_count) {
            ulong nonce = l_nonce_base + (ulong)tid;
            __global uchar *pad = scratchpad_pool
                + (ulong)tid * (ulong)SCRATCHPAD_SIZE;

            uchar input[88];
            // ... build input from l_header + nonce ...

            // Stage 1: keccak256(header||nonce)
            // Stage 2: scratchpad_init
            // Stage 3: memory_hard_transform (4 passes)
            // Stage 4: s4_memhard (SHA3-512)

            // Write 64-byte s4 result to s4_out
            // (CPU will read back and do NPU+fusion)
        }

        // ── Signal completion ──
        barrier(CLK_GLOBAL_MEM_FENCE);
        if (tid == 0) {
            resp->ready = 1;
            resp->winner_idx = 0xFFFFFFFF;  // CPU will scan s4_out
        }
    }
}
```

---

## CPU Side (Rust pseudocode)

```rust
// Launch once — kernel stays resident
unsafe {
    persistent_kernel
        .cmd()
        .global_work_size(max_work_size)
        .local_work_size(local_ws)
        .enq()?;
}
// NOTE: intentionally NO clFinish() here — we want async execution

loop {
    // Write new job to command slot
    cmd_buf.write(&cmd_bytes).enq()?;
    queue.flush()?;  // non-blocking

    // Poll response slot (busy-spin or timeout-based)
    let mut resp = S4Response { ready: 0, .. };
    let deadline = Instant::now() + Duration::from_secs(5);
    while resp.ready == 0 && Instant::now() < deadline {
        resp_buf.read(&mut resp_bytes).enq()?;
        queue.finish()?;  // blocks until read completes
        // On AMD this may still take ~kernel-execution-time
    }

    // Read back all s4 results
    s4_out_buf.read(&mut s4_data).enq()?;
    queue.finish()?;

    // CPU: NPU + fusion (Rayon parallel)
    // ... same as current s4_mode ...
}
```

---

## Challenges & Risks

| Challenge | Mitigation |
|-----------|------------|
| **AMD driver watchdog** | Kernels running > 5s may be killed by TDR.  Keep `nonce_count` small enough that GPU execution finishes in < 2s. |
| **Busy-spin power** | Add `sleep(1)` or `mem_fence` in the polling loop; AMD OpenCL supports `__builtin_amdgcn_s_sleep`. |
| **`ocl` crate async** | `ocl` wraps `clEnqueueNDRangeKernel` + `clFinish`.  We need `clEnqueueNDRangeKernel` + `clFlush` only.  May need raw `cl3` or `opencl3` bindings. |
| **Buffer coherency** | `volatile` + `mem_fence` may not be enough across PCIe.  Consider `clEnqueueMapBuffer` for zero-copy. |
| **GPU crash recovery** | If kernel is killed, miner must detect and re-launch.  Add a watchdog thread. |
| **Work-item divergence** | `if (tid == 0)` polls while others wait at barrier — standard pattern, well-supported. |

---

## Expected Gain

With persistent kernel, per-batch time drops from:

```
850 ms (launch) + 400 ms (GPU work 4096 nonces) + 15 ms (CPU scan)
= ~1265 ms  →  3.2 KH/s effective
```

To:

```
0 ms (launch, already resident) + 400 ms (GPU work) + 15 ms (CPU scan)
= ~415 ms  →  9.9 KH/s effective
```

**This recovers the historical 5–10 KH/s range.**

---

## Next Steps

1. **Prototype CL kernel** in `DeekshaDebug/kernels/persistent_s4.cl`
2. **Raw OpenCL host code** using `opencl3` crate (bypass `ocl` for async)
3. **Test on RX 5600 XT** — verify no TDR kill, measure real overhead
4. **Integrate into `gpu_backend.rs`** behind a feature flag `persistent-kernel`

---

*Document version 0.1 — 2026-06-06*
