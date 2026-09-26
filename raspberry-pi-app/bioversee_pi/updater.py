"""Check GitHub for newer Bioversee Pi releases and apply updates."""

from __future__ import annotations

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

    if restart_services:
        _restart_services()

    after = local_version()
    return {
        "ok": True,
        "updated": True,
        "previous": status_before["current"],
        "previous_display": status_before["current_display"],
        "current": after,
        "current_display": display_version(after),
        "remote": status_before["remote"],
        "message": f"Updated to {display_version(after)}",
    }


def _restart_services() -> None:
    for unit in ("bioversee-agent.service", "bioversee-wizard.service"):
        try:
            subprocess.run(
                ["systemctl", "try-restart", unit],
                check=False,
                capture_output=True,
                text=True,
            )
        except FileNotFoundError:
            break


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
