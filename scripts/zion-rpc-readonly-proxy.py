#!/usr/bin/env python3
"""
ZION V3 — Read-Only JSON-RPC Proxy
Filters JSON-RPC requests so only safe read-only methods pass through.
Runs between nginx (public) and the local zion-core node RPC (localhost:8443).

Whitelist:
  getBalance, getChainInfo, getTransaction, getBlock, getBlockHash,
  getSyncStatus, getPeers, getDifficulty, getMempool, getAddressHistory,
  getPoolStats, getHeight, getTipHash, getBlockTemplate, getPoolInfo

Deployment:
  1. Copy to /usr/local/bin/zion-rpc-readonly-proxy.py
  2. chmod +x /usr/local/bin/zion-rpc-readonly-proxy.py
  3. systemctl start zion-rpc-proxy
  4. nginx proxies public port 8443 → localhost:8447 (this proxy)
"""
import http.server
import json
import http.client
import sys
import os

# ── Config ──────────────────────────────────────────────────────────────────
UPSTREAM_HOST = os.environ.get("ZION_UPSTREAM_HOST", "127.0.0.1")
UPSTREAM_PORT = int(os.environ.get("ZION_UPSTREAM_PORT", "8443"))
LISTEN_HOST   = os.environ.get("ZION_PROXY_HOST", "127.0.0.1")
LISTEN_PORT   = int(os.environ.get("ZION_PROXY_PORT", "8447"))

READONLY_METHODS = {
    "getbalance", "getchaininfo", "gettransaction", "getblock",
    "getblockhash", "getsyncstatus", "getpeers", "getdifficulty",
    "getmempool", "getaddresshistory", "getpoolstats", "getheight",
    "gettiphash", "getblocktemplate", "getpoolinfo", "getstakeinfo",
    "getsupply", "getfeesplit", "validateaddress", "decodeTransaction",
}

# ── Proxy Handler ──────────────────────────────────────────────────────────
class ReadOnlyProxy(http.server.BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):
        sys.stderr.write(f"[ZION-RPC-PROXY] {self.address_string()} {fmt % args}\n")

    def _send_json(self, status, body_dict):
        body = json.dumps(body_dict).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        if content_length <= 0 or content_length > 128 * 1024:
            return self._send_json(400, {
                "jsonrpc": "2.0", "id": None,
                "error": {"code": -32700, "message": "Invalid request body"}
            })

        try:
            raw = self.rfile.read(content_length).decode("utf-8")
            req = json.loads(raw)
        except Exception:
            return self._send_json(400, {
                "jsonrpc": "2.0", "id": None,
                "error": {"code": -32700, "message": "Parse error"}
            })

        method = str(req.get("method", "")).strip().lower()
        req_id = req.get("id", None)

        if method not in READONLY_METHODS:
            return self._send_json(403, {
                "jsonrpc": "2.0", "id": req_id,
                "error": {
                    "code": -32601,
                    "message": f"Method '{method}' is not allowed on the read-only endpoint."
                }
            })

        # Forward to upstream node RPC
        try:
            conn = http.client.HTTPConnection(UPSTREAM_HOST, UPSTREAM_PORT, timeout=10)
            conn.request("POST", "/jsonrpc", body=raw, headers={
                "Content-Type": "application/json",
                "Content-Length": str(len(raw.encode("utf-8")))
            })
            upstream = conn.getresponse()
            resp_body = upstream.read()
            conn.close()

            self.send_response(upstream.status)
            for hdr in ("Content-Type", "Content-Length"):
                if upstream.getheader(hdr):
                    self.send_header(hdr, upstream.getheader(hdr))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(resp_body)
        except Exception as e:
            self._send_json(502, {
                "jsonrpc": "2.0", "id": req_id,
                "error": {"code": -32000, "message": f"Upstream error: {e}"}
            })


# ── Main ────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    server = http.server.HTTPServer((LISTEN_HOST, LISTEN_PORT), ReadOnlyProxy)
    print(f"ZION Read-Only RPC Proxy listening on {LISTEN_HOST}:{LISTEN_PORT}")
    print(f"Forwarding whitelisted methods to {UPSTREAM_HOST}:{UPSTREAM_PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
        server.shutdown()
