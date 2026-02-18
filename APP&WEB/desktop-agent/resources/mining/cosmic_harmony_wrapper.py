#!/usr/bin/env python3
"""
ZION Cosmic Harmony Algorithm - Python Wrapper
Wraps C++ optimized implementation for use in Universal AI Miner

When the native library is unavailable we mirror the OpenCL kernel so GPU and
CPU results stay aligned during validator bring-up.
"""

import ctypes
import logging
import struct
from pathlib import Path

logger = logging.getLogger(__name__)

UINT32_MASK = 0xFFFFFFFF
PHI_UINT32 = 0x9E3779B9  # Golden ratio constant used by the OpenCL kernel


def _rotl32(value: int, shift: int) -> int:
    shift &= 31
    return ((value << shift) & UINT32_MASK) | ((value & UINT32_MASK) >> (32 - shift))


def _mix(a: int, b: int, c: int) -> int:
    return (_rotl32((a ^ b) & UINT32_MASK, 5) + (c & UINT32_MASK)) & UINT32_MASK


class CosmicHarmonyHasher:
    """
    Python wrapper for ZION Cosmic Harmony algorithm
    
    Provides two modes:
    1. C++ library mode (fast, uses compiled .so/.dylib)
    2. Pure Python mode (slower fallback, ~10-50x slower)
    """
    
    def __init__(self, use_cpp: bool = True):
        """
        Initialize Cosmic Harmony hasher
        
        Args:
            use_cpp: Try to load C++ library for performance
        """
        self.cpp_lib = None
        self.use_cpp = use_cpp
        
        if use_cpp:
            self._try_load_cpp_library()
        
        if self.cpp_lib:
            logger.info("✅ Cosmic Harmony: Using C++ optimized implementation")
        else:
            logger.info("⚙️ Cosmic Harmony: Using Python fallback implementation")
    
    def _try_load_cpp_library(self):
        """Try to load compiled C++ Cosmic Harmony library"""
        # Possible library paths and names
        lib_names = [
            'libcosmic_harmony.so.2.9.0',  # Versioned (Linux)
            'libcosmic_harmony.so',         # Linux
            'libcosmicharmony.so',          # Alternative Linux
            'libcosmic_harmony.dylib',      # macOS
            'libcosmicharmony.dylib',       # Alternative macOS
            'cosmic_harmony.dll',           # Windows
            'cosmicharmony.dll',            # Alternative Windows
        ]
        
        search_paths = [
            Path(__file__).parent,                                          # Same directory (zion/mining/)
            Path(__file__).parent / 'build',                               # Build subdirectory
            Path(__file__).parent.parent.parent / 'build_zion' / 'build' / 'lib',  # New CMake build
            Path(__file__).parent.parent.parent / 'build' / 'lib',         # Project build
        ]
        
        for search_path in search_paths:
            for lib_name in lib_names:
                lib_path = search_path / lib_name
                if lib_path.exists():
                    try:
                        self.cpp_lib = ctypes.CDLL(str(lib_path))
                        self._setup_cpp_functions()
                        logger.info(f"📚 Loaded C++ library: {lib_path}")
                        return
                    except Exception as e:
                        logger.debug(f"Failed to load {lib_path}: {e}")
        
        logger.debug("C++ library not found, using Python fallback")
    
    def _setup_cpp_functions(self):
        """Setup C++ function signatures"""
        if not self.cpp_lib:
            return
        
        try:
            # cosmic_hash function: (input, input_len, nonce, output)
            self.cpp_lib.cosmic_hash.argtypes = [
                ctypes.POINTER(ctypes.c_uint8),  # input
                ctypes.c_size_t,                  # input_len
                ctypes.c_uint32,                  # nonce
                ctypes.POINTER(ctypes.c_uint8)    # output (32 bytes)
            ]
            self.cpp_lib.cosmic_hash.restype = None
            
            # Initialize function
            if hasattr(self.cpp_lib, 'cosmic_harmony_initialize'):
                self.cpp_lib.cosmic_harmony_initialize.argtypes = []
                self.cpp_lib.cosmic_harmony_initialize.restype = ctypes.c_bool
                self.cpp_lib.cosmic_harmony_initialize()
                
        except Exception as e:
            logger.warning(f"Failed to setup C++ functions: {e}")
            self.cpp_lib = None
    
    def hash(self, input_data: bytes, nonce: int = 0) -> bytes:
        """
        Compute Cosmic Harmony hash
        
        Args:
            input_data: Block header or data to hash
            nonce: Mining nonce
            
        Returns:
            32-byte hash result
        """
        if self.cpp_lib:
            return self._hash_cpp(input_data, nonce)
        else:
            return self._hash_python(input_data, nonce)
    
    def _hash_cpp(self, input_data: bytes, nonce: int) -> bytes:
        """Hash using C++ library (fast)"""
        try:
            input_array = (ctypes.c_uint8 * len(input_data)).from_buffer_copy(input_data)
            output_array = (ctypes.c_uint8 * 32)()
            
            self.cpp_lib.cosmic_hash(
                input_array,
                len(input_data),
                ctypes.c_uint32(nonce),
                output_array
            )
            
            return bytes(output_array)
            
        except Exception as e:
            logger.error(f"C++ hash failed: {e}, falling back to Python")
            return self._hash_python(input_data, nonce)
    
    def _hash_python(self, input_data: bytes, nonce: int) -> bytes:
        """Reproduce the simplified OpenCL kernel in pure Python."""
        state = [
            0x6A09E667,
            0xBB67AE85,
            0x3C6EF372,
            0xA54FF53A,
            0x510E527F,
            0x9B05688C,
            0x1F83D9AB,
            0x5BE0CD19,
        ]

        padding = (-len(input_data)) % 4
        padded = input_data + (b"\x00" * padding)
        if padded:
            words = struct.unpack_from(f"<{len(padded) // 4}I", padded)
        else:
            words = ()

        limit = min(len(words), 8)
        for i in range(limit):
            state[i] ^= words[i] & UINT32_MASK

        state[0] ^= nonce & UINT32_MASK
        state[1] ^= (nonce >> 16) & UINT32_MASK

        for _round in range(12):
            for i in range(8):
                state[i] = _mix(state[i], state[(i + 1) % 8], state[(i + 2) % 8])
            for i in range(4):
                state[i], state[i + 4] = state[i + 4], state[i]

        xor_mix = 0
        for value in state:
            xor_mix ^= value
        for i in range(8):
            state[i] = (state[i] ^ xor_mix) & UINT32_MASK

        for i in range(8):
            state[i] = (state[i] * PHI_UINT32) & UINT32_MASK

        return struct.pack('<8I', *state)
    
    def check_difficulty(self, hash_result: bytes, target_difficulty: int) -> bool:
        """
        Check if hash meets difficulty target
        
        Args:
            hash_result: 32-byte hash
            target_difficulty: Number of leading zero bits required
            
        Returns:
            True if hash meets difficulty
        """
        if not hash_result or len(hash_result) < 32:
            return False
            
        # Calculate hash difficulty (number of leading zero bits)
        hash_difficulty = 0
        
        for byte_idx in range(31, -1, -1):
            byte_val = hash_result[byte_idx]
            if byte_val == 0:
                hash_difficulty += 8
            else:
                # Count leading zeros in this byte
                mask = 0x80
                while (byte_val & mask) == 0 and mask != 0:
                    hash_difficulty += 1
                    mask >>= 1
                break
        
        return hash_difficulty >= target_difficulty

    def check_target32(self, hash_result: bytes, target32: int) -> bool:
        """
        Check if first 4 bytes (little-endian) of hash_result are <= 32-bit target.
        This matches the GPU miner's placeholder/state[0] semantics used during bring-up.
        """
        if not hash_result or len(hash_result) < 4:
            return False
        state0 = int.from_bytes(hash_result[:4], 'little', signed=False)
        return state0 <= int(target32)


# Convenience functions
_global_hasher = None

def get_hasher(use_cpp: bool = True) -> CosmicHarmonyHasher:
    """Get global Cosmic Harmony hasher instance"""
    global _global_hasher
    if _global_hasher is None:
        _global_hasher = CosmicHarmonyHasher(use_cpp=use_cpp)
    return _global_hasher

def cosmic_hash(input_data: bytes, nonce: int = 0) -> bytes:
    """Quick hash function using global hasher"""
    return get_hasher().hash(input_data, nonce)

def check_hash_difficulty(hash_result: bytes, difficulty: int) -> bool:
    """Quick difficulty check using global hasher"""
    return get_hasher().check_difficulty(hash_result, difficulty)


# Test/benchmark code
if __name__ == "__main__":
    import time
    
    logging.basicConfig(level=logging.INFO, format='%(message)s')
    
    print("🌟 ZION Cosmic Harmony Algorithm Test")
    print("=" * 60)
    
    # Test both implementations
    for use_cpp in [True, False]:
        mode = "C++" if use_cpp else "Python"
        print(f"\n{mode} Implementation:")
        print("-" * 60)
        
        hasher = CosmicHarmonyHasher(use_cpp=use_cpp)
        
        # Test hash
        test_data = b"ZION_TEST_BLOCK_HEADER_" + b"0" * 57  # 80 bytes
        test_nonce = 12345
        
        result = hasher.hash(test_data, test_nonce)
        print(f"Input:  {test_data[:20]}... ({len(test_data)} bytes)")
        print(f"Nonce:  {test_nonce}")
        print(f"Hash:   {result.hex()}")
        
        # Benchmark
        iterations = 1000 if use_cpp else 100
        start_time = time.time()
        
        for i in range(iterations):
            _ = hasher.hash(test_data, i)
        
        elapsed = time.time() - start_time
        hashrate = iterations / elapsed
        
        print(f"\nBenchmark ({iterations} hashes):")
        print(f"  Time:     {elapsed:.3f}s")
        print(f"  Hashrate: {hashrate:.2f} H/s")
        
        # Difficulty test
        difficulty = 8
        meets = hasher.check_difficulty(result, difficulty)
        print(f"\nDifficulty check (target={difficulty} bits): {meets}")
    
    print("\n" + "=" * 60)
    print("✅ Cosmic Harmony algorithm test complete!")
