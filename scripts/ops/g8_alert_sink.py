#!/usr/bin/env python3
"""G8 Alertmanager webhook sink (Python stdlib only).

Receives Alertmanager v4 webhook POSTs on /alerts, persists a compact JSONL
event log and a small active-alert state file that the dashboard reads.

Environment:
  G8_ALERT_SINK_HOST       (default 127.0.0.1)
  G8_ALERT_SINK_PORT       (default 9094)
  G8_ALERT_EVENTS_FILE     (default /opt/zion/data/g8_alert_events.jsonl)
  G8_ALERT_STATE_FILE      (default /opt/zion/data/g8_alert_state.json)
  G8_ALERT_MAX_BODY_BYTES  (default 1048576)
"""

import fcntl
import hashlib
import json
import os
import tempfile
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 9094
DEFAULT_EVENTS_FILE = "/opt/zion/data/g8_alert_events.jsonl"
DEFAULT_STATE_FILE = "/opt/zion/data/g8_alert_state.json"
DEFAULT_MAX_BODY = 1048576

EVENTS_TAIL_SCAN = 256 * 1024
SEEN_MAX = 1000
LABEL_KEY_MAX = 256
LABEL_VAL_MAX = 1024
ANNOT_KEY_MAX = 256
ANNOT_VAL_MAX = 4096
TS_MAX = 128
FINGERPRINT_MAX = 128
GROUP_KEY_MAX = 1024
RECEIVER_MAX = 256
VALID_STATUS = ("firing", "resolved")


class WebhookError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status
        self.message = message


def utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()


def _cap(value, limit: int) -> str:
    return str(value)[:limit]


def _norm_map(raw, key_max: int, val_max: int) -> dict:
    if raw is None:
        return {}
    if not isinstance(raw, dict):
        raise WebhookError(400, "invalid request")
    return {_cap(k, key_max): _cap(v, val_max) for k, v in raw.items()}


def normalize_alert(alert, top_status) -> dict:
    if not isinstance(alert, dict):
        raise WebhookError(400, "invalid request")
    status = alert.get("status") or top_status
    if status not in VALID_STATUS:
        raise WebhookError(400, "invalid request")
    labels = _norm_map(alert.get("labels"), LABEL_KEY_MAX, LABEL_VAL_MAX)
    annotations = _norm_map(alert.get("annotations"), ANNOT_KEY_MAX, ANNOT_VAL_MAX)
    if not labels.get("alertname"):
        raise WebhookError(400, "invalid request")
    fp = alert.get("fingerprint")
    if isinstance(fp, str) and fp:
        fp = fp[:FINGERPRINT_MAX]
    else:
        fp = hashlib.sha256(
            json.dumps(labels, sort_keys=True, separators=(",", ":")).encode("utf-8")
        ).hexdigest()
    return {
        "fingerprint": fp,
        "status": status,
        "labels": labels,
        "annotations": annotations,
        "starts_at": _cap(alert.get("startsAt") or "", TS_MAX),
        "ends_at": _cap(alert.get("endsAt") or "", TS_MAX),
    }


def normalize_webhook(payload) -> dict:
    if not isinstance(payload, dict):
        raise WebhookError(400, "invalid request")
    top_status = payload.get("status")
    if top_status is not None and top_status not in VALID_STATUS:
        raise WebhookError(400, "invalid request")
    alerts = payload.get("alerts")
    if not isinstance(alerts, list):
        raise WebhookError(400, "invalid request")
    group_key = _cap(payload.get("groupKey", ""), GROUP_KEY_MAX)
    receiver = _cap(payload.get("receiver", ""), RECEIVER_MAX)
    normalized = [normalize_alert(a, top_status) for a in alerts]
    event_id = hashlib.sha256(
        json.dumps(
            {
                "status": _cap(top_status or "", TS_MAX),
                "group_key": group_key,
                "receiver": receiver,
                "alerts": normalized,
            },
            sort_keys=True,
            separators=(",", ":"),
        ).encode("utf-8")
    ).hexdigest()
    return {
        "event_id": event_id,
        "status": top_status or "",
        "group_key": group_key,
        "receiver": receiver,
        "alerts": normalized,
    }


def empty_state() -> dict:
    return {
        "schema_version": 1,
        "updated_at": utcnow(),
        "active_alerts": [],
        "seen_event_ids": [],
    }


def read_state(path: str) -> dict:
    try:
        with open(path, "r", encoding="utf-8") as f:
            state = json.load(f)
        if isinstance(state, dict) and isinstance(state.get("active_alerts"), list):
            return state
    except (OSError, ValueError):
        pass
    return empty_state()


def write_state_atomic(path: str, state: dict) -> None:
    directory = os.path.dirname(path) or "."
    os.makedirs(directory, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=".g8_alert_state.", suffix=".tmp", dir=directory)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(state, f)
            f.write("\n")
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, path)
    except BaseException:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise
    try:
        dfd = os.open(directory, os.O_RDONLY)
        try:
            os.fsync(dfd)
        finally:
            os.close(dfd)
    except OSError:
        pass


def append_event(events_file: str, event: dict) -> None:
    directory = os.path.dirname(events_file) or "."
    os.makedirs(directory, exist_ok=True)
    fd = os.open(events_file, os.O_CREAT | os.O_APPEND | os.O_WRONLY, 0o600)
    try:
        line = json.dumps(event, separators=(",", ":")) + "\n"
        os.write(fd, line.encode("utf-8"))
        os.fsync(fd)
    finally:
        os.close(fd)


def events_tail_contains(events_file: str, needle: str) -> bool:
    try:
        size = os.path.getsize(events_file)
        if size <= 0:
            return False
        with open(events_file, "rb") as f:
            f.seek(max(0, size - EVENTS_TAIL_SCAN))
            tail = f.read(EVENTS_TAIL_SCAN)
        return needle.encode("utf-8") in tail
    except OSError:
        return False


def apply_alerts(state: dict, alerts: list, received_at: str) -> None:
    active = {a.get("fingerprint"): a for a in state["active_alerts"]
              if isinstance(a, dict) and a.get("fingerprint")}
    for alert in alerts:
        if alert["status"] == "firing":
            entry = dict(alert)
            entry["received_at"] = received_at
            active[alert["fingerprint"]] = entry
        else:
            active.pop(alert["fingerprint"], None)
    state["active_alerts"] = [active[k] for k in sorted(active)]


def process_webhook(payload, events_file: str, state_file: str) -> dict:
    """Normalize, dedup, persist one Alertmanager webhook. Returns response dict."""
    norm = normalize_webhook(payload)
    received_at = utcnow()
    directory = os.path.dirname(state_file) or "."
    os.makedirs(directory, exist_ok=True)
    lock_path = state_file + ".lock"
    lock_fd = os.open(lock_path, os.O_CREAT | os.O_RDWR, 0o644)
    try:
        fcntl.flock(lock_fd, fcntl.LOCK_EX)
        state = read_state(state_file)
        seen = state.get("seen_event_ids")
        seen = list(seen) if isinstance(seen, list) else []
        if norm["event_id"] in seen:
            return {"ok": True, "deduplicated": True}
        appended = events_tail_contains(events_file, norm["event_id"])
        if not appended:
            append_event(events_file, {
                "event_id": norm["event_id"],
                "received_at": received_at,
                "status": norm["status"],
                "group_key": norm["group_key"],
                "receiver": norm["receiver"],
                "alerts": norm["alerts"],
            })
        apply_alerts(state, norm["alerts"], received_at)
        seen.append(norm["event_id"])
        state["seen_event_ids"] = seen[-SEEN_MAX:]
        state["updated_at"] = received_at
        write_state_atomic(state_file, state)
    finally:
        try:
            fcntl.flock(lock_fd, fcntl.LOCK_UN)
        finally:
            os.close(lock_fd)
    return {"ok": True}


class Handler(BaseHTTPRequestHandler):
    server_version = "zion-g8-alert-sink/1.0"
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):
        return

    def _send(self, status: int, body: dict):
        data = json.dumps(body).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path == "/health":
            self._send(200, {"status": "ok", "service": "zion-g8-alert-sink"})
        else:
            self._send(404, {"error": "not found"})

    def do_POST(self):
        try:
            self._handle_post()
        except WebhookError as e:
            self._send(e.status, {"error": e.message})
        except Exception:
            self._send(500, {"error": "internal error"})

    def _handle_post(self):
        if self.path != "/alerts":
            raise WebhookError(404, "not found")
        ctype = self.headers.get("Content-Type") or ""
        if "application/json" not in ctype.lower():
            raise WebhookError(400, "bad request")
        raw_len = self.headers.get("Content-Length")
        try:
            length = int(raw_len) if raw_len is not None else None
        except ValueError:
            length = None
        if length is None or length < 1:
            raise WebhookError(400, "bad request")
        if length > self.server.max_body:
            self.close_connection = True
            raise WebhookError(413, "too large")
        body = self.rfile.read(length)
        try:
            payload = json.loads(body.decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            raise WebhookError(400, "bad request")
        result = process_webhook(payload, self.server.events_file, self.server.state_file)
        self._send(200, result)


def load_config() -> dict:
    def _int(name: str, default: int) -> int:
        try:
            return int(os.environ.get(name, default))
        except (TypeError, ValueError):
            return default

    return {
        "host": os.environ.get("G8_ALERT_SINK_HOST", DEFAULT_HOST),
        "port": _int("G8_ALERT_SINK_PORT", DEFAULT_PORT),
        "events_file": os.environ.get("G8_ALERT_EVENTS_FILE", DEFAULT_EVENTS_FILE),
        "state_file": os.environ.get("G8_ALERT_STATE_FILE", DEFAULT_STATE_FILE),
        "max_body": _int("G8_ALERT_MAX_BODY_BYTES", DEFAULT_MAX_BODY),
    }


def make_server(cfg: dict) -> ThreadingHTTPServer:
    srv = ThreadingHTTPServer((cfg["host"], cfg["port"]), Handler)
    srv.daemon_threads = True
    srv.events_file = cfg["events_file"]
    srv.state_file = cfg["state_file"]
    srv.max_body = cfg["max_body"]
    return srv


def main() -> int:
    cfg = load_config()
    os.makedirs(os.path.dirname(cfg["events_file"]) or ".", exist_ok=True)
    os.makedirs(os.path.dirname(cfg["state_file"]) or ".", exist_ok=True)
    srv = make_server(cfg)
    print(f"zion-g8-alert-sink listening on {cfg['host']}:{cfg['port']}", flush=True)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
