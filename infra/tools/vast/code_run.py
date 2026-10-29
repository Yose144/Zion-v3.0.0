#!/usr/bin/env python3
"""Fleet coding worker (F2) — tool jail + OpenAI tool loop for `code.run`.

Mirrors Hiran CLI MVP policy (cwd jail, secret deny, shell allowlist, no
pipes). Designed to run on the rig under agent.py; CP never gets a free shell.

Env:
  VAST_AGENT_CODE_CWD     default workspace (default /root/work)
  VAST_AGENT_LLM_URL      OpenAI base, e.g. http://127.0.0.1:8000/v1
                          (remote metering: https://market.zionterranova.com/v1)
  VAST_AGENT_LLM_MODEL    upstream model id (default first from /models or hiran-coder)
  VAST_AGENT_LLM_KEY      optional Bearer for gateway (ops service key)
  args.lease_token        short-lived hiran_lease_* from POST /v1/agent/lease (preferred)
  VAST_AGENT_CODE_FORCE   1 = allow writes/shell without confirm (fleet default)
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import urllib.error
import urllib.request
from pathlib import Path

SHELL_ALLOW = (
    "ls", "cat", "head", "tail", "wc", "rg", "grep", "find", "pwd",
    "cargo", "rustc", "npm", "node", "python3", "python", "pytest",
    "git", "make", "cmake", "go", "gcc", "clang", "mkdir", "touch",
    "stat", "file", "diff", "echo", "true", "false", "test",
)
SHELL_META = (";", "|", "&", "`", "$(", ">", "<", "\n", "\r", "&&", "||")
SECRET_RE = re.compile(
    r"(^|/)\.env($|\.)|(^|/)(.*\.)?(key|secret|mnemonic|credential|wallet\.dat)($|\.)",
    re.I,
)
MAX_PROMPT = 12_000
MAX_FILE_BYTES = 200_000
MAX_TOOL_OUT = 12_000
MAX_RESULT = 24_000
DEFAULT_TURNS = 4
HARD_MAX_TURNS = 8

TOOLS = [
    {"type": "function", "function": {
        "name": "read_file",
        "description": "Read a UTF-8 file inside the workspace cwd.",
        "parameters": {"type": "object", "properties": {
            "path": {"type": "string"}}, "required": ["path"]}}},
    {"type": "function", "function": {
        "name": "write_file",
        "description": "Write/overwrite a file inside cwd (requires force).",
        "parameters": {"type": "object", "properties": {
            "path": {"type": "string"},
            "content": {"type": "string"}}, "required": ["path", "content"]}}},
    {"type": "function", "function": {
        "name": "str_replace",
        "description": "Replace exact once in a file (requires force).",
        "parameters": {"type": "object", "properties": {
            "path": {"type": "string"},
            "old": {"type": "string"},
            "new": {"type": "string"}}, "required": ["path", "old", "new"]}}},
    {"type": "function", "function": {
        "name": "run_shell",
        "description": "Allowlisted shell in cwd — no pipes/redirects/chaining.",
        "parameters": {"type": "object", "properties": {
            "command": {"type": "string"}}, "required": ["command"]}}},
    {"type": "function", "function": {
        "name": "git_status",
        "description": "git status --short in cwd.",
        "parameters": {"type": "object", "properties": {}}}},
    {"type": "function", "function": {
        "name": "git_diff",
        "description": "git diff in cwd (optionally --staged).",
        "parameters": {"type": "object", "properties": {
            "staged": {"type": "boolean"}}}}},
]


def _norm(path: Path) -> Path:
    """Collapse . / .. without touching the filesystem."""
    parts: list[str] = []
    absolute = path.is_absolute()
    for c in path.parts:
        if c in ("/", ""):
            continue
        if c == ".":
            continue
        if c == "..":
            if parts:
                parts.pop()
            continue
        parts.append(c)
    if absolute:
        return Path("/") / Path(*parts) if parts else Path("/")
    return Path(*parts) if parts else Path(".")


def jail_path(cwd: Path, rel: str) -> Path:
    raw = (rel or "").strip()
    if not raw:
        raise ValueError("empty path")
    cwd_n = _norm(Path(cwd))
    cand = Path(raw)
    full = _norm(cand if cand.is_absolute() else cwd_n / cand)
    try:
        full.relative_to(cwd_n)
    except ValueError as e:
        raise ValueError(f"path escapes cwd jail: {rel}") from e
    if SECRET_RE.search(str(full)):
        raise ValueError(f"access denied to secret-like path: {full}")
    return full


def check_shell(command: str) -> None:
    cmd = (command or "").strip()
    if not cmd:
        raise ValueError("empty shell command")
    if any(m in cmd for m in SHELL_META):
        raise ValueError("shell metacharacters not allowed")
    base = Path(cmd.split()[0]).name
    if base not in SHELL_ALLOW:
        raise ValueError(f"shell command `{base}` not in allowlist")


def _truncate(s: str, n: int = MAX_TOOL_OUT) -> str:
    if len(s) <= n:
        return s
    return s[: n - 20] + "\n…[truncated]"


def run_tool(name: str, args: dict, cwd: Path, force: bool) -> str:
    if name == "read_file":
        p = jail_path(cwd, args.get("path", ""))
        data = p.read_bytes()
        if len(data) > MAX_FILE_BYTES:
            raise ValueError(f"file too large ({len(data)}B)")
        return _truncate(data.decode("utf-8", errors="replace"))
    if name == "write_file":
        if not force:
            raise ValueError("write_file requires force=true on fleet code.run")
        p = jail_path(cwd, args.get("path", ""))
        p.parent.mkdir(parents=True, exist_ok=True)
        content = args.get("content", "")
        if not isinstance(content, str):
            raise ValueError("content must be string")
        if len(content.encode()) > MAX_FILE_BYTES:
            raise ValueError("content too large")
        p.write_text(content)
        return f"wrote {p} ({len(content)} chars)"
    if name == "str_replace":
        if not force:
            raise ValueError("str_replace requires force=true on fleet code.run")
        p = jail_path(cwd, args.get("path", ""))
        text = p.read_text(encoding="utf-8")
        old, new = args.get("old", ""), args.get("new", "")
        if old not in text:
            raise ValueError("old string not found")
        if text.count(old) != 1:
            raise ValueError(f"old string matches {text.count(old)} times — need unique")
        p.write_text(text.replace(old, new, 1), encoding="utf-8")
        return f"replaced in {p}"
    if name == "run_shell":
        if not force:
            raise ValueError("run_shell requires force=true on fleet code.run")
        command = args.get("command", "")
        check_shell(command)
        r = subprocess.run(
            command, shell=True, cwd=str(cwd), capture_output=True,
            text=True, timeout=120)
        out = (r.stdout + r.stderr).strip()
        return _truncate(f"rc={r.returncode}\n{out}")
    if name == "git_status":
        check_shell("git status")
        r = subprocess.run(
            ["git", "status", "--short"], cwd=str(cwd),
            capture_output=True, text=True, timeout=60)
        return _truncate((r.stdout + r.stderr).strip() or "(clean)")
    if name == "git_diff":
        cmd = ["git", "diff", "--staged"] if args.get("staged") else ["git", "diff"]
        r = subprocess.run(cmd, cwd=str(cwd), capture_output=True, text=True, timeout=60)
        return _truncate((r.stdout + r.stderr).strip() or "(no diff)")
    raise ValueError(f"unknown tool {name}")


def _http_json(url: str, payload: dict | None = None, key: str = "") -> dict:
    data = None if payload is None else json.dumps(payload).encode()
    headers = {"Content-Type": "application/json"}
    if key:
        headers["Authorization"] = f"Bearer {key}"
    req = urllib.request.Request(url, data=data, headers=headers,
                                 method="GET" if data is None else "POST")
    with urllib.request.urlopen(req, timeout=120) as resp:
        return json.loads(resp.read().decode())


def probe_llm(base: str, key: str = "") -> tuple[bool, str]:
    base = base.rstrip("/")
    try:
        j = _http_json(f"{base}/models", key=key)
        models = j.get("data") or []
        ids = [m.get("id", "") for m in models if isinstance(m, dict)]
        return True, (ids[0] if ids else "")
    except Exception as e:
        return False, str(e)


SYSTEM = (
    "You are the ZION Vast coding agent on a GPU rig. "
    "Work only via tools inside the given workspace. "
    "Be concise. Prefer read_file before edits. "
    "Do not request secrets. No git push."
)


def run_code_job(args: dict) -> tuple[int, str]:
    """Execute one code.run job. Returns (rc, out_text)."""
    prompt = str(args.get("prompt") or "").strip()
    if not prompt:
        return 2, "code.run requires args.prompt"
    if len(prompt) > MAX_PROMPT:
        return 2, f"prompt too large (>{MAX_PROMPT} chars)"

    cwd = Path(str(args.get("cwd") or os.environ.get(
        "VAST_AGENT_CODE_CWD", "/root/work")))
    try:
        cwd.mkdir(parents=True, exist_ok=True)
    except Exception as e:
        return 1, f"cwd unavailable: {e}"

    force = bool(args.get("force", True))  # fleet is non-interactive
    if os.environ.get("VAST_AGENT_CODE_FORCE") == "0":
        force = bool(args.get("force", False))

    turns = int(args.get("max_turns") or DEFAULT_TURNS)
    turns = max(1, min(turns, HARD_MAX_TURNS))

    base = str(args.get("llm_base") or os.environ.get(
        "VAST_AGENT_LLM_URL", "http://127.0.0.1:8000/v1")).rstrip("/")
    # Prefer short-lived lease from CP; never accept long-lived llm_key from enqueue.
    key = str(
        args.get("lease_token")
        or os.environ.get("VAST_AGENT_LLM_KEY", "")
        or ""
    )
    model = str(args.get("model") or os.environ.get("VAST_AGENT_LLM_MODEL", ""))

    ok, info = probe_llm(base, key)
    if not ok:
        return 503, (
            f"code.run: LLM unreachable at {base}/models ({info}). "
            "Deploy vLLM on :8000 or set VAST_AGENT_LLM_URL."
        )
    if not model:
        model = info or "hiran-coder"

    messages = [
        {"role": "system", "content": SYSTEM + f" Workspace: {cwd}"},
        {"role": "user", "content": prompt},
    ]
    log: list[str] = [f"model={model} cwd={cwd} turns≤{turns} force={force}"]

    for turn in range(1, turns + 1):
        try:
            resp = _http_json(
                f"{base}/chat/completions",
                {
                    "model": model,
                    "messages": messages,
                    "tools": TOOLS,
                    "tool_choice": "auto",
                    "max_tokens": 2048,
                    "temperature": 0.2,
                },
                key=key,
            )
        except urllib.error.HTTPError as e:
            body = e.read().decode(errors="replace")[:500]
            return 1, _truncate("\n".join(log + [f"LLM HTTP {e.code}: {body}"]), MAX_RESULT)
        except Exception as e:
            return 1, _truncate("\n".join(log + [f"LLM error: {e}"]), MAX_RESULT)

        choice = (resp.get("choices") or [{}])[0]
        msg = choice.get("message") or {}
        messages.append(msg)
        tool_calls = msg.get("tool_calls") or []
        content = (msg.get("content") or "").strip()
        if content:
            log.append(f"[turn {turn} assistant] {content}")

        if not tool_calls:
            log.append(f"done after {turn} turn(s)")
            return 0, _truncate("\n".join(log), MAX_RESULT)

        for tc in tool_calls:
            fn = (tc.get("function") or {})
            name = fn.get("name") or ""
            raw_args = fn.get("arguments") or "{}"
            try:
                targs = json.loads(raw_args) if isinstance(raw_args, str) else dict(raw_args)
            except json.JSONDecodeError:
                targs = {}
            try:
                result = run_tool(name, targs, cwd, force)
                log.append(f"[turn {turn} {name}] ok")
            except Exception as e:
                result = f"ERROR: {e}"
                log.append(f"[turn {turn} {name}] {result}")
            messages.append({
                "role": "tool",
                "tool_call_id": tc.get("id") or name,
                "content": result,
            })

    log.append(f"stopped at max_turns={turns}")
    return 0, _truncate("\n".join(log), MAX_RESULT)


def validate_code_run_args(args: dict) -> dict:
    """Normalize/validate CP enqueue payload; raises ValueError."""
    if not isinstance(args, dict):
        raise ValueError("code.run args must be object")
    prompt = str(args.get("prompt") or "").strip()
    if not prompt:
        raise ValueError("code.run requires args.prompt")
    if len(prompt) > MAX_PROMPT:
        raise ValueError(f"prompt too large (>{MAX_PROMPT})")
    out = {
        "prompt": prompt,
        "cwd": str(args.get("cwd") or "/root/work"),
        "force": bool(args.get("force", True)),
        "max_turns": max(1, min(int(args.get("max_turns") or DEFAULT_TURNS), HARD_MAX_TURNS)),
    }
    if args.get("model"):
        out["model"] = str(args["model"])[:120]
    if args.get("llm_base"):
        out["llm_base"] = str(args["llm_base"])[:200]
    # Short-lived gateway lease OK; never accept long-lived llm_key from CP.
    lt = str(args.get("lease_token") or "").strip()
    if lt:
        if not lt.startswith("hiran_lease_") or len(lt) > 200:
            raise ValueError("invalid lease_token")
        out["lease_token"] = lt
    return out
