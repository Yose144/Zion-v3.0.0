"""Gateway client. Streams SSE. Errors are redacted before they can echo a key."""
import json
import re
import urllib.error
import urllib.request

from config import VERSION

_KEY = re.compile(r"zis_[A-Za-z0-9_\-]+")


class ApiError(Exception):
    def __init__(self, status, body):
        self.status = status
        self.body = body
        super(ApiError, self).__init__(redact(body)[:400])


def redact(text):
    return _KEY.sub("zis_…", str(text))


def parse_sse_line(line):
    if isinstance(line, bytes):
        line = line.decode("utf-8", "replace")
    line = line.strip()
    if not line or line.startswith(":") or not line.startswith("data:"):
        return None
    payload = line[5:].strip()
    if payload == "[DONE]":
        return {"done": True}
    try:
        return json.loads(payload)
    except ValueError:
        return None


def apply_delta(acc, event):
    """Fold one SSE JSON object into acc. Returns printable text only."""
    if not event or event.get("done"):
        return ""
    choices = event.get("choices") or []
    if not choices:
        return ""
    choice = choices[0]
    delta = choice.get("delta") or {}
    if not delta and choice.get("message"):
        delta = choice["message"]
    text = delta.get("content") or ""
    if text:
        acc["content"] += text
    for tc in delta.get("tool_calls") or []:
        idx = tc.get("index", 0)
        slot = acc["tools"].setdefault(idx, {"id": "", "name": "", "arguments": ""})
        if tc.get("id"):
            slot["id"] = tc["id"]
        fn = tc.get("function") or {}
        if fn.get("name"):
            slot["name"] += fn["name"]
        if fn.get("arguments"):
            slot["arguments"] += fn["arguments"]
    return text


def new_acc():
    return {"content": "", "tools": {}}


def request_json(method, url, body=None, key=None, timeout=60):
    data = None if body is None else json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Accept", "application/json")
    req.add_header("User-Agent", "zion-hiran/" + VERSION)
    if data is not None:
        req.add_header("Content-Type", "application/json")
    if key:
        req.add_header("X-API-Key", key)
        req.add_header("Authorization", "Bearer " + key)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            raw = res.read().decode("utf-8")
            return res.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as err:
        raw = err.read().decode("utf-8", "replace")
        try:
            parsed = json.loads(raw) if raw else {}
        except ValueError:
            parsed = {"error": raw[:300]}
        raise ApiError(err.code, _err_text(parsed))


def _err_text(parsed):
    if isinstance(parsed, dict):
        err = parsed.get("error")
        if isinstance(err, dict):
            return err.get("message") or json.dumps(err)
        if err:
            return str(err)
    return str(parsed)


def stream_chat(url, key, body, on_text, timeout=180):
    """POST chat/completions with stream=true. Calls on_text for each content delta."""
    payload = dict(body)
    payload["stream"] = True
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("Accept", "text/event-stream")
    req.add_header("Content-Type", "application/json")
    req.add_header("User-Agent", "zion-hiran/" + VERSION)
    req.add_header("X-API-Key", key)
    req.add_header("Authorization", "Bearer " + key)
    acc = new_acc()
    try:
        res = urllib.request.urlopen(req, timeout=timeout)
    except urllib.error.HTTPError as err:
        raw = err.read().decode("utf-8", "replace")
        try:
            parsed = json.loads(raw) if raw else {}
        except ValueError:
            parsed = {"error": raw[:300]}
        raise ApiError(err.code, _err_text(parsed))
    ctype = res.headers.get("Content-Type", "")
    try:
        if "text/event-stream" not in ctype and "application/json" in ctype:
            parsed = json.loads(res.read().decode("utf-8"))
            if isinstance(parsed, dict) and parsed.get("error"):
                raise ApiError(200, _err_text(parsed))
            text = _content_of(parsed)
            if text and on_text:
                on_text(text)
            acc["content"] = text
            return acc
        while True:
            line = res.readline()
            if not line:
                break
            event = parse_sse_line(line)
            if event is None:
                continue
            if event.get("done"):
                break
            if event.get("error"):
                raise ApiError(200, _err_text(event))
            piece = apply_delta(acc, event)
            if piece and on_text:
                on_text(piece)
    finally:
        res.close()
    return acc


def _content_of(parsed):
    if not isinstance(parsed, dict):
        return ""
    choices = parsed.get("choices") or []
    if not choices:
        return ""
    msg = choices[0].get("message") or {}
    return msg.get("content") or ""
