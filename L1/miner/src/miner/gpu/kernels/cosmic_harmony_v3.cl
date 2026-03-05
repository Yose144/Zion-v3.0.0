// Cosmic Harmony v3 - OpenCL Kernel  (PERF-OPT: unrolled + vectorized + scratchpad)
// Pipeline legacy  (height < 100k): Keccak-256(88B) -> SHA3-512 -> GoldenMatrix -> CosmicFusion
// Pipeline memory-hard (height >= 100k): ...GoldenMatrix -> MemoryHardScratchpad -> CosmicFusion
//
// Pool verification:  hash[0..4] as u32-LE  <=  target_u32
//
// Optimisations:
//   1. keccak_f1600 outer loop unrolled (#pragma unroll 4)
//   2. Rho+Pi inlined, Chi inlined per row macro
//   3. LOAD_U64_LE / STORE_U64_LE byte-packing macros
//   4. Scratchpad: 64 KiB/thread in global memory
//   5. Build flags: -cl-mad-enable -cl-fast-relaxed-math

#pragma OPENCL EXTENSION cl_khr_int64_base_atomics : enable
#pragma OPENCL EXTENSION cl_khr_int64_extended_atomics : enable

// ============================================================================
// Constants
// ============================================================================

__constant ulong KECCAK_RC[24] = {
    0x0000000000000001UL, 0x0000000000008082UL, 0x800000000000808AUL,
    0x8000000080008000UL, 0x000000000000808BUL, 0x0000000080000001UL,
    0x8000000080008081UL, 0x8000000000008009UL, 0x000000000000008AUL,
    0x0000000000000088UL, 0x0000000080008009UL, 0x000000008000000AUL,
    0x000000008000808BUL, 0x800000000000008BUL, 0x8000000000008089UL,
    0x8000000000008003UL, 0x8000000000008002UL, 0x8000000000000080UL,
    0x000000000000800AUL, 0x800000008000000AUL, 0x8000000080008081UL,
    0x8000000000008080UL, 0x0000000080000001UL, 0x8000000080008008UL,
};

__constant ulong PHI_POWERS_FP[16] = {
    4294967296UL,   6949403065UL,   11244370361UL,  18193773427UL,
    29438143788UL,  47631917215UL,  77070061004UL,  124701978219UL,
    201772039223UL, 326474017443UL, 528246056666UL, 854720074109UL,
    1382966130776UL,2237686204885UL,3620652335660UL,5858338540545UL,
};

// ============================================================================
// Helpers
// ============================================================================

#define ROTL64(x, n)  (((x) << (n)) | ((x) >> (64 - (n))))

#define LOAD_U64_LE(arr, off) \
    ( ((ulong)(arr)[(off)+0])        \
    | ((ulong)(arr)[(off)+1] <<  8)  \
    | ((ulong)(arr)[(off)+2] << 16)  \
    | ((ulong)(arr)[(off)+3] << 24)  \
    | ((ulong)(arr)[(off)+4] << 32)  \
    | ((ulong)(arr)[(off)+5] << 40)  \
    | ((ulong)(arr)[(off)+6] << 48)  \
    | ((ulong)(arr)[(off)+7] << 56)  )

#define STORE_U64_LE(arr, off, w) do { \
    (arr)[(off)+0] = (uchar)((w));        \
    (arr)[(off)+1] = (uchar)((w) >>  8);  \
    (arr)[(off)+2] = (uchar)((w) >> 16);  \
    (arr)[(off)+3] = (uchar)((w) >> 24);  \
    (arr)[(off)+4] = (uchar)((w) >> 32);  \
    (arr)[(off)+5] = (uchar)((w) >> 40);  \
    (arr)[(off)+6] = (uchar)((w) >> 48);  \
    (arr)[(off)+7] = (uchar)((w) >> 56);  \
} while (0)

// Chi macro for one 5-element row
#define CHI_ROW(b) \
{ ulong _a=st[(b)],_b=st[(b)+1],_c=st[(b)+2],_d=st[(b)+3],_e=st[(b)+4]; \
  st[(b)]    = _a ^ ((~_b) & _c); \
  st[(b)+1]  = _b ^ ((~_c) & _d); \
  st[(b)+2]  = _c ^ ((~_d) & _e); \
  st[(b)+3]  = _d ^ ((~_e) & _a); \
  st[(b)+4]  = _e ^ ((~_a) & _b); }

// ============================================================================
// Keccak-f[1600]  -- #pragma unroll + inlined Rho+Pi + CHI_ROW macros
// ============================================================================

void keccak_f1600(ulong *st) {
    ulong bc0, bc1, bc2, bc3, bc4, t;

    #pragma unroll 4
    for (int rnd = 0; rnd < 24; rnd++) {
        // Theta
        bc0 = st[0]^st[5]^st[10]^st[15]^st[20];
        bc1 = st[1]^st[6]^st[11]^st[16]^st[21];
        bc2 = st[2]^st[7]^st[12]^st[17]^st[22];
        bc3 = st[3]^st[8]^st[13]^st[18]^st[23];
        bc4 = st[4]^st[9]^st[14]^st[19]^st[24];
        t=bc4^ROTL64(bc1,1); st[0]^=t;st[5]^=t;st[10]^=t;st[15]^=t;st[20]^=t;
        t=bc0^ROTL64(bc2,1); st[1]^=t;st[6]^=t;st[11]^=t;st[16]^=t;st[21]^=t;
        t=bc1^ROTL64(bc3,1); st[2]^=t;st[7]^=t;st[12]^=t;st[17]^=t;st[22]^=t;
        t=bc2^ROTL64(bc4,1); st[3]^=t;st[8]^=t;st[13]^=t;st[18]^=t;st[23]^=t;
        t=bc3^ROTL64(bc0,1); st[4]^=t;st[9]^=t;st[14]^=t;st[19]^=t;st[24]^=t;

        // Rho+Pi fully inlined (no lookup table, no loop)
        t=st[1];
        bc0=st[10];st[10]=ROTL64(t, 1);t=bc0;
        bc0=st[ 7];st[ 7]=ROTL64(t, 3);t=bc0;
        bc0=st[11];st[11]=ROTL64(t, 6);t=bc0;
        bc0=st[17];st[17]=ROTL64(t,10);t=bc0;
        bc0=st[18];st[18]=ROTL64(t,15);t=bc0;
        bc0=st[ 3];st[ 3]=ROTL64(t,21);t=bc0;
        bc0=st[ 5];st[ 5]=ROTL64(t,28);t=bc0;
        bc0=st[16];st[16]=ROTL64(t,36);t=bc0;
        bc0=st[ 8];st[ 8]=ROTL64(t,45);t=bc0;
        bc0=st[21];st[21]=ROTL64(t,55);t=bc0;
        bc0=st[24];st[24]=ROTL64(t, 2);t=bc0;
        bc0=st[ 4];st[ 4]=ROTL64(t,14);t=bc0;
        bc0=st[15];st[15]=ROTL64(t,27);t=bc0;
        bc0=st[23];st[23]=ROTL64(t,41);t=bc0;
        bc0=st[19];st[19]=ROTL64(t,56);t=bc0;
        bc0=st[13];st[13]=ROTL64(t, 8);t=bc0;
        bc0=st[12];st[12]=ROTL64(t,25);t=bc0;
        bc0=st[ 2];st[ 2]=ROTL64(t,43);t=bc0;
        bc0=st[20];st[20]=ROTL64(t,62);t=bc0;
        bc0=st[14];st[14]=ROTL64(t,18);t=bc0;
        bc0=st[22];st[22]=ROTL64(t,39);t=bc0;
        bc0=st[ 9];st[ 9]=ROTL64(t,61);t=bc0;
        bc0=st[ 6];st[ 6]=ROTL64(t,20);t=bc0;
                   st[ 1]=ROTL64(t,44);

        // Chi
        CHI_ROW(0) CHI_ROW(5) CHI_ROW(10) CHI_ROW(15) CHI_ROW(20)

        // Iota
        st[0] ^= KECCAK_RC[rnd];
    }
}

// ============================================================================
// Keccak-256  (padding 0x01, rate=136B=17 words)
// ============================================================================

void keccak256_bytes(const uchar *input, int input_len, uchar *output) {
    ulong st[25];
    #pragma unroll 25
    for (int i = 0; i < 25; i++) st[i] = 0;

    int full_words = input_len >> 3;
    #pragma unroll 11
    for (int i = 0; i < 11; i++)
        if (i < full_words) st[i] ^= LOAD_U64_LE(input, i*8);

    // Padding byte 0x01 + terminal 0x80 in rate block
    {
        int rem = input_len & 7;
        int pw  = full_words;
        ulong pad = 0;
        #pragma unroll 7
        for (int b = 0; b < 7; b++)
            if (b < rem) pad |= ((ulong)input[pw*8+b]) << (b*8);
        pad |= ((ulong)0x01) << (rem*8);
        st[pw] ^= pad;
    }
    st[16] ^= 0x8000000000000000UL;

    keccak_f1600(st);

    STORE_U64_LE(output,  0, st[0]);
    STORE_U64_LE(output,  8, st[1]);
    STORE_U64_LE(output, 16, st[2]);
    STORE_U64_LE(output, 24, st[3]);
}

// ============================================================================
// SHA3-512  (padding 0x06, rate=72B=9 words, fixed 32-byte input)
// ============================================================================

void sha3_512_words(const uchar *input, ulong *out_words) {
    ulong st[25];
    #pragma unroll 25
    for (int i = 0; i < 25; i++) st[i] = 0;
    st[0] ^= LOAD_U64_LE(input,  0);
    st[1] ^= LOAD_U64_LE(input,  8);
    st[2] ^= LOAD_U64_LE(input, 16);
    st[3] ^= LOAD_U64_LE(input, 24);
    st[4] ^= 0x06UL;
    st[8] ^= 0x8000000000000000UL;
    keccak_f1600(st);
    #pragma unroll 8
    for (int i = 0; i < 8; i++) out_words[i] = st[i];
}

void sha3_512_trunc32(const uchar *input, uchar *output) {
    ulong st[25];
    #pragma unroll 25
    for (int i = 0; i < 25; i++) st[i] = 0;
    st[0] ^= LOAD_U64_LE(input,  0);
    st[1] ^= LOAD_U64_LE(input,  8);
    st[2] ^= LOAD_U64_LE(input, 16);
    st[3] ^= LOAD_U64_LE(input, 24);
    st[4] ^= 0x06UL;
    st[8] ^= 0x8000000000000000UL;
    keccak_f1600(st);
    STORE_U64_LE(output,  0, st[0]);
    STORE_U64_LE(output,  8, st[1]);
    STORE_U64_LE(output, 16, st[2]);
    STORE_U64_LE(output, 24, st[3]);
}

// ============================================================================
// Golden Matrix
// ============================================================================

void golden_matrix(const ulong *sha3_words, ulong *result) {
    #pragma unroll 8
    for (int i = 0; i < 8; i++) {
        ulong sum = 0;
        ulong row = sha3_words[i];
        #pragma unroll 8
        for (int j = 0; j < 8; j++)
            sum += ((row >> (j*8)) & 0xFFUL) * PHI_POWERS_FP[i+j];
        result[i] = sum >> 32;
    }
}

// ============================================================================
// AES-128 software implementation — matches Rust aes::Aes128 + C native lib
// ============================================================================

__constant uchar CL_AES_SBOX[256] = {
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
    0x8c,0xa1,0x89,0x0d,0xbf,0xe6,0x42,0x68,0x41,0x99,0x2d,0x0f,0xb0,0x54,0xbb,0x16
};
__constant uchar CL_AES_RCON[11] = {0x00,0x01,0x02,0x04,0x08,0x10,0x20,0x40,0x80,0x1b,0x36};

uchar cl_aes_mul(uchar a, uchar b) {
    uchar p = 0;
    for (int i = 0; i < 8; i++) {
        if (b & 1) p ^= a;
        uchar hi = (a >> 7) & 1;
        a = (uchar)((a << 1) ^ (hi ? 0x1b : 0x00));
        b >>= 1;
    }
    return p;
}
void cl_aes128_key_expand(const uchar key[16], uchar rk[176]) {
    for (int i = 0; i < 16; i++) rk[i] = key[i];
    for (int i = 4; i < 44; i++) {
        uchar tmp[4];
        for (int j = 0; j < 4; j++) tmp[j] = rk[(i-1)*4+j];
        if (i % 4 == 0) {
            uchar t = tmp[0]; tmp[0]=tmp[1]; tmp[1]=tmp[2]; tmp[2]=tmp[3]; tmp[3]=t;
            for (int j = 0; j < 4; j++) tmp[j] = CL_AES_SBOX[tmp[j]];
            tmp[0] ^= CL_AES_RCON[i/4];
        }
        for (int j = 0; j < 4; j++) rk[i*4+j] = rk[(i-4)*4+j] ^ tmp[j];
    }
}
void cl_aes128_encrypt_block(const uchar rk[176], uchar blk[16]) {
    uchar s[16], t[16];
    for (int i = 0; i < 16; i++) s[i] = blk[i] ^ rk[i];
    for (int round = 1; round <= 10; round++) {
        for (int i = 0; i < 16; i++) s[i] = CL_AES_SBOX[s[i]];
        t[0]=s[0];t[1]=s[5];t[2]=s[10];t[3]=s[15];
        t[4]=s[4];t[5]=s[9];t[6]=s[14];t[7]=s[3];
        t[8]=s[8];t[9]=s[13];t[10]=s[2];t[11]=s[7];
        t[12]=s[12];t[13]=s[1];t[14]=s[6];t[15]=s[11];
        if (round < 10) {
            for (int col = 0; col < 4; col++) {
                uchar *c = t + col*4;
                uchar a0=c[0],a1=c[1],a2=c[2],a3=c[3];
                c[0]=cl_aes_mul(a0,2)^cl_aes_mul(a1,3)^a2^a3;
                c[1]=a0^cl_aes_mul(a1,2)^cl_aes_mul(a2,3)^a3;
                c[2]=a0^a1^cl_aes_mul(a2,2)^cl_aes_mul(a3,3);
                c[3]=cl_aes_mul(a0,3)^a1^a2^cl_aes_mul(a3,2);
            }
        }
        for (int i = 0; i < 16; i++) s[i] = t[i] ^ rk[round*16+i];
    }
    for (int i = 0; i < 16; i++) blk[i] = s[i];
}
void cl_fusion_round(uchar state[64], uchar round_num) {
    uchar kin[33];
    for (int i = 0; i < 32; i++) kin[i] = state[i];
    kin[32] = round_num;
    uchar intermediate[32];
    keccak256_bytes(kin, 33, intermediate);
    uchar rk[176];
    cl_aes128_key_expand(intermediate, rk);
    uchar block0[16];
    for (int i = 0; i < 16; i++) block0[i] = state[32+i];
    cl_aes128_encrypt_block(rk, block0);
    uchar key2[16];
    for (int i = 0; i < 16; i++) key2[i] = intermediate[i];
    key2[0] ^= round_num; key2[15] ^= (uchar)0xAB;
    uchar rk2[176];
    cl_aes128_key_expand(key2, rk2);
    uchar block1[16];
    for (int i = 0; i < 16; i++) block1[i] = state[48+i];
    cl_aes128_encrypt_block(rk2, block1);
    for (int i = 0; i < 32; i++) state[32+i] ^= intermediate[i];
    for (int i = 0; i < 16; i++) state[i]    = intermediate[i]    ^ block0[i];
    for (int i = 0; i < 16; i++) state[16+i] = intermediate[16+i] ^ block1[i];
}

// ============================================================================
// Cosmic Fusion — AES-128 (matches Rust fusion_round + C native lib)
// ============================================================================

void cosmic_fusion(const ulong *gm_words, uchar *output) {
    uchar state[64];
    for (int i = 0; i < 8; i++) STORE_U64_LE(state, i*8, gm_words[i]);
    for (int r = 0; r < 4; r++) cl_fusion_round(state, (uchar)r);
    sha3_512_trunc32(state, output);
}

// ============================================================================
// SHA3-512 helpers for memory-hard scratchpad
// ============================================================================

// SHA3-512(state[64] ++ counter_le[8]) — exactly 1 rate block (72 bytes).
// Used in init_scratchpad: output → pad chunk + new state.
void sha3_512_state_counter(const uchar state[64], ulong counter, uchar out64[64]) {
    ulong st[25];
    #pragma unroll 25
    for (int i = 0; i < 25; i++) st[i] = 0;
    // Absorb 64B state (8 words) + 8B counter (1 word) = 72B = 1 full rate block
    #pragma unroll 8
    for (int i = 0; i < 8; i++) st[i] = LOAD_U64_LE(state, i*8);
    st[8] = counter;  // counter.to_le_bytes() absorbed as LE word
    keccak_f1600(st);
    // Full rate block → padding starts new block: 0x06 at byte 0, 0x80 at byte 71
    st[0] ^= 0x06UL;
    st[8] ^= 0x8000000000000000UL;
    keccak_f1600(st);
    // Squeeze 64 bytes (8 words)
    #pragma unroll 8
    for (int i = 0; i < 8; i++) STORE_U64_LE(out64, i*8, st[i]);
}

// Keccak-256(acc[64] ++ chunk[64] ++ r_val[8]) — exactly 1 rate block (136 bytes).
// Domain = 0x01 (Keccak, not SHA3). Used in random_read_mix per-round.
void keccak256_136_mix(const uchar acc[64], const uchar chunk[64], ulong r_val, uchar out32[32]) {
    ulong st[25];
    #pragma unroll 25
    for (int i = 0; i < 25; i++) st[i] = 0;
    // 17 words × 8 = 136 bytes = 1 full Keccak-256 rate block
    #pragma unroll 8
    for (int i = 0; i < 8; i++) st[i]    ^= LOAD_U64_LE(acc,   i*8);
    #pragma unroll 8
    for (int i = 0; i < 8; i++) st[8+i]  ^= LOAD_U64_LE(chunk, i*8);
    st[16] ^= r_val;
    keccak_f1600(st);
    // Padding: 0 remaining bytes → 0x01 at word[0] bit 0, 0x80 at word[16] bit 63
    st[0]  ^= 0x01UL;
    st[16] ^= 0x8000000000000000UL;
    keccak_f1600(st);
    // Squeeze 32 bytes
    STORE_U64_LE(out32,  0, st[0]);
    STORE_U64_LE(out32,  8, st[1]);
    STORE_U64_LE(out32, 16, st[2]);
    STORE_U64_LE(out32, 24, st[3]);
}

// SHA3-512(acc[64] ++ pad_first[64] ++ pad_last[64]) = 192 bytes = 2 full + 48 partial.
// Used as the final step of random_read_mix.
void sha3_512_random_final(
    const uchar acc[64],
    __global const uchar* pad_first,   // pad[0..63]
    __global const uchar* pad_last,    // pad[SCRATCHPAD_SIZE-64..]
    uchar out64[64])
{
    ulong st[25];
    #pragma unroll 25
    for (int i = 0; i < 25; i++) st[i] = 0;

    // Block 1 (bytes 0..71): acc[0..63](8w) + pad_first[0..7](1w) = 72 bytes
    #pragma unroll 8
    for (int i = 0; i < 8; i++) st[i] ^= LOAD_U64_LE(acc, i*8);
    st[8] ^= LOAD_U64_LE(pad_first, 0);
    keccak_f1600(st);

    // Block 2 (bytes 72..143): pad_first[8..63](7w) + pad_last[0..15](2w) = 72 bytes
    #pragma unroll 7
    for (int i = 1; i < 8; i++) st[i-1] ^= LOAD_U64_LE(pad_first, i*8);
    st[7] ^= LOAD_U64_LE(pad_last, 0);
    st[8] ^= LOAD_U64_LE(pad_last, 8);
    keccak_f1600(st);

    // Partial (bytes 144..191): pad_last[16..63](6w) = 48 bytes → padding at byte 48
    #pragma unroll 6
    for (int i = 2; i < 8; i++) st[i-2] ^= LOAD_U64_LE(pad_last, i*8);
    // SHA3 padding: 0x06 at byte 48 (word 6 byte 0), 0x80 at byte 71 (word 8 byte 7)
    st[6] ^= 0x06UL;
    st[8] ^= 0x8000000000000000UL;
    keccak_f1600(st);

    // Squeeze 64 bytes
    #pragma unroll 8
    for (int i = 0; i < 8; i++) STORE_U64_LE(out64, i*8, st[i]);
}

// ============================================================================
// Memory-hard scratchpad  (64 KiB per thread, in global memory)
// Mirrors Rust: cosmic-harmony/src/scratchpad.rs  memory_hard_transform()
// ============================================================================

#define CL_SCRATCHPAD_BYTES (64u * 1024u)   // 65536 bytes — zlatý střed
#define CL_BLOCK_SIZE       64u
#define CL_BLOCK_COUNT      1024u           // SCRATCHPAD_BYTES / BLOCK_SIZE
#define CL_PASSES           2u             // Ka — dopředné průchody
#define CL_RANDOM_READS     64u

/* CHv4.2 Merkabah Dual-Spin constants (active when CHV4_2_FORK_HEIGHT reached) */
#define CL_BACKWARD_PASSES  2u             /* Ra — zpětné průchody */
#define CL_KABALA_READS     22u            /* 22 pólů vědomí */
#define CL_KEY_ROUNDS       22u            /* 22-kolo Brahma-jyoti finalizace */

/* Hiranyagarbha Initialization Constants — odvozeny z zlatého řezu φ */
constant ulong CL_HIC[22] = {
    0x9E3779B97F4A7C15UL, 0x6C62272E07BB0142UL, 0x94D049BB133111EBUL,
    0xBF58476D1CE4E5B9UL, 0x94D049BB133111EBUL, 0x6C62272E07BB0142UL,
    0x9E3779B97F4A7C15UL, 0x517CC1B727220A95UL, 0xBB67AE8584CAA73BUL,
    0x3C6EF372FE94F82BUL, 0xA54FF53A5F1D36F1UL, 0x510E527FADE682D1UL,
    0x9B05688C2B3E6C1FUL, 0x1F83D9ABFB41BD6BUL, 0x5BE0CD19137E2179UL,
    0xCBBB9D5DC1059ED8UL, 0x629A292A367CD507UL, 0x9159015A3070DD17UL,
    0x152FECD8F70E5939UL, 0x67332667FFC00B31UL, 0x8EB44A8768581511UL,
    0xDB0C2E0D64F98FA7UL,
};

// Step 1: deterministic SHA3-512 chain initialises all 1024 × 64B blocks.
void cl_init_scratchpad(__global uchar* pad, const uchar seed[64]) {
    uchar state[64];
    #pragma unroll 64
    for (int i = 0; i < 64; i++) state[i] = seed[i];

    for (uint ci = 0; ci < CL_BLOCK_COUNT; ci++) {
        uchar block[64];
        sha3_512_state_counter(state, (ulong)ci, block);
        uint off = ci * CL_BLOCK_SIZE;
        #pragma unroll 64
        for (int j = 0; j < 64; j++) {
            pad[off + j] = block[j];
            state[j]     = block[j];
        }
    }
}

// mix_block: SHA3-512(current||prev||rand||pass||index) XOR'd into current block.
// Input layout (208 bytes):
//   current[0..63]  prev[0..63]  rand[0..63]  pass[8]  index[8]
// SHA3-512 rate=72: 2 full blocks + 64 partial → 3 keccak calls.
void cl_mix_block(
    __global uchar* pad,
    ulong cur_off, ulong prev_off, ulong rand_off,
    ulong pass_val, ulong index_val)
{
    ulong st[25];
    #pragma unroll 25
    for (int i = 0; i < 25; i++) st[i] = 0;

    // Block 1 (bytes 0..71): current[0..63](8w) + prev[0..7](1w)
    #pragma unroll 8
    for (int i = 0; i < 8; i++) st[i] ^= LOAD_U64_LE(pad, cur_off + (ulong)(i*8));
    st[8] ^= LOAD_U64_LE(pad, prev_off);
    keccak_f1600(st);

    // Block 2 (bytes 72..143): prev[8..63](7w) + rand[0..15](2w)
    #pragma unroll 7
    for (int i = 1; i < 8; i++) st[i-1] ^= LOAD_U64_LE(pad, prev_off + (ulong)(i*8));
    st[7] ^= LOAD_U64_LE(pad, rand_off);
    st[8] ^= LOAD_U64_LE(pad, rand_off + 8UL);
    keccak_f1600(st);

    // Partial (bytes 144..207): rand[16..63](6w) + pass(8) + index(8) = 64 bytes
    #pragma unroll 6
    for (int i = 2; i < 8; i++) st[i-2] ^= LOAD_U64_LE(pad, rand_off + (ulong)(i*8));
    st[6] ^= pass_val;
    st[7] ^= index_val;
    // Padding at byte 64 of this partial block: word 8 low=0x06 + high=0x80
    st[8] ^= 0x8000000000000006UL;
    keccak_f1600(st);

    // XOR first 64 bytes (8 words) of hash result into current block
    #pragma unroll 8
    for (int j = 0; j < 8; j++) {
        ulong existing = LOAD_U64_LE(pad, cur_off + (ulong)(j*8));
        ulong result   = existing ^ st[j];
        #pragma unroll 8
        for (int b = 0; b < 8; b++)
            pad[cur_off + (ulong)(j*8 + b)] = (uchar)(result >> (b*8));
    }
}

// 2 sequential passes over the 1024-block scratchpad.
// Even passes: forward; odd passes: backward.
void cl_sequential_passes(__global uchar* pad) {
    for (uint pass = 0; pass < CL_PASSES; pass++) {
        if ((pass & 1u) == 0u) {
            // Forward
            for (ulong i = 0; i < (ulong)CL_BLOCK_COUNT; i++) {
                ulong cur_off  = i * CL_BLOCK_SIZE;
                ulong prev_off = (i == 0 ? (ulong)(CL_BLOCK_COUNT - 1) : (i - 1)) * CL_BLOCK_SIZE;
                ulong idx_val  = LOAD_U64_LE(pad, cur_off);
                ulong rand_idx = (idx_val ^ (ulong)pass ^ i) % (ulong)CL_BLOCK_COUNT;
                cl_mix_block(pad, cur_off, prev_off, rand_idx * CL_BLOCK_SIZE,
                             (ulong)pass, i);
            }
        } else {
            // Backward
            for (long ic = (long)(CL_BLOCK_COUNT - 1); ic >= 0; ic--) {
                ulong i        = (ulong)ic;
                ulong cur_off  = i * CL_BLOCK_SIZE;
                ulong next_i   = (i + 1 == (ulong)CL_BLOCK_COUNT) ? 0UL : (i + 1);
                ulong prev_off = next_i * CL_BLOCK_SIZE;
                ulong idx_val  = LOAD_U64_LE(pad, cur_off);
                ulong rand_idx = (idx_val ^ (ulong)pass ^ i) % (ulong)CL_BLOCK_COUNT;
                cl_mix_block(pad, cur_off, prev_off, rand_idx * CL_BLOCK_SIZE,
                             (ulong)pass, i);
            }
        }
    }
}

// 256 pseudo-random reads with Keccak-256, then final SHA3-512.
void cl_random_read_mix(const uchar seed[64], __global const uchar* pad, uchar out64[64]) {
    uchar acc[64];
    #pragma unroll 64
    for (int i = 0; i < 64; i++) acc[i] = seed[i];

    ulong pos = (LOAD_U64_LE(seed, 0)) % (ulong)CL_BLOCK_COUNT;

    for (uint r = 0; r < CL_RANDOM_READS; r++) {
        ulong chunk_off = pos * CL_BLOCK_SIZE;
        // Copy 64-byte chunk from global to private
        uchar chunk[64];
        #pragma unroll 64
        for (int j = 0; j < 64; j++) chunk[j] = pad[chunk_off + j];

        uchar d[32];
        keccak256_136_mix(acc, chunk, (ulong)r, d);

        #pragma unroll 32
        for (int i = 0; i < 32; i++) acc[i]    ^= d[i];
        #pragma unroll 32
        for (int i = 0; i < 32; i++) acc[32+i] += d[i];  // wrapping uchar add

        ulong next_word = LOAD_U64_LE(d, 0);
        pos = (next_word ^ pos ^ (ulong)r) % (ulong)CL_BLOCK_COUNT;
    }

    // Final SHA3-512(acc || pad[0..63] || pad[SCRATCHPAD-64..])
    sha3_512_random_final(acc, pad, pad + (CL_SCRATCHPAD_BYTES - CL_BLOCK_SIZE), out64);
}

// Public entry: memory_hard_transform(golden_matrix_64B → 64B output for CosmicFusion)
void cl_memory_hard_transform(const ulong gm_words[8], __global uchar* pad, ulong out_words[8]) {
    // Convert golden-matrix 64B words to byte seed
    uchar seed[64];
    #pragma unroll 8
    for (int i = 0; i < 8; i++) STORE_U64_LE(seed, i*8, gm_words[i]);

    cl_init_scratchpad(pad, seed);
    cl_sequential_passes(pad);

    uchar result[64];
    cl_random_read_mix(seed, pad, result);

    #pragma unroll 8
    for (int i = 0; i < 8; i++) out_words[i] = LOAD_U64_LE(result, i*8);
}

// ============================================================================
// CHv4 NPU Mixing Step — INT8 MLP 64→28→64 + residual
// Mirrors Rust: L1/cosmic-harmony/src/algorithms_npu.rs :: npu_mixing_cpu_int8()
// Active always from genesis (CHV4_NPU_FORK_HEIGHT = 0)
// Input/output: ulong[8] (LE word representation of 64-byte state)
// ============================================================================

int gelu_int8_npu(int x) {
    int v = (x * (128 + x)) >> 8;
    v = max(v, -128);
    v = min(v,  127);
    return v;
}

void layer_norm_int8_npu(int *data, int n, __global const short* scale) {
    long sum = 0;
    for (int i = 0; i < n; i++) sum += (long)data[i];
    int mean = (int)(sum / (long)n);
    long var_sum = 0;
    for (int i = 0; i < n; i++) {
        long d = (long)(data[i] - mean);
        var_sum += d * d;
    }
    int std_approx = (int)sqrt((float)(var_sum / (long)n)) + 1;
    for (int i = 0; i < n; i++) {
        int normalized = ((data[i] - mean) * 128) / std_approx;
        data[i] = (normalized * (int)scale[i]) >> 8;
        data[i] = max(data[i], -128);
        data[i] = min(data[i],  127);
    }
}

// CHv4 NPU Mixing: takes ulong[8] from MemoryHard, returns ulong[8] for CosmicFusion.
void npu_mixing_words(
    const ulong inp_words[8],
    ulong out_words[8],
    __global const char*  w1,
    __global const char*  b1,
    __global const char*  w2,
    __global const char*  b2,
    __global const short* scale1,
    __global const short* scale2
) {
    int input_i32[64];
    for (int i = 0; i < 8; i++) {
        for (int b = 0; b < 8; b++) {
            input_i32[i*8+b] = (int)(char)((uchar)(inp_words[i] >> (b*8)));
        }
    }

    // ── Layer 1: Linear(64→128) ──────────────────────────────────
    int hidden[128];
    for (int i = 0; i < 128; i++) {
        int acc = (int)b1[i] * 32;
        for (int j = 0; j < 64; j++)
            acc += input_i32[j] * (int)w1[i * 64 + j];
        hidden[i] = acc >> 12;
        hidden[i] = max(hidden[i], -128);
        hidden[i] = min(hidden[i],  127);
    }
    layer_norm_int8_npu(hidden, 128, scale1);
    for (int i = 0; i < 128; i++) hidden[i] = gelu_int8_npu(hidden[i]);

    // ── Layer 2: Linear(128→64) ─────────────────────────────────
    int output_i32[64];
    for (int i = 0; i < 64; i++) {
        int acc = (int)b2[i] * 32;
        for (int j = 0; j < 128; j++)
            acc += hidden[j] * (int)w2[i * 128 + j];
        output_i32[i] = acc >> 12;
        output_i32[i] = max(output_i32[i], -128);
        output_i32[i] = min(output_i32[i],  127);
    }
    layer_norm_int8_npu(output_i32, 64, scale2);

    // ── Residual add + uchar[64] → ulong[8] ────────────────────
    for (int i = 0; i < 8; i++) {
        out_words[i] = 0;
        for (int b = 0; b < 8; b++) {
            int v = output_i32[i*8+b] + input_i32[i*8+b];
            v = max(v, -128);
            v = min(v,  127);
            out_words[i] |= ((ulong)((uchar)(v))) << (b * 8);
        }
    }
}

// ============================================================================
// CHv4.2 Merkabah Dual-Spin — helper funkce
// ============================================================================

// Phase 3: Merkabah backward passes — 2× reverzní průchod bloky se spinem.
// Ka (sestup) a Ra (vzestup) — bidirektionální tórické pole.
void cl_merkabah_backward_passes(__global uchar* pad) {
    for (uint p = 0u; p < CL_BACKWARD_PASSES; p++) {
        for (int blk = (int)(CL_BLOCK_COUNT) - 1; blk >= 0; blk--) {
            ulong hic_val = CL_HIC[(uint)blk % 22u];
            uint  cur_off  = (uint)blk * CL_BLOCK_SIZE;
            uint  next_off = ((uint)blk + 1u) % CL_BLOCK_COUNT * CL_BLOCK_SIZE;
            #pragma unroll 8
            for (uint j = 0u; j < 8u; j++) {
                ulong cur  = LOAD_U64_LE(pad, (ulong)(cur_off  + j*8u));
                ulong nxt  = LOAD_U64_LE(pad, (ulong)(next_off + j*8u));
                // XOR + merkabah spin (levá rotace o 17)
                ulong val  = (cur ^ nxt ^ hic_val);
                val = (val << 17u) | (val >> 47u);
                STORE_U64_LE(pad, (ulong)(cur_off + j*8u), val);
            }
        }
    }
}

// Phase 5: Kabala phase — 22 reads s HIC[k] XOR state % blocks.
void cl_kabala_phase(__global const uchar* pad, ulong state[8]) {
    for (uint k = 0u; k < CL_KABALA_READS; k++) {
        ulong hic = CL_HIC[k];
        uint  bid = (uint)((state[k % 8u] ^ hic) % (ulong)CL_BLOCK_COUNT);
        uint  off = bid * CL_BLOCK_SIZE;
        #pragma unroll 8
        for (uint j = 0u; j < 8u; j++)
            state[j % 8u] ^= LOAD_U64_LE(pad, (ulong)(off + j*8u));
    }
}

// Phase 6: Brahma-jyoti finalize — Keccak-256 per round + HIC[r].
// KEY_ROUNDS=22 iterací, výstup = 32 bajtů finálního hashe.
void cl_brahma_jyoti_finalize(const ulong state_in[8], uchar out32[32]) {
    uchar data[72]; // 8 × u64 + 8 (HIC) = 72B → vejde se do jednoho keccak bloku
    uchar tmp[32];

    // Serialize state
    #pragma unroll 8
    for (uint i = 0u; i < 8u; i++) {
        ulong v = state_in[i];
        #pragma unroll 8
        for (uint b = 0u; b < 8u; b++)
            data[i*8u+b] = (uchar)(v >> (b*8u));
    }

    // KEY_ROUNDS = 22
    for (uint r = 0u; r < CL_KEY_ROUNDS; r++) {
        // Append HIC[r] (little-endian 8 bytes) → 72-byte input
        ulong hic = CL_HIC[r];
        #pragma unroll 8
        for (uint b = 0u; b < 8u; b++)
            data[64u+b] = (uchar)(hic >> (b*8u));
        keccak256_bytes(data, 72u, tmp);
        // tmp → next data[0..32], data[32..63] = 0
        #pragma unroll 32
        for (uint i = 0u; i < 32u; i++) data[i] = tmp[i];
        #pragma unroll 32
        for (uint i = 32u; i < 64u; i++) data[i] = 0;
    }

    #pragma unroll 32
    for (uint i = 0u; i < 32u; i++) out32[i] = tmp[i];
}

// ============================================================================
// Main Kernel
// ============================================================================

__kernel
void cosmic_harmony_v3_mine(
    __global const uchar* header,
    const uint  header_len,
    const ulong start_nonce,
    const uint  target_u32,
    __global ulong* results,
    __global uint*  result_count,
    __global uchar* result_hash,
    const uint  memory_hard,          // 0 = legacy (<100k)  1 = scratchpad (>=100k)
    __global uchar* scratchpad_buf,    // ignored when memory_hard=0
    const uint  chv4,                  // 1 = CHv4 NPU Mixing (od genesis, vždy 1)
    __global const char*  npu_w1,      // [128*64] int8
    __global const char*  npu_b1,      // [128]    int8
    __global const char*  npu_w2,      // [64*128] int8
    __global const char*  npu_b2,      // [64]     int8
    __global const short* npu_scale1,  // [128]    int16
    __global const short* npu_scale2,  // [64]     int16
    const uint  chv4_2                 // 1 = CHv4.2 Merkabah Dual-Spin
) {
    uint  tid   = get_global_id(0);
    ulong nonce = start_nonce + (ulong)tid;

    uchar input[88];
    uint  clen = min(header_len, 80u);

    #pragma unroll 16
    for (uint i = 0; i < 80; i++)
        input[i] = (i < clen) ? header[i] : 0;

    #pragma unroll 8
    for (int i = 0; i < 8; i++)
        input[80+i] = (uchar)(nonce >> (i*8));

    uchar step1[32];
    keccak256_bytes(input, 88, step1);

    ulong step2[8];
    sha3_512_words(step1, step2);

    ulong step3[8];
    golden_matrix(step2, step3);

    uchar final_hash[32];

    if (chv4_2 && memory_hard) {
        // CHv4.2 Merkabah Dual-Spin:
        //   GoldenMatrix → MemoryHard → NPU Mixing
        //   → Merkabah Backward (2×) → Kabala Phase (22 reads)
        //   → Brahma-jyoti Finalize (22× Keccak + HIC)
        __global uchar* my_pad = scratchpad_buf + (ulong)tid * (ulong)CL_SCRATCHPAD_BYTES;
        ulong step4[8];
        cl_memory_hard_transform(step3, my_pad, step4);
        ulong step5[8];
        npu_mixing_words(step4, step5, npu_w1, npu_b1, npu_w2, npu_b2, npu_scale1, npu_scale2);
        // Phase 3: Merkabah backward
        cl_merkabah_backward_passes(my_pad);
        // Phase 5: Kabala phase (re-read scratchpad with HIC indexing)
        ulong kab_state[8];
        #pragma unroll 8
        for (int i = 0; i < 8; i++) kab_state[i] = step5[i];
        cl_kabala_phase(my_pad, kab_state);
        // Phase 6: Brahma-jyoti finalize
        cl_brahma_jyoti_finalize(kab_state, final_hash);
    } else if (chv4 && memory_hard) {
        // CHv4.1 Golden Middle: GoldenMatrix → MemoryHard → NPU Mixing → CosmicFusion
        __global uchar* my_pad = scratchpad_buf + (ulong)tid * (ulong)CL_SCRATCHPAD_BYTES;
        ulong step4[8];
        cl_memory_hard_transform(step3, my_pad, step4);
        ulong step5[8];
        npu_mixing_words(step4, step5, npu_w1, npu_b1, npu_w2, npu_b2, npu_scale1, npu_scale2);
        cosmic_fusion(step5, final_hash);
    } else if (memory_hard) {
        // CHv3-only path (dead code: CHV4_NPU_FORK_HEIGHT=0 → vzždy chv4=1)
        __global uchar* my_pad = scratchpad_buf + (ulong)tid * (ulong)CL_SCRATCHPAD_BYTES;
        ulong step4[8];
        cl_memory_hard_transform(step3, my_pad, step4);
        cosmic_fusion(step4, final_hash);
    } else {
        // Legacy (height < 100k): GoldenMatrix → CosmicFusion directly
        cosmic_fusion(step3, final_hash);
    }

    uint state0 = (uint)final_hash[0]
                | ((uint)final_hash[1] <<  8)
                | ((uint)final_hash[2] << 16)
                | ((uint)final_hash[3] << 24);

    if (state0 <= target_u32) {
        if (atomic_xchg(result_count, 1) == 0) {
            results[0] = 1;
            results[1] = nonce;
            #pragma unroll 32
            for (int i = 0; i < 32; i++) result_hash[i] = final_hash[i];
        }
    }
}
