/* Reference KawPow kernel from xmrig-cuda (https://github.com/xmrig/xmrig-cuda)
 * src/KawPow/raven/KawPow.h
 *
 * KEY DIFFERENCES from Ethash:
 * - keccak_f800 (width 800, uint32_t state[25]), NOT keccak_f1600 (width 1600, uint64_t state[25])
 * - 22 rounds, NOT 24 rounds
 * - 32-bit round constants (0x00000001), NOT 64-bit (0x0000000000000001ULL)
 * - Domain separator = "RAVENCOINKAWPOW" constants (ravencoin_rndc), NOT 0x01
 * - State is uint32_t[25], NOT uint64_t[25]
 *
 * This is a fundamentally different Keccak variant from Ethash's Keccak-512/256.
 */

R"===(
typedef unsigned int       uint32_t;
typedef unsigned long long uint64_t;

#if __CUDA_ARCH__ < 350
    #define ROTL32(x,n) (((x) << (n % 32)) | ((x) >> (32 - (n % 32))))
    #define ROTR32(x,n) (((x) >> (n % 32)) | ((x) << (32 - (n % 32))))
#else
    #define ROTL32(x,n) __funnelshift_l((x), (x), (n))
    #define ROTR32(x,n) __funnelshift_r((x), (x), (n))
#endif

#define min(a,b)     ((a<b) ? a : b)
#define mul_hi(a, b) __umulhi(a, b)
#define clz(a)       __clz(a)
#define popcount(a)  __popc(a)

#define DEV_INLINE __device__ __forceinline__

#if (__CUDACC_VER_MAJOR__ > 8)
    #define SHFL(x, y, z) __shfl_sync(0xFFFFFFFF, (x), (y), (z))
#else
    #define SHFL(x, y, z) __shfl((x), (y), (z))
#endif

#define PROGPOW_LANES           16
#define PROGPOW_REGS            32
#define PROGPOW_DAG_LOADS       4
#define PROGPOW_CACHE_WORDS     4096
#define PROGPOW_CNT_DAG         64
#define PROGPOW_CNT_MATH        18

typedef struct __align__(16) {uint32_t s[PROGPOW_DAG_LOADS];} dag_t;

#define FNV_PRIME 0x1000193
#define FNV_OFFSET_BASIS 0x811c9dc5

typedef struct
{
    uint32_t uint32s[32 / sizeof(uint32_t)];
} hash32_t;

// Implementation based on:
// https://github.com/mjosaarinen/tiny_sha3/blob/master/sha3.c

__device__ __constant__ const uint32_t keccakf_rndc[24] = {
    0x00000001, 0x00008082, 0x0000808a, 0x80008000, 0x0000808b, 0x80000001,
    0x80008081, 0x00008009, 0x0000008a, 0x00000088, 0x80008009, 0x8000000a,
    0x8000808b, 0x0000008b, 0x00008089, 0x00008003, 0x00008002, 0x00000080,
    0x0000800a, 0x8000000a, 0x80008081, 0x00008080, 0x80000001, 0x80008008
};

__device__ __constant__ const uint32_t ravencoin_rndc[15] = {
        0x00000072, //R
        0x00000041, //A
        0x00000056, //V
        0x00000045, //E
        0x0000004E, //N
        0x00000043, //C
        0x0000004F, //O
        0x00000049, //I
        0x0000004E, //N
        0x0000004B, //K
        0x00000041, //A
        0x00000057, //W
        0x00000050, //P
        0x0000004F, //O
        0x00000057, //W
};

// Implementation of the permutation Keccakf with width 800.
__device__ __forceinline__ void keccak_f800_round(uint32_t st[25], const int r)
{
    const uint32_t keccakf_rotc[24] = {
        1,  3,  6,  10, 15, 21, 28, 36, 45, 55, 2,  14,
        27, 41, 56, 8,  25, 43, 62, 18, 39, 61, 20, 44
    };
    const uint32_t keccakf_piln[24] = {
        10, 7,  11, 17, 18, 3, 5,  16, 8,  21, 24, 4,
        15, 23, 19, 13, 12, 2, 20, 14, 22, 9,  6,  1
    };

    uint32_t t, bc[5];
    // Theta
    for (int i = 0; i < 5; i++)
        bc[i] = st[i] ^ st[i + 5] ^ st[i + 10] ^ st[i + 15] ^ st[i + 20];

    for (int i = 0; i < 5; i++) {
        t = bc[(i + 4) % 5] ^ ROTL32(bc[(i + 1) % 5], 1);
        for (uint32_t j = 0; j < 25; j += 5)
            st[j + i] ^= t;
    }

    // Rho Pi
    t = st[1];
    for (int i = 0; i < 24; i++) {
        uint32_t j = keccakf_piln[i];
        bc[0] = st[j];
        st[j] = ROTL32(t, keccakf_rotc[i]);
        t = bc[0];
    }

    //  Chi
    for (uint32_t j = 0; j < 25; j += 5) {
        for (int i = 0; i < 5; i++)
            bc[i] = st[j + i];
        for (int i = 0; i < 5; i++)
            st[j + i] ^= (~bc[(i + 1) % 5]) & bc[(i + 2) % 5];
    }

    //  Iota
    st[0] ^= keccakf_rndc[r];
}

__device__ __forceinline__ uint32_t cuda_swab32(const uint32_t x)
{
    return __byte_perm(x, x, 0x0123);
}

// Keccak - implemented as a variant of SHAKE
// The width is 800, with a bitrate of 576, a capacity of 224, and no padding
// Only need 64 bits of output for mining
__device__ __forceinline__ void keccak_f800(uint32_t* st)
{
    // Assumes input state has already been filled
    // at higher level

    // Complete all 22 rounds as a separate impl to
    // evaluate only first 8 words is wasteful of regsters
    for (int r = 0; r < 22; r++) {
        keccak_f800_round(st, r);
    }
}
)==="
