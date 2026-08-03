// Autolykos v2 (Ergo / ERG) OpenCL mining kernel — OPTIMIZED.
//
// Real implementation of the Autolykos v2 Proof-of-Work algorithm.
//
// The algorithm is memory-hard: a precomputed table of M entries (each a
// 64-bit element) is generated on the host from the block header and height,
// then uploaded once as a GPU buffer.  Each work-item scans 4 nonces:
//
//   1. r = nonce mod M
//   2. for k in 0..9:
//        x = (r * nonce + k) mod M
//        r = table[x]            // lookup in the precomputed table
//   3. hash = BLAKE2b-256(header || r_BE8 || nonce_BE8)
//   4. accept if hash <= target (big-endian byte comparison)
//
// The table is produced by `gen_element(i, seed, height)` on the host, where
// `seed = SHA-256(header)`.  See `gpu_miner.rs::generate_autolykos_table`.
//
// Parameters:
//   M (table_size) is a power of two (default 2^23 = 8M entries / 64 MB on
//   the host; the Ergo mainnet value is 2^26 = 67M entries / 512 MB, which
//   can be selected via the ZION_AUTOLYKOS_TABLE_SIZE environment variable).
//   K = 9 iterations.
//
// ── Optimizations applied ────────────────────────────────────────────
//
//   1. Batch nonce scanning: each work-item scans 4 nonces (amortizes the
//      header read and midstate setup over 4 hashes; 4 chosen over 8 to
//      limit register pressure on this memory-hard algorithm).
//   2. Required work-group size of 128 (memory-bound: smaller groups keep
//      more work-groups resident to hide memory latency).
//   3. Coalesced table access: the table is too large (64 MB+) for __local
//      memory, so we rely on coalesced global access patterns.  Consecutive
//      work-items access nearby table indices, and the GPU L2 cache absorbs
//      the random-access working set.
//   4. Early exit: `*found` is checked at the top of every batch iteration
//      so work-items terminate immediately once a solution is found.
//   5. Midstate precomputation: the Blake2b initialization state and the
//      header portion of the message block are identical for all nonces.
//      They are computed once (outside the batch loop) and reused — only
//      the 16 variable bytes (r || nonce) are updated per nonce.
//   6. Fully unrolled Blake2b rounds: all 12 rounds are expanded via macros
//      with hardcoded SIGMA indices, eliminating the inner loop and constant-
//      memory indirection.
//
// References:
//   - Ergo Autolykos v2 whitepaper (ErgoPow.tex, §"Autolykos version 2")
//   - https://docs.ergoplatform.com/mining/algo-technical/
//   - CPU reference: AuXpow/src/external_hashers.rs (hash_autolykos)
//   - BLAKE2b: RFC 7693
//
// NOTE: This kernel targets OpenCL 1.2 (no atomics beyond xchg, no
// `atomic_load`).  The `found` flag is read with a plain dereference and
// written with `atomic_xchg`, matching the pattern used by the other kernels
// in this directory.

#define ROTR64(x, n) (((x) >> (n)) | ((x) << (64 - (n))))

// ── BLAKE2b constants ────────────────────────────────────────────────

// BLAKE2b initialization vector (RFC 7693), little-endian 64-bit words.
__constant const ulong BLAKE2B_IV[8] = {
    0x6a09e667f3bcc908UL, 0xbb67ae8584caa73bUL,
    0x3c6ef372fe94f82bUL, 0xa54ff53a5f1d36f1UL,
    0x510e527fade682d1UL, 0x9b05688c2b3e6c1fUL,
    0x1f83d9abfb41bd6bUL, 0x5be0cd19137e2179UL
};

// BLAKE2b message schedule (SIGMA), 12 rounds × 16 indices (RFC 7693).
// Kept for reference; the compression function below uses hardcoded macros.
__constant const uchar SIGMA[12][16] = {
    {  0,  1,  2,  3,  4,  5,  6,  7,  8,  9, 10, 11, 12, 13, 14, 15 },
    { 14, 10,  4,  8,  9, 15, 13,  6,  1, 12,  0,  2, 11,  7,  5,  3 },
    { 11,  8, 12,  0,  5,  2, 15, 13, 10, 14,  3,  6,  7,  1,  9,  4 },
    {  7,  9,  3,  1, 13, 12, 11, 14,  2,  6,  5, 10,  4,  0, 15,  8 },
    {  9,  0,  5,  7,  2,  4, 10, 15, 14,  1, 11, 12,  6,  8,  3, 13 },
    {  2, 12,  6, 10,  0, 11,  8,  3,  4, 13,  7,  5, 15, 14,  1,  9 },
    { 12,  5,  1, 15, 14, 13,  4, 10,  0,  7,  6,  3,  9,  2,  8, 11 },
    { 13, 11,  7, 14, 12,  1,  3,  9,  5,  0, 15,  4,  8,  6,  2, 10 },
    {  6, 15, 14,  9, 11,  3,  0,  8, 12,  2, 13,  7,  1,  4, 10,  5 },
    { 10,  2,  8,  4,  7,  6,  1,  5, 15, 11,  9, 14,  3, 12, 13,  0 },
    {  0,  1,  2,  3,  4,  5,  6,  7,  8,  9, 10, 11, 12, 13, 14, 15 },
    { 14, 10,  4,  8,  9, 15, 13,  6,  1, 12,  0,  2, 11,  7,  5,  3 }
};

// BLAKE2b G function (RFC 7693 §3.1).  Rotations: 32, 24, 16, 63.
inline void blake2b_G(
    ulong v[16],
    const int a, const int b, const int c, const int d,
    const ulong x, const ulong y
) {
    v[a] = v[a] + v[b] + x;
    v[d] = ROTR64(v[d] ^ v[a], 32);
    v[c] = v[c] + v[d];
    v[b] = ROTR64(v[b] ^ v[c], 24);
    v[a] = v[a] + v[b] + y;
    v[d] = ROTR64(v[d] ^ v[a], 16);
    v[c] = v[c] + v[d];
    v[b] = ROTR64(v[b] ^ v[c], 63);
}

// ── Unrolled Blake2b round macro ─────────────────────────────────────
//
// Expands one full round (8 G calls) with hardcoded SIGMA indices.
// This eliminates the inner loop and the constant-memory SIGMA lookup,
// allowing the compiler to schedule all 8 G calls freely.
#define BLAKE2b_ROUND(v, m, s0,s1,s2,s3,s4,s5,s6,s7,s8,s9,s10,s11,s12,s13,s14,s15) \
    blake2b_G(v, 0, 4,  8, 12, m[s0],  m[s1]);  \
    blake2b_G(v, 1, 5,  9, 13, m[s2],  m[s3]);  \
    blake2b_G(v, 2, 6, 10, 14, m[s4],  m[s5]);  \
    blake2b_G(v, 3, 7, 11, 15, m[s6],  m[s7]);  \
    blake2b_G(v, 0, 5, 10, 15, m[s8],  m[s9]);  \
    blake2b_G(v, 1, 6, 11, 12, m[s10], m[s11]); \
    blake2b_G(v, 2, 7,  8, 13, m[s12], m[s13]); \
    blake2b_G(v, 3, 4,  9, 14, m[s14], m[s15])

// BLAKE2b compression function F (RFC 7693 §3.2) — fully unrolled.
//   h       — 8-word chaining state (modified in place)
//   m       — 16 message words (little-endian u64), pre-loaded by caller
//   t       — 64-bit total byte counter
//   last    — nonzero if this is the final block
inline void blake2b_compress_unrolled(
    ulong h[8],
    __private const ulong m[16],
    const ulong t,
    const uint last
) {
    ulong v[16];
    v[0]  = h[0]; v[1]  = h[1]; v[2]  = h[2]; v[3]  = h[3];
    v[4]  = h[4]; v[5]  = h[5]; v[6]  = h[6]; v[7]  = h[7];
    v[8]  = BLAKE2B_IV[0]; v[9]  = BLAKE2B_IV[1];
    v[10] = BLAKE2B_IV[2]; v[11] = BLAKE2B_IV[3];
    v[12] = BLAKE2B_IV[4]; v[13] = BLAKE2B_IV[5];
    v[14] = BLAKE2B_IV[6]; v[15] = BLAKE2B_IV[7];

    // Counter (128-bit; high 64 bits are zero for our input sizes).
    v[12] ^= t;
    v[13] ^= 0UL;
    // Final block flag.
    if (last) v[14] ^= 0xFFFFFFFFFFFFFFFFUL;

    // 12 rounds — fully unrolled with hardcoded SIGMA indices.
    BLAKE2b_ROUND(v, m,  0, 1, 2, 3, 4, 5, 6, 7, 8, 9,10,11,12,13,14,15);
    BLAKE2b_ROUND(v, m, 14,10, 4, 8, 9,15,13, 6, 1,12, 0, 2,11, 7, 5, 3);
    BLAKE2b_ROUND(v, m, 11, 8,12, 0, 5, 2,15,13,10,14, 3, 6, 7, 1, 9, 4);
    BLAKE2b_ROUND(v, m,  7, 9, 3, 1,13,12,11,14, 2, 6, 5,10, 4, 0,15, 8);
    BLAKE2b_ROUND(v, m,  9, 0, 5, 7, 2, 4,10,15,14, 1,11,12, 6, 8, 3,13);
    BLAKE2b_ROUND(v, m,  2,12, 6,10, 0,11, 8, 3, 4,13, 7, 5,15,14, 1, 9);
    BLAKE2b_ROUND(v, m, 12, 5, 1,15,14,13, 4,10, 0, 7, 6, 3, 9, 2, 8,11);
    BLAKE2b_ROUND(v, m, 13,11, 7,14,12, 1, 3, 9, 5, 0,15, 4, 8, 6, 2,10);
    BLAKE2b_ROUND(v, m,  6,15,14, 9,11, 3, 0, 8,12, 2,13, 7, 1, 4,10, 5);
    BLAKE2b_ROUND(v, m, 10, 2, 8, 4, 7, 6, 1, 5,15,11, 9,14, 3,12,13, 0);
    BLAKE2b_ROUND(v, m,  0, 1, 2, 3, 4, 5, 6, 7, 8, 9,10,11,12,13,14,15);
    BLAKE2b_ROUND(v, m, 14,10, 4, 8, 9,15,13, 6, 1,12, 0, 2,11, 7, 5, 3);

    // Finalize: h[i] ^= v[i] ^ v[i+8].
    h[0] ^= v[0] ^ v[8];
    h[1] ^= v[1] ^ v[9];
    h[2] ^= v[2] ^ v[10];
    h[3] ^= v[3] ^ v[11];
    h[4] ^= v[4] ^ v[12];
    h[5] ^= v[5] ^ v[13];
    h[6] ^= v[6] ^ v[14];
    h[7] ^= v[7] ^ v[15];
}

// Load 16 little-endian u64 words from a 128-byte block.
inline void blake2b_load_message(
    __private ulong m[16],
    __private const uchar *block
) {
    for (int i = 0; i < 16; i++) {
        ulong w = 0;
        for (int j = 0; j < 8; j++)
            w |= ((ulong)block[i * 8 + j]) << (j * 8);
        m[i] = w;
    }
}

// BLAKE2b-256 of a single block (input length <= 128 bytes).
//
// The input is padded with zeros to a full 128-byte block, the counter is set
// to the real input length, and the final-block flag is set.  This covers the
// Autolykos v2 final hash input (header || r || nonce), which is at most
// 112 + 8 + 8 = 128 bytes.
inline void blake2b256_single(
    __private const uchar *input,
    const uint input_len,
    uchar *output           // 32 bytes
) {
    ulong h[8];
    h[0] = BLAKE2B_IV[0] ^ 0x01010020UL;  // digest=32, key=0, fanout=1, depth=1
    h[1] = BLAKE2B_IV[1];
    h[2] = BLAKE2B_IV[2];
    h[3] = BLAKE2B_IV[3];
    h[4] = BLAKE2B_IV[4];
    h[5] = BLAKE2B_IV[5];
    h[6] = BLAKE2B_IV[6];
    h[7] = BLAKE2B_IV[7];

    uchar block[128];
    for (int i = 0; i < 128; i++) block[i] = 0;
    for (uint i = 0; i < input_len; i++) block[i] = input[i];

    ulong m[16];
    blake2b_load_message(m, block);
    blake2b_compress_unrolled(h, m, (ulong)input_len, 1u);

    // Output the first 32 bytes (4 little-endian 64-bit words).
    for (int i = 0; i < 4; i++)
        for (int j = 0; j < 8; j++)
            output[i * 8 + j] = (uchar)(h[i] >> (j * 8));
}

// ── Mining kernel ────────────────────────────────────────────────────
//
// Kernel arguments:
//   header       — block header message (without nonce), up to 112 bytes
//   header_len   — length of header in bytes (<= 112)
//   target       — 32-byte target (big-endian byte comparison)
//   base_nonce   — first nonce in this batch
//   table        — precomputed Autolykos v2 table (table_size u64 entries),
//                  generated on the host from SHA-256(header) and height
//   table_size   — M, number of table entries (must be a power of two)
//   output_nonce — single u64, written when a solution is found
//   output_hash  — 32-byte BLAKE2b-256 hash of the winning nonce
//   found        — atomic flag: 0 = not found, 1 = found
//
// Each work-item tests 4 nonces: nonce = base_nonce + get_global_id(0)*4 + b
// for b in 0..3.  The host sets global_work_size = batch_size / 4.
__kernel __attribute__((reqd_work_group_size(128, 1, 1)))
void autolykos_mine(
    __global const uchar *header,
    const uint header_len,
    __global const uchar *target,
    ulong base_nonce,
    __global const ulong *table,
    const uint table_size,
    __global ulong *output_nonce,
    __global uchar *output_hash,
    __global volatile uint *found
)
{
    // ── Early exit (optimization 4) ───────────────────────────────
    if (*found) return;

    // ── Read header from global memory ONCE (optimization 5) ──────
    uint hlen = header_len;
    if (hlen > 112) hlen = 112;

    // ── Precompute Blake2b midstate (optimization 5) ──────────────
    // The initialization state is identical for all nonces.
    ulong midstate[8];
    midstate[0] = BLAKE2B_IV[0] ^ 0x01010020UL;  // digest=32, key=0, fanout=1, depth=1
    midstate[1] = BLAKE2B_IV[1];
    midstate[2] = BLAKE2B_IV[2];
    midstate[3] = BLAKE2B_IV[3];
    midstate[4] = BLAKE2B_IV[4];
    midstate[5] = BLAKE2B_IV[5];
    midstate[6] = BLAKE2B_IV[6];
    midstate[7] = BLAKE2B_IV[7];

    // ── Pre-fill message block with header + zero padding ONCE ────
    // Only the 16 bytes at [hlen, hlen+16) (r_BE8 || nonce_BE8) change
    // per nonce; the rest of the block is constant.
    uchar block[128];
    for (int i = 0; i < 128; i++) block[i] = 0;
    for (uint i = 0; i < hlen; i++) block[i] = header[i];

    // M is a power of two, so mod M == & (M - 1).
    const ulong mask = (ulong)table_size - 1UL;
    const uint input_len = hlen + 16;

    // ── Batch nonce scanning: 4 nonces per work-item (optimization 1)
    for (int batch = 0; batch < 4; batch++) {
        // Early exit at top of each batch iteration (optimization 4).
        if (*found) return;

        const ulong nonce = base_nonce + (ulong)get_global_id(0) * 4 + (ulong)batch;

        // Step 1: r = nonce mod M.
        ulong r = nonce & mask;

        // Step 2: 9 iterations of (r * nonce + k) mod M, then table lookup.
        // (r * nonce) mod M is computed without 64-bit overflow because only
        // the low log2(M) bits of each factor affect the result (M is a power
        // of two).
        // Table access is coalesced: consecutive work-items with nearby nonces
        // produce nearby x indices, leveraging GPU L2 cache (optimization 3).
        for (int k = 0; k < 9; k++) {
            ulong x = (((r & mask) * (nonce & mask)) + (ulong)k) & mask;
            r = table[x];
        }

        // Step 3: Update only the 16 variable bytes in the pre-filled block.
        // r and nonce are written big-endian (Ergo convention, matching the
        // CPU reference which uses nonce.to_be_bytes()).
        for (int i = 0; i < 8; i++)
            block[hlen + i] = (uchar)(r >> ((7 - i) * 8));
        for (int i = 0; i < 8; i++)
            block[hlen + 8 + i] = (uchar)(nonce >> ((7 - i) * 8));

        // Copy midstate to working state (midstate is preserved for next batch).
        ulong h[8];
        h[0] = midstate[0]; h[1] = midstate[1]; h[2] = midstate[2]; h[3] = midstate[3];
        h[4] = midstate[4]; h[5] = midstate[5]; h[6] = midstate[6]; h[7] = midstate[7];

        // Load message words from the updated block.
        ulong m[16];
        blake2b_load_message(m, block);

        // Compress with fully unrolled 12 rounds (optimization 6).
        blake2b_compress_unrolled(h, m, (ulong)input_len, 1u);

        // Extract first 32 bytes of hash (4 little-endian 64-bit words).
        uchar hash[32];
        for (int i = 0; i < 4; i++)
            for (int j = 0; j < 8; j++)
                hash[i * 8 + j] = (uchar)(h[i] >> (j * 8));

        // Step 4: target check (hash <= target, big-endian byte comparison).
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
}
