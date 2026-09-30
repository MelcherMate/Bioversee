"""Native Bioversee setup wizard (CustomTkinter — real desktop window, not a browser)."""

from __future__ import annotations

import asyncio
import logging
import threading
import tkinter as tk
from typing import Any, Callable

from bioversee_pi.devices import DevicesError
from bioversee_pi.version import display_version
from bioversee_pi.wizard import oauth_webview, services
from bioversee_pi.wizard.callback_server import CallbackServer

log = logging.getLogger("bioversee.gui")

# Brand colors (teal, light — not a web page chrome look)
_BG = "#F2F4F3"
_CARD = "#FFFFFF"
_TEXT = "#1A2B28"
_MUTED = "#5C6F6A"
_ACCENT = "#0D9488"
_ACCENT_HOVER = "#0F766E"
_LINE = "#D7E0DC"
_DANGER = "#B42318"
_POWER = "#F59E0B"
_GND = "#6B7280"
_ACTIVE = "#14B8A6"
_CONFIRMED = "#0F766E"
_HIGH = "#22C55E"
_LOW = "#EF4444"
_IDLE = "#EEF2F0"
_BUSY = "#6366F1"
_UNKNOWN = "#CBD5E1"

STEPS = ("account", "device", "wiring", "done")


def _run_async(coro, on_ok: Callable[[Any], None], on_err: Callable[[Exception], None]) -> None:
    def worker() -> None:
        try:
            result = asyncio.run(coro)
        except Exception as exc:  # noqa: BLE001
            on_err(exc)
            return
        on_ok(result)

    threading.Thread(target=worker, name="bioversee-async", daemon=True).start()


def _try_import_ctk():
    try:
        import customtkinter as ctk

        return ctk
    except ImportError as exc:
        raise SystemExit(
            "customtkinter is required for the Bioversee desktop app.\n"
            "Install with: pip install customtkinter\n"
            "On Raspberry Pi OS also run: sudo apt install python3-tk"
        ) from exc


class WizardApp:
    def __init__(self) -> None:
        self.ctk = _try_import_ctk()
        self.ctk.set_appearance_mode("light")
        self.ctk.set_default_color_theme("green")

        self.settings = services.load_settings()
        self.root = self.ctk.CTk()
        self.root.title("Bioversee")
        self.root.geometry("980x720")
        self.root.minsize(840, 600)
        self.root.configure(fg_color=_BG)

        self.step = "account"
        self.devices: list[dict[str, Any]] = []
        self.catalog: list[dict[str, Any]] = []
        self.pins: list[dict[str, Any]] = []
        self._poll_job: str | None = None
        self._auth_poll_job: str | None = None
        self._pin_labels: dict[int, Any] = {}
        self._busy = False
        self._catalog_by_label: dict[str, str] = {}

        self.callback = CallbackServer(
            host="127.0.0.1",
            port=self.settings.wizard_port,
            on_complete=lambda payload: services.complete_browser_login(
                access_token=str(payload.get("access_token") or ""),
                refresh_token=str(payload.get("refresh_token") or ""),
                expires_at=payload.get("expires_at"),
                state=str(payload.get("state") or ""),
                email=str(payload.get("email") or ""),
            ),
        )
        self.callback.start()
        self.root.protocol("WM_DELETE_WINDOW", self._on_close)

        self._build_shell()
        self._show_boot()

    def run(self) -> None:
        self.root.mainloop()

    def _on_close(self) -> None:
        self._stop_polls()
        oauth_webview.close_oauth_window()
        try:
            self.callback.stop()
        except Exception:  # noqa: BLE001
            pass
        self.root.destroy()

    def _build_shell(self) -> None:
        ctk = self.ctk
        top = ctk.CTkFrame(self.root, fg_color="transparent")
        top.pack(fill="x", padx=28, pady=(22, 8))

        brand = ctk.CTkFrame(top, fg_color="transparent")
        brand.pack(side="left")
        mark = ctk.CTkFrame(brand, width=40, height=40, corner_radius=12, fg_color=_ACCENT)
        mark.pack(side="left", padx=(0, 12))
        mark.pack_propagate(False)
        titles = ctk.CTkFrame(brand, fg_color="transparent")
        titles.pack(side="left")
        ctk.CTkLabel(
            titles,
            text="RASPBERRY PI",
            text_color=_MUTED,
            font=ctk.CTkFont(size=11, weight="bold"),
        ).pack(anchor="w")
        self.title_label = ctk.CTkLabel(
            titles,
            text=f"Bioversee setup  {display_version()}",
            text_color=_TEXT,
            font=ctk.CTkFont(size=22, weight="bold"),
        )
        self.title_label.pack(anchor="w")

        self.step_row = ctk.CTkFrame(top, fg_color="transparent")
        self.step_row.pack(side="right")
        self.step_pills: dict[str, Any] = {}
        for name in STEPS:
            pill = ctk.CTkLabel(
                self.step_row,
                text=name.title(),
                corner_radius=999,
                fg_color=_LINE,
                text_color=_MUTED,
                padx=10,
                pady=4,
                font=ctk.CTkFont(size=12, weight="bold"),
            )
            pill.pack(side="left", padx=4)
            self.step_pills[name] = pill

        self.banner = ctk.CTkLabel(
            self.root,
            text="",
            text_color=_DANGER,
            font=ctk.CTkFont(size=13),
            anchor="w",
        )
        self.banner.pack(fill="x", padx=28, pady=(0, 4))

        self.card = ctk.CTkFrame(self.root, fg_color=_CARD, corner_radius=18)
        self.card.pack(fill="both", expand=True, padx=28, pady=(4, 24))

        self.frames: dict[str, Any] = {}
        self.frames["boot"] = self._frame_boot()
        self.frames["project"] = self._frame_project()
        self.frames["account"] = self._frame_account()
        self.frames["device"] = self._frame_device()
        self.frames["wiring"] = self._frame_wiring()
        self.frames["done"] = self._frame_done()

    def _clear_banner(self) -> None:
        self.banner.configure(text="")

    def _set_banner(self, message: str) -> None:
        self.banner.configure(text=message or "")

    def _show(self, name: str) -> None:
        self.step = name
        for frame in self.frames.values():
            frame.pack_forget()
        self.frames[name].pack(fill="both", expand=True, padx=24, pady=22)
        for key, pill in self.step_pills.items():
            if key == name:
                pill.configure(fg_color=_ACCENT, text_color="#FFFFFF")
            elif STEPS.index(key) < (STEPS.index(name) if name in STEPS else -1):
                pill.configure(fg_color="#CCFBF1", text_color=_ACCENT_HOVER)
            else:
                pill.configure(fg_color=_LINE, text_color=_MUTED)
        if name != "wiring":
            self._stop_wiring_poll()
        if name != "account":
            self._stop_auth_poll()

    def _frame_boot(self):
        ctk = self.ctk
        f = ctk.CTkFrame(self.card, fg_color="transparent")
        ctk.CTkLabel(
            f,
            text="Starting Bioversee…",
            font=ctk.CTkFont(size=18, weight="bold"),
            text_color=_TEXT,
        ).pack(anchor="w", pady=(8, 4))
        ctk.CTkLabel(
            f,
            text="Loading your local setup.",
            text_color=_MUTED,
        ).pack(anchor="w")
        return f

    def _frame_project(self):
        ctk = self.ctk
        f = ctk.CTkFrame(self.card, fg_color="transparent")
        ctk.CTkLabel(
            f, text="Connect to Bioversee", font=ctk.CTkFont(size=20, weight="bold"), text_color=_TEXT
        ).pack(anchor="w")
        ctk.CTkLabel(
            f,
            text="Paste the same Supabase URL and anon key used by the web app "
            "(only needed if not baked into the installer).",
            text_color=_MUTED,
            wraplength=700,
            justify="left",
        ).pack(anchor="w", pady=(6, 16))
        ctk.CTkLabel(f, text="Supabase URL", text_color=_MUTED).pack(anchor="w")
        self.project_url = ctk.CTkEntry(f, height=40, placeholder_text="https://xxxx.supabase.co")
        self.project_url.pack(fill="x", pady=(4, 12))
        ctk.CTkLabel(f, text="Anon / publishable key", text_color=_MUTED).pack(anchor="w")
        self.project_key = ctk.CTkEntry(f, height=40, show="•")
        self.project_key.pack(fill="x", pady=(4, 16))
        ctk.CTkButton(
            f,
            text="Continue",
            height=42,
            fg_color=_ACCENT,
            hover_color=_ACCENT_HOVER,
            command=self._save_project,
        ).pack(anchor="w")
        return f

    def _frame_account(self):
        ctk = self.ctk
        f = ctk.CTkFrame(self.card, fg_color="transparent")
        ctk.CTkLabel(
            f, text="Sign in", font=ctk.CTkFont(size=20, weight="bold"), text_color=_TEXT
        ).pack(anchor="w")
        ctk.CTkLabel(
            f,
            text="Sign in or create an account in this app. No system browser required.",
            text_color=_MUTED,
            wraplength=700,
            justify="left",
        ).pack(anchor="w", pady=(6, 16))

        self.email = ctk.CTkEntry(f, height=42, placeholder_text="Email")
        self.email.pack(fill="x", pady=4)
        self.password = ctk.CTkEntry(f, height=42, placeholder_text="Password", show="•")
        self.password.pack(fill="x", pady=4)

        row = ctk.CTkFrame(f, fg_color="transparent")
        row.pack(fill="x", pady=(12, 8))
        ctk.CTkButton(
            row,
            text="Sign in",
            height=42,
            fg_color=_ACCENT,
            hover_color=_ACCENT_HOVER,
            font=ctk.CTkFont(size=15, weight="bold"),
            command=self._local_login,
        ).pack(side="left", padx=(0, 8))
        ctk.CTkButton(
            row,
            text="Create account",
            height=42,
            fg_color="transparent",
            border_width=1,
            border_color=_LINE,
            text_color=_ACCENT,
            hover_color="#E8F5F3",
            command=self._local_signup,
        ).pack(side="left")

        divider = ctk.CTkFrame(f, fg_color="transparent")
        divider.pack(fill="x", pady=(20, 12))
        ctk.CTkLabel(divider, text="or", text_color=_MUTED).pack()

        ctk.CTkButton(
            f,
            text="Continue with Google",
            height=44,
            fg_color=_TEXT,
            hover_color="#111",
            font=ctk.CTkFont(size=14, weight="bold"),
            command=self._google_login,
        ).pack(anchor="w")
        self.auth_wait = ctk.CTkLabel(f, text="", text_color=_ACCENT)
        self.auth_wait.pack(anchor="w", pady=(12, 0))
        return f

    def _frame_device(self):
        ctk = self.ctk
        f = ctk.CTkFrame(self.card, fg_color="transparent")
        head = ctk.CTkFrame(f, fg_color="transparent")
        head.pack(fill="x")
        ctk.CTkLabel(
            head, text="Your device", font=ctk.CTkFont(size=20, weight="bold"), text_color=_TEXT
        ).pack(side="left")
        ctk.CTkButton(
            head,
            text="Refresh",
            width=100,
            height=34,
            fg_color="transparent",
            border_width=1,
            border_color=_LINE,
            text_color=_ACCENT,
            hover_color="#E8F5F3",
            command=self._load_devices,
        ).pack(side="right")
        ctk.CTkLabel(
            f,
            text="Create a new bioreactor device or select one from your profile.",
            text_color=_MUTED,
        ).pack(anchor="w", pady=(6, 12))

        create = ctk.CTkFrame(f, fg_color="#F7FAF9", corner_radius=12)
        create.pack(fill="x", pady=(0, 14))
        ctk.CTkLabel(
            create,
            text="Create new device",
            text_color=_TEXT,
            font=ctk.CTkFont(size=14, weight="bold"),
        ).pack(anchor="w", padx=14, pady=(12, 6))
        create_row = ctk.CTkFrame(create, fg_color="transparent")
        create_row.pack(fill="x", padx=14, pady=(0, 14))
        self.new_device_name = ctk.CTkEntry(
            create_row, height=38, placeholder_text="Device name (e.g. Bench reactor 1)"
        )
        self.new_device_name.pack(side="left", fill="x", expand=True, padx=(0, 8))
        ctk.CTkButton(
            create_row,
            text="Create & continue",
            width=150,
            height=38,
            fg_color=_ACCENT,
            hover_color=_ACCENT_HOVER,
            command=self._create_device,
        ).pack(side="right")

        ctk.CTkLabel(
            f,
            text="Existing devices",
            text_color=_TEXT,
            font=ctk.CTkFont(size=14, weight="bold"),
        ).pack(anchor="w", pady=(4, 6))
        self.device_list = ctk.CTkScrollableFrame(f, fg_color="transparent")
        self.device_list.pack(fill="both", expand=True)
        return f

    def _frame_wiring(self):
        ctk = self.ctk
        f = ctk.CTkFrame(self.card, fg_color="transparent")
        ctk.CTkLabel(
            f, text="GPIO live status", font=ctk.CTkFont(size=20, weight="bold"), text_color=_TEXT
        ).pack(anchor="w")
        ctk.CTkLabel(
            f,
            text="All 40 pins update live: HIGH / LOW / idle. Detected sensors highlight automatically.",
            text_color=_MUTED,
        ).pack(anchor="w", pady=(4, 6))

        legend = ctk.CTkFrame(f, fg_color="transparent")
        legend.pack(fill="x", pady=(0, 8))
        for label, color in (
            ("HIGH", _HIGH),
            ("LOW", _LOW),
            ("Idle", _IDLE),
            ("Detect", _ACTIVE),
            ("Confirmed", _CONFIRMED),
            ("Power", _POWER),
            ("GND", _GND),
        ):
            chip = ctk.CTkLabel(
                legend,
                text=f" {label} ",
                corner_radius=6,
                fg_color=color,
                text_color="#111" if color in (_IDLE, _POWER, _HIGH) else "#fff",
                font=ctk.CTkFont(size=11, weight="bold"),
            )
            chip.pack(side="left", padx=(0, 6))

        grid = ctk.CTkFrame(f, fg_color="transparent")
        grid.pack(fill="both", expand=True)
        grid.grid_columnconfigure(0, weight=1)
        grid.grid_columnconfigure(1, weight=1)
        grid.grid_rowconfigure(0, weight=1)

        left = ctk.CTkFrame(grid, fg_color="#F7FAF9", corner_radius=12)
        left.grid(row=0, column=0, sticky="nsew", padx=(0, 8))
        ctk.CTkLabel(
            left, text="40-pin header", font=ctk.CTkFont(size=14, weight="bold"), text_color=_TEXT
        ).pack(anchor="w", padx=12, pady=(12, 6))
        self.header_board = ctk.CTkScrollableFrame(left, fg_color="transparent", height=360)
        self.header_board.pack(fill="both", expand=True, padx=8, pady=(0, 8))

        right = ctk.CTkFrame(grid, fg_color="transparent")
        right.grid(row=0, column=1, sticky="nsew", padx=(8, 0))
        ctk.CTkLabel(
            right, text="Detected", font=ctk.CTkFont(size=14, weight="bold"), text_color=_TEXT
        ).pack(anchor="w")
        self.guess_box = ctk.CTkScrollableFrame(right, fg_color="#F7FAF9", corner_radius=12, height=200)
        self.guess_box.pack(fill="both", expand=True, pady=(6, 10))
        ctk.CTkLabel(
            right, text="Confirmed", font=ctk.CTkFont(size=14, weight="bold"), text_color=_TEXT
        ).pack(anchor="w")
        self.confirmed_box = ctk.CTkScrollableFrame(right, fg_color="#F7FAF9", corner_radius=12, height=120)
        self.confirmed_box.pack(fill="both", expand=True, pady=(6, 10))

        tools = ctk.CTkFrame(f, fg_color="transparent")
        tools.pack(fill="x", pady=(8, 0))
        self.sim_row = ctk.CTkFrame(tools, fg_color="transparent")
        self.sim_row.pack(side="left")
        ctk.CTkButton(
            self.sim_row,
            text="Simulate temp",
            width=120,
            height=32,
            fg_color="transparent",
            border_width=1,
            border_color=_LINE,
            text_color=_MUTED,
            command=lambda: self._simulate("ds18b20"),
        ).pack(side="left", padx=(0, 6))
        ctk.CTkButton(
            self.sim_row,
            text="Simulate pH",
            width=110,
            height=32,
            fg_color="transparent",
            border_width=1,
            border_color=_LINE,
            text_color=_MUTED,
            command=lambda: self._simulate("ph_i2c"),
        ).pack(side="left")

        self.manual_menu = ctk.CTkOptionMenu(tools, values=["—"], width=180)
        self.manual_menu.pack(side="left", padx=(16, 6))
        ctk.CTkButton(
            tools,
            text="Add manually",
            width=120,
            height=32,
            fg_color="transparent",
            border_width=1,
            border_color=_LINE,
            text_color=_ACCENT,
            command=self._manual_add,
        ).pack(side="left")

        self.finish_btn = ctk.CTkButton(
            tools,
            text="Finish setup",
            height=36,
            fg_color=_ACCENT,
            hover_color=_ACCENT_HOVER,
            state="disabled",
            command=self._finish,
        )
        self.finish_btn.pack(side="right")
        return f

    def _frame_done(self):
        ctk = self.ctk
        f = ctk.CTkFrame(self.card, fg_color="transparent")
        ctk.CTkLabel(
            f, text="You're set", font=ctk.CTkFont(size=22, weight="bold"), text_color=_TEXT
        ).pack(anchor="w", pady=(8, 6))
        self.done_message = ctk.CTkLabel(f, text="", text_color=_MUTED, wraplength=700, justify="left")
        self.done_message.pack(anchor="w")
        self.done_detail = ctk.CTkTextbox(f, height=160, fg_color="#F7FAF9")
        self.done_detail.pack(fill="x", pady=(16, 0))
        return f

    def _show_boot(self) -> None:
        self._show("boot")
        _run_async(
            services.status(self.settings),
            on_ok=self._after_boot,
            on_err=lambda e: self._set_banner(str(e)),
        )

    def _after_boot(self, st: dict[str, Any]) -> None:
        self.root.after(0, lambda: self._route_from_status(st))

    def _route_from_status(self, st: dict[str, Any]) -> None:
        if st.get("version_display"):
            self.title_label.configure(text=f"Bioversee setup  {st['version_display']}")
        if not st.get("has_project"):
            if st.get("supabase_url"):
                self.project_url.insert(0, st["supabase_url"])
            self._show("project")
            return
        if not st.get("signed_in"):
            self._show("account")
            return
        local = st.get("local") or {}
        if not local.get("device_id") or not local.get("has_api_key"):
            self._show("device")
            self._load_devices()
            return
        self._enter_wiring(simulate=bool(st.get("simulate_gpio")))

    def _save_project(self) -> None:
        self._clear_banner()
        try:
            services.save_project(
                self.settings,
                self.project_url.get().strip(),
                self.project_key.get().strip(),
            )
        except Exception as exc:  # noqa: BLE001
            self._set_banner(str(exc))
            return
        self._show("account")

    def _google_login(self) -> None:
        self._clear_banner()
        try:
            services.start_oauth_login(self.settings)
        except Exception as exc:  # noqa: BLE001
            self._set_banner(str(exc))
            return
        self.auth_wait.configure(
            text="Complete Google sign-in in the window that opened… (keep this app open)"
        )
        self._start_auth_poll()

    def _start_auth_poll(self) -> None:
        self._stop_auth_poll()

        def tick() -> None:
            _run_async(
                services.status(self.settings),
                on_ok=lambda st: self.root.after(0, lambda: self._auth_tick(st)),
                on_err=lambda _e: None,
            )
            self._auth_poll_job = self.root.after(1500, tick)

        self._auth_poll_job = self.root.after(400, tick)

    def _auth_tick(self, st: dict[str, Any]) -> None:
        if st.get("signed_in"):
            self._stop_auth_poll()
            oauth_webview.close_oauth_window()
            self.auth_wait.configure(text="")
            self._show("device")
            self._load_devices()

    def _stop_auth_poll(self) -> None:
        if self._auth_poll_job:
            self.root.after_cancel(self._auth_poll_job)
            self._auth_poll_job = None

    def _local_login(self) -> None:
        self._clear_banner()
        email = self.email.get().strip()
        password = self.password.get()
        if not email or not password:
            self._set_banner("Enter email and password.")
            return
        _run_async(
            services.sign_in(self.settings, email, password),
            on_ok=lambda _r: self.root.after(0, lambda: (self._show("device"), self._load_devices())),
            on_err=lambda e: self.root.after(0, lambda: self._set_banner(str(e))),
        )

    def _local_signup(self) -> None:
        self._clear_banner()
        email = self.email.get().strip()
        password = self.password.get()
        if not email or not password:
            self._set_banner("Enter email and password.")
            return

        def ok(data: dict[str, Any]) -> None:
            if data.get("needs_confirmation"):
                self._set_banner("Check your email to confirm, then sign in.")
                return
            self._show("device")
            self._load_devices()

        _run_async(
            services.sign_up(self.settings, email, password),
            on_ok=lambda d: self.root.after(0, lambda: ok(d)),
            on_err=lambda e: self.root.after(0, lambda: self._set_banner(str(e))),
        )

    def _load_devices(self) -> None:
        self._clear_banner()
        for child in self.device_list.winfo_children():
            child.destroy()
        self.ctk.CTkLabel(self.device_list, text="Loading…", text_color=_MUTED).pack(anchor="w")

        def ok(rows: list[dict[str, Any]]) -> None:
            self.devices = rows
            self.root.after(0, self._render_devices)

        def err(exc: Exception) -> None:
            msg = str(exc)
            if isinstance(exc, DevicesError):
                msg = str(exc)
            self.root.after(0, lambda: self._set_banner(msg))

        _run_async(services.list_devices(self.settings), on_ok=ok, on_err=err)

    def _render_devices(self) -> None:
        for child in self.device_list.winfo_children():
            child.destroy()
        if not self.devices:
            self.ctk.CTkLabel(
                self.device_list,
                text="No devices yet — create one above.",
                text_color=_MUTED,
                wraplength=640,
                justify="left",
            ).pack(anchor="w", pady=8)
            return
        for device in self.devices:
            btn = self.ctk.CTkButton(
                self.device_list,
                text=f"{device.get('name')}\n{device.get('type')} · {device.get('role')}",
                anchor="w",
                height=64,
                fg_color="#F7FAF9",
                text_color=_TEXT,
                hover_color="#E8F5F3",
                border_width=1,
                border_color=_LINE,
                command=lambda d=device: self._select_device(d),
            )
            btn.pack(fill="x", pady=5)

    def _create_device(self) -> None:
        self._clear_banner()
        name = self.new_device_name.get().strip()
        if not name:
            self._set_banner("Enter a device name.")
            return
        _run_async(
            services.create_device(self.settings, name=name, device_type="bioreactor"),
            on_ok=lambda _r: self.root.after(
                0,
                lambda: self._enter_wiring(simulate=_probe_simulate()),
            ),
            on_err=lambda e: self.root.after(0, lambda: self._set_banner(str(e))),
        )

    def _select_device(self, device: dict[str, Any]) -> None:
        self._clear_banner()
        _run_async(
            services.select_device(
                self.settings,
                device_id=str(device["id"]),
                device_name=device.get("name"),
                device_type=device.get("type"),
            ),
            on_ok=lambda _r: self.root.after(
                0,
                lambda: self._enter_wiring(simulate=_probe_simulate()),
            ),
            on_err=lambda e: self.root.after(0, lambda: self._set_banner(str(e))),
        )

    def _enter_wiring(self, *, simulate: bool) -> None:
        data = services.gpio_header()
        self.pins = data.get("pins") or []
        self.catalog = data.get("catalog") or []
        labels = [f"{c['label']}" for c in self.catalog] or ["—"]
        self._catalog_by_label = {c["label"]: c["id"] for c in self.catalog}
        self.manual_menu.configure(values=labels)
        self.manual_menu.set(labels[0])
        if simulate:
            self.sim_row.pack(side="left")
        else:
            self.sim_row.pack_forget()
        self._build_header_board()
        self._show("wiring")
        self._start_wiring_poll()

    def _build_header_board(self) -> None:
        for child in self.header_board.winfo_children():
            child.destroy()
        self._pin_labels.clear()
        by_row: dict[int, list[dict[str, Any] | None]] = {}
        for pin in self.pins:
            row = int(pin.get("row", (pin["physical"] - 1) // 2))
            col = int(pin.get("col", 0 if pin["physical"] % 2 == 1 else 1))
            by_row.setdefault(row, [None, None])
            by_row[row][col] = pin

        for row in sorted(by_row):
            line = self.ctk.CTkFrame(self.header_board, fg_color="transparent")
            line.pack(fill="x", pady=1)
            for col in (0, 1):
                pin = by_row[row][col]
                if not pin:
                    continue
                kind = pin.get("kind")
                if kind in ("5v", "3v3"):
                    color = _POWER
                    text = "#111"
                elif kind == "gnd":
                    color = _GND
                    text = "#fff"
                else:
                    color = _IDLE
                    text = "#111"
                lbl = self.ctk.CTkLabel(
                    line,
                    text=f" {pin['physical']:2d}  {pin['label']} ",
                    width=150,
                    height=22,
                    corner_radius=6,
                    fg_color=color,
                    text_color=text,
                    font=self.ctk.CTkFont(size=11),
                    anchor="w",
                )
                lbl.pack(side="left", padx=2)
                self._pin_labels[int(pin["physical"])] = (lbl, kind)

    def _paint_pins(
        self,
        *,
        pin_levels: dict[str, str] | dict[int, str],
        active: list[int],
        confirmed: list[int],
    ) -> None:
        active_set = set(active)
        confirmed_set = set(confirmed)
        for physical, (lbl, kind) in self._pin_labels.items():
            level = pin_levels.get(physical) or pin_levels.get(str(physical)) or "idle"
            if kind in ("5v", "3v3"):
                base, text = _POWER, "#111"
            elif kind == "gnd":
                base, text = _GND, "#fff"
            elif kind == "id":
                base, text = _UNKNOWN, "#111"
            elif level == "high":
                base, text = _HIGH, "#111"
            elif level == "low":
                base, text = _LOW, "#fff"
            elif level == "busy":
                base, text = _BUSY, "#fff"
            elif level == "unknown":
                base, text = _UNKNOWN, "#111"
            else:
                base, text = _IDLE, "#111"

            # Overlay detection / confirmation on top of live electrical state.
            if physical in confirmed_set:
                base, text = _CONFIRMED, "#fff"
            elif physical in active_set:
                base, text = _ACTIVE, "#fff"
            lbl.configure(fg_color=base, text_color=text)

    def _start_wiring_poll(self) -> None:
        self._stop_wiring_poll()

        def tick() -> None:
            _run_async(
                services.gpio_state(),
                on_ok=lambda st: self.root.after(0, lambda: self._render_wiring_state(st)),
                on_err=lambda e: self.root.after(0, lambda: self._set_banner(str(e))),
            )
            self._poll_job = self.root.after(800, tick)

        self._poll_job = self.root.after(200, tick)

    def _stop_wiring_poll(self) -> None:
        if self._poll_job:
            self.root.after_cancel(self._poll_job)
            self._poll_job = None

    def _stop_polls(self) -> None:
        self._stop_wiring_poll()
        self._stop_auth_poll()

    def _render_wiring_state(self, st: dict[str, Any]) -> None:
        levels_raw = st.get("pin_levels") or {}
        levels: dict[int, str] = {}
        for key, value in levels_raw.items():
            try:
                levels[int(key)] = str(value)
            except (TypeError, ValueError):
                continue
        self._paint_pins(
            pin_levels=levels,
            active=st.get("active_physical") or [],
            confirmed=st.get("confirmed_physical") or [],
        )
        for child in self.guess_box.winfo_children():
            child.destroy()
        pending = st.get("pending") or []
        if not pending:
            self.ctk.CTkLabel(
                self.guess_box, text="Waiting for a connection…", text_color=_MUTED
            ).pack(anchor="w", padx=8, pady=8)
        for guess in pending:
            card = self.ctk.CTkFrame(self.guess_box, fg_color=_CARD, corner_radius=10)
            card.pack(fill="x", padx=6, pady=6)
            self.ctk.CTkLabel(
                card,
                text=f"Is this a {guess.get('label')}?",
                font=self.ctk.CTkFont(size=13, weight="bold"),
                text_color=_TEXT,
            ).pack(anchor="w", padx=10, pady=(8, 2))
            self.ctk.CTkLabel(
                card,
                text=f"{guess.get('detail')} · {int((guess.get('confidence') or 0) * 100)}%",
                text_color=_MUTED,
                wraplength=320,
                justify="left",
            ).pack(anchor="w", padx=10)
            labels = [c["label"] for c in self.catalog] or [guess.get("label") or "—"]
            menu = self.ctk.CTkOptionMenu(card, values=labels, width=200)
            preferred = next(
                (c["label"] for c in self.catalog if c["id"] == guess.get("id")),
                labels[0],
            )
            menu.set(preferred)
            menu.pack(anchor="w", padx=10, pady=6)
            row = self.ctk.CTkFrame(card, fg_color="transparent")
            row.pack(fill="x", padx=10, pady=(0, 10))
            self.ctk.CTkButton(
                row,
                text="Confirm",
                width=100,
                height=30,
                fg_color=_ACCENT,
                hover_color=_ACCENT_HOVER,
                command=lambda g=guess, m=menu: self._confirm_guess(g, m.get()),
            ).pack(side="left", padx=(0, 6))
            self.ctk.CTkButton(
                row,
                text="Ignore",
                width=80,
                height=30,
                fg_color="transparent",
                border_width=1,
                border_color=_LINE,
                text_color=_MUTED,
                command=lambda g=guess: self._ignore_guess(g),
            ).pack(side="left")

        for child in self.confirmed_box.winfo_children():
            child.destroy()
        confirmed = st.get("confirmed") or []
        for w in confirmed:
            self.ctk.CTkLabel(
                self.confirmed_box,
                text=(
                    f"{w.get('name')} · {w.get('driver')} · "
                    f"BCM {w.get('bcm') if w.get('bcm') is not None else '—'} · "
                    f"pins {', '.join(map(str, w.get('physical') or []))}"
                ),
                text_color=_TEXT,
                anchor="w",
            ).pack(fill="x", padx=8, pady=3)
        self.finish_btn.configure(state="normal" if confirmed else "disabled")

    def _confirm_guess(self, guess: dict[str, Any], label: str) -> None:
        peripheral_id = self._catalog_by_label.get(label) or guess.get("id")
        try:
            services.gpio_confirm(str(guess["event_id"]), peripheral_id)
        except Exception as exc:  # noqa: BLE001
            self._set_banner(str(exc))

    def _ignore_guess(self, guess: dict[str, Any]) -> None:
        try:
            services.gpio_ignore(str(guess["event_id"]))
        except Exception as exc:  # noqa: BLE001
            self._set_banner(str(exc))

    def _simulate(self, peripheral_id: str) -> None:
        try:
            services.gpio_simulate(peripheral_id)
        except Exception as exc:  # noqa: BLE001
            self._set_banner(str(exc))

    def _manual_add(self) -> None:
        label = self.manual_menu.get()
        peripheral_id = self._catalog_by_label.get(label)
        if not peripheral_id:
            return
        try:
            services.gpio_manual(peripheral_id)
        except Exception as exc:  # noqa: BLE001
            self._set_banner(str(exc))

    def _finish(self) -> None:
        self._clear_banner()
        _run_async(
            services.finish_setup(self.settings),
            on_ok=lambda data: self.root.after(0, lambda: self._show_done(data)),
            on_err=lambda e: self.root.after(0, lambda: self._set_banner(str(e))),
        )

    def _show_done(self, data: dict[str, Any]) -> None:
        self._stop_wiring_poll()
        agent = data.get("agent") or {}
        if agent.get("enabled"):
            msg = "Monitoring will start automatically when this Pi boots. Control this device from the Bioversee website."
        else:
            msg = agent.get("message") or "Setup saved. Enable the agent service manually."
        self.done_message.configure(text=msg)
        self.done_detail.delete("1.0", tk.END)
        detail = {
            "config_path": data.get("config_path"),
            "agent": agent,
            "cloud_error": data.get("cloud_error"),
        }
        self.done_detail.insert("1.0", str(detail))
        self._show("done")


def _probe_simulate() -> bool:
    from bioversee_pi.gpio.probe import probe_service

    return bool(probe_service.simulate)


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    import os

    from bioversee_pi.config import bootstrap_env_from_system

    bootstrap_env_from_system()

    if not (os.environ.get("DISPLAY") or os.environ.get("WAYLAND_DISPLAY")):
        raise SystemExit(
            "No display available. Bioversee is a desktop app — "
            "open it from the Raspberry Pi desktop, not over SSH without X."
        )
    WizardApp().run()


if __name__ == "__main__":
    main()
