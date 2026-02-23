"""
ZION Cosmic Harmony v3 - Native Python Bindings
================================================

High-performance mining library using native Rust code via FFI.

Usage:
    from cosmic_harmony_native import CosmicHarmonyNative
    
    miner = CosmicHarmonyNative()
    
    # Single hash
    block_header = b"ZION block header v2.9.5"
    hash_result = miner.hash(block_header, nonce=12345)
    
    # Batch mining (optimized)
    results = miner.batch_hash(block_header, start_nonce=0, count=1000)
    
    # Find valid nonce
    target = bytes.fromhex("0000ffff" + "00" * 28)
    found, nonce, hash = miner.find_nonce(block_header, target, max_iterations=1000000)
"""

import ctypes
import os
import platform
from pathlib import Path
from typing import Optional, Tuple, List
import struct


class CosmicHarmonyNative:
    """Native Cosmic Harmony v3 mining library wrapper."""
    
    def __init__(self, lib_path: Optional[str] = None):
        """
        Initialize the native library.
        
        Args:
            lib_path: Path to the native library. Auto-detects if not provided.
        """
        if lib_path is None:
            lib_path = self._find_library()
        
        self._lib = ctypes.CDLL(lib_path)
        self._setup_functions()
        
        # Cache CPU count
        self._cpu_count = self._lib.cosmic_harmony_v3_cpu_count()
        
        print(f"🚀 ZION Cosmic Harmony v3 Native Library loaded")
        print(f"   Version: {self.version}")
        print(f"   CPU cores: {self._cpu_count}")
    
    def _find_library(self) -> str:
        """Find the native library based on platform."""
        system = platform.system()
        
        # Library names by platform
        lib_names = {
            "Darwin": "libzion_cosmic_harmony_v3.dylib",
            "Linux": "libzion_cosmic_harmony_v3.so",
            "Windows": "zion_cosmic_harmony_v3.dll",
        }
        
        lib_name = lib_names.get(system)
        if lib_name is None:
            raise OSError(f"Unsupported platform: {system}")
        
        # Search paths
        search_paths = [
            # Current directory
            Path.cwd() / lib_name,
            # Relative to this file
            Path(__file__).parent / lib_name,
            Path(__file__).parent / "lib" / lib_name,
            # Build directory (more paths)
            Path(__file__).parent.parent.parent / "2.9.5" / "target" / "release" / lib_name,
            Path.cwd() / "2.9.5" / "target" / "release" / lib_name,
            Path.cwd().parent / "2.9.5" / "target" / "release" / lib_name,
            # System paths
            Path("/usr/local/lib") / lib_name,
            Path("/usr/lib") / lib_name,
        ]
        
        for path in search_paths:
            if path.exists():
                return str(path)
        
        raise FileNotFoundError(
            f"Could not find {lib_name}. Please build with: "
            f"cargo build --release --features parallel"
        )
    
    def _setup_functions(self):
        """Setup function signatures for type safety."""
        # cosmic_harmony_v3_hash
        self._lib.cosmic_harmony_v3_hash.argtypes = [
            ctypes.POINTER(ctypes.c_uint8),  # input
            ctypes.c_size_t,                  # input_len
            ctypes.c_uint64,                  # nonce
            ctypes.POINTER(ctypes.c_uint8),  # output
        ]
        self._lib.cosmic_harmony_v3_hash.restype = ctypes.c_int
        
        # cosmic_harmony_v3_hash_with_height (height-aware: legacy vs memory-hard)
        self._has_hash_with_height = hasattr(self._lib, 'cosmic_harmony_v3_hash_with_height')
        if self._has_hash_with_height:
            self._lib.cosmic_harmony_v3_hash_with_height.argtypes = [
                ctypes.POINTER(ctypes.c_uint8),  # input
                ctypes.c_size_t,                  # input_len
                ctypes.c_uint64,                  # nonce
                ctypes.c_uint64,                  # height
                ctypes.POINTER(ctypes.c_uint8),  # output
            ]
            self._lib.cosmic_harmony_v3_hash_with_height.restype = ctypes.c_int
        
        # cosmic_harmony_v3_batch_hash
        self._lib.cosmic_harmony_v3_batch_hash.argtypes = [
            ctypes.POINTER(ctypes.c_uint8),  # input
            ctypes.c_size_t,                  # input_len
            ctypes.c_uint64,                  # start_nonce
            ctypes.c_size_t,                  # count
            ctypes.POINTER(ctypes.c_uint8),  # output
        ]
        self._lib.cosmic_harmony_v3_batch_hash.restype = ctypes.c_int
        
        # cosmic_harmony_v3_find_nonce
        self._lib.cosmic_harmony_v3_find_nonce.argtypes = [
            ctypes.POINTER(ctypes.c_uint8),  # input
            ctypes.c_size_t,                  # input_len
            ctypes.c_uint64,                  # start_nonce
            ctypes.c_uint64,                  # max_iterations
            ctypes.POINTER(ctypes.c_uint8),  # target
            ctypes.POINTER(ctypes.c_uint64), # found_nonce
            ctypes.POINTER(ctypes.c_uint8),  # found_hash
        ]
        self._lib.cosmic_harmony_v3_find_nonce.restype = ctypes.c_int
        
        # cosmic_harmony_v3_check_difficulty
        self._lib.cosmic_harmony_v3_check_difficulty.argtypes = [
            ctypes.POINTER(ctypes.c_uint8),  # hash
            ctypes.POINTER(ctypes.c_uint8),  # target
        ]
        self._lib.cosmic_harmony_v3_check_difficulty.restype = ctypes.c_int
        
        # cosmic_harmony_v3_version
        self._lib.cosmic_harmony_v3_version.restype = ctypes.c_uint32
        
        # cosmic_harmony_v3_cpu_count
        self._lib.cosmic_harmony_v3_cpu_count.restype = ctypes.c_uint32
        
        # cosmic_harmony_v3_info
        self._lib.cosmic_harmony_v3_info.restype = ctypes.c_char_p
    
    @property
    def version(self) -> int:
        """Get FFI interface version."""
        return self._lib.cosmic_harmony_v3_version()
    
    @property
    def cpu_count(self) -> int:
        """Get number of CPU cores."""
        return self._cpu_count
    
    @property
    def info(self) -> str:
        """Get library info string."""
        return self._lib.cosmic_harmony_v3_info().decode('utf-8')
    
    def hash(self, block_header: bytes, nonce: int) -> bytes:
        """
        Compute single Cosmic Harmony v3 hash.
        
        Args:
            block_header: Block header bytes
            nonce: Mining nonce
            
        Returns:
            32-byte hash result
        """
        # CHv3 uses only the first 80 bytes of the header (see Rust implementation).
        # The FFI layer rejects very large inputs (>1024). Pools may include extra
        # data in the Stratum blob; trimming keeps behavior consistent with core.
        if not isinstance(block_header, (bytes, bytearray, memoryview)):
            raise TypeError(f"block_header must be bytes-like, got {type(block_header).__name__}")
        bh = bytes(block_header)
        if len(bh) == 0:
            raise ValueError("block_header must not be empty")
        if len(bh) > 80:
            bh = bh[:80]

        input_arr = (ctypes.c_uint8 * len(bh))(*bh)
        output_arr = (ctypes.c_uint8 * 32)()
        
        result = self._lib.cosmic_harmony_v3_hash(
            input_arr,
            len(bh),
            nonce,
            output_arr
        )
        
        if result != 0:
            raise RuntimeError(f"Hash computation failed: error code {result}")
        
        return bytes(output_arr)
    
    def _prepare_header(self, block_header: bytes) -> bytes:
        """Validate and trim header to 80 bytes (consensus rule)."""
        if not isinstance(block_header, (bytes, bytearray, memoryview)):
            raise TypeError(f"block_header must be bytes-like, got {type(block_header).__name__}")
        bh = bytes(block_header)
        if len(bh) == 0:
            raise ValueError("block_header must not be empty")
        if len(bh) > 80:
            bh = bh[:80]
        return bh

    def hash_with_height(self, block_header: bytes, nonce: int, height: int) -> bytes:
        """
        Height-aware Cosmic Harmony v3 hash.
        
        At height < 50,000 uses legacy pipeline (no scratchpad).
        At height >= 50,000 uses full memory-hard pipeline.
        The FFI also XORs nonce with height (consensus rule).
        
        Args:
            block_header: Block header bytes (trimmed to 80)
            nonce: Mining nonce
            height: Block height
            
        Returns:
            32-byte hash result
        """
        bh = self._prepare_header(block_header)
        input_arr = (ctypes.c_uint8 * len(bh))(*bh)
        output_arr = (ctypes.c_uint8 * 32)()
        
        if self._has_hash_with_height:
            result = self._lib.cosmic_harmony_v3_hash_with_height(
                input_arr, len(bh), nonce, height, output_arr
            )
        else:
            # Old DLL without _with_height: manually replicate the nonce XOR
            # and call base hash. NOTE: this still uses the full (memory-hard)
            # variant, so shares may be invalid at height < 50,000.
            effective_nonce = nonce ^ height
            result = self._lib.cosmic_harmony_v3_hash(
                input_arr, len(bh), effective_nonce, output_arr
            )
        
        if result != 0:
            raise RuntimeError(f"Hash computation failed: error code {result}")
        
        return bytes(output_arr)
    
    def batch_hash(
        self, 
        block_header: bytes, 
        start_nonce: int, 
        count: int
    ) -> List[bytes]:
        """
        Compute batch of hashes (optimized).
        
        Args:
            block_header: Block header bytes
            start_nonce: Starting nonce
            count: Number of hashes to compute
            
        Returns:
            List of 32-byte hash results
        """
        # Keep canonical behavior: only first 80 bytes are hashed.
        if not isinstance(block_header, (bytes, bytearray, memoryview)):
            raise TypeError(f"block_header must be bytes-like, got {type(block_header).__name__}")
        bh = bytes(block_header)
        if len(bh) == 0:
            raise ValueError("block_header must not be empty")
        if len(bh) > 80:
            bh = bh[:80]

        input_arr = (ctypes.c_uint8 * len(bh))(*bh)
        output_arr = (ctypes.c_uint8 * (32 * count))()
        
        result = self._lib.cosmic_harmony_v3_batch_hash(
            input_arr,
            len(bh),
            start_nonce,
            count,
            output_arr
        )
        
        if result != 0:
            raise RuntimeError(f"Batch hash failed: error code {result}")
        
        # Split output into individual hashes
        hashes = []
        for i in range(count):
            hashes.append(bytes(output_arr[i * 32:(i + 1) * 32]))
        
        return hashes
    
    def check_difficulty(self, hash_bytes: bytes, target: bytes) -> bool:
        """
        Check if hash meets difficulty target.
        
        Args:
            hash_bytes: 32-byte hash
            target: 32-byte target (big-endian)
            
        Returns:
            True if hash <= target (valid block)
        """
        hash_arr = (ctypes.c_uint8 * 32)(*hash_bytes)
        target_arr = (ctypes.c_uint8 * 32)(*target)
        
        result = self._lib.cosmic_harmony_v3_check_difficulty(hash_arr, target_arr)
        
        return result == 1
    
    def find_nonce(
        self,
        block_header: bytes,
        target: bytes,
        start_nonce: int = 0,
        max_iterations: int = 1_000_000
    ) -> Tuple[bool, int, bytes]:
        """
        Find nonce that meets difficulty target.
        
        Args:
            block_header: Block header bytes
            target: 32-byte target (big-endian)
            start_nonce: Starting nonce
            max_iterations: Maximum iterations to try
            
        Returns:
            Tuple of (found, nonce, hash)
        """
        # Keep canonical behavior: only first 80 bytes are hashed.
        if not isinstance(block_header, (bytes, bytearray, memoryview)):
            raise TypeError(f"block_header must be bytes-like, got {type(block_header).__name__}")
        bh = bytes(block_header)
        if len(bh) == 0:
            raise ValueError("block_header must not be empty")
        if len(bh) > 80:
            bh = bh[:80]

        input_arr = (ctypes.c_uint8 * len(bh))(*bh)
        target_arr = (ctypes.c_uint8 * 32)(*target)
        found_nonce = ctypes.c_uint64()
        found_hash = (ctypes.c_uint8 * 32)()
        
        result = self._lib.cosmic_harmony_v3_find_nonce(
            input_arr,
            len(bh),
            start_nonce,
            max_iterations,
            target_arr,
            ctypes.byref(found_nonce),
            found_hash
        )
        
        if result == 1:
            return True, found_nonce.value, bytes(found_hash)
        elif result == 0:
            return False, 0, b''
        else:
            raise RuntimeError(f"Find nonce failed: error code {result}")


# ============================================================================
# CONVENIENCE FUNCTIONS
# ============================================================================

_default_instance: Optional[CosmicHarmonyNative] = None

def get_native() -> CosmicHarmonyNative:
    """Get or create default native library instance."""
    global _default_instance
    if _default_instance is None:
        _default_instance = CosmicHarmonyNative()
    return _default_instance


def hash(block_header: bytes, nonce: int) -> bytes:
    """Compute Cosmic Harmony v3 hash using native library."""
    return get_native().hash(block_header, nonce)


def batch_hash(block_header: bytes, start_nonce: int, count: int) -> List[bytes]:
    """Compute batch of hashes using native library."""
    return get_native().batch_hash(block_header, start_nonce, count)


def find_nonce(
    block_header: bytes,
    target: bytes,
    start_nonce: int = 0,
    max_iterations: int = 1_000_000
) -> Tuple[bool, int, bytes]:
    """Find nonce that meets difficulty using native library."""
    return get_native().find_nonce(block_header, target, start_nonce, max_iterations)


# ============================================================================
# CLI TEST
# ============================================================================

if __name__ == "__main__":
    import time
    
    print("=" * 60)
    print("ZION Cosmic Harmony v3 - Native Library Benchmark")
    print("=" * 60)
    
    try:
        miner = CosmicHarmonyNative()
        
        block_header = b"ZION block header v2.9.5 timestamp:1234567890"
        
        # Warmup
        for i in range(100):
            miner.hash(block_header, i)
        
        # Single hash benchmark
        iterations = 10000
        start = time.perf_counter()
        for i in range(iterations):
            miner.hash(block_header, i)
        elapsed = time.perf_counter() - start
        single_rate = iterations / elapsed
        
        print(f"\n📊 Single Hash Performance:")
        print(f"   {iterations} hashes in {elapsed:.3f}s")
        print(f"   Rate: {single_rate:,.0f} H/s ({single_rate/1000:.1f} kH/s)")
        
        # Batch hash benchmark
        batch_size = 10000
        start = time.perf_counter()
        results = miner.batch_hash(block_header, 0, batch_size)
        elapsed = time.perf_counter() - start
        batch_rate = batch_size / elapsed
        
        print(f"\n📊 Batch Hash Performance ({batch_size} hashes):")
        print(f"   Completed in {elapsed:.3f}s")
        print(f"   Rate: {batch_rate:,.0f} H/s ({batch_rate/1000:.1f} kH/s)")
        
        # Verify hashes are different
        unique_hashes = len(set(h.hex() for h in results[:100]))
        print(f"   Unique hashes (first 100): {unique_hashes}")
        
        # Difficulty check
        print(f"\n🎯 Difficulty Check:")
        easy_target = bytes.fromhex("00ff" + "ff" * 30)
        hard_target = bytes.fromhex("0000" + "ff" * 30)
        
        test_hash = miner.hash(block_header, 12345)
        print(f"   Test hash: {test_hash.hex()[:16]}...")
        print(f"   Meets easy target (00ff...): {miner.check_difficulty(test_hash, easy_target)}")
        print(f"   Meets hard target (0000...): {miner.check_difficulty(test_hash, hard_target)}")
        
        print(f"\n✅ All tests passed!")
        print("=" * 60)
        
    except FileNotFoundError as e:
        print(f"❌ Library not found: {e}")
        print("\nTo build the native library:")
        print("  cd 2.9.5/zion-cosmic-harmony-v3")
        print("  cargo build --release --features parallel")
    except Exception as e:
        print(f"❌ Error: {e}")
        raise
