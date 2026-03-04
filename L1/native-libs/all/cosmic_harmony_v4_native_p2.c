
/* ============================================================================
 * Weight Accessor Macros
 * ============================================================================ */

#define chv4_w1(j, i)    ((int8_t)CHV4_WEIGHT_BYTES[(j)*64 + (i)])
#define chv4_b1(j)       ((int8_t)CHV4_WEIGHT_BYTES[8192 + (j)])
#define chv4_w2(i, j)    ((int8_t)CHV4_WEIGHT_BYTES[8320 + (i)*128 + (j)])
#define chv4_b2(i)       ((int8_t)CHV4_WEIGHT_BYTES[16512 + (i)])
#define chv4_scale1(j)   ((int16_t)(224 + (CHV4_WEIGHT_BYTES[16576 + (j)] & 0x3Fu)))
#define chv4_scale2(i)   ((int16_t)(224 + (CHV4_WEIGHT_BYTES[16704 + (i)] & 0x3Fu)))

/* ============================================================================
 * Keccak-f[1600] Permutation
 * ============================================================================ */

static inline uint64_t rotl64(uint64_t x, int n) {
    return (x << n) | (x >> (64 - n));
}

static void keccak_f1600(uint64_t state[25]) {
    uint64_t bc[5], t;
    for (int round = 0; round < 24; round++) {
        for (int i = 0; i < 5; i++)
            bc[i] = state[i] ^ state[i+5] ^ state[i+10] ^ state[i+15] ^ state[i+20];
        for (int i = 0; i < 5; i++) {
            t = bc[(i+4)%5] ^ rotl64(bc[(i+1)%5], 1);
            for (int j = 0; j < 25; j += 5) state[j+i] ^= t;
        }
        t = state[1];
        for (int i = 0; i < 24; i++) {
            int j = KECCAK_PILN[i];
            bc[0] = state[j];
            state[j] = rotl64(t, KECCAK_ROTC[i]);
            t = bc[0];
        }
        for (int j = 0; j < 25; j += 5) {
            for (int i = 0; i < 5; i++) bc[i] = state[j+i];
            for (int i = 0; i < 5; i++) state[j+i] ^= (~bc[(i+1)%5]) & bc[(i+2)%5];
        }
        state[0] ^= KECCAK_RC[round];
    }
}

/* ============================================================================
 * Keccak-256  (rate=136, Keccak pad 0x01)
 * ============================================================================ */

static void keccak256(const uint8_t *input, size_t input_len, uint8_t output[32]) {
    uint64_t state[25];
    memset(state, 0, sizeof(state));
    const size_t rate = 136;
    size_t offset = 0;

    while (offset + rate <= input_len) {
        for (size_t i = 0; i < rate/8; i++) {
            uint64_t w = 0;
            for (int j = 0; j < 8; j++) w |= ((uint64_t)input[offset + i*8 + j]) << (j*8);
            state[i] ^= w;
        }
        keccak_f1600(state);
        offset += rate;
    }

    uint8_t block[200];
    memset(block, 0, rate);
    size_t rem = input_len - offset;
    if (rem) memcpy(block, input + offset, rem);
    block[rem] = 0x01;
    block[rate-1] |= 0x80;
    for (size_t i = 0; i < rate/8; i++) {
        uint64_t w = 0;
        for (int j = 0; j < 8; j++) w |= ((uint64_t)block[i*8+j]) << (j*8);
        state[i] ^= w;
    }
    keccak_f1600(state);

    for (int i = 0; i < 4; i++)
        for (int j = 0; j < 8; j++)
            output[i*8+j] = (uint8_t)(state[i] >> (j*8));
}

/* ============================================================================
 * SHA3-512  (rate=72, SHA3 pad 0x06)
 * ============================================================================ */

static void sha3_512(const uint8_t *input, size_t input_len, uint8_t output[64]) {
    uint64_t state[25];
    memset(state, 0, sizeof(state));
    const size_t rate = 72;
    size_t offset = 0;

    while (offset + rate <= input_len) {
        for (size_t i = 0; i < rate/8; i++) {
            uint64_t w = 0;
            for (int j = 0; j < 8; j++) w |= ((uint64_t)input[offset + i*8 + j]) << (j*8);
            state[i] ^= w;
        }
        keccak_f1600(state);
        offset += rate;
    }

    uint8_t block[200];
    memset(block, 0, rate);
    size_t rem = input_len - offset;
    if (rem) memcpy(block, input + offset, rem);
    block[rem] = 0x06;
    block[rate-1] |= 0x80;
    for (size_t i = 0; i < rate/8; i++) {
        uint64_t w = 0;
        for (int j = 0; j < 8; j++) w |= ((uint64_t)block[i*8+j]) << (j*8);
        state[i] ^= w;
    }
    keccak_f1600(state);

    for (int i = 0; i < 8; i++)
        for (int j = 0; j < 8; j++)
            output[i*8+j] = (uint8_t)(state[i] >> (j*8));
}

/* ============================================================================
 * Golden Matrix
 * ============================================================================ */

static void golden_matrix(const uint8_t input[64], uint8_t output[64]) {
    const int SZ = 8;
    uint64_t matrix[8][8], result[8];

    for (int i = 0; i < SZ; i++)
        for (int j = 0; j < SZ; j++)
            matrix[i][j] = (uint64_t)input[(i*SZ + j) % 64];

    for (int i = 0; i < SZ; i++) {
#ifdef __SIZEOF_INT128__
        __uint128_t sum = 0;
        for (int j = 0; j < SZ; j++)
            sum += (__uint128_t)matrix[i][j] * (__uint128_t)PHI_POWERS_FP[i+j];
        result[i] = (uint64_t)(sum >> 32);
#else
        uint64_t sum_lo = 0, sum_hi = 0;
        for (int j = 0; j < SZ; j++) {
            uint64_t a = matrix[i][j], b = PHI_POWERS_FP[i+j];
            uint64_t a_lo = a & 0xFFFFFFFF, a_hi = a >> 32;
            uint64_t b_lo = b & 0xFFFFFFFF, b_hi = b >> 32;
            uint64_t p0 = a_lo*b_lo, p1 = a_lo*b_hi, p2 = a_hi*b_lo, p3 = a_hi*b_hi;
            uint64_t mid = p1 + (p0 >> 32); mid += p2;
            if (mid < p2) sum_hi++;
            uint64_t lo = (p0 & 0xFFFFFFFF) | ((mid & 0xFFFFFFFF) << 32);
            uint64_t hi = p3 + (mid >> 32);
            uint64_t old_lo = sum_lo; sum_lo += lo;
            if (sum_lo < old_lo) sum_hi++; sum_hi += hi;
        }
        result[i] = (sum_lo >> 32) | (sum_hi << 32);
#endif
    }

    for (int i = 0; i < SZ; i++) {
        uint64_t v = result[i];
        for (int j = 0; j < 8; j++) output[i*8+j] = (uint8_t)(v >> (j*8));
    }
}

/* ============================================================================
 * Cosmic Fusion
 * ============================================================================ */

static void fusion_round(uint8_t state[64], uint8_t round_num) {
    uint8_t tmp[33];
    memcpy(tmp, state, 32);
    tmp[32] = round_num;
    uint8_t intermediate[32];
    keccak256(tmp, 33, intermediate);
    for (int i = 0; i < 32; i++)
        state[i] = intermediate[i] ^ COSMIC_XOR_MASK[i];
}

static void cosmic_fusion(const uint8_t input[64], uint8_t output[32]) {
    uint8_t state[64];
    memcpy(state, input, 64);
    fusion_round(state, 0);
    fusion_round(state, 1);
    fusion_round(state, 2);
    fusion_round(state, 3);
    uint8_t full[64];
    sha3_512(state, 32, full);
    memcpy(output, full, 32);
}

/* ============================================================================
 * CHv4 Scratchpad — Helper: read 4 bytes little-endian
 * ============================================================================ */

static inline uint32_t chv4_read_le32(const uint8_t *p) {
    return ((uint32_t)p[0])       |
           ((uint32_t)p[1] << 8)  |
           ((uint32_t)p[2] << 16) |
           ((uint32_t)p[3] << 24);
}

/* ============================================================================
 * CHv4 Scratchpad — init_scratchpad(pad, seed[64])
 * 8192 blocks, each = SHA3-512(prev_state[64] || block_idx_le8[8])
 * ============================================================================ */

static void chv4_init_scratchpad(uint8_t *pad, const uint8_t seed[64]) {
    uint8_t state[64];
    memcpy(state, seed, 64);

    uint8_t inp[72];  /* state[64] || blk_le8[8] */

    for (uint32_t blk = 0; blk < CHV4_BLOCK_COUNT; blk++) {
        memcpy(inp, state, 64);
        /* block index as little-endian uint64 */
        uint64_t idx = (uint64_t)blk;
        inp[64] = (uint8_t)(idx >>  0);
        inp[65] = (uint8_t)(idx >>  8);
        inp[66] = (uint8_t)(idx >> 16);
        inp[67] = (uint8_t)(idx >> 24);
        inp[68] = (uint8_t)(idx >> 32);
        inp[69] = (uint8_t)(idx >> 40);
        inp[70] = (uint8_t)(idx >> 48);
        inp[71] = (uint8_t)(idx >> 56);

        uint8_t next[64];
        sha3_512(inp, 72, next);
        memcpy(pad + (size_t)blk * CHV4_BLOCK_SIZE, next, 64);
        memcpy(state, next, 64);
    }
}

/* ============================================================================
 * CHv4 Scratchpad — mix_block(pad, cur, prev, rand_idx, pass)
 * combined[208] = cur[64] || prev[64] || rand[64] || ctx[16]
 * ctx = pass_le4 || cur_le4 || prev_le4 || rand_le4
 * ============================================================================ */

static void chv4_mix_block(uint8_t *pad,
                            uint32_t cur_idx,
                            uint32_t prev_idx,
                            uint32_t rand_idx,
                            uint32_t pass)
{
    uint8_t *cur_blk  = pad + (size_t)cur_idx  * CHV4_BLOCK_SIZE;
    uint8_t *prev_blk = pad + (size_t)prev_idx * CHV4_BLOCK_SIZE;
    uint8_t *rand_blk = pad + (size_t)rand_idx * CHV4_BLOCK_SIZE;

    uint8_t combined[208];
    memcpy(combined,      cur_blk,  64);
    memcpy(combined + 64, prev_blk, 64);
    memcpy(combined +128, rand_blk, 64);

    /* ctx[16] = pass_le4 || cur_le4 || prev_le4 || rand_le4 */
    uint8_t *ctx = combined + 192;
    ctx[ 0] = (uint8_t)(pass     >>  0); ctx[ 1] = (uint8_t)(pass     >>  8);
    ctx[ 2] = (uint8_t)(pass     >> 16); ctx[ 3] = (uint8_t)(pass     >> 24);
    ctx[ 4] = (uint8_t)(cur_idx  >>  0); ctx[ 5] = (uint8_t)(cur_idx  >>  8);
    ctx[ 6] = (uint8_t)(cur_idx  >> 16); ctx[ 7] = (uint8_t)(cur_idx  >> 24);
    ctx[ 8] = (uint8_t)(prev_idx >>  0); ctx[ 9] = (uint8_t)(prev_idx >>  8);
    ctx[10] = (uint8_t)(prev_idx >> 16); ctx[11] = (uint8_t)(prev_idx >> 24);
    ctx[12] = (uint8_t)(rand_idx >>  0); ctx[13] = (uint8_t)(rand_idx >>  8);
    ctx[14] = (uint8_t)(rand_idx >> 16); ctx[15] = (uint8_t)(rand_idx >> 24);

    uint8_t hash[64];
    sha3_512(combined, 208, hash);

    for (int i = 0; i < 64; i++) cur_blk[i] ^= hash[i];
}

/* ============================================================================
 * CHv4 Scratchpad — sequential_passes(pad)
 * 4 passes alternating fwd/bwd
 * ============================================================================ */

static void chv4_sequential_passes(uint8_t *pad) {
    for (uint32_t pass = 0; pass < CHV4_PASSES; pass++) {
        int fwd = (pass % 2 == 0);
        for (uint32_t i = 0; i < CHV4_BLOCK_COUNT; i++) {
            uint32_t cur  = fwd ? i : (CHV4_BLOCK_COUNT - 1 - i);
            uint32_t prev;
            if (fwd) {
                prev = (cur == 0) ? (CHV4_BLOCK_COUNT - 1) : (cur - 1);
            } else {
                prev = (cur == CHV4_BLOCK_COUNT - 1) ? 0 : (cur + 1);
            }
            uint32_t rv = chv4_read_le32(pad + (size_t)prev * CHV4_BLOCK_SIZE);
            uint32_t rand_idx = rv % CHV4_BLOCK_COUNT;
            chv4_mix_block(pad, cur, prev, rand_idx, pass);
        }
    }
}

/* ============================================================================
 * CHv4 Scratchpad — random_read_mix(gm_out[64], pad, output[64])
 * 256 iterations: acc ^= keccak256(acc[64] || pad[blk][64] || r_le8[8])
 * ============================================================================ */

static void chv4_random_read_mix(const uint8_t gm_out[64],
                                  const uint8_t *pad,
                                  uint8_t output[64])
{
    uint8_t acc[64];
    memcpy(acc, gm_out, 64);

    uint8_t inp[136];  /* acc[64] || pad_blk[64] || r_le8[8] */

    for (uint32_t r = 0; r < CHV4_RANDOM_READS; r++) {
        uint32_t blk = chv4_read_le32(acc) % CHV4_BLOCK_COUNT;
        memcpy(inp,      acc,                              64);
        memcpy(inp + 64, pad + (size_t)blk * CHV4_BLOCK_SIZE, 64);
        uint64_t r64 = (uint64_t)r;
        inp[128] = (uint8_t)(r64 >>  0); inp[129] = (uint8_t)(r64 >>  8);
        inp[130] = (uint8_t)(r64 >> 16); inp[131] = (uint8_t)(r64 >> 24);
        inp[132] = (uint8_t)(r64 >> 32); inp[133] = (uint8_t)(r64 >> 40);
        inp[134] = (uint8_t)(r64 >> 48); inp[135] = (uint8_t)(r64 >> 56);

        uint8_t h[32];
        keccak256(inp, 136, h);
        for (int i = 0; i < 64; i++) acc[i] ^= h[i % 32];
    }

    memcpy(output, acc, 64);
}

/* ============================================================================
 * CHv4 Scratchpad — memory_hard_transform
 * ============================================================================ */

static void chv4_memory_hard_transform(const uint8_t gm_out[64],
                                        const uint8_t seed[64],
                                        uint8_t *pad,
                                        uint8_t output[64])
{
    chv4_init_scratchpad(pad, seed);
    chv4_sequential_passes(pad);
    uint8_t mix[64];
    chv4_random_read_mix(gm_out, pad, mix);
    for (int i = 0; i < 64; i++) output[i] = mix[i] ^ gm_out[i];
}

/* ============================================================================
 * CHv4 NPU Mixing — GELU activation: x / (1 + exp(-1.702*x))
 * ============================================================================ */

static inline float chv4_gelu(float x) {
    return x / (1.0f + expf(-1.702f * x));
}

/* ============================================================================
 * CHv4 NPU Mixing — 2-layer quantised neural network
 * Layer 1: 64 → 128 (int8 weights + int8 bias, scale1, GELU)
 * Layer 2: 128 → 64 (int8 weights + int8 bias, scale2, residual)
 * ============================================================================ */

#define CLAMPF(x, lo, hi) ((x) < (lo) ? (lo) : ((x) > (hi) ? (hi) : (x)))

static void chv4_npu_mixing(const uint8_t input[64], uint8_t output[64]) {
    float h[128];

    /* Layer 1: 64 → 128 */
    for (int j = 0; j < 128; j++) {
        float acc = (float)chv4_b1(j);
        for (int i = 0; i < 64; i++)
            acc += (float)chv4_w1(j, i) * (float)(int8_t)input[i];
        float scale = (float)chv4_scale1(j);
        float val = (scale != 0.0f) ? acc / scale : acc;
        h[j] = chv4_gelu(val);
    }

    /* Layer 2: 128 → 64 with residual */
    for (int i = 0; i < 64; i++) {
        float acc = (float)chv4_b2(i);
        for (int j = 0; j < 128; j++)
            acc += (float)chv4_w2(i, j) * h[j];
        float scale = (float)chv4_scale2(i);
        float val = (scale != 0.0f) ? acc / scale : acc;
        float residual = (float)(int8_t)input[i];
        int32_t out_i = (int32_t)CLAMPF(val + residual, -128.0f, 127.0f);
        output[i] = (uint8_t)(out_i & 0xFF);
    }
}

/* ============================================================================
 * Full CHv4 Pipeline (internal)
 * ============================================================================ */

static void cosmic_harmony_v4_compute(
    const uint8_t *block_header,
    size_t header_len,
    uint64_t nonce,
    uint8_t output[32]
) {
    /* inp[88] = header[0:80] || nonce_le8 */
    uint8_t inp[88];
    memset(inp, 0, 88);
    size_t clen = header_len < 80 ? header_len : 80;
    memcpy(inp, block_header, clen);
    inp[80] = (uint8_t)(nonce >>  0); inp[81] = (uint8_t)(nonce >>  8);
    inp[82] = (uint8_t)(nonce >> 16); inp[83] = (uint8_t)(nonce >> 24);
    inp[84] = (uint8_t)(nonce >> 32); inp[85] = (uint8_t)(nonce >> 40);
    inp[86] = (uint8_t)(nonce >> 48); inp[87] = (uint8_t)(nonce >> 56);

    /* Step 1: Keccak-256(inp) → s1[32] */
    uint8_t s1[32];
    keccak256(inp, 88, s1);

    /* Step 2: SHA3-512(s1) → s2[64]  (also scratchpad seed) */
    uint8_t s2[64];
    sha3_512(s1, 32, s2);

    /* Step 3: Golden Matrix(s2) → s3[64] */
    uint8_t s3[64];
    golden_matrix(s2, s3);

    /* Step 4: Memory-Hard transform → s4[64] */
    uint8_t *pad = (uint8_t *)malloc(CHV4_SCRATCHPAD_BYTES);
    if (!pad) {
        memset(output, 0xFF, 32);
        return;
    }
    uint8_t s4[64];
    chv4_memory_hard_transform(s3, s2, pad, s4);
    free(pad);

    /* Step 5: NPU Mixing → s5[64] */
    uint8_t s5[64];
    chv4_npu_mixing(s4, s5);

    /* Step 6: Cosmic Fusion → output[32] */
    cosmic_fusion(s5, output);
}

/* ============================================================================
 * GPU State (stub — Metal pipeline handles real GPU work)
 * ============================================================================ */

typedef struct {
    uint8_t  header[80];
    size_t   header_len;
    uint32_t batch_size;
    uint32_t device_id;
    int      initialized;
} CHv4GPUState;

static CHv4GPUState g_gpu_state = {0};

/* Forward declaration */
EXPORT const char* cosmic_harmony_v4_get_info(void);

/* ============================================================================
 * Exported API
 * ============================================================================ */

EXPORT uint32_t cosmic_harmony_v4_gpu_count(void) {
#if defined(__APPLE__)
    return 1;
#else
    return 0;
#endif
}

EXPORT int32_t cosmic_harmony_v4_gpu_init(uint32_t device_id, uint32_t batch_size) {
    g_gpu_state.device_id   = device_id;
    g_gpu_state.batch_size  = batch_size;
    g_gpu_state.initialized = 1;
    printf("[CHv4 Native] GPU init: device=%u, batch_size=%u\n", device_id, batch_size);
    printf("[CHv4 Native] Library: %s\n", cosmic_harmony_v4_get_info());
    return 0;
}

EXPORT int32_t cosmic_harmony_v4_gpu_mine(
    const uint8_t *header, size_t header_len,
    uint64_t nonce_start, const uint8_t *target,
    uint64_t *found_nonce, uint8_t *found_hash
) {
    if (!g_gpu_state.initialized) return -1;
    uint32_t batch = g_gpu_state.batch_size;

    for (uint32_t i = 0; i < batch; i++) {
        uint64_t nonce = nonce_start + i;
        uint8_t  hash[32];
        cosmic_harmony_v4_compute(header, header_len, nonce, hash);

        int below = 0;
        for (int j = 31; j >= 0; j--) {
            if (hash[j] < target[j]) { below = 1; break; }
            else if (hash[j] > target[j]) break;
        }
        if (below) {
            *found_nonce = nonce;
            memcpy(found_hash, hash, 32);
            return 1;
        }
    }
    return 0;
}

EXPORT void cosmic_harmony_v4_gpu_cleanup(void) {
    g_gpu_state.initialized = 0;
    printf("[CHv4 Native] GPU cleanup done\n");
}

/* ---  Hash functions  --- */

EXPORT int cosmic_harmony_v4_hash(
    const uint8_t *header, size_t header_len,
    uint64_t nonce, uint64_t height,
    uint8_t *output
) {
    (void)height;  /* CHv4 always active (fork_height=0) */
    if (!header || !output) return -1;
    cosmic_harmony_v4_compute(header, header_len, nonce, output);
    return 0;
}

EXPORT int cosmic_harmony_v4_hash_raw(
    const uint8_t *input88, uint64_t height, uint8_t *output
) {
    (void)height;
    if (!input88 || !output) return -1;
    /* Extract nonce from last 8 bytes */
    const uint8_t *n = input88 + 80;
    uint64_t nonce = (uint64_t)n[0]       | ((uint64_t)n[1] <<  8) |
                     ((uint64_t)n[2] << 16) | ((uint64_t)n[3] << 24) |
                     ((uint64_t)n[4] << 32) | ((uint64_t)n[5] << 40) |
                     ((uint64_t)n[6] << 48) | ((uint64_t)n[7] << 56);
    cosmic_harmony_v4_compute(input88, 80, nonce, output);
    return 0;
}

/* --- Compatibility alias for pool (cosmic_harmony_hash) --- */

EXPORT int cosmic_harmony_hash(
    const uint8_t *header, size_t header_len,
    uint64_t nonce, uint64_t height,
    uint8_t *output
) {
    return cosmic_harmony_v4_hash(header, header_len, nonce, height, output);
}

/* --- Individual step exports --- */

EXPORT void cosmic_harmony_v4_keccak256(const uint8_t *in, size_t len, uint8_t *out) {
    keccak256(in, len, out);
}
EXPORT void cosmic_harmony_v4_sha3_512(const uint8_t *in, size_t len, uint8_t *out) {
    sha3_512(in, len, out);
}
EXPORT void cosmic_harmony_v4_golden_matrix(const uint8_t *in, uint8_t *out) {
    golden_matrix(in, out);
}
EXPORT void cosmic_harmony_v4_cosmic_fusion(const uint8_t *in, uint8_t *out) {
    cosmic_fusion(in, out);
}
EXPORT void cosmic_harmony_v4_npu_mixing(const uint8_t *in, uint8_t *out) {
    chv4_npu_mixing(in, out);
}

/* --- Info / capabilities --- */

EXPORT const char* cosmic_harmony_v4_get_info(void) {
#if HAS_NEON
    return "Cosmic Harmony v4 Native — NPU+Scratchpad (ARM NEON / Apple Silicon)";
#elif HAS_AVX2
    return "Cosmic Harmony v4 Native — NPU+Scratchpad (x86_64 AVX2)";
#else
    return "Cosmic Harmony v4 Native — NPU+Scratchpad (scalar)";
#endif
}

EXPORT int cosmic_harmony_v4_has_neon(void) { return HAS_NEON; }
EXPORT int cosmic_harmony_v4_has_avx2(void) { return HAS_AVX2; }

/* --- Benchmark --- */

EXPORT double cosmic_harmony_v4_benchmark(int duration_seconds) {
    uint8_t header[80];
    uint8_t output[32];
    memset(header, 0x42, 80);

    printf("=== Cosmic Harmony v4 Benchmark ===\n");
    printf("Library: %s\n", cosmic_harmony_v4_get_info());
    printf("Running for %d seconds...\n", duration_seconds);

    uint64_t total = 0;
    uint64_t nonce = 0;
    clock_t  start = clock();
    double   elapsed = 0.0;

    while (elapsed < duration_seconds) {
        cosmic_harmony_v4_compute(header, 80, nonce++, output);
        total++;
        if ((total % 10) == 0)
            elapsed = (double)(clock() - start) / CLOCKS_PER_SEC;
    }

    elapsed = (double)(clock() - start) / CLOCKS_PER_SEC;
    double hashrate = total / elapsed;
    printf("Total hashes: %llu\n", (unsigned long long)total);
    printf("Time: %.2f s\n", elapsed);
    printf("Hashrate: %.2f H/s\n", hashrate);
    printf("Sample hash: ");
    for (int i = 0; i < 32; i++) printf("%02x", output[i]);
    printf("\n");
    return hashrate;
}

/* ============================================================================
 * Main (standalone test)
 * ============================================================================ */

#ifdef BUILD_MAIN
int main(int argc, char **argv) {
    (void)argc; (void)argv;
    printf("=== ZION Cosmic Harmony v4 Native Library ===\n");
    printf("%s\n\n", cosmic_harmony_v4_get_info());

    const char *hdr = "ZION block header v2.9.6";
    uint8_t hash[32];
    cosmic_harmony_v4_compute((const uint8_t*)hdr, strlen(hdr), 12345, hash);
    printf("Test header: \"%s\"\n", hdr);
    printf("Nonce: 12345\n");
    printf("Hash:  ");
    for (int i = 0; i < 32; i++) printf("%02x", hash[i]);
    printf("\n\n");

    cosmic_harmony_v4_benchmark(3);
    return 0;
}
#endif
