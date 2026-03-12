"""
ZION Cosmic Harmony Ekam Deeksha — Canonical Pipeline (v2.9.8+)
Python Fallback Miner
=====================

Implementace CHvEkamDeeksha (Tier 2) pro případ kdy není k dispozici Rust/nativní build.

Priority (sestupně):
  1. libcosmic_harmony FFI  — zion_ekam_deeksha_hash() z nativní knihovny (nejrychlejší)
  2. Pure Python reference  — Ekam Deeksha pipeline v čistém Pythonu (~0.5-2 H/s)

Pipeline CHvEkamDeeksha (Oneness pipeline — Tier 2 optimization):
  Krok 1: SHA3-256  (keccak256_opt)          — základní hash header+nonce
  Krok 2: SHA3-512  (sha3_512_opt)           — expanze na 64 bajtů
  Krok 3: GoldenMatrix                       — zlatý poměr XOR+rotate mix
  Krok 4: MemoryHard 64 KiB/2/64            — Blake3 XOF init + Blake3 XOF mixing (Ekam)
  Krok 5: NpuMix    INT8 MLP 64→128→64      — neuronová konzistence (CPU impl)
  Krok 6: CosmicFusion 8× Keccak+AES        — finální kondenzace → Hash32

Kanonický test vektor (z deeksha.rs ekam_self_test / generate_ekam_test_vector):
  header: ZION_DEEKSHA_GENESIS_V298_CANONICAL
  nonce:  0x2980_0001_0000_0001
  hash:   6339f2fb178fe2957a10d9e2a84cf9d5e340064f0d165e845b6a54eaf7924fbd

Usage:
    python cosmic_harmony_deeksha_fallback.py \\
        --pool testnet.zion.network:3333 \\
        --wallet zion1q... \\
        --worker my-worker \\
        --threads 4

Version: 2.9.8+ — CHvEkamDeeksha Canonical (Tier 2: Blake3 XOF init + Blake3 XOF mixing)
Date:    2026
"""

from __future__ import annotations

import argparse
import ctypes
import hashlib
import json
import logging
import os
import platform
import socket
import struct
import subprocess
import sys
import threading
import time
from pathlib import Path
from typing import Optional

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s][%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("chv_deeksha")

_SKIP_NATIVE_DEEKSHA_FFI = str(os.environ.get("ZION_SKIP_NATIVE_DEEKSHA_FFI", "")).strip() == "1"

# ---------------------------------------------------------------------------
# HugePages scratchpad allocator (Python mmap — mirrors Rust hugepages.rs)
# ---------------------------------------------------------------------------
import mmap as _mmap_mod

# Platform detection
_IS_LINUX = platform.system() == "Linux"
_IS_MACOS = platform.system() == "Darwin"
_IS_ARM64 = platform.machine() in ("arm64", "aarch64")
_PAGE_SIZE = 16384 if (_IS_MACOS and _IS_ARM64) else 4096
_HUGE_PAGE_SIZE = 2 * 1024 * 1024  # 2 MiB

# Thread-local scratchpad pool (one per mining thread)
_hp_local = threading.local()


class HugePageScratchpad:
    """
    mmap-backed scratchpad buffer with HugePages support.
    Mirrors Rust HugePageScratchpad for Python fallback mining.

    Platform behavior:
    - Linux: MAP_HUGETLB | MAP_POPULATE (true 2 MiB pages)
    - macOS arm64: regular mmap (16K native pages, 4 TLB entries for 64 KiB)
    - macOS x86_64: VM_FLAGS_SUPERPAGE_SIZE_2MB attempt
    - Fallback: regular anonymous mmap + mlock
    """

    __slots__ = ("_mm", "_size", "_huge_pages", "_locked")

    def __init__(self, size: int) -> None:
        self._size = size
        self._huge_pages = False
        self._locked = False
        self._mm: Optional[_mmap_mod.mmap] = None
        self._allocate()

    def _allocate(self) -> None:
        """Try HugePages first, fall back to regular mmap."""
        if _IS_LINUX:
            self._try_linux_hugepages()
        if self._mm is None:
            self._alloc_regular()
        self._try_mlock()

    def _try_linux_hugepages(self) -> None:
        """Linux: mmap with MAP_HUGETLB | MAP_POPULATE."""
        try:
            import ctypes as _ct
            import ctypes.util
            _libc = _ct.CDLL(ctypes.util.find_library("c"), use_errno=True)
            _libc.mmap.restype = _ct.c_void_p
            _libc.mmap.argtypes = [
                _ct.c_void_p, _ct.c_size_t, _ct.c_int, _ct.c_int, _ct.c_int, _ct.c_long
            ]
            PROT_RW = 0x1 | 0x2  # PROT_READ | PROT_WRITE
            MAP_PRIVATE = 0x02
            MAP_ANONYMOUS = 0x20
            MAP_HUGETLB = 0x40000
            MAP_POPULATE = 0x08000
            aligned = (self._size + _HUGE_PAGE_SIZE - 1) & ~(_HUGE_PAGE_SIZE - 1)
            ptr = _libc.mmap(
                None, aligned, PROT_RW,
                MAP_PRIVATE | MAP_ANONYMOUS | MAP_HUGETLB | MAP_POPULATE,
                -1, 0
            )
            MAP_FAILED = _ct.c_void_p(-1).value
            if ptr is not None and ptr != MAP_FAILED:
                # Wrap in a memoryview-compatible buffer
                buf = (_ct.c_ubyte * aligned).from_address(ptr)
                self._mm = buf
                self._huge_pages = True
                log.info(f"[HugePages] Linux MAP_HUGETLB: {self._size // 1024} KiB on 2 MiB pages")
                return
        except Exception:
            pass

    def _alloc_regular(self) -> None:
        """Regular anonymous mmap (works everywhere)."""
        try:
            self._mm = _mmap_mod.mmap(-1, self._size, access=_mmap_mod.ACCESS_WRITE)
            page_desc = "16K" if (_IS_MACOS and _IS_ARM64) else "4K"
            log.info(f"[HugePages] mmap fallback: {self._size // 1024} KiB on {page_desc} pages")
        except Exception as exc:
            log.warning(f"[HugePages] mmap failed ({exc}), using bytearray")
            self._mm = None

    def _try_mlock(self) -> None:
        """Best-effort memory lock to prevent swapping."""
        if self._mm is None:
            return
        try:
            import ctypes as _ct
            import ctypes.util
            _libc = _ct.CDLL(ctypes.util.find_library("c"), use_errno=True)
            _libc.mlock.argtypes = [_ct.c_void_p, _ct.c_size_t]
            _libc.mlock.restype = _ct.c_int
            if isinstance(self._mm, _mmap_mod.mmap):
                # Get buffer address from mmap
                buf = (_ct.c_ubyte * self._size).from_buffer(self._mm)
                result = _libc.mlock(_ct.addressof(buf), self._size)
            else:
                result = _libc.mlock(_ct.addressof(self._mm), self._size)
            self._locked = (result == 0)
        except Exception:
            self._locked = False

    @property
    def is_huge_pages(self) -> bool:
        return self._huge_pages

    @property
    def is_locked(self) -> bool:
        return self._locked

    def get_buffer(self) -> bytearray:
        """Return a writable bytearray backed by this allocation."""
        if self._mm is None:
            return bytearray(self._size)
        if isinstance(self._mm, _mmap_mod.mmap):
            self._mm.seek(0)
            self._mm.write(b"\x00" * self._size)
            self._mm.seek(0)
            return bytearray(self._mm.read(self._size))
        # ctypes array — copy to bytearray for uniform interface
        return bytearray(bytes(self._mm[:self._size]))

    def write_back(self, buf: bytearray) -> None:
        """Write modified data back to the mmap region (for reuse)."""
        if isinstance(self._mm, _mmap_mod.mmap):
            self._mm.seek(0)
            self._mm.write(bytes(buf[:self._size]))

    def close(self) -> None:
        if isinstance(self._mm, _mmap_mod.mmap):
            try:
                self._mm.close()
            except Exception:
                pass
        self._mm = None


def _get_thread_scratchpad(size: int) -> HugePageScratchpad:
    """Get or create a thread-local HugePages scratchpad (one per mining thread)."""
    hp = getattr(_hp_local, "scratchpad", None)
    if hp is None or hp._size != size:
        if hp is not None:
            hp.close()
        hp = HugePageScratchpad(size)
        _hp_local.scratchpad = hp
    return hp


def hugepages_status_line() -> str:
    """Human-readable HugePages status (for miner banner)."""
    page_kb = _PAGE_SIZE // 1024
    scratchpad_kb = SCRATCHPAD_SIZE // 1024 if "SCRATCHPAD_SIZE" in dir() else 64
    if _IS_LINUX:
        try:
            nr = int(open("/proc/sys/vm/nr_hugepages").read().strip())
            if nr > 0:
                return f"{scratchpad_kb} KiB scratchpad | 2048 KiB pages | HUGEPAGES ready | Linux"
        except Exception:
            pass
        return f"{scratchpad_kb} KiB scratchpad | {page_kb} KiB pages | mmap fallback | Linux (enable: sysctl vm.nr_hugepages=128)"
    if _IS_MACOS and _IS_ARM64:
        return f"{scratchpad_kb} KiB scratchpad | 16 KiB pages | Apple Silicon native | mmap+mlock"
    if _IS_MACOS:
        return f"{scratchpad_kb} KiB scratchpad | 2048 KiB pages | macOS superpages | mmap+mlock"
    return f"{scratchpad_kb} KiB scratchpad | {page_kb} KiB pages | mmap fallback"

# ---------------------------------------------------------------------------
# CHvDeeksha pipeline parametry (musí se shodovat s deeksha.rs!)
# ---------------------------------------------------------------------------
UINT64_MASK    = 0xFFFFFFFFFFFFFFFF
UINT32_MASK    = 0xFFFFFFFF
UINT8_MASK     = 0xFF
SCRATCHPAD_SIZE = 65536   # 64 KiB
BLOCK_SIZE      = 64
BLOCK_COUNT     = SCRATCHPAD_SIZE // BLOCK_SIZE  # 1024
PASSES          = 2
RANDOM_READS    = 64
MLP_DIM_IN      = 64
MLP_DIM_HIDDEN  = 128
MLP_DIM_OUT     = 64
FUSION_ROUNDS   = 4
EKAM_FUSION_ROUNDS = 8  # Ekam Tier 2: doubled fusion rounds

# MLP genesis seed — musí se shodovat s CHV4_MLP_GENESIS_SEED z algorithms_npu.rs
CHV4_MLP_GENESIS_SEED = b"ZION_CHv4_mixing_v1_genesis_seed"

# Kanonický test vektor — EKAM (code-frozen, generován cargo test generate_ekam_test_vector_print)
CANONICAL_TEST_HEADER = b"ZION_DEEKSHA_GENESIS_V298_CANONICAL"
CANONICAL_TEST_NONCE  = 0x2980_0001_0000_0001
CANONICAL_EXPECTED_HEX = "6339f2fb178fe2957a10d9e2a84cf9d5e340064f0d165e845b6a54eaf7924fbd"
# Originální Deeksha test vektor (pro referenci / zpětnou kompatibilitu)
ORIGINAL_DEEKSHA_EXPECTED_HEX = "f72031a1f648050f05e6719fd6df895bbd319590277267857316ba6e6444f700"

# ---------------------------------------------------------------------------
# Nativní knihovna — zion_deeksha_hash() z libcosmic_harmony
# ---------------------------------------------------------------------------

class _NativeLib:
    """
    Obal pro Ekam Deeksha native FFI.

    Hledá tyto symboly (v pořadí preferencí):
      zion_ekam_deeksha_hash(header, header_len, nonce, output[32]) -> i32   [Ekam Tier 2]
      zion_deeksha_hash(header, header_len, nonce, output[32]) -> i32        [Original fallback]
      zion_ekam_deeksha_self_test() -> i32
      zion_deeksha_self_test() -> i32
    """

    def __init__(self) -> None:
        self._lib: Optional[ctypes.CDLL] = None
        self._hash_fn = None
        self._hash_height_fn = None
        self._self_test_fn = None
        self._is_ekam: bool = False  # True pokud používáme zion_ekam_deeksha_hash
        self._load_attempted: bool = False
        self._skip_logged: bool = False

    def ensure_loaded(self) -> None:
        if self._hash_fn is not None:
            return
        if self._load_attempted:
            return
        if str(os.environ.get("ZION_SKIP_NATIVE_DEEKSHA_FFI", "")).strip() == "1":
            if not self._skip_logged:
                log.info("[Deeksha] native FFI init skipped (ZION_SKIP_NATIVE_DEEKSHA_FFI=1)")
                self._skip_logged = True
            return
        self._load_attempted = True
        self._load()

    def _find_lib_paths(self) -> list[Path]:
        system = platform.system()
        preferred_names = {
            "Darwin":  ["libcosmic_harmony_deeksha.dylib", "libzion_cosmic_harmony_v3.dylib", "libcosmic_harmony.dylib"],
            "Linux":   ["libcosmic_harmony_deeksha.so.2.9.8", "libcosmic_harmony_deeksha.so", "libzion_cosmic_harmony_v3.so", "libcosmic_harmony.so.2.9.0", "libcosmic_harmony.so"],
            "Windows": ["cosmic_harmony_deeksha.dll", "zion_cosmic_harmony_v3.dll", "cosmic_harmony.dll", "libcosmic_harmony_deeksha.dll", "libzion_cosmic_harmony_v3.dll", "libcosmic_harmony.dll"],
        }
        names = preferred_names.get(system, ["libcosmic_harmony_deeksha.so", "libzion_cosmic_harmony_v3.so", "libcosmic_harmony.so"])

        this = Path(__file__).resolve()
        here = this.parent

        local_roots = [
            here.parent,
            here.parent / "native-libs",
                here,
                here / "native-libs",
        ]

        # Najdi root projektu podle Cargo.toml
        root = this
        for _ in range(12):
            if (root / "Cargo.toml").exists():
                break
            root = root.parent

        candidates = []
        for name in names:
            candidates.extend([base / name for base in local_roots])
            candidates.extend([
                root / "L1" / name,
                root / "L1" / "native-libs" / name,
                root / "L1" / "native-libs" / "all" / name,
                root / "target" / "release" / name,
                root / "target" / "debug" / name,
                Path(name),
            ])

        found: list[Path] = []
        seen: set[str] = set()
        for p in candidates:
            key = str(p)
            if key in seen:
                continue
            seen.add(key)
            if p.exists():
                found.append(p)
        return found

    def _load(self) -> None:
        if str(os.environ.get("ZION_SKIP_NATIVE_DEEKSHA_FFI", "")).strip() == "1":
            return
        paths = self._find_lib_paths()
        if not paths:
            log.warning("[Deeksha] native library not found — pure Python fallback active")
            return
        for p in paths:
            try:
                lib = ctypes.CDLL(str(p))

                # Preferuj Ekam entry point, fallback na originální Deeksha
                hash_fn_name = None
                for name in ("zion_ekam_deeksha_hash", "zion_deeksha_hash"):
                    try:
                        fn = getattr(lib, name)
                        fn.argtypes = [
                            ctypes.POINTER(ctypes.c_uint8),
                            ctypes.c_size_t,
                            ctypes.c_uint64,
                            ctypes.POINTER(ctypes.c_uint8),
                        ]
                        fn.restype = ctypes.c_int32
                        self._hash_fn = fn
                        hash_fn_name = name
                        self._is_ekam = (name == "zion_ekam_deeksha_hash")
                        break
                    except AttributeError:
                        continue

                if hash_fn_name is None:
                    continue  # tato knihovna nemá žádný hash symbol — zkus další

                # zion_deeksha_hash_with_height — volitelný
                try:
                    fn_h = lib.zion_deeksha_hash_with_height
                    fn_h.argtypes = [
                        ctypes.POINTER(ctypes.c_uint8),
                        ctypes.c_size_t,
                        ctypes.c_uint64,
                        ctypes.c_uint64,
                        ctypes.POINTER(ctypes.c_uint8),
                    ]
                    fn_h.restype = ctypes.c_int32
                    self._hash_height_fn = fn_h
                except AttributeError:
                    pass

                # Self-test — preferuj Ekam, fallback na originální
                for st_name in ("zion_ekam_deeksha_self_test", "zion_deeksha_self_test"):
                    try:
                        st = getattr(lib, st_name)
                        st.argtypes = []
                        st.restype = ctypes.c_int32
                        self._self_test_fn = st
                        break
                    except AttributeError:
                        continue

                # HugePages status query (optional, for diagnostics)
                try:
                    hp_fn = lib.zion_hugepages_status
                    hp_fn.argtypes = [ctypes.POINTER(ctypes.c_uint8), ctypes.c_size_t]
                    hp_fn.restype = ctypes.c_int32
                    buf = (ctypes.c_uint8 * 512)()
                    n = hp_fn(buf, 512)
                    if n > 0:
                        hp_json = bytes(buf[:n]).decode("utf-8", errors="replace")
                        log.info(f"[Deeksha] Native HugePages: {hp_json}")
                except (AttributeError, OSError):
                    pass

                # Pre-warm HugePages scratchpad pool (optional)
                try:
                    pw_fn = lib.zion_hugepages_prewarm
                    pw_fn.argtypes = []
                    pw_fn.restype = ctypes.c_int32
                    hp_ok = pw_fn()
                    if hp_ok == 1:
                        log.info("[Deeksha] Native HugePages scratchpad pre-warmed (2 MiB pages)")
                    else:
                        log.info("[Deeksha] Native scratchpad pre-warmed (regular pages)")
                except (AttributeError, OSError):
                    pass

                self._lib = lib
                ekam_tag = " [Ekam]" if self._is_ekam else " [Original]"
                log.info(f"[Deeksha] Native lib loaded:{ekam_tag} {p} ({hash_fn_name})")
                return
            except (OSError, AttributeError) as e:
                log.warning(f"[Deeksha] Failed to load {p}: {e} — trying next candidate")

        log.warning("[Deeksha] no compatible native library found — pure Python fallback active")

    @property
    def available(self) -> bool:
        self.ensure_loaded()
        return self._hash_fn is not None

    def self_test(self) -> bool:
        """Zavolá zion_deeksha_self_test() pokud je k dispozici."""
        self.ensure_loaded()
        if self._self_test_fn is not None:
            result = self._self_test_fn()
            return result == 0
        # Fallback: ověř kanonický vektor
        h = self.hash(CANONICAL_TEST_HEADER, CANONICAL_TEST_NONCE)
        return h.hex() == CANONICAL_EXPECTED_HEX

    def hash(self, header: bytes, nonce: int, height: int = 0) -> bytes:
        self.ensure_loaded()
        out = (ctypes.c_uint8 * 32)()
        hdr = (ctypes.c_uint8 * len(header))(*header)
        # VŽDY preferuj height-aware verzi: CHV_EKAM_FORK_HEIGHT=0 znamená, že
        # cosmic_harmony_with_height() vrací ekam_deeksha pro KAŽDOU výšku ≥ 0.
        # zion_deeksha_hash (bez height) volá cosmic_harmony_deeksha (SHA3) — ŠPATNĚ.
        # zion_deeksha_hash_with_height(height=0) volá cosmic_harmony_with_height → ekam — SPRÁVNĚ.
        if self._hash_height_fn is not None:
            self._hash_height_fn(hdr, len(header), nonce, height, out)
        else:
            self._hash_fn(hdr, len(header), nonce, out)
        return bytes(out)


_native = _NativeLib()


def ensure_native_ffi() -> bool:
    """Líně načti canonical native FFI, pokud není dočasně zakázaná env proměnnou."""
    _native.ensure_loaded()
    return _native.available

# ---------------------------------------------------------------------------
# Pure Python Deeksha pipeline (referenční, ~0.5-2 H/s na CPU)
# ---------------------------------------------------------------------------

def _sha3_256(data: bytes) -> bytes:
    return hashlib.sha3_256(data).digest()

def _sha3_512(data: bytes) -> bytes:
    return hashlib.sha3_512(data).digest()

def _u64_at(buf: bytearray | bytes, u64_idx: int) -> int:
    return struct.unpack_from("<Q", buf, u64_idx * 8)[0]

def _set_u64(buf: bytearray, u64_idx: int, val: int) -> None:
    struct.pack_into("<Q", buf, u64_idx * 8, val & UINT64_MASK)

# Golden ratio konstanta φ = (√5−1)/2 × 2^64
PHI_U64 = 0x9E3779B97F4A7C15

def _golden_matrix(state64: bytes) -> bytes:
    """
    GoldenMatrix — 64-bajtový vstup → 64-bajtový výstup.
    Python approximace: 8× u64 mix s φ × index.
    """
    words = list(struct.unpack_from("<8Q", state64))
    for i in range(8):
        v = words[i]
        v ^= (PHI_U64 * (i + 1)) & UINT64_MASK
        # rotl13
        v = ((v << 13) | (v >> 51)) & UINT64_MASK
        # mix with next
        v ^= words[(i + 1) % 8]
        words[i] = v
    # druhý průchod
    for i in range(7, -1, -1):
        v = words[i]
        v ^= (PHI_U64 * (i + 9)) & UINT64_MASK
        v = ((v << 19) | (v >> 45)) & UINT64_MASK
        v ^= words[(i + 7) % 8]
        words[i] = v
    return struct.pack("<8Q", *words)


def _memory_hard_transform(seed64: bytes) -> bytes:
    """
    MemoryHard — 64 KiB scratchpad, PASSES=2, RANDOM_READS=64.
    Vstup: 64 bajtů (výstup GoldenMatrix).
    Výstup: 64 bajtů (random-read state).
    """
    # Use HugePages-backed scratchpad (thread-local, reused across hashes)
    hp = _get_thread_scratchpad(SCRATCHPAD_SIZE)
    buf = hp.get_buffer()
    # Naplnění scratchpadu opakovaným SHA3-512
    state = _sha3_512(seed64)
    pos = 0
    while pos < SCRATCHPAD_SIZE:
        chunk = min(64, SCRATCHPAD_SIZE - pos)
        buf[pos:pos + chunk] = state[:chunk]
        pos += chunk
        if pos < SCRATCHPAD_SIZE:
            state = _sha3_512(state)

    # Forward passes
    n_u64 = SCRATCHPAD_SIZE // 8
    for _ in range(PASSES):
        prev = _u64_at(buf, n_u64 - 1)
        for i in range(n_u64):
            cur = _u64_at(buf, i)
            mixed = (cur ^ prev ^ ((PHI_U64 * (i + 1)) & UINT64_MASK)) & UINT64_MASK
            mixed = ((mixed << 13) | (mixed >> 51)) & UINT64_MASK
            _set_u64(buf, i, mixed)
            prev = mixed

    # Random reads — 64 MHard reads
    s = list(struct.unpack_from("<8Q", bytes(buf[:64])))
    for _ in range(RANDOM_READS):
        idx = s[0] % BLOCK_COUNT
        bstart = idx * (BLOCK_SIZE // 8)
        for j in range(BLOCK_SIZE // 8):
            s[j % 8] = (s[j % 8] ^ _u64_at(buf, bstart + j)) & UINT64_MASK

    return struct.pack("<8Q", *s)


# INT8 MLP váhy — musí používat stejný seed jako Rust reference.
# Pure Python derivace zůstává pouze aproximační fallback; pro konsenzuálně
# přesné výsledky je zdrojem pravdy nativní FFI cesta.
def _derive_mlp_weights() -> tuple[list[list[int]], list[list[int]]]:
    """
    Odvodit INT8 MLP váhy ze seed.
    W1: (128, 64) int8,  W2: (64, 128) int8
    """
    # Generujeme pseudonáhodná čísla z SHA3-256 chain
    state = hashlib.sha3_256(CHV4_MLP_GENESIS_SEED).digest()
    raw = bytearray()
    while len(raw) < (128 * 64 + 64 * 128):
        raw.extend(state)
        state = hashlib.sha3_256(state).digest()

    def to_int8(b: int) -> int:
        # unsigned byte → signed int8
        return b - 256 if b >= 128 else b

    # W1: 128×64
    w1 = []
    offset = 0
    for _ in range(128):
        row = [to_int8(raw[offset + j]) for j in range(64)]
        w1.append(row)
        offset += 64

    # W2: 64×128
    w2 = []
    for _ in range(64):
        row = [to_int8(raw[offset + j]) for j in range(128)]
        w2.append(row)
        offset += 128

    return w1, w2


# Cache vah (inicializace jednou)
_MLP_WEIGHTS: Optional[tuple] = None
_MLP_LOCK = threading.Lock()


def _get_mlp_weights():
    global _MLP_WEIGHTS
    if _MLP_WEIGHTS is None:
        with _MLP_LOCK:
            if _MLP_WEIGHTS is None:
                _MLP_WEIGHTS = _derive_mlp_weights()
    return _MLP_WEIGHTS


def _npu_mix(input64: bytes) -> bytes:
    """
    INT8 MLP 64→128→64 s residuálním přičtením vstupu.
    POZOR: Tato Python implementace je aproximace, ne konsenzu-identická.
    """
    w1, w2 = _get_mlp_weights()

    # Vstup jako uint8, pak jako int8
    x = list(input64[:64])
    inp_signed = [b - 256 if b >= 128 else b for b in x]

    # W1 × input → hidden 128
    hidden = []
    for i in range(128):
        acc = sum(w1[i][j] * inp_signed[j] for j in range(64))
        # ReLU + clip int8
        acc = max(-128, min(127, acc >> 6))  # shift pro int8 scaling
        hidden.append(acc)

    # W2 × hidden → output 64
    output = []
    for i in range(64):
        acc = sum(w2[i][j] * hidden[j] for j in range(128))
        acc = max(-128, min(127, acc >> 7))
        output.append(acc)

    # Residuál: output_uint8 = (output + input) & 0xff
    result = bytes([(output[i] + x[i]) & UINT8_MASK for i in range(64)])
    return result


def _cosmic_fusion(state64: bytes, rounds: int = FUSION_ROUNDS) -> bytes:
    """
    CosmicFusion — FUSION_ROUNDS iterací SHA3-256 + GoldenMatrix.
    Vstup: 64 bajtů. Výstup: 32 bajtů (finální hash).
    """
    cur = state64
    for _ in range(rounds):
        cur = _sha3_256(cur)         # 32 bajtů
        cur = _sha3_256(cur + cur)   # dvojitý hash → 32 bajtů (simulace AES-NI expanze)
    return cur[:32]


def deeksha_hash_python(header: bytes, nonce: int) -> bytes:
    """
    Pure Python CHvDeeksha pipeline (ORIGINÁLNÍ — 4 fusion rounds, SHA3 scratchpad).

    DŮLEŽITÉ: Tato implementace je referenční a nemusí se shodovat bit-for-bit
    s Rust implementací (zejména GoldenMatrix a NpuMix jsou aproximace).
    Pro konsenzu-správné výsledky VŽDY použijte nativní FFI.
    """
    # Vstupní buffer: header (max 80 bajtů) + nonce (8 bajtů LE)
    nonce_bytes = struct.pack("<Q", nonce & UINT64_MASK)
    inp = header[:80] + nonce_bytes

    # Krok 1: SHA3-256
    k256 = _sha3_256(inp)

    # Krok 2: SHA3-512
    k512 = _sha3_512(k256)

    # Krok 3: GoldenMatrix (64 bajtů)
    gm = _golden_matrix(k512)

    # Krok 4: MemoryHard (64 KiB scratchpad) — originální SHA3
    mh = _memory_hard_transform(gm)

    # Krok 5: NpuMix (INT8 MLP)
    npu_out = _npu_mix(mh)

    # Krok 6: CosmicFusion → Hash32 (4 rounds)
    return _cosmic_fusion(npu_out, FUSION_ROUNDS)


# ---------------------------------------------------------------------------
# Ekam Deeksha pipeline — Tier 2: Blake3 XOF init + Blake3 XOF mixing
# ---------------------------------------------------------------------------

# Blake3 XOF domain separation (musí se shodovat s Rust: "EKAM_SCRATCHPAD_INIT_V1")
_EKAM_DOMAIN_SEP = b"EKAM_SCRATCHPAD_INIT_V1"

# Pokus o import blake3 — fallback na SHA3-512 chain pokud nedostupný
try:
    import blake3 as _blake3_mod
    _HAS_BLAKE3 = True
except ImportError:
    _HAS_BLAKE3 = False


def _blake3_xof_fill(seed: bytes, buf: bytearray, size: int) -> None:
    """
    Naplní buf pomocí Blake3 XOF s domain separation.
    Fallback na SHA3-512 chain pokud blake3 balíček není dostupný.
    """
    if _HAS_BLAKE3:
        hasher = _blake3_mod.blake3(seed, derive_key_context=_EKAM_DOMAIN_SEP.decode())
        data = hasher.digest(length=size)
        buf[:size] = data
    else:
        # Fallback: SHA3-512 chain (aproximace — NENÍ konsenzuidentická!)
        state = _sha3_512(_EKAM_DOMAIN_SEP + seed)
        pos = 0
        while pos < size:
            chunk = min(64, size - pos)
            buf[pos:pos + chunk] = state[:chunk]
            pos += chunk
            if pos < size:
                state = _sha3_512(state)


def _blake3_mix_block(current: bytes, prev: bytes, random_block: bytes, pass_idx: int, block_idx: int) -> bytes:
    """
    Blake3 XOF mixing pro jeden blok (64 bajtů).
    Odpovídá Rust mix_block_ekam(): Blake3(current || prev || random || pass || index) → XOF 64B.
    Fallback na SHA3-512 pokud blake3 balíček není dostupný.
    """
    meta = struct.pack("<QQ", pass_idx, block_idx)
    if _HAS_BLAKE3:
        hasher = _blake3_mod.blake3()
        hasher.update(current)
        hasher.update(prev)
        hasher.update(random_block)
        hasher.update(meta[:8])   # pass as u64 LE
        hasher.update(meta[8:])   # index as u64 LE
        return hasher.digest(length=64)
    else:
        # Fallback: SHA3-512 mix (aproximace — NENÍ konsenzuidentická!)
        mixed = _sha3_512(current + prev + random_block + meta)
        return mixed


def _memory_hard_transform_ekam(seed64: bytes) -> bytes:
    """
    Ekam MemoryHard — 64 KiB scratchpad s Blake3 XOF init + Blake3 XOF mixing.
    Vstup: 64 bajtů (výstup GoldenMatrix).
    Výstup: 64 bajtů (random-read state).

    POZOR: Tato Python implementace je aproximace. Pro konsenzuidentické
    výsledky VŽDY použijte nativní FFI (zion_ekam_deeksha_hash).
    """
    # Use HugePages-backed scratchpad (thread-local, reused across hashes)
    hp = _get_thread_scratchpad(SCRATCHPAD_SIZE)
    buf = hp.get_buffer()

    # Inicializace scratchpadu přes Blake3 XOF
    _blake3_xof_fill(seed64, buf, SCRATCHPAD_SIZE)

    # Forward + backward passes s Blake3 XOF mixing (matches Rust mix_block_ekam)
    n_blocks = BLOCK_COUNT
    for pass_idx in range(PASSES):
        # Forward pass
        for i in range(n_blocks):
            start = i * BLOCK_SIZE
            current = bytes(buf[start:start + BLOCK_SIZE])

            # prev = previous block (wrap around)
            prev_idx = (i - 1) % n_blocks
            prev_start = prev_idx * BLOCK_SIZE
            prev_block = bytes(buf[prev_start:prev_start + BLOCK_SIZE])

            # random block index (same as Rust)
            cur_u64 = struct.unpack_from("<Q", buf, start)[0]
            rand_index = (cur_u64 ^ pass_idx ^ i) % n_blocks
            rand_start = rand_index * BLOCK_SIZE
            random_block = bytes(buf[rand_start:rand_start + BLOCK_SIZE])

            mixed = _blake3_mix_block(current, prev_block, random_block, pass_idx, i)
            # XOR into scratchpad
            for j in range(BLOCK_SIZE):
                buf[start + j] ^= mixed[j]

    # Random reads — 64 MHard reads (preserved from original, Keccak-256)
    s = list(struct.unpack_from("<8Q", bytes(buf[:64])))
    for _ in range(RANDOM_READS):
        idx = s[0] % BLOCK_COUNT
        bstart = idx * (BLOCK_SIZE // 8)
        for j in range(BLOCK_SIZE // 8):
            s[j % 8] = (s[j % 8] ^ _u64_at(buf, bstart + j)) & UINT64_MASK

    return struct.pack("<8Q", *s)


def deeksha_ekam_hash_python(header: bytes, nonce: int) -> bytes:
    """
    Pure Python CHvEkamDeeksha pipeline (Tier 2 — Blake3 XOF init + Blake3 XOF mixing, 8 fusion rounds).

    DŮLEŽITÉ: Tato implementace je referenční a nemusí se shodovat bit-for-bit
    s Rust implementací. Pro konsenzu-správné výsledky VŽDY použijte nativní FFI.
    """
    nonce_bytes = struct.pack("<Q", nonce & UINT64_MASK)
    inp = header[:80] + nonce_bytes

    # Krok 1: SHA3-256
    k256 = _sha3_256(inp)

    # Krok 2: SHA3-512
    k512 = _sha3_512(k256)

    # Krok 3: GoldenMatrix (64 bajtů)
    gm = _golden_matrix(k512)

    # Krok 4: MemoryHard Ekam (64 KiB scratchpad, Blake3 XOF init + Blake3 XOF mixing)
    mh = _memory_hard_transform_ekam(gm)

    # Krok 5: NpuMix (INT8 MLP)
    npu_out = _npu_mix(mh)

    # Krok 6: CosmicFusion → Hash32 (8 rounds — Ekam doubles the original 4)
    return _cosmic_fusion(npu_out, EKAM_FUSION_ROUNDS)


def hash_deeksha(header: bytes, nonce: int, height: int = 0) -> bytes:
    """
    Hashování přes Ekam Deeksha pipeline.
    Preferuje nativní FFI (Ekam), fallback na pure Python Ekam.
    """
    if _native.available:
        return _native.hash(header, nonce, height)
    return deeksha_ekam_hash_python(header, nonce)


def meets_target(h: bytes, target_u32: int, cosmic_state0_endian: str = "little") -> bool:
    """
    Zkontroluje, zda hash splňuje target.
    Pool pro cosmic_harmony posílá compact u32 target jako hex text.
    state0 se čte z prvních 4 bajtů hashe, endian je defaultně little.
    """
    if target_u32 <= 0:
        return False

    endian = str(cosmic_state0_endian or "little").strip().lower()
    if endian == "big":
        state0 = struct.unpack(">I", h[:4])[0]
    else:
        state0 = struct.unpack("<I", h[:4])[0]
    return state0 <= target_u32


def parse_target(target_hex: str) -> int:
    """Parsuje cosmic_harmony target stejně jako Rust miner a pool validator."""
    t = target_hex.strip().lower()
    if t.startswith("0x"):
        t = t[2:]
    if not t:
        return 0
    if len(t) <= 8:
        return int(t, 16)
    return int(t[:8], 16)


def submit_nonce_hex(nonce: int) -> str:
    """Pool pro cosmic_harmony očekává 32bit nonce jako 8 hex znaků."""
    return f"{(nonce & UINT32_MASK):08x}"


class _ExactHashVerifierProcess:
    """Oddělený helper proces pro přesný native/FFI hash bez Metal runtime konfliktu."""

    def __init__(self) -> None:
        self._proc: Optional[subprocess.Popen[str]] = None
        self._lock = threading.Lock()

    def start(self) -> bool:
        with self._lock:
            if self._proc is not None and self._proc.poll() is None:
                return True
            env = os.environ.copy()
            env.pop("ZION_SKIP_NATIVE_DEEKSHA_FFI", None)
            try:
                self._proc = subprocess.Popen(
                    [sys.executable, str(Path(__file__).resolve()), "--hash-server"],
                    stdin=subprocess.PIPE,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    bufsize=1,
                    env=env,
                )
                return True
            except Exception as exc:
                log.warning("[Deeksha] failed to start exact hash verifier process: %s", exc)
                self._proc = None
                return False

    def hash(self, header: bytes, nonce: int, height: int = 0) -> bytes:
        if not self.start():
            raise RuntimeError("exact hash verifier process unavailable")
        assert self._proc is not None
        assert self._proc.stdin is not None
        assert self._proc.stdout is not None
        with self._lock:
            if self._proc.poll() is not None:
                raise RuntimeError("exact hash verifier process exited")
            request = {
                "header_hex": header.hex(),
                "nonce": int(nonce),
                "height": int(height),
            }
            self._proc.stdin.write(json.dumps(request) + "\n")
            self._proc.stdin.flush()
            line = self._proc.stdout.readline()
        if not line:
            raise RuntimeError("exact hash verifier process returned empty response")
        response = json.loads(line)
        if not response.get("ok"):
            raise RuntimeError(response.get("error") or "exact hash verifier failed")
        return bytes.fromhex(str(response["hash_hex"]))

    def stop(self) -> None:
        with self._lock:
            proc = self._proc
            self._proc = None
        if proc is None:
            return
        try:
            if proc.stdin is not None:
                proc.stdin.close()
        except Exception:
            pass
        try:
            proc.terminate()
            proc.wait(timeout=2)
        except Exception:
            try:
                proc.kill()
            except Exception:
                pass


# ---------------------------------------------------------------------------
# Stratum miner
# ---------------------------------------------------------------------------

class StratumMinerDeeksha:
    """
    Stratum mining klient pro CHvDeeksha.
    Identická struktura jako v42 fallback — pouze hashovací funkce se liší.
    """

    def __init__(
        self,
        pool: str,
        wallet: str,
        worker: str,
        threads: int = 2,
        gpu: bool = False,
        stats_file: Optional[str] = None,
        stats_interval: int = 30,
    ) -> None:
        self.pool = pool
        self.wallet = wallet
        self.worker = worker
        self.threads = max(1, threads)
        self.gpu = gpu
        self.stats_file = stats_file
        self.stats_interval = stats_interval

        host, _, port_str = pool.rpartition(":")
        self.host = host or "localhost"
        self.port = int(port_str) if port_str.isdigit() else 3333

        self._sock: Optional[socket.socket] = None
        self._job_lock = threading.Lock()
        self._current_job: Optional[dict] = None
        self._job_seq: int = 0
        self._submitted_share_keys: set[str] = set()
        self._running = False
        self._login_id: str = "0"
        self._gpu = None

        # Stats
        self._hashes: int = 0
        self._shares_found: int = 0
        self._shares_sent: int = 0
        self._shares_accepted: int = 0
        self._shares_rejected: int = 0
        self._start_time: float = 0.0
        self._stats_lock = threading.Lock()
        self._gpu_false_positive_logs: int = 0
        self._exact_verifier: Optional[_ExactHashVerifierProcess] = None

        # Rolling hashrate samples: list of (timestamp, cumulative_hashes)
        self._hr_samples: list[tuple[float, int]] = []
        self._hr_max: float = 0.0
        # Pool metadata from jobs
        self._pool_height: int = 0
        self._pool_diff: float = 0.0
        self._pool_diff_str: str = ""
        self._last_share_time: float = 0.0
        self._blocks_found: int = 0

    # ------------------------------------------------------------------
    # Stratum protokol
    # ------------------------------------------------------------------

    def _connect(self, attempts: int = 5, timeout_sec: int = 10) -> None:
        last_err: Optional[Exception] = None
        for attempt in range(1, attempts + 1):
            try:
                self._sock = socket.create_connection((self.host, self.port), timeout=timeout_sec)
                self._sock.settimeout(None)
                log.info(f"[Stratum] Connected to {self.host}:{self.port}")
                return
            except Exception as exc:
                last_err = exc
                if attempt < attempts:
                    log.warning(
                        f"[Stratum] Connect failed ({attempt}/{attempts}) to "
                        f"{self.host}:{self.port}: {exc} — retrying in {min(2 * attempt, 8)}s..."
                    )
                    time.sleep(min(2 * attempt, 8))
        raise ConnectionError(f"Unable to connect to {self.host}:{self.port}") from last_err

    def _send(self, msg: dict) -> None:
        data = json.dumps(msg) + "\n"
        assert self._sock is not None
        self._sock.sendall(data.encode())

    def _recv_line(self) -> Optional[dict]:
        assert self._sock is not None
        buf = b""
        while True:
            chunk = self._sock.recv(4096)
            if not chunk:
                return None
            buf += chunk
            if b"\n" in buf:
                line, _ = buf.split(b"\n", 1)
                try:
                    return json.loads(line.decode())
                except (json.JSONDecodeError, UnicodeDecodeError):
                    return None

    def _login(self) -> None:
        self._send({
            "id": 1,
            "method": "login",
            "params": {
                "login": self.wallet,
                "pass": "x",
                "agent": f"zion-ekam-deeksha-python/{self.worker}",
                # Primárně chceme deeksha, ale pool taky akceptuje "cosmic_harmony"
                "algo": ["cosmic_harmony_ekam", "ekam_deeksha", "cosmic_harmony_deeksha", "cosmic_harmony", "deeksha"],
            },
        })
        resp = self._recv_line()
        log.debug(f"[Stratum] Login resp: {resp}")
        if resp and isinstance(resp.get("result"), dict):
            if "id" in resp["result"]:
                self._login_id = str(resp["result"]["id"])
            if resp["result"].get("job"):
                self._update_job(resp["result"]["job"])

    def _update_job(self, job: dict) -> None:
        with self._job_lock:
            prev_job_id = str(self._current_job.get("job_id", "")) if self._current_job else ""
            self._current_job = job
            self._job_seq += 1
            job_seq = self._job_seq
            next_job_id = str(job.get("job_id", ""))
            if next_job_id != prev_job_id:
                self._submitted_share_keys.clear()
        # Track pool height and difficulty from job target
        try:
            h = int(job.get("height", 0) or 0)
            if h > 0:
                self._pool_height = h
        except (ValueError, TypeError):
            pass
        try:
            raw_t = str(job.get("target", "ffffffff"))
            t32 = parse_target(raw_t)
            if t32 > 0:
                diff = 0xFFFFFFFF / t32
                self._pool_diff = diff
                if diff >= 1_000_000:
                    self._pool_diff_str = f"{diff / 1_000_000:.2f}M"
                elif diff >= 1_000:
                    self._pool_diff_str = f"{diff / 1_000:.2f}K"
                else:
                    self._pool_diff_str = f"{diff:.0f}"
        except (ValueError, TypeError, ZeroDivisionError):
            pass
        log.info(
            f"[Job] seq={job_seq} id={job.get('job_id', '?')} height={job.get('height', '?')} "
            f"target={str(job.get('target', '?'))[:8]}... diff={self._pool_diff_str}"
        )

    def _submit_share(self, job_id: str, nonce: int, result: bytes) -> None:
        nonce_hex = submit_nonce_hex(nonce)
        cache_key = f"{job_id}:{nonce_hex}"
        with self._job_lock:
            if cache_key in self._submitted_share_keys:
                log.debug(f"[Share] Skip duplicate local submit nonce={nonce_hex} job_id={job_id}")
                return
            self._submitted_share_keys.add(cache_key)
        self._send({
            "id": 4,
            "method": "submit",
            "params": {
                "id": self._login_id,
                "job_id": job_id,
                "nonce": nonce_hex,
                "result": result.hex(),
            },
        })
        with self._stats_lock:
            self._shares_sent += 1
        log.info(f"[Share] Submitted! nonce={nonce_hex} hash={result.hex()[:16]}...")

    # ------------------------------------------------------------------
    # Mining
    # ------------------------------------------------------------------

    def _mine_loop(self, thread_id: int) -> None:
        """Mining loop pro CPU i GPU backendy."""
        nonce_base = (int(os.environ.get("ZION_NONCE_BASE", "0")) or 0) & UINT32_MASK
        gpu_backend = self._gpu if self.gpu else None
        nonce = (nonce_base + thread_id * (1 << 24)) & UINT32_MASK
        while self._running:
            job = None
            job_seq = 0
            with self._job_lock:
                if self._current_job:
                    job = dict(self._current_job)
                    job_seq = self._job_seq

            if not job:
                time.sleep(0.1)
                continue

            try:
                blob = bytes.fromhex(job.get("blob", "00" * 76))
                raw_target = str(job.get("target", "ffffffff"))
                target_u32 = parse_target(raw_target)
                height = int(job.get("height", 0))
                job_id = str(job.get("job_id", ""))
                cosmic_state0_endian = str(job.get("cosmic_state0_endian", "little") or "little")

                gpu_batch_size = max(1, int(getattr(gpu_backend, "batch_size", 65536))) if gpu_backend is not None else 0

                while self._running:
                    with self._job_lock:
                        if self._job_seq != job_seq:
                            break  # nový job

                    if gpu_backend is not None:
                        result = gpu_backend.mine(blob, nonce, gpu_batch_size, target_u32)

                        with self._stats_lock:
                            self._hashes += gpu_batch_size

                        with self._job_lock:
                            if self._job_seq != job_seq:
                                break

                        if result is not None:
                            found_nonce, found_hash = result
                            if self._exact_verifier is not None:
                                exact_hash = self._exact_verifier.hash(blob, found_nonce, height)
                            else:
                                exact_hash = hash_deeksha(blob, found_nonce, height)
                            with self._job_lock:
                                if self._job_seq != job_seq:
                                    break
                            if meets_target(exact_hash, target_u32, cosmic_state0_endian):
                                with self._stats_lock:
                                    self._shares_found += 1
                                log.info(
                                    f"[Thread-{thread_id}] ✅ Share found! "
                                    f"nonce={submit_nonce_hex(found_nonce)} hash={exact_hash.hex()[:16]}..."
                                )
                                with self._job_lock:
                                    if self._job_seq != job_seq:
                                        break
                                self._submit_share(job_id, found_nonce, exact_hash)
                            elif self._gpu_false_positive_logs < 5:
                                self._gpu_false_positive_logs += 1
                                log.warning(
                                    "[Thread-%d] GPU candidate rejected by canonical Deeksha verify: nonce=%s gpu_hash=%s exact_hash=%s target=%08x",
                                    thread_id,
                                    submit_nonce_hex(found_nonce),
                                    found_hash.hex()[:16],
                                    exact_hash.hex()[:16],
                                    target_u32,
                                )

                        nonce = (nonce + gpu_batch_size * self.threads) & UINT32_MASK
                        continue

                    h = hash_deeksha(blob, nonce, height)

                    with self._stats_lock:
                        self._hashes += 1

                    with self._job_lock:
                        if self._job_seq != job_seq:
                            break

                    if meets_target(h, target_u32, cosmic_state0_endian):
                        with self._stats_lock:
                            self._shares_found += 1
                        log.info(
                            f"[Thread-{thread_id}] ✅ Share found! "
                            f"nonce={submit_nonce_hex(nonce)} hash={h.hex()[:16]}..."
                        )
                        with self._job_lock:
                            if self._job_seq != job_seq:
                                break
                        self._submit_share(job_id, nonce, h)

                    nonce = (nonce + self.threads) & UINT32_MASK

            except Exception as e:
                log.error(f"[Thread-{thread_id}] Mining error: {e}", exc_info=True)
                time.sleep(1)

    def _mine_thread(self, thread_id: int) -> None:
        """Mining vlákno — iteruje nonce a hashuje přes Deeksha pipeline."""
        self._mine_loop(thread_id)

    def _record_hr_sample(self) -> None:
        now = time.time()
        with self._stats_lock:
            self._hr_samples.append((now, self._hashes))
        cutoff = now - 16 * 60
        while self._hr_samples and self._hr_samples[0][0] < cutoff:
            self._hr_samples.pop(0)

    def _rolling_hr(self, window_sec: float) -> float:
        now = time.time()
        cutoff = now - window_sec
        samples = self._hr_samples
        if len(samples) < 2:
            return 0.0
        oldest_idx = 0
        for i, (t, _) in enumerate(samples):
            if t >= cutoff:
                oldest_idx = max(0, i - 1)
                break
        else:
            oldest_idx = len(samples) - 2
        t0, h0 = samples[oldest_idx]
        t1, h1 = samples[-1]
        dt = t1 - t0
        return (h1 - h0) / dt if dt > 0 else 0.0

    def _stats_thread(self) -> None:
        self._record_hr_sample()
        _p = 0
        while self._running:
            time.sleep(min(self.stats_interval, 10))
            _p += 1
            self._record_hr_sample()
            elapsed = time.time() - self._start_time
            with self._stats_lock:
                ht = self._hashes
                sa = self._shares_accepted
                sr = self._shares_rejected
                ss = self._shares_sent
            v10 = self._rolling_hr(10)
            v60 = self._rolling_hr(60)
            v15 = self._rolling_hr(15 * 60)
            vn = v10 if v10 > 0 else (ht / elapsed if elapsed > 0 else 0.0)
            if vn > self._hr_max:
                self._hr_max = vn
            ref = max(v10, v60, v15, 1.0)
            if ref >= 1e6:
                u, d = "MH/s", 1e6
            elif ref >= 1e3:
                u, d = "kH/s", 1e3
            else:
                u, d = "H/s", 1.0
            f10, f60, f15, fmx = v10 / d, v60 / d, v15 / d, self._hr_max / d
            tot = sa + sr
            pct = f"{sa / tot * 100:.1f}" if tot else "0.0"
            s = int(elapsed); hh, s = divmod(s, 3600); mm, ss2 = divmod(s, 60)
            up = f"{hh:02d}:{mm:02d}:{ss2:02d}"
            if ht >= 1e9:
                th = f"{ht / 1e9:.1f}G"
            elif ht >= 1e6:
                th = f"{ht / 1e6:.1f}M"
            elif ht >= 1e3:
                th = f"{ht / 1e3:.1f}K"
            else:
                th = str(ht)
            gpu_name = getattr(self._gpu, "backend_name", "") if self._gpu else ""
            backend = gpu_name if gpu_name and gpu_name != "cpu" else ("native" if _native.available else "python")

            # xmrig speed line — parsed by main.js
            print(f"speed 10s/60s/15m {f10:.2f} {f60:.2f} {f15:.2f} {u} max {fmx:.2f} {u}", flush=True)
            # [Stats] line — parsed by main.js Deeksha parser
            print(f"[Stats] {vn / d:.2f} {u} | shares={ss} | hashes={ht} | backend={backend}", flush=True)

            if self.stats_file:
                try:
                    with open(self.stats_file, "w") as f:
                        json.dump({
                            "hashrate": round(vn, 3), "hashrate_10s": round(v10, 3),
                            "hashrate_60s": round(v60, 3), "hashrate_15m": round(v15, 3),
                            "hashrate_max": round(self._hr_max, 3),
                            "shares_accepted": sa, "shares_rejected": sr,
                            "hashes_total": ht, "algorithm": "cosmic_harmony_ekam_deeksha",
                            "backend": backend, "threads": self.threads,
                            "uptime_secs": round(elapsed, 1),
                            "pool_height": self._pool_height, "pool_diff": round(self._pool_diff, 2),
                            "pool": self.pool, "worker": self.worker,
                        }, f)
                except OSError:
                    pass

    def _listener_thread(self) -> None:
        """Přijímá nové joby ze Stratum serveru."""
        while self._running:
            try:
                msg = self._recv_line()
                if not msg:
                    log.warning("[Stratum] Connection closed by server")
                    self._running = False
                    break
                method = str(msg.get("method", ""))
                if method == "job":
                    self._update_job(msg["params"])
                elif isinstance(msg.get("result"), dict) and "job" in msg["result"]:
                    self._update_job(msg["result"]["job"])
                elif msg.get("id") == 4 and msg.get("error") is None:
                    with self._stats_lock:
                        self._shares_accepted += 1
                        a = self._shares_accepted
                        r = self._shares_rejected
                    self._last_share_time = time.time()
                    total = a + r
                    pct = (a / total * 100) if total > 0 else 100.0
                    diff_s = self._pool_diff_str or "0"
                    # xmrig-compatible accepted line (parsed by main.js)
                    print(
                        f"accepted {a}/{r} (+1) diff {diff_s} ({pct:.1f}%)",
                        flush=True,
                    )
                elif msg.get("error"):
                    if msg.get("id") == 4:
                        with self._stats_lock:
                            self._shares_rejected += 1
                            a = self._shares_accepted
                            r = self._shares_rejected
                        reason = str(msg["error"])
                        print(
                            f"rejected {a}/{r} (+1) \"{reason}\"",
                            flush=True,
                        )
                    log.warning(f"[Stratum] Server error: {msg['error']}")
            except Exception as e:
                log.error(f"[Stratum] Listener error: {e}")
                if self._running:
                    time.sleep(2)

    def run(self) -> None:
        worker_name = self.worker if self.worker.endswith("-deeksha") else f"{self.worker}-deeksha"
        if self.gpu and self._gpu is None:
            try:
                from cosmic_harmony_v42_gpu import CHv42GPU
                self._gpu = CHv42GPU(backend="auto")
            except Exception as exc:
                log.warning(f"[CHvDeeksha Miner] GPU init failed: {exc}")
                self._gpu = None
        gpu_backend_name = getattr(self._gpu, "backend_name", None) if self.gpu else None
        back = f"gpu_{gpu_backend_name}" if gpu_backend_name and gpu_backend_name != "cpu" else ("native_ffi" if _native.available else "pure_python")
        use_foreground_gpu_loop = self.gpu and gpu_backend_name == "metal"
        log.info(f"[CHvDeeksha Miner] Starting")
        log.info(f"  Backend:  {back}")
        log.info(f"  Threads:  {self.threads}")
        log.info(f"  Pool:     {self.pool}")
        log.info(f"  Wallet:   {self.wallet}")
        log.info(f"  Worker:   {worker_name}")
        log.info(f"  Pipeline: Keccak→SHA3→GoldenMatrix→MemoryHard(64KiB,Blake3)→NpuMix→CosmicFusion(8r)")
        log.info(f"  Memory:   {hugepages_status_line()}")
        if use_foreground_gpu_loop:
            log.info("[CHvDeeksha Miner] Metal GPU mining pinned to process main thread for runtime stability")
            self._exact_verifier = _ExactHashVerifierProcess()
            if self._exact_verifier.start():
                log.info("[CHvDeeksha Miner] Exact canonical verify delegated to helper process")
            else:
                log.warning("[CHvDeeksha Miner] Exact canonical verify helper unavailable; falling back to in-process hash path")
                self._exact_verifier = None

        self._start_time = time.time()
        should_stop = False

        while not should_stop:
            try:
                self._connect(attempts=5, timeout_sec=10)
                self._login()
            except Exception as exc:
                log.error(f"[Stratum] Initial connect/login failed: {exc}")
                log.info("[Stratum] Retry in 5s...")
                time.sleep(5)
                continue

            self._running = True
            threads = []
            if not use_foreground_gpu_loop:
                for i in range(self.threads):
                    t = threading.Thread(target=self._mine_thread, args=(i,), daemon=True, name=f"deeksha-{i}")
                    t.start()
                    threads.append(t)

            stats_t = threading.Thread(target=self._stats_thread, daemon=True, name="deeksha-stats")
            stats_t.start()

            listen_t = threading.Thread(target=self._listener_thread, daemon=True, name="deeksha-listener")
            listen_t.start()

            try:
                if use_foreground_gpu_loop:
                    self._mine_loop(0)
                else:
                    while self._running:
                        time.sleep(1)
            except KeyboardInterrupt:
                log.info("[CHvDeeksha Miner] Stopping (KeyboardInterrupt)...")
                should_stop = True
                self._running = False

            try:
                if self._sock is not None:
                    self._sock.close()
            except Exception:
                pass
            self._sock = None

            for t in threads:
                t.join(timeout=2)

            if self._exact_verifier is not None:
                self._exact_verifier.stop()
                self._exact_verifier = None

            if not should_stop:
                log.warning("[Stratum] Disconnected — reconnecting in 3s...")
                time.sleep(3)


# ---------------------------------------------------------------------------
# Self-test a verify
# ---------------------------------------------------------------------------

def _verify_canonical_vector() -> bool:
    """
    Ověří kanonický test vektor oproti:
    1. Nativní FFI (zion_ekam_deeksha_hash)
    2. Pure Python Ekam pipeline
    """
    ok = True
    print("=== CHvEkamDeeksha Canonical Test Vector Verification ===")
    print(f"  Header:   {CANONICAL_TEST_HEADER.decode()}")
    print(f"  Nonce:    0x{CANONICAL_TEST_NONCE:016x}")
    print(f"  Expected: {CANONICAL_EXPECTED_HEX} (Ekam)")
    print(f"  Original: {ORIGINAL_DEEKSHA_EXPECTED_HEX} (reference)")
    print()

    if _native.available:
        h_native = _native.hash(CANONICAL_TEST_HEADER, CANONICAL_TEST_NONCE)
        match = "✅ MATCH" if h_native.hex() == CANONICAL_EXPECTED_HEX else "❌ MISMATCH"
        ekam_tag = "Ekam" if _native._is_ekam else "Original"
        print(f"  Native FFI ({ekam_tag}):  {h_native.hex()} {match}")
        if h_native.hex() != CANONICAL_EXPECTED_HEX:
            ok = False
    else:
        print("  Native FFI:  [not available]")

    h_py = deeksha_ekam_hash_python(CANONICAL_TEST_HEADER, CANONICAL_TEST_NONCE)
    # Pure Python je aproximace — může se lišit od Rust
    print(f"  Pure Python (Ekam): {h_py.hex()} [referenční aproximace]")

    # Native self-test (pokud dostupný)
    if _native.available:
        st = _native.self_test()
        print(f"\n  Native self_test(): {'✅ OK' if st else '❌ FAIL'}")
        if not st:
            ok = False

    return ok


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="ZION CHvEkamDeeksha Canonical Python Fallback Miner (v2.9.8+)"
    )
    parser.add_argument("--pool",           default="127.0.0.1:3333",
                        help="Stratum pool URL (host:port)")
    parser.add_argument("--wallet",         default="zion1test",
                        help="ZION wallet address")
    parser.add_argument("--worker",         default="deeksha-py",
                        help="Worker name")
    parser.add_argument("--threads",        type=int,
                        default=max(1, (os.cpu_count() or 2) // 2),
                        help="Počet mining threadů")
    parser.add_argument("--gpu",            action="store_true",
                        help="Povolí GPU (placeholder, GPU není implementováno v Python fallback)")
    parser.add_argument("--stats-file",     default=None,
                        help="Cesta k JSON souboru pro statistiky")
    parser.add_argument("--stats-interval", type=int, default=30,
                        help="Interval pro zápis statistik (sekundy)")
    parser.add_argument("--verify",         action="store_true",
                        help="Ověř kanonický test vektor a ukonči")
    parser.add_argument("--hash-server",    action="store_true",
                        help="Spustí line-based helper pro přesný native hash verify")
    parser.add_argument("--backend",        default="auto",
                        choices=["auto", "native", "python"],
                        help="Vybrání backendu")
    args = parser.parse_args()

    # Backend override
    if args.backend == "python":
        log.info("[Deeksha] Forced pure Python backend (--backend python)")
        _native._hash_fn = None
        _native._lib = None

    if args.verify:
        ok = _verify_canonical_vector()
        sys.exit(0 if ok else 1)

    if args.hash_server:
        logging.getLogger().setLevel(logging.WARNING)
        ensure_native_ffi()
        for line in sys.stdin:
            line = line.strip()
            if not line:
                continue
            try:
                request = json.loads(line)
                header = bytes.fromhex(str(request.get("header_hex", "")))
                nonce = int(request.get("nonce", 0))
                height = int(request.get("height", 0))
                hash_hex = hash_deeksha(header, nonce, height).hex()
                print(json.dumps({"ok": True, "hash_hex": hash_hex}), flush=True)
            except Exception as exc:
                print(json.dumps({"ok": False, "error": str(exc)}), flush=True)
        return

    miner = StratumMinerDeeksha(
        pool=args.pool,
        wallet=args.wallet,
        worker=args.worker,
        threads=args.threads,
        gpu=args.gpu,
        stats_file=args.stats_file,
        stats_interval=args.stats_interval,
    )
    miner.run()


if __name__ == "__main__":
    main()
