from __future__ import annotations

from typing import Any

import httpx

from bioversee_pi.config import AppSettings, clear_session, load_session, save_session


class AuthError(Exception):
    pass


def _auth_url(settings: AppSettings, path: str) -> str:
    base = settings.supabase_url.rstrip("/")
    return f"{base}/auth/v1{path}"


async def sign_in(settings: AppSettings, email: str, password: str) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=30.0) as client:
        res = await client.post(
            _auth_url(settings, "/token?grant_type=password"),
            headers={
                "apikey": settings.supabase_anon_key,
                "Content-Type": "application/json",
            },
            json={"email": email, "password": password},
        )
    if res.status_code >= 400:
        detail = res.json() if res.headers.get("content-type", "").startswith("application/json") else {}
        raise AuthError(detail.get("error_description") or detail.get("msg") or res.text)
    data = res.json()
    save_session(
        {
            "access_token": data.get("access_token"),
            "refresh_token": data.get("refresh_token"),
            "expires_at": data.get("expires_at"),
            "user": data.get("user") or {},
            "email": email,
        }
    )
    return data


async def sign_up(settings: AppSettings, email: str, password: str) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=30.0) as client:
        res = await client.post(
            _auth_url(settings, "/signup"),
            headers={
                "apikey": settings.supabase_anon_key,
                "Content-Type": "application/json",
            },
            json={"email": email, "password": password},
        )
    if res.status_code >= 400:
        detail = res.json() if res.headers.get("content-type", "").startswith("application/json") else {}
        raise AuthError(detail.get("msg") or detail.get("error_description") or res.text)
    data = res.json()
    # Some projects require email confirmation — session may be empty.
    if data.get("access_token"):
        save_session(
            {
                "access_token": data.get("access_token"),
                "refresh_token": data.get("refresh_token"),
                "expires_at": data.get("expires_at"),
                "user": data.get("user") or {},
                "email": email,
            }
        )
    return data


async def refresh_session(settings: AppSettings) -> dict[str, Any] | None:
    session = load_session()
    refresh = session.get("refresh_token")
    if not refresh:
        return None
    async with httpx.AsyncClient(timeout=30.0) as client:
        res = await client.post(
            _auth_url(settings, "/token?grant_type=refresh_token"),
            headers={
                "apikey": settings.supabase_anon_key,
                "Content-Type": "application/json",
            },
            json={"refresh_token": refresh},
        )
    if res.status_code >= 400:
        clear_session()
        return None
    data = res.json()
    save_session(
        {
            "access_token": data.get("access_token"),
            "refresh_token": data.get("refresh_token") or refresh,
            "expires_at": data.get("expires_at"),
            "user": data.get("user") or session.get("user") or {},
            "email": session.get("email"),
        }
    )
    return data


async def get_access_token(settings: AppSettings) -> str | None:
    session = load_session()
    token = session.get("access_token")
    if token:
        return str(token)
    refreshed = await refresh_session(settings)
    if refreshed:
        return str(refreshed.get("access_token") or "")
    return None


def accept_browser_session(
    *,
    access_token: str,
    refresh_token: str = "",
    expires_at: str | int | float | None = None,
    email: str = "",
) -> None:
    """Persist tokens returned from the in-app OAuth webview callback."""
    if not access_token:
        raise AuthError("Missing access token")
    save_session(
        {
            "access_token": access_token,
            "refresh_token": refresh_token or "",
            "expires_at": expires_at,
            "user": {"email": email} if email else {},
            "email": email or None,
        }
    )


def logout() -> None:
    clear_session()


def current_user_email() -> str | None:
    session = load_session()
    email = session.get("email")
    if email:
        return str(email)
    user = session.get("user") or {}
    return user.get("email")
