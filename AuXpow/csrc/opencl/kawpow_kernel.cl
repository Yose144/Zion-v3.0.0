// KawPow (RVN/CLORE/EVR/MEWC) OpenCL kernel — OPTIMIZED implementation.
//
// Implements the Ethash-like core of the KawPow algorithm:
//   1. seed = keccak512(header_hash || nonce)  → 64 bytes (mix)
//   2. For i in 0..32:
//        index = fnv(i ^ mix[0], mix[0]) % dag_entries
//        dag_node = dag[index * 128 .. index * 128 + 128]
//        mix = fnv(mix, dag_node)  (per-uint32 FNV-1a)
//   3. hash = keccak256(seed || mix)  → 32 bytes
//   4. Check hash <= target
//
// The DAG is precomputed on the host and passed as a __global buffer of
// 128-byte entries (each = 16 ulong lanes).  The host is responsible for
// DAG generation (Ethash-style keccak512 / FNV).
//
// ── Optimizations applied ──
//   1. Batch nonce scanning: each work-item scans 4 nonces
//   2. reqd_work_group_size(128, 1, 1) hint
//   3. DAG prefetch hints for cache-friendly random access
//   4. Early exit: check *found at top of each batch iteration
//   5. Keccak-f[1600] fully unrolled with always_inline
//   6. FNV-1a marked always_inline
//   7. Mix hash output only written when solution found
//
// References:
//   - https://github.com/RavenCommunity/kawpowminer
//   - https://github.com/ethereum-mining/ethminer (ethash.cl)
//   - Rust CPU reference: AuXpow/src/external_hashers.rs (hash_kawpow)

// ── Keccak-f[1600] ───────────────────────────────────────────────────

#define ROTL64(x, n) (((x) << (n)) | ((x) >> (64 - (n))))

__constant const ulong KECCAK_RC[24] = {
    0x0000000000000001UL, 0x0000000000008082UL, 0x800000000000808aUL,
    0x8000000080008000UL, 0x000000000000808bUL, 0x0000000080000001UL,
    0x8000000080008081UL, 0x8000000000008009UL, 0x000000000000008aUL,
    0x0000000000000088UL, 0x0000000080008009UL, 0x000000008000000aUL,
    0x800000008000808bUL, 0x800000000000008bUL, 0x8000000000008089UL,
    0x8000000000008003UL, 0x8000000000008002UL, 0x8000000000000080UL,
    0x000000000000800aUL, 0x800000008000000aUL, 0x8000000080008081UL,
    0x8000000000008080UL, 0x0000000080000001UL, 0x8000000080008008UL
};

// Keccak Rho rotation offsets
__constant const uint KECCAK_RHO[24] = {
    1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 2, 14, 27, 41, 56, 8, 25, 43, 62, 18, 39, 61, 20, 44
};

// Keccak Pi permutation indices
__constant const int KECCAK_PI[24] = {
    10, 7, 11, 17, 18, 3, 5, 16, 8, 21, 24, 4, 15, 23, 19, 13, 12, 2, 20, 14, 22, 9, 6, 1
};

// Keccak-f[1600] — hot path, fully unrolled, always inlined.
__attribute__((always_inline))
void keccak_f1600(ulong state[25]) {
    #pragma unroll 24
    for (int round = 0; round < 24; round++) {
        // Theta — manually unrolled (5 columns)
        ulong c0 = state[0]  ^ state[5]  ^ state[10] ^ state[15] ^ state[20];
        ulong c1 = state[1]  ^ state[6]  ^ state[11] ^ state[16] ^ state[21];
        ulong c2 = state[2]  ^ state[7]  ^ state[12] ^ state[17] ^ state[22];
        ulong c3 = state[3]  ^ state[8]  ^ state[13] ^ state[18] ^ state[23];
        ulong c4 = state[4]  ^ state[9]  ^ state[14] ^ state[19] ^ state[24];

        ulong d0 = c4 ^ ROTL64(c1, 1);
        ulong d1 = c0 ^ ROTL64(c2, 1);
        ulong d2 = c1 ^ ROTL64(c3, 1);
        ulong d3 = c2 ^ ROTL64(c4, 1);
        ulong d4 = c3 ^ ROTL64(c0, 1);

        state[0]  ^= d0; state[1]  ^= d1; state[2]  ^= d2; state[3]  ^= d3; state[4]  ^= d4;
        state[5]  ^= d0; state[6]  ^= d1; state[7]  ^= d2; state[8]  ^= d3; state[9]  ^= d4;
        state[10] ^= d0; state[11] ^= d1; state[12] ^= d2; state[13] ^= d3; state[14] ^= d4;
        state[15] ^= d0; state[16] ^= d1; state[17] ^= d2; state[18] ^= d3; state[19] ^= d4;
        state[20] ^= d0; state[21] ^= d1; state[22] ^= d2; state[23] ^= d3; state[24] ^= d4;

        // Rho and Pi — unrolled 24 steps
        ulong temp = state[1];
        #pragma unroll 24
        for (int t = 0; t < 24; t++) {
            int idx = KECCAK_PI[t];
            ulong tmp2 = state[idx];
            state[idx] = ROTL64(temp, KECCAK_RHO[t]);
            temp = tmp2;
        }

        // Chi — manually unrolled (5 rows × 5 columns)
        // Row 0
        {
            ulong r0 = state[0], r1 = state[1], r2 = state[2], r3 = state[3], r4 = state[4];
            state[0] = r0 ^ ((~r1) & r2);
            state[1] = r1 ^ ((~r2) & r3);
            state[2] = r2 ^ ((~r3) & r4);
            state[3] = r3 ^ ((~r4) & r0);
            state[4] = r4 ^ ((~r0) & r1);
        }
        // Row 1
        {
            ulong r0 = state[5], r1 = state[6], r2 = state[7], r3 = state[8], r4 = state[9];
            state[5] = r0 ^ ((~r1) & r2);
            state[6] = r1 ^ ((~r2) & r3);
            state[7] = r2 ^ ((~r3) & r4);
            state[8] = r3 ^ ((~r4) & r0);
            state[9] = r4 ^ ((~r0) & r1);
        }
        // Row 2
        {
            ulong r0 = state[10], r1 = state[11], r2 = state[12], r3 = state[13], r4 = state[14];
            state[10] = r0 ^ ((~r1) & r2);
            state[11] = r1 ^ ((~r2) & r3);
            state[12] = r2 ^ ((~r3) & r4);
            state[13] = r3 ^ ((~r4) & r0);
            state[14] = r4 ^ ((~r0) & r1);
        }
        // Row 3
        {
            ulong r0 = state[15], r1 = state[16], r2 = state[17], r3 = state[18], r4 = state[19];
            state[15] = r0 ^ ((~r1) & r2);
            state[16] = r1 ^ ((~r2) & r3);
            state[17] = r2 ^ ((~r3) & r4);
            state[18] = r3 ^ ((~r4) & r0);
            state[19] = r4 ^ ((~r0) & r1);
        }
        // Row 4
        {
            ulong r0 = state[20], r1 = state[21], r2 = state[22], r3 = state[23], r4 = state[24];
            state[20] = r0 ^ ((~r1) & r2);
            state[21] = r1 ^ ((~r2) & r3);
            state[22] = r2 ^ ((~r3) & r4);
            state[23] = r3 ^ ((~r4) & r0);
            state[24] = r4 ^ ((~r0) & r1);
        }

        // Iota
        state[0] ^= KECCAK_RC[round];
    }
}

// ── FNV-1a ───────────────────────────────────────────────────────────

#define FNV_PRIME 0x01000193u

__attribute__((always_inline))
inline uint fnv1a(uint a, uint b) {
    return (a ^ b) * FNV_PRIME;
}

// FNV-1 (used for DAG generation; NOT the same as FNV-1a).
// Reference: kawpowminer CLMiner_kernel.cl: fnv(x,y) = x * FNV_PRIME ^ y
inline uint fnv1(uint x, uint y) {
    return (x * FNV_PRIME) ^ y;
}

// ── Keccak-512 (SHA3-512) ─────────────────────────────────────────────
//
// Rate = 576 bits = 72 bytes = 9 lanes.  Output = 512 bits = 64 bytes = 8 lanes.
// Domain separator: 0x06 (SHA3), padding 0x80 at end of rate.

__attribute__((always_inline))
void keccak512(const uchar *input, const uint len, uchar *output) {
    ulong state[25];
    #pragma unroll 25
    for (int i = 0; i < 25; i++) state[i] = 0;

    uint offset = 0;
    // Absorb full 72-byte blocks
    while (offset + 72 <= len) {
        #pragma unroll 9
        for (int i = 0; i < 9; i++) {
            ulong lane = 0;
            #pragma unroll 8
            for (int j = 0; j < 8; j++)
                lane |= ((ulong)input[offset + i*8 + j]) << (j*8);
            state[i] ^= lane;
        }
        keccak_f1600(state);
        offset += 72;
    }

    // Final block with padding
    uchar padded[72];
    #pragma unroll 72
    for (int i = 0; i < 72; i++) padded[i] = 0;
    uint remaining = len - offset;
    for (uint i = 0; i < remaining; i++) padded[i] = input[offset + i];
    padded[remaining] = 0x06;       // SHA3 domain separator
    padded[71] |= 0x80;             // end-of-rate padding

    #pragma unroll 9
    for (int i = 0; i < 9; i++) {
        ulong lane = 0;
        #pragma unroll 8
        for (int j = 0; j < 8; j++)
            lane |= ((ulong)padded[i*8 + j]) << (j*8);
        state[i] ^= lane;
    }
    keccak_f1600(state);

    // Squeeze 64 bytes (8 lanes)
    #pragma unroll 8
    for (int i = 0; i < 8; i++)
        #pragma unroll 8
        for (int j = 0; j < 8; j++)
            output[i*8 + j] = (uchar)(state[i] >> (j*8));
}

// ── Keccak-256 (SHA3-256) ─────────────────────────────────────────────
//
// Rate = 1088 bits = 136 bytes = 17 lanes.  Output = 256 bits = 32 bytes = 4 lanes.
// Domain separator: 0x06 (SHA3), padding 0x80 at end of rate.

__attribute__((always_inline))
void keccak256(const uchar *input, const uint len, uchar *output) {
    ulong state[25];
    #pragma unroll 25
    for (int i = 0; i < 25; i++) state[i] = 0;

    uint offset = 0;
    // Absorb full 136-byte blocks
    while (offset + 136 <= len) {
        #pragma unroll 17
        for (int i = 0; i < 17; i++) {
            ulong lane = 0;
            #pragma unroll 8
            for (int j = 0; j < 8; j++)
                lane |= ((ulong)input[offset + i*8 + j]) << (j*8);
            state[i] ^= lane;
        }
        keccak_f1600(state);
        offset += 136;
    }

    // Final block with padding
    uchar padded[136];
    #pragma unroll 136
    for (int i = 0; i < 136; i++) padded[i] = 0;
    uint remaining = len - offset;
    for (uint i = 0; i < remaining; i++) padded[i] = input[offset + i];
    padded[remaining] = 0x06;       // SHA3 domain separator
    padded[135] |= 0x80;            // end-of-rate padding

    #pragma unroll 17
    for (int i = 0; i < 17; i++) {
        ulong lane = 0;
        #pragma unroll 8
        for (int j = 0; j < 8; j++)
            lane |= ((ulong)padded[i*8 + j]) << (j*8);
        state[i] ^= lane;
    }
    keccak_f1600(state);

    // Squeeze 32 bytes (4 lanes)
    #pragma unroll 4
    for (int i = 0; i < 4; i++)
        #pragma unroll 8
        for (int j = 0; j < 8; j++)
            output[i*8 + j] = (uchar)(state[i] >> (j*8));
}

// ── Mining kernel ────────────────────────────────────────────────────
//
// Kernel arguments:
//   header_hash   — 32-byte block header hash (the "seed hash" base)
//   target        — 32-byte target (big-endian byte comparison)
//   base_nonce    — first nonce in this batch
//   dag           — __global ulong buffer containing the DAG.
//                   Each DAG entry is 128 bytes = 16 ulong lanes.
//                   dag[index * 16 + lane] accesses lane within entry.
//   dag_entries   — number of 128-byte DAG entries (dag_size / 128)
//   output_nonce  — single u64, written when a solution is found
//   output_hash   — 32-byte final hash of the winning nonce
//   output_mix    — 32-byte compressed mix hash (for eth_submitWork)
//   found         — atomic flag: 0 = not found, 1 = found
//
// Each work-item scans 4 nonces:
//   nonce = base_nonce + get_global_id(0) * 4 + batch   (batch = 0..3)
//
// Host should dispatch (num_nonces / 4) work-items with local size 128.
__attribute__((reqd_work_group_size(128, 1, 1)))
__kernel void kawpow_mine(
    __global const uchar *header_hash,  // 32 bytes
    __global const uchar *target,       // 32 bytes
    const ulong base_nonce,
    __global const ulong *dag,          // DAG buffer (128-byte entries)
    const ulong dag_entries,            // number of 128-byte entries
    __global ulong *output_nonce,
    __global uchar *output_hash,
    __global uchar *output_mix,         // 32-byte compressed mix hash
    __global volatile uint *found
)
{
    // Pre-load header hash into private memory (shared across all 4 batch iterations)
    uchar hdr[32];
    #pragma unroll 32
    for (int i = 0; i < 32; i++) hdr[i] = header_hash[i];

    // Batch nonce scanning: each work-item tests 4 nonces
    for (int batch = 0; batch < 4; batch++) {
        // Early exit: check if another work-item already found a solution
        if (*found) return;

        ulong nonce = base_nonce + (ulong)get_global_id(0) * 4 + (ulong)batch;

        // ── Step 1: seed = keccak512(header_hash || nonce) → 64 bytes ──
        uchar seed_input[40];
        #pragma unroll 32
        for (int i = 0; i < 32; i++) seed_input[i] = hdr[i];
        #pragma unroll 8
        for (int i = 0; i < 8; i++) seed_input[32 + i] = (uchar)(nonce >> (i*8));

        uchar seed[64];
        keccak512(seed_input, 40, seed);

        // ── Step 2: Initialize mix from seed (two 32-byte halves = 16 uint32) ──
        // mix is 16 uint32 values (64 bytes total)
        uint mix[16];
        #pragma unroll 16
        for (int i = 0; i < 16; i++) {
            mix[i] = (uint)seed[i*4]
                   | ((uint)seed[i*4 + 1] << 8)
                   | ((uint)seed[i*4 + 2] << 16)
                   | ((uint)seed[i*4 + 3] << 24);
        }

        // ── Step 3: 32 DAG accesses with FNV-1a mixing ──
        // KawPow uses 32 accesses (vs Ethash's 64).
        // DAG is accessed randomly; prefetch hints help the GPU memory subsystem.
        for (int i = 0; i < 32; i++) {
            // index = fnv(i ^ mix[0], mix[0]) % dag_entries
            uint idx_seed = fnv1a((uint)i ^ mix[0], mix[0]);
            ulong index = (ulong)idx_seed % dag_entries;

            // Load first 64 bytes of 128-byte DAG node = 16 uint32 (8 ulong lanes).
            // KawPow uses a 16-uint32 mix; only the first half of each 128-byte
            // DAG entry participates in FNV-1a mixing (matches C reference).
            __global const ulong *node = dag + index * 16;

            // Prefetch hint: bring the DAG node into cache
            prefetch(node, 16);

            uint dag_node[16];
            #pragma unroll 8
            for (int lane = 0; lane < 8; lane++) {
                ulong val = node[lane];
                dag_node[lane * 2]     = (uint)(val & 0xFFFFFFFFu);
                dag_node[lane * 2 + 1] = (uint)(val >> 32);
            }

            // mix = fnv(mix, dag_node) — per-uint32 FNV-1a
            #pragma unroll 16
            for (int w = 0; w < 16; w++) {
                mix[w] = fnv1a(mix[w], dag_node[w]);
            }
        }

        // ── Step 4: Compress mix to 32 bytes ──
        // FNV-1a compress: fold 16 uint32 → 8 uint32 (32 bytes)
        uint compressed[8];
        #pragma unroll 8
        for (int i = 0; i < 8; i++) {
            compressed[i] = fnv1a(mix[i*2], mix[i*2 + 1]);
        }

        uchar mix_bytes[32];
        #pragma unroll 8
        for (int i = 0; i < 8; i++) {
            mix_bytes[i*4]     = (uchar)(compressed[i] & 0xFF);
            mix_bytes[i*4 + 1] = (uchar)((compressed[i] >> 8) & 0xFF);
            mix_bytes[i*4 + 2] = (uchar)((compressed[i] >> 16) & 0xFF);
            mix_bytes[i*4 + 3] = (uchar)((compressed[i] >> 24) & 0xFF);
        }

        // ── Step 5: hash = keccak256(seed || mix) → 32 bytes ──
        uchar final_input[96];   // 64 (seed) + 32 (mix)
        #pragma unroll 64
        for (int i = 0; i < 64; i++) final_input[i] = seed[i];
        #pragma unroll 32
        for (int i = 0; i < 32; i++) final_input[64 + i] = mix_bytes[i];

        uchar hash[32];
        keccak256(final_input, 96, hash);

        // ── Step 6: Check target (big-endian byte comparison: hash <= target) ──
        int meets = 1;
        for (int i = 0; i < 32; i++) {
            if (hash[i] < target[i]) { meets = 1; break; }
            if (hash[i] > target[i]) { meets = 0; break; }
        }

        // ── Step 7: only compute/write mix hash output when a solution is found ──
        if (meets) {
            uint old = atomic_xchg(found, 1u);
            if (old == 0u) {
                *output_nonce = nonce;
                #pragma unroll 32
                for (int i = 0; i < 32; i++) output_hash[i] = hash[i];
                // Write the compressed mix hash for eth_submitWork.
                #pragma unroll 32
                for (int i = 0; i < 32; i++) output_mix[i] = mix_bytes[i];
            }
        }
    }
}

// ── DAG generation kernel ────────────────────────────────────────────
//
// Generates DAG nodes in parallel on the GPU from the light cache.
// Based on kawpowminer/ethminer's ethash_calculate_dag_item kernel.
//
// Each work-item computes one 64-byte DAG node.  A 128-byte DAG entry
// = 2 nodes, so node_index 2*e and 2*e+1 form entry e.
//
// Algorithm (matches kawpowminer reference):
//   1. init = cache[node_index % cache_items]  (64 bytes = 16 uint32)
//   2. init.words[0] ^= node_index             (32-bit LE XOR)
//   3. mix = keccak512(init)
//   4. For p in 0..511:
//        parent = fnv1(node_index ^ p, mix_word[0]) % cache_items
//        mix = fnv1_per_word(mix, cache[parent])
//   5. output = keccak512(mix)
//
// FNV-1 (NOT FNV-1a): fnv1(x, y) = (x * FNV_PRIME) ^ y
// FNV-1a is only used in the mining mix loop above.
//
// Uses uint[16] for the mix (not ulong[8]) to avoid 64-bit masking
// issues on the AMD OpenCL compiler.
//
// Kernel arguments:
//   light_cache   — __global ulong buffer, cache_items * 8 ulongs (64 bytes each)
//   cache_items   — number of 64-byte cache items
//   dag           — __global ulong output buffer, dag_nodes * 8 ulongs
//   dag_nodes     — total number of 64-byte DAG nodes
//   start_node    — first node index for this batch
__kernel void kawpow_generate_dag(
    __global const ulong *light_cache,  // light cache (8 ulongs per item)
    const ulong cache_items,             // number of 64-byte cache items
    __global ulong *dag,                 // output DAG (8 ulongs per node)
    const ulong dag_nodes,               // total DAG nodes
    const ulong start_node               // first node index this batch
)
{
    ulong node_index = start_node + (ulong)get_global_id(0);
    if (node_index >= dag_nodes) return;

    // Step 1: init = cache[node_index % cache_items] — load as 16 uint32 words
    ulong cache_idx = node_index % cache_items;
    uint mix[16];
    for (int i = 0; i < 8; i++) {
        ulong val = light_cache[cache_idx * 8 + i];
        mix[i * 2]     = (uint)(val & 0xFFFFFFFFu);
        mix[i * 2 + 1] = (uint)(val >> 32);
    }

    // Step 2: XOR node_index into first 32-bit word (LE)
    mix[0] ^= (uint)(node_index & 0xFFFFFFFFu);

    // Step 3: keccak512(init) -> mix
    {
        uchar mix_bytes[64];
        for (int i = 0; i < 16; i++) {
            mix_bytes[i * 4]     = (uchar)(mix[i] & 0xFF);
            mix_bytes[i * 4 + 1] = (uchar)((mix[i] >> 8) & 0xFF);
            mix_bytes[i * 4 + 2] = (uchar)((mix[i] >> 16) & 0xFF);
            mix_bytes[i * 4 + 3] = (uchar)((mix[i] >> 24) & 0xFF);
        }
        uchar hash_out[64];
        keccak512(mix_bytes, 64, hash_out);
        for (int i = 0; i < 16; i++) {
            mix[i] = (uint)hash_out[i * 4]
                   | ((uint)hash_out[i * 4 + 1] << 8)
                   | ((uint)hash_out[i * 4 + 2] << 16)
                   | ((uint)hash_out[i * 4 + 3] << 24);
        }
    }

    // Step 4: mix with 512 parents using FNV-1
    for (int p = 0; p < 512; p++) {
        uint parent_idx = fnv1((uint)(node_index ^ (ulong)p), mix[0]) % (uint)cache_items;
        for (int j = 0; j < 16; j++) {
            ulong parent_val = light_cache[(ulong)parent_idx * 8 + j / 2];
            uint parent_w = (j % 2 == 0)
                ? (uint)(parent_val & 0xFFFFFFFFu)
                : (uint)(parent_val >> 32);
            mix[j] = fnv1(mix[j], parent_w);
        }
    }

    // Step 5: keccak512(mix) -> output
    {
        uchar mix_bytes[64];
        for (int i = 0; i < 16; i++) {
            mix_bytes[i * 4]     = (uchar)(mix[i] & 0xFF);
            mix_bytes[i * 4 + 1] = (uchar)((mix[i] >> 8) & 0xFF);
            mix_bytes[i * 4 + 2] = (uchar)((mix[i] >> 16) & 0xFF);
            mix_bytes[i * 4 + 3] = (uchar)((mix[i] >> 24) & 0xFF);
        }
        uchar hash_out[64];
        keccak512(mix_bytes, 64, hash_out);

        // Write to DAG as ulong words (8 ulongs = 64 bytes per node)
        for (int i = 0; i < 8; i++) {
            ulong val = (ulong)hash_out[i * 8]
                      | ((ulong)hash_out[i * 8 + 1] << 8)
                      | ((ulong)hash_out[i * 8 + 2] << 16)
                      | ((ulong)hash_out[i * 8 + 3] << 24)
                      | ((ulong)hash_out[i * 8 + 4] << 32)
                      | ((ulong)hash_out[i * 8 + 5] << 40)
                      | ((ulong)hash_out[i * 8 + 6] << 48)
                      | ((ulong)hash_out[i * 8 + 7] << 56);
            dag[node_index * 8 + i] = val;
        }
    }
}
