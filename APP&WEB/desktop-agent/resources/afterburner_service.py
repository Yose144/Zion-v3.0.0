#!/usr/bin/env python3
"""ZION Desktop Agent - Afterburner Service

Small JSON-lines RPC wrapper around ai/zion_ai_afterburner.py so Electron can:
- start/stop afterburner
- enqueue tasks
- fetch stats

Protocol: read one JSON object per line from stdin, write one JSON object per line to stdout.
"""

from __future__ import annotations

import json
import os
import sys
import time
from typing import Any, Dict, Optional


def _write(obj: Dict[str, Any]) -> None:
    sys.stdout.write(json.dumps(obj, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def _readline() -> Optional[str]:
    line = sys.stdin.readline()
    if not line:
        return None
    return line.strip()


def main() -> int:
    # Ensure repo root is importable when running from desktop-agent cwd/resources.
    # We try a few common locations.
    here = os.path.abspath(os.path.dirname(__file__))
    candidates = [
        os.path.abspath(os.path.join(here, "..", "..")),  # repo root (dev)
        os.path.abspath(os.path.join(here, "..")),
        os.getcwd(),
    ]
    for p in candidates:
        if p and p not in sys.path:
            sys.path.insert(0, p)

    try:
        from ai.zion_ai_afterburner import ZionAIAfterburner  # type: ignore
    except Exception as e:
        _write({"ok": False, "error": f"Failed to import afterburner: {e}"})
        return 2

    afterburner = ZionAIAfterburner()
    started = False

    _write({"ok": True, "status": "ready"})

    while True:
        line = _readline()
        if line is None:
            break
        if not line:
            continue

        try:
            req = json.loads(line)
        except Exception:
            _write({"ok": False, "error": "Invalid JSON"})
            continue

        req_id = req.get("id")
        cmd = str(req.get("cmd") or "").strip().lower()
        if not cmd:
            _write({"ok": False, "error": "Missing cmd", "id": req_id})
            continue

        if cmd in {"quit", "exit"}:
            break

        if cmd == "start":
            if not started:
                started = bool(afterburner.start_afterburner())
            _write({"ok": True, "started": started, "id": req_id})
            continue

        if cmd == "stop":
            try:
                afterburner.stop_afterburner()
            except Exception:
                pass
            started = False
            _write({"ok": True, "stopped": True, "id": req_id})
            continue

        if cmd == "stats":
            try:
                st = afterburner.get_performance_stats()
                _write({"ok": True, "stats": st, "id": req_id})
            except Exception as e:
                _write({"ok": False, "error": str(e), "id": req_id})
            continue

        if cmd == "task":
            task_type = str(req.get("task_type") or "generic").strip()
            priority = int(req.get("priority") or 5)
            compute_req = float(req.get("compute_req") or 1.0)
            sacred = bool(req.get("sacred") or False)
            try:
                tid = afterburner.add_ai_task(task_type, priority=priority, compute_req=compute_req, sacred=sacred)
                _write({"ok": True, "task_id": tid, "id": req_id})
            except Exception as e:
                _write({"ok": False, "error": str(e), "id": req_id})
            continue

        if cmd == "configure":
            cfg = req.get("config")
            if not isinstance(cfg, dict):
                _write({"ok": False, "error": "config must be an object", "id": req_id})
                continue
            try:
                afterburner.configure_afterburner(cfg)
                _write({"ok": True, "configured": True, "id": req_id})
            except Exception as e:
                _write({"ok": False, "error": str(e), "id": req_id})
            continue

        if cmd in {"cool", "emergency_cooling"}:
            try:
                afterburner.emergency_cooling()
                _write({"ok": True, "cooled": True, "id": req_id})
            except Exception as e:
                _write({"ok": False, "error": str(e), "id": req_id})
            continue

        _write({"ok": False, "error": f"Unknown cmd: {cmd}", "id": req_id})

    try:
        afterburner.stop_afterburner()
    except Exception:
        pass

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
