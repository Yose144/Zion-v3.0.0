/*
 * ZION Cosmic Harmony v4 - Metal GPU Compute Shader
 *
 * Native GPU acceleration for Apple Silicon (M1-M5), version 2.9.7.
 * Implements full CHv4 pipeline on GPU:
 *   Keccak-256 → SHA3-512 → Golden Matrix
 *   → Memory-Hard Scratchpad (256 KiB/thread)
 *   → NPU Mixing (INT8 MLP 64→128→64 + residual)
 *   → Cosmic Fusion
 *
 * CHV4_NPU_FORK_HEIGHT = 0: CHv4 always active from genesis block 0.
 * Mirrors Rust: algorithms_opt.rs :: cosmic_harmony_with_height()
 *               scratchpad.rs    :: memory_hard_transform()
 *               algorithms_npu.rs:: npu_mixing_cpu_int8()
 *
 * Author: ZION AI Native Team
 * Version: 2.9.7
 * Date: March 2026
 */

#include <metal_stdlib>
using namespace metal;

// ============================================================================
// Constants
// ============================================================================

void metal_random_read_mix(
    thread const uint8_t seed[64],
    device const uint8_t* pad,
    thread uint8_t output[64]
);

void metal_npu_mixing(
    thread const uint8_t input[64],
    thread uint8_t output[64],
    device const char*  npu_w1,
    device const char*  npu_b1,
    device const char*  npu_w2,
    device const char*  npu_b2,
    device const short* npu_scale1,
    device const short* npu_scale2
);

// Keccak round constants (24 rounds)
constant uint64_t KECCAK_RC[24] = {
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
    0x0000000080000001ULL, 0x8000000080008008ULL
};

// Keccak rotation offsets
constant int KECCAK_ROTC[24] = {
    1,  3,  6,  10, 15, 21, 28, 36,
    45, 55, 2,  14, 27, 41, 56, 8,
    25, 43, 62, 18, 39, 61, 20, 44
};

// Keccak pi lane indices
constant int KECCAK_PILN[24] = {
    10, 7,  11, 17, 18, 3,  5,  16,
    8,  21, 24, 4,  15, 23, 19, 13,
    12, 2,  20, 14, 22, 9,  6,  1
};

// Fixed-point golden ratio powers: PHI^n * 2^32
constant uint64_t PHI_POWERS_FP[16] = {
    4294967296ULL,
    6949403065ULL,
    11244370361ULL,
    18193773427ULL,
    29438143788ULL,
    47631917215ULL,
    77070061004ULL,
    124701978219ULL,
    201772039223ULL,
    326474017443ULL,
    528246056666ULL,
    854720074109ULL,
    1382966130776ULL,
    2237686204885ULL,
    3620652335660ULL,
    5858338540545ULL
};

// ============================================================================
// AES-128 constants — software AES matching Rust 'aes' crate (NIST AES-128-ECB)
// Required for cosmic_fusion_gpu to produce data-dependent mask (Haraka-inspired)
// ============================================================================
constant uint8_t AES_SBOX[256] = {
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
constant uint8_t AES_RCON[10] = { 0x01,0x02,0x04,0x08,0x10,0x20,0x40,0x80,0x1b,0x36 };

// ============================================================================
// Helper: rotl64
// ============================================================================

inline uint64_t rotl64(uint64_t x, int n) {
    return (x << n) | (x >> (64 - n));
}

inline uint64_t load_le_u64_thread(thread const uint8_t *src) {
    uint64_t word = 0;
    for (int j = 0; j < 8; j++) {
        word |= uint64_t(src[j]) << (j * 8);
    }
    return word;
}

inline uint64_t load_le_u64_device(device const uint8_t *src) {
    uint64_t word = 0;
    for (int j = 0; j < 8; j++) {
        word |= uint64_t(src[j]) << (j * 8);
    }
    return word;
}

inline void store_hash32_from_state(thread const uint64_t *state, thread uint8_t *output) {
    for (int i = 0; i < 4; i++) {
        for (int j = 0; j < 8; j++) {
            output[i * 8 + j] = uint8_t(state[i] >> (j * 8));
        }
    }
}

inline void store_hash64_from_state(thread const uint64_t *state, thread uint8_t *output) {
    for (int i = 0; i < 8; i++) {
        for (int j = 0; j < 8; j++) {
            output[i * 8 + j] = uint8_t(state[i] >> (j * 8));
        }
    }
}

// ============================================================================
// Keccak-f[1600] Permutation (24 rounds) — thread-local
// ============================================================================

void keccak_f1600(thread uint64_t *state) {
    uint64_t bc[5];
    uint64_t t;
    
    for (int round = 0; round < 24; round++) {
        // θ step
        for (int i = 0; i < 5; i++) {
            bc[i] = state[i] ^ state[i + 5] ^ state[i + 10] ^ state[i + 15] ^ state[i + 20];
        }
        for (int i = 0; i < 5; i++) {
            t = bc[(i + 4) % 5] ^ rotl64(bc[(i + 1) % 5], 1);
            for (int j = 0; j < 25; j += 5) {
                state[j + i] ^= t;
            }
        }
        
        // ρ and π steps
        t = state[1];
        for (int i = 0; i < 24; i++) {
            int j = KECCAK_PILN[i];
            bc[0] = state[j];
            state[j] = rotl64(t, KECCAK_ROTC[i]);
            t = bc[0];
        }
        
        // χ step
        for (int j = 0; j < 25; j += 5) {
            for (int i = 0; i < 5; i++) {
                bc[i] = state[j + i];
            }
            for (int i = 0; i < 5; i++) {
                state[j + i] ^= (~bc[(i + 1) % 5]) & bc[(i + 2) % 5];
            }
        }
        
        // ι step
        state[0] ^= KECCAK_RC[round];
    }
}

// ============================================================================
// Keccak-256 (padding 0x01)
// Rate = 136 bytes, output = 32 bytes
// ============================================================================

void keccak256_gpu(thread const uint8_t *input, int input_len, thread uint8_t *output) {
    uint64_t state[25];
    for (int i = 0; i < 25; i++) state[i] = 0;
    
    const int rate = 136;
    int offset = 0;
    
    // Absorb full blocks
    while (offset + rate <= input_len) {
        for (int i = 0; i < rate / 8; i++) {
            uint64_t word = 0;
            for (int j = 0; j < 8; j++) {
                word |= uint64_t(input[offset + i * 8 + j]) << (j * 8);
            }
            state[i] ^= word;
        }
        keccak_f1600(state);
        offset += rate;
    }
    
    // Absorb final block with Keccak padding
    uint8_t block[136];
    for (int i = 0; i < rate; i++) block[i] = 0;
    int remaining = input_len - offset;
    for (int i = 0; i < remaining; i++) {
        block[i] = input[offset + i];
    }
    block[remaining] = 0x01;
    block[rate - 1] |= 0x80;
    
    for (int i = 0; i < rate / 8; i++) {
        uint64_t word = 0;
        for (int j = 0; j < 8; j++) {
            word |= uint64_t(block[i * 8 + j]) << (j * 8);
        }
        state[i] ^= word;
    }
    keccak_f1600(state);
    
    // Squeeze 32 bytes
    store_hash32_from_state(state, output);
}

// Specialized Keccak-256 for fixed 88-byte input layout:
// header[0..80] (zero-padded to 80 bytes) || nonce_le[8].
// This avoids building a temporary 88-byte thread-local buffer on the hot path.
void keccak256_header_nonce_gpu(
    device const uint8_t *header,
    int header_len,
    uint64_t nonce,
    thread uint8_t *output
) {
    uint64_t state[25];
    for (int i = 0; i < 25; i++) state[i] = 0;

    uint8_t block[136];
    for (int i = 0; i < 136; i++) block[i] = 0;

    int h_len = min(header_len, 80);
    for (int i = 0; i < h_len; i++) block[i] = header[i];
    for (int b = 0; b < 8; b++) block[80 + b] = uint8_t(nonce >> (b * 8));
    block[88] = 0x01;
    block[135] |= 0x80;

    for (int i = 0; i < 17; i++) {
        uint64_t word = 0;
        for (int j = 0; j < 8; j++) {
            word |= uint64_t(block[i * 8 + j]) << (j * 8);
        }
        state[i] ^= word;
    }
    keccak_f1600(state);

    store_hash32_from_state(state, output);
}

// Specialized Keccak-256 for exact 33-byte input state32 || round_u8.
void keccak256_state32_round_gpu(
    thread const uint8_t *state32,
    uint8_t round_num,
    thread uint8_t *output
) {
    uint64_t state[25];
    for (int i = 0; i < 25; i++) state[i] = 0;

    uint8_t block[136];
    for (int i = 0; i < 136; i++) block[i] = 0;
    for (int i = 0; i < 32; i++) block[i] = state32[i];
    block[32] = round_num;
    block[33] = 0x01;
    block[135] |= 0x80;

    for (int i = 0; i < 17; i++) {
        uint64_t word = 0;
        for (int j = 0; j < 8; j++) {
            word |= uint64_t(block[i * 8 + j]) << (j * 8);
        }
        state[i] ^= word;
    }
    keccak_f1600(state);

    store_hash32_from_state(state, output);
}

// ============================================================================
// SHA3-512 (padding 0x06)
// Rate = 72 bytes, output = 64 bytes
// ============================================================================

void sha3_512_gpu(thread const uint8_t *input, int input_len, thread uint8_t *output) {
    uint64_t state[25];
    for (int i = 0; i < 25; i++) state[i] = 0;
    
    const int rate = 72;
    int offset = 0;
    
    // Absorb full blocks
    while (offset + rate <= input_len) {
        for (int i = 0; i < rate / 8; i++) {
            uint64_t word = 0;
            for (int j = 0; j < 8; j++) {
                word |= uint64_t(input[offset + i * 8 + j]) << (j * 8);
            }
            state[i] ^= word;
        }
        keccak_f1600(state);
        offset += rate;
    }
    
    // Final block with SHA3 padding
    uint8_t block[72];
    for (int i = 0; i < rate; i++) block[i] = 0;
    int remaining = input_len - offset;
    for (int i = 0; i < remaining; i++) {
        block[i] = input[offset + i];
    }
    block[remaining] = 0x06;
    block[rate - 1] |= 0x80;
    
    for (int i = 0; i < rate / 8; i++) {
        uint64_t word = 0;
        for (int j = 0; j < 8; j++) {
            word |= uint64_t(block[i * 8 + j]) << (j * 8);
        }
        state[i] ^= word;
    }
    keccak_f1600(state);
    
    // Squeeze 64 bytes
    store_hash64_from_state(state, output);
}

// Specialized SHA3-512 for 32-byte input.
// Used immediately after Keccak-256 in the main Deeksha pipeline.
void sha3_512_32_gpu(thread const uint8_t input[32], thread uint8_t *output) {
    uint64_t state[25];
    for (int i = 0; i < 25; i++) state[i] = 0;

    uint8_t block[72];
    for (int i = 0; i < 72; i++) block[i] = 0;
    for (int i = 0; i < 32; i++) block[i] = input[i];
    block[32] = 0x06;
    block[71] |= 0x80;

    for (int i = 0; i < 9; i++) {
        uint64_t word = 0;
        for (int j = 0; j < 8; j++) {
            word |= uint64_t(block[i * 8 + j]) << (j * 8);
        }
        state[i] ^= word;
    }
    keccak_f1600(state);

    store_hash64_from_state(state, output);
}

// Specialized SHA3-512 for exact 72-byte input state[64] || counter_le8.
void sha3_512_state_counter_gpu(
    thread const uint8_t state_bytes[64],
    uint64_t counter,
    thread uint8_t output[64]
) {
    uint64_t state[25];
    for (int i = 0; i < 25; i++) state[i] = 0;

    for (int i = 0; i < 8; i++) {
        state[i] ^= load_le_u64_thread(state_bytes + i * 8);
    }
    state[8] ^= counter;
    keccak_f1600(state);

    // Exact full-rate absorb means an empty padded block follows.
    state[0] ^= 0x06ULL;
    state[8] ^= 0x8000000000000000ULL;
    keccak_f1600(state);

    store_hash64_from_state(state, output);
}

// Specialized SHA3-512 for exact 208-byte input:
// cur[64] || prev[64] || rand[64] || pass_le8 || cur_idx_le8.
void sha3_512_mix_block_gpu(
    device const uint8_t* cur_blk,
    device const uint8_t* prev_blk,
    device const uint8_t* rand_blk,
    uint64_t pass64,
    uint64_t cur64,
    thread uint8_t output[64]
) {
    uint64_t state[25];
    for (int i = 0; i < 25; i++) state[i] = 0;

    // Block 1: cur[64] || prev[0..7]
    for (int i = 0; i < 8; i++) state[i] ^= load_le_u64_device(cur_blk + i * 8);
    state[8] ^= load_le_u64_device(prev_blk);
    keccak_f1600(state);

    // Block 2: prev[8..63] || rand[0..15]
    for (int i = 0; i < 7; i++) state[i] ^= load_le_u64_device(prev_blk + 8 + i * 8);
    state[7] ^= load_le_u64_device(rand_blk);
    state[8] ^= load_le_u64_device(rand_blk + 8);
    keccak_f1600(state);

    // Final block: rand[16..63] || pass64 || cur64 || padding
    for (int i = 0; i < 6; i++) state[i] ^= load_le_u64_device(rand_blk + 16 + i * 8);
    state[6] ^= pass64;
    state[7] ^= cur64;
    state[8] ^= 0x8000000000000006ULL;
    keccak_f1600(state);

    store_hash64_from_state(state, output);
}

// Specialized Keccak-256 for exact 136-byte input acc[64] || chunk[64] || round_le8.
void keccak256_acc_chunk_round_gpu(
    thread const uint8_t acc[64],
    device const uint8_t* blk,
    uint64_t round,
    thread uint8_t output[32]
) {
    uint64_t state[25];
    for (int i = 0; i < 25; i++) state[i] = 0;

    for (int i = 0; i < 8; i++) state[i] ^= load_le_u64_thread(acc + i * 8);
    for (int i = 0; i < 8; i++) state[8 + i] ^= load_le_u64_device(blk + i * 8);
    state[16] ^= round;
    keccak_f1600(state);

    // Exact full-rate absorb => final empty padded block.
    state[0] ^= 0x01ULL;
    state[16] ^= 0x8000000000000000ULL;
    keccak_f1600(state);

    store_hash32_from_state(state, output);
}

// Specialized SHA3-512 for exact 192-byte input acc[64] || first_blk[64] || last_blk[64].
void sha3_512_acc_edges_gpu(
    thread const uint8_t acc[64],
    device const uint8_t* first_blk,
    device const uint8_t* last_blk,
    thread uint8_t output[64]
) {
    uint64_t state[25];
    for (int i = 0; i < 25; i++) state[i] = 0;

    // Block 1: acc[64] || first[0..7]
    for (int i = 0; i < 8; i++) state[i] ^= load_le_u64_thread(acc + i * 8);
    state[8] ^= load_le_u64_device(first_blk);
    keccak_f1600(state);

    // Block 2: first[8..63] || last[0..15]
    for (int i = 0; i < 7; i++) state[i] ^= load_le_u64_device(first_blk + 8 + i * 8);
    state[7] ^= load_le_u64_device(last_blk);
    state[8] ^= load_le_u64_device(last_blk + 8);
    keccak_f1600(state);

    // Final block: last[16..63] || padding
    for (int i = 0; i < 6; i++) state[i] ^= load_le_u64_device(last_blk + 16 + i * 8);
    state[6] ^= 0x06ULL;
    state[8] ^= 0x8000000000000000ULL;
    keccak_f1600(state);

    store_hash64_from_state(state, output);
}

// ============================================================================
// Golden Matrix (fixed-point)
// ============================================================================

void golden_matrix_gpu(thread const uint8_t *input, thread uint8_t *output) {
    const int MATRIX_SIZE = 8;
    uint64_t matrix[8][8];
    uint64_t result[8];
    
    // Fill matrix from input bytes
    for (int i = 0; i < MATRIX_SIZE; i++) {
        int base = i * MATRIX_SIZE;
        for (int j = 0; j < MATRIX_SIZE; j++) {
            matrix[i][j] = uint64_t(input[(base + j) % 64]);
        }
    }
    
    // Apply golden ratio (fixed-point, matches Rust)
    // Note: Metal does not have 128-bit ints, so we use manual approach
    for (int i = 0; i < MATRIX_SIZE; i++) {
        // Since matrix values are 0-255 and PHI_POWERS_FP are < 2^43,
        // the product fits in 64 bits (8 bits + 43 bits = 51 bits)
        // The sum of 8 such products fits in ~54 bits → fits in uint64_t
        // But we need the shift-right-by-32 result, so we compute differently.
        
        // Split into high and low 32-bit parts for precision
        uint64_t sum_hi = 0;
        uint64_t sum_lo = 0;
        
        for (int j = 0; j < MATRIX_SIZE; j++) {
            uint64_t a = matrix[i][j]; // 0-255
            uint64_t b = PHI_POWERS_FP[i + j];
            
            // a * b: since a < 256 and b < 2^43, product < 2^51, fits in uint64_t
            uint64_t product = a * b;
            
            // Add to accumulator (need to handle potential overflow for sum)
            uint64_t old_lo = sum_lo;
            sum_lo += product;
            if (sum_lo < old_lo) sum_hi++; // carry
        }
        
        // Shift right by 32
        result[i] = (sum_lo >> 32) | (sum_hi << 32);
    }
    
    // Convert to LE bytes
    for (int i = 0; i < 8; i++) {
        uint64_t val = result[i];
        output[i * 8 + 0] = uint8_t(val >>  0);
        output[i * 8 + 1] = uint8_t(val >>  8);
        output[i * 8 + 2] = uint8_t(val >> 16);
        output[i * 8 + 3] = uint8_t(val >> 24);
        output[i * 8 + 4] = uint8_t(val >> 32);
        output[i * 8 + 5] = uint8_t(val >> 40);
        output[i * 8 + 6] = uint8_t(val >> 48);
        output[i * 8 + 7] = uint8_t(val >> 56);
    }
}

// ============================================================================
// AES-128 software implementation
// Matches Rust 'aes' crate encrypt_block() — NIST AES-128-ECB, standard byte order
// ============================================================================

// GF(2^8) multiply by 2 (xtime)
inline uint8_t aes_xtime(uint8_t b) {
    return (b << 1) ^ ((b & 0x80u) ? 0x1bu : 0x00u);
}

// Advance AES-128 round key in place.
// This avoids materializing the full 176-byte expanded key schedule per encrypt call.
void aes128_next_round_key(thread uint8_t rk[16], uint8_t rcon) {
    uint8_t t0 = AES_SBOX[rk[13]] ^ rcon;
    uint8_t t1 = AES_SBOX[rk[14]];
    uint8_t t2 = AES_SBOX[rk[15]];
    uint8_t t3 = AES_SBOX[rk[12]];

    rk[0] ^= t0;
    rk[1] ^= t1;
    rk[2] ^= t2;
    rk[3] ^= t3;

    for (int i = 4; i < 16; i++) rk[i] ^= rk[i - 4];
}

// AES ShiftRows (state stored column-major: index = col*4+row)
// Row r at indices r, r+4, r+8, r+12 — shift row r left by r
void aes_shift_rows(thread uint8_t s[16]) {
    uint8_t t;
    // Row 1: indices 1,5,9,13 — shift left 1
    t=s[1]; s[1]=s[5]; s[5]=s[9]; s[9]=s[13]; s[13]=t;
    // Row 2: indices 2,6,10,14 — shift left 2
    t=s[2]; s[2]=s[10]; s[10]=t;
    t=s[6]; s[6]=s[14]; s[14]=t;
    // Row 3: indices 3,7,11,15 — shift left 3 (= right 1)
    t=s[3]; s[3]=s[15]; s[15]=s[11]; s[11]=s[7]; s[7]=t;
}

// AES MixColumns for one column (4 bytes starting at c)
void aes_mix_column(thread uint8_t *c) {
    uint8_t s0=c[0], s1=c[1], s2=c[2], s3=c[3];
    c[0] = aes_xtime(s0) ^ aes_xtime(s1) ^ s1 ^ s2 ^ s3;
    c[1] = s0 ^ aes_xtime(s1) ^ aes_xtime(s2) ^ s2 ^ s3;
    c[2] = s0 ^ s1 ^ aes_xtime(s2) ^ aes_xtime(s3) ^ s3;
    c[3] = aes_xtime(s0) ^ s0 ^ s1 ^ s2 ^ aes_xtime(s3);
}

// AES-128 ECB encrypt one 16-byte block
// Matches Rust aes::Aes128::encrypt_block() exactly (NIST AES standard)
void aes128_encrypt(
    thread const uint8_t *key,
    thread const uint8_t *plaintext,
    thread uint8_t ciphertext[16]
) {
    uint8_t rk[16];
    for (int i = 0; i < 16; i++) rk[i] = key[i];

    // State: column-major, s[col*4+row] = byte[col*4+row]
    uint8_t s[16];
    // Initial AddRoundKey (round 0)
    for (int i = 0; i < 16; i++) s[i] = plaintext[i] ^ rk[i];

    // 9 main rounds
    for (int r = 0; r < 9; r++) {
        // SubBytes
        for (int i = 0; i < 16; i++) s[i] = AES_SBOX[s[i]];
        // ShiftRows
        aes_shift_rows(s);
        // MixColumns (4 columns, each 4 bytes)
        aes_mix_column(s +  0);
        aes_mix_column(s +  4);
        aes_mix_column(s +  8);
        aes_mix_column(s + 12);
        // AddRoundKey
        aes128_next_round_key(rk, AES_RCON[r]);
        for (int i = 0; i < 16; i++) s[i] ^= rk[i];
    }
    // Final round (no MixColumns)
    for (int i = 0; i < 16; i++) s[i] = AES_SBOX[s[i]];
    aes_shift_rows(s);
    aes128_next_round_key(rk, AES_RCON[9]);
    for (int i = 0; i < 16; i++) s[i] ^= rk[i];

    for (int i = 0; i < 16; i++) ciphertext[i] = s[i];
}

// ============================================================================
// Cosmic Fusion — Haraka-inspired (Keccak256 + AES mask + key evolution)
// Matches algorithms_opt.rs :: cosmic_fusion_opt / fusion_round EXACTLY
// ============================================================================

// Replicates Rust fusion_round(state, round):
//   intermediate = keccak256(state[0..32] || round)
//   block0 = AES128(key=intermediate[0..16], plaintext=state[32..48])
//   key2   = intermediate[0..16] with key2[0]^=round, key2[15]^=0xAB
//   block1 = AES128(key=key2,          plaintext=state[48..64])
//   mask[0..32] = block0 || block1
//   state[32..64] ^= intermediate[0..32]   (evolve upper half)
//   state[0..32]   = intermediate[0..32] ^ mask[0..32]
void fusion_round_gpu(thread uint8_t *state, uint8_t round_num) {
    // Step 1: intermediate = Keccak256(state[0..32] || round_num)
    uint8_t intermediate[32];
    keccak256_state32_round_gpu(state, round_num, intermediate);

    // Step 2: block0 = AES128(key=intermediate[0..16], plaintext=state[32..48])
    uint8_t block0_out[16];
    aes128_encrypt(intermediate, state + 32, block0_out);

    // Step 3: block1 = AES128(key=key2, plaintext=state[48..64])
    // key2 = intermediate[0..16] with key2[0] ^= round_num, key2[15] ^= 0xAB
    uint8_t key2[16];
    for (int i = 0; i < 16; i++) key2[i] = intermediate[i];
    key2[0]  ^= round_num;
    key2[15] ^= 0xABu;
    uint8_t block1_out[16];
    aes128_encrypt(key2, state + 48, block1_out);

    // Step 4: Evolve upper half + update lower half (matches CPU non-AVX2 path)
    for (int i = 0; i < 32; i++) state[32 + i] ^= intermediate[i];  // upper half evolve
    for (int i = 0; i < 16; i++) state[i]      = intermediate[i]      ^ block0_out[i];
    for (int i = 0; i < 16; i++) state[16 + i] = intermediate[16 + i] ^ block1_out[i];
}

void cosmic_fusion_gpu(thread const uint8_t *input, thread uint8_t *output) {
    uint8_t state[64];
    for (int i = 0; i < 64; i++) state[i] = input[i];
    
    // 4 fusion rounds
    fusion_round_gpu(state, 0);
    fusion_round_gpu(state, 1);
    fusion_round_gpu(state, 2);
    fusion_round_gpu(state, 3);
    
    // Final SHA3-512 of state[0:32], truncate to 32 bytes
    uint8_t full[64];
    sha3_512_32_gpu(state, full);
    for (int i = 0; i < 32; i++) output[i] = full[i];
}

// ============================================================================
// CHv4 Constants — memory-hard scratchpad
// ============================================================================

constant uint METAL_SCRATCHPAD_BYTES = 262144u;   // 256 KiB per thread — Ekam Deeksha v2 Tier 1
constant uint METAL_BLOCK_SIZE       = 64u;
constant uint METAL_BLOCK_COUNT      = 4096u;     // 4096 × 64 = 262144
constant uint METAL_PASSES           = 4u;
constant uint METAL_RANDOM_READS     = 256u;

// ============================================================================
// BLAKE3 Engine — Exact match to blake3 crate (standard mode, NOT derive_key)
// Used by Ekam Deeksha scratchpad init + mixing.
// ============================================================================

constant uint32_t BLAKE3_IV[8] = {
    0x6A09E667u, 0xBB67AE85u, 0x3C6EF372u, 0xA54FF53Au,
    0x510E527Fu, 0x9B05688Cu, 0x1F83D9ABu, 0x5BE0CD19u
};

constant uint8_t BLAKE3_MSG_PERMUTATION[16] = {
    2, 6, 3, 10, 7, 0, 4, 13, 1, 11, 12, 5, 9, 14, 15, 8
};

constant uint32_t BLAKE3_CHUNK_START = 1u;
constant uint32_t BLAKE3_CHUNK_END   = 2u;
constant uint32_t BLAKE3_ROOT        = 8u;

inline uint32_t blake3_rotr32(uint32_t x, int n) {
    return (x >> n) | (x << (32 - n));
}

void blake3_g(thread uint32_t *state, int a, int b, int c, int d, uint32_t mx, uint32_t my) {
    state[a] = state[a] + state[b] + mx;
    state[d] = blake3_rotr32(state[d] ^ state[a], 16);
    state[c] = state[c] + state[d];
    state[b] = blake3_rotr32(state[b] ^ state[c], 12);
    state[a] = state[a] + state[b] + my;
    state[d] = blake3_rotr32(state[d] ^ state[a], 8);
    state[c] = state[c] + state[d];
    state[b] = blake3_rotr32(state[b] ^ state[c], 7);
}

void blake3_round_fn(thread uint32_t *state, thread const uint32_t *msg) {
    blake3_g(state, 0, 4,  8, 12, msg[0],  msg[1]);
    blake3_g(state, 1, 5,  9, 13, msg[2],  msg[3]);
    blake3_g(state, 2, 6, 10, 14, msg[4],  msg[5]);
    blake3_g(state, 3, 7, 11, 15, msg[6],  msg[7]);
    blake3_g(state, 0, 5, 10, 15, msg[8],  msg[9]);
    blake3_g(state, 1, 6, 11, 12, msg[10], msg[11]);
    blake3_g(state, 2, 7,  8, 13, msg[12], msg[13]);
    blake3_g(state, 3, 4,  9, 14, msg[14], msg[15]);
}

void blake3_permute_msg(thread uint32_t msg[16]) {
    uint32_t tmp[16];
    for (int i = 0; i < 16; i++) tmp[i] = msg[BLAKE3_MSG_PERMUTATION[i]];
    for (int i = 0; i < 16; i++) msg[i] = tmp[i];
}

// Blake3 compress: produces 16 u32 output state words.
// Includes the standard Blake3 finalization XOR (matches reference implementation).
void blake3_compress(
    thread const uint32_t cv[8],
    thread const uint32_t block_words[16],
    uint64_t counter,
    uint32_t block_len,
    uint32_t flags,
    thread uint32_t output[16]
) {
    uint32_t state[16] = {
        cv[0], cv[1], cv[2], cv[3],
        cv[4], cv[5], cv[6], cv[7],
        BLAKE3_IV[0], BLAKE3_IV[1], BLAKE3_IV[2], BLAKE3_IV[3],
        uint32_t(counter & 0xFFFFFFFFu),
        uint32_t(counter >> 32),
        block_len,
        flags
    };

    uint32_t msg[16];
    for (int i = 0; i < 16; i++) msg[i] = block_words[i];

    for (int i = 0; i < 7; i++) {
        blake3_round_fn(state, msg);
        blake3_permute_msg(msg);
    }

    // Blake3 finalization: XOR halves + feed back CV
    for (int i = 0; i < 8; i++) {
        output[i] = state[i] ^ state[i + 8];
        output[i + 8] = state[i + 8] ^ cv[i];
    }
}

// Chaining value: first 8 words of finalized compress output
void blake3_compress_cv(
    thread const uint32_t cv[8],
    thread const uint32_t block_words[16],
    uint64_t counter,
    uint32_t block_len,
    uint32_t flags,
    thread uint32_t output_cv[8]
) {
    uint32_t full[16];
    blake3_compress(cv, block_words, counter, block_len, flags, full);
    for (int i = 0; i < 8; i++) output_cv[i] = full[i];
}

// Load u32 LE words from byte buffer (zero-padded beyond buf_len)
void blake3_load_block_words(thread const uint8_t *buf, int buf_len, thread uint32_t words[16]) {
    for (int i = 0; i < 16; i++) words[i] = 0;
    for (int i = 0; i < buf_len; i++) {
        words[i / 4] |= uint32_t(buf[i]) << ((i % 4) * 8);
    }
}

// Load u32 LE words from device buffer (zero-padded beyond buf_len)
void blake3_load_block_words_device(device const uint8_t *buf, int buf_len, thread uint32_t words[16]) {
    for (int i = 0; i < 16; i++) words[i] = 0;
    for (int i = 0; i < buf_len; i++) {
        words[i / 4] |= uint32_t(buf[i]) << ((i % 4) * 8);
    }
}

// Chunk output struct: holds state for XOF extension
struct Blake3ChunkOutput {
    uint32_t input_cv[8];
    uint32_t block_words[16];
    uint32_t block_len;
    uint32_t flags;
};

// Hash a single chunk (≤1024 bytes) entirely from thread-local memory.
// Returns chunk output for XOF extension.
Blake3ChunkOutput blake3_hash_single_chunk(thread const uint8_t *input, uint input_len) {
    Blake3ChunkOutput out;
    uint32_t cv[8];
    for (int i = 0; i < 8; i++) cv[i] = BLAKE3_IV[i];

    uint offset = 0;
    uint block_index = 0;
    // In Blake3, the counter is the CHUNK counter, not the block counter.
    // For single-chunk hashing, the chunk counter is always 0.
    const uint64_t chunk_counter = 0;

    while (offset < input_len) {
        uint remaining = input_len - offset;
        uint this_len = (remaining > 64u) ? 64u : remaining;
        bool is_first = (block_index == 0);
        bool is_last  = (offset + this_len >= input_len);

        uint32_t flags = 0u;
        if (is_first) flags |= BLAKE3_CHUNK_START;
        if (is_last)  flags |= BLAKE3_CHUNK_END;

        uint32_t block_words[16];
        blake3_load_block_words(input + offset, int(this_len), block_words);

        if (is_last) {
            for (int i = 0; i < 8; i++) out.input_cv[i] = cv[i];
            for (int i = 0; i < 16; i++) out.block_words[i] = block_words[i];
            out.block_len = this_len;
            out.flags = flags;
            return out;
        }

        blake3_compress_cv(cv, block_words, chunk_counter, this_len, flags, cv);
        offset += this_len;
        block_index++;
    }

    // Empty input fallback
    for (int i = 0; i < 8; i++) out.input_cv[i] = BLAKE3_IV[i];
    for (int i = 0; i < 16; i++) out.block_words[i] = 0;
    out.block_len = 0;
    out.flags = BLAKE3_CHUNK_START | BLAKE3_CHUNK_END;
    return out;
}

// Blake3 XOF: fill device buffer from chunk output
void blake3_xof_fill_device(Blake3ChunkOutput chunk_out, device uint8_t *buf, uint buf_len) {
    uint output_block = 0;
    uint written = 0;
    while (written < buf_len) {
        uint32_t state[16];
        blake3_compress(
            chunk_out.input_cv,
            chunk_out.block_words,
            uint64_t(output_block),
            chunk_out.block_len,
            chunk_out.flags | BLAKE3_ROOT,
            state
        );
        uint to_write = min(64u, buf_len - written);
        for (uint i = 0; i < to_write; i++) {
            buf[written + i] = uint8_t(state[i / 4] >> ((i % 4) * 8));
        }
        written += to_write;
        output_block++;
    }
}

// Blake3 XOF: fill thread-local buffer from chunk output
void blake3_xof_fill_thread(Blake3ChunkOutput chunk_out, thread uint8_t *buf, uint buf_len) {
    uint output_block = 0;
    uint written = 0;
    while (written < buf_len) {
        uint32_t state[16];
        blake3_compress(
            chunk_out.input_cv,
            chunk_out.block_words,
            uint64_t(output_block),
            chunk_out.block_len,
            chunk_out.flags | BLAKE3_ROOT,
            state
        );
        uint to_write = min(64u, buf_len - written);
        for (uint i = 0; i < to_write; i++) {
            buf[written + i] = uint8_t(state[i / 4] >> ((i % 4) * 8));
        }
        written += to_write;
        output_block++;
    }
}

// ============================================================================
// Ekam Deeksha Scratchpad — Blake3 XOF based (matches scratchpad_ekam.rs)
// ============================================================================

// Domain separator: "EKAM_SCRATCHPAD_INIT_V1" (23 bytes)
constant uint8_t EKAM_DOMAIN_SEP[23] = {
    'E','K','A','M','_','S','C','R','A','T','C','H','P','A','D','_','I','N','I','T','_','V','1'
};

// Blake3 hash over multi-source input for Ekam mixing.
// Constructs a single-chunk Blake3 from: cur(64) || prev(64) || rand(64) || pass_le8 || idx_le8 = 208 bytes
// Returns chunk output for XOF.
Blake3ChunkOutput blake3_ekam_mix_input(
    device const uint8_t *cur_blk,
    device const uint8_t *prev_blk,
    device const uint8_t *rand_blk,
    uint64_t pass64,
    uint64_t cur64
) {
    // Build 208-byte input: 4 blocks in single chunk
    // Block 0: cur[0..64]   (64 B, CHUNK_START)
    // Block 1: prev[0..64]  (64 B)
    // Block 2: rand[0..64]  (64 B)
    // Block 3: pass(8) || idx(8) = 16 B (CHUNK_END)

    uint32_t cv[8];
    for (int i = 0; i < 8; i++) cv[i] = BLAKE3_IV[i];
    uint32_t block_words[16];

    // Block 0: cur[0..64], CHUNK_START
    blake3_load_block_words_device(cur_blk, 64, block_words);
    blake3_compress_cv(cv, block_words, 0, 64, BLAKE3_CHUNK_START, cv);

    // Block 1: prev[0..64] — counter=0 (chunk counter, NOT block index)
    blake3_load_block_words_device(prev_blk, 64, block_words);
    blake3_compress_cv(cv, block_words, 0, 64, 0, cv);

    // Block 2: rand[0..64] — counter=0 (chunk counter, NOT block index)
    blake3_load_block_words_device(rand_blk, 64, block_words);
    blake3_compress_cv(cv, block_words, 0, 64, 0, cv);

    // Block 3: pass_le8 || idx_le8 = 16 bytes, CHUNK_END
    for (int i = 0; i < 16; i++) block_words[i] = 0;
    block_words[0] = uint32_t(pass64 & 0xFFFFFFFFu);
    block_words[1] = uint32_t(pass64 >> 32);
    block_words[2] = uint32_t(cur64 & 0xFFFFFFFFu);
    block_words[3] = uint32_t(cur64 >> 32);

    Blake3ChunkOutput out;
    for (int i = 0; i < 8; i++) out.input_cv[i] = cv[i];
    for (int i = 0; i < 16; i++) out.block_words[i] = block_words[i];
    out.block_len = 16;
    out.flags = BLAKE3_CHUNK_END;
    return out;
}

// Init scratchpad from 64-byte seed using Blake3 XOF.
// Matches Rust: blake3::Hasher::new().update(seed).update(b"EKAM_SCRATCHPAD_INIT_V1").finalize_xof().fill(pad)
void ekam_init_scratchpad(device uint8_t *pad, thread const uint8_t seed[64]) {
    // Build 87-byte input: seed(64) || domain_sep(23)
    uint8_t input[87];
    for (int i = 0; i < 64; i++) input[i] = seed[i];
    for (int i = 0; i < 23; i++) input[64 + i] = EKAM_DOMAIN_SEP[i];

    Blake3ChunkOutput chunk_out = blake3_hash_single_chunk(input, 87u);
    blake3_xof_fill_device(chunk_out, pad, METAL_SCRATCHPAD_BYTES);
}

// Mix a single block: XOR with Blake3(cur || prev || rand || pass || idx).xof(64)
// Matches Rust mix_block_ekam() exactly.
void ekam_mix_block(
    device uint8_t *pad,
    uint cur_idx, uint prev_idx, uint rand_idx,
    uint pass_num
) {
    device uint8_t *cur_blk  = pad + uint64_t(cur_idx)  * uint64_t(METAL_BLOCK_SIZE);
    device uint8_t *prev_blk = pad + uint64_t(prev_idx) * uint64_t(METAL_BLOCK_SIZE);
    device uint8_t *rand_blk = pad + uint64_t(rand_idx) * uint64_t(METAL_BLOCK_SIZE);

    Blake3ChunkOutput chunk_out = blake3_ekam_mix_input(
        cur_blk, prev_blk, rand_blk,
        uint64_t(pass_num), uint64_t(cur_idx)
    );

    uint8_t mixed[64];
    blake3_xof_fill_thread(chunk_out, mixed, 64u);

    for (int i = 0; i < 64; i++) cur_blk[i] ^= mixed[i];
}

// 2 sequential passes (forward/backward) with Blake3 mixing.
// Matches Rust sequential_passes_ekam() exactly.
void ekam_sequential_passes(device uint8_t *pad) {
    for (uint pass = 0u; pass < METAL_PASSES; pass++) {
        bool fwd = (pass % 2u == 0u);
        for (uint i = 0u; i < METAL_BLOCK_COUNT; i++) {
            uint cur  = fwd ? i : (METAL_BLOCK_COUNT - 1u - i);
            uint prev = fwd
                ? ((cur == 0u) ? METAL_BLOCK_COUNT - 1u : cur - 1u)
                : ((cur == METAL_BLOCK_COUNT - 1u) ? 0u : cur + 1u);

            device uint8_t *cb = pad + uint64_t(cur) * uint64_t(METAL_BLOCK_SIZE);
            uint64_t idx64 = uint64_t(cb[0])
                           | (uint64_t(cb[1]) << 8)
                           | (uint64_t(cb[2]) << 16)
                           | (uint64_t(cb[3]) << 24)
                           | (uint64_t(cb[4]) << 32)
                           | (uint64_t(cb[5]) << 40)
                           | (uint64_t(cb[6]) << 48)
                           | (uint64_t(cb[7]) << 56);
            uint64_t rand64 = idx64 ^ uint64_t(pass) ^ uint64_t(cur);
            uint rand_idx = uint(rand64 % uint64_t(METAL_BLOCK_COUNT));

            ekam_mix_block(pad, cur, prev, rand_idx, pass);
        }
    }
}

// Ekam memory-hard transform (light variant):
// Blake3 XOF init → Blake3 sequential passes → Keccak-256 random reads
// Matches Rust memory_hard_transform_ekam_light() exactly.
void ekam_memory_hard_transform(
    thread const uint8_t gm_out[64],
    device uint8_t *pad,
    thread uint8_t output[64]
) {
    ekam_init_scratchpad(pad, gm_out);
    ekam_sequential_passes(pad);
    metal_random_read_mix(gm_out, pad, output);  // Keccak-256 reads — unchanged
}

// ============================================================================
// Ekam Cosmic Fusion — 8 rounds (matches EKAM_FUSION_ROUNDS = 8)
// Reuses existing fusion_round_gpu() which matches Rust exactly.
// ============================================================================

void cosmic_fusion_ekam_gpu(thread const uint8_t *input, thread uint8_t *output) {
    uint8_t state[64];
    for (int i = 0; i < 64; i++) state[i] = input[i];

    for (uint8_t r = 0; r < 8; r++) {
        fusion_round_gpu(state, r);
    }

    uint8_t full[64];
    sha3_512_32_gpu(state, full);
    for (int i = 0; i < 32; i++) output[i] = full[i];
}

// ============================================================================
// Ekam Deeksha Full Pipeline on GPU
// Steps 1-3: same as CHv4 (Keccak-256 → SHA3-512 → Golden Matrix)
// Step 4: Ekam memory-hard (Blake3 XOF init + passes + Keccak-256 reads)
// Step 5: NPU mixing (unchanged)
// Step 6: 8-round Cosmic Fusion
// ============================================================================

void cosmic_harmony_ekam_deeksha_gpu(
    device const uint8_t *header,
    int header_len,
    uint64_t nonce,
    device uint8_t *pad,
    device const char  *npu_w1,
    device const char  *npu_b1,
    device const char  *npu_w2,
    device const char  *npu_b2,
    device const short *npu_scale1,
    device const short *npu_scale2,
    thread uint8_t *output
) {
    uint8_t s1[32];
    keccak256_header_nonce_gpu(header, header_len, nonce, s1);

    uint8_t s2[64];
    sha3_512_32_gpu(s1, s2);

    uint8_t s3[64];
    golden_matrix_gpu(s2, s3);

    uint8_t s4[64];
    ekam_memory_hard_transform(s3, pad, s4);

    uint8_t s5[64];
    metal_npu_mixing(s4, s5, npu_w1, npu_b1, npu_w2, npu_b2, npu_scale1, npu_scale2);

    cosmic_fusion_ekam_gpu(s5, output);
}

// ============================================================================
// CHv4 Scratchpad helpers (reuse existing sha3_512_gpu / keccak256_gpu)
// ============================================================================

// Write 64-byte block to device scratchpad at block_idx position
void metal_pad_write(device uint8_t* pad, uint block_idx, thread const uint8_t src[64]) {
    device uint8_t* dst = pad + block_idx * METAL_BLOCK_SIZE;
    for (uint i = 0; i < 64u; i++) dst[i] = src[i];
}

// SHA3-512(state[64] || counter_le8) → 64 bytes  (exact 72-byte input = one SHA3-512 block)
void metal_sha3_512_state_counter(
    thread const uint8_t state[64],
    uint64_t counter,
    thread uint8_t output[64]
) {
    sha3_512_state_counter_gpu(state, counter, output);
}

// Initialise scratchpad from 64-byte seed (= SHA3-512(header||nonce)).
// Each of the METAL_BLOCK_COUNT blocks is SHA3-512(prev_block || block_index_le8).
void metal_init_scratchpad(device uint8_t* pad, thread const uint8_t seed[64]) {
    uint8_t state[64];
    for (int i = 0; i < 64; i++) state[i] = seed[i];

    for (uint blk = 0u; blk < METAL_BLOCK_COUNT; blk++) {
        uint8_t next[64];
        metal_sha3_512_state_counter(state, uint64_t(blk), next);
        metal_pad_write(pad, blk, next);
        for (int i = 0; i < 64; i++) state[i] = next[i];
    }
}

// Mix a single scratchpad block: XOR with SHA3-512(cur || prev || rand || pass_le8 || cur_idx_le8)
// Matches CPU mix_block: h.update(current) + h.update(prev) + h.update(random)
//                       + h.update(pass.to_le_bytes()) + h.update((index as u64).to_le_bytes())
void metal_mix_block(
    device uint8_t* pad,
    uint cur_idx, uint prev_idx, uint rand_idx,
    uint pass_num
) {
    device uint8_t* cur_blk  = pad + uint64_t(cur_idx)  * uint64_t(METAL_BLOCK_SIZE);
    device uint8_t* prev_blk = pad + uint64_t(prev_idx) * uint64_t(METAL_BLOCK_SIZE);
    device uint8_t* rand_blk = pad + uint64_t(rand_idx) * uint64_t(METAL_BLOCK_SIZE);

    uint64_t pass64 = uint64_t(pass_num);
    uint64_t cur64  = uint64_t(cur_idx);

    uint8_t hash[64];
    sha3_512_mix_block_gpu(cur_blk, prev_blk, rand_blk, pass64, cur64, hash);

    for (int i = 0; i < 64; i++) cur_blk[i] ^= hash[i];
}

// 2 sequential passes over the pad (alternating forward / backward)
// Matches CPU sequential_passes + mix_block rand_idx logic EXACTLY:
//   idx_bytes = pad[cur_off..cur_off+8]  (current block, u64 LE)
//   rand_index = (u64_from_le(idx_bytes) XOR pass XOR index) % blocks
void metal_sequential_passes(device uint8_t* pad) {
    for (uint pass = 0u; pass < METAL_PASSES; pass++) {
        bool fwd = (pass % 2u == 0u);
        for (uint i = 0u; i < METAL_BLOCK_COUNT; i++) {
            uint cur  = fwd ? i : (METAL_BLOCK_COUNT - 1u - i);
            uint prev = fwd
                ? ((cur == 0u) ? METAL_BLOCK_COUNT - 1u : cur - 1u)
                : ((cur == METAL_BLOCK_COUNT - 1u) ? 0u : cur + 1u);

            // rand_idx: first 8 bytes of CURRENT block as u64 LE, XOR pass, XOR cur
            device uint8_t* cb = pad + uint64_t(cur) * uint64_t(METAL_BLOCK_SIZE);
            uint64_t idx64 = uint64_t(cb[0])
                           | (uint64_t(cb[1]) << 8)
                           | (uint64_t(cb[2]) << 16)
                           | (uint64_t(cb[3]) << 24)
                           | (uint64_t(cb[4]) << 32)
                           | (uint64_t(cb[5]) << 40)
                           | (uint64_t(cb[6]) << 48)
                           | (uint64_t(cb[7]) << 56);
            uint64_t rand64 = idx64 ^ uint64_t(pass) ^ uint64_t(cur);
            uint rand_idx = uint(rand64 % uint64_t(METAL_BLOCK_COUNT));

            metal_mix_block(pad, cur, prev, rand_idx, pass);
        }
    }
}

// 64 pseudo-random reads into scratchpad; returns 64-byte SHA3-512 output.
// Matches CPU random_read_mix EXACTLY:
//   pos_init  = u64_le(seed[0..8]) % blocks
//   h[32]     = keccak256(acc[64] || chunk[64] || r_le8[8])
//   acc[0..32]   ^= h[i]         (XOR)
//   acc[32..64]  wrapping_add h[i]
//   pos = (u64_le(d[0..8]) ^ pos ^ r) % blocks
//   output = SHA3-512(acc[64] || pad[0..64] || pad[-64..])
void metal_random_read_mix(
    thread const uint8_t seed[64],
    device const uint8_t* pad,
    thread uint8_t output[64]
) {
    uint8_t acc[64];
    for (int i = 0; i < 64; i++) acc[i] = seed[i];

    // Initial position from first 8 bytes of seed as u64 LE (matches CPU)
    uint64_t pos64 = uint64_t(seed[0])
                   | (uint64_t(seed[1]) << 8)
                   | (uint64_t(seed[2]) << 16)
                   | (uint64_t(seed[3]) << 24)
                   | (uint64_t(seed[4]) << 32)
                   | (uint64_t(seed[5]) << 40)
                   | (uint64_t(seed[6]) << 48)
                   | (uint64_t(seed[7]) << 56);
    uint64_t pos = pos64 % uint64_t(METAL_BLOCK_COUNT);

    for (uint64_t r = 0u; r < uint64_t(METAL_RANDOM_READS); r++) {
        device const uint8_t* blk = pad + pos * uint64_t(METAL_BLOCK_SIZE);

        uint8_t d[32];
        keccak256_acc_chunk_round_gpu(acc, blk, r, d);

        // acc[0..32]  ^= d[i]           (XOR — matches CPU)
        // acc[32..64] wrapping_add d[i] (matches CPU)
        for (int i = 0; i < 32; i++) {
            acc[i]      = acc[i] ^ d[i];
            acc[32 + i] = uint8_t((uint(acc[32 + i]) + uint(d[i])) & 0xFFu);
        }

        // pos = (u64_le(d[0..8]) ^ pos ^ r) % blocks (matches CPU)
        uint64_t next_seed = uint64_t(d[0])
                           | (uint64_t(d[1]) << 8)
                           | (uint64_t(d[2]) << 16)
                           | (uint64_t(d[3]) << 24)
                           | (uint64_t(d[4]) << 32)
                           | (uint64_t(d[5]) << 40)
                           | (uint64_t(d[6]) << 48)
                           | (uint64_t(d[7]) << 56);
        pos = (next_seed ^ pos ^ r) % uint64_t(METAL_BLOCK_COUNT);
    }

    device const uint8_t* first_blk = pad;
    device const uint8_t* last_blk  = pad + uint64_t(METAL_BLOCK_COUNT - 1u) * uint64_t(METAL_BLOCK_SIZE);
    sha3_512_acc_edges_gpu(acc, first_blk, last_blk, output);
}

// Main memory-hard transform: init(gm_out) → passes → random-read-mix(gm_out) → output
// Matches CPU memory_hard_transform(input) EXACTLY:
//   init_scratchpad(input, pad)       ← input = golden_matrix output
//   sequential_passes(pad)
//   random_read_mix(input, pad)       ← returns SHA3-512(acc || pad[0] || pad[-1])
void metal_memory_hard_transform(
    thread const uint8_t gm_out[64],    // Golden-Matrix output — seed for init AND mix
    device uint8_t* pad,               // per-thread 64 KiB scratch area
    thread uint8_t output[64]
) {
    metal_init_scratchpad(pad, gm_out);   // seed = golden_matrix (was: s2 SHA3-512 — BUG FIXED)
    metal_sequential_passes(pad);
    metal_random_read_mix(gm_out, pad, output);  // output = SHA3-512(acc||...)
    // NOTE: no final XOR with gm_out — CPU doesn't do that
}

// ============================================================================
// CHv4 NPU Mixing — INT8 MLP 64→128→64 + residual
// Mirrors algorithms_npu.rs :: npu_mixing_cpu_int8() EXACTLY (integer arithmetic).
// ============================================================================

// Integer GELU matching Rust gelu_int8(x: i32) -> i32:
//   numerator = x * (128 + x); (x * (128+x)) >> 8, clamped to [-128,127]
int metal_gelu_int8(int x) {
    int num = x * (128 + x);
    int result = num >> 8;
    if (result < -128) result = -128;
    if (result > 127)  result =  127;
    return result;
}

// LayerNorm matching Rust layer_norm_int8(data: &mut [i32], scale: &[i16]):
//   mean = sum / n
//   std_approx = floor(sqrt(sum_sq_dev / n)) + 1
//   normalized = (x - mean) * 128 / std_approx      (Q7)
//   data[i] = ((normalized * scale[i]) >> 8).clamp(-128, 127)
//
// 'n' must be a compile-time constant (128 or 64) so the array fits on stack.
void metal_layer_norm_int8_128(thread int* data, device const short* scale) {
    const int n = 128;
    // Mean (use long = int64 in Metal)
    long sum = 0;
    for (int i = 0; i < n; i++) sum += (long)data[i];
    int mean = (int)(sum / (long)n);

    // Variance sum
    long var_sum = 0;
    for (int i = 0; i < n; i++) {
        long d = (long)(data[i] - mean);
        var_sum += d * d;
    }
    // std_approx = floor(sqrt(var_sum / n)) + 1
    int std_approx = (int)sqrt((float)(var_sum / (long)n)) + 1;

    // Normalize + scale
    for (int i = 0; i < n; i++) {
        int normalized = ((data[i] - mean) * 128) / std_approx;
        int v = (normalized * (int)scale[i]) >> 8;
        if (v < -128) v = -128;
        if (v >  127) v =  127;
        data[i] = v;
    }
}

void metal_layer_norm_int8_64(thread int* data, device const short* scale) {
    const int n = 64;
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
        int v = (normalized * (int)scale[i]) >> 8;
        if (v < -128) v = -128;
        if (v >  127) v =  127;
        data[i] = v;
    }
}

// NPU mixing: 64-byte input → 64-byte output
// Exact integer replication of algorithms_npu.rs :: npu_mixing_cpu_int8().
// Weight buffers supplied as flat i8/i16 arrays:
//   npu_w1[128*64 i8] row-major W1[j][i]=npu_w1[j*64+i], npu_b1[128 i8]
//   npu_w2[64*128 i8] row-major W2[i][j]=npu_w2[i*128+j], npu_b2[64 i8]
//   npu_scale1[128 i16], npu_scale2[64 i16]
void metal_npu_mixing(
    thread const uint8_t input[64],
    thread uint8_t output[64],
    device const char*  npu_w1,
    device const char*  npu_b1,
    device const char*  npu_w2,
    device const char*  npu_b2,
    device const short* npu_scale1,
    device const short* npu_scale2
) {
    // ── Step 1: Convert input u8 → i32 (reinterpret as signed i8) ──
    int input_i32[64];
    for (int i = 0; i < 64; i++) {
        input_i32[i] = (int)((char)input[i]);  // char is signed in Metal
    }

    // ── Step 2: Layer 1 — Linear(64→128) ──
    // acc = b1[j] * 32 + Σ(input[i] * W1[j][i])
    // hidden[j] = (acc >> 12).clamp(-128, 127)
    int hidden[128];
    for (int j = 0; j < 128; j++) {
        int acc = (int)npu_b1[j] * 32;  // bias upscale Q5 — matches CPU: b1[i] as i32 * 32
        device const char* row = npu_w1 + j * 64;
        for (int i = 0; i < 64; i++) {
            acc += input_i32[i] * (int)row[i];
        }
        int val = acc >> 12;
        if (val < -128) val = -128;
        if (val >  127) val =  127;
        hidden[j] = val;
    }

    // ── Step 3: LayerNorm for hidden (128 elements) ──
    metal_layer_norm_int8_128(hidden, npu_scale1);

    // ── Step 4: GELU for hidden ──
    for (int j = 0; j < 128; j++) {
        hidden[j] = metal_gelu_int8(hidden[j]);
    }

    // ── Step 5: Layer 2 — Linear(128→64) ──
    // acc = b2[i] * 32 + Σ(hidden[j] * W2[i][j])
    // out[i] = (acc >> 12).clamp(-128, 127)
    int out_i32[64];
    for (int i = 0; i < 64; i++) {
        int acc = (int)npu_b2[i] * 32;
        device const char* row = npu_w2 + i * 128;
        for (int j = 0; j < 128; j++) {
            acc += hidden[j] * (int)row[j];
        }
        int val = acc >> 12;
        if (val < -128) val = -128;
        if (val >  127) val =  127;
        out_i32[i] = val;
    }

    // ── Step 6: LayerNorm for output (64 elements) ──
    metal_layer_norm_int8_64(out_i32, npu_scale2);

    // ── Step 7: Residual add ──
    for (int i = 0; i < 64; i++) {
        int v = out_i32[i] + input_i32[i];
        if (v < -128) v = -128;
        if (v >  127) v =  127;
        out_i32[i] = v;
    }

    // ── Step 8: Convert i32 → u8 (two's complement lower 8 bits) ──
    for (int i = 0; i < 64; i++) {
        output[i] = (uint8_t)(out_i32[i] & 0xFF);
    }
}

// ============================================================================
// CHv4 Full Pipeline on GPU
// ============================================================================

void cosmic_harmony_v4_gpu(
    device const uint8_t *header,
    int header_len,
    uint64_t nonce,
    device uint8_t* pad,
    device const char*  npu_w1,
    device const char*  npu_b1,
    device const char*  npu_w2,
    device const char*  npu_b2,
    device const short* npu_scale1,
    device const short* npu_scale2,
    thread uint8_t *output            // 32 bytes
) {
    // Step 1: Keccak-256 → 32 bytes
    uint8_t s1[32];
    keccak256_header_nonce_gpu(header, header_len, nonce, s1);

    // Step 2: SHA3-512 → 64 bytes  (also used as scratchpad seed)
    uint8_t s2[64];
    sha3_512_32_gpu(s1, s2);

    // Step 3: Golden Matrix → 64 bytes
    uint8_t s3[64];
    golden_matrix_gpu(s2, s3);

    // Step 4: Memory-hard scratchpad transform (CHv4)
    // seed = s3 (golden_matrix output) — matches CPU memory_hard_transform(&step3.data)
    uint8_t s4[64];
    metal_memory_hard_transform(s3, pad, s4);

    // Step 5: NPU Mixing (CHv4)
    uint8_t s5[64];
    metal_npu_mixing(s4, s5, npu_w1, npu_b1, npu_w2, npu_b2, npu_scale1, npu_scale2);

    // Step 6: Cosmic Fusion → 32 bytes
    cosmic_fusion_gpu(s5, output);
}

// ============================================================================
// Mining Parameters  (CHv4 — 128-byte struct, same base layout as CHv3)
// ============================================================================

struct CHv4MiningParams {
    uint64_t start_nonce;   // offset   0
    uint32_t header_len;    // offset   8
    uint8_t  header[80];    // offset  12
    uint8_t  target[32];    // offset  92
    uint32_t block_height;  // offset 124
    // total 128 bytes (4-byte pad implicit on GPU)
};

struct CHv4MiningResult {
    uint64_t found_nonce;
    uint8_t  found_hash[32];
    uint32_t found;  // atomic flag: 0 = nothing, 1 = solution
};

// ============================================================================
// Main Mining Kernel — CHv4
// ============================================================================

kernel void cosmic_harmony_v3_mine(
    device const CHv4MiningParams& params  [[buffer(0)]],
    device CHv4MiningResult&       result  [[buffer(1)]],
    device uint8_t*                scratchpad_buf [[buffer(2)]],
    device const char*             npu_w1  [[buffer(3)]],
    device const char*             npu_b1  [[buffer(4)]],
    device const char*             npu_w2  [[buffer(5)]],
    device const char*             npu_b2  [[buffer(6)]],
    device const short*            npu_scale1 [[buffer(7)]],
    device const short*            npu_scale2 [[buffer(8)]],
    uint32_t thread_id [[thread_position_in_grid]]
) {
    uint64_t nonce = params.start_nonce + uint64_t(thread_id);

    // Each thread gets its own 64 KiB slice of the scratchpad
    device uint8_t* my_pad = scratchpad_buf + uint64_t(thread_id) * METAL_SCRATCHPAD_BYTES;

    // Compute CHv4 hash
    uint8_t hash[32];
    cosmic_harmony_v4_gpu(
        params.header, int(params.header_len), nonce,
        my_pad,
        npu_w1, npu_b1, npu_w2, npu_b2, npu_scale1, npu_scale2,
        hash
    );

    // Difficulty check: state0 (u32 LE from hash[0..4]) <= target_u32 (u32 BE from target[0..4])
    // Pool validator uses first 8 hex chars of the 64-char big-endian 256-bit target.
    // That equals bytes [0..4] of the 32-byte target interpreted as big-endian u32.
    // Must match: pool/src/shares/validator.rs :: check_target(CosmicHarmony)
    //   → u32::from_str_radix(&job_target[0..8], 16)  which equals BE interpretation of target[0..4].
    uint32_t state0    = uint32_t(hash[0])
                       | (uint32_t(hash[1]) << 8)
                       | (uint32_t(hash[2]) << 16)
                       | (uint32_t(hash[3]) << 24);
    uint32_t target_u32 = (uint32_t(params.target[0]) << 24)
                        | (uint32_t(params.target[1]) << 16)
                        | (uint32_t(params.target[2]) << 8)
                        |  uint32_t(params.target[3]);

    if (state0 <= target_u32) {
        uint32_t expected = 0u;
        if (atomic_compare_exchange_weak_explicit(
                (device atomic_uint*)&result.found,
                &expected, 1u,
                memory_order_relaxed, memory_order_relaxed)) {
            result.found_nonce = nonce;
            for (int i = 0; i < 32; i++) result.found_hash[i] = hash[i];
        }
    }
}

// ============================================================================
// Benchmark Kernel — CHv4 (no target check, writes 32-byte hashes)
// ============================================================================

kernel void cosmic_harmony_v3_benchmark(
    device const CHv4MiningParams& params  [[buffer(0)]],
    device uint8_t*                output_hashes [[buffer(1)]],
    device uint8_t*                scratchpad_buf [[buffer(2)]],
    device const char*             npu_w1  [[buffer(3)]],
    device const char*             npu_b1  [[buffer(4)]],
    device const char*             npu_w2  [[buffer(5)]],
    device const char*             npu_b2  [[buffer(6)]],
    device const short*            npu_scale1 [[buffer(7)]],
    device const short*            npu_scale2 [[buffer(8)]],
    uint32_t thread_id [[thread_position_in_grid]]
) {
    uint64_t nonce = params.start_nonce + uint64_t(thread_id);
    device uint8_t* my_pad = scratchpad_buf + uint64_t(thread_id) * METAL_SCRATCHPAD_BYTES;

    uint8_t hash[32];
    cosmic_harmony_v4_gpu(
        params.header, int(params.header_len), nonce,
        my_pad,
        npu_w1, npu_b1, npu_w2, npu_b2, npu_scale1, npu_scale2,
        hash
    );

    device uint8_t* dst = output_hashes + thread_id * 32;
    for (int i = 0; i < 32; i++) dst[i] = hash[i];
}

// ============================================================================
// Ekam Deeksha Mining Kernel
// ============================================================================

kernel void cosmic_harmony_ekam_mine(
    device const CHv4MiningParams& params  [[buffer(0)]],
    device CHv4MiningResult&       result  [[buffer(1)]],
    device uint8_t*                scratchpad_buf [[buffer(2)]],
    device const char*             npu_w1  [[buffer(3)]],
    device const char*             npu_b1  [[buffer(4)]],
    device const char*             npu_w2  [[buffer(5)]],
    device const char*             npu_b2  [[buffer(6)]],
    device const short*            npu_scale1 [[buffer(7)]],
    device const short*            npu_scale2 [[buffer(8)]],
    uint32_t thread_id [[thread_position_in_grid]]
) {
    uint64_t nonce = params.start_nonce + uint64_t(thread_id);
    device uint8_t* my_pad = scratchpad_buf + uint64_t(thread_id) * METAL_SCRATCHPAD_BYTES;

    uint8_t hash[32];
    cosmic_harmony_ekam_deeksha_gpu(
        params.header, int(params.header_len), nonce,
        my_pad,
        npu_w1, npu_b1, npu_w2, npu_b2, npu_scale1, npu_scale2,
        hash
    );

    uint32_t state0    = uint32_t(hash[0])
                       | (uint32_t(hash[1]) << 8)
                       | (uint32_t(hash[2]) << 16)
                       | (uint32_t(hash[3]) << 24);
    uint32_t target_u32 = (uint32_t(params.target[0]) << 24)
                        | (uint32_t(params.target[1]) << 16)
                        | (uint32_t(params.target[2]) << 8)
                        |  uint32_t(params.target[3]);

    if (state0 <= target_u32) {
        uint32_t expected = 0u;
        if (atomic_compare_exchange_weak_explicit(
                (device atomic_uint*)&result.found,
                &expected, 1u,
                memory_order_relaxed, memory_order_relaxed)) {
            result.found_nonce = nonce;
            for (int i = 0; i < 32; i++) result.found_hash[i] = hash[i];
        }
    }
}

// ============================================================================
// Ekam Deeksha Benchmark Kernel
// ============================================================================

kernel void cosmic_harmony_ekam_benchmark(
    device const CHv4MiningParams& params  [[buffer(0)]],
    device uint8_t*                output_hashes [[buffer(1)]],
    device uint8_t*                scratchpad_buf [[buffer(2)]],
    device const char*             npu_w1  [[buffer(3)]],
    device const char*             npu_b1  [[buffer(4)]],
    device const char*             npu_w2  [[buffer(5)]],
    device const char*             npu_b2  [[buffer(6)]],
    device const short*            npu_scale1 [[buffer(7)]],
    device const short*            npu_scale2 [[buffer(8)]],
    uint32_t thread_id [[thread_position_in_grid]]
) {
    uint64_t nonce = params.start_nonce + uint64_t(thread_id);
    device uint8_t* my_pad = scratchpad_buf + uint64_t(thread_id) * METAL_SCRATCHPAD_BYTES;

    uint8_t hash[32];
    cosmic_harmony_ekam_deeksha_gpu(
        params.header, int(params.header_len), nonce,
        my_pad,
        npu_w1, npu_b1, npu_w2, npu_b2, npu_scale1, npu_scale2,
        hash
    );

    device uint8_t* dst = output_hashes + thread_id * 32;
    for (int i = 0; i < 32; i++) dst[i] = hash[i];
}
