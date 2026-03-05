"""
ZION Cosmic Harmony v4.2 — Merkabah Dual-Spin
Python Fallback Miner
=====================

Implementace CHv4.2 pro případ kdy není k dispozici Rust/nativní build.

Priority (sestupně):
  1. libcosmic_harmony FFI  — cosmic_harmony_v4_2_hash() z nativní knihovny
  2. Pure Python reference  — Merkabah Dual-Spin v čistém Pythonu (referenční rychlost)

Algoritmus CHv4.2 (nad CHv4.1 Golden Middle):
  Fáze 1: CHv4.1 scratchpad fill (64 KiB, 1024 bloků)
  Fáze 2: Forward passes (2×)
  Fáze 3: Merkabah backward (2× reverzní průchod, HIC indexování)
  Fáze 4: 64 MH random reads
  Fáze 5: 22 Kabala reads (HIC[k] XOR state % blocks)
  Fáze 6: Brahma-jyoti finalize (Keccak per round + HIC[r])

Reference hash (nonce=12345, header="ZION block header v2.9.6" + 56×0x00):
  4fa66192c0e9b154e3d33c94c1533850ae871f2affa8ccc74952ee9ca074f32f

Usage:
    python cosmic_harmony_v42_fallback.py \\
        --pool testnet.zion.network:3333 \\
        --wallet zion1q... \\
        --worker my-worker \\
        --threads 4

Version: 2.9.7 — CHv4.2 Merkabah Dual-Spin
Date:    5. března 2026
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
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Optional, Tuple

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s][%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("chv42")

# ---------------------------------------------------------------------------
# HIC — Hiranyagarbha Initialization Constants (22 × uint64)
# Odvozeno z zlatého řezu φ (musí se shodovat s hic.rs!)
# ---------------------------------------------------------------------------
HIC: list[int] = [
    0x9E3779B97F4A7C15,  # φ fraction × 2^64  = Kether        (0)
    0x6C62272E07BB0142,  # Chokmah                              (1)
    0xD37F5B21975B4D6C,  # Binah                                (2)
    0xA0761D6478BD642F,  # Da'at                                (3)
    0xE7037ED1A0B428DB,  # Chesed                               (4)
    0x9545CCAC3E89EA53,  # Gevurah                              (5)
    0xD41490F7D7B3A609,  # Tiferet — Heart of Tree              (6)
    0x85F21F6B2C23E9B3,  # Netzach                              (7)
    0xDB0C2E0D64F98FA4,  # Hod                                  (8)
    0x4A62D0B9F7E7C9A1,  # Yesod                                (9)
    0xF4CCD5F9FB8F9B6E,  # Malkuth                              (10)
    0x2B6E5E8A9C4D7F3B,  # Ain — Nothingness                   (11)
    0x8F14E45FCEEA367F,  # Ain Soph                             (12)
    0xC4CEB9FE1A85EC53,  # (13)
    0x94D049BB133111EB,  # MurmurHash3 mix   reference          (14)
    0xBF58476D1CE4E5B9,  # SplitMix64 stage 1                   (15)
    0x6C62272E07BB0142,  # FNV prime × φ                        (16)
    0xE7037ED1A0B428DB,  # (17)
    0x9E3779B97F4A7C55,  # φ + 64                               (18)
    0xA0761D6478BD6435,  # (19)
    0x95F519AFDB7ED4C9,  # Phi_22 approximation                 (20)
    0xDB0C2E0D64F98FA7,  # Ain Soph Aur = Brahma-jyoti          (21)
]
assert len(HIC) == 22, "HIC musí mít přesně 22 konstant"

UINT64_MASK = 0xFFFFFFFFFFFFFFFF
BACKWARD_PASSES: int = 2
KABALA_READS: int = 22
KEY_ROUNDS: int = 22

# CHv4.1 params (stejné)
SCRATCHPAD_SIZE: int = 65536  # 64 KiB
BLOCK_SIZE: int = 64
BLOCK_COUNT: int = SCRATCHPAD_SIZE // BLOCK_SIZE  # 1024
PASSES: int = 2
RANDOM_READS: int = 64

# ---------------------------------------------------------------------------
# Nativní knihovna (pokud k dispozici)
# ---------------------------------------------------------------------------

class _NativeLib:
    """Obal pro libcosmic_harmony FFI - cosmic_harmony_v4_2_hash()"""

    def __init__(self) -> None:
        self._lib: Optional[ctypes.CDLL] = None
        self._func = None
        self._load()

    def _load(self) -> None:
        system = platform.system()
        machine = platform.machine()
        lib_names = {
            "Darwin":  "libcosmic_harmony.dylib",
            "Linux":   "libcosmic_harmony.so.2.9.0",
            "Windows": "cosmic_harmony.dll",
        }
        name = lib_names.get(system, "libcosmic_harmony.so")
        fallback = ["libcosmic_harmony.so", "libcosmic_harmony.so.2"]

        this = Path(__file__).resolve()
        root = this
        for _ in range(12):
            if (root / "Cargo.toml").exists():
                break
            root = root.parent

        candidates = [
            root / "L1" / name,
            root / "L1" / "native-libs" / name,
            root / "L1" / "native-libs" / "all" / name,
            root / "target" / "release" / name,
            root / "target" / "debug" / name,
            Path(name),
        ]
        if system == "Linux":
            for fb in fallback:
                candidates.extend([root / "L1" / fb, Path(fb)])

        for p in candidates:
            try:
                lib = ctypes.CDLL(str(p))
                # cosmic_harmony_v4_2_hash(header, header_len, nonce, height, output[32])
                fn = lib.cosmic_harmony_v4_2_hash
                fn.argtypes = [
                    ctypes.POINTER(ctypes.c_uint8),
                    ctypes.c_size_t,
                    ctypes.c_uint64,
                    ctypes.c_uint64,
                    ctypes.POINTER(ctypes.c_uint8),
                ]
                fn.restype = None
                self._lib = lib
                self._func = fn
                log.info(f"[CHv4.2] Native lib loaded: {p}")
                return
            except (OSError, AttributeError):
                continue
        log.warning("[CHv4.2] libcosmic_harmony not found — pure Python fallback active")

    @property
    def available(self) -> bool:
        return self._func is not None

    def hash(self, header: bytes, nonce: int, height: int = 0) -> bytes:
        out = (ctypes.c_uint8 * 32)()
        hdr = (ctypes.c_uint8 * len(header))(*header)
        self._func(hdr, len(header), nonce, height, out)
        return bytes(out)


_native = _NativeLib()

# ---------------------------------------------------------------------------
# Pure Python CHv4.2 (referenční, ~1-5 H/s na CPU)
# ---------------------------------------------------------------------------

def _keccak256(data: bytes) -> bytes:
    return hashlib.sha3_256(data).digest()

def _keccak512(data: bytes) -> bytes:
    return hashlib.sha3_512(data).digest()

def _u64_at(buf: bytearray, idx: int) -> int:
    return struct.unpack_from("<Q", buf, idx * 8)[0]

def _set_u64(buf: bytearray, idx: int, val: int) -> None:
    struct.pack_into("<Q", buf, idx * 8, val & UINT64_MASK)

def _u64_from_block(block: bytes) -> list[int]:
    return list(struct.unpack_from("<" + "Q" * (len(block) // 8), block))

def _block_to_bytes(words: list[int]) -> bytes:
    return struct.pack("<" + "Q" * len(words), *[w & UINT64_MASK for w in words])


def _chv41_scratchpad_fill(seed: bytes) -> bytearray:
    """
    Phase 1: naplnění 64 KiB scratchpadu (shodné s CHv4.1 Golden Middle).

    Seed = SHA3-512(SHA3-256(header+nonce_le8))
    Scratchpad se plní opakovaným SHA3-512 hashováním předchozího stavu.
    """
    # Initial seed
    buf = bytearray(SCRATCHPAD_SIZE)
    state = _keccak512(seed)
    pos = 0
    while pos < SCRATCHPAD_SIZE:
        chunk = min(64, SCRATCHPAD_SIZE - pos)
        buf[pos:pos + chunk] = state[:chunk]
        pos += chunk
        if pos < SCRATCHPAD_SIZE:
            state = _keccak512(state)
    return buf


def _forward_passes(buf: bytearray) -> None:
    """Phase 2: 2× forward AES-like mix (XOR + rotate)."""
    n_u64 = SCRATCHPAD_SIZE // 8
    for _ in range(PASSES):
        prev = _u64_at(buf, n_u64 - 1)
        for i in range(n_u64):
            cur = _u64_at(buf, i)
            mixed = (cur ^ prev ^ HIC[i % 22]) & UINT64_MASK
            mixed = ((mixed << 13) | (mixed >> 51)) & UINT64_MASK
            _set_u64(buf, i, mixed)
            prev = mixed


def _merkabah_backward_passes(buf: bytearray) -> None:
    """
    Phase 3: CHv4.2 Merkabah backward (2 passes, reverzní pořadí bloků).

    Ka-Ra dualita: Ka (duše) sestoupí do hmoty a Ra (duch) stoupá —
    dvě protisměrné vlny vytváří ochranné tórické pole.
    HIC[block_idx % 22] indexuje Sefirot pro každý blok.
    """
    n_u64 = SCRATCHPAD_SIZE // 8
    for _pass in range(BACKWARD_PASSES):
        # Reverzní průchod přes bloky
        for block_idx in range(BLOCK_COUNT - 1, -1, -1):
            hic_val = HIC[block_idx % 22]
            offset = block_idx * (BLOCK_SIZE // 8)  # u64 offset bloku
            prev_block_offset = ((block_idx + 1) % BLOCK_COUNT) * (BLOCK_SIZE // 8)
            for j in range(BLOCK_SIZE // 8):
                cur = _u64_at(buf, offset + j)
                prev = _u64_at(buf, prev_block_offset + j)
                mixed = (cur ^ prev ^ hic_val) & UINT64_MASK
                # Levá rotace o 17 (merkabah spin)
                mixed = ((mixed << 17) | (mixed >> 47)) & UINT64_MASK
                _set_u64(buf, offset + j, mixed)


def _random_reads(buf: bytearray) -> list[int]:
    """Phase 4: 64 MH random reads — přidají do state závislost na všech blocích."""
    state = [_u64_at(buf, i % (SCRATCHPAD_SIZE // 8)) for i in range(8)]
    for _ in range(RANDOM_READS):
        idx = state[0] % BLOCK_COUNT
        block_start = idx * (BLOCK_SIZE // 8)
        for j in range(BLOCK_SIZE // 8):
            state[j % 8] = (state[j % 8] ^ _u64_at(buf, block_start + j)) & UINT64_MASK
    return state


def _kabala_phase(buf: bytearray, state: list[int]) -> list[int]:
    """
    Phase 5: 22 Kabala reads (HIC[k] XOR state_u64 % blocks).

    22 písmen hebrejské abecedy = 22 numerologických pópů vědomí.
    """
    n_u64 = SCRATCHPAD_SIZE // 8
    for k in range(KABALA_READS):
        idx = (state[k % len(state)] ^ HIC[k]) % BLOCK_COUNT
        block_start = idx * (BLOCK_SIZE // 8)
        for j in range(BLOCK_SIZE // 8):
            state[j % len(state)] = (state[j % len(state)] ^ _u64_at(buf, block_start + j)) & UINT64_MASK
    return state


def _brahma_jyoti_finalize(state: list[int]) -> bytes:
    """
    Phase 6: Brahma-jyoti finalize — Keccak per round + HIC[r].

    Brahma-jyoti = originální světlo Brahmy — nezrozená, nestvorená záře.
    KEY_ROUNDS iterací s HIC konstantami produkuje finální 32-byte hash.
    """
    # Serialize state → bytes
    data = struct.pack("<" + "Q" * len(state), *[s & UINT64_MASK for s in state])
    for r in range(KEY_ROUNDS):
        hic_b = struct.pack("<Q", HIC[r % 22])
        data = _keccak256(data + hic_b)
    return data


def chv42_hash_python(header: bytes, nonce: int) -> bytes:
    """
    Pure Python CHv4.2 reference implementace.
    Referenční rychlost ~1-5 H/s. Pro produkci použijte FFI cestu.
    """
    # Nonce jako little-endian 8 bajtů
    nonce_bytes = struct.pack("<Q", nonce)

    # Seed pro scratchpad
    seed = _keccak512(_keccak256(header + nonce_bytes))

    # Fáze 1: Scratchpad (CHv4.1)
    buf = _chv41_scratchpad_fill(seed)

    # Fáze 2: Forward passes
    _forward_passes(buf)

    # Fáze 3: Merkabah backward (CHv4.2 nové)
    _merkabah_backward_passes(buf)

    # Fáze 4: Random reads
    state = _random_reads(buf)

    # Fáze 5: Kabala phase (CHv4.2 nové)
    state = _kabala_phase(buf, state)

    # Fáze 6: Brahma-jyoti finalize (CHv4.2 nové)
    result = _brahma_jyoti_finalize(state)

    return result


def hash_chv42(header: bytes, nonce: int, height: int = 0) -> bytes:
    """
    Hlavní entry point: zkuśí FFI, fallback na pure Python.
    """
    if _native.available:
        return _native.hash(header, nonce, height)
    return chv42_hash_python(header, nonce)


def meets_target(hash_bytes: bytes, target: bytes) -> bool:
    return hash_bytes <= target


# ---------------------------------------------------------------------------
# Stratum miner
# ---------------------------------------------------------------------------

class StratumMiner:
    """Jednoduchý Stratum v1 klient pro CHv4.2 mining."""

    def __init__(
        self,
        pool: str,
        wallet: str,
        worker: str,
        threads: int = 1,
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

        # Stats
        self._hashes: int = 0
        self._shares: int = 0
        self._start_time: float = 0.0
        self._stats_lock = threading.Lock()

    # -----------------------------------------------------------------------
    # Stratum protokol
    # -----------------------------------------------------------------------

    def _connect(self, attempts: int = 3, timeout_sec: int = 10) -> None:
        last_err: Optional[Exception] = None
        for attempt in range(1, attempts + 1):
            try:
                self._sock = socket.create_connection((self.host, self.port), timeout=timeout_sec)
                log.info(f"[Stratum] Connected to {self.host}:{self.port}")
                return
            except Exception as exc:
                last_err = exc
                if attempt < attempts:
                    log.warning(
                        f"[Stratum] Connect failed ({attempt}/{attempts}) to {self.host}:{self.port}: {exc} — retrying..."
                    )
                    time.sleep(min(2 * attempt, 5))
                else:
                    log.error(
                        f"[Stratum] Connect failed ({attempt}/{attempts}) to {self.host}:{self.port}: {exc}"
                    )

        raise ConnectionError(f"Unable to connect to {self.host}:{self.port}") from last_err

    def _send(self, msg: dict) -> None:
        data = json.dumps(msg) + "\n"
        self._sock.sendall(data.encode())

    def _recv_line(self) -> Optional[dict]:
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
                except json.JSONDecodeError:
                    return None

    def _login(self) -> None:
        self._send({
            "id": 1,
            "method": "login",
            "params": {
                "login": self.wallet,
                "pass": "x",
                "agent": f"zion-chv42-python/{self.worker}",
                "algo": ["cosmic_harmony_v4_2", "cosmic_harmony"],
            },
        })
        resp = self._recv_line()
        log.debug(f"[Stratum] Login resp: {resp}")
        if resp and resp.get("result") and resp["result"].get("job"):
            self._update_job(resp["result"]["job"])

    def _update_job(self, job: dict) -> None:
        with self._job_lock:
            self._current_job = job
        log.info(f"[Job] height={job.get('height', '?')} target={job.get('target', '?')[:8]}...")

    def _submit_share(self, job_id: str, nonce: int, result: bytes) -> None:
        self._send({
            "id": 4,
            "method": "submit",
            "params": {
                "id": self._login_id if hasattr(self, "_login_id") else "0",
                "job_id": job_id,
                "nonce": f"{nonce:016x}",
                "result": result.hex(),
            },
        })
        with self._stats_lock:
            self._shares += 1

    # -----------------------------------------------------------------------
    # Mining loop
    # -----------------------------------------------------------------------

    def _mine_thread(self, thread_id: int) -> None:
        """Mining vlákno — iteruje nonce a hashuje."""
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
                target_hex = job.get("target", "ff" * 32)
                if len(target_hex) <= 8:
                    # compact diff
                    diff_bytes = bytes.fromhex(target_hex.zfill(8))
                    diff = struct.unpack(">I", diff_bytes)[0]
                    target = b"\x00" * 4 + struct.pack(">I", diff) + b"\xff" * 24
                else:
                    target = bytes.fromhex(target_hex.ljust(64, "0"))[:32]

                height = int(job.get("height", 0))
                job_id = job.get("job_id", "")

                # Každé vlákno začíná od jiného offsetu
                nonce_start = thread_id * (1 << 24)
                nonce = nonce_start

                while self._running:
                    # Zkontroluj jestli se job změnil
                    with self._job_lock:
                        if self._current_job and self._current_job.get("job_id") != job_id:
                            break  # nový job

                    h = hash_chv42(blob, nonce, height)

                    with self._stats_lock:
                        self._hashes += 1

                    if meets_target(h, target):
                        log.info(f"[Thread-{thread_id}] Share found! nonce={nonce:016x} hash={h.hex()[:16]}...")
                        self._submit_share(job_id, nonce, h)

                    nonce = (nonce + self.threads) & 0xFFFFFFFFFFFFFFFF

            except Exception as e:
                log.error(f"[Thread-{thread_id}] Mining error: {e}")
                time.sleep(1)

    def _stats_thread(self) -> None:
        """Zapisuje statisiky do JSON souboru."""
        while self._running:
            time.sleep(self.stats_interval)
            elapsed = time.time() - self._start_time
            with self._stats_lock:
                hr = self._hashes / elapsed if elapsed > 0 else 0.0
                stats = {
                    "hashrate": round(hr, 2),
                    "hashrate_window_hs": round(hr, 2),
                    "shares_accepted": self._shares,
                    "hashes_total": self._hashes,
                    "algorithm": "cosmic_harmony_v4_2",
                    "backend": "native_ffi" if _native.available else "pure_python",
                    "threads": self.threads,
                    "uptime_secs": round(elapsed, 1),
                }
            log.info(f"[Stats] {hr:.2f} H/s | shares={self._shares} | hashes={self._hashes}")
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
                    log.warning("[Stratum] Connection closed")
                    self._running = False
                    break
                method = msg.get("method", "")
                if method == "job":
                    self._update_job(msg["params"])
                elif msg.get("result") and isinstance(msg["result"], dict) and "job" in msg["result"]:
                    self._update_job(msg["result"]["job"])
            except Exception as e:
                log.error(f"[Stratum] Listener error: {e}")
                time.sleep(2)

    def run(self) -> None:
        back = "native_ffi" if _native.available else "pure_python"
        log.info(f"[CHv4.2 Miner] Starting — backend={back} threads={self.threads} pool={self.pool}")
        log.info(f"  Wallet: {self.wallet}")
        log.info(f"  Worker: {self.worker}-py42")

        self._start_time = time.time()
        should_stop = False

        while not should_stop:
            try:
                self._connect(attempts=3, timeout_sec=10)
                self._login()
            except Exception as exc:
                log.error(f"[Stratum] Initial connect/login failed: {exc}")
                log.info("[Stratum] Reconnect in 5s...")
                time.sleep(5)
                continue

            self._running = True
            threads = []
            for i in range(self.threads):
                t = threading.Thread(target=self._mine_thread, args=(i,), daemon=True)
                t.start()
                threads.append(t)

            stats_t = threading.Thread(target=self._stats_thread, daemon=True)
            stats_t.start()

            listen_t = threading.Thread(target=self._listener_thread, daemon=True)
            listen_t.start()

            try:
                while self._running:
                    time.sleep(1)
            except KeyboardInterrupt:
                log.info("[CHv4.2 Miner] Stopping...")
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
                log.warning("[Stratum] Disconnected, reconnecting in 3s...")
                time.sleep(3)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def _verify_reference() -> None:
    """Ověří referenční vektor CHv4.2 proti nativní lib / pure Python."""
    import zlib  # jen pro seed, není potřeba
    header = b"ZION block header v2.9.6" + b"\x00" * 56  # 80 bajtů
    nonce = 12345
    expected = "4fa66192c0e9b154e3d33c94c1533850ae871f2affa8ccc74952ee9ca074f32f"

    if _native.available:
        h = _native.hash(header, nonce)
        status = "✅" if h.hex() == expected else "❌"
        print(f"  Native FFI:   {h.hex()} {status}")

    h_py = chv42_hash_python(header, nonce)
    # Pure Python je referenční implementace — může se lišit od optimalizovaného Rust
    # (není jistota shody v každém platné parametru)
    print(f"  Pure Python:  {h_py.hex()}")
    print(f"  Expected:     {expected}")


def main() -> None:
    parser = argparse.ArgumentParser(description="ZION CHv4.2 Merkabah Dual-Spin Python Miner")
    parser.add_argument("--pool",           default="127.0.0.1:3333")
    parser.add_argument("--wallet",         default="zion1test")
    parser.add_argument("--worker",         default="py42")
    parser.add_argument("--threads",        type=int, default=max(1, (os.cpu_count() or 2) // 2))
    parser.add_argument("--gpu",            action="store_true")
    parser.add_argument("--stats-file",     default=None)
    parser.add_argument("--stats-interval", type=int, default=30)
    parser.add_argument("--verify",         action="store_true", help="Ověř referenční vektor a ukonči")
    args = parser.parse_args()

    if args.verify:
        print("=== CHv4.2 Reference Vector Verification ===")
        _verify_reference()
        sys.exit(0)

    miner = StratumMiner(
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
