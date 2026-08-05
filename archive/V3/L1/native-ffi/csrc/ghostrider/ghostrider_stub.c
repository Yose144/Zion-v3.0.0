/* ghostrider_stub.c -- portable stub (Keccak-256 placeholder)
 *
 * Used when real GhostRider sources (csrc/ghostrider/real/) are not present.
 * Produces a deterministic but INVALID hash -- only for testing the stratum
 * pipeline, not actual Raptoreum mining.
 */
#include <stdint.h>
#include <string.h>

#ifdef _WIN32
    #define EXPORT __declspec(dllexport)
#else
    #define EXPORT
#endif

/* Minimal Keccak-256 (simplified) */
static void keccak256_stub(const uint8_t* data, size_t len, uint8_t* out) {
    /* Simplified: XOR-fold + SHA-256-like mixing */
    memset(out, 0, 32);
    for (size_t i = 0; i < len; ++i) {
        out[i % 32] ^= data[i];
        out[(i + 1) % 32] += (uint8_t)(data[i] * 31 + i * 7);
    }
    /* Extra mixing pass */
    for (int r = 0; r < 24; ++r) {
        uint8_t t = out[0];
        for (int i = 0; i < 31; ++i) out[i] = out[i + 1];
        out[31] = t;
        out[0] ^= 0x01;
    }
}

EXPORT void ghostrider_zion_init(void) {}

EXPORT void ghostrider_zion_hash(const uint8_t* header, size_t header_len,
                                  uint64_t nonce, uint8_t* output) {
    uint8_t buf[80];
    memset(buf, 0, sizeof(buf));
    size_t copy_len = header_len < 80 ? header_len : 80;
    memcpy(buf, header, copy_len);
    uint32_t nonce32 = (uint32_t)(nonce & 0xFFFFFFFF);
    memcpy(buf + 39, &nonce32, 4);
    keccak256_stub(buf, 80, output);
}

EXPORT int32_t ghostrider_zion_verify(const uint8_t* header, size_t header_len,
                                       uint64_t nonce, const uint8_t* target) {
    uint8_t hash[32];
    ghostrider_zion_hash(header, header_len, nonce, hash);
    for (int i = 31; i >= 0; --i) {
        if (hash[i] < target[i]) return 1;
        if (hash[i] > target[i]) return 0;
    }
    return 1;
}

EXPORT const char* ghostrider_zion_version(void) {
    return "ghostrider-stub-1.0.0 (placeholder -- install real sources for mining)";
}
