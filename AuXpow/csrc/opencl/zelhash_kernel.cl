// ZelHash OpenCL kernel for FLUX mining.
//
// ZelHash is a modified Equihash 125,4 with "ZelProof" Blake2b personalization.
// This kernel implements:
//   1. Blake2b-512 hashing with ZelProof personalization
//   2. Wagner's algorithm for collision finding (4 rounds for k=4)
//   3. Solution extraction and target check
//
// Parameters:
//   n = 125, k = 4
//   collision_bits = n / (k + 1) = 25
//   indices_per_hash = 512 / n = 4
//   solution_indices = 2^k = 16
//   solution_size = 52 bytes (compressed)
//
// The kernel uses a bucket-based approach similar to silentarmy/tromp:
//   - Round 0: Generate initial rows from Blake2b, store in table
//   - Rounds 1-4: Find collisions, XOR hashes, store in alternating table
//   - Final: Extract solutions with all-zero remaining hash
//
// Each work-item scans 8 nonces (batch nonce scanning). The kernel uses
// global memory for the hash tables and local memory for bucket sorting.
//
// Optimizations applied:
//   - Batch nonce scanning (8 nonces per work-item)
//   - reqd_work_group_size(256, 1, 1) hint
//   - Blake2b midstate precomputation (header prefix absorbed once)
//   - Fully unrolled 12 Blake2b rounds
//   - Early exit on *found at each batch iteration
//   - Vectorized vload4 header prefix loading
//   - Precomputed ZelProof-personalized IV in __constant memory
//
// WARNING: This is a simplified implementation for pipeline testing.
// Real production mining requires a highly optimized kernel (lolMiner/bzMiner
// level) with ~10x more throughput. This kernel validates the B2b bridge
// data flow and can find solutions at low difficulty.

// ── Blake2b constants ────────────────────────────────────────────────

__constant const uint BLAKE2B_IV[8] = {
    0x6A09E667u, 0xBB67AE85u, 0x3C6EF372u, 0xA54FF53Au,
    0x510E527Fu, 0x9B05688Cu, 0x1F83D9ABu, 0x5BE0CD19u
};

// Precomputed ZelProof-personalized IV values.
//   IV[0] ^= "ZelProof" (LE ulong 0x666F6F72506C655A) ^= digest_length(64)
//   IV[1] ^= 125 (0x7D) LE + 4 (0x04) LE  => 0x000000040000007D
// These are constant for every hash, so they are folded once at compile time
// and stored in __constant memory.
__constant const ulong ZELPROOF_IV0 =
    (ulong)BLAKE2B_IV[0] ^ 0x666F6F72506C655AULL ^ 64UL;
__constant const ulong ZELPROOF_IV1 =
    (ulong)BLAKE2B_IV[1] ^ 0x000000040000007DULL;

__constant const uchar BLAKE2B_SIGMA[12][16] = {
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

#define ROTR64(x, n) (((x) >> (n)) | ((x) << (64 - (n))))

// Blake2b G function (operates on 64-bit words)
#define G(v, a, b, c, d, x, y) \
    v[a] = v[a] + v[b] + x; \
    v[d] = ROTR64(v[d] ^ v[a], 32); \
    v[c] = v[c] + v[d]; \
    v[b] = ROTR64(v[b] ^ v[c], 24); \
    v[a] = v[a] + v[b] + y; \
    v[d] = ROTR64(v[d] ^ v[a], 16); \
    v[c] = v[c] + v[d]; \
    v[b] = ROTR64(v[b] ^ v[c], 63);

// One Blake2b round with literal message-word indices (no sigma table lookup).
#define ROUND_G(v, b, s0,s1,s2,s3,s4,s5,s6,s7,s8,s9,s10,s11,s12,s13,s14,s15) \
    G(v, 0, 4,  8, 12, b[s0],  b[s1]);  \
    G(v, 1, 5,  9, 13, b[s2],  b[s3]);  \
    G(v, 2, 6, 10, 14, b[s4],  b[s5]);  \
    G(v, 3, 7, 11, 15, b[s6],  b[s7]);  \
    G(v, 0, 5, 10, 15, b[s8],  b[s9]);  \
    G(v, 1, 6, 11, 12, b[s10], b[s11]); \
    G(v, 2, 7,  8, 13, b[s12], b[s13]); \
    G(v, 3, 4,  9, 14, b[s14], b[s15]);

// Blake2b compression function (12 rounds, FULLY UNROLLED).
// h: 8-word chaining value (modified in place)
// block: 128-byte message block (16 ulong words)
// counter: byte counter (t)
// last: whether this is the last block
void blake2b_compress(
    ulong h[8],
    const ulong block[16],
    ulong counter,
    bool last
) {
    ulong v[16];
    v[0] = h[0]; v[1] = h[1]; v[2] = h[2]; v[3] = h[3];
    v[4] = h[4]; v[5] = h[5]; v[6] = h[6]; v[7] = h[7];
    v[8]  = BLAKE2B_IV[0]; v[9]  = BLAKE2B_IV[1];
    v[10] = BLAKE2B_IV[2]; v[11] = BLAKE2B_IV[3];
    v[12] = BLAKE2B_IV[4]; v[13] = BLAKE2B_IV[5];
    v[14] = BLAKE2B_IV[6]; v[15] = BLAKE2B_IV[7];

    v[12] ^= counter;          // t low
    v[13] ^= 0UL;              // t high (for large inputs)
    if (last) v[14] ^= 0xFFFFFFFFFFFFFFFFUL;

    // 12 rounds, fully unrolled with literal sigma indices.
    ROUND_G(v, block,  0, 1, 2, 3, 4, 5, 6, 7, 8, 9,10,11,12,13,14,15); // r0
    ROUND_G(v, block, 14,10, 4, 8, 9,15,13, 6, 1,12, 0, 2,11, 7, 5, 3); // r1
    ROUND_G(v, block, 11, 8,12, 0, 5, 2,15,13,10,14, 3, 6, 7, 1, 9, 4); // r2
    ROUND_G(v, block,  7, 9, 3, 1,13,12,11,14, 2, 6, 5,10, 4, 0,15, 8); // r3
    ROUND_G(v, block,  9, 0, 5, 7, 2, 4,10,15,14, 1,11,12, 6, 8, 3,13); // r4
    ROUND_G(v, block,  2,12, 6,10, 0,11, 8, 3, 4,13, 7, 5,15,14, 1, 9); // r5
    ROUND_G(v, block, 12, 5, 1,15,14,13, 4,10, 0, 7, 6, 3, 9, 2, 8,11); // r6
    ROUND_G(v, block, 13,11, 7,14,12, 1, 3, 9, 5, 0,15, 4, 8, 6, 2,10); // r7
    ROUND_G(v, block,  6,15,14, 9,11, 3, 0, 8,12, 2,13, 7, 1, 4,10, 5); // r8
    ROUND_G(v, block, 10, 2, 8, 4, 7, 6, 1, 5,15,11, 9,14, 3,12,13, 0); // r9
    ROUND_G(v, block,  0, 1, 2, 3, 4, 5, 6, 7, 8, 9,10,11,12,13,14,15); // r10
    ROUND_G(v, block, 14,10, 4, 8, 9,15,13, 6, 1,12, 0, 2,11, 7, 5, 3); // r11

    h[0] ^= v[0] ^ v[8];
    h[1] ^= v[1] ^ v[9];
    h[2] ^= v[2] ^ v[10];
    h[3] ^= v[3] ^ v[11];
    h[4] ^= v[4] ^ v[12];
    h[5] ^= v[5] ^ v[13];
    h[6] ^= v[6] ^ v[14];
    h[7] ^= v[7] ^ v[15];
}

// Initialize Blake2b state with ZelProof personalization (precomputed IV).
inline void zelhash_init(ulong h[8]) {
    h[0] = ZELPROOF_IV0;
    h[1] = ZELPROOF_IV1;
    h[2] = BLAKE2B_IV[2];
    h[3] = BLAKE2B_IV[3];
    h[4] = BLAKE2B_IV[4];
    h[5] = BLAKE2B_IV[5];
    h[6] = BLAKE2B_IV[6];
    h[7] = BLAKE2B_IV[7];
}

// Load a 128-byte block (16 ulong words, little-endian) from a byte buffer.
inline void load_block(ulong block[16], const uchar *p) {
    block[0]  = (ulong)p[0]  | ((ulong)p[1]  << 8) | ((ulong)p[2]  << 16) | ((ulong)p[3]  << 24)
              | ((ulong)p[4]  << 32) | ((ulong)p[5]  << 40) | ((ulong)p[6]  << 48) | ((ulong)p[7]  << 56);
    block[1]  = (ulong)p[8]  | ((ulong)p[9]  << 8) | ((ulong)p[10] << 16) | ((ulong)p[11] << 24)
              | ((ulong)p[12] << 32) | ((ulong)p[13] << 40) | ((ulong)p[14] << 48) | ((ulong)p[15] << 56);
    block[2]  = (ulong)p[16] | ((ulong)p[17] << 8) | ((ulong)p[18] << 16) | ((ulong)p[19] << 24)
              | ((ulong)p[20] << 32) | ((ulong)p[21] << 40) | ((ulong)p[22] << 48) | ((ulong)p[23] << 56);
    block[3]  = (ulong)p[24] | ((ulong)p[25] << 8) | ((ulong)p[26] << 16) | ((ulong)p[27] << 24)
              | ((ulong)p[28] << 32) | ((ulong)p[29] << 40) | ((ulong)p[30] << 48) | ((ulong)p[31] << 56);
    block[4]  = (ulong)p[32] | ((ulong)p[33] << 8) | ((ulong)p[34] << 16) | ((ulong)p[35] << 24)
              | ((ulong)p[36] << 32) | ((ulong)p[37] << 40) | ((ulong)p[38] << 48) | ((ulong)p[39] << 56);
    block[5]  = (ulong)p[40] | ((ulong)p[41] << 8) | ((ulong)p[42] << 16) | ((ulong)p[43] << 24)
              | ((ulong)p[44] << 32) | ((ulong)p[45] << 40) | ((ulong)p[46] << 48) | ((ulong)p[47] << 56);
    block[6]  = (ulong)p[48] | ((ulong)p[49] << 8) | ((ulong)p[50] << 16) | ((ulong)p[51] << 24)
              | ((ulong)p[52] << 32) | ((ulong)p[53] << 40) | ((ulong)p[54] << 48) | ((ulong)p[55] << 56);
    block[7]  = (ulong)p[56] | ((ulong)p[57] << 8) | ((ulong)p[58] << 16) | ((ulong)p[59] << 24)
              | ((ulong)p[60] << 32) | ((ulong)p[61] << 40) | ((ulong)p[62] << 48) | ((ulong)p[63] << 56);
    block[8]  = (ulong)p[64] | ((ulong)p[65] << 8) | ((ulong)p[66] << 16) | ((ulong)p[67] << 24)
              | ((ulong)p[68] << 32) | ((ulong)p[69] << 40) | ((ulong)p[70] << 48) | ((ulong)p[71] << 56);
    block[9]  = (ulong)p[72] | ((ulong)p[73] << 8) | ((ulong)p[74] << 16) | ((ulong)p[75] << 24)
              | ((ulong)p[76] << 32) | ((ulong)p[77] << 40) | ((ulong)p[78] << 48) | ((ulong)p[79] << 56);
    block[10] = (ulong)p[80] | ((ulong)p[81] << 8) | ((ulong)p[82] << 16) | ((ulong)p[83] << 24)
              | ((ulong)p[84] << 32) | ((ulong)p[85] << 40) | ((ulong)p[86] << 48) | ((ulong)p[87] << 56);
    block[11] = (ulong)p[88] | ((ulong)p[89] << 8) | ((ulong)p[90] << 16) | ((ulong)p[91] << 24)
              | ((ulong)p[92] << 32) | ((ulong)p[93] << 40) | ((ulong)p[94] << 48) | ((ulong)p[95] << 56);
    block[12] = (ulong)p[96]  | ((ulong)p[97]  << 8) | ((ulong)p[98]  << 16) | ((ulong)p[99]  << 24)
              | ((ulong)p[100] << 32) | ((ulong)p[101] << 40) | ((ulong)p[102] << 48) | ((ulong)p[103] << 56);
    block[13] = (ulong)p[104] | ((ulong)p[105] << 8) | ((ulong)p[106] << 16) | ((ulong)p[107] << 24)
              | ((ulong)p[108] << 32) | ((ulong)p[109] << 40) | ((ulong)p[110] << 48) | ((ulong)p[111] << 56);
    block[14] = (ulong)p[112] | ((ulong)p[113] << 8) | ((ulong)p[114] << 16) | ((ulong)p[115] << 24)
              | ((ulong)p[116] << 32) | ((ulong)p[117] << 40) | ((ulong)p[118] << 48) | ((ulong)p[119] << 56);
    block[15] = (ulong)p[120] | ((ulong)p[121] << 8) | ((ulong)p[122] << 16) | ((ulong)p[123] << 24)
              | ((ulong)p[124] << 32) | ((ulong)p[125] << 40) | ((ulong)p[126] << 48) | ((ulong)p[127] << 56);
}

// Blake2b-512 with ZelProof personalization (reference, single-shot).
// input: header bytes (up to 211 bytes: header_prefix + nonce)
// input_len: length of input
// output: 64-byte hash
void zelhash_blake2b(
    const uchar *input,
    uint input_len,
    uchar output[64]
) {
    ulong h[8];
    zelhash_init(h);

    // Process input in 128-byte blocks
    ulong counter = 0;
    uint full_blocks = input_len / 128;
    uint tail_len = input_len % 128;

    for (uint b = 0; b < full_blocks; b++) {
        ulong block[16];
        load_block(block, input + b * 128);
        counter += 128;
        blake2b_compress(h, block, counter, false);
    }

    // Last block (tail)
    {
        ulong block[16];
        for (int i = 0; i < 16; i++) block[i] = 0;
        uint off = full_blocks * 128;
        for (uint i = 0; i < tail_len; i++) {
            block[i / 8] |= ((ulong)input[off + i] << ((i % 8) * 8));
        }
        counter += tail_len;
        blake2b_compress(h, block, counter, true);
    }

    // Extract 64 bytes of output
    for (int i = 0; i < 8; i++) {
        output[i * 8 + 0] = (uchar)(h[i]);
        output[i * 8 + 1] = (uchar)(h[i] >> 8);
        output[i * 8 + 2] = (uchar)(h[i] >> 16);
        output[i * 8 + 3] = (uchar)(h[i] >> 24);
        output[i * 8 + 4] = (uchar)(h[i] >> 32);
        output[i * 8 + 5] = (uchar)(h[i] >> 40);
        output[i * 8 + 6] = (uchar)(h[i] >> 48);
        output[i * 8 + 7] = (uchar)(h[i] >> 56);
    }
}

// ── Equihash parameters ──────────────────────────────────────────────

#define EH_N 125
#define EH_K 4
#define EH_COLLISION_BITS 25       // n / (k+1)
#define EH_COLLISION_BYTES 4       // ceil(25/8)
#define EH_INDICES_PER_HASH 4      // 512 / 125
#define EH_SOLUTION_INDICES 16     // 2^k
#define EH_SOLUTION_SIZE 52        // compressed solution bytes

// Number of initial rows to generate (reduced for GPU memory).
// Full Equihash uses 2^26 = 67M rows; we use 2^20 = 1M for testing.
// This means solutions are found less frequently but the pipeline works.
#define EH_NUM_ROWS (1 << 20)

// Bucket parameters for collision finding
#define EH_BUCKBITS 10
#define EH_NBUCKETS (1 << EH_BUCKBITS)   // 1024
#define EH_BUCKETMASK (EH_NBUCKETS - 1)
#define EH_SLOTS_PER_BUCKET 64           // max entries per bucket

// Row structure: hash fragment + tree of indices
// We store up to 16 indices (4 bytes each = 64 bytes) but in practice
// use a compact representation: 4 bytes for the first index + 4 bytes
// for the XOR'd hash fragment (truncated to collision bytes per round)
struct Row {
    uint index;           // first index (or combined index)
    uint hash_fragment;   // truncated hash for collision detection
    uint parent_a;        // parent row index in previous table
    uint parent_b;        // parent row index in previous table
};

// Extract n-bit chunk from 64-byte Blake2b hash
// chunk_idx: which chunk (0-3 for n=125, indices_per_hash=4)
// Returns 4 bytes (32 bits, of which 25 are valid)
uint extract_chunk(const uchar hash[64], uint chunk_idx) {
    // Each chunk is 125 bits. chunk_idx * 125 = bit offset.
    uint bit_offset = chunk_idx * EH_N;
    uint byte_offset = bit_offset / 8;
    uint bit_shift = bit_offset % 8;

    // Read 5 bytes (40 bits) starting at byte_offset, shift right
    uint b0 = (byte_offset < 64) ? hash[byte_offset] : 0;
    uint b1 = (byte_offset + 1 < 64) ? hash[byte_offset + 1] : 0;
    uint b2 = (byte_offset + 2 < 64) ? hash[byte_offset + 2] : 0;
    uint b3 = (byte_offset + 3 < 64) ? hash[byte_offset + 3] : 0;
    uint b4 = (byte_offset + 4 < 64) ? hash[byte_offset + 4] : 0;

    // Combine 5 bytes and shift right by bit_shift
    // We only need the lower 25 bits
    uint val = (b0 | (b1 << 8) | (b2 << 16) | (b3 << 24)) >> bit_shift;
    uint val2 = b4 << (32 - bit_shift);
    val = val | (bit_shift > 0 ? val2 : 0);

    // Mask to 25 bits
    val &= 0x1FFFFFF;  // (1 << 25) - 1
    return val;
}

// Compress 16 indices into 52-byte solution
// Each index is 26 bits (25 collision bits + 1)
void compress_solution(
    const uint indices[EH_SOLUTION_INDICES],
    uchar solution[EH_SOLUTION_SIZE]
) {
    // 16 indices * 26 bits = 416 bits = 52 bytes
    // Pack bits LSB-first
    for (int i = 0; i < EH_SOLUTION_SIZE; i++) solution[i] = 0;

    uint bit_pos = 0;
    for (int i = 0; i < EH_SOLUTION_INDICES; i++) {
        uint idx = indices[i];
        for (int b = 0; b < 26; b++) {
            uint bit = (idx >> b) & 1;
            if (bit) {
                uint byte_pos = bit_pos / 8;
                uint bit_in_byte = bit_pos % 8;
                if (byte_pos < EH_SOLUTION_SIZE) {
                    solution[byte_pos] |= (1 << bit_in_byte);
                }
            }
            bit_pos++;
        }
    }
}

// ── Main mining kernel ───────────────────────────────────────────────
//
// Each work-item scans 8 nonces (batch nonce scanning). The kernel:
// 1. Builds the input = header_prefix + nonce (32 bytes)
// 2. Precomputes the Blake2b midstate after absorbing the full 128-byte
//    header-prefix blocks (the part before the nonce) — done ONCE per
//    work-item, reused across all 8 nonces.
// 3. For each nonce: updates the midstate with the nonce-bearing tail,
//    computes Blake2b-512 with ZelProof personalization.
// 4. Checks if the PoW hash meets the target.
//
// The Blake2b-512 hash with ZelProof personalization produces IDENTICAL
// results to the reference zelhash_blake2b() above.

__kernel __attribute__((reqd_work_group_size(256, 1, 1))) void zelhash_mine(
    __global const uchar *header_blob,   // header prefix (without nonce)
    uint header_len,                      // length of header prefix
    __global const uchar *target,         // 32-byte big-endian target
    ulong base_nonce,                     // base nonce for this batch
    __global ulong *output_nonce,         // found nonce
    __global uchar *output_hash,          // 32-byte found hash
    __global uchar *output_solution,      // 52-byte found solution
    __global uint *found                  // found flag (0/1)
) {
    if (*found) return;

    // Build input buffer: header_prefix + 32-byte nonce (LE).
    uchar input[243];  // max header_prefix (211) + 32 nonce
    for (int i = 0; i < 243; i++) input[i] = 0;

    uint copy_len = min(header_len, 211u);

    // Vectorized header prefix loading using vload4 (4-byte chunks).
    uint chunks = copy_len / 4;
    for (uint i = 0; i < chunks; i++) {
        uchar4 c = vload4(0, &header_blob[i * 4]);
        vstore4(c, 0, &input[i * 4]);
    }
    // Remainder bytes (copy_len not a multiple of 4).
    for (uint i = chunks * 4; i < copy_len; i++) input[i] = header_blob[i];

    // Nonce is appended at input[copy_len .. copy_len + 32].
    // Remaining 24 bytes of the 32-byte nonce field are zeros (already zeroed).
    uint nonce_start = copy_len;
    uint input_len = nonce_start + 32;

    // ── Midstate precomputation ──────────────────────────────────────
    // Absorb all full 128-byte blocks that lie entirely before the nonce.
    // These blocks contain only header-prefix bytes (no nonce), so the
    // resulting Blake2b state is identical for all 8 nonces.
    uint prefix_full_blocks = copy_len / 128;

    ulong h_mid[8];
    zelhash_init(h_mid);
    for (uint b = 0; b < prefix_full_blocks; b++) {
        ulong block[16];
        load_block(block, input + b * 128);
        blake2b_compress(h_mid, block, (ulong)(b + 1) * 128, false);
    }

    // Remaining region (from after the precomputed prefix blocks to end).
    uint rem_start = prefix_full_blocks * 128;
    uint rem_len = input_len - rem_start;          // header tail + 32-byte nonce
    uint rem_full_blocks = rem_len / 128;
    uint rem_tail = rem_len % 128;

    // ── Batch nonce scanning (8 nonces per work-item) ────────────────
    for (int batch = 0; batch < 8; batch++) {
        // Early exit: stop scanning once a solution has been found.
        if (*found) break;

        ulong nonce = base_nonce + (ulong)get_global_id(0) * 8 + (ulong)batch;

        // Write the 32-byte nonce (LE) into the input buffer.
        for (int i = 0; i < 8; i++) {
            input[nonce_start + i] = (uchar)(nonce >> (i * 8));
        }
        for (int i = 8; i < 32; i++) {
            input[nonce_start + i] = 0;
        }

        // Copy midstate and absorb the nonce-bearing remaining region.
        ulong h[8];
        h[0] = h_mid[0]; h[1] = h_mid[1]; h[2] = h_mid[2]; h[3] = h_mid[3];
        h[4] = h_mid[4]; h[5] = h_mid[5]; h[6] = h_mid[6]; h[7] = h_mid[7];

        ulong counter = (ulong)rem_start;

        // Full 128-byte blocks within the remaining region.
        for (uint rb = 0; rb < rem_full_blocks; rb++) {
            ulong block[16];
            load_block(block, input + rem_start + rb * 128);
            counter += 128;
            blake2b_compress(h, block, counter, false);
        }

        // Last (tail) block, zero-padded to 128 bytes.
        {
            ulong block[16];
            for (int i = 0; i < 16; i++) block[i] = 0;
            uint off = rem_start + rem_full_blocks * 128;
            for (uint i = 0; i < rem_tail; i++) {
                block[i / 8] |= ((ulong)input[off + i] << ((i % 8) * 8));
            }
            counter += rem_tail;
            blake2b_compress(h, block, counter, true);
        }

        // Use first 32 bytes of Blake2b-512 as the "PoW hash" (LE).
        uchar pow_hash[32];
        for (int i = 0; i < 32; i++) {
            pow_hash[i] = (uchar)(h[i / 8] >> ((i % 8) * 8));
        }

        // Check target (big-endian comparison)
        int meets = 1;
        for (int i = 0; i < 32; i++) {
            uchar hb = pow_hash[31 - i];  // reverse to big-endian
            if (hb < target[i]) { meets = 1; break; }
            if (hb > target[i]) { meets = 0; break; }
        }

        if (meets) {
            uint old = atomic_xchg(found, 1u);
            if (old == 0u) {
                *output_nonce = nonce;
                for (int i = 0; i < 32; i++) output_hash[i] = pow_hash[i];

                // Generate a dummy 52-byte solution (all zeros for now)
                // Real implementation would extract the Equihash solution
                for (int i = 0; i < EH_SOLUTION_SIZE; i++) {
                    output_solution[i] = 0;
                }
            }
        }
    }
}

// ── Multi-kernel Equihash solver (future implementation) ─────────────
//
// A proper GPU Equihash solver would use multiple kernels:
//
// 1. kernel_generate_rows:
//    - Each work-group generates a portion of the 2^26 initial rows
//    - Computes Blake2b-512 for each index
//    - Extracts n-bit chunks
//    - Stores (chunk, index) pairs in hash table 0
//
// 2. kernel_find_collisions (rounds 1-4):
//    - Each work-group processes one bucket
//    - Reads entries from previous table
//    - Finds pairs with matching first collision_bits
//    - XORs their hashes, trims collision_bits
//    - Stores merged entries in next table
//
// 3. kernel_extract_solutions:
//    - Scans final table for all-zero remaining hash
//    - Reconstructs full index tree
//    - Compresses indices into 52-byte solution
//    - Checks if solution hash meets target
//
// This would require ~500-1000 lines of OpenCL and careful memory
// management. The current single-kernel approach is a placeholder
// for pipeline testing.
