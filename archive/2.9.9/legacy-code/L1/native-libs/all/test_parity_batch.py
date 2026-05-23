#!/usr/bin/env python3
"""Batch parity + performance test for libcosmic_harmony_v4_metal.dylib"""
import ctypes, time, random, os

os.chdir(os.path.dirname(os.path.abspath(__file__)))
lib = ctypes.CDLL('./libcosmic_harmony_v4_metal.dylib')

lib.cosmic_harmony_v4_gpu_init.restype  = ctypes.c_int32
lib.cosmic_harmony_v4_gpu_init.argtypes = [ctypes.c_uint32, ctypes.c_uint32]

lib.cosmic_harmony_v4_gpu_mine.restype  = ctypes.c_int32
lib.cosmic_harmony_v4_gpu_mine.argtypes = [
    ctypes.POINTER(ctypes.c_uint8), ctypes.c_size_t,
    ctypes.c_uint64, ctypes.POINTER(ctypes.c_uint8),
    ctypes.POINTER(ctypes.c_uint64), ctypes.POINTER(ctypes.c_uint8),
]

lib.cosmic_harmony_v4_hash.restype  = ctypes.c_int32
lib.cosmic_harmony_v4_hash.argtypes = [
    ctypes.POINTER(ctypes.c_uint8), ctypes.c_size_t,
    ctypes.c_uint64,
    ctypes.c_uint64,  # height
    ctypes.POINTER(ctypes.c_uint8),
]

BATCH_SIZE = 2184  # M1 chip batch (same as Rust miner)
r = lib.cosmic_harmony_v4_gpu_init(0, BATCH_SIZE)
print(f"gpu_init(0, {BATCH_SIZE}) = {r}")
assert r == 0, f"gpu_init failed with {r}"

header = (ctypes.c_uint8 * 80)(*[i % 256 for i in range(80)])
target  = (ctypes.c_uint8 * 32)(*([0xff] * 32))  # accept all hashes
fn = ctypes.c_uint64(0)
fh = (ctypes.c_uint8 * 32)()

print(f"\nRunning 5 batches × {BATCH_SIZE} nonces each (target=0xff×32, all should match):")

parity_fails = 0
for batch_i in range(5):
    nonce_start = batch_i * BATCH_SIZE
    t0 = time.time()
    ret = lib.cosmic_harmony_v4_gpu_mine(
        header, 80, nonce_start, target,
        ctypes.byref(fn),
        ctypes.cast(fh, ctypes.POINTER(ctypes.c_uint8))
    )
    elapsed = time.time() - t0
    hs = int(BATCH_SIZE / elapsed)

    # Verify found nonce via CPU
    if ret == 1:
        cpu_h = (ctypes.c_uint8 * 32)()
        lib.cosmic_harmony_v4_hash(header, 80, fn.value, 0,
            ctypes.cast(cpu_h, ctypes.POINTER(ctypes.c_uint8)))
        match = bytes(fh) == bytes(cpu_h)
        if not match:
            parity_fails += 1
        status = "parity ✅" if match else f"PARITY FAIL ❌ GPU={bytes(fh).hex()[:12]}… CPU={bytes(cpu_h).hex()[:12]}…"
        print(f"  batch {batch_i}: nonce_start={nonce_start}, found={fn.value}, {elapsed:.2f}s → {hs} H/s  {status}")
    else:
        print(f"  batch {batch_i}: nonce_start={nonce_start}, no find (ret={ret}), {elapsed:.2f}s → {hs} H/s")

print(f"\nParity failures: {parity_fails}/5")
print("PASS ✅" if parity_fails == 0 else "FAIL ❌")
