/*
 * ============================================================================
 *  ZION Native GhostRider — FFI wrapper for Raptoreum (RTM)
 *
 *  Wraps the standalone gr_hash C implementation (from npq7721/gr_hash)
 *  with the ZION FFI ABI.
 *
 *  GhostRider algorithm: 15 core hash functions (X16r family) + 6 CryptoNight
 *  variants, selected dynamically based on previous block hash.
 *  3 stages: 5 core + 1 CN + 5 core + 1 CN + 5 core + 1 CN = 18 iterations.
 *
 *  Functions exported (matching Rust FFI in lib.rs):
 *    void ghostrider_zion_init(void)
 *    void ghostrider_zion_hash(const uint8_t* header, size_t header_len,
 *                               uint64_t nonce, uint8_t* output)
 *    int32_t ghostrider_zion_verify(const uint8_t* header, size_t header_len,
 *                                    uint64_t nonce, const uint8_t* target)
 *    const char* ghostrider_zion_version(void)
 *
 *  The nonce is a 4-byte LE value at offset 39 in the 80-byte Raptoreum
 *  block header (same as X16r/Ravencoin). The wrapper injects the nonce
 *  into a copy of the header before calling gr_hash.
 * ============================================================================
 */

#include <stdint.h>
#include <string.h>
#include <stdlib.h>
#include <stdio.h>

#ifdef _WIN32
    #define EXPORT __declspec(dllexport)
#else
    #define EXPORT
#endif

/* GhostRider core function from gr.c */
#include "gr.h"

/* ---- Constants ---- */
#define RTM_HEADER_SIZE 80
#define RTM_NONCE_OFFSET 76   /* nonce is last 4 bytes of 80-byte header */
#define RTM_NONCE_SIZE 4
#define HASH_OUTPUT_SIZE 32

/* ---- FFI exports ---- */

/* No-op init — GhostRider is stateless (no VM/dataset like RandomX) */
EXPORT void ghostrider_zion_init(void) {
    /* Nothing to do — GhostRider uses stack-allocated scratchpads */
}

/*
 * Compute GhostRider hash of (header || nonce) into 32 bytes.
 *
 * The Raptoreum block header is 80 bytes. The nonce is a 4-byte LE value
 * at offset 39. We copy the header, inject the nonce, and call gr_hash.
 *
 * If header_len < 80, we pad with zeros to 80 bytes.
 * If header_len > 80, we use only the first 80 bytes.
 */
EXPORT void ghostrider_zion_hash(const uint8_t* header, size_t header_len,
                                  uint64_t nonce, uint8_t* output)
{
    uint8_t buf[80];
    memset(buf, 0, sizeof(buf));

    /* Copy header (up to 80 bytes) */
    size_t copy_len = header_len < RTM_HEADER_SIZE ? header_len : RTM_HEADER_SIZE;
    memcpy(buf, header, copy_len);

    /* Inject 4-byte LE nonce at offset 39 */
    uint32_t nonce32 = (uint32_t)(nonce & 0xFFFFFFFF);
    memcpy(buf + RTM_NONCE_OFFSET, &nonce32, RTM_NONCE_SIZE);

    /* Compute GhostRider hash */
    gr_hash((const char*)buf, (char*)output);
}

/*
 * Verify GhostRider hash against a 32-byte target (little-endian).
 * Returns 1 if hash <= target, 0 otherwise.
 */
EXPORT int32_t ghostrider_zion_verify(const uint8_t* header, size_t header_len,
                                       uint64_t nonce, const uint8_t* target)
{
    uint8_t hash[32];
    ghostrider_zion_hash(header, header_len, nonce, hash);

    /* Compare hash (LE) against target (LE) — hash must be <= target */
    for (int i = 31; i >= 0; --i) {
        if (hash[i] < target[i]) return 1;
        if (hash[i] > target[i]) return 0;
    }
    return 1; /* equal */
}

EXPORT const char* ghostrider_zion_version(void)
{
    return "ghostrider-zion-1.0.0 (sphlib + cryptonote, npq7721/gr_hash)";
}

/*
 * Debug function: print selected algorithms for a given header.
 * Writes 15 core algo indices + 14 CN algo indices into output (29 bytes).
 */
EXPORT void ghostrider_zion_debug_algos(const uint8_t* header, size_t header_len,
                                         uint64_t nonce, uint8_t* output)
{
    uint8_t buf[80];
    memset(buf, 0, sizeof(buf));
    size_t copy_len = header_len < RTM_HEADER_SIZE ? header_len : RTM_HEADER_SIZE;
    memcpy(buf, header, copy_len);
    uint32_t nonce32 = (uint32_t)(nonce & 0xFFFFFFFF);
    memcpy(buf + RTM_NONCE_OFFSET, &nonce32, RTM_NONCE_SIZE);

    uint8_t selectedAlgoOutput[15] = {0};
    uint8_t selectedCNAlgoOutput[14] = {0};
    getAlgoString(&buf[4], 64, selectedAlgoOutput, 15);
    getAlgoString(&buf[4], 64, selectedCNAlgoOutput, 14);

    memcpy(output, selectedAlgoOutput, 15);
    memcpy(output + 15, selectedCNAlgoOutput, 14);
}
