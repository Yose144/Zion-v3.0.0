// Pearl (PRL) PoUW OpenCL kernel — BLAKE3-based placeholder.
//
// Pearl uses Proof-of-Useful-Work: mining = INT8 matrix multiplication
// + BLAKE3 proof. The full algorithm involves:
//   1. CommitmentHash(A, B, sigma, mu) -> (sA, sB) via BLAKE3 keyed hash
//   2. NoiseGeneration(sA, sB) -> low-rank noise E=EL*ER, F=FL*FR
//   3. NoisedMatMul(A'=A+E, B'=B+F) -> C' + block-opening proof
//   4. XOR-reduce + rotate-and-XOR state update (M[16] array)
//   5. BLAKE3(M, key=sA) < target check
//   6. Noise peeling: A*B = C' - (A*FL)*FR - EL*(ER*B')
//
// This kernel implements a **simplified** BLAKE3-based placeholder:
//   hash = blake3(header_hash || nonce_le)
//
// The full PoUW MatMul kernel will replace this once the Pearl GEMM
// CUDA kernel is ported to OpenCL (Phase 13.3).
//
// Each work-item scans 8 nonces (batched) to amortize launch overhead.
// The kernel uses the same buffer layout as blake3_dcr_mine:
//   0=header, 1=target, 2=nonce, 3=hash, 4=found, 5=hlen, 6=base_nonce

// Blake3 constants
__constant const uint BLAKE3_IV[8] = {
    0x6A09E667u, 0xBB67AE85u, 0x3C6EF372u, 0xA54FF53Au,
    0x510E527Fu, 0x9B05688Cu, 0x1F83D9ABu, 0x5BE0CD19u
};

// Blake3 message schedule (7 rounds)
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

#define G(m, a, b, c, d, x, y) \
    a = a + b + x; \
    d = ROTR32(d ^ a, 16); \
    c = c + d; \
    b = ROTR32(b ^ c, 12); \
    a = a + b + y; \
    d = ROTR32(d ^ a, 8); \
    c = c + d; \
    b = ROTR32(b ^ c, 7);

void blake3_round(uint state[16], const uint msg[16], int round) {
    const uint *s = MSG_SCHEDULE[round];
    G(m, state[0], state[4], state[8],  state[12], msg[s[0]],  msg[s[1]]);
    G(m, state[1], state[5], state[9],  state[13], msg[s[2]],  msg[s[3]]);
    G(m, state[2], state[6], state[10], state[14], msg[s[4]],  msg[s[5]]);
    G(m, state[3], state[7], state[11], state[15], msg[s[6]],  msg[s[7]]);
    G(m, state[0], state[5], state[10], state[15], msg[s[8]],  msg[s[9]]);
    G(m, state[1], state[6], state[11], state[12], msg[s[10]], msg[s[11]]);
    G(m, state[2], state[7], state[8],  state[13], msg[s[12]], msg[s[13]]);
    G(m, state[3], state[4], state[9],  state[14], msg[s[14]], msg[s[15]]);
}

// Blake3 flags
#define CHUNK_START  1u
#define CHUNK_END    2u
#define PARENT       4u
#define ROOT         8u

// Compress a 64-byte block, producing 8 output words.
void blake3_compress8(
    uint chain[8],
    __private const uchar *block,
    uint counter,
    uint block_len,
    uint flags,
    __private uint out[8]
) {
    uint m[16];
    for (int i = 0; i < 16; i++) {
        m[i] = (uint)block[i*4+0]
             | ((uint)block[i*4+1] << 8)
             | ((uint)block[i*4+2] << 16)
             | ((uint)block[i*4+3] << 24);
    }

    uint state[16];
    for (int i = 0; i < 8; i++) state[i] = chain[i];
    state[8]  = BLAKE3_IV[0];
    state[9]  = BLAKE3_IV[1];
    state[10] = BLAKE3_IV[2];
    state[11] = BLAKE3_IV[3];
    state[12] = counter;
    state[13] = block_len;
    state[14] = flags;
    state[15] = 0u;

    for (int r = 0; r < 7; r++) {
        blake3_round(state, m, r);
    }

    for (int i = 0; i < 8; i++) {
        out[i] = state[i] ^ state[i + 8];
    }
}

// Compress a 64-byte block, producing 16 output words (root mode).
void blake3_compress16(
    uint chain[8],
    __private const uchar *block,
    uint counter,
    uint block_len,
    uint flags,
    __private uint out[16]
) {
    uint m[16];
    for (int i = 0; i < 16; i++) {
        m[i] = (uint)block[i*4+0]
             | ((uint)block[i*4+1] << 8)
             | ((uint)block[i*4+2] << 16)
             | ((uint)block[i*4+3] << 24);
    }

    uint state[16];
    for (int i = 0; i < 8; i++) state[i] = chain[i];
    state[8]  = BLAKE3_IV[0];
    state[9]  = BLAKE3_IV[1];
    state[10] = BLAKE3_IV[2];
    state[11] = BLAKE3_IV[3];
    state[12] = counter;
    state[13] = block_len;
    state[14] = flags;
    state[15] = 0u;

    for (int r = 0; r < 7; r++) {
        blake3_round(state, m, r);
    }

    for (int i = 0; i < 16; i++) {
        out[i] = state[i] ^ state[i % 8];
    }
}

// ── Pearl mining kernel (BLAKE3 placeholder) ─────────────────────────
//
// Simplified Pearl hash: blake3(header || nonce_le)
//
// The full PoUW algorithm would:
//   1. Generate matrices A, B from header seed
//   2. Add noise (BLAKE3 PRNG -> low-rank E, F)
//   3. Compute C' = (A+E) * (B+F) via tiled INT8 MatMul
//   4. Extract block-opening proof (XOR-reduce + rotate-and-XOR)
//   5. BLAKE3(proof, key=sA) -> final hash
//
// For now, we use BLAKE3(header || nonce) as a deterministic placeholder.
// This allows Stratum v1 protocol testing and GPU mining while the
// full PoUW MatMul kernel is developed (Phase 13.3).

__attribute__((reqd_work_group_size(256, 1, 1)))
__kernel void pearl_mine(
    __global const uchar *header_blob,
    __global const uchar *target,
    __global ulong *output_nonce,
    __global uchar *output_hash,
    __global volatile uint *found,
    const uint header_len,
    ulong base_nonce
)
{
    // Prefetch target into private memory.
    uchar tgt[32];
    #pragma unroll
    for (int i = 0; i < 32; i++) tgt[i] = target[i];

    // Batch nonce scanning: each work-item scans 8 nonces.
    for (int batch = 0; batch < 8; batch++) {
        if (*found) return;

        ulong nonce = base_nonce + (ulong)get_global_id(0) * 8uL + (ulong)batch;

        // Build input: header || nonce_le (up to 248 bytes)
        uchar buf[248];
        for (int i = 0; i < 248; i++) buf[i] = 0;
        uint copy_len = header_len < 240u ? header_len : 240u;

        // Vectorized header loading
        uint c4 = copy_len / 4u;
        #pragma unroll 8
        for (uint i = 0u; i < c4; i++) {
            uchar4 v = vload4(i, header_blob);
            buf[i * 4 + 0] = v.s0;
            buf[i * 4 + 1] = v.s1;
            buf[i * 4 + 2] = v.s2;
            buf[i * 4 + 3] = v.s3;
        }
        for (uint i = c4 * 4u; i < copy_len; i++) {
            buf[i] = header_blob[i];
        }

        // Append 8-byte little-endian nonce after header
        buf[copy_len + 0] = (uchar)(nonce);
        buf[copy_len + 1] = (uchar)(nonce >> 8);
        buf[copy_len + 2] = (uchar)(nonce >> 16);
        buf[copy_len + 3] = (uchar)(nonce >> 24);
        buf[copy_len + 4] = (uchar)(nonce >> 32);
        buf[copy_len + 5] = (uchar)(nonce >> 40);
        buf[copy_len + 6] = (uchar)(nonce >> 48);
        buf[copy_len + 7] = (uchar)(nonce >> 56);

        const uint total_len = copy_len + 8u;

        // BLAKE3 hash of buf[0..total_len]
        uint chain[8];
        #pragma unroll
        for (int i = 0; i < 8; i++) chain[i] = BLAKE3_IV[i];

        uint full_blocks = total_len / 64u;
        uint tail_len = total_len % 64u;
        if (tail_len == 0u && full_blocks > 0u) {
            tail_len = 64u;
            full_blocks -= 1u;
        }

        for (uint b = 0u; b < full_blocks; b++) {
            uchar block[64];
            int off = (int)(b * 64u);
            #pragma unroll
            for (int i = 0; i < 64; i++) block[i] = buf[off + i];
            uint flags = (b == 0u) ? CHUNK_START : 0u;
            blake3_compress8(chain, block, 0u, 64u, flags, chain);
        }

        // Last/tail block
        {
            uchar block[64];
            int off = (int)(full_blocks * 64u);
            for (int i = 0; i < 64; i++) {
                int idx = off + i;
                block[i] = (idx < (int)total_len) ? buf[idx] : 0;
            }
            uint flags = (full_blocks == 0u) ? (CHUNK_START | CHUNK_END) : CHUNK_END;
            uint out16[16];
            blake3_compress16(chain, block, 0u, tail_len, flags | ROOT, out16);

            // Store hash as little-endian bytes
            uchar hash[32];
            #pragma unroll
            for (int i = 0; i < 8; i++) {
                hash[i * 4 + 0] = (uchar)(out16[i]);
                hash[i * 4 + 1] = (uchar)(out16[i] >> 8);
                hash[i * 4 + 2] = (uchar)(out16[i] >> 16);
                hash[i * 4 + 3] = (uchar)(out16[i] >> 24);
            }

            // Compare hash <= target (big-endian byte comparison)
            int meets = 1;
            for (int i = 0; i < 32; i++) {
                if (hash[i] < tgt[i]) { meets = 1; break; }
                if (hash[i] > tgt[i]) { meets = 0; break; }
            }

            if (meets) {
                uint old = atomic_xchg(found, 1u);
                if (old == 0u) {
                    *output_nonce = nonce;
                    #pragma unroll
                    for (int i = 0; i < 32; i++) output_hash[i] = hash[i];
                }
            }
        }
    }
}
