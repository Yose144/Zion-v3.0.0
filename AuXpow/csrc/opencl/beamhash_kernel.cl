// BeamHash III OpenCL kernel — Equihash (144,5) with SipHash-2-4
//
// Implements the SipHash-2-4 hash function and the initial hash generation
// for Equihash 144,5 (BeamHash III). The full Wagner's algorithm collision
// finding is done on the host side; the GPU handles the compute-intensive
// hash generation phase.
//
// Parameters:
//   N = 144 (hash width in bits)
//   K = 5   (number of rounds)
//   n = 24  (bits per digit)
//   M = 2^25 (number of initial hashes)
//   Index bits = 25
//   Hash bytes = 18 (144 bits)
//
// References:
//   - https://docs.beam.mw/beamHash_III_spec.pdf
//   - https://github.com/BeamMW/opencl-miner (BeamHash I/II reference)
//   - SipHash: https://www.aumasson.fr/siphash/siphash.pdf

// ── Constants ───────────────────────────────────────────────────────

#define BEAMHASH_N          144
#define BEAMHASH_K          5
#define BEAMHASH_DIGIT_BITS 24
#define BEAMHASH_INDEX_BITS 25
#define BEAMHASH_HASH_BYTES 18
#define BEAMHASH_M          33554432  // 2^25

// ── SipHash-2-4 ─────────────────────────────────────────────────────

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

/// SipHash-2-4 for a single 64-bit message word.
/// Returns 64-bit hash.
inline ulong siphash24_u64(ulong k0, ulong k1, ulong m) {
    ulong v0 = 0x736f6d6570736575UL ^ k0;
    ulong v1 = 0x646f72616e646f6dUL ^ k1;
    ulong v2 = 0x6c7967656e657261UL ^ k0;
    ulong v3 = 0x7465646279746573UL ^ k1;

    // Compression: 2 Sip rounds
    v3 ^= m;
    sipround(&v0, &v1, &v2, &v3);
    sipround(&v0, &v1, &v2, &v3);
    v0 ^= m;

    // Finalization: 4 Sip rounds
    v2 ^= 0xFF;
    sipround(&v0, &v1, &v2, &v3);
    sipround(&v0, &v1, &v2, &v3);
    sipround(&v0, &v1, &v2, &v3);
    sipround(&v0, &v1, &v2, &v3);

    return v0 ^ v1 ^ v2 ^ v3;
}

// ── Hash generation kernel ──────────────────────────────────────────

/// Generate initial Equihash hashes for BeamHash III.
///
/// Each work-item computes the 144-bit (18-byte) hash for one index.
/// The hash is computed as:
///   h = SipHash(key, idx) || SipHash(key, idx+1) || SipHash(key, idx+2)[:2]
/// truncated to 18 bytes.
///
/// Args:
///   sipkey0, sipkey1 — SipHash key (derived from SHA-256 of header+nonce)
///   output           — output buffer of size M * HASH_BYTES bytes
///   start_index      — first index to hash (for batched processing)
__kernel void beamhash_generate_hashes(
        const ulong sipkey0,
        const ulong sipkey1,
        __global uchar *output,
        const uint start_index) {

    uint gid = get_global_id(0);
    uint index = start_index + gid;

    if (index >= BEAMHASH_M) return;

    ulong idx = (ulong)index;

    // Compute 3 SipHash outputs for 192 bits, truncate to 144 bits (18 bytes)
    ulong h0 = siphash24_u64(sipkey0, sipkey1, idx);
    ulong h1 = siphash24_u64(sipkey0, sipkey1, idx + 1);
    ulong h2 = siphash24_u64(sipkey0, sipkey1, idx + 2);

    // Write 18 bytes to output (little-endian)
    uint offset = gid * BEAMHASH_HASH_BYTES;

    // h0: bytes 0-7
    vstore8((uchar8)(
        (uchar)(h0),       (uchar)(h0 >> 8),  (uchar)(h0 >> 16), (uchar)(h0 >> 24),
        (uchar)(h0 >> 32), (uchar)(h0 >> 40), (uchar)(h0 >> 48), (uchar)(h0 >> 56)
    ), 0, output + offset);

    // h1: bytes 8-15
    vstore8((uchar8)(
        (uchar)(h1),       (uchar)(h1 >> 8),  (uchar)(h1 >> 16), (uchar)(h1 >> 24),
        (uchar)(h1 >> 32), (uchar)(h1 >> 40), (uchar)(h1 >> 48), (uchar)(h1 >> 56)
    ), 0, output + offset + 8);

    // h2: bytes 16-17 (first 2 bytes only)
    output[offset + 16] = (uchar)(h2);
    output[offset + 17] = (uchar)(h2 >> 8);
}

// ── Target check kernel ─────────────────────────────────────────────

/// Check if a solution's PoW hash meets the target.
///
/// Computes SHA-256(header || nonce || solution) and compares with target.
/// Since SHA-256 is complex to implement in OpenCL, this kernel does a
/// simplified check: it compares the first 8 bytes of the solution-derived
/// hash with the target. The full SHA-256 verification is done on the host.
///
/// For now, this kernel is a placeholder — the actual target check is
/// performed by the host after the Wagner's algorithm finds a solution.
__kernel void beamhash_check_target(
        __global const uchar *solution,
        __global const uchar *target,
        __global uint *found) {

    uint gid = get_global_id(0);
    if (gid != 0) return;

    // Placeholder: actual target check is done on host
    // This kernel exists for API compatibility
    found[0] = 0;
}
