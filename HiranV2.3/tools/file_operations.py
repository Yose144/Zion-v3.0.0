"""Virtual filesystem tool for read/write/edit operations within a sandbox."""

from __future__ import annotations

import hashlib
import os
from pathlib import Path
from typing import Any

from . import Tool


class FileOperationsTool(Tool):
    name = "file_ops"
    description = "Read, write, edit, and analyze files in a sandboxed directory."

    def __init__(self, sandbox_root: str | Path = "/tmp/hiran_sandbox") -> None:
        self.sandbox = Path(sandbox_root).resolve()
        self.sandbox.mkdir(parents=True, exist_ok=True)

    def _resolve(self, rel_path: str) -> Path:
        target = (self.sandbox / rel_path).resolve()
        if not str(target).startswith(str(self.sandbox)):
            raise ValueError("Path traversal attempt detected")
        return target

    def schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "action": {"type": "string", "enum": ["read", "write", "edit", "list", "analyze"]},
                "path": {"type": "string", "description": "Relative path in sandbox"},
                "content": {"type": "string", "description": "Content for write/edit"},
                "old_string": {"type": "string", "description": "String to replace (edit)"},
                "new_string": {"type": "string", "description": "Replacement string (edit)"},
            },
            "required": ["action", "path"],
        }

    def execute(self, **kwargs: Any) -> dict[str, Any]:
        action = kwargs.get("action")
        rel_path = kwargs.get("path", "")

        try:
            target = self._resolve(rel_path)
        except ValueError as e:
            return {"success": False, "error": str(e)}

        if action == "read":
            if not target.exists():
                return {"success": False, "error": "File not found"}
            return {"success": True, "content": target.read_text(encoding="utf-8")}

        elif action == "write":
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(kwargs.get("content", ""), encoding="utf-8")
            return {"success": True, "bytes_written": target.stat().st_size}

        elif action == "edit":
            if not target.exists():
                return {"success": False, "error": "File not found"}
            old = kwargs.get("old_string", "")
            new = kwargs.get("new_string", "")
            text = target.read_text(encoding="utf-8")
            if old not in text:
                return {"success": False, "error": "old_string not found in file"}
            text = text.replace(old, new, 1)
            target.write_text(text, encoding="utf-8")
            return {"success": True, "replaced": True}

        elif action == "list":
            if target.is_dir():
                items = [str(p.relative_to(self.sandbox)) for p in target.rglob("*")]
                return {"success": True, "items": items}
            return {"success": False, "error": "Not a directory"}

        elif action == "analyze":
            if not target.exists():
                return {"success": False, "error": "File not found"}
            text = target.read_text(encoding="utf-8")
            lines = text.splitlines()
            words = len(text.split())
            return {
                "success": True,
                "lines": len(lines),
                "words": words,
                "characters": len(text),
                "hash": hashlib.sha256(text.encode()).hexdigest()[:16],
            }

        return {"success": False, "error": f"Unknown action: {action}"}
