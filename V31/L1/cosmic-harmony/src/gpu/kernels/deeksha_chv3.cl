/*
 * DeekshaChv3 — Unified Canonical OpenCL Kernel (Phase C) OPTIMIZED
 *
 * This kernel is a bit-identical alias of deeksha_lite.cl.
 * Phase A established deeksha_chv3 as the canonical name for deeksha_lite_v1.
 * Phase C provides a dedicated GPU kernel with the canonical name.
 *
 * Pipeline (Ekam Deeksha v2):
 *   1. Keccak256(header[0..80] || nonce_le[0..8])  → s1[32]
 *      OPTIMIZATION: Host precomputes Keccak state after absorbing header.
 *      Each thread only XORs nonce, applies padding, and runs f1600.
 *   2. Memory-hard scratchpad (128 KiB)
 *        Phase A: SHA3-512 chain fill  (BLOCK_COUNT=4096 × 32B)
 *        Phase B: 1 forward sequential XOR pass
 *        Phase C: 32 random reads → acc[32]  (idx derived from 8 bytes)
 *      OPTIMIZATION: Vectorized 32-byte reads/writes via ulong4 vload4/vstore4.
 *   3. AES-128 CTR mix (key=s2[0..16], counter=nonce||s2[16..24])
 *        → block0 + block1(counter+1), 1 full round + 1 final round
 *        → XOR with s2[0..32]
 *   4. Keccak256(s3)  → final hash[32]
 *
 * GCN-safe: union instead of pointer casts for keccak state.
 * No Blake3 — SHA3-512 is used for scratchpad fill (GPU-friendly).
 *
 * KAT (Known Answer Test): CPU↔GPU parity verified via
 * deeksha_chv3::tests::chv3_kat_known_vector.
 */

/* 32-bit atomics for on-device target check + early exit (matches CUDA).
 * 64-bit atomics (cl_khr_int64_base_atomics) are NOT used — they cause
 * compiler issues on gfx900. 32-bit atomics are safe on all AMD/NVIDIA. */
#pragma OPENCL EXTENSION cl_khr_global_int32_base_atomics : enable
#pragma OPENCL EXTENSION cl_khr_global_int32_extended_atomics : enable

/* ========================================================================== */
/* Constants                                                                   */
/* ========================================================================== */

#define SCRATCHPAD_SIZE  131072   /* 128 KiB = 4096 * 32 */
#define BLOCK_SIZE       32
#define BLOCK_COUNT      4096
#define PASSES           1
#define RANDOM_READS     32

/* Local work group size — overridden via build options for the real miner. */
#ifndef LOCAL_SIZE
#define LOCAL_SIZE 64
#endif

/* ========================================================================== */
/* Keccak — canonical implementation from cosmic_harmony_deeksha.cl           */
/* Uses rotate(long,long) per AMD GCN/RDNA workaround recommendation.         */
/* ========================================================================== */

/* AMD Vega/GCN/RDNA: use rotate(long,long) — maps to v_alignbyte on GCN.
 * The bit-shift version was slower by ~115ms/batch on Vega 64 (i066d).
 * The 126 H/s issue was only on SMOS i088 (ROCm 6.x); i066d (ROCm 5.x) is fine. */
#define ROL64(x, n) rotate((long)((ulong)(x)), (long)((ulong)(n)))

/* Chi macro: one 5-element row, no temp array */
#define CHI_ROW(b) \
{ ulong _a=st[(b)],_b=st[(b)+1],_c=st[(b)+2],_d=st[(b)+3],_e=st[(b)+4]; \
  st[(b)]   = _a ^ ((~_b) & _c); \
  st[(b)+1] = _b ^ ((~_c) & _d); \
  st[(b)+2] = _c ^ ((~_d) & _e); \
  st[(b)+3] = _d ^ ((~_e) & _a); \
  st[(b)+4] = _e ^ ((~_a) & _b); }

__constant ulong KC_RC[24] = {
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

/* keccak_f1600: canonical Rho+Pi via 23-element swap chain (no arrays) */
__attribute__((always_inline))
void keccak_f1600(__private ulong *st)
{
    ulong bc0, bc1, bc2, bc3, bc4, t;

    #pragma unroll 1
    for (int rnd = 0; rnd < 24; rnd++) {
        /* Theta */
        bc0 = st[0]^st[5]^st[10]^st[15]^st[20];
        bc1 = st[1]^st[6]^st[11]^st[16]^st[21];
        bc2 = st[2]^st[7]^st[12]^st[17]^st[22];
        bc3 = st[3]^st[8]^st[13]^st[18]^st[23];
        bc4 = st[4]^st[9]^st[14]^st[19]^st[24];
        t=bc4^ROL64(bc1,1); st[0]^=t;st[5]^=t;st[10]^=t;st[15]^=t;st[20]^=t;
        t=bc0^ROL64(bc2,1); st[1]^=t;st[6]^=t;st[11]^=t;st[16]^=t;st[21]^=t;
        t=bc1^ROL64(bc3,1); st[2]^=t;st[7]^=t;st[12]^=t;st[17]^=t;st[22]^=t;
        t=bc2^ROL64(bc4,1); st[3]^=t;st[8]^=t;st[13]^=t;st[18]^=t;st[23]^=t;
        t=bc3^ROL64(bc0,1); st[4]^=t;st[9]^=t;st[14]^=t;st[19]^=t;st[24]^=t;

        /* Rho+Pi — 23-element swap chain (same order as canonical reference) */
        t=st[1];
        bc0=st[10];st[10]=ROL64(t, 1);t=bc0;
        bc0=st[ 7];st[ 7]=ROL64(t, 3);t=bc0;
        bc0=st[11];st[11]=ROL64(t, 6);t=bc0;
        bc0=st[17];st[17]=ROL64(t,10);t=bc0;
        bc0=st[18];st[18]=ROL64(t,15);t=bc0;
        bc0=st[ 3];st[ 3]=ROL64(t,21);t=bc0;
        bc0=st[ 5];st[ 5]=ROL64(t,28);t=bc0;
        bc0=st[16];st[16]=ROL64(t,36);t=bc0;
        bc0=st[ 8];st[ 8]=ROL64(t,45);t=bc0;
        bc0=st[21];st[21]=ROL64(t,55);t=bc0;
        bc0=st[24];st[24]=ROL64(t, 2);t=bc0;
        bc0=st[ 4];st[ 4]=ROL64(t,14);t=bc0;
        bc0=st[15];st[15]=ROL64(t,27);t=bc0;
        bc0=st[23];st[23]=ROL64(t,41);t=bc0;
        bc0=st[19];st[19]=ROL64(t,56);t=bc0;
        bc0=st[13];st[13]=ROL64(t, 8);t=bc0;
        bc0=st[12];st[12]=ROL64(t,25);t=bc0;
        bc0=st[ 2];st[ 2]=ROL64(t,43);t=bc0;
        bc0=st[20];st[20]=ROL64(t,62);t=bc0;
        bc0=st[14];st[14]=ROL64(t,18);t=bc0;
        bc0=st[22];st[22]=ROL64(t,39);t=bc0;
        bc0=st[ 9];st[ 9]=ROL64(t,61);t=bc0;
        bc0=st[ 6];st[ 6]=ROL64(t,20);t=bc0;
                   st[ 1]=ROL64(t,44);

        /* Chi */
        CHI_ROW(0) CHI_ROW(5) CHI_ROW(10) CHI_ROW(15) CHI_ROW(20)

        /* Iota */
        st[0] ^= KC_RC[rnd];
    }
}

/* keccak_state union — GCN address space safe (no pointer casts) */
typedef union { ulong u[25]; uchar b[200]; } keccak_st_t;

/* Keccak256 (Ethereum variant, padding 0x01) — precomputed state variant */
__attribute__((always_inline))
void keccak256_from_state(
    __constant const ulong * restrict pre_state,
    ulong nonce,
    __private uchar out[32])
{
    keccak_st_t s;
    #pragma unroll
    for (int i = 0; i < 25; i++) s.u[i] = pre_state[i];
    /* XOR nonce into bytes 80..87 = u64[10] */
    s.u[10] ^= nonce;
    /* Apply padding: 0x01 at byte 88 (u64[11] byte 0), 0x80 at byte 135 (u64[16] byte 7) */
    s.u[11] ^= 0x01UL;
    s.u[16] ^= 0x80UL << 56;
    keccak_f1600(s.u);
    /* Vectorized 32-byte output copy */
    ((__private ulong*)out)[0] = s.u[0];
    ((__private ulong*)out)[1] = s.u[1];
    ((__private ulong*)out)[2] = s.u[2];
    ((__private ulong*)out)[3] = s.u[3];
}

/* SHA3-512 (NIST, padding 0x06, rate=72) */
__attribute__((always_inline))
void sha3_512(__private const uchar * restrict in, uint inlen, __private uchar * restrict out)
{
    keccak_st_t s;
    #pragma unroll
    for (int i = 0; i < 25; i++) s.u[i] = 0;
    uint pos = 0;
    for (uint i = 0; i < inlen; i++) {
        s.b[pos] ^= in[i];
        if (++pos == 72) { keccak_f1600(s.u); pos = 0; }
    }
    s.b[pos] ^= 0x06;
    s.b[71]  ^= 0x80;
    keccak_f1600(s.u);
    #pragma unroll
    for (int i = 0; i < 64; i++) out[i] = s.b[i];
}

/* SHA3-512 specialized for 65-byte input (used by fill_scratchpad).
 * Input always fits in one keccak block (rate=72 > 65), so no
 * mid-absorption permutation needed.
 *
 * u64-optimized version: takes 8 u64s of state + 1 byte block index,
 * outputs 8 u64s. Avoids 65 byte-by-byte XOR operations that cause
 * high register pressure on AMD. Matches fire kernel sha3_512_65_u64. */
__attribute__((always_inline))
inline void sha3_512_65_u64(
    __private const ulong * restrict state_in,
    uchar blk_byte,
    __private ulong * restrict out_u64)
{
    __private ulong st[25];
    st[0]=state_in[0]; st[1]=state_in[1]; st[2]=state_in[2]; st[3]=state_in[3];
    st[4]=state_in[4]; st[5]=state_in[5]; st[6]=state_in[6]; st[7]=state_in[7];
    st[8]=0; st[9]=0; st[10]=0; st[11]=0; st[12]=0; st[13]=0; st[14]=0; st[15]=0;
    st[16]=0; st[17]=0; st[18]=0; st[19]=0; st[20]=0; st[21]=0; st[22]=0; st[23]=0;
    st[24]=0;

    /* XOR byte 64 into low byte of st[8] */
    st[8] ^= (ulong)blk_byte;
    /* Pad: 0x06 at byte 65 (st[8] byte 1), 0x80 at byte 71 (st[8] byte 7) */
    st[8] ^= (0x06UL << 8) | (0x80UL << 56);

    keccak_f1600(st);

    out_u64[0]=st[0]; out_u64[1]=st[1]; out_u64[2]=st[2]; out_u64[3]=st[3];
    out_u64[4]=st[4]; out_u64[5]=st[5]; out_u64[6]=st[6]; out_u64[7]=st[7];
}

/* ========================================================================== */
/* AES-128 helpers                                                             */
/* ========================================================================== */

__constant uchar AES_SBOX_DATA[256] = {
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

enum { SBOX_LDS_SIZE = 256 };

__attribute__((always_inline))
void aes_sub_bytes(__private uchar s[16], __local const uchar * restrict sbox)
{
    #pragma unroll
    for (int i = 0; i < 16; i++) s[i] = sbox[s[i]];
}

__attribute__((always_inline))
void aes_shift_rows(__private uchar s[16])
{
    uchar t;
    t = s[1];  s[1]  = s[5];  s[5]  = s[9];  s[9]  = s[13]; s[13] = t;
    t = s[2];  s[2]  = s[10]; s[10] = t;
    t = s[6];  s[6]  = s[14]; s[14] = t;
    t = s[15]; s[15] = s[11]; s[11] = s[7];   s[7]  = s[3];  s[3]  = t;
}

__attribute__((always_inline))
uchar aes_xtime(uchar a)
{
    return (uchar)((a << 1) ^ (((a >> 7) & 1) * 0x1b));
}

__attribute__((always_inline))
void aes_mix_columns(__private uchar s[16])
{
    #pragma unroll
    for (int i = 0; i < 4; i++) {
        uchar a = s[i*4], b = s[i*4+1], c = s[i*4+2], d = s[i*4+3];
        uchar e = a ^ b ^ c ^ d;
        s[i*4]   ^= e ^ aes_xtime(a ^ b);
        s[i*4+1] ^= e ^ aes_xtime(b ^ c);
        s[i*4+2] ^= e ^ aes_xtime(c ^ d);
        s[i*4+3] ^= e ^ aes_xtime(d ^ a);
    }
}

__attribute__((always_inline))
void aes_add_round_key(__private uchar s[16], __private const uchar k[16])
{
    #pragma unroll
    for (int i = 0; i < 16; i++) s[i] ^= k[i];
}

__attribute__((always_inline))
void aes_round(__private uchar s[16], __private const uchar k[16], __local const uchar * restrict sbox)
{
    aes_sub_bytes(s, sbox);
    aes_shift_rows(s);
    aes_mix_columns(s);
    aes_add_round_key(s, k);
}

__attribute__((always_inline))
void aes_final_round(__private uchar s[16], __private const uchar k[16], __local const uchar * restrict sbox)
{
    aes_sub_bytes(s, sbox);
    aes_shift_rows(s);
    aes_add_round_key(s, k);
}

/* ========================================================================== */
/* Step 2A: Fill scratchpad with SHA3-512 chain (INTERLEAVED layout)           */
/*                                                                             */
/* Matches CPU ekam_deeksha.rs step2_memory_hard Phase 1 (Ekam v2):           */
/*   state[0..32] = seed, state[32..64] = 0                                   */
/*   for blk in 0..4096:                                                       */
/*     input[0..64] = state                                                    */
/*     input[64..68] = blk.to_le_bytes()  (only [64] used — hash 65 bytes)   */
/*     out = sha3_512(&input[..65])                                            */
/*     pad[blk*32..blk*32+32] = out[0..32]                                    */
/*     state[0..32] = out[0..32]                                               */
/*                                                                             */
/* INTERLEAVED: block blk of thread tid at pad_pool + (blk*total+tid)*32      */
/* → coalesced wavefront access (matches CUDA kernel).                        */
/* ========================================================================== */

__attribute__((always_inline))
void fill_scratchpad(
    __private const ulong seed_u64[4],
    __global uchar * restrict pad_pool,
    uint tid,
    uint total_threads)
{
    __private ulong state[8];
    state[0] = seed_u64[0]; state[1] = seed_u64[1];
    state[2] = seed_u64[2]; state[3] = seed_u64[3];
    state[4] = 0; state[5] = 0; state[6] = 0; state[7] = 0;

    #pragma unroll 1
    for (uint blk = 0; blk < BLOCK_COUNT; blk++) {
        __private ulong out[8];
        sha3_512_65_u64(state, (uchar)(blk & 0xFF), out);

        __global ulong *pb = (__global ulong*)(pad_pool + ((ulong)blk * total_threads + tid) * BLOCK_SIZE);
        pb[0] = out[0]; pb[1] = out[1]; pb[2] = out[2]; pb[3] = out[3];

        /* Chain state: first 4 u64s from output, rest zero */
        state[0] = out[0]; state[1] = out[1];
        state[2] = out[2]; state[3] = out[3];
        state[4] = 0; state[5] = 0; state[6] = 0; state[7] = 0;
    }
}

/* ========================================================================== */
/* Step 2B: Sequential passes (INTERLEAVED)                                     */
/* ========================================================================== */

__attribute__((always_inline))
void sequential_passes(
    __global uchar * restrict pad_pool,
    uint tid,
    uint total_threads)
{
    /* Forward pass: XOR each block with previous (wrap-around) */
    __global ulong *prev_pb = (__global ulong*)(pad_pool + ((ulong)(BLOCK_COUNT-1) * total_threads + tid) * BLOCK_SIZE);
    ulong prev0 = prev_pb[0], prev1 = prev_pb[1], prev2 = prev_pb[2], prev3 = prev_pb[3];
    #pragma unroll 1
    for (uint i = 0; i < BLOCK_COUNT; i++) {
        __global ulong *pb = (__global ulong*)(pad_pool + ((ulong)i * total_threads + tid) * BLOCK_SIZE);
        ulong cv0 = pb[0] ^ prev0, cv1 = pb[1] ^ prev1, cv2 = pb[2] ^ prev2, cv3 = pb[3] ^ prev3;
        pb[0] = cv0; pb[1] = cv1; pb[2] = cv2; pb[3] = cv3;
        prev0 = cv0; prev1 = cv1; prev2 = cv2; prev3 = cv3;
    }
#if PASSES >= 2
    /* Backward pass: XOR each block with next (wrap-around) */
    __global ulong *next_pb = (__global ulong*)(pad_pool + ((ulong)0 * total_threads + tid) * BLOCK_SIZE);
    ulong next0 = next_pb[0], next1 = next_pb[1], next2 = next_pb[2], next3 = next_pb[3];
    #pragma unroll 1
    for (uint i = BLOCK_COUNT; i > 0; i--) {
        uint idx = i - 1;
        __global ulong *pb = (__global ulong*)(pad_pool + ((ulong)idx * total_threads + tid) * BLOCK_SIZE);
        ulong cv0 = pb[0] ^ next0, cv1 = pb[1] ^ next1, cv2 = pb[2] ^ next2, cv3 = pb[3] ^ next3;
        pb[0] = cv0; pb[1] = cv1; pb[2] = cv2; pb[3] = cv3;
        next0 = cv0; next1 = cv1; next2 = cv2; next3 = cv3;
    }
#endif
}

/* ========================================================================== */
/* Step 2C: Random read mix (INTERLEAVED)                                       */
/* ========================================================================== */

__attribute__((always_inline))
void random_read_mix(
    __private const ulong seed_u64[4],
    __global const uchar * restrict pad_pool,
    uint tid,
    uint total_threads,
    __private ulong out_u64[4])
{
    __private ulong acc[4];
    acc[0] = seed_u64[0]; acc[1] = seed_u64[1];
    acc[2] = seed_u64[2]; acc[3] = seed_u64[3];
    ulong pos = 0;
    #pragma unroll 4
    for (ulong r = 0; r < RANDOM_READS; r++) {
        __global const ulong *pb = (__global const ulong*)(pad_pool + ((ulong)(uint)pos * total_threads + tid) * BLOCK_SIZE);
        acc[0] ^= pb[0]; acc[1] ^= pb[1]; acc[2] ^= pb[2]; acc[3] ^= pb[3];
        pos = (acc[0] ^ pos ^ r) % BLOCK_COUNT;
    }
    out_u64[0] = acc[0]; out_u64[1] = acc[1];
    out_u64[2] = acc[2]; out_u64[3] = acc[3];
}

/* ========================================================================== */
/* Step 3: AES-128 CTR mix                                                     */
/*                                                                             */
/* FIX: counter+1 uses proper carry propagation matching CPU:                  */
/*   let mut carry: u16 = 1;                                                   */
/*   for i in 0..16 { sum = block1[i] + carry; block1[i]=sum&0xFF; carry=sum>>8; if carry==0 break } */
/* ========================================================================== */

__attribute__((always_inline))
void aes128_mix(
    __private const ulong seed_u64[4],
    ulong nonce,
    __private ulong out_u64[4],
    __local const uchar * restrict sbox)
{
    __private const uchar *seed = (__private const uchar*)seed_u64;
    uchar key[16] __attribute__((aligned(8)));
    #pragma unroll
    for (int i = 0; i < 16; i++) key[i] = seed[i];

    uchar counter[16] __attribute__((aligned(8)));
    #pragma unroll
    for (int i = 0; i < 8; i++) counter[i]     = (uchar)(nonce >> (i * 8));
    #pragma unroll
    for (int i = 0; i < 8; i++) counter[8 + i] = seed[16 + i];

    uchar block0[16] __attribute__((aligned(8)));
    uchar block1[16] __attribute__((aligned(8)));
    #pragma unroll
    for (int i = 0; i < 16; i++) { block0[i] = counter[i]; block1[i] = counter[i]; }

    /* Proper carry propagation for counter+1 */
    uint carry = 1;
    #pragma unroll
    for (int i = 0; i < 16; i++) {
        uint s = (uint)block1[i] + carry;
        block1[i] = (uchar)(s & 0xFF);
        carry = s >> 8;
        if (carry == 0) break;
    }

    /* Ekam v2: 1 full AES round + 1 final round (total 2 rounds) */
    #pragma unroll
    for (int r = 0; r < 1; r++) {
        aes_round(block0, key, sbox);
        aes_round(block1, key, sbox);
    }
    aes_final_round(block0, key, sbox);
    aes_final_round(block1, key, sbox);

    __private uchar *out = (__private uchar*)out_u64;
    #pragma unroll
    for (int i = 0; i < 16; i++) {
        out[i]      = block0[i] ^ seed[i];
        out[16 + i] = block1[i] ^ seed[16 + i];
    }
}

/* ========================================================================== */
/* Stream-profit byproduct helpers                                             */
/*                                                                             */
/* These perform extra work proportional to stream weights AFTER the base      */
/* PoW hash has been computed.  Results are written back to the scratchpad     */
/* (which is then discarded) so the compiler cannot dead-code eliminate the    */
/* extra work, while the PoW output hash remains unchanged.                    */
/* ========================================================================== */

#define STREAM_WEIGHT_COUNT 6
#define SW_ZION          0
#define SW_KECCAK_BONUS  1
#define SW_SHA3_BONUS    2
#define SW_NCL_AI        3
#define SW_DEEKSHA_LITE  4
#define SW_THERMAL       5

#define STREAM_ITERS_SCALE 16.0f

__attribute__((always_inline))
void stream_byproduct_keccak(__private const uchar in[32], int iters, __global uchar * restrict pad)
{
    if (iters <= 0) return;
    keccak_st_t s;
    #pragma unroll
    for (int i = 0; i < 25; i++) s.u[i] = 0;
    #pragma unroll
    for (int i = 0; i < 32; i++) s.b[i] ^= in[i];
    s.b[32] ^= 0x01;
    s.b[135] ^= 0x80;
    for (int i = 0; i < iters; i++) {
        keccak_f1600(s.u);
    }
    ulong4 h = vload4(0, (__private ulong*)s.b);
    vstore4(h, 0, (__global ulong*)pad);
}

__attribute__((always_inline))
void stream_byproduct_sha3(__private const uchar in[32], int iters, __global uchar * restrict pad)
{
    if (iters <= 0) return;
    uchar tmp[64];
    #pragma unroll
    for (int i = 0; i < 32; i++) tmp[i] = in[i];
    #pragma unroll
    for (int i = 32; i < 64; i++) tmp[i] = 0;
    for (int i = 0; i < iters; i++) {
        sha3_512(tmp, 32, tmp);
    }
    ulong4 h = vload4(0, (__private ulong*)tmp);
    vstore4(h, 0, (__global ulong*)pad);
}

__attribute__((always_inline))
void stream_byproduct_aes(__private const uchar in[32], ulong nonce, int iters,
                          __global uchar * restrict pad, __local const uchar * restrict sbox)
{
    if (iters <= 0) return;
    ulong tmp_u64[4];
    __private uchar *tmp = (__private uchar*)tmp_u64;
    #pragma unroll
    for (int i = 0; i < 32; i++) tmp[i] = in[i];
    for (int i = 0; i < iters; i++) {
        aes128_mix(tmp_u64, nonce + (ulong)i, tmp_u64, sbox);
    }
    ulong4 h = vload4(0, (__private ulong*)tmp);
    vstore4(h, 0, (__global ulong*)pad);
}

/* ========================================================================== */
/* Main kernel                                                                  */
/* ========================================================================== */

__kernel __attribute__((reqd_work_group_size(LOCAL_SIZE, 1, 1)))
void deeksha_chv3_mine(
    __constant const ulong * restrict header_keccak_state,
    ulong  nonce_base,
    uint   nonce_count,
    __global uchar * restrict output_hashes,
    __global uchar * restrict scratchpad_pool,
    __constant float * restrict stream_weights,
    uint target_u32,                        /* big-endian u32 target (0=benchmark) */
    __global uint  * restrict result_flag,  /* 0=not found, 1=found (atomic) */
    __global ulong * restrict result_nonce, /* winning nonce (written by winner) */
    __global uchar * restrict result_hash)  /* winning hash (written by winner) */
{
    /* Load AES S-box into __local (LDS) memory — matches CUDA __shared__ */
    __local uchar sbox[SBOX_LDS_SIZE];
    {
        uint lid = get_local_id(0);
        uint lsize = get_local_size(0);
        for (uint i = lid; i < SBOX_LDS_SIZE; i += lsize) {
            sbox[i] = AES_SBOX_DATA[i];
        }
        barrier(CLK_LOCAL_MEM_FENCE);
    }

    uint tid = get_global_id(0);
    if (tid >= nonce_count) return;

    /* Early exit if solution already found by another workgroup.
     * atomic_add(flag, 0) reads the flag with memory ordering —
     * guarantees visibility across workgroups. Matches CUDA's
     * atomicAdd(result_nonce, 0ULL) early-exit pattern. */
    if (target_u32 != 0 && atomic_add(result_flag, 0) != 0) return;

    ulong nonce = nonce_base + (ulong)tid;

    /* Step 1: Keccak256(header || nonce) — u64 throughout (matches CUDA) */
    ulong s1[4];
    {
        __private ulong st[25];
        for (int i = 0; i < 25; i++) st[i] = header_keccak_state[i];
        st[10] ^= nonce;
        st[11] ^= 0x01UL;
        st[16] ^= (0x80UL << 56);
        keccak_f1600(st);
        s1[0] = st[0]; s1[1] = st[1]; s1[2] = st[2]; s1[3] = st[3];
    }

    /* Step 2: Memory-hard scratchpad — INTERLEAVED (coalesced, matches CUDA) */
    fill_scratchpad(s1, scratchpad_pool, tid, nonce_count);
    sequential_passes(scratchpad_pool, tid, nonce_count);
    ulong s2[4];
    random_read_mix(s1, scratchpad_pool, tid, nonce_count, s2);

    /* Step 3: AES-128 CTR mix — S-box from LDS */
    ulong s3[4];
    aes128_mix(s2, nonce, s3, sbox);

    /* Step 4: Keccak256 final — u64 direct (matches CUDA, no byte-by-byte) */
    __private ulong st[25];
    st[0]=s3[0]; st[1]=s3[1]; st[2]=s3[2]; st[3]=s3[3];
    st[4]=0; st[5]=0; st[6]=0; st[7]=0; st[8]=0; st[9]=0;
    st[10]=0; st[11]=0; st[12]=0; st[13]=0; st[14]=0; st[15]=0;
    st[16]=0; st[17]=0; st[18]=0; st[19]=0; st[20]=0; st[21]=0;
    st[22]=0; st[23]=0; st[24]=0;
    st[4] ^= 0x01UL;
    st[16] ^= (0x80UL << 56);
    keccak_f1600(st);

    ulong hash_u64[4];
    hash_u64[0] = st[0]; hash_u64[1] = st[1]; hash_u64[2] = st[2]; hash_u64[3] = st[3];

    /* On-device target check — matches CUDA kernel.
     * Big-endian u32 of first 4 hash bytes (lexicographic comparison).
     * If match: atomic_xchg to claim winner slot, write nonce + hash. */
    if (target_u32 != 0) {
        uint hash_low = (uint)(hash_u64[0] & 0xFFFFFFFFUL);
        uint hash_be = ((hash_low & 0xFFu) << 24) |
                       ((hash_low & 0xFF00u) << 8) |
                       ((hash_low >> 8) & 0xFF00u) |
                       ((hash_low >> 24) & 0xFFu);
        if (hash_be <= target_u32) {
            uint old = atomic_xchg(result_flag, 1u);
            if (old == 0u) {
                *result_nonce = nonce;
                __global ulong *rh = (__global ulong*)result_hash;
                rh[0] = hash_u64[0]; rh[1] = hash_u64[1];
                rh[2] = hash_u64[2]; rh[3] = hash_u64[3];
            }
        }
    } else {
        /* Benchmark mode (target_u32 == 0): write all hashes to output_hashes */
        __global ulong * restrict slot_u64 = (__global ulong*)(output_hashes + (ulong)tid * 32);
        slot_u64[0] = hash_u64[0]; slot_u64[1] = hash_u64[1];
        slot_u64[2] = hash_u64[2]; slot_u64[3] = hash_u64[3];
    }

    /* Stream-profit byproduct work REMOVED for hashrate parity with CUDA. */
    (void)stream_weights;
}
