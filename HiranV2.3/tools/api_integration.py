"""HTTP client tool for external API calls, webhooks, and data sync."""

from __future__ import annotations

import json
from typing import Any

from . import Tool


class ApiIntegrationTool(Tool):
    name = "api_call"
    description = "Make HTTP requests to external APIs. Supports GET, POST, PUT, DELETE."

    def schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "url": {"type": "string"},
                "method": {"type": "string", "enum": ["GET", "POST", "PUT", "DELETE"]},
                "headers": {"type": "object", "default": {}},
                "body": {"type": "string", "description": "Raw body or JSON string"},
                "timeout": {"type": "integer", "default": 30},
            },
            "required": ["url", "method"],
        }

    def execute(self, **kwargs: Any) -> dict[str, Any]:
        import urllib.request
        import urllib.parse

        url = kwargs.get("url", "")
        method = kwargs.get("method", "GET")
        headers = kwargs.get("headers", {})
        body = kwargs.get("body", "")
        timeout = kwargs.get("timeout", 30)

        if isinstance(body, dict):
            body = json.dumps(body)
            headers.setdefault("Content-Type", "application/json")

        req = urllib.request.Request(
            url,
            data=body.encode("utf-8") if body else None,
            headers=headers,
            method=method,
        )

        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                data = resp.read()
                content_type = resp.headers.get("Content-Type", "")
                if "application/json" in content_type:
                    try:
                        body_out = json.loads(data)
                    except json.JSONDecodeError:
                        body_out = data.decode("utf-8", errors="ignore")
                else:
                    body_out = data.decode("utf-8", errors="ignore")
                return {
                    "success": True,
                    "status": resp.status,
                    "body": body_out,
                    "headers": dict(resp.headers),
                }
        except urllib.error.HTTPError as e:
            return {"success": False, "status": e.code, "error": str(e), "body": e.read().decode("utf-8", errors="ignore")}
        except Exception as e:
            return {"success": False, "error": str(e)}
