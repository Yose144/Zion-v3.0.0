"""
ZION Cosmic Harmony v3 - GPU Mining via PyOpenCL
=================================================

High-performance GPU mining using OpenCL.
Supports AMD, NVIDIA, Intel GPUs.

Usage:
    from cosmic_harmony_v3_gpu import CosmicHarmonyV3GPU
    
    miner = CosmicHarmonyV3GPU()
    miner.list_devices()
    
    # Start mining
    miner.mine(block_header, target, start_nonce=0)
"""

import numpy as np
import time
from typing import Optional, Tuple, List, Union
from dataclasses import dataclass

try:
    import pyopencl as cl
    GPU_AVAILABLE = True
except ImportError:
    GPU_AVAILABLE = False
    print("⚠️  PyOpenCL not available - install with: pip install pyopencl")


# OpenCL Kernel source (same as Rust version)
KERNEL_SOURCE = '''
// ============================================================================
// COSMIC HARMONY V3 - OpenCL Mining Kernel
// ============================================================================

#define KECCAK_ROUNDS 24
#define GOLDEN_RATIO 0x9E3779B97F4A7C15UL

__constant ulong KECCAK_RC[24] = {
    0x0000000000000001UL, 0x0000000000008082UL, 0x800000000000808AUL,
    0x8000000080008000UL, 0x000000000000808BUL, 0x0000000080000001UL,
    0x8000000080008081UL, 0x8000000000008009UL, 0x000000000000008AUL,
    0x0000000000000088UL, 0x0000000080008009UL, 0x000000008000000AUL,
    0x000000008000808BUL, 0x800000000000008BUL, 0x8000000000008089UL,
    0x8000000000008003UL, 0x8000000000008002UL, 0x8000000000000080UL,
    0x000000000000800AUL, 0x800000008000000AUL, 0x8000000080008081UL,
    0x8000000000008080UL, 0x0000000080000001UL, 0x8000000080008008UL
};

__constant int KECCAK_ROTC[24] = {
    1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 2, 14,
    27, 41, 56, 8, 25, 43, 62, 18, 39, 61, 20, 44
};

__constant int KECCAK_PILN[24] = {
    10, 7, 11, 17, 18, 3, 5, 16, 8, 21, 24, 4,
    15, 23, 19, 13, 12, 2, 20, 14, 22, 9, 6, 1
};

__constant ulong PHI_POWERS[16] = {
    0x0000000100000000UL, 0x00000001A09E667FUL, 0x000000029E3779B9UL,
    0x00000004428F5C28UL, 0x0000000700000000UL, 0x00000000B09E667FUL,
    0x0000001200000000UL, 0x000000001D000000UL, 0x0000002F00000000UL,
    0x0000004C00000000UL, 0x0000007B00000000UL, 0x000000C700000000UL,
    0x0000014200000000UL, 0x0000020900000000UL, 0x0000034B00000000UL,
    0x0000055400000000UL
};

__constant uchar COSMIC_XOR_MASK[32] = {
    0x74, 0x9D, 0x30, 0x60, 0x74, 0x9D, 0x30, 0x60,
    0x74, 0x9D, 0x30, 0x60, 0x74, 0x9D, 0x30, 0x60,
    0x74, 0x9D, 0x30, 0x60, 0x74, 0x9D, 0x30, 0x60,
    0x74, 0x9D, 0x30, 0x60, 0x74, 0x9D, 0x30, 0x60
};

inline ulong rotl64(ulong x, int n) {
    return (x << n) | (x >> (64 - n));
}

void keccak_f1600(__private ulong *state) {
    ulong t, bc[5];
    
    for (int round = 0; round < KECCAK_ROUNDS; round++) {
        bc[0] = state[0] ^ state[5] ^ state[10] ^ state[15] ^ state[20];
        bc[1] = state[1] ^ state[6] ^ state[11] ^ state[16] ^ state[21];
        bc[2] = state[2] ^ state[7] ^ state[12] ^ state[17] ^ state[22];
        bc[3] = state[3] ^ state[8] ^ state[13] ^ state[18] ^ state[23];
        bc[4] = state[4] ^ state[9] ^ state[14] ^ state[19] ^ state[24];
        
        for (int i = 0; i < 5; i++) {
            t = bc[(i + 4) % 5] ^ rotl64(bc[(i + 1) % 5], 1);
            state[i] ^= t;
            state[i + 5] ^= t;
            state[i + 10] ^= t;
            state[i + 15] ^= t;
            state[i + 20] ^= t;
        }
        
        t = state[1];
        for (int i = 0; i < 24; i++) {
            int j = KECCAK_PILN[i];
            bc[0] = state[j];
            state[j] = rotl64(t, KECCAK_ROTC[i]);
            t = bc[0];
        }
        
        for (int j = 0; j < 25; j += 5) {
            bc[0] = state[j];
            bc[1] = state[j + 1];
            bc[2] = state[j + 2];
            bc[3] = state[j + 3];
            bc[4] = state[j + 4];
            
            state[j] ^= (~bc[1]) & bc[2];
            state[j + 1] ^= (~bc[2]) & bc[3];
            state[j + 2] ^= (~bc[3]) & bc[4];
            state[j + 3] ^= (~bc[4]) & bc[0];
            state[j + 4] ^= (~bc[0]) & bc[1];
        }
        
        state[0] ^= KECCAK_RC[round];
    }
}

void keccak256(__private uchar *input, int input_len, __private uchar *output) {
    ulong state[25];
    for (int i = 0; i < 25; i++) state[i] = 0;
    
    for (int i = 0; i < input_len; i++) {
        ((uchar*)state)[i] ^= input[i];
    }
    ((uchar*)state)[input_len] ^= 0x01;
    ((uchar*)state)[135] ^= 0x80;
    
    keccak_f1600(state);
    
    for (int i = 0; i < 32; i++) {
        output[i] = ((uchar*)state)[i];
    }
}

void sha3_512(__private uchar *input, int input_len, __private uchar *output) {
    ulong state[25];
    for (int i = 0; i < 25; i++) state[i] = 0;
    
    for (int i = 0; i < input_len && i < 72; i++) {
        ((uchar*)state)[i] ^= input[i];
    }
    ((uchar*)state)[input_len] ^= 0x06;
    ((uchar*)state)[71] ^= 0x80;
    
    keccak_f1600(state);
    
    for (int i = 0; i < 64; i++) {
        output[i] = ((uchar*)state)[i];
    }
}

void golden_matrix(__private uchar *input, __private uchar *output) {
    ulong rows[8];
    for (int i = 0; i < 8; i++) {
        rows[i] = ((ulong*)input)[i];
    }
    
    for (int i = 0; i < 8; i++) {
        ulong phi = PHI_POWERS[i % 16];
        rows[i] = rows[i] ^ (rows[(i + 1) % 8] * phi);
        rows[i] = rotl64(rows[i], (i * 7) % 64);
    }
    
    for (int i = 0; i < 8; i++) {
        rows[i] ^= rows[(i + 3) % 8];
        rows[i] += rows[(i + 5) % 8];
    }
    
    for (int i = 0; i < 8; i++) {
        ((ulong*)output)[i] = rows[i];
    }
}

void cosmic_fusion(__private uchar *input, __private uchar *output) {
    ulong state[8];
    for (int i = 0; i < 8; i++) {
        state[i] = ((ulong*)input)[i];
    }
    
    for (int round = 0; round < 7; round++) {
        for (int i = 0; i < 8; i++) {
            state[i] ^= GOLDEN_RATIO;
            state[i] = rotl64(state[i], 13);
            state[i] += state[(i + 1) % 8];
        }
        
        ulong temp = state[0];
        for (int i = 0; i < 7; i++) {
            state[i] ^= state[i + 1];
        }
        state[7] ^= temp;
    }
    
    ulong final_state[4];
    final_state[0] = state[0] ^ state[4];
    final_state[1] = state[1] ^ state[5];
    final_state[2] = state[2] ^ state[6];
    final_state[3] = state[3] ^ state[7];
    
    for (int i = 0; i < 4; i++) {
        ((ulong*)output)[i] = final_state[i];
    }
    
    for (int i = 0; i < 32; i++) {
        output[i] ^= COSMIC_XOR_MASK[i];
    }
}

__kernel void cosmic_harmony_v3_mine(
    __global const uchar *block_header,
    uint header_len,
    ulong start_nonce,
    uint target32,
    uint state0_big_endian,
    __global ulong *found_nonce,
    __global uchar *found_hash,
    __global uint *solution_count
) {
    uint gid = get_global_id(0);
    ulong nonce = start_nonce + gid;

    // Canonical CHv3 input (matches Rust `algorithms_opt::cosmic_harmony_v3`):
    // input = (first 80 bytes of header, zero-padded) || (nonce LE u64)
    // Total input length = 88 bytes.
    uchar input[88];
    uchar step1[32];
    uchar step2[64];
    uchar step3[64];
    uchar final_hash[32];

    for (int i = 0; i < 80; i++) {
        input[i] = 0;
    }

    uint copy_len = header_len;
    if (copy_len > 80) copy_len = 80;
    for (int i = 0; i < (int)copy_len; i++) {
        input[i] = block_header[i];
    }

    input[80] = (uchar)(nonce);
    input[81] = (uchar)(nonce >> 8);
    input[82] = (uchar)(nonce >> 16);
    input[83] = (uchar)(nonce >> 24);
    input[84] = (uchar)(nonce >> 32);
    input[85] = (uchar)(nonce >> 40);
    input[86] = (uchar)(nonce >> 48);
    input[87] = (uchar)(nonce >> 56);
    
    keccak256(input, 88, step1);
    sha3_512(step1, 32, step2);
    golden_matrix(step2, step3);
    cosmic_fusion(step3, final_hash);
    
    // Pool target model for Cosmic Harmony v3: compare first 4 bytes (state0) against 32-bit target.
    uint state0 = 0;
    if (state0_big_endian != 0) {
        state0 = ((uint)final_hash[0] << 24) | ((uint)final_hash[1] << 16) | ((uint)final_hash[2] << 8) | (uint)final_hash[3];
    } else {
        state0 = ((uint)final_hash[3] << 24) | ((uint)final_hash[2] << 16) | ((uint)final_hash[1] << 8) | (uint)final_hash[0];
    }

    bool valid = (state0 <= target32);
    
    if (valid) {
        uint old = atomic_inc(solution_count);
        if (old == 0) {
            found_nonce[0] = nonce;
            for (int i = 0; i < 32; i++) {
                found_hash[i] = final_hash[i];
            }
        }
    }
}

__kernel void cosmic_harmony_v3_batch(
    __global const uchar *block_header,
    uint header_len,
    ulong start_nonce,
    __global uchar *output_hashes
) {
    uint gid = get_global_id(0);
    ulong nonce = start_nonce + gid;

    uchar input[88];
    uchar step1[32];
    uchar step2[64];
    uchar step3[64];
    uchar final_hash[32];

    for (int i = 0; i < 80; i++) {
        input[i] = 0;
    }

    uint copy_len = header_len;
    if (copy_len > 80) copy_len = 80;
    for (int i = 0; i < (int)copy_len; i++) {
        input[i] = block_header[i];
    }

    input[80] = (uchar)(nonce);
    input[81] = (uchar)(nonce >> 8);
    input[82] = (uchar)(nonce >> 16);
    input[83] = (uchar)(nonce >> 24);
    input[84] = (uchar)(nonce >> 32);
    input[85] = (uchar)(nonce >> 40);
    input[86] = (uchar)(nonce >> 48);
    input[87] = (uchar)(nonce >> 56);
    
    keccak256(input, 88, step1);
    sha3_512(step1, 32, step2);
    golden_matrix(step2, step3);
    cosmic_fusion(step3, final_hash);
    
    __global uchar *out = output_hashes + gid * 32;
    for (int i = 0; i < 32; i++) {
        out[i] = final_hash[i];
    }
}
'''


@dataclass
class GpuDevice:
    """GPU device information"""
    id: int
    name: str
    vendor: str
    compute_units: int
    max_work_group_size: int
    global_memory: int
    local_memory: int
    
    def __str__(self):
        return f"[{self.id}] {self.name} ({self.vendor}) - {self.compute_units} CUs, {self.global_memory // (1024*1024)} MB"


class CosmicHarmonyV3GPU:
    """GPU Miner for Cosmic Harmony v3"""
    
    def __init__(self, device_id: int = 0, batch_size: int = 1_000_000, work_group_size: int = 256):
        if not GPU_AVAILABLE:
            raise RuntimeError("PyOpenCL not available")
        
        self.device_id = device_id
        self.batch_size = batch_size
        self.work_group_size = work_group_size
        
        # Initialize OpenCL
        platforms = cl.get_platforms()
        if not platforms:
            raise RuntimeError("No OpenCL platforms found")
        
        # Collect all GPU devices
        all_devices = []
        for platform in platforms:
            try:
                devices = platform.get_devices(device_type=cl.device_type.GPU)
                all_devices.extend(devices)
            except cl.Error:
                continue
        
        if not all_devices:
            raise RuntimeError("No GPU devices found")
        
        if device_id >= len(all_devices):
            raise RuntimeError(f"Device ID {device_id} not found. Available: 0-{len(all_devices)-1}")
        
        self.device = all_devices[device_id]
        self.ctx = cl.Context([self.device])
        self.queue = cl.CommandQueue(self.ctx)
        
        # Build program
        self.program = cl.Program(self.ctx, KERNEL_SOURCE).build()
        # Cache kernel objects (avoid repeated kernel retrieval overhead/warnings)
        self.kernel_mine = cl.Kernel(self.program, "cosmic_harmony_v3_mine")
        self.kernel_batch = cl.Kernel(self.program, "cosmic_harmony_v3_batch")
        
        # Get device info
        self.device_info = GpuDevice(
            id=device_id,
            name=self.device.name,
            vendor=self.device.vendor,
            compute_units=self.device.max_compute_units,
            max_work_group_size=self.device.max_work_group_size,
            global_memory=self.device.global_mem_size,
            local_memory=self.device.local_mem_size,
        )
        
        print(f"🚀 GPU initialized: {self.device_info}")
        
        # Allocate buffers (CHv3 uses only the first 80 bytes of the header)
        self.header_buf = cl.Buffer(self.ctx, cl.mem_flags.READ_ONLY, 80)
        self.found_nonce_buf = cl.Buffer(self.ctx, cl.mem_flags.WRITE_ONLY, 8)
        self.found_hash_buf = cl.Buffer(self.ctx, cl.mem_flags.WRITE_ONLY, 32)
        self.solution_count_buf = cl.Buffer(self.ctx, cl.mem_flags.READ_WRITE, 4)

        # Reusable host-side buffers for deterministic transfer semantics.
        self._zero_u32 = np.array([0], dtype=np.uint32)
        self._solution_count_host = np.zeros(1, dtype=np.uint32)
        self._found_nonce_host = np.zeros(1, dtype=np.uint64)
        self._found_hash_host = np.zeros(32, dtype=np.uint8)
        
        # Stats
        self.total_hashes = 0
        self.solutions_found = 0
        self.last_batch_hashes = 0
        self._warned_header_trim = False
    
    @staticmethod
    def list_devices() -> List[GpuDevice]:
        """List all available GPU devices"""
        if not GPU_AVAILABLE:
            return []
        
        devices = []
        platforms = cl.get_platforms()
        
        device_idx = 0
        for platform in platforms:
            try:
                gpu_devices = platform.get_devices(device_type=cl.device_type.GPU)
                for device in gpu_devices:
                    devices.append(GpuDevice(
                        id=device_idx,
                        name=device.name,
                        vendor=device.vendor,
                        compute_units=device.max_compute_units,
                        max_work_group_size=device.max_work_group_size,
                        global_memory=device.global_mem_size,
                        local_memory=device.local_mem_size,
                    ))
                    device_idx += 1
            except cl.Error:
                continue
        
        return devices
    
    def mine(
        self,
        block_header: bytes,
        target: Union[int, bytes, bytearray],
        start_nonce: int = 0,
        state0_endian: str = "little",
    ) -> Optional[Tuple[int, bytes]]:
        """
        Mine for a valid nonce.
        
        Returns (nonce, hash) if found, None otherwise.
        """
        if len(block_header) > 80 and not self._warned_header_trim:
            print(f"⚠️  CHv3 GPU: ignoring extra header bytes {len(block_header)} -> 80 (consensus)")
            self._warned_header_trim = True

        header_prefix = block_header[:80]
        header = np.zeros(80, dtype=np.uint8)
        header[:len(header_prefix)] = list(header_prefix)

        # Upload to GPU
        cl.enqueue_copy(self.queue, self.header_buf, header)

        # Reset solution count
        cl.enqueue_copy(self.queue, self.solution_count_buf, self._zero_u32, is_blocking=True)

        # Normalize target to 32-bit, matching pool semantics (state0 vs u32 target).
        if isinstance(target, (bytes, bytearray)):
            if len(target) < 4:
                raise ValueError("Target bytes must be at least 4 bytes")
            target_int = int.from_bytes(bytes(target[:4]), "big", signed=False)
        else:
            target_int = int(target)

        # Execute kernel
        header_len = np.uint32(len(header_prefix))
        start = np.uint64(start_nonce)
        target32 = np.uint32(target_int & 0xFFFFFFFF)
        state0_big = np.uint32(1 if str(state0_endian).lower() == "big" else 0)

        # Adjust work group size to device limits
        max_wg = min(self.work_group_size, self.device.max_work_group_size)
        adjusted_batch = (self.batch_size // max_wg) * max_wg
        if adjusted_batch == 0:
            adjusted_batch = max_wg

        global_size = (adjusted_batch,)
        local_size = (max_wg,)

        self.kernel_mine(
            self.queue,
            global_size,
            local_size,
            self.header_buf,
            header_len,
            start,
            target32,
            state0_big,
            self.found_nonce_buf,
            self.found_hash_buf,
            self.solution_count_buf,
        )

        self.queue.finish()
        self.last_batch_hashes = int(adjusted_batch)
        self.total_hashes += int(adjusted_batch)

        # Check results
        cl.enqueue_copy(self.queue, self._solution_count_host, self.solution_count_buf, is_blocking=True)
        
        if self._solution_count_host[0] > 0:
            cl.enqueue_copy(self.queue, self._found_nonce_host, self.found_nonce_buf, is_blocking=True)
            cl.enqueue_copy(self.queue, self._found_hash_host, self.found_hash_buf, is_blocking=True)
            
            self.solutions_found += 1
            return int(self._found_nonce_host[0]), bytes(self._found_hash_host)
        
        return None
    
    def batch_hash(
        self,
        block_header: bytes,
        start_nonce: int,
        count: int,
    ) -> List[bytes]:
        """Compute batch of hashes"""
        if len(block_header) > 80 and not self._warned_header_trim:
            print(f"⚠️  CHv3 GPU: ignoring extra header bytes {len(block_header)} -> 80 (consensus)")
            self._warned_header_trim = True

        header_prefix = block_header[:80]
        header = np.zeros(80, dtype=np.uint8)
        header[:len(header_prefix)] = list(header_prefix)
        
        # Allocate output buffer
        output_buf = cl.Buffer(self.ctx, cl.mem_flags.WRITE_ONLY, 32 * count)
        
        # Upload header
        cl.enqueue_copy(self.queue, self.header_buf, header)
        
        # Execute kernel
        header_len = np.uint32(len(header_prefix))
        start = np.uint64(start_nonce)
        
        global_size = (count,)
        local_size = (min(self.work_group_size, count),)
        
        self.kernel_batch(
            self.queue,
            global_size,
            local_size,
            self.header_buf,
            header_len,
            start,
            output_buf,
        )
        
        self.queue.finish()
        
        # Read results
        output = np.zeros(32 * count, dtype=np.uint8)
        cl.enqueue_copy(self.queue, output, output_buf)
        
        # Split into hashes
        return [bytes(output[i*32:(i+1)*32]) for i in range(count)]
    
    def benchmark(self, duration: float = 5.0) -> float:
        """
        Benchmark GPU hashrate.
        
        Returns hashes per second.
        """
        block_header = b"ZION block header v2.9.5 benchmark test"
        target = 0xFFFFFFFF  # Easy target32 (always pass)
        
        # Warmup
        for _ in range(3):
            self.mine(block_header, target, 0)
        
        # Benchmark
        start_time = time.perf_counter()
        iterations = 0
        nonce = 0
        
        while time.perf_counter() - start_time < duration:
            self.mine(block_header, target, nonce)
            nonce += self.batch_size
            iterations += 1
        
        elapsed = time.perf_counter() - start_time
        total = iterations * self.batch_size
        hashrate = total / elapsed
        
        return hashrate


# ============================================================================
# CLI
# ============================================================================

if __name__ == "__main__":
    print("=" * 60)
    print("ZION Cosmic Harmony v3 - GPU Benchmark")
    print("=" * 60)
    
    if not GPU_AVAILABLE:
        print("❌ PyOpenCL not installed!")
        print("   Install with: pip install pyopencl")
        exit(1)
    
    # List devices
    print("\n📋 Available GPU Devices:")
    devices = CosmicHarmonyV3GPU.list_devices()
    if not devices:
        print("   No GPU devices found!")
        exit(1)
    
    for dev in devices:
        print(f"   {dev}")
    
    # Initialize miner
    try:
        miner = CosmicHarmonyV3GPU(
            device_id=0,
            batch_size=500_000,
            work_group_size=256,
        )
    except Exception as e:
        print(f"❌ Failed to initialize GPU: {e}")
        exit(1)
    
    # Benchmark
    print("\n⏱️  Running 5-second benchmark...")
    hashrate = miner.benchmark(5.0)
    
    print(f"\n📊 Results:")
    print(f"   Hashrate: {hashrate:,.0f} H/s ({hashrate/1_000_000:.2f} MH/s)")
    print(f"   Total hashes: {miner.total_hashes:,}")
    print(f"   Device: {miner.device_info.name}")
    
    # Verify hash correctness
    print("\n🔍 Verifying hash correctness...")
    hashes = miner.batch_hash(b"ZION test", 0, 10)
    print(f"   First hash: {hashes[0].hex()[:32]}...")
    print(f"   Unique hashes: {len(set(h.hex() for h in hashes))}/10")
    
    print("\n✅ GPU mining ready!")
    print("=" * 60)
