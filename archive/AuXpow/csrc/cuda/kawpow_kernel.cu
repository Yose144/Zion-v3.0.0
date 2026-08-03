// KawPow (RVN/CLORE/EVR/MEWC) CUDA kernel — REAL implementation from xmrig.
//
// Implements the full ProgPow/KawPow algorithm with:
//   - keccak_f800 (32-bit words, 800-bit state, 22 rounds)
//   - KISS99 RNG for random math sequence (changes every PERIOD blocks)
//   - "RAVENCOINKAWPOW" constant in keccak state
//   - Raw 40-byte job_blob input (NOT pre-hashed)
//   - Full ProgPow mix loop with cache accesses + random math + DAG loads
//
// The random math code is generated at compile time by the host-side
// random math generator (AuXpow/src/progpow_codegen.rs) and injected
// via the XMRIG_INCLUDE tags below.
//
// References:
//   - https://github.com/xmrig/xmrig-cuda (src/KawPow/raven/KawPow.h)
//   - OpenCL source: AuXpow/csrc/opencl/kawpow_kernel.cl
//   - Codegen: AuXpow/src/progpow_codegen.rs

#pragma once

#include <cuda_runtime.h>
#include <stdint.h>

// ── KawPow constants ───────────────────────────────────────────────
#ifndef PROGPOW_LANES
#define PROGPOW_LANES           16
#endif
#ifndef PROGPOW_REGS
#define PROGPOW_REGS            32
#endif
#ifndef PROGPOW_DAG_LOADS
#define PROGPOW_DAG_LOADS       4
#endif
#define PROGPOW_CACHE_WORDS     4096
#ifndef PROGPOW_CNT_DAG
#define PROGPOW_CNT_DAG         64
#endif
#ifndef PROGPOW_CNT_CACHE
#define PROGPOW_CNT_CACHE       11
#endif
#ifndef PROGPOW_CNT_MATH
#define PROGPOW_CNT_MATH        18
#endif

#ifndef GROUP_SIZE
#define GROUP_SIZE              128
#endif
#define HASHES_PER_GROUP        (GROUP_SIZE / PROGPOW_LANES)

#define FNV_PRIME               0x1000193
#define FNV_OFFSET_BASIS        0x811c9dc5

// ── Helper macros ──────────────────────────────────────────────────
#if __CUDA_ARCH__ < 350
    #define ROTL32(x,n) (((x) << (n % 32)) | ((x) >> (32 - (n % 32))))
    #define ROTR32(x,n) (((x) >> (n % 32)) | ((x) << (32 - (n % 32))))
#else
    #define ROTL32(x,n) __funnelshift_l((x), (x), (n))
    #define ROTR32(x,n) __funnelshift_r((x), (x), (n))
#endif

#define min(a,b)     ((a<b) ? a : b)
#define mul_hi(a, b) __umulhi(a, b)
#define clz(a)       __clz(a)
#define popcount(a)  __popc(a)

#define DEV_INLINE __device__ __forceinline__

#if (__CUDACC_VER_MAJOR__ > 8)
    #define SHFL(x, y, z) __shfl_sync(0xFFFFFFFF, (x), (y), (z))
#else
    #define SHFL(x, y, z) __shfl((x), (y), (z))
#endif

// ── DAG type ───────────────────────────────────────────────────────
typedef struct __align__(16) {uint32_t s[PROGPOW_DAG_LOADS];} dag_t;

typedef struct {
    uint32_t uint32s[32 / sizeof(uint32_t)];
} hash32_t;

// ── Keccak-f[800] round constants (32-bit) ─────────────────────────
__device__ __constant__ const uint32_t keccakf_rndc[24] = {
    0x00000001, 0x00008082, 0x0000808a, 0x80008000, 0x0000808b, 0x80000001,
    0x80008081, 0x00008009, 0x0000008a, 0x00000088, 0x80008009, 0x8000000a,
    0x8000808b, 0x0000008b, 0x00008089, 0x00008003, 0x00008002, 0x00000080,
    0x0000800a, 0x8000000a, 0x80008081, 0x00008080, 0x80000001, 0x80008008
};

// ── Ravencoin "RAVENCOINKAWPOW" constant ───────────────────────────
__device__ __constant__ const uint32_t ravencoin_rndc[15] = {
    0x00000072, //R
    0x00000041, //A
    0x00000056, //V
    0x00000045, //E
    0x0000004E, //N
    0x00000043, //C
    0x0000004F, //O
    0x00000049, //I
    0x0000004E, //N
    0x0000004B, //K
    0x00000041, //A
    0x00000057, //W
    0x00000050, //P
    0x0000004F, //O
    0x00000057, //W
};

// ── Keccak-f[800] round (width 800, 25 × uint32 state) ────────────
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

// Keccak-f800: 800-bit state, bitrate 576, capacity 224, no padding.
// 22 rounds (last 2 rounds omitted — only need 64 bits of output).
__device__ __forceinline__ void keccak_f800(uint32_t st[25])
{
    #pragma unroll
    for (int r = 0; r < 22; r++) {
        keccak_f800_round(st, r);
    }
}

// ── FNV-1a ──────────────────────────────────────────────────────────
#define fnv1a(h, d) (h = (h ^ d) * FNV_PRIME)

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

// ── fill_mix: expand per-warp seed to per-lane mix ─────────────────
__device__ __forceinline__ void fill_mix(
    uint32_t* hash_seed, uint32_t lane_id, uint32_t* mix)
{
    uint32_t fnv_hash = FNV_OFFSET_BASIS;
    kiss99_t st;
    st.z = fnv1a(fnv_hash, hash_seed[0]);
    st.w = fnv1a(fnv_hash, hash_seed[1]);
    st.jsr = fnv1a(fnv_hash, lane_id);
    st.jcong = fnv1a(fnv_hash, lane_id);
    #pragma unroll
    for (int i = 0; i < PROGPOW_REGS; i++)
        mix[i] = kiss99(&st);
}

// ── Shuffle helper for inter-lane communication ────────────────────
typedef struct {
    uint32_t uint32s[PROGPOW_LANES];
} shuffle_t;

// ── Byte swap (avoid __byte_perm bug on sm_61) ─────────────────────
__device__ __forceinline__ uint32_t cuda_swab32(uint32_t x)
{
    return ((x & 0x000000FFu) << 24) |
           ((x & 0x0000FF00u) << 8)  |
           ((x & 0x00FF0000u) >> 8)  |
           ((x & 0xFF000000u) >> 24);
}

// ── ProgPow loop (one iteration) ───────────────────────────────────
// The random math + data loads are injected via XMRIG_INCLUDE tags.
DEV_INLINE void progPowLoop(
    const uint32_t loop,
    uint32_t mix[PROGPOW_REGS],
    const dag_t *g_dag,
    const uint32_t c_dag[PROGPOW_CACHE_WORDS],
    const uint32_t hack_false)
{
    dag_t data_dag;
    uint32_t offset, data;
    const uint32_t lane_id = threadIdx.x & (PROGPOW_LANES - 1);

    // global load
    offset = SHFL(mix[0], loop % PROGPOW_LANES, PROGPOW_LANES);
    XMRIG_INCLUDE_OFFSET_MOD_DAG_ELEMENTS
    offset = offset * PROGPOW_LANES + (lane_id ^ loop) % PROGPOW_LANES;
    data_dag = g_dag[offset];

    // hack to prevent compiler from reordering LD and usage
    if (hack_false) __threadfence_block();

    XMRIG_INCLUDE_PROGPOW_RANDOM_MATH

    // consume global load data
    // hack to prevent compiler from reordering LD and usage
    if (hack_false) __threadfence_block();

    XMRIG_INCLUDE_PROGPOW_DATA_LOADS
}

// ── Main kernel: progpow_search ────────────────────────────────────
// KawPow takes a raw 40-byte job_blob (10 uint32) and uses keccak_f800
// with "RAVENCOINKAWPOW" constant. The kernel overwrites job_blob[8]
// (uint32 at offset 32) with gid (the nonce).
extern "C" {

__global__ XMRIG_INCLUDE_LAUNCH_BOUNDS void progpow_search(
    const uint64_t *g_dag_u64,       // 0: DAG buffer (as u64, reinterpreted as dag_t inside)
    const uint32_t* job_blob,        // 1: 40-byte job blob (10 uint32)
    const uint64_t target,           // 2: u64 target (big-endian)
    uint32_t hack_false,             // 3: always false (u32 for cudarc compatibility)
    uint32_t* results,               // 4: results buffer (16 uint32)
    uint32_t* stop,                  // 5: stop flag (2 uint32)
    // ZION extensions:
    uint64_t* output_nonce,          // 6: found nonce
    unsigned char* output_mix,       // 7: 32-byte mix hash
    unsigned int* found,             // 8: found flag
    unsigned char* output_hash       // 9: 32-byte final hash (byte-swapped state[0..7])
)
{
    if (*stop) {
        if ((threadIdx.x == 0) && ((blockIdx.x & 15) == 0)) {
            atomicAdd(stop + 1, blockDim.x * 16);
        }
        return;
    }

    // Reinterpret DAG as uint32_t (4 bytes per element, 4 per dag_t)
    const uint32_t *g_dag = (const uint32_t *)g_dag_u64;
    const dag_t *g_dag_t = (const dag_t *)g_dag;

    __shared__ shuffle_t share[HASHES_PER_GROUP];
    __shared__ uint32_t c_dag[PROGPOW_CACHE_WORDS];

    const uint32_t lid = threadIdx.x;
    uint32_t gid = blockIdx.x * blockDim.x + threadIdx.x;

    const uint32_t lane_id = lid & (PROGPOW_LANES - 1);
    const uint32_t group_id = lid / PROGPOW_LANES;

    // Load the first portion of the DAG into the shared cache
    for (uint32_t word = lid * PROGPOW_DAG_LOADS; word < PROGPOW_CACHE_WORDS;
         word += GROUP_SIZE * PROGPOW_DAG_LOADS)
    {
        dag_t load = g_dag_t[word / PROGPOW_DAG_LOADS];
        #pragma unroll
        for (int i = 0; i < PROGPOW_DAG_LOADS; i++)
            c_dag[word + i] = load.s[i];
    }

    uint32_t hash_seed[2];  // KISS99 initiator
    hash32_t digest;        // Carry-over from mix output

    uint32_t state2[8];

    {
        // Absorb phase for initial round of keccak
        uint32_t state[25] = {0x0};     // Keccak's state

        // 1st fill with job data (10 uint32 = 40 bytes)
        #pragma unroll
        for (int i = 0; i < 10; i++)
            state[i] = job_blob[i];

        // Apply nonce: overwrite state[8] with gid
        gid += state[8];
        state[8] = gid;

        // 3rd apply ravencoin input constraints
        #pragma unroll
        for (int i = 10; i < 25; i++)
            state[i] = ravencoin_rndc[i - 10];

        // Run initial keccak round
        keccak_f800(state);

        #pragma unroll
        for (int i = 0; i < 8; i++)
            state2[i] = state[i];
    }

    // Force threads to sync and ensure shared mem is in sync
    __syncthreads();

    #pragma unroll 1
    for (uint32_t h = 0; h < PROGPOW_LANES; h++)
    {
        uint32_t mix[PROGPOW_REGS];

        // Share the hash's seed across all lanes
        if (lane_id == h) {
            share[group_id].uint32s[0] = state2[0];
            share[group_id].uint32s[1] = state2[1];
        }
        __syncthreads();

        // Initialize mix for all lanes
        fill_mix(share[group_id].uint32s, lane_id, mix);

        // DAG loop — 64 iterations
        #pragma unroll 1
        for (uint32_t loop = 0; loop < PROGPOW_CNT_DAG; loop++)
        {
            progPowLoop(loop, mix, g_dag_t, c_dag, hack_false);
        }

        // Reduce mix data to a per-lane 32-bit digest
        uint32_t mix_hash = FNV_OFFSET_BASIS;
        #pragma unroll
        for (int i = 0; i < PROGPOW_REGS; i++)
            fnv1a(mix_hash, mix[i]);

        // Reduce all lanes to a single 256-bit digest
        hash32_t digest_temp;
        #pragma unroll
        for (int i = 0; i < 8; i++)
            digest_temp.uint32s[i] = FNV_OFFSET_BASIS;

        share[group_id].uint32s[lane_id] = mix_hash;
        __syncthreads();

        #pragma unroll
        for (int i = 0; i < PROGPOW_LANES; i++)
            fnv1a(digest_temp.uint32s[i % 8], share[group_id].uint32s[i]);

        if (h == lane_id)
            digest = digest_temp;
    }

    // Absorb phase for last round of keccak (256 bits)
    uint64_t result;
    uint32_t final_state_words[8];  // Save state[0..7] for output_hash

    {
        uint32_t state[25] = {0x0};     // Keccak's state

        // 1st initial 8 words of state are kept as carry-over from initial keccak
        #pragma unroll
        for (int i = 0; i < 8; i++)
            state[i] = state2[i];

        // 2nd subsequent 8 words are carried from digest/mix
        #pragma unroll
        for (int i = 8; i < 16; i++)
            state[i] = digest.uint32s[i - 8];

        // 3rd apply ravencoin input constraints
        #pragma unroll
        for (int i = 16; i < 25; i++)
            state[i] = ravencoin_rndc[i - 16];

        // Run keccak loop
        keccak_f800(state);

        // Save state[0..7] for output_hash
        #pragma unroll
        for (int i = 0; i < 8; i++)
            final_state_words[i] = state[i];

        // Extract result: byte-swap state[0] and state[1] for big-endian comparison
        result = (uint64_t)cuda_swab32(state[0]) << 32 | cuda_swab32(state[1]);
    }

    // Check result vs target
    if (result <= target)
    {
        *stop = 1;

        const uint32_t index = atomicAdd(results, 1U) + 1U;
        if (index <= 15) {
            results[index] = gid;
        }

        // ZION: write to our output buffers for share submission
        unsigned int old = atomicExch(found, 1u);
        if (old == 0u) {
            *output_nonce = (uint64_t)gid;
            // Write mix hash (digest) as 32 bytes little-endian
            for (int i = 0; i < 8; i++) {
                output_mix[i * 4]     = (unsigned char)(digest.uint32s[i]);
                output_mix[i * 4 + 1] = (unsigned char)(digest.uint32s[i] >> 8);
                output_mix[i * 4 + 2] = (unsigned char)(digest.uint32s[i] >> 16);
                output_mix[i * 4 + 3] = (unsigned char)(digest.uint32s[i] >> 24);
            }
            // Write final hash: byte-swap state[0..7] for big-endian 256-bit hash
            for (int i = 0; i < 8; i++) {
                uint32_t swab = cuda_swab32(final_state_words[i]);
                output_hash[i * 4]     = (unsigned char)(swab);
                output_hash[i * 4 + 1] = (unsigned char)(swab >> 8);
                output_hash[i * 4 + 2] = (unsigned char)(swab >> 16);
                output_hash[i * 4 + 3] = (unsigned char)(swab >> 24);
            }
        }
    }
}

} // extern "C"
