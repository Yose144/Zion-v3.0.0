// Cosmic Harmony v3 - OpenCL Kernel  (PERF-OPT: unrolled + vectorized)
// Pipeline: Keccak-256(88B) -> SHA3-512(32B) -> GoldenMatrix -> CosmicFusion -> 32B hash
//
// Pool verification:  hash[0..4] as u32-LE  <=  target_u32
//
// Optimisations vs baseline:
//   1. keccak_f1600 outer loop unrolled (#pragma unroll 4) - fast AMD JIT, low register pressure
//   2. Rho+Pi inlined (no PILN/ROTC table lookups, no loop)
//   3. Chi inlined per row macro (5 independent data-parallel rows)
//   4. Byte-to-word packing via LOAD_U64_LE macro (single instruction sequence)
//   5. Golden Matrix column sums unrolled
//   6. Build flags: -cl-mad-enable -cl-fast-relaxed-math (set on host side)
//   7. Default batch size bumped to 16M on host side

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
// Cosmic Fusion
// ============================================================================

void cosmic_fusion(const ulong *gm_words, uchar *output) {
    uchar state[64];
    #pragma unroll 8
    for (int i = 0; i < 8; i++) STORE_U64_LE(state, i*8, gm_words[i]);

    // XOR mask bytes (repeating pattern 0x74,0x9D,0x30,0x60)
    #define XM(i) ((i)%4==0?0x74:((i)%4==1?0x9D:((i)%4==2?0x30:0x60)))

    #pragma unroll 4
    for (int round = 0; round < 4; round++) {
        uchar kin[33];
        #pragma unroll 32
        for (int i = 0; i < 32; i++) kin[i] = state[i];
        kin[32] = (uchar)round;

        uchar intermediate[32];
        keccak256_bytes(kin, 33, intermediate);

        #pragma unroll 32
        for (int i = 0; i < 32; i++)
            state[i] = intermediate[i] ^ XM(i);
    }
    #undef XM

    sha3_512_trunc32(state, output);
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
    __global uchar* result_hash
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
    cosmic_fusion(step3, final_hash);

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
