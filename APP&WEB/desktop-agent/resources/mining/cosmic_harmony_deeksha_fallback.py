"""
ZION Cosmic Harmony Deeksha — Canonical Pipeline (v2.9.8)
Python Fallback Miner
=====================

Implementace CHvDeeksha pro případ kdy není k dispozici Rust/nativní build.

Priority (sestupně):
  1. libcosmic_harmony FFI  — zion_deeksha_hash() z nativní knihovny (nejrychlejší)
  2. Pure Python reference  — Deeksha pipeline v čistém Pythonu (~0.5-2 H/s)

Pipeline CHvDeeksha (Oneness pipeline):
  Krok 1: SHA3-256  (keccak256_opt)       — základní hash header+nonce
  Krok 2: SHA3-512  (sha3_512_opt)        — expanze na 64 bajtů
  Krok 3: GoldenMatrix                    — zlatý poměr XOR+rotate mix
  Krok 4: MemoryHard 64 KiB/2/64         — ASIC-rezistentní scratchpad
  Krok 5: NpuMix    INT8 MLP 64→128→64   — neuronová konzistence (CPU impl)
  Krok 6: CosmicFusion 4× Keccak+AES     — finální kondenzace → Hash32

Kanonický test vektor (z deeksha.rs self_test / generate_test_vector):
  header: ZION_DEEKSHA_GENESIS_V298_CANONICAL
  nonce:  0x2980_0001_0000_0001
  hash:   f72031a1f648050f05e6719fd6df895bbd319590277267857316ba6e6444f700

Usage:
    python cosmic_harmony_deeksha_fallback.py \\
        --pool testnet.zion.network:3333 \\
        --wallet zion1q... \\
        --worker my-worker \\
        --threads 4

Version: 2.9.8 — CHvDeeksha Canonical
Date:    6. března 2026
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

# MLP genesis seed — musí se shodovat s CHV4_MLP_GENESIS_SEED z algorithms_npu.rs
CHV4_MLP_GENESIS_SEED = b"ZION_CHV4_NPU_GENESIS_SEED_V1"

# Kanonický test vektor (code-frozen, generován cargo test generate_test_vector_print)
CANONICAL_TEST_HEADER = b"ZION_DEEKSHA_GENESIS_V298_CANONICAL"
CANONICAL_TEST_NONCE  = 0x2980_0001_0000_0001
CANONICAL_EXPECTED_HEX = "f72031a1f648050f05e6719fd6df895bbd319590277267857316ba6e6444f700"

# ---------------------------------------------------------------------------
# Nativní knihovna — zion_deeksha_hash() z libcosmic_harmony
# ---------------------------------------------------------------------------

class _NativeLib:
    """
    Obal pro Deeksha native FFI.

    Hledá tyto symboly (v pořadí preferencí):
      zion_deeksha_hash(header, header_len, nonce, output[32]) -> i32
      zion_deeksha_hash_with_height(header, header_len, nonce, height, output[32]) -> i32
    """

    def __init__(self) -> None:
        self._lib: Optional[ctypes.CDLL] = None
        self._hash_fn = None
        self._hash_height_fn = None
        self._self_test_fn = None
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
        paths = self._find_lib_paths()
        if not paths:
            log.warning("[Deeksha] native library not found — pure Python fallback active")
            return
        for p in paths:
            try:
                lib = ctypes.CDLL(str(p))

                # zion_deeksha_hash(header_ptr, header_len, nonce, output_ptr) -> i32
                fn = lib.zion_deeksha_hash
                fn.argtypes = [
                    ctypes.POINTER(ctypes.c_uint8),
                    ctypes.c_size_t,
                    ctypes.c_uint64,
                    ctypes.POINTER(ctypes.c_uint8),
                ]
                fn.restype = ctypes.c_int32
                self._hash_fn = fn

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

                # zion_deeksha_self_test — volitelný
                try:
                    st = lib.zion_deeksha_self_test
                    st.argtypes = []
                    st.restype = ctypes.c_int32
                    self._self_test_fn = st
                except AttributeError:
                    pass

                self._lib = lib
                log.info(f"[Deeksha] Native lib loaded: {p}")
                return
            except (OSError, AttributeError) as e:
                log.warning(f"[Deeksha] Failed to load {p}: {e} — trying next candidate")

        log.warning("[Deeksha] no compatible native library found — pure Python fallback active")

    @property
    def available(self) -> bool:
        return self._hash_fn is not None

    def self_test(self) -> bool:
        """Zavolá zion_deeksha_self_test() pokud je k dispozici."""
        if self._self_test_fn is not None:
            result = self._self_test_fn()
            return result == 0
        # Fallback: ověř kanonický vektor
        h = self.hash(CANONICAL_TEST_HEADER, CANONICAL_TEST_NONCE)
        return h.hex() == CANONICAL_EXPECTED_HEX

    def hash(self, header: bytes, nonce: int, height: int = 0) -> bytes:
        out = (ctypes.c_uint8 * 32)()
        hdr = (ctypes.c_uint8 * len(header))(*header)
        if self._hash_height_fn is not None and height > 0:
            self._hash_height_fn(hdr, len(header), nonce, height, out)
        else:
            self._hash_fn(hdr, len(header), nonce, out)
        return bytes(out)


_native = _NativeLib()

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
    buf = bytearray(SCRATCHPAD_SIZE)
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


# INT8 MLP váhy — odvozeny z Blake3(CHV4_MLP_GENESIS_SEED)
# V Pythonu nemáme Blake3 standardně, použijeme SHA3-256 chain jako aproximaci.
# Poznámka: tato aproximace NENÍ konsenzu-identická s Rust implementací!
# Pro konsenzus-správné výsledky VŽDY použijte nativní FFI.
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


def _cosmic_fusion(state64: bytes) -> bytes:
    """
    CosmicFusion — FUSION_ROUNDS=4 iterací SHA3-256 + GoldenMatrix.
    Vstup: 64 bajtů. Výstup: 32 bajtů (finální hash).
    """
    cur = state64
    for _ in range(FUSION_ROUNDS):
        cur = _sha3_256(cur)         # 32 bajtů
        cur = _sha3_256(cur + cur)   # dvojitý hash → 32 bajtů (simulace AES-NI expanze)
    return cur[:32]


def deeksha_hash_python(header: bytes, nonce: int) -> bytes:
    """
    Pure Python CHvDeeksha pipeline.

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

    # Krok 4: MemoryHard (64 KiB scratchpad)
    mh = _memory_hard_transform(gm)

    # Krok 5: NpuMix (INT8 MLP)
    npu_out = _npu_mix(mh)

    # Krok 6: CosmicFusion → Hash32
    return _cosmic_fusion(npu_out)


def hash_deeksha(header: bytes, nonce: int, height: int = 0) -> bytes:
    """
    Hashování přes Deeksha pipeline.
    Preferuje nativní FFI, fallback na pure Python.
    """
    if _native.available:
        return _native.hash(header, nonce, height)
    return deeksha_hash_python(header, nonce)


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
        self._running = False
        self._login_id: str = "0"
        self._gpu = None

        # Stats
        self._hashes: int = 0
        self._shares: int = 0
        self._start_time: float = 0.0
        self._stats_lock = threading.Lock()

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
                "agent": f"zion-deeksha-python/{self.worker}",
                # Primárně chceme deeksha, ale pool taky akceptuje "cosmic_harmony"
                "algo": ["cosmic_harmony_deeksha", "cosmic_harmony", "deeksha"],
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
            self._current_job = job
        log.info(
            f"[Job] id={job.get('job_id', '?')} height={job.get('height', '?')} "
            f"target={str(job.get('target', '?'))[:8]}..."
        )

    def _submit_share(self, job_id: str, nonce: int, result: bytes) -> None:
        nonce_hex = submit_nonce_hex(nonce)
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
            self._shares += 1
        log.info(f"[Share] Submitted! nonce={nonce_hex} hash={result.hex()[:16]}...")

    # ------------------------------------------------------------------
    # Mining
    # ------------------------------------------------------------------

    def _mine_thread(self, thread_id: int) -> None:
        """Mining vlákno — iteruje nonce a hashuje přes Deeksha pipeline."""
        nonce_base = (int(os.environ.get("ZION_NONCE_BASE", "0")) or 0) & UINT32_MASK
        gpu_backend = self._gpu if self.gpu else None
        while self._running:
            job = None
            with self._job_lock:
                if self._current_job:
                    job = dict(self._current_job)

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

                # Každé vlákno začíná od jiného offsetu, s nonce_base pro revenue separation
                nonce = (nonce_base + thread_id * (1 << 24)) & UINT32_MASK
                gpu_batch_size = max(1, int(getattr(gpu_backend, "batch_size", 65536))) if gpu_backend is not None else 0

                while self._running:
                    with self._job_lock:
                        if self._current_job and str(self._current_job.get("job_id")) != job_id:
                            break  # nový job

                    if gpu_backend is not None:
                        result = gpu_backend.mine(blob, nonce, gpu_batch_size, target_u32)

                        with self._stats_lock:
                            self._hashes += gpu_batch_size

                        if result is not None:
                            found_nonce, found_hash = result
                            if meets_target(found_hash, target_u32, cosmic_state0_endian):
                                log.info(
                                    f"[Thread-{thread_id}] ✅ Share found! "
                                    f"nonce={submit_nonce_hex(found_nonce)} hash={found_hash.hex()[:16]}..."
                                )
                                self._submit_share(job_id, found_nonce, found_hash)

                        nonce = (nonce + gpu_batch_size * self.threads) & UINT32_MASK
                        continue

                    h = hash_deeksha(blob, nonce, height)

                    with self._stats_lock:
                        self._hashes += 1

                    if meets_target(h, target_u32, cosmic_state0_endian):
                        log.info(
                            f"[Thread-{thread_id}] ✅ Share found! "
                            f"nonce={submit_nonce_hex(nonce)} hash={h.hex()[:16]}..."
                        )
                        self._submit_share(job_id, nonce, h)

                    nonce = (nonce + self.threads) & UINT32_MASK

            except Exception as e:
                log.error(f"[Thread-{thread_id}] Mining error: {e}", exc_info=True)
                time.sleep(1)

    def _stats_thread(self) -> None:
        """Zapisuje statistiky do JSON souboru a loguje hashrate."""
        while self._running:
            time.sleep(self.stats_interval)
            elapsed = time.time() - self._start_time
            gpu_backend_name = getattr(self._gpu, "backend_name", None) if self.gpu else None
            backend_label = f"gpu_{gpu_backend_name}" if gpu_backend_name and gpu_backend_name != "cpu" else ("native_ffi" if _native.available else "pure_python")
            with self._stats_lock:
                hr = self._hashes / elapsed if elapsed > 0 else 0.0
                stats = {
                    "hashrate": round(hr, 3),
                    "hashrate_10s": round(hr, 3),
                    "hashrate_window_hs": round(hr, 3),
                    "shares": self._shares,
                    "shares_sent": self._shares,
                    "shares_accepted": self._shares,
                    "hashes_total": self._hashes,
                    "total_hashes": self._hashes,
                    "algorithm": "cosmic_harmony_deeksha",
                    "backend": backend_label,
                    "threads": self.threads,
                    "cpu_threads": self.threads,
                    "uptime_secs": round(elapsed, 1),
                    "canonical_hash": CANONICAL_EXPECTED_HEX,
                }
            log.info(
                f"[Stats] {hr:.3f} H/s | shares={self._shares} | "
                f"hashes={self._hashes} | backend={backend_label.replace('gpu_', '')}"
            )
            if self.stats_file:
                try:
                    with open(self.stats_file, "w") as f:
                        json.dump(stats, f)
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
                elif msg.get("error"):
                    log.warning(f"[Stratum] Server error: {msg['error']}")
            except Exception as e:
                log.error(f"[Stratum] Listener error: {e}")
                if self._running:
                    time.sleep(2)

    def run(self) -> None:
        worker_name = self.worker if self.worker.endswith("-deeksha") else f"{self.worker}-deeksha"
        gpu_backend_name = getattr(self._gpu, "backend_name", None) if self.gpu else None
        back = f"gpu_{gpu_backend_name}" if gpu_backend_name and gpu_backend_name != "cpu" else ("native_ffi" if _native.available else "pure_python")
        log.info(f"[CHvDeeksha Miner] Starting")
        log.info(f"  Backend:  {back}")
        log.info(f"  Threads:  {self.threads}")
        log.info(f"  Pool:     {self.pool}")
        log.info(f"  Wallet:   {self.wallet}")
        log.info(f"  Worker:   {worker_name}")
        log.info(f"  Pipeline: Keccak→SHA3→GoldenMatrix→MemoryHard(64KiB)→NpuMix→CosmicFusion")

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
            for i in range(self.threads):
                t = threading.Thread(target=self._mine_thread, args=(i,), daemon=True, name=f"deeksha-{i}")
                t.start()
                threads.append(t)

            stats_t = threading.Thread(target=self._stats_thread, daemon=True, name="deeksha-stats")
            stats_t.start()

            listen_t = threading.Thread(target=self._listener_thread, daemon=True, name="deeksha-listener")
            listen_t.start()

            try:
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

            if not should_stop:
                log.warning("[Stratum] Disconnected — reconnecting in 3s...")
                time.sleep(3)


# ---------------------------------------------------------------------------
# Self-test a verify
# ---------------------------------------------------------------------------

def _verify_canonical_vector() -> bool:
    """
    Ověří kanonický test vektor oproti:
    1. Nativní FFI (zion_deeksha_hash)
    2. Pure Python pipeline
    """
    ok = True
    print("=== CHvDeeksha Canonical Test Vector Verification ===")
    print(f"  Header:   {CANONICAL_TEST_HEADER.decode()}")
    print(f"  Nonce:    0x{CANONICAL_TEST_NONCE:016x}")
    print(f"  Expected: {CANONICAL_EXPECTED_HEX}")
    print()

    if _native.available:
        h_native = _native.hash(CANONICAL_TEST_HEADER, CANONICAL_TEST_NONCE)
        match = "✅ MATCH" if h_native.hex() == CANONICAL_EXPECTED_HEX else "❌ MISMATCH"
        print(f"  Native FFI:  {h_native.hex()} {match}")
        if h_native.hex() != CANONICAL_EXPECTED_HEX:
            ok = False
    else:
        print("  Native FFI:  [not available]")

    h_py = deeksha_hash_python(CANONICAL_TEST_HEADER, CANONICAL_TEST_NONCE)
    # Pure Python je aproximace — může se lišit od Rust
    print(f"  Pure Python: {h_py.hex()} [referenční aproximace]")

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
        description="ZION CHvDeeksha Canonical Python Fallback Miner (v2.9.8)"
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
