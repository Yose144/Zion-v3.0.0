/*
 * ZION v3 — Persistent s4 Kernel Prototype
 *
 * Launch once, poll job slot, execute stages 1-4, signal completion.
 *
 * This is a RESEARCH prototype, not production-ready.
 * Known issues: watchdog timeout, memory fence coherency,
 *               raw OpenCL host bindings required.
 */

#ifndef SCRATCHPAD_SIZE
#define SCRATCHPAD_SIZE 262144
#endif

#ifndef WGS
#define WGS 256
#endif

/* ── Shared command / response structures ─────────────────────────────── */

typedef struct {
    volatile uint  valid;       // CPU sets 1 → GPU clears 0
    uint           header_len;
    uchar          header[80];
    ulong          nonce_base;
    uint           nonce_count;
} S4Command;

typedef struct {
    volatile uint  ready;       // GPU sets 1 → CPU clears 0
    uint           winner_idx;    // 0xFFFFFFFF = none found by GPU
    uchar          winner_hash[32];
} S4Response;

/* ── Minimal keccak256 (for header||nonce hash) ───────────────────────── */
/* ... same as cosmic_harmony_deeksha.cl ... */

/* ── Memory-hard transform helpers ──────────────────────────────────── */
/* ... same as cosmic_harmony_deeksha.cl ... */

/* ── s4_memhard (SHA3-512) ───────────────────────────────────────────── */
/* ... same as cosmic_harmony_deeksha.cl ... */

/* ── Persistent s4 kernel ────────────────────────────────────────────── */
__kernel void persistent_s4(
    __global S4Command  *cmd,
    __global S4Response *resp,
    __global uchar      *scratchpad_pool,
    __global uchar      *s4_out,          /* chunk * 64 bytes */
    uint                 max_work_size
) {
    uint tid = get_global_id(0);

    while (1) {
        /* ── 1. Wait for command ── */
        if (tid == 0) {
            /* Poll until CPU posts a new job.
             * AMD RDNA: s_sleep(1) avoids busy-spin storm (~0.1 us). */
            while (cmd->valid == 0) {
                #ifdef __AMDGCN__
                __builtin_amdgcn_s_sleep(1);
                #endif
                mem_fence(CLK_GLOBAL_MEM_FENCE);
            }
        }
        barrier(CLK_GLOBAL_MEM_FENCE);

        /* Broadcast command to local memory (WI 0 copies) */
        __local uint  l_header_len;
        __local ulong l_nonce_base;
        __local uint  l_nonce_count;
        __local uchar l_header[80];

        if (tid == 0) {
            l_header_len  = cmd->header_len;
            l_nonce_base  = cmd->nonce_base;
            l_nonce_count = cmd->nonce_count;
            for (int i = 0; i < 80; i++) l_header[i] = cmd->header[i];
            cmd->valid = 0;   /* acknowledge */
        }
        barrier(CLK_LOCAL_MEM_FENCE);

        /* ── 2. Execute s4 for this WI ── */
        if (tid < l_nonce_count) {
            ulong nonce = l_nonce_base + (ulong)tid;
            __global uchar *pad = scratchpad_pool
                + (ulong)tid * (ulong)SCRATCHPAD_SIZE;

            /* Build input: header (≤80 B) + nonce (8 B LE) */
            uchar input[88];
            for (int i = 0; i < 88; i++) input[i] = 0;
            for (int i = 0; i < (int)l_header_len; i++) input[i] = l_header[i];
            for (int i = 0; i < 8; i++) {
                input[l_header_len + i] = (uchar)(nonce >> (i * 8));
            }

            /* Stage 1: keccak-256(input) */
            uchar stage1[32];
            keccak256(input, l_header_len + 8, stage1);

            /* Stage 2: init scratchpad */
            for (int i = 0; i < SCRATCHPAD_SIZE; i++) pad[i] = 0;
            scratchpad_init(stage1, pad);

            /* Stage 3: memory-hard transform (4 passes) */
            memory_hard_transform(pad);

            /* Stage 4: s4_memhard → 64-byte output */
            uchar s4_result[64];
            s4_memhard(pad, s4_result);

            /* Write to s4_out */
            __global uchar *out = s4_out + tid * 64;
            for (int i = 0; i < 64; i++) out[i] = s4_result[i];
        }

        /* ── 3. Signal completion ── */
        barrier(CLK_GLOBAL_MEM_FENCE);
        if (tid == 0) {
            resp->ready      = 1;
            resp->winner_idx = 0xFFFFFFFF;  /* CPU does NPU+fusion+target */
        }

        /* ── 4. Wait until CPU consumes response ── */
        if (tid == 0) {
            while (resp->ready == 1) {
                #ifdef __AMDGCN__
                __builtin_amdgcn_s_sleep(1);
                #endif
                mem_fence(CLK_GLOBAL_MEM_FENCE);
            }
        }
        barrier(CLK_GLOBAL_MEM_FENCE);
    }
}
