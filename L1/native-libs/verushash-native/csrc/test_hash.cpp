/*
 * test_hash.cpp — Verify VerusHash v2b1 and v2b2 outputs against reference vectors.
 *
 * Compile: g++ -O2 -march=armv8-a+crypto -o test_hash test_hash.cpp \
 *          -I. verus_hash.cpp verus_clhash.cpp verus_clhash_portable.cpp \
 *          haraka.c haraka_portable.c -DVERUSHASH_ARM
 *
 * Reference from verushash-node test.js:
 *   Input:  "Test1234" repeated 12 times (96 bytes)
 *   v2b1 hash (BE): 0ef8b9530ce44a7ffb9b520daf8fcf59d1d22dd1bfa1a26ef4351d51e37071b7
 *
 * Note: verushash-node's test.js prints BE (reversed) hashes.
 * Our FFI returns LE (native order from Finalize2b).
 */

#include "compat.h"
#include "verus_hash.h"
#include <cstdio>
#include <cstring>

static void print_hex(const char* label, const unsigned char* data, int len) {
    printf("%s: ", label);
    for (int i = 0; i < len; i++) printf("%02x", data[i]);
    printf("\n");
}

static void reverse_bytes(unsigned char* dst, const unsigned char* src, int len) {
    for (int i = 0; i < len; i++) dst[i] = src[len - 1 - i];
}

int main() {
    // Initialize Haraka + VerusHash tables
    CVerusHash::init();
    CVerusHashV2::init();

    // Test input: "Test1234" * 12 = 96 bytes
    const char* pattern = "Test1234";
    unsigned char input[96];
    for (int i = 0; i < 12; i++) {
        memcpy(input + i * 8, pattern, 8);
    }

    printf("Input (%zu bytes): ", sizeof(input));
    print_hex("", input, 96);
    printf("\n");

    // ======= Test VerusHash v2b1 (SOLUTION_VERUSHHASH_V2_1 = 3) =======
    {
        unsigned char hash_le[32];
        CVerusHashV2 hasher(SOLUTION_VERUSHHASH_V2_1);
        hasher.Reset();
        hasher.Write(input, sizeof(input));
        hasher.Finalize2b(hash_le);

        unsigned char hash_be[32];
        reverse_bytes(hash_be, hash_le, 32);

        print_hex("v2b1 hash LE", hash_le, 32);
        print_hex("v2b1 hash BE", hash_be, 32);

        // Reference (BE): 0ef8b9530ce44a7ffb9b520daf8fcf59d1d22dd1bfa1a26ef4351d51e37071b7
        const unsigned char ref_be[32] = {
            0x0e, 0xf8, 0xb9, 0x53, 0x0c, 0xe4, 0x4a, 0x7f,
            0xfb, 0x9b, 0x52, 0x0d, 0xaf, 0x8f, 0xcf, 0x59,
            0xd1, 0xd2, 0x2d, 0xd1, 0xbf, 0xa1, 0xa2, 0x6e,
            0xf4, 0x35, 0x1d, 0x51, 0xe3, 0x70, 0x71, 0xb7
        };

        if (memcmp(hash_be, ref_be, 32) == 0) {
            printf("✅ v2b1: MATCH — ARM64 VerusHash v2b1 produces correct output!\n");
        } else {
            printf("❌ v2b1: MISMATCH — ARM64 VerusHash v2b1 is WRONG!\n");
            print_hex("  expected BE", ref_be, 32);
        }
        printf("\n");
    }

    // ======= Test VerusHash v2b2 (SOLUTION_VERUSHHASH_V2_2 = 4) =======
    {
        unsigned char hash_le[32];
        CVerusHashV2 hasher(SOLUTION_VERUSHHASH_V2_2);
        hasher.Reset();
        hasher.Write(input, sizeof(input));
        hasher.Finalize2b(hash_le);

        unsigned char hash_be[32];
        reverse_bytes(hash_be, hash_le, 32);

        print_hex("v2b2 hash LE", hash_le, 32);
        print_hex("v2b2 hash BE", hash_be, 32);
        printf("(No official reference for v2b2 yet — record this for cross-platform comparison)\n");
        printf("\n");
    }

    // ======= Test VerusHash v2b (SOLUTION_VERUSHHASH_V2 = 1) =======
    {
        unsigned char hash_le[32];
        CVerusHashV2 hasher(SOLUTION_VERUSHHASH_V2);
        hasher.Reset();
        hasher.Write(input, sizeof(input));
        hasher.Finalize2b(hash_le);

        unsigned char hash_be[32];
        reverse_bytes(hash_be, hash_le, 32);

        print_hex("v2b  hash LE", hash_le, 32);
        print_hex("v2b  hash BE", hash_be, 32);

        // Reference (BE): f971af1d4e551e9e71d35c6266fc19a98c6ad0388be1e9979f66921e07b5c9ac
        const unsigned char ref_be[32] = {
            0xf9, 0x71, 0xaf, 0x1d, 0x4e, 0x55, 0x1e, 0x9e,
            0x71, 0xd3, 0x5c, 0x62, 0x66, 0xfc, 0x19, 0xa9,
            0x8c, 0x6a, 0xd0, 0x38, 0x8b, 0xe1, 0xe9, 0x97,
            0x9f, 0x66, 0x92, 0x1e, 0x07, 0xb5, 0xc9, 0xac
        };

        if (memcmp(hash_be, ref_be, 32) == 0) {
            printf("✅ v2b:  MATCH — ARM64 VerusHash v2b produces correct output!\n");
        } else {
            printf("❌ v2b:  MISMATCH — ARM64 VerusHash v2b is WRONG!\n");
            print_hex("  expected BE", ref_be, 32);
        }
    }

    return 0;
}
