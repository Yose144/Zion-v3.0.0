"""
ZION Cosmic Harmony v4 — Native Python Bindings
================================================

High-performance CHv4 mining library používající libcosmic_harmony.dylib/.so přes FFI.

CHv4 pipeline: Keccak-256 → SHA3-512 → GoldenMatrix → MemoryHard (512 KiB)
               → NPU Mixing (INT8 MLP 64→128→64 + GELU + residual) → CosmicFusion

Multi-threaded batch mining: každé vlákno volá přímo nativní lib (ctypes thread-safe),
žádný GIL problém (GIL se uvolňuje v ctypes C callech).

Usage:
    from cosmic_harmony_v4_native import CosmicHarmonyV4Native

    miner = CosmicHarmonyV4Native()
    print(miner.version)

    # Single hash
    h = miner.hash(b"ZION header" + b"\\x00"*69, nonce=12345)
    print(h.hex())

    # Multi-threaded batch (doporučeno pro mining)
    found, nonce, hash_bytes = miner.find_nonce_mt(
        header=b"ZION header" + b"\\x00"*69,
        target=bytes.fromhex("0000ffff" + "00"*28),
        start_nonce=0,
        batch_size=100,
        threads=None   # None = os.cpu_count()
    )

Author: ZION AI Native Team
Version: 2.9.6
Date: March 2026
"""

import ctypes
import os
import platform
import struct
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Optional, Tuple


# ============================================================================
# Library Discovery
# ============================================================================

def _find_chv4_library() -> str:
    """Najde libcosmic_harmony.dylib/.so v known lokacích."""
    system = platform.system()
    machine = platform.machine()

    lib_names = {
        "Darwin": "libcosmic_harmony.dylib",
        "Linux":  "libcosmic_harmony.so.2.9.0",
        "Windows": "cosmic_harmony.dll",
    }
    name = lib_names.get(system, "libcosmic_harmony.so")

    # Fallback name pro Linux (symlink)
    fallback_names = {
        "Linux":  ["libcosmic_harmony.so", "libcosmic_harmony.so.2"],
    }

    this_file = Path(__file__).resolve()
    project_root = this_file

    # Hledej project root (přejdi nahoru k 2.9.6/)
    for _ in range(10):
        if (project_root / "Cargo.toml").exists():
            break
        project_root = project_root.parent

    search_paths = [
        project_root / "L1" / name,
        project_root / "L1" / "native-libs" / name,
        project_root / "L1" / "native-libs" / "all" / name,
        project_root / name,
        # Electron packaged: resources/native-libs/ (bundled by prepare-rust-miner.js)
        this_file.parent.parent / "native-libs" / name,
        # Also directly in resources/
        this_file.parent.parent / name,
        this_file.parent / name,
        this_file.parent / "lib" / name,
        Path("/usr/local/lib") / name,
        Path("/usr/lib") / name,
        Path("/usr/lib/x86_64-linux-gnu") / name,
    ]

    for p in search_paths:
        if p.exists():
            return str(p)

    # Fallback names
    for alt in fallback_names.get(system, []):
        for base in [project_root / "L1", project_root, this_file.parent]:
            p = base / alt
            if p.exists():
                return str(p)

    raise FileNotFoundError(
        f"Nelze najít {name}. Sestavte jej:\n"
        f"  cd {project_root}/L1/native-libs/all\n"
        f"  bash build_macos.sh   # nebo build_linux.sh"
    )


# ============================================================================
# FFI Setup
# ============================================================================

def _setup_lib(lib: ctypes.CDLL) -> None:
    """Nastavení prototypů funkcí pro správné volání a bezpečnost typů."""

    # cosmic_harmony_v4_hash(header, header_len, nonce, height, output) → int
    lib.cosmic_harmony_v4_hash.argtypes = [
        ctypes.POINTER(ctypes.c_uint8),   # header
        ctypes.c_size_t,                   # header_len
        ctypes.c_uint64,                   # nonce
        ctypes.c_uint64,                   # height
        ctypes.POINTER(ctypes.c_uint8),   # output [32]
    ]
    lib.cosmic_harmony_v4_hash.restype = ctypes.c_int

    # cosmic_harmony_hash (compatibility alias → v4)
    lib.cosmic_harmony_hash.argtypes = lib.cosmic_harmony_v4_hash.argtypes
    lib.cosmic_harmony_hash.restype  = ctypes.c_int

    # cosmic_harmony_v4_get_info() → const char*
    lib.cosmic_harmony_v4_get_info.argtypes = []
    lib.cosmic_harmony_v4_get_info.restype  = ctypes.c_char_p

    # cosmic_harmony_v4_has_neon() → int
    lib.cosmic_harmony_v4_has_neon.argtypes = []
    lib.cosmic_harmony_v4_has_neon.restype  = ctypes.c_int

    # cosmic_harmony_v4_has_avx2() → int
    lib.cosmic_harmony_v4_has_avx2.argtypes = []
    lib.cosmic_harmony_v4_has_avx2.restype  = ctypes.c_int

    # cosmic_harmony_v4_benchmark(seconds) → double
    lib.cosmic_harmony_v4_benchmark.argtypes = [ctypes.c_int]
    lib.cosmic_harmony_v4_benchmark.restype  = ctypes.c_double

    # cosmic_harmony_v4_gpu_count() → uint32
    lib.cosmic_harmony_v4_gpu_count.argtypes = []
    lib.cosmic_harmony_v4_gpu_count.restype  = ctypes.c_uint32


# ============================================================================
# Thread-local state
# ============================================================================

_tl = threading.local()

def _get_lib(lib_path: str) -> ctypes.CDLL:
    """Vrátí thread-local instanci loaded library (ctypes je thread-safe při volání)."""
    # ctypes.CDLL je sdílena — jeden load, voláme z více vláken bezpečně
    if not hasattr(_tl, "lib"):
        _tl.lib = ctypes.CDLL(lib_path)
        _setup_lib(_tl.lib)
    return _tl.lib


# ============================================================================
# Main miner class
# ============================================================================

class CosmicHarmonyV4Native:
    """
    CHv4 Native Mining Library — high-performance wrapper.

    Thread-safe: instance může být sdílena mezi vlákny.
    GIL uvolněn po dobu každého C volání (ctypes automaticky).
    """

    def __init__(self, lib_path: Optional[str] = None, cpu_threads: Optional[int] = None):
        self._lib_path = lib_path or _find_chv4_library()
        self._lib = ctypes.CDLL(self._lib_path)
        _setup_lib(self._lib)

        self._threads = cpu_threads or os.cpu_count() or 4
        self._height  = 0  # default: genesis block, CHv4 always active

        print(f"[CHv4] Library: {self._lib_path}")
        print(f"[CHv4] Info:    {self.version}")
        print(f"[CHv4] Threads: {self._threads}")
        print(f"[CHv4] NEON: {self.has_neon}  AVX2: {self.has_avx2}")

    # ── Properties ──────────────────────────────────────────────────

    @property
    def version(self) -> str:
        return self._lib.cosmic_harmony_v4_get_info().decode()

    @property
    def has_neon(self) -> bool:
        return bool(self._lib.cosmic_harmony_v4_has_neon())

    @property
    def has_avx2(self) -> bool:
        return bool(self._lib.cosmic_harmony_v4_has_avx2())

    # ── Core hash functions ──────────────────────────────────────────

    def hash(self, header: bytes, nonce: int, height: int = 0) -> bytes:
        """
        Spočítá CHv4 hash.

        Args:
            header: block header (max 80 bajtů, zbytek oříznut/doplněn nulami)
            nonce:  uint64 nonce
            height: výška bloku (default 0 → vždy CHv4)

        Returns:
            32 bajtů hash
        """
        hdr = (ctypes.c_uint8 * len(header)).from_buffer_copy(header)
        out = (ctypes.c_uint8 * 32)()
        ret = self._lib.cosmic_harmony_v4_hash(
            ctypes.cast(hdr, ctypes.POINTER(ctypes.c_uint8)),
            ctypes.c_size_t(len(header)),
            ctypes.c_uint64(nonce & 0xFFFFFFFFFFFFFFFF),
            ctypes.c_uint64(height),
            ctypes.cast(out, ctypes.POINTER(ctypes.c_uint8)),
        )
        if ret != 0:
            raise RuntimeError(f"cosmic_harmony_v4_hash returned {ret}")
        return bytes(out)

    def _hash_into(self, lib: ctypes.CDLL, header_arr, header_len: int,
                   nonce: int, output_arr) -> int:
        """Interní: hash přímo do pre-alokovaného output arraye (zero-copy)."""
        return lib.cosmic_harmony_v4_hash(
            ctypes.cast(header_arr, ctypes.POINTER(ctypes.c_uint8)),
            ctypes.c_size_t(header_len),
            ctypes.c_uint64(nonce & 0xFFFFFFFFFFFFFFFF),
            ctypes.c_uint64(0),
            ctypes.cast(output_arr, ctypes.POINTER(ctypes.c_uint8)),
        )

    # ── Batch / multi-threaded mining ────────────────────────────────

    def find_nonce_mt(
        self,
        header: bytes,
        target: bytes,
        start_nonce: int = 0,
        max_nonces: int = 10_000_000,
        batch_size: int = 200,
        threads: Optional[int] = None,
        height: int = 0,
    ) -> Tuple[bool, int, bytes]:
        """
        Multi-threaded nonce search.

        Každé vlákno zpracovává batch_size nonces najednou.
        GIL je uvolněn po dobu C volání → efektivní paralelismus.

        Args:
            header:      block header bytes
            target:      32 bajtů difficulty target (hash <= target = valid)
            start_nonce: počáteční nonce
            max_nonces:  maximální počet nonces k prohledání
            batch_size:  nonces per thread per round
            threads:     počet worker vláken (None = cpu_count)
            height:      výška bloku

        Returns:
            (found: bool, nonce: int, hash: bytes)
        """
        n_threads = threads or self._threads
        target_arr = (ctypes.c_uint8 * 32).from_buffer_copy(target[:32].ljust(32, b'\x00'))
        result_lock = threading.Lock()
        found_event = threading.Event()
        found_result = [False, 0, b'\x00' * 32]

        # Sdílený counter (atomic-ish pomocí lock)
        nonce_counter = [start_nonce]
        counter_lock  = threading.Lock()

        def worker():
            # Thread-local lib load
            lib = ctypes.CDLL(self._lib_path)
            _setup_lib(lib)

            hdr_arr = (ctypes.c_uint8 * len(header)).from_buffer_copy(header)
            out_arr = (ctypes.c_uint8 * 32)()

            while not found_event.is_set():
                # Reservuj batch nonces
                with counter_lock:
                    n0 = nonce_counter[0]
                    if n0 - start_nonce >= max_nonces:
                        return
                    n1 = min(n0 + batch_size, start_nonce + max_nonces)
                    nonce_counter[0] = n1

                for nonce in range(n0, n1):
                    if found_event.is_set():
                        return
                    ret = lib.cosmic_harmony_v4_hash(
                        ctypes.cast(hdr_arr, ctypes.POINTER(ctypes.c_uint8)),
                        ctypes.c_size_t(len(header)),
                        ctypes.c_uint64(nonce & 0xFFFFFFFFFFFFFFFF),
                        ctypes.c_uint64(height),
                        ctypes.cast(out_arr, ctypes.POINTER(ctypes.c_uint8)),
                    )
                    if ret == 0 and self._hash_meets_target(out_arr, target_arr):
                        with result_lock:
                            if not found_event.is_set():
                                found_result[0] = True
                                found_result[1] = nonce
                                found_result[2] = bytes(out_arr)
                        found_event.set()
                        return

        threads_list = []
        for _ in range(n_threads):
            t = threading.Thread(target=worker, daemon=True)
            t.start()
            threads_list.append(t)

        for t in threads_list:
            t.join()

        return found_result[0], found_result[1], found_result[2]

    @staticmethod
    def _hash_meets_target(hash_arr, target_arr) -> bool:
        """Porovná hash s target (hash <= target).
        
        AUDIT: big-endian — index 0 je MSB (nejdůležitější bajt).
        Musí souhlasit s meets_difficulty() v algorithms_opt.rs.
        """
        for i in range(32):
            h = hash_arr[i]
            t = target_arr[i]
            if h < t:
                return True
            if h > t:
                return False
        return True  # rovnost = splňuje

    # ── Benchmark ────────────────────────────────────────────────────

    def benchmark(self, duration_seconds: int = 5) -> float:
        """
        Spustí nativní benchmark a vrátí H/s.
        (Jednojádrový výkon — násobte počtem vláken pro reálný throughput.)
        """
        print(f"\n[CHv4 Benchmark] {self.version}")
        rate = self._lib.cosmic_harmony_v4_benchmark(ctypes.c_int(duration_seconds))
        print(f"[CHv4] Jednojádrový výkon: {rate:.2f} H/s")
        print(f"[CHv4] Odhadovaný výkon ({self._threads} vláken): {rate * self._threads:.1f} H/s")
        return rate

    # ── Hashrate test ─────────────────────────────────────────────────

    def hashrate_test(self, duration: float = 5.0) -> float:
        """
        Multi-threaded hashrate test (reálnější než nativní benchmark).
        Vrátí průměrný H/s přes všechna vlákna.
        """
        import time
        header = b"ZION hashrate test 2.9.6" + b"\x42" * 56
        # Neplatný target → žádný nonce nebude nalezen, ale hashrate je reálný
        target  = b"\xFF" * 32

        hashes = [0] * self._threads
        stop_flag = threading.Event()

        def worker(tid: int):
            lib = ctypes.CDLL(self._lib_path)
            _setup_lib(lib)
            hdr_arr = (ctypes.c_uint8 * len(header)).from_buffer_copy(header)
            out_arr = (ctypes.c_uint8 * 32)()
            nonce = tid * 1_000_000
            count = 0
            while not stop_flag.is_set():
                lib.cosmic_harmony_v4_hash(
                    ctypes.cast(hdr_arr, ctypes.POINTER(ctypes.c_uint8)),
                    ctypes.c_size_t(len(header)),
                    ctypes.c_uint64(nonce),
                    ctypes.c_uint64(0),
                    ctypes.cast(out_arr, ctypes.POINTER(ctypes.c_uint8)),
                )
                nonce += 1
                count += 1
            hashes[tid] = count

        threads_list = [threading.Thread(target=worker, args=(i,), daemon=True)
                        for i in range(self._threads)]
        t0 = time.time()
        for t in threads_list:
            t.start()

        time.sleep(duration)
        stop_flag.set()
        for t in threads_list:
            t.join(timeout=2.0)

        elapsed = time.time() - t0
        total   = sum(hashes)
        rate    = total / elapsed

        print(f"\n[CHv4 Hashrate Test]")
        print(f"  Vlákna:       {self._threads}")
        print(f"  Celkem hashů: {total}")
        print(f"  Čas:          {elapsed:.2f} s")
        print(f"  Hashrate:     {rate:.2f} H/s")
        for i, c in enumerate(hashes):
            print(f"  Thread {i+1:2d}:   {c/elapsed:6.2f} H/s")

        return rate


# ============================================================================
# CLI / rychlý test
# ============================================================================

if __name__ == "__main__":
    import sys

    mode = sys.argv[1] if len(sys.argv) > 1 else "test"
    miner = CosmicHarmonyV4Native()

    if mode == "bench":
        miner.benchmark(5)

    elif mode == "hashrate":
        miner.hashrate_test(10.0)

    elif mode == "find":
        # Ukázkový nonce search s jednoduchým targetem
        header = b"ZION block header v2.9.6" + b"\x00" * 56
        target = bytes.fromhex("00ffffff" + "ff" * 28)
        print(f"\n[CHv4] Hledám nonce pro target {target[:4].hex()}...")
        found, nonce, h = miner.find_nonce_mt(
            header=header, target=target,
            start_nonce=0, max_nonces=500_000,
            batch_size=50
        )
        if found:
            print(f"  ✅ Nalezeno! nonce={nonce}, hash={h.hex()}")
        else:
            print("  ❌ Nonce nenalezen v daném rozsahu.")

    else:
        # Test: single hash + determinismus
        header = b"ZION block header v2.9.6" + b"\x00" * 56
        h1 = miner.hash(header, nonce=12345)
        h2 = miner.hash(header, nonce=12345)
        h3 = miner.hash(header, nonce=12346)
        print(f"\n[CHv4] Hash (nonce=12345): {h1.hex()}")
        print(f"[CHv4] Deterministic:      {'✅' if h1 == h2 else '❌'}")
        print(f"[CHv4] Avalanche (nonce+1): {'✅' if h1 != h3 else '❌'}")
        print(f"[CHv4] Nonce+1 hash:        {h3.hex()}")
