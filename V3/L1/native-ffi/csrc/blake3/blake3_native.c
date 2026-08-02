/*
 * ============================================================================
 *  ZION Native Blake3 Library
 *  Blake3 implementation for DCR (Decred) and ALPH (Alephium) mining.
 *
 *  Algorithm:
 *    DCR  — blake3(header || nonce_le)           [single hash]
 *    ALPH — blake3(blake3(nonce_24B || header))   [double hash]
 *
 *  This is a from-scratch C implementation of the BLAKE3 hash function,
 *  following the official reference implementation's algorithm:
 *    - 7-round compression function (G function with rotations 16,12,8,7)
 *    - 1024-byte chunks, Merkle-tree chaining
 *    - Extendable output via root-node counter re-compression
 *
 *  Compilation:
 *    macOS: clang -O3 -fPIC -shared -o libblake3_zion.dylib blake3_native.c
 *    Linux: gcc -O3 -fPIC -shared -o libblake3_zion.so blake3_native.c
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

#define BLAKE3_BLOCK_LEN     64
#define BLAKE3_CHUNK_LEN     1024
#define BLAKE3_KEY_LEN       32
#define BLAKE3_OUT_LEN       32
#define BLAKE3_MAX_DEPTH     54

/* Blake3 IV (same as SHA-256 IV, used as initial chaining value) */
static const uint32_t BLAKE3_IV[8] = {
    0x6A09E667, 0xBB67AE85, 0x3C6EF372, 0xA54FF53A,
    0x510E527F, 0x9B05688C, 0x1F83D9AB, 0x5BE0CD19
};

/* Blake3 domain flags */
#define FLAG_CHUNK_START   (1u << 0)  /* 0x01 */
#define FLAG_CHUNK_END     (1u << 1)  /* 0x02 */
#define FLAG_PARENT        (1u << 2)  /* 0x04 */
#define FLAG_ROOT          (1u << 3)  /* 0x08 */
#define FLAG_KEYED_HASH    (1u << 4)  /* 0x10 */
#define FLAG_DERIVE_KEY_CONTEXT (1u << 5) /* 0x20 */

/* Message schedule (same as BLAKE2b SIGMA table, 7 permutations) */
static const uint8_t MSG_SCHEDULE[7][16] = {
    { 0,  1,  2,  3,  4,  5,  6,  7,  8,  9, 10, 11, 12, 13, 14, 15 },
    { 2,  6,  3, 10,  7,  0,  4, 13,  1, 11, 12,  5,  9, 14, 15,  8 },
    { 3,  4, 10, 12, 13,  2,  7, 14,  6,  5,  9,  0, 11, 15,  8,  1 },
    {10,  7, 12,  9, 14,  3, 13, 15,  4,  0, 11,  2,  5,  8,  1,  6 },
    {12, 13,  9, 11, 15, 10, 14,  8,  7,  2,  5,  3,  0,  1,  6,  4 },
    { 9, 14, 11,  5,  8, 12, 15,  1, 13,  3,  0, 10,  2,  6,  4,  7 },
    {11, 15,  5,  0,  1,  9,  8,  6, 14, 10,  2, 12,  3,  4,  7, 13 }
};

/* ── Low-level primitives ───────────────────────────────────────────── */

static inline uint32_t rotr32(uint32_t x, int n) {
    return (x >> n) | (x << (32 - n));
}

/* G function: mixing of four state words with two message words.
   Rotations: r1=16, r2=12, r3=8, r4=7 */
static inline void g(
    uint32_t* state, int a, int b, int c, int d,
    uint32_t mx, uint32_t my
) {
    state[a] = state[a] + state[b] + mx;
    state[d] = rotr32(state[d] ^ state[a], 16);
    state[c] = state[c] + state[d];
    state[b] = rotr32(state[b] ^ state[c], 12);
    state[a] = state[a] + state[b] + my;
    state[d] = rotr32(state[d] ^ state[a], 8);
    state[c] = state[c] + state[d];
    state[b] = rotr32(state[b] ^ state[c], 7);
}

/* Round function: 4 column G calls + 4 diagonal G calls */
static void round_fn(uint32_t state[16], const uint32_t msg[16], int round) {
    const uint8_t* s = MSG_SCHEDULE[round % 7];

    /* Column rounds */
    g(state, 0, 4, 8,  12, msg[s[0]],  msg[s[1]]);
    g(state, 1, 5, 9,  13, msg[s[2]],  msg[s[3]]);
    g(state, 2, 6, 10, 14, msg[s[4]],  msg[s[5]]);
    g(state, 3, 7, 11, 15, msg[s[6]],  msg[s[7]]);

    /* Diagonal rounds */
    g(state, 0, 5, 10, 15, msg[s[8]],  msg[s[9]]);
    g(state, 1, 6, 11, 12, msg[s[10]], msg[s[11]]);
    g(state, 2, 7, 8,  13, msg[s[12]], msg[s[13]]);
    g(state, 3, 4, 9,  14, msg[s[14]], msg[s[15]]);
}

/* Compression function.
   Takes an 8-word chaining value, a 64-byte block, block length,
   64-bit counter, and flags. Produces a 16-word output.
   The first 8 words of the output are the new chaining value;
   the second 8 words are used only for root output. */
static void blake3_compress(
    const uint32_t cv[8],
    const uint8_t block[BLAKE3_BLOCK_LEN],
    uint8_t block_len,
    uint64_t counter,
    uint8_t flags,
    uint32_t out[16]
) {
    uint32_t state[16];
    uint32_t msg[16];

    /* state[0..7]  = chaining value */
    memcpy(state, cv, 8 * sizeof(uint32_t));
    /* state[8..11] = IV[0..3] */
    state[8]  = BLAKE3_IV[0];
    state[9]  = BLAKE3_IV[1];
    state[10] = BLAKE3_IV[2];
    state[11] = BLAKE3_IV[3];
    /* state[12..13] = counter (little-endian) */
    state[12] = (uint32_t)counter;
    state[13] = (uint32_t)(counter >> 32);
    /* state[14] = block_len, state[15] = flags */
    state[14] = block_len;
    state[15] = flags;

    /* Parse 64-byte block into 16 little-endian words */
    for (int i = 0; i < 16; i++) {
        msg[i] =  (uint32_t)block[4 * i]
               | ((uint32_t)block[4 * i + 1] << 8)
               | ((uint32_t)block[4 * i + 2] << 16)
               | ((uint32_t)block[4 * i + 3] << 24);
    }

    /* 7 rounds */
    for (int i = 0; i < 7; i++) {
        round_fn(state, msg, i);
    }

    /* Finalize: mix state with CV and IV */
    for (int i = 0; i < 8; i++) {
        out[i]     = state[i] ^ state[i + 8];   /* mix with IV half */
        out[i + 8] = state[i + 8] ^ cv[i];      /* mix with CV half */
    }
}

/* ── Chunk state ────────────────────────────────────────────────────── */

typedef struct {
    uint32_t cv[8];            /* current chaining value */
    uint8_t  buf[BLAKE3_BLOCK_LEN]; /* partial block buffer */
    uint8_t  buf_len;          /* bytes currently in buf (0..64) */
    uint8_t  blocks_compressed;/* number of full 64-byte blocks compressed */
    uint64_t chunk_counter;    /* which chunk (for multi-chunk inputs) */
    uint8_t  flags;            /* domain flags (0 for default hash mode) */
} chunk_state;

static void chunk_state_init(chunk_state* cs, const uint32_t key[8],
                             uint8_t flags, uint64_t chunk_counter) {
    memcpy(cs->cv, key, 8 * sizeof(uint32_t));
    memset(cs->buf, 0, BLAKE3_BLOCK_LEN);  /* zero buffer so partial blocks are padded with zeros */
    cs->buf_len = 0;
    cs->blocks_compressed = 0;
    cs->chunk_counter = chunk_counter;
    cs->flags = flags;
}

/* Length of data absorbed into this chunk so far (bytes). */
static size_t chunk_state_len(const chunk_state* cs) {
    return (size_t)cs->blocks_compressed * BLAKE3_BLOCK_LEN + cs->buf_len;
}

/* Flags for the next block compression (includes CHUNK_START if first). */
static uint8_t chunk_state_start_flag(const chunk_state* cs) {
    return (cs->blocks_compressed == 0) ? (cs->flags | FLAG_CHUNK_START) : cs->flags;
}

/* Absorb input into the chunk state.  Full 64-byte blocks are compressed
   immediately (with CHUNK_START on the first block); the final partial
   block remains in the buffer until chunk_state_output or the next
   chunk-boundary call. */
static void chunk_state_update(chunk_state* cs, const uint8_t* input, size_t input_len) {
    while (input_len > 0) {
        /* How much room is left in the current chunk? */
        size_t take = BLAKE3_CHUNK_LEN - chunk_state_len(cs);
        if (take > input_len) take = input_len;

        /* Can we fit this in the buffer without exceeding a block? */
        size_t buf_space = BLAKE3_BLOCK_LEN - cs->buf_len;
        if (take <= buf_space) {
            memcpy(cs->buf + cs->buf_len, input, take);
            cs->buf_len += (uint8_t)take;
            input += take;
            input_len -= take;
            /* If the buffer is full and there's more data, compress now */
            if (cs->buf_len == BLAKE3_BLOCK_LEN && input_len > 0) {
                uint32_t out16[16];
                blake3_compress(cs->cv, cs->buf, BLAKE3_BLOCK_LEN,
                                cs->chunk_counter,
                                chunk_state_start_flag(cs), out16);
                memcpy(cs->cv, out16, 8 * sizeof(uint32_t));
                cs->blocks_compressed++;
                cs->buf_len = 0;
            }
        } else {
            /* Fill the buffer to a full block, compress */
            memcpy(cs->buf + cs->buf_len, input, buf_space);
            uint32_t out16[16];
            blake3_compress(cs->cv, cs->buf, BLAKE3_BLOCK_LEN,
                            cs->chunk_counter,
                            chunk_state_start_flag(cs), out16);
            memcpy(cs->cv, out16, 8 * sizeof(uint32_t));
            cs->blocks_compressed++;
            cs->buf_len = 0;
            input += buf_space;
            input_len -= buf_space;
        }
    }
}

/* ── Output (captures root-node compression parameters) ─────────────── */

/* An Output captures the state just before the final root compression.
   The same compression can produce either an 8-word chaining value
   (without ROOT) or arbitrary-length output bytes (with ROOT). */
typedef struct {
    uint32_t input_cv[8];     /* chaining value going in */
    uint8_t  block[BLAKE3_BLOCK_LEN]; /* block to compress */
    uint8_t  block_len;       /* block length (may be < 64 for last chunk block) */
    uint64_t counter;         /* chunk counter (0 for parent nodes) */
    uint8_t  flags;           /* flags (includes CHUNK_END or PARENT, NOT ROOT) */
} blake3_output;

/* Compute the 8-word chaining value (compress WITHOUT ROOT). */
static void output_cv(const blake3_output* o, uint32_t cv[8]) {
    uint32_t out16[16];
    blake3_compress(o->input_cv, o->block, o->block_len, o->counter, o->flags, out16);
    memcpy(cv, out16, 8 * sizeof(uint32_t));
}

/* Produce output bytes by compressing the SAME block WITH ROOT and
   an incrementing counter.  Each compression yields 64 bytes. */
static void output_root_bytes(const blake3_output* o, uint8_t* out, size_t out_len) {
    size_t offset = 0;
    uint64_t output_block_counter = 0;

    while (offset < out_len) {
        uint32_t out16[16];
        blake3_compress(o->input_cv, o->block, o->block_len,
                        output_block_counter, o->flags | FLAG_ROOT, out16);

        for (int i = 0; i < 16 && offset < out_len; i++) {
            for (int j = 0; j < 4 && offset < out_len; j++) {
                out[offset++] = (uint8_t)(out16[i] >> (j * 8));
            }
        }
        output_block_counter++;
    }
}

/* Create an Output from the current chunk state (the chunk's last block
   with CHUNK_END flag). */
static blake3_output chunk_state_to_output(const chunk_state* cs) {
    blake3_output o;
    memcpy(o.input_cv, cs->cv, 8 * sizeof(uint32_t));
    memcpy(o.block, cs->buf, BLAKE3_BLOCK_LEN);
    o.block_len = cs->buf_len;
    o.counter = cs->chunk_counter;
    o.flags = cs->flags | chunk_state_start_flag(cs) | FLAG_CHUNK_END;
    return o;
}

/* Create a parent Output from left and right child CVs. */
static blake3_output make_parent_output(
    const uint32_t left_cv[8],
    const uint32_t right_cv[8],
    const uint32_t key[8],
    uint8_t flags
) {
    blake3_output o;
    memcpy(o.input_cv, key, 8 * sizeof(uint32_t));
    /* Block = left_cv || right_cv (as little-endian bytes) */
    for (int i = 0; i < 8; i++) {
        o.block[4 * i]     = (uint8_t)(left_cv[i]);
        o.block[4 * i + 1] = (uint8_t)(left_cv[i] >> 8);
        o.block[4 * i + 2] = (uint8_t)(left_cv[i] >> 16);
        o.block[4 * i + 3] = (uint8_t)(left_cv[i] >> 24);
    }
    for (int i = 0; i < 8; i++) {
        o.block[32 + 4 * i]     = (uint8_t)(right_cv[i]);
        o.block[32 + 4 * i + 1] = (uint8_t)(right_cv[i] >> 8);
        o.block[32 + 4 * i + 2] = (uint8_t)(right_cv[i] >> 16);
        o.block[32 + 4 * i + 3] = (uint8_t)(right_cv[i] >> 24);
    }
    o.block_len = BLAKE3_BLOCK_LEN;
    o.counter = 0;
    o.flags = flags | FLAG_PARENT;
    return o;
}

/* ── Hasher (full Merkle-tree state) ────────────────────────────────── */

typedef struct {
    chunk_state chunk;
    uint32_t    key[8];        /* key (IV for default mode) */
    uint8_t     flags;         /* domain flags */
    uint32_t    cv_stack[BLAKE3_MAX_DEPTH][8]; /* Merkle-tree CV stack */
    uint8_t     cv_stack_len;
} blake3_hasher;

static void hasher_init(blake3_hasher* h) {
    memset(h, 0, sizeof(*h));
    memcpy(h->key, BLAKE3_IV, sizeof(BLAKE3_IV));
    h->flags = 0;
    h->cv_stack_len = 0;
    chunk_state_init(&h->chunk, h->key, h->flags, 0);
}

/* Merge a chunk CV into the stack, combining subtrees at matching depths.
   total_chunks is the number of chunks processed so far (1-based for the
   chunk being merged). */
static void hasher_merge_cv(blake3_hasher* h, uint32_t cv[8], uint64_t total_chunks) {
    while ((total_chunks & 1) == 0 && h->cv_stack_len > 0) {
        h->cv_stack_len--;
        blake3_output po = make_parent_output(
            h->cv_stack[h->cv_stack_len], cv, h->key, h->flags);
        uint32_t new_cv[8];
        output_cv(&po, new_cv);
        memcpy(cv, new_cv, 8 * sizeof(uint32_t));
        total_chunks >>= 1;
    }
    memcpy(h->cv_stack[h->cv_stack_len], cv, 8 * sizeof(uint32_t));
    h->cv_stack_len++;
}

static void hasher_update(blake3_hasher* h, const uint8_t* input, size_t input_len) {
    while (input_len > 0) {
        size_t take = BLAKE3_CHUNK_LEN - chunk_state_len(&h->chunk);
        if (take > input_len) take = input_len;

        chunk_state_update(&h->chunk, input, take);
        input += take;
        input_len -= take;

        if (chunk_state_len(&h->chunk) == BLAKE3_CHUNK_LEN) {
            blake3_output o = chunk_state_to_output(&h->chunk);
            uint32_t cv[8];
            output_cv(&o, cv);
            uint64_t total_chunks = h->chunk.chunk_counter + 1;
            hasher_merge_cv(h, cv, total_chunks);
            chunk_state_init(&h->chunk, h->key, h->flags,
                             h->chunk.chunk_counter + 1);
        }
    }
}

/* Finalize: produce out_len bytes of output.
   Creates the root Output by merging the chunk state with any stack CVs,
   then calls output_root_bytes which re-compresses the root block with
   ROOT flag and incrementing counter. */
static void hasher_finalize(const blake3_hasher* h, uint8_t* out, size_t out_len) {
    /* Start with the chunk's output */
    blake3_output o = chunk_state_to_output(&h->chunk);

    /* Merge remaining CVs from the stack */
    uint32_t stack[BLAKE3_MAX_DEPTH][8];
    memcpy(stack, h->cv_stack, h->cv_stack_len * 8 * sizeof(uint32_t));
    uint8_t stack_len = h->cv_stack_len;

    while (stack_len > 0) {
        stack_len--;
        uint32_t right_cv[8];
        output_cv(&o, right_cv);
        o = make_parent_output(stack[stack_len], right_cv, h->key, h->flags);
    }

    output_root_bytes(&o, out, out_len);
}

/* ── Public API (EXPORT) ────────────────────────────────────────────── */

/* Opaque context type for incremental hashing */
typedef blake3_hasher blake3_ctx;

EXPORT void blake3_init(blake3_ctx* ctx) {
    hasher_init(ctx);
}

EXPORT void blake3_update(blake3_ctx* ctx, const uint8_t* input, size_t len) {
    hasher_update(ctx, input, len);
}

EXPORT void blake3_finalize(blake3_ctx* ctx, uint8_t* out, size_t outlen) {
    hasher_finalize(ctx, out, outlen);
}

/* Simple one-shot hash: blake3(input) → 32-byte output */
EXPORT void blake3_hash(const uint8_t* input, size_t len, uint8_t* output) {
    blake3_hasher h;
    hasher_init(&h);
    hasher_update(&h, input, len);
    hasher_finalize(&h, output, 32);
}

/* DCR mining hash: blake3(header || nonce_le) → 32-byte output.
   The nonce is appended as 8 little-endian bytes, matching the Rust
   reference `hash_blake3`.  Uses malloc for large headers to avoid
   stack overflow. */
EXPORT void blake3_mine(
    const uint8_t* header,
    size_t header_len,
    uint64_t nonce,
    uint8_t* output
) {
    size_t total = header_len + 8;
    uint8_t* data = (uint8_t*)malloc(total);
    if (!data) return;
    memcpy(data, header, header_len);
    /* nonce as little-endian */
    data[header_len]     = (uint8_t)(nonce);
    data[header_len + 1] = (uint8_t)(nonce >> 8);
    data[header_len + 2] = (uint8_t)(nonce >> 16);
    data[header_len + 3] = (uint8_t)(nonce >> 24);
    data[header_len + 4] = (uint8_t)(nonce >> 32);
    data[header_len + 5] = (uint8_t)(nonce >> 40);
    data[header_len + 6] = (uint8_t)(nonce >> 48);
    data[header_len + 7] = (uint8_t)(nonce >> 56);

    blake3_hash(data, total, output);
    free(data);
}

/* ALPH (Alephium) double-Blake3 mining hash:
   hash = blake3(blake3(nonce_24B || header_blob))

   The 24-byte nonce is:
     bytes[0..8]  = candidate as big-endian u64
     bytes[8..24] = zeros

   candidate = base + nonce, where base is derived from extranonce1.
   This matches the Rust reference `hash_blake3_alph`. */
EXPORT void blake3_alph(
    const uint8_t* header_blob,
    size_t header_len,
    const uint8_t* extranonce1,
    size_t extranonce1_len,
    uint64_t nonce,
    uint8_t* output
) {
    /* Build the 24-byte nonce */
    uint8_t full_nonce[24];
    memset(full_nonce, 0, 24);

    /* extranonce1 is big-endian, left-padded into 8 bytes */
    uint8_t base_bytes[8];
    memset(base_bytes, 0, 8);
    size_t en1_copy = extranonce1_len < 8 ? extranonce1_len : 8;
    memcpy(base_bytes + (8 - en1_copy), extranonce1, en1_copy);

    /* Interpret as big-endian u64 */
    uint64_t base = 0;
    for (int i = 0; i < 8; i++) {
        base = (base << 8) | base_bytes[i];
    }
    uint64_t candidate = base + nonce;

    /* Write candidate as big-endian into first 8 bytes of nonce */
    full_nonce[0] = (uint8_t)(candidate >> 56);
    full_nonce[1] = (uint8_t)(candidate >> 48);
    full_nonce[2] = (uint8_t)(candidate >> 40);
    full_nonce[3] = (uint8_t)(candidate >> 32);
    full_nonce[4] = (uint8_t)(candidate >> 24);
    full_nonce[5] = (uint8_t)(candidate >> 16);
    full_nonce[6] = (uint8_t)(candidate >> 8);
    full_nonce[7] = (uint8_t)(candidate);
    /* bytes[8..24] already zeroed */

    /* First round: blake3(nonce_24B || header_blob) */
    size_t inner_len = 24 + header_len;
    uint8_t* inner_input = (uint8_t*)malloc(inner_len);
    if (!inner_input) return;
    memcpy(inner_input, full_nonce, 24);
    memcpy(inner_input + 24, header_blob, header_len);

    uint8_t inner_hash[32];
    blake3_hash(inner_input, inner_len, inner_hash);
    free(inner_input);

    /* Second round: blake3(inner_hash) */
    blake3_hash(inner_hash, 32, output);
}

/* ALPH with a direct 64-bit candidate (no extranonce1 base).
   Convenience wrapper: candidate = nonce (big-endian in 24-byte nonce). */
EXPORT void blake3_alph_simple(
    const uint8_t* header_blob,
    size_t header_len,
    uint64_t nonce,
    uint8_t* output
) {
    blake3_alph(header_blob, header_len, NULL, 0, nonce, output);
}

/* Verify a mining hash against a 32-byte target (big-endian comparison).
   Returns 1 if hash <= target, 0 otherwise. */
EXPORT int blake3_verify(
    const uint8_t* header,
    size_t header_len,
    uint64_t nonce,
    const uint8_t* target
) {
    uint8_t hash[32];
    blake3_mine(header, header_len, nonce, hash);

    /* Big-endian comparison: compare from byte 0 (most significant) */
    for (int i = 0; i < 32; i++) {
        if (hash[i] < target[i]) return 1;
        if (hash[i] > target[i]) return 0;
    }
    return 1; /* equal */
}

/* Verify an ALPH double-hash against a 32-byte target. */
EXPORT int blake3_alph_verify(
    const uint8_t* header_blob,
    size_t header_len,
    const uint8_t* extranonce1,
    size_t extranonce1_len,
    uint64_t nonce,
    const uint8_t* target
) {
    uint8_t hash[32];
    blake3_alph(header_blob, header_len, extranonce1, extranonce1_len, nonce, hash);

    for (int i = 0; i < 32; i++) {
        if (hash[i] < target[i]) return 1;
        if (hash[i] > target[i]) return 0;
    }
    return 1;
}

/* Benchmark: returns hashes/second for blake3_mine. */
EXPORT double blake3_benchmark(int iterations) {
    uint8_t header[80] = {0x01, 0x02, 0x03};
    uint8_t output[32];

    clock_t start = clock();

    for (int i = 0; i < iterations; i++) {
        blake3_mine(header, 80, (uint64_t)i, output);
    }

    clock_t end = clock();
    double seconds = (double)(end - start) / CLOCKS_PER_SEC;

    if (seconds <= 0.0) return 0.0;
    return (double)iterations / seconds;
}

/* Self-test: verify the known BLAKE3 test vector for empty input.
   blake3("") = af1349b9f5f9a1a6a0404dea36dcc9499bcb25c9adc112b7cc9a93cae41f3262
   Returns 1 if the test passes, 0 otherwise. */
EXPORT int blake3_selftest(void) {
    uint8_t hash[32];
    blake3_hash(NULL, 0, hash);  /* hash of empty input */

    static const uint8_t expected[32] = {
        0xaf, 0x13, 0x49, 0xb9, 0xf5, 0xf9, 0xa1, 0xa6,
        0xa0, 0x40, 0x4d, 0xea, 0x36, 0xdc, 0xc9, 0x49,
        0x9b, 0xcb, 0x25, 0xc9, 0xad, 0xc1, 0x12, 0xb7,
        0xcc, 0x9a, 0x93, 0xca, 0xe4, 0x1f, 0x32, 0x62
    };

    return memcmp(hash, expected, 32) == 0 ? 1 : 0;
}

/* Print test info (for standalone testing). */
EXPORT void blake3_test(void) {
    printf("=== ZION Blake3 Native Library Test ===\n\n");

    /* Self-test */
    if (blake3_selftest()) {
        printf("Self-test: PASS (blake3(\"\") matches known vector)\n");
    } else {
        printf("Self-test: FAIL\n");
    }

    /* Test vector: "Hello, ZION!" */
    const char* msg = "Hello, ZION!";
    uint8_t hash[32];
    blake3_hash((const uint8_t*)msg, strlen(msg), hash);
    printf("Input: %s\n", msg);
    printf("Hash:  ");
    for (int i = 0; i < 32; i++) printf("%02x", hash[i]);
    printf("\n\n");

    /* DCR mining test */
    uint8_t header[80] = {0x01, 0x02, 0x03, 0x04};
    blake3_mine(header, 80, 12345, hash);
    printf("DCR mining hash: ");
    for (int i = 0; i < 8; i++) printf("%02x", hash[i]);
    printf("...\n\n");

    /* ALPH mining test */
    blake3_alph_simple(header, 80, 12345, hash);
    printf("ALPH mining hash: ");
    for (int i = 0; i < 8; i++) printf("%02x", hash[i]);
    printf("...\n\n");

    printf("Benchmark (10000 iterations)...\n");
    double hashrate = blake3_benchmark(10000);
    printf("Hashrate: %.2f KH/s\n", hashrate / 1000);
}

EXPORT const char* blake3_version(void) {
    return "ZION Blake3 v2.0.0 - DCR/ALPH Compatible";
}

/* Standalone test entry point */
#ifdef BLAKE3_TEST
int main(void) {
    blake3_test();
    return 0;
}
#endif
