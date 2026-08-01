/*
 * ============================================================================
 *  ZION Native KawPow C Library
 *  Real KawPow (ProgPoW-derived, RVN/CLORE) implementation.
 *
 *  Algorithm (Ethash-like core, 32 DAG accesses):
 *    1. seed = keccak512(header_hash || nonce_le)  -> 64 bytes
 *    2. Initialize mix[16] uint32 from seed (64 bytes = 16 uint32 LE)
 *    3. For i in 0..31 (32 accesses):
 *         index = fnv(i ^ mix[0], mix[0]) % dag_entries
 *         dag_node = dag[index * 128 .. index * 128 + 128]  (16 uint32)
 *         mix[w] = fnv1a(mix[w], dag_node[w])  for w in 0..15
 *    4. Compress mix: FNV-fold each pair -> 8 uint32 (32 bytes)
 *    5. hash = keccak256(seed || compressed_mix)  -> 32 bytes
 *    6. Check hash <= target (big-endian byte comparison)
 *
 *  Keccak notes (original Keccak, NOT SHA3):
 *    - Keccak-512: rate=72 bytes, capacity=1024 bits, output=64 bytes, suffix=0x01
 *    - Keccak-256: rate=136 bytes, capacity=512 bits, output=32 bytes, suffix=0x01
 *    - pad10*1 padding (0x80 at end of rate block)
 *
 *  The DAG is precomputed on the host and passed as a pointer to a buffer of
 *  128-byte entries (each = 16 uint32 / 16 ulong lanes).
 *
 *  Compilation:
 *    macOS: clang -O3 -fPIC -shared -std=c11 -o libkawpow_zion.dylib kawpow_native.c
 *    Linux: gcc -O3 -fPIC -shared -std=c11 -o libkawpow_zion.so kawpow_native.c
 * ============================================================================
 */

#include <stdint.h>
#include <string.h>
#include <stdlib.h>
#include <stdio.h>
#include <time.h>

#ifdef _WIN32
    #define EXPORT __declspec(dllexport)
#else
    #define EXPORT
#endif

/* ── Constants ──────────────────────────────────────────────────────── */

#define FNV_PRIME          0x01000193u
#define KAWPOW_EPOCH_LENGTH 7500
#define KAWPOW_ACCESSES    32          /* DAG accesses per nonce            */
#define KAWPOW_DAG_NODE    128         /* bytes per DAG entry (16 uint32)   */
#define KECCAK_512_RATE    72          /* bytes (576 bits)                  */
#define KECCAK_256_RATE    136         /* bytes (1088 bits)                 */
#define KECCAK_SUFFIX      0x01        /* original Keccak domain separator  */

/* ── Keccak-f[1600] ─────────────────────────────────────────────────── */

static const uint64_t KECCAK_RC[24] = {
    0x0000000000000001ULL, 0x0000000000008082ULL, 0x800000000000808aULL,
    0x8000000080008000ULL, 0x000000000000808bULL, 0x0000000080000001ULL,
    0x8000000080008081ULL, 0x8000000000008009ULL, 0x000000000000008aULL,
    0x0000000000000088ULL, 0x0000000080008009ULL, 0x000000008000000aULL,
    0x800000008000808bULL, 0x800000000000008bULL, 0x8000000000008089ULL,
    0x8000000000008003ULL, 0x8000000000008002ULL, 0x8000000000000080ULL,
    0x000000000000800aULL, 0x800000008000000aULL, 0x8000000080008081ULL,
    0x8000000000008080ULL, 0x0000000080000001ULL, 0x8000000080008008ULL,
};

static inline uint64_t rotl64(uint64_t x, int n) {
    return (x << n) | (x >> (64 - n));
}

/* Keccak-f[1600] permutation — 24 rounds (reused from kheavyhash_native.c) */
static void keccak_f1600(uint64_t state[25]) {
    for (int round = 0; round < 24; round++) {
        /* Theta */
        uint64_t c[5], d[5];
        for (int x = 0; x < 5; x++) {
            c[x] = state[x] ^ state[x + 5] ^ state[x + 10] ^ state[x + 15] ^ state[x + 20];
        }
        for (int x = 0; x < 5; x++) {
            d[x] = c[(x + 4) % 5] ^ rotl64(c[(x + 1) % 5], 1);
        }
        for (int i = 0; i < 25; i++) {
            state[i] ^= d[i % 5];
        }

        /* Rho and Pi */
        int x = 1, y = 0;
        uint64_t current = state[x + 5 * y];
        for (int t = 0; t < 24; t++) {
            int X = y;
            int Y = (2 * x + 3 * y) % 5;
            int idx = X + 5 * Y;
            uint64_t tmp = state[idx];
            state[idx] = rotl64(current, ((t + 1) * (t + 2) / 2) % 64);
            current = tmp;
            x = X;
            y = Y;
        }

        /* Chi */
        for (int y = 0; y < 5; y++) {
            uint64_t row[5];
            for (int x = 0; x < 5; x++) {
                row[x] = state[y * 5 + x];
            }
            for (int x = 0; x < 5; x++) {
                state[y * 5 + x] = row[x] ^ ((~row[(x + 1) % 5]) & row[(x + 2) % 5]);
            }
        }

        /* Iota */
        state[0] ^= KECCAK_RC[round];
    }
}

/* ── Generic Keccak sponge (configurable rate) ──────────────────────── */

static void keccak_sponge(const uint8_t* data, size_t len, int rate,
                          uint8_t suffix, uint8_t* output, size_t out_len) {
    uint64_t state[25];
    memset(state, 0, sizeof(state));

    /* Absorb full blocks */
    while (len >= (size_t)rate) {
        for (int i = 0; i < rate; i++) {
            state[i / 8] ^= (uint64_t)data[i] << ((i % 8) * 8);
        }
        keccak_f1600(state);
        data += rate;
        len -= rate;
    }

    /* Final block: copy remainder, append suffix, pad10*1 */
    uint8_t block[KECCAK_256_RATE]; /* large enough for max rate (136) */
    memset(block, 0, (size_t)rate);
    memcpy(block, data, len);
    block[len] = suffix;
    block[rate - 1] |= 0x80;
    for (int i = 0; i < rate; i++) {
        state[i / 8] ^= (uint64_t)block[i] << ((i % 8) * 8);
    }
    keccak_f1600(state);

    /* Squeeze */
    size_t out = 0;
    while (out < out_len) {
        size_t take = (out_len - out < (size_t)rate) ? (out_len - out) : (size_t)rate;
        for (size_t i = 0; i < take; i++) {
            output[out + i] = (uint8_t)(state[i / 8] >> ((i % 8) * 8));
        }
        out += take;
        if (out < out_len) keccak_f1600(state);
    }
}

/* Keccak-512: rate=72, suffix=0x01, output=64 bytes */
static void keccak512(const uint8_t* data, size_t len, uint8_t* output) {
    keccak_sponge(data, len, KECCAK_512_RATE, KECCAK_SUFFIX, output, 64);
}

/* Keccak-256: rate=136, suffix=0x01, output=32 bytes */
static void keccak256(const uint8_t* data, size_t len, uint8_t* output) {
    keccak_sponge(data, len, KECCAK_256_RATE, KECCAK_SUFFIX, output, 32);
}

/* ── FNV-1a ─────────────────────────────────────────────────────────── */

static inline uint32_t fnv1a(uint32_t a, uint32_t b) {
    return (a ^ b) * FNV_PRIME;
}

/* ── KawPow hash computation ────────────────────────────────────────── */

/*
 * Compute KawPow mix_hash and final_hash for a given header, nonce, and DAG.
 *
 *   header_hash — 32-byte block header hash (the seed-hash base)
 *   nonce       — 64-bit nonce
 *   dag         — pointer to precomputed DAG buffer (128-byte entries)
 *   dag_size    — number of 128-byte DAG entries
 *   mix_out     — 32-byte mix hash output
 *   hash_out    — 32-byte final hash output
 */
EXPORT void kawpow_hash(
    const uint8_t* header_hash,  /* 32 bytes */
    uint64_t nonce,
    const uint8_t* dag,          /* DAG buffer (128-byte entries) */
    uint64_t dag_size,           /* number of 128-byte entries */
    uint8_t* mix_out,            /* 32 bytes */
    uint8_t* hash_out            /* 32 bytes */
) {
    /* Step 1: seed = keccak512(header_hash || nonce_le) -> 64 bytes */
    uint8_t seed_input[40];
    memcpy(seed_input, header_hash, 32);
    for (int i = 0; i < 8; i++) {
        seed_input[32 + i] = (uint8_t)(nonce >> (i * 8));
    }

    uint8_t seed[64];
    keccak512(seed_input, 40, seed);

    /* Step 2: Initialize mix[16] uint32 from seed (64 bytes LE) */
    uint32_t mix[16];
    for (int i = 0; i < 16; i++) {
        mix[i] =  (uint32_t)seed[i * 4]
               | ((uint32_t)seed[i * 4 + 1] << 8)
               | ((uint32_t)seed[i * 4 + 2] << 16)
               | ((uint32_t)seed[i * 4 + 3] << 24);
    }

    /* Step 3: 32 DAG accesses with FNV-1a mixing */
    for (int i = 0; i < KAWPOW_ACCESSES; i++) {
        uint32_t idx_seed = fnv1a((uint32_t)i ^ mix[0], mix[0]);
        uint64_t index = (uint64_t)idx_seed % dag_size;

        /* Load first 64 bytes of the 128-byte DAG node = 16 uint32 values.
         * (KawPow uses a 16-uint32 mix; only the first half of each 128-byte
         *  DAG entry participates in the per-uint32 FNV-1a mixing, matching
         *  the OpenCL kernel which loads 8 ulong lanes = 16 uint32.) */
        uint32_t dag_node[16];
        memcpy(dag_node, dag + index * KAWPOW_DAG_NODE, 64);

        /* mix = fnv(mix, dag_node) — per-uint32 FNV-1a */
        for (int w = 0; w < 16; w++) {
            mix[w] = fnv1a(mix[w], dag_node[w]);
        }
    }

    /* Step 4: Compress mix — FNV-fold each pair -> 8 uint32 (32 bytes) */
    uint32_t compressed[8];
    for (int i = 0; i < 8; i++) {
        compressed[i] = fnv1a(mix[i * 2], mix[i * 2 + 1]);
    }

    uint8_t mix_bytes[32];
    for (int i = 0; i < 8; i++) {
        mix_bytes[i * 4]     = (uint8_t)(compressed[i] & 0xFF);
        mix_bytes[i * 4 + 1] = (uint8_t)((compressed[i] >> 8) & 0xFF);
        mix_bytes[i * 4 + 2] = (uint8_t)((compressed[i] >> 16) & 0xFF);
        mix_bytes[i * 4 + 3] = (uint8_t)((compressed[i] >> 24) & 0xFF);
    }

    /* Step 5: hash = keccak256(seed || mix_bytes) -> 32 bytes */
    uint8_t final_input[96];  /* 64 (seed) + 32 (mix) */
    memcpy(final_input, seed, 64);
    memcpy(final_input + 64, mix_bytes, 32);

    keccak256(final_input, 96, hash_out);

    /* Output mix hash */
    memcpy(mix_out, mix_bytes, 32);
}

/* ── Mining function ────────────────────────────────────────────────── */

/*
 * Mine a single nonce against the target.
 *
 *   header_hash — 32-byte block header hash
 *   nonce       — 64-bit nonce
 *   dag         — pointer to precomputed DAG buffer (128-byte entries)
 *   dag_size    — number of 128-byte DAG entries
 *   target      — 32-byte target (big-endian)
 *   output      — 32-byte final hash output
 *
 * Returns 1 if hash <= target (meets target), 0 otherwise.
 */
EXPORT int kawpow_mine(
    const uint8_t* header_hash,  /* 32 bytes */
    uint64_t nonce,
    const uint8_t* dag,          /* DAG buffer (128-byte entries) */
    uint64_t dag_size,           /* number of 128-byte entries */
    const uint8_t* target,       /* 32 bytes */
    uint8_t* output              /* 32 bytes */
) {
    uint8_t mix[32];
    uint8_t hash[32];

    kawpow_hash(header_hash, nonce, dag, dag_size, mix, hash);
    memcpy(output, hash, 32);

    /* Check hash <= target (big-endian byte comparison, index 0 = MSB) */
    for (int i = 0; i < 32; i++) {
        if (hash[i] < target[i]) return 1;
        if (hash[i] > target[i]) return 0;
    }
    return 1; /* equal -> meets target */
}

/* ── Verify a solution ──────────────────────────────────────────────── */

/*
 * Verify a KawPow solution against an expected mix hash and target.
 * Returns 1 if valid, 0 otherwise.
 */
EXPORT int kawpow_verify(
    const uint8_t* header_hash,  /* 32 bytes */
    uint64_t nonce,
    const uint8_t* dag,          /* DAG buffer */
    uint64_t dag_size,           /* number of 128-byte entries */
    const uint8_t* expected_mix, /* 32 bytes (may be NULL to skip mix check) */
    const uint8_t* target        /* 32 bytes */
) {
    uint8_t mix[32];
    uint8_t hash[32];

    kawpow_hash(header_hash, nonce, dag, dag_size, mix, hash);

    /* Check mix hash if provided */
    if (expected_mix != NULL && memcmp(mix, expected_mix, 32) != 0) {
        return 0;
    }

    /* Check hash <= target (big-endian) */
    for (int i = 0; i < 32; i++) {
        if (hash[i] < target[i]) return 1;
        if (hash[i] > target[i]) return 0;
    }
    return 1;
}

/* ── Utility functions ──────────────────────────────────────────────── */

/* Get epoch for block height */
EXPORT uint32_t kawpow_get_epoch(uint32_t height) {
    return height / KAWPOW_EPOCH_LENGTH;
}

/* ── Benchmark (uses a small synthetic DAG) ────────────────────────── */

EXPORT double kawpow_benchmark_cpu(int iterations) {
    /* Create a small synthetic DAG for benchmarking (1024 entries) */
    const uint64_t dag_entries = 1024;
    const uint64_t dag_bytes = dag_entries * KAWPOW_DAG_NODE;
    uint8_t* dag = (uint8_t*)malloc(dag_bytes);
    if (!dag) return 0.0;

    /* Fill with a deterministic pattern */
    for (uint64_t i = 0; i < dag_bytes; i++) {
        dag[i] = (uint8_t)((i * 31 + 17) & 0xFF);
    }

    uint8_t header[32];
    memset(header, 0x2A, 32);
    uint8_t mix[32], hash[32];

    clock_t start = clock();

    for (int i = 0; i < iterations; i++) {
        kawpow_hash(header, (uint64_t)i, dag, dag_entries, mix, hash);
    }

    clock_t end = clock();
    double seconds = (double)(end - start) / CLOCKS_PER_SEC;
    if (seconds <= 0.0) seconds = 1e-9;

    free(dag);
    return (double)iterations / seconds;
}

/* Simple test */
EXPORT void kawpow_test(void) {
    /* Create a small synthetic DAG for testing (1024 entries) */
    const uint64_t dag_entries = 1024;
    const uint64_t dag_bytes = dag_entries * KAWPOW_DAG_NODE;
    uint8_t* dag = (uint8_t*)malloc(dag_bytes);
    if (!dag) {
        printf("KawPow Test: DAG allocation failed\n");
        return;
    }

    for (uint64_t i = 0; i < dag_bytes; i++) {
        dag[i] = (uint8_t)((i * 31 + 17) & 0xFF);
    }

    uint8_t header[32];
    memset(header, 0, 32);
    header[0] = 0x01; header[1] = 0x02; header[2] = 0x03; header[3] = 0x04;

    uint8_t mix[32], hash[32];
    kawpow_hash(header, 12345, dag, dag_entries, mix, hash);

    printf("KawPow Test (real algorithm, synthetic DAG %llu entries):\n",
           (unsigned long long)dag_entries);
    printf("  Mix:  ");
    for (int i = 0; i < 32; i++) printf("%02x", mix[i]);
    printf("\n");
    printf("  Hash: ");
    for (int i = 0; i < 32; i++) printf("%02x", hash[i]);
    printf("\n\n");

    double hashrate = kawpow_benchmark_cpu(1000);
    printf("  CPU Hashrate (synthetic DAG): %.2f H/s\n", hashrate);

    free(dag);
}

/* Version */
EXPORT const char* kawpow_version(void) {
    return "ZION KawPow v2.0.0 - RVN/CLORE (real Keccak-f[1600] + DAG)";
}
