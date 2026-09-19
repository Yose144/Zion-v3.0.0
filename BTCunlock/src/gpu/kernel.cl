// BTCunlock — BIP39 recovery kernels.
//
// Pipeline (two kernels per batch):
//   bip39_filter: combo → word indices → checksum (SHA-256) → for survivors,
//                 build phrase + U1 = HMAC(phrase, salt||1) → state record
//   pbkdf2_step:  per state record, run CHUNK HMAC iterations
//                 (U = HMAC(U); T ^= U) — launched ceil(2047/CHUNK) times
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

#define MAX_WORDS 24
#define MAX_HOLES 6
#define MAX_SALT 128
#define MAX_PHRASE 248
#define STATE_SIZE 392
#define OFF_COMBO 0
#define OFF_PLEN 8
#define OFF_PHRASE 12
#define OFF_U 260
#define OFF_T 324

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

static void sha256_compress(uint h[8], const uchar blk[64]) {
    uint w[64];
    for (int i = 0; i < 16; i++)
        w[i] = ((uint)blk[i*4] << 24) | ((uint)blk[i*4+1] << 16) |
               ((uint)blk[i*4+2] << 8) | (uint)blk[i*4+3];
    for (int i = 16; i < 64; i++) {
        uint s0 = rotate(w[i-15],25U)^rotate(w[i-15],14U)^(w[i-15]>>3);
        uint s1 = rotate(w[i-2],15U)^rotate(w[i-2],13U)^(w[i-2]>>10);
        w[i] = w[i-16]+s0+w[i-7]+s1;
    }
    uint a=h[0],b=h[1],c=h[2],d=h[3],e=h[4],f=h[5],g=h[6],hh=h[7];
    for (int i = 0; i < 64; i++) {
        uint S1 = rotate(e,26U)^rotate(e,21U)^rotate(e,7U);
        uint ch = (e&f)^(~e&g);
        uint t1 = hh+S1+ch+K256[i]+w[i];
        uint S0 = rotate(a,30U)^rotate(a,19U)^rotate(a,10U);
        uint mj = (a&b)^(a&c)^(b&c);
        uint t2 = S0+mj;
        hh=g; g=f; f=e; e=d+t1; d=c; c=b; b=a; a=t1+t2;
    }
    h[0]+=a; h[1]+=b; h[2]+=c; h[3]+=d; h[4]+=e; h[5]+=f; h[6]+=g; h[7]+=hh;
}

// SHA-256 of a message ≤ 55 bytes (BIP39 entropy is 16-32) — single block.
static void sha256_small(const uchar* m, uint len, uchar out[32]) {
    uint h[8] = {0x6a09e667U,0xbb67ae85U,0x3c6ef372U,0xa54ff53aU,
                 0x510e527fU,0x9b05688cU,0x1f83d9abU,0x5be0cd19U};
    uchar blk[64];
    for (int i = 0; i < 64; i++) blk[i] = 0;
    for (uint i = 0; i < len; i++) blk[i] = m[i];
    blk[len] = 0x80;
    ulong bits = (ulong)len * 8;
    for (int i = 0; i < 8; i++) blk[63-i] = (uchar)(bits >> (8*i));
    sha256_compress(h, blk);
    for (int i = 0; i < 8; i++) {
        out[i*4]   = (uchar)(h[i] >> 24);
        out[i*4+1] = (uchar)(h[i] >> 16);
        out[i*4+2] = (uchar)(h[i] >> 8);
        out[i*4+3] = (uchar)h[i];
    }
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

static void sha512_compress(ulong h[8], const uchar blk[128]) {
    ulong w[80];
    for (int i = 0; i < 16; i++) {
        w[i] = ((ulong)blk[i*8] << 56) | ((ulong)blk[i*8+1] << 48) |
               ((ulong)blk[i*8+2] << 40) | ((ulong)blk[i*8+3] << 32) |
               ((ulong)blk[i*8+4] << 24) | ((ulong)blk[i*8+5] << 16) |
               ((ulong)blk[i*8+6] << 8) | (ulong)blk[i*8+7];
    }
    for (int i = 16; i < 80; i++) {
        ulong s0 = rotate(w[i-15],63UL)^rotate(w[i-15],56UL)^(w[i-15]>>7);
        ulong s1 = rotate(w[i-2],45UL)^rotate(w[i-2],3UL)^(w[i-2]>>6);
        w[i] = w[i-16]+s0+w[i-7]+s1;
    }
    ulong a=h[0],b=h[1],c=h[2],d=h[3],e=h[4],f=h[5],g=h[6],hh=h[7];
    for (int i = 0; i < 80; i++) {
        ulong S1 = rotate(e,50UL)^rotate(e,46UL)^rotate(e,23UL); // ROTR14^18^41
        ulong ch = (e&f)^(~e&g);
        ulong t1 = hh+S1+ch+K512[i]+w[i];
        ulong S0 = rotate(a,36UL)^rotate(a,30UL)^rotate(a,25UL); // ROTR28^34^39
        ulong mj = (a&b)^(a&c)^(b&c);
        ulong t2 = S0+mj;
        hh=g; g=f; f=e; e=d+t1; d=c; c=b; b=a; a=t1+t2;
    }
    h[0]+=a; h[1]+=b; h[2]+=c; h[3]+=d; h[4]+=e; h[5]+=f; h[6]+=g; h[7]+=hh;
}

// SHA-512 of a message ≤ 392 bytes (HMAC inner ≤ 128+132, outer = 192).
static void sha512(const uchar* m, uint len, uchar out[64]) {
    ulong h[8] = {0x6a09e667f3bcc908UL,0xbb67ae8584caa73bUL,
                  0x3c6ef372fe94f82bUL,0xa54ff53a5f1d36f1UL,
                  0x510e527fade682d1UL,0x9b05688c2b3e6c1fUL,
                  0x1f83d9abfb41bd6bUL,0x5be0cd19137e2179UL};
    uint off = 0;
    while (len - off >= 128) {
        sha512_compress(h, m + off);
        off += 128;
    }
    uchar tail[256];
    for (int i = 0; i < 256; i++) tail[i] = 0;
    uint rem = len - off;
    for (uint i = 0; i < rem; i++) tail[i] = m[off + i];
    tail[rem] = 0x80;
    uint tail_blocks = (rem < 112) ? 1 : 2;
    ulong bits = (ulong)len * 8;
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

// ------------------------------------------------------------- HMAC-SHA512

static void hmac_sha512(const uchar* key, uint klen,
                        const uchar* msg, uint mlen, uchar out[64]) {
    uchar k0[128];
    for (int i = 0; i < 128; i++) k0[i] = 0;
    if (klen > 128) {
        uchar kh[64];
        sha512(key, klen, kh);
        for (int i = 0; i < 64; i++) k0[i] = kh[i];
    } else {
        for (uint i = 0; i < klen; i++) k0[i] = key[i];
    }
    uchar inner[128 + 264];
    for (int i = 0; i < 128; i++) inner[i] = k0[i] ^ 0x36;
    for (uint i = 0; i < mlen; i++) inner[128 + i] = msg[i];
    uchar ih[64];
    sha512(inner, 128 + mlen, ih);
    uchar outer[192];
    for (int i = 0; i < 128; i++) outer[i] = k0[i] ^ 0x5c;
    for (int i = 0; i < 64; i++) outer[128 + i] = ih[i];
    sha512(outer, 192, out);
}

// ------------------------------------------------------------------ filter

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

    // BIP39 checksum — pack 11-bit indices → entropy, sha256 → compare
    uint total_bits = n_words * 11;
    uint cs_bits = total_bits / 33;
    uint ent_bits = total_bits - cs_bits;
    uchar ent[32];
    for (int i = 0; i < 32; i++) ent[i] = 0;
    for (uint i = 0; i < n_words; i++) {
        for (uint b = 0; b < 11; b++) {
            uint pos = i * 11 + b;
            if (pos < ent_bits)
                ent[pos >> 3] |= (uchar)(((idx[i] >> (10 - b)) & 1) << (7 - (pos & 7)));
        }
    }
    uchar cs_val = 0;
    for (uint b = 0; b < cs_bits; b++) {
        uint pos = ent_bits + b;
        cs_val |= (uchar)(((idx[pos / 11] >> (10 - pos % 11)) & 1) << (7 - b));
    }
    uchar dig[32];
    sha256_small(ent, ent_bits / 8, dig);
    uchar mask = (cs_bits == 8) ? 0xFF : (uchar)(0xFF << (8 - cs_bits));
    if ((dig[0] & mask) != cs_val) return;   // ~255/256 exit here

    // checksum-valid → phrase string (ASCII words + spaces)
    uchar phrase[MAX_PHRASE];
    uint plen = 0;
    for (uint i = 0; i < n_words; i++) {
        if (i) phrase[plen++] = ' ';
        ushort w = idx[i];
        for (ushort o = wl_off[w]; o < wl_off[w + 1]; o++)
            phrase[plen++] = wl_blob[o];
    }

    // U1 = HMAC(phrase, salt || INT32_BE(1)) — helpers need __private args
    uchar m[MAX_SALT + 4];
    for (uint i = 0; i < salt_len; i++) m[i] = salt[i];
    m[salt_len] = 0; m[salt_len+1] = 0; m[salt_len+2] = 0; m[salt_len+3] = 1;
    uchar u1[64];
    hmac_sha512(phrase, plen, m, salt_len + 4, u1);

    uint slot = atomic_inc(result_count);
    if (slot >= max_results) return;
    __global uchar* st = states + (ulong)slot * STATE_SIZE;
    *((__global ulong*)(st + OFF_COMBO)) = combo;
    *((__global uint*)(st + OFF_PLEN)) = plen;
    for (uint i = 0; i < plen; i++) st[OFF_PHRASE + i] = phrase[i];
    for (int i = 0; i < 64; i++) {
        st[OFF_U + i] = u1[i];
        st[OFF_T + i] = u1[i];
    }
}

// --------------------------------------------------------------- pbkdf2 it

// One work-item per state record: `iters` HMAC rounds, state persists
// across launches. Host launches ceil(2047/iters) times.
__kernel void pbkdf2_step(
    __global uchar* states,
    const uint iters)
{
    __global uchar* st = states + (ulong)get_global_id(0) * STATE_SIZE;
    // copy state to __private — helpers can't take __global pointers
    uchar pw[MAX_PHRASE];
    uint plen = *((__global const uint*)(st + OFF_PLEN));
    for (uint i = 0; i < plen; i++) pw[i] = st[OFF_PHRASE + i];
    uchar u[64], t[64];
    for (int i = 0; i < 64; i++) { u[i] = st[OFF_U + i]; t[i] = st[OFF_T + i]; }
    uchar nu[64];
    for (uint it = 0; it < iters; it++) {
        hmac_sha512(pw, plen, u, 64, nu);   // u read into inner before write
        for (int j = 0; j < 64; j++) { u[j] = nu[j]; t[j] ^= nu[j]; }
    }
    for (int i = 0; i < 64; i++) { st[OFF_U + i] = u[i]; st[OFF_T + i] = t[i]; }
}
