#!/usr/bin/env python3
"""
ZION Revenue Dashboard — BOOST stream revenue (QTC/PRL/VRSC/ZANO/...).

Reads the public pool API (no auth) and aggregates per-coin activity:
  - /public/v1/coins            — coins + legs (connected/enabled)
  - /public/v1/coins/{c}/stats  — hashrate, accepted shares, payouts_24h
  - /public/v1/payouts          — recent payout ledger rows

The dashboard is a *proxy* view: BOOST revenue is paid by upstream pools to
the ZION pool wallet, not through the miner payout ledger. We therefore show
activity (hashrate, accepted shares), fee configuration and the destination
pool wallet — not a fake USD number.

Run:
    python3 ZION_OS/revenue-dash/app.py
    # http://127.0.0.1:8770

Env:
    POOL_API_BASE   default https://pool.zionterranova.com
    REVENUE_DASH_PORT default 8770
    REVENUE_DASH_HOST default 127.0.0.1
"""

import os
import json
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.request import urlopen, Request
from urllib.error import URLError

from flask import Flask, jsonify, render_template

POOL_API_BASE = os.environ.get("POOL_API_BASE", "https://pool.zionterranova.com").rstrip("/")
PORT = int(os.environ.get("REVENUE_DASH_PORT", "8770"))
HOST = os.environ.get("REVENUE_DASH_HOST", "127.0.0.1")

# BOOST coins = everything except the native ZION stream.
BOOST_COINS = {"qtc", "prl", "vrsc", "zano", "evr", "krx", "mewc", "phx", "rtm", "zcl", "zec"}
POOL_WALLET = "zion1d2k5v0p6p2z667l7g522v2z0w0y6e7w742zq8k6"

app = Flask(__name__)

_cache = {"ts": 0.0, "data": None}
_CACHE_TTL = 20.0


def _get(path, timeout=8):
    url = f"{POOL_API_BASE}{path}"
    req = Request(url, headers={"User-Agent": "zion-revenue-dash/1.0"})
    with urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _coin_stats(coin):
    try:
        return coin, _get(f"/public/v1/coins/{coin}/stats")
    except (URLError, TimeoutError, ValueError, OSError):
        return coin, None


def collect():
    now = time.time()
    if _cache["data"] and now - _cache["ts"] < _CACHE_TTL:
        return _cache["data"]

    coins_payload = _get("/public/v1/coins")
    coins = coins_payload.get("coins", [])

    stats = {}
    with ThreadPoolExecutor(max_workers=8) as ex:
        futures = {ex.submit(_coin_stats, c["coin"]): c["coin"] for c in coins}
        for fut in as_completed(futures):
            coin, payload = fut.result()
            if payload:
                stats[coin] = payload

    rows = []
    total_hashrate = 0.0
    total_accepted = 0
    active_boost = 0
    for c in coins:
        coin = c["coin"]
        st = stats.get(coin, {})
        legs = c.get("legs", [])
        connected = any(l.get("connected") for l in legs)
        enabled = any(l.get("enabled") for l in legs)
        hashrate = float(st.get("hashrate", {}).get("live", 0) or 0)
        accepted = int(st.get("accepted_total", 0) or 0)
        payouts_24h = st.get("payouts_24h", "0")
        fee_bps = int(c.get("fee_bps", 0) or 0)
        is_boost = coin in BOOST_COINS

        total_hashrate += hashrate
        total_accepted += accepted
        if is_boost and connected and enabled:
            active_boost += 1

        rows.append({
            "coin": coin,
            "kind": "boost" if is_boost else "zion",
            "connected": connected,
            "enabled": enabled,
            "legs": [{"id": l.get("id"), "connected": l.get("connected"), "enabled": l.get("enabled")} for l in legs],
            "hashrate_live": hashrate,
            "accepted_total": accepted,
            "payouts_24h": payouts_24h,
            "fee_bps": fee_bps,
            "active_miners": st.get("active_miners", 0),
        })

    rows.sort(key=lambda r: (r["kind"] != "boost", -r["hashrate_live"]))

    data = {
        "ok": True,
        "generated_at": int(now),
        "pool_api": POOL_API_BASE,
        "pool_wallet": POOL_WALLET,
        "summary": {
            "coins_total": len(rows),
            "boost_active": active_boost,
            "total_hashrate": total_hashrate,
            "total_accepted": total_accepted,
        },
        "rows": rows,
    }
    _cache["ts"] = now
    _cache["data"] = data
    return data


@app.route("/")
def index():
    return render_template("index.html", pool_api=POOL_API_BASE, pool_wallet=POOL_WALLET)


@app.route("/api/revenue")
def api_revenue():
    try:
        return jsonify(collect())
    except (URLError, TimeoutError, ValueError, OSError) as e:
        return jsonify({"ok": False, "error": str(e)}), 502


@app.route("/health")
def health():
    return jsonify({"ok": True, "pool_api": POOL_API_BASE})


if __name__ == "__main__":
    print(f"ZION Revenue Dashboard -> http://{HOST}:{PORT} (pool: {POOL_API_BASE})")
    app.run(host=HOST, port=PORT, debug=False)
