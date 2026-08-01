"""
ZION Marketplace admin dashboard static files.
Served from dashboard.zionterranova.com/marketplace
"""

import json
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent.resolve()


def _serve_static(handler, route: str):
    if route == "/marketplace":
        handler.send_response(302)
        handler.send_header("Location", "/marketplace/")
        handler.end_headers()
        return True
    if route == "/marketplace/" or route == "/marketplace/index.html":
        index = SCRIPT_DIR / "marketplace" / "index.html"
        if index.exists():
            handler._html(index.read_text(encoding="utf-8"))
        else:
            handler.send_error(404, "Marketplace dashboard not found")
        return True
    if route.startswith("/marketplace/"):
        rel = route[13:].lstrip("/")
        file = SCRIPT_DIR / "marketplace" / rel
        if file.exists() and file.is_file():
            ct = {
                ".css": "text/css; charset=utf-8",
                ".js": "application/javascript; charset=utf-8",
                ".html": "text/html; charset=utf-8",
                ".json": "application/json",
                ".png": "image/png",
                ".jpg": "image/jpeg",
                ".svg": "image/svg+xml",
            }.get(file.suffix, "application/octet-stream")
            body = file.read_bytes()
            handler.send_response(200)
            handler.send_header("Content-Type", ct)
            handler.send_header("Content-Length", str(len(body)))
            handler.end_headers()
            handler.wfile.write(body)
        else:
            handler.send_error(404)
        return True
    return False


def handle_get(handler, route: str, params: dict):
    return _serve_static(handler, route)


def handle_post(handler, route: str, payload: dict):
    return _serve_static(handler, route)
