"""
ZION Machine Learning Module
=============================
AI-powered mining optimization and profitability prediction.

IMPLEMENTATION STATUS:
✅ Hardware Detector: COMPLETE (CPU/GPU/RAM detection)
⚠️  Algorithm Benchmarker: PARTIAL (Cosmic Harmony works, others need implementation)
✅ Profitability Calculator: COMPLETE (price API, rewards calc)
❌ AI Algorithm Selector: SKELETON ONLY
❌ Difficulty Predictor: SKELETON ONLY
❌ Price Predictor: SKELETON ONLY  
❌ Energy Optimizer: SKELETON ONLY

Components marked ❌ will raise NotImplementedError until completed.

Author: ZION TerraNova
License: MIT
"""

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .hardware_detector import HardwareDetector
    from .algorithm_benchmarker import AlgorithmBenchmarker
    from .profitability_calc import ProfitabilityCalculator


# Lazy loading to avoid circular imports
def get_hardware_detector():
    """Get hardware detector instance (✅ COMPLETE)"""
    from .hardware_detector import get_detector
    return get_detector()


def get_algorithm_benchmarker():
    """Get algorithm benchmarker instance (⚠️ PARTIAL - only Cosmic Harmony implemented)"""
    from .algorithm_benchmarker import get_benchmarker
    return get_benchmarker()


def get_profitability_calculator():
    """Get profitability calculator instance (✅ COMPLETE)"""
    from .profitability_calc import get_calculator
    return get_calculator()


def get_ai_selector():
    """Get AI algorithm selector instance (❌ SKELETON - raises NotImplementedError)"""
    from .ai_algorithm_selector import get_selector
    return get_selector()


def get_difficulty_predictor():
    """Get difficulty predictor instance (❌ SKELETON - raises NotImplementedError)"""
    from .difficulty_predictor import get_predictor
    return get_predictor()


def get_price_predictor():
    """Get price predictor instance (❌ SKELETON - raises NotImplementedError)"""
    from .price_predictor import get_price_predictor
    return get_price_predictor()


def get_energy_optimizer():
    """Get energy optimizer instance (❌ SKELETON - raises NotImplementedError)"""
    from .energy_optimizer import get_optimizer
    return get_optimizer()


__all__ = [
    'get_hardware_detector',
    'get_algorithm_benchmarker',
    'get_profitability_calculator',
    'get_ai_selector',
    'get_difficulty_predictor',
    'get_price_predictor',
    'get_energy_optimizer',
]

from typing import Optional

# Version info
__version__ = "3.0.0"
__author__ = "ZION Development Team"

# Import main classes (lazy loading to avoid circular imports)
_hardware_detector = None
_algorithm_benchmarker = None
_ai_selector = None
_difficulty_predictor = None
_price_predictor = None
_energy_optimizer = None
_profitability_calc = None


def get_hardware_detector():
    """Get singleton instance of HardwareDetector"""
    global _hardware_detector
    if _hardware_detector is None:
        from .hardware_detector import HardwareDetector
        _hardware_detector = HardwareDetector()
    return _hardware_detector


def get_algorithm_benchmarker():
    """Get singleton instance of AlgorithmBenchmarker"""
    global _algorithm_benchmarker
    if _algorithm_benchmarker is None:
        from .algorithm_benchmarker import AlgorithmBenchmarker
        _algorithm_benchmarker = AlgorithmBenchmarker()
    return _algorithm_benchmarker


def get_ai_selector():
    """Get singleton instance of AIAlgorithmSelector"""
    global _ai_selector
    if _ai_selector is None:
        from .ai_algorithm_selector import AIAlgorithmSelector
        _ai_selector = AIAlgorithmSelector()
    return _ai_selector


def get_difficulty_predictor():
    """Get singleton instance of DifficultyPredictor"""
    global _difficulty_predictor
    if _difficulty_predictor is None:
        from .difficulty_predictor import DifficultyPredictor
        _difficulty_predictor = DifficultyPredictor()
    return _difficulty_predictor


def get_price_predictor():
    """Get singleton instance of PricePredictor"""
    global _price_predictor
    if _price_predictor is None:
        from .price_predictor import PricePredictor
        _price_predictor = PricePredictor()
    return _price_predictor


def get_energy_optimizer():
    """Get singleton instance of EnergyOptimizer"""
    global _energy_optimizer
    if _energy_optimizer is None:
        from .energy_optimizer import EnergyOptimizer
        _energy_optimizer = EnergyOptimizer()
    return _energy_optimizer


def get_profitability_calculator():
    """Get singleton instance of ProfitabilityCalculator"""
    global _profitability_calc
    if _profitability_calc is None:
        from .profitability_calc import ProfitabilityCalculator
        _profitability_calc = ProfitabilityCalculator()
    return _profitability_calc


__all__ = [
    "get_hardware_detector",
    "get_algorithm_benchmarker",
    "get_ai_selector",
    "get_difficulty_predictor",
    "get_price_predictor",
    "get_energy_optimizer",
    "get_profitability_calculator",
]
