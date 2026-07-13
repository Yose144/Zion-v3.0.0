// Ethash / Etchash (ETC/ETHW) Metal kernel -- REAL implementation.
//
// Implements the full Ethash DAG-based Proof-of-Work algorithm used by
// Ethereum Classic (ETC) and EthereumPoW (ETHW):
//
//   1. seed   = Keccak-512(header_hash || nonce_le)            -> 64 bytes
//   2. mix    = seed concatenated with itself                  -> 128 bytes (32 x u32)
//   3. for i in 0..63 (64 DAG accesses):
//        index = fnv1a(i ^ mix[0], mix[0]) % dag_size_entries
//        node  = dag[index]                                    -> 128 bytes (16 x u64)
//        mix   = fnv1a(mix, node)  per 32-bit word
//   4. compress mix: XOR-fold each group of 4 u32 words via FNV -> 32 bytes (8 x u32)
//   5. hash   = Keccak-256(seed || compressed_mix)             -> 32 bytes
//   6. check hash <= target (big-endian byte comparison)
//
// Keccak here uses the ORIGINAL Keccak domain suffix (0x01), NOT the
// NIST SHA-3 suffix (0x06).  Ethereum uses Keccak-256/Keccak-512.
//
// The DAG is a per-epoch precomputed buffer of 128-byte entries that is
// generated on the host (from a seed hash via Keccak-512 graph expansion)
// and uploaded once as a device ulong buffer.  Each DAG entry is 16 u64
// words (128 bytes).  dag_size is the number of 128-byte entries.
//
// References:
//   - https://github.com/ethereum-mining/ethminer (libethash-cl/kernels/cl/ethash.cl)
//   - https://github.com/Genoil/cpp-ethereum (libethash-cl/ethash_cl_miner_kernel.cl)
//   - Rust CPU reference: AuXpow/src/external_hashers.rs (hash_ethash)
//   - Keccak-f[1600] pattern reused from kheavyhash_kernel.cl
//
// Translated from opencl/ethash_kernel.cl.

#include <metal_stdlib>
using namespace metal;

// -- Keccak-f[1600] ---------------------------------------------------

constant const ulong KECCAK_RC[24] = {
    0x0000000000000001UL, 0x0000000000008082UL, 0x800000000000808aUL,
    0x8000000080008000UL, 0x000000000000808bUL, 0x0000000080000001UL,
    0x8000000080008081UL, 0x8000000000008009UL, 0x000000000000008aUL,
    0x0000000000000088UL, 0x0000000080008009UL, 0x000000008000000aUL,
    0x000000008000808bUL, 0x800000000000008bUL, 0x8000000000008089UL,
    0x8000000000008003UL, 0x8000000000008002UL, 0x8000000000000080UL,
    0x000000000000800aUL, 0x800000008000000aUL, 0x8000000080008081UL,
    0x8000000000008080UL, 0x0000000080000001UL, 0x8000000080008008UL
};

// Keccak Rho rotation offsets
constant const uint KECCAK_RHO[24] = {
    1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 2, 14, 27, 41, 56, 8, 25, 43, 62, 18, 39, 61, 20, 44
};

// Keccak Pi permutation indices
constant const int KECCAK_PI[24] = {
    10, 7, 11, 17, 18, 3, 5, 16, 8, 21, 24, 4, 15, 23, 19, 13, 12, 2, 20, 14, 22, 9, 6, 1
};

#define ROTL64(x, n) (((x) << (n)) | ((x) >> (64 - (n))))

void keccak_f1600(thread ulong state[25]) {
    for (int round = 0; round < 24; round++) {
        // Theta
        ulong c[5], d[5];
        for (int x = 0; x < 5; x++)
            c[x] = state[x] ^ state[x+5] ^ state[x+10] ^ state[x+15] ^ state[x+20];
        for (int x = 0; x < 5; x++)
            d[x] = c[(x+4)%5] ^ ROTL64(c[(x+1)%5], 1);
        for (int i = 0; i < 25; i++)
            state[i] ^= d[i%5];

        // Rho and Pi
        ulong temp = state[1];
        for (int t = 0; t < 24; t++) {
            int idx = KECCAK_PI[t];
            ulong tmp2 = state[idx];
            state[idx] = ROTL64(temp, KECCAK_RHO[t]);
            temp = tmp2;
        }

        // Chi
        for (int y = 0; y < 5; y++) {
            ulong row[5];
            for (int x = 0; x < 5; x++) row[x] = state[y*5+x];
            for (int x = 0; x < 5; x++)
                state[y*5+x] = row[x] ^ ((~row[(x+1)%5]) & row[(x+2)%5]);
        }

        // Iota
        state[0] ^= KECCAK_RC[round];
    }
}

// -- Keccak-512 (rate 72 bytes = 9 lanes, output 64 bytes = 8 lanes) --
//
// Uses the original Keccak domain suffix 0x01 (Ethereum's Keccak-512),
// NOT the NIST SHA3-512 suffix 0x06.

inline void absorb_block_9(thread ulong state[25], thread const uchar *block) {
    for (int i = 0; i < 9; i++) {
        ulong lane = 0;
        for (int j = 0; j < 8; j++)
            lane |= ((ulong)block[i*8 + j]) << (j*8);
        state[i] ^= lane;
    }
}

void keccak512(thread const uchar *input, const uint len, thread uchar *output) {
    ulong state[25];
    for (int i = 0; i < 25; i++) state[i] = 0;

    uint offset = 0;
    while (offset + 72 <= len) {
        absorb_block_9(state, input + offset);
        keccak_f1600(state);
        offset += 72;
    }

    uchar padded[72];
    for (int i = 0; i < 72; i++) padded[i] = 0;
    uint remaining = len - offset;
    for (int i = 0; i < (int)remaining; i++) padded[i] = input[offset + i];
    padded[remaining] = 0x01;   // Keccak domain suffix
    padded[71] |= 0x80;         // end-of-rate padding

    absorb_block_9(state, padded);
    keccak_f1600(state);

    for (int i = 0; i < 8; i++)
        for (int j = 0; j < 8; j++)
            output[i*8 + j] = (uchar)(state[i] >> (j*8));
}

// -- Keccak-256 (rate 136 bytes = 17 lanes, output 32 bytes = 4 lanes) --
//
// Uses the original Keccak domain suffix 0x01 (Ethereum's Keccak-256),
// NOT the NIST SHA3-256 suffix 0x06.

inline void absorb_block_17(thread ulong state[25], thread const uchar *block) {
    for (int i = 0; i < 17; i++) {
        ulong lane = 0;
        for (int j = 0; j < 8; j++)
            lane |= ((ulong)block[i*8 + j]) << (j*8);
        state[i] ^= lane;
    }
}

void keccak256(thread const uchar *input, const uint len, thread uchar *output) {
    ulong state[25];
    for (int i = 0; i < 25; i++) state[i] = 0;

    uint offset = 0;
    while (offset + 136 <= len) {
        absorb_block_17(state, input + offset);
        keccak_f1600(state);
        offset += 136;
    }

    uchar padded[136];
    for (int i = 0; i < 136; i++) padded[i] = 0;
    uint remaining = len - offset;
    for (int i = 0; i < (int)remaining; i++) padded[i] = input[offset + i];
    padded[remaining] = 0x01;   // Keccak domain suffix
    padded[135] |= 0x80;        // end-of-rate padding

    absorb_block_17(state, padded);
    keccak_f1600(state);

    for (int i = 0; i < 4; i++)
        for (int j = 0; j < 8; j++)
            output[i*8 + j] = (uchar)(state[i] >> (j*8));
}

// -- FNV-1a (32-bit) --------------------------------------------------

#define FNV_PRIME 0x01000193u

inline uint fnv1a(uint a, uint b) {
    return (a ^ b) * FNV_PRIME;
}

// -- Mining kernel ----------------------------------------------------
//
// Kernel arguments:
//   header_hash   -- 32-byte Keccak-256 of the block header (without nonce/mix)
//   target        -- 32-byte target (big-endian byte comparison)
//   nonce_base    -- first nonce in this batch
//   stride        -- nonce spacing between work-items (host typically passes 1)
//   dag           -- precomputed DAG buffer (device ulong *), 16 u64 per entry
//   dag_size      -- number of 128-byte DAG entries
//   output_nonce  -- single u64, written when a solution is found
//   output_hash   -- 32-byte final hash of the winning nonce
//   output_mix    -- 32-byte compressed mix hash (for eth_submitWork)
//   found         -- atomic flag: 0 = not found, 1 = found
//
// Each work-item computes Ethash for nonce = nonce_base + gid * stride.
kernel void ethash_mine(
    device const uchar* header_hash [[buffer(0)]],   // 32 bytes
    device const uchar* target [[buffer(1)]],         // 32 bytes
    ulong nonce_base,
    ulong stride,
    device const ulong* dag [[buffer(2)]],            // DAG buffer (16 u64 per entry)
    ulong dag_size,                                    // number of 128-byte entries
    device ulong* output_nonce [[buffer(3)]],
    device uchar* output_hash [[buffer(4)]],
    device uchar* output_mix [[buffer(5)]],           // 32-byte compressed mix hash
    device uint* found [[buffer(6)]],
    uint gid [[thread_position_in_grid]]
)
{
    if (atomic_load_explicit((device atomic_uint*)found, memory_order_relaxed)) return;

    ulong nonce = nonce_base + (ulong)gid * stride;

    // -- Step 1: seed = Keccak-512(header_hash || nonce_le) -> 64 bytes --
    uchar seed_input[40];
    for (int i = 0; i < 32; i++) seed_input[i] = header_hash[i];
    for (int i = 0; i < 8; i++) seed_input[32 + i] = (uchar)(nonce >> (i*8));

    uchar seed[64];
    keccak512(seed_input, 40, seed);

    // -- Step 2: mix = seed || seed  -> 128 bytes = 32 x u32 (little-endian) --
    uint mix[32];
    for (int j = 0; j < 16; j++) {
        uint w = (uint)seed[j*4]
               | ((uint)seed[j*4 + 1] << 8)
               | ((uint)seed[j*4 + 2] << 16)
               | ((uint)seed[j*4 + 3] << 24);
        mix[j]      = w;
        mix[j + 16] = w;
    }

    // -- Step 3: 64 DAG accesses with FNV-1a mixing --
    for (int i = 0; i < 64; i++) {
        uint index = fnv1a((uint)i ^ mix[0], mix[0]) % (uint)dag_size;

        // Load 128-byte DAG node = 16 x u64, split into 32 x u32 (little-endian).
        device const ulong *node = dag + (ulong)index * 16UL;
        for (int j = 0; j < 16; j++) {
            ulong w = node[j];
            mix[2*j]     = fnv1a(mix[2*j],     (uint)(w & 0xFFFFFFFFu));
            mix[2*j + 1] = fnv1a(mix[2*j + 1], (uint)(w >> 32));
        }
    }

    // -- Step 4: compress mix -- FNV-fold each group of 4 u32 words -> 8 u32 (32 bytes) --
    uint cmix[8];
    for (int i = 0; i < 32; i += 4) {
        cmix[i/4] = fnv1a(fnv1a(fnv1a(mix[i], mix[i+1]), mix[i+2]), mix[i+3]);
    }

    // -- Step 5: hash = Keccak-256(seed || compressed_mix) -> 32 bytes --
    uchar final_input[96];
    for (int i = 0; i < 64; i++) final_input[i] = seed[i];
    for (int i = 0; i < 8; i++) {
        final_input[64 + i*4]     = (uchar)(cmix[i]);
        final_input[64 + i*4 + 1] = (uchar)(cmix[i] >> 8);
        final_input[64 + i*4 + 2] = (uchar)(cmix[i] >> 16);
        final_input[64 + i*4 + 3] = (uchar)(cmix[i] >> 24);
    }

    uchar hash[32];
    keccak256(final_input, 96, hash);

    // -- Step 6: check target (big-endian byte comparison: hash <= target) --
    int meets = 1;
    for (int i = 0; i < 32; i++) {
        if (hash[i] < target[i]) { meets = 1; break; }
        if (hash[i] > target[i]) { meets = 0; break; }
    }

    if (meets) {
        uint old = atomic_exchange_explicit((device atomic_uint*)found, 1u, memory_order_relaxed);
        if (old == 0u) {
            *output_nonce = nonce;
            for (int i = 0; i < 32; i++) output_hash[i] = hash[i];
            // Write the compressed mix hash (cmix) for eth_submitWork.
            for (int i = 0; i < 8; i++) {
                output_mix[i*4]     = (uchar)(cmix[i]);
                output_mix[i*4 + 1] = (uchar)(cmix[i] >> 8);
                output_mix[i*4 + 2] = (uchar)(cmix[i] >> 16);
                output_mix[i*4 + 3] = (uchar)(cmix[i] >> 24);
            }
        }
    }
}
