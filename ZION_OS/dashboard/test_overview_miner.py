#!/usr/bin/env python3
"""Smoke test for overview miner on-chain balance resolution."""
import sys
from pathlib import Path

# Ensure dashboard modules can load
sys.path.insert(0, str(Path(__file__).parent))

import app as dashboard_app

# Mock the external dependencies so the test is hermetic.
def _mock_fetch_pool_miners():
    return [
        {
            "worker": "zion1testworker1.rig1",
            "hashrate_hps": 1_000_000.0,
            "valid_shares": 10,
            "invalid_shares": 0,
            "last_share_time": 1_000_000,
        },
        {
            "worker_name": "rig2",
            "hashrate_hps": 500_000.0,
            "valid_shares": 5,
            "last_share_time": 999_995,
        },
    ]


def _mock_fetch_pool_stats():
    return {}


def _mock_fetch_pplns_state():
    return {
        "shares_per_miner": {
            "zion1testworker1.rig1": {"valid": 10, "invalid": 0, "blocks": 1},
            "zion1testworker2.rig2": {"valid": 5, "invalid": 0, "blocks": 0},
        },
        "last_share_time_per_miner": {
            "zion1testworker1.rig1": 1_000_000,
            "zion1testworker2.rig2": 999_995,
        },
        "paid_per_miner": {
            "zion1testworker1.rig1": 1_000_000,
            "zion1testworker2.rig2": 0,
        },
        "unpaid": {
            "zion1testworker1.rig1": 500_000,
            "zion1testworker2.rig2": 100_000,
        },
        "addresses": {
            "zion1testworker1.rig1": "zion1testworker1",
            "zion1testworker1/rig1": "zion1testworker1",
            "zion1testworker2.rig2": "zion1testworker2",
            "zion1testworker2/rig2": "zion1testworker2",
        },
    }


_balance_map = {
    "zion1testworker1": 12_000_000,
    "zion1testworker2": 3_000_000,
}


def _mock_get_on_chain_balance(address, scan=None):
    if address in _balance_map:
        return _balance_map[address], True
    return 0, False


dashboard_app.fetch_pool_miners = _mock_fetch_pool_miners
dashboard_app.fetch_pool_stats = _mock_fetch_pool_stats
dashboard_app._fetch_pplns_state = _mock_fetch_pplns_state
dashboard_app._get_on_chain_balance = _mock_get_on_chain_balance

# Make sure the cache for _get_utxo_balance does not shadow our mock
dashboard_app._get_utxo_balance.__wrapped__ if hasattr(dashboard_app._get_utxo_balance, "__wrapped__") else None
# Since _get_on_chain_balance is mocked directly, _get_utxo_balance is not used here.

data = dashboard_app.get_pool_miners()
print("get_pool_miners ok:", data.get("ok"))
print("miners count:", len(data.get("miners", [])))
for m in data.get("miners", []):
    print(
        f"  miner_id={m.get('miner_id')} worker_name={m.get('worker_name')} "
        f"payout_address={m.get('payout_address')} "
        f"on_chain_balance_zion={m.get('on_chain_balance_zion')} "
        f"pending_balance_zion={m.get('pending_balance_zion')} "
        f"paid_total={m.get('paid_total')}"
    )

all_ok = all(
    m.get("payout_address", "").startswith("zion1")
    and m.get("on_chain_balance_zion") is not None
    for m in data.get("miners", [])
)
print("all resolved:", all_ok)
