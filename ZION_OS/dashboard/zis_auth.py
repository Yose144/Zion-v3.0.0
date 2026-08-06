"""ZIS (ZION Identity Service) authentication integration for the dashboard.

Provides SSO authentication via the zion_session cookie issued by
auth.zionterranova.com.  The cookie is a signed JWT scoped to
.zionterranova.com, so it is shared across all ZION sub-domains.

Functions
---------
check_zis_auth(cookies)
    Call ZIS /api/auth/me with the zion_session cookie and return the
    authenticated user dict, or None when not signed in.

get_current_user(request)
    Flask / stdlib helper that extracts the user from the request's
    cookies.  Works with both Flask request objects (``request.cookies``
    dict-like) and stdlib ``http.server.BaseHTTPRequestHandler`` instances
    (Cookie header parsed via ``http.cookies``).

ZIS_URL
    Base URL of the ZIS server.  Read from the ``ZIS_URL`` env var, defaulting
    to ``https://auth.zionterranova.com``.
"""

from __future__ import annotations

import os
from http.cookies import SimpleCookie
from typing import Any, Dict, Mapping, Optional, Union

import requests

# ── Config ───────────────────────────────────────────────────────────────

#: Base URL of the ZIS server (auth.zionterranova.com).
#: Override via the ZIS_URL env var for local development.
ZIS_URL: str = os.environ.get("ZIS_URL", "https://auth.zionterranova.com").rstrip("/")

#: Cookie name issued by ZIS (signed JWT, httpOnly, domain=.zionterranova.com).
ZIS_SESSION_COOKIE: str = "zion_session"

#: Request timeout for ZIS calls (seconds).
ZIS_TIMEOUT: float = float(os.environ.get("ZIS_TIMEOUT", "5"))


# ── Types ────────────────────────────────────────────────────────────────

#: A ZIS user as returned by GET /api/auth/me.
ZisUser = Dict[str, Any]


# ── Core ─────────────────────────────────────────────────────────────────

def check_zis_auth(cookies: Union[Mapping[str, str], str, None]) -> Optional[ZisUser]:
    """Verify the ZIS session cookie and return the authenticated user.

    Parameters
    ----------
    cookies
        Either:
        * a mapping (dict-like) of cookie name → value (e.g. Flask
          ``request.cookies``), or
        * a raw ``Cookie`` header string (e.g. from a stdlib handler), or
        * ``None`` / empty when no cookies are present.

    Returns
    -------
    dict or None
        The user object from ZIS ``/api/auth/me`` on success, or ``None``
        when the user is not authenticated (no cookie, expired session,
        or ZIS returns 401).

    Raises
    ------
    requests.RequestException
        On network errors contacting ZIS (caller should handle gracefully).
    """
    token = _extract_session_token(cookies)
    if not token:
        return None

    try:
        resp = requests.get(
            f"{ZIS_URL}/api/auth/me",
            cookies={ZIS_SESSION_COOKIE: token},
            timeout=ZIS_TIMEOUT,
            headers={"Accept": "application/json"},
        )
    except requests.RequestException:
        # Network failure — treat as unauthenticated rather than crashing
        return None

    if resp.status_code == 401:
        return None
    if resp.status_code != 200:
        return None

    try:
        data = resp.json()
    except ValueError:
        return None

    if data.get("error") == "NOT_FOUND":
        return None
    return data


def get_current_user(request: Any) -> Optional[ZisUser]:
    """Extract the authenticated ZIS user from a request object.

    Supports two request styles:

    * **Flask** — ``request`` has a ``.cookies`` attribute that is a
      dict-like mapping of cookie name → value::

          from flask import request
          user = get_current_user(request)

    * **stdlib http.server** — ``request`` is a
      :class:`http.server.BaseHTTPRequestHandler` whose ``.headers``
      contains a ``Cookie`` header::

          user = get_current_user(self)  # inside a do_GET handler

    Returns the user dict on success, or ``None`` when not authenticated.
    """
    cookies: Union[Mapping[str, str], str, None] = None

    # Flask-style: request.cookies is a dict-like mapping
    if hasattr(request, "cookies"):
        try:
            cookies = request.cookies  # type: ignore[assignment]
        except Exception:
            cookies = None

    # stdlib BaseHTTPRequestHandler: read the Cookie header
    if cookies is None and hasattr(request, "headers"):
        try:
            raw = request.headers.get("Cookie")  # type: ignore[union-attr]
            if raw:
                cookies = raw
        except Exception:
            cookies = None

    return check_zis_auth(cookies)


# ── Helpers ──────────────────────────────────────────────────────────────

def _extract_session_token(
    cookies: Union[Mapping[str, str], str, None],
) -> Optional[str]:
    """Pull the zion_session value from a cookies mapping or raw header."""
    if not cookies:
        return None

    # Dict-like mapping (Flask request.cookies, Werkzeug, etc.)
    if isinstance(cookies, Mapping):
        try:
            value = cookies.get(ZIS_SESSION_COOKIE)  # type: ignore[union-attr]
            return value if isinstance(value, str) and value else None
        except Exception:
            return None

    # Raw Cookie header string (stdlib handler)
    if isinstance(cookies, str):
        jar = SimpleCookie()
        try:
            jar.load(cookies)
        except Exception:
            return None
        morsel = jar.get(ZIS_SESSION_COOKIE)
        if morsel is None:
            return None
        value = morsel.value
        return value if value else None

    return None


def is_authenticated(request: Any) -> bool:
    """Convenience boolean check — True if the request has a valid ZIS session."""
    return get_current_user(request) is not None


def get_zis_login_url(return_path: str = "/") -> str:
    """Return the ZIS login URL with an optional return path.

    The frontend can redirect users here when ``get_current_user`` returns
    ``None``.  After successful authentication ZIS redirects back.
    """
    from urllib.parse import quote
    return f"{ZIS_URL}/login?return_to={quote(return_path, safe='')}"


__all__ = [
    "ZIS_URL",
    "ZIS_SESSION_COOKIE",
    "ZIS_TIMEOUT",
    "ZisUser",
    "check_zis_auth",
    "get_current_user",
    "is_authenticated",
    "get_zis_login_url",
]
