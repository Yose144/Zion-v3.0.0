"""
ZION Cosmic Harmony v4 — Metal GPU Backend (macOS M-series)
============================================================

Wraps libcosmic_harmony_v4_metal.dylib přes ctypes.
Rozhraní je drop-in náhrada za CosmicHarmonyV3GPU pro algo=cosmic_harmony.

Výkon: ~100-200 H/s na Apple M1 (limit je 40960 SHA3-512 ops/hash, memory-hard design).
Parity: GPU hash == CPU hash ✅ (5/5 batches, ověřeno 2026-03-05).

Usage:
    from cosmic_harmony_v4_metal_gpu import CosmicHarmonyV4MetalGPU, METAL_GPU_AVAILABLE

    if METAL_GPU_AVAILABLE:
        miner = CosmicHarmonyV4MetalGPU(batch_size=2048)
        result = miner.mine(header_bytes, target_bytes, start_nonce=0)
        if result:
            nonce, hash_bytes = result

Author: ZION AI Native Team
Version: 2.9.6
"""

import ctypes
import os
import platform
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Optional, Tuple


# ============================================================================
# Metal GPU availability check
# ============================================================================

METAL_GPU_AVAILABLE = False
_metal_lib: Optional[ctypes.CDLL] = None
_metal_device_name: str = "unknown"

def _load_metal_lib() -> Optional[ctypes.CDLL]:
    """Najde a načte libcosmic_harmony_v4_metal.dylib."""
    if platform.system() != "Darwin":
        return None

    this_file = Path(__file__).resolve()

    # Hledej v known lokacích
    search_dirs = [
        this_file.parent.parent,                         # resources/
        this_file.parent.parent / "native-libs",
        this_file.parent.parent.parent.parent / "L1" / "native-libs" / "all",
        Path(os.getcwd()),
    ]
    # Přidej DYLD_LIBRARY_PATH
    for d in os.environ.get("DYLD_LIBRARY_PATH", "").split(":"):
        if d:
            search_dirs.append(Path(d))

    for d in search_dirs:
        p = d / "libcosmic_harmony_v4_metal.dylib"
        if p.exists():
            try:
                lib = ctypes.CDLL(str(p))
                return lib
            except OSError:
                continue
    return None


def _setup_metal_lib(lib: ctypes.CDLL) -> None:
    """Nastaví argtypes/restype pro Metal GPU funkce."""
    lib.cosmic_harmony_v4_gpu_init.restype  = ctypes.c_int32
    lib.cosmic_harmony_v4_gpu_init.argtypes = [ctypes.c_uint32, ctypes.c_uint32]

    lib.cosmic_harmony_v4_gpu_mine.restype  = ctypes.c_int32
    lib.cosmic_harmony_v4_gpu_mine.argtypes = [
        ctypes.POINTER(ctypes.c_uint8),  # header
        ctypes.c_size_t,                 # header_len
        ctypes.c_uint64,                 # nonce_start
        ctypes.POINTER(ctypes.c_uint8),  # target[32]
        ctypes.POINTER(ctypes.c_uint64), # out: found_nonce
        ctypes.POINTER(ctypes.c_uint8),  # out: found_hash[32]
    ]

    # Cleanup (optional — called on process exit)
    try:
        lib.cosmic_harmony_v4_gpu_cleanup.restype  = None
        lib.cosmic_harmony_v4_gpu_cleanup.argtypes = []
    except AttributeError:
        pass


# Try to load at import time
_metal_lib = _load_metal_lib()
if _metal_lib is not None:
    try:
        _setup_metal_lib(_metal_lib)
        METAL_GPU_AVAILABLE = True
    except Exception as e:
        print(f"[CHv4-Metal] dylib load warning: {e}")
        _metal_lib = None


# ============================================================================
# Data classes
# ============================================================================

@dataclass
class MetalDeviceInfo:
    name: str
    memory_mb: int = 0
    platform_name: str = "Metal (Apple Silicon)"

    def __str__(self) -> str:
        return f"{self.name} [{self.platform_name}]"


# ============================================================================
# CosmicHarmonyV4MetalGPU
# ============================================================================

class CosmicHarmonyV4MetalGPU:
    """Metal GPU miner pro Cosmic Harmony v4 (CHv4).

    Drop-in náhrada za CosmicHarmonyV3GPU — stejné rozhraní:
      mine(header, target, start_nonce) -> (nonce, hash) | None
      .device_info.name
      .batch_size
    """

    def __init__(self, batch_size: int = 2048, device_id: int = 0):
        if not METAL_GPU_AVAILABLE or _metal_lib is None:
            raise RuntimeError(
                "libcosmic_harmony_v4_metal.dylib not available. "
                "Run: cd L1/native-libs/all && bash build_macos.sh"
            )

        # Clamp batch_size to power of 2 range the shader handles well
        batch_size = max(64, min(8192, batch_size))
        self._batch_size = batch_size
        self._device_id  = device_id
        self._lib        = _metal_lib
        self._initialized = False

        # Timing / hashrate tracking
        self._hashes_done: int = 0
        self._start_time: float = time.monotonic()

        # Init GPU
        rc = self._lib.cosmic_harmony_v4_gpu_init(device_id, batch_size)
        if rc != 0:
            raise RuntimeError(f"cosmic_harmony_v4_gpu_init failed with code {rc}")
        self._initialized = True

        # Build device_info (name is printed by the dylib during init)
        self.device_info = MetalDeviceInfo(name="Apple M-series (Metal)", memory_mb=0)

    # ── Property: batch_size ──────────────────────────────────────────────

    @property
    def batch_size(self) -> int:
        return self._batch_size

    @batch_size.setter
    def batch_size(self, value: int) -> None:
        value = max(64, min(8192, int(value)))
        if value != self._batch_size:
            self._batch_size = value
            # Re-init GPU with new batch size
            rc = self._lib.cosmic_harmony_v4_gpu_init(self._device_id, value)
            if rc != 0:
                raise RuntimeError(f"gpu_init re-init failed: {rc}")

    # ── Core method: mine ─────────────────────────────────────────────────

    def mine(
        self,
        header: bytes,
        target: bytes,
        start_nonce: int = 0,
        nonce_range: Optional[int] = None,  # ignored — batch_size controls range
        height: int = 0,                     # ignored — CHv4 always active
    ) -> Optional[Tuple[int, bytes]]:
        """Prohledá jeden batch nonces (= self.batch_size) na GPU.

        Returns:
            (found_nonce, hash_bytes) when a nonce produces hash <= target.
            None if no solution found in this batch.
        """
        if not self._initialized:
            raise RuntimeError("GPU not initialized")

        hdr = (ctypes.c_uint8 * len(header)).from_buffer_copy(header)
        tgt = (ctypes.c_uint8 * 32).from_buffer_copy(target[:32].ljust(32, b'\x00'))

        found_nonce = ctypes.c_uint64(0)
        found_hash  = (ctypes.c_uint8 * 32)()

        rc = self._lib.cosmic_harmony_v4_gpu_mine(
            hdr, len(header),
            ctypes.c_uint64(start_nonce),
            tgt,
            ctypes.byref(found_nonce),
            ctypes.cast(found_hash, ctypes.POINTER(ctypes.c_uint8)),
        )

        self._hashes_done += self._batch_size

        if rc == 1:
            return int(found_nonce.value), bytes(found_hash)
        if rc == 0:
            return None
        # rc < 0 = error
        raise RuntimeError(f"gpu_mine returned error code {rc}")

    # ── Hashrate ──────────────────────────────────────────────────────────

    @property
    def hashrate(self) -> float:
        """Celkový průměrný H/s od spuštění."""
        elapsed = time.monotonic() - self._start_time
        if elapsed < 0.1:
            return 0.0
        return self._hashes_done / elapsed

    # ── Cleanup ───────────────────────────────────────────────────────────

    def __del__(self):
        try:
            if self._initialized and hasattr(self._lib, 'cosmic_harmony_v4_gpu_cleanup'):
                self._lib.cosmic_harmony_v4_gpu_cleanup()
        except Exception:
            pass


# ============================================================================
# Quick self-test (run as script)
# ============================================================================

if __name__ == "__main__":
    print(f"METAL_GPU_AVAILABLE = {METAL_GPU_AVAILABLE}")
    if not METAL_GPU_AVAILABLE:
        print("Metal GPU not available on this system.")
        raise SystemExit(1)

    miner = CosmicHarmonyV4MetalGPU(batch_size=128)
    print(f"Device: {miner.device_info}")

    header = bytes(range(80))
    target  = bytes([0xff] * 32)  # accept everything

    t0 = time.monotonic()
    result = miner.mine(header, target, start_nonce=0)
    elapsed = time.monotonic() - t0

    if result:
        nonce, h = result
        print(f"Found nonce={nonce}, hash={h.hex()}")
        print(f"Elapsed: {elapsed:.2f}s → {int(128/elapsed)} H/s")
        print("PASS ✅")
    else:
        print("No nonce found (unexpected for target 0xff×32)")
        print("FAIL ❌")
