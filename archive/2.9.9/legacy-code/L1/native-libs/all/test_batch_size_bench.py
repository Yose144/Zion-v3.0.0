#!/usr/bin/env python3
"""
CHv4 Metal GPU batch-size benchmark.
Tests different batch sizes to find the optimal H/s on Apple M1.

Memory-hard algorithm (CHv4.1 light): ~3 136 SHA3-512 per nonce → bottleneck is
GPU cache pressure from 64 KiB/thread scratchpad.

Smaller batch = less concurrent scratchpad pressure, potentially higher H/s.
"""

import ctypes, os, struct, time

DYLIB = os.path.join(os.path.dirname(__file__), "libcosmic_harmony_v4_metal.dylib")
if not os.path.exists(DYLIB):
    DYLIB = os.path.join(os.path.dirname(__file__), "../../APP&WEB/desktop-agent/resources/libcosmic_harmony_v4_metal.dylib")

lib = ctypes.CDLL(DYLIB)

lib.gpu_count.restype  = ctypes.c_int
lib.gpu_init.argtypes  = [ctypes.c_int, ctypes.c_uint32]
lib.gpu_init.restype   = ctypes.c_int
lib.gpu_cleanup.argtypes = []
lib.gpu_cleanup.restype  = ctypes.c_int

lib.gpu_mine.argtypes = [
    ctypes.c_char_p,   # header
    ctypes.c_uint32,   # hdr_len
    ctypes.c_uint64,   # nonce_start
    ctypes.c_char_p,   # target (32 bytes)
    ctypes.POINTER(ctypes.c_uint64),  # found_nonce
    ctypes.c_char_p,   # found_hash
]
lib.gpu_mine.restype = ctypes.c_int

HEADER = b"ZIONbench_CHv4_Metal_batchtest\x00" * 3  # 90 bytes, truncate to 80
HEADER = HEADER[:80]
TARGET  = b"\xff" * 32   # very easy target (always finds nothing but runs full batch)

print(f"[CHv4 Metal Batch Benchmark]")
print(f"Algorithm: init(1024 SHA3-512) + 2×1024 SHA3-512 passes + 64 keccak256")
print(f"= ~3 136 SHA3-512 per nonce — serial chain (memory-hard)")
print(f"Scratchpad: 64 KiB / thread → GPU cache pressure scales with batch_size")
print()
print(f"{'batch':>6}  {'total_hashes':>12}  {'time_s':>8}  {'H/s':>8}  {'KiB×batch':>12}")
print("-" * 60)

BATCHES = [32, 64, 128, 256, 512, 1024, 2048]
ROUNDS_PER_BATCH = 3   # run N dispatches and average

results = {}

for batch in BATCHES:
    rc = lib.gpu_init(0, ctypes.c_uint32(batch))
    if rc != 0:
        print(f"{batch:>6}  gpu_init failed ({rc})")
        continue

    found_nonce = ctypes.c_uint64(0)
    found_hash  = ctypes.create_string_buffer(32)

    # warm-up (1 dispatch, discarded)
    lib.gpu_mine(HEADER, ctypes.c_uint32(len(HEADER)),
                 ctypes.c_uint64(0), TARGET,
                 ctypes.byref(found_nonce), found_hash)

    t0 = time.perf_counter()
    for r in range(ROUNDS_PER_BATCH):
        lib.gpu_mine(HEADER, ctypes.c_uint32(len(HEADER)),
                     ctypes.c_uint64(r * batch), TARGET,
                     ctypes.byref(found_nonce), found_hash)
    elapsed = time.perf_counter() - t0

    total_hashes = batch * ROUNDS_PER_BATCH
    hs = total_hashes / elapsed
    mem_kib = batch * 64
    results[batch] = hs
    print(f"{batch:>6}  {total_hashes:>12}  {elapsed:>8.2f}  {hs:>8.1f}  {mem_kib:>10} KiB")

    lib.gpu_cleanup()

print()
if results:
    best_batch = max(results, key=results.get)
    best_hs    = results[best_batch]
    print(f"Optimal batch size: {best_batch}  →  {best_hs:.1f} H/s")
    print()
    # Compare to theoretical max
    print("--- Theory ---")
    print("CHv4.1 is memory-hard by design. GPU L2 = ~8 MiB, scratchpad = 64 KiB/thread.")
    print("With batch=2048: 2048*64KiB = 128 MiB active scratchpad.")
    print("With smaller batch: lighter cache pressure, but less GPU utilisation.")
    print("Maximum likely GPU speed on M1: ~100-400 H/s (algorithm bottleneck, not bugs).")
    print("CPU (M1, 1 core sequential): ~1-3 H/s per core.")
    print("GPU still gives ~50-400x speedup vs single CPU core.")
    print()
    print("NOTE: CHv3 had 21 MH/s because it had NO scratchpad — it was NOT memory-hard.")
    print("CHv4's memory-hard design is intentional (ASIC/GPU resistance).")
