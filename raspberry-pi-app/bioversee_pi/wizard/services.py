"""Shared setup logic used by the desktop wizard (no HTTP UI)."""

from __future__ import annotations

import os
import secrets
import subprocess
import time
from pathlib import Path
from typing import Any
from urllib.parse import urlencode

from bioversee_pi import auth
from bioversee_pi.config import (
    CONFIG_PATH,
    AppSettings,
    WiringEntry,
    bootstrap_env_from_system,
    load_local_config,
    save_local_config,
)
from bioversee_pi.devices import (
    DevicesError,
    create_device as create_device_api,
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
from bioversee_pi.wizard import oauth_webview

_OAUTH_LOGIN_TTL_S = 600.0
_pending_oauth_logins: dict[str, float] = {}


def load_settings() -> AppSettings:
    bootstrap_env_from_system()
    settings = AppSettings()
    if not settings.supabase_url:
        settings.supabase_url = os.environ.get("VITE_SUPABASE_URL", "")
    if not settings.supabase_anon_key:
        settings.supabase_anon_key = os.environ.get(
            "VITE_SUPABASE_PUBLISHABLE_KEY", ""
        ) or os.environ.get("BIOVERSEE_SUPABASE_ANON_KEY", "")
    cfg = load_local_config()
    if cfg.supabase_url:
        settings.supabase_url = cfg.supabase_url
    if cfg.supabase_anon_key:
        settings.supabase_anon_key = cfg.supabase_anon_key
    # Persist installer keys into user config so the next launch works without env.
    if settings.supabase_url and settings.supabase_anon_key:
        if not cfg.supabase_url or not cfg.supabase_anon_key:
            cfg.supabase_url = settings.supabase_url
            cfg.supabase_anon_key = settings.supabase_anon_key
            save_local_config(cfg)
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
        "language": cfg.language or "en",
        "local": {
            "device_id": cfg.device_id,
            "device_name": cfg.device_name,
            "device_type": cfg.device_type,
            "has_api_key": bool(cfg.api_key),
            "wiring": [w.model_dump() for w in cfg.wiring],
            "agent_enabled": cfg.agent_enabled,
            "language": cfg.language or "en",
        },
    }


def get_language() -> str:
    return load_local_config().language or "en"


def set_language(language: str) -> str:
    lang = (language or "en").strip().lower()
    if lang not in ("en", "de", "hu"):
        lang = "en"
    cfg = load_local_config()
    cfg.language = lang
    save_local_config(cfg)
    return lang


def logout() -> None:
    auth.logout()


def _prune_pending_logins() -> None:
    now = time.time()
    for key in [k for k, exp in _pending_oauth_logins.items() if exp <= now]:
        _pending_oauth_logins.pop(key, None)


def start_oauth_login(settings: AppSettings) -> dict[str, Any]:
    """Start Google / website OAuth inside an embedded webview (no system browser)."""
    ensure_project(settings)
    _prune_pending_logins()
    state = secrets.token_urlsafe(24)
    _pending_oauth_logins[state] = time.time() + _OAUTH_LOGIN_TTL_S
    redirect = f"http://127.0.0.1:{settings.wizard_port}/auth/callback"
    website = (settings.website_url or "https://www.bioversee.com").rstrip("/")
    login_url = f"{website}/pi-login?{urlencode({'redirect': redirect, 'state': state})}"
    oauth_webview.open_oauth_window(login_url)
    return {
        "ok": True,
        "login_url": login_url,
        "state": state,
        "expires_in": int(_OAUTH_LOGIN_TTL_S),
    }


# Back-compat alias used by older call sites
start_browser_login = start_oauth_login


def complete_browser_login(
    *,
    access_token: str,
    refresh_token: str = "",
    expires_at: str | int | float | None = None,
    state: str,
    email: str = "",
) -> dict[str, Any]:
    _prune_pending_logins()
    expiry = _pending_oauth_logins.get(state)
    if not expiry or time.time() > expiry:
        raise RuntimeError("Login expired or invalid — try Continue with Google again")
    _pending_oauth_logins.pop(state, None)
    auth.accept_browser_session(
        access_token=access_token.strip(),
        refresh_token=(refresh_token or "").strip(),
        expires_at=expires_at,
        email=(email or "").strip(),
    )
    oauth_webview.close_oauth_window()
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


async def create_device(
    settings: AppSettings,
    *,
    name: str,
    device_type: str = "bioreactor",
) -> dict[str, Any]:
    ensure_project(settings)
    created = await create_device_api(
        settings, name=name, device_type=device_type
    )
    # Bind immediately so the user lands on GPIO wiring.
    return await select_device(
        settings,
        device_id=str(created["id"]),
        device_name=created.get("name"),
        device_type=created.get("type"),
    )


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
    cfg = load_local_config()
    claimed_bcm = {w.bcm for w in cfg.wiring if w.bcm is not None}
    await probe_service.poll_once(claimed_bcm=claimed_bcm)
    snap = probe_service.snapshot()
    confirmed_physical = sorted({p for w in cfg.wiring for p in (w.physical or [])})
    confirmed = []
    for index, w in enumerate(cfg.wiring):
        row = w.model_dump()
        row["index"] = index
        confirmed.append(row)
    return {
        **snap,
        "confirmed": confirmed,
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
    pin_map: dict[str, int] | None = None,
) -> dict[str, Any]:
    """Add a peripheral. Prefer pin_map: {lead_id: physical_pin} from the wiring popup."""
    from bioversee_pi.gpio.header import PHYSICAL_TO_PIN

    p = CATALOG_BY_ID.get(peripheral_id)
    if not p:
        raise RuntimeError("Unknown peripheral")

    resolved_bcm = bcm
    resolved_physical = list(physical or [])

    if pin_map:
        # Validate required leads and collect physical pins.
        for lead in p.wires:
            if not lead.required:
                continue
            if lead.id not in pin_map:
                raise RuntimeError(f"Select a pin for {lead.label}")
        resolved_physical = []
        seen: set[int] = set()
        for lead in p.wires:
            pin = pin_map.get(lead.id)
            if pin is None:
                continue
            pin = int(pin)
            if pin in seen:
                raise RuntimeError(f"Pin {pin} is assigned more than once")
            seen.add(pin)
            if pin not in PHYSICAL_TO_PIN:
                raise RuntimeError(f"Unknown physical pin {pin}")
            resolved_physical.append(pin)
            # Signal / data / SDA determines the BCM used by the agent.
            if lead.kind in ("data", "signal", "sda") and resolved_bcm is None:
                header = PHYSICAL_TO_PIN[pin]
                if header.bcm is not None:
                    resolved_bcm = header.bcm
        if not resolved_physical:
            raise RuntimeError("Map at least one cable to a pin")
    else:
        if resolved_bcm is None:
            resolved_bcm = p.default_bcm
        if not resolved_physical:
            resolved_physical = (
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
    cfg.wiring = [w for w in cfg.wiring if not _same_wire(w, entry)]
    cfg.wiring.append(entry)
    save_local_config(cfg)
    return {"ok": True, "wiring": entry.model_dump()}


def gpio_remove_confirmed(index: int) -> dict[str, Any]:
    cfg = load_local_config()
    if index < 0 or index >= len(cfg.wiring):
        raise RuntimeError("Unknown confirmed entry")
    removed = cfg.wiring.pop(index)
    save_local_config(cfg)
    return {"ok": True, "removed": removed.model_dump(), "remaining": len(cfg.wiring)}


def gpio_clear_confirmed() -> dict[str, Any]:
    cfg = load_local_config()
    count = len(cfg.wiring)
    cfg.wiring = []
    save_local_config(cfg)
    return {"ok": True, "cleared": count}


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


_AGENT_UNIT = "bioversee-agent.service"
_AGENT_UNIT_PATH = Path("/etc/systemd/system/bioversee-agent.service")


def _run_sudo(cmd: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["sudo", *cmd],
        check=False,
        capture_output=True,
        text=True,
    )


def _enable_agent_service() -> dict[str, Any]:
    if not _AGENT_UNIT_PATH.exists():
        return {
            "enabled": False,
            "message": "Service unit not installed — run packaging/install.sh",
            "hint": "sudo ./packaging/install.sh && sudo systemctl enable --now bioversee-agent",
        }

    errors: list[str] = []
    for cmd in (
        ["systemctl", "daemon-reload"],
        ["systemctl", "enable", "--now", _AGENT_UNIT],
    ):
        try:
            result = _run_sudo(cmd)
            if result.returncode != 0:
                errors.append(result.stderr.strip() or result.stdout.strip() or str(cmd))
                return {
                    "enabled": False,
                    "message": "Could not enable systemd unit",
                    "errors": errors,
                    "hint": "sudo systemctl enable --now bioversee-agent",
                }
        except FileNotFoundError as exc:
            errors.append(str(exc))
            return {
                "enabled": False,
                "message": "Could not enable systemd unit",
                "errors": errors,
                "hint": "sudo systemctl enable --now bioversee-agent",
            }

    return {"enabled": True, "message": "bioversee-agent enabled on boot"}


def agent_service_status() -> dict[str, Any]:
    """Return live systemd status for the background agent."""
    unit_exists = _AGENT_UNIT_PATH.exists()
    if not unit_exists:
        return {
            "ok": True,
            "installed": False,
            "active": False,
            "enabled": False,
            "state": "missing",
            "message": "Service unit not installed",
        }

    active = False
    enabled = False
    state = "unknown"
    try:
        active_res = subprocess.run(
            ["systemctl", "is-active", _AGENT_UNIT],
            check=False,
            capture_output=True,
            text=True,
        )
        state = (active_res.stdout or active_res.stderr or "unknown").strip() or "unknown"
        active = state == "active"

        enabled_res = subprocess.run(
            ["systemctl", "is-enabled", _AGENT_UNIT],
            check=False,
            capture_output=True,
            text=True,
        )
        enabled = (enabled_res.stdout or "").strip() == "enabled"
    except FileNotFoundError:
        return {
            "ok": False,
            "installed": True,
            "active": False,
            "enabled": False,
            "state": "unknown",
            "message": "systemctl not available",
        }

    return {
        "ok": True,
        "installed": True,
        "active": active,
        "enabled": enabled,
        "state": state,
        "message": state,
    }


def agent_service_start() -> dict[str, Any]:
    if not _AGENT_UNIT_PATH.exists():
        raise RuntimeError("Service unit not installed — run packaging/install.sh")
    for cmd in (
        ["systemctl", "daemon-reload"],
        ["systemctl", "enable", "--now", _AGENT_UNIT],
    ):
        result = _run_sudo(cmd)
        if result.returncode != 0:
            detail = (result.stderr or result.stdout or "").strip()
            raise RuntimeError(detail or "Could not start bioversee-agent")
    cfg = load_local_config()
    cfg.agent_enabled = True
    save_local_config(cfg)
    return {"ok": True, **agent_service_status()}


def agent_service_stop() -> dict[str, Any]:
    if not _AGENT_UNIT_PATH.exists():
        raise RuntimeError("Service unit not installed")
    result = _run_sudo(["systemctl", "stop", _AGENT_UNIT])
    if result.returncode != 0:
        detail = (result.stderr or result.stdout or "").strip()
        raise RuntimeError(detail or "Could not stop bioversee-agent")
    cfg = load_local_config()
    cfg.agent_enabled = False
    save_local_config(cfg)
    return {"ok": True, **agent_service_status()}


def agent_service_delete() -> dict[str, Any]:
    """Stop, disable, and remove the systemd unit file."""
    errors: list[str] = []
    for cmd in (
        ["systemctl", "disable", "--now", _AGENT_UNIT],
        ["systemctl", "daemon-reload"],
    ):
        result = _run_sudo(cmd)
        if result.returncode != 0 and _AGENT_UNIT_PATH.exists():
            errors.append((result.stderr or result.stdout or "").strip() or str(cmd))

    if _AGENT_UNIT_PATH.exists():
        rm = _run_sudo(["rm", "-f", str(_AGENT_UNIT_PATH)])
        if rm.returncode != 0:
            detail = (rm.stderr or rm.stdout or "").strip()
            raise RuntimeError(detail or "Could not delete service file")
        _run_sudo(["systemctl", "daemon-reload"])

    cfg = load_local_config()
    cfg.agent_enabled = False
    save_local_config(cfg)
    return {
        "ok": True,
        "deleted": True,
        "errors": errors,
        "message": "bioversee-agent service file removed",
        **agent_service_status(),
    }


def uninstall_app(settings: AppSettings | None = None) -> dict[str, Any]:
    """Remove the installed app, service, desktop entries, and local config."""
    settings = settings or AppSettings()
    prefix = Path(settings.install_prefix)

    # Stop & remove agent first so nothing holds files open.
    try:
        agent_service_delete()
    except RuntimeError:
        pass

    paths_to_remove = [
        str(prefix),
        "/usr/share/applications/bioversee.desktop",
        "/usr/share/pixmaps/bioversee.png",
        "/usr/share/icons/hicolor/48x48/apps/bioversee.png",
        "/etc/bioversee",
    ]

    # User desktop shortcut(s)
    home = Path.home()
    paths_to_remove.append(str(home / "Desktop" / "Bioversee.desktop"))
    paths_to_remove.append(str(CONFIG_PATH.parent))

    removed: list[str] = []
    errors: list[str] = []
    for path in paths_to_remove:
        if not Path(path).exists():
            continue
        result = _run_sudo(["rm", "-rf", path])
        if result.returncode != 0:
            errors.append((result.stderr or result.stdout or path).strip())
        else:
            removed.append(path)

    # Clear in-process session even if file wipe failed.
    auth.logout()

    if errors and not removed:
        raise RuntimeError("; ".join(errors) or "Uninstall failed")

    return {
        "ok": True,
        "removed": removed,
        "errors": errors,
        "message": "Bioversee removed from this Pi",
    }
