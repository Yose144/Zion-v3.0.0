#!/usr/bin/env python3
"""
ZION Cosmic Harmony v1 - Ultra-Optimized GPU Implementation

Cosmic Harmony v1 is NOT memory-hard, so it's much faster than v2.
This implementation maximizes throughput with:
1. Massive batch sizes (millions of hashes per kernel call)
2. Pinned memory for fast DMA transfers
3. Double/triple buffering for pipeline processing
4. Vectorized kernel with unrolled loops
5. Optimized work group sizes

Performance targets:
- Original: ~100 MH/s
- Optimized: 200-500 MH/s (2-5x improvement)

Author: ZION AI Native Team
Version: 2.9.6-turbo
Date: January 2026
"""

import numpy as np
from typing import Optional, Tuple, List
import time
from dataclasses import dataclass

try:
    import pyopencl as cl
    GPU_AVAILABLE = True
except ImportError:
    GPU_AVAILABLE = False
    print("[WARN] PyOpenCL not available - GPU mining disabled")


# ============================================================================
# ULTRA-OPTIMIZED OPENCL KERNEL - Cosmic Harmony v1
# ============================================================================

COSMIC_HARMONY_V1_TURBO_KERNEL = """
// ============================================================================
// Cosmic Harmony v1 - Ultra-Optimized Kernel
// NOT memory-hard - pure compute-bound = maximum GPU utilization
// ============================================================================

#define ROTL(x, n) (((x) << (n)) | ((x) >> (32 - (n))))
#define PHI 0x9E3779B9u

// Fully unrolled mix for maximum speed
inline uint mix(uint a, uint b, uint c) {
    return ROTL(a ^ b, 5) + c;
}

// Benchmark kernel - maximum throughput
__kernel __attribute__((reqd_work_group_size(256, 1, 1)))
void cosmic_harmony_v1_benchmark(
    __global const uint *header_data,
    const uint header_size,
    const uint nonce_start,
    const uint nonce_range,
    __global uchar *hash_output
) {
    const size_t gid = get_global_id(0);
    if (gid >= nonce_range) return;
    
    const uint nonce = nonce_start + (uint)gid;
    
    // Initialize state (Blake2-like IV)
    uint s0 = 0x6a09e667u;
    uint s1 = 0xbb67ae85u;
    uint s2 = 0x3c6ef372u;
    uint s3 = 0xa54ff53au;
    uint s4 = 0x510e527fu;
    uint s5 = 0x9b05688cu;
    uint s6 = 0x1f83d9abu;
    uint s7 = 0x5be0cd19u;
    
    // XOR header (assume 32 bytes = 8 uint)
    s0 ^= header_data[0];
    s1 ^= header_data[1];
    s2 ^= header_data[2];
    s3 ^= header_data[3];
    s4 ^= header_data[4];
    s5 ^= header_data[5];
    s6 ^= header_data[6];
    s7 ^= header_data[7];
    
    // Mix nonce
    s0 ^= nonce;
    s1 ^= (nonce >> 16);
    
    // Unrolled 12 compression rounds
    #pragma unroll
    for (int round = 0; round < 12; round++) {
        // Mix step
        s0 = mix(s0, s1, s2);
        s1 = mix(s1, s2, s3);
        s2 = mix(s2, s3, s4);
        s3 = mix(s3, s4, s5);
        s4 = mix(s4, s5, s6);
        s5 = mix(s5, s6, s7);
        s6 = mix(s6, s7, s0);
        s7 = mix(s7, s0, s1);
        
        // Diagonal swap
        uint t0 = s0; s0 = s4; s4 = t0;
        uint t1 = s1; s1 = s5; s5 = t1;
        uint t2 = s2; s2 = s6; s6 = t2;
        uint t3 = s3; s3 = s7; s7 = t3;
    }
    
    // XOR compression
    uint xor_mix = s0 ^ s1 ^ s2 ^ s3 ^ s4 ^ s5 ^ s6 ^ s7;
    s0 ^= xor_mix;
    s1 ^= xor_mix;
    s2 ^= xor_mix;
    s3 ^= xor_mix;
    s4 ^= xor_mix;
    s5 ^= xor_mix;
    s6 ^= xor_mix;
    s7 ^= xor_mix;
    
    // Golden ratio finalization
    s0 *= PHI;
    s1 *= PHI;
    s2 *= PHI;
    s3 *= PHI;
    s4 *= PHI;
    s5 *= PHI;
    s6 *= PHI;
    s7 *= PHI;
    
    // Write output
    __global uint *out = (__global uint*)(hash_output + gid * 32);
    out[0] = s0;
    out[1] = s1;
    out[2] = s2;
    out[3] = s3;
    out[4] = s4;
    out[5] = s5;
    out[6] = s6;
    out[7] = s7;
}

// Mining kernel with target check
__kernel __attribute__((reqd_work_group_size(256, 1, 1)))
void cosmic_harmony_v1_mine(
    __global const uint *header_data,
    const uint header_size,
    const uint nonce_start,
    const uint nonce_range,
    __global uchar *hash_output,
    __global uint *results,      // [0] = count, [1-16] = nonces
    __global const uint *target  // 8 uints (32 bytes)
) {
    const size_t gid = get_global_id(0);
    if (gid >= nonce_range) return;
    
    const uint nonce = nonce_start + (uint)gid;
    
    // Initialize and compute (same as benchmark)
    uint s0 = 0x6a09e667u ^ header_data[0] ^ nonce;
    uint s1 = 0xbb67ae85u ^ header_data[1] ^ (nonce >> 16);
    uint s2 = 0x3c6ef372u ^ header_data[2];
    uint s3 = 0xa54ff53au ^ header_data[3];
    uint s4 = 0x510e527fu ^ header_data[4];
    uint s5 = 0x9b05688cu ^ header_data[5];
    uint s6 = 0x1f83d9abu ^ header_data[6];
    uint s7 = 0x5be0cd19u ^ header_data[7];
    
    #pragma unroll
    for (int round = 0; round < 12; round++) {
        s0 = mix(s0, s1, s2);
        s1 = mix(s1, s2, s3);
        s2 = mix(s2, s3, s4);
        s3 = mix(s3, s4, s5);
        s4 = mix(s4, s5, s6);
        s5 = mix(s5, s6, s7);
        s6 = mix(s6, s7, s0);
        s7 = mix(s7, s0, s1);
        
        uint t0 = s0; s0 = s4; s4 = t0;
        uint t1 = s1; s1 = s5; s5 = t1;
        uint t2 = s2; s2 = s6; s6 = t2;
        uint t3 = s3; s3 = s7; s7 = t3;
    }
    
    uint xor_mix = s0 ^ s1 ^ s2 ^ s3 ^ s4 ^ s5 ^ s6 ^ s7;
    s0 = (s0 ^ xor_mix) * PHI;
    s1 = (s1 ^ xor_mix) * PHI;
    s2 = (s2 ^ xor_mix) * PHI;
    s3 = (s3 ^ xor_mix) * PHI;
    s4 = (s4 ^ xor_mix) * PHI;
    s5 = (s5 ^ xor_mix) * PHI;
    s6 = (s6 ^ xor_mix) * PHI;
    s7 = (s7 ^ xor_mix) * PHI;
    
    // Check target (big-endian compare)
    bool found = true;
    if (s7 > target[7]) found = false;
    else if (s7 == target[7]) {
        if (s6 > target[6]) found = false;
        else if (s6 == target[6]) {
            if (s5 > target[5]) found = false;
            else if (s5 == target[5]) {
                if (s4 > target[4]) found = false;
                // Continue for full 256-bit compare if needed
            }
        }
    }
    
    if (found) {
        uint idx = atomic_inc(&results[0]);
        if (idx < 16) {
            results[idx + 1] = nonce;
        }
    }
    
    // Write output
    __global uint *out = (__global uint*)(hash_output + gid * 32);
    out[0] = s0; out[1] = s1; out[2] = s2; out[3] = s3;
    out[4] = s4; out[5] = s5; out[6] = s6; out[7] = s7;
}

// Vectorized version - 4 hashes per work item
__kernel __attribute__((reqd_work_group_size(256, 1, 1)))
void cosmic_harmony_v1_vec4(
    __global const uint *header_data,
    const uint header_size,
    const uint nonce_start,
    const uint nonce_range,
    __global uchar *hash_output
) {
    const size_t gid = get_global_id(0);
    const uint base_nonce = nonce_start + (uint)(gid * 4);
    
    if (base_nonce + 3 >= nonce_start + nonce_range) return;
    
    // Load header once
    uint h0 = header_data[0], h1 = header_data[1], h2 = header_data[2], h3 = header_data[3];
    uint h4 = header_data[4], h5 = header_data[5], h6 = header_data[6], h7 = header_data[7];
    
    // Process 4 nonces
    #pragma unroll
    for (int n = 0; n < 4; n++) {
        uint nonce = base_nonce + n;
        
        uint s0 = 0x6a09e667u ^ h0 ^ nonce;
        uint s1 = 0xbb67ae85u ^ h1 ^ (nonce >> 16);
        uint s2 = 0x3c6ef372u ^ h2;
        uint s3 = 0xa54ff53au ^ h3;
        uint s4 = 0x510e527fu ^ h4;
        uint s5 = 0x9b05688cu ^ h5;
        uint s6 = 0x1f83d9abu ^ h6;
        uint s7 = 0x5be0cd19u ^ h7;
        
        #pragma unroll
        for (int round = 0; round < 12; round++) {
            s0 = mix(s0, s1, s2); s1 = mix(s1, s2, s3);
            s2 = mix(s2, s3, s4); s3 = mix(s3, s4, s5);
            s4 = mix(s4, s5, s6); s5 = mix(s5, s6, s7);
            s6 = mix(s6, s7, s0); s7 = mix(s7, s0, s1);
            
            uint t0 = s0; s0 = s4; s4 = t0;
            uint t1 = s1; s1 = s5; s5 = t1;
            uint t2 = s2; s2 = s6; s6 = t2;
            uint t3 = s3; s3 = s7; s7 = t3;
        }
        
        uint xor_mix = s0 ^ s1 ^ s2 ^ s3 ^ s4 ^ s5 ^ s6 ^ s7;
        s0 = (s0 ^ xor_mix) * PHI; s1 = (s1 ^ xor_mix) * PHI;
        s2 = (s2 ^ xor_mix) * PHI; s3 = (s3 ^ xor_mix) * PHI;
        s4 = (s4 ^ xor_mix) * PHI; s5 = (s5 ^ xor_mix) * PHI;
        s6 = (s6 ^ xor_mix) * PHI; s7 = (s7 ^ xor_mix) * PHI;
        
        __global uint *out = (__global uint*)(hash_output + (gid * 4 + n) * 32);
        out[0] = s0; out[1] = s1; out[2] = s2; out[3] = s3;
        out[4] = s4; out[5] = s5; out[6] = s6; out[7] = s7;
    }
}
"""


@dataclass
class GPUBufferSet:
    """Buffer set for pipelined GPU operations."""
    header: cl.Buffer
    output: cl.Buffer
    results: cl.Buffer
    target: cl.Buffer
    h_output: np.ndarray
    h_output_pinned: cl.Buffer = None


class CosmicHarmonyV1Turbo:
    """
    Ultra-optimized GPU miner for Cosmic Harmony v1.
    
    Since v1 is NOT memory-hard, we can achieve much higher hashrates
    by maximizing GPU compute utilization with massive batch sizes.
    """
    
    def __init__(
        self,
        batch_size: int = 0,  # 0 = auto-detect (millions)
        platform_idx: int = 0,
        device_idx: int = 0,
        use_pinned_memory: bool = True,
        num_buffers: int = 3,  # Triple buffering
        use_vec4: bool = False,  # Use vectorized kernel
        verbose: bool = True
    ):
        if not GPU_AVAILABLE:
            raise RuntimeError("PyOpenCL not available")
        
        self._verbose = verbose
        self._use_pinned = use_pinned_memory
        self._num_buffers = num_buffers
        self._use_vec4 = use_vec4
        self._available = False
        
        # Get platform and device
        platforms = cl.get_platforms()
        if not platforms:
            raise RuntimeError("No OpenCL platforms found")
        
        self.platform = platforms[min(platform_idx, len(platforms) - 1)]
        devices = self.platform.get_devices()
        if not devices:
            raise RuntimeError("No OpenCL devices found")
        
        self.device = devices[min(device_idx, len(devices) - 1)]
        
        # Get device info
        self.global_mem = self.device.global_mem_size
        self.max_alloc = self.device.max_mem_alloc_size
        self.compute_units = self.device.max_compute_units
        
        if self._verbose:
            print(f"[GPU-TURBO] {self.device.name}")
            print(f"   Platform: {self.platform.name}")
            print(f"   Global Memory: {self.global_mem / 1024**3:.2f} GB")
            print(f"   Max Allocation: {self.max_alloc / 1024**3:.2f} GB")
            print(f"   Compute Units: {self.compute_units}")
        
        # Calculate optimal batch size
        # V1 uses only 32 bytes output per hash, no scratchpad!
        bytes_per_hash = 32  # Just output
        
        if batch_size == 0:
            # Use 50% of max allocation for output buffer
            # Can fit MILLIONS of hashes
            usable_mem = min(self.max_alloc * 0.5, self.global_mem * 0.7)
            batch_size = int(usable_mem / bytes_per_hash)
        
        # Round to multiple of 256 * 1024 for efficiency
        batch_size = (batch_size // (256 * 1024)) * (256 * 1024)
        if batch_size < 1024 * 1024:  # Minimum 1M
            batch_size = 1024 * 1024
        
        # Split for multi-buffering
        self.batch_size = batch_size // self._num_buffers
        # Ensure divisible by 256 (work group size)
        self.batch_size = (self.batch_size // 256) * 256
        self.total_batch = self.batch_size * self._num_buffers
        
        if self._verbose:
            print(f"   Batch Size: {self.batch_size:,} ({self.batch_size/1e6:.1f}M)")
            print(f"   Total Pipeline: {self.total_batch:,} ({self.total_batch/1e6:.1f}M)")
            print(f"   Output Buffer: {self.batch_size * 32 / 1024**2:.1f} MB per buffer")
            print(f"   Buffers: {self._num_buffers} (pipeline)")
            print(f"   Pinned Memory: {'Enabled' if self._use_pinned else 'Disabled'}")
            print(f"   Vectorized (4x): {'Enabled' if self._use_vec4 else 'Disabled'}")
        
        # Create context and queues
        self.ctx = cl.Context([self.device])
        
        # Multiple queues for async operations
        self.queues = [
            cl.CommandQueue(self.ctx, properties=cl.command_queue_properties.PROFILING_ENABLE)
            for _ in range(self._num_buffers)
        ]
        
        # Build kernel with aggressive optimizations
        build_opts = [
            "-cl-fast-relaxed-math",
            "-cl-mad-enable",
            "-cl-no-signed-zeros",
            "-cl-unsafe-math-optimizations",
            "-cl-finite-math-only"
        ]
        
        try:
            self.program = cl.Program(self.ctx, COSMIC_HARMONY_V1_TURBO_KERNEL).build(
                options=" ".join(build_opts)
            )
            self.kernel_benchmark = self.program.cosmic_harmony_v1_benchmark
            self.kernel_mine = self.program.cosmic_harmony_v1_mine
            self.kernel_vec4 = self.program.cosmic_harmony_v1_vec4
            if self._verbose:
                print("   [OK] Kernels compiled")
        except cl.RuntimeError as e:
            print(f"   [FAIL] Kernel compilation failed: {e}")
            raise
        
        # Get work group info
        max_wg_size = self.kernel_benchmark.get_work_group_info(
            cl.kernel_work_group_info.WORK_GROUP_SIZE, self.device
        )
        self.work_group_size = min(256, max_wg_size)
        if self._verbose:
            print(f"   Work Group Size: {self.work_group_size}")
        
        # Create buffer sets
        self.buffer_sets: List[GPUBufferSet] = []
        for i in range(self._num_buffers):
            buf_set = self._create_buffer_set(i)
            self.buffer_sets.append(buf_set)
        
        if self._verbose:
            print(f"   [OK] {self._num_buffers} buffer set(s) allocated")
        
        self._available = True
        self._current_buffer = 0
    
    def _create_buffer_set(self, idx: int) -> GPUBufferSet:
        """Create a buffer set for pipelining."""
        mf = cl.mem_flags
        
        # Header buffer (32 bytes)
        d_header = cl.Buffer(self.ctx, mf.READ_ONLY, size=32)
        
        # Output buffer (32 bytes per hash)
        d_output = cl.Buffer(
            self.ctx, mf.WRITE_ONLY,
            size=self.batch_size * 32
        )
        
        # Results buffer for mining
        d_results = cl.Buffer(self.ctx, mf.READ_WRITE, size=68)  # 17 uints
        
        # Target buffer
        d_target = cl.Buffer(self.ctx, mf.READ_ONLY, size=32)
        
        # Host-side pinned buffer
        h_output_pinned = None
        if self._use_pinned:
            try:
                h_output_pinned = cl.Buffer(
                    self.ctx,
                    mf.ALLOC_HOST_PTR | mf.READ_WRITE,
                    size=self.batch_size * 32
                )
                h_output, _ = cl.enqueue_map_buffer(
                    self.queues[idx],
                    h_output_pinned,
                    cl.map_flags.READ | cl.map_flags.WRITE,
                    0,
                    (self.batch_size * 8,),
                    dtype=np.uint32,
                    is_blocking=True
                )
            except Exception as e:
                if self._verbose:
                    print(f"   [WARN] Buffer {idx} pinned memory failed: {e}")
                h_output = np.zeros(self.batch_size * 8, dtype=np.uint32)
                h_output_pinned = None
        else:
            h_output = np.zeros(self.batch_size * 8, dtype=np.uint32)
        
        return GPUBufferSet(
            header=d_header,
            output=d_output,
            results=d_results,
            target=d_target,
            h_output=h_output,
            h_output_pinned=h_output_pinned
        )
    
    def is_available(self) -> bool:
        return self._available
    
    @property
    def device_name(self) -> str:
        return self.device.name if hasattr(self, 'device') else "Unknown"
    
    def benchmark(self, duration: float = 30.0) -> float:
        """Run benchmark and return hashrate in H/s."""
        print(f"\n{'='*60}")
        print("Cosmic Harmony v1 - TURBO GPU Benchmark")
        print(f"{'='*60}")
        print(f"Batch size: {self.batch_size:,} ({self.batch_size/1e6:.1f}M)")
        print(f"Buffers: {self._num_buffers}")
        print(f"Duration: {duration}s\n")
        
        # Test header
        header = np.zeros(8, dtype=np.uint32)
        header[0] = 0x12345678
        header[1] = 0xDEADBEEF
        header[2] = 0xCAFEBABE
        
        # Upload header to all buffers
        for i, buf_set in enumerate(self.buffer_sets):
            cl.enqueue_copy(self.queues[i], buf_set.header, header)
        
        for q in self.queues:
            q.finish()
        
        # Warmup
        print(">>> Warming up GPU...")
        warmup_batch = min(256 * 1024, self.batch_size)
        global_size = (warmup_batch,)
        local_size = (self.work_group_size,)
        
        buf = self.buffer_sets[0]
        self.kernel_benchmark(
            self.queues[0],
            global_size,
            local_size,
            buf.header,
            np.uint32(32),
            np.uint32(0),
            np.uint32(warmup_batch),
            buf.output
        )
        self.queues[0].finish()
        print("   Warmup complete\n")
        
        # Benchmark with pipelining
        print(">>> Running benchmark (pipelined)...")
        
        total_hashes = 0
        nonce = 0
        start = time.perf_counter()
        last_update = start
        
        batch = self.batch_size
        global_size = (batch,)
        local_size = (self.work_group_size,)
        
        # Start all buffers
        events = []
        for i in range(self._num_buffers):
            buf = self.buffer_sets[i]
            evt = self.kernel_benchmark(
                self.queues[i],
                global_size,
                local_size,
                buf.header,
                np.uint32(32),
                np.uint32(nonce),
                np.uint32(batch),
                buf.output
            )
            events.append(evt)
            nonce += batch
        
        # Pipeline loop
        current_buf = 0
        while time.perf_counter() - start < duration:
            # Wait for current buffer to finish
            events[current_buf].wait()
            total_hashes += batch
            
            # Get kernel time
            try:
                kernel_time = (events[current_buf].profile.end - events[current_buf].profile.start) / 1e6
            except:
                kernel_time = 0
            
            # Start new work on this buffer (wrap nonce to 32-bit)
            nonce_32 = np.uint32(nonce & 0xFFFFFFFF)
            buf = self.buffer_sets[current_buf]
            events[current_buf] = self.kernel_benchmark(
                self.queues[current_buf],
                global_size,
                local_size,
                buf.header,
                np.uint32(32),
                nonce_32,
                np.uint32(batch),
                buf.output
            )
            nonce += batch
            
            # Move to next buffer
            current_buf = (current_buf + 1) % self._num_buffers
            
            # Stats
            now = time.perf_counter()
            elapsed = now - start
            if now - last_update >= 0.5:
                hashrate = total_hashes / elapsed
                print(f"   [{elapsed:.1f}s] {hashrate/1e6:.2f} MH/s | {total_hashes/1e6:.1f}M hashes | {kernel_time:.1f}ms/batch")
                last_update = now
        
        # Wait for all pending
        for evt in events:
            evt.wait()
            total_hashes += batch
        
        elapsed = time.perf_counter() - start
        hashrate = total_hashes / elapsed
        
        print(f"\n{'='*60}")
        print(f"[OK] Benchmark complete!")
        print(f"   Total hashes: {total_hashes:,}")
        print(f"   Time: {elapsed:.2f}s")
        print(f"   Hashrate: {hashrate/1e6:.2f} MH/s")
        print(f"   Hashrate: {hashrate/1e9:.3f} GH/s")
        print(f"{'='*60}")
        
        return hashrate
    
    def hash_batch(
        self,
        header: bytes,
        nonce_start: int,
        batch_size: Optional[int] = None
    ) -> np.ndarray:
        """Compute hashes for a batch of nonces."""
        if batch_size is None:
            batch_size = self.batch_size
        
        batch_size = min(batch_size, self.batch_size)
        
        header_arr = np.frombuffer(header.ljust(32, b'\x00')[:32], dtype=np.uint32)
        
        buf = self.buffer_sets[self._current_buffer]
        queue = self.queues[self._current_buffer]
        
        cl.enqueue_copy(queue, buf.header, header_arr)
        
        global_size = (batch_size,)
        local_size = (self.work_group_size,)
        
        evt = self.kernel_benchmark(
            queue,
            global_size,
            local_size,
            buf.header,
            np.uint32(32),
            np.uint32(nonce_start),
            np.uint32(batch_size),
            buf.output
        )
        evt.wait()
        
        cl.enqueue_copy(queue, buf.h_output[:batch_size * 8], buf.output)
        queue.finish()
        
        self._current_buffer = (self._current_buffer + 1) % self._num_buffers
        
        return buf.h_output[:batch_size * 8].view(np.uint8).reshape(batch_size, 32)
    
    def hash_single(self, data: bytes, nonce: int) -> bytes:
        """Hash single nonce."""
        results = self.hash_batch(data, nonce, 1)
        return results[0].tobytes()


def compare_batch_sizes():
    """Compare performance with different batch sizes."""
    if not GPU_AVAILABLE:
        print("[FAIL] PyOpenCL not available")
        return
    
    print("="*70)
    print("Cosmic Harmony v1 - Batch Size Comparison")
    print("="*70)
    
    duration = 10.0
    results = []
    
    batch_sizes = [
        1_000_000,    # 1M
        5_000_000,    # 5M
        10_000_000,   # 10M
        20_000_000,   # 20M
        50_000_000,   # 50M
    ]
    
    for batch in batch_sizes:
        print(f"\n[Testing batch size: {batch:,} ({batch/1e6:.0f}M)]")
        try:
            gpu = CosmicHarmonyV1Turbo(
                batch_size=batch,
                use_pinned_memory=True,
                num_buffers=3,
                verbose=False
            )
            rate = gpu.benchmark(duration)
            results.append((batch, rate))
        except Exception as e:
            print(f"[FAIL] {e}")
            results.append((batch, 0))
    
    # Summary
    print("\n" + "="*70)
    print("SUMMARY")
    print("="*70)
    print(f"{'Batch Size':>15} {'Hashrate':>15} {'Per Batch':>12}")
    print("-"*70)
    
    best_rate = 0
    best_batch = 0
    for batch, rate in results:
        if rate > best_rate:
            best_rate = rate
            best_batch = batch
        batch_str = f"{batch/1e6:.0f}M"
        rate_str = f"{rate/1e6:.2f} MH/s" if rate > 0 else "FAILED"
        batch_time = f"{batch/rate*1000:.1f}ms" if rate > 0 else "-"
        print(f"{batch_str:>15} {rate_str:>15} {batch_time:>12}")
    
    print("-"*70)
    print(f"Best: {best_batch/1e6:.0f}M batch = {best_rate/1e6:.2f} MH/s")
    print("="*70)


def main():
    """Run turbo GPU benchmark."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Cosmic Harmony v1 TURBO GPU Miner")
    parser.add_argument('--benchmark', '-b', action='store_true', help='Run benchmark')
    parser.add_argument('--compare', '-c', action='store_true', help='Compare batch sizes')
    parser.add_argument('--duration', '-d', type=float, default=30.0, help='Duration')
    parser.add_argument('--batch', type=int, default=0, help='Batch size (0=auto)')
    parser.add_argument('--buffers', type=int, default=3, help='Number of buffers')
    parser.add_argument('--no-pinned', action='store_true', help='Disable pinned memory')
    args = parser.parse_args()
    
    if not GPU_AVAILABLE:
        print("[FAIL] PyOpenCL not available")
        return
    
    if args.compare:
        compare_batch_sizes()
    elif args.benchmark:
        gpu = CosmicHarmonyV1Turbo(
            batch_size=args.batch,
            use_pinned_memory=not args.no_pinned,
            num_buffers=args.buffers
        )
        gpu.benchmark(args.duration)
    else:
        # Default: quick benchmark with auto settings
        gpu = CosmicHarmonyV1Turbo(batch_size=0)
        gpu.benchmark(15.0)


if __name__ == "__main__":
    main()
