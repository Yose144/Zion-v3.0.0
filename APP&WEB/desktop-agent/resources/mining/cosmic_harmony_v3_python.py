"""
ZION Cosmic Harmony v3 — Pure Python Fallback
==============================================

Implements the CHv3 hash algorithm in pure Python for when the
native Rust FFI library is unavailable (e.g. blocked by Defender).

Pipeline (legacy, height < 50,000):
    Input(80B header + 8B LE nonce)
    → Keccak-256 → SHA3-512 → Golden Matrix → Cosmic Fusion → 32B hash

Keccak-256 uses pre-SHA3 padding (0x01), NOT FIPS-202 SHA3-256 (0x06).
SHA3-512 uses FIPS-202 padding (0x06) via hashlib.

Performance: ~5–30 kH/s per thread (depending on CPU + Keccak impl).
"""

import hashlib
import struct
from typing import List, Optional

# ---------------------------------------------------------------------------
# Memory-hard fork height — below this we use legacy (fast) pipeline
# ---------------------------------------------------------------------------
CHV3_MEMORY_HARD_FORK_HEIGHT = 50_000

# ---------------------------------------------------------------------------
# Keccak-256 (pre-SHA3, padding byte 0x01)
# ---------------------------------------------------------------------------

# Try high-performance C-backed implementations first
_keccak256_impl = None

try:
    from Crypto.Hash import keccak as _pycryptodome_keccak  # pycryptodome

    def _keccak256_pycryptodome(data: bytes) -> bytes:
        return _pycryptodome_keccak.new(data=data, digest_bits=256).digest()

    _keccak256_impl = _keccak256_pycryptodome
except ImportError:
    pass

if _keccak256_impl is None:
    try:
        import sha3 as _pysha3  # pysha3

        def _keccak256_pysha3(data: bytes) -> bytes:
            return _pysha3.keccak_256(data).digest()

        _keccak256_impl = _keccak256_pysha3
    except ImportError:
        pass

if _keccak256_impl is None:
    # -----------------------------------------------------------------------
    # Minimal pure-Python Keccak-f[1600] + sponge  (fallback of last resort)
    # -----------------------------------------------------------------------
    # Reference: https://keccak.team/keccak_specs_summary.html

    _KECCAK_RC = [
        0x0000000000000001, 0x0000000000008082, 0x800000000000808A,
        0x8000000080008000, 0x000000000000808B, 0x0000000080000001,
        0x8000000080008081, 0x8000000000008009, 0x000000000000008A,
        0x0000000000000088, 0x0000000080008009, 0x000000008000000A,
        0x000000008000808B, 0x800000000000008B, 0x8000000000008089,
        0x8000000000008003, 0x8000000000008002, 0x8000000000000080,
        0x000000000000800A, 0x800000008000000A, 0x8000000080008081,
        0x8000000000008080, 0x0000000080000001, 0x8000000080008008,
    ]

    _KECCAK_ROT = [
        [0, 36, 3, 41, 18],
        [1, 44, 10, 45, 2],
        [62, 6, 43, 15, 61],
        [28, 55, 25, 21, 56],
        [27, 20, 39, 8, 14],
    ]

    _MASK64 = (1 << 64) - 1

    def _rot64(x: int, n: int) -> int:
        return ((x << n) | (x >> (64 - n))) & _MASK64

    def _keccak_f1600(state: list) -> list:
        """Keccak-f[1600] permutation on 5×5 array of u64."""
        A = list(state)
        for rc in _KECCAK_RC:
            # θ
            C = [A[x] ^ A[x + 5] ^ A[x + 10] ^ A[x + 15] ^ A[x + 20] for x in range(5)]
            D = [C[(x - 1) % 5] ^ _rot64(C[(x + 1) % 5], 1) for x in range(5)]
            A = [(A[i] ^ D[i % 5]) & _MASK64 for i in range(25)]
            # ρ and π
            B = [0] * 25
            for x in range(5):
                for y in range(5):
                    B[y * 5 + ((2 * x + 3 * y) % 5)] = _rot64(A[x + 5 * y], _KECCAK_ROT[y][x])
            # χ
            A = [
                (B[i] ^ ((~B[((i // 5) * 5 + (i % 5 + 1) % 5)]) & B[((i // 5) * 5 + (i % 5 + 2) % 5)])) & _MASK64
                for i in range(25)
            ]
            # ι
            A[0] = (A[0] ^ rc) & _MASK64
        return A

    def _keccak_sponge(data: bytes, rate_bytes: int, capacity_bytes: int,
                       suffix: int, output_len: int) -> bytes:
        """Generic Keccak sponge construction."""
        state = [0] * 25
        # Absorb
        block_size = rate_bytes
        # Pad: data || suffix || 0*...0 || 0x80  (multi-rate padding)
        padded = bytearray(data)
        padded.append(suffix)
        while len(padded) % block_size != 0:
            padded.append(0)
        padded[-1] |= 0x80

        for offset in range(0, len(padded), block_size):
            for i in range(block_size // 8):
                lane = int.from_bytes(padded[offset + i * 8: offset + i * 8 + 8], 'little')
                state[i] ^= lane
            state = _keccak_f1600(state)

        # Squeeze
        out = bytearray()
        while len(out) < output_len:
            for i in range(min(rate_bytes // 8, (output_len - len(out) + 7) // 8)):
                out.extend(state[i].to_bytes(8, 'little'))
            if len(out) < output_len:
                state = _keccak_f1600(state)
        return bytes(out[:output_len])

    def _keccak256_pure(data: bytes) -> bytes:
        """Keccak-256 (pre-SHA3): rate=1088 bits (136 bytes), capacity=512 bits, suffix=0x01."""
        return _keccak_sponge(data, rate_bytes=136, capacity_bytes=64, suffix=0x01, output_len=32)

    _keccak256_impl = _keccak256_pure


def keccak_256(data: bytes) -> bytes:
    """Compute Keccak-256 hash (pre-SHA3, padding 0x01)."""
    return _keccak256_impl(data)


# ---------------------------------------------------------------------------
# SHA3-512 (FIPS 202) — always via hashlib
# ---------------------------------------------------------------------------

def sha3_512(data: bytes) -> bytes:
    """Compute SHA3-512 hash (FIPS 202)."""
    return hashlib.sha3_512(data).digest()


# ---------------------------------------------------------------------------
# Golden Matrix (Step 3)
# ---------------------------------------------------------------------------

PHI_POWERS_FP = [
    4294967296,
    6949403065,
    11244370361,
    18193773427,
    29438143788,
    47631917215,
    77070061004,
    124701978219,
    201772039223,
    326474017443,
    528246056666,
    854720074109,
    1382966130776,
    2237686204885,
    3620652335660,
    5858338540545,
]

_U64_MASK = 0xFFFFFFFFFFFFFFFF


def golden_matrix(input_64: bytes) -> bytes:
    """Golden Matrix transform: 64-byte input → 64-byte output."""
    input_len = len(input_64)
    # Fill 8×8 matrix from input bytes (wrapping)
    matrix = [[0] * 8 for _ in range(8)]
    for i in range(8):
        base = i * 8
        for j in range(8):
            matrix[i][j] = input_64[(base + j) % input_len]

    result = [0] * 8
    for i in range(8):
        total = 0
        row = matrix[i]
        for j in range(8):
            total += row[j] * PHI_POWERS_FP[i + j]
        result[i] = (total >> 32) & _U64_MASK

    out = bytearray(64)
    for i in range(8):
        struct.pack_into('<Q', out, i * 8, result[i])
    return bytes(out)


# ---------------------------------------------------------------------------
# Cosmic Fusion (Step 5)
# ---------------------------------------------------------------------------

COSMIC_XOR_MASK = bytes([
    0x74, 0x9D, 0x30, 0x60, 0x74, 0x9D, 0x30, 0x60,
    0x74, 0x9D, 0x30, 0x60, 0x74, 0x9D, 0x30, 0x60,
    0x74, 0x9D, 0x30, 0x60, 0x74, 0x9D, 0x30, 0x60,
    0x74, 0x9D, 0x30, 0x60, 0x74, 0x9D, 0x30, 0x60,
])


def cosmic_fusion(input_64: bytes) -> bytes:
    """Cosmic Fusion: 64-byte input → 32-byte output."""
    state = bytearray(64)
    copy_len = min(len(input_64), 64)
    state[:copy_len] = input_64[:copy_len]

    for round_num in range(4):
        intermediate = keccak_256(bytes(state[:32]) + bytes([round_num]))
        for i in range(32):
            state[i] = intermediate[i] ^ COSMIC_XOR_MASK[i]

    final = sha3_512(bytes(state[:32]))
    return final[:32]


# ---------------------------------------------------------------------------
# CHv3 Legacy Pipeline (height < 50,000)
# ---------------------------------------------------------------------------

def cosmic_harmony_v3_legacy(block_header: bytes, nonce: int) -> bytes:
    """
    Cosmic Harmony v3 LEGACY pipeline (no scratchpad).
    
    Steps: Keccak-256 → SHA3-512 → Golden Matrix → Cosmic Fusion → 32B hash
    """
    # Prepare 88-byte input: header(80) || nonce(8 LE)
    inp = bytearray(88)
    copy_len = min(len(block_header), 80)
    inp[:copy_len] = block_header[:copy_len]
    struct.pack_into('<Q', inp, 80, nonce & _U64_MASK)

    step1 = keccak_256(bytes(inp))       # 32 bytes
    step2 = sha3_512(step1)              # 64 bytes
    step3 = golden_matrix(step2)         # 64 bytes
    return cosmic_fusion(step3)          # 32 bytes


# ---------------------------------------------------------------------------
# Height-aware hash (matches pool consensus)
# ---------------------------------------------------------------------------

def cosmic_harmony_v3_hash(block_header: bytes, nonce: int, height: int = 0) -> bytes:
    """
    Compute CHv3 hash with height-aware variant selection.
    
    - height < 50,000: legacy (fast, no scratchpad)
    - height >= 50,000: full (memory-hard) — NOT YET IMPLEMENTED in Python fallback
    
    The nonce is XORed with height (consensus rule from FFI audit C-04).
    """
    effective_nonce = (nonce ^ height) & _U64_MASK

    if height >= CHV3_MEMORY_HARD_FORK_HEIGHT:
        raise NotImplementedError(
            f"Python CHv3 fallback does not support memory-hard pipeline "
            f"(height={height} >= {CHV3_MEMORY_HARD_FORK_HEIGHT}). "
            f"Build the native Rust library."
        )

    return cosmic_harmony_v3_legacy(block_header, effective_nonce)


# ---------------------------------------------------------------------------
# Public API matching CosmicHarmonyNative interface
# ---------------------------------------------------------------------------

class CosmicHarmonyV3Python:
    """
    Pure Python CHv3 hasher — drop-in replacement for CosmicHarmonyNative.
    
    Supports the legacy pipeline (height < 50,000).
    Performance: ~5–30 kH/s depending on Keccak implementation.
    """

    def __init__(self):
        import multiprocessing
        self._cpu_count = multiprocessing.cpu_count()
        # Detect which Keccak backend is active
        if _keccak256_impl.__name__ == '_keccak256_pycryptodome':
            self._backend = 'pycryptodome'
        elif _keccak256_impl.__name__ == '_keccak256_pysha3':
            self._backend = 'pysha3'
        else:
            self._backend = 'pure-python'
        print(f"🐍 ZION CHv3 Python fallback loaded (Keccak: {self._backend})")

    @property
    def version(self) -> int:
        return 1

    @property
    def cpu_count(self) -> int:
        return self._cpu_count

    @property
    def backend(self) -> str:
        return self._backend

    def hash(self, block_header: bytes, nonce: int) -> bytes:
        """Hash WITHOUT height awareness (uses legacy, nonce as-is). For testing."""
        bh = bytes(block_header)
        if len(bh) > 80:
            bh = bh[:80]
        return cosmic_harmony_v3_legacy(bh, nonce)

    def hash_with_height(self, block_header: bytes, nonce: int, height: int) -> bytes:
        """Hash WITH height awareness (nonce XOR height, legacy/full selection)."""
        bh = bytes(block_header)
        if len(bh) > 80:
            bh = bh[:80]
        return cosmic_harmony_v3_hash(bh, nonce, height)

    def batch_hash(self, block_header: bytes, start_nonce: int, count: int) -> list:
        """Batch hash (sequential, for compatibility)."""
        bh = bytes(block_header)
        if len(bh) > 80:
            bh = bh[:80]
        return [cosmic_harmony_v3_legacy(bh, start_nonce + i) for i in range(count)]

    def batch_hash_with_height(
        self, block_header: bytes, start_nonce: int, count: int, height: int
    ) -> list:
        """Batch hash with height awareness."""
        bh = bytes(block_header)
        if len(bh) > 80:
            bh = bh[:80]
        return [cosmic_harmony_v3_hash(bh, start_nonce + i, height) for i in range(count)]
