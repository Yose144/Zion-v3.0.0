#!/usr/bin/env python3
"""
ZION Cosmic Harmony v2 - GPU Implementation (OpenCL)

This is a GPU-optimized version of the memory-hard PoW algorithm.
Due to GPU memory constraints, we use a smaller scratchpad (512KB-1MB per thread)
but maintain ASIC-resistance through memory-hard access patterns.

Performance targets:
- CPU optimized: ~100 H/s
- GPU (RX 5600): ~1-10 kH/s

Author: ZION AI Native Team
Version: 2.9.5-gpu
Date: January 2026
"""

import numpy as np
from typing import Optional, Tuple
import time

try:
    import pyopencl as cl
    GPU_AVAILABLE = True
except ImportError:
    GPU_AVAILABLE = False
    print("⚠️  PyOpenCL not available - GPU mining disabled")


# ============================================================================
# OPENCL KERNEL - Cosmic Harmony v2 GPU
# ============================================================================

COSMIC_HARMONY_V2_KERNEL = """
// ============================================================================
// Cosmic Harmony v2 - OpenCL GPU Kernel
// Memory-hard PoW with reduced scratchpad for GPU execution
// ============================================================================

#define ROTL32(x, n) (((x) << (n)) | ((x) >> (32 - (n))))
#define ROTR32(x, n) (((x) >> (n)) | ((x) << (32 - (n))))

#define PHI 0x9E3779B9u
#define MASK32 0xFFFFFFFFu

// GPU scratchpad: 512KB per work item (fits in local + private memory)
// This is smaller than CPU version (4-16MB) but maintains memory-hard properties
#define GPU_SCRATCHPAD_SIZE 131072   // 512KB / 4 = 128K uint32 words
#define GPU_MIXING_ROUNDS 8
#define GPU_CHUNK_SIZE 8

// Initial state (Blake2b-like IV)
#define IV0 0x6A09E667u
#define IV1 0xBB67AE85u
#define IV2 0x3C6EF372u
#define IV3 0xA54FF53Au
#define IV4 0x510E527Fu
#define IV5 0x9B05688Cu
#define IV6 0x1F83D9ABu
#define IV7 0x5BE0CD19u

// Inline wrapping operations
inline uint wrapping_add(uint a, uint b) {
    return (a + b) & MASK32;
}

inline uint wrapping_mul(uint a, uint b) {
    return (uint)(((ulong)a * (ulong)b) & MASK32);
}

// Quick state mixing (inlined for performance)
inline void quick_mix(uint* state) {
    // Swap first half with second half
    uint tmp;
    for (int i = 0; i < 4; i++) {
        tmp = state[i];
        state[i] = state[7 - i];
        state[7 - i] = tmp;
    }
    // Mix with PHI
    for (int i = 0; i < 8; i++) {
        state[i] = wrapping_mul(ROTL32(state[i], 7), PHI);
    }
}

// Generate chunk from state
inline void generate_chunk(uint* state, int index, uint* chunk) {
    // Copy state to chunk
    for (int i = 0; i < 8; i++) {
        chunk[i] = state[i];
    }
    
    // Mix index
    chunk[0] ^= (uint)index;
    chunk[7] ^= ROTL32((uint)index, 16);
    
    // Mini mixing rounds
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

// Memory-hard mixing function
inline void memory_hard_mix(
    uint* state,
    __global uint* scratchpad,
    int scratchpad_words,
    int mixing_rounds
) {
    int num_chunks = scratchpad_words / 8;
    
    for (int round = 0; round < mixing_rounds; round++) {
        // Compute pseudo-random read index based on state
        uint state_idx = state[0] ^ state[4];
        state_idx += (state[1] ^ state[5]) << 16;
        
        // Different access patterns
        int pattern = round % 3;
        int read_idx;
        
        if (pattern == 0) {
            // Sequential
            read_idx = round % num_chunks;
        } else if (pattern == 1) {
            // Random walk
            read_idx = (int)((state_idx + round * PHI) % (uint)num_chunks);
        } else {
            // Butterfly
            int bits = 17; // log2(128K/8)
            int stage = round % bits;
            int mask = 1 << stage;
            int base = (int)(state_idx % (uint)num_chunks);
            read_idx = base ^ mask;
            if (read_idx >= num_chunks) read_idx = base;
        }
        
        // Read chunk from scratchpad
        int offset = read_idx * 8;
        uint chunk[8];
        for (int i = 0; i < 8; i++) {
            chunk[i] = scratchpad[offset + i];
        }
        
        // Mix chunk into state with rotation
        int rotation = 5 + (round % 4) * 3;
        for (int i = 0; i < 8; i++) {
            state[i] = wrapping_mul(
                wrapping_add(ROTL32(state[i], rotation), chunk[i]),
                PHI
            );
        }
        
        // Generate new chunk and write back
        uint new_chunk[8];
        generate_chunk(state, round, new_chunk);
        
        int write_idx = (int)(((state_idx >> 8) + round * 7) % (uint)num_chunks);
        int write_offset = write_idx * 8;
        for (int i = 0; i < 8; i++) {
            scratchpad[write_offset + i] = new_chunk[i];
        }
    }
}

// Lattice noise injection (simplified for GPU)
inline void inject_lattice_noise(uint* state) {
    uint noise_mod = 65521u; // Prime modulus
    
    for (int i = 0; i < 8; i++) {
        uint noise = wrapping_mul(state[i], PHI);
        noise = (noise % noise_mod) * (noise_mod - 1);
        state[i] = wrapping_add(state[i], noise);
    }
}

// Golden ratio finalization
inline void golden_finalize(uint* state) {
    // Multiple rounds of mixing
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
    
    // Final XOR compression
    uint xor_all = 0;
    for (int i = 0; i < 8; i++) {
        xor_all ^= state[i];
    }
    for (int i = 0; i < 8; i++) {
        state[i] ^= wrapping_mul(xor_all, PHI);
    }
}

// Main kernel - one work item per hash
__kernel void cosmic_harmony_v2_mine(
    __global uint* header_data,     // Block header (padded to 32 bytes / 8 uints)
    uint header_words,              // Number of words in header
    __global uint* prev_hash,       // Previous block hash (8 uints)
    uint block_height,              // Current block height
    uint nonce_start,               // Starting nonce
    uint nonce_count,               // Number of nonces to try
    __global uint* scratchpad_pool, // Pre-allocated scratchpad pool
    __global uchar* hash_output,    // Output hashes (32 bytes each)
    __global uint* results,         // Found nonces (if hash < target)
    __global uint* target           // Target threshold (8 uints)
) {
    size_t gid = get_global_id(0);
    if (gid >= nonce_count) return;
    
    uint nonce = nonce_start + (uint)gid;
    
    // Initialize state
    uint state[8] = {IV0, IV1, IV2, IV3, IV4, IV5, IV6, IV7};
    
    // Phase 1: Absorb input
    // XOR header into state
    for (int i = 0; i < min(header_words, 8u); i++) {
        state[i] ^= header_data[i];
    }
    
    // Mix nonce
    state[0] ^= nonce;
    state[1] ^= (nonce >> 16);
    state[2] ^= ROTL32(nonce, 17);
    state[3] ^= ROTR32(nonce >> 16, 13);
    
    // Mix previous hash
    for (int i = 0; i < 8; i++) {
        state[i] ^= prev_hash[i];
    }
    
    // Mix block height
    state[4] ^= block_height;
    state[5] ^= ROTL32(block_height, 11);
    
    // Get this work item's scratchpad slice
    __global uint* my_scratchpad = scratchpad_pool + gid * GPU_SCRATCHPAD_SIZE;
    
    // Phase 2: Fill scratchpad
    int num_chunks = GPU_SCRATCHPAD_SIZE / 8;
    for (int i = 0; i < num_chunks; i++) {
        uint chunk[8];
        generate_chunk(state, i, chunk);
        
        int offset = i * 8;
        for (int j = 0; j < 8; j++) {
            my_scratchpad[offset + j] = chunk[j];
        }
        
        // Periodic mixing
        if ((i & 0x3FF) == 0) {  // Every 1024 chunks
            for (int j = 0; j < 8; j++) {
                state[j] ^= chunk[j];
            }
            quick_mix(state);
        }
    }
    
    // Phase 3: Memory-hard mixing
    memory_hard_mix(state, my_scratchpad, GPU_SCRATCHPAD_SIZE, GPU_MIXING_ROUNDS);
    
    // Phase 4: Lattice noise injection
    inject_lattice_noise(state);
    
    // Phase 5: Finalization
    golden_finalize(state);
    
    // Write output hash
    __global uint* out = (__global uint*)(hash_output + gid * 32);
    for (int i = 0; i < 8; i++) {
        out[i] = state[i];
    }
    
    // Check if hash meets target (optional - can be done on CPU)
    // Simple comparison: if hash[0] < target[0], we found a solution
    if (state[0] < target[0]) {
        // Atomic add to results array
        int idx = atomic_add(&results[0], 1);
        if (idx < 16) {  // Max 16 solutions per batch
            results[idx + 1] = nonce;
        }
    }
}

// Simpler kernel for benchmarking (no target check, no results)
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
    uint state[8] = {IV0, IV1, IV2, IV3, IV4, IV5, IV6, IV7};
    
    // Absorb
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
    
    // Get scratchpad
    __global uint* my_scratchpad = scratchpad_pool + gid * GPU_SCRATCHPAD_SIZE;
    
    // Fill scratchpad
    int num_chunks = GPU_SCRATCHPAD_SIZE / 8;
    for (int i = 0; i < num_chunks; i++) {
        uint chunk[8];
        generate_chunk(state, i, chunk);
        int offset = i * 8;
        for (int j = 0; j < 8; j++) {
            my_scratchpad[offset + j] = chunk[j];
        }
        if ((i & 0x3FF) == 0) {
            for (int j = 0; j < 8; j++) state[j] ^= chunk[j];
            quick_mix(state);
        }
    }
    
    // Mix
    memory_hard_mix(state, my_scratchpad, GPU_SCRATCHPAD_SIZE, GPU_MIXING_ROUNDS);
    
    // Finalize
    inject_lattice_noise(state);
    golden_finalize(state);
    
    // Output
    __global uint* out = (__global uint*)(hash_output + gid * 32);
    for (int i = 0; i < 8; i++) {
        out[i] = state[i];
    }
}
"""


class CosmicHarmonyV2GPU:
    """
    GPU-accelerated Cosmic Harmony v2 miner using OpenCL.
    
    Memory requirements per work item:
    - Scratchpad: 512KB (GPU_SCRATCHPAD_SIZE * 4 bytes)
    - Total for 256 work items: 128 MB
    - Total for 1024 work items: 512 MB
    
    RX 5600 has 6GB VRAM, so we can run ~10K work items = 5GB scratchpad
    """
    
    GPU_SCRATCHPAD_SIZE = 131072  # 512KB / 4 = 128K uint32 words
    GPU_SCRATCHPAD_BYTES = GPU_SCRATCHPAD_SIZE * 4  # 512KB per work item
    
    def __init__(self, batch_size: int = 256, platform_idx: int = 0, device_idx: int = 0):
        if not GPU_AVAILABLE:
            raise RuntimeError("PyOpenCL not available")
        
        # Get platform and device
        platforms = cl.get_platforms()
        if not platforms:
            raise RuntimeError("No OpenCL platforms found")
        
        self.platform = platforms[min(platform_idx, len(platforms) - 1)]
        devices = self.platform.get_devices()
        if not devices:
            raise RuntimeError("No OpenCL devices found")
        
        self.device = devices[min(device_idx, len(devices) - 1)]
        
        # Print device info
        print(f"[GPU] {self.device.name}")
        print(f"   Platform: {self.platform.name}")
        
        # Get device memory
        global_mem = self.device.global_mem_size
        max_alloc = self.device.max_mem_alloc_size
        local_mem = self.device.local_mem_size
        
        print(f"   Global Memory: {global_mem / 1024**3:.2f} GB")
        print(f"   Max Allocation: {max_alloc / 1024**3:.2f} GB")
        print(f"   Local Memory: {local_mem / 1024:.1f} KB")
        
        # Calculate max batch size based on memory
        # Each work item needs GPU_SCRATCHPAD_BYTES
        max_batch_from_mem = int(max_alloc * 0.8 / self.GPU_SCRATCHPAD_BYTES)
        self.batch_size = min(batch_size, max_batch_from_mem)
        
        # Round to multiple of 256 for efficiency
        self.batch_size = (self.batch_size // 256) * 256
        if self.batch_size < 256:
            self.batch_size = 256
        
        scratchpad_total = self.batch_size * self.GPU_SCRATCHPAD_BYTES
        print(f"   Batch Size: {self.batch_size}")
        print(f"   Scratchpad Pool: {scratchpad_total / 1024**2:.1f} MB")
        
        # Create context and queue
        self.ctx = cl.Context([self.device])
        self.queue = cl.CommandQueue(
            self.ctx,
            properties=cl.command_queue_properties.PROFILING_ENABLE
        )
        
        # Build kernel
        build_opts = [
            "-cl-fast-relaxed-math",
            "-cl-mad-enable",
            "-cl-no-signed-zeros"
        ]
        try:
            self.program = cl.Program(self.ctx, COSMIC_HARMONY_V2_KERNEL).build(
                options=" ".join(build_opts)
            )
            self.kernel_benchmark = self.program.cosmic_harmony_v2_benchmark
            self.kernel_mine = self.program.cosmic_harmony_v2_mine
            print("   [OK] Kernels compiled successfully")
        except cl.RuntimeError as e:
            print(f"   [FAIL] Kernel compilation failed: {e}")
            raise
        
        # Get work group info
        max_wg_size = self.kernel_benchmark.get_work_group_info(
            cl.kernel_work_group_info.WORK_GROUP_SIZE, self.device
        )
        self.work_group_size = min(256, max_wg_size)
        print(f"   Work Group Size: {self.work_group_size}")
        
        # Pre-allocate buffers
        mf = cl.mem_flags
        
        # Scratchpad pool (largest allocation)
        self.d_scratchpad = cl.Buffer(
            self.ctx, mf.READ_WRITE,
            size=self.batch_size * self.GPU_SCRATCHPAD_SIZE * 4
        )
        
        # Header buffer (32 bytes)
        self.d_header = cl.Buffer(self.ctx, mf.READ_ONLY, size=32)
        
        # Previous hash buffer (32 bytes)
        self.d_prev_hash = cl.Buffer(self.ctx, mf.READ_ONLY, size=32)
        
        # Output buffer (32 bytes per hash)
        self.d_output = cl.Buffer(
            self.ctx, mf.WRITE_ONLY,
            size=self.batch_size * 32
        )
        
        # Results buffer (for mining with target)
        self.d_results = cl.Buffer(self.ctx, mf.READ_WRITE, size=68)  # 17 uints
        
        # Target buffer
        self.d_target = cl.Buffer(self.ctx, mf.READ_ONLY, size=32)
        
        # Host-side output buffer
        self.h_output = np.zeros(self.batch_size * 8, dtype=np.uint32)
        
        print("   [OK] GPU buffers allocated")
        self._available = True
    
    def is_available(self) -> bool:
        """Check if GPU is available and initialized."""
        return getattr(self, '_available', False)
    
    @property
    def device_name(self) -> str:
        """Get GPU device name."""
        return self.device.name if hasattr(self, 'device') else "Unknown"
    
    def benchmark(self, duration: float = 30.0) -> float:
        """Run benchmark and return hashrate in H/s."""
        print(f"\n{'='*60}")
        print("Cosmic Harmony v2 - GPU Benchmark")
        print(f"{'='*60}")
        print(f"Batch size: {self.batch_size}")
        print(f"Duration: {duration}s\n")
        
        # Test data
        header = np.zeros(8, dtype=np.uint32)
        header[0] = 0x12345678
        header[1] = 0xDEADBEEF
        
        prev_hash = np.zeros(8, dtype=np.uint32)
        prev_hash[0] = 0xABCDEF01
        
        block_height = np.uint32(12345)
        
        # Copy to device
        cl.enqueue_copy(self.queue, self.d_header, header)
        cl.enqueue_copy(self.queue, self.d_prev_hash, prev_hash)
        
        # Warmup
        print(">>> Warming up GPU...")
        warmup_batch = min(256, self.batch_size)
        global_size = (warmup_batch,)
        local_size = (min(256, warmup_batch),)
        
        try:
            self.kernel_benchmark(
                self.queue,
                global_size,
                local_size,
                self.d_header,
                np.uint32(8),
                self.d_prev_hash,
                block_height,
                np.uint32(0),
                np.uint32(warmup_batch),
                self.d_scratchpad,
                self.d_output
            )
            self.queue.finish()
            print("   Warmup complete\n")
        except cl.RuntimeError as e:
            print(f"   [FAIL] Warmup failed: {e}")
            raise
        
        # Benchmark
        print(">>> Running benchmark...")
        total_hashes = 0
        nonce = 0
        start = time.perf_counter()
        last_update = start
        
        # Adjust batch for memory
        batch = self.batch_size
        global_size = (batch,)
        local_size = (self.work_group_size,)
        
        while time.perf_counter() - start < duration:
            try:
                evt = self.kernel_benchmark(
                    self.queue,
                    global_size,
                    local_size,
                    self.d_header,
                    np.uint32(8),
                    self.d_prev_hash,
                    block_height,
                    np.uint32(nonce),
                    np.uint32(batch),
                    self.d_scratchpad,
                    self.d_output
                )
                evt.wait()
                
                total_hashes += batch
                nonce += batch
                
                # Get kernel execution time
                kernel_time = (evt.profile.end - evt.profile.start) / 1e6  # ms
                
                now = time.perf_counter()
                elapsed = now - start
                
                if now - last_update >= 0.5:
                    hashrate = total_hashes / elapsed
                    print(f"   [{elapsed:.1f}s] {hashrate:.2f} H/s | {total_hashes:,} hashes | {kernel_time:.1f}ms/batch")
                    last_update = now
                    
            except cl.RuntimeError as e:
                print(f"   [FAIL] Kernel error: {e}")
                break
        
        elapsed = time.perf_counter() - start
        hashrate = total_hashes / elapsed
        
        print(f"\n{'='*60}")
        print(f"[OK] Benchmark complete!")
        print(f"   Total hashes: {total_hashes:,}")
        print(f"   Time: {elapsed:.2f}s")
        print(f"   Hashrate: {hashrate:.2f} H/s")
        print(f"{'='*60}")
        
        return hashrate
    
    def hash_batch(
        self,
        header: bytes,
        prev_hash: bytes,
        block_height: int,
        nonce_start: int,
        batch_size: Optional[int] = None
    ) -> np.ndarray:
        """
        Compute a batch of hashes on GPU.
        
        Returns array of 32-byte hashes.
        """
        if batch_size is None:
            batch_size = self.batch_size
        
        batch_size = min(batch_size, self.batch_size)
        
        # Prepare input data
        header_uint = np.frombuffer(header.ljust(32, b'\x00')[:32], dtype=np.uint32)
        prev_hash_uint = np.frombuffer(prev_hash.ljust(32, b'\x00')[:32], dtype=np.uint32)
        
        # Copy to device
        cl.enqueue_copy(self.queue, self.d_header, header_uint)
        cl.enqueue_copy(self.queue, self.d_prev_hash, prev_hash_uint)
        
        # Run kernel
        global_size = (batch_size,)
        local_size = (min(self.work_group_size, batch_size),)
        
        self.kernel_benchmark(
            self.queue,
            global_size,
            local_size,
            self.d_header,
            np.uint32(8),
            self.d_prev_hash,
            np.uint32(block_height),
            np.uint32(nonce_start),
            np.uint32(batch_size),
            self.d_scratchpad,
            self.d_output
        )
        
        # Copy results back
        output = np.zeros(batch_size * 8, dtype=np.uint32)
        cl.enqueue_copy(self.queue, output, self.d_output)
        self.queue.finish()
        
        # Reshape to (batch_size, 32) bytes
        return output.view(np.uint8).reshape(batch_size, 32)
    
    def hash_single(
        self,
        header: np.ndarray,
        prev_hash: np.ndarray,
        block_height: np.uint32,
        nonce: np.uint64
    ) -> bytes:
        """
        Compute a single hash on GPU.
        
        Note: Inefficient for single hashes - use hash_batch for better performance.
        """
        # Use batch of 1
        cl.enqueue_copy(self.queue, self.d_header, header)
        cl.enqueue_copy(self.queue, self.d_prev_hash, prev_hash)
        
        global_size = (1,)
        local_size = (1,)
        
        self.kernel_benchmark(
            self.queue,
            global_size,
            local_size,
            self.d_header,
            np.uint32(8),
            self.d_prev_hash,
            block_height,
            np.uint32(nonce),
            np.uint32(1),
            self.d_scratchpad,
            self.d_output
        )
        
        output = np.zeros(8, dtype=np.uint32)
        cl.enqueue_copy(self.queue, output, self.d_output)
        self.queue.finish()
        
        return output.view(np.uint8).tobytes()
    
    def mine_batch(
        self,
        header: np.ndarray,
        prev_hash: np.ndarray,
        block_height: np.uint32,
        start_nonce: np.uint64,
        count: np.uint32,
        target: Optional[np.ndarray]
    ) -> Optional[Tuple[int, bytes]]:
        """
        Mine a batch of nonces, checking against target.
        
        Returns (nonce, hash) if target met, None otherwise.
        """
        batch_size = min(int(count), self.batch_size)
        
        cl.enqueue_copy(self.queue, self.d_header, header)
        cl.enqueue_copy(self.queue, self.d_prev_hash, prev_hash)
        
        if target is not None:
            cl.enqueue_copy(self.queue, self.d_target, target)
            
            # Initialize results buffer (found_flag=0)
            results_init = np.zeros(17, dtype=np.uint32)
            cl.enqueue_copy(self.queue, self.d_results, results_init)
            
            global_size = (batch_size,)
            local_size = (min(self.work_group_size, batch_size),)
            
            self.kernel_mine(
                self.queue,
                global_size,
                local_size,
                self.d_header,
                np.uint32(8),
                self.d_prev_hash,
                block_height,
                np.uint32(start_nonce),
                np.uint32(batch_size),
                self.d_target,
                self.d_scratchpad,
                self.d_results
            )
            
            # Read results
            results = np.zeros(17, dtype=np.uint32)
            cl.enqueue_copy(self.queue, results, self.d_results)
            self.queue.finish()
            
            if results[0] != 0:  # Found!
                nonce = int(results[0])
                hash_bytes = results[1:9].view(np.uint8).tobytes()
                return (nonce, hash_bytes)
            
            return None
        
        else:
            # No target - just compute hashes
            hashes = self.hash_batch(
                header.tobytes(), 
                prev_hash.tobytes(),
                int(block_height),
                int(start_nonce),
                batch_size
            )
            return None


def main():
    """Run GPU benchmark."""
    if not GPU_AVAILABLE:
        print("[FAIL] PyOpenCL not available")
        return
    
    try:
        miner = CosmicHarmonyV2GPU(batch_size=1024)
        hashrate = miner.benchmark(duration=30.0)
        
        # Compare with CPU
        print("\n[INFO] Performance Comparison:")
        cpu_rate = 105.0  # From optimized CPU version
        print(f"   CPU (optimized): {cpu_rate:.2f} H/s")
        print(f"   GPU: {hashrate:.2f} H/s")
        print(f"   Speedup: {hashrate / cpu_rate:.2f}x")
        
    except Exception as e:
        print(f"[FAIL] Error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
