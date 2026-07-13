// kHeavyHash Metal kernel for Kaspa (KAS) mining.
//
// Full implementation of the Kaspa consensus kHeavyHash algorithm:
//   1. PowHash   = cSHAKE256("ProofOfWorkHash")(pre_pow_hash || timestamp_le || 32 zero bytes || nonce_le)
//   2. Matrix    = expand PowHash to 64 nibbles, multiply by fixed 64x64 matrix
//                  (4-bit entries, generated from SHA3-256("KHeavyHash") via XoShiRo256++),
//                  reduce each sum to bits 10-13, recombine to 32 bytes, XOR with PowHash
//   3. HeavyHash = cSHAKE256("HeavyHash")(matrix_output)
//
// The 64x64 matrix is generated on the host (matching rusty-kaspa's Matrix::generate)
// and passed as a device buffer of 4096 u16 values (8192 bytes).
//
// References:
//   - rusty-kaspa: https://github.com/kaspanet/rusty-kaspa
//   - NIST SP 800-185 (cSHAKE)
//   - Rust CPU reference: AuXpow/src/external_hashers.rs (hash_kheavyhash)
//
// Translated from opencl/kheavyhash_kernel.cl.

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

// Keccak Rho rotation offsets
constant const uint KECCAK_RHO[24] = {
    1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 2, 14, 27, 41, 56, 8, 25, 43, 62, 18, 39, 61, 20, 44
};

// Keccak Pi permutation indices
constant const int KECCAK_PI[24] = {
    10, 7, 11, 17, 18, 3, 5, 16, 8, 21, 24, 4, 15, 23, 19, 13, 12, 2, 20, 14, 22, 9, 6, 1
};

#define ROTL64(x, n) (((x) << (n)) | ((x) >> (64 - (n))))

void keccak_f1600(thread ulong state[25]) {
    for (int round = 0; round < 24; round++) {
        // Theta
        ulong c[5], d[5];
        for (int x = 0; x < 5; x++)
            c[x] = state[x] ^ state[x+5] ^ state[x+10] ^ state[x+15] ^ state[x+20];
        for (int x = 0; x < 5; x++)
            d[x] = c[(x+4)%5] ^ ROTL64(c[(x+1)%5], 1);
        for (int i = 0; i < 25; i++)
            state[i] ^= d[i%5];

        // Rho and Pi
        ulong temp = state[1];
        for (int t = 0; t < 24; t++) {
            int idx = KECCAK_PI[t];
            ulong tmp2 = state[idx];
            state[idx] = ROTL64(temp, KECCAK_RHO[t]);
            temp = tmp2;
        }

        // Chi
        for (int y = 0; y < 5; y++) {
            ulong row[5];
            for (int x = 0; x < 5; x++) row[x] = state[y*5+x];
            for (int x = 0; x < 5; x++)
                state[y*5+x] = row[x] ^ ((~row[(x+1)%5]) & row[(x+2)%5]);
        }

        // Iota
        state[0] ^= KECCAK_RC[round];
    }
}

// -- SHA3-256 / cSHAKE256 ---------------------------------------------
//
// cSHAKE256(N, S, data) per NIST SP 800-185, matching the Rust sha3 crate's
// CShake256Core::new(customization) which sets N="" (empty function name)
// and S=customization_string.
//
// Construction:
//   prefix = bytepad( encode_string(N) || encode_string(S), rate )
//          = left_encode(rate) || encode_string(N) || encode_string(S) || 0x00...
//   where encode_string(X) = left_encode(len(X)*8) || X
//   and   left_encode(x)   = [num_value_bytes] || big_endian(x)  (stripping leading zeros)
//
// The prefix is exactly 136 bytes (one Keccak block for SHA3-256 rate).
// It is absorbed first, then the data is absorbed with cSHAKE domain
// separator 0x04 (not 0x06 as in plain SHA3).
//
// For N="" and S="ProofOfWorkHash" (15 bytes = 120 bits):
//   left_encode(136)  = [0x01, 0x88]     (bytepad width = rate = 136)
//   encode_string("") = left_encode(0) = [0x01, 0x00]
//   encode_string(S)  = left_encode(120) || "ProofOfWorkHash"
//                     = [0x01, 0x78] || "ProofOfWorkHash" (15 bytes)
//   Total payload: 2 + 2 + 2 + 15 = 21 bytes, padded to 136 with zeros
//
// For N="" and S="HeavyHash" (9 bytes = 72 bits):
//   left_encode(136)  = [0x01, 0x88]
//   encode_string("") = [0x01, 0x00]
//   encode_string(S)  = left_encode(72) || "HeavyHash"
//                     = [0x01, 0x48] || "HeavyHash" (9 bytes)
//   Total payload: 2 + 2 + 2 + 9 = 15 bytes, padded to 136 with zeros

// Absorb one 136-byte block (17 lanes) into the Keccak state.
inline void keccak_absorb_block(thread ulong state[25], thread const uchar *block) {
    for (int i = 0; i < 17; i++) {
        ulong lane = 0;
        for (int j = 0; j < 8; j++)
            lane |= ((ulong)block[i*8 + j]) << (j*8);
        state[i] ^= lane;
    }
}

// cSHAKE256 with a customization string S (function name N is empty).
// Matches the Rust sha3 crate's CShake256Core::new(customization).
//
// The prefix (bytepad of encode_strings) is exactly 136 bytes = one Keccak
// block, so it's absorbed in a single keccak_f1600 call.  Then the data
// (which fits in a single block for our use cases) is absorbed with the
// cSHAKE domain separator 0x04.
void cshake256_custom(
    thread const uchar *input,          // thread data to hash
    const uint input_len,               // length of input
    constant const uchar *custom,       // customization string S
    const uint custom_len,              // length of S
    thread uchar *output                // 32-byte output
) {
    ulong state[25];
    for (int i = 0; i < 25; i++) state[i] = 0;

    // -- Build the 136-byte bytepad prefix --
    // prefix = left_encode(136) || encode_string("") || encode_string(S) || zeros
    //        = left_encode(136) || left_encode(0) || left_encode(len(S)*8) || S || zeros
    uchar prefix[136];
    for (int i = 0; i < 136; i++) prefix[i] = 0;
    uint pos = 0;

    // left_encode(136) -- bytepad width (= rate)
    prefix[pos++] = 0x01;
    prefix[pos++] = 0x88;

    // encode_string("") -- left_encode(0) for empty function name N
    prefix[pos++] = 0x01;
    prefix[pos++] = 0x00;

    // encode_string(S) -- left_encode(custom_len * 8) || S
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

    // Remaining bytes are already zero (bytepad padding to 136)

    // Absorb prefix block and permute
    keccak_absorb_block(state, prefix);
    keccak_f1600(state);

    // -- Absorb data with cSHAKE padding (0x04 domain) --
    // Our data always fits in a single 136-byte block.
    uchar data_block[136];
    for (int i = 0; i < 136; i++) data_block[i] = 0;
    for (uint i = 0; i < input_len; i++)
        data_block[i] = input[i];
    data_block[input_len] = 0x04;   // cSHAKE domain separator
    data_block[135] |= 0x80;        // end-of-rate padding

    keccak_absorb_block(state, data_block);
    keccak_f1600(state);

    // Squeeze 32 bytes (4 lanes)
    for (int i = 0; i < 4; i++) {
        for (int j = 0; j < 8; j++)
            output[i*8 + j] = (uchar)(state[i] >> (j*8));
    }
}

// -- Customization string constants -----------------------------------
// These are used as the customization string S in cSHAKE256 (N is empty).

constant const uchar CUSTOM_POW_HASH[] = {
    'P', 'r', 'o', 'o', 'f', 'O', 'f', 'W', 'o', 'r', 'k', 'H', 'a', 's', 'h'
};
constant const uint CUSTOM_POW_HASH_LEN = 15;

constant const uchar CUSTOM_HEAVY_HASH[] = {
    'H', 'e', 'a', 'v', 'y', 'H', 'a', 's', 'h'
};
constant const uint CUSTOM_HEAVY_HASH_LEN = 9;

// -- Mining kernel ----------------------------------------------------
//
// Kernel arguments:
//   pre_pow_hash  -- 32-byte pre-pow hash from mining.notify
//   timestamp     -- block timestamp (little-endian u64)
//   target        -- 32-byte target (big-endian byte comparison)
//   base_nonce    -- first nonce in this batch
//   matrix        -- 64x64 u16 matrix (4096 values = 8192 bytes), generated
//                   on the host from SHA3-256("KHeavyHash") via XoShiRo256++
//   output_nonce  -- single u64, written when a solution is found
//   output_hash   -- 32-byte hash of the winning nonce
//   found         -- atomic flag: 0 = not found, 1 = found
kernel void kheavyhash_mine(
    device const uchar* pre_pow_hash [[buffer(0)]],    // 32 bytes
    ulong timestamp,
    device const uchar* target [[buffer(1)]],           // 32 bytes
    ulong base_nonce,
    device const ushort* matrix [[buffer(2)]],          // 64x64 = 4096 u16 values
    device ulong* output_nonce [[buffer(3)]],
    device uchar* output_hash [[buffer(4)]],
    device uint* found [[buffer(5)]],
    uint gid [[thread_position_in_grid]]
)
{
    if (atomic_load_explicit((device atomic_uint*)found, memory_order_relaxed)) return;

    ulong nonce = base_nonce + (ulong)gid;

    // -- Step 1: PowHash = cSHAKE256("ProofOfWorkHash")(pre_pow_hash || timestamp_le || 32 zero bytes || nonce_le)
    // Input is 32 + 8 + 32 + 8 = 80 bytes.
    // We build it in a private buffer, then call cshake256_custom.
    uchar pow_input[80];
    for (int i = 0; i < 32; i++) pow_input[i] = pre_pow_hash[i];
    for (int i = 0; i < 8; i++) pow_input[32 + i] = (uchar)(timestamp >> (i*8));
    for (int i = 0; i < 32; i++) pow_input[40 + i] = 0;
    for (int i = 0; i < 8; i++) pow_input[72 + i] = (uchar)(nonce >> (i*8));

    uchar pow_hash[32];
    cshake256_custom(pow_input, 80, CUSTOM_POW_HASH, CUSTOM_POW_HASH_LEN, pow_hash);

    // -- Step 2: Matrix multiply
    // Expand PowHash to 64 nibbles: vec[2*i] = high nibble, vec[2*i+1] = low nibble
    uchar vec[64];
    for (int i = 0; i < 32; i++) {
        vec[2 * i]     = pow_hash[i] >> 4;
        vec[2 * i + 1] = pow_hash[i] & 0x0F;
    }

    // Matrix-vector multiply: for each output byte i (0..31):
    //   sum1 = Sum matrix[2*i][j]   * vec[j]
    //   sum2 = Sum matrix[2*i+1][j] * vec[j]
    //   product[i] = ((sum1 >> 10) << 4) | (sum2 >> 10)
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

    // XOR product with original PowHash
    for (int i = 0; i < 32; i++)
        product[i] ^= pow_hash[i];

    // -- Step 3: HeavyHash = cSHAKE256("HeavyHash")(product)
    uchar hash[32];
    cshake256_custom(product, 32, CUSTOM_HEAVY_HASH, CUSTOM_HEAVY_HASH_LEN, hash);

    // -- Step 4: Check target (big-endian byte comparison: hash <= target)
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
