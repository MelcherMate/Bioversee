from __future__ import annotations

from typing import Any

import httpx

from bioversee_pi.auth import get_access_token
from bioversee_pi.config import AppSettings, WiringEntry


class DevicesError(Exception):
    pass


async def _authed_headers(settings: AppSettings) -> dict[str, str]:
    token = await get_access_token(settings)
    if not token:
        raise DevicesError("Not signed in")
    return {
        "apikey": settings.supabase_anon_key,
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }


async def list_accessible_devices(settings: AppSettings) -> list[dict[str, Any]]:
    headers = await _authed_headers(settings)
    base = settings.supabase_url.rstrip("/")
    user_id = await _user_id(settings, headers)

    async with httpx.AsyncClient(timeout=30.0) as client:
        members = await client.get(
            f"{base}/rest/v1/device_members",
            headers={**headers, "Accept": "application/json"},
            params={"select": "device_id,role", "user_id": f"eq.{user_id}"},
        )
        if members.status_code >= 400:
            raise DevicesError(members.text)

        memberships = members.json()
        if not memberships:
            return []

        id_list = ",".join(str(m["device_id"]) for m in memberships)
        devices_res = await client.get(
            f"{base}/rest/v1/devices",
            headers={**headers, "Accept": "application/json"},
            params={
                "select": "id,owner_id,type,name,config,created_at,updated_at",
                "id": f"in.({id_list})",
                "order": "created_at.asc",
            },
        )
        if devices_res.status_code >= 400:
            raise DevicesError(devices_res.text)

    role_by_id = {m["device_id"]: m["role"] for m in memberships}
    out: list[dict[str, Any]] = []
    for row in devices_res.json():
        role = role_by_id.get(row["id"], "viewer")
        if role not in ("owner", "admin", "operator"):
            continue
        out.append({**row, "role": role})
    return out


async def _user_id(settings: AppSettings, headers: dict[str, str]) -> str:
    base = settings.supabase_url.rstrip("/")
    async with httpx.AsyncClient(timeout=30.0) as client:
        res = await client.get(
            f"{base}/auth/v1/user",
            headers={
                "apikey": settings.supabase_anon_key,
                "Authorization": headers["Authorization"],
            },
        )
    if res.status_code >= 400:
        raise DevicesError("Could not resolve user")
    return str(res.json()["id"])


async def create_device(
    settings: AppSettings,
    *,
    name: str,
    device_type: str = "bioreactor",
) -> dict[str, Any]:
    """Create a named device owned by the signed-in user (RPC create_my_device)."""
    headers = await _authed_headers(settings)
    base = settings.supabase_url.rstrip("/")
    trimmed = (name or "").strip()
    if not trimmed:
        raise DevicesError("Device name is required")
    async with httpx.AsyncClient(timeout=30.0) as client:
        res = await client.post(
            f"{base}/rest/v1/rpc/create_my_device",
            headers=headers,
            json={
                "p_type": device_type,
                "p_name": trimmed,
                "p_member_emails": [],
                "p_member_role": "viewer",
            },
        )
    if res.status_code >= 400:
        raise DevicesError(res.text)
    device_id = res.json()
    if isinstance(device_id, dict):
        device_id = device_id.get("id") or device_id.get("create_my_device")
    if not device_id:
        raise DevicesError("create_my_device returned no device id")
    return {
        "id": str(device_id),
        "name": trimmed,
        "type": device_type,
        "role": "owner",
    }


async def mint_device_key(
    settings: AppSettings,
    device_id: str,
    label: str = "Raspberry Pi",
) -> dict[str, Any]:
    headers = await _authed_headers(settings)
    url = f"{settings.supabase_url.rstrip('/')}{settings.mint_path}"
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Prefer Edge Function; fall back to RPC if function is not deployed yet.
        res = await client.post(
            url,
            headers={
                **headers,
                "apikey": settings.supabase_anon_key,
            },
            json={"device_id": device_id, "label": label},
        )
        if res.status_code == 404:
            res = await client.post(
                f"{settings.supabase_url.rstrip('/')}/rest/v1/rpc/mint_device_credential",
                headers=headers,
                json={"p_device_id": device_id, "p_label": label},
            )
            if res.status_code >= 400:
                raise DevicesError(res.text)
            data = res.json()
            if isinstance(data, dict) and data.get("api_key"):
                return data
            raise DevicesError("Unexpected mint response")
        if res.status_code >= 400:
            raise DevicesError(res.text)
        data = res.json()
        if not data.get("ok", True) and not data.get("api_key"):
            raise DevicesError(str(data.get("error") or data))
        return data


async def update_device_pi_wiring(
    settings: AppSettings,
    device_id: str,
    wiring: list[WiringEntry],
) -> dict[str, Any]:
    headers = await _authed_headers(settings)
    base = settings.supabase_url.rstrip("/")
    patch = {
        "pi": {
            "wiring": [w.model_dump(exclude_none=True) for w in wiring if w.confirmed],
        }
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        res = await client.post(
            f"{base}/rest/v1/rpc/update_my_device_config",
            headers=headers,
            json={"p_device_id": device_id, "p_config": patch},
        )
    if res.status_code >= 400:
        raise DevicesError(res.text)
    return res.json() if res.content else {}


async def pi_ingest(
    settings: AppSettings,
    api_key: str,
    payload: dict[str, Any],
) -> dict[str, Any]:
    url = f"{settings.supabase_url.rstrip('/')}{settings.ingest_path}"
    async with httpx.AsyncClient(timeout=30.0) as client:
        res = await client.post(
            url,
            headers={
                "Content-Type": "application/json",
                "apikey": settings.supabase_anon_key,
                "X-Device-Key": api_key,
            },
            json=payload,
        )
    if res.status_code >= 400:
        raise DevicesError(res.text)
    return res.json()
