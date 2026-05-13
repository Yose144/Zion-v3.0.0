"""
Hiran v2.3 Tool Orchestration Framework
=========================================
Provides a unified interface for agent tools.

Tools:
- web_browsing: Playwright-based web search and extraction
- code_execution: Docker-isolated code execution
- file_operations: Virtual filesystem for read/write/edit
- api_integration: HTTP client for external APIs
- blueprint_generator: ZION Oasis-specific blueprint designer
"""

from __future__ import annotations

from typing import Any, Protocol, runtime_checkable


@runtime_checkable
class Tool(Protocol):
    name: str
    description: str

    def execute(self, **kwargs: Any) -> dict[str, Any]:
        ...

    def schema(self) -> dict[str, Any]:
        """Return JSON schema for tool parameters."""
        ...


class ToolRegistry:
    def __init__(self) -> None:
        self._tools: dict[str, Tool] = {}

    def register(self, tool: Tool) -> None:
        self._tools[tool.name] = tool

    def get(self, name: str) -> Tool | None:
        return self._tools.get(name)

    def list_tools(self) -> list[dict[str, Any]]:
        return [
            {"name": t.name, "description": t.description, "schema": t.schema()}
            for t in self._tools.values()
        ]

    def execute(self, name: str, **kwargs: Any) -> dict[str, Any]:
        tool = self.get(name)
        if tool is None:
            return {"success": False, "error": f"Tool '{name}' not found"}
        try:
            return tool.execute(**kwargs)
        except Exception as e:
            return {"success": False, "error": str(e)}
