// ProgPow / ProgPoWZ (Zano) CUDA kernel -- ported from OpenCL.
//
// ProgPow v0.9.2/0.9.3 with Zano/EPIC parameters:
//   PROGPOW_PERIOD = 50, PROGPOW_CNT_CACHE = 12, PROGPOW_CNT_MATH = 20
//   PROGPOW_LANES = 16, PROGPOW_REGS = 32, PROGPOW_DAG_LOADS = 4
//   ETHASH_DATASET_PARENTS = 256
//
// The random math + data load code is generated at compile time by the
// host-side codegen (AuXpow/src/progpow_codegen.rs) and injected via
// placeholder tokens in the kernel body.  The codegen produces
// backend-agnostic C code using mul_hi(), clz(), popcount(), ROTL32(),
// ROTR32() — all mapped to CUDA intrinsics below.
//
// References:
//   - OpenCL source: AuXpow/csrc/opencl/progpow_kernel.cl
//   - Codegen: AuXpow/src/progpow_codegen.rs (gen_zano_progpow_random_math)
//   - https://github.com/ifdefelse/ProgPOW (original ProgPoW)
//   - https://github.com/hyle-team/progminer (Zano fork)

#pragma once

#include <cuda_runtime.h>
#include <stdint.h>

// ── ProgPow constants ───────────────────────────────────────────────
#ifndef PROGPOW_LANES
#define PROGPOW_LANES           16
#endif
#ifndef PROGPOW_REGS
#define PROGPOW_REGS            32
#endif
#ifndef PROGPOW_DAG_LOADS
#define PROGPOW_DAG_LOADS       4
#endif
#ifndef PROGPOW_CACHE_BYTES
#define PROGPOW_CACHE_BYTES     (16*1024)
#endif
#define PROGPOW_CACHE_WORDS     (PROGPOW_CACHE_BYTES / 4)
#ifndef PROGPOW_CNT_DAG
#define PROGPOW_CNT_DAG         64
#endif
#ifndef PROGPOW_CNT_CACHE
#define PROGPOW_CNT_CACHE       12
#endif
#ifndef PROGPOW_CNT_MATH
#define PROGPOW_CNT_MATH        20
#endif
#ifndef PROGPOW_PERIOD
#define PROGPOW_PERIOD          50
#endif
#define ETHASH_DATASET_PARENTS  256

#ifndef GROUP_SIZE
#define GROUP_SIZE 256
#endif
#define HASHES_PER_GROUP (GROUP_SIZE / PROGPOW_LANES)

#ifndef MAX_OUTPUTS
#define MAX_OUTPUTS 63U
#endif

// PROGPOW_DAG_ELEMENTS must be defined via -D at compile time.
// It equals (dag_entries_128byte / 2) where dag_entries_128byte is the
// number of 128-byte DAG entries.  See gpu_miner.rs comment.
#ifndef PROGPOW_DAG_ELEMENTS
#define PROGPOW_DAG_ELEMENTS 1
#endif

// ── CUDA intrinsics mapping for codegen compatibility ───────────────
// The codegen produces: mul_hi(), clz(), popcount(), ROTL32(), ROTR32()
// Manual (x<<n)|(x>>32-n) rotation matches the OpenCL/CPU reference and
// avoids any NVRTC/PTX shf semantic ambiguity.  The codegen already masks
// variable counts with % 32 for Zano, so counts are always in [0,31].
#define mul_hi(a, b)    ((uint32_t)(((uint64_t)(a) * (uint64_t)(b)) >> 32))
#define clz(x)          __clz((x))
#define popcount(x)     __popc((x))
__device__ __forceinline__ uint32_t rotl32_impl(uint32_t x, uint32_t n) {
    n &= 31;
    return (n == 0) ? x : ((x << n) | (x >> (32 - n)));
}
__device__ __forceinline__ uint32_t rotr32_impl(uint32_t x, uint32_t n) {
    n &= 31;
    return (n == 0) ? x : ((x >> n) | (x << (32 - n)));
}
#define ROTL32(x, n)    rotl32_impl((x), (n))
#define ROTR32(x, n)    rotr32_impl((x), (n))

// ── Type definitions ────────────────────────────────────────────────
typedef struct { uint32_t s[PROGPOW_DAG_LOADS]; } dag_t;

typedef struct {
    uint32_t uint32s[32 / sizeof(uint32_t)];
} hash32_t;

typedef struct {
    uint32_t uint32s[PROGPOW_LANES];
    uint64_t uint64s[PROGPOW_LANES / 2];
} shuffle_t;

// ── Keccak-f[800] (32-bit state) ────────────────────────────────────
// 800-bit state = 25 × uint32.  22 rounds (not 24 — last round simplified).
// Only need 64 bits of output for mining.

__constant__ const uint32_t keccakf_rndc[24] = {
    0x00000001, 0x00008082, 0x0000808a, 0x80008000, 0x0000808b, 0x80000001,
    0x80008081, 0x00008009, 0x0000008a, 0x00000088, 0x80008009, 0x8000000a,
    0x8000808b, 0x0000008b, 0x00008089, 0x00008003, 0x00008002, 0x00000080,
    0x0000800a, 0x8000000a, 0x80008081, 0x00008080, 0x80000001, 0x80008008
};

__device__ __forceinline__ void keccak_f800_round(uint32_t st[25], const int r)
{
    const uint32_t keccakf_rotc[24] = {
        1,  3,  6,  10, 15, 21, 28, 36, 45, 55, 2,  14,
        27, 41, 56, 8,  25, 43, 62, 18, 39, 61, 20, 44
    };
    const uint32_t keccakf_piln[24] = {
        10, 7,  11, 17, 18, 3, 5,  16, 8,  21, 24, 4,
        15, 23, 19, 13, 12, 2, 20, 14, 22, 9,  6,  1
    };

    uint32_t t, bc[5];
    // Theta
    #pragma unroll
    for (int i = 0; i < 5; i++)
        bc[i] = st[i] ^ st[i + 5] ^ st[i + 10] ^ st[i + 15] ^ st[i + 20];

    #pragma unroll
    for (int i = 0; i < 5; i++) {
        t = bc[(i + 4) % 5] ^ ROTL32(bc[(i + 1) % 5], 1u);
        for (uint32_t j = 0; j < 25; j += 5)
            st[j + i] ^= t;
    }

    // Rho Pi
    t = st[1];
    #pragma unroll
    for (int i = 0; i < 24; i++) {
        uint32_t j = keccakf_piln[i];
        bc[0] = st[j];
        st[j] = ROTL32(t, keccakf_rotc[i]);
        t = bc[0];
    }

    //  Chi
    #pragma unroll
    for (uint32_t j = 0; j < 25; j += 5) {
        #pragma unroll
        for (int i = 0; i < 5; i++)
            bc[i] = st[j + i];
        #pragma unroll
        for (int i = 0; i < 5; i++)
            st[j + i] ^= (~bc[(i + 1) % 5]) & bc[(i + 2) % 5];
    }

    //  Iota
    st[0] ^= keccakf_rndc[r];
}

// Keccak-f800 for mining: 800-bit state, bitrate 576, no padding.
// Input: 32-byte header (8 uint32) + 8-byte seed (nonce) + 32-byte digest (8 uint32)
// Output: 64-bit result (byte-reversed for big-endian comparison)
__device__ __forceinline__ uint64_t keccak_f800(
    const uint32_t g_header[8],
    uint64_t seed,
    const uint32_t digest[8])
{
    uint32_t st[25];
    #pragma unroll
    for (int i = 0; i < 25; i++)
        st[i] = 0;
    #pragma unroll
    for (int i = 0; i < 8; i++)
        st[i] = g_header[i];
    st[8] = (uint32_t)seed;
    st[9] = (uint32_t)(seed >> 32);
    #pragma unroll
    for (int i = 0; i < 8; i++)
        st[10 + i] = digest[i];

    #pragma unroll
    for (int r = 0; r < 22; r++) {
        keccak_f800_round(st, r);
    }

    // Byte-reverse 64-bit result (matches OpenCL as_ulong(as_uchar8(res).s76543210))
    // Manual byte swap — __byte_perm(x, 0, 0x0123) has a compiler optimization
    // bug on sm_61 with NVRTC that returns 0 when the second argument is 0.
    uint32_t lo = ((st[1] & 0xFFu) << 24) | ((st[1] & 0xFF00u) << 8) |
                  ((st[1] & 0xFF0000u) >> 8) | ((st[1] & 0xFF000000u) >> 24);
    uint32_t hi = ((st[0] & 0xFFu) << 24) | ((st[0] & 0xFF00u) << 8) |
                  ((st[0] & 0xFF0000u) >> 8) | ((st[0] & 0xFF000000u) >> 24);
    return ((uint64_t)hi << 32) | lo;
}

// ── FNV-1a ──────────────────────────────────────────────────────────
#define fnv1a(h, d) (h = (h ^ d) * 0x1000193)

// ── KISS99 RNG ──────────────────────────────────────────────────────
typedef struct {
    uint32_t z, w, jsr, jcong;
} kiss99_t;

__device__ __forceinline__ uint32_t kiss99(kiss99_t *st)
{
    st->z = 36969 * (st->z & 65535) + (st->z >> 16);
    st->w = 18000 * (st->w & 65535) + (st->w >> 16);
    uint32_t MWC = ((st->z << 16) + st->w);
    st->jsr ^= (st->jsr << 17);
    st->jsr ^= (st->jsr >> 13);
    st->jsr ^= (st->jsr << 5);
    st->jcong = 69069 * st->jcong + 1234567;
    return ((MWC ^ st->jcong) + st->jsr);
}

__device__ __forceinline__ void fill_mix(
    uint64_t seed, uint32_t lane_id, uint32_t mix[PROGPOW_REGS])
{
    uint32_t fnv_hash = 0x811c9dc5;
    kiss99_t st;
    // Match the OpenCL/reference behaviour: use the full 64-bit seed in the
    // FNV-1a steps; the macro result is assigned back to a uint32_t, so it
    // naturally truncates to the low 32 bits.  Casting to uint32_t first would
    // perform the multiplication in 32-bit and lose the high-seed influence.
    fnv1a(fnv_hash, seed);                 st.z = fnv_hash;
    fnv1a(fnv_hash, seed >> 32);           st.w = fnv_hash;
    fnv1a(fnv_hash, lane_id);              st.jsr = fnv_hash;
    fnv1a(fnv_hash, lane_id);              st.jcong = fnv_hash;
    #pragma unroll
    for (int i = 0; i < PROGPOW_REGS; i++)
        mix[i] = kiss99(&st);
}

// ── Mining kernel ───────────────────────────────────────────────────
//
// Kernel arguments:
//   g_output     -- output slot array (g_output[0] = count, [1+] = gids)
//   g_header     -- 32-byte block header hash (8 × uint32)
//   g_dag        -- DAG buffer stored as uint64_t, reinterpreted as uint32_t.
//                   Each 128-byte DAG entry = 8 u64 = 16 uint32 = 4 dag_t.
//                   PROGPOW_DAG_ELEMENTS = (dag_entries_128byte / 2).
//   start_nonce  -- first nonce in this batch
//   target       -- 64-bit target (big-endian comparison via keccak output)
//   hack_false   -- compiler reorder barrier (always 0, prevents LD reordering)
//   output_nonce -- single u64, written when a solution is found
//   output_mix   -- 32-byte mix hash (digest) for share submission
//   found        -- atomic flag: 0 = not found, 1 = found
//
// Thread layout:
//   blockDim.x = GROUP_SIZE (256)
//   Each hash uses PROGPOW_LANES (16) threads.
//   HASHES_PER_GROUP = GROUP_SIZE / PROGPOW_LANES = 16 hashes per block.
//   lane_id = threadIdx.x & 15
//   group_id = threadIdx.x / 16
//
// Lane communication:
//   NVIDIA warp = 32 threads = 2 hash groups.  We use shared memory +
//   __syncthreads() for inter-lane communication (same as the OpenCL
//   non-AMD fallback path).  __shfl_sync cannot do per-group broadcast
//   when 2 groups share a warp.
extern "C" {

__global__ __launch_bounds__(256) void progpow_mine(
    unsigned int *g_output,
    const unsigned char *g_header,  // 32-byte header hash
    const uint64_t *g_dag_u64,      // DAG as u64 buffer
    uint64_t start_nonce,
    uint64_t target,
    uint32_t hack_false,
    uint64_t *output_nonce,
    unsigned char *output_mix,      // 32-byte mix hash
    unsigned int *found
)
{
    __shared__ shuffle_t share[HASHES_PER_GROUP];
    __shared__ uint32_t c_dag[PROGPOW_CACHE_WORDS];

    const uint32_t lid = threadIdx.x;
    const uint32_t gid = blockIdx.x * blockDim.x + threadIdx.x;
    const uint64_t nonce = start_nonce + (uint64_t)gid;

    const uint32_t lane_id = lid & (PROGPOW_LANES - 1);
    const uint32_t group_id = lid / PROGPOW_LANES;

    // Reinterpret DAG as uint32_t (4 bytes per element, 4 per dag_t)
    const uint32_t *g_dag = (const uint32_t *)g_dag_u64;

    // Convert 32-byte header to 8 uint32 (little-endian, matching OpenCL)
    uint32_t header_u32[8];
    #pragma unroll
    for (int i = 0; i < 8; i++)
        header_u32[i] = (uint32_t)g_header[i * 4]
                      | ((uint32_t)g_header[i * 4 + 1] << 8)
                      | ((uint32_t)g_header[i * 4 + 2] << 16)
                      | ((uint32_t)g_header[i * 4 + 3] << 24);

    // Load the first portion of the DAG into the shared cache
    for (uint32_t word = lid * PROGPOW_DAG_LOADS; word < PROGPOW_CACHE_WORDS;
         word += GROUP_SIZE * PROGPOW_DAG_LOADS)
    {
        dag_t load;
        #pragma unroll
        for (int i = 0; i < PROGPOW_DAG_LOADS; i++)
            load.s[i] = g_dag[word + i];
        #pragma unroll
        for (int i = 0; i < PROGPOW_DAG_LOADS; i++)
            c_dag[word + i] = load.s[i];
    }

    // keccak(header .. nonce) → seed
    uint32_t digest[8];
    #pragma unroll
    for (int i = 0; i < 8; i++)
        digest[i] = 0;
    uint64_t seed = keccak_f800(header_u32, nonce, digest);
    uint64_t initial_seed = seed;  // Debug: save seed before ProgPoW loop

    __syncthreads();

    // Main ProgPoW loop: iterate over all lanes (broadcast seed from each)
    #pragma unroll 1
    for (uint32_t h = 0; h < PROGPOW_LANES; h++)
    {
        uint32_t mix[PROGPOW_REGS];

        // Broadcast seed from lane h to all lanes in the hash group.
        // Using shared memory + __syncthreads() (non-AMD fallback path).
        if (lane_id == h)
            share[group_id].uint64s[0] = seed;
        __syncthreads();
        uint64_t hash_seed = share[group_id].uint64s[0];

        // Initialize mix for all lanes
        fill_mix(hash_seed, lane_id, mix);

        // DAG loop — 64 iterations
        #pragma unroll 1
        for (uint32_t l = 0; l < PROGPOW_CNT_DAG; l++)
        {
            // Broadcast mix[0] from lane (l % PROGPOW_LANES) to all lanes
            uint32_t offset;
            if (lane_id == (l % PROGPOW_LANES))
                share[group_id].uint64s[0] = mix[0];
            __syncthreads();
            offset = (uint32_t)share[group_id].uint64s[0];

            offset %= PROGPOW_DAG_ELEMENTS;
            offset = offset * PROGPOW_LANES + (lane_id ^ l) % PROGPOW_LANES;

            // Load dag_t (4 × uint32 = 16 bytes) from global DAG
            dag_t data_dag;
            #pragma unroll
            for (int i = 0; i < PROGPOW_DAG_LOADS; i++)
                data_dag.s[i] = g_dag[offset * PROGPOW_DAG_LOADS + i];

            // hack to prevent compiler from reordering LD and usage
            if (hack_false) __syncthreads();

            uint32_t data;
            PROGPOW_INCLUDE_RANDOM_MATH

            // hack to prevent compiler from reordering LD and usage
            if (hack_false) __syncthreads();

            PROGPOW_INCLUDE_DATA_LOADS
        }

        // Reduce mix data to a per-lane 32-bit digest
        uint32_t mix_hash = 0x811c9dc5;
        #pragma unroll
        for (int i = 0; i < PROGPOW_REGS; i++)
        {
            fnv1a(mix_hash, mix[i]);
        }

        // Reduce all lanes to a single 256-bit digest
        uint32_t digest_temp[8];
        #pragma unroll
        for (int i = 0; i < 8; i++)
            digest_temp[i] = 0x811c9dc5;

        // Write mix_hash to shared memory, then read all lanes' values
        share[group_id].uint32s[lane_id] = mix_hash;
        __syncthreads();
        #pragma unroll
        for (int i = 0; i < PROGPOW_LANES; i++)
        {
            fnv1a(digest_temp[i % 8], share[group_id].uint32s[i]);
        }

        if (h == lane_id)
        {
            #pragma unroll
            for (int i = 0; i < 8; i++)
                digest[i] = digest_temp[i];
        }
    }

    // Final hash: keccak(header .. seed .. digest) and compare to target
    uint64_t final_hash = keccak_f800(header_u32, seed, digest);
    if (final_hash <= target)
    {
        unsigned int old = atomicExch(found, 1u);
        if (old == 0u) {
            *output_nonce = nonce;
            // Write mix hash (digest) as 32 bytes little-endian
            #pragma unroll
            for (int i = 0; i < 8; i++) {
                output_mix[i * 4]     = (unsigned char)(digest[i]);
                output_mix[i * 4 + 1] = (unsigned char)(digest[i] >> 8);
                output_mix[i * 4 + 2] = (unsigned char)(digest[i] >> 16);
                output_mix[i * 4 + 3] = (unsigned char)(digest[i] >> 24);
            }
            // Debug: write seed and final hash from the found thread only
            g_output[10] = (unsigned int)seed;
            g_output[11] = (unsigned int)(seed >> 32);
            g_output[12] = (unsigned int)final_hash;
            g_output[13] = (unsigned int)(final_hash >> 32);
            g_output[14] = (unsigned int)initial_seed;
            g_output[15] = (unsigned int)(initial_seed >> 32);
            g_output[16] = header_u32[0];
            g_output[17] = header_u32[1];
        }
        // Also write to g_output for compatibility
        unsigned int slot = atomicAdd(&g_output[0], 1u) + 1;
        if (slot < (MAX_OUTPUTS + 1)) {
            g_output[slot] = gid;
            g_output[2] = digest[0];
            g_output[3] = digest[1];
            g_output[4] = digest[2];
            g_output[5] = digest[3];
            g_output[6] = digest[4];
            g_output[7] = digest[5];
            g_output[8] = digest[6];
            g_output[9] = digest[7];
        }
    }
}

} // extern "C"
