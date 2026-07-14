// Pearl (PRL) PoUW Fully GPU-Native Pipeline — OpenCL kernel
//
// Complete GPU-native mining pipeline (port of pearl_pouw_native.metal):
//   1. Matrix generation (PCG32 parallel PRNG from nonce)
//   2. BLAKE3 chunk hashing (parallel, keyed with job_key)
//   3. BLAKE3 Merkle tree reduction (log-scale parallel)
//   4. Noise seed derivation
//   5. Noise generation (E_AL, E_AR, E_BL, E_BR + noised matrices)
//   6. MatMul + jackpot accumulation + BLAKE3 jackpot hash + target check
//
// CPU only computes job_key (one BLAKE3 hash) and builds Merkle proof
// when GPU finds a winning tile.
//
// All matrices stay in GPU memory — zero CPU↔GPU data transfer per nonce.

// ─── BLAKE3 constants ───────────────────────────────────────────────────────

__constant const uint BLAKE3_IV[8] = {
    0x6A09E667u, 0xBB67AE85u, 0x3C6EF372u, 0xA54FF53Au,
    0x510E527Fu, 0x9B05688Cu, 0x1F83D9ABu, 0x5BE0CD19u
};

__constant const uint MSG_SCHEDULE[7][16] = {
    { 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15 },
    { 2, 6, 3, 10, 7, 0, 4, 13, 1, 11, 12, 5, 9, 14, 15, 8 },
    { 3, 4, 10, 12, 13, 2, 7, 14, 6, 5, 9, 0, 11, 15, 8, 1 },
    { 10, 7, 12, 9, 14, 3, 13, 15, 4, 0, 11, 2, 5, 8, 1, 6 },
    { 12, 13, 9, 11, 15, 10, 14, 8, 7, 2, 5, 3, 0, 1, 6, 4 },
    { 9, 14, 11, 5, 8, 12, 15, 1, 13, 3, 0, 10, 2, 6, 4, 7 },
    { 11, 15, 5, 0, 1, 9, 8, 6, 14, 10, 2, 12, 3, 4, 7, 13 }
};

#define ROTR32(x, n) (((x) >> (n)) | ((x) << (32 - (n))))

#define G(state, a, b, c, d, x, y) \
    state[a] = state[a] + state[b] + (x); \
    state[d] = ROTR32(state[d] ^ state[a], 16); \
    state[c] = state[c] + state[d]; \
    state[b] = ROTR32(state[b] ^ state[c], 12); \
    state[a] = state[a] + state[b] + (y); \
    state[d] = ROTR32(state[d] ^ state[a], 8); \
    state[c] = state[c] + state[d]; \
    state[b] = ROTR32(state[b] ^ state[c], 7);

#define CHUNK_START 1u
#define CHUNK_END   2u
#define PARENT      4u
#define ROOT        8u
#define KEYED_HASH  16u

// ─── BLAKE3 compression (single block) ──────────────────────────────────────

void blake3_compress(
    __private uint cv[8],
    __private const uint* block,  // 16 uint32 words (64 bytes)
    ulong counter,
    uint block_len,
    uint flags,
    __private uint out[8]
) {
    uint state[16];
    for (int i = 0; i < 8; i++) state[i] = cv[i];
    for (int i = 0; i < 8; i++) state[8 + i] = BLAKE3_IV[i];
    state[12] = (uint)counter;
    state[13] = (uint)(counter >> 32);
    state[14] = block_len;
    state[15] = flags;

    uint m[16];
    for (int i = 0; i < 16; i++) m[i] = block[i];

    for (int r = 0; r < 7; r++) {
        __constant const uint* s = MSG_SCHEDULE[r];
        uint msg[16];
        for (int i = 0; i < 16; i++) msg[i] = m[s[i]];

        G(state, 0, 4, 8,  12, msg[0],  msg[1]);
        G(state, 1, 5, 9,  13, msg[2],  msg[3]);
        G(state, 2, 6, 10, 14, msg[4],  msg[5]);
        G(state, 3, 7, 11, 15, msg[6],  msg[7]);
        G(state, 0, 5, 10, 15, msg[8],  msg[9]);
        G(state, 1, 6, 11, 12, msg[10], msg[11]);
        G(state, 2, 7, 8,  13, msg[12], msg[13]);
        G(state, 3, 4, 9,  14, msg[14], msg[15]);
    }

    for (int i = 0; i < 8; i++) out[i] = state[i] ^ state[i + 8];
}

// ─── BLAKE3 hash one 1024-byte chunk (keyed) ────────────────────────────────
// One work-item per chunk. Each chunk = 16 blocks of 64 bytes.
// Keyed hash: initial chaining value = key words.

__kernel void pearl_blake3_chunk_hash(
    __global const char* data,         // padded data (multiple of 1024 bytes) — char to match Buffer<i8>
    __global const uchar* key,         // 32 bytes (BLAKE3 key, or IV for unkeyed)
    __global uchar* chunk_hashes,      // output: num_chunks × 32 bytes
    const uint num_chunks
)
{
    uint gid = get_global_id(0);
    if (gid >= num_chunks) return;

    // Load key into chaining value
    uint cv[8];
    __global const uchar* k = key;
    for (int i = 0; i < 8; i++) {
        cv[i] = (uint)k[i*4]
              | ((uint)k[i*4+1] << 8)
              | ((uint)k[i*4+2] << 16)
              | ((uint)k[i*4+3] << 24);
    }

    // Process 16 blocks (1024 bytes / 64 bytes per block)
    __global const uchar* chunk_bytes = data + (ulong)gid * 1024UL;

    for (int block = 0; block < 16; block++) {
        uint flags = 0u;
        if (block == 0) flags |= CHUNK_START;
        if (block == 15) flags |= CHUNK_END;

        // Copy block from global to private
        uint block_words[16];
        __global const uint* block_ptr = (__global const uint*)(chunk_bytes + block * 64);
        for (int i = 0; i < 16; i++) block_words[i] = block_ptr[i];

        uint out[8];
        blake3_compress(cv, block_words, 0, 64, flags | KEYED_HASH, out);

        for (int i = 0; i < 8; i++) cv[i] = out[i];
    }

    // Write chunk hash
    __global uchar* out_hash = chunk_hashes + (ulong)gid * 32;
    for (int i = 0; i < 8; i++) {
        out_hash[i*4+0] = (uchar)cv[i];
        out_hash[i*4+1] = (uchar)(cv[i] >> 8);
        out_hash[i*4+2] = (uchar)(cv[i] >> 16);
        out_hash[i*4+3] = (uchar)(cv[i] >> 24);
    }
}

// ─── BLAKE3 Merkle tree parent merge ────────────────────────────────────────
// Merge pairs of 32-byte child hashes into 32-byte parent hashes.
// One work-item per parent node.

__kernel void pearl_blake3_merge(
    __global const uchar* child_hashes,  // num_children × 32 bytes
    __global uchar* parent_hashes,       // (num_children/2) × 32 bytes
    const uint num_parents,
    const uint is_root                   // 1 if this is the final merge (add ROOT flag)
)
{
    uint gid = get_global_id(0);
    if (gid >= num_parents) return;

    // Load left and right child hashes
    uint left[8], right[8];
    __global const uchar* l = child_hashes + (ulong)gid * 2 * 32;
    __global const uchar* r = child_hashes + (ulong)gid * 2 * 32 + 32;
    for (int i = 0; i < 8; i++) {
        left[i] = (uint)l[i*4]
                | ((uint)l[i*4+1] << 8)
                | ((uint)l[i*4+2] << 16)
                | ((uint)l[i*4+3] << 24);
        right[i] = (uint)r[i*4]
                 | ((uint)r[i*4+1] << 8)
                 | ((uint)r[i*4+2] << 16)
                 | ((uint)r[i*4+3] << 24);
    }

    // Parent node: CV = IV, block = left || right, flags = PARENT | ROOT
    uint cv[8];
    for (int i = 0; i < 8; i++) cv[i] = BLAKE3_IV[i];

    uint block[16];
    for (int i = 0; i < 8; i++) block[i] = left[i];
    for (int i = 0; i < 8; i++) block[8 + i] = right[i];

    uint flags = PARENT;
    if (is_root) flags |= ROOT;

    uint out[8];
    blake3_compress(cv, block, 0, 64, flags, out);

    // Write parent hash
    __global uchar* out_hash = parent_hashes + (ulong)gid * 32;
    for (int i = 0; i < 8; i++) {
        out_hash[i*4+0] = (uchar)out[i];
        out_hash[i*4+1] = (uchar)(out[i] >> 8);
        out_hash[i*4+2] = (uchar)(out[i] >> 16);
        out_hash[i*4+3] = (uchar)(out[i] >> 24);
    }
}

// ─── BLAKE3 small message hash (for seed derivation) ────────────────────────
// Hash a small message (≤ 64 bytes) with optional key.
// One work-item (only gid==0 does work).

__kernel void pearl_blake3_small_hash(
    __global const uchar* msg,       // message data
    const uint msg_len,              // message length (≤ 64)
    __global const uchar* key,       // 32 bytes (key for keyed hash, or IV for unkeyed)
    const uint use_keyed,            // 1 = keyed hash, 0 = unkeyed
    __global uchar* out_hash         // 32 bytes output
)
{
    if (get_global_id(0) != 0) return;

    uint cv[8];
    if (use_keyed) {
        for (int i = 0; i < 8; i++) {
            cv[i] = (uint)key[i*4]
                  | ((uint)key[i*4+1] << 8)
                  | ((uint)key[i*4+2] << 16)
                  | ((uint)key[i*4+3] << 24);
        }
    } else {
        for (int i = 0; i < 8; i++) cv[i] = BLAKE3_IV[i];
    }

    // Pad message to 64 bytes
    uint block[16];
    for (int i = 0; i < 16; i++) block[i] = 0u;
    for (uint i = 0; i < msg_len; i++) {
        block[i / 4] |= ((uint)msg[i]) << ((i % 4) * 8);
    }

    uint flags = CHUNK_START | CHUNK_END | ROOT;
    if (use_keyed) flags |= KEYED_HASH;

    uint out[8];
    blake3_compress(cv, block, 0, msg_len, flags, out);

    for (int i = 0; i < 8; i++) {
        out_hash[i*4+0] = (uchar)out[i];
        out_hash[i*4+1] = (uchar)(out[i] >> 8);
        out_hash[i*4+2] = (uchar)(out[i] >> 16);
        out_hash[i*4+3] = (uchar)(out[i] >> 24);
    }
}

// ─── PCG32 parallel PRNG ────────────────────────────────────────────────────

uint pcg32(ulong state) {
    uint xorshifted = (uint)((state >> 18u) ^ state);
    xorshifted >>= 27u;
    uint rot = (uint)(state >> 59u);
    return (xorshifted >> rot) | (xorshifted << ((-rot) & 31u));
}

// Generate char in [-64, 64] from (nonce, index)
char gen_int7(ulong nonce, uint index) {
    ulong state = (nonce ^ ((ulong)index << 32)) * 6364136223846793005UL + 1442695040888963407UL;
    state = state * 6364136223846793005UL + (nonce << 16) + index;
    uint val = pcg32(state);
    return (char)((int)(val % 129u) - 64);
}

// ─── Matrix generation kernel ───────────────────────────────────────────────
// Generate A (m×k, row-major char) or B^T (n×k, row-major char) from nonce.
// One work-item per element.

__kernel void pearl_gen_matrix(
    __global char* matrix,          // output: rows × cols char
    const ulong nonce,
    const uint rows,
    const uint cols,
    const uint is_b_transpose       // 0 = A (m×k), 1 = B^T (n×k), 2 = B (k×n)
)
{
    uint gid = get_global_id(0);
    uint total = rows * cols;
    if (gid >= total) return;

    char val;
    if (is_b_transpose == 0) {
        // A[row][col] = gen_int7(nonce, row * cols + col)
        val = gen_int7(nonce, gid);
    } else if (is_b_transpose == 1) {
        // B^T[j][l] = gen_int7(nonce + 1, j * k + l)
        uint j = gid / cols; // row of B^T
        uint l = gid % cols; // col of B^T
        val = gen_int7(nonce + 1UL, j * cols + l);
    } else {
        // B[row][col] = gen_int7(nonce + 1, row * cols + col)
        val = gen_int7(nonce + 1UL, gid);
    }

    matrix[gid] = val;
}

// ─── Noise generation: get_random_hash ──────────────────────────────────────
// BLAKE3 keyed hash for noise generation.
// message = [0u8; 64] with prepend_value at position prepend_index*4
// followed by seed at bytes 32..64
// key = key (seed label)

void get_random_hash_gpu(
    uint index,
    __global const uchar* seed,   // 32 bytes
    __global const uchar* key,    // 32 bytes
    uint prepend_index,
    __private uchar out[32]
) {
    // Build message: 64 bytes
    uint block[16];
    for (int i = 0; i < 16; i++) block[i] = 0u;

    // prepend_value = (1 + index) as i32 at position prepend_index
    int prepend_value = (int)(1 + index);
    block[prepend_index] = (uint)prepend_value;

    // seed at bytes 32..64 → words 8..15
    for (int i = 0; i < 8; i++) {
        block[8 + i] = (uint)seed[i*4]
                     | ((uint)seed[i*4+1] << 8)
                     | ((uint)seed[i*4+2] << 16)
                     | ((uint)seed[i*4+3] << 24);
    }

    // Keyed hash
    uint cv[8];
    for (int i = 0; i < 8; i++) {
        cv[i] = (uint)key[i*4]
              | ((uint)key[i*4+1] << 8)
              | ((uint)key[i*4+2] << 16)
              | ((uint)key[i*4+3] << 24);
    }

    uint flags = KEYED_HASH | CHUNK_START | CHUNK_END | ROOT;
    uint out_words[8];
    blake3_compress(cv, block, 0, 64, flags, out_words);

    for (int i = 0; i < 8; i++) {
        out[i*4+0] = (uchar)out_words[i];
        out[i*4+1] = (uchar)(out_words[i] >> 8);
        out[i*4+2] = (uchar)(out_words[i] >> 16);
        out[i*4+3] = (uchar)(out_words[i] >> 24);
    }
}

// ─── Noise generation kernel ────────────────────────────────────────────────

#define NOISE_RANK 32u
#define UNIFORM_RANGE 64u
#define ZERO_POINT 32
#define RANGE_MASK_VAL 63u

// Generate E_AR permutation matrix (k pairs of indices into rank)
// One work-item per k element
__kernel void pearl_gen_permutation(
    __global uint* perm,           // output: k × 2 uint32 pairs
    __global const uchar* seed,    // 32 bytes
    __global const uchar* key,     // 32 bytes (seed label)
    const uint k_dim,
    const uint noise_rank
)
{
    uint gid = get_global_id(0);
    if (gid >= k_dim) return;

    // Each hash gives 8 uint32 values (8 permutation pairs)
    uint hash_index = gid / 8;
    uint pair_index = gid % 8;

    uchar hash[32];
    get_random_hash_gpu(hash_index, seed, key, 1, hash);

    uint random_uint32 = (uint)hash[pair_index * 4]
                       | ((uint)hash[pair_index * 4 + 1] << 8)
                       | ((uint)hash[pair_index * 4 + 2] << 16)
                       | ((uint)hash[pair_index * 4 + 3] << 24);

    uint rank_mask = noise_rank - 1;
    uint first_idx = random_uint32 & rank_mask;
    // second_idx = first_idx ^ (1 + mul_hi(noise_rank - 1, random_uint32))
    uint mul_hi_val = (uint)(((ulong)(noise_rank - 1) * (ulong)random_uint32) >> 32);
    uint second_idx = first_idx ^ (1u + mul_hi_val);

    perm[gid * 2 + 0] = first_idx;
    perm[gid * 2 + 1] = second_idx;
}

// Generate uniform random matrix (E_AL or E_BR_transposed)
// One work-item per element
__kernel void pearl_gen_uniform_noise(
    __global char* noise,          // output: rows × cols char
    __global const uchar* seed,    // 32 bytes
    __global const uchar* key,     // 32 bytes (seed label)
    const uint num_rows,
    const uint num_cols
)
{
    uint gid = get_global_id(0);
    uint total = num_rows * num_cols;
    if (gid >= total) return;

    uint row_idx = gid / num_cols;
    uint col_idx = gid % num_cols;
    uint start_idx = row_idx * num_cols + col_idx;

    // Each BLAKE3 hash gives 32 bytes = 32 noise values
    uint block_idx = start_idx / 32;
    uint byte_idx = start_idx % 32;

    uchar hash[32];
    get_random_hash_gpu(block_idx, seed, key, 0, hash);

    uchar byte_val = hash[byte_idx];
    char val = (char)((int)(byte_val & (uchar)RANGE_MASK_VAL) - ZERO_POINT);
    noise[gid] = val;
}

// Compute noised matrices: A' = A + E_AR·E_AL, B'^T = B^T + E_BL·E_BR
// One work-item per (row, k_column) or (col, k_column)

__kernel void pearl_apply_noise_a(
    __global int* noised_a,         // output: m×k int32
    __global const char* matrix_a,  // m×k char
    __global const char* e_al,      // m×rank char
    __global const uint* e_ar_perm, // k×2 uint32 pairs
    const uint m_dim,
    const uint k_dim,
    const uint noise_rank,
    const uint output_offset        // batch offset (0 for single-nonce)
)
{
    uint gid = get_global_id(0);
    uint total = m_dim * k_dim;
    if (gid >= total) return;

    uint i = gid / k_dim;  // row
    uint l = gid % k_dim;  // k column

    // noise_a[i][l] = E_AL[i][E_AR[l].first] - E_AL[i][E_AR[l].second]
    uint first_idx = e_ar_perm[l * 2 + 0];
    uint second_idx = e_ar_perm[l * 2 + 1];

    int e_al_first = (int)e_al[i * noise_rank + first_idx];
    int e_al_second = (int)e_al[i * noise_rank + second_idx];
    int noise_val = e_al_first - e_al_second;

    int a_val = (int)matrix_a[i * k_dim + l];
    noised_a[gid + output_offset] = a_val + noise_val;
}

__kernel void pearl_apply_noise_b(
    __global int* noised_b_t,       // output: n×k int32
    __global const char* matrix_b_t,// n×k char
    __global const char* e_br,      // n×rank char
    __global const uint* e_bl_perm, // k×2 uint32 pairs
    const uint n_dim,
    const uint k_dim,
    const uint noise_rank,
    const uint output_offset        // batch offset (0 for single-nonce)
)
{
    uint gid = get_global_id(0);
    uint total = n_dim * k_dim;
    if (gid >= total) return;

    uint j = gid / k_dim;  // row of B^T
    uint l = gid % k_dim;  // k column

    // noise_b_t[j][l] = E_BR[j][E_BL[l].first] - E_BR[j][E_BL[l].second]
    uint first_idx = e_bl_perm[l * 2 + 0];
    uint second_idx = e_bl_perm[l * 2 + 1];

    int e_br_first = (int)e_br[j * noise_rank + first_idx];
    int e_br_second = (int)e_br[j * noise_rank + second_idx];
    int noise_val = e_br_first - e_br_second;

    int b_val = (int)matrix_b_t[j * k_dim + l];
    noised_b_t[gid + output_offset] = b_val + noise_val;
}

// ─── BLAKE3 keyed hash of 64-byte message (for jackpot) ─────────────────────

void blake3_keyed_hash_64_gpu(
    __global const uchar* key,    // 32 bytes
    __private const uchar* msg,   // 64 bytes
    __private uchar out[32]
) {
    uint state[16];
    for (int i = 0; i < 8; i++) {
        state[i] = (uint)key[i*4]
                 | ((uint)key[i*4+1] << 8)
                 | ((uint)key[i*4+2] << 16)
                 | ((uint)key[i*4+3] << 24);
    }
    for (int i = 0; i < 8; i++) state[8 + i] = BLAKE3_IV[i];

    state[12] = 0u;
    state[13] = 0u;
    state[14] = 64u;
    state[15] = KEYED_HASH | CHUNK_START | CHUNK_END | ROOT;

    uint m[16];
    for (int i = 0; i < 16; i++) {
        int j = i * 4;
        m[i] = (uint)msg[j]
             | ((uint)msg[j + 1] << 8)
             | ((uint)msg[j + 2] << 16)
             | ((uint)msg[j + 3] << 24);
    }

    for (int r = 0; r < 7; r++) {
        __constant const uint* s = MSG_SCHEDULE[r];
        uint msg_perm[16];
        for (int i = 0; i < 16; i++) msg_perm[i] = m[s[i]];

        G(state, 0, 4, 8,  12, msg_perm[0],  msg_perm[1]);
        G(state, 1, 5, 9,  13, msg_perm[2],  msg_perm[3]);
        G(state, 2, 6, 10, 14, msg_perm[4],  msg_perm[5]);
        G(state, 3, 7, 11, 15, msg_perm[6],  msg_perm[7]);
        G(state, 0, 5, 10, 15, msg_perm[8],  msg_perm[9]);
        G(state, 1, 6, 11, 12, msg_perm[10], msg_perm[11]);
        G(state, 2, 7, 8,  13, msg_perm[12], msg_perm[13]);
        G(state, 3, 4, 9,  14, msg_perm[14], msg_perm[15]);
    }

    for (int i = 0; i < 8; i++) {
        uint val = state[i] ^ state[i + 8];
        out[i * 4 + 0] = (uchar)(val);
        out[i * 4 + 1] = (uchar)(val >> 8);
        out[i * 4 + 2] = (uchar)(val >> 16);
        out[i * 4 + 3] = (uchar)(val >> 24);
    }
}

// ─── MatMul + Jackpot + Target check (native) ───────────────────────────────

#define TILE_H 4
#define TILE_W 8
#define JACKPOT_SIZE 16
#define LROT 13u
#define MAX_K 1024u

// v1: One work-item per tile (original — low GPU utilization)
__kernel void pearl_pouw_mine_native(
    __global const int* noised_a,
    __global const int* noised_b,
    __global const uchar* a_noise_seed,
    __global const uchar* target,
    __global const uint* row_offsets,
    __global const uint* col_offsets,
    __global const uint* rows_base,
    __global const uint* cols_base,
    __global uint* output_tile,
    __global uchar* output_jackpot,
    __global volatile uint* found,
    const uint num_row_offsets,
    const uint num_col_offsets,
    const uint k_dim,
    const uint rank
)
{
    if (*found) return;  // volatile read — CL1.2 compatible

    uint gid = get_global_id(0);

    uint row_off_idx = gid / num_col_offsets;
    uint col_off_idx = gid % num_col_offsets;

    if (row_off_idx >= num_row_offsets || col_off_idx >= num_col_offsets) return;

    uint row_off = row_offsets[row_off_idx];
    uint col_off = col_offsets[col_off_idx];

    uint a_rows[TILE_H];
    for (int i = 0; i < TILE_H; i++) a_rows[i] = row_off + rows_base[i];

    uint b_cols[TILE_W];
    for (int j = 0; j < TILE_W; j++) b_cols[j] = col_off + cols_base[j];

    int jackpot_tile[TILE_H * TILE_W];
    for (int i = 0; i < TILE_H * TILE_W; i++) jackpot_tile[i] = 0;

    uint jackpot[JACKPOT_SIZE];
    for (int i = 0; i < JACKPOT_SIZE; i++) jackpot[i] = 0u;

    for (uint ll = rank; ll <= k_dim; ll += rank) {
        for (int u = 0; u < TILE_H; u++) {
            uint a_row = a_rows[u];
            for (int v = 0; v < TILE_W; v++) {
                uint b_col = b_cols[v];
                int acc = 0;
                for (uint l = ll - rank; l < ll; l++) {
                    acc += noised_a[a_row * k_dim + l] * noised_b[b_col * k_dim + l];
                }
                jackpot_tile[u * TILE_W + v] += acc;
            }
        }

        uint xored = 0u;
        for (int i = 0; i < TILE_H * TILE_W; i++) {
            xored ^= (uint)jackpot_tile[i];
        }

        uint tid = (uint)((ll / rank - 1) % JACKPOT_SIZE);
        jackpot[tid] = (jackpot[tid] << LROT) | (jackpot[tid] >> (32u - LROT));
        jackpot[tid] ^= xored;
    }

    uchar jackpot_msg[64];
    for (int i = 0; i < JACKPOT_SIZE; i++) {
        jackpot_msg[i * 4 + 0] = (uchar)(jackpot[i]);
        jackpot_msg[i * 4 + 1] = (uchar)(jackpot[i] >> 8);
        jackpot_msg[i * 4 + 2] = (uchar)(jackpot[i] >> 16);
        jackpot_msg[i * 4 + 3] = (uchar)(jackpot[i] >> 24);
    }

    uchar hash[32];
    blake3_keyed_hash_64_gpu(a_noise_seed, jackpot_msg, hash);

    bool meets = true;
    for (int i = 0; i < 32; i++) {
        if (hash[i] < target[i]) { meets = true; break; }
        if (hash[i] > target[i]) { meets = false; break; }
    }

    if (meets) {
        uint old = atomic_xchg(found, 1u);
        if (old == 0u) {
            *output_tile = gid;
            for (int i = 0; i < 32; i++) output_jackpot[i] = hash[i];
        }
    }
}

// v2: One work-group per tile, TILE_H*TILE_W=32 work-items per group.
// Uses local memory to cache noised matrix rows, eliminating redundant global reads.
// Each work-item computes one (u,v) element of the dot product.
// Parallel XOR reduction across 32 work-items.
// Only work-item 0 does BLAKE3 hash + target check.
//
// Local memory: TILE_H*MAX_K + TILE_W*MAX_K = 4*1024 + 8*1024 = 48KB int32
__kernel void pearl_pouw_mine_native_v2(
    __global const int* noised_a,
    __global const int* noised_b,
    __global const uchar* a_noise_seed,
    __global const uchar* target,
    __global const uint* row_offsets,
    __global const uint* col_offsets,
    __global const uint* rows_base,
    __global const uint* cols_base,
    __global uint* output_tile,
    __global uchar* output_jackpot,
    __global volatile uint* found,
    const uint num_row_offsets,
    const uint num_col_offsets,
    const uint k_dim,
    const uint rank
)
{
    // Local memory: cache noised matrix rows for this tile
    __local int local_a[TILE_H * MAX_K];   // 4 * 1024 = 16KB
    __local int local_b[TILE_W * MAX_K];   // 8 * 1024 = 32KB
    __local int jackpot_tile[TILE_H * TILE_W];  // 32 elements
    __local uint jackpot[JACKPOT_SIZE];    // 16 elements
    __local uint reduce_buf[TILE_H * TILE_W];   // 32 elements for XOR reduction

    uint lid = get_local_id(0);       // 0..31
    uint tile_id = get_group_id(0);   // tile index

    if (*found) return;

    uint row_off_idx = tile_id / num_col_offsets;
    uint col_off_idx = tile_id % num_col_offsets;

    if (row_off_idx >= num_row_offsets || col_off_idx >= num_col_offsets) return;

    uint row_off = row_offsets[row_off_idx];
    uint col_off = col_offsets[col_off_idx];

    uint u = lid / TILE_W;  // 0..3
    uint v = lid % TILE_W;  // 0..7

    // ── Cooperatively load noised_a rows into local memory ────────────
    // local_a[row_idx * k_dim + col] = noised_a[(row_off + rows_base[row_idx]) * k_dim + col]
    for (uint i = lid; i < TILE_H * k_dim; i += TILE_H * TILE_W) {
        uint row_idx = i / k_dim;
        uint col_idx = i % k_dim;
        uint global_row = row_off + rows_base[row_idx];
        local_a[i] = noised_a[global_row * k_dim + col_idx];
    }

    // ── Cooperatively load noised_b rows into local memory ────────────
    for (uint i = lid; i < TILE_W * k_dim; i += TILE_H * TILE_W) {
        uint col_idx = i / k_dim;
        uint elem_idx = i % k_dim;
        uint global_col = col_off + cols_base[col_idx];
        local_b[i] = noised_b[global_col * k_dim + elem_idx];
    }

    // Initialize accumulators
    jackpot_tile[lid] = 0;
    if (lid < JACKPOT_SIZE) jackpot[lid] = 0u;

    barrier(CLK_LOCAL_MEM_FENCE);

    // ── MatMul in rank chunks ─────────────────────────────────────────
    for (uint ll = rank; ll <= k_dim; ll += rank) {
        // Compute partial dot product from local memory
        int acc = 0;
        uint a_off = u * k_dim + (ll - rank);
        uint b_off = v * k_dim + (ll - rank);
        for (uint l = 0; l < rank; l++) {
            acc += local_a[a_off + l] * local_b[b_off + l];
        }
        jackpot_tile[lid] += acc;
        barrier(CLK_LOCAL_MEM_FENCE);

        // Parallel XOR reduction across 32 work-items
        reduce_buf[lid] = (uint)jackpot_tile[lid];
        barrier(CLK_LOCAL_MEM_FENCE);

        // Tree reduction: 32 → 16 → 8 → 4 → 2 → 1
        for (uint stride = (TILE_H * TILE_W) / 2; stride > 0; stride >>= 1) {
            if (lid < stride) {
                reduce_buf[lid] ^= reduce_buf[lid + stride];
            }
            barrier(CLK_LOCAL_MEM_FENCE);
        }

        // reduce_buf[0] has the XOR of all 32 tile elements
        if (lid == 0) {
            uint xored = reduce_buf[0];
            uint tid = (uint)((ll / rank - 1) % JACKPOT_SIZE);
            jackpot[tid] = (jackpot[tid] << LROT) | (jackpot[tid] >> (32u - LROT));
            jackpot[tid] ^= xored;
        }
        barrier(CLK_LOCAL_MEM_FENCE);
    }

    // ── BLAKE3 hash + target check (only lid==0) ──────────────────────
    if (lid == 0) {
        uchar jackpot_msg[64];
        for (int i = 0; i < JACKPOT_SIZE; i++) {
            jackpot_msg[i * 4 + 0] = (uchar)(jackpot[i]);
            jackpot_msg[i * 4 + 1] = (uchar)(jackpot[i] >> 8);
            jackpot_msg[i * 4 + 2] = (uchar)(jackpot[i] >> 16);
            jackpot_msg[i * 4 + 3] = (uchar)(jackpot[i] >> 24);
        }

        uchar hash[32];
        blake3_keyed_hash_64_gpu(a_noise_seed, jackpot_msg, hash);

        bool meets = true;
        for (int i = 0; i < 32; i++) {
            if (hash[i] < target[i]) { meets = true; break; }
            if (hash[i] > target[i]) { meets = false; break; }
        }

        if (meets) {
            uint old = atomic_xchg(found, 1u);
            if (old == 0u) {
                *output_tile = tile_id;
                for (int i = 0; i < 32; i++) output_jackpot[i] = hash[i];
            }
        }
    }
}

// v3: One work-group per tile, 32 work-items per group.
// NO local memory for matrix data — relies on L1 cache for reuse.
// Much higher occupancy (only ~320 bytes local memory per group).
// Each work-item reads from global memory directly; L1 cache handles
// the fact that 8 work-items share the same a_row and 4 share the same b_col.
__kernel void pearl_pouw_mine_native_v3(
    __global const int* noised_a,
    __global const int* noised_b,
    __global const uchar* a_noise_seed,
    __global const uchar* target,
    __global const uint* row_offsets,
    __global const uint* col_offsets,
    __global const uint* rows_base,
    __global const uint* cols_base,
    __global uint* output_tile,
    __global uchar* output_jackpot,
    __global volatile uint* found,
    const uint num_row_offsets,
    const uint num_col_offsets,
    const uint k_dim,
    const uint rank
)
{
    __local int jackpot_tile[TILE_H * TILE_W];  // 32 elements = 128 bytes
    __local uint jackpot[JACKPOT_SIZE];          // 16 elements = 64 bytes

    uint lid = get_local_id(0);
    uint tile_id = get_group_id(0);

    if (*found) return;

    uint row_off_idx = tile_id / num_col_offsets;
    uint col_off_idx = tile_id % num_col_offsets;

    if (row_off_idx >= num_row_offsets || col_off_idx >= num_col_offsets) return;

    uint row_off = row_offsets[row_off_idx];
    uint col_off = col_offsets[col_off_idx];

    uint u = lid / TILE_W;
    uint v = lid % TILE_W;
    uint a_row = row_off + rows_base[u];
    uint b_col = col_off + cols_base[v];

    jackpot_tile[lid] = 0;
    if (lid < JACKPOT_SIZE) jackpot[lid] = 0u;
    barrier(CLK_LOCAL_MEM_FENCE);

    for (uint ll = rank; ll <= k_dim; ll += rank) {
        // Read directly from global memory — L1 cache handles reuse.
        // Vectorized int4 loads: 4 elements per transaction, fully unrolled.
        int acc = 0;
        uint a_base = a_row * k_dim + (ll - rank);
        uint b_base = b_col * k_dim + (ll - rank);
        // rank=32 → 8 iterations of int4
        for (uint l = 0; l < rank; l += 4) {
            int4 av = vload4(0, &noised_a[a_base + l]);
            int4 bv = vload4(0, &noised_b[b_base + l]);
            acc += av.x * bv.x + av.y * bv.y + av.z * bv.z + av.w * bv.w;
        }
        jackpot_tile[lid] += acc;
        barrier(CLK_LOCAL_MEM_FENCE);  // ensure all writes visible

        // Sequential XOR reduction by lid==0 (2 barriers vs 8 for tree reduction)
        if (lid == 0) {
            uint xored = 0u;
            for (int i = 0; i < TILE_H * TILE_W; i++) {
                xored ^= (uint)jackpot_tile[i];
            }
            uint tid = (uint)((ll / rank - 1) % JACKPOT_SIZE);
            jackpot[tid] = (jackpot[tid] << LROT) | (jackpot[tid] >> (32u - LROT));
            jackpot[tid] ^= xored;
        }
        barrier(CLK_LOCAL_MEM_FENCE);  // ensure jackpot update visible for next iter
    }

    if (lid == 0) {
        uchar jackpot_msg[64];
        for (int i = 0; i < JACKPOT_SIZE; i++) {
            jackpot_msg[i * 4 + 0] = (uchar)(jackpot[i]);
            jackpot_msg[i * 4 + 1] = (uchar)(jackpot[i] >> 8);
            jackpot_msg[i * 4 + 2] = (uchar)(jackpot[i] >> 16);
            jackpot_msg[i * 4 + 3] = (uchar)(jackpot[i] >> 24);
        }

        uchar hash[32];
        blake3_keyed_hash_64_gpu(a_noise_seed, jackpot_msg, hash);

        bool meets = true;
        for (int i = 0; i < 32; i++) {
            if (hash[i] < target[i]) { meets = true; break; }
            if (hash[i] > target[i]) { meets = false; break; }
        }

        if (meets) {
            uint old = atomic_xchg(found, 1u);
            if (old == 0u) {
                *output_tile = tile_id;
                for (int i = 0; i < 32; i++) output_jackpot[i] = hash[i];
            }
        }
    }
}

// ─── Persistent batched mining kernel ──────────────────────────────────────
//
// Processes multiple nonces in a single launch. Each work-group handles one
// tile of one nonce. The host pre-computes steps 1-6 for all nonces and
// uploads concatenated noised matrices + noise seeds.
//
// Work-group layout: lws=32 (TILE_H*TILE_W), gws = num_nonces * total_tiles * 32
// Work-group ID encodes: nonce_id = gid / tiles_per_nonce, tile_id = gid % tiles_per_nonce

__kernel void pearl_pouw_mine_persistent(
    __global const int* noised_a_batch,   // [num_nonces * m * k]
    __global const int* noised_b_batch,   // [num_nonces * n * k]
    __global const uchar* noise_seeds_batch, // [num_nonces * 32]
    __global const uchar* target,
    __global const uint* row_offsets,
    __global const uint* col_offsets,
    __global const uint* rows_base,
    __global const uint* cols_base,
    __global uint* output_tile,           // [1] — tile_id within winning nonce
    __global uchar* output_jackpot,       // [32]
    __global uchar* output_nonce,         // [8] — winning nonce (u64 LE)
    __global volatile uint* found,
    const uint num_nonces,
    const uint base_nonce,                // first nonce in batch
    const uint num_row_offsets,
    const uint num_col_offsets,
    const uint k_dim,
    const uint rank,
    const uint m_dim,
    const uint n_dim
)
{
    __local int jackpot_tile[TILE_H * TILE_W];
    __local uint jackpot[JACKPOT_SIZE];

    uint lid = get_local_id(0);
    uint gid = get_group_id(0);

    if (*found) return;

    uint tiles_per_nonce = num_row_offsets * num_col_offsets;
    uint nonce_idx = gid / tiles_per_nonce;
    uint tile_id = gid % tiles_per_nonce;

    if (nonce_idx >= num_nonces) return;

    uint row_off_idx = tile_id / num_col_offsets;
    uint col_off_idx = tile_id % num_col_offsets;

    if (row_off_idx >= num_row_offsets || col_off_idx >= num_col_offsets) return;

    uint row_off = row_offsets[row_off_idx];
    uint col_off = col_offsets[col_off_idx];

    uint u = lid / TILE_W;
    uint v = lid % TILE_W;
    uint a_row = row_off + rows_base[u];
    uint b_col = col_off + cols_base[v];

    // Offset into batched buffers for this nonce
    uint a_offset = nonce_idx * m_dim * k_dim;
    uint b_offset = nonce_idx * n_dim * k_dim;
    uint seed_offset = nonce_idx * 32;

    __global const int* noised_a = noised_a_batch + a_offset;
    __global const int* noised_b = noised_b_batch + b_offset;
    __global const uchar* a_noise_seed = noise_seeds_batch + seed_offset;

    jackpot_tile[lid] = 0;
    if (lid < JACKPOT_SIZE) jackpot[lid] = 0u;
    barrier(CLK_LOCAL_MEM_FENCE);

    for (uint ll = rank; ll <= k_dim; ll += rank) {
        int acc = 0;
        uint a_base = a_row * k_dim + (ll - rank);
        uint b_base = b_col * k_dim + (ll - rank);
        for (uint l = 0; l < rank; l += 4) {
            int4 av = vload4(0, &noised_a[a_base + l]);
            int4 bv = vload4(0, &noised_b[b_base + l]);
            acc += av.x * bv.x + av.y * bv.y + av.z * bv.z + av.w * bv.w;
        }
        jackpot_tile[lid] += acc;
        barrier(CLK_LOCAL_MEM_FENCE);

        if (lid == 0) {
            uint xored = 0u;
            for (int i = 0; i < TILE_H * TILE_W; i++) {
                xored ^= (uint)jackpot_tile[i];
            }
            uint tid = (uint)((ll / rank - 1) % JACKPOT_SIZE);
            jackpot[tid] = (jackpot[tid] << LROT) | (jackpot[tid] >> (32u - LROT));
            jackpot[tid] ^= xored;
        }
        barrier(CLK_LOCAL_MEM_FENCE);
    }

    if (lid == 0) {
        uchar jackpot_msg[64];
        for (int i = 0; i < JACKPOT_SIZE; i++) {
            jackpot_msg[i * 4 + 0] = (uchar)(jackpot[i]);
            jackpot_msg[i * 4 + 1] = (uchar)(jackpot[i] >> 8);
            jackpot_msg[i * 4 + 2] = (uchar)(jackpot[i] >> 16);
            jackpot_msg[i * 4 + 3] = (uchar)(jackpot[i] >> 24);
        }

        uchar hash[32];
        blake3_keyed_hash_64_gpu(a_noise_seed, jackpot_msg, hash);

        bool meets = true;
        for (int i = 0; i < 32; i++) {
            if (hash[i] < target[i]) { meets = true; break; }
            if (hash[i] > target[i]) { meets = false; break; }
        }

        if (meets) {
            uint old = atomic_xchg(found, 1u);
            if (old == 0u) {
                *output_tile = tile_id;
                for (int i = 0; i < 32; i++) output_jackpot[i] = hash[i];
                // Write nonce as u64 LE
                ulong nonce_val = (ulong)base_nonce + (ulong)nonce_idx;
                for (int i = 0; i < 8; i++) {
                    output_nonce[i] = (uchar)((nonce_val >> (i * 8)) & 0xFFu);
                }
            }
        }
    }
}

// ─── Real Pearl PoUW GEMM kernel (CPU-prep + GPU dispatch) ──────────────────
//
// This kernel implements ONLY the noisy GEMM + jackpot hash + target check
// for the REAL Pearl PoUW algorithm (matching pearl_real_pouw.rs).
//
// CPU pre-computes: matrices A/B (BLAKE3 PRNG), Merkle trees, noise matrices,
// noised matrices A' (m×k int8) and B'^T (n×k int8), then uploads them.
// GPU runs this kernel to check all hash tiles in parallel.
//
// Key differences from pearl_pouw_mine_native_v3:
//   - int8 noised matrix inputs (not int32) — 4x less bandwidth
//   - 16×16 hash tiles (256 work-items per group, not 32)
//   - Little-endian U256 target comparison (from byte 31, not byte 0)
//   - Dynamic noise_rank and hash_tile dimensions (passed as args)
//   - No matrix generation / noise generation on GPU
//
// Work-group layout: lws = hash_tile_h * hash_tile_w (e.g. 256 for 16×16)
// One work-group per hash tile. Each work-item computes one (u,v) element.
//
// Hash tile encoding:
//   total_output_tiles = (m / noise_rank) * (n / noise_rank)
//   hash_tiles_per_output = (noise_rank / hash_tile_h) * (noise_rank / hash_tile_w)
//   total_hash_tiles = total_output_tiles * hash_tiles_per_output
//
//   output_tile_idx = tile_id / hash_tiles_per_output
//   ht_idx = tile_id % hash_tiles_per_output
//   i_out = output_tile_idx / (n / noise_rank)
//   j_out = output_tile_idx % (n / noise_rank)
//   ht_h = ht_idx / (noise_rank / hash_tile_w)
//   ht_w = ht_idx % (noise_rank / hash_tile_w)

__kernel void pearl_pouw_mine_real_v1(
    __global const char* noised_a,     // m×k int8 (A' = A + E_AL·E_AR, wrapped to int8)
    __global const char* noised_bt,    // n×k int8 (B'^T = transpose of B')
    __global const uchar* pow_key,     // 32 bytes (noise_seed_a, used as BLAKE3 key)
    __global const uchar* target,      // 32 bytes (little-endian U256)
    __global uint* output_tile,        // [1] — winning hash tile index
    __global uchar* output_jackpot,    // [32] — winning jackpot hash
    __global volatile uint* found,     // [1] — atomic flag
    const uint m_dim,
    const uint n_dim,
    const uint k_dim,
    const uint noise_rank,
    const uint hash_tile_h,
    const uint hash_tile_w,
    const uint num_ht_h,              // noise_rank / hash_tile_h
    const uint num_ht_w,              // noise_rank / hash_tile_w
    const uint num_output_tiles_i,    // m / noise_rank
    const uint num_output_tiles_j     // n / noise_rank
)
{
    // Local memory for XOR reduction across hash tile elements
    uint tile_size = hash_tile_h * hash_tile_w;
    // Max tile_size we support is 256 (16×16). Allocate 256 entries.
    __local int tile_acc[256];
    __local uint jackpot[16];       // transcript: 16 × uint32 = 64 bytes
    __local uint reduce_buf[256];

    uint lid = get_local_id(0);
    uint tile_id = get_group_id(0);

    if (*found) return;

    // Decode tile_id → (i_out, j_out, ht_h, ht_w)
    uint hash_tiles_per_output = num_ht_h * num_ht_w;
    uint output_tile_idx = tile_id / hash_tiles_per_output;
    uint ht_idx = tile_id % hash_tiles_per_output;

    uint i_out = output_tile_idx / num_output_tiles_j;
    uint j_out = output_tile_idx % num_output_tiles_j;

    uint ht_h_idx = ht_idx / num_ht_w;
    uint ht_w_idx = ht_idx % num_ht_w;

    // Base row/col offsets for this hash tile
    uint i_off = i_out * noise_rank + ht_h_idx * hash_tile_h;
    uint j_off = j_out * noise_rank + ht_w_idx * hash_tile_w;

    // Work-item → (u, v) within hash tile
    uint u = lid / hash_tile_w;
    uint v = lid % hash_tile_w;

    // Global row/col for this work-item
    uint a_row = i_off + u;
    uint b_col = j_off + v;

    if (a_row >= m_dim || b_col >= n_dim) return;

    // Initialize accumulator and transcript
    tile_acc[lid] = 0;
    if (lid < 16) jackpot[lid] = 0u;
    barrier(CLK_LOCAL_MEM_FENCE);

    // ── GEMM in noise_rank steps ──────────────────────────────────────
    uint reduction_count = 0;
    for (uint p = 0; p < k_dim; p += noise_rank) {
        // Compute dot product: sum over l in [0, noise_rank) of
        //   noised_a[a_row * k_dim + p + l] * noised_bt[b_col * k_dim + p + l]
        int acc = 0;
        uint a_base = a_row * k_dim + p;
        uint b_base = b_col * k_dim + p;

        // Vectorized char4 loads: 4 elements per transaction
        for (uint l = 0; l < noise_rank; l += 4) {
            char4 av = vload4(0, &noised_a[a_base + l]);
            char4 bv = vload4(0, &noised_bt[b_base + l]);
            acc += (int)av.x * (int)bv.x + (int)av.y * (int)bv.y
                 + (int)av.z * (int)bv.z + (int)av.w * (int)bv.w;
        }

        tile_acc[lid] += acc;
        barrier(CLK_LOCAL_MEM_FENCE);

        // Parallel XOR reduction across tile_size work-items
        reduce_buf[lid] = (uint)tile_acc[lid];
        barrier(CLK_LOCAL_MEM_FENCE);

        // Tree reduction: tile_size → 1
        for (uint stride = tile_size / 2; stride > 0; stride >>= 1) {
            if (lid < stride) {
                reduce_buf[lid] ^= reduce_buf[lid + stride];
            }
            barrier(CLK_LOCAL_MEM_FENCE);
        }

        // reduce_buf[0] has XOR of all tile elements
        if (lid == 0) {
            uint xored = reduce_buf[0];
            uint tid = reduction_count % 16u;
            jackpot[tid] = (jackpot[tid] << 13u) | (jackpot[tid] >> (32u - 13u));
            jackpot[tid] ^= xored;
        }
        reduction_count++;
        barrier(CLK_LOCAL_MEM_FENCE);
    }

    // ── BLAKE3 keyed hash of transcript + target check ────────────────
    if (lid == 0) {
        // Build 64-byte jackpot message from transcript (16 × uint32 LE)
        uchar jackpot_msg[64];
        for (int i = 0; i < 16; i++) {
            jackpot_msg[i * 4 + 0] = (uchar)(jackpot[i]);
            jackpot_msg[i * 4 + 1] = (uchar)(jackpot[i] >> 8);
            jackpot_msg[i * 4 + 2] = (uchar)(jackpot[i] >> 16);
            jackpot_msg[i * 4 + 3] = (uchar)(jackpot[i] >> 24);
        }

        // BLAKE3 keyed hash (key = pow_key, message = 64 bytes)
        uchar hash[32];
        blake3_keyed_hash_64_gpu(pow_key, jackpot_msg, hash);

        // Little-endian U256 comparison: hash <= target
        // Compare from most significant byte (index 31) down to least (index 0)
        bool meets = true;
        for (int i = 31; i >= 0; i--) {
            if (hash[i] != target[i]) {
                meets = (hash[i] < target[i]);
                break;
            }
        }

        if (meets) {
            uint old = atomic_xchg(found, 1u);
            if (old == 0u) {
                *output_tile = tile_id;
                for (int i = 0; i < 32; i++) output_jackpot[i] = hash[i];
            }
        }
    }
}
