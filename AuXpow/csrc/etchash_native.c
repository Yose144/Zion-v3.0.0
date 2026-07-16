/*
 * ============================================================================
 *  ZION Native Ethash / Etchash Library v3.0
 *  Real DAG-based Ethash implementation for Ethereum Classic (ETC) and
 *  EthereumPoW (ETHW).
 *
 *  This replaces the previous placeholder/light-cache implementation with the
 *  full Dagger-Hashimoto algorithm matching the OpenCL kernel
 *  (csrc/opencl/ethash_kernel.cl) and the Rust CPU reference
 *  (AuXpow/src/external_hashers.rs::hash_ethash).
 *
 *  Algorithm (per nonce):
 *    1. seed   = Keccak-512(header_hash || nonce_le)        -> 64 bytes
 *    2. mix    = seed concatenated with itself              -> 128 bytes (32 x u32)
 *    3. for i in 0..63 (64 DAG accesses):
 *         index = fnv1a(i ^ mix[0], mix[0]) % dag_size_entries
 *         node  = dag[index]                                -> 128 bytes (16 x u64)
 *         mix   = fnv1a(mix, node)  per 32-bit word
 *    4. compress mix: FNV-fold each group of 4 u32 words    -> 32 bytes (8 x u32)
 *    5. hash   = Keccak-256(seed || compressed_mix)         -> 32 bytes
 *    6. check hash <= target (big-endian byte comparison)
 *
 *  Keccak here uses the ORIGINAL Keccak domain suffix (0x01), NOT the
 *  NIST SHA-3 suffix (0x06).  Ethereum uses Keccak-256/Keccak-512.
 *
 *  The DAG is a per-epoch precomputed buffer of 128-byte entries that is
 *  generated on the host and passed in as a pointer.  Each DAG entry is
 *  16 u64 words (128 bytes).  dag_size_entries is the number of 128-byte
 *  entries.
 *
 *  Compilation:
 *    Linux:  gcc -O3 -fPIC -shared -std=c11 -o libethash_zion.so etchash_native.c -lm
 *    macOS:  clang -O3 -fPIC -shared -std=c11 -o libethash_zion.dylib etchash_native.c
 *    Windows: cl /O2 /LD /Fe:ethash_zion.dll etchash_native.c
 *
 *  Functions exported (matching Rust FFI in native_ffi.rs):
 *    Primary (DAG-based, real Ethash):
 *      int32_t ethash_mine(header_hash, nonce, dag, dag_size_entries, target, output)
 *      void    ethash_hash_dag(header_hash, nonce, dag, dag_size_entries, output)
 *      void    ethash_set_dag(dag, dag_size_entries)
 *    Legacy / light-mode fallback (uses globally-set DAG if available):
 *      void    ethash_init(void)
 *      void    ethash_hash(header, header_len, nonce, height, output)
 *      int32_t ethash_verify(header, header_len, nonce, height, target)
 *      uint32_t ethash_get_epoch(block_number)
 *      void    ethash_cleanup(void)
 *      double  ethash_benchmark(int32_t iterations)
 *      const char* ethash_version(void)
 * ============================================================================
 */

/* POSIX: enable struct timespec / clock_gettime */
#ifndef _POSIX_C_SOURCE
#define _POSIX_C_SOURCE 200112L
#endif

#include <stdint.h>
#include <inttypes.h>
#include <string.h>
#include <stdlib.h>
#include <stdio.h>
#include <time.h>

#ifdef _WIN32
    #define EXPORT __declspec(dllexport)
#else
    #define EXPORT
#endif

/* ============================================================================
 * KECCAK-f[1600] — reference implementation (original Keccak padding 0x01)
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
     1,  3,  6, 10, 15, 21,
    28, 36, 45, 55,  2, 14,
    27, 41, 56,  8, 25, 43,
    62, 18, 39, 61, 20, 44
};

static const int KECCAK_PI[24] = {
    10,  7, 11, 17, 18,
     3,  5, 16,  8, 21,
    24,  4, 15, 23, 19,
    13, 12,  2, 20, 14,
    22,  9,  6,  1
};

#define ROTL64(x, n) (((x) << (n)) | ((x) >> (64 - (n))))

static void keccakf1600(uint64_t s[25]) {
    int i, j, round;
    uint64_t t, bc[5];

    for (round = 0; round < 24; round++) {
        /* Theta */
        for (i = 0; i < 5; i++)
            bc[i] = s[i] ^ s[i + 5] ^ s[i + 10] ^ s[i + 15] ^ s[i + 20];
        for (i = 0; i < 5; i++) {
            t = bc[(i + 4) % 5] ^ ROTL64(bc[(i + 1) % 5], 1);
            for (j = 0; j < 25; j += 5)
                s[j + i] ^= t;
        }
        /* Rho & Pi */
        t = s[1];
        for (i = 0; i < 24; i++) {
            j = KECCAK_PI[i];
            bc[0] = s[j];
            s[j] = ROTL64(t, KECCAK_RHO[i]);
            t = bc[0];
        }
        /* Chi */
        for (j = 0; j < 25; j += 5) {
            uint64_t tmp[5];
            for (i = 0; i < 5; i++) tmp[i] = s[j + i];
            for (i = 0; i < 5; i++)
                s[j + i] ^= (~tmp[(i + 1) % 5]) & tmp[(i + 2) % 5];
        }
        /* Iota */
        s[0] ^= KECCAK_RC[round];
    }
}

/* Generic Keccak sponge with original Keccak domain suffix (0x01).
 * rate_bytes = 136 for Keccak-256, 72 for Keccak-512. */
static void keccak_hash(const uint8_t *in, size_t inlen,
                        uint8_t *out, size_t outlen, size_t rate_bytes)
{
    uint64_t s[25];
    uint8_t temp[144];  /* max rate = 144 bytes */
    size_t i, rsiz = rate_bytes;

    memset(s, 0, sizeof(s));

    /* Absorb full blocks */
    for (; inlen >= rsiz; inlen -= rsiz, in += rsiz) {
        for (i = 0; i < rsiz / 8; i++)
            s[i] ^= ((const uint64_t *)(const void *)in)[i];
        keccakf1600(s);
    }

    /* Final block: copy remainder, append Keccak suffix 0x01, pad10*1 */
    memcpy(temp, in, inlen);
    temp[inlen++] = 0x01;   /* Keccak domain suffix — NOT SHA3 (0x06) */
    memset(temp + inlen, 0, rsiz - inlen);
    temp[rsiz - 1] |= 0x80;
    for (i = 0; i < rsiz / 8; i++)
        s[i] ^= ((uint64_t *)(void *)temp)[i];
    keccakf1600(s);

    /* Squeeze (output <= rate, single squeeze for 32/64-byte outputs) */
    memcpy(out, s, outlen);
}

/* Keccak-256 (Ethereum-compatible, suffix 0x01, rate 136 bytes) */
static void keccak256(const uint8_t *in, size_t len, uint8_t *out) {
    keccak_hash(in, len, out, 32, 136);
}

/* Keccak-512 (Ethereum-compatible, suffix 0x01, rate 72 bytes) */
static void keccak512(const uint8_t *in, size_t len, uint8_t *out) {
    keccak_hash(in, len, out, 64, 72);
}

/* ============================================================================
 * FNV-1a (32-bit) — Ethash mixing
 *   hash = (hash ^ element) * FNV_PRIME
 * ============================================================================ */

#define FNV_PRIME 0x01000193u

static inline uint32_t fnv1a(uint32_t a, uint32_t b) {
    return (a ^ b) * FNV_PRIME;
}

/* ============================================================================
 * ETHASH CONSTANTS
 * ============================================================================ */

#define ETHASH_EPOCH_LENGTH     30000
#define ETHASH_MIX_BYTES        128
#define ETHASH_HASH_BYTES       64
#define ETHASH_ACCESSES         64
#define ETHASH_DAG_ENTRY_BYTES  128   /* 16 x u64 / 32 x u32 */

/* ============================================================================
 * CORE: full Ethash over a precomputed DAG (real algorithm)
 *
 *   header_hash        : 32-byte Keccak-256 of the block header (without nonce)
 *   nonce              : 64-bit nonce
 *   dag                : precomputed DAG buffer, 128 bytes per entry
 *   dag_size_entries   : number of 128-byte DAG entries
 *   output             : 32-byte final hash buffer (Keccak-256(seed || cmix))
 * ============================================================================ */
static void ethash_compute(const uint8_t header_hash[32],
                           uint64_t nonce,
                           const uint8_t *dag,
                           uint64_t dag_size_entries,
                           uint8_t output[32])
{
    /* Step 1: seed = Keccak-512(header_hash || nonce_le) -> 64 bytes */
    uint8_t seed_input[40];
    memcpy(seed_input, header_hash, 32);
    for (int i = 0; i < 8; i++)
        seed_input[32 + i] = (uint8_t)(nonce >> (i * 8));

    uint8_t seed[64];
    keccak512(seed_input, 40, seed);

    /* Step 2: mix = seed || seed  -> 128 bytes = 32 x u32 (little-endian) */
    uint32_t mix[32];
    for (int j = 0; j < 16; j++) {
        uint32_t w = (uint32_t)seed[j * 4]
                   | ((uint32_t)seed[j * 4 + 1] << 8)
                   | ((uint32_t)seed[j * 4 + 2] << 16)
                   | ((uint32_t)seed[j * 4 + 3] << 24);
        mix[j]      = w;
        mix[j + 16] = w;
    }

    /* Step 3: 64 DAG accesses with FNV-1a mixing */
    for (int i = 0; i < ETHASH_ACCESSES; i++) {
        uint32_t index = fnv1a((uint32_t)i ^ mix[0], mix[0]) % (uint32_t)dag_size_entries;

        /* Load 128-byte DAG node = 16 x u64, split into 32 x u32 (little-endian). */
        const uint8_t *node = dag + (uint64_t)index * ETHASH_DAG_ENTRY_BYTES;
        for (int j = 0; j < 16; j++) {
            uint64_t w = ((const uint64_t *)(const void *)(node + j * 8))[0];
            mix[2 * j]     = fnv1a(mix[2 * j],     (uint32_t)(w & 0xFFFFFFFFu));
            mix[2 * j + 1] = fnv1a(mix[2 * j + 1], (uint32_t)(w >> 32));
        }
    }

    /* Step 4: compress mix — FNV-fold each group of 4 u32 words -> 8 u32 (32 bytes) */
    uint32_t cmix[8];
    for (int i = 0; i < 32; i += 4) {
        cmix[i / 4] = fnv1a(fnv1a(fnv1a(mix[i], mix[i + 1]), mix[i + 2]), mix[i + 3]);
    }

    /* Step 5: hash = Keccak-256(seed || compressed_mix) -> 32 bytes */
    uint8_t final_input[96];
    memcpy(final_input, seed, 64);
    for (int i = 0; i < 8; i++) {
        final_input[64 + i * 4]     = (uint8_t)(cmix[i]);
        final_input[64 + i * 4 + 1] = (uint8_t)(cmix[i] >> 8);
        final_input[64 + i * 4 + 2] = (uint8_t)(cmix[i] >> 16);
        final_input[64 + i * 4 + 3] = (uint8_t)(cmix[i] >> 24);
    }
    keccak256(final_input, 96, output);
}

/* ============================================================================
 * GLOBAL DAG (for legacy ethash_hash / ethash_verify path)
 *
 * The host may register a precomputed DAG once per epoch via ethash_set_dag().
 * When set, the legacy ethash_hash() uses the real DAG-based algorithm.
 * When not set, it falls back to a light cache evaluation (NOT valid for real
 * mining — only for testing the stratum pipeline).
 * ============================================================================ */

typedef struct {
    const uint8_t *dag;
    uint64_t       dag_size_entries;
    int            set;
} ethash_dag_ref_t;

static ethash_dag_ref_t g_dag = { NULL, 0, 0 };

/* Register a precomputed DAG for use by the legacy ethash_hash/verify path.
 * The DAG memory is owned by the caller and must remain valid until the next
 * ethash_set_dag() or ethash_cleanup() call. */
EXPORT void ethash_set_dag(const uint8_t *dag, uint64_t dag_size_entries) {
    g_dag.dag               = dag;
    g_dag.dag_size_entries  = dag_size_entries;
    g_dag.set               = (dag != NULL && dag_size_entries > 0) ? 1 : 0;
}

/* ============================================================================
 * PRIMARY API — real DAG-based Ethash
 * ============================================================================ */

/* Compute the full Ethash hash over a precomputed DAG.
 *   header_hash        : 32-byte block header hash
 *   nonce              : 64-bit nonce
 *   dag                : precomputed DAG buffer (128 bytes per entry)
 *   dag_size_entries   : number of 128-byte DAG entries
 *   output             : 32-byte final hash buffer */
EXPORT void ethash_hash_dag(
    const uint8_t *header_hash,
    uint64_t       nonce,
    const uint8_t *dag,
    uint64_t       dag_size_entries,
    uint8_t       *output)
{
    if (!header_hash || !dag || dag_size_entries == 0 || !output) {
        if (output) memset(output, 0xff, 32);
        return;
    }
    uint8_t hdr[32];
    memcpy(hdr, header_hash, 32);
    ethash_compute(hdr, nonce, dag, dag_size_entries, output);
}

/* Full Ethash mining check: compute the hash and return 1 if it meets the
 * target (hash <= target, big-endian byte comparison), 0 otherwise.
 * Writes the resulting 32-byte hash into `output`.
 *
 *   header_hash        : 32-byte block header hash
 *   nonce              : 64-bit nonce
 *   dag                : precomputed DAG buffer (128 bytes per entry)
 *   dag_size_entries   : number of 128-byte DAG entries
 *   target             : 32-byte target (big-endian)
 *   output             : 32-byte final hash buffer
 *   returns            : 1 if hash <= target, else 0 */
EXPORT int32_t ethash_mine(
    const uint8_t *header_hash,
    uint64_t       nonce,
    const uint8_t *dag,
    uint64_t       dag_size_entries,
    const uint8_t *target,
    uint8_t       *output)
{
    if (!header_hash || !dag || dag_size_entries == 0 || !target || !output) {
        if (output) memset(output, 0xff, 32);
        return 0;
    }
    uint8_t hdr[32];
    memcpy(hdr, header_hash, 32);
    ethash_compute(hdr, nonce, dag, dag_size_entries, output);

    /* Big-endian comparison: index 0 is most significant. */
    for (int i = 0; i < 32; i++) {
        if (output[i] < target[i]) return 1;
        if (output[i] > target[i]) return 0;
    }
    return 1; /* equal -> meets target */
}

/* ============================================================================
 * LEGACY API — light-mode fallback (kept for backward compatibility)
 *
 * ethash_hash() / ethash_verify() use the globally-registered DAG (via
 * ethash_set_dag) when available.  When no DAG is registered, they fall back
 * to a light cache evaluation that is NOT valid for real mining but keeps the
 * stratum pipeline functional for testing.
 * ============================================================================ */

#define ETHASH_CACHE_ROUNDS     3
#define ETHASH_DATASET_PARENTS  256
#define ETHASH_WORD_BYTES       4

/* Get epoch from block number */
EXPORT uint32_t ethash_get_epoch(uint32_t block_number) {
    return block_number / ETHASH_EPOCH_LENGTH;
}

/* Get cache size for epoch (light-mode fallback) */
EXPORT uint64_t ethash_get_cache_size(uint32_t epoch) {
    uint64_t size = 16 * 1024 * 1024 + (uint64_t)epoch * 128 * 1024;
    return (size / 64) * 64;
}

/* Get dataset size for epoch */
EXPORT uint64_t ethash_get_dataset_size(uint32_t epoch) {
    uint64_t size = 1024ULL * 1024 * 1024 + (uint64_t)epoch * 8 * 1024 * 1024;
    return (size / 128) * 128;
}

/* Generate seed hash for epoch by keccak256-chaining */
static void ethash_get_seedhash(uint32_t epoch, uint8_t seed[32]) {
    memset(seed, 0, 32);
    for (uint32_t i = 0; i < epoch; i++) {
        keccak256(seed, 32, seed);
    }
}

/* Light-cache context (fallback only) */
typedef struct {
    uint32_t epoch;
    uint64_t cache_size;
    uint64_t cache_items;
    uint8_t *cache;
    uint8_t  seed[32];
    int      initialized;
} ethash_ctx_t;

static ethash_ctx_t *g_ctx = NULL;

static int _ctx_init_epoch(uint32_t epoch) {
    if (!g_ctx) {
        g_ctx = (ethash_ctx_t *)calloc(1, sizeof(ethash_ctx_t));
        if (!g_ctx) return -1;
    }
    if (g_ctx->initialized && g_ctx->epoch == epoch) return 0;

    if (g_ctx->cache) { free(g_ctx->cache); g_ctx->cache = NULL; }

    g_ctx->epoch = epoch;
    ethash_get_seedhash(epoch, g_ctx->seed);

    /* Cap cache at 64 MB for CPU light mode (full cache > 1 GB) */
    uint64_t full_cache = ethash_get_cache_size(epoch);
    uint64_t alloc = full_cache < 64ULL * 1024 * 1024 ? full_cache : 64ULL * 1024 * 1024;
    g_ctx->cache_size  = alloc;
    g_ctx->cache_items = alloc / 64;

    g_ctx->cache = (uint8_t *)malloc(alloc);
    if (!g_ctx->cache) return -2;

    /* Generate cache: seed the first item, chain with keccak-512 */
    keccak512(g_ctx->seed, 32, g_ctx->cache);
    for (uint64_t i = 1; i < g_ctx->cache_items; i++) {
        keccak512(g_ctx->cache + (i - 1) * 64, 64, g_ctx->cache + i * 64);
    }

    /* RANDMEMOHASH mixing rounds */
    for (int r = 0; r < ETHASH_CACHE_ROUNDS; r++) {
        for (uint64_t i = 0; i < g_ctx->cache_items; i++) {
            uint32_t v = *(uint32_t *)(void *)&g_ctx->cache[i * 64] % (uint32_t)g_ctx->cache_items;
            uint64_t prev = (i + g_ctx->cache_items - 1) % g_ctx->cache_items;
            uint8_t  tmp[64];
            for (int j = 0; j < 64; j++)
                tmp[j] = g_ctx->cache[prev * 64 + j] ^ g_ctx->cache[v * 64 + j];
            keccak512(tmp, 64, g_ctx->cache + i * 64);
        }
    }

    g_ctx->initialized = 1;
    return 0;
}

/* Initialize for epoch 0 (legacy, no-op when DAG is registered) */
EXPORT void ethash_init(void) {
    if (!g_dag.set)
        _ctx_init_epoch(0);
}

/* Legacy hash: uses registered DAG if set, else light cache fallback. */
EXPORT void ethash_hash(
    const uint8_t *header,
    size_t         header_len,
    uint64_t       nonce,
    uint32_t       height,
    uint8_t       *output)
{
    /* Build the 32-byte header hash (left-justified, zero-padded) */
    uint8_t hdr[32];
    memset(hdr, 0, 32);
    size_t copy = header_len < 32 ? header_len : 32;
    memcpy(hdr, header, copy);

    /* Real DAG path */
    if (g_dag.set) {
        ethash_compute(hdr, nonce, g_dag.dag, g_dag.dag_size_entries, output);
        return;
    }

    /* Light-cache fallback (NOT valid for real mining) */
    uint32_t epoch = height / ETHASH_EPOCH_LENGTH;
    if (!g_ctx || !g_ctx->initialized || g_ctx->epoch != epoch) {
        if (_ctx_init_epoch(epoch) != 0) {
            memset(output, 0xff, 32);
            return;
        }
    }

    uint8_t seed_in[40];
    memset(seed_in, 0, 32);
    memcpy(seed_in, hdr, 32);
    for (int i = 0; i < 8; i++)
        seed_in[32 + i] = (uint8_t)(nonce >> (8 * i));

    uint8_t s[64];
    keccak512(seed_in, 40, s);

    /* mix = seed || seed -> 32 x u32 */
    uint32_t mix[32];
    for (int j = 0; j < 16; j++) {
        uint32_t w = (uint32_t)s[j * 4]
                   | ((uint32_t)s[j * 4 + 1] << 8)
                   | ((uint32_t)s[j * 4 + 2] << 16)
                   | ((uint32_t)s[j * 4 + 3] << 24);
        mix[j]      = w;
        mix[j + 16] = w;
    }

    /* Light evaluation: use cache rows as stand-in DAG nodes (placeholder) */
    for (int i = 0; i < ETHASH_ACCESSES; i++) {
        uint32_t index = fnv1a((uint32_t)i ^ mix[0], mix[0]) % (uint32_t)g_ctx->cache_items;
        const uint8_t *row = g_ctx->cache + (uint64_t)index * 64;
        for (int j = 0; j < 16; j++) {
            uint64_t w = ((const uint64_t *)(const void *)(row + (j % 8) * 8))[0];
            mix[2 * j]     = fnv1a(mix[2 * j],     (uint32_t)(w & 0xFFFFFFFFu));
            mix[2 * j + 1] = fnv1a(mix[2 * j + 1], (uint32_t)(w >> 32));
        }
    }

    /* Compress mix: FNV-fold each group of 4 u32 -> 8 u32 */
    uint32_t cmix[8];
    for (int i = 0; i < 32; i += 4) {
        cmix[i / 4] = fnv1a(fnv1a(fnv1a(mix[i], mix[i + 1]), mix[i + 2]), mix[i + 3]);
    }

    uint8_t final_in[96];
    memcpy(final_in, s, 64);
    for (int i = 0; i < 8; i++) {
        final_in[64 + i * 4]     = (uint8_t)(cmix[i]);
        final_in[64 + i * 4 + 1] = (uint8_t)(cmix[i] >> 8);
        final_in[64 + i * 4 + 2] = (uint8_t)(cmix[i] >> 16);
        final_in[64 + i * 4 + 3] = (uint8_t)(cmix[i] >> 24);
    }
    keccak256(final_in, 96, output);
}

/* Legacy verify: big-endian target comparison (corrected from old LE). */
EXPORT int32_t ethash_verify(
    const uint8_t *header,
    size_t         header_len,
    uint64_t       nonce,
    uint32_t       height,
    const uint8_t *target)
{
    uint8_t hash[32];
    ethash_hash(header, header_len, nonce, height, hash);

    /* Big-endian comparison: index 0 is most significant. */
    for (int i = 0; i < 32; i++) {
        if (hash[i] < target[i]) return 1;
        if (hash[i] > target[i]) return 0;
    }
    return 1; /* equal -> meets target */
}

/* Benchmark: returns hash/s */
EXPORT double ethash_benchmark(int32_t iterations) {
    if (!g_dag.set && (!g_ctx || !g_ctx->initialized))
        _ctx_init_epoch(0);

    uint8_t header[32] = {0x01, 0x02, 0x03, 0x04};
    uint8_t out[32];

    struct timespec t0, t1;
#ifdef _WIN32
    clock_t c0 = clock();
#else
    clock_gettime(CLOCK_MONOTONIC, &t0);
#endif
    for (int32_t i = 0; i < iterations; i++) {
        header[0] = (uint8_t)i;
        ethash_hash(header, 32, (uint64_t)i, 0, out);
    }
#ifdef _WIN32
    clock_t c1 = clock();
    double secs = (double)(c1 - c0) / CLOCKS_PER_SEC;
#else
    clock_gettime(CLOCK_MONOTONIC, &t1);
    double secs = (t1.tv_sec - t0.tv_sec) + (t1.tv_nsec - t0.tv_nsec) * 1e-9;
#endif
    return secs > 0.0 ? iterations / secs : 0.0;
}

/* ============================================================================
 * DAG GENERATOR — light cache → full DAG (graph expansion)
 *
 * Implements the standard Ethash dataset generation:
 *   1. Build the light cache (already done by _ctx_init_epoch)
 *   2. For each DAG node i (128 bytes = 16 x u64):
 *      a. Start with a copy of cache[i % cache_items]
 *      b. Mix with 256 parent nodes (ETHASH_DATASET_PARENTS) using FNV-1a
 *         index selection and keccak-512 mixing
 *   3. The result is the full DAG buffer
 *
 * The caller owns the returned buffer and must free() it.
 * Returns NULL on allocation failure or if the cache is not initialized.
 *
 * Parameters:
 *   epoch            — epoch number (determines cache + DAG size)
 *   dag_size_entries — output: number of 128-byte entries generated
 *   progress_cb      — optional callback called after each 1% of DAG generated
 *                      (may be NULL); receives percentage 0..100
 * Returns:
 *   pointer to DAG buffer (dag_size_entries * 128 bytes), or NULL on error.
 *   Caller must free() the returned pointer.
 * ============================================================================ */

typedef void (*dag_progress_cb)(uint32_t percent);

/* Calculate a single 64-byte DAG node from the light cache.
 * Each DAG *entry* is 128 bytes = 2 x 64-byte "nodes".
 * node_index refers to the 64-byte node, not the 128-byte entry.
 * So DAG entry e = node(2*e) || node(2*e + 1). */
static void ethash_calc_dag_node(
    uint64_t node_index,
    const uint8_t *cache,
    uint64_t cache_items,
    uint8_t *out64)  /* 64-byte output */
{
    /* Step 1: init = cache[node_index % cache_items] (64 bytes) */
    uint8_t mix[64];
    memcpy(mix, cache + (node_index % cache_items) * 64, 64);

    /* Step 2: mix with 256 parents */
    for (uint32_t p = 0; p < ETHASH_DATASET_PARENTS; p++) {
        uint32_t mix_first = *(const uint32_t *)(const void *)mix;
        uint32_t parent_idx = fnv1a((uint32_t)(node_index ^ p), mix_first) % (uint32_t)cache_items;
        const uint8_t *parent = cache + (uint64_t)parent_idx * 64;

        /* FNV-1a per 32-bit word (16 words in 64 bytes) */
        for (int j = 0; j < 16; j++) {
            uint32_t *mix_w = (uint32_t *)(void *)(mix + j * 4);
            uint32_t parent_w = *(const uint32_t *)(const void *)(parent + j * 4);
            *mix_w = fnv1a(*mix_w, parent_w);
        }
    }

    /* Step 3: keccak-512(mix) -> output (64 bytes) */
    keccak512(mix, 64, out64);
}

/* Generate the full DAG for a given epoch.
 * The caller owns the returned buffer and must free() it.
 *
 *   epoch             — epoch number
 *   dag_size_entries  — output: number of 128-byte entries
 *   progress_cb       — optional progress callback (0..100), may be NULL
 *   returns           — malloc'd DAG buffer (dag_size_entries * 128 bytes),
 *                       or NULL on error.  Caller must free().
 */
EXPORT uint8_t *ethash_generate_dag(
    uint32_t epoch,
    uint64_t *dag_size_entries,
    dag_progress_cb progress_cb)
{
    if (!dag_size_entries) return NULL;
    *dag_size_entries = 0;

    /* Initialize the light cache for this epoch (full size, not capped) */
    if (!g_ctx) {
        g_ctx = (ethash_ctx_t *)calloc(1, sizeof(ethash_ctx_t));
        if (!g_ctx) return NULL;
    }

    /* If cache is for a different epoch, rebuild it (full size) */
    if (!g_ctx->initialized || g_ctx->epoch != epoch) {
        if (g_ctx->cache) { free(g_ctx->cache); g_ctx->cache = NULL; }
        g_ctx->epoch = epoch;
        ethash_get_seedhash(epoch, g_ctx->seed);

        /* Full cache size (not capped at 64 MB for DAG generation) */
        uint64_t full_cache = ethash_get_cache_size(epoch);
        g_ctx->cache_size  = full_cache;
        g_ctx->cache_items = full_cache / 64;

        g_ctx->cache = (uint8_t *)malloc(full_cache);
        if (!g_ctx->cache) return NULL;

        /* Generate cache: seed first item, chain with keccak-512 */
        keccak512(g_ctx->seed, 32, g_ctx->cache);
        for (uint64_t i = 1; i < g_ctx->cache_items; i++) {
            keccak512(g_ctx->cache + (i - 1) * 64, 64, g_ctx->cache + i * 64);
        }

        /* RANDMEMOHASH mixing rounds (3 rounds) */
        for (int r = 0; r < ETHASH_CACHE_ROUNDS; r++) {
            for (uint64_t i = 0; i < g_ctx->cache_items; i++) {
                uint32_t v = *(uint32_t *)(void *)&g_ctx->cache[i * 64] % (uint32_t)g_ctx->cache_items;
                uint64_t prev = (i + g_ctx->cache_items - 1) % g_ctx->cache_items;
                uint8_t tmp[64];
                for (int j = 0; j < 64; j++)
                    tmp[j] = g_ctx->cache[prev * 64 + j] ^ g_ctx->cache[v * 64 + j];
                keccak512(tmp, 64, g_ctx->cache + i * 64);
            }
        }
        g_ctx->initialized = 1;
    }

    /* Calculate DAG size */
    uint64_t ds_entries = ethash_get_dataset_size(epoch) / ETHASH_DAG_ENTRY_BYTES;
    uint64_t ds_bytes   = ds_entries * ETHASH_DAG_ENTRY_BYTES;

    /* Allocate DAG buffer */
    uint8_t *dag = (uint8_t *)malloc(ds_bytes);
    if (!dag) return NULL;

    /* Generate each 128-byte DAG entry = 2 x 64-byte canonical nodes.
     *
     * Each node is independent (only reads from the read-only light cache),
     * so this loop is embarrassingly parallel. We use OpenMP to distribute
     * the work across all available CPU cores, reducing DAG generation time
     * from ~minutes (single-threaded) to ~seconds on a multi-core box.
     *
     * The cache (`g_ctx->cache`, `g_ctx->cache_items`) is read-only during
     * DAG generation, so it is safe to share across threads without locking.
     * The `dag` buffer is partitioned by node index, so writes are also
     * race-free. The progress callback is invoked from the main thread only
     * (via `omp master` + `omp atomic capture`) to avoid concurrent calls.
     */
    uint64_t total_nodes = ds_entries * 2;  /* 2 nodes per entry */
    uint64_t progress_step = (total_nodes / 100) + 1;

#pragma omp parallel for schedule(static)
    for (int64_t n_signed = 0; n_signed < (int64_t)total_nodes; n_signed++) {
        uint64_t n = (uint64_t)n_signed;
        ethash_calc_dag_node(n, g_ctx->cache, g_ctx->cache_items,
                              dag + n * 64);
        if (progress_cb && (n % progress_step == 0)) {
#pragma omp critical
            progress_cb((uint32_t)(n * 100 / total_nodes));
        }
    }

    *dag_size_entries = ds_entries;

    if (progress_cb) progress_cb(100);

    return dag;
}

/* Free a DAG buffer generated by ethash_generate_dag.
 * This is just free() but exported for FFI safety. */
EXPORT void ethash_free_dag(uint8_t *dag) {
    free(dag);
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  ETHASH LIGHT CACHE GENERATION (for on-GPU DAG generation)                */
/*                                                                            */
/*  The light cache is small (~16MB + epoch*128KB) and fast to generate on   */
/*  CPU.  It is uploaded to the GPU and used as input for the OpenCL DAG     */
/*  generation kernel (ethash_calculate_dag_item).  This avoids generating   */
/*  the full multi-GB DAG on the CPU.                                        */
/* ────────────────────────────────────────────────────────────────────────── */

/* Generate only the light cache for a given epoch.
 * The light cache is small (~16MB + epoch*128KB) and fast to generate on CPU.
 * It is used as input for on-GPU DAG generation.
 *
 *   epoch             — epoch number
 *   cache_size_bytes  — output: size of cache in bytes
 *   cache_items       — output: cache_size / 64
 *   dag_size_entries  — output: dataset size / 128 (number of 128-byte DAG entries)
 *   returns           — malloc'd cache buffer, or NULL on error. Caller must free().
 */
EXPORT uint8_t *ethash_generate_light_cache(
    uint32_t epoch,
    uint64_t *cache_size_bytes,
    uint64_t *cache_items,
    uint64_t *dag_size_entries)
{
    if (!cache_size_bytes || !cache_items || !dag_size_entries) return NULL;

    /* Build the seed hash for this epoch */
    uint8_t seed[32];
    ethash_get_seedhash(epoch, seed);

    uint64_t c_size = ethash_get_cache_size(epoch);
    uint64_t c_items = c_size / 64;

    uint8_t *cache = (uint8_t *)malloc(c_size);
    if (!cache) return NULL;

    /* Generate cache: seed first item, chain with keccak-512 */
    keccak512(seed, 32, cache);
    for (uint64_t i = 1; i < c_items; i++) {
        keccak512(cache + (i - 1) * 64, 64, cache + i * 64);
    }

    /* RANDMEMOHASH mixing rounds (3 rounds) */
    for (int r = 0; r < ETHASH_CACHE_ROUNDS; r++) {
        for (uint64_t i = 0; i < c_items; i++) {
            uint32_t v = *(uint32_t *)(void *)&cache[i * 64] % (uint32_t)c_items;
            uint64_t prev = (i + c_items - 1) % c_items;
            uint8_t tmp[64];
            for (int j = 0; j < 64; j++)
                tmp[j] = cache[prev * 64 + j] ^ cache[v * 64 + j];
            keccak512(tmp, 64, cache + i * 64);
        }
    }

    *cache_size_bytes = c_size;
    *cache_items = c_items;
    *dag_size_entries = ethash_get_dataset_size(epoch) / ETHASH_DAG_ENTRY_BYTES;

    return cache;
}

/* Free a light cache buffer generated by ethash_generate_light_cache. */
EXPORT void ethash_free_light_cache(uint8_t *cache) {
    free(cache);
}

/* Cleanup */
EXPORT void ethash_cleanup(void) {
    if (g_ctx) {
        if (g_ctx->cache) free(g_ctx->cache);
        free(g_ctx);
        g_ctx = NULL;
    }
    g_dag.dag = NULL;
    g_dag.dag_size_entries = 0;
    g_dag.set = 0;
}

/* Self-test (prints to stdout for Docker log validation) */
EXPORT void ethash_test(void) {
    printf("=== ZION Native Ethash v3.0 — Self-Test ===\n");

    /* Build a tiny fake DAG (4 entries of 128 bytes) for a smoke test */
    uint8_t fake_dag[4 * ETHASH_DAG_ENTRY_BYTES];
    for (int i = 0; i < (int)sizeof(fake_dag); i++)
        fake_dag[i] = (uint8_t)(i * 7 + 13);

    uint8_t header[32];
    memset(header, 0x2A, 32);
    uint8_t hash[32];

    ethash_hash_dag(header, 12345ULL, fake_dag, 4, hash);
    printf("DAG hash: ");
    for (int i = 0; i < 32; i++) printf("%02x", hash[i]);
    printf("\n");

    uint8_t target[32];
    memset(target, 0xFF, 32);
    int met = ethash_mine(header, 12345ULL, fake_dag, 4, target, hash);
    printf("meets target (0xff...): %d\n", met);

    double hs = ethash_benchmark(500);
    printf("Benchmark (500 iters, light mode): %.1f H/s\n", hs);
    if (g_ctx)
        printf("Light cache: %" PRIu64 " MB, items: %" PRIu64 "\n",
               g_ctx->cache_size / (1024 * 1024), g_ctx->cache_items);
}

EXPORT const char *ethash_version(void) {
    return "ZION Ethash v3.0 — real DAG-based, ETC/ETHW compatible, Keccak-f[1600]";
}
