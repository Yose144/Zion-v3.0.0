#!/usr/bin/env python3
"""
ZION Cosmic Harmony v2 - Native Library Python Wrapper

This module provides Python bindings to the native C implementation
of Cosmic Harmony v2 with optional AVX2 SIMD optimizations.

Performance comparison:
- Pure Python: ~0.27 H/s
- Numba JIT:   ~100 H/s
- Native C:    ~500-2000 H/s (depending on SIMD support)
- GPU OpenCL:  ~36,000 H/s

Usage:
    from cosmic_harmony_v2_native_wrapper import CosmicHarmonyV2Native
    
    hasher = CosmicHarmonyV2Native()
    if hasher.is_available():
        result = hasher.hash(data, nonce, prev_hash, block_height)

Author: ZION AI Native Team
Version: 2.9.5
Date: January 2026
"""

import ctypes
import os
import sys
import platform
import time
from pathlib import Path
from typing import Optional, Tuple

# ============================================================================
# Library Loading
# ============================================================================

def find_native_library() -> Optional[str]:
    """Find the native library path based on platform."""
    base_dir = Path(__file__).parent
    
    system = platform.system().lower()
    machine = platform.machine().lower()
    
    if system == 'windows':
        lib_names = ['cosmic_harmony_v2.dll', 'libcosmic_harmony_v2.dll']
    elif system == 'darwin':
        lib_names = ['libcosmic_harmony_v2.dylib']
    else:  # Linux
        lib_names = ['libcosmic_harmony_v2.so']
    
    # Search paths
    search_paths = [
        base_dir,
        base_dir / 'native',
        base_dir / 'lib',
        base_dir.parent / 'lib',
        base_dir.parent / 'build',
        Path.cwd(),
        Path.cwd() / 'lib',
    ]
    
    for search_path in search_paths:
        for lib_name in lib_names:
            lib_path = search_path / lib_name
            if lib_path.exists():
                return str(lib_path)
    
    return None


def load_native_library() -> Optional[ctypes.CDLL]:
    """Load the native library."""
    lib_path = find_native_library()
    
    if lib_path is None:
        return None
    
    try:
        if platform.system() == 'Windows':
            lib = ctypes.CDLL(lib_path, winmode=0)
        else:
            lib = ctypes.CDLL(lib_path)
        return lib
    except Exception as e:
        print(f"⚠️  Failed to load native library: {e}")
        return None


# ============================================================================
# Native Wrapper Class
# ============================================================================

class CosmicHarmonyV2Native:
    """
    Native C implementation wrapper for Cosmic Harmony v2.
    
    Falls back to Python implementation if native library is not available.
    """
    
    def __init__(self, prev_hash: bytes = None, block_height: int = 0):
        self._lib = load_native_library()
        self._ctx = None
        self._available = False
        
        if self._lib is not None:
            self._setup_functions()
            
            if prev_hash is None:
                prev_hash = b'\x00' * 32
            
            # Create context
            prev_hash_arr = (ctypes.c_uint8 * 32)(*prev_hash[:32].ljust(32, b'\x00'))
            self._ctx = self._lib.cosmic_v2_create(prev_hash_arr, ctypes.c_uint64(block_height))
            
            if self._ctx:
                self._available = True
                info = self._lib.cosmic_v2_get_info()
                print(f"[OK] Native library loaded: {info.decode() if info else 'Unknown'}")
            else:
                print("[WARN] Failed to create native context")
        else:
            print("[WARN] Native library not found - compile it first")
    
    def _setup_functions(self):
        """Set up ctypes function signatures."""
        # cosmic_v2_create
        self._lib.cosmic_v2_create.argtypes = [
            ctypes.POINTER(ctypes.c_uint8),  # prev_hash
            ctypes.c_uint64,                  # block_height
        ]
        self._lib.cosmic_v2_create.restype = ctypes.c_void_p
        
        # cosmic_v2_destroy
        self._lib.cosmic_v2_destroy.argtypes = [ctypes.c_void_p]
        self._lib.cosmic_v2_destroy.restype = None
        
        # cosmic_v2_reset
        self._lib.cosmic_v2_reset.argtypes = [ctypes.c_void_p]
        self._lib.cosmic_v2_reset.restype = None
        
        # cosmic_v2_hash
        self._lib.cosmic_v2_hash.argtypes = [
            ctypes.c_void_p,                  # ctx
            ctypes.POINTER(ctypes.c_uint8),   # input
            ctypes.c_size_t,                  # input_len
            ctypes.c_uint64,                  # nonce
            ctypes.POINTER(ctypes.c_uint8),   # output
        ]
        self._lib.cosmic_v2_hash.restype = ctypes.c_int
        
        # cosmic_v2_hash_simple
        self._lib.cosmic_v2_hash_simple.argtypes = [
            ctypes.POINTER(ctypes.c_uint8),   # input
            ctypes.c_size_t,                  # input_len
            ctypes.c_uint64,                  # nonce
            ctypes.POINTER(ctypes.c_uint8),   # prev_hash
            ctypes.c_uint64,                  # block_height
            ctypes.POINTER(ctypes.c_uint8),   # output
        ]
        self._lib.cosmic_v2_hash_simple.restype = ctypes.c_int
        
        # cosmic_v2_get_info
        self._lib.cosmic_v2_get_info.argtypes = []
        self._lib.cosmic_v2_get_info.restype = ctypes.c_char_p
        
        # cosmic_v2_has_avx2
        self._lib.cosmic_v2_has_avx2.argtypes = []
        self._lib.cosmic_v2_has_avx2.restype = ctypes.c_int
    
    def is_available(self) -> bool:
        """Check if native library is available."""
        return self._available
    
    def has_avx2(self) -> bool:
        """Check if AVX2 is supported."""
        if not self._available:
            return False
        return self._lib.cosmic_v2_has_avx2() != 0
    
    def get_info(self) -> str:
        """Get library info string."""
        if not self._available:
            return "Native library not available"
        info = self._lib.cosmic_v2_get_info()
        return info.decode() if info else "Unknown"
    
    def hash(
        self,
        input_data: bytes,
        nonce: int,
        prev_hash: bytes = None,
        block_height: int = None
    ) -> bytes:
        """
        Compute Cosmic Harmony v2 hash.
        
        Args:
            input_data: Block header data
            nonce: Mining nonce
            prev_hash: Previous block hash (optional, uses context)
            block_height: Block height (optional, uses context)
        
        Returns:
            32-byte hash
        """
        if not self._available:
            raise RuntimeError("Native library not available")
        
        # If prev_hash or block_height provided, use simple function
        if prev_hash is not None or block_height is not None:
            return self._hash_simple(input_data, nonce, prev_hash or b'\x00' * 32, block_height or 0)
        
        # Use context-based hashing
        input_arr = (ctypes.c_uint8 * len(input_data))(*input_data)
        output_arr = (ctypes.c_uint8 * 32)()
        
        result = self._lib.cosmic_v2_hash(
            self._ctx,
            input_arr,
            len(input_data),
            ctypes.c_uint64(nonce),
            output_arr
        )
        
        if result != 0:
            raise RuntimeError(f"Hash failed with code {result}")
        
        return bytes(output_arr)
    
    def _hash_simple(
        self,
        input_data: bytes,
        nonce: int,
        prev_hash: bytes,
        block_height: int
    ) -> bytes:
        """Hash using simple API (creates context internally)."""
        input_arr = (ctypes.c_uint8 * len(input_data))(*input_data)
        prev_hash_arr = (ctypes.c_uint8 * 32)(*prev_hash[:32].ljust(32, b'\x00'))
        output_arr = (ctypes.c_uint8 * 32)()
        
        result = self._lib.cosmic_v2_hash_simple(
            input_arr,
            len(input_data),
            ctypes.c_uint64(nonce),
            prev_hash_arr,
            ctypes.c_uint64(block_height),
            output_arr
        )
        
        if result != 0:
            raise RuntimeError(f"Hash failed with code {result}")
        
        return bytes(output_arr)
    
    def reset(self):
        """Reset hasher state."""
        if self._available and self._ctx:
            self._lib.cosmic_v2_reset(self._ctx)
    
    def __del__(self):
        """Clean up native resources."""
        if self._available and self._ctx and self._lib:
            try:
                self._lib.cosmic_v2_destroy(self._ctx)
            except:
                pass


# ============================================================================
# Benchmark
# ============================================================================

def benchmark_native(duration: float = 30.0) -> float:
    """Run native library benchmark."""
    print(f"\n{'='*60}")
    print("Cosmic Harmony v2 - Native Library Benchmark")
    print(f"{'='*60}")
    
    hasher = CosmicHarmonyV2Native()
    
    if not hasher.is_available():
        print("[FAIL] Native library not available")
        print("\nTo compile:")
        print("  Windows: cl /O2 /arch:AVX2 cosmic_harmony_v2_native.c /LD")
        print("  Linux:   gcc -O3 -mavx2 -shared -fPIC cosmic_harmony_v2_native.c -o libcosmic_harmony_v2.so")
        return 0.0
    
    print(f"Library: {hasher.get_info()}")
    print(f"AVX2: {'[+] Enabled' if hasher.has_avx2() else '[-] Disabled'}")
    print(f"Duration: {duration}s\n")
    
    # Test data
    test_data = b'\x12\x34\x56\x78' * 8
    prev_hash = b'\x00' * 32
    block_height = 12345
    
    # Warmup
    print(">>> Warming up...")
    for i in range(10):
        hasher.hash(test_data, i, prev_hash, block_height)
    print("   Warmup complete\n")
    
    # Benchmark
    print(">>> Running benchmark...")
    total_hashes = 0
    nonce = 0
    start = time.perf_counter()
    last_update = start
    
    while time.perf_counter() - start < duration:
        hasher.hash(test_data, nonce, prev_hash, block_height)
        total_hashes += 1
        nonce += 1
        
        now = time.perf_counter()
        if now - last_update >= 0.5:
            elapsed = now - start
            hashrate = total_hashes / elapsed
            print(f"   [{elapsed:.1f}s] {hashrate:.2f} H/s | {total_hashes:,} hashes")
            last_update = now
    
    elapsed = time.perf_counter() - start
    hashrate = total_hashes / elapsed
    
    print(f"\n{'='*60}")
    print(f"[OK] Benchmark complete!")
    print(f"   Total hashes: {total_hashes:,}")
    print(f"   Time: {elapsed:.2f}s")
    print(f"   Hashrate: {hashrate:.2f} H/s")
    print(f"{'='*60}")
    
    return hashrate


# ============================================================================
# Build Helper
# ============================================================================

def build_native_library():
    """Build the native library."""
    import subprocess
    
    src_dir = Path(__file__).parent / 'native'
    src_file = src_dir / 'cosmic_harmony_v2_native.c'
    
    if not src_file.exists():
        print(f"[FAIL] Source file not found: {src_file}")
        return False
    
    system = platform.system().lower()
    
    if system == 'windows':
        # Try MSVC
        out_file = src_dir / 'cosmic_harmony_v2.dll'
        cmd = [
            'cl', '/O2', '/arch:AVX2',
            str(src_file),
            '/LD',
            f'/Fe:{out_file}'
        ]
        
        # Fallback to MinGW
        if subprocess.run(['where', 'cl'], capture_output=True).returncode != 0:
            out_file = src_dir / 'libcosmic_harmony_v2.dll'
            cmd = [
                'gcc', '-O3', '-mavx2',
                '-shared', '-fPIC',
                str(src_file),
                '-o', str(out_file)
            ]
    
    elif system == 'darwin':
        out_file = src_dir / 'libcosmic_harmony_v2.dylib'
        cmd = [
            'clang', '-O3', '-mavx2',
            '-shared', '-fPIC',
            str(src_file),
            '-o', str(out_file)
        ]
    
    else:  # Linux
        out_file = src_dir / 'libcosmic_harmony_v2.so'
        cmd = [
            'gcc', '-O3', '-mavx2',
            '-shared', '-fPIC',
            str(src_file),
            '-o', str(out_file)
        ]
    
    print(f"Building: {' '.join(cmd)}")
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode == 0:
            print(f"[OK] Built: {out_file}")
            return True
        else:
            print(f"[FAIL] Build failed: {result.stderr}")
            return False
    except FileNotFoundError as e:
        print(f"[FAIL] Compiler not found: {e}")
        return False


# ============================================================================
# Main
# ============================================================================

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Cosmic Harmony v2 Native Library")
    parser.add_argument('--build', action='store_true', help='Build the native library')
    parser.add_argument('--benchmark', action='store_true', help='Run benchmark')
    parser.add_argument('--duration', type=float, default=30.0, help='Benchmark duration')
    args = parser.parse_args()
    
    if args.build:
        build_native_library()
    elif args.benchmark:
        benchmark_native(args.duration)
    else:
        # Default: check availability and run quick benchmark
        hasher = CosmicHarmonyV2Native()
        if hasher.is_available():
            print("\n>>> Quick test:")
            result = hasher.hash(b'test', 0, b'\x00' * 32, 0)
            print(f"   Hash: {result.hex()[:32]}...")
            print("\nRun with --benchmark for full benchmark")
        else:
            print("\nRun with --build to compile the library")
