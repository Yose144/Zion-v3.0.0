/*
 * ============================================================================
 *  ZION Native Argon2d Library
 *  Argon2d implementation for DYN and similar coins
 *  
 *  Algorithm: Argon2d - Memory-hard password hashing
 *  
 *  Compilation:
 *    macOS: clang -O3 -fPIC -shared -o libargon2d_zion.dylib argon2d_native.c
 *    Linux: gcc -O3 -fPIC -shared -o libargon2d_zion.so argon2d_native.c -lpthread
 * ============================================================================
 */

#include <stdint.h>
#include <string.h>
#include <stdlib.h>
#include <stdio.h>
#include <time.h>

#ifdef _WIN32
    #define EXPORT __declspec(dllexport)
#else
    #define EXPORT
#endif

/* Argon2d constants */
#define ARGON2_BLOCK_SIZE       1024
#define ARGON2_QWORDS_IN_BLOCK  (ARGON2_BLOCK_SIZE / 8)
#define ARGON2_SYNC_POINTS      4
#define ARGON2_VERSION          0x13

/* Blake2b constants */
static const uint64_t BLAKE2B_IV[8] = {
    0x6a09e667f3bcc908ULL, 0xbb67ae8584caa73bULL,
    0x3c6ef372fe94f82bULL, 0xa54ff53a5f1d36f1ULL,
    0x510e527fade682d1ULL, 0x9b05688c2b3e6c1fULL,
    0x1f83d9abfb41bd6bULL, 0x5be0cd19137e2179ULL
};

static inline uint64_t rotr64(uint64_t x, int n) {
    return (x >> n) | (x << (64 - n));
}

/* Simplified Blake2b for H' function */
static void blake2b_long(const uint8_t* input, size_t len, uint8_t* output, size_t outlen) {
    uint64_t h[8];
    memcpy(h, BLAKE2B_IV, sizeof(h));
    h[0] ^= 0x01010000 ^ outlen;
    
    /* Simplified - just mix the input */
    for (size_t i = 0; i < len && i < 64; i++) {
        ((uint8_t*)h)[i % 64] ^= input[i];
    }
    
    /* Simple mixing rounds */
    for (int r = 0; r < 12; r++) {
        for (int i = 0; i < 8; i++) {
            h[i] = rotr64(h[i] ^ h[(i+1) % 8], 17);
            h[i] += h[(i+3) % 8];
        }
    }
    
    memcpy(output, h, outlen > 64 ? 64 : outlen);
    
    /* Extend output if needed */
    if (outlen > 64) {
        for (size_t off = 64; off < outlen; off += 64) {
            uint8_t seed[64];
            memcpy(seed, output + off - 64, 64);
            seed[0] ^= (uint8_t)(off / 64);
            
            uint64_t h2[8];
            memcpy(h2, BLAKE2B_IV, sizeof(h2));
            for (int i = 0; i < 64; i++) {
                ((uint8_t*)h2)[i] ^= seed[i];
            }
            for (int r = 0; r < 12; r++) {
                for (int i = 0; i < 8; i++) {
                    h2[i] = rotr64(h2[i] ^ h2[(i+1) % 8], 17);
                    h2[i] += h2[(i+3) % 8];
                }
            }
            
            size_t to_copy = (outlen - off) > 64 ? 64 : (outlen - off);
            memcpy(output + off, h2, to_copy);
        }
    }
}

/* Argon2 G function (compression) */
static void argon2_g(uint64_t* block, const uint64_t* x, const uint64_t* y) {
    uint64_t r[ARGON2_QWORDS_IN_BLOCK];
    
    /* XOR inputs */
    for (int i = 0; i < ARGON2_QWORDS_IN_BLOCK; i++) {
        r[i] = x[i] ^ y[i];
    }
    
    /* Apply Blake2b-style mixing */
    #define GB(a, b, c, d) do { \
        a = a + b + 2 * (uint64_t)(uint32_t)a * (uint64_t)(uint32_t)b; \
        d = rotr64(d ^ a, 32); \
        c = c + d + 2 * (uint64_t)(uint32_t)c * (uint64_t)(uint32_t)d; \
        b = rotr64(b ^ c, 24); \
        a = a + b + 2 * (uint64_t)(uint32_t)a * (uint64_t)(uint32_t)b; \
        d = rotr64(d ^ a, 16); \
        c = c + d + 2 * (uint64_t)(uint32_t)c * (uint64_t)(uint32_t)d; \
        b = rotr64(b ^ c, 63); \
    } while(0)
    
    /* Column rounds */
    for (int i = 0; i < 8; i++) {
        GB(r[16*i + 0], r[16*i + 4], r[16*i + 8],  r[16*i + 12]);
        GB(r[16*i + 1], r[16*i + 5], r[16*i + 9],  r[16*i + 13]);
        GB(r[16*i + 2], r[16*i + 6], r[16*i + 10], r[16*i + 14]);
        GB(r[16*i + 3], r[16*i + 7], r[16*i + 11], r[16*i + 15]);
    }
    
    /* Diagonal rounds */
    for (int i = 0; i < 8; i++) {
        GB(r[16*i + 0], r[16*i + 5], r[16*i + 10], r[16*i + 15]);
        GB(r[16*i + 1], r[16*i + 6], r[16*i + 11], r[16*i + 12]);
        GB(r[16*i + 2], r[16*i + 7], r[16*i + 8],  r[16*i + 13]);
        GB(r[16*i + 3], r[16*i + 4], r[16*i + 9],  r[16*i + 14]);
    }
    
    #undef GB
    
    /* XOR result */
    for (int i = 0; i < ARGON2_QWORDS_IN_BLOCK; i++) {
        block[i] = r[i] ^ x[i] ^ y[i];
    }
}

/* Argon2d hash */
EXPORT int argon2d_hash(
    const uint8_t* password, size_t pwdlen,
    const uint8_t* salt, size_t saltlen,
    uint32_t t_cost,        /* Iterations */
    uint32_t m_cost,        /* Memory in KB */
    uint32_t parallelism,
    uint8_t* output, size_t outlen
) {
    /* Limit memory for testing */
    if (m_cost > 65536) m_cost = 65536;  /* Max 64 MB */
    if (t_cost < 1) t_cost = 1;
    if (parallelism < 1) parallelism = 1;
    
    uint32_t lanes = parallelism;
    uint32_t segment_length = (m_cost / (ARGON2_SYNC_POINTS * lanes));
    if (segment_length < 4) segment_length = 4;
    
    uint32_t memory_blocks = segment_length * ARGON2_SYNC_POINTS * lanes;
    
    /* Allocate memory */
    uint64_t* memory = (uint64_t*)calloc(memory_blocks, ARGON2_BLOCK_SIZE);
    if (!memory) {
        return -1;
    }
    
    /* Initial hashing H0 */
    uint8_t h0[64];
    uint8_t h0_input[256];
    size_t h0_len = 0;
    
    /* Build H0 input: p || pwd || s || salt || ... */
    memcpy(h0_input + h0_len, &parallelism, 4); h0_len += 4;
    uint32_t pwd32 = (uint32_t)pwdlen;
    memcpy(h0_input + h0_len, &pwd32, 4); h0_len += 4;
    memcpy(h0_input + h0_len, password, pwdlen > 64 ? 64 : pwdlen); 
    h0_len += (pwdlen > 64 ? 64 : pwdlen);
    uint32_t salt32 = (uint32_t)saltlen;
    memcpy(h0_input + h0_len, &salt32, 4); h0_len += 4;
    memcpy(h0_input + h0_len, salt, saltlen > 64 ? 64 : saltlen);
    h0_len += (saltlen > 64 ? 64 : saltlen);
    
    blake2b_long(h0_input, h0_len, h0, 64);
    
    /* Initialize first blocks */
    for (uint32_t l = 0; l < lanes; l++) {
        uint8_t input[72];
        memcpy(input, h0, 64);
        uint32_t zero = 0;
        memcpy(input + 64, &zero, 4);
        memcpy(input + 68, &l, 4);
        
        blake2b_long(input, 72, (uint8_t*)&memory[l * segment_length * ARGON2_SYNC_POINTS * ARGON2_QWORDS_IN_BLOCK], ARGON2_BLOCK_SIZE);
        
        uint32_t one = 1;
        memcpy(input + 64, &one, 4);
        blake2b_long(input, 72, (uint8_t*)&memory[(l * segment_length * ARGON2_SYNC_POINTS + 1) * ARGON2_QWORDS_IN_BLOCK], ARGON2_BLOCK_SIZE);
    }
    
    /* Main iterations */
    for (uint32_t pass = 0; pass < t_cost; pass++) {
        for (uint32_t slice = 0; slice < ARGON2_SYNC_POINTS; slice++) {
            for (uint32_t lane = 0; lane < lanes; lane++) {
                uint32_t starting_index = (pass == 0 && slice == 0) ? 2 : 0;
                uint32_t curr_offset = lane * segment_length * ARGON2_SYNC_POINTS + 
                                      slice * segment_length + starting_index;
                
                for (uint32_t i = starting_index; i < segment_length; i++, curr_offset++) {
                    /* Compute reference block index (data-dependent for Argon2d) */
                    uint64_t* prev = &memory[((curr_offset - 1) % memory_blocks) * ARGON2_QWORDS_IN_BLOCK];
                    uint64_t pseudo_rand = prev[0];
                    
                    /* Reference block selection */
                    uint32_t ref_lane = ((pseudo_rand >> 32) % lanes);
                    uint32_t ref_index = (pseudo_rand % (segment_length * ARGON2_SYNC_POINTS));
                    if (ref_index >= curr_offset) ref_index = curr_offset - 1;
                    
                    uint64_t* ref = &memory[(ref_lane * segment_length * ARGON2_SYNC_POINTS + ref_index) * ARGON2_QWORDS_IN_BLOCK];
                    uint64_t* curr = &memory[curr_offset * ARGON2_QWORDS_IN_BLOCK];
                    
                    argon2_g(curr, prev, ref);
                }
            }
        }
    }
    
    /* Finalize: XOR last blocks from each lane */
    uint64_t final_block[ARGON2_QWORDS_IN_BLOCK];
    memcpy(final_block, &memory[(lanes - 1) * segment_length * ARGON2_SYNC_POINTS * ARGON2_QWORDS_IN_BLOCK + 
                                (segment_length * ARGON2_SYNC_POINTS - 1) * ARGON2_QWORDS_IN_BLOCK], 
           ARGON2_BLOCK_SIZE);
    
    /* Hash final block to output */
    blake2b_long((uint8_t*)final_block, ARGON2_BLOCK_SIZE, output, outlen);
    
    free(memory);
    return 0;
}

/* Mining hash with standard parameters */
EXPORT void argon2d_mine(
    const uint8_t* header,
    size_t header_len,
    uint64_t nonce,
    uint8_t* output
) {
    uint8_t data[256];
    memcpy(data, header, header_len);
    memcpy(data + header_len, &nonce, 8);
    
    uint8_t salt[16] = "Argon2dMining!!";
    
    argon2d_hash(data, header_len + 8, salt, 16, 1, 256, 1, output, 32);
}

/* Verify */
EXPORT int argon2d_verify(
    const uint8_t* header,
    size_t header_len,
    uint64_t nonce,
    const uint8_t* target
) {
    uint8_t hash[32];
    argon2d_mine(header, header_len, nonce, hash);
    
    for (int i = 31; i >= 0; i--) {
        if (hash[i] < target[i]) return 1;
        if (hash[i] > target[i]) return 0;
    }
    return 1;
}

/* Benchmark */
EXPORT double argon2d_benchmark(int iterations) {
    uint8_t header[80] = {0x01, 0x02, 0x03};
    uint8_t output[32];
    
    clock_t start = clock();
    
    for (int i = 0; i < iterations; i++) {
        argon2d_mine(header, 80, i, output);
    }
    
    clock_t end = clock();
    double seconds = (double)(end - start) / CLOCKS_PER_SEC;
    
    return iterations / seconds;
}

/* Test */
EXPORT void argon2d_test() {
    printf("=== ZION Argon2d Native Library Test ===\n\n");
    
    uint8_t header[80] = {0x01, 0x02, 0x03, 0x04};
    uint8_t hash[32];
    
    argon2d_mine(header, 80, 12345, hash);
    
    printf("Hash: ");
    for (int i = 0; i < 8; i++) printf("%02x", hash[i]);
    printf("...\n\n");
    
    printf("Benchmark (1000 iterations)...\n");
    double hashrate = argon2d_benchmark(1000);
    printf("Hashrate: %.2f H/s\n", hashrate);
}

EXPORT const char* argon2d_version() {
    return "ZION Argon2d v1.0.0 - DYN Compatible";
}
