// Autolykos v2 (Ergo / ERG) Metal mining kernel.
//
// Real implementation of the Autolykos v2 Proof-of-Work algorithm.
//
// The algorithm is memory-hard: a precomputed table of M entries (each a
// 64-bit element) is generated on the host from the block header and height,
// then uploaded once as a GPU buffer.  Each work-item scans one nonce:
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
// References:
//   - Ergo Autolykos v2 whitepaper (ErgoPow.tex, "Autolykos version 2")
//   - https://docs.ergoplatform.com/mining/algo-technical/
//   - CPU reference: AuXpow/src/external_hashers.rs (hash_autolykos)
//   - BLAKE2b: RFC 7693
//
// Translated from opencl/autolykos_kernel.cl.

#include <metal_stdlib>
using namespace metal;

#define ROTR64(x, n) (((x) >> (n)) | ((x) << (64 - (n))))

// -- BLAKE2b constants ------------------------------------------------

// BLAKE2b initialization vector (RFC 7693), little-endian 64-bit words.
constant const ulong BLAKE2B_IV[8] = {
    0x6a09e667f3bcc908UL, 0xbb67ae8584caa73bUL,
    0x3c6ef372fe94f82bUL, 0xa54ff53a5f1d36f1UL,
    0x510e527fade682d1UL, 0x9b05688c2b3e6c1fUL,
    0x1f83d9abfb41bd6bUL, 0x5be0cd19137e2179UL
};

// BLAKE2b message schedule (SIGMA), 12 rounds x 16 indices (RFC 7693).
constant const uchar SIGMA[12][16] = {
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

// BLAKE2b G function (RFC 7693 3.1).  Rotations: 32, 24, 16, 63.
inline void blake2b_G(
    thread ulong v[16],
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

// BLAKE2b compression function F (RFC 7693 3.2).
//   h       -- 8-word chaining state (modified in place)
//   block   -- 128-byte (16-word) message block, little-endian u64 words
//   t       -- 64-bit total byte counter (low half of the 128-bit counter;
//              sufficient for inputs < 2^64 bytes)
//   last    -- nonzero if this is the final block
inline void blake2b_compress(
    thread ulong h[8],
    thread const uchar *block,
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

    // Load 16 message words (little-endian).
    ulong m[16];
    for (int i = 0; i < 16; i++) {
        ulong w = 0;
        for (int j = 0; j < 8; j++)
            w |= ((ulong)block[i * 8 + j]) << (j * 8);
        m[i] = w;
    }

    // 12 rounds.
    for (int r = 0; r < 12; r++) {
        constant const uchar *s = SIGMA[r];
        blake2b_G(v, 0, 4,  8, 12, m[s[ 0]], m[s[ 1]]);
        blake2b_G(v, 1, 5,  9, 13, m[s[ 2]], m[s[ 3]]);
        blake2b_G(v, 2, 6, 10, 14, m[s[ 4]], m[s[ 5]]);
        blake2b_G(v, 3, 7, 11, 15, m[s[ 6]], m[s[ 7]]);
        blake2b_G(v, 0, 5, 10, 15, m[s[ 8]], m[s[ 9]]);
        blake2b_G(v, 1, 6, 11, 12, m[s[10]], m[s[11]]);
        blake2b_G(v, 2, 7,  8, 13, m[s[12]], m[s[13]]);
        blake2b_G(v, 3, 4,  9, 14, m[s[14]], m[s[15]]);
    }

    // Finalize: h[i] ^= v[i] ^ v[i+8].
    for (int i = 0; i < 8; i++)
        h[i] ^= v[i] ^ v[i + 8];
}

// BLAKE2b-256 of a single block (input length <= 128 bytes).
//
// The input is padded with zeros to a full 128-byte block, the counter is set
// to the real input length, and the final-block flag is set.  This covers the
// Autolykos v2 final hash input (header || r || nonce), which is at most
// 112 + 8 + 8 = 128 bytes.
inline void blake2b256_single(
    thread const uchar *input,
    const uint input_len,
    thread uchar *output           // 32 bytes
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

    blake2b_compress(h, block, (ulong)input_len, 1u);

    // Output the first 32 bytes (4 little-endian 64-bit words).
    for (int i = 0; i < 4; i++)
        for (int j = 0; j < 8; j++)
            output[i * 8 + j] = (uchar)(h[i] >> (j * 8));
}

// -- Mining kernel ----------------------------------------------------
//
// Kernel arguments:
//   header       -- block header message (without nonce), up to 112 bytes
//   header_len   -- length of header in bytes (<= 112)
//   target       -- 32-byte target (big-endian byte comparison)
//   base_nonce   -- first nonce in this batch
//   table        -- precomputed Autolykos v2 table (table_size u64 entries),
//                  generated on the host from SHA-256(header) and height
//   table_size   -- M, number of table entries (must be a power of two)
//   output_nonce -- single u64, written when a solution is found
//   output_hash  -- 32-byte BLAKE2b-256 hash of the winning nonce
//   found        -- atomic flag: 0 = not found, 1 = found
//
// Each work-item tests exactly one nonce: nonce = base_nonce + gid,
// matching the dispatch model used by the other kernels (the host sets
// global_work_size = batch_size).
kernel void autolykos_mine(
    device const uchar* header [[buffer(0)]],
    constant uint* header_len [[buffer(6)]],
    device const uchar* target [[buffer(1)]],
    constant ulong* base_nonce [[buffer(7)]],
    device const ulong* table [[buffer(2)]],
    constant uint* table_size [[buffer(8)]],
    device ulong* output_nonce [[buffer(3)]],
    device uchar* output_hash [[buffer(4)]],
    device uint* found [[buffer(5)]],
    uint gid [[thread_position_in_grid]]
)
{
    if (atomic_load_explicit((device atomic_uint*)found, memory_order_relaxed)) return;

    uint hlen_arg = *header_len;
    ulong bnonce = *base_nonce;
    uint tbl_size = *table_size;

    const ulong nonce = bnonce + (ulong)gid;

    // M is a power of two, so mod M == & (M - 1).
    const ulong mask = (ulong)tbl_size - 1UL;

    // Step 1: r = nonce mod M.
    ulong r = nonce & mask;

    // Step 2: 9 iterations of (r * nonce + k) mod M, then table lookup.
    // (r * nonce) mod M is computed without 64-bit overflow because only the
    // low log2(M) bits of each factor affect the result (M is a power of two).
    for (int k = 0; k < 9; k++) {
        ulong x = (((r & mask) * (nonce & mask)) + (ulong)k) & mask;
        r = table[x];
    }

    // Step 3: hash = BLAKE2b-256(header || r_BE8 || nonce_BE8).
    // r and nonce are written big-endian (Ergo convention, matching the CPU
    // reference which uses nonce.to_be_bytes()).
    uint hlen = hlen_arg;
    if (hlen > 112) hlen = 112;

    uchar input[128];
    for (uint i = 0; i < hlen; i++) input[i] = header[i];
    for (int i = 0; i < 8; i++)
        input[hlen + i] = (uchar)(r >> ((7 - i) * 8));
    for (int i = 0; i < 8; i++)
        input[hlen + 8 + i] = (uchar)(nonce >> ((7 - i) * 8));
    const uint input_len = hlen + 16;

    uchar hash[32];
    blake2b256_single(input, input_len, hash);

    // Step 4: target check (hash <= target, big-endian byte comparison).
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
        }
    }
}
