#!/usr/bin/env python3
"""
ZION Profit Switcher — GPU Multi-Algo Revenue (CH3 Stream 4)

Queries WhatToMine API every SWITCH_INTERVAL_MIN minutes.
Determines most profitable GPU coin → signals lolminer to restart.

Supported coins: ERG (Autolykos2), RVN (KawPow), ETC (Etchash),
                 ALPH (Blake3), KAS (KHeavyHash)

Pool mappings auto-configured from ch3_revenue_settings.json.
"""

import os
import sys
import json
import time
import logging
import requests
import subprocess
from pathlib import Path
from datetime import datetime

# ── Configuration ─────────────────────────────────────────────
SWITCH_INTERVAL_SEC = int(os.environ.get("SWITCH_INTERVAL_MIN", "15")) * 60
HYSTERESIS_PCT = float(os.environ.get("HYSTERESIS_PCT", "5")) / 100
ENABLED_COINS = os.environ.get("ENABLED_COINS", "ERG,RVN,ETC,ALPH,KAS,DCR").split(",")
WHATTOMINE_GPU_ID = int(os.environ.get("WHATTOMINE_GPU_ID", "353"))  # RTX 4090 default
LOLMINER_API = os.environ.get("LOLMINER_API", "http://lolminer:19999")
WALLET = os.environ.get("WALLET", "bc1qvujra09wlsm35tmhc0v0fnxpsj0cuaq88hd8mw")
WORKER = os.environ.get("WORKER", "zion_gpu")
STATE_FILE = Path("/app/state/current_coin.json")

# Enhanced switching parameters
MIN_SWITCH_INTERVAL_SEC = int(os.environ.get("MIN_SWITCH_INTERVAL_SEC", "1800"))  # 30 min minimum
PROFIT_THRESHOLD_USD = float(os.environ.get("PROFIT_THRESHOLD_USD", "0.1"))
MAX_SWITCHES_PER_HOUR = int(os.environ.get("MAX_SWITCHES_PER_HOUR", "4"))
ADAPTIVE_HYSTERESIS = os.environ.get("ADAPTIVE_HYSTERESIS", "true").lower() == "true"

# ── Pool endpoints ─────────────────────────────────────────────
POOLS = {
    "ERG":  {"pool": "erg.2miners.com:8008",       "algo": "Autolykos2", "whattomine_id": 340, "protocol": "ethstratum", "fee": 1.0},
    "RVN":  {"pool": "rvn.2miners.com:6060",        "algo": "KawPow",    "whattomine_id": 228, "protocol": "ethstratum", "fee": 1.0},
    "ETC":  {"pool": "etc.2miners.com:1010",         "algo": "Etchash",   "whattomine_id": 162, "protocol": "ethstratum", "fee": 1.0},
    "ALPH": {"pool": "alph.2miners.com:1199",        "algo": "Blake3",    "whattomine_id": 431, "protocol": "stratum",    "fee": 1.0},
    "KAS":  {"pool": "pool.woolypooly.com:3112",     "algo": "kHeavyHash","whattomine_id": 421, "protocol": "stratum",    "fee": 0.9},
    "DCR":  {"pool": "dcr.2miners.com:3333",         "algo": "Blake3",    "whattomine_id": 152, "protocol": "stratum",    "fee": 1.0},
    "FLUX": {"pool": "flux.woolypooly.com:3000",     "algo": "ZelHash",   "whattomine_id": 308, "protocol": "stratum",    "fee": 1.0},
    "CLORE":{"pool": "clore.woolypooly.com:3090",    "algo": "KawPow",    "whattomine_id": 505, "protocol": "ethstratum", "fee": 1.0},
    "MEWC": {"pool": "mewc.2miners.com:1111",        "algo": "MeowPoW",   "whattomine_id": 999, "protocol": "ethstratum", "fee": 1.0},
    "EVR":  {"pool": "evr.2miners.com:1300",         "algo": "EvrProgPow","whattomine_id": 999, "protocol": "ethstratum", "fee": 1.0},
}

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [PROFIT-SWITCH] %(levelname)s %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
log = logging.getLogger(__name__)


def get_lolminer_stats() -> dict:
    """Get current mining stats from lolminer API."""
    try:
        r = requests.get(f"{LOLMINER_API}/summary", timeout=5)
        return r.json()
    except Exception as e:
        log.warning(f"lolminer API unavailable: {e}")
        return {}


def fetch_whattomine_profits(gpu_id: int) -> dict[str, float]:
    """
    Query WhatToMine API for GPU profitability.
    Returns dict: {coin: profit_usd_per_day}
    """
    url = f"https://whattomine.com/coins.json?gpus={gpu_id}"
    try:
        r = requests.get(url, timeout=15, headers={"User-Agent": "ZION-ProfitSwitcher/1.0"})
        data = r.json()
        profits = {}
        coin_map = {
            "ERG":  "Ergo",
            "RVN":  "Ravencoin",
            "ETC":  "EthereumClassic",
            "ALPH": "Alephium",
            "KAS":  "Kaspa",
            "DCR":  "Decred",
            "FLUX": "Flux",
            "CLORE":"Clore",
            "MEWC": "MeowCoin",
            "EVR":  "Evrmore",
        }
        for ticker, name in coin_map.items():
            if ticker not in ENABLED_COINS:
                continue
            for _, coin_data in data.get("coins", {}).items():
                if coin_data.get("tag") == ticker or coin_data.get("name") == name:
                    base_profit = float(coin_data.get("estimated_rewards24", 0))
                    # Apply pool fee adjustment
                    fee_pct = POOLS.get(ticker, {}).get("fee", 1.0) / 100
                    adjusted_profit = base_profit * (1 - fee_pct)
                    profits[ticker] = adjusted_profit
                    break
        return profits
    except Exception as e:
        log.error(f"WhatToMine API error: {e}")
        return {}


def get_best_coin(profits: dict[str, float], current: str | None, state: dict) -> tuple[str, bool]:
    """
    Enhanced best coin selection with adaptive hysteresis and switching limits.
    Returns (coin_name, should_switch)
    """
    if not profits:
        return (current or "ERG", False)

    # Filter out coins below profit threshold
    viable_profits = {k: v for k, v in profits.items() if v >= PROFIT_THRESHOLD_USD}

    if not viable_profits:
        log.warning(f"No coins meet minimum profit threshold (${PROFIT_THRESHOLD_USD}/day)")
        return (current or "ERG", False)

    best = max(viable_profits, key=viable_profits.get)
    best_profit = viable_profits[best]

    # Check minimum switch interval
    last_switch = state.get("last_switch_time")
    if last_switch:
        try:
            last_switch_dt = datetime.fromisoformat(last_switch)
            time_since_switch = (datetime.utcnow() - last_switch_dt).total_seconds()
            if time_since_switch < MIN_SWITCH_INTERVAL_SEC:
                remaining = int(MIN_SWITCH_INTERVAL_SEC - time_since_switch)
                log.info(f"Switch blocked: minimum interval not met ({remaining}s remaining)")
                return (current or best, False)
        except (ValueError, TypeError):
            pass  # Invalid timestamp, allow switch

    # Check hourly switch limit
    recent_switches = state.get("switch_history", [])
    hour_ago = datetime.utcnow().timestamp() - 3600
    recent_count = sum(1 for ts in recent_switches if ts > hour_ago)

    if recent_count >= MAX_SWITCHES_PER_HOUR:
        log.warning(f"Switch blocked: exceeded {MAX_SWITCHES_PER_HOUR} switches/hour limit")
        return (current or best, False)

    # Adaptive hysteresis based on profit difference
    hysteresis_multiplier = HYSTERESIS_PCT
    if ADAPTIVE_HYSTERESIS and current and current in viable_profits:
        current_profit = viable_profits[current]
        profit_ratio = best_profit / max(current_profit, 0.001)

        # Increase hysteresis for small profit differences
        if profit_ratio < 1.1:  # Less than 10% better
            hysteresis_multiplier *= 2
        elif profit_ratio > 1.5:  # More than 50% better
            hysteresis_multiplier *= 0.5  # Reduce hysteresis for big gains

    if current and current in viable_profits:
        current_profit = viable_profits[current]
        threshold = current_profit * (1 + hysteresis_multiplier)

        if best_profit <= threshold:
            log.info(
                f"Keeping {current} (${current_profit:.4f}/day) "
                f"vs {best} (${best_profit:.4f}/day) — hysteresis {hysteresis_multiplier*100:.1f}%"
            )
            return (current, False)

    log.info(f"Switching to {best} (${best_profit:.4f}/day) from {current} (${viable_profits.get(current, 0):.4f}/day)")
    return (best, True)


def load_state() -> dict:
    try:
        STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
        if STATE_FILE.exists():
            return json.loads(STATE_FILE.read_text())
    except Exception:
        pass
    return {}


def save_state(state: dict):
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps(state, indent=2))


def apply_coin_switch(coin: str, current_coin: str | None):
    """Update environment and signal lolminer restart via /app/state/restart."""
    pool_info = POOLS[coin]
    restart = Path("/app/state/restart")
    restart.write_text(json.dumps({
        "coin": coin,
        "pool": pool_info["pool"],
        "algo": pool_info["algo"],
        "user": f"{WALLET}.{WORKER}",
        "timestamp": datetime.utcnow().isoformat(),
    }))
    log.info(f"✅ Switch: {current_coin} → {coin} | Pool: {pool_info['pool']}")


def main():
    log.info("=== ZION Enhanced Profit Switcher started ===")
    log.info(f"Enabled coins: {ENABLED_COINS}")
    log.info(f"Check interval: {SWITCH_INTERVAL_SEC//60} min | Hysteresis: {HYSTERESIS_PCT*100:.0f}%")
    log.info(f"Min switch interval: {MIN_SWITCH_INTERVAL_SEC//60} min | Max switches/hour: {MAX_SWITCHES_PER_HOUR}")
    log.info(f"Profit threshold: ${PROFIT_THRESHOLD_USD}/day | Adaptive hysteresis: {ADAPTIVE_HYSTERESIS}")
    log.info(f"WhatToMine GPU ID: {WHATTOMINE_GPU_ID}")

    state = load_state()
    current_coin = state.get("current_coin")
    last_profits = {}

    # Initialize switch history if not exists
    if "switch_history" not in state:
        state["switch_history"] = []

    # Startup: brief wait for lolminer to init
    time.sleep(30)

    while True:
        try:
            log.info("Fetching profitability data from WhatToMine...")
            profits = fetch_whattomine_profits(WHATTOMINE_GPU_ID)

            if profits:
                last_profits = profits
                viable_profits = {k: v for k, v in profits.items() if v >= PROFIT_THRESHOLD_USD}
                log.info("Profitability: " + " | ".join(
                    f"{c}=${p:.4f}/day{'*' if p < PROFIT_THRESHOLD_USD else ''}"
                    for c, p in sorted(profits.items(), key=lambda x: -x[1])
                ))
                if len(viable_profits) < len(profits):
                    log.info(f"Filtered {len(profits) - len(viable_profits)} coins below ${PROFIT_THRESHOLD_USD}/day threshold")
            else:
                log.warning("Using cached profits from last successful fetch")
                profits = last_profits

            if profits:
                best_coin, should_switch = get_best_coin(profits, current_coin, state)

                if should_switch:
                    apply_coin_switch(best_coin, current_coin)
                    current_coin = best_coin

                    # Update state with switch tracking
                    now = datetime.utcnow()
                    state.update({
                        "current_coin": current_coin,
                        "last_switch_time": now.isoformat(),
                        "profits": profits,
                    })

                    # Add to switch history
                    state["switch_history"].append(now.timestamp())
                    # Keep only last 24 hours of history
                    cutoff = now.timestamp() - 86400
                    state["switch_history"] = [ts for ts in state["switch_history"] if ts > cutoff]

                    save_state(state)
                    log.info(f"✅ Switched to {best_coin}")
                else:
                    log.info(f"Keeping {current_coin} — switch conditions not met")

            # Show current stats
            stats = get_lolminer_stats()
            if stats:
                hr = stats.get("Session", {}).get("Performance_Factor", 0)
                acc = stats.get("Session", {}).get("Accepted", 0)
                rej = stats.get("Session", {}).get("Rejected", 0)
                log.info(f"  GPU stats: {hr:.1f} MH/s | Accepted: {acc} | Rejected: {rej}")

        except KeyboardInterrupt:
            log.info("Shutting down profit switcher")
            break
        except Exception as e:
            log.error(f"Unexpected error: {e}", exc_info=True)

        log.info(f"Next check in {SWITCH_INTERVAL_SEC//60} minutes...")
        time.sleep(SWITCH_INTERVAL_SEC)


if __name__ == "__main__":
    main()
