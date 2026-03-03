// Cosmic Harmony v4 — CUDA Kernel
// Pipeline: Keccak256 → SHA3-512 → GoldenMatrix → MemoryHard → NPU Mixing → CosmicFusion
//
// CHV4_NPU_FORK_HEIGHT = 0: CHv4 (NPU Mixing) always active from genesis block 0.
// CHV3_MEMORY_HARD_FORK_HEIGHT = 0: Memory-hard scratchpad always active.

// ============================================================================
// Constants
// ============================================================================

__constant__ unsigned long long PHI_POWERS[16] = {
    0x9E3779B97F4A7C15ULL,  // PHI * 2^64
    0xC6EF3720A5F82D14ULL,
    0x93C467E37DB0C7A4ULL,
    0xD76AA478E8C7B756ULL,
    0xB7E15162E8F85F94ULL,
    0x8AED2A6ABF715880ULL,
    0xA8EDA8A6C43E3EF5ULL,
    0xC5D2460186F7233CULL,
    0xE6546B64A8E3F7BCULL,
    0xF7E294D5C7F82A8DULL,
    0xD8A4E5F6C9B7A8E3ULL,
    0xB9C5D6E7F8A9B0C1ULL,
    0xCAD6E7F8091A2B3CULL,
    0xDBE7F8091A2B3C4DULL,
    0xECF8091A2B3C4D5EULL,
    0xFD091A2B3C4D5E6FULL,
};

__constant__ unsigned long long KECCAK_RC[24] = {
    0x0000000000000001ULL, 0x0000000000008082ULL, 0x800000000000808AULL,
    0x8000000080008000ULL, 0x000000000000808BULL, 0x0000000080000001ULL,
    0x8000000080008081ULL, 0x8000000000008009ULL, 0x000000000000008AULL,
    0x0000000000000088ULL, 0x0000000080008009ULL, 0x000000008000000AULL,
    0x000000008000808BULL, 0x800000000000008BULL, 0x8000000000008089ULL,
    0x8000000000008003ULL, 0x8000000000008002ULL, 0x8000000000000080ULL,
    0x000000000000800AULL, 0x800000008000000AULL, 0x8000000080008081ULL,
    0x8000000000008080ULL, 0x0000000080000001ULL, 0x8000000080008008ULL,
};

__constant__ int KECCAK_PILN[24] = {
    10, 7, 11, 17, 18, 3, 5, 16, 8, 21, 24, 4,
    15, 23, 19, 13, 12, 2, 20, 14, 22, 9, 6, 1
};

__constant__ int KECCAK_ROTC[24] = {
    1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 2, 14,
    27, 41, 56, 8, 25, 43, 62, 18, 39, 61, 20, 44
};

// Memory-hard scratchpad constants (must match OpenCL kernel + Rust impl)
#define CUDA_BLOCK_SIZE      64
#define CUDA_BLOCK_COUNT     8192
#define CUDA_SCRATCHPAD_BYTES (CUDA_BLOCK_SIZE * CUDA_BLOCK_COUNT)  // 512 KiB per thread
#define CUDA_PASSES          4
#define CUDA_RANDOM_READS    256

// ============================================================================
// Helper Functions
// ============================================================================

extern "C" {

__device__ __forceinline__ unsigned long long rotl64(unsigned long long x, int n) {
    return (x << n) | (x >> (64 - n));
}

__device__ __forceinline__ unsigned long long load_u64_le(const unsigned char* p, int off) {
    unsigned long long v = 0;
    for (int b = 0; b < 8; b++) v |= ((unsigned long long)p[off + b]) << (b * 8);
    return v;
}

__device__ __forceinline__ void store_u64_le(unsigned char* p, int off, unsigned long long v) {
    for (int b = 0; b < 8; b++) p[off + b] = (unsigned char)(v >> (b * 8));
}

// ============================================================================
// Keccak-f[1600]
// ============================================================================

__device__ void keccak_f1600(unsigned long long *state) {
    unsigned long long bc[5];
    unsigned long long t;
    
    #pragma unroll
    for (int round = 0; round < 24; round++) {
        // Theta
        for (int i = 0; i < 5; i++) {
            bc[i] = state[i] ^ state[i + 5] ^ state[i + 10] ^ state[i + 15] ^ state[i + 20];
        }
        
        for (int i = 0; i < 5; i++) {
            t = bc[(i + 4) % 5] ^ rotl64(bc[(i + 1) % 5], 1);
            for (int j = 0; j < 25; j += 5) {
                state[j + i] ^= t;
            }
        }
        
        // Rho and Pi
        t = state[1];
        for (int i = 0; i < 24; i++) {
            int j = KECCAK_PILN[i];
            bc[0] = state[j];
            state[j] = rotl64(t, KECCAK_ROTC[i]);
            t = bc[0];
        }
        
        // Chi
        for (int j = 0; j < 25; j += 5) {
            for (int i = 0; i < 5; i++) {
                bc[i] = state[j + i];
            }
            for (int i = 0; i < 5; i++) {
                state[j + i] ^= (~bc[(i + 1) % 5]) & bc[(i + 2) % 5];
            }
        }
        
        // Iota
        state[0] ^= KECCAK_RC[round];
    }
}

// ============================================================================
// Hash Primitives
// ============================================================================

// Keccak-256: variable-length input (<=128B) → 32 bytes output
__device__ void keccak256_bytes(const unsigned char* input, int ilen, unsigned char* output) {
    unsigned long long state[25] = {0};
    for (int i = 0; i < ilen / 8; i++) state[i] ^= load_u64_le(input, i * 8);
    int wi = ilen / 8, bi = ilen % 8;
    state[wi] ^= ((unsigned long long)0x01) << (bi * 8);
    state[16]  ^= 0x8000000000000000ULL;
    keccak_f1600(state);
    for (int i = 0; i < 4; i++) store_u64_le(output, i * 8, state[i]);
}

// SHA3-512 of 32-byte input → 8 words (64 bytes)
__device__ void sha3_512_words32(const unsigned char* input32, unsigned long long* out8) {
    unsigned long long state[25] = {0};
    for (int i = 0; i < 4; i++) state[i] ^= load_u64_le(input32, i * 8);
    state[4] ^= 0x06ULL;
    state[8] ^= 0x8000000000000000ULL;
    keccak_f1600(state);
    for (int i = 0; i < 8; i++) out8[i] = state[i];
}

// SHA3-512 of state64[64] || counter[8LE] → 64 bytes (scratchpad init)
__device__ void sha3_512_state_counter(const unsigned char state64[64], unsigned long long ci, unsigned char out64[64]) {
    unsigned long long st[25] = {0};
    for (int i = 0; i < 8; i++) st[i] ^= load_u64_le(state64, i * 8);
    st[8] ^= ci;
    st[9] ^= 0x06ULL;
    st[8] ^= 0x8000000000000000ULL;
    keccak_f1600(st);
    for (int i = 0; i < 8; i++) store_u64_le(out64, i * 8, st[i]);
}

// Keccak-256 of a[64] || b[64] || r[8LE] → 32 bytes (random read mix)
__device__ void keccak256_136_mix(const unsigned char a[64], const unsigned char b[64], unsigned long long r, unsigned char out32[32]) {
    unsigned long long state[25] = {0};
    for (int i = 0; i < 8; i++) state[i]   ^= load_u64_le(a, i * 8);
    for (int i = 0; i < 8; i++) state[8+i] ^= load_u64_le(b, i * 8);
    state[16] ^= r;
    state[17] ^= 0x01ULL;
    state[16] ^= 0x8000000000000000ULL;
    keccak_f1600(state);
    for (int i = 0; i < 4; i++) store_u64_le(out32, i * 8, state[i]);
}

// SHA3-512 final for random read mix
__device__ void sha3_512_random_final(
    const unsigned char acc[64], const unsigned char* pad_start, const unsigned char* pad_end, unsigned char out64[64])
{
    unsigned long long st[25] = {0};
    for (int i = 0; i < 8; i++) st[i]   ^= load_u64_le(acc, i * 8);
    for (int i = 0; i < 8; i++) st[8+i] ^= load_u64_le(pad_start, i * 8);
    st[16] ^= load_u64_le(pad_end, 0);
    st[17] ^= 0x06ULL;
    st[17] ^= 0x8000000000000000ULL;
    keccak_f1600(st);
    for (int i = 0; i < 8; i++) store_u64_le(out64, i * 8, st[i]);
}

// ============================================================================
// Memory-Hard Scratchpad (must match OpenCL + Rust implementations)
// ============================================================================

__device__ void cuda_init_scratchpad(unsigned char* pad, const unsigned char seed[64]) {
    unsigned char state[64];
    for (int i = 0; i < 64; i++) state[i] = seed[i];
    for (unsigned int ci = 0; ci < CUDA_BLOCK_COUNT; ci++) {
        unsigned char block[64];
        sha3_512_state_counter(state, (unsigned long long)ci, block);
        unsigned int off = ci * CUDA_BLOCK_SIZE;
        for (int j = 0; j < 64; j++) { pad[off + j] = block[j]; state[j] = block[j]; }
    }
}

__device__ void cuda_mix_block(unsigned char* pad,
    unsigned long long cur_off, unsigned long long prev_off, unsigned long long rand_off,
    unsigned long long pass_val, unsigned long long index_val)
{
    unsigned long long st[25] = {0};
    for (int i = 0; i < 8; i++) st[i]   ^= load_u64_le(pad, (int)(cur_off + i*8));
    st[8] ^= load_u64_le(pad, (int)prev_off);
    keccak_f1600(st);
    for (int i = 1; i < 8; i++) st[i-1] ^= load_u64_le(pad, (int)(prev_off + i*8));
    st[7] ^= load_u64_le(pad, (int)rand_off);
    st[8] ^= load_u64_le(pad, (int)(rand_off + 8));
    keccak_f1600(st);
    for (int i = 2; i < 8; i++) st[i-2] ^= load_u64_le(pad, (int)(rand_off + i*8));
    st[6] ^= pass_val; st[7] ^= index_val;
    st[8] ^= 0x8000000000000006ULL;
    keccak_f1600(st);
    for (int j = 0; j < 8; j++) {
        unsigned long long result = load_u64_le(pad, (int)(cur_off + j*8)) ^ st[j];
        store_u64_le(pad, (int)(cur_off + j*8), result);
    }
}

__device__ void cuda_sequential_passes(unsigned char* pad) {
    for (unsigned int pass = 0; pass < CUDA_PASSES; pass++) {
        if ((pass & 1u) == 0u) {
            for (unsigned long long i = 0; i < CUDA_BLOCK_COUNT; i++) {
                unsigned long long cur  = i * CUDA_BLOCK_SIZE;
                unsigned long long prev = (i == 0 ? (unsigned long long)(CUDA_BLOCK_COUNT-1) : (i-1)) * CUDA_BLOCK_SIZE;
                unsigned long long idx  = load_u64_le(pad, (int)cur);
                unsigned long long ri   = (idx ^ (unsigned long long)pass ^ i) % CUDA_BLOCK_COUNT;
                cuda_mix_block(pad, cur, prev, ri * CUDA_BLOCK_SIZE, (unsigned long long)pass, i);
            }
        } else {
            for (long ic = (long)(CUDA_BLOCK_COUNT-1); ic >= 0; ic--) {
                unsigned long long i    = (unsigned long long)ic;
                unsigned long long cur  = i * CUDA_BLOCK_SIZE;
                unsigned long long next = (i+1 == CUDA_BLOCK_COUNT) ? 0ULL : (i+1);
                unsigned long long prev = next * CUDA_BLOCK_SIZE;
                unsigned long long idx  = load_u64_le(pad, (int)cur);
                unsigned long long ri   = (idx ^ (unsigned long long)pass ^ i) % CUDA_BLOCK_COUNT;
                cuda_mix_block(pad, cur, prev, ri * CUDA_BLOCK_SIZE, (unsigned long long)pass, i);
            }
        }
    }
}

__device__ void cuda_random_read_mix(const unsigned char seed[64], const unsigned char* pad, unsigned char out64[64]) {
    unsigned char acc[64];
    for (int i = 0; i < 64; i++) acc[i] = seed[i];
    unsigned long long pos = load_u64_le(seed, 0) % CUDA_BLOCK_COUNT;
    for (unsigned int r = 0; r < CUDA_RANDOM_READS; r++) {
        unsigned long long chunk_off = pos * CUDA_BLOCK_SIZE;
        unsigned char chunk[64];
        for (int j = 0; j < 64; j++) chunk[j] = pad[chunk_off + j];
        unsigned char d[32];
        keccak256_136_mix(acc, chunk, (unsigned long long)r, d);
        for (int i = 0; i < 32; i++) acc[i]    ^= d[i];
        for (int i = 0; i < 32; i++) acc[32+i] = (unsigned char)(acc[32+i] + d[i]);
        pos = (load_u64_le(d, 0) ^ pos ^ (unsigned long long)r) % CUDA_BLOCK_COUNT;
    }
    sha3_512_random_final(acc, pad, pad + (CUDA_SCRATCHPAD_BYTES - CUDA_BLOCK_SIZE), out64);
}

__device__ void cuda_memory_hard_transform(const unsigned long long gm_words[8], unsigned char* pad, unsigned long long out_words[8]) {
    unsigned char seed[64];
    for (int i = 0; i < 8; i++) store_u64_le(seed, i * 8, gm_words[i]);
    cuda_init_scratchpad(pad, seed);
    cuda_sequential_passes(pad);
    unsigned char result[64];
    cuda_random_read_mix(seed, pad, result);
    for (int i = 0; i < 8; i++) out_words[i] = load_u64_le(result, i * 8);
}

// ============================================================================
// Golden Matrix
// ============================================================================

__device__ void golden_matrix(unsigned long long* state) {
    for (int i = 0; i < 8; i++) {
        unsigned long long phi = PHI_POWERS[i % 16];
        state[i] = state[i] ^ (state[(i+1)%8] * phi);
        state[i] = rotl64(state[i], (i * 7) % 64);
    }
    for (int round = 0; round < 4; round++) {
        for (int i = 0; i < 8; i++) {
            state[i] ^= rotl64(state[(i+3)%8], 17);
            state[i] += state[(i+5)%8];
        }
    }
}

// ============================================================================
// Cosmic Fusion
// ============================================================================

__device__ void cosmic_fusion(unsigned long long* state, unsigned char* output) {
    for (int round = 0; round < 8; round++) {
        unsigned long long phi = PHI_POWERS[round];
        for (int i = 0; i < 8; i++) {
            state[i] += state[(i+1)%8];
            state[i] = rotl64(state[i], 13);
            state[i] ^= phi;
            state[i] ^= (state[(i+4)%8] >> 7);
            state[(i+2)%8] += state[i];
        }
    }
    for (int i = 0; i < 8; i++) store_u64_le(output, i * 8, state[i]);
}

// ============================================================================
// CHv4 NPU Mixing Step — INT8 MLP 64->128->64 + residual
// Mirrors Rust: algorithms_npu.rs :: npu_mixing_cpu_int8()
// Active from genesis (CHV4_NPU_FORK_HEIGHT=0)
// ============================================================================

__device__ int gelu_int8_npu(int x) {
    int v = (x * (128 + x)) >> 8;
    if (v < -128) v = -128;
    if (v >  127) v =  127;
    return v;
}

__device__ void layer_norm_int8_npu(int* data, int n, const short* scale) {
    long long sum = 0;
    for (int i = 0; i < n; i++) sum += data[i];
    int mean = (int)(sum / n);
    long long var_sum = 0;
    for (int i = 0; i < n; i++) { long long d = data[i] - mean; var_sum += d * d; }
    int std_approx = (int)sqrtf((float)(var_sum / n)) + 1;
    for (int i = 0; i < n; i++) {
        int norm = ((data[i] - mean) * 128) / std_approx;
        data[i] = (norm * (int)scale[i]) >> 8;
        if (data[i] < -128) data[i] = -128;
        if (data[i] >  127) data[i] =  127;
    }
}

__device__ void npu_mixing_words(
    const unsigned long long inp_words[8], unsigned long long out_words[8],
    const char* w1, const char* b1, const char* w2, const char* b2,
    const short* scale1, const short* scale2)
{
    int input_i32[64];
    for (int i = 0; i < 8; i++)
        for (int b = 0; b < 8; b++)
            input_i32[i*8+b] = (int)((unsigned char)(inp_words[i] >> (b*8))) - 128;

    int hidden[128];
    for (int i = 0; i < 128; i++) {
        int acc = (int)b1[i] * 32;
        for (int j = 0; j < 64; j++) acc += input_i32[j] * (int)w1[i*64+j];
        hidden[i] = acc >> 12;
        if (hidden[i] < -128) hidden[i] = -128;
        if (hidden[i] >  127) hidden[i] =  127;
    }
    layer_norm_int8_npu(hidden, 128, scale1);
    for (int i = 0; i < 128; i++) hidden[i] = gelu_int8_npu(hidden[i]);

    int output_i32[64];
    for (int i = 0; i < 64; i++) {
        int acc = (int)b2[i] * 32;
        for (int j = 0; j < 128; j++) acc += hidden[j] * (int)w2[i*128+j];
        output_i32[i] = acc >> 12;
        if (output_i32[i] < -128) output_i32[i] = -128;
        if (output_i32[i] >  127) output_i32[i] =  127;
    }
    layer_norm_int8_npu(output_i32, 64, scale2);

    for (int i = 0; i < 8; i++) {
        out_words[i] = 0;
        for (int b = 0; b < 8; b++) {
            int v = output_i32[i*8+b] + input_i32[i*8+b];
            if (v < -128) v = -128;
            if (v >  127) v =  127;
            out_words[i] |= ((unsigned long long)((unsigned char)(v + 128))) << (b * 8);
        }
    }
}

// ============================================================================
// Main Kernel — CHv4 full pipeline
// ============================================================================

__global__ void cosmic_harmony_v3_mine(
    const unsigned char* __restrict__ header,
    unsigned int header_len,
    unsigned long long start_nonce,
    unsigned int target_u32,              // LE state0 low 4 bytes (pool target)
    unsigned long long* __restrict__ results,
    unsigned int* __restrict__ result_count,
    unsigned char* __restrict__ result_hash,
    unsigned int memory_hard,             // 1 = always (CHV3_MEMORY_HARD_FORK_HEIGHT=0)
    unsigned char* __restrict__ scratchpad_buf, // per-thread 512 KiB
    unsigned int chv4,                    // 1 = always (CHV4_NPU_FORK_HEIGHT=0)
    const char*  __restrict__ npu_w1,     // [128*64] int8
    const char*  __restrict__ npu_b1,     // [128]    int8
    const char*  __restrict__ npu_w2,     // [64*128] int8
    const char*  __restrict__ npu_b2,     // [64]     int8
    const short* __restrict__ npu_scale1, // [128]    int16
    const short* __restrict__ npu_scale2  // [64]     int16
) {
    unsigned int tid = blockIdx.x * blockDim.x + threadIdx.x;
    unsigned long long nonce = start_nonce + (unsigned long long)tid;

    unsigned char input[88];
    unsigned int clen = (header_len < 80u) ? header_len : 80u;
    for (unsigned int i = 0; i < 80; i++) input[i] = (i < clen) ? header[i] : 0;
    for (int i = 0; i < 8; i++) input[80+i] = (unsigned char)(nonce >> (i*8));

    // Step 1: Keccak-256
    unsigned char step1[32];
    keccak256_bytes(input, 88, step1);

    // Step 2: SHA3-512
    unsigned long long step2[8];
    sha3_512_words32(step1, step2);

    // Step 3: Golden Matrix
    golden_matrix(step2);

    unsigned char final_hash[32] = {0};

    if (chv4 && memory_hard) {
        // CHv4: MemoryHard -> NPU Mixing -> CosmicFusion
        unsigned char* my_pad = scratchpad_buf + (unsigned long long)tid * CUDA_SCRATCHPAD_BYTES;
        unsigned long long step4[8];
        cuda_memory_hard_transform(step2, my_pad, step4);
        unsigned long long step5[8];
        npu_mixing_words(step4, step5, npu_w1, npu_b1, npu_w2, npu_b2, npu_scale1, npu_scale2);
        cosmic_fusion(step5, final_hash);
    } else if (memory_hard) {
        // CHv3: MemoryHard -> CosmicFusion
        unsigned char* my_pad = scratchpad_buf + (unsigned long long)tid * CUDA_SCRATCHPAD_BYTES;
        unsigned long long step4[8];
        cuda_memory_hard_transform(step2, my_pad, step4);
        cosmic_fusion(step4, final_hash);
    } else {
        // Legacy (unreachable: CHV3_MEMORY_HARD_FORK_HEIGHT=0)
        cosmic_fusion(step2, final_hash);
    }

    unsigned int state0 = (unsigned int)final_hash[0]
                        | ((unsigned int)final_hash[1] <<  8)
                        | ((unsigned int)final_hash[2] << 16)
                        | ((unsigned int)final_hash[3] << 24);

    if (state0 <= target_u32) {
        if (atomicExch(result_count, 1u) == 0u) {
            results[0] = 1;
            results[1] = nonce;
            for (int i = 0; i < 32; i++) result_hash[i] = final_hash[i];

} // extern "C"
