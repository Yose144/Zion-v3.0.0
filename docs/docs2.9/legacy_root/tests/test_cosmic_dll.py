#!/usr/bin/env python3
"""Test Cosmic Harmony DLL output"""

import ctypes
import os

# Load DLL
dll_path = os.path.join("ai", "mining", "cosmic_harmony_zion.dll")
lib = ctypes.CDLL(dll_path)

lib.cosmic_hash.argtypes = [
    ctypes.POINTER(ctypes.c_uint8),
    ctypes.c_size_t,
    ctypes.c_uint32,
    ctypes.POINTER(ctypes.c_uint8)
]
lib.cosmic_hash.restype = None

# Test with different inputs
test_data_1 = b"Hello World!" + b"\x00" * 64
test_data_2 = b"Different data" + b"\x00" * 62

print("Testing Cosmic Harmony DLL...")
print(f"Data 1: {test_data_1[:16].hex()}...")
print(f"Data 2: {test_data_2[:16].hex()}...")

# Hash 1 with nonce 0
input1 = (ctypes.c_uint8 * len(test_data_1)).from_buffer_copy(test_data_1)
output1 = (ctypes.c_uint8 * 32)()
lib.cosmic_hash(input1, len(test_data_1), 0, output1)
hash1_n0 = bytes(output1).hex()

# Hash 1 with nonce 1
output1_n1 = (ctypes.c_uint8 * 32)()
lib.cosmic_hash(input1, len(test_data_1), 1, output1_n1)
hash1_n1 = bytes(output1_n1).hex()

# Hash 2 with nonce 0
input2 = (ctypes.c_uint8 * len(test_data_2)).from_buffer_copy(test_data_2)
output2 = (ctypes.c_uint8 * 32)()
lib.cosmic_hash(input2, len(test_data_2), 0, output2)
hash2_n0 = bytes(output2).hex()

print("\nResults:")
print(f"Data1 + Nonce0: {hash1_n0}")
print(f"Data1 + Nonce1: {hash1_n1}")
print(f"Data2 + Nonce0: {hash2_n0}")

print("\nAnalysis:")
if hash1_n0 == hash1_n1:
    print("❌ ERROR: Same data with different nonces produces SAME hash!")
else:
    print("✅ OK: Different nonces produce different hashes")

if hash1_n0 == hash2_n0:
    print("❌ ERROR: Different data produces SAME hash!")
else:
    print("✅ OK: Different data produces different hashes")

# Check if all zeros
if hash1_n0 == "0" * 64:
    print("❌ ERROR: Hash is all zeros!")
elif hash1_n0 == "f" * 64:
    print("❌ ERROR: Hash is all 0xFF!")
else:
    print(f"✅ OK: Hash appears non-trivial")
