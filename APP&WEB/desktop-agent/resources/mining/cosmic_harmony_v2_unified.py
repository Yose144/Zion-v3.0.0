#!/usr/bin/env python3
"""
ZION Cosmic Harmony v2 - Unified Hasher Interface

Provides a single interface for all available backends:
1. GPU OpenCL (fastest: ~15 kH/s)
2. Native C + AVX2 (fast: ~200-350 H/s)
3. Numba JIT (medium: ~50-100 H/s)
4. Pure Python (slow: ~0.1 H/s)

Auto-detects the best available backend.

Author: ZION AI Native Team
Version: 2.9.5
Date: January 2026
"""

import os
import sys
import time
from enum import Enum
from typing import Optional, Tuple, List, Callable
from dataclasses import dataclass

# Add mining to path
sys.path.insert(0, os.path.dirname(__file__))


class HasherBackend(Enum):
    """Available hasher backends."""
    GPU_OPENCL = "gpu_opencl"
    NATIVE_C = "native_c"
    NUMBA_JIT = "numba_jit"
    PURE_PYTHON = "pure_python"
    DISABLED = "disabled"


@dataclass
class BackendInfo:
    """Information about a backend."""
    name: str
    backend: HasherBackend
    available: bool
    hashrate_estimate: float  # H/s
    description: str


class CosmicHarmonyV2Unified:
    """
    Unified interface for Cosmic Harmony v2 hashing.
    
    Automatically selects the best available backend.
    Supports fallback chain if preferred backend fails.
    """
    
    def __init__(
        self,
        preferred_backend: HasherBackend = None,
        prev_hash: bytes = None,
        block_height: int = 0,
        gpu_batch_size: int = 256,
        verbose: bool = True
    ):
        """
        Initialize unified hasher.
        
        Args:
            preferred_backend: Force specific backend (None = auto-detect best)
            prev_hash: Previous block hash
            block_height: Current block height
            gpu_batch_size: Batch size for GPU mining
            verbose: Print detection info
        """
        self._prev_hash = prev_hash or b'\x00' * 32
        self._block_height = block_height
        self._gpu_batch_size = gpu_batch_size
        self._verbose = verbose
        
        self._backend = HasherBackend.DISABLED
        self._hasher = None
        self._gpu_hasher = None
        self._backends_info: List[BackendInfo] = []
        
        # Detect available backends
        self._detect_backends()
        
        # Select backend
        if preferred_backend:
            self._select_backend(preferred_backend)
        else:
            self._select_best_backend()
    
    def _detect_backends(self):
        """Detect all available backends."""
        self._backends_info = []
        
        # 1. GPU OpenCL with VMEM optimizations (preferred)
        try:
            from cosmic_harmony_v2_gpu_vmem import CosmicHarmonyV2GPUVMem, GPU_AVAILABLE
            if GPU_AVAILABLE:
                # Use optimized VMEM version with auto batch size (0 = max)
                # Minimum batch must be >= work_group_size (256)
                batch = max(self._gpu_batch_size, 512) if self._gpu_batch_size > 0 else 0
                self._gpu_hasher = CosmicHarmonyV2GPUVMem(
                    batch_size=batch,
                    use_pinned_memory=True,
                    double_buffer=True,
                    verbose=self._verbose
                )
                if self._gpu_hasher.is_available():
                    self._backends_info.append(BackendInfo(
                        name=f"GPU OpenCL VMEM ({self._gpu_hasher.device_name})",
                        backend=HasherBackend.GPU_OPENCL,
                        available=True,
                        hashrate_estimate=40000.0,  # ~40 kH/s with VMEM
                        description="OpenCL GPU with pinned memory + double buffer"
                    ))
                else:
                    self._gpu_hasher = None
        except Exception as e:
            # Fallback to regular GPU
            try:
                from cosmic_harmony_v2_gpu import CosmicHarmonyV2GPU, GPU_AVAILABLE as GPU_AVAIL2
                if GPU_AVAIL2:
                    self._gpu_hasher = CosmicHarmonyV2GPU(batch_size=self._gpu_batch_size)
                    if self._gpu_hasher.is_available():
                        self._backends_info.append(BackendInfo(
                            name=f"GPU OpenCL ({self._gpu_hasher.device_name})",
                            backend=HasherBackend.GPU_OPENCL,
                            available=True,
                            hashrate_estimate=15000.0,  # ~15 kH/s
                            description="OpenCL GPU acceleration"
                        ))
                    else:
                        self._gpu_hasher = None
            except Exception as e2:
                if self._verbose:
                    print(f"   GPU: Not available ({e2})")
        
        # 2. Native C
        try:
            from cosmic_harmony_v2_native_wrapper import CosmicHarmonyV2Native
            native = CosmicHarmonyV2Native(self._prev_hash, self._block_height)
            if native.is_available():
                avx2 = "AVX2" if native.has_avx2() else "scalar"
                self._backends_info.append(BackendInfo(
                    name=f"Native C ({avx2})",
                    backend=HasherBackend.NATIVE_C,
                    available=True,
                    hashrate_estimate=350.0 if native.has_avx2() else 150.0,
                    description=f"C library with {avx2} SIMD"
                ))
        except Exception as e:
            if self._verbose:
                print(f"   Native C: Not available ({e})")
        
        # 3. Numba JIT
        try:
            from cosmic_harmony_v2_optimized import CosmicHarmonyV2Optimized, NUMBA_AVAILABLE
            if NUMBA_AVAILABLE:
                self._backends_info.append(BackendInfo(
                    name="Numba JIT",
                    backend=HasherBackend.NUMBA_JIT,
                    available=True,
                    hashrate_estimate=50.0,
                    description="JIT compiled with Numba"
                ))
        except Exception as e:
            if self._verbose:
                print(f"   Numba JIT: Not available ({e})")
        
        # 4. Pure Python (always available)
        try:
            from cosmic_harmony_v2 import cosmic_hash_v2
            self._backends_info.append(BackendInfo(
                name="Pure Python",
                backend=HasherBackend.PURE_PYTHON,
                available=True,
                hashrate_estimate=0.1,
                description="Pure Python implementation"
            ))
        except Exception as e:
            if self._verbose:
                print(f"   Pure Python: Not available ({e})")
    
    def _select_backend(self, backend: HasherBackend) -> bool:
        """Select specific backend."""
        for info in self._backends_info:
            if info.backend == backend and info.available:
                return self._init_backend(info)
        return False
    
    def _select_best_backend(self) -> bool:
        """Select the best available backend."""
        # Sort by hashrate estimate (descending)
        available = [b for b in self._backends_info if b.available]
        available.sort(key=lambda x: x.hashrate_estimate, reverse=True)
        
        for info in available:
            if self._init_backend(info):
                return True
        
        return False
    
    def _init_backend(self, info: BackendInfo) -> bool:
        """Initialize a specific backend."""
        try:
            if info.backend == HasherBackend.GPU_OPENCL:
                if self._gpu_hasher:
                    self._backend = HasherBackend.GPU_OPENCL
                    if self._verbose:
                        print(f"[OK] Using: {info.name} (~{info.hashrate_estimate/1000:.1f} kH/s)")
                    return True
            
            elif info.backend == HasherBackend.NATIVE_C:
                from cosmic_harmony_v2_native_wrapper import CosmicHarmonyV2Native
                self._hasher = CosmicHarmonyV2Native(self._prev_hash, self._block_height)
                self._backend = HasherBackend.NATIVE_C
                if self._verbose:
                    print(f"[OK] Using: {info.name} (~{info.hashrate_estimate:.0f} H/s)")
                return True
            
            elif info.backend == HasherBackend.NUMBA_JIT:
                from cosmic_harmony_v2_optimized import CosmicHarmonyV2Optimized
                self._hasher = CosmicHarmonyV2Optimized()
                self._backend = HasherBackend.NUMBA_JIT
                if self._verbose:
                    print(f"[OK] Using: {info.name} (~{info.hashrate_estimate:.0f} H/s)")
                return True
            
            elif info.backend == HasherBackend.PURE_PYTHON:
                from cosmic_harmony_v2 import CosmicHarmonyV2
                self._hasher = CosmicHarmonyV2()
                self._backend = HasherBackend.PURE_PYTHON
                if self._verbose:
                    print(f"[WARN] Using: {info.name} (~{info.hashrate_estimate:.1f} H/s) - SLOW!")
                return True
        
        except Exception as e:
            if self._verbose:
                print(f"[FAIL] Failed to init {info.name}: {e}")
        
        return False
    
    @property
    def backend(self) -> HasherBackend:
        """Current backend."""
        return self._backend
    
    @property
    def backend_name(self) -> str:
        """Current backend name."""
        for info in self._backends_info:
            if info.backend == self._backend:
                return info.name
        return "Unknown"
    
    @property
    def is_gpu(self) -> bool:
        """Check if using GPU backend."""
        return self._backend == HasherBackend.GPU_OPENCL
    
    def get_backends_info(self) -> List[BackendInfo]:
        """Get information about all backends."""
        return self._backends_info
    
    def update_context(self, prev_hash: bytes, block_height: int):
        """Update mining context."""
        self._prev_hash = prev_hash
        self._block_height = block_height
        
        if self._hasher and hasattr(self._hasher, 'update_context'):
            self._hasher.update_context(prev_hash, block_height)
    
    def hash(self, data: bytes, nonce: int) -> bytes:
        """
        Compute single hash.
        
        For GPU backend, this is inefficient - use hash_batch instead.
        """
        if self._backend == HasherBackend.GPU_OPENCL and self._gpu_hasher:
            # GPU single hash (inefficient but compatible)
            import numpy as np
            header = np.frombuffer(data[:32].ljust(32, b'\x00'), dtype=np.uint32)
            prev = np.frombuffer(self._prev_hash[:32].ljust(32, b'\x00'), dtype=np.uint32)
            return self._gpu_hasher.hash_single(header, prev, np.uint32(self._block_height), np.uint64(nonce))
        
        elif self._hasher:
            return self._hasher.hash(data, nonce, self._prev_hash, self._block_height)
        
        else:
            raise RuntimeError("No hasher backend available")
    
    def hash_batch(
        self,
        data: bytes,
        start_nonce: int,
        count: int,
        target: bytes = None
    ) -> Tuple[int, Optional[bytes]]:
        """
        Compute batch of hashes.
        
        Returns:
            Tuple of (hashes_done, winning_nonce_and_hash or None)
        """
        if self._backend == HasherBackend.GPU_OPENCL and self._gpu_hasher:
            # Use GPU batch processing
            import numpy as np
            header = np.frombuffer(data[:32].ljust(32, b'\x00'), dtype=np.uint32)
            prev = np.frombuffer(self._prev_hash[:32].ljust(32, b'\x00'), dtype=np.uint32)
            target_arr = np.frombuffer(target[:32], dtype=np.uint32) if target else None
            
            result = self._gpu_hasher.mine_batch(
                header, prev, np.uint32(self._block_height),
                np.uint64(start_nonce), np.uint32(count), target_arr
            )
            
            if result:
                return (count, result)  # (nonce, hash)
            return (count, None)
        
        else:
            # CPU sequential hashing
            for i in range(count):
                nonce = start_nonce + i
                h = self.hash(data, nonce)
                if target and h < target:
                    return (i + 1, (nonce, h))
            return (count, None)
    
    def benchmark(self, duration: float = 10.0) -> float:
        """Run benchmark and return hashrate."""
        if self._backend == HasherBackend.GPU_OPENCL and self._gpu_hasher:
            return self._gpu_hasher.benchmark(duration)
        
        data = b'\x12\x34\x56\x78' * 8
        total = 0
        nonce = 0
        start = time.perf_counter()
        
        while time.perf_counter() - start < duration:
            self.hash(data, nonce)
            total += 1
            nonce += 1
        
        elapsed = time.perf_counter() - start
        return total / elapsed


def get_best_hasher(
    prev_hash: bytes = None,
    block_height: int = 0,
    verbose: bool = True
) -> CosmicHarmonyV2Unified:
    """
    Get the best available hasher.
    
    Convenience function for quick setup.
    """
    return CosmicHarmonyV2Unified(
        prev_hash=prev_hash,
        block_height=block_height,
        verbose=verbose
    )


# ============================================================================
# CLI
# ============================================================================

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Cosmic Harmony v2 Unified Hasher")
    parser.add_argument('--backend', '-b', type=str, default=None,
                        choices=['gpu', 'native', 'numba', 'python'],
                        help='Force specific backend')
    parser.add_argument('--benchmark', action='store_true', help='Run benchmark')
    parser.add_argument('--duration', '-d', type=float, default=15.0, help='Benchmark duration')
    parser.add_argument('--list', '-l', action='store_true', help='List available backends')
    args = parser.parse_args()
    
    # Map backend names
    backend_map = {
        'gpu': HasherBackend.GPU_OPENCL,
        'native': HasherBackend.NATIVE_C,
        'numba': HasherBackend.NUMBA_JIT,
        'python': HasherBackend.PURE_PYTHON,
    }
    
    preferred = backend_map.get(args.backend) if args.backend else None
    
    print("="*60)
    print("ZION Cosmic Harmony v2 - Unified Hasher")
    print("="*60)
    
    hasher = CosmicHarmonyV2Unified(preferred_backend=preferred)
    
    if args.list:
        print("\nAvailable Backends:")
        for info in hasher.get_backends_info():
            status = "[+]" if info.available else "[-]"
            rate = f"{info.hashrate_estimate/1000:.1f} kH/s" if info.hashrate_estimate >= 1000 else f"{info.hashrate_estimate:.0f} H/s"
            print(f"   {status} {info.name}: ~{rate} ({info.description})")
    
    if args.benchmark:
        print(f"\n>>> Running {args.duration}s benchmark on {hasher.backend_name}...")
        hashrate = hasher.benchmark(args.duration)
        
        if hashrate >= 1000:
            print(f"\n[OK] Result: {hashrate/1000:.2f} kH/s")
        else:
            print(f"\n[OK] Result: {hashrate:.2f} H/s")
    
    elif not args.list:
        # Quick test
        print(f"\n>>> Quick test on {hasher.backend_name}...")
        h = hasher.hash(b'test' * 8, 0)
        print(f"   Hash: {h.hex()[:32]}...")
        print("\nRun with --benchmark for full benchmark")
        print("Run with --list to see all backends")
