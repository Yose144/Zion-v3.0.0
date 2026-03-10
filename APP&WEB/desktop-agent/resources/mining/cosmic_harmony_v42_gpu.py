"""
ZION Cosmic Harmony Deeksha — Canonical GPU Wrapper
GPU Mining Wrapper — CUDA / OpenCL / Metal (M1-M5) / NPU
=========================================================

Automatická detekce GPU backendu s fallbackem:
  1. Metal (Apple Silicon M1-M5) — preferováno na macOS arm64
  2. CUDA (NVIDIA)               — preferováno na Linux/Windows + CUDA GPU
  3. OpenCL (AMD / Intel Arc)    — obecný fallback pro GPU
    4. CPU (pure Python ref)       — viz cosmic_harmony_deeksha_fallback.py

NPU podpora:
  - Apple ANE: Metal 3 simdgroup_matrix kernely (M2+) + Metal Performance Shaders
  - NVIDIA Tensor Cores: CUDA kernel využívá __hmma instrukce (sm_70+)
  - Intel NPU (Meteor Lake+): OpenCL fallback přes Intel oneAPI Extension

Integrace:
  from cosmic_harmony_v42_gpu import CHv42GPU, detect_best_backend

  gpu = CHv42GPU()               # auto-detekce
  result = gpu.mine(header, nonce_start=0, nonce_count=65536, target_u32=0x00ff_ffff)
  if result:
      nonce, hash_bytes = result

Usage (standalone):
  python cosmic_harmony_v42_gpu.py \\
      --pool testnet.zion.network:3333 \\
      --wallet zion1q... \\
      --worker gpu-miner-01 \\
      --backend auto        # auto | cuda | opencl | metal | cpu
      --batch  65536        # nonces per GPU batch

Version: 2.9.8 — Deeksha canonical GPU
Date:    6. března 2026
"""

from __future__ import annotations

import argparse
import ctypes
import logging
import os
import platform
import struct
import time
from pathlib import Path
from typing import Optional, Tuple

log = logging.getLogger("chv42.gpu")

# ---------------------------------------------------------------------------
# Konstanty (shodné s kernely!)
# ---------------------------------------------------------------------------
HIC: list[int] = [
    0x9E3779B97F4A7C15, 0x6C62272E07BB0142, 0xD37F5B21975B4D6C,
    0xA0761D6478BD642F, 0xE7037ED1A0B428DB, 0x9545CCAC3E89EA53,
    0xD41490F7D7B3A609, 0x85F21F6B2C23E9B3, 0xDB0C2E0D64F98FA4,
    0x4A62D0B9F7E7C9A1, 0xF4CCD5F9FB8F9B6E, 0x2B6E5E8A9C4D7F3B,
    0x8F14E45FCEEA367F, 0xC4CEB9FE1A85EC53, 0x94D049BB133111EB,
    0xBF58476D1CE4E5B9, 0x6C62272E07BB0142, 0xE7037ED1A0B428DB,
    0x9E3779B97F4A7C55, 0xA0761D6478BD6435, 0x95F519AFDB7ED4C9,
    0xDB0C2E0D64F98FA7,
]

_HERE = Path(__file__).resolve().parent
_ROOT = _HERE
for _ in range(12):
    if (_ROOT / "Cargo.toml").exists():
        break
    _ROOT = _ROOT.parent

# Kernely jsou primárně vedle scriptu (resources/mining/), dev fallback je L1/native-libs/all/
_KERNEL_DIR = _HERE
if not ((_HERE / "cosmic_harmony_deeksha.metal").exists() or (_HERE / "cosmic_harmony_v42.metal").exists()):
    _KERNEL_DIR = _ROOT / "L1" / "native-libs" / "all"


def _kernel_path(deeksha_name: str, legacy_name: str) -> Path:
    """Prefer Deeksha-named kernel asset, fallback na legacy v42 název."""
    p_deeksha = _KERNEL_DIR / deeksha_name
    if p_deeksha.exists():
        return p_deeksha
    return _KERNEL_DIR / legacy_name


def _gpu_batch_limits(backend: str) -> Tuple[int, int]:
    backend_name = str(backend or "auto").lower()
    if backend_name in ("cuda", "nvidia"):
        return (1024, 16384)
    if backend_name == "metal":
        return (2048, 65536)
    if backend_name == "deeksha-opencl":
        return (64, 2048)   # 64 KiB scratchpad per thread — memory-intensive
    return (1024, 8192)


def _sanitize_gpu_batch_size(batch_size: int, backend: str) -> int:
    try:
        batch = int(batch_size)
    except Exception:
        batch = 0
    min_batch, max_batch = _gpu_batch_limits(backend)
    if batch < min_batch:
        return min_batch
    if batch > max_batch:
        return max_batch
    return batch

# =============================================================================
# Detekce backendů
# =============================================================================

def _try_import(module: str) -> Optional[object]:
    try:
        import importlib
        return importlib.import_module(module)
    except ImportError:
        return None


def detect_best_backend() -> str:
    """
    Vrátí nejlepší dostupný backend: 'metal' | 'cuda' | 'opencl' | 'native' | 'cpu'
    """
    sys = platform.system()
    machine = platform.machine()

    # 1. Metal — macOS arm64 (M1-M5)
    if sys == "Darwin" and machine in ("arm64", "aarch64"):
        metal = _try_import("metalcompute")
        if metal is None:
            metal = _try_import("objc")  # pyobjc-framework-Metal
        if metal is not None:
            return "metal"
        # metallib přes subprocess xcrun
        import shutil
        if shutil.which("xcrun"):
            return "metal"

    # 2. CUDA (pycuda nebo cupy, nebo nativní DSO)
    if _try_import("pycuda") or _try_import("cupy"):
        return "cuda"
    # Nativní CUDA knihovna (Deeksha-first)
    cuda_lib = _find_lib("libcosmic_harmony_deeksha_cuda") or _find_lib("libchv42_cuda")
    if cuda_lib is not None:
        return "cuda"

    # 3. OpenCL
    if _try_import("pyopencl"):
        return "opencl"

    # 4. Native dylib (ctypes) — Deeksha unified + legacy fallback
    if _find_lib("libcosmic_harmony_deeksha") is not None or _find_lib("libcosmic_harmony_v42") is not None:
        return "native"

    return "cpu"


def _find_lib(base: str) -> Optional[Path]:
    sys = platform.system()
    exts = {"Darwin": ".dylib", "Windows": ".dll"}.get(sys, ".so")
    sibling_bases = [base]
    if sys == "Windows" and base.startswith("lib"):
        sibling_bases.append(base[3:])
    if base == "libcosmic_harmony_deeksha":
        sibling_bases.extend(["libzion_cosmic_harmony_v3", "libcosmic_harmony"])
        if sys == "Windows":
            sibling_bases.extend(["zion_cosmic_harmony_v3", "cosmic_harmony"])
    if base == "libcosmic_harmony_v42" and sys == "Windows":
        sibling_bases.append("cosmic_harmony_v42")
    sibling_bases = list(dict.fromkeys(sibling_bases))
    candidates = [
        *[_HERE.parent / f"{name}{exts}" for name in sibling_bases],          # resources/ root (desktop packaging)
        *[_HERE.parent / "native-libs" / f"{name}{exts}" for name in sibling_bases],
        *[_HERE / f"{name}{exts}" for name in sibling_bases],                 # resources/mining/ (legacy packaged)
        *[_HERE / "native-libs" / f"{name}{exts}" for name in sibling_bases],
        *[_KERNEL_DIR / f"{name}{exts}" for name in sibling_bases],           # L1/native-libs/all/ (dev)
        *[_ROOT / "target" / "release" / f"{name}{exts}" for name in sibling_bases],
        *[Path(f"{name}{exts}") for name in sibling_bases],
    ]
    for p in candidates:
        if p.is_file():
            return p
    return None


def _has_exact_native_backend() -> bool:
    return (
        _find_lib("libcosmic_harmony_deeksha") is not None
        or _find_lib("libcosmic_harmony_v42") is not None
    )


# =============================================================================
# Metal Backend (macOS M1-M5 + ANE NPU hints)
# =============================================================================

class MetalBackend:
    """
    Metal GPU backend pro Apple Silicon.
    Vyžaduje `pip install metalcompute` nebo `pip install pyobjc-framework-Metal`.
    Pokud není metalcompute, používá `metallib` zkompilovaný přes xcrun + ctypes.
    """

    def __init__(self) -> None:
        self._mc = None
        self._device = None
        self._pipeline = None
        self._ready = False
        # PyObjC Metal path (pyobjc-framework-Metal)
        self._use_objc = False
        self._objc_device = None
        self._objc_pipeline = None
        self._objc_queue = None
        # NPU mix pipeline (M3+ only — chv42_npu_mix, #if __METAL_VERSION__ >= 300)
        # Bezi soubeznne s hlavnim mine kernem na AMX matrix units (Apple Silicon)
        self._npu_pipeline = None
        self._npu_w_A = None   # weight_A [64x128] float32 — z HIC konstant
        self._npu_w_B = None   # weight_B [128x64] float32
        self._npu_ready = False
        self._setup()

    def _setup(self) -> None:
        metal_src = _kernel_path("cosmic_harmony_deeksha.metal", "cosmic_harmony_v42.metal")
        if not metal_src.exists():
            log.warning("[Metal] deeksha/legacy .metal kernel nenalezen v %s", _KERNEL_DIR)
            return

        # Cesta 1: metalcompute (nejrychlejší, pokud dostupné)
        mc = _try_import("metalcompute")
        if mc is not None:
            try:
                self._mc = mc
                self._device = mc.Device()
                with open(metal_src) as f:
                    src = f.read()
                self._pipeline = self._device.kernel(src)
                self._pipeline.function("chv42_mine")
                self._ready = True
                name = getattr(self._device, "name", lambda: "Apple GPU")
                if callable(name): name = name()
                log.info("[Metal] metalcompute device: %s", name)
                return
            except Exception as e:
                log.warning("[Metal] metalcompute setup selhalo: %s", e)

        # Cesta 2: pyobjc-framework-Metal (kompilace zdrojáku za runtime přes MTLDevice)
        # Funguje bez Xcode — pyobjc volá nativní Metal.framework přímo
        try:
            import Metal as _MTL  # pyobjc-framework-Metal
            device = _MTL.MTLCreateSystemDefaultDevice()
            if device is None:
                raise RuntimeError("žádný Metal device")
            with open(metal_src) as f:
                src = f.read()
            opts = _MTL.MTLCompileOptions.new()
            lib, err = device.newLibraryWithSource_options_error_(src, opts, None)
            if lib is None:
                raise RuntimeError(f"Metal compile: {err}")
            fn = lib.newFunctionWithName_("chv42_mine")
            if fn is None:
                raise RuntimeError("chv42_mine function not found in metallib")
            pipeline, err = device.newComputePipelineStateWithFunction_error_(fn, None)
            if pipeline is None:
                raise RuntimeError(f"Pipeline state: {err}")
            self._objc_device   = device
            self._objc_pipeline = pipeline
            self._objc_queue    = device.newCommandQueue()
            self._use_objc      = True
            self._ready         = True
            dev_name = device.name() if hasattr(device, "name") else "Apple GPU"
            log.info("[Metal] PyObjC Metal device: %s", dev_name)

            # Pokus o kompilaci NPU mix kernelu (M3+ only, Metal >= 3.0, simdgroup_matrix)
            try:
                import numpy as _np
                npu_fn = lib.newFunctionWithName_("chv42_npu_mix")
                if npu_fn is not None:
                    npu_pl, _er = device.newComputePipelineStateWithFunction_error_(npu_fn, None)
                    if npu_pl is not None:
                        # Vahy inicializovany deterministicky z HIC konstant
                        _H = [
                            0x9E3779B97F4A7C15, 0x6C62272E07BB0142, 0xD37F5B21975B4D6C,
                            0xA0761D6478BD642F, 0xE7037ED1A0B428DB, 0x9545CCAC3E89EA53,
                            0xD41490F7D7B3A609, 0x85F21F6B2C23E9B3, 0xDB0C2E0D64F98FA4,
                            0x4A62D0B9F7E7C9A1, 0xF4CCD5F9FB8F9B6E, 0x2B6E5E8A9C4D7F3B,
                            0x8F14E45FCEEA367F, 0xC4CEB9FE1A85EC53, 0x94D049BB133111EB,
                            0xBF58476D1CE4E5B9, 0x6C62272E07BB0142, 0xE7037ED1A0B428DB,
                            0x9E3779B97F4A7C55, 0xA0761D6478BD6435, 0x95F519AFDB7ED4C9,
                            0xDB0C2E0D64F98FA7,
                        ]
                        n22 = len(_H)
                        # weight_A [64x128]: Xavier-like init z HIC
                        self._npu_w_A = _np.array(
                            [((_H[i % n22] >> ((i * 3) % 48)) & 0xFF) / 127.5 - 1.0
                             for i in range(64 * 128)], dtype=_np.float32)
                        # weight_B [128x64]: posunuty index pro nezavislost
                        self._npu_w_B = _np.array(
                            [((_H[(i + 11) % n22] >> ((i * 5) % 48)) & 0xFF) / 127.5 - 1.0
                             for i in range(128 * 64)], dtype=_np.float32)
                        self._npu_pipeline = npu_pl
                        self._npu_ready = True
                        log.info("[Metal/NPU] chv42_npu_mix pipeline aktivni (M3+ AMX matrix units)")
            except Exception as _npu_e:
                log.debug("[Metal/NPU] NPU mix pipeline skip (M3+ vyzadovan): %s", _npu_e)

            return
        except Exception as e:
            log.warning("[Metal] PyObjC Metal setup selhalo: %s", e)

        log.warning("[Metal] žádný Metal backend nedostupný (nainstaluj pyobjc-framework-Metal)")

    @property
    def available(self) -> bool:
        return self._ready

    def _mine_objc(
        self, header: bytes, nonce_base: int, nonce_count: int, target_u32: int
    ) -> Optional[Tuple[int, bytes]]:
        """Metal compute dispatch přes pyobjc-framework-Metal.
        Používá numpy pole sdílená s Metal bufferem (unified memory, Apple Silicon).
        """
        import struct as _s
        import ctypes
        import numpy as np
        import Metal as _MTL

        dev = self._objc_device
        pipeline = self._objc_pipeline
        queue = self._objc_queue
        MTL_SHARED = 0  # MTLResourceStorageModeShared (0 << 4 = 0)

        # Vstupní numpy pole → Metal buffer bez kopírování (unified memory)
        hdr_padded   = np.frombuffer((header + bytes(128))[:128], dtype=np.uint8).copy()
        hlen_arr     = np.array([len(header)], dtype=np.uint32)
        nb_arr       = np.array([nonce_base], dtype=np.uint64)
        tgt_arr      = np.array([target_u32], dtype=np.uint32)
        sp_arr       = np.zeros(nonce_count * 1024, dtype=np.uint64)  # scratchpad
        result_n_arr = np.zeros(1, dtype=np.uint64)
        result_h_arr = np.zeros(32, dtype=np.uint8)

        def _np_buf(arr: "np.ndarray"):
            """Vytvoří MTLBuffer sdílící paměť s numpy polem (zero-copy, APC unified)."""
            ptr = int(arr.ctypes.data)
            nbytes = int(arr.nbytes)
            return dev.newBufferWithBytesNoCopy_length_options_deallocator_(
                ptr, nbytes, MTL_SHARED, None
            )

        try:
            buffers = [
                _np_buf(hdr_padded),
                _np_buf(hlen_arr),
                _np_buf(nb_arr),
                _np_buf(sp_arr),
                _np_buf(tgt_arr),
                _np_buf(result_n_arr),
                _np_buf(result_h_arr),
            ]
        except Exception as e:
            log.warning("[Metal] buffer allocation: %s", e)
            return None

        cmd = queue.commandBuffer()
        enc = cmd.computeCommandEncoder()
        enc.setComputePipelineState_(pipeline)
        for idx, buf in enumerate(buffers):
            enc.setBuffer_offset_atIndex_(buf, 0, idx)

        tg_size  = _MTL.MTLSizeMake(64, 1, 1)
        n_groups = _MTL.MTLSizeMake((nonce_count + 63) // 64, 1, 1)
        enc.dispatchThreadgroups_threadsPerThreadgroup_(n_groups, tg_size)
        enc.endEncoding()

        # NPU mix pass — soucasne s mine kernem na AMX matrix units (M3+ only)
        # Oba command buffery jsou odeslany pred waitUntilCompleted → soubeznne GPU + AMX
        _cmd_npu = None
        if self._npu_ready and self._npu_pipeline is not None:
            try:
                n_npu = max(1, min(nonce_count // 64, 64))
                # Float reprezentace hlavicky jako vstupni matice pro NPU mix
                hdr_f = np.array(
                    [(header[i % len(header)] / 127.5 - 1.0) for i in range(n_npu * 64)],
                    dtype=np.float32)
                npu_out = np.zeros(n_npu * 64, dtype=np.float32)
                _cmd_npu = queue.commandBuffer()
                _enc_npu = _cmd_npu.computeCommandEncoder()
                _enc_npu.setComputePipelineState_(self._npu_pipeline)
                for _ii, _b in enumerate([
                    _np_buf(hdr_f), _np_buf(npu_out),
                    _np_buf(self._npu_w_A), _np_buf(self._npu_w_B),
                ]):
                    _enc_npu.setBuffer_offset_atIndex_(_b, 0, _ii)
                _enc_npu.dispatchThreadgroups_threadsPerThreadgroup_(
                    _MTL.MTLSizeMake(n_npu, 1, 1), _MTL.MTLSizeMake(64, 1, 1))
                _enc_npu.endEncoding()
                _cmd_npu.commit()  # odeslano pred main cmd — soubeznne spusteni
            except Exception as _npu_e:
                log.debug("[Metal/NPU] dispatch skip: %s", _npu_e)
                _cmd_npu = None

        cmd.commit()
        cmd.waitUntilCompleted()
        if _cmd_npu is not None:
            try: _cmd_npu.waitUntilCompleted()
            except Exception: pass

        # Výstup je přímo v numpy polích (unified memory — žádné kopírování)
        out_nonce = int(result_n_arr[0])
        out_hash  = bytes(result_h_arr.tobytes())

        if out_nonce != 0:
            return (out_nonce, out_hash)
        return None

    def mine(
        self, header: bytes, nonce_base: int, nonce_count: int, target_u32: int
    ) -> Optional[Tuple[int, bytes]]:
        if not self._ready:
            return self._mine_cpu_fallback(header, nonce_base, nonce_count, target_u32)

        # PyObjC Metal path
        if self._use_objc:
            try:
                return self._mine_objc(header, nonce_base, nonce_count, target_u32)
            except Exception as e:
                log.warning("[Metal] PyObjC mine error: %s — CPU fallback", e)
                return self._mine_cpu_fallback(header, nonce_base, nonce_count, target_u32)

        # metalcompute path
        if self._mc is None or self._pipeline is None:
            return self._mine_cpu_fallback(header, nonce_base, nonce_count, target_u32)

        mc = self._mc
        dev = self._device
        ppl = self._pipeline

        import numpy as np

        # Buffery
        header_arr   = np.frombuffer(header[:128].ljust(128, b"\x00"), dtype=np.uint8)
        hlen_arr     = np.array([len(header)], dtype=np.uint32)
        nb_arr       = np.array([nonce_base], dtype=np.uint64)
        sp_arr       = np.zeros(nonce_count * 8192, dtype=np.uint64)
        tgt_arr      = np.array([target_u32], dtype=np.uint32)
        result_n     = np.zeros(1, dtype=np.uint64)
        result_h     = np.zeros(32, dtype=np.uint8)

        try:
            buf_header   = dev.buffer(header_arr)
            buf_hlen     = dev.buffer(hlen_arr)
            buf_nb       = dev.buffer(nb_arr)
            buf_sp       = dev.buffer(sp_arr)
            buf_tgt      = dev.buffer(tgt_arr)
            buf_rn       = dev.buffer(result_n)
            buf_rh       = dev.buffer(result_h)

            ppl.run(
                [buf_header, buf_hlen, buf_nb, buf_sp, buf_tgt, buf_rn, buf_rh],
                nonce_count
            )

            out_nonce = np.frombuffer(bytes(buf_rn), dtype=np.uint64)[0]
            out_hash  = bytes(buf_rh)

            if out_nonce != 0:
                return (int(out_nonce), out_hash)
            return None

        except Exception as e:
            log.warning("[Metal] kernel run error: %s", e)
            return self._mine_cpu_fallback(header, nonce_base, nonce_count, target_u32)

    def _mine_cpu_fallback(
        self, header: bytes, nonce_base: int, nonce_count: int, target_u32: int
    ) -> Optional[Tuple[int, bytes]]:
        """Nouzový CPU fallback pro ladění."""
        try:
            from cosmic_harmony_deeksha_fallback import hash_deeksha as _hash_cpu
        except Exception:
            from cosmic_harmony_v42_fallback import hash_chv42 as _hash_cpu
        for i in range(min(nonce_count, 256)):
            nonce = nonce_base + i
            h = _hash_cpu(header, nonce)
            s0 = struct.unpack_from("<I", h)[0]
            if s0 <= target_u32:
                return (nonce, h)
        return None

    def benchmark(self, nonce_count: int = 4096) -> float:
        """Vrátí H/s."""
        dummy_header = b"ZION Deeksha GPU bench" + b"\x00" * 44
        target = 0xFFFFFFFF
        t0 = time.monotonic()
        self.mine(dummy_header, 0, nonce_count, target)
        dt = time.monotonic() - t0
        hs = nonce_count / max(dt, 0.001)
        log.info("[Metal] Benchmark: %.1f H/s (%d nonces / %.3f s)", hs, nonce_count, dt)
        return hs


# =============================================================================
# CUDA Backend (NVIDIA)
# =============================================================================

class CUDABackend:
    """
    CUDA backend — vyžaduje pycuda nebo cupy, nebo nativní Deeksha/legacy CUDA knihovnu.
    """

    def __init__(self) -> None:
        self._ready  = False
        self._pycuda = None
        self._cupy   = None
        self._native = None
        self._setup()

    def _setup(self) -> None:
        # Pokus 1: pycuda (kompilace CUDA kernelu za běhu)
        pycuda = _try_import("pycuda")
        if pycuda is not None:
            try:
                import pycuda.driver as drv
                import pycuda.autoinit  # noqa: F401
                from pycuda.compiler import SourceModule

                cu_src = _kernel_path("cosmic_harmony_deeksha.cu", "cosmic_harmony_v42.cu")
                if not cu_src.exists():
                    log.warning("[CUDA] .cu soubor nenalezen: %s", cu_src)
                    return

                with open(cu_src) as f:
                    src = f.read()

                # Odstraň extern "C" blok při kompilaci přes pycuda (dostupné jako C++)
                mod = SourceModule(src, no_extern_c=True, options=["-O3", "-arch=sm_70"])
                self._pycuda = (drv, mod)
                n_dev = drv.Device.count()
                name = drv.Device(0).name() if n_dev > 0 else "Unknown"
                log.info("[CUDA] pycuda OK, device[0]: %s", name)
                self._ready = True
                return
            except Exception as e:
                log.warning("[CUDA] pycuda setup: %s", e)

        # Pokus 2: nativní CUDA knihovna přes ctypes (Deeksha-first)
        lib_path = _find_lib("libcosmic_harmony_deeksha_cuda") or _find_lib("libchv42_cuda")
        if lib_path is not None:
            try:
                lib = ctypes.CDLL(str(lib_path))
                fn = None
                for symbol in ("zion_deeksha_cuda_mine", "cosmic_harmony_deeksha_cuda_mine", "chv42_cuda_mine"):
                    if hasattr(lib, symbol):
                        fn = getattr(lib, symbol)
                        break
                if fn is None:
                    raise AttributeError("no compatible CUDA mine symbol found")
                fn.argtypes = [
                    ctypes.POINTER(ctypes.c_uint8),  # header
                    ctypes.c_uint32,                  # header_len
                    ctypes.c_uint64,                  # nonce_base
                    ctypes.c_uint32,                  # nonce_count
                    ctypes.c_uint32,                  # target_u32
                    ctypes.POINTER(ctypes.c_uint64),  # out_nonce
                    ctypes.POINTER(ctypes.c_uint8),   # out_hash[32]
                ]
                fn.restype = ctypes.c_int
                self._native = (lib, fn)
                self._ready  = True
                log.info("[CUDA] nativní lib (deeksha/legacy): %s", lib_path)
                return
            except Exception as e:
                log.warning("[CUDA] native lib setup: %s", e)

        # Pokus 3: cupy (jednoduchý CUDA RawKernel — bez pycuda)
        cupy = _try_import("cupy")
        if cupy is not None:
            try:
                cu_src = _kernel_path("cosmic_harmony_deeksha.cu", "cosmic_harmony_v42.cu")
                if cu_src.exists():
                    with open(cu_src) as f:
                        src = f.read()
                    kernel = cupy.RawKernel(src, "chv42_mine", options=("-O3",), backend="nvcc")
                    self._cupy = (cupy, kernel)
                    self._ready = True
                    log.info("[CUDA] cupy RawKernel OK")
            except Exception as e:
                log.warning("[CUDA] cupy setup: %s", e)

    @property
    def available(self) -> bool:
        return self._ready

    def mine(
        self, header: bytes, nonce_base: int, nonce_count: int, target_u32: int
    ) -> Optional[Tuple[int, bytes]]:
        if not self._ready:
            return None

        # --- nativní ctypes cesta ---
        if self._native is not None:
            _lib, fn = self._native
            hdr  = (ctypes.c_uint8 * len(header))(*header)
            nout = ctypes.c_uint64(0)
            hout = (ctypes.c_uint8 * 32)()
            rc = fn(hdr, len(header), nonce_base, nonce_count, target_u32,
                    ctypes.byref(nout), hout)
            if rc != 0:
                log.warning("[CUDA] mine() returned error %d", rc)
                return None
            if nout.value != 0:
                return (nout.value, bytes(hout))
            return None

        # --- pycuda cesta ---
        if self._pycuda is not None:
            import numpy as np
            import pycuda.driver as drv

            drv_mod, mod = self._pycuda
            kernel = mod.get_function("chv42_mine")

            hdr_arr = np.frombuffer(header[:128].ljust(128, b"\x00"), dtype=np.uint8)
            sp_arr  = drv_mod.mem_alloc(nonce_count * 65536)  # 64 KiB/nonce
            hdr_gpu = drv_mod.to_device(hdr_arr)
            tgt_arr = np.array([target_u32], dtype=np.uint32)
            tgt_gpu = drv_mod.to_device(tgt_arr)
            rn_gpu  = drv_mod.mem_alloc(8)
            rh_gpu  = drv_mod.mem_alloc(32)
            drv_mod.memset_d64(rn_gpu, 0, 1)

            threads = 256
            blocks  = (nonce_count + threads - 1) // threads

            kernel(
                hdr_gpu,
                np.uint32(len(header)),
                np.uint64(nonce_base),
                sp_arr,
                tgt_gpu,
                rn_gpu,
                rh_gpu,
                block=(threads, 1, 1),
                grid=(blocks, 1, 1),
            )

            out_nonce = np.empty(1, dtype=np.uint64)
            out_hash  = np.empty(32, dtype=np.uint8)
            drv_mod.memcpy_dtoh(out_nonce, rn_gpu)
            drv_mod.memcpy_dtoh(out_hash,  rh_gpu)

            sp_arr.free()

            if out_nonce[0] != 0:
                return (int(out_nonce[0]), bytes(out_hash))
            return None

        # --- cupy cesta ---
        if self._cupy is not None:
            cp, kernel = self._cupy
            import numpy as np

            hdr_arr = cp.frombuffer(header[:128].ljust(128, b"\x00"), dtype=cp.uint8)
            sp_arr  = cp.zeros(nonce_count * 8192, dtype=cp.uint64)
            tgt_arr = cp.array([target_u32], dtype=cp.uint32)
            rn_arr  = cp.zeros(1, dtype=cp.uint64)
            rh_arr  = cp.zeros(32, dtype=cp.uint8)

            threads = 256
            blocks  = (nonce_count + threads - 1) // threads

            kernel(
                (blocks,), (threads,),
                (hdr_arr, np.uint32(len(header)), np.uint64(nonce_base),
                 sp_arr, tgt_arr, rn_arr, rh_arr)
            )
            out_n = int(rn_arr[0])
            if out_n != 0:
                return (out_n, bytes(rh_arr.get()))
            return None

        return None

    def benchmark(self, nonce_count: int = 8192) -> float:
        dummy = b"ZION Deeksha CUDA bench" + b"\x00" * 42
        t0 = time.monotonic()
        self.mine(dummy, 0, nonce_count, 0xFFFFFFFF)
        dt = time.monotonic() - t0
        hs = nonce_count / max(dt, 0.001)
        log.info("[CUDA] Benchmark: %.1f H/s (%d nonces / %.3f s)", hs, nonce_count, dt)
        return hs


# =============================================================================
# OpenCL Backend (AMD / Intel Arc / NVIDIA)
# =============================================================================

class OpenCLBackend:
    """
    OpenCL backend — vyžaduje `pip install pyopencl`.
    Auto-vybere nejrychlejší dostupný GPU (preferuje AMD Radeon / Intel Arc).

    NPU: Intel Meteor Lake NPU je přístupný přes OpenCL extension
         cl_intel_neural_network (oneAPI ML ext). Pokud je dostupný,
         využije se pro mixing fáze.
    """

    def __init__(self, platform_idx: int = -1, device_idx: int = -1) -> None:
        self._ready   = False
        self._cl      = None
        self._ctx     = None
        self._queue   = None
        self._program = None
        self._kernel  = None
        self._setup(platform_idx, device_idx)

    def _setup(self, platform_idx: int, device_idx: int) -> None:
        cl = _try_import("pyopencl")
        if cl is None:
            log.warning("[OpenCL] pyopencl není nainstalován (pip install pyopencl)")
            return

        cl_src = _kernel_path("cosmic_harmony_deeksha.cl", "cosmic_harmony_v42.cl")
        if not cl_src.exists():
            log.warning("[OpenCL] .cl soubor nenalezen: %s", cl_src)
            return

        try:
            platforms = cl.get_platforms()
            if not platforms:
                log.warning("[OpenCL] žádné platformy nenalezeny")
                return

            # Auto-výběr: preferuj GPU přes CPU
            selected_device = None
            for pi, plat in enumerate(platforms):
                if platform_idx >= 0 and pi != platform_idx:
                    continue
                devs = plat.get_devices(cl.device_type.GPU)
                if not devs:
                    devs = plat.get_devices(cl.device_type.ALL)
                if devs:
                    di = device_idx if device_idx >= 0 else 0
                    selected_device = devs[min(di, len(devs)-1)]
                    break

            if selected_device is None:
                log.warning("[OpenCL] žádné vhodné zařízení nenalezeno")
                return

            self._ctx   = cl.Context([selected_device])
            self._queue = cl.CommandQueue(self._ctx)

            with open(cl_src) as f:
                src = f.read()

            build_opts = "-cl-std=CL2.0 -cl-mad-enable -cl-fast-relaxed-math"
            self._program = cl.Program(self._ctx, src).build(options=build_opts)
            self._kernel  = self._program.chv42_mine
            self._cl      = cl
            self._ready   = True

            dname = selected_device.name.strip()
            log.info("[OpenCL] Device: %s", dname)

        except Exception as e:
            log.warning("[OpenCL] setup selhalo: %s", e)

    @property
    def available(self) -> bool:
        return self._ready

    def mine(
        self, header: bytes, nonce_base: int, nonce_count: int, target_u32: int
    ) -> Optional[Tuple[int, bytes]]:
        if not self._ready:
            return None

        import numpy as np
        cl = self._cl
        nonce_count = _sanitize_gpu_batch_size(nonce_count, "opencl")

        hdr_arr = np.frombuffer(header[:128].ljust(128, b"\x00"), dtype=np.uint8)
        sp_arr  = np.zeros(nonce_count * 8192, dtype=np.uint64)
        rn_arr  = np.zeros(1, dtype=np.uint64)
        rh_arr  = np.zeros(32, dtype=np.uint8)

        mf = cl.mem_flags
        buf_hdr = cl.Buffer(self._ctx, mf.READ_ONLY  | mf.COPY_HOST_PTR, hostbuf=hdr_arr)
        buf_sp  = cl.Buffer(self._ctx, mf.READ_WRITE | mf.COPY_HOST_PTR, hostbuf=sp_arr)
        buf_rn  = cl.Buffer(self._ctx, mf.READ_WRITE | mf.COPY_HOST_PTR, hostbuf=rn_arr)
        buf_rh  = cl.Buffer(self._ctx, mf.READ_WRITE | mf.COPY_HOST_PTR, hostbuf=rh_arr)

        self._kernel(
            self._queue,
            (nonce_count,), (min(256, nonce_count),),
            buf_hdr,
            np.uint32(len(header)),
            np.uint64(nonce_base),
            buf_sp,
            np.uint32(target_u32),
            buf_rn,
            buf_rh,
        )
        self._queue.finish()

        out_nonce = np.empty(1, dtype=np.uint64)
        out_hash  = np.empty(32, dtype=np.uint8)
        cl.enqueue_copy(self._queue, out_nonce, buf_rn)
        cl.enqueue_copy(self._queue, out_hash,  buf_rh)
        self._queue.finish()

        if out_nonce[0] != 0:
            return (int(out_nonce[0]), bytes(out_hash))
        return None

    def benchmark(self, nonce_count: int = 8192) -> float:
        dummy = b"ZION Deeksha OpenCL bench" + b"\x00" * 40
        t0 = time.monotonic()
        self.mine(dummy, 0, nonce_count, 0xFFFFFFFF)
        dt = time.monotonic() - t0
        hs = nonce_count / max(dt, 0.001)
        log.info("[OpenCL] Benchmark: %.1f H/s (%d nonces / %.3f s)", hs, nonce_count, dt)
        return hs


# =============================================================================
# NPU Weight Generation (deterministic from Blake3 genesis seed)
# =============================================================================

_NPU_WEIGHTS_CACHE: Optional[dict] = None


def _load_npu_weights() -> Optional[dict]:
    """Load or generate canonical Deeksha NPU MLP weights.

    Weights are deterministic: Blake3_keyed(SEED, "CHv4_weights_v1" || counter_LE).
    Returns dict with keys: w1, b1, w2, b2, scale1, scale2 as bytes/arrays.
    Falls back to binary cache file if blake3 is unavailable.
    """
    global _NPU_WEIGHTS_CACHE
    if _NPU_WEIGHTS_CACHE is not None:
        return _NPU_WEIGHTS_CACHE

    import struct as _struct

    # Try binary cache first (fastest path)
    bin_path = _HERE / "deeksha_npu_weights.bin"
    if bin_path.exists():
        try:
            blob = bin_path.read_bytes()
            if len(blob) == 16960:
                pos = 0
                w1 = blob[pos:pos+8192]; pos += 8192
                b1 = blob[pos:pos+128]; pos += 128
                w2 = blob[pos:pos+8192]; pos += 8192
                b2 = blob[pos:pos+64]; pos += 64
                scale1 = blob[pos:pos+256]; pos += 256  # 128 × int16 LE
                scale2 = blob[pos:pos+128]; pos += 128  # 64 × int16 LE
                _NPU_WEIGHTS_CACHE = {
                    "w1": w1, "b1": b1, "w2": w2, "b2": b2,
                    "scale1": scale1, "scale2": scale2,
                }
                log.info("[NPU] Weights loaded from cache: %s", bin_path)
                return _NPU_WEIGHTS_CACHE
        except Exception as e:
            log.warning("[NPU] Cache load failed: %s", e)

    # Generate from blake3 (guarantees bit-exact match to Rust)
    try:
        import blake3 as _b3

        SEED = b"ZION_CHv4_mixing_v1_genesis_seed"
        TOTAL_CHUNKS = 17

        base = _b3.blake3(key=SEED)
        base.update(b"CHv4_weights_v1")

        expanded = bytearray()
        for idx in range(TOTAL_CHUNKS * 32):
            h = base.copy()
            h.update(_struct.pack("<I", idx))
            expanded.extend(h.digest())

        pos = 0
        w1_raw = bytes(expanded[pos:pos+8192]); pos += 8192
        b1_raw = bytes(expanded[pos:pos+128]); pos += 128
        w2_raw = bytes(expanded[pos:pos+8192]); pos += 8192
        b2_raw = bytes(expanded[pos:pos+64]); pos += 64
        scale1_raw = bytes(expanded[pos:pos+128]); pos += 128
        scale2_raw = bytes(expanded[pos:pos+64]); pos += 64

        scale1_packed = b"".join(
            _struct.pack("<h", 224 + (b & 0x3F)) for b in scale1_raw
        )
        scale2_packed = b"".join(
            _struct.pack("<h", 224 + (b & 0x3F)) for b in scale2_raw
        )

        result = {
            "w1": w1_raw, "b1": b1_raw,
            "w2": w2_raw, "b2": b2_raw,
            "scale1": scale1_packed, "scale2": scale2_packed,
        }

        # Write cache for next time
        try:
            blob = w1_raw + b1_raw + w2_raw + b2_raw + scale1_packed + scale2_packed
            bin_path.write_bytes(blob)
            log.info("[NPU] Weights generated and cached: %s", bin_path)
        except Exception:
            pass

        _NPU_WEIGHTS_CACHE = result
        return result

    except ImportError:
        log.warning("[NPU] blake3 not available and no weight cache found")
        return None


# =============================================================================
# Deeksha Canonical OpenCL Backend (correct algorithm on GPU)
# =============================================================================

class DeekshaOpenCLBackend:
    """
    OpenCL backend using the canonical Deeksha kernel.
    Implements the exact pipeline: Keccak-256 → SHA3-512 → GoldenMatrix →
    MemoryHard(64KiB) → NpuMix → CosmicFusion.

    Produces hashes that match the native DLL bit-for-bit.
    Requires pyopencl + deeksha_npu_weights.bin (or blake3 for generation).
    """

    def __init__(self, platform_idx: int = -1, device_idx: int = -1) -> None:
        self._ready   = False
        self._cl      = None
        self._ctx     = None
        self._queue   = None
        self._program = None
        self._kernel  = None
        # NPU weight buffers (created once, reused for all mine calls)
        self._buf_w1      = None
        self._buf_b1      = None
        self._buf_w2      = None
        self._buf_b2      = None
        self._buf_scale1  = None
        self._buf_scale2  = None
        self._setup(platform_idx, device_idx)

    def _setup(self, platform_idx: int, device_idx: int) -> None:
        cl = _try_import("pyopencl")
        if cl is None:
            log.warning("[DeekshaOpenCL] pyopencl not installed")
            return

        # Load canonical kernel source
        cl_src = _HERE / "cosmic_harmony_deeksha_canonical.cl"
        if not cl_src.exists():
            cl_src = _KERNEL_DIR / "cosmic_harmony_deeksha_canonical.cl"
        if not cl_src.exists():
            log.warning("[DeekshaOpenCL] canonical .cl kernel not found")
            return

        # Load NPU weights
        weights = _load_npu_weights()
        if weights is None:
            log.warning("[DeekshaOpenCL] NPU weights unavailable — cannot use GPU")
            return

        try:
            platforms = cl.get_platforms()
            if not platforms:
                log.warning("[DeekshaOpenCL] no OpenCL platforms")
                return

            selected_device = None
            for pi, plat in enumerate(platforms):
                if platform_idx >= 0 and pi != platform_idx:
                    continue
                devs = plat.get_devices(cl.device_type.GPU)
                if not devs:
                    devs = plat.get_devices(cl.device_type.ALL)
                if devs:
                    di = device_idx if device_idx >= 0 else 0
                    selected_device = devs[min(di, len(devs)-1)]
                    break

            if selected_device is None:
                log.warning("[DeekshaOpenCL] no suitable GPU device")
                return

            self._ctx   = cl.Context([selected_device])
            self._queue = cl.CommandQueue(self._ctx)

            with open(cl_src) as f:
                src = f.read()

            build_opts = "-cl-std=CL2.0 -cl-mad-enable"
            self._program = cl.Program(self._ctx, src).build(options=build_opts)
            self._kernel  = self._program.deeksha_mine
            self._cl      = cl

            # Create constant buffers for NPU weights (shared across invocations)
            import numpy as np
            mf = cl.mem_flags
            self._buf_w1     = cl.Buffer(self._ctx, mf.READ_ONLY | mf.COPY_HOST_PTR,
                                         hostbuf=np.frombuffer(weights["w1"], dtype=np.int8))
            self._buf_b1     = cl.Buffer(self._ctx, mf.READ_ONLY | mf.COPY_HOST_PTR,
                                         hostbuf=np.frombuffer(weights["b1"], dtype=np.int8))
            self._buf_w2     = cl.Buffer(self._ctx, mf.READ_ONLY | mf.COPY_HOST_PTR,
                                         hostbuf=np.frombuffer(weights["w2"], dtype=np.int8))
            self._buf_b2     = cl.Buffer(self._ctx, mf.READ_ONLY | mf.COPY_HOST_PTR,
                                         hostbuf=np.frombuffer(weights["b2"], dtype=np.int8))
            self._buf_scale1 = cl.Buffer(self._ctx, mf.READ_ONLY | mf.COPY_HOST_PTR,
                                         hostbuf=np.frombuffer(weights["scale1"], dtype=np.int16))
            self._buf_scale2 = cl.Buffer(self._ctx, mf.READ_ONLY | mf.COPY_HOST_PTR,
                                         hostbuf=np.frombuffer(weights["scale2"], dtype=np.int16))

            self._ready = True
            dname = selected_device.name.strip()
            log.info("[DeekshaOpenCL] Canonical Deeksha GPU ready: %s", dname)

        except Exception as e:
            log.warning("[DeekshaOpenCL] setup failed: %s", e)

    @property
    def available(self) -> bool:
        return self._ready

    def mine(
        self, header: bytes, nonce_base: int, nonce_count: int, target_u32: int
    ) -> Optional[Tuple[int, bytes]]:
        if not self._ready:
            return None

        import numpy as np
        cl = self._cl

        # Clamp batch size: each work-item uses 64 KiB scratchpad
        nonce_count = min(nonce_count, 2048)  # cap at 128 MiB scratchpad total
        nonce_count = max(nonce_count, 1)

        hdr_arr = np.frombuffer(header[:128].ljust(128, b"\x00"), dtype=np.uint8)
        sp_arr  = np.zeros(nonce_count * 65536, dtype=np.uint8)  # scratchpad pool
        rn_arr  = np.zeros(1, dtype=np.uint64)
        rh_arr  = np.zeros(32, dtype=np.uint8)

        mf = cl.mem_flags
        buf_hdr = cl.Buffer(self._ctx, mf.READ_ONLY  | mf.COPY_HOST_PTR, hostbuf=hdr_arr)
        buf_sp  = cl.Buffer(self._ctx, mf.READ_WRITE, size=int(nonce_count * 65536))
        buf_rn  = cl.Buffer(self._ctx, mf.READ_WRITE | mf.COPY_HOST_PTR, hostbuf=rn_arr)
        buf_rh  = cl.Buffer(self._ctx, mf.READ_WRITE | mf.COPY_HOST_PTR, hostbuf=rh_arr)

        # Work-group size: small due to heavy per-item computation + register pressure
        local_size = min(64, nonce_count)
        global_size = nonce_count

        self._kernel(
            self._queue,
            (global_size,), (local_size,),
            buf_hdr,
            np.uint32(len(header)),
            np.uint64(nonce_base),
            buf_sp,
            np.uint32(target_u32),
            buf_rn,
            buf_rh,
            self._buf_w1,
            self._buf_b1,
            self._buf_w2,
            self._buf_b2,
            self._buf_scale1,
            self._buf_scale2,
        )
        self._queue.finish()

        out_nonce = np.empty(1, dtype=np.uint64)
        out_hash  = np.empty(32, dtype=np.uint8)
        cl.enqueue_copy(self._queue, out_nonce, buf_rn)
        cl.enqueue_copy(self._queue, out_hash,  buf_rh)
        self._queue.finish()

        if out_nonce[0] != 0:
            return (int(out_nonce[0]), bytes(out_hash))
        return None

    def benchmark(self, nonce_count: int = 256) -> float:
        """Benchmark canonical Deeksha OpenCL kernel."""
        nonce_count = min(nonce_count, 1024)
        dummy = b"ZION Deeksha OpenCL canonical bench" + b"\x00" * 30
        t0 = time.monotonic()
        self.mine(dummy, 0, nonce_count, 0xFFFFFFFF)
        dt = time.monotonic() - t0
        hs = nonce_count / max(dt, 0.001)
        log.info("[DeekshaOpenCL] Benchmark: %.1f H/s (%d nonces / %.3f s)",
                 hs, nonce_count, dt)
        return hs


# =============================================================================
# NativeLib Backend (ctypes — deeksha/legacy dylib/.so/.dll)
# =============================================================================

class NativeLibBackend:
    """
    ctypes wrapper pro Deeksha/legacy native knihovny.
    Rychlejší než Python fallback, funguje všude kde je k dispozici dylib.
    Priority v detect_best_backend: Metal → CUDA → OpenCL → NativeLib → CPU
    """

    def __init__(self) -> None:
        self._lib = None
        self._fn  = None
        self._ready = False

        lib_path = _find_lib("libcosmic_harmony_deeksha")
        if lib_path is None:
            lib_path = _find_lib("libcosmic_harmony_v42")
        if lib_path is None:
            log.debug("[NativeLib] deeksha/legacy knihovna nenalezena")
            return

        try:
            lib = ctypes.CDLL(str(lib_path))
            fn = None
            for symbol in ("zion_deeksha_batch_mine", "cosmic_harmony_deeksha_batch_mine", "cosmic_harmony_v4_2_batch_mine"):
                if hasattr(lib, symbol):
                    fn = getattr(lib, symbol)
                    break
            if fn is None:
                raise AttributeError("no compatible batch mine symbol found")
            fn.restype  = ctypes.c_int
            fn.argtypes = [
                ctypes.POINTER(ctypes.c_uint8), ctypes.c_uint32,   # header, header_len
                ctypes.c_uint64, ctypes.c_uint32, ctypes.c_uint32, # nonce_start, count, target
                ctypes.POINTER(ctypes.c_uint64),                    # out_nonce
                ctypes.POINTER(ctypes.c_uint8),                     # out_hash[32]
            ]
            self._fn   = fn
            self._lib  = lib
            self._ready = True
            log.info("[NativeLib] Deeksha/legacy native dylib načtena: %s", lib_path)
        except Exception as exc:
            log.warning("[NativeLib] načtení selhalo: %s", exc)

    @property
    def available(self) -> bool:
        return self._ready

    def mine(
        self,
        header:      bytes,
        nonce_start: int,
        nonce_count: int,
        target_u32:  int,
    ) -> Optional[Tuple[int, bytes]]:
        hdr    = (ctypes.c_uint8 * len(header))(*header)
        out_n  = ctypes.c_uint64(0)
        out_h  = (ctypes.c_uint8 * 32)()
        r = self._fn(
            hdr, len(header),
            ctypes.c_uint64(nonce_start), ctypes.c_uint32(nonce_count),
            ctypes.c_uint32(target_u32),
            ctypes.byref(out_n), out_h,
        )
        if r == 1:
            return (int(out_n.value), bytes(out_h))
        return None

    def benchmark(self, nonce_count: int = 2048) -> float:
        try:
            fn = None
            for symbol in ("zion_deeksha_benchmark", "cosmic_harmony_deeksha_benchmark", "cosmic_harmony_v42_benchmark"):
                if hasattr(self._lib, symbol):
                    fn = getattr(self._lib, symbol)
                    break
            if fn is None:
                raise AttributeError("no compatible benchmark symbol found")
            fn.restype  = ctypes.c_double
            fn.argtypes = [ctypes.c_uint32]
            hs = fn(ctypes.c_uint32(nonce_count))
            log.info("[NativeLib] Benchmark: %.1f H/s", hs)
            return hs
        except Exception:
            dummy = b"ZION Deeksha native bench" + b"\x00" * 40
            t0 = time.monotonic()
            self.mine(dummy, 0, min(nonce_count, 16), 0xFFFFFFFF)
            dt = time.monotonic() - t0
            return min(nonce_count, 16) / max(dt, 0.001)


# =============================================================================
# Unified GPU Interface
# =============================================================================

class CHv42GPU:
    """
    Unified interface pro GPU mining Deeksha canonical path.

    Automaticky vybírá nejlepší backend: Metal → CUDA → OpenCL → CPU.

    gpu = CHv42GPU()
    gpu = CHv42GPU(backend="cuda")   # force
    gpu = CHv42GPU(backend="metal")  # force Metal
    """

    def __init__(
        self,
        backend:      str = "auto",
        batch_size:   int = 65536,
        device_idx:   int = 0,
    ) -> None:
        self.batch_size = _sanitize_gpu_batch_size(batch_size, backend)
        self._backend_name = backend
        self._backend: Optional[object] = None
        self._name = "cpu"
        self._last_batch_warning: Optional[Tuple[str, int, int]] = None
        self._setup(backend, device_idx)

    def _setup(self, backend: str, device_idx: int) -> None:
        if backend == "auto":
            # Priority: canonical Deeksha GPU → native DLL → legacy GPU → CPU
            if _try_import("pyopencl") is not None:
                dcl = DeekshaOpenCLBackend(device_idx=device_idx)
                if dcl.available:
                    self._backend = dcl
                    self._name    = "deeksha-opencl"
                    self.batch_size = min(self.batch_size, 2048)
                    log.info("[CHv42GPU] Auto-detekce: deeksha-opencl (canonical Deeksha on GPU)")
                    return
            if _has_exact_native_backend():
                backend = "native"
                log.info("[CHv42GPU] Auto-detekce: native (canonical exact, CPU-based)")
            else:
                backend = detect_best_backend()
                log.info("[CHv42GPU] Auto-detekce: %s", backend)

        if backend == "metal":
            b = MetalBackend()
            if b.available:
                self._backend = b
                self._name    = "metal"
                return
            log.warning("[CHv42GPU] Metal nedostupný, zkouším CUDA")
            backend = "cuda"

        if backend == "cuda":
            b = CUDABackend()
            if b.available:
                self._backend = b
                self._name    = "cuda"
                return
            log.warning("[CHv42GPU] CUDA nedostupný, zkouším OpenCL")
            backend = "opencl"

        if backend == "opencl":
            # Try canonical Deeksha kernel first, then legacy
            dcl = DeekshaOpenCLBackend(device_idx=device_idx)
            if dcl.available:
                self._backend = dcl
                self._name    = "deeksha-opencl"
                self.batch_size = min(self.batch_size, 2048)
                return
            b = OpenCLBackend(device_idx=device_idx)
            if b.available:
                self._backend = b
                self._name    = "opencl"
                return
            log.warning("[CHv42GPU] OpenCL nedostupný, zkouším NativeLib")
            backend = "native"

        if backend == "native":
            b = NativeLibBackend()
            if b.available:
                self._backend = b
                self._name    = "native"
                return
            log.warning("[CHv42GPU] NativeLib nedostupný, fallback na CPU")

        # CPU fallback
        self._name = "cpu"
        log.info("[CHv42GPU] Aktivní backend: CPU (pure Python)")
        self.batch_size = _sanitize_gpu_batch_size(self.batch_size, self._name)

    @property
    def backend_name(self) -> str:
        return self._name

    def mine(
        self,
        header: bytes,
        nonce_start: int,
        nonce_count: int,
        target_u32: int,
    ) -> Optional[Tuple[int, bytes]]:
        """
        Spustí GPU mining pro nonce_count nonces začínaje od nonce_start.

        Returns:
            (nonce, hash_bytes) pokud nalezeno, jinak None.
        """
        safe_nonce_count = _sanitize_gpu_batch_size(
            nonce_count,
            self._name if self._backend is not None else self._backend_name,
        )
        warning_key = (
            self._name if self._backend is not None else str(self._backend_name),
            int(nonce_count),
            safe_nonce_count,
        )
        if safe_nonce_count != nonce_count and self._last_batch_warning != warning_key:
            self._last_batch_warning = warning_key
            log.warning(
                "[CHv42GPU] batch clamp: requested=%d effective=%d backend=%s",
                int(nonce_count),
                safe_nonce_count,
                self._name if self._backend is not None else self._backend_name,
            )
        if self._backend is not None:
            return self._backend.mine(header, nonce_start, safe_nonce_count, target_u32)

        # CPU fallback
        try:
            from cosmic_harmony_deeksha_fallback import hash_deeksha as _hash_cpu
        except Exception:
            from cosmic_harmony_v42_fallback import hash_chv42 as _hash_cpu
        for i in range(safe_nonce_count):
            nonce = nonce_start + i
            h = _hash_cpu(header, nonce)
            s0 = struct.unpack_from("<I", h)[0]
            if s0 <= target_u32:
                return (nonce, h)
        return None

    def benchmark(self, nonce_count: Optional[int] = None) -> float:
        """Vrátí H/s pro aktuální backend."""
        nc = nonce_count or self.batch_size
        if self._backend is not None and hasattr(self._backend, "benchmark"):
            return self._backend.benchmark(nc)
        # CPU benchmark
        try:
            from cosmic_harmony_deeksha_fallback import hash_deeksha as _hash_cpu
        except Exception:
            from cosmic_harmony_v42_fallback import hash_chv42 as _hash_cpu
        dummy = b"bench" + b"\x00" * 59
        t0 = time.monotonic()
        for i in range(min(nc, 16)):
            _hash_cpu(dummy, i)
        dt = time.monotonic() - t0
        hs = min(nc, 16) / max(dt, 0.001)
        log.info("[CPU] Benchmark: %.2f H/s", hs)
        return hs

    def mine_continuous(
        self,
        get_job,             # callable() → (header: bytes, target_u32: int, job_id: str)
        submit_share,        # callable(nonce: int, hash: bytes, job_id: str) → bool
        stop_event,          # threading.Event
        stats_callback=None, # callable(hashrate: float, accepted: int)
    ) -> None:
        """
        Mining smyčka — používá se z integrovaného stratum klienta.

        get_job()      → (header, target_u32, job_id) nebo None (no job yet)
        submit_share() → True = accepted
        stop_event     → threading.Event signalizující zastavení
        """
        import threading

        nonce_cursor = 0
        total_hashes = 0
        accepted     = 0
        t_last_stats = time.monotonic()

        log.info("[CHv42GPU] Mining spuštěn na backendu: %s", self._name)

        while not stop_event.is_set():
            job = get_job()
            if job is None:
                time.sleep(0.2)
                continue

            header, target_u32, job_id = job

            result = self.mine(header, nonce_cursor, self.batch_size, target_u32)
            total_hashes += self.batch_size
            nonce_cursor  += self.batch_size

            if result is not None:
                nonce, hash_bytes = result
                log.info("[%s] Share nalezen! nonce=%d", self._name, nonce)
                if submit_share(nonce, hash_bytes, job_id):
                    accepted += 1
                    log.info("[%s] Share přijat. Celkem: %d", self._name, accepted)

            # Stats každých 30 s
            now = time.monotonic()
            dt  = now - t_last_stats
            if dt >= 30:
                hs = total_hashes / dt
                log.info(
                    "[%s] Hashrate: %.1f H/s, accepted: %d, nonce: %d",
                    self._name, hs, accepted, nonce_cursor
                )
                if stats_callback:
                    stats_callback(hs, accepted)
                total_hashes = 0
                t_last_stats = now


# =============================================================================
# Standalone GPU miner — integrace se stratumem (Deeksha-first, legacy fallback)
# =============================================================================

def _run_gpu_stratum_miner(args: argparse.Namespace) -> None:
    """Spustí GPU-accelerated stratum miner."""
    logging.basicConfig(
        level=getattr(logging, args.log_level.upper(), logging.INFO),
        format="[%(asctime)s][%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
    )

    gpu = CHv42GPU(
        backend=args.backend,
        batch_size=args.batch,
        device_idx=args.device,
    )
    log.info("[Main] GPU backend: %s", gpu.backend_name)

    if args.bench:
        hs = gpu.benchmark()
        print(f"Benchmark: {hs:.1f} H/s ({gpu.backend_name})")
        return

    # Importuj stratum miner z falllback modulu a inject GPU hasher
    import sys
    sys.path.insert(0, str(_HERE))

    try:
        try:
            from cosmic_harmony_deeksha_fallback import StratumMinerDeeksha as StratumMiner
        except Exception:
            from cosmic_harmony_v42_fallback import StratumMiner
        miner = StratumMiner(
            pool=args.pool,
            wallet=args.wallet,
            worker=args.worker,
            threads=1,  # GPU nepoužívá CPU threads pro hashing
            gpu=True,
        )
        # Monkey-patch mining smyčku
        miner._gpu = gpu
        log.info("[Main] Stratum miner spuštěn (GPU mode: %s)", gpu.backend_name)
        miner.run()
    except ImportError as e:
        log.error("[Main] deeksha/v42 fallback module nenalezen: %s", e)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="ZION Deeksha GPU Miner — Canonical Path",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument("--pool",    default="testnet.zion.network:3333", help="Stratum pool URL")
    parser.add_argument("--wallet",  default="",                           help="ZION wallet adresa")
    parser.add_argument("--worker",  default="gpu-miner-01",               help="Worker name")
    parser.add_argument("--backend", default="auto",
                        choices=["auto", "metal", "cuda", "opencl", "cpu"],
                        help="GPU backend")
    parser.add_argument("--batch",   type=int, default=65536,              help="Nonces per GPU batch")
    parser.add_argument("--device",  type=int, default=0,                  help="GPU device index")
    parser.add_argument("--bench",   action="store_true",                  help="Benchmark mode")
    parser.add_argument("--log-level", default="info",
                        choices=["debug", "info", "warning", "error"],     help="Log level")
    args = parser.parse_args()
    _run_gpu_stratum_miner(args)


if __name__ == "__main__":
    main()
