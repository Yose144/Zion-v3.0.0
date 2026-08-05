// NexaPow OpenCL kernel for Nexa (NEXA) mining.
//
// NexaPow algorithm (from https://spec.nexa.org/mining/NexaPOW/):
// 1. miningHash = double_sha256(candidateHash || nonce)
// 2. h1 = sha256(miningHash)
// 3. Use miningHash as secp256k1 private key (fail if >= curve order or zero)
// 4. Sign h1 with Schnorr (BIP-340) using miningHash as private key → sig (64 bytes)
// 5. powhash = sha256(sig)
// 6. If powhash <= target, solution found
//
// secp256k1 operations from UltrafastSecp256k1 (MIT License, Copyright (c) 2026 Vano Chkheidze)
// https://github.com/shrec/UltrafastSecp256k1
//
// References:
// - NexaPOW spec: https://spec.nexa.org/mining/NexaPOW/
// - BIP-340 Schnorr signatures: https://github.com/bitcoin/bips/blob/master/bip-0340.mediawiki
// - secp256k1 curve: SEC 2 Ver 2.0, Section 4.1


// =============================================================================
// CONCATENATED: secp256k1_field.cl
// =============================================================================
// =============================================================================
// UltrafastSecp256k1 OpenCL Kernels - Field Arithmetic
// =============================================================================
// secp256k1 field: F_p where p = 2^256 - 2^32 - 977
// Little-endian 256-bit integers using 4x64-bit limbs
// =============================================================================

// Field prime p = 2^256 - 0x1000003D1
// In 64-bit limbs (little-endian):
// p = {0xFFFFFFFEFFFFFC2F, 0xFFFFFFFFFFFFFFFF, 0xFFFFFFFFFFFFFFFF, 0xFFFFFFFFFFFFFFFF}

// Constants
#define SECP256K1_P0 0xFFFFFFFEFFFFFC2FUL
#define SECP256K1_P1 0xFFFFFFFFFFFFFFFFUL
#define SECP256K1_P2 0xFFFFFFFFFFFFFFFFUL
#define SECP256K1_P3 0xFFFFFFFFFFFFFFFFUL

// K = 2^32 + 977 = 0x1000003D1 (for fast reduction)
#define SECP256K1_K 0x1000003D1UL

// =============================================================================
// Forced Inlining
// =============================================================================
// NVIDIA's OpenCL compiler (nvoc) treats 'inline' as advisory.
// __attribute__((always_inline)) forces inlining of the entire field arithmetic
// call chain (field_mul → comba → reduce), matching CUDA's __forceinline__.
#ifdef __NV_CL_C_VERSION
  #define FORCE_INLINE __attribute__((always_inline)) inline
  #define FORCE_INLINE_STATIC __attribute__((always_inline)) static inline
#else
  #define FORCE_INLINE inline
  #define FORCE_INLINE_STATIC static inline
#endif

// =============================================================================
// 64-bit Multiplication Helpers
// =============================================================================

// Multiply two 64-bit numbers, get 128-bit result as (hi, lo)
FORCE_INLINE ulong2 mul64_full(ulong a, ulong b) {
    // Use OpenCL's mul_hi for high part
    ulong lo = a * b;
    ulong hi = mul_hi(a, b);
    return (ulong2)(lo, hi);
}

// Add with carry: result = a + b + carry_in, returns new carry
FORCE_INLINE ulong add_with_carry(ulong a, ulong b, ulong carry_in, ulong* carry_out) {
    ulong sum = a + b;
    ulong c1 = (sum < a) ? 1UL : 0UL;
    sum += carry_in;
    ulong c2 = (sum < carry_in) ? 1UL : 0UL;
    *carry_out = c1 + c2;
    return sum;
}

// Subtract with borrow: result = a - b - borrow_in, returns new borrow
FORCE_INLINE ulong sub_with_borrow(ulong a, ulong b, ulong borrow_in, ulong* borrow_out) {
    ulong diff = a - b;
    ulong b1 = (a < b) ? 1UL : 0UL;
    ulong temp = diff;
    diff -= borrow_in;
    ulong b2 = (temp < borrow_in) ? 1UL : 0UL;
    *borrow_out = b1 + b2;
    return diff;
}

// =============================================================================
// Field Element Type (256-bit)
// =============================================================================

typedef struct {
    ulong limbs[4];  // Little-endian: limbs[0] is LSB
} FieldElement;

// =============================================================================
// NVIDIA OpenCL PTX Acceleration (Level 1+2+3)
// =============================================================================
// On consumer NVIDIA GPUs (Turing/Ampere/Ada/Blackwell), INT32 multiply
// throughput is 32x higher than INT64. Inline PTX enables:
//   Level 1+2: mad.lo.cc.u64/madc.hi.cc.u64 carry chains (no comparison-carry)
//   Level 3:   mad.lo.cc.u32/madc.hi.cc.u32 32-bit Comba (INT32 throughput)
// Fallback (AMD, Intel, portable): mul_hi + comparison-based carry unchanged.
// Guard: __NV_CL_C_VERSION is defined only by NVIDIA's OpenCL compiler.
// =============================================================================

#ifdef __NV_CL_C_VERSION

// 32-bit MAD accumulate: (r0:r1:r2) += a * b  [3-register 96-bit accumulator]
#define OCL_MAD32(r0, r1, r2, a, b) \
    __asm volatile( \
        "mad.lo.cc.u32 %0, %3, %4, %0; \n\t" \
        "madc.hi.cc.u32 %1, %3, %4, %1; \n\t" \
        "addc.u32 %2, %2, 0; \n\t" \
        : "+r"(r0), "+r"(r1), "+r"(r2) \
        : "r"(a), "r"(b) \
    )

// 32-bit squaring diagonal: (r0:r1:r2) += a*a
#define OCL_SQR32_D(r0, r1, r2, a) \
    __asm volatile( \
        "mad.lo.cc.u32 %0, %3, %3, %0; \n\t" \
        "madc.hi.cc.u32 %1, %3, %3, %1; \n\t" \
        "addc.u32 %2, %2, 0; \n\t" \
        : "+r"(r0), "+r"(r1), "+r"(r2) \
        : "r"(a) \
    )

// 32-bit squaring off-diagonal: (r0:r1:r2) += 2 * a*b
#define OCL_SQR32_M2(r0, r1, r2, a, b) \
    do { \
        uint _lo, _hi; \
        __asm volatile( \
            "mul.lo.u32 %0, %2, %3; \n\t" \
            "mul.hi.u32 %1, %2, %3; \n\t" \
            : "=r"(_lo), "=r"(_hi) : "r"(a), "r"(b) \
        ); \
        __asm volatile( \
            "add.cc.u32 %0, %0, %3; \n\t" \
            "addc.cc.u32 %1, %1, %4; \n\t" \
            "addc.u32 %2, %2, 0; \n\t" \
            "add.cc.u32 %0, %0, %3; \n\t" \
            "addc.cc.u32 %1, %1, %4; \n\t" \
            "addc.u32 %2, %2, 0; \n\t" \
            : "+r"(r0), "+r"(r1), "+r"(r2) : "r"(_lo), "r"(_hi) \
        ); \
    } while(0)

// ----------------------------------------------------------------------------
// 32-bit Comba multiplication: 4x64 FieldElement reinterpreted as 8x32 limbs.
// Produces uint[16] raw output (little-endian 32-bit limbs of 512-bit product).
// Mirrors CUDA's mul_256_comba32 from secp256k1_32_hybrid_final.cuh.
// ----------------------------------------------------------------------------
FORCE_INLINE_STATIC void mul_256_comba32_ocl(
    const FieldElement* a, const FieldElement* b, uint t32[16]
) {
    uint a32[8], b32[8];
    #pragma unroll
    for (int i = 0; i < 4; i++) {
        a32[2*i]   = (uint)(a->limbs[i]);
        a32[2*i+1] = (uint)(a->limbs[i] >> 32);
        b32[2*i]   = (uint)(b->limbs[i]);
        b32[2*i+1] = (uint)(b->limbs[i] >> 32);
    }
    uint r0 = 0, r1 = 0, r2 = 0;

    OCL_MAD32(r0,r1,r2, a32[0],b32[0]);
    t32[0]=r0; r0=r1; r1=r2; r2=0;

    OCL_MAD32(r0,r1,r2, a32[0],b32[1]); OCL_MAD32(r0,r1,r2, a32[1],b32[0]);
    t32[1]=r0; r0=r1; r1=r2; r2=0;

    OCL_MAD32(r0,r1,r2, a32[0],b32[2]); OCL_MAD32(r0,r1,r2, a32[1],b32[1]); OCL_MAD32(r0,r1,r2, a32[2],b32[0]);
    t32[2]=r0; r0=r1; r1=r2; r2=0;

    OCL_MAD32(r0,r1,r2, a32[0],b32[3]); OCL_MAD32(r0,r1,r2, a32[1],b32[2]); OCL_MAD32(r0,r1,r2, a32[2],b32[1]); OCL_MAD32(r0,r1,r2, a32[3],b32[0]);
    t32[3]=r0; r0=r1; r1=r2; r2=0;

    OCL_MAD32(r0,r1,r2, a32[0],b32[4]); OCL_MAD32(r0,r1,r2, a32[1],b32[3]); OCL_MAD32(r0,r1,r2, a32[2],b32[2]); OCL_MAD32(r0,r1,r2, a32[3],b32[1]); OCL_MAD32(r0,r1,r2, a32[4],b32[0]);
    t32[4]=r0; r0=r1; r1=r2; r2=0;

    OCL_MAD32(r0,r1,r2, a32[0],b32[5]); OCL_MAD32(r0,r1,r2, a32[1],b32[4]); OCL_MAD32(r0,r1,r2, a32[2],b32[3]); OCL_MAD32(r0,r1,r2, a32[3],b32[2]); OCL_MAD32(r0,r1,r2, a32[4],b32[1]); OCL_MAD32(r0,r1,r2, a32[5],b32[0]);
    t32[5]=r0; r0=r1; r1=r2; r2=0;

    OCL_MAD32(r0,r1,r2, a32[0],b32[6]); OCL_MAD32(r0,r1,r2, a32[1],b32[5]); OCL_MAD32(r0,r1,r2, a32[2],b32[4]); OCL_MAD32(r0,r1,r2, a32[3],b32[3]); OCL_MAD32(r0,r1,r2, a32[4],b32[2]); OCL_MAD32(r0,r1,r2, a32[5],b32[1]); OCL_MAD32(r0,r1,r2, a32[6],b32[0]);
    t32[6]=r0; r0=r1; r1=r2; r2=0;

    OCL_MAD32(r0,r1,r2, a32[0],b32[7]); OCL_MAD32(r0,r1,r2, a32[1],b32[6]); OCL_MAD32(r0,r1,r2, a32[2],b32[5]); OCL_MAD32(r0,r1,r2, a32[3],b32[4]); OCL_MAD32(r0,r1,r2, a32[4],b32[3]); OCL_MAD32(r0,r1,r2, a32[5],b32[2]); OCL_MAD32(r0,r1,r2, a32[6],b32[1]); OCL_MAD32(r0,r1,r2, a32[7],b32[0]);
    t32[7]=r0; r0=r1; r1=r2; r2=0;

    OCL_MAD32(r0,r1,r2, a32[1],b32[7]); OCL_MAD32(r0,r1,r2, a32[2],b32[6]); OCL_MAD32(r0,r1,r2, a32[3],b32[5]); OCL_MAD32(r0,r1,r2, a32[4],b32[4]); OCL_MAD32(r0,r1,r2, a32[5],b32[3]); OCL_MAD32(r0,r1,r2, a32[6],b32[2]); OCL_MAD32(r0,r1,r2, a32[7],b32[1]);
    t32[8]=r0; r0=r1; r1=r2; r2=0;

    OCL_MAD32(r0,r1,r2, a32[2],b32[7]); OCL_MAD32(r0,r1,r2, a32[3],b32[6]); OCL_MAD32(r0,r1,r2, a32[4],b32[5]); OCL_MAD32(r0,r1,r2, a32[5],b32[4]); OCL_MAD32(r0,r1,r2, a32[6],b32[3]); OCL_MAD32(r0,r1,r2, a32[7],b32[2]);
    t32[9]=r0; r0=r1; r1=r2; r2=0;

    OCL_MAD32(r0,r1,r2, a32[3],b32[7]); OCL_MAD32(r0,r1,r2, a32[4],b32[6]); OCL_MAD32(r0,r1,r2, a32[5],b32[5]); OCL_MAD32(r0,r1,r2, a32[6],b32[4]); OCL_MAD32(r0,r1,r2, a32[7],b32[3]);
    t32[10]=r0; r0=r1; r1=r2; r2=0;

    OCL_MAD32(r0,r1,r2, a32[4],b32[7]); OCL_MAD32(r0,r1,r2, a32[5],b32[6]); OCL_MAD32(r0,r1,r2, a32[6],b32[5]); OCL_MAD32(r0,r1,r2, a32[7],b32[4]);
    t32[11]=r0; r0=r1; r1=r2; r2=0;

    OCL_MAD32(r0,r1,r2, a32[5],b32[7]); OCL_MAD32(r0,r1,r2, a32[6],b32[6]); OCL_MAD32(r0,r1,r2, a32[7],b32[5]);
    t32[12]=r0; r0=r1; r1=r2; r2=0;

    OCL_MAD32(r0,r1,r2, a32[6],b32[7]); OCL_MAD32(r0,r1,r2, a32[7],b32[6]);
    t32[13]=r0; r0=r1; r1=r2; r2=0;

    OCL_MAD32(r0,r1,r2, a32[7],b32[7]);
    t32[14]=r0; t32[15]=r1;
}

// 32-bit Comba squaring: ~40% fewer multiplications (symmetry exploitation).
// Mirrors CUDA's sqr_256_comba32 from secp256k1_32_hybrid_final.cuh.
FORCE_INLINE_STATIC void sqr_256_comba32_ocl(const FieldElement* a, uint t32[16]) {
    uint a32[8];
    #pragma unroll
    for (int i = 0; i < 4; i++) {
        a32[2*i]   = (uint)(a->limbs[i]);
        a32[2*i+1] = (uint)(a->limbs[i] >> 32);
    }
    uint r0 = 0, r1 = 0, r2 = 0;

    OCL_SQR32_D(r0,r1,r2, a32[0]);
    t32[0]=r0; r0=r1; r1=r2; r2=0;

    OCL_SQR32_M2(r0,r1,r2, a32[0],a32[1]);
    t32[1]=r0; r0=r1; r1=r2; r2=0;

    OCL_SQR32_M2(r0,r1,r2, a32[0],a32[2]); OCL_SQR32_D(r0,r1,r2, a32[1]);
    t32[2]=r0; r0=r1; r1=r2; r2=0;

    OCL_SQR32_M2(r0,r1,r2, a32[0],a32[3]); OCL_SQR32_M2(r0,r1,r2, a32[1],a32[2]);
    t32[3]=r0; r0=r1; r1=r2; r2=0;

    OCL_SQR32_M2(r0,r1,r2, a32[0],a32[4]); OCL_SQR32_M2(r0,r1,r2, a32[1],a32[3]); OCL_SQR32_D(r0,r1,r2, a32[2]);
    t32[4]=r0; r0=r1; r1=r2; r2=0;

    OCL_SQR32_M2(r0,r1,r2, a32[0],a32[5]); OCL_SQR32_M2(r0,r1,r2, a32[1],a32[4]); OCL_SQR32_M2(r0,r1,r2, a32[2],a32[3]);
    t32[5]=r0; r0=r1; r1=r2; r2=0;

    OCL_SQR32_M2(r0,r1,r2, a32[0],a32[6]); OCL_SQR32_M2(r0,r1,r2, a32[1],a32[5]); OCL_SQR32_M2(r0,r1,r2, a32[2],a32[4]); OCL_SQR32_D(r0,r1,r2, a32[3]);
    t32[6]=r0; r0=r1; r1=r2; r2=0;

    OCL_SQR32_M2(r0,r1,r2, a32[0],a32[7]); OCL_SQR32_M2(r0,r1,r2, a32[1],a32[6]); OCL_SQR32_M2(r0,r1,r2, a32[2],a32[5]); OCL_SQR32_M2(r0,r1,r2, a32[3],a32[4]);
    t32[7]=r0; r0=r1; r1=r2; r2=0;

    OCL_SQR32_M2(r0,r1,r2, a32[1],a32[7]); OCL_SQR32_M2(r0,r1,r2, a32[2],a32[6]); OCL_SQR32_M2(r0,r1,r2, a32[3],a32[5]); OCL_SQR32_D(r0,r1,r2, a32[4]);
    t32[8]=r0; r0=r1; r1=r2; r2=0;

    OCL_SQR32_M2(r0,r1,r2, a32[2],a32[7]); OCL_SQR32_M2(r0,r1,r2, a32[3],a32[6]); OCL_SQR32_M2(r0,r1,r2, a32[4],a32[5]);
    t32[9]=r0; r0=r1; r1=r2; r2=0;

    OCL_SQR32_M2(r0,r1,r2, a32[3],a32[7]); OCL_SQR32_M2(r0,r1,r2, a32[4],a32[6]); OCL_SQR32_D(r0,r1,r2, a32[5]);
    t32[10]=r0; r0=r1; r1=r2; r2=0;

    OCL_SQR32_M2(r0,r1,r2, a32[4],a32[7]); OCL_SQR32_M2(r0,r1,r2, a32[5],a32[6]);
    t32[11]=r0; r0=r1; r1=r2; r2=0;

    OCL_SQR32_M2(r0,r1,r2, a32[5],a32[7]); OCL_SQR32_D(r0,r1,r2, a32[6]);
    t32[12]=r0; r0=r1; r1=r2; r2=0;

    OCL_SQR32_M2(r0,r1,r2, a32[6],a32[7]);
    t32[13]=r0; r0=r1; r1=r2; r2=0;

    OCL_SQR32_D(r0,r1,r2, a32[7]);
    t32[14]=r0; t32[15]=r1;
}

// 32-bit reduction: T_hi x K_MOD (32-bit MAD chain) + conditional P-subtract.
// Phase 1: T_hi[8..15] x 977 (scalar, 32-bit MAD chain)
// Phase 1b: add T_hi << 32  (K_MOD = 2^32 + 977)
// Phase 2: T_lo[0..7] += result (32-bit carry chain)
// Phase 3+4: pack to 64-bit, fold overflow, conditional P-subtract (64-bit PTX)
// Mirrors CUDA's reduce_512_to_256_32 from secp256k1_32_hybrid_final.cuh.
FORCE_INLINE_STATIC void reduce_512_to_256_32_ocl(uint t32[16], FieldElement* r) {
    uint t0=t32[0], t1=t32[1], t2=t32[2], t3=t32[3];
    uint t4=t32[4], t5=t32[5], t6=t32[6], t7=t32[7];
    const uint t8 =t32[8],  t9 =t32[9],  t10=t32[10], t11=t32[11];
    const uint t12=t32[12], t13=t32[13], t14=t32[14], t15=t32[15];

    // Phase 1: A = T_hi[8..15] x 977 (32-bit scalar MAD chain -> 9 limbs)
    uint a0, a1, a2, a3, a4, a5, a6, a7, a8;
    __asm volatile(
        "mul.lo.u32 %0, %9,  977;\n\t"
        "mul.hi.u32 %1, %9,  977;\n\t"
        "mad.lo.cc.u32 %1, %10, 977, %1;\n\t"
        "madc.hi.u32 %2, %10, 977, 0;\n\t"
        "mad.lo.cc.u32 %2, %11, 977, %2;\n\t"
        "madc.hi.u32 %3, %11, 977, 0;\n\t"
        "mad.lo.cc.u32 %3, %12, 977, %3;\n\t"
        "madc.hi.u32 %4, %12, 977, 0;\n\t"
        "mad.lo.cc.u32 %4, %13, 977, %4;\n\t"
        "madc.hi.u32 %5, %13, 977, 0;\n\t"
        "mad.lo.cc.u32 %5, %14, 977, %5;\n\t"
        "madc.hi.u32 %6, %14, 977, 0;\n\t"
        "mad.lo.cc.u32 %6, %15, 977, %6;\n\t"
        "madc.hi.u32 %7, %15, 977, 0;\n\t"
        "mad.lo.cc.u32 %7, %16, 977, %7;\n\t"
        "madc.hi.u32 %8, %16, 977, 0;\n\t"
        : "=r"(a0),"=r"(a1),"=r"(a2),"=r"(a3),"=r"(a4),
          "=r"(a5),"=r"(a6),"=r"(a7),"=r"(a8)
        : "r"(t8),"r"(t9),"r"(t10),"r"(t11),
          "r"(t12),"r"(t13),"r"(t14),"r"(t15)
    );

    // Phase 1b: add T_hi << 32 (a[1..8] += T_hi[8..15], yielding a9 overflow)
    uint a9;
    __asm volatile(
        "add.cc.u32  %0, %0, %9;\n\t"
        "addc.cc.u32 %1, %1, %10;\n\t"
        "addc.cc.u32 %2, %2, %11;\n\t"
        "addc.cc.u32 %3, %3, %12;\n\t"
        "addc.cc.u32 %4, %4, %13;\n\t"
        "addc.cc.u32 %5, %5, %14;\n\t"
        "addc.cc.u32 %6, %6, %15;\n\t"
        "addc.cc.u32 %7, %7, %16;\n\t"
        "addc.u32    %8, 0, 0;\n\t"
        : "+r"(a1),"+r"(a2),"+r"(a3),"+r"(a4),
          "+r"(a5),"+r"(a6),"+r"(a7),"+r"(a8),"=r"(a9)
        : "r"(t8),"r"(t9),"r"(t10),"r"(t11),
          "r"(t12),"r"(t13),"r"(t14),"r"(t15)
    );

    // Phase 2: T_lo[0..7] += A[0..7] (32-bit carry chain)
    uint carry;
    __asm volatile(
        "add.cc.u32  %0, %0, %9;\n\t"
        "addc.cc.u32 %1, %1, %10;\n\t"
        "addc.cc.u32 %2, %2, %11;\n\t"
        "addc.cc.u32 %3, %3, %12;\n\t"
        "addc.cc.u32 %4, %4, %13;\n\t"
        "addc.cc.u32 %5, %5, %14;\n\t"
        "addc.cc.u32 %6, %6, %15;\n\t"
        "addc.cc.u32 %7, %7, %16;\n\t"
        "addc.u32    %8, 0, 0;\n\t"
        : "+r"(t0),"+r"(t1),"+r"(t2),"+r"(t3),
          "+r"(t4),"+r"(t5),"+r"(t6),"+r"(t7),"=r"(carry)
        : "r"(a0),"r"(a1),"r"(a2),"r"(a3),
          "r"(a4),"r"(a5),"r"(a6),"r"(a7)
    );

    // Phase 3: pack to 64-bit and fold overflow (extra * K)
    // Phase 3: overflow fold (fully 32-bit — no INT64 multiply)
    // extra = a8 + carry + a9*2^32, extra * K_MOD = extra*977 + extra<<32
    uint e_lo, e_carry;
    __asm volatile(
        "add.cc.u32 %0, %2, %3;\n\t"
        "addc.u32 %1, 0, 0;\n\t"
        : "=r"(e_lo), "=r"(e_carry)
        : "r"(a8), "r"(carry)
    );
    uint e_hi = a9 + e_carry;
    uint p_lo, p_hi;
    __asm volatile(
        "mul.lo.u32 %0, %2, 977;\n\t"
        "mul.hi.u32 %1, %2, 977;\n\t"
        : "=r"(p_lo), "=r"(p_hi)
        : "r"(e_lo)
    );
    uint q = e_hi * 977u;
    uint m1 = p_hi + q;
    uint ek0 = p_lo;
    uint ek1, ek1_carry;
    __asm volatile(
        "add.cc.u32 %0, %2, %3;\n\t"
        "addc.u32 %1, 0, 0;\n\t"
        : "=r"(ek1), "=r"(ek1_carry)
        : "r"(m1), "r"(e_lo)
    );
    uint ek2 = e_hi + ek1_carry;
    ulong r0 = ((ulong)t1 << 32) | t0;
    ulong r1 = ((ulong)t3 << 32) | t2;
    ulong r2 = ((ulong)t5 << 32) | t4;
    ulong r3 = ((ulong)t7 << 32) | t6;
    ulong ek_lo = ((ulong)ek1 << 32) | ek0;
    ulong ek_hi = (ulong)ek2;
    ulong c;
    __asm volatile(
        "add.cc.u64  %0, %0, %5;\n\t"
        "addc.cc.u64 %1, %1, %6;\n\t"
        "addc.cc.u64 %2, %2, 0;\n\t"
        "addc.cc.u64 %3, %3, 0;\n\t"
        "addc.u64    %4, 0, 0;\n\t"
        : "+l"(r0),"+l"(r1),"+l"(r2),"+l"(r3),"=l"(c)
        : "l"(ek_lo),"l"(ek_hi)
    );
    // CONSTANT-TIME rare-carry fold: was `if (c) { add SECP256K1_K }` — a
    // data-dependent branch on a secret-derived carry. Now always execute the add
    // with a masked addend (0 when c==0 -> no-op), so wavefront execution is
    // uniform. Mirrors the CUDA reduce_512_to_256_32 (proven CT via ncu).
    {
        ulong cmask = (ulong)0 - (ulong)(c != 0UL);
        __asm volatile("" : "+l"(cmask));   // value barrier
        ulong cfold = (ulong)SECP256K1_K & cmask;
        __asm volatile(
            "add.cc.u64  %0, %0, %4;\n\t"
            "addc.cc.u64 %1, %1, 0;\n\t"
            "addc.cc.u64 %2, %2, 0;\n\t"
            "addc.u64    %3, %3, 0;\n\t"
            : "+l"(r0),"+l"(r1),"+l"(r2),"+l"(r3)
            : "l"(cfold)
        );
    }

    // Phase 4: conditional subtraction of P (64-bit PTX sub.cc chain)
    ulong s0, s1, s2, s3, borrow;
    __asm volatile(
        "sub.cc.u64  %0, %5, %9;\n\t"
        "subc.cc.u64 %1, %6, %10;\n\t"
        "subc.cc.u64 %2, %7, %11;\n\t"
        "subc.cc.u64 %3, %8, %12;\n\t"
        "subc.u64    %4, 0, 0;\n\t"
        : "=l"(s0),"=l"(s1),"=l"(s2),"=l"(s3),"=l"(borrow)
        : "l"(r0),"l"(r1),"l"(r2),"l"(r3),
          "l"(SECP256K1_P0),"l"(SECP256K1_P1),"l"(SECP256K1_P2),"l"(SECP256K1_P3)
    );
    // CONSTANT-TIME final reduction: was `if (borrow==0) r=s; else r=r;` — a
    // data-dependent branch (borrow==0 <=> r >= P). Now branchless cmov: select
    // the subtracted limbs s iff r >= P, else keep r, via a value-barriered mask.
    // Mirrors the CUDA reduce_512_to_256_32 (proven CT via ncu).
    {
        ulong mask = (ulong)0 - (ulong)(borrow == 0UL);
        __asm volatile("" : "+l"(mask));   // value barrier
        r->limbs[0] = (s0 & mask) | (r0 & ~mask);
        r->limbs[1] = (s1 & mask) | (r1 & ~mask);
        r->limbs[2] = (s2 & mask) | (r2 & ~mask);
        r->limbs[3] = (s3 & mask) | (r3 & ~mask);
    }
}

#endif // __NV_CL_C_VERSION

// =============================================================================
// Field Reduction: r = a mod p
// Uses the fact that p = 2^256 - K where K = 0x1000003D1
// So 2^256 ≡ K (mod p), meaning we can reduce by replacing high bits with K*high
// =============================================================================

FORCE_INLINE void field_reduce(FieldElement* r, const ulong* a8) {
    // a8 is 512-bit number (8 limbs), reduce to 256-bit mod p
    // Since p = 2^256 - K, we have: a mod p = a_low + K * a_high (mod p)

    ulong carry = 0;
    ulong temp[5];

    // First reduction: fold a[4..7] into a[0..3] using K
    // temp = a[0..3] + K * a[4..7]

    // Process each high limb
    ulong2 prod;

    // limb 0: a[0] + K * a[4]
    prod = mul64_full(SECP256K1_K, a8[4]);
    temp[0] = a8[0] + prod.x;
    carry = (temp[0] < a8[0]) ? 1UL : 0UL;
    carry += prod.y;

    // limb 1: a[1] + K * a[5] + carry
    prod = mul64_full(SECP256K1_K, a8[5]);
    temp[1] = a8[1] + carry;
    ulong c1 = (temp[1] < carry) ? 1UL : 0UL;
    temp[1] += prod.x;
    c1 += (temp[1] < prod.x) ? 1UL : 0UL;
    carry = c1 + prod.y;

    // limb 2: a[2] + K * a[6] + carry
    prod = mul64_full(SECP256K1_K, a8[6]);
    temp[2] = a8[2] + carry;
    c1 = (temp[2] < carry) ? 1UL : 0UL;
    temp[2] += prod.x;
    c1 += (temp[2] < prod.x) ? 1UL : 0UL;
    carry = c1 + prod.y;

    // limb 3: a[3] + K * a[7] + carry
    prod = mul64_full(SECP256K1_K, a8[7]);
    temp[3] = a8[3] + carry;
    c1 = (temp[3] < carry) ? 1UL : 0UL;
    temp[3] += prod.x;
    c1 += (temp[3] < prod.x) ? 1UL : 0UL;
    temp[4] = c1 + prod.y;

    // Second reduction: fold temp[4]. CONSTANT-TIME: was `if (temp[4] != 0)` with a
    // nested `if (carry)` — data-dependent branches on a secret-derived overflow
    // during signing. Now ALWAYS folded (temp[4]==0 -> K*0=0 -> no-op) and the rare
    // carry fold is masked (mirrors the CUDA/Metal masked rare-carry fold; the
    // per-limb `? :` carries are branchless selects, not branches).
    {
        prod = mul64_full(SECP256K1_K, temp[4]);
        temp[0] += prod.x;
        carry = (temp[0] < prod.x) ? 1UL : 0UL;
        carry += prod.y;

        temp[1] += carry;
        carry = (temp[1] < carry) ? 1UL : 0UL;

        temp[2] += carry;
        carry = (temp[2] < carry) ? 1UL : 0UL;

        temp[3] += carry;
        carry = (temp[3] < carry) ? 1UL : 0UL;

        // Rare carry overflow (~2^-190): fold residual carry branchlessly (0 when carry==0).
        ulong cmask = (ulong)0 - (ulong)(carry != 0UL);
        ulong kfold = (ulong)SECP256K1_K & cmask;
        temp[0] += kfold;
        ulong c2 = (temp[0] < kfold) ? 1UL : 0UL;
        temp[1] += c2;
        c2 = (temp[1] < c2) ? 1UL : 0UL;
        temp[2] += c2;
        c2 = (temp[2] < c2) ? 1UL : 0UL;
        temp[3] += c2;
    }

    // Final reduction: if result >= p, subtract p
    // Check if result >= p by comparing limbs
    ulong borrow = 0;
    ulong diff[4];

    diff[0] = sub_with_borrow(temp[0], SECP256K1_P0, 0, &borrow);
    diff[1] = sub_with_borrow(temp[1], SECP256K1_P1, borrow, &borrow);
    diff[2] = sub_with_borrow(temp[2], SECP256K1_P2, borrow, &borrow);
    diff[3] = sub_with_borrow(temp[3], SECP256K1_P3, borrow, &borrow);

    // If no borrow, result >= p, use subtracted value
    // Otherwise, use original value
    // Branchless selection
    ulong mask = (borrow == 0) ? ~0UL : 0UL;

    r->limbs[0] = (diff[0] & mask) | (temp[0] & ~mask);
    r->limbs[1] = (diff[1] & mask) | (temp[1] & ~mask);
    r->limbs[2] = (diff[2] & mask) | (temp[2] & ~mask);
    r->limbs[3] = (diff[3] & mask) | (temp[3] & ~mask);
}

// =============================================================================
// Field Addition: r = (a + b) mod p
// =============================================================================

FORCE_INLINE void field_add_impl(FieldElement* r, const FieldElement* a, const FieldElement* b) {
#ifdef __NV_CL_C_VERSION
    // Level 2: native add.cc/addc carry chains (no comparison-based carry)
    ulong s0, s1, s2, s3, carry;
    __asm volatile(
        "add.cc.u64  %0, %5, %9;\n\t"
        "addc.cc.u64 %1, %6, %10;\n\t"
        "addc.cc.u64 %2, %7, %11;\n\t"
        "addc.cc.u64 %3, %8, %12;\n\t"
        "addc.u64    %4, 0, 0;\n\t"
        : "=l"(s0),"=l"(s1),"=l"(s2),"=l"(s3),"=l"(carry)
        : "l"(a->limbs[0]),"l"(a->limbs[1]),"l"(a->limbs[2]),"l"(a->limbs[3]),
          "l"(b->limbs[0]),"l"(b->limbs[1]),"l"(b->limbs[2]),"l"(b->limbs[3])
    );
    ulong d0, d1, d2, d3, borrow;
    __asm volatile(
        "sub.cc.u64  %0, %5, %9;\n\t"
        "subc.cc.u64 %1, %6, %10;\n\t"
        "subc.cc.u64 %2, %7, %11;\n\t"
        "subc.cc.u64 %3, %8, %12;\n\t"
        "subc.u64    %4, 0, 0;\n\t"
        : "=l"(d0),"=l"(d1),"=l"(d2),"=l"(d3),"=l"(borrow)
        : "l"(s0),"l"(s1),"l"(s2),"l"(s3),
          "l"(SECP256K1_P0),"l"(SECP256K1_P1),"l"(SECP256K1_P2),"l"(SECP256K1_P3)
    );
    // use diff if: no borrow (s >= P) OR carry from add (sum overflowed 2^256)
    ulong mask = ~borrow | (0UL - carry);
    r->limbs[0] = (d0 & mask) | (s0 & ~mask);
    r->limbs[1] = (d1 & mask) | (s1 & ~mask);
    r->limbs[2] = (d2 & mask) | (s2 & ~mask);
    r->limbs[3] = (d3 & mask) | (s3 & ~mask);
#else
    ulong carry = 0;
    ulong sum[4];
    sum[0] = add_with_carry(a->limbs[0], b->limbs[0], 0, &carry);
    sum[1] = add_with_carry(a->limbs[1], b->limbs[1], carry, &carry);
    sum[2] = add_with_carry(a->limbs[2], b->limbs[2], carry, &carry);
    sum[3] = add_with_carry(a->limbs[3], b->limbs[3], carry, &carry);
    ulong borrow = 0;
    ulong diff[4];
    diff[0] = sub_with_borrow(sum[0], SECP256K1_P0, 0, &borrow);
    diff[1] = sub_with_borrow(sum[1], SECP256K1_P1, borrow, &borrow);
    diff[2] = sub_with_borrow(sum[2], SECP256K1_P2, borrow, &borrow);
    diff[3] = sub_with_borrow(sum[3], SECP256K1_P3, borrow, &borrow);
    ulong use_diff = (carry != 0) | (borrow == 0);
    ulong mask = use_diff ? ~0UL : 0UL;
    r->limbs[0] = (diff[0] & mask) | (sum[0] & ~mask);
    r->limbs[1] = (diff[1] & mask) | (sum[1] & ~mask);
    r->limbs[2] = (diff[2] & mask) | (sum[2] & ~mask);
    r->limbs[3] = (diff[3] & mask) | (sum[3] & ~mask);
#endif
}

// =============================================================================
// Field Subtraction: r = (a - b) mod p
// =============================================================================

FORCE_INLINE void field_sub_impl(FieldElement* r, const FieldElement* a, const FieldElement* b) {
#ifdef __NV_CL_C_VERSION
    // Level 2: native sub.cc/subc + add.cc/addc carry chains
    ulong d0, d1, d2, d3, borrow;
    __asm volatile(
        "sub.cc.u64  %0, %5, %9;\n\t"
        "subc.cc.u64 %1, %6, %10;\n\t"
        "subc.cc.u64 %2, %7, %11;\n\t"
        "subc.cc.u64 %3, %8, %12;\n\t"
        "subc.u64    %4, 0, 0;\n\t"
        : "=l"(d0),"=l"(d1),"=l"(d2),"=l"(d3),"=l"(borrow)
        : "l"(a->limbs[0]),"l"(a->limbs[1]),"l"(a->limbs[2]),"l"(a->limbs[3]),
          "l"(b->limbs[0]),"l"(b->limbs[1]),"l"(b->limbs[2]),"l"(b->limbs[3])
    );
    // borrow = 0xFFFF...FFFF if a < b (underflow), 0 otherwise
    ulong p0 = SECP256K1_P0 & borrow;
    ulong p1 = SECP256K1_P1 & borrow;
    ulong p2 = SECP256K1_P2 & borrow;
    ulong p3 = SECP256K1_P3 & borrow;
    __asm volatile(
        "add.cc.u64  %0, %4, %8;\n\t"
        "addc.cc.u64 %1, %5, %9;\n\t"
        "addc.cc.u64 %2, %6, %10;\n\t"
        "addc.u64    %3, %7, %11;\n\t"
        : "=l"(r->limbs[0]),"=l"(r->limbs[1]),"=l"(r->limbs[2]),"=l"(r->limbs[3])
        : "l"(d0),"l"(d1),"l"(d2),"l"(d3), "l"(p0),"l"(p1),"l"(p2),"l"(p3)
    );
#else
    ulong borrow = 0;
    ulong diff[4];
    diff[0] = sub_with_borrow(a->limbs[0], b->limbs[0], 0, &borrow);
    diff[1] = sub_with_borrow(a->limbs[1], b->limbs[1], borrow, &borrow);
    diff[2] = sub_with_borrow(a->limbs[2], b->limbs[2], borrow, &borrow);
    diff[3] = sub_with_borrow(a->limbs[3], b->limbs[3], borrow, &borrow);
    ulong mask = borrow ? ~0UL : 0UL;
    ulong carry = 0;
    ulong adj[4];
    adj[0] = add_with_carry(diff[0], SECP256K1_P0 & mask, 0, &carry);
    adj[1] = add_with_carry(diff[1], SECP256K1_P1 & mask, carry, &carry);
    adj[2] = add_with_carry(diff[2], SECP256K1_P2 & mask, carry, &carry);
    adj[3] = add_with_carry(diff[3], SECP256K1_P3 & mask, carry, &carry);
    r->limbs[0] = adj[0];
    r->limbs[1] = adj[1];
    r->limbs[2] = adj[2];
    r->limbs[3] = adj[3];
#endif
}

// =============================================================================
// Field Multiplication: r = (a * b) mod p
// =============================================================================

// Helper: add 128-bit product (hi:lo) into 3-register accumulator (c2:c1:c0)
FORCE_INLINE void muladd(ulong lo, ulong hi, ulong* c0, ulong* c1, ulong* c2) {
    ulong carry;
    *c0 = add_with_carry(*c0, lo, 0, &carry);
    *c1 = add_with_carry(*c1, hi, carry, &carry);
    *c2 += carry;
}

// Helper: add 128-bit product (hi:lo) doubled into accumulator
FORCE_INLINE void muladd2(ulong lo, ulong hi, ulong* c0, ulong* c1, ulong* c2) {
    muladd(lo, hi, c0, c1, c2);
    muladd(lo, hi, c0, c1, c2);
}

FORCE_INLINE void field_mul_impl(FieldElement* r, const FieldElement* a, const FieldElement* b) {
#ifdef __NV_CL_C_VERSION
    // Level 3: 32-bit hybrid Comba + 32-bit reduction (INT32 throughput 32x > INT64)
    uint t32[16];
    mul_256_comba32_ocl(a, b, t32);
    reduce_512_to_256_32_ocl(t32, r);
#else
    ulong a0 = a->limbs[0], a1 = a->limbs[1], a2 = a->limbs[2], a3 = a->limbs[3];
    ulong b0 = b->limbs[0], b1 = b->limbs[1], b2 = b->limbs[2], b3 = b->limbs[3];
    ulong product[8];
    ulong c0, c1, c2;
    ulong2 m;

    // Column 0: a0*b0
    c0 = 0; c1 = 0; c2 = 0;
    m = mul64_full(a0, b0); muladd(m.x, m.y, &c0, &c1, &c2);
    product[0] = c0; c0 = c1; c1 = c2; c2 = 0;

    // Column 1: a0*b1 + a1*b0
    m = mul64_full(a0, b1); muladd(m.x, m.y, &c0, &c1, &c2);
    m = mul64_full(a1, b0); muladd(m.x, m.y, &c0, &c1, &c2);
    product[1] = c0; c0 = c1; c1 = c2; c2 = 0;

    // Column 2: a0*b2 + a1*b1 + a2*b0
    m = mul64_full(a0, b2); muladd(m.x, m.y, &c0, &c1, &c2);
    m = mul64_full(a1, b1); muladd(m.x, m.y, &c0, &c1, &c2);
    m = mul64_full(a2, b0); muladd(m.x, m.y, &c0, &c1, &c2);
    product[2] = c0; c0 = c1; c1 = c2; c2 = 0;

    // Column 3: a0*b3 + a1*b2 + a2*b1 + a3*b0
    m = mul64_full(a0, b3); muladd(m.x, m.y, &c0, &c1, &c2);
    m = mul64_full(a1, b2); muladd(m.x, m.y, &c0, &c1, &c2);
    m = mul64_full(a2, b1); muladd(m.x, m.y, &c0, &c1, &c2);
    m = mul64_full(a3, b0); muladd(m.x, m.y, &c0, &c1, &c2);
    product[3] = c0; c0 = c1; c1 = c2; c2 = 0;

    // Column 4: a1*b3 + a2*b2 + a3*b1
    m = mul64_full(a1, b3); muladd(m.x, m.y, &c0, &c1, &c2);
    m = mul64_full(a2, b2); muladd(m.x, m.y, &c0, &c1, &c2);
    m = mul64_full(a3, b1); muladd(m.x, m.y, &c0, &c1, &c2);
    product[4] = c0; c0 = c1; c1 = c2; c2 = 0;

    // Column 5: a2*b3 + a3*b2
    m = mul64_full(a2, b3); muladd(m.x, m.y, &c0, &c1, &c2);
    m = mul64_full(a3, b2); muladd(m.x, m.y, &c0, &c1, &c2);
    product[5] = c0; c0 = c1; c1 = c2; c2 = 0;

    // Column 6: a3*b3
    m = mul64_full(a3, b3); muladd(m.x, m.y, &c0, &c1, &c2);
    product[6] = c0;
    product[7] = c1;

    field_reduce(r, product);
#endif
}

// =============================================================================
// Field Squaring: r = a² mod p
// =============================================================================

// Forward declaration for field_sqr_n_impl
FORCE_INLINE void field_sqr_impl(FieldElement* r, const FieldElement* a);

// Repeated squaring helper: r = r^(2^n) — in-place
FORCE_INLINE void field_sqr_n_impl(FieldElement* r, int n) {
    for (int i = 0; i < n; i++) field_sqr_impl(r, r);
}

FORCE_INLINE void field_sqr_impl(FieldElement* r, const FieldElement* a) {
#ifdef __NV_CL_C_VERSION
    // Level 3: 32-bit hybrid squaring (40% fewer multiplications + INT32 throughput)
    uint t32[16];
    sqr_256_comba32_ocl(a, t32);
    reduce_512_to_256_32_ocl(t32, r);
#else
    ulong a0 = a->limbs[0], a1 = a->limbs[1], a2 = a->limbs[2], a3 = a->limbs[3];
    ulong product[8];
    ulong c0, c1, c2;
    ulong2 m;

    // Column 0: a0*a0
    c0 = 0; c1 = 0; c2 = 0;
    m = mul64_full(a0, a0); muladd(m.x, m.y, &c0, &c1, &c2);
    product[0] = c0; c0 = c1; c1 = c2; c2 = 0;

    // Column 1: 2*a0*a1
    m = mul64_full(a0, a1); muladd2(m.x, m.y, &c0, &c1, &c2);
    product[1] = c0; c0 = c1; c1 = c2; c2 = 0;

    // Column 2: 2*a0*a2 + a1*a1
    m = mul64_full(a0, a2); muladd2(m.x, m.y, &c0, &c1, &c2);
    m = mul64_full(a1, a1); muladd(m.x, m.y, &c0, &c1, &c2);
    product[2] = c0; c0 = c1; c1 = c2; c2 = 0;

    // Column 3: 2*a0*a3 + 2*a1*a2
    m = mul64_full(a0, a3); muladd2(m.x, m.y, &c0, &c1, &c2);
    m = mul64_full(a1, a2); muladd2(m.x, m.y, &c0, &c1, &c2);
    product[3] = c0; c0 = c1; c1 = c2; c2 = 0;

    // Column 4: 2*a1*a3 + a2*a2
    m = mul64_full(a1, a3); muladd2(m.x, m.y, &c0, &c1, &c2);
    m = mul64_full(a2, a2); muladd(m.x, m.y, &c0, &c1, &c2);
    product[4] = c0; c0 = c1; c1 = c2; c2 = 0;

    // Column 5: 2*a2*a3
    m = mul64_full(a2, a3); muladd2(m.x, m.y, &c0, &c1, &c2);
    product[5] = c0; c0 = c1; c1 = c2; c2 = 0;

    // Column 6: a3*a3
    m = mul64_full(a3, a3); muladd(m.x, m.y, &c0, &c1, &c2);
    product[6] = c0;
    product[7] = c1;

    field_reduce(r, product);
#endif
}

// =============================================================================
// Field Negation: r = -a mod p = p - a
// =============================================================================

FORCE_INLINE void field_neg_impl(FieldElement* r, const FieldElement* a) {
    // Check if a is zero
    ulong is_zero = ((a->limbs[0] | a->limbs[1] | a->limbs[2] | a->limbs[3]) == 0) ? 1UL : 0UL;

    ulong borrow = 0;
    r->limbs[0] = sub_with_borrow(SECP256K1_P0, a->limbs[0], 0, &borrow);
    r->limbs[1] = sub_with_borrow(SECP256K1_P1, a->limbs[1], borrow, &borrow);
    r->limbs[2] = sub_with_borrow(SECP256K1_P2, a->limbs[2], borrow, &borrow);
    r->limbs[3] = sub_with_borrow(SECP256K1_P3, a->limbs[3], borrow, &borrow);

    // If a was zero, result should be zero
    ulong mask = is_zero ? 0UL : ~0UL;
    r->limbs[0] &= mask;
    r->limbs[1] &= mask;
    r->limbs[2] &= mask;
    r->limbs[3] &= mask;
}

// =============================================================================
// Field Inversion: r = a^(-1) mod p
// Using Fermat's little theorem with optimized addition chain
// Matches CUDA's field_inv_fermat_chain for minimal mul+sqr count
// p-2 = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2D
// =============================================================================

FORCE_INLINE void field_inv_impl(FieldElement* r, const FieldElement* a) {
    FieldElement x2, x3, x6, x12, x24, x48, x96, x192, x7, x31, x223;
    FieldElement x5, x11, x22;
    FieldElement t;

    // 1. x2 = a^2 * a  (2 consecutive ones)
    field_sqr_impl(&x2, a);
    field_mul_impl(&x2, &x2, a);

    // 2. x3 = x2^2 * a  (3 consecutive ones)
    field_sqr_impl(&x3, &x2);
    field_mul_impl(&x3, &x3, a);

    // 3. x6 = x3^(2^3) * x3  (6 consecutive ones)
    field_sqr_impl(&x6, &x3);
    field_sqr_n_impl(&x6, 2);
    field_mul_impl(&x6, &x6, &x3);

    // 4. x12 = x6^(2^6) * x6  (12 consecutive ones)
    t = x6;
    field_sqr_n_impl(&t, 6);
    field_mul_impl(&x12, &t, &x6);

    // 5. x24 = x12^(2^12) * x12  (24 consecutive ones)
    t = x12;
    field_sqr_n_impl(&t, 12);
    field_mul_impl(&x24, &t, &x12);

    // 6. x48 = x24^(2^24) * x24  (48 consecutive ones)
    t = x24;
    field_sqr_n_impl(&t, 24);
    field_mul_impl(&x48, &t, &x24);

    // 7. x96 = x48^(2^48) * x48  (96 consecutive ones)
    t = x48;
    field_sqr_n_impl(&t, 48);
    field_mul_impl(&x96, &t, &x48);

    // 8. x192 = x96^(2^96) * x96  (192 consecutive ones)
    t = x96;
    field_sqr_n_impl(&t, 96);
    field_mul_impl(&x192, &t, &x96);

    // 9. x7 = x6^2 * a  (7 consecutive ones)
    field_sqr_impl(&x7, &x6);
    field_mul_impl(&x7, &x7, a);

    // 10. x31 = x24^(2^7) * x7  (31 consecutive ones)
    t = x24;
    field_sqr_n_impl(&t, 7);
    field_mul_impl(&x31, &t, &x7);

    // 11. x223 = x192^(2^31) * x31  (223 consecutive ones)
    t = x192;
    field_sqr_n_impl(&t, 31);
    field_mul_impl(&x223, &t, &x31);

    // 12. x5 = x3^(2^2) * x2  (5 consecutive ones)
    t = x3;
    field_sqr_n_impl(&t, 2);
    field_mul_impl(&x5, &t, &x2);

    // 13. x11 = x6^(2^5) * x5  (11 consecutive ones)
    t = x6;
    field_sqr_n_impl(&t, 5);
    field_mul_impl(&x11, &t, &x5);

    // 14. x22 = x11^(2^11) * x11  (22 consecutive ones)
    t = x11;
    field_sqr_n_impl(&t, 11);
    field_mul_impl(&x22, &t, &x11);

    // 15. t = x223^2  (bit 32 is 0)
    field_sqr_impl(&t, &x223);

    // 16. t = t^(2^22) * x22  (append 22 ones)
    field_sqr_n_impl(&t, 22);
    field_mul_impl(&t, &t, &x22);

    // 17. t = t^(2^4)  (bits 9,8,7,6 are 0)
    field_sqr_n_impl(&t, 4);

    // 18. Process remaining 6 bits: 101101
    // bit 5: 1
    field_sqr_impl(&t, &t);
    field_mul_impl(&t, &t, a);
    // bit 4: 0
    field_sqr_impl(&t, &t);
    // bit 3: 1
    field_sqr_impl(&t, &t);
    field_mul_impl(&t, &t, a);
    // bit 2: 1
    field_sqr_impl(&t, &t);
    field_mul_impl(&t, &t, a);
    // bit 1: 0
    field_sqr_impl(&t, &t);
    // bit 0: 1
    field_sqr_impl(&t, &t);
    field_mul_impl(r, &t, a);
}

// =============================================================================
// OpenCL Kernels
// =============================================================================

__kernel void field_add(
    __global const FieldElement* a,
    __global const FieldElement* b,
    __global FieldElement* result,
    const uint count
) {
    uint gid = get_global_id(0);
    if (gid >= count) return;

    // Copy from global to private memory
    FieldElement a_local = a[gid];
    FieldElement b_local = b[gid];
    FieldElement r;
    field_add_impl(&r, &a_local, &b_local);
    result[gid] = r;
}

__kernel void field_sub(
    __global const FieldElement* a,
    __global const FieldElement* b,
    __global FieldElement* result,
    const uint count
) {
    uint gid = get_global_id(0);
    if (gid >= count) return;

    // Copy from global to private memory
    FieldElement a_local = a[gid];
    FieldElement b_local = b[gid];
    FieldElement r;
    field_sub_impl(&r, &a_local, &b_local);
    result[gid] = r;
}

__kernel void field_mul(
    __global const FieldElement* a,
    __global const FieldElement* b,
    __global FieldElement* result,
    const uint count
) {
    uint gid = get_global_id(0);
    if (gid >= count) return;

    // Copy from global to private memory
    FieldElement a_local = a[gid];
    FieldElement b_local = b[gid];
    FieldElement r;
    field_mul_impl(&r, &a_local, &b_local);
    result[gid] = r;
}

__kernel void field_sqr(
    __global const FieldElement* a,
    __global FieldElement* result,
    const uint count
) {
    uint gid = get_global_id(0);
    if (gid >= count) return;

    // Copy from global to private memory
    FieldElement a_local = a[gid];
    FieldElement r;
    field_sqr_impl(&r, &a_local);
    result[gid] = r;
}

__kernel void field_inv(
    __global const FieldElement* a,
    __global FieldElement* result,
    const uint count
) {
    uint gid = get_global_id(0);
    if (gid >= count) return;

    // Copy from global to private memory
    FieldElement a_local = a[gid];
    FieldElement r;
    field_inv_impl(&r, &a_local);
    result[gid] = r;
}


// =============================================================================
// CONCATENATED: secp256k1_point.cl
// =============================================================================
// =============================================================================
// UltrafastSecp256k1 OpenCL Kernels - Point Operations
// =============================================================================
// Elliptic curve point operations on secp256k1: y² = x³ + 7
// Jacobian coordinates for efficient operations
// =============================================================================

// Include field arithmetic

// =============================================================================
// Curve Constants
// =============================================================================

// Generator point G (affine coordinates)
// Gx = 0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798
// Gy = 0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8

#define SECP256K1_GX0 0x59F2815B16F81798UL
#define SECP256K1_GX1 0x029BFCDB2DCE28D9UL
#define SECP256K1_GX2 0x55A06295CE870B07UL
#define SECP256K1_GX3 0x79BE667EF9DCBBACUL

#define SECP256K1_GY0 0x9C47D08FFB10D4B8UL
#define SECP256K1_GY1 0xFD17B448A6855419UL
#define SECP256K1_GY2 0x5DA4FBFC0E1108A8UL
#define SECP256K1_GY3 0x483ADA7726A3C465UL

// Curve order n
#define SECP256K1_N0 0xBFD25E8CD0364141UL
#define SECP256K1_N1 0xBAAEDCE6AF48A03BUL
#define SECP256K1_N2 0xFFFFFFFFFFFFFFFEUL
#define SECP256K1_N3 0xFFFFFFFFFFFFFFFFUL

// =============================================================================
// Point Types
// =============================================================================

typedef struct {
    FieldElement x;
    FieldElement y;
} AffinePoint;

typedef struct {
    FieldElement x;
    FieldElement y;
    FieldElement z;
    uint infinity;  // 1 if point at infinity
    uint pad[7];    // Match host alignas(128) layout — sizeof = 128 bytes
} JacobianPoint;

typedef struct {
    ulong limbs[4];
} Scalar;

// =============================================================================
// Point Utilities
// =============================================================================

FORCE_INLINE void point_set_infinity(JacobianPoint* p) {
    p->x.limbs[0] = 0; p->x.limbs[1] = 0; p->x.limbs[2] = 0; p->x.limbs[3] = 0;
    p->y.limbs[0] = 1; p->y.limbs[1] = 0; p->y.limbs[2] = 0; p->y.limbs[3] = 0;
    p->z.limbs[0] = 0; p->z.limbs[1] = 0; p->z.limbs[2] = 0; p->z.limbs[3] = 0;
    p->infinity = 1;
}

FORCE_INLINE int point_is_infinity(const JacobianPoint* p) {
    return p->infinity ||
           ((p->z.limbs[0] | p->z.limbs[1] | p->z.limbs[2] | p->z.limbs[3]) == 0);
}

FORCE_INLINE void point_from_affine(JacobianPoint* j, const AffinePoint* a) {
    j->x = a->x;
    j->y = a->y;
    j->z.limbs[0] = 1; j->z.limbs[1] = 0; j->z.limbs[2] = 0; j->z.limbs[3] = 0;
    j->infinity = 0;
}

FORCE_INLINE void get_generator(AffinePoint* g) {
    g->x.limbs[0] = SECP256K1_GX0;
    g->x.limbs[1] = SECP256K1_GX1;
    g->x.limbs[2] = SECP256K1_GX2;
    g->x.limbs[3] = SECP256K1_GX3;

    g->y.limbs[0] = SECP256K1_GY0;
    g->y.limbs[1] = SECP256K1_GY1;
    g->y.limbs[2] = SECP256K1_GY2;
    g->y.limbs[3] = SECP256K1_GY3;
}

// =============================================================================
// Point Doubling: R = 2*P (Jacobian coordinates)
// Using standard doubling formula for a = 0 curves (secp256k1)
// =============================================================================

FORCE_INLINE void point_double_impl(JacobianPoint* r, const JacobianPoint* p) {
    if (point_is_infinity(p)) {
        point_set_infinity(r);
        return;
    }

    // Check if Y = 0 (point of order 2, but secp256k1 doesn't have one)
    if ((p->y.limbs[0] | p->y.limbs[1] | p->y.limbs[2] | p->y.limbs[3]) == 0) {
        point_set_infinity(r);
        return;
    }

    FieldElement S, M, X3, Y3, Z3, YY, YYYY, ZZ, t1, t2;

    // S = 4*X*Y^2
    field_sqr_impl(&YY, &p->y);           // YY = Y^2
    field_mul_impl(&S, &p->x, &YY);       // S = X * Y^2
    field_add_impl(&S, &S, &S);           // S = 2*X*Y^2
    field_add_impl(&S, &S, &S);           // S = 4*X*Y^2

    // M = 3*X^2 (since a=0 for secp256k1)
    field_sqr_impl(&M, &p->x);            // M = X^2
    field_add_impl(&t1, &M, &M);          // t1 = 2*X^2
    field_add_impl(&M, &M, &t1);          // M = 3*X^2

    // X3 = M^2 - 2*S
    field_sqr_impl(&X3, &M);              // X3 = M^2
    field_add_impl(&t1, &S, &S);          // t1 = 2*S
    field_sub_impl(&X3, &X3, &t1);        // X3 = M^2 - 2*S

    // Y3 = M*(S - X3) - 8*Y^4
    field_sqr_impl(&YYYY, &YY);           // YYYY = Y^4
    field_add_impl(&t1, &YYYY, &YYYY);    // t1 = 2*Y^4
    field_add_impl(&t1, &t1, &t1);        // t1 = 4*Y^4
    field_add_impl(&t1, &t1, &t1);        // t1 = 8*Y^4
    field_sub_impl(&t2, &S, &X3);         // t2 = S - X3
    field_mul_impl(&Y3, &M, &t2);         // Y3 = M*(S - X3)
    field_sub_impl(&Y3, &Y3, &t1);        // Y3 = M*(S - X3) - 8*Y^4

    // Z3 = 2*Y*Z
    field_mul_impl(&Z3, &p->y, &p->z);    // Z3 = Y*Z
    field_add_impl(&Z3, &Z3, &Z3);        // Z3 = 2*Y*Z

    r->x = X3;
    r->y = Y3;
    r->z = Z3;
    r->infinity = 0;
}

// =============================================================================
// Point Addition: R = P + Q (Jacobian + Jacobian)
// Complete addition formula
// =============================================================================

// Unchecked doubling: skips infinity and Y==0 checks.
// Precondition: p is a valid, non-infinity point with Y != 0.
FORCE_INLINE void point_double_unchecked(JacobianPoint* r, const JacobianPoint* p) {
    FieldElement S, M, X3, Y3, Z3, YY, YYYY, t1, t2;

    field_sqr_impl(&YY, &p->y);
    field_mul_impl(&S, &p->x, &YY);
    field_add_impl(&S, &S, &S);
    field_add_impl(&S, &S, &S);

    field_sqr_impl(&M, &p->x);
    field_add_impl(&t1, &M, &M);
    field_add_impl(&M, &M, &t1);

    field_sqr_impl(&X3, &M);
    field_add_impl(&t1, &S, &S);
    field_sub_impl(&X3, &X3, &t1);

    field_sqr_impl(&YYYY, &YY);
    field_add_impl(&t1, &YYYY, &YYYY);
    field_add_impl(&t1, &t1, &t1);
    field_add_impl(&t1, &t1, &t1);
    field_sub_impl(&t2, &S, &X3);
    field_mul_impl(&Y3, &M, &t2);
    field_sub_impl(&Y3, &Y3, &t1);

    field_mul_impl(&Z3, &p->y, &p->z);
    field_add_impl(&Z3, &Z3, &Z3);

    r->x = X3;
    r->y = Y3;
    r->z = Z3;
    r->infinity = 0;
}

// Unchecked mixed addition: skips p->infinity check.
// Precondition: p is a valid, non-infinity Jacobian point.
// Keeps the H==0 check for algebraic completeness.
FORCE_INLINE void point_add_mixed_unchecked(JacobianPoint* r, const JacobianPoint* p, const AffinePoint* q) {
    FieldElement Z1Z1, U2, S2, H, HH, I, J, rr, V, X3, Y3, Z3, t1, t2;

    field_sqr_impl(&Z1Z1, &p->z);
    field_mul_impl(&U2, &q->x, &Z1Z1);
    field_mul_impl(&t1, &q->y, &p->z);
    field_mul_impl(&S2, &t1, &Z1Z1);
    field_sub_impl(&H, &U2, &p->x);

    if ((H.limbs[0] | H.limbs[1] | H.limbs[2] | H.limbs[3]) == 0) {
        field_sub_impl(&t1, &S2, &p->y);
        if ((t1.limbs[0] | t1.limbs[1] | t1.limbs[2] | t1.limbs[3]) == 0) {
            point_double_unchecked(r, p);
            return;
        }
        point_set_infinity(r);
        return;
    }

    field_sqr_impl(&HH, &H);
    field_add_impl(&I, &HH, &HH);
    field_add_impl(&I, &I, &I);
    field_mul_impl(&J, &H, &I);
    field_sub_impl(&rr, &S2, &p->y);
    field_add_impl(&rr, &rr, &rr);
    field_mul_impl(&V, &p->x, &I);

    field_sqr_impl(&X3, &rr);
    field_sub_impl(&X3, &X3, &J);
    field_add_impl(&t1, &V, &V);
    field_sub_impl(&X3, &X3, &t1);

    field_sub_impl(&t1, &V, &X3);
    field_mul_impl(&Y3, &rr, &t1);
    field_mul_impl(&t2, &p->y, &J);
    field_add_impl(&t2, &t2, &t2);
    field_sub_impl(&Y3, &Y3, &t2);

    field_add_impl(&t1, &p->z, &H);
    field_sqr_impl(&Z3, &t1);
    field_sub_impl(&Z3, &Z3, &Z1Z1);
    field_sub_impl(&Z3, &Z3, &HH);

    r->x = X3;
    r->y = Y3;
    r->z = Z3;
}

// =============================================================================
// Point Addition: R = P + Q (Jacobian + Jacobian)
// Complete addition formula
// =============================================================================

FORCE_INLINE void point_add_impl(JacobianPoint* r, const JacobianPoint* p, const JacobianPoint* q) {
    // Handle infinity cases
    if (point_is_infinity(p)) {
        *r = *q;
        return;
    }
    if (point_is_infinity(q)) {
        *r = *p;
        return;
    }

    FieldElement U1, U2, S1, S2, H, I, J, rr, V, X3, Y3, Z3;
    FieldElement Z1Z1, Z2Z2, t1, t2;

    // Z1Z1 = Z1^2
    field_sqr_impl(&Z1Z1, &p->z);

    // Z2Z2 = Z2^2
    field_sqr_impl(&Z2Z2, &q->z);

    // U1 = X1*Z2Z2
    field_mul_impl(&U1, &p->x, &Z2Z2);

    // U2 = X2*Z1Z1
    field_mul_impl(&U2, &q->x, &Z1Z1);

    // S1 = Y1*Z2*Z2Z2
    field_mul_impl(&t1, &p->y, &q->z);
    field_mul_impl(&S1, &t1, &Z2Z2);

    // S2 = Y2*Z1*Z1Z1
    field_mul_impl(&t1, &q->y, &p->z);
    field_mul_impl(&S2, &t1, &Z1Z1);

    // H = U2 - U1
    field_sub_impl(&H, &U2, &U1);

    // Check if H = 0 (points have same X coordinate)
    if ((H.limbs[0] | H.limbs[1] | H.limbs[2] | H.limbs[3]) == 0) {
        // Check if S1 == S2 (same point, do doubling)
        field_sub_impl(&t1, &S2, &S1);
        if ((t1.limbs[0] | t1.limbs[1] | t1.limbs[2] | t1.limbs[3]) == 0) {
            point_double_impl(r, p);
            return;
        }
        // Points are negatives, result is infinity
        point_set_infinity(r);
        return;
    }

    // I = (2*H)^2
    field_add_impl(&I, &H, &H);           // I = 2*H
    field_sqr_impl(&I, &I);               // I = (2*H)^2

    // J = H*I
    field_mul_impl(&J, &H, &I);

    // r = 2*(S2 - S1)
    field_sub_impl(&rr, &S2, &S1);
    field_add_impl(&rr, &rr, &rr);

    // V = U1*I
    field_mul_impl(&V, &U1, &I);

    // X3 = r^2 - J - 2*V
    field_sqr_impl(&X3, &rr);
    field_sub_impl(&X3, &X3, &J);
    field_add_impl(&t1, &V, &V);
    field_sub_impl(&X3, &X3, &t1);

    // Y3 = r*(V - X3) - 2*S1*J
    field_sub_impl(&t1, &V, &X3);
    field_mul_impl(&Y3, &rr, &t1);
    field_mul_impl(&t2, &S1, &J);
    field_add_impl(&t2, &t2, &t2);
    field_sub_impl(&Y3, &Y3, &t2);

    // Z3 = ((Z1 + Z2)^2 - Z1Z1 - Z2Z2) * H
    field_add_impl(&t1, &p->z, &q->z);
    field_sqr_impl(&t1, &t1);
    field_sub_impl(&t1, &t1, &Z1Z1);
    field_sub_impl(&t1, &t1, &Z2Z2);
    field_mul_impl(&Z3, &t1, &H);

    r->x = X3;
    r->y = Y3;
    r->z = Z3;
    r->infinity = 0;
}

// =============================================================================
// Mixed Addition: R = P + Q (Jacobian + Affine)
// More efficient when one point is affine (Z = 1)
// =============================================================================

FORCE_INLINE void point_add_mixed_impl(JacobianPoint* r, const JacobianPoint* p, const AffinePoint* q) {
    if (point_is_infinity(p)) {
        point_from_affine(r, q);
        return;
    }

    FieldElement Z1Z1, U2, S2, H, HH, I, J, rr, V, X3, Y3, Z3, t1, t2;

    // Z1Z1 = Z1^2
    field_sqr_impl(&Z1Z1, &p->z);

    // U2 = X2*Z1Z1 (U1 = X1 since Z2 = 1)
    field_mul_impl(&U2, &q->x, &Z1Z1);

    // S2 = Y2*Z1*Z1Z1 (S1 = Y1 since Z2 = 1)
    field_mul_impl(&t1, &q->y, &p->z);
    field_mul_impl(&S2, &t1, &Z1Z1);

    // H = U2 - X1
    field_sub_impl(&H, &U2, &p->x);

    // Check if points are same or negatives
    if ((H.limbs[0] | H.limbs[1] | H.limbs[2] | H.limbs[3]) == 0) {
        field_sub_impl(&t1, &S2, &p->y);
        if ((t1.limbs[0] | t1.limbs[1] | t1.limbs[2] | t1.limbs[3]) == 0) {
            point_double_impl(r, p);
            return;
        }
        point_set_infinity(r);
        return;
    }

    // HH = H^2
    field_sqr_impl(&HH, &H);

    // I = 4*HH
    field_add_impl(&I, &HH, &HH);
    field_add_impl(&I, &I, &I);

    // J = H*I
    field_mul_impl(&J, &H, &I);

    // r = 2*(S2 - Y1)
    field_sub_impl(&rr, &S2, &p->y);
    field_add_impl(&rr, &rr, &rr);

    // V = X1*I
    field_mul_impl(&V, &p->x, &I);

    // X3 = r^2 - J - 2*V
    field_sqr_impl(&X3, &rr);
    field_sub_impl(&X3, &X3, &J);
    field_add_impl(&t1, &V, &V);
    field_sub_impl(&X3, &X3, &t1);

    // Y3 = r*(V - X3) - 2*Y1*J
    field_sub_impl(&t1, &V, &X3);
    field_mul_impl(&Y3, &rr, &t1);
    field_mul_impl(&t2, &p->y, &J);
    field_add_impl(&t2, &t2, &t2);
    field_sub_impl(&Y3, &Y3, &t2);

    // Z3 = (Z1 + H)^2 - Z1Z1 - HH
    field_add_impl(&t1, &p->z, &H);
    field_sqr_impl(&Z3, &t1);
    field_sub_impl(&Z3, &Z3, &Z1Z1);
    field_sub_impl(&Z3, &Z3, &HH);

    r->x = X3;
    r->y = Y3;
    r->z = Z3;
    r->infinity = 0;
}

// Mixed Jacobian+affine addition with H output for batch inversion.
// h_out receives H = U2 - X1 (the Z-coordinate ratio).
// For degenerate cases (infinity, doubling, negation), h_out = ONE.
FORCE_INLINE void point_add_mixed_h_impl(JacobianPoint* r, const JacobianPoint* p,
                                   const AffinePoint* q, FieldElement* h_out) {
    h_out->limbs[0] = 1UL; h_out->limbs[1] = 0; h_out->limbs[2] = 0; h_out->limbs[3] = 0;

    if (point_is_infinity(p)) {
        point_from_affine(r, q);
        return;
    }

    FieldElement Z1Z1, U2, S2, H, HH, I, J, rr, V, X3, Y3, Z3, t1, t2;

    field_sqr_impl(&Z1Z1, &p->z);
    field_mul_impl(&U2, &q->x, &Z1Z1);
    field_mul_impl(&t1, &q->y, &p->z);
    field_mul_impl(&S2, &t1, &Z1Z1);

    field_sub_impl(&H, &U2, &p->x);

    if ((H.limbs[0] | H.limbs[1] | H.limbs[2] | H.limbs[3]) == 0) {
        field_sub_impl(&t1, &S2, &p->y);
        if ((t1.limbs[0] | t1.limbs[1] | t1.limbs[2] | t1.limbs[3]) == 0) {
            point_double_impl(r, p);
            return;
        }
        point_set_infinity(r);
        return;
    }

    // Z3 = (Z1+H)^2 - Z1Z1 - HH = 2*Z1*H, so Z-ratio is 2*H
    field_add_impl(h_out, &H, &H);

    field_sqr_impl(&HH, &H);
    field_add_impl(&I, &HH, &HH);
    field_add_impl(&I, &I, &I);
    field_mul_impl(&J, &H, &I);
    field_sub_impl(&rr, &S2, &p->y);
    field_add_impl(&rr, &rr, &rr);
    field_mul_impl(&V, &p->x, &I);

    field_sqr_impl(&X3, &rr);
    field_sub_impl(&X3, &X3, &J);
    field_add_impl(&t1, &V, &V);
    field_sub_impl(&X3, &X3, &t1);

    field_sub_impl(&t1, &V, &X3);
    field_mul_impl(&Y3, &rr, &t1);
    field_mul_impl(&t2, &p->y, &J);
    field_add_impl(&t2, &t2, &t2);
    field_sub_impl(&Y3, &Y3, &t2);

    field_add_impl(&t1, &p->z, &H);
    field_sqr_impl(&Z3, &t1);
    field_sub_impl(&Z3, &Z3, &Z1Z1);
    field_sub_impl(&Z3, &Z3, &HH);

    r->x = X3; r->y = Y3; r->z = Z3; r->infinity = 0;
}

// =============================================================================
// Scalar Utilities for wNAF
// =============================================================================

FORCE_INLINE int scalar_is_zero(const Scalar* k) {
    return (k->limbs[0] | k->limbs[1] | k->limbs[2] | k->limbs[3]) == 0;
}

FORCE_INLINE int scalar_bit(const Scalar* k, int pos) {
    int limb = pos / 64;
    int bit = pos % 64;
    return (int)((k->limbs[limb] >> bit) & 1UL);
}

FORCE_INLINE void scalar_sub_u64(Scalar* a, ulong val, Scalar* r) {
    *r = *a;
    ulong old = r->limbs[0];
    r->limbs[0] -= val;
    if (r->limbs[0] > old) { // borrow
        for (int i = 1; i < 4; i++) {
            r->limbs[i] -= 1;
            if (r->limbs[i] != ~0UL) break; // no further borrow
        }
    }
}

FORCE_INLINE void scalar_add_u64(Scalar* a, ulong val, Scalar* r) {
    *r = *a;
    ulong old = r->limbs[0];
    r->limbs[0] += val;
    if (r->limbs[0] < old) { // carry
        for (int i = 1; i < 4; i++) {
            r->limbs[i] += 1;
            if (r->limbs[i] != 0) break; // no further carry
        }
    }
}

// Convert scalar to wNAF representation (window width 5)
// Returns length of wNAF representation
static inline int scalar_to_wnaf(const Scalar* k, int wnaf[260]) {
    Scalar temp = *k;
    int len = 0;
    const int window_size = 32;   // 2^5
    const int window_mask = 31;   // 2^5 - 1
    const int window_half = 16;   // 2^(5-1)
    
    int digit;
    ulong limb;

    while (!scalar_is_zero(&temp) && len < 260) {
        if (scalar_bit(&temp, 0) == 1) { // temp is odd
            digit = (int)(temp.limbs[0] & window_mask);
            
            if (digit >= window_half) {
                digit -= window_size;
                scalar_add_u64(&temp, (ulong)(-digit), &temp);
            } else {
                scalar_sub_u64(&temp, (ulong)digit, &temp);
            }
            
            wnaf[len] = digit;
        } else {
            wnaf[len] = 0;
        }
        
        // Right shift by 1
        limb = temp.limbs[3];
        temp.limbs[3] = (limb >> 1);
        ulong carry = limb & 1;
        
        limb = temp.limbs[2];
        temp.limbs[2] = (limb >> 1) | (carry << 63);
        carry = limb & 1;
        
        limb = temp.limbs[1];
        temp.limbs[1] = (limb >> 1) | (carry << 63);
        carry = limb & 1;
        
        limb = temp.limbs[0];
        temp.limbs[0] = (limb >> 1) | (carry << 63);
        
        len++;
    }
    
    return len;
}

// Negate Y coordinate of Jacobian point
FORCE_INLINE void point_negate_y(JacobianPoint* p) {
    FieldElement zero;
    zero.limbs[0] = 0; zero.limbs[1] = 0;
    zero.limbs[2] = 0; zero.limbs[3] = 0;
    field_neg_impl(&p->y, &p->y);
}

// =============================================================================
// Scalar Multiplication: R = k * P
// wNAF (window width 5) — matches CUDA's scalar_mul
// =============================================================================

FORCE_INLINE void scalar_mul_impl(JacobianPoint* r, const Scalar* k, const AffinePoint* p) {
    // Check for zero scalar
    if (scalar_is_zero(k)) {
        point_set_infinity(r);
        return;
    }

    // Convert scalar to wNAF representation
    int wnaf[260];
    int wnaf_len = scalar_to_wnaf(k, wnaf);

    // Precompute table: [P, 3P, 5P, ..., 15P] (8 entries)
    JacobianPoint table[8];
    JacobianPoint double_p;
    
    point_from_affine(&table[0], p);
    point_double_impl(&double_p, &table[0]);
    
    for (int i = 1; i < 8; i++) {
        point_add_impl(&table[i], &table[i-1], &double_p);
    }

    // Initialize result as infinity
    point_set_infinity(r);

    int digit;
    int idx;

    // Process wNAF from MSB to LSB
    for (int i = wnaf_len - 1; i >= 0; --i) {
        point_double_impl(r, r);

        digit = wnaf[i];
        if (digit > 0) {
            idx = (digit - 1) / 2;
            point_add_impl(r, r, &table[idx]);
        } else if (digit < 0) {
            idx = (-digit - 1) / 2;
            JacobianPoint neg_point = table[idx];
            point_negate_y(&neg_point);
            point_add_impl(r, r, &neg_point);
        }
    }
}

// =============================================================================
// Scalar Multiplication with Generator: R = k * G
// Fixed-window w=4 with precomputed affine table of {0G..15G}.
// Uses mixed J+A additions and unchecked variants for maximum throughput.
// =============================================================================

FORCE_INLINE void scalar_mul_generator_impl(JacobianPoint* r, const Scalar* k) {
    // Precomputed affine table: table[i] = i*G for i = 0..15.
    // table[0] is the point at infinity (unused except as sentinel).
    AffinePoint table[16];
    table[0].x.limbs[0] = 0; table[0].x.limbs[1] = 0; table[0].x.limbs[2] = 0; table[0].x.limbs[3] = 0;
    table[0].y.limbs[0] = 0; table[0].y.limbs[1] = 0; table[0].y.limbs[2] = 0; table[0].y.limbs[3] = 0;
    // 1*G
    table[1].x.limbs[0] = 0x59F2815B16F81798UL; table[1].x.limbs[1] = 0x029BFCDB2DCE28D9UL;
    table[1].x.limbs[2] = 0x55A06295CE870B07UL; table[1].x.limbs[3] = 0x79BE667EF9DCBBACUL;
    table[1].y.limbs[0] = 0x9C47D08FFB10D4B8UL; table[1].y.limbs[1] = 0xFD17B448A6855419UL;
    table[1].y.limbs[2] = 0x5DA4FBFC0E1108A8UL; table[1].y.limbs[3] = 0x483ADA7726A3C465UL;
    // 2*G
    table[2].x.limbs[0] = 0xABAC09B95C709EE5UL; table[2].x.limbs[1] = 0x5C778E4B8CEF3CA7UL;
    table[2].x.limbs[2] = 0x3045406E95C07CD8UL; table[2].x.limbs[3] = 0xC6047F9441ED7D6DUL;
    table[2].y.limbs[0] = 0x236431A950CFE52AUL; table[2].y.limbs[1] = 0xF7F632653266D0E1UL;
    table[2].y.limbs[2] = 0xA3C58419466CEAEEUL; table[2].y.limbs[3] = 0x1AE168FEA63DC339UL;
    // 3*G
    table[3].x.limbs[0] = 0x8601F113BCE036F9UL; table[3].x.limbs[1] = 0xB531C845836F99B0UL;
    table[3].x.limbs[2] = 0x49344F85F89D5229UL; table[3].x.limbs[3] = 0xF9308A019258C310UL;
    table[3].y.limbs[0] = 0x6CB9FD7584B8E672UL; table[3].y.limbs[1] = 0x6500A99934C2231BUL;
    table[3].y.limbs[2] = 0x0FE337E62A37F356UL; table[3].y.limbs[3] = 0x388F7B0F632DE814UL;
    // 4*G
    table[4].x.limbs[0] = 0x74FA94ABE8C4CD13UL; table[4].x.limbs[1] = 0xCC6C13900EE07584UL;
    table[4].x.limbs[2] = 0x581E4904930B1404UL; table[4].x.limbs[3] = 0xE493DBF1C10D80F3UL;
    table[4].y.limbs[0] = 0xCFE97BDC47739922UL; table[4].y.limbs[1] = 0xD967AE33BFBDFE40UL;
    table[4].y.limbs[2] = 0x5642E2098EA51448UL; table[4].y.limbs[3] = 0x51ED993EA0D455B7UL;
    // 5*G
    table[5].x.limbs[0] = 0xCBA8D569B240EFE4UL; table[5].x.limbs[1] = 0xE88B84BDDC619AB7UL;
    table[5].x.limbs[2] = 0x55B4A7250A5C5128UL; table[5].x.limbs[3] = 0x2F8BDE4D1A072093UL;
    table[5].y.limbs[0] = 0xDCA87D3AA6AC62D6UL; table[5].y.limbs[1] = 0xF788271BAB0D6840UL;
    table[5].y.limbs[2] = 0xD4DBA9DDA6C9C426UL; table[5].y.limbs[3] = 0xD8AC222636E5E3D6UL;
    // 6*G
    table[6].x.limbs[0] = 0x2F057A1460297556UL; table[6].x.limbs[1] = 0x82F6472F8568A18BUL;
    table[6].x.limbs[2] = 0x20453A14355235D3UL; table[6].x.limbs[3] = 0xFFF97BD5755EEEA4UL;
    table[6].y.limbs[0] = 0x3C870C36B075F297UL; table[6].y.limbs[1] = 0xDE80F0F6518FE4A0UL;
    table[6].y.limbs[2] = 0xF3BE96017F45C560UL; table[6].y.limbs[3] = 0xAE12777AACFBB620UL;
    // 7*G
    table[7].x.limbs[0] = 0xE92BDDEDCAC4F9BCUL; table[7].x.limbs[1] = 0x3D419B7E0330E39CUL;
    table[7].x.limbs[2] = 0xA398F365F2EA7A0EUL; table[7].x.limbs[3] = 0x5CBDF0646E5DB4EAUL;
    table[7].y.limbs[0] = 0xA5082628087264DAUL; table[7].y.limbs[1] = 0xA813D0B813FDE7B5UL;
    table[7].y.limbs[2] = 0xA3178D6D861A54DBUL; table[7].y.limbs[3] = 0x6AEBCA40BA255960UL;
    // 8*G
    table[8].x.limbs[0] = 0x67784EF3E10A2A01UL; table[8].x.limbs[1] = 0x0A1BDD05E5AF888AUL;
    table[8].x.limbs[2] = 0xAFF3843FB70F3C2FUL; table[8].x.limbs[3] = 0x2F01E5E15CCA351DUL;
    table[8].y.limbs[0] = 0xB5DA2CB76CBDE904UL; table[8].y.limbs[1] = 0xC2E213D6BA5B7617UL;
    table[8].y.limbs[2] = 0x293D082A132D13B4UL; table[8].y.limbs[3] = 0x5C4DA8A741539949UL;
    // 9*G
    table[9].x.limbs[0] = 0xC35F110DFC27CCBEUL; table[9].x.limbs[1] = 0xE09796974C57E714UL;
    table[9].x.limbs[2] = 0x09AD178A9F559ABDUL; table[9].x.limbs[3] = 0xACD484E2F0C7F653UL;
    table[9].y.limbs[0] = 0x05CC262AC64F9C37UL; table[9].y.limbs[1] = 0xADD888A4375F8E0FUL;
    table[9].y.limbs[2] = 0x64380971763B61E9UL; table[9].y.limbs[3] = 0xCC338921B0A7D9FDUL;
    // 10*G
    table[10].x.limbs[0] = 0x52A68E2A47E247C7UL; table[10].x.limbs[1] = 0x3442D49B1943C2B7UL;
    table[10].x.limbs[2] = 0x35477C7B1AE6AE5DUL; table[10].x.limbs[3] = 0xA0434D9E47F3C862UL;
    table[10].y.limbs[0] = 0x3CBEE53B037368D7UL; table[10].y.limbs[1] = 0x6F794C2ED877A159UL;
    table[10].y.limbs[2] = 0xA3B6C7E693A24C69UL; table[10].y.limbs[3] = 0x893ABA425419BC27UL;
    // 11*G
    table[11].x.limbs[0] = 0xBBEC17895DA008CBUL; table[11].x.limbs[1] = 0x5649980BE5C17891UL;
    table[11].x.limbs[2] = 0x5EF4246B70C65AACUL; table[11].x.limbs[3] = 0x774AE7F858A9411EUL;
    table[11].y.limbs[0] = 0x301D74C9C953C61BUL; table[11].y.limbs[1] = 0x372DB1E2DFF9D6A8UL;
    table[11].y.limbs[2] = 0x0243DD56D7B7B365UL; table[11].y.limbs[3] = 0xD984A032EB6B5E19UL;
    // 12*G
    table[12].x.limbs[0] = 0xC5B0F47070AFE85AUL; table[12].x.limbs[1] = 0x687CF4419620095BUL;
    table[12].x.limbs[2] = 0x15C38F004D734633UL; table[12].x.limbs[3] = 0xD01115D548E7561BUL;
    table[12].y.limbs[0] = 0x6B051B13F4062327UL; table[12].y.limbs[1] = 0x79238C5DD9A86D52UL;
    table[12].y.limbs[2] = 0xA8B64537E17BD815UL; table[12].y.limbs[3] = 0xA9F34FFDC815E0D7UL;
    // 13*G
    table[13].x.limbs[0] = 0xDEEDDF8F19405AA8UL; table[13].x.limbs[1] = 0xB075FBC6610E58CDUL;
    table[13].x.limbs[2] = 0xC7D1D205C3748651UL; table[13].x.limbs[3] = 0xF28773C2D975288BUL;
    table[13].y.limbs[0] = 0x29B5CB52DB03ED81UL; table[13].y.limbs[1] = 0x3A1A06DA521FA91FUL;
    table[13].y.limbs[2] = 0x758212EB65CDAF47UL; table[13].y.limbs[3] = 0x0AB0902E8D880A89UL;
    // 14*G
    table[14].x.limbs[0] = 0xE49B241A60E823E4UL; table[14].x.limbs[1] = 0x26AA7B63678949E6UL;
    table[14].x.limbs[2] = 0xFD64E67F07D38E32UL; table[14].x.limbs[3] = 0x499FDF9E895E719CUL;
    table[14].y.limbs[0] = 0xC65F40D403A13F5BUL; table[14].y.limbs[1] = 0x464279C27A3F95BCUL;
    table[14].y.limbs[2] = 0x90F044E4A7B3D464UL; table[14].y.limbs[3] = 0xCAC2F6C4B54E8551UL;
    // 15*G
    table[15].x.limbs[0] = 0x44ADBCF8E27E080EUL; table[15].x.limbs[1] = 0x31E5946F3C85F79EUL;
    table[15].x.limbs[2] = 0x5A465AE3095FF411UL; table[15].x.limbs[3] = 0xD7924D4F7D43EA96UL;
    table[15].y.limbs[0] = 0xC504DC9FF6A26B58UL; table[15].y.limbs[1] = 0xEA40AF2BD896D3A5UL;
    table[15].y.limbs[2] = 0x83842EC228CC6DEFUL; table[15].y.limbs[3] = 0x581E2872A86C72A6UL;

    // Process scalar 4 bits at a time (MSB first)
    point_set_infinity(r);
    int started = 0;

    for (int limb = 3; limb >= 0; limb--) {
        ulong w = k->limbs[limb];
        for (int nib = 15; nib >= 0; nib--) {
            uint idx = (uint)((w >> (nib * 4)) & 0xFUL);

            if (started) {
                point_double_unchecked(r, r);
                point_double_unchecked(r, r);
                point_double_unchecked(r, r);
                point_double_unchecked(r, r);
            }

            if (idx != 0) {
                if (!started) {
                    point_from_affine(r, &table[idx]);
                    started = 1;
                } else {
                    point_add_mixed_unchecked(r, r, &table[idx]);
                }
            }
        }
    }
}

// =============================================================================
// OpenCL Kernels - Point Operations
// =============================================================================

__kernel void point_double(
    __global const JacobianPoint* points,
    __global JacobianPoint* results,
    const uint count
) {
    uint gid = get_global_id(0);
    if (gid >= count) return;

    // Copy from global to private memory
    JacobianPoint p_local = points[gid];
    JacobianPoint r;
    point_double_impl(&r, &p_local);
    results[gid] = r;
}

__kernel void point_add(
    __global const JacobianPoint* p,
    __global const JacobianPoint* q,
    __global JacobianPoint* results,
    const uint count
) {
    uint gid = get_global_id(0);
    if (gid >= count) return;

    // Copy from global to private memory
    JacobianPoint p_local = p[gid];
    JacobianPoint q_local = q[gid];
    JacobianPoint r;
    point_add_impl(&r, &p_local, &q_local);
    results[gid] = r;
}

__kernel void scalar_mul(
    __global const Scalar* scalars,
    __global const AffinePoint* points,
    __global JacobianPoint* results,
    const uint count
) {
    uint gid = get_global_id(0);
    if (gid >= count) return;

    // Copy from global to private memory
    Scalar k_local = scalars[gid];
    AffinePoint p_local = points[gid];
    JacobianPoint r;
    scalar_mul_impl(&r, &k_local, &p_local);
    results[gid] = r;
}

__kernel void scalar_mul_generator(
    __global const Scalar* scalars,
    __global JacobianPoint* results,
    const uint count
) {
    uint gid = get_global_id(0);
    if (gid >= count) return;

    // Copy from global to private memory
    Scalar k_local = scalars[gid];
    JacobianPoint r;
    scalar_mul_generator_impl(&r, &k_local);
    results[gid] = r;
}


// =============================================================================
// CONCATENATED: secp256k1_ct_ops.cl
// =============================================================================
// =============================================================================
// secp256k1_ct_ops.cl -- Constant-time primitive operations for OpenCL
// =============================================================================
// Provides value_barrier, CT masks, conditional moves/swaps/selects.
// All operations are branchless: no secret-dependent branches or memory access.
// =============================================================================

#ifndef SECP256K1_CT_OPS_CL
#define SECP256K1_CT_OPS_CL

// ---------------------------------------------------------------------------
// value_barrier: prevent compiler from reasoning about value, breaking
// branch-to-cmov and dead-code optimizations that leak secrets.
// OpenCL has no inline asm; use volatile through private memory.
// ---------------------------------------------------------------------------
inline ulong ct_value_barrier(ulong v) {
    volatile ulong tmp = v;
    return tmp;
}

inline uint ct_value_barrier32(uint v) {
    volatile uint tmp = v;
    return tmp;
}

// ---------------------------------------------------------------------------
// Mask generators -- all produce 0 or 0xFFFFFFFFFFFFFFFF
// ---------------------------------------------------------------------------
inline ulong ct_is_zero_mask(ulong v) {
    // (v | -v) >> 63 is 1 when v != 0, 0 when v == 0
    v = ct_value_barrier(v);
    return ~(((v | (0UL - v)) >> 63) - 1UL) ^ 0xFFFFFFFFFFFFFFFFUL;
    // Simplified: zero -> mask = all-ones, nonzero -> mask = 0
}

inline ulong ct_is_nonzero_mask(ulong v) {
    v = ct_value_barrier(v);
    ulong t = (v | (0UL - v)) >> 63;  // 1 if nonzero
    return 0UL - t;  // 0xFFFF... if nonzero, 0 if zero
}

inline ulong ct_eq_mask(ulong a, ulong b) {
    return ct_is_zero_mask(a ^ b);
}

inline ulong ct_bool_to_mask(int b) {
    return 0UL - (ulong)(b & 1);
}

// Return all-ones if a < b (unsigned), else 0
inline ulong ct_lt_mask(ulong a, ulong b) {
    // (a - b) borrows iff a < b, bit 63 of (a ^ ((a ^ b) | ((a - b) ^ a)))
    ulong x = a ^ b;
    ulong d = a - b;
    ulong borrow = (a ^ ((x) | (d ^ a))) >> 63;
    return 0UL - borrow;
}

// ---------------------------------------------------------------------------
// Conditional move: r = cond ? a : r  (cond is 0 or all-ones mask)
// ---------------------------------------------------------------------------
inline void ct_cmov64(ulong* r, ulong a, ulong mask) {
    *r = (*r & ~mask) | (a & mask);
}

inline void ct_cmov256(ulong r[4], const ulong a[4], ulong mask) {
    for (int i = 0; i < 4; ++i)
        r[i] = (r[i] & ~mask) | (a[i] & mask);
}

// ---------------------------------------------------------------------------
// Conditional swap: if mask is all-ones, swap a[] and b[]
// ---------------------------------------------------------------------------
inline void ct_cswap256(ulong a[4], ulong b[4], ulong mask) {
    for (int i = 0; i < 4; ++i) {
        ulong diff = (a[i] ^ b[i]) & mask;
        a[i] ^= diff;
        b[i] ^= diff;
    }
}

// ---------------------------------------------------------------------------
// CT select from array: always scans ALL entries (no early exit)
// ---------------------------------------------------------------------------
inline void ct_select256(const ulong table[][4], int table_size, int index, ulong out[4]) {
    out[0] = 0; out[1] = 0; out[2] = 0; out[3] = 0;
    for (int i = 0; i < table_size; ++i) {
        ulong mask = ct_eq_mask((ulong)i, (ulong)index);
        for (int j = 0; j < 4; ++j)
            out[j] |= table[i][j] & mask;
    }
}

// CT lookup: 8-limb version (for FieldElement + Scalar pairs stored as 8 ulongs)
inline void ct_lookup_256(const ulong table[][8], int table_size, int index, ulong out[8]) {
    for (int j = 0; j < 8; ++j) out[j] = 0;
    for (int i = 0; i < table_size; ++i) {
        ulong mask = ct_eq_mask((ulong)i, (ulong)index);
        for (int j = 0; j < 8; ++j)
            out[j] |= table[i][j] & mask;
    }
}

// ---------------------------------------------------------------------------
// CT FieldElement operations (wrapping the 4-limb FieldElement struct)
// ---------------------------------------------------------------------------
inline void ct_field_cmov(FieldElement* r, const FieldElement* a, ulong mask) {
    ct_cmov256((ulong*)r->limbs, (const ulong*)a->limbs, mask);
}

inline void ct_field_cswap(FieldElement* a, FieldElement* b, ulong mask) {
    ct_cswap256((ulong*)a->limbs, (ulong*)b->limbs, mask);
}

inline void ct_field_select(const FieldElement* a, const FieldElement* b,
                            ulong mask, FieldElement* out) {
    // out = mask ? a : b
    for (int i = 0; i < 4; ++i)
        out->limbs[i] = (b->limbs[i] & ~mask) | (a->limbs[i] & mask);
}

inline void ct_field_cneg(FieldElement* r, const FieldElement* a, ulong mask) {
    FieldElement neg;
    field_neg_impl(&neg, a);
    ct_field_select(&neg, a, mask, r);
}

// ---------------------------------------------------------------------------
// CT Scalar operations (wrapping the 4-limb Scalar struct)
// ---------------------------------------------------------------------------
inline void ct_scalar_cmov(Scalar* r, const Scalar* a, ulong mask) {
    ct_cmov256((ulong*)r->limbs, (const ulong*)a->limbs, mask);
}

inline void ct_scalar_cswap(Scalar* a, Scalar* b, ulong mask) {
    ct_cswap256((ulong*)a->limbs, (ulong*)b->limbs, mask);
}

inline void ct_scalar_select(const Scalar* a, const Scalar* b,
                             ulong mask, Scalar* out) {
    for (int i = 0; i < 4; ++i)
        out->limbs[i] = (b->limbs[i] & ~mask) | (a->limbs[i] & mask);
}

inline void ct_scalar_cneg(Scalar* r, const Scalar* a, ulong mask) {
    Scalar neg;
    scalar_negate_impl(a, &neg);
    ct_scalar_select(&neg, a, mask, r);
}

#endif // SECP256K1_CT_OPS_CL

// =============================================================================
// CONCATENATED: secp256k1_ct_field.cl
// =============================================================================
// =============================================================================
// secp256k1_ct_field.cl -- Constant-time field arithmetic for OpenCL
// =============================================================================
// Branchless add/sub with inline reduction. mul/sqr/inv wrap fast-path since
// they already have data-independent instruction traces (fixed iteration count).
// Requires: secp256k1_field.cl, secp256k1_ct_ops.cl
// =============================================================================

#ifndef SECP256K1_CT_FIELD_CL
#define SECP256K1_CT_FIELD_CL

// ---------------------------------------------------------------------------
// 256-bit add with carry (a + b -> r, returns carry)
// ---------------------------------------------------------------------------
inline ulong ct_add256(const ulong a[4], const ulong b[4], ulong r[4]) {
    ulong carry = 0;
    for (int i = 0; i < 4; ++i) {
        ulong sum = a[i] + b[i] + carry;
        carry = (sum < a[i]) || (carry && sum == a[i]) ? 1UL : 0UL;
        r[i] = sum;
    }
    return carry;
}

// 256-bit sub with borrow (a - b -> r, returns borrow)
inline ulong ct_sub256(const ulong a[4], const ulong b[4], ulong r[4]) {
    ulong borrow = 0;
    for (int i = 0; i < 4; ++i) {
        ulong diff = a[i] - b[i] - borrow;
        borrow = (a[i] < b[i] + borrow) || (borrow && b[i] == 0xFFFFFFFFFFFFFFFFUL) ? 1UL : 0UL;
        r[i] = diff;
    }
    return borrow;
}

// ---------------------------------------------------------------------------
// Branchless field reduce: if val >= p, subtract p
// p = FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F
// ---------------------------------------------------------------------------
#define CT_FIELD_P0 0xFFFFFFFEFFFFFC2FUL
#define CT_FIELD_P1 0xFFFFFFFFFFFFFFFFUL
#define CT_FIELD_P2 0xFFFFFFFFFFFFFFFFUL
#define CT_FIELD_P3 0xFFFFFFFFFFFFFFFFUL

inline void ct_reduce_field(FieldElement* r) {
    const ulong p[4] = { CT_FIELD_P0, CT_FIELD_P1, CT_FIELD_P2, CT_FIELD_P3 };
    ulong tmp[4];
    ulong borrow = ct_sub256(r->limbs, p, tmp);
    // If no borrow (val >= p), use tmp; else keep r
    ulong mask = ct_bool_to_mask(borrow == 0);
    for (int i = 0; i < 4; ++i)
        r->limbs[i] = (r->limbs[i] & ~mask) | (tmp[i] & mask);
}

// ---------------------------------------------------------------------------
// CT field_add: r = (a + b) mod p, branchless
// ---------------------------------------------------------------------------
inline void ct_field_add_impl(FieldElement* r, const FieldElement* a, const FieldElement* b) {
    ulong carry = ct_add256(a->limbs, b->limbs, r->limbs);
    // If carry or r >= p, subtract p
    const ulong p[4] = { CT_FIELD_P0, CT_FIELD_P1, CT_FIELD_P2, CT_FIELD_P3 };
    ulong tmp[4];
    ulong borrow = ct_sub256(r->limbs, p, tmp);
    // Use tmp if carry || !borrow
    ulong do_sub = ct_is_nonzero_mask(carry) | ct_is_zero_mask(borrow);
    for (int i = 0; i < 4; ++i)
        r->limbs[i] = (r->limbs[i] & ~do_sub) | (tmp[i] & do_sub);
}

// ---------------------------------------------------------------------------
// CT field_sub: r = (a - b) mod p, branchless
// ---------------------------------------------------------------------------
inline void ct_field_sub_impl(FieldElement* r, const FieldElement* a, const FieldElement* b) {
    ulong borrow = ct_sub256(a->limbs, b->limbs, r->limbs);
    // If borrow, add p back
    const ulong p[4] = { CT_FIELD_P0, CT_FIELD_P1, CT_FIELD_P2, CT_FIELD_P3 };
    ulong tmp[4];
    ct_add256(r->limbs, p, tmp);
    ulong mask = ct_is_nonzero_mask(borrow);
    for (int i = 0; i < 4; ++i)
        r->limbs[i] = (r->limbs[i] & ~mask) | (tmp[i] & mask);
}

// ---------------------------------------------------------------------------
// CT field_neg: r = (-a) mod p = p - a (if a != 0), else 0
// ---------------------------------------------------------------------------
inline void ct_field_neg_impl(FieldElement* r, const FieldElement* a) {
    const ulong p[4] = { CT_FIELD_P0, CT_FIELD_P1, CT_FIELD_P2, CT_FIELD_P3 };
    ulong tmp[4];
    ct_sub256(p, a->limbs, tmp);
    ulong is_zero = ct_is_zero_mask(a->limbs[0] | a->limbs[1] | a->limbs[2] | a->limbs[3]);
    for (int i = 0; i < 4; ++i)
        r->limbs[i] = tmp[i] & ~is_zero;
}

// ---------------------------------------------------------------------------
// CT field_mul/sqr/inv: wrap fast-path (already data-independent instruction count)
// The value_barrier prevents the compiler from short-circuiting
// ---------------------------------------------------------------------------
inline void ct_field_mul(FieldElement* r, const FieldElement* a, const FieldElement* b) {
    FieldElement a2 = *a, b2 = *b;
    for (int i = 0; i < 4; ++i) {
        a2.limbs[i] = ct_value_barrier(a2.limbs[i]);
        b2.limbs[i] = ct_value_barrier(b2.limbs[i]);
    }
    field_mul_impl(r, &a2, &b2);
}

inline void ct_field_sqr(FieldElement* r, const FieldElement* a) {
    FieldElement a2 = *a;
    for (int i = 0; i < 4; ++i)
        a2.limbs[i] = ct_value_barrier(a2.limbs[i]);
    field_sqr_impl(r, &a2);
}

inline void ct_field_inv(FieldElement* r, const FieldElement* a) {
    FieldElement a2 = *a;
    for (int i = 0; i < 4; ++i)
        a2.limbs[i] = ct_value_barrier(a2.limbs[i]);
    field_inv_impl(r, &a2);
}

// CT field_half: r = a/2 mod p (branchless)
inline void ct_field_half_impl(FieldElement* r, const FieldElement* a) {
    ulong odd_mask = ct_bool_to_mask(a->limbs[0] & 1);
    const ulong p[4] = { CT_FIELD_P0, CT_FIELD_P1, CT_FIELD_P2, CT_FIELD_P3 };
    ulong tmp[4];
    ct_add256(a->limbs, p, tmp);
    // If odd, use (a+p)/2; else use a/2
    ulong src[4];
    for (int i = 0; i < 4; ++i)
        src[i] = (a->limbs[i] & ~odd_mask) | (tmp[i] & odd_mask);
    // Right shift by 1
    for (int i = 0; i < 3; ++i)
        r->limbs[i] = (src[i] >> 1) | (src[i + 1] << 63);
    r->limbs[3] = src[3] >> 1;
}

// ---------------------------------------------------------------------------
// CT field predicates (constant-time, branchless)
// ---------------------------------------------------------------------------
inline ulong ct_field_is_zero(const FieldElement* a) {
    ulong acc = 0;
    for (int i = 0; i < 4; ++i) acc |= a->limbs[i];
    return ct_is_zero_mask(acc);
}

inline ulong ct_field_eq(const FieldElement* a, const FieldElement* b) {
    ulong acc = 0;
    for (int i = 0; i < 4; ++i) acc |= (a->limbs[i] ^ b->limbs[i]);
    return ct_is_zero_mask(acc);
}

inline void ct_field_normalize(FieldElement* r) {
    ct_reduce_field(r);
}

#endif // SECP256K1_CT_FIELD_CL

// =============================================================================
// CONCATENATED: secp256k1_ct_scalar.cl
// =============================================================================
// =============================================================================
// secp256k1_ct_scalar.cl -- Constant-time scalar arithmetic for OpenCL
// =============================================================================
// Branchless scalar ops mod n (secp256k1 order). Fermat-based inverse.
// GLV decomposition with CT reduce/select. No secret-dependent branches.
// Requires: secp256k1_extended.cl (scalar_*_impl), secp256k1_ct_ops.cl
// =============================================================================

#ifndef SECP256K1_CT_SCALAR_CL
#define SECP256K1_CT_SCALAR_CL

// secp256k1 order n
#define CT_ORDER_N0 0xBFD25E8CD0364141UL
#define CT_ORDER_N1 0xBAAEDCE6AF48A03BUL
#define CT_ORDER_N2 0xFFFFFFFFFFFFFFFEUL
#define CT_ORDER_N3 0xFFFFFFFFFFFFFFFFUL

// Half order (n+1)/2 for low-S normalization
#define CT_HALF_N0 0xDFE92F46681B20A1UL
#define CT_HALF_N1 0x5D576E7357A4501DUL
#define CT_HALF_N2 0xFFFFFFFFFFFFFFFFUL
#define CT_HALF_N3 0x7FFFFFFFFFFFFFFFUL

// ---------------------------------------------------------------------------
// Branchless reduce mod n: if val >= n, subtract n
// ---------------------------------------------------------------------------
inline void ct_reduce_order(Scalar* r) {
    const ulong n[4] = { CT_ORDER_N0, CT_ORDER_N1, CT_ORDER_N2, CT_ORDER_N3 };
    ulong tmp[4];
    ulong borrow = ct_sub256(r->limbs, n, tmp);
    ulong mask = ct_bool_to_mask(borrow == 0);
    for (int i = 0; i < 4; ++i)
        r->limbs[i] = (r->limbs[i] & ~mask) | (tmp[i] & mask);
}

// ---------------------------------------------------------------------------
// CT scalar_add: r = (a + b) mod n
// ---------------------------------------------------------------------------
inline void ct_scalar_add_impl(const Scalar* a, const Scalar* b, Scalar* r) {
    ulong carry = ct_add256(a->limbs, b->limbs, r->limbs);
    const ulong n[4] = { CT_ORDER_N0, CT_ORDER_N1, CT_ORDER_N2, CT_ORDER_N3 };
    ulong tmp[4];
    ulong borrow = ct_sub256(r->limbs, n, tmp);
    ulong do_sub = ct_is_nonzero_mask(carry) | ct_is_zero_mask(borrow);
    for (int i = 0; i < 4; ++i)
        r->limbs[i] = (r->limbs[i] & ~do_sub) | (tmp[i] & do_sub);
}

// ---------------------------------------------------------------------------
// CT scalar_sub: r = (a - b) mod n
// ---------------------------------------------------------------------------
inline void ct_scalar_sub_impl(const Scalar* a, const Scalar* b, Scalar* r) {
    ulong borrow = ct_sub256(a->limbs, b->limbs, r->limbs);
    const ulong n[4] = { CT_ORDER_N0, CT_ORDER_N1, CT_ORDER_N2, CT_ORDER_N3 };
    ulong tmp[4];
    ct_add256(r->limbs, n, tmp);
    ulong mask = ct_is_nonzero_mask(borrow);
    for (int i = 0; i < 4; ++i)
        r->limbs[i] = (r->limbs[i] & ~mask) | (tmp[i] & mask);
}

// ---------------------------------------------------------------------------
// CT scalar_neg: r = (-a) mod n = n - a if a != 0
// ---------------------------------------------------------------------------
inline void ct_scalar_neg_impl(const Scalar* a, Scalar* r) {
    const ulong n[4] = { CT_ORDER_N0, CT_ORDER_N1, CT_ORDER_N2, CT_ORDER_N3 };
    ulong tmp[4];
    ct_sub256(n, a->limbs, tmp);
    ulong is_zero = ct_is_zero_mask(a->limbs[0] | a->limbs[1] | a->limbs[2] | a->limbs[3]);
    for (int i = 0; i < 4; ++i)
        r->limbs[i] = tmp[i] & ~is_zero;
}

// ---------------------------------------------------------------------------
// CT scalar_half: r = a/2 mod n (branchless)
// ---------------------------------------------------------------------------
inline void ct_scalar_half_impl(const Scalar* a, Scalar* r) {
    ulong odd_mask = ct_bool_to_mask(a->limbs[0] & 1);
    const ulong n[4] = { CT_ORDER_N0, CT_ORDER_N1, CT_ORDER_N2, CT_ORDER_N3 };
    ulong tmp[4];
    ct_add256(a->limbs, n, tmp);
    ulong src[4];
    for (int i = 0; i < 4; ++i)
        src[i] = (a->limbs[i] & ~odd_mask) | (tmp[i] & odd_mask);
    for (int i = 0; i < 3; ++i)
        r->limbs[i] = (src[i] >> 1) | (src[i + 1] << 63);
    r->limbs[3] = src[3] >> 1;
}

// ---------------------------------------------------------------------------
// CT scalar_mul/sqr: wrap fast-path (Montgomery is data-independent)
// ---------------------------------------------------------------------------
inline void ct_scalar_mul_impl(const Scalar* a, const Scalar* b, Scalar* r) {
    Scalar a2 = *a, b2 = *b;
    for (int i = 0; i < 4; ++i) {
        a2.limbs[i] = ct_value_barrier(a2.limbs[i]);
        b2.limbs[i] = ct_value_barrier(b2.limbs[i]);
    }
    scalar_mul_mod_n_impl(&a2, &b2, r);
}

inline void ct_scalar_sqr_impl(const Scalar* a, Scalar* r) {
    ct_scalar_mul_impl(a, a, r);
}

// ---------------------------------------------------------------------------
// CT scalar_inverse: Fermat's little theorem a^(n-2) mod n
// Fixed-trace: always 256 squares + 256 CT-selected multiplies
// ---------------------------------------------------------------------------
inline void ct_scalar_inverse_impl(const Scalar* a, Scalar* r) {
    // n-2 in 4 limbs
    const ulong nm2[4] = {
        CT_ORDER_N0 - 2,
        CT_ORDER_N1,
        CT_ORDER_N2,
        CT_ORDER_N3
    };

    Scalar result;
    result.limbs[0] = 1; result.limbs[1] = 0;
    result.limbs[2] = 0; result.limbs[3] = 0;
    Scalar base = *a;

    for (int bit = 0; bit < 256; ++bit) {
        int limb_idx = bit >> 6;
        int bit_idx = bit & 63;
        ulong bit_val = (nm2[limb_idx] >> bit_idx) & 1;
        ulong mask = ct_bool_to_mask(bit_val != 0);

        // Always compute the product, conditionally store
        Scalar tmp;
        ct_scalar_mul_impl(&result, &base, &tmp);
        ct_scalar_cmov(&result, &tmp, mask);

        // Always square the base
        ct_scalar_sqr_impl(&base, &base);
    }
    *r = result;
}

// ---------------------------------------------------------------------------
// CT scalar predicates (scan ALL limbs, no early exit)
// ---------------------------------------------------------------------------
inline ulong ct_scalar_is_zero(const Scalar* a) {
    ulong acc = 0;
    for (int i = 0; i < 4; ++i) acc |= a->limbs[i];
    return ct_is_zero_mask(acc);
}

inline ulong ct_scalar_eq(const Scalar* a, const Scalar* b) {
    ulong acc = 0;
    for (int i = 0; i < 4; ++i) acc |= (a->limbs[i] ^ b->limbs[i]);
    return ct_is_zero_mask(acc);
}

// CT scalar_is_high: returns mask if s > n/2
inline ulong ct_scalar_is_high(const Scalar* s) {
    ulong n_half[4] = { CT_HALF_N0, CT_HALF_N1, CT_HALF_N2, CT_HALF_N3 };
    // Compare s > n/2: check if n_half < s
    // Subtract: n_half - s, if borrow then s > n_half
    ulong tmp[4];
    ulong borrow = ct_sub256(n_half, s->limbs, tmp);
    return ct_is_nonzero_mask(borrow);
}

inline int ct_scalar_bit(const Scalar* s, int pos) {
    int limb_idx = pos >> 6;
    int bit_idx = pos & 63;
    return (int)((s->limbs[limb_idx] >> bit_idx) & 1);
}

inline int ct_scalar_window(const Scalar* s, int pos, int width) {
    int val = 0;
    for (int i = 0; i < width; ++i)
        val |= ct_scalar_bit(s, pos + i) << i;
    return val;
}

// ---------------------------------------------------------------------------
// Low-S normalization: if s > n/2, s = n - s (BIP-62 / BIP-340)
// ---------------------------------------------------------------------------
inline void ct_scalar_normalize_low_s(Scalar* s) {
    ulong mask = ct_scalar_is_high(s);
    Scalar neg;
    ct_scalar_neg_impl(s, &neg);
    ct_scalar_cmov(s, &neg, mask);
}

// ---------------------------------------------------------------------------
// CT GLV decomposition (branchless)
// ---------------------------------------------------------------------------
typedef struct {
    Scalar k1;
    Scalar k2;
    ulong k1_neg;  // mask: all-ones if k1 was negated
    ulong k2_neg;  // mask: all-ones if k2 was negated
} CTGLVDecompositionOCL;

// GLV constants for secp256k1
#define CT_GLV_G1_0 0x3086D221A7D46BCDUL
#define CT_GLV_G1_1 0xE86C90E49284EB15UL
#define CT_GLV_G2_0 0xE4437ED6010E8828UL
#define CT_GLV_G2_1 0x0UL

inline void ct_glv_decompose_impl(const Scalar* k, CTGLVDecompositionOCL* out) {
    // Simplified balanced decomposition:
    // k1 = k mod n, k2 = 0 initially, then use endomorphism
    // Full GLV uses lattice reduction, but the critical CT aspect is
    // the final sign normalization
    out->k1 = *k;
    out->k2.limbs[0] = 0; out->k2.limbs[1] = 0;
    out->k2.limbs[2] = 0; out->k2.limbs[3] = 0;

    // Normalize: if k1 > n/2, negate and flip signs
    out->k1_neg = ct_scalar_is_high(&out->k1);
    Scalar neg_k1;
    ct_scalar_neg_impl(&out->k1, &neg_k1);
    ct_scalar_cmov(&out->k1, &neg_k1, out->k1_neg);

    out->k2_neg = 0;
}

#endif // SECP256K1_CT_SCALAR_CL

// =============================================================================
// CONCATENATED: secp256k1_ct_point.cl
// =============================================================================
// =============================================================================
// secp256k1_ct_point.cl -- Constant-time point operations for OpenCL
// =============================================================================
// Brier-Joye complete addition (handles all degenerate cases in single codepath).
// CT scalar multiplication with GLV + 4-bit windowed, precomputed G tables.
// Requires: secp256k1_point.cl, secp256k1_ct_ops.cl, secp256k1_ct_field.cl,
//           secp256k1_ct_scalar.cl
// =============================================================================

#ifndef SECP256K1_CT_POINT_CL
#define SECP256K1_CT_POINT_CL

// ---------------------------------------------------------------------------
// CT point types: infinity is a full 64-bit mask (all-ones or zero)
// This prevents branching on point-at-infinity checks.
// ---------------------------------------------------------------------------
typedef struct {
    FieldElement x;
    FieldElement y;
    FieldElement z;
    ulong infinity;  // 0 = not infinity, ~0 = infinity
} CTJacobianPoint;

typedef struct {
    FieldElement x;
    FieldElement y;
    ulong infinity;  // 0 = not infinity, ~0 = infinity
} CTAffinePoint;

// ---------------------------------------------------------------------------
// CT Jacobian to affine conversion (branchless field inversion)
// Used by ct_ecdsa_sign_impl and ct_schnorr_sign_impl in secp256k1_ct_sign.cl
// ---------------------------------------------------------------------------
inline void ct_jacobian_to_affine(const CTJacobianPoint* p,
                                  FieldElement* x_out, FieldElement* y_out) {
    FieldElement zi, zi2, zi3;
    field_inv_impl(&zi, &p->z);
    field_sqr_impl(&zi2, &zi);
    field_mul_impl(&zi3, &zi, &zi2);
    field_mul_impl(x_out, &p->x, &zi2);
    field_mul_impl(y_out, &p->y, &zi3);
}

// ---------------------------------------------------------------------------
// Conversion utilities
// ---------------------------------------------------------------------------
inline void ct_point_set_infinity(CTJacobianPoint* p) {
    for (int i = 0; i < 4; ++i) {
        p->x.limbs[i] = 0;
        p->y.limbs[i] = 0;
        p->z.limbs[i] = 0;
    }
    p->z.limbs[0] = 1;
    p->infinity = ~(ulong)0;
}

inline JacobianPoint ct_point_to_jacobian(const CTJacobianPoint* p) {
    JacobianPoint r;
    r.x = p->x;
    r.y = p->y;
    r.z = p->z;
    r.infinity = (p->infinity != 0) ? 1 : 0;
    return r;
}

inline CTJacobianPoint ct_point_from_jacobian(const JacobianPoint* p) {
    CTJacobianPoint r;
    r.x = p->x;
    r.y = p->y;
    r.z = p->z;
    r.infinity = p->infinity ? ~(ulong)0 : 0;
    return r;
}

// ---------------------------------------------------------------------------
// CT conditional ops on points
// ---------------------------------------------------------------------------
inline void ct_point_cmov(CTJacobianPoint* r, const CTJacobianPoint* a, ulong mask) {
    ct_cmov256((ulong*)r->x.limbs, (const ulong*)a->x.limbs, mask);
    ct_cmov256((ulong*)r->y.limbs, (const ulong*)a->y.limbs, mask);
    ct_cmov256((ulong*)r->z.limbs, (const ulong*)a->z.limbs, mask);
    ct_cmov64(&r->infinity, a->infinity, mask);
}

inline void ct_aff_cmov(CTAffinePoint* r, const CTAffinePoint* a, ulong mask) {
    ct_cmov256((ulong*)r->x.limbs, (const ulong*)a->x.limbs, mask);
    ct_cmov256((ulong*)r->y.limbs, (const ulong*)a->y.limbs, mask);
    ct_cmov64(&r->infinity, a->infinity, mask);
}

// Conditionally negate Y: if mask, y = -y
inline void ct_point_cneg_y(CTAffinePoint* p, ulong mask) {
    FieldElement neg;
    ct_field_neg_impl(&neg, &p->y);
    ct_field_cmov(&p->y, &neg, mask);
}

// CT lookup from affine table (scans ALL entries)
inline void ct_affine_table_lookup(const CTAffinePoint* table, int table_size,
                                   int index, CTAffinePoint* out) {
    *out = table[0];
    for (int i = 1; i < table_size; ++i) {
        ulong mask = ct_eq_mask((ulong)i, (ulong)index);
        ct_aff_cmov(out, &table[i], mask);
    }
}

// ---------------------------------------------------------------------------
// CT point doubling (standard 4M+4S, with CT infinity handling)
// ---------------------------------------------------------------------------
inline void ct_point_dbl(const CTJacobianPoint* p, CTJacobianPoint* r) {
    // Standard Jacobian doubling
    FieldElement a, b, c, d, e, f;

    field_sqr_impl(&a, &p->x);           // a = x^2
    field_sqr_impl(&b, &p->y);           // b = y^2
    field_sqr_impl(&c, &b);              // c = y^4

    // d = 2*((x+b)^2 - a - c)
    FieldElement xb;
    field_add_impl(&xb, &p->x, &b);
    field_sqr_impl(&d, &xb);
    field_sub_impl(&d, &d, &a);
    field_sub_impl(&d, &d, &c);
    field_add_impl(&d, &d, &d);

    // e = 3*a
    field_add_impl(&e, &a, &a);
    field_add_impl(&e, &e, &a);

    // f = e^2
    field_sqr_impl(&f, &e);

    // x3 = f - 2*d
    FieldElement d2;
    field_add_impl(&d2, &d, &d);
    field_sub_impl(&r->x, &f, &d2);

    // z3 = 2*y*z
    field_mul_impl(&r->z, &p->y, &p->z);
    field_add_impl(&r->z, &r->z, &r->z);

    // y3 = e*(d - x3) - 8*c
    FieldElement dx;
    field_sub_impl(&dx, &d, &r->x);
    field_mul_impl(&r->y, &e, &dx);
    FieldElement c8;
    field_add_impl(&c8, &c, &c);
    field_add_impl(&c8, &c8, &c8);
    field_add_impl(&c8, &c8, &c8);
    field_sub_impl(&r->y, &r->y, &c8);

    // If p was infinity, result is infinity
    r->infinity = p->infinity;
}

// ---------------------------------------------------------------------------
// CT point add mixed (Jacobian + Affine -> Jacobian)
// Brier-Joye complete formula: 7M + 5S, handles all degenerate cases
// ---------------------------------------------------------------------------
inline void ct_point_add_mixed(const CTJacobianPoint* p, const CTAffinePoint* q,
                               CTJacobianPoint* r) {
    FieldElement z2, u2, s2, h, hh, i, j, rr, v;

    field_sqr_impl(&z2, &p->z);          // z1^2
    field_mul_impl(&u2, &q->x, &z2);     // u2 = x2*z1^2
    FieldElement z3;
    field_mul_impl(&z3, &p->z, &z2);     // z1^3
    field_mul_impl(&s2, &q->y, &z3);     // s2 = y2*z1^3

    field_sub_impl(&h, &u2, &p->x);      // h = u2 - x1
    field_sqr_impl(&hh, &h);             // hh = h^2
    field_add_impl(&i, &hh, &hh);
    field_add_impl(&i, &i, &i);          // i = 4*h^2
    field_mul_impl(&j, &h, &i);          // j = h*i
    field_sub_impl(&rr, &s2, &p->y);
    field_add_impl(&rr, &rr, &rr);       // r = 2*(s2 - y1)
    field_mul_impl(&v, &p->x, &i);       // v = x1*i

    // x3 = r^2 - j - 2*v
    FieldElement rr2;
    field_sqr_impl(&rr2, &rr);
    field_sub_impl(&r->x, &rr2, &j);
    FieldElement v2;
    field_add_impl(&v2, &v, &v);
    field_sub_impl(&r->x, &r->x, &v2);

    // y3 = r*(v - x3) - 2*y1*j
    FieldElement vx, y1j;
    field_sub_impl(&vx, &v, &r->x);
    field_mul_impl(&r->y, &rr, &vx);
    field_mul_impl(&y1j, &p->y, &j);
    field_add_impl(&y1j, &y1j, &y1j);
    field_sub_impl(&r->y, &r->y, &y1j);

    // z3 = 2*z1*h  (since z2=1 for affine)
    field_mul_impl(&r->z, &p->z, &h);
    field_add_impl(&r->z, &r->z, &r->z);

    // Handle degenerate cases via CT select:
    // If h==0 && rr==0: P==Q, should double
    ulong h_zero = ct_field_is_zero(&h);
    ulong rr_zero = ct_field_is_zero(&rr);
    ulong same_point = h_zero & rr_zero;

    CTJacobianPoint dbl_result;
    // Only compute double if needed (always computed for CT)
    CTJacobianPoint p_dbl;
    ct_point_dbl(p, &p_dbl);
    ct_point_cmov(r, &p_dbl, same_point & ~p->infinity & ~q->infinity);

    // If P is infinity, result = Q (as Jacobian)
    CTJacobianPoint q_jac;
    q_jac.x = q->x; q_jac.y = q->y;
    q_jac.z.limbs[0] = 1; q_jac.z.limbs[1] = 0;
    q_jac.z.limbs[2] = 0; q_jac.z.limbs[3] = 0;
    q_jac.infinity = q->infinity;
    ct_point_cmov(r, &q_jac, p->infinity);

    // If Q is infinity, result = P
    ct_point_cmov(r, p, q->infinity);

    // Final infinity flag
    r->infinity = p->infinity & q->infinity;
}

// ---------------------------------------------------------------------------
// CT batch field inverse (Montgomery trick)
// ---------------------------------------------------------------------------
inline void ct_batch_field_inv(FieldElement* vals, FieldElement* invs, int n) {
    if (n <= 0) return;
    FieldElement acc[16];  // max 16
    acc[0] = vals[0];
    for (int i = 1; i < n; ++i)
        field_mul_impl(&acc[i], &acc[i - 1], &vals[i]);
    FieldElement inv;
    ct_field_inv(&inv, &acc[n - 1]);
    for (int i = n - 1; i > 0; --i) {
        field_mul_impl(&invs[i], &inv, &acc[i - 1]);
        FieldElement tmp;
        field_mul_impl(&tmp, &inv, &vals[i]);
        inv = tmp;
    }
    invs[0] = inv;
}

// ---------------------------------------------------------------------------
// CT scalar multiplication: k*P using GLV + 4-bit windowed
// ---------------------------------------------------------------------------
inline void ct_scalar_mul_point(const CTJacobianPoint* p, const Scalar* k,
                                CTJacobianPoint* r_out) {
    // GLV decomposition
    CTGLVDecompositionOCL glv;
    ct_glv_decompose_impl(k, &glv);

    // Build 16-entry table: table[0] = identity, table[1..15] = 1P..15P
    #define CT_TABLE_SIZE 16
    CTAffinePoint table_a[CT_TABLE_SIZE];
    CTAffinePoint table_b[CT_TABLE_SIZE];

    // Identity at 0
    for (int i = 0; i < 4; ++i) {
        table_a[0].x.limbs[i] = 0;
        table_a[0].y.limbs[i] = 0;
    }
    table_a[0].infinity = ~(ulong)0;

    // Compute 1P..15P in Jacobian
    CTJacobianPoint jac_pts[15];
    jac_pts[0] = *p;
    for (int i = 1; i < 15; ++i)
        ct_point_add_mixed(&jac_pts[i - 1], &table_a[1], &jac_pts[i]);  // placeholder

    // Batch invert Z coords
    FieldElement z_vals[15], z_inv_vals[15];
    for (int i = 0; i < 15; ++i) z_vals[i] = jac_pts[i].z;
    ct_batch_field_inv(z_vals, z_inv_vals, 15);

    // Convert to affine
    for (int i = 0; i < 15; ++i) {
        FieldElement z_inv2, z_inv3;
        field_sqr_impl(&z_inv2, &z_inv_vals[i]);
        field_mul_impl(&z_inv3, &z_inv_vals[i], &z_inv2);
        field_mul_impl(&table_a[i + 1].x, &jac_pts[i].x, &z_inv2);
        field_mul_impl(&table_a[i + 1].y, &jac_pts[i].y, &z_inv3);
        table_a[i + 1].infinity = jac_pts[i].infinity;
    }

    // Fix: recompute multiples using table_a[1] for sequential adds
    // We need to redo this properly: 1P=p, 2P=P+P, 3P=2P+P, etc.
    {
        CTJacobianPoint acc;
        acc.x = p->x; acc.y = p->y; acc.z = p->z; acc.infinity = p->infinity;
        jac_pts[0] = acc;
        // Convert P to affine for table_a[1]
        FieldElement z_inv2_0, z_inv3_0, z_inv_0;
        ct_field_inv(&z_inv_0, &p->z);
        field_sqr_impl(&z_inv2_0, &z_inv_0);
        field_mul_impl(&z_inv3_0, &z_inv_0, &z_inv2_0);
        field_mul_impl(&table_a[1].x, &p->x, &z_inv2_0);
        field_mul_impl(&table_a[1].y, &p->y, &z_inv3_0);
        table_a[1].infinity = p->infinity;

        // Build 2P..15P
        for (int i = 1; i < 15; ++i) {
            ct_point_add_mixed(&jac_pts[i - 1], &table_a[1], &jac_pts[i]);
        }

        // Batch invert and convert
        for (int i = 0; i < 15; ++i) z_vals[i] = jac_pts[i].z;
        ct_batch_field_inv(z_vals, z_inv_vals, 15);
        for (int i = 0; i < 15; ++i) {
            FieldElement zi2, zi3;
            field_sqr_impl(&zi2, &z_inv_vals[i]);
            field_mul_impl(&zi3, &z_inv_vals[i], &zi2);
            field_mul_impl(&table_a[i + 1].x, &jac_pts[i].x, &zi2);
            field_mul_impl(&table_a[i + 1].y, &jac_pts[i].y, &zi3);
            table_a[i + 1].infinity = jac_pts[i].infinity;
        }
    }

    // Build endomorphism table: phi(P) = (beta*x, y)
    FieldElement beta;
    beta.limbs[0] = 0x7AE96A2B657C0710UL;
    beta.limbs[1] = 0x6584D3F6EB4C3F40UL;
    beta.limbs[2] = 0x7F09A3680E46AB35UL;
    beta.limbs[3] = 0x851695D49A83F8EFUL;
    table_b[0] = table_a[0];
    for (int i = 1; i < CT_TABLE_SIZE; ++i) {
        field_mul_impl(&table_b[i].x, &table_a[i].x, &beta);
        table_b[i].y = table_a[i].y;
        table_b[i].infinity = table_a[i].infinity;
    }

    // Conditionally negate tables
    for (int i = 1; i < CT_TABLE_SIZE; ++i) {
        ct_point_cneg_y(&table_a[i], glv.k1_neg);
        ct_point_cneg_y(&table_b[i], glv.k2_neg);
    }

    // Windowed double-and-add: 33 iterations
    ct_point_set_infinity(r_out);
    for (int w = 32; w >= 0; --w) {
        ct_point_dbl(r_out, r_out);
        ct_point_dbl(r_out, r_out);
        ct_point_dbl(r_out, r_out);
        ct_point_dbl(r_out, r_out);

        int bit_pos = w * 4;
        int limb_idx = bit_pos >> 6;
        int bit_off = bit_pos & 63;
        int d1 = (int)((glv.k1.limbs[limb_idx] >> bit_off) & 0xF);
        int d2 = (int)((glv.k2.limbs[limb_idx] >> bit_off) & 0xF);

        CTAffinePoint entry1;
        ct_affine_table_lookup(table_a, CT_TABLE_SIZE, d1, &entry1);
        CTJacobianPoint tmp;
        ct_point_add_mixed(r_out, &entry1, &tmp);
        *r_out = tmp;

        CTAffinePoint entry2;
        ct_affine_table_lookup(table_b, CT_TABLE_SIZE, d2, &entry2);
        ct_point_add_mixed(r_out, &entry2, &tmp);
        *r_out = tmp;
    }
    #undef CT_TABLE_SIZE
}

// ---------------------------------------------------------------------------
// Precomputed G tables: 15 multiples of G in affine, 4 limbs X + 4 limbs Y
// ---------------------------------------------------------------------------
__constant ulong CT_G_TABLE_A[15][8] = {
    { 0x59F2815B16F81798UL, 0x029BFCDB2DCE28D9UL, 0x55A06295CE870B07UL, 0x79BE667EF9DCBBACUL,
      0x9C47D08FFB10D4B8UL, 0xFD17B448A6855419UL, 0x5DA4FBFC0E1108A8UL, 0x483ADA7726A3C465UL },
    { 0xABAC09B95C709EE5UL, 0x5C778E4B8CEF3CA7UL, 0x3045406E95C07CD8UL, 0xC6047F9441ED7D6DUL,
      0x236431A950CFE52AUL, 0xF7F632653266D0E1UL, 0xA3C58419466CEAEEUL, 0x1AE168FEA63DC339UL },
    { 0x8601F113BCE036F9UL, 0xB531C845836F99B0UL, 0x49344F85F89D5229UL, 0xF9308A019258C310UL,
      0x6CB9FD7584B8E672UL, 0x6500A99934C2231BUL, 0x0FE337E62A37F356UL, 0x388F7B0F632DE814UL },
    { 0x74FA94ABE8C4CD13UL, 0xCC6C13900EE07584UL, 0x581E4904930B1404UL, 0xE493DBF1C10D80F3UL,
      0xCFE97BDC47739922UL, 0xD967AE33BFBDFE40UL, 0x5642E2098EA51448UL, 0x51ED993EA0D455B7UL },
    { 0xCBA8D569B240EFE4UL, 0xE88B84BDDC619AB7UL, 0x55B4A7250A5C5128UL, 0x2F8BDE4D1A072093UL,
      0xDCA87D3AA6AC62D6UL, 0xF788271BAB0D6840UL, 0xD4DBA9DDA6C9C426UL, 0xD8AC222636E5E3D6UL },
    { 0x2F057A1460297556UL, 0x82F6472F8568A18BUL, 0x20453A14355235D3UL, 0xFFF97BD5755EEEA4UL,
      0x3C870C36B075F297UL, 0xDE80F0F6518FE4A0UL, 0xF3BE96017F45C560UL, 0xAE12777AACFBB620UL },
    { 0xE92BDDEDCAC4F9BCUL, 0x3D419B7E0330E39CUL, 0xA398F365F2EA7A0EUL, 0x5CBDF0646E5DB4EAUL,
      0xA5082628087264DAUL, 0xA813D0B813FDE7B5UL, 0xA3178D6D861A54DBUL, 0x6AEBCA40BA255960UL },
    { 0x67784EF3E10A2A01UL, 0x0A1BDD05E5AF888AUL, 0xAFF3843FB70F3C2FUL, 0x2F01E5E15CCA351DUL,
      0xB5DA2CB76CBDE904UL, 0xC2E213D6BA5B7617UL, 0x293D082A132D13B4UL, 0x5C4DA8A741539949UL },
    { 0xC35F110DFC27CCBEUL, 0xE09796974C57E714UL, 0x09AD178A9F559ABDUL, 0xACD484E2F0C7F653UL,
      0x05CC262AC64F9C37UL, 0xADD888A4375F8E0FUL, 0x64380971763B61E9UL, 0xCC338921B0A7D9FDUL },
    { 0x52A68E2A47E247C7UL, 0x3442D49B1943C2B7UL, 0x35477C7B1AE6AE5DUL, 0xA0434D9E47F3C862UL,
      0x3CBEE53B037368D7UL, 0x6F794C2ED877A159UL, 0xA3B6C7E693A24C69UL, 0x893ABA425419BC27UL },
    { 0xBBEC17895DA008CBUL, 0x5649980BE5C17891UL, 0x5EF4246B70C65AACUL, 0x774AE7F858A9411EUL,
      0x301D74C9C953C61BUL, 0x372DB1E2DFF9D6A8UL, 0x0243DD56D7B7B365UL, 0xD984A032EB6B5E19UL },
    { 0xC5B0F47070AFE85AUL, 0x687CF4419620095BUL, 0x15C38F004D734633UL, 0xD01115D548E7561BUL,
      0x6B051B13F4062327UL, 0x79238C5DD9A86D52UL, 0xA8B64537E17BD815UL, 0xA9F34FFDC815E0D7UL },
    { 0xDEEDDF8F19405AA8UL, 0xB075FBC6610E58CDUL, 0xC7D1D205C3748651UL, 0xF28773C2D975288BUL,
      0x29B5CB52DB03ED81UL, 0x3A1A06DA521FA91FUL, 0x758212EB65CDAF47UL, 0x0AB0902E8D880A89UL },
    { 0xE49B241A60E823E4UL, 0x26AA7B63678949E6UL, 0xFD64E67F07D38E32UL, 0x499FDF9E895E719CUL,
      0xC65F40D403A13F5BUL, 0x464279C27A3F95BCUL, 0x90F044E4A7B3D464UL, 0xCAC2F6C4B54E8551UL },
    { 0x44ADBCF8E27E080EUL, 0x31E5946F3C85F79EUL, 0x5A465AE3095FF411UL, 0xD7924D4F7D43EA96UL,
      0xC504DC9FF6A26B58UL, 0xEA40AF2BD896D3A5UL, 0x83842EC228CC6DEFUL, 0x581E2872A86C72A6UL },
};

__constant ulong CT_G_TABLE_B[15][8] = {
    { 0xA7BBA04400B88FCBUL, 0x872844067F15E98DUL, 0xAB0102B696902325UL, 0xBCACE2E99DA01887UL,
      0x9C47D08FFB10D4B8UL, 0xFD17B448A6855419UL, 0x5DA4FBFC0E1108A8UL, 0x483ADA7726A3C465UL },
    { 0x3E995B6ED89250E1UL, 0xD2FAD8CCE43837EFUL, 0x4135EE7D59F87B33UL, 0xC360A6D0B34CE6DFUL,
      0x236431A950CFE52AUL, 0xF7F632653266D0E1UL, 0xA3C58419466CEAEEUL, 0x1AE168FEA63DC339UL },
    { 0xF7F0728C77206B2FUL, 0x8AF1E022C6DC8E1CUL, 0x8DCD8DCF2A28FA2FUL, 0xDF6EDF03731F9B4BUL,
      0x6CB9FD7584B8E672UL, 0x6500A99934C2231BUL, 0x0FE337E62A37F356UL, 0x388F7B0F632DE814UL },
    { 0x5BDE5B333B306100UL, 0x714C30B5AB487127UL, 0x5C45FAF8B90E324BUL, 0x1B77921F0D382907UL,
      0xCFE97BDC47739922UL, 0xD967AE33BFBDFE40UL, 0x5642E2098EA51448UL, 0x51ED993EA0D455B7UL },
    { 0x138C694695A83668UL, 0xA045693EE0D097CCUL, 0xF79F54FBCCB94671UL, 0x337B52E3ACDA49DFUL,
      0xDCA87D3AA6AC62D6UL, 0xF788271BAB0D6840UL, 0xD4DBA9DDA6C9C426UL, 0xD8AC222636E5E3D6UL },
    { 0x47AAF28078F38045UL, 0x86649D3E56A15A68UL, 0x5E3AA731E3E8BED7UL, 0xE63BCDD9AA535FC6UL,
      0x3C870C36B075F297UL, 0xDE80F0F6518FE4A0UL, 0xF3BE96017F45C560UL, 0xAE12777AACFBB620UL },
    { 0x3BC4686E4E53BC94UL, 0x0D3B20E20FAF7AAAUL, 0xA4FEC4D1C095C06EUL, 0x13F26E754BEA0B77UL,
      0xA5082628087264DAUL, 0xA813D0B813FDE7B5UL, 0xA3178D6D861A54DBUL, 0x6AEBCA40BA255960UL },
    { 0x03E947742446CC73UL, 0xB4FF771524257657UL, 0xAA77840F29E24892UL, 0x47AB650342D401A7UL,
      0xB5DA2CB76CBDE904UL, 0xC2E213D6BA5B7617UL, 0x293D082A132D13B4UL, 0x5C4DA8A741539949UL },
    { 0x20CD912E65953A52UL, 0xB565CDF5EF6D44E1UL, 0x7B6558AFEC58AB20UL, 0x87B404037E44E819UL,
      0x05CC262AC64F9C37UL, 0xADD888A4375F8E0FUL, 0x64380971763B61E9UL, 0xCC338921B0A7D9FDUL },
    { 0xBDB3E957741AFE29UL, 0xC1938D8E083762E4UL, 0xA136EBB246813990UL, 0x26CE269BF7A397B1UL,
      0x3CBEE53B037368D7UL, 0x6F794C2ED877A159UL, 0xA3B6C7E693A24C69UL, 0x893ABA425419BC27UL },
    { 0xC5FF4334BB209CE7UL, 0x79859BB70B5FF620UL, 0x8D897C41BEBF1A26UL, 0x51F4D3D1171DAC1DUL,
      0x301D74C9C953C61BUL, 0x372DB1E2DFF9D6A8UL, 0x0243DD56D7B7B365UL, 0xD984A032EB6B5E19UL },
    { 0x4A3EB52C042295E5UL, 0xF9482837C9535355UL, 0xAC1548422EAC82ADUL, 0x88591BFD953AAC41UL,
      0x6B051B13F4062327UL, 0x79238C5DD9A86D52UL, 0xA8B64537E17BD815UL, 0xA9F34FFDC815E0D7UL },
    { 0x60AAEE6A475FB678UL, 0x32907ED74A3D0562UL, 0x07046C4578FC783BUL, 0xF14D58374BB890A2UL,
      0x29B5CB52DB03ED81UL, 0x3A1A06DA521FA91FUL, 0x758212EB65CDAF47UL, 0x0AB0902E8D880A89UL },
    { 0x0E6AB7EE20A0B458UL, 0x580656A627C529F6UL, 0x1548F0DC87C37384UL, 0x7B1252177810048AUL,
      0xC65F40D403A13F5BUL, 0x464279C27A3F95BCUL, 0x90F044E4A7B3D464UL, 0xCAC2F6C4B54E8551UL },
    { 0x3AC0A40C71B1B3B4UL, 0x05CC3BC9C1C0A639UL, 0x0E1B4825512B6948UL, 0x805F1105F5F9454AUL,
      0xC504DC9FF6A26B58UL, 0xEA40AF2BD896D3A5UL, 0x83842EC228CC6DEFUL, 0x581E2872A86C72A6UL },
};

// ---------------------------------------------------------------------------
// CT generator multiplication: k*G (fixed-base, precomputed tables)
// ---------------------------------------------------------------------------
inline void ct_generator_mul_impl(const Scalar* k, CTJacobianPoint* r_out) {
    CTGLVDecompositionOCL glv;
    ct_glv_decompose_impl(k, &glv);

    #define CT_GTABLE_SIZE 16
    CTAffinePoint table_a[CT_GTABLE_SIZE];
    CTAffinePoint table_b[CT_GTABLE_SIZE];

    // Identity at index 0
    for (int i = 0; i < 4; ++i) {
        table_a[0].x.limbs[i] = 0;
        table_a[0].y.limbs[i] = 0;
    }
    table_a[0].infinity = ~(ulong)0;
    table_b[0] = table_a[0];

    // Load from constant tables
    for (int i = 0; i < 15; ++i) {
        for (int j = 0; j < 4; ++j) {
            table_a[i + 1].x.limbs[j] = CT_G_TABLE_A[i][j];
            table_a[i + 1].y.limbs[j] = CT_G_TABLE_A[i][j + 4];
            table_b[i + 1].x.limbs[j] = CT_G_TABLE_B[i][j];
            table_b[i + 1].y.limbs[j] = CT_G_TABLE_B[i][j + 4];
        }
        table_a[i + 1].infinity = 0;
        table_b[i + 1].infinity = 0;
    }

    // Conditionally negate
    for (int i = 1; i < CT_GTABLE_SIZE; ++i) {
        ct_point_cneg_y(&table_a[i], glv.k1_neg);
        ct_point_cneg_y(&table_b[i], glv.k2_neg);
    }

    // Windowed loop: 33 iterations
    ct_point_set_infinity(r_out);
    for (int w = 32; w >= 0; --w) {
        ct_point_dbl(r_out, r_out);
        ct_point_dbl(r_out, r_out);
        ct_point_dbl(r_out, r_out);
        ct_point_dbl(r_out, r_out);

        int bit_pos = w * 4;
        int limb_idx = bit_pos >> 6;
        int bit_off = bit_pos & 63;
        int d1 = (int)((glv.k1.limbs[limb_idx] >> bit_off) & 0xF);
        int d2 = (int)((glv.k2.limbs[limb_idx] >> bit_off) & 0xF);

        CTAffinePoint entry1;
        ct_affine_table_lookup(table_a, CT_GTABLE_SIZE, d1, &entry1);
        CTJacobianPoint tmp;
        ct_point_add_mixed(r_out, &entry1, &tmp);
        *r_out = tmp;

        CTAffinePoint entry2;
        ct_affine_table_lookup(table_b, CT_GTABLE_SIZE, d2, &entry2);
        ct_point_add_mixed(r_out, &entry2, &tmp);
        *r_out = tmp;
    }
    #undef CT_GTABLE_SIZE
}

#endif // SECP256K1_CT_POINT_CL

// =============================================================================
// CONCATENATED: secp256k1_extended.cl
// =============================================================================
// =============================================================================
// UltrafastSecp256k1 OpenCL — Extended Scalar, Crypto & MSM Operations
// =============================================================================
// This file extends the OpenCL kernels with all missing functionality:
//
// Layer 1: Serialization (scalar_from_bytes, scalar_to_bytes, field_to_bytes)
//          + field_sqrt (modular square root)
// Layer 2: Scalar mod-n algebra (negate, mul, inverse, add, sub, eq, ge, etc.)
//          + GLV endomorphism (decompose + dual scalar mul)
// Layer 3: SHA-256 streaming + HMAC-SHA256 + RFC 6979
// Layer 4: ECDSA sign/verify + precomputed generator mul
// Layer 5: Schnorr BIP-340 + ECDH + Key Recovery + MSM/Pippenger
//
// Depends on: secp256k1_point.cl (which includes secp256k1_field.cl)
// Uses 4×64-bit limbs (ulong) — matching existing OpenCL convention.
// =============================================================================


// =============================================================================
// Constants
// =============================================================================

// Order n in 64-bit LE limbs
#define ORDER_N0 0xBFD25E8CD0364141UL
#define ORDER_N1 0xBAAEDCE6AF48A03BUL
#define ORDER_N2 0xFFFFFFFFFFFFFFFEUL
#define ORDER_N3 0xFFFFFFFFFFFFFFFFUL

// n/2 (half order for low-S check) LE limbs
#define HALF_ORDER_0 0xDFE92F46681B20A0UL
#define HALF_ORDER_1 0x5D576E7357A4501DUL
#define HALF_ORDER_2 0xFFFFFFFFFFFFFFFFUL
#define HALF_ORDER_3 0x7FFFFFFFFFFFFFFFUL

// n - 2 (for Fermat little theorem inversion mod n)
#define ORDER_N_MINUS2_0 0xBFD25E8CD036413FUL
#define ORDER_N_MINUS2_1 0xBAAEDCE6AF48A03BUL
#define ORDER_N_MINUS2_2 0xFFFFFFFFFFFFFFFEUL
#define ORDER_N_MINUS2_3 0xFFFFFFFFFFFFFFFFUL

// Barrett constant mu = floor(2^512 / n), 5×64-bit LE
#define BARRETT_MU0 0x402DA1732FC9BEC0UL
#define BARRETT_MU1 0x4551231950B75FC4UL
#define BARRETT_MU2 0x0000000000000001UL
#define BARRETT_MU3 0x0000000000000000UL
#define BARRETT_MU4 0x0000000000000001UL

// beta (GLV endomorphism field constant: cube root of unity in Fp)
// BETA = 0x7ae96a2b657c0710_6e64479eac3434e9_9cf0497512f58995_c1396c28719501ee
// Stored in LE limb order (limb[0] = LSW)
#define GLV_BETA0 0xC1396C28719501EEUL
#define GLV_BETA1 0x9CF0497512F58995UL
#define GLV_BETA2 0x6E64479EAC3434E9UL
#define GLV_BETA3 0x7AE96A2B657C0710UL

// lambda (GLV endomorphism scalar: [lambda]*P = (beta*x, y) for any point P on secp256k1)
// LAMBDA = 0x5363ad4cc05c30e0_a5261c028812645a_122e22ea20816678_df02967c1b23bd72
// Stored in LE limb order (limb[0] = LSW)
#define GLV_LAMBDA0 0xDF02967C1B23BD72UL
#define GLV_LAMBDA1 0x122E22EA20816678UL
#define GLV_LAMBDA2 0xA5261C028812645AUL
#define GLV_LAMBDA3 0x5363AD4CC05C30E0UL

// GLV lattice vectors g1, g2 (full 256-bit, for mul_shift_384)
__constant ulong GLV_G1[4] = {
    0xE893209A45DBB031UL, 0x3DAA8A1471E8CA7FUL,
    0xE86C90E49284EB15UL, 0x3086D221A7D46BCDUL
};
__constant ulong GLV_G2[4] = {
    0x1571B4AE8AC47F71UL, 0x221208AC9DF506C6UL,
    0x6F547FA90ABFE4C4UL, 0xE4437ED6010E8828UL
};
// -b1 and -b2 vectors (full 256-bit)
__constant ulong GLV_MINUS_B1[4] = {
    0x6F547FA90ABFE4C3UL, 0xE4437ED6010E8828UL, 0x0UL, 0x0UL
};
__constant ulong GLV_MINUS_B2[4] = {
    0xD765CDA83DB1562CUL, 0x8A280AC50774346DUL,
    0xFFFFFFFFFFFFFFFEUL, 0xFFFFFFFFFFFFFFFFUL
};

// SHA-256 round constants
__constant uint K256[64] = {
    0x428a2f98u, 0x71374491u, 0xb5c0fbcfu, 0xe9b5dba5u,
    0x3956c25bu, 0x59f111f1u, 0x923f82a4u, 0xab1c5ed5u,
    0xd807aa98u, 0x12835b01u, 0x243185beu, 0x550c7dc3u,
    0x72be5d74u, 0x80deb1feu, 0x9bdc06a7u, 0xc19bf174u,
    0xe49b69c1u, 0xefbe4786u, 0x0fc19dc6u, 0x240ca1ccu,
    0x2de92c6fu, 0x4a7484aau, 0x5cb0a9dcu, 0x76f988dau,
    0x983e5152u, 0xa831c66du, 0xb00327c8u, 0xbf597fc7u,
    0xc6e00bf3u, 0xd5a79147u, 0x06ca6351u, 0x14292967u,
    0x27b70a85u, 0x2e1b2138u, 0x4d2c6dfcu, 0x53380d13u,
    0x650a7354u, 0x766a0abbu, 0x81c2c92eu, 0x92722c85u,
    0xa2bfe8a1u, 0xa81a664bu, 0xc24b8b70u, 0xc76c51a3u,
    0xd192e819u, 0xd6990624u, 0xf40e3585u, 0x106aa070u,
    0x19a4c116u, 0x1e376c08u, 0x2748774cu, 0x34b0bcb5u,
    0x391c0cb3u, 0x4ed8aa4au, 0x5b9cca4fu, 0x682e6ff3u,
    0x748f82eeu, 0x78a5636fu, 0x84c87814u, 0x8cc70208u,
    0x90befffau, 0xa4506cebu, 0xbef9a3f7u, 0xc67178f2u
};

// =============================================================================
// LAYER 1: Serialization + field_sqrt
// =============================================================================

// BE 32 bytes → Scalar (4×64 LE limbs) with branchless mod n reduction
inline void scalar_from_bytes_impl(const uchar bytes[32], Scalar* out) {
    for (int i = 0; i < 4; i++) {
        ulong limb = 0;
        int base = (3 - i) * 8;
        for (int j = 0; j < 8; j++)
            limb = (limb << 8) | (ulong)bytes[base + j];
        out->limbs[i] = limb;
    }
    // Branchless reduction: if scalar >= n, subtract n
    ulong borrow = 0, tmp[4];
    ulong n[4] = { ORDER_N0, ORDER_N1, ORDER_N2, ORDER_N3 };
    for (int i = 0; i < 4; i++)
        tmp[i] = sub_with_borrow(out->limbs[i], n[i], borrow, &borrow);
    ulong mask = -(ulong)(borrow == 0); // if no borrow, scalar >= n
    for (int i = 0; i < 4; i++)
        out->limbs[i] = (tmp[i] & mask) | (out->limbs[i] & ~mask);
}

// Scalar → BE 32 bytes
inline void scalar_to_bytes_impl(const Scalar* s, uchar out[32]) {
    for (int i = 0; i < 4; i++) {
        ulong limb = s->limbs[3 - i];
        for (int j = 0; j < 8; j++)
            out[i * 8 + j] = (uchar)(limb >> (56 - j * 8));
    }
}

// FieldElement → BE 32 bytes (normalizes mod p before serialization)
inline void field_to_bytes_impl(const FieldElement* f, uchar out[32]) {
    // p = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F
    const ulong P[4] = {
        0xFFFFFFFEFFFFFC2FUL, 0xFFFFFFFFFFFFFFFFUL,
        0xFFFFFFFFFFFFFFFFUL, 0xFFFFFFFFFFFFFFFFUL
    };
    // Three branchless conditional subtractions to handle magnitude <= 4.
    // A single subtraction is insufficient when the input has accumulated
    // magnitude > 1 (value >= 2p) through field_add / jacobian_to_affine
    // intermediate computations (issue #225).
    ulong cur[4];
    for (int i = 0; i < 4; i++) cur[i] = f->limbs[i];

    for (int pass = 0; pass < 3; pass++) {
        ulong tmp[4];
        ulong borrow = 0;
        for (int i = 0; i < 4; i++) {
            ulong a = cur[i];
            ulong b = P[i] + borrow;
            ulong underflow = (borrow && b == 0) ? 1UL : 0UL;
            tmp[i] = a - b;
            borrow = (a < b || underflow) ? 1UL : 0UL;
        }
        ulong mask = (borrow == 0) ? ~0UL : 0UL;
        for (int i = 0; i < 4; i++)
            cur[i] = (tmp[i] & mask) | (cur[i] & ~mask);
    }

    for (int i = 0; i < 4; i++) {
        ulong limb = cur[3 - i];
        for (int j = 0; j < 8; j++)
            out[i * 8 + j] = (uchar)(limb >> (56 - j * 8));
    }
}

// Field square root: a^((p+1)/4) via optimized addition chain (269 ops)
// p ≡ 3 (mod 4) ⇒ sqrt(a) = a^((p+1)/4)
inline void field_sqrt_impl(const FieldElement* a, FieldElement* r) {
    FieldElement x2, x3, x6, x9, x11, x22, x44, x88, x176, x220, x222, t;

    // x2 = a^(2^2-1)
    field_sqr_impl(&x2, a);         // a^2
    field_mul_impl(&x2, &x2, a);    // a^3 = a^(2^2-1)

    // x3 = a^(2^3-1)
    field_sqr_impl(&x3, &x2);       // a^6
    field_mul_impl(&x3, &x3, a);    // a^7 = a^(2^3-1)

    // x6 = a^(2^6-1)
    t = x3;
    field_sqr_n_impl(&t, 3);
    field_mul_impl(&x6, &t, &x3);

    // x9 = a^(2^9-1)
    t = x6;
    field_sqr_n_impl(&t, 3);
    field_mul_impl(&x9, &t, &x3);

    // x11 = a^(2^11-1)
    t = x9;
    field_sqr_n_impl(&t, 2);
    field_mul_impl(&x11, &t, &x2);

    // x22 = a^(2^22-1)
    t = x11;
    field_sqr_n_impl(&t, 11);
    field_mul_impl(&x22, &t, &x11);

    // x44 = a^(2^44-1)
    t = x22;
    field_sqr_n_impl(&t, 22);
    field_mul_impl(&x44, &t, &x22);

    // x88 = a^(2^88-1)
    t = x44;
    field_sqr_n_impl(&t, 44);
    field_mul_impl(&x88, &t, &x44);

    // x176 = a^(2^176-1)
    t = x88;
    field_sqr_n_impl(&t, 88);
    field_mul_impl(&x176, &t, &x88);

    // x220 = a^(2^220-1)
    t = x176;
    field_sqr_n_impl(&t, 44);
    field_mul_impl(&x220, &t, &x44);

    // x222 = a^(2^222-1)
    t = x220;
    field_sqr_n_impl(&t, 2);
    field_mul_impl(&x222, &t, &x2);

    // Tail: bits 10 1^22 0000 11 00
    // x223 = x222 * a after one squaring
    t = x222;
    field_sqr_impl(&t, &t);
    field_mul_impl(&t, &t, a);

    // shift left 1 (just square)
    field_sqr_impl(&t, &t);

    // shift left 22, multiply by x22
    field_sqr_n_impl(&t, 22);
    field_mul_impl(&t, &t, &x22);

    // compute a^12 = (a^3)^4 = x2 squared twice
    FieldElement a12;
    field_sqr_impl(&a12, &x2);
    field_sqr_impl(&a12, &a12);

    // shift left 8, multiply by a^12
    field_sqr_n_impl(&t, 8);
    field_mul_impl(r, &t, &a12);
}

// =============================================================================
// LAYER 2: Scalar mod-n Algebra
// =============================================================================

// Scalar negate: r = n - a (if a != 0)
inline void scalar_negate_impl(const Scalar* a, Scalar* r) {
    ulong n[4] = { ORDER_N0, ORDER_N1, ORDER_N2, ORDER_N3 };
    int is_zero_flag = scalar_is_zero(a);

    ulong borrow = 0;
    for (int i = 0; i < 4; i++)
        r->limbs[i] = sub_with_borrow(n[i], a->limbs[i], borrow, &borrow);
    // If a was zero, result should be zero too
    ulong mask = -(ulong)(!is_zero_flag);
    for (int i = 0; i < 4; i++) r->limbs[i] &= mask;
}

// Helper: branchless conditional subtract n (r -= n if r >= n)
inline void scalar_cond_sub_n(Scalar* r) {
    ulong n[4] = { ORDER_N0, ORDER_N1, ORDER_N2, ORDER_N3 };
    ulong borrow = 0;
    ulong tmp[4];
    for (int i = 0; i < 4; i++)
        tmp[i] = sub_with_borrow(r->limbs[i], n[i], borrow, &borrow);
    // borrow==0 means r >= n, use subtracted result
    ulong mask = -(ulong)(borrow == 0);
    for (int i = 0; i < 4; i++)
        r->limbs[i] = (tmp[i] & mask) | (r->limbs[i] & ~mask);
}

// Scalar add mod n: r = (a + b) mod n
inline void scalar_add_mod_n_impl(const Scalar* a, const Scalar* b, Scalar* r) {
    ulong carry = 0;
    for (int i = 0; i < 4; i++)
        r->limbs[i] = add_with_carry(a->limbs[i], b->limbs[i], carry, &carry);
    // CONSTANT-TIME: was `if (carry) sub n; else scalar_cond_sub_n` — a
    // data-dependent branch on a secret-derived carry. Reduce branchlessly:
    // t = r - n; (carry:r) >= n  iff  carry==1 OR r >= n (borrow_n==0). Select t
    // in that case, else keep r. a,b < n => a+b < 2n, so one subtraction suffices
    // (matches scalar_cond_sub_n's masked-select style, used above).
    ulong n[4] = { ORDER_N0, ORDER_N1, ORDER_N2, ORDER_N3 };
    ulong borrow_n = 0;
    ulong t[4];
    for (int i = 0; i < 4; i++)
        t[i] = sub_with_borrow(r->limbs[i], n[i], borrow_n, &borrow_n);
    ulong mask = (ulong)0 - ((ulong)(carry != 0) | (ulong)(borrow_n == 0));
    for (int i = 0; i < 4; i++)
        r->limbs[i] = (t[i] & mask) | (r->limbs[i] & ~mask);
}

// Scalar sub mod n: r = (a - b) mod n
inline void scalar_sub_mod_n_impl(const Scalar* a, const Scalar* b, Scalar* r) {
    ulong borrow = 0;
    for (int i = 0; i < 4; i++)
        r->limbs[i] = sub_with_borrow(a->limbs[i], b->limbs[i], borrow, &borrow);
    // CONSTANT-TIME: was `if (borrow) add n` — a data-dependent branch on a
    // secret-derived borrow. Add n masked by borrow (0 when no borrow -> no-op).
    ulong n[4] = { ORDER_N0, ORDER_N1, ORDER_N2, ORDER_N3 };
    ulong mask = (ulong)0 - (ulong)(borrow != 0);
    ulong carry2 = 0;
    for (int i = 0; i < 4; i++)
        r->limbs[i] = add_with_carry(r->limbs[i], n[i] & mask, carry2, &carry2);
}

// Scalar multiply mod n: r = (a * b) mod n
// Uses 2^256 ≡ NC (mod n) reduction where NC = 2^256 - n
inline void scalar_mul_mod_n_impl(const Scalar* a, const Scalar* b, Scalar* r) {
    // NC = 2^256 - n = {0x402DA1732FC9BEBF, 0x4551231950B75FC4, 1, 0}
    ulong NC[3] = { 0x402DA1732FC9BEBFUL, 0x4551231950B75FC4UL, 0x1UL };

    // Step 1: Full 512-bit schoolbook multiplication
    ulong prod[8] = {0,0,0,0,0,0,0,0};
    for (int i = 0; i < 4; i++) {
        ulong carry = 0;
        for (int j = 0; j < 4; j++) {
            ulong2 full = mul64_full(a->limbs[i], b->limbs[j]);
            ulong c1, c2;
            ulong s = add_with_carry(full.x, prod[i+j], 0, &c1);
            s = add_with_carry(s, carry, 0, &c2);
            prod[i+j] = s;
            carry = full.y + c1 + c2;
        }
        prod[i+4] = carry;
    }

    // Step 2: Reduce high 256 bits. acc = prod[0..3] + prod[4..7] * NC
    // prod[4..7] * NC has at most 256+129 = 385 bits.
    // CT-P2-01: BRANCHLESS. The previous version had `if (prod[4+i]==0) continue;`
    // and a data-dependent `&& carry` loop bound — both branch on the secret-derived
    // product, producing key-dependent warp divergence (the same leak class fixed in
    // CUDA scalar_mul_mod_n). Multiplying by a zero limb is a no-op, and propagating
    // carry over a FIXED span (adding carry==0 is a no-op) is identical to the
    // early-exit — so removing the branches preserves the result exactly.
    ulong acc[7] = {prod[0], prod[1], prod[2], prod[3], 0, 0, 0};
    for (int i = 0; i < 4; i++) {
        ulong carry = 0;
        for (int j = 0; j < 3; j++) {
            ulong2 full = mul64_full(prod[4+i], NC[j]);
            ulong c1, c2;
            ulong s = add_with_carry(full.x, acc[i+j], 0, &c1);
            s = add_with_carry(s, carry, 0, &c2);
            acc[i+j] = s;
            carry = full.y + c1 + c2;
        }
        // Propagate remaining carry over a fixed span (k upper bound is constant;
        // start i+3 is a public loop index). add_with_carry(.,0,.) is a no-op.
        for (int k = i+3; k < 7; k++) {
            acc[k] = add_with_carry(acc[k], carry, 0, &carry);
        }
    }

    // Step 3: Reduce again. res = acc[0..3] + acc[4..6] * NC (branchless).
    ulong res[5] = {acc[0], acc[1], acc[2], acc[3], 0};
    for (int i = 0; i < 3; i++) {
        ulong carry = 0;
        for (int j = 0; j < 3; j++) {
            if (i+j >= 5) break;   // public loop-index bound — constant-time
            ulong2 full = mul64_full(acc[4+i], NC[j]);
            ulong c1, c2;
            ulong s = add_with_carry(full.x, res[i+j], 0, &c1);
            s = add_with_carry(s, carry, 0, &c2);
            res[i+j] = s;
            carry = full.y + c1 + c2;
        }
        for (int k = i+3; k < 5; k++) {
            res[k] = add_with_carry(res[k], carry, 0, &carry);
        }
    }

    // Step 4: Handle res[4] overflow (branchless — res[4]==0 → multiply by 0 no-op).
    r->limbs[0] = res[0]; r->limbs[1] = res[1];
    r->limbs[2] = res[2]; r->limbs[3] = res[3];
    {
        ulong carry = 0;
        for (int j = 0; j < 3; j++) {
            ulong2 full = mul64_full(res[4], NC[j]);
            ulong c1, c2;
            ulong s = add_with_carry(full.x, r->limbs[j], 0, &c1);
            s = add_with_carry(s, carry, 0, &c2);
            r->limbs[j] = s;
            carry = full.y + c1 + c2;
        }
        r->limbs[3] += carry;
    }

    // Step 5: Conditional subtract n (at most 3 times to ensure < n)
    scalar_cond_sub_n(r);
    scalar_cond_sub_n(r);
    scalar_cond_sub_n(r);
}

// Scalar inverse mod n via binary exponentiation: a^(n-2) mod n
inline void scalar_inverse_impl(const Scalar* a, Scalar* r) {
    ulong exp[4] = { ORDER_N_MINUS2_0, ORDER_N_MINUS2_1, ORDER_N_MINUS2_2, ORDER_N_MINUS2_3 };
    Scalar base = *a;
    Scalar result;
    result.limbs[0] = 1; result.limbs[1] = 0;
    result.limbs[2] = 0; result.limbs[3] = 0;

    for (int i = 0; i < 4; i++) {
        for (int bit = 0; bit < 64; bit++) {
            if ((exp[i] >> bit) & 1UL) {
                scalar_mul_mod_n_impl(&result, &base, &result);
            }
            scalar_mul_mod_n_impl(&base, &base, &base);
        }
    }
    *r = result;
}

// Scalar is even: test bit 0
inline int scalar_is_even_impl(const Scalar* s) {
    return (s->limbs[0] & 1UL) == 0;
}

// Scalar equality
inline int scalar_eq_impl(const Scalar* a, const Scalar* b) {
    ulong diff = 0;
    for (int i = 0; i < 4; i++) diff |= (a->limbs[i] ^ b->limbs[i]);
    return diff == 0;
}

// Scalar bit length
inline int scalar_bitlen_impl(const Scalar* s) {
    for (int i = 3; i >= 0; i--) {
        if (s->limbs[i] != 0) {
            int bits = 64;
            ulong v = s->limbs[i];
            while (!(v >> 63)) { v <<= 1; bits--; }
            return i * 64 + bits;
        }
    }
    return 0;
}

// Scalar greater-or-equal
inline int scalar_ge_impl(const Scalar* a, const Scalar* b) {
    for (int i = 3; i >= 0; i--) {
        if (a->limbs[i] > b->limbs[i]) return 1;
        if (a->limbs[i] < b->limbs[i]) return 0;
    }
    return 1; // equal
}

// low-S check (BIP-62)
inline int scalar_is_low_s_impl(const Scalar* s) {
    Scalar half_n;
    half_n.limbs[0] = HALF_ORDER_0; half_n.limbs[1] = HALF_ORDER_1;
    half_n.limbs[2] = HALF_ORDER_2; half_n.limbs[3] = HALF_ORDER_3;

    for (int i = 3; i >= 0; i--) {
        if (s->limbs[i] > half_n.limbs[i]) return 0;
        if (s->limbs[i] < half_n.limbs[i]) return 1;
    }
    return 1; // equal = low
}

// Branchless mask: returns all-ones if s > n/2, all-zeros otherwise.
// No early-exit — avoids warp divergence on secret-derived values of s.
inline ulong scalar_is_high_mask_impl(const Scalar* s) {
    const ulong half_order[4] = { HALF_ORDER_0, HALF_ORDER_1, HALF_ORDER_2, HALF_ORDER_3 };
    ulong gt = 0;
    ulong eq_so_far = ~(ulong)0;
    for (int i = 3; i >= 0; --i) {
        ulong a_gt_h = -(ulong)(s->limbs[i] > half_order[i]);
        ulong a_eq_h = -(ulong)(s->limbs[i] == half_order[i]);
        gt |= (a_gt_h & eq_so_far);
        eq_so_far &= a_eq_h;
    }
    return gt;
}

// =============================================================================
// GLV Endomorphism
// =============================================================================

inline void apply_endomorphism_impl(const JacobianPoint* p, JacobianPoint* r) {
    FieldElement beta;
    beta.limbs[0] = 0x7AE96A2B657C0710UL;
    beta.limbs[1] = 0x6E64479EAC3434E9UL;
    beta.limbs[2] = 0x9CF0497512F58995UL;
    beta.limbs[3] = 0xC1396C28719501EEUL;

    field_mul_impl(&r->x, &p->x, &beta);
    r->y = p->y;
    r->z = p->z;
    r->infinity = p->infinity;
}

// Field negation: r = p - a (mod p)
inline void field_negate_impl(FieldElement* r, const FieldElement* a) {
    FieldElement zero;
    zero.limbs[0] = 0; zero.limbs[1] = 0; zero.limbs[2] = 0; zero.limbs[3] = 0;
    field_sub_impl(r, &zero, a);
}

// GLV decomposition: k = k1 + k2*lambda (mod n), |k1|,|k2| ~ 128 bits
// Uses full lattice-based decomposition with Babai rounding.

// (a * b) >> 384 with rounding (bit 383)
inline void glv_mul_shift_384_impl(const ulong a[4], __constant const ulong b[4], ulong result[4]) {
    ulong prod[8] = {0,0,0,0,0,0,0,0};
    for (int i = 0; i < 4; i++) {
        ulong carry = 0;
        for (int j = 0; j < 4; j++) {
            ulong2 full = mul64_full(a[i], b[j]);
            ulong c1 = 0, c2 = 0;
            ulong s = add_with_carry(full.x, prod[i+j], 0, &c1);
            s = add_with_carry(s, carry, 0, &c2);
            prod[i+j] = s;
            carry = full.y + c1 + c2;
        }
        prod[i+4] = carry;
    }
    result[0] = prod[6];  result[1] = prod[7];
    result[2] = 0;        result[3] = 0;
    if (prod[5] >> 63) {  // rounding bit 383
        result[0]++;
        if (result[0] == 0) result[1]++;
    }
}

inline void glv_decompose_impl(const Scalar* k, Scalar* k1, Scalar* k2,
                                 int* k1_neg, int* k2_neg) {
    // c1 = round(k * g1 / 2^384), c2 = round(k * g2 / 2^384)
    ulong c1_limbs[4], c2_limbs[4];
    glv_mul_shift_384_impl(k->limbs, GLV_G1, c1_limbs);
    glv_mul_shift_384_impl(k->limbs, GLV_G2, c2_limbs);

    Scalar c1, c2;
    for (int i = 0; i < 4; i++) { c1.limbs[i] = c1_limbs[i]; c2.limbs[i] = c2_limbs[i]; }

    // Reduce c1, c2 mod n if needed
    Scalar order;
    order.limbs[0] = ORDER_N0; order.limbs[1] = ORDER_N1;
    order.limbs[2] = ORDER_N2; order.limbs[3] = ORDER_N3;
    if (scalar_ge_impl(&c1, &order)) scalar_sub_mod_n_impl(&c1, &order, &c1);
    if (scalar_ge_impl(&c2, &order)) scalar_sub_mod_n_impl(&c2, &order, &c2);

    // k2_mod = c1*(-b1) + c2*(-b2) mod n
    Scalar minus_b1, minus_b2;
    for (int i = 0; i < 4; i++) {
        minus_b1.limbs[i] = GLV_MINUS_B1[i];
        minus_b2.limbs[i] = GLV_MINUS_B2[i];
    }
    Scalar t1, t2, k2_mod;
    scalar_mul_mod_n_impl(&c1, &minus_b1, &t1);
    scalar_mul_mod_n_impl(&c2, &minus_b2, &t2);
    scalar_add_mod_n_impl(&t1, &t2, &k2_mod);

    // Pick shorter k2: compare |k2_mod| vs |n - k2_mod|
    Scalar k2_neg_val;
    scalar_negate_impl(&k2_mod, &k2_neg_val);
    int k2_is_neg = (scalar_bitlen_impl(&k2_neg_val) < scalar_bitlen_impl(&k2_mod));
    Scalar k2_abs = k2_is_neg ? k2_neg_val : k2_mod;

    // For computing k1: need the signed k2
    Scalar k2_signed;
    if (k2_is_neg) { scalar_negate_impl(&k2_abs, &k2_signed); }
    else           { k2_signed = k2_abs; }

    // k1 = k - lambda*k2_signed mod n
    Scalar lambda_s;
    lambda_s.limbs[0] = GLV_LAMBDA0; lambda_s.limbs[1] = GLV_LAMBDA1;
    lambda_s.limbs[2] = GLV_LAMBDA2; lambda_s.limbs[3] = GLV_LAMBDA3;
    Scalar lk2;
    scalar_mul_mod_n_impl(&lambda_s, &k2_signed, &lk2);
    Scalar k1_mod;
    scalar_sub_mod_n_impl(k, &lk2, &k1_mod);

    // Pick shorter k1
    Scalar k1_neg_val;
    scalar_negate_impl(&k1_mod, &k1_neg_val);
    int k1_is_neg = (scalar_bitlen_impl(&k1_neg_val) < scalar_bitlen_impl(&k1_mod));
    Scalar k1_abs = k1_is_neg ? k1_neg_val : k1_mod;

    *k1 = k1_abs;  *k2 = k2_abs;
    *k1_neg = k1_is_neg;  *k2_neg = k2_is_neg;
}

// GLV-accelerated scalar multiplication: k*P using Shamir's trick
// with endomorphism phi(P) = (beta*x, y) where phi corresponds to lambda.
// Uses interleaved wNAF w=5 for both half-scalars k1, k2.
inline void build_wnaf_table_zr_impl(const AffinePoint* base, AffinePoint table[8],
                                     FieldElement* globalz) {
    JacobianPoint base_jac;
    point_from_affine(&base_jac, base);

    JacobianPoint doubled;
    point_double_unchecked(&doubled, &base_jac);

    FieldElement c = doubled.z;
    FieldElement c2, c3;
    field_sqr_impl(&c2, &c);
    field_mul_impl(&c3, &c2, &c);

    AffinePoint doubled_affine;
    doubled_affine.x = doubled.x;
    doubled_affine.y = doubled.y;

    JacobianPoint accum;
    field_mul_impl(&accum.x, &base->x, &c2);
    field_mul_impl(&accum.y, &base->y, &c3);
    accum.z.limbs[0] = 1UL;
    accum.z.limbs[1] = 0UL;
    accum.z.limbs[2] = 0UL;
    accum.z.limbs[3] = 0UL;
    accum.infinity = 0;

    table[0].x = accum.x;
    table[0].y = accum.y;

    FieldElement zr[8];
    zr[0] = c;

    for (int i = 1; i < 8; ++i) {
        FieldElement h;
        point_add_mixed_h_impl(&accum, &accum, &doubled_affine, &h);
        table[i].x = accum.x;
        table[i].y = accum.y;
        zr[i] = h;
    }

    field_mul_impl(globalz, &accum.z, &c);

    FieldElement zs = zr[7];
    for (int idx = 6; idx >= 0; --idx) {
        if (idx != 6) {
            FieldElement tmp;
            field_mul_impl(&tmp, &zs, &zr[idx + 1]);
            zs = tmp;
        }

        FieldElement zs2, zs3;
        field_sqr_impl(&zs2, &zs);
        field_mul_impl(&zs3, &zs2, &zs);

        FieldElement tx, ty;
        field_mul_impl(&tx, &table[idx].x, &zs2);
        field_mul_impl(&ty, &table[idx].y, &zs3);
        table[idx].x = tx;
        table[idx].y = ty;
    }
}

inline void derive_endo_table_impl(const AffinePoint table[8], AffinePoint endo_table[8],
                                   int negate_y) {
    FieldElement beta;
    beta.limbs[0] = GLV_BETA0; beta.limbs[1] = GLV_BETA1;
    beta.limbs[2] = GLV_BETA2; beta.limbs[3] = GLV_BETA3;

    for (int i = 0; i < 8; ++i) {
        field_mul_impl(&endo_table[i].x, &table[i].x, &beta);
        if (negate_y) {
            field_negate_impl(&endo_table[i].y, &table[i].y);
        } else {
            endo_table[i].y = table[i].y;
        }
    }
}

// Forward declaration required because shamir_double_mul_glv_impl calls
// scalar_mul_glv_impl as a degenerate-case fallback, but the full definition
// of scalar_mul_glv_impl appears later in this file.
inline void scalar_mul_glv_impl(JacobianPoint* r, const Scalar* k, const AffinePoint* p);

// =============================================================================
// Shamir's trick double-scalar multiplication with 4-scalar GLV decomposition.
// Computes r = a*P + b*Q  (both P and Q are affine inputs).
// Uses a 16-entry precomputed affine table + a single batch field_inv (Montgomery
// trick for 11 intermediate Z values). Main loop iterates ~129 half-width bits.
// Expected cost vs two separate scalar_mul_glv_impl calls:
//   2×(~130 D + ~65 MA) + 1 J+J = ~260 D + ~131 MA
//   Shamir: ~1 field_inv + ~129 D + ~120 MA  → saves ~130 doubles
// =============================================================================
inline void shamir_double_mul_glv_impl(
    const AffinePoint* P, const Scalar* a,
    const AffinePoint* Q, const Scalar* b,
    JacobianPoint* r)
{
    // Degenerate fallback: one or both scalars zero
    if (scalar_is_zero(a) && scalar_is_zero(b)) {
        point_set_infinity(r); return;
    }
    if (scalar_is_zero(a)) { scalar_mul_glv_impl(r, b, Q); return; }
    if (scalar_is_zero(b)) { scalar_mul_glv_impl(r, a, P); return; }

    // GLV decompose both scalars: a → (a1,a2), b → (b1,b2), each ~128 bits
    Scalar a1, a2, b1, b2;
    int a1_neg, a2_neg, b1_neg, b2_neg;
    glv_decompose_impl(a, &a1, &a2, &a1_neg, &a2_neg);
    glv_decompose_impl(b, &b1, &b2, &b1_neg, &b2_neg);

    // Build 4 signed base affine points:
    //   pts[0] = ±P        (for a1)  pts[1] = ±endo(P) (for a2)
    //   pts[2] = ±Q        (for b1)  pts[3] = ±endo(Q) (for b2)
    AffinePoint pts[4];
    FieldElement beta;
    beta.limbs[0] = GLV_BETA0; beta.limbs[1] = GLV_BETA1;
    beta.limbs[2] = GLV_BETA2; beta.limbs[3] = GLV_BETA3;

    pts[0] = *P;
    if (a1_neg) field_negate_impl(&pts[0].y, &pts[0].y);
    field_mul_impl(&pts[1].x, &P->x, &beta);
    pts[1].y = P->y;
    if (a2_neg) field_negate_impl(&pts[1].y, &pts[1].y);

    pts[2] = *Q;
    if (b1_neg) field_negate_impl(&pts[2].y, &pts[2].y);
    field_mul_impl(&pts[3].x, &Q->x, &beta);
    pts[3].y = Q->y;
    if (b2_neg) field_negate_impl(&pts[3].y, &pts[3].y);

    // Precompute 15 non-zero combos into a 16-entry affine table.
    // Index encoding: bit0=a1, bit1=a2, bit2=b1, bit3=b2.
    AffinePoint table[16];
    table[1]  = pts[0];   // P1
    table[2]  = pts[1];   // P2
    table[4]  = pts[2];   // Q1
    table[8]  = pts[3];   // Q2

    // Compute 11 pairwise/triple/quad combos as Jacobian points
    JacobianPoint jc[11];
    JacobianPoint tmp_j;

    point_from_affine(&tmp_j, &pts[0]);
    point_add_mixed_impl(&jc[0], &tmp_j, &pts[1]);  // P1+P2  → table[3]
    point_from_affine(&tmp_j, &pts[0]);
    point_add_mixed_impl(&jc[1], &tmp_j, &pts[2]);  // P1+Q1  → table[5]
    point_from_affine(&tmp_j, &pts[1]);
    point_add_mixed_impl(&jc[2], &tmp_j, &pts[2]);  // P2+Q1  → table[6]
    point_from_affine(&tmp_j, &pts[0]);
    point_add_mixed_impl(&jc[3], &tmp_j, &pts[3]);  // P1+Q2  → table[9]
    point_from_affine(&tmp_j, &pts[1]);
    point_add_mixed_impl(&jc[4], &tmp_j, &pts[3]);  // P2+Q2  → table[10]
    point_from_affine(&tmp_j, &pts[2]);
    point_add_mixed_impl(&jc[5], &tmp_j, &pts[3]);  // Q1+Q2  → table[12]

    point_add_mixed_impl(&jc[6],  &jc[0], &pts[2]);  // P1+P2+Q1   → table[7]
    point_add_mixed_impl(&jc[7],  &jc[0], &pts[3]);  // P1+P2+Q2   → table[11]
    point_add_mixed_impl(&jc[8],  &jc[1], &pts[3]);  // P1+Q1+Q2   → table[13]
    point_add_mixed_impl(&jc[9],  &jc[2], &pts[3]);  // P2+Q1+Q2   → table[14]
    point_add_mixed_impl(&jc[10], &jc[6], &pts[3]);  // P1+P2+Q1+Q2→ table[15]

    // Safety: check for degenerate (infinity) combo -- fallback if any
    int has_degen = 0;
    for (int i = 0; i < 11; i++) {
        if (point_is_infinity(&jc[i])) { has_degen = 1; break; }
    }

    if (has_degen) {
        // Fallback: 4-point binary accumulation (no batch inversion needed)
        int max_len = scalar_bitlen_impl(&a1);
        int l2 = scalar_bitlen_impl(&a2); if (l2 > max_len) max_len = l2;
        int l3 = scalar_bitlen_impl(&b1); if (l3 > max_len) max_len = l3;
        int l4 = scalar_bitlen_impl(&b2); if (l4 > max_len) max_len = l4;

        point_set_infinity(r);
        for (int i = max_len - 1; i >= 0; --i) {
            if (!point_is_infinity(r)) point_double_unchecked(r, r);
            if (scalar_bit(&a1, i)) {
                if (point_is_infinity(r)) point_from_affine(r, &pts[0]);
                else point_add_mixed_unchecked(r, r, &pts[0]);
            }
            if (scalar_bit(&a2, i)) {
                if (point_is_infinity(r)) point_from_affine(r, &pts[1]);
                else point_add_mixed_unchecked(r, r, &pts[1]);
            }
            if (scalar_bit(&b1, i)) {
                if (point_is_infinity(r)) point_from_affine(r, &pts[2]);
                else point_add_mixed_unchecked(r, r, &pts[2]);
            }
            if (scalar_bit(&b2, i)) {
                if (point_is_infinity(r)) point_from_affine(r, &pts[3]);
                else point_add_mixed_unchecked(r, r, &pts[3]);
            }
        }
        return;
    }

    // Batch inversion: Montgomery's trick — 1 field_inv for 11 Z values
    FieldElement prefix[11];
    prefix[0] = jc[0].z;
    for (int i = 1; i < 11; i++) {
        field_mul_impl(&prefix[i], &prefix[i-1], &jc[i].z);
    }

    FieldElement inv_prod;
    field_inv_impl(&inv_prod, &prefix[10]);

    FieldElement z_inv[11];
    for (int i = 10; i > 0; --i) {
        field_mul_impl(&z_inv[i], &inv_prod, &prefix[i-1]);
        FieldElement tmp;
        field_mul_impl(&tmp, &inv_prod, &jc[i].z);
        inv_prod = tmp;
    }
    z_inv[0] = inv_prod;

    // Convert combo Jacobian points to affine and store in table
    const int tbl_map[11] = {3, 5, 6, 9, 10, 12, 7, 11, 13, 14, 15};
    for (int i = 0; i < 11; i++) {
        FieldElement zi2, zi3;
        field_sqr_impl(&zi2, &z_inv[i]);
        field_mul_impl(&zi3, &zi2, &z_inv[i]);
        field_mul_impl(&table[tbl_map[i]].x, &jc[i].x, &zi2);
        field_mul_impl(&table[tbl_map[i]].y, &jc[i].y, &zi3);
    }

    // Main loop: ~129 half-width bits, 4-bit index → 16-entry table lookup
    int max_len = scalar_bitlen_impl(&a1);
    int l2 = scalar_bitlen_impl(&a2); if (l2 > max_len) max_len = l2;
    int l3 = scalar_bitlen_impl(&b1); if (l3 > max_len) max_len = l3;
    int l4 = scalar_bitlen_impl(&b2); if (l4 > max_len) max_len = l4;

    point_set_infinity(r);
    for (int i = max_len - 1; i >= 0; --i) {
        if (!point_is_infinity(r)) point_double_unchecked(r, r);

        int idx = scalar_bit(&a1, i)
                | (scalar_bit(&a2, i) << 1)
                | (scalar_bit(&b1, i) << 2)
                | (scalar_bit(&b2, i) << 3);

        if (idx != 0) {
            if (point_is_infinity(r)) point_from_affine(r, &table[idx]);
            else                      point_add_mixed_unchecked(r, r, &table[idx]);
        }
    }
}

inline void scalar_mul_glv_impl(JacobianPoint* r, const Scalar* k, const AffinePoint* p) {
    Scalar k1, k2;
    int k1_neg, k2_neg;
    glv_decompose_impl(k, &k1, &k2, &k1_neg, &k2_neg);

    // Build base point, negate if k1 is negative
    AffinePoint base = *p;
    if (k1_neg) field_negate_impl(&base.y, &base.y);

    AffinePoint table[8];
    FieldElement globalz;
    build_wnaf_table_zr_impl(&base, table, &globalz);

    AffinePoint endo_table[8];
    derive_endo_table_impl(table, endo_table, (k1_neg != k2_neg));

    // wNAF encode both half-width scalars
    int wnaf1[130] = {0};
    int wnaf2[130] = {0};
    scalar_to_wnaf(&k1, wnaf1);
    scalar_to_wnaf(&k2, wnaf2);

    // Shamir interleaved loop
    point_set_infinity(r);
    for (int i = 129; i >= 0; --i) {
        if (!point_is_infinity(r)) point_double_unchecked(r, r);

        int d1 = wnaf1[i];
        if (d1 != 0) {
            int idx = (((d1 > 0) ? d1 : -d1) - 1) >> 1;
            AffinePoint pt = table[idx];
            if (d1 < 0) field_negate_impl(&pt.y, &pt.y);
            if (point_is_infinity(r)) { point_from_affine(r, &pt); }
            else { point_add_mixed_unchecked(r, r, &pt); }
        }

        int d2 = wnaf2[i];
        if (d2 != 0) {
            int idx = (((d2 > 0) ? d2 : -d2) - 1) >> 1;
            AffinePoint pt = endo_table[idx];
            if (d2 < 0) field_negate_impl(&pt.y, &pt.y);
            if (point_is_infinity(r)) { point_from_affine(r, &pt); }
            else { point_add_mixed_unchecked(r, r, &pt); }
        }
    }

    if (!point_is_infinity(r)) {
        FieldElement corrected_z;
        field_mul_impl(&corrected_z, &r->z, &globalz);
        r->z = corrected_z;
    }
}

// Precomputed generator multiplication using fixed window w=4.
// Uses a hard-coded affine table of {0G..15G} — eliminates per-thread table
// construction and uses mixed (J+A) additions instead of J+J (saves ~5 field_muls per add).
inline void scalar_mul_generator_windowed_impl(JacobianPoint* r, const Scalar* k) {
    // Precomputed affine table: table[i] = i*G for i = 1..15.
    AffinePoint table[16];
    table[0].x.limbs[0] = 0; table[0].x.limbs[1] = 0; table[0].x.limbs[2] = 0; table[0].x.limbs[3] = 0;
    table[0].y.limbs[0] = 0; table[0].y.limbs[1] = 0; table[0].y.limbs[2] = 0; table[0].y.limbs[3] = 0;
    table[1].x.limbs[0] = 0x59F2815B16F81798UL; table[1].x.limbs[1] = 0x029BFCDB2DCE28D9UL;
    table[1].x.limbs[2] = 0x55A06295CE870B07UL; table[1].x.limbs[3] = 0x79BE667EF9DCBBACUL;
    table[1].y.limbs[0] = 0x9C47D08FFB10D4B8UL; table[1].y.limbs[1] = 0xFD17B448A6855419UL;
    table[1].y.limbs[2] = 0x5DA4FBFC0E1108A8UL; table[1].y.limbs[3] = 0x483ADA7726A3C465UL;
    table[2].x.limbs[0] = 0xABAC09B95C709EE5UL; table[2].x.limbs[1] = 0x5C778E4B8CEF3CA7UL;
    table[2].x.limbs[2] = 0x3045406E95C07CD8UL; table[2].x.limbs[3] = 0xC6047F9441ED7D6DUL;
    table[2].y.limbs[0] = 0x236431A950CFE52AUL; table[2].y.limbs[1] = 0xF7F632653266D0E1UL;
    table[2].y.limbs[2] = 0xA3C58419466CEAEEUL; table[2].y.limbs[3] = 0x1AE168FEA63DC339UL;
    table[3].x.limbs[0] = 0x8601F113BCE036F9UL; table[3].x.limbs[1] = 0xB531C845836F99B0UL;
    table[3].x.limbs[2] = 0x49344F85F89D5229UL; table[3].x.limbs[3] = 0xF9308A019258C310UL;
    table[3].y.limbs[0] = 0x6CB9FD7584B8E672UL; table[3].y.limbs[1] = 0x6500A99934C2231BUL;
    table[3].y.limbs[2] = 0x0FE337E62A37F356UL; table[3].y.limbs[3] = 0x388F7B0F632DE814UL;
    table[4].x.limbs[0] = 0x74FA94ABE8C4CD13UL; table[4].x.limbs[1] = 0xCC6C13900EE07584UL;
    table[4].x.limbs[2] = 0x581E4904930B1404UL; table[4].x.limbs[3] = 0xE493DBF1C10D80F3UL;
    table[4].y.limbs[0] = 0xCFE97BDC47739922UL; table[4].y.limbs[1] = 0xD967AE33BFBDFE40UL;
    table[4].y.limbs[2] = 0x5642E2098EA51448UL; table[4].y.limbs[3] = 0x51ED993EA0D455B7UL;
    table[5].x.limbs[0] = 0xCBA8D569B240EFE4UL; table[5].x.limbs[1] = 0xE88B84BDDC619AB7UL;
    table[5].x.limbs[2] = 0x55B4A7250A5C5128UL; table[5].x.limbs[3] = 0x2F8BDE4D1A072093UL;
    table[5].y.limbs[0] = 0xDCA87D3AA6AC62D6UL; table[5].y.limbs[1] = 0xF788271BAB0D6840UL;
    table[5].y.limbs[2] = 0xD4DBA9DDA6C9C426UL; table[5].y.limbs[3] = 0xD8AC222636E5E3D6UL;
    table[6].x.limbs[0] = 0x2F057A1460297556UL; table[6].x.limbs[1] = 0x82F6472F8568A18BUL;
    table[6].x.limbs[2] = 0x20453A14355235D3UL; table[6].x.limbs[3] = 0xFFF97BD5755EEEA4UL;
    table[6].y.limbs[0] = 0x3C870C36B075F297UL; table[6].y.limbs[1] = 0xDE80F0F6518FE4A0UL;
    table[6].y.limbs[2] = 0xF3BE96017F45C560UL; table[6].y.limbs[3] = 0xAE12777AACFBB620UL;
    table[7].x.limbs[0] = 0xE92BDDEDCAC4F9BCUL; table[7].x.limbs[1] = 0x3D419B7E0330E39CUL;
    table[7].x.limbs[2] = 0xA398F365F2EA7A0EUL; table[7].x.limbs[3] = 0x5CBDF0646E5DB4EAUL;
    table[7].y.limbs[0] = 0xA5082628087264DAUL; table[7].y.limbs[1] = 0xA813D0B813FDE7B5UL;
    table[7].y.limbs[2] = 0xA3178D6D861A54DBUL; table[7].y.limbs[3] = 0x6AEBCA40BA255960UL;
    table[8].x.limbs[0] = 0x67784EF3E10A2A01UL; table[8].x.limbs[1] = 0x0A1BDD05E5AF888AUL;
    table[8].x.limbs[2] = 0xAFF3843FB70F3C2FUL; table[8].x.limbs[3] = 0x2F01E5E15CCA351DUL;
    table[8].y.limbs[0] = 0xB5DA2CB76CBDE904UL; table[8].y.limbs[1] = 0xC2E213D6BA5B7617UL;
    table[8].y.limbs[2] = 0x293D082A132D13B4UL; table[8].y.limbs[3] = 0x5C4DA8A741539949UL;
    table[9].x.limbs[0] = 0xC35F110DFC27CCBEUL; table[9].x.limbs[1] = 0xE09796974C57E714UL;
    table[9].x.limbs[2] = 0x09AD178A9F559ABDUL; table[9].x.limbs[3] = 0xACD484E2F0C7F653UL;
    table[9].y.limbs[0] = 0x05CC262AC64F9C37UL; table[9].y.limbs[1] = 0xADD888A4375F8E0FUL;
    table[9].y.limbs[2] = 0x64380971763B61E9UL; table[9].y.limbs[3] = 0xCC338921B0A7D9FDUL;
    table[10].x.limbs[0] = 0x52A68E2A47E247C7UL; table[10].x.limbs[1] = 0x3442D49B1943C2B7UL;
    table[10].x.limbs[2] = 0x35477C7B1AE6AE5DUL; table[10].x.limbs[3] = 0xA0434D9E47F3C862UL;
    table[10].y.limbs[0] = 0x3CBEE53B037368D7UL; table[10].y.limbs[1] = 0x6F794C2ED877A159UL;
    table[10].y.limbs[2] = 0xA3B6C7E693A24C69UL; table[10].y.limbs[3] = 0x893ABA425419BC27UL;
    table[11].x.limbs[0] = 0xBBEC17895DA008CBUL; table[11].x.limbs[1] = 0x5649980BE5C17891UL;
    table[11].x.limbs[2] = 0x5EF4246B70C65AACUL; table[11].x.limbs[3] = 0x774AE7F858A9411EUL;
    table[11].y.limbs[0] = 0x301D74C9C953C61BUL; table[11].y.limbs[1] = 0x372DB1E2DFF9D6A8UL;
    table[11].y.limbs[2] = 0x0243DD56D7B7B365UL; table[11].y.limbs[3] = 0xD984A032EB6B5E19UL;
    table[12].x.limbs[0] = 0xC5B0F47070AFE85AUL; table[12].x.limbs[1] = 0x687CF4419620095BUL;
    table[12].x.limbs[2] = 0x15C38F004D734633UL; table[12].x.limbs[3] = 0xD01115D548E7561BUL;
    table[12].y.limbs[0] = 0x6B051B13F4062327UL; table[12].y.limbs[1] = 0x79238C5DD9A86D52UL;
    table[12].y.limbs[2] = 0xA8B64537E17BD815UL; table[12].y.limbs[3] = 0xA9F34FFDC815E0D7UL;
    table[13].x.limbs[0] = 0xDEEDDF8F19405AA8UL; table[13].x.limbs[1] = 0xB075FBC6610E58CDUL;
    table[13].x.limbs[2] = 0xC7D1D205C3748651UL; table[13].x.limbs[3] = 0xF28773C2D975288BUL;
    table[13].y.limbs[0] = 0x29B5CB52DB03ED81UL; table[13].y.limbs[1] = 0x3A1A06DA521FA91FUL;
    table[13].y.limbs[2] = 0x758212EB65CDAF47UL; table[13].y.limbs[3] = 0x0AB0902E8D880A89UL;
    table[14].x.limbs[0] = 0xE49B241A60E823E4UL; table[14].x.limbs[1] = 0x26AA7B63678949E6UL;
    table[14].x.limbs[2] = 0xFD64E67F07D38E32UL; table[14].x.limbs[3] = 0x499FDF9E895E719CUL;
    table[14].y.limbs[0] = 0xC65F40D403A13F5BUL; table[14].y.limbs[1] = 0x464279C27A3F95BCUL;
    table[14].y.limbs[2] = 0x90F044E4A7B3D464UL; table[14].y.limbs[3] = 0xCAC2F6C4B54E8551UL;
    table[15].x.limbs[0] = 0x44ADBCF8E27E080EUL; table[15].x.limbs[1] = 0x31E5946F3C85F79EUL;
    table[15].x.limbs[2] = 0x5A465AE3095FF411UL; table[15].x.limbs[3] = 0xD7924D4F7D43EA96UL;
    table[15].y.limbs[0] = 0xC504DC9FF6A26B58UL; table[15].y.limbs[1] = 0xEA40AF2BD896D3A5UL;
    table[15].y.limbs[2] = 0x83842EC228CC6DEFUL; table[15].y.limbs[3] = 0x581E2872A86C72A6UL;

    // Process scalar 4 bits at a time (MSB first)
    point_set_infinity(r);
    int started = 0;

    for (int limb = 3; limb >= 0; limb--) {
        ulong w = k->limbs[limb];
        for (int nib = 15; nib >= 0; nib--) {
            uint idx = (uint)((w >> (nib * 4)) & 0xFUL);

            if (started) {
                point_double_unchecked(r, r);
                point_double_unchecked(r, r);
                point_double_unchecked(r, r);
                point_double_unchecked(r, r);
            }

            if (idx != 0) {
                if (!started) {
                    point_from_affine(r, &table[idx]);
                    started = 1;
                } else {
                    point_add_mixed_unchecked(r, r, &table[idx]);
                }
            }
        }
    }
}

// Generator multiplication via precomputed LUT in __global memory.
// lut: 16 slices x 65536 AffinePoints. lut[win*65536+idx] = idx * 2^(16*win) * G.
// 15 mixed additions, 0 doublings.
inline void scalar_mul_generator_lut_impl(JacobianPoint* r, const Scalar* k,
                                          __global const AffinePoint* lut) {
    point_set_infinity(r);
    for (int win = 0; win < 16; win++) {
        uint idx = (uint)((k->limbs[win >> 2] >> ((win & 3) * 16)) & 0xFFFFUL);
        if (idx != 0) {
            AffinePoint pt = lut[(uint)win * 65536 + idx];
            if (point_is_infinity(r)) {
                point_from_affine(r, &pt);
            } else {
                point_add_mixed_unchecked(r, r, &pt);
            }
        }
    }
}

// =============================================================================
// LAYER 3: SHA-256 Streaming + HMAC + RFC 6979
// =============================================================================

typedef struct {
    uint h[8];
    uchar buf[64];
    uint buf_len;
    ulong total_len;
} SHA256Ctx;

inline uint sha256_rotr(uint x, uint n) { return (x >> n) | (x << (32 - n)); }
inline uint sha256_ch(uint x, uint y, uint z)  { return (x & y) ^ (~x & z); }
inline uint sha256_maj(uint x, uint y, uint z) { return (x & y) ^ (x & z) ^ (y & z); }
inline uint sha256_bsig0(uint x) { return sha256_rotr(x,2) ^ sha256_rotr(x,13) ^ sha256_rotr(x,22); }
inline uint sha256_bsig1(uint x) { return sha256_rotr(x,6) ^ sha256_rotr(x,11) ^ sha256_rotr(x,25); }
inline uint sha256_ssig0(uint x) { return sha256_rotr(x,7) ^ sha256_rotr(x,18) ^ (x >> 3); }
inline uint sha256_ssig1(uint x) { return sha256_rotr(x,17) ^ sha256_rotr(x,19) ^ (x >> 10); }

inline void sha256_compress(SHA256Ctx* ctx, const uchar block[64]) {
    uint w[64];
    for (int i = 0; i < 16; i++)
        w[i] = ((uint)block[i*4] << 24) | ((uint)block[i*4+1] << 16)
             | ((uint)block[i*4+2] << 8) | (uint)block[i*4+3];
    for (int i = 16; i < 64; i++)
        w[i] = sha256_ssig1(w[i-2]) + w[i-7] + sha256_ssig0(w[i-15]) + w[i-16];

    uint a=ctx->h[0], b=ctx->h[1], c=ctx->h[2], d=ctx->h[3];
    uint e=ctx->h[4], f=ctx->h[5], g=ctx->h[6], h=ctx->h[7];

    for (int i = 0; i < 64; i++) {
        uint t1 = h + sha256_bsig1(e) + sha256_ch(e,f,g) + K256[i] + w[i];
        uint t2 = sha256_bsig0(a) + sha256_maj(a,b,c);
        h=g; g=f; f=e; e=d+t1; d=c; c=b; b=a; a=t1+t2;
    }

    ctx->h[0]+=a; ctx->h[1]+=b; ctx->h[2]+=c; ctx->h[3]+=d;
    ctx->h[4]+=e; ctx->h[5]+=f; ctx->h[6]+=g; ctx->h[7]+=h;
}

inline void sha256_init(SHA256Ctx* ctx) {
    ctx->h[0]=0x6a09e667u; ctx->h[1]=0xbb67ae85u;
    ctx->h[2]=0x3c6ef372u; ctx->h[3]=0xa54ff53au;
    ctx->h[4]=0x510e527fu; ctx->h[5]=0x9b05688cu;
    ctx->h[6]=0x1f83d9abu; ctx->h[7]=0x5be0cd19u;
    ctx->buf_len = 0; ctx->total_len = 0;
}

inline void sha256_update(SHA256Ctx* ctx, const uchar* data, uint len) {
    ctx->total_len += len;
    uint i = 0;
    if (ctx->buf_len > 0) {
        while (ctx->buf_len < 64 && i < len) ctx->buf[ctx->buf_len++] = data[i++];
        if (ctx->buf_len == 64) { sha256_compress(ctx, ctx->buf); ctx->buf_len = 0; }
    }
    while (i + 64 <= len) { sha256_compress(ctx, data + i); i += 64; }
    while (i < len) ctx->buf[ctx->buf_len++] = data[i++];
}

/* sha256_update variant that reads directly from __global memory using a
 * fixed 64-byte __private scratch buffer per block, so private/register cost
 * is O(1) regardless of total row length (rows can be multi-MB, e.g. real
 * Bitcoin transactions). Reuses the existing sha256_compress unchanged.
 * Mirrors sha256_update's own partial-buffer folding logic exactly. */
inline void sha256_update_global(SHA256Ctx* ctx, __global const uchar* data, uint len) {
    ctx->total_len += len;
    uint i = 0;
    if (ctx->buf_len > 0) {
        while (ctx->buf_len < 64 && i < len) ctx->buf[ctx->buf_len++] = data[i++];
        if (ctx->buf_len == 64) { sha256_compress(ctx, ctx->buf); ctx->buf_len = 0; }
    }
    uchar blk[64];
    while (i + 64 <= len) {
        for (uint j = 0; j < 64; ++j) blk[j] = data[i + j];
        sha256_compress(ctx, blk);
        i += 64;
    }
    while (i < len) ctx->buf[ctx->buf_len++] = data[i++];
}

inline void sha256_final(SHA256Ctx* ctx, uchar out[32]) {
    ulong bits = ctx->total_len * 8;
    uchar pad = 0x80;
    sha256_update(ctx, &pad, 1);
    uchar zero = 0;
    while (ctx->buf_len != 56) sha256_update(ctx, &zero, 1);
    uchar len_bytes[8];
    for (int i = 0; i < 8; i++) len_bytes[i] = (uchar)(bits >> (56 - i*8));
    sha256_update(ctx, len_bytes, 8);

    for (int i = 0; i < 8; i++) {
        out[i*4+0] = (uchar)(ctx->h[i] >> 24);
        out[i*4+1] = (uchar)(ctx->h[i] >> 16);
        out[i*4+2] = (uchar)(ctx->h[i] >> 8);
        out[i*4+3] = (uchar)(ctx->h[i]);
    }
}

inline void hmac_sha256_impl(const uchar* key, uint key_len,
                              const uchar* msg, uint msg_len,
                              uchar out[32]) {
    uchar k_pad[64];
    // If key > 64 bytes, hash it
    uchar key_hash[32];
    if (key_len > 64) {
        SHA256Ctx kctx; sha256_init(&kctx);
        sha256_update(&kctx, key, key_len);
        sha256_final(&kctx, key_hash);
        key = key_hash; key_len = 32;
    }

    // ipad = 0x36, opad = 0x5c
    for (uint i = 0; i < 64; i++) k_pad[i] = (i < key_len ? key[i] : 0) ^ 0x36;

    SHA256Ctx ictx; sha256_init(&ictx);
    sha256_update(&ictx, k_pad, 64);
    sha256_update(&ictx, msg, msg_len);
    uchar inner[32];
    sha256_final(&ictx, inner);

    for (uint i = 0; i < 64; i++) k_pad[i] = (i < key_len ? key[i] : 0) ^ 0x5c;

    SHA256Ctx octx; sha256_init(&octx);
    sha256_update(&octx, k_pad, 64);
    sha256_update(&octx, inner, 32);
    sha256_final(&octx, out);
}

inline void rfc6979_nonce_impl(const Scalar* priv, const uchar msg_hash[32], Scalar* k_out) {
    uchar priv_bytes[32];
    scalar_to_bytes_impl(priv, priv_bytes);

    // V = 0x01 * 32, K = 0x00 * 32
    uchar V[32], K_[32];
    for (int i = 0; i < 32; i++) { V[i] = 0x01; K_[i] = 0x00; }

    // K = HMAC_K(V || 0x00 || x || h)
    uchar hmac_input[97];
    for (int i = 0; i < 32; i++) hmac_input[i] = V[i];
    hmac_input[32] = 0x00;
    for (int i = 0; i < 32; i++) hmac_input[33+i] = priv_bytes[i];
    for (int i = 0; i < 32; i++) hmac_input[65+i] = msg_hash[i];
    hmac_sha256_impl(K_, 32, hmac_input, 97, K_);

    // V = HMAC_K(V)
    hmac_sha256_impl(K_, 32, V, 32, V);

    // K = HMAC_K(V || 0x01 || x || h)
    for (int i = 0; i < 32; i++) hmac_input[i] = V[i];
    hmac_input[32] = 0x01;
    hmac_sha256_impl(K_, 32, hmac_input, 97, K_);

    // V = HMAC_K(V)
    hmac_sha256_impl(K_, 32, V, 32, V);

    // Generate k — CT-GPU-002 fix: replaced data-dependent goto with break.
    // Logic unchanged: accept k iff k != 0 AND k < order (strict RFC 6979).
    int _found = 0;
    for (int attempt = 0; attempt < 100; attempt++) {
        hmac_sha256_impl(K_, 32, V, 32, V);
        scalar_from_bytes_impl(V, k_out);
        if (!scalar_is_zero(k_out)) {
            Scalar order;
            order.limbs[0] = ORDER_N0; order.limbs[1] = ORDER_N1;
            order.limbs[2] = ORDER_N2; order.limbs[3] = ORDER_N3;
            if (!scalar_ge_impl(k_out, &order)) { _found = 1; break; }
        }
        // Retry: K = HMAC_K(V || 0x00), V = HMAC_K(V)
        uchar retry_input[33];
        for (int i = 0; i < 32; i++) retry_input[i] = V[i];
        retry_input[32] = 0x00;
        hmac_sha256_impl(K_, 32, retry_input, 33, K_);
        hmac_sha256_impl(K_, 32, V, 32, V);
    }
    (void)_found;  // caller checks k_out == 0 on failure
    // Erase private key material from stack (Guardrail #10)
    for (int _i = 0; _i < 32; _i++) { priv_bytes[_i] = 0; }
    for (int _i = 0; _i < 32; _i++) { hmac_input[33 + _i] = 0; }
    for (int _i = 0; _i < 32; _i++) { K_[_i] = 0; V[_i] = 0; }
}

// =============================================================================
// CT Primitives (needed for constant-time signing paths — Guardrails #8, #14)
// =============================================================================
// Include order matters: ct_ops → ct_field → ct_scalar → ct_point

// =============================================================================
// LAYER 4: ECDSA Sign / Verify
// =============================================================================

typedef struct {
    Scalar r;
    Scalar s;
} ECDSASignature;

inline int lift_x_impl(const uchar x_bytes[32], JacobianPoint* p);

inline int lbtc_be32_lt_field_p(__global const uchar* x) {
    const uchar P[32] = {
        0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
        0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
        0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
        0xff, 0xff, 0xff, 0xfe, 0xff, 0xff, 0xfc, 0x2f
    };
    for (int i = 0; i < 32; ++i) {
        if (x[i] < P[i]) return 1;
        if (x[i] > P[i]) return 0;
    }
    return 0;
}

inline int lbtc_point_from_compressed(__global const uchar* pub, JacobianPoint* p) {
    const uchar prefix = pub[0];
    if (prefix != 0x02 && prefix != 0x03) return 0;
    if (!lbtc_be32_lt_field_p(pub + 1)) return 0;

    uchar x_bytes[32];
    for (int i = 0; i < 32; ++i) x_bytes[i] = pub[1 + i];
    if (!lift_x_impl(x_bytes, p)) return 0;

    if (prefix == 0x03)
        field_neg_impl(&p->y, &p->y);
    return 1;
}

inline int lbtc_scalar_ge_order(const Scalar* s) {
    const ulong n[4] = { ORDER_N0, ORDER_N1, ORDER_N2, ORDER_N3 };
    for (int i = 3; i >= 0; --i) {
        if (s->limbs[i] > n[i]) return 1;
        if (s->limbs[i] < n[i]) return 0;
    }
    return 1;
}

inline int lbtc_parse_opaque_scalar(__global const uchar* opaque, Scalar* out) {
    for (int i = 0; i < 4; ++i) {
        ulong limb = 0;
        for (int j = 0; j < 8; ++j)
            limb |= ((ulong)opaque[i * 8 + j]) << (j * 8);
        out->limbs[i] = limb;
    }
    return !scalar_is_zero(out) && !lbtc_scalar_ge_order(out);
}

inline int lbtc_parse_compact_scalar(__global const uchar* be, Scalar* out) {
    for (int limb = 0; limb < 4; ++limb) {
        ulong v = 0;
        const int base = (3 - limb) * 8;
        for (int j = 0; j < 8; ++j)
            v = (v << 8) | (ulong)be[base + j];
        out->limbs[limb] = v;
    }
    return !scalar_is_zero(out) && !lbtc_scalar_ge_order(out);
}

inline int lbtc_parse_compact_signature(__global const uchar* sig64,
                                        ECDSASignature* sig) {
    if (!lbtc_parse_compact_scalar(sig64, &sig->r)) return 0;
    if (!lbtc_parse_compact_scalar(sig64 + 32, &sig->s)) return 0;
    return 1;
}

inline int lbtc_parse_opaque_signature(__global const uchar* opaque,
                                       ECDSASignature* sig) {
    if (!lbtc_parse_opaque_scalar(opaque, &sig->r)) return 0;
    if (!lbtc_parse_opaque_scalar(opaque + 32, &sig->s)) return 0;

    // Libbitcoin consensus/direct opaque verification accepts both low-S and
    // high-S ECDSA forms. Low-S standardness belongs above this path; the device
    // parser must reject only non-scalars/zero scalars, not a valid high-S twin.
    return 1;
}

inline int ecdsa_sign_impl(const uchar msg_hash[32], const Scalar* priv, ECDSASignature* sig) {
    if (scalar_is_zero(priv)) return 0;

    Scalar z;
    scalar_from_bytes_impl(msg_hash, &z);

    Scalar k;
    rfc6979_nonce_impl(priv, msg_hash, &k);
    if (scalar_is_zero(&k)) return 0;

    // CT: k*G using constant-time GLV windowed mul (Guardrail #8)
    CTJacobianPoint R_ct;
    ct_generator_mul_impl(&k, &R_ct);
    JacobianPoint R = ct_point_to_jacobian(&R_ct);
    if (point_is_infinity(&R)) return 0;

    // r = R.x mod n
    FieldElement z_inv, z_inv2, rx_aff;
    field_inv_impl(&z_inv, &R.z);
    field_sqr_impl(&z_inv2, &z_inv);
    field_mul_impl(&rx_aff, &R.x, &z_inv2);

    uchar rx_bytes[32];
    field_to_bytes_impl(&rx_aff, rx_bytes);
    scalar_from_bytes_impl(rx_bytes, &sig->r);
    if (scalar_is_zero(&sig->r)) return 0;

    // s = k⁻¹ * (z + r*d) mod n  (CT: fixed-trace Fermat inverse — Guardrail #8)
    Scalar k_inv;
    ct_scalar_inverse_impl(&k, &k_inv);

    Scalar rd;
    scalar_mul_mod_n_impl(&sig->r, priv, &rd);

    Scalar z_plus_rd;
    scalar_add_mod_n_impl(&z, &rd, &z_plus_rd);

    scalar_mul_mod_n_impl(&k_inv, &z_plus_rd, &sig->s);
    if (scalar_is_zero(&sig->s)) return 0;

    // Low-S normalization — fully branchless CT conditional negate (P1-SEC-002 fix).
    // scalar_is_high_mask_impl returns all-ones mask without early-exit returns,
    // eliminating warp divergence on secret-derived s = f(k, d).
    {
        Scalar neg_s;
        scalar_negate_impl(&neg_s, &sig->s);
        const ulong mask = scalar_is_high_mask_impl(&sig->s);
        sig->s.limbs[0] = (sig->s.limbs[0] & ~mask) | (neg_s.limbs[0] & mask);
        sig->s.limbs[1] = (sig->s.limbs[1] & ~mask) | (neg_s.limbs[1] & mask);
        sig->s.limbs[2] = (sig->s.limbs[2] & ~mask) | (neg_s.limbs[2] & mask);
        sig->s.limbs[3] = (sig->s.limbs[3] & ~mask) | (neg_s.limbs[3] & mask);
    }

    return 1;
}

inline int ecdsa_verify_impl(const uchar msg_hash[32], const JacobianPoint* pubkey, const ECDSASignature* sig) {
    if (scalar_is_zero(&sig->r) || scalar_is_zero(&sig->s)) return 0;

    Scalar z;
    scalar_from_bytes_impl(msg_hash, &z);

    Scalar s_inv;
    scalar_inverse_impl(&sig->s, &s_inv);

    Scalar u1, u2;
    scalar_mul_mod_n_impl(&z, &s_inv, &u1);
    scalar_mul_mod_n_impl(&sig->r, &s_inv, &u2);

    AffinePoint G; get_generator(&G);

    // Convert pubkey to affine: fast-path when Z==1 (common case)
    AffinePoint pub_aff;
    if (pubkey->z.limbs[0] == 1 && pubkey->z.limbs[1] == 0 &&
        pubkey->z.limbs[2] == 0 && pubkey->z.limbs[3] == 0) {
        pub_aff.x = pubkey->x; pub_aff.y = pubkey->y;
    } else {
        FieldElement pz_inv, pz_inv2, pz_inv3;
        field_inv_impl(&pz_inv, &pubkey->z);
        field_sqr_impl(&pz_inv2, &pz_inv);
        field_mul_impl(&pz_inv3, &pz_inv2, &pz_inv);
        field_mul_impl(&pub_aff.x, &pubkey->x, &pz_inv2);
        field_mul_impl(&pub_aff.y, &pubkey->y, &pz_inv3);
    }

    // R = u1*G + u2*Q  using Shamir's trick (one interleaved loop)
    JacobianPoint R;
    shamir_double_mul_glv_impl(&G, &u1, &pub_aff, &u2, &R);
    if (point_is_infinity(&R)) return 0;

    // Check R.x mod n == r
    FieldElement rz_inv, rz_inv2, rx_aff;
    field_inv_impl(&rz_inv, &R.z);
    field_sqr_impl(&rz_inv2, &rz_inv);
    field_mul_impl(&rx_aff, &R.x, &rz_inv2);

    uchar rx_bytes[32];
    field_to_bytes_impl(&rx_aff, rx_bytes);
    Scalar rx_scalar;
    scalar_from_bytes_impl(rx_bytes, &rx_scalar);

    return scalar_eq_impl(&rx_scalar, &sig->r);
}

// =============================================================================
// LAYER 5a: Tagged Hash + Schnorr BIP-340
// =============================================================================

inline void tagged_hash_impl(const uchar* tag, uint tag_len,
                              const uchar* data, uint data_len,
                              uchar out[32]) {
    // H_tag(msg) = SHA256(SHA256(tag) || SHA256(tag) || msg)
    uchar tag_hash[32];
    SHA256Ctx ctx;
    sha256_init(&ctx);
    sha256_update(&ctx, tag, tag_len);
    sha256_final(&ctx, tag_hash);

    sha256_init(&ctx);
    sha256_update(&ctx, tag_hash, 32);
    sha256_update(&ctx, tag_hash, 32);
    sha256_update(&ctx, data, data_len);
    sha256_final(&ctx, out);
}

// BIP-340 tagged hash midstate precomputation.
// SHA256(tag||tag) for each BIP-340 tag is exactly 64 bytes (one block).
// These midstates are the SHA-256 internal state after compressing that block,
// saving 2 compressions per tagged_hash call.
#define BIP340_TAG_AUX       0
#define BIP340_TAG_NONCE     1
#define BIP340_TAG_CHALLENGE 2

__constant uint BIP340_MIDSTATES[3][8] = {
    // "BIP0340/aux"
    {0x24dd3219U, 0x4eba7e70U, 0xca0fabb9U, 0x0fa3166dU,
     0x3afbe4b1U, 0x4c44df97U, 0x4aac2739U, 0x249e850aU},
    // "BIP0340/nonce"
    {0x46615b35U, 0xf4bfbff7U, 0x9f8dc671U, 0x83627ab3U,
     0x60217180U, 0x57358661U, 0x21a29e54U, 0x68b07b4cU},
    // "BIP0340/challenge"
    {0x9cecba11U, 0x23925381U, 0x11679112U, 0xd1627e0fU,
     0x97c87550U, 0x003cc765U, 0x90f61164U, 0x33e9b66aU},
};

inline void tagged_hash_fast_impl(int tag_idx,
                                  const uchar* data, uint data_len,
                                  uchar out[32]) {
    SHA256Ctx ctx;
    for (int i = 0; i < 8; i++) ctx.h[i] = BIP340_MIDSTATES[tag_idx][i];
    ctx.buf_len = 0;
    ctx.total_len = 64;  // 64 bytes already processed (tag_hash||tag_hash)
    sha256_update(&ctx, data, data_len);
    sha256_final(&ctx, out);
}

// Lift x to curve point with even Y
inline int lift_x_impl(const uchar x_bytes[32], JacobianPoint* p) {
    FieldElement x;
    for (int i = 0; i < 4; i++) {
        ulong limb = 0;
        int base = (3 - i) * 8;
        for (int j = 0; j < 8; j++) limb = (limb << 8) | (ulong)x_bytes[base + j];
        x.limbs[i] = limb;
    }

    FieldElement x2, x3, y2, seven, y;
    field_sqr_impl(&x2, &x);
    field_mul_impl(&x3, &x2, &x);
    seven.limbs[0] = 7; seven.limbs[1] = 0; seven.limbs[2] = 0; seven.limbs[3] = 0;
    field_add_impl(&y2, &x3, &seven);

    field_sqrt_impl(&y2, &y);

    // Verify: y² == y2 (compare via normalized bytes to handle unreduced limbs)
    FieldElement y_check;
    field_sqr_impl(&y_check, &y);
    uchar yc_bytes[32], y2_bytes[32];
    field_to_bytes_impl(&y_check, yc_bytes);
    field_to_bytes_impl(&y2, y2_bytes);
    int valid = 1;
    for (int i = 0; i < 32; i++)
        if (yc_bytes[i] != y2_bytes[i]) valid = 0;
    if (!valid) return 0;

    // Ensure even Y
    uchar y_bytes[32];
    field_to_bytes_impl(&y, y_bytes);
    if (y_bytes[31] & 1) {
        field_neg_impl(&y, &y);
    }

    p->x = x; p->y = y;
    p->z.limbs[0] = 1; p->z.limbs[1] = 0; p->z.limbs[2] = 0; p->z.limbs[3] = 0;
    p->infinity = 0;
    return 1;
}

typedef struct {
    uchar r[32];
    Scalar s;
} SchnorrSignature;

inline int schnorr_sign_impl(const Scalar* priv, const uchar msg[32],
                               const uchar aux_rand[32], SchnorrSignature* sig) {
    if (scalar_is_zero(priv)) return 0;

    // P = d' * G  (CT: Guardrail #8)
    CTJacobianPoint P_ct;
    ct_generator_mul_impl(priv, &P_ct);
    JacobianPoint P = ct_point_to_jacobian(&P_ct);
    if (point_is_infinity(&P)) return 0;

    // Convert to affine
    FieldElement z_inv, z_inv2, z_inv3, px, py;
    field_inv_impl(&z_inv, &P.z);
    field_sqr_impl(&z_inv2, &z_inv);
    field_mul_impl(&z_inv3, &z_inv2, &z_inv);
    field_mul_impl(&px, &P.x, &z_inv2);
    field_mul_impl(&py, &P.y, &z_inv3);

    // If Y is odd, negate d (MEDIUM-4: branchless cmov to avoid warp divergence)
    uchar py_bytes[32];
    field_to_bytes_impl(&py, py_bytes);
    Scalar d = *priv;
    Scalar neg_d;
    scalar_negate_impl(priv, &neg_d);
    {
        ulong mask = -(ulong)((py_bytes[31] & 1) != 0);
        for (int _i = 0; _i < 4; _i++)
            d.limbs[_i] = (neg_d.limbs[_i] & mask) | (d.limbs[_i] & ~mask);
    }

    uchar px_bytes[32];
    field_to_bytes_impl(&px, px_bytes);

    // t = d XOR tagged_hash("BIP0340/aux", aux_rand)
    uchar t_hash[32];
    tagged_hash_fast_impl(BIP340_TAG_AUX, aux_rand, 32, t_hash);

    uchar d_bytes[32];
    scalar_to_bytes_impl(&d, d_bytes);

    uchar t[32];
    for (int i = 0; i < 32; i++) t[i] = d_bytes[i] ^ t_hash[i];

    // rand = tagged_hash("BIP0340/nonce", t || px || msg)
    uchar nonce_input[96];
    for (int i = 0; i < 32; i++) nonce_input[i] = t[i];
    for (int i = 0; i < 32; i++) nonce_input[32+i] = px_bytes[i];
    for (int i = 0; i < 32; i++) nonce_input[64+i] = msg[i];

    uchar rand_hash[32];
    tagged_hash_fast_impl(BIP340_TAG_NONCE, nonce_input, 96, rand_hash);

    Scalar k_prime;
    scalar_from_bytes_impl(rand_hash, &k_prime);
    if (scalar_is_zero(&k_prime)) return 0;

    // R = k' * G  (CT: Guardrail #8)
    CTJacobianPoint R_schnorr_ct;
    ct_generator_mul_impl(&k_prime, &R_schnorr_ct);
    JacobianPoint R = ct_point_to_jacobian(&R_schnorr_ct);

    FieldElement rz_inv, rz_inv2, rz_inv3, rx, ry;
    field_inv_impl(&rz_inv, &R.z);
    field_sqr_impl(&rz_inv2, &rz_inv);
    field_mul_impl(&rz_inv3, &rz_inv2, &rz_inv);
    field_mul_impl(&rx, &R.x, &rz_inv2);
    field_mul_impl(&ry, &R.y, &rz_inv3);

    uchar ry_bytes[32];
    field_to_bytes_impl(&ry, ry_bytes);
    // MEDIUM-4: branchless cmov to avoid warp divergence on secret nonce parity
    Scalar k = k_prime;
    Scalar neg_k;
    scalar_negate_impl(&k_prime, &neg_k);
    {
        ulong mask = -(ulong)((ry_bytes[31] & 1) != 0);
        for (int _i = 0; _i < 4; _i++)
            k.limbs[_i] = (neg_k.limbs[_i] & mask) | (k.limbs[_i] & ~mask);
    }

    field_to_bytes_impl(&rx, sig->r);

    // e = tagged_hash("BIP0340/challenge", R.x || px || msg) mod n
    uchar challenge_input[96];
    for (int i = 0; i < 32; i++) challenge_input[i] = sig->r[i];
    for (int i = 0; i < 32; i++) challenge_input[32+i] = px_bytes[i];
    for (int i = 0; i < 32; i++) challenge_input[64+i] = msg[i];

    uchar e_hash[32];
    tagged_hash_fast_impl(BIP340_TAG_CHALLENGE, challenge_input, 96, e_hash);

    Scalar e;
    scalar_from_bytes_impl(e_hash, &e);

    // s = k + e * d mod n  (CT: apply value barriers to secret operands d and k)
    Scalar ed;
    {
        Scalar d_ct = d, k_ct = k;
        for (int _i = 0; _i < 4; ++_i) {
            volatile ulong _vb_d = d_ct.limbs[_i]; d_ct.limbs[_i] = _vb_d;
            volatile ulong _vb_k = k_ct.limbs[_i]; k_ct.limbs[_i] = _vb_k;
        }
        scalar_mul_mod_n_impl(&e, &d_ct, &ed);
        scalar_add_mod_n_impl(&k_ct, &ed, &sig->s);
    }

    /* Reject s == 0 (BIP-340) */
    if (scalar_is_zero(&sig->s)) return 0;

    /* Reject r == all-zeros (Guardrail #14: must check BOTH r and s) */
    {
        int _r_zero = 1;
        for (int _i = 0; _i < 32; _i++) { if (sig->r[_i]) { _r_zero = 0; break; } }
        if (_r_zero) return 0;
    }

    return 1;
}

inline int schnorr_verify_impl(const uchar pubkey_x[32], const uchar msg[32],
                                 const SchnorrSignature* sig) {
    if (scalar_is_zero(&sig->s)) return 0;

    JacobianPoint P;
    if (!lift_x_impl(pubkey_x, &P)) return 0;

    uchar challenge_input[96];
    for (int i = 0; i < 32; i++) challenge_input[i] = sig->r[i];
    for (int i = 0; i < 32; i++) challenge_input[32+i] = pubkey_x[i];
    for (int i = 0; i < 32; i++) challenge_input[64+i] = msg[i];

    uchar e_hash[32];
    tagged_hash_fast_impl(BIP340_TAG_CHALLENGE, challenge_input, 96, e_hash);

    Scalar e;
    scalar_from_bytes_impl(e_hash, &e);

    // R = s*G - e*P  using Shamir's trick (one interleaved loop, saves ~130 doubles)
    AffinePoint G; get_generator(&G);

    // lift_x_impl returns Z=1, so P is already affine -- no field_inv needed
    AffinePoint p_aff; p_aff.x = P.x; p_aff.y = P.y;

    // Negate e for: R = s*G + (-e)*P
    Scalar neg_e;
    scalar_negate_impl(&e, &neg_e);

    JacobianPoint Rpt;
    shamir_double_mul_glv_impl(&G, &sig->s, &p_aff, &neg_e, &Rpt);
    if (point_is_infinity(&Rpt)) return 0;

    FieldElement rz_inv, rz_inv2, rz_inv3, rx_aff, ry_aff;
    field_inv_impl(&rz_inv, &Rpt.z);
    field_sqr_impl(&rz_inv2, &rz_inv);
    field_mul_impl(&rz_inv3, &rz_inv2, &rz_inv);
    field_mul_impl(&rx_aff, &Rpt.x, &rz_inv2);
    field_mul_impl(&ry_aff, &Rpt.y, &rz_inv3);

    uchar ry_bytes[32];
    field_to_bytes_impl(&ry_aff, ry_bytes);
    if (ry_bytes[31] & 1) return 0; // must have even Y

    uchar rx_bytes[32];
    field_to_bytes_impl(&rx_aff, rx_bytes);
    for (int i = 0; i < 32; i++)
        if (rx_bytes[i] != sig->r[i]) return 0;

    return 1;
}

// =============================================================================
// LAYER 5b: ECDH
// =============================================================================

// P1-SEC-001 FIX: constant-time scalar multiplication for ECDH on a variable
// base point (AffinePoint input).  The GLV/wNAF path (scalar_mul_glv_impl) is
// variable-time and MUST NOT be used when the scalar is a private key.
// This replicates the same bit-by-bit double-and-add CT loop used by
// ct_ecdh_scalar_mul() in secp256k1_ecdh.cl, adapted for the AffinePoint type
// used by the extended kernel.  No GLV, no wNAF, no data-dependent branches on
// the scalar value.
inline void ct_ecdh_scalar_mul_affine(JacobianPoint* r,
                                       const AffinePoint* pk,
                                       const Scalar* sk)
{
    // Lift the affine peer pubkey to Jacobian (Z=1).
    JacobianPoint P;
    point_from_affine(&P, pk);

    JacobianPoint R, T;
    point_set_infinity(&R);

    for (int i = 255; i >= 0; --i) {
        point_double_impl(&R, &R);
        point_add_impl(&T, &R, &P);

        // CT select: if bit i of sk is 1, R = T; else R = R.
        int word = i >> 6;
        int bit  = (int)((sk->limbs[word] >> (i & 63)) & 1UL);
        ulong mask = -(ulong)bit;
        for (int j = 0; j < 4; ++j) {
            R.x.limbs[j] ^= mask & (R.x.limbs[j] ^ T.x.limbs[j]);
            R.y.limbs[j] ^= mask & (R.y.limbs[j] ^ T.y.limbs[j]);
            R.z.limbs[j] ^= mask & (R.z.limbs[j] ^ T.z.limbs[j]);
        }
        R.infinity = (int)(((uint)R.infinity & (uint)~(uint)mask) |
                           ((uint)T.infinity & (uint)mask));
    }
    *r = R;
}

inline int ecdh_compute_raw_impl(const Scalar* priv, const AffinePoint* peer, uchar out[32]) {
    JacobianPoint shared;
    ct_ecdh_scalar_mul_affine(&shared, peer, priv);  // P1-SEC-001: CT path
    if (point_is_infinity(&shared)) return 0;

    FieldElement z_inv, z_inv2, x_aff;
    field_inv_impl(&z_inv, &shared.z);
    field_sqr_impl(&z_inv2, &z_inv);
    field_mul_impl(&x_aff, &shared.x, &z_inv2);
    field_to_bytes_impl(&x_aff, out);
    return 1;
}

inline int ecdh_compute_xonly_impl(const Scalar* priv, const AffinePoint* peer, uchar out[32]) {
    uchar x_bytes[32];
    if (!ecdh_compute_raw_impl(priv, peer, x_bytes)) return 0;

    SHA256Ctx ctx; sha256_init(&ctx);
    sha256_update(&ctx, x_bytes, 32);
    sha256_final(&ctx, out);
    return 1;
}

inline int ecdh_compute_impl(const Scalar* priv, const AffinePoint* peer, uchar out[32]) {
    // BUG-3 FIX: cannot use ecdh_compute_raw_impl here — it discards y_aff, making it
    // impossible to derive the correct compressed-point prefix.  Inline the computation
    // so we have y_aff and can determine Y parity.  Previously hardcoded 0x02 produced
    // wrong output for ~50% of key pairs (odd-Y shared point).
    // P1-SEC-001 FIX: use CT path — private key is secret, VT wNAF is banned here.
    JacobianPoint shared;
    ct_ecdh_scalar_mul_affine(&shared, peer, priv);  // P1-SEC-001: CT path
    if (point_is_infinity(&shared)) return 0;

    FieldElement z_inv, z_inv2, z_inv3, x_aff, y_aff;
    field_inv_impl(&z_inv, &shared.z);
    field_sqr_impl(&z_inv2, &z_inv);
    field_mul_impl(&z_inv3, &z_inv, &z_inv2);
    field_mul_impl(&x_aff, &shared.x, &z_inv2);
    field_mul_impl(&y_aff, &shared.y, &z_inv3);

    uchar x_bytes[32];
    field_to_bytes_impl(&x_aff, x_bytes);

    // limbs[0] is the least-significant 64-bit word; bit 0 is the Y parity.
    uchar prefix = (y_aff.limbs[0] & 1UL) ? 0x03 : 0x02;
    SHA256Ctx ctx; sha256_init(&ctx);
    sha256_update(&ctx, &prefix, 1);
    sha256_update(&ctx, x_bytes, 32);
    sha256_final(&ctx, out);
    return 1;
}

// =============================================================================
// LAYER 5c: Key Recovery
// =============================================================================

typedef struct {
    ECDSASignature sig;
    int recid;
} RecoverableSignature;

inline int ecdsa_sign_recoverable_impl(const uchar msg_hash[32], const Scalar* priv,
                                         RecoverableSignature* rsig) {
    if (scalar_is_zero(priv)) return 0;

    Scalar z;
    scalar_from_bytes_impl(msg_hash, &z);

    Scalar k;
    rfc6979_nonce_impl(priv, msg_hash, &k);
    if (scalar_is_zero(&k)) return 0;

    // CT: R = k*G (no secret-dependent branches on nonce k)
    CTJacobianPoint R_ct;
    ct_generator_mul_impl(&k, &R_ct);
    FieldElement rx_aff, ry_aff;
    ct_jacobian_to_affine(&R_ct, &rx_aff, &ry_aff);

    uchar rx_bytes[32];
    field_to_bytes_impl(&rx_aff, rx_bytes);
    scalar_from_bytes_impl(rx_bytes, &rsig->sig.r);
    if (scalar_is_zero(&rsig->sig.r)) return 0;

    int recid = 0;
    uchar ry_bytes[32];
    field_to_bytes_impl(&ry_aff, ry_bytes);
    if (ry_bytes[31] & 1) recid |= 1;

    // Check overflow (R.x >= n) — branchless MSB-cascade, no early exit
    {
        uchar order_be[32] = {
            0xFF,0xFF,0xFF,0xFF, 0xFF,0xFF,0xFF,0xFF,
            0xFF,0xFF,0xFF,0xFF, 0xFF,0xFF,0xFF,0xFE,
            0xBA,0xAE,0xDC,0xE6, 0xAF,0x48,0xA0,0x3B,
            0xBF,0xD2,0x5E,0x8C, 0xD0,0x36,0x41,0x41
        };
        uint gt = 0u, eq_run = 1u;
        for (int i = 0; i < 32; i++) {
            uint rb = (uint)rx_bytes[i], ob = (uint)order_be[i];
            uint byte_gt = ((ob - rb) >> 31) & 1u;
            uint byte_lt = ((rb - ob) >> 31) & 1u;
            gt     = gt | (eq_run & byte_gt);
            eq_run = eq_run & (1u - byte_gt) & (1u - byte_lt);
        }
        recid |= (int)(gt << 1);
    }

    // s = k⁻¹(z + r*d) mod n
    Scalar k_inv;
    scalar_inverse_impl(&k, &k_inv);
    Scalar rd;
    scalar_mul_mod_n_impl(&rsig->sig.r, priv, &rd);
    Scalar z_plus_rd;
    scalar_add_mod_n_impl(&z, &rd, &z_plus_rd);
    scalar_mul_mod_n_impl(&k_inv, &z_plus_rd, &rsig->sig.s);
    if (scalar_is_zero(&rsig->sig.s)) return 0;

    if (!scalar_is_low_s_impl(&rsig->sig.s)) {
        scalar_negate_impl(&rsig->sig.s, &rsig->sig.s);
        recid ^= 1;
    }

    rsig->recid = recid;
    return 1;
}

// Lift x as FieldElement with parity control
inline int lift_x_field_impl(const FieldElement* x_fe, int parity, JacobianPoint* p) {
    FieldElement x2, x3, y2, seven, y;
    field_sqr_impl(&x2, x_fe);
    field_mul_impl(&x3, &x2, x_fe);
    seven.limbs[0]=7; seven.limbs[1]=0; seven.limbs[2]=0; seven.limbs[3]=0;
    field_add_impl(&y2, &x3, &seven);
    field_sqrt_impl(&y2, &y);

    // Verify: y² == y2 (compare via normalized bytes to handle unreduced limbs)
    FieldElement y_check;
    field_sqr_impl(&y_check, &y);
    uchar yc_bytes2[32], y2_bytes2[32];
    field_to_bytes_impl(&y_check, yc_bytes2);
    field_to_bytes_impl(&y2, y2_bytes2);
    int valid = 1;
    for (int i = 0; i < 32; i++)
        if (yc_bytes2[i] != y2_bytes2[i]) valid = 0;
    if (!valid) return 0;

    uchar y_bytes[32];
    field_to_bytes_impl(&y, y_bytes);
    int y_is_odd = (y_bytes[31] & 1) != 0;
    if ((parity != 0) != y_is_odd) {
        field_neg_impl(&y, &y);
    }

    p->x = *x_fe; p->y = y;
    p->z.limbs[0]=1; p->z.limbs[1]=0; p->z.limbs[2]=0; p->z.limbs[3]=0;
    p->infinity = 0;
    return 1;
}

inline int ecdsa_recover_impl(const uchar msg_hash[32], const ECDSASignature* sig,
                                int recid, JacobianPoint* Q) {
    if (recid < 0 || recid > 3) return 0;
    if (scalar_is_zero(&sig->r) || scalar_is_zero(&sig->s)) return 0;

    // Reconstruct R.x
    FieldElement rx_fe;
    uchar r_bytes[32];
    scalar_to_bytes_impl(&sig->r, r_bytes);
    for (int i = 0; i < 4; i++) {
        ulong limb = 0;
        int base = (3 - i) * 8;
        for (int j = 0; j < 8; j++) limb = (limb << 8) | (ulong)r_bytes[base + j];
        rx_fe.limbs[i] = limb;
    }

    if (recid & 2) {
        // bbhunt-001: reject r >= (p - n), else r+n wraps mod p to a wrong x and
        // could yield a bogus pubkey as success where upstream returns 0.
        // p - n little-endian 64-bit limbs (recid/sig are public data):
        const ulong PMN0 = 0x402DA1722FC9BAEEUL;
        const ulong PMN1 = 0x4551231950B75FC4UL;
        const ulong PMN2 = 0x0000000000000001UL;
        const ulong PMN3 = 0x0000000000000000UL;
        int r_ge_pmn;
        if      (rx_fe.limbs[3] != PMN3) r_ge_pmn = (rx_fe.limbs[3] > PMN3);
        else if (rx_fe.limbs[2] != PMN2) r_ge_pmn = (rx_fe.limbs[2] > PMN2);
        else if (rx_fe.limbs[1] != PMN1) r_ge_pmn = (rx_fe.limbs[1] > PMN1);
        else                             r_ge_pmn = (rx_fe.limbs[0] >= PMN0);
        if (r_ge_pmn) return 0;

        FieldElement n_fe;
        n_fe.limbs[0] = ORDER_N0; n_fe.limbs[1] = ORDER_N1;
        n_fe.limbs[2] = ORDER_N2; n_fe.limbs[3] = ORDER_N3;
        field_add_impl(&rx_fe, &rx_fe, &n_fe);
    }

    int y_parity = recid & 1;
    JacobianPoint Rpt;
    if (!lift_x_field_impl(&rx_fe, y_parity, &Rpt)) return 0;

    // Q = r⁻¹ * (s*R - z*G)
    Scalar z;
    scalar_from_bytes_impl(msg_hash, &z);

    Scalar r_inv;
    scalar_inverse_impl(&sig->r, &r_inv);

    // s*R  (need affine for scalar_mul_impl)
    FieldElement pz_inv, pz_inv2, pz_inv3;
    field_inv_impl(&pz_inv, &Rpt.z);
    field_sqr_impl(&pz_inv2, &pz_inv);
    field_mul_impl(&pz_inv3, &pz_inv2, &pz_inv);
    AffinePoint r_aff;
    field_mul_impl(&r_aff.x, &Rpt.x, &pz_inv2);
    field_mul_impl(&r_aff.y, &Rpt.y, &pz_inv3);

    JacobianPoint sR;
    scalar_mul_glv_impl(&sR, &sig->s, &r_aff);

    AffinePoint G; get_generator(&G);
    JacobianPoint zG;
    scalar_mul_glv_impl(&zG, &z, &G);

    point_negate_y(&zG);
    JacobianPoint sR_minus_zG;
    point_add_impl(&sR_minus_zG, &sR, &zG);

    // Convert to affine for final scalar_mul
    FieldElement qz_inv, qz_inv2, qz_inv3;
    field_inv_impl(&qz_inv, &sR_minus_zG.z);
    field_sqr_impl(&qz_inv2, &qz_inv);
    field_mul_impl(&qz_inv3, &qz_inv2, &qz_inv);
    AffinePoint diff_aff;
    field_mul_impl(&diff_aff.x, &sR_minus_zG.x, &qz_inv2);
    field_mul_impl(&diff_aff.y, &sR_minus_zG.y, &qz_inv3);

    scalar_mul_glv_impl(Q, &r_inv, &diff_aff);

    if (point_is_infinity(Q)) return 0;
    return 1;
}

// =============================================================================
// LAYER 5d: MSM (Multi-Scalar Multiplication)
// =============================================================================

// Extract c-bit window from scalar
inline uint scalar_get_window_impl(const Scalar* s, int window_idx, int c) {
    int bit_offset = window_idx * c;
    int limb_idx = bit_offset / 64;
    int bit_idx = bit_offset % 64;
    if (limb_idx >= 4) return 0;

    uint val = (uint)((s->limbs[limb_idx] >> bit_idx) & ((1UL << c) - 1));
    int bits_from_first = 64 - bit_idx;
    if (bits_from_first < c && limb_idx + 1 < 4) {
        int remaining = c - bits_from_first;
        val |= (uint)(s->limbs[limb_idx+1] & ((1UL << remaining) - 1)) << bits_from_first;
    }
    return val;
}

// Naive MSM: sum of individual scalar multiplications
inline void msm_naive_impl(const Scalar* scalars, const AffinePoint* points,
                             int n, JacobianPoint* result) {
    point_set_infinity(result);
    for (int i = 0; i < n; i++) {
        if (scalar_is_zero(&scalars[i])) continue;
        JacobianPoint tmp;
        scalar_mul_glv_impl(&tmp, &scalars[i], &points[i]);
        if (point_is_infinity(result)) {
            *result = tmp;
        } else {
            JacobianPoint sum;
            point_add_impl(&sum, result, &tmp);
            *result = sum;
        }
    }
}

// Pippenger bucket MSM
inline void msm_pippenger_impl(const Scalar* scalars, const AffinePoint* points,
                                 int n, JacobianPoint* result,
                                 JacobianPoint* buckets, int c) {
    int num_buckets = 1 << c;
    int num_windows = (256 + c - 1) / c;

    point_set_infinity(result);

    for (int w = num_windows - 1; w >= 0; w--) {
        if (!point_is_infinity(result)) {
            for (int d = 0; d < c; d++) {
                JacobianPoint dbl;
                point_double_impl(&dbl, result);
                *result = dbl;
            }
        }

        for (int b = 0; b < num_buckets; b++) point_set_infinity(&buckets[b]);

        for (int i = 0; i < n; i++) {
            uint digit = scalar_get_window_impl(&scalars[i], w, c);
            if (digit == 0) continue;
            if (point_is_infinity(&buckets[digit])) {
                point_from_affine(&buckets[digit], &points[i]);
            } else {
                JacobianPoint sum;
                point_add_mixed_impl(&sum, &buckets[digit], &points[i]);
                buckets[digit] = sum;
            }
        }

        JacobianPoint running_sum, partial_sum;
        point_set_infinity(&running_sum);
        point_set_infinity(&partial_sum);

        for (int b = num_buckets - 1; b >= 1; b--) {
            if (!point_is_infinity(&buckets[b])) {
                if (point_is_infinity(&running_sum)) {
                    running_sum = buckets[b];
                } else {
                    JacobianPoint sum;
                    point_add_impl(&sum, &running_sum, &buckets[b]);
                    running_sum = sum;
                }
            }
            if (!point_is_infinity(&running_sum)) {
                if (point_is_infinity(&partial_sum)) {
                    partial_sum = running_sum;
                } else {
                    JacobianPoint sum;
                    point_add_impl(&sum, &partial_sum, &running_sum);
                    partial_sum = sum;
                }
            }
        }

        if (!point_is_infinity(&partial_sum)) {
            if (point_is_infinity(result)) {
                *result = partial_sum;
            } else {
                JacobianPoint sum;
                point_add_impl(&sum, result, &partial_sum);
                *result = sum;
            }
        }
    }
}

// =============================================================================
// OpenCL Dispatch Kernels — Extended Operations
// =============================================================================

#ifndef SECP256K1_CT_SIGN_KERNELS
// Variable-time signing kernel — superseded by secp256k1_ct_extended.cl when
// SECP256K1_CT_SIGN_KERNELS is defined. Do NOT dispatch on secret inputs.
__kernel void ecdsa_sign(
    __global const uchar* msg_hashes,       // n * 32 bytes
    __global const Scalar* private_keys,
    __global ECDSASignature* signatures,
    __global int* success_flags,
    const uint count
) {
    uint gid = get_global_id(0);
    if (gid >= count) return;

    uchar msg[32];
    for (int i = 0; i < 32; i++) msg[i] = msg_hashes[gid * 32 + i];

    Scalar priv = private_keys[gid];
    ECDSASignature sig;
    success_flags[gid] = ecdsa_sign_impl(msg, &priv, &sig);
    signatures[gid] = sig;
}
#endif /* SECP256K1_CT_SIGN_KERNELS */

__kernel void ecdsa_verify(
    __global const uchar* msg_hashes,
    __global const JacobianPoint* pubkeys,
    __global const ECDSASignature* signatures,
    __global int* results,
    const uint count
) {
    uint gid = get_global_id(0);
    if (gid >= count) return;

    uchar msg[32];
    for (int i = 0; i < 32; i++) msg[i] = msg_hashes[gid * 32 + i];

    JacobianPoint pub = pubkeys[gid];
    ECDSASignature sig = signatures[gid];
    results[gid] = ecdsa_verify_impl(msg, &pub, &sig);
}

/* ecdsa_verify_compressed — GPU-side pubkey decompression variant.
 * Takes 33-byte SEC1 compressed pubkeys directly (no CPU decompress).
 * Decompresses in registers via lbtc_point_from_compressed → verify.
 * Eliminates CPU sqrt+parity, host JacobianPoint buffer, and 3.2x PCIe data. */
__kernel void ecdsa_verify_compressed(
    __global const uchar* msg_hashes,
    __global const uchar* pubkeys33,
    __global const uchar* signatures,
    __global int* results,
    const uint count
) {
    uint gid = get_global_id(0);
    if (gid >= count) return;

    uchar msg[32];
    for (int i = 0; i < 32; i++) msg[i] = msg_hashes[gid * 32 + i];

    JacobianPoint pub;
    if (!lbtc_point_from_compressed(pubkeys33 + gid * 33, &pub)) {
        results[gid] = 0;
        return;
    }

    ECDSASignature sig;
    int ok = lbtc_parse_compact_signature(signatures + gid * 64, &sig);
    results[gid] = ok ? ecdsa_verify_impl(msg, &pub, &sig) : 0;
}

__kernel void ecdsa_verify_lbtc_rows(
    __global const uchar* rows,
    const ulong stride,
    __global int* results,
    const uint count
) {
    uint gid = get_global_id(0);
    if (gid >= count) return;

    __global const uchar* row = rows + ((ulong)gid * stride);
    uchar msg[32];
    for (int i = 0; i < 32; ++i) msg[i] = row[i];

    JacobianPoint pub;
    ECDSASignature sig;
    int ok = lbtc_point_from_compressed(row + 32, &pub) &&
             lbtc_parse_opaque_signature(row + 65, &sig);
    results[gid] = ok ? ecdsa_verify_impl(msg, &pub, &sig) : 0;
}

/* libbitcoin ECDSA COLUMN verify — Structure-of-Arrays sibling of
 * ecdsa_verify_lbtc_rows. Three separate column spans; opaque-LE signature and
 * 33-byte compressed pubkey parsed device-side. 64-bit (ulong) row offsets. */
__kernel void ecdsa_verify_lbtc_columns(
    __global const uchar* digests32,
    __global const uchar* pubkeys33,
    __global const uchar* sigs64,
    __global int* results,
    const uint count
) {
    uint gid = get_global_id(0);
    if (gid >= count) return;

    uchar msg[32];
    for (int i = 0; i < 32; ++i) msg[i] = digests32[(ulong)gid * 32 + i];

    JacobianPoint pub;
    ECDSASignature sig;
    int ok = lbtc_point_from_compressed(pubkeys33 + (ulong)gid * 33, &pub) &&
             lbtc_parse_opaque_signature(sigs64 + (ulong)gid * 64, &sig);
    results[gid] = ok ? ecdsa_verify_impl(msg, &pub, &sig) : 0;
}

/* libbitcoin Schnorr COLUMN verify — digests32 | xonly32 | sigs64 (BIP-340).
 * The BIP-340 signature is parsed device-side: r is the raw 32 big-endian R.x
 * bytes; s is a big-endian scalar loaded into 4 little-endian limbs (identical to
 * the host be32_to_le_limbs used by schnorr_verify_batch). 64-bit row offsets. */
__kernel void schnorr_verify_lbtc_columns(
    __global const uchar* digests32,
    __global const uchar* xonly32,
    __global const uchar* sigs64,
    __global int* results,
    const uint count
) {
    uint gid = get_global_id(0);
    if (gid >= count) return;

    uchar pk[32], msg[32];
    for (int i = 0; i < 32; ++i) {
        pk[i]  = xonly32[(ulong)gid * 32 + i];
        msg[i] = digests32[(ulong)gid * 32 + i];
    }

    SchnorrSignature sig;
    const ulong base = (ulong)gid * 64;
    for (int i = 0; i < 32; ++i) sig.r[i] = sigs64[base + i];
    for (int limb = 0; limb < 4; ++limb) {
        ulong v = 0;
        const int b = 32 + (3 - limb) * 8;
        for (int j = 0; j < 8; ++j) v = (v << 8) | (ulong)sigs64[base + b + j];
        sig.s.limbs[limb] = v;
    }
    // BIP-340 strict: reject s == 0 and s >= n before verifying so the column
    // verdict matches the CPU reference (SchnorrSignature::parse_strict). Without
    // this, s' = s + n (>= n) maps to the same point as a valid s and would be a
    // false-accept on GPU while the CPU rejects it (signature malleability).
    if (scalar_is_zero(&sig.s) || lbtc_scalar_ge_order(&sig.s)) {
        results[gid] = 0;
        return;
    }
    results[gid] = schnorr_verify_impl(pk, msg, &sig);
}

/* libbitcoin ECDSA COLLECT verify — SoA sibling of ecdsa_verify_lbtc_columns
 * with the collect output convention: key_cells is a 1-byte-per-row verdict
 * channel PRE-SEEDED non-zero by the host. The verdict is bit-for-bit identical
 * to ecdsa_verify_lbtc_columns; only the encoding differs. VALID  -> write 0.
 * INVALID (bad parse OR failed verify) -> leave the caller's seed untouched so
 * the rejected id survives (fail-closed collect contract). Never write non-zero. */
__kernel void ecdsa_verify_lbtc_collect(
    __global const uchar* digests32,
    __global const uchar* pubkeys33,
    __global const uchar* sigs64,
    __global uchar* key_cells,
    const uint count
) {
    uint gid = get_global_id(0);
    if (gid >= count) return;

    uchar msg[32];
    for (int i = 0; i < 32; ++i) msg[i] = digests32[(ulong)gid * 32 + i];

    JacobianPoint pub;
    ECDSASignature sig;
    // COMPACT (big-endian r||s) — the collect ABI uses the SAME sig format as
    // ufsecp_gpu_ecdsa_verify_batch (kernel ecdsa_verify_compressed parses via
    // lbtc_parse_compact_signature) and the CUDA collect (bytes_to_ecdsa_sig over
    // compact[64]). NOT lbtc_parse_opaque_signature (little-endian libbitcoin-
    // columns format) — that mis-parses every row so no valid sig ever collects.
    int ok = lbtc_point_from_compressed(pubkeys33 + (ulong)gid * 33, &pub) &&
             lbtc_parse_compact_signature(sigs64 + (ulong)gid * 64, &sig);
    if (ok && ecdsa_verify_impl(msg, &pub, &sig)) key_cells[gid] = 0u; /* valid->0; invalid-> leave seeded */
}

/* libbitcoin Schnorr COLLECT verify — SoA sibling of schnorr_verify_lbtc_columns
 * with the collect output convention (see ecdsa_verify_lbtc_collect). The BIP-340
 * strict-s reject leaves the seed (bare return), NOT a 0 write. VALID -> write 0. */
__kernel void schnorr_verify_lbtc_collect(
    __global const uchar* digests32,
    __global const uchar* xonly32,
    __global const uchar* sigs64,
    __global uchar* key_cells,
    const uint count
) {
    uint gid = get_global_id(0);
    if (gid >= count) return;

    uchar pk[32], msg[32];
    for (int i = 0; i < 32; ++i) {
        pk[i]  = xonly32[(ulong)gid * 32 + i];
        msg[i] = digests32[(ulong)gid * 32 + i];
    }

    SchnorrSignature sig;
    const ulong base = (ulong)gid * 64;
    for (int i = 0; i < 32; ++i) sig.r[i] = sigs64[base + i];
    for (int limb = 0; limb < 4; ++limb) {
        ulong v = 0;
        const int b = 32 + (3 - limb) * 8;
        for (int j = 0; j < 8; ++j) v = (v << 8) | (ulong)sigs64[base + b + j];
        sig.s.limbs[limb] = v;
    }
    // BIP-340 strict: reject s == 0 and s >= n. For collect this is an INVALID
    // verdict -> leave the caller's seed (bare return), never write 0.
    if (scalar_is_zero(&sig.s) || lbtc_scalar_ge_order(&sig.s)) return; /* leave seeded */
    if (schnorr_verify_impl(pk, msg, &sig)) key_cells[gid] = 0u; /* valid->0; invalid-> leave seeded */
}

/* ============================================================================
 * libbitcoin-bridge PUBLIC-DATA GpuBackend ops — native OpenCL siblings of the
 * CUDA lbtc_* kernels (gpu_backend_cuda.cu @715-779). One item per work-item,
 * variable-time (all inputs are public: x-only / compressed pubkeys, taproot
 * commitment tuples, tagged-hash messages, hash256 preimages — no secret).
 * THREE parity invariants mirrored bit-for-bit from CUDA:
 *   (1) x<p is an EXTERNAL gate (lbtc_be32_lt_field_p, __global) applied BEFORE
 *       lift_x_impl (which only reduces mod p);
 *   (2) tweak is a RAW scalar via scalar_from_bytes_impl (single conditional -n),
 *       never rejected;
 *   (3) tagged hash feeds tag_hash32 TWICE then the message (SHA256(th||th||msg));
 *       tagged_hash_impl is NOT used (it re-hashes the tag).
 * CL1.2 has no generic address space: __global input bytes are copied into
 * private buffers before lift_x_impl / sha256_update, and sha256_final writes a
 * private digest that is then copied to the __global out. results/out are
 * __global uchar to match the CUDA uint8_t contract. ========================= */

/* result[i] = 1 iff keys32[i] is a valid BIP-340 x-only key (x<p, even-y lift). */
__kernel void lbtc_xonly_validate(
    __global const uchar* keys32,
    __global uchar* results,
    const uint count
) {
    uint gid = get_global_id(0);
    if (gid >= count) return;
    uchar x[32];
    for (int i = 0; i < 32; ++i) x[i] = keys32[(ulong)gid * 32 + i];
    JacobianPoint p;
    results[gid] = (lbtc_be32_lt_field_p(keys32 + (ulong)gid * 32) &&
                    lift_x_impl(x, &p)) ? 1 : 0;
}

/* result[i] = 1 iff prefix in {2,3}, x<p, and x lifts (on curve). Byte-matches
 * CUDA lbtc_pubkey_validate_kernel: prefix parity is NOT re-checked vs lift. */
__kernel void lbtc_pubkey_validate(
    __global const uchar* pubkeys33,
    __global uchar* results,
    const uint count
) {
    uint gid = get_global_id(0);
    if (gid >= count) return;
    __global const uchar* p = pubkeys33 + (ulong)gid * 33;
    uchar pfx = p[0];
    int ok = (pfx == 0x02 || pfx == 0x03) && lbtc_be32_lt_field_p(p + 1);
    if (ok) {
        uchar x[32];
        for (int i = 0; i < 32; ++i) x[i] = p[1 + i];
        JacobianPoint j;
        ok = lift_x_impl(x, &j);
    }
    results[gid] = ok ? 1 : 0;
}

/* result[i] = 1 iff x(lift_x_even(internal_i) + tweak_i*G) == tweaked_x_i AND its
 * y-parity == parity[i]. RAW tweak. Mirrors CUDA lbtc_commitment_kernel. */
__kernel void lbtc_commitment_verify(
    __global const uchar* internal_x32,
    __global const uchar* tweak32,
    __global const uchar* tweaked_x32,
    __global const uchar* parity,
    __global uchar* results,
    const uint count
) {
    uint gid = get_global_id(0);
    if (gid >= count) return;
    __global const uchar* ixp = internal_x32 + (ulong)gid * 32;
    uchar ix[32];
    for (int i = 0; i < 32; ++i) ix[i] = ixp[i];
    JacobianPoint P;
    if (!lbtc_be32_lt_field_p(ixp) || !lift_x_impl(ix, &P)) {  // even-y internal, x<p
        results[gid] = 0;
        return;
    }
    // lift_x_impl sets z=1, so the Jacobian coords are already affine.
    AffinePoint Pa; Pa.x = P.x; Pa.y = P.y;
    uchar tw[32];
    for (int i = 0; i < 32; ++i) tw[i] = tweak32[(ulong)gid * 32 + i];
    // Q = tweak*G + 1*P via the PROVEN Shamir path (same helper ecdsa_verify_impl
    // uses for u1*G + u2*Q). scalar_mul_generator_impl+point_add_mixed_unchecked
    // was avoided: point_add_mixed_unchecked mis-handles a mixed-add edge case for
    // certain Jacobian Z (e.g. 4*G, 7*G came out wrong) while scalar_mul_generator
    // itself is correct. shamir_double_mul_glv_impl is exercised by ecdsa verify.
    Scalar u1; scalar_from_bytes_impl(tw, &u1);        // RAW tweak (single -n)
    Scalar u2; u2.limbs[0] = 1; u2.limbs[1] = 0; u2.limbs[2] = 0; u2.limbs[3] = 0;  // scalar 1
    AffinePoint Gaff; get_generator(&Gaff);
    JacobianPoint Q;
    shamir_double_mul_glv_impl(&Gaff, &u1, &Pa, &u2, &Q);   // tweak*G + P
    if (point_is_infinity(&Q)) { results[gid] = 0; return; }
    // Inline Jacobian -> affine (jacobian_to_affine_impl lives in secp256k1_zk.cl,
    // which is NOT part of this translation unit); mirror ecdsa_verify_impl.
    FieldElement zinv, z2, z3, ax, ay;
    field_inv_impl(&zinv, &Q.z);
    field_sqr_impl(&z2, &zinv);
    field_mul_impl(&z3, &z2, &zinv);
    field_mul_impl(&ax, &Q.x, &z2);
    field_mul_impl(&ay, &Q.y, &z3);
    uchar xb[32], yb[32];
    field_to_bytes_impl(&ax, xb);
    field_to_bytes_impl(&ay, yb);
    uchar want = (parity[gid] != 0) ? 0x03 : 0x02;
    uchar got  = (yb[31] & 1) ? 0x03 : 0x02;              // y-parity of x(Q)
    uchar ok = (got == want) ? 1 : 0;
    for (int j = 0; j < 32; ++j)
        if (xb[j] != tweaked_x32[(ulong)gid * 32 + j]) ok = 0;   // x(Q)==tweaked_x
    results[gid] = ok;
}

/* out[i] = SHA256(tag_hash32 || tag_hash32 || msgs[i]) over fixed-length msgs. */
__kernel void lbtc_tagged_hash(
    __global const uchar* tag_hash32,
    __global const uchar* msgs,
    const uint msg_len,
    __global uchar* out32,
    const uint count
) {
    uint gid = get_global_id(0);
    if (gid >= count) return;
    uchar th[32];
    for (int i = 0; i < 32; ++i) th[i] = tag_hash32[i];
    uchar mbuf[256];
    for (uint i = 0; i < msg_len; ++i) mbuf[i] = msgs[(ulong)gid * msg_len + i];
    SHA256Ctx ctx;
    sha256_init(&ctx);
    sha256_update(&ctx, th, 32);          // tag hash TWICE
    sha256_update(&ctx, th, 32);
    sha256_update(&ctx, mbuf, msg_len);
    uchar h[32];
    sha256_final(&ctx, h);
    for (int i = 0; i < 32; ++i) out32[(ulong)gid * 32 + i] = h[i];
}

/* out[i] = SHA256(tag_hash32 || tag_hash32 || msgs[i][0..L)), L=msg_lens[i]
 * clamped to 256 (silent, matches CUDA). msgs row stride is `stride`. */
__kernel void lbtc_tagged_hash_var(
    __global const uchar* tag_hash32,
    __global const uchar* msgs,
    __global const uint* msg_lens,
    const uint stride,
    __global uchar* out32,
    const uint count
) {
    uint gid = get_global_id(0);
    if (gid >= count) return;
    uint L = msg_lens[gid];
    if (L > 256) L = 256;
    uchar th[32];
    for (int i = 0; i < 32; ++i) th[i] = tag_hash32[i];
    uchar mbuf[256];
    for (uint i = 0; i < L; ++i) mbuf[i] = msgs[(ulong)gid * stride + i];
    SHA256Ctx ctx;
    sha256_init(&ctx);
    sha256_update(&ctx, th, 32);
    sha256_update(&ctx, th, 32);
    sha256_update(&ctx, mbuf, L);
    uchar h[32];
    sha256_final(&ctx, h);
    for (int i = 0; i < 32; ++i) out32[(ulong)gid * 32 + i] = h[i];
}

/* out[i] = SHA256(SHA256(inputs[i])) over fixed-length inputs (no tag prefix). */
__kernel void lbtc_hash256(
    __global const uchar* inputs,
    const uint input_len,
    __global uchar* out32,
    const uint count
) {
    uint gid = get_global_id(0);
    if (gid >= count) return;
    uchar in[320];
    for (uint i = 0; i < input_len; ++i) in[i] = inputs[(ulong)gid * input_len + i];
    uchar h1[32];
    SHA256Ctx ctx;
    sha256_init(&ctx);
    sha256_update(&ctx, in, input_len);
    sha256_final(&ctx, h1);               // SHA256(input)
    uchar h2[32];
    SHA256Ctx ctx2;
    sha256_init(&ctx2);
    sha256_update(&ctx2, h1, 32);
    sha256_final(&ctx2, h2);              // SHA256(SHA256(input))
    for (int i = 0; i < 32; ++i) out32[(ulong)gid * 32 + i] = h2[i];
}

/* out[i] = SHA256(SHA256(row_i)), where row_i = inputs[i*stride .. i*stride+input_lens[i]).
 * Generic batch variable-length double-SHA256: row i is read directly from
 * __global memory via sha256_update_global (O(1) private scratch), so rows
 * can be multi-MB (e.g. real Bitcoin transactions) unlike lbtc_hash256's
 * fixed 320-byte cap above. Bytes beyond input_lens[i] up to stride are
 * ignored padding. Public-data hashing only — no tag prefix, no tx parsing. */
__kernel void lbtc_hash256_var(
    __global const uchar* inputs,
    __global const uint* input_lens,
    const uint stride,
    __global uchar* out32,
    const uint count
) {
    uint gid = get_global_id(0);
    if (gid >= count) return;
    uint len = input_lens[gid];
    SHA256Ctx ctx;
    sha256_init(&ctx);
    sha256_update_global(&ctx, inputs + (ulong)gid * stride, len);
    uchar h1[32];
    sha256_final(&ctx, h1);               // SHA256(row)
    SHA256Ctx ctx2;
    sha256_init(&ctx2);
    sha256_update(&ctx2, h1, 32);          // h1 is a private array; existing sha256_update is fine here
    uchar h2[32];
    sha256_final(&ctx2, h2);              // SHA256(SHA256(row))
    for (int i = 0; i < 32; ++i) out32[(ulong)gid * 32 + i] = h2[i];
}

/* ecdh_scalar_mul_compressed — GPU-side pubkey decompress + scalar multiplication.
 * Takes 33-byte SEC1 compressed pubkeys + private scalars.
 * Decompresses pubkeys in registers, then multiplies by scalar.
 * Used by ECDH batch path to eliminate CPU sqrt+parity. */
__kernel void ecdh_scalar_mul_compressed(
    __global const Scalar* scalars,
    __global const uchar* pubkeys33,
    __global JacobianPoint* results,
    const uint count
) {
    uint gid = get_global_id(0);
    if (gid >= count) return;

    Scalar k = scalars[gid];

    // Decompress pubkey on GPU (33-byte SEC1 → JacobianPoint with z=1)
    JacobianPoint pub;
    if (!lbtc_point_from_compressed(pubkeys33 + gid * 33, &pub)) {
        point_set_infinity(&pub);
        results[gid] = pub;
        return;
    }

    // Convert Jacobian (z=1) → AffinePoint for scalar_mul_glv_impl
    AffinePoint aff;
    aff.x = pub.x;
    aff.y = pub.y;

    JacobianPoint r;
    scalar_mul_glv_impl(&r, &k, &aff);
    results[gid] = r;
}

__kernel void ecrecover_batch(
    __global const uchar* msg_hashes,
    __global const ECDSASignature* signatures,
    __global const int* recids,
    __global JacobianPoint* pubkeys,
    __global int* results,
    const uint count
) {
    uint gid = get_global_id(0);
    if (gid >= count) return;

    uchar msg[32];
    for (int i = 0; i < 32; ++i) msg[i] = msg_hashes[gid * 32 + i];

    ECDSASignature sig = signatures[gid];
    JacobianPoint recovered;
    int ok = ecdsa_recover_impl(msg, &sig, recids[gid], &recovered);
    results[gid] = ok;
    if (ok) {
        pubkeys[gid] = recovered;
    } else {
        pubkeys[gid].x.limbs[0] = 0; pubkeys[gid].x.limbs[1] = 0;
        pubkeys[gid].x.limbs[2] = 0; pubkeys[gid].x.limbs[3] = 0;
        pubkeys[gid].y.limbs[0] = 1; pubkeys[gid].y.limbs[1] = 0;
        pubkeys[gid].y.limbs[2] = 0; pubkeys[gid].y.limbs[3] = 0;
        pubkeys[gid].z.limbs[0] = 0; pubkeys[gid].z.limbs[1] = 0;
        pubkeys[gid].z.limbs[2] = 0; pubkeys[gid].z.limbs[3] = 0;
        pubkeys[gid].infinity = 1;
        for (int i = 0; i < 7; ++i) pubkeys[gid].pad[i] = 0;
    }
}

#ifndef SECP256K1_CT_SIGN_KERNELS
// Variable-time signing kernel — superseded by secp256k1_ct_extended.cl when
// SECP256K1_CT_SIGN_KERNELS is defined. Do NOT dispatch on secret inputs.
__kernel void schnorr_sign(
    __global const uchar* messages,
    __global const Scalar* private_keys,
    __global const uchar* aux_rands,
    __global SchnorrSignature* signatures,
    __global int* success_flags,
    const uint count
) {
    uint gid = get_global_id(0);
    if (gid >= count) return;

    uchar msg[32], aux[32];
    for (int i = 0; i < 32; i++) { msg[i] = messages[gid*32+i]; aux[i] = aux_rands[gid*32+i]; }

    Scalar priv = private_keys[gid];
    SchnorrSignature sig;
    success_flags[gid] = schnorr_sign_impl(&priv, msg, aux, &sig);
    signatures[gid] = sig;
}
#endif /* SECP256K1_CT_SIGN_KERNELS */

__kernel void schnorr_verify(
    __global const uchar* pubkeys_x,
    __global const uchar* messages,
    __global const SchnorrSignature* signatures,
    __global int* results,
    const uint count
) {
    uint gid = get_global_id(0);
    if (gid >= count) return;

    uchar pk[32], msg[32];
    for (int i = 0; i < 32; i++) { pk[i] = pubkeys_x[gid*32+i]; msg[i] = messages[gid*32+i]; }

    SchnorrSignature sig = signatures[gid];
    results[gid] = schnorr_verify_impl(pk, msg, &sig);
}

__kernel void generator_mul_windowed(
    __global const Scalar* scalars,
    __global JacobianPoint* results,
    const uint count
) {
    uint gid = get_global_id(0);
    if (gid >= count) return;

    Scalar k = scalars[gid];
    JacobianPoint r;
    scalar_mul_generator_windowed_impl(&r, &k);
    results[gid] = r;
}

// =============================================================================
// LAYER 6: ECDSA SNARK witness (eprint 2025/695) — foreign-field PLONK/Halo2
// =============================================================================

/** Flat 760-byte witness record.  Identical layout to the CPU and CUDA structs.
 *  uchar = uint8, ulong = uint64, int = int32.
 *  Total: 11×32 + 10×5×8 + 2×4 = 352 + 400 + 8 = 760 bytes.
 */
typedef struct {
    /* -- 11 input/witness byte fields (32 bytes each) ---- */
    uchar  msg[32];
    uchar  sig_r[32];
    uchar  sig_s[32];
    uchar  pub_x[32];
    uchar  pub_y[32];
    uchar  s_inv[32];
    uchar  u1[32];
    uchar  u2[32];
    uchar  result_x[32];
    uchar  result_y[32];
    uchar  result_x_mod_n[32];
    /* -- 10×5 foreign-field limbs (5×52-bit, stored as ulong) ------------- */
    ulong  lmb_sig_r[5];
    ulong  lmb_sig_s[5];
    ulong  lmb_pub_x[5];
    ulong  lmb_pub_y[5];
    ulong  lmb_s_inv[5];
    ulong  lmb_u1[5];
    ulong  lmb_u2[5];
    ulong  lmb_result_x[5];
    ulong  lmb_result_y[5];
    ulong  lmb_result_x_mod_n[5];
    /* -- validity + alignment ---------------------------------------------- */
    int    valid;
    int    _pad;
} EcdsaSnarkWitnessFlatOCL;

// Helper: Scalar (4×ulong LE limbs) → 5×52-bit foreign-field limbs.
inline void scalar_to_ff_limbs_cl(const Scalar* s, ulong out[5]) {
    const ulong MASK52 = (1UL << 52) - 1UL;
    out[0] =  s->limbs[0]                                        & MASK52;
    out[1] = ((s->limbs[0] >> 52) | (s->limbs[1] << 12))        & MASK52;
    out[2] = ((s->limbs[1] >> 40) | (s->limbs[2] << 24))        & MASK52;
    out[3] = ((s->limbs[2] >> 28) | (s->limbs[3] << 36))        & MASK52;
    out[4] =   s->limbs[3] >> 16;
}

// Helper: 32 big-endian bytes → 5×52-bit foreign-field limbs.
// Interprets BE bytes as 4×ulong LE, then 52-bit windowing.
inline void be_bytes_to_ff_limbs_cl(const uchar be[32], ulong out[5]) {
    ulong w[4];
    for (int i = 0; i < 4; i++) {
        ulong v = 0;
        int base = (3 - i) * 8;
        for (int b = 0; b < 8; b++)
            v = (v << 8) | (ulong)be[base + b];
        w[i] = v;
    }
    const ulong MASK52 = (1UL << 52) - 1UL;
    out[0] =  w[0]                           & MASK52;
    out[1] = ((w[0] >> 52) | (w[1] << 12))  & MASK52;
    out[2] = ((w[1] >> 40) | (w[2] << 24))  & MASK52;
    out[3] = ((w[2] >> 28) | (w[3] << 36))  & MASK52;
    out[4] =   w[3] >> 16;
}

// Compute one ECDSA SNARK witness record into *out.
// On any early-out failure, out->valid is left 0.
inline void ecdsa_snark_witness_impl(
    const uchar              msg_hash[32],
    const JacobianPoint*     pubkey,
    const ECDSASignature*    sig,
    EcdsaSnarkWitnessFlatOCL* out)
{
    out->valid = 0;
    out->_pad  = 0;

    if (scalar_is_zero(&sig->r) || scalar_is_zero(&sig->s)) return;
    if (point_is_infinity(pubkey)) return;

    /* ---- input bytes ---- */
    for (int i = 0; i < 32; i++) out->msg[i] = msg_hash[i];
    scalar_to_bytes_impl(&sig->r, out->sig_r);
    scalar_to_bytes_impl(&sig->s, out->sig_s);

    /* ---- public key: Jacobian → affine ---- */
    AffinePoint pub_aff;
    if (pubkey->z.limbs[0] == 1UL && pubkey->z.limbs[1] == 0UL &&
        pubkey->z.limbs[2] == 0UL && pubkey->z.limbs[3] == 0UL) {
        pub_aff.x = pubkey->x;
        pub_aff.y = pubkey->y;
    } else {
        FieldElement pz_inv, pz_inv2, pz_inv3;
        field_inv_impl(&pz_inv,  &pubkey->z);
        field_sqr_impl(&pz_inv2, &pz_inv);
        field_mul_impl(&pz_inv3, &pz_inv2, &pz_inv);
        field_mul_impl(&pub_aff.x, &pubkey->x, &pz_inv2);
        field_mul_impl(&pub_aff.y, &pubkey->y, &pz_inv3);
    }
    field_to_bytes_impl(&pub_aff.x, out->pub_x);
    field_to_bytes_impl(&pub_aff.y, out->pub_y);

    /* ---- witness scalars ---- */
    Scalar z;
    scalar_from_bytes_impl(msg_hash, &z);

    Scalar s_inv;
    scalar_inverse_impl(&sig->s, &s_inv);
    scalar_to_bytes_impl(&s_inv, out->s_inv);

    Scalar u1, u2;
    scalar_mul_mod_n_impl(&z,      &s_inv, &u1);
    scalar_to_bytes_impl(&u1, out->u1);
    scalar_mul_mod_n_impl(&sig->r, &s_inv, &u2);
    scalar_to_bytes_impl(&u2, out->u2);

    /* ---- R = u1·G + u2·Q using Shamir's trick ---- */
    AffinePoint G;
    get_generator(&G);

    JacobianPoint R;
    shamir_double_mul_glv_impl(&G, &u1, &pub_aff, &u2, &R);
    if (point_is_infinity(&R)) return;

    /* ---- R affine x, y ---- */
    FieldElement rz_inv, rz_inv2, rz_inv3, rx_aff, ry_aff;
    field_inv_impl(&rz_inv,  &R.z);
    field_sqr_impl(&rz_inv2, &rz_inv);
    field_mul_impl(&rz_inv3, &rz_inv2, &rz_inv);
    field_mul_impl(&rx_aff,  &R.x,     &rz_inv2);
    field_mul_impl(&ry_aff,  &R.y,     &rz_inv3);
    field_to_bytes_impl(&rx_aff, out->result_x);
    field_to_bytes_impl(&ry_aff, out->result_y);

    /* ---- result_x mod n ---- */
    Scalar v;
    scalar_from_bytes_impl(out->result_x, &v);
    scalar_to_bytes_impl(&v, out->result_x_mod_n);

    /* ---- validity ---- */
    out->valid = scalar_eq_impl(&v, &sig->r) ? 1 : 0;

    /* ---- foreign-field limbs ---- */
    scalar_to_ff_limbs_cl(&sig->r, out->lmb_sig_r);
    scalar_to_ff_limbs_cl(&sig->s, out->lmb_sig_s);
    be_bytes_to_ff_limbs_cl(out->pub_x, out->lmb_pub_x);
    be_bytes_to_ff_limbs_cl(out->pub_y, out->lmb_pub_y);
    scalar_to_ff_limbs_cl(&s_inv,   out->lmb_s_inv);
    scalar_to_ff_limbs_cl(&u1,      out->lmb_u1);
    scalar_to_ff_limbs_cl(&u2,      out->lmb_u2);
    be_bytes_to_ff_limbs_cl(out->result_x,       out->lmb_result_x);
    be_bytes_to_ff_limbs_cl(out->result_y,       out->lmb_result_y);
    be_bytes_to_ff_limbs_cl(out->result_x_mod_n, out->lmb_result_x_mod_n);
}

// Kernel: one thread per (message, pubkey, sig) tuple.
__kernel void ecdsa_snark_witness_batch(
    __global const uchar*              msg_hashes,   // count × 32 bytes (BE SHA-256)
    __global const JacobianPoint*      pubkeys,      // count × JacobianPoint (decompressed)
    __global const ECDSASignature*     sigs,         // count × ECDSASignature {r, s}
    __global EcdsaSnarkWitnessFlatOCL* out,          // count × 760-byte witness records
    const uint                         count
) {
    uint gid = get_global_id(0);
    if (gid >= count) return;

    uchar msg[32];
    for (int i = 0; i < 32; i++) msg[i] = msg_hashes[gid * 32 + i];

    JacobianPoint pub = pubkeys[gid];
    ECDSASignature sig = sigs[gid];

    EcdsaSnarkWitnessFlatOCL w;
    ecdsa_snark_witness_impl(msg, &pub, &sig, &w);
    out[gid] = w;
}

/* ecdsa_snark_witness_batch_compressed — GPU-side pubkey decompression variant */
__kernel void ecdsa_snark_witness_batch_compressed(
    __global const uchar*              msg_hashes,   // count × 32 bytes
    __global const uchar*              pubkeys33,    // count × 33 bytes (SEC1 compressed)
    __global const ECDSASignature*     sigs,
    __global EcdsaSnarkWitnessFlatOCL* out,
    const uint                         count
) {
    uint gid = get_global_id(0);
    if (gid >= count) return;

    uchar msg[32];
    for (int i = 0; i < 32; i++) msg[i] = msg_hashes[gid * 32 + i];

    JacobianPoint pub;
    if (!lbtc_point_from_compressed(pubkeys33 + gid * 33, &pub)) {
        // Zero-fill output on failure (fail-closed)
        EcdsaSnarkWitnessFlatOCL zero = {0};
        out[gid] = zero;
        return;
    }

    ECDSASignature sig = sigs[gid];
    EcdsaSnarkWitnessFlatOCL w;
    ecdsa_snark_witness_impl(msg, &pub, &sig, &w);
    out[gid] = w;
}

// =============================================================================
// LAYER 7: BIP-340 Schnorr SNARK witness (eprint 2025/695)
// =============================================================================

/** Flat 472-byte Schnorr SNARK witness record.
 *  Total: 7×32 + 6×5×8 + 2×4 = 224 + 240 + 8 = 472 bytes.
 */
typedef struct {
    uchar  msg[32];
    uchar  sig_r[32];
    uchar  sig_s[32];
    uchar  pub_x[32];
    uchar  r_y[32];
    uchar  pub_y[32];
    uchar  e[32];
    ulong  lmb_sig_r[5];
    ulong  lmb_sig_s[5];
    ulong  lmb_pub_x[5];
    ulong  lmb_r_y[5];
    ulong  lmb_pub_y[5];
    ulong  lmb_e[5];
    int    valid;
    int    _pad;
} SchnorrSnarkWitnessFlatOCL;

// Validate: be32 bytes represent value < p (secp256k1 field prime).
// p = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F
inline int schnorr_be32_lt_p(const uchar x[32]) {
    const uchar P[32] = {
        0xFF,0xFF,0xFF,0xFF, 0xFF,0xFF,0xFF,0xFF,
        0xFF,0xFF,0xFF,0xFF, 0xFF,0xFF,0xFF,0xFF,
        0xFF,0xFF,0xFF,0xFF, 0xFF,0xFF,0xFF,0xFF,
        0xFF,0xFF,0xFF,0xFE, 0xFF,0xFF,0xFC,0x2F
    };
    for (int i = 0; i < 32; i++) {
        if (x[i] < P[i]) return 1;
        if (x[i] > P[i]) return 0;
    }
    return 0;
}

// Validate: be32 bytes represent scalar s in [1, n-1].
// n = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141
inline int schnorr_be32_is_nonzero_lt_n(const uchar s[32]) {
    int all_zero = 1;
    for (int i = 0; i < 32; i++) if (s[i] != 0) { all_zero = 0; break; }
    if (all_zero) return 0;
    const uchar N[32] = {
        0xFF,0xFF,0xFF,0xFF, 0xFF,0xFF,0xFF,0xFF,
        0xFF,0xFF,0xFF,0xFF, 0xFF,0xFF,0xFF,0xFE,
        0xBA,0xAE,0xDC,0xE6, 0xAF,0x48,0xA0,0x3B,
        0xBF,0xD2,0x5E,0x8C, 0xD0,0x36,0x41,0x41
    };
    for (int i = 0; i < 32; i++) {
        if (s[i] < N[i]) return 1;
        if (s[i] > N[i]) return 0;
    }
    return 0;
}

// Compute one BIP-340 Schnorr SNARK witness record.
// out->valid = 0 on any failure (invalid sig, x not on curve, etc.).
inline void schnorr_snark_witness_impl(
    const uchar               msg[32],
    const uchar               pub_x_bytes[32],
    const uchar               sig64[64],
    SchnorrSnarkWitnessFlatOCL* out)
{
    out->valid = 0;
    out->_pad  = 0;

    // r must be a valid field element (< p); s must be in [1, n-1]
    if (!schnorr_be32_lt_p(sig64))           return;
    if (!schnorr_be32_is_nonzero_lt_n(sig64 + 32)) return;

    SchnorrSignature sig;
    for (int i = 0; i < 32; i++) sig.r[i] = sig64[i];
    scalar_from_bytes_impl(sig64 + 32, &sig.s);

    // Copy byte fields
    for (int i = 0; i < 32; i++) out->msg[i]   = msg[i];
    for (int i = 0; i < 32; i++) out->sig_r[i] = sig.r[i];
    for (int i = 0; i < 32; i++) out->pub_x[i] = pub_x_bytes[i];
    scalar_to_bytes_impl(&sig.s, out->sig_s);

    // lift_x sets z=1, so .x and .y are already affine
    JacobianPoint P;
    if (!lift_x_impl(pub_x_bytes, &P)) return;
    field_to_bytes_impl(&P.y, out->pub_y);

    JacobianPoint R;
    if (!lift_x_impl(sig.r, &R)) return;
    field_to_bytes_impl(&R.y, out->r_y);

    // e = tagged_hash("BIP0340/challenge", sig_r || pub_x || msg)
    uchar challenge_in[96];
    for (int i = 0; i < 32; i++) challenge_in[i]      = sig.r[i];
    for (int i = 0; i < 32; i++) challenge_in[32 + i] = pub_x_bytes[i];
    for (int i = 0; i < 32; i++) challenge_in[64 + i] = msg[i];
    tagged_hash_fast_impl(BIP340_TAG_CHALLENGE, challenge_in, 96, out->e);

    // 5×52-bit foreign-field limbs for all 6 values
    be_bytes_to_ff_limbs_cl(out->sig_r, out->lmb_sig_r);
    be_bytes_to_ff_limbs_cl(out->sig_s, out->lmb_sig_s);
    be_bytes_to_ff_limbs_cl(out->pub_x, out->lmb_pub_x);
    be_bytes_to_ff_limbs_cl(out->r_y,   out->lmb_r_y);
    be_bytes_to_ff_limbs_cl(out->pub_y,  out->lmb_pub_y);
    be_bytes_to_ff_limbs_cl(out->e,     out->lmb_e);

    out->valid = 1;
}

// Kernel: one thread per (msg, pub_x, sig) tuple.
__kernel void schnorr_snark_witness_batch(
    __global const uchar*                  msgs32,      // count × 32 bytes
    __global const uchar*                  pubkeys_x32, // count × 32 bytes (x-only)
    __global const uchar*                  sigs64,      // count × 64 bytes (r||s)
    __global SchnorrSnarkWitnessFlatOCL*   out,         // count × 472-byte records
    const uint                             count
) {
    uint gid = get_global_id(0);
    if (gid >= count) return;

    uchar msg[32], pub_x[32], sig64[64];
    for (int i = 0; i < 32; i++) msg[i]       = msgs32[gid * 32 + i];
    for (int i = 0; i < 32; i++) pub_x[i]     = pubkeys_x32[gid * 32 + i];
    for (int i = 0; i < 64; i++) sig64[i]     = sigs64[gid * 64 + i];

    SchnorrSnarkWitnessFlatOCL w;
    schnorr_snark_witness_impl(msg, pub_x, sig64, &w);
    out[gid] = w;
}

// =============================================================================
// CONCATENATED: secp256k1_ct_sign.cl
// =============================================================================
// =============================================================================
// secp256k1_ct_sign.cl -- Constant-time ECDSA & Schnorr signing for OpenCL
// =============================================================================
// Uses CT primitives for all secret-dependent operations: k*G, k^-1, nonce.
// No secret-dependent branches or memory access patterns.
// Requires: secp256k1_extended.cl, secp256k1_ct_ops.cl, secp256k1_ct_field.cl,
//           secp256k1_ct_scalar.cl, secp256k1_ct_point.cl
// =============================================================================

#ifndef SECP256K1_CT_SIGN_CL
#define SECP256K1_CT_SIGN_CL

// ct_jacobian_to_affine is defined in secp256k1_ct_point.cl

// ---------------------------------------------------------------------------
// CT ECDSA sign: deterministic (RFC 6979) + constant-time k*G + k^-1
// ---------------------------------------------------------------------------
inline int ct_ecdsa_sign_impl(const uchar msg_hash[32], const Scalar* priv,
                              ECDSASignature* sig) {
    // BUG-M1 FIX: reject zero private key before RFC 6979 nonce derivation.
    // Every other signing function checks this; ct_ecdsa_sign_impl was the only
    // one that skipped it. A zero key produces a well-formed but worthless signature.
    if (ct_scalar_is_zero(priv)) return 0;
    // RFC 6979 nonce derivation (deterministic, so safe to use fast-path)
    Scalar k;
    rfc6979_nonce_impl(priv, msg_hash, &k);

    // CT: compute R = k*G using constant-time generator multiplication
    CTJacobianPoint R_jac;
    ct_generator_mul_impl(&k, &R_jac);

    // Convert R to affine (branchless)
    FieldElement rx, ry;
    ct_jacobian_to_affine(&R_jac, &rx, &ry);

    // r = rx mod n
    Scalar r_scalar;
    for (int i = 0; i < 4; ++i) r_scalar.limbs[i] = rx.limbs[i];
    ct_reduce_order(&r_scalar);

    // Check r != 0 (CT)
    ulong r_zero = ct_scalar_is_zero(&r_scalar);

    // CT: k^-1 using Fermat inverse
    Scalar k_inv;
    ct_scalar_inverse_impl(&k, &k_inv);

    // s = k^-1 * (msg_hash + r * priv) mod n
    Scalar msg_scalar;
    scalar_from_bytes_impl(msg_hash, &msg_scalar);

    Scalar r_priv;
    ct_scalar_mul_impl(&r_scalar, priv, &r_priv);

    Scalar sum;
    ct_scalar_add_impl(&msg_scalar, &r_priv, &sum);

    Scalar s;
    ct_scalar_mul_impl(&k_inv, &sum, &s);

    // Low-S normalization (BIP-62)
    ct_scalar_normalize_low_s(&s);

    // Check s != 0 (CT)
    ulong s_zero = ct_scalar_is_zero(&s);

    sig->r = r_scalar;
    sig->s = s;

    // Return failure if r or s is zero
    return (r_zero == 0 && s_zero == 0) ? 1 : 0;
}

// CT ECDSA sign with fault countermeasure (verify after signing)
inline int ct_ecdsa_sign_verified_impl(const uchar msg_hash[32], const Scalar* priv,
                                       ECDSASignature* sig) {
    int ok = ct_ecdsa_sign_impl(msg_hash, priv, sig);
    if (!ok) return 0;

    // Derive public key using CT generator mul (priv is secret)
    CTJacobianPoint pub_ct;
    ct_generator_mul_impl(priv, &pub_ct);
    FieldElement pub_ax, pub_ay;
    ct_jacobian_to_affine(&pub_ct, &pub_ax, &pub_ay);

    // Present as affine Jacobian (Z=1) for ecdsa_verify_impl fast-path
    JacobianPoint pub_jac;
    pub_jac.x = pub_ax;
    pub_jac.y = pub_ay;
    pub_jac.z.limbs[0] = 1; pub_jac.z.limbs[1] = 0;
    pub_jac.z.limbs[2] = 0; pub_jac.z.limbs[3] = 0;
    pub_jac.infinity = 0;

    // Fault injection detected if verify fails
    return ecdsa_verify_impl(msg_hash, &pub_jac, sig);
}

// ---------------------------------------------------------------------------
// CT Schnorr keypair
// ---------------------------------------------------------------------------
typedef struct {
    Scalar priv_key;      // adjusted private key (negated if Y is odd)
    FieldElement pub_x;   // x-only public key
    FieldElement pub_y;   // full y for internal use
} CTSchnorrKeypairOCL;

inline int ct_schnorr_keypair_create_impl(const Scalar* priv,
                                          CTSchnorrKeypairOCL* kp) {
    // CT: d*G
    CTJacobianPoint P;
    ct_generator_mul_impl(priv, &P);

    FieldElement px, py;
    ct_jacobian_to_affine(&P, &px, &py);

    // Check if Y is even (BIP-340: negate d if Y is odd)
    ulong y_odd = ct_is_nonzero_mask(py.limbs[0] & 1);

    Scalar d = *priv;
    Scalar neg_d;
    ct_scalar_neg_impl(&d, &neg_d);
    ct_scalar_cmov(&d, &neg_d, y_odd);

    kp->priv_key = d;
    kp->pub_x = px;
    kp->pub_y = py;
    return 1;
}

// ---------------------------------------------------------------------------
// CT Schnorr sign (BIP-340)
// ---------------------------------------------------------------------------
inline int ct_schnorr_sign_impl(const Scalar* priv, const uchar msg[32],
                                const uchar aux_rand[32],
                                uchar sig_out[64]) {
    // Create keypair with CT
    CTSchnorrKeypairOCL kp;
    ct_schnorr_keypair_create_impl(priv, &kp);

    // t = d XOR tagged_hash("BIP0340/aux", aux_rand)
    uchar t_hash[32];
    tagged_hash_fast_impl(BIP340_TAG_AUX, aux_rand, 32, t_hash);

    uchar d_bytes[32];
    scalar_to_bytes_impl(&kp.priv_key, d_bytes);
    uchar t[32];
    for (int i = 0; i < 32; ++i) t[i] = d_bytes[i] ^ t_hash[i];

    // rand = tagged_hash("BIP0340/nonce", t || px || msg)
    uchar px_bytes[32];
    field_to_bytes_impl(&kp.pub_x, px_bytes);

    uchar nonce_input[96];
    for (int i = 0; i < 32; ++i) nonce_input[i] = t[i];
    for (int i = 0; i < 32; ++i) nonce_input[32 + i] = px_bytes[i];
    for (int i = 0; i < 32; ++i) nonce_input[64 + i] = msg[i];

    uchar rand_hash[32];
    tagged_hash_fast_impl(BIP340_TAG_NONCE, nonce_input, 96, rand_hash);

    Scalar k_prime;
    scalar_from_bytes_impl(rand_hash, &k_prime);

    // P2-CT-005: reject zero nonce — k'=0 produces point at infinity and a
    // degenerate (all-zeros) signature that would otherwise be returned as success.
    // Matches CPU schnorr_sign k_prime.is_zero_ct() guard.
    if (scalar_is_zero_impl(&k_prime)) return 0;

    // CT: R = k'*G
    CTJacobianPoint R;
    ct_generator_mul_impl(&k_prime, &R);

    FieldElement rx, ry;
    ct_jacobian_to_affine(&R, &rx, &ry);

    // If Y(R) is odd, negate k'
    ulong ry_odd = ct_is_nonzero_mask(ry.limbs[0] & 1);
    Scalar k = k_prime;
    Scalar neg_k;
    ct_scalar_neg_impl(&k, &neg_k);
    ct_scalar_cmov(&k, &neg_k, ry_odd);

    // Serialize R.x
    uchar rx_bytes[32];
    field_to_bytes_impl(&rx, rx_bytes);

    // e = tagged_hash("BIP0340/challenge", R.x || P.x || msg) mod n
    uchar challenge_input[96];
    for (int i = 0; i < 32; ++i) challenge_input[i] = rx_bytes[i];
    for (int i = 0; i < 32; ++i) challenge_input[32 + i] = px_bytes[i];
    for (int i = 0; i < 32; ++i) challenge_input[64 + i] = msg[i];

    uchar e_hash[32];
    tagged_hash_fast_impl(BIP340_TAG_CHALLENGE, challenge_input, 96, e_hash);
    Scalar e;
    scalar_from_bytes_impl(e_hash, &e);

    // s = k + e*d mod n (CT)
    Scalar ed;
    ct_scalar_mul_impl(&e, &kp.priv_key, &ed);
    Scalar s;
    ct_scalar_add_impl(&k, &ed, &s);

    // Rule 14: reject degenerate output — s==0 or R.x all-zeros
    if (scalar_is_zero_impl(&s)) return 0;
    {
        uint _r_or = 0u;
        for (int _i = 0; _i < 32; ++_i) _r_or |= (uint)rx_bytes[_i];
        if (_r_or == 0u) return 0;
    }

    // Output: sig = R.x || s
    for (int i = 0; i < 32; ++i) sig_out[i] = rx_bytes[i];
    uchar s_bytes[32];
    scalar_to_bytes_impl(&s, s_bytes);
    for (int i = 0; i < 32; ++i) sig_out[32 + i] = s_bytes[i];

    return 1;
}

// CT Schnorr sign with fault countermeasure
inline int ct_schnorr_sign_verified_impl(const Scalar* priv, const uchar msg[32],
                                         const uchar aux_rand[32],
                                         uchar sig_out[64]) {
    int ok = ct_schnorr_sign_impl(priv, msg, aux_rand, sig_out);
    if (!ok) return 0;

    // Rule 14: check s==0 and R.x all-zeros explicitly before verify.
    {
        Scalar s_check;
        scalar_from_bytes_impl(sig_out + 32, &s_check);
        if (scalar_is_zero_impl(&s_check)) return 0;
        uint r_or = 0;
        for (int _i = 0; _i < 32; ++_i) r_or |= (uint)sig_out[_i];
        if (r_or == 0u) return 0;
    }

    // Derive x-only pubkey for verification (CT generator mul on secret)
    FieldElement pub_x_fe;
    ct_schnorr_pubkey_impl(priv, &pub_x_fe);
    uchar pubkey_x[32];
    field_to_bytes_impl(&pub_x_fe, pubkey_x);

    // Reconstruct SchnorrSignature from raw bytes for verify call
    SchnorrSignature sig_v;
    for (int i = 0; i < 32; ++i) sig_v.r[i] = sig_out[i];
    scalar_from_bytes_impl(sig_out + 32, &sig_v.s);

    // Fault injection detected if verify fails
    return schnorr_verify_impl(pubkey_x, msg, &sig_v);
}

// CT public key derivation
inline void ct_schnorr_pubkey_impl(const Scalar* priv, FieldElement* pub_x) {
    CTJacobianPoint P;
    ct_generator_mul_impl(priv, &P);
    FieldElement py;
    ct_jacobian_to_affine(&P, pub_x, &py);
}

#endif // SECP256K1_CT_SIGN_CL

// =============================================================================
// NexaPow mining kernel
// =============================================================================

// =============================================================================
// NexaPow mining kernel
// =============================================================================
// Each work-item tries one nonce:
// 1. miningHash = double_sha256(candidateHash[32] || nonce[8])
// 2. h1 = sha256(miningHash[32])
// 3. priv = miningHash as secp256k1 private key (reduced mod n)
// 4. sig = schnorr_sign(priv, h1, aux_rand=0)
// 5. powhash = sha256(sig[64])
// 6. Compare powhash to target (big-endian)
// =============================================================================

__kernel void nexapow_mine(
    __global const uchar* header,       // 32-byte candidateHash
    __global const uchar* target_buf,   // 32-byte target (big-endian)
    const ulong base_nonce,
    __global ulong* output_nonce,       // found nonce
    __global uchar* output_hash,        // 32-byte powhash
    __global uint* found_flag           // 1 if solution found
)
{
    uint gid = get_global_id(0);
    ulong nonce = base_nonce + (ulong)gid;

    // Check if someone else already found a solution
    if (*found_flag != 0) return;

    // Step 1: miningHash = double_sha256(candidateHash || nonce)
    // Input: 32 bytes candidateHash + 8 bytes nonce = 40 bytes
    SHA256Ctx ctx1;
    sha256_init(&ctx1);
    sha256_update(&ctx1, header, 32);

    // Serialize nonce as little-endian 8 bytes (Nexa uses LE)
    uchar nonce_bytes[8];
    nonce_bytes[0] = (uchar)(nonce & 0xFF);
    nonce_bytes[1] = (uchar)((nonce >> 8) & 0xFF);
    nonce_bytes[2] = (uchar)((nonce >> 16) & 0xFF);
    nonce_bytes[3] = (uchar)((nonce >> 24) & 0xFF);
    nonce_bytes[4] = (uchar)((nonce >> 32) & 0xFF);
    nonce_bytes[5] = (uchar)((nonce >> 40) & 0xFF);
    nonce_bytes[6] = (uchar)((nonce >> 48) & 0xFF);
    nonce_bytes[7] = (uchar)((nonce >> 56) & 0xFF);
    sha256_update(&ctx1, nonce_bytes, 8);

    uchar hash1[32];
    sha256_final(&ctx1, hash1);

    // Second SHA-256 for double-hash
    SHA256Ctx ctx2;
    sha256_init(&ctx2);
    sha256_update(&ctx2, hash1, 32);
    uchar miningHash[32];
    sha256_final(&ctx2, miningHash);

    // Step 2: h1 = sha256(miningHash)
    SHA256Ctx ctx3;
    sha256_init(&ctx3);
    sha256_update(&ctx3, miningHash, 32);
    uchar h1[32];
    sha256_final(&ctx3, h1);

    // Step 3: Convert miningHash to secp256k1 private key
    Scalar priv;
    scalar_from_bytes_impl(miningHash, &priv);
    if (scalar_is_zero(&priv)) return; // Invalid key, skip

    // Step 4: Schnorr sign h1 with private key
    uchar aux_rand[32] = { 0 }; // No aux randomness for mining
    SchnorrSignature sig;
    int sign_result = schnorr_sign_impl(&priv, h1, aux_rand, &sig);
    if (!sign_result) return; // Signing failed, skip

    // Convert signature to 64 bytes: r[32] || s[32]
    uchar sig_bytes[64];
    for (int i = 0; i < 32; i++) sig_bytes[i] = sig.r[i];
    scalar_to_bytes_impl(&sig.s, sig_bytes + 32);

    // Step 5: powhash = sha256(sig)
    SHA256Ctx ctx4;
    sha256_init(&ctx4);
    sha256_update(&ctx4, sig_bytes, 64);
    uchar powhash[32];
    sha256_final(&ctx4, powhash);

    // Step 6: Compare powhash to target (big-endian, byte-by-byte)
    // powhash <= target means solution found
    bool meets_target = true;
    for (int i = 0; i < 32; i++) {
        if (powhash[i] < target_buf[i]) { meets_target = true; break; }
        if (powhash[i] > target_buf[i]) { meets_target = false; break; }
        // Equal bytes, continue checking
    }

    if (meets_target) {
        // Atomically claim the solution slot
        uint old = atomic_xchg(found_flag, 1);
        if (old == 0) {
            // We are the winner — write the solution
            *output_nonce = nonce;
            for (int i = 0; i < 32; i++) output_hash[i] = powhash[i];
        }
    }
}
