"""Embedded Google / website OAuth window (no system browser).

Runs pywebview in a separate process so it does not conflict with the
CustomTkinter main loop on Raspberry Pi OS (GTK WebKit).
"""

from __future__ import annotations

import logging
import subprocess
import sys
from typing import Any

log = logging.getLogger("bioversee.oauth_webview")

_oauth_proc: subprocess.Popen[Any] | None = None


def open_oauth_window(url: str) -> None:
    """Open the OAuth URL in an embedded webview process."""
    close_oauth_window()
    global _oauth_proc
    _oauth_proc = subprocess.Popen(
        [sys.executable, "-m", "bioversee_pi.wizard.oauth_webview", url],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        start_new_session=True,
    )
    log.info("Opened OAuth webview pid=%s", _oauth_proc.pid)


def close_oauth_window() -> None:
    """Terminate a running OAuth webview if present."""
    global _oauth_proc
    if _oauth_proc is None:
        return
    try:
        if _oauth_proc.poll() is None:
            _oauth_proc.terminate()
            try:
                _oauth_proc.wait(timeout=2)
            except subprocess.TimeoutExpired:
                _oauth_proc.kill()
    except Exception:  # noqa: BLE001
        pass
    _oauth_proc = None


def _run_window(url: str) -> None:
    try:
        import webview
    except ImportError as exc:
        raise SystemExit(
            "pywebview is required for Google sign-in.\n"
            "Install with: pip install pywebview\n"
            "On Raspberry Pi OS also: sudo apt install gir1.2-webkit2-4.1"
        ) from exc

    webview.create_window(
        "Sign in to Bioversee",
        url,
        width=520,
        height=760,
        background_color="#F2F4F3",
    )
    webview.start()


def main(argv: list[str] | None = None) -> None:
    args = list(argv if argv is not None else sys.argv[1:])
    if not args:
        raise SystemExit("Usage: python -m bioversee_pi.wizard.oauth_webview <url>")
    _run_window(args[0])


if __name__ == "__main__":
    main()
