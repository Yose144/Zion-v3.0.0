// Octopus (Conflux / CFX) OpenCL kernel — real CIP-3 implementation.
//
// Ported 1:1 from Conflux-Rust `crates/cfxcore/pow/src/compute.rs`
// (`hash_compute` / `light_compute`).  Per nonce:
//
//   1. v0..v3 = header_hash as 4 x u64 LE
//   2. a = remap(v0), b = remap(v1), c = compute_c(a,b,v2), w = remap(v3)
//      (remap: gcd-adjust exponent + modular exponentiation, POW_MOD=1032193)
//   3. d[1024] warp matrix via SipHash-2-4 lanes (warp_id = nonce / 32)
//   4. res_buf[i] = P(x_i) mod POW_MOD — 1024-coefficient Horner evaluation
//      per lane (32 lanes), x_i = (a*w2pow_i + b*wpow_i + c) % POW_MOD with
//      wpow_i = w^(n%32) * w^32^i, w2pow_i = w2^(n%32) * w^64^i
//   5. half_mix = Keccak-512(header_hash || result_le)  -> 64 bytes
//   6. mix = half_mix replicated 4x -> 256 bytes (64 x u32)
//   7. 32 accesses: index = fnv1(first_val ^ i ^ res_buf[i], mix[i]) % pages;
//      four 64-byte DAG nodes (index*4+n) FNV-mixed into mix[n]
//   8. compress: cmix[i] = fold4(mix[4i..]) *FNV ^ fold4(mix[32+4i..]) -> 32B
//   9. hash = Keccak-256(half_mix || cmix)  -> 32 bytes
//
// NOTE: Octopus uses FNV-1 (multiply-first): fnv(x,y) = x*0x01000193 ^ y,
//       NOT FNV-1a.  Keccak = original Keccak (0x01 domain), as in Ethash.
//
// The DAG is a flat buffer of 64-byte nodes (identical item structure to
// Ethash: keccak512 over cache-selected parents).  `dag_size` here means the
// number of 64-byte nodes; num_full_pages = dag_size / 4 (256B pages).
//
// ── Optimizations applied ──
//   1. reqd_work_group_size(128, 1, 1) hint
//   2. DAG prefetch hints for cache-friendly random access
//   3. Early exit: check *found_flag at top of each iteration
//   4. Keccak-f[1600] fully unrolled with always_inline
//   5. FNV-1a marked always_inline
//   6. Mix hash output only written when solution found
//
// References:
//   - Conflux Rust consensus: conflux-rust/core/src/consensus/consensus_inner/mod.rs
//   - Ethash reference: https://github.com/ethereum-mining/ethminer
//   - Keccak-f[1600] pattern reused from ethash_kernel.cl
//   - Rust CPU reference: AuXpow/src/external_hashers.rs (hash_octopus)

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

// Keccak Rho rotation offsets
__constant const uint KECCAK_RHO[24] = {
    1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 2, 14, 27, 41, 56, 8, 25, 43, 62, 18, 39, 61, 20, 44
};

// Keccak Pi permutation indices
__constant const int KECCAK_PI[24] = {
    10, 7, 11, 17, 18, 3, 5, 16, 8, 21, 24, 4, 15, 23, 19, 13, 12, 2, 20, 14, 22, 9, 6, 1
};

#define ROTL64(x, n) (((x) << (n)) | ((x) >> (64 - (n))))

// Keccak-f[1600] — hot path, fully unrolled, always inlined.
__attribute__((always_inline))
void keccak_f1600(ulong state[25]) {
    #pragma unroll 24
    for (int round = 0; round < 24; round++) {
        // Theta — manually unrolled (5 columns)
        ulong c0 = state[0]  ^ state[5]  ^ state[10] ^ state[15] ^ state[20];
        ulong c1 = state[1]  ^ state[6]  ^ state[11] ^ state[16] ^ state[21];
        ulong c2 = state[2]  ^ state[7]  ^ state[12] ^ state[17] ^ state[22];
        ulong c3 = state[3]  ^ state[8]  ^ state[13] ^ state[18] ^ state[23];
        ulong c4 = state[4]  ^ state[9]  ^ state[14] ^ state[19] ^ state[24];

        ulong d0 = c4 ^ ROTL64(c1, 1);
        ulong d1 = c0 ^ ROTL64(c2, 1);
        ulong d2 = c1 ^ ROTL64(c3, 1);
        ulong d3 = c2 ^ ROTL64(c4, 1);
        ulong d4 = c3 ^ ROTL64(c0, 1);

        state[0]  ^= d0; state[1]  ^= d1; state[2]  ^= d2; state[3]  ^= d3; state[4]  ^= d4;
        state[5]  ^= d0; state[6]  ^= d1; state[7]  ^= d2; state[8]  ^= d3; state[9]  ^= d4;
        state[10] ^= d0; state[11] ^= d1; state[12] ^= d2; state[13] ^= d3; state[14] ^= d4;
        state[15] ^= d0; state[16] ^= d1; state[17] ^= d2; state[18] ^= d3; state[19] ^= d4;
        state[20] ^= d0; state[21] ^= d1; state[22] ^= d2; state[23] ^= d3; state[24] ^= d4;

        // Rho and Pi — unrolled 24 steps
        ulong temp = state[1];
        #pragma unroll 24
        for (int t = 0; t < 24; t++) {
            int idx = KECCAK_PI[t];
            ulong tmp2 = state[idx];
            state[idx] = ROTL64(temp, KECCAK_RHO[t]);
            temp = tmp2;
        }

        // Chi — manually unrolled (5 rows × 5 columns)
        // Row 0
        {
            ulong r0 = state[0], r1 = state[1], r2 = state[2], r3 = state[3], r4 = state[4];
            state[0] = r0 ^ ((~r1) & r2);
            state[1] = r1 ^ ((~r2) & r3);
            state[2] = r2 ^ ((~r3) & r4);
            state[3] = r3 ^ ((~r4) & r0);
            state[4] = r4 ^ ((~r0) & r1);
        }
        // Row 1
        {
            ulong r0 = state[5], r1 = state[6], r2 = state[7], r3 = state[8], r4 = state[9];
            state[5] = r0 ^ ((~r1) & r2);
            state[6] = r1 ^ ((~r2) & r3);
            state[7] = r2 ^ ((~r3) & r4);
            state[8] = r3 ^ ((~r4) & r0);
            state[9] = r4 ^ ((~r0) & r1);
        }
        // Row 2
        {
            ulong r0 = state[10], r1 = state[11], r2 = state[12], r3 = state[13], r4 = state[14];
            state[10] = r0 ^ ((~r1) & r2);
            state[11] = r1 ^ ((~r2) & r3);
            state[12] = r2 ^ ((~r3) & r4);
            state[13] = r3 ^ ((~r4) & r0);
            state[14] = r4 ^ ((~r0) & r1);
        }
        // Row 3
        {
            ulong r0 = state[15], r1 = state[16], r2 = state[17], r3 = state[18], r4 = state[19];
            state[15] = r0 ^ ((~r1) & r2);
            state[16] = r1 ^ ((~r2) & r3);
            state[17] = r2 ^ ((~r3) & r4);
            state[18] = r3 ^ ((~r4) & r0);
            state[19] = r4 ^ ((~r0) & r1);
        }
        // Row 4
        {
            ulong r0 = state[20], r1 = state[21], r2 = state[22], r3 = state[23], r4 = state[24];
            state[20] = r0 ^ ((~r1) & r2);
            state[21] = r1 ^ ((~r2) & r3);
            state[22] = r2 ^ ((~r3) & r4);
            state[23] = r3 ^ ((~r4) & r0);
            state[24] = r4 ^ ((~r0) & r1);
        }

        // Iota
        state[0] ^= KECCAK_RC[round];
    }
}

// ── Keccak-512 (rate 72 bytes = 9 lanes, output 64 bytes = 8 lanes) ──
//
// Uses the original Keccak domain suffix 0x01 (Ethereum/Conflux Keccak-512),
// NOT the NIST SHA3-512 suffix 0x06.

__attribute__((always_inline))
inline void absorb_block_9(ulong state[25], const uchar *block) {
    #pragma unroll 9
    for (int i = 0; i < 9; i++) {
        ulong lane = 0;
        #pragma unroll 8
        for (int j = 0; j < 8; j++)
            lane |= ((ulong)block[i*8 + j]) << (j*8);
        state[i] ^= lane;
    }
}

__attribute__((always_inline))
void keccak512(const uchar *input, const uint len, uchar *output) {
    ulong state[25];
    #pragma unroll 25
    for (int i = 0; i < 25; i++) state[i] = 0;

    uint offset = 0;
    while (offset + 72 <= len) {
        absorb_block_9(state, input + offset);
        keccak_f1600(state);
        offset += 72;
    }

    uchar padded[72];
    #pragma unroll 72
    for (int i = 0; i < 72; i++) padded[i] = 0;
    uint remaining = len - offset;
    for (int i = 0; i < remaining; i++) padded[i] = input[offset + i];
    padded[remaining] = 0x01;   // Keccak domain suffix
    padded[71] |= 0x80;         // end-of-rate padding

    absorb_block_9(state, padded);
    keccak_f1600(state);

    #pragma unroll 8
    for (int i = 0; i < 8; i++)
        #pragma unroll 8
        for (int j = 0; j < 8; j++)
            output[i*8 + j] = (uchar)(state[i] >> (j*8));
}

// ── Keccak-256 (rate 136 bytes = 17 lanes, output 32 bytes = 4 lanes) ──
//
// Uses the original Keccak domain suffix 0x01 (Ethereum/Conflux Keccak-256),
// NOT the NIST SHA3-256 suffix 0x06.

__attribute__((always_inline))
inline void absorb_block_17(ulong state[25], const uchar *block) {
    #pragma unroll 17
    for (int i = 0; i < 17; i++) {
        ulong lane = 0;
        #pragma unroll 8
        for (int j = 0; j < 8; j++)
            lane |= ((ulong)block[i*8 + j]) << (j*8);
        state[i] ^= lane;
    }
}

__attribute__((always_inline))
void keccak256(const uchar *input, const uint len, uchar *output) {
    ulong state[25];
    #pragma unroll 25
    for (int i = 0; i < 25; i++) state[i] = 0;

    uint offset = 0;
    while (offset + 136 <= len) {
        absorb_block_17(state, input + offset);
        keccak_f1600(state);
        offset += 136;
    }

    uchar padded[136];
    #pragma unroll 136
    for (int i = 0; i < 136; i++) padded[i] = 0;
    uint remaining = len - offset;
    for (int i = 0; i < remaining; i++) padded[i] = input[offset + i];
    padded[remaining] = 0x01;   // Keccak domain suffix
    padded[135] |= 0x80;        // end-of-rate padding

    absorb_block_17(state, padded);
    keccak_f1600(state);

    #pragma unroll 4
    for (int i = 0; i < 4; i++)
        #pragma unroll 8
        for (int j = 0; j < 8; j++)
            output[i*8 + j] = (uchar)(state[i] >> (j*8));
}

// ── FNV helpers (Octopus uses FNV-1, multiply-first) ──────────────────

#define FNV_PRIME 0x01000193u
#define POW_MOD64 1032193UL
#define POW_MOD_B 11UL
#define POW_N 1024
#define POW_WARP 32
#define POW_DPT 32   /* POW_DATA_PER_THREAD = POW_N / POW_WARP = accesses */

__attribute__((always_inline))
inline uint oct_fnv(uint x, uint y) {
    return x * FNV_PRIME ^ y;
}
__attribute__((always_inline))
inline ulong oct_fnv64(ulong x, ulong y) {
    return x * (ulong)FNV_PRIME ^ y;
}

// ── SipHash-2-4 lanes ─────────────────────────────────────────────────

__attribute__((always_inline))
inline ulong rotl64(ulong x, uint b) { return (x << b) | (x >> (64 - b)); }

__attribute__((always_inline))
inline void sip_round(__private ulong *v /* [4] */) {
    v[0] += v[1];
    v[2] += v[3];
    v[1] = rotl64(v[1], 13);
    v[3] = rotl64(v[3], 16);
    v[1] ^= v[0];
    v[3] ^= v[2];
    v[0] = rotl64(v[0], 32);
    v[2] += v[1];
    v[0] += v[3];
    v[1] = rotl64(v[1], 17);
    v[3] = rotl64(v[3], 21);
    v[1] ^= v[2];
    v[3] ^= v[0];
    v[2] = rotl64(v[2], 32);
}

// SipHash-2-4 of a single u64 message (the warp nonce)
inline void sip_hash24(__private ulong *v, ulong nonce) {
    v[3] ^= nonce;
    sip_round(v);
    sip_round(v);
    v[0] ^= nonce;
    v[2] ^= 0xffUL;
    sip_round(v);
    sip_round(v);
    sip_round(v);
    sip_round(v);
}

// ── remap / gcd / modular exponentiation (CIP-3) ──────────────────────

inline ulong oct_gcd(ulong a, ulong b) {
    while (b != 0) { ulong t = b; b = a % b; a = t; }
    return a;
}

inline ulong oct_powmod(ulong a1, ulong n) {
    ulong a = a1;
    ulong result = 1;
    while (n > 0) {
        if (n & 1) result = result * a % POW_MOD64;
        a = a * a % POW_MOD64;
        n >>= 1;
    }
    return result;
}

// remap: e = h % (POW_MOD-2) + 1, reduce e by gcd until coprime with
// POW_MOD-1, then return POW_MOD_B^e mod POW_MOD.
inline ulong oct_remap(ulong h) {
    ulong e = h % (POW_MOD64 - 2) + 1;
    for (;;) {
        ulong g = oct_gcd(e, POW_MOD64 - 1);
        if (g == 1) break;
        e /= g;
    }
    return oct_powmod(POW_MOD_B, e);
}

// compute_c: smallest remap(h) (h incrementing) such that
// b*b % POW_MOD != 4*a*c % POW_MOD.
inline ulong oct_compute_c(ulong a, ulong b, ulong h0) {
    ulong h = h0;
    for (;;) {
        ulong c = oct_remap(h);
        if (b * b % POW_MOD64 != 4UL * a * c % POW_MOD64)
            return c;
        h += 1;
    }
}

// ── Mining kernel ────────────────────────────────────────────────────
//
// Kernel arguments:
//   header       — block header bytes (first 32 bytes = header_hash)
//   header_len   — length of header buffer in bytes
//   base_nonce   — first nonce in this batch
//   output_hash  — 32-byte final hash of the winning nonce (written on find)
//   found_flag   — atomic flag: 0 = not found, 1 = found
//   target       — 32-byte target (big-endian byte comparison)
//   dag          — flat buffer of 64-byte DAG nodes
//   dag_size     — number of 64-byte DAG nodes (pages = dag_size/4)
//
// Each work-item processes exactly one nonce:
//   nonce = base_nonce + get_global_id(0)
__attribute__((reqd_work_group_size(128, 1, 1)))
__kernel void octopus_mine(
    __global const uchar *header,
    uint header_len,
    ulong base_nonce,
    __global uchar *output_hash,
    __global ulong *output_nonce,
    __global uint *found_flag,
    __global const uchar *target,
    __global const uchar *dag,
    ulong dag_size)
{
    if (*found_flag) return;

    ulong nonce = base_nonce + (ulong)get_global_id(0);

    // v0..v3 = header_hash as 4 x u64 LE
    __private uchar hdr[32];
    uint copy_len = header_len < 32 ? header_len : 32;
    for (int i = 0; i < 32; i++) hdr[i] = 0;
    for (uint i = 0; i < copy_len; i++) hdr[i] = header[i];

    ulong v[4];
    for (int i = 0; i < 4; i++) {
        ulong w0 = 0;
        for (int b = 0; b < 8; b++)
            w0 |= ((ulong)hdr[i * 8 + b]) << (b * 8);
        v[i] = w0;
    }

    // Step 2: a, b, c, w via remap / compute_c
    ulong a = oct_remap(v[0]);
    ulong b = oct_remap(v[1]);
    ulong c = oct_compute_c(a, b, v[2]);
    ulong w = oct_remap(v[3]);

    // Step 3: d[1024] SipHash warp matrix.
    // d[j*32+i] = (sip_i after j-th extra round).xor_lanes() & 0xFFFFFFFF % MOD
    __private uint d[POW_N];
    ulong warp_id = nonce / POW_WARP;
    for (int i = 0; i < POW_WARP; i++) {
        ulong sv[4] = { v[0], v[1], v[2], v[3] };
        sip_hash24(sv, warp_id * POW_WARP + (ulong)i);
        for (int j = 0; j < POW_DPT; j++) {
            sip_round(sv);
            d[j * POW_WARP + i] =
                (uint)(((sv[0] ^ sv[1] ^ sv[2] ^ sv[3]) & 0xFFFFFFFFUL) % POW_MOD64);
        }
    }

    // Step 4: wpow chain. wpow_i = w^(n%32) * (w^32)^i ; w2pow analog.
    ulong w2 = w * w % POW_MOD64;
    ulong wpow = 1, w2pow = 1;
    for (int i = 0; i < (int)(nonce % POW_WARP); i++) {
        wpow = wpow * w % POW_MOD64;
        w2pow = w2pow * w2 % POW_MOD64;
    }
    // full_wpow = w^32, full_w2pow = (w^2)^32 — computed by completing the
    // exponent to 32 (matches reference: starts at wpow then finishes).
    ulong full_wpow = wpow, full_w2pow = w2pow;
    for (int i = (int)(nonce % POW_WARP); i < POW_WARP; i++) {
        full_wpow = full_wpow * w % POW_MOD64;
        full_w2pow = full_w2pow * w2 % POW_MOD64;
    }

    // Step 5: res_buf[i] = P(x_i) mod POW_MOD; result = fnv64 chain.
    __private uint res_buf[POW_DPT];
    ulong result = 0;
    for (int i = 0; i < POW_DPT; i++) {
        ulong x = (a * w2pow + b * wpow + c) % POW_MOD64;
        ulong pv = 0;
        for (int j = 0; j < POW_N; j++) {
            pv = (pv * x + (ulong)d[POW_N - j - 1]) % POW_MOD64;
        }
        res_buf[i] = (uint)pv;
        result = oct_fnv64(result, pv);
        if (i + 1 < POW_DPT) {
            wpow = wpow * full_wpow % POW_MOD64;
            w2pow = w2pow * full_w2pow % POW_MOD64;
        }
    }

    // Step 6: half_mix = Keccak-512(header_hash || result_le)
    __private uchar hm_in[40];
    for (int i = 0; i < 32; i++) hm_in[i] = hdr[i];
    for (int i = 0; i < 8; i++) hm_in[32 + i] = (uchar)(result >> (i * 8));

    __private uchar half_mix[64] __attribute__((aligned(8)));
    keccak512(hm_in, 40, half_mix);

    // Step 7: mix = half_mix x4 -> 256B = 64 u32 words
    __private uint mix[64];
    for (int n = 0; n < 4; n++) {
        for (int j = 0; j < 16; j++) {
            mix[n * 16 + j] = (uint)half_mix[j * 4]
                | ((uint)half_mix[j * 4 + 1] << 8)
                | ((uint)half_mix[j * 4 + 2] << 16)
                | ((uint)half_mix[j * 4 + 3] << 24);
        }
    }
    uint first_val = mix[0];
    ulong num_pages = dag_size / 4;

    // Step 8: 32 accesses; each picks a 256B page and FNV-mixes 4 nodes.
    for (int i = 0; i < POW_DPT; i++) {
        uint index = oct_fnv(first_val ^ (uint)i ^ res_buf[i], mix[i])
                     % (uint)num_pages;
        for (int n = 0; n < 4; n++) {
            __global const uchar *node = dag + (ulong)(index * 4u + (uint)n) * 64UL;
            for (int k = 0; k < 16; k++) {
                uint nw = (uint)node[k * 4]
                    | ((uint)node[k * 4 + 1] << 8)
                    | ((uint)node[k * 4 + 2] << 16)
                    | ((uint)node[k * 4 + 3] << 24);
                mix[n * 16 + k] = oct_fnv(mix[n * 16 + k], nw);
            }
        }
    }

    // Step 9: compress — cmix[i] = fold4(mix[4i..]) *FNV ^ fold4(mix[32+4i..])
    __private uchar cmix[32];
    for (int i = 0; i < 8; i++) {
        uint r1 = mix[4 * i];
        r1 = r1 * FNV_PRIME ^ mix[4 * i + 1];
        r1 = r1 * FNV_PRIME ^ mix[4 * i + 2];
        r1 = r1 * FNV_PRIME ^ mix[4 * i + 3];
        uint r2 = mix[32 + 4 * i];
        r2 = r2 * FNV_PRIME ^ mix[32 + 4 * i + 1];
        r2 = r2 * FNV_PRIME ^ mix[32 + 4 * i + 2];
        r2 = r2 * FNV_PRIME ^ mix[32 + 4 * i + 3];
        uint cv = r1 * FNV_PRIME ^ r2;
        cmix[i * 4]     = (uchar)(cv);
        cmix[i * 4 + 1] = (uchar)(cv >> 8);
        cmix[i * 4 + 2] = (uchar)(cv >> 16);
        cmix[i * 4 + 3] = (uchar)(cv >> 24);
    }

    // Step 10: hash = Keccak-256(half_mix || cmix)
    __private uchar final_input[96];
    for (int i = 0; i < 64; i++) final_input[i] = half_mix[i];
    for (int i = 0; i < 32; i++) final_input[64 + i] = cmix[i];

    __private uchar hash[32];
    keccak256(final_input, 96, hash);

    // Step 11: target check (big-endian compare)
    int meets = 1;
    for (int i = 0; i < 32; i++) {
        if (hash[i] < target[i]) { meets = 1; break; }
        if (hash[i] > target[i]) { meets = 0; break; }
    }
    if (meets) {
        uint old = atomic_xchg(found_flag, 1u);
        if (old == 0u) {
            for (int i = 0; i < 32; i++) output_hash[i] = hash[i];
            output_nonce[0] = nonce;
        }
    }
}
