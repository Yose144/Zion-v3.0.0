// Cosmic Harmony v3 - OpenCL Kernel  (corrected -- matches CPU/pool exactly)
// Pipeline: Keccak-256(88B) -> SHA3-512(32B) -> GoldenMatrix -> CosmicFusion -> 32B hash
//
// Pool verification:  hash[0..4] as u32-LE  <=  target_u32

#pragma OPENCL EXTENSION cl_khr_int64_base_atomics : enable
#pragma OPENCL EXTENSION cl_khr_int64_extended_atomics : enable

// ============================================================================
// Constants
// ============================================================================

// Fixed-point golden-ratio powers  phi^n * 2^32  (identical to Rust PHI_POWERS_FP)
__constant ulong PHI_POWERS_FP[16] = {
    4294967296UL,      // phi^0
    6949403065UL,      // phi^1
    11244370361UL,     // phi^2
    18193773427UL,     // phi^3
    29438143788UL,     // phi^4
    47631917215UL,     // phi^5
    77070061004UL,     // phi^6
    124701978219UL,    // phi^7
    201772039223UL,    // phi^8
    326474017443UL,    // phi^9
    528246056666UL,    // phi^10
    854720074109UL,    // phi^11
    1382966130776UL,   // phi^12
    2237686204885UL,   // phi^13
    3620652335660UL,   // phi^14
    5858338540545UL,   // phi^15
};

// Cosmic XOR mask -- repeating 4-byte pattern (identical to Rust COSMIC_XOR_MASK)
__constant uchar COSMIC_XOR_MASK[32] = {
    0x74, 0x9D, 0x30, 0x60, 0x74, 0x9D, 0x30, 0x60,
    0x74, 0x9D, 0x30, 0x60, 0x74, 0x9D, 0x30, 0x60,
    0x74, 0x9D, 0x30, 0x60, 0x74, 0x9D, 0x30, 0x60,
    0x74, 0x9D, 0x30, 0x60, 0x74, 0x9D, 0x30, 0x60,
};

__constant ulong KECCAK_RC[24] = {
    0x0000000000000001UL, 0x0000000000008082UL, 0x800000000000808AUL,
    0x8000000080008000UL, 0x000000000000808BUL, 0x0000000080000001UL,
    0x8000000080008081UL, 0x8000000000008009UL, 0x000000000000008AUL,
    0x0000000000000088UL, 0x0000000080008009UL, 0x000000008000000AUL,
    0x000000008000808BUL, 0x800000000000008BUL, 0x8000000000008089UL,
    0x8000000000008003UL, 0x8000000000008002UL, 0x8000000000000080UL,
    0x000000000000800AUL, 0x800000008000000AUL, 0x8000000080008081UL,
    // positions 21-23: fixed to match NIST standard (same as sha3::Keccak256
    // crate used by pool validator and CPU miner)
    0x8000000000008080UL, 0x0000000080000001UL, 0x8000000080008008UL,
};

__constant int KECCAK_PILN[24] = {
    10, 7, 11, 17, 18, 3, 5, 16, 8, 21, 24, 4,
    15, 23, 19, 13, 12, 2, 20, 14, 22, 9, 6, 1
};

__constant int KECCAK_ROTC[24] = {
    1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 2, 14,
    27, 41, 56, 8, 25, 43, 62, 18, 39, 61, 20, 44
};

// ============================================================================
// Helpers
// ============================================================================

inline ulong rotl64(ulong x, int n) {
    return (x << n) | (x >> (64 - n));
}

// ============================================================================
// Keccak-f[1600]  (standard 24-round permutation)
// ============================================================================

void keccak_f1600(ulong *state) {
    ulong bc[5], t;

    for (int round = 0; round < 24; round++) {
        // Theta
        for (int i = 0; i < 5; i++)
            bc[i] = state[i] ^ state[i+5] ^ state[i+10] ^ state[i+15] ^ state[i+20];
        for (int i = 0; i < 5; i++) {
            t = bc[(i+4) % 5] ^ rotl64(bc[(i+1) % 5], 1);
            for (int j = 0; j < 25; j += 5) state[j+i] ^= t;
        }
        // Rho + Pi
        t = state[1];
        for (int i = 0; i < 24; i++) {
            int j = KECCAK_PILN[i];
            bc[0] = state[j];
            state[j] = rotl64(t, KECCAK_ROTC[i]);
            t = bc[0];
        }
        // Chi
        for (int j = 0; j < 25; j += 5) {
            for (int i = 0; i < 5; i++) bc[i] = state[j+i];
            for (int i = 0; i < 5; i++)
                state[j+i] ^= (~bc[(i+1) % 5]) & bc[(i+2) % 5];
        }
        // Iota
        state[0] ^= KECCAK_RC[round];
    }
}

// ============================================================================
// Keccak-256  (padding byte 0x01 -- NOT SHA3 0x06)
// Rate = 136 bytes = 17 u64 words.   Output = 32 bytes.
// Handles arbitrary input_len (including non-multiple-of-8).
// ============================================================================

void keccak256_bytes(const uchar* input, int input_len, uchar* output) {
    ulong state[25];
    for (int i = 0; i < 25; i++) state[i] = 0;

    // Absorb full 8-byte words
    int full_words = input_len / 8;
    for (int i = 0; i < full_words; i++) {
        ulong w = 0;
        for (int b = 0; b < 8; b++) w |= ((ulong)input[i*8+b]) << (b*8);
        state[i] ^= w;
    }

    // Remaining bytes + Keccak padding (0x01)
    int rem = input_len % 8;
    int pw  = full_words;
    ulong pad = 0;
    for (int b = 0; b < rem; b++)
        pad |= ((ulong)input[pw*8+b]) << (b*8);
    pad |= ((ulong)0x01) << (rem * 8);
    state[pw] ^= pad;

    // Terminal bit at last byte of rate block (byte 135 = word 16, byte 7)
    state[16] ^= 0x8000000000000000UL;

    keccak_f1600(state);

    // Squeeze 32 bytes
    for (int i = 0; i < 4; i++)
        for (int b = 0; b < 8; b++)
            output[i*8+b] = (uchar)(state[i] >> (b*8));
}

// ============================================================================
// SHA3-512  (padding byte 0x06)
// Rate = 72 bytes = 9 u64 words.   Output = 64 bytes.
// Fixed for 32-byte input, outputting first 32 bytes (truncated).
// ============================================================================

void sha3_512_trunc32(const uchar* input, uchar* output) {
    ulong state[25];
    for (int i = 0; i < 25; i++) state[i] = 0;

    for (int i = 0; i < 4; i++) {
        ulong w = 0;
        for (int b = 0; b < 8; b++) w |= ((ulong)input[i*8+b]) << (b*8);
        state[i] ^= w;
    }
    state[4] ^= 0x06;
    state[8] ^= 0x8000000000000000UL;
    keccak_f1600(state);

    for (int i = 0; i < 4; i++)
        for (int b = 0; b < 8; b++)
            output[i*8+b] = (uchar)(state[i] >> (b*8));
}

// SHA3-512 variant: 32-byte input -> 8 u64 output words (full 64 bytes)
void sha3_512_words(const uchar* input, ulong* out_words) {
    ulong state[25];
    for (int i = 0; i < 25; i++) state[i] = 0;

    for (int i = 0; i < 4; i++) {
        ulong w = 0;
        for (int b = 0; b < 8; b++) w |= ((ulong)input[i*8+b]) << (b*8);
        state[i] ^= w;
    }
    state[4] ^= 0x06;
    state[8] ^= 0x8000000000000000UL;
    keccak_f1600(state);

    for (int i = 0; i < 8; i++) out_words[i] = state[i];
}

// ============================================================================
// Golden Matrix  (matches Rust golden_matrix_opt exactly)
//
//   matrix[i][j] = byte_value_at(i*8+j)   as u64      (0-255)
//   result[i]    = (sum_j matrix[i][j] * PHI_POWERS_FP[i+j]) >> 32
//
// All products fit in u64 (byte <= 255, max PHI ~ 5.9e12 -> product <= 1.5e15).
// Sum of 8 terms <= 1.2e16 -- safely within u64.
// ============================================================================

void golden_matrix(const ulong* sha3_words, ulong* result) {
    for (int i = 0; i < 8; i++) {
        ulong sum = 0;
        for (int j = 0; j < 8; j++) {
            ulong byte_val = (sha3_words[i] >> (j * 8)) & 0xFFUL;
            sum += byte_val * PHI_POWERS_FP[i + j];
        }
        result[i] = sum >> 32;
    }
}

// ============================================================================
// Cosmic Fusion  (matches Rust cosmic_fusion_opt exactly)
//
//   state[0..64] = golden_matrix output (bytes)
//   4 rounds:
//     intermediate = Keccak-256( state[0..32] || round_byte )   (33 bytes)
//     state[0..32] = intermediate XOR COSMIC_XOR_MASK
//   final_hash = SHA3-512( state[0..32] )[0..32]               (truncated)
// ============================================================================

void cosmic_fusion(const ulong* gm_words, uchar* output) {
    // Convert golden-matrix u64 words -> 64 bytes (LE)
    uchar state[64];
    for (int i = 0; i < 8; i++)
        for (int b = 0; b < 8; b++)
            state[i*8+b] = (uchar)(gm_words[i] >> (b*8));

    // 4 fusion rounds
    for (int round = 0; round < 4; round++) {
        // Build 33-byte Keccak input: state[0..32] + round_byte
        uchar kin[33];
        for (int i = 0; i < 32; i++) kin[i] = state[i];
        kin[32] = (uchar)round;

        uchar intermediate[32];
        keccak256_bytes(kin, 33, intermediate);

        // XOR with mask -> update state[0..32]
        for (int i = 0; i < 32; i++)
            state[i] = intermediate[i] ^ COSMIC_XOR_MASK[i];
    }

    // Final: SHA3-512( state[0..32] ) -> first 32 bytes
    sha3_512_trunc32(state, output);
}

// ============================================================================
// Main Kernel
// ============================================================================

__kernel void cosmic_harmony_v3_mine(
    __global const uchar* header,   // block header (first 80 bytes used)
    const uint header_len,          // actual header length (capped at 80 by host)
    const ulong start_nonce,
    const uint target_u32,          // pool target as u32 (hash[0..4] LE <= this)
    __global ulong* results,        // [0]=flag, [1]=winning nonce
    __global uint* result_count,
    __global uchar* result_hash     // 32 bytes: winning hash for host verification
) {
    uint tid = get_global_id(0);
    ulong nonce = start_nonce + (ulong)tid;

    // -- Step 0: Prepare 88-byte input  (80B header + 8B LE nonce) --
    uchar input[88];
    uint clen = min(header_len, 80u);
    for (uint i = 0; i < clen; i++)  input[i] = header[i];
    for (uint i = clen; i < 80; i++) input[i] = 0;
    for (int i = 0; i < 8; i++)
        input[80 + i] = (uchar)(nonce >> (i * 8));

    // -- Step 1: Keccak-256( 88 bytes ) -> 32 bytes --
    uchar step1[32];
    keccak256_bytes(input, 88, step1);

    // -- Step 2: SHA3-512( 32 bytes ) -> 8 u64 words (64 bytes) --
    ulong step2[8];
    sha3_512_words(step1, step2);

    // -- Step 3: GoldenMatrix -> 8 u64 words --
    ulong step3[8];
    golden_matrix(step2, step3);

    // -- Step 4: CosmicFusion -> 32-byte final hash --
    uchar final_hash[32];
    cosmic_fusion(step3, final_hash);

    // -- Target check (matches pool validator exactly) --
    // state0 = u32::from_le_bytes( hash[0..4] )
    uint state0 = ((uint)final_hash[0])
                | ((uint)final_hash[1] << 8)
                | ((uint)final_hash[2] << 16)
                | ((uint)final_hash[3] << 24);

    if (state0 <= target_u32) {
        if (atomic_xchg(result_count, 1) == 0) {
            results[0] = 1;
            results[1] = nonce;
            // Copy winning hash so host can verify
            for (int i = 0; i < 32; i++)
                result_hash[i] = final_hash[i];
        }
    }
}