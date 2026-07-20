// KeryxHash OpenCL kernel for Keryx (KRX) mining.
//
// KeryxHash is a modified kHeavyHash (Kaspa) with two additions:
//   1. KERYX_MATRIX_SALT — 32-byte domain separator XORed into pre_pow_hash
//      before generating the 64×64 matrix (handled host-side; the kernel
//      receives the precomputed matrix just like KAS).
//   2. wave_mix — 4-round ARX (Add-Rotate-XOR) post-processing applied to
//      the 32-byte matrix product BEFORE the final cSHAKE256("HeavyHash")
//      call. This is the only kernel-side change vs kheavyhash_kernel.cl.
//
// Algorithm:
//   1. PowHash   = cSHAKE256("ProofOfWorkHash")(pre_pow_hash ‖ timestamp_le ‖ 32 zero bytes ‖ nonce_le)
//   2. Matrix    = expand PowHash to 64 nibbles, multiply by 64×64 matrix
//                  (4-bit entries, generated host-side from
//                  SHA3-256(pre_pow_hash XOR KERYX_MATRIX_SALT_v4) via
//                  XoShiRo256++, retry until full rank 64),
//                  reduce each sum to bits 10–13, recombine to 32 bytes,
//                  XOR with PowHash.
//   3. wave_mix  = 4-round ARX on the 32-byte product (Keryx-only step).
//   4. HeavyHash = cSHAKE256("HeavyHash")(wave_mix_output)
//
// The cSHAKE customization strings are identical to Kaspa ("ProofOfWorkHash"
// and "HeavyHash") — Keryx forked from Kaspa and kept these domain separators.
//
// ⚠️ MAINNET STATUS (2026-07): Keryx mainnet activated Proof-of-Model (PoM)
// at DAA 37,780,000 (2026-06-26) and made pomFinalState mandatory at H3
// (DAA 43,450,000, 2026-07-05). Pure KeryxHash blocks are rejected by the
// network. This kernel is kept for testnet/future/research use and mirrors
// the pre-PoM keryx-miner OpenCL plugin (plugins/opencl/resources/keryx-opencl.cl).
//
// References:
//   - keryx-miner: https://github.com/keryx-labs/keryx-miner
//   - keryx-stratum-bridge keryx_hash.go (canonical salt + wave_mix constants)
//   - keryx-miner src/pow/heavy_hash.rs (Rust CPU reference)
//   - AuXpow/src/external_hashers.rs (hash_keryxhash)
//   - NIST SP 800-185 (cSHAKE)

// ── Keccak-f[1600] ───────────────────────────────────────────────────

__constant const ulong KECCAK_RC[24] = {
    0x0000000000000001UL, 0x0000000000008082UL, 0x800000000000808aUL,
    0x8000000080008000UL, 0x000000000000808bUL, 0x0000000080000001UL,
    0x8000000080008081UL, 0x8000000000008009UL, 0x000000000000008aUL,
    0x0000000000000088UL, 0x0000000080008009UL, 0x000000008000000aUL,
    0x000000008000808bUL, 0x800000000000008bUL, 0x8000000000008089UL,
    0x8000000000008003UL, 0x8000000000008002UL, 0x8000000000000080UL,
    0x000000000000800aUL, 0x800000008000000aUL, 0x8000000080008081UL,
    0x8000000000008080UL, 0x0000000080000001UL, 0x8000000080008008UL
};

__constant const uint KECCAK_RHO[24] = {
    1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 2, 14, 27, 41, 56, 8, 25, 43, 62, 18, 39, 61, 20, 44
};

__constant const int KECCAK_PI[24] = {
    10, 7, 11, 17, 18, 3, 5, 16, 8, 21, 24, 4, 15, 23, 19, 13, 12, 2, 20, 14, 22, 9, 6, 1
};

#define ROTL64(x, n) (((x) << (n)) | ((x) >> (64 - (n))))

void keccak_f1600(ulong state[25]) {
    for (int round = 0; round < 24; round++) {
        ulong c[5], d[5];
        for (int x = 0; x < 5; x++)
            c[x] = state[x] ^ state[x+5] ^ state[x+10] ^ state[x+15] ^ state[x+20];
        for (int x = 0; x < 5; x++)
            d[x] = c[(x+4)%5] ^ ROTL64(c[(x+1)%5], 1);
        for (int i = 0; i < 25; i++)
            state[i] ^= d[i%5];

        ulong temp = state[1];
        for (int t = 0; t < 24; t++) {
            int idx = KECCAK_PI[t];
            ulong tmp2 = state[idx];
            state[idx] = ROTL64(temp, KECCAK_RHO[t]);
            temp = tmp2;
        }

        for (int y = 0; y < 5; y++) {
            ulong row[5];
            for (int x = 0; x < 5; x++) row[x] = state[y*5+x];
            for (int x = 0; x < 5; x++)
                state[y*5+x] = row[x] ^ ((~row[(x+1)%5]) & row[(x+2)%5]);
        }

        state[0] ^= KECCAK_RC[round];
    }
}

// ── SHA3-256 / cSHAKE256 ─────────────────────────────────────────────
// Same construction as kheavyhash_kernel.cl — Keryx inherited Kaspa's
// "ProofOfWorkHash" and "HeavyHash" customization strings verbatim.

inline void keccak_absorb_block(ulong state[25], const uchar *block) {
    for (int i = 0; i < 17; i++) {
        ulong lane = 0;
        for (int j = 0; j < 8; j++)
            lane |= ((ulong)block[i*8 + j]) << (j*8);
        state[i] ^= lane;
    }
}

void cshake256_custom(
    const uchar *input,
    const uint input_len,
    __constant const uchar *custom,
    const uint custom_len,
    uchar *output
) {
    ulong state[25];
    for (int i = 0; i < 25; i++) state[i] = 0;

    uchar prefix[136];
    for (int i = 0; i < 136; i++) prefix[i] = 0;
    uint pos = 0;

    prefix[pos++] = 0x01;
    prefix[pos++] = 0x88;

    prefix[pos++] = 0x01;
    prefix[pos++] = 0x00;

    uint custom_bitlen = custom_len * 8;
    if (custom_bitlen < 256) {
        prefix[pos++] = 0x01;
        prefix[pos++] = (uchar)custom_bitlen;
    } else {
        prefix[pos++] = 0x02;
        prefix[pos++] = (uchar)(custom_bitlen >> 8);
        prefix[pos++] = (uchar)(custom_bitlen & 0xFF);
    }
    for (uint i = 0; i < custom_len; i++)
        prefix[pos++] = custom[i];

    keccak_absorb_block(state, prefix);
    keccak_f1600(state);

    uchar data_block[136];
    for (int i = 0; i < 136; i++) data_block[i] = 0;
    for (uint i = 0; i < input_len; i++)
        data_block[i] = input[i];
    data_block[input_len] = 0x04;
    data_block[135] |= 0x80;

    keccak_absorb_block(state, data_block);
    keccak_f1600(state);

    for (int i = 0; i < 4; i++) {
        for (int j = 0; j < 8; j++)
            output[i*8 + j] = (uchar)(state[i] >> (j*8));
    }
}

__constant const uchar CUSTOM_POW_HASH[] = {
    'P', 'r', 'o', 'o', 'f', 'O', 'f', 'W', 'o', 'r', 'k', 'H', 'a', 's', 'h'
};
__constant const uint CUSTOM_POW_HASH_LEN = 15;

__constant const uchar CUSTOM_HEAVY_HASH[] = {
    'H', 'e', 'a', 'v', 'y', 'H', 'a', 's', 'h'
};
__constant const uint CUSTOM_HEAVY_HASH_LEN = 9;

// ── Keryx wave_mix ───────────────────────────────────────────────────
// 4-round ARX post-processing applied to the 32-byte matrix product
// BEFORE the final cSHAKE256("HeavyHash") call. This is the only kernel-
// side difference from kheavyhash_kernel.cl.
//
// Round constants (consensus-critical — changing them = hard fork):
//   WAVE_MIX_KEYS[0] = 0x9e3779b97f4a7c15  (fractional bits of φ)
//   WAVE_MIX_KEYS[1] = 0x6c62272e07bb0142  (Keryx network discriminator)
//   WAVE_MIX_KEYS[2] = 0xb5ad4eceda1ce2a9  (fractional bits of √3)
//   WAVE_MIX_KEYS[3] = 0x243f6a8885a308d3  (fractional bits of π)
// Rotation schedule: [17, 31, 47, 13]  (coprime to 64, no fixed-point cycles)
//
// Reference: keryx-miner src/pow/heavy_hash.rs::wave_mix()
//            keryx-miner plugins/opencl/resources/keryx-opencl.cl::wave_mix_hash()

__constant const ulong WAVE_MIX_KEYS[4] = {
    0x9e3779b97f4a7c15UL,
    0x6c62272e07bb0142UL,
    0xb5ad4eceda1ce2a9UL,
    0x243f6a8885a308d3UL,
};

// Apply 4 rounds of ARX to the 32-byte buffer in place.
// Operates on 4 little-endian 64-bit words.
inline void wave_mix(uchar *buf) {
    ulong w0 = ((ulong)buf[0])       | ((ulong)buf[1]  << 8) | ((ulong)buf[2]  << 16) | ((ulong)buf[3]  << 24)
             | ((ulong)buf[4]  << 32) | ((ulong)buf[5]  << 40) | ((ulong)buf[6]  << 48) | ((ulong)buf[7]  << 56);
    ulong w1 = ((ulong)buf[8])       | ((ulong)buf[9]  << 8) | ((ulong)buf[10] << 16) | ((ulong)buf[11] << 24)
             | ((ulong)buf[12] << 32) | ((ulong)buf[13] << 40) | ((ulong)buf[14] << 48) | ((ulong)buf[15] << 56);
    ulong w2 = ((ulong)buf[16])      | ((ulong)buf[17] << 8) | ((ulong)buf[18] << 16) | ((ulong)buf[19] << 24)
             | ((ulong)buf[20] << 32) | ((ulong)buf[21] << 40) | ((ulong)buf[22] << 48) | ((ulong)buf[23] << 56);
    ulong w3 = ((ulong)buf[24])      | ((ulong)buf[25] << 8) | ((ulong)buf[26] << 16) | ((ulong)buf[27] << 24)
             | ((ulong)buf[28] << 32) | ((ulong)buf[29] << 40) | ((ulong)buf[30] << 48) | ((ulong)buf[31] << 56);

    #pragma unroll
    for (int r = 0; r < 4; r++) {
        // Step A — vertical pairs (w0,w1) and (w2,w3) are independent
        // and can be issued in parallel by a GPU warp.
        w0 = ROTL64(w0 + w1, 17) ^ WAVE_MIX_KEYS[r & 3];
        w2 = ROTL64(w2 + w3, 47) ^ WAVE_MIX_KEYS[(r + 2) & 3];
        // Step B — diagonal pairs: cross-pollinate all 256 bits.
        w1 = ROTL64(w1 + w2, 31) ^ WAVE_MIX_KEYS[(r + 1) & 3];
        w3 = ROTL64(w3 + w0, 13) ^ WAVE_MIX_KEYS[(r + 3) & 3];
    }

    for (int i = 0; i < 8; i++) buf[i]      = (uchar)(w0 >> (i * 8));
    for (int i = 0; i < 8; i++) buf[8  + i] = (uchar)(w1 >> (i * 8));
    for (int i = 0; i < 8; i++) buf[16 + i] = (uchar)(w2 >> (i * 8));
    for (int i = 0; i < 8; i++) buf[24 + i] = (uchar)(w3 >> (i * 8));
}

// ── Mining kernel ────────────────────────────────────────────────────
//
// Kernel arguments (identical to kheavyhash_mine — only the matrix
// generation on the host differs, plus wave_mix is applied in-kernel):
//   pre_pow_hash  — 32-byte pre-pow hash from mining.notify
//   timestamp     — block timestamp (little-endian u64)
//   target        — 32-byte target (big-endian byte comparison)
//   base_nonce    — first nonce in this batch
//   matrix        — 64×64 u16 matrix (4096 values = 8192 bytes), generated
//                   on the host from SHA3-256(pre_pow_hash XOR KERYX_SALT_v4)
//                   via XoShiRo256++, retry until full rank 64.
//   output_nonce  — single u64, written when a solution is found
//   output_hash   — 32-byte hash of the winning nonce
//   found         — atomic flag: 0 = not found, 1 = found
//
// Optimizations (inherited from kheavyhash_kernel.cl):
//   1. Batch nonce scanning — each work-item scans 8 nonces
//   2. reqd_work_group_size(256, 1, 1) hint for occupancy tuning
//   3. Early exit — *found check at top of each batch iteration
//   4. Matrix in __local memory — copied once per work-group
//   5. Vectorized XOR — ulong4 vload4/vstore4 for product^=pow_hash
//   6. Prefetched header — pre_pow_hash loaded to private memory once
__kernel __attribute__((reqd_work_group_size(256, 1, 1)))
void keryxhash_mine(
    __global const uchar *pre_pow_hash,
    const ulong timestamp,
    __global const uchar *target,
    ulong base_nonce,
    __global const ushort *matrix,
    __global ulong *output_nonce,
    __global uchar *output_hash,
    __global volatile uint *found
)
{
    uchar hdr[32];
    for (int i = 0; i < 32; i++) hdr[i] = pre_pow_hash[i];

    uchar tgt[32];
    for (int i = 0; i < 32; i++) tgt[i] = target[i];

    __local ushort lmatrix[4096];
    {
        uint lid = get_local_id(0);
        for (int i = 0; i < 16; i++) {
            uint idx = lid * 16 + i;
            lmatrix[idx] = matrix[idx];
        }
    }
    barrier(CLK_LOCAL_MEM_FENCE);

    for (int batch = 0; batch < 8; batch++) {
        if (*found) return;

        ulong nonce = base_nonce + (ulong)get_global_id(0) * 8 + (ulong)batch;

        // Step 1: PowHash = cSHAKE256("ProofOfWorkHash")(pre_pow_hash ‖ timestamp_le ‖ 32 zero bytes ‖ nonce_le)
        uchar pow_input[80];
        for (int i = 0; i < 32; i++) pow_input[i] = hdr[i];
        for (int i = 0; i < 8; i++) pow_input[32 + i] = (uchar)(timestamp >> (i * 8));
        for (int i = 0; i < 32; i++) pow_input[40 + i] = 0;
        for (int i = 0; i < 8; i++) pow_input[72 + i] = (uchar)(nonce >> (i * 8));

        uchar pow_hash[32];
        cshake256_custom(pow_input, 80, CUSTOM_POW_HASH, CUSTOM_POW_HASH_LEN, pow_hash);

        // Step 2: Matrix multiply (identical to KAS)
        uchar vec[64];
        for (int i = 0; i < 32; i++) {
            vec[2 * i]     = pow_hash[i] >> 4;
            vec[2 * i + 1] = pow_hash[i] & 0x0F;
        }

        uchar product[32];
        for (int i = 0; i < 32; i++) {
            uint sum1 = 0;
            uint sum2 = 0;
            for (int j = 0; j < 64; j++) {
                sum1 += (uint)lmatrix[(2 * i) * 64 + j]     * (uint)vec[j];
                sum2 += (uint)lmatrix[(2 * i + 1) * 64 + j] * (uint)vec[j];
            }
            product[i] = (uchar)(((sum1 >> 10) << 4) | (sum2 >> 10));
        }

        // Vectorized XOR: product ^= pow_hash
        ulong4 pv = vload4(0, (const __private ulong *)product);
        ulong4 hv = vload4(0, (const __private ulong *)pow_hash);
        pv ^= hv;
        vstore4(pv, 0, (__private ulong *)product);

        // Step 3 (Keryx-only): wave_mix ARX post-processing
        wave_mix(product);

        // Step 4: HeavyHash = cSHAKE256("HeavyHash")(wave_mix output)
        uchar hash[32];
        cshake256_custom(product, 32, CUSTOM_HEAVY_HASH, CUSTOM_HEAVY_HASH_LEN, hash);

        // Step 5: Check target (big-endian byte comparison: hash <= target)
        int meets = 1;
        for (int i = 0; i < 32; i++) {
            if (hash[i] < tgt[i]) { meets = 1; break; }
            if (hash[i] > tgt[i]) { meets = 0; break; }
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
