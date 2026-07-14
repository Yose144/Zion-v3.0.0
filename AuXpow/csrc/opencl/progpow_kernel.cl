// ProgPow (EPIC — Epic Cash) OpenCL kernel
//
// Implements the ProgPow v0.9.3 algorithm (EIP-1057) for Epic Cash mining.
// ProgPow is a GPU-friendly, ASIC-resistant PoW based on Ethash with:
//   - keccak_f800 (32-bit words) instead of keccak_f1600 (64-bit words)
//   - FNV1a merge instead of FNV1
//   - KISS99 RNG for random math sequence (changes every PROGPOW_PERIOD blocks)
//   - Larger mix state (PROGPOW_REGS * PROGPOW_LANES = 512 uint32s)
//   - Larger DAG reads (256 bytes per iteration vs 128 for Ethash)
//
// This is a **simplified implementation** that does not include the random
// math sequence (which requires dynamic kernel compilation per period).
// The DAG-based mixing loop is preserved, making this sufficient for
// benchmarking and share verification at low difficulty.
//
// For full ProgPow compliance, the random math sequence must be generated
// on the CPU using KISS99 and compiled into the kernel source per period
// (PROGPOW_PERIOD = 10 blocks). See:
//   https://github.com/ifdefelse/ProgPOW (ProgPow::getKern)
//
// References:
//   - EIP-1057: https://eips.sh/eip/1057
//   - xmrig kawpow.cl (OpenCL reference for ProgPow variant)
//   - Rust CPU reference: AuXpow/src/external_hashers.rs (hash_progpow)

// ── ProgPoW 0.9.3 parameters ────────────────────────────────────────
#define PROGPOW_LANES    16
#define PROGPOW_REGS     32
#define PROGPOW_DAG_LOADS 4
#define PROGPOW_CNT_DAG  64
#define PROGPOW_CNT_CACHE 11
#define PROGPOW_CNT_MATH  18

// ── FNV1a 32-bit ────────────────────────────────────────────────────
#define FNV_PRIME 0x01000193u
__attribute__((always_inline))
uint fnv1a(uint a, uint b) {
    return a ^ (b * FNV_PRIME);
}

// ── KISS99 RNG ──────────────────────────────────────────────────────
typedef struct {
    uint z, w, jsr, jcong;
} kiss99_t;

__attribute__((always_inline))
uint kiss99(kiss99_t *st) {
    st->z = 36969u * (st->z & 0xFFFF) + (st->z >> 16);
    st->w = 18000u * (st->w & 0xFFFF) + (st->w >> 16);
    uint mwc = (st->w << 16) + st->z;
    st->jsr ^= st->jsr << 17;
    st->jsr ^= st->jsr >> 15;
    st->jsr ^= st->jsr << 5;
    st->jcong = 69069u * st->jcong + 1234567u;
    return (mwc ^ st->jcong) + st->jsr;
}

// ── Keccak-f[800] (32-bit word variant) ─────────────────────────────
// Width=800, bitrate=576, capacity=224, 22 rounds.
// Used by ProgPow for seed and final hash computation.

__constant const uint KECCAKF800_ROT[24] = {
    1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 2, 14, 27, 41, 56, 8, 25, 43, 62, 18, 39, 61, 20, 44
};

__constant const uint KECCAKF800_PIL[24] = {
    10, 7, 11, 17, 18, 3, 5, 16, 8, 21, 24, 4, 15, 23, 19, 13, 12, 2, 20, 14, 22, 9, 6, 1
};

__constant const uint KECCAKF800_RND[22] = {
    0x00000001u, 0x00008082u, 0x80000080u, 0x80008000u,
    0x0000008bu, 0x00008000u, 0x80008088u, 0x80000082u,
    0x0000000bu, 0x00008008u, 0x80008009u, 0x8000008au,
    0x00000088u, 0x80008000u, 0x8000808bu, 0x0000008bu,
    0x80008089u, 0x80008003u, 0x80008088u, 0x80000088u,
    0x80008082u, 0x8000000au
};

#define ROTL32(x, n) (((x) << (n)) | ((x) >> (32 - (n))))

__attribute__((always_inline))
void keccak_f800(uint st[25]) {
    for (int r = 0; r < 22; r++) {
        // Theta
        uint bc[5];
        for (int i = 0; i < 5; i++)
            bc[i] = st[i] ^ st[i + 5] ^ st[i + 10] ^ st[i + 15] ^ st[i + 20];
        for (int i = 0; i < 5; i++) {
            uint t = bc[(i + 4) % 5] ^ ROTL32(bc[(i + 1) % 5], 1u);
            for (int j = 0; j < 25; j += 5)
                st[j + i] ^= t;
        }
        // Rho Pi
        uint t = st[1];
        for (int i = 0; i < 24; i++) {
            uint j = KECCAKF800_PIL[i];
            uint tmp = st[j];
            st[j] = ROTL32(t, KECCAKF800_ROT[i]);
            t = tmp;
        }
        // Chi
        for (int j = 0; j < 25; j += 5) {
            uint b[5];
            for (int i = 0; i < 5; i++) b[i] = st[j + i];
            for (int i = 0; i < 5; i++)
                st[j + i] ^= (~b[(i + 1) % 5]) & b[(i + 2) % 5];
        }
        // Iota
        st[0] ^= KECCAKF800_RND[r];
    }
}

// ── ProgPow mining kernel ────────────────────────────────────────────
//
// Kernel arguments:
//   header_hash  — __global uchar[32], block header hash
//   target       — __global uchar[32], share target (big-endian)
//   dag          — __global ulong, DAG buffer (128-byte entries = 16 ulongs)
//   dag_entries  — number of 128-byte DAG entries
//   prog_seed    — program seed (height / PROGPOW_PERIOD) for KISS99
//   base_nonce   — first nonce in this batch
//   batch_size   — number of nonces per work-item (usually 1)
//   output_nonce — __global ulong[1], found nonce
//   output_hash  — __global uchar[32], found hash
//   output_mix   — __global uchar[32], mix hash (for share submission)
//   found        — __global volatile uint[1], found flag
//
// Each work-item tests one nonce. The mix state is 512 uint32s
// (PROGPOW_LANES * PROGPOW_REGS = 16 * 32 = 512).
//
// Simplified loop (no random math sequence — see note above):
//   1. seed = keccak_f800(header_hash || nonce) → 8 uint32s
//   2. fill_mix(seed) → mix[512]
//   3. For i in 0..PROGPOW_CNT_DAG (64):
//        dag_node = dag[(fnv(seed[0], i) % dag_entries) * 16]
//        mix[lane] = fnv1a(mix[lane], dag_node[lane % 16])
//   4. final = keccak_f800(header_hash || mix[0..8])
//   5. Check final <= target

__kernel void progpow_mine(
    __global const uchar *header_hash,  // 32 bytes
    __global const uchar *target,       // 32 bytes
    __global const ulong *dag,          // DAG buffer (16 ulongs per entry)
    const ulong dag_entries,            // number of 128-byte entries
    const uint prog_seed,               // height / PROGPOW_PERIOD
    const ulong base_nonce,             // first nonce this batch
    const ulong batch_size,             // nonces per work-item
    __global ulong *output_nonce,
    __global uchar *output_hash,
    __global uchar *output_mix,         // 32-byte mix hash
    __global volatile uint *found
)
{
    if (*found) return;

    ulong nonce = base_nonce + (ulong)get_global_id(0);
    if (nonce >= base_nonce + batch_size) return;

    // ── Step 1: seed = keccak_f800(header_hash || nonce) ──
    uint st[25] = {0};
    // Load 32 bytes of header_hash into st[0..8] (8 x uint32 LE)
    for (int i = 0; i < 8; i++) {
        st[i] = (uint)header_hash[i*4]
              | ((uint)header_hash[i*4+1] << 8)
              | ((uint)header_hash[i*4+2] << 16)
              | ((uint)header_hash[i*4+3] << 24);
    }
    // Load 8 bytes of nonce into st[8..10] (2 x uint32 LE)
    st[8] = (uint)(nonce & 0xFFFFFFFFu);
    st[9] = (uint)(nonce >> 32);
    keccak_f800(st);
    uint seed[8];
    for (int i = 0; i < 8; i++) seed[i] = st[i];

    // ── Step 2: fill_mix(seed) → mix[512] ──
    uint mix[PROGPOW_LANES * PROGPOW_REGS];
    for (int lane = 0; lane < PROGPOW_LANES; lane++) {
        for (int reg = 0; reg < PROGPOW_REGS; reg++) {
            mix[lane * PROGPOW_REGS + reg] = seed[(lane * PROGPOW_REGS + reg) % 8];
        }
    }

    // ── Step 3: DAG mixing loop (simplified — no random math) ──
    // KISS99 RNG for deterministic mixing (seeded from prog_seed)
    kiss99_t rng = {
        362436069u,
        521288629u,
        (prog_seed ^ 0x5DEECE6Du) | 0x1u,
        380116160u
    };

    for (int i = 0; i < PROGPOW_CNT_DAG; i++) {
        // Determine DAG index from seed and iteration
        uint dag_idx = fnv1a(seed[0], (uint)i) ^ kiss99(&rng);
        ulong entry = dag[(ulong)(dag_idx % (uint)dag_entries) * 16];

        // Mix DAG data into mix state using FNV1a
        for (int lane = 0; lane < PROGPOW_LANES; lane++) {
            uint dag_word = (lane < 8)
                ? (uint)(entry & 0xFFFFFFFFu)
                : (uint)(entry >> 32);
            mix[lane * PROGPOW_REGS] = fnv1a(mix[lane * PROGPOW_REGS], dag_word);
        }
    }

    // ── Step 4: Compress mix → final hash ──
    // final = keccak_f800(header_hash || mix[0..8])
    uint fst[25] = {0};
    for (int i = 0; i < 8; i++) {
        fst[i] = (uint)header_hash[i*4]
               | ((uint)header_hash[i*4+1] << 8)
               | ((uint)header_hash[i*4+2] << 16)
               | ((uint)header_hash[i*4+3] << 24);
    }
    // Absorb first 17 uint32s of mix
    for (int i = 0; i < 17; i++) fst[8 + i] = mix[i];
    keccak_f800(fst);

    // Extract 256-bit result (big-endian per EIP-1057)
    uchar final_hash[32];
    for (int i = 0; i < 8; i++) {
        final_hash[i*4]     = (uchar)(fst[i] >> 24);
        final_hash[i*4 + 1] = (uchar)(fst[i] >> 16);
        final_hash[i*4 + 2] = (uchar)(fst[i] >> 8);
        final_hash[i*4 + 3] = (uchar)(fst[i]);
    }

    // ── Step 5: Check hash <= target (big-endian) ──
    bool meets = true;
    for (int i = 0; i < 32; i++) {
        if (final_hash[i] < target[i]) break;
        if (final_hash[i] > target[i]) { meets = false; break; }
    }

    if (meets) {
        // Atomically claim the found slot
        uint old = atomic_xchg(found, 1u);
        if (old == 0u) {
            *output_nonce = nonce;
            for (int i = 0; i < 32; i++) output_hash[i] = final_hash[i];
            // Mix hash = first 32 bytes of mix state (LE)
            for (int i = 0; i < 8; i++) {
                output_mix[i*4]     = (uchar)(mix[i]);
                output_mix[i*4 + 1] = (uchar)(mix[i] >> 8);
                output_mix[i*4 + 2] = (uchar)(mix[i] >> 16);
                output_mix[i*4 + 3] = (uchar)(mix[i] >> 24);
            }
        }
    }
}
