from __future__ import annotations

import os
import tomllib
from pathlib import Path
from typing import Any

import tomli_w
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

CONFIG_DIR = Path(os.environ.get("BIOVERSEE_CONFIG_DIR", Path.home() / ".config" / "bioversee"))
CONFIG_PATH = CONFIG_DIR / "config.toml"
SESSION_PATH = CONFIG_DIR / "session.toml"


class WiringEntry(BaseModel):
    bcm: int | None = None
    physical: list[int] = Field(default_factory=list)
    role: str  # sensor | actuator | power | ground | unknown
    name: str
    driver: str = "generic"
    confirmed: bool = False
    i2c_address: int | None = None
    one_wire_id: str | None = None


class LocalConfig(BaseModel):
    device_id: str | None = None
    device_name: str | None = None
    device_type: str | None = None
    api_key: str | None = None
    credential_id: str | None = None
    supabase_url: str | None = None
    supabase_anon_key: str | None = None
    wiring: list[WiringEntry] = Field(default_factory=list)
    agent_enabled: bool = False


class AppSettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="BIOVERSEE_", extra="ignore")

    supabase_url: str = ""
    supabase_anon_key: str = ""
    wizard_host: str = "0.0.0.0"
    wizard_port: int = 8787
    website_url: str = "https://www.bioversee.com"
    mint_path: str = "/functions/v1/mint-device-key"
    ingest_path: str = "/functions/v1/pi-ingest"
    simulate_gpio: bool = False
    update_repo: str = "MelcherMate/Bioversee"
    update_branch: str = "master"
    update_subdir: str = "raspberry-pi-app"
    install_prefix: str = "/opt/bioversee-pi"


SYSTEM_ENV_FILE = Path("/etc/bioversee/pi.env")


def bootstrap_env_from_system(env_file: Path | None = None) -> None:
    """Load installer-baked keys into the process if not already set."""
    path = env_file or SYSTEM_ENV_FILE
    if not path.is_file():
        return
    try:
        text = path.read_text(encoding="utf-8")
    except OSError:
        return
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if not key:
            continue
        if key not in os.environ or not os.environ.get(key):
            os.environ[key] = value


def ensure_config_dir() -> Path:
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    return CONFIG_DIR


def load_local_config() -> LocalConfig:
    if not CONFIG_PATH.exists():
        return LocalConfig()
    with CONFIG_PATH.open("rb") as fh:
        data = tomllib.load(fh)
    wiring_raw = data.get("wiring") or []
    return LocalConfig(
        device_id=data.get("device_id"),
        device_name=data.get("device_name"),
        device_type=data.get("device_type"),
        api_key=data.get("api_key"),
        credential_id=data.get("credential_id"),
        supabase_url=data.get("supabase_url"),
        supabase_anon_key=data.get("supabase_anon_key"),
        wiring=[WiringEntry.model_validate(w) for w in wiring_raw],
        agent_enabled=bool(data.get("agent_enabled", False)),
    )


def save_local_config(cfg: LocalConfig) -> None:
    ensure_config_dir()
    payload: dict[str, Any] = {
        "device_id": cfg.device_id,
        "device_name": cfg.device_name,
        "device_type": cfg.device_type,
        "api_key": cfg.api_key,
        "credential_id": cfg.credential_id,
        "supabase_url": cfg.supabase_url,
        "supabase_anon_key": cfg.supabase_anon_key,
        "agent_enabled": cfg.agent_enabled,
        "wiring": [w.model_dump(exclude_none=True) for w in cfg.wiring],
    }
    with CONFIG_PATH.open("wb") as fh:
        tomli_w.dump(payload, fh)
    try:
        os.chmod(CONFIG_PATH, 0o600)
    except OSError:
        pass


def load_session() -> dict[str, Any]:
    if not SESSION_PATH.exists():
        return {}
    with SESSION_PATH.open("rb") as fh:
        return tomllib.load(fh)


def save_session(data: dict[str, Any]) -> None:
    ensure_config_dir()
    with SESSION_PATH.open("wb") as fh:
        tomli_w.dump(data, fh)
    try:
        os.chmod(SESSION_PATH, 0o600)
    except OSError:
        pass


def clear_session() -> None:
    if SESSION_PATH.exists():
        SESSION_PATH.unlink()


def is_raspberry_pi() -> bool:
    model = Path("/proc/device-tree/model")
    if model.exists():
        try:
            text = model.read_text(errors="ignore").lower()
            return "raspberry pi" in text
        except OSError:
            pass
    return Path("/sys/firmware/devicetree/base/model").exists()


def should_simulate(settings: AppSettings | None = None) -> bool:
    s = settings or AppSettings()
    if s.simulate_gpio:
        return True
    return not is_raspberry_pi()
