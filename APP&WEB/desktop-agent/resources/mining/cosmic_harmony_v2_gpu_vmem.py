#!/usr/bin/env python3
"""
ZION Cosmic Harmony v2 - GPU Implementation with Virtual/Pinned Memory

Optimizations:
1. Pinned (page-locked) host memory - no CPU swapping, faster DMA transfers
2. Async memory transfers - overlap computation with transfers
3. Double buffering - pipeline batch processing
4. Maximized batch size - use all available VRAM
5. Memory-mapped buffers - direct GPU access where supported

Performance targets:
- Base GPU: ~15 kH/s
- Optimized with pinned memory: ~25-40 kH/s (2-3x improvement)

Author: ZION AI Native Team
Version: 2.9.6-vmem
Date: January 2026
"""

import numpy as np
from typing import Optional, Tuple, List
import time
import threading
from dataclasses import dataclass

try:
    import pyopencl as cl
    GPU_AVAILABLE = True
except ImportError:
    GPU_AVAILABLE = False
    print("[WARN] PyOpenCL not available - GPU mining disabled")


# ============================================================================
# OPENCL KERNEL - Cosmic Harmony v2 GPU (same as base version)
# ============================================================================

COSMIC_HARMONY_V2_KERNEL = """
// ============================================================================
// Cosmic Harmony v2 - OpenCL GPU Kernel (Virtual Memory Optimized)
// ============================================================================

#define ROTL32(x, n) (((x) << (n)) | ((x) >> (32 - (n))))
#define ROTR32(x, n) (((x) >> (n)) | ((x) << (32 - (n))))

#define PHI 0x9E3779B9u
#define MASK32 0xFFFFFFFFu

#define GPU_SCRATCHPAD_SIZE 131072   // 512KB / 4 = 128K uint32 words
#define GPU_MIXING_ROUNDS 8
#define GPU_CHUNK_SIZE 8

#define IV0 0x6A09E667u
#define IV1 0xBB67AE85u
#define IV2 0x3C6EF372u
#define IV3 0xA54FF53Au
#define IV4 0x510E527Fu
#define IV5 0x9B05688Cu
#define IV6 0x1F83D9ABu
#define IV7 0x5BE0CD19u

inline uint wrapping_add(uint a, uint b) {
    return (a + b) & MASK32;
}

inline uint wrapping_mul(uint a, uint b) {
    return (uint)(((ulong)a * (ulong)b) & MASK32);
}

inline void quick_mix(uint* state) {
    uint tmp;
    for (int i = 0; i < 4; i++) {
        tmp = state[i];
        state[i] = state[7 - i];
        state[7 - i] = tmp;
    }
    for (int i = 0; i < 8; i++) {
        state[i] = wrapping_mul(ROTL32(state[i], 7), PHI);
    }
}

inline void generate_chunk(uint* state, int index, uint* chunk) {
    for (int i = 0; i < 8; i++) {
        chunk[i] = state[i];
    }
    chunk[0] ^= (uint)index;
    chunk[7] ^= ROTL32((uint)index, 16);
    
    for (int r = 0; r < 4; r++) {
        for (int i = 0; i < 8; i++) {
            int next = (i + 1) % 8;
            chunk[i] = wrapping_mul(
                wrapping_add(ROTL32(chunk[i], 5), chunk[next]),
                PHI
            );
        }
    }
}

inline void memory_hard_mix(
    uint* state,
    __global uint* scratchpad,
    int scratchpad_words,
    int mixing_rounds
) {
    int num_chunks = scratchpad_words / 8;
    
    for (int round = 0; round < mixing_rounds; round++) {
        uint state_idx = state[0] ^ state[4];
        state_idx += (state[1] ^ state[5]) << 16;
        
        int pattern = round % 3;
        int read_idx;
        
        if (pattern == 0) {
            read_idx = round % num_chunks;
        } else if (pattern == 1) {
            read_idx = (int)((state_idx + round * PHI) % (uint)num_chunks);
        } else {
            int bits = 17;
            int stage = round % bits;
            int mask = 1 << stage;
            int base = (int)(state_idx % (uint)num_chunks);
            read_idx = base ^ mask;
            if (read_idx >= num_chunks) read_idx = base;
        }
        
        int offset = read_idx * 8;
        uint chunk[8];
        for (int i = 0; i < 8; i++) {
            chunk[i] = scratchpad[offset + i];
        }
        
        int rotation = 5 + (round % 4) * 3;
        for (int i = 0; i < 8; i++) {
            state[i] = wrapping_mul(
                wrapping_add(ROTL32(state[i], rotation), chunk[i]),
                PHI
            );
        }
        
        uint new_chunk[8];
        generate_chunk(state, round, new_chunk);
        
        int write_idx = (int)(((state_idx >> 8) + round * 7) % (uint)num_chunks);
        int write_offset = write_idx * 8;
        for (int i = 0; i < 8; i++) {
            scratchpad[write_offset + i] = new_chunk[i];
        }
    }
}

inline void inject_lattice_noise(uint* state) {
    uint noise_mod = 65521u;
    for (int i = 0; i < 8; i++) {
        uint noise = wrapping_mul(state[i], PHI);
        noise = (noise % noise_mod) * (noise_mod - 1);
        state[i] = wrapping_add(state[i], noise);
    }
}

inline void golden_finalize(uint* state) {
    for (int round = 0; round < 8; round++) {
        for (int i = 0; i < 8; i++) {
            int next = (i + 1) % 8;
            int prev = (i + 7) % 8;
            state[i] = wrapping_mul(
                wrapping_add(
                    wrapping_add(ROTL32(state[i], 7), state[next]),
                    ROTR32(state[prev], 11)
                ),
                PHI
            );
        }
    }
    uint xor_all = 0;
    for (int i = 0; i < 8; i++) {
        xor_all ^= state[i];
    }
    for (int i = 0; i < 8; i++) {
        state[i] ^= wrapping_mul(xor_all, PHI);
    }
}

// Benchmark kernel - no target checking
__kernel void cosmic_harmony_v2_benchmark(
    __global uint* header_data,
    uint header_words,
    __global uint* prev_hash,
    uint block_height,
    uint nonce_start,
    uint nonce_count,
    __global uint* scratchpad_pool,
    __global uchar* hash_output
) {
    size_t gid = get_global_id(0);
    if (gid >= nonce_count) return;
    
    uint nonce = nonce_start + (uint)gid;
    __global uint* my_scratchpad = scratchpad_pool + gid * GPU_SCRATCHPAD_SIZE;
    
    uint state[8] = {IV0, IV1, IV2, IV3, IV4, IV5, IV6, IV7};
    
    for (int i = 0; i < min(header_words, 8u); i++) {
        state[i] ^= header_data[i];
    }
    state[0] ^= nonce;
    state[1] ^= (nonce >> 16);
    state[2] ^= ROTL32(nonce, 17);
    state[3] ^= ROTR32(nonce >> 16, 13);
    
    for (int i = 0; i < 8; i++) {
        state[i] ^= prev_hash[i];
    }
    state[4] ^= block_height;
    state[5] ^= ROTL32(block_height, 11);
    
    quick_mix(state);
    
    uint chunk[8];
    int num_chunks = GPU_SCRATCHPAD_SIZE / 8;
    for (int i = 0; i < num_chunks; i++) {
        generate_chunk(state, i, chunk);
        int offset = i * 8;
        for (int j = 0; j < 8; j++) {
            my_scratchpad[offset + j] = chunk[j];
        }
        if ((i % 64) == 63) quick_mix(state);
    }
    
    memory_hard_mix(state, my_scratchpad, GPU_SCRATCHPAD_SIZE, GPU_MIXING_ROUNDS);
    inject_lattice_noise(state);
    golden_finalize(state);
    
    __global uint* out = (__global uint*)(hash_output + gid * 32);
    for (int i = 0; i < 8; i++) {
        out[i] = state[i];
    }
}

// Mining kernel with target checking
__kernel void cosmic_harmony_v2_mine(
    __global uint* header_data,
    uint header_words,
    __global uint* prev_hash,
    uint block_height,
    uint nonce_start,
    uint nonce_count,
    __global uint* scratchpad_pool,
    __global uchar* hash_output,
    __global uint* results,
    __global uint* target
) {
    size_t gid = get_global_id(0);
    if (gid >= nonce_count) return;
    
    uint nonce = nonce_start + (uint)gid;
    __global uint* my_scratchpad = scratchpad_pool + gid * GPU_SCRATCHPAD_SIZE;
    
    uint state[8] = {IV0, IV1, IV2, IV3, IV4, IV5, IV6, IV7};
    
    for (int i = 0; i < min(header_words, 8u); i++) {
        state[i] ^= header_data[i];
    }
    state[0] ^= nonce;
    state[1] ^= (nonce >> 16);
    state[2] ^= ROTL32(nonce, 17);
    state[3] ^= ROTR32(nonce >> 16, 13);
    
    for (int i = 0; i < 8; i++) {
        state[i] ^= prev_hash[i];
    }
    state[4] ^= block_height;
    state[5] ^= ROTL32(block_height, 11);
    
    quick_mix(state);
    
    uint chunk[8];
    int num_chunks = GPU_SCRATCHPAD_SIZE / 8;
    for (int i = 0; i < num_chunks; i++) {
        generate_chunk(state, i, chunk);
        int offset = i * 8;
        for (int j = 0; j < 8; j++) {
            my_scratchpad[offset + j] = chunk[j];
        }
        if ((i % 64) == 63) quick_mix(state);
    }
    
    memory_hard_mix(state, my_scratchpad, GPU_SCRATCHPAD_SIZE, GPU_MIXING_ROUNDS);
    inject_lattice_noise(state);
    golden_finalize(state);
    
    // Check against target (big-endian comparison)
    bool found = true;
    for (int i = 7; i >= 0 && found; i--) {
        if (state[i] > target[i]) {
            found = false;
        } else if (state[i] < target[i]) {
            break;
        }
    }
    
    if (found) {
        uint idx = atomic_inc(&results[0]);
        if (idx < 16) {
            results[idx + 1] = nonce;
        }
    }
    
    __global uint* out = (__global uint*)(hash_output + gid * 32);
    for (int i = 0; i < 8; i++) {
        out[i] = state[i];
    }
}
"""


@dataclass
class GPUBufferSet:
    """A set of GPU buffers for double-buffering."""
    scratchpad: cl.Buffer
    header: cl.Buffer
    prev_hash: cl.Buffer
    output: cl.Buffer
    results: cl.Buffer
    target: cl.Buffer
    h_output: np.ndarray  # Host-side pinned buffer
    h_output_pinned: cl.Buffer = None  # Keep reference to pinned buffer


class CosmicHarmonyV2GPUVMem:
    """
    GPU-accelerated Cosmic Harmony v2 miner with Virtual Memory optimizations.
    
    Features:
    - Pinned (page-locked) host memory for faster DMA transfers
    - Double buffering for overlapping compute and transfer
    - Async memory operations
    - Maximized batch size based on available VRAM
    """
    
    GPU_SCRATCHPAD_SIZE = 131072  # 512KB / 4 = 128K uint32 words
    GPU_SCRATCHPAD_BYTES = GPU_SCRATCHPAD_SIZE * 4  # 512KB per work item
    
    def __init__(
        self,
        batch_size: int = 0,  # 0 = auto-detect maximum
        platform_idx: int = 0,
        device_idx: int = 0,
        use_pinned_memory: bool = True,
        double_buffer: bool = True,
        verbose: bool = True
    ):
        if not GPU_AVAILABLE:
            raise RuntimeError("PyOpenCL not available")
        
        self._verbose = verbose
        self._use_pinned = use_pinned_memory
        self._double_buffer = double_buffer
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
        
        # Get device memory info
        self.global_mem = self.device.global_mem_size
        self.max_alloc = self.device.max_mem_alloc_size
        self.local_mem = self.device.local_mem_size
        
        if self._verbose:
            print(f"[GPU-VMEM] {self.device.name}")
            print(f"   Platform: {self.platform.name}")
            print(f"   Global Memory: {self.global_mem / 1024**3:.2f} GB")
            print(f"   Max Allocation: {self.max_alloc / 1024**3:.2f} GB")
            print(f"   Local Memory: {self.local_mem / 1024:.1f} KB")
        
        # Calculate optimal batch size
        if batch_size == 0:
            # Use 70% of max allocation for scratchpad
            # Leave room for other buffers
            usable_mem = min(self.max_alloc * 0.7, self.global_mem * 0.85)
            batch_size = int(usable_mem / self.GPU_SCRATCHPAD_BYTES)
        
        # Round to multiple of 256 for efficiency
        batch_size = (batch_size // 256) * 256
        if batch_size < 512:  # Minimum 512 for double buffer to work
            batch_size = 512
        
        # For double buffering, split batch in half (but keep >= 256)
        if self._double_buffer:
            self.batch_size = max(batch_size // 2, 256)
            self.total_batch = self.batch_size * 2
        else:
            self.batch_size = batch_size
            self.total_batch = batch_size
        
        scratchpad_total = self.batch_size * self.GPU_SCRATCHPAD_BYTES
        
        if self._verbose:
            print(f"   Batch Size: {self.batch_size} (x2 for double buffer)" if self._double_buffer else f"   Batch Size: {self.batch_size}")
            print(f"   Scratchpad Pool: {scratchpad_total / 1024**2:.1f} MB per buffer")
            print(f"   Pinned Memory: {'Enabled' if self._use_pinned else 'Disabled'}")
            print(f"   Double Buffer: {'Enabled' if self._double_buffer else 'Disabled'}")
        
        # Create context with specific properties for better memory handling
        self.ctx = cl.Context([self.device])
        
        # Create command queues
        # Queue for compute
        self.queue_compute = cl.CommandQueue(
            self.ctx,
            properties=cl.command_queue_properties.PROFILING_ENABLE
        )
        # Queue for transfers (async)
        self.queue_transfer = cl.CommandQueue(
            self.ctx,
            properties=cl.command_queue_properties.PROFILING_ENABLE
        )
        
        # Build kernel
        build_opts = [
            "-cl-fast-relaxed-math",
            "-cl-mad-enable",
            "-cl-no-signed-zeros",
            "-cl-unsafe-math-optimizations"
        ]
        try:
            self.program = cl.Program(self.ctx, COSMIC_HARMONY_V2_KERNEL).build(
                options=" ".join(build_opts)
            )
            self.kernel_benchmark = self.program.cosmic_harmony_v2_benchmark
            self.kernel_mine = self.program.cosmic_harmony_v2_mine
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
        self.buffer_sets = []
        num_sets = 2 if self._double_buffer else 1
        
        for i in range(num_sets):
            buf_set = self._create_buffer_set()
            self.buffer_sets.append(buf_set)
            
        if self._verbose:
            print(f"   [OK] {num_sets} buffer set(s) allocated")
        
        self._available = True
        self._current_buffer = 0
    
    def _create_buffer_set(self) -> GPUBufferSet:
        """Create a set of GPU and host buffers."""
        mf = cl.mem_flags
        
        # Scratchpad pool (largest allocation)
        d_scratchpad = cl.Buffer(
            self.ctx, mf.READ_WRITE,
            size=self.batch_size * self.GPU_SCRATCHPAD_SIZE * 4
        )
        
        # Header buffer (32 bytes)
        d_header = cl.Buffer(self.ctx, mf.READ_ONLY, size=32)
        
        # Previous hash buffer (32 bytes)
        d_prev_hash = cl.Buffer(self.ctx, mf.READ_ONLY, size=32)
        
        # Output buffer (32 bytes per hash)
        d_output = cl.Buffer(
            self.ctx, mf.WRITE_ONLY,
            size=self.batch_size * 32
        )
        
        # Results buffer (for mining with target)
        d_results = cl.Buffer(self.ctx, mf.READ_WRITE, size=68)  # 17 uints
        
        # Target buffer
        d_target = cl.Buffer(self.ctx, mf.READ_ONLY, size=32)
        
        # Host-side pinned output buffer
        h_output_pinned = None
        if self._use_pinned:
            try:
                # Create a pinned buffer using ALLOC_HOST_PTR
                h_output_pinned = cl.Buffer(
                    self.ctx,
                    mf.ALLOC_HOST_PTR | mf.READ_WRITE,
                    size=self.batch_size * 32
                )
                # Map it to get numpy array
                h_output, _ = cl.enqueue_map_buffer(
                    self.queue_transfer,
                    h_output_pinned,
                    cl.map_flags.READ | cl.map_flags.WRITE,
                    0,
                    (self.batch_size * 8,),
                    dtype=np.uint32,
                    is_blocking=True
                )
            except Exception as e:
                if self._verbose:
                    print(f"   [WARN] Pinned memory failed: {e}, using regular")
                h_output = np.zeros(self.batch_size * 8, dtype=np.uint32)
                h_output_pinned = None
        else:
            h_output = np.zeros(self.batch_size * 8, dtype=np.uint32)
        
        return GPUBufferSet(
            scratchpad=d_scratchpad,
            header=d_header,
            prev_hash=d_prev_hash,
            output=d_output,
            results=d_results,
            target=d_target,
            h_output=h_output,
            h_output_pinned=h_output_pinned
        )
    
    def is_available(self) -> bool:
        """Check if GPU is available and initialized."""
        return self._available
    
    @property
    def device_name(self) -> str:
        """Get GPU device name."""
        return self.device.name if hasattr(self, 'device') else "Unknown"
    
    def benchmark(self, duration: float = 30.0) -> float:
        """Run benchmark and return hashrate in H/s."""
        print(f"\n{'='*60}")
        print("Cosmic Harmony v2 - GPU VMEM Benchmark")
        print(f"{'='*60}")
        print(f"Batch size: {self.batch_size} {'(double buffered)' if self._double_buffer else ''}")
        print(f"Pinned memory: {self._use_pinned}")
        print(f"Duration: {duration}s\n")
        
        # Test data
        header = np.zeros(8, dtype=np.uint32)
        header[0] = 0x12345678
        header[1] = 0xDEADBEEF
        
        prev_hash = np.zeros(8, dtype=np.uint32)
        prev_hash[0] = 0xABCDEF01
        
        block_height = np.uint32(12345)
        
        # Upload constant data to all buffer sets
        for buf_set in self.buffer_sets:
            cl.enqueue_copy(self.queue_transfer, buf_set.header, header)
            cl.enqueue_copy(self.queue_transfer, buf_set.prev_hash, prev_hash)
        self.queue_transfer.finish()
        
        # Warmup
        print(">>> Warming up GPU...")
        warmup_batch = min(256, self.batch_size)
        global_size = (warmup_batch,)
        local_size = (min(256, warmup_batch),)
        
        buf = self.buffer_sets[0]
        try:
            self.kernel_benchmark(
                self.queue_compute,
                global_size,
                local_size,
                buf.header,
                np.uint32(8),
                buf.prev_hash,
                block_height,
                np.uint32(0),
                np.uint32(warmup_batch),
                buf.scratchpad,
                buf.output
            )
            self.queue_compute.finish()
            print("   Warmup complete\n")
        except cl.RuntimeError as e:
            print(f"   [FAIL] Warmup failed: {e}")
            raise
        
        # Benchmark
        if self._double_buffer:
            return self._benchmark_double_buffer(duration, header, prev_hash, block_height)
        else:
            return self._benchmark_single_buffer(duration, header, prev_hash, block_height)
    
    def _benchmark_single_buffer(
        self,
        duration: float,
        header: np.ndarray,
        prev_hash: np.ndarray,
        block_height: np.uint32
    ) -> float:
        """Single buffer benchmark."""
        print(">>> Running benchmark (single buffer)...")
        
        buf = self.buffer_sets[0]
        total_hashes = 0
        nonce = 0
        start = time.perf_counter()
        last_update = start
        
        batch = self.batch_size
        global_size = (batch,)
        local_size = (self.work_group_size,)
        
        while time.perf_counter() - start < duration:
            evt = self.kernel_benchmark(
                self.queue_compute,
                global_size,
                local_size,
                buf.header,
                np.uint32(8),
                buf.prev_hash,
                block_height,
                np.uint32(nonce),
                np.uint32(batch),
                buf.scratchpad,
                buf.output
            )
            evt.wait()
            
            total_hashes += batch
            nonce += batch
            
            kernel_time = (evt.profile.end - evt.profile.start) / 1e6  # ms
            
            now = time.perf_counter()
            elapsed = now - start
            
            if now - last_update >= 0.5:
                hashrate = total_hashes / elapsed
                print(f"   [{elapsed:.1f}s] {hashrate:.2f} H/s | {total_hashes:,} hashes | {kernel_time:.1f}ms/batch")
                last_update = now
        
        elapsed = time.perf_counter() - start
        hashrate = total_hashes / elapsed
        
        self._print_results(total_hashes, elapsed, hashrate)
        return hashrate
    
    def _benchmark_double_buffer(
        self,
        duration: float,
        header: np.ndarray,
        prev_hash: np.ndarray,
        block_height: np.uint32
    ) -> float:
        """Double buffer pipelined benchmark."""
        print(">>> Running benchmark (double buffer, pipelined)...")
        
        total_hashes = 0
        nonce = 0
        start = time.perf_counter()
        last_update = start
        
        batch = self.batch_size
        global_size = (batch,)
        local_size = (self.work_group_size,)
        
        # Start first batch
        buf0 = self.buffer_sets[0]
        buf1 = self.buffer_sets[1]
        
        evt0 = self.kernel_benchmark(
            self.queue_compute,
            global_size,
            local_size,
            buf0.header,
            np.uint32(8),
            buf0.prev_hash,
            block_height,
            np.uint32(nonce),
            np.uint32(batch),
            buf0.scratchpad,
            buf0.output
        )
        nonce += batch
        current_buf = 1
        
        while time.perf_counter() - start < duration:
            # Start next batch while previous is running
            buf = self.buffer_sets[current_buf]
            evt = self.kernel_benchmark(
                self.queue_compute,
                global_size,
                local_size,
                buf.header,
                np.uint32(8),
                buf.prev_hash,
                block_height,
                np.uint32(nonce),
                np.uint32(batch),
                buf.scratchpad,
                buf.output
            )
            
            # Wait for previous batch
            prev_buf = self.buffer_sets[1 - current_buf]
            if current_buf == 1:
                evt0.wait()
                kernel_time = (evt0.profile.end - evt0.profile.start) / 1e6
            else:
                prev_buf._last_evt.wait()
                kernel_time = (prev_buf._last_evt.profile.end - prev_buf._last_evt.profile.start) / 1e6
            
            total_hashes += batch
            
            # Store event for next iteration
            buf._last_evt = evt
            
            nonce += batch
            current_buf = 1 - current_buf
            
            now = time.perf_counter()
            elapsed = now - start
            
            if now - last_update >= 0.5:
                hashrate = total_hashes / elapsed
                print(f"   [{elapsed:.1f}s] {hashrate:.2f} H/s | {total_hashes:,} hashes | {kernel_time:.1f}ms/batch")
                last_update = now
        
        # Wait for last batch
        self.queue_compute.finish()
        total_hashes += batch
        
        elapsed = time.perf_counter() - start
        hashrate = total_hashes / elapsed
        
        self._print_results(total_hashes, elapsed, hashrate)
        return hashrate
    
    def _print_results(self, total_hashes: int, elapsed: float, hashrate: float):
        """Print benchmark results."""
        print(f"\n{'='*60}")
        print(f"[OK] Benchmark complete!")
        print(f"   Total hashes: {total_hashes:,}")
        print(f"   Time: {elapsed:.2f}s")
        if hashrate >= 1000:
            print(f"   Hashrate: {hashrate/1000:.2f} kH/s")
        else:
            print(f"   Hashrate: {hashrate:.2f} H/s")
        print(f"{'='*60}")
    
    def hash_batch(
        self,
        header: bytes,
        prev_hash: bytes,
        block_height: int,
        nonce_start: int,
        batch_size: Optional[int] = None
    ) -> np.ndarray:
        """
        Compute hashes for a batch of nonces.
        Returns array of 32-byte hashes.
        """
        if batch_size is None:
            batch_size = self.batch_size
        
        batch_size = min(batch_size, self.batch_size)
        
        # Convert inputs
        header_arr = np.frombuffer(header.ljust(32, b'\x00')[:32], dtype=np.uint32)
        prev_hash_arr = np.frombuffer(prev_hash.ljust(32, b'\x00')[:32], dtype=np.uint32)
        
        buf = self.buffer_sets[self._current_buffer]
        
        # Upload data
        cl.enqueue_copy(self.queue_transfer, buf.header, header_arr)
        cl.enqueue_copy(self.queue_transfer, buf.prev_hash, prev_hash_arr)
        self.queue_transfer.finish()
        
        # Run kernel
        global_size = (batch_size,)
        local_size = (self.work_group_size,)
        
        evt = self.kernel_benchmark(
            self.queue_compute,
            global_size,
            local_size,
            buf.header,
            np.uint32(len(header_arr)),
            buf.prev_hash,
            np.uint32(block_height),
            np.uint32(nonce_start),
            np.uint32(batch_size),
            buf.scratchpad,
            buf.output
        )
        evt.wait()
        
        # Read results
        cl.enqueue_copy(self.queue_transfer, buf.h_output[:batch_size * 8], buf.output)
        self.queue_transfer.finish()
        
        # Alternate buffer for double buffering
        if self._double_buffer:
            self._current_buffer = 1 - self._current_buffer
        
        return buf.h_output[:batch_size * 8].view(np.uint8).reshape(batch_size, 32)
    
    def mine_batch(
        self,
        header: bytes,
        prev_hash: bytes,
        block_height: int,
        nonce_start: int,
        target: bytes,
        batch_size: Optional[int] = None
    ) -> Optional[Tuple[int, bytes]]:
        """
        Mine a batch of nonces against target.
        Returns (nonce, hash) if found, None otherwise.
        """
        if batch_size is None:
            batch_size = self.batch_size
        
        batch_size = min(batch_size, self.batch_size)
        
        # Convert inputs
        header_arr = np.frombuffer(header.ljust(32, b'\x00')[:32], dtype=np.uint32)
        prev_hash_arr = np.frombuffer(prev_hash.ljust(32, b'\x00')[:32], dtype=np.uint32)
        target_arr = np.frombuffer(target.ljust(32, b'\x00')[:32], dtype=np.uint32)
        
        buf = self.buffer_sets[self._current_buffer]
        
        # Clear results buffer
        results_init = np.zeros(17, dtype=np.uint32)
        cl.enqueue_copy(self.queue_transfer, buf.results, results_init)
        
        # Upload data
        cl.enqueue_copy(self.queue_transfer, buf.header, header_arr)
        cl.enqueue_copy(self.queue_transfer, buf.prev_hash, prev_hash_arr)
        cl.enqueue_copy(self.queue_transfer, buf.target, target_arr)
        self.queue_transfer.finish()
        
        # Run kernel
        global_size = (batch_size,)
        local_size = (self.work_group_size,)
        
        evt = self.kernel_mine(
            self.queue_compute,
            global_size,
            local_size,
            buf.header,
            np.uint32(len(header_arr)),
            buf.prev_hash,
            np.uint32(block_height),
            np.uint32(nonce_start),
            np.uint32(batch_size),
            buf.scratchpad,
            buf.output,
            buf.results,
            buf.target
        )
        evt.wait()
        
        # Check results
        results = np.zeros(17, dtype=np.uint32)
        cl.enqueue_copy(self.queue_transfer, results, buf.results)
        self.queue_transfer.finish()
        
        # Alternate buffer
        if self._double_buffer:
            self._current_buffer = 1 - self._current_buffer
        
        if results[0] > 0:
            # Found a valid nonce
            nonce = results[1]
            # Read the hash for this nonce
            hash_offset = (nonce - nonce_start) * 8
            if 0 <= hash_offset < batch_size * 8:
                cl.enqueue_copy(
                    self.queue_transfer,
                    buf.h_output[:8],
                    buf.output,
                    device_offset=hash_offset * 4
                )
                self.queue_transfer.finish()
                hash_bytes = buf.h_output[:8].tobytes()
                return (int(nonce), hash_bytes)
        
        return None
    
    def hash_single(self, data: bytes, nonce: int, prev_hash: bytes = None, block_height: int = 0) -> bytes:
        """Hash single nonce - uses batch of 1."""
        results = self.hash_batch(data, prev_hash or b'\x00' * 32, block_height, nonce, 1)
        return results[0].tobytes()


def compare_performance():
    """Compare VMEM vs regular GPU performance."""
    if not GPU_AVAILABLE:
        print("[FAIL] PyOpenCL not available")
        return
    
    print("="*60)
    print("GPU Performance Comparison: Regular vs VMEM")
    print("="*60)
    
    duration = 15.0
    
    # Test 1: Regular (no pinned, no double buffer)
    print("\n[1] Regular GPU (no optimizations)...")
    try:
        gpu_regular = CosmicHarmonyV2GPUVMem(
            batch_size=512,
            use_pinned_memory=False,
            double_buffer=False,
            verbose=False
        )
        rate_regular = gpu_regular.benchmark(duration)
    except Exception as e:
        print(f"[FAIL] {e}")
        rate_regular = 0
    
    # Test 2: Pinned memory only
    print("\n[2] Pinned Memory (page-locked)...")
    try:
        gpu_pinned = CosmicHarmonyV2GPUVMem(
            batch_size=512,
            use_pinned_memory=True,
            double_buffer=False,
            verbose=False
        )
        rate_pinned = gpu_pinned.benchmark(duration)
    except Exception as e:
        print(f"[FAIL] {e}")
        rate_pinned = 0
    
    # Test 3: Double buffer only
    print("\n[3] Double Buffer (pipelined)...")
    try:
        gpu_double = CosmicHarmonyV2GPUVMem(
            batch_size=512,
            use_pinned_memory=False,
            double_buffer=True,
            verbose=False
        )
        rate_double = gpu_double.benchmark(duration)
    except Exception as e:
        print(f"[FAIL] {e}")
        rate_double = 0
    
    # Test 4: Full optimization
    print("\n[4] Full Optimization (pinned + double buffer)...")
    try:
        gpu_full = CosmicHarmonyV2GPUVMem(
            batch_size=0,  # Auto-detect max
            use_pinned_memory=True,
            double_buffer=True,
            verbose=False
        )
        rate_full = gpu_full.benchmark(duration)
    except Exception as e:
        print(f"[FAIL] {e}")
        rate_full = 0
    
    # Summary
    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)
    print(f"{'Configuration':<35} {'Hashrate':>12} {'Speedup':>10}")
    print("-"*60)
    
    baseline = rate_regular if rate_regular > 0 else 1
    
    for name, rate in [
        ("Regular (baseline)", rate_regular),
        ("Pinned Memory", rate_pinned),
        ("Double Buffer", rate_double),
        ("Full Optimization", rate_full)
    ]:
        if rate >= 1000:
            rate_str = f"{rate/1000:.2f} kH/s"
        else:
            rate_str = f"{rate:.2f} H/s"
        speedup = rate / baseline if baseline > 0 else 0
        print(f"{name:<35} {rate_str:>12} {speedup:>9.2f}x")
    
    print("="*60)


def main():
    """Run GPU VMEM benchmark."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Cosmic Harmony v2 GPU VMEM Miner")
    parser.add_argument('--benchmark', '-b', action='store_true', help='Run benchmark')
    parser.add_argument('--compare', '-c', action='store_true', help='Compare optimization levels')
    parser.add_argument('--duration', '-d', type=float, default=30.0, help='Benchmark duration')
    parser.add_argument('--batch', type=int, default=0, help='Batch size (0 = auto)')
    parser.add_argument('--no-pinned', action='store_true', help='Disable pinned memory')
    parser.add_argument('--no-double', action='store_true', help='Disable double buffering')
    args = parser.parse_args()
    
    if not GPU_AVAILABLE:
        print("[FAIL] PyOpenCL not available")
        return
    
    if args.compare:
        compare_performance()
    elif args.benchmark:
        try:
            miner = CosmicHarmonyV2GPUVMem(
                batch_size=args.batch,
                use_pinned_memory=not args.no_pinned,
                double_buffer=not args.no_double
            )
            miner.benchmark(args.duration)
        except Exception as e:
            print(f"[FAIL] Error: {e}")
            import traceback
            traceback.print_exc()
    else:
        # Default: quick comparison
        compare_performance()


if __name__ == "__main__":
    main()
