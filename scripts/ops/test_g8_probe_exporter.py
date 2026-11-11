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


def config_for(node_ports, http_services=None, stratum_port=None, max_age=900,
               future_tolerance=120):
    return {
        "timeout": 2.0,
        "chain_tip_max_age": max_age,
        "tip_future_tolerance": future_tolerance,
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

    def test_chain_live_fresh_via_follower_when_primary_down(self):
        # The primary probe failing must not count as a chain outage when a
        # follower still reports a fresh tip (planned restarts, tunnel flap).
        now = time.time()
        rep = {"services": {
                   "node_primary": {"success": False, "duration": 0.01, "tip_timestamp": None},
                   "node_follower_2": {"success": True, "duration": 0.01,
                                       "tip_timestamp": now - 30}},
               "chain_height": 10, "tip_timestamp": now - 30,
               "node_quorum": 1, "primary_ok": False}
        text = g8x.render_metrics(rep, config_for([], max_age=900), now=now)
        self.assertIn("zion_g8_chain_live 1", text)
        self.assertIn('zion_g8_node_tip_fresh{service="node_primary"} 0', text)
        self.assertIn('zion_g8_node_tip_fresh{service="node_follower_2"} 1', text)

    def test_chain_live_quorum_fallback_end_to_end(self):
        primary = closed_port()
        follower = FakeRpcServer(height=99)
        follower.start()
        cfg = config_for([primary, follower.port, closed_port()])
        report = g8x.run_probes(cfg)
        text = g8x.render_metrics(report, cfg)
        self.assertFalse(report["primary_ok"])
        self.assertEqual(report["node_quorum"], 1)
        self.assertEqual(report["chain_height"], 99)
        self.assertIsNotNone(report["tip_timestamp"])
        self.assertIn("zion_g8_chain_live 1", text)
        self.assertIn("zion_g8_chain_height 99", text)
        self.assertIn('zion_g8_probe_success{service="node_primary"} 0', text)
        self.assertIn('zion_g8_node_tip_fresh{service="node_follower_2"} 1', text)

    def test_stale_tips_everywhere_not_live(self):
        stale_ts = int(time.time()) - 5000
        nodes = [FakeRpcServer(tip_ts=stale_ts) for _ in range(2)]
        for n in nodes:
            n.start()
        cfg = config_for([n.port for n in nodes])
        report = g8x.run_probes(cfg)
        text = g8x.render_metrics(report, cfg)
        self.assertIn("zion_g8_chain_live 0", text)
        self.assertIn('zion_g8_node_tip_fresh{service="node_primary"} 0', text)
        self.assertIn('zion_g8_node_tip_fresh{service="node_follower_2"} 0', text)

    def test_future_tip_not_live(self):
        now = time.time()
        rep = {"services": {"node_primary": {"success": True, "duration": 0.01}},
               "chain_height": 10, "tip_timestamp": now + 300,
               "node_quorum": 1, "primary_ok": True}
        text = g8x.render_metrics(rep, config_for([], max_age=900), now=now)
        self.assertIn("zion_g8_chain_live 0", text)
        self.assertIn("zion_g8_chain_tip_age_seconds -300.0", text)

    def test_small_future_skew_is_live(self):
        # Miner-supplied block timestamps may be a few seconds ahead of the
        # probe host; that is not a liveness failure.
        now = time.time()
        rep = {"services": {"node_primary": {"success": True, "duration": 0.01}},
               "chain_height": 10, "tip_timestamp": now + 60,
               "node_quorum": 1, "primary_ok": True}
        text = g8x.render_metrics(rep, config_for([], max_age=900), now=now)
        self.assertIn("zion_g8_chain_live 1", text)
        self.assertIn("zion_g8_chain_tip_age_seconds -60.0", text)

    def test_failed_probe_clears_stale_tip_fields(self):
        # A probe that got getStatus but failed getBlockByHeight must not leak
        # the height/tip into selection (that is how a stale tip produced a
        # chain_live=0 incident on 2026-11-08).
        with mock.patch.object(
            g8x, "rpc_call",
            side_effect=[{"native_chain_height": 115406}, RuntimeError("boom")],
        ):
            out = g8x.probe_node("127.0.0.1", 1, 1.0, want_tip=True)
        self.assertFalse(out["success"])
        self.assertIsNone(out["chain_height"])
        self.assertIsNone(out["tip_timestamp"])

    def test_failed_primary_does_not_win_tip_selection(self):
        now = time.time()

        def fake_probe(host, port, timeout, want_tip):
            if port == 1111:
                return {"success": False, "duration": 0.0,
                        "chain_height": 100, "tip_timestamp": now - 10000}
            return {"success": True, "duration": 0.0,
                    "chain_height": 200, "tip_timestamp": now - 30}

        cfg = config_for([1111, 2222], stratum_port=closed_port())
        with mock.patch.object(g8x, "probe_node", side_effect=fake_probe):
            report = g8x.run_probes(cfg)
        self.assertEqual(report["chain_height"], 200)
        self.assertAlmostEqual(report["tip_timestamp"], now - 30, places=3)
        text = g8x.render_metrics(report, cfg, now=now)
        self.assertIn("zion_g8_chain_live 1", text)
        self.assertIn("zion_g8_chain_height 200", text)

    def test_per_node_tip_age_and_height_metrics(self):
        rep = {"services": {
                   "node_primary": {"success": True, "duration": 0.01,
                                    "chain_height": 500, "tip_timestamp": 970},
                   "node_follower_2": {"success": True, "duration": 0.01,
                                       "chain_height": 499, "tip_timestamp": 969}},
               "chain_height": 500, "tip_timestamp": 970,
               "node_quorum": 2, "primary_ok": True}
        text = g8x.render_metrics(rep, config_for([], max_age=900), now=1000)
        self.assertIn('zion_g8_node_tip_age_seconds{service="node_primary"} 30.0', text)
        self.assertIn('zion_g8_node_tip_age_seconds{service="node_follower_2"} 31.0', text)
        self.assertIn('zion_g8_node_chain_height{service="node_primary"} 500', text)
        self.assertIn('zion_g8_node_chain_height{service="node_follower_2"} 499', text)

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
                     "zion_g8_node_tip_fresh",
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


class FlakyHttpHandler(BaseHTTPRequestHandler):
    """HTTP handler that fails the first N requests, then answers 200."""

    failures_left = 0

    def do_GET(self):
        cls = type(self)
        if cls.failures_left > 0:
            cls.failures_left -= 1
            self.send_response(500)
        else:
            self.send_response(200)
        body = b"{}"
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *a):
        pass


def make_flaky_http_server(failures: int):
    class H(FlakyHttpHandler):
        failures_left = failures

    srv = ThreadingHTTPServer(("127.0.0.1", 0), H)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


class ProbeConfirmationTests(unittest.TestCase):
    """A single missed sample must not become a 60 s G8 outage."""

    def _config(self, url, attempts=2, delay_ms=0):
        cfg = config_for([], http_services=[("multichain", url)])
        cfg["confirm_attempts"] = attempts
        cfg["confirm_delay_ms"] = delay_ms
        return cfg

    def test_transient_failure_is_confirmed_away(self):
        srv = make_flaky_http_server(failures=1)
        try:
            cfg = self._config(f"http://127.0.0.1:{srv.server_port}/health")
            report = g8x.run_probes(cfg)
            res = report["services"]["multichain"]
            self.assertTrue(res["success"], "retry must turn a one-off failure into success")
            self.assertTrue(res["retried"])
            self.assertEqual(res["attempts"], 2)
        finally:
            srv.shutdown()
            srv.server_close()

    def test_persistent_failure_stays_failure(self):
        port = closed_port()
        cfg = self._config(f"http://127.0.0.1:{port}/health", attempts=3)
        report = g8x.run_probes(cfg)
        res = report["services"]["multichain"]
        self.assertFalse(res["success"])
        self.assertTrue(res["retried"])
        self.assertEqual(res["attempts"], 3)

    def test_healthy_round_does_not_retry(self):
        srv = make_http_server(200)
        try:
            cfg = self._config(f"http://127.0.0.1:{srv.server_port}/health")
            report = g8x.run_probes(cfg)
            res = report["services"]["multichain"]
            self.assertTrue(res["success"])
            self.assertFalse(res["retried"])
            self.assertEqual(res["attempts"], 1)
        finally:
            srv.shutdown()
            srv.server_close()

    def test_retried_flag_is_exposed_in_metrics(self):
        srv = make_flaky_http_server(failures=1)
        try:
            cfg = self._config(f"http://127.0.0.1:{srv.server_port}/health")
            report = g8x.run_probes(cfg)
            text = g8x.render_metrics(report, cfg, now=time.time())
            self.assertIn('zion_g8_probe_success{service="multichain"} 1\n', text)
            self.assertIn('zion_g8_probe_retried{service="multichain"} 1\n', text)
        finally:
            srv.shutdown()
            srv.server_close()


if __name__ == "__main__":
    unittest.main()
