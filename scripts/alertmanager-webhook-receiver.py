#!/usr/bin/env python3
"""
ZION Alertmanager Webhook Receiver
====================================
Lightweight HTTP server that receives Alertmanager webhook notifications
and logs them to a local file. Useful for testing alerts before connecting
a real channel (Discord, Slack, email, PagerDuty, etc.).

Usage (local / host machine):
    python scripts/alertmanager-webhook-receiver.py

Usage (Docker Compose sidecar):
    Add to docker-compose.yml as a service listening on :9999,
    or run manually on the host so host.docker.internal:9999 resolves.

The alertmanager.yml in V3/docker/alertmanager/ points to:
    http://host.docker.internal:9999/webhook

Endpoints:
    POST /webhook          — receive alert payload
    GET  /health           — health check
    GET  /alerts           — view recent alerts (JSON)
    GET  /alerts/log       — view raw log file

Log file:  logs/alertmanager-webhook.log (rotated at 10 MB)
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import sys
import time
from datetime import datetime
from pathlib import Path

# Inline deps (PEP 723) — uv run will install these automatically
# /// script
# dependencies = ["flask>=2.3"]
# ///

try:
    from flask import Flask, request, jsonify
except ImportError:
    sys.stderr.write("ERROR: Flask not installed. Run:  uv pip install flask\n")
    sys.exit(1)

APP = Flask(__name__)

LOG_DIR = Path(__file__).resolve().parent.parent / "logs"
LOG_DIR.mkdir(exist_ok=True)
LOG_PATH = LOG_DIR / "alertmanager-webhook.log"

# Keep last N alerts in memory for the /alerts endpoint
_RECENT_ALERTS: list[dict] = []
_MAX_RECENT = 200


def _setup_logging() -> logging.Logger:
    logger = logging.getLogger("zion-webhook")
    logger.setLevel(logging.INFO)

    fmt = logging.Formatter(
        "%(asctime)s | %(levelname)-7s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    # File handler with rotation-like behaviour (rename when too big)
    if LOG_PATH.exists() and LOG_PATH.stat().st_size > 10 * 1024 * 1024:
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        LOG_PATH.rename(LOG_PATH.with_suffix(f".log.{ts}"))

    fh = logging.FileHandler(LOG_PATH, encoding="utf-8")
    fh.setFormatter(fmt)
    logger.addHandler(fh)

    sh = logging.StreamHandler(sys.stdout)
    sh.setFormatter(fmt)
    logger.addHandler(sh)

    return logger


LOGGER = _setup_logging()


@APP.route("/webhook", methods=["POST"])
def webhook() -> tuple[str, int]:
    """Receive Alertmanager webhook payload."""
    try:
        payload = request.get_json(force=True, silent=False) or {}
    except Exception as exc:
        LOGGER.error("Malformed JSON: %s", exc)
        return jsonify({"status": "error", "detail": str(exc)}), 400

    alerts = payload.get("alerts", [])
    group_labels = payload.get("groupLabels", {})
    common_labels = payload.get("commonLabels", {})
    receiver_name = payload.get("receiver", "unknown")
    status = payload.get("status", "unknown")

    LOGGER.info("--- Webhook from receiver=%s status=%s alerts=%d ---",
                receiver_name, status, len(alerts))

    for alert in alerts:
        labels = alert.get("labels", {})
        annotations = alert.get("annotations", {})
        starts_at = alert.get("startsAt", "")
        ends_at = alert.get("endsAt", "")
        state = alert.get("status", "firing")

        summary = annotations.get("summary", "")
        description = annotations.get("description", "")
        severity = labels.get("severity", "unknown")
        alertname = labels.get("alertname", "unknown")
        instance = labels.get("instance", "")

        LOGGER.info(
            "ALERT | %s | %s | instance=%s | severity=%s | summary=%s | description=%s | starts=%s | ends=%s",
            state, alertname, instance, severity, summary, description, starts_at, ends_at,
        )

        _RECENT_ALERTS.append({
            "timestamp": datetime.now().isoformat(),
            "state": state,
            "alertname": alertname,
            "severity": severity,
            "instance": instance,
            "summary": summary,
            "description": description,
            "starts_at": starts_at,
            "ends_at": ends_at,
            "receiver": receiver_name,
            "raw": alert,
        })

    # Trim in-memory list
    while len(_RECENT_ALERTS) > _MAX_RECENT:
        _RECENT_ALERTS.pop(0)

    return jsonify({"status": "ok", "processed": len(alerts)}), 200


@APP.route("/health", methods=[["GET", "HEAD"]])
def health() -> tuple[str, int]:
    return jsonify({"status": "ok", "uptime": time.time() - _START_TIME}), 200


@APP.route("/alerts", methods=["GET"])
def list_alerts() -> tuple[str, int]:
    """Return recent alerts as JSON."""
    return jsonify({
        "count": len(_RECENT_ALERTS),
        "alerts": list(reversed(_RECENT_ALERTS)),
    }), 200


@APP.route("/alerts/log", methods=["GET"])
def raw_log() -> tuple[str, int]:
    """Return raw log file contents."""
    if not LOG_PATH.exists():
        return "No log file yet.", 200
    return LOG_PATH.read_text(encoding="utf-8"), 200, {"Content-Type": "text/plain; charset=utf-8"}


_START_TIME = time.time()


def main() -> int:
    parser = argparse.ArgumentParser(description="ZION Alertmanager Webhook Receiver")
    parser.add_argument("--host", default="0.0.0.0", help="Bind address (default: 0.0.0.0)")
    parser.add_argument("--port", type=int, default=9999, help="Bind port (default: 9999)")
    args = parser.parse_args()

    LOGGER.info("Starting ZION Alertmanager webhook receiver on %s:%s", args.host, args.port)
    LOGGER.info("Log file: %s", LOG_PATH)
    LOGGER.info("Endpoints: POST /webhook | GET /health | GET /alerts | GET /alerts/log")

    # Flask dev server is fine for a lightweight log drain.
    # For production, put this behind nginx or use gunicorn.
    APP.run(host=args.host, port=args.port, threaded=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
