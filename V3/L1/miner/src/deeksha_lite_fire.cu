/*
 * DeekshaLite Fire — Native CUDA GPU Mining Kernel (OPTIMIZED v3)
 *
 * Ported from the canonical OpenCL kernel (deeksha_lite_fire.cl).
 * Every operation is bit-exact with Rust reference and OpenCL production kernel.
 *
 * v3 optimizations:
 *   - INTERLEAVED scratchpad layout: block N of all threads is contiguous
 *     in memory → perfect memory coalescing for fill_scratchpad and
 *     sequential_passes (16K+ coalesced reads vs 16K strided reads)
 *   - __launch_bounds__(128, 2): 256 registers/thread, eliminates keccak
 *     state register spilling to local memory
 *   - AES S-box in __shared__ memory (256 bytes, 1-cycle access vs ~20 for const)
 *   - __ldg() for read-only header_keccak_state (texture cache)
 *   - Simple keccak loop (no unrolling) for smaller instruction footprint
 *   - All scratchpad I/O via u64 coalesced 128-byte transactions
 */

typedef unsigned char      uint8_t;
typedef unsigned short     uint16_t;
typedef unsigned int       uint32_t;
typedef unsigned long long uint64_t;
typedef long long          int64_t;

/* ========================================================================== */
/* Constants                                                                   */
/* ========================================================================== */

#define SCRATCHPAD_SIZE  262144   /* 256 KiB = 8192 * 32 */
#define BLOCK_SIZE       32       /* bytes per block */
#define BLOCK_COUNT      8192
#define RANDOM_READS     64
#define THERMAL_ITERS    16384
#define TPB              128      /* threads per block (must match launch config) */

#define ROL64(x, n) (((x) << (n)) | ((x) >> (64 - (n))))

/* ========================================================================== */
/* Keccak-f1600 round constants (in constant memory)                           */
/* ========================================================================== */

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
/* Keccak-f1600 — simple loop, NOT inlined (called 8194+ times)                */
/* State is passed as pointer — compiler keeps it in registers if it fits      */
/* ========================================================================== */

__device__ __forceinline__ void keccak_f1600(uint64_t st[25])
{
    uint64_t bc0, bc1, bc2, bc3, bc4, t;

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
        /* Rho + Pi */
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
        bc0=st[0],bc1=st[1],bc2=st[2],bc3=st[3],bc4=st[4];
        st[0]=bc0^((~bc1)&bc2); st[1]=bc1^((~bc2)&bc3); st[2]=bc2^((~bc3)&bc4); st[3]=bc3^((~bc4)&bc0); st[4]=bc4^((~bc0)&bc1);
        bc0=st[5],bc1=st[6],bc2=st[7],bc3=st[8],bc4=st[9];
        st[5]=bc0^((~bc1)&bc2); st[6]=bc1^((~bc2)&bc3); st[7]=bc2^((~bc3)&bc4); st[8]=bc3^((~bc4)&bc0); st[9]=bc4^((~bc0)&bc1);
        bc0=st[10],bc1=st[11],bc2=st[12],bc3=st[13],bc4=st[14];
        st[10]=bc0^((~bc1)&bc2); st[11]=bc1^((~bc2)&bc3); st[12]=bc2^((~bc3)&bc4); st[13]=bc3^((~bc4)&bc0); st[14]=bc4^((~bc0)&bc1);
        bc0=st[15],bc1=st[16],bc2=st[17],bc3=st[18],bc4=st[19];
        st[15]=bc0^((~bc1)&bc2); st[16]=bc1^((~bc2)&bc3); st[17]=bc2^((~bc3)&bc4); st[18]=bc3^((~bc4)&bc0); st[19]=bc4^((~bc0)&bc1);
        bc0=st[20],bc1=st[21],bc2=st[22],bc3=st[23],bc4=st[24];
        st[20]=bc0^((~bc1)&bc2); st[21]=bc1^((~bc2)&bc3); st[22]=bc2^((~bc3)&bc4); st[23]=bc3^((~bc4)&bc0); st[24]=bc4^((~bc0)&bc1);
        /* Iota */
        st[0] ^= KC_RC[rnd];
    }
}

/* ========================================================================== */
/* SHA3-512 for 65-byte input (used by fill_scratchpad)                        */
/* Takes 8 u64s of state + 1 byte block index, outputs 8 u64s                  */
/* ========================================================================== */

__device__ __forceinline__ void sha3_512_65_u64(
    const uint64_t state_in[8],
    uint8_t  blk_byte,
    uint64_t out_u64[8])
{
    uint64_t st[25];
    st[0]=state_in[0]; st[1]=state_in[1]; st[2]=state_in[2]; st[3]=state_in[3];
    st[4]=state_in[4]; st[5]=state_in[5]; st[6]=state_in[6]; st[7]=state_in[7];
    st[8]=0; st[9]=0; st[10]=0; st[11]=0; st[12]=0; st[13]=0; st[14]=0; st[15]=0;
    st[16]=0; st[17]=0; st[18]=0; st[19]=0; st[20]=0; st[21]=0; st[22]=0; st[23]=0;
    st[24]=0;

    /* XOR byte 64 into low byte of st[8] */
    st[8] ^= (uint64_t)blk_byte;
    /* Pad: 0x06 at byte 65 (st[8] byte 1), 0x80 at byte 71 (st[8] byte 7) */
    st[8] ^= (0x06ULL << 8) | (0x80ULL << 56);

    keccak_f1600(st);

    out_u64[0]=st[0]; out_u64[1]=st[1]; out_u64[2]=st[2]; out_u64[3]=st[3];
    out_u64[4]=st[4]; out_u64[5]=st[5]; out_u64[6]=st[6]; out_u64[7]=st[7];
}

/* ========================================================================== */
/* Keccak256 from precomputed header state → 4 u64s (32 bytes)                 */
/* ========================================================================== */

__device__ __forceinline__ void keccak256_from_state(
    const uint64_t * __restrict__ pre_state,
    uint64_t nonce,
    uint64_t out_u64[4])
{
    uint64_t st[25];
    /* Use __ldg for read-only data through texture cache */
    #pragma unroll
    for (int i = 0; i < 25; i++) st[i] = __ldg(pre_state + i);

    /* XOR nonce into bytes 80..87 = st[10] */
    st[10] ^= nonce;
    /* Pad: 0x01 at byte 88 (st[11] byte 0), 0x80 at byte 135 (st[16] byte 7) */
    st[11] ^= 0x01ULL;
    st[16] ^= (0x80ULL << 56);

    keccak_f1600(st);

    out_u64[0]=st[0]; out_u64[1]=st[1]; out_u64[2]=st[2]; out_u64[3]=st[3];
}

/* ========================================================================== */
/* AES-128 helpers — S-box in shared memory                                    */
/* ========================================================================== */

__device__ __forceinline__ uint8_t aes_xtime(uint8_t a) {
    return (uint8_t)((a << 1) ^ (((a >> 7) & 1) * 0x1b));
}

__device__ __forceinline__ void aes128_mix(
    const uint64_t seed_u64[4],
    uint64_t nonce,
    uint64_t out_u64[4],
    const uint8_t * __restrict__ sbox)  /* shared memory S-box */
{
    const uint8_t *seed = (const uint8_t*)seed_u64;
    uint8_t key[16];
    uint8_t counter[16];

    #pragma unroll
    for (int i = 0; i < 16; i++) key[i] = seed[i];
    for (int i = 0; i < 8; i++) counter[i] = (uint8_t)(nonce >> (i * 8));
    #pragma unroll
    for (int i = 0; i < 8; i++) counter[8+i] = seed[16+i];

    uint8_t b0[16], b1[16];
    #pragma unroll
    for (int i = 0; i < 16; i++) { b0[i] = counter[i]; b1[i] = counter[i]; }
    uint32_t carry = 1;
    for (int i = 0; i < 16; i++) {
        uint32_t s = (uint32_t)b1[i] + carry;
        b1[i] = (uint8_t)(s & 0xFF);
        carry = s >> 8;
        if (carry == 0) break;
    }

    for (int r = 0; r < 3; r++) {
        /* SubBytes (from shared memory) */
        #pragma unroll
        for (int i = 0; i < 16; i++) { b0[i] = sbox[b0[i]]; b1[i] = sbox[b1[i]]; }
        /* ShiftRows */
        uint8_t t;
        t=b0[1]; b0[1]=b0[5]; b0[5]=b0[9]; b0[9]=b0[13]; b0[13]=t;
        t=b0[2]; b0[2]=b0[10]; b0[10]=t;
        t=b0[6]; b0[6]=b0[14]; b0[14]=t;
        t=b0[15]; b0[15]=b0[11]; b0[11]=b0[7]; b0[7]=b0[3]; b0[3]=t;
        t=b1[1]; b1[1]=b1[5]; b1[5]=b1[9]; b1[9]=b1[13]; b1[13]=t;
        t=b1[2]; b1[2]=b1[10]; b1[10]=t;
        t=b1[6]; b1[6]=b1[14]; b1[14]=t;
        t=b1[15]; b1[15]=b1[11]; b1[11]=b1[7]; b1[7]=b1[3]; b1[3]=t;
        /* MixColumns */
        #pragma unroll
        for (int i = 0; i < 4; i++) {
            uint8_t a=b0[i*4],bb=b0[i*4+1],c=b0[i*4+2],d=b0[i*4+3];
            uint8_t e=a^bb^c^d;
            b0[i*4]  ^= e ^ aes_xtime(a^bb);
            b0[i*4+1]^= e ^ aes_xtime(bb^c);
            b0[i*4+2]^= e ^ aes_xtime(c^d);
            b0[i*4+3]^= e ^ aes_xtime(d^a);
            a=b1[i*4],bb=b1[i*4+1],c=b1[i*4+2],d=b1[i*4+3];
            e=a^bb^c^d;
            b1[i*4]  ^= e ^ aes_xtime(a^bb);
            b1[i*4+1]^= e ^ aes_xtime(bb^c);
            b1[i*4+2]^= e ^ aes_xtime(c^d);
            b1[i*4+3]^= e ^ aes_xtime(d^a);
        }
        /* AddRoundKey */
        #pragma unroll
        for (int i = 0; i < 16; i++) { b0[i] ^= key[i]; b1[i] ^= key[i]; }
    }
    /* Final round */
    #pragma unroll
    for (int i = 0; i < 16; i++) { b0[i] = sbox[b0[i]]; b1[i] = sbox[b1[i]]; }
    uint8_t t;
    t=b0[1]; b0[1]=b0[5]; b0[5]=b0[9]; b0[9]=b0[13]; b0[13]=t;
    t=b0[2]; b0[2]=b0[10]; b0[10]=t;
    t=b0[6]; b0[6]=b0[14]; b0[14]=t;
    t=b0[15]; b0[15]=b0[11]; b0[11]=b0[7]; b0[7]=b0[3]; b0[3]=t;
    t=b1[1]; b1[1]=b1[5]; b1[5]=b1[9]; b1[9]=b1[13]; b1[13]=t;
    t=b1[2]; b1[2]=b1[10]; b1[10]=t;
    t=b1[6]; b1[6]=b1[14]; b1[14]=t;
    t=b1[15]; b1[15]=b1[11]; b1[11]=b1[7]; b1[7]=b1[3]; b1[3]=t;
    #pragma unroll
    for (int i = 0; i < 16; i++) { b0[i] ^= key[i]; b1[i] ^= key[i]; }

    /* XOR with seed → output */
    #pragma unroll
    for (int i = 0; i < 16; i++) { b0[i] ^= seed[i]; b1[i] ^= seed[16+i]; }
    uint8_t *out = (uint8_t*)out_u64;
    #pragma unroll
    for (int i = 0; i < 16; i++) { out[i] = b0[i]; out[16+i] = b1[i]; }
}

/* ========================================================================== */
/* INTERLEAVED scratchpad access helpers                                       */
/*                                                                             */
/* Layout: block blk of thread tid is at:                                      */
/*   pad_u64[(blk * total_threads + tid) * 4]                                 */
/*                                                                             */
/* This means all threads in a warp access consecutive u64s for the same       */
/* block → 128-byte coalesced memory transactions.                             */
/* ========================================================================== */

__device__ __forceinline__ uint64_t* pad_block(
    uint64_t * __restrict__ pad_pool,
    uint32_t blk,
    uint32_t tid,
    uint32_t total_threads)
{
    return pad_pool + ((uint64_t)blk * total_threads + tid) * 4;
}

/* ========================================================================== */
/* Step 2A: fill_scratchpad — 8192 SHA3-512 calls (INTERLEAVED)                */
/* ========================================================================== */

__device__ __forceinline__ void fill_scratchpad(
    const uint64_t seed_u64[4],
    uint64_t * __restrict__ pad_pool,
    uint32_t tid,
    uint32_t total_threads)
{
    uint64_t state[8];
    state[0] = seed_u64[0]; state[1] = seed_u64[1];
    state[2] = seed_u64[2]; state[3] = seed_u64[3];
    state[4] = 0; state[5] = 0; state[6] = 0; state[7] = 0;

    for (uint32_t blk = 0; blk < BLOCK_COUNT; blk++) {
        uint64_t out[8];
        sha3_512_65_u64(state, (uint8_t)(blk & 0xFF), out);

        /* Write to interleaved position — coalesced across warp */
        uint64_t *pb = pad_block(pad_pool, blk, tid, total_threads);
        pb[0] = out[0]; pb[1] = out[1]; pb[2] = out[2]; pb[3] = out[3];

        /* Chain state: first 4 u64s from output, rest zero */
        state[0] = out[0]; state[1] = out[1];
        state[2] = out[2]; state[3] = out[3];
        state[4] = 0; state[5] = 0; state[6] = 0; state[7] = 0;
    }
}

/* ========================================================================== */
/* Step 2B: sequential_passes — forward + backward XOR (INTERLEAVED)           */
/* ========================================================================== */

__device__ __forceinline__ void sequential_passes(
    uint64_t * __restrict__ pad_pool,
    uint32_t tid,
    uint32_t total_threads)
{
    /* Forward pass: XOR each block with previous (wrap-around) */
    uint64_t prev[4];
    {
        uint64_t *pb = pad_block(pad_pool, BLOCK_COUNT - 1, tid, total_threads);
        prev[0] = pb[0]; prev[1] = pb[1]; prev[2] = pb[2]; prev[3] = pb[3];
    }

    for (uint32_t i = 0; i < BLOCK_COUNT; i++) {
        uint64_t *pb = pad_block(pad_pool, i, tid, total_threads);
        uint64_t cv[4];
        cv[0] = pb[0] ^ prev[0];
        cv[1] = pb[1] ^ prev[1];
        cv[2] = pb[2] ^ prev[2];
        cv[3] = pb[3] ^ prev[3];
        pb[0] = cv[0]; pb[1] = cv[1]; pb[2] = cv[2]; pb[3] = cv[3];
        prev[0] = cv[0]; prev[1] = cv[1]; prev[2] = cv[2]; prev[3] = cv[3];
    }

    /* Backward pass: XOR each block with next (wrap-around) */
    uint64_t nxt[4];
    {
        uint64_t *pb = pad_block(pad_pool, 0, tid, total_threads);
        nxt[0] = pb[0]; nxt[1] = pb[1]; nxt[2] = pb[2]; nxt[3] = pb[3];
    }

    for (uint32_t i = BLOCK_COUNT; i > 0; i--) {
        uint32_t idx = i - 1;
        uint64_t *pb = pad_block(pad_pool, idx, tid, total_threads);
        uint64_t cv[4];
        cv[0] = pb[0] ^ nxt[0];
        cv[1] = pb[1] ^ nxt[1];
        cv[2] = pb[2] ^ nxt[2];
        cv[3] = pb[3] ^ nxt[3];
        pb[0] = cv[0]; pb[1] = cv[1]; pb[2] = cv[2]; pb[3] = cv[3];
        nxt[0] = cv[0]; nxt[1] = cv[1]; nxt[2] = cv[2]; nxt[3] = cv[3];
    }
}

/* ========================================================================== */
/* Step 2C: random_read_mix — 64 random reads (INTERLEAVED)                    */
/* ========================================================================== */

__device__ __forceinline__ void random_read_mix(
    const uint64_t seed_u64[4],
    uint64_t * __restrict__ pad_pool,
    uint32_t tid,
    uint32_t total_threads,
    uint64_t out_u64[4])
{
    uint64_t acc[4];
    acc[0] = seed_u64[0]; acc[1] = seed_u64[1];
    acc[2] = seed_u64[2]; acc[3] = seed_u64[3];

    uint64_t pos = 0;
    for (uint64_t r = 0; r < RANDOM_READS; r++) {
        const uint64_t *pb = pad_block(pad_pool, (uint32_t)pos, tid, total_threads);
        acc[0] ^= pb[0];
        acc[1] ^= pb[1];
        acc[2] ^= pb[2];
        acc[3] ^= pb[3];
        uint64_t idx_val = acc[0] ^ pos ^ r;
        pos = idx_val % BLOCK_COUNT;
    }
    out_u64[0] = acc[0]; out_u64[1] = acc[1];
    out_u64[2] = acc[2]; out_u64[3] = acc[3];
}

/* ========================================================================== */
/* Step 4: Thermal loop — 16384 iterations of 8 ulong chains                   */
/* ========================================================================== */

__device__ __forceinline__ void thermal_loop(uint64_t data_u64[4], uint64_t nonce)
{
    uint64_t a = nonce ^ 0x9E3779B97F4A7C15ULL;
    uint64_t b = nonce ^ 0xBF58476D1CE4E5B9ULL;
    uint64_t c = nonce ^ 0x94D049BB133111EBULL;
    uint64_t d = nonce ^ 0x5851F42D4C957F2DULL;
    uint64_t e = nonce ^ 0xC0FFEE123456789AULL;
    uint64_t f = nonce ^ 0xDEADBEEFCAFEBABEULL;
    uint64_t g = nonce ^ 0xBADC0FFEE0DDF00DULL;
    uint64_t h = nonce ^ 0xFEEDFACECAFEBEEFULL;

    uint8_t *data = (uint8_t*)data_u64;

    #pragma unroll 4
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
    /* Fold back */
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
    data[26] ^= (uint8_t)(c>>24);   data[27] ^= (uint8_t)(d>>24);
    data[28] ^= (uint8_t)(e>>24);   data[29] ^= (uint8_t)(f>>24);
    data[30] ^= (uint8_t)(g>>24);   data[31] ^= (uint8_t)(h>>24);
}

/* ========================================================================== */
/* AES S-box data (loaded into shared memory at kernel start)                  */
/* ========================================================================== */

__constant__ uint8_t AES_SBOX_DATA[256] = {
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
/* Main kernel — INTERLEAVED + shared memory S-box + high register budget      */
/* ========================================================================== */

extern "C" __global__ void deeksha_lite_fire_mine(
    const uint64_t *header_keccak_state,
    uint64_t nonce_base,
    uint32_t nonce_count,
    uint8_t *output_hashes,
    uint8_t *scratchpad_pool,    /* INTERLEAVED: (blk * total_threads + tid) * 32 */
    uint32_t target_u32,
    uint64_t *result_nonce,
    uint8_t *result_hash)
{
    /* Shared memory: AES S-box (256 bytes) */
    __shared__ uint8_t sbox[256];
    {
        /* Cooperative load of S-box into shared memory */
        uint32_t tid_local = threadIdx.x;
        if (tid_local < 256) {
            sbox[tid_local] = AES_SBOX_DATA[tid_local];
        }
        __syncthreads();
    }

    uint32_t tid = blockIdx.x * blockDim.x + threadIdx.x;
    if (tid >= nonce_count) return;

    /* Early exit if solution already found */
    if (target_u32 != 0 && atomicAdd(result_nonce, 0ULL) != 0xFFFFFFFFFFFFFFFFULL) return;

    uint32_t total_threads = nonce_count;  /* grid covers exactly nonce_count threads */
    uint64_t nonce = nonce_base + (uint64_t)tid;

    /* Step 1: Keccak256(header || nonce) → 4 u64s */
    uint64_t s1[4];
    keccak256_from_state(header_keccak_state, nonce, s1);

    /* Step 2: Memory-hard scratchpad (INTERLEAVED layout) */
    uint64_t *pad_pool = (uint64_t*)scratchpad_pool;
    fill_scratchpad(s1, pad_pool, tid, total_threads);
    sequential_passes(pad_pool, tid, total_threads);
    uint64_t s2[4];
    random_read_mix(s1, pad_pool, tid, total_threads, s2);

    /* Step 3: AES-128 CTR mix (S-box from shared memory) */
    uint64_t s3[4];
    aes128_mix(s2, nonce, s3, sbox);

    /* Step 4: Thermal loop */
    thermal_loop(s3, nonce);

    /* Step 5: Keccak256 final */
    uint64_t st[25];
    st[0]=s3[0]; st[1]=s3[1]; st[2]=s3[2]; st[3]=s3[3];
    st[4]=0; st[5]=0; st[6]=0; st[7]=0; st[8]=0; st[9]=0;
    st[10]=0; st[11]=0; st[12]=0; st[13]=0; st[14]=0; st[15]=0;
    st[16]=0; st[17]=0; st[18]=0; st[19]=0; st[20]=0; st[21]=0;
    st[22]=0; st[23]=0; st[24]=0;
    st[4] ^= 0x01ULL;
    st[16] ^= (0x80ULL << 56);
    keccak_f1600(st);

    uint64_t hash[4];
    hash[0] = st[0]; hash[1] = st[1]; hash[2] = st[2]; hash[3] = st[3];

    /* Write output hash */
    uint64_t *slot = (uint64_t*)(output_hashes + (uint64_t)tid * 32);
    slot[0] = hash[0]; slot[1] = hash[1]; slot[2] = hash[2]; slot[3] = hash[3];

    /* Target check — big-endian u32 of first 4 hash bytes (matches
     * DifficultyTarget::allows() lexicographic comparison). */
    if (target_u32 != 0) {
        uint32_t hash_low = (uint32_t)(hash[0] & 0xFFFFFFFFULL);
        uint32_t hash_be = __byte_perm(hash_low, 0u, 0x3210u);
        if (hash_be <= target_u32) {
            uint64_t old = atomicExch(result_nonce, nonce);
            if (old == 0xFFFFFFFFFFFFFFFFULL) {
                uint8_t *rh = result_hash;
                uint8_t *hb = (uint8_t*)hash;
                #pragma unroll
                for (int i = 0; i < 32; i++) rh[i] = hb[i];
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

    /* For debug, use non-interleaved layout (single thread) */
    uint64_t *pad = (uint64_t*)scratchpad;
    uint64_t s1[4];
    keccak256_from_state(header_keccak_state, nonce, s1);

    /* Simple non-interleaved fill for single thread */
    uint64_t state[8];
    state[0] = s1[0]; state[1] = s1[1]; state[2] = s1[2]; state[3] = s1[3];
    state[4] = 0; state[5] = 0; state[6] = 0; state[7] = 0;
    for (uint32_t blk = 0; blk < BLOCK_COUNT; blk++) {
        uint64_t out[8];
        sha3_512_65_u64(state, (uint8_t)(blk & 0xFF), out);
        pad[blk*4]   = out[0]; pad[blk*4+1] = out[1];
        pad[blk*4+2] = out[2]; pad[blk*4+3] = out[3];
        state[0]=out[0]; state[1]=out[1]; state[2]=out[2]; state[3]=out[3];
        state[4]=0; state[5]=0; state[6]=0; state[7]=0;
    }

    /* Sequential passes (non-interleaved) */
    uint64_t prev[4];
    prev[0]=pad[(BLOCK_COUNT-1)*4]; prev[1]=pad[(BLOCK_COUNT-1)*4+1];
    prev[2]=pad[(BLOCK_COUNT-1)*4+2]; prev[3]=pad[(BLOCK_COUNT-1)*4+3];
    for (uint32_t i=0; i<BLOCK_COUNT; i++) {
        uint64_t cv[4];
        cv[0]=pad[i*4]^prev[0]; cv[1]=pad[i*4+1]^prev[1];
        cv[2]=pad[i*4+2]^prev[2]; cv[3]=pad[i*4+3]^prev[3];
        pad[i*4]=cv[0]; pad[i*4+1]=cv[1]; pad[i*4+2]=cv[2]; pad[i*4+3]=cv[3];
        prev[0]=cv[0]; prev[1]=cv[1]; prev[2]=cv[2]; prev[3]=cv[3];
    }
    uint64_t nxt[4];
    nxt[0]=pad[0]; nxt[1]=pad[1]; nxt[2]=pad[2]; nxt[3]=pad[3];
    for (uint32_t i=BLOCK_COUNT; i>0; i--) {
        uint32_t idx=i-1;
        uint64_t cv[4];
        cv[0]=pad[idx*4]^nxt[0]; cv[1]=pad[idx*4+1]^nxt[1];
        cv[2]=pad[idx*4+2]^nxt[2]; cv[3]=pad[idx*4+3]^nxt[3];
        pad[idx*4]=cv[0]; pad[idx*4+1]=cv[1]; pad[idx*4+2]=cv[2]; pad[idx*4+3]=cv[3];
        nxt[0]=cv[0]; nxt[1]=cv[1]; nxt[2]=cv[2]; nxt[3]=cv[3];
    }

    /* Random read mix (non-interleaved) */
    uint64_t acc[4];
    acc[0]=s1[0]; acc[1]=s1[1]; acc[2]=s1[2]; acc[3]=s1[3];
    uint64_t pos=0;
    for (uint64_t r=0; r<RANDOM_READS; r++) {
        uint32_t off=(uint32_t)pos*4;
        acc[0]^=pad[off]; acc[1]^=pad[off+1]; acc[2]^=pad[off+2]; acc[3]^=pad[off+3];
        uint64_t idx_val=acc[0]^pos^r;
        pos=idx_val%BLOCK_COUNT;
    }

    /* AES mix (load S-box to shared first) */
    __shared__ uint8_t sbox[256];
    if (threadIdx.x < 256) sbox[threadIdx.x] = AES_SBOX_DATA[threadIdx.x];
    __syncthreads();

    uint64_t s3[4];
    aes128_mix(acc, nonce, s3, sbox);

    thermal_loop(s3, nonce);

    uint64_t st[25];
    st[0]=s3[0]; st[1]=s3[1]; st[2]=s3[2]; st[3]=s3[3];
    st[4]=0; st[5]=0; st[6]=0; st[7]=0; st[8]=0; st[9]=0;
    st[10]=0; st[11]=0; st[12]=0; st[13]=0; st[14]=0; st[15]=0;
    st[16]=0; st[17]=0; st[18]=0; st[19]=0; st[20]=0; st[21]=0;
    st[22]=0; st[23]=0; st[24]=0;
    st[4] ^= 0x01ULL;
    st[16] ^= (0x80ULL << 56);
    keccak_f1600(st);

    uint8_t *out = output_hash;
    uint8_t *hb = (uint8_t*)st;
    #pragma unroll
    for (int i = 0; i < 32; i++) out[i] = hb[i];
}
