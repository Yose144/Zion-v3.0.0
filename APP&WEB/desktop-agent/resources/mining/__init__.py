"""
ZION Mining Module - Optimized GPU & CPU Mining

This module provides high-performance mining implementations:
- Cosmic Harmony v1 TURBO: 8.48 GH/s (86x optimized)
- Cosmic Harmony v2 GPU VMEM: 40 kH/s (memory-hard, ASIC-resistant)
- Cosmic Harmony v2 Unified: Auto-selects best backend
- RandomX, Yescrypt support via native libraries

Version: 2.9.6
"""

# Core hashers
try:
    from .cosmic_harmony_wrapper import CosmicHarmonyHasher, get_hasher
except ImportError:
    CosmicHarmonyHasher = None
    get_hasher = None

# v2 Memory-hard implementations
try:
    from .cosmic_harmony_v2 import cosmic_hash_v2
except ImportError:
    cosmic_hash_v2 = None

try:
    from .cosmic_harmony_v2_unified import CosmicHarmonyV2Unified, HasherBackend
except ImportError:
    CosmicHarmonyV2Unified = None
    HasherBackend = None

try:
    from .cosmic_harmony_v2_optimized import CosmicHarmonyV2Optimized
except ImportError:
    CosmicHarmonyV2Optimized = None

try:
    from .cosmic_harmony_v2_native_wrapper import CosmicHarmonyV2Native
except ImportError:
    CosmicHarmonyV2Native = None

# GPU implementations
try:
    from .cosmic_harmony_v1_turbo import CosmicHarmonyV1Turbo, GPU_AVAILABLE as V1_GPU
except ImportError:
    CosmicHarmonyV1Turbo = None
    V1_GPU = False

try:
    from .cosmic_harmony_v2_gpu_vmem import CosmicHarmonyV2GPUVMem, GPU_AVAILABLE as V2_GPU
except ImportError:
    CosmicHarmonyV2GPUVMem = None
    V2_GPU = False

try:
    from .cosmic_harmony_v2_gpu import CosmicHarmonyV2GPU
except ImportError:
    CosmicHarmonyV2GPU = None

# Autolykos support
try:
    from .gpu_autolykos_v2_engine import GPUAutolykosMiner, GPUBackend
except ImportError:
    GPUAutolykosMiner = None
    GPUBackend = None

try:
    from .native_autolykos_wrapper import NativeAutolykosMiner
except ImportError:
    NativeAutolykosMiner = None

__all__ = [
    # v1 hashers
    'CosmicHarmonyHasher',
    'get_hasher',
    # v2 hashers
    'cosmic_hash_v2',
    'CosmicHarmonyV2Unified',
    'CosmicHarmonyV2Optimized',
    'CosmicHarmonyV2Native',
    'HasherBackend',
    # GPU miners
    'CosmicHarmonyV1Turbo',
    'CosmicHarmonyV2GPUVMem',
    'CosmicHarmonyV2GPU',
    'V1_GPU',
    'V2_GPU',
    # Autolykos
    'GPUAutolykosMiner',
    'GPUBackend',
    'NativeAutolykosMiner',
]

__version__ = '2.9.6'
