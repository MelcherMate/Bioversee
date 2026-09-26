"""Shared setup logic used by the desktop wizard (no HTTP UI)."""

from __future__ import annotations

import os
import secrets
import subprocess
import time
import webbrowser
from pathlib import Path
from typing import Any
from urllib.parse import urlencode

from bioversee_pi import auth
from bioversee_pi.config import (
    CONFIG_PATH,
    AppSettings,
    WiringEntry,
    load_local_config,
    save_local_config,
)
from bioversee_pi.devices import (
    DevicesError,
    list_accessible_devices,
    mint_device_key,
    pi_ingest,
    update_device_pi_wiring,
)
from bioversee_pi.gpio.catalog import CATALOG_BY_ID, catalog_as_dict
from bioversee_pi.gpio.header import header_as_dict, physical_pins_for_bcm
from bioversee_pi.gpio.probe import probe_service
from bioversee_pi.updater import apply_update, check_for_update
from bioversee_pi.version import __version__, display_version

_BROWSER_LOGIN_TTL_S = 600.0
_pending_browser_logins: dict[str, float] = {}


def load_settings() -> AppSettings:
    settings = AppSettings()
    if not settings.supabase_url:
        settings.supabase_url = os.environ.get("VITE_SUPABASE_URL", "")
    if not settings.supabase_anon_key:
        settings.supabase_anon_key = os.environ.get(
            "VITE_SUPABASE_PUBLISHABLE_KEY", ""
        )
    cfg = load_local_config()
    if cfg.supabase_url:
        settings.supabase_url = cfg.supabase_url
    if cfg.supabase_anon_key:
        settings.supabase_anon_key = cfg.supabase_anon_key
    return settings


def ensure_project(settings: AppSettings) -> None:
    if not settings.supabase_url or not settings.supabase_anon_key:
        cfg = load_local_config()
        if cfg.supabase_url and cfg.supabase_anon_key:
            settings.supabase_url = cfg.supabase_url
            settings.supabase_anon_key = cfg.supabase_anon_key
    if not settings.supabase_url or not settings.supabase_anon_key:
        raise RuntimeError(
            "Set Supabase URL and anon key first "
            "(or export BIOVERSEE_SUPABASE_URL / BIOVERSEE_SUPABASE_ANON_KEY)"
        )


def save_project(settings: AppSettings, url: str, anon_key: str) -> None:
    settings.supabase_url = url.strip().rstrip("/")
    settings.supabase_anon_key = anon_key.strip()
    if not settings.supabase_url or not settings.supabase_anon_key:
        raise RuntimeError("supabase_url and supabase_anon_key required")
    cfg = load_local_config()
    cfg.supabase_url = settings.supabase_url
    cfg.supabase_anon_key = settings.supabase_anon_key
    save_local_config(cfg)


def has_project(settings: AppSettings) -> bool:
    try:
        ensure_project(settings)
        return True
    except RuntimeError:
        return False


async def status(settings: AppSettings) -> dict[str, Any]:
    cfg = load_local_config()
    return {
        "version": __version__,
        "version_display": display_version(),
        "signed_in": bool(await auth.get_access_token(settings)),
        "email": auth.current_user_email(),
        "has_project": has_project(settings),
        "supabase_url": settings.supabase_url,
        "website_url": settings.website_url.rstrip("/"),
        "simulate_gpio": probe_service.simulate,
        "local": {
            "device_id": cfg.device_id,
            "device_name": cfg.device_name,
            "device_type": cfg.device_type,
            "has_api_key": bool(cfg.api_key),
            "wiring": [w.model_dump() for w in cfg.wiring],
            "agent_enabled": cfg.agent_enabled,
        },
    }


def _prune_pending_logins() -> None:
    now = time.time()
    for key in [k for k, exp in _pending_browser_logins.items() if exp <= now]:
        _pending_browser_logins.pop(key, None)


def start_browser_login(settings: AppSettings) -> dict[str, Any]:
    ensure_project(settings)
    _prune_pending_logins()
    state = secrets.token_urlsafe(24)
    _pending_browser_logins[state] = time.time() + _BROWSER_LOGIN_TTL_S
    redirect = f"http://127.0.0.1:{settings.wizard_port}/auth/callback"
    website = (settings.website_url or "https://www.bioversee.com").rstrip("/")
    login_url = f"{website}/pi-login?{urlencode({'redirect': redirect, 'state': state})}"
    opened = False
    try:
        opened = bool(webbrowser.open(login_url))
    except Exception:  # noqa: BLE001
        opened = False
    return {
        "ok": True,
        "login_url": login_url,
        "state": state,
        "opened": opened,
        "expires_in": int(_BROWSER_LOGIN_TTL_S),
    }


def complete_browser_login(
    *,
    access_token: str,
    refresh_token: str = "",
    expires_at: str | int | float | None = None,
    state: str,
    email: str = "",
) -> dict[str, Any]:
    _prune_pending_logins()
    expiry = _pending_browser_logins.get(state)
    if not expiry or time.time() > expiry:
        raise RuntimeError(
            "Login expired or invalid — tap Continue on bioversee.com again"
        )
    _pending_browser_logins.pop(state, None)
    auth.accept_browser_session(
        access_token=access_token.strip(),
        refresh_token=(refresh_token or "").strip(),
        expires_at=expires_at,
        email=(email or "").strip(),
    )
    return {"ok": True, "email": auth.current_user_email()}


async def sign_in(settings: AppSettings, email: str, password: str) -> None:
    ensure_project(settings)
    await auth.sign_in(settings, email.strip(), password)


async def sign_up(settings: AppSettings, email: str, password: str) -> dict[str, Any]:
    ensure_project(settings)
    data = await auth.sign_up(settings, email.strip(), password)
    return {
        "ok": True,
        "needs_confirmation": not bool(data.get("access_token")),
        "email": email.strip(),
    }


async def list_devices(settings: AppSettings) -> list[dict[str, Any]]:
    ensure_project(settings)
    return await list_accessible_devices(settings)


async def select_device(
    settings: AppSettings,
    *,
    device_id: str,
    device_name: str | None = None,
    device_type: str | None = None,
) -> dict[str, Any]:
    ensure_project(settings)
    minted = await mint_device_key(settings, device_id)
    api_key = minted.get("api_key")
    if not api_key:
        raise DevicesError("Mint did not return api_key — run device_credentials_pi.sql")

    cfg = load_local_config()
    cfg.device_id = device_id
    cfg.device_name = device_name
    cfg.device_type = device_type
    cfg.api_key = str(api_key)
    cfg.credential_id = str(minted.get("credential_id") or "")
    cfg.supabase_url = settings.supabase_url
    cfg.supabase_anon_key = settings.supabase_anon_key
    cfg.wiring = []
    save_local_config(cfg)
    return {
        "ok": True,
        "device_id": device_id,
        "credential_id": cfg.credential_id,
    }


def gpio_header() -> dict[str, Any]:
    return {"pins": header_as_dict(), "catalog": catalog_as_dict()}


async def gpio_state() -> dict[str, Any]:
    await probe_service.poll_once()
    cfg = load_local_config()
    snap = probe_service.snapshot()
    confirmed_physical = sorted({p for w in cfg.wiring for p in (w.physical or [])})
    return {
        **snap,
        "confirmed": [w.model_dump() for w in cfg.wiring],
        "confirmed_physical": confirmed_physical,
    }


def gpio_confirm(event_id: str, peripheral_id: str | None = None) -> dict[str, Any]:
    guess = probe_service.confirm(event_id, peripheral_id)
    if not guess:
        raise RuntimeError("Unknown event")
    entry = WiringEntry(
        bcm=guess.bcm,
        physical=guess.physical,
        role=guess.role,
        name=guess.name,
        driver=guess.driver,
        confirmed=True,
        i2c_address=guess.i2c_address,
        one_wire_id=guess.one_wire_id,
    )
    cfg = load_local_config()
    cfg.wiring = [w for w in cfg.wiring if not _same_wire(w, entry)]
    cfg.wiring.append(entry)
    save_local_config(cfg)
    return {"ok": True, "wiring": entry.model_dump()}


def gpio_ignore(event_id: str) -> None:
    probe_service.ignore(event_id)


def gpio_simulate(peripheral_id: str) -> dict[str, Any]:
    guess = probe_service.inject_simulation(peripheral_id)
    return {"ok": True, "guess": guess.to_dict()}


def gpio_manual(
    peripheral_id: str,
    *,
    bcm: int | None = None,
    physical: list[int] | None = None,
) -> dict[str, Any]:
    p = CATALOG_BY_ID.get(peripheral_id)
    if not p:
        raise RuntimeError("Unknown peripheral")
    resolved_bcm = bcm if bcm is not None else p.default_bcm
    resolved_physical = physical or (
        physical_pins_for_bcm(resolved_bcm) if resolved_bcm is not None else []
    )
    entry = WiringEntry(
        bcm=resolved_bcm,
        physical=resolved_physical,
        role=p.role,
        name=p.name,
        driver=p.driver,
        confirmed=True,
    )
    cfg = load_local_config()
    cfg.wiring.append(entry)
    save_local_config(cfg)
    return {"ok": True, "wiring": entry.model_dump()}


async def finish_setup(settings: AppSettings) -> dict[str, Any]:
    cfg = load_local_config()
    if not cfg.device_id or not cfg.api_key:
        raise RuntimeError("Select a device first")
    if not cfg.wiring:
        raise RuntimeError("Confirm at least one wired peripheral")

    cloud_error = None
    try:
        await update_device_pi_wiring(settings, cfg.device_id, cfg.wiring)
    except DevicesError as exc:
        cloud_error = str(exc)

    if cfg.api_key:
        try:
            await pi_ingest(
                settings,
                cfg.api_key,
                {
                    "action": "config",
                    "config": {
                        "pi": {
                            "wiring": [
                                w.model_dump(exclude_none=True) for w in cfg.wiring
                            ],
                        }
                    },
                },
            )
        except DevicesError:
            pass

    enable = _enable_agent_service()
    cfg.agent_enabled = bool(enable.get("enabled"))
    save_local_config(cfg)
    return {
        "ok": True,
        "agent": enable,
        "cloud_error": cloud_error,
        "config_path": str(CONFIG_PATH),
    }


def update_status(settings: AppSettings) -> dict[str, Any]:
    return check_for_update(
        repo=settings.update_repo,
        branch=settings.update_branch,
        subdir=settings.update_subdir,
    )


def update_apply(settings: AppSettings) -> dict[str, Any]:
    result = apply_update(
        prefix=Path(settings.install_prefix),
        repo=settings.update_repo,
        branch=settings.update_branch,
        subdir=settings.update_subdir,
        restart_services=True,
    )
    if not result.get("ok"):
        raise RuntimeError(str(result.get("error") or "Update failed"))
    return result


def _same_wire(a: WiringEntry, b: WiringEntry) -> bool:
    if a.name == b.name:
        return True
    if a.bcm is not None and a.bcm == b.bcm:
        return True
    return False


def _enable_agent_service() -> dict[str, Any]:
    system_unit = Path("/etc/systemd/system/bioversee-agent.service")
    if not system_unit.exists():
        return {
            "enabled": False,
            "message": "Service unit not installed — run packaging/install.sh",
            "hint": "sudo ./packaging/install.sh && sudo systemctl enable --now bioversee-agent",
        }

    errors: list[str] = []
    for cmd in (
        ["sudo", "systemctl", "daemon-reload"],
        ["sudo", "systemctl", "enable", "--now", "bioversee-agent.service"],
    ):
        try:
            subprocess.run(cmd, check=True, capture_output=True, text=True)
        except (subprocess.CalledProcessError, FileNotFoundError) as exc:
            errors.append(str(exc))
            return {
                "enabled": False,
                "message": "Could not enable systemd unit",
                "errors": errors,
                "hint": "sudo systemctl enable --now bioversee-agent",
            }

    return {"enabled": True, "message": "bioversee-agent enabled on boot"}
