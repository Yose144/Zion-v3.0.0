// Quantus QPoW mining kernel — Metal (MSL) port of
// csrc/opencl/poseidon2_kernel.cl (itself a line-level port of the CUDA
// kernel csrc/cuda/poseidon2_kernel.cu / upstream quantus-miner
// `mining_u64.wgsl` G2) onto the identical Trinity buffer ABI.
//
// Buffers (all u32):
//   results[9]         : [0]=candidate count (atomic add), [1..9]=logical
//                        indices of up to MAX_HITS candidates
//   prestate[24]       : 12 felts as LE u32 pairs — sponge state after the
//                        initial external linear layer + round-0 constants,
//                        covering header + nonce_be[0..56] (host-computed
//                        `mining_prestate_low64`)
//   start_nonce[16]    : U512 LE limbs — batch base nonce; only the low 64
//                        bits advance (host caps batches at the carry)
//   difficulty_target[16] : U512 LE limbs
//   dispatch_config[3] : {total_threads, nonces_per_thread, total_nonces}
//
// Correctness contract (same as OpenCL/CUDA): `reduce128` keeps the lazy
// fold semantics — sums can land at most one EPS off a canonical residue on
// ~2^-33 rare carries. A wrong hash below target is rejected by the host
// CPU re-verification; a wrong hash for a valid nonce is simply missed.

#include <metal_stdlib>
#include <metal_atomic>
using namespace metal;

// Tunable unroll factors (host injects #defines via ZION_QPOW_METAL_* env;
// defaults preserve the original behaviour).
#ifndef QPOW_IUNROLL
#define QPOW_IUNROLL 1
#endif
#ifndef QPOW_EUNROLL
#define QPOW_EUNROLL 1
#endif

typedef uint u32;
typedef ulong u64;

#define MAX_HITS 8

constant u64 P64 = 0xFFFFFFFF00000001UL;
constant u64 EPS64 = 0xFFFFFFFFUL;
#define EPS32 0xFFFFFFFFu

// Round-constant tables carry one extra zero row (RC_INITIAL's last row holds
// the first internal constant in slot 0) so the round loops index them
// without per-round selects.
constant u64 RC_INTERNAL[23] = {
    0x97f7798a784ad863UL, 0xd1d2bf082f60d4f0UL, 0x69a377a79f9ad206UL,
    0xa9d06906a3858e24UL, 0x295275001eede5b5UL, 0x5874e441117bd746UL,
    0x8a084bbba8ed86ccUL, 0x3defd7645cde6425UL, 0x3998cfe6871cc137UL,
    0x3e52ef8bca48314aUL, 0x964a209f85dc9eccUL, 0x3fcc9ee82cc4577eUL,
    0x8e79b4a5d0096d6dUL, 0x8492362ad2392556UL, 0xee72f470262574d6UL,
    0x1e0e18496da2444aUL, 0x0f3a74bf215eaac6UL, 0x1b061b76a1c0ded3UL,
    0x192c42d86803d7a6UL, 0xf6d49ff997ae0260UL, 0x3ec372e7a0fa3786UL,
    0x5538cdf4f23445d3UL, 0UL};

constant u64 RC_INITIAL[5][12] = {
    {0xc002e770975b1607UL, 0xbca51a8dfe14593aUL, 0x72938dfbe774f7f9UL,
     0xe4f2fe29e03234acUL, 0xd5e0ba2f541b6449UL, 0xec33b868f3cc46c1UL,
     0x486dcb55419d475aUL, 0x6c1cb2a358cc24f1UL, 0xe3f30d509a1436bbUL,
     0xd9a64f068dca7c29UL, 0xe59b3f57aabba1aeUL, 0x2a3dd4505b478fdcUL},
    {0xada1f8dc7676ed25UL, 0x2711aa8b5509d516UL, 0x4ae6acd0c9c92897UL,
     0x56eb3d6b5256d67aUL, 0x1f7a9d55923bf51eUL, 0x3600427d397a7f68UL,
     0xe5076df75b72c3d0UL, 0xfcd59aa12c6090adUL, 0xcd895e8c68b57a9eUL,
     0x41df7ef9d730ae3eUL, 0xee3e2b889abe977dUL, 0xd29bb7edbeb9c405UL},
    {0x7d5c08eef608e382UL, 0x89ae889caaf0802cUL, 0xb35a8e976d2af617UL,
     0xdb14234eafaf5173UL, 0x78f04462d48b1c98UL, 0x265293b0e47ce88aUL,
     0x999a649b69b9d32fUL, 0x64b0a186698e01d3UL, 0xee0b22d0dfae8bb8UL,
     0x4fd53e50ca04a7eeUL, 0x5762bfe181f25047UL, 0xf51593e2beb5e3bdUL},
    {0x1e5e2b5760e32477UL, 0x622462a1f9aaaeedUL, 0xaa284b3ecdb222aeUL,
     0x63c8e72f542bf3fcUL, 0x3ba588cacb43b5e0UL, 0x23eda6f3c99150ddUL,
     0xaad3bea4baac9a5aUL, 0xe9da8d699b94184aUL, 0xcdb13f4cd93e024cUL,
     0x902cbd0956f655e3UL, 0x5b4e40ffc759532fUL, 0xde795c20a2357af7UL},
    {0x97f7798a784ad863UL, 0UL, 0UL, 0UL, 0UL, 0UL, 0UL, 0UL, 0UL,
     0UL, 0UL, 0UL}};

constant u64 RC_TERMINAL[5][12] = {
    {0x7b72c539e0ea4c6eUL, 0x144573dae2ce9976UL, 0x802028b68f35fc88UL,
     0x6d36c5022c4fe7c2UL, 0xa205d0ffa9b9def3UL, 0xf6e7e38b1ea6ba2fUL,
     0x34f7909ae5258d64UL, 0xb0464d9d77b97fcaUL, 0x64ddb9d5de7e00a6UL,
     0x0ed0d75c27975d97UL, 0x1cbb36f11127338bUL, 0x6673e505cfd0b6baUL},
    {0x605f902830872e01UL, 0x3fd5eb927e95fe4fUL, 0xe81025b5a24c69cdUL,
     0xf7d0ce75de23f74eUL, 0xf39942b6a8585089UL, 0x6d808a08f7b71df6UL,
     0xf8806b6588f49a8bUL, 0x57df2d8c2a32107aUL, 0x16e7c2074d654a2dUL,
     0x213de241fcf33835UL, 0xb0f2b8905a0976f6UL, 0xd8e3cf2bbd355417UL},
    {0xe498691679d9330fUL, 0x763b45d2a3821b28UL, 0x0908bf65eb0a1f0dUL,
     0x7691eb2d194b24f4UL, 0x0e43551233ae13b2UL, 0x93c393dbfc2fe76fUL,
     0x98f607485d48cdeaUL, 0xe3d95f30309819c0UL, 0x1ef581a93eaf6acfUL,
     0x0b24c1b7a030fca4UL, 0x624370be5670b327UL, 0x5f1e28615a11e486UL},
    {0xfe04051f909e042bUL, 0x7257e5b147fd3803UL, 0xe6ae134bb82f2e78UL,
     0x5711fd5cf4784511UL, 0xf83a42660c08c0bcUL, 0x2cd8c96d9a3ce855UL,
     0x7d2ffb1bb0e17271UL, 0x85ae1528caea3811UL, 0x52a345d5c7adb0b8UL,
     0x504c4c51f3faee94UL, 0xbce34a649cfccaf9UL, 0xe0a3389266fb6dc9UL},
    {0UL, 0UL, 0UL, 0UL, 0UL, 0UL, 0UL, 0UL, 0UL, 0UL, 0UL, 0UL}};

constant u64 MDS_DIAG[12] = {
    0xc3b6c08e23ba9300UL, 0xd84b5de94a324fb6UL, 0x0d0c371c5b35b84fUL,
    0x7964f570e7188037UL, 0x5daf18bbd996604bUL, 0x6743bc47b9595257UL,
    0x5528b9362c59bb70UL, 0xac45e25b7127b68bUL, 0xa2077d7dfbb606b5UL,
    0xf3faac6faee378aeUL, 0x0c6388b51545e883UL, 0xd27dbb6944917b60UL};

// a + b mod p with the single 2^64 -> EPS carry fold. Same uncorrected
// second-order wrap as the CUDA mad.cc chain.
static inline u64 gf64_add(u64 a, u64 b) {
    u64 s = a + b;
    if (s < a) {
        s += EPS64;
    }
    return s;
}

static inline void mul64wide(u64 a, u64 b, thread u32 *r0, thread u32 *r1,
                             thread u32 *r2, thread u32 *r3) {
    u64 lo = a * b;
    u64 hi = mulhi(a, b);
    *r0 = (u32)lo;
    *r1 = (u32)(lo >> 32);
    *r2 = (u32)hi;
    *r3 = (u32)(hi >> 32);
}

// 128 -> 64 bit fold using 2^64 = EPS and 2^96 = -1 (mod p):
//   value = (r1:r0) + r2*EPS - r3 (mod p), with the carry k of the first
//   sum folded as k*2^32 - k. The wrap of the +k<<32 add is deliberately
//   uncorrected (~2^-33 rare — same trade as the CUDA/OpenCL originals): a
//   slipped residue is a missed/bogus hash for one nonce and the host
//   re-verifies every recorded candidate on the CPU.
static inline u64 reduce128(u32 r0, u32 r1, u32 r2, u32 r3) {
    u64 x0 = ((u64)r1 << 32) | (u64)r0;
    u64 s = x0 + (u64)r2 * EPS64;
    u32 k = (s < x0) ? 1u : 0u;
    s += (u64)k << 32;
    s -= (u64)r3 + k;
    return s;
}

static inline u64 gf64_mul(u64 a, u64 b) {
    u32 r0, r1, r2, r3;
    mul64wide(a, b, &r0, &r1, &r2, &r3);
    return reduce128(r0, r1, r2, r3);
}

// Three partial products instead of four: (a1:a0)^2 = a0^2 + a0*a1*2^33 +
// a1^2*2^64 — assembled as an exact 128-bit value.
static inline u64 gf64_sqr(u64 a) {
    u64 a0 = (u32)a, a1 = a >> 32;
    u64 ll = a0 * a0;
    u64 lh = a0 * a1;
    u64 hh = a1 * a1;
    u64 lo = ll + (lh << 33);
    u64 hi = hh + (lh >> 31) + ((lo < ll) ? 1u : 0u);
    return reduce128((u32)lo, (u32)(lo >> 32), (u32)hi, (u32)(hi >> 32));
}

// x^7 with a depth-3 chain: x3 and x4 come from x2 in parallel.
static inline u64 gf64_sbox(u64 x) {
    u64 x2 = gf64_sqr(x);
    u64 x3 = gf64_mul(x2, x);
    u64 x4 = gf64_sqr(x2);
    return gf64_mul(x4, x3);
}

static inline u64 gf64_canon(u64 a) {
    return a - ((a >= P64) ? P64 : 0UL);
}

typedef struct {
    u32 l0;
    u32 l1;
    u32 h;
} Wide;

static inline Wide wide_from(u64 x) {
    Wide w;
    w.l0 = (u32)x;
    w.l1 = (u32)(x >> 32);
    w.h = 0;
    return w;
}

static inline void wide_add(thread Wide *w, u64 x) {
    u64 s = (u64)w->l0 + (u32)x;
    w->l0 = (u32)s;
    u64 t = (u64)w->l1 + (u32)(x >> 32) + (u32)(s >> 32);
    w->l1 = (u32)t;
    w->h += (u32)(t >> 32);
}

static inline void wide_add_wide(thread Wide *w, Wide x) {
    u64 s = (u64)w->l0 + x.l0;
    w->l0 = (u32)s;
    u64 t = (u64)w->l1 + x.l1 + (u32)(s >> 32);
    w->l1 = (u32)t;
    w->h += x.h + (u32)(t >> 32);
}

// A 96-bit lane is a 128-bit value with a zero top word.
static inline u64 wide_reduce(Wide w) {
    return reduce128(w.l0, w.l1, w.h, 0u);
}

static inline void add128_wide(thread u32 *r0, thread u32 *r1, thread u32 *r2,
                               thread u32 *r3, Wide w) {
    u64 s = (u64)(*r0) + w.l0;
    *r0 = (u32)s;
    u64 t = (u64)(*r1) + w.l1 + (u32)(s >> 32);
    *r1 = (u32)t;
    u64 u = (u64)(*r2) + w.h + (u32)(t >> 32);
    *r2 = (u32)u;
    *r3 += (u32)(u >> 32);
}

// a * b + w as a 128-bit value. Same accumulation as the CUDA mad.wide
// chain — the 96-bit addend rides in the partial-product accumulation.
// Requires b < 2^64 - 2^59 (true for MDS_DIAG) and w.h small.
static inline void mul128_add_wide(u64 a, u64 b, Wide w, thread u32 *r0,
                                   thread u32 *r1, thread u32 *r2,
                                   thread u32 *r3) {
    u64 lo = a * b;
    u64 hi = mulhi(a, b);
    u32 c0 = (u32)lo, c1 = (u32)(lo >> 32), c2 = (u32)hi, c3 = (u32)(hi >> 32);
    u64 s = (u64)c0 + w.l0;
    c0 = (u32)s;
    u64 t = (u64)c1 + w.l1 + (u32)(s >> 32);
    c1 = (u32)t;
    u64 u = (u64)c2 + w.h + (u32)(t >> 32);
    c2 = (u32)u;
    c3 += (u32)(u >> 32);
    *r0 = c0;
    *r1 = c1;
    *r2 = c2;
    *r3 = c3;
}

static inline void ext_layer64(thread u64 *state, constant u64 *rc12) {
    Wide y[12];
#pragma unroll
    for (int chunk = 0; chunk < 3; chunk++) {
        int o = chunk * 4;
        u64 x0 = state[o];
        u64 x1 = state[o + 1];
        u64 x2 = state[o + 2];
        u64 x3 = state[o + 3];
        Wide t01 = wide_from(x0);
        wide_add(&t01, x1);
        Wide t23 = wide_from(x2);
        wide_add(&t23, x3);
        Wide t0123 = t01;
        wide_add_wide(&t0123, t23);
        Wide t01123 = t0123;
        wide_add(&t01123, x1);
        Wide t01233 = t0123;
        wide_add(&t01233, x3);
        y[o + 3] = t01233;
        wide_add(&y[o + 3], x0);
        wide_add(&y[o + 3], x0);
        y[o + 1] = t01123;
        wide_add(&y[o + 1], x2);
        wide_add(&y[o + 1], x2);
        y[o] = t01123;
        wide_add_wide(&y[o], t01);
        y[o + 2] = t01233;
        wide_add_wide(&y[o + 2], t23);
    }
    Wide sums[4];
#pragma unroll
    for (int k = 0; k < 4; k++) {
        sums[k] = y[k];
        wide_add_wide(&sums[k], y[k + 4]);
        wide_add_wide(&sums[k], y[k + 8]);
    }
#pragma unroll
    for (int i = 0; i < 12; i++) {
        Wide w = y[i];
        wide_add_wide(&w, sums[i % 4]);
        wide_add(&w, rc12[i]);
        state[i] = wide_reduce(w);
    }
}

// Software-pipelined internal round. `x` is this round's S-boxed element 0.
// Elements 1..11 are summed before x is needed, element 0's output comes out
// first so the caller can start the next S-box while the other 11 products
// retire, and the unreduced 96-bit row sum (plus rc0 for element 0) rides in
// the multiply accumulators. Returns the new element 0; updates state[1..11].
static inline u64 int_round_p(thread u64 *state, u64 x, u64 rc0) {
    Wide s = wide_from(state[1]);
#pragma unroll
    for (int i = 2; i < 12; i++) {
        wide_add(&s, state[i]);
    }
    wide_add(&s, x);
    Wide s0 = s;
    wide_add(&s0, rc0);
    u32 r0, r1, r2, r3;
    mul64wide(x, MDS_DIAG[0], &r0, &r1, &r2, &r3);
    add128_wide(&r0, &r1, &r2, &r3, s0);
    u64 out0 = reduce128(r0, r1, r2, r3);
#pragma unroll
    for (int i = 1; i < 12; i++) {
        mul64wide(state[i], MDS_DIAG[i], &r0, &r1, &r2, &r3);
        add128_wide(&r0, &r1, &r2, &r3, s);
        state[i] = reduce128(r0, r1, r2, r3);
    }
    return out0;
}

static void permute64_after_initial(thread u64 *state) {
#pragma unroll QPOW_EUNROLL
    for (int r = 0; r < 4; r++) {
#pragma unroll
        for (int i = 0; i < 12; i++) {
            state[i] = gf64_sbox(state[i]);
        }
        ext_layer64(state, RC_INITIAL[r + 1]);
    }
    u64 x = gf64_sbox(state[0]);
#pragma unroll QPOW_IUNROLL
    for (int r = 0; r < 21; r++) {
        x = gf64_sbox(int_round_p(state, x, RC_INTERNAL[r + 1]));
    }
    state[0] = int_round_p(state, x, 0UL);
#pragma unroll
    for (int i = 0; i < 12; i++) {
        state[i] = gf64_add(state[i], RC_TERMINAL[0][i]);
    }
#pragma unroll QPOW_EUNROLL
    for (int r = 0; r < 4; r++) {
#pragma unroll
        for (int i = 0; i < 12; i++) {
            state[i] = gf64_sbox(state[i]);
        }
        ext_layer64(state, RC_TERMINAL[r + 1]);
    }
}

// Two consecutive permutations from the post-initial-layer prestate: first
// finishes the nonce-absorb block, second finishes the [1,1] padding block,
// leaving the state ready for the first squeeze.
static void permute64_twice_after_initial(thread u64 *state) {
    for (int pass = 0; pass < 2; pass++) {
        if (pass != 0) {
            ext_layer64(state, RC_INITIAL[0]);
        }
        permute64_after_initial(state);
        if (pass == 0) {
            state[0] = gf64_add(state[0], 1UL);
            state[1] = gf64_add(state[1], 1UL);
        }
    }
}

static inline u32 bswap32(u32 v) {
    return (v >> 24) | ((v >> 8) & 0x0000FF00u) | ((v << 8) & 0x00FF0000u)
           | (v << 24);
}

// Nonce evaluation shared by the mining and debug kernels: inject the
// logical-index nonce into the prestate and run the two permutations,
// leaving `st` ready for the first squeeze.
static void inject_nonce(u64 nonce_base_low, u32 logical_index,
                         thread u64 *st) {
    u64 nonce_low = nonce_base_low + (u64)logical_index;
    u64 x6 = (u64)bswap32((u32)(nonce_low >> 32));
    u64 x7 = (u64)bswap32((u32)nonce_low);
    u64 x6_2 = x6 + x6;
    u64 x6_3 = x6_2 + x6;
    u64 x6_4 = x6_2 + x6_2;
    u64 x6_6 = x6_3 + x6_3;
    u64 x7_2 = x7 + x7;
    u64 x7_3 = x7_2 + x7;
    u64 x7_4 = x7_2 + x7_2;
    u64 x7_6 = x7_3 + x7_3;
    u64 c0 = x6 + x7;
    u64 c1 = x6_3 + x7;
    u64 c2 = x6_2 + x7_3;
    u64 c3 = x6 + x7_2;
    st[0] = gf64_add(st[0], c0);
    st[1] = gf64_add(st[1], c1);
    st[2] = gf64_add(st[2], c2);
    st[3] = gf64_add(st[3], c3);
    st[4] = gf64_add(st[4], x6_2 + x7_2);
    st[5] = gf64_add(st[5], x6_6 + x7_2);
    st[6] = gf64_add(st[6], x6_4 + x7_6);
    st[7] = gf64_add(st[7], x6_2 + x7_4);
    st[8] = gf64_add(st[8], c0);
    st[9] = gf64_add(st[9], c1);
    st[10] = gf64_add(st[10], c2);
    st[11] = gf64_add(st[11], c3);
}

// Load the prestate, inject the logical-index nonce and run the two
// permutations, leaving `st` ready for the first squeeze.
static void eval_nonce_state(device const u32 *prestate, u64 nonce_base_low,
                             u32 logical_index, thread u64 *st) {
#pragma unroll
    for (int i = 0; i < 12; i++) {
        st[i] = ((u64)prestate[2 * i + 1] << 32) | (u64)prestate[2 * i];
    }
    inject_nonce(nonce_base_low, logical_index, st);
    permute64_twice_after_initial(st);
}

kernel void qpow_mine(
    device u32 *results                 [[buffer(0)]],
    device const u32 *prestate          [[buffer(1)]],
    device const u32 *start_nonce       [[buffer(2)]],
    device const u32 *difficulty_target [[buffer(3)]],
    device const u32 *dispatch_config   [[buffer(4)]],
    uint thread_id [[thread_position_in_grid]]) {
    u32 total_threads = dispatch_config[0];
    u32 nonces_per_thread = dispatch_config[1];
    u32 total_nonces = dispatch_config[2];
    if (thread_id >= total_threads) {
        return;
    }
    u32 base_index = thread_id * nonces_per_thread;

    u32 tgt_hi[8];
#pragma unroll
    for (int i = 0; i < 8; i++) {
        tgt_hi[i] = difficulty_target[8 + i];
    }
    u64 nonce_base_low = ((u64)start_nonce[1] << 32) | (u64)start_nonce[0];

    for (u32 j = 0; j < nonces_per_thread; j++) {
        u32 logical_index = base_index + j;
        if (logical_index >= total_nonces) {
            break;
        }
        u64 st[12];
        eval_nonce_state(prestate, nonce_base_low, logical_index, st);

        // First squeeze = the most significant 256 bits of the 64-byte BE
        // hash; compare them against the target high half and pay for the
        // second squeeze only on candidates (host re-verifies fully anyway).
        u32 first[8];
#pragma unroll
        for (int i = 0; i < 4; i++) {
            u64 c = gf64_canon(st[i]);
            first[2 * i] = (u32)(c & EPS64);
            first[2 * i + 1] = (u32)(c >> 32);
        }
        u32 cmp = 0u;
        for (int i = 0; i < 8; i++) {
            u32 h = bswap32(first[i]);
            u32 t = tgt_hi[7 - i];
            if (h != t) {
                cmp = (h > t) ? 1u : 2u;
                break;
            }
        }
        if (cmp == 1u) {
            continue;
        }
        // Record the candidate and keep going: no thread ever stops early, so
        // a launch always evaluates its whole rectangle. The host recomputes
        // and verifies every recorded index on the CPU.
        u32 slot = atomic_fetch_add_explicit(
            (device atomic_uint *)results, 1u, memory_order_relaxed);
        if (slot < MAX_HITS) {
            results[1 + slot] = logical_index;
        }
    }
}

// ============================================================================
// Lane-parallel variant — 3 lanes × 4 felts per nonce, 10 nonces per
// simdgroup32 (lanes 30/31 idle). Lane `fl` (0..2) owns the 4 felts of mat4
// chunk `fl`, which makes the external-layer mat4 entirely thread-local;
// only the circulant sums and the internal-round row sum cross lanes
// (8 + 2 simd_shuffles respectively). Remote contributions are transported
// as reduced u64 and accumulated locally in Wide — residue-equivalent to the
// scalar Wide schedule (same ~2^-33 lazy-fold contract).
// ============================================================================

// u64 simd_shuffle is not a valid simdgroup type — transport as two u32s.
static inline u64 shuffle_u64(u64 v, ushort lane) {
    u32 lo = simd_shuffle((u32)v, lane);
    u32 hi = simd_shuffle((u32)(v >> 32), lane);
    return ((u64)hi << 32) | (u64)lo;
}

// mat4 of the lane-owned chunk in Wide arithmetic (identical math to the
// scalar ext_layer64 chunk loop).
static inline void mat4_wide(thread const u64 x[4], thread Wide y[4]) {
    Wide t01 = wide_from(x[0]);
    wide_add(&t01, x[1]);
    Wide t23 = wide_from(x[2]);
    wide_add(&t23, x[3]);
    Wide t0123 = t01;
    wide_add_wide(&t0123, t23);
    Wide t01123 = t0123;
    wide_add(&t01123, x[1]);
    Wide t01233 = t0123;
    wide_add(&t01233, x[3]);
    y[3] = t01233;
    wide_add(&y[3], x[0]);
    wide_add(&y[3], x[0]);
    y[1] = t01123;
    wide_add(&y[1], x[2]);
    wide_add(&y[1], x[2]);
    y[0] = t01123;
    wide_add_wide(&y[0], t01);
    y[2] = t01233;
    wide_add_wide(&y[2], t23);
}

// External linear layer on the lane-owned 4-felt slice.
// `gl` = simdgroup-local index of this group's lane 0 (= 3*nl), `fl` = 0..2.
static inline void ext_layer_lane(thread u64 st[4], constant u64 *rc12,
                                  u32 gl, u32 fl) {
    Wide y[4];
    mat4_wide(st, y);
    u64 yr[4];
#pragma unroll
    for (int k = 0; k < 4; k++) {
        yr[k] = wide_reduce(y[k]);
    }
    // sums[k] = y_lane0[k] + y_lane1[k] + y_lane2[k] — every lane assembles
    // the same four sums from two remote shuffles each.
    u32 r1 = gl + (fl + 1) % 3;
    u32 r2 = gl + (fl + 2) % 3;
    Wide sw[4];
#pragma unroll
    for (int k = 0; k < 4; k++) {
        sw[k] = wide_from(yr[k]);
        wide_add(&sw[k], shuffle_u64(yr[k], (ushort)r1));
        wide_add(&sw[k], shuffle_u64(yr[k], (ushort)r2));
    }
    u32 o = fl * 4;
#pragma unroll
    for (int i = 0; i < 4; i++) {
        Wide w = y[i];
        wide_add_wide(&w, sw[i]);
        wide_add(&w, rc12[o + i]);
        st[i] = wide_reduce(w);
    }
}

// Internal round on the lane-owned slice. `x` lives on lane 0 (its felt 0 is
// implicit — carried in `x` between calls, exactly like the scalar
// int_round_p pipeline). All lanes return the round's row sum; lane 0 also
// computes the next sbox input via *out0.
static inline void int_round_lane(thread u64 st[4], u64 x, u64 rc0,
                                  u32 gl, u32 fl, thread u64 *out0) {
    // s = sum(felts 1..11) + x  →  lane0's part is local[1..3] + x, the
    // other lanes contribute all four felts.
    Wide part;
    if (fl == 0) {
        part = wide_from(st[1]);
        wide_add(&part, st[2]);
        wide_add(&part, st[3]);
        wide_add(&part, x);
    } else {
        part = wide_from(st[0]);
        wide_add(&part, st[1]);
        wide_add(&part, st[2]);
        wide_add(&part, st[3]);
    }
    u64 pr = wide_reduce(part);
    u32 r1 = gl + (fl + 1) % 3;
    u32 r2 = gl + (fl + 2) % 3;
    Wide sw = wide_from(pr);
    wide_add(&sw, shuffle_u64(pr, (ushort)r1));
    wide_add(&sw, shuffle_u64(pr, (ushort)r2));
    u64 s = wide_reduce(sw);

    if (fl == 0) {
        // out0 = (s + rc0) + x*diag[0] — feeds the next round's sbox.
        u32 r0, r1w, r2w, r3w;
        Wide acc = wide_from(s);
        wide_add(&acc, rc0);
        mul128_add_wide(x, MDS_DIAG[0], acc, &r0, &r1w, &r2w, &r3w);
        *out0 = reduce128(r0, r1w, r2w, r3w);
    }
    u32 o = fl * 4;
#pragma unroll
    for (int i = (fl == 0 ? 1 : 0); i < 4; i++) {
        u32 r0, r1w, r2w, r3w;
        mul128_add_wide(st[i], MDS_DIAG[o + i], wide_from(s), &r0, &r1w,
                        &r2w, &r3w);
        st[i] = reduce128(r0, r1w, r2w, r3w);
    }
}

static void permute64_after_initial_lane(thread u64 st[4], u32 gl, u32 fl) {
#pragma unroll QPOW_EUNROLL
    for (int r = 0; r < 4; r++) {
#pragma unroll
        for (int i = 0; i < 4; i++) {
            st[i] = gf64_sbox(st[i]);
        }
        ext_layer_lane(st, RC_INITIAL[r + 1], gl, fl);
    }
    // The sbox on felt 0 runs on lane 0 only; other lanes never touch `x`.
    u64 x = 0;
    if (fl == 0) {
        x = gf64_sbox(st[0]);
    }
#pragma unroll QPOW_IUNROLL
    for (int r = 0; r < 21; r++) {
        u64 out0 = 0;
        int_round_lane(st, x, RC_INTERNAL[r + 1], gl, fl, &out0);
        if (fl == 0) {
            x = gf64_sbox(out0);
        }
    }
    // Final internal round (rc0 = 0): all lanes must run it — the shuffle
    // exchange is only legal when the whole 3-lane group participates —
    // and every lane's non-felt-0 slice gets its last update here.
    u64 last0 = 0;
    int_round_lane(st, x, 0UL, gl, fl, &last0);
    if (fl == 0) {
        st[0] = last0;
    }
    // RC_TERMINAL[0] constants, then the terminal external rounds.
#pragma unroll
    for (int i = 0; i < 4; i++) {
        st[i] = gf64_add(st[i], RC_TERMINAL[0][fl * 4 + i]);
    }
#pragma unroll QPOW_EUNROLL
    for (int r = 0; r < 4; r++) {
#pragma unroll
        for (int i = 0; i < 4; i++) {
            st[i] = gf64_sbox(st[i]);
        }
        ext_layer_lane(st, RC_TERMINAL[r + 1], gl, fl);
    }
}

static void permute64_twice_after_initial_lane(thread u64 st[4], u32 gl,
                                               u32 fl) {
    for (int pass = 0; pass < 2; pass++) {
        if (pass != 0) {
            ext_layer_lane(st, RC_INITIAL[0], gl, fl);
        }
        permute64_after_initial_lane(st, gl, fl);
        if (pass == 0) {
            // Padding block [1,1] lands on felts 0 and 1 — both on lane 0.
            if (fl == 0) {
                st[0] = gf64_add(st[0], 1UL);
                st[1] = gf64_add(st[1], 1UL);
            }
        }
    }
}

// Nonce injection on the lane-owned slice — every lane computes the x6/x7
// constants redundantly (two bswaps + ~10 adds, cheaper than shuffles),
// then applies only its own four felt updates.
static void inject_nonce_lane(u64 nonce_base_low, u32 logical_index,
                              thread u64 st[4], u32 fl) {
    u64 nonce_low = nonce_base_low + (u64)logical_index;
    u64 x6 = (u64)bswap32((u32)(nonce_low >> 32));
    u64 x7 = (u64)bswap32((u32)nonce_low);
    if (fl == 0) {
        u64 x6_2 = x6 + x6;
        u64 x6_3 = x6_2 + x6;
        u64 x7_2 = x7 + x7;
        u64 x7_3 = x7_2 + x7;
        u64 c0 = x6 + x7;
        u64 c1 = x6_3 + x7;
        u64 c2 = x6_2 + x7_3;
        u64 c3 = x6 + x7_2;
        st[0] = gf64_add(st[0], c0);
        st[1] = gf64_add(st[1], c1);
        st[2] = gf64_add(st[2], c2);
        st[3] = gf64_add(st[3], c3);
    } else if (fl == 1) {
        u64 x6_2 = x6 + x6;
        u64 x6_3 = x6_2 + x6;
        u64 x6_4 = x6_2 + x6_2;
        u64 x6_6 = x6_3 + x6_3;
        u64 x7_2 = x7 + x7;
        u64 x7_3 = x7_2 + x7;
        u64 x7_4 = x7_2 + x7_2;
        u64 x7_6 = x7_3 + x7_3;
        st[0] = gf64_add(st[0], x6_2 + x7_2);
        st[1] = gf64_add(st[1], x6_6 + x7_2);
        st[2] = gf64_add(st[2], x6_4 + x7_6);
        st[3] = gf64_add(st[3], x6_2 + x7_4);
    } else {
        u64 x6_2 = x6 + x6;
        u64 x6_3 = x6_2 + x6;
        u64 x7_2 = x7 + x7;
        u64 x7_3 = x7_2 + x7;
        u64 c0 = x6 + x7;
        u64 c1 = x6_3 + x7;
        u64 c2 = x6_2 + x7_3;
        u64 c3 = x6 + x7_2;
        st[0] = gf64_add(st[0], c0);
        st[1] = gf64_add(st[1], c1);
        st[2] = gf64_add(st[2], c2);
        st[3] = gf64_add(st[3], c3);
    }
}

// Load this lane's 4-felt slice of the prestate, inject the nonce and run
// the two permutations. `st` ends ready for the first squeeze (all on lane 0).
static void eval_nonce_state_lane(device const u32 *prestate,
                                  u64 nonce_base_low, u32 logical_index,
                                  thread u64 st[4], u32 gl, u32 fl) {
    u32 o = fl * 8; // 4 felts × 2 u32 limbs
#pragma unroll
    for (int i = 0; i < 4; i++) {
        st[i] = ((u64)prestate[o + 2 * i + 1] << 32) | (u64)prestate[o + 2 * i];
    }
    inject_nonce_lane(nonce_base_low, logical_index, st, fl);
    permute64_twice_after_initial_lane(st, gl, fl);
}

kernel void qpow_lane(
    device u32 *results                 [[buffer(0)]],
    device const u32 *prestate          [[buffer(1)]],
    device const u32 *start_nonce       [[buffer(2)]],
    device const u32 *difficulty_target [[buffer(3)]],
    device const u32 *dispatch_config   [[buffer(4)]],
    uint thread_id [[thread_position_in_grid]]) {
    u32 total_threads = dispatch_config[0];
    u32 nonces_per_thread = dispatch_config[1];
    u32 total_nonces = dispatch_config[2];
    if (thread_id >= total_threads) {
        return;
    }
    u32 lane = thread_id & 31u;          // simdgroup-local lane index
    if (lane >= 30u) {
        return;                          // 3 lanes × 10 nonces per simdgroup
    }
    u32 nl = lane / 3u;                  // nonce slot within the simdgroup
    u32 fl = lane % 3u;                  // felt-lane (chunk owner)
    u32 gl = nl * 3u;                    // group base lane
    u32 group_idx = (thread_id >> 5) * 10u + nl;
    u32 base_index = group_idx * nonces_per_thread;

    u32 tgt_hi[8];
#pragma unroll
    for (int i = 0; i < 8; i++) {
        tgt_hi[i] = difficulty_target[8 + i];
    }
    u64 nonce_base_low = ((u64)start_nonce[1] << 32) | (u64)start_nonce[0];

    for (u32 j = 0; j < nonces_per_thread; j++) {
        u32 logical_index = base_index + j;
        if (logical_index >= total_nonces) {
            break;
        }
        u64 st[4];
        eval_nonce_state_lane(prestate, nonce_base_low, logical_index, st,
                              gl, fl);

        // First squeeze = felts 0..3 → all on lane 0 — the compare and the
        // hit record are entirely lane-local there.
        if (fl == 0) {
            u32 first[8];
#pragma unroll
            for (int i = 0; i < 4; i++) {
                u64 c = gf64_canon(st[i]);
                first[2 * i] = (u32)(c & EPS64);
                first[2 * i + 1] = (u32)(c >> 32);
            }
            u32 cmp = 0u;
            for (int i = 0; i < 8; i++) {
                u32 h = bswap32(first[i]);
                u32 t = tgt_hi[7 - i];
                if (h != t) {
                    cmp = (h > t) ? 1u : 2u;
                    break;
                }
            }
            if (cmp != 1u) {
                u32 slot = atomic_fetch_add_explicit(
                    (device atomic_uint *)results, 1u, memory_order_relaxed);
                if (slot < MAX_HITS) {
                    results[1 + slot] = logical_index;
                }
            }
        }
    }
}
