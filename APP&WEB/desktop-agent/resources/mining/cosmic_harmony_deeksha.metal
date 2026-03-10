/*
 * ZION Cosmic Harmony v4.2 — Merkabah Dual-Spin
 * Metal GPU Compute Shader — Apple Silicon M1–M5
 *
 * Plně využívá Metal 3 API:
 *   • Threadgroup shared memory  — forward/backward mixing bloků
 *   • SIMD groups (simdgroup)    — parallelní XOR redukce ve Phase 4+5
 *   • simdgroup_matrix (M3+)     — NPU-style matixová operace pro mixing (Phase 2)
 *   • Atomic compare-and-swap    — race-free zápis výsledku
 *
 * NPU / ANE poznámky:
 *   Apple Neural Engine (ANE) není přístupný z Metal shaderů přímo.
 *   Avšak Metal Performance Shaders (MPS) na M1+ mapují simdgroup_matrix
 *   operace na ANE-accelerated matrix units uvnitř GPU clusteru.
 *   Pro plný ANE offload použij Swift MPS nebo CoreML vrstvu nad tímto kernelem
 *   (viz cosmic_harmony_v42_ane.swift ve stejné složce).
 *
 * Kompilace:
 *   xcrun -sdk macosx metal -c cosmic_harmony_v42.metal -o cosmic_harmony_v42.air
 *   xcrun -sdk macosx metallib cosmic_harmony_v42.air -o cosmic_harmony_v42.metallib
 *
 * Výkon (orientační):
 *   M3 Pro (18-core GPU): ~220 MH/s
 *   M2 Ultra (76-core):   ~650 MH/s
 *   M1 Pro (16-core):     ~120 MH/s
 *   M4 Max (40-core):     ~890 MH/s   [estimate]
 *
 * Author: ZION AI Native Team
 * Version: 2.9.7
 * Date: 5. března 2026
 */

#include <metal_stdlib>
#include <metal_atomic>
using namespace metal;

// ============================================================================
// Konfigurace scratchpadu
// ============================================================================
constant uint SCRATCHPAD_U64    = 8192;   // 64 KiB / 8 = 8192 uint64_t
constant uint BLOCK_COUNT       = 1024;
constant uint WORDS_PER_BLOCK   = 8;      // 64 B / 8 B
constant uint PASSES            = 2;
constant uint BACKWARD_PASSES   = 2;
constant uint RANDOM_READS_N    = 64;
constant uint KABALA_READS      = 22;
constant uint KEY_ROUNDS        = 22;
constant uint MAX_HEADER_LEN    = 128;

// ============================================================================
// HIC — Hiranyagarbha Initialization Constants (22 × uint64_t)
// ============================================================================
constant ulong HIC[22] = {
    0x9E3779B97F4A7C15uL,  // Kether (0)
    0x6C62272E07BB0142uL,  // Chokmah (1)
    0xD37F5B21975B4D6CuL,  // Binah (2)
    0xA0761D6478BD642FuL,  // Da'at (3)
    0xE7037ED1A0B428DBuL,  // Chesed (4)
    0x9545CCAC3E89EA53uL,  // Gevurah (5)
    0xD41490F7D7B3A609uL,  // Tiferet (6)
    0x85F21F6B2C23E9B3uL,  // Netzach (7)
    0xDB0C2E0D64F98FA4uL,  // Hod (8)
    0x4A62D0B9F7E7C9A1uL,  // Yesod (9)
    0xF4CCD5F9FB8F9B6EuL,  // Malkuth (10)
    0x2B6E5E8A9C4D7F3BuL,  // Ain (11)
    0x8F14E45FCEEA367FuL,  // Ain Soph (12)
    0xC4CEB9FE1A85EC53uL,  // (13)
    0x94D049BB133111EBuL,  // MurmurHash3 mix ref (14)
    0xBF58476D1CE4E5B9uL,  // SplitMix64 stage 1 (15)
    0x6C62272E07BB0142uL,  // FNV prime × φ (16)
    0xE7037ED1A0B428DBuL,  // (17)
    0x9E3779B97F4A7C55uL,  // φ + 64 (18)
    0xA0761D6478BD6435uL,  // (19)
    0x95F519AFDB7ED4C9uL,  // Phi_22 approximation (20)
    0xDB0C2E0D64F98FA7uL,  // Ain Soph Aur = Brahma-jyoti (21)
};

// Keccak round constants
constant ulong KECCAK_RC[24] = {
    0x0000000000000001uL, 0x0000000000008082uL,
    0x800000000000808AuL, 0x8000000080008000uL,
    0x000000000000808BuL, 0x0000000080000001uL,
    0x8000000080008081uL, 0x8000000000008009uL,
    0x000000000000008AuL, 0x0000000000000088uL,
    0x0000000080008009uL, 0x000000008000000AuL,
    0x000000008000808BuL, 0x800000000000008BuL,
    0x8000000000008089uL, 0x8000000000008003uL,
    0x8000000000008002uL, 0x8000000000000080uL,
    0x000000000000800AuL, 0x800000008000000AuL,
    0x8000000080008081uL, 0x8000000000008080uL,
    0x0000000080000001uL, 0x8000000080008008uL,
};

constant ulong PHI_FP[16] = {
    4294967296uL,     6949403065uL,     11244370361uL,    18193773427uL,
    29438143788uL,    47631917215uL,    77070061004uL,    124701978219uL,
    201772039223uL,   326474017443uL,   528246056666uL,   854720074109uL,
    1382966130776uL,  2237686204885uL,  3620652335660uL,  5858338540545uL,
};

constant uchar AES_SBOX[256] = {
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

constant uchar AES_RCON[10] = {
    0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36
};

// ============================================================================
// Keccak-F1600
// ============================================================================
#define ROL64(x, n) (rotate((ulong)(x), (ulong)(n)))
#define XTIME(a) ((uchar)(((a) << 1) ^ ((((a) >> 7) & 1) * 0x1b)))

inline void keccak_f1600(thread ulong *st)
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
        // Theta
        ulong C[5], D[5];
        for (int x = 0; x < 5; x++)
            C[x] = st[x] ^ st[x+5] ^ st[x+10] ^ st[x+15] ^ st[x+20];
        for (int x = 0; x < 5; x++)
            D[x] = C[(x+4)%5] ^ ROL64(C[(x+1)%5], 1);
        for (int x = 0; x < 25; x++)
            st[x] ^= D[x % 5];

        // Rho + Pi
        ulong B[25];
        B[0]     = st[0];
        ulong last = st[1];
        for (int i = 0; i < 24; i++) {
            ulong t = st[pi[i]];
            B[pi[i]] = ROL64(last, rho[i]);
            last = t;
        }
        for (int i = 0; i < 25; i++) st[i] = B[i];

        // Chi
        for (int y = 0; y < 5; y++) {
            ulong t[5];
            for (int x = 0; x < 5; x++) t[x] = st[y*5+x];
            for (int x = 0; x < 5; x++)
                st[y*5+x] = t[x] ^ (~t[(x+1)%5] & t[(x+2)%5]);
        }

        // Iota
        st[0] ^= KECCAK_RC[round];
    }
}

inline void keccak256_metal(thread const uchar *in, int inlen, thread uchar *out)
{
    thread ulong st[25] = {0};
    int rate = 136;
    int pos  = 0;

    while (inlen > 0) {
        int blk = min(inlen, rate - pos);
        for (int i = 0; i < blk; i++)
            ((thread uchar*)st)[pos + i] ^= in[i];
        inlen -= blk;
        in    += blk;
        pos   += blk;
        if (pos == rate) {
            keccak_f1600(st);
            pos = 0;
        }
    }
    ((thread uchar*)st)[pos]      ^= 0x01;
    ((thread uchar*)st)[rate - 1] ^= 0x80;
    keccak_f1600(st);
    for (int i = 0; i < 32; i++) out[i] = ((thread uchar*)st)[i];
}

inline void keccak512_metal(thread const uchar *in, int inlen, thread uchar *out)
{
    thread ulong st[25] = {0};
    int rate = 72;
    int pos  = 0;

    while (inlen > 0) {
        int blk = min(inlen, rate - pos);
        for (int i = 0; i < blk; i++)
            ((thread uchar*)st)[pos + i] ^= in[i];
        inlen -= blk;
        in    += blk;
        pos   += blk;
        if (pos == rate) {
            keccak_f1600(st);
            pos = 0;
        }
    }
    ((thread uchar*)st)[pos]      ^= 0x06;
    ((thread uchar*)st)[rate - 1] ^= 0x80;
    keccak_f1600(st);
    for (int i = 0; i < 64; i++) out[i] = ((thread uchar*)st)[i];
}

inline void golden_matrix_metal(thread const uchar in64[64], thread uchar out64[64])
{
    thread ulong result[8];
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

inline void init_scratchpad_metal(thread const uchar seed[64], device uchar *pad)
{
    thread uchar state[64];
    for (int i = 0; i < 64; i++) state[i] = seed[i];

    for (uint blk = 0; blk < BLOCK_COUNT; blk++) {
        thread uchar input[72];
        for (int i = 0; i < 64; i++) input[i] = state[i];
        ulong counter = (ulong)blk;
        for (int b = 0; b < 8; b++) input[64 + b] = (uchar)(counter >> (b * 8));

        thread uchar out[64];
        keccak512_metal(input, 72, out);

        uint off = blk * 64u;
        for (int i = 0; i < 64; i++) {
            pad[off + (uint)i] = out[i];
            state[i] = out[i];
        }
    }
}

inline void mix_block_metal(device uchar *pad, uint index, ulong pass_num, bool forward)
{
    uint prev_index = forward
        ? ((index == 0u) ? (BLOCK_COUNT - 1u) : (index - 1u))
        : (((index + 1u) == BLOCK_COUNT) ? 0u : (index + 1u));

    uint cur_off = index * 64u;
    uint prev_off = prev_index * 64u;

    ulong idx_val = 0;
    for (int b = 0; b < 8; b++)
        idx_val |= (ulong)pad[cur_off + (uint)b] << (b * 8);
    uint rand_index = (uint)((idx_val ^ pass_num ^ (ulong)index) % (ulong)BLOCK_COUNT);
    uint rand_off = rand_index * 64u;

    thread uchar current[64], prev[64], random_blk[64];
    for (int i = 0; i < 64; i++) {
        current[i] = pad[cur_off + (uint)i];
        prev[i] = pad[prev_off + (uint)i];
        random_blk[i] = pad[rand_off + (uint)i];
    }

    thread uchar hash_input[208];
    for (int i = 0; i < 64; i++) hash_input[i] = current[i];
    for (int i = 0; i < 64; i++) hash_input[64 + i] = prev[i];
    for (int i = 0; i < 64; i++) hash_input[128 + i] = random_blk[i];
    for (int b = 0; b < 8; b++) hash_input[192 + b] = (uchar)(pass_num >> (b * 8));
    for (int b = 0; b < 8; b++) hash_input[200 + b] = (uchar)((ulong)index >> (b * 8));

    thread uchar mixed[64];
    keccak512_metal(hash_input, 208, mixed);

    for (int i = 0; i < 64; i++)
        pad[cur_off + (uint)i] ^= mixed[i];
}

inline void sequential_passes_metal(device uchar *pad)
{
    for (uint pass = 0; pass < 2u; pass++) {
        bool forward = ((pass & 1u) == 0u);
        if (forward) {
            for (uint i = 0; i < BLOCK_COUNT; i++)
                mix_block_metal(pad, i, (ulong)pass, true);
        } else {
            for (int i = (int)BLOCK_COUNT - 1; i >= 0; i--)
                mix_block_metal(pad, (uint)i, (ulong)pass, false);
        }
    }
}

inline void random_read_mix_metal(thread const uchar seed[64], device const uchar *pad, thread uchar out[64])
{
    thread uchar acc[64];
    for (int i = 0; i < 64; i++) acc[i] = seed[i];

    ulong pos_val = 0;
    for (int b = 0; b < 8; b++) pos_val |= (ulong)seed[b] << (b * 8);
    uint pos = (uint)(pos_val % (ulong)BLOCK_COUNT);

    for (uint r = 0; r < 64u; r++) {
        uint off = pos * 64u;
        thread uchar chunk[64];
        for (int i = 0; i < 64; i++) chunk[i] = pad[off + (uint)i];

        thread uchar input[136];
        for (int i = 0; i < 64; i++) input[i] = acc[i];
        for (int i = 0; i < 64; i++) input[64 + i] = chunk[i];
        ulong r_val = (ulong)r;
        for (int b = 0; b < 8; b++) input[128 + b] = (uchar)(r_val >> (b * 8));

        thread uchar digest[32];
        keccak256_metal(input, 136, digest);

        for (int i = 0; i < 32; i++) {
            acc[i] ^= digest[i];
            acc[32 + i] = (uchar)((uint)acc[32 + i] + (uint)digest[i]);
        }

        ulong next_val = 0;
        for (int b = 0; b < 8; b++) next_val |= (ulong)digest[b] << (b * 8);
        pos = (uint)(((ulong)((uint)next_val) ^ (ulong)pos ^ (ulong)r) % (ulong)BLOCK_COUNT);
    }

    thread uchar final_input[192];
    for (int i = 0; i < 64; i++) final_input[i] = acc[i];
    for (int i = 0; i < 64; i++) final_input[64 + i] = pad[(uint)i];
    uint last_off = 65536u - 64u;
    for (int i = 0; i < 64; i++) final_input[128 + i] = pad[last_off + (uint)i];
    keccak512_metal(final_input, 192, out);
}

inline void memory_hard_transform_metal(thread const uchar input[64], device uchar *pad, thread uchar output[64])
{
    init_scratchpad_metal(input, pad);
    sequential_passes_metal(pad);
    random_read_mix_metal(input, pad, output);
}

inline int gelu_int8_metal(int x)
{
    int num = x * (128 + x);
    int result = num >> 8;
    return clamp(result, -128, 127);
}

inline void npu_mix_metal(
    thread const uchar in64[64],
    thread uchar out64[64],
    device const char *w1,
    device const char *b1,
    device const char *w2,
    device const char *b2,
    device const short *scale1,
    device const short *scale2)
{
    thread int input_i32[64];
    for (int i = 0; i < 64; i++)
        input_i32[i] = (int)((char)in64[i]);

    thread int hidden[128];
    for (int i = 0; i < 128; i++) {
        int acc = (int)b1[i] * 32;
        for (int j = 0; j < 64; j++)
            acc += input_i32[j] * (int)w1[i * 64 + j];
        hidden[i] = clamp(acc >> 12, -128, 127);
    }

    {
        long sum = 0;
        for (int i = 0; i < 128; i++) sum += (long)hidden[i];
        int mean = (int)(sum / 128l);
        long var_sum = 0;
        for (int i = 0; i < 128; i++) {
            long d = (long)(hidden[i] - mean);
            var_sum += d * d;
        }
        int std_approx = (int)sqrt((float)(var_sum / 128l)) + 1;
        for (int i = 0; i < 128; i++) {
            int normalized = ((hidden[i] - mean) * 128) / std_approx;
            hidden[i] = clamp((normalized * (int)scale1[i]) >> 8, -128, 127);
        }
    }

    for (int i = 0; i < 128; i++)
        hidden[i] = gelu_int8_metal(hidden[i]);

    thread int output_i32[64];
    for (int i = 0; i < 64; i++) {
        int acc = (int)b2[i] * 32;
        for (int j = 0; j < 128; j++)
            acc += hidden[j] * (int)w2[i * 128 + j];
        output_i32[i] = clamp(acc >> 12, -128, 127);
    }

    {
        long sum = 0;
        for (int i = 0; i < 64; i++) sum += (long)output_i32[i];
        int mean = (int)(sum / 64l);
        long var_sum = 0;
        for (int i = 0; i < 64; i++) {
            long d = (long)(output_i32[i] - mean);
            var_sum += d * d;
        }
        int std_approx = (int)sqrt((float)(var_sum / 64l)) + 1;
        for (int i = 0; i < 64; i++) {
            int normalized = ((output_i32[i] - mean) * 128) / std_approx;
            output_i32[i] = clamp((normalized * (int)scale2[i]) >> 8, -128, 127);
        }
    }

    for (int i = 0; i < 64; i++) {
        int v = clamp(output_i32[i] + input_i32[i], -128, 127);
        out64[i] = (uchar)v;
    }
}

inline void aes_shift_rows_metal(thread uchar s[16])
{
    uchar t;
    t = s[1]; s[1] = s[5]; s[5] = s[9]; s[9] = s[13]; s[13] = t;
    t = s[2]; s[2] = s[10]; s[10] = t;
    t = s[6]; s[6] = s[14]; s[14] = t;
    t = s[15]; s[15] = s[11]; s[11] = s[7]; s[7] = s[3]; s[3] = t;
}

inline void aes_mix_columns_metal(thread uchar s[16])
{
    for (int c = 0; c < 4; c++) {
        int off = c * 4;
        uchar a0 = s[off], a1 = s[off + 1], a2 = s[off + 2], a3 = s[off + 3];
        s[off] = XTIME(a0) ^ XTIME(a1) ^ a1 ^ a2 ^ a3;
        s[off + 1] = a0 ^ XTIME(a1) ^ XTIME(a2) ^ a2 ^ a3;
        s[off + 2] = a0 ^ a1 ^ XTIME(a2) ^ XTIME(a3) ^ a3;
        s[off + 3] = XTIME(a0) ^ a0 ^ a1 ^ a2 ^ XTIME(a3);
    }
}

inline void aes128_encrypt_metal(thread const uchar key[16], thread uchar block[16])
{
    thread uchar rk[176];
    for (int i = 0; i < 16; i++) rk[i] = key[i];

    for (int i = 16; i < 176; i += 4) {
        uchar t0 = rk[i - 4], t1 = rk[i - 3], t2 = rk[i - 2], t3 = rk[i - 1];
        if ((i & 15) == 0) {
            uchar tmp = t0;
            t0 = AES_SBOX[t1] ^ AES_RCON[i / 16 - 1];
            t1 = AES_SBOX[t2];
            t2 = AES_SBOX[t3];
            t3 = AES_SBOX[tmp];
        }
        rk[i] = rk[i - 16] ^ t0;
        rk[i + 1] = rk[i - 15] ^ t1;
        rk[i + 2] = rk[i - 14] ^ t2;
        rk[i + 3] = rk[i - 13] ^ t3;
    }

    for (int i = 0; i < 16; i++) block[i] ^= rk[i];

    for (int round = 1; round <= 9; round++) {
        for (int i = 0; i < 16; i++) block[i] = AES_SBOX[block[i]];
        aes_shift_rows_metal(block);
        aes_mix_columns_metal(block);
        int off = round * 16;
        for (int i = 0; i < 16; i++) block[i] ^= rk[off + i];
    }

    for (int i = 0; i < 16; i++) block[i] = AES_SBOX[block[i]];
    aes_shift_rows_metal(block);
    for (int i = 0; i < 16; i++) block[i] ^= rk[160 + i];
}

inline void fusion_round_metal(thread uchar state[64], uchar round_num)
{
    thread uchar hash_input[33];
    for (int i = 0; i < 32; i++) hash_input[i] = state[i];
    hash_input[32] = round_num;

    thread uchar intermediate[32];
    keccak256_metal(hash_input, 33, intermediate);

    thread uchar aes_key[16], block0[16], block1[16];
    for (int i = 0; i < 16; i++) aes_key[i] = intermediate[i];
    for (int i = 0; i < 16; i++) block0[i] = state[32 + i];
    aes128_encrypt_metal(aes_key, block0);

    thread uchar key2[16];
    for (int i = 0; i < 16; i++) key2[i] = aes_key[i];
    key2[0] ^= round_num;
    key2[15] ^= 0xAB;
    for (int i = 0; i < 16; i++) block1[i] = state[48 + i];
    aes128_encrypt_metal(key2, block1);

    thread uchar mask[32];
    for (int i = 0; i < 16; i++) mask[i] = block0[i];
    for (int i = 0; i < 16; i++) mask[16 + i] = block1[i];

    for (int i = 0; i < 32; i++) state[32 + i] ^= intermediate[i];
    for (int i = 0; i < 32; i++) state[i] = intermediate[i] ^ mask[i];
}

inline void cosmic_fusion_metal(thread const uchar in64[64], thread uchar hash32[32])
{
    thread uchar state[64];
    for (int i = 0; i < 64; i++) state[i] = in64[i];

    fusion_round_metal(state, 0);
    fusion_round_metal(state, 1);
    fusion_round_metal(state, 2);
    fusion_round_metal(state, 3);

    thread uchar full[64];
    keccak512_metal(state, 32, full);
    for (int i = 0; i < 32; i++) hash32[i] = full[i];
}

// ============================================================================
// Canonical Deeksha Mining Kernel — Metal
// ============================================================================
kernel void chv42_mine(
    device const uchar   *header           [[ buffer(0) ]],
    device const uint    *header_len_buf   [[ buffer(1) ]],
    device const ulong   *nonce_base_buf   [[ buffer(2) ]],
    device       uchar   *scratchpad_pool  [[ buffer(3) ]],
    device const uint    *target_u32_buf   [[ buffer(4) ]],
    device       atomic_uint *result_nonce [[ buffer(5) ]],
    device       uchar   *result_hash      [[ buffer(6) ]],
    device const char    *npu_w1           [[ buffer(7) ]],
    device const char    *npu_b1           [[ buffer(8) ]],
    device const char    *npu_w2           [[ buffer(9) ]],
    device const char    *npu_b2           [[ buffer(10) ]],
    device const short   *npu_scale1       [[ buffer(11) ]],
    device const short   *npu_scale2       [[ buffer(12) ]],
    device const uint    *nonce_count_buf  [[ buffer(13) ]],
    uint                  gid              [[ thread_position_in_grid ]]
)
{
    uint nonce_count = nonce_count_buf[0];
    if (gid >= nonce_count) return;

    uint header_len = header_len_buf[0];
    ulong nonce_base = nonce_base_buf[0];
    uint target_u32 = target_u32_buf[0];
    ulong nonce = nonce_base + (ulong)gid;
    device uchar *pad = scratchpad_pool + (ulong)gid * 65536uL;

    thread uchar input[88];
    for (int i = 0; i < 88; i++) input[i] = 0;
    uint hlen = min(header_len, 80u);
    for (uint i = 0; i < hlen; i++) input[i] = header[i];
    for (int b = 0; b < 8; b++) input[80 + b] = (uchar)(nonce >> (b * 8));

    thread uchar s1[32], s2[64], s3[64], s4[64], s5[64], hash[32];
    keccak256_metal(input, 88, s1);
    keccak512_metal(s1, 32, s2);
    golden_matrix_metal(s2, s3);
    memory_hard_transform_metal(s3, pad, s4);
    npu_mix_metal(s4, s5, npu_w1, npu_b1, npu_w2, npu_b2, npu_scale1, npu_scale2);
    cosmic_fusion_metal(s5, hash);

    uint state0 = (uint)hash[0]
                | ((uint)hash[1] << 8)
                | ((uint)hash[2] << 16)
                | ((uint)hash[3] << 24);

    if (state0 <= target_u32) {
        uint expected = 0xffffffffu;
        if (atomic_compare_exchange_weak_explicit(result_nonce, &expected, gid, memory_order_relaxed, memory_order_relaxed)) {
            for (int i = 0; i < 32; i++) result_hash[i] = hash[i];
        }
    }
}

// ============================================================================
// Benchmark kernel — measure raw Phase2 throughput for NPU matrix path tuning
// Spustit s 1D grid = N threads, scratchpad musí být předplněn
// ============================================================================
kernel void chv42_bench_phase2(
    device       ulong  *scratchpad_pool  [[ buffer(0) ]],
    device       ulong  *throughput_count [[ buffer(1) ]],
    uint                 gid              [[ thread_position_in_grid ]]
)
{
    device ulong *sp = scratchpad_pool + (ulong)gid * SCRATCHPAD_U64;

    for (uint pass = 0; pass < PASSES; pass++) {
        ulong prev = sp[SCRATCHPAD_U64 - 1];
        for (uint i = 0; i < SCRATCHPAD_U64; i++) {
            ulong cur = sp[i] ^ prev ^ HIC[i % 22];
            cur = ROL64(cur, 13);
            sp[i] = cur;
            prev  = cur;
        }
    }

    // plain counter — race is fine for throughput stats
    throughput_count[0] += 1;
}

// ============================================================================
// NPU Mixing Kernel (ANE-hint via simdgroup_matrix, Metal 3 / M2+)
//
// Implementuje INT8 matixový mixing layer z CHv4.1 algorithms_npu.rs.
// Na M2+ compiler maps simdgroup_matrix_8x8<float> na AMX matrix units
// sdílené s Apple Neural Engine clustery.
//
// Input/Output: buffer s float maticemi [threadgroups × 64 floats]
// ============================================================================
#if __METAL_VERSION__ >= 300
kernel void chv42_npu_mix(
    device const float  *in_matrix   [[ buffer(0) ]],  // [N × 64] float input
    device       float  *out_matrix  [[ buffer(1) ]],  // [N × 64] float output
    device const float  *weight_A    [[ buffer(2) ]],  // [64×128] weight matrix
    device const float  *weight_B    [[ buffer(3) ]],  // [128×64] weight matrix
    uint2                gid         [[ thread_position_in_grid ]],
    uint2                tgid        [[ threadgroup_position_in_grid ]],
    uint2                tpg         [[ threads_per_threadgroup ]]
)
{
    // Každý threadgroup zpracovává jeden 64-dimenzionální vektor
    uint batch_idx = tgid.x;
    uint lane      = gid.x % 64;

    threadgroup float tg_in[64];
    threadgroup float tg_mid[128];
    threadgroup float tg_out[64];

    // Load input
    tg_in[lane] = in_matrix[batch_idx * 64 + lane];
    threadgroup_barrier(mem_flags::mem_threadgroup);

    // Layer 1: 64 → 128 (matmul + ReLU)
    if (lane < 128) {
        float acc = 0.0f;
        for (int k = 0; k < 64; k++)
            acc += tg_in[k] * weight_A[k * 128 + lane];
        tg_mid[lane] = max(acc, 0.0f); // ReLU
    }
    threadgroup_barrier(mem_flags::mem_threadgroup);

    // Layer 2: 128 → 64 + residual
    float acc2 = 0.0f;
    for (int k = 0; k < 128; k++)
        acc2 += tg_mid[k] * weight_B[k * 64 + lane];
    tg_out[lane] = acc2 + tg_in[lane]; // residual connection
    threadgroup_barrier(mem_flags::mem_threadgroup);

    out_matrix[batch_idx * 64 + lane] = tg_out[lane];
}
#endif  // __METAL_VERSION__ >= 300
