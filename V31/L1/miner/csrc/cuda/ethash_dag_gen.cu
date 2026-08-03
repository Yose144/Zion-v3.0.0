// Ethash/Kawpow DAG generation CUDA kernel.
//
// Computes DAG nodes in parallel on the GPU from a precomputed light cache.
// The light cache (~16-100 MB) is generated on the CPU and uploaded once;
// then this kernel fills the full DAG buffer (1-6 GB) on the GPU.
//
// Algorithm per DAG node (matching the Ethash spec):
//   1. mix = cache[node_index % cache_items]
//   2. mix[0] ^= node_index
//   3. mix = keccak512(mix)
//   4. for i in 0..255:
//        parent = fnv1a(node_index ^ i, mix[0]) % cache_items
//        mix = fnv1a(mix, cache[parent])   (per 32-bit word)
//   5. mix = keccak512(mix)
//   6. dag[node_index] = mix
//
// Each DAG node is 64 bytes (8 u64). A DAG *entry* is 128 bytes = 2 nodes.
// We compute nodes independently — one thread per node.
//
// Kernel arguments:
//   start         -- first node index in this batch
//   light_cache   -- precomputed light cache (u64 buffer, 8 u64 per 64-byte item)
//   light_items   -- number of 64-byte cache items
//   dag           -- output DAG buffer (u64, 8 u64 per 64-byte node)
//   dag_nodes     -- total number of nodes to compute (start..start+dag_nodes)

#pragma once

#include <cuda_runtime.h>
#include <stdint.h>

// ── Keccak-f[1600] ── (same as ethash_kernel.cu)

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
        // Theta
        uint64_t c[5], d[5];
        for (int i = 0; i < 5; i++)
            c[i] = state[i] ^ state[i + 5] ^ state[i + 10] ^ state[i + 15] ^ state[i + 20];
        for (int i = 0; i < 5; i++)
            d[i] = c[(i + 4) % 5] ^ ROTL64(c[(i + 1) % 5], 1);
        for (int i = 0; i < 25; i++)
            state[i] ^= d[i % 5];

        // Rho + Pi
        uint64_t t = state[1];
        for (int i = 0; i < 24; i++) {
            int j = KECCAK_PI[i];
            uint64_t tmp = state[j];
            state[j] = ROTL64(t, KECCAK_RHO[i]);
            t = tmp;
        }

        // Chi
        for (int j = 0; j < 25; j += 5) {
            uint64_t t0 = state[j], t1 = state[j + 1], t2 = state[j + 2];
            uint64_t t3 = state[j + 3], t4 = state[j + 4];
            state[j] = t0 ^ (~t1 & t2);
            state[j + 1] = t1 ^ (~t2 & t3);
            state[j + 2] = t2 ^ (~t3 & t4);
            state[j + 3] = t3 ^ (~t4 & t0);
            state[j + 4] = t4 ^ (~t0 & t1);
        }

        // Iota
        state[0] ^= KECCAK_RC[round];
    }
}

// Keccak-512: rate=72 bytes, output=64 bytes, domain suffix=0x01
__device__ void keccak512_dev(const unsigned char *input, const unsigned int len, unsigned char *output) {
    uint64_t state[25];
    for (int i = 0; i < 25; i++) state[i] = 0;

    unsigned int offset = 0;
    while (offset + 72 <= len) {
        for (int i = 0; i < 9; i++) {
            uint64_t lane = 0;
            for (int j = 0; j < 8; j++)
                lane |= ((uint64_t)input[offset + i * 8 + j]) << (j * 8);
            state[i] ^= lane;
        }
        keccak_f1600(state);
        offset += 72;
    }

    // Padding: 0x01 || 0x00... || 0x80
    unsigned char block[72];
    for (int i = 0; i < 72; i++) block[i] = 0;
    unsigned int rem = len - offset;
    for (int i = 0; i < rem; i++) block[i] = input[offset + i];
    block[rem] = 0x01;
    block[71] |= 0x80;

    for (int i = 0; i < 9; i++) {
        uint64_t lane = 0;
        for (int j = 0; j < 8; j++)
            lane |= ((uint64_t)block[i * 8 + j]) << (j * 8);
        state[i] ^= lane;
    }
    keccak_f1600(state);

    // Extract 64 bytes
    for (int i = 0; i < 8; i++) {
        for (int j = 0; j < 8; j++)
            output[i * 8 + j] = (unsigned char)(state[i] >> (j * 8));
    }
}

// FNV-1a for u32
__device__ __forceinline__ unsigned int fnv1a_dag(unsigned int a, unsigned int b) {
    return (a * 0x01000193u) ^ b;
}

#define ETHASH_DATASET_PARENTS 256

// DAG generation kernel: one thread per DAG node.
// Each node is 64 bytes = 8 u64.
// The light cache is stored as u64 (8 u64 per 64-byte item).
// The DAG is stored as u64 (8 u64 per 64-byte node).
extern "C" {

__global__ __launch_bounds__(256) void ethash_calculate_dag(
    const uint64_t start,           // first node index in this batch
    const uint64_t *light_cache,    // light cache buffer (8 u64 per item)
    const uint64_t light_items,     // number of cache items
    uint64_t *dag,                  // output DAG buffer (8 u64 per node)
    const uint64_t dag_nodes        // total number of nodes to compute
)
{
    const uint64_t node_index = start + (uint64_t)(blockIdx.x * blockDim.x + threadIdx.x);
    // The host rounds the grid size up to a multiple of the block size, so
    // extra threads beyond the DAG end must return early.  The previous
    // `light_items * 4` limit was wrong: it terminated ~98% of threads for
    // large epochs (e.g. epoch 126 has ~50M DAG nodes but only ~278K cache
    // items, so light_items*4 ≈ 1.1M), leaving most of the DAG as zeros.
    if (node_index >= dag_nodes)
        return;

    // Step 1: mix = cache[node_index % light_items]
    unsigned char mix_bytes[64];
    const uint64_t cache_idx = node_index % light_items;
    const uint64_t *cache_node = light_cache + cache_idx * 8;
    for (int i = 0; i < 8; i++) {
        uint64_t w = cache_node[i];
        for (int j = 0; j < 8; j++)
            mix_bytes[i * 8 + j] = (unsigned char)(w >> (j * 8));
    }

    // Step 2: XOR the first 32-bit word of mix with (node_index as uint32).
    // Ethash/ProgPoW uses the low 32 bits of the node index only.
    unsigned int node_index_lo = (unsigned int)node_index;
    for (int j = 0; j < 4; j++)
        mix_bytes[j] ^= (unsigned char)(node_index_lo >> (j * 8));

    // Step 3: mix = keccak512(mix)
    unsigned char hash[64];
    keccak512_dev(mix_bytes, 64, hash);

    // Convert hash to u32 words for FNV mixing
    unsigned int mix_words[16];
    for (int i = 0; i < 16; i++)
        mix_words[i] = (unsigned int)hash[i * 4]
                     | ((unsigned int)hash[i * 4 + 1] << 8)
                     | ((unsigned int)hash[i * 4 + 2] << 16)
                     | ((unsigned int)hash[i * 4 + 3] << 24);

    // Step 4: 256 parent lookups with FNV mixing
    for (unsigned int i = 0; i < ETHASH_DATASET_PARENTS; i++) {
        unsigned int parent_index = fnv1a_dag((unsigned int)node_index ^ i, mix_words[i % 16]) % (unsigned int)light_items;
        const uint64_t *parent = light_cache + (uint64_t)parent_index * 8;

        for (int j = 0; j < 16; j++) {
            unsigned int parent_word;
            int byte_off = j * 4;
            uint64_t qw = parent[byte_off / 8];
            if (byte_off % 8 == 0)
                parent_word = (unsigned int)(qw & 0xFFFFFFFFu);
            else
                parent_word = (unsigned int)(qw >> 32);
            mix_words[j] = fnv1a_dag(mix_words[j], parent_word);
        }
    }

    // Step 5: mix = keccak512(mix_words)
    unsigned char mix_out[64];
    for (int i = 0; i < 16; i++) {
        mix_out[i * 4]     = (unsigned char)(mix_words[i]);
        mix_out[i * 4 + 1] = (unsigned char)(mix_words[i] >> 8);
        mix_out[i * 4 + 2] = (unsigned char)(mix_words[i] >> 16);
        mix_out[i * 4 + 3] = (unsigned char)(mix_words[i] >> 24);
    }
    unsigned char final_hash[64];
    keccak512_dev(mix_out, 64, final_hash);

    // Step 6: Write to DAG (8 u64 per node)
    uint64_t *dag_node = dag + node_index * 8;
    for (int i = 0; i < 8; i++) {
        uint64_t w = 0;
        for (int j = 0; j < 8; j++)
            w |= ((uint64_t)final_hash[i * 8 + j]) << (j * 8);
        dag_node[i] = w;
    }
}

} // extern "C"
