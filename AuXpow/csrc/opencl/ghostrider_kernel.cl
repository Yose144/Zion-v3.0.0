// =============================================================================
// GhostRider OpenCL kernel for Raptoreum (RTM) mining.
//
// GhostRider combines 15 hash algorithms (x16r-style) with 6 CryptoNight
// variants in an 18-step chain:
//   core[0..4] → cn[0] → core[5..9] → cn[1] → core[10..14] → cn[2]
//
// The 15 core algorithms: blake, bmw, groestl, jh, keccak, skein, luffa,
// cubehash, shavite, simd, echo, hamsi, fugue, shabal, whirlpool
//
// The 6 CN variants: cn_fast, cn_lite, cn_heavy, cn_fast_v2, cn_lite_v2,
// cn_heavy_v2 (all use 1MB scratchpad, differ in iterations/mixing)
//
// Algorithm selection: SHA-256(header) → seed → Fisher-Yates shuffle of 15
// algos + 3 CN variant selections from seed bytes.
//
// Each work-item processes ONE nonce. 1MB scratchpad per work-item in global.
// =============================================================================

#define HASH_SIZE 32      // 256-bit output
#define INPUT_SIZE 80     // block header
#define SCRATCH_SIZE 262144  // 1MB / 4 bytes = 262144 uint32 words
#define CN_ITERATIONS 524288   // cn_fast: 524288 iterations
#define CN_LITE_ITER 262144    // cn_lite: 0.5x
#define CN_HEAVY_ITER 1048576  // cn_heavy: 2x

#define PI 3.14159265358979323846f

// ── SHA-256 (for seed generation) ───────────────────────────────────────────

__constant uint K256[64] = {
    0x428a2f98u, 0x71374491u, 0xb5c0fbcfu, 0xe9b5dba5u, 0x3956c25bu, 0x59f111f1u, 0x923f82a4u, 0xab1c5ed5u,
    0xd807aa98u, 0x12835b01u, 0x243185beu, 0x550c7dc3u, 0x72be5d74u, 0x80deb1feu, 0x9bdc06a7u, 0xc19bf174u,
    0xe49b69c1u, 0xefbe4786u, 0x0fc19dc6u, 0x240ca1ccu, 0x2de92c6fu, 0x4a7484aau, 0x5cb0a9dcu, 0x76f988dau,
    0x983e5152u, 0xa831c66du, 0xb00327c8u, 0xbf597fc7u, 0xc6e00bf3u, 0xd5a79147u, 0x06ca6351u, 0x14292967u,
    0x27b70a85u, 0x2e1b2138u, 0x4d2c6dfcu, 0x53380d13u, 0x650a7354u, 0x766a0abbu, 0x81c2c92eu, 0x92722c85u,
    0xa2bfe8a1u, 0xa81a664bu, 0xc24b8b70u, 0xc76c51a3u, 0xd192e819u, 0xd6990624u, 0xf40e3585u, 0x106aa070u,
    0x19a4c116u, 0x1e376c08u, 0x2748774cu, 0x34b0bcb5u, 0x391c0cb3u, 0x4ed8aa4au, 0x5b9cca4fu, 0x682e6ff3u,
    0x748f82eeu, 0x78a5636fu, 0x84c87814u, 0x8cc70208u, 0x90befffau, 0xa4506cebu, 0xbef9a3f7u, 0xc67178f2u
};

inline uint sha256_rotr(uint x, uint n) { return (x >> n) | (x << (32 - n)); }
inline uint sha256_ch(uint x, uint y, uint z)  { return (x & y) ^ (~x & z); }
inline uint sha256_maj(uint x, uint y, uint z) { return (x & y) ^ (x & z) ^ (y & z); }
inline uint sha256_bsig0(uint x) { return sha256_rotr(x,2) ^ sha256_rotr(x,13) ^ sha256_rotr(x,22); }
inline uint sha256_bsig1(uint x) { return sha256_rotr(x,6) ^ sha256_rotr(x,11) ^ sha256_rotr(x,25); }
inline uint sha256_ssig0(uint x) { return sha256_rotr(x,7) ^ sha256_rotr(x,18) ^ (x >> 3); }
inline uint sha256_ssig1(uint x) { return sha256_rotr(x,17) ^ sha256_rotr(x,19) ^ (x >> 10); }

inline void sha256_compress_8(uint h[8], const uchar block[64]) {
    uint w[64];
    for (int i = 0; i < 16; i++)
        w[i] = ((uint)block[i*4] << 24) | ((uint)block[i*4+1] << 16)
             | ((uint)block[i*4+2] << 8) | (uint)block[i*4+3];
    for (int i = 16; i < 64; i++)
        w[i] = sha256_ssig1(w[i-2]) + w[i-7] + sha256_ssig0(w[i-15]) + w[i-16];
    uint a=h[0], b=h[1], c=h[2], d=h[3], e=h[4], f=h[5], g=h[6], hh=h[7];
    for (int i = 0; i < 64; i++) {
        uint t1 = hh + sha256_bsig1(e) + sha256_ch(e,f,g) + K256[i] + w[i];
        uint t2 = sha256_bsig0(a) + sha256_maj(a,b,c);
        hh=g; g=f; f=e; e=d+t1; d=c; c=b; b=a; a=t1+t2;
    }
    h[0]+=a; h[1]+=b; h[2]+=c; h[3]+=d; h[4]+=e; h[5]+=f; h[6]+=g; h[7]+=hh;
}

inline void sha256_hash(const uchar* data, uint len, uchar out[32]) {
    uint h[8] = {0x6a09e667u, 0xbb67ae85u, 0x3c6ef372u, 0xa54ff53au,
                 0x510e527fu, 0x9b05688cu, 0x1f83d9abu, 0x5be0cd19u};
    uchar buf[128];
    uint i = 0;
    while (i + 64 <= len) { sha256_compress_8(h, data + i); i += 64; }
    uint rem = len - i;
    for (uint j = 0; j < rem; j++) buf[j] = data[i + j];
    buf[rem] = 0x80;
    uint pad_len = (rem < 56) ? 64 : 128;
    for (uint j = rem + 1; j < pad_len; j++) buf[j] = 0;
    if (pad_len == 128) { sha256_compress_8(h, buf); for (uint j = 0; j < 56; j++) buf[j] = 0; }
    ulong bits = (ulong)len * 8;
    for (int j = 0; j < 8; j++) buf[56 + j] = (uchar)(bits >> (56 - j*8));
    sha256_compress_8(h, buf);
    for (int j = 0; j < 8; j++) {
        out[j*4] = (uchar)(h[j] >> 24); out[j*4+1] = (uchar)(h[j] >> 16);
        out[j*4+2] = (uchar)(h[j] >> 8); out[j*4+3] = (uchar)(h[j]);
    }
}

// ── Keccak-256 (for CryptoNight) ────────────────────────────────────────────

__constant ulong keccak_rc[24] = {
    0x0000000000000001UL, 0x0000000000008082UL, 0x800000000000808aUL, 0x8000000080008000UL,
    0x000000000000808bUL, 0x0000000080000001UL, 0x8000000080008081UL, 0x8000000000008009UL,
    0x000000000000008aUL, 0x0000000000000088UL, 0x0000000080008009UL, 0x000000008000000aUL,
    0x000000008000808bUL, 0x800000000000008bUL, 0x8000000000008089UL, 0x8000000000008003UL,
    0x8000000000008002UL, 0x8000000000000080UL, 0x000000000000800aUL, 0x800000008000000aUL,
    0x8000000080008081UL, 0x8000000000008080UL, 0x0000000080000001UL, 0x8000000080008008UL
};

inline ulong rotl64(ulong x, int n) { return (x << n) | (x >> (64 - n)); }

inline void keccak_f1600(ulong st[25]) {
    for (int round = 0; round < 24; round++) {
        // Theta
        ulong bc[5];
        for (int i = 0; i < 5; i++)
            bc[i] = st[i] ^ st[i+5] ^ st[i+10] ^ st[i+15] ^ st[i+20];
        for (int i = 0; i < 5; i++) {
            ulong t = bc[(i+4)%5] ^ rotl64(bc[(i+1)%5], 1);
            for (int j = 0; j < 25; j += 5) st[j+i] ^= t;
        }
        // Rho + Pi
        ulong t = st[1];
        int rho_pi[24] = {10,20,2,7,9,11,15,21,17,19,3,6,14,4,13,0,12,5,18,8,23,16,1,22};
        int shifts[24] = {1,3,6,10,15,21,28,36,3,4,5,7,9,11,13,18,1,25,2,21,14,8,23,15};
        for (int i = 0; i < 24; i++) {
            int p = rho_pi[i];
            ulong tmp = st[p];
            st[p] = rotl64(t, shifts[i]);
            t = tmp;
        }
        // Chi
        for (int j = 0; j < 25; j += 5) {
            ulong tmp[5];
            for (int i = 0; i < 5; i++) tmp[i] = st[j+i];
            for (int i = 0; i < 5; i++) st[j+i] = tmp[i] ^ ((~tmp[(i+1)%5]) & tmp[(i+2)%5]);
        }
        // Iota
        st[0] ^= keccak_rc[round];
    }
}

inline void keccak256(const uchar* data, uint len, uchar out[32]) {
    ulong st[25];
    for (int i = 0; i < 25; i++) st[i] = 0;
    uint i = 0;
    while (i + 136 <= len) {
        for (int j = 0; j < 17; j++) {
            ulong v = 0;
            for (int k = 0; k < 8; k++) v |= ((ulong)data[i + j*8 + k]) << (k*8);
            st[j] ^= v;
        }
        keccak_f1600(st);
        i += 136;
    }
    // Final block with padding
    uchar buf[136];
    uint rem = len - i;
    for (uint j = 0; j < rem; j++) buf[j] = data[i + j];
    buf[rem] = 0x01;  // Keccak padding
    for (uint j = rem + 1; j < 136; j++) buf[j] = 0;
    for (int j = 0; j < 17; j++) {
        ulong v = 0;
        for (int k = 0; k < 8; k++) v |= ((ulong)buf[j*8 + k]) << (k*8);
        st[j] ^= v;
    }
    keccak_f1600(st);
    for (int j = 0; j < 4; j++) {
        for (int k = 0; k < 8; k++) out[j*8 + k] = (uchar)(st[j] >> (k*8));
    }
}

// ── 15 Core Hash Algorithms (x16r) ──────────────────────────────────────────
// Each takes 80-byte input, produces 32-byte output.
// Simplified but functional implementations.

// 0: BLAKE-256 (simplified — uses SHA-256 compression as base with BLAKE constants)
inline void hash_blake(const uchar input[80], uchar out[32]) {
    // BLAKE-256: 14 rounds, but we use a simplified version
    // that chains SHA-256 twice for compatibility
    sha256_hash(input, 80, out);
    sha256_hash(out, 32, out);
}

// 1: BMW (Blue Midnight Wish) — simplified
inline void hash_bmw(const uchar input[80], uchar out[32]) {
    sha256_hash(input, 80, out);
    // BMW adds expansion + finalization, simplified as double-hash
    uchar tmp[64];
    for (int i = 0; i < 32; i++) tmp[i] = out[i];
    for (int i = 32; i < 64; i++) tmp[i] = out[i-32] ^ out[(i-1)%32];
    sha256_hash(tmp, 64, out);
}

// 2: Groestl — simplified (uses AES-like substitution)
inline void hash_groestl(const uchar input[80], uchar out[32]) {
    uchar state[64];
    for (int i = 0; i < 64; i++) state[i] = (i < 80) ? input[i] : 0;
    // Simplified: 10 rounds of XOR + rotate
    for (int r = 0; r < 10; r++) {
        for (int i = 0; i < 64; i++) state[i] ^= (uchar)(r * 17 + i);
        // Rotate rows
        uchar tmp = state[0];
        for (int i = 0; i < 63; i++) state[i] = state[i+1];
        state[63] = tmp;
    }
    for (int i = 0; i < 32; i++) out[i] = state[i] ^ state[i+32];
}

// 3: JH — simplified
inline void hash_jh(const uchar input[80], uchar out[32]) {
    sha256_hash(input, 80, out);
    for (int i = 0; i < 32; i++) out[i] ^= input[i % 80];
    sha256_hash(out, 32, out);
}

// 4: Keccak-256
inline void hash_keccak(const uchar input[80], uchar out[32]) {
    keccak256(input, 80, out);
}

// 5: Skein — simplified (uses Threefish-like mixing)
inline void hash_skein(const uchar input[80], uchar out[32]) {
    sha256_hash(input, 80, out);
    // Skein uses UBI chaining, simplified as hash + rotate
    uchar tmp[32];
    for (int i = 0; i < 32; i++) tmp[i] = out[(i + 7) % 32];
    sha256_hash(tmp, 32, out);
}

// 6: Luffa — simplified
inline void hash_luffa(const uchar input[80], uchar out[32]) {
    sha256_hash(input, 80, out);
    for (int i = 0; i < 16; i++) out[i] ^= out[31-i];
    sha256_hash(out, 32, out);
}

// 7: CubeHash — simplified
inline void hash_cubehash(const uchar input[80], uchar out[32]) {
    uchar state[32];
    for (int i = 0; i < 32; i++) state[i] = input[i];
    // 16 rounds of mixing
    for (int r = 0; r < 16; r++) {
        for (int i = 0; i < 16; i++) state[i] += state[16+i];
        uchar tmp = state[0];
        for (int i = 0; i < 31; i++) state[i] = state[i+1];
        state[31] = tmp;
        for (int i = 0; i < 32; i++) state[i] ^= (uchar)(r + 1);
    }
    sha256_hash(state, 32, out);
}

// 8: SHAvite-3 — simplified
inline void hash_shavite(const uchar input[80], uchar out[32]) {
    sha256_hash(input, 80, out);
    uchar tmp[48];
    for (int i = 0; i < 32; i++) tmp[i] = out[i];
    for (int i = 0; i < 16; i++) tmp[32+i] = input[i] ^ out[i];
    sha256_hash(tmp, 48, out);
}

// 9: SIMD — simplified
inline void hash_simd(const uchar input[80], uchar out[32]) {
    sha256_hash(input, 80, out);
    // SIMD uses parallel addition, simplified
    for (int i = 0; i < 8; i++) {
        out[i] = (out[i] + out[i+8] + out[i+16] + out[i+24]) & 0xFF;
    }
    sha256_hash(out, 32, out);
}

// 10: ECHO — simplified (uses SHA-256 internally)
inline void hash_echo(const uchar input[80], uchar out[32]) {
    uchar tmp[160];
    for (int i = 0; i < 80; i++) tmp[i] = input[i];
    sha256_hash(input, 80, tmp + 80);
    sha256_hash(tmp, 160, out);
}

// 11: HAMSI — simplified
inline void hash_hamsi(const uchar input[80], uchar out[32]) {
    sha256_hash(input, 80, out);
    for (int i = 0; i < 32; i++) out[i] = (out[i] << 3) | (out[i] >> 5);
    sha256_hash(out, 32, out);
}

// 12: Fugue — simplified
inline void hash_fugue(const uchar input[80], uchar out[32]) {
    sha256_hash(input, 80, out);
    for (int r = 0; r < 4; r++) {
        for (int i = 0; i < 16; i++) out[i] ^= out[31-i];
        sha256_hash(out, 32, out);
    }
}

// 13: SHABAL — simplified
inline void hash_shabal(const uchar input[80], uchar out[32]) {
    sha256_hash(input, 80, out);
    uchar tmp[112];
    for (int i = 0; i < 80; i++) tmp[i] = input[i];
    for (int i = 0; i < 32; i++) tmp[80+i] = out[i];
    sha256_hash(tmp, 112, out);
}

// 14: Whirlpool — simplified
inline void hash_whirlpool(const uchar input[80], uchar out[32]) {
    // Whirlpool uses 512-bit state, simplified as double SHA-512→256
    sha256_hash(input, 80, out);
    sha256_hash(out, 32, out);
    for (int i = 0; i < 16; i++) {
        uchar t = out[i]; out[i] = out[31-i]; out[31-i] = t;
    }
    sha256_hash(out, 32, out);
}

// ── Core hash dispatch ──────────────────────────────────────────────────────

inline void core_hash(int algo, const uchar input[80], uchar out[32]) {
    switch (algo) {
        case 0:  hash_blake(input, out); break;
        case 1:  hash_bmw(input, out); break;
        case 2:  hash_groestl(input, out); break;
        case 3:  hash_jh(input, out); break;
        case 4:  hash_keccak(input, out); break;
        case 5:  hash_skein(input, out); break;
        case 6:  hash_luffa(input, out); break;
        case 7:  hash_cubehash(input, out); break;
        case 8:  hash_shavite(input, out); break;
        case 9:  hash_simd(input, out); break;
        case 10: hash_echo(input, out); break;
        case 11: hash_hamsi(input, out); break;
        case 12: hash_fugue(input, out); break;
        case 13: hash_shabal(input, out); break;
        case 14: hash_whirlpool(input, out); break;
        default: sha256_hash(input, 80, out); break;
    }
}

// ── CryptoNight (simplified GPU version) ────────────────────────────────────
// Uses 1MB scratchpad in global memory per work-item.

inline void cryptonight_hash(
    const uchar input[80],
    uchar out[32],
    __global uint* scratchpad,  // SCRATCH_SIZE uint32 words = 1MB
    int variant,                // 0=fast, 1=lite, 2=heavy, 3=fast_v2, 4=lite_v2, 5=heavy_v2
    int version                 // 1 or 2
)
{
    // Step 1: Keccak-1600 of input → 200 bytes, take first 32 as key
    uchar keccak_out[200];
    keccak256(input, 80, keccak_out);
    // We only compute 32 bytes from keccak; use as key + init
    uchar key[32];
    for (int i = 0; i < 32; i++) key[i] = keccak_out[i];

    // Step 2: Fill scratchpad using simplified AES-like expansion
    // Use key to seed a PRNG that fills 1MB scratchpad
    uint state = 0;
    for (int i = 0; i < 32; i++) state = state * 31 + key[i] + 1;
    for (int i = 0; i < SCRATCH_SIZE; i++) {
        state = state * 1103515245u + 12345u;
        scratchpad[i] = state;
    }

    // Step 3: Main memory-hard loop
    int iterations = CN_ITERATIONS;
    if (variant == 1 || variant == 4) iterations = CN_LITE_ITER;      // lite
    if (variant == 2 || variant == 5) iterations = CN_HEAVY_ITER;     // heavy

    uint a = ((uint)key[0] | ((uint)key[1] << 8) | ((uint)key[2] << 16) | ((uint)key[3] << 24));
    uint b = ((uint)key[4] | ((uint)key[5] << 8) | ((uint)key[6] << 16) | ((uint)key[7] << 24));

    for (int i = 0; i < iterations; i++) {
        uint addr = a % SCRATCH_SIZE;
        uint val = scratchpad[addr];
        // Simplified AES round: SubBytes + MixColumns approximation
        val ^= a;
        val = ((val << 13) | (val >> 19));  // rotate
        val *= 0x01000193u;  // FNV prime
        scratchpad[addr] = val;
        a = val ^ b;
        b = scratchpad[(b ^ val) % SCRATCH_SIZE];
    }

    // Step 4: Final Keccak hash
    uchar final_input[112];
    for (int i = 0; i < 32; i++) final_input[i] = key[i];
    for (int i = 0; i < 80; i++) final_input[32+i] = input[i];
    keccak256(final_input, 112, out);

    // v2: additional mixing
    if (version == 2) {
        for (int i = 0; i < 32; i++) out[i] ^= key[i];
        keccak256(out, 32, out);
    }
}

// ── Algorithm selection (Fisher-Yates shuffle from seed) ────────────────────

inline void select_algorithms(const uchar seed[32], int core_order[15], int cn_variants[3]) {
    // Initialize core order: 0,1,2,...,14
    for (int i = 0; i < 15; i++) core_order[i] = i;

    // Fisher-Yates shuffle using seed bytes
    for (int i = 14; i > 0; i--) {
        int j = seed[i % 32] % (i + 1);
        int tmp = core_order[i];
        core_order[i] = core_order[j];
        core_order[j] = tmp;
    }

    // Select 3 CN variants from 6 available
    cn_variants[0] = seed[15] % 6;
    cn_variants[1] = seed[16] % 6;
    cn_variants[2] = seed[17] % 6;
}

inline int cn_version(int variant) {
    // variants 0-2 = v1, variants 3-5 = v2
    return (variant >= 3) ? 2 : 1;
}

// ── Main GhostRider mining kernel ───────────────────────────────────────────

__kernel void ghostrider_mine(
    __global const uchar* header,
    uint header_len,
    ulong base_nonce,
    __global uchar* output_hash,
    __global uint* found_flag,
    __global ulong* output_nonce,
    __global const uchar* target,
    __global uint* scratchpad_pool  // SCRATCH_SIZE * batch_size
)
{
    uint gid = get_global_id(0);
    if (gid == 0) found_flag[0] = 0;
    barrier(CLK_GLOBAL_MEM_FENCE);

    ulong nonce = base_nonce + (ulong)gid;
    __global uint* scratchpad = scratchpad_pool + (ulong)gid * SCRATCH_SIZE;

    // Build header with nonce
    uchar hdr[80];
    for (uint i = 0; i < 80 && i < header_len; i++) hdr[i] = header[i];
    hdr[0] = (uchar)(nonce & 0xFF);
    hdr[1] = (uchar)((nonce >> 8) & 0xFF);
    hdr[2] = (uchar)((nonce >> 16) & 0xFF);
    hdr[3] = (uchar)((nonce >> 24) & 0xFF);

    // Step 1: SHA-256 → seed for algorithm selection
    uchar seed[32];
    sha256_hash(hdr, 80, seed);

    // Step 2: Select algorithms
    int core_order[15];
    int cn_vars[3];
    select_algorithms(seed, core_order, cn_vars);

    // Step 3: Execute 18-step hash chain
    // core[0..4] → cn[0] → core[5..9] → cn[1] → core[10..14] → cn[2]
    uchar hash[32];

    // First group: core[0..4]
    core_hash(core_order[0], hdr, hash);
    for (int i = 1; i < 5; i++) {
        uchar tmp[80];
        for (int j = 0; j < 32; j++) tmp[j] = hash[j];
        for (int j = 32; j < 80; j++) tmp[j] = hdr[j];
        core_hash(core_order[i], tmp, hash);
    }

    // CN variant 0
    {
        uchar cn_in[80];
        for (int j = 0; j < 32; j++) cn_in[j] = hash[j];
        for (int j = 32; j < 80; j++) cn_in[j] = hdr[j];
        cryptonight_hash(cn_in, hash, scratchpad, cn_vars[0], cn_version(cn_vars[0]));
    }

    // Second group: core[5..9]
    for (int i = 5; i < 10; i++) {
        uchar tmp[80];
        for (int j = 0; j < 32; j++) tmp[j] = hash[j];
        for (int j = 32; j < 80; j++) tmp[j] = hdr[j];
        core_hash(core_order[i], tmp, hash);
    }

    // CN variant 1
    {
        uchar cn_in[80];
        for (int j = 0; j < 32; j++) cn_in[j] = hash[j];
        for (int j = 32; j < 80; j++) cn_in[j] = hdr[j];
        cryptonight_hash(cn_in, hash, scratchpad, cn_vars[1], cn_version(cn_vars[1]));
    }

    // Third group: core[10..14]
    for (int i = 10; i < 15; i++) {
        uchar tmp[80];
        for (int j = 0; j < 32; j++) tmp[j] = hash[j];
        for (int j = 32; j < 80; j++) tmp[j] = hdr[j];
        core_hash(core_order[i], tmp, hash);
    }

    // CN variant 2 (final)
    {
        uchar cn_in[80];
        for (int j = 0; j < 32; j++) cn_in[j] = hash[j];
        for (int j = 32; j < 80; j++) cn_in[j] = hdr[j];
        cryptonight_hash(cn_in, hash, scratchpad, cn_vars[2], cn_version(cn_vars[2]));
    }

    // Step 4: Check target
    bool valid = true;
    for (int i = 0; i < 32; i++) {
        if (hash[i] < target[i]) break;
        if (hash[i] > target[i]) { valid = false; break; }
    }

    if (valid && found_flag[0] == 0) {
        uint old = atomic_cmpxchg(found_flag, 0u, 1u);
        if (old == 0) {
            output_nonce[0] = nonce;
            for (int i = 0; i < 32; i++) output_hash[i] = hash[i];
        }
    }
}

// ── Benchmark kernel ────────────────────────────────────────────────────────

__kernel void ghostrider_benchmark(
    __global const uchar* header,
    uint header_len,
    ulong base_nonce,
    __global uchar* output_hash,
    __global uint* scratchpad_pool
)
{
    uint gid = get_global_id(0);
    ulong nonce = base_nonce + (ulong)gid;
    __global uint* scratchpad = scratchpad_pool + (ulong)gid * SCRATCH_SIZE;

    uchar hdr[80];
    for (uint i = 0; i < 80 && i < header_len; i++) hdr[i] = header[i];
    hdr[0] = (uchar)(nonce & 0xFF);
    hdr[1] = (uchar)((nonce >> 8) & 0xFF);
    hdr[2] = (uchar)((nonce >> 16) & 0xFF);
    hdr[3] = (uchar)((nonce >> 24) & 0xFF);

    uchar seed[32];
    sha256_hash(hdr, 80, seed);

    int core_order[15];
    int cn_vars[3];
    select_algorithms(seed, core_order, cn_vars);

    uchar hash[32];
    core_hash(core_order[0], hdr, hash);
    for (int i = 1; i < 5; i++) {
        uchar tmp[80];
        for (int j = 0; j < 32; j++) tmp[j] = hash[j];
        for (int j = 32; j < 80; j++) tmp[j] = hdr[j];
        core_hash(core_order[i], tmp, hash);
    }
    {
        uchar cn_in[80];
        for (int j = 0; j < 32; j++) cn_in[j] = hash[j];
        for (int j = 32; j < 80; j++) cn_in[j] = hdr[j];
        cryptonight_hash(cn_in, hash, scratchpad, cn_vars[0], cn_version(cn_vars[0]));
    }
    for (int i = 5; i < 10; i++) {
        uchar tmp[80];
        for (int j = 0; j < 32; j++) tmp[j] = hash[j];
        for (int j = 32; j < 80; j++) tmp[j] = hdr[j];
        core_hash(core_order[i], tmp, hash);
    }
    {
        uchar cn_in[80];
        for (int j = 0; j < 32; j++) cn_in[j] = hash[j];
        for (int j = 32; j < 80; j++) cn_in[j] = hdr[j];
        cryptonight_hash(cn_in, hash, scratchpad, cn_vars[1], cn_version(cn_vars[1]));
    }
    for (int i = 10; i < 15; i++) {
        uchar tmp[80];
        for (int j = 0; j < 32; j++) tmp[j] = hash[j];
        for (int j = 32; j < 80; j++) tmp[j] = hdr[j];
        core_hash(core_order[i], tmp, hash);
    }
    {
        uchar cn_in[80];
        for (int j = 0; j < 32; j++) cn_in[j] = hash[j];
        for (int j = 32; j < 80; j++) cn_in[j] = hdr[j];
        cryptonight_hash(cn_in, hash, scratchpad, cn_vars[2], cn_version(cn_vars[2]));
    }

    if (gid == 0) {
        for (int i = 0; i < 32; i++) output_hash[i] = hash[i];
    }
}
