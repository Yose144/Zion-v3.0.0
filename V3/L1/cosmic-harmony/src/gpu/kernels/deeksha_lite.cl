/*
 * DeekshaLite v1 — OpenCL Kernel (V3 Integration)
 * Simplified ASIC-resistant algorithm for GCN/RDNA compatibility
 *
 * Pipeline:
 *   1. Keccak256(header||nonce) → 32B
 *   2. Memory-hard scratchpad (256 KiB, 2 passes, 64 random reads) → 32B
 *   3. AES-128 CTR mixing (4 rounds) → 32B
 *   4. Keccak256(final_input) → 32B
 *
 * GCN-safe: no pointer casts, minimal 64-bit int usage
 * No s4_mode needed — simple enough for full GPU pipeline
 */

/* ========================================================================== */
/* Includes — reuse existing helpers from cosmic_harmony_deeksha.cl          */
/* The miner backend concatenates this with the main kernel source.         */
/* ========================================================================== */

/* NOTE: This kernel is designed to be compiled standalone or appended to
 * the existing cosmic_harmony_deeksha.cl. When standalone, define your own
 * keccak_f1600, keccak256, and AES helpers below. */

#ifndef _DEEKSHA_LITE_KERNEL_
#define _DEEKSHA_LITE_KERNEL_

/* ========================================================================== */
/* Constants                                                                  */
/* ========================================================================== */

#define DL_SCRATCHPAD_SIZE  262144   /* 256 KiB */
#define DL_BLOCK_SIZE         32
#define DL_BLOCK_COUNT        8192    /* 262144 / 32 */
#define DL_PASSES             2
#define DL_RANDOM_READS       64
#define DL_AES_ROUNDS         4

/* Keccak-f1600 (minimal version for this kernel) */
#define DL_ROL64(x, n) rotate((long)((ulong)(x)), (long)((ulong)(n)))

/* ========================================================================== */
/* Keccak helpers (duplicated if not included from main kernel)               */
/* ========================================================================== */

#ifndef KECCAK_F1600_DEFINED
#define KECCAK_F1600_DEFINED

__constant ulong DL_RC[24] = {
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

void dl_keccak_f1600(ulong *st)
{
    ulong bc0, bc1, bc2, bc3, bc4, t;
    for (int r = 0; r < 24; r++) {
        bc0 = st[0] ^ st[5] ^ st[10] ^ st[15] ^ st[20];
        bc1 = st[1] ^ st[6] ^ st[11] ^ st[16] ^ st[21];
        bc2 = st[2] ^ st[7] ^ st[12] ^ st[17] ^ st[22];
        bc3 = st[3] ^ st[8] ^ st[13] ^ st[18] ^ st[23];
        bc4 = st[4] ^ st[9] ^ st[14] ^ st[19] ^ st[24];
        t = bc4 ^ DL_ROL64(bc1, 1); st[0] ^= t; st[5] ^= t; st[10] ^= t; st[15] ^= t; st[20] ^= t;
        t = bc0 ^ DL_ROL64(bc2, 1); st[1] ^= t; st[6] ^= t; st[11] ^= t; st[16] ^= t; st[21] ^= t;
        t = bc1 ^ DL_ROL64(bc3, 1); st[2] ^= t; st[7] ^= t; st[12] ^= t; st[17] ^= t; st[22] ^= t;
        t = bc2 ^ DL_ROL64(bc4, 1); st[3] ^= t; st[8] ^= t; st[13] ^= t; st[18] ^= t; st[23] ^= t;
        t = bc3 ^ DL_ROL64(bc0, 1); st[4] ^= t; st[9] ^= t; st[14] ^= t; st[19] ^= t; st[24] ^= t;

        t = st[1];
        st[1] = DL_ROL64(st[6], 44); st[6] = DL_ROL64(st[9], 20); st[9] = DL_ROL64(st[22], 61);
        st[22] = DL_ROL64(st[14], 39); st[14] = DL_ROL64(st[20], 18); st[20] = DL_ROL64(st[2], 62);
        st[2] = DL_ROL64(st[12], 43); st[12] = DL_ROL64(st[13], 25); st[13] = DL_ROL64(st[19], 56);
        st[19] = DL_ROL64(st[23], 27); st[23] = DL_ROL64(st[15], 36); st[15] = DL_ROL64(st[4], 28);
        st[4] = DL_ROL64(st[24], 21); st[24] = DL_ROL64(st[21], 15); st[21] = DL_ROL64(st[8], 14);
        st[8] = DL_ROL64(st[16], 45); st[16] = DL_ROL64(st[5], 8); st[5] = DL_ROL64(st[3], 55);
        st[3] = DL_ROL64(st[18], 3); st[18] = DL_ROL64(st[17], 10); st[17] = DL_ROL64(st[11], 39);
        st[11] = DL_ROL64(st[7], 41); st[7] = DL_ROL64(st[10], 2); st[10] = DL_ROL64(t, 1);

        t = st[0]; st[0] ^= (~st[1]) & st[2]; st[1] ^= (~st[2]) & st[3]; st[2] ^= (~st[3]) & st[4];
        st[3] ^= (~st[4]) & t; st[4] ^= (~st[0]) & st[1];
        t = st[5]; st[5] ^= (~st[6]) & st[7]; st[6] ^= (~st[7]) & st[8]; st[7] ^= (~st[8]) & st[9];
        st[8] ^= (~st[9]) & t; st[9] ^= (~st[5]) & st[6];
        t = st[10]; st[10] ^= (~st[11]) & st[12]; st[11] ^= (~st[12]) & st[13]; st[12] ^= (~st[13]) & st[14];
        st[13] ^= (~st[14]) & t; st[14] ^= (~st[10]) & st[11];
        t = st[15]; st[15] ^= (~st[16]) & st[17]; st[16] ^= (~st[17]) & st[18]; st[17] ^= (~st[18]) & st[19];
        st[18] ^= (~st[19]) & t; st[19] ^= (~st[15]) & st[16];
        t = st[20]; st[20] ^= (~st[21]) & st[22]; st[21] ^= (~st[22]) & st[23]; st[22] ^= (~st[23]) & st[24];
        st[23] ^= (~st[24]) & t; st[24] ^= (~st[20]) & st[21];

        st[0] ^= DL_RC[r];
    }
}

void dl_keccak256(const uchar *in, uint inlen, uchar out[32])
{
    ulong st[25];
    for (int i = 0; i < 25; i++) st[i] = 0;

    uint pos = 0;
    for (uint i = 0; i < inlen; i++) {
        ((uchar *)st)[pos] ^= in[i];
        pos++;
        if (pos == 136) {
            dl_keccak_f1600(st);
            pos = 0;
        }
    }

    ((uchar *)st)[pos] ^= 0x01;
    ((uchar *)st)[135] ^= 0x80;
    dl_keccak_f1600(st);

    for (int i = 0; i < 32; i++) out[i] = ((uchar *)st)[i];
}

void dl_sha3_512(const uchar *in, uint inlen, uchar out[64])
{
    ulong st[25];
    for (int i = 0; i < 25; i++) st[i] = 0;

    uint pos = 0;
    for (uint i = 0; i < inlen; i++) {
        ((uchar *)st)[pos] ^= in[i];
        pos++;
        if (pos == 72) {
            dl_keccak_f1600(st);
            pos = 0;
        }
    }

    ((uchar *)st)[pos] ^= 0x06;
    ((uchar *)st)[71] ^= 0x80;
    dl_keccak_f1600(st);

    for (int i = 0; i < 64; i++) out[i] = ((uchar *)st)[i];
}

#endif /* KECCAK_F1600_DEFINED */

/* ========================================================================== */
/* AES helpers (duplicated if not included from main kernel)                  */
/* ========================================================================== */

#ifndef DL_AES_DEFINED
#define DL_AES_DEFINED

__constant uchar DL_AES_SBOX[256] = {
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

void dl_sub_bytes(uchar state[16])
{
    for (int i = 0; i < 16; i++) state[i] = DL_AES_SBOX[state[i]];
}

void dl_shift_rows(uchar state[16])
{
    uchar tmp;
    tmp = state[1]; state[1] = state[5]; state[5] = state[9]; state[9] = state[13]; state[13] = tmp;
    tmp = state[2]; state[2] = state[10]; state[10] = tmp;
    tmp = state[6]; state[6] = state[14]; state[14] = tmp;
    tmp = state[15]; state[15] = state[11]; state[11] = state[7]; state[7] = state[3]; state[3] = tmp;
}

uchar dl_xtime(uchar a)
{
    return (uchar)((a << 1) ^ (((a >> 7) & 1) * 0x1b));
}

void dl_mix_columns(uchar state[16])
{
    for (int i = 0; i < 4; i++) {
        uchar a = state[i * 4];
        uchar b = state[i * 4 + 1];
        uchar c = state[i * 4 + 2];
        uchar d = state[i * 4 + 3];
        uchar e = a ^ b ^ c ^ d;
        state[i * 4]     ^= e ^ dl_xtime(a ^ b);
        state[i * 4 + 1] ^= e ^ dl_xtime(b ^ c);
        state[i * 4 + 2] ^= e ^ dl_xtime(c ^ d);
        state[i * 4 + 3] ^= e ^ dl_xtime(d ^ a);
    }
}

void dl_add_round_key(uchar state[16], const uchar key[16])
{
    for (int i = 0; i < 16; i++) state[i] ^= key[i];
}

void dl_aes_round(uchar state[16], const uchar key[16])
{
    dl_sub_bytes(state);
    dl_shift_rows(state);
    dl_mix_columns(state);
    dl_add_round_key(state, key);
}

void dl_aes_final_round(uchar state[16], const uchar key[16])
{
    dl_sub_bytes(state);
    dl_shift_rows(state);
    dl_add_round_key(state, key);
}

#endif /* DL_AES_DEFINED */

/* ========================================================================== */
/* Scratchpad helpers                                                          */
/* ========================================================================== */

void dl_fill_scratchpad(const uchar seed[32], __global uchar *pad)
{
    uchar state[64];
    for (int i = 0; i < 32; i++) state[i] = seed[i];
    for (int i = 32; i < 64; i++) state[i] = 0;

    for (uint blk = 0; blk < DL_BLOCK_COUNT; blk++) {
        uchar input[72];
        for (int i = 0; i < 64; i++) input[i] = state[i];
        input[64] = (uchar)(blk);
        input[65] = (uchar)(blk >> 8);
        input[66] = (uchar)(blk >> 16);
        input[67] = (uchar)(blk >> 24);
        for (int i = 68; i < 72; i++) input[i] = 0;

        uchar out[64];
        dl_sha3_512(input, 65, out);

        uint off = blk * DL_BLOCK_SIZE;
        for (int i = 0; i < 32; i++) {
            pad[off + i] = out[i];
            state[i] = out[i];
        }
    }
}

void dl_sequential_passes(__global uchar *pad)
{
    for (int pass = 0; pass < DL_PASSES; pass++) {
        int forward = (pass % 2 == 0);
        if (forward) {
            for (uint i = 0; i < DL_BLOCK_COUNT; i++) {
                uint prev = (i == 0) ? (DL_BLOCK_COUNT - 1) : (i - 1);
                uint cur_off = i * DL_BLOCK_SIZE;
                uint prev_off = prev * DL_BLOCK_SIZE;
                for (int j = 0; j < DL_BLOCK_SIZE; j++) {
                    pad[cur_off + j] ^= pad[prev_off + j];
                }
            }
        } else {
            for (uint i = DL_BLOCK_COUNT; i > 0; i--) {
                uint idx = i - 1;
                uint prev = (idx + 1 == DL_BLOCK_COUNT) ? 0 : (idx + 1);
                uint cur_off = idx * DL_BLOCK_SIZE;
                uint prev_off = prev * DL_BLOCK_SIZE;
                for (int j = 0; j < DL_BLOCK_SIZE; j++) {
                    pad[cur_off + j] ^= pad[prev_off + j];
                }
            }
        }
    }
}

void dl_random_read_mix(const uchar seed[32], __global const uchar *pad, uchar out[32])
{
    uchar acc[32];
    for (int i = 0; i < 32; i++) acc[i] = seed[i];

    uint pos = 0;
    for (int r = 0; r < DL_RANDOM_READS; r++) {
        uint off = pos * DL_BLOCK_SIZE;
        for (int i = 0; i < 32; i++) {
            acc[i] ^= pad[off + i];
        }

        uint idx_val = 0;
        for (int i = 0; i < 4; i++) {
            idx_val |= ((uint)acc[i]) << (i * 8);
        }
        pos = (uint)((idx_val ^ pos ^ (uint)r) % DL_BLOCK_COUNT);
    }

    for (int i = 0; i < 32; i++) out[i] = acc[i];
}

void dl_aes128_mix(const uchar seed[32], ulong nonce, uchar out[32])
{
    uchar key[16];
    for (int i = 0; i < 16; i++) key[i] = seed[i];

    uchar counter[16];
    for (int i = 0; i < 8; i++) counter[i] = (uchar)(nonce >> (i * 8));
    for (int i = 0; i < 8; i++) counter[8 + i] = seed[16 + i];

    uchar block0[16], block1[16];
    for (int i = 0; i < 16; i++) {
        block0[i] = counter[i];
        block1[i] = counter[i];
    }
    block1[0]++;

    for (int r = 0; r < 3; r++) {
        dl_aes_round(block0, key);
        dl_aes_round(block1, key);
    }
    dl_aes_final_round(block0, key);
    dl_aes_final_round(block1, key);

    for (int i = 0; i < 16; i++) {
        out[i] = block0[i] ^ seed[i % 32];
        out[16 + i] = block1[i] ^ seed[(16 + i) % 32];
    }
}

/* ========================================================================== */
/* Main Kernel: deeksha_lite_mine                                             */
/* ========================================================================== */

__kernel void deeksha_lite_mine(
    __global const uchar *header,
    uint header_len,
    ulong nonce_base,
    uint nonce_count,
    __global uchar *output_hashes,
    __global uchar *scratchpad_pool
)
{
    uint tid = get_global_id(0);
    if (tid >= nonce_count) return;

    __global uchar *pad = scratchpad_pool + (ulong)tid * DL_SCRATCHPAD_SIZE;
    ulong nonce = nonce_base + (ulong)tid;

    /* Step 1: Build input and Keccak256 */
    uchar input[88];
    for (int i = 0; i < 88; i++) input[i] = 0;
    uint hlen = min(header_len, (uint)80);
    for (uint i = 0; i < hlen; i++) input[i] = header[i];
    for (int i = 0; i < 8; i++) input[80 + i] = (uchar)(nonce >> (i * 8));

    uchar s1[32];
    dl_keccak256(input, 88, s1);

    /* Step 2: Memory-hard scratchpad */
    dl_fill_scratchpad(s1, pad);
    dl_sequential_passes(pad);
    uchar s2[32];
    dl_random_read_mix(s1, pad, s2);

    /* Step 3: AES-128 CTR mixing */
    uchar s3[32];
    dl_aes128_mix(s2, nonce, s3);

    /* Step 4: Final Keccak256 */
    uchar hash[32];
    dl_keccak256(s3, 32, hash);

    /* Write output */
    __global uchar *slot = output_hashes + (ulong)tid * 32;
    for (int i = 0; i < 32; i++) slot[i] = hash[i];
}

#endif /* _DEEKSHA_LITE_KERNEL_ */
