from __future__ import annotations

import os
import secrets
import subprocess
import time
import webbrowser
from pathlib import Path
from typing import Any
from urllib.parse import urlencode

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from bioversee_pi import auth
from bioversee_pi.config import (
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
from bioversee_pi.gpio.catalog import catalog_as_dict
from bioversee_pi.gpio.header import header_as_dict
from bioversee_pi.gpio.probe import probe_service
from bioversee_pi.updater import apply_update, check_for_update
from bioversee_pi.version import __version__, display_version

STATIC_DIR = Path(__file__).resolve().parent / "static"

settings = AppSettings()
if not settings.supabase_url:
    settings.supabase_url = os.environ.get("VITE_SUPABASE_URL", "")
if not settings.supabase_anon_key:
    settings.supabase_anon_key = os.environ.get(
        "VITE_SUPABASE_PUBLISHABLE_KEY", ""
    )

app = FastAPI(title="Bioversee Pi Setup", version=__version__)
app.mount("/assets", StaticFiles(directory=STATIC_DIR), name="assets")


class CredentialsBody(BaseModel):
    email: str
    password: str


class BrowserCompleteBody(BaseModel):
    access_token: str
    refresh_token: str = ""
    expires_at: str | int | float | None = None
    state: str
    email: str = ""


class ProjectBody(BaseModel):
    supabase_url: str
    supabase_anon_key: str


# Pending website→app login states: state → expiry (unix seconds)
_pending_browser_logins: dict[str, float] = {}
_BROWSER_LOGIN_TTL_S = 600.0


class SelectDeviceBody(BaseModel):
    device_id: str
    device_name: str | None = None
    device_type: str | None = None


class ConfirmBody(BaseModel):
    event_id: str
    peripheral_id: str | None = None


class IgnoreBody(BaseModel):
    event_id: str


class SimulateBody(BaseModel):
    peripheral_id: str = "ds18b20"


class ManualWireBody(BaseModel):
    peripheral_id: str
    bcm: int | None = None
    physical: list[int] = Field(default_factory=list)


@app.get("/")
async def index() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/auth/callback")
async def auth_callback_page() -> FileResponse:
    """Receives tokens from bioversee.com/pi-login and hands them to the local app."""
    return FileResponse(STATIC_DIR / "callback.html")


@app.get("/api/status")
async def status() -> dict[str, Any]:
    cfg = load_local_config()
    return {
        "version": __version__,
        "version_display": display_version(),
        "signed_in": bool(await auth.get_access_token(settings)),
        "email": auth.current_user_email(),
        "has_project": bool(settings.supabase_url and settings.supabase_anon_key),
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


@app.get("/api/update/status")
async def update_status() -> dict[str, Any]:
    return check_for_update(
        repo=settings.update_repo,
        branch=settings.update_branch,
        subdir=settings.update_subdir,
    )


@app.post("/api/update/apply")
async def update_apply() -> dict[str, Any]:
    try:
        result = apply_update(
            prefix=Path(settings.install_prefix),
            repo=settings.update_repo,
            branch=settings.update_branch,
            subdir=settings.update_subdir,
            restart_services=True,
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(500, str(exc)) from exc
    if not result.get("ok"):
        raise HTTPException(500, str(result.get("error") or "Update failed"))
    return result


@app.post("/api/project")
async def set_project(body: ProjectBody) -> dict[str, Any]:
    settings.supabase_url = body.supabase_url.strip().rstrip("/")
    settings.supabase_anon_key = body.supabase_anon_key.strip()
    if not settings.supabase_url or not settings.supabase_anon_key:
        raise HTTPException(400, "supabase_url and supabase_anon_key required")
    cfg = load_local_config()
    cfg.supabase_url = settings.supabase_url
    cfg.supabase_anon_key = settings.supabase_anon_key
    save_local_config(cfg)
    return {"ok": True}


@app.post("/api/auth/signup")
async def signup(body: CredentialsBody) -> dict[str, Any]:
    _require_project()
    try:
        data = await auth.sign_up(settings, body.email.strip(), body.password)
    except auth.AuthError as exc:
        raise HTTPException(400, str(exc)) from exc
    return {
        "ok": True,
        "needs_confirmation": not bool(data.get("access_token")),
        "email": body.email.strip(),
    }


@app.post("/api/auth/login")
async def login(body: CredentialsBody) -> dict[str, Any]:
    _require_project()
    try:
        await auth.sign_in(settings, body.email.strip(), body.password)
    except auth.AuthError as exc:
        raise HTTPException(400, str(exc)) from exc
    return {"ok": True, "email": body.email.strip()}


def _prune_pending_logins() -> None:
    now = time.time()
    expired = [k for k, exp in _pending_browser_logins.items() if exp <= now]
    for key in expired:
        _pending_browser_logins.pop(key, None)


@app.post("/api/auth/browser-start")
async def browser_start() -> dict[str, Any]:
    """Open bioversee.com/pi-login; tokens return to /auth/callback on this Pi."""
    _require_project()
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


@app.post("/api/auth/complete")
async def auth_complete(body: BrowserCompleteBody) -> dict[str, Any]:
    """Called by /auth/callback after the user signs in on the website."""
    _prune_pending_logins()
    expiry = _pending_browser_logins.get(body.state)
    if not expiry or time.time() > expiry:
        raise HTTPException(
            400,
            "Login expired or invalid — tap Continue on bioversee.com again",
        )
    _pending_browser_logins.pop(body.state, None)
    try:
        auth.accept_browser_session(
            access_token=body.access_token.strip(),
            refresh_token=(body.refresh_token or "").strip(),
            expires_at=body.expires_at,
            email=(body.email or "").strip(),
        )
    except auth.AuthError as exc:
        raise HTTPException(400, str(exc)) from exc
    return {"ok": True, "email": auth.current_user_email()}


@app.post("/api/auth/logout")
async def logout() -> dict[str, Any]:
    auth.logout()
    return {"ok": True}


@app.get("/api/devices")
async def devices() -> dict[str, Any]:
    _require_project()
    try:
        rows = await list_accessible_devices(settings)
    except DevicesError as exc:
        raise HTTPException(400, str(exc)) from exc
    return {"devices": rows}


@app.post("/api/devices/select")
async def select_device(body: SelectDeviceBody) -> dict[str, Any]:
    _require_project()
    try:
        minted = await mint_device_key(settings, body.device_id)
    except DevicesError as exc:
        raise HTTPException(400, str(exc)) from exc

    api_key = minted.get("api_key")
    if not api_key:
        raise HTTPException(
            500, "Mint did not return api_key — run device_credentials_pi.sql"
        )

    cfg = load_local_config()
    cfg.device_id = body.device_id
    cfg.device_name = body.device_name
    cfg.device_type = body.device_type
    cfg.api_key = str(api_key)
    cfg.credential_id = str(minted.get("credential_id") or "")
    cfg.supabase_url = settings.supabase_url
    cfg.supabase_anon_key = settings.supabase_anon_key
    cfg.wiring = []
    save_local_config(cfg)
    return {
        "ok": True,
        "device_id": body.device_id,
        "credential_id": cfg.credential_id,
    }


@app.get("/api/gpio/header")
async def gpio_header() -> dict[str, Any]:
    return {"pins": header_as_dict(), "catalog": catalog_as_dict()}


@app.get("/api/gpio/state")
async def gpio_state() -> dict[str, Any]:
    await probe_service.poll_once()
    cfg = load_local_config()
    snap = probe_service.snapshot()
    confirmed_physical = sorted(
        {p for w in cfg.wiring for p in (w.physical or [])}
    )
    return {
        **snap,
        "confirmed": [w.model_dump() for w in cfg.wiring],
        "confirmed_physical": confirmed_physical,
    }


@app.post("/api/gpio/confirm")
async def gpio_confirm(body: ConfirmBody) -> dict[str, Any]:
    guess = probe_service.confirm(body.event_id, body.peripheral_id)
    if not guess:
        raise HTTPException(404, "Unknown event")
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


@app.post("/api/gpio/ignore")
async def gpio_ignore(body: IgnoreBody) -> dict[str, Any]:
    probe_service.ignore(body.event_id)
    return {"ok": True}


@app.post("/api/gpio/simulate")
async def gpio_simulate(body: SimulateBody) -> dict[str, Any]:
    guess = probe_service.inject_simulation(body.peripheral_id)
    return {"ok": True, "guess": guess.to_dict()}


@app.post("/api/gpio/manual")
async def gpio_manual(body: ManualWireBody) -> dict[str, Any]:
    from bioversee_pi.gpio.catalog import CATALOG_BY_ID
    from bioversee_pi.gpio.header import physical_pins_for_bcm

    p = CATALOG_BY_ID.get(body.peripheral_id)
    if not p:
        raise HTTPException(400, "Unknown peripheral")
    bcm = body.bcm if body.bcm is not None else p.default_bcm
    physical = body.physical or (
        physical_pins_for_bcm(bcm) if bcm is not None else []
    )
    entry = WiringEntry(
        bcm=bcm,
        physical=physical,
        role=p.role,
        name=p.name,
        driver=p.driver,
        confirmed=True,
    )
    cfg = load_local_config()
    cfg.wiring.append(entry)
    save_local_config(cfg)
    return {"ok": True, "wiring": entry.model_dump()}


@app.post("/api/finish")
async def finish() -> dict[str, Any]:
    cfg = load_local_config()
    if not cfg.device_id or not cfg.api_key:
        raise HTTPException(400, "Select a device first")
    if not cfg.wiring:
        raise HTTPException(400, "Confirm at least one wired peripheral")

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
        "config_path": str(
            Path.home() / ".config" / "bioversee" / "config.toml"
        ),
    }


def _same_wire(a: WiringEntry, b: WiringEntry) -> bool:
    if a.name == b.name:
        return True
    if a.bcm is not None and a.bcm == b.bcm:
        return True
    return False


def _require_project() -> None:
    if not settings.supabase_url or not settings.supabase_anon_key:
        cfg = load_local_config()
        if cfg.supabase_url and cfg.supabase_anon_key:
            settings.supabase_url = cfg.supabase_url
            settings.supabase_anon_key = cfg.supabase_anon_key
    if not settings.supabase_url or not settings.supabase_anon_key:
        raise HTTPException(
            400,
            "Set Supabase URL and anon key first "
            "(or export BIOVERSEE_SUPABASE_URL / BIOVERSEE_SUPABASE_ANON_KEY)",
        )


def _enable_agent_service() -> dict[str, Any]:
    system_unit = Path("/etc/systemd/system/bioversee-agent.service")
    if system_unit.exists():
        commands = [
            ["sudo", "systemctl", "daemon-reload"],
            ["sudo", "systemctl", "enable", "--now", "bioversee-agent.service"],
        ]
    else:
        return {
            "enabled": False,
            "message": "Service unit not installed — run packaging/install.sh",
            "hint": "sudo ./packaging/install.sh && sudo systemctl enable --now bioversee-agent",
        }

    errors: list[str] = []
    for cmd in commands:
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


def main() -> None:
    import logging

    import uvicorn

    from bioversee_pi.desktop import run_desktop_app, should_use_desktop

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )

    cfg = load_local_config()
    if cfg.supabase_url:
        settings.supabase_url = cfg.supabase_url
    if cfg.supabase_anon_key:
        settings.supabase_anon_key = cfg.supabase_anon_key

    # Desktop app always binds loopback; headless/server can use env host.
    host = "127.0.0.1" if should_use_desktop() else settings.wizard_host
    port = settings.wizard_port

    def start_server() -> None:
        uvicorn.run(
            "bioversee_pi.wizard.app:app",
            host=host,
            port=port,
            reload=False,
            log_level="info",
        )

    if should_use_desktop():
        run_desktop_app(host=host, port=port, start_server=start_server)
    else:
        start_server()


if __name__ == "__main__":
    main()
