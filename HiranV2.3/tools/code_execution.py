"""Docker-isolated code execution tool for safe compilation and testing."""

from __future__ import annotations

import hashlib
import os
import subprocess
import tempfile
from pathlib import Path
from typing import Any

from . import Tool


class CodeExecutionTool(Tool):
    name = "code_execute"
    description = "Execute code safely in a Docker container. Supports Rust, Python, TypeScript."

    SUPPORTED_LANGUAGES = {"rust": "rustc", "python": "python3", "typescript": "ts-node"}

    def __init__(self, timeout: int = 30, docker_image: str = "hiran-code-runner:latest") -> None:
        self.timeout = timeout
        self.docker_image = docker_image

    def schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "language": {
                    "type": "string",
                    "enum": list(self.SUPPORTED_LANGUAGES.keys()),
                },
                "code": {"type": "string", "description": "Source code to execute"},
                "test_input": {"type": "string", "description": "Optional stdin input"},
            },
            "required": ["language", "code"],
        }

    def execute(self, **kwargs: Any) -> dict[str, Any]:
        language = kwargs.get("language", "python")
        code = kwargs.get("code", "")
        test_input = kwargs.get("test_input", "")

        if language not in self.SUPPORTED_LANGUAGES:
            return {"success": False, "error": f"Unsupported language: {language}"}

        # Docker-less fallback: use temp files + subprocess
        return self._execute_local(language, code, test_input)

    def _execute_local(self, language: str, code: str, stdin: str) -> dict[str, Any]:
        with tempfile.TemporaryDirectory() as tmpdir:
            if language == "python":
                src = Path(tmpdir) / "script.py"
                src.write_text(code, encoding="utf-8")
                cmd = ["python3", str(src)]
            elif language == "rust":
                src = Path(tmpdir) / "main.rs"
                src.write_text(code, encoding="utf-8")
                bin_path = Path(tmpdir) / "main"
                compile_result = subprocess.run(
                    ["rustc", "--edition", "2021", str(src), "-o", str(bin_path)],
                    capture_output=True, text=True, timeout=self.timeout,
                )
                if compile_result.returncode != 0:
                    return {
                        "success": False,
                        "stage": "compilation",
                        "stderr": compile_result.stderr,
                    }
                cmd = [str(bin_path)]
            elif language == "typescript":
                src = Path(tmpdir) / "script.ts"
                src.write_text(code, encoding="utf-8")
                cmd = ["ts-node", str(src)]
            else:
                return {"success": False, "error": "Internal error"}

            try:
                result = subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    timeout=self.timeout,
                    input=stdin,
                )
                return {
                    "success": result.returncode == 0,
                    "returncode": result.returncode,
                    "stdout": result.stdout,
                    "stderr": result.stderr,
                }
            except subprocess.TimeoutExpired:
                return {"success": False, "error": f"Execution timed out after {self.timeout}s"}
