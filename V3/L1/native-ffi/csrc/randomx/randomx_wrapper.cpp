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
#include <thread>

/* macOS: thread QoS for performance cores + mlockall */
#if defined(__APPLE__)
#include <pthread.h>
#include <sys/qos.h>
#include <sys/mman.h>
#endif

#ifdef _WIN32
    #define EXPORT __declspec(dllexport)
#else
    #define EXPORT
#endif

/* RandomX C++ API */
#if defined(_WIN32)
#include <windows.h>
#endif
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

/* Determine VM flags based on auto-detection + architecture */
static randomx_flags get_vm_flags() {
    /* Use randomx_get_flags() for auto-detection of JIT + HARD_AES */
    randomx_flags flags = randomx_get_flags();
    /* FULL_MEM: dataset mode (~2 GB) for maximum hashrate.
     * On macOS with 8 GB RAM under memory pressure, the 2 GB dataset may
     * get swapped out, making hashing 100x slower. Allow light mode override
     * via ZION_RANDOMX_LIGHT_MODE=1 env var (uses ~256 MB cache only). */
    static int light_mode = -1;
    if (light_mode == -1) {
        const char* env = getenv("ZION_RANDOMX_LIGHT_MODE");
        light_mode = (env && (env[0] == '1' || env[0] == 't' || env[0] == 'T')) ? 1 : 0;
    }
    if (!light_mode) {
        flags |= RANDOMX_FLAG_FULL_MEM;
    }
    /* LARGE_PAGES: 2MB huge pages on Linux (requires vm.nr_hugepages).
     * On macOS Apple Silicon, superpages are NOT available — mach_vm_allocate
     * with VM_FLAGS_SUPERPAGE_SIZE_2MB returns KERN_INVALID_ARGUMENT.
     * M1 already uses 16KB native pages (4x larger than x86's 4KB), providing
     * some TLB benefit. Skip LARGE_PAGES on macOS to avoid failed allocations. */
#if !defined(__APPLE__)
    flags |= RANDOMX_FLAG_LARGE_PAGES;
#endif
    /* On macOS, use SECURE mode (W^X) for JIT — required by hardened runtime */
#if defined(__APPLE__) && defined(__aarch64__)
    flags |= RANDOMX_FLAG_SECURE;
#endif
    return flags;
}

/* Create a per-thread VM */
static randomx_vm* create_thread_vm() {
    randomx_flags flags = get_vm_flags();
    randomx_vm* vm = nullptr;

    /* On macOS, boost thread QoS to user-interactive for max performance. */
#if defined(__APPLE__)
    pthread_set_qos_class_self_np(QOS_CLASS_USER_INTERACTIVE, 0);
#endif

    if (g_dataset) {
        vm = randomx_create_vm(flags, g_cache, g_dataset);
        if (vm) {
            fprintf(stderr, "randomx_zion: VM created (FULL_MEM mode, thread=%zu)\n",
                    (size_t)std::hash<std::thread::id>{}(std::this_thread::get_id()));
        }
    }
    if (!vm) {
        /* Fallback: light mode (cache only, ~10x slower) */
        randomx_flags light_flags = randomx_get_flags();
#if defined(__APPLE__) && defined(__aarch64__)
        light_flags |= RANDOMX_FLAG_SECURE;
#endif
        vm = randomx_create_vm(light_flags, g_cache, nullptr);
        if (vm) {
            fprintf(stderr, "randomx_zion: WARNING VM created in LIGHT mode (no dataset) — hashrate will be ~10x lower!\n");
        }
    }
    if (!vm) {
        /* Last resort: default flags (interpreted, soft AES) */
        vm = randomx_create_vm(RANDOMX_FLAG_DEFAULT, g_cache, nullptr);
        if (vm) {
            fprintf(stderr, "randomx_zion: WARNING VM created with DEFAULT flags (soft AES, no JIT) — very slow!\n");
        }
    }
    return vm;
}

/* ---- Windows large pages privilege ---- */
#if defined(_WIN32)
static bool enable_large_pages_privilege() {
    HANDLE hToken;
    TOKEN_PRIVILEGES tp;
    if (!OpenProcessToken(GetCurrentProcess(), TOKEN_ADJUST_PRIVILEGES | TOKEN_QUERY, &hToken))
        return false;
    if (!LookupPrivilegeValueA(NULL, "SeLockMemoryPrivilege", &tp.Privileges[0].Luid)) {
        CloseHandle(hToken);
        return false;
    }
    tp.PrivilegeCount = 1;
    tp.Privileges[0].Attributes = SE_PRIVILEGE_ENABLED;
    bool ok = AdjustTokenPrivileges(hToken, FALSE, &tp, 0, NULL, NULL) != 0;
    DWORD err = GetLastError();
    CloseHandle(hToken);
    /* AdjustTokenPrivileges returns TRUE even if not all privileges were assigned */
    return ok && err == ERROR_SUCCESS;
}
#endif

/* ---- Parallel dataset initialization (xmrig-style) ---- */
static void init_dataset_parallel(randomx_dataset* dataset, randomx_cache* cache) {
    unsigned long count = randomx_dataset_item_count();
    unsigned n_threads = std::thread::hardware_concurrency();
    if (n_threads == 0) n_threads = 4;
    if (n_threads > count) n_threads = (unsigned)count;

    fprintf(stderr, "randomx_zion: initializing dataset (%lu items, %u threads)...\n",
            count, n_threads);

    if (n_threads <= 1) {
        randomx_init_dataset(dataset, cache, 0, count);
        return;
    }

    std::vector<std::thread> threads;
    unsigned long items_per_thread = count / n_threads;
    unsigned long remainder = count % n_threads;
    unsigned long start = 0;

    for (unsigned i = 0; i < n_threads; i++) {
        unsigned long chunk = items_per_thread + (i < remainder ? 1 : 0);
        threads.emplace_back([dataset, cache, start, chunk]() {
            randomx_init_dataset(dataset, cache, start, chunk);
        });
        start += chunk;
    }
    for (auto& t : threads) t.join();
}

static void update_seed(const uint8_t* seed, size_t len) {
    if (len != 32) {
        fprintf(stderr, "randomx_zion: invalid seed length %zu (expected 32)\n", len);
        return;
    }

    /* Skip reinit if seed is identical */
    if (g_initialized && seed_matches(seed, len)) return;

    /* Destroy old state */
    if (g_dataset) { randomx_release_dataset(g_dataset); g_dataset = nullptr; }
    if (g_cache)   { randomx_release_cache(g_cache);   g_cache = nullptr; }

    /* On Windows, try to enable SeLockMemoryPrivilege for large pages */
#if defined(_WIN32)
    bool lp_priv = enable_large_pages_privilege();
    fprintf(stderr, "randomx_zion: SeLockMemoryPrivilege=%s\n", lp_priv ? "enabled" : "not available");
#endif

    /* Allocate + init cache */
    randomx_flags alloc_flags = get_vm_flags();
    bool large_pages_requested = (alloc_flags & RANDOMX_FLAG_LARGE_PAGES) != 0;
    g_cache = randomx_alloc_cache(alloc_flags);
    bool cache_large_pages = (g_cache != nullptr) && large_pages_requested;
    if (!g_cache) {
        /* LARGE_PAGES failed — retry without it */
        randomx_flags fallback_flags = (randomx_flags)(alloc_flags & ~RANDOMX_FLAG_LARGE_PAGES);
        g_cache = randomx_alloc_cache(fallback_flags);
    }
    if (!g_cache) {
        g_cache = randomx_alloc_cache(RANDOMX_FLAG_DEFAULT);
    }
    if (!g_cache) {
        fprintf(stderr, "randomx_zion: failed to allocate cache\n");
        return;
    }
    randomx_init_cache(g_cache, seed, 32);

    /* Allocate + init dataset (full mode for max hashrate) */
    bool dataset_large_pages = false;
    if (alloc_flags & RANDOMX_FLAG_FULL_MEM) {
        g_dataset = randomx_alloc_dataset(alloc_flags);
        dataset_large_pages = (g_dataset != nullptr) && large_pages_requested;
        if (!g_dataset) {
            /* Retry without LARGE_PAGES */
            randomx_flags fallback_flags = (randomx_flags)(alloc_flags & ~RANDOMX_FLAG_LARGE_PAGES);
            g_dataset = randomx_alloc_dataset(fallback_flags);
        }
        if (!g_dataset) {
            g_dataset = randomx_alloc_dataset(RANDOMX_FLAG_DEFAULT);
        }
        if (g_dataset) {
            /* Parallel dataset init (xmrig-style) — ~10x faster than single-threaded */
            init_dataset_parallel(g_dataset, g_cache);
        }
    } else {
        g_dataset = nullptr; /* light mode — cache only */
    }

    memcpy(g_current_seed, seed, 32);
    g_initialized = true;

#if defined(__APPLE__)
    (void)mlockall(MCL_CURRENT | MCL_FUTURE);
#endif

    /* Log active flags */
    randomx_flags vm_flags = get_vm_flags();
    fprintf(stderr, "randomx_zion: initialized (full_mem=%s, jit=%s, hard_aes=%s, large_pages_cache=%s, large_pages_dataset=%s, secure=%s)\n",
            g_dataset ? "yes" : "no (light mode)",
            (vm_flags & RANDOMX_FLAG_JIT) ? "yes" : "no",
            (vm_flags & RANDOMX_FLAG_HARD_AES) ? "yes" : "no",
            cache_large_pages ? "yes" : "no",
            dataset_large_pages ? "yes" : "no",
            (vm_flags & RANDOMX_FLAG_SECURE) ? "yes" : "no");
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
    /* If no seed provided, use a default zero seed (for benchmarking) */
    if (seed == nullptr || seed_len == 0) {
        if (!g_initialized) {
            std::lock_guard<std::mutex> lock(g_init_mutex);
            uint8_t zero_seed[32] = {0};
            update_seed(zero_seed, 32);
        }
        /* If already initialized, keep current dataset (no reinit) */
        return;
    }
    /* Fast path: if seed hasn't changed, skip entirely (lock-free).
     * This avoids mutex contention when 6+ threads call init_with_seed
     * every batch — the seed only changes every ~2h on Monero. */
    if (g_initialized && seed_matches(seed, seed_len)) {
        return;
    }
    /* Slow path: seed changed, acquire lock and reinit */
    std::lock_guard<std::mutex> lock(g_init_mutex);
    update_seed(seed, seed_len);
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
#if defined(_WIN32)
    LARGE_INTEGER _perf0, _perf1; QueryPerformanceCounter(&_perf0);
#else
    timespec_get(&t0, TIME_UTC);
#endif
    for (int32_t i = 0; i < iterations; i++) {
        header[0] = (uint8_t)(i & 0xFF);
        randomx_zion_hash(header, 76, (uint64_t)i, out);
    }
#if defined(_WIN32)
    QueryPerformanceCounter(&_perf1); double _elapsed = (double)(_perf1.QuadPart - _perf0.QuadPart);
#else
    timespec_get(&t1, TIME_UTC); double _elapsed = (t1.tv_sec - t0.tv_sec) + (t1.tv_nsec - t0.tv_nsec) / 1e9;
#endif
    double secs = (t1.tv_sec - t0.tv_sec) + (t1.tv_nsec - t0.tv_nsec) * 1e-9;
    return secs > 0.0 ? iterations / secs : 0.0;
}

EXPORT const char* randomx_zion_version(void) {
    return "ZION RandomX v1.0 — tevador/RandomX (real)";
}

} /* extern "C" */
