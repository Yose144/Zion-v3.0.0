/*
 * Ekam Deeksha v3.2 — Metal GPU Compute Shader
 * Apple Silicon M1–M5 Native Pipeline
 *
 * Bit-identical to CPU `EkamDeeksha::hash_bytes` (v3.2).
 * Pipeline:
 *   1. Keccak256(header || nonce)
 *   2. Memory-hard scratchpad (512 KiB, 16384 blocks, 2 passes, 128 reads)
 *   3. AES-128 CTR mix (1 full round + 1 final round)
 *   4. Keccak256(s3) -> final hash
 *
 * Translated from OpenCL: deeksha_lite.cl
 */

#include <metal_stdlib>
#include <metal_atomic>
using namespace metal;

#define SCRATCHPAD_SIZE  524288   /* 512 KiB = 16384 * 32 */
#define BLOCK_SIZE       32
#define BLOCK_COUNT      16384
#define PASSES           2
#define RANDOM_READS     128

#define ROL64(x, n) (((x) << (n)) | ((x) >> (64 - (n))))

constant ulong KC_RC[24] = {
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

/* ========================================================================== */
/* Keccak-f1600                                                               */
/* ========================================================================== */

#define CHI_ROW(b) \
{ ulong _a=st[(b)],_b=st[(b)+1],_c=st[(b)+2],_d=st[(b)+3],_e=st[(b)+4]; \
  st[(b)]    = _a ^ ((~_b) & _c); \
  st[(b)+1]  = _b ^ ((~_c) & _d); \
  st[(b)+2]  = _c ^ ((~_d) & _e); \
  st[(b)+3]  = _d ^ ((~_e) & _a); \
  st[(b)+4]  = _e ^ ((~_a) & _b); }

inline void keccak_f1600(thread ulong *st)
{
    ulong bc0, bc1, bc2, bc3, bc4, t;
    for (int rnd = 0; rnd < 24; rnd++) {
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

        CHI_ROW(0) CHI_ROW(5) CHI_ROW(10) CHI_ROW(15) CHI_ROW(20)

        st[0] ^= KC_RC[rnd];
    }
}

/* ========================================================================== */
/* Keccak256                                                                  */
/* ========================================================================== */

inline void keccak256(thread const uchar *in, int inlen, thread uchar *out)
{
    thread ulong st[25]; int pos = 0;
    for (int i = 0; i < 25; i++) st[i] = 0;
    while (inlen > 0) {
        int chunk = 136 - pos;
        if (chunk > inlen) chunk = inlen;
        int off = pos;
        thread uchar *b = (thread uchar *)st;
        for (int i = 0; i < chunk; i++) b[off + i] ^= in[i];
        in    += chunk;
        inlen -= chunk;
        pos   += chunk;
        if (pos == 136) { keccak_f1600(st); pos = 0; }
    }
    thread uchar *b = (thread uchar *)st;
    b[pos]      ^= 0x01;
    b[135]      ^= 0x80;
    keccak_f1600(st);
    for (int i = 0; i < 32; i++) out[i] = b[i];
}

/* ========================================================================== */
/* SHA3-512 — u64-optimized for 65-byte input (scratchpad fill)               */
/* Input always fits in one keccak block (rate=72 > 65).                       */
/* ========================================================================== */

inline void sha3_512_65_u64(
    thread const ulong *state_in,
    uchar blk_byte,
    thread ulong *out_u64)
{
    thread ulong st[25];
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

/* Generic SHA3-512 (for non-scratchpad use) */
inline void sha3_512(thread const uchar *in, uint inlen, thread uchar *out)
{
    thread ulong st[25];
    for (int i = 0; i < 25; i++) st[i] = 0;
    uint pos = 0;
    for (uint i = 0; i < inlen; i++) {
        thread uchar *b = (thread uchar *)st;
        b[pos] ^= in[i];
        if (++pos == 72) { keccak_f1600(st); pos = 0; }
    }
    thread uchar *b = (thread uchar *)st;
    b[pos] ^= 0x06;
    b[71]  ^= 0x80;
    keccak_f1600(st);
    for (int i = 0; i < 64; i++) out[i] = b[i];
}

/* ========================================================================== */
/* AES-128 helpers                                                            */
/* ========================================================================== */

inline void aes_sub_bytes(thread uchar s[16])
{ for (int i = 0; i < 16; i++) s[i] = AES_SBOX[s[i]]; }

inline void aes_shift_rows(thread uchar s[16])
{
    uchar t;
    t = s[1];  s[1] = s[5];  s[5] = s[9];  s[9] = s[13]; s[13] = t;
    t = s[2];  s[2] = s[10]; s[10] = t;
    t = s[6];  s[6] = s[14]; s[14] = t;
    t = s[15]; s[15] = s[11]; s[11] = s[7];  s[7] = s[3];  s[3] = t;
}

inline uchar aes_xtime(uchar a) { return (uchar)((a << 1) ^ (((a >> 7) & 1) * 0x1b)); }

inline void aes_mix_columns(thread uchar s[16])
{
    for (int i = 0; i < 4; i++) {
        uchar a = s[i*4], b = s[i*4+1], c = s[i*4+2], d = s[i*4+3];
        uchar e = a ^ b ^ c ^ d;
        s[i*4]   ^= e ^ aes_xtime(a ^ b);
        s[i*4+1] ^= e ^ aes_xtime(b ^ c);
        s[i*4+2] ^= e ^ aes_xtime(c ^ d);
        s[i*4+3] ^= e ^ aes_xtime(d ^ a);
    }
}

inline void aes_add_round_key(thread uchar s[16], thread const uchar k[16])
{ for (int i = 0; i < 16; i++) s[i] ^= k[i]; }

inline void aes_round(thread uchar s[16], thread const uchar k[16])
{ aes_sub_bytes(s); aes_shift_rows(s); aes_mix_columns(s); aes_add_round_key(s, k); }

inline void aes_final_round(thread uchar s[16], thread const uchar k[16])
{ aes_sub_bytes(s); aes_shift_rows(s); aes_add_round_key(s, k); }

/* ========================================================================== */
/* Steps 2A/2B/2C: scratchpad                                                 */
/* ========================================================================== */

inline void fill_scratchpad(thread const ulong seed_u64[4], device uchar *pad)
{
    thread ulong state[8];
    state[0] = seed_u64[0]; state[1] = seed_u64[1];
    state[2] = seed_u64[2]; state[3] = seed_u64[3];
    state[4] = 0; state[5] = 0; state[6] = 0; state[7] = 0;

    for (uint blk = 0; blk < BLOCK_COUNT; blk++) {
        thread ulong out[8];
        sha3_512_65_u64(state, (uchar)(blk & 0xFF), out);

        uint off = blk * BLOCK_SIZE;
        device ulong *dst = (device ulong *)(pad + off);
        dst[0] = out[0]; dst[1] = out[1]; dst[2] = out[2]; dst[3] = out[3];

        /* Chain state: first 4 u64s from output, rest zero */
        state[0] = out[0]; state[1] = out[1];
        state[2] = out[2]; state[3] = out[3];
        state[4] = 0; state[5] = 0; state[6] = 0; state[7] = 0;
    }
}

inline void sequential_passes(device uchar *pad)
{
    for (uint i = 0; i < BLOCK_COUNT; i++) {
        uint prev = (i == 0) ? (BLOCK_COUNT - 1) : (i - 1);
        device ulong *cv = (device ulong *)(pad + i * BLOCK_SIZE);
        device ulong *pv = (device ulong *)(pad + prev * BLOCK_SIZE);
        for (int j = 0; j < 4; j++) cv[j] ^= pv[j];
    }
#if PASSES >= 2
    for (uint i = BLOCK_COUNT; i > 0; i--) {
        uint idx = i - 1;
        uint next = (idx + 1 == BLOCK_COUNT) ? 0 : (idx + 1);
        device ulong *cv = (device ulong *)(pad + idx * BLOCK_SIZE);
        device ulong *nv = (device ulong *)(pad + next * BLOCK_SIZE);
        for (int j = 0; j < 4; j++) cv[j] ^= nv[j];
    }
#endif
}

inline void random_read_mix(thread const ulong seed_u64[4], device const uchar *pad, thread ulong out_u64[4])
{
    thread ulong acc[4];
    acc[0] = seed_u64[0]; acc[1] = seed_u64[1];
    acc[2] = seed_u64[2]; acc[3] = seed_u64[3];
    ulong pos = 0;
    for (ulong r = 0; r < RANDOM_READS; r++) {
        uint off = (uint)(pos * BLOCK_SIZE);
        device const ulong *pv = (device const ulong *)(pad + off);
        acc[0] ^= pv[0]; acc[1] ^= pv[1]; acc[2] ^= pv[2]; acc[3] ^= pv[3];
        pos = (acc[0] ^ pos ^ r) % BLOCK_COUNT;
    }
    out_u64[0] = acc[0]; out_u64[1] = acc[1];
    out_u64[2] = acc[2]; out_u64[3] = acc[3];
}

/* ========================================================================== */
/* Step 3: AES-128 CTR mix                                                    */
/* ========================================================================== */

inline void aes128_mix(thread const uchar seed[32], ulong nonce, thread uchar *out)
{
    uchar key[16];
    for (int i = 0; i < 16; i++) key[i] = seed[i];
    uchar counter[16];
    for (int i = 0; i < 8; i++) counter[i]     = (uchar)(nonce >> (i * 8));
    for (int i = 0; i < 8; i++) counter[8 + i] = seed[16 + i];
    uchar block0[16], block1[16];
    for (int i = 0; i < 16; i++) { block0[i] = counter[i]; block1[i] = counter[i]; }
    uint carry = 1;
    for (int i = 0; i < 16; i++) {
        uint s = (uint)block1[i] + carry;
        block1[i] = (uchar)(s & 0xFF);
        carry = s >> 8;
        if (carry == 0) break;
    }
    /* Ekam v2: 1 full AES round + 1 final round (total 2 rounds) */
    for (int r = 0; r < 1; r++) { aes_round(block0, key); aes_round(block1, key); }
    aes_final_round(block0, key);
    aes_final_round(block1, key);
    for (int i = 0; i < 16; i++) { out[i] = block0[i] ^ seed[i]; out[16 + i] = block1[i] ^ seed[16 + i]; }
}

/* ========================================================================== */
/* Main kernel                                                                */
/* ========================================================================== */

kernel void deeksha_lite_mine(
    device const uchar *header              [[ buffer(0) ]],
    device const uint  *params              [[ buffer(1) ]],  // [header_len, nonce_count, target_u32]
    device const ulong *nonce_base_buf      [[ buffer(2) ]],
    device       uchar *scratchpad_pool     [[ buffer(3) ]],
    device atomic_uint *result_flag         [[ buffer(4) ]],  // [0]=flag, [1]=nonce_lo, [2]=nonce_hi
    device       uchar *result_hash         [[ buffer(5) ]],
    uint gid                                 [[ thread_position_in_grid ]]
)
{
    uint header_len  = params[0];
    uint nonce_count = params[1];
    uint target_u32  = params[2];
    if (gid >= nonce_count) return;

    ulong nonce = nonce_base_buf[0] + (ulong)gid;
    device uchar *pad = scratchpad_pool + (ulong)gid * SCRATCHPAD_SIZE;

    /* Step 1: Keccak256(header || nonce) — u64 throughout */
    thread ulong input_u[11];
    for (int i = 0; i < 11; i++) input_u[i] = 0;
    thread uchar *input = (thread uchar *)input_u;
    uint hlen = min(header_len, (uint)80);
    device const uint *hdr32 = (device const uint *)header;
    thread uint *inp32 = (thread uint *)input;
    uint hwords = hlen >> 2;
    for (uint i = 0; i < hwords; i++) inp32[i] = hdr32[i];
    for (uint i = (hwords << 2); i < hlen; i++) input[i] = header[i];
    input_u[10] = nonce;

    /* Keccak256 with padding 0x01 at byte 88, 0x80 at byte 135 */
    {
        thread ulong st[25];
        for (int i = 0; i < 11; i++) st[i] = input_u[i];
        for (int i = 11; i < 25; i++) st[i] = 0;
        st[11] ^= 0x01UL;
        st[16] ^= (0x80UL << 56);
        keccak_f1600(st);
        ulong s1_u64[4];
        s1_u64[0] = st[0]; s1_u64[1] = st[1]; s1_u64[2] = st[2]; s1_u64[3] = st[3];

        /* Step 2: Memory-hard scratchpad — u64 API */
        fill_scratchpad(s1_u64, pad);
        sequential_passes(pad);
        ulong s2_u64[4];
        random_read_mix(s1_u64, pad, s2_u64);

        /* Step 3: AES-128 CTR mix */
        thread uchar s2_bytes[32];
        thread uchar *s2p = (thread uchar *)s2_u64;
        for (int i = 0; i < 32; i++) s2_bytes[i] = s2p[i];
        uchar s3[32];
        aes128_mix(s2_bytes, nonce, s3);

        /* Step 4: Keccak256 final — u64 direct */
        thread ulong fst[25];
        for (int i = 0; i < 25; i++) fst[i] = 0;
        thread ulong *s3_u64 = (thread ulong *)s3;
        fst[0] = s3_u64[0]; fst[1] = s3_u64[1]; fst[2] = s3_u64[2]; fst[3] = s3_u64[3];
        fst[4] ^= 0x01UL;
        fst[16] ^= (0x80UL << 56);
        keccak_f1600(fst);

        ulong hash_u64[4];
        hash_u64[0] = fst[0]; hash_u64[1] = fst[1]; hash_u64[2] = fst[2]; hash_u64[3] = fst[3];

        /* Compare first 4 bytes vs target (big-endian, matching CPU lexicographic) */
        uint hash_low = (uint)(hash_u64[0] & 0xFFFFFFFFUL);
        uint state0_be = ((hash_low & 0xFFu) << 24) |
                         ((hash_low & 0xFF00u) << 8) |
                         ((hash_low >> 8) & 0xFF00u) |
                         ((hash_low >> 24) & 0xFFu);
        if (state0_be <= target_u32) {
            uint old = atomic_exchange_explicit(&result_flag[0], 0u, memory_order_relaxed);
            if (old == 0xFFFFFFFFu) {
                atomic_store_explicit(&result_flag[1], (uint)(nonce & 0xFFFFFFFFu), memory_order_relaxed);
                atomic_store_explicit(&result_flag[2], (uint)(nonce >> 32), memory_order_relaxed);
                device ulong *rh = (device ulong *)result_hash;
                rh[0] = hash_u64[0]; rh[1] = hash_u64[1];
                rh[2] = hash_u64[2]; rh[3] = hash_u64[3];
            }
        }
    }
}
