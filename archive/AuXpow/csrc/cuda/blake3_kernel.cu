// Blake3 CUDA kernel for Alephium (ALPH) and Decred (DCR) mining.
//
// This kernel implements the double-Blake3 PoW used by Alephium:
//   hash = blake3(blake3(24B_nonce || headerBlob))
//
// It also works for Decred's Blake3 PoW (single Blake3 of header+nonce) when
// the caller invokes the appropriate entry function; however the current entry
// point keeps the ALPH double-Blake3 semantics because ALPH is the primary
// blake3_external coin.
//
// Each thread scans one nonce.  The 24-byte nonce is:
//   bytes[0..8]  = candidate (big-endian u64)
//   bytes[8..24] = zeros
//
// candidate = base + global_id
//
// The kernel writes the 32-byte hash to `output` if it meets the target
// (byte-wise LE comparison: hash[0..32] <= target[0..32]).

#pragma once

#include <cuda_runtime.h>
#include <stdint.h>

// Blake3 constants
__constant__ const unsigned int BLAKE3_IV[8] = {
    0x6A09E667u, 0xBB67AE85u, 0x3C6EF372u, 0xA54FF53Au,
    0x510E527Fu, 0x9B05688Cu, 0x1F83D9ABu, 0x5BE0CD19u
};

// Blake3 message schedule (7 rounds)
__constant__ const unsigned int MSG_SCHEDULE[7][16] = {
    { 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15 },
    { 2, 6, 3, 10, 7, 0, 4, 13, 1, 11, 12, 5, 9, 14, 15, 8 },
    { 3, 4, 10, 12, 13, 2, 7, 14, 6, 5, 9, 0, 11, 15, 8, 1 },
    { 10, 7, 12, 9, 14, 3, 13, 15, 4, 0, 11, 2, 5, 8, 1, 6 },
    { 12, 13, 9, 11, 15, 10, 14, 8, 7, 2, 5, 3, 0, 1, 6, 4 },
    { 9, 14, 11, 5, 8, 12, 15, 1, 13, 3, 0, 10, 2, 6, 4, 7 },
    { 11, 15, 5, 0, 1, 9, 8, 6, 14, 10, 2, 12, 3, 4, 7, 13 }
};

#define ROTR32(x, n) (((x) >> (n)) | ((x) << (32 - (n))))

#define G(m, a, b, c, d, x, y) \
    a = a + b + x; \
    d = ROTR32(d ^ a, 16); \
    c = c + d; \
    b = ROTR32(b ^ c, 12); \
    a = a + b + y; \
    d = ROTR32(d ^ a, 8); \
    c = c + d; \
    b = ROTR32(b ^ c, 7);

__device__ void blake3_round(unsigned int state[16], const unsigned int msg[16], int round) {
    __constant__ const unsigned int *s = MSG_SCHEDULE[round];
    unsigned int m[16];
    for (int i = 0; i < 16; i++) m[i] = msg[s[i]];

    G(m, state[0], state[4], state[8],  state[12], m[0], m[1]);
    G(m, state[1], state[5], state[9],  state[13], m[2], m[3]);
    G(m, state[2], state[6], state[10], state[14], m[4], m[5]);
    G(m, state[3], state[7], state[11], state[15], m[6], m[7]);
    G(m, state[0], state[5], state[10], state[15], m[8], m[9]);
    G(m, state[1], state[6], state[11], state[12], m[10], m[11]);
    G(m, state[2], state[7], state[8],  state[13], m[12], m[13]);
    G(m, state[3], state[4], state[9],  state[14], m[14], m[15]);
}

// Blake3 flags
#define CHUNK_START 1u
#define CHUNK_END   2u
#define PARENT      4u
#define ROOT        8u

// Compress a 64-byte block.  Writes the 8-word chaining value into `out8`.
__device__ void blake3_compress8(
    const unsigned int chain[8],
    const unsigned char block[64],
    uint64_t counter,
    unsigned int block_len,
    unsigned int flags,
    unsigned int out8[8]
) {
    unsigned int state[16];
    for (int i = 0; i < 8; i++) state[i] = chain[i];
    for (int i = 0; i < 8; i++) state[8 + i] = BLAKE3_IV[i];

    state[12] = (unsigned int)(counter & 0xFFFFFFFFULL);
    state[13] = (unsigned int)(counter >> 32);
    state[14] = block_len;
    state[15] = flags;

    unsigned int msg[16];
    for (int i = 0; i < 16; i++) {
        int j = i * 4;
        msg[i] = (unsigned int)block[j]
               | ((unsigned int)block[j + 1] << 8)
               | ((unsigned int)block[j + 2] << 16)
               | ((unsigned int)block[j + 3] << 24);
    }

    for (int r = 0; r < 7; r++) {
        blake3_round(state, msg, r);
    }

    for (int i = 0; i < 8; i++) {
        out8[i] = state[i] ^ state[i + 8];
    }
}

// Compress a 64-byte block and produce the full 16-word output (used for root).
__device__ void blake3_compress16(
    const unsigned int chain[8],
    const unsigned char block[64],
    uint64_t counter,
    unsigned int block_len,
    unsigned int flags,
    unsigned int out16[16]
) {
    unsigned int state[16];
    for (int i = 0; i < 8; i++) state[i] = chain[i];
    for (int i = 0; i < 8; i++) state[8 + i] = BLAKE3_IV[i];

    state[12] = (unsigned int)(counter & 0xFFFFFFFFULL);
    state[13] = (unsigned int)(counter >> 32);
    state[14] = block_len;
    state[15] = flags;

    unsigned int msg[16];
    for (int i = 0; i < 16; i++) {
        int j = i * 4;
        msg[i] = (unsigned int)block[j]
               | ((unsigned int)block[j + 1] << 8)
               | ((unsigned int)block[j + 2] << 16)
               | ((unsigned int)block[j + 3] << 24);
    }

    for (int r = 0; r < 7; r++) {
        blake3_round(state, msg, r);
    }

    for (int i = 0; i < 8; i++) {
        out16[i]     = state[i] ^ state[i + 8];
        out16[i + 8] = state[i + 8] ^ chain[i];
    }
}

// Compute inner blake3(nonce || header).  `inner_out` receives the 8-word (32B)
// chaining value.  Supports messages up to 360 bytes (enough for ALPH headers).
__device__ void blake3_inner(
    const unsigned char nonce[24],
    const unsigned char *header_blob,
    const unsigned int header_len,
    unsigned int inner_out[8]
) {
    unsigned int chain[8];
    for (int i = 0; i < 8; i++) chain[i] = BLAKE3_IV[i];

    unsigned int total_len = 24u + header_len;
    unsigned int full_blocks = total_len / 64u;
    unsigned int tail_len = total_len % 64u;
    if (tail_len == 0u && full_blocks > 0u) {
        tail_len = 64u;
        full_blocks -= 1u;
    }

    // Build a local 360-byte buffer: nonce || header, zero-padded.
    // This is small enough for private memory on modern GPUs.
    unsigned char msg[360];
    for (int i = 0; i < 24; i++) msg[i] = nonce[i];
    for (int i = 0; i < (int)header_len; i++) msg[24 + i] = header_blob[i];
    for (int i = (int)(24u + header_len); i < 360; i++) msg[i] = 0;

    for (unsigned int b = 0u; b < full_blocks; b++) {
        unsigned char block[64];
        int off = (int)(b * 64u);
        for (int i = 0; i < 64; i++) block[i] = msg[off + i];
        unsigned int flags = (b == 0u) ? CHUNK_START : 0u;
        blake3_compress8(chain, block, 0u, 64u, flags, chain);
    }

    // Last/tail block
    {
        unsigned char block[64];
        int off = (int)(full_blocks * 64u);
        for (int i = 0; i < 64; i++) {
            int idx = off + i;
            block[i] = (idx < 360) ? msg[idx] : 0;
        }
        unsigned int flags = (full_blocks == 0u) ? (CHUNK_START | CHUNK_END) : CHUNK_END;
        // The inner hash is the root output of the inner message, not the
        // chaining value. Use compress16 with ROOT and keep the first 8 words.
        unsigned int out16[16];
        blake3_compress16(chain, block, 0u, tail_len, flags | ROOT, out16);
        for (int i = 0; i < 8; i++) {
            inner_out[i] = out16[i];
        }
    }
}

extern "C" {

__global__ __launch_bounds__(256) void blake3_alph_mine(
    const unsigned char *header_blob,
    const unsigned int header_len,
    const unsigned char *target,
    uint64_t base_nonce,
    uint64_t *output_nonce,
    unsigned char *output_hash,
    unsigned int *found
)
{
    if (*found) return;

    uint64_t candidate = base_nonce + (uint64_t)(blockIdx.x * blockDim.x + threadIdx.x);

    unsigned char nonce[24];
    nonce[0] = (unsigned char)(candidate >> 56);
    nonce[1] = (unsigned char)(candidate >> 48);
    nonce[2] = (unsigned char)(candidate >> 40);
    nonce[3] = (unsigned char)(candidate >> 32);
    nonce[4] = (unsigned char)(candidate >> 24);
    nonce[5] = (unsigned char)(candidate >> 16);
    nonce[6] = (unsigned char)(candidate >> 8);
    nonce[7] = (unsigned char)(candidate);
    for (int i = 8; i < 24; i++) nonce[i] = 0;

    unsigned int inner[8];
    blake3_inner(nonce, header_blob, header_len, inner);

    // Outer blake3(inner_hash) with ROOT flag.
    unsigned char block[64];
    for (int i = 0; i < 32; i++) {
        block[i] = (unsigned char)(inner[i / 4] >> ((i % 4) * 8));
    }
    for (int i = 32; i < 64; i++) block[i] = 0;

    unsigned int chain[8];
    for (int i = 0; i < 8; i++) chain[i] = BLAKE3_IV[i];

    unsigned int out16[16];
    blake3_compress16(chain, block, 0u, 32u, CHUNK_START | CHUNK_END | ROOT, out16);

    unsigned char hash[32];
    for (int i = 0; i < 8; i++) {
        hash[i * 4 + 0] = (unsigned char)(out16[i]);
        hash[i * 4 + 1] = (unsigned char)(out16[i] >> 8);
        hash[i * 4 + 2] = (unsigned char)(out16[i] >> 16);
        hash[i * 4 + 3] = (unsigned char)(out16[i] >> 24);
    }

    int meets = 1;
    for (int i = 0; i < 32; i++) {
        if (hash[i] < target[i]) { meets = 1; break; }
        if (hash[i] > target[i]) { meets = 0; break; }
    }

    if (meets) {
        unsigned int old = atomicExch(found, 1u);
        if (old == 0u) {
            *output_nonce = candidate;
            for (int i = 0; i < 32; i++) output_hash[i] = hash[i];
        }
    }
}

// -- DCR (Decred) Blake3 mining kernel --
//
// Decred BLAKE3 (DCP-0011) hashes the full 180-byte block header.  The
// pool provides a 180-byte header template with a zeroed 4-byte nonce at
// offset 140.  We insert the candidate 4-byte little-endian nonce at that
// offset and hash the header.
//
// DCP-0011 requires the PoW hash to be compared against the target as a
// little-endian 256-bit integer, so the kernel reverses the hash bytes
// before comparing to the big-endian target bytes supplied by the pool.

__global__ __launch_bounds__(256) void blake3_dcr_mine(
    const unsigned char *header_blob,
    const unsigned int header_len,
    const unsigned char *target,
    uint64_t base_nonce,
    uint64_t *output_nonce,
    unsigned char *output_hash,
    unsigned int *found
)
{
    if (*found) return;

    uint64_t nonce = base_nonce + (uint64_t)(blockIdx.x * blockDim.x + threadIdx.x);

    // Build the full 180-byte DCR block header.
    unsigned char full_header[180];
    for (int i = 0; i < 180; i++) full_header[i] = 0;
    unsigned int copy_len = header_len < 180u ? header_len : 180u;
    for (unsigned int i = 0u; i < copy_len; i++) full_header[i] = header_blob[i];

    // Insert the 4-byte little-endian nonce at offset 140.
    full_header[140] = (unsigned char)(nonce);
    full_header[141] = (unsigned char)(nonce >> 8);
    full_header[142] = (unsigned char)(nonce >> 16);
    full_header[143] = (unsigned char)(nonce >> 24);

    const unsigned int total_len = 180u;

    // Blake3 hash of full_header[0..total_len]
    unsigned int chain[8];
    for (int i = 0; i < 8; i++) chain[i] = BLAKE3_IV[i];

    unsigned int full_blocks = total_len / 64u;
    unsigned int tail_len = total_len % 64u;
    if (tail_len == 0u && full_blocks > 0u) {
        tail_len = 64u;
        full_blocks -= 1u;
    }

    for (unsigned int b = 0u; b < full_blocks; b++) {
        unsigned char block[64];
        int off = (int)(b * 64u);
        for (int i = 0; i < 64; i++) block[i] = full_header[off + i];
        unsigned int flags = (b == 0u) ? CHUNK_START : 0u;
        blake3_compress8(chain, block, 0u, 64u, flags, chain);
    }

    // Last/tail block
    {
        unsigned char block[64];
        int off = (int)(full_blocks * 64u);
        for (int i = 0; i < 64; i++) {
            int idx = off + i;
            block[i] = (idx < (int)total_len) ? full_header[idx] : 0;
        }
        unsigned int flags = (full_blocks == 0u) ? (CHUNK_START | CHUNK_END) : CHUNK_END;
        // Root compression: use compress16 to get full 16-word output
        unsigned int out16[16];
        blake3_compress16(chain, block, 0u, tail_len, flags | ROOT, out16);

        // Store hash as little-endian bytes to match DCP-0011 ordering.
        unsigned char hash[32];
        for (int i = 0; i < 8; i++) {
            hash[i * 4 + 0] = (unsigned char)(out16[i]);
            hash[i * 4 + 1] = (unsigned char)(out16[i] >> 8);
            hash[i * 4 + 2] = (unsigned char)(out16[i] >> 16);
            hash[i * 4 + 3] = (unsigned char)(out16[i] >> 24);
        }

        // DCR compares the hash as a little-endian integer against the
        // big-endian target bytes: reverse the hash before comparing.
        int meets = 1;
        for (int i = 0; i < 32; i++) {
            unsigned char h = hash[31 - i];
            if (h < target[i]) { meets = 1; break; }
            if (h > target[i]) { meets = 0; break; }
        }

        if (meets) {
            unsigned int old = atomicExch(found, 1u);
            if (old == 0u) {
                *output_nonce = nonce;
                for (int i = 0; i < 32; i++) output_hash[i] = hash[i];
            }
        }
    }
}

} // extern "C"
