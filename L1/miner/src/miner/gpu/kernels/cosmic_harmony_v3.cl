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
//   4. Scratchpad: 512 KiB/thread in global memory, batch limited to ~4096 when active
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
// Memory-hard scratchpad  (512 KiB per thread, in global memory)
// Mirrors Rust: cosmic-harmony/src/scratchpad.rs  memory_hard_transform()
// ============================================================================

#define CL_SCRATCHPAD_BYTES (512u * 1024u)  // 524288 bytes
#define CL_BLOCK_SIZE       64u
#define CL_BLOCK_COUNT      8192u           // SCRATCHPAD_BYTES / BLOCK_SIZE
#define CL_PASSES           4u
#define CL_RANDOM_READS     256u

// Step 1: deterministic SHA3-512 chain initialises all 8192 × 64B blocks.
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

// 4 sequential passes over the 8192-block scratchpad.
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
    const uint  memory_hard,          // 0 = legacy, 1 = scratchpad (height >= 100k)
    __global uchar* scratchpad_buf    // [global_size × CL_SCRATCHPAD_BYTES], ignored when memory_hard=0
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

    if (memory_hard) {
        // Height >= 100k: scratchpad phase between GoldenMatrix and CosmicFusion
        __global uchar* my_pad = scratchpad_buf + (ulong)tid * (ulong)CL_SCRATCHPAD_BYTES;
        ulong step4[8];
        cl_memory_hard_transform(step3, my_pad, step4);
        cosmic_fusion(step4, final_hash);
    } else {
        // Legacy: GoldenMatrix → CosmicFusion directly
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
