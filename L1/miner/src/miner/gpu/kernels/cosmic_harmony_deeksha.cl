/*
 * ZION Cosmic Harmony Deeksha — Canonical OpenCL GPU Mining Kernel
 *
 * Pipeline (EXACT match to Rust cosmic_harmony_deeksha()):
 *   Step 1: Keccak-256 (header||nonce → 32 B)
 *   Step 2: SHA3-512 (32 B → 64 B)
 *   Step 3: Golden Matrix (φ^k fixed-point, 64 B → 64 B)
 *   Step 4: Memory-Hard (64 KiB scratchpad, 2 sequential passes, 64 random reads)
 *   Step 5: NPU Mix (INT8 MLP 64→128→64 + residual)
 *   Step 6: Cosmic Fusion (4 × Keccak-256 + AES-128 + XOR, final SHA3-512 → 32 B)
 *
 * Author: ZION AI Native Team
 * Version: 2.9.8 — Canonical Deeksha GPU
 * Date: 10. března 2026
 */

#pragma OPENCL EXTENSION cl_khr_int64_base_atomics : enable

/* ========================================================================== */
/* Constants                                                                   */
/* ========================================================================== */

#define SCRATCHPAD_SIZE  65536
#define BLOCK_SIZE       64
#define BLOCK_COUNT      1024
#define PASSES           2
#define RANDOM_READS     64
#define MATRIX_DIM       8

#define ROL64(x, n) (((x) << (n)) | ((x) >> (64 - (n))))
#define XTIME(a) ((uchar)(((a) << 1) ^ ((((a) >> 7) & 1) * 0x1b)))

/* Keccak-f1600 round constants */
__constant ulong RC[24] = {
    0x0000000000000001UL, 0x0000000000008082UL,
    0x800000000000808AUL, 0x8000000080008000UL,
    0x000000000000808BUL, 0x0000000080000001UL,
    0x8000000080008081UL, 0x8000000000008009UL,
    0x000000000000008AUL, 0x0000000000000088UL,
    0x0000000080008009UL, 0x000000008000000AUL,
    0x000000008000808BUL, 0x800000000000008BUL,
    0x8000000000008089UL, 0x8000000000008003UL,
    0x8000000000008002UL, 0x8000000000000080UL,
    0x000000000000800AUL, 0x800000008000000AUL,
    0x8000000080008081UL, 0x8000000000008080UL,
    0x0000000080000001UL, 0x8000000080008008UL,
};

/* Golden ratio fixed-point powers: φ^k × 2^32 */
__constant ulong PHI_FP[16] = {
    4294967296UL,     6949403065UL,     11244370361UL,    18193773427UL,
    29438143788UL,    47631917215UL,    77070061004UL,    124701978219UL,
    201772039223UL,   326474017443UL,   528246056666UL,   854720074109UL,
    1382966130776UL,  2237686204885UL,  3620652335660UL,  5858338540545UL,
};

/* AES S-box (FIPS 197) */
__constant uchar AES_SBOX[256] = {
    0x63,0x7c,0x77,0x7b,0xf2,0x6b,0x6f,0xc5,0x30,0x01,0x67,0x2b,0xfe,0xd7,0xab,0x76,
    0xca,0x82,0xc9,0x7d,0xfa,0x59,0x47,0xf0,0xad,0xd4,0xa2,0xaf,0x9c,0xa4,0x72,0xc0,
    0xb7,0xfd,0x93,0x26,0x36,0x3f,0xf7,0xcc,0x34,0xa5,0xe5,0xf1,0x71,0xd8,0x31,0x15,
    0x04,0xc7,0x23,0xc3,0x18,0x96,0x05,0x9a,0x07,0x12,0x80,0xe2,0xeb,0x27,0xb2,0x75,
    0x09,0x83,0x2c,0x1a,0x1b,0x6e,0x5a,0xa0,0x52,0x3b,0xd6,0xb3,0x29,0xe3,0x2f,0x84,
    0x53,0xd1,0x00,0xed,0x20,0xfc,0xb1,0x5b,0x6a,0xcb,0xbe,0x39,0x4a,0x4c,0x58,0xcf,
    0xd0,0xef,0xaa,0xfb,0x43,0x4d,0x33,0x85,0x45,0xf9,0x02,0x7f,0x50,0x3c,0x9f,0xa8,
    0x51,0xa3,0x40,0x8f,0x92,0x9d,0x38,0xf5,0xbc,0xb6,0xda,0x21,0x10,0xff,0xf3,0xd2,
    0xcd,0x0c,0x13,0xec,0x5f,0x97,0x44,0x17,0xc4,0xa7,0x7e,0x3d,0x64,0x5d,0x19,0x73,
    0x60,0x81,0x4f,0xdc,0x22,0x2a,0x90,0x88,0x46,0xee,0xb8,0x14,0xde,0x5e,0x0b,0xdb,
    0xe0,0x32,0x3a,0x0a,0x49,0x06,0x24,0x5c,0xc2,0xd3,0xac,0x62,0x91,0x95,0xe4,0x79,
    0xe7,0xc8,0x37,0x6d,0x8d,0xd5,0x4e,0xa9,0x6c,0x56,0xf4,0xea,0x65,0x7a,0xae,0x08,
    0xba,0x78,0x25,0x2e,0x1c,0xa6,0xb4,0xc6,0xe8,0xdd,0x74,0x1f,0x4b,0xbd,0x8b,0x8a,
    0x70,0x3e,0xb5,0x66,0x48,0x03,0xf6,0x0e,0x61,0x35,0x57,0xb9,0x86,0xc1,0x1d,0x9e,
    0xe1,0xf8,0x98,0x11,0x69,0xd9,0x8e,0x94,0x9b,0x1e,0x87,0xe9,0xce,0x55,0x28,0xdf,
    0x8c,0xa1,0x89,0x0d,0xbf,0xe6,0x42,0x68,0x41,0x99,0x2d,0x0f,0xb0,0x54,0xbb,0x16,
};

/* AES round constants */
__constant uchar AES_RCON[10] = {
    0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36
};

/* ========================================================================== */
/* Keccak-f1600                                                                */
/* ========================================================================== */

void keccak_f1600(ulong *st)
{
    int rho[24] = {
         1,  3,  6, 10, 15, 21, 28, 36,
        45, 55,  2, 14, 27, 41, 56,  8,
        25, 43, 62, 18, 39, 61, 20, 44
    };
    int pi[24] = {
        10,  7, 11, 17, 18,  3,  5, 16,
         8, 21, 24,  4, 15, 23, 19, 13,
        12,  2, 20, 14, 22,  9,  6,  1
    };

    for (int round = 0; round < 24; round++) {
        /* Theta */
        ulong C[5], D[5];
        for (int x = 0; x < 5; x++)
            C[x] = st[x] ^ st[x+5] ^ st[x+10] ^ st[x+15] ^ st[x+20];
        for (int x = 0; x < 5; x++)
            D[x] = C[(x+4)%5] ^ ROL64(C[(x+1)%5], 1);
        for (int x = 0; x < 25; x++)
            st[x] ^= D[x % 5];

        /* Rho + Pi */
        ulong B[25];
        B[0] = st[0];
        ulong last = st[1];
        for (int i = 0; i < 24; i++) {
            ulong t = st[pi[i]];
            B[pi[i]] = ROL64(last, rho[i]);
            last = t;
        }
        for (int i = 0; i < 25; i++) st[i] = B[i];

        /* Chi */
        for (int y = 0; y < 5; y++) {
            ulong t[5];
            for (int x = 0; x < 5; x++) t[x] = st[y*5+x];
            for (int x = 0; x < 5; x++)
                st[y*5+x] = t[x] ^ ((~t[(x+1)%5]) & t[(x+2)%5]);
        }

        /* Iota */
        st[0] ^= RC[round];
    }
}

/* ========================================================================== */
/* Streaming Keccak absorb / finalize                                          */
/* ========================================================================== */

/*
 * Absorb `inlen` bytes from private-memory `in` into Keccak state.
 * `pos` tracks current byte position within the rate block.
 */
void keccak_absorb(ulong *st, int *pos, int rate,
                   const uchar *in, int inlen)
{
    while (inlen > 0) {
        int chunk = rate - *pos;
        if (chunk > inlen) chunk = inlen;
        for (int i = 0; i < chunk; i++)
            ((uchar *)st)[*pos + i] ^= in[i];
        in    += chunk;
        inlen -= chunk;
        *pos  += chunk;
        if (*pos == rate) {
            keccak_f1600(st);
            *pos = 0;
        }
    }
}

/*
 * Absorb from __global memory (scratchpad reads).
 */
void keccak_absorb_global(ulong *st, int *pos, int rate,
                          __global const uchar *in, int inlen)
{
    while (inlen > 0) {
        int chunk = rate - *pos;
        if (chunk > inlen) chunk = inlen;
        for (int i = 0; i < chunk; i++)
            ((uchar *)st)[*pos + i] ^= in[i];
        in    += chunk;
        inlen -= chunk;
        *pos  += chunk;
        if (*pos == rate) {
            keccak_f1600(st);
            *pos = 0;
        }
    }
}

/*
 * Apply domain-separation padding and squeeze output.
 */
void keccak_finalize(ulong *st, int pos, int rate,
                     uchar pad_byte, uchar *out, int outlen)
{
    ((uchar *)st)[pos]      ^= pad_byte;
    ((uchar *)st)[rate - 1] ^= 0x80;
    keccak_f1600(st);
    for (int i = 0; i < outlen; i++)
        out[i] = ((uchar *)st)[i];
}

/* ========================================================================== */
/* Hash convenience wrappers                                                   */
/* ========================================================================== */

/* Keccak-256: rate=136, padding=0x01, output=32 B (pre-NIST, Ethereum-style) */
void keccak256(const uchar *in, int inlen, uchar *out)
{
    ulong st[25]; int pos = 0;
    for (int i = 0; i < 25; i++) st[i] = 0;
    keccak_absorb(st, &pos, 136, in, inlen);
    keccak_finalize(st, pos, 136, 0x01, out, 32);
}

/* SHA3-512: rate=72, padding=0x06, output=64 B (NIST SHA-3) */
void sha3_512(const uchar *in, int inlen, uchar *out)
{
    ulong st[25]; int pos = 0;
    for (int i = 0; i < 25; i++) st[i] = 0;
    keccak_absorb(st, &pos, 72, in, inlen);
    keccak_finalize(st, pos, 72, 0x06, out, 64);
}

/* ========================================================================== */
/* Step 3: Golden Matrix (64 B → 64 B)                                        */
/* ========================================================================== */

void golden_matrix(const uchar *in64, uchar *out64)
{
    /*
     * 8×8 matrix where matrix[i][j] = in64[i*8+j] as u64.
     * result[i] = (Σ matrix[i][j] × PHI_FP[i+j]) >> 32
     * Output as 8 × u64 LE.
     *
     * Max product: 255 × 5.86e12 < 2^51.  Sum of 8: < 2^54.  Fits in ulong.
     */
    ulong result[8];
    for (int i = 0; i < 8; i++) {
        ulong sum = 0;
        for (int j = 0; j < 8; j++)
            sum += (ulong)in64[i * 8 + j] * PHI_FP[i + j];
        result[i] = sum >> 32;
    }
    for (int i = 0; i < 8; i++) {
        ulong v = result[i];
        for (int b = 0; b < 8; b++)
            out64[i * 8 + b] = (uchar)(v >> (b * 8));
    }
}

/* ========================================================================== */
/* Step 4: Memory-Hard Transform (64 B → 64 B, 64 KiB scratchpad)             */
/* ========================================================================== */

/*
 * Fill scratchpad with SHA3-512 chain:
 *   state = seed;  counter = 0
 *   for each 64-byte block:
 *     out = SHA3-512(state || counter_le)
 *     block = out;  state = out;  counter++
 */
void init_scratchpad(const uchar seed[64], __global uchar *pad)
{
    uchar state[64];
    for (int i = 0; i < 64; i++) state[i] = seed[i];

    for (uint blk = 0; blk < BLOCK_COUNT; blk++) {
        uchar input[72]; /* state(64) + counter(8) */
        for (int i = 0; i < 64; i++) input[i] = state[i];
        ulong counter = (ulong)blk;
        for (int b = 0; b < 8; b++) input[64 + b] = (uchar)(counter >> (b * 8));

        uchar out[64];
        sha3_512(input, 72, out);

        uint off = blk * BLOCK_SIZE;
        for (int i = 0; i < BLOCK_SIZE; i++) {
            pad[off + i] = out[i];
            state[i]     = out[i];
        }
    }
}

/*
 * mix_block: reads cur/prev/random blocks, hashes with SHA3-512, XOR result into cur.
 *
 * rand_index = (LE_u64(cur[0:8]) ^ pass ^ index) % BLOCK_COUNT
 * mixed = SHA3-512(current || prev || random || pass_le || index_le)
 * cur ^= mixed
 */
void mix_block(__global uchar *pad, uint index, ulong pass, int forward)
{
    uint prev_index;
    if (forward)
        prev_index = (index == 0) ? (BLOCK_COUNT - 1) : (index - 1);
    else
        prev_index = (index + 1 == BLOCK_COUNT) ? 0 : (index + 1);

    uint cur_off  = index * BLOCK_SIZE;
    uint prev_off = prev_index * BLOCK_SIZE;

    /* Derive random block index from current block's first 8 bytes */
    ulong idx_val = 0;
    for (int b = 0; b < 8; b++)
        idx_val |= (ulong)pad[cur_off + b] << (b * 8);
    uint rand_index = (uint)((idx_val ^ pass ^ (ulong)index) % BLOCK_COUNT);
    uint rand_off = rand_index * BLOCK_SIZE;

    /* Snapshot all three blocks to private memory */
    uchar current[BLOCK_SIZE], prev[BLOCK_SIZE], random_blk[BLOCK_SIZE];
    for (int i = 0; i < BLOCK_SIZE; i++) {
        current[i]    = pad[cur_off  + i];
        prev[i]       = pad[prev_off + i];
        random_blk[i] = pad[rand_off + i];
    }

    /* SHA3-512(current || prev || random || pass_le(8) || index_le(8)) */
    uchar pass_bytes[8], index_bytes[8];
    for (int b = 0; b < 8; b++) pass_bytes[b]  = (uchar)(pass >> (b * 8));
    for (int b = 0; b < 8; b++) index_bytes[b] = (uchar)((ulong)index >> (b * 8));

    ulong st[25]; int pos = 0;
    for (int i = 0; i < 25; i++) st[i] = 0;
    keccak_absorb(st, &pos, 72, current,     BLOCK_SIZE);
    keccak_absorb(st, &pos, 72, prev,        BLOCK_SIZE);
    keccak_absorb(st, &pos, 72, random_blk,  BLOCK_SIZE);
    keccak_absorb(st, &pos, 72, pass_bytes,  8);
    keccak_absorb(st, &pos, 72, index_bytes, 8);

    uchar mixed[64];
    keccak_finalize(st, pos, 72, 0x06, mixed, 64);

    /* XOR result into current block position */
    for (int i = 0; i < BLOCK_SIZE; i++)
        pad[cur_off + i] ^= mixed[i];
}

/*
 * 2 sequential passes: pass 0 forward (0..1023), pass 1 backward (1023..0).
 */
void sequential_passes(__global uchar *pad)
{
    for (int pass = 0; pass < PASSES; pass++) {
        int forward = (pass % 2 == 0);
        if (forward) {
            for (uint i = 0; i < BLOCK_COUNT; i++)
                mix_block(pad, i, (ulong)pass, 1);
        } else {
            for (int i = BLOCK_COUNT - 1; i >= 0; i--)
                mix_block(pad, (uint)i, (ulong)pass, 0);
        }
    }
}

/*
 * 64 random reads from scratchpad into accumulator, then final SHA3-512.
 *
 * For each read:
 *   d = Keccak-256(acc || chunk || r_le)
 *   acc[0..31] ^= d;  acc[32..63] += d (wrapping byte-add)
 *   pos = (LE_u64(d[0:8]) ^ pos ^ r) % BLOCK_COUNT
 *
 * Final: SHA3-512(acc || pad[0:64] || pad[65472:65536])
 */
void random_read_mix(const uchar seed[64], __global const uchar *pad,
                     uchar out[64])
{
    uchar acc[64];
    for (int i = 0; i < 64; i++) acc[i] = seed[i];

    /* Initial position from seed[0:8] */
    ulong pos_val = 0;
    for (int b = 0; b < 8; b++) pos_val |= (ulong)seed[b] << (b * 8);
    uint pos = (uint)(pos_val % BLOCK_COUNT);

    for (int r = 0; r < RANDOM_READS; r++) {
        uint off = pos * BLOCK_SIZE;

        /* Copy chunk from global scratchpad to private */
        uchar chunk[BLOCK_SIZE];
        for (int i = 0; i < BLOCK_SIZE; i++) chunk[i] = pad[off + i];

        /* r as u64 LE */
        uchar r_bytes[8];
        ulong r_val = (ulong)r;
        for (int b = 0; b < 8; b++) r_bytes[b] = (uchar)(r_val >> (b * 8));

        /* d = Keccak-256(acc || chunk || r_le) */
        ulong st[25]; int spos = 0;
        for (int i = 0; i < 25; i++) st[i] = 0;
        keccak_absorb(st, &spos, 136, acc,     64);
        keccak_absorb(st, &spos, 136, chunk,   BLOCK_SIZE);
        keccak_absorb(st, &spos, 136, r_bytes, 8);
        uchar d[32];
        keccak_finalize(st, spos, 136, 0x01, d, 32);

        /* Update accumulator */
        for (int i = 0; i < 32; i++) {
            acc[i]      ^= d[i];
            acc[32 + i]  = (uchar)((uint)acc[32 + i] + (uint)d[i]);
        }

        /* Next position */
        ulong next_val = 0;
        for (int b = 0; b < 8; b++) next_val |= (ulong)d[b] << (b * 8);
        pos = (uint)(((ulong)(uint)next_val ^ (ulong)pos ^ (ulong)r) % BLOCK_COUNT);
    }

    /* Final hash: SHA3-512(acc || pad[0:64] || pad[last_64:]) */
    uchar first_blk[BLOCK_SIZE], last_blk[BLOCK_SIZE];
    for (int i = 0; i < BLOCK_SIZE; i++) {
        first_blk[i] = pad[i];
        last_blk[i]  = pad[SCRATCHPAD_SIZE - BLOCK_SIZE + i];
    }

    ulong fst[25]; int fpos = 0;
    for (int i = 0; i < 25; i++) fst[i] = 0;
    keccak_absorb(fst, &fpos, 72, acc,       64);
    keccak_absorb(fst, &fpos, 72, first_blk, BLOCK_SIZE);
    keccak_absorb(fst, &fpos, 72, last_blk,  BLOCK_SIZE);
    keccak_finalize(fst, fpos, 72, 0x06, out, 64);
}

/* Full memory-hard transform: init → passes → random-read → 64 B output */
void memory_hard_transform(const uchar input[64], __global uchar *pad,
                           uchar output[64])
{
    init_scratchpad(input, pad);
    sequential_passes(pad);
    random_read_mix(input, pad, output);
}

/* ========================================================================== */
/* Step 5: NPU Mix — INT8 MLP 64→128→64 with LayerNorm + GELU + Residual      */
/* ========================================================================== */

int gelu_int8(int x)
{
    int num = x * (128 + x);
    int result = num >> 8;
    return clamp(result, -128, 127);
}

void npu_mix(const uchar in64[64], uchar out64[64],
             __global const char *w1,      /* [128][64]  = 8192 bytes */
             __global const char *b1,      /* [128]      = 128 bytes  */
             __global const char *w2,      /* [64][128]  = 8192 bytes */
             __global const char *b2,      /* [64]       = 64 bytes   */
             __global const short *scale1, /* [128]      = 256 bytes  */
             __global const short *scale2) /* [64]       = 128 bytes  */
{
    /* Input: u8 → signed i8 → i32 */
    int input_i32[64];
    for (int i = 0; i < 64; i++)
        input_i32[i] = (int)((char)in64[i]);

    /* ── Layer 1: Linear(64→128) ── */
    int hidden[128];
    for (int i = 0; i < 128; i++) {
        int acc = (int)b1[i] * 32;   /* bias upscale Q5 */
        for (int j = 0; j < 64; j++)
            acc += input_i32[j] * (int)w1[i * 64 + j];
        hidden[i] = clamp(acc >> 12, -128, 127);
    }

    /* LayerNorm1 */
    {
        int n = 128;
        long sum = 0;
        for (int i = 0; i < n; i++) sum += (long)hidden[i];
        int mean = (int)(sum / (long)n);
        long var_sum = 0;
        for (int i = 0; i < n; i++) {
            long d = (long)(hidden[i] - mean);
            var_sum += d * d;
        }
        int std_approx = (int)sqrt((float)(var_sum / (long)n)) + 1;
        for (int i = 0; i < n; i++) {
            int normalized = ((hidden[i] - mean) * 128) / std_approx;
            hidden[i] = clamp((normalized * (int)scale1[i]) >> 8, -128, 127);
        }
    }

    /* GELU activation */
    for (int i = 0; i < 128; i++)
        hidden[i] = gelu_int8(hidden[i]);

    /* ── Layer 2: Linear(128→64) ── */
    int output_i32[64];
    for (int i = 0; i < 64; i++) {
        int acc = (int)b2[i] * 32;
        for (int j = 0; j < 128; j++)
            acc += hidden[j] * (int)w2[i * 128 + j];
        output_i32[i] = clamp(acc >> 12, -128, 127);
    }

    /* LayerNorm2 */
    {
        int n = 64;
        long sum = 0;
        for (int i = 0; i < n; i++) sum += (long)output_i32[i];
        int mean = (int)(sum / (long)n);
        long var_sum = 0;
        for (int i = 0; i < n; i++) {
            long d = (long)(output_i32[i] - mean);
            var_sum += d * d;
        }
        int std_approx = (int)sqrt((float)(var_sum / (long)n)) + 1;
        for (int i = 0; i < n; i++) {
            int normalized = ((output_i32[i] - mean) * 128) / std_approx;
            output_i32[i] = clamp((normalized * (int)scale2[i]) >> 8, -128, 127);
        }
    }

    /* Residual add + output conversion */
    for (int i = 0; i < 64; i++) {
        int v = clamp(output_i32[i] + input_i32[i], -128, 127);
        out64[i] = (uchar)v; /* two's complement lower 8 bits */
    }
}

/* ========================================================================== */
/* AES-128 single-block encryption (FIPS 197)                                  */
/* ========================================================================== */

void aes_shift_rows(uchar s[16])
{
    uchar t;
    /* Row 1: shift left 1 */
    t = s[1]; s[1] = s[5]; s[5] = s[9]; s[9] = s[13]; s[13] = t;
    /* Row 2: shift left 2 */
    t = s[2]; s[2] = s[10]; s[10] = t;
    t = s[6]; s[6] = s[14]; s[14] = t;
    /* Row 3: shift left 3 (= right 1) */
    t = s[15]; s[15] = s[11]; s[11] = s[7]; s[7] = s[3]; s[3] = t;
}

void aes_mix_columns(uchar s[16])
{
    for (int c = 0; c < 4; c++) {
        int off = c * 4;
        uchar a0 = s[off], a1 = s[off+1], a2 = s[off+2], a3 = s[off+3];
        s[off]   = XTIME(a0) ^ XTIME(a1) ^ a1 ^ a2 ^ a3;
        s[off+1] = a0 ^ XTIME(a1) ^ XTIME(a2) ^ a2 ^ a3;
        s[off+2] = a0 ^ a1 ^ XTIME(a2) ^ XTIME(a3) ^ a3;
        s[off+3] = XTIME(a0) ^ a0 ^ a1 ^ a2 ^ XTIME(a3);
    }
}

void aes128_encrypt(const uchar key[16], uchar block[16])
{
    /* Key expansion: 11 round keys × 16 bytes = 176 bytes */
    uchar rk[176];
    for (int i = 0; i < 16; i++) rk[i] = key[i];

    for (int i = 16; i < 176; i += 4) {
        uchar t0 = rk[i-4], t1 = rk[i-3], t2 = rk[i-2], t3 = rk[i-1];
        if ((i & 15) == 0) {
            uchar tmp = t0;
            t0 = AES_SBOX[t1] ^ AES_RCON[i/16 - 1];
            t1 = AES_SBOX[t2];
            t2 = AES_SBOX[t3];
            t3 = AES_SBOX[tmp];
        }
        rk[i]   = rk[i-16] ^ t0;
        rk[i+1] = rk[i-15] ^ t1;
        rk[i+2] = rk[i-14] ^ t2;
        rk[i+3] = rk[i-13] ^ t3;
    }

    /* Initial AddRoundKey */
    for (int i = 0; i < 16; i++) block[i] ^= rk[i];

    /* Rounds 1–9: SubBytes → ShiftRows → MixColumns → AddRoundKey */
    for (int round = 1; round <= 9; round++) {
        for (int i = 0; i < 16; i++) block[i] = AES_SBOX[block[i]];
        aes_shift_rows(block);
        aes_mix_columns(block);
        int off = round * 16;
        for (int i = 0; i < 16; i++) block[i] ^= rk[off + i];
    }

    /* Round 10: SubBytes → ShiftRows → AddRoundKey (no MixColumns) */
    for (int i = 0; i < 16; i++) block[i] = AES_SBOX[block[i]];
    aes_shift_rows(block);
    for (int i = 0; i < 16; i++) block[i] ^= rk[160 + i];
}

/* ========================================================================== */
/* Step 6: Cosmic Fusion (64 B → 32 B)                                        */
/* ========================================================================== */

/*
 * Single fusion round (Keccak-256 + AES-128 mask, Haraka-inspired):
 *   intermediate = Keccak-256(state[0..32] || round_byte)
 *   block0 = AES-128(key=intermediate[0..16], plaintext=state[32..48])
 *   key2 = intermediate[0..16];  key2[0] ^= round; key2[15] ^= 0xAB
 *   block1 = AES-128(key=key2, plaintext=state[48..64])
 *   mask = block0 || block1
 *   state[0..32]  = intermediate ^ mask
 *   state[32..64] ^= intermediate
 */
void fusion_round(uchar state[64], uchar round_num)
{
    /* Keccak-256(state[0..32] || round_byte) */
    uchar hash_input[33];
    for (int i = 0; i < 32; i++) hash_input[i] = state[i];
    hash_input[32] = round_num;

    uchar intermediate[32];
    keccak256(hash_input, 33, intermediate);

    /* AES block 0: key = intermediate[0:16], plaintext = state[32:48] */
    uchar aes_key[16], block0[16], block1[16];
    for (int i = 0; i < 16; i++) aes_key[i] = intermediate[i];
    for (int i = 0; i < 16; i++) block0[i] = state[32 + i];
    aes128_encrypt(aes_key, block0);

    /* AES block 1: tweak key, plaintext = state[48:64] */
    uchar key2[16];
    for (int i = 0; i < 16; i++) key2[i] = aes_key[i];
    key2[0]  ^= round_num;
    key2[15] ^= 0xAB;
    for (int i = 0; i < 16; i++) block1[i] = state[48 + i];
    aes128_encrypt(key2, block1);

    /* mask = block0 || block1 */
    uchar mask[32];
    for (int i = 0; i < 16; i++) mask[i]      = block0[i];
    for (int i = 0; i < 16; i++) mask[16 + i]  = block1[i];

    /* state[32..64] ^= intermediate   (evolve upper half FIRST) */
    for (int i = 0; i < 32; i++)
        state[32 + i] ^= intermediate[i];

    /* state[0..32] = intermediate ^ mask   (overwrite lower half) */
    for (int i = 0; i < 32; i++)
        state[i] = intermediate[i] ^ mask[i];
}

void cosmic_fusion(const uchar in64[64], uchar hash32[32])
{
    uchar state[64];
    for (int i = 0; i < 64; i++) state[i] = in64[i];

    /* 4 fusion rounds */
    fusion_round(state, 0);
    fusion_round(state, 1);
    fusion_round(state, 2);
    fusion_round(state, 3);

    /* Final: SHA3-512(state[0:32]) → truncate to 32 B */
    uchar full[64];
    sha3_512(state, 32, full);
    for (int i = 0; i < 32; i++) hash32[i] = full[i];
}

/* ========================================================================== */
/* Main Kernel: deeksha_mine                                                   */
/* ========================================================================== */

__kernel void deeksha_mine(
    __global const uchar  *header,         /* [0] block header bytes         */
    uint                   header_len,     /* [1] actual header length       */
    ulong                  nonce_base,     /* [2] starting nonce             */
    __global uchar        *scratchpad_pool,/* [3] N × 65536 bytes            */
    uint                   target_u32,     /* [4] LE u32 target              */
    __global ulong        *result_nonce,   /* [5] output: winning nonce      */
    __global uchar        *result_hash,    /* [6] output: 32-byte hash       */
    __global const char *npu_w1,         /* [7] MLP W1 [128×64]            */
    __global const char *npu_b1,         /* [8] MLP b1 [128]               */
    __global const char *npu_w2,         /* [9] MLP W2 [64×128]            */
    __global const char *npu_b2,         /* [10] MLP b2 [64]               */
    __global const short *npu_scale1,    /* [11] LayerNorm scale1 [128]    */
    __global const short *npu_scale2     /* [12] LayerNorm scale2 [64]     */
)
{
    uint tid   = get_global_id(0);
    ulong nonce = nonce_base + (ulong)tid;

    /* Per-thread scratchpad in global memory */
    __global uchar *pad = scratchpad_pool + (ulong)tid * SCRATCHPAD_SIZE;

    /* ── Build input: header (≤80 B, zero-padded) + nonce (8 B LE) = 88 B ── */
    uchar input[88];
    for (int i = 0; i < 88; i++) input[i] = 0;
    uint hlen = min(header_len, (uint)80);
    for (uint i = 0; i < hlen; i++) input[i] = header[i];
    for (int b = 0; b < 8; b++) input[80 + b] = (uchar)(nonce >> (b * 8));

    /* ── Step 1: Keccak-256 (88 B → 32 B) ── */
    uchar s1[32];
    keccak256(input, 88, s1);

    /* ── Step 2: SHA3-512 (32 B → 64 B) ── */
    uchar s2[64];
    sha3_512(s1, 32, s2);

    /* ── Step 3: Golden Matrix (64 B → 64 B) ── */
    uchar s3[64];
    golden_matrix(s2, s3);

    /* ── Step 4: Memory-Hard (64 B → 64 B, 64 KiB scratchpad) ── */
    uchar s4[64];
    memory_hard_transform(s3, pad, s4);

    /* ── Step 5: NPU Mix (64 B → 64 B) ── */
    uchar s5[64];
    npu_mix(s4, s5, npu_w1, npu_b1, npu_w2, npu_b2, npu_scale1, npu_scale2);

    /* ── Step 6: Cosmic Fusion (64 B → 32 B) ── */
    uchar hash[32];
    cosmic_fusion(s5, hash);

    /* ── Target check: LE u32 from first 4 bytes ≤ target ── */
    uint state0 = (uint)hash[0]
                | ((uint)hash[1] <<  8)
                | ((uint)hash[2] << 16)
                | ((uint)hash[3] << 24);

    if (state0 <= target_u32) {
        ulong old = atom_cmpxchg(result_nonce, 0UL, nonce);
        if (old == 0UL) {
            for (int i = 0; i < 32; i++)
                result_hash[i] = hash[i];
        }
    }
}
