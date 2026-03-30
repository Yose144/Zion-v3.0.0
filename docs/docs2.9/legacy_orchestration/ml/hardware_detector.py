#!/usr/bin/env python3
"""
ZION AI Orchestrator v3.0 - Hardware Detector

Detects and profiles hardware capabilities for optimal mining algorithm selection:
- CPU: cores, threads, AVX2, AES-NI, architecture
- GPU: CUDA/OpenCL/HIP, VRAM, compute capability
- RAM: total, available
- Disk: I/O speed
- OS: platform, kernel version

Author: ZION Development Team
Version: 3.0.0
Date: 12 listopadu 2025
"""

import logging
import os
import platform
import subprocess
import sys
from dataclasses import dataclass
from enum import Enum
from typing import Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


class GPUType(Enum):
    """Supported GPU types"""
    NVIDIA_CUDA = "nvidia_cuda"
    AMD_HIP = "amd_hip"
    INTEL_OPENCL = "intel_opencl"
    NONE = "none"


@dataclass
class CPUInfo:
    """CPU hardware information"""
    model: str
    cores_physical: int
    cores_logical: int
    architecture: str  # x86_64, arm64, etc.
    vendor: str  # Intel, AMD, Apple
    frequency_mhz: int
    cache_l1_kb: int
    cache_l2_kb: int
    cache_l3_kb: int
    has_avx: bool
    has_avx2: bool
    has_avx512: bool
    has_aes_ni: bool
    has_sse42: bool


@dataclass
class GPUInfo:
    """GPU hardware information"""
    type: GPUType
    name: str
    vram_mb: int
    cuda_version: Optional[str] = None
    compute_capability: Optional[Tuple[int, int]] = None  # (major, minor)
    hip_version: Optional[str] = None
    opencl_version: Optional[str] = None
    driver_version: str = "unknown"
    pci_id: str = "unknown"


@dataclass
class MemoryInfo:
    """RAM information"""
    total_mb: int
    available_mb: int
    swap_total_mb: int
    swap_available_mb: int


@dataclass
class DiskInfo:
    """Disk I/O information"""
    total_gb: int
    available_gb: int
    read_speed_mbps: float  # Estimated
    write_speed_mbps: float  # Estimated
    is_ssd: bool


@dataclass
class HardwareProfile:
    """Complete hardware profile"""
    cpu: CPUInfo
    gpus: List[GPUInfo]
    memory: MemoryInfo
    disk: DiskInfo
    os_name: str
    os_version: str
    kernel: str
    hostname: str
    
    def to_dict(self) -> Dict:
        """Convert to dictionary"""
        return {
            "cpu": {
                "model": self.cpu.model,
                "cores_physical": self.cpu.cores_physical,
                "cores_logical": self.cpu.cores_logical,
                "architecture": self.cpu.architecture,
                "vendor": self.cpu.vendor,
                "frequency_mhz": self.cpu.frequency_mhz,
                "cache_l3_kb": self.cpu.cache_l3_kb,
                "has_avx2": self.cpu.has_avx2,
                "has_aes_ni": self.cpu.has_aes_ni,
            },
            "gpus": [
                {
                    "type": gpu.type.value,
                    "name": gpu.name,
                    "vram_mb": gpu.vram_mb,
                    "cuda_version": gpu.cuda_version,
                    "compute_capability": gpu.compute_capability,
                }
                for gpu in self.gpus
            ],
            "memory": {
                "total_mb": self.memory.total_mb,
                "available_mb": self.memory.available_mb,
            },
            "os": {
                "name": self.os_name,
                "version": self.os_version,
                "kernel": self.kernel,
            },
        }


class HardwareDetector:
    """
    Hardware detection and profiling system
    
    Detects CPU, GPU, RAM, and disk capabilities for optimal
    mining algorithm selection and performance tuning.
    """
    
    def __init__(self):
        """Initialize hardware detector"""
        self.profile: Optional[HardwareProfile] = None
        logger.info("Hardware detector initialized")
    
    def detect(self, force: bool = False) -> HardwareProfile:
        """
        Detect hardware profile
        
        Args:
            force: Force re-detection even if cached
            
        Returns:
            Complete hardware profile
        """
        if self.profile is not None and not force:
            logger.info("Returning cached hardware profile")
            return self.profile
        
        logger.info("Starting hardware detection...")
        
        cpu = self._detect_cpu()
        gpus = self._detect_gpus()
        memory = self._detect_memory()
        disk = self._detect_disk()
        
        self.profile = HardwareProfile(
            cpu=cpu,
            gpus=gpus,
            memory=memory,
            disk=disk,
            os_name=platform.system(),
            os_version=platform.release(),
            kernel=platform.version(),
            hostname=platform.node(),
        )
        
        logger.info(f"Hardware detection complete: {self._summary()}")
        return self.profile
    
    def _detect_cpu(self) -> CPUInfo:
        """Detect CPU information"""
        logger.info("Detecting CPU...")
        
        try:
            import psutil
            
            # Basic info
            cores_physical = psutil.cpu_count(logical=False) or 1
            cores_logical = psutil.cpu_count(logical=True) or cores_physical
            
            # CPU frequency
            freq = psutil.cpu_freq()
            frequency_mhz = int(freq.current) if freq else 2000
            
        except ImportError:
            logger.warning("psutil not available, using platform module")
            cores_logical = os.cpu_count() or 1
            cores_physical = cores_logical // 2
            frequency_mhz = 2000
        
        # Platform info
        architecture = platform.machine()
        processor = platform.processor() or "Unknown"
        
        # Detect vendor
        vendor = "Unknown"
        if "Intel" in processor or "i3" in processor or "i5" in processor or "i7" in processor or "i9" in processor:
            vendor = "Intel"
        elif "AMD" in processor or "Ryzen" in processor or "EPYC" in processor:
            vendor = "AMD"
        elif "Apple" in processor or architecture == "arm64":
            vendor = "Apple"
        
        # Detect CPU features (Linux only for now)
        has_avx = False
        has_avx2 = False
        has_avx512 = False
        has_aes_ni = False
        has_sse42 = False
        
        if platform.system() == "Linux":
            try:
                with open("/proc/cpuinfo", "r") as f:
                    cpuinfo = f.read()
                    has_avx = "avx" in cpuinfo
                    has_avx2 = "avx2" in cpuinfo
                    has_avx512 = "avx512" in cpuinfo
                    has_aes_ni = "aes" in cpuinfo
                    has_sse42 = "sse4_2" in cpuinfo
            except Exception as e:
                logger.warning(f"Failed to read /proc/cpuinfo: {e}")
        
        # Estimate cache sizes (default values)
        cache_l1_kb = 32 * cores_physical  # 32KB per core
        cache_l2_kb = 256 * cores_physical  # 256KB per core
        cache_l3_kb = 0
        
        if vendor == "Intel":
            cache_l3_kb = 2048 * (cores_physical // 2)  # ~2MB per 2 cores
        elif vendor == "AMD":
            cache_l3_kb = 4096 * (cores_physical // 4)  # ~4MB per 4 cores
        
        return CPUInfo(
            model=processor,
            cores_physical=cores_physical,
            cores_logical=cores_logical,
            architecture=architecture,
            vendor=vendor,
            frequency_mhz=frequency_mhz,
            cache_l1_kb=cache_l1_kb,
            cache_l2_kb=cache_l2_kb,
            cache_l3_kb=cache_l3_kb,
            has_avx=has_avx,
            has_avx2=has_avx2,
            has_avx512=has_avx512,
            has_aes_ni=has_aes_ni,
            has_sse42=has_sse42,
        )
    
    def _detect_gpus(self) -> List[GPUInfo]:
        """Detect GPU information"""
        logger.info("Detecting GPUs...")
        gpus = []
        
        # Try NVIDIA CUDA
        nvidia_gpus = self._detect_nvidia_gpus()
        gpus.extend(nvidia_gpus)
        
        # Try AMD HIP/ROCm
        amd_gpus = self._detect_amd_gpus()
        gpus.extend(amd_gpus)
        
        if not gpus:
            logger.info("No GPUs detected")
        else:
            logger.info(f"Detected {len(gpus)} GPU(s)")
        
        return gpus
    
    def _detect_nvidia_gpus(self) -> List[GPUInfo]:
        """Detect NVIDIA GPUs using nvidia-smi"""
        gpus = []
        
        try:
            result = subprocess.run(
                ["nvidia-smi", "--query-gpu=name,memory.total,driver_version,compute_cap", "--format=csv,noheader"],
                capture_output=True,
                text=True,
                timeout=5,
            )
            
            if result.returncode == 0:
                for line in result.stdout.strip().split("\n"):
                    if not line:
                        continue
                    
                    parts = [p.strip() for p in line.split(",")]
                    if len(parts) >= 3:
                        name = parts[0]
                        vram_str = parts[1].replace(" MiB", "").strip()
                        vram_mb = int(vram_str) if vram_str.isdigit() else 0
                        driver = parts[2]
                        
                        # Compute capability (if available)
                        compute_cap = None
                        if len(parts) >= 4 and "." in parts[3]:
                            try:
                                major, minor = parts[3].split(".")
                                compute_cap = (int(major), int(minor))
                            except:
                                pass
                        
                        gpus.append(GPUInfo(
                            type=GPUType.NVIDIA_CUDA,
                            name=name,
                            vram_mb=vram_mb,
                            cuda_version=self._get_cuda_version(),
                            compute_capability=compute_cap,
                            driver_version=driver,
                        ))
                
                logger.info(f"Detected {len(gpus)} NVIDIA GPU(s)")
        
        except (FileNotFoundError, subprocess.TimeoutExpired) as e:
            logger.debug(f"nvidia-smi not available: {e}")
        
        return gpus
    
    def _detect_amd_gpus(self) -> List[GPUInfo]:
        """Detect AMD GPUs using rocm-smi"""
        gpus = []
        
        try:
            result = subprocess.run(
                ["rocm-smi", "--showproductname", "--showmeminfo", "vram"],
                capture_output=True,
                text=True,
                timeout=5,
            )
            
            if result.returncode == 0:
                # Parse rocm-smi output (format varies)
                lines = result.stdout.strip().split("\n")
                name = "AMD GPU"
                vram_mb = 0
                
                for line in lines:
                    if "Card series" in line or "GPU" in line:
                        parts = line.split(":")
                        if len(parts) > 1:
                            name = parts[1].strip()
                    elif "VRAM Total Memory" in line or "Memory" in line:
                        # Try to extract VRAM size
                        import re
                        match = re.search(r"(\d+)\s*MB", line)
                        if match:
                            vram_mb = int(match.group(1))
                
                if vram_mb > 0:  # Only add if we found valid info
                    gpus.append(GPUInfo(
                        type=GPUType.AMD_HIP,
                        name=name,
                        vram_mb=vram_mb,
                        hip_version=self._get_hip_version(),
                    ))
                
                logger.info(f"Detected {len(gpus)} AMD GPU(s)")
        
        except (FileNotFoundError, subprocess.TimeoutExpired) as e:
            logger.debug(f"rocm-smi not available: {e}")
        
        return gpus
    
    def _get_cuda_version(self) -> Optional[str]:
        """Get CUDA version"""
        try:
            result = subprocess.run(
                ["nvcc", "--version"],
                capture_output=True,
                text=True,
                timeout=2,
            )
            if result.returncode == 0:
                import re
                match = re.search(r"release (\d+\.\d+)", result.stdout)
                if match:
                    return match.group(1)
        except:
            pass
        return None
    
    def _get_hip_version(self) -> Optional[str]:
        """Get HIP version"""
        try:
            result = subprocess.run(
                ["hipcc", "--version"],
                capture_output=True,
                text=True,
                timeout=2,
            )
            if result.returncode == 0:
                import re
                match = re.search(r"HIP version: (\d+\.\d+)", result.stdout)
                if match:
                    return match.group(1)
        except:
            pass
        return None
    
    def _detect_memory(self) -> MemoryInfo:
        """Detect RAM information"""
        logger.info("Detecting memory...")
        
        try:
            import psutil
            
            mem = psutil.virtual_memory()
            swap = psutil.swap_memory()
            
            return MemoryInfo(
                total_mb=mem.total // (1024 * 1024),
                available_mb=mem.available // (1024 * 1024),
                swap_total_mb=swap.total // (1024 * 1024),
                swap_available_mb=swap.free // (1024 * 1024),
            )
        
        except ImportError:
            logger.warning("psutil not available, using defaults")
            return MemoryInfo(
                total_mb=8192,  # 8GB default
                available_mb=4096,
                swap_total_mb=8192,
                swap_available_mb=8192,
            )
    
    def _detect_disk(self) -> DiskInfo:
        """Detect disk information"""
        logger.info("Detecting disk...")
        
        try:
            import psutil
            
            disk = psutil.disk_usage("/")
            
            # Check if SSD (Linux only)
            is_ssd = False
            if platform.system() == "Linux":
                try:
                    with open("/sys/block/sda/queue/rotational", "r") as f:
                        is_ssd = f.read().strip() == "0"
                except:
                    pass
            
            # Estimate speeds (can be improved with actual benchmarking)
            read_speed_mbps = 500.0 if is_ssd else 100.0
            write_speed_mbps = 400.0 if is_ssd else 80.0
            
            return DiskInfo(
                total_gb=disk.total // (1024**3),
                available_gb=disk.free // (1024**3),
                read_speed_mbps=read_speed_mbps,
                write_speed_mbps=write_speed_mbps,
                is_ssd=is_ssd,
            )
        
        except ImportError:
            logger.warning("psutil not available, using defaults")
            return DiskInfo(
                total_gb=500,
                available_gb=250,
                read_speed_mbps=100.0,
                write_speed_mbps=80.0,
                is_ssd=False,
            )
    
    def _summary(self) -> str:
        """Generate hardware summary string"""
        if not self.profile:
            return "No profile"
        
        gpu_summary = f"{len(self.profile.gpus)} GPU(s)" if self.profile.gpus else "No GPU"
        
        return (
            f"{self.profile.cpu.cores_physical}C/{self.profile.cpu.cores_logical}T "
            f"{self.profile.cpu.vendor} {self.profile.cpu.architecture}, "
            f"{gpu_summary}, "
            f"{self.profile.memory.total_mb}MB RAM, "
            f"{self.profile.os_name} {self.profile.os_version}"
        )
    
    def get_recommended_algorithms(self) -> List[str]:
        """
        Get recommended mining algorithms based on hardware
        
        Returns:
            List of algorithm names sorted by expected performance
        """
        if not self.profile:
            self.detect()
        
        recommendations = []
        
        # GPU algorithms
        if self.profile.gpus:
            for gpu in self.profile.gpus:
                if gpu.type == GPUType.NVIDIA_CUDA:
                    recommendations.append("autolykos_v2")  # Best for NVIDIA
                elif gpu.type == GPUType.AMD_HIP:
                    recommendations.append("autolykos_v2")  # AMD support added!
        
        # CPU algorithms
        if self.profile.cpu.has_aes_ni:
            recommendations.append("randomx")  # Best with AES-NI
        
        if self.profile.cpu.has_avx2:
            recommendations.append("cosmic_harmony")  # Optimized for AVX2
        
        # Memory-hard algorithm (good for high RAM)
        if self.profile.memory.total_mb >= 4096:
            recommendations.append("yescrypt")
        
        # Fallback
        if not recommendations:
            recommendations = ["randomx", "yescrypt"]
        
        return recommendations
    
    def get_optimal_thread_count(self, algorithm: str) -> int:
        """
        Get optimal thread count for algorithm
        
        Args:
            algorithm: Algorithm name
            
        Returns:
            Recommended thread count
        """
        if not self.profile:
            self.detect()
        
        if algorithm in ["randomx", "yescrypt"]:
            # CPU-intensive algorithms
            # Use physical cores - 1 (leave one for system)
            return max(1, self.profile.cpu.cores_physical - 1)
        
        elif algorithm == "cosmic_harmony":
            # Benefits from hyper-threading
            return max(1, self.profile.cpu.cores_logical - 2)
        
        elif algorithm == "autolykos_v2":
            # GPU algorithm, minimal CPU threads needed
            return min(4, self.profile.cpu.cores_physical)
        
        else:
            # Default
            return max(1, self.profile.cpu.cores_physical // 2)


# Module-level singleton
_detector_instance: Optional[HardwareDetector] = None


def get_hardware_detector() -> HardwareDetector:
    """Get singleton hardware detector instance"""
    global _detector_instance
    if _detector_instance is None:
        _detector_instance = HardwareDetector()
    return _detector_instance


if __name__ == "__main__":
    # Test hardware detection
    logging.basicConfig(level=logging.INFO)
    
    detector = HardwareDetector()
    profile = detector.detect()
    
    print("\n🖥️  ZION Hardware Profile")
    print("=" * 60)
    print(f"\n📊 CPU:")
    print(f"  Model: {profile.cpu.model}")
    print(f"  Cores: {profile.cpu.cores_physical} physical, {profile.cpu.cores_logical} logical")
    print(f"  Vendor: {profile.cpu.vendor}")
    print(f"  Architecture: {profile.cpu.architecture}")
    print(f"  Frequency: {profile.cpu.frequency_mhz} MHz")
    print(f"  Cache L3: {profile.cpu.cache_l3_kb} KB")
    print(f"  Features: AVX2={profile.cpu.has_avx2}, AES-NI={profile.cpu.has_aes_ni}")
    
    print(f"\n🎮 GPUs: {len(profile.gpus)}")
    for i, gpu in enumerate(profile.gpus):
        print(f"  [{i}] {gpu.name}")
        print(f"      Type: {gpu.type.value}")
        print(f"      VRAM: {gpu.vram_mb} MB")
        if gpu.cuda_version:
            print(f"      CUDA: {gpu.cuda_version}")
        if gpu.compute_capability:
            print(f"      Compute: {gpu.compute_capability[0]}.{gpu.compute_capability[1]}")
    
    print(f"\n💾 Memory:")
    print(f"  Total: {profile.memory.total_mb} MB")
    print(f"  Available: {profile.memory.available_mb} MB")
    print(f"  Swap: {profile.memory.swap_total_mb} MB")
    
    print(f"\n💿 Disk:")
    print(f"  Total: {profile.disk.total_gb} GB")
    print(f"  Available: {profile.disk.available_gb} GB")
    print(f"  Type: {'SSD' if profile.disk.is_ssd else 'HDD'}")
    print(f"  Est. Read: {profile.disk.read_speed_mbps:.0f} MB/s")
    
    print(f"\n🖥️  OS:")
    print(f"  System: {profile.os_name} {profile.os_version}")
    print(f"  Hostname: {profile.hostname}")
    
    print(f"\n✨ Recommended Algorithms:")
    recommendations = detector.get_recommended_algorithms()
    for algo in recommendations:
        threads = detector.get_optimal_thread_count(algo)
        print(f"  • {algo} ({threads} threads)")
    
    print("\n" + "=" * 60)
