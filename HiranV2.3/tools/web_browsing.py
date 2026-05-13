"""Web browsing tool using Playwright for search, navigation, and extraction."""

from __future__ import annotations

from typing import Any
from urllib.parse import urlparse

from . import Tool


class WebBrowsingTool(Tool):
    name = "web_browse"
    description = "Search the web, navigate to pages, and extract information."

    def __init__(self, headless: bool = True, timeout: int = 30000) -> None:
        self.headless = headless
        self.timeout = timeout
        self._playwright = None
        self._browser = None

    def _get_browser(self):
        if self._browser is None:
            try:
                from playwright.sync_api import sync_playwright
            except ImportError:
                raise ImportError("Playwright not installed. Run: pip install playwright")
            self._playwright = sync_playwright().start()
            self._browser = self._playwright.chromium.launch(headless=self.headless)
        return self._browser

    def schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "action": {
                    "type": "string",
                    "enum": ["search", "navigate", "extract", "verify"],
                    "description": "Action to perform",
                },
                "query": {"type": "string", "description": "Search query or URL"},
                "selector": {"type": "string", "description": "CSS selector for extraction"},
                "max_results": {"type": "integer", "default": 5},
            },
            "required": ["action", "query"],
        }

    def execute(self, **kwargs: Any) -> dict[str, Any]:
        action = kwargs.get("action")
        query = kwargs.get("query", "")

        if action == "search":
            return self._search(query, kwargs.get("max_results", 5))
        elif action == "navigate":
            return self._navigate(query)
        elif action == "extract":
            return self._extract(query, kwargs.get("selector", "body"))
        elif action == "verify":
            return self._verify(query, kwargs.get("claim", ""))
        return {"success": False, "error": f"Unknown action: {action}"}

    def _search(self, query: str, max_results: int) -> dict[str, Any]:
        # Use DuckDuckGo HTML search (no API key needed)
        import urllib.request
        import urllib.parse
        import re

        url = f"https://html.duckduckgo.com/html/?q={urllib.parse.quote(query)}"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                html = resp.read().decode("utf-8", errors="ignore")
        except Exception as e:
            return {"success": False, "error": str(e)}

        # Extract result titles and URLs
        results = []
        for m in re.finditer(r'<a rel="nofollow" class="result__a" href="([^"]+)">([^<]+)</a>', html):
            href, title = m.group(1), m.group(2)
            results.append({"title": title.strip(), "url": href})
            if len(results) >= max_results:
                break

        return {"success": True, "results": results}

    def _navigate(self, url: str) -> dict[str, Any]:
        browser = self._get_browser()
        page = browser.new_page()
        try:
            page.goto(url, wait_until="domcontentloaded", timeout=self.timeout)
            title = page.title()
            content = page.content()
            return {"success": True, "title": title, "content_length": len(content)}
        except Exception as e:
            return {"success": False, "error": str(e)}
        finally:
            page.close()

    def _extract(self, url: str, selector: str) -> dict[str, Any]:
        browser = self._get_browser()
        page = browser.new_page()
        try:
            page.goto(url, wait_until="domcontentloaded", timeout=self.timeout)
            elements = page.query_selector_all(selector)
            texts = [el.inner_text() for el in elements if el]
            return {"success": True, "extracted": texts[:10], "count": len(texts)}
        except Exception as e:
            return {"success": False, "error": str(e)}
        finally:
            page.close()

    def _verify(self, url: str, claim: str) -> dict[str, Any]:
        result = self._navigate(url)
        if not result["success"]:
            return result
        content = result.get("content", "")
        claim_lower = claim.lower()
        found = claim_lower in content.lower()
        return {"success": True, "verified": found, "claim": claim}

    def close(self) -> None:
        if self._browser:
            self._browser.close()
            self._browser = None
        if self._playwright:
            self._playwright.stop()
            self._playwright = None
