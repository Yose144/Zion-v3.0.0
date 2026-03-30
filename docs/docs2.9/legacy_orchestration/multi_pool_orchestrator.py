#!/usr/bin/env python3
"""
ZION Multi-Pool Mining Orchestrator
Distributed Mining Coordination Across Multiple Pools and Nodes

This module implements distributed mining orchestration for:
- Multi-pool load balancing
- Geographic distribution optimization
- Cross-pool mining strategies
- Profit maximization across networks
- Decentralized mining coordination
"""

import asyncio
import hashlib
import ipaddress
import json
import logging
import socket
import statistics
import uuid
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

import aiohttp
import redis

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class MiningNode:
    """Data class for mining node information"""

    node_id: str
    ip_address: str
    location: str  # Geographic location
    hash_rate: float
    active_pools: List[str]
    total_shares: int
    uptime: float
    last_seen: datetime
    status: str  # 'active', 'inactive', 'maintenance'


@dataclass
class PoolNetwork:
    """Data class for mining pool network"""

    network_id: str
    name: str
    algorithm: str
    total_hash_rate: float
    active_miners: int
    reward_structure: str  # 'PPS', 'PPLNS', 'SOLO'
    geographic_distribution: Dict[str, float]  # Region -> percentage
    performance_score: float
    last_updated: datetime


@dataclass
class MiningDistribution:
    """Data class for mining distribution strategy"""

    strategy_id: str
    node_id: str
    pool_allocations: Dict[str, float]  # Pool -> percentage
    geographic_targets: Dict[str, float]
    profit_optimization: float
    risk_distribution: float
    created_at: datetime
    expires_at: datetime


class DistributedMiningOrchestrator:
    """Distributed mining orchestrator for multi-pool coordination"""

    def __init__(self, redis_host: str = "localhost", redis_port: int = 6379):
        self.redis_client = redis.Redis(host=redis_host, port=redis_port, decode_responses=True)

        # Network configuration
        self.known_pools = {
            "zion-mainnet": {
                "name": "ZION Official Pool",
                "algorithm": "yescrypt",
                "reward_structure": "PPLNS",
                "regions": ["us-east", "us-west", "eu-central", "asia-pacific"],
            },
            "zion-asia": {
                "name": "ZION Asia Pool",
                "algorithm": "yescrypt",
                "reward_structure": "PPS",
                "regions": ["asia-pacific", "asia-east"],
            },
            "zion-europe": {
                "name": "ZION Europe Pool",
                "algorithm": "yescrypt",
                "reward_structure": "PPLNS",
                "regions": ["eu-central", "eu-west"],
            },
            "mixed-algo-hub": {
                "name": "Mixed Algorithm Hub",
                "algorithm": "multi",
                "reward_structure": "PPS",
                "regions": ["us-east", "eu-central", "asia-pacific"],
            },
        }

        # Orchestrator state
        self.node_registry = {}
        self.pool_networks = {}
        self.active_distributions = {}
        self.geographic_zones = {
            "us-east": ["US-EAST-1", "US-EAST-2"],
            "us-west": ["US-WEST-1", "US-WEST-2"],
            "eu-central": ["EU-CENTRAL-1"],
            "eu-west": ["EU-WEST-1"],
            "asia-pacific": ["AP-SOUTHEAST-1", "AP-NORTHEAST-1"],
            "asia-east": ["AP-EAST-1"],
        }

        # Optimization parameters
        self.rebalance_interval = 300  # 5 minutes
        self.performance_window = 3600  # 1 hour
        self.risk_tolerance = 0.2
        self.profit_target = 0.05  # 5% above average

        # Discovery and coordination
        self.discovery_port = 9333
        self.coordination_interval = 60  # 1 minute

        logger.info("Distributed Mining Orchestrator initialized")

    async def start_orchestrator(self):
        """Start the distributed mining orchestrator"""
        logger.info("Starting Distributed Mining Orchestrator...")

        # Start background tasks
        asyncio.create_task(self.node_discovery_loop())
        asyncio.create_task(self.performance_monitoring_loop())
        asyncio.create_task(self.distribution_optimization_loop())
        asyncio.create_task(self.network_health_check_loop())

        logger.info("Distributed Mining Orchestrator started")

    async def node_discovery_loop(self):
        """Continuously discover and register mining nodes"""
        while True:
            try:
                # Discover nodes via various methods
                await self._discover_local_nodes()
                await self._discover_network_nodes()
                await self._update_node_registry()

                # Clean up inactive nodes
                await self._cleanup_inactive_nodes()

                await asyncio.sleep(self.coordination_interval)

            except Exception as e:
                logger.error(f"Error in node discovery loop: {e}")
                await asyncio.sleep(30)

    async def _discover_local_nodes(self):
        """Discover mining nodes on local network"""
        try:
            # Simple UDP broadcast discovery
            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
            sock.settimeout(1.0)

            # Broadcast discovery message
            discovery_msg = json.dumps(
                {
                    "type": "node_discovery",
                    "orchestrator_id": socket.gethostname(),
                    "timestamp": datetime.now().isoformat(),
                }
            )

            try:
                sock.sendto(discovery_msg.encode(), ("<broadcast>", self.discovery_port))

                # Listen for responses
                while True:
                    try:
                        data, addr = sock.recvfrom(4096)
                        response = json.loads(data.decode())

                        if response.get("type") == "node_announce":
                            await self._register_discovered_node(response, addr[0])

                    except socket.timeout:
                        break

            finally:
                sock.close()

        except Exception as e:
            logger.error(f"Error in local node discovery: {e}")

    async def _discover_network_nodes(self):
        """Discover mining nodes across the network"""
        try:
            # Get known nodes from Redis
            known_nodes = self.redis_client.smembers("orchestrator:known_nodes")

            for node_addr in known_nodes:
                try:
                    # Ping node to check availability
                    reader, writer = await asyncio.open_connection(node_addr, self.discovery_port)

                    # Send status request
                    status_request = {"type": "status_request", "timestamp": datetime.now().isoformat()}

                    writer.write(json.dumps(status_request).encode())
                    await writer.drain()

                    # Read response
                    data = await reader.read(4096)
                    response = json.loads(data.decode())

                    if response.get("type") == "status_response":
                        await self._update_network_node(node_addr, response)

                    writer.close()
                    await writer.wait_closed()

                except Exception as e:
                    logger.debug(f"Failed to contact node {node_addr}: {e}")
                    # Mark node as potentially inactive
                    self.redis_client.srem("orchestrator:active_nodes", node_addr)

        except Exception as e:
            logger.error(f"Error in network node discovery: {e}")

    async def _register_discovered_node(self, node_info: Dict, ip_address: str):
        """Register a newly discovered mining node"""
        try:
            node_id = node_info.get("node_id", str(uuid.uuid4()))

            node = MiningNode(
                node_id=node_id,
                ip_address=ip_address,
                location=node_info.get("location", "unknown"),
                hash_rate=node_info.get("hash_rate", 0),
                active_pools=node_info.get("active_pools", []),
                total_shares=node_info.get("total_shares", 0),
                uptime=node_info.get("uptime", 0),
                last_seen=datetime.now(),
                status="active",
            )

            self.node_registry[node_id] = node

            # Store in Redis
            self.redis_client.setex(f"node:{node_id}", 3600, json.dumps(asdict(node)))  # 1 hour

            # Add to active nodes set
            self.redis_client.sadd("orchestrator:active_nodes", ip_address)

            logger.info(f"Registered mining node: {node_id} at {ip_address}")

        except Exception as e:
            logger.error(f"Error registering discovered node: {e}")

    async def _update_node_registry(self):
        """Update the node registry with latest information"""
        try:
            # Get all registered nodes from Redis
            node_keys = self.redis_client.keys("node:*")

            for key in node_keys:
                try:
                    node_data = self.redis_client.get(key)
                    if node_data:
                        node_dict = json.loads(node_data)
                        node_id = node_dict["node_id"]

                        # Convert back to MiningNode object
                        node = MiningNode(**node_dict)
                        node.last_seen = datetime.fromisoformat(node_dict["last_seen"])

                        self.node_registry[node_id] = node

                except Exception as e:
                    logger.error(f"Error updating node from Redis: {e}")

        except Exception as e:
            logger.error(f"Error updating node registry: {e}")

    async def _cleanup_inactive_nodes(self):
        """Remove nodes that haven't been seen recently"""
        try:
            current_time = datetime.now()
            inactive_threshold = timedelta(minutes=10)

            inactive_nodes = []
            for node_id, node in self.node_registry.items():
                if current_time - node.last_seen > inactive_threshold:
                    inactive_nodes.append(node_id)

            # Remove inactive nodes
            for node_id in inactive_nodes:
                del self.node_registry[node_id]
                self.redis_client.delete(f"node:{node_id}")
                logger.info(f"Removed inactive node: {node_id}")

        except Exception as e:
            logger.error(f"Error cleaning up inactive nodes: {e}")

    async def performance_monitoring_loop(self):
        """Monitor performance across all pools and nodes"""
        while True:
            try:
                # Update pool network statistics
                await self._update_pool_networks()

                # Calculate node performance metrics
                await self._calculate_node_performance()

                # Update geographic distribution
                await self._update_geographic_distribution()

                # Store performance data
                await self._store_performance_metrics()

                await asyncio.sleep(self.rebalance_interval)

            except Exception as e:
                logger.error(f"Error in performance monitoring: {e}")
                await asyncio.sleep(30)

    async def _update_pool_networks(self):
        """Update statistics for all known pool networks"""
        try:
            for pool_id, pool_config in self.known_pools.items():
                # Get pool data from Redis (populated by AI Pool Orchestrator)
                pool_key = f"pool:metrics:{pool_id}"
                pool_data = self.redis_client.get(pool_key)

                if pool_data:
                    data = json.loads(pool_data)

                    network = PoolNetwork(
                        network_id=pool_id,
                        name=pool_config["name"],
                        algorithm=pool_config["algorithm"],
                        total_hash_rate=data.get("hash_rate", 0),
                        active_miners=data.get("workers", 0),
                        reward_structure=pool_config["reward_structure"],
                        geographic_distribution=self._calculate_pool_geography(pool_id),
                        performance_score=self._calculate_pool_performance(pool_id),
                        last_updated=datetime.now(),
                    )

                    self.pool_networks[pool_id] = network

                    # Store updated network info
                    self.redis_client.setex(f"network:{pool_id}", 1800, json.dumps(asdict(network)))  # 30 minutes

        except Exception as e:
            logger.error(f"Error updating pool networks: {e}")

    def _calculate_pool_geography(self, pool_id: str) -> Dict[str, float]:
        """Calculate geographic distribution for a pool"""
        try:
            # Get nodes mining on this pool
            mining_nodes = [node for node in self.node_registry.values() if pool_id in node.active_pools]

            if not mining_nodes:
                return {}

            # Count nodes by region
            region_counts = {}
            total_nodes = len(mining_nodes)

            for node in mining_nodes:
                region = node.location
                region_counts[region] = region_counts.get(region, 0) + 1

            # Convert to percentages
            return {region: count / total_nodes for region, count in region_counts.items()}

        except Exception as e:
            logger.error(f"Error calculating pool geography: {e}")
            return {}

    def _calculate_pool_performance(self, pool_id: str) -> float:
        """Calculate overall performance score for a pool"""
        try:
            # Get recent performance data
            perf_key = f"pool:history:{pool_id}"
            history_data = self.redis_client.lrange(perf_key, 0, 10)  # Last 10 entries

            if not history_data:
                return 0.5  # Default score

            # Calculate average reward rate and stability
            reward_rates = []
            for entry in history_data:
                try:
                    data = json.loads(entry)
                    reward_rates.append(data.get("reward_rate", 0))
                except:
                    continue

            if not reward_rates:
                return 0.5

            # Performance score based on average reward and stability
            avg_reward = statistics.mean(reward_rates)
            reward_stability = 1.0 / (1.0 + statistics.stdev(reward_rates)) if len(reward_rates) > 1 else 1.0

            # Normalize and combine
            normalized_reward = min(1.0, avg_reward / 0.01)  # Assuming 0.01 ZION/hr is good
            performance_score = (normalized_reward * 0.7) + (reward_stability * 0.3)

            return performance_score

        except Exception as e:
            logger.error(f"Error calculating pool performance: {e}")
            return 0.5

    async def _calculate_node_performance(self):
        """Calculate performance metrics for all nodes"""
        try:
            for node_id, node in self.node_registry.items():
                # Calculate node's contribution to each pool
                pool_contributions = {}

                for pool_id in node.active_pools:
                    if pool_id in self.pool_networks:
                        network = self.pool_networks[pool_id]
                        # Simple contribution calculation
                        contribution = node.hash_rate / max(network.total_hash_rate, 1)
                        pool_contributions[pool_id] = contribution

                # Calculate overall efficiency
                total_contribution = sum(pool_contributions.values())
                efficiency = total_contribution / max(len(node.active_pools), 1)

                # Update node with performance metrics
                node_performance = {
                    "node_id": node_id,
                    "pool_contributions": pool_contributions,
                    "overall_efficiency": efficiency,
                    "calculated_at": datetime.now().isoformat(),
                }

                self.redis_client.setex(f"node:performance:{node_id}", 1800, json.dumps(node_performance))  # 30 minutes

        except Exception as e:
            logger.error(f"Error calculating node performance: {e}")

    async def _update_geographic_distribution(self):
        """Update geographic distribution statistics"""
        try:
            # Calculate hash rate distribution by region
            region_stats = {}

            for node in self.node_registry.values():
                region = node.location
                if region not in region_stats:
                    region_stats[region] = {"total_hash_rate": 0, "active_nodes": 0, "pools": set()}

                region_stats[region]["total_hash_rate"] += node.hash_rate
                region_stats[region]["active_nodes"] += 1
                region_stats[region]["pools"].update(node.active_pools)

            # Convert sets to lists for JSON serialization
            for region_data in region_stats.values():
                region_data["pools"] = list(region_data["pools"])

            # Store geographic distribution
            self.redis_client.setex(
                "orchestrator:geographic_distribution",
                1800,  # 30 minutes
                json.dumps({"regions": region_stats, "updated_at": datetime.now().isoformat()}),
            )

        except Exception as e:
            logger.error(f"Error updating geographic distribution: {e}")

    async def distribution_optimization_loop(self):
        """Optimize mining distribution across pools and nodes"""
        while True:
            try:
                # Analyze current distribution
                current_distribution = self._analyze_current_distribution()

                # Generate optimization recommendations
                optimization_plan = await self._generate_optimization_plan(current_distribution)

                # Apply optimizations
                await self._apply_distribution_optimizations(optimization_plan)

                # Update active distributions
                await self._update_active_distributions()

                await asyncio.sleep(self.rebalance_interval)

            except Exception as e:
                logger.error(f"Error in distribution optimization: {e}")
                await asyncio.sleep(30)

    def _analyze_current_distribution(self) -> Dict[str, Any]:
        """Analyze the current mining distribution"""
        try:
            distribution = {
                "total_nodes": len(self.node_registry),
                "total_hash_rate": 0,
                "pool_distribution": {},
                "geographic_distribution": {},
                "efficiency_metrics": {},
            }

            # Calculate totals
            for node in self.node_registry.values():
                distribution["total_hash_rate"] += node.hash_rate

                # Pool distribution
                for pool in node.active_pools:
                    if pool not in distribution["pool_distribution"]:
                        distribution["pool_distribution"][pool] = 0
                    distribution["pool_distribution"][pool] += node.hash_rate

                # Geographic distribution
                region = node.location
                if region not in distribution["geographic_distribution"]:
                    distribution["geographic_distribution"][region] = 0
                distribution["geographic_distribution"][region] += node.hash_rate

            # Calculate percentages
            for pool in distribution["pool_distribution"]:
                distribution["pool_distribution"][pool] /= max(distribution["total_hash_rate"], 1)

            for region in distribution["geographic_distribution"]:
                distribution["geographic_distribution"][region] /= max(distribution["total_hash_rate"], 1)

            return distribution

        except Exception as e:
            logger.error(f"Error analyzing current distribution: {e}")
            return {}

    async def _generate_optimization_plan(self, current_distribution: Dict[str, Any]) -> Dict[str, Any]:
        """Generate optimization plan for mining distribution"""
        try:
            plan = {
                "recommendations": [],
                "risk_assessment": {},
                "profit_projections": {},
                "timeline": datetime.now().isoformat(),
            }

            # Analyze pool performance
            pool_performance = {}
            for pool_id, network in self.pool_networks.items():
                pool_performance[pool_id] = {
                    "performance_score": network.performance_score,
                    "current_distribution": current_distribution.get("pool_distribution", {}).get(pool_id, 0),
                    "recommended_distribution": self._calculate_optimal_pool_distribution(pool_id),
                }

            # Geographic optimization
            geographic_recommendations = self._optimize_geographic_distribution(current_distribution)

            # Risk assessment
            risk_assessment = self._assess_distribution_risks(current_distribution, pool_performance)

            # Generate specific recommendations
            recommendations = []

            # Pool rebalancing recommendations
            for pool_id, perf_data in pool_performance.items():
                current = perf_data["current_distribution"]
                recommended = perf_data["recommended_distribution"]
                difference = recommended - current

                if abs(difference) > 0.05:  # 5% threshold
                    recommendations.append(
                        {
                            "type": "pool_rebalance",
                            "pool_id": pool_id,
                            "action": "increase" if difference > 0 else "decrease",
                            "magnitude": abs(difference),
                            "reason": f"Performance score: {perf_data['performance_score']:.2f}",
                        }
                    )

            # Geographic recommendations
            recommendations.extend(geographic_recommendations)

            plan["recommendations"] = recommendations
            plan["pool_performance"] = pool_performance
            plan["risk_assessment"] = risk_assessment

            return plan

        except Exception as e:
            logger.error(f"Error generating optimization plan: {e}")
            return {}

    def _calculate_optimal_pool_distribution(self, pool_id: str) -> float:
        """Calculate optimal distribution for a specific pool"""
        try:
            if pool_id not in self.pool_networks:
                return 0.0

            network = self.pool_networks[pool_id]

            # Base distribution on performance score and risk tolerance
            base_distribution = network.performance_score

            # Adjust for geographic diversity
            geographic_bonus = len(network.geographic_distribution) * 0.1

            # Adjust for reward structure preference
            reward_bonus = 0.1 if network.reward_structure == "PPS" else 0.0

            optimal = base_distribution + geographic_bonus + reward_bonus
            return min(1.0, optimal)

        except Exception as e:
            logger.error(f"Error calculating optimal pool distribution: {e}")
            return 0.0

    def _optimize_geographic_distribution(self, current_distribution: Dict[str, Any]) -> List[Dict]:
        """Generate recommendations for geographic distribution optimization"""
        try:
            recommendations = []
            geo_dist = current_distribution.get("geographic_distribution", {})

            # Target balanced distribution
            target_regions = len(self.geographic_zones)
            target_per_region = 1.0 / target_regions

            for region, current_pct in geo_dist.items():
                if current_pct < target_per_region * 0.7:  # Below 70% of target
                    recommendations.append(
                        {
                            "type": "geographic_expansion",
                            "region": region,
                            "action": "increase_capacity",
                            "current_percentage": current_pct,
                            "target_percentage": target_per_region,
                            "reason": "Improve geographic diversity and redundancy",
                        }
                    )

            return recommendations

        except Exception as e:
            logger.error(f"Error optimizing geographic distribution: {e}")
            return []

    def _assess_distribution_risks(self, current_dist: Dict, pool_performance: Dict) -> Dict[str, Any]:
        """Assess risks in current distribution"""
        try:
            assessment = {
                "overall_risk": 0.0,
                "pool_concentration_risk": 0.0,
                "geographic_risk": 0.0,
                "performance_risk": 0.0,
            }

            # Pool concentration risk
            pool_dist = current_dist.get("pool_distribution", {})
            if pool_dist:
                max_pool_pct = max(pool_dist.values())
                assessment["pool_concentration_risk"] = max_pool_pct  # Higher concentration = higher risk

            # Geographic risk
            geo_dist = current_dist.get("geographic_distribution", {})
            if geo_dist:
                max_geo_pct = max(geo_dist.values())
                assessment["geographic_risk"] = max_geo_pct

            # Performance risk
            low_performance_pools = [
                pool_id for pool_id, perf in pool_performance.items() if perf["performance_score"] < 0.3
            ]
            assessment["performance_risk"] = len(low_performance_pools) / max(len(pool_performance), 1)

            # Overall risk (weighted average)
            assessment["overall_risk"] = (
                assessment["pool_concentration_risk"] * 0.4
                + assessment["geographic_risk"] * 0.3
                + assessment["performance_risk"] * 0.3
            )

            return assessment

        except Exception as e:
            logger.error(f"Error assessing distribution risks: {e}")
            return {"overall_risk": 0.5}

    async def _apply_distribution_optimizations(self, optimization_plan: Dict[str, Any]):
        """Apply the generated optimization recommendations"""
        try:
            recommendations = optimization_plan.get("recommendations", [])

            for recommendation in recommendations:
                rec_type = recommendation.get("type")

                if rec_type == "pool_rebalance":
                    await self._apply_pool_rebalance(recommendation)
                elif rec_type == "geographic_expansion":
                    await self._apply_geographic_expansion(recommendation)

            # Publish optimization results
            self.redis_client.publish(
                "orchestrator:optimizations",
                json.dumps(
                    {"type": "optimization_applied", "plan": optimization_plan, "timestamp": datetime.now().isoformat()}
                ),
            )

        except Exception as e:
            logger.error(f"Error applying distribution optimizations: {e}")

    async def _apply_pool_rebalance(self, recommendation: Dict):
        """Apply pool rebalancing recommendation"""
        try:
            pool_id = recommendation["pool_id"]
            action = recommendation["action"]
            magnitude = recommendation["magnitude"]

            # Find nodes that can be adjusted
            candidate_nodes = [
                node for node in self.node_registry.values() if pool_id in self.known_pools  # Valid pool
            ]

            if not candidate_nodes:
                return

            # Create distribution adjustments
            adjustments = []
            for node in candidate_nodes[:5]:  # Limit to 5 nodes for this example
                adjustment = MiningDistribution(
                    strategy_id=str(uuid.uuid4()),
                    node_id=node.node_id,
                    pool_allocations=self._calculate_node_pool_allocation(node, pool_id, action, magnitude),
                    geographic_targets={},
                    profit_optimization=0.1,
                    risk_distribution=self.risk_tolerance,
                    created_at=datetime.now(),
                    expires_at=datetime.now() + timedelta(hours=1),
                )

                adjustments.append(adjustment)
                self.active_distributions[adjustment.strategy_id] = adjustment

            # Store adjustments
            for adjustment in adjustments:
                self.redis_client.setex(
                    f"distribution:{adjustment.strategy_id}", 3600, json.dumps(asdict(adjustment))  # 1 hour
                )

            logger.info(f"Applied pool rebalance for {pool_id}: {action} by {magnitude:.1%}")

        except Exception as e:
            logger.error(f"Error applying pool rebalance: {e}")

    def _calculate_node_pool_allocation(
        self, node: MiningNode, target_pool: str, action: str, magnitude: float
    ) -> Dict[str, float]:
        """Calculate new pool allocation for a node"""
        try:
            current_allocations = {}

            # Get current allocations (simplified - assume equal distribution)
            pools = node.active_pools or [target_pool]
            equal_share = 1.0 / len(pools)

            for pool in pools:
                current_allocations[pool] = equal_share

            # Adjust target pool allocation
            if target_pool in current_allocations:
                if action == "increase":
                    current_allocations[target_pool] = min(1.0, current_allocations[target_pool] + magnitude)
                elif action == "decrease":
                    current_allocations[target_pool] = max(0.0, current_allocations[target_pool] - magnitude)

                # Re-normalize
                total = sum(current_allocations.values())
                if total > 0:
                    for pool in current_allocations:
                        current_allocations[pool] /= total

            return current_allocations

        except Exception as e:
            logger.error(f"Error calculating node pool allocation: {e}")
            return {target_pool: 1.0}

    async def _apply_geographic_expansion(self, recommendation: Dict):
        """Apply geographic expansion recommendation"""
        try:
            region = recommendation["region"]

            # Find nodes in the region or nearby
            region_nodes = [node for node in self.node_registry.values() if node.location == region]

            if not region_nodes:
                logger.info(f"No nodes available in region {region} for expansion")
                return

            # Create expansion strategy
            expansion_strategy = {
                "type": "geographic_expansion",
                "region": region,
                "target_nodes": [node.node_id for node in region_nodes[:3]],  # Top 3 nodes
                "expansion_goal": "Increase regional capacity by 20%",
                "created_at": datetime.now().isoformat(),
            }

            # Store expansion strategy
            strategy_id = str(uuid.uuid4())
            self.redis_client.setex(f"expansion:{strategy_id}", 7200, json.dumps(expansion_strategy))  # 2 hours

            logger.info(f"Applied geographic expansion for region {region}")

        except Exception as e:
            logger.error(f"Error applying geographic expansion: {e}")

    async def _update_active_distributions(self):
        """Update and clean up active distributions"""
        try:
            # Remove expired distributions
            current_time = datetime.now()
            expired_distributions = []

            for strategy_id, distribution in self.active_distributions.items():
                if current_time > distribution.expires_at:
                    expired_distributions.append(strategy_id)

            for strategy_id in expired_distributions:
                del self.active_distributions[strategy_id]
                self.redis_client.delete(f"distribution:{strategy_id}")

        except Exception as e:
            logger.error(f"Error updating active distributions: {e}")

    async def network_health_check_loop(self):
        """Monitor overall network health"""
        while True:
            try:
                # Check pool network health
                await self._check_pool_health()

                # Check node connectivity
                await self._check_node_connectivity()

                # Generate health report
                health_report = self._generate_health_report()

                # Store health report
                self.redis_client.setex("orchestrator:health_report", 300, json.dumps(health_report))  # 5 minutes

                await asyncio.sleep(120)  # Check every 2 minutes

            except Exception as e:
                logger.error(f"Error in network health check: {e}")
                await asyncio.sleep(30)

    async def _check_pool_health(self):
        """Check health of pool networks"""
        try:
            for pool_id, network in self.pool_networks.items():
                # Check if pool is responsive (simplified check)
                is_responsive = await self._check_pool_responsiveness(pool_id)

                # Update network health
                health_key = f"network:health:{pool_id}"
                health_data = {
                    "pool_id": pool_id,
                    "responsive": is_responsive,
                    "last_check": datetime.now().isoformat(),
                    "active_miners": network.active_miners,
                    "performance_score": network.performance_score,
                }

                self.redis_client.setex(health_key, 600, json.dumps(health_data))  # 10 minutes

        except Exception as e:
            logger.error(f"Error checking pool health: {e}")

    async def _check_pool_responsiveness(self, pool_id: str) -> bool:
        """Check if a pool is responsive"""
        try:
            # Simplified responsiveness check
            # In production, this would make actual network requests
            pool_config = self.known_pools.get(pool_id, {})
            pool_url = pool_config.get("url", "")

            if not pool_url:
                return False

            # For now, assume pools are responsive if they exist in our config
            return True

        except Exception as e:
            logger.error(f"Error checking pool responsiveness: {e}")
            return False

    async def _check_node_connectivity(self):
        """Check connectivity of mining nodes"""
        try:
            connectivity_report = {}

            for node_id, node in self.node_registry.items():
                # Check if node is reachable
                is_reachable = await self._check_node_reachability(node)

                connectivity_report[node_id] = {
                    "reachable": is_reachable,
                    "last_seen": node.last_seen.isoformat(),
                    "ip_address": node.ip_address,
                }

            # Store connectivity report
            self.redis_client.setex("orchestrator:node_connectivity", 300, json.dumps(connectivity_report))  # 5 minutes

        except Exception as e:
            logger.error(f"Error checking node connectivity: {e}")

    async def _check_node_reachability(self, node: MiningNode) -> bool:
        """Check if a mining node is reachable"""
        try:
            # Simple connectivity check
            future = asyncio.open_connection(node.ip_address, self.discovery_port)
            reader, writer = await asyncio.wait_for(future, timeout=5.0)

            # Send ping
            ping_msg = json.dumps({"type": "ping", "timestamp": datetime.now().isoformat()})
            writer.write(ping_msg.encode())
            await writer.drain()

            # Wait for pong
            data = await asyncio.wait_for(reader.read(1024), timeout=2.0)
            response = json.loads(data.decode())

            writer.close()
            await writer.wait_closed()

            return response.get("type") == "pong"

        except Exception:
            return False

    def _generate_health_report(self) -> Dict[str, Any]:
        """Generate overall network health report"""
        try:
            report = {
                "timestamp": datetime.now().isoformat(),
                "network_status": "healthy",
                "active_nodes": len(self.node_registry),
                "active_pools": len(self.pool_networks),
                "total_hash_rate": sum(node.hash_rate for node in self.node_registry.values()),
                "issues": [],
            }

            # Check for issues
            if len(self.node_registry) < 3:
                report["issues"].append("Low node count")
                report["network_status"] = "warning"

            if len(self.pool_networks) < 2:
                report["issues"].append("Limited pool diversity")
                report["network_status"] = "warning"

            inactive_nodes = sum(1 for node in self.node_registry.values() if node.status != "active")
            if inactive_nodes > len(self.node_registry) * 0.3:  # More than 30% inactive
                report["issues"].append("High node inactivity")
                report["network_status"] = "critical"

            return report

        except Exception as e:
            logger.error(f"Error generating health report: {e}")
            return {"error": str(e)}

    async def _store_performance_metrics(self):
        """Store comprehensive performance metrics"""
        try:
            metrics = {
                "timestamp": datetime.now().isoformat(),
                "nodes": {
                    "total": len(self.node_registry),
                    "active": sum(1 for node in self.node_registry.values() if node.status == "active"),
                    "total_hash_rate": sum(node.hash_rate for node in self.node_registry.values()),
                },
                "pools": {
                    "total": len(self.pool_networks),
                    "total_hash_rate": sum(network.total_hash_rate for network in self.pool_networks.values()),
                    "active_miners": sum(network.active_miners for network in self.pool_networks.values()),
                },
                "distribution": self._analyze_current_distribution(),
                "efficiency": self._calculate_network_efficiency(),
            }

            # Store metrics
            self.redis_client.setex("orchestrator:performance_metrics", 1800, json.dumps(metrics))  # 30 minutes

        except Exception as e:
            logger.error(f"Error storing performance metrics: {e}")

    def _calculate_network_efficiency(self) -> float:
        """Calculate overall network efficiency"""
        try:
            if not self.node_registry or not self.pool_networks:
                return 0.0

            # Efficiency based on distribution balance and performance
            distribution = self._analyze_current_distribution()

            # Geographic diversity efficiency
            geo_dist = distribution.get("geographic_distribution", {})
            geo_efficiency = 1.0 / (1.0 + len(geo_dist))  # More regions = higher efficiency

            # Pool diversity efficiency
            pool_dist = distribution.get("pool_distribution", {})
            pool_efficiency = 1.0 / (1.0 + len(pool_dist))

            # Performance efficiency
            avg_performance = (
                statistics.mean([network.performance_score for network in self.pool_networks.values()])
                if self.pool_networks
                else 0.0
            )

            # Combine efficiencies
            overall_efficiency = geo_efficiency * 0.3 + pool_efficiency * 0.3 + avg_performance * 0.4

            return overall_efficiency

        except Exception as e:
            logger.error(f"Error calculating network efficiency: {e}")
            return 0.0

    async def get_orchestrator_status(self) -> Dict[str, Any]:
        """Get comprehensive orchestrator status"""
        try:
            return {
                "active_nodes": len(self.node_registry),
                "active_pools": len(self.pool_networks),
                "active_distributions": len(self.active_distributions),
                "network_efficiency": self._calculate_network_efficiency(),
                "last_optimization": datetime.now().isoformat(),
                "geographic_regions": list(set(node.location for node in self.node_registry.values())),
                "pool_distribution": self._analyze_current_distribution().get("pool_distribution", {}),
                "health_status": self._generate_health_report(),
            }

        except Exception as e:
            logger.error(f"Error getting orchestrator status: {e}")
            return {"error": str(e)}


async def main():
    """Main function for distributed mining orchestrator"""
    orchestrator = DistributedMiningOrchestrator()

    # Start orchestrator
    await orchestrator.start_orchestrator()

    # Keep running
    while True:
        await asyncio.sleep(60)

        # Log status periodically
        status = await orchestrator.get_orchestrator_status()
        logger.info(
            f"Orchestrator Status: {status['active_nodes']} nodes, "
            f"{status['active_pools']} pools, efficiency: {status['network_efficiency']:.2f}"
        )


if __name__ == "__main__":
    asyncio.run(main())
