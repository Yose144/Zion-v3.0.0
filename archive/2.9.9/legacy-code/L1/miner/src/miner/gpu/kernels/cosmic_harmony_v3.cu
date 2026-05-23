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
#define CUDA_BLOCK_COUNT     4096
#define CUDA_SCRATCHPAD_BYTES (CUDA_BLOCK_SIZE * CUDA_BLOCK_COUNT)  // 256 KiB per thread
#define CUDA_PASSES          4
#define CUDA_RANDOM_READS    256

// CHv4.2 Merkabah Dual-Spin constants
#define CUDA_BACKWARD_PASSES 2           // Ra — backward passes
#define CUDA_KABALA_READS    22          // 22 poles of consciousness
#define CUDA_KEY_ROUNDS      22          // 22-round key schedule

__constant__ unsigned long long CUDA_HIC[22] = {
    0x9E3779B97F4A7C15ULL, 0x6C62272E07BB0142ULL, 0x94D049BB133111EBULL,
    0xBF58476D1CE4E5B9ULL, 0x94D049BB133111EBULL, 0x6C62272E07BB0142ULL,
    0x9E3779B97F4A7C15ULL, 0x517CC1B727220A95ULL, 0xBB67AE8584CAA73BULL,
    0x3C6EF372FE94F82BULL, 0xA54FF53A5F1D36F1ULL, 0x510E527FADE682D1ULL,
    0x9B05688C2B3E6C1FULL, 0x1F83D9ABFB41BD6BULL, 0x5BE0CD19137E2179ULL,
    0xCBBB9D5DC1059ED8ULL, 0x629A292A367CD507ULL, 0x9159015A3070DD17ULL,
    0x152FECD8F70E5939ULL, 0x67332667FFC00B31ULL, 0x8EB44A8768581511ULL,
    0xDB0C2E0D64F98FA7ULL,
};

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
// AES-128 software implementation (FIPS 197)
// Matches Rust aes::Aes128 + C native cosmic_harmony_v4_native.c
// ============================================================================

__device__ static const unsigned char GPU_AES_SBOX[256] = {
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
__device__ static const unsigned char GPU_AES_RCON[11] = {
    0x00,0x01,0x02,0x04,0x08,0x10,0x20,0x40,0x80,0x1b,0x36
};
__device__ unsigned char gpu_aes_mul(unsigned char a, unsigned char b) {
    unsigned char p = 0;
    for (int i = 0; i < 8; i++) {
        if (b & 1) p ^= a;
        unsigned char hi = (a >> 7) & 1;
        a = (unsigned char)((a << 1) ^ (hi ? 0x1b : 0x00));
        b >>= 1;
    }
    return p;
}
__device__ void gpu_aes128_key_expand(const unsigned char key[16], unsigned char rk[176]) {
    for (int i = 0; i < 16; i++) rk[i] = key[i];
    for (int i = 4; i < 44; i++) {
        unsigned char tmp[4];
        for (int j = 0; j < 4; j++) tmp[j] = rk[(i-1)*4+j];
        if (i % 4 == 0) {
            unsigned char t = tmp[0]; tmp[0]=tmp[1]; tmp[1]=tmp[2]; tmp[2]=tmp[3]; tmp[3]=t;
            for (int j = 0; j < 4; j++) tmp[j] = GPU_AES_SBOX[tmp[j]];
            tmp[0] ^= GPU_AES_RCON[i/4];
        }
        for (int j = 0; j < 4; j++) rk[i*4+j] = rk[(i-4)*4+j] ^ tmp[j];
    }
}
__device__ void gpu_aes128_encrypt_block(const unsigned char rk[176], unsigned char blk[16]) {
    unsigned char s[16], t[16];
    for (int i = 0; i < 16; i++) s[i] = blk[i] ^ rk[i];
    for (int round = 1; round <= 10; round++) {
        for (int i = 0; i < 16; i++) s[i] = GPU_AES_SBOX[s[i]];
        t[0]=s[0];t[1]=s[5];t[2]=s[10];t[3]=s[15];
        t[4]=s[4];t[5]=s[9];t[6]=s[14];t[7]=s[3];
        t[8]=s[8];t[9]=s[13];t[10]=s[2];t[11]=s[7];
        t[12]=s[12];t[13]=s[1];t[14]=s[6];t[15]=s[11];
        if (round < 10) {
            for (int col = 0; col < 4; col++) {
                unsigned char *c = t + col*4;
                unsigned char a0=c[0],a1=c[1],a2=c[2],a3=c[3];
                c[0]=gpu_aes_mul(a0,2)^gpu_aes_mul(a1,3)^a2^a3;
                c[1]=a0^gpu_aes_mul(a1,2)^gpu_aes_mul(a2,3)^a3;
                c[2]=a0^a1^gpu_aes_mul(a2,2)^gpu_aes_mul(a3,3);
                c[3]=gpu_aes_mul(a0,3)^a1^a2^gpu_aes_mul(a3,2);
            }
        }
        for (int i = 0; i < 16; i++) s[i] = t[i] ^ rk[round*16+i];
    }
    for (int i = 0; i < 16; i++) blk[i] = s[i];
}
__device__ void fusion_round_cuda(unsigned char state[64], unsigned char round_num) {
    unsigned char kin[33];
    for (int i = 0; i < 32; i++) kin[i] = state[i];
    kin[32] = round_num;
    unsigned char intermediate[32];
    keccak256_bytes(kin, 33, intermediate);
    unsigned char rk[176];
    gpu_aes128_key_expand(intermediate, rk);
    unsigned char block0[16];
    for (int i = 0; i < 16; i++) block0[i] = state[32+i];
    gpu_aes128_encrypt_block(rk, block0);
    unsigned char key2[16];
    for (int i = 0; i < 16; i++) key2[i] = intermediate[i];
    key2[0] ^= round_num; key2[15] ^= (unsigned char)0xAB;
    unsigned char rk2[176];
    gpu_aes128_key_expand(key2, rk2);
    unsigned char block1[16];
    for (int i = 0; i < 16; i++) block1[i] = state[48+i];
    gpu_aes128_encrypt_block(rk2, block1);
    for (int i = 0; i < 32; i++) state[32+i] ^= intermediate[i];
    for (int i = 0; i < 16; i++) state[i]    = intermediate[i]    ^ block0[i];
    for (int i = 0; i < 16; i++) state[16+i] = intermediate[16+i] ^ block1[i];
}

// ============================================================================
// Cosmic Fusion — AES-128 (matches Rust fusion_round + C cosmic_harmony_v4_native)
// ============================================================================

__device__ void cosmic_fusion(unsigned long long* words_in, unsigned char* output) {
    unsigned char state[64];
    for (int i = 0; i < 8; i++) store_u64_le(state, i*8, words_in[i]);
    for (int r = 0; r < 4; r++) fusion_round_cuda(state, (unsigned char)r);
    // Final SHA3-512(state[0..32]) -> first 32 bytes
    unsigned long long sha3_out[8];
    sha3_512_words32(state, sha3_out);
    for (int i = 0; i < 4; i++) store_u64_le(output, i*8, sha3_out[i]);
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
            input_i32[i*8+b] = (int)(signed char)(unsigned char)(inp_words[i] >> (b*8));

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
            out_words[i] |= ((unsigned long long)(unsigned char)(v)) << (b * 8);
        }
    }
}

// ============================================================================
// CHv4.2 Merkabah Dual-Spin — GPU helper functions
// ============================================================================

// Phase 3: Merkabah backward passes (2×, direction = Ra-spin)
__device__ void cuda_merkabah_backward_passes(unsigned char* pad) {
    unsigned long long n = (unsigned long long)(CUDA_SCRATCHPAD_BYTES / 64);
    for (int pass = 0; pass < CUDA_BACKWARD_PASSES; pass++) {
        for (unsigned long long bi = n; bi-- > 0; ) {
            unsigned char* blk = pad + bi * 64;
            unsigned long long idx_hic = bi % 22;
            unsigned long long hval = CUDA_HIC[idx_hic];
            for (int b = 0; b < 8; b++) {
                unsigned long long prev_idx = ((bi == 0 ? n - 1 : bi - 1)) % n;
                unsigned char* prev_blk = pad + prev_idx * 64;
                unsigned long long pv;
                pv  = (unsigned long long)prev_blk[b*8+0];
                pv |= (unsigned long long)prev_blk[b*8+1] << 8;
                pv |= (unsigned long long)prev_blk[b*8+2] << 16;
                pv |= (unsigned long long)prev_blk[b*8+3] << 24;
                pv |= (unsigned long long)prev_blk[b*8+4] << 32;
                pv |= (unsigned long long)prev_blk[b*8+5] << 40;
                pv |= (unsigned long long)prev_blk[b*8+6] << 48;
                pv |= (unsigned long long)prev_blk[b*8+7] << 56;
                unsigned long long cv;
                cv  = (unsigned long long)blk[b*8+0];
                cv |= (unsigned long long)blk[b*8+1] << 8;
                cv |= (unsigned long long)blk[b*8+2] << 16;
                cv |= (unsigned long long)blk[b*8+3] << 24;
                cv |= (unsigned long long)blk[b*8+4] << 32;
                cv |= (unsigned long long)blk[b*8+5] << 40;
                cv |= (unsigned long long)blk[b*8+6] << 48;
                cv |= (unsigned long long)blk[b*8+7] << 56;
                unsigned long long out = cv ^ pv ^ hval;
                out = rotl64(out, (int)(hval & 63));
                for (int bb = 0; bb < 8; bb++) blk[b*8+bb] = (unsigned char)(out >> (bb*8));
            }
        }
    }
}

// Phase 5: Kabala phase — 22 HIC-indexed scratchpad reads into state
__device__ void cuda_kabala_phase(const unsigned char* pad, unsigned long long state[8]) {
    unsigned long long n = (unsigned long long)(CUDA_SCRATCHPAD_BYTES / 64);
    for (int i = 0; i < 22; i++) {
        unsigned long long hval = CUDA_HIC[i];
        unsigned long long idx = (state[i % 8] ^ hval) % n;
        const unsigned char* blk = pad + idx * 64;
        for (int j = 0; j < 8; j++) {
            unsigned long long v;
            v  = (unsigned long long)blk[j*8+0];
            v |= (unsigned long long)blk[j*8+1] << 8;
            v |= (unsigned long long)blk[j*8+2] << 16;
            v |= (unsigned long long)blk[j*8+3] << 24;
            v |= (unsigned long long)blk[j*8+4] << 32;
            v |= (unsigned long long)blk[j*8+5] << 40;
            v |= (unsigned long long)blk[j*8+6] << 48;
            v |= (unsigned long long)blk[j*8+7] << 56;
            state[j % 8] ^= v ^ hval;
            state[j % 8] = rotl64(state[j % 8], 17);
        }
    }
}

// Phase 6: Brahma-jyoti finalize — 22× Keccak-256 mixing with HIC, produce 32-byte hash
__device__ void cuda_brahma_jyoti_finalize(const unsigned long long state_in[8], unsigned char out32[32]) {
    unsigned char buf[72];
    for (int i = 0; i < 8; i++) {
        unsigned long long v = state_in[i];
        for (int b = 0; b < 8; b++) buf[i*8+b] = (unsigned char)(v >> (b*8));
    }
    unsigned char h[32];
    keccak256_bytes(buf, 64, h);
    for (int r = 0; r < 22; r++) {
        unsigned long long hval = CUDA_HIC[r];
        // Mix HIC into hash
        for (int b = 0; b < 8; b++) {
            h[b]    ^= (unsigned char)(hval >> (b*8));
            h[8+b]  ^= (unsigned char)(hval >> ((7-b)*8));
        }
        keccak256_bytes(h, 32, h);
    }
    for (int i = 0; i < 32; i++) out32[i] = h[i];
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
    unsigned char* __restrict__ scratchpad_buf, // per-thread 64 KiB
    unsigned int chv4,                    // 1 = always (CHV4_NPU_FORK_HEIGHT=0)
    const char*  __restrict__ npu_w1,     // [128*64] int8
    const char*  __restrict__ npu_b1,     // [128]    int8
    const char*  __restrict__ npu_w2,     // [64*128] int8
    const char*  __restrict__ npu_b2,     // [64]     int8
    const short* __restrict__ npu_scale1, // [128]    int16
    const short* __restrict__ npu_scale2, // [64]     int16
    unsigned int chv4_2                   // 1 = CHv4.2 Merkabah Dual-Spin
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

    if (chv4_2 && memory_hard) {
        // CHv4.2 Merkabah Dual-Spin
        unsigned char* my_pad = scratchpad_buf + (unsigned long long)tid * CUDA_SCRATCHPAD_BYTES;
        unsigned long long step4[8];
        cuda_memory_hard_transform(step2, my_pad, step4);
        unsigned long long step5[8];
        npu_mixing_words(step4, step5, npu_w1, npu_b1, npu_w2, npu_b2, npu_scale1, npu_scale2);
        cuda_merkabah_backward_passes(my_pad);
        unsigned long long kab_state[8];
        for (int i = 0; i < 8; i++) kab_state[i] = step5[i];
        cuda_kabala_phase(my_pad, kab_state);
        cuda_brahma_jyoti_finalize(kab_state, final_hash);
    } else if (chv4 && memory_hard) {
        // CHv4.1: MemoryHard -> NPU Mixing -> CosmicFusion
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
