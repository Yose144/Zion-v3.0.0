#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════════════════╗
║                                                                          ║
║                  🔥 ZION NATIVE MINER v2.9.0 🔥                         ║
║                                                                          ║
║          Unified Native Mining Client - CPU + GPU Support                ║
║             ⚡ Optimized Multi-Threading                                ⚡                           
║                                                                          ║
║  Algorithms:                                                             ║
║    • Cosmic Harmony (CPU: 600 kH/s | GPU: 1.63 MH/s)                     ║
║    • Cosmic Harmony v2 (CPU: 50-100 kH/s | ASIC-resistant)               ║
║    • RandomX (CPU: 640 H/s) ⚠️ ASIC EXISTS (Antminer X5)                 ║
║    • Yescrypt (CPU: 176 H/s)                                             ║
║                                                                          ║
╚══════════════════════════════════════════════════════════════════════════╝
"""

import ctypes
import os
import sys
import time
import socket
import json
import threading
import logging
import multiprocessing as mp
import platform
from collections import deque
from pathlib import Path
from typing import Optional, Dict, Any, List
from dataclasses import dataclass
from enum import Enum
from concurrent.futures import ThreadPoolExecutor, as_completed
from queue import Queue, Empty

# Windows-only hotkeys (XMRig-like). Optional.
try:
    import msvcrt  # type: ignore
    HOTKEYS_AVAILABLE = True
except Exception:
    msvcrt = None  # type: ignore
    HOTKEYS_AVAILABLE = False

# Try to import PyOpenCL for GPU mining
try:
    import pyopencl as cl
    import numpy as np
    GPU_AVAILABLE = True
except ImportError:
    GPU_AVAILABLE = False

    class _NpShim:
        ndarray = Any  # type: ignore

    np = _NpShim()  # type: ignore
    print("⚠️  PyOpenCL not available - GPU mining disabled")

# Import Cosmic Harmony wrapper for CPU fallback
try:
    # First try local mining folder (Desktop Agent)
    sys.path.insert(0, os.path.dirname(__file__))
    from mining.cosmic_harmony_wrapper import CosmicHarmonyHasher
    COSMIC_WRAPPER_AVAILABLE = True
except ImportError:
    try:
        # Fallback to zion.mining (repo root)
        from zion.mining.cosmic_harmony_wrapper import CosmicHarmonyHasher
        COSMIC_WRAPPER_AVAILABLE = True
    except ImportError:
        COSMIC_WRAPPER_AVAILABLE = False
        print("⚠️  Cosmic Harmony wrapper not available - CPU mining may fail")

# Import Cosmic Harmony v2 wrapper for quantum-resistant mining
# Priority: GPU (~15 kH/s) > Native C (~350 H/s) > Numba JIT (~50 H/s) > Python (~0.1 H/s)
COSMIC_V2_OPTIMIZED = False
COSMIC_V2_NATIVE = False
COSMIC_V2_GPU = False
COSMIC_V2_BACKEND = "disabled"
_cosmic_v2_unified_hasher = None

try:
    sys.path.insert(0, os.path.dirname(__file__))
    from mining.cosmic_harmony_v2_unified import CosmicHarmonyV2Unified, HasherBackend
    
    _cosmic_v2_unified_hasher = CosmicHarmonyV2Unified(verbose=True)
    COSMIC_V2_WRAPPER_AVAILABLE = True
    COSMIC_V2_BACKEND = _cosmic_v2_unified_hasher.backend.value
    COSMIC_V2_GPU = _cosmic_v2_unified_hasher.is_gpu
    COSMIC_V2_NATIVE = _cosmic_v2_unified_hasher.backend == HasherBackend.NATIVE_C
    COSMIC_V2_OPTIMIZED = _cosmic_v2_unified_hasher.backend == HasherBackend.NUMBA_JIT
    
    def cosmic_hash_v2(data: bytes, nonce: int, prev_hash: bytes = b'\x00' * 32, block_height: int = 0) -> bytes:
        _cosmic_v2_unified_hasher.update_context(prev_hash, block_height)
        return _cosmic_v2_unified_hasher.hash(data, nonce)

except ImportError as e:
    # Fallback to old import chain
    try:
        from mining.cosmic_harmony_v2_native_wrapper import CosmicHarmonyV2Native
        _cosmic_v2_native = CosmicHarmonyV2Native()
        if _cosmic_v2_native.is_available():
            COSMIC_V2_WRAPPER_AVAILABLE = True
            COSMIC_V2_NATIVE = True
            COSMIC_V2_BACKEND = "native"
            _cosmic_v2_hasher = _cosmic_v2_native
            def cosmic_hash_v2(data: bytes, nonce: int, prev_hash: bytes = b'\x00' * 32, block_height: int = 0) -> bytes:
                return _cosmic_v2_hasher.hash(data, nonce, prev_hash, block_height)
            print(f"✅ Cosmic Harmony v2 NATIVE loaded (fallback)")
        else:
            raise ImportError("Native not available")
    except ImportError:
        try:
            from mining.cosmic_harmony_v2_optimized import CosmicHarmonyV2Optimized
            COSMIC_V2_WRAPPER_AVAILABLE = True
            COSMIC_V2_OPTIMIZED = True
            COSMIC_V2_BACKEND = "numba"
            _cosmic_v2_hasher = CosmicHarmonyV2Optimized()
            def cosmic_hash_v2(data: bytes, nonce: int, prev_hash: bytes = b'\x00' * 32, block_height: int = 0) -> bytes:
                return _cosmic_v2_hasher.hash(data, nonce, prev_hash, block_height)
            print("✅ Cosmic Harmony v2 Numba JIT loaded (fallback)")
        except ImportError:
            try:
                from mining.cosmic_harmony_v2 import cosmic_hash_v2
                COSMIC_V2_WRAPPER_AVAILABLE = True
                COSMIC_V2_BACKEND = "python"
                print("⚠️  Cosmic Harmony v2: Pure Python (~0.1 H/s)")
            except ImportError:
                COSMIC_V2_WRAPPER_AVAILABLE = False
                print("⚠️  Cosmic Harmony v2 not available")

# Import Zion GPU Mining Engine
try:
    from mining.gpu_autolykos_v2_engine import GPUAutolykosMiner, GPUBackend
    from mining.native_autolykos_wrapper import NativeAutolykosMiner
    ZION_GPU_ENGINE = True
except ImportError as e:
    ZION_GPU_ENGINE = False
    GPUAutolykosMiner = None
    NativeAutolykosMiner = None
    print(f"[WARN] Zion GPU engine not available: {e}")

# Import Cosmic Harmony v1 TURBO GPU (8.48 GH/s optimized)
COSMIC_V1_TURBO = False
Cosmic_V1_Turbo_Miner = None
try:
    from mining.cosmic_harmony_v1_turbo import CosmicHarmonyV1Turbo, GPU_AVAILABLE as CV1_GPU
    if CV1_GPU:
        COSMIC_V1_TURBO = True
        Cosmic_V1_Turbo_Miner = CosmicHarmonyV1Turbo
        print("[OK] Cosmic Harmony v1 TURBO GPU loaded (8+ GH/s)")
except ImportError as e:
    print(f"[WARN] Cosmic Harmony v1 TURBO not available: {e}")

# Import Cosmic Harmony v3 - Native Rust FFI + GPU (21+ MH/s)
COSMIC_V3_AVAILABLE = False
COSMIC_V3_GPU_AVAILABLE = False
_cosmic_v3_native = None
_cosmic_v3_gpu = None

# Search paths for CH v3 modules
_ch3_search_paths = [
    os.path.dirname(__file__),  # Same directory as miner
    os.path.join(os.path.dirname(__file__), 'mining'),  # desktop-agent/resources/mining
    os.path.join(os.path.dirname(__file__), 'src', 'miner'),  # dev path
]
for _p in _ch3_search_paths:
    if _p not in sys.path and os.path.isdir(_p):
        sys.path.insert(0, _p)

try:
    from cosmic_harmony_native import CosmicHarmonyNative
    _cosmic_v3_native = CosmicHarmonyNative()
    COSMIC_V3_AVAILABLE = True
    print(f"[OK] Cosmic Harmony v3 NATIVE loaded ({_cosmic_v3_native.cpu_count} cores)")
except Exception as e:
    print(f"[WARN] Cosmic Harmony v3 Native not available: {e}")

try:
    from cosmic_harmony_v3_gpu import CosmicHarmonyV3GPU, GPU_AVAILABLE as CV3_GPU
    if CV3_GPU:
        _cosmic_v3_gpu = CosmicHarmonyV3GPU(batch_size=500_000)
        COSMIC_V3_GPU_AVAILABLE = True
        print(f"[OK] Cosmic Harmony v3 GPU loaded: {_cosmic_v3_gpu.device_info.name}")
except Exception as e:
    print(f"[WARN] Cosmic Harmony v3 GPU not available: {e}")

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s'
)
logger = logging.getLogger("ZionNativeMiner")


class Algorithm(Enum):
    """Supported mining algorithms"""
    COSMIC_HARMONY = "cosmic_harmony"
    COSMIC_HARMONY_V2 = "cosmic_harmony_v2"  # Quantum-resistant, memory-hard
    COSMIC_HARMONY_V3 = "cosmic_harmony_v3"  # Native Rust + GPU (21+ MH/s)
    RANDOMX = "randomx"
    YESCRYPT = "yescrypt"


class MiningMode(Enum):
    """Mining mode selection"""
    CPU = "cpu"
    GPU = "gpu"
    AUTO = "auto"


@dataclass
class MinerConfig:
    """Miner configuration"""
    algorithm: Algorithm = Algorithm.COSMIC_HARMONY
    mode: MiningMode = MiningMode.AUTO
    
    # Pool settings
    pool_host: str = "localhost"
    pool_port: int = 3333
    wallet_address: str = ""
    worker_name: str = "zion-native-miner"
    use_pool: bool = False  # Enable pool mining
    
    # Performance
    cpu_threads: int = 1
    gpu_batch_size: int = 500000  # Optimized for RX 5600 XT
    gpu_work_size: int = 256  # OpenCL work group size
    gpu_id: int = 0  # GPU device ID
    use_gpu_autolykos: bool = True  # Enable Autolykos v2 GPU mining
    use_native_libs: bool = True  # Enable native C/C++ acceleration
    
    # Display
    stats_interval: float = 10.0
    stats_file: str = ""

    # Console UI mode: "lines" (default) or "xmrig" (static dashboard).
    ui: str = "lines"


@dataclass
class MiningStats:
    """Comprehensive mining statistics"""
    hashrate: float = 0.0
    hashes_computed: int = 0
    shares_found: int = 0
    shares_accepted: int = 0
    shares_rejected: int = 0
    power_watts: float = 0.0
    temperature_c: float = 0.0
    uptime_seconds: float = 0.0
    backend: str = "unknown"  # cpu, gpu_opencl, gpu_cuda, native_c
    
    @property
    def hashrate_mhs(self) -> float:
        """Hashrate in MH/s"""
        return self.hashrate / 1_000_000
    
    @property
    def hashrate_khs(self) -> float:
        """Hashrate in kH/s"""
        return self.hashrate / 1_000
    
    @property
    def efficiency_hw(self) -> float:
        """Hashes per Watt"""
        return self.hashrate / max(self.power_watts, 1.0)
    
    @property
    def accept_rate(self) -> float:
        """Share acceptance rate"""
        total = self.shares_accepted + self.shares_rejected
        return (self.shares_accepted / total * 100) if total > 0 else 0.0
    
    # Display
    stats_interval: float = 10.0
    stats_file: str = ""


class StratumClient:
    """Stratum protocol client for pool communication"""
    
    def __init__(self, pool_host: str, pool_port: int, worker_id: str = "worker"):
        self.pool_host = pool_host
        self.pool_port = pool_port
        self.worker_id = worker_id
        self.socket = None
        self.request_id = 1
        self.job_queue = Queue()
        self.current_job = None
        self.connected = False
        self.extranonce1 = None
        self.extranonce2_size = 4

        # Pool-assigned difficulty (from mining.set_difficulty). Many pools omit
        # difficulty/target from mining.notify and rely on set_difficulty instead.
        self.pool_difficulty: Optional[int] = None

        # Share stats (best-effort from pool responses)
        self.shares_sent = 0
        self.shares_accepted = 0
        self.shares_rejected = 0
        self.last_share_error: Optional[str] = None
        self._pending_submit_ids = set()
        self._pending_submit_meta: Dict[int, Dict[str, Any]] = {}

        # Cosmic Harmony v3 pool state0 endianness.
        # Current pool default is little-endian; allow explicit override via env.
        endian_env = str(os.getenv("ZION_COSMIC_STATE0_ENDIAN", "little")).strip().lower()
        self.cosmic_state0_endian: str = "big" if endian_env == "big" else "little"
        # Reject-driven auto-switch is fragile and can mask real target/job issues,
        # so keep it disabled by default. Opt-in only via env.
        self._cosmic_endian_autodetected: bool = False
        self._cosmic_endian_autoswitch: bool = (
            str(os.getenv("ZION_COSMIC_ENDIAN_AUTOSWITCH", "0")).strip().lower()
            in ("1", "true", "yes", "on")
        )

        # Logging throttles (avoid console spam)
        self._last_reject_log_time = 0.0
        self._reject_log_suppressed = 0

        self.last_disconnect_reason: Optional[str] = None

        # Socket send is used from mining threads; guard it.
        self._send_lock = threading.Lock()

        # Request id is incremented from multiple mining threads.
        self._id_lock = threading.Lock()

        # Request/response tracking for handshake calls (subscribe/authorize)
        self._wait_events: Dict[int, threading.Event] = {}
        self._wait_responses: Dict[int, Dict[str, Any]] = {}
        self._wait_lock = threading.Lock()

        # Stratum RPC wait timeout (seconds) for subscribe/login/authorize.
        try:
            rpc_t = float(str(os.getenv("ZION_STRATUM_RPC_TIMEOUT", "8")).strip())
            self._rpc_timeout_sec = max(3.0, min(30.0, rpc_t))
        except Exception:
            self._rpc_timeout_sec = 8.0
        
    def connect(self) -> bool:
        """Connect to pool"""
        try:
            self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.socket.settimeout(10.0)
            self.socket.connect((self.pool_host, self.pool_port))
            self.connected = True
            logger.info(f"✅ Connected to pool {self.pool_host}:{self.pool_port}")
            
            # Start listener thread
            threading.Thread(target=self._listen_loop, daemon=True).start()
            return True
        except Exception as e:
            logger.error(f"❌ Connection failed: {e}")
            return False
    
    def disconnect(self):
        """Disconnect from pool"""
        logger.debug("Disconnecting from pool...")
        self.connected = False
        self.last_disconnect_reason = "client disconnect"
        
        # Give listener thread time to exit gracefully
        time.sleep(0.2)
        
        if self.socket:
            try:
                self.socket.shutdown(socket.SHUT_RDWR)
            except OSError:
                pass  # Socket may already be closed
            
            try:
                self.socket.close()
            except OSError:
                pass
            
            self.socket = None
        
        logger.info("Disconnected from pool")
    
    def subscribe(self) -> bool:
        """Send mining.subscribe"""
        try:
            req_id = self.request_id
            request = {
                "id": req_id,
                "method": "mining.subscribe",
                "params": ["zion-native-miner/2.9.0"]
            }
            self.request_id += 1

            if not self._send_and_wait(req_id, request, timeout=self._rpc_timeout_sec):
                logger.error(
                    f"Subscribe failed: no response from pool (timeout={self._rpc_timeout_sec:.1f}s, req_id={req_id})"
                )
                return False

            resp = self._wait_responses.get(req_id)
            if not resp or resp.get("error"):
                logger.error(f"Subscribe failed: {resp.get('error') if resp else 'no response'}")
                return False

            # Standard Stratum subscribe response:
            # result = [ subscriptions, extranonce1, extranonce2_size ]
            result = resp.get("result")
            if isinstance(result, list) and len(result) >= 2:
                self.extranonce1 = result[1]
                if len(result) >= 3:
                    self.extranonce2_size = int(result[2])
                logger.info(f"✅ Subscribed (extranonce1: {self.extranonce1})")

            return True
        except Exception as e:
            logger.error(f"Subscribe failed: {e}")
            return False

    def login(self, wallet: str, worker: str, algorithm: str) -> bool:
        """Send XMRig-style JSON-RPC login.

        This is the most reliable way to convey the desired algorithm to the pool
        (via params.algo). Some pool deployments ignore Stratum password-based
        algorithm hints.
        """
        try:
            req_id = self.request_id
            self.request_id += 1

            request = {
                "id": req_id,
                "jsonrpc": "2.0",
                "method": "login",
                "params": {
                    "login": wallet,
                    "pass": worker or "default",
                    "agent": "zion-native-miner/2.9.0",
                    "algo": algorithm,
                },
            }

            if not self._send_and_wait(req_id, request, timeout=self._rpc_timeout_sec):
                logger.error(
                    f"Login failed: no response from pool (timeout={self._rpc_timeout_sec:.1f}s, req_id={req_id})"
                )
                return False

            resp = self._wait_responses.get(req_id)
            if not resp or resp.get("error"):
                logger.error(f"Login failed: {resp.get('error') if resp else 'no response'}")
                return False

            result = resp.get("result") or {}
            # Pool returns: { id: <session_id>, job: {...}, status: 'OK' }
            if isinstance(result, dict):
                session_id = result.get("id")
                job = result.get("job")
                if session_id:
                    self.worker_id = session_id
                if isinstance(job, dict):
                    job_endian = str(job.get("cosmic_state0_endian") or "").strip().lower()
                    if job_endian in ("little", "big"):
                        self.cosmic_state0_endian = job_endian
                        logger.info(f"⚙️  Pool Cosmic state0 endianness: {job_endian}")
                    # Normalize into the same shape as mining.notify parsing
                    self.current_job = {
                        "job_id": job.get("job_id"),
                        "blob": job.get("blob"),
                        "seed_hash": job.get("seed_hash", ""),
                        "next_seed_hash": job.get("next_seed_hash", ""),
                        "height": job.get("height", 0),
                        # Some pool responses omit difficulty; keep None so we can
                        # derive it from the 64-bit target.
                        "difficulty": job.get("difficulty"),
                        "clean_jobs": True,
                        "target": job.get("target"),
                        "algo": job.get("algo"),
                    }
                    if (self.current_job.get("difficulty") in (None, 0, "", "0")) and self.pool_difficulty:
                        self.current_job["difficulty"] = int(self.pool_difficulty)
                    try:
                        while True:
                            self.job_queue.get_nowait()
                    except Empty:
                        pass
                    self.job_queue.put(self.current_job)

            logger.info("✅ Logged in (XMRig)")
            return True
        except Exception as e:
            logger.error(f"Login failed: {e}")
            return False
    
    def authorize(self, wallet: str, worker: str, algorithm: str) -> bool:
        """Send mining.authorize.

        Pool-side expects standard Stratum params:
        - params[0]: "wallet.worker"
        - params[1]: password (often "x")
        - params[2]: optional algorithm hint (modern)

        Some pool deployments only detect algorithm via params[2], others via password.
        We include both for compatibility.
        """
        try:
            req_id = self.request_id
            username = f"{wallet}.{worker}" if worker else wallet
            # Include algo in password as a fallback for older pool builds.
            # Pool-side parser supports formats like: "x,a=randomx,d=10000".
            password = f"x:{algorithm},a={algorithm}"

            # Optional difficulty hint (best-effort). Helps avoid diff=1 share spam
            # if pool supports parsing d=... from password.
            try:
                raw = (
                    os.getenv("ZION_MINER_DIFFICULTY")
                    or os.getenv("ZION_DEFAULT_DIFFICULTY")
                    or os.getenv("ZION_DIFFICULTY")
                    or ""
                ).strip()
                if raw:
                    n = int(float(raw))
                    if n > 0:
                        password += f",d={n}"
            except Exception:
                pass
            request = {
                "id": req_id,
                "method": "mining.authorize",
                "params": [username, password, algorithm]
            }
            self.request_id += 1

            if not self._send_and_wait(req_id, request, timeout=self._rpc_timeout_sec):
                logger.error(
                    f"Authorization failed: no response from pool (timeout={self._rpc_timeout_sec:.1f}s, req_id={req_id})"
                )
                return False

            resp = self._wait_responses.get(req_id)
            if not resp or resp.get("error"):
                logger.error(f"Authorization failed: {resp.get('error') if resp else 'no response'}")
                return False

            return bool(resp.get("result"))
        except Exception as e:
            logger.error(f"Authorization failed: {e}")
            return False

    def _send_and_wait(self, req_id: int, request: Dict[str, Any], timeout: float) -> bool:
        """Send a request and wait for a JSON-RPC response with matching id."""
        ev = threading.Event()
        with self._wait_lock:
            self._wait_events[req_id] = ev
            self._wait_responses.pop(req_id, None)

        try:
            self._send_request(request)
        except Exception:
            with self._wait_lock:
                self._wait_events.pop(req_id, None)
            raise

        ok = ev.wait(timeout)
        if not ok:
            try:
                logger.warning(
                    f"⏱️ Stratum RPC timeout: id={req_id}, method={request.get('method')}, timeout={timeout:.1f}s, connected={self.connected}"
                )
            except Exception:
                pass
        with self._wait_lock:
            self._wait_events.pop(req_id, None)
        return ok
    
    def submit_share(
        self,
        job_id: str,
        nonce: int,
        result_hash: bytes,
        meta: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """Submit mining share - Stratum format"""
        try:
            # Use XMRig-style submit so the pool can validate difficulty using the
            # provided result hash even when it can't compute RandomX locally.
            nonce_hex = hex(nonce)[2:].zfill(8)
            result_hex = result_hash.hex()

            with self._id_lock:
                req_id = self.request_id
                self.request_id += 1
                self._pending_submit_ids.add(req_id)
                if meta is not None:
                    self._pending_submit_meta[req_id] = dict(meta)
                self.shares_sent += 1
            request = {
                "id": req_id,
                "jsonrpc": "2.0",
                "method": "submit",
                "params": {
                    "id": self.worker_id,
                    "job_id": job_id,
                    "nonce": nonce_hex,
                    "result": result_hex,
                },
            }
            
            self._send_request(request)
            return True
        except Exception as e:
            logger.error(f"Share submission failed: {e}")
            return False
    
    def get_job(self) -> Optional[Dict]:
        """Get the most recent mining job.

        The pool can push jobs frequently (new templates / clean_jobs). If we
        process jobs FIFO we can end up mining on stale jobs that the pool has
        already evicted -> "Job not found".

        Strategy: drain the queue and keep only the latest job.
        """
        latest = None
        while True:
            try:
                latest = self.job_queue.get_nowait()
            except Empty:
                break

        if latest is not None:
            self.current_job = latest

        return self.current_job
    
    def _send_request(self, request: Dict):
        """Send JSON-RPC request"""
        if not self.socket:
            raise ConnectionError("Not connected")
        
        message = json.dumps(request) + '\n'
        try:
            with self._send_lock:
                self.socket.sendall(message.encode('utf-8'))
        except OSError as e:
            self.last_disconnect_reason = f"send failed: {e}"
            self.connected = False
            raise
    
    def _listen_loop(self):
        """Background listener for pool messages"""
        buffer = ""
        
        while self.connected:
            try:
                # Check if socket is still valid before recv
                if not self.socket or self.socket.fileno() == -1:
                    logger.debug("Socket closed, stopping listener")
                    break
                
                data = self.socket.recv(4096)
                if not data:
                    logger.debug("Empty data received, connection closed")
                    break
                
                buffer += data.decode('utf-8')
                
                while '\n' in buffer:
                    line, buffer = buffer.split('\n', 1)
                    
                    try:
                        message = json.loads(line)
                        self._handle_message(message)
                    except json.JSONDecodeError:
                        pass
            
            except socket.timeout:
                continue
            except OSError as e:
                # Handle WinError 10038 and other socket errors gracefully
                if not self.connected:
                    logger.debug("Socket operation on closed connection, exiting listener")
                    break
                self.last_disconnect_reason = f"socket error: {e}"
                self.connected = False
                logger.error(f"Socket error: {e}")
                break
            except Exception as e:
                self.last_disconnect_reason = f"listener error: {e}"
                self.connected = False
                logger.error(f"Listener error: {e}")
                break
        
        logger.debug("Listener loop terminated")
    
    def _handle_message(self, message: Dict):
        """Handle message from pool"""
        method = message.get('method')

        if method == 'block_found':
            params = message.get('params') or {}
            height = None
            bhash = None
            if isinstance(params, dict):
                height = params.get('height')
                bhash = params.get('hash')
            elif isinstance(params, list) and params:
                height = params[0]
                bhash = params[1] if len(params) > 1 else None

            if height is not None:
                print(f"\nKWIIIIK KEPORKAK NASEL BLOK {height} !!!")
                if bhash:
                    print(f"hash: {str(bhash)[:16]}...")
                print()
            else:
                print("\nKWIIIIK KEPORKAK NASEL BLOK !!!\n")
            return
        
        if method == 'mining.notify':
            # New job notification
            params = message.get('params', [])
            if params:
                # Parse Stratum array format: [job_id, blob, seed_hash, next_seed, height, diff, clean]
                if isinstance(params[0], dict):
                    # Dict format (legacy)
                    job = params[0]
                elif isinstance(params, list) and len(params) >= 2:
                    # Array format (standard Stratum).
                    # Support both layouts:
                    #  - legacy: [job_id, blob, seed_hash, next_seed, height, diff, clean]
                    #  - v2:     [job_id, blob, target, height, algo, seed_hash, clean]
                    is_v2_layout = (
                        len(params) >= 7
                        and isinstance(params[2], str)
                        and len(str(params[2])) in (8, 16, 56, 64)
                        and isinstance(params[4], str)
                    )

                    if is_v2_layout:
                        diff = int(self.pool_difficulty or 1)
                        job = {
                            'job_id': params[0],
                            'blob': params[1],
                            'target': params[2],
                            'height': params[3],
                            'algo': params[4],
                            'seed_hash': params[5] if len(params) > 5 else '',
                            'next_seed_hash': '',
                            'difficulty': diff,
                            'clean_jobs': params[6] if len(params) > 6 else True,
                        }
                    else:
                        diff = params[5] if len(params) > 5 else None
                        if (diff in (None, 0, "", "0")) and self.pool_difficulty:
                            diff = int(self.pool_difficulty)
                        job = {
                            'job_id': params[0],
                            'blob': params[1],
                            'seed_hash': params[2] if len(params) > 2 else '',
                            'next_seed_hash': params[3] if len(params) > 3 else '',
                            'height': params[4] if len(params) > 4 else 0,
                            'difficulty': diff if diff is not None else 1,
                            'clean_jobs': params[6] if len(params) > 6 else True
                        }
                else:
                    logger.warning(f"Invalid job params format: {params}")
                    return
                
                # If pool indicates "clean_jobs", drop any queued jobs so we
                # switch immediately to the newest template.
                if job.get('clean_jobs'):
                    try:
                        while True:
                            self.job_queue.get_nowait()
                    except Empty:
                        pass

                # Latest job always wins
                self.current_job = job
                self.job_queue.put(job)
                logger.debug(
                    f"📋 Received job: {job.get('job_id', 'unknown')} (height={job.get('height', '?')}, diff={job.get('difficulty', '?')})"
                )

        elif method == 'job':
            # XMRig job push: {"jsonrpc":"2.0","method":"job","params":{...}}
            params = message.get('params') or {}
            if isinstance(params, dict):
                job_endian = str(params.get('cosmic_state0_endian') or '').strip().lower()
                if job_endian in ('little', 'big'):
                    self.cosmic_state0_endian = job_endian
                    logger.info(f"⚙️  Pool Cosmic state0 endianness: {job_endian}")
                job = {
                    'job_id': params.get('job_id'),
                    'blob': params.get('blob'),
                    'seed_hash': params.get('seed_hash', ''),
                    'next_seed_hash': params.get('next_seed_hash', ''),
                    'height': params.get('height', 0),
                    # Keep None if missing; we can derive from target.
                    'difficulty': params.get('difficulty'),
                    'clean_jobs': True,
                    'target': params.get('target'),
                    'algo': params.get('algo'),
                }
                if (job.get('difficulty') in (None, 0, "", "0")) and self.pool_difficulty:
                    job['difficulty'] = int(self.pool_difficulty)
                try:
                    while True:
                        self.job_queue.get_nowait()
                except Empty:
                    pass

                self.current_job = job
                self.job_queue.put(job)
                logger.debug(
                    f"📋 Received XMRig job: {job.get('job_id', 'unknown')} (height={job.get('height', '?')}, diff={job.get('difficulty', '?')})"
                )
        
        elif method == 'mining.set_difficulty':
            params = message.get('params', [])
            if params:
                try:
                    n = int(float(params[0]))
                    if n <= 0:
                        return
                    prev = self.pool_difficulty
                    self.pool_difficulty = n
                    if prev != n:
                        logger.info(f"⚡ Pool difficulty set to {n}")
                except Exception:
                    logger.debug(f"⚡ Difficulty set to {params[0]}")
        
        else:
            # Response to our request (share submit / subscribe / authorize, etc.)
            req_id = message.get('id')

            # Unblock subscribe/authorize waits.
            if isinstance(req_id, int):
                with self._wait_lock:
                    ev = self._wait_events.get(req_id)
                    if ev is not None:
                        self._wait_responses[req_id] = message
                        ev.set()

            if req_id in self._pending_submit_ids:
                self._pending_submit_ids.discard(req_id)
                meta = None
                if isinstance(req_id, int):
                    meta = self._pending_submit_meta.pop(req_id, None)

                if message.get('error'):
                    err = message.get('error')
                    self.shares_rejected += 1
                    self.last_share_error = str(err)

                    # Auto-detect Cosmic endianness mismatch (LE vs BE) from rejects.
                    try:
                        err_msg = ""
                        if isinstance(err, dict):
                            err_msg = str(err.get("message") or "")
                        else:
                            err_msg = str(err)

                        if (
                            self._cosmic_endian_autoswitch
                            and (not self._cosmic_endian_autodetected)
                            and ("Does not meet target difficulty" in err_msg)
                            and isinstance(meta, dict)
                            and meta.get("target32") is not None
                            and meta.get("state0_le") is not None
                            and meta.get("state0_be") is not None
                        ):
                            target32 = int(meta["target32"])
                            state0_le = int(meta["state0_le"])
                            state0_be = int(meta["state0_be"])
                            # If it should pass under one endian but is rejected, and the other
                            # endian would fail, assume the pool uses the other endian.
                            if state0_le <= target32 and state0_be > target32:
                                self.cosmic_state0_endian = "big"
                                self._cosmic_endian_autodetected = True
                                logger.warning(
                                    "⚠️ Detected pool Cosmic state0 endianness=big; switching local share check to match"
                                )
                            elif state0_be <= target32 and state0_le > target32:
                                self.cosmic_state0_endian = "little"
                                self._cosmic_endian_autodetected = True
                                logger.warning(
                                    "⚠️ Detected pool Cosmic state0 endianness=little; switching local share check to match"
                                )
                    except Exception:
                        pass
                    # Rate-limit warnings to avoid flooding the console/log.
                    now = time.time()
                    if (now - self._last_reject_log_time) >= 10.0:
                        suffix = ""
                        if self._reject_log_suppressed:
                            suffix = f" (+{self._reject_log_suppressed} suppressed)"
                        meta_suffix = ""
                        if isinstance(meta, dict) and meta:
                            # Keep it compact; enough to correlate target semantics.
                            nonce_hex = meta.get("nonce_hex")
                            state0_hex = meta.get("state0_hex")
                            target32_hex = meta.get("target32_hex")
                            job_short = str(meta.get("job_id", ""))[:8]
                            endian = meta.get("state0_endian", "?")
                            meta_suffix = (
                                f" | job {job_short} nonce {nonce_hex} "
                                f"state0[{endian}] {state0_hex} <= target {target32_hex}"
                            )
                        logger.warning(f"❌ Share rejected by pool: {err}{suffix}{meta_suffix}")
                        self._last_reject_log_time = now
                        self._reject_log_suppressed = 0
                    else:
                        self._reject_log_suppressed += 1
                    return

                result = message.get('result')
                accepted = False
                if isinstance(result, dict):
                    accepted = (result.get('status') == 'OK')
                elif result is True:
                    accepted = True

                if accepted:
                    self.shares_accepted += 1
                    # Keep Mining Logs alive but avoid spam.
                    if self.shares_accepted == 1 or (self.shares_accepted % 100) == 0:
                        logger.info(f"✅ Share accepted by pool (accepted={self.shares_accepted}, sent={self.shares_sent})")
                else:
                    self.shares_rejected += 1
                    self.last_share_error = f"Unexpected submit result: {result}"

                    # Pool may reply with {"result": false} without an error object.
                    # Treat as a reject and attempt to infer Cosmic endianness from meta.
                    try:
                        if (
                            self._cosmic_endian_autoswitch
                            and (not self._cosmic_endian_autodetected)
                            and isinstance(meta, dict)
                            and meta.get("target32") is not None
                            and meta.get("state0_le") is not None
                            and meta.get("state0_be") is not None
                        ):
                            target32 = int(meta["target32"])
                            state0_le = int(meta["state0_le"])
                            state0_be = int(meta["state0_be"])
                            current = getattr(self, "cosmic_state0_endian", "little")

                            if current != "big" and state0_le <= target32 and state0_be > target32:
                                self.cosmic_state0_endian = "big"
                                self._cosmic_endian_autodetected = True
                                logger.warning(
                                    "⚠️ Detected pool Cosmic state0 endianness=big (submit result=false); switching local share check to match"
                                )
                            elif current == "big" and state0_be <= target32 and state0_le > target32:
                                self.cosmic_state0_endian = "little"
                                self._cosmic_endian_autodetected = True
                                logger.warning(
                                    "⚠️ Detected pool Cosmic state0 endianness=little (submit result=false); switching local share check to match"
                                )
                    except Exception:
                        pass

                    try:
                        now = time.time()
                        if (now - self._last_reject_log_time) >= 10.0:
                            suffix = ""
                            if self._reject_log_suppressed:
                                suffix = f" (+{self._reject_log_suppressed} suppressed)"
                            meta_suffix = ""
                            if isinstance(meta, dict) and meta:
                                nonce_hex = meta.get("nonce_hex")
                                state0_hex = meta.get("state0_hex")
                                target32_hex = meta.get("target32_hex")
                                job_short = str(meta.get("job_id", ""))[:8]
                                endian = meta.get("state0_endian", "?")
                                meta_suffix = (
                                    f" | job {job_short} nonce {nonce_hex} "
                                    f"state0[{endian}] {state0_hex} <= target {target32_hex}"
                                )
                            logger.warning(f"❌ Share rejected by pool: result={result}{suffix}{meta_suffix}")
                            self._last_reject_log_time = now
                            self._reject_log_suppressed = 0
                        else:
                            self._reject_log_suppressed += 1
                    except Exception:
                        pass
                return

            # Backward-compatible subscribe parsing (some older paths didn't wait).
            if 'result' in message:
                result = message.get('result')
                if result and isinstance(result, list) and len(result) >= 2:
                    self.extranonce1 = result[1]
                    self.extranonce2_size = int(result[2]) if len(result) >= 3 else self.extranonce2_size


class HotkeyController:
    """Non-blocking hotkeys reader (Windows only)."""

    def __init__(self):
        self.enabled = HOTKEYS_AVAILABLE
        self._queue: "Queue[str]" = Queue()
        self._running = False
        self._thread: Optional[threading.Thread] = None

    def start(self):
        if not self.enabled or self._running:
            return
        self._running = True
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()

    def stop(self):
        self._running = False

    def poll(self) -> Optional[str]:
        try:
            return self._queue.get_nowait()
        except Empty:
            return None

    def _loop(self):
        while self._running:
            try:
                if msvcrt and msvcrt.kbhit():
                    ch = msvcrt.getwch()
                    if ch:
                        self._queue.put(ch)
                else:
                    time.sleep(0.05)
            except Exception:
                time.sleep(0.2)


class NativeLibraryLoader:
    """Handles loading of native DLL libraries"""
    
    def __init__(self):
        self.libs = {}
        # Keep legacy relative path, but also resolve absolute locations.
        self.dll_path = os.path.join("zion", "mining")

    @staticmethod
    def _candidate_library_paths(*names: str) -> List[str]:
        """Build an ordered list of candidate library paths to try."""
        here = Path(__file__).resolve().parent
        cwd = Path.cwd()

        base_dirs = [
            # Desktop Agent: resources/mining/ folder (PRIORITY for packaged app)
            here / "mining",
            # Most common when running from repo root
            cwd / "zion" / "mining",
            cwd / "ai" / "mining",
            # Robust when running from elsewhere
            here / "zion" / "mining",
            here / "ai" / "mining",
            # Legacy relative fallback
            cwd / Path("zion") / "mining",
        ]

        out: List[str] = []
        for base in base_dirs:
            for n in names:
                out.append(str(base / n))
        return out

    @staticmethod
    def _try_load_one(lib_path: str) -> Optional[ctypes.CDLL]:
        try:
            if not os.path.exists(lib_path):
                return None
            return ctypes.CDLL(lib_path)
        except OSError as e:
            logger.warning(f"⚠️  Failed to load native lib {lib_path}: {e}")
            return None
        
    def load_cosmic_harmony(self) -> Optional[ctypes.CDLL]:
        """Load Cosmic Harmony DLL
        
        NOTE (2025-01): The C++ Cosmic Harmony library becomes NON-THREAD-SAFE
        after calling cosmic_harmony_initialize(). Since initialize() is REQUIRED
        for hash compatibility with the pool, and we need multi-threading for
        performance, we SKIP the C++ library entirely and use Python fallback.
        
        The Python wrapper (CosmicHarmonyHasher) handles initialize internally
        and is thread-safe because each hash call is independent.
        """
        # DISABLED: C++ library not thread-safe after initialize()
        # See: https://github.com/zion-terranova/Zion/issues/XXX
        logger.info("⚠️  C++ Cosmic Harmony disabled (not thread-safe after initialize)")
        logger.info("📚 Falling back to Python wrapper for Cosmic Harmony")
        return None
        
        # Original code disabled due to thread-safety issue:
        try:
            system = platform.system()

            # IMPORTANT: Use the SAME library as pool to ensure hash compatibility!
            # Pool uses libcosmic_harmony.so.2.9.0 (Linux) or libcosmicharmony.dylib (macOS)
            # The libcosmic_harmony_zion.* libraries have INCOMPATIBLE hash implementation!
            if system == "Windows":
                candidates = self._candidate_library_paths(
                    "libcosmic_harmony.dll",        # Pool-compatible (priority)
                    "libcosmicharmony.dll",         # Pool-compatible (alt name)
                    "cosmic_harmony.dll",           # Pool-compatible (alt name)
                    "libcosmic_harmony_zion.dll",   # Legacy (incompatible with pool!)
                )
            elif system == "Linux":
                candidates = self._candidate_library_paths(
                    "libcosmic_harmony.so.2.9.0",   # Pool-compatible (priority)
                    "libcosmic_harmony.so",         # Pool-compatible (alt)
                    "libcosmicharmony.so",          # Pool-compatible (alt name)
                    "libcosmic_harmony_zion.so.2.9.0",  # Legacy (incompatible with pool!)
                    "libcosmic_harmony_zion.so",    # Legacy (incompatible with pool!)
                )
            elif system == "Darwin":
                candidates = self._candidate_library_paths(
                    "libcosmic_harmony.dylib",      # Pool-compatible (priority)
                    "libcosmicharmony.dylib",       # Pool-compatible (alt name)
                    "libcosmic_harmony_zion.dylib", # Legacy (incompatible with pool!)
                )
            else:
                candidates = self._candidate_library_paths(
                    "libcosmic_harmony.so.2.9.0",   # Pool-compatible (priority)
                    "libcosmic_harmony.dylib",      # Pool-compatible (macOS)
                    "libcosmicharmony.dylib",       # Pool-compatible (alt name)
                    "libcosmic_harmony_zion.dll",   # Legacy (incompatible!)
                    "libcosmic_harmony_zion.so.2.9.0",
                    "libcosmic_harmony_zion.dylib",
                )

            lib = None
            tried = []
            for p in candidates:
                tried.append(p)
                lib = self._try_load_one(p)
                if lib is not None:
                    logger.info(f"✅ Cosmic Harmony library loaded: {p}")
                    break

            if lib is None:
                logger.error("❌ Cosmic Harmony library not found. Tried:\n" + "\n".join(tried))
                return None

            lib.cosmic_hash.argtypes = [
                ctypes.POINTER(ctypes.c_uint8),
                ctypes.c_size_t,
                ctypes.c_uint32,
                ctypes.POINTER(ctypes.c_uint8),
            ]
            lib.cosmic_hash.restype = None

            # CRITICAL: Call cosmic_harmony_initialize() to set up internal state!
            # Without this, the hash output is different from pool validation!
            if hasattr(lib, 'cosmic_harmony_initialize'):
                lib.cosmic_harmony_initialize.argtypes = []
                lib.cosmic_harmony_initialize.restype = ctypes.c_bool
                init_ok = lib.cosmic_harmony_initialize()
                if init_ok:
                    logger.info("✅ Cosmic Harmony initialized successfully")
                else:
                    logger.warning("⚠️ cosmic_harmony_initialize() returned False")

            self.libs['cosmic_harmony'] = lib
            return lib
        except Exception as e:
            logger.error(f"❌ Failed to load Cosmic Harmony: {e}")
            return None
    
    def load_randomx(self) -> Optional[ctypes.CDLL]:
        """Load RandomX DLL"""
        try:
            system = platform.system()

            # Prefer ZION wrapper library names (what this miner expects: zion_randomx_* symbols).
            if system == "Windows":
                candidates = self._candidate_library_paths(
                    "librandomx_zion.dll",
                )
            elif system == "Linux":
                candidates = self._candidate_library_paths(
                    "librandomx_zion.so.2.9.0",
                    "librandomx_zion.so",
                    # legacy / system fallback (unlikely to have zion_* symbols)
                    "librandomx.so",
                )
            elif system == "Darwin":
                candidates = self._candidate_library_paths(
                    "librandomx_zion.dylib",
                    "librandomx_zion.so",
                    # legacy fallback name used previously
                    "librandomx.dylib",
                )
            else:
                candidates = self._candidate_library_paths(
                    "librandomx_zion.dll",
                    "librandomx_zion.so.2.9.0",
                    "librandomx_zion.so",
                    "librandomx_zion.dylib",
                )

            lib = None
            tried = []
            for p in candidates:
                tried.append(p)
                lib = self._try_load_one(p)
                if lib is not None:
                    logger.info(f"✅ RandomX library loaded: {p}")
                    break

            if lib is None:
                logger.error("❌ RandomX library not found. Tried:\n" + "\n".join(tried))
                return None
            
            lib.zion_randomx_init.argtypes = [ctypes.c_char_p, ctypes.c_int]
            lib.zion_randomx_init.restype = ctypes.c_int
            
            lib.zion_randomx_hash_bytes.argtypes = [
                ctypes.POINTER(ctypes.c_uint8),
                ctypes.c_size_t,
                ctypes.POINTER(ctypes.c_uint8)
            ]
            lib.zion_randomx_hash_bytes.restype = None

            # Per-VM entrypoint: lets us pin each Python worker thread to a VM index.
            lib.zion_randomx_hash_bytes_vm.argtypes = [
                ctypes.c_int,
                ctypes.POINTER(ctypes.c_uint8),
                ctypes.c_size_t,
                ctypes.POINTER(ctypes.c_uint8),
            ]
            lib.zion_randomx_hash_bytes_vm.restype = None

            lib.zion_randomx_get_num_threads.argtypes = []
            lib.zion_randomx_get_num_threads.restype = ctypes.c_int
            
            lib.zion_randomx_cleanup.argtypes = []
            lib.zion_randomx_cleanup.restype = None
            
            self.libs['randomx'] = lib
            return lib
        except Exception as e:
            logger.error(f"❌ Failed to load RandomX: {e}")
            return None
    
    def load_yescrypt(self) -> Optional[ctypes.CDLL]:
        """Load Yescrypt DLL"""
        try:
            system = platform.system()

            # Prefer ZION wrapper library names (what this miner expects: yescrypt_* symbols).
            if system == "Windows":
                candidates = self._candidate_library_paths(
                    "libyescrypt_zion.dll",
                )
            elif system == "Linux":
                candidates = self._candidate_library_paths(
                    "libyescrypt_zion.so.2.9.0",
                    "libyescrypt_zion.so",
                    # legacy / system fallback (unlikely to have yescrypt_* symbols)
                    "libyescrypt.so",
                )
            elif system == "Darwin":
                candidates = self._candidate_library_paths(
                    "libyescrypt_zion.dylib",
                    "libyescrypt_zion.so",
                    # legacy fallback name
                    "libyescrypt.dylib",
                )
            else:
                candidates = self._candidate_library_paths(
                    "libyescrypt_zion.dll",
                    "libyescrypt_zion.so.2.9.0",
                    "libyescrypt_zion.so",
                    "libyescrypt_zion.dylib",
                )

            lib = None
            tried = []
            for p in candidates:
                tried.append(p)
                lib = self._try_load_one(p)
                if lib is not None:
                    logger.info(f"✅ Yescrypt library loaded: {p}")
                    break

            if lib is None:
                logger.error("❌ Yescrypt library not found. Tried:\n" + "\n".join(tried))
                return None

            lib.yescrypt_init_mining.argtypes = [ctypes.c_int]
            lib.yescrypt_init_mining.restype = ctypes.c_int

            lib.yescrypt_hash_bytes.argtypes = [
                ctypes.POINTER(ctypes.c_uint8),
                ctypes.c_size_t,
                ctypes.POINTER(ctypes.c_uint8),
            ]
            lib.yescrypt_hash_bytes.restype = ctypes.c_int

            lib.yescrypt_cleanup.argtypes = []
            lib.yescrypt_cleanup.restype = None

            self.libs['yescrypt'] = lib
            return lib
        except Exception as e:
            logger.error(f"❌ Failed to load Yescrypt: {e}")
            return None


class CPUMiningThread:
    """Multi-threaded CPU mining worker"""
    
    def __init__(self, thread_id: int, lib, algorithm: Algorithm):
        self.thread_id = thread_id
        self.lib = lib
        self.algorithm = algorithm
        self.hashes = 0
        self.running = False
    
    def hash_range(self, data: bytes, nonce_start: int, nonce_count: int) -> List[bytes]:
        """Hash a range of nonces"""
        results = []
        
        if self.algorithm == Algorithm.COSMIC_HARMONY:
            input_array = (ctypes.c_uint8 * len(data)).from_buffer_copy(data)
            output_array = (ctypes.c_uint8 * 32)()
            
            for i in range(nonce_count):
                self.lib.cosmic_hash(input_array, len(data), nonce_start + i, output_array)
                results.append(bytes(output_array))
                self.hashes += 1
        
        elif self.algorithm == Algorithm.RANDOMX:
            input_array = (ctypes.c_uint8 * len(data)).from_buffer_copy(data)
            output_array = (ctypes.c_uint8 * 32)()
            
            for i in range(nonce_count):
                self.lib.zion_randomx_hash_bytes(input_array, len(data), output_array)
                results.append(bytes(output_array))
                self.hashes += 1
        
        elif self.algorithm == Algorithm.YESCRYPT:
            input_array = (ctypes.c_uint8 * len(data)).from_buffer_copy(data)
            output_array = (ctypes.c_uint8 * 32)()

            for i in range(nonce_count):
                rc = self.lib.yescrypt_hash_bytes(input_array, len(data), output_array)
                if rc != 0:
                    # Keep behavior simple: skip failed hashes.
                    continue
                results.append(bytes(output_array))
                self.hashes += 1
        
        return results

    def hash_count_range(self, data: bytes, nonce_start: int, nonce_count: int) -> int:
        """Hash a range of nonces but do not allocate/store results (faster for benchmarking)."""
        if nonce_count <= 0:
            return 0

        if self.algorithm == Algorithm.COSMIC_HARMONY:
            input_array = (ctypes.c_uint8 * len(data)).from_buffer_copy(data)
            output_array = (ctypes.c_uint8 * 32)()
            for i in range(nonce_count):
                self.lib.cosmic_hash(input_array, len(data), nonce_start + i, output_array)
                self.hashes += 1
            return nonce_count

        if self.algorithm == Algorithm.RANDOMX:
            input_array = (ctypes.c_uint8 * len(data)).from_buffer_copy(data)
            output_array = (ctypes.c_uint8 * 32)()
            for _ in range(nonce_count):
                self.lib.zion_randomx_hash_bytes(input_array, len(data), output_array)
                self.hashes += 1
            return nonce_count

        if self.algorithm == Algorithm.YESCRYPT:
            input_array = (ctypes.c_uint8 * len(data)).from_buffer_copy(data)
            output_array = (ctypes.c_uint8 * 32)()
            done = 0
            for _ in range(nonce_count):
                rc = self.lib.yescrypt_hash_bytes(input_array, len(data), output_array)
                if rc != 0:
                    continue
                self.hashes += 1
                done += 1
            return done

        return 0


class CPUMiningThreadWrapper:
    """Multi-threaded CPU mining worker using wrapper (fallback for missing libraries)"""
    
    def __init__(self, thread_id: int, hasher, algorithm: Algorithm):
        self.thread_id = thread_id
        self.hasher = hasher
        self.algorithm = algorithm
        self.hashes = 0
        self.running = False
        # Job parameters for Cosmic Harmony v2
        self._current_block_height = 0
        self._current_prev_hash = b'\x00' * 32
    
    def update_job_params(self, block_height: int = 0, prev_hash: bytes = None):
        """Update job parameters for dynamic algorithms like Cosmic Harmony v2"""
        self._current_block_height = block_height
        self._current_prev_hash = prev_hash or (b'\x00' * 32)
    
    def hash_range(self, data: bytes, nonce_start: int, nonce_count: int) -> List[bytes]:
        """Hash a range of nonces using wrapper"""
        results = []
        
        if self.algorithm == Algorithm.COSMIC_HARMONY:
            for i in range(nonce_count):
                result = self.hasher.hash(data, nonce_start + i)
                results.append(result)
                self.hashes += 1
        
        elif self.algorithm == Algorithm.COSMIC_HARMONY_V2:
            # Cosmic Harmony v2 uses direct function call (no hasher object needed)
            for i in range(nonce_count):
                # Get current block parameters (these are updated by the miner)
                block_height = getattr(self, '_current_block_height', 0)
                prev_hash = getattr(self, '_current_prev_hash', b'\x00' * 32)
                result = cosmic_hash_v2(data, nonce_start + i, prev_hash, block_height)
                results.append(result)
                self.hashes += 1
        
        elif self.algorithm == Algorithm.COSMIC_HARMONY_V3:
            # Cosmic Harmony v3 - use native Rust library (batch mode)
            if COSMIC_V3_AVAILABLE and _cosmic_v3_native:
                results = _cosmic_v3_native.batch_hash(data, nonce_start, nonce_count)
                self.hashes += nonce_count
            else:
                # Fallback to single hash mode
                for i in range(nonce_count):
                    result = _cosmic_v3_native.hash(data, nonce_start + i) if _cosmic_v3_native else b'\x00' * 32
                    results.append(result)
                    self.hashes += 1
        
        # For other algorithms, we still need libraries, so this is Cosmic Harmony only for now
        return results

    def hash_count_range(self, data: bytes, nonce_start: int, nonce_count: int) -> int:
        """Hash a range of nonces but do not allocate/store results (faster for benchmarking)."""
        if nonce_count <= 0:
            return 0
        
        hashes_computed = 0
        
        if self.algorithm == Algorithm.COSMIC_HARMONY:
            for i in range(nonce_count):
                _ = self.hasher.hash(data, nonce_start + i)
                hashes_computed += 1
                
        elif self.algorithm == Algorithm.COSMIC_HARMONY_V2:
            # Cosmic Harmony v2 direct call
            for i in range(nonce_count):
                block_height = getattr(self, '_current_block_height', 0)
                prev_hash = getattr(self, '_current_prev_hash', b'\x00' * 32)
                _ = cosmic_hash_v2(data, nonce_start + i, prev_hash, block_height)
                hashes_computed += 1
        
        elif self.algorithm == Algorithm.COSMIC_HARMONY_V3:
            # Cosmic Harmony v3 - batch mode is most efficient
            if COSMIC_V3_AVAILABLE and _cosmic_v3_native:
                _ = _cosmic_v3_native.batch_hash(data, nonce_start, nonce_count)
                hashes_computed = nonce_count
            else:
                for i in range(nonce_count):
                    _ = _cosmic_v3_native.hash(data, nonce_start + i) if _cosmic_v3_native else None
                    hashes_computed += 1
                
        # Update total hash counter
        self.hashes += hashes_computed
        return hashes_computed


class GPUMiner:
    """GPU Mining using OpenCL - Optimized"""
    
    COSMIC_HARMONY_KERNEL = """
#define ROTL(x, n) (((x) << (n)) | ((x) >> (32 - (n))))

uint mix(uint a, uint b, uint c) {
    return ROTL(a ^ b, 5) + c;
}

kernel void cosmic_harmony_mine(
    global uint *header_data,
    uint header_size,
    uint nonce_start,
    uint nonce_range,
    global uchar *hash_output
)
{
    size_t gid = get_global_id(0);
    if (gid >= nonce_range) return;
    
    uint nonce = nonce_start + gid;
    uint state[8] = {
        0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
        0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
    };
    
    for (uint i = 0; i < min(header_size/4, 8u); i++) {
        state[i] ^= header_data[i];
    }
    state[0] ^= nonce;
    state[1] ^= (nonce >> 16);
    
    for (uint round = 0; round < 12; round++) {
        for (uint i = 0; i < 8; i++) {
            state[i] = mix(state[i], state[(i+1)%8], state[(i+2)%8]);
        }
        for (uint i = 0; i < 4; i++) {
            uint tmp = state[i];
            state[i] = state[i+4];
            state[i+4] = tmp;
        }
    }
    
    uint xor_mix = 0;
    for (uint i = 0; i < 8; i++) xor_mix ^= state[i];
    for (uint i = 0; i < 8; i++) state[i] ^= xor_mix;
    
    const uint PHI = 0x9E3779B9;
    for (uint i = 0; i < 8; i++) state[i] *= PHI;
    
    global uint *out = (global uint*)(hash_output + gid * 32);
    for (uint i = 0; i < 8; i++) out[i] = state[i];
}
"""
    
    def __init__(self, work_size: int = 256):
        if not GPU_AVAILABLE:
            raise RuntimeError("PyOpenCL not available")
        
        platforms = cl.get_platforms()
        if not platforms:
            raise RuntimeError("No OpenCL platforms found")
        
        self.platform = platforms[0]
        devices = self.platform.get_devices()
        if not devices:
            raise RuntimeError("No OpenCL devices found")
        
        self.device = devices[0]
        self.ctx = cl.Context([self.device])
        # Enable profiling so we can verify real GPU kernel execution times.
        self.queue = cl.CommandQueue(
            self.ctx,
            properties=cl.command_queue_properties.PROFILING_ENABLE,
        )
        self.work_size = work_size

        self.last_kernel_ms: float = 0.0
        self.avg_kernel_ms: float = 0.0
        self._kernel_samples: int = 0
        self.last_global_size: int = 0
        
        # Build kernel with optimizations
        build_opts = ["-cl-fast-relaxed-math", "-cl-mad-enable"]
        program = cl.Program(self.ctx, self.COSMIC_HARMONY_KERNEL).build(options=" ".join(build_opts))
        self.kernel = program.cosmic_harmony_mine
        
        # Get optimal work group size
        max_wg_size = self.kernel.get_work_group_info(
            cl.kernel_work_group_info.WORK_GROUP_SIZE, self.device
        )
        self.work_size = min(self.work_size, max_wg_size)
        
        logger.info(f"✅ GPU initialized: {self.device.name}")
        logger.info(f"   Work group size: {self.work_size}")
    
    def hash_batch(self, header: bytes, nonce_start: int, batch_size: int) -> np.ndarray:
        """Mine a batch of hashes on GPU - Optimized with proper work group sizing"""
        header_uint = np.frombuffer(header, dtype=np.uint32)
        
        mf = cl.mem_flags
        d_header = cl.Buffer(self.ctx, mf.READ_ONLY | mf.COPY_HOST_PTR, hostbuf=header_uint)
        d_output = cl.Buffer(self.ctx, mf.WRITE_ONLY, size=32 * batch_size)
        
        # Round up global size to nearest multiple of local work size
        global_size = batch_size
        if batch_size % self.work_size != 0:
            global_size = ((batch_size // self.work_size) + 1) * self.work_size
        
        global_size = (global_size,)
        local_size = (self.work_size,)
        
        evt = self.kernel(
            self.queue,
            global_size,
            local_size,
            d_header,
            np.uint32(len(header)),
            np.uint32(nonce_start),
            np.uint32(batch_size),
            d_output,
        )

        # Ensure completion and record real GPU timing (ns -> ms).
        try:
            evt.wait()
            start_ns = getattr(evt.profile, "start", 0)
            end_ns = getattr(evt.profile, "end", 0)
            if end_ns and start_ns and end_ns >= start_ns:
                ms = (end_ns - start_ns) / 1_000_000.0
                self.last_kernel_ms = float(ms)
                self.last_global_size = int(global_size[0])
                self._kernel_samples += 1
                # EWMA-ish running average without storing history
                if self._kernel_samples == 1:
                    self.avg_kernel_ms = self.last_kernel_ms
                else:
                    self.avg_kernel_ms = (self.avg_kernel_ms * 0.9) + (self.last_kernel_ms * 0.1)
        except Exception:
            # Profiling may not be available on some drivers; keep mining.
            pass

        self.queue.finish()
        
        output = np.empty(32 * batch_size, dtype=np.uint8)
        cl.enqueue_copy(self.queue, output, d_output)
        
        return output


class ZionNativeMiner:
    """
    ZION Native Miner v2.9.0
    
    Unified mining client with native library support
    """
    
    def __init__(self, config: MinerConfig):
        self.config = config
        self.running = False
        self.total_hashes = 0
        self.shares_found = 0
        self.start_time = 0
        
        # Load native libraries
        self.loader = NativeLibraryLoader()
        self.gpu_miner = None
        self.cpu_threads = []
        self.thread_pool = None

        # Diagnostics for GPU initialization (useful when running in AUTO).
        self._gpu_init_error: Optional[str] = None
        
        # Performance stats
        self.hashrate_samples = deque(maxlen=600)  # (t, hashes) ~ last minute at 0.1s-1s sampling
        self.last_hashrate_update = 0
        
        # Initialize algorithm
        self._initialize_algorithm()

    @staticmethod
    def _enable_ansi_console() -> None:
        """Best-effort enable ANSI escape codes on Windows terminals."""
        if os.name != "nt":
            return
        try:
            import ctypes

            kernel32 = ctypes.windll.kernel32
            h = kernel32.GetStdHandle(-11)  # STD_OUTPUT_HANDLE
            mode = ctypes.c_uint32()
            if kernel32.GetConsoleMode(h, ctypes.byref(mode)) == 0:
                return
            # ENABLE_VIRTUAL_TERMINAL_PROCESSING = 0x0004
            new_mode = mode.value | 0x0004
            kernel32.SetConsoleMode(h, new_mode)
        except Exception:
            return
    
    def _initialize_algorithm(self):
        """Initialize selected algorithm"""
        algo = self.config.algorithm
        
        if algo == Algorithm.COSMIC_HARMONY:
            # Dual-capable init: if GPU is available we still try to init it,
            # but we also initialize CPU (if the DLL is present) so CPU+GPU
            # can run concurrently.

            self._gpu_init_error = None
            want_gpu = (self.config.mode in [MiningMode.GPU, MiningMode.AUTO]) and GPU_AVAILABLE
            if want_gpu:
                try:
                    self.gpu_miner = GPUMiner(work_size=self.config.gpu_work_size)
                    logger.info("✅ GPU initialized for Cosmic Harmony")
                except Exception as e:
                    self.gpu_miner = None
                    self._gpu_init_error = str(e)
                    logger.warning(f"GPU init failed: {e}")

            # CPU init (best-effort). If the DLL is missing and we're in GPU
            # mode, we can still mine on GPU only.
            logger.info(f"🔍 COSMIC_WRAPPER_AVAILABLE: {COSMIC_WRAPPER_AVAILABLE}")
            lib = self.loader.load_cosmic_harmony()
            if lib:
                self.thread_pool = ThreadPoolExecutor(max_workers=self.config.cpu_threads)
                for i in range(self.config.cpu_threads):
                    thread = CPUMiningThread(i, lib, algo)
                    self.cpu_threads.append(thread)
                logger.info(f"✅ CPU initialized for Cosmic Harmony ({self.config.cpu_threads} threads)")
            elif COSMIC_WRAPPER_AVAILABLE:
                # Use Python wrapper with C++ library for correct hashes
                # NOTE: C++ library becomes non-thread-safe after initialize()
                # so we MUST use single-threaded mode for Cosmic Harmony CPU mining
                logger.info("📚 Cosmic Harmony: Using wrapper with C++ library (single-threaded)")
                self.cosmic_hasher = CosmicHarmonyHasher(use_cpp=True)  # C++ for correct hash!
                
                # Force single thread due to C++ thread-safety issue after initialize()
                effective_threads = 1
                logger.warning(f"⚠️  Cosmic Harmony C++ limited to 1 thread (thread-safety limitation)")
                
                self.thread_pool = ThreadPoolExecutor(max_workers=effective_threads)
                for i in range(effective_threads):
                    thread = CPUMiningThreadWrapper(i, self.cosmic_hasher, algo)
                    self.cpu_threads.append(thread)
                logger.info(f"✅ CPU initialized for Cosmic Harmony using C++ wrapper ({effective_threads} thread)")
            else:
                logger.error(f"❌ COSMIC_WRAPPER_AVAILABLE is False, GPU_AVAILABLE: {GPU_AVAILABLE}, gpu_miner: {self.gpu_miner}")
                if not self.gpu_miner:
                    raise RuntimeError("Failed to load Cosmic Harmony library, wrapper not available, and GPU init unavailable")
                logger.warning("⚠️  Cosmic Harmony CPU library and wrapper not available; running GPU-only")

            if self.gpu_miner and self.cpu_threads:
                logger.info("✅ Dual mining ready (CPU+GPU)")
            elif self.gpu_miner:
                logger.info("✅ Using GPU mining for Cosmic Harmony")
            else:
                logger.info(f"✅ Using CPU mining for Cosmic Harmony ({self.config.cpu_threads} threads)")
        
        elif algo == Algorithm.COSMIC_HARMONY_V2:
            # Cosmic Harmony v2: Quantum-resistant, memory-hard (CPU-only for now)
            if not COSMIC_V2_WRAPPER_AVAILABLE:
                raise RuntimeError("Cosmic Harmony v2 wrapper not available - quantum-resistant mining disabled")
            
            # Initialize CPU threads for memory-hard mining
            self.thread_pool = ThreadPoolExecutor(max_workers=self.config.cpu_threads)
            for i in range(self.config.cpu_threads):
                # Use wrapper for Cosmic Harmony v2 (no native lib needed)
                thread = CPUMiningThreadWrapper(i, None, algo)  # hasher will be set in hash_single_cpu
                self.cpu_threads.append(thread)
            
            # Initialize Cosmic Harmony v2 parameters
            self._current_block_height = 0
            self._current_prev_hash = b'\x00' * 32
            
            logger.info(f"🛡️ Cosmic Harmony v2 initialized (quantum-resistant, memory-hard)")
            logger.info(f"✅ CPU mining ready ({self.config.cpu_threads} threads)")
            logger.info("⚠️  GPU mining not yet supported for Cosmic Harmony v2")
        
        elif algo == Algorithm.COSMIC_HARMONY_V3:
            # Cosmic Harmony v3: Native Rust + GPU (21+ MH/s)
            self._gpu_init_error = None
            
            # Try GPU first (21+ MH/s on Apple M1)
            want_gpu = (self.config.mode in [MiningMode.GPU, MiningMode.AUTO]) and COSMIC_V3_GPU_AVAILABLE
            if want_gpu and _cosmic_v3_gpu:
                try:
                    self.gpu_miner = _cosmic_v3_gpu
                    logger.info(f"✅ Cosmic Harmony v3 GPU initialized: {_cosmic_v3_gpu.device_info}")
                except Exception as e:
                    self.gpu_miner = None
                    self._gpu_init_error = str(e)
                    logger.warning(f"CH v3 GPU init failed: {e}")
            
            # Initialize CPU using native Rust FFI (163 kH/s batch mode)
            if COSMIC_V3_AVAILABLE and _cosmic_v3_native:
                self.thread_pool = ThreadPoolExecutor(max_workers=self.config.cpu_threads)
                for i in range(self.config.cpu_threads):
                    thread = CPUMiningThreadWrapper(i, _cosmic_v3_native, algo)
                    self.cpu_threads.append(thread)
                logger.info(f"✅ Cosmic Harmony v3 CPU initialized ({self.config.cpu_threads} threads, Native Rust FFI)")
            else:
                if not self.gpu_miner:
                    raise RuntimeError("Cosmic Harmony v3 requires native library. Build with: cd 2.9.5/zion-cosmic-harmony-v3 && cargo build --release --features parallel")
                logger.warning("⚠️  CH v3 CPU not available; running GPU-only")
            
            if self.gpu_miner and self.cpu_threads:
                logger.info("🚀 Cosmic Harmony v3 DUAL mining ready (CPU + GPU)")
            elif self.gpu_miner:
                logger.info("🚀 Cosmic Harmony v3 GPU mining ready (21+ MH/s)")
            else:
                logger.info(f"✅ Cosmic Harmony v3 CPU mining ready ({self.config.cpu_threads} threads)")
        
        elif algo == Algorithm.RANDOMX:
            lib = self.loader.load_randomx()
            if not lib:
                raise RuntimeError("Failed to load RandomX library")
            
            # Initialize RandomX
            default_key = "00" * 32
            result = lib.zion_randomx_init(default_key.encode(), self.config.cpu_threads)
            if result != 1:
                raise RuntimeError("RandomX initialization failed")
            logger.info(f"✅ RandomX initialized with {self.config.cpu_threads} threads")
            
            # ✅ OPRAVA: Test že RandomX funguje správně
            test_data = b"test" * 20
            test_input = (ctypes.c_uint8 * len(test_data)).from_buffer_copy(test_data)
            test_output = (ctypes.c_uint8 * 32)()
            lib.zion_randomx_hash_bytes(test_input, len(test_data), test_output)
            test_hash = bytes(test_output).hex()
            logger.info(f"✅ RandomX test hash: {test_hash[:32]}...")
        
        elif algo == Algorithm.YESCRYPT:
            lib = self.loader.load_yescrypt()
            if not lib:
                raise RuntimeError("Failed to load Yescrypt library")
            
            # Initialize Yescrypt
            result = lib.yescrypt_init_mining(self.config.cpu_threads)
            if result != 0:
                raise RuntimeError("Yescrypt initialization failed")
            logger.info(f"✅ Yescrypt initialized with {self.config.cpu_threads} threads")
            
            # ✅ OPRAVA: Test že YesCrypt funguje správně
            test_data = b"test" * 20
            test_input = (ctypes.c_uint8 * len(test_data)).from_buffer_copy(test_data)
            test_output = (ctypes.c_uint8 * 32)()
            test_rc = lib.yescrypt_hash_bytes(test_input, len(test_data), test_output)
            if test_rc != 0:
                logger.warning(f"⚠️  YesCrypt test hash failed with rc={test_rc}")
            else:
                test_hash = bytes(test_output).hex()
                logger.info(f"✅ YesCrypt test hash: {test_hash[:32]}...")

    def switch_algorithm(self, new_algorithm: Algorithm):
        """Switch algorithm at runtime (reinitializes native libs + thread pools)."""
        if new_algorithm == self.config.algorithm:
            return

        old_algo = self.config.algorithm
        logger.info(f"🔁 Switching algorithm: {old_algo.value} -> {new_algorithm.value}")

        # Cleanup resources tied to the old algorithm.
        try:
            self.cleanup()
        except Exception as e:
            logger.warning(f"Cleanup before algorithm switch failed: {e}")

        # Reset and re-init.
        self.config.algorithm = new_algorithm
        self.loader = NativeLibraryLoader()
        self.gpu_miner = None
        self.cpu_threads = []
        self.thread_pool = None
        self.hashrate_samples.clear()
        self._initialize_algorithm()
    
    def hash_single_cpu(self, data: bytes, nonce: int) -> bytes:
        """Compute single hash on CPU"""
        algo = self.config.algorithm
        
        if algo == Algorithm.COSMIC_HARMONY:
            if not hasattr(self, "_hash_impl_logged"):
                self._hash_impl_logged = set()
            # Check if we have C++ library loaded
            if 'cosmic_harmony' in self.loader.libs:
                if "cosmic_harmony_cpp" not in self._hash_impl_logged:
                    logger.info("⚙️  Cosmic Harmony: using native C++ hasher")
                    self._hash_impl_logged.add("cosmic_harmony_cpp")
                lib = self.loader.libs['cosmic_harmony']
                input_array = (ctypes.c_uint8 * len(data)).from_buffer_copy(data)
                output_array = (ctypes.c_uint8 * 32)()
                lib.cosmic_hash(input_array, len(data), nonce, output_array)
                return bytes(output_array)
            # Check if we have Python wrapper
            elif hasattr(self, 'cosmic_hasher') and self.cosmic_hasher:
                if "cosmic_harmony_wrapper" not in self._hash_impl_logged:
                    # Log actual implementation being used
                    if self.cosmic_hasher.cpp_lib:
                        logger.info("⚙️  Cosmic Harmony: using wrapper (C++ library)")
                    else:
                        logger.info("⚙️  Cosmic Harmony: using wrapper (Python fallback)")
                    self._hash_impl_logged.add("cosmic_harmony_wrapper")
                return self.cosmic_hasher.hash(data, nonce)
            else:
                raise RuntimeError("No Cosmic Harmony implementation available")
        
        elif algo == Algorithm.COSMIC_HARMONY_V2:
            if not hasattr(self, "_hash_impl_logged"):
                self._hash_impl_logged = set()
            # Cosmic Harmony v2 uses unified hasher (auto-selects best backend)
            if COSMIC_V2_WRAPPER_AVAILABLE:
                if "cosmic_harmony_v2" not in self._hash_impl_logged:
                    if COSMIC_V2_GPU:
                        logger.info(f"⚙️  Cosmic Harmony v2: GPU ({COSMIC_V2_BACKEND}, ~15 kH/s)")
                    elif COSMIC_V2_NATIVE:
                        logger.info(f"⚙️  Cosmic Harmony v2: Native C ({COSMIC_V2_BACKEND}, ~350 H/s)")
                    elif COSMIC_V2_OPTIMIZED:
                        logger.info(f"⚙️  Cosmic Harmony v2: Numba JIT ({COSMIC_V2_BACKEND}, ~50 H/s)")
                    else:
                        logger.info(f"⚙️  Cosmic Harmony v2: Python ({COSMIC_V2_BACKEND}, ~0.1 H/s)")
                    self._hash_impl_logged.add("cosmic_harmony_v2")
                # Get block height from job state (default to 0 if not available)
                block_height = getattr(self, '_current_block_height', 0)
                # Get previous hash from job state (default to zeros)
                prev_hash = getattr(self, '_current_prev_hash', b'\x00' * 32)
                return cosmic_hash_v2(data, nonce, prev_hash, block_height)
            else:
                raise RuntimeError("Cosmic Harmony v2 wrapper not available")
        
        elif algo == Algorithm.COSMIC_HARMONY_V3:
            if not hasattr(self, "_hash_impl_logged"):
                self._hash_impl_logged = set()
            # Cosmic Harmony v3: Native Rust FFI (163 kH/s batch) or GPU (21+ MH/s)
            if COSMIC_V3_AVAILABLE and _cosmic_v3_native:
                if "cosmic_harmony_v3" not in self._hash_impl_logged:
                    logger.info("⚙️  Cosmic Harmony v3: Native Rust FFI (~163 kH/s batch)")
                    self._hash_impl_logged.add("cosmic_harmony_v3")
                return _cosmic_v3_native.hash(data, nonce)
            else:
                raise RuntimeError("Cosmic Harmony v3 native library not available. Build with: cd 2.9.5/zion-cosmic-harmony-v3 && cargo build --release --features parallel")
        
        elif algo == Algorithm.RANDOMX:
            lib = self.loader.libs['randomx']
            input_array = (ctypes.c_uint8 * len(data)).from_buffer_copy(data)
            output_array = (ctypes.c_uint8 * 32)()
            lib.zion_randomx_hash_bytes(input_array, len(data), output_array)
            return bytes(output_array)
        
        elif algo == Algorithm.YESCRYPT:
            lib = self.loader.libs['yescrypt']
            input_array = (ctypes.c_uint8 * len(data)).from_buffer_copy(data)
            output_array = (ctypes.c_uint8 * 32)()
            rc = lib.yescrypt_hash_bytes(input_array, len(data), output_array)
            if rc != 0:
                # Keep behavior simple: return a zero hash on failure.
                return b"\x00" * 32
            return bytes(output_array)
        
        return b'\x00' * 32
    
    def benchmark(self, duration: float = 5.0):
        """Run optimized benchmark with real-time stats"""
        print(f"\n[BENCHMARK] {self.config.algorithm.value}")
        print("="*60)
        
        # Check for Cosmic Harmony v1 TURBO GPU (8+ GH/s)
        cosmic_v1_turbo = None
        if self.config.algorithm == Algorithm.COSMIC_HARMONY and COSMIC_V1_TURBO:
            try:
                cosmic_v1_turbo = Cosmic_V1_Turbo_Miner(
                    batch_size=100_000_000,  # Auto-splits to optimal per buffer
                    num_buffers=2,
                    use_pinned_memory=True,
                    verbose=False
                )
                print(f"   Mode: GPU TURBO ({cosmic_v1_turbo.device_name})")
                print(f"   Batch: {cosmic_v1_turbo.batch_size:,} ({cosmic_v1_turbo.batch_size/1e6:.1f}M)")
                print(f"   Pipeline: {cosmic_v1_turbo.total_batch:,} ({cosmic_v1_turbo.total_batch/1e6:.1f}M)")
            except Exception as e:
                logger.warning(f"Could not init Cosmic V1 TURBO: {e}")
                cosmic_v1_turbo = None
        
        # Check for Cosmic Harmony v2 GPU VMEM support (40 kH/s)
        cosmic_v2_gpu = None
        if self.config.algorithm == Algorithm.COSMIC_HARMONY_V2 and COSMIC_V2_GPU:
            try:
                from mining.cosmic_harmony_v2_gpu_vmem import CosmicHarmonyV2GPUVMem, GPU_AVAILABLE as CV2_GPU_AVAIL
                if CV2_GPU_AVAIL:
                    cosmic_v2_gpu = CosmicHarmonyV2GPUVMem(
                        batch_size=0,  # Auto-detect max
                        use_pinned_memory=True,
                        double_buffer=True,
                        verbose=False
                    )
                    print(f"   Mode: GPU VMEM ({cosmic_v2_gpu.device_name})")
            except Exception as e:
                logger.warning(f"Could not init Cosmic V2 GPU: {e}")
                cosmic_v2_gpu = None
        
        if cosmic_v1_turbo is None and cosmic_v2_gpu is None:
            print(f"   Mode: {'GPU' if self.gpu_miner else f'CPU ({self.config.cpu_threads} threads)'}")
        print(f"   Duration: {duration}s")
        print()
        
        # Update job parameters for dynamic algorithms
        if self.cpu_threads:
            for thread in self.cpu_threads:
                if hasattr(thread, 'update_job_params'):
                    thread.update_job_params(block_height=12345, prev_hash=b'ZION_TEST_PREV_HASH' + b'\x00' * 13)
        
        test_data = b"ZION_TEST_BLOCK_" + b"0" * 64
        hashes = 0
        start = time.perf_counter()
        last_update = start
        
        # Cosmic Harmony v1 TURBO (8+ GH/s)
        if cosmic_v1_turbo is not None:
            print("   >>> Cosmic Harmony v1 TURBO GPU (86x optimized)...")
            hashrate = cosmic_v1_turbo.benchmark(duration)
            elapsed = duration
            hashes = int(hashrate * duration)
        
        # Cosmic Harmony v2 with GPU VMEM (40 kH/s)
        elif cosmic_v2_gpu is not None:
            print("   >>> Cosmic Harmony v2 GPU with virtual memory optimizations...")
            hashrate = cosmic_v2_gpu.benchmark(duration)
            elapsed = duration
            hashes = int(hashrate * duration)
        
        # Cosmic Harmony v3 GPU (21+ MH/s on Apple M1)
        elif self.config.algorithm == Algorithm.COSMIC_HARMONY_V3 and COSMIC_V3_GPU_AVAILABLE and self.gpu_miner:
            print(f"   >>> Cosmic Harmony v3 GPU ({getattr(self.gpu_miner, 'device_info', 'Unknown')})")
            print(f"   Pipeline: Keccak256 → SHA3-512 → GoldenMatrix → CosmicFusion")
            hashrate = self.gpu_miner.benchmark(duration)
            elapsed = duration
            hashes = int(hashrate * duration)
        
        elif self.gpu_miner:
            # GPU benchmark - optimized batch processing
            batch_size = self.config.gpu_batch_size
            nonce = 0
            iterations = 0
            
            while time.perf_counter() - start < duration:
                iter_start = time.perf_counter()
                self.gpu_miner.hash_batch(test_data, nonce, batch_size)
                iter_time = time.perf_counter() - iter_start
                
                hashes += batch_size
                nonce += batch_size
                iterations += 1
                
                # Real-time stats every second
                now = time.perf_counter()
                if now - last_update >= 1.0:
                    elapsed = now - start
                    current_hr = hashes / elapsed
                    print(f"   [{elapsed:.1f}s] {current_hr/1000000:.2f} MH/s | {hashes/1000000:.2f}M hashes | {iter_time*1000:.1f}ms/batch")
                    last_update = now
        else:
            # CPU benchmark - optimized for different algorithms
            if self.cpu_threads:
                if self.config.algorithm == Algorithm.COSMIC_HARMONY_V2:
                    # Special handling for memory-hard algorithms - SEQUENTIAL processing
                    # Memory pooling in optimized version avoids thrashing
                    if COSMIC_V2_OPTIMIZED:
                        print("   ✅ Memory-hard algorithm (OPTIMIZED with Numba JIT)")
                        print(f"   Expected performance: ~100 H/s (Numba JIT + memory pooling)")
                    else:
                        print("   ⚠️  Memory-hard algorithm (original version)")
                        print(f"   Expected performance: ~0.25 H/s (memory-hard by design)")
                    print("   Using sequential hashing for accurate benchmark...")
                    
                    # Use single-threaded sequential hashing for accurate benchmark
                    prev_hash = getattr(self, '_current_prev_hash', b'\x00' * 32)
                    block_height = getattr(self, '_current_block_height', 0)
                    nonce = 0
                    
                    while time.perf_counter() - start < duration:
                        iter_start = time.perf_counter()
                        
                        # Single hash computation
                        try:
                            _ = cosmic_hash_v2(test_data, nonce, prev_hash, block_height)
                            hashes += 1
                            nonce += 1
                        except Exception as e:
                            print(f"   Hash error: {e}")
                            break
                        
                        iter_time = time.perf_counter() - iter_start
                        
                        # Real-time stats after each hash
                        now = time.perf_counter()
                        elapsed = now - start
                        if elapsed > 0 and hashes > 0:
                            current_hr = hashes / elapsed
                            print(f"   [{elapsed:.1f}s] {current_hr:.3f} H/s | {hashes:,} hashes | {iter_time:.2f}s/hash")
                        last_update = now
                        iter_time = time.perf_counter() - iter_start
                        
                        # Real-time stats
                        now = time.perf_counter()
                        elapsed = now - start
                        if elapsed > 0 and hashes > 0:
                            current_hr = hashes / elapsed
                            print(f"   [{elapsed:.1f}s] {current_hr:.2f} H/s | {hashes:,} hashes | {iter_time:.2f}s/batch")
                        else:
                            print(f"   [{elapsed:.1f}s] Computing... | {hashes:,} hashes | {iter_time:.2f}s/batch")
                        last_update = now
                else:
                    # Standard CPU benchmark for non-memory-hard algorithms
                    batch_per_thread = 1000
                    futures = []
                    nonce = 0
                    
                    while time.perf_counter() - start < duration:
                        # Submit work to all threads
                        for thread in self.cpu_threads:
                            work_fn = getattr(thread, "hash_count_range", None) or thread.hash_range
                            future = self.thread_pool.submit(
                                work_fn, test_data, nonce, batch_per_thread
                            )
                            futures.append(future)
                            nonce += batch_per_thread
                        
                        # Wait for completion
                        for future in as_completed(futures):
                            future.result()
                        
                        futures.clear()
                        
                        # Count hashes
                        hashes = sum(getattr(t, 'hashes', 0) for t in self.cpu_threads)
                    
                    # Real-time stats
                    now = time.perf_counter()
                    if now - last_update >= 1.0:
                        elapsed = now - start
                        current_hr = hashes / elapsed
                        print(f"   [{elapsed:.1f}s] {current_hr/1000:.2f} kH/s | {hashes:,} hashes")
                        last_update = now
            else:
                # Single-threaded fallback
                nonce = 0
                while time.perf_counter() - start < duration:
                    self.hash_single_cpu(test_data, nonce)
                    hashes += 1
                    nonce += 1
        
        elapsed = time.perf_counter() - start
        hashrate = hashes / elapsed if elapsed > 0 else 0
        
        print()
        print(f"[OK] Benchmark complete!")
        print(f"   Total hashes: {hashes:,}")
        print(f"   Time: {elapsed:.2f}s")
        print(f"   Hashrate: {hashrate:,.0f} H/s")
        if hashrate > 1000:
            print(f"   Hashrate: {hashrate/1000:,.2f} kH/s")
        if hashrate > 1000000:
            print(f"   Hashrate: {hashrate/1000000:,.2f} MH/s")
        if hashrate > 1000000000:
            print(f"   Hashrate: {hashrate/1000000000:,.3f} GH/s")
        
        # Performance metrics
        if self.gpu_miner and 'iterations' in dir() and iterations > 0:
            print(f"\n[GPU] Performance:")
            print(f"   Batch size: {self.config.gpu_batch_size:,}")
            print(f"   Work group size: {self.gpu_miner.work_size}")
            print(f"   Avg batch time: {elapsed/iterations*1000:.1f}ms")
        
        print()
    
    @staticmethod
    def _format_hashrate(hps: float) -> str:
        if hps >= 1_000_000:
            return f"{hps/1_000_000:.2f} MH/s"
        if hps >= 1_000:
            return f"{hps/1_000:.2f} kH/s"
        # Avoid misleading "0 H/s" for fractional rates (e.g. slow RandomX due to memory pressure).
        if hps < 10:
            return f"{hps:.2f} H/s"
        return f"{hps:,.0f} H/s"

    @staticmethod
    def _format_uptime(seconds: float) -> str:
        seconds = max(0, int(seconds))
        h = seconds // 3600
        m = (seconds % 3600) // 60
        s = seconds % 60
        return f"{h:02d}:{m:02d}:{s:02d}"

    @staticmethod
    def _format_last_error(err: Optional[str], max_len: int = 60) -> str:
        if not err:
            return ""
        one_line = " ".join(str(err).split())
        if len(one_line) <= max_len:
            return one_line
        return one_line[: max_len - 3] + "..."

    def _write_stats_file(self, payload: Dict[str, Any]):
        path = (self.config.stats_file or "").strip()
        if not path:
            return
        try:
            os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
            tmp_path = path + ".tmp"
            with open(tmp_path, "w", encoding="utf-8") as f:
                json.dump(payload, f, ensure_ascii=False, indent=2)
            os.replace(tmp_path, path)
        except Exception as e:
            logger.debug(f"Failed to write stats file '{path}': {e}")

    def mine_to_pool(self, duration: Optional[float] = None):
        """Mine to pool server"""
        print(f"\n⛏️  Mining to pool...")
        print(f"   Pool: {self.config.pool_host}:{self.config.pool_port}")
        print(f"   Wallet: {self.config.wallet_address}")
        print(f"   Algorithm: {self.config.algorithm.value}")
        if self.config.stats_interval:
            stats_path = self.config.stats_file or "(disabled)"
            print(f"   Stats: every {float(self.config.stats_interval):g}s -> {stats_path}")
        print("   Stop : Ctrl+C")
        print()

        algo_cycle = [Algorithm.COSMIC_HARMONY, Algorithm.RANDOMX, Algorithm.YESCRYPT]
        global_start = time.perf_counter()
        end_at = (global_start + duration) if duration else None

        # Persistent desired GPU state across reconnects/algo-switch.
        # In AUTO we start with GPU OFF; user can enable via hotkey 'g'.
        gpu_desired = (self.config.mode == MiningMode.GPU)

        total_cpu_hashes = 0
        total_gpu_hashes = 0
        total_shares_sent = 0
        total_shares_acc = 0
        total_shares_rej = 0

        def _connect_and_handshake() -> Optional[StratumClient]:
            def _new_client() -> StratumClient:
                return StratumClient(
                    self.config.pool_host,
                    self.config.pool_port,
                    worker_id=self.config.wallet_address or self.config.worker_name,
                )

            s = _new_client()
            if not s.connect():
                return None
            time.sleep(0.2)

            # Prefer XMRig login (reliably conveys algorithm via params.algo).
            login_ok = s.login(
                self.config.wallet_address or "test_wallet",
                self.config.worker_name,
                self.config.algorithm.value,
            )

            if not login_ok:
                logger.warning("⚠️ XMRig login handshake failed; retrying with Stratum subscribe/authorize on fresh connection")
                try:
                    s.disconnect()
                except Exception:
                    pass

                s = _new_client()
                if not s.connect():
                    return None
                time.sleep(0.2)

                if not s.subscribe():
                    try:
                        s.disconnect()
                    except Exception:
                        pass
                    return None
                time.sleep(0.2)
                if not s.authorize(
                    self.config.wallet_address or "test_wallet",
                    self.config.worker_name,
                    self.config.algorithm.value,
                ):
                    try:
                        s.disconnect()
                    except Exception:
                        pass
                    return None

            try:
                first_job_wait = float(str(os.getenv("ZION_STRATUM_FIRST_JOB_WAIT", "8")).strip())
                first_job_wait = max(3.0, min(30.0, first_job_wait))
            except Exception:
                first_job_wait = 8.0

            first_job_deadline = time.perf_counter() + first_job_wait
            while time.perf_counter() < first_job_deadline and not s.get_job():
                time.sleep(0.1)
            if not s.current_job:
                logger.error(f"❌ Handshake completed but no first job received within {first_job_wait:.1f}s")
                try:
                    s.disconnect()
                except Exception:
                    pass
                return None
            return s

        def _algo_supports_gpu() -> bool:
            # Cosmic Harmony v1 has OpenCL GPU path (COSMIC_AVAILABLE)
            # Cosmic Harmony v3 has native OpenCL GPU (COSMIC_V3_GPU_AVAILABLE)
            # Cosmic Harmony v2 is CPU-only (memory-hard, quantum-resistant)
            return self.config.algorithm in (Algorithm.COSMIC_HARMONY, Algorithm.COSMIC_HARMONY_V3)

        # UI
        ui_mode = (self.config.ui or "lines").strip().lower()
        if ui_mode == "xmrig":
            self._enable_ansi_console()

        def _clear_screen() -> None:
            if ui_mode != "xmrig":
                return
            # Clear + home
            sys.stdout.write("\x1b[2J\x1b[H")
            sys.stdout.flush()

        def _render_dashboard(
            *,
            uptime: str,
            pool_host: str,
            pool_port: int,
            wallet: str,
            worker: str,
            algo: str,
            gpu_state: str,
            cpu_hr: float,
            gpu_hr: float,
            total_hr: float,
            shares_sent: int,
            shares_acc: int,
            shares_rej: int,
            diff: Any,
            height: Any,
            job_id: Any,
            last_err: str,
            gpu_kernel_ms: Optional[float],
            gpu_global_size: Optional[int],
        ) -> None:
            if ui_mode != "xmrig":
                return
            _clear_screen()
            acc_rate = (shares_acc / shares_sent * 100.0) if shares_sent else 0.0
            gpu_perf = "-"
            if gpu_kernel_ms is not None and gpu_global_size:
                gpu_perf = f"{gpu_kernel_ms:.2f}ms/{gpu_global_size}"

            print("ZION Native Miner v2.9.0 | XMRig-style UI")
            print(f"Uptime  : {uptime} | Algo: {algo}")
            print(f"Pool    : {pool_host}:{pool_port} | Wallet: {wallet} | Worker: {worker}")
            print(f"Job     : {str(job_id)[:16] if job_id else '-'} | Height: {height} | Diff: {diff}")
            print("-")
            print(
                f"Hashrate: total {self._format_hashrate(total_hr)} | "
                f"cpu {self._format_hashrate(cpu_hr)} | gpu {self._format_hashrate(gpu_hr)} (GPU {gpu_state})"
            )
            print(
                f"Shares  : sent {shares_sent} | accepted {shares_acc} | rejected {shares_rej} | acc {acc_rate:.1f}%"
            )
            print(f"GPU     : {getattr(self.gpu_miner.device, 'name', '-') if self.gpu_miner is not None else '-'} | kernel {gpu_perf}")
            if last_err:
                print(f"Last err: {last_err}")
            else:
                print("Last err: -")
            print("-")
            print("Hotkeys : h=help | s=summary | p=pause | g=gpu on/off | r=reconnect | a=algo next | q=quit")

        # Restartable pool mining session loop (supports reconnect + algo switch).
        while True:
            now = time.perf_counter()
            if end_at and now >= end_at:
                break

            def _cpu_ready_for_algo() -> bool:
                if self.config.algorithm == Algorithm.COSMIC_HARMONY:
                    return bool(self.cpu_threads) and (self.thread_pool is not None)
                if self.config.algorithm == Algorithm.COSMIC_HARMONY_V2:
                    return bool(self.cpu_threads) and (self.thread_pool is not None) and COSMIC_V2_WRAPPER_AVAILABLE
                if self.config.algorithm == Algorithm.COSMIC_HARMONY_V3:
                    return bool(self.cpu_threads) and (self.thread_pool is not None) and COSMIC_V3_AVAILABLE
                if self.config.algorithm == Algorithm.RANDOMX:
                    return 'randomx' in self.loader.libs
                if self.config.algorithm == Algorithm.YESCRYPT:
                    return 'yescrypt' in self.loader.libs
                return True

            cpu_ready = _cpu_ready_for_algo()
            initial_gpu_ready = self.gpu_miner is not None
            if cpu_ready and initial_gpu_ready:
                print(f"   Mode: CPU+GPU (GPU toggle: press 'g')")
            elif initial_gpu_ready:
                print("   Mode: GPU")
            else:
                if cpu_ready:
                    print(f"   Mode: CPU ({self.config.cpu_threads} threads)")
                else:
                    print("   Mode: CPU (not ready)")
                if GPU_AVAILABLE and getattr(self, "_gpu_init_error", None):
                    print(f"   GPU init error: {self._gpu_init_error}")

            stratum = _connect_and_handshake()
            if not stratum:
                print("❌ Failed to connect/handshake with pool")
                return
            print("✅ Connected to pool successfully\n")

            hotkeys = HotkeyController()
            hotkeys.start()

            pause_event = threading.Event()  # set => paused
            stop_event = threading.Event()   # set => stop all workers
            gpu_enabled = threading.Event()  # set => GPU worker active

            gpu_init_lock = threading.Lock()

            def _gpu_ready_now() -> bool:
                return self.gpu_miner is not None

            def _ensure_gpu_initialized() -> bool:
                if self.gpu_miner is not None:
                    return True
                if not GPU_AVAILABLE:
                    return False
                if not _algo_supports_gpu():
                    return False
                with gpu_init_lock:
                    if self.gpu_miner is not None:
                        return True
                    try:
                        self._gpu_init_error = None
                        self.gpu_miner = GPUMiner(work_size=self.config.gpu_work_size)
                        logger.info("✅ GPU initialized (lazy)")
                        return True
                    except Exception as e:
                        self._gpu_init_error = str(e)
                        self.gpu_miner = None
                        return False

            # Apply desired GPU state at session start.
            if gpu_desired:
                if _ensure_gpu_initialized():
                    gpu_enabled.set()
                else:
                    gpu_enabled.clear()
                    gpu_desired = False
                    err = getattr(self, "_gpu_init_error", None)
                    if not GPU_AVAILABLE:
                        print("⚠️  GPU not available in this Python environment")
                    elif not _algo_supports_gpu():
                        print(f"⚠️  GPU not supported for algo {self.config.algorithm.value}")
                    elif err:
                        print(f"⚠️  GPU init failed: {err}")

            job_lock = threading.Lock()
            nonce_lock = threading.Lock()
            stats_lock = threading.Lock()
            job_state: Dict[str, Any] = {
                "job_id": None,
                "blob_hex": None,
                "blob_bytes": None,
                "difficulty": None,
                "height": None,
                "target_64": None,
                "target_256": None,
                "target_cosmic32": None,
                "version": 0,
            }
            nonce_cursor = 0

            cpu_hashes = 0
            gpu_hashes = 0
            chv3_gpu_verify_mismatches = 0

            def _alloc_nonces(count: int) -> int:
                nonlocal nonce_cursor
                with nonce_lock:
                    start = nonce_cursor
                    nonce_cursor += count
                    return start

            def _update_job_from_stratum(job: Dict[str, Any]):
                nonlocal nonce_cursor
                job_id = job.get("job_id")
                blob_hex = job.get("blob")
                # Pool difficulty is usually provided explicitly.
                # Some XMRig-style jobs (notably the login response) may omit
                # `difficulty` and provide only the 64-bit `target`.
                pool_difficulty_raw = job.get("difficulty")
                pool_target_raw = job.get("target")
                try:
                    pool_difficulty = int(pool_difficulty_raw or 0)
                except Exception:
                    pool_difficulty = 0

                if pool_difficulty <= 0 and pool_target_raw:
                    try:
                        target_hex = str(pool_target_raw)
                        # XMRig target is 8 bytes little-endian hex (16 chars).
                        if len(target_hex) == 16:
                            target_int = int.from_bytes(bytes.fromhex(target_hex), "little", signed=False)
                            if target_int > 0:
                                max_target_64 = (1 << 64) - 1
                                pool_difficulty = max(1, int(max_target_64 // target_int))
                    except Exception:
                        pool_difficulty = max(1, pool_difficulty)

                pool_difficulty = max(1, pool_difficulty)
                height = job.get("height")
                if not job_id or not blob_hex:
                    return
                try:
                    blob_bytes = bytes.fromhex(blob_hex)
                except Exception:
                    return

                # IMPORTANT: Miner must use the pool-assigned difficulty.
                # Local "clamping" makes submitted shares invalid (they won't meet the pool target)
                # which can lead to disconnects/bans (Broken pipe / connection refused).
                difficulty = max(1, pool_difficulty)

                if self.config.algorithm == Algorithm.RANDOMX:
                    # RandomX uses 64-bit target (XMRig style)
                    max_target_64 = 0xFFFFFFFFFFFFFFFF
                    target_64 = max_target_64 // difficulty
                    target_256 = None
                    target_cosmic32 = None
                else:
                    # YesCrypt + Cosmic Harmony use 256-bit target
                    max_target_256 = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF
                    target_256 = max_target_256 // difficulty
                    target_64 = None

                    # IMPORTANT: Pool-side Cosmic Harmony validation compares only the
                    # first 4 bytes (state0) against a 32-bit job target.
                    # Prefer explicit pool `target` if present; fallback to difficulty.
                    if self.config.algorithm in [Algorithm.COSMIC_HARMONY, Algorithm.COSMIC_HARMONY_V2, Algorithm.COSMIC_HARMONY_V3]:
                        target_cosmic32 = None
                        try:
                            if pool_target_raw:
                                target_hex = str(pool_target_raw).strip().lower()
                                if target_hex.startswith("0x"):
                                    target_hex = target_hex[2:]
                                if len(target_hex) >= 8:
                                    target_cosmic32 = int(target_hex[:8], 16)
                        except Exception:
                            target_cosmic32 = None

                        if target_cosmic32 is None:
                            target_cosmic32 = (target_256 >> 224) if target_256 is not None else None
                    else:
                        target_cosmic32 = None

                with job_lock:
                    if job_state.get("job_id") != job_id:
                        job_state["job_id"] = job_id
                        job_state["blob_hex"] = blob_hex
                        job_state["blob_bytes"] = blob_bytes
                        job_state["difficulty"] = difficulty
                        job_state["height"] = height
                        job_state["target_64"] = target_64
                        job_state["target_256"] = target_256
                        job_state["target_cosmic32"] = target_cosmic32
                        job_state["version"] = int(job_state.get("version") or 0) + 1
                        with nonce_lock:
                            nonce_cursor = 0
                        
                        # Update Cosmic Harmony v2 parameters
                        if self.config.algorithm == Algorithm.COSMIC_HARMONY_V2:
                            self._current_block_height = height or 0
                            # Derive prev_hash from blob (simplified - in real pool this would be provided)
                            self._current_prev_hash = blob_bytes[:32] if len(blob_bytes) >= 32 else b'\x00' * 32
                        
                        # � Výpis jobu a targetu
                        algo_name = self.config.algorithm.value
                        if self.config.algorithm in [Algorithm.COSMIC_HARMONY, Algorithm.COSMIC_HARMONY_V2, Algorithm.COSMIC_HARMONY_V3] and target_cosmic32 is not None:
                            logger.info(
                                f"🎯 [{algo_name}] target_cosmic32=0x{int(target_cosmic32):08x} (from diff={difficulty})"
                            )
                        if target_64 is not None:
                            # RandomX - vypočítej kolik hashů průměrně potřeba
                            expected_hashes = difficulty  # aproximace
                            logger.info(f"📋 [{algo_name}] Job {job_id[:12]}... h={height} diff={difficulty} (pool={pool_difficulty}) → ~{expected_hashes:,} hashů/share")
                        else:
                            expected_hashes = difficulty
                            logger.info(f"📋 [{algo_name}] Job {job_id[:12]}... h={height} diff={difficulty} (pool={pool_difficulty}) → ~{expected_hashes:,} hashů/share")

            def _snapshot_job() -> Optional[Dict[str, Any]]:
                with job_lock:
                    if not job_state.get("job_id") or not job_state.get("blob_bytes"):
                        return None
                    return dict(job_state)

            def _cpu_worker(worker_index: int):
                nonlocal cpu_hashes
                if not cpu_ready:
                    return
                last_flush_t = time.perf_counter()

                import struct
                import traceback

                # If the hashing backend throws (e.g., native FFI returns error code),
                # do not let the whole worker thread die. Log with a small rate-limit.
                last_err_t = 0.0
                err_count = 0

                rx_lib = self.loader.libs.get('randomx') if self.config.algorithm == Algorithm.RANDOMX else None
                yc_lib = self.loader.libs.get('yescrypt') if self.config.algorithm == Algorithm.YESCRYPT else None

                # Reusable per-thread buffers to avoid per-hash allocations.
                work_buf: Optional[bytearray] = None
                input_array = None
                output_array = (ctypes.c_uint8 * 32)()
                last_job_version = None

                while not stop_event.is_set():
                    if pause_event.is_set():
                        time.sleep(0.1)
                        continue
                    snap = _snapshot_job()
                    if not snap:
                        time.sleep(0.05)
                        continue

                    job_id = snap["job_id"]
                    blob_bytes = snap["blob_bytes"]
                    target_64 = snap["target_64"]
                    target_256 = snap["target_256"]
                    target_cosmic32 = snap.get("target_cosmic32")
                    version = snap["version"]

                    # Prepare per-job reusable input buffer.
                    # For non-Cosmic algos, nonce is at byte offset 38..41.
                    if last_job_version != version or work_buf is None:
                        if self.config.algorithm == Algorithm.COSMIC_HARMONY:
                            work_buf = None
                            input_array = None
                        else:
                            work_buf = bytearray(blob_bytes)
                            input_array = (ctypes.c_uint8 * len(work_buf)).from_buffer(work_buf)
                        last_job_version = version

                    batch = 1000
                    start = _alloc_nonces(batch)
                    processed_since_last_flush = 0
                    for i in range(batch):
                        if stop_event.is_set() or pause_event.is_set():
                            break
                        # Avoid lock contention in the hot path. A slightly stale job version
                        # check is acceptable; we re-check periodically.
                        if (i & 31) == 0:
                            if job_state.get("version") != version:
                                break

                        nonce = start + i
                        if self.config.algorithm in [Algorithm.COSMIC_HARMONY, Algorithm.COSMIC_HARMONY_V2, Algorithm.COSMIC_HARMONY_V3]:
                            try:
                                result_hash = self.hash_single_cpu(blob_bytes, nonce)
                            except Exception as e:
                                err_count += 1
                                now_err = time.perf_counter()
                                # Log at most once per ~2s per worker to avoid flooding.
                                if (now_err - last_err_t) >= 2.0:
                                    last_err_t = now_err
                                    try:
                                        logger.error(
                                            f"[CH3] CPU worker {worker_index} hash error: {e} "
                                            f"(blob_len={len(blob_bytes)} job={str(job_id)[:12]}… errors={err_count})"
                                        )
                                        logger.error(traceback.format_exc().strip())
                                    except Exception:
                                        pass
                                # Skip this nonce and continue mining.
                                continue
                        else:
                            assert work_buf is not None and input_array is not None
                            struct.pack_into("<I", work_buf, 38, nonce)
                            if rx_lib is not None:
                                # NOTE: zion_randomx_hash_bytes_vm is currently much slower on macOS;
                                # use the thread-local VM selection path.
                                rx_lib.zion_randomx_hash_bytes(input_array, len(work_buf), output_array)
                                # Avoid copying hash bytes unless we need to submit.
                                result_hash = None
                            elif yc_lib is not None:
                                rc = yc_lib.yescrypt_hash_bytes(input_array, len(work_buf), output_array)
                                if rc != 0:
                                    continue
                                result_hash = None
                            else:
                                # Fallback path: must materialize bytes.
                                result_hash = self.hash_single_cpu(bytes(work_buf), 0)

                        meets = False
                        if target_64 is not None:
                            # RandomX target check uses low 64 bits (little-endian)
                            # Pool-side validation uses FIRST 8 bytes (little-endian)
                            # (see src/pool/mining/share_validator.py).
                            hash_low64 = int.from_bytes(bytes(output_array[:8]), 'little')
                            meets = hash_low64 <= target_64
                            # 🔍 DEBUG: Každých 10000 hashů vypíšem info
                            if (i % 10000) == 0:
                                logger.debug(f"[RandomX] Worker {worker_index}: hash_low64={hash_low64:016x} target={target_64:016x} meets={meets}")
                        elif target_256 is not None:
                            if self.config.algorithm in [Algorithm.COSMIC_HARMONY, Algorithm.COSMIC_HARMONY_V2, Algorithm.COSMIC_HARMONY_V3] and target_cosmic32 is not None:
                                # Cosmic Harmony (pool-compat): state0 (first 4 bytes, LE) <= top32(target_256)
                                if result_hash is None:
                                    hb = bytes(output_array)
                                else:
                                    hb = result_hash
                                state0_le = int.from_bytes(hb[:4], 'little', signed=False)
                                state0_be = int.from_bytes(hb[:4], 'big', signed=False)
                                endian = getattr(stratum, "cosmic_state0_endian", "little")
                                state0 = state0_be if endian == "big" else state0_le
                                meets = state0 <= int(target_cosmic32)
                            else:
                                # YesCrypt + others: big-endian integer comparison
                                if result_hash is None:
                                    result_int = int.from_bytes(output_array, 'big')
                                else:
                                    result_int = int.from_bytes(result_hash, 'big')
                                meets = result_int < target_256

                        if meets:
                            if result_hash is None:
                                result_hash = bytes(output_array)
                            submit_meta = None
                            if self.config.algorithm in [Algorithm.COSMIC_HARMONY, Algorithm.COSMIC_HARMONY_V2, Algorithm.COSMIC_HARMONY_V3] and target_cosmic32 is not None:
                                hb = result_hash
                                state0_le_dbg = int.from_bytes(hb[:4], "little", signed=False)
                                state0_be_dbg = int.from_bytes(hb[:4], "big", signed=False)
                                endian_dbg = getattr(stratum, "cosmic_state0_endian", "little")
                                state0_dbg = state0_be_dbg if endian_dbg == "big" else state0_le_dbg
                                submit_meta = {
                                    "job_id": job_id,
                                    "nonce_hex": f"{nonce:08x}",
                                    "state0_hex": f"0x{state0_dbg:08x}",
                                    "state0_le": int(state0_le_dbg),
                                    "state0_be": int(state0_be_dbg),
                                    "state0_endian": endian_dbg,
                                    "target32_hex": f"0x{int(target_cosmic32):08x}",
                                    "target32": int(target_cosmic32),
                                }
                            stratum.submit_share(job_id, nonce, result_hash, meta=submit_meta)

                        processed_since_last_flush += 1

                        now_t = time.perf_counter()
                        if processed_since_last_flush >= 64 or (processed_since_last_flush > 0 and (now_t - last_flush_t) >= 1.0):
                            with stats_lock:
                                cpu_hashes += processed_since_last_flush
                            processed_since_last_flush = 0
                            last_flush_t = now_t

                    if processed_since_last_flush:
                        with stats_lock:
                            cpu_hashes += processed_since_last_flush
                        last_flush_t = time.perf_counter()

            def _gpu_worker():
                nonlocal gpu_hashes
                nonlocal chv3_gpu_verify_mismatches
                while not stop_event.is_set():
                    if not gpu_enabled.is_set() or pause_event.is_set():
                        time.sleep(0.1)
                        continue
                    if self.gpu_miner is None:
                        time.sleep(0.2)
                        continue
                    snap = _snapshot_job()
                    if not snap:
                        time.sleep(0.05)
                        continue

                    job_id = snap["job_id"]
                    blob_bytes = snap["blob_bytes"]
                    target_64 = snap["target_64"]
                    target_256 = snap["target_256"]
                    target_cosmic32 = snap.get("target_cosmic32")
                    version = snap["version"]

                    batch_size = min(int(self.config.gpu_batch_size), 50_000)
                    nonce_start = _alloc_nonces(batch_size)
                    
                    # Cosmic Harmony v3 has different GPU API (mine with target)
                    if self.config.algorithm == Algorithm.COSMIC_HARMONY_V3 and COSMIC_V3_GPU_AVAILABLE:
                        # CH v3 pool validation uses state0 (first 4 bytes) vs target_cosmic32.
                        if target_cosmic32 is None:
                            time.sleep(0.05)
                            continue

                        endian = getattr(stratum, "cosmic_state0_endian", "little")

                        # Mine batch - returns (nonce, hash) if found
                        result = self.gpu_miner.mine(
                            blob_bytes,
                            int(target_cosmic32),
                            nonce_start,
                            state0_endian=endian,
                        )

                        with stats_lock:
                            gpu_hashes += int(getattr(self.gpu_miner, "last_batch_hashes", self.gpu_miner.batch_size))

                        # result contains (nonce, hash) if found, or None
                        if result and result[0] is not None:
                            # Avoid stale-job submits
                            with job_lock:
                                if job_state.get("version") != version:
                                    continue

                            nonce, result_hash = result

                            # Canonical verification: if native CHv3 is available,
                            # recompute hash for the found nonce and submit only the
                            # verified hash. This protects against GPU-kernel drift.
                            if COSMIC_V3_AVAILABLE and _cosmic_v3_native:
                                try:
                                    verified_hash = _cosmic_v3_native.hash(blob_bytes, int(nonce))
                                    if verified_hash != result_hash:
                                        chv3_gpu_verify_mismatches += 1
                                        if chv3_gpu_verify_mismatches <= 3 or (chv3_gpu_verify_mismatches % 50) == 0:
                                            logger.warning(
                                                f"⚠️ CHv3 GPU/native hash mismatch for nonce {int(nonce):08x} "
                                                f"(count={chv3_gpu_verify_mismatches})"
                                            )
                                    result_hash = verified_hash
                                except Exception as e:
                                    logger.warning(f"⚠️ CHv3 native verify failed for nonce {int(nonce):08x}: {e}")

                            state0_le = int.from_bytes(result_hash[:4], "little", signed=False)
                            state0_be = int.from_bytes(result_hash[:4], "big", signed=False)
                            state0_used = state0_be if str(endian).lower() == "big" else state0_le

                            # Submit only if canonical hash actually meets pool target.
                            if state0_used > int(target_cosmic32):
                                continue

                            submit_meta = {
                                "job_id": job_id,
                                "nonce_hex": f"{int(nonce):08x}",
                                "state0_hex": f"0x{int(state0_used):08x}",
                                "state0_le": int(state0_le),
                                "state0_be": int(state0_be),
                                "state0_endian": str(endian).lower(),
                                "target32_hex": f"0x{int(target_cosmic32):08x}",
                                "target32": int(target_cosmic32),
                                "chv3_gpu": True,
                            }
                            stratum.submit_share(job_id, nonce, result_hash, meta=submit_meta)
                        continue
                    
                    # Original CH v1/v2 GPU path
                    hashes_out = self.gpu_miner.hash_batch(blob_bytes, nonce_start, batch_size)

                    processed = 0
                    for i in range(batch_size):
                        if stop_event.is_set() or pause_event.is_set() or (not gpu_enabled.is_set()):
                            break
                        with job_lock:
                            if job_state.get("version") != version:
                                break
                        nonce = nonce_start + i
                        result_hash = hashes_out[i * 32 : (i + 1) * 32].tobytes()

                        meets = False
                        if target_64 is not None:
                            # Match pool validation: FIRST 8 bytes, little-endian
                            hash_low64 = int.from_bytes(result_hash[:8], 'little')
                            meets = hash_low64 <= target_64
                        elif target_256 is not None:
                            if self.config.algorithm in [Algorithm.COSMIC_HARMONY, Algorithm.COSMIC_HARMONY_V2] and target_cosmic32 is not None:
                                state0 = int.from_bytes(result_hash[:4], 'little', signed=False)
                                meets = state0 <= int(target_cosmic32)
                            else:
                                result_int = int.from_bytes(result_hash, 'big')
                                meets = result_int < target_256

                        if meets:
                            stratum.submit_share(job_id, nonce, result_hash)

                        processed += 1

                    with stats_lock:
                        gpu_hashes += processed

            first_job = stratum.get_job() or stratum.current_job
            if first_job:
                _update_job_from_stratum(first_job)

            cpu_threads: List[threading.Thread] = []
            cpu_workers = max(1, int(self.config.cpu_threads or 1)) if cpu_ready else 0
            for wi in range(cpu_workers):
                t = threading.Thread(target=_cpu_worker, args=(wi,), daemon=True)
                cpu_threads.append(t)
                t.start()
            gpu_t = threading.Thread(target=_gpu_worker, daemon=True)
            gpu_t.start()

            def _print_help():
                print("\nHotkeys: h=help | s=summary | p=pause | g=gpu on/off | r=reconnect | a=algo next | q=quit\n")

            def _print_summary():
                elapsed = time.perf_counter() - global_start
                with job_lock:
                    jid = job_state.get('job_id')
                    h = job_state.get('height')
                    diff = job_state.get('difficulty')
                with stats_lock:
                    ch = cpu_hashes
                    gh = gpu_hashes
                sent = stratum.shares_sent
                acc = stratum.shares_accepted
                rej = stratum.shares_rejected
                acc_rate = (acc / sent * 100.0) if sent else 0.0
                print("\n=== Mining Summary ===")
                print(f"uptime : {self._format_uptime(elapsed)}")
                print(f"algo   : {self.config.algorithm.value}")
                print(f"pool   : {self.config.pool_host}:{self.config.pool_port}")
                print(f"job    : {str(jid)[:16] if jid else '-'} | h {h} | diff {diff}")
                print(f"hashes : cpu {ch:,} | gpu {gh:,} | total {(ch+gh):,}")
                print(f"shares : sent {sent} | accepted {acc} | rejected {rej} | acc {acc_rate:.1f}%")
                if stratum.last_share_error:
                    print(f"last err: {self._format_last_error(stratum.last_share_error, 120)}")
                print("======================\n")

            if hotkeys.enabled:
                print("Hotkeys: h=help | s=summary | p=pause | g=gpu on/off | r=reconnect | a=algo next | q=quit")

            last_stats_t = time.perf_counter()
            last_total_hashes = 0
            last_cpu_hashes = 0
            last_gpu_hashes = 0
            session_action: str = "quit"  # quit|reconnect|algo

            try:
                while True:
                    now = time.perf_counter()
                    if end_at and now >= end_at:
                        session_action = "quit"
                        break

                    hk = hotkeys.poll()
                    if hk:
                        c = hk.lower()
                        if c == 'h':
                            _print_help()
                        elif c == 's':
                            _print_summary()
                        elif c == 'p':
                            if pause_event.is_set():
                                pause_event.clear()
                                print("\n▶️  Resumed")
                            else:
                                pause_event.set()
                                print("\n⏸️  Paused")
                        elif c == 'g':
                            # Stateful toggle: remembers desired state across reconnect/algo-switch.
                            if gpu_desired:
                                gpu_desired = False
                                gpu_enabled.clear()
                                print("\n🧊 GPU OFF")
                            else:
                                if not GPU_AVAILABLE:
                                    print("\n⚠️  GPU not available")
                                    continue
                                if not _algo_supports_gpu():
                                    print(f"\n⚠️  GPU not supported for algo {self.config.algorithm.value}")
                                    continue
                                if not _ensure_gpu_initialized():
                                    err = getattr(self, "_gpu_init_error", None)
                                    if err:
                                        print(f"\n⚠️  GPU init failed: {err}")
                                    else:
                                        print("\n⚠️  GPU not available")
                                    # Do not keep trying every reconnect unless user asks again.
                                    gpu_desired = False
                                    gpu_enabled.clear()
                                    continue
                                gpu_desired = True
                                gpu_enabled.set()
                                print("\n🔥 GPU ON")
                        elif c == 'r':
                            print("\n🔌 Reconnect requested")
                            session_action = "reconnect"
                            break
                        elif c == 'a':
                            print("\n🔁 Algorithm switch requested")
                            session_action = "algo"
                            break
                        elif c == 'q':
                            print("\n⏹️  Quit requested")
                            session_action = "quit"
                            stop_event.set()
                            break

                    new_job = stratum.get_job()
                    if new_job:
                        _update_job_from_stratum(new_job)

                    if self.config.stats_interval and (now - last_stats_t) >= float(self.config.stats_interval or 10.0):
                        elapsed = now - global_start
                        with stats_lock:
                            ch = cpu_hashes
                            gh = gpu_hashes
                        total = ch + gh
                        dt = now - last_stats_t
                        window_hr = (total - last_total_hashes) / dt if dt > 0 else 0.0
                        window_cpu_hr = (ch - last_cpu_hashes) / dt if dt > 0 else 0.0
                        window_gpu_hr = (gh - last_gpu_hashes) / dt if dt > 0 else 0.0
                        last_total_hashes = total
                        last_cpu_hashes = ch
                        last_gpu_hashes = gh
                        last_stats_t = now

                        with job_lock:
                            jid = job_state.get('job_id')
                            h = job_state.get('height')
                            diff = job_state.get('difficulty')

                        uptime = self._format_uptime(elapsed)
                        err_short = self._format_last_error(stratum.last_share_error)
                        err_part = f" | err {err_short}" if err_short else ""
                        sent = stratum.shares_sent
                        acc = stratum.shares_accepted
                        acc_rate = (acc / sent * 100.0) if sent else 0.0
                        gpu_state = "ON" if gpu_enabled.is_set() else "OFF"
                        gpu_ms = None
                        gpu_gs = None
                        if self.gpu_miner is not None and gpu_enabled.is_set():
                            gpu_ms = getattr(self.gpu_miner, "last_kernel_ms", None)
                            gpu_gs = getattr(self.gpu_miner, "last_global_size", None)
                        gpu_perf = ""
                        if gpu_ms is not None and gpu_gs:
                            gpu_perf = f" | gpu {gpu_ms:.2f}ms/{gpu_gs}"

                        if ui_mode == "xmrig":
                            _render_dashboard(
                                uptime=uptime,
                                pool_host=self.config.pool_host,
                                pool_port=self.config.pool_port,
                                wallet=self.config.wallet_address,
                                worker=self.config.worker_name,
                                algo=self.config.algorithm.value,
                                gpu_state=gpu_state,
                                cpu_hr=window_cpu_hr,
                                gpu_hr=window_gpu_hr,
                                total_hr=window_hr,
                                shares_sent=sent,
                                shares_acc=stratum.shares_accepted,
                                shares_rej=stratum.shares_rejected,
                                diff=diff,
                                height=h,
                                job_id=jid,
                                last_err=err_short,
                                gpu_kernel_ms=gpu_ms,
                                gpu_global_size=gpu_gs,
                            )
                        else:
                            print(
                                f"[{uptime}] {self.config.algorithm.value} CPU{'+' if _gpu_ready_now() else ''}{'GPU' if _gpu_ready_now() else ''}(GPU {gpu_state}) | "
                                f"{self._format_hashrate(window_hr)} | "
                                f"A/R {stratum.shares_accepted}/{stratum.shares_rejected} | sent {sent} | acc {acc_rate:.0f}% | diff {diff} | h {h} | job {str(jid)[:8]}{err_part}{gpu_perf}"
                            )

                        self._write_stats_file({
                            "timestamp": time.time(),
                            "uptime_sec": elapsed,
                            "uptime": uptime,
                            "algorithm": self.config.algorithm.value,
                            # Dashboard-compatible keys
                            "hashrate": window_hr,
                            "hashrate_cpu": window_cpu_hr,
                            "hashrate_gpu": window_gpu_hr,
                            "shares_total": total_shares_sent + stratum.shares_sent,
                            "connected": True,
                            "pool_url": f"{self.config.pool_host}:{self.config.pool_port}",
                            "wallet_address": self.config.wallet_address,
                            "worker_name": self.config.worker_name,
                            "blockchain_height": h,
                            "session_id": str(jid) if jid is not None else "",
                            "cpu_hashes_total": total_cpu_hashes + ch,
                            "gpu_hashes_total": total_gpu_hashes + gh,
                            "hashes_total": (total_cpu_hashes + ch) + (total_gpu_hashes + gh),
                            "hashrate_window_hs": window_hr,
                            "shares_sent": total_shares_sent + stratum.shares_sent,
                            "shares_accepted": total_shares_acc + stratum.shares_accepted,
                            "shares_rejected": total_shares_rej + stratum.shares_rejected,
                            "job_id": jid,
                            "height": h,
                            "difficulty": diff,
                            "gpu_enabled": gpu_enabled.is_set(),
                            "gpu_device": getattr(self.gpu_miner.device, "name", "") if self.gpu_miner is not None else "",
                            "gpu_last_kernel_ms": float(getattr(self.gpu_miner, "last_kernel_ms", 0.0)) if self.gpu_miner is not None else 0.0,
                            "gpu_avg_kernel_ms": float(getattr(self.gpu_miner, "avg_kernel_ms", 0.0)) if self.gpu_miner is not None else 0.0,
                            "gpu_last_global_size": int(getattr(self.gpu_miner, "last_global_size", 0)) if self.gpu_miner is not None else 0,
                            "last_share_error": stratum.last_share_error,
                        })

                    time.sleep(0.05)

                    if not stratum.connected:
                        reason = stratum.last_disconnect_reason or "disconnected"
                        print(f"⚠️  Pool connection lost ({reason})")
                        session_action = "reconnect"
                        break

            except KeyboardInterrupt:
                print("\n⏹️  Mining stopped by user")
                session_action = "quit"
            finally:
                stop_event.set()
                try:
                    hotkeys.stop()
                except Exception:
                    pass
                for t in cpu_threads:
                    try:
                        t.join(timeout=2.0)
                    except Exception:
                        pass
                try:
                    gpu_t.join(timeout=2.0)
                except Exception:
                    pass

                with stats_lock:
                    ch = cpu_hashes
                    gh = gpu_hashes
                total_cpu_hashes += ch
                total_gpu_hashes += gh
                total_shares_sent += stratum.shares_sent
                total_shares_acc += stratum.shares_accepted
                total_shares_rej += stratum.shares_rejected

                try:
                    stratum.disconnect()
                except Exception:
                    pass

            if session_action == "reconnect":
                print("✅ Reconnecting...\n")
                continue

            if session_action == "algo":
                try:
                    idx = algo_cycle.index(self.config.algorithm)
                except ValueError:
                    idx = 0
                next_algo = algo_cycle[(idx + 1) % len(algo_cycle)]
                print(f"⚙️  Switching algorithm -> {next_algo.value} (reinit + reconnect)")
                self.switch_algorithm(next_algo)
                # If the next algo doesn't support GPU, force desired state OFF.
                if not _algo_supports_gpu():
                    gpu_desired = False
                print("✅ Algorithm switched\n")
                continue

            break

        elapsed = time.perf_counter() - global_start
        total = total_cpu_hashes + total_gpu_hashes
        hr = total / elapsed if elapsed > 0 else 0.0

        print("\n📊 Pool Mining Summary:")
        print(f"   Time: {elapsed:.2f}s")
        print(f"   Total hashes: {total:,} (cpu {total_cpu_hashes:,} | gpu {total_gpu_hashes:,})")
        print(f"   Hashrate: {hr/1_000_000:.2f} MH/s" if hr >= 1_000_000 else f"   Hashrate: {hr:,.0f} H/s")
        print(f"   Shares sent: {total_shares_sent} | accepted: {total_shares_acc} | rejected: {total_shares_rej}")
        print()
    
    def cleanup(self):
        """Cleanup resources"""
        algo = self.config.algorithm
        
        # Shutdown thread pool
        if self.thread_pool:
            self.thread_pool.shutdown(wait=True)
            logger.info("Thread pool shutdown complete")
        
        if algo == Algorithm.RANDOMX and 'randomx' in self.loader.libs:
            self.loader.libs['randomx'].zion_randomx_cleanup()
            logger.info("RandomX cleanup complete")
        
        if algo == Algorithm.YESCRYPT and 'yescrypt' in self.loader.libs:
            self.loader.libs['yescrypt'].yescrypt_cleanup()
            logger.info("Yescrypt cleanup complete")


def main():
    """Main entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(description="ZION Native Miner v2.9.0")
    parser.add_argument("--algorithm", "-a", 
                       choices=["cosmic_harmony", "cosmic_harmony_v2", "cosmic_harmony_v3", "randomx", "yescrypt"],
                       default="cosmic_harmony",
                       help="Mining algorithm (cosmic_harmony_v3: GPU 21+ MH/s, Native Rust)")
    parser.add_argument("--mode", "-m",
                       choices=["cpu", "gpu", "auto"],
                       default="auto",
                       help="Mining mode")
    parser.add_argument("--threads", "-t", type=int, default=None,
                       help="CPU threads (default: auto-detect)")
    parser.add_argument("--gpu-batch", type=int, default=500000,
                       help="GPU batch size (default: 500000)")
    parser.add_argument("--benchmark", "-b", action="store_true",
                       help="Run benchmark only")
    parser.add_argument("--duration", "-d", type=float, default=10.0,
                       help="Benchmark/mining duration in seconds")
    parser.add_argument("--pool", "-p", 
                       help="Pool address (e.g., localhost:3333)")
    parser.add_argument("--wallet", "-w",
                       help="Wallet address for pool mining")
    parser.add_argument("--worker", default="zion-native-miner",
                       help="Worker name")
    parser.add_argument("--stats-interval", type=float, default=10.0,
                       help="Stats print interval in seconds (default: 10)")
    parser.add_argument("--stats-file", default="",
                       help="Optional path to write JSON stats (e.g., data/miner_stats.json)")
    parser.add_argument("--ui", choices=["lines", "xmrig"], default="lines",
                       help="Console UI mode: lines (default) or xmrig (static dashboard)")
    
    args = parser.parse_args()

    # Some Windows consoles use legacy codepages (e.g., cp1250). When the miner
    # prints emojis or box-drawing characters, encoding can fail and crash the
    # frozen (PyInstaller) executable. Force UTF-8 with replacement to avoid
    # hard failures.
    try:
        if sys.stdout and hasattr(sys.stdout, "reconfigure"):
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        if sys.stderr and hasattr(sys.stderr, "reconfigure"):
            sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

    def safe_print(text: str = "") -> None:
        try:
            print(text)
        except UnicodeEncodeError:
            # Some Windows consoles use legacy codepages (e.g., cp1250) that
            # cannot encode emojis/box-drawing. Degrade gracefully.
            print(text.encode("ascii", "replace").decode("ascii"))
    
    # Auto-detect CPU threads if not specified
    cpu_threads = args.threads
    if cpu_threads is None:
        cpu_threads = max(1, mp.cpu_count() - 1)  # Leave one core for system
    
    safe_print(
        "\n"
        "==============================================================\n"
        "              ZION NATIVE MINER v2.9.0                         \n"
        "        Unified Native Mining Client - CPU + GPU               \n"
        "==============================================================\n"
    )
    
    # Parse pool settings
    pool_host = "localhost"
    pool_port = 3333
    if args.pool:
        if ':' in args.pool:
            pool_host, pool_port = args.pool.split(':')
            pool_port = int(pool_port)
        else:
            pool_host = args.pool
    
    config = MinerConfig(
        algorithm=Algorithm(args.algorithm),
        mode=MiningMode(args.mode),
        cpu_threads=cpu_threads,
        gpu_batch_size=args.gpu_batch,
        pool_host=pool_host,
        pool_port=pool_port,
        wallet_address=args.wallet or "",
        worker_name=args.worker,
        use_pool=bool(args.pool),
        stats_interval=float(args.stats_interval or 10.0),
        stats_file=args.stats_file or "",
        ui=str(args.ui or "lines"),
    )
    
    try:
        miner = ZionNativeMiner(config)
        
        if args.benchmark:
            miner.benchmark(duration=args.duration)
        elif config.use_pool:
            if not config.wallet_address:
                safe_print("Wallet address required for pool mining (--wallet)")
                return 1
            miner.mine_to_pool(duration=args.duration if args.duration != 10.0 else None)
        else:
            safe_print("Please specify --benchmark or --pool")
            safe_print("\nExamples:")
            safe_print("  Benchmark: python zion_native_miner_v2_9.py --benchmark --duration 10")
            safe_print("  Pool mining: python zion_native_miner_v2_9.py --pool localhost:3333 --wallet YOUR_WALLET")
            return 1
        
        miner.cleanup()
        
    except KeyboardInterrupt:
        safe_print("\nInterrupted by user")
    except Exception as e:
        safe_print(f"\nError: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
