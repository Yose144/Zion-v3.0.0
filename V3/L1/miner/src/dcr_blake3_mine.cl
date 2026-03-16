/*
 * ZION DCR Mining — Blake3 GPU Kernel (OpenCL)
 *
 * Standalone Blake3 hash kernel for DCR PoW (DCP-0011).
 * Extracts Blake3 compression from cosmic_harmony_deeksha.cl.
 *
 * Optimization: Host precomputes chaining value (CV) through first 2 blocks
 * (bytes 0-127). GPU only processes the 52-byte tail per nonce.
 *
 * Author: ZION AI Native Team
 * Version: 3.0.0
 */

/* ========================================================================== */
/* Blake3 Constants                                                            */
/* ========================================================================== */

__constant uint BLAKE3_IV[8] = {
    0x6A09E667u, 0xBB67AE85u, 0x3C6EF372u, 0xA54FF53Au,
    0x510E527Fu, 0x9B05688Cu, 0x1F83D9ABu, 0x5BE0CD19u
};

__constant uchar BLAKE3_MSG_PERM[16] = {
    2, 6, 3, 10, 7, 0, 4, 13, 1, 11, 12, 5, 9, 14, 15, 8
};

#define BLAKE3_CHUNK_START 1u
#define BLAKE3_CHUNK_END   2u
#define BLAKE3_ROOT        8u

/* ========================================================================== */
/* Blake3 Compression Function                                                 */
/* ========================================================================== */

inline uint b3_rotr32(uint x, int n) {
    return (x >> n) | (x << (32 - n));
}

void b3_g(uint *st, int a, int b, int c, int d, uint mx, uint my) {
    st[a] = st[a] + st[b] + mx;
    st[d] = b3_rotr32(st[d] ^ st[a], 16);
    st[c] = st[c] + st[d];
    st[b] = b3_rotr32(st[b] ^ st[c], 12);
    st[a] = st[a] + st[b] + my;
    st[d] = b3_rotr32(st[d] ^ st[a], 8);
    st[c] = st[c] + st[d];
    st[b] = b3_rotr32(st[b] ^ st[c], 7);
}

void b3_round(uint *st, const uint *msg) {
    b3_g(st, 0, 4,  8, 12, msg[0],  msg[1]);
    b3_g(st, 1, 5,  9, 13, msg[2],  msg[3]);
    b3_g(st, 2, 6, 10, 14, msg[4],  msg[5]);
    b3_g(st, 3, 7, 11, 15, msg[6],  msg[7]);
    b3_g(st, 0, 5, 10, 15, msg[8],  msg[9]);
    b3_g(st, 1, 6, 11, 12, msg[10], msg[11]);
    b3_g(st, 2, 7,  8, 13, msg[12], msg[13]);
    b3_g(st, 3, 4,  9, 14, msg[14], msg[15]);
}

void b3_permute(uint msg[16]) {
    uint tmp[16];
    for (int i = 0; i < 16; i++) tmp[i] = msg[BLAKE3_MSG_PERM[i]];
    for (int i = 0; i < 16; i++) msg[i] = tmp[i];
}

void b3_compress(const uint cv[8], const uint bw[16],
                 ulong counter, uint block_len, uint flags,
                 uint output[16])
{
    uint st[16] = {
        cv[0], cv[1], cv[2], cv[3],
        cv[4], cv[5], cv[6], cv[7],
        BLAKE3_IV[0], BLAKE3_IV[1], BLAKE3_IV[2], BLAKE3_IV[3],
        (uint)(counter & 0xFFFFFFFFu),
        (uint)(counter >> 32),
        block_len,
        flags
    };
    uint msg[16];
    for (int i = 0; i < 16; i++) msg[i] = bw[i];
    for (int i = 0; i < 7; i++) {
        b3_round(st, msg);
        b3_permute(msg);
    }
    for (int i = 0; i < 16; i++) output[i] = st[i];
}

/* ========================================================================== */
/* Byte-swap for big-endian target comparison                                  */
/* ========================================================================== */

inline uint bswap32(uint x) {
    return ((x >> 24) & 0xFFu) |
           ((x >> 8)  & 0xFF00u) |
           ((x << 8)  & 0xFF0000u) |
           ((x << 24) & 0xFF000000u);
}

/* ========================================================================== */
/* Main Mining Kernel                                                          */
/*                                                                             */
/* Each work-item hashes one nonce. The host precomputes the CV after the      */
/* first 128 bytes (2 compression blocks). The kernel only processes the       */
/* 52-byte tail (block 2) and does root finalization.                          */
/*                                                                             */
/* Args:                                                                       */
/*   precomputed_cv  — 8 uint: chaining value after first 2 blocks            */
/*   tail_base       — 52 bytes: header[128..180] template                    */
/*   target_be       — 8 uint: target in big-endian word order                */
/*   nonce_start     — starting nonce for this batch                          */
/*   results         — output buffer: [0]=count, [1..]=found nonces           */
/*   max_results     — max nonces to report                                   */
/* ========================================================================== */

__kernel void dcr_blake3_mine(
    __global const uint *precomputed_cv,
    __global const uchar *tail_base,
    __global const uint *target_be,
    uint nonce_start,
    __global volatile uint *results,
    uint max_results)
{
    uint gid = get_global_id(0);
    uint nonce = nonce_start + gid;

    /* Copy tail to private memory and write nonce at offset 12 (= NONCE_OFFSET - 128) */
    uchar tail[52];
    for (int i = 0; i < 52; i++) tail[i] = tail_base[i];
    tail[12] = (uchar)(nonce);
    tail[13] = (uchar)(nonce >> 8);
    tail[14] = (uchar)(nonce >> 16);
    tail[15] = (uchar)(nonce >> 24);

    /* Load tail as block words (little-endian uint32) */
    uint bw[16];
    for (int i = 0; i < 13; i++) {
        int off = i * 4;
        bw[i] = (uint)tail[off] |
                ((uint)tail[off + 1] << 8) |
                ((uint)tail[off + 2] << 16) |
                ((uint)tail[off + 3] << 24);
    }
    for (int i = 13; i < 16; i++) bw[i] = 0;

    /* Load precomputed CV */
    uint cv[8];
    for (int i = 0; i < 8; i++) cv[i] = precomputed_cv[i];

    /* Root compression: counter=0, len=52, flags=CHUNK_END|ROOT */
    uint st[16];
    b3_compress(cv, bw, 0, 52, BLAKE3_CHUNK_END | BLAKE3_ROOT, st);

    /* Root hash = XOR of upper and lower halves of compress state.
     * Compare to target (big-endian 256-bit comparison).
     * Hash bytes are LE uint words: hash_word[i] = st[i] ^ st[i+8].
     * Convert each word to BE for comparison with target_be. */
    for (int i = 0; i < 8; i++) {
        uint h_be = bswap32(st[i] ^ st[i + 8]);
        uint t_be = target_be[i];
        if (h_be < t_be) {
            /* Hash < target → found! */
            uint idx = atomic_inc(&results[0]);
            if (idx < max_results) {
                results[1 + idx] = nonce;
            }
            return;
        }
        if (h_be > t_be) {
            return;  /* hash > target → fail */
        }
        /* equal → continue to next word */
    }
    /* All words equal → hash == target → accept */
    uint idx = atomic_inc(&results[0]);
    if (idx < max_results) {
        results[1 + idx] = nonce;
    }
}
