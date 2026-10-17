// Pearl (PRL) PoUW GPU-Native Pipeline — CUDA port of pearl_pouw_native.cl
//
// Same pipeline as the OpenCL kernel:
//   1. Matrix generation (PCG32 parallel PRNG from nonce)
//   2. BLAKE3 chunk hashing (keyed with job_key, counter = chunk index)
//   3. BLAKE3 Merkle tree reduction (keyed parents, odd-leaf propagate)
//   4. Noise seed derivation (small_hash)
//   5. Noise generation (E_AL, E_AR, E_BL, E_BR + noised matrices)
//   6. MatMul + jackpot accumulation + BLAKE3 jackpot hash + target check
//
// Translation notes (OpenCL -> CUDA):
//   __kernel            -> extern "C" __global__
//   __global T*         -> T*
//   __private           -> local
//   __local             -> __shared__
//   __constant const    -> __constant__
//   get_global_id(0)    -> blockIdx.x * blockDim.x + threadIdx.x
//   get_local_id(0)     -> threadIdx.x
//   get_group_id(0)     -> blockIdx.x
//   barrier(CLK_LOCAL_MEM_FENCE) -> __syncthreads()
//   atomic_xchg         -> atomicExch
//   uchar/uint/ulong    -> unsigned char / unsigned int / unsigned long long
//   char (i8)           -> signed char
//   vload4              -> reinterpret_cast<const int4*>
//
// Host counterpart: src/gpu/pearl_cuda.rs (PearlCudaMiner).

typedef unsigned char uchar;
typedef unsigned int uint;
typedef unsigned long long ulong;

// ─── BLAKE3 constants ───────────────────────────────────────────────────────

__constant__ const uint BLAKE3_IV[8] = {
    0x6A09E667u, 0xBB67AE85u, 0x3C6EF372u, 0xA54FF53Au,
    0x510E527Fu, 0x9B05688Cu, 0x1F83D9ABu, 0x5BE0CD19u
};

__constant__ const uint MSG_SCHEDULE[7][16] = {
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

__device__ void blake3_compress(
    uint cv[8],
    const uint* block,  // 16 uint32 words (64 bytes)
    ulong counter,
    uint block_len,
    uint flags,
    uint out[8]
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
        const uint* s = MSG_SCHEDULE[r];
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
// One thread per chunk. Each chunk = 16 blocks of 64 bytes.
// Keyed hash: initial chaining value = key words.

extern "C" __global__ void pearl_blake3_chunk_hash(
    const signed char* data,         // padded data (multiple of 1024 bytes)
    const uchar* key,                // 32 bytes (BLAKE3 key)
    uchar* chunk_hashes,             // output: num_chunks × 32 bytes
    const uint num_chunks,
    const uint single_root           // 1 = data fits one chunk → ROOT flag on last block
)
{
    uint gid = blockIdx.x * blockDim.x + threadIdx.x;
    if (gid >= num_chunks) return;

    uint cv[8];
    const uchar* k = key;
    for (int i = 0; i < 8; i++) {
        cv[i] = (uint)k[i*4]
              | ((uint)k[i*4+1] << 8)
              | ((uint)k[i*4+2] << 16)
              | ((uint)k[i*4+3] << 24);
    }

    const uchar* chunk_bytes = (const uchar*)data + (ulong)gid * 1024ULL;

    for (int block = 0; block < 16; block++) {
        uint flags = 0u;
        if (block == 0) flags |= CHUNK_START;
        if (block == 15) flags |= CHUNK_END;
        // Single-chunk tree (data <= 1024B): leaf IS the root → ROOT flag.
        if (block == 15 && single_root) flags |= ROOT;

        uint block_words[16];
        const uint* block_ptr = (const uint*)(chunk_bytes + block * 64);
        for (int i = 0; i < 16; i++) block_words[i] = block_ptr[i];

        uint out[8];
        // Counter = chunk index for ALL blocks of this chunk (BLAKE3 spec).
        blake3_compress(cv, block_words, (ulong)gid, 64, flags | KEYED_HASH, out);

        for (int i = 0; i < 8; i++) cv[i] = out[i];
    }

    uchar* out_hash = chunk_hashes + (ulong)gid * 32;
    for (int i = 0; i < 8; i++) {
        out_hash[i*4+0] = (uchar)cv[i];
        out_hash[i*4+1] = (uchar)(cv[i] >> 8);
        out_hash[i*4+2] = (uchar)(cv[i] >> 16);
        out_hash[i*4+3] = (uchar)(cv[i] >> 24);
    }
}

// ─── BLAKE3 Merkle tree parent merge ────────────────────────────────────────
// One thread per parent node.

extern "C" __global__ void pearl_blake3_merge(
    const uchar* child_hashes,   // num_children × 32 bytes
    const uchar* key,            // 32 bytes (BLAKE3 key — parent nodes are keyed too)
    uchar* parent_hashes,        // ceil(num_children/2) × 32 bytes
    const uint num_children,
    const uint is_root           // 1 if this is the final merge (add ROOT flag)
)
{
    uint gid = blockIdx.x * blockDim.x + threadIdx.x;
    uint num_parents = (num_children + 1) >> 1;
    if (gid >= num_parents) return;

    uint left[8], right[8];
    const uchar* l = child_hashes + (ulong)gid * 2 * 32;
    for (int i = 0; i < 8; i++) {
        left[i] = (uint)l[i*4]
                | ((uint)l[i*4+1] << 8)
                | ((uint)l[i*4+2] << 16)
                | ((uint)l[i*4+3] << 24);
    }

    uchar* out_hash = parent_hashes + (ulong)gid * 32;

    // Odd child count: last unpaired child propagates up unchanged
    // (canonical MerkleTree::combine_layer pushes the lone CV through).
    if (gid * 2 + 1 >= num_children) {
        for (int i = 0; i < 8; i++) {
            out_hash[i*4+0] = (uchar)left[i];
            out_hash[i*4+1] = (uchar)(left[i] >> 8);
            out_hash[i*4+2] = (uchar)(left[i] >> 16);
            out_hash[i*4+3] = (uchar)(left[i] >> 24);
        }
        return;
    }

    const uchar* r = child_hashes + (ulong)gid * 2 * 32 + 32;
    for (int i = 0; i < 8; i++) {
        right[i] = (uint)r[i*4]
                 | ((uint)r[i*4+1] << 8)
                 | ((uint)r[i*4+2] << 16)
                 | ((uint)r[i*4+3] << 24);
    }

    // Parent node in a KEYED merkle tree: CV = key words,
    // flags = PARENT | KEYED_HASH (+ ROOT on the final merge).
    uint cv[8];
    const uchar* k = key;
    for (int i = 0; i < 8; i++) {
        cv[i] = (uint)k[i*4]
              | ((uint)k[i*4+1] << 8)
              | ((uint)k[i*4+2] << 16)
              | ((uint)k[i*4+3] << 24);
    }

    uint block[16];
    for (int i = 0; i < 8; i++) block[i] = left[i];
    for (int i = 0; i < 8; i++) block[8 + i] = right[i];

    uint flags = PARENT | KEYED_HASH;
    if (is_root) flags |= ROOT;

    uint out[8];
    blake3_compress(cv, block, 0, 64, flags, out);

    for (int i = 0; i < 8; i++) {
        out_hash[i*4+0] = (uchar)out[i];
        out_hash[i*4+1] = (uchar)(out[i] >> 8);
        out_hash[i*4+2] = (uchar)(out[i] >> 16);
        out_hash[i*4+3] = (uchar)(out[i] >> 24);
    }
}

// ─── Fused whole-tree merkle reduction ──────────────────────────────────────
// One block folds the entire tree: grid-stride over each level's parents,
// __syncthreads between levels, ping-pong leaf_buf <-> scratch (levels
// alternate directions; each level's src is fully consumed by the previous
// level so writing back into it is safe). Layering, odd-leaf passthrough and
// the ROOT-flag-on-final-merge semantics are identical to the per-level
// pearl_blake3_merge launches.
extern "C" __global__ void pearl_merkle_tree(
    uchar* leaf_hashes,          // num_leaves × 32 (chunk CVs; reused as ping buf)
    const uchar* key,            // 32 bytes keyed-hash key
    uchar* scratch,              // num_leaves × 32 second ping buffer
    uchar* root_out,             // 32 bytes — receives the ROOT-flagged CV
    const uint num_leaves
)
{
    const uint tid = threadIdx.x;
    if (num_leaves == 1u) {
        if (tid < 8u) {
            uint w = ((const uint*)leaf_hashes)[tid];
            ((uint*)root_out)[tid] = w;
        }
        return;
    }

    uint cv_key[8];
    for (int i = 0; i < 8; i++) {
        cv_key[i] = (uint)key[i*4]
                  | ((uint)key[i*4+1] << 8)
                  | ((uint)key[i*4+2] << 16)
                  | ((uint)key[i*4+3] << 24);
    }

    uchar* src = leaf_hashes;
    uchar* dst = scratch;
    uint n = num_leaves;
    while (n > 1u) {
        const uint parents = (n + 1u) >> 1;
        const bool root_level = (n == 2u);
        uchar* out_buf = root_level ? root_out : dst;
        for (uint gid = tid; gid < parents; gid += blockDim.x) {
            const uchar* l = src + (ulong)gid * 64;
            uint left[8];
            for (int i = 0; i < 8; i++) {
                left[i] = (uint)l[i*4]
                        | ((uint)l[i*4+1] << 8)
                        | ((uint)l[i*4+2] << 16)
                        | ((uint)l[i*4+3] << 24);
            }
            uchar* out_hash = out_buf + (ulong)gid * 32;
            if (gid * 2u + 1u >= n) {
                // Lone child propagates unchanged (MerkleTree::combine_layer).
                for (int i = 0; i < 8; i++) {
                    out_hash[i*4+0] = (uchar)left[i];
                    out_hash[i*4+1] = (uchar)(left[i] >> 8);
                    out_hash[i*4+2] = (uchar)(left[i] >> 16);
                    out_hash[i*4+3] = (uchar)(left[i] >> 24);
                }
                continue;
            }
            const uchar* r = l + 32;
            uint right[8];
            for (int i = 0; i < 8; i++) {
                right[i] = (uint)r[i*4]
                         | ((uint)r[i*4+1] << 8)
                         | ((uint)r[i*4+2] << 16)
                         | ((uint)r[i*4+3] << 24);
            }
            uint block[16];
            for (int i = 0; i < 8; i++) block[i] = left[i];
            for (int i = 0; i < 8; i++) block[8 + i] = right[i];
            uint flags = PARENT | KEYED_HASH;
            if (root_level) flags |= ROOT;
            uint cv[8];
            for (int i = 0; i < 8; i++) cv[i] = cv_key[i];
            uint out[8];
            blake3_compress(cv, block, 0, 64, flags, out);
            for (int i = 0; i < 8; i++) {
                out_hash[i*4+0] = (uchar)out[i];
                out_hash[i*4+1] = (uchar)(out[i] >> 8);
                out_hash[i*4+2] = (uchar)(out[i] >> 16);
                out_hash[i*4+3] = (uchar)(out[i] >> 24);
            }
        }
        __syncthreads();
        uchar* t = src; src = dst; dst = t;
        n = parents;
    }
}

// ─── BLAKE3 small message hash (for seed derivation) ────────────────────────
// Hash a small message (≤ 64 bytes) with optional key.
// One thread (only gid==0 does work).

extern "C" __global__ void pearl_blake3_small_hash(
    const uchar* msg,       // message data
    const uint msg_len,     // message length (≤ 64)
    const uchar* key,       // 32 bytes (key for keyed hash, or IV for unkeyed)
    const uint use_keyed,   // 1 = keyed hash, 0 = unkeyed
    uchar* out_hash         // 32 bytes output
)
{
    if (blockIdx.x * blockDim.x + threadIdx.x != 0) return;

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

__device__ uint pcg32(ulong state) {
    uint xorshifted = (uint)((state >> 18u) ^ state);
    xorshifted >>= 27u;
    uint rot = (uint)(state >> 59u);
    return (xorshifted >> rot) | (xorshifted << ((-rot) & 31u));
}

// Generate signed char in [-64, 64] from (nonce, index)
__device__ signed char gen_int7(ulong nonce, uint index) {
    ulong state = (nonce ^ ((ulong)index << 32)) * 6364136223846793005ULL + 1442695040888963407ULL;
    state = state * 6364136223846793005ULL + (nonce << 16) + index;
    uint val = pcg32(state);
    return (signed char)((int)(val % 129u) - 64);
}

// ─── Matrix generation kernel ───────────────────────────────────────────────
// One thread per element.

extern "C" __global__ void pearl_gen_matrix(
    signed char* matrix,            // output: rows × cols
    const ulong nonce,
    const uint rows,
    const uint cols,
    const uint is_b_transpose       // 0 = A (m×k), 1 = B^T (n×k), 2 = B (k×n)
)
{
    uint gid = blockIdx.x * blockDim.x + threadIdx.x;
    uint total = rows * cols;
    if (gid >= total) return;

    signed char val;
    if (is_b_transpose == 0) {
        val = gen_int7(nonce, gid);
    } else if (is_b_transpose == 1) {
        uint j = gid / cols;
        uint l = gid % cols;
        val = gen_int7(nonce + 1ULL, j * cols + l);
    } else {
        val = gen_int7(nonce + 1ULL, gid);
    }

    matrix[gid] = val;
}

// ─── Noise generation: get_random_hash ──────────────────────────────────────
// BLAKE3 keyed hash: message = 64B zero-padded with (1+index) at word
// prepend_index, seed at bytes 32..64; key = the noise seed.

__device__ void get_random_hash_gpu(
    uint index,
    const uchar* seed,   // 32 bytes (seed label in canonical order)
    const uchar* key,    // 32 bytes (noise seed)
    uint prepend_index,
    uchar out[32]
) {
    uint block[16];
    for (int i = 0; i < 16; i++) block[i] = 0u;

    int prepend_value = (int)(1 + index);
    block[prepend_index] = (uint)prepend_value;

    for (int i = 0; i < 8; i++) {
        block[8 + i] = (uint)seed[i*4]
                     | ((uint)seed[i*4+1] << 8)
                     | ((uint)seed[i*4+2] << 16)
                     | ((uint)seed[i*4+3] << 24);
    }

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

// ─── Noise generation kernels ───────────────────────────────────────────────

#define NOISE_RANK 32u
#define UNIFORM_RANGE 64u
#define ZERO_POINT 32
#define RANGE_MASK_VAL 63u

// Generate E_AR / E_BL permutation pairs (k × 2 indices into rank).
// One thread per k element.
extern "C" __global__ void pearl_gen_permutation(
    uint* perm,                // output: k × 2 uint32 pairs
    const uchar* seed,         // 32 bytes (seed label)
    const uchar* key,          // 32 bytes (noise seed)
    const uint k_dim,
    const uint noise_rank
)
{
    uint gid = blockIdx.x * blockDim.x + threadIdx.x;
    if (gid >= k_dim) return;

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

// Generate uniform random matrix (E_AL or E_BR).
// One thread per element.
extern "C" __global__ void pearl_gen_uniform_noise(
    signed char* noise,        // output: rows × cols
    const uchar* seed,         // 32 bytes (seed label)
    const uchar* key,          // 32 bytes (noise seed)
    const uint num_rows,
    const uint num_cols
)
{
    uint gid = blockIdx.x * blockDim.x + threadIdx.x;
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
    signed char val = (signed char)((int)(byte_val & (uchar)RANGE_MASK_VAL) - ZERO_POINT);
    noise[gid] = val;
}

// Compute noised matrices: A' = A + E_AL·E_AR, B'^T = B^T + E_BR·E_BL.
// One thread per (row, k_column).

extern "C" __global__ void pearl_apply_noise_a(
    signed char* noised_a,      // output: m×k int8 (a_val+noise ∈ [-127,127])
    const signed char* matrix_a,// m×k
    const signed char* e_al,    // m×rank
    const uint* e_ar_perm,      // k×2 pairs
    const uint m_dim,
    const uint k_dim,
    const uint noise_rank,
    const uint output_offset    // batch offset (0 for single-nonce)
)
{
    uint gid = blockIdx.x * blockDim.x + threadIdx.x;
    uint total = m_dim * k_dim;
    if (gid >= total) return;

    uint i = gid / k_dim;
    uint l = gid % k_dim;

    uint first_idx = e_ar_perm[l * 2 + 0];
    uint second_idx = e_ar_perm[l * 2 + 1];

    int e_al_first = (int)e_al[i * noise_rank + first_idx];
    int e_al_second = (int)e_al[i * noise_rank + second_idx];
    int noise_val = e_al_first - e_al_second;

    int a_val = (int)matrix_a[i * k_dim + l];
    noised_a[gid + output_offset] = (signed char)(a_val + noise_val);
}

extern "C" __global__ void pearl_apply_noise_b(
    signed char* noised_b_t,    // output: n×k int8
    const signed char* matrix_b_t,// n×k
    const signed char* e_br,    // n×rank
    const uint* e_bl_perm,      // k×2 pairs
    const uint n_dim,
    const uint k_dim,
    const uint noise_rank,
    const uint output_offset
)
{
    uint gid = blockIdx.x * blockDim.x + threadIdx.x;
    uint total = n_dim * k_dim;
    if (gid >= total) return;

    uint j = gid / k_dim;
    uint l = gid % k_dim;

    uint first_idx = e_bl_perm[l * 2 + 0];
    uint second_idx = e_bl_perm[l * 2 + 1];

    int e_br_first = (int)e_br[j * noise_rank + first_idx];
    int e_br_second = (int)e_br[j * noise_rank + second_idx];
    int noise_val = e_br_first - e_br_second;

    int b_val = (int)matrix_b_t[j * k_dim + l];
    noised_b_t[gid + output_offset] = (signed char)(b_val + noise_val);
}

// ─── BLAKE3 keyed hash of 64-byte message (for jackpot) ─────────────────────

__device__ void blake3_keyed_hash_64_gpu(
    const uchar* key,    // 32 bytes
    const uchar* msg,    // 64 bytes
    uchar out[32]
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
        const uint* s = MSG_SCHEDULE[r];
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

// ─── On-device noise-seed derivation ─────────────────────────────────────────
// Replaces the old host roundtrip path (dtoh roots → CPU blake3 → htod):
//   salted: hash_eff = blake3_keyed(SALT, root || dim_u32le || 28×00)
//   legacy: hash_eff = root
//   b_noise_seed = blake3(job_key || hash_b_eff)
//   a_noise_seed = blake3(b_noise_seed || hash_a_eff)
// One thread, ~4 compression calls — runs between merkle and noise-gen with
// zero host synchronization.
__device__ void blake3_hash64(const uchar* key, uint keyed, const uchar* msg64, uchar* out)
{
    uint cv[8];
    if (keyed) {
        for (int i = 0; i < 8; i++) {
            cv[i] = (uint)key[i * 4]
                  | ((uint)key[i * 4 + 1] << 8)
                  | ((uint)key[i * 4 + 2] << 16)
                  | ((uint)key[i * 4 + 3] << 24);
        }
    } else {
        for (int i = 0; i < 8; i++) cv[i] = BLAKE3_IV[i];
    }
    uint block[16];
    for (int i = 0; i < 16; i++) block[i] = 0u;
    for (int i = 0; i < 64; i++) {
        block[i / 4] |= ((uint)msg64[i]) << ((i % 4) * 8);
    }
    uint flags = CHUNK_START | CHUNK_END | ROOT;
    if (keyed) flags |= KEYED_HASH;
    uint o[8];
    blake3_compress(cv, block, 0, 64, flags, o);
    for (int i = 0; i < 8; i++) {
        out[i * 4 + 0] = (uchar)(o[i]);
        out[i * 4 + 1] = (uchar)(o[i] >> 8);
        out[i * 4 + 2] = (uchar)(o[i] >> 16);
        out[i * 4 + 3] = (uchar)(o[i] >> 24);
    }
}

extern "C" __global__ void pearl_derive_seeds(
    const uchar* root_a,
    const uchar* root_b,
    const uchar* job_key,
    const uchar* salt_a,
    const uchar* salt_b,
    uint dim_a,
    uint dim_b,
    uint salted,
    uchar* a_noise_seed,
    uchar* b_noise_seed
)
{
    if (blockIdx.x != 0 || threadIdx.x != 0) return;

    uchar msg[64];
    uchar hash_a_eff[32];
    uchar hash_b_eff[32];

    if (salted) {
        for (int i = 0; i < 64; i++) msg[i] = 0;
        for (int i = 0; i < 32; i++) msg[i] = root_a[i];
        msg[32] = (uchar)(dim_a);
        msg[33] = (uchar)(dim_a >> 8);
        msg[34] = (uchar)(dim_a >> 16);
        msg[35] = (uchar)(dim_a >> 24);
        blake3_hash64(salt_a, 1u, msg, hash_a_eff);

        for (int i = 0; i < 64; i++) msg[i] = 0;
        for (int i = 0; i < 32; i++) msg[i] = root_b[i];
        msg[32] = (uchar)(dim_b);
        msg[33] = (uchar)(dim_b >> 8);
        msg[34] = (uchar)(dim_b >> 16);
        msg[35] = (uchar)(dim_b >> 24);
        blake3_hash64(salt_b, 1u, msg, hash_b_eff);
    } else {
        for (int i = 0; i < 32; i++) {
            hash_a_eff[i] = root_a[i];
            hash_b_eff[i] = root_b[i];
        }
    }

    // b_noise_seed = blake3(job_key || hash_b_eff)
    for (int i = 0; i < 32; i++) {
        msg[i] = job_key[i];
        msg[32 + i] = hash_b_eff[i];
    }
    blake3_hash64(job_key, 0u, msg, b_noise_seed);

    // a_noise_seed = blake3(b_noise_seed || hash_a_eff)
    for (int i = 0; i < 32; i++) {
        msg[i] = b_noise_seed[i];
        msg[32 + i] = hash_a_eff[i];
    }
    blake3_hash64(job_key, 0u, msg, a_noise_seed);
}

// ─── MatMul + Jackpot + Target check (v3 — no shared matrix memory) ─────────

#define TILE_H 4
#define TILE_W 8
#define JACKPOT_SIZE 16
#define LROT 13u
#define MAX_K 1024u

// v3: One block per tile, 32 threads per block (TILE_H×TILE_W).
// Reads noised matrices straight from global memory — L1 cache handles the
// reuse (8 threads share an a_row, 4 share a b_col).
extern "C" __global__ void pearl_pouw_mine_native_v3(
    const signed char* noised_a,
    const signed char* noised_b,
    const uchar* a_noise_seed,
    const uchar* target,
    const uint* row_offsets,
    const uint* col_offsets,
    const uint* rows_base,
    const uint* cols_base,
    uint* output_tile,
    uchar* output_jackpot,
    volatile uint* found,
    const uint* params  // [num_row_offsets, num_col_offsets, k_dim, rank]
)
{
    const uint num_row_offsets = params[0];
    const uint num_col_offsets = params[1];
    const uint k_dim = params[2];
    const uint rank = params[3];

    __shared__ uint jackpot[JACKPOT_SIZE];          // 16 elements = 64 bytes

    uint lid = threadIdx.x;
    uint tile_id = blockIdx.x;

    // Warp-uniform early out — lanes must stay converged for the butterfly
    // XOR shuffles below (a divergent volatile read would leave the mask short).
    if (__any_sync(0xffffffffu, *found != 0u)) return;

    uint row_off_idx = tile_id / num_col_offsets;
    uint col_off_idx = tile_id % num_col_offsets;

    if (row_off_idx >= num_row_offsets || col_off_idx >= num_col_offsets) return;

    uint row_off = row_offsets[row_off_idx];
    uint col_off = col_offsets[col_off_idx];

    uint u = lid / TILE_W;
    uint v = lid % TILE_W;
    uint a_row = row_off + rows_base[u];
    uint b_col = col_off + cols_base[v];

    if (lid == 0) {
        for (int i = 0; i < JACKPOT_SIZE; i++) jackpot[i] = 0u;
    }

    // __dp4a path: noised values fit int8 (a∈[-64,64] + noise∈[-63,63] =
    // [-127,127]) — one IDP does 4 MACs. Requires 16B-aligned rows, i.e.
    // k_dim and rank multiples of 16 (a_base/l stay aligned).
    const bool dp4a_ok = ((k_dim | rank) & 15u) == 0u;

    // NOTE: shared-mem staging tried and REVERTED — measured -26% (1578 vs
    // 2147 GH/s). The warp already dedupes the "redundant" loads: all 8
    // lanes of a u-group read the SAME int4 (broadcast = 1 transaction) and
    // the 8 b-col int4s coalesce well. Staging added 2 syncthreads/window
    // and 8-way smem bank conflicts (128B row stride = same bank). Keep
    // direct-global: hardware broadcast is the optimal path here.
    int my_acc = 0;
    for (uint ll = rank; ll <= k_dim; ll += rank) {
        int acc = 0;
        uint a_base = a_row * k_dim + (ll - rank);
        uint b_base = b_col * k_dim + (ll - rank);
#if __CUDA_ARCH__ >= 610
        if (dp4a_ok) {
            for (uint l = 0; l < rank; l += 16) {
                int4 av = *(const int4*)(noised_a + a_base + l);
                int4 bv = *(const int4*)(noised_b + b_base + l);
                acc = __dp4a(av.x, bv.x, acc);
                acc = __dp4a(av.y, bv.y, acc);
                acc = __dp4a(av.z, bv.z, acc);
                acc = __dp4a(av.w, bv.w, acc);
            }
        } else
#endif
        {
            for (uint l = 0; l < rank; l++) {
                acc += (int)noised_a[a_base + l] * (int)noised_b[b_base + l];
            }
        }
        my_acc += acc;

        // Warp butterfly XOR — every lane ends with XOR of all 32 accumulators.
        // Order-free (XOR associative+commutative) so jackpot output is
        // bit-identical to the old lane-0 serial fold, minus the shared-mem
        // staging and both __syncthreads per chunk. Block is exactly one warp.
        uint xored = (uint)my_acc;
        xored ^= __shfl_xor_sync(0xffffffffu, xored, 16);
        xored ^= __shfl_xor_sync(0xffffffffu, xored, 8);
        xored ^= __shfl_xor_sync(0xffffffffu, xored, 4);
        xored ^= __shfl_xor_sync(0xffffffffu, xored, 2);
        xored ^= __shfl_xor_sync(0xffffffffu, xored, 1);
        if (lid == 0) {
            uint tid = (uint)((ll / rank - 1) % JACKPOT_SIZE);
            jackpot[tid] = (jackpot[tid] << LROT) | (jackpot[tid] >> (32u - LROT));
            jackpot[tid] ^= xored;
        }
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

        // hash is little-endian, target is big-endian. Reverse hash for comparison.
        bool meets = true;
        for (int i = 0; i < 32; i++) {
            uchar h = hash[31 - i];
            uchar t = target[i];
            if (h < t) { meets = true; break; }
            if (h > t) { meets = false; break; }
        }

        if (meets) {
            uint old = atomicExch((uint*)found, 1u);
            if (old == 0u) {
                *output_tile = tile_id;
                for (int i = 0; i < 32; i++) output_jackpot[i] = hash[i];
            }
        }
    }
}

// ─── Dual (A+B fused) kernels ────────────────────────────────────────────────
// Each fused launch routes threads/blocks to the A or B pipeline by index so
// both halves run in the same grid — fills every SM instead of serializing two
// half-empty kernels. Bit-identical to the separate kernels above.

__device__ void pearl_do_chunk(const uchar* data, uint gid, const uchar* key,
                               uchar* out_hash, uint single_root) {
    uint cv[8];
    for (int i = 0; i < 8; i++) {
        cv[i] = (uint)key[i*4]
              | ((uint)key[i*4+1] << 8)
              | ((uint)key[i*4+2] << 16)
              | ((uint)key[i*4+3] << 24);
    }
    const uchar* chunk_bytes = data + (ulong)gid * 1024ULL;
    for (int block = 0; block < 16; block++) {
        uint flags = 0u;
        if (block == 0) flags |= CHUNK_START;
        if (block == 15) flags |= CHUNK_END;
        if (block == 15 && single_root) flags |= ROOT;
        uint block_words[16];
        const uint* block_ptr = (const uint*)(chunk_bytes + block * 64);
        for (int i = 0; i < 16; i++) block_words[i] = block_ptr[i];
        uint out[8];
        blake3_compress(cv, block_words, (ulong)gid, 64, flags | KEYED_HASH, out);
        for (int i = 0; i < 8; i++) cv[i] = out[i];
    }
    for (int i = 0; i < 8; i++) {
        out_hash[i*4+0] = (uchar)cv[i];
        out_hash[i*4+1] = (uchar)(cv[i] >> 8);
        out_hash[i*4+2] = (uchar)(cv[i] >> 16);
        out_hash[i*4+3] = (uchar)(cv[i] >> 24);
    }
}

// gen A (mode 0) + B^T (mode 1 = gen_int7(nonce+1, gid)) in one launch.
extern "C" __global__ void pearl_gen_matrix_dual(
    signed char* matrix_a,
    signed char* matrix_bt,
    const ulong nonce,
    const uint m, const uint n, const uint k
)
{
    uint gid = blockIdx.x * blockDim.x + threadIdx.x;
    uint mk = m * k;
    if (gid < mk) {
        matrix_a[gid] = gen_int7(nonce, gid);
        return;
    }
    uint g2 = gid - mk;
    if (g2 < n * k) matrix_bt[g2] = gen_int7(nonce + 1ULL, g2);
}

// chunk-hash A + B in one launch (each side keeps its own dst/single flag).
extern "C" __global__ void pearl_blake3_chunk_hash_dual(
    const signed char* data_a,
    const signed char* data_b,
    const uchar* key,
    uchar* out_a,
    uchar* out_b,
    const uint chunks_a,
    const uint chunks_b,
    const uint single_a,
    const uint single_b
)
{
    uint gid = blockIdx.x * blockDim.x + threadIdx.x;
    if (gid < chunks_a) {
        pearl_do_chunk((const uchar*)data_a, gid, key,
                       out_a + (ulong)gid * 32, single_a);
        return;
    }
    uint g2 = gid - chunks_a;
    if (g2 < chunks_b) {
        pearl_do_chunk((const uchar*)data_b, g2, key,
                       out_b + (ulong)g2 * 32, single_b);
    }
}

__device__ void pearl_do_merkle_tree(uchar* leaf_hashes, const uchar* key,
                                     uchar* scratch, uchar* root_out,
                                     const uint num_leaves) {
    const uint tid = threadIdx.x;
    if (num_leaves == 1u) {
        if (tid < 8u) ((uint*)root_out)[tid] = ((const uint*)leaf_hashes)[tid];
        return;
    }
    uint cv_key[8];
    for (int i = 0; i < 8; i++) {
        cv_key[i] = (uint)key[i*4]
                  | ((uint)key[i*4+1] << 8)
                  | ((uint)key[i*4+2] << 16)
                  | ((uint)key[i*4+3] << 24);
    }
    uchar* src = leaf_hashes;
    uchar* dst = scratch;
    uint n = num_leaves;
    while (n > 1u) {
        const uint parents = (n + 1u) >> 1;
        const bool root_level = (n == 2u);
        uchar* out_buf = root_level ? root_out : dst;
        for (uint gid = tid; gid < parents; gid += blockDim.x) {
            const uchar* l = src + (ulong)gid * 64;
            uint left[8];
            for (int i = 0; i < 8; i++) {
                left[i] = (uint)l[i*4]
                        | ((uint)l[i*4+1] << 8)
                        | ((uint)l[i*4+2] << 16)
                        | ((uint)l[i*4+3] << 24);
            }
            uchar* out_hash = out_buf + (ulong)gid * 32;
            if (gid * 2u + 1u >= n) {
                for (int i = 0; i < 8; i++) {
                    out_hash[i*4+0] = (uchar)left[i];
                    out_hash[i*4+1] = (uchar)(left[i] >> 8);
                    out_hash[i*4+2] = (uchar)(left[i] >> 16);
                    out_hash[i*4+3] = (uchar)(left[i] >> 24);
                }
                continue;
            }
            const uchar* r = l + 32;
            uint right[8];
            for (int i = 0; i < 8; i++) {
                right[i] = (uint)r[i*4]
                         | ((uint)r[i*4+1] << 8)
                         | ((uint)r[i*4+2] << 16)
                         | ((uint)r[i*4+3] << 24);
            }
            uint block[16];
            for (int i = 0; i < 8; i++) block[i] = left[i];
            for (int i = 0; i < 8; i++) block[8 + i] = right[i];
            uint flags = PARENT | KEYED_HASH;
            if (root_level) flags |= ROOT;
            uint cv[8];
            for (int i = 0; i < 8; i++) cv[i] = cv_key[i];
            uint out[8];
            blake3_compress(cv, block, 0, 64, flags, out);
            for (int i = 0; i < 8; i++) {
                out_hash[i*4+0] = (uchar)out[i];
                out_hash[i*4+1] = (uchar)(out[i] >> 8);
                out_hash[i*4+2] = (uchar)(out[i] >> 16);
                out_hash[i*4+3] = (uchar)(out[i] >> 24);
            }
        }
        __syncthreads();
        uchar* t = src; src = dst; dst = t;
        n = parents;
    }
}

// Both merkle trees in one launch — block 0 folds A, block 1 folds B.
// Each tree needs its own scratch (blocks run concurrently).
extern "C" __global__ void pearl_merkle_tree_dual(
    uchar* leaf_a,
    uchar* leaf_b,
    uchar* scratch_a,
    uchar* scratch_b,
    const uchar* key,
    uchar* root_a,
    uchar* root_b,
    const uint n_a,
    const uint n_b
)
{
    if (blockIdx.x == 0) {
        pearl_do_merkle_tree(leaf_a, key, scratch_a, root_a, n_a);
    } else {
        pearl_do_merkle_tree(leaf_b, key, scratch_b, root_b, n_b);
    }
}

__device__ void pearl_do_uniform(signed char* noise, const uchar* seed,
                                 const uchar* key, uint gid, uint num_cols) {
    uint row_idx = gid / num_cols;
    uint col_idx = gid % num_cols;
    uint start_idx = row_idx * num_cols + col_idx;
    uint block_idx = start_idx / 32;
    uint byte_idx = start_idx % 32;
    uchar hash[32];
    get_random_hash_gpu(block_idx, seed, key, 0, hash);
    uchar byte_val = hash[byte_idx];
    noise[gid] = (signed char)((int)(byte_val & (uchar)RANGE_MASK_VAL) - ZERO_POINT);
}

// E_AL + E_BR uniform noise in one launch.
extern "C" __global__ void pearl_gen_uniform_dual(
    signed char* noise_a,
    signed char* noise_b,
    const uchar* seed_a,
    const uchar* key_a,
    const uint rows_a,
    const uchar* seed_b,
    const uchar* key_b,
    const uint rows_b,
    const uint cols
)
{
    uint gid = blockIdx.x * blockDim.x + threadIdx.x;
    uint ta = rows_a * cols;
    if (gid < ta) {
        pearl_do_uniform(noise_a, seed_a, key_a, gid, cols);
        return;
    }
    uint g2 = gid - ta;
    if (g2 < rows_b * cols) {
        pearl_do_uniform(noise_b, seed_b, key_b, g2, cols);
    }
}

__device__ void pearl_do_perm(uint* perm, const uchar* seed, const uchar* key,
                              uint gid, uint noise_rank) {
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
    uint mul_hi_val = (uint)(((ulong)(noise_rank - 1) * (ulong)random_uint32) >> 32);
    uint second_idx = first_idx ^ (1u + mul_hi_val);
    perm[gid * 2 + 0] = first_idx;
    perm[gid * 2 + 1] = second_idx;
}

// E_AR + E_BL permutations in one launch.
extern "C" __global__ void pearl_gen_permutation_dual(
    uint* perm_a,
    const uchar* seed_a,
    const uchar* key_a,
    uint* perm_b,
    const uchar* seed_b,
    const uchar* key_b,
    const uint k_dim,
    const uint noise_rank
)
{
    uint gid = blockIdx.x * blockDim.x + threadIdx.x;
    if (gid < k_dim) {
        pearl_do_perm(perm_a, seed_a, key_a, gid, noise_rank);
        return;
    }
    uint g2 = gid - k_dim;
    if (g2 < k_dim) {
        pearl_do_perm(perm_b, seed_b, key_b, g2, noise_rank);
    }
}

__device__ void pearl_do_apply(signed char* noised, const signed char* matrix,
                               const signed char* e_noise, const uint* e_perm,
                               uint gid, uint k_dim, uint noise_rank) {
    uint i = gid / k_dim;
    uint l = gid % k_dim;
    uint first_idx = e_perm[l * 2 + 0];
    uint second_idx = e_perm[l * 2 + 1];
    int n_first = (int)e_noise[i * noise_rank + first_idx];
    int n_second = (int)e_noise[i * noise_rank + second_idx];
    int v = (int)matrix[gid];
    noised[gid] = (signed char)(v + n_first - n_second);
}

// apply_noise A + B in one launch.
extern "C" __global__ void pearl_apply_noise_dual(
    signed char* noised_a,
    const signed char* matrix_a,
    const signed char* e_al,
    const uint* e_ar_perm,
    const uint m_dim,
    signed char* noised_b,
    const signed char* matrix_b,
    const signed char* e_br,
    const uint* e_bl_perm,
    const uint n_dim,
    const uint k_dim,
    const uint noise_rank
)
{
    uint gid = blockIdx.x * blockDim.x + threadIdx.x;
    uint mk = m_dim * k_dim;
    if (gid < mk) {
        pearl_do_apply(noised_a, matrix_a, e_al, e_ar_perm, gid, k_dim, noise_rank);
        return;
    }
    uint g2 = gid - mk;
    if (g2 < n_dim * k_dim) {
        pearl_do_apply(noised_b, matrix_b, e_br, e_bl_perm, g2, k_dim, noise_rank);
    }
}
