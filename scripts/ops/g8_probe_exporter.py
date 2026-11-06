#!/usr/bin/env python3
"""G8 30-day continuous-run probe exporter.

Prometheus exporter that probes the ZION V31 production services and exposes
the results as metrics on /metrics (default 127.0.0.1:9105).

Probes (run concurrently on every scrape):
  - raw TCP line-delimited JSON-RPC getStatus on the three node RPC ports
    (labels node_primary, node_follower_2, node_follower_3). Every node
    additionally answers getBlockByHeight {"height": <native_chain_height>} on
    a fresh socket so the exporter can compute the chain tip age; chain_live
    uses the freshest tip reported by any node, so a planned restart of a
    single node does not count as a chain outage (per-node freshness and the
    node_primary probe result remain visible as separate metrics).
  - HTTP GET expecting a 2xx for pool / multichain / DAO / ZIS health URLs.
  - TCP connect for the public pool stratum port.

Every failed probe is retried (only the failures) after a short delay before it
is reported as a failure. G8 samples one point per 60 s bucket, so a single
missed packet used to be recorded as a whole 60 s outage — on 2026-11-01 that
turned 480 s of healthy services (no restarts) into four services under the
99.9 % gate. The confirmation round makes `zion_g8_probe_success=0` mean a
sustained failure; `zion_g8_probe_retried=1` keeps the flakiness visible so it
can still be alerted on instead of being silently smoothed away.

Endpoints:
  /health   200 JSON — exporter process liveness
  /metrics  Prometheus text exposition
  anything else -> 404

Environment overrides:
  G8_LISTEN_HOST               (127.0.0.1)
  G8_LISTEN_PORT               (9105)
  G8_PROBE_TIMEOUT_SECONDS     (3)
  G8_PROBE_CONFIRM_ATTEMPTS    (2)  attempts per probe before reporting failure
  G8_PROBE_CONFIRM_DELAY_MS    (400) delay between the attempts
  G8_CHAIN_TIP_MAX_AGE_SECONDS (900)
  G8_NODE_RPC_PORTS            (9445,9446,9447)
  G8_POOL_HEALTH_URL           (http://127.0.0.1:8080/health)
  G8_MULTICHAIN_HEALTH_URL     (http://127.0.0.1:8453/health)
  G8_DAO_HEALTH_URL            (http://127.0.0.1:8456/api/dao/health)
  G8_ZIS_HEALTH_URL            (http://127.0.0.1:8096/health)
  G8_STRATUM_HOST              (127.0.0.1)
  G8_STRATUM_PORT              (8444)
                               On EDGE2 set G8_STRATUM_HOST to the EDGE
                               public IP (62.171.141.136) — stratum is not
                               on EDGE2 loopback; see
                               V31/deploy/systemd/zion-g8-probe.service.d/
                               10-edge2-stratum.conf

Python stdlib only.
"""

import json
import os
import socket
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

NODE_LABELS = ("node_primary", "node_follower_2", "node_follower_3")


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, default))
    except (TypeError, ValueError):
        return default


def _env_float(name: str, default: float) -> float:
    try:
        return float(os.environ.get(name, default))
    except (TypeError, ValueError):
        return default


def load_config() -> dict:
    """Read exporter configuration from the environment."""
    ports = []
    for part in os.environ.get("G8_NODE_RPC_PORTS", "9445,9446,9447").split(","):
        part = part.strip()
        if not part:
            continue
        try:
            ports.append(int(part))
        except ValueError:
            continue
    return {
        "listen_host": os.environ.get("G8_LISTEN_HOST", "127.0.0.1"),
        "listen_port": _env_int("G8_LISTEN_PORT", 9105),
        "timeout": _env_float("G8_PROBE_TIMEOUT_SECONDS", 3),
        "confirm_attempts": max(1, _env_int("G8_PROBE_CONFIRM_ATTEMPTS", 2)),
        "confirm_delay_ms": max(0, _env_int("G8_PROBE_CONFIRM_DELAY_MS", 400)),
        "chain_tip_max_age": _env_float("G8_CHAIN_TIP_MAX_AGE_SECONDS", 900),
        "node_rpc_host": "127.0.0.1",
        "node_rpc_ports": ports,
        "http_services": [
            ("pool_http", os.environ.get("G8_POOL_HEALTH_URL", "http://127.0.0.1:8080/health")),
            ("multichain", os.environ.get("G8_MULTICHAIN_HEALTH_URL", "http://127.0.0.1:8453/health")),
            ("dao", os.environ.get("G8_DAO_HEALTH_URL", "http://127.0.0.1:8456/api/dao/health")),
            ("zis", os.environ.get("G8_ZIS_HEALTH_URL", "http://127.0.0.1:8096/health")),
        ],
        "stratum_host": os.environ.get("G8_STRATUM_HOST", "127.0.0.1"),
        "stratum_port": _env_int("G8_STRATUM_PORT", 8444),
    }


def rpc_call(host: str, port: int, method: str, params, timeout: float) -> dict:
    """One line-delimited raw TCP JSON-RPC call. Raises on any failure."""
    payload = json.dumps(
        {"jsonrpc": "2.0", "id": 1, "method": method, "params": params}
    ).encode() + b"\n"
    with socket.create_connection((host, port), timeout=timeout) as sock:
        sock.settimeout(timeout)
        sock.sendall(payload)
        data = b""
        while not data.endswith(b"\n"):
            chunk = sock.recv(65536)
            if not chunk:
                break
            data += chunk
    resp = json.loads(data.decode("utf-8", "replace"))
    if not isinstance(resp, dict) or resp.get("error"):
        raise ValueError(f"JSON-RPC error: {resp.get('error')}")
    result = resp.get("result")
    if not isinstance(result, dict):
        raise ValueError("JSON-RPC result missing")
    return result


def probe_node(host: str, port: int, timeout: float, want_tip: bool) -> dict:
    """Probe one node RPC port. Returns a probe outcome dict."""
    t0 = time.perf_counter()
    outcome = {"success": False, "duration": 0.0, "chain_height": None, "tip_timestamp": None}
    try:
        status = rpc_call(host, port, "getStatus", [], timeout)
        height = status.get("native_chain_height")
        outcome["success"] = True
        if isinstance(height, (int, float)):
            outcome["chain_height"] = int(height)
        if want_tip and outcome["chain_height"] is not None:
            block = rpc_call(
                host, port, "getBlockByHeight",
                {"height": outcome["chain_height"]}, timeout,
            )
            ts = block.get("timestamp")
            if isinstance(ts, (int, float)):
                outcome["tip_timestamp"] = int(ts)
    except Exception:
        outcome["success"] = False
    outcome["duration"] = time.perf_counter() - t0
    return outcome


def probe_http(url: str, timeout: float) -> dict:
    """Probe an HTTP endpoint; success means a 2xx response."""
    t0 = time.perf_counter()
    outcome = {"success": False, "duration": 0.0}
    try:
        req = urllib.request.Request(url, headers={"Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            outcome["success"] = 200 <= resp.status < 300
            resp.read(1024)
    except Exception:
        outcome["success"] = False
    outcome["duration"] = time.perf_counter() - t0
    return outcome


def probe_tcp(host: str, port: int, timeout: float) -> dict:
    """Probe a plain TCP listener (e.g. the pool stratum port)."""
    t0 = time.perf_counter()
    outcome = {"success": False, "duration": 0.0}
    try:
        with socket.create_connection((host, port), timeout=timeout):
            outcome["success"] = True
    except Exception:
        outcome["success"] = False
    outcome["duration"] = time.perf_counter() - t0
    return outcome


def _probe_targets(config: dict) -> list:
    """Build [(label, zero-arg callable)] for one probe round."""
    timeout = config["timeout"]
    targets = []
    for idx, port in enumerate(config["node_rpc_ports"]):
        label = NODE_LABELS[idx] if idx < len(NODE_LABELS) else f"node_{idx + 1}"
        targets.append(
            (label, lambda p=port: probe_node(config["node_rpc_host"], p, timeout, True))
        )
    for label, url in config["http_services"]:
        targets.append((label, lambda u=url: probe_http(u, timeout)))
    targets.append(
        ("pool_stratum", lambda: probe_tcp(config["stratum_host"], config["stratum_port"], timeout))
    )
    return targets


def _run_round(config: dict, targets: list) -> dict:
    """Run the given probes concurrently, one result per label."""
    results: dict = {}
    if not targets:
        return results
    with ThreadPoolExecutor(max_workers=8) as ex:
        futures = {ex.submit(fn): label for label, fn in targets}
        for fut, label in futures.items():
            try:
                results[label] = fut.result()
            except Exception:
                results[label] = {"success": False, "duration": 0.0}
    return results


def run_probes(config: dict) -> dict:
    """Run all probes, confirming failures, and return the combined result."""
    targets = _probe_targets(config)
    by_label = dict(targets)
    services = _run_round(config, targets)
    attempts = {label: 1 for label in services}
    retried = {label: False for label in services}

    confirm = max(1, int(config.get("confirm_attempts", 1) or 1))
    delay = max(0, int(config.get("confirm_delay_ms", 0) or 0)) / 1000.0
    for attempt in range(2, confirm + 1):
        failed = [label for label, res in services.items() if not res.get("success")]
        if not failed:
            break
        if delay:
            time.sleep(delay)
        retry_results = _run_round(config, [(label, by_label[label]) for label in failed])
        for label, res in retry_results.items():
            attempts[label] = attempt
            retried[label] = True
            services[label] = res

    for label, res in services.items():
        res["attempts"] = attempts.get(label, 1)
        res["retried"] = retried.get(label, False)

    primary = services.get("node_primary", {})
    quorum = sum(
        1 for name, res in services.items()
        if name.startswith("node_") and res.get("success")
    )
    # Tip source = the node reporting the freshest tip timestamp. Port order
    # is only a tiebreak: a slow/stale primary (e.g. its RPC answers but
    # reports an old tip while a follower is current) must not mask a live
    # chain — `chain_live` means "any node observed a fresh tip".
    tip_res = {}
    best_tip_ts = -1
    for idx in range(len(config["node_rpc_ports"])):
        label = NODE_LABELS[idx] if idx < len(NODE_LABELS) else f"node_{idx + 1}"
        res = services.get(label, {})
        ts = res.get("tip_timestamp")
        if ts is not None and ts > best_tip_ts:
            best_tip_ts = ts
            tip_res = res
    return {
        "services": services,
        "chain_height": tip_res.get("chain_height") or primary.get("chain_height"),
        "tip_timestamp": tip_res.get("tip_timestamp"),
        "node_quorum": quorum,
        "primary_ok": bool(primary.get("success")),
    }


def _escape_label(value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")


def _fmt_value(v) -> str:
    if isinstance(v, float) and v != v:
        return "NaN"
    return repr(float(v)) if isinstance(v, float) else str(v)


def _metric(lines: list, name: str, help_text: str, entries) -> None:
    lines.append(f"# HELP {name} {help_text}")
    lines.append(f"# TYPE {name} gauge")
    for suffix, value in entries:
        lines.append(f"{name}{suffix} {_fmt_value(value)}")


def render_metrics(report: dict, config: dict, now: float = None) -> str:
    """Render a probe report as Prometheus text exposition."""
    now = time.time() if now is None else now
    services = report["services"]

    tip_ts = report.get("tip_timestamp")
    chain_height = report.get("chain_height")
    if tip_ts is not None:
        tip_age = now - tip_ts
    else:
        tip_age = -1.0
    chain_live = 1 if (
        tip_ts is not None
        and 0 <= tip_age <= config["chain_tip_max_age"]
    ) else 0

    lines: list = []

    success_entries = []
    duration_entries = []
    for label in sorted(services):
        res = services[label]
        suffix = f'{{service="{_escape_label(label)}"}}'
        success_entries.append((suffix, 1 if res.get("success") else 0))
        duration_entries.append((suffix, float(res.get("duration", 0.0))))
    _metric(lines, "zion_g8_probe_success", "G8 probe result (1=success, 0=failure)", success_entries)
    _metric(lines, "zion_g8_probe_duration_seconds", "G8 probe duration in seconds", duration_entries)
    # 1 = this service needed the confirmation retry this round. The retry keeps
    # single missed packets out of the uptime gate, but the flakiness itself is
    # still worth alerting on, so it stays visible here.
    retried_entries = []
    for label in sorted(services):
        suffix = f'{{service="{_escape_label(label)}"}}'
        retried_entries.append((suffix, 1 if services[label].get("retried") else 0))
    _metric(lines, "zion_g8_probe_retried", "1 if the probe needed a confirmation retry this round", retried_entries)

    _metric(lines, "zion_g8_chain_height", "Native chain height reported by the tip source node",
            [("", chain_height if chain_height is not None else 0)])
    _metric(lines, "zion_g8_chain_tip_timestamp_seconds", "Unix timestamp of the freshest chain tip block reported by any node (0 = unknown)",
            [("", tip_ts if tip_ts else 0)])
    _metric(lines, "zion_g8_chain_tip_age_seconds", "Seconds since the freshest chain tip block timestamp reported by any node (-1 = unknown)",
            [("", tip_age)])
    _metric(lines, "zion_g8_chain_live", "1 if any node probe reported a fresh chain tip",
            [("", chain_live)])
    fresh_entries = []
    for label in sorted(services):
        if not label.startswith("node_"):
            continue
        res = services[label]
        ts = res.get("tip_timestamp")
        fresh = 1 if (
            ts is not None and 0 <= now - ts <= config["chain_tip_max_age"]
        ) else 0
        fresh_entries.append((f'{{service="{_escape_label(label)}"}}', fresh))
    _metric(lines, "zion_g8_node_tip_fresh", "1 if this node's reported chain tip is fresh", fresh_entries)
    _metric(lines, "zion_g8_node_quorum", "Number of node RPC ports answering",
            [("", report.get("node_quorum", 0))])
    _metric(lines, "zion_g8_probe_timestamp_seconds", "Unix timestamp of this probe round",
            [("", now)])
    return "\n".join(lines) + "\n"


class ExporterHandler(BaseHTTPRequestHandler):
    config: dict = None

    def _send(self, status: int, body: bytes, content_type: str) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:  # noqa: N802 — stdlib handler API
        if self.path == "/health":
            self._send(
                200,
                json.dumps({"status": "ok", "service": "zion-g8-probe"}).encode(),
                "application/json",
            )
        elif self.path == "/metrics":
            try:
                report = run_probes(self.config)
                body = render_metrics(report, self.config).encode()
            except Exception:
                self._send(500, b"internal probe error\n", "text/plain")
                return
            self._send(200, body, "text/plain; version=0.0.4")
        else:
            self._send(404, b"not found\n", "text/plain")

    def log_message(self, fmt, *args) -> None:
        return


def main() -> None:
    config = load_config()
    ExporterHandler.config = config
    server = ThreadingHTTPServer((config["listen_host"], config["listen_port"]), ExporterHandler)
    print(f"zion-g8-probe exporter listening on {config['listen_host']}:{config['listen_port']}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
