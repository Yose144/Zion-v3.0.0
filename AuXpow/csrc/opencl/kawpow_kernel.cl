// KawPow (RVN/CLORE/EVR/MEWC) OpenCL kernel — real implementation.
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

void keccak_f1600(ulong state[25]) {
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

// ── FNV-1a ───────────────────────────────────────────────────────────

#define FNV_PRIME 0x01000193u

inline uint fnv1a(uint a, uint b) {
    return (a ^ b) * FNV_PRIME;
}

// ── Keccak-512 (SHA3-512) ─────────────────────────────────────────────
//
// Rate = 576 bits = 72 bytes = 9 lanes.  Output = 512 bits = 64 bytes = 8 lanes.
// Domain separator: 0x06 (SHA3), padding 0x80 at end of rate.

void keccak512(const uchar *input, const uint len, uchar *output) {
    ulong state[25];
    for (int i = 0; i < 25; i++) state[i] = 0;

    uint offset = 0;
    // Absorb full 72-byte blocks
    while (offset + 72 <= len) {
        for (int i = 0; i < 9; i++) {
            ulong lane = 0;
            for (int j = 0; j < 8; j++)
                lane |= ((ulong)input[offset + i*8 + j]) << (j*8);
            state[i] ^= lane;
        }
        keccak_f1600(state);
        offset += 72;
    }

    // Final block with padding
    uchar padded[72];
    for (int i = 0; i < 72; i++) padded[i] = 0;
    uint remaining = len - offset;
    for (uint i = 0; i < remaining; i++) padded[i] = input[offset + i];
    padded[remaining] = 0x06;       // SHA3 domain separator
    padded[71] |= 0x80;             // end-of-rate padding

    for (int i = 0; i < 9; i++) {
        ulong lane = 0;
        for (int j = 0; j < 8; j++)
            lane |= ((ulong)padded[i*8 + j]) << (j*8);
        state[i] ^= lane;
    }
    keccak_f1600(state);

    // Squeeze 64 bytes (8 lanes)
    for (int i = 0; i < 8; i++)
        for (int j = 0; j < 8; j++)
            output[i*8 + j] = (uchar)(state[i] >> (j*8));
}

// ── Keccak-256 (SHA3-256) ─────────────────────────────────────────────
//
// Rate = 1088 bits = 136 bytes = 17 lanes.  Output = 256 bits = 32 bytes = 4 lanes.
// Domain separator: 0x06 (SHA3), padding 0x80 at end of rate.

void keccak256(const uchar *input, const uint len, uchar *output) {
    ulong state[25];
    for (int i = 0; i < 25; i++) state[i] = 0;

    uint offset = 0;
    // Absorb full 136-byte blocks
    while (offset + 136 <= len) {
        for (int i = 0; i < 17; i++) {
            ulong lane = 0;
            for (int j = 0; j < 8; j++)
                lane |= ((ulong)input[offset + i*8 + j]) << (j*8);
            state[i] ^= lane;
        }
        keccak_f1600(state);
        offset += 136;
    }

    // Final block with padding
    uchar padded[136];
    for (int i = 0; i < 136; i++) padded[i] = 0;
    uint remaining = len - offset;
    for (uint i = 0; i < remaining; i++) padded[i] = input[offset + i];
    padded[remaining] = 0x06;       // SHA3 domain separator
    padded[135] |= 0x80;            // end-of-rate padding

    for (int i = 0; i < 17; i++) {
        ulong lane = 0;
        for (int j = 0; j < 8; j++)
            lane |= ((ulong)padded[i*8 + j]) << (j*8);
        state[i] ^= lane;
    }
    keccak_f1600(state);

    // Squeeze 32 bytes (4 lanes)
    for (int i = 0; i < 4; i++)
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
//   output_hash   — 32-byte hash of the winning nonce
//   found         — atomic flag: 0 = not found, 1 = found
__kernel void kawpow_mine(
    __global const uchar *header_hash,  // 32 bytes
    __global const uchar *target,       // 32 bytes
    const ulong base_nonce,
    __global const ulong *dag,          // DAG buffer (128-byte entries)
    const ulong dag_entries,            // number of 128-byte entries
    __global ulong *output_nonce,
    __global uchar *output_hash,
    __global volatile uint *found
)
{
    if (*found) return;

    ulong nonce = base_nonce + (ulong)get_global_id(0);

    // ── Step 1: seed = keccak512(header_hash || nonce) → 64 bytes ──
    uchar seed_input[40];
    for (int i = 0; i < 32; i++) seed_input[i] = header_hash[i];
    for (int i = 0; i < 8; i++) seed_input[32 + i] = (uchar)(nonce >> (i*8));

    uchar seed[64];
    keccak512(seed_input, 40, seed);

    // ── Step 2: Initialize mix from seed (two 32-byte halves = 16 uint32) ──
    // mix is 16 uint32 values (64 bytes total)
    uint mix[16];
    for (int i = 0; i < 16; i++) {
        mix[i] = (uint)seed[i*4]
               | ((uint)seed[i*4 + 1] << 8)
               | ((uint)seed[i*4 + 2] << 16)
               | ((uint)seed[i*4 + 3] << 24);
    }

    // ── Step 3: 32 DAG accesses with FNV-1a mixing ──
    // KawPow uses 32 accesses (vs Ethash's 64).
    for (int i = 0; i < 32; i++) {
        // index = fnv(i ^ mix[0], mix[0]) % dag_entries
        uint idx_seed = fnv1a((uint)i ^ mix[0], mix[0]);
        ulong index = (ulong)idx_seed % dag_entries;

        // Load 128-byte DAG node = 16 uint32 values (16 ulong lanes)
        // dag[index * 16 + lane] is a ulong; we need uint32 values.
        // Each ulong lane = 2 uint32 values (little-endian).
        uint dag_node[16];
        for (int lane = 0; lane < 8; lane++) {
            ulong val = dag[index * 16 + lane];
            dag_node[lane * 2]     = (uint)(val & 0xFFFFFFFFu);
            dag_node[lane * 2 + 1] = (uint)(val >> 32);
        }

        // mix = fnv(mix, dag_node) — per-uint32 FNV-1a
        for (int w = 0; w < 16; w++) {
            mix[w] = fnv1a(mix[w], dag_node[w]);
        }
    }

    // ── Step 4: Compress mix to 32 bytes ──
    // FNV-1a compress: fold 16 uint32 → 8 uint32 (32 bytes)
    uint compressed[8];
    for (int i = 0; i < 8; i++) {
        compressed[i] = fnv1a(mix[i*2], mix[i*2 + 1]);
    }

    uchar mix_bytes[32];
    for (int i = 0; i < 8; i++) {
        mix_bytes[i*4]     = (uchar)(compressed[i] & 0xFF);
        mix_bytes[i*4 + 1] = (uchar)((compressed[i] >> 8) & 0xFF);
        mix_bytes[i*4 + 2] = (uchar)((compressed[i] >> 16) & 0xFF);
        mix_bytes[i*4 + 3] = (uchar)((compressed[i] >> 24) & 0xFF);
    }

    // ── Step 5: hash = keccak256(seed || mix) → 32 bytes ──
    uchar final_input[96];   // 64 (seed) + 32 (mix)
    for (int i = 0; i < 64; i++) final_input[i] = seed[i];
    for (int i = 0; i < 32; i++) final_input[64 + i] = mix_bytes[i];

    uchar hash[32];
    keccak256(final_input, 96, hash);

    // ── Step 6: Check target (big-endian byte comparison: hash <= target) ──
    int meets = 1;
    for (int i = 0; i < 32; i++) {
        if (hash[i] < target[i]) { meets = 1; break; }
        if (hash[i] > target[i]) { meets = 0; break; }
    }

    if (meets) {
        uint old = atomic_xchg(found, 1u);
        if (old == 0u) {
            *output_nonce = nonce;
            for (int i = 0; i < 32; i++) output_hash[i] = hash[i];
        }
    }
}
