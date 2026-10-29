"""Chat transcript at ~/.zion/hiran/session.json. The API key is not stored here."""
import json
import os
from pathlib import Path

from config import SESSION

KEEP = 40


class Session(object):
    def __init__(self, cwd):
        self.cwd = str(cwd)
        self.messages = []
        self.agent = False
        self.plan = None

    def to_dict(self):
        return {
            "version": 1,
            "cwd": self.cwd,
            "agent": self.agent,
            "plan": self.plan,
            "messages": self.messages[-KEEP:],
        }

    def save(self):
        SESSION.parent.mkdir(parents=True, exist_ok=True)
        payload = json.dumps(self.to_dict(), ensure_ascii=False, indent=2) + "\n"
        tmp = SESSION.with_suffix(".json.tmp")
        tmp.write_text(payload, encoding="utf-8")
        os.chmod(tmp, 0o600)
        os.replace(tmp, SESSION)
        os.chmod(SESSION, 0o600)

    def load_from_disk(self):
        if not SESSION.exists():
            return False
        try:
            raw = json.loads(SESSION.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return False
        if not isinstance(raw, dict):
            return False
        msgs = raw.get("messages") or []
        self.messages = [m for m in msgs if isinstance(m, dict) and m.get("role")]
        self.agent = bool(raw.get("agent"))
        plan = raw.get("plan")
        self.plan = plan if isinstance(plan, str) and plan else None
        return True

    def clear(self):
        self.messages = []
        self.save()

    def add(self, message):
        self.messages.append(message)
        self.messages = self.messages[-KEEP:]
        self.save()


def for_request(session, system, agent):
    """Messages for one gateway call. Chat mode drops tool traffic."""
    out = [{"role": "system", "content": system}]
    for msg in session.messages[-KEEP:]:
        role = msg.get("role")
        if not agent and role == "tool":
            continue
        if not agent and role == "assistant":
            out.append({"role": "assistant", "content": msg.get("content") or ""})
            continue
        item = {"role": role, "content": msg.get("content")}
        if msg.get("tool_calls"):
            item["tool_calls"] = msg["tool_calls"]
        if msg.get("tool_call_id"):
            item["tool_call_id"] = msg["tool_call_id"]
        if msg.get("name"):
            item["name"] = msg["name"]
        out.append(item)
    return out
