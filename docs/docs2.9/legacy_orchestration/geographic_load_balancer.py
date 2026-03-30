#!/usr/bin/env python3
"""
ZION Geographic Load Balancer
Intelligent Geographic Distribution and Load Balancing System

This module implements geographic load balancing for:
- Geographic mining distribution
- Latency optimization
- Regional performance monitoring
- Cross-continent coordination
- Network topology awareness
"""

import asyncio
import json
import logging
import socket
import statistics
from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple

import geoip2.database
import numpy as np
import redis

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class GeographicRegion(Enum):
    """Enumeration of geographic regions"""

    NORTH_AMERICA = "north_america"
    SOUTH_AMERICA = "south_america"
    EUROPE = "europe"
    ASIA = "asia"
    AFRICA = "africa"
    AUSTRALIA = "australia"
    ANTARCTICA = "antarctica"


@dataclass
class GeographicNode:
    """Data class for geographic node information"""

    node_id: str
    region: GeographicRegion
    country: str
    city: str
    latitude: float
    longitude: float
    ip_address: str
    hash_rate: float
    ping_time: int  # milliseconds
    uptime: float
    last_seen: datetime
    active: bool = True


@dataclass
class LoadDistribution:
    """Data class for load distribution across regions"""

    region: GeographicRegion
    target_percentage: float
    current_percentage: float
    hash_rate: float
    node_count: int
    efficiency_score: float


class GeographicLoadBalancer:
    """AI-powered geographic load balancing system"""

    def __init__(
        self,
        redis_host: str = "localhost",
        redis_port: int = 6379,
        geoip_db_path: str = "/usr/share/GeoIP/GeoLite2-City.mmdb",
    ):
        self.redis_client = redis.Redis(host=redis_host, port=redis_port, decode_responses=True)

        # Geographic configuration
        self.geoip_db_path = geoip_db_path
        self.geoip_reader = None

        # Load balancing state
        self.nodes = {}  # node_id -> GeographicNode
        self.regional_distribution = {}  # region -> LoadDistribution
        self.target_distribution = self._get_default_target_distribution()

        # Balancing parameters
        self.rebalance_threshold = 0.1  # 10% deviation triggers rebalancing
        self.max_region_imbalance = 0.2  # 20% maximum imbalance
        self.ping_weight = 0.3
        self.uptime_weight = 0.4
        self.hashrate_weight = 0.3

        # Network topology
        self.region_latencies = self._get_region_latencies()
        self.optimal_paths = {}

        logger.info("Geographic Load Balancer initialized")

    def _get_default_target_distribution(self) -> Dict[GeographicRegion, float]:
        """Get default target distribution percentages"""
        return {
            GeographicRegion.NORTH_AMERICA: 0.25,
            GeographicRegion.EUROPE: 0.25,
            GeographicRegion.ASIA: 0.30,
            GeographicRegion.SOUTH_AMERICA: 0.08,
            GeographicRegion.AFRICA: 0.07,
            GeographicRegion.AUSTRALIA: 0.04,
            GeographicRegion.ANTARCTICA: 0.01,
        }

    def _get_region_latencies(self) -> Dict[Tuple[GeographicRegion, GeographicRegion], int]:
        """Get estimated latencies between regions (milliseconds)"""
        return {
            (GeographicRegion.NORTH_AMERICA, GeographicRegion.EUROPE): 80,
            (GeographicRegion.NORTH_AMERICA, GeographicRegion.ASIA): 150,
            (GeographicRegion.EUROPE, GeographicRegion.ASIA): 200,
            (GeographicRegion.EUROPE, GeographicRegion.AFRICA): 120,
            (GeographicRegion.ASIA, GeographicRegion.AUSTRALIA): 100,
            (GeographicRegion.NORTH_AMERICA, GeographicRegion.SOUTH_AMERICA): 50,
            (GeographicRegion.ASIA, GeographicRegion.AFRICA): 250,
        }

    async def start_geographic_balancer(self):
        """Start the geographic load balancing engine"""
        logger.info("Starting Geographic Load Balancing Engine...")

        # Initialize GeoIP database
        await self._initialize_geoip()

        # Start background monitoring and balancing
        asyncio.create_task(self.node_discovery_loop())
        asyncio.create_task(self.load_monitoring_loop())
        asyncio.create_task(self.rebalancing_loop())
        asyncio.create_task(self.network_topology_monitor())

        logger.info("Geographic Load Balancing Engine started")

    async def _initialize_geoip(self):
        """Initialize GeoIP database reader"""
        try:
            import geoip2.database

            self.geoip_reader = geoip2.database.Reader(self.geoip_db_path)
            logger.info("GeoIP database initialized")
        except Exception as e:
            logger.warning(f"GeoIP database not available: {e}. Using fallback location detection.")
            self.geoip_reader = None

    async def node_discovery_loop(self):
        """Continuously discover and update geographic nodes"""
        while True:
            try:
                # Discover new nodes
                await self._discover_nodes()

                # Update existing nodes
                await self._update_node_status()

                # Remove inactive nodes
                await self._cleanup_inactive_nodes()

                await asyncio.sleep(300)  # Update every 5 minutes

            except Exception as e:
                logger.error(f"Error in node discovery: {e}")
                await asyncio.sleep(60)

    async def _discover_nodes(self):
        """Discover new geographic nodes"""
        try:
            # Get node data from Redis (published by mining nodes)
            node_keys = self.redis_client.keys("node:geographic:*")

            for key in node_keys:
                node_id = key.split(":")[-1]
                node_data = self.redis_client.get(key)

                if node_data:
                    data = json.loads(node_data)

                    # Create or update node
                    if node_id not in self.nodes:
                        # Determine geographic location
                        geo_info = await self._get_geographic_info(data.get("ip_address", ""))

                        node = GeographicNode(
                            node_id=node_id,
                            region=geo_info["region"],
                            country=geo_info["country"],
                            city=geo_info["city"],
                            latitude=geo_info["latitude"],
                            longitude=geo_info["longitude"],
                            ip_address=data.get("ip_address", ""),
                            hash_rate=data.get("hash_rate", 0),
                            ping_time=data.get("ping_time", 0),
                            uptime=data.get("uptime", 1.0),
                            last_seen=datetime.now(),
                        )
                        self.nodes[node_id] = node
                        logger.info(f"Discovered new geographic node: {node_id} in {geo_info['region'].value}")
                    else:
                        # Update existing node
                        node = self.nodes[node_id]
                        node.hash_rate = data.get("hash_rate", node.hash_rate)
                        node.ping_time = data.get("ping_time", node.ping_time)
                        node.uptime = data.get("uptime", node.uptime)
                        node.last_seen = datetime.now()
                        node.active = True

        except Exception as e:
            logger.error(f"Error discovering nodes: {e}")

    async def _get_geographic_info(self, ip_address: str) -> Dict[str, Any]:
        """Get geographic information for an IP address"""
        try:
            if self.geoip_reader and ip_address:
                response = self.geoip_reader.city(ip_address)

                # Map country to region
                region = self._country_to_region(response.country.iso_code)

                return {
                    "region": region,
                    "country": response.country.name or "Unknown",
                    "city": response.city.name or "Unknown",
                    "latitude": response.location.latitude or 0.0,
                    "longitude": response.location.longitude or 0.0,
                }
            else:
                # Fallback: determine region from IP (simplified)
                return await self._fallback_geographic_detection(ip_address)

        except Exception as e:
            logger.error(f"Error getting geographic info for {ip_address}: {e}")
            return await self._fallback_geographic_detection(ip_address)

    def _country_to_region(self, country_code: str) -> GeographicRegion:
        """Map country code to geographic region"""
        region_mapping = {
            # North America
            "US": GeographicRegion.NORTH_AMERICA,
            "CA": GeographicRegion.NORTH_AMERICA,
            "MX": GeographicRegion.NORTH_AMERICA,
            "CU": GeographicRegion.NORTH_AMERICA,
            # South America
            "BR": GeographicRegion.SOUTH_AMERICA,
            "AR": GeographicRegion.SOUTH_AMERICA,
            "CL": GeographicRegion.SOUTH_AMERICA,
            "CO": GeographicRegion.SOUTH_AMERICA,
            "PE": GeographicRegion.SOUTH_AMERICA,
            "VE": GeographicRegion.SOUTH_AMERICA,
            # Europe
            "GB": GeographicRegion.EUROPE,
            "DE": GeographicRegion.EUROPE,
            "FR": GeographicRegion.EUROPE,
            "IT": GeographicRegion.EUROPE,
            "ES": GeographicRegion.EUROPE,
            "NL": GeographicRegion.EUROPE,
            "BE": GeographicRegion.EUROPE,
            "CH": GeographicRegion.EUROPE,
            "AT": GeographicRegion.EUROPE,
            "SE": GeographicRegion.EUROPE,
            "NO": GeographicRegion.EUROPE,
            "DK": GeographicRegion.EUROPE,
            "FI": GeographicRegion.EUROPE,
            "PL": GeographicRegion.EUROPE,
            "RU": GeographicRegion.EUROPE,
            # Asia
            "CN": GeographicRegion.ASIA,
            "JP": GeographicRegion.ASIA,
            "KR": GeographicRegion.ASIA,
            "IN": GeographicRegion.ASIA,
            "SG": GeographicRegion.ASIA,
            "HK": GeographicRegion.ASIA,
            "TW": GeographicRegion.ASIA,
            "TH": GeographicRegion.ASIA,
            "MY": GeographicRegion.ASIA,
            "ID": GeographicRegion.ASIA,
            "PH": GeographicRegion.ASIA,
            "VN": GeographicRegion.ASIA,
            # Africa
            "ZA": GeographicRegion.AFRICA,
            "EG": GeographicRegion.AFRICA,
            "NG": GeographicRegion.AFRICA,
            "KE": GeographicRegion.AFRICA,
            "MA": GeographicRegion.AFRICA,
            "TN": GeographicRegion.AFRICA,
            "GH": GeographicRegion.AFRICA,
            "ET": GeographicRegion.AFRICA,
            # Australia/Oceania
            "AU": GeographicRegion.AUSTRALIA,
            "NZ": GeographicRegion.AUSTRALIA,
        }

        return region_mapping.get(country_code, GeographicRegion.NORTH_AMERICA)

    async def _fallback_geographic_detection(self, ip_address: str) -> Dict[str, Any]:
        """Fallback geographic detection when GeoIP is unavailable"""
        # Simplified fallback - in real implementation, use external APIs
        return {
            "region": GeographicRegion.NORTH_AMERICA,
            "country": "Unknown",
            "city": "Unknown",
            "latitude": 40.7128,  # Default to NYC
            "longitude": -74.0060,
        }

    async def _update_node_status(self):
        """Update status of existing nodes"""
        try:
            for node in self.nodes.values():
                # Check if node is still active (last seen within 10 minutes)
                if (datetime.now() - node.last_seen).total_seconds() > 600:
                    node.active = False
                    logger.warning(f"Node {node.node_id} marked as inactive")

        except Exception as e:
            logger.error(f"Error updating node status: {e}")

    async def _cleanup_inactive_nodes(self):
        """Remove inactive nodes after extended period"""
        try:
            cutoff_time = datetime.now() - timedelta(hours=24)
            inactive_nodes = [
                node_id for node_id, node in self.nodes.items() if not node.active and node.last_seen < cutoff_time
            ]

            for node_id in inactive_nodes:
                del self.nodes[node_id]
                logger.info(f"Removed inactive node: {node_id}")

        except Exception as e:
            logger.error(f"Error cleaning up inactive nodes: {e}")

    async def load_monitoring_loop(self):
        """Monitor load distribution across geographic regions"""
        while True:
            try:
                # Calculate current distribution
                await self._calculate_regional_distribution()

                # Monitor imbalances
                await self._monitor_distribution_imbalances()

                # Update efficiency scores
                await self._update_regional_efficiency()

                await asyncio.sleep(120)  # Update every 2 minutes

            except Exception as e:
                logger.error(f"Error in load monitoring: {e}")
                await asyncio.sleep(60)

    async def _calculate_regional_distribution(self):
        """Calculate current load distribution across regions"""
        try:
            total_hashrate = sum(node.hash_rate for node in self.nodes.values() if node.active)

            if total_hashrate == 0:
                return

            # Calculate distribution per region
            for region in GeographicRegion:
                region_nodes = [node for node in self.nodes.values() if node.region == region and node.active]

                region_hashrate = sum(node.hash_rate for node in region_nodes)
                region_percentage = region_hashrate / total_hashrate if total_hashrate > 0 else 0

                target_percentage = self.target_distribution.get(region, 0)

                # Calculate efficiency score
                efficiency_score = self._calculate_region_efficiency(region_nodes)

                distribution = LoadDistribution(
                    region=region,
                    target_percentage=target_percentage,
                    current_percentage=region_percentage,
                    hash_rate=region_hashrate,
                    node_count=len(region_nodes),
                    efficiency_score=efficiency_score,
                )

                self.regional_distribution[region] = distribution

        except Exception as e:
            logger.error(f"Error calculating regional distribution: {e}")

    def _calculate_region_efficiency(self, region_nodes: List[GeographicNode]) -> float:
        """Calculate efficiency score for a region"""
        try:
            if not region_nodes:
                return 0.0

            # Efficiency based on uptime, ping time, and hashrate stability
            avg_uptime = statistics.mean(node.uptime for node in region_nodes)
            avg_ping = statistics.mean(node.ping_time for node in region_nodes)

            # Normalize ping time (lower is better, max 500ms = 0 efficiency)
            ping_efficiency = max(0, 1.0 - (avg_ping / 500.0))

            # Combine factors
            efficiency = (
                avg_uptime * self.uptime_weight
                + ping_efficiency * self.ping_weight
                + 0.8 * self.hashrate_weight  # Assume stable hashrate for now
            )

            return min(1.0, efficiency)

        except Exception:
            return 0.5

    async def _monitor_distribution_imbalances(self):
        """Monitor and log distribution imbalances"""
        try:
            imbalances = []

            for region, distribution in self.regional_distribution.items():
                deviation = abs(distribution.current_percentage - distribution.target_percentage)

                if deviation > self.rebalance_threshold:
                    imbalance_info = {
                        "region": region.value,
                        "target": distribution.target_percentage,
                        "current": distribution.current_percentage,
                        "deviation": deviation,
                        "severity": "high" if deviation > self.max_region_imbalance else "medium",
                    }
                    imbalances.append(imbalance_info)

            if imbalances:
                # Store imbalances for rebalancing
                self.redis_client.setex("balancer:imbalances", 300, json.dumps(imbalances))  # 5 minutes

                logger.info(f"Detected {len(imbalances)} regional imbalances")

        except Exception as e:
            logger.error(f"Error monitoring distribution imbalances: {e}")

    async def _update_regional_efficiency(self):
        """Update regional efficiency scores"""
        try:
            efficiency_data = {
                region.value: {
                    "efficiency": distribution.efficiency_score,
                    "hashrate": distribution.hash_rate,
                    "node_count": distribution.node_count,
                    "target_percentage": distribution.target_percentage,
                    "current_percentage": distribution.current_percentage,
                }
                for region, distribution in self.regional_distribution.items()
            }

            self.redis_client.setex("balancer:efficiency", 300, json.dumps(efficiency_data))  # 5 minutes

        except Exception as e:
            logger.error(f"Error updating regional efficiency: {e}")

    async def rebalancing_loop(self):
        """Main loop for geographic rebalancing"""
        while True:
            try:
                # Check if rebalancing is needed
                if await self._should_rebalance():
                    # Calculate rebalancing actions
                    rebalance_actions = await self._calculate_rebalance_actions()

                    if rebalance_actions:
                        # Execute rebalancing
                        await self._execute_rebalancing(rebalance_actions)

                await asyncio.sleep(600)  # Check every 10 minutes

            except Exception as e:
                logger.error(f"Error in rebalancing loop: {e}")
                await asyncio.sleep(120)

    async def _should_rebalance(self) -> bool:
        """Determine if geographic rebalancing is needed"""
        try:
            imbalances = self.redis_client.get("balancer:imbalances")

            if not imbalances:
                return False

            imbalance_data = json.loads(imbalances)
            high_priority_imbalances = [
                imb
                for imb in imbalance_data
                if imb["severity"] == "high" or imb["deviation"] > self.max_region_imbalance
            ]

            return len(high_priority_imbalances) > 0

        except Exception as e:
            logger.error(f"Error checking rebalance need: {e}")
            return False

    async def _calculate_rebalance_actions(self) -> List[Dict[str, Any]]:
        """Calculate actions needed for geographic rebalancing"""
        try:
            actions = []
            imbalances = json.loads(self.redis_client.get("balancer:imbalances") or "[]")

            for imbalance in imbalances:
                region = GeographicRegion(imbalance["region"])
                deviation = imbalance["deviation"]

                if deviation > self.rebalance_threshold:
                    # Determine action type
                    if imbalance["current"] > imbalance["target"]:
                        # Too many nodes in this region, suggest moving some out
                        action = {
                            "type": "reduce_load",
                            "region": region.value,
                            "target_reduction": deviation * 0.5,  # Reduce by half the deviation
                            "priority": "high" if imbalance["severity"] == "high" else "medium",
                        }
                    else:
                        # Too few nodes in this region, suggest adding load
                        action = {
                            "type": "increase_load",
                            "region": region.value,
                            "target_increase": deviation * 0.5,
                            "priority": "high" if imbalance["severity"] == "high" else "medium",
                        }

                    actions.append(action)

            return actions

        except Exception as e:
            logger.error(f"Error calculating rebalance actions: {e}")
            return []

    async def _execute_rebalancing(self, actions: List[Dict[str, Any]]):
        """Execute geographic rebalancing actions"""
        try:
            logger.info(f"Executing {len(actions)} geographic rebalancing actions")

            for action in actions:
                # Send rebalancing command to distributed orchestrator
                rebalance_command = {
                    "type": "geographic_rebalance",
                    "action": action,
                    "timestamp": datetime.now().isoformat(),
                    "balancer_id": "zion-geographic-balancer",
                }

                self.redis_client.publish("mining:rebalance", json.dumps(rebalance_command))

                logger.info(f"Sent rebalancing action: {action['type']} for {action['region']}")

            # Store rebalancing history
            history_entry = {"timestamp": datetime.now().isoformat(), "actions": actions, "total_actions": len(actions)}

            self.redis_client.lpush("balancer:rebalance_history", json.dumps(history_entry))
            self.redis_client.ltrim("balancer:rebalance_history", 0, 49)  # Keep last 50 entries

        except Exception as e:
            logger.error(f"Error executing rebalancing: {e}")

    async def network_topology_monitor(self):
        """Monitor and optimize network topology"""
        while True:
            try:
                # Update network paths
                await self._update_network_paths()

                # Optimize routing
                await self._optimize_network_routing()

                # Monitor latency changes
                await self._monitor_latency_changes()

                await asyncio.sleep(1800)  # Update every 30 minutes

            except Exception as e:
                logger.error(f"Error in network topology monitor: {e}")
                await asyncio.sleep(300)

    async def _update_network_paths(self):
        """Update optimal network paths between regions"""
        try:
            # Calculate optimal paths based on current latencies
            for source_region in GeographicRegion:
                for dest_region in GeographicRegion:
                    if source_region != dest_region:
                        # Find optimal path (direct or via intermediate)
                        direct_latency = self.region_latencies.get((source_region, dest_region), 1000)

                        # Check paths via intermediate regions
                        min_latency = direct_latency
                        optimal_path = [source_region, dest_region]

                        for intermediate in GeographicRegion:
                            if intermediate not in [source_region, dest_region]:
                                path1 = self.region_latencies.get((source_region, intermediate), 1000)
                                path2 = self.region_latencies.get((intermediate, dest_region), 1000)

                                if path1 + path2 < min_latency:
                                    min_latency = path1 + path2
                                    optimal_path = [source_region, intermediate, dest_region]

                        self.optimal_paths[(source_region, dest_region)] = {
                            "latency": min_latency,
                            "path": [r.value for r in optimal_path],
                            "direct": len(optimal_path) == 2,
                        }

        except Exception as e:
            logger.error(f"Error updating network paths: {e}")

    async def _optimize_network_routing(self):
        """Optimize network routing based on current conditions"""
        try:
            # This would integrate with actual network routing in a real implementation
            # For now, just log optimal paths
            optimal_routes = {
                f"{source.value}->{dest.value}": path_info for (source, dest), path_info in self.optimal_paths.items()
            }

            self.redis_client.setex("balancer:optimal_routes", 1800, json.dumps(optimal_routes))  # 30 minutes

        except Exception as e:
            logger.error(f"Error optimizing network routing: {e}")

    async def _monitor_latency_changes(self):
        """Monitor changes in inter-region latencies"""
        try:
            # In a real implementation, this would measure actual latencies
            # For now, simulate latency monitoring
            latency_changes = {}

            for (region1, region2), latency in self.region_latencies.items():
                # Simulate small random changes
                change = np.random.normal(0, 5)  # Mean 0, std dev 5ms
                new_latency = max(10, latency + change)  # Minimum 10ms

                if abs(change) > 10:  # Significant change
                    latency_changes[f"{region1.value}_{region2.value}"] = {
                        "old_latency": latency,
                        "new_latency": new_latency,
                        "change": change,
                        "significant": True,
                    }

                # Update stored latency
                self.region_latencies[(region1, region2)] = new_latency

            if latency_changes:
                self.redis_client.setex("balancer:latency_changes", 900, json.dumps(latency_changes))  # 15 minutes

        except Exception as e:
            logger.error(f"Error monitoring latency changes: {e}")

    async def get_geographic_status(self) -> Dict[str, Any]:
        """Get comprehensive geographic load balancing status"""
        try:
            nodes_by_region = {}
            for node in self.nodes.values():
                region = node.region.value
                if region not in nodes_by_region:
                    nodes_by_region[region] = []
                nodes_by_region[region].append(
                    {
                        "node_id": node.node_id,
                        "hash_rate": node.hash_rate,
                        "ping_time": node.ping_time,
                        "uptime": node.uptime,
                        "active": node.active,
                        "last_seen": node.last_seen.isoformat(),
                    }
                )

            return {
                "total_nodes": len(self.nodes),
                "active_nodes": sum(1 for node in self.nodes.values() if node.active),
                "regional_distribution": {
                    region.value: {
                        "target_percentage": dist.target_percentage,
                        "current_percentage": dist.current_percentage,
                        "hash_rate": dist.hash_rate,
                        "node_count": dist.node_count,
                        "efficiency_score": dist.efficiency_score,
                        "nodes": nodes_by_region.get(region.value, []),
                    }
                    for region, dist in self.regional_distribution.items()
                },
                "imbalances": json.loads(self.redis_client.get("balancer:imbalances") or "[]"),
                "optimal_routes": self.redis_client.get("balancer:optimal_routes"),
                "last_updated": datetime.now().isoformat(),
            }

        except Exception as e:
            logger.error(f"Error getting geographic status: {e}")
            return {"error": str(e)}

    async def set_target_distribution(self, new_distribution: Dict[str, float]):
        """Set new target distribution for regions"""
        try:
            # Validate distribution
            total = sum(new_distribution.values())
            if abs(total - 1.0) > 0.01:  # Allow small rounding errors
                raise ValueError("Target distribution must sum to 1.0")

            # Update target distribution
            self.target_distribution = {
                GeographicRegion(region): percentage for region, percentage in new_distribution.items()
            }

            logger.info(f"Updated target geographic distribution: {new_distribution}")

            # Store in Redis
            self.redis_client.set("balancer:target_distribution", json.dumps(new_distribution))

        except Exception as e:
            logger.error(f"Error setting target distribution: {e}")
            raise

    async def predict_geographic_shifts(self, hours_ahead: int = 24) -> Dict[str, Any]:
        """Predict geographic mining shifts"""
        try:
            predictions = {}

            # Simple prediction based on current trends
            for region, distribution in self.regional_distribution.items():
                current_percentage = distribution.current_percentage
                target_percentage = distribution.target_percentage

                # Predict convergence toward target
                convergence_rate = 0.1  # 10% convergence per day
                days = hours_ahead / 24.0
                predicted_percentage = current_percentage + (target_percentage - current_percentage) * (
                    1 - (1 - convergence_rate) ** days
                )

                predictions[region.value] = {
                    "current_percentage": current_percentage,
                    "target_percentage": target_percentage,
                    "predicted_percentage": predicted_percentage,
                    "change_expected": predicted_percentage - current_percentage,
                }

            return {"predictions": predictions, "hours_ahead": hours_ahead, "timestamp": datetime.now().isoformat()}

        except Exception as e:
            logger.error(f"Error predicting geographic shifts: {e}")
            return {"error": str(e)}


async def main():
    """Main function for geographic load balancer"""
    balancer = GeographicLoadBalancer()

    # Start geographic balancer
    await balancer.start_geographic_balancer()

    # Keep running
    while True:
        await asyncio.sleep(300)

        # Log status periodically
        status = await balancer.get_geographic_status()
        logger.info(f"Geographic Balancer: {status['active_nodes']}/{status['total_nodes']} active nodes")


if __name__ == "__main__":
    asyncio.run(main())
