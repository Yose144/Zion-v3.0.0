#!/usr/bin/env python3
"""
ZION Intelligent Pool Switcher
AI-Powered Pool Switching and Load Balancing System

This module implements intelligent pool switching for:
- Real-time profitability optimization
- Predictive switching algorithms
- Risk-aware decision making
- Multi-factor switching criteria
- Automated pool management
"""

import asyncio
import json
import logging
import statistics
from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import redis

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class SwitchingMode(Enum):
    """Enumeration of switching modes"""

    PROFIT_MAXIMIZATION = "profit_maximization"
    RISK_MINIMIZATION = "risk_minimization"
    BALANCED = "balanced"
    CONSERVATIVE = "conservative"
    AGGRESSIVE = "aggressive"


@dataclass
class PoolSwitch:
    """Data class for pool switching decisions"""

    switch_id: str
    from_pool: str
    to_pool: str
    reason: str
    expected_profit_increase: float
    risk_assessment: float
    timestamp: datetime
    executed: bool = False
    success: bool = False


@dataclass
class SwitchingCriteria:
    """Data class for switching decision criteria"""

    min_profit_threshold: float  # Minimum profit increase to trigger switch
    max_risk_tolerance: float  # Maximum acceptable risk
    min_stability_period: int  # Minimum time before switching again (seconds)
    prediction_horizon: int  # How far ahead to predict (seconds)
    switching_mode: SwitchingMode


class IntelligentPoolSwitcher:
    """AI-powered intelligent pool switching system"""

    def __init__(self, redis_host: str = "localhost", redis_port: int = 6379):
        self.redis_client = redis.Redis(host=redis_host, port=redis_port, decode_responses=True)

        # Switching configuration
        self.criteria = SwitchingCriteria(
            min_profit_threshold=0.05,  # 5% profit increase
            max_risk_tolerance=0.3,  # 30% risk tolerance
            min_stability_period=1800,  # 30 minutes
            prediction_horizon=3600,  # 1 hour prediction
            switching_mode=SwitchingMode.BALANCED,
        )

        # Switching state
        self.current_pool = "zion-official"
        self.last_switch_time = datetime.now() - timedelta(hours=1)  # Allow immediate first switch
        self.switch_history = []
        self.pending_switches = {}

        # Performance tracking
        self.pool_performance_history = {}
        self.profitability_trends = {}
        self.risk_assessments = {}

        # Switching parameters
        self.confidence_threshold = 0.7
        self.backoff_multiplier = 1.5
        self.max_consecutive_failures = 3

        logger.info("Intelligent Pool Switcher initialized")

    async def start_switching_engine(self):
        """Start the intelligent switching engine"""
        logger.info("Starting Intelligent Pool Switching Engine...")

        # Start background monitoring and switching
        asyncio.create_task(self.performance_monitoring_loop())
        asyncio.create_task(self.switching_decision_loop())
        asyncio.create_task(self.switch_execution_monitor())

        logger.info("Intelligent Pool Switching Engine started")

    async def performance_monitoring_loop(self):
        """Continuously monitor pool performance"""
        while True:
            try:
                # Update pool performance data
                await self._update_pool_performance()

                # Calculate profitability trends
                await self._calculate_profitability_trends()

                # Assess switching risks
                await self._assess_switching_risks()

                # Update switching criteria based on market conditions
                await self._adapt_switching_criteria()

                await asyncio.sleep(300)  # Update every 5 minutes

            except Exception as e:
                logger.error(f"Error in performance monitoring: {e}")
                await asyncio.sleep(60)

    async def _update_pool_performance(self):
        """Update performance data for all pools"""
        try:
            # Get pool data from AI Pool Orchestrator
            pool_keys = self.redis_client.keys("pool:metrics:*")

            for key in pool_keys:
                pool_id = key.split(":")[-1]
                pool_data = self.redis_client.get(key)

                if pool_data:
                    data = json.loads(pool_data)

                    # Store in performance history
                    if pool_id not in self.pool_performance_history:
                        self.pool_performance_history[pool_id] = []

                    performance_entry = {
                        "timestamp": datetime.now().isoformat(),
                        "reward_rate": data.get("reward_rate", 0),
                        "hash_rate": data.get("hash_rate", 0),
                        "difficulty": data.get("difficulty", 1),
                        "uptime": data.get("uptime", 1.0),
                        "ping_time": data.get("ping_time", 0),
                        "trust_score": data.get("trust_score", 0.5),
                    }

                    self.pool_performance_history[pool_id].append(performance_entry)

                    # Keep only recent history (last 24 hours)
                    cutoff_time = datetime.now() - timedelta(hours=24)
                    self.pool_performance_history[pool_id] = [
                        entry
                        for entry in self.pool_performance_history[pool_id]
                        if datetime.fromisoformat(entry["timestamp"]) > cutoff_time
                    ]

        except Exception as e:
            logger.error(f"Error updating pool performance: {e}")

    async def _calculate_profitability_trends(self):
        """Calculate profitability trends for switching decisions"""
        try:
            for pool_id, history in self.pool_performance_history.items():
                if len(history) < 5:  # Need minimum data points
                    continue

                # Extract reward rates
                reward_rates = [entry["reward_rate"] for entry in history[-20:]]  # Last 20 entries

                if len(reward_rates) < 5:
                    continue

                # Calculate trend metrics
                trend = self._calculate_trend(reward_rates)
                volatility = self._calculate_volatility(reward_rates)
                momentum = self._calculate_momentum(reward_rates)

                # Calculate profitability score
                avg_reward = statistics.mean(reward_rates)
                trend_score = trend * 0.4  # Trend importance
                stability_score = (1.0 - volatility) * 0.3  # Stability importance
                momentum_score = momentum * 0.3  # Momentum importance

                profitability_score = avg_reward * (0.4 + trend_score + stability_score + momentum_score)

                self.profitability_trends[pool_id] = {
                    "score": profitability_score,
                    "trend": trend,
                    "volatility": volatility,
                    "momentum": momentum,
                    "average_reward": avg_reward,
                    "calculated_at": datetime.now().isoformat(),
                }

        except Exception as e:
            logger.error(f"Error calculating profitability trends: {e}")

    def _calculate_trend(self, values: List[float]) -> float:
        """Calculate linear trend in values"""
        try:
            if len(values) < 2:
                return 0.0

            x = np.arange(len(values))
            slope, _ = np.polyfit(x, values, 1)
            return slope / max(abs(statistics.mean(values)), 0.0001)  # Normalized slope

        except Exception:
            return 0.0

    def _calculate_volatility(self, values: List[float]) -> float:
        """Calculate volatility (coefficient of variation)"""
        try:
            if len(values) < 2:
                return 1.0

            mean_val = statistics.mean(values)
            if mean_val == 0:
                return 1.0

            std_val = statistics.stdev(values)
            return std_val / abs(mean_val)

        except Exception:
            return 1.0

    def _calculate_momentum(self, values: List[float]) -> float:
        """Calculate momentum (recent vs older performance)"""
        try:
            if len(values) < 10:
                return 0.0

            # Compare recent vs older values
            split_point = len(values) // 2
            recent_avg = statistics.mean(values[split_point:])
            older_avg = statistics.mean(values[:split_point])

            if older_avg == 0:
                return 1.0 if recent_avg > 0 else -1.0

            return (recent_avg - older_avg) / abs(older_avg)

        except Exception:
            return 0.0

    async def _assess_switching_risks(self):
        """Assess risks associated with pool switching"""
        try:
            for pool_id, history in self.pool_performance_history.items():
                if len(history) < 10:
                    self.risk_assessments[pool_id] = 0.8  # High risk for new pools
                    continue

                # Risk factors
                uptime_risk = 1.0 - statistics.mean([entry["uptime"] for entry in history])
                ping_risk = min(
                    1.0, statistics.mean([entry["ping_time"] for entry in history]) / 500
                )  # 500ms threshold
                trust_risk = 1.0 - statistics.mean([entry["trust_score"] for entry in history])

                # Historical performance consistency
                reward_rates = [entry["reward_rate"] for entry in history]
                consistency_risk = self._calculate_volatility(reward_rates)

                # Combine risk factors
                overall_risk = uptime_risk * 0.3 + ping_risk * 0.2 + trust_risk * 0.3 + consistency_risk * 0.2

                self.risk_assessments[pool_id] = min(1.0, overall_risk)

        except Exception as e:
            logger.error(f"Error assessing switching risks: {e}")

    async def _adapt_switching_criteria(self):
        """Adapt switching criteria based on market conditions"""
        try:
            # Analyze recent market volatility
            all_rewards = []
            for history in self.pool_performance_history.values():
                all_rewards.extend([entry["reward_rate"] for entry in history[-10:]])

            if len(all_rewards) > 20:
                market_volatility = self._calculate_volatility(all_rewards)

                # Adapt criteria based on volatility
                if market_volatility > 0.5:  # High volatility
                    self.criteria.min_profit_threshold = 0.10  # Require higher profit margin
                    self.criteria.max_risk_tolerance = 0.2  # Lower risk tolerance
                    self.criteria.switching_mode = SwitchingMode.CONSERVATIVE
                elif market_volatility < 0.2:  # Low volatility
                    self.criteria.min_profit_threshold = 0.03  # Accept lower profit margin
                    self.criteria.max_risk_tolerance = 0.4  # Higher risk tolerance
                    self.criteria.switching_mode = SwitchingMode.AGGRESSIVE
                else:  # Normal volatility
                    self.criteria.min_profit_threshold = 0.05
                    self.criteria.max_risk_tolerance = 0.3
                    self.criteria.switching_mode = SwitchingMode.BALANCED

        except Exception as e:
            logger.error(f"Error adapting switching criteria: {e}")

    async def switching_decision_loop(self):
        """Main loop for making switching decisions"""
        while True:
            try:
                # Check if switching is allowed
                if not self._can_switch():
                    await asyncio.sleep(60)
                    continue

                # Evaluate switching opportunities
                switch_opportunity = await self._evaluate_switching_opportunities()

                if switch_opportunity:
                    # Execute the switch
                    await self._execute_switch(switch_opportunity)

                await asyncio.sleep(300)  # Check every 5 minutes

            except Exception as e:
                logger.error(f"Error in switching decision loop: {e}")
                await asyncio.sleep(60)

    def _can_switch(self) -> bool:
        """Check if switching is currently allowed"""
        try:
            # Check minimum stability period
            time_since_last_switch = (datetime.now() - self.last_switch_time).total_seconds()
            if time_since_last_switch < self.criteria.min_stability_period:
                return False

            # Check for pending switches
            if self.pending_switches:
                return False

            # Check consecutive failure limit
            recent_switches = [switch for switch in self.switch_history[-5:] if not switch.success]

            if len(recent_switches) >= self.max_consecutive_failures:
                logger.warning("Too many consecutive switching failures, pausing switching")
                return False

            return True

        except Exception as e:
            logger.error(f"Error checking switch availability: {e}")
            return False

    async def _evaluate_switching_opportunities(self) -> Optional[PoolSwitch]:
        """Evaluate potential switching opportunities"""
        try:
            if self.current_pool not in self.profitability_trends:
                return None

            current_profitability = self.profitability_trends[self.current_pool]["score"]
            best_opportunity = None
            best_profit_increase = 0

            # Evaluate each alternative pool
            for pool_id, trend_data in self.profitability_trends.items():
                if pool_id == self.current_pool:
                    continue

                candidate_profitability = trend_data["score"]
                profit_increase = (candidate_profitability - current_profitability) / max(current_profitability, 0.0001)

                # Check if meets switching criteria
                risk_level = self.risk_assessments.get(pool_id, 1.0)

                meets_criteria = (
                    profit_increase >= self.criteria.min_profit_threshold
                    and risk_level <= self.criteria.max_risk_tolerance
                )

                # Apply mode-specific adjustments
                if self.criteria.switching_mode == SwitchingMode.CONSERVATIVE:
                    meets_criteria = meets_criteria and profit_increase >= self.criteria.min_profit_threshold * 1.5
                elif self.criteria.switching_mode == SwitchingMode.AGGRESSIVE:
                    meets_criteria = meets_criteria and profit_increase >= self.criteria.min_profit_threshold * 0.7

                if meets_criteria and profit_increase > best_profit_increase:
                    best_opportunity = PoolSwitch(
                        switch_id=self._generate_switch_id(),
                        from_pool=self.current_pool,
                        to_pool=pool_id,
                        reason=self._determine_switch_reason(profit_increase, risk_level, trend_data),
                        expected_profit_increase=profit_increase,
                        risk_assessment=risk_level,
                        timestamp=datetime.now(),
                    )
                    best_profit_increase = profit_increase

            return best_opportunity

        except Exception as e:
            logger.error(f"Error evaluating switching opportunities: {e}")
            return None

    def _generate_switch_id(self) -> str:
        """Generate unique switch ID"""
        return f"switch_{int(datetime.now().timestamp())}_{self.current_pool[:8]}_{np.random.randint(1000, 9999)}"

    def _determine_switch_reason(self, profit_increase: float, risk_level: float, trend_data: Dict) -> str:
        """Determine the reason for a pool switch"""
        try:
            reasons = []

            if profit_increase > 0.15:
                reasons.append("High profitability increase")
            elif profit_increase > 0.08:
                reasons.append("Moderate profitability increase")

            if trend_data["trend"] > 0.1:
                reasons.append("Positive trend")
            elif trend_data["trend"] < -0.1:
                reasons.append("Avoiding negative trend")

            if risk_level < 0.2:
                reasons.append("Low risk")
            elif risk_level > 0.5:
                reasons.append("Acceptable risk level")

            if trend_data["momentum"] > 0.1:
                reasons.append("Strong momentum")

            return "; ".join(reasons) if reasons else "Profit optimization"

        except Exception:
            return "Automated switching decision"

    async def _execute_switch(self, switch: PoolSwitch):
        """Execute a pool switching decision"""
        try:
            logger.info(
                f"Executing pool switch: {switch.from_pool} -> {switch.to_pool} "
                f"(Expected profit: {switch.expected_profit_increase:.1%})"
            )

            # Add to pending switches
            self.pending_switches[switch.switch_id] = switch

            # Send switch command to mining processes
            switch_command = {
                "type": "pool_switch",
                "switch_id": switch.switch_id,
                "from_pool": switch.from_pool,
                "to_pool": switch.to_pool,
                "expected_profit": switch.expected_profit_increase,
                "timestamp": switch.timestamp.isoformat(),
            }

            self.redis_client.publish("mining:pool_switches", json.dumps(switch_command))

            # Store switch in history
            self.switch_history.append(switch)

            # Update current pool (optimistically)
            self.current_pool = switch.to_pool
            self.last_switch_time = datetime.now()

            # Keep history limited
            if len(self.switch_history) > 100:
                self.switch_history = self.switch_history[-100:]

        except Exception as e:
            logger.error(f"Error executing switch {switch.switch_id}: {e}")
            switch.success = False

    async def switch_execution_monitor(self):
        """Monitor execution of pending switches"""
        while True:
            try:
                # Check for switch completion notifications
                await self._check_switch_completions()

                # Check for timeouts
                await self._check_switch_timeouts()

                # Update switching statistics
                await self._update_switching_statistics()

                await asyncio.sleep(30)  # Check every 30 seconds

            except Exception as e:
                logger.error(f"Error in switch execution monitor: {e}")
                await asyncio.sleep(60)

    async def _check_switch_completions(self):
        """Check for completed switches"""
        try:
            # In a real implementation, this would listen for completion events
            # For now, we'll simulate based on timing

            completed_switches = []
            for switch_id, switch in self.pending_switches.items():
                # Simulate completion after 2-5 minutes
                if (datetime.now() - switch.timestamp).total_seconds() > np.random.uniform(120, 300):
                    switch.executed = True
                    switch.success = np.random.random() > 0.1  # 90% success rate

                    if switch.success:
                        logger.info(f"Switch {switch_id} completed successfully")
                        completed_switches.append(switch_id)
                    else:
                        logger.warning(f"Switch {switch_id} failed")
                        # Revert to original pool on failure
                        self.current_pool = switch.from_pool
                        completed_switches.append(switch_id)

            # Remove completed switches
            for switch_id in completed_switches:
                del self.pending_switches[switch_id]

        except Exception as e:
            logger.error(f"Error checking switch completions: {e}")

    async def _check_switch_timeouts(self):
        """Check for timed-out switches"""
        try:
            timeout_threshold = timedelta(minutes=10)
            timed_out_switches = []

            for switch_id, switch in self.pending_switches.items():
                if datetime.now() - switch.timestamp > timeout_threshold:
                    logger.error(f"Switch {switch_id} timed out")
                    switch.success = False
                    timed_out_switches.append(switch_id)

                    # Revert to original pool
                    self.current_pool = switch.from_pool

            # Remove timed out switches
            for switch_id in timed_out_switches:
                del self.pending_switches[switch_id]

        except Exception as e:
            logger.error(f"Error checking switch timeouts: {e}")

    async def _update_switching_statistics(self):
        """Update switching performance statistics"""
        try:
            if not self.switch_history:
                return

            # Calculate success rate
            recent_switches = self.switch_history[-20:]  # Last 20 switches
            successful_switches = sum(1 for switch in recent_switches if switch.success)
            success_rate = successful_switches / len(recent_switches) if recent_switches else 0

            # Calculate average profit increase
            profit_increases = [switch.expected_profit_increase for switch in recent_switches if switch.success]
            avg_profit_increase = statistics.mean(profit_increases) if profit_increases else 0

            # Store statistics
            statistics_data = {
                "success_rate": success_rate,
                "average_profit_increase": avg_profit_increase,
                "total_switches": len(self.switch_history),
                "pending_switches": len(self.pending_switches),
                "current_pool": self.current_pool,
                "switching_mode": self.criteria.switching_mode.value,
                "last_switch": self.last_switch_time.isoformat(),
                "updated_at": datetime.now().isoformat(),
            }

            self.redis_client.setex("switcher:statistics", 300, json.dumps(statistics_data))  # 5 minutes

        except Exception as e:
            logger.error(f"Error updating switching statistics: {e}")

    async def force_switch(self, target_pool: str, reason: str = "Manual override") -> bool:
        """Force an immediate pool switch (manual override)"""
        try:
            if target_pool not in self.pool_performance_history:
                logger.error(f"Target pool {target_pool} not available")
                return False

            # Create forced switch
            forced_switch = PoolSwitch(
                switch_id=self._generate_switch_id(),
                from_pool=self.current_pool,
                to_pool=target_pool,
                reason=reason,
                expected_profit_increase=0.0,  # Unknown for forced switches
                risk_assessment=0.5,
                timestamp=datetime.now(),
            )

            # Execute immediately
            await self._execute_switch(forced_switch)

            logger.info(f"Manual pool switch executed: {self.current_pool} -> {target_pool}")
            return True

        except Exception as e:
            logger.error(f"Error forcing pool switch: {e}")
            return False

    def set_switching_mode(self, mode: SwitchingMode):
        """Set the switching mode"""
        try:
            self.criteria.switching_mode = mode
            logger.info(f"Switching mode set to: {mode.value}")

            # Adjust criteria based on mode
            if mode == SwitchingMode.CONSERVATIVE:
                self.criteria.min_profit_threshold = 0.08
                self.criteria.max_risk_tolerance = 0.2
            elif mode == SwitchingMode.AGGRESSIVE:
                self.criteria.min_profit_threshold = 0.03
                self.criteria.max_risk_tolerance = 0.4
            elif mode == SwitchingMode.PROFIT_MAXIMIZATION:
                self.criteria.min_profit_threshold = 0.02
                self.criteria.max_risk_tolerance = 0.5
            elif mode == SwitchingMode.RISK_MINIMIZATION:
                self.criteria.min_profit_threshold = 0.10
                self.criteria.max_risk_tolerance = 0.1
            else:  # BALANCED
                self.criteria.min_profit_threshold = 0.05
                self.criteria.max_risk_tolerance = 0.3

        except Exception as e:
            logger.error(f"Error setting switching mode: {e}")

    async def get_switcher_status(self) -> Dict[str, Any]:
        """Get comprehensive switcher status"""
        try:
            recent_switches = self.switch_history[-5:] if self.switch_history else []

            return {
                "current_pool": self.current_pool,
                "switching_mode": self.criteria.switching_mode.value,
                "last_switch_time": self.last_switch_time.isoformat(),
                "pending_switches": len(self.pending_switches),
                "total_switches": len(self.switch_history),
                "success_rate": self._calculate_success_rate(),
                "available_pools": list(self.pool_performance_history.keys()),
                "profitability_trends": self.profitability_trends,
                "risk_assessments": self.risk_assessments,
                "recent_switches": [
                    {
                        "switch_id": switch.switch_id,
                        "from_pool": switch.from_pool,
                        "to_pool": switch.to_pool,
                        "profit_increase": switch.expected_profit_increase,
                        "success": switch.success,
                        "timestamp": switch.timestamp.isoformat(),
                    }
                    for switch in recent_switches
                ],
            }

        except Exception as e:
            logger.error(f"Error getting switcher status: {e}")
            return {"error": str(e)}

    def _calculate_success_rate(self) -> float:
        """Calculate switching success rate"""
        try:
            if not self.switch_history:
                return 0.0

            successful = sum(1 for switch in self.switch_history if switch.success)
            return successful / len(self.switch_history)

        except Exception:
            return 0.0

    async def predict_optimal_pool(self, horizon_hours: int = 1) -> Dict[str, Any]:
        """Predict which pool will be optimal in the given time horizon"""
        try:
            predictions = {}

            for pool_id, trend_data in self.profitability_trends.items():
                # Simple prediction based on current trends
                current_score = trend_data["score"]
                trend = trend_data["trend"]
                momentum = trend_data["momentum"]

                # Predict future score
                time_factor = horizon_hours / 24.0  # Normalize to daily scale
                predicted_score = current_score * (1 + trend * time_factor + momentum * 0.5)

                # Adjust for risk
                risk_penalty = self.risk_assessments.get(pool_id, 0.5) * 0.2
                adjusted_score = predicted_score * (1 - risk_penalty)

                predictions[pool_id] = {
                    "current_score": current_score,
                    "predicted_score": predicted_score,
                    "adjusted_score": adjusted_score,
                    "trend": trend,
                    "momentum": momentum,
                    "risk": self.risk_assessments.get(pool_id, 0.5),
                }

            # Find best prediction
            if predictions:
                best_pool = max(predictions.keys(), key=lambda x: predictions[x]["adjusted_score"])
                best_prediction = predictions[best_pool]

                return {
                    "recommended_pool": best_pool,
                    "confidence": min(
                        1.0,
                        best_prediction["adjusted_score"] / max([p["adjusted_score"] for p in predictions.values()]),
                    ),
                    "expected_score": best_prediction["predicted_score"],
                    "horizon_hours": horizon_hours,
                    "all_predictions": predictions,
                    "timestamp": datetime.now().isoformat(),
                }

            return {"error": "No pool predictions available"}

        except Exception as e:
            logger.error(f"Error predicting optimal pool: {e}")
            return {"error": str(e)}


async def main():
    """Main function for intelligent pool switcher"""
    switcher = IntelligentPoolSwitcher()

    # Start switching engine
    await switcher.start_switching_engine()

    # Keep running
    while True:
        await asyncio.sleep(60)

        # Log status periodically
        status = await switcher.get_switcher_status()
        logger.info(
            f"Pool Switcher Status: {status['current_pool']} "
            f"(Mode: {status['switching_mode']}, Success: {status['success_rate']:.1%})"
        )


if __name__ == "__main__":
    asyncio.run(main())
