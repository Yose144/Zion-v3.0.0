"""Health probing and service status aggregation."""
import re
import socket
import time
import urllib.request as _urlreq
from pathlib import Path

from models.config import LOG_DIR, HEALTH_TTL
from services.processes import check_process_for_service

HEALTH_CACHE = {}  # id -> {"alive": bool, "ts": int, "details": str}


def tcp_probe(host: str, port: int, timeout: float = 0.15) -> bool:
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except Exception:
        return False


def http_probe(url: str, timeout: float = 0.5) -> tuple[bool, str]:
    try:
        with _urlreq.urlopen(url, timeout=timeout) as r:
            return (r.status < 500, f"HTTP {r.status}")
    except Exception as e:
        return (False, str(e)[:60])


def check_service_health(svc: dict) -> dict:
    sid = svc["id"]
    cached = HEALTH_CACHE.get(sid)
    now = int(time.time())
    if cached and now - cached["ts"] < HEALTH_TTL:
        return cached

    proc_info = check_process_for_service(sid)
    ports = svc.get("ports", {})
    open_ports = []
    closed_ports = []
    host = svc.get("host", "127.0.0.1")

    if ports:
        timeout = 1.5 if host != "127.0.0.1" else 0.15
        for name, port in ports.items():
            if tcp_probe(host, port, timeout):
                open_ports.append(f"{name}:{port}@{host}")
            else:
                closed_ports.append(f"{name}:{port}@{host}")

    log_alive = False
    log_age = None
    if svc.get("log"):
        path = LOG_DIR / svc["log"]
        if path.exists():
            mtime_age = now - int(path.stat().st_mtime)
            log_age = mtime_age
            log_alive = mtime_age < 60

    alive = False
    details_parts = []
    if proc_info["alive"]:
        alive = True
        details_parts.append(f"PID {proc_info['pid']} alive")
    elif proc_info["has_pid"]:
        details_parts.append(f"PID {proc_info['pid']} dead")
    if open_ports:
        alive = True
        details_parts.append(f"{len(open_ports)}/{len(ports)} ports open")
    elif ports:
        details_parts.append(f"{len(ports)} ports closed")
    if log_alive:
        if not alive:
            alive = True
        details_parts.append(f"log {log_age}s ago")
    elif log_age is not None:
        details_parts.append(f"log stale ({log_age}s)")
    elif not ports:
        details_parts.append("no log file")

    result = {
        "alive": alive,
        "ts": now,
        "details": "; ".join(details_parts) if details_parts else "unknown",
        "ports_open": open_ports,
        "ports_closed": closed_ports,
        "pid_alive": proc_info["alive"],
        "pid": proc_info.get("pid"),
        "log_age": log_age,
    }
    HEALTH_CACHE[sid] = result
    return result


def all_services_health(SERVICE_REGISTRY) -> list:
    out = []
    for svc in SERVICE_REGISTRY:
        h = check_service_health(svc)
        out.append({
            "id": svc["id"],
            "name": svc["name"],
            "icon": svc["icon"],
            "level": svc["level"],
            "kind": svc["kind"],
            "purpose": svc["purpose"],
            "child_says": svc["child_says"],
            "ports": svc["ports"],
            "depends_on": svc["depends_on"],
            "log": svc["log"],
            "start": svc["start"],
            "alive": h["alive"],
            "details": h["details"],
            "ports_open": h["ports_open"],
            "ports_closed": h["ports_closed"],
        })
    return out


def scrape_metrics(svc_id: str, get_service) -> dict:
    svc = get_service(svc_id)
    if not svc:
        return {"error": f"unknown service {svc_id}"}
    ports = svc.get("ports", {})
    metrics_port = ports.get("metrics") or ports.get("web") or ports.get("api")
    if not metrics_port:
        return {"error": "no metrics endpoint"}

    url = f"http://127.0.0.1:{metrics_port}/metrics"
    try:
        with _urlreq.urlopen(url, timeout=1.0) as r:
            body = r.read().decode("utf-8", errors="ignore")
    except Exception as e:
        return {"error": str(e)[:120], "url": url}

    metrics = {}
    for line in body.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        m = re.match(r'^([a-zA-Z_:][a-zA-Z0-9_:]*)(\{[^}]*\})?\s+([\d\.\-eE+inf]+)', line)
        if m:
            name = m.group(1)
            labels = m.group(2) or ""
            try:
                val = float(m.group(3))
                key = f"{name}{labels}" if labels else name
                metrics[key] = val
            except ValueError:
                pass
    return {"url": url, "count": len(metrics), "metrics": metrics}
