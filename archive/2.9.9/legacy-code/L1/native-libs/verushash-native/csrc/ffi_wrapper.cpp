/*
 * ffi_wrapper.cpp — extern "C" entry points for the Rust FFI layer.
 *
 * This file bridges the C++ VerusHash API to plain C function pointers
 * that Rust can call via FFI.
 *
 * Copyright (c) 2024-2026 Zion Project — MIT License
 */

#include "compat.h"
#include "verus_hash.h"

#include <cstring>
#include <cstdint>
#include <cstdio>

/* ---------------------------------------------------------------
 * Thread-local scratch-pad for CVerusHashV2
 *
 * CVerusHashV2 internally uses a large scratchpad.
 * The static Hash() function handles this internally.
 * --------------------------------------------------------------- */

/* ---------------------------------------------------------------
 * Exported C functions
 * --------------------------------------------------------------- */
extern "C" {

/**
 * One-time global initialization.
 * Must be called before any hashing (Rust side uses std::sync::Once).
 */
void verushash_init() {
    /* Initialize Haraka round-constants and VerusHash lookup tables */
    CVerusHash::init();
    CVerusHashV2::init();
}

/**
 * Compute VerusHash v2.2 of `data[0..len]`.
 * Writes exactly 32 bytes to `out`.
 *
 * IMPORTANT: This uses CVerusHashV2bWriter semantics (Write + Finalize2b),
 * which includes verusclhash + keyed Haraka-512 finalization.
 * This matches hash2b2() in node-verushash (the PoW hash for verification).
 *
 * Previously this called verus_hash_v2() which only does chain Haraka-512
 * without the critical Finalize2b step — producing wrong hashes.
 */
void verus_hash_v2_2_ffi(const unsigned char *data, unsigned int len, unsigned char *out) {
    /* CVerusHashV2 with solutionVersion = SOLUTION_VERUSHHASH_V2_2 (=4)
     * gives us the correct verusclhash_sv2_2 variant in Finalize2b. */
    CVerusHashV2 hasher(SOLUTION_VERUSHHASH_V2_2);
    hasher.Reset();
    hasher.Write(data, (size_t)len);
    hasher.Finalize2b(out);
}

/**
 * Return 1 if the CPU supports the optimized code path
 * (AES-NI on x86_64 / crypto extensions on aarch64), 0 otherwise.
 */
int verushash_cpu_optimized() {
#if defined(VERUSHASH_ARM)
    /* On ARM we check at runtime via getauxval or assume the compiler
     * flags guarantee crypto support (which our build.rs ensures). */
    #if defined(__aarch64__)
        /* If we compiled with -march=armv8-a+crypto, the instructions
         * are available; runtime check via HWCAP is a bonus. */
        #if defined(__linux__)
            #include <sys/auxv.h>
            unsigned long hwcaps = getauxval(AT_HWCAP);
            return (hwcaps & (1 << 3) /* HWCAP_AES */) ? 1 : 0;
        #else
            /* macOS Apple Silicon always has crypto extensions */
            return 1;
        #endif
    #else
        return 0;
    #endif
#elif defined(VERUSHASH_X86)
    /* Check for AES-NI + SSE4.1 + PCLMUL via CPUID */
    unsigned int eax, ebx, ecx, edx;
    if (__get_cpuid(1, &eax, &ebx, &ecx, &edx)) {
        int has_aes   = (ecx >> 25) & 1;  /* bit 25 = AES-NI */
        int has_sse41 = (ecx >> 19) & 1;  /* bit 19 = SSE4.1 */
        int has_pclmul= (ecx >>  1) & 1;  /* bit  1 = PCLMULQDQ */
        return (has_aes && has_sse41 && has_pclmul) ? 1 : 0;
    }
    return 0;
#else
    return 0;
#endif
}

} /* extern "C" */
