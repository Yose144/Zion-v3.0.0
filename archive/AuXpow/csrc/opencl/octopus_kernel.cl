// Octopus (Conflux / CFX) OpenCL kernel — REAL implementation.
//
// Octopus is an Ethash-like DAG-based Proof-of-Work algorithm used by
// Conflux (CFX).  It reuses the Keccak-f[1600] permutation and the
// FNV-1a mixing core of Ethash, but with a reduced number of DAG
// accesses (32 instead of Ethash's 64) and a slightly different
// mix-compression step.
//
// Algorithm outline (per nonce):
//
//   1. seed   = Keccak-512(header_hash || nonce_le)            → 64 bytes
//   2. mix    = seed concatenated with itself                  → 128 bytes (32 × u32)
//   3. for i in 0..31 (32 DAG accesses):
//        index = fnv1a(i ^ mix[0], mix[0]) % dag_size_entries
//        node  = dag[index]                                    → 128 bytes (16 × u64)
//        mix   = fnv1a(mix, node)  per 32-bit word
//   4. compress mix: FNV-fold each group of 4 u32 words        → 32 bytes (8 × u32)
//   5. hash   = Keccak-256(seed || compressed_mix)             → 32 bytes
//   6. check hash <= target (big-endian byte comparison)
//
// Keccak here uses the ORIGINAL Keccak domain suffix (0x01), NOT the
// NIST SHA-3 suffix (0x06).  Conflux/Ethereum use Keccak-256/Keccak-512.
//
// The DAG is a per-epoch precomputed buffer of 128-byte entries that is
// generated on the host and uploaded once as a __global uchar buffer.
// Each DAG entry is 128 bytes (16 u64 words / 32 u32 words).
// dag_size is the number of 128-byte entries.
//
// ── Optimizations applied ──
//   1. reqd_work_group_size(128, 1, 1) hint
//   2. DAG prefetch hints for cache-friendly random access
//   3. Early exit: check *found_flag at top of each iteration
//   4. Keccak-f[1600] fully unrolled with always_inline
//   5. FNV-1a marked always_inline
//   6. Mix hash output only written when solution found
//
// References:
//   - Conflux Rust consensus: conflux-rust/core/src/consensus/consensus_inner/mod.rs
//   - Ethash reference: https://github.com/ethereum-mining/ethminer
//   - Keccak-f[1600] pattern reused from ethash_kernel.cl
//   - Rust CPU reference: AuXpow/src/external_hashers.rs (hash_octopus)

// ── Keccak-f[1600] ───────────────────────────────────────────────────

__constant const ulong KECCAK_RC[24] = {
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
__constant const uint KECCAK_RHO[24] = {
    1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 2, 14, 27, 41, 56, 8, 25, 43, 62, 18, 39, 61, 20, 44
};

// Keccak Pi permutation indices
__constant const int KECCAK_PI[24] = {
    10, 7, 11, 17, 18, 3, 5, 16, 8, 21, 24, 4, 15, 23, 19, 13, 12, 2, 20, 14, 22, 9, 6, 1
};

#define ROTL64(x, n) (((x) << (n)) | ((x) >> (64 - (n))))

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

// ── Keccak-512 (rate 72 bytes = 9 lanes, output 64 bytes = 8 lanes) ──
//
// Uses the original Keccak domain suffix 0x01 (Ethereum/Conflux Keccak-512),
// NOT the NIST SHA3-512 suffix 0x06.

__attribute__((always_inline))
inline void absorb_block_9(ulong state[25], const uchar *block) {
    #pragma unroll 9
    for (int i = 0; i < 9; i++) {
        ulong lane = 0;
        #pragma unroll 8
        for (int j = 0; j < 8; j++)
            lane |= ((ulong)block[i*8 + j]) << (j*8);
        state[i] ^= lane;
    }
}

__attribute__((always_inline))
void keccak512(const uchar *input, const uint len, uchar *output) {
    ulong state[25];
    #pragma unroll 25
    for (int i = 0; i < 25; i++) state[i] = 0;

    uint offset = 0;
    while (offset + 72 <= len) {
        absorb_block_9(state, input + offset);
        keccak_f1600(state);
        offset += 72;
    }

    uchar padded[72];
    #pragma unroll 72
    for (int i = 0; i < 72; i++) padded[i] = 0;
    uint remaining = len - offset;
    for (int i = 0; i < remaining; i++) padded[i] = input[offset + i];
    padded[remaining] = 0x01;   // Keccak domain suffix
    padded[71] |= 0x80;         // end-of-rate padding

    absorb_block_9(state, padded);
    keccak_f1600(state);

    #pragma unroll 8
    for (int i = 0; i < 8; i++)
        #pragma unroll 8
        for (int j = 0; j < 8; j++)
            output[i*8 + j] = (uchar)(state[i] >> (j*8));
}

// ── Keccak-256 (rate 136 bytes = 17 lanes, output 32 bytes = 4 lanes) ──
//
// Uses the original Keccak domain suffix 0x01 (Ethereum/Conflux Keccak-256),
// NOT the NIST SHA3-256 suffix 0x06.

__attribute__((always_inline))
inline void absorb_block_17(ulong state[25], const uchar *block) {
    #pragma unroll 17
    for (int i = 0; i < 17; i++) {
        ulong lane = 0;
        #pragma unroll 8
        for (int j = 0; j < 8; j++)
            lane |= ((ulong)block[i*8 + j]) << (j*8);
        state[i] ^= lane;
    }
}

__attribute__((always_inline))
void keccak256(const uchar *input, const uint len, uchar *output) {
    ulong state[25];
    #pragma unroll 25
    for (int i = 0; i < 25; i++) state[i] = 0;

    uint offset = 0;
    while (offset + 136 <= len) {
        absorb_block_17(state, input + offset);
        keccak_f1600(state);
        offset += 136;
    }

    uchar padded[136];
    #pragma unroll 136
    for (int i = 0; i < 136; i++) padded[i] = 0;
    uint remaining = len - offset;
    for (int i = 0; i < remaining; i++) padded[i] = input[offset + i];
    padded[remaining] = 0x01;   // Keccak domain suffix
    padded[135] |= 0x80;        // end-of-rate padding

    absorb_block_17(state, padded);
    keccak_f1600(state);

    #pragma unroll 4
    for (int i = 0; i < 4; i++)
        #pragma unroll 8
        for (int j = 0; j < 8; j++)
            output[i*8 + j] = (uchar)(state[i] >> (j*8));
}

// ── FNV-1a (32-bit) ──────────────────────────────────────────────────

#define FNV_PRIME 0x01000193u

__attribute__((always_inline))
inline uint fnv1a(uint a, uint b) {
    return (a ^ b) * FNV_PRIME;
}

// ── Mining kernel ────────────────────────────────────────────────────
//
// Kernel arguments:
//   header       — block header bytes (header_len bytes; typically 32-byte
//                  header hash is the first 32 bytes used as the seed input)
//   header_len   — length of header buffer in bytes
//   base_nonce   — first nonce in this batch
//   output_hash  — 32-byte final hash of the winning nonce (written on find)
//   found_flag   — atomic flag: 0 = not found, 1 = found
//   target       — 32-byte target (big-endian byte comparison)
//   dag          — precomputed DAG buffer (__global uchar *), 128 bytes per entry
//   dag_size     — number of 128-byte DAG entries
//
// Each work-item processes exactly one nonce:
//   nonce = base_nonce + get_global_id(0)
//
// Host should dispatch (num_nonces) work-items with local size 128.
__attribute__((reqd_work_group_size(128, 1, 1)))
__kernel void octopus_mine(
    __global const uchar *header,        // header bytes (first 32 used as header_hash)
    uint header_len,                     // length of header buffer
    ulong base_nonce,                    // first nonce in this batch
    __global uchar *output_hash,         // 32-byte final hash output (on find)
    __global uint *found_flag,           // atomic found flag
    __global const uchar *target,        // 32-byte target (big-endian)
    __global uchar *dag,                 // DAG buffer (128 bytes per entry)
    ulong dag_size                       // number of 128-byte entries
)
{
    // Early exit: another work-item already found a solution
    if (*found_flag) return;

    ulong nonce = base_nonce + (ulong)get_global_id(0);

    // ── Load the 32-byte header hash into private memory ──
    // Octopus uses the first 32 bytes of the header buffer as the header hash
    // (the block header's Keccak-256 hash, precomputed on the host).
    uchar hdr[32];
    uint copy_len = header_len < 32 ? header_len : 32;
    #pragma unroll 32
    for (int i = 0; i < 32; i++) hdr[i] = 0;
    for (uint i = 0; i < copy_len; i++) hdr[i] = header[i];

    // ── Step 1: seed = Keccak-512(header_hash || nonce_le) → 64 bytes ──
    uchar seed_input[40];
    #pragma unroll 32
    for (int i = 0; i < 32; i++) seed_input[i] = hdr[i];
    #pragma unroll 8
    for (int i = 0; i < 8; i++) seed_input[32 + i] = (uchar)(nonce >> (i*8));

    uchar seed[64];
    keccak512(seed_input, 40, seed);

    // ── Step 2: mix = seed || seed  → 128 bytes = 32 × u32 (little-endian) ──
    uint mix[32];
    #pragma unroll 16
    for (int j = 0; j < 16; j++) {
        uint w = (uint)seed[j*4]
               | ((uint)seed[j*4 + 1] << 8)
               | ((uint)seed[j*4 + 2] << 16)
               | ((uint)seed[j*4 + 3] << 24);
        mix[j]      = w;
        mix[j + 16] = w;
    }

    // ── Step 3: 32 DAG accesses with FNV-1a mixing ──
    // Octopus uses 32 DAG accesses (vs Ethash's 64).  The DAG is a __global
    // uchar buffer with 128 bytes per entry.  We load each 128-byte node as
    // 16 × u64 (little-endian) and FNV-mix into the 32 × u32 mix buffer.
    for (int i = 0; i < 32; i++) {
        uint index = fnv1a((uint)i ^ mix[0], mix[0]) % (uint)dag_size;

        // Pointer to the 128-byte DAG node
        __global const uchar *node_bytes = dag + (ulong)index * 128UL;

        // Prefetch hint: bring the 128-byte DAG node into cache
        prefetch(node_bytes, 128);

        // Load 128-byte DAG node = 16 × u64, split into 32 × u32 (little-endian).
        #pragma unroll 16
        for (int j = 0; j < 16; j++) {
            ulong w = 0;
            #pragma unroll 8
            for (int b = 0; b < 8; b++)
                w |= ((ulong)node_bytes[j*8 + b]) << (b*8);
            mix[2*j]     = fnv1a(mix[2*j],     (uint)(w & 0xFFFFFFFFu));
            mix[2*j + 1] = fnv1a(mix[2*j + 1], (uint)(w >> 32));
        }
    }

    // ── Step 4: compress mix — FNV-fold each group of 4 u32 words → 8 u32 (32 bytes) ──
    uint cmix[8];
    #pragma unroll 8
    for (int i = 0; i < 32; i += 4) {
        cmix[i/4] = fnv1a(fnv1a(fnv1a(mix[i], mix[i+1]), mix[i+2]), mix[i+3]);
    }

    // ── Step 5: hash = Keccak-256(seed || compressed_mix) → 32 bytes ──
    uchar final_input[96];
    #pragma unroll 64
    for (int i = 0; i < 64; i++) final_input[i] = seed[i];
    #pragma unroll 8
    for (int i = 0; i < 8; i++) {
        final_input[64 + i*4]     = (uchar)(cmix[i]);
        final_input[64 + i*4 + 1] = (uchar)(cmix[i] >> 8);
        final_input[64 + i*4 + 2] = (uchar)(cmix[i] >> 16);
        final_input[64 + i*4 + 3] = (uchar)(cmix[i] >> 24);
    }

    uchar hash[32];
    keccak256(final_input, 96, hash);

    // ── Step 6: check target (big-endian byte comparison: hash <= target) ──
    int meets = 1;
    for (int i = 0; i < 32; i++) {
        if (hash[i] < target[i]) { meets = 1; break; }
        if (hash[i] > target[i]) { meets = 0; break; }
    }

    // ── Step 7: on find, atomically set flag and write the hash ──
    if (meets) {
        uint old = atomic_xchg(found_flag, 1u);
        if (old == 0u) {
            #pragma unroll 32
            for (int i = 0; i < 32; i++) output_hash[i] = hash[i];
        }
    }
}
