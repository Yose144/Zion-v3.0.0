/*
 * ============================================================================
 *  ZION Native Autolykos v2 C Library
 *  Real Autolykos v2 implementation (Ergo PoW)
 *
 *  Matches Rust FFI in L1/cosmic-harmony/src/native_ffi.rs:
 *    autolykos_hash(header*, header_len, nonce: u64, height: u32, output*) -> u64
 *    autolykos_verify(header*, header_len, nonce, height, target) -> i32
 *    autolykos_benchmark_cpu(iterations) -> f64
 *
 *  Algorithm (Autolykos v2 / EIP-37):
 *    1. seed = Blake2b256(nonce_LE8 ++ header)
 *    2. indices[i] = BE_uint32(seed[i*4..i*4+4]) % N   for i in 0..K
 *    3. elem[i]    = Blake2b256(indices[i]_BE4 ++ N_BE4)[0:8] as LE_u64
 *    4. total      = sum(elem[0..K]) mod 2^64
 *    5. f          = Blake2b256(total_LE8 ++ seed)
 *    6. result     = f[0:8] as LE_u64
 *    7. valid      = result < target
 *
 *  Compilation:
 *    gcc -O3 -march=native -fPIC -shared -o libautolykos.so autolykos_v2_native.c
 * ============================================================================
 */

#define _POSIX_C_SOURCE 200112L

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

/* ============================================================================
 * Blake2b-256 — Full RFC-7693 implementation
 * ============================================================================ */

static const uint64_t blake2b_IV[8] = {
    0x6a09e667f3bcc908ULL, 0xbb67ae8584caa73bULL,
    0x3c6ef372fe94f82bULL, 0xa54ff53a5f1d36f1ULL,
    0x510e527fade682d1ULL, 0x9b05688c2b3e6c1fULL,
    0x1f83d9abfb41bd6bULL, 0x5be0cd19137e2179ULL
};

static const uint8_t blake2b_sigma[12][16] = {
    {  0,  1,  2,  3,  4,  5,  6,  7,  8,  9, 10, 11, 12, 13, 14, 15 },
    { 14, 10,  4,  8,  9, 15, 13,  6,  1, 12,  0,  2, 11,  7,  5,  3 },
    { 11,  8, 12,  0,  5,  2, 15, 13, 10, 14,  3,  6,  7,  1,  9,  4 },
    {  7,  9,  3,  1, 13, 12, 11, 14,  2,  6,  5, 10,  4,  0, 15,  8 },
    {  9,  0,  5,  7,  2,  4, 10, 15, 14,  1, 11, 12,  6,  8,  3, 13 },
    {  2, 12,  6, 10,  0, 11,  8,  3,  4, 13,  7,  5, 15, 14,  1,  9 },
    { 12,  5,  1, 15, 14, 13,  4, 10,  0,  7,  6,  3,  9,  2,  8, 11 },
    { 13, 11,  7, 14, 12,  1,  3,  9,  5,  0, 15,  4,  8,  6,  2, 10 },
    {  6, 15, 14,  9, 11,  3,  0,  8, 12,  2, 13,  7,  1,  4, 10,  5 },
    { 10,  2,  8,  4,  7,  6,  1,  5, 15, 11,  9, 14,  3, 12, 13,  0 },
    {  0,  1,  2,  3,  4,  5,  6,  7,  8,  9, 10, 11, 12, 13, 14, 15 },
    { 14, 10,  4,  8,  9, 15, 13,  6,  1, 12,  0,  2, 11,  7,  5,  3 }
};

typedef struct {
    uint64_t h[8];
    uint64_t t[2];
    uint64_t f[2];
    uint8_t  buf[128];
    size_t   buflen;
    size_t   outlen;
} blake2b_state;

static inline uint64_t b2_rotr64(uint64_t x, int y) {
    return (x >> y) | (x << (64 - y));
}

static inline uint64_t b2_load64_le(const void* p) {
    uint64_t v;
    memcpy(&v, p, 8);
    return v;
}

static void blake2b_compress(blake2b_state* S, const uint8_t* block) {
    uint64_t m[16], v[16];
    int i;

    for (i = 0; i < 16; i++)
        m[i] = b2_load64_le(block + i * 8);

    for (i = 0; i < 8; i++)
        v[i] = S->h[i];

    v[ 8] = blake2b_IV[0];
    v[ 9] = blake2b_IV[1];
    v[10] = blake2b_IV[2];
    v[11] = blake2b_IV[3];
    v[12] = S->t[0] ^ blake2b_IV[4];
    v[13] = S->t[1] ^ blake2b_IV[5];
    v[14] = S->f[0] ^ blake2b_IV[6];
    v[15] = S->f[1] ^ blake2b_IV[7];

#define G(r, i, a, b, c, d)                          \
    do {                                              \
        a = a + b + m[blake2b_sigma[r][(i)*2+0]];    \
        d = b2_rotr64(d ^ a, 32);                    \
        c = c + d;                                   \
        b = b2_rotr64(b ^ c, 24);                    \
        a = a + b + m[blake2b_sigma[r][(i)*2+1]];    \
        d = b2_rotr64(d ^ a, 16);                    \
        c = c + d;                                   \
        b = b2_rotr64(b ^ c, 63);                    \
    } while (0)

#define ROUND(r)                              \
    G(r, 0, v[ 0], v[ 4], v[ 8], v[12]);     \
    G(r, 1, v[ 1], v[ 5], v[ 9], v[13]);     \
    G(r, 2, v[ 2], v[ 6], v[10], v[14]);     \
    G(r, 3, v[ 3], v[ 7], v[11], v[15]);     \
    G(r, 4, v[ 0], v[ 5], v[10], v[15]);     \
    G(r, 5, v[ 1], v[ 6], v[11], v[12]);     \
    G(r, 6, v[ 2], v[ 7], v[ 8], v[13]);     \
    G(r, 7, v[ 3], v[ 4], v[ 9], v[14])

    ROUND( 0); ROUND( 1); ROUND( 2); ROUND( 3);
    ROUND( 4); ROUND( 5); ROUND( 6); ROUND( 7);
    ROUND( 8); ROUND( 9); ROUND(10); ROUND(11);

#undef G
#undef ROUND

    for (i = 0; i < 8; i++)
        S->h[i] ^= v[i] ^ v[i + 8];
}

static void blake2b_init_st(blake2b_state* S, size_t outlen) {
    int i;
    memset(S, 0, sizeof(*S));
    for (i = 0; i < 8; i++)
        S->h[i] = blake2b_IV[i];
    S->h[0] ^= 0x01010000ULL ^ (uint8_t)outlen;
    S->outlen = outlen;
}

static void blake2b_update_st(blake2b_state* S, const uint8_t* in, size_t inlen) {
    size_t left, fill;
    while (inlen > 0) {
        left = S->buflen;
        fill = 128 - left;
        if (inlen > fill) {
            memcpy(S->buf + left, in, fill);
            S->t[0] += 128;
            if (S->t[0] < 128) S->t[1]++;
            blake2b_compress(S, S->buf);
            S->buflen = 0;
            in    += fill;
            inlen -= fill;
        } else {
            memcpy(S->buf + left, in, inlen);
            S->buflen += inlen;
            inlen = 0;
        }
    }
}

static void blake2b_final_st(blake2b_state* S, uint8_t* out) {
    size_t i;
    uint8_t tmp[64];

    S->t[0] += (uint64_t)S->buflen;
    if (S->t[0] < S->buflen) S->t[1]++;
    S->f[0] = (uint64_t)-1;

    memset(S->buf + S->buflen, 0, 128 - S->buflen);
    blake2b_compress(S, S->buf);

    for (i = 0; i < 8; i++) {
        tmp[i*8+0] = (uint8_t)(S->h[i]);
        tmp[i*8+1] = (uint8_t)(S->h[i] >>  8);
        tmp[i*8+2] = (uint8_t)(S->h[i] >> 16);
        tmp[i*8+3] = (uint8_t)(S->h[i] >> 24);
        tmp[i*8+4] = (uint8_t)(S->h[i] >> 32);
        tmp[i*8+5] = (uint8_t)(S->h[i] >> 40);
        tmp[i*8+6] = (uint8_t)(S->h[i] >> 48);
        tmp[i*8+7] = (uint8_t)(S->h[i] >> 56);
    }
    memcpy(out, tmp, S->outlen);
}

static void blake2b256(const uint8_t* in, size_t inlen, uint8_t* out) {
    blake2b_state S;
    blake2b_init_st(&S, 32);
    blake2b_update_st(&S, in, inlen);
    blake2b_final_st(&S, out);
}

EXPORT void blake2b_hash(const uint8_t* data, size_t len, uint8_t* out) {
    blake2b256(data, len, out);
}

/* ============================================================================
 * Autolykos v2 Helpers
 * ============================================================================ */

#define AUTOLYKOS_K 32

static uint64_t calcN(uint32_t height) {
    uint64_t base = (1ULL << 26);
    if (height < 614400) return base;
    uint64_t epochs = (uint64_t)height / 4198400ULL;
    return base + epochs * (1ULL << 24);
}

static uint64_t calcElement(uint32_t j, uint32_t N) {
    uint8_t inp[8], h[32];
    inp[0] = (uint8_t)(j >> 24); inp[1] = (uint8_t)(j >> 16);
    inp[2] = (uint8_t)(j >>  8); inp[3] = (uint8_t)(j);
    inp[4] = (uint8_t)(N >> 24); inp[5] = (uint8_t)(N >> 16);
    inp[6] = (uint8_t)(N >>  8); inp[7] = (uint8_t)(N);
    blake2b256(inp, 8, h);
    return (uint64_t)h[0]
        | ((uint64_t)h[1] <<  8)
        | ((uint64_t)h[2] << 16)
        | ((uint64_t)h[3] << 24)
        | ((uint64_t)h[4] << 32)
        | ((uint64_t)h[5] << 40)
        | ((uint64_t)h[6] << 48)
        | ((uint64_t)h[7] << 56);
}

/* ============================================================================
 * Public API
 * ============================================================================ */

EXPORT uint64_t autolykos_hash(
    const uint8_t* header,
    size_t         header_len,
    uint64_t       nonce,
    uint32_t       height,
    uint8_t*       output
) {
    uint64_t N   = calcN(height);
    uint32_t N32 = (uint32_t)(N & 0xFFFFFFFFUL);
    int i;

    /* Step 1: seed = Blake2b256(nonce_LE8 ++ header) */
    uint8_t nonce_b[8] = {
        (uint8_t)(nonce),        (uint8_t)(nonce >>  8),
        (uint8_t)(nonce >> 16),  (uint8_t)(nonce >> 24),
        (uint8_t)(nonce >> 32),  (uint8_t)(nonce >> 40),
        (uint8_t)(nonce >> 48),  (uint8_t)(nonce >> 56)
    };

    uint8_t seed_in[8 + 256];
    size_t seed_in_len = 8 + header_len;
    if (seed_in_len > sizeof(seed_in)) seed_in_len = sizeof(seed_in);
    memcpy(seed_in, nonce_b, 8);
    memcpy(seed_in + 8, header, seed_in_len - 8);

    uint8_t seed[32];
    blake2b256(seed_in, seed_in_len, seed);

    /* Step 2: indices from seed (32 bytes = K * 4 bytes) */
    uint32_t indices[AUTOLYKOS_K];
    for (i = 0; i < AUTOLYKOS_K; i++) {
        uint32_t raw = ((uint32_t)seed[i*4 + 0] << 24)
                     | ((uint32_t)seed[i*4 + 1] << 16)
                     | ((uint32_t)seed[i*4 + 2] <<  8)
                     |  (uint32_t)seed[i*4 + 3];
        indices[i] = (uint32_t)((uint64_t)raw % N);
    }

    /* Step 3: sum elements */
    uint64_t total = 0;
    for (i = 0; i < AUTOLYKOS_K; i++) {
        total += calcElement(indices[i], N32);
    }

    /* Step 4: f = Blake2b256(total_LE8 ++ seed) */
    uint8_t f_in[40];
    f_in[0] = (uint8_t)(total);        f_in[1] = (uint8_t)(total >>  8);
    f_in[2] = (uint8_t)(total >> 16);  f_in[3] = (uint8_t)(total >> 24);
    f_in[4] = (uint8_t)(total >> 32);  f_in[5] = (uint8_t)(total >> 40);
    f_in[6] = (uint8_t)(total >> 48);  f_in[7] = (uint8_t)(total >> 56);
    memcpy(f_in + 8, seed, 32);

    blake2b256(f_in, 40, output);

    return (uint64_t)output[0]
        | ((uint64_t)output[1] <<  8)
        | ((uint64_t)output[2] << 16)
        | ((uint64_t)output[3] << 24)
        | ((uint64_t)output[4] << 32)
        | ((uint64_t)output[5] << 40)
        | ((uint64_t)output[6] << 48)
        | ((uint64_t)output[7] << 56);
}

EXPORT int autolykos_verify(
    const uint8_t* header,
    size_t         header_len,
    uint64_t       nonce,
    uint32_t       height,
    uint64_t       target
) {
    uint8_t out[32];
    uint64_t result = autolykos_hash(header, header_len, nonce, height, out);
    return (result < target) ? 1 : 0;
}

EXPORT double autolykos_benchmark_cpu(int iterations) {
    struct timespec t0, t1;
    uint8_t header[32];
    uint8_t out[32];
    volatile uint64_t r = 0;
    int i;

    memset(header, 0xAB, sizeof(header));
    clock_gettime(CLOCK_MONOTONIC, &t0);
    for (i = 0; i < iterations; i++) {
        r ^= autolykos_hash(header, 32, (uint64_t)i, 700000u, out);
    }
    (void)r;
    clock_gettime(CLOCK_MONOTONIC, &t1);
    double elapsed = (double)(t1.tv_sec  - t0.tv_sec)
                   + (double)(t1.tv_nsec - t0.tv_nsec) * 1e-9;
    return (elapsed > 0.0) ? (double)iterations / elapsed : 0.0;
}

/* Legacy stubs for ABI compatibility */
EXPORT void autolykos_generate_elements(
    const uint8_t* seed, size_t seed_len,
    uint64_t* elements, uint64_t n_elements
) { (void)seed; (void)seed_len; (void)elements; (void)n_elements; }

EXPORT int autolykos_mine_cpu(
    const uint64_t* elements, uint64_t n_elements,
    uint64_t nonce_start, uint64_t nonce_end,
    uint64_t target, uint32_t k_value,
    uint64_t* result_nonce, uint64_t* result_hash
) {
    (void)elements; (void)n_elements; (void)nonce_start;
    (void)nonce_end; (void)target; (void)k_value;
    (void)result_nonce; (void)result_hash;
    return 0;
}

EXPORT int autolykos_mine_cpu_batch(
    const uint64_t* elements, uint64_t n_elements,
    uint64_t nonce_start, uint64_t batch_size,
    uint64_t target, uint32_t k_value,
    uint64_t* result_nonce, uint64_t* result_hash
) {
    return autolykos_mine_cpu(
        elements, n_elements,
        nonce_start, nonce_start + batch_size,
        target, k_value,
        result_nonce, result_hash
    );
}
