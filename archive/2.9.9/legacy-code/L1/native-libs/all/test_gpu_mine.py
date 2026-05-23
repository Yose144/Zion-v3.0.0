#!/usr/bin/env python3
"""Test GPU mine - ověří funkčnost Metal GPU backend"""
import ctypes, time, sys, os

os.chdir(os.path.dirname(os.path.abspath(__file__)))
lib = ctypes.CDLL('./libcosmic_harmony_v4_metal.dylib')

# gpu_init
lib.cosmic_harmony_v4_gpu_init.restype  = ctypes.c_int32
lib.cosmic_harmony_v4_gpu_init.argtypes = [ctypes.c_uint32, ctypes.c_uint32]
r = lib.cosmic_harmony_v4_gpu_init(0, 128)
print(f"gpu_init(0, 128) = {r}")
assert r == 0, f"gpu_init failed: {r}"

# gpu_mine argtypes
lib.cosmic_harmony_v4_gpu_mine.restype  = ctypes.c_int32
lib.cosmic_harmony_v4_gpu_mine.argtypes = [
    ctypes.POINTER(ctypes.c_uint8),  # header
    ctypes.c_size_t,                 # hdr_len
    ctypes.c_uint64,                 # nonce_start
    ctypes.POINTER(ctypes.c_uint8),  # target[32]
    ctypes.POINTER(ctypes.c_uint64), # out: found_nonce
    ctypes.POINTER(ctypes.c_uint8),  # out: found_hash[32]
]

# --- Test 1: easy target (all 0xff) - must find nonce=0 ---
print("\n=== Test 1: Easy target (all 0xff) ===")
header = (ctypes.c_uint8 * 80)(*[i % 256 for i in range(80)])
target = (ctypes.c_uint8 * 32)(*([0xff]*32))
found_nonce = ctypes.c_uint64(0)
found_hash  = (ctypes.c_uint8 * 32)()

t0 = time.time()
ret = lib.cosmic_harmony_v4_gpu_mine(
    header, 80, 0, target,
    ctypes.byref(found_nonce),
    ctypes.cast(found_hash, ctypes.POINTER(ctypes.c_uint8))
)
elapsed = time.time() - t0
print(f"gpu_mine ret={ret}, elapsed={elapsed:.3f}s")
if ret == 1:
    print(f"found_nonce={found_nonce.value}")
    print(f"found_hash ={bytes(found_hash).hex()}")
    print(f"Batch 128 hashes in {elapsed:.3f}s → ~{int(128/elapsed)} H/s")
elif ret == 0:
    print("No nonce found in this batch (unexpected for target 0xff...)")
else:
    print(f"Error: ret={ret}")

# --- Test 2: impossible target (all 0x00) - must return 0 ---
print("\n=== Test 2: Impossible target (all 0x00) ===")
target2 = (ctypes.c_uint8 * 32)(*([0x00]*32))
ret2 = lib.cosmic_harmony_v4_gpu_mine(
    header, 80, 0, target2,
    ctypes.byref(found_nonce),
    ctypes.cast(found_hash, ctypes.POINTER(ctypes.c_uint8))
)
print(f"gpu_mine ret={ret2}  (expected 0 = not found)")

# --- CPU crosscheck ---
print("\n=== CPU crosscheck ===")
# Correct signature: int cosmic_harmony_v4_hash(header, hdr_len, nonce, height, output)
lib.cosmic_harmony_v4_hash.restype  = ctypes.c_int32
lib.cosmic_harmony_v4_hash.argtypes = [
    ctypes.POINTER(ctypes.c_uint8), ctypes.c_size_t,
    ctypes.c_uint64,
    ctypes.c_uint64,                 # height (CHv4 always active, pass 0)
    ctypes.POINTER(ctypes.c_uint8),
]
cpu_hash = (ctypes.c_uint8 * 32)()
nonce_test = found_nonce.value if ret == 1 else 0
lib.cosmic_harmony_v4_hash(header, 80, nonce_test, 0, ctypes.cast(cpu_hash, ctypes.POINTER(ctypes.c_uint8)))
print(f"CPU hash (nonce={nonce_test}): {bytes(cpu_hash).hex()}")
if ret == 1:
    gpu_h = bytes(found_hash).hex()
    cpu_h = bytes(cpu_hash).hex()
    print(f"GPU hash: {gpu_h}")
    print(f"Match: {'YES ✅' if gpu_h == cpu_h else 'NO ❌'}")

print("\nDone.")
