// BeamHash III CUDA solver.
// Ported from the OpenCL kernel (csrc/opencl/beamhash_solver.cl), which was
// adapted from BeamMW/opencl-miner (tag opencl-miner_1.0.82).
//
// 7 kernels implement Wagner's algorithm for the BeamHash III PoW:
//   cleanUp, beamHashIII_seed, beamHashIII_R1 .. R5
//
// All kernels use the same argument signature so they can be launched
// through a single generic dispatch in the Rust host code.
//
// Key differences from the OpenCL version:
//   - ulong8 is a custom struct (CUDA has no native 512-bit vector type)
//   - __kernel → extern "C" __global__
//   - __local → __shared__
//   - atomic_inc → atomicAdd(&x, 1u)
//   - atomic_xchg → atomicExch
//   - mad24(a,b,c) → a*b+c
//   - barrier(CLK_LOCAL_MEM_FENCE) → __syncthreads()
//   - get_global_id(0) → blockIdx.x * blockDim.x + threadIdx.x
//   - rotate(x,n) → __funnelshift or manual (x<<n)|(x>>(64-n))

// NVRTC on Windows lacks default include paths — avoid #include <cstdint>.
// Use built-in CUDA types (unsigned long long, unsigned int, etc.).

// ── ulong8: 512-bit vector type ──────────────────────────────────────────

struct ulong8 {
    unsigned long long s0, s1, s2, s3, s4, s5, s6, s7;
};

// ── Constants ────────────────────────────────────────────────────────────

#define BUCKET_SIZE 8720
#define WG_SIZE 256

// ── Helper functions ─────────────────────────────────────────────────────

__device__ __forceinline__ unsigned long long rotl64(unsigned long long x, unsigned int b) {
    return (x << b) | (x >> (64 - b));
}

#define SIPROUND \
    v0 += v1; v2 += v3; \
    v1 = rotl64(v1, 13); \
    v3 = rotl64(v3, 16); \
    v1 ^= v0; v3 ^= v2; \
    v0 = (v0 >> 32) | (v0 << 32); \
    v2 += v1; v0 += v3; \
    v1 = rotl64(v1, 17); \
    v3 = rotl64(v3, 21); \
    v1 ^= v2; v3 ^= v0; \
    v2 = (v2 >> 32) | (v2 << 32);

__device__ __forceinline__ unsigned long long sipHash24(
    unsigned long long pp0, unsigned long long pp1,
    unsigned long long pp2, unsigned long long pp3,
    unsigned long long nonce)
{
    unsigned long long v0 = pp0, v1 = pp1, v2 = pp2, v3 = pp3 ^ nonce;
    SIPROUND; SIPROUND;
    v0 ^= nonce;
    v2 ^= 0xff;
    SIPROUND; SIPROUND; SIPROUND; SIPROUND;
    return (v0 ^ v1 ^ v2 ^ v3);
}

__device__ __forceinline__ unsigned long long mixer(const ulong8 &input) {
    unsigned long long result;
    result = rotl64(input.s0, 29);
    result += rotl64(input.s1, 58);
    result += rotl64(input.s2, 23);
    result += rotl64(input.s3, 52);
    result += rotl64(input.s4, 17);
    result += rotl64(input.s5, 46);
    result += rotl64(input.s6, 11);
    result += rotl64(input.s7, 40);
    return rotl64(result, 24);
}

// Shift 512-bit vector left by 24 bits
__device__ __forceinline__ ulong8 shift24(ulong8 input) {
    ulong8 r;
    r.s0 = (input.s0 >> 24) | (input.s1 << 40);
    r.s1 = (input.s1 >> 24) | (input.s2 << 40);
    r.s2 = (input.s2 >> 24) | (input.s3 << 40);
    r.s3 = (input.s3 >> 24) | (input.s4 << 40);
    r.s4 = (input.s4 >> 24) | (input.s5 << 40);
    r.s5 = (input.s5 >> 24) | (input.s6 << 40);
    r.s6 = (input.s6 >> 24) | (input.s7 << 40);
    r.s7 = (input.s7 >> 24);
    return r;
}

// Shift 512-bit vector right by 56 bits
__device__ __forceinline__ ulong8 shift56(ulong8 input) {
    ulong8 r;
    r.s0 = (input.s0 >> 56) | (input.s1 << 8);
    r.s1 = (input.s1 >> 56) | (input.s2 << 8);
    r.s2 = (input.s2 >> 56) | (input.s3 << 8);
    r.s3 = (input.s3 >> 56) | (input.s4 << 8);
    r.s4 = (input.s4 >> 56) | (input.s5 << 8);
    r.s5 = (input.s5 >> 56) | (input.s6 << 8);
    r.s6 = (input.s6 >> 56) | (input.s7 << 8);
    r.s7 = (input.s7 >> 56);
    return r;
}

// ── Kernel: cleanUp — clear all counters ─────────────────────────────────

extern "C" __global__ __launch_bounds__(WG_SIZE) void cleanUp(
    unsigned long long *buffer0,
    unsigned long long *buffer1,
    unsigned int *counters,
    unsigned int *results,
    unsigned long long pp0, unsigned long long pp1,
    unsigned long long pp2, unsigned long long pp3)
{
    unsigned int gId = blockIdx.x * blockDim.x + threadIdx.x;
    if (gId < 20480) {
        counters[gId] = 0;
    }
    if (gId == 0) {
        results[0] = 0;
    }
}

// ── Kernel: beamHashIII_seed — round 0 ───────────────────────────────────

extern "C" __global__ __launch_bounds__(WG_SIZE) void beamHashIII_seed(
    unsigned long long *buffer0,
    unsigned long long *buffer1,
    unsigned int *counters,
    unsigned int *results,
    unsigned long long pp0, unsigned long long pp1,
    unsigned long long pp2, unsigned long long pp3)
{
    unsigned int gId = blockIdx.x * blockDim.x + threadIdx.x;

    ulong8 elem;
    elem.s0 = sipHash24(pp0, pp1, pp2, pp3, (unsigned long long)(gId << 3) + 0);
    elem.s1 = sipHash24(pp0, pp1, pp2, pp3, (unsigned long long)(gId << 3) + 1);
    elem.s2 = sipHash24(pp0, pp1, pp2, pp3, (unsigned long long)(gId << 3) + 2);
    elem.s3 = sipHash24(pp0, pp1, pp2, pp3, (unsigned long long)(gId << 3) + 3);
    elem.s4 = sipHash24(pp0, pp1, pp2, pp3, (unsigned long long)(gId << 3) + 4);
    elem.s5 = sipHash24(pp0, pp1, pp2, pp3, (unsigned long long)(gId << 3) + 5);
    elem.s6 = sipHash24(pp0, pp1, pp2, pp3, (unsigned long long)(gId << 3) + 6);
    elem.s7 = (unsigned long long)gId;

    // Mixing for round 1
    elem.s0 = mixer(elem);

    unsigned int bucket = (unsigned int)elem.s0 & 0xFFF;
    unsigned int pos = atomicAdd(&counters[bucket], 1u);
    pos = min(pos, (unsigned int)(BUCKET_SIZE - 1));
    pos += bucket * BUCKET_SIZE;

    // Store ulong8 as 8 consecutive u64
    unsigned long long *dst = buffer0 + pos * 8;
    dst[0] = elem.s0; dst[1] = elem.s1; dst[2] = elem.s2; dst[3] = elem.s3;
    dst[4] = elem.s4; dst[5] = elem.s5; dst[6] = elem.s6; dst[7] = elem.s7;
}

// ── Helper: load ulong8 from global memory ───────────────────────────────

__device__ __forceinline__ ulong8 load_ulong8(const unsigned long long *ptr) {
    ulong8 r;
    r.s0 = ptr[0]; r.s1 = ptr[1]; r.s2 = ptr[2]; r.s3 = ptr[3];
    r.s4 = ptr[4]; r.s5 = ptr[5]; r.s6 = ptr[6]; r.s7 = ptr[7];
    return r;
}

__device__ __forceinline__ void store_ulong8(unsigned long long *ptr, const ulong8 &v) {
    ptr[0] = v.s0; ptr[1] = v.s1; ptr[2] = v.s2; ptr[3] = v.s3;
    ptr[4] = v.s4; ptr[5] = v.s5; ptr[6] = v.s6; ptr[7] = v.s7;
}

// ── Kernel: beamHashIII_R1 — round 1 ─────────────────────────────────────

extern "C" __global__ __launch_bounds__(WG_SIZE) void beamHashIII_R1(
    unsigned long long *buffer0,
    unsigned long long *buffer1,
    unsigned int *counters,
    unsigned int *results,
    unsigned long long pp0, unsigned long long pp1,
    unsigned long long pp2, unsigned long long pp3)
{
    unsigned int bucket = blockIdx.x;
    unsigned int locSize = blockDim.x;
    unsigned int lId = threadIdx.x;

    unsigned int mask = bucket & 0x3;
    bucket >>= 2;

    unsigned int inputOfs = 0;
    unsigned int outputOfs = 4096;

    unsigned int inLim = counters[inputOfs + bucket];

    __shared__ unsigned int match[1024];
    __shared__ unsigned int table[2560];
    __shared__ unsigned int inCounter[1];

    for (unsigned int i = lId; i < 1024; i += locSize) {
        match[i] = 0xFFF;
    }
    inCounter[0] = 0;

    __syncthreads();

    for (unsigned int i = lId; i < inLim; i += locSize) {
        ulong8 input = load_ulong8(buffer0 + (BUCKET_SIZE * bucket + i) * 8);

        if (((input.s0 >> 12) & 0x3) == mask) {
            unsigned int inPos = atomicAdd(&inCounter[0], 1u);
            inPos = min(inPos, (unsigned int)2560);

            unsigned int slot = (input.s0 >> 14) & 0x3FF;
            unsigned int ret = atomicExch(&match[slot], inPos);
            table[inPos] = ret | (i << 16);
        }
    }

    __syncthreads();

    for (unsigned int i = lId; i < inCounter[0]; i += locSize) {
        unsigned int elemPos0 = table[i] >> 16;
        unsigned int nextElem = table[i] & 0xFFF;

        while (nextElem != 0xFFF) {
            unsigned int elemPos1 = table[nextElem] >> 16;
            nextElem = table[nextElem] & 0xFFF;

            ulong8 stepRow0 = load_ulong8(buffer0 + (BUCKET_SIZE * bucket + elemPos0) * 8);
            ulong8 stepRow1 = load_ulong8(buffer0 + (BUCKET_SIZE * bucket + elemPos1) * 8);

            // XOR work bits
            stepRow0.s0 ^= stepRow1.s0;
            stepRow0.s1 ^= stepRow1.s1;
            stepRow0.s2 ^= stepRow1.s2;
            stepRow0.s3 ^= stepRow1.s3;
            stepRow0.s4 ^= stepRow1.s4;
            stepRow0.s5 ^= stepRow1.s5;
            stepRow0.s6 ^= stepRow1.s6;

            // Sort & serialize index tree
            unsigned long long idx0 = stepRow0.s7;
            unsigned long long idx1 = stepRow1.s7;
            if (idx1 < idx0) {
                unsigned long long tmp = idx0; idx0 = idx1; idx1 = tmp;
            }
            stepRow0.s7 = idx0 | (idx1 << 25);

            // Shift away matched bits
            stepRow0 = shift24(stepRow0);

            // Mix for round 2
            stepRow0.s0 = mixer(stepRow0);

            // Bucket sort for round 2
            unsigned int b = (unsigned int)stepRow0.s0 & 0xFFF;
            unsigned int pos = atomicAdd(&counters[outputOfs + b], 1u);
            pos = min(pos, (unsigned int)(BUCKET_SIZE - 1));
            pos += b * BUCKET_SIZE;

            store_ulong8(buffer1 + pos * 8, stepRow0);
        }
    }
}

// ── Kernel: beamHashIII_R2 — round 2 ─────────────────────────────────────

extern "C" __global__ __launch_bounds__(WG_SIZE) void beamHashIII_R2(
    unsigned long long *buffer0,
    unsigned long long *buffer1,
    unsigned int *counters,
    unsigned int *results,
    unsigned long long pp0, unsigned long long pp1,
    unsigned long long pp2, unsigned long long pp3)
{
    unsigned int bucket = blockIdx.x;
    unsigned int locSize = blockDim.x;
    unsigned int lId = threadIdx.x;

    unsigned int mask = bucket & 0x3;
    bucket >>= 2;

    unsigned int inputOfs = 4096;
    unsigned int outputOfs = 8192;

    unsigned int inLim = counters[inputOfs + bucket];

    __shared__ unsigned int match[1024];
    __shared__ unsigned int table[2560];
    __shared__ unsigned int inCounter[1];

    for (unsigned int i = lId; i < 1024; i += locSize) {
        match[i] = 0xFFF;
    }
    inCounter[0] = 0;

    __syncthreads();

    for (unsigned int i = lId; i < inLim; i += locSize) {
        ulong8 input = load_ulong8(buffer1 + (BUCKET_SIZE * bucket + i) * 8);

        if (((input.s0 >> 12) & 0x3) == mask) {
            unsigned int inPos = atomicAdd(&inCounter[0], 1u);
            inPos = min(inPos, (unsigned int)2560);

            unsigned int slot = (input.s0 >> 14) & 0x3FF;
            unsigned int ret = atomicExch(&match[slot], inPos);
            table[inPos] = ret | (i << 16);
        }
    }

    __syncthreads();

    for (unsigned int i = lId; i < inCounter[0]; i += locSize) {
        unsigned int elemPos0 = table[i] >> 16;
        unsigned int nextElem = table[i] & 0xFFF;

        while (nextElem != 0xFFF) {
            unsigned int elemPos1 = table[nextElem] >> 16;
            nextElem = table[nextElem] & 0xFFF;

            ulong8 stepRow0 = load_ulong8(buffer1 + (BUCKET_SIZE * bucket + elemPos0) * 8);
            ulong8 stepRow1 = load_ulong8(buffer1 + (BUCKET_SIZE * bucket + elemPos1) * 8);

            // XOR work bits 0 to 424
            stepRow0.s0 ^= stepRow1.s0;
            stepRow0.s1 ^= stepRow1.s1;
            stepRow0.s2 ^= stepRow1.s2;
            stepRow0.s3 ^= stepRow1.s3;
            stepRow0.s4 ^= stepRow1.s4;
            stepRow0.s5 ^= stepRow1.s5;
            stepRow0.s6 ^= (stepRow1.s6 & 0xFFFFFFFFFFULL);

            // Sort index tree
            unsigned long long it0 = (stepRow0.s7 << 24) | (stepRow0.s6 >> 40);
            unsigned long long it1 = (stepRow1.s7 << 24) | (stepRow1.s6 >> 40);
            if ((it1 & 0x1FFFFFF) < (it0 & 0x1FFFFFF)) {
                unsigned long long tmp = it0; it0 = it1; it1 = tmp;
            }

            // Shift away matched bits
            stepRow0.s6 &= 0xFFFFFFFFFFULL;
            stepRow0.s7 = 0;
            stepRow0 = shift24(stepRow0);

            // Serialize index tree
            stepRow0.s6 |= (it0 << 16);
            stepRow0.s7 = (it0 >> 48) | (it1 << 2);

            // Mix for round 3
            stepRow0.s0 = mixer(stepRow0);

            // Bucket sort for round 3
            unsigned int b = (unsigned int)stepRow0.s0 & 0xFFF;
            unsigned int pos = atomicAdd(&counters[outputOfs + b], 1u);
            pos = min(pos, (unsigned int)(BUCKET_SIZE - 1));
            pos += b * BUCKET_SIZE;

            store_ulong8(buffer0 + pos * 8, stepRow0);
        }
    }
}

// ── Kernel: beamHashIII_R3 — round 3 ─────────────────────────────────────

extern "C" __global__ __launch_bounds__(WG_SIZE) void beamHashIII_R3(
    unsigned long long *buffer0,
    unsigned long long *buffer1,
    unsigned int *counters,
    unsigned int *results,
    unsigned long long pp0, unsigned long long pp1,
    unsigned long long pp2, unsigned long long pp3)
{
    unsigned int bucket = blockIdx.x;
    unsigned int locSize = blockDim.x;
    unsigned int lId = threadIdx.x;

    unsigned int mask = bucket & 0x3;
    bucket >>= 2;

    unsigned int inputOfs = 8192;
    unsigned int outputOfs = 12288;

    unsigned int inLim = counters[inputOfs + bucket];

    __shared__ unsigned int match[1024];
    __shared__ unsigned int table[2560];
    __shared__ unsigned int inCounter[1];

    for (unsigned int i = lId; i < 1024; i += locSize) {
        match[i] = 0xFFF;
    }
    inCounter[0] = 0;

    __syncthreads();

    for (unsigned int i = lId; i < inLim; i += locSize) {
        ulong8 input = load_ulong8(buffer0 + (BUCKET_SIZE * bucket + i) * 8);

        if (((input.s0 >> 12) & 0x3) == mask) {
            unsigned int inPos = atomicAdd(&inCounter[0], 1u);
            inPos = min(inPos, (unsigned int)2560);

            unsigned int slot = (input.s0 >> 14) & 0x3FF;
            unsigned int ret = atomicExch(&match[slot], inPos);
            table[inPos] = ret | (i << 16);
        }
    }

    __syncthreads();

    for (unsigned int i = lId; i < inCounter[0]; i += locSize) {
        unsigned int elemPos0 = table[i] >> 16;
        unsigned int nextElem = table[i] & 0xFFF;

        while (nextElem != 0xFFF) {
            unsigned int elemPos1 = table[nextElem] >> 16;
            nextElem = table[nextElem] & 0xFFF;

            ulong8 stepRow0 = load_ulong8(buffer0 + (BUCKET_SIZE * bucket + elemPos0) * 8);
            ulong8 stepRow1 = load_ulong8(buffer0 + (BUCKET_SIZE * bucket + elemPos1) * 8);

            // XOR work bits 0 to 400
            stepRow0.s0 ^= stepRow1.s0;
            stepRow0.s1 ^= stepRow1.s1;
            stepRow0.s2 ^= stepRow1.s2;
            stepRow0.s3 ^= stepRow1.s3;
            stepRow0.s4 ^= stepRow1.s4;
            stepRow0.s5 ^= stepRow1.s5;
            stepRow0.s6 ^= (stepRow1.s6 & 0xFFFFULL);

            // Sort index tree (4 entries)
            unsigned long long it0 = stepRow0.s6;
            unsigned long long it1 = stepRow0.s7;
            unsigned long long it2 = stepRow1.s6;
            unsigned long long it3 = stepRow1.s7;

            if (((it0 >> 16) & 0x1FFFFFF) >= ((it2 >> 16) & 0x1FFFFFF)) {
                // Swap pairs: (it0,it1) <-> (it2,it3)
                unsigned long long t0 = it0, t1 = it1;
                it0 = it2; it1 = it3; it2 = t0; it3 = t1;
            }
            it0 >>= 16;
            it2 >>= 16;

            // Shift away matched bits
            stepRow0.s6 &= 0xFFFFULL;
            stepRow0.s7 = 0;
            stepRow0 = shift24(stepRow0);

            // Serialize index tree (low part)
            stepRow0.s5 |= (it0 << 56);
            stepRow0.s6 = (it0 >> 8);
            stepRow0.s6 |= (it1 << 40);
            stepRow0.s7 = (it1 >> 24) | (it2 << 28);

            // Mix for round 4
            stepRow0.s0 = mixer(stepRow0);

            // Drop 64 bits after mix
            stepRow0.s4 &= 0x00FFFFFFFFFFFFFFULL;
            stepRow0.s4 |= (stepRow0.s5 & 0xFF00000000000000ULL);
            stepRow0.s5 = stepRow0.s6;
            stepRow0.s6 = stepRow0.s7;

            // Add missing index tree bits (high half)
            stepRow0.s7 = (it2 >> 36);
            stepRow0.s7 |= (it3 << 12);

            // Bucket sort for round 4
            unsigned int b = (unsigned int)stepRow0.s0 & 0xFFF;
            unsigned int pos = atomicAdd(&counters[outputOfs + b], 1u);
            pos = min(pos, (unsigned int)(BUCKET_SIZE - 1));
            pos += b * BUCKET_SIZE;

            store_ulong8(buffer1 + pos * 8, stepRow0);
        }
    }
}

// ── Kernel: beamHashIII_R4 — round 4 ─────────────────────────────────────

extern "C" __global__ __launch_bounds__(WG_SIZE) void beamHashIII_R4(
    unsigned long long *buffer0,
    unsigned long long *buffer1,
    unsigned int *counters,
    unsigned int *results,
    unsigned long long pp0, unsigned long long pp1,
    unsigned long long pp2, unsigned long long pp3)
{
    unsigned int bucket = blockIdx.x;
    unsigned int locSize = blockDim.x;
    unsigned int lId = threadIdx.x;

    unsigned int mask = bucket & 0x3;
    bucket >>= 2;

    unsigned int inputOfs = 12288;
    unsigned int outputOfs = 16384;

    unsigned int inLim = counters[inputOfs + bucket];

    __shared__ unsigned int match[1024];
    __shared__ unsigned int table[2560];
    __shared__ unsigned int inCounter[1];

    for (unsigned int i = lId; i < 1024; i += locSize) {
        match[i] = 0xFFF;
    }
    inCounter[0] = 0;

    __syncthreads();

    for (unsigned int i = lId; i < inLim; i += locSize) {
        ulong8 input = load_ulong8(buffer1 + (BUCKET_SIZE * bucket + i) * 8);

        if (((input.s0 >> 12) & 0x3) == mask) {
            unsigned int inPos = atomicAdd(&inCounter[0], 1u);
            inPos = min(inPos, (unsigned int)2560);

            unsigned int slot = (input.s0 >> 14) & 0x3FF;
            unsigned int ret = atomicExch(&match[slot], inPos);
            table[inPos] = ret | (i << 16);
        }
    }

    __syncthreads();

    for (unsigned int i = lId; i < inCounter[0]; i += locSize) {
        unsigned int elemPos0 = table[i] >> 16;
        unsigned int nextElem = table[i] & 0xFFF;

        while (nextElem != 0xFFF) {
            unsigned int elemPos1 = table[nextElem] >> 16;
            nextElem = table[nextElem] & 0xFFF;

            ulong8 stepRow0 = load_ulong8(buffer1 + (BUCKET_SIZE * bucket + elemPos0) * 8);
            ulong8 stepRow1 = load_ulong8(buffer1 + (BUCKET_SIZE * bucket + elemPos1) * 8);

            // XOR work bits 0 to 312
            stepRow0.s0 ^= stepRow1.s0;
            stepRow0.s1 ^= stepRow1.s1;
            stepRow0.s2 ^= stepRow1.s2;
            stepRow0.s3 ^= stepRow1.s3;
            stepRow0.s4 ^= (stepRow1.s4 & 0xFFFFFFFFFFFFFFULL);

            // Build index tree from high halves
            // OpenCL: indexTree.lo = stepRow0.hi (s4-s7), indexTree.hi = stepRow1.hi
            // it0 = (s4>>56)|(s5<<8), it1 = s5>>8|(s6<<56)|...  — complex chain
            // We need 5 indices serialized into the index tree.
            // The OpenCL code does:
            //   indexTree.s0 = (indexTree.s0 >> 56) | (indexTree.s1 << 8)
            //   indexTree.s4 = (indexTree.s4 >> 56) | (indexTree.s5 << 8)
            //   swap if (it0 & 0x1FFFFFF) >= (it4 & 0x1FFFFFF)
            // Then stores the full 8-element indexTree into stepRow0.

            unsigned long long it0, it1, it2, it3, it4, it5, it6, it7;
            // lo = stepRow0.hi = {s4, s5, s6, s7}
            it0 = stepRow0.s4; it1 = stepRow0.s5; it2 = stepRow0.s6; it3 = stepRow0.s7;
            // hi = stepRow1.hi = {s4, s5, s6, s7}
            it4 = stepRow1.s4; it5 = stepRow1.s5; it6 = stepRow1.s6; it7 = stepRow1.s7;

            // Shift: it0 = (it0 >> 56) | (it1 << 8), it4 = (it4 >> 56) | (it5 << 8)
            it0 = (it0 >> 56) | (it1 << 8);
            it4 = (it4 >> 56) | (it5 << 8);

            // Swap if needed (compare first 25 bits)
            if ((it0 & 0x1FFFFFF) >= (it4 & 0x1FFFFFF)) {
                unsigned long long t0 = it0, t1 = it1, t2 = it2, t3 = it3;
                it0 = it4; it1 = it5; it2 = it6; it3 = it7;
                it4 = t0; it5 = t1; it6 = t2; it7 = t3;
            }

            // Shift away matched bits
            stepRow0.s4 &= 0xFFFFFFFFFFFFFFULL;
            stepRow0.s5 = 0;
            stepRow0.s6 = 0;
            stepRow0.s7 = 0;
            stepRow0 = shift24(stepRow0);

            // Serialize index tree (truncated to 512 bit)
            stepRow0.s4 |= (it0 << 32);
            stepRow0.s5 = (it1 >> 24);
            stepRow0.s5 |= (it2 << 40);
            stepRow0.s6 = (it2 >> 24);
            stepRow0.s6 |= (it3 << 40);
            stepRow0.s7 = (it3 >> 24);
            stepRow0.s7 |= (it4 << 40);

            // Mix for round 5
            stepRow0.s0 = mixer(stepRow0);

            // Drop all bits except needed matchbits (48) and store index tree
            it0 = (it0 << 56);
            it0 |= (stepRow0.s0 & 0xFFFFFFFFFFFFULL);

            // Serialize high bits properly
            it5 = (it5 >> 56) | (it6 << 8);
            it6 = (it6 >> 56) | (it7 << 8);
            it7 = (it7 >> 56) | (it7 << 8);  // Note: OpenCL has (it7 >> 56) | (it7 << 8)

            // Build final ulong8 from index tree
            ulong8 finalRow;
            finalRow.s0 = it0; finalRow.s1 = it1; finalRow.s2 = it2; finalRow.s3 = it3;
            finalRow.s4 = it4; finalRow.s5 = it5; finalRow.s6 = it6; finalRow.s7 = it7;
            stepRow0 = finalRow;

            // Bucket sort for round 5
            unsigned int b = (unsigned int)stepRow0.s0 & 0xFFF;
            unsigned int pos = atomicAdd(&counters[outputOfs + b], 1u);
            pos = min(pos, (unsigned int)(BUCKET_SIZE - 1));
            pos += b * BUCKET_SIZE;

            store_ulong8(buffer0 + pos * 8, stepRow0);
        }
    }
}

// ── Kernel: beamHashIII_R5 — round 5 (final) ─────────────────────────────

extern "C" __global__ __launch_bounds__(WG_SIZE) void beamHashIII_R5(
    unsigned long long *buffer0,
    unsigned long long *buffer1,
    unsigned int *counters,
    unsigned int *results,
    unsigned long long pp0, unsigned long long pp1,
    unsigned long long pp2, unsigned long long pp3)
{
    unsigned int bucket = blockIdx.x;
    unsigned int locSize = blockDim.x;
    unsigned int lId = threadIdx.x;

    unsigned int mask = bucket & 0x3;
    bucket >>= 2;

    unsigned int inputOfs = 16384;
    unsigned int inLim = counters[inputOfs + bucket];

    __shared__ unsigned int match[1024];
    __shared__ unsigned int table[2560];
    __shared__ unsigned int inCounter[1];

    for (unsigned int i = lId; i < 1024; i += locSize) {
        match[i] = 0xFFF;
    }
    inCounter[0] = 0;

    __syncthreads();

    for (unsigned int i = lId; i < inLim; i += locSize) {
        ulong8 input = load_ulong8(buffer0 + (BUCKET_SIZE * bucket + i) * 8);

        if (((input.s0 >> 12) & 0x3) == mask) {
            unsigned int inPos = atomicAdd(&inCounter[0], 1u);
            inPos = min(inPos, (unsigned int)2560);

            unsigned int slot = (input.s0 >> 14) & 0x3FF;
            unsigned int ret = atomicExch(&match[slot], inPos);
            table[inPos] = ret | (i << 16);
        }
    }

    __syncthreads();

    // results buffer: results[0] = count, then each solution is 16 u64 (8 per row)
    unsigned long long *resultsUL = (unsigned long long *)results;

    for (unsigned int i = lId; i < inCounter[0]; i += locSize) {
        unsigned int elemPos0 = table[i] >> 16;
        unsigned int nextElem = table[i] & 0xFFF;

        while (nextElem != 0xFFF) {
            unsigned int elemPos1 = table[nextElem] >> 16;
            nextElem = table[nextElem] & 0xFFF;

            ulong8 stepRow0 = load_ulong8(buffer0 + (BUCKET_SIZE * bucket + elemPos0) * 8);
            ulong8 stepRow1 = load_ulong8(buffer0 + (BUCKET_SIZE * bucket + elemPos1) * 8);

            // Check if bits match in full length
            if ((stepRow0.s0 & 0xFFFFFFFFFFFFULL) == (stepRow1.s0 & 0xFFFFFFFFFFFFULL)) {
                // Solution found!
                unsigned int pos = atomicAdd(&results[0], 1u);

                stepRow0 = shift56(stepRow0);
                stepRow1 = shift56(stepRow1);

                bool smaller = (stepRow1.s0 & 0x1FFFFFF) < (stepRow0.s0 & 0x1FFFFFF);
                if (smaller) {
                    // Swap stepRow0 and stepRow1
                    ulong8 tmp = stepRow0; stepRow0 = stepRow1; stepRow1 = tmp;
                }

                // Store solution: 16 u64 = 128 bytes per solution.
                // OpenCL: resultsUL = (ulong2*)results, resultsUL[1+8*pos+k] = {sk*2, sk*2+1}
                // In CUDA we use u64* directly, so base_u64 = (1 + 8*pos) * 2
                // results[0] (u32) = count, results[1..3] = padding,
                // results[4..] = solutions (32 u32 = 128 bytes each)
                unsigned int base_u64 = (1 + 8 * pos) * 2;
                resultsUL[base_u64 + 0] = stepRow0.s0;
                resultsUL[base_u64 + 1] = stepRow0.s1;
                resultsUL[base_u64 + 2] = stepRow0.s2;
                resultsUL[base_u64 + 3] = stepRow0.s3;
                resultsUL[base_u64 + 4] = stepRow0.s4;
                resultsUL[base_u64 + 5] = stepRow0.s5;
                resultsUL[base_u64 + 6] = stepRow0.s6;
                resultsUL[base_u64 + 7] = stepRow0.s7;
                resultsUL[base_u64 + 8]  = stepRow1.s0;
                resultsUL[base_u64 + 9]  = stepRow1.s1;
                resultsUL[base_u64 + 10] = stepRow1.s2;
                resultsUL[base_u64 + 11] = stepRow1.s3;
                resultsUL[base_u64 + 12] = stepRow1.s4;
                resultsUL[base_u64 + 13] = stepRow1.s5;
                resultsUL[base_u64 + 14] = stepRow1.s6;
                resultsUL[base_u64 + 15] = stepRow1.s7;
            }
        }
    }
}
