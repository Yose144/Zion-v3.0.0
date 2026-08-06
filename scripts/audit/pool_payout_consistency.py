#!/usr/bin/env python3
"""Pool payout / share_store consistency audit.

Designed to run on the Edge pool server. Compares:
  - PPLNS state paid totals vs SQLite payouts table
  - Pool /stats API total_paid vs SQLite
  - Prometheus zion_pplns_total_paid_flowers vs SQLite
  - Dashboard /api/pool/miner-detail paid totals vs payout list sums
  - On-chain outgoing transfers vs SQLite (informational only)

The on-chain comparison is informational: hybrid (multi-output) pool
transactions are stored on chain, but getTransactionHistory/getTransaction
only expose one recipient/amount per query, so per-address totals cannot be
exactly reconciled from RPC.  The authoritative pool accounting source is the
SQLite share_store.
"""
import json
import os
import socket
import sqlite3
import sys
import urllib.request
from collections import defaultdict

DEFAULTS = {
    "db_path": "/data/zion/pool-store.db",
    "pplns_path": "/data/zion/pplns-state.json",
    "pool_wallet": "zion1k4g2d8s3y4m5v238k0l3v6y5n48894n357uv064",
    "node_rpc": ("127.0.0.1", 9443),
    "pool_api": ("127.0.0.1", 8455),
    "dashboard_api": ("127.0.0.1", 8766),
    "dashboard_auth": os.environ.get("DASHBOARD_AUTH"),
    "tolerance_flowers": 1000,  # ~0.001 ZION
    "on_chain_tolerance_flowers": 5_000_000_000,  # ~5,000 ZION
}


def rpc_call(method, params=None, host=DEFAULTS["node_rpc"][0], port=DEFAULTS["node_rpc"][1]):
    req = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": method,
        "params": params if params is not None else {},
    }
    payload = json.dumps(req, separators=(",", ":")) + "\n"
    with socket.create_connection((host, port), timeout=30) as s:
        s.sendall(payload.encode())
        s.shutdown(socket.SHUT_WR)
        buf = b""
        while True:
            chunk = s.recv(65536)
            if not chunk:
                break
            buf += chunk
    lines = buf.decode().strip().splitlines()
    if not lines:
        raise RuntimeError("empty RPC response")
    resp = json.loads(lines[-1])
    if resp.get("error"):
        raise RuntimeError(resp["error"])
    return resp.get("result")


def http_get(url, auth=None, timeout=10):
    req = urllib.request.Request(url)
    if auth:
        import base64
        req.add_header("Authorization", "Basic " + base64.b64encode(auth.encode()).decode())
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode())


def flowers_to_zion(flowers):
    return flowers / 1_000_000.0


def load_pplns(path):
    with open(path) as f:
        return json.load(f)


def load_db_totals(db_path):
    conn = sqlite3.connect(db_path, timeout=30)
    cur = conn.cursor()
    cur.execute("SELECT COALESCE(SUM(amount_flowers),0) FROM payouts")
    total = cur.fetchone()[0]
    cur.execute("SELECT miner_id, COALESCE(SUM(amount_flowers),0) FROM payouts GROUP BY miner_id")
    by_miner = {m: t for m, t in cur.fetchall()}
    cur.execute("SELECT address, COALESCE(SUM(amount_flowers),0) FROM payouts GROUP BY address")
    by_address = {a: t for a, t in cur.fetchall() if a}
    # Ignore synthetic backfill rows when reconciling against the chain.
    cur.execute("SELECT DISTINCT tx_id FROM payouts WHERE substr(tx_id,1,10) != '__backfill'")
    db_tx_ids = {row[0] for row in cur.fetchall()}
    cur.execute(
        "SELECT DISTINCT tx_id FROM payouts WHERE confirmed = 1 AND substr(tx_id,1,10) != '__backfill'"
    )
    db_confirmed_tx_ids = {row[0] for row in cur.fetchall()}
    conn.close()
    return total, by_miner, by_address, db_tx_ids, db_confirmed_tx_ids


def on_chain_outgoing(wallet, addresses):
    """Return on-chain outgoing transfer data for the given recipient addresses.

    Returns net totals, gross totals (amount + fee), total fees, and the set of
    transaction IDs seen.  This is informational because the node's RPC does not
    expose every output of a hybrid transaction.
    """
    total = rpc_call("getTransactionHistory", {"address": wallet, "offset": 0, "limit": 1})["total"]
    by_addr_net = defaultdict(int)
    by_addr_gross = defaultdict(int)
    fee_total = 0
    chain_tx_ids = set()
    chain_txs = {}
    for offset in range(0, total, 1000):
        r = rpc_call("getTransactionHistory", {"address": wallet, "offset": offset, "limit": 1000})
        for tx in r.get("transactions", []):
            t = tx.get("transaction", {})
            if t.get("from") == wallet:
                to = t.get("to", "")
                if to in addresses and to != wallet:
                    amount = int(t.get("amount_zion", 0))
                    fee = int(t.get("fee_zion", 0))
                    by_addr_net[to] += amount
                    by_addr_gross[to] += amount + fee
                    fee_total += fee
                    txid = t.get("tx_id", "")
                    if txid:
                        chain_tx_ids.add(txid)
                        chain_txs[txid] = {"to": to, "amount": amount, "fee": fee}
    return {
        "by_addr_net": dict(by_addr_net),
        "by_addr_gross": dict(by_addr_gross),
        "fee_total": fee_total,
        "chain_tx_ids": chain_tx_ids,
        "chain_txs": chain_txs,
    }


def pool_api_total(host, port):
    data = http_get(f"http://{host}:{port}/stats", timeout=10)
    return int(data.get("pplns", {}).get("total_paid_flowers", 0))


def prometheus_total(host, port):
    with urllib.request.urlopen(f"http://{host}:{port}/metrics", timeout=10) as r:
        for line in r.read().decode().splitlines():
            line = line.strip()
            if line.startswith("zion_pplns_total_paid_flowers "):
                return int(float(line.split()[-1]))
    return None


def dashboard_miner_detail(address, host, port, auth):
    return http_get(f"http://{host}:{port}/api/pool/miner-detail/{address}", auth=auth, timeout=10)


def journal_readonly_errors(service="zion-edge-pool.service", since_minutes=10):
    cmd = (
        f"journalctl -u {service} --no-pager --since '{since_minutes} minutes ago' "
        "| grep -i 'readonly database' | wc -l"
    )
    result = os.popen(cmd).read().strip()
    try:
        return int(result)
    except ValueError:
        return 0


def main():
    cfg = DEFAULTS
    db_path = cfg["db_path"]
    pplns_path = cfg["pplns_path"]
    wallet = cfg["pool_wallet"]
    tolerance = cfg["tolerance_flowers"]
    on_chain_tolerance = cfg["on_chain_tolerance_flowers"]

    report = {"ok": True, "checks": [], "tolerance_flowers": tolerance}

    # 1. PPLNS vs SQLite
    pplns = load_pplns(pplns_path)
    db_total, db_by_miner, db_by_address, db_tx_ids, db_confirmed_tx_ids = load_db_totals(db_path)
    pplns_total = int(pplns.get("total_paid_flowers", 0))
    pplns_by_miner = {k: int(v) for k, v in pplns.get("paid_per_miner", {}).items()}

    report["pplns_total"] = pplns_total
    report["sqlite_total"] = db_total
    report["diff_pplns_sqlite"] = pplns_total - db_total

    mismatched_miners = []
    for miner, pplns_val in pplns_by_miner.items():
        db_val = db_by_miner.get(miner, 0)
        if abs(pplns_val - db_val) > tolerance:
            mismatched_miners.append({"miner": miner, "pplns": pplns_val, "sqlite": db_val, "diff": pplns_val - db_val})
    if mismatched_miners:
        report["ok"] = False
        report["mismatched_miners"] = mismatched_miners

    # 2. Pool /stats vs SQLite
    try:
        api_total = pool_api_total(cfg["pool_api"][0], cfg["pool_api"][1])
        report["pool_api_total"] = api_total
        report["diff_pool_api_sqlite"] = api_total - db_total
        if abs(api_total - db_total) > tolerance:
            report["ok"] = False
            report.setdefault("errors", []).append("pool /stats total_paid mismatch")
    except Exception as e:
        report["pool_api_error"] = str(e)

    # 3. Prometheus vs SQLite
    try:
        prom_total = prometheus_total(cfg["pool_api"][0], cfg["pool_api"][1])
        report["prometheus_total"] = prom_total
        if prom_total is not None:
            report["diff_prometheus_sqlite"] = prom_total - db_total
            if abs(prom_total - db_total) > tolerance:
                report["ok"] = False
                report.setdefault("errors", []).append("Prometheus pplns paid mismatch")
    except Exception as e:
        report["prometheus_error"] = str(e)

    # 4. On-chain vs SQLite (informational)
    addresses = {addr for addr in pplns.get("addresses", {}).values() if addr and addr.startswith("zion1")}
    try:
        chain = on_chain_outgoing(wallet, addresses)
        report["on_chain_net_total"] = sum(chain["by_addr_net"].values())
        report["on_chain_gross_total"] = sum(chain["by_addr_gross"].values())
        report["tx_fee_drift_flowers"] = chain["fee_total"]
        report["diff_on_chain_net_sqlite"] = report["on_chain_net_total"] - db_total
        report["diff_on_chain_gross_sqlite"] = report["on_chain_gross_total"] - db_total

        missing_confirmed = db_confirmed_tx_ids - chain["chain_tx_ids"]
        unrecorded_chain = chain["chain_tx_ids"] - db_tx_ids
        if missing_confirmed:
            report["ok"] = False
            report.setdefault("errors", []).append(
                f"{len(missing_confirmed)} confirmed DB payouts not found on chain"
            )
            report["missing_confirmed_tx_ids"] = sorted(list(missing_confirmed))[:10]

        report["db_unique_tx_count"] = len(db_tx_ids)
        report["on_chain_unique_tx_count"] = len(chain["chain_tx_ids"])
        report["unrecorded_chain_tx_count"] = len(unrecorded_chain)

        address_mismatches = []
        for addr in addresses:
            db_val = db_by_address.get(addr, 0)
            gross_val = chain["by_addr_gross"].get(addr, 0)
            net_val = chain["by_addr_net"].get(addr, 0)
            if (gross_val or db_val) and abs(db_val - gross_val) > on_chain_tolerance:
                address_mismatches.append(
                    {
                        "address": addr,
                        "sqlite": db_val,
                        "on_chain_gross": gross_val,
                        "on_chain_net": net_val,
                        "diff_gross": db_val - gross_val,
                        "diff_net": db_val - net_val,
                    }
                )
        if address_mismatches:
            report["on_chain_address_mismatches"] = address_mismatches
    except Exception as e:
        report["on_chain_error"] = str(e)

    # 5. Dashboard miner-detail consistency
    dashboard_auth = cfg["dashboard_auth"]
    if dashboard_auth:
        dashboard_errors = []
        for addr in list(addresses)[:10]:
            try:
                detail = dashboard_miner_detail(addr, cfg["dashboard_api"][0], cfg["dashboard_api"][1], dashboard_auth)
                payouts = detail.get("payouts", [])
                sum_atomic = sum(int(p.get("amount_atomic", 0) or 0) for p in payouts)
                stats_total = int(detail.get("stats", {}).get("total_paid", 0))
                if abs(sum_atomic - stats_total) > tolerance:
                    dashboard_errors.append({"address": addr, "stats_total": stats_total, "payouts_sum": sum_atomic, "diff": sum_atomic - stats_total})
            except Exception as e:
                report.setdefault("dashboard_errors", []).append({"address": addr, "error": str(e)[:120]})
        if dashboard_errors:
            report["ok"] = False
            report["dashboard_detail_mismatches"] = dashboard_errors
    else:
        report["dashboard_skipped"] = "DASHBOARD_AUTH not set"

    # 6. Recent readonly DB errors
    try:
        readonly_errors = journal_readonly_errors()
        report["readonly_db_errors_10m"] = readonly_errors
        if readonly_errors:
            report["ok"] = False
            report.setdefault("errors", []).append(f"{readonly_errors} readonly DB errors in last 10m")
    except Exception as e:
        report["journalctl_error"] = str(e)

    print(json.dumps(report, indent=2))
    sys.exit(0 if report["ok"] else 1)


if __name__ == "__main__":
    main()
