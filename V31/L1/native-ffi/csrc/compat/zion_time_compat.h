/*
 * zion_time_compat.h — minimal Windows shim for clock_gettime / CLOCK_MONOTONIC
 *
 * Include before any file that uses clock_gettime().
 * On non-Windows this header is a no-op.
 *
 * On Windows, struct timespec is provided by <time.h> in modern Windows SDKs
 * (10.0.26100+). We only provide CLOCK_MONOTONIC and a clock_gettime fallback
 * for SDKs/MSVC versions that lack them.
 */
#pragma once

#ifdef _WIN32
#  ifndef NOMINMAX
#    define NOMINMAX
#  endif
#  ifndef WIN32_LEAN_AND_MEAN
#    define WIN32_LEAN_AND_MEAN
#  endif
#  include <windows.h>
#  include <time.h>
#  include <intrin.h>  /* _byteswap_ulong, _byteswap_uint64, etc. */

#  ifndef CLOCK_MONOTONIC
#    define CLOCK_MONOTONIC 1
#  endif

#  ifndef CLOCK_REALTIME
#    define CLOCK_REALTIME 0
#  endif

/* clock_gettime is not available on older Windows SDKs/MSVC.
 * Provide a fallback using QueryPerformanceCounter.
 * struct timespec is assumed to be defined by <time.h> (modern SDK) or
 * by the including source file (older SDK). */
#  if !defined(_CLOCK_GETTIME_DEFINED)
static __inline int clock_gettime(int clk_id, struct timespec *ts) {
    (void)clk_id;
    LARGE_INTEGER freq, cnt;
    QueryPerformanceFrequency(&freq);
    QueryPerformanceCounter(&cnt);
    ts->tv_sec  = (time_t)(cnt.QuadPart / freq.QuadPart);
    ts->tv_nsec = (long)(((cnt.QuadPart % freq.QuadPart) * 1000000000LL) / freq.QuadPart);
    return 0;
}
#    define _CLOCK_GETTIME_DEFINED
#  endif
#endif /* _WIN32 */
