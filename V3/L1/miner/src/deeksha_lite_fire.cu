/*
 * DeekshaLite Fire — Native CUDA GPU Mining Kernel
 *
 * Ported from the canonical OpenCL kernel (deeksha_lite_fire.cl).
 * Every operation is bit-exact with Rust reference and OpenCL production kernel.
 *
 * Pipeline:
 *   1. Keccak256(header || nonce)  — host precomputed state
 *   2. Memory-hard scratchpad (256 KiB, 8192 blocks, 2 passes, 64 reads)
 *   3. AES-128 CTR mix (3 full rounds + 1 final)
 *   4. Thermal loop (16384 iters, 8 ulong chains) — extra heat, no float
 *   5. Keccak256(s3_after_thermal) → final hash
 *
 * Compatible with: NVIDIA CUDA (Compute Capability 7.0+)
 */

typedef unsigned char      uint8_t;
typedef unsigned short     uint16_t;
typedef unsigned int       uint32_t;
typedef unsigned long long uint64_t;
typedef long long          int64_t;

/* ========================================================================== */
/* Constants — identical to OpenCL kernel                                      */
/* ========================================================================== */

#define SCRATCHPAD_SIZE  262144   /* 256 KiB = 8192 * 32 */
#define BLOCK_SIZE       32
#define BLOCK_COUNT      8192
#define PASSES           2
#define RANDOM_READS     64
#define THERMAL_ITERS    16384

#define ROL64(x, n) (((x) << (n)) | ((x) >> (64 - (n))))

#define CHI_ROW(b) \
{ uint64_t _a=st[(b)],_b=st[(b)+1],_c=st[(b)+2],_d=st[(b)+3],_e=st[(b)+4]; \
  st[(b)]   = _a ^ ((~_b) & _c); \
  st[(b)+1] = _b ^ ((~_c) & _d); \
  st[(b)+2] = _c ^ ((~_d) & _e); \
  st[(b)+3] = _d ^ ((~_e) & _a); \
  st[(b)+4] = _e ^ ((~_a) & _b); }

/* Keccak-f1600 round constants */
__constant__ uint64_t KC_RC[24] = {
    0x0000000000000001ULL, 0x0000000000008082ULL,
    0x800000000000808AULL, 0x8000000080008000ULL,
    0x000000000000808BULL, 0x0000000080000001ULL,
    0x8000000080008081ULL, 0x8000000000008009ULL,
    0x000000000000008AULL, 0x0000000000000088ULL,
    0x0000000080008009ULL, 0x000000008000000AULL,
    0x000000008000808BULL, 0x800000000000008BULL,
    0x8000000000008089ULL, 0x8000000000008003ULL,
    0x8000000000008002ULL, 0x8000000000000080ULL,
    0x000000000000800AULL, 0x800000008000000AULL,
    0x8000000080008081ULL, 0x8000000000008080ULL,
    0x0000000080000001ULL, 0x8000000080008008ULL,
};

/* ========================================================================== */
/* Keccak-f1600                                                                */
/* ========================================================================== */

__device__ __forceinline__ void keccak_f1600(uint64_t *st)
{
    uint64_t bc0, bc1, bc2, bc3, bc4, t;
    #pragma unroll 4
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

typedef union { uint64_t u[25]; uint8_t b[200]; } keccak_st_t;

/* Same as v1: host precomputes keccak state after absorbing header[0..80] */
__device__ void keccak256_from_state(
    const uint64_t *pre_state,
    uint64_t nonce,
    uint8_t out[32])
{
    keccak_st_t s;
    #pragma unroll
    for (int i = 0; i < 25; i++) s.u[i] = pre_state[i];
    for (int i = 0; i < 8; i++)
        s.b[80 + i] ^= (uint8_t)(nonce >> (i * 8));
    s.b[88]  ^= 0x01;
    s.b[135] ^= 0x80;
    keccak_f1600(s.u);
    for (int i = 0; i < 32; i++) out[i] = s.b[i];
}

__device__ void sha3_512(const uint8_t *in, uint32_t inlen, uint8_t out[64])
{
    keccak_st_t s;
    #pragma unroll
    for (int i = 0; i < 25; i++) s.u[i] = 0;
    uint32_t pos = 0;
    for (uint32_t i = 0; i < inlen; i++) {
        s.b[pos] ^= in[i];
        if (++pos == 72) { keccak_f1600(s.u); pos = 0; }
    }
    s.b[pos] ^= 0x06;
    s.b[71]  ^= 0x80;
    keccak_f1600(s.u);
    for (int i = 0; i < 64; i++) out[i] = s.b[i];
}

/* SHA3-512 specialized for 65-byte input (used by fill_scratchpad). */
__device__ __forceinline__ void sha3_512_65(const uint8_t *in, uint8_t out[64])
{
    keccak_st_t s;
    #pragma unroll
    for (int i = 0; i < 25; i++) s.u[i] = 0;
    /* Absorb 65 bytes directly */
    #pragma unroll
    for (int i = 0; i < 65; i++) s.b[i] ^= in[i];
    /* Pad (0x06 at byte 65, 0x80 at byte 71) */
    s.b[65] ^= 0x06;
    s.b[71] ^= 0x80;
    keccak_f1600(s.u);
    /* 64-byte output copy */
    for (int i = 0; i < 64; i++) out[i] = s.b[i];
}

/* ========================================================================== */
/* AES-128 helpers — identical to v1                                          */
/* ========================================================================== */

__constant__ uint8_t AES_SBOX[256] = {
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

__device__ __forceinline__ void aes_sub_bytes(uint8_t s[16]) {
    #pragma unroll
    for (int i = 0; i < 16; i++) s[i] = AES_SBOX[s[i]];
}

__device__ __forceinline__ void aes_shift_rows(uint8_t s[16])
{
    uint8_t t;
    t=s[1];  s[1] =s[5];  s[5] =s[9];  s[9] =s[13]; s[13]=t;
    t=s[2];  s[2] =s[10]; s[10]=t;
    t=s[6];  s[6] =s[14]; s[14]=t;
    t=s[15]; s[15]=s[11]; s[11]=s[7];  s[7] =s[3];  s[3] =t;
}

__device__ __forceinline__ uint8_t aes_xtime(uint8_t a) {
    return (uint8_t)((a << 1) ^ (((a >> 7) & 1) * 0x1b));
}

__device__ __forceinline__ void aes_mix_columns(uint8_t s[16])
{
    #pragma unroll
    for (int i = 0; i < 4; i++) {
        uint8_t a=s[i*4],b=s[i*4+1],c=s[i*4+2],d=s[i*4+3];
        uint8_t e=a^b^c^d;
        s[i*4]  ^= e ^ aes_xtime(a^b);
        s[i*4+1]^= e ^ aes_xtime(b^c);
        s[i*4+2]^= e ^ aes_xtime(c^d);
        s[i*4+3]^= e ^ aes_xtime(d^a);
    }
}

__device__ __forceinline__ void aes_add_round_key(uint8_t s[16], const uint8_t k[16]) {
    #pragma unroll
    for (int i = 0; i < 16; i++) s[i] ^= k[i];
}

__device__ __forceinline__ void aes_round(uint8_t s[16], const uint8_t k[16]) {
    aes_sub_bytes(s); aes_shift_rows(s); aes_mix_columns(s); aes_add_round_key(s, k);
}

__device__ __forceinline__ void aes_final_round(uint8_t s[16], const uint8_t k[16]) {
    aes_sub_bytes(s); aes_shift_rows(s); aes_add_round_key(s, k);
}

/* ========================================================================== */
/* Steps 2A/2B/2C: scratchpad — identical to v1                               */
/* ========================================================================== */

__device__ void fill_scratchpad(const uint8_t seed[32], uint8_t *pad)
{
    /* 8-byte aligned state */
    uint64_t state_aligned[8];
    uint8_t *state = (uint8_t*)state_aligned;
    #pragma unroll
    for (int i = 0; i < 32; i++) state[i] = seed[i];
    for (int i = 32; i < 64; i++) state[i] = 0;
    for (uint32_t blk = 0; blk < BLOCK_COUNT; blk++) {
        uint8_t inp[65];
        #pragma unroll
        for (int i = 0; i < 64; i++) inp[i] = state[i];
        inp[64] = (uint8_t)(blk & 0xFF);
        uint64_t out64_aligned[8];
        uint8_t *out64 = (uint8_t*)out64_aligned;
        sha3_512_65(inp, out64);
        uint32_t off = blk * BLOCK_SIZE;
        /* Copy 32 bytes (BLOCK_SIZE) to pad, 32 bytes to state */
        #pragma unroll
        for (int i = 0; i < 32; i++) {
            pad[off + i] = out64[i];
            state[i] = out64[i];
        }
        /* Zero remaining state bytes */
        for (int i = 32; i < 64; i++) state[i] = 0;
    }
}

__device__ void sequential_passes(uint8_t *pad)
{
    /* Forward pass: XOR each block with previous (wrap-around) */
    uint64_t prev[4];
    #pragma unroll
    for (int i = 0; i < 4; i++)
        prev[i] = *(uint64_t*)(pad + (BLOCK_COUNT - 1) * BLOCK_SIZE + i * 8);
    for (uint32_t i = 0; i < BLOCK_COUNT; i++) {
        uint32_t off = i * BLOCK_SIZE;
        uint64_t cv[4];
        #pragma unroll
        for (int j = 0; j < 4; j++) {
            cv[j] = *(uint64_t*)(pad + off + j * 8);
            cv[j] ^= prev[j];
            *(uint64_t*)(pad + off + j * 8) = cv[j];
            prev[j] = cv[j];
        }
    }
    /* Backward pass: XOR each block with next (wrap-around) */
    uint64_t next_v[4];
    #pragma unroll
    for (int i = 0; i < 4; i++)
        next_v[i] = *(uint64_t*)(pad + 0 + i * 8);
    for (uint32_t i = BLOCK_COUNT; i > 0; i--) {
        uint32_t idx = i - 1;
        uint32_t off = idx * BLOCK_SIZE;
        uint64_t cv[4];
        #pragma unroll
        for (int j = 0; j < 4; j++) {
            cv[j] = *(uint64_t*)(pad + off + j * 8);
            cv[j] ^= next_v[j];
            *(uint64_t*)(pad + off + j * 8) = cv[j];
            next_v[j] = cv[j];
        }
    }
}

__device__ void random_read_mix(const uint8_t seed[32], const uint8_t *pad, uint8_t out[32])
{
    /* 8-byte aligned accumulator */
    uint64_t acc_aligned[4];
    uint8_t *acc = (uint8_t*)acc_aligned;
    #pragma unroll
    for (int i = 0; i < 32; i++) acc[i] = seed[i];
    uint64_t pos = 0;
    for (uint64_t r = 0; r < RANDOM_READS; r++) {
        uint32_t off = (uint32_t)(pos * BLOCK_SIZE);
        #pragma unroll
        for (int j = 0; j < 4; j++)
            acc_aligned[j] ^= *(uint64_t*)(pad + off + j * 8);
        uint64_t idx_val = 0;
        for (int i = 0; i < 8; i++)
            idx_val |= ((uint64_t)acc[i]) << (i * 8);
        pos = (idx_val ^ pos ^ r) % BLOCK_COUNT;
    }
    #pragma unroll
    for (int i = 0; i < 32; i++) out[i] = acc[i];
}

/* ========================================================================== */
/* Step 3: AES-128 CTR mix — identical to v1                                  */
/* ========================================================================== */

__device__ void aes128_mix(const uint8_t seed[32], uint64_t nonce, uint8_t out[32])
{
    uint8_t key[16];
    #pragma unroll
    for (int i = 0; i < 16; i++) key[i] = seed[i];

    uint8_t counter[16];
    for (int i = 0; i < 8; i++) counter[i]   = (uint8_t)(nonce >> (i * 8));
    for (int i = 0; i < 8; i++) counter[8+i] = seed[16+i];

    uint8_t block0[16], block1[16];
    #pragma unroll
    for (int i = 0; i < 16; i++) { block0[i] = counter[i]; block1[i] = counter[i]; }
    uint32_t carry = 1;
    for (int i = 0; i < 16; i++) {
        uint32_t s = (uint32_t)block1[i] + carry;
        block1[i] = (uint8_t)(s & 0xFF);
        carry = s >> 8;
        if (carry == 0) break;
    }
    for (int r = 0; r < 3; r++) { aes_round(block0, key); aes_round(block1, key); }
    aes_final_round(block0, key);
    aes_final_round(block1, key);
    #pragma unroll
    for (int i = 0; i < 16; i++) {
        out[i]    = block0[i] ^ seed[i];
        out[16+i] = block1[i] ^ seed[16+i];
    }
}

/* ========================================================================== */
/* Step 4: Thermal loop — the only addition over v1                           */
/* ========================================================================== */

__device__ void thermal_loop(uint8_t data[32], uint64_t nonce)
{
    uint64_t a = nonce ^ 0x9E3779B97F4A7C15ULL;
    uint64_t b = nonce ^ 0xBF58476D1CE4E5B9ULL;
    uint64_t c = nonce ^ 0x94D049BB133111EBULL;
    uint64_t d = nonce ^ 0x5851F42D4C957F2DULL;
    uint64_t e = nonce ^ 0xC0FFEE123456789AULL;
    uint64_t f = nonce ^ 0xDEADBEEFCAFEBABEULL;
    uint64_t g = nonce ^ 0xBADC0FFEE0DDF00DULL;
    uint64_t h = nonce ^ 0xFEEDFACECAFEBEEFULL;

    for (int i = 0; i < THERMAL_ITERS; i++) {
        a = ROL64(a,17) + b;  b = ROL64(b,31) ^ a;
        c = ROL64(c,13) + d;  d = ROL64(d,47) ^ c;
        e = ROL64(e,23) + f;  f = ROL64(f,41) ^ e;
        g = ROL64(g,11) + h;  h = ROL64(h,53) ^ g;
        a = a * 0xFF51AFD7ED558CCDULL;  b = b + 0xFF51AFD7ED558CCDULL;
        c = c * 0x94D049BB133111EBULL;  d = d + 0x5851F42D4C957F2DULL;
        e = e * 0xC0FFEE123456789AULL;  f = f + 0xDEADBEEFCAFEBABEULL;
        g = g * 0xBADC0FFEE0DDF00DULL;  h = h + 0xFEEDFACECAFEBEEFULL;
        a ^= (uint64_t)data[(i    ) & 0x1F];
        b ^= (uint64_t)data[(i + 8) & 0x1F];
        c ^= (uint64_t)data[(i +16) & 0x1F];
        d ^= (uint64_t)data[(i +24) & 0x1F];
        e ^= (uint64_t)data[(i + 4) & 0x1F];
        f ^= (uint64_t)data[(i +12) & 0x1F];
        g ^= (uint64_t)data[(i + 2) & 0x1F];
        h ^= (uint64_t)data[(i + 6) & 0x1F];
    }
    /* Fold back — prevents compiler from eliminating the loop */
    data[ 0] ^= (uint8_t)(a);       data[ 1] ^= (uint8_t)(a>>8);
    data[ 2] ^= (uint8_t)(b);       data[ 3] ^= (uint8_t)(b>>8);
    data[ 4] ^= (uint8_t)(c);       data[ 5] ^= (uint8_t)(c>>8);
    data[ 6] ^= (uint8_t)(d);       data[ 7] ^= (uint8_t)(d>>8);
    data[ 8] ^= (uint8_t)(e);       data[ 9] ^= (uint8_t)(e>>8);
    data[10] ^= (uint8_t)(f);       data[11] ^= (uint8_t)(f>>8);
    data[12] ^= (uint8_t)(g);       data[13] ^= (uint8_t)(g>>8);
    data[14] ^= (uint8_t)(h);       data[15] ^= (uint8_t)(h>>8);
    data[16] ^= (uint8_t)(a>>16);   data[17] ^= (uint8_t)(b>>16);
    data[18] ^= (uint8_t)(c>>16);   data[19] ^= (uint8_t)(d>>16);
    data[20] ^= (uint8_t)(e>>16);   data[21] ^= (uint8_t)(f>>16);
    data[22] ^= (uint8_t)(g>>16);   data[23] ^= (uint8_t)(h>>16);
    data[24] ^= (uint8_t)(a>>24);   data[25] ^= (uint8_t)(b>>24);
}

/* ========================================================================== */
/* Main kernel                                                                  */
/* ========================================================================== */

extern "C" __global__ void deeksha_lite_fire_mine(
    const uint64_t *header_keccak_state,  /* host precomputed 25 u64s */
    uint64_t nonce_base,
    uint32_t nonce_count,
    uint8_t *output_hashes,               /* nonce_count * 32 bytes */
    uint8_t *scratchpad_pool,             /* nonce_count * SCRATCHPAD_SIZE */
    uint32_t target_u32,                  /* LE target — 0 means "no early exit" */
    uint64_t *result_nonce,               /* atomic sentinel for solution */
    uint8_t *result_hash)                 /* 32 bytes for solution hash */
{
    uint32_t tid = blockIdx.x * blockDim.x + threadIdx.x;
    if (tid >= nonce_count) return;

    /* Early exit if a solution was already found by another thread */
    if (target_u32 != 0 && atomicAdd(result_nonce, 0ULL) != 0xFFFFFFFFFFFFFFFFULL) return;

    uint8_t *pad = scratchpad_pool + (uint64_t)tid * SCRATCHPAD_SIZE;
    uint64_t nonce = nonce_base + (uint64_t)tid;

    /* Step 1: Keccak256(header || nonce) */
    uint8_t s1[32];
    keccak256_from_state(header_keccak_state, nonce, s1);

    /* Step 2: Memory-hard scratchpad */
    fill_scratchpad(s1, pad);
    sequential_passes(pad);
    uint8_t s2[32];
    random_read_mix(s1, pad, s2);

    /* Step 3: AES-128 CTR mix */
    uint8_t s3[32];
    aes128_mix(s2, nonce, s3);

    /* Step 4: Thermal loop */
    thermal_loop(s3, nonce);

    /* Step 5: Keccak256 final */
    uint8_t hash[32];
    keccak_st_t s;
    #pragma unroll
    for (int i = 0; i < 25; i++) s.u[i] = 0;
    for (int i = 0; i < 32; i++) s.b[i] ^= s3[i];
    s.b[32] ^= 0x01;
    s.b[135] ^= 0x80;
    keccak_f1600(s.u);
    for (int i = 0; i < 32; i++) hash[i] = s.b[i];

    /* Write output hash */
    uint8_t *slot = output_hashes + (uint64_t)tid * 32;
    #pragma unroll
    for (int i = 0; i < 32; i++) slot[i] = hash[i];

    /* Target check: compare first 4 bytes of hash (LE) against target */
    if (target_u32 != 0) {
        uint32_t hash_le = *(uint32_t*)hash;
        if (hash_le <= target_u32) {
            /* Atomically claim the solution slot */
            uint64_t old = atomicExch(result_nonce, nonce);
            if (old == 0xFFFFFFFFFFFFFFFFULL) {
                /* We are the first solution — write the hash */
                for (int i = 0; i < 32; i++) result_hash[i] = hash[i];
            }
        }
    }
}

/* Debug kernel: returns hash for a single nonce (for KAT validation) */
extern "C" __global__ void deeksha_lite_fire_debug(
    const uint64_t *header_keccak_state,
    uint64_t nonce,
    uint8_t *output_hash,
    uint8_t *scratchpad)
{
    uint32_t tid = blockIdx.x * blockDim.x + threadIdx.x;
    if (tid != 0) return;

    uint8_t *pad = scratchpad;
    uint8_t s1[32];
    keccak256_from_state(header_keccak_state, nonce, s1);
    fill_scratchpad(s1, pad);
    sequential_passes(pad);
    uint8_t s2[32];
    random_read_mix(s1, pad, s2);
    uint8_t s3[32];
    aes128_mix(s2, nonce, s3);
    thermal_loop(s3, nonce);

    keccak_st_t s;
    #pragma unroll
    for (int i = 0; i < 25; i++) s.u[i] = 0;
    for (int i = 0; i < 32; i++) s.b[i] ^= s3[i];
    s.b[32] ^= 0x01;
    s.b[135] ^= 0x80;
    keccak_f1600(s.u);
    for (int i = 0; i < 32; i++) output_hash[i] = s.b[i];
}
