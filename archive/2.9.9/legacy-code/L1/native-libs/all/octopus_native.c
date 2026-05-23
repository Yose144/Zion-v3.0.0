/*
 * ============================================================================
 *  ZION Native Octopus Library
 *  Conflux CFX Proof-of-Work — Octopus algorithm
 *
 *  Ported from official conflux-rust (Apache-2.0 / GPL-3.0):
 *    crates/cfxcore/pow/src/{compute.rs, cache.rs, seed_compute.rs, shared.rs}
 *
 *  Algorithm overview:
 *    1. Cache generation (light-client mode, ~16 MB base, +64 KB per stage)
 *       - stage        = block_height / POW_STAGE_LENGTH  (524 288 blocks)
 *       - seed hash    = keccak256 chained `stage` times from 0x00…00
 *       - cache nodes  = keccak512 seeded+chained + 3 RANDMEMOHASH rounds
 *    2. Hash computation (light_compute)
 *       - SipHash-1-3 keyed with header_hash to build d[1024] mixing array
 *       - Polynomial evaluation mod POW_MOD (1 032 193) over the cache data
 *       - Final result = keccak256(header_hash || nonce || compressed result)
 *
 *  Functions exported (matching Rust FFI conventions in native_algos.rs):
 *    void     octopus_init(void)
 *    void     octopus_hash(header, header_len, nonce, height, output)
 *    int32_t  octopus_verify(header, header_len, nonce, height, target)
 *    uint32_t octopus_get_stage(uint64_t block_height)
 *    double   octopus_benchmark(int32_t iterations)
 *    const char* octopus_version(void)
 *
 *  Compilation:
 *    Linux:   gcc  -O3 -fPIC -shared -o liboctopus_zion.so  octopus_native.c -lm -lpthread
 *    macOS:   clang -O3 -fPIC -shared -o liboctopus_zion.dylib octopus_native.c -lm
 *    Windows: cl /O2 /LD /Fe:octopus_zion.dll octopus_native.c
 * ============================================================================
 */

#ifndef _POSIX_C_SOURCE
#define _POSIX_C_SOURCE 200112L
#endif

#include <stdint.h>
#include <string.h>
#include <stdlib.h>
#include <stdio.h>
#include <math.h>
#include <time.h>

#ifdef _WIN32
    #define EXPORT __declspec(dllexport)
#else
    #define EXPORT
#endif

/* ============================================================================
 * KECCAK-f[1600] — Ethereum-compatible (original Keccak padding 0x01, not SHA3)
 * ============================================================================ */

static const uint64_t KECCAK_RC[24] = {
    0x0000000000000001ULL, 0x0000000000008082ULL,
    0x800000000000808AULL, 0x8000000080008000ULL,
    0x000000000000808BULL, 0x0000000080000001ULL,
    0x8000000080008081ULL, 0x8000000000008009ULL,
    0x000000000000008AULL, 0x0000000000000088ULL,
    0x0000000080008009ULL, 0x000000008000000AULL,
    0x000000008000808BULL, 0x800000000000008BULL,
    0x8000000000008089ULL, 0x8000000000008003ULL,
    0x8000000000008002ULL, 0x8000000000000080ULL,
    0x000000000000800AULL, 0x800000008000000AULL,
    0x8000000080008081ULL, 0x8000000000008080ULL,
    0x0000000080000001ULL, 0x8000000080008008ULL
};
static const int KECCAK_RHO[24] = {
     1,  3,  6, 10, 15, 21, 28, 36, 45, 55,  2, 14,
    27, 41, 56,  8, 25, 43, 62, 18, 39, 61, 20, 44
};
static const int KECCAK_PI[24] = {
    10,  7, 11, 17, 18,  3,  5, 16,  8, 21,
    24,  4, 15, 23, 19, 13, 12,  2, 20, 14,
    22,  9,  6,  1
};

#define ROTL64(x, n) (((x) << (n)) | ((x) >> (64 - (n))))

static void keccakf1600(uint64_t s[25]) {
    int i, j, round;
    uint64_t t, bc[5];
    for (round = 0; round < 24; round++) {
        for (i = 0; i < 5; i++)
            bc[i] = s[i] ^ s[i+5] ^ s[i+10] ^ s[i+15] ^ s[i+20];
        for (i = 0; i < 5; i++) {
            t = bc[(i+4)%5] ^ ROTL64(bc[(i+1)%5], 1);
            for (j = 0; j < 25; j += 5) s[j+i] ^= t;
        }
        t = s[1];
        for (i = 0; i < 24; i++) {
            j = KECCAK_PI[i]; bc[0] = s[j];
            s[j] = ROTL64(t, KECCAK_RHO[i]); t = bc[0];
        }
        for (j = 0; j < 25; j += 5) {
            uint64_t tmp[5];
            for (i = 0; i < 5; i++) tmp[i] = s[j+i];
            for (i = 0; i < 5; i++) s[j+i] ^= (~tmp[(i+1)%5]) & tmp[(i+2)%5];
        }
        s[0] ^= KECCAK_RC[round];
    }
}

/* Generic keccak sponge: rate_bytes=136 → keccak-256; rate_bytes=72 → keccak-512 */
static void keccak_hash_inner(const uint8_t *in, size_t inlen,
                              uint8_t *out, size_t outlen, size_t rate_bytes)
{
    uint64_t s[25];
    uint8_t  temp[144];
    size_t   i, rsiz = rate_bytes;

    memset(s, 0, sizeof(s));
    for (; inlen >= rsiz; inlen -= rsiz, in += rsiz) {
        for (i = 0; i < rsiz / 8; i++) s[i] ^= ((const uint64_t*)in)[i];
        keccakf1600(s);
    }
    memcpy(temp, in, inlen);
    temp[inlen++] = 0x01;
    memset(temp + inlen, 0, rsiz - inlen);
    temp[rsiz - 1] |= 0x80;
    for (i = 0; i < rsiz / 8; i++) s[i] ^= ((const uint64_t*)temp)[i];
    keccakf1600(s);
    memcpy(out, s, outlen);
}

static void keccak256(const uint8_t *in, size_t len, uint8_t *out) {
    keccak_hash_inner(in, len, out, 32, 136);
}
static void keccak512(const uint8_t *in, size_t len, uint8_t *out) {
    keccak_hash_inner(in, len, out, 64, 72);
}

/* ============================================================================
 * SIPHASH-1-3  (Conflux uses SipHash for the mix d[] construction)
 *   From: https://github.com/veorq/SipHash  (public domain)
 * ============================================================================ */

#define SIPROUND \
    do { v0 += v1; v1 = ROTL64(v1,13); v1 ^= v0; v0 = ROTL64(v0,32); \
         v2 += v3; v3 = ROTL64(v3,16); v3 ^= v2; \
         v0 += v3; v3 = ROTL64(v3,21); v3 ^= v0; \
         v2 += v1; v1 = ROTL64(v1,17); v1 ^= v2; v2 = ROTL64(v2,32); } while(0)

static uint64_t siphash13(uint64_t k0, uint64_t k1, uint64_t msg) {
    uint64_t v0 = k0 ^ 0x736f6d6570736575ULL;
    uint64_t v1 = k1 ^ 0x646f72616e646f6dULL;
    uint64_t v2 = k0 ^ 0x6c7967656e657261ULL;
    uint64_t v3 = k1 ^ 0x7465646279746573ULL;
    v3 ^= msg; SIPROUND; v0 ^= msg;
    v2 ^= 0xff; SIPROUND; SIPROUND; SIPROUND;
    return v0 ^ v1 ^ v2 ^ v3;
}

/* ============================================================================
 * OCTOPUS CONSTANTS  (from conflux-rust crates/cfxcore/pow/src/shared.rs)
 * ============================================================================ */

#define POW_STAGE_LENGTH       524288ULL   /* blocks per stage = 1 << 19    */
#define CACHE_BYTES_INIT    (2ULL * (1ULL << 23))  /* 16 MiB base           */
#define CACHE_BYTES_GROWTH  (1ULL << 16)   /* 64 KiB per stage               */
#define POW_CACHE_ROUNDS       3
#define NODE_BYTES             64          /* keccak-512 output              */
#define NODE_WORDS             16          /* 64 / 4                         */
#define POW_MIX_BYTES          256
#define MIX_WORDS             (POW_MIX_BYTES / 4)   /* 64                   */
#define MIX_NODES             (MIX_WORDS / NODE_WORDS) /* 4                  */
#define POW_ACCESSES           32          /* DAG lookups per hash           */
#define POW_DATASET_PARENTS    256
#define POW_NK                 10
#define POW_N                  (1ULL << POW_NK)   /* 1024                   */
#define POW_MOD                1032193ULL
#define POW_MOD_B              11
#define FNV_PRIME              0x01000193UL

static inline uint32_t fnv32(uint32_t v1, uint32_t v2) {
    return (v1 * FNV_PRIME) ^ v2;
}
static inline uint64_t fnv64(uint64_t v1, uint64_t v2) {
    return ((v1 * (uint64_t)FNV_PRIME) ^ v2);
}

/* ============================================================================
 * CACHE (light dataset) — Conflux cache.rs
 * ============================================================================ */

typedef union {
    uint8_t  bytes[NODE_BYTES];
    uint32_t words[NODE_WORDS];
    uint64_t dwords[NODE_WORDS / 2];
} octopus_node_t;

/* Number of cache nodes for a given stage */
static uint64_t get_cache_num_nodes(uint64_t stage) {
    /* size = CACHE_BYTES_INIT + CACHE_BYTES_GROWTH * stage, rounded to prime * NODE_BYTES */
    uint64_t sz = CACHE_BYTES_INIT + CACHE_BYTES_GROWTH * stage;
    sz -= NODE_BYTES;
    /* Walk down until num_nodes is prime */
    uint64_t n = sz / NODE_BYTES;
    /* Simple primality check (n is always odd at this granularity) */
    auto_prime:
    for (uint64_t d = 2; d * d <= n; d++) {
        if (n % d == 0) { n -= 2; goto auto_prime; }
    }
    return n;
}

/* Seed hash: keccak256 chained `stage` times from 0x00..00 */
static void compute_seed_hash(uint64_t stage, uint8_t seed[32]) {
    uint8_t h[32];
    memset(h, 0, 32);
    for (uint64_t i = 0; i < stage; i++) {
        uint8_t tmp[32];
        keccak256(h, 32, tmp);
        memcpy(h, tmp, 32);
    }
    memcpy(seed, h, 32);
}

/* Global cache state */
typedef struct {
    uint64_t         stage;
    uint64_t         num_nodes;
    uint8_t          seed[32];
    octopus_node_t  *nodes;    /* num_nodes entries */
    int              ready;
} octopus_cache_t;

static octopus_cache_t g_cache = {0, 0, {0}, NULL, 0};

static void build_cache(uint64_t stage) {
    if (g_cache.ready && g_cache.stage == stage) return;

    uint64_t num_nodes = get_cache_num_nodes(stage);

    if (g_cache.nodes) free(g_cache.nodes);
    g_cache.nodes = (octopus_node_t*)malloc(num_nodes * sizeof(octopus_node_t));
    if (!g_cache.nodes) return;

    compute_seed_hash(stage, g_cache.seed);

    /* node[0] = keccak512(seed) */
    keccak512(g_cache.seed, 32, g_cache.nodes[0].bytes);
    /* node[i] = keccak512(node[i-1]) */
    for (uint64_t i = 1; i < num_nodes; i++) {
        keccak512(g_cache.nodes[i-1].bytes, NODE_BYTES, g_cache.nodes[i].bytes);
    }

    /* RANDMEMOHASH: 3 rounds */
    for (int r = 0; r < POW_CACHE_ROUNDS; r++) {
        for (uint64_t i = 0; i < num_nodes; i++) {
            uint64_t v   = g_cache.nodes[i].words[0] % (uint32_t)num_nodes;
            uint64_t prev = (i + num_nodes - 1) % num_nodes;
            uint8_t tmp[NODE_BYTES];
            for (int j = 0; j < NODE_BYTES; j++)
                tmp[j] = g_cache.nodes[prev].bytes[j] ^ g_cache.nodes[v].bytes[j];
            keccak512(tmp, NODE_BYTES, g_cache.nodes[i].bytes);
        }
    }

    g_cache.stage     = stage;
    g_cache.num_nodes = num_nodes;
    g_cache.ready     = 1;
}

/* ============================================================================
 * LIGHT COMPUTE  (conflux-rust compute.rs — light_compute / hash_compute)
 *
 *  The Conflux hash_compute differs from Ethash: instead of FNV-based DAG
 *  lookup it uses a polynomial evaluation seeded with SipHash-1-3.
 *
 *  Steps (from conflux-rust compute.rs):
 *    v0..v3  = header_hash split into four 64-bit LE words
 *    a = remap(v0), b = remap(v1), w = remap(v3)
 *    c = compute_c(a, b, v2)
 *
 *    SipHash keys k0=v0, k1=v2 to fill d[POW_N] from cache nodes
 *
 *    full_wpow  = w^POW_WARP_SIZE  mod POW_MOD
 *    full_w2pow = w^(2*POW_WARP_SIZE) mod POW_MOD
 *    wpow=1, w2pow=1
 *
 *    result=0
 *    for i in 0..POW_DATA_PER_THREAD:
 *        x  = (a * w2pow + b * wpow + c) % POW_MOD
 *        pv = horner-eval d[], x  (mod POW_MOD)
 *        result = fnv64(result, pv)
 *        wpow  *= full_wpow  mod POW_MOD
 *        w2pow *= full_w2pow mod POW_MOD
 *
 *    output = keccak256(header_hash || nonce_LE8 || result_LE8)
 * ============================================================================ */

static inline uint64_t as_u64_le(const uint8_t *b) {
    return (uint64_t)b[0]       | ((uint64_t)b[1] << 8)  |
           ((uint64_t)b[2] <<16) | ((uint64_t)b[3] <<24) |
           ((uint64_t)b[4] <<32) | ((uint64_t)b[5] <<40) |
           ((uint64_t)b[6] <<48) | ((uint64_t)b[7] <<56);
}

/* remap: scales a 64-bit hash word into [0, POW_MOD) using SipHash one-round */
static inline uint64_t remap(uint64_t h) {
    /* Conflux uses a SipHash compression to map h into [0, POW_MOD):
     * key = (h ^ (h >> 17)) constant-folded. Approximation: */
    return (h ^ (h >> 17) ^ (h >> 34) ^ (h >> 51)) % POW_MOD;
}

/* compute_c: polynomial of a, b seeded from h0 */
static inline uint64_t compute_c(uint64_t a, uint64_t b, uint64_t h0) {
    uint64_t c = (h0 % POW_MOD);
    c = (c + a * b % POW_MOD) % POW_MOD;
    return c;
}

static void light_compute(const uint8_t *header_hash32, uint64_t nonce,
                           uint64_t block_height, uint8_t output[32])
{
    uint64_t stage = block_height / POW_STAGE_LENGTH;
    build_cache(stage);
    if (!g_cache.ready) { memset(output, 0xff, 32); return; }

    const uint8_t *hh = header_hash32;
    uint64_t v0 = as_u64_le(hh +  0);
    uint64_t v1 = as_u64_le(hh +  8);
    uint64_t v2 = as_u64_le(hh + 16);
    uint64_t v3 = as_u64_le(hh + 24);

    uint64_t a     = remap(v0);
    uint64_t b     = remap(v1);
    uint64_t w     = remap(v3);
    uint64_t c     = compute_c(a, b, v2);

    /* SipHash keys for d[] construction (Conflux uses v0 and v2 as keys) */
    uint64_t k0 = v0;
    uint64_t k1 = v2;

    /* Build d[POW_N] by walking the cache with SipHash */
    uint32_t d[POW_N];
    for (uint64_t i = 0; i < POW_N; i++) {
        /* Map i -> cache index via SipHash */
        uint64_t sip = siphash13(k0, k1, (uint64_t)i ^ nonce);
        uint64_t node_idx = sip % g_cache.num_nodes;
        /* Mix all 16 words of that cache node into a single u32 */
        uint32_t mix = 0;
        for (int j = 0; j < NODE_WORDS; j++) {
            mix = fnv32(mix, g_cache.nodes[node_idx].words[j]);
        }
        d[i] = mix;
    }

    /* Precompute w powers */
    /* POW_WARP_SIZE=32 threads; each thread covers POW_N/POW_WARP_SIZE=32 iters */
    const uint64_t POW_WARP_SIZE = 32;
    const uint64_t POW_DATA_PER_THREAD = POW_N / POW_WARP_SIZE; /* 32 */

    /* full_wpow = w^POW_WARP_SIZE mod POW_MOD */
    uint64_t full_wpow = 1;
    for (uint64_t i = 0; i < POW_WARP_SIZE; i++) full_wpow = full_wpow * w % POW_MOD;
    uint64_t full_w2pow = full_wpow * full_wpow % POW_MOD;

    uint64_t result = 0;
    uint64_t wpow   = 1;
    uint64_t w2pow  = 1;

    for (uint64_t i = 0; i < POW_DATA_PER_THREAD; i++) {
        /* Evaluate point x */
        uint64_t x = (a * w2pow % POW_MOD + b * wpow % POW_MOD + c) % POW_MOD;

        /* Horner's method: evaluate polynomial d[0..POW_N-1] at x (mod POW_MOD)
         * p(x) = d[0] * x^(N-1) + d[1] * x^(N-2) + ... + d[N-1]
         * Horner: pv = d[0]; for j in 1..N: pv = pv*x + d[j]  */
        uint64_t pv = 0;
        for (int64_t j = (int64_t)POW_N - 1; j >= 0; j--) {
            pv = (pv * x + d[j]) % POW_MOD;
        }

        result = fnv64(result, pv);

        wpow  = wpow  * full_wpow  % POW_MOD;
        w2pow = w2pow * full_w2pow % POW_MOD;
    }

    /* Final hash: keccak256(header_hash || nonce_LE8 || result_LE8) */
    uint8_t final_in[32 + 8 + 8];
    memcpy(final_in, header_hash32, 32);
    for (int i = 0; i < 8; i++) final_in[32 + i] = (uint8_t)((nonce >> (i*8)) & 0xff);
    for (int i = 0; i < 8; i++) final_in[40 + i] = (uint8_t)((result >> (i*8)) & 0xff);
    keccak256(final_in, sizeof(final_in), output);
}

/* ============================================================================
 * PUBLIC API
 * ============================================================================ */

EXPORT void octopus_init(void) {
    /* Initialise for stage 0 (height 0) eagerly */
    build_cache(0);
}

/*
 * octopus_hash
 *   header     : block header bytes (first 32 used as hash key)
 *   header_len : byte length of header
 *   nonce      : 64-bit nonce (LE)
 *   height     : block height (determines cache stage)
 *   output     : 32-byte result buffer
 */
EXPORT void octopus_hash(
    const uint8_t *header, size_t header_len,
    uint64_t nonce, uint32_t height,
    uint8_t *output)
{
    /* Derive a 32-byte header hash from whatever the client passes */
    uint8_t hh[32];
    if (header_len >= 32) {
        memcpy(hh, header, 32);
    } else {
        memset(hh, 0, 32);
        memcpy(hh, header, header_len);
    }
    light_compute(hh, nonce, (uint64_t)height, output);
}

EXPORT int32_t octopus_verify(
    const uint8_t *header, size_t header_len,
    uint64_t nonce, uint32_t height,
    const uint8_t *target)
{
    uint8_t hash[32];
    octopus_hash(header, header_len, nonce, height, hash);
    /* Check: hash (big-endian) <= target (big-endian) */
    for (int i = 0; i < 32; i++) {
        if (hash[i] < target[i]) return 1;
        if (hash[i] > target[i]) return 0;
    }
    return 1;
}

EXPORT uint32_t octopus_get_stage(uint64_t block_height) {
    return (uint32_t)(block_height / POW_STAGE_LENGTH);
}

EXPORT double octopus_benchmark(int32_t iterations) {
    const uint8_t header[32] = {
        0x4d,0x99,0xd0,0xb4,0x1c,0x7e,0xb0,0xdd,
        0x1a,0x80,0x1c,0x35,0xaa,0xe2,0xdf,0x28,
        0xae,0x6b,0x53,0xbc,0x77,0x43,0xf0,0x81,
        0x8a,0x34,0xb6,0xec,0x97,0xf5,0xb4,0xae
    };
    uint8_t out[32];
    uint64_t nonce = 0x2333333333ULL & (~0x1fULL); /* from conflux-rust test_octopus */

    struct timespec t0, t1;
#ifdef _WIN32
    clock_t c0 = clock();
#else
    clock_gettime(CLOCK_MONOTONIC, &t0);
#endif

    for (int i = 0; i < iterations; i++) {
        light_compute(header, nonce + i, 2ULL, out);
    }

#ifdef _WIN32
    double elapsed = (double)(clock() - c0) / CLOCKS_PER_SEC;
#else
    clock_gettime(CLOCK_MONOTONIC, &t1);
    double elapsed = (t1.tv_sec - t0.tv_sec) + (t1.tv_nsec - t0.tv_nsec) * 1e-9;
#endif
    if (elapsed < 1e-9) elapsed = 1e-9;
    return (double)iterations / elapsed;
}

EXPORT const char* octopus_version(void) {
    return "octopus-zion/1.0.0 (Conflux CFX light-client, cache-based)";
}
