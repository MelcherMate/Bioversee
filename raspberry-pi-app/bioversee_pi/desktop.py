"""Native desktop shell for the Bioversee Pi app (not a browser tab)."""

from __future__ import annotations

import logging
import os
import socket
import threading
import time
from typing import Callable

log = logging.getLogger("bioversee.desktop")


def _port_open(host: str, port: int) -> bool:
    try:
        with socket.create_connection((host, port), timeout=0.3):
            return True
    except OSError:
        return False


def _wait_for_server(host: str, port: int, timeout: float = 20.0) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        if _port_open(host, port):
            return True
        time.sleep(0.1)
    return False


def run_desktop_app(
    *,
    host: str = "127.0.0.1",
    port: int = 8787,
    start_server: Callable[[], None],
) -> None:
    """
    Start the local API in a background thread and open a native window.
    Falls back to the system browser only if pywebview is unavailable.
    """
    # Bind loopback so this is a local app, not a network website.
    bind_host = "127.0.0.1" if host in ("0.0.0.0", "::") else host
    url = f"http://{bind_host}:{port}/"

    if not _port_open(bind_host, port):
        thread = threading.Thread(target=start_server, name="bioversee-api", daemon=True)
        thread.start()
        if not _wait_for_server(bind_host, port):
            raise RuntimeError(f"Bioversee local server did not start on {url}")

    # Prefer a real desktop window (no browser chrome / URL bar).
    try:
        import webview  # type: ignore

        log.info("Opening Bioversee desktop window at %s", url)
        webview.create_window(
            "Bioversee",
            url,
            width=1100,
            height=760,
            min_size=(800, 560),
            background_color="#F5F5F7",
        )
        webview.start()
        return
    except Exception as exc:  # noqa: BLE001
        log.warning("pywebview unavailable (%s) — falling back to browser", exc)

    import webbrowser

    webbrowser.open(url)
    # Keep process alive while using browser fallback (server thread is daemon).
    log.info("Bioversee is running at %s — press Ctrl+C to quit", url)
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        pass


def should_use_desktop() -> bool:
    """Headless/server mode when BIOVERSEE_WIZARD_HEADLESS=1 or no display."""
    if os.environ.get("BIOVERSEE_WIZARD_HEADLESS", "").strip() in ("1", "true", "yes"):
        return False
    return bool(os.environ.get("DISPLAY") or os.environ.get("WAYLAND_DISPLAY"))
