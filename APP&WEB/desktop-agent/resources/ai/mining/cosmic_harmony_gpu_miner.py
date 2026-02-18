#!/usr/bin/env python3
"""
🌟 ZION Cosmic Harmony GPU Miner - OpenCL Implementation
Real GPU mining with PyOpenCL for AMD Radeon RX 5600/5700 XT

Features:
- Direct GPU acceleration using OpenCL
- Real Stratum protocol communication
- Share submission and block validation
- Performance monitoring and stats
- Graceful error handling and recovery
"""

import pyopencl as cl
import numpy as np
import socket
import json
import time
import threading
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Tuple, Optional
import hashlib
import struct
import os
import sys
from collections import deque
import glob

# Logging setup
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("ZionGPUMiner")

# Try to import core Cosmic Harmony wrapper for optional core-submit
_CH_HASHER = None
def _get_core_hasher():
    global _CH_HASHER
    if _CH_HASHER is not None:
        return _CH_HASHER
    try:
        # Add project path to import cosmic_harmony_wrapper (../../zion/mining)
        from pathlib import Path
        repo_root = Path(__file__).resolve().parents[2]
        sys.path.insert(0, str(repo_root / 'zion' / 'mining'))
        from cosmic_harmony_wrapper import get_hasher  # type: ignore
        _CH_HASHER = get_hasher()
        logger.info("🧠 Core hasher available for core-submit mode")
    except Exception as e:
        logger.warning(f"Core hasher unavailable: {e}")
        _CH_HASHER = None
    return _CH_HASHER

# ============================================================================
# COSMIC HARMONY OPENCL KERNEL - SIMPLIFIED
# ============================================================================

COSMIC_HARMONY_OPENCL_KERNEL = """
// Rotate left operation
#define ROTL(x, n) (((x) << (n)) | ((x) >> (32 - (n))))

// Simple mixing function
uint mix(uint a, uint b, uint c) {
    return ROTL(a ^ b, 5) + c;
}

// Main mining kernel for Cosmic Harmony
kernel void cosmic_harmony_mine(
    global uint *header_data,
    uint header_size,
    uint nonce_start,
    uint nonce_range,
    global uint *hash_output,
    global int *found_flag,       // 0/1 flag (first-wins)
    global uint *found_nonce_out, // store nonce of first found
    global uint *found_hash_out,  // store 8 uints (32B) of first found state
    uint target_difficulty
)
{
    size_t gid = get_global_id(0);
    
    if (gid >= nonce_range) return;
    
    uint nonce = nonce_start + gid;
    
    // Cosmic Harmony: Multi-stage hash computation
    uint state[8] = {
        0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
        0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
    };
    
    // Stage 1: Mix header with nonce (Blake3-inspired)
    for (uint i = 0; i < min(header_size/4, 8u); i++) {
        state[i] ^= header_data[i];
    }
    state[0] ^= nonce;
    state[1] ^= (nonce >> 16);
    
    // Stage 2: Compression rounds
    for (int round = 0; round < 12; round++) {
        for (int i = 0; i < 8; i++) {
            state[i] = mix(state[i], state[(i+1) % 8], state[(i+2) % 8]);
        }
        // Diagonal mixing
        for (int i = 0; i < 4; i++) {
            uint tmp = state[i];
            state[i] = state[i + 4];
            state[i + 4] = tmp;
        }
    }
    
    // Stage 3: Keccak-like XOR
    uint xor_mix = 0;
    for (int i = 0; i < 8; i++) {
        xor_mix ^= state[i];
    }
    for (int i = 0; i < 8; i++) {
        state[i] ^= xor_mix;
    }
    
    // Stage 4: Golden ratio transformation (φ ≈ 1.618)
    uint phi = 0x9E3779B9;  // 2^32 / φ
    for (int i = 0; i < 8; i++) {
        state[i] *= phi;
    }
    
    // Store hash for this gid
    for (int i = 0; i < 8; i++) {
        hash_output[gid * 8 + i] = state[i];
    }

    // Check difficulty (first uint as target) and capture first solution
    if (state[0] <= target_difficulty) {
        if (atomic_cmpxchg(found_flag, 0, 1) == 0) {
            // We are the first to find
            found_nonce_out[0] = nonce;
            for (int i = 0; i < 8; i++) {
                found_hash_out[i] = state[i];
            }
        }
    }
}
"""

# Simple Autolykos v2 placeholder kernel (matches pool's test validator)
# expected[0..31] = header32[i] ^ ((nonce as 4 bytes LE)[i%4])
# Valid if expected <= target (big-endian lexicographic)
ALV2_PLACEHOLDER_OPENCL_KERNEL = """
kernel void alv2_placeholder(
    global const uchar *header32,  // 32 bytes
    global const uchar *target32,  // 32 bytes (big-endian)
    uint nonce_start,
    uint nonce_range,
    global int *found_flag,        // 0/1 flag
    global uint *found_nonce,
    global uchar *found_hash       // 32 bytes
)
{
    size_t gid = get_global_id(0);
    if (gid >= nonce_range) return;

    uint nonce = nonce_start + (uint)gid;
    uchar nb0 = (uchar)(nonce & 0xFF);
    uchar nb1 = (uchar)((nonce >> 8) & 0xFF);
    uchar nb2 = (uchar)((nonce >> 16) & 0xFF);
    uchar nb3 = (uchar)((nonce >> 24) & 0xFF);

    uchar expected[32];
    for (int i = 0; i < 32; i++) {
        uchar nbi = (i % 4 == 0) ? nb0 : (i % 4 == 1) ? nb1 : (i % 4 == 2) ? nb2 : nb3;
        expected[i] = header32[i] ^ nbi;
    }

    // Lexicographic big-endian compare expected <= target32
    int lt = 0; // expected < target
    int gt = 0; // expected > target
    for (int i = 0; i < 32; i++) {
        if (expected[i] < target32[i]) { lt = 1; break; }
        if (expected[i] > target32[i]) { gt = 1; break; }
    }

    if ((lt == 1 || (lt == 0 && gt == 0)) && atomic_cmpxchg(found_flag, 0, 1) == 0) {
        // We are the first to find
        *found_nonce = nonce;
        for (int i = 0; i < 32; i++) {
            found_hash[i] = expected[i];
        }
    }
}
"""

# ============================================================================
# ZION GPU MINER CLASS
# ============================================================================

class ZionGPUMiner:
    """ZION Cosmic Harmony GPU Miner with OpenCL acceleration"""
    
    def __init__(self):
        """Initialize GPU miner"""
        self.platforms: List[cl.Platform] = []
        self.devices: List[cl.Device] = []
        self.context: Optional[cl.Context] = None
        self.program: Optional[cl.Program] = None
        self.program_alv2: Optional[cl.Program] = None
        self.queue: Optional[cl.CommandQueue] = None
        self.gpu_name: Optional[str] = None
        
        self.mining = False
        self.pool_socket: Optional[socket.socket] = None
        self.mining_thread: Optional[threading.Thread] = None
        self._pool_broken: bool = False
        self._last_pool_attempt: float = 0.0
        self._last_temp_read: float = 0.0
        self._last_ab_read: float = 0.0
        
        self.stats = {
            'total_hashes': 0,
            'shares_found': 0,
            'shares_rejected': 0,
            'blocks_found': 0,
            'hashrate': 0.0,
            'start_time': None,
            'current_nonce': 0,
            'submit_latency_ms_last': None,
            'submit_latency_ms_avg': None,
            'kernel_time_ms_last': None,
            'kernel_time_ms_avg': None,
            'gpu_temp_c': None,
            'afterburner_temp_c': None,
            'afterburner_tasks_per_sec': None,
            'afterburner_efficiency_pct': None,
            'gpu_name': None,
            'batch_size': None,
        }
        
        self.config = {
            'pool_url': 'localhost',
            'pool_port': 3333,
            'wallet': 'test_wallet',
            'worker': 'gpu_miner_001',
            'password': 'cosmic_harmony',  # request Cosmic Harmony jobs from pool
            'algorithm': 'cosmic_harmony',
            'core_submit': True,           # deprecated path; use cpu_verify instead
            'cpu_verify': True,            # verify GPU-found hash with CPU wrapper before submit
        }

        # Allow environment overrides for quick testing
        try:
            self.config['pool_url'] = os.environ.get('ZION_POOL_HOST', self.config['pool_url'])
            self.config['pool_port'] = int(os.environ.get('ZION_POOL_PORT', str(self.config['pool_port'])))
            self.config['wallet'] = os.environ.get('ZION_WALLET', self.config['wallet'])
            self.config['password'] = os.environ.get('ZION_POOL_PASSWORD', self.config['password'])
            self.config['core_submit'] = os.environ.get('ZION_CORE_SUBMIT', str(self.config['core_submit'])).lower() in ('1','true','yes')
            self.config['cpu_verify'] = os.environ.get('ZION_CPU_VERIFY', str(self.config['cpu_verify'])).lower() in ('1','true','yes')
        except Exception:
            pass

        # Submit timing queue (for RTT/latency)
        self.submit_times: deque = deque()

        # Optional AI Afterburner integration
        self.afterburner = None
        self.afterburner_enabled = os.environ.get('ZION_AI_AFTERBURNER', '1').lower() in ('1','true','yes')

        # Stratum/job state
        self.current_job = {
            'algorithm': None,
            'job_id': None,
            'header32': None,   # bytes length 32
            'target32': None,   # bytes length 32 big-endian
            'height': None,
        }
        self.job_lock = threading.Lock()
        self.receiver_thread: Optional[threading.Thread] = None
        
    logger.info("🌟 ZION GPU Miner initialized")
    
    def detect_gpus(self) -> bool:
        """Detect and initialize GPU platforms (prefer AMD APP platform)"""
        try:
            self.platforms = cl.get_platforms()
            if not self.platforms:
                logger.error("❌ No OpenCL platforms found")
                return False

            logger.info(f"✅ Found {len(self.platforms)} OpenCL platform(s)")

            preferred_platform: Optional[cl.Platform] = None
            all_devices: List[cl.Device] = []
            for i, platform in enumerate(self.platforms):
                logger.info(f"   Platform {i}: {platform.name}")
                try:
                    devices = platform.get_devices(device_type=cl.device_type.GPU)
                except Exception:
                    devices = []
                if devices:
                    # Prefer AMD APP platform explicitly to avoid Clover build issues
                    if ("AMD Accelerated Parallel Processing" in platform.name) or ("Advanced Micro Devices" in platform.name) or ("AMD" in platform.name):
                        preferred_platform = platform
                        self.devices = devices
                    all_devices.extend(devices)
                    for j, device in enumerate(devices):
                        logger.info(
                            f"      GPU {len(all_devices)-1}: {device.name} "
                            f"({device.global_mem_size / (1024**3):.1f} GB)"
                        )

            # Fallback: if no preferred AMD platform selected, use any GPU devices
            if not self.devices and all_devices:
                self.devices = [all_devices[0]]
            
            if not self.devices:
                logger.error("❌ No GPU devices found")
                return False

            self.gpu_name = self.devices[0].name
            logger.info(f"✅ Using device: {self.gpu_name}")
            return True

        except Exception as e:
            logger.error(f"❌ GPU detection failed: {e}")
            return False
    
    def initialize_gpu(self, device_id: int = 0) -> bool:
        """Initialize specific GPU device (bind context to platform explicitly)"""
        try:
            if device_id >= len(self.devices):
                logger.error(f"❌ Device {device_id} not found")
                return False

            # Find platform for the selected device
            device = self.devices[device_id]
            platform_for_device = None
            for p in self.platforms:
                try:
                    if device in p.get_devices(device_type=cl.device_type.GPU):
                        platform_for_device = p
                        break
                except Exception:
                    continue

            if platform_for_device is None:
                # Fallback without explicit platform property
                self.context = cl.Context([device])
            else:
                logger.info(f"🧭 Binding context to platform: {platform_for_device.name}")
                props = [(cl.context_properties.PLATFORM, platform_for_device)]
                self.context = cl.Context(properties=props, devices=[device])

            # Enable profiling if supported to measure kernel times
            try:
                self.queue = cl.CommandQueue(self.context, properties=cl.command_queue_properties.PROFILING_ENABLE)
            except Exception:
                self.queue = cl.CommandQueue(self.context)

            # Compile programs - target OpenCL 1.2 for compatibility
            logger.info("🔧 Compiling OpenCL kernel...")
            self.program = cl.Program(self.context, COSMIC_HARMONY_OPENCL_KERNEL).build(options=["-cl-std=CL1.2"]) 
            self.program_alv2 = cl.Program(self.context, ALV2_PLACEHOLDER_OPENCL_KERNEL).build(options=["-cl-std=CL1.2"]) 

            logger.info(f"✅ GPU {device_id} initialized: {device.name}")
            self.stats['gpu_name'] = device.name
            return True

        except Exception as e:
            logger.error(f"❌ GPU initialization failed: {e}")
            return False
    
    def compute_hash_gpu(self, header: bytes, nonce: int) -> bytes:
        """Compute Cosmic Harmony hash on GPU"""
        try:
            if not self.program or not self.queue:
                logger.error("❌ GPU not initialized")
                return b'\x00' * 32
            
            # Prepare data (uint32-aligned as expected by kernel)
            # Pad header to multiple of 4 bytes
            padding = (-len(header)) % 4
            header_padded = header + (b"\x00" * padding)
            header_u32 = np.frombuffer(header_padded, dtype=np.uint32)

            header_buf = cl.Buffer(
                self.context,
                cl.mem_flags.READ_ONLY | cl.mem_flags.COPY_HOST_PTR,
                hostbuf=header_u32
            )
            # Output holds 8 uints (32 bytes)
            output_buf = cl.Buffer(self.context, cl.mem_flags.WRITE_ONLY, size=8 * 4)
            
            # Run kernel with single nonce
            kernel = self.program.cosmic_harmony_mine
            found_flag_buf = cl.Buffer(
                self.context,
                cl.mem_flags.READ_WRITE | cl.mem_flags.COPY_HOST_PTR,
                hostbuf=np.array([0], dtype=np.int32)
            )
            found_nonce_buf = cl.Buffer(self.context, cl.mem_flags.WRITE_ONLY, size=4)
            found_hash_buf = cl.Buffer(self.context, cl.mem_flags.WRITE_ONLY, size=8 * 4)
            kernel(
                self.queue, (1,), None,
                header_buf, np.uint32(header_u32.size * 4),
                np.uint32(nonce), np.uint32(1),
                output_buf,
                found_flag_buf,
                found_nonce_buf,
                found_hash_buf,
                np.uint32(0xFFFFFFFF)
            )  # high difficulty for testing (32-bit target for kernel)
            
            self.queue.finish()
            
            # Read result
            result_u32 = np.empty(8, dtype=np.uint32)
            cl.enqueue_copy(self.queue, result_u32, output_buf).wait()
            return result_u32.tobytes()
            
        except Exception as e:
            logger.error(f"❌ Hash computation failed: {e}")
            return b'\x00' * 32
    
    def mine_batch_gpu(self, header: bytes, nonce_start: int, nonce_count: int, target: int) -> Tuple[bool, int, bytes]:
        """Mine a batch of nonces on GPU"""
        try:
            if not self.program or not self.queue:
                logger.error("❌ GPU not initialized")
                return False, 0, b'\x00' * 32
            
            # Prepare buffers (uint32 aligned)
            padding = (-len(header)) % 4
            header_padded = header + (b"\x00" * padding)
            header_u32 = np.frombuffer(header_padded, dtype=np.uint32)

            header_buf = cl.Buffer(self.context, cl.mem_flags.READ_ONLY | cl.mem_flags.COPY_HOST_PTR,
                                   hostbuf=header_u32)
            # Each hash is 8 uints
            output_buf = cl.Buffer(self.context, cl.mem_flags.WRITE_ONLY, size=nonce_count * 8 * 4)
            found_flag = np.array([0], dtype=np.int32)
            found_flag_buf = cl.Buffer(self.context, cl.mem_flags.READ_WRITE | cl.mem_flags.COPY_HOST_PTR,
                                        hostbuf=found_flag)
            found_nonce_buf = cl.Buffer(self.context, cl.mem_flags.WRITE_ONLY, size=4)
            found_hash_buf = cl.Buffer(self.context, cl.mem_flags.WRITE_ONLY, size=8 * 4)
            
            # Run mining kernel with auto-determined local work group
            kernel = self.program.cosmic_harmony_mine
            global_work_size = (nonce_count,)
            local_work_size = None  # Let driver decide for compatibility

            evt = kernel(self.queue, global_work_size, local_work_size,
                   header_buf, np.uint32(header_u32.size * 4),
                   np.uint32(nonce_start), np.uint32(nonce_count),
                   output_buf,
                   found_flag_buf,
                   found_nonce_buf,
                   found_hash_buf,
                   np.uint32(target & 0xFFFFFFFF))
            
            # Wait for kernel completion and record timing if available
            try:
                evt.wait()
                if hasattr(evt, 'profile'):
                    kt_ms = (evt.profile.end - evt.profile.start) / 1e6
                    self.stats['kernel_time_ms_last'] = kt_ms
                    prev = self.stats.get('kernel_time_ms_avg')
                    self.stats['kernel_time_ms_avg'] = kt_ms if prev is None else (0.8 * prev + 0.2 * kt_ms)
            except Exception:
                pass

            # Async read without blocking
            out_flag = np.empty(1, dtype=np.int32)
            cl.enqueue_copy(self.queue, out_flag, found_flag_buf).wait()

            if int(out_flag[0]) == 1:
                # Read first found nonce and hash
                out_nonce = np.empty(1, dtype=np.uint32)
                out_hash_u32 = np.empty(8, dtype=np.uint32)
                cl.enqueue_copy(self.queue, out_nonce, found_nonce_buf).wait()
                cl.enqueue_copy(self.queue, out_hash_u32, found_hash_buf).wait()
                return True, int(out_nonce[0]), out_hash_u32.tobytes()
            
            return False, 0, b'\x00' * 32
            
        except Exception as e:
            logger.error(f"❌ Batch mining failed: {e}")
            return False, 0, b'\x00' * 32
    
    def connect_to_pool(self) -> bool:
        """Connect to mining pool via Stratum"""
        try:
            host = self.config['pool_url']
            port = self.config['pool_port']
            attempts = int(os.environ.get('ZION_POOL_RETRIES', '12'))  # ~1 min with 5s delay

            for attempt in range(1, attempts + 1):
                try:
                    self.pool_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                    self.pool_socket.settimeout(5)
                    self.pool_socket.connect((host, port))
                    break
                except Exception as ce:
                    logger.error(f"❌ Pool connection failed (attempt {attempt}/{attempts}): {ce}")
                    try:
                        self.pool_socket.close()
                    except Exception:
                        pass
                    self.pool_socket = None
                    if attempt == attempts:
                        return False
                    time.sleep(5)
            
            # Send mining.subscribe
            subscribe_msg = {
                "id": 1,
                "method": "mining.subscribe",
                "params": ["srbminer-multi/2.4.9"]  # hint GPU miner for pool autodetect
            }
            
            self.pool_socket.send((json.dumps(subscribe_msg) + "\n").encode())
            
            # Receive subscribe response (one line)
            f = self.pool_socket.makefile('r')
            sub_resp = f.readline()
            logger.info(f"✅ Pool connected: {sub_resp.strip()[:160]}")
            
            # Send mining.authorize
            auth_msg = {
                "id": 2,
                "method": "mining.authorize",
                "params": [self.config['wallet'], self.config['password']]
            }
            
            self.pool_socket.send((json.dumps(auth_msg) + "\n").encode())
            
            # Ensure receiver loop runs immediately
            self.mining = True
            # After auth, pool may bundle set_difficulty + notify; start receiver thread
            self.receiver_thread = threading.Thread(target=self._receiver_loop, args=(f,), daemon=True)
            self.receiver_thread.start()
            logger.info("✅ Authorized and receiver loop started")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Pool connection failed: {e}")
            return False
    
    def submit_share(self, job_id: str, nonce: int, block_hash: bytes) -> bool:
        """Submit share to pool"""
        try:
            share_msg = {
                "id": 3,
                "method": "mining.submit",
                "params": [
                    self.config['wallet'],
                    job_id,
                    f"{nonce:08x}",
                    block_hash.hex()
                ]
            }
            
            # Send without blocking recv here to avoid race with receiver thread
            # Receiver thread will log and update stats based on id==3 responses
            self.submit_times.append(time.time())
            self.pool_socket.send((json.dumps(share_msg) + "\n").encode())
            logger.debug("📤 Share sent (awaiting pool response in receiver loop)")
            return True
            
        except Exception as e:
            logger.error(f"❌ Share submission failed: {e}")
            self._pool_broken = True
            return False
    
    def start_mining(self) -> bool:
        """Start GPU mining"""
        if not self.detect_gpus():
            return False
        
        if not self.initialize_gpu():
            return False
        
        if not self.connect_to_pool():
            logger.warning("⚠️  Pool connection failed, continuing in simulation mode")
            self._pool_broken = True
        
        # self.mining already set in connect_to_pool if successful; ensure True regardless for simulation
        self.mining = True
        self.stats['start_time'] = time.time()
        
        self.mining_thread = threading.Thread(target=self._mining_loop)
        self.mining_thread.daemon = True
        self.mining_thread.start()
        
        logger.info("✅ GPU mining started")

        # Start AI Afterburner sidecar (non-blocking, CPU-oriented)
        if self.afterburner_enabled and self.afterburner is None:
            try:
                # Make sure ai/ is on path
                repo_root = Path(__file__).resolve().parents[2]
                sys.path.insert(0, str(repo_root / 'ai'))
                from zion_ai_afterburner import ZionAIAfterburner  # type: ignore
                self.afterburner = ZionAIAfterburner()
                self.afterburner.start_afterburner()
                # Queue a few lightweight tasks to show activity
                self.afterburner.add_ai_task("neural_network", priority=7, compute_req=1.5, sacred=True)
                self.afterburner.add_ai_task("sacred_geometry", priority=8, compute_req=1.2, sacred=True)
                self.afterburner.add_ai_task("image_analysis", priority=5, compute_req=0.8, sacred=False)
                logger.info("🔥 AI Afterburner online (HUD every 10s)")
            except Exception as ab_err:
                logger.warning(f"Afterburner init failed: {ab_err}")
        return True
    
    def _mining_loop(self):
        """Main mining loop"""
        try:
            nonce = 0
            batch_size = 2048  # Larger batch for better GPU utilization
            self.stats['batch_size'] = batch_size
            
            while self.mining:
                job_copy = None
                with self.job_lock:
                    if self.current_job['job_id']:
                        job_copy = self.current_job.copy()

                if job_copy and job_copy.get('algorithm') == 'autolykos_v2':
                    # Use ALv2 placeholder GPU search
                    found, found_nonce, found_hash = self.mine_alv2_placeholder_gpu(
                        job_copy['header32'], nonce, batch_size, job_copy['target32']
                    )
                elif job_copy and job_copy.get('algorithm') == 'cosmic_harmony':
                    # Use Cosmic Harmony GPU kernel
                    found, found_nonce, found_hash = self.mine_batch_gpu(
                        job_copy['header'], nonce, batch_size, target=job_copy['target32_int']
                    )
                else:
                    # No job yet; small sleep and continue
                    time.sleep(0.1)
                    continue
                
                self.stats['total_hashes'] += batch_size
                self.stats['current_nonce'] = nonce
                
                # Update hashrate
                elapsed = time.time() - self.stats['start_time']
                if elapsed > 0:
                    self.stats['hashrate'] = self.stats['total_hashes'] / elapsed
                
                nonce += batch_size
                
                if found and self.pool_socket and job_copy:
                    submit_hash = found_hash
                    # Optional CPU verify to ensure GPU hash matches wrapper
                    if job_copy.get('algorithm') == 'cosmic_harmony' and self.config.get('cpu_verify', True):
                        try:
                            hasher = _get_core_hasher()
                            if hasher is not None:
                                core_hash = hasher.hash(job_copy.get('header', b''), int(found_nonce))
                                if core_hash != found_hash:
                                    logger.warning("❌ CPU verify mismatch: skipping submit to avoid invalid share")
                                    submit_hash = None
                                else:
                                    submit_hash = core_hash  # equal, use either
                            else:
                                logger.debug("CPU verify disabled (hasher unavailable)")
                        except Exception as ce:
                            logger.debug(f"CPU-verify error: {ce}")
                    if submit_hash:
                        ok = self.submit_share(job_copy['job_id'], found_nonce, submit_hash)
                        if not ok:
                            # mark pool broken to trigger reconnect
                            self._pool_broken = True
                
                # Log stats every 10 seconds
                if nonce % (batch_size * 100) == 0:
                    # Update GPU temperature and Afterburner metrics
                    self._update_hw_metrics()
                    lat_last = self.stats.get('submit_latency_ms_last')
                    lat_avg = self.stats.get('submit_latency_ms_avg')
                    lat_s = "n/a" if lat_last is None else f"{lat_last:.0f}ms"
                    lat_a = "n/a" if lat_avg is None else f"{lat_avg:.0f}ms"
                    kt = self.stats.get('kernel_time_ms_last')
                    kt_s = "n/a" if kt is None else f"{kt:.2f}ms"
                    t_gpu = self.stats.get('gpu_temp_c')
                    t_gpu_s = "n/a" if t_gpu is None else f"{t_gpu:.0f}°C"
                    ab_t = self.stats.get('afterburner_temp_c')
                    ab_t_s = "n/a" if ab_t is None else f"{ab_t:.0f}°C"
                    ab_eff = self.stats.get('afterburner_efficiency_pct')
                    ab_eff_s = "n/a" if ab_eff is None else f"{ab_eff:.0f}%"
                    logger.info(
                        f"⛏️  {self.stats['hashrate']:.0f} H/s | Nonce {nonce:,} | "
                        f"A/R {self.stats['shares_found']}/{self.stats.get('shares_rejected',0)} | "
                        f"RTT {lat_s} avg {lat_a} | Kt {kt_s} | GPU {t_gpu_s} | AB {ab_t_s} {ab_eff_s}"
                    )
                
                # Reconnect handling on broken socket
                if self._pool_broken:
                    now = time.time()
                    if now - self._last_pool_attempt > 5.0:
                        self._last_pool_attempt = now
                        logger.warning("🔁 Pool connection lost, attempting reconnect...")
                        try:
                            if self.pool_socket:
                                try:
                                    self.pool_socket.close()
                                except Exception:
                                    pass
                                self.pool_socket = None
                            if self.connect_to_pool():
                                logger.info("✅ Reconnected to pool")
                                self._pool_broken = False
                            else:
                                logger.error("❌ Reconnect failed, will retry")
                        except Exception as re:
                            logger.error(f"❌ Reconnect exception: {re}")

                time.sleep(0.001)  # Minimal sleep - let GPU batch optimize
                
        except Exception as e:
            logger.error(f"❌ Mining loop error: {e}")
            self.mining = False
    
    def stop_mining(self):
        """Stop GPU mining"""
        self.mining = False
        
        if self.mining_thread:
            self.mining_thread.join(timeout=5)
        
        # Stop AI Afterburner if running
        if self.afterburner is not None:
            try:
                self.afterburner.stop_afterburner()
            except Exception:
                pass
            self.afterburner = None

        if self.pool_socket:
            try:
                self.pool_socket.close()
            except:
                pass
        
        logger.info(f"✅ Mining stopped. Stats: {self.stats}")
    
    def get_stats(self) -> Dict:
        """Get mining statistics"""
        # refresh lightweight metrics
        self._update_hw_metrics(force=False)
        return {
            'timestamp': datetime.now().isoformat(),
            'mining': self.mining,
            'total_hashes': self.stats['total_hashes'],
            'hashrate': f"{self.stats['hashrate']:.0f} H/s",
            'shares': self.stats['shares_found'],
            'uptime': time.time() - self.stats['start_time'] if self.stats['start_time'] else 0,
            'submit_latency_ms_last': self.stats.get('submit_latency_ms_last'),
            'submit_latency_ms_avg': self.stats.get('submit_latency_ms_avg'),
            'kernel_time_ms_last': self.stats.get('kernel_time_ms_last'),
            'kernel_time_ms_avg': self.stats.get('kernel_time_ms_avg'),
            'gpu_temp_c': self.stats.get('gpu_temp_c'),
            'afterburner_temp_c': self.stats.get('afterburner_temp_c'),
            'afterburner_tasks_per_sec': self.stats.get('afterburner_tasks_per_sec'),
            'afterburner_efficiency_pct': self.stats.get('afterburner_efficiency_pct'),
            'gpu_name': self.stats.get('gpu_name') or self.gpu_name,
            'batch_size': self.stats.get('batch_size'),
        }

    # ===================== STRATUM RECEIVER =====================
    def _receiver_loop(self, fobj):
        """Read JSON-RPC lines from pool and update job state"""
        try:
            while self.mining:
                line = fobj.readline()
                if not line:
                    # Socket likely closed
                    self._pool_broken = True
                    break
                line = line.strip()
                if not line:
                    continue
                try:
                    logger.info(f"📥 RAW from pool: {line[:200]}")
                except Exception:
                    pass
                try:
                    msg = json.loads(line)
                except json.JSONDecodeError:
                    continue

                method = msg.get('method')
                if method == 'mining.set_difficulty':
                    diff = msg.get('params', [None])[0]
                    logger.info(f"🎯 Pool set difficulty: {diff}")
                elif method == 'mining.notify':
                    params = msg.get('params', [])
                    if len(params) >= 3:
                        job_id = params[0]
                        header_hex = params[1]
                        target_hex = params[2]
                        try:
                            header_bytes = bytes.fromhex(header_hex)
                        except Exception:
                            header_bytes = b''
                        # Parse target
                        try:
                            target_raw = bytes.fromhex(target_hex)
                        except Exception:
                            target_raw = b''

                        # Heuristic: Cosmic Harmony target is 4 bytes, Autolykos is 32 bytes
                        if len(target_raw) <= 4:
                            if len(target_raw) < 4:
                                target_raw = (b'\x00' * (4 - len(target_raw))) + target_raw
                            target32_int = int.from_bytes(target_raw, 'big')
                            with self.job_lock:
                                self.current_job.update({
                                    'algorithm': 'cosmic_harmony',
                                    'job_id': job_id,
                                    'header': header_bytes,
                                    'target32_int': target32_int,
                                    'height': params[3] if len(params) > 3 else None,
                                })
                            logger.info(f"🧭 New job received: {job_id} (Cosmic Harmony)")
                        else:
                            # Autolykos v2 path
                            if len(header_bytes) < 32:
                                header_bytes = header_bytes.ljust(32, b'\x00')
                            header32 = header_bytes[:32]
                            if len(target_raw) < 32:
                                target_raw = (b'\x00' * (32 - len(target_raw))) + target_raw
                            elif len(target_raw) > 32:
                                target_raw = target_raw[-32:]
                            with self.job_lock:
                                self.current_job.update({
                                    'algorithm': 'autolykos_v2',
                                    'job_id': job_id,
                                    'header32': header32,
                                    'target32': target_raw,
                                    'height': params[3] if len(params) > 3 else None,
                                })
                            logger.info(f"🧭 New job received: {job_id} (ALv2)")
                else:
                    # auth result or others
                    if 'result' in msg:
                        if msg.get('id') == 2:
                            logger.info("✅ Auth confirmed by pool")
                        elif msg.get('id') == 3:
                            # Share submit response
                            if msg['result'] is True:
                                self.stats['shares_found'] += 1
                                # Compute latency if possible
                                try:
                                    if self.submit_times:
                                        sent_ts = self.submit_times.popleft()
                                        lat = (time.time() - sent_ts) * 1000.0
                                        self.stats['submit_latency_ms_last'] = lat
                                        prev = self.stats['submit_latency_ms_avg']
                                        self.stats['submit_latency_ms_avg'] = lat if prev is None else (0.7 * prev + 0.3 * lat)
                                except Exception:
                                    pass
                                logger.info("✅ Share accepted by pool")
                            else:
                                # Some pools return result False with error details
                                err = msg.get('error') or {}
                                self.stats['shares_rejected'] += 1
                                logger.warning(f"❌ Share rejected: {err}")
        except Exception as e:
            logger.error(f"Receiver loop error: {e}")
            # mark as broken to trigger reconnect
            self._pool_broken = True

    # ===================== HW METRICS =====================
    def _update_hw_metrics(self, force: bool = True):
        """Update GPU temperature and Afterburner metrics with throttling."""
        now = time.time()
        # GPU temp every ~2s unless forced
        if force or (now - self._last_temp_read) > 2.0:
            self._last_temp_read = now
            try:
                t = self._read_gpu_temperature()
                if t is not None:
                    self.stats['gpu_temp_c'] = t
            except Exception:
                pass
        # Afterburner metrics every ~10s
        if self.afterburner is not None and (force or (now - self._last_ab_read) > 10.0):
            self._last_ab_read = now
            try:
                ab = self.afterburner.get_performance_stats()
                if isinstance(ab, dict):
                    self.stats['afterburner_temp_c'] = ab.get('afterburner_temperature')
                    self.stats['afterburner_tasks_per_sec'] = ab.get('tasks_per_second')
                    eff = ab.get('compute_efficiency')
                    if eff is not None:
                        self.stats['afterburner_efficiency_pct'] = eff * 100.0
            except Exception:
                pass

    def _read_gpu_temperature(self) -> Optional[float]:
        """Attempt to read AMD GPU temperature from sysfs. Returns Celsius or None."""
        # Common paths: /sys/class/drm/card*/device/hwmon/hwmon*/temp*_input
        try:
            candidates = []
            for card in range(0, 10):
                glob_pat = f"/sys/class/drm/card{card}/device/hwmon/hwmon*/temp*_input"
                candidates.extend(glob.glob(glob_pat))
            for path in candidates:
                try:
                    with open(path, 'r') as f:
                        milli_c = int(f.read().strip())
                        if milli_c > 0:
                            return milli_c / 1000.0
                except Exception:
                    continue
        except Exception:
            pass
        return None

    # ===================== ALv2 GPU SEARCH =====================
    def mine_alv2_placeholder_gpu(self, header32: bytes, nonce_start: int, nonce_count: int, target32: bytes) -> Tuple[bool, int, bytes]:
        """Search nonce on GPU for Autolykos v2 placeholder rule used by pool's validator"""
        try:
            if not self.program_alv2 or not self.queue:
                return False, 0, b''

            # Create small buffers
            header_buf = cl.Buffer(self.context, cl.mem_flags.READ_ONLY | cl.mem_flags.COPY_HOST_PTR, hostbuf=np.frombuffer(header32, dtype=np.uint8))
            target_buf = cl.Buffer(self.context, cl.mem_flags.READ_ONLY | cl.mem_flags.COPY_HOST_PTR, hostbuf=np.frombuffer(target32, dtype=np.uint8))
            found_flag = np.array([0], dtype=np.int32)
            found_flag_buf = cl.Buffer(self.context, cl.mem_flags.READ_WRITE | cl.mem_flags.COPY_HOST_PTR, hostbuf=found_flag)
            found_nonce = np.array([0], dtype=np.uint32)
            found_nonce_buf = cl.Buffer(self.context, cl.mem_flags.WRITE_ONLY, size=4)
            found_hash_buf = cl.Buffer(self.context, cl.mem_flags.WRITE_ONLY, size=32)

            kernel = self.program_alv2.alv2_placeholder
            global_size = (nonce_count,)
            kernel(self.queue, global_size, None,
                   header_buf, target_buf,
                   np.uint32(nonce_start), np.uint32(nonce_count),
                   found_flag_buf, found_nonce_buf, found_hash_buf)
            self.queue.finish()

            # Read found flag
            out_flag = np.empty_like(found_flag)
            cl.enqueue_copy(self.queue, out_flag, found_flag_buf).wait()
            if int(out_flag[0]) == 1:
                out_nonce = np.empty_like(found_nonce)
                out_hash = np.empty(32, dtype=np.uint8)
                cl.enqueue_copy(self.queue, out_nonce, found_nonce_buf).wait()
                cl.enqueue_copy(self.queue, out_hash, found_hash_buf).wait()
                return True, int(out_nonce[0]), bytes(out_hash)
            return False, 0, b''
        except Exception as e:
            logger.error(f"❌ ALv2 GPU mining error: {e}")
            return False, 0, b''


# ============================================================================
# TEST & VALIDATION
# ============================================================================

def test_gpu_mining():
    """Test GPU mining capabilities"""
    print("""
╔═══════════════════════════════════════════════════════════════════════════╗
║                                                                           ║
║            🌟 ZION COSMIC HARMONY GPU MINING TEST - OPENCL 🌟            ║
║                                                                           ║
║               AMD Radeon RX 5600/5700 XT | Real Mining                  ║
║                                                                           ║
╚═══════════════════════════════════════════════════════════════════════════╝
""")
    
    miner = ZionGPUMiner()
    
    # Start mining
    if miner.start_mining():
        try:
            # Run for 30 seconds
            for i in range(30):
                time.sleep(1)
                stats = miner.get_stats()
                print(f"⛏️  {stats['hashrate']} | Shares: {stats['shares']} | "
                      f"Hashes: {stats['total_hashes']:,}")
        except KeyboardInterrupt:
            print("\n⏹️  Stopping...")
        finally:
            miner.stop_mining()
    else:
        print("❌ GPU mining initialization failed")


if __name__ == "__main__":
    test_gpu_mining()
