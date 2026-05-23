/*
 * ZION Cosmic Harmony v2 - Native C Implementation with SIMD
 * 
 * Performance targets:
 * - Pure C: ~500 H/s
 * - SIMD (AVX2): ~2000 H/s
 * 
 * Build:
 *   Windows: cl /O2 /arch:AVX2 cosmic_harmony_v2_native.c /LD /Fe:cosmic_harmony_v2.dll
 *   Linux:   gcc -O3 -mavx2 -shared -fPIC cosmic_harmony_v2_native.c -o libcosmic_harmony_v2.so
 *   macOS:   clang -O3 -mavx2 -shared -fPIC cosmic_harmony_v2_native.c -o libcosmic_harmony_v2.dylib
 * 
 * Author: ZION AI Native Team
 * Version: 2.9.5
 * Date: January 2026
 */

#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include <time.h>

/* Platform-specific includes and macros */
#ifdef _MSC_VER
    #include <intrin.h>
    #include <malloc.h>
    #define EXPORT __declspec(dllexport)
    #define ALIGNED(x) __declspec(align(x))
    #define ALIGNED_ALLOC(alignment, size) _aligned_malloc(size, alignment)
    #define ALIGNED_FREE(ptr) _aligned_free(ptr)
    #define HAS_AVX2 0
    #if defined(__AVX2__)
        #undef HAS_AVX2
        #define HAS_AVX2 1
    #endif
#elif defined(__MINGW32__) || defined(__MINGW64__)
    #include <x86intrin.h>
    #include <malloc.h>
    #define EXPORT __attribute__((visibility("default")))
    #define ALIGNED(x) __attribute__((aligned(x)))
    #define ALIGNED_ALLOC(alignment, size) _aligned_malloc(size, alignment)
    #define ALIGNED_FREE(ptr) _aligned_free(ptr)
    #define HAS_AVX2 0
    #if defined(__AVX2__)
        #undef HAS_AVX2
        #define HAS_AVX2 1
    #endif
#elif defined(__aarch64__) || defined(__arm__) || defined(_M_ARM) || defined(_M_ARM64)
    /* ARM architecture (Apple Silicon, Raspberry Pi, etc.) */
    #ifdef __ARM_NEON
        #include <arm_neon.h>
        #define HAS_NEON 1
    #else
        #define HAS_NEON 0
    #endif
    #define HAS_AVX2 0
    #define EXPORT __attribute__((visibility("default")))
    #define ALIGNED(x) __attribute__((aligned(x)))
    #define ALIGNED_ALLOC(alignment, size) aligned_alloc(alignment, size)
    #define ALIGNED_FREE(ptr) free(ptr)
#else
    /* x86/x64 Linux/macOS */
    #include <x86intrin.h>
    #define EXPORT __attribute__((visibility("default")))
    #define ALIGNED(x) __attribute__((aligned(x)))
    #define ALIGNED_ALLOC(alignment, size) aligned_alloc(alignment, size)
    #define ALIGNED_FREE(ptr) free(ptr)
    #define HAS_AVX2 0
    #if defined(__AVX2__)
        #undef HAS_AVX2
        #define HAS_AVX2 1
    #endif
#endif

/* Define HAS_NEON if not already defined */
#ifndef HAS_NEON
    #define HAS_NEON 0
#endif

/* Constants */
#define PHI 0x9E3779B9u
#define MASK32 0xFFFFFFFFu

/* SHA-256 like IV */
static const uint32_t IV[8] = {
    0x6A09E667, 0xBB67AE85, 0x3C6EF372, 0xA54FF53A,
    0x510E527F, 0x9B05688C, 0x1F83D9AB, 0x5BE0CD19
};

/* Prime numbers for noise modulus */
static const uint32_t PRIMES[16] = {
    65521, 65519, 65497, 65479, 65449, 65447, 65437, 65423,
    65419, 65413, 65407, 65393, 65381, 65371, 65357, 65353
};

/* Memory patterns */
#define PATTERN_SEQUENTIAL  0
#define PATTERN_RANDOM_WALK 1
#define PATTERN_BUTTERFLY   2
#define PATTERN_LATTICE     3
#define PATTERN_QUANTUM     4

/* Scratchpad sizes */
#define MIN_SCRATCHPAD_SIZE (4 * 1024 * 1024)   /* 4 MB */
#define MAX_SCRATCHPAD_SIZE (16 * 1024 * 1024)  /* 16 MB */

/* Base mixing rounds */
#define BASE_MIXING_ROUNDS 12
#define MAX_EXTRA_ROUNDS   12

/* ============================================================================
 * Helper functions - Scalar
 * ============================================================================ */

static inline uint32_t rotl32(uint32_t x, int n) {
    return (x << n) | (x >> (32 - n));
}

static inline uint32_t rotr32(uint32_t x, int n) {
    return (x >> n) | (x << (32 - n));
}

static inline uint32_t wrapping_add(uint32_t a, uint32_t b) {
    return (a + b) & MASK32;
}

static inline uint32_t wrapping_mul(uint32_t a, uint32_t b) {
    return (uint32_t)(((uint64_t)a * (uint64_t)b) & MASK32);
}

/* ============================================================================
 * Dynamic parameters
 * ============================================================================ */

typedef struct {
    uint32_t mixing_rounds;
    size_t scratchpad_size;
    int memory_pattern;
    uint8_t rotation_schedule[8];
    uint32_t noise_modulus;
} DynamicParams;

static void derive_params(const uint8_t* prev_hash, uint64_t block_height, DynamicParams* params) {
    /* Mixing rounds: 12 + (first byte % 13) = 12-24 */
    params->mixing_rounds = BASE_MIXING_ROUNDS + (prev_hash[0] % (MAX_EXTRA_ROUNDS + 1));
    
    /* Scratchpad size: 4 MB * (1 + height % 4) = 4-16 MB */
    size_t size_multiplier = 1 + (block_height % 4);
    params->scratchpad_size = MIN_SCRATCHPAD_SIZE * size_multiplier;
    
    /* Memory pattern from block height */
    params->memory_pattern = block_height % 5;
    
    /* Rotation schedule from hash bytes 1-8 */
    for (int i = 0; i < 8; i++) {
        params->rotation_schedule[i] = prev_hash[i + 1] % 32;
    }
    
    /* Noise modulus (prime) */
    params->noise_modulus = PRIMES[prev_hash[16] % 16];
}

/* ============================================================================
 * Core hashing functions - Scalar implementation
 * ============================================================================ */

static void quick_mix(uint32_t* state) {
    uint32_t tmp;
    /* Swap first half with second half */
    for (int i = 0; i < 4; i++) {
        tmp = state[i];
        state[i] = state[7 - i];
        state[7 - i] = tmp;
    }
    /* Mix with PHI */
    for (int i = 0; i < 8; i++) {
        state[i] = wrapping_mul(rotl32(state[i], 7), PHI);
    }
}

static void generate_chunk(const uint32_t* state, uint32_t index, uint32_t* chunk) {
    /* Copy state */
    for (int i = 0; i < 8; i++) {
        chunk[i] = state[i];
    }
    
    /* Mix index */
    chunk[0] ^= index;
    chunk[7] ^= rotl32(index, 16);
    
    /* Mini mixing rounds */
    for (int r = 0; r < 4; r++) {
        for (int i = 0; i < 8; i++) {
            int next = (i + 1) % 8;
            chunk[i] = wrapping_mul(
                wrapping_add(rotl32(chunk[i], 5), chunk[next]),
                PHI
            );
        }
    }
}

static void fill_scratchpad(uint32_t* state, uint32_t* scratchpad, size_t scratchpad_words) {
    size_t num_chunks = scratchpad_words / 8;
    uint32_t chunk[8];
    
    for (size_t i = 0; i < num_chunks; i++) {
        generate_chunk(state, (uint32_t)i, chunk);
        
        /* Write to scratchpad */
        size_t offset = i * 8;
        for (int j = 0; j < 8; j++) {
            scratchpad[offset + j] = chunk[j];
        }
        
        /* Periodic state update */
        if ((i & 0x3FF) == 0) {  /* Every 1024 chunks */
            for (int j = 0; j < 8; j++) {
                state[j] ^= chunk[j];
            }
            quick_mix(state);
        }
    }
}

static uint32_t compute_access_index(
    const uint32_t* state,
    uint32_t round,
    uint32_t max_chunks,
    int pattern
) {
    uint64_t state_idx = (state[0] ^ state[4]) + ((uint64_t)(state[1] ^ state[5]) << 16);
    
    switch (pattern) {
        case PATTERN_SEQUENTIAL:
            return round % max_chunks;
            
        case PATTERN_RANDOM_WALK:
            return (uint32_t)((state_idx + round * PHI) % max_chunks);
            
        case PATTERN_BUTTERFLY: {
            int bits = 17;  /* log2(~128K) */
            int stage = round % bits;
            uint32_t mask = 1u << stage;
            uint32_t base = (uint32_t)(state_idx % max_chunks);
            uint32_t result = base ^ mask;
            return (result < max_chunks) ? result : base;
        }
            
        case PATTERN_LATTICE: {
            uint32_t dim = 1024;  /* sqrt(~1M) */
            uint32_t x = ((uint32_t)state_idx + round) % dim;
            uint32_t y = ((uint32_t)(state_idx >> 16) + round * 7) % dim;
            return (y * dim + x) % max_chunks;
        }
            
        case PATTERN_QUANTUM: {
            uint32_t amplitude = state[round % 8];
            uint32_t phase = state[(round + 4) % 8];
            uint32_t interference = amplitude ^ phase;
            return (uint32_t)(((uint64_t)interference * state_idx) % max_chunks);
        }
            
        default:
            return round % max_chunks;
    }
}

static void memory_hard_mix(
    uint32_t* state,
    uint32_t* scratchpad,
    size_t scratchpad_words,
    uint32_t mixing_rounds,
    const uint8_t* rotation_schedule,
    int pattern
) {
    uint32_t num_chunks = (uint32_t)(scratchpad_words / 8);
    
    for (uint32_t round = 0; round < mixing_rounds; round++) {
        /* Read from scratchpad */
        uint32_t read_idx = compute_access_index(state, round, num_chunks, pattern);
        size_t offset = read_idx * 8;
        
        /* Mix chunk into state */
        uint32_t rotation = rotation_schedule[round % 8];
        for (int i = 0; i < 8; i++) {
            state[i] = wrapping_mul(
                wrapping_add(rotl32(state[i], rotation), scratchpad[offset + i]),
                PHI
            );
        }
        
        /* Generate new chunk and write back */
        uint32_t new_chunk[8];
        generate_chunk(state, round, new_chunk);
        
        uint32_t write_idx = compute_access_index(state, round + mixing_rounds, num_chunks, pattern);
        size_t write_offset = write_idx * 8;
        for (int i = 0; i < 8; i++) {
            scratchpad[write_offset + i] = new_chunk[i];
        }
    }
}

static void inject_lattice_noise(uint32_t* state, uint32_t noise_modulus) {
    for (int i = 0; i < 8; i++) {
        uint32_t noise = wrapping_mul(state[i], PHI);
        noise = (noise % noise_modulus) * (noise_modulus - 1);
        state[i] = wrapping_add(state[i], noise);
    }
}

static void golden_finalize(uint32_t* state) {
    /* Multiple rounds of mixing */
    for (int round = 0; round < 8; round++) {
        for (int i = 0; i < 8; i++) {
            int next = (i + 1) % 8;
            int prev = (i + 7) % 8;
            state[i] = wrapping_mul(
                wrapping_add(
                    wrapping_add(rotl32(state[i], 7), state[next]),
                    rotr32(state[prev], 11)
                ),
                PHI
            );
        }
    }
    
    /* Final XOR compression */
    uint32_t xor_all = 0;
    for (int i = 0; i < 8; i++) {
        xor_all ^= state[i];
    }
    for (int i = 0; i < 8; i++) {
        state[i] ^= wrapping_mul(xor_all, PHI);
    }
}

/* ============================================================================
 * AVX2 optimized functions
 * ============================================================================ */

#if HAS_AVX2

static void fill_scratchpad_avx2(uint32_t* state, uint32_t* scratchpad, size_t scratchpad_words) {
    /* AVX2 can process 8 x 32-bit = 256 bits at once */
    __m256i phi_vec = _mm256_set1_epi32(PHI);
    __m256i state_vec = _mm256_loadu_si256((__m256i*)state);
    
    size_t num_chunks = scratchpad_words / 8;
    
    for (size_t i = 0; i < num_chunks; i++) {
        /* Generate chunk using AVX2 */
        __m256i chunk = state_vec;
        __m256i index_vec = _mm256_set1_epi32((uint32_t)i);
        
        /* XOR index into first and last elements */
        chunk = _mm256_xor_si256(chunk, _mm256_blend_epi32(
            _mm256_setzero_si256(), index_vec, 0x01));
        
        /* Mini mixing (simplified for AVX2) */
        for (int r = 0; r < 4; r++) {
            /* Rotate and shuffle */
            __m256i shifted = _mm256_permutevar8x32_epi32(chunk,
                _mm256_set_epi32(0, 7, 6, 5, 4, 3, 2, 1));
            
            /* Add and multiply */
            chunk = _mm256_add_epi32(chunk, shifted);
            chunk = _mm256_mullo_epi32(chunk, phi_vec);
        }
        
        /* Store to scratchpad */
        _mm256_storeu_si256((__m256i*)(scratchpad + i * 8), chunk);
        
        /* Periodic state update */
        if ((i & 0x3FF) == 0) {
            state_vec = _mm256_xor_si256(state_vec, chunk);
            /* Quick mix using AVX2 */
            state_vec = _mm256_permutevar8x32_epi32(state_vec,
                _mm256_set_epi32(0, 1, 2, 3, 4, 5, 6, 7));
            state_vec = _mm256_mullo_epi32(state_vec, phi_vec);
        }
    }
    
    /* Store back state */
    _mm256_storeu_si256((__m256i*)state, state_vec);
}

static void golden_finalize_avx2(uint32_t* state) {
    __m256i phi_vec = _mm256_set1_epi32(PHI);
    __m256i state_vec = _mm256_loadu_si256((__m256i*)state);
    
    /* 8 rounds of mixing */
    for (int round = 0; round < 8; round++) {
        /* Rotate state vector left and right */
        __m256i next = _mm256_permutevar8x32_epi32(state_vec,
            _mm256_set_epi32(0, 7, 6, 5, 4, 3, 2, 1));
        __m256i prev = _mm256_permutevar8x32_epi32(state_vec,
            _mm256_set_epi32(6, 5, 4, 3, 2, 1, 0, 7));
        
        /* Mix: rotl + add + rotr + mul */
        state_vec = _mm256_add_epi32(state_vec, next);
        state_vec = _mm256_add_epi32(state_vec, prev);
        state_vec = _mm256_mullo_epi32(state_vec, phi_vec);
    }
    
    /* XOR compression */
    uint32_t temp[8];
    _mm256_storeu_si256((__m256i*)temp, state_vec);
    uint32_t xor_all = temp[0] ^ temp[1] ^ temp[2] ^ temp[3] ^
                       temp[4] ^ temp[5] ^ temp[6] ^ temp[7];
    __m256i xor_vec = _mm256_set1_epi32(xor_all);
    xor_vec = _mm256_mullo_epi32(xor_vec, phi_vec);
    state_vec = _mm256_xor_si256(state_vec, xor_vec);
    
    _mm256_storeu_si256((__m256i*)state, state_vec);
}

#endif /* HAS_AVX2 */

/* ============================================================================
 * ARM NEON optimized functions (Apple Silicon, etc.)
 * ============================================================================ */

#if HAS_NEON

static void fill_scratchpad_neon(uint32_t* state, uint32_t* scratchpad, size_t scratchpad_words) {
    /* NEON can process 4 x 32-bit = 128 bits at once, so we process in two halves */
    uint32x4_t phi_vec = vdupq_n_u32(PHI);
    uint32x4_t state_lo = vld1q_u32(state);      /* state[0..3] */
    uint32x4_t state_hi = vld1q_u32(state + 4);  /* state[4..7] */
    
    size_t num_chunks = scratchpad_words / 8;
    
    for (size_t i = 0; i < num_chunks; i++) {
        /* Generate chunk using NEON */
        uint32x4_t chunk_lo = state_lo;
        uint32x4_t chunk_hi = state_hi;
        
        /* XOR index into first element */
        uint32_t idx = (uint32_t)i;
        chunk_lo = vsetq_lane_u32(vgetq_lane_u32(chunk_lo, 0) ^ idx, chunk_lo, 0);
        chunk_hi = vsetq_lane_u32(vgetq_lane_u32(chunk_hi, 3) ^ ((idx << 16) | (idx >> 16)), chunk_hi, 3);
        
        /* Mini mixing */
        for (int r = 0; r < 4; r++) {
            /* Shift and combine */
            uint32x4_t shifted_lo = vextq_u32(chunk_lo, chunk_hi, 1);
            uint32x4_t shifted_hi = vextq_u32(chunk_hi, chunk_lo, 1);
            
            /* Add and multiply */
            chunk_lo = vaddq_u32(chunk_lo, shifted_lo);
            chunk_hi = vaddq_u32(chunk_hi, shifted_hi);
            chunk_lo = vmulq_u32(chunk_lo, phi_vec);
            chunk_hi = vmulq_u32(chunk_hi, phi_vec);
        }
        
        /* Store to scratchpad */
        vst1q_u32(scratchpad + i * 8, chunk_lo);
        vst1q_u32(scratchpad + i * 8 + 4, chunk_hi);
        
        /* Periodic state update */
        if ((i & 0x3FF) == 0) {
            state_lo = veorq_u32(state_lo, chunk_lo);
            state_hi = veorq_u32(state_hi, chunk_hi);
            /* Quick mix using NEON - reverse */
            uint32x4_t temp = state_lo;
            state_lo = vrev64q_u32(state_hi);
            state_hi = vrev64q_u32(temp);
            state_lo = vmulq_u32(state_lo, phi_vec);
            state_hi = vmulq_u32(state_hi, phi_vec);
        }
    }
    
    /* Store back state */
    vst1q_u32(state, state_lo);
    vst1q_u32(state + 4, state_hi);
}

static void golden_finalize_neon(uint32_t* state) {
    uint32x4_t phi_vec = vdupq_n_u32(PHI);
    uint32x4_t state_lo = vld1q_u32(state);
    uint32x4_t state_hi = vld1q_u32(state + 4);
    
    /* 8 rounds of mixing */
    for (int round = 0; round < 8; round++) {
        /* Rotate state vector left and right */
        uint32x4_t next_lo = vextq_u32(state_lo, state_hi, 1);
        uint32x4_t next_hi = vextq_u32(state_hi, state_lo, 1);
        uint32x4_t prev_lo = vextq_u32(state_hi, state_lo, 3);
        uint32x4_t prev_hi = vextq_u32(state_lo, state_hi, 3);
        
        /* Mix: add + mul */
        state_lo = vaddq_u32(state_lo, next_lo);
        state_hi = vaddq_u32(state_hi, next_hi);
        state_lo = vaddq_u32(state_lo, prev_lo);
        state_hi = vaddq_u32(state_hi, prev_hi);
        state_lo = vmulq_u32(state_lo, phi_vec);
        state_hi = vmulq_u32(state_hi, phi_vec);
    }
    
    /* XOR compression */
    uint32x4_t xor_vec = veorq_u32(state_lo, state_hi);
    uint32x2_t xor_half = veor_u32(vget_low_u32(xor_vec), vget_high_u32(xor_vec));
    uint32_t xor_all = vget_lane_u32(xor_half, 0) ^ vget_lane_u32(xor_half, 1);
    
    uint32x4_t final_xor = vmulq_u32(vdupq_n_u32(xor_all), phi_vec);
    state_lo = veorq_u32(state_lo, final_xor);
    state_hi = veorq_u32(state_hi, final_xor);
    
    vst1q_u32(state, state_lo);
    vst1q_u32(state + 4, state_hi);
}

#endif /* HAS_NEON */

/* ============================================================================
 * Public API
 * ============================================================================ */

typedef struct {
    uint32_t state[8];
    uint32_t* scratchpad;
    size_t scratchpad_words;
    DynamicParams params;
    int use_simd;  /* 1 = AVX2, 2 = NEON, 0 = scalar */
} CosmicHarmonyV2Context;

EXPORT CosmicHarmonyV2Context* cosmic_v2_create(
    const uint8_t* prev_hash,
    uint64_t block_height
) {
    CosmicHarmonyV2Context* ctx = (CosmicHarmonyV2Context*)malloc(sizeof(CosmicHarmonyV2Context));
    if (!ctx) return NULL;
    
    /* Initialize state */
    memcpy(ctx->state, IV, sizeof(IV));
    
    /* Derive parameters */
    derive_params(prev_hash, block_height, &ctx->params);
    
    /* Allocate scratchpad */
    ctx->scratchpad_words = ctx->params.scratchpad_size / 4;
    ctx->scratchpad = (uint32_t*)ALIGNED_ALLOC(32, ctx->params.scratchpad_size);
    if (!ctx->scratchpad) {
        free(ctx);
        return NULL;
    }
    memset(ctx->scratchpad, 0, ctx->params.scratchpad_size);
    
    /* Check for SIMD support at runtime */
#if HAS_AVX2
    ctx->use_simd = 1;  /* AVX2 */
#elif HAS_NEON
    ctx->use_simd = 2;  /* NEON */
#else
    ctx->use_simd = 0;  /* Scalar */
#endif
    
    return ctx;
}

EXPORT void cosmic_v2_destroy(CosmicHarmonyV2Context* ctx) {
    if (ctx) {
        if (ctx->scratchpad) {
            ALIGNED_FREE(ctx->scratchpad);
        }
        free(ctx);
    }
}

EXPORT void cosmic_v2_reset(CosmicHarmonyV2Context* ctx) {
    memcpy(ctx->state, IV, sizeof(IV));
    memset(ctx->scratchpad, 0, ctx->params.scratchpad_size);
}

EXPORT int cosmic_v2_hash(
    CosmicHarmonyV2Context* ctx,
    const uint8_t* input,
    size_t input_len,
    uint64_t nonce,
    uint8_t* output
) {
    if (!ctx || !input || !output) return -1;
    
    cosmic_v2_reset(ctx);
    
    /* Phase 1: Absorb input */
    for (size_t i = 0; i < input_len && i < 32; i += 4) {
        size_t idx = i / 4;
        if (idx < 8) {
            uint32_t word = 0;
            for (int j = 0; j < 4 && (i + j) < input_len; j++) {
                word |= ((uint32_t)input[i + j]) << (j * 8);
            }
            ctx->state[idx] ^= word;
        }
    }
    
    /* Mix nonce */
    ctx->state[0] ^= (uint32_t)nonce;
    ctx->state[1] ^= (uint32_t)(nonce >> 32);
    ctx->state[2] ^= rotl32((uint32_t)nonce, 17);
    ctx->state[3] ^= rotr32((uint32_t)(nonce >> 32), 13);
    
    /* Phase 2: Fill scratchpad */
#if HAS_AVX2
    if (ctx->use_simd == 1) {
        fill_scratchpad_avx2(ctx->state, ctx->scratchpad, ctx->scratchpad_words);
    } else
#endif
#if HAS_NEON
    if (ctx->use_simd == 2) {
        fill_scratchpad_neon(ctx->state, ctx->scratchpad, ctx->scratchpad_words);
    } else
#endif
    {
        fill_scratchpad(ctx->state, ctx->scratchpad, ctx->scratchpad_words);
    }
    
    /* Phase 3: Memory-hard mixing */
    memory_hard_mix(
        ctx->state,
        ctx->scratchpad,
        ctx->scratchpad_words,
        ctx->params.mixing_rounds,
        ctx->params.rotation_schedule,
        ctx->params.memory_pattern
    );
    
    /* Phase 4: Lattice noise */
    inject_lattice_noise(ctx->state, ctx->params.noise_modulus);
    
    /* Phase 5: Finalization */
#if HAS_AVX2
    if (ctx->use_simd == 1) {
        golden_finalize_avx2(ctx->state);
    } else
#endif
#if HAS_NEON
    if (ctx->use_simd == 2) {
        golden_finalize_neon(ctx->state);
    } else
#endif
    {
        golden_finalize(ctx->state);
    }
    
    /* Output */
    for (int i = 0; i < 8; i++) {
        output[i * 4 + 0] = (ctx->state[i] >> 0) & 0xFF;
        output[i * 4 + 1] = (ctx->state[i] >> 8) & 0xFF;
        output[i * 4 + 2] = (ctx->state[i] >> 16) & 0xFF;
        output[i * 4 + 3] = (ctx->state[i] >> 24) & 0xFF;
    }
    
    return 0;
}

/* Simple hash function without context (for one-off hashing) */
EXPORT int cosmic_v2_hash_simple(
    const uint8_t* input,
    size_t input_len,
    uint64_t nonce,
    const uint8_t* prev_hash,
    uint64_t block_height,
    uint8_t* output
) {
    CosmicHarmonyV2Context* ctx = cosmic_v2_create(prev_hash, block_height);
    if (!ctx) return -1;
    
    int result = cosmic_v2_hash(ctx, input, input_len, nonce, output);
    
    cosmic_v2_destroy(ctx);
    return result;
}

/* Get info about the library */
EXPORT const char* cosmic_v2_get_info(void) {
#if HAS_AVX2
    return "Cosmic Harmony v2 Native (AVX2 optimized)";
#elif HAS_NEON
    return "Cosmic Harmony v2 Native (ARM NEON optimized)";
#else
    return "Cosmic Harmony v2 Native (scalar)";
#endif
}

EXPORT int cosmic_v2_has_avx2(void) {
#if HAS_AVX2
    return 1;
#else
    return 0;
#endif
}

EXPORT int cosmic_v2_has_neon(void) {
#if HAS_NEON
    return 1;
#else
    return 0;
#endif
}

/* Benchmark function */
EXPORT double cosmic_v2_benchmark(int duration_seconds) {
    uint8_t prev_hash[32] = {0};
    uint8_t input[32] = {0x12, 0x34, 0x56, 0x78};
    uint8_t output[32];
    uint64_t nonce = 0;
    
    CosmicHarmonyV2Context* ctx = cosmic_v2_create(prev_hash, 12345);
    if (!ctx) return 0.0;
    
    printf("Running benchmark for %d seconds...\n", duration_seconds);
    printf("Library: %s\n", cosmic_v2_get_info());
    
    uint64_t total_hashes = 0;
    
    /* Use clock() for portable timing */
    clock_t start = clock();
    double elapsed = 0.0;
    
    while (elapsed < duration_seconds) {
        cosmic_v2_hash(ctx, input, 32, nonce++, output);
        total_hashes++;
        
        if ((total_hashes % 100) == 0) {
            elapsed = (double)(clock() - start) / CLOCKS_PER_SEC;
        }
    }
    
    elapsed = (double)(clock() - start) / CLOCKS_PER_SEC;
    
    cosmic_v2_destroy(ctx);
    
    double hashrate = total_hashes / elapsed;
    printf("Total hashes: %llu\n", (unsigned long long)total_hashes);
    printf("Time: %.2f s\n", elapsed);
    printf("Hashrate: %.2f H/s\n", hashrate);
    
    return hashrate;
}

#ifdef BUILD_MAIN
int main(int argc, char** argv) {
    printf("=== Cosmic Harmony v2 Native Library ===\n");
    printf("%s\n\n", cosmic_v2_get_info());
    
    cosmic_v2_benchmark(10);
    
    return 0;
}
#endif
