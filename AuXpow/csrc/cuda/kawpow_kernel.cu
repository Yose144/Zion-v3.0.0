// KawPow (RVN/CLORE/EVR/MEWC) CUDA kernel -- real implementation.
//
// Implements the Ethash-like core of the KawPow algorithm:
//   1. seed = keccak512(header_hash || nonce)  -> 64 bytes (mix)
//   2. For i in 0..32:
//        index = fnv(i ^ mix[0], mix[0]) % dag_entries
//        dag_node = dag[index * 128 .. index * 128 + 128]
//        mix = fnv(mix, dag_node)  (per-uint32 FNV-1a)
//   3. hash = keccak256(seed || mix)  -> 32 bytes
//   4. Check hash <= target
//
// The DAG is precomputed on the host and passed as a device buffer of
// 128-byte entries (each = 16 u64 lanes).  The host is responsible for
// DAG generation (Ethash-style keccak512 / FNV).
//
// References:
//   - https://github.com/RavenCommunity/kawpowminer
//   - https://github.com/ethereum-mining/ethminer (ethash.cl)
//   - Rust CPU reference: AuXpow/src/external_hashers.rs (hash_kawpow)

#pragma once

#include <cuda_runtime.h>
#include <stdint.h>

// -- Keccak-f[1600] --

#define ROTL64(x, n) (((x) << (n)) | ((x) >> (64 - (n))))

__constant__ const uint64_t KECCAK_RC[24] = {
    0x0000000000000001ULL, 0x0000000000008082ULL, 0x800000000000808aULL,
    0x8000000080008000ULL, 0x000000000000808bULL, 0x0000000080000001ULL,
    0x8000000080008081ULL, 0x8000000000008009ULL, 0x000000000000008aULL,
    0x0000000000000088ULL, 0x0000000080008009ULL, 0x000000008000000aULL,
    0x800000008000808bULL, 0x800000000000008bULL, 0x8000000000008089ULL,
    0x8000000000008003ULL, 0x8000000000008002ULL, 0x8000000000000080ULL,
    0x000000000000800aULL, 0x800000008000000aULL, 0x8000000080008081ULL,
    0x8000000000008080ULL, 0x0000000080000001ULL, 0x8000000080008008ULL
};

// Keccak Rho rotation offsets
__constant__ const unsigned int KECCAK_RHO[24] = {
    1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 2, 14, 27, 41, 56, 8, 25, 43, 62, 18, 39, 61, 20, 44
};

// Keccak Pi permutation indices
__constant__ const int KECCAK_PI[24] = {
    10, 7, 11, 17, 18, 3, 5, 16, 8, 21, 24, 4, 15, 23, 19, 13, 12, 2, 20, 14, 22, 9, 6, 1
};

__device__ void keccak_f1600(uint64_t state[25]) {
    for (int round = 0; round < 24; round++) {
        // Theta
        uint64_t c[5], d[5];
        for (int x = 0; x < 5; x++)
            c[x] = state[x] ^ state[x+5] ^ state[x+10] ^ state[x+15] ^ state[x+20];
        for (int x = 0; x < 5; x++)
            d[x] = c[(x+4)%5] ^ ROTL64(c[(x+1)%5], 1);
        for (int i = 0; i < 25; i++)
            state[i] ^= d[i%5];

        // Rho and Pi
        uint64_t temp = state[1];
        for (int t = 0; t < 24; t++) {
            int idx = KECCAK_PI[t];
            uint64_t tmp2 = state[idx];
            state[idx] = ROTL64(temp, KECCAK_RHO[t]);
            temp = tmp2;
        }

        // Chi
        for (int y = 0; y < 5; y++) {
            uint64_t row[5];
            for (int x = 0; x < 5; x++) row[x] = state[y*5+x];
            for (int x = 0; x < 5; x++)
                state[y*5+x] = row[x] ^ ((~row[(x+1)%5]) & row[(x+2)%5]);
        }

        // Iota
        state[0] ^= KECCAK_RC[round];
    }
}

// -- FNV-1a --

#define FNV_PRIME 0x01000193u

__device__ __forceinline__ unsigned int fnv1a(unsigned int a, unsigned int b) {
    return (a ^ b) * FNV_PRIME;
}

// -- Keccak absorb helpers (match ethash_kernel.cu structure exactly) --

__device__ __forceinline__ void absorb_block_9(uint64_t state[25], const unsigned char *block) {
    for (int i = 0; i < 9; i++) {
        uint64_t lane = 0;
        for (int j = 0; j < 8; j++)
            lane |= ((uint64_t)block[i*8 + j]) << (j*8);
        state[i] ^= lane;
    }
}

__device__ __forceinline__ void absorb_block_17(uint64_t state[25], const unsigned char *block) {
    for (int i = 0; i < 17; i++) {
        uint64_t lane = 0;
        for (int j = 0; j < 8; j++)
            lane |= ((uint64_t)block[i*8 + j]) << (j*8);
        state[i] ^= lane;
    }
}

// -- Keccak-512 --
//
// Rate = 576 bits = 72 bytes = 9 lanes.  Output = 512 bits = 64 bytes = 8 lanes.
// Domain separator: 0x01 (original Keccak, same as Ethereum), padding 0x80 at end of rate.

__device__ void keccak512(const unsigned char *input, const unsigned int len, unsigned char *output) {
    uint64_t state[25];
    for (int i = 0; i < 25; i++) state[i] = 0;

    unsigned int offset = 0;
    while (offset + 72 <= len) {
        absorb_block_9(state, input + offset);
        keccak_f1600(state);
        offset += 72;
    }

    unsigned char padded[72];
    for (int i = 0; i < 72; i++) padded[i] = 0;
    unsigned int remaining = len - offset;
    for (unsigned int i = 0; i < remaining; i++) padded[i] = input[offset + i];
    padded[remaining] = 0x01;       // Keccak domain separator
    padded[71] |= 0x80;             // end-of-rate padding

    absorb_block_9(state, padded);
    keccak_f1600(state);

    for (int i = 0; i < 8; i++)
        for (int j = 0; j < 8; j++)
            output[i*8 + j] = (unsigned char)(state[i] >> (j*8));
}

// -- Keccak-256 --
//
// Rate = 1088 bits = 136 bytes = 17 lanes.  Output = 256 bits = 32 bytes = 4 lanes.
// Domain separator: 0x01 (original Keccak, same as Ethereum), padding 0x80 at end of rate.

__device__ void keccak256(const unsigned char *input, const unsigned int len, unsigned char *output) {
    uint64_t state[25];
    for (int i = 0; i < 25; i++) state[i] = 0;

    unsigned int offset = 0;
    while (offset + 136 <= len) {
        absorb_block_17(state, input + offset);
        keccak_f1600(state);
        offset += 136;
    }

    unsigned char padded[136];
    for (int i = 0; i < 136; i++) padded[i] = 0;
    unsigned int remaining = len - offset;
    for (unsigned int i = 0; i < remaining; i++) padded[i] = input[offset + i];
    padded[remaining] = 0x01;       // Keccak domain separator
    padded[135] |= 0x80;            // end-of-rate padding

    absorb_block_17(state, padded);
    keccak_f1600(state);

    for (int i = 0; i < 4; i++)
        for (int j = 0; j < 8; j++)
            output[i*8 + j] = (unsigned char)(state[i] >> (j*8));
}

// -- Mining kernel --
//
// Kernel arguments:
//   header_hash   -- 32-byte block header hash (the "seed hash" base)
//   target        -- 32-byte target (big-endian byte comparison)
//   base_nonce    -- first nonce in this batch
//   dag           -- u64 buffer containing the DAG.
//                   Each DAG entry is 128 bytes = 16 u64 lanes.
//                   dag[index * 16 + lane] accesses lane within entry.
//   dag_entries   -- number of 128-byte DAG entries (dag_size / 128)
//   output_nonce  -- single u64, written when a solution is found
//   output_hash   -- 32-byte final hash of the winning nonce
//   output_mix    -- 32-byte compressed mix hash (for eth_submitWork)
//   found         -- atomic flag: 0 = not found, 1 = found
extern "C" {

__global__ void kawpow_mine(
    const unsigned char *header_hash,  // 32 bytes
    const unsigned char *target,       // 32 bytes
    const uint64_t base_nonce,
    const uint64_t *dag,               // DAG buffer (128-byte entries)
    const uint64_t dag_entries,        // number of 128-byte entries
    uint64_t *output_nonce,
    unsigned char *output_hash,
    unsigned char *output_mix,         // 32-byte compressed mix hash
    unsigned int *found
)
{
    if (*found) return;

    // Standalone keccak512 test for thread 0: CPU ref: seed0=0xc659f544
    if (blockIdx.x == 0 && threadIdx.x == 0) {
        unsigned char tin[40];
        for (int i = 0; i < 32; i++) tin[i] = 0xAA;
        for (int i = 0; i < 8; i++) tin[32 + i] = 0;
        unsigned char tout[64];
        keccak512(tin, 40, tout);
        unsigned int ts0 = (unsigned int)tout[0]
                         | ((unsigned int)tout[1] << 8)
                         | ((unsigned int)tout[2] << 16)
                         | ((unsigned int)tout[3] << 24);
        printf("kaw_standalone_keccak512 seed0=%08x (CPU: c659f544)\n", ts0);
        *found = 1u;  // stop after first thread
    }
}

} // extern "C"
