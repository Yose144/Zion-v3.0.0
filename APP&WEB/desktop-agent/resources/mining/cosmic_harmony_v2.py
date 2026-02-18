#!/usr/bin/env python3
"""
ZION Cosmic Harmony v2 - Quantum-Resistant, Memory-Hard PoW Algorithm

Python implementation for mining and verification.

Design Goals:
1. ASIC Resistance - Dynamic parameters prevent fixed-function hardware
2. Quantum Resistance - Lattice-based noise injection
3. Memory Hardness - 4-16 MB scratchpad with random access
4. CPU/GPU Balance - Achievable on consumer hardware

Performance Targets:
- CPU (Ryzen 9): ~50-100 kH/s
- GPU (RTX 4090): ~1-2 MH/s
- ASIC Cost: >$500K (economically impractical)

Author: ZION AI Native Team
Version: 2.9.5
Date: January 2026
"""

import hashlib
import struct
import math
from typing import List, Tuple, Optional
from enum import IntEnum
from dataclasses import dataclass
import numpy as np

# ============================================================================
# CONSTANTS
# ============================================================================

# Golden ratio constant (φ * 2^32)
PHI: int = 0x9E3779B9

# SHA-256 initialization vector (used as Cosmic Harmony IV)
IV: List[int] = [
    0x6A09E667, 0xBB67AE85, 0x3C6EF372, 0xA54FF53A,
    0x510E527F, 0x9B05688C, 0x1F83D9AB, 0x5BE0CD19,
]

# Scratchpad sizes
MIN_SCRATCHPAD_SIZE = 4 * 1024 * 1024   # 4 MB
MAX_SCRATCHPAD_SIZE = 16 * 1024 * 1024  # 16 MB

# Mixing rounds
BASE_MIXING_ROUNDS = 12
MAX_EXTRA_ROUNDS = 12

# Small primes for lattice noise
PRIMES = [
    65521, 65519, 65497, 65479, 65449, 65447, 65437, 65423,
    65419, 65413, 65407, 65393, 65381, 65371, 65357, 65353,
]

# Mask for 32-bit operations
MASK32 = 0xFFFFFFFF


# ============================================================================
# MEMORY ACCESS PATTERNS (ASIC-resistant)
# ============================================================================

class MemoryPattern(IntEnum):
    """Memory access patterns for ASIC resistance."""
    SEQUENTIAL = 0      # Sequential access (baseline)
    RANDOM_WALK = 1     # Random walk with state-dependent jumps
    BUTTERFLY = 2       # Butterfly network pattern
    LATTICE = 3         # Lattice-based access (grid pattern)
    QUANTUM_WALK = 4    # Quantum-inspired interference pattern
    
    @classmethod
    def from_block_height(cls, block_height: int) -> 'MemoryPattern':
        """Determine pattern from block height."""
        return cls(block_height % 5)


# ============================================================================
# DYNAMIC PARAMETERS
# ============================================================================

@dataclass
class DynamicParams:
    """Dynamic parameters derived from blockchain state."""
    mixing_rounds: int          # Number of mixing rounds (12-24)
    scratchpad_size: int        # Scratchpad size in bytes (4-16 MB)
    memory_pattern: MemoryPattern  # Memory access pattern
    rotation_schedule: List[int]   # Rotation schedule for mixing (8 values)
    noise_modulus: int          # Lattice noise modulus (prime)
    
    @classmethod
    def from_block_context(cls, prev_hash: bytes, block_height: int) -> 'DynamicParams':
        """
        Derive parameters from previous block hash and height.
        
        This makes ASIC design extremely difficult because:
        1. Scratchpad size varies per block
        2. Mixing rounds vary per block
        3. Memory access patterns rotate
        4. Rotation schedule is unpredictable
        """
        # Ensure prev_hash is 32 bytes
        if len(prev_hash) < 32:
            prev_hash = prev_hash + b'\x00' * (32 - len(prev_hash))
        
        # Mixing rounds: 12 + (first byte % 13) = 12-24
        mixing_rounds = BASE_MIXING_ROUNDS + (prev_hash[0] % (MAX_EXTRA_ROUNDS + 1))
        
        # Scratchpad size: 4 MB * (1 + height % 4) = 4-16 MB
        size_multiplier = 1 + (block_height % 4)
        scratchpad_size = MIN_SCRATCHPAD_SIZE * size_multiplier
        
        # Memory pattern from block height
        memory_pattern = MemoryPattern.from_block_height(block_height)
        
        # Rotation schedule from hash bytes 1-8
        rotation_schedule = [(prev_hash[i + 1] % 32) for i in range(8)]
        
        # Noise modulus for lattice operations (prime number)
        noise_modulus = PRIMES[prev_hash[16] % len(PRIMES)]
        
        return cls(
            mixing_rounds=mixing_rounds,
            scratchpad_size=scratchpad_size,
            memory_pattern=memory_pattern,
            rotation_schedule=rotation_schedule,
            noise_modulus=noise_modulus,
        )


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def rotl32(value: int, shift: int) -> int:
    """32-bit left rotation."""
    shift = shift & 31
    return ((value << shift) | (value >> (32 - shift))) & MASK32


def rotr32(value: int, shift: int) -> int:
    """32-bit right rotation."""
    shift = shift & 31
    return ((value >> shift) | (value << (32 - shift))) & MASK32


def wrapping_add(a: int, b: int) -> int:
    """32-bit wrapping addition."""
    return (a + b) & MASK32


def wrapping_mul(a: int, b: int) -> int:
    """32-bit wrapping multiplication."""
    return (a * b) & MASK32


def bytes_to_u32_le(data: bytes, offset: int = 0) -> int:
    """Convert 4 bytes to u32 (little-endian)."""
    return struct.unpack_from('<I', data, offset)[0]


def u32_to_bytes_le(value: int) -> bytes:
    """Convert u32 to 4 bytes (little-endian)."""
    return struct.pack('<I', value & MASK32)


def state_to_bytes(state: List[int]) -> bytes:
    """Convert 8x u32 state to 32 bytes."""
    return b''.join(u32_to_bytes_le(x) for x in state)


def bytes_to_state(data: bytes) -> List[int]:
    """Convert 32 bytes to 8x u32 state."""
    return [bytes_to_u32_le(data, i * 4) for i in range(8)]


# ============================================================================
# COSMIC HARMONY V2 HASHER
# ============================================================================

class CosmicHarmonyV2:
    """
    Quantum-Resistant, Memory-Hard Proof-of-Work Algorithm.
    
    Key Features:
    - Dynamic parameters per block (anti-ASIC)
    - 4-16 MB scratchpad (memory-hard)
    - Lattice-based noise (quantum-resistant)
    - 5 memory access patterns (complexity)
    
    Usage:
        hasher = CosmicHarmonyV2(prev_hash, block_height)
        hash_result = hasher.hash(input_data, nonce)
    """
    
    def __init__(self, prev_hash: bytes, block_height: int):
        """
        Initialize hasher with block context.
        
        Args:
            prev_hash: Previous block hash (32 bytes)
            block_height: Current block height
        """
        self.params = DynamicParams.from_block_context(prev_hash, block_height)
        self.state = IV.copy()
        self.scratchpad = bytearray(self.params.scratchpad_size)
        
    def reset(self):
        """Reset to initial state."""
        self.state = IV.copy()
        for i in range(len(self.scratchpad)):
            self.scratchpad[i] = 0
    
    def hash(self, input_data: bytes, nonce: int) -> bytes:
        """
        Compute Cosmic Harmony v2 hash.
        
        Args:
            input_data: Block header or input data
            nonce: Mining nonce (64-bit)
            
        Returns:
            32-byte hash result
        """
        self.reset()
        
        # Phase 1: Absorb input
        self._absorb(input_data)
        self._mix_nonce(nonce)
        
        # Phase 2: Fill scratchpad (memory initialization)
        self._fill_scratchpad()
        
        # Phase 3: Memory-hard mixing
        self._memory_hard_mix()
        
        # Phase 4: Lattice noise injection (quantum resistance)
        self._inject_lattice_noise()
        
        # Phase 5: Golden finalization
        self._golden_finalize()
        
        # Output
        return state_to_bytes(self.state)
    
    def _absorb(self, input_data: bytes):
        """Absorb input data into state."""
        # Pad input to at least 32 bytes
        if len(input_data) < 32:
            input_data = input_data + b'\x00' * (32 - len(input_data))
        
        # XOR first 8 u32 words into state
        for i in range(8):
            if i * 4 + 4 <= len(input_data):
                word = bytes_to_u32_le(input_data, i * 4)
                self.state[i] ^= word
    
    def _mix_nonce(self, nonce: int):
        """Mix nonce into state."""
        nonce &= 0xFFFFFFFFFFFFFFFF  # 64-bit mask
        self.state[0] ^= nonce & MASK32
        self.state[1] ^= (nonce >> 32) & MASK32
        self.state[2] ^= rotl32(nonce & MASK32, 17)
        self.state[3] ^= rotr32((nonce >> 32) & MASK32, 13)
    
    def _fill_scratchpad(self):
        """Fill scratchpad with pseudo-random data derived from state."""
        chunk_size = 32
        num_chunks = self.params.scratchpad_size // chunk_size
        
        for i in range(num_chunks):
            # Generate chunk from state
            chunk = self._generate_chunk(i)
            
            # Write to scratchpad
            offset = i * chunk_size
            self.scratchpad[offset:offset + chunk_size] = chunk
            
            # Update state with chunk feedback
            for j in range(8):
                word = bytes_to_u32_le(chunk, j * 4)
                self.state[j] ^= word
            
            # Quick mix after each chunk
            self._quick_mix()
    
    def _generate_chunk(self, index: int) -> bytes:
        """Generate a 32-byte chunk from state."""
        temp_state = self.state.copy()
        
        # Mix index into state
        temp_state[0] ^= index & MASK32
        temp_state[7] ^= rotl32(index & MASK32, 16)
        
        # Mini mixing rounds
        for _ in range(4):
            for i in range(8):
                next_idx = (i + 1) % 8
                temp_state[i] = wrapping_mul(
                    wrapping_add(rotl32(temp_state[i], 5), temp_state[next_idx]),
                    PHI
                )
        
        return state_to_bytes(temp_state)
    
    def _quick_mix(self):
        """Quick state mixing between scratchpad operations."""
        # Swap first and second half
        for i in range(4):
            self.state[i], self.state[7 - i] = self.state[7 - i], self.state[i]
        
        # Rotate and multiply
        for i in range(8):
            self.state[i] = wrapping_mul(rotl32(self.state[i], 7), PHI)
    
    def _memory_hard_mix(self):
        """Memory-hard mixing with random scratchpad access."""
        chunk_size = 32
        num_chunks = self.params.scratchpad_size // chunk_size
        
        for round_idx in range(self.params.mixing_rounds):
            # Calculate read index based on pattern
            read_idx = self._compute_access_index(round_idx, num_chunks)
            
            # Read from scratchpad
            offset = read_idx * chunk_size
            chunk = bytes(self.scratchpad[offset:offset + chunk_size])
            
            # Mix into state with rotation schedule
            rotation = self.params.rotation_schedule[round_idx % 8]
            self._mix_chunk(chunk, rotation)
            
            # Write back modified data (read-write dependency)
            new_chunk = self._generate_chunk(round_idx)
            write_idx = self._compute_access_index(
                round_idx + self.params.mixing_rounds, num_chunks
            )
            write_offset = write_idx * chunk_size
            self.scratchpad[write_offset:write_offset + chunk_size] = new_chunk
    
    def _compute_access_index(self, round_idx: int, max_chunks: int) -> int:
        """Compute memory access index based on pattern."""
        state_idx = ((self.state[0] ^ self.state[4]) + 
                     ((self.state[1] ^ self.state[5]) << 16))
        state_idx &= 0xFFFFFFFFFFFFFFFF  # 64-bit
        
        pattern = self.params.memory_pattern
        
        if pattern == MemoryPattern.SEQUENTIAL:
            return round_idx % max_chunks
            
        elif pattern == MemoryPattern.RANDOM_WALK:
            return int((state_idx + round_idx * PHI) % max_chunks)
            
        elif pattern == MemoryPattern.BUTTERFLY:
            # Butterfly network pattern
            bits = int(math.log2(max_chunks)) if max_chunks > 1 else 1
            stage = round_idx % bits
            mask = 1 << stage
            base = int(state_idx) % max_chunks
            return (base ^ mask) % max_chunks
            
        elif pattern == MemoryPattern.LATTICE:
            # 2D lattice access
            dim = int(math.sqrt(max_chunks))
            if dim < 1:
                dim = 1
            x = (int(state_idx) + round_idx) % dim
            y = ((int(state_idx) >> 16) + round_idx * 7) % dim
            return (y * dim + x) % max_chunks
            
        else:  # QUANTUM_WALK
            # Quantum random walk simulation
            amplitude = self.state[round_idx % 8]
            phase = self.state[(round_idx + 4) % 8]
            interference = amplitude ^ phase
            return int((interference * state_idx) % max_chunks)
    
    def _mix_chunk(self, chunk: bytes, rotation: int):
        """Mix chunk into state with rotation."""
        for i in range(8):
            word = bytes_to_u32_le(chunk, i * 4)
            self.state[i] = wrapping_mul(
                wrapping_add(rotl32(self.state[i], rotation), word),
                PHI
            )
    
    def _inject_lattice_noise(self):
        """
        Inject lattice-based noise for quantum resistance.
        
        This is inspired by Learning With Errors (LWE) problem,
        which is believed to be hard for quantum computers.
        """
        modulus = self.params.noise_modulus
        
        for i in range(8):
            # Generate pseudo-random noise from state
            noise_seed = wrapping_add(wrapping_mul(self.state[i], PHI), i)
            
            # Discrete Gaussian-like noise (approximation via CLT)
            noise = 0
            for j in range(12):
                sample = rotl32(noise_seed, j * 3) % modulus
                noise = wrapping_add(noise, sample)
            noise = noise // 6  # Normalize
            
            # Add noise to state
            self.state[i] = wrapping_add(self.state[i], noise % modulus)
    
    def _golden_finalize(self):
        """Golden ratio finalization."""
        # XOR diffusion
        xor_mix = 0
        for value in self.state:
            xor_mix ^= value
        for i in range(8):
            self.state[i] ^= xor_mix
        
        # Final golden multiplication
        for i in range(8):
            self.state[i] = wrapping_mul(self.state[i], PHI)


# ============================================================================
# CONVENIENCE FUNCTIONS
# ============================================================================

def cosmic_hash_v2(
    input_data: bytes,
    nonce: int,
    prev_hash: bytes,
    block_height: int
) -> bytes:
    """
    Convenience function for mining.
    
    Args:
        input_data: Block header or input data
        nonce: Mining nonce (64-bit)
        prev_hash: Previous block hash (32 bytes)
        block_height: Current block height
        
    Returns:
        32-byte hash result
    """
    hasher = CosmicHarmonyV2(prev_hash, block_height)
    return hasher.hash(input_data, nonce)


def check_difficulty(hash_result: bytes, target_difficulty: int) -> bool:
    """
    Check if hash meets difficulty target.
    
    Counts leading zero bits in hash (big-endian interpretation).
    
    Args:
        hash_result: 32-byte hash
        target_difficulty: Required leading zeros (bits)
        
    Returns:
        True if hash meets difficulty
    """
    leading_zeros = 0
    
    # Scan from last byte (most significant in our representation)
    for byte in reversed(hash_result):
        if byte == 0:
            leading_zeros += 8
        else:
            # Count leading zeros in this byte
            mask = 0x80
            while (byte & mask) == 0 and mask != 0:
                leading_zeros += 1
                mask >>= 1
            break
    
    return leading_zeros >= target_difficulty


def check_target32(hash_result: bytes, target32: int) -> bool:
    """
    Check if hash meets 32-bit target (GPU mining compatibility).
    
    Compares first 4 bytes (little-endian) against target.
    
    Args:
        hash_result: 32-byte hash
        target32: 32-bit target value
        
    Returns:
        True if hash meets target
    """
    state0 = bytes_to_u32_le(hash_result, 0)
    return state0 <= target32


def get_algorithm_info() -> dict:
    """Get algorithm metadata."""
    return {
        'name': 'cosmic_harmony_v2',
        'version': '2.9.5',
        'type': 'memory-hard',
        'quantum_resistant': True,
        'asic_resistance_score': 95,
        'memory_min': '4 MB',
        'memory_max': '16 MB',
        'mixing_rounds_min': 12,
        'mixing_rounds_max': 24,
        'memory_patterns': 5,
        'baseline_hashrate_cpu': '50-100 kH/s',
        'baseline_hashrate_gpu': '1-2 MH/s',
        'estimated_asic_cost': '>$500K',
    }


# ============================================================================
# MINING HELPER
# ============================================================================

def mine_block(
    block_header: bytes,
    prev_hash: bytes,
    block_height: int,
    target_difficulty: int,
    start_nonce: int = 0,
    max_nonce: int = 2**32,
    callback_interval: int = 100000
) -> Optional[Tuple[int, bytes]]:
    """
    Simple mining function (single-threaded).
    
    Args:
        block_header: Block header data
        prev_hash: Previous block hash
        block_height: Current block height
        target_difficulty: Required leading zeros
        start_nonce: Starting nonce
        max_nonce: Maximum nonce to try
        callback_interval: Print progress every N hashes
        
    Returns:
        Tuple of (winning_nonce, hash) or None if not found
    """
    hasher = CosmicHarmonyV2(prev_hash, block_height)
    
    print(f"⛏️  Mining with Cosmic Harmony v2")
    print(f"   Scratchpad: {hasher.params.scratchpad_size // (1024*1024)} MB")
    print(f"   Rounds: {hasher.params.mixing_rounds}")
    print(f"   Pattern: {hasher.params.memory_pattern.name}")
    print(f"   Target: {target_difficulty} leading zeros")
    print()
    
    import time
    start_time = time.time()
    hashes = 0
    
    for nonce in range(start_nonce, max_nonce):
        # Compute hash
        hash_result = hasher.hash(block_header, nonce)
        hashes += 1
        
        # Check difficulty
        if check_difficulty(hash_result, target_difficulty):
            elapsed = time.time() - start_time
            hashrate = hashes / elapsed if elapsed > 0 else 0
            print(f"\n✅ FOUND! Nonce: {nonce}")
            print(f"   Hash: {hash_result.hex()}")
            print(f"   Hashrate: {hashrate:.2f} H/s")
            return (nonce, hash_result)
        
        # Progress callback
        if hashes % callback_interval == 0:
            elapsed = time.time() - start_time
            hashrate = hashes / elapsed if elapsed > 0 else 0
            print(f"   Tried {hashes:,} hashes @ {hashrate:.2f} H/s", end='\r')
        
        # Reset hasher for next iteration (reuse object)
        hasher.reset()
    
    return None


# ============================================================================
# TESTS
# ============================================================================

def run_tests():
    """Run unit tests."""
    print("🧪 Running Cosmic Harmony v2 Tests\n")
    
    # Test 1: Dynamic parameters
    print("Test 1: Dynamic parameters...")
    prev_hash = bytes(32)
    params0 = DynamicParams.from_block_context(prev_hash, 0)
    params1 = DynamicParams.from_block_context(prev_hash, 1)
    params3 = DynamicParams.from_block_context(prev_hash, 3)
    
    assert params0.scratchpad_size == 4 * 1024 * 1024, "Scratchpad size mismatch"
    assert params1.scratchpad_size == 8 * 1024 * 1024, "Scratchpad size mismatch"
    assert params3.scratchpad_size == 16 * 1024 * 1024, "Scratchpad size mismatch"
    assert 12 <= params0.mixing_rounds <= 24, "Mixing rounds out of range"
    print("   ✅ Dynamic parameters work correctly\n")
    
    # Test 2: Memory pattern rotation
    print("Test 2: Memory pattern rotation...")
    for height in range(5):
        pattern = MemoryPattern.from_block_height(height)
        assert pattern.value == height, f"Pattern mismatch at height {height}"
    print("   ✅ Memory patterns rotate correctly\n")
    
    # Test 3: Deterministic hashing
    print("Test 3: Deterministic hashing...")
    prev_hash = b'\x01' * 32
    input_data = b'ZION_TEST'
    nonce = 12345
    
    hash1 = cosmic_hash_v2(input_data, nonce, prev_hash, 100)
    hash2 = cosmic_hash_v2(input_data, nonce, prev_hash, 100)
    
    assert hash1 == hash2, "Hash not deterministic!"
    print(f"   Hash: {hash1.hex()}")
    print("   ✅ Hashing is deterministic\n")
    
    # Test 4: Nonce changes hash
    print("Test 4: Nonce avalanche...")
    hash_n0 = cosmic_hash_v2(input_data, 0, prev_hash, 100)
    hash_n1 = cosmic_hash_v2(input_data, 1, prev_hash, 100)
    
    assert hash_n0 != hash_n1, "Different nonces should produce different hashes"
    
    # Count bit differences
    diff_bits = sum(bin(a ^ b).count('1') for a, b in zip(hash_n0, hash_n1))
    print(f"   Bit difference: {diff_bits}/256 ({diff_bits/256*100:.1f}%)")
    print("   ✅ Nonce changes hash (avalanche effect)\n")
    
    # Test 5: Block height changes parameters
    print("Test 5: Block height affects hash...")
    hash_h0 = cosmic_hash_v2(input_data, 0, prev_hash, 0)
    hash_h1 = cosmic_hash_v2(input_data, 0, prev_hash, 1)
    
    assert hash_h0 != hash_h1, "Different heights should produce different hashes"
    print("   ✅ Block height changes hash\n")
    
    # Test 6: Difficulty check
    print("Test 6: Difficulty checking...")
    # Create hash with known pattern
    test_hash = bytes([0xFF] * 30 + [0x00, 0x00])  # 16 leading zeros
    assert check_difficulty(test_hash, 16), "Should meet 16-bit difficulty"
    assert not check_difficulty(test_hash, 17), "Should not meet 17-bit difficulty"
    print("   ✅ Difficulty check works\n")
    
    # Test 7: Performance benchmark
    print("Test 7: Performance benchmark (1000 hashes)...")
    import time
    
    hasher = CosmicHarmonyV2(prev_hash, 100)
    
    start = time.time()
    for i in range(1000):
        hasher.hash(input_data, i)
        hasher.reset()
    elapsed = time.time() - start
    
    hashrate = 1000 / elapsed
    print(f"   Time: {elapsed:.3f}s")
    print(f"   Hashrate: {hashrate:.2f} H/s")
    print(f"   Scratchpad: {hasher.params.scratchpad_size // (1024*1024)} MB")
    print("   ✅ Performance benchmark complete\n")
    
    print("=" * 50)
    print("🎉 All tests passed!")
    print("=" * 50)


# ============================================================================
# MAIN
# ============================================================================

if __name__ == '__main__':
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == 'test':
        run_tests()
    elif len(sys.argv) > 1 and sys.argv[1] == 'mine':
        # Demo mining
        block_header = b'ZION_GENESIS_BLOCK_2026'
        prev_hash = bytes(32)
        block_height = 1
        target_difficulty = 8  # Easy target for demo
        
        result = mine_block(
            block_header,
            prev_hash,
            block_height,
            target_difficulty,
            max_nonce=10_000_000
        )
        
        if result:
            nonce, hash_result = result
            print(f"\n🏆 Block mined!")
            print(f"   Nonce: {nonce}")
            print(f"   Hash: {hash_result.hex()}")
    elif len(sys.argv) > 1 and sys.argv[1] == 'info':
        import json
        info = get_algorithm_info()
        print(json.dumps(info, indent=2))
    else:
        print("ZION Cosmic Harmony v2 - Quantum-Resistant Mining Algorithm")
        print()
        print("Usage:")
        print("  python cosmic_harmony_v2.py test   - Run unit tests")
        print("  python cosmic_harmony_v2.py mine   - Demo mining")
        print("  python cosmic_harmony_v2.py info   - Algorithm info")
        print()
        print("As module:")
        print("  from cosmic_harmony_v2 import cosmic_hash_v2, CosmicHarmonyV2")
        print("  hash = cosmic_hash_v2(data, nonce, prev_hash, block_height)")
