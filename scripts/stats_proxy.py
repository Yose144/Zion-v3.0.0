#!/usr/bin/env python3
"""
ZION Stats CORS Proxy
Fetches pool/API data from the canonical Zion2 primary host and serves it locally.

Použití:
    python scripts/stats_proxy.py

Pak otevři:
    http://localhost:9999/dashboard   (nebo LIVESTATS.html přes http://localhost:9999/)
"""

import json
import urllib.request
import urllib.error
from http.server import HTTPServer, BaseHTTPRequestHandler
import subprocess
import threading
import time
import os

# ── Konfigurace ──────────────────────────────────────────────────────────────
POOL_API      = "http://91.98.122.165:8080/stats"
PROXY_PORT    = 9999
STATIC_ROOT   = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # repo root

# SSH přihlašovací údaje pro primární host
NODES = {
    "zion2": {"host": "91.98.122.165", "has_pool": True},
}

_cache: dict = {}
_cache_lock = threading.Lock()
_cache_ttl = 10  # sekund

def fetch_pool_stats() -> dict:
    """Načte stats z pool API na primárním hostu Zion2."""
    try:
        req = urllib.request.Request(POOL_API, headers={"User-Agent": "zion-proxy/1.0"})
        with urllib.request.urlopen(req, timeout=5) as r:
            return json.loads(r.read())
    except Exception as e:
        return {"error": str(e), "ok": False}

def fetch_miner_stats(host: str) -> dict:
    """Načte posledních 5 řádek logu zion-miner přes SSH."""
    try:
        cmd = [
            "ssh", "-o", "ConnectTimeout=5", "-o", "StrictHostKeyChecking=no",
            f"root@{host}",
            "docker logs zion-miner --since 2m 2>&1 | grep -E 'EVENT|UPTIME' | tail -3"
        ]
        out = subprocess.check_output(cmd, timeout=8, stderr=subprocess.DEVNULL).decode()
        lines = [l.strip() for l in out.strip().splitlines() if l.strip()]
        # Parsuj posledni UPTIME radku
        result = {"raw": lines, "hashes": None, "uptime": None,
                  "accepted": None, "algo": None}
        for line in reversed(lines):
            if "UPTIME" in line:
                # │  UPTIME  00:33:02  hashes: 50.2K  algo: cosmic_harmony_v3
                parts = line.replace("│", "").split()
                for i, p in enumerate(parts):
                    if p == "hashes:" and i+1 < len(parts):
                        result["hashes"] = parts[i+1]
                    if p == "algo:" and i+1 < len(parts):
                        result["algo"] = parts[i+1]
                    if ":" in p and p[0].isdigit():
                        result["uptime"] = p
                break
        for line in reversed(lines):
            if "EVENT" in line and "accepted" in line:
                # │  EVENT  [21:29:20] accepted 51/0 (+1) diff 0 (100.0%)
                parts = line.replace("│", "").split()
                for i, p in enumerate(parts):
                    if p == "accepted" and i+1 < len(parts):
                        result["accepted"] = parts[i+1]  # e.g. "52/0"
                break
        return result
    except Exception as e:
        return {"error": str(e)}

def get_combined_stats() -> dict:
    """Agregace všech zdrojů, výsledek cachuje na _cache_ttl sekund."""
    global _cache
    now = time.time()
    with _cache_lock:
        if _cache.get("_ts", 0) + _cache_ttl > now:
            return _cache

    pool = fetch_pool_stats()

    # Miner stats přes SSH (paralelně)
    miner_results = {}
    threads = []
    for name, cfg in NODES.items():
        def _fetch(n=name, h=cfg["host"]):
            miner_results[n] = fetch_miner_stats(h)
        t = threading.Thread(target=_fetch)
        t.daemon = True
        threads.append(t)
        t.start()
    for t in threads:
        t.join(timeout=10)

    combined = {
        "_ts": now,
        "_generated": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "pool": pool,
        "miners": miner_results,
    }

    with _cache_lock:
        _cache = combined

    return combined


class ProxyHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print(f"[proxy] {self.address_string()} {fmt % args}")

    def send_cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Cache-Control", "no-cache")

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_cors()
        self.end_headers()

    def do_GET(self):
        # ── /api/stats → pool proxy ──────────────────────────────────────────
        if self.path == "/api/stats":
            data = fetch_pool_stats()
            body = json.dumps(data).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_cors()
            self.end_headers()
            self.wfile.write(body)
            return

        # ── /api/combined → poolstats + miner ssh stats ──────────────────────
        if self.path == "/api/combined":
            data = get_combined_stats()
            body = json.dumps(data).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_cors()
            self.end_headers()
            self.wfile.write(body)
            return

        # ── Static file serving (LIVESTATS.html etc.) ────────────────────────
        if self.path in ("/", "/dashboard"):
            path = os.path.join(STATIC_ROOT, "LIVESTATS.html")
        else:
            path = os.path.join(STATIC_ROOT, self.path.lstrip("/"))

        if os.path.isfile(path):
            ext = path.rsplit(".", 1)[-1].lower()
            ctype = {"html": "text/html", "js": "application/javascript",
                     "css": "text/css", "json": "application/json"}.get(ext, "text/plain")
            with open(path, "rb") as f:
                body = f.read()
            self.send_response(200)
            self.send_header("Content-Type", ctype)
            self.send_cors()
            self.end_headers()
            self.wfile.write(body)
            return

        self.send_response(404)
        self.end_headers()
        self.wfile.write(b"Not found")


if __name__ == "__main__":
    srv = HTTPServer(("0.0.0.0", PROXY_PORT), ProxyHandler)
    print(f"╔══════════════════════════════════════════╗")
    print(f"║  ZION Stats Proxy — port {PROXY_PORT}           ║")
    print(f"╠══════════════════════════════════════════╣")
    print(f"║  Dashboard:  http://localhost:{PROXY_PORT}/       ║")
    print(f"║  Pool API:   http://localhost:{PROXY_PORT}/api/stats    ║")
    print(f"║  Combined:   http://localhost:{PROXY_PORT}/api/combined ║")
    print(f"╚══════════════════════════════════════════╝")
    print(f"  → forwards to {POOL_API}")
    print(f"  → SSH miner stats: USA + Asia")
    print(f"  → cache TTL: {_cache_ttl}s\n")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\nProxy zastaven.")
