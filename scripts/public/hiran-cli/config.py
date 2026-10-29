"""Shared paths and ~/.zion/agent.toml (same file as the operator CLI)."""
import os
from pathlib import Path

VERSION = "0.3.1"
DEFAULT_MARKET = "https://market.zionterranova.com"
DEFAULT_MODEL = "hiran-mini"
CFG = Path.home() / ".zion" / "agent.toml"
SESSION = Path.home() / ".zion" / "hiran" / "session.json"
MAX_TURNS = 8


def market_url():
    env = os.environ.get("ZION_HIRAN_MARKET", "").strip().rstrip("/")
    if env:
        return env
    base = os.environ.get("ZION_HIRAN_BASE_URL", "").strip().rstrip("/")
    if base.endswith("/v1"):
        return base[: -len("/v1")]
    return DEFAULT_MARKET


def gateway_url():
    env = os.environ.get("ZION_HIRAN_BASE_URL", "").strip().rstrip("/")
    if env:
        return env
    return market_url() + "/v1"


def _parse(text):
    data = {}
    lines = []
    for line in text.splitlines():
        lines.append(line)
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, val = stripped.split("=", 1)
        data[key.strip()] = val.strip().strip('"').strip("'")
    return data, lines


def load():
    file_data = {}
    if CFG.exists():
        file_data, _ = _parse(CFG.read_text(encoding="utf-8"))
    api = os.environ.get("ZION_HIRAN_API_KEY", "").strip() or file_data.get("api_key", "")
    model = (
        os.environ.get("ZION_HIRAN_MODEL", "").strip()
        or file_data.get("model")
        or DEFAULT_MODEL
    )
    return {
        "api_key": api,
        "model": model,
        "base_url": gateway_url(),
        "market": market_url(),
    }


def signed_in(cfg=None):
    key = (cfg or load())["api_key"]
    return key.startswith("zis_")


def update_file(**kwargs):
    """Replace named keys. None deletes the key. Never prints values."""
    CFG.parent.mkdir(parents=True, exist_ok=True)
    existing = CFG.read_text(encoding="utf-8") if CFG.exists() else ""
    _, lines = _parse(existing)
    seen = set()
    out = []
    for line in lines:
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            out.append(line)
            continue
        key = stripped.split("=", 1)[0].strip()
        if key not in kwargs:
            out.append(line)
            continue
        seen.add(key)
        val = kwargs[key]
        if val is None:
            continue
        out.append('%s = "%s"' % (key, _escape(val)))
    for key, val in kwargs.items():
        if key in seen or val is None:
            continue
        out.append('%s = "%s"' % (key, _escape(val)))
    text = "\n".join(out).rstrip() + "\n"
    tmp = CFG.with_suffix(".toml.tmp")
    tmp.write_text(text, encoding="utf-8")
    os.chmod(tmp, 0o600)
    os.replace(tmp, CFG)
    os.chmod(CFG, 0o600)


def _escape(val):
    return str(val).replace("\\", "\\\\").replace('"', '\\"')
