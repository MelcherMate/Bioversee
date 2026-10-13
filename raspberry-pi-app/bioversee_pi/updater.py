"""Check GitHub for newer Bioversee Pi releases and apply updates."""

from __future__ import annotations

import base64
import json
import logging
import os
import shutil
import subprocess
import tempfile
import zipfile
from pathlib import Path
from typing import Any
from urllib.request import Request, urlopen

from bioversee_pi.version import __version__, compare_versions, display_version

log = logging.getLogger("bioversee.updater")

DEFAULT_REPO = os.environ.get("BIOVERSEE_UPDATE_REPO", "MelcherMate/Bioversee")
DEFAULT_BRANCH = os.environ.get("BIOVERSEE_UPDATE_BRANCH", "master")
DEFAULT_SUBDIR = os.environ.get("BIOVERSEE_UPDATE_SUBDIR", "raspberry-pi-app")
DEFAULT_PREFIX = Path(os.environ.get("BIOVERSEE_PREFIX", "/opt/bioversee-pi"))


def local_version() -> str:
    from bioversee_pi.version import read_version_file

    # Prefer installed tree VERSION when running from /opt
    installed = DEFAULT_PREFIX / "VERSION"
    if installed.exists():
        return read_version_file(installed)
    return read_version_file()


def remote_version_url(
    repo: str = DEFAULT_REPO,
    branch: str = DEFAULT_BRANCH,
    subdir: str = DEFAULT_SUBDIR,
) -> str:
    return (
        f"https://raw.githubusercontent.com/{repo}/{branch}/{subdir}/VERSION"
    )


def fetch_remote_version(
    repo: str = DEFAULT_REPO,
    branch: str = DEFAULT_BRANCH,
    subdir: str = DEFAULT_SUBDIR,
    timeout: float = 15.0,
) -> str:
    url = remote_version_url(repo, branch, subdir)
    req = Request(url, headers={"User-Agent": f"bioversee-pi/{__version__}"})
    with urlopen(req, timeout=timeout) as resp:  # noqa: S310 — fixed GitHub URL
        text = resp.read().decode("utf-8").strip()
    if not text:
        raise RuntimeError("Remote VERSION file was empty")
    return text.splitlines()[0].strip()


def check_for_update(
    repo: str = DEFAULT_REPO,
    branch: str = DEFAULT_BRANCH,
    subdir: str = DEFAULT_SUBDIR,
) -> dict[str, Any]:
    current = local_version()
    try:
        remote = fetch_remote_version(repo, branch, subdir)
    except Exception as exc:  # noqa: BLE001
        return {
            "ok": False,
            "error": str(exc),
            "current": current,
            "current_display": display_version(current),
            "update_available": False,
            "repo": repo,
            "branch": branch,
        }

    cmp = compare_versions(current, remote)
    return {
        "ok": True,
        "current": current,
        "current_display": display_version(current),
        "remote": remote,
        "remote_display": display_version(remote),
        "update_available": cmp < 0,
        "up_to_date": cmp >= 0,
        "repo": repo,
        "branch": branch,
        "subdir": subdir,
    }


def apply_update(
    *,
    prefix: Path = DEFAULT_PREFIX,
    repo: str = DEFAULT_REPO,
    branch: str = DEFAULT_BRANCH,
    subdir: str = DEFAULT_SUBDIR,
    restart_services: bool = True,
) -> dict[str, Any]:
    """Download repo zip, sync raspberry-pi-app into prefix, reinstall package."""
    status_before = check_for_update(repo, branch, subdir)
    if not status_before.get("ok"):
        return {"ok": False, "error": status_before.get("error"), **status_before}
    if not status_before.get("update_available"):
        return {
            "ok": True,
            "updated": False,
            "message": "Already up to date",
            "relaunch": False,
            **status_before,
        }

    zip_url = f"https://github.com/{repo}/archive/refs/heads/{branch}.zip"
    req = Request(zip_url, headers={"User-Agent": f"bioversee-pi/{__version__}"})

    with tempfile.TemporaryDirectory(prefix="bioversee-update-") as tmp:
        tmp_path = Path(tmp)
        archive = tmp_path / "repo.zip"
        with urlopen(req, timeout=120) as resp, archive.open("wb") as out:  # noqa: S310
            shutil.copyfileobj(resp, out)

        with zipfile.ZipFile(archive) as zf:
            zf.extractall(tmp_path)

        # GitHub zip extracts to Repo-branch/
        candidates = [
            p / subdir
            for p in tmp_path.iterdir()
            if p.is_dir() and (p / subdir).is_dir()
        ]
        if not candidates:
            raise RuntimeError(
                f"Could not find {subdir}/ inside downloaded archive"
            )
        source = candidates[0]

        prefix = Path(prefix)
        prefix.mkdir(parents=True, exist_ok=True)

        # Preserve venv + local env while replacing sources
        venv = prefix / ".venv"
        preserve_venv = venv.exists()
        staging_venv = tmp_path / "_keep_venv"
        if preserve_venv:
            shutil.move(str(venv), str(staging_venv))

        # Copy tree (exclude junk)
        for item in source.iterdir():
            if item.name in {".venv", "__pycache__", ".git", "bioversee_pi.egg-info"}:
                continue
            dest = prefix / item.name
            if dest.exists():
                if dest.is_dir():
                    shutil.rmtree(dest)
                else:
                    dest.unlink()
            if item.is_dir():
                shutil.copytree(item, dest)
            else:
                shutil.copy2(item, dest)

        if preserve_venv:
            if venv.exists():
                shutil.rmtree(venv)
            shutil.move(str(staging_venv), str(venv))

        pip = prefix / ".venv" / "bin" / "pip"
        if pip.exists():
            subprocess.run(
                [str(pip), "install", "-e", str(prefix)],
                check=True,
                capture_output=True,
                text=True,
            )
        else:
            log.warning("No venv at %s — skip pip reinstall", venv)

    # Install helper + sudoers and restart agents in ONE sudo prompt.
    if restart_services:
        _post_update_privileged(prefix)

    after = local_version()
    return {
        "ok": True,
        "updated": True,
        "relaunch": True,
        "previous": status_before["current"],
        "previous_display": status_before["current_display"],
        "current": after,
        "current_display": display_version(after),
        "remote": status_before["remote"],
        "message": f"Updated to {display_version(after)} — restarting Bioversee…",
        "launch_command": _launch_command(prefix),
    }


def _launch_command(prefix: Path) -> list[str]:
    launcher = prefix / "bin" / "bioversee-launch"
    venv_app = prefix / ".venv" / "bin" / "bioversee"
    if launcher.is_file():
        return [str(launcher)]
    if venv_app.is_file():
        return [str(venv_app)]
    return ["bioversee"]


def _post_update_privileged(prefix: Path) -> None:
    """Single sudo: install privileged helper + sudoers, restart agent units only."""
    prefix = Path(prefix)
    src = prefix / "packaging" / "bioversee-privileged"
    # Prefer the invoking desktop user (SUDO_USER when update.sh runs as root).
    user = os.environ.get("SUDO_USER") or os.environ.get("USER") or "pi"
    if user == "root":
        user = "pi"

    # Prefer the helper we just unpacked; fall back to restarting agent only.
    if not src.is_file():
        _restart_agent_fallback()
        return

    launcher_path = prefix / "bin" / "bioversee-launch"
    icon_path = "/usr/share/pixmaps/bioversee.png"
    launcher_body = f"""#!/usr/bin/env bash
set -euo pipefail
ENV_FILE="/etc/bioversee/pi.env"
if [[ -r "${{ENV_FILE}}" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${{ENV_FILE}}"
  set +a
fi
exec "{prefix}/.venv/bin/bioversee" "$@"
"""
    desktop_body = f"""[Desktop Entry]
Version=1.0
Type=Application
Name=Bioversee
GenericName=Process control
Comment=Bioversee desktop app for this Raspberry Pi
Exec={launcher_path}
Icon={icon_path}
Terminal=false
Categories=Science;Utility;
StartupNotify=true
"""
    launcher_b64 = base64.b64encode(launcher_body.encode()).decode("ascii")
    desktop_b64 = base64.b64encode(desktop_body.encode()).decode("ascii")

    # One shell under sudo → one password / polkit prompt.
    # File payloads are base64 (no nested heredocs inside bash -c).
    script = f"""
set -euo pipefail
PREFIX={prefix!s}
USER_NAME={user!s}
USER_HOME=$(getent passwd "$USER_NAME" | cut -d: -f6 || true)
mkdir -p "$PREFIX/bin"
cp "$PREFIX/packaging/bioversee-privileged" "$PREFIX/bin/bioversee-privileged"
chmod 755 "$PREFIX/bin/bioversee-privileged"
if [[ -f "$PREFIX/packaging/sudoers.bioversee" ]]; then
  sed "s|SERVICE_USER_PLACEHOLDER|$USER_NAME|g; s|/opt/bioversee-pi|$PREFIX|g" \\
    "$PREFIX/packaging/sudoers.bioversee" > /etc/sudoers.d/bioversee-pi
  chmod 440 /etc/sudoers.d/bioversee-pi
  if ! visudo -cf /etc/sudoers.d/bioversee-pi >/dev/null 2>&1; then
    rm -f /etc/sudoers.d/bioversee-pi
  fi
fi
# Replace oversized desktop icons (1024² master used to blow up the Execute dialog).
mkdir -p /usr/share/icons/hicolor/48x48/apps \\
  /usr/share/icons/hicolor/128x128/apps \\
  /usr/share/icons/hicolor/256x256/apps \\
  /usr/share/pixmaps
if [[ -f "$PREFIX/packaging/bioversee-48.png" ]]; then
  cp "$PREFIX/packaging/bioversee-48.png" /usr/share/icons/hicolor/48x48/apps/bioversee.png
  cp "$PREFIX/packaging/bioversee-48.png" /usr/share/pixmaps/bioversee.png
fi
if [[ -f "$PREFIX/packaging/bioversee-128.png" ]]; then
  cp "$PREFIX/packaging/bioversee-128.png" /usr/share/icons/hicolor/128x128/apps/bioversee.png
fi
if [[ -f "$PREFIX/packaging/bioversee-256.png" ]]; then
  cp "$PREFIX/packaging/bioversee-256.png" /usr/share/icons/hicolor/256x256/apps/bioversee.png
fi
LAUNCHER="$PREFIX/bin/bioversee-launch"
APP_DESKTOP=/usr/share/applications/bioversee.desktop
echo '{launcher_b64}' | base64 -d > "$LAUNCHER"
chmod 755 "$LAUNCHER"
echo '{desktop_b64}' | base64 -d > "$APP_DESKTOP"
chmod 644 "$APP_DESKTOP"
if [[ -n "$USER_HOME" && -d "$USER_HOME/Desktop" ]]; then
  cp "$APP_DESKTOP" "$USER_HOME/Desktop/Bioversee.desktop"
  chmod 755 "$USER_HOME/Desktop/Bioversee.desktop"
  chown "$USER_NAME:$USER_NAME" "$USER_HOME/Desktop/Bioversee.desktop" || true
  if command -v gio >/dev/null 2>&1; then
    sudo -u "$USER_NAME" gio set "$USER_HOME/Desktop/Bioversee.desktop" metadata::trusted true 2>/dev/null || true
  fi
fi
gtk-update-icon-cache -f /usr/share/icons/hicolor 2>/dev/null || true
# Drop legacy wizard unit (desktop app only) — was causing a 2nd auth prompt.
systemctl disable --now bioversee-wizard.service 2>/dev/null || true
rm -f /etc/systemd/system/bioversee-wizard.service
systemctl daemon-reload
"$PREFIX/bin/bioversee-privileged" restart-agents || true
"""
    try:
        result = subprocess.run(
            ["sudo", "bash", "-c", script],
            check=False,
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            log.warning(
                "Privileged post-update failed (%s): %s",
                result.returncode,
                (result.stderr or result.stdout or "").strip(),
            )
            _restart_agent_fallback()
    except FileNotFoundError:
        _restart_agent_fallback()


def _restart_agent_fallback() -> None:
    """Last resort: restart only bioversee-agent.service (never the old wizard)."""
    try:
        subprocess.run(
            ["sudo", "systemctl", "try-restart", "bioversee-agent.service"],
            check=False,
            capture_output=True,
            text=True,
        )
    except FileNotFoundError:
        pass


def main() -> None:
    import argparse

    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
    parser = argparse.ArgumentParser(description="Bioversee Pi updater")
    parser.add_argument(
        "command",
        nargs="?",
        default="check",
        choices=("check", "apply"),
    )
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    if args.command == "check":
        result = check_for_update()
    else:
        result = apply_update()

    if args.json:
        print(json.dumps(result, indent=2))
    elif result.get("ok") and args.command == "check":
        print(
            f"Installed {result['current_display']} "
            f"({'update available: ' + result['remote_display'] if result.get('update_available') else 'up to date'})"
        )
    elif result.get("ok"):
        print(result.get("message") or "Done")
    else:
        print(result.get("error") or "Update failed")
        raise SystemExit(1)


if __name__ == "__main__":
    main()
