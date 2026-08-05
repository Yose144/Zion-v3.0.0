// Pearl (PRL) PoUW MatMul + Jackpot Metal kernel
//
// This kernel implements the compute-intensive part of Pearl PoUW:
//   - INT8 tiled MatMul (4×8 tiles, k=1024, rank=32)
//   - Jackpot accumulation (XOR + rotate_left 13)
//   - BLAKE3 jackpot hash (keyed)
//   - Target check
//
// The CPU handles matrix generation, BLAKE3 commitment hashing, noise
// generation, and Merkle proof construction.
//
// Architecture:
//   - CPU generates matrices A (m×k) and B (k×n), computes hash_a/hash_b,
//     commitment hash, noise, and noised matrix data
//   - CPU sends noised A rows and B cols to GPU as flat buffers
//   - GPU launches 4096 work-items (64 row_offsets × 64 col_offsets)
//   - Each work-item computes one tile: MatMul + jackpot + hash + check
//   - If a valid tile is found, GPU outputs the tile index
//   - CPU reconstructs the Merkle proof for the winning tile
//
// Buffer layout:
//   0: noised_a       — m×k int32s (m=256, k=1024 → 1048576 bytes)
//   1: noised_b       — n×k int32s (n=512, k=1024 → 2097152 bytes, B stored as B^T)
//   2: a_noise_seed   — 32 bytes (BLAKE3 key for jackpot hash)
//   3: target         — 32 bytes (difficulty target, LE)
//   4: row_offsets    — 64 uint32s (valid row offsets)
//   5: col_offsets    — 64 uint32s (valid col offsets)
//   6: rows_base      — 4 uint32s [0, 8, 64, 72]
//   7: cols_base      — 8 uint32s [0, 1, 8, 9, 32, 33, 40, 41]
//   8: output_tile    — 1 uint32 (winning tile index)
//   9: output_jackpot — 32 bytes (winning jackpot hash)
//  10: found          — 1 atomic uint (0 = not found, 1 = found)

#include <metal_stdlib>
using namespace metal;

// ─── BLAKE3 constants ───────────────────────────────────────────────────────

constant const uint BLAKE3_IV[8] = {
    0x6A09E667u, 0xBB67AE85u, 0x3C6EF372u, 0xA54FF53Au,
    0x510E527Fu, 0x9B05688Cu, 0x1F83D9ABu, 0x5BE0CD19u
};

constant const uint MSG_SCHEDULE[7][16] = {
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

void blake3_round(thread uint state[16], thread const uint msg[16], int round) {
    constant const uint *s = MSG_SCHEDULE[round];
    uint m[16];
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

#define CHUNK_START 1u
#define CHUNK_END   2u
#define PARENT      4u
#define ROOT        8u
#define KEYED_HASH  16u

// BLAKE3 keyed hash of a 64-byte message (single chunk, single block).
// Used for jackpot hash: blake3(jackpot_msg_64bytes, key=a_noise_seed).
void blake3_keyed_hash_64(
    device const uchar* key,    // 32 bytes
    thread const uchar* msg,    // 64 bytes
    thread uchar out[32]
) {
    uint state[16];
    // Key words (first 8 words of state)
    for (int i = 0; i < 8; i++) {
        state[i] = (uint)key[i*4]
                 | ((uint)key[i*4+1] << 8)
                 | ((uint)key[i*4+2] << 16)
                 | ((uint)key[i*4+3] << 24);
    }
    // IV (second 8 words)
    for (int i = 0; i < 8; i++) state[8 + i] = BLAKE3_IV[i];

    // Counter = 0, block_len = 64, flags = KEYED_HASH | CHUNK_START | CHUNK_END | ROOT
    state[12] = 0u;
    state[13] = 0u;
    state[14] = 64u;
    state[15] = KEYED_HASH | CHUNK_START | CHUNK_END | ROOT;

    // Message words
    uint m[16];
    for (int i = 0; i < 16; i++) {
        int j = i * 4;
        m[i] = (uint)msg[j]
             | ((uint)msg[j + 1] << 8)
             | ((uint)msg[j + 2] << 16)
             | ((uint)msg[j + 3] << 24);
    }

    // 7 rounds
    for (int r = 0; r < 7; r++) {
        blake3_round(state, m, r);
    }

    // Output: state[i] ^ state[i+8] for first 8 words
    for (int i = 0; i < 8; i++) {
        uint val = state[i] ^ state[i + 8];
        out[i * 4 + 0] = (uchar)(val);
        out[i * 4 + 1] = (uchar)(val >> 8);
        out[i * 4 + 2] = (uchar)(val >> 16);
        out[i * 4 + 3] = (uchar)(val >> 24);
    }
}

// ─── Pearl PoUW constants ───────────────────────────────────────────────────

constant const int TILE_H = 4;   // rows_pattern.size()
constant const int TILE_W = 8;   // cols_pattern.size()
constant const int K_DIM = 1024; // common dimension
constant const int RANK = 32;    // noise rank
constant const int JACKPOT_SIZE = 16;
constant const uint LROT = 13;   // rotate_left per tile

// ─── Pearl PoUW MatMul + Jackpot kernel ─────────────────────────────────────

kernel void pearl_pouw_mine(
    device const int* noised_a      [[buffer(0)]],  // m×k int32 (row-major)
    device const int* noised_b      [[buffer(1)]],  // n×k int32 (B^T, row-major)
    device const uchar* a_noise_seed [[buffer(2)]],  // 32 bytes
    device const uchar* target       [[buffer(3)]],  // 32 bytes
    device const uint* row_offsets   [[buffer(4)]],  // 64 uint32s
    device const uint* col_offsets   [[buffer(5)]],  // 64 uint32s
    constant const uint* rows_base   [[buffer(6)]],  // 4 uint32s
    constant const uint* cols_base   [[buffer(7)]],  // 8 uint32s
    device uint* output_tile         [[buffer(8)]],  // 1 uint32
    device uchar* output_jackpot     [[buffer(9)]],  // 32 bytes
    device atomic_uint* found        [[buffer(10)]], // 1 atomic uint
    uint gid [[thread_position_in_grid]]
)
{
    if (atomic_load_explicit(found, memory_order_relaxed)) return;

    uint row_off_idx = gid / 64u;
    uint col_off_idx = gid % 64u;

    if (row_off_idx >= 64u || col_off_idx >= 64u) return;

    uint row_off = row_offsets[row_off_idx];
    uint col_off = col_offsets[col_off_idx];

    // Compute row/col indices for this tile
    uint a_rows[TILE_H];
    for (int i = 0; i < TILE_H; i++) a_rows[i] = row_off + rows_base[i];

    uint b_cols[TILE_W];
    for (int j = 0; j < TILE_W; j++) b_cols[j] = col_off + cols_base[j];

    // MatMul + jackpot accumulation
    // jackpot_tile[u][v] = sum over l of a_noised[a_rows[u]][l] * b_noised[b_cols[v]][l]
    // jackpot[tid] = jackpot[tid].rotate_left(13) ^ xor_reduce(jackpot_tile)

    int jackpot_tile[TILE_H * TILE_W];  // 4×8 = 32 int32s
    for (int i = 0; i < TILE_H * TILE_W; i++) jackpot_tile[i] = 0;

    uint jackpot[JACKPOT_SIZE];
    for (int i = 0; i < JACKPOT_SIZE; i++) jackpot[i] = 0u;

    // Process k in chunks of rank
    for (int ll = RANK; ll <= K_DIM; ll += RANK) {
        // Accumulate dot products for this chunk
        for (int u = 0; u < TILE_H; u++) {
            uint a_row = a_rows[u];
            for (int v = 0; v < TILE_W; v++) {
                uint b_col = b_cols[v];
                int acc = 0;
                for (int l = ll - RANK; l < ll; l++) {
                    // noised_a[a_row * K_DIM + l] * noised_b[b_col * K_DIM + l]
                    acc += noised_a[a_row * K_DIM + l] * noised_b[b_col * K_DIM + l];
                }
                jackpot_tile[u * TILE_W + v] += acc;
            }
        }

        // XOR-reduce the tile
        uint xored = 0u;
        for (int i = 0; i < TILE_H * TILE_W; i++) {
            xored ^= (uint)jackpot_tile[i];
        }

        // Update jackpot state
        uint tid = (uint)((ll / RANK - 1) % JACKPOT_SIZE);
        jackpot[tid] = (jackpot[tid] << LROT) | (jackpot[tid] >> (32u - LROT));
        jackpot[tid] ^= xored;
    }

    // Build jackpot message: 16 u32 words → 64 bytes LE
    uchar jackpot_msg[64];
    for (int i = 0; i < JACKPOT_SIZE; i++) {
        jackpot_msg[i * 4 + 0] = (uchar)(jackpot[i]);
        jackpot_msg[i * 4 + 1] = (uchar)(jackpot[i] >> 8);
        jackpot_msg[i * 4 + 2] = (uchar)(jackpot[i] >> 16);
        jackpot_msg[i * 4 + 3] = (uchar)(jackpot[i] >> 24);
    }

    // Compute BLAKE3 keyed hash: blake3(jackpot_msg, key=a_noise_seed)
    uchar hash[32];
    blake3_keyed_hash_64(a_noise_seed, jackpot_msg, hash);

    // Compare hash ≤ target (little-endian byte comparison)
    bool meets = true;
    for (int i = 0; i < 32; i++) {
        if (hash[i] < target[i]) { meets = true; break; }
        if (hash[i] > target[i]) { meets = false; break; }
    }

    if (meets) {
        uint old = atomic_exchange_explicit(found, 1u, memory_order_relaxed);
        if (old == 0u) {
            *output_tile = gid;
            for (int i = 0; i < 32; i++) output_jackpot[i] = hash[i];
        }
    }
}
