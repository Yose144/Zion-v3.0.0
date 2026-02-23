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
ENABLED_COINS = os.environ.get("ENABLED_COINS", "ERG,RVN,ETC,ALPH").split(",")
WHATTOMINE_GPU_ID = int(os.environ.get("WHATTOMINE_GPU_ID", "353"))  # RTX 4090 default
LOLMINER_API = os.environ.get("LOLMINER_API", "http://lolminer:19999")
WALLET = os.environ.get("WALLET", "bc1qvujra09wlsm35tmhc0v0fnxpsj0cuaq88hd8mw")
WORKER = os.environ.get("WORKER", "zion_gpu")
STATE_FILE = Path("/app/state/current_coin.json")

# ── Pool endpoints ─────────────────────────────────────────────
POOLS = {
    "ERG":  {"pool": "erg.2miners.com:8008",       "algo": "Autolykos2", "whattomine_id": 340},
    "RVN":  {"pool": "rvn.2miners.com:6060",        "algo": "KawPow",    "whattomine_id": 228},
    "ETC":  {"pool": "etc.2miners.com:1010",         "algo": "Etchash",   "whattomine_id": 162},
    "ALPH": {"pool": "alph.2miners.com:1199",        "algo": "Blake3",    "whattomine_id": 431},
    "KAS":  {"pool": "pool.woolypooly.com:3112",     "algo": "kHeavyHash","whattomine_id": 421},
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
        }
        for ticker, name in coin_map.items():
            if ticker not in ENABLED_COINS:
                continue
            for _, coin_data in data.get("coins", {}).items():
                if coin_data.get("tag") == ticker or coin_data.get("name") == name:
                    profits[ticker] = float(coin_data.get("estimated_rewards24", 0))
                    break
        return profits
    except Exception as e:
        log.error(f"WhatToMine API error: {e}")
        return {}


def get_best_coin(profits: dict[str, float], current: str | None) -> str:
    """
    Return best coin with hysteresis protection.
    Only switch if new coin profit > current * (1 + HYSTERESIS_PCT).
    """
    if not profits:
        return current or "ERG"

    best = max(profits, key=profits.get)
    best_profit = profits[best]

    if current and current in profits:
        current_profit = profits[current]
        threshold = current_profit * (1 + HYSTERESIS_PCT)
        if best_profit <= threshold:
            log.info(
                f"Keeping {current} (${current_profit:.4f}/day) "
                f"vs {best} (${best_profit:.4f}/day) — hysteresis {HYSTERESIS_PCT*100:.0f}%"
            )
            return current

    log.info(f"Best coin: {best} (${best_profit:.4f}/day)")
    return best


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
    log.info("=== ZION Profit Switcher started ===")
    log.info(f"Enabled coins: {ENABLED_COINS}")
    log.info(f"Check interval: {SWITCH_INTERVAL_SEC//60} min | Hysteresis: {HYSTERESIS_PCT*100:.0f}%")
    log.info(f"WhatToMine GPU ID: {WHATTOMINE_GPU_ID}")

    state = load_state()
    current_coin = state.get("current_coin")
    last_profits = {}

    # Startup: brief wait for lolminer to init
    time.sleep(30)

    while True:
        try:
            log.info("Fetching profitability data from WhatToMine...")
            profits = fetch_whattomine_profits(WHATTOMINE_GPU_ID)

            if profits:
                last_profits = profits
                log.info("Profitability: " + " | ".join(
                    f"{c}=${p:.4f}/day" for c, p in sorted(profits.items(), key=lambda x: -x[1])
                ))
            else:
                log.warning("Using cached profits from last successful fetch")
                profits = last_profits

            if profits:
                best_coin = get_best_coin(profits, current_coin)

                if best_coin != current_coin:
                    apply_coin_switch(best_coin, current_coin)
                    current_coin = best_coin
                    state = {
                        "current_coin": current_coin,
                        "last_switch": datetime.utcnow().isoformat(),
                        "profits": profits,
                    }
                    save_state(state)
                else:
                    log.info(f"Keeping {current_coin} — no switch needed")

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
