// Minimal Blake2b for the Equihash 144,5 solver — RFC 7693 reference core.
// Compiled into equitromp144; the state object is opaque to equi_miner.c,
// which only clones/updates/finalizes it through the registered callbacks.
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

typedef struct {
    uint64_t h[8];
    uint64_t t[2];
    uint8_t buf[128];
    size_t buflen;
    uint8_t outlen;
} eq144_state;

static const uint64_t eq144_iv[8] = {
    0x6a09e667f3bcc908ULL, 0xbb67ae8584caa73bULL,
    0x3c6ef372fe94f82bULL, 0xa54ff53a5f1d36f1ULL,
    0x510e527fade682d1ULL, 0x9b05688c2b3e6c1fULL,
    0x1f83d9abfb41bd6bULL, 0x5be0cd19137e2179ULL,
};

static const uint8_t eq144_sigma[12][16] = {
    { 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15 },
    { 14, 10, 4, 8, 9, 15, 13, 6, 1, 12, 0, 2, 11, 7, 5, 3 },
    { 11, 8, 12, 0, 5, 2, 15, 13, 10, 14, 3, 6, 7, 1, 9, 4 },
    { 7, 9, 3, 1, 13, 12, 11, 14, 2, 6, 5, 10, 4, 0, 15, 8 },
    { 9, 0, 5, 7, 2, 4, 10, 15, 14, 1, 11, 12, 6, 8, 3, 13 },
    { 2, 12, 6, 10, 0, 11, 8, 3, 4, 13, 7, 5, 15, 14, 1, 9 },
    { 12, 5, 1, 15, 14, 13, 4, 10, 0, 7, 6, 3, 9, 2, 8, 11 },
    { 13, 11, 7, 14, 12, 1, 3, 9, 5, 0, 15, 4, 8, 6, 2, 10 },
    { 6, 15, 14, 9, 11, 3, 0, 8, 12, 2, 13, 7, 1, 4, 10, 5 },
    { 10, 2, 8, 4, 7, 6, 1, 5, 15, 11, 9, 14, 3, 12, 13, 0 },
    { 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15 },
    { 14, 10, 4, 8, 9, 15, 13, 6, 1, 12, 0, 2, 11, 7, 5, 3 },
};

static uint64_t load64(const uint8_t *p) {
    uint64_t w = 0;
    for (int i = 0; i < 8; i++) w |= (uint64_t)p[i] << (8 * i);
    return w;
}

static void store64(uint8_t *p, uint64_t w) {
    for (int i = 0; i < 8; i++) p[i] = (uint8_t)(w >> (8 * i));
}

static uint64_t rotr64(uint64_t x, int c) { return (x >> c) | (x << (64 - c)); }

static void eq144_compress(eq144_state *S, const uint8_t block[128], int last) {
    uint64_t m[16], v[16];
    for (int i = 0; i < 16; i++) m[i] = load64(block + i * 8);
    for (int i = 0; i < 8; i++) v[i] = S->h[i];
    for (int i = 0; i < 8; i++) v[i + 8] = eq144_iv[i];
    v[12] ^= S->t[0];
    v[13] ^= S->t[1];
    if (last) v[14] = ~v[14];
#define G(r,i,a,b,c,d)                                                   \
    a = a + b + m[eq144_sigma[r][2 * i + 0]]; d = rotr64(d ^ a, 32);     \
    c = c + d;                      b = rotr64(b ^ c, 24);               \
    a = a + b + m[eq144_sigma[r][2 * i + 1]]; d = rotr64(d ^ a, 16);     \
    c = c + d;                      b = rotr64(b ^ c, 63);
    for (int r = 0; r < 12; r++) {
        G(r, 0, v[0], v[4], v[8],  v[12]);
        G(r, 1, v[1], v[5], v[9],  v[13]);
        G(r, 2, v[2], v[6], v[10], v[14]);
        G(r, 3, v[3], v[7], v[11], v[15]);
        G(r, 4, v[0], v[5], v[10], v[15]);
        G(r, 5, v[1], v[6], v[11], v[12]);
        G(r, 6, v[2], v[7], v[8],  v[13]);
        G(r, 7, v[3], v[4], v[9],  v[14]);
    }
#undef G
    for (int i = 0; i < 8; i++) S->h[i] ^= v[i] ^ v[i + 8];
}

static void eq144_update(eq144_state *S, const uint8_t *in, size_t len) {
    while (len > 0) {
        size_t fill = 128 - S->buflen;
        if (len > fill) {
            memcpy(S->buf + S->buflen, in, fill);
            S->buflen = 0;
            S->t[0] += 128;
            if (S->t[0] < 128) S->t[1]++;
            eq144_compress(S, S->buf, 0);
            in += fill;
            len -= fill;
        } else {
            memcpy(S->buf + S->buflen, in, len);
            S->buflen += len;
            return;
        }
    }
}

// ── Callbacks registered with the solver (blake2b.h signatures) ────────

void *eq144_cb_clone(const void *state) {
    eq144_state *n = malloc(sizeof(eq144_state));
    memcpy(n, state, sizeof(eq144_state));
    return n;
}

void eq144_cb_free(void *state) { free(state); }

void eq144_cb_update(void *state, const uint8_t *in, size_t len) {
    eq144_update((eq144_state *)state, in, len);
}

void eq144_cb_finalize(void *state, uint8_t *out, size_t out_len) {
    eq144_state *S = (eq144_state *)state;
    uint8_t buf[64];
    S->t[0] += S->buflen;
    if (S->t[0] < S->buflen) S->t[1]++;
    memset(S->buf + S->buflen, 0, 128 - S->buflen);
    eq144_compress(S, S->buf, 1);
    for (int i = 0; i < 8; i++) store64(buf + i * 8, S->h[i]);
    memcpy(out, buf, out_len);
}

// ── Job context helper for the Rust side ──────────────────────────────
// Builds a midstate: init(outlen, pers16) then update(input). The solver
// clones this per hash index — one alloc+memcpy of ~300 bytes.

void *eq144_ctx_create(const uint8_t *pers16, const uint8_t *input,
                       size_t input_len, uint8_t outlen) {
    eq144_state *S = malloc(sizeof(eq144_state));
    if (!S) return NULL;
    for (int i = 0; i < 8; i++) S->h[i] = eq144_iv[i];
    // parameter block: digest_len | key_len=0 | fanout=1 | depth=1
    S->h[0] ^= 0x01010000 ^ outlen;
    // personalization occupies param block bytes 32..47 → h[6],h[7]
    S->h[6] ^= load64(pers16);
    S->h[7] ^= load64(pers16 + 8);
    S->t[0] = S->t[1] = 0;
    S->buflen = 0;
    S->outlen = outlen;
    eq144_update(S, input, input_len);
    return S;
}

void eq144_ctx_free(void *ctx) { free(ctx); }

void eq144_ctx_update(void *ctx, const uint8_t *data, size_t len) {
    eq144_update((eq144_state *)ctx, data, len);
}
