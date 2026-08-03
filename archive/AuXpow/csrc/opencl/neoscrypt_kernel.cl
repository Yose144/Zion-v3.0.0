// NeoScrypt OpenCL kernel for PhoenixCoin (PHX) mining.
//
// NeoScrypt is a memory-hard hash function designed as a lighter-weight
// alternative to classic Scrypt.  It is used by PhoenixCoin (PHX) and a
// number of other NeoScrypt-based coins.  The algorithm combines three
// building blocks:
//
//   1. BLAKE2s-256  — used for the initial digest of the 80-byte header
//                     and for the final digest that produces the 32-byte
//                     proof-of-work hash.  BLAKE2s operates on 32-bit
//                     words (unlike BLAKE2b which uses 64-bit words).
//
//   2. PBKDF2-HMAC-BLAKE2s — the KDF used to (a) fill the scratchpad with
//                     pseudo-random data derived from the initial hash,
//                     and (b) produce the 32-byte scrypt output from the
//                     mixed scratchpad.  PBKDF2 here uses HMAC built on
//                     BLAKE2s-256 as the underlying PRF.
//
//   3. Scrypt ROMix — the memory-hard mixing core.  NeoScrypt uses a much
//                     smaller scratchpad than standard scrypt: only 32 KiB
//                     with parameters N=32, r=1, p=1 (standard scrypt uses
//                     N=1024..2^20, r=8, p=1, i.e. 128 KiB per block at
//                     the smallest setting).  The smaller N makes NeoScrypt
//                     GPU/ASIC friendlier while still being memory-hard
//                     relative to a pure hash.
//
// Overall pipeline (per nonce):
//
//   initial_hash = BLAKE2s-256(header || nonce)          // 32 bytes
//   B            = initial_hash (32 bytes, padded to 128)
//   V[0..N)      = PBKDF2-HMAC-BLAKE2s stream filling 32 KiB
//   for i in 0..N-1:  V[i] = BlockMix(V[i-1])            // ROMix "fill"
//   X             = V[N-1]
//   for i in 0..N-1:  X = BlockMix(X ^ V[X mod N])       // ROMix "mix"
//   scrypt_out   = PBKDF2-HMAC-BLAKE2s(initial_hash, X)  // 32 bytes
//   final_hash   = BLAKE2s-256(initial_hash || scrypt_out)
//   compare final_hash (big-endian) <= target
//
// Each work-item processes exactly one nonce:
//   nonce = base_nonce + get_global_id(0)
//
// References:
//   - NeoScrypt reference: https://github.com/ghostlander/neoScrypt
//   - RFC 8018 (PBKDF2)
//   - RFC 7914 (scrypt) — ROMix / BlockMix definitions
//   - RFC 7693 (BLAKE2)

// ---------------------------------------------------------------------------
// BLAKE2s constants
// ---------------------------------------------------------------------------

// BLAKE2s initialization vector (first half of the parameter block digest).
__constant const uint BLAKE2S_IV[8] = {
    0x6A09E667u, 0xBB67AE85u, 0x3C6EF372u, 0xA54FF53Au,
    0x510E527Fu, 0x9B05688Cu, 0x1F83D9ABu, 0x5BE0CD19u
};

// BLAKE2s message-schedule permutations SIGMA (RFC 7693 §2.7).  BLAKE2s
// uses 10 rounds; BLAKE2b uses 12 (the first 10 plus SIGMA[0..1] again).
// Each row is a permutation of 0..15 selecting message words for the eight
// G-function calls in a round.
__constant const uchar SIGMA[10][16] = {
    {  0,  1,  2,  3,  4,  5,  6,  7,  8,  9, 10, 11, 12, 13, 14, 15 },
    { 14, 10,  4,  8,  9, 15, 13,  6,  1, 12,  0,  2, 11,  7,  5,  3 },
    { 11,  8, 12,  0,  5,  2, 15, 13, 10, 14,  3,  6,  7,  1,  9,  4 },
    {  7,  9,  3,  1, 13, 12, 11, 14,  2,  6,  5, 10,  4,  0, 15,  8 },
    {  9,  0,  5,  7,  2,  4, 10, 15, 14,  1, 11, 12,  6,  8,  3, 13 },
    {  2, 12,  6, 10,  0, 11,  8,  3,  4, 13,  7,  5, 15, 14,  1,  9 },
    { 12,  5,  1, 15, 14, 13,  4, 10,  0,  7,  6,  3,  9,  2,  8, 11 },
    { 13, 11,  7, 14, 12,  1,  3,  9,  5,  0, 15,  4,  8,  6,  2, 10 },
    {  6, 15, 14,  9, 11,  3,  0,  8, 12,  2, 13,  7,  1,  4, 10,  5 },
    { 10,  2,  8,  4,  7,  6,  1,  5, 15, 11,  9, 14,  3, 12, 13,  0 }
};

// 32-bit rotation helpers.
#define ROTR32(x, n) (((x) >> (n)) | ((x) << (32 - (n))))
#define ROTL32(x, n) (((x) << (n)) | ((x) >> (32 - (n))))

// BLAKE2s G function.  Operates in place on the working state.
#define G(v, a, b, c, d, x, y) \
    v[a] = v[a] + v[b] + (x); \
    v[d] = ROTR32(v[d] ^ v[a], 16); \
    v[c] = v[c] + v[d]; \
    v[b] = ROTR32(v[b] ^ v[c], 12); \
    v[a] = v[a] + v[b] + (y); \
    v[d] = ROTR32(v[d] ^ v[a], 8);  \
    v[c] = v[c] + v[d]; \
    v[b] = ROTR32(v[b] ^ v[c], 7);

// ---------------------------------------------------------------------------
// BLAKE2s-256 compression function
// ---------------------------------------------------------------------------
//
// BLAKE2s processes 64-byte blocks with a 256-bit (8-word) chaining value.
// The state is 16 32-bit words: h[0..7] || v[8..15] where v[8..11] hold the
// counter (t0,t1) and the block offset/finalization flags (f0,f1).
//
// h       : input chaining value (8 words)
// block   : 64-byte message block
// t       : 64-bit total bytes processed so far (including this block)
// last    : 1 if this is the final block (sets f0 = 0xFFFFFFFF)
// out     : output chaining value (8 words)

void blake2s_compress(
    const uint h[8],
    const uchar block[64],
    ulong t,
    uint last,
    uint out[8]
) {
    uint v[16];
    #pragma unroll
    for (int i = 0; i < 8; i++) v[i] = h[i];
    #pragma unroll
    for (int i = 0; i < 8; i++) v[8 + i] = BLAKE2S_IV[i];

    // 64-bit counter split into two 32-bit words.
    v[12] ^= (uint)(t & 0xFFFFFFFFu);
    v[13] ^= (uint)((t >> 32) & 0xFFFFFFFFu);
    if (last) v[14] ^= 0xFFFFFFFFu;

    // Message words (little-endian).
    uint m[16];
    #pragma unroll
    for (int i = 0; i < 16; i++) {
        m[i] = (uint)block[i * 4 + 0]
             | ((uint)block[i * 4 + 1] << 8)
             | ((uint)block[i * 4 + 2] << 16)
             | ((uint)block[i * 4 + 3] << 24);
    }

    // 10 rounds.
    for (int r = 0; r < 10; r++) {
        __constant const uchar *s = SIGMA[r];
        G(v, 0, 4,  8, 12, m[s[0]],  m[s[1]]);
        G(v, 1, 5,  9, 13, m[s[2]],  m[s[3]]);
        G(v, 2, 6, 10, 14, m[s[4]],  m[s[5]]);
        G(v, 3, 7, 11, 15, m[s[6]],  m[s[7]]);
        G(v, 0, 5, 10, 15, m[s[8]],  m[s[9]]);
        G(v, 1, 6, 11, 12, m[s[10]], m[s[11]]);
        G(v, 2, 7,  8, 13, m[s[12]], m[s[13]]);
        G(v, 3, 4,  9, 14, m[s[14]], m[s[15]]);
    }

    #pragma unroll
    for (int i = 0; i < 8; i++) out[i] = h[i] ^ v[i] ^ v[8 + i];
}

// ---------------------------------------------------------------------------
// BLAKE2s-256 keyed/parameterized hash
// ---------------------------------------------------------------------------
//
// Computes BLAKE2s-256 over `data` (length `len` bytes).  The 32-byte digest
// is written to `digest`.  This is the unkeyed variant (key length 0) which
// is what NeoScrypt uses for the initial and final hashes.

void blake2s_256(const uchar *data, uint len, uchar digest[32]) {
    uint h[8];
    #pragma unroll
    for (int i = 0; i < 8; i++) h[i] = BLAKE2S_IV[i];

    // Parameter block word 0: digest_length | (key_length << 8) |
    // (fanout << 16) | (depth << 24).  For unkeyed BLAKE2s-256 with
    // fanout=1, depth=1 this is 0x01010020 (digest length 32 = 0x20).
    h[0] ^= 0x01010020u;

    if (len == 0u) {
        // Single empty final block.
        uchar block[64];
        #pragma unroll
        for (int i = 0; i < 64; i++) block[i] = 0;
        uint out[8];
        blake2s_compress(h, block, 0u, 1u, out);
        #pragma unroll
        for (int i = 0; i < 8; i++) {
            digest[i * 4 + 0] = (uchar)(out[i]);
            digest[i * 4 + 1] = (uchar)(out[i] >> 8);
            digest[i * 4 + 2] = (uchar)(out[i] >> 16);
            digest[i * 4 + 3] = (uchar)(out[i] >> 24);
        }
        return;
    }

    uint full = len / 64u;      // number of complete 64-byte blocks
    uint rem = len & 63u;       // remaining bytes in the final (partial) block

    uint t = 0u;
    for (uint b = 0u; b < full; b++) {
        uchar block[64];
        uint off = b * 64u;
        #pragma unroll
        for (int i = 0; i < 64; i++) block[i] = data[off + i];
        t += 64u;
        uint out[8];
        blake2s_compress(h, block, t, 0u, out);
        #pragma unroll
        for (int i = 0; i < 8; i++) h[i] = out[i];
    }

    // Final block (always present when rem > 0; if rem == 0 the last full
    // block above was already the final block only when len was a multiple
    // of 64 — handle that by re-compressing the last full block as final).
    uchar block[64];
    #pragma unroll
    for (int i = 0; i < 64; i++) block[i] = 0;
    if (rem > 0u) {
        uint off = full * 64u;
        for (uint i = 0; i < rem; i++) block[i] = data[off + i];
        t += rem;
    } else {
        // len was an exact multiple of 64: the previous block was not marked
        // final, so re-process it as the final block.
        full -= 1u;
        uint off = full * 64u;
        #pragma unroll
        for (int i = 0; i < 64; i++) block[i] = data[off + i];
        t = len; // already includes this block's 64 bytes
    }
    uint out[8];
    blake2s_compress(h, block, t, 1u, out);
    #pragma unroll
    for (int i = 0; i < 8; i++) {
        digest[i * 4 + 0] = (uchar)(out[i]);
        digest[i * 4 + 1] = (uchar)(out[i] >> 8);
        digest[i * 4 + 2] = (uchar)(out[i] >> 16);
        digest[i * 4 + 3] = (uchar)(out[i] >> 24);
    }
}

// ---------------------------------------------------------------------------
// HMAC-BLAKE2s-256
// ---------------------------------------------------------------------------
//
// HMAC(K, m) = BLAKE2s( (K' xor opad) || BLAKE2s( (K' xor ipad) || m ) )
// where K' is K padded to 64 bytes (the BLAKE2s block size).  ipad = 0x36,
// opad = 0x5c.  Keys longer than 64 bytes are hashed first; NeoScrypt's keys
// are 32 bytes so this branch is not exercised but is included for
// correctness.

void hmac_blake2s(
    const uchar *key, uint key_len,
    const uchar *msg, uint msg_len,
    uchar mac[32]
) {
    uchar kpad[64];

    // Normalize the key to 64 bytes.
    if (key_len > 64u) {
        uchar khash[32];
        blake2s_256(key, key_len, khash);
        #pragma unroll
        for (int i = 0; i < 64; i++) kpad[i] = 0;
        #pragma unroll
        for (int i = 0; i < 32; i++) kpad[i] = khash[i];
    } else {
        #pragma unroll
        for (int i = 0; i < 64; i++) kpad[i] = 0;
        for (uint i = 0; i < key_len; i++) kpad[i] = key[i];
    }

    // inner = BLAKE2s( (kpad ^ ipad) || msg )
    uchar inner_key[64];
    #pragma unroll
    for (int i = 0; i < 64; i++) inner_key[i] = kpad[i] ^ 0x36u;

    // Build the inner message buffer: 64 + msg_len bytes.
    // NeoScrypt messages are small (<= 128 bytes) so a 256-byte buffer is
    // more than enough.
    uchar inner_buf[256];
    #pragma unroll
    for (int i = 0; i < 64; i++) inner_buf[i] = inner_key[i];
    for (uint i = 0; i < msg_len; i++) inner_buf[64 + i] = msg[i];

    uchar inner_hash[32];
    blake2s_256(inner_buf, 64u + msg_len, inner_hash);

    // outer = BLAKE2s( (kpad ^ opad) || inner_hash )
    uchar outer_key[64];
    #pragma unroll
    for (int i = 0; i < 64; i++) outer_key[i] = kpad[i] ^ 0x5cu;

    uchar outer_buf[96];
    #pragma unroll
    for (int i = 0; i < 64; i++) outer_buf[i] = outer_key[i];
    #pragma unroll
    for (int i = 0; i < 32; i++) outer_buf[64 + i] = inner_hash[i];

    blake2s_256(outer_buf, 96u, mac);
}

// ---------------------------------------------------------------------------
// PBKDF2-HMAC-BLAKE2s
// ---------------------------------------------------------------------------
//
// PBKDF2(password, salt, c, dkLen) derives dkLen bytes by concatenating
// blocks T_1 || T_2 || ... where
//   T_i = F(password, salt || INT(i), c)
//   F(P, S, c) = U_1 ^ U_2 ^ ... ^ U_c
//   U_1 = HMAC(P, S);  U_j = HMAC(P, U_{j-1})
//
// NeoScrypt uses dkLen = 32 bytes (one block, T_1) for the scrypt output,
// and a longer stream (multiple blocks) to fill the 32 KiB scratchpad.
// This helper produces `out_len` bytes (rounded up to a multiple of 32).

void pbkdf2_hmac_blake2s(
    const uchar *password, uint pass_len,
    const uchar *salt, uint salt_len,
    uint iterations,
    uchar *out, uint out_len
) {
    uint blocks = (out_len + 31u) / 32u;
    for (uint b = 1u; b <= blocks; b++) {
        // U_1 = HMAC(password, salt || INT_32_BE(b))
        uchar salt_block[256];
        for (uint i = 0; i < salt_len; i++) salt_block[i] = salt[i];
        // 32-bit big-endian block index.
        salt_block[salt_len + 0] = (uchar)(b >> 24);
        salt_block[salt_len + 1] = (uchar)(b >> 16);
        salt_block[salt_len + 2] = (uchar)(b >> 8);
        salt_block[salt_len + 3] = (uchar)(b);

        uchar U[32];
        uchar T[32];
        hmac_blake2s(password, pass_len, salt_block, salt_len + 4u, U);
        #pragma unroll
        for (int i = 0; i < 32; i++) T[i] = U[i];

        for (uint j = 1u; j < iterations; j++) {
            hmac_blake2s(password, pass_len, U, 32u, U);
            #pragma unroll
            for (int i = 0; i < 32; i++) T[i] ^= U[i];
        }

        uint off = (b - 1u) * 32u;
        uint copy = (off + 32u <= out_len) ? 32u : (out_len - off);
        for (uint i = 0; i < copy; i++) out[off + i] = T[i];
    }
}

// ---------------------------------------------------------------------------
// Scrypt BlockMix (r = 1)
// ---------------------------------------------------------------------------
//
// With r = 1 each block is 64 bytes (one BLAKE2s block).  BlockMix processes
// 2r = 2 blocks of 64 bytes (128 bytes total) and produces 128 bytes.
//
//   X = input[0]
//   for i in 0..2r-1:
//       X = X xor input[i]
//       X = BLAKE2s-256(X)        // 64-byte input -> 32-byte output, padded
//       Y[i] = X
//   output[0..r-1]   = Y[0,2,4,...]   (even indices)
//   output[r..2r-1]  = Y[1,3,5,...]   (odd indices)
//
// For r = 1: input = B0 || B1 (128 bytes), output = Y0 || Y1 (128 bytes,
// each 64 bytes — but BLAKE2s only emits 32 bytes, so we zero-extend each
// half-block to 64 bytes).

void blockmix_r1(const uchar *B_in, uchar *B_out) {
    uchar X[64];
    #pragma unroll
    for (int i = 0; i < 64; i++) X[i] = B_in[i];   // X = B_in[0]

    uchar Y0[64];
    // X = X xor B_in[0] (= 0 here since X starts as B_in[0]); then hash.
    // Per RFC 7914: X = X xor B[0]; so we xor B_in[0] into X (which is
    // already B_in[0]) — net effect X stays B_in[0].
    {
        uchar tmp[64];
        #pragma unroll
        for (int i = 0; i < 64; i++) tmp[i] = X[i] ^ B_in[i];
        uchar digest[32];
        blake2s_256(tmp, 64u, digest);
        #pragma unroll
        for (int i = 0; i < 32; i++) Y0[i] = digest[i];
        #pragma unroll
        for (int i = 32; i < 64; i++) Y0[i] = 0;
        #pragma unroll
        for (int i = 0; i < 64; i++) X[i] = Y0[i];
    }

    // X = X xor B_in[1]; hash -> Y1
    uchar Y1[64];
    {
        uchar tmp[64];
        #pragma unroll
        for (int i = 0; i < 64; i++) tmp[i] = X[i] ^ B_in[64 + i];
        uchar digest[32];
        blake2s_256(tmp, 64u, digest);
        #pragma unroll
        for (int i = 0; i < 32; i++) Y1[i] = digest[i];
        #pragma unroll
        for (int i = 32; i < 64; i++) Y1[i] = 0;
    }

    // Output ordering for r=1: out[0..63] = Y0, out[64..127] = Y1.
    #pragma unroll
    for (int i = 0; i < 64; i++) B_out[i]      = Y0[i];
    #pragma unroll
    for (int i = 0; i < 64; i++) B_out[64 + i] = Y1[i];
}

// ---------------------------------------------------------------------------
// Scrypt ROMix (N = 32, r = 1, p = 1)
// ---------------------------------------------------------------------------
//
// ROMix(B, N):
//   V[0] = B
//   for i in 1..N-1:  V[i] = BlockMix(V[i-1])
//   X = V[N-1]
//   for i in 0..N-1:  j = Integerify(X) mod N;  X = BlockMix(X xor V[j])
//   return X
//
// Integerify(X) interprets the last 8 bytes of X as a little-endian 64-bit
// integer.  With r = 1, X is 128 bytes so we read bytes 120..127.
//
// The scratchpad holds N blocks of 128 bytes = 32 * 128 = 4096 bytes for the
// ROMix working set.  NeoScrypt's full 32 KiB scratchpad is partitioned as:
//   - 4096 bytes for the ROMix V array (N=32 blocks of 128 bytes)
//   - the remainder used as PBKDF2 stream padding / alignment.
// We use the first 4096 bytes of the per-work-item scratchpad region for V.

#define NEOSCRYPT_N        32u
#define NEOSCRYPT_R        1u
#define NEOSCRYPT_P        1u
#define NEOSCRYPT_BLOCK    128u          // 2r * 64 bytes
#define NEOSCRYPT_SCRATCH  32768u        // 32 KiB per work-item

void romix_n32_r1(uchar *B, __global uchar *scratch) {
    // V is stored in global scratch (first N*128 = 4096 bytes of this
    // work-item's region).  B is kept in private memory (128 bytes).
    __global uchar *V = scratch;

    // Fill phase: V[0] = B, V[i] = BlockMix(V[i-1]).
    for (uint i = 0u; i < NEOSCRYPT_N; i++) {
        if (i == 0u) {
            for (uint k = 0; k < NEOSCRYPT_BLOCK; k++) V[k] = B[k];
        } else {
            __global uchar *prev = V + (i - 1u) * NEOSCRYPT_BLOCK;
            uchar inbuf[128];
            for (uint k = 0; k < NEOSCRYPT_BLOCK; k++) inbuf[k] = prev[k];
            uchar outbuf[128];
            blockmix_r1(inbuf, outbuf);
            __global uchar *cur = V + i * NEOSCRYPT_BLOCK;
            for (uint k = 0; k < NEOSCRYPT_BLOCK; k++) cur[k] = outbuf[k];
        }
    }

    // X = V[N-1].
    uchar X[128];
    {
        __global uchar *last = V + (NEOSCRYPT_N - 1u) * NEOSCRYPT_BLOCK;
        for (uint k = 0; k < NEOSCRYPT_BLOCK; k++) X[k] = last[k];
    }

    // Mix phase.
    for (uint i = 0u; i < NEOSCRYPT_N; i++) {
        // Integerify: last 8 bytes of X as little-endian u64.
        ulong j64 = 0;
        for (int k = 0; k < 8; k++) {
            j64 |= ((ulong)X[120 + k]) << (8 * k);
        }
        uint j = (uint)(j64 % NEOSCRYPT_N);

        // X = X xor V[j].
        __global uchar *Vj = V + j * NEOSCRYPT_BLOCK;
        for (uint k = 0; k < NEOSCRYPT_BLOCK; k++) X[k] ^= Vj[k];

        // X = BlockMix(X).
        uchar outbuf[128];
        blockmix_r1(X, outbuf);
        for (uint k = 0; k < NEOSCRYPT_BLOCK; k++) X[k] = outbuf[k];
    }

    // Copy mixed X back into B for the caller.
    for (uint k = 0; k < NEOSCRYPT_BLOCK; k++) B[k] = X[k];
}

// ---------------------------------------------------------------------------
// NeoScrypt core (per nonce)
// ---------------------------------------------------------------------------
//
// Computes the 32-byte NeoScrypt hash for a single (header, nonce) pair.
// `scratch` points to this work-item's 32 KiB scratchpad region in global
// memory.

void neoscrypt_hash(
    const uchar *header, uint header_len,
    ulong nonce,
    __global uchar *scratch,
    uchar final_hash[32]
) {
    // --- Step 1: BLAKE2s-256(header || nonce) ---------------------------
    // Build the 80-byte (or header_len-byte) buffer with the 8-byte nonce
    // appended.  PhoenixCoin headers are 80 bytes; the nonce is the last
    // 4 bytes in many NeoScrypt variants, but we append a full 8-byte
    // little-endian nonce here for generality.
    uchar hdr[160];
    for (uint i = 0; i < header_len && i < 152u; i++) hdr[i] = header[i];
    // Append 8-byte little-endian nonce.
    hdr[header_len + 0] = (uchar)(nonce);
    hdr[header_len + 1] = (uchar)(nonce >> 8);
    hdr[header_len + 2] = (uchar)(nonce >> 16);
    hdr[header_len + 3] = (uchar)(nonce >> 24);
    hdr[header_len + 4] = (uchar)(nonce >> 32);
    hdr[header_len + 5] = (uchar)(nonce >> 40);
    hdr[header_len + 6] = (uchar)(nonce >> 48);
    hdr[header_len + 7] = (uchar)(nonce >> 56);
    uint total = header_len + 8u;

    uchar initial_hash[32];
    blake2s_256(hdr, total, initial_hash);

    // --- Step 2: Scrypt-like PBKDF2 + ROMix -----------------------------
    // B = PBKDF2-HMAC-BLAKE2s(initial_hash, initial_hash, 1, 128 bytes)
    // (password = salt = initial_hash, 1 iteration, dkLen = 128).
    uchar B[128];
    pbkdf2_hmac_blake2s(initial_hash, 32u, initial_hash, 32u, 1u, B, 128u);

    // ROMix with N=32, r=1 using the per-work-item scratchpad.
    romix_n32_r1(B, scratch);

    // scrypt_out = PBKDF2-HMAC-BLAKE2s(initial_hash, B, 1, 32 bytes)
    uchar scrypt_out[32];
    pbkdf2_hmac_blake2s(initial_hash, 32u, B, 128u, 1u, scrypt_out, 32u);

    // --- Step 3: BLAKE2s-256(initial_hash || scrypt_out) ----------------
    uchar final_in[64];
    #pragma unroll
    for (int i = 0; i < 32; i++) final_in[i] = initial_hash[i];
    #pragma unroll
    for (int i = 0; i < 32; i++) final_in[32 + i] = scrypt_out[i];

    blake2s_256(final_in, 64u, final_hash);
}

// ---------------------------------------------------------------------------
// Mining entry point
// ---------------------------------------------------------------------------
//
// Each work-item processes one nonce: nonce = base_nonce + get_global_id(0).
//
// Arguments:
//   header       - 80-byte block header (const, shared by all work-items)
//   header_len   - length of header in bytes (typically 80)
//   base_nonce   - first nonce in this batch
//   output_hash  - 32-byte buffer to receive the winning hash
//   found_flag   - single uint flag, set to 1 when a solution is found
//   target       - 32-byte target (big-endian) the hash must be <=
//   scratchpad   - per-work-item scratchpad, NEOSCRYPT_SCRATCH bytes each,
//                  laid out as scratchpad[get_global_id(0) * NEOSCRYPT_SCRATCH]

__kernel void neoscrypt_mine(
    __global const uchar *header,
    uint header_len,
    ulong base_nonce,
    __global uchar *output_hash,
    __global uint *found_flag,
    __global const uchar *target,
    __global uchar *scratchpad
) {
    uint gid = get_global_id(0);

    // Point this work-item's scratch pointer at its private 32 KiB region.
    __global uchar *my_scratch = scratchpad + (ulong)gid * NEOSCRYPT_SCRATCH;

    ulong nonce = base_nonce + (ulong)gid;

    // Copy the header into private memory once per work-item.
    uchar hdr[160];
    for (uint i = 0; i < header_len && i < 152u; i++) hdr[i] = header[i];

    uchar hash[32];
    neoscrypt_hash(hdr, header_len, nonce, my_scratch, hash);

    // Compare hash (interpreted big-endian) against the 32-byte target.
    // The target is stored big-endian: target[0] is the most significant
    // byte.  We compare hash[31..0] (reversed so hash[31] is MSB) against
    // target[0..31].
    int meets = 1;
    for (int i = 0; i < 32; i++) {
        uchar h = hash[31 - i];   // most-significant-first view of the hash
        uchar t = target[i];
        if (h < t) { meets = 1; break; }
        if (h > t) { meets = 0; break; }
        // h == t: continue to next byte.
    }

    if (meets) {
        // Atomically claim the found flag so only one work-item writes the
        // output hash even if multiple solutions exist in the batch.
        uint old = atomic_xchg(found_flag, 1u);
        if (old == 0u) {
            for (int i = 0; i < 32; i++) output_hash[i] = hash[i];
        }
    }
}
