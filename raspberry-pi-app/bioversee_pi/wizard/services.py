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
    AgentServiceEntry,
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
            "active_agent_unit": cfg.active_agent_unit,
            "agent_service_ready": bool(cfg.agent_service_ready),
            "has_agent_service": _unit_path(cfg.active_agent_unit or _DEFAULT_AGENT_UNIT).exists(),
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
    cfg.agent_service_ready = False
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
    _sync_wiring_to_active_service(cfg)
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
    _sync_wiring_to_active_service(cfg)
    save_local_config(cfg)
    return {"ok": True, "wiring": entry.model_dump()}


def gpio_remove_confirmed(index: int) -> dict[str, Any]:
    cfg = load_local_config()
    if index < 0 or index >= len(cfg.wiring):
        raise RuntimeError("Unknown confirmed entry")
    removed = cfg.wiring.pop(index)
    _sync_wiring_to_active_service(cfg)
    save_local_config(cfg)
    return {"ok": True, "removed": removed.model_dump(), "remaining": len(cfg.wiring)}


def gpio_clear_confirmed() -> dict[str, Any]:
    cfg = load_local_config()
    count = len(cfg.wiring)
    cfg.wiring = []
    _sync_wiring_to_active_service(cfg)
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


_DEFAULT_AGENT_UNIT = "bioversee-agent.service"
_SYSTEMD_DIR = Path("/etc/systemd/system")


def _ensure_service_entry(cfg: Any, unit: str, name: str | None = None) -> AgentServiceEntry:
    for entry in cfg.agent_services:
        if entry.unit == unit:
            if name:
                entry.name = name
            return entry
    entry = AgentServiceEntry(
        unit=unit,
        name=name or unit.replace(".service", ""),
        wiring=list(cfg.wiring),
    )
    cfg.agent_services.append(entry)
    return entry


def _sync_wiring_to_active_service(cfg: Any) -> None:
    """Keep the active service entry's wiring in sync with LocalConfig.wiring."""
    unit = cfg.active_agent_unit or _DEFAULT_AGENT_UNIT
    entry = _ensure_service_entry(cfg, unit)
    entry.wiring = list(cfg.wiring)


def _load_wiring_from_service(cfg: Any, unit: str) -> None:
    entry = next((s for s in cfg.agent_services if s.unit == unit), None)
    if entry is not None:
        cfg.wiring = list(entry.wiring)
    # else keep current wiring (first time for this unit)


def _run_sudo(cmd: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["sudo", *cmd],
        check=False,
        capture_output=True,
        text=True,
    )


def _slugify_service_name(name: str) -> str:
    import re

    slug = re.sub(r"[^a-z0-9]+", "-", name.strip().lower()).strip("-")
    return slug[:40] or "agent"


def _unit_from_name(name: str) -> str:
    slug = _slugify_service_name(name)
    if slug in ("agent", "bioversee-agent", "default"):
        return _DEFAULT_AGENT_UNIT
    return f"bioversee-agent-{slug}.service"


def _unit_path(unit: str) -> Path:
    return _SYSTEMD_DIR / unit


def _active_unit(unit: str | None = None) -> str:
    if unit:
        return unit if unit.endswith(".service") else f"{unit}.service"
    cfg = load_local_config()
    return cfg.active_agent_unit or _DEFAULT_AGENT_UNIT


def _read_unit_description(path: Path) -> str | None:
    try:
        for line in path.read_text(encoding="utf-8").splitlines():
            if line.startswith("Description="):
                desc = line.split("=", 1)[1].strip()
                # "Bioversee agent: My Reactor" → "My Reactor"
                if ": " in desc:
                    return desc.split(": ", 1)[1].strip() or None
                return desc or None
    except OSError:
        return None
    return None


def _agent_unit_template(*, display_name: str, settings: AppSettings | None = None) -> str:
    settings = settings or AppSettings()
    prefix = Path(settings.install_prefix)
    user = os.environ.get("USER") or "pi"
    return f"""[Unit]
Description=Bioversee agent: {display_name}
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User={user}
Group={user}
WorkingDirectory={prefix}
Environment=PYTHONUNBUFFERED=1
EnvironmentFile=-/etc/bioversee/pi.env
ExecStart={prefix}/.venv/bin/bioversee-agent
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
"""


def list_agent_services() -> dict[str, Any]:
    """List installed bioversee-agent*.service units + saved display names."""
    cfg = load_local_config()
    name_by_unit = {s.unit: s.name for s in cfg.agent_services}
    units: dict[str, dict[str, Any]] = {}

    if _SYSTEMD_DIR.is_dir():
        for path in sorted(_SYSTEMD_DIR.glob("bioversee-agent*.service")):
            unit = path.name
            display = name_by_unit.get(unit) or _read_unit_description(path) or unit.replace(
                ".service", ""
            )
            status = agent_service_status(unit)
            units[unit] = {
                "unit": unit,
                "name": display,
                "path": str(path),
                "active": bool(status.get("active")),
                "enabled": bool(status.get("enabled")),
                "state": status.get("state"),
            }

    # Include config-only entries that aren't on disk yet (rare).
    for entry in cfg.agent_services:
        if entry.unit not in units:
            units[entry.unit] = {
                "unit": entry.unit,
                "name": entry.name,
                "path": str(_unit_path(entry.unit)),
                "active": False,
                "enabled": False,
                "state": "missing",
            }

    if not units:
        units[_DEFAULT_AGENT_UNIT] = {
            "unit": _DEFAULT_AGENT_UNIT,
            "name": "Default",
            "path": str(_unit_path(_DEFAULT_AGENT_UNIT)),
            "active": False,
            "enabled": False,
            "state": "missing",
        }

    active = _active_unit()
    if active not in units:
        active = next(iter(units))
        cfg.active_agent_unit = active
        save_local_config(cfg)

    return {
        "ok": True,
        "active_unit": active,
        "services": list(units.values()),
    }


def set_active_agent_service(unit: str) -> dict[str, Any]:
    unit = _active_unit(unit)
    cfg = load_local_config()
    # Persist current wiring onto the previous active service before switching.
    _sync_wiring_to_active_service(cfg)
    cfg.active_agent_unit = unit
    _ensure_service_entry(cfg, unit)
    _load_wiring_from_service(cfg, unit)
    save_local_config(cfg)
    return {"ok": True, **list_agent_services(), "status": agent_service_status(unit)}


def confirm_service_setup(unit: str | None = None) -> dict[str, Any]:
    """Mark the selected service as ready and load its wiring for the wiring step."""
    unit = _active_unit(unit)
    path = _unit_path(unit)
    if not path.exists():
        raise RuntimeError("Create or select a service file first")
    cfg = load_local_config()
    _sync_wiring_to_active_service(cfg)
    cfg.active_agent_unit = unit
    _ensure_service_entry(cfg, unit)
    _load_wiring_from_service(cfg, unit)
    cfg.agent_service_ready = True
    save_local_config(cfg)
    return {
        "ok": True,
        "unit": unit,
        "wiring_count": len(cfg.wiring),
        **list_agent_services(),
    }


def create_agent_service(
    name: str,
    *,
    settings: AppSettings | None = None,
    make_active: bool = True,
) -> dict[str, Any]:
    """Create a named systemd unit file for the background agent."""
    display = (name or "").strip()
    if not display:
        raise RuntimeError("Enter a name for the service")
    unit = _unit_from_name(display)
    path = _unit_path(unit)
    content = _agent_unit_template(display_name=display, settings=settings)

    # Write via sudo tee so we don't need a root Python process.
    result = subprocess.run(
        ["sudo", "tee", str(path)],
        input=content,
        check=False,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        detail = (result.stderr or result.stdout or "").strip()
        raise RuntimeError(detail or f"Could not write {path}")

    reload = _run_sudo(["systemctl", "daemon-reload"])
    if reload.returncode != 0:
        detail = (reload.stderr or reload.stdout or "").strip()
        raise RuntimeError(detail or "systemctl daemon-reload failed")

    cfg = load_local_config()
    if make_active:
        # Keep previous service wiring, then switch to a fresh map for the new unit.
        _sync_wiring_to_active_service(cfg)
        cfg.active_agent_unit = unit
        cfg.wiring = []
        cfg.agent_service_ready = False
    cfg.agent_services = [s for s in cfg.agent_services if s.unit != unit]
    cfg.agent_services.append(AgentServiceEntry(unit=unit, name=display, wiring=[]))
    save_local_config(cfg)
    return {
        "ok": True,
        "unit": unit,
        "name": display,
        **list_agent_services(),
        "status": agent_service_status(unit),
    }


def rename_agent_service(unit: str, name: str) -> dict[str, Any]:
    display = (name or "").strip()
    if not display:
        raise RuntimeError("Enter a name for the service")
    unit = _active_unit(unit)
    path = _unit_path(unit)
    if path.exists():
        # Rewrite Description= line
        try:
            text = path.read_text(encoding="utf-8")
        except OSError as exc:
            raise RuntimeError(str(exc)) from exc
        lines = []
        replaced = False
        for line in text.splitlines():
            if line.startswith("Description="):
                lines.append(f"Description=Bioversee agent: {display}")
                replaced = True
            else:
                lines.append(line)
        if not replaced:
            lines.insert(1, f"Description=Bioversee agent: {display}")
        result = subprocess.run(
            ["sudo", "tee", str(path)],
            input="\n".join(lines) + "\n",
            check=False,
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            detail = (result.stderr or result.stdout or "").strip()
            raise RuntimeError(detail or "Could not rename service")
        _run_sudo(["systemctl", "daemon-reload"])

    cfg = load_local_config()
    found = False
    for entry in cfg.agent_services:
        if entry.unit == unit:
            entry.name = display
            found = True
            break
    if not found:
        cfg.agent_services.append(AgentServiceEntry(unit=unit, name=display))
    save_local_config(cfg)
    return {"ok": True, **list_agent_services()}


def _enable_agent_service(unit: str | None = None) -> dict[str, Any]:
    unit = _active_unit(unit)
    path = _unit_path(unit)
    if not path.exists():
        # Create the default unit if missing so finish_setup still works.
        try:
            create_agent_service(
                "Default" if unit == _DEFAULT_AGENT_UNIT else unit.replace(".service", ""),
                make_active=True,
            )
        except RuntimeError as exc:
            return {
                "enabled": False,
                "unit": unit,
                "message": str(exc),
                "hint": "sudo ./packaging/install.sh && sudo systemctl enable --now bioversee-agent",
            }

    errors: list[str] = []
    for cmd in (
        ["systemctl", "daemon-reload"],
        ["systemctl", "enable", "--now", unit],
    ):
        try:
            result = _run_sudo(cmd)
            if result.returncode != 0:
                errors.append(result.stderr.strip() or result.stdout.strip() or str(cmd))
                return {
                    "enabled": False,
                    "unit": unit,
                    "message": "Could not enable systemd unit",
                    "errors": errors,
                    "hint": f"sudo systemctl enable --now {unit}",
                }
        except FileNotFoundError as exc:
            errors.append(str(exc))
            return {
                "enabled": False,
                "unit": unit,
                "message": "Could not enable systemd unit",
                "errors": errors,
                "hint": f"sudo systemctl enable --now {unit}",
            }

    return {"enabled": True, "unit": unit, "message": f"{unit} enabled on boot"}


def agent_service_status(unit: str | None = None) -> dict[str, Any]:
    """Return live systemd status for a background agent unit."""
    unit = _active_unit(unit)
    path = _unit_path(unit)
    if not path.exists():
        return {
            "ok": True,
            "unit": unit,
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
            ["systemctl", "is-active", unit],
            check=False,
            capture_output=True,
            text=True,
        )
        state = (active_res.stdout or active_res.stderr or "unknown").strip() or "unknown"
        active = state == "active"

        enabled_res = subprocess.run(
            ["systemctl", "is-enabled", unit],
            check=False,
            capture_output=True,
            text=True,
        )
        enabled = (enabled_res.stdout or "").strip() == "enabled"
    except FileNotFoundError:
        return {
            "ok": False,
            "unit": unit,
            "installed": True,
            "active": False,
            "enabled": False,
            "state": "unknown",
            "message": "systemctl not available",
        }

    return {
        "ok": True,
        "unit": unit,
        "installed": True,
        "active": active,
        "enabled": enabled,
        "state": state,
        "message": state,
    }


def agent_service_start(unit: str | None = None) -> dict[str, Any]:
    unit = _active_unit(unit)
    if not _unit_path(unit).exists():
        raise RuntimeError("Service unit not installed — create one in Settings first")
    for cmd in (
        ["systemctl", "daemon-reload"],
        ["systemctl", "enable", "--now", unit],
    ):
        result = _run_sudo(cmd)
        if result.returncode != 0:
            detail = (result.stderr or result.stdout or "").strip()
            raise RuntimeError(detail or f"Could not start {unit}")
    cfg = load_local_config()
    cfg.agent_enabled = True
    cfg.active_agent_unit = unit
    save_local_config(cfg)
    return {"ok": True, **agent_service_status(unit)}


def agent_service_stop(unit: str | None = None) -> dict[str, Any]:
    unit = _active_unit(unit)
    if not _unit_path(unit).exists():
        raise RuntimeError("Service unit not installed")
    result = _run_sudo(["systemctl", "stop", unit])
    if result.returncode != 0:
        detail = (result.stderr or result.stdout or "").strip()
        raise RuntimeError(detail or f"Could not stop {unit}")
    cfg = load_local_config()
    cfg.agent_enabled = False
    save_local_config(cfg)
    return {"ok": True, **agent_service_status(unit)}


def agent_service_set_autostart(enabled: bool, unit: str | None = None) -> dict[str, Any]:
    """Enable or disable starting the agent on Raspberry Pi boot (does not start/stop now)."""
    unit = _active_unit(unit)
    if not _unit_path(unit).exists():
        raise RuntimeError("Service unit not installed — create one first")
    cmd = ["systemctl", "enable" if enabled else "disable", unit]
    result = _run_sudo(cmd)
    if result.returncode != 0:
        detail = (result.stderr or result.stdout or "").strip()
        action = "enable" if enabled else "disable"
        raise RuntimeError(detail or f"Could not {action} {unit} on boot")
    cfg = load_local_config()
    cfg.agent_enabled = bool(enabled)
    cfg.active_agent_unit = unit
    save_local_config(cfg)
    status = agent_service_status(unit)
    return {
        "ok": True,
        "autostart": bool(status.get("enabled")),
        **status,
    }


def agent_service_delete(unit: str | None = None) -> dict[str, Any]:
    """Stop, disable, and remove a systemd unit file."""
    unit = _active_unit(unit)
    path = _unit_path(unit)
    errors: list[str] = []
    for cmd in (
        ["systemctl", "disable", "--now", unit],
        ["systemctl", "daemon-reload"],
    ):
        result = _run_sudo(cmd)
        if result.returncode != 0 and path.exists():
            errors.append((result.stderr or result.stdout or "").strip() or str(cmd))

    if path.exists():
        rm = _run_sudo(["rm", "-f", str(path)])
        if rm.returncode != 0:
            detail = (rm.stderr or rm.stdout or "").strip()
            raise RuntimeError(detail or "Could not delete service file")
        _run_sudo(["systemctl", "daemon-reload"])

    cfg = load_local_config()
    cfg.agent_services = [s for s in cfg.agent_services if s.unit != unit]
    if cfg.active_agent_unit == unit:
        disk_units = (
            [p.name for p in sorted(_SYSTEMD_DIR.glob("bioversee-agent*.service"))]
            if _SYSTEMD_DIR.is_dir()
            else []
        )
        if disk_units:
            cfg.active_agent_unit = disk_units[0]
        elif cfg.agent_services:
            cfg.active_agent_unit = cfg.agent_services[0].unit
        else:
            cfg.active_agent_unit = _DEFAULT_AGENT_UNIT
    cfg.agent_enabled = False
    save_local_config(cfg)
    listed = list_agent_services()
    return {
        "ok": True,
        "deleted": True,
        "unit": unit,
        "errors": errors,
        "message": f"{unit} removed",
        "active_unit": listed.get("active_unit"),
        "services": listed.get("services"),
        "status": agent_service_status(cfg.active_agent_unit),
    }


def uninstall_app(settings: AppSettings | None = None) -> dict[str, Any]:
    """Remove the installed app, service, desktop entries, and local config."""
    settings = settings or AppSettings()
    prefix = Path(settings.install_prefix)

    # Stop & remove all agent units first so nothing holds files open.
    listed = list_agent_services().get("services") or []
    for svc in listed:
        try:
            agent_service_delete(str(svc.get("unit")))
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
