// BTCunlock — BIP39 recovery kernels.
//
// Pipeline (three kernels per batch):
//   bip39_filter: combo → word indices → checksum (SHA-256) → for survivors,
//                 build phrase + U1 = HMAC(phrase, salt||1) → state record
//   pbkdf2_step:  per state record, run CHUNK HMAC iterations
//                 (U = HMAC(U); T ^= U) — launched ceil(2047/CHUNK) times
//   derive_match: per finished record, seed → BIP32/secp256k1 → hash160 →
//                 target match; only hits + dead items leave the device
//
// PBKDF2 is chunked across launches because a 2048-iteration HMAC loop in a
// single work-item exceeds per-item execution limits on some stacks (Apple
// OpenCL loses ~75% of items at the full count — verified 2026-09).
//
// State record per valid candidate (byte offsets):
//   [0..8)    combo (u64)
//   [8..12)   plen (u32)
//   [12..260) phrase bytes
//   [260..324) u   — current U_i
//   [324..388) t   — accumulator; equals the seed after the last step
//   [392..456) hin  — SHA-512 midstate of k0^ipad (HMAC key = phrase)
//   [456..520) hout — SHA-512 midstate of k0^opad
//   midstates let pbkdf2_step run 2 compressions/iter without ever
//   loading the phrase into private memory.

#define MAX_WORDS 24
#define MAX_HOLES 6
#define MAX_SALT 128
#define MAX_PHRASE 248
#define STATE_SIZE 520
#define OFF_COMBO 0
#define OFF_PLEN 8
#define OFF_PHRASE 12
#define OFF_U 260
#define OFF_T 324
#define OFF_HI 392
#define OFF_HO 456
#define OFF_TAG 388
#define TAG_C 0x9E3779B9u
#define TAG_BAD 0xDEADDEADu

// 64-bit atomics for the permute dedupe set (NVIDIA/AMD/Intel all expose it)
#pragma OPENCL EXTENSION cl_khr_int64_base_atomics : enable

// ---------------------------------------------------------------- SHA-256

__constant uint K256[64] = {
    0x428a2f98U,0x71374491U,0xb5c0fbcfU,0xe9b5dba5U,0x3956c25bU,0x59f111f1U,0x923f82a4U,0xab1c5ed5U,
    0xd807aa98U,0x12835b01U,0x243185beU,0x550c7dc3U,0x72be5d74U,0x80deb1feU,0x9bdc06a7U,0xc19bf174U,
    0xe49b69c1U,0xefbe4786U,0x0fc19dc6U,0x240ca1ccU,0x2de92c6fU,0x4a7484aaU,0x5cb0a9dcU,0x76f988daU,
    0x983e5152U,0xa831c66dU,0xb00327c8U,0xbf597fc7U,0xc6e00bf3U,0xd5a79147U,0x06ca6351U,0x14292967U,
    0x27b70a85U,0x2e1b2138U,0x4d2c6dfcU,0x53380d13U,0x650a7354U,0x766a0abbU,0x81c2c92eU,0x92722c85U,
    0xa2bfe8a1U,0xa81a664bU,0xc24b8b70U,0xc76c51a3U,0xd192e819U,0xd6990624U,0xf40e3585U,0x106aa070U,
    0x19a4c116U,0x1e376c08U,0x2748774cU,0x34b0bcb5U,0x391c0cb3U,0x4ed8aa4aU,0x5b9cca4fU,0x682e6ff3U,
    0x748f82eeU,0x78a5636fU,0x84c87814U,0x8cc70208U,0x90befffaU,0xa4506cebU,0xbef9a3f7U,0xc67178f2U,
};

// Circular W[16] + fully unrolled loops — after unrolling every index is
// compile-time constant and the schedule lives in registers. A w[64] array
// indexed by a loop variable spills to local memory (~10x slower). NOTE:
// hand-rolled macro unrolling miscompiles on NVIDIA's frontend (verified
// 2026-09-20, GTX 1070 Ti) — use #pragma unroll, not macro expansion.

#define SHA256_ROUNDS \
    _Pragma("unroll") \
    for (int i = 0; i < 64; i++) { \
        if (i >= 16) \
            W[i&15] += (rotate(W[(i-2)&15],15U)^rotate(W[(i-2)&15],13U)^(W[(i-2)&15]>>10)) \
                     + W[(i-7)&15] \
                     + (rotate(W[(i-15)&15],25U)^rotate(W[(i-15)&15],14U)^(W[(i-15)&15]>>3)); \
        uint t1 = hh + (rotate(e,26U)^rotate(e,21U)^rotate(e,7U)) \
                + ((e&f)^(~e&g)) + K256[i] + W[i&15]; \
        uint t2 = (rotate(a,30U)^rotate(a,19U)^rotate(a,10U)) \
                + ((a&b)^(a&c)^(b&c)); \
        hh=g; g=f; f=e; e=d+t1; d=c; c=b; b=a; a=t1+t2; \
    }

// Word-form block — the checksum filter builds W directly (entropy packed
// into ulong lanes), skipping byte-level staging entirely.
static void sha256_compress_w(__private uint h[8], __private const uint blk[16]) {
    uint W[16];
    #pragma unroll
    for (int i = 0; i < 16; i++) W[i] = blk[i];
    uint a=h[0],b=h[1],c=h[2],d=h[3],e=h[4],f=h[5],g=h[6],hh=h[7];
    SHA256_ROUNDS
    h[0]+=a; h[1]+=b; h[2]+=c; h[3]+=d; h[4]+=e; h[5]+=f; h[6]+=g; h[7]+=hh;
}

// ---------------------------------------------------------------- SHA-512

__constant ulong K512[80] = {
    0x428a2f98d728ae22UL,0x7137449123ef65cdUL,0xb5c0fbcfec4d3b2fUL,0xe9b5dba58189dbbcUL,
    0x3956c25bf348b538UL,0x59f111f1b605d019UL,0x923f82a4af194f9bUL,0xab1c5ed5da6d8118UL,
    0xd807aa98a3030242UL,0x12835b0145706fbeUL,0x243185be4ee4b28cUL,0x550c7dc3d5ffb4e2UL,
    0x72be5d74f27b896fUL,0x80deb1fe3b1696b1UL,0x9bdc06a725c71235UL,0xc19bf174cf692694UL,
    0xe49b69c19ef14ad2UL,0xefbe4786384f25e3UL,0x0fc19dc68b8cd5b5UL,0x240ca1cc77ac9c65UL,
    0x2de92c6f592b0275UL,0x4a7484aa6ea6e483UL,0x5cb0a9dcbd41fbd4UL,0x76f988da831153b5UL,
    0x983e5152ee66dfabUL,0xa831c66d2db43210UL,0xb00327c898fb213fUL,0xbf597fc7beef0ee4UL,
    0xc6e00bf33da88fc2UL,0xd5a79147930aa725UL,0x06ca6351e003826fUL,0x142929670a0e6e70UL,
    0x27b70a8546d22ffcUL,0x2e1b21385c26c926UL,0x4d2c6dfc5ac42aedUL,0x53380d139d95b3dfUL,
    0x650a73548baf63deUL,0x766a0abb3c77b2a8UL,0x81c2c92e47edaee6UL,0x92722c851482353bUL,
    0xa2bfe8a14cf10364UL,0xa81a664bbc423001UL,0xc24b8b70d0f89791UL,0xc76c51a30654be30UL,
    0xd192e819d6ef5218UL,0xd69906245565a910UL,0xf40e35855771202aUL,0x106aa07032bbd1b8UL,
    0x19a4c116b8d2d0c8UL,0x1e376c085141ab53UL,0x2748774cdf8eeb99UL,0x34b0bcb5e19b48a8UL,
    0x391c0cb3c5c95a63UL,0x4ed8aa4ae3418acbUL,0x5b9cca4f7763e373UL,0x682e6ff3d6b2b8a3UL,
    0x748f82ee5defb2fcUL,0x78a5636f43172f60UL,0x84c87814a1f0ab72UL,0x8cc702081a6439ecUL,
    0x90befffa23631e28UL,0xa4506cebde82bde9UL,0xbef9a3f7b2c67915UL,0xc67178f2e372532bUL,
    0xca273eceea26619cUL,0xd186b8c721c0c207UL,0xeada7dd6cde0eb1eUL,0xf57d4f7fee6ed178UL,
    0x06f067aa72176fbaUL,0x0a637dc5a2c898a6UL,0x113f9804bef90daeUL,0x1b710b35131c471bUL,
    0x28db77f523047d84UL,0x32caab7b40c72493UL,0x3c9ebe0a15c9bebcUL,0x431d67c49c100d4cUL,
    0x4cc5d4becb3e42b6UL,0x597f299cfc657e2aUL,0x5fcb6fab3ad6faecUL,0x6c44198c4a475817UL,
};

#define SHA512_IV \
    0x6a09e667f3bcc908UL,0xbb67ae8584caa73bUL, \
    0x3c6ef372fe94f82bUL,0xa54ff53a5f1d36f1UL, \
    0x510e527fade682d1UL,0x9b05688c2b3e6c1fUL, \
    0x1f83d9abfb41bd6bUL,0x5be0cd19137e2179UL

// rounds shared by both block forms — W[16] circular schedule, fully unrolled
#define SHA512_ROUNDS \
    _Pragma("unroll") \
    for (int i = 0; i < 80; i++) { \
        if (i >= 16) \
            W[i&15] += (rotate(W[(i-2)&15],45UL)^rotate(W[(i-2)&15],3UL)^(W[(i-2)&15]>>6)) \
                     + W[(i-7)&15] \
                     + (rotate(W[(i-15)&15],63UL)^rotate(W[(i-15)&15],56UL)^(W[(i-15)&15]>>7)); \
        ulong t1 = hh + (rotate(e,50UL)^rotate(e,46UL)^rotate(e,23UL)) \
                 + ((e&f)^(~e&g)) + K512[i] + W[i&15]; \
        ulong t2 = (rotate(a,36UL)^rotate(a,30UL)^rotate(a,25UL)) \
                 + ((a&b)^(a&c)^(b&c)); \
        hh=g; g=f; f=e; e=d+t1; d=c; c=b; b=a; a=t1+t2; \
    }

static void sha512_compress(__private ulong h[8], __private const uchar blk[128]) {
    ulong W[16];
    #pragma unroll
    for (int i = 0; i < 16; i++) {
        W[i] = ((ulong)blk[i*8] << 56) | ((ulong)blk[i*8+1] << 48) |
               ((ulong)blk[i*8+2] << 40) | ((ulong)blk[i*8+3] << 32) |
               ((ulong)blk[i*8+4] << 24) | ((ulong)blk[i*8+5] << 16) |
               ((ulong)blk[i*8+6] << 8) | (ulong)blk[i*8+7];
    }
    ulong a=h[0],b=h[1],c=h[2],d=h[3],e=h[4],f=h[5],g=h[6],hh=h[7];
    SHA512_ROUNDS
    h[0]+=a; h[1]+=b; h[2]+=c; h[3]+=d; h[4]+=e; h[5]+=f; h[6]+=g; h[7]+=hh;
}

// Same rounds, block already in ulong form — the PBKDF2 loop builds its
// message words directly (no byte packing/unpacking per iteration).
static void sha512_compress_w(__private ulong h[8], __private const ulong blk[16]) {
    ulong W[16];
    #pragma unroll
    for (int i = 0; i < 16; i++) W[i] = blk[i];
    ulong a=h[0],b=h[1],c=h[2],d=h[3],e=h[4],f=h[5],g=h[6],hh=h[7];
    SHA512_ROUNDS
    h[0]+=a; h[1]+=b; h[2]+=c; h[3]+=d; h[4]+=e; h[5]+=f; h[6]+=g; h[7]+=hh;
}

// SHA-512 absorb from a midstate: h already holds the compression of
// `prior` bytes (e.g. an HMAC pad block); `total_len` = prior + mlen is
// what goes into the padding length field. This is how emit_if_valid
// computes U1 = HMAC(key, salt‖1) from the stored midstates — 2 absorbs
// instead of a full HMAC (no k0/inner/outer buffers).
static void sha512_absorb(__private ulong h[8], __private const uchar* m,
                          uint mlen, uint total_len, __private uchar out[64]) {
    uint off = 0;
    while (mlen - off >= 128) {
        sha512_compress(h, m + off);
        off += 128;
    }
    uchar tail[256];
    for (int i = 0; i < 256; i++) tail[i] = 0;
    uint rem = mlen - off;
    for (uint i = 0; i < rem; i++) tail[i] = m[off + i];
    tail[rem] = 0x80;
    uint tail_blocks = (rem < 112) ? 1 : 2;
    ulong bits = (ulong)total_len * 8;
    uint base = tail_blocks * 128;
    for (int i = 0; i < 8; i++) tail[base - 1 - i] = (uchar)(bits >> (8*i));
    sha512_compress(h, tail);
    if (tail_blocks == 2) sha512_compress(h, tail + 128);
    for (int i = 0; i < 8; i++) {
        out[i*8]   = (uchar)(h[i] >> 56);
        out[i*8+1] = (uchar)(h[i] >> 48);
        out[i*8+2] = (uchar)(h[i] >> 40);
        out[i*8+3] = (uchar)(h[i] >> 32);
        out[i*8+4] = (uchar)(h[i] >> 24);
        out[i*8+5] = (uchar)(h[i] >> 16);
        out[i*8+6] = (uchar)(h[i] >> 8);
        out[i*8+7] = (uchar)h[i];
    }
}

// SHA-512 of a message ≤ 392 bytes.
static void sha512(__private const uchar* m, uint len, __private uchar out[64]) {
    ulong h[8] = {SHA512_IV};
    sha512_absorb(h, m, len, len, out);
}

// ------------------------------------------------------------------ filter

// Shared tail for both filter kernels: idx[] → checksum → phrase → U1 →
// state record. `record_id` is stored at OFF_COMBO (combo or perm number).
static void emit_if_valid(
    __private const ushort* idx,
    const uint n_words,
    const ulong record_id,
    __global const uchar*  wl_blob,
    __global const ushort* wl_off,
    __global const uchar*  salt,
    const uint salt_len,
    const uint max_results,
    volatile __global uint* result_count,
    __global uchar* states)
{
    // BIP39 checksum — the 11-bit index stream packed MSB-first into ulong
    // lanes. Fully unrolled → every shift/lane is compile-time → registers.
    // (The byte-wise ent[pos/8] form spilled to local memory via dynamic
    // indexing; this does ~2 lane writes per word instead of 11 byte ops.)
    uint total_bits = n_words * 11;
    uint cs_bits = total_bits / 33;
    uint ent_bits = total_bits - cs_bits;
    ulong eb[5] = {0UL, 0UL, 0UL, 0UL, 0UL};
    ulong lastv = 0;
    #pragma unroll
    for (int i = 0; i < MAX_WORDS; i++) {
        if (i >= (int)n_words) break;
        ulong v = idx[i];
        lastv = v;
        int p = i * 11, o = p & 63, k = p >> 6;
        if (o <= 53) {
            eb[k] |= v << (53 - o);
        } else {
            eb[k]     |= v >> (o - 53);
            eb[k + 1] |= v << (117 - o);
        }
    }
    // entropy = first ent_bits of the stream; sha256 block built in words:
    // W[0..8) = entropy, 0x80 lands at word ent_bytes/4 (ent_bytes%4==0 for
    // all BIP39 word counts — and the checksum bits always live inside that
    // very word, so the overwrite discards them), W[15] = bit length.
    // The switch keeps every wb index compile-time — a dynamic wb[ent/32]
    // would spill the whole block to local memory.
    uint wb[16];
    #pragma unroll
    for (int i = 0; i < 8; i++) wb[i] = (uint)(eb[i >> 1] >> (32 * (1 - (i & 1))));
    #pragma unroll
    for (int i = 8; i < 16; i++) wb[i] = 0;
    switch (n_words) {
    case 12: wb[4] = 0x80000000u; break;
    case 15: wb[5] = 0x80000000u; break;
    case 18: wb[6] = 0x80000000u; break;
    case 21: wb[7] = 0x80000000u; break;
    default: wb[8] = 0x80000000u; break;   // 24
    }
    wb[15] = ent_bits;
    uint hs[8] = {0x6a09e667U,0xbb67ae85U,0x3c6ef372U,0xa54ff53aU,
                  0x510e527fU,0x9b05688cU,0x1f83d9abU,0x5be0cd19U};
    sha256_compress_w(hs, wb);
    // checksum bits = low cs_bits of the last word index (cs_bits ≤ 8 < 11),
    // left-aligned in a byte — scalar ops, no dynamic lane indexing.
    uchar cs_val = (uchar)((lastv & ((1UL << cs_bits) - 1)) << (8 - cs_bits));
    uchar mask = (uchar)(0xFF << (8 - cs_bits));
    if (((uchar)(hs[0] >> 24) & mask) != cs_val) return;   // ~15/16 exit here

    // checksum-valid → phrase string (ASCII words + spaces)
    uchar phrase[MAX_PHRASE];
    uint plen = 0;
    for (uint i = 0; i < n_words; i++) {
        if (i) phrase[plen++] = ' ';
        ushort w = idx[i];
        for (ushort o = wl_off[w]; o < wl_off[w + 1]; o++)
            phrase[plen++] = wl_blob[o];
    }

    // HMAC midstates for pbkdf2_step: hin = SHA512(k0^ipad),
    // hout = SHA512(k0^opad). k0 = phrase||0 — or SHA512(phrase) when
    // the phrase exceeds the 128-byte block (24-word phrases do).
    uchar pb[128];
    if (plen > 128) {
        uchar kh[64];
        sha512(phrase, plen, kh);
        for (int i = 0; i < 128; i++) pb[i] = i < 64 ? kh[i] : 0;
    } else {
        for (int i = 0; i < 128; i++) pb[i] = (uint)i < plen ? phrase[i] : 0;
    }
    ulong hin[8] = {SHA512_IV}, hout[8] = {SHA512_IV};
    for (int i = 0; i < 128; i++) pb[i] ^= 0x36;
    sha512_compress(hin, pb);
    for (int i = 0; i < 128; i++) pb[i] ^= 0x6a;   // ipad → opad
    sha512_compress(hout, pb);

    // U1 = HMAC(phrase, salt‖INT32_BE(1)) via the same midstates —
    // two absorbs, no k0/inner/outer buffers.
    uchar m[MAX_SALT + 4];
    for (uint i = 0; i < salt_len; i++) m[i] = salt[i];
    m[salt_len] = 0; m[salt_len+1] = 0; m[salt_len+2] = 0; m[salt_len+3] = 1;
    uchar ih[64], u1[64];
    ulong hh[8];
    #pragma unroll
    for (int i = 0; i < 8; i++) hh[i] = hin[i];
    sha512_absorb(hh, m, salt_len + 4, 128 + salt_len + 4, ih);
    #pragma unroll
    for (int i = 0; i < 8; i++) hh[i] = hout[i];
    sha512_absorb(hh, ih, 64, 192, u1);

    uint slot = atomic_inc(result_count);
    if (slot >= max_results) return;
    __global uchar* st = states + (ulong)slot * STATE_SIZE;
    *((__global ulong*)(st + OFF_COMBO)) = record_id;
    *((__global uint*)(st + OFF_PLEN)) = plen;
    for (uint i = 0; i < plen; i++) st[OFF_PHRASE + i] = phrase[i];
    for (int i = 0; i < 64; i++) {
        st[OFF_U + i] = u1[i];
        st[OFF_T + i] = u1[i];
    }
    for (int i = 0; i < 8; i++) {
        ulong vi = hin[i], vo = hout[i];
        for (int j = 0; j < 8; j++) {
            st[OFF_HI + i*8 + j] = (uchar)(vi >> (56 - 8*j));
            st[OFF_HO + i*8 + j] = (uchar)(vo >> (56 - 8*j));
        }
    }
    // chain tag seq=0: u32(T[0..4]) — written LAST as the commit point:
    // a work-item killed mid-emit leaves a stale tag and the record is
    // CPU-repaired on the host instead of propagating a corrupt state.
    *((__global uint*)(st + OFF_TAG)) =
        (uint)u1[0] | ((uint)u1[1] << 8) | ((uint)u1[2] << 16) | ((uint)u1[3] << 24);
}

// One work-item per combo. Checksum survivors get a state record with
// U1 already computed (2047 iterations remain for pbkdf2_step).
__kernel void bip39_filter(
    __global const uchar*  wl_blob,
    __global const ushort* wl_off,
    __global const ushort* templ,
    const uint n_words,
    __global const uchar*  hole_pos,
    const uint n_holes,
    const ulong combo_base,
    __global const uchar*  salt,
    const uint salt_len,
    const uint max_results,
    volatile __global uint*  result_count,
    __global uchar* states)               // max_results × STATE_SIZE
{
    ulong combo = combo_base + get_global_id(0);

    ushort idx[MAX_WORDS];
    for (uint i = 0; i < n_words; i++) idx[i] = templ[i];
    ulong rem = combo;
    for (int h = (int)n_holes - 1; h >= 0; h--) {
        idx[hole_pos[h]] = (ushort)(rem % 2048);
        rem /= 2048;
    }
    emit_if_valid(idx, n_words, combo, wl_blob, wl_off, salt, salt_len,
                  max_results, result_count, states);
}

// Phrase dedupe for permute: duplicate input words make many perm ids
// decode to the same arrangement — same idx[] → same phrase → same seed.
// A global open-addressed u64 set persists across batches (zeroed at bind),
// so each distinct phrase is PBKDF2'd once per run, not once per perm.
// Returns 1 when `key` was newly inserted (caller proceeds with the emit).
static int dedup_insert(volatile __global ulong* set, uint mask, ulong key) {
    uint slot = (uint)((key * 0x9E3779B97F4A7C15UL) >> 43) & mask;
    for (uint i = 0; i < 64; i++) {
        ulong old = atom_cmpxchg(set + ((slot + i) & mask), 0UL, key);
        if (old == 0 || old == key) return old == 0;
    }
    return 1; // set hopelessly full — emit anyway (dup work, never loss)
}

// One work-item per permutation number: factoradic (Lehmer) decode of
// `words` into idx[], dedupe, then the shared checksum→U1 tail. `words`
// must be sorted ascending so perm numbering matches the host
// (perm_indices).
__kernel void permute_filter(
    __global const uchar*  wl_blob,
    __global const ushort* wl_off,
    __global const ushort* words,         // n_words sorted indices
    const uint n_words,
    const ulong perm_base,
    __global const uchar*  salt,
    const uint salt_len,
    const uint max_results,
    volatile __global uint* result_count,
    __global uchar* states,
    volatile __global ulong* dedup_set,
    const uint dedup_mask)
{
    ulong pid = perm_base + get_global_id(0);
    ulong p = pid;
    ushort pool[MAX_WORDS];
    for (uint i = 0; i < n_words; i++) pool[i] = words[i];
    ushort idx[MAX_WORDS];
    for (uint k = 0; k < n_words; k++) {
        uint m = n_words - k;
        uint i = (uint)(p % (ulong)m);
        p /= (ulong)m;
        idx[k] = pool[i];
        for (uint j = i; j + 1 < m; j++) pool[j] = pool[j + 1];
    }
    // FNV-1a over the arrangement — same hash as the host's idx_key
    ulong dk = 0xcbf29ce484222325UL;
    for (uint i = 0; i < n_words; i++) {
        dk ^= idx[i];
        dk *= 0x100000001b3UL;
    }
    dk |= 1UL; // 0 marks an empty slot
    if (!dedup_insert(dedup_set, dedup_mask, dk)) return;
    emit_if_valid(idx, n_words, pid, wl_blob, wl_off, salt, salt_len,
                  max_results, result_count, states);
}

// --------------------------------------------------------------- pbkdf2 it

// One work-item per state record: `iters` HMAC rounds, state persists
// across launches. Host launches seq=1..N. Each launch first verifies the
// chain tag left by the previous one — a work-item killed in launch k
// (driver per-item limits) leaves T/tag one step stale, so every later
// launch for that record flags TAG_BAD and the host CPU-repairs it.
// PBKDF2 via precomputed midstates — the HMAC key (phrase) is constant, so
// each iteration is 2 compressions: SHA512(hin ‖ pad(U)) then
// SHA512(hout ‖ pad(inner)). U/T live as ulong[8] in registers; record
// bytes are touched only at the start/end of a launch.
__kernel void pbkdf2_step(
    __global uchar* states,
    const uint iters,
    const uint seq)
{
    __global uchar* st = states + (ulong)get_global_id(0) * STATE_SIZE;
    uint plen = *((__global const uint*)(st + OFF_PLEN));
    if (plen == 0 || plen > MAX_PHRASE) {
        *((__global uint*)(st + OFF_TAG)) = TAG_BAD;
        return;
    }
    // load U, T and the HMAC midstates (BE bytes → ulongs). U lives in the
    // message block mb[0..8) — no separate u[] array (saves 16 registers
    // and one 8-word copy per iteration).
    ulong mb[16], t[8], hin[8], hout[8];
    #pragma unroll
    for (int i = 0; i < 8; i++) {
        ulong uv = 0, tv = 0, vi = 0, vo = 0;
        #pragma unroll
        for (int j = 0; j < 8; j++) {
            uv = (uv << 8) | st[OFF_U  + i*8 + j];
            tv = (tv << 8) | st[OFF_T  + i*8 + j];
            vi = (vi << 8) | st[OFF_HI + i*8 + j];
            vo = (vo << 8) | st[OFF_HO + i*8 + j];
        }
        mb[i] = uv; t[i] = tv; hin[i] = vi; hout[i] = vo;
    }
    // verify chain: tag must equal u32(T[0..4]) ^ (seq-1)*TAG_C
    uint tag = *((__global const uint*)(st + OFF_TAG));
    uint head = (uint)st[OFF_T] | ((uint)st[OFF_T+1] << 8)
              | ((uint)st[OFF_T+2] << 16) | ((uint)st[OFF_T+3] << 24);
    if (tag != (head ^ (seq - 1u) * TAG_C)) {
        *((__global uint*)(st + OFF_TAG)) = TAG_BAD;
        return;
    }
    // message block: U(64B) + fixed padding — total msg 192 B → len 1536
    mb[8] = 0x8000000000000000UL; mb[15] = 1536UL;
    mb[9] = 0; mb[10] = 0; mb[11] = 0; mb[12] = 0; mb[13] = 0; mb[14] = 0;
    for (uint it = 0; it < iters; it++) {
        ulong h[8];
        #pragma unroll
        for (int i = 0; i < 8; i++) h[i] = hin[i];
        sha512_compress_w(h, mb);        // inner = SHA512(ipad ‖ U)
        #pragma unroll
        for (int i = 0; i < 8; i++) { mb[i] = h[i]; h[i] = hout[i]; }
        sha512_compress_w(h, mb);        // outer = SHA512(opad ‖ inner)
        #pragma unroll
        for (int i = 0; i < 8; i++) { mb[i] = h[i]; t[i] ^= h[i]; }
    }
    #pragma unroll
    for (int i = 0; i < 8; i++) {
        ulong uv = mb[i], tv = t[i];
        #pragma unroll
        for (int j = 0; j < 8; j++) {
            st[OFF_U + i*8 + j] = (uchar)(uv >> (56 - 8*j));
            st[OFF_T + i*8 + j] = (uchar)(tv >> (56 - 8*j));
        }
    }
    *((__global uint*)(st + OFF_TAG)) =
        ((uint)st[OFF_T] | ((uint)st[OFF_T+1] << 8)
        | ((uint)st[OFF_T+2] << 16) | ((uint)st[OFF_T+3] << 24)) ^ seq * TAG_C;
}

// ============================================================ stage 4: EC
//
// secp256k1 + BIP32 CKD + hash160 + target match, fully on-GPU. The host
// then only sees hit records — no per-seed CPU derivation at all.
//
// 256-bit integers = uint[8] little-endian limbs (v[0] = LSW). All array
// indexing is compile-time (unrolled loops) — same discipline as the hash
// code: dynamic private-array indexing spills to local memory.

__constant uint FP[8] = {0xFFFFFC2Fu,0xFFFFFFFEu,0xFFFFFFFFu,0xFFFFFFFFu,
                         0xFFFFFFFFu,0xFFFFFFFFu,0xFFFFFFFFu,0xFFFFFFFFu};
// group order n
__constant uint FN[8] = {0xD0364141u,0xBFD25E8Cu,0xAF48A03Bu,0xBAAEDCE6u,
                         0xFFFFFFFEu,0xFFFFFFFFu,0xFFFFFFFFu,0xFFFFFFFFu};
// p - 2 (inversion exponent)
__constant uint FE2[8] = {0xFFFFFC2Du,0xFFFFFFFEu,0xFFFFFFFFu,0xFFFFFFFFu,
                          0xFFFFFFFFu,0xFFFFFFFFu,0xFFFFFFFFu,0xFFFFFFFFu};
// generator G, affine
__constant uint GX[8] = {0x16F81798u,0x59F2815Bu,0x2DCE28D9u,0x029BFCDBu,
                         0xCE870B07u,0x55A06295u,0xF9DCBBACu,0x79BE667Eu};
__constant uint GY[8] = {0xFB10D4B8u,0x9C47D08Fu,0xA6855419u,0xFD17B448u,
                         0x0E1108A8u,0x5DA4FBFCu,0x26A3C465u,0x483ADA77u};

static int u256_ge(__private const uint a[8], __private const uint b[8]) {
    #pragma unroll
    for (int i = 7; i >= 0; i--)
        if (a[i] != b[i]) return a[i] > b[i];
    return 1;
}

static uint u256_add(__private const uint a[8], __private const uint b[8],
                     __private uint r[8]) {
    ulong c = 0;
    #pragma unroll
    for (int i = 0; i < 8; i++) { c += (ulong)a[i] + b[i]; r[i] = (uint)c; c >>= 32; }
    return (uint)c;
}

static uint u256_sub(__private const uint a[8], __private const uint b[8],
                     __private uint r[8]) {
    ulong br = 0;
    #pragma unroll
    for (int i = 0; i < 8; i++) {
        ulong d = (ulong)a[i] - b[i] - br;
        r[i] = (uint)d;
        br = d >> 63;
    }
    return (uint)br;
}

// r = a + b mod p. Fold the add carry via 2^256 ≡ 2^32 + 977, then one
// conditional subtract (result < p + ε after folding, and < 2^256).
static void fe_add(__private const uint a[8], __private const uint b[8],
                   __private uint r[8]) {
    uint fp[8];
    #pragma unroll
    for (int i = 0; i < 8; i++) fp[i] = FP[i];
    uint c = u256_add(a, b, r);
    while (c) {
        ulong s = (ulong)r[0] + 977UL * c; r[0] = (uint)s; s >>= 32;
        s += (ulong)r[1] + c; r[1] = (uint)s; s >>= 32;
        #pragma unroll
        for (int i = 2; i < 8; i++) { s += r[i]; r[i] = (uint)s; s >>= 32; }
        c = (uint)s;
    }
    if (u256_ge(r, fp)) u256_sub(r, fp, r);
}

// r = a - b mod p (borrow → add back p; result normalized)
static void fe_sub(__private const uint a[8], __private const uint b[8],
                   __private uint r[8]) {
    if (u256_sub(a, b, r)) {
        uint fp[8];
        #pragma unroll
        for (int i = 0; i < 8; i++) fp[i] = FP[i];
        u256_add(r, fp, r);
    }
}

// r = a·b mod p. Schoolbook into u64 limb accumulators (each column sums
// ≤ 8·(2^32-1) terms — no overflow), then two linear folds of the pseudo-
// Mersenne prime. Avoids the carry-ordering traps of in-place Comba.
static void fe_mul(__private const uint a[8], __private const uint b[8],
                   __private uint r[8]) {
    ulong A[18];
    #pragma unroll
    for (int i = 0; i < 18; i++) A[i] = 0;
    #pragma unroll
    for (int i = 0; i < 8; i++) {
        #pragma unroll
        for (int j = 0; j < 8; j++) {
            ulong p = (ulong)a[i] * b[j];
            A[i + j] += (uint)p;
            A[i + j + 1] += p >> 32;
        }
    }
    // fold: limb m ≥8 contributes v·(2^32+977)·2^{32(m-8)} — i.e. +977v to
    // limb m-8 and +v to limb m-7. Products land on A[0..15] only.
    ulong B[9];
    #pragma unroll
    for (int i = 0; i < 9; i++) B[i] = 0;
    #pragma unroll
    for (int i = 0; i < 8; i++) B[i] = A[i];
    #pragma unroll
    for (int j = 0; j < 8; j++) {
        ulong v = A[8 + j];
        B[j] += 977UL * v;
        B[j + 1] += v;
    }
    // normalize B[0..8) into r, carrying; B[8] is the residual ≥2^256 limb.
    ulong c = 0;
    #pragma unroll
    for (int i = 0; i < 8; i++) { c += B[i]; r[i] = (uint)c; c >>= 32; }
    c += B[8];
    while (c) {
        ulong s = (ulong)r[0] + 977UL * c; r[0] = (uint)s; s >>= 32;
        s += (ulong)r[1] + c; r[1] = (uint)s; s >>= 32;
        #pragma unroll
        for (int i = 2; i < 8; i++) { s += r[i]; r[i] = (uint)s; s >>= 32; }
        c = s;
    }
    uint fp[8];
    #pragma unroll
    for (int i = 0; i < 8; i++) fp[i] = FP[i];
    if (u256_ge(r, fp)) u256_sub(r, fp, r);
}

static void fe_sqr(__private const uint a[8], __private uint r[8]) {
    fe_mul(a, a, r);
}

// r = a^(p-2) — plain binary ladder, constant exponent from FE2.
static void fe_inv(__private const uint a[8], __private uint r[8]) {
    uint t[8];
    #pragma unroll
    for (int i = 0; i < 8; i++) { t[i] = a[i]; r[i] = i == 0 ? 1 : 0; }
    for (int i = 0; i < 256; i++) {
        if ((FE2[i >> 5] >> (i & 31)) & 1) fe_mul(r, t, r);
        fe_sqr(t, t);
    }
}

// Jacobian point = (X:Y:Z), Z=0 → infinity. Affine→ser is the only place
// needing an inversion.

// R = 2·P  (a=0 curve): S=4XY², M=3X², X'=M²−2S, Y'=M(S−X')−8Y⁴, Z'=2YZ
// Z' must be computed before Y is overwritten (uses the old Y).
static void pt_double(__private uint X[8], __private uint Y[8], __private uint Z[8]) {
    uint yy[8], s[8], m[8], t[8], y4[8];
    fe_sqr(Y, yy);          // Y²
    fe_mul(X, yy, s);       // XY²
    fe_add(s, s, s);
    fe_add(s, s, s);        // S = 4XY²
    fe_sqr(X, m);           // X²
    fe_add(m, m, t);
    fe_add(m, t, m);        // M = 3X²
    fe_mul(Y, Z, t);        // Y·Z  (old Y)
    fe_add(t, t, t);        // t = 2YZ  → new Z
    fe_sqr(m, X);           // M²
    fe_sub(X, s, X);
    fe_sub(X, s, X);        // X' = M² − 2S
    fe_sqr(yy, y4);         // Y⁴
    fe_add(y4, y4, y4);
    fe_add(y4, y4, y4);
    fe_add(y4, y4, y4);     // 8Y⁴
    fe_sub(s, X, s);        // S − X'
    fe_mul(m, s, s);        // M(S − X')
    fe_sub(s, y4, Y);       // Y'
    #pragma unroll
    for (int i = 0; i < 8; i++) Z[i] = t[i];
}

// R += (x2,y2) affine — mixed addition; R must not be the point at infinity
// (caller guards on Z). Handles the H=0 edge: R==Q → double, else → inf.
static void pt_add_affine(__private uint X[8], __private uint Y[8],
                          __private uint Z[8],
                          __private const uint x2[8], __private const uint y2[8]) {
    uint zz[8], u2[8], s2[8], h[8], rr[8], hh[8], hhh[8], v[8], t[8];
    fe_sqr(Z, zz);          // Z1²
    fe_mul(x2, zz, u2);     // U2 = x2·Z1²
    fe_mul(Z, zz, t);       // Z1³
    fe_mul(y2, t, s2);      // S2 = y2·Z1³
    fe_sub(u2, X, h);       // H
    fe_sub(s2, Y, rr);      // r
    // H==0 && r==0 → double; H==0 && r!=0 → infinity
    uint hz = 0, rz = 0;
    #pragma unroll
    for (int i = 0; i < 8; i++) { hz |= h[i]; rz |= rr[i]; }
    if (hz == 0) {
        if (rz == 0) { pt_double(X, Y, Z); }
        else { Z[0] = 0; Z[1] = 0; Z[2] = 0; Z[3] = 0; Z[4] = 0; Z[5] = 0; Z[6] = 0; Z[7] = 0; }
        return;
    }
    fe_sqr(h, hh);          // H²
    fe_mul(h, hh, hhh);     // H³
    fe_mul(X, hh, v);       // V = X1·H²
    fe_sqr(rr, X);          // r²
    fe_sub(X, hhh, X);      // r² − H³
    fe_sub(X, v, X);
    fe_sub(X, v, X);        // X3
    fe_sub(v, X, t);        // V − X3
    fe_mul(rr, t, t);       // r(V − X3)
    fe_mul(Y, hhh, Y);      // Y1·H³
    fe_sub(t, Y, Y);        // Y3
    fe_mul(Z, h, Z);        // Z3 = Z1·H
}

// R = k·G via a 4-bit fixed-base window table: gtab[w*15 + d-1] = affine
// (x,y) of d·2^{4w}·G for d=1..15 (960 points, built on the host). Per key:
// ≤64 mixed additions, no doublings — ~4× fewer point ops than the binary
// ladder. Not constant-time (offline recovery — no secret channel).
static void ec_mult_g(__private const uint k[8],
                      __constant const uint* gtab,
                      __private uint X[8], __private uint Y[8], __private uint Z[8]) {
    #pragma unroll
    for (int i = 0; i < 8; i++) Z[i] = 0;
    for (int w = 0; w < 64; w++) {
        uint d = (k[w >> 3] >> ((w & 7) * 4)) & 15;
        if (d) {
            __constant const uint* P = gtab + (w * 15 + d - 1) * 16;
            uint x2[8], y2[8];
            #pragma unroll
            for (int i = 0; i < 8; i++) { x2[i] = P[i]; y2[i] = P[8 + i]; }
            uint zacc = 0;
            #pragma unroll
            for (int j = 0; j < 8; j++) zacc |= Z[j];
            if (zacc) pt_add_affine(X, Y, Z, x2, y2);
            else {
                #pragma unroll
                for (int j = 0; j < 8; j++) { X[j] = x2[j]; Y[j] = y2[j]; Z[j] = j == 0; }
            }
        }
    }
}

// Compressed pubkey: 0x02|(y&1) ‖ x_be(32). Needs affine → one inversion.
static void ec_ser_p(__private const uint X[8], __private const uint Y[8],
                     __private const uint Z[8], __private uchar out[33]) {
    uint zi[8], zi2[8], xa[8], ya[8];
    fe_inv(Z, zi);          // Z⁻¹
    fe_sqr(zi, zi2);        // Z⁻²
    fe_mul(X, zi2, xa);     // x = X/Z²
    fe_mul(zi, zi2, zi);    // Z⁻³
    fe_mul(Y, zi, ya);      // y = Y/Z³
    out[0] = (uchar)(0x02 | (ya[0] & 1));
    #pragma unroll
    for (int i = 0; i < 8; i++) {
        uint v = xa[7 - i];
        out[1 + i*4]     = (uchar)(v >> 24);
        out[2 + i*4]     = (uchar)(v >> 16);
        out[3 + i*4]     = (uchar)(v >> 8);
        out[4 + i*4]     = (uchar)v;
    }
}


// ------------------------------------------------------------- RIPEMD-160
// Dual-line MD4-family hash — needed for hash160 = RIPEMD160(SHA256(x)).
// Inputs here are ≤ 55 bytes → always a single padded block.

__constant uint RMD_R1[80] = {
    0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,
    7,4,13,1,10,6,15,3,12,0,9,5,2,14,11,8,
    3,10,14,4,9,15,8,1,2,7,0,6,13,11,5,12,
    1,9,11,10,0,8,12,4,13,3,7,15,14,5,6,2,
    4,0,5,9,7,12,2,10,14,1,3,8,11,6,15,13 };
__constant uint RMD_S1[80] = {
    11,14,15,12,5,8,7,9,11,13,14,15,6,7,9,8,
    7,6,8,13,11,9,7,15,7,12,15,9,11,7,13,12,
    11,13,6,7,14,9,13,15,14,8,13,6,5,12,7,5,
    11,12,14,15,14,15,9,8,9,14,5,6,8,6,5,12,
    9,15,5,11,6,8,13,12,5,12,13,14,11,8,5,6 };
__constant uint RMD_R2[80] = {
    5,14,7,0,9,2,11,4,13,6,15,8,1,10,3,12,
    6,11,3,7,0,13,5,10,14,15,8,12,4,9,1,2,
    15,5,1,3,7,14,6,9,11,8,12,2,10,0,4,13,
    8,6,4,1,3,11,15,0,5,12,2,13,9,7,10,14,
    12,15,10,4,1,5,8,7,6,2,13,14,0,3,9,11 };
__constant uint RMD_S2[80] = {
    8,9,9,11,13,15,15,5,7,7,8,11,14,14,12,6,
    9,13,15,7,12,8,9,11,7,7,12,7,6,15,13,11,
    9,7,15,11,8,6,6,14,12,13,5,14,13,13,7,5,
    15,5,8,11,14,14,6,14,6,9,12,9,12,5,15,8,
    8,5,12,9,12,5,14,6,8,13,6,5,15,13,11,11 };
__constant uint RMD_K1[5] = {0x00000000u,0x5A827999u,0x6ED9EBA1u,0x8F1BBCDCu,0xA953FD4Eu};
__constant uint RMD_K2[5] = {0x50A28BE6u,0x5C4DD124u,0x6D703EF3u,0x7A6D76E9u,0x00000000u};

static uint rmd_f(int j, uint x, uint y, uint z) {
    switch (j) {
    case 0: return x ^ y ^ z;
    case 1: return (x & y) | (~x & z);
    case 2: return (x | ~y) ^ z;
    case 3: return (x & z) | (y & ~z);
    default: return x ^ (y | ~z);
    }
}

// RIPEMD-160 of a ≤55-byte message (single block). Output = 20 bytes LE.
static void ripemd160(__private const uchar* m, uint len, __private uchar out[20]) {
    uint X[16];
    #pragma unroll
    for (int i = 0; i < 16; i++) X[i] = 0;
    for (uint i = 0; i < len; i++) X[i >> 2] |= (uint)m[i] << ((i & 3) * 8);
    X[len >> 2] |= 0x80u << ((len & 3) * 8);
    X[14] = len * 8;
    uint a1 = 0x67452301u, b1 = 0xEFCDAB89u, c1 = 0x98BADCFEu, d1 = 0x10325476u, e1 = 0xC3D2E1F0u;
    uint a2 = a1, b2 = b1, c2 = c1, d2 = d1, e2 = e1;
    #pragma unroll
    for (int i = 0; i < 80; i++) {
        int j = i >> 4;
        uint t = rotate(a1 + rmd_f(j, b1, c1, d1) + X[RMD_R1[i]] + RMD_K1[j], RMD_S1[i]) + e1;
        a1 = e1; e1 = d1; d1 = rotate(c1, 10U); c1 = b1; b1 = t;
        t = rotate(a2 + rmd_f(4 - j, b2, c2, d2) + X[RMD_R2[i]] + RMD_K2[j], RMD_S2[i]) + e2;
        a2 = e2; e2 = d2; d2 = rotate(c2, 10U); c2 = b2; b2 = t;
    }
    uint h[5];
    h[0] = 0x67452301u; h[1] = 0xEFCDAB89u; h[2] = 0x98BADCFEu; h[3] = 0x10325476u; h[4] = 0xC3D2E1F0u;
    uint t = h[1] + c1 + d2;
    h[1] = h[2] + d1 + e2;
    h[2] = h[3] + e1 + a2;
    h[3] = h[4] + a1 + b2;
    h[4] = h[0] + b1 + c2;
    h[0] = t;
    #pragma unroll
    for (int i = 0; i < 5; i++) {
        out[i*4]   = (uchar)h[i];
        out[i*4+1] = (uchar)(h[i] >> 8);
        out[i*4+2] = (uchar)(h[i] >> 16);
        out[i*4+3] = (uchar)(h[i] >> 24);
    }
}

// SHA-256 of a ≤55-byte message (single block) — hash160 needs the
// byte-staged form (33-byte pubkey / 22-byte redeem script).
static void sha256_1(__private const uchar* m, uint len, __private uchar out[32]) {
    uint h[8] = {0x6a09e667U,0xbb67ae85U,0x3c6ef372U,0xa54ff53aU,
                 0x510e527fU,0x9b05688cU,0x1f83d9abU,0x5be0cd19U};
    uint wb[16];
    #pragma unroll
    for (int i = 0; i < 16; i++) wb[i] = 0;
    for (uint i = 0; i < len; i++) wb[i >> 2] |= (uint)m[i] << (24 - (i & 3) * 8);
    wb[len >> 2] |= 0x80u << (24 - (len & 3) * 8);
    wb[15] = len * 8;
    sha256_compress_w(h, wb);
    #pragma unroll
    for (int i = 0; i < 8; i++) {
        out[i*4]   = (uchar)(h[i] >> 24);
        out[i*4+1] = (uchar)(h[i] >> 16);
        out[i*4+2] = (uchar)(h[i] >> 8);
        out[i*4+3] = (uchar)h[i];
    }
}

static void hash160_of(__private const uchar* m, uint len, __private uchar out[20]) {
    uchar d[32];
    sha256_1(m, len, d);
    ripemd160(d, 32, out);
}

// forward decls — defined in the BIP32 section below
static void u256_to_be(__private const uint v[8], __private uchar* b);
static void u256_from_be(__private uint v[8], __private const uchar* b);

// ------------------------------------------------------------- taproot
// BIP341 key-spend output key: Q = evenY(P) + t·G with
// t = SHA256(SHA256("TapTweak")² ‖ x(P)) mod n. TTAG is the tag hash
// pre-split into BE words so the tagged hash is exactly 2 compressions
// (64B tag² ‖ 32B x = 96B).

__constant uint TTAG[8] = {
    0xe80fe163u, 0x9c9ca050u, 0xe3af1b39u, 0xc143c63eu,
    0x429cbcebu, 0x15d940fbu, 0xb5c5a1f4u, 0xaf57c5e9u,
};

// tweak scalar t (u256, caller range-checks < n)
static void tap_tweak(__private const uchar x[32], __private uint t[8]) {
    uint h[8] = {0x6a09e667U,0xbb67ae85U,0x3c6ef372U,0xa54ff53aU,
                 0x510e527fU,0x9b05688cU,0x1f83d9abU,0x5be0cd19U};
    uint wb[16];
    #pragma unroll
    for (int i = 0; i < 16; i++) wb[i] = TTAG[i & 7];
    sha256_compress_w(h, wb);
    #pragma unroll
    for (int i = 0; i < 8; i++)
        wb[i] = ((uint)x[i*4] << 24) | ((uint)x[i*4+1] << 16)
              | ((uint)x[i*4+2] << 8) | (uint)x[i*4+3];
    wb[8] = 0x80000000u;
    #pragma unroll
    for (int i = 9; i < 15; i++) wb[i] = 0;
    wb[15] = 96 * 8;
    sha256_compress_w(h, wb);
    #pragma unroll
    for (int i = 0; i < 8; i++) t[i] = h[7 - i]; // BE digest → LE limbs
}

// Jacobian (X:Y:Z) → affine (xa, ya). One inversion.
static void jac_affine(__private const uint X[8], __private const uint Y[8],
                       __private const uint Z[8],
                       __private uint xa[8], __private uint ya[8]) {
    uint zi[8], zi2[8];
    fe_inv(Z, zi);
    fe_sqr(zi, zi2);
    fe_mul(X, zi2, xa);
    fe_mul(zi, zi2, zi);
    fe_mul(Y, zi, ya);
}

// x-only output key of leaf → compare against 32B taproot targets.
// Returns 1 on hit.
static int taproot_hit(__private const uint leaf_k[8],
                       __constant const uint* gtab,
                       __global const uchar* xtargets, uint n_xtargets) {
    uint X[8], Y[8], Z[8];
    ec_mult_g(leaf_k, gtab, X, Y, Z);
    uint xa[8], ya[8];
    jac_affine(X, Y, Z, xa, ya);
    uint fp[8], fn[8];
    #pragma unroll
    for (int i = 0; i < 8; i++) { fp[i] = FP[i]; fn[i] = FN[i]; }
    uchar xb[32];
    u256_to_be(xa, xb);
    uint t[8];
    tap_tweak(xb, t);
    if (u256_ge(t, fn)) return 0;
    // even-y internal key convention: odd affine y ⇔ negate Jacobian Y
    if (ya[0] & 1) fe_sub(fp, Y, Y);
    uint X2[8], Y2[8], Z2[8];
    ec_mult_g(t, gtab, X2, Y2, Z2);
    uint tx[8], ty[8];
    jac_affine(X2, Y2, Z2, tx, ty);
    pt_add_affine(X, Y, Z, tx, ty);   // Q = P' + tG
    uint qx[8], qy[8];
    jac_affine(X, Y, Z, qx, qy);
    uchar qxb[32];
    u256_to_be(qx, qxb);
    for (uint i = 0; i < n_xtargets; i++) {
        __global const uchar* tp = xtargets + i * 32;
        uint d = 0;
        #pragma unroll
        for (int j = 0; j < 32; j++) d |= qxb[j] ^ tp[j];
        if (d == 0) return 1;
    }
    return 0;
}

// ------------------------------------------------------------------ BIP32

// HMAC-SHA512 with a 32-byte key (chain code) over a ≤64-byte message —
// the CKD shape. 4 compressions via one pad block + absorb each way.
static void hmac_cc(__private const uchar cc[32], __private const uchar* data,
                    uint dlen, __private uchar out[64]) {
    uchar pad[128];
    #pragma unroll
    for (int i = 0; i < 32; i++) pad[i] = cc[i] ^ 0x36;
    #pragma unroll
    for (int i = 32; i < 128; i++) pad[i] = 0x36;
    ulong h[8] = {SHA512_IV};
    sha512_compress(h, pad);
    uchar ih[64];
    sha512_absorb(h, data, dlen, 128 + dlen, ih);
    #pragma unroll
    for (int i = 0; i < 32; i++) pad[i] = cc[i] ^ 0x5c;
    #pragma unroll
    for (int i = 32; i < 128; i++) pad[i] = 0x5c;
    ulong h2[8] = {SHA512_IV};
    sha512_compress(h2, pad);
    sha512_absorb(h2, ih, 64, 192, out);
}

// HMAC-SHA512 with an arbitrary ≤128-byte key — used once for the master
// ("Bitcoin seed" ‖ seed).
static void hmac_raw(__private const uchar* key, uint klen,
                     __private const uchar* data, uint dlen, __private uchar out[64]) {
    uchar pad[128];
    for (uint i = 0; i < 128; i++) pad[i] = (i < klen ? key[i] : 0) ^ 0x36;
    ulong h[8] = {SHA512_IV};
    sha512_compress(h, pad);
    uchar ih[64];
    sha512_absorb(h, data, dlen, 128 + dlen, ih);
    for (uint i = 0; i < 128; i++) pad[i] = (i < klen ? key[i] : 0) ^ 0x5c;
    ulong h2[8] = {SHA512_IV};
    sha512_compress(h2, pad);
    sha512_absorb(h2, ih, 64, 192, out);
}

// BIP32 node: priv scalar (u256 LE limbs) + 32-byte chain code.
typedef struct { uint k[8]; uchar cc[32]; } B32Node;

// u256 ← 32 big-endian bytes
static void u256_from_be(__private uint v[8], __private const uchar* b) {
    #pragma unroll
    for (int i = 0; i < 8; i++) {
        v[i] = (uint)b[31 - i*4] | ((uint)b[30 - i*4] << 8)
             | ((uint)b[29 - i*4] << 16) | ((uint)b[28 - i*4] << 24);
    }
}

// u256 → 32 big-endian bytes
static void u256_to_be(__private const uint v[8], __private uchar* b) {
    #pragma unroll
    for (int i = 0; i < 8; i++) {
        uint w = v[i];
        b[31 - i*4]     = (uchar)w;
        b[30 - i*4]     = (uchar)(w >> 8);
        b[29 - i*4]     = (uchar)(w >> 16);
        b[28 - i*4]     = (uchar)(w >> 24);
    }
}

// CKDpriv: (k,cc) + index → child. `hardened` selects data form; for the
// normal form `ser_p` must already hold the parent's compressed pubkey
// (33 bytes). Returns 0 on the (astronomically rare) invalid child.
static int ckd_priv(__private const B32Node* par, uint index, int hardened,
                    __private const uchar ser_p[33], __private B32Node* ch) {
    uchar data[37];
    if (hardened) {
        data[0] = 0;
        u256_to_be(par->k, data + 1);
    } else {
        for (int i = 0; i < 33; i++) data[i] = ser_p[i];
    }
    data[33] = (uchar)(index >> 24);
    data[34] = (uchar)(index >> 16);
    data[35] = (uchar)(index >> 8);
    data[36] = (uchar)index;
    uchar i64[64];
    hmac_cc(par->cc, data, 37, i64);
    uint fn[8];
    #pragma unroll
    for (int i = 0; i < 8; i++) fn[i] = FN[i];
    uint il[8];
    u256_from_be(il, i64);
    if (u256_ge(il, fn)) return 0;
    uint s[8];
    uint c = u256_add(par->k, il, s);
    uint t[8];
    uint b = u256_sub(s, fn, t);
    if (c || !b) {   // sum ≥ n → take s - n
        #pragma unroll
        for (int i = 0; i < 8; i++) s[i] = t[i];
    }
    uint z = 0;
    #pragma unroll
    for (int i = 0; i < 8; i++) { ch->k[i] = s[i]; z |= s[i]; }
    if (z == 0) return 0;
    #pragma unroll
    for (int i = 0; i < 32; i++) ch->cc[i] = i64[32 + i];
    return 1;
}

// pubkey (compressed) of a private scalar
static void node_ser_p(__private const uint k[8], __constant const uint* gtab,
                       __private uchar out[33]) {
    uint X[8], Y[8], Z[8];
    ec_mult_g(k, gtab, X, Y, Z);
    ec_ser_p(X, Y, Z, out);
}

// target match: hash160 against the target list
static int hit_hash160(__private const uchar h[20], __global const uchar* targets,
                       uint n_targets) {
    for (uint i = 0; i < n_targets; i++) {
        __global const uchar* tp = targets + i * 20;
        uint d = 0;
        #pragma unroll
        for (int j = 0; j < 20; j++) d |= h[j] ^ tp[j];
        if (d == 0) return 1;
    }
    return 0;
}

// Stage 4 kernel: per finished state record → seed → BIP32 tree walk →
// hash160 per leaf → target match. Emits hit records (record_id ‖ seed)
// for the host to expand + confirm, and bad records (dead work-items)
// for CPU repair.
//
// plan[] = { npur, coin, n_accounts, chain_mask, max_index, pur[0..8) }
__kernel void derive_match(
    __global uchar* states,
    __global const uint*  plan,
    __global const uchar* targets,
    __constant const uint* gtab,
    const uint n_targets,
    __global const uchar* xtargets,   // 32B taproot output keys
    const uint n_xtargets,
    const uint seqs,                 // pbkdf2 launches run (= tag check)
    volatile __global uint* hit_count,
    __global uchar* hits,            // max_out × 72B: u64 id + u8 seed[64]
    volatile __global uint* bad_count,
    __global uchar* bads,            // max_out × (8+4+248)B: id + plen + phrase
    const uint max_out)
{
    __global uchar* st = states + (ulong)get_global_id(0) * STATE_SIZE;
    uint plen = *((__global const uint*)(st + OFF_PLEN));
    if (plen == 0 || plen > MAX_PHRASE) goto bad;
    {
        // chain tag must equal u32(T[0..4]) ^ seqs·TAG_C
        uint tag = *((__global const uint*)(st + OFF_TAG));
        uint head = (uint)st[OFF_T] | ((uint)st[OFF_T+1] << 8)
                  | ((uint)st[OFF_T+2] << 16) | ((uint)st[OFF_T+3] << 24);
        if (tag != (head ^ seqs * TAG_C)) goto bad;
    }

    // master = HMAC("Bitcoin seed", seed)
    uchar seed[64];
    #pragma unroll
    for (int i = 0; i < 64; i++) seed[i] = st[OFF_T + i];
    {
        const uchar mkey[13] = {'B','i','t','c','o','i','n',' ','s','e','e','d',0};
        uchar i64[64];
        hmac_raw(mkey, 12, seed, 64, i64);
        B32Node master;
        u256_from_be(master.k, i64);
        #pragma unroll
        for (int i = 0; i < 32; i++) master.cc[i] = i64[32 + i];
        uint fn[8];
        #pragma unroll
        for (int i = 0; i < 8; i++) fn[i] = FN[i];
        if (u256_ge(master.k, fn)) return;

        uint npur = plan[0], coin = plan[1], n_acct = plan[2];
        uint chain_mask = plan[3], max_index = plan[4];
        for (uint pi = 0; pi < npur; pi++) {
            uint pur = plan[5 + pi];
            B32Node np, nc;
            uchar dummy[33];
            if (!ckd_priv(&master, pur | 0x80000000u, 1, dummy, &np)) continue;
            if (!ckd_priv(&np, coin | 0x80000000u, 1, dummy, &nc)) continue;
            for (uint a = 0; a < n_acct; a++) {
                B32Node na;
                if (!ckd_priv(&nc, a | 0x80000000u, 1, dummy, &na)) continue;
                // parent pubkey needed for the normal chain derive
                uchar pa[33];
                node_ser_p(na.k, gtab, pa);
                for (uint ch = 0; ch < 2; ch++) {
                    if (!(chain_mask & (1u << ch))) continue;
                    B32Node nch;
                    if (!ckd_priv(&na, ch, 0, pa, &nch)) continue;
                    uchar pc[33];
                    node_ser_p(nch.k, gtab, pc);
                    for (uint i = 0; i < max_index; i++) {
                        B32Node leaf;
                        if (!ckd_priv(&nch, i, 0, pc, &leaf)) continue;
                        int hit = 0;
                        if (pur == 86) {
                            // BIP86: tweaked x-only key vs taproot targets
                            hit = n_xtargets
                                ? taproot_hit(leaf.k, gtab, xtargets, n_xtargets)
                                : 0;
                        } else {
                        uchar pl[33], h160[20], sh[32];
                        node_ser_p(leaf.k, gtab, pl);
                        hash160_of(pl, 33, h160);
                        hit = hit_hash160(h160, targets, n_targets);
                        if (!hit && pur == 49) {
                            // P2SH-P2WPKH: hash160 of 0x0014‖h160
                            uchar rd[22];
                            rd[0] = 0; rd[1] = 20;
                            #pragma unroll
                            for (int j = 0; j < 20; j++) rd[2 + j] = h160[j];
                            hash160_of(rd, 22, sh);
                            hit = hit_hash160(sh, targets, n_targets);
                        }
                        }
                        if (hit) {
                            uint slot = atomic_inc(hit_count);
                            if (slot < max_out) {
                                __global uchar* hr = hits + (ulong)slot * 72;
                                for (int j = 0; j < 8; j++)
                                    hr[j] = st[OFF_COMBO + j];
                                #pragma unroll
                                for (int j = 0; j < 64; j++) hr[8 + j] = seed[j];
                            }
                        }
                    }
                }
            }
        }
    }
    return;

bad:
    {
        uint slot = atomic_inc(bad_count);
        if (slot < max_out) {
            __global uchar* br = bads + (ulong)slot * (8 + 4 + MAX_PHRASE);
            for (int j = 0; j < 8; j++) br[j] = st[OFF_COMBO + j];
            *((__global uint*)(br + 8)) = plen;
            for (uint j = 0; j < plen && j < MAX_PHRASE; j++)
                br[12 + j] = st[OFF_PHRASE + j];
        }
    }
}
