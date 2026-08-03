#!/usr/bin/env python3
"""
V3 Continuous Monitor with Alerting

Runs in a loop, checks node health every N seconds, and sends alerts
to Discord / Telegram when issues are detected.

Ported from TREE_NODES/monitoring/network_monitor.py for V3.
"""

import asyncio
import json
import time
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Dict, List, Optional

try:
    import aiohttp
except ImportError:
    aiohttp = None


# ── Alert Config ────────────────────────────────────────────────────────


class AlertLevel(Enum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


@dataclass
class NodeState:
    node_id: str
    host: str
    is_online: bool = False
    block_height: int = 0
    peer_count: int = 0
    sync_status: str = "unknown"
    last_check: float = 0
    response_ms: float = 0
    consecutive_failures: int = 0


# ── Alert Senders ───────────────────────────────────────────────────────


async def send_discord(webhook_url: str, level: AlertLevel, title: str, message: str):
    """Send alert to Discord webhook."""
    if not aiohttp or not webhook_url:
        return
    color = {AlertLevel.INFO: 0x00FF00, AlertLevel.WARNING: 0xFFFF00, AlertLevel.CRITICAL: 0xFF0000}
    emoji = {AlertLevel.INFO: "ℹ️", AlertLevel.WARNING: "⚠️", AlertLevel.CRITICAL: "🚨"}
    payload = {
        "embeds": [
            {
                "title": f"{emoji.get(level, '')} ZION V3: {title}",
                "description": message,
                "color": color.get(level, 0x808080),
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "footer": {"text": "ZION V3 Monitor"},
            }
        ]
    }
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(webhook_url, json=payload, timeout=aiohttp.ClientTimeout(total=10)):
                pass
    except Exception:
        pass


async def send_telegram(token: str, chat_id: str, level: AlertLevel, title: str, message: str):
    """Send alert to Telegram."""
    if not aiohttp or not token or not chat_id:
        return
    emoji = {AlertLevel.INFO: "ℹ️", AlertLevel.WARNING: "⚠️", AlertLevel.CRITICAL: "🚨"}
    text = f"{emoji.get(level, '')} *ZION V3: {title}*\n{message}"
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {"chat_id": chat_id, "text": text, "parse_mode": "Markdown"}
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload, timeout=aiohttp.ClientTimeout(total=10)):
                pass
    except Exception:
        pass


# ── Monitor Loop ────────────────────────────────────────────────────────


async def check_node(host: str, health_port: int, timeout: int = 10) -> dict:
    """Query the V3 /health endpoint."""
    if aiohttp is None:
        return {"online": False, "error": "aiohttp not installed"}
    url = f"http://{host}:{health_port}/health"
    t0 = time.monotonic()
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=timeout)) as resp:
                latency = (time.monotonic() - t0) * 1000
                if resp.status == 200:
                    data = await resp.json()
                    data["online"] = True
                    data["latency_ms"] = latency
                    return data
                return {"online": False, "error": f"HTTP {resp.status}", "latency_ms": latency}
    except Exception as e:
        latency = (time.monotonic() - t0) * 1000
        return {"online": False, "error": str(e), "latency_ms": latency}


async def alert(config: dict, level: AlertLevel, title: str, message: str):
    """Send alert through all configured channels."""
    alerting = config.get("alerting", {})
    min_level = AlertLevel(alerting.get("min_level", "warning"))

    level_order = {AlertLevel.INFO: 0, AlertLevel.WARNING: 1, AlertLevel.CRITICAL: 2}
    if level_order.get(level, 0) < level_order.get(min_level, 0):
        return

    tasks = []
    if alerting.get("discord_webhook"):
        tasks.append(send_discord(alerting["discord_webhook"], level, title, message))
    if alerting.get("telegram_bot_token") and alerting.get("telegram_chat_id"):
        tasks.append(
            send_telegram(alerting["telegram_bot_token"], alerting["telegram_chat_id"], level, title, message)
        )
    if tasks:
        await asyncio.gather(*tasks, return_exceptions=True)


async def monitor_loop(config: dict):
    """Main monitoring loop."""
    interval = config.get("alerting", {}).get("check_interval_secs", 60)
    states: Dict[str, NodeState] = {}

    print(f"[monitor] Starting V3 monitor, interval={interval}s, nodes={len(config.get('nodes', []))}")

    while True:
        for node_cfg in config.get("nodes", []):
            node_id = node_cfg.get("id", "unknown")
            host = node_cfg["host"]
            health_port = node_cfg.get("ports", {}).get("health", 8080)

            if node_id not in states:
                states[node_id] = NodeState(node_id=node_id, host=host)

            state = states[node_id]
            result = await check_node(host, health_port)

            was_online = state.is_online
            state.is_online = result.get("online", False)
            state.last_check = time.time()
            state.response_ms = result.get("latency_ms", 0)

            if state.is_online:
                state.block_height = result.get("chain_height", 0)
                state.peer_count = result.get("peer_count", 0)
                state.sync_status = result.get("sync_status", "unknown")
                state.consecutive_failures = 0

                # Recovery alert
                if not was_online:
                    await alert(config, AlertLevel.INFO, f"Node {node_id} recovered", f"{host} is back online at height {state.block_height}")

                # Low peers warning
                if state.peer_count < 2:
                    await alert(config, AlertLevel.WARNING, f"Low peers on {node_id}", f"{host} has only {state.peer_count} peer(s)")

                # Sync lag
                sync_lag = result.get("sync_lag", 0)
                if sync_lag > 50:
                    await alert(config, AlertLevel.WARNING, f"Sync lag on {node_id}", f"{host} is {sync_lag} blocks behind")

                icon = "🟢"
            else:
                state.consecutive_failures += 1
                icon = "🔴"

                if state.consecutive_failures == 1:
                    await alert(config, AlertLevel.WARNING, f"Node {node_id} unreachable", f"{host}: {result.get('error', '?')}")
                elif state.consecutive_failures >= 3:
                    await alert(config, AlertLevel.CRITICAL, f"Node {node_id} DOWN", f"{host} failed {state.consecutive_failures} consecutive checks")

            print(
                f"  {icon} {node_id}: online={state.is_online} height={state.block_height} "
                f"peers={state.peer_count} sync={state.sync_status} latency={state.response_ms:.0f}ms"
            )

        print(f"[{time.strftime('%H:%M:%S')}] --- cycle complete, sleeping {interval}s ---")
        await asyncio.sleep(interval)


# ── Main ────────────────────────────────────────────────────────────────


async def main():
    config_path = Path(__file__).parent / "config.json"
    if not config_path.exists():
        config_path = Path(__file__).parent / "config.example.json"

    with open(config_path) as f:
        config = json.load(f)

    await monitor_loop(config)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n[monitor] Stopped.")
