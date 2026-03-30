"""
ZION Algorithm Benchmarker
============================
Benchmarks all mining algorithms (Cosmic Harmony, RandomX, Yescrypt, Autolykos v2)
and stores results for profitability calculation.

Author: ZION TerraNova
License: MIT
"""

import asyncio
import json
import logging
import os
import sqlite3
import subprocess
import time
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

try:
    import psutil
    PSUTIL_AVAILABLE = True
except ImportError:
    PSUTIL_AVAILABLE = False
    logging.warning("psutil not available - power monitoring limited")

# Handle both package and standalone imports
try:
    from .hardware_detector import HardwareDetector, HardwareProfile
except ImportError:
    from hardware_detector import HardwareDetector, HardwareProfile


logger = logging.getLogger(__name__)


@dataclass
class BenchmarkResult:
    """Single benchmark result"""
    algorithm: str
    hardware_id: str  # Hash of hardware profile
    hashrate: float  # H/s
    power_watts: Optional[float]  # W
    temperature: Optional[float]  # °C
    threads: int
    gpu_id: Optional[int]
    duration_seconds: int
    timestamp: datetime
    success: bool
    error: Optional[str] = None

    def to_dict(self) -> Dict:
        """Convert to dictionary"""
        d = asdict(self)
        d['timestamp'] = self.timestamp.isoformat()
        return d

    @classmethod
    def from_dict(cls, data: Dict) -> 'BenchmarkResult':
        """Create from dictionary"""
        data['timestamp'] = datetime.fromisoformat(data['timestamp'])
        return cls(**data)


class AlgorithmBenchmarker:
    """Benchmarks all ZION mining algorithms"""
    
    # Benchmark durations (seconds)
    SHORT_BENCHMARK = 30
    MEDIUM_BENCHMARK = 60
    LONG_BENCHMARK = 300
    
    # Re-benchmark triggers
    REBENCHMARK_DAYS = 7  # Weekly re-benchmark
    
    def __init__(
        self,
        data_dir: str = "data/benchmarks",
        zion_root: Optional[str] = None
    ):
        """
        Initialize benchmarker
        
        Args:
            data_dir: Directory for benchmark database
            zion_root: ZION project root (auto-detected if None)
        """
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        
        self.db_path = self.data_dir / "benchmarks.db"
        self.hardware = HardwareDetector()
        
        # Auto-detect ZION root
        if zion_root is None:
            zion_root = Path(__file__).parent.parent.parent.parent
        self.zion_root = Path(zion_root)
        
        # Initialize database
        self._init_database()
        
        logger.info(f"Algorithm benchmarker initialized (DB: {self.db_path})")
    
    def _init_database(self):
        """Initialize SQLite database"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS benchmarks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                algorithm TEXT NOT NULL,
                hardware_id TEXT NOT NULL,
                hashrate REAL NOT NULL,
                power_watts REAL,
                temperature REAL,
                threads INTEGER NOT NULL,
                gpu_id INTEGER,
                duration_seconds INTEGER NOT NULL,
                timestamp TEXT NOT NULL,
                success INTEGER NOT NULL,
                error TEXT,
                UNIQUE(algorithm, hardware_id, threads, gpu_id)
            )
        """)
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_algo_hw 
            ON benchmarks(algorithm, hardware_id)
        """)
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_timestamp 
            ON benchmarks(timestamp DESC)
        """)
        
        conn.commit()
        conn.close()
        
        logger.info("Benchmark database initialized")
    
    def get_hardware_id(self) -> str:
        """Get stable hardware ID (hash of hardware profile)"""
        profile = self.hardware.detect()
        
        # Create stable ID from key hardware features
        hw_string = f"{profile.cpu.model}_{profile.cpu.cores_physical}_{profile.cpu.cores_logical}"
        
        if profile.gpus:
            for gpu in profile.gpus:
                hw_string += f"_{gpu.name}_{gpu.vram_mb}"
        
        # Simple hash (for stable ID across runs)
        import hashlib
        return hashlib.sha256(hw_string.encode()).hexdigest()[:16]
    
    async def benchmark_cosmic_harmony(
        self,
        threads: Optional[int] = None,
        duration: int = MEDIUM_BENCHMARK
    ) -> BenchmarkResult:
        """
        Benchmark Cosmic Harmony algorithm
        
        Args:
            threads: Number of threads (None = auto-detect)
            duration: Benchmark duration in seconds
        
        Returns:
            BenchmarkResult
        """
        profile = self.hardware.detect()
        if threads is None:
            threads = self.hardware.get_optimal_thread_count("cosmic_harmony")
        
        hw_id = self.get_hardware_id()
        
        # Path to Cosmic Harmony library
        lib_path = self.zion_root / "build_zion" / "libcosmic_harmony.so"
        
        if not lib_path.exists():
            logger.error(f"Cosmic Harmony library not found: {lib_path}")
            return BenchmarkResult(
                algorithm="cosmic_harmony",
                hardware_id=hw_id,
                hashrate=0.0,
                power_watts=None,
                temperature=None,
                threads=threads,
                gpu_id=None,
                duration_seconds=duration,
                timestamp=datetime.now(),
                success=False,
                error="Library not found"
            )
        
        logger.info(f"Benchmarking Cosmic Harmony ({threads} threads, {duration}s)...")
        
        # Run benchmark via Python test harness
        test_script = f"""
import ctypes
import time
from pathlib import Path

lib = ctypes.CDLL("{lib_path}")
lib.cosmic_harmony_hash.argtypes = [ctypes.c_char_p, ctypes.c_size_t, ctypes.POINTER(ctypes.c_ubyte)]
lib.cosmic_harmony_hash.restype = None

# Test data
data = b"ZION_BENCHMARK_" + str(time.time()).encode()
output = (ctypes.c_ubyte * 32)()

# Warmup
for _ in range(100):
    lib.cosmic_harmony_hash(data, len(data), output)

# Benchmark
start = time.time()
count = 0
while time.time() - start < {duration}:
    lib.cosmic_harmony_hash(data, len(data), output)
    count += 1

elapsed = time.time() - start
hashrate = count / elapsed
print(f"HASHRATE:{{hashrate:.2f}}")
"""
        
        try:
            # Start power monitoring
            power_start = self._get_system_power() if PSUTIL_AVAILABLE else None
            temp_start = self._get_cpu_temp() if PSUTIL_AVAILABLE else None
            
            # Run benchmark
            result = subprocess.run(
                ["python3", "-c", test_script],
                capture_output=True,
                text=True,
                timeout=duration + 10
            )
            
            # End power monitoring
            power_end = self._get_system_power() if PSUTIL_AVAILABLE else None
            temp_end = self._get_cpu_temp() if PSUTIL_AVAILABLE else None
            
            # Parse hashrate
            hashrate = 0.0
            for line in result.stdout.split('\n'):
                if line.startswith("HASHRATE:"):
                    hashrate = float(line.split(':')[1])
                    break
            
            # Calculate average power
            power_watts = None
            if power_start is not None and power_end is not None:
                power_watts = (power_start + power_end) / 2.0
            
            # Get max temperature
            temperature = temp_end if temp_end else None
            
            return BenchmarkResult(
                algorithm="cosmic_harmony",
                hardware_id=hw_id,
                hashrate=hashrate,
                power_watts=power_watts,
                temperature=temperature,
                threads=threads,
                gpu_id=None,
                duration_seconds=duration,
                timestamp=datetime.now(),
                success=hashrate > 0
            )
            
        except subprocess.TimeoutExpired:
            logger.error("Benchmark timeout")
            return BenchmarkResult(
                algorithm="cosmic_harmony",
                hardware_id=hw_id,
                hashrate=0.0,
                power_watts=None,
                temperature=None,
                threads=threads,
                gpu_id=None,
                duration_seconds=duration,
                timestamp=datetime.now(),
                success=False,
                error="Timeout"
            )
        except Exception as e:
            logger.error(f"Benchmark failed: {e}")
            return BenchmarkResult(
                algorithm="cosmic_harmony",
                hardware_id=hw_id,
                hashrate=0.0,
                power_watts=None,
                temperature=None,
                threads=threads,
                gpu_id=None,
                duration_seconds=duration,
                timestamp=datetime.now(),
                success=False,
                error=str(e)
            )
    
    async def benchmark_randomx(
        self,
        threads: Optional[int] = None,
        duration: int = MEDIUM_BENCHMARK
    ) -> BenchmarkResult:
        """Benchmark RandomX algorithm"""
        profile = self.hardware.detect()
        if threads is None:
            threads = self.hardware.get_optimal_thread_count("randomx")
        
        hw_id = self.get_hardware_id()
        lib_path = self.zion_root / "build_zion" / "librandomx.so"
        
        if not lib_path.exists():
            logger.error(f"RandomX library not found: {lib_path}")
            return BenchmarkResult(
                algorithm="randomx",
                hardware_id=hw_id,
                hashrate=0.0,
                power_watts=None,
                temperature=None,
                threads=threads,
                gpu_id=None,
                duration_seconds=duration,
                timestamp=datetime.now(),
                success=False,
                error="Library not found"
            )
        
        logger.info(f"Benchmarking RandomX ({threads} threads, {duration}s)...")
        
        # Run benchmark via Python test harness (same pattern as Cosmic Harmony)
        test_script = f"""
import ctypes
import time
from pathlib import Path

# Load RandomX library
lib = ctypes.CDLL("{lib_path}")

# RandomX function signatures (based on randomx.h)
# void randomx_hash(const void* input, size_t inputSize, void* output)
lib.randomx_hash.argtypes = [ctypes.c_void_p, ctypes.c_size_t, ctypes.c_void_p]
lib.randomx_hash.restype = None

# Test data
data = b"ZION_RANDOMX_BENCHMARK_" + str(time.time()).encode()
output = (ctypes.c_ubyte * 32)()

# Warmup
for _ in range(50):
    lib.randomx_hash(data, len(data), output)

# Benchmark
start = time.time()
count = 0
while time.time() - start < {duration}:
    lib.randomx_hash(data, len(data), output)
    count += 1

elapsed = time.time() - start
hashrate = count / elapsed
print(f"HASHRATE:{{hashrate:.2f}}")
"""
        
        try:
            # Start power monitoring
            power_start = self._get_system_power() if PSUTIL_AVAILABLE else None
            temp_start = self._get_cpu_temp() if PSUTIL_AVAILABLE else None
            
            # Run benchmark
            result = subprocess.run(
                ["python3", "-c", test_script],
                capture_output=True,
                text=True,
                timeout=duration + 10
            )
            
            # End power monitoring
            power_end = self._get_system_power() if PSUTIL_AVAILABLE else None
            temp_end = self._get_cpu_temp() if PSUTIL_AVAILABLE else None
            
            # Parse hashrate
            hashrate = 0.0
            for line in result.stdout.split('\n'):
                if line.startswith("HASHRATE:"):
                    hashrate = float(line.split(':')[1])
                    break
            
            # Check for errors
            if result.returncode != 0 or hashrate == 0.0:
                error_msg = result.stderr if result.stderr else "Unknown error"
                logger.error(f"RandomX benchmark failed: {error_msg}")
                return BenchmarkResult(
                    algorithm="randomx",
                    hardware_id=hw_id,
                    hashrate=0.0,
                    power_watts=None,
                    temperature=None,
                    threads=threads,
                    gpu_id=None,
                    duration_seconds=duration,
                    timestamp=datetime.now(),
                    success=False,
                    error=error_msg
                )
            
            # Calculate average power
            power_watts = None
            if power_start is not None and power_end is not None:
                power_watts = (power_start + power_end) / 2.0
            
            # Get max temperature
            temperature = temp_end if temp_end else None
            
            return BenchmarkResult(
                algorithm="randomx",
                hardware_id=hw_id,
                hashrate=hashrate,
                power_watts=power_watts,
                temperature=temperature,
                threads=threads,
                gpu_id=None,
                duration_seconds=duration,
                timestamp=datetime.now(),
                success=True
            )
            
        except subprocess.TimeoutExpired:
            logger.error("RandomX benchmark timeout")
            return BenchmarkResult(
                algorithm="randomx",
                hardware_id=hw_id,
                hashrate=0.0,
                power_watts=None,
                temperature=None,
                threads=threads,
                gpu_id=None,
                duration_seconds=duration,
                timestamp=datetime.now(),
                success=False,
                error="Timeout"
            )
        except Exception as e:
            logger.error(f"RandomX benchmark failed: {e}")
            return BenchmarkResult(
                algorithm="randomx",
                hardware_id=hw_id,
                hashrate=0.0,
                power_watts=None,
                temperature=None,
                threads=threads,
                gpu_id=None,
                duration_seconds=duration,
                timestamp=datetime.now(),
                success=False,
                error=str(e)
            )
    
    async def benchmark_yescrypt(
        self,
        threads: Optional[int] = None,
        duration: int = MEDIUM_BENCHMARK
    ) -> BenchmarkResult:
        """Benchmark Yescrypt algorithm"""
        profile = self.hardware.detect()
        if threads is None:
            threads = self.hardware.get_optimal_thread_count("yescrypt")
        
        hw_id = self.get_hardware_id()
        lib_path = self.zion_root / "build_zion" / "libyescrypt.so"
        
        if not lib_path.exists():
            logger.error(f"Yescrypt library not found: {lib_path}")
            return BenchmarkResult(
                algorithm="yescrypt",
                hardware_id=hw_id,
                hashrate=0.0,
                power_watts=None,
                temperature=None,
                threads=threads,
                gpu_id=None,
                duration_seconds=duration,
                timestamp=datetime.now(),
                success=False,
                error="Library not found"
            )
        
        logger.info(f"Benchmarking Yescrypt ({threads} threads, {duration}s)...")
        
        # Run benchmark via Python test harness (same pattern as others)
        test_script = f"""
import ctypes
import time
from pathlib import Path

# Load Yescrypt library
lib = ctypes.CDLL("{lib_path}")

# Yescrypt function signature (based on yescrypt.h)
# int yescrypt_hash(const char* input, size_t inputSize, char* output)
lib.yescrypt_hash.argtypes = [ctypes.c_char_p, ctypes.c_size_t, ctypes.POINTER(ctypes.c_ubyte)]
lib.yescrypt_hash.restype = ctypes.c_int

# Test data
data = b"ZION_YESCRYPT_BENCHMARK_" + str(time.time()).encode()
output = (ctypes.c_ubyte * 32)()

# Warmup
for _ in range(50):
    lib.yescrypt_hash(data, len(data), output)

# Benchmark
start = time.time()
count = 0
while time.time() - start < {duration}:
    lib.yescrypt_hash(data, len(data), output)
    count += 1

elapsed = time.time() - start
hashrate = count / elapsed
print(f"HASHRATE:{{hashrate:.2f}}")
"""
        
        try:
            # Start power monitoring
            power_start = self._get_system_power() if PSUTIL_AVAILABLE else None
            temp_start = self._get_cpu_temp() if PSUTIL_AVAILABLE else None
            
            # Run benchmark
            result = subprocess.run(
                ["python3", "-c", test_script],
                capture_output=True,
                text=True,
                timeout=duration + 10
            )
            
            # End power monitoring
            power_end = self._get_system_power() if PSUTIL_AVAILABLE else None
            temp_end = self._get_cpu_temp() if PSUTIL_AVAILABLE else None
            
            # Parse hashrate
            hashrate = 0.0
            for line in result.stdout.split('\n'):
                if line.startswith("HASHRATE:"):
                    hashrate = float(line.split(':')[1])
                    break
            
            # Check for errors
            if result.returncode != 0 or hashrate == 0.0:
                error_msg = result.stderr if result.stderr else "Unknown error"
                logger.error(f"Yescrypt benchmark failed: {error_msg}")
                return BenchmarkResult(
                    algorithm="yescrypt",
                    hardware_id=hw_id,
                    hashrate=0.0,
                    power_watts=None,
                    temperature=None,
                    threads=threads,
                    gpu_id=None,
                    duration_seconds=duration,
                    timestamp=datetime.now(),
                    success=False,
                    error=error_msg
                )
            
            # Calculate average power
            power_watts = None
            if power_start is not None and power_end is not None:
                power_watts = (power_start + power_end) / 2.0
            
            # Get max temperature
            temperature = temp_end if temp_end else None
            
            return BenchmarkResult(
                algorithm="yescrypt",
                hardware_id=hw_id,
                hashrate=hashrate,
                power_watts=power_watts,
                temperature=temperature,
                threads=threads,
                gpu_id=None,
                duration_seconds=duration,
                timestamp=datetime.now(),
                success=True
            )
            
        except subprocess.TimeoutExpired:
            logger.error("Yescrypt benchmark timeout")
            return BenchmarkResult(
                algorithm="yescrypt",
                hardware_id=hw_id,
                hashrate=0.0,
                power_watts=None,
                temperature=None,
                threads=threads,
                gpu_id=None,
                duration_seconds=duration,
                timestamp=datetime.now(),
                success=False,
                error="Timeout"
            )
        except Exception as e:
            logger.error(f"Yescrypt benchmark failed: {e}")
            return BenchmarkResult(
                algorithm="yescrypt",
                hardware_id=hw_id,
                hashrate=0.0,
                power_watts=None,
                temperature=None,
                threads=threads,
                gpu_id=None,
                duration_seconds=duration,
                timestamp=datetime.now(),
                success=False,
                error=str(e)
            )
    
    async def benchmark_autolykos(
        self,
        gpu_id: int = 0,
        duration: int = MEDIUM_BENCHMARK
    ) -> BenchmarkResult:
        """Benchmark Autolykos v2 (GPU) algorithm"""
        profile = self.hardware.detect()
        hw_id = self.get_hardware_id()
        
        if not profile.gpus:
            logger.warning("No GPUs detected - skipping Autolykos benchmark")
            return BenchmarkResult(
                algorithm="autolykos",
                hardware_id=hw_id,
                hashrate=0.0,
                power_watts=None,
                temperature=None,
                threads=1,
                gpu_id=gpu_id,
                duration_seconds=duration,
                timestamp=datetime.now(),
                success=False,
                error="No GPU available"
            )
        
        if gpu_id >= len(profile.gpus):
            logger.error(f"GPU {gpu_id} not found (only {len(profile.gpus)} GPUs available)")
            return BenchmarkResult(
                algorithm="autolykos",
                hardware_id=hw_id,
                hashrate=0.0,
                power_watts=None,
                temperature=None,
                threads=1,
                gpu_id=gpu_id,
                duration_seconds=duration,
                timestamp=datetime.now(),
                success=False,
                error=f"GPU {gpu_id} not found"
            )
        
        gpu = profile.gpus[gpu_id]
        logger.info(f"Benchmarking Autolykos v2 on {gpu.name} (GPU {gpu_id}, {duration}s)...")
        
        # Check for GPU miner executable
        gpu_miner_path = self.zion_root / "external_miners" / "autolykos_gpu"
        
        if not gpu_miner_path.exists():
            logger.error(f"Autolykos GPU miner not found: {gpu_miner_path}")
            return BenchmarkResult(
                algorithm="autolykos",
                hardware_id=hw_id,
                hashrate=0.0,
                power_watts=None,
                temperature=None,
                threads=1,
                gpu_id=gpu_id,
                duration_seconds=duration,
                timestamp=datetime.now(),
                success=False,
                error="GPU miner not found"
            )
        
        try:
            # Start GPU power/temp monitoring
            power_start = self._get_gpu_power(gpu_id, gpu.type.value) if gpu else None
            temp_start = self._get_gpu_temp(gpu_id, gpu.type.value) if gpu else None
            
            # Run GPU miner benchmark
            # Command: ./autolykos_gpu --benchmark --device {gpu_id} --duration {duration}
            result = subprocess.run(
                [str(gpu_miner_path), "--benchmark", "--device", str(gpu_id), "--duration", str(duration)],
                capture_output=True,
                text=True,
                timeout=duration + 30,
                cwd=str(gpu_miner_path.parent)
            )
            
            # End GPU power/temp monitoring
            power_end = self._get_gpu_power(gpu_id, gpu.type.value) if gpu else None
            temp_end = self._get_gpu_temp(gpu_id, gpu.type.value) if gpu else None
            
            # Parse hashrate from output
            # Expected format: "Hashrate: 8.6 MH/s" or "HASHRATE:8600000.00"
            hashrate = 0.0
            for line in result.stdout.split('\n'):
                if "HASHRATE:" in line:
                    hashrate = float(line.split(':')[1])
                    break
                elif "Hashrate:" in line and "MH/s" in line:
                    # Parse "8.6 MH/s" format
                    parts = line.split()
                    for i, part in enumerate(parts):
                        if part == "Hashrate:" and i + 1 < len(parts):
                            hashrate = float(parts[i + 1]) * 1_000_000  # MH/s to H/s
                            break
                elif "Hashrate:" in line and "kH/s" in line:
                    # Parse "860 kH/s" format
                    parts = line.split()
                    for i, part in enumerate(parts):
                        if part == "Hashrate:" and i + 1 < len(parts):
                            hashrate = float(parts[i + 1]) * 1_000  # kH/s to H/s
                            break
            
            # Check for errors
            if result.returncode != 0 or hashrate == 0.0:
                error_msg = result.stderr if result.stderr else "Unknown error"
                logger.error(f"Autolykos GPU benchmark failed: {error_msg}")
                return BenchmarkResult(
                    algorithm="autolykos",
                    hardware_id=hw_id,
                    hashrate=0.0,
                    power_watts=None,
                    temperature=None,
                    threads=1,
                    gpu_id=gpu_id,
                    duration_seconds=duration,
                    timestamp=datetime.now(),
                    success=False,
                    error=error_msg
                )
            
            # Calculate average power
            power_watts = None
            if power_start is not None and power_end is not None:
                power_watts = (power_start + power_end) / 2.0
            
            # Get max temperature
            temperature = temp_end if temp_end else None
            
            return BenchmarkResult(
                algorithm="autolykos",
                hardware_id=hw_id,
                hashrate=hashrate,
                power_watts=power_watts,
                temperature=temperature,
                threads=1,
                gpu_id=gpu_id,
                duration_seconds=duration,
                timestamp=datetime.now(),
                success=True
            )
            
        except subprocess.TimeoutExpired:
            logger.error("Autolykos GPU benchmark timeout")
            return BenchmarkResult(
                algorithm="autolykos",
                hardware_id=hw_id,
                hashrate=0.0,
                power_watts=None,
                temperature=None,
                threads=1,
                gpu_id=gpu_id,
                duration_seconds=duration,
                timestamp=datetime.now(),
                success=False,
                error="Timeout"
            )
        except Exception as e:
            logger.error(f"Autolykos GPU benchmark failed: {e}")
            return BenchmarkResult(
                algorithm="autolykos",
                hardware_id=hw_id,
                hashrate=0.0,
                power_watts=None,
                temperature=None,
                threads=1,
                gpu_id=gpu_id,
                duration_seconds=duration,
                timestamp=datetime.now(),
                success=False,
                error=str(e)
            )
    
    async def benchmark_all(
        self,
        duration: int = MEDIUM_BENCHMARK,
        save: bool = True
    ) -> List[BenchmarkResult]:
        """
        Benchmark all algorithms
        
        Args:
            duration: Benchmark duration per algorithm
            save: Save results to database
        
        Returns:
            List of benchmark results
        """
        logger.info("Starting full benchmark suite...")
        
        results = []
        
        # CPU algorithms
        results.append(await self.benchmark_cosmic_harmony(duration=duration))
        results.append(await self.benchmark_randomx(duration=duration))
        results.append(await self.benchmark_yescrypt(duration=duration))
        
        # GPU algorithm (if available)
        profile = self.hardware.detect()
        if profile.gpus:
            for i, gpu in enumerate(profile.gpus):
                results.append(await self.benchmark_autolykos(gpu_id=i, duration=duration))
        
        # Save to database
        if save:
            for result in results:
                self.save_result(result)
        
        logger.info(f"Benchmark complete: {len(results)} algorithms tested")
        return results
    
    def save_result(self, result: BenchmarkResult):
        """Save benchmark result to database"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Replace existing result for this hardware/algorithm/threads
        cursor.execute("""
            INSERT OR REPLACE INTO benchmarks (
                algorithm, hardware_id, hashrate, power_watts, temperature,
                threads, gpu_id, duration_seconds, timestamp, success, error
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            result.algorithm,
            result.hardware_id,
            result.hashrate,
            result.power_watts,
            result.temperature,
            result.threads,
            result.gpu_id,
            result.duration_seconds,
            result.timestamp.isoformat(),
            1 if result.success else 0,
            result.error
        ))
        
        conn.commit()
        conn.close()
        
        logger.info(f"Saved benchmark: {result.algorithm} @ {result.hashrate:.2f} H/s")
    
    def get_latest_results(self, algorithm: Optional[str] = None) -> List[BenchmarkResult]:
        """
        Get latest benchmark results
        
        Args:
            algorithm: Filter by algorithm (None = all)
        
        Returns:
            List of benchmark results
        """
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        if algorithm:
            cursor.execute("""
                SELECT * FROM benchmarks 
                WHERE algorithm = ? AND hardware_id = ?
                ORDER BY timestamp DESC 
                LIMIT 1
            """, (algorithm, self.get_hardware_id()))
        else:
            cursor.execute("""
                SELECT * FROM benchmarks 
                WHERE hardware_id = ?
                ORDER BY timestamp DESC
            """, (self.get_hardware_id(),))
        
        results = []
        for row in cursor.fetchall():
            results.append(BenchmarkResult(
                algorithm=row[1],
                hardware_id=row[2],
                hashrate=row[3],
                power_watts=row[4],
                temperature=row[5],
                threads=row[6],
                gpu_id=row[7],
                duration_seconds=row[8],
                timestamp=datetime.fromisoformat(row[9]),
                success=bool(row[10]),
                error=row[11]
            ))
        
        conn.close()
        return results
    
    def needs_rebenchmark(self) -> bool:
        """Check if re-benchmark is needed"""
        results = self.get_latest_results()
        
        if not results:
            return True  # No benchmarks yet
        
        # Check if any benchmark is older than REBENCHMARK_DAYS
        for result in results:
            age_days = (datetime.now() - result.timestamp).days
            if age_days > self.REBENCHMARK_DAYS:
                logger.info(f"Benchmark for {result.algorithm} is {age_days} days old - re-benchmark needed")
                return True
        
        return False
    
    def get_best_algorithm(self) -> Optional[str]:
        """Get algorithm with highest hashrate"""
        results = self.get_latest_results()
        
        if not results:
            return None
        
        # Filter successful results
        successful = [r for r in results if r.success]
        
        if not successful:
            return None
        
        # Find highest hashrate
        best = max(successful, key=lambda r: r.hashrate)
        return best.algorithm
    
    def _get_system_power(self) -> Optional[float]:
        """Get current system power draw (Watts)"""
        if not PSUTIL_AVAILABLE:
            return None
        
        try:
            # Try reading RAPL (Linux)
            rapl_path = Path("/sys/class/powercap/intel-rapl:0/energy_uj")
            if rapl_path.exists():
                energy_uj = int(rapl_path.read_text().strip())
                # Convert microjoules to watts (simplified - needs time sampling)
                return energy_uj / 1_000_000.0
        except:
            pass
        
        # Fallback: estimate from CPU usage
        try:
            cpu_percent = psutil.cpu_percent(interval=1)
            # Rough estimate: 100W TDP CPU at 100% = 100W
            return cpu_percent  # Simplified
        except:
            return None
    
    def _get_gpu_power(self, gpu_id: int, gpu_type: str) -> Optional[float]:
        """
        Get GPU power draw (Watts)
        
        Args:
            gpu_id: GPU device ID
            gpu_type: 'cuda' or 'hip'
        
        Returns:
            Power draw in Watts, or None if unavailable
        """
        try:
            if gpu_type == "cuda":
                # NVIDIA: use nvidia-smi
                result = subprocess.run(
                    ["nvidia-smi", "-i", str(gpu_id), "--query-gpu=power.draw", "--format=csv,noheader,nounits"],
                    capture_output=True,
                    text=True,
                    timeout=5
                )
                if result.returncode == 0:
                    return float(result.stdout.strip())
            
            elif gpu_type == "hip":
                # AMD: use rocm-smi
                result = subprocess.run(
                    ["rocm-smi", "-d", str(gpu_id), "--showpower"],
                    capture_output=True,
                    text=True,
                    timeout=5
                )
                if result.returncode == 0:
                    # Parse output for power value
                    for line in result.stdout.split('\n'):
                        if "Average Graphics Package Power" in line:
                            # Extract number (e.g., "120.5 W")
                            parts = line.split()
                            for i, part in enumerate(parts):
                                if part == "W" and i > 0:
                                    return float(parts[i - 1])
        except:
            pass
        
        return None
    
    def _get_gpu_temp(self, gpu_id: int, gpu_type: str) -> Optional[float]:
        """
        Get GPU temperature (Celsius)
        
        Args:
            gpu_id: GPU device ID
            gpu_type: 'cuda' or 'hip'
        
        Returns:
            Temperature in Celsius, or None if unavailable
        """
        try:
            if gpu_type == "cuda":
                # NVIDIA: use nvidia-smi
                result = subprocess.run(
                    ["nvidia-smi", "-i", str(gpu_id), "--query-gpu=temperature.gpu", "--format=csv,noheader,nounits"],
                    capture_output=True,
                    text=True,
                    timeout=5
                )
                if result.returncode == 0:
                    return float(result.stdout.strip())
            
            elif gpu_type == "hip":
                # AMD: use rocm-smi
                result = subprocess.run(
                    ["rocm-smi", "-d", str(gpu_id), "--showtemp"],
                    capture_output=True,
                    text=True,
                    timeout=5
                )
                if result.returncode == 0:
                    # Parse output for temperature
                    for line in result.stdout.split('\n'):
                        if "Temperature" in line or "edge" in line.lower():
                            # Extract number (e.g., "65.0 C")
                            parts = line.split()
                            for i, part in enumerate(parts):
                                if part in ["C", "°C"] and i > 0:
                                    return float(parts[i - 1])
        except:
            pass
        
        return None
    
    def _get_cpu_temp(self) -> Optional[float]:
        """Get CPU temperature (Celsius)"""
        if not PSUTIL_AVAILABLE:
            return None
        
        try:
            temps = psutil.sensors_temperatures()
            
            # Try common sensor names
            for sensor_name in ['coretemp', 'cpu_thermal', 'k10temp']:
                if sensor_name in temps:
                    return temps[sensor_name][0].current
            
            # Fallback: first sensor
            if temps:
                return list(temps.values())[0][0].current
        except:
            return None
        
        return None
    
    def print_results(self, results: Optional[List[BenchmarkResult]] = None):
        """Print benchmark results in a nice format"""
        if results is None:
            results = self.get_latest_results()
        
        if not results:
            print("❌ No benchmark results available")
            return
        
        print("\n" + "="*80)
        print("🎯 ZION Algorithm Benchmark Results")
        print("="*80)
        
        for result in results:
            status = "✅" if result.success else "❌"
            
            print(f"\n{status} {result.algorithm.upper()}")
            print(f"  Hashrate: {result.hashrate:,.2f} H/s")
            print(f"  Threads: {result.threads}")
            
            if result.power_watts:
                print(f"  Power: {result.power_watts:.1f} W")
                
                # Calculate efficiency
                if result.hashrate > 0:
                    efficiency = result.hashrate / result.power_watts
                    print(f"  Efficiency: {efficiency:,.2f} H/W")
            
            if result.temperature:
                print(f"  Temperature: {result.temperature:.1f}°C")
            
            if result.gpu_id is not None:
                print(f"  GPU: #{result.gpu_id}")
            
            print(f"  Duration: {result.duration_seconds}s")
            print(f"  Timestamp: {result.timestamp.strftime('%Y-%m-%d %H:%M:%S')}")
            
            if result.error:
                print(f"  Error: {result.error}")
        
        print("\n" + "="*80)
        
        # Show best algorithm
        best = self.get_best_algorithm()
        if best:
            print(f"\n🏆 Best Algorithm: {best.upper()}")
        
        print()


# Singleton instance
_benchmarker_instance: Optional[AlgorithmBenchmarker] = None


def get_benchmarker() -> AlgorithmBenchmarker:
    """Get singleton benchmarker instance"""
    global _benchmarker_instance
    
    if _benchmarker_instance is None:
        _benchmarker_instance = AlgorithmBenchmarker()
    
    return _benchmarker_instance


async def main():
    """Test benchmarker"""
    logging.basicConfig(
        level=logging.INFO,
        format='%(levelname)s:%(name)s:%(message)s'
    )
    
    benchmarker = get_benchmarker()
    
    # Show hardware profile
    profile = benchmarker.hardware.detect()
    print("\n" + "="*80)
    print("🖥️  Hardware Profile")
    print("="*80)
    print(f"CPU: {profile.cpu.model} ({profile.cpu.cores_physical}C/{profile.cpu.cores_logical}T)")
    print(f"GPUs: {len(profile.gpus)}")
    for i, gpu in enumerate(profile.gpus):
        print(f"  GPU {i}: {gpu.name} ({gpu.vram_mb} MB)")
    print(f"RAM: {profile.memory.total_mb} MB")
    print(f"Hardware ID: {benchmarker.get_hardware_id()}")
    print()
    
    # Check if re-benchmark needed
    if benchmarker.needs_rebenchmark():
        print("⚠️  Benchmark data is outdated - running full benchmark...\n")
        
        # Run short benchmarks for demo
        results = await benchmarker.benchmark_all(
            duration=AlgorithmBenchmarker.SHORT_BENCHMARK,
            save=True
        )
    else:
        print("✅ Benchmark data is up-to-date\n")
        results = benchmarker.get_latest_results()
    
    # Print results
    benchmarker.print_results(results)
    
    # Show best algorithm
    best = benchmarker.get_best_algorithm()
    if best:
        print(f"\n💡 Recommended: Start mining with {best.upper()}")


if __name__ == "__main__":
    asyncio.run(main())
