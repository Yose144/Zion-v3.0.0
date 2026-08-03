// KeryxHash CUDA kernel for Keryx (KRX) mining.
//
// KeryxHash = kHeavyHash (Kaspa) + 2 modifications:
//   1. KERYX_MATRIX_SALT — 32-byte domain separator XORed into pre_pow_hash
//      before generating the 64x64 matrix (handled host-side; the kernel
//      receives the precomputed matrix just like KAS).
//   2. wave_mix — 4-round ARX post-processing applied to the 32-byte matrix
//      product BEFORE the final cSHAKE256("HeavyHash") call. This is the
//      only kernel-side change vs kheavyhash_kernel.cu.
//
// Algorithm:
//   1. PowHash   = cSHAKE256("ProofOfWorkHash")(pre_pow_hash || timestamp_le || 32 zero bytes || nonce_le)
//   2. Matrix    = expand PowHash to 64 nibbles, multiply by 64x64 matrix
//                  (4-bit entries, generated host-side from
//                  SHA3-256(pre_pow_hash XOR KERYX_MATRIX_SALT_v4) via
//                  XoShiRo256++, retry until full rank 64),
//                  reduce each sum to bits 10-13, recombine to 32 bytes,
//                  XOR with PowHash.
//   3. wave_mix  = 4-round ARX on the 32-byte product (Keryx-only step).
//   4. HeavyHash = cSHAKE256("HeavyHash")(wave_mix_output)
//
// The cSHAKE customization strings are identical to Kaspa ("ProofOfWorkHash"
// and "HeavyHash") — Keryx forked from Kaspa and kept these domain separators.
//
// ⚠️ MAINNET STATUS (2026-07): Keryx mainnet activated Proof-of-Model (PoM)
// at DAA 37,780,000 (2026-06-26) and made pomFinalState mandatory at H3
// (DAA 43,450,000, 2026-07-05). Pure KeryxHash blocks are rejected by the
// network. This kernel is kept for testnet/future/research use.
//
// References:
//   - keryx-miner: https://github.com/keryx-labs/keryx-miner
//   - keryx-miner src/pow/heavy_hash.rs (Rust CPU reference)
//   - AuXpow/src/external_hashers.rs (hash_keryxhash)
//   - NIST SP 800-185 (cSHAKE)

#pragma once

#include <cuda_runtime.h>
#include <stdint.h>

// -- Keccak-f[1600] --

__constant__ const uint64_t KECCAK_RC[24] = {
    0x0000000000000001ULL, 0x0000000000008082ULL, 0x800000000000808aULL,
    0x8000000080008000ULL, 0x000000000000808bULL, 0x0000000080000001ULL,
    0x8000000080008081ULL, 0x8000000000008009ULL, 0x000000000000008aULL,
    0x0000000000000088ULL, 0x0000000080008009ULL, 0x000000008000000aULL,
    0x000000008000808bULL, 0x800000000000008bULL, 0x8000000000008089ULL,
    0x8000000000008003ULL, 0x8000000000008002ULL, 0x8000000000000080ULL,
    0x000000000000800aULL, 0x800000008000000aULL, 0x8000000080008081ULL,
    0x8000000000008080ULL, 0x0000000080000001ULL, 0x8000000080008008ULL
};

__constant__ const unsigned int KECCAK_RHO[24] = {
    1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 2, 14, 27, 41, 56, 8, 25, 43, 62, 18, 39, 61, 20, 44
};

__constant__ const int KECCAK_PI[24] = {
    10, 7, 11, 17, 18, 3, 5, 16, 8, 21, 24, 4, 15, 23, 19, 13, 12, 2, 20, 14, 22, 9, 6, 1
};

#define ROTL64(x, n) (((x) << (n)) | ((x) >> (64 - (n))))

__device__ void keccak_f1600(uint64_t state[25]) {
    for (int round = 0; round < 24; round++) {
        uint64_t c[5], d[5];
        for (int x = 0; x < 5; x++)
            c[x] = state[x] ^ state[x+5] ^ state[x+10] ^ state[x+15] ^ state[x+20];
        for (int x = 0; x < 5; x++)
            d[x] = c[(x+4)%5] ^ ROTL64(c[(x+1)%5], 1);
        for (int i = 0; i < 25; i++)
            state[i] ^= d[i%5];

        uint64_t temp = state[1];
        for (int t = 0; t < 24; t++) {
            int idx = KECCAK_PI[t];
            uint64_t tmp2 = state[idx];
            state[idx] = ROTL64(temp, KECCAK_RHO[t]);
            temp = tmp2;
        }

        for (int y = 0; y < 5; y++) {
            uint64_t row[5];
            for (int x = 0; x < 5; x++) row[x] = state[y*5+x];
            for (int x = 0; x < 5; x++)
                state[y*5+x] = row[x] ^ ((~row[(x+1)%5]) & row[(x+2)%5]);
        }

        state[0] ^= KECCAK_RC[round];
    }
}

// -- SHA3-256 / cSHAKE256 (identical to kheavyhash_kernel.cu) --

__device__ __forceinline__ void keccak_absorb_block(uint64_t state[25], const unsigned char *block) {
    for (int i = 0; i < 17; i++) {
        uint64_t lane = 0;
        for (int j = 0; j < 8; j++)
            lane |= ((uint64_t)block[i*8 + j]) << (j*8);
        state[i] ^= lane;
    }
}

__device__ void cshake256_custom(
    const unsigned char *input,
    const unsigned int input_len,
    __constant__ const unsigned char *custom,
    const unsigned int custom_len,
    unsigned char *output
) {
    uint64_t state[25];
    for (int i = 0; i < 25; i++) state[i] = 0;

    unsigned char prefix[136];
    for (int i = 0; i < 136; i++) prefix[i] = 0;
    unsigned int pos = 0;

    prefix[pos++] = 0x01;
    prefix[pos++] = 0x88;

    prefix[pos++] = 0x01;
    prefix[pos++] = 0x00;

    unsigned int custom_bitlen = custom_len * 8;
    if (custom_bitlen < 256) {
        prefix[pos++] = 0x01;
        prefix[pos++] = (unsigned char)custom_bitlen;
    } else {
        prefix[pos++] = 0x02;
        prefix[pos++] = (unsigned char)(custom_bitlen >> 8);
        prefix[pos++] = (unsigned char)(custom_bitlen & 0xFF);
    }
    for (unsigned int i = 0; i < custom_len; i++)
        prefix[pos++] = custom[i];

    keccak_absorb_block(state, prefix);
    keccak_f1600(state);

    unsigned char data_block[136];
    for (int i = 0; i < 136; i++) data_block[i] = 0;
    for (unsigned int i = 0; i < input_len; i++)
        data_block[i] = input[i];
    data_block[input_len] = 0x04;
    data_block[135] |= 0x80;

    keccak_absorb_block(state, data_block);
    keccak_f1600(state);

    for (int i = 0; i < 4; i++) {
        for (int j = 0; j < 8; j++)
            output[i*8 + j] = (unsigned char)(state[i] >> (j*8));
    }
}

__constant__ const unsigned char CUSTOM_POW_HASH[] = {
    'P', 'r', 'o', 'o', 'f', 'O', 'f', 'W', 'o', 'r', 'k', 'H', 'a', 's', 'h'
};
__constant__ const unsigned int CUSTOM_POW_HASH_LEN = 15;

__constant__ const unsigned char CUSTOM_HEAVY_HASH[] = {
    'H', 'e', 'a', 'v', 'y', 'H', 'a', 's', 'h'
};
__constant__ const unsigned int CUSTOM_HEAVY_HASH_LEN = 9;

// -- Keryx wave_mix (only kernel-side difference from kheavyhash_kernel.cu) --

__constant__ const uint64_t WAVE_MIX_KEYS[4] = {
    0x9e3779b97f4a7c15ULL,
    0x6c62272e07bb0142ULL,
    0xb5ad4eceda1ce2a9ULL,
    0x243f6a8885a308d3ULL,
};

__device__ __forceinline__ void wave_mix(unsigned char *buf) {
    uint64_t w0, w1, w2, w3;
    w0 = ((uint64_t)buf[0])       | ((uint64_t)buf[1]  << 8) | ((uint64_t)buf[2]  << 16) | ((uint64_t)buf[3]  << 24)
       | ((uint64_t)buf[4]  << 32) | ((uint64_t)buf[5]  << 40) | ((uint64_t)buf[6]  << 48) | ((uint64_t)buf[7]  << 56);
    w1 = ((uint64_t)buf[8])       | ((uint64_t)buf[9]  << 8) | ((uint64_t)buf[10] << 16) | ((uint64_t)buf[11] << 24)
       | ((uint64_t)buf[12] << 32) | ((uint64_t)buf[13] << 40) | ((uint64_t)buf[14] << 48) | ((uint64_t)buf[15] << 56);
    w2 = ((uint64_t)buf[16])      | ((uint64_t)buf[17] << 8) | ((uint64_t)buf[18] << 16) | ((uint64_t)buf[19] << 24)
       | ((uint64_t)buf[20] << 32) | ((uint64_t)buf[21] << 40) | ((uint64_t)buf[22] << 48) | ((uint64_t)buf[23] << 56);
    w3 = ((uint64_t)buf[24])      | ((uint64_t)buf[25] << 8) | ((uint64_t)buf[26] << 16) | ((uint64_t)buf[27] << 24)
       | ((uint64_t)buf[28] << 32) | ((uint64_t)buf[29] << 40) | ((uint64_t)buf[30] << 48) | ((uint64_t)buf[31] << 56);

    #pragma unroll
    for (int r = 0; r < 4; r++) {
        w0 = ROTL64(w0 + w1, 17) ^ WAVE_MIX_KEYS[r & 3];
        w2 = ROTL64(w2 + w3, 47) ^ WAVE_MIX_KEYS[(r + 2) & 3];
        w1 = ROTL64(w1 + w2, 31) ^ WAVE_MIX_KEYS[(r + 1) & 3];
        w3 = ROTL64(w3 + w0, 13) ^ WAVE_MIX_KEYS[(r + 3) & 3];
    }

    for (int i = 0; i < 8; i++) buf[i]      = (unsigned char)(w0 >> (i * 8));
    for (int i = 0; i < 8; i++) buf[8  + i] = (unsigned char)(w1 >> (i * 8));
    for (int i = 0; i < 8; i++) buf[16 + i] = (unsigned char)(w2 >> (i * 8));
    for (int i = 0; i < 8; i++) buf[24 + i] = (unsigned char)(w3 >> (i * 8));
}

// -- Mining kernel --

extern "C" {

__global__ __launch_bounds__(256) void keryxhash_mine(
    const unsigned char *pre_pow_hash,
    const uint64_t timestamp,
    const unsigned char *target,
    uint64_t base_nonce,
    const unsigned short *matrix,
    uint64_t *output_nonce,
    unsigned char *output_hash,
    unsigned int *found
)
{
    if (*found) return;

    uint64_t nonce = base_nonce + (uint64_t)(blockIdx.x * blockDim.x + threadIdx.x);

    unsigned char pow_input[80];
    for (int i = 0; i < 32; i++) pow_input[i] = pre_pow_hash[i];
    for (int i = 0; i < 8; i++) pow_input[32 + i] = (unsigned char)(timestamp >> (i*8));
    for (int i = 0; i < 32; i++) pow_input[40 + i] = 0;
    for (int i = 0; i < 8; i++) pow_input[72 + i] = (unsigned char)(nonce >> (i*8));

    unsigned char pow_hash[32];
    cshake256_custom(pow_input, 80, CUSTOM_POW_HASH, CUSTOM_POW_HASH_LEN, pow_hash);

    unsigned char vec[64];
    for (int i = 0; i < 32; i++) {
        vec[2 * i]     = pow_hash[i] >> 4;
        vec[2 * i + 1] = pow_hash[i] & 0x0F;
    }

    unsigned char product[32];
    for (int i = 0; i < 32; i++) {
        unsigned int sum1 = 0;
        unsigned int sum2 = 0;
        for (int j = 0; j < 64; j++) {
            sum1 += (unsigned int)matrix[(2 * i) * 64 + j]     * (unsigned int)vec[j];
            sum2 += (unsigned int)matrix[(2 * i + 1) * 64 + j] * (unsigned int)vec[j];
        }
        product[i] = (unsigned char)(((sum1 >> 10) << 4) | (sum2 >> 10));
    }

    for (int i = 0; i < 32; i++)
        product[i] ^= pow_hash[i];

    // Keryx-only: wave_mix ARX post-processing
    wave_mix(product);

    unsigned char hash[32];
    cshake256_custom(product, 32, CUSTOM_HEAVY_HASH, CUSTOM_HEAVY_HASH_LEN, hash);

    int meets = 1;
    for (int i = 0; i < 32; i++) {
        if (hash[i] < target[i]) { meets = 1; break; }
        if (hash[i] > target[i]) { meets = 0; break; }
    }

    if (meets) {
        unsigned int old = atomicExch(found, 1u);
        if (old == 0u) {
            *output_nonce = nonce;
            for (int i = 0; i < 32; i++) output_hash[i] = hash[i];
        }
    }
}

} // extern "C"
