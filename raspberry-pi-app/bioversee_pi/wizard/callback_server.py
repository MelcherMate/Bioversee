"""Tiny localhost HTTP server for website → desktop OAuth return only."""

from __future__ import annotations

import json
import logging
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Callable
from urllib.parse import urlparse

log = logging.getLogger("bioversee.callback")

_CALLBACK_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Bioversee — Returning to app</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #f5f5f7; color: #1d1d1f;
           display: grid; place-items: center; min-height: 100vh; margin: 0; }
    main { background: #fff; padding: 28px 32px; border-radius: 16px;
           box-shadow: 0 12px 40px rgba(0,0,0,.08); max-width: 420px; text-align: center; }
    h1 { font-size: 1.25rem; margin: 0 0 8px; }
    p { color: #6e6e73; margin: 0; line-height: 1.45; }
  </style>
</head>
<body>
  <main>
    <h1 id="t">Signing you in…</h1>
    <p id="d">Returning to the Bioversee desktop app.</p>
  </main>
  <script>
    (async () => {
      const t = document.getElementById("t");
      const d = document.getElementById("d");
      const p = new URLSearchParams(location.hash.replace(/^#/, ""));
      const body = {
        access_token: p.get("access_token") || "",
        refresh_token: p.get("refresh_token") || "",
        expires_at: p.get("expires_at") || "",
        state: p.get("state") || "",
        email: p.get("email") || "",
      };
      if (!body.access_token || !body.state) {
        t.textContent = "Sign-in incomplete";
        d.textContent = "Go back to the Bioversee app and try again.";
        return;
      }
      try {
        const res = await fetch("/auth/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || res.statusText);
        history.replaceState(null, "", "/auth/callback");
        t.textContent = "You're signed in";
        d.textContent = data.email
          ? ("Welcome, " + data.email + ". Return to the Bioversee app — you can close this window.")
          : "Return to the Bioversee app window — you can close this window.";
      } catch (err) {
        t.textContent = "Could not finish sign-in";
        d.textContent = (err && err.message) || "Try again from the Bioversee app.";
      }
    })();
  </script>
</body>
</html>
"""


class CallbackServer:
    """Loopback-only server that accepts tokens from bioversee.com/pi-login."""

    def __init__(
        self,
        *,
        host: str = "127.0.0.1",
        port: int = 8787,
        on_complete: Callable[[dict], dict] | None = None,
    ) -> None:
        self.host = host
        self.port = port
        self.on_complete = on_complete
        self._httpd: ThreadingHTTPServer | None = None
        self._thread: threading.Thread | None = None

    def start(self) -> None:
        if self._httpd:
            return
        owner = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, fmt: str, *args) -> None:  # noqa: A003
                log.debug("%s - %s", self.address_string(), fmt % args)

            def do_GET(self) -> None:  # noqa: N802
                path = urlparse(self.path).path.rstrip("/") or "/"
                if path in ("/auth/callback", "/auth/callback/"):
                    raw = _CALLBACK_HTML.encode("utf-8")
                    self.send_response(200)
                    self.send_header("Content-Type", "text/html; charset=utf-8")
                    self.send_header("Content-Length", str(len(raw)))
                    self.end_headers()
                    self.wfile.write(raw)
                    return
                self.send_error(404, "Not found")

            def do_POST(self) -> None:  # noqa: N802
                path = urlparse(self.path).path.rstrip("/") or "/"
                if path not in ("/auth/complete", "/auth/complete/"):
                    self.send_error(404, "Not found")
                    return
                length = int(self.headers.get("Content-Length", "0") or 0)
                raw = self.rfile.read(length) if length else b"{}"
                try:
                    payload = json.loads(raw.decode("utf-8") or "{}")
                    if not owner.on_complete:
                        raise RuntimeError("Callback handler not ready")
                    result = owner.on_complete(payload)
                    body = json.dumps(result).encode("utf-8")
                    self.send_response(200)
                    self.send_header("Content-Type", "application/json")
                    self.send_header("Content-Length", str(len(body)))
                    self.end_headers()
                    self.wfile.write(body)
                except Exception as exc:  # noqa: BLE001
                    body = json.dumps({"error": str(exc)}).encode("utf-8")
                    self.send_response(400)
                    self.send_header("Content-Type", "application/json")
                    self.send_header("Content-Length", str(len(body)))
                    self.end_headers()
                    self.wfile.write(body)

        self._httpd = ThreadingHTTPServer((self.host, self.port), Handler)
        self._thread = threading.Thread(
            target=self._httpd.serve_forever,
            name="bioversee-auth-callback",
            daemon=True,
        )
        self._thread.start()
        log.info("Auth callback listening on http://%s:%s/auth/callback", self.host, self.port)

    def stop(self) -> None:
        if self._httpd:
            self._httpd.shutdown()
            self._httpd.server_close()
            self._httpd = None
            self._thread = None
