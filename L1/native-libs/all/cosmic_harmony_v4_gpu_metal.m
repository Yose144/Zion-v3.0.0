/*
 * ZION Cosmic Harmony v4 — Native Metal GPU Backend
 *
 * Objective-C implementation of the gpu_count / gpu_init / gpu_mine /
 * gpu_cleanup API for libcosmic_harmony_v4.dylib on Apple Silicon.
 *
 * Uses the precompiled cosmic_harmony_v4.metallib (produced by build_macos.sh)
 * that sits in the same directory as the dylib.
 *
 * Algorithm: Full CHv4 pipeline executed on GPU via MTLComputeCommandEncoder.
 *   Each Metal thread computes one nonce:
 *     Keccak-256 → SHA3-512 → Golden Matrix
 *     → Memory-Hard Scratchpad (512 KiB/thread)
 *     → NPU Mixing (INT8 MLP 64→128→64 + residual)
 *     → Cosmic Fusion
 *
 * Build (via build_macos.sh):
 *   xcrun metal -c cosmic_harmony_v4_metal.metal -o cosmic_harmony_v4_metal.air
 *   xcrun metallib cosmic_harmony_v4_metal.air -o cosmic_harmony_v4.metallib
 *   clang -O2 -shared -fPIC -lm -framework Metal -framework Foundation \
 *         -DHAVE_METAL_GPU_RUNTIME \
 *         cosmic_harmony_v4_native.c cosmic_harmony_v4_gpu_metal.m \
 *         -o libcosmic_harmony_v4.dylib
 *
 * Author: ZION AI Native Team
 * Version: 2.9.7
 * Date: June 2026
 */

#import <Foundation/Foundation.h>
#import <Metal/Metal.h>
#include <dlfcn.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

/* ============================================================================
 * C function declared in cosmic_harmony_v4_native.c (p2 section)
 * Returns pointer to the 16960-byte static NPU weight array.
 * ============================================================================ */
extern const uint8_t* cosmic_harmony_v4_get_weights(size_t *out_len);

/* Forward declarations for internal helpers */
static id<MTLLibrary> load_or_compile_metallib(id<MTLDevice> device);

/* ============================================================================
 * Mining params / result structures (must match metal_shader.metal exactly)
 * ============================================================================ */

typedef struct __attribute__((packed)) {
    uint64_t start_nonce;   /* offset  0 */
    uint32_t header_len;    /* offset  8 */
    uint8_t  header[80];    /* offset 12 */
    uint8_t  target[32];    /* offset 92 */
    uint32_t block_height;  /* offset 124 */
    /* 128 bytes total */
} CHv4MetalParams;

typedef struct {
    uint64_t found_nonce;
    uint8_t  found_hash[32];
    uint32_t found;         /* 0 = nothing found, 1 = solution */
} CHv4MetalResult;

#define CHV4_SCRATCHPAD_BYTES 524288u   /* 512 KiB per thread */

/* ============================================================================
 * Metal GPU state (single global — one GPU device)
 * ============================================================================ */

static id<MTLDevice>               g_device        = nil;
static id<MTLCommandQueue>         g_queue         = nil;
static id<MTLComputePipelineState> g_pipeline_mine = nil;
static id<MTLBuffer>               g_w1_buf        = nil;   /* int8[8192]  */
static id<MTLBuffer>               g_b1_buf        = nil;   /* int8[128]   */
static id<MTLBuffer>               g_w2_buf        = nil;   /* int8[8192]  */
static id<MTLBuffer>               g_b2_buf        = nil;   /* int8[64]    */
static id<MTLBuffer>               g_scale1_buf    = nil;   /* int16[128]  */
static id<MTLBuffer>               g_scale2_buf    = nil;   /* int16[64]   */
static id<MTLBuffer>               g_scratch_buf   = nil;   /* batch * 512 KiB */
static uint32_t                    g_batch_size    = 0;
static int                         g_initialized   = 0;

/* ============================================================================
 * Helper: find own dylib directory via dladdr using a static sentinel symbol
 * ============================================================================ */
static const int g_self_sentinel = 0;  /* used only as a stable address */

static NSString *get_dylib_dir(void) {
    Dl_info info;
    if (dladdr((const void *)&g_self_sentinel, &info) && info.dli_fname) {
        NSString *path = [NSString stringWithUTF8String:info.dli_fname];
        return [path stringByDeletingLastPathComponent];
    }
    return [[NSFileManager defaultManager] currentDirectoryPath];
}

/* ============================================================================
 * Helper: load precompiled metallib, or compile from source at runtime
 * ============================================================================ */
static id<MTLLibrary> load_or_compile_metallib(id<MTLDevice> device) {
    NSError *err = nil;
    NSString *dir = get_dylib_dir();

    /* 1. Try precompiled .metallib next to dylib */
    NSString *ml_path = [dir stringByAppendingPathComponent:@"cosmic_harmony_v4.metallib"];
    if ([[NSFileManager defaultManager] fileExistsAtPath:ml_path]) {
        printf("[CHv4 Metal] Loading precompiled metallib: %s\n", [ml_path UTF8String]);
        id<MTLLibrary> lib = [device newLibraryWithURL:[NSURL fileURLWithPath:ml_path]
                                                 error:&err];
        if (lib) return lib;
        fprintf(stderr, "[CHv4 Metal] metallib load failed: %s\n",
                [[err localizedDescription] UTF8String]);
    }

    /* 2. Try NSBundle (app bundle resources) */
    NSURL *bundle_url = [[NSBundle mainBundle] URLForResource:@"cosmic_harmony_v4"
                                               withExtension:@"metallib"];
    if (bundle_url) {
        id<MTLLibrary> lib = [device newLibraryWithURL:bundle_url error:&err];
        if (lib) return lib;
    }

    /* 3. Runtime compile from .metal source file */
    NSString *metal_src_path = [dir stringByAppendingPathComponent:
                                @"cosmic_harmony_v4_metal.metal"];
    if (![[NSFileManager defaultManager] fileExistsAtPath:metal_src_path]) {
        /* Try CWD */
        metal_src_path = @"./cosmic_harmony_v4_metal.metal";
    }
    if ([[NSFileManager defaultManager] fileExistsAtPath:metal_src_path]) {
        printf("[CHv4 Metal] Runtime-compiling shader from: %s\n",
               [metal_src_path UTF8String]);
        printf("[CHv4 Metal] (first call may take 10-60 s)\n");
        NSString *src = [NSString stringWithContentsOfFile:metal_src_path
                                                 encoding:NSUTF8StringEncoding
                                                    error:&err];
        if (src) {
            MTLCompileOptions *opts = [MTLCompileOptions new];
            id<MTLLibrary> lib = [device newLibraryWithSource:src options:opts error:&err];
            if (lib) {
                printf("[CHv4 Metal] Runtime compilation successful.\n");
                return lib;
            }
            fprintf(stderr, "[CHv4 Metal] Compile error: %s\n",
                    [[err localizedDescription] UTF8String]);
        }
    }

    fprintf(stderr, "[CHv4 Metal] ERROR: could not load cosmic_harmony_v4.metallib\n"
                    "  Place it next to the dylib, or keep cosmic_harmony_v4_metal.metal\n"
                    "  alongside the dylib for runtime compilation.\n");
    return nil;
}

/* ============================================================================
 * Helper: build weight buffers from the embedded 16960-byte weight array
 * Layout (from cosmic_harmony_v4_native.c):
 *   [0     ..  8191] w1[128][64]   int8
 *   [8192  ..  8319] b1[128]       int8
 *   [8320  .. 16511] w2[64][128]   int8
 *   [16512 .. 16575] b2[64]        int8
 *   [16576 .. 16703] scale1_src[128] → int16: 224 + (byte & 0x3F)
 *   [16704 .. 16767] scale2_src[64]  → int16: 224 + (byte & 0x3F)
 * ============================================================================ */
static int build_weight_buffers(void) {
    size_t wlen = 0;
    const uint8_t *w = cosmic_harmony_v4_get_weights(&wlen);
    if (!w || wlen < 16960) {
        fprintf(stderr, "[CHv4 Metal] ERROR: weight array too small (%zu)\n", wlen);
        return -1;
    }

    /* w1: int8[128*64 = 8192] at offset 0 */
    g_w1_buf = [g_device newBufferWithBytes:w
                                     length:8192
                                    options:MTLResourceStorageModeShared];
    /* b1: int8[128] at offset 8192 */
    g_b1_buf = [g_device newBufferWithBytes:w + 8192
                                     length:128
                                    options:MTLResourceStorageModeShared];
    /* w2: int8[64*128 = 8192] at offset 8320 */
    g_w2_buf = [g_device newBufferWithBytes:w + 8320
                                     length:8192
                                    options:MTLResourceStorageModeShared];
    /* b2: int8[64] at offset 16512 */
    g_b2_buf = [g_device newBufferWithBytes:w + 16512
                                     length:64
                                    options:MTLResourceStorageModeShared];

    /* scale1: int16[128] — computed from source bytes at offset 16576 */
    int16_t scale1[128];
    for (int i = 0; i < 128; i++) {
        scale1[i] = (int16_t)(224 + (w[16576 + i] & 0x3Fu));
    }
    g_scale1_buf = [g_device newBufferWithBytes:scale1
                                          length:128 * sizeof(int16_t)
                                         options:MTLResourceStorageModeShared];

    /* scale2: int16[64] — computed from source bytes at offset 16704 */
    int16_t scale2[64];
    for (int i = 0; i < 64; i++) {
        scale2[i] = (int16_t)(224 + (w[16704 + i] & 0x3Fu));
    }
    g_scale2_buf = [g_device newBufferWithBytes:scale2
                                          length:64 * sizeof(int16_t)
                                         options:MTLResourceStorageModeShared];

    if (!g_w1_buf || !g_b1_buf || !g_w2_buf || !g_b2_buf || !g_scale1_buf || !g_scale2_buf) {
        fprintf(stderr, "[CHv4 Metal] ERROR: failed to allocate weight buffers\n");
        return -1;
    }
    return 0;
}

/* ============================================================================
 * Exported GPU API
 * ============================================================================ */

/* Forward-declare cleanup so gpu_init can call it */
void cosmic_harmony_v4_gpu_cleanup(void);

uint32_t cosmic_harmony_v4_gpu_count(void) {
    @autoreleasepool {
#if TARGET_OS_OSX
        NSArray<id<MTLDevice>> *devices = MTLCopyAllDevices();
        uint32_t n = (uint32_t)devices.count;
        return n > 0 ? 1 : 0;  /* expose as 1 logical GPU */
#else
        id<MTLDevice> dev = MTLCreateSystemDefaultDevice();
        return (dev != nil) ? 1 : 0;
#endif
    }
}

int32_t cosmic_harmony_v4_gpu_init(uint32_t device_id, uint32_t batch_size) {
    @autoreleasepool {
        (void)device_id;

        /* Clamp batch_size: 1..2048 (scratchpad: up to 1 GiB for b=2048) */
        if (batch_size == 0) batch_size = 256;
        if (batch_size > 2048) batch_size = 2048;

        /* Cleanup any previous state */
        cosmic_harmony_v4_gpu_cleanup();

        printf("[CHv4 Metal] Initializing GPU: batch_size=%u\n", batch_size);

        /* 1. Get Metal device */
        g_device = MTLCreateSystemDefaultDevice();
        if (!g_device) {
            fprintf(stderr, "[CHv4 Metal] ERROR: no Metal device available\n");
            return -1;
        }
        printf("[CHv4 Metal] Device: %s\n", [[g_device name] UTF8String]);

        /* 2. Command queue */
        g_queue = [g_device newCommandQueue];
        if (!g_queue) {
            fprintf(stderr, "[CHv4 Metal] ERROR: newCommandQueue failed\n");
            return -1;
        }

        /* 3. Load or compile metallib */
        NSError *err = nil;
        id<MTLLibrary> library = load_or_compile_metallib(g_device);
        if (!library) {
            g_device = nil;
            g_queue  = nil;
            return -2;
        }

        /* 4. Get mining kernel function */
        id<MTLFunction> fn = [library newFunctionWithName:@"cosmic_harmony_v3_mine"];
        if (!fn) {
            fprintf(stderr, "[CHv4 Metal] ERROR: kernel 'cosmic_harmony_v3_mine' not found\n");
            return -3;
        }

        /* 5. Create compute pipeline */
        g_pipeline_mine = [g_device newComputePipelineStateWithFunction:fn error:&err];
        if (!g_pipeline_mine) {
            fprintf(stderr, "[CHv4 Metal] ERROR: newComputePipelineState: %s\n",
                    [[err localizedDescription] UTF8String]);
            return -4;
        }

        /* 6. Build NPU weight buffers */
        if (build_weight_buffers() != 0) {
            return -5;
        }

        /* 7. Allocate per-thread scratchpad buffer (batch_size × 512 KiB) */
        size_t scratch_total = (size_t)batch_size * CHV4_SCRATCHPAD_BYTES;
        g_scratch_buf = [g_device newBufferWithLength:scratch_total
                                              options:MTLResourceStorageModePrivate];
        if (!g_scratch_buf) {
            fprintf(stderr, "[CHv4 Metal] ERROR: scratchpad alloc failed (%zu MiB)\n",
                    scratch_total / (1024 * 1024));
            return -6;
        }

        g_batch_size  = batch_size;
        g_initialized = 1;

        printf("[CHv4 Metal] GPU ready: %u threads × 512 KiB = %zu MiB scratchpad\n",
               batch_size, scratch_total / (1024 * 1024));
        return 0;
    }
}

int32_t cosmic_harmony_v4_gpu_mine(
    const uint8_t *header, size_t header_len,
    uint64_t nonce_start, const uint8_t *target,
    uint64_t *found_nonce, uint8_t *found_hash
) {
    if (!g_initialized || !header || !target || !found_nonce || !found_hash) {
        return -1;
    }

    @autoreleasepool {
        NSError *err = nil;

        /* --- Build params buffer --- */
        CHv4MetalParams params;
        memset(&params, 0, sizeof(params));
        params.start_nonce = nonce_start;
        params.header_len  = (uint32_t)header_len;
        if (header_len > 80) header_len = 80;
        memcpy(params.header, header, header_len);
        memcpy(params.target, target, 32);
        params.block_height = 0;  /* CHv4 active at all heights */

        id<MTLBuffer> params_buf = [g_device newBufferWithBytes:&params
                                                          length:sizeof(params)
                                                         options:MTLResourceStorageModeShared];

        /* --- Build result buffer (zeroed) --- */
        id<MTLBuffer> result_buf = [g_device newBufferWithLength:sizeof(CHv4MetalResult)
                                                         options:MTLResourceStorageModeShared];
        memset([result_buf contents], 0, sizeof(CHv4MetalResult));

        if (!params_buf || !result_buf) {
            fprintf(stderr, "[CHv4 Metal] ERROR: buffer alloc failed in gpu_mine\n");
            return -1;
        }

        /* --- Encode compute command --- */
        id<MTLCommandBuffer> cmd = [g_queue commandBuffer];
        id<MTLComputeCommandEncoder> enc = [cmd computeCommandEncoder];

        [enc setComputePipelineState:g_pipeline_mine];

        /* buffer(0): params  buffer(1): result  buffer(2): scratchpad
         * buffer(3): npu_w1  buffer(4): npu_b1  buffer(5): npu_w2
         * buffer(6): npu_b2  buffer(7): npu_scale1  buffer(8): npu_scale2 */
        [enc setBuffer:params_buf   offset:0 atIndex:0];
        [enc setBuffer:result_buf   offset:0 atIndex:1];
        [enc setBuffer:g_scratch_buf offset:0 atIndex:2];
        [enc setBuffer:g_w1_buf      offset:0 atIndex:3];
        [enc setBuffer:g_b1_buf      offset:0 atIndex:4];
        [enc setBuffer:g_w2_buf      offset:0 atIndex:5];
        [enc setBuffer:g_b2_buf      offset:0 atIndex:6];
        [enc setBuffer:g_scale1_buf  offset:0 atIndex:7];
        [enc setBuffer:g_scale2_buf  offset:0 atIndex:8];

        /* Dispatch grid */
        NSUInteger threads_per_tg = g_pipeline_mine.maxTotalThreadsPerThreadgroup;
        if (threads_per_tg > g_batch_size) threads_per_tg = g_batch_size;

        MTLSize grid     = MTLSizeMake(g_batch_size, 1, 1);
        MTLSize tg_size  = MTLSizeMake(threads_per_tg, 1, 1);
        [enc dispatchThreads:grid threadsPerThreadgroup:tg_size];
        [enc endEncoding];

        /* --- Submit and wait --- */
        [cmd commit];
        [cmd waitUntilCompleted];

        if (cmd.error) {
            fprintf(stderr, "[CHv4 Metal] ERROR in dispatch: %s\n",
                    [[cmd.error localizedDescription] UTF8String]);
            return -1;
        }

        /* --- Read result --- */
        CHv4MetalResult *res = (CHv4MetalResult *)[result_buf contents];
        if (res->found) {
            *found_nonce = res->found_nonce;
            memcpy(found_hash, res->found_hash, 32);
            return 1;  /* solution found */
        }
        return 0;  /* no solution in this batch */
    }
}

void cosmic_harmony_v4_gpu_cleanup(void) {
    @autoreleasepool {
        g_pipeline_mine = nil;
        g_scratch_buf   = nil;
        g_w1_buf        = nil;
        g_b1_buf        = nil;
        g_w2_buf        = nil;
        g_b2_buf        = nil;
        g_scale1_buf    = nil;
        g_scale2_buf    = nil;
        g_queue         = nil;
        g_device        = nil;
        g_batch_size    = 0;
        g_initialized   = 0;
        printf("[CHv4 Metal] GPU cleanup done\n");
    }
}
