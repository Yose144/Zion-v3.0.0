"""Local tools: cwd jail, secret-path deny, shell allowlist, confirm on write/shell."""
import json
import os
import shlex
import subprocess
import sys
from pathlib import Path

SHELL_ALLOWLIST = (
    "cargo", "npm", "npx", "git", "rg", "ls", "cat", "head", "tail", "wc", "pwd", "echo",
    "find", "which", "file", "stat", "diff", "sed", "awk", "sort", "uniq", "grep", "tree",
    "rustc", "python3", "python", "node", "make", "true", "false", "test", "printf",
)

TOOL_DEFS = [
    {
        "type": "function",
        "function": {
            "name": "read_file",
            "description": "Read a UTF-8 text file inside the working directory.",
            "parameters": {
                "type": "object",
                "properties": {"path": {"type": "string"}},
                "required": ["path"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "str_replace",
            "description": "Replace one exact old_string with new_string. Requires confirm.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string"},
                    "old_string": {"type": "string"},
                    "new_string": {"type": "string"},
                },
                "required": ["path", "old_string", "new_string"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "run_shell",
            "description": "Run one allowlisted command. No pipes, redirects, or chaining.",
            "parameters": {
                "type": "object",
                "properties": {"command": {"type": "string"}},
                "required": ["command"],
            },
        },
    },
]


class PolicyError(Exception):
    pass


class Policy(object):
    def __init__(self, cwd):
        self.cwd = normalize_path(Path(cwd))

    def resolve(self, path):
        raw = Path(path)
        if raw.is_absolute():
            candidate = normalize_path(raw)
        else:
            candidate = normalize_path(self.cwd / raw)
        cwd_s = str(self.cwd)
        cand_s = str(candidate)
        if cand_s != cwd_s and not cand_s.startswith(cwd_s + os.sep):
            raise PolicyError("path escapes cwd")
        if is_denied(candidate):
            raise PolicyError("access denied")
        return candidate

    def check_shell(self, command):
        trimmed = (command or "").strip()
        if not trimmed:
            raise PolicyError("empty shell command")
        if any(tok in trimmed for tok in ("&&", "||", ";", "|", "`", "$(", ">", "<", "\n")):
            raise PolicyError("shell metacharacters are not allowed")
        try:
            argv = shlex.split(trimmed)
        except ValueError as err:
            raise PolicyError("could not parse command") from err
        if not argv:
            raise PolicyError("empty shell command")
        base = Path(argv[0]).name
        if base not in SHELL_ALLOWLIST:
            raise PolicyError("command `%s` is not allowed" % base)
        return argv


def normalize_path(path):
    out = []
    for part in Path(path).parts:
        if part == ".":
            continue
        if part == "..":
            if out and out[-1] not in ("/", ".."):
                out.pop()
            continue
        out.append(part)
    if not out:
        return Path(".")
    return Path(*out)


def is_denied(path):
    for part in Path(path).parts:
        lower = part.lower()
        if lower in ("/", ".", "..") or lower.endswith(":"):
            continue
        if lower.startswith(".env") or "mnemonic" in lower:
            return True
        if lower in (".zion", "agent.toml"):
            return True
        if (
            "privatekey" in lower
            or "privkey" in lower
            or lower.endswith(".key")
            or lower == "key"
            or lower.startswith("key.")
            or "_key" in lower
            or "-key" in lower
            or "apikey" in lower
            or "secret" in lower
        ):
            return True
        if "key" in lower and (
            "." in lower or "_" in lower or "-" in lower or lower == "keys" or lower.endswith("key")
        ):
            return True
    return False


def confirm(kind, summary):
    if kind == "none":
        return True
    if os.environ.get("ZION_AGENT_FORCE_YES") == "1":
        return True
    if not sys.stdin.isatty():
        raise PolicyError("refusing %s without a terminal" % kind)
    answer = input("  Allow %s? %s [y/N] " % (kind, summary)).strip().lower()
    return answer in ("y", "yes")


def kind_for(name):
    if name == "str_replace":
        return "write"
    if name == "run_shell":
        return "shell"
    return "none"


def execute(policy, call):
    name = call.get("name") or ""
    args = call.get("args") or {}
    kind = kind_for(name)
    summary = name + " " + _short(args)
    try:
        if not confirm(kind, summary):
            return "cancelled by user"
    except PolicyError as err:
        return "ERROR: " + str(err)
    try:
        if name == "read_file":
            return _read(policy, args.get("path"))
        if name == "str_replace":
            return _replace(policy, args.get("path"), args.get("old_string"), args.get("new_string"))
        if name == "run_shell":
            return _shell(policy, args.get("command"))
        return "ERROR: unknown tool"
    except PolicyError as err:
        return "ERROR: " + str(err)
    except OSError as err:
        return "ERROR: " + str(err)


def parse_fence_tools(content):
    calls = []
    for blob in _json_objects(content or ""):
        try:
            obj = json.loads(blob)
        except ValueError:
            continue
        if not isinstance(obj, dict) or "tool" not in obj:
            continue
        args = obj.get("args") if isinstance(obj.get("args"), dict) else {}
        calls.append({"id": "fence_%d" % (len(calls) + 1), "name": obj["tool"], "args": args})
    return calls


def calls_from_acc(acc):
    native = []
    for idx in sorted(acc.get("tools") or {}):
        slot = acc["tools"][idx]
        raw = slot.get("arguments") or ""
        try:
            args = json.loads(raw) if raw else {}
        except ValueError:
            args = {}
        if not isinstance(args, dict):
            args = {}
        if not slot.get("name"):
            continue
        native.append({
            "id": slot.get("id") or ("call_%s" % idx),
            "name": slot["name"],
            "args": args,
        })
    if native:
        return native, True
    return parse_fence_tools(acc.get("content") or ""), False


def openai_message(call, result):
    return {
        "role": "tool",
        "tool_call_id": call["id"],
        "name": call["name"],
        "content": result,
    }


def _read(policy, path):
    if not path:
        raise PolicyError("path required")
    full = policy.resolve(path)
    data = full.read_text(encoding="utf-8")
    if len(data) > 80000:
        return data[:80000] + "\n…[truncated]"
    return data


def _replace(policy, path, old, new):
    if not path or old is None or new is None:
        raise PolicyError("path, old_string and new_string are required")
    if old == "":
        raise PolicyError("old_string is empty")
    full = policy.resolve(path)
    data = full.read_text(encoding="utf-8")
    count = data.count(old)
    if count == 0:
        raise PolicyError("old_string not found")
    if count > 1:
        raise PolicyError("old_string matched %d times; must be unique" % count)
    full.write_text(data.replace(old, new, 1), encoding="utf-8")
    return "replaced in %s" % full.name


def _shell(policy, command):
    argv = policy.check_shell(command or "")
    try:
        proc = subprocess.run(
            argv,
            cwd=str(policy.cwd),
            capture_output=True,
            timeout=30,
            check=False,
        )
    except subprocess.TimeoutExpired:
        return "ERROR: timed out"
    out = (proc.stdout or b"").decode("utf-8", "replace")
    err = (proc.stderr or b"").decode("utf-8", "replace")
    text = (out + (("\n" + err) if err else "")).strip()
    if len(text) > 20000:
        text = text[:20000] + "\n…[truncated]"
    if proc.returncode != 0:
        return "exit %d\n%s" % (proc.returncode, text)
    return text or "(no output)"


def _short(args):
    try:
        text = json.dumps(args, ensure_ascii=False)
    except TypeError:
        text = str(args)
    if len(text) > 120:
        return text[:120] + "…"
    return text


def _json_objects(content):
    found = []
    rest = content
    while "```" in rest:
        start = rest.find("```")
        after = rest[start + 3 :]
        if after.startswith("json"):
            after = after[4:]
        elif after.startswith("JSON"):
            after = after[4:]
        if after.startswith("\n"):
            after = after[1:]
        end = after.find("```")
        if end < 0:
            break
        block = after[:end].strip()
        if block.startswith("{"):
            found.append(block)
        rest = after[end + 3 :]
    if found:
        return found
    for line in content.splitlines():
        stripped = line.strip()
        if stripped.startswith("{") and '"tool"' in stripped:
            found.append(stripped)
    if found:
        return found
    start = content.find("{")
    if start >= 0 and '"tool"' in content:
        obj = _balanced(content[start:])
        if obj:
            return [obj]
    return []


def _balanced(text):
    depth = 0
    in_str = False
    escape = False
    for i, ch in enumerate(text):
        if in_str:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == '"':
                in_str = False
            continue
        if ch == '"':
            in_str = True
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return text[: i + 1]
    return None
