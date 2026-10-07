/*
 * ============================================================================
 *  ZION Autolykos v2 — OpenCL mining kernel (Ergo consensus-exact)
 * ============================================================================
 *
 *  Implements the real Autolykos v2 puzzle per ergoplatform/ergo
 *  `AutolykosPowScheme.hitForVersion2ForMessage`:
 *
 *      M     = 8192 bytes: concat of i64-BE for i in 0..1024
 *      T[j]  = Blake2b256(j_BE4 || height_BE4 || M)           (32-byte digest)
 *      elem  = T[j].drop(1)                                   (31-byte bigint)
 *
 *      h1    = Blake2b256(msg || nonce_BE8)
 *      i0    = BE64(h1[24..32]) mod N
 *      f31   = elem(T[i0])                                    (31 bytes)
 *      h32   = Blake2b256(f31 || msg || nonce_BE8)
 *      ext   = h32 || h32[0..3]                               (35 bytes)
 *      idx[k]= BE32(ext[k..k+4]) mod N      for k in 0..32
 *      sum   = Σ elem(T[idx[k]])            (32-byte BE, mod 2^256)
 *      out   = Blake2b256(sum)  →  hit;  share iff out <= target (BE)
 *
 *  Table generation runs on GPU (`autolykos_gen_table`): one work-item per
 *  table entry, streaming Blake2b over the 8200-byte input.
 *
 *  The mine kernel checks 4 nonces per work-item.
 * ============================================================================
 */

#ifndef AUTOLYKOS_KERNEL_CL
#define AUTOLYKOS_KERNEL_CL

#define ROTR64(x, n) (((x) >> (n)) | ((x) << (64 - (n))))

// BLAKE2b initialization vector (RFC 7693), little-endian 64-bit words.
__constant const ulong BLAKE2B_IV[8] = {
    0x6a09e667f3bcc908UL, 0xbb67ae8584caa73bUL,
    0x3c6ef372fe94f82bUL, 0xa54ff53a5f1d36f1UL,
    0x510e527fade682d1UL, 0x9b05688c2b3e6c1fUL,
    0x1f83d9abfb41bd6bUL, 0x5be0cd19137e2179UL
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
//   h    — 8-word chaining state (modified in place)
//   m    — 16 message words (little-endian u64), pre-loaded by caller
//   t    — 64-bit total byte counter
//   last — nonzero if this is the final block
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

    v[12] ^= t;
    v[13] ^= 0UL;
    if (last) v[14] ^= 0xFFFFFFFFFFFFFFFFUL;

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

inline void blake2b_init(ulong h[8]) {
    h[0] = BLAKE2B_IV[0] ^ 0x01010020UL;  // digest=32, key=0, fanout=1, depth=1
    h[1] = BLAKE2B_IV[1];
    h[2] = BLAKE2B_IV[2];
    h[3] = BLAKE2B_IV[3];
    h[4] = BLAKE2B_IV[4];
    h[5] = BLAKE2B_IV[5];
    h[6] = BLAKE2B_IV[6];
    h[7] = BLAKE2B_IV[7];
}

inline void blake2b_store(ulong h[8], uchar *output) {
    for (int i = 0; i < 4; i++)
        for (int j = 0; j < 8; j++)
            output[i * 8 + j] = (uchar)(h[i] >> (j * 8));
}

// BLAKE2b-256 of up to 256 bytes held in private memory (1-2 blocks).
inline void blake2b256_short(
    __private const uchar *input,
    const uint input_len,
    uchar *output
) {
    ulong h[8];
    blake2b_init(h);

    uchar block[128];
    for (int i = 0; i < 128; i++) block[i] = 0;

    if (input_len <= 128) {
        for (uint i = 0; i < input_len; i++) block[i] = input[i];
        ulong m[16];
        blake2b_load_message(m, block);
        blake2b_compress_unrolled(h, m, (ulong)input_len, 1u);
    } else {
        for (int i = 0; i < 128; i++) block[i] = input[i];
        ulong m[16];
        blake2b_load_message(m, block);
        blake2b_compress_unrolled(h, m, 128UL, 0u);

        uint rem = input_len - 128;
        for (int i = 0; i < 128; i++) block[i] = 0;
        for (uint i = 0; i < rem; i++) block[i] = input[128 + i];
        blake2b_load_message(m, block);
        blake2b_compress_unrolled(h, m, (ulong)input_len, 1u);
    }

    blake2b_store(h, output);
}

// ── Table generation kernel ──────────────────────────────────────────
//
// T[gid] = Blake2b256(gid_BE4 || height_BE4 || M)
// Input length = 4 + 4 + 8192 = 8200 bytes = 65 blocks.
// Table entries are the full 32-byte digests; the mine kernel drops
// byte 0 to obtain the 31-byte element.
//
// Args: table(N*32B out), M(8192B), height(BE in input), N
__kernel void autolykos_gen_table(
    __global uchar *table,
    __global const uchar *M,
    const uint height,
    const uint N
) {
    const uint gid = get_global_id(0);
    if (gid >= N) return;

    ulong h[8];
    blake2b_init(h);

    ulong m[16];
    __private uchar block[128];

    // Block 0: gid_BE4 || height_BE4 || M[0..120]
    block[0] = (uchar)(gid >> 24);
    block[1] = (uchar)(gid >> 16);
    block[2] = (uchar)(gid >> 8);
    block[3] = (uchar)(gid);
    block[4] = (uchar)(height >> 24);
    block[5] = (uchar)(height >> 16);
    block[6] = (uchar)(height >> 8);
    block[7] = (uchar)(height);
    for (int i = 8; i < 128; i++) block[i] = M[i - 8];
    blake2b_load_message(m, block);
    blake2b_compress_unrolled(h, m, 128UL, 0u);

    // Blocks 1..63: M[120 + (b-1)*128 .. +128]
    for (int b = 1; b < 64; b++) {
        const uint off = 120u + (uint)(b - 1) * 128u;
        for (int i = 0; i < 128; i++) block[i] = M[off + i];
        blake2b_load_message(m, block);
        blake2b_compress_unrolled(h, m, (ulong)(128 + b * 128), 0u);
    }

    // Block 64 (last): M[8184..8192] = 8 bytes + zero padding
    for (int i = 0; i < 128; i++) block[i] = 0;
    for (int i = 0; i < 8; i++) block[i] = M[8184 + i];
    blake2b_load_message(m, block);
    blake2b_compress_unrolled(h, m, 8200UL, 1u);

    uchar digest[32];
    blake2b_store(h, digest);
    for (int i = 0; i < 32; i++) table[(ulong)gid * 32 + i] = digest[i];
}

// ── Mining kernel ────────────────────────────────────────────────────
//
// Args (bound by host in this order):
//   header       — msg bytes (pool notify params), up to ~96 bytes
//   header_len   — length of header
//   base_nonce   — first nonce in this batch
//   table        — N × 32-byte digests (autolykos_gen_table output)
//   N            — table size
//   output_nonce — single u64, written when a solution is found
//   output_hash  — 32-byte Blake2b256(sum) for the winning nonce
//   found        — atomic flag
//   target       — 32-byte big-endian target
//
// Each work-item tests 4 nonces: base_nonce + gid*4 + b.
__kernel __attribute__((reqd_work_group_size(128, 1, 1)))
void autolykos_mine(
    __global const uchar *header,
    const uint header_len,
    const ulong base_nonce,
    __global const uchar *table,
    const uint N,
    __global ulong *output_nonce,
    __global uchar *output_hash,
    __global volatile uint *found,
    __global const uchar *target
) {
    if (*found) return;

    uint hlen = header_len;
    if (hlen > 96) hlen = 96;

    const ulong mask = (ulong)N - 1UL;
    const uint pow2 = ((N & (N - 1u)) == 0u) ? 1u : 0u;

    for (int batch = 0; batch < 4; batch++) {
        if (*found) return;

        const ulong nonce = base_nonce + (ulong)get_global_id(0) * 4 + (ulong)batch;

        // nonce_BE8
        uchar nonce_be[8];
        for (int i = 0; i < 8; i++)
            nonce_be[i] = (uchar)(nonce >> ((7 - i) * 8));

        // ── 1) h1 = b2b256(msg || nonce_BE8); i0 = BE64(h1[24..32]) % N ──
        uchar buf[256];
        for (uint i = 0; i < hlen; i++) buf[i] = header[i];
        for (int i = 0; i < 8; i++) buf[hlen + i] = nonce_be[i];
        uchar h1[32];
        blake2b256_short(buf, hlen + 8, h1);

        ulong prei8 = 0;
        for (int i = 24; i < 32; i++) prei8 = (prei8 << 8) | h1[i];
        ulong i0 = pow2 ? (prei8 & mask) : (prei8 % (ulong)N);

        // ── 2) f31 = table[i0][1..32] ──
        __global const uchar *t0 = table + i0 * 32;
        uchar f31[31];
        for (int i = 0; i < 31; i++) f31[i] = t0[1 + i];

        // ── 3) h32 = b2b256(f31 || msg || nonce_BE8) ──
        uint sl = 0;
        for (int i = 0; i < 31; i++) buf[sl++] = f31[i];
        for (uint i = 0; i < hlen; i++) buf[sl++] = header[i];
        for (int i = 0; i < 8; i++) buf[sl++] = nonce_be[i];
        uchar h32[32];
        blake2b256_short(buf, sl, h32);

        // ── 4) ext = h32 || h32[0..3]; idx[k] = BE32(ext[k..]) % N ──
        uchar ext[35];
        for (int i = 0; i < 32; i++) ext[i] = h32[i];
        for (int i = 0; i < 3; i++) ext[32 + i] = h32[i];

        // ── 5) sum = Σ elem(table[idx[k]]) mod 2^256 (32B BE) ──
        uchar sum[32];
        for (int i = 0; i < 32; i++) sum[i] = 0;

        for (int k = 0; k < 32; k++) {
            uint raw = ((uint)ext[k] << 24) | ((uint)ext[k + 1] << 16)
                     | ((uint)ext[k + 2] << 8) | (uint)ext[k + 3];
            uint idx = pow2 ? (raw & (uint)mask) : (raw % N);
            __global const uchar *e = table + (ulong)idx * 32;

            // add e[1..32] (31 bytes) into sum[1..32], carry into sum[0]
            uint carry = 0;
            for (int i = 31; i >= 1; i--) {
                uint s = (uint)sum[i] + (uint)e[i] + carry;
                sum[i] = (uchar)(s & 0xFF);
                carry = s >> 8;
            }
            sum[0] += (uchar)carry;
        }

        // ── 6) out = b2b256(sum); hit check ──
        uchar out[32];
        blake2b256_short(sum, 32, out);

        int meets = 1;
        for (int i = 0; i < 32; i++) {
            if (out[i] < target[i]) { meets = 1; break; }
            if (out[i] > target[i]) { meets = 0; break; }
        }

        if (meets) {
            uint old = atomic_xchg(found, 1u);
            if (old == 0u) {
                *output_nonce = nonce;
                for (int i = 0; i < 32; i++) output_hash[i] = out[i];
            }
        }
    }
}

#endif // AUTOLYKOS_KERNEL_CL
