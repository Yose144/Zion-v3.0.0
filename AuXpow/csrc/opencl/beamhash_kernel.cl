// BeamHash III OpenCL kernel — SipHash-2-4 hash generation for BEAM mining.
//
// This kernel generates the 448-bit work bits for each index using SipHash-2-4
// with a 256-bit prePow state. The Wagner's algorithm collision finding is
// done on the host (CPU) side using beamhash.rs.
//
// Parameters:
//   workBitSize      = 448 (7 × 64-bit SipHash outputs)
//   collisionBitSize = 24
//   numRounds        = 5 (K)
//   M                = 2^25 = 33,554,432 initial entries
//
// Hash computation per index:
//   For j = 0..7: h[j] = siphash24(prePow[0..3], (index << 3) + j)
//   workBits = h[0] || h[1] || h[2] || h[3] || h[4] || h[5] || h[6]  (448 bits)
//   (h[7] is computed but discarded — only 7 × 64 = 448 bits fit)
//
// References:
//   - https://github.com/btccom/btcpool-ABANDONED (beamHashIII_impl.cpp)
//   - https://docs.beam.mw/beamHash_III_spec.pdf

// === SipHash-2-4 ===

inline ulong rotl64(ulong x, uint b) {
    return (x << b) | (x >> (64 - b));
}

inline void sipround(ulong *v0, ulong *v1, ulong *v2, ulong *v3) {
    *v0 += *v1;
    *v1 = rotl64(*v1, 13);
    *v1 ^= *v0;
    *v0 = rotl64(*v0, 32);
    *v2 += *v3;
    *v3 = rotl64(*v3, 16);
    *v3 ^= *v2;
    *v0 += *v3;
    *v3 = rotl64(*v3, 21);
    *v3 ^= *v0;
    *v2 += *v1;
    *v1 = rotl64(*v1, 17);
    *v1 ^= *v2;
    *v2 = rotl64(*v2, 32);
}

/// SipHash-2-4 with 256-bit pre-state (4 × 64-bit words).
/// This is the BeamHash III variant — uses prePow directly as initial state,
/// WITHOUT the standard SipHash magic constants.
inline ulong siphash24_prepow(ulong s0, ulong s1, ulong s2, ulong s3, ulong nonce) {
    ulong v0 = s0;
    ulong v1 = s1;
    ulong v2 = s2;
    ulong v3 = s3;

    // Compression: 2 Sip rounds
    v3 ^= nonce;
    sipround(&v0, &v1, &v2, &v3);
    sipround(&v0, &v1, &v2, &v3);
    v0 ^= nonce;

    // Finalization: 4 Sip rounds
    v2 ^= 0xFF;
    sipround(&v0, &v1, &v2, &v3);
    sipround(&v0, &v1, &v2, &v3);
    sipround(&v0, &v1, &v2, &v3);
    sipround(&v0, &v1, &v2, &v3);

    return v0 ^ v1 ^ v2 ^ v3;
}

// === Hash generation kernel ===

/// Generate 448-bit work bits for each index.
///
/// Each work-item computes the 448-bit hash for one index.
/// The output is 7 × 64-bit words = 56 bytes per index.
///
/// Args:
///   prePow0, prePow1, prePow2, prePow3 — 4 × 64-bit prePow state words
///   output — output buffer of size M * 56 bytes (7 ulongs per index)
///   start_index — first index to hash (for batched processing)
__kernel void beamhash_generate_hashes(
        const ulong prePow0,
        const ulong prePow1,
        const ulong prePow2,
        const ulong prePow3,
        __global ulong *output,
        const uint start_index) {

    uint gid = get_global_id(0);
    uint index = start_index + gid;

    // M = 2^25 = 33,554,432
    if (index >= 33554432u)
        return;

    ulong base = (ulong)index << 3;

    // Compute 7 SipHash outputs (h[7] is discarded)
    ulong h0 = siphash24_prepow(prePow0, prePow1, prePow2, prePow3, base);
    ulong h1 = siphash24_prepow(prePow0, prePow1, prePow2, prePow3, base + 1);
    ulong h2 = siphash24_prepow(prePow0, prePow1, prePow2, prePow3, base + 2);
    ulong h3 = siphash24_prepow(prePow0, prePow1, prePow2, prePow3, base + 3);
    ulong h4 = siphash24_prepow(prePow0, prePow1, prePow2, prePow3, base + 4);
    ulong h5 = siphash24_prepow(prePow0, prePow1, prePow2, prePow3, base + 5);
    ulong h6 = siphash24_prepow(prePow0, prePow1, prePow2, prePow3, base + 6);

    // Write 7 ulongs (56 bytes = 448 bits) to output
    uint offset = gid * 7;
    output[offset + 0] = h0;
    output[offset + 1] = h1;
    output[offset + 2] = h2;
    output[offset + 3] = h3;
    output[offset + 4] = h4;
    output[offset + 5] = h5;
    output[offset + 6] = h6;
}
