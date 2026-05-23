/*
 * cosmic_harmony_v42_batch.c — CHv4.2 Merkabah Dual-Spin batch mining
 *
 * Kompilace (macOS arm64 + NEON):
 *   clang -O3 -shared -fPIC -o libcosmic_harmony_v42.dylib \
 *         cosmic_harmony_v4_native.c cosmic_harmony_v42_batch.c
 *
 * Export:
 *   cosmic_harmony_v4_2_hash(header, header_len, nonce, output, output_len) → int
 *   cosmic_harmony_v4_2_batch_mine(header, header_len, nonce_start, nonce_count,
 *                                   target_u32, out_nonce, out_hash)          → int
 *   cosmic_harmony_v42_benchmark(nonce_count) → double  (H/s)
 */

#include <stdint.h>
#include <string.h>
#include <time.h>

#ifdef _WIN32
  #define EXPORT __declspec(dllexport)
#else
  #define EXPORT __attribute__((visibility("default")))
#endif

/* Forward declaration — implementováno v cosmic_harmony_v4_native.c */
extern int cosmic_harmony_v4_2_hash(
    const uint8_t *block_header,
    uint32_t       header_len,
    uint64_t       nonce,
    uint8_t       *output,
    uint32_t       output_len
);

/* ============================================================================
 * cosmic_harmony_v4_2_batch_mine
 *
 * Prochází [nonce_start, nonce_start + nonce_count) a hledá nonce kde
 * first 4 bytes výstupu (little-endian uint32) <= target_u32.
 *
 * target_u32  — kompaktní 32bitový cíl (pool canonical form)
 *
 * Vrací:
 *   1  — nonce nalezen → *out_nonce platný, out_hash[32] platný
 *   0  — nenalezeno v dávce
 *  -1  — neplatné parametry
 * ============================================================================ */
EXPORT int cosmic_harmony_v4_2_batch_mine(
    const uint8_t *header,
    uint32_t       header_len,
    uint64_t       nonce_start,
    uint32_t       nonce_count,
    uint32_t       target_u32,
    uint64_t      *out_nonce,
    uint8_t       *out_hash
) {
    if (!header || !out_nonce || !out_hash) return -1;

    uint8_t hash[32];

    for (uint32_t i = 0; i < nonce_count; i++) {
        uint64_t nonce = nonce_start + (uint64_t)i;

        if (cosmic_harmony_v4_2_hash(header, header_len, nonce, hash, 32) != 0)
            continue;

        /* Le-uint32 z prvních 4 bajtů */
        uint32_t state0 = (uint32_t)hash[0]
                        | ((uint32_t)hash[1] <<  8)
                        | ((uint32_t)hash[2] << 16)
                        | ((uint32_t)hash[3] << 24);

        if (state0 <= target_u32) {
            *out_nonce = nonce;
            memcpy(out_hash, hash, 32);
            return 1;
        }
    }
    return 0;
}

/* ============================================================================
 * cosmic_harmony_v42_benchmark
 *
 * Spustí nonce_count hashů a vrátí H/s jako double.
 * Header je vygenerovaný scratch buffer (67 bajtů).
 * ============================================================================ */
EXPORT double cosmic_harmony_v42_benchmark(uint32_t nonce_count) {
    uint8_t dummy_header[67];
    for (int i = 0; i < 67; i++) dummy_header[i] = (uint8_t)(i * 7 + 13);

    uint8_t hash[32];
    struct timespec t0, t1;
    clock_gettime(CLOCK_MONOTONIC, &t0);

    for (uint32_t i = 0; i < nonce_count; i++) {
        cosmic_harmony_v4_2_hash(dummy_header, 67, (uint64_t)i, hash, 32);
    }

    clock_gettime(CLOCK_MONOTONIC, &t1);

    double dt = (t1.tv_sec - t0.tv_sec) + (t1.tv_nsec - t0.tv_nsec) * 1e-9;
    return (double)nonce_count / (dt > 0 ? dt : 1e-6);
}
