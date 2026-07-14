// ProgPow (EPIC — Epic Cash) Metal kernel
//
// Metal variant of the ProgPow v0.9.3 algorithm for Apple Silicon.
// Same algorithm as the OpenCL kernel but with Metal syntax:
//   - `constant type* name [[buffer(N)]]` instead of `__global type *name`
//   - `thread` instead of `private`
//   - `device` for GPU-accessible buffers
//
// References:
//   - EIP-1057: https://eips.sh/eip/1057
//   - OpenCL kernel: AuXpow/csrc/opencl/progpow_kernel.cl
//   - Rust CPU reference: AuXpow/src/external_hashers.rs (hash_progpow)

#include <metal_stdlib>
using namespace metal;

// ── ProgPoW 0.9.3 parameters ────────────────────────────────────────
#define PROGPOW_LANES    16
#define PROGPOW_REGS     32
#define PROGPOW_DAG_LOADS 4
#define PROGPOW_CNT_DAG  64
#define PROGPOW_CNT_CACHE 11
#define PROGPOW_CNT_MATH  18

// ── FNV1a 32-bit ────────────────────────────────────────────────────
#define FNV_PRIME 0x01000193u

inline uint fnv1a(uint a, uint b) {
    return a ^ (b * FNV_PRIME);
}

// ── KISS99 RNG ──────────────────────────────────────────────────────
typedef struct {
    uint z, w, jsr, jcong;
} kiss99_t;

inline uint kiss99(thread kiss99_t &st) {
    st.z = 36969u * (st.z & 0xFFFF) + (st.z >> 16);
    st.w = 18000u * (st.w & 0xFFFF) + (st.w >> 16);
    uint mwc = (st.w << 16) + st.z;
    st.jsr ^= st.jsr << 17;
    st.jsr ^= st.jsr >> 15;
    st.jsr ^= st.jsr << 5;
    st.jcong = 69069u * st.jcong + 1234567u;
    return (mwc ^ st.jcong) + st.jsr;
}

// ── Keccak-f[800] (32-bit word variant) ─────────────────────────────
constant const uint KECCAKF800_ROT[24] = {
    1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 2, 14, 27, 41, 56, 8, 25, 43, 62, 18, 39, 61, 20, 44
};

constant const uint KECCAKF800_PIL[24] = {
    10, 7, 11, 17, 18, 3, 5, 16, 8, 21, 24, 4, 15, 23, 19, 13, 12, 2, 20, 14, 22, 9, 6, 1
};

constant const uint KECCAKF800_RND[22] = {
    0x00000001u, 0x00008082u, 0x80000080u, 0x80008000u,
    0x0000008bu, 0x00008000u, 0x80008088u, 0x80000082u,
    0x0000000bu, 0x00008008u, 0x80008009u, 0x8000008au,
    0x00000088u, 0x80008000u, 0x8000808bu, 0x0000008bu,
    0x80008089u, 0x80008003u, 0x80008088u, 0x80000088u,
    0x80008082u, 0x8000000au
};

#define ROTL32(x, n) (((x) << (n)) | ((x) >> (32 - (n))))

inline void keccak_f800(thread uint st[25]) {
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
// Buffer layout:
//   0: header_hash  — device uchar[32]
//   1: target       — device uchar[32]
//   2: dag          — device ulong, DAG buffer (16 ulongs per entry)
//   3: output_nonce — device ulong[1]
//   4: output_hash  — device uchar[32]
//   5: output_mix   — device uchar[32]
//   6: found        — device uint[1]
//   7: base_nonce   — constant ulong* (scalar as buffer)
//   8: batch_size   — constant ulong* (scalar as buffer)
//   9: dag_entries  — constant ulong* (scalar as buffer)
//  10: prog_seed    — constant uint*  (scalar as buffer)

kernel void progpow_mine(
    device const uchar* header_hash  [[buffer(0)]],
    device const uchar* target       [[buffer(1)]],
    device const ulong* dag          [[buffer(2)]],
    device ulong*       output_nonce [[buffer(3)]],
    device uchar*       output_hash  [[buffer(4)]],
    device uchar*       output_mix   [[buffer(5)]],
    device uint*        found        [[buffer(6)]],
    constant ulong*     base_nonce   [[buffer(7)]],
    constant ulong*     batch_size   [[buffer(8)]],
    constant ulong*     dag_entries  [[buffer(9)]],
    constant uint*      prog_seed    [[buffer(10)]],
    uint gid [[thread_position_in_grid]]
)
{
    if (*found != 0u) return;

    ulong nonce = *base_nonce + (ulong)gid;
    if (nonce >= *base_nonce + *batch_size) return;

    // ── Step 1: seed = keccak_f800(header_hash || nonce) ──
    uint st[25] = {0};
    for (int i = 0; i < 8; i++) {
        st[i] = (uint)header_hash[i*4]
              | ((uint)header_hash[i*4+1] << 8)
              | ((uint)header_hash[i*4+2] << 16)
              | ((uint)header_hash[i*4+3] << 24);
    }
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
    kiss99_t rng = {
        362436069u,
        521288629u,
        (*prog_seed ^ 0x5DEECE6Du) | 0x1u,
        380116160u
    };

    for (int i = 0; i < PROGPOW_CNT_DAG; i++) {
        uint dag_idx = fnv1a(seed[0], (uint)i) ^ kiss99(rng);
        ulong entry = dag[(ulong)(dag_idx % (uint)*dag_entries) * 16];

        for (int lane = 0; lane < PROGPOW_LANES; lane++) {
            uint dag_word = (lane < 8)
                ? (uint)(entry & 0xFFFFFFFFu)
                : (uint)(entry >> 32);
            mix[lane * PROGPOW_REGS] = fnv1a(mix[lane * PROGPOW_REGS], dag_word);
        }
    }

    // ── Step 4: Compress mix → final hash ──
    uint fst[25] = {0};
    for (int i = 0; i < 8; i++) {
        fst[i] = (uint)header_hash[i*4]
               | ((uint)header_hash[i*4+1] << 8)
               | ((uint)header_hash[i*4+2] << 16)
               | ((uint)header_hash[i*4+3] << 24);
    }
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
        if (atomic_exchange_relaxed(found, 1u) == 0u) {
            *output_nonce = nonce;
            for (int i = 0; i < 32; i++) output_hash[i] = final_hash[i];
            for (int i = 0; i < 8; i++) {
                output_mix[i*4]     = (uchar)(mix[i]);
                output_mix[i*4 + 1] = (uchar)(mix[i] >> 8);
                output_mix[i*4 + 2] = (uchar)(mix[i] >> 16);
                output_mix[i*4 + 3] = (uchar)(mix[i] >> 24);
            }
        }
    }
}
