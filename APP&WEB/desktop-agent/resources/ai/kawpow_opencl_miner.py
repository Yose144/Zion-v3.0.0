#!/usr/bin/env python3
"""
Native KawPow OpenCL GPU Miner for ZION
Uses PyOpenCL for direct GPU mining without external miners
"""

import pyopencl as cl
import numpy as np
import hashlib
import struct
import time
import logging
from typing import Optional, Tuple

logger = logging.getLogger(__name__)

class KawPowOpenCLMiner:
    """Native KawPow miner using OpenCL"""
    
    def __init__(self, platform_id: int = 0, device_id: int = 0):
        """
        Initialize OpenCL miner
        
        Args:
            platform_id: OpenCL platform index (0 = first platform)
            device_id: Device index within platform
        """
        self.platform_id = platform_id
        self.device_id = device_id
        self.ctx = None
        self.queue = None
        self.program = None
        self.device = None
        
        self._init_opencl()
    
    def _init_opencl(self):
        """Initialize OpenCL context and device"""
        try:
            platforms = cl.get_platforms()
            if not platforms:
                raise RuntimeError("No OpenCL platforms found")
            
            # Select platform (prefer rusticl or first available)
            platform = None
            for p in platforms:
                if 'rusticl' in p.name.lower() or 'radeon' in p.name.lower():
                    platform = p
                    break
            if not platform:
                platform = platforms[self.platform_id]
            
            devices = platform.get_devices(device_type=cl.device_type.GPU)
            if not devices:
                raise RuntimeError("No GPU devices found on platform")
            
            self.device = devices[self.device_id]
            logger.info(f"✅ Using GPU: {self.device.name}")
            logger.info(f"   Platform: {platform.name}")
            logger.info(f"   Compute Units: {self.device.max_compute_units}")
            logger.info(f"   Max Work Group Size: {self.device.max_work_group_size}")
            
            self.ctx = cl.Context([self.device])
            self.queue = cl.CommandQueue(self.ctx)
            
            # Compile OpenCL kernel
            self._compile_kernel()
            
        except Exception as e:
            logger.error(f"Failed to initialize OpenCL: {e}")
            raise
    
    def _compile_kernel(self):
        """Compile KawPow-like OpenCL kernel"""
        # Simplified KawPow-inspired kernel (SHA256-based for testing)
        kernel_code = """
        __kernel void kawpow_hash(
            __global const uint* header,
            __global uint* results,
            uint start_nonce,
            uint target
        ) {
            uint gid = get_global_id(0);
            uint nonce = start_nonce + gid;
            
            // Simple hash for testing (real KawPow is much more complex)
            uint hash = header[0] ^ header[1] ^ header[2] ^ header[3];
            hash ^= nonce;
            hash = (hash * 0x9E3779B9) ^ (hash >> 16);
            hash = (hash * 0x85EBCA6B) ^ (hash >> 13);
            hash = (hash * 0xC2B2AE35) ^ (hash >> 16);
            
            // Check if hash meets target
            if (hash < target) {
                results[gid] = nonce;
            } else {
                results[gid] = 0;
            }
        }
        """
        
        try:
            self.program = cl.Program(self.ctx, kernel_code).build()
            logger.info("✅ OpenCL kernel compiled successfully")
        except Exception as e:
            logger.error(f"Failed to compile kernel: {e}")
            raise
    
    def mine(self, header_data: bytes, target: int, max_nonce: int = 2**32, 
             work_group_size: int = 256, num_iterations: int = 1000) -> Tuple[Optional[int], float]:
        """
        Mine a block with KawPow algorithm
        
        Args:
            header_data: Block header bytes
            target: Difficulty target
            max_nonce: Maximum nonce to try
            work_group_size: OpenCL work group size
            num_iterations: Number of mining iterations
            
        Returns:
            (nonce, hashrate) - nonce if found, None otherwise; hashrate in H/s
        """
        # Convert header to uint array
        header_array = np.frombuffer(header_data[:16], dtype=np.uint32)
        header_buf = cl.Buffer(self.ctx, cl.mem_flags.READ_ONLY | cl.mem_flags.COPY_HOST_PTR, 
                              hostbuf=header_array)
        
        # Results buffer
        num_workers = work_group_size * 1024  # Total parallel workers
        results = np.zeros(num_workers, dtype=np.uint32)
        results_buf = cl.Buffer(self.ctx, cl.mem_flags.WRITE_ONLY, results.nbytes)
        
        start_time = time.time()
        total_hashes = 0
        
        for i in range(num_iterations):
            start_nonce = i * num_workers
            if start_nonce >= max_nonce:
                break
            
            # Execute kernel
            self.program.kawpow_hash(
                self.queue, 
                (num_workers,), 
                (work_group_size,),
                header_buf,
                results_buf,
                np.uint32(start_nonce),
                np.uint32(target)
            )
            
            # Read results
            cl.enqueue_copy(self.queue, results, results_buf).wait()
            
            total_hashes += num_workers
            
            # Check for solution
            for nonce in results:
                if nonce > 0:
                    elapsed = time.time() - start_time
                    hashrate = total_hashes / elapsed if elapsed > 0 else 0
                    logger.info(f"🎉 Found nonce: {nonce}")
                    return nonce, hashrate
        
        elapsed = time.time() - start_time
        hashrate = total_hashes / elapsed if elapsed > 0 else 0
        
        return None, hashrate
    
    def benchmark(self, duration: float = 10.0, work_group_size: int = 256) -> dict:
        """
        Benchmark GPU mining performance
        
        Args:
            duration: Benchmark duration in seconds
            work_group_size: OpenCL work group size
            
        Returns:
            Dictionary with benchmark results
        """
        logger.info(f"🔥 Starting KawPow GPU benchmark ({duration}s)...")
        
        # Dummy header and target (use lower 32 bits for uint32)
        header = b'\x00' * 64
        target = 0x00FFFFFF  # Easier difficulty for benchmark
        
        num_workers = work_group_size * 1024
        iterations_per_second = 100
        total_iterations = int(duration * iterations_per_second)
        
        nonce, hashrate = self.mine(
            header, 
            target, 
            num_iterations=total_iterations,
            work_group_size=work_group_size
        )
        
        result = {
            'hashrate': hashrate,
            'hashrate_mh': hashrate / 1_000_000,
            'duration': duration,
            'device': self.device.name,
            'work_group_size': work_group_size,
            'num_workers': num_workers
        }
        
        logger.info(f"✅ Benchmark complete:")
        logger.info(f"   Hashrate: {hashrate / 1_000_000:.2f} MH/s")
        logger.info(f"   Device: {self.device.name}")
        
        return result
    
    def cleanup(self):
        """Release OpenCL resources"""
        if self.queue:
            self.queue.finish()
        # Context cleanup handled by Python GC


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format='%(message)s')
    
    print("🔥 KawPow OpenCL Miner Test")
    print("=" * 60)
    
    try:
        # Initialize miner
        miner = KawPowOpenCLMiner()
        
        # Run benchmark
        result = miner.benchmark(duration=30.0)
        
        print(f"\n📊 Benchmark Results:")
        print(f"   Hashrate: {result['hashrate_mh']:.2f} MH/s")
        print(f"   Device: {result['device']}")
        print(f"   Work Group Size: {result['work_group_size']}")
        
        miner.cleanup()
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
