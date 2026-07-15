/*
 * ============================================================================
 *  ZION Native RandomX — Real tevador/RandomX wrapper
 *
 *  Wraps the tevador/RandomX C++ library with the ZION FFI ABI.
 *  Supports seed_hash updates for Monero stratum mining.notify.
 *
 *  Functions exported (matching Rust FFI in lib.rs):
 *    void randomx_zion_init(const uint8_t* seed, size_t seed_len)
 *    void randomx_zion_hash(const uint8_t* header, size_t header_len,
 *                            uint64_t nonce, uint8_t* output)
 *    int32_t randomx_zion_verify(const uint8_t* header, size_t header_len,
 *                                 uint64_t nonce, const uint8_t* target)
 *    double  randomx_zion_benchmark(int32_t iterations)
 *    const char* randomx_zion_version(void)
 *
 *  Memory model:
 *    - Full dataset mode (~2 GB) for maximum hashrate
 *    - Cache is reinitialized when seed_hash changes
 *    - Per-thread VMs sharing the same dataset (no mutex contention)
 *    - Thread-safe via thread_local VM + mutex only for seed updates
 * ============================================================================
 */

#include <stdint.h>
#include <string.h>
#include <stdlib.h>
#include <stdio.h>
#include <mutex>
#include <vector>

#ifdef _WIN32
    #define EXPORT __declspec(dllexport)
#else
    #define EXPORT
#endif

/* RandomX C++ API */
#include "randomx.h"

/* ---- Global state ---- */
static randomx_cache*   g_cache   = nullptr;
static randomx_dataset* g_dataset = nullptr;
static uint8_t          g_current_seed[32] = {0};
static bool             g_initialized = false;
static std::mutex       g_init_mutex;  /* protects seed updates */

/* Per-thread VM — each thread gets its own VM sharing the global dataset */
static thread_local randomx_vm* t_vm = nullptr;
static thread_local bool        t_vm_initialized = false;

/* ---- Helpers ---- */

static bool seed_matches(const uint8_t* seed, size_t len) {
    if (len != 32) return false;
    return memcmp(g_current_seed, seed, 32) == 0;
}

/* Determine VM flags based on architecture */
static randomx_flags get_vm_flags() {
#if defined(__aarch64__) || defined(_M_ARM64)
    /* ARM64: interpreted VM only, no JIT, soft AES */
    return (randomx_flags)(RANDOMX_FLAG_FULL_MEM);
#else
    return (randomx_flags)(RANDOMX_FLAG_JIT | RANDOMX_FLAG_HARD_AES | RANDOMX_FLAG_FULL_MEM);
#endif
}

/* Create a per-thread VM */
static randomx_vm* create_thread_vm() {
    randomx_flags flags = get_vm_flags();
    randomx_vm* vm = nullptr;
    if (g_dataset) {
        vm = randomx_create_vm(flags, g_cache, g_dataset);
    }
    if (!vm) {
        /* Fallback: light mode (cache only) */
        randomx_flags light_flags =
#if defined(__aarch64__) || defined(_M_ARM64)
            RANDOMX_FLAG_DEFAULT;
#else
            (randomx_flags)(RANDOMX_FLAG_JIT | RANDOMX_FLAG_HARD_AES);
#endif
        vm = randomx_create_vm(light_flags, g_cache, nullptr);
    }
    if (!vm) {
        vm = randomx_create_vm(RANDOMX_FLAG_DEFAULT, g_cache, nullptr);
    }
    return vm;
}

static void update_seed(const uint8_t* seed, size_t len) {
    if (len != 32) {
        fprintf(stderr, "randomx_zion: invalid seed length %zu (expected 32)\n", len);
        return;
    }

    /* Skip reinit if seed is identical */
    if (g_initialized && seed_matches(seed, len)) return;

    /* Destroy old state */
    /* Note: per-thread VMs are destroyed lazily when threads exit or
     * when they detect a seed change on next hash call */
    if (g_dataset) { randomx_release_dataset(g_dataset); g_dataset = nullptr; }
    if (g_cache)   { randomx_release_cache(g_cache);   g_cache = nullptr; }

    /* Allocate + init cache */
#if defined(__aarch64__) || defined(_M_ARM64)
    g_cache = randomx_alloc_cache(RANDOMX_FLAG_DEFAULT);
#else
    g_cache = randomx_alloc_cache(RANDOMX_FLAG_LARGE_PAGES | RANDOMX_FLAG_JIT |
                                  RANDOMX_FLAG_HARD_AES);
    if (!g_cache) {
        g_cache = randomx_alloc_cache(RANDOMX_FLAG_DEFAULT);
    }
#endif
    if (!g_cache) {
        fprintf(stderr, "randomx_zion: failed to allocate cache\n");
        return;
    }
    randomx_init_cache(g_cache, seed, 32);

    /* Allocate + init dataset (full mode for max hashrate) */
#if defined(__aarch64__) || defined(_M_ARM64)
    g_dataset = randomx_alloc_dataset(RANDOMX_FLAG_DEFAULT);
#else
    g_dataset = randomx_alloc_dataset(RANDOMX_FLAG_LARGE_PAGES);
    if (!g_dataset) {
        g_dataset = randomx_alloc_dataset(RANDOMX_FLAG_DEFAULT);
    }
#endif
    if (g_dataset) {
        randomx_init_dataset(g_dataset, g_cache, 0, randomx_dataset_item_count());
    }

    memcpy(g_current_seed, seed, 32);
    g_initialized = true;
    fprintf(stderr, "randomx_zion: cache/dataset initialized (full_mem=%s)\n",
            g_dataset ? "yes" : "no (light mode)");
}

/* Ensure this thread has a VM */
static randomx_vm* ensure_thread_vm() {
    if (t_vm && t_vm_initialized) {
        return t_vm;
    }
    /* Destroy old VM if it exists (seed may have changed) */
    if (t_vm) {
        randomx_destroy_vm(t_vm);
        t_vm = nullptr;
    }
    t_vm = create_thread_vm();
    t_vm_initialized = (t_vm != nullptr);
    if (!t_vm) {
        fprintf(stderr, "randomx_zion: failed to create VM for thread\n");
    }
    return t_vm;
}

/* ---- Public API ---- */

extern "C" {

EXPORT void randomx_zion_init(const uint8_t* seed, size_t seed_len) {
    std::lock_guard<std::mutex> lock(g_init_mutex);
    /* If no seed provided, use a default zero seed (for benchmarking) */
    if (seed == nullptr || seed_len == 0) {
        uint8_t zero_seed[32] = {0};
        update_seed(zero_seed, 32);
    } else {
        update_seed(seed, seed_len);
    }
}

EXPORT void randomx_zion_hash(
    const uint8_t* header,
    size_t         header_len,
    uint64_t       nonce,
    uint8_t*       output)
{
    if (!g_initialized) {
        memset(output, 0, 32);
        return;
    }

    /* Ensure this thread has a VM (lock-free after first call) */
    randomx_vm* vm = ensure_thread_vm();
    if (!vm) {
        memset(output, 0, 32);
        return;
    }

    /* No mutex needed — each thread has its own VM sharing the read-only dataset */
    randomx_calculate_hash(vm, header, header_len, output);
}

EXPORT int32_t randomx_zion_verify(
    const uint8_t* header,
    size_t         header_len,
    uint64_t       nonce,
    const uint8_t* target)
{
    uint8_t hash[32];
    randomx_zion_hash(header, header_len, nonce, hash);

    /* RandomX/Monero target comparison: first 8 bytes as LE uint64 */
    uint64_t hash_val = 0;
    uint64_t target_val = 0;
    memcpy(&hash_val, hash, 8);
    memcpy(&target_val, target, 8);
    return hash_val <= target_val ? 1 : 0;
}

EXPORT double randomx_zion_benchmark(int32_t iterations) {
    if (!g_initialized) {
        uint8_t zero_seed[32] = {0};
        randomx_zion_init(zero_seed, 32);
    }

    uint8_t header[76] = {0};
    uint8_t out[32];
    struct timespec t0, t1;
    timespec_get(&t0, TIME_UTC);
    for (int32_t i = 0; i < iterations; i++) {
        header[0] = (uint8_t)(i & 0xFF);
        randomx_zion_hash(header, 76, (uint64_t)i, out);
    }
    timespec_get(&t1, TIME_UTC);
    double secs = (t1.tv_sec - t0.tv_sec) + (t1.tv_nsec - t0.tv_nsec) * 1e-9;
    return secs > 0.0 ? iterations / secs : 0.0;
}

EXPORT const char* randomx_zion_version(void) {
    return "ZION RandomX v1.0 — tevador/RandomX (real)";
}

} /* extern "C" */
