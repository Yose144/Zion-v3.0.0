// KeryxHash Metal kernel for Keryx (KRX) mining.
//
// KeryxHash = kHeavyHash (Kaspa) + 2 modifications:
//   1. KERYX_MATRIX_SALT — 32-byte domain separator XORed into pre_pow_hash
//      before generating the 64x64 matrix (handled host-side; the kernel
//      receives the precomputed matrix just like KAS).
//   2. wave_mix — 4-round ARX post-processing applied to the 32-byte matrix
//      product BEFORE the final cSHAKE256("HeavyHash") call. This is the
//      only kernel-side change vs kheavyhash_kernel.metal.
//
// Algorithm:
//   1. PowHash   = cSHAKE256("ProofOfWorkHash")(pre_pow_hash || timestamp_le || 32 zero bytes || nonce_le)
//   2. Matrix    = expand PowHash to 64 nibbles, multiply by 64x64 matrix
//                  (4-bit entries, generated host-side from
//                  SHA3-256(pre_pow_hash XOR KERYX_MATRIX_SALT_v4) via
//                  XoShiRo256++, retry until full rank 64),
//                  reduce each sum to bits 10-13, recombine to 32 bytes,
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
// network. This kernel is kept for testnet/future/research use.
//
// References:
//   - keryx-miner: https://github.com/keryx-labs/keryx-miner
//   - keryx-miner src/pow/heavy_hash.rs (Rust CPU reference)
//   - AuXpow/src/external_hashers.rs (hash_keryxhash)
//   - NIST SP 800-185 (cSHAKE)
//
// Translated from opencl/keryxhash_kernel.cl.

#include <metal_stdlib>
using namespace metal;

// -- Keccak-f[1600] ---------------------------------------------------

constant const ulong KECCAK_RC[24] = {
    0x0000000000000001UL, 0x0000000000008082UL, 0x800000000000808aUL,
    0x8000000080008000UL, 0x000000000000808bUL, 0x0000000080000001UL,
    0x8000000080008081UL, 0x8000000000008009UL, 0x000000000000008aUL,
    0x0000000000000088UL, 0x0000000080008009UL, 0x000000008000000aUL,
    0x000000008000808bUL, 0x800000000000008bUL, 0x8000000000008089UL,
    0x8000000000008003UL, 0x8000000000008002UL, 0x8000000000000080UL,
    0x000000000000800aUL, 0x800000008000000aUL, 0x8000000080008081UL,
    0x8000000000008080UL, 0x0000000080000001UL, 0x8000000080008008UL
};

constant const uint KECCAK_RHO[24] = {
    1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 2, 14, 27, 41, 56, 8, 25, 43, 62, 18, 39, 61, 20, 44
};

constant const int KECCAK_PI[24] = {
    10, 7, 11, 17, 18, 3, 5, 16, 8, 21, 24, 4, 15, 23, 19, 13, 12, 2, 20, 14, 22, 9, 6, 1
};

#define ROTL64(x, n) (((x) << (n)) | ((x) >> (64 - (n))))

void keccak_f1600(thread ulong state[25]) {
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

// -- SHA3-256 / cSHAKE256 (identical to kheavyhash_kernel.metal) --

inline void keccak_absorb_block(thread ulong state[25], thread const uchar *block) {
    for (int i = 0; i < 17; i++) {
        ulong lane = 0;
        for (int j = 0; j < 8; j++)
            lane |= ((ulong)block[i*8 + j]) << (j*8);
        state[i] ^= lane;
    }
}

void cshake256_custom(
    thread const uchar *input,
    const uint input_len,
    constant const uchar *custom,
    const uint custom_len,
    thread uchar *output
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

constant const uchar CUSTOM_POW_HASH[] = {
    'P', 'r', 'o', 'o', 'f', 'O', 'f', 'W', 'o', 'r', 'k', 'H', 'a', 's', 'h'
};
constant const uint CUSTOM_POW_HASH_LEN = 15;

constant const uchar CUSTOM_HEAVY_HASH[] = {
    'H', 'e', 'a', 'v', 'y', 'H', 'a', 's', 'h'
};
constant const uint CUSTOM_HEAVY_HASH_LEN = 9;

// -- Keryx wave_mix (only kernel-side difference from kheavyhash_kernel.metal) --

constant const ulong WAVE_MIX_KEYS[4] = {
    0x9e3779b97f4a7c15UL,
    0x6c62272e07bb0142UL,
    0xb5ad4eceda1ce2a9UL,
    0x243f6a8885a308d3UL,
};

inline void wave_mix(thread uchar *buf) {
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
        w0 = ROTL64(w0 + w1, 17) ^ WAVE_MIX_KEYS[r & 3];
        w2 = ROTL64(w2 + w3, 47) ^ WAVE_MIX_KEYS[(r + 2) & 3];
        w1 = ROTL64(w1 + w2, 31) ^ WAVE_MIX_KEYS[(r + 1) & 3];
        w3 = ROTL64(w3 + w0, 13) ^ WAVE_MIX_KEYS[(r + 3) & 3];
    }

    for (int i = 0; i < 8; i++) buf[i]      = (uchar)(w0 >> (i * 8));
    for (int i = 0; i < 8; i++) buf[8  + i] = (uchar)(w1 >> (i * 8));
    for (int i = 0; i < 8; i++) buf[16 + i] = (uchar)(w2 >> (i * 8));
    for (int i = 0; i < 8; i++) buf[24 + i] = (uchar)(w3 >> (i * 8));
}

// -- Mining kernel --

kernel void keryxhash_mine(
    device const uchar* pre_pow_hash [[buffer(0)]],
    constant ulong* timestamp [[buffer(6)]],
    device const uchar* target [[buffer(1)]],
    constant ulong* base_nonce [[buffer(7)]],
    device const ushort* matrix [[buffer(2)]],
    device ulong* output_nonce [[buffer(3)]],
    device uchar* output_hash [[buffer(4)]],
    device uint* found [[buffer(5)]],
    uint gid [[thread_position_in_grid]]
)
{
    if (atomic_load_explicit((device atomic_uint*)found, memory_order_relaxed)) return;

    ulong ts = *timestamp;
    ulong bnonce = *base_nonce;

    ulong nonce = bnonce + (ulong)gid;

    uchar pow_input[80];
    for (int i = 0; i < 32; i++) pow_input[i] = pre_pow_hash[i];
    for (int i = 0; i < 8; i++) pow_input[32 + i] = (uchar)(ts >> (i*8));
    for (int i = 0; i < 32; i++) pow_input[40 + i] = 0;
    for (int i = 0; i < 8; i++) pow_input[72 + i] = (uchar)(nonce >> (i*8));

    uchar pow_hash[32];
    cshake256_custom(pow_input, 80, CUSTOM_POW_HASH, CUSTOM_POW_HASH_LEN, pow_hash);

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
            sum1 += (uint)matrix[(2 * i) * 64 + j]     * (uint)vec[j];
            sum2 += (uint)matrix[(2 * i + 1) * 64 + j] * (uint)vec[j];
        }
        product[i] = (uchar)(((sum1 >> 10) << 4) | (sum2 >> 10));
    }

    for (int i = 0; i < 32; i++)
        product[i] ^= pow_hash[i];

    // Keryx-only: wave_mix ARX post-processing
    wave_mix(product);

    uchar hash[32];
    cshake256_custom(product, 32, CUSTOM_HEAVY_HASH, CUSTOM_HEAVY_HASH_LEN, hash);

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
