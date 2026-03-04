/*
 * ZION Cosmic Harmony v4 - Metal GPU Compute Shader
 *
 * Native GPU acceleration for Apple Silicon (M1-M5), version 2.9.7.
 * Implements full CHv4 pipeline on GPU:
 *   Keccak-256 → SHA3-512 → Golden Matrix
 *   → Memory-Hard Scratchpad (512 KiB/thread)
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

// Cosmic XOR mask
constant uint8_t COSMIC_XOR_MASK[32] = {
    0x74, 0x9D, 0x30, 0x60, 0x74, 0x9D, 0x30, 0x60,
    0x74, 0x9D, 0x30, 0x60, 0x74, 0x9D, 0x30, 0x60,
    0x74, 0x9D, 0x30, 0x60, 0x74, 0x9D, 0x30, 0x60,
    0x74, 0x9D, 0x30, 0x60, 0x74, 0x9D, 0x30, 0x60
};

// ============================================================================
// Helper: rotl64
// ============================================================================

inline uint64_t rotl64(uint64_t x, int n) {
    return (x << n) | (x >> (64 - n));
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
    for (int i = 0; i < 4; i++) {
        for (int j = 0; j < 8; j++) {
            output[i * 8 + j] = uint8_t(state[i] >> (j * 8));
        }
    }
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
    for (int i = 0; i < 8; i++) {
        for (int j = 0; j < 8; j++) {
            output[i * 8 + j] = uint8_t(state[i] >> (j * 8));
        }
    }
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
// Cosmic Fusion (4 rounds Keccak+XOR, final SHA3-512)
// ============================================================================

void fusion_round_gpu(thread uint8_t *state, uint8_t round_num) {
    // Keccak-256 of state[0:32] + round_byte
    uint8_t keccak_input[33];
    for (int i = 0; i < 32; i++) keccak_input[i] = state[i];
    keccak_input[32] = round_num;
    
    uint8_t intermediate[32];
    keccak256_gpu(keccak_input, 33, intermediate);
    
    // XOR with COSMIC_XOR_MASK
    for (int i = 0; i < 32; i++) {
        state[i] = intermediate[i] ^ COSMIC_XOR_MASK[i];
    }
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
    sha3_512_gpu(state, 32, full);
    for (int i = 0; i < 32; i++) output[i] = full[i];
}

// ============================================================================
// CHv4 Constants — memory-hard scratchpad
// ============================================================================

constant uint METAL_SCRATCHPAD_BYTES = 524288u;   // 512 KiB per thread
constant uint METAL_BLOCK_SIZE       = 64u;
constant uint METAL_BLOCK_COUNT      = 8192u;     // 8192 × 64 = 524288
constant uint METAL_PASSES           = 4u;
constant uint METAL_RANDOM_READS     = 256u;

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
    uint8_t input[72];
    for (int i = 0; i < 64; i++) input[i] = state[i];
    for (int b = 0; b < 8; b++) input[64+b] = uint8_t(counter >> (b * 8));
    sha3_512_gpu(input, 72, output);
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

// Mix a single scratchpad block: XOR with SHA3-512(cur || prev || rand || context[16])
void metal_mix_block(
    device uint8_t* pad,
    uint cur_idx, uint prev_idx, uint rand_idx,
    uint pass_num
) {
    device uint8_t* cur_blk  = pad + cur_idx  * METAL_BLOCK_SIZE;
    device uint8_t* prev_blk = pad + prev_idx * METAL_BLOCK_SIZE;
    device uint8_t* rand_blk = pad + rand_idx * METAL_BLOCK_SIZE;

    // combined = cur[64] || prev[64] || rand[64] || ctx[16]   (total 208 bytes)
    uint8_t combined[208];
    for (int i = 0; i < 64; i++) {
        combined[i]       = cur_blk[i];
        combined[64 + i]  = prev_blk[i];
        combined[128 + i] = rand_blk[i];
    }
    // 16-byte context: pass | cur | prev | rand (each 4 bytes LE)
    for (int b = 0; b < 4; b++) {
        combined[192 + b] = uint8_t(pass_num >> (b * 8));
        combined[196 + b] = uint8_t(cur_idx  >> (b * 8));
        combined[200 + b] = uint8_t(prev_idx >> (b * 8));
        combined[204 + b] = uint8_t(rand_idx >> (b * 8));
    }

    uint8_t hash[64];
    sha3_512_gpu(combined, 208, hash);

    for (int i = 0; i < 64; i++) cur_blk[i] ^= hash[i];
}

// 4 sequential passes over the pad (alternating forward / backward)
void metal_sequential_passes(device uint8_t* pad) {
    for (uint pass = 0u; pass < METAL_PASSES; pass++) {
        bool fwd = (pass % 2u == 0u);
        for (uint i = 0u; i < METAL_BLOCK_COUNT; i++) {
            uint cur  = fwd ? i : (METAL_BLOCK_COUNT - 1u - i);
            uint prev = fwd
                ? ((cur == 0u) ? METAL_BLOCK_COUNT - 1u : cur - 1u)
                : ((cur == METAL_BLOCK_COUNT - 1u) ? 0u : cur + 1u);

            // rand_idx: low 32 bits of the previous block's first 4 bytes
            device uint8_t* pb = pad + prev * METAL_BLOCK_SIZE;
            uint32_t rv = uint32_t(pb[0])
                        | (uint32_t(pb[1]) << 8)
                        | (uint32_t(pb[2]) << 16)
                        | (uint32_t(pb[3]) << 24);
            uint rand_idx = rv % METAL_BLOCK_COUNT;

            metal_mix_block(pad, cur, prev, rand_idx, pass);
        }
    }
}

// 256 pseudo-random reads into scratchpad; returns 64-byte accumulator.
void metal_random_read_mix(
    thread const uint8_t seed[64],
    device const uint8_t* pad,
    thread uint8_t output[64]
) {
    uint8_t acc[64];
    for (int i = 0; i < 64; i++) acc[i] = seed[i];

    for (uint r = 0u; r < METAL_RANDOM_READS; r++) {
        // block index from first 4 bytes of accumulator
        uint32_t rv = uint32_t(acc[0])
                    | (uint32_t(acc[1]) << 8)
                    | (uint32_t(acc[2]) << 16)
                    | (uint32_t(acc[3]) << 24);
        uint blk_idx = rv % METAL_BLOCK_COUNT;

        // keccak256(acc[64] || pad_block[64] || r_le8)  = 136 bytes
        uint8_t inp[136];
        for (int i = 0; i < 64; i++) inp[i] = acc[i];
        device const uint8_t* blk = pad + blk_idx * METAL_BLOCK_SIZE;
        for (int i = 0; i < 64; i++) inp[64 + i] = blk[i];
        for (int b = 0; b < 8; b++) inp[128 + b] = uint8_t(uint64_t(r) >> (b * 8));

        uint8_t h[32];
        keccak256_gpu(inp, 136, h);

        // XOR accumulator (cycle h over 64 bytes)
        for (int i = 0; i < 64; i++) acc[i] ^= h[i % 32];
    }

    for (int i = 0; i < 64; i++) output[i] = acc[i];
}

// Main memory-hard transform: init → passes → random-read-mix → XOR residual
void metal_memory_hard_transform(
    thread const uint8_t gm_out[64],    // Golden-Matrix output (64 bytes)
    thread const uint8_t seed[64],      // SHA3-512(header||nonce) scratchpad seed
    device uint8_t* pad,               // per-thread 512 KiB scratch area
    thread uint8_t output[64]
) {
    metal_init_scratchpad(pad, seed);
    metal_sequential_passes(pad);

    uint8_t mix[64];
    metal_random_read_mix(gm_out, pad, mix);

    // Residual XOR with Golden-Matrix output
    for (int i = 0; i < 64; i++) output[i] = mix[i] ^ gm_out[i];
}

// ============================================================================
// CHv4 NPU Mixing — INT8 MLP 64→128→64 + residual
// Mirrors algorithms_npu.rs :: npu_mixing_cpu_int8()
// ============================================================================

// Approximate GELU: x * sigmoid(1.702 * x)
float metal_gelu(float x) {
    return x / (1.0f + exp(-1.702f * x));
}

// NPU mixing: 64-byte input → 64-byte output
// Weight buffers supplied as flat i8/i16 arrays:
//   npu_w1[128*64 i8], npu_b1[128 i8], npu_w2[64*128 i8], npu_b2[64 i8]
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
    // ── Layer 1: 64 → 128 (INT8 weight, float accumulation, GELU) ──
    float h[128];
    for (int j = 0; j < 128; j++) {
        float acc = float(npu_b1[j]);
        device const char* row = npu_w1 + j * 64;
        for (int i = 0; i < 64; i++) {
            acc += float(row[i]) * float(int8_t(input[i]));
        }
        float scale = float(npu_scale1[j]);
        float val   = (scale != 0.0f) ? (acc / scale) : acc;
        h[j] = metal_gelu(val);
    }

    // ── Layer 2: 128 → 64 (INT8 weight, float accumulation) ──
    for (int i = 0; i < 64; i++) {
        float acc = float(npu_b2[i]);
        device const char* row = npu_w2 + i * 128;
        for (int j = 0; j < 128; j++) {
            acc += float(row[j]) * h[j];
        }
        float scale = float(npu_scale2[i]);
        float val   = (scale != 0.0f) ? (acc / scale) : acc;

        // residual + clamp → i8 → store as u8
        float residual = float(int8_t(input[i]));
        int32_t out_i  = int32_t(clamp(val + residual, -128.0f, 127.0f));
        output[i] = uint8_t(out_i & 0xFF);
    }
}

// ============================================================================
// CHv4 Full Pipeline on GPU
// ============================================================================

void cosmic_harmony_v4_gpu(
    thread const uint8_t *header,
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
    // Build 88-byte input: header[0..80] || nonce(8 LE)
    uint8_t inp[88];
    for (int i = 0; i < 88; i++) inp[i] = 0;
    int h_len = min(header_len, 80);
    for (int i = 0; i < h_len; i++) inp[i] = header[i];
    for (int b = 0; b < 8; b++) inp[80 + b] = uint8_t(nonce >> (b * 8));

    // Step 1: Keccak-256 → 32 bytes
    uint8_t s1[32];
    keccak256_gpu(inp, 88, s1);

    // Step 2: SHA3-512 → 64 bytes  (also used as scratchpad seed)
    uint8_t s2[64];
    sha3_512_gpu(s1, 32, s2);

    // Step 3: Golden Matrix → 64 bytes
    uint8_t s3[64];
    golden_matrix_gpu(s2, s3);

    // Step 4: Memory-hard scratchpad transform (CHv4)
    uint8_t s4[64];
    metal_memory_hard_transform(s3, s2, pad, s4);

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

    // Each thread gets its own 512 KiB slice of the scratchpad
    device uint8_t* my_pad = scratchpad_buf + uint64_t(thread_id) * METAL_SCRATCHPAD_BYTES;

    // Copy header to thread-local stack
    uint8_t header[80];
    for (int i = 0; i < 80; i++) header[i] = params.header[i];

    // Compute CHv4 hash
    uint8_t hash[32];
    cosmic_harmony_v4_gpu(
        header, int(params.header_len), nonce,
        my_pad,
        npu_w1, npu_b1, npu_w2, npu_b2, npu_scale1, npu_scale2,
        hash
    );

    // Difficulty check: state0 (u32 LE from hash[0..4]) <= target_u32 (u32 BE from target[28..32])
    uint32_t state0    = uint32_t(hash[0])
                       | (uint32_t(hash[1]) << 8)
                       | (uint32_t(hash[2]) << 16)
                       | (uint32_t(hash[3]) << 24);
    uint32_t target_u32 = (uint32_t(params.target[28]) << 24)
                        | (uint32_t(params.target[29]) << 16)
                        | (uint32_t(params.target[30]) << 8)
                        |  uint32_t(params.target[31]);

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

    uint8_t header[80];
    for (int i = 0; i < 80; i++) header[i] = params.header[i];

    uint8_t hash[32];
    cosmic_harmony_v4_gpu(
        header, int(params.header_len), nonce,
        my_pad,
        npu_w1, npu_b1, npu_w2, npu_b2, npu_scale1, npu_scale2,
        hash
    );

    device uint8_t* dst = output_hashes + thread_id * 32;
    for (int i = 0; i < 32; i++) dst[i] = hash[i];
}
