// Native-u64 Poseidon2 (Goldilocks) mining kernel for Quantus QPoW.
// 1:1 port of quantus-miner mining_u64.wgsl — bit-exact with pow_core.
//
// Buffers (all u32):
//   results[33]        : [0]=found flag, [1..17]=nonce U512 LE limbs,
//                        [17..33]=hash U512 LE limbs
//   midstate[24]       : 12 felts as LE u32 pairs — sponge state after
//                        absorbing header + high nonce half (host-computed)
//   start_nonce[16]    : U512 LE limbs — batch base nonce
//   difficulty_target[16] : U512 LE limbs
//   dispatch_config[3] : {total_threads, nonces_per_thread, total_nonces}

typedef unsigned int u32;
typedef unsigned long long u64;

__device__ __constant__ u64 P64 = 0xFFFFFFFF00000001ULL;
// EPS64 = 2^32 - 1 = 2^64 mod P
__device__ __constant__ u64 EPS64 = 0xFFFFFFFFULL;

__device__ __constant__ u64 RC_INTERNAL[22] = {
    0x97f7798a784ad863ULL, 0xd1d2bf082f60d4f0ULL, 0x69a377a79f9ad206ULL,
    0xa9d06906a3858e24ULL, 0x295275001eede5b5ULL, 0x5874e441117bd746ULL,
    0x8a084bbba8ed86ccULL, 0x3defd7645cde6425ULL, 0x3998cfe6871cc137ULL,
    0x3e52ef8bca48314aULL, 0x964a209f85dc9eccULL, 0x3fcc9ee82cc4577eULL,
    0x8e79b4a5d0096d6dULL, 0x8492362ad2392556ULL, 0xee72f470262574d6ULL,
    0x1e0e18496da2444aULL, 0x0f3a74bf215eaac6ULL, 0x1b061b76a1c0ded3ULL,
    0x192c42d86803d7a6ULL, 0xf6d49ff997ae0260ULL, 0x3ec372e7a0fa3786ULL,
    0x5538cdf4f23445d3ULL
};

__device__ __constant__ u64 RC_INITIAL[4][12] = {
    {0xc002e770975b1607ULL, 0xbca51a8dfe14593aULL, 0x72938dfbe774f7f9ULL,
     0xe4f2fe29e03234acULL, 0xd5e0ba2f541b6449ULL, 0xec33b868f3cc46c1ULL,
     0x486dcb55419d475aULL, 0x6c1cb2a358cc24f1ULL, 0xe3f30d509a1436bbULL,
     0xd9a64f068dca7c29ULL, 0xe59b3f57aabba1aeULL, 0x2a3dd4505b478fdcULL},
    {0xada1f8dc7676ed25ULL, 0x2711aa8b5509d516ULL, 0x4ae6acd0c9c92897ULL,
     0x56eb3d6b5256d67aULL, 0x1f7a9d55923bf51eULL, 0x3600427d397a7f68ULL,
     0xe5076df75b72c3d0ULL, 0xfcd59aa12c6090adULL, 0xcd895e8c68b57a9eULL,
     0x41df7ef9d730ae3eULL, 0xee3e2b889abe977dULL, 0xd29bb7edbeb9c405ULL},
    {0x7d5c08eef608e382ULL, 0x89ae889caaf0802cULL, 0xb35a8e976d2af617ULL,
     0xdb14234eafaf5173ULL, 0x78f04462d48b1c98ULL, 0x265293b0e47ce88aULL,
     0x999a649b69b9d32fULL, 0x64b0a186698e01d3ULL, 0xee0b22d0dfae8bb8ULL,
     0x4fd53e50ca04a7eeULL, 0x5762bfe181f25047ULL, 0xf51593e2beb5e3bdULL},
    {0x1e5e2b5760e32477ULL, 0x622462a1f9aaaeedULL, 0xaa284b3ecdb222aeULL,
     0x63c8e72f542bf3fcULL, 0x3ba588cacb43b5e0ULL, 0x23eda6f3c99150ddULL,
     0xaad3bea4baac9a5aULL, 0xe9da8d699b94184aULL, 0xcdb13f4cd93e024cULL,
     0x902cbd0956f655e3ULL, 0x5b4e40ffc759532fULL, 0xde795c20a2357af7ULL}
};

__device__ __constant__ u64 RC_TERMINAL[4][12] = {
    {0x7b72c539e0ea4c6eULL, 0x144573dae2ce9976ULL, 0x802028b68f35fc88ULL,
     0x6d36c5022c4fe7c2ULL, 0xa205d0ffa9b9def3ULL, 0xf6e7e38b1ea6ba2fULL,
     0x34f7909ae5258d64ULL, 0xb0464d9d77b97fcaULL, 0x64ddb9d5de7e00a6ULL,
     0x0ed0d75c27975d97ULL, 0x1cbb36f11127338bULL, 0x6673e505cfd0b6baULL},
    {0x605f902830872e01ULL, 0x3fd5eb927e95fe4fULL, 0xe81025b5a24c69cdULL,
     0xf7d0ce75de23f74eULL, 0xf39942b6a8585089ULL, 0x6d808a08f7b71df6ULL,
     0xf8806b6588f49a8bULL, 0x57df2d8c2a32107aULL, 0x16e7c2074d654a2dULL,
     0x213de241fcf33835ULL, 0xb0f2b8905a0976f6ULL, 0xd8e3cf2bbd355417ULL},
    {0xe498691679d9330fULL, 0x763b45d2a3821b28ULL, 0x0908bf65eb0a1f0dULL,
     0x7691eb2d194b24f4ULL, 0x0e43551233ae13b2ULL, 0x93c393dbfc2fe76fULL,
     0x98f607485d48cdeaULL, 0xe3d95f30309819c0ULL, 0x1ef581a93eaf6acfULL,
     0x0b24c1b7a030fca4ULL, 0x624370be5670b327ULL, 0x5f1e28615a11e486ULL},
    {0xfe04051f909e042bULL, 0x7257e5b147fd3803ULL, 0xe6ae134bb82f2e78ULL,
     0x5711fd5cf4784511ULL, 0xf83a42660c08c0bcULL, 0x2cd8c96d9a3ce855ULL,
     0x7d2ffb1bb0e17271ULL, 0x85ae1528caea3811ULL, 0x52a345d5c7adb0b8ULL,
     0x504c4c51f3faee94ULL, 0xbce34a649cfccaf9ULL, 0xe0a3389266fb6dc9ULL}
};

__device__ __constant__ u64 MDS_DIAG[12] = {
    0xc3b6c08e23ba9300ULL, 0xd84b5de94a324fb6ULL, 0x0d0c371c5b35b84fULL,
    0x7964f570e7188037ULL, 0x5daf18bbd996604bULL, 0x6743bc47b9595257ULL,
    0x5528b9362c59bb70ULL, 0xac45e25b7127b68bULL, 0xa2077d7dfbb606b5ULL,
    0xf3faac6faee378aeULL, 0x0c6388b51545e883ULL, 0xd27dbb6944917b60ULL
};

// a + b mod P in lazy form. Wrapping carries fold back via 2^64 ≡ EPS64 (mod P).
__device__ __forceinline__ u64 gf64_add(u64 a, u64 b) {
    u64 s0 = a + b;
    bool c1 = s0 < a;
    u64 s1 = s0 + (c1 ? EPS64 : 0ULL);
    bool c2 = c1 && (s1 < s0);
    return s1 + (c2 ? EPS64 : 0ULL);
}

// Reduce a 128-bit value (lo + hi*2^64) mod P using
// 2^64 ≡ EPS64 and 2^96 ≡ -1 (mod P).
__device__ __forceinline__ u64 gf64_reduce(u64 lo, u64 hi) {
    u64 hi_hi = hi >> 32;
    u64 hi_lo = hi & EPS64;
    u64 t0 = lo - hi_hi;
    t0 = t0 - (lo < hi_hi ? EPS64 : 0ULL);
    u64 t1 = hi_lo * EPS64;
    u64 t2 = t0 + t1;
    return t2 + (t2 < t0 ? EPS64 : 0ULL);
}

__device__ __forceinline__ u64 gf64_mul(u64 a, u64 b) {
    u64 a_lo = a & EPS64;
    u64 a_hi = a >> 32;
    u64 b_lo = b & EPS64;
    u64 b_hi = b >> 32;
    u64 ll = a_lo * b_lo;
    u64 lh = a_lo * b_hi;
    u64 hl = a_hi * b_lo;
    u64 hh = a_hi * b_hi;
    u64 mid = lh + hl;
    u64 mid_c = mid < lh ? 1ULL : 0ULL;
    u64 lo = ll + (mid << 32);
    u64 lo_c = lo < ll ? 1ULL : 0ULL;
    u64 hi = hh + (mid >> 32) + (mid_c << 32) + lo_c;
    return gf64_reduce(lo, hi);
}

__device__ __forceinline__ u64 gf64_sqr(u64 a) {
    u64 a_lo = a & EPS64;
    u64 a_hi = a >> 32;
    u64 ll = a_lo * a_lo;
    u64 lh = a_lo * a_hi;
    u64 hh = a_hi * a_hi;
    u64 mid = lh << 1;
    u64 mid_c = lh >> 63;
    u64 lo = ll + (mid << 32);
    u64 lo_c = lo < ll ? 1ULL : 0ULL;
    u64 hi = hh + (mid >> 32) + (mid_c << 32) + lo_c;
    return gf64_reduce(lo, hi);
}

__device__ __forceinline__ u64 gf64_sbox(u64 x) {
    u64 x2 = gf64_sqr(x);
    u64 x4 = gf64_sqr(x2);
    u64 x6 = gf64_mul(x4, x2);
    return gf64_mul(x6, x);
}

__device__ __forceinline__ u64 gf64_canon(u64 a) {
    return a - (a >= P64 ? P64 : 0ULL);
}

// External linear layer: 4x4 MDS on each chunk, then circulant sums.
__device__ __forceinline__ void ext_layer64(u64 st[12]) {
    for (u32 chunk = 0u; chunk < 3u; chunk++) {
        u32 o = chunk * 4u;
        u64 x0 = st[o];
        u64 x1 = st[o + 1u];
        u64 x2 = st[o + 2u];
        u64 x3 = st[o + 3u];
        u64 t01 = gf64_add(x0, x1);
        u64 t23 = gf64_add(x2, x3);
        u64 t0123 = gf64_add(t01, t23);
        u64 t01123 = gf64_add(t0123, x1);
        u64 t01233 = gf64_add(t0123, x3);
        st[o + 3u] = gf64_add(t01233, gf64_add(x0, x0));
        st[o + 1u] = gf64_add(t01123, gf64_add(x2, x2));
        st[o] = gf64_add(t01123, t01);
        st[o + 2u] = gf64_add(t01233, t23);
    }
    u64 sums[4];
    for (u32 k = 0u; k < 4u; k++) {
        sums[k] = gf64_add(gf64_add(st[k], st[k + 4u]), st[k + 8u]);
    }
    for (u32 i = 0u; i < 12u; i++) {
        st[i] = gf64_add(st[i], sums[i & 3u]);
    }
}

// Internal linear layer: diagonal matrix plus full sum.
__device__ __forceinline__ void int_layer64(u64 st[12]) {
    u64 sum = st[0];
    for (u32 i = 1u; i < 12u; i++) {
        sum = gf64_add(sum, st[i]);
    }
    for (u32 i = 0u; i < 12u; i++) {
        st[i] = gf64_add(gf64_mul(st[i], MDS_DIAG[i]), sum);
    }
}

__device__ __forceinline__ void permute64(u64 st[12]) {
    ext_layer64(st);
    for (u32 r = 0u; r < 4u; r++) {
        for (u32 i = 0u; i < 12u; i++) {
            st[i] = gf64_add(st[i], RC_INITIAL[r][i]);
        }
        for (u32 i = 0u; i < 12u; i++) {
            st[i] = gf64_sbox(st[i]);
        }
        ext_layer64(st);
    }
    for (u32 r = 0u; r < 22u; r++) {
        st[0] = gf64_sbox(gf64_add(st[0], RC_INTERNAL[r]));
        int_layer64(st);
    }
    for (u32 r = 0u; r < 4u; r++) {
        for (u32 i = 0u; i < 12u; i++) {
            st[i] = gf64_add(st[i], RC_TERMINAL[r][i]);
        }
        for (u32 i = 0u; i < 12u; i++) {
            st[i] = gf64_sbox(st[i]);
        }
        ext_layer64(st);
    }
}

__device__ __forceinline__ u32 bswap32(u32 v) {
    return __byte_perm(v, 0u, 0x0123u);
}

extern "C" __global__ void qpow_mine(
    u32* results,
    const u32* midstate,
    const u32* start_nonce,
    const u32* difficulty_target,
    const u32* dispatch_config)
{
    if (atomicOr(&results[0], 0u) != 0u) {
        return;
    }
    u32 thread_id = blockIdx.x * blockDim.x + threadIdx.x;
    u32 total_threads = dispatch_config[0];
    u32 nonces_per_thread = dispatch_config[1];
    u32 total_nonces = dispatch_config[2];
    if (thread_id >= total_threads) {
        return;
    }
    u32 base_index = thread_id * nonces_per_thread;

    // Hoist uniform reads out of the nonce loop
    u64 mid[12];
    for (u32 i = 0u; i < 12u; i++) {
        mid[i] = ((u64)midstate[2u * i + 1u] << 32) | (u64)midstate[2u * i];
    }
    u32 tgt[16];
    for (u32 i = 0u; i < 16u; i++) {
        tgt[i] = difficulty_target[i];
    }
    u32 nonce_base[16];
    for (u32 i = 0u; i < 16u; i++) {
        nonce_base[i] = start_nonce[i];
    }

    for (u32 j = 0u; j < nonces_per_thread; j = j + 1u) {
        u32 logical_index = base_index + j;
        if (logical_index >= total_nonces) {
            break;
        }
        if (j > 0u && atomicOr(&results[0], 0u) != 0u) {
            return;
        }

        // The host guarantees a batch never carries into the high nonce half
        // (limbs 8..15), so only the low 256 bits are incremented here.
        u32 current_nonce[16];
        u32 val0 = nonce_base[0];
        u32 sum0 = val0 + logical_index;
        current_nonce[0] = sum0;
        u32 carry = sum0 < val0 ? 1u : 0u;
        #pragma unroll
        for (u32 i = 1u; i < 8u; i++) {
            u32 val = nonce_base[i];
            u32 sum = val + carry;
            current_nonce[i] = sum;
            carry = sum < val ? 1u : 0u;
        }
        #pragma unroll
        for (u32 i = 8u; i < 16u; i++) {
            current_nonce[i] = nonce_base[i];
        }

        // Resume the sponge from the precomputed midstate: absorb the low
        // nonce half, pad, squeeze twice (3 permutations instead of 5).
        u64 st[12];
        #pragma unroll
        for (u32 i = 0u; i < 12u; i++) {
            st[i] = mid[i];
        }
        #pragma unroll
        for (u32 i = 0u; i < 8u; i++) {
            st[i] = gf64_add(st[i], (u64)bswap32(current_nonce[7u - i]));
        }
        permute64(st);
        st[0] = gf64_add(st[0], 1ULL);
        st[1] = gf64_add(st[1], 1ULL);
        permute64(st);

        // First squeeze yields the most significant 256 bits of the hash, which
        // decide hash-vs-target on their own unless they exactly equal the
        // target's high half. Only candidates pay for the second squeeze, and
        // byte-swapped hash words are produced on demand during the compare.
        u32 first[8];
        #pragma unroll
        for (u32 i = 0u; i < 4u; i++) {
            u64 c = gf64_canon(st[i]);
            first[2u * i] = (u32)(c & EPS64);
            first[2u * i + 1u] = (u32)(c >> 32);
        }
        u32 cmp = 0u;
        for (u32 i = 0u; i < 8u; i++) {
            u32 h = bswap32(first[i]);
            u32 t = tgt[15u - i];
            if (h != t) {
                cmp = h > t ? 1u : 2u;
                break;
            }
        }
        if (cmp == 1u) {
            continue;
        }

        u32 hash_le[16];
        #pragma unroll
        for (u32 i = 0u; i < 8u; i++) {
            hash_le[15u - i] = bswap32(first[i]);
        }
        permute64(st);
        #pragma unroll
        for (u32 i = 0u; i < 4u; i++) {
            u64 c = gf64_canon(st[i]);
            hash_le[7u - 2u * i] = bswap32((u32)(c & EPS64));
            hash_le[6u - 2u * i] = bswap32((u32)(c >> 32));
        }
        bool below = cmp == 2u;
        if (!below) {
            for (u32 i = 0u; i < 8u; i++) {
                u32 h = hash_le[7u - i];
                u32 t = tgt[7u - i];
                if (h != t) {
                    below = h < t;
                    break;
                }
            }
        }

        if (below) {
            if (atomicExch(&results[0], 1u) == 0u) {
                for (u32 i = 0u; i < 16u; i++) {
                    atomicExch(&results[1u + i], current_nonce[i]);
                    atomicExch(&results[17u + i], hash_le[i]);
                }
            }
            return;
        }
    }
}
