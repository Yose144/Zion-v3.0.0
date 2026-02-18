#!/usr/bin/env python3
"""
Python Wrapper for ZION Native Autolykos v2 Libraries
Provides ctypes interface to C/C++/CUDA/OpenCL implementations
"""

import os
import sys
import ctypes
import platform
from typing import Optional, Tuple
import numpy as np

class NativeAutolykosMiner:
    """
    Python interface to native Autolykos v2 implementations
    
    Automatically loads best available backend:
    1. CUDA (NVIDIA GPUs) - best performance
    2. OpenCL (AMD/NVIDIA GPUs) - cross-platform
    3. CPU (fallback) - pure C implementation
    """
    
    def __init__(self):
        self.lib = None
        self.backend = None
        self._load_native_library()
    
    def _load_native_library(self):
        """Load native library based on platform"""
        lib_dir = os.path.join(os.path.dirname(__file__), 'native')
        
        # Determine library name based on platform
        if platform.system() == 'Windows':
            lib_names = ['autolykos.dll', 'autolykos_cuda.dll', 'libautolykos.dll']
        elif platform.system() == 'Darwin':  # macOS
            lib_names = ['libautolykos.dylib', 'libautolykos.so']
        else:  # Linux
            lib_names = ['libautolykos.so', 'libautolykos_cuda.so']
        
        # Try to load library
        for lib_name in lib_names:
            lib_path = os.path.join(lib_dir, lib_name)
            if os.path.exists(lib_path):
                try:
                    self.lib = ctypes.CDLL(lib_path)
                    self.backend = 'native'
                    self._setup_function_signatures()
                    print(f"✅ Loaded native library: {lib_name}")
                    return
                except Exception as e:
                    print(f"Warning: Failed to load {lib_name}: {e}")
        
        print("⚠️  Native library not found, using Python fallback")
        self.backend = 'python'
    
    def _setup_function_signatures(self):
        """Setup ctypes function signatures"""
        if not self.lib:
            return
        
        # autolykos_generate_elements
        self.lib.autolykos_generate_elements.argtypes = [
            ctypes.POINTER(ctypes.c_uint8),  # seed
            ctypes.c_size_t,                  # seed_len
            ctypes.POINTER(ctypes.c_uint64),  # elements
            ctypes.c_uint64                   # n_elements
        ]
        self.lib.autolykos_generate_elements.restype = None
        
        # autolykos_hash
        self.lib.autolykos_hash.argtypes = [
            ctypes.POINTER(ctypes.c_uint64),  # elements
            ctypes.c_uint64,                  # n_elements
            ctypes.c_uint64,                  # nonce
            ctypes.c_uint32                   # k_value
        ]
        self.lib.autolykos_hash.restype = ctypes.c_uint64
        
        # autolykos_mine_cpu_batch
        self.lib.autolykos_mine_cpu_batch.argtypes = [
            ctypes.POINTER(ctypes.c_uint64),  # elements
            ctypes.c_uint64,                  # n_elements
            ctypes.c_uint64,                  # nonce_start
            ctypes.c_uint64,                  # batch_size
            ctypes.c_uint64,                  # target
            ctypes.c_uint32,                  # k_value
            ctypes.POINTER(ctypes.c_uint64),  # result_nonce
            ctypes.POINTER(ctypes.c_uint64)   # result_hash
        ]
        self.lib.autolykos_mine_cpu_batch.restype = ctypes.c_int
        
        # autolykos_verify
        self.lib.autolykos_verify.argtypes = [
            ctypes.POINTER(ctypes.c_uint64),  # elements
            ctypes.c_uint64,                  # n_elements
            ctypes.c_uint64,                  # nonce
            ctypes.c_uint64,                  # hash_result
            ctypes.c_uint64,                  # target
            ctypes.c_uint32                   # k_value
        ]
        self.lib.autolykos_verify.restype = ctypes.c_int
        
        # autolykos_benchmark_cpu
        self.lib.autolykos_benchmark_cpu.argtypes = [ctypes.c_uint64]
        self.lib.autolykos_benchmark_cpu.restype = ctypes.c_double
        
        # autolykos_test
        self.lib.autolykos_test.argtypes = []
        self.lib.autolykos_test.restype = None
    
    def generate_elements(self, seed: bytes, n_elements: int = 2**26) -> np.ndarray:
        """
        Generate Autolykos v2 element table
        
        Args:
            seed: Random seed for generation
            n_elements: Number of elements to generate (default: 67M = 2GB)
            
        Returns:
            NumPy array of uint64 elements
        """
        if self.backend == 'python':
            return self._generate_elements_python(seed, n_elements)
        
        # Allocate output array
        elements = np.zeros(n_elements, dtype=np.uint64)
        
        # Convert seed to ctypes
        seed_array = (ctypes.c_uint8 * len(seed))(*seed)
        
        # Call native function
        self.lib.autolykos_generate_elements(
            seed_array,
            len(seed),
            elements.ctypes.data_as(ctypes.POINTER(ctypes.c_uint64)),
            n_elements
        )
        
        return elements
    
    def hash(self, elements: np.ndarray, nonce: int, k_value: int = 32) -> int:
        """
        Compute Autolykos v2 hash
        
        Args:
            elements: Element table
            nonce: Nonce value
            k_value: Number of element accesses
            
        Returns:
            Hash value (uint64)
        """
        if self.backend == 'python':
            return self._hash_python(elements, nonce, k_value)
        
        result = self.lib.autolykos_hash(
            elements.ctypes.data_as(ctypes.POINTER(ctypes.c_uint64)),
            len(elements),
            nonce,
            k_value
        )
        
        return result
    
    def mine_batch(
        self,
        elements: np.ndarray,
        nonce_start: int,
        batch_size: int,
        target: int,
        k_value: int = 32
    ) -> Optional[Tuple[int, int]]:
        """
        Mine a batch of nonces
        
        Args:
            elements: Element table
            nonce_start: Starting nonce
            batch_size: Number of nonces to try
            target: Difficulty target
            k_value: Number of element accesses
            
        Returns:
            (nonce, hash) if solution found, None otherwise
        """
        if self.backend == 'python':
            return self._mine_batch_python(elements, nonce_start, batch_size, target, k_value)
        
        result_nonce = ctypes.c_uint64(0)
        result_hash = ctypes.c_uint64(0)
        
        found = self.lib.autolykos_mine_cpu_batch(
            elements.ctypes.data_as(ctypes.POINTER(ctypes.c_uint64)),
            len(elements),
            nonce_start,
            batch_size,
            target,
            k_value,
            ctypes.byref(result_nonce),
            ctypes.byref(result_hash)
        )
        
        if found:
            return (result_nonce.value, result_hash.value)
        
        return None
    
    def verify(
        self,
        elements: np.ndarray,
        nonce: int,
        hash_result: int,
        target: int,
        k_value: int = 32
    ) -> bool:
        """
        Verify Autolykos v2 solution
        
        Args:
            elements: Element table
            nonce: Nonce to verify
            hash_result: Expected hash result
            target: Difficulty target
            k_value: Number of element accesses
            
        Returns:
            True if valid, False otherwise
        """
        if self.backend == 'python':
            computed_hash = self.hash(elements, nonce, k_value)
            return computed_hash == hash_result and computed_hash < target
        
        valid = self.lib.autolykos_verify(
            elements.ctypes.data_as(ctypes.POINTER(ctypes.c_uint64)),
            len(elements),
            nonce,
            hash_result,
            target,
            k_value
        )
        
        return bool(valid)
    
    def benchmark(self, n_hashes: int = 100000) -> float:
        """
        Benchmark CPU hashrate
        
        Args:
            n_hashes: Number of hashes to compute
            
        Returns:
            Hashrate in H/s
        """
        if self.backend == 'python':
            import time
            elements = np.random.randint(0, 2**64, 1024, dtype=np.uint64)
            start = time.time()
            for i in range(n_hashes):
                self._hash_python(elements, i, 32)
            elapsed = time.time() - start
            return n_hashes / elapsed
        
        hashrate = self.lib.autolykos_benchmark_cpu(n_hashes)
        return hashrate
    
    def test(self):
        """Run native library tests"""
        if self.backend == 'python':
            print("Native library not loaded, skipping tests")
            return
        
        self.lib.autolykos_test()
    
    # Python fallback implementations
    
    def _generate_elements_python(self, seed: bytes, n_elements: int) -> np.ndarray:
        """Pure Python element generation (slow)"""
        import hashlib
        import struct
        
        elements = np.zeros(n_elements, dtype=np.uint64)
        
        for i in range(n_elements):
            h = hashlib.blake2b(seed + i.to_bytes(8, 'little'), digest_size=8).digest()
            elements[i] = struct.unpack('<Q', h)[0]
        
        return elements
    
    def _hash_python(self, elements: np.ndarray, nonce: int, k_value: int) -> int:
        """Pure Python hash computation"""
        hash_val = nonce
        n_elements = len(elements)
        
        for i in range(k_value):
            index = (hash_val + i) % n_elements
            hash_val ^= int(elements[index])
            hash_val = ((hash_val << 13) | (hash_val >> 51)) & 0xFFFFFFFFFFFFFFFF
        
        return hash_val
    
    def _mine_batch_python(
        self,
        elements: np.ndarray,
        nonce_start: int,
        batch_size: int,
        target: int,
        k_value: int
    ) -> Optional[Tuple[int, int]]:
        """Pure Python mining (very slow)"""
        for nonce in range(nonce_start, nonce_start + batch_size):
            hash_val = self._hash_python(elements, nonce, k_value)
            if hash_val < target:
                return (nonce, hash_val)
        
        return None


def main():
    """Test native wrapper"""
    print("=" * 80)
    print("ZION Native Autolykos v2 Wrapper Test")
    print("=" * 80)
    
    # Initialize
    miner = NativeAutolykosMiner()
    print(f"\nBackend: {miner.backend}")
    
    # Run tests
    if miner.backend == 'native':
        print("\nRunning native tests...")
        miner.test()
    
    # Benchmark
    print("\nBenchmarking CPU...")
    hashrate = miner.benchmark(10000)
    print(f"CPU Hashrate: {hashrate:.2f} H/s")
    
    # Test mining
    print("\nTest mining...")
    seed = b"ZION_TEST_SEED_2.9"
    elements = miner.generate_elements(seed, 10000)
    print(f"Generated {len(elements)} elements")
    
    result = miner.mine_batch(elements, 0, 100000, 2**50, 32)
    if result:
        print(f"✅ Solution found: nonce={result[0]}, hash=0x{result[1]:016x}")
        
        # Verify
        valid = miner.verify(elements, result[0], result[1], 2**50, 32)
        print(f"Verification: {'✅ PASS' if valid else '❌ FAIL'}")
    else:
        print("No solution found (expected for small batch)")
    
    print("\n✅ All tests complete!")


if __name__ == "__main__":
    main()
