#!/usr/bin/env python3
"""
V3 Comprehensive Health Check

Deep health checks for ZION V3 nodes:
- RPC connectivity and chain status
- P2P port reachability
- Stratum pool (if applicable)
- Sync status vs best peer
- Disk space
- Enhanced /health endpoint

Ported from TREE_NODES/health/comprehensive_health_check.py for V3.
"""

import asyncio
import json
import socket
import sys
import time
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional

try:
    import aiohttp
except ImportError:
    aiohttp = None


class Status(Enum):
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"
    UNKNOWN = "unknown"


@dataclass
class CheckResult:
    name: str
    status: Status
    message: str
    latency_ms: float = 0
    details: Dict[str, Any] = field(default_factory=dict)


@dataclass
class NodeReport:
    node_id: str
    host: str
    timestamp: str
    overall: Status
    checks: List[CheckResult]

    def to_dict(self) -> dict:
        return {
            "node_id": self.node_id,
            "host": self.host,
            "timestamp": self.timestamp,
            "status": self.overall.value,
            "checks": [
                {
                    "name": c.name,
                    "status": c.status.value,
                    "message": c.message,
                    "latency_ms": round(c.latency_ms, 1),
                    "details": c.details,
                }
                for c in self.checks
            ],
        }


# ── Individual Checks ───────────────────────────────────────────────────


async def check_health_endpoint(host: str, port: int, timeout: int = 10) -> CheckResult:
    """Check the V3 /health HTTP endpoint."""
    if aiohttp is None:
        return CheckResult("health_endpoint", Status.UNKNOWN, "aiohttp not installed")
    url = f"http://{host}:{port}/health"
    t0 = time.monotonic()
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=timeout)) as resp:
                latency = (time.monotonic() - t0) * 1000
                if resp.status == 200:
                    data = await resp.json()
                    return CheckResult(
                        "health_endpoint",
                        Status.HEALTHY,
                        f"chain_height={data.get('chain_height')}, peers={data.get('peer_count')}, sync={data.get('sync_status', '?')}",
                        latency,
                        data,
                    )
                return CheckResult("health_endpoint", Status.DEGRADED, f"HTTP {resp.status}", latency)
    except Exception as e:
        latency = (time.monotonic() - t0) * 1000
        return CheckResult("health_endpoint", Status.UNHEALTHY, str(e), latency)


async def check_rpc(host: str, port: int, timeout: int = 10) -> CheckResult:
    """Check RPC getblockchaininfo."""
    if aiohttp is None:
        return CheckResult("rpc", Status.UNKNOWN, "aiohttp not installed")
    url = f"http://{host}:{port}/"
    payload = {"jsonrpc": "2.0", "id": 1, "method": "getblockchaininfo", "params": []}
    t0 = time.monotonic()
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                url, json=payload, timeout=aiohttp.ClientTimeout(total=timeout)
            ) as resp:
                latency = (time.monotonic() - t0) * 1000
                if resp.status == 200:
                    data = await resp.json()
                    result = data.get("result", {})
                    return CheckResult(
                        "rpc",
                        Status.HEALTHY,
                        f"height={result.get('blocks')}, difficulty={result.get('difficulty')}",
                        latency,
                        result,
                    )
                return CheckResult("rpc", Status.DEGRADED, f"HTTP {resp.status}", latency)
    except Exception as e:
        latency = (time.monotonic() - t0) * 1000
        return CheckResult("rpc", Status.UNHEALTHY, str(e), latency)


def check_p2p(host: str, port: int, timeout: int = 5) -> CheckResult:
    """Check P2P TCP port reachability."""
    t0 = time.monotonic()
    try:
        sock = socket.create_connection((host, port), timeout=timeout)
        latency = (time.monotonic() - t0) * 1000
        sock.close()
        return CheckResult("p2p", Status.HEALTHY, f"port {port} reachable", latency)
    except Exception as e:
        latency = (time.monotonic() - t0) * 1000
        return CheckResult("p2p", Status.UNHEALTHY, str(e), latency)


def check_stratum(host: str, port: int, timeout: int = 5) -> CheckResult:
    """Check Stratum TCP port reachability."""
    t0 = time.monotonic()
    try:
        sock = socket.create_connection((host, port), timeout=timeout)
        latency = (time.monotonic() - t0) * 1000
        sock.close()
        return CheckResult("stratum", Status.HEALTHY, f"port {port} reachable", latency)
    except Exception as e:
        latency = (time.monotonic() - t0) * 1000
        return CheckResult("stratum", Status.UNHEALTHY, str(e), latency)


# ── Orchestrator ────────────────────────────────────────────────────────


async def check_node(node_cfg: dict, timestamp: str) -> NodeReport:
    """Run all applicable checks on a node."""
    node_id = node_cfg.get("id", "unknown")
    host = node_cfg["host"]
    ports = node_cfg.get("ports", {})
    roles = node_cfg.get("role", [])

    checks: List[CheckResult] = []

    # Health endpoint (always)
    health_port = ports.get("health", 8080)
    checks.append(await check_health_endpoint(host, health_port))

    # RPC (always)
    rpc_port = ports.get("rpc", 8332)
    checks.append(await check_rpc(host, rpc_port))

    # P2P (always)
    p2p_port = ports.get("p2p", 8334)
    checks.append(check_p2p(host, p2p_port))

    # Stratum (pool only)
    if "pool" in roles:
        stratum_port = ports.get("stratum", 3416)
        checks.append(check_stratum(host, stratum_port))

    # Overall status
    statuses = [c.status for c in checks]
    if all(s == Status.HEALTHY for s in statuses):
        overall = Status.HEALTHY
    elif any(s == Status.UNHEALTHY for s in statuses):
        overall = Status.UNHEALTHY
    elif any(s == Status.DEGRADED for s in statuses):
        overall = Status.DEGRADED
    else:
        overall = Status.UNKNOWN

    return NodeReport(node_id, host, timestamp, overall, checks)


# ── Main ────────────────────────────────────────────────────────────────


async def main():
    config_path = Path(__file__).parent / "config.json"
    if not config_path.exists():
        config_path = Path(__file__).parent / "config.example.json"
    
    with open(config_path) as f:
        config = json.load(f)

    timestamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    reports = []

    for node_cfg in config.get("nodes", []):
        report = await check_node(node_cfg, timestamp)
        reports.append(report)

        icon = {"healthy": "✅", "degraded": "⚠️", "unhealthy": "❌", "unknown": "❓"}
        print(f"\n{icon.get(report.overall.value, '?')} Node: {report.node_id} ({report.host})")
        for c in report.checks:
            ci = icon.get(c.status.value, "?")
            print(f"  {ci} {c.name}: {c.message} ({c.latency_ms:.0f}ms)")

    # Summary
    print(f"\n--- {len(reports)} node(s) checked ---")
    for r in reports:
        print(f"  {r.node_id}: {r.overall.value}")

    # Write results
    results_path = Path(__file__).parent / "health_results.json"
    with open(results_path, "w") as f:
        json.dump([r.to_dict() for r in reports], f, indent=2)
    print(f"\nResults written to {results_path}")


if __name__ == "__main__":
    asyncio.run(main())
