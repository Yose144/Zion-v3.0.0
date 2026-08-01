// Autolykos v2 (Ergo / ERG) tableless CUDA mining kernel.
//
// This is the real Ergo k-sum PoW used by Autolykos v2.  Instead of the
// impractical N×31-byte R table (tens of GB at current heights), the kernel
// computes every R element on-the-fly from the 8192-byte M constant.
//
// Algorithm (per thread, one nonce):
//   1. i  = takeRight(8, Blake2b256(msg || nonce_BE8)) mod N
//   2. e  = takeRight(31, Blake2b256(i_BE4 || height_BE4 || M))
//   3. indexes = genIndexes(e || msg || nonce_BE8)  (k = 32)
//   4. f  = sum_{j in indexes} takeRight(31, Blake2b256(j_BE4 || height_BE4 || M))
//   5. pow_hash = Blake2b256(32-byte BE(f))
//   6. accept if pow_hash <= target (big-endian byte comparison)
//
// M = (0..1024).flatMap(i => Longs.toByteArray(i))  (8192 bytes, big-endian)
// N depends on block height (2^26, then +5% every 51,200 blocks).
//
// This kernel is compiled at runtime via NVRTC, so it avoids any CUDA toolkit
// dependency on the build machine.

// ----------------------------------------------------------------------------
// Blake2b constants
// ----------------------------------------------------------------------------

__constant__ const uint64_t BLAKE2B_IV[8] = {
    0x6a09e667f3bcc908ULL, 0xbb67ae8584caa73bULL,
    0x3c6ef372fe94f82bULL, 0xa54ff53a5f1d36f1ULL,
    0x510e527fade682d1ULL, 0x9b05688c2b3e6c1fULL,
    0x1f83d9abfb41bd6bULL, 0x5be0cd19137e2179ULL
};

#define ROTR64(x, n) (((x) >> (n)) | ((x) << (64 - (n))))

// ----------------------------------------------------------------------------
// Blake2b mixing function G
// ----------------------------------------------------------------------------

#define B2B_G(v, a, b, c, d, x, y) \
    v[a] = v[a] + v[b] + (x); \
    v[d] = ROTR64(v[d] ^ v[a], 32); \
    v[c] = v[c] + v[d]; \
    v[b] = ROTR64(v[b] ^ v[c], 24); \
    v[a] = v[a] + v[b] + (y); \
    v[d] = ROTR64(v[d] ^ v[a], 16); \
    v[c] = v[c] + v[d]; \
    v[b] = ROTR64(v[b] ^ v[c], 63);

// ----------------------------------------------------------------------------
// Fully unrolled Blake2b-256 compression (12 rounds, no sigma lookup table)
// ----------------------------------------------------------------------------

__device__ __forceinline__ void blake2b_compress(
    uint64_t h[8],
    const uint64_t m[16],
    uint64_t t,
    int last
) {
    uint64_t v[16];

    v[0]  = h[0];  v[1]  = h[1];  v[2]  = h[2];  v[3]  = h[3];
    v[4]  = h[4];  v[5]  = h[5];  v[6]  = h[6];  v[7]  = h[7];
    v[8]  = BLAKE2B_IV[0]; v[9]  = BLAKE2B_IV[1];
    v[10] = BLAKE2B_IV[2]; v[11] = BLAKE2B_IV[3];
    v[12] = BLAKE2B_IV[4] ^ t; v[13] = BLAKE2B_IV[5];
    v[14] = last ? (BLAKE2B_IV[6] ^ 0xFFFFFFFFFFFFFFFFULL) : BLAKE2B_IV[6];
    v[15] = BLAKE2B_IV[7];

    // Round 0
    B2B_G(v, 0, 4,  8, 12, m[ 0], m[ 1]);
    B2B_G(v, 1, 5,  9, 13, m[ 2], m[ 3]);
    B2B_G(v, 2, 6, 10, 14, m[ 4], m[ 5]);
    B2B_G(v, 3, 7, 11, 15, m[ 6], m[ 7]);
    B2B_G(v, 0, 5, 10, 15, m[ 8], m[ 9]);
    B2B_G(v, 1, 6, 11, 12, m[10], m[11]);
    B2B_G(v, 2, 7,  8, 13, m[12], m[13]);
    B2B_G(v, 3, 4,  9, 14, m[14], m[15]);
    // Round 1
    B2B_G(v, 0, 4,  8, 12, m[14], m[10]);
    B2B_G(v, 1, 5,  9, 13, m[ 4], m[ 8]);
    B2B_G(v, 2, 6, 10, 14, m[ 9], m[15]);
    B2B_G(v, 3, 7, 11, 15, m[13], m[ 6]);
    B2B_G(v, 0, 5, 10, 15, m[ 1], m[12]);
    B2B_G(v, 1, 6, 11, 12, m[ 0], m[ 2]);
    B2B_G(v, 2, 7,  8, 13, m[11], m[ 7]);
    B2B_G(v, 3, 4,  9, 14, m[ 5], m[ 3]);
    // Round 2
    B2B_G(v, 0, 4,  8, 12, m[11], m[ 8]);
    B2B_G(v, 1, 5,  9, 13, m[12], m[ 0]);
    B2B_G(v, 2, 6, 10, 14, m[ 5], m[ 2]);
    B2B_G(v, 3, 7, 11, 15, m[15], m[13]);
    B2B_G(v, 0, 5, 10, 15, m[10], m[14]);
    B2B_G(v, 1, 6, 11, 12, m[ 3], m[ 6]);
    B2B_G(v, 2, 7,  8, 13, m[ 7], m[ 1]);
    B2B_G(v, 3, 4,  9, 14, m[ 9], m[ 4]);
    // Round 3
    B2B_G(v, 0, 4,  8, 12, m[ 7], m[ 9]);
    B2B_G(v, 1, 5,  9, 13, m[ 3], m[ 1]);
    B2B_G(v, 2, 6, 10, 14, m[13], m[12]);
    B2B_G(v, 3, 7, 11, 15, m[11], m[14]);
    B2B_G(v, 0, 5, 10, 15, m[ 2], m[ 6]);
    B2B_G(v, 1, 6, 11, 12, m[ 5], m[10]);
    B2B_G(v, 2, 7,  8, 13, m[ 4], m[ 0]);
    B2B_G(v, 3, 4,  9, 14, m[15], m[ 8]);
    // Round 4
    B2B_G(v, 0, 4,  8, 12, m[ 9], m[ 0]);
    B2B_G(v, 1, 5,  9, 13, m[ 5], m[ 7]);
    B2B_G(v, 2, 6, 10, 14, m[ 2], m[ 4]);
    B2B_G(v, 3, 7, 11, 15, m[10], m[15]);
    B2B_G(v, 0, 5, 10, 15, m[14], m[ 1]);
    B2B_G(v, 1, 6, 11, 12, m[11], m[12]);
    B2B_G(v, 2, 7,  8, 13, m[ 6], m[ 8]);
    B2B_G(v, 3, 4,  9, 14, m[ 3], m[13]);
    // Round 5
    B2B_G(v, 0, 4,  8, 12, m[ 2], m[12]);
    B2B_G(v, 1, 5,  9, 13, m[ 6], m[10]);
    B2B_G(v, 2, 6, 10, 14, m[ 0], m[11]);
    B2B_G(v, 3, 7, 11, 15, m[ 8], m[ 3]);
    B2B_G(v, 0, 5, 10, 15, m[ 4], m[13]);
    B2B_G(v, 1, 6, 11, 12, m[ 7], m[ 5]);
    B2B_G(v, 2, 7,  8, 13, m[15], m[14]);
    B2B_G(v, 3, 4,  9, 14, m[ 1], m[ 9]);
    // Round 6
    B2B_G(v, 0, 4,  8, 12, m[12], m[ 5]);
    B2B_G(v, 1, 5,  9, 13, m[ 1], m[15]);
    B2B_G(v, 2, 6, 10, 14, m[14], m[13]);
    B2B_G(v, 3, 7, 11, 15, m[ 4], m[10]);
    B2B_G(v, 0, 5, 10, 15, m[ 0], m[ 7]);
    B2B_G(v, 1, 6, 11, 12, m[ 6], m[ 3]);
    B2B_G(v, 2, 7,  8, 13, m[ 9], m[ 2]);
    B2B_G(v, 3, 4,  9, 14, m[ 8], m[11]);
    // Round 7
    B2B_G(v, 0, 4,  8, 12, m[13], m[11]);
    B2B_G(v, 1, 5,  9, 13, m[ 7], m[14]);
    B2B_G(v, 2, 6, 10, 14, m[12], m[ 1]);
    B2B_G(v, 3, 7, 11, 15, m[ 3], m[ 9]);
    B2B_G(v, 0, 5, 10, 15, m[ 5], m[ 0]);
    B2B_G(v, 1, 6, 11, 12, m[15], m[ 4]);
    B2B_G(v, 2, 7,  8, 13, m[ 8], m[ 6]);
    B2B_G(v, 3, 4,  9, 14, m[ 2], m[10]);
    // Round 8
    B2B_G(v, 0, 4,  8, 12, m[ 6], m[15]);
    B2B_G(v, 1, 5,  9, 13, m[14], m[ 9]);
    B2B_G(v, 2, 6, 10, 14, m[11], m[ 3]);
    B2B_G(v, 3, 7, 11, 15, m[ 0], m[ 8]);
    B2B_G(v, 0, 5, 10, 15, m[12], m[ 2]);
    B2B_G(v, 1, 6, 11, 12, m[13], m[ 7]);
    B2B_G(v, 2, 7,  8, 13, m[ 1], m[ 4]);
    B2B_G(v, 3, 4,  9, 14, m[10], m[ 5]);
    // Round 9
    B2B_G(v, 0, 4,  8, 12, m[10], m[ 2]);
    B2B_G(v, 1, 5,  9, 13, m[ 8], m[ 4]);
    B2B_G(v, 2, 6, 10, 14, m[ 7], m[ 6]);
    B2B_G(v, 3, 7, 11, 15, m[ 1], m[ 5]);
    B2B_G(v, 0, 5, 10, 15, m[15], m[11]);
    B2B_G(v, 1, 6, 11, 12, m[ 9], m[14]);
    B2B_G(v, 2, 7,  8, 13, m[ 3], m[12]);
    B2B_G(v, 3, 4,  9, 14, m[13], m[ 0]);
    // Round 10
    B2B_G(v, 0, 4,  8, 12, m[ 0], m[ 1]);
    B2B_G(v, 1, 5,  9, 13, m[ 2], m[ 3]);
    B2B_G(v, 2, 6, 10, 14, m[ 4], m[ 5]);
    B2B_G(v, 3, 7, 11, 15, m[ 6], m[ 7]);
    B2B_G(v, 0, 5, 10, 15, m[ 8], m[ 9]);
    B2B_G(v, 1, 6, 11, 12, m[10], m[11]);
    B2B_G(v, 2, 7,  8, 13, m[12], m[13]);
    B2B_G(v, 3, 4,  9, 14, m[14], m[15]);
    // Round 11
    B2B_G(v, 0, 4,  8, 12, m[14], m[10]);
    B2B_G(v, 1, 5,  9, 13, m[ 4], m[ 8]);
    B2B_G(v, 2, 6, 10, 14, m[ 9], m[15]);
    B2B_G(v, 3, 7, 11, 15, m[13], m[ 6]);
    B2B_G(v, 0, 5, 10, 15, m[ 1], m[12]);
    B2B_G(v, 1, 6, 11, 12, m[ 0], m[ 2]);
    B2B_G(v, 2, 7,  8, 13, m[11], m[ 7]);
    B2B_G(v, 3, 4,  9, 14, m[ 5], m[ 3]);

    h[0] ^= v[0] ^ v[ 8]; h[1] ^= v[1] ^ v[ 9];
    h[2] ^= v[2] ^ v[10]; h[3] ^= v[3] ^ v[11];
    h[4] ^= v[4] ^ v[12]; h[5] ^= v[5] ^ v[13];
    h[6] ^= v[6] ^ v[14]; h[7] ^= v[7] ^ v[15];
}

// ----------------------------------------------------------------------------
// Write a Blake2b-256 state as 32 little-endian bytes
// ----------------------------------------------------------------------------

__device__ __forceinline__ void blake2b_emit(const uint64_t h[8], uint8_t output[32]) {
    for (int i = 0; i < 4; i++) {
        uint64_t word = h[i];
        for (int j = 0; j < 8; j++) {
            output[i * 8 + j] = (uint8_t)(word >> (j * 8));
        }
    }
}

// ----------------------------------------------------------------------------
// Byte-swap a 64-bit word (big-endian <-> little-endian)
// ----------------------------------------------------------------------------

__device__ __forceinline__ uint64_t bswap64(uint64_t x) {
    x = ((x & 0x00FF00FF00FF00FFULL) << 8)  | ((x >> 8)  & 0x00FF00FF00FF00FFULL);
    x = ((x & 0x0000FFFF0000FFFFULL) << 16) | ((x >> 16) & 0x0000FFFF0000FFFFULL);
    return (x << 32) | (x >> 32);
}

// ----------------------------------------------------------------------------
// Load one 8-byte M word from the big-endian byte buffer.
// M_raw is an 8192-byte big-endian byte array (1024 x uint64be).  When we
// view it as a little-endian uint64_t array, each device load already returns
// the correct BLAKE2b message word (the little-endian interpretation of the
// input bytes).  No extra byte swap is needed.
// ----------------------------------------------------------------------------

__device__ __forceinline__ uint64_t load_m_word_le(const uint64_t *M_words, int word_index) {
    return M_words[word_index];
}

// ----------------------------------------------------------------------------
// Blake2b-256 for the R-element pattern: j(4B) || height(4B) || M(8192B)
// Total input: 8200 bytes = 64 full 128B blocks + 8 bytes remainder.
// ----------------------------------------------------------------------------

__device__ __forceinline__ void blake2b_256_jhm(
    uint32_t j_index,
    uint32_t height,
    const uint64_t *M_words,
    uint8_t output[32]
) {
    uint64_t h[8];
    for (int i = 0; i < 8; i++) h[i] = BLAKE2B_IV[i];
    h[0] ^= 0x01010020ULL;

    uint64_t m_block[16];

    // Block 0: 8-byte prefix (j || height) + 120 bytes from M
    uint64_t prefix_le =
        ((uint64_t)((j_index >> 24) & 0xFF))        |
        ((uint64_t)((j_index >> 16) & 0xFF) <<  8)  |
        ((uint64_t)((j_index >>  8) & 0xFF) << 16)  |
        ((uint64_t)((j_index      ) & 0xFF) << 24)  |
        ((uint64_t)((height  >> 24) & 0xFF) << 32)  |
        ((uint64_t)((height  >> 16) & 0xFF) << 40)  |
        ((uint64_t)((height  >>  8) & 0xFF) << 48)  |
        ((uint64_t)((height       ) & 0xFF) << 56);

    m_block[0] = prefix_le;
    for (int w = 0; w < 15; w++) {
        m_block[w + 1] = load_m_word_le(M_words, w);
    }
    blake2b_compress(h, m_block, 128, 0);

    // Blocks 1..63: 16 M words each
    for (int b = 1; b < 64; b++) {
        int base = b * 16 - 1;
        for (int w = 0; w < 16; w++) {
            m_block[w] = load_m_word_le(M_words, base + w);
        }
        blake2b_compress(h, m_block, (uint64_t)(b + 1) * 128, 0);
    }

    // Final block: last 8 bytes of M, padded to 128 bytes
    for (int i = 0; i < 16; i++) m_block[i] = 0;
    m_block[0] = load_m_word_le(M_words, 1023);
    blake2b_compress(h, m_block, 8200, 1);

    blake2b_emit(h, output);
}

// ----------------------------------------------------------------------------
// Blake2b-256 for inputs <= 128 bytes (one padded 128-byte block)
// ----------------------------------------------------------------------------

__device__ __forceinline__ void blake2b_256_oneblock(
    const uint8_t *input,
    uint32_t input_len,
    uint8_t output[32]
) {
    uint64_t h[8];
    for (int i = 0; i < 8; i++) h[i] = BLAKE2B_IV[i];
    h[0] ^= 0x01010020ULL;

    uint64_t m[16];
    for (int i = 0; i < 16; i++) m[i] = 0;

    for (uint32_t i = 0; i < input_len; i++) {
        uint32_t word_idx = i >> 3;
        uint32_t byte_idx = i & 7;
        m[word_idx] |= (uint64_t)input[i] << (byte_idx * 8);
    }

    blake2b_compress(h, m, (uint64_t)input_len, 1);
    blake2b_emit(h, output);
}

// ----------------------------------------------------------------------------
// Compute one R element on-the-fly: takeRight(31, Blake2b256(j || h || M))
// ----------------------------------------------------------------------------

__device__ __forceinline__ void compute_r_element(
    uint32_t j_index,
    uint32_t height,
    const uint64_t *M_words,
    uint8_t r_out[31]
) {
    uint8_t hash[32];
    blake2b_256_jhm(j_index, height, M_words, hash);
    for (int i = 0; i < 31; i++) {
        r_out[i] = hash[i + 1];
    }
}

// ----------------------------------------------------------------------------
// Generate the k = 32 pseudorandom indexes from seed
// ----------------------------------------------------------------------------

__device__ __forceinline__ void gen_indexes(
    const uint8_t *seed,
    uint32_t seed_len,
    uint32_t N,
    uint32_t indexes[32]
) {
    uint8_t hash[32];
    blake2b_256_oneblock(seed, seed_len, hash);

    uint8_t extended[35];
    for (int i = 0; i < 32; i++) extended[i] = hash[i];
    extended[32] = hash[0];
    extended[33] = hash[1];
    extended[34] = hash[2];

    for (int i = 0; i < 32; i++) {
        uint32_t val =
            ((uint32_t)extended[i]     << 24) |
            ((uint32_t)extended[i + 1] << 16) |
            ((uint32_t)extended[i + 2] <<  8) |
            ((uint32_t)extended[i + 3]      );
        indexes[i] = val % N;
    }
}

// ----------------------------------------------------------------------------
// Big-int addition in-place: 32-byte big-endian accumulator += 32-byte addend
// ----------------------------------------------------------------------------

__device__ __forceinline__ void add_bigint_be32_inplace(
    uint8_t result[32],
    const uint8_t addend[32]
) {
    uint32_t carry = 0;
    for (int i = 31; i >= 0; i--) {
        uint32_t sum = (uint32_t)result[i] + (uint32_t)addend[i] + carry;
        result[i] = (uint8_t)(sum & 0xFF);
        carry = sum >> 8;
    }
}

// ----------------------------------------------------------------------------
// Big-endian byte comparison: hash <= target
// ----------------------------------------------------------------------------

__device__ __forceinline__ int hash_le_target(
    const uint8_t hash[32],
    const uint8_t target[32]
) {
    for (int i = 0; i < 32; i++) {
        if (hash[i] < target[i]) return 1;
        if (hash[i] > target[i]) return 0;
    }
    return 1; // equal
}

// ----------------------------------------------------------------------------
// Main mining kernel
// ----------------------------------------------------------------------------

extern "C" {

__global__ __launch_bounds__(256) void autolykos_mine(
    const uint8_t *header,
    const uint32_t header_len,
    const uint32_t height,
    const uint32_t N,
    const uint8_t *target,
    const uint64_t base_nonce,
    const uint8_t *M_raw,
    uint64_t *output_nonce,
    uint8_t *output_hash,
    uint32_t *found
) {
    if (*found) return;

    const uint64_t nonce = base_nonce + ((uint64_t)blockIdx.x * blockDim.x + (uint64_t)threadIdx.x);

    const uint64_t *M_words = (const uint64_t *)M_raw;

    // Copy header into local 32-byte buffer, padded with zero
    uint8_t header_hash[32];
    for (int i = 0; i < 32; i++) header_hash[i] = 0;
    uint32_t hlen = (header_len < 32) ? header_len : 32;
    for (uint32_t i = 0; i < hlen; i++) header_hash[i] = header[i];

    // Step 1: i = takeRight(8, Blake2b256(header || nonce_BE8)) mod N
    uint8_t mn_input[40];
    for (int i = 0; i < 32; i++) mn_input[i] = header_hash[i];
    mn_input[32] = (uint8_t)(nonce >> 56);
    mn_input[33] = (uint8_t)(nonce >> 48);
    mn_input[34] = (uint8_t)(nonce >> 40);
    mn_input[35] = (uint8_t)(nonce >> 32);
    mn_input[36] = (uint8_t)(nonce >> 24);
    mn_input[37] = (uint8_t)(nonce >> 16);
    mn_input[38] = (uint8_t)(nonce >>  8);
    mn_input[39] = (uint8_t)(nonce      );

    uint8_t hash_i[32];
    blake2b_256_oneblock(mn_input, 40, hash_i);

    uint64_t prei8 =
        ((uint64_t)hash_i[24] << 56) | ((uint64_t)hash_i[25] << 48) |
        ((uint64_t)hash_i[26] << 40) | ((uint64_t)hash_i[27] << 32) |
        ((uint64_t)hash_i[28] << 24) | ((uint64_t)hash_i[29] << 16) |
        ((uint64_t)hash_i[30] <<  8) | ((uint64_t)hash_i[31]      );
    uint32_t i_idx = (uint32_t)(prei8 % (uint64_t)N);

    // Step 2: e = takeRight(31, Blake2b256(i || height || M))
    uint8_t e[31];
    compute_r_element(i_idx, height, M_words, e);

    // Step 3: seed = e || header || nonce (71 bytes)
    uint8_t seed[71];
    for (int i = 0; i < 31; i++) seed[i] = e[i];
    for (int i = 0; i < 32; i++) seed[31 + i] = header_hash[i];
    seed[63] = (uint8_t)(nonce >> 56);
    seed[64] = (uint8_t)(nonce >> 48);
    seed[65] = (uint8_t)(nonce >> 40);
    seed[66] = (uint8_t)(nonce >> 32);
    seed[67] = (uint8_t)(nonce >> 24);
    seed[68] = (uint8_t)(nonce >> 16);
    seed[69] = (uint8_t)(nonce >>  8);
    seed[70] = (uint8_t)(nonce      );

    // Step 3: generate k indexes
    uint32_t indexes[32];
    gen_indexes(seed, 71, N, indexes);

    // Step 4+5: sum 31-byte R elements into a 32-byte big-endian accumulator
    uint8_t f[32];
    for (int i = 0; i < 32; i++) f[i] = 0;

    for (int k = 0; k < 32; k++) {
        uint8_t r_elem[31];
        compute_r_element(indexes[k], height, M_words, r_elem);

        uint8_t elem32[32];
        elem32[0] = 0;
        for (int i = 0; i < 31; i++) elem32[i + 1] = r_elem[i];

        add_bigint_be32_inplace(f, elem32);
    }

    // Step 6: pow_hash = Blake2b256(f)
    uint8_t pow_hash[32];
    blake2b_256_oneblock(f, 32, pow_hash);

    // Step 7: compare with target (big-endian byte comparison)
    if (hash_le_target(pow_hash, target)) {
        unsigned int old = atomicExch(found, 1u);
        if (old == 0u) {
            *output_nonce = nonce;
            for (int i = 0; i < 32; i++) output_hash[i] = pow_hash[i];
        }
    }
}

} // extern "C"
