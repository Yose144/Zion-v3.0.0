#!/usr/bin/env python3
"""Tests for g8_probe_exporter — uses fake TCP JSON-RPC / HTTP / TCP servers
bound to ephemeral ports (no fixed ports, no production services)."""

import json
import os
import socket
import sys
import threading
import time
import unittest
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import g8_probe_exporter as g8x  # noqa: E402


class FakeRpcServer(threading.Thread):
    """Minimal line-delimited JSON-RPC server on an ephemeral port."""

    def __init__(self, height=1234, tip_ts=None):
        super().__init__(daemon=True)
        self.height = height
        self.tip_ts = tip_ts if tip_ts is not None else int(time.time())
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.sock.bind(("127.0.0.1", 0))
        self.sock.listen(8)
        self.port = self.sock.getsockname()[1]
        self.requests = []

    def run(self):
        while True:
            try:
                conn, _ = self.sock.accept()
            except OSError:
                return
            try:
                conn.settimeout(5)
                data = b""
                while not data.endswith(b"\n"):
                    chunk = conn.recv(65536)
                    if not chunk:
                        break
                    data += chunk
                req = json.loads(data.decode())
                self.requests.append(req.get("method"))
                if req.get("method") == "getStatus":
                    result = {"native_chain_height": self.height}
                elif req.get("method") == "getBlockByHeight":
                    result = {"timestamp": self.tip_ts,
                              "height": req.get("params", {}).get("height")}
                else:
                    result = {}
                conn.sendall(json.dumps(
                    {"jsonrpc": "2.0", "id": req.get("id"), "result": result}
                ).encode() + b"\n")
            except Exception:
                pass
            finally:
                try:
                    conn.close()
                except OSError:
                    pass


class FakeHttpHandler(BaseHTTPRequestHandler):
    status = 200

    def do_GET(self):  # noqa: N802
        body = b'{"status":"ok"}' if self.status < 300 else b'bad'
        self.send_response(self.status)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *a):
        pass


def make_http_server(status):
    class H(FakeHttpHandler):
        pass
    H.status = status
    srv = ThreadingHTTPServer(("127.0.0.1", 0), H)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


def make_tcp_listener():
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    sock.bind(("127.0.0.1", 0))
    sock.listen(4)
    port = sock.getsockname()[1]

    def loop():
        while True:
            try:
                conn, _ = sock.accept()
                conn.close()
            except OSError:
                return
    threading.Thread(target=loop, daemon=True).start()
    return sock, port


def closed_port() -> int:
    """An ephemeral port that is (very likely) closed right now."""
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return port


def config_for(node_ports, http_services=None, stratum_port=None, max_age=900):
    return {
        "timeout": 2.0,
        "chain_tip_max_age": max_age,
        "node_rpc_host": "127.0.0.1",
        "node_rpc_ports": node_ports,
        "http_services": http_services or [],
        "stratum_host": "127.0.0.1",
        "stratum_port": stratum_port or 1,
    }


class ProbeTests(unittest.TestCase):
    def test_node_status_and_tip_parsing(self):
        srv = FakeRpcServer(height=4242, tip_ts=int(time.time()) - 30)
        srv.start()
        out = g8x.probe_node("127.0.0.1", srv.port, 2.0, want_tip=True)
        self.assertTrue(out["success"])
        self.assertEqual(out["chain_height"], 4242)
        self.assertIsInstance(out["tip_timestamp"], int)
        self.assertIn("getStatus", srv.requests)
        self.assertIn("getBlockByHeight", srv.requests)

    def test_follower_does_not_query_tip(self):
        srv = FakeRpcServer()
        srv.start()
        out = g8x.probe_node("127.0.0.1", srv.port, 2.0, want_tip=False)
        self.assertTrue(out["success"])
        self.assertNotIn("getBlockByHeight", srv.requests)
        self.assertIsNone(out["tip_timestamp"])

    def test_chain_live_fresh_and_stale(self):
        now = time.time()
        fresh = {"services": {"node_primary": {"success": True, "duration": 0.01}},
                 "chain_height": 10, "tip_timestamp": now - 100,
                 "node_quorum": 1, "primary_ok": True}
        text = g8x.render_metrics(fresh, config_for([], max_age=900), now=now)
        self.assertIn("zion_g8_chain_live 1", text)
        stale = dict(fresh, tip_timestamp=now - 5000)
        text = g8x.render_metrics(stale, config_for([], max_age=900), now=now)
        self.assertIn("zion_g8_chain_live 0", text)

    def test_future_tip_not_live(self):
        now = time.time()
        rep = {"services": {"node_primary": {"success": True, "duration": 0.01}},
               "chain_height": 10, "tip_timestamp": now + 300,
               "node_quorum": 1, "primary_ok": True}
        text = g8x.render_metrics(rep, config_for([], max_age=900), now=now)
        self.assertIn("zion_g8_chain_live 0", text)
        self.assertIn("zion_g8_chain_tip_age_seconds -300.0", text)

    def test_unknown_tip_sentinel(self):
        now = time.time()
        rep = {"services": {"node_primary": {"success": True, "duration": 0.01}},
               "chain_height": 10, "tip_timestamp": None,
               "node_quorum": 1, "primary_ok": True}
        text = g8x.render_metrics(rep, config_for([], max_age=900), now=now)
        self.assertIn("zion_g8_chain_live 0", text)
        self.assertIn("zion_g8_chain_tip_age_seconds -1.0", text)

    def test_http_2xx_and_500(self):
        ok_srv = make_http_server(200)
        bad_srv = make_http_server(500)
        try:
            ok = g8x.probe_http(f"http://127.0.0.1:{ok_srv.server_port}/health", 2.0)
            bad = g8x.probe_http(f"http://127.0.0.1:{bad_srv.server_port}/health", 2.0)
            self.assertTrue(ok["success"])
            self.assertFalse(bad["success"])
        finally:
            ok_srv.shutdown()
            bad_srv.shutdown()

    def test_stratum_tcp_connect(self):
        sock, port = make_tcp_listener()
        try:
            self.assertTrue(g8x.probe_tcp("127.0.0.1", port, 2.0)["success"])
            sock.shutdown(socket.SHUT_RDWR)
        finally:
            sock.close()
        self.assertFalse(g8x.probe_tcp("127.0.0.1", closed_port(), 2.0)["success"])

    def test_full_round_metrics(self):
        node = FakeRpcServer(height=77)
        node.start()
        http_ok = make_http_server(200)
        stratum_sock, stratum_port = make_tcp_listener()
        cfg = config_for(
            [node.port, closed_port(), closed_port()],  # only primary is up
            http_services=[("pool_http", f"http://127.0.0.1:{http_ok.server_port}/health")],
            stratum_port=stratum_port,
        )
        try:
            report = g8x.run_probes(cfg)
            text = g8x.render_metrics(report, cfg)
        finally:
            http_ok.shutdown()
            stratum_sock.close()

        for name in ("zion_g8_probe_success", "zion_g8_probe_duration_seconds",
                     "zion_g8_chain_height", "zion_g8_chain_tip_timestamp_seconds",
                     "zion_g8_chain_tip_age_seconds", "zion_g8_chain_live",
                     "zion_g8_node_quorum", "zion_g8_probe_timestamp_seconds"):
            self.assertIn(f"# HELP {name}", text)
            self.assertIn(f"# TYPE {name} gauge", text)
            self.assertIn(name, text)
        self.assertIn('zion_g8_probe_success{service="node_primary"} 1', text)
        self.assertIn('zion_g8_probe_success{service="node_follower_2"} 0', text)
        self.assertIn('zion_g8_probe_success{service="pool_http"} 1', text)
        self.assertIn('zion_g8_probe_success{service="pool_stratum"} 1', text)
        self.assertIn("zion_g8_node_quorum 1", text)
        self.assertIn("zion_g8_chain_height 77", text)

    def test_failures_become_zero_not_crash(self):
        p = closed_port()
        cfg = config_for([closed_port(), closed_port(), closed_port()],
                         http_services=[("pool_http", f"http://127.0.0.1:{p}/health")],
                         stratum_port=closed_port())
        report = g8x.run_probes(cfg)
        text = g8x.render_metrics(report, cfg)
        self.assertIn('zion_g8_probe_success{service="node_primary"} 0', text)
        self.assertIn('zion_g8_probe_success{service="pool_stratum"} 0', text)
        self.assertIn("zion_g8_node_quorum 0", text)
        self.assertIn("zion_g8_chain_live 0", text)

    def test_metrics_handler_500_on_internal_error(self):
        g8x.ExporterHandler.config = config_for([closed_port()])
        srv = ThreadingHTTPServer(("127.0.0.1", 0), g8x.ExporterHandler)
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        url = f"http://127.0.0.1:{srv.server_port}/metrics"
        try:
            with mock.patch.object(g8x, "run_probes", side_effect=RuntimeError("boom")):
                with self.assertRaises(urllib.error.HTTPError) as ctx:
                    urllib.request.urlopen(url, timeout=5)
                self.assertEqual(ctx.exception.code, 500)
            with urllib.request.urlopen(url, timeout=5) as resp:
                self.assertEqual(resp.status, 200)
                self.assertIn(b"zion_g8_probe_success", resp.read())
        finally:
            srv.shutdown()
            srv.server_close()


if __name__ == "__main__":
    unittest.main()
