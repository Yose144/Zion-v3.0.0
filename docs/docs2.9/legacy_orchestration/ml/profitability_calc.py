"""
ZION Profitability Calculator
===============================
Real-time profitability calculation for ZION mining.
Fetches ZION price, calculates rewards, subtracts electricity costs.

Author: ZION TerraNova
License: MIT
"""

import asyncio
import json
import logging
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional

try:
    import aiohttp
    AIOHTTP_AVAILABLE = True
except ImportError:
    AIOHTTP_AVAILABLE = False
    logging.warning("aiohttp not available - using fallback prices")

# Handle both package and standalone imports
try:
    from .hardware_detector import HardwareDetector
    from .algorithm_benchmarker import AlgorithmBenchmarker, BenchmarkResult
except ImportError:
    from hardware_detector import HardwareDetector
    from algorithm_benchmarker import AlgorithmBenchmarker, BenchmarkResult


logger = logging.getLogger(__name__)


@dataclass
class ZionPrice:
    """ZION price data"""
    usd: float
    btc: float
    eth: float
    timestamp: datetime
    source: str  # "coingecko", "fallback", etc.
    
    def to_dict(self) -> Dict:
        d = asdict(self)
        d['timestamp'] = self.timestamp.isoformat()
        return d


@dataclass
class MiningReward:
    """Mining reward calculation"""
    algorithm: str
    block_reward: float  # ZION per block
    blocks_per_day: float  # Expected blocks/day
    daily_reward: float  # ZION/day
    network_hashrate: float  # Network H/s
    miner_hashrate: float  # Miner H/s
    share: float  # Miner share of network (0.0-1.0)


@dataclass
class ProfitCalculation:
    """Complete profitability calculation"""
    algorithm: str
    
    # Hashrate
    hashrate: float  # H/s
    network_hashrate: float  # H/s
    difficulty: float
    
    # Rewards
    block_reward: float  # ZION per block
    daily_reward_zion: float  # ZION/day
    
    # Price
    zion_price_usd: float
    daily_revenue_usd: float  # USD/day
    
    # Costs
    power_watts: float
    electricity_cost_kwh: float  # USD/kWh
    daily_cost_usd: float  # USD/day
    
    # Profit
    daily_profit_usd: float  # USD/day
    monthly_profit_usd: float  # USD/month
    roi_days: Optional[float]  # Days to ROI (if hardware cost provided)
    
    timestamp: datetime
    
    def to_dict(self) -> Dict:
        d = asdict(self)
        d['timestamp'] = self.timestamp.isoformat()
        return d


class ProfitabilityCalculator:
    """Calculate mining profitability for ZION"""
    
    # Constants
    BLOCK_TIME_SECONDS = 120  # 2 minutes
    BLOCKS_PER_DAY = 86400 / BLOCK_TIME_SECONDS  # 720 blocks/day
    BLOCK_REWARD = 50.0  # ZION per block (v2.9.0)
    
    # Fallback prices (if API fails)
    FALLBACK_PRICE_USD = 0.10  # $0.10 per ZION
    FALLBACK_PRICE_BTC = 0.000003  # 300 sats
    
    # API endpoints
    COINGECKO_API = "https://api.coingecko.com/api/v3"
    ZION_POOL_API = "https://pool.zion.org/api"  # Placeholder
    
    def __init__(
        self,
        electricity_cost_kwh: float = 0.12,  # USD/kWh
        cache_dir: str = "data/cache"
    ):
        """
        Initialize profitability calculator
        
        Args:
            electricity_cost_kwh: Electricity cost in USD/kWh
            cache_dir: Directory for price cache
        """
        self.electricity_cost = electricity_cost_kwh
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        
        self.price_cache_path = self.cache_dir / "zion_price.json"
        self.price_cache_ttl = 300  # 5 minutes
        
        self.benchmarker = AlgorithmBenchmarker()
        
        logger.info(f"Profitability calculator initialized (${electricity_cost_kwh}/kWh)")
    
    async def get_zion_price(self) -> ZionPrice:
        """
        Get current ZION price
        
        Returns:
            ZionPrice object
        """
        # Check cache first
        cached = self._get_cached_price()
        if cached:
            logger.info(f"Using cached ZION price: ${cached.usd:.4f}")
            return cached
        
        # Try CoinGecko API
        try:
            price = await self._fetch_coingecko_price()
            self._cache_price(price)
            return price
        except Exception as e:
            logger.warning(f"CoinGecko API failed: {e}")
        
        # Try ZION pool API
        try:
            price = await self._fetch_pool_price()
            self._cache_price(price)
            return price
        except Exception as e:
            logger.warning(f"Pool API failed: {e}")
        
        # Fallback to hardcoded price
        logger.warning(f"Using fallback ZION price: ${self.FALLBACK_PRICE_USD:.4f}")
        return ZionPrice(
            usd=self.FALLBACK_PRICE_USD,
            btc=self.FALLBACK_PRICE_BTC,
            eth=0.00005,
            timestamp=datetime.now(),
            source="fallback"
        )
    
    async def _fetch_coingecko_price(self) -> ZionPrice:
        """Fetch price from CoinGecko API"""
        if not AIOHTTP_AVAILABLE:
            raise RuntimeError("aiohttp not available")
        
        # Note: ZION is not on CoinGecko yet - this is placeholder
        url = f"{self.COINGECKO_API}/simple/price"
        params = {
            "ids": "zion",  # Placeholder
            "vs_currencies": "usd,btc,eth"
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.get(url, params=params, timeout=10) as resp:
                resp.raise_for_status()
                data = await resp.json()
                
                zion_data = data.get("zion", {})
                
                return ZionPrice(
                    usd=zion_data.get("usd", self.FALLBACK_PRICE_USD),
                    btc=zion_data.get("btc", self.FALLBACK_PRICE_BTC),
                    eth=zion_data.get("eth", 0.00005),
                    timestamp=datetime.now(),
                    source="coingecko"
                )
    
    async def _fetch_pool_price(self) -> ZionPrice:
        """Fetch price from ZION pool API"""
        if not AIOHTTP_AVAILABLE:
            raise RuntimeError("aiohttp not available")
        
        url = f"{self.ZION_POOL_API}/price"
        
        async with aiohttp.ClientSession() as session:
            async with session.get(url, timeout=10) as resp:
                resp.raise_for_status()
                data = await resp.json()
                
                return ZionPrice(
                    usd=data["usd"],
                    btc=data["btc"],
                    eth=data["eth"],
                    timestamp=datetime.now(),
                    source="pool"
                )
    
    def _get_cached_price(self) -> Optional[ZionPrice]:
        """Get cached price if fresh"""
        if not self.price_cache_path.exists():
            return None
        
        try:
            with open(self.price_cache_path) as f:
                data = json.load(f)
            
            cached_time = datetime.fromisoformat(data["timestamp"])
            age = (datetime.now() - cached_time).total_seconds()
            
            if age > self.price_cache_ttl:
                logger.debug(f"Price cache expired ({age:.0f}s > {self.price_cache_ttl}s)")
                return None
            
            return ZionPrice(
                usd=data["usd"],
                btc=data["btc"],
                eth=data["eth"],
                timestamp=cached_time,
                source=data["source"]
            )
        except Exception as e:
            logger.warning(f"Failed to read price cache: {e}")
            return None
    
    def _cache_price(self, price: ZionPrice):
        """Cache price data"""
        try:
            with open(self.price_cache_path, 'w') as f:
                json.dump(price.to_dict(), f, indent=2)
            logger.debug(f"Cached ZION price: ${price.usd:.4f}")
        except Exception as e:
            logger.warning(f"Failed to cache price: {e}")
    
    async def get_network_stats(self, algorithm: str) -> Dict:
        """
        Get network statistics for algorithm
        
        Args:
            algorithm: Algorithm name
        
        Returns:
            Dict with network_hashrate, difficulty, etc.
        """
        # Try pool API
        if AIOHTTP_AVAILABLE:
            try:
                url = f"{self.ZION_POOL_API}/stats/{algorithm}"
                
                async with aiohttp.ClientSession() as session:
                    async with session.get(url, timeout=10) as resp:
                        resp.raise_for_status()
                        return await resp.json()
            except Exception as e:
                logger.warning(f"Failed to get network stats: {e}")
        
        # Fallback estimates (based on current testnet)
        fallback_stats = {
            "cosmic_harmony": {
                "network_hashrate": 5_000_000,  # 5 MH/s
                "difficulty": 1000.0,
                "active_miners": 10
            },
            "randomx": {
                "network_hashrate": 50_000,  # 50 kH/s
                "difficulty": 100.0,
                "active_miners": 5
            },
            "yescrypt": {
                "network_hashrate": 30_000,  # 30 kH/s
                "difficulty": 80.0,
                "active_miners": 3
            },
            "autolykos": {
                "network_hashrate": 50_000_000,  # 50 MH/s
                "difficulty": 5000.0,
                "active_miners": 2
            }
        }
        
        return fallback_stats.get(algorithm, {
            "network_hashrate": 1_000_000,
            "difficulty": 100.0,
            "active_miners": 1
        })
    
    async def calculate_mining_reward(
        self,
        algorithm: str,
        hashrate: float
    ) -> MiningReward:
        """
        Calculate expected mining rewards
        
        Args:
            algorithm: Mining algorithm
            hashrate: Miner hashrate (H/s)
        
        Returns:
            MiningReward
        """
        stats = await self.get_network_stats(algorithm)
        network_hashrate = stats.get("network_hashrate", 1_000_000)
        
        # Calculate miner's share of network
        share = hashrate / max(network_hashrate, 1.0)
        
        # Expected blocks per day
        blocks_per_day = self.BLOCKS_PER_DAY * share
        
        # Daily ZION reward
        daily_reward = blocks_per_day * self.BLOCK_REWARD
        
        return MiningReward(
            algorithm=algorithm,
            block_reward=self.BLOCK_REWARD,
            blocks_per_day=blocks_per_day,
            daily_reward=daily_reward,
            network_hashrate=network_hashrate,
            miner_hashrate=hashrate,
            share=share
        )
    
    async def calculate_profitability(
        self,
        algorithm: str,
        hashrate: Optional[float] = None,
        power_watts: Optional[float] = None,
        hardware_cost_usd: Optional[float] = None
    ) -> ProfitCalculation:
        """
        Calculate complete profitability
        
        Args:
            algorithm: Mining algorithm
            hashrate: Miner hashrate (None = use benchmark)
            power_watts: Power consumption (None = use benchmark)
            hardware_cost_usd: Initial hardware investment
        
        Returns:
            ProfitCalculation
        """
        # Get benchmark data if not provided
        if hashrate is None or power_watts is None:
            results = self.benchmarker.get_latest_results(algorithm)
            
            if not results:
                raise ValueError(f"No benchmark data for {algorithm} - run benchmark first")
            
            result = results[0]
            
            if hashrate is None:
                hashrate = result.hashrate
            
            if power_watts is None:
                power_watts = result.power_watts or 100.0  # Default 100W
        
        # Get ZION price
        price = await self.get_zion_price()
        
        # Get network stats
        stats = await self.get_network_stats(algorithm)
        network_hashrate = stats.get("network_hashrate", 1_000_000)
        difficulty = stats.get("difficulty", 100.0)
        
        # Calculate rewards
        reward = await self.calculate_mining_reward(algorithm, hashrate)
        
        # Calculate revenue
        daily_revenue_usd = reward.daily_reward * price.usd
        
        # Calculate electricity cost
        daily_kwh = (power_watts / 1000.0) * 24  # kWh/day
        daily_cost_usd = daily_kwh * self.electricity_cost
        
        # Calculate profit
        daily_profit_usd = daily_revenue_usd - daily_cost_usd
        monthly_profit_usd = daily_profit_usd * 30
        
        # Calculate ROI
        roi_days = None
        if hardware_cost_usd and daily_profit_usd > 0:
            roi_days = hardware_cost_usd / daily_profit_usd
        
        return ProfitCalculation(
            algorithm=algorithm,
            hashrate=hashrate,
            network_hashrate=network_hashrate,
            difficulty=difficulty,
            block_reward=self.BLOCK_REWARD,
            daily_reward_zion=reward.daily_reward,
            zion_price_usd=price.usd,
            daily_revenue_usd=daily_revenue_usd,
            power_watts=power_watts,
            electricity_cost_kwh=self.electricity_cost,
            daily_cost_usd=daily_cost_usd,
            daily_profit_usd=daily_profit_usd,
            monthly_profit_usd=monthly_profit_usd,
            roi_days=roi_days,
            timestamp=datetime.now()
        )
    
    async def calculate_all(self) -> List[ProfitCalculation]:
        """Calculate profitability for all benchmarked algorithms"""
        results = self.benchmarker.get_latest_results()
        
        if not results:
            logger.warning("No benchmark data - run benchmark first")
            return []
        
        calculations = []
        
        for result in results:
            if not result.success:
                continue
            
            try:
                calc = await self.calculate_profitability(
                    result.algorithm,
                    result.hashrate,
                    result.power_watts
                )
                calculations.append(calc)
            except Exception as e:
                logger.error(f"Failed to calculate profitability for {result.algorithm}: {e}")
        
        return calculations
    
    def get_best_algorithm(self, calculations: List[ProfitCalculation]) -> Optional[str]:
        """Get most profitable algorithm"""
        if not calculations:
            return None
        
        # Filter positive profits
        profitable = [c for c in calculations if c.daily_profit_usd > 0]
        
        if not profitable:
            # Return least unprofitable
            return max(calculations, key=lambda c: c.daily_profit_usd).algorithm
        
        # Return most profitable
        best = max(profitable, key=lambda c: c.daily_profit_usd)
        return best.algorithm
    
    def print_profitability(self, calculations: Optional[List[ProfitCalculation]] = None):
        """Print profitability report"""
        if calculations is None:
            # Fetch synchronously (for CLI)
            import asyncio
            calculations = asyncio.run(self.calculate_all())
        
        if not calculations:
            print("❌ No profitability data available (run benchmark first)")
            return
        
        print("\n" + "="*80)
        print("💰 ZION Mining Profitability Report")
        print("="*80)
        print(f"Electricity Cost: ${self.electricity_cost:.3f}/kWh")
        print(f"ZION Price: ${calculations[0].zion_price_usd:.4f} USD")
        print()
        
        for calc in sorted(calculations, key=lambda c: c.daily_profit_usd, reverse=True):
            status = "✅" if calc.daily_profit_usd > 0 else "❌"
            
            print(f"{status} {calc.algorithm.upper()}")
            print(f"  Hashrate: {calc.hashrate:,.2f} H/s")
            print(f"  Network Hashrate: {calc.network_hashrate:,.0f} H/s")
            print(f"  Share: {(calc.hashrate / calc.network_hashrate * 100):.4f}%")
            print()
            print(f"  Rewards:")
            print(f"    {calc.daily_reward_zion:.4f} ZION/day")
            print(f"    ${calc.daily_revenue_usd:.2f} USD/day")
            print()
            print(f"  Costs:")
            print(f"    {calc.power_watts:.1f}W @ ${self.electricity_cost:.3f}/kWh")
            print(f"    ${calc.daily_cost_usd:.2f} USD/day")
            print()
            print(f"  Profit:")
            print(f"    ${calc.daily_profit_usd:.2f} USD/day")
            print(f"    ${calc.monthly_profit_usd:.2f} USD/month")
            
            if calc.roi_days:
                print(f"    ROI: {calc.roi_days:.0f} days")
            
            print()
        
        print("="*80)
        
        # Show best algorithm
        best = self.get_best_algorithm(calculations)
        if best:
            best_calc = next(c for c in calculations if c.algorithm == best)
            print(f"\n🏆 Most Profitable: {best.upper()} (${best_calc.daily_profit_usd:.2f}/day)")
        
        print()


# Singleton instance
_calculator_instance: Optional[ProfitabilityCalculator] = None


def get_calculator(electricity_cost_kwh: float = 0.12) -> ProfitabilityCalculator:
    """Get singleton calculator instance"""
    global _calculator_instance
    
    if _calculator_instance is None:
        _calculator_instance = ProfitabilityCalculator(electricity_cost_kwh)
    
    return _calculator_instance


async def main():
    """Test profitability calculator"""
    logging.basicConfig(
        level=logging.INFO,
        format='%(levelname)s:%(name)s:%(message)s'
    )
    
    calc = get_calculator(electricity_cost_kwh=0.12)
    
    # Calculate profitability for all algorithms
    calculations = await calc.calculate_all()
    
    # Print report
    calc.print_profitability(calculations)


if __name__ == "__main__":
    asyncio.run(main())
