"""Native Bioversee setup wizard (CustomTkinter — real desktop window, not a browser)."""

from __future__ import annotations

import asyncio
import logging
import threading
import tkinter as tk
from pathlib import Path
from typing import Any, Callable

from bioversee_pi.devices import DevicesError
from bioversee_pi.i18n import LANGUAGE_OPTIONS, AppLanguage, normalize_language, t
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


def _run_sync(fn: Callable[[], Any], on_ok: Callable[[Any], None], on_err: Callable[[Exception], None]) -> None:
    def worker() -> None:
        try:
            result = fn()
        except Exception as exc:  # noqa: BLE001
            on_err(exc)
            return
        on_ok(result)

    threading.Thread(target=worker, name="bioversee-sync", daemon=True).start()


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


def _resolve_logo_path() -> Path | None:
    candidates = [
        Path(__file__).resolve().parents[2] / "packaging" / "bioversee.png",
        Path("/opt/bioversee-pi/packaging/bioversee.png"),
        Path("/usr/share/pixmaps/bioversee.png"),
        Path("/usr/share/icons/hicolor/48x48/apps/bioversee.png"),
    ]
    for path in candidates:
        if path.is_file():
            return path
    return None


def _account_icon_image(ctk_module, *, size: int = 40):
    """Simple account placeholder icon (person silhouette on teal)."""
    try:
        from PIL import Image, ImageDraw
    except ImportError:
        return None
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.ellipse((0, 0, size - 1, size - 1), fill=_ACCENT)
    # Head
    head_r = size * 0.16
    cx, cy = size / 2, size * 0.36
    draw.ellipse(
        (cx - head_r, cy - head_r, cx + head_r, cy + head_r),
        fill="#FFFFFF",
    )
    # Shoulders
    body_top = size * 0.52
    draw.ellipse(
        (size * 0.22, body_top, size * 0.78, size * 1.15),
        fill="#FFFFFF",
    )
    return ctk_module.CTkImage(light_image=img, dark_image=img, size=(size, size))


class WizardApp:
    def __init__(self) -> None:
        self.ctk = _try_import_ctk()
        self.ctk.set_appearance_mode("light")
        self.ctk.set_default_color_theme("green")

        self.settings = services.load_settings()
        self.lang: AppLanguage = normalize_language(services.get_language())
        self.user_email: str | None = None

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
        self._logo_image = None
        self._profile_menu: Any | None = None
        self._settings_win: Any | None = None
        self._version_display = display_version()

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
        self.root.bind("<Button-1>", self._on_root_click, add="+")

        self._build_shell()
        self._show_boot()

    def _tr(self, key: str, **kwargs: object) -> str:
        return t(key, self.lang, **kwargs)

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

    def _on_root_click(self, event: Any) -> None:
        if self._profile_menu is None:
            return
        widget = event.widget
        try:
            if str(widget).startswith(str(self._profile_menu)):
                return
            if str(widget).startswith(str(self.avatar_btn)):
                return
        except Exception:  # noqa: BLE001
            pass
        self._close_profile_menu()

    def _build_shell(self) -> None:
        ctk = self.ctk
        top = ctk.CTkFrame(self.root, fg_color="transparent")
        top.pack(fill="x", padx=28, pady=(22, 8))

        brand = ctk.CTkFrame(top, fg_color="transparent")
        brand.pack(side="left")
        self._logo_image = self._load_logo_image()
        if self._logo_image is not None:
            logo = ctk.CTkLabel(brand, text="", image=self._logo_image, width=40, height=40)
            logo.pack(side="left", padx=(0, 12))
        else:
            mark = ctk.CTkFrame(brand, width=40, height=40, corner_radius=12, fg_color=_ACCENT)
            mark.pack(side="left", padx=(0, 12))
            mark.pack_propagate(False)
        titles = ctk.CTkFrame(brand, fg_color="transparent")
        titles.pack(side="left")
        self.eyebrow = ctk.CTkLabel(
            titles,
            text=self._tr("raspberry_pi"),
            text_color=_MUTED,
            font=ctk.CTkFont(size=11, weight="bold"),
        )
        self.eyebrow.pack(anchor="w")
        self.title_label = ctk.CTkLabel(
            titles,
            text=f"{self._tr('setup_title')}  {self._version_display}",
            text_color=_TEXT,
            font=ctk.CTkFont(size=22, weight="bold"),
        )
        self.title_label.pack(anchor="w")

        right = ctk.CTkFrame(top, fg_color="transparent")
        right.pack(side="right")

        steps_wrap = ctk.CTkFrame(right, fg_color="transparent")
        steps_wrap.pack(side="left", padx=(0, 12))
        self.step_row = ctk.CTkFrame(steps_wrap, fg_color="transparent")
        self.step_row.pack(anchor="e")
        self.step_hint = ctk.CTkLabel(
            steps_wrap,
            text="",
            text_color=_MUTED,
            font=ctk.CTkFont(size=11),
            anchor="e",
        )
        self.step_hint.pack(anchor="e", pady=(4, 0))
        self.step_pills: dict[str, Any] = {}
        for i, name in enumerate(STEPS):
            cell = ctk.CTkFrame(self.step_row, fg_color="transparent")
            cell.pack(side="left")
            if i > 0:
                ctk.CTkLabel(
                    cell,
                    text="›",
                    text_color=_LINE,
                    font=ctk.CTkFont(size=14, weight="bold"),
                    width=14,
                ).pack(side="left", padx=(0, 2))
            pill = ctk.CTkLabel(
                cell,
                text=self._tr(f"step_{name}"),
                corner_radius=999,
                fg_color=_LINE,
                text_color=_MUTED,
                padx=10,
                pady=4,
                font=ctk.CTkFont(size=12, weight="bold"),
            )
            pill.pack(side="left", padx=2)
            self.step_pills[name] = pill

        self._account_icon = _account_icon_image(ctk)
        self.avatar_btn = ctk.CTkButton(
            right,
            text="" if self._account_icon else "👤",
            image=self._account_icon,
            width=40,
            height=40,
            corner_radius=20,
            fg_color="transparent",
            hover_color="#E8F5F3",
            text_color=_ACCENT,
            font=ctk.CTkFont(size=18),
            command=self._toggle_profile_menu,
        )
        self.avatar_btn.pack(side="left")

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

        # Sticky wiring footer — always visible at bottom of the card
        self.wiring_footer = ctk.CTkFrame(self.card, fg_color="transparent")
        self.wiring_footer.pack(side="bottom", fill="x", padx=24, pady=(0, 18))
        self._build_wiring_footer()

        self.content = ctk.CTkFrame(self.card, fg_color="transparent")
        self.content.pack(fill="both", expand=True)

        self.frames: dict[str, Any] = {}
        self.frames["boot"] = self._frame_boot()
        self.frames["project"] = self._frame_project()
        self.frames["account"] = self._frame_account()
        self.frames["device"] = self._frame_device()
        self.frames["wiring"] = self._frame_wiring()
        self.frames["done"] = self._frame_done()

    def _load_logo_image(self):
        path = _resolve_logo_path()
        if path is None:
            log.warning("Bioversee logo not found — using placeholder")
            return None
        try:
            from PIL import Image

            img = Image.open(path)
            return self.ctk.CTkImage(light_image=img, dark_image=img, size=(40, 40))
        except Exception as exc:  # noqa: BLE001
            log.warning("Could not load logo from %s: %s", path, exc)
            return None

    def _build_wiring_footer(self) -> None:
        ctk = self.ctk
        for child in self.wiring_footer.winfo_children():
            child.destroy()

        self.sim_row = ctk.CTkFrame(self.wiring_footer, fg_color="transparent")
        self.sim_row.pack(side="left")
        ctk.CTkButton(
            self.sim_row,
            text=self._tr("simulate_temp"),
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
            text=self._tr("simulate_ph"),
            width=110,
            height=32,
            fg_color="transparent",
            border_width=1,
            border_color=_LINE,
            text_color=_MUTED,
            command=lambda: self._simulate("ph_i2c"),
        ).pack(side="left")
        self.sim_row.pack_forget()

        self.manual_menu = ctk.CTkOptionMenu(self.wiring_footer, values=["—"], width=180)
        self.manual_menu.pack(side="left", padx=(0, 6))
        self.add_manual_btn = ctk.CTkButton(
            self.wiring_footer,
            text=self._tr("add_manually"),
            width=120,
            height=32,
            fg_color="transparent",
            border_width=1,
            border_color=_LINE,
            text_color=_ACCENT,
            command=self._manual_add,
        )
        self.add_manual_btn.pack(side="left")

        self.finish_btn = ctk.CTkButton(
            self.wiring_footer,
            text=self._tr("finish_setup"),
            height=36,
            fg_color=_ACCENT,
            hover_color=_ACCENT_HOVER,
            state="disabled",
            command=self._finish,
        )
        self.finish_btn.pack(side="right")

    def _clear_banner(self) -> None:
        self.banner.configure(text="")

    def _set_banner(self, message: str) -> None:
        self.banner.configure(text=message or "")

    def _update_avatar(self) -> None:
        # Keep a stable account placeholder icon (no initials).
        if self._account_icon is not None:
            self.avatar_btn.configure(text="", image=self._account_icon)
        else:
            self.avatar_btn.configure(text="👤", image=None)

    def _show(self, name: str) -> None:
        self.step = name
        for frame in self.frames.values():
            frame.pack_forget()
        self.frames[name].pack(fill="both", expand=True, padx=24, pady=22)
        step_index = STEPS.index(name) if name in STEPS else -1
        for key, pill in self.step_pills.items():
            key_index = STEPS.index(key)
            if key == name:
                pill.configure(fg_color=_ACCENT, text_color="#FFFFFF")
            elif key_index < step_index:
                # Completed steps
                pill.configure(fg_color="#CCFBF1", text_color=_ACCENT_HOVER)
            else:
                pill.configure(fg_color=_LINE, text_color=_MUTED)
        if name in STEPS:
            self.step_hint.configure(text=self._tr(f"step_{name}_hint"))
        else:
            self.step_hint.configure(text="")
        # Footer stays packed; enable tools only on wiring
        wiring_state = "normal" if name == "wiring" else "disabled"
        try:
            self.manual_menu.configure(state=wiring_state)
            self.add_manual_btn.configure(state=wiring_state)
            if name != "wiring":
                self.finish_btn.configure(state="disabled")
        except Exception:  # noqa: BLE001
            pass
        if name != "wiring":
            self._stop_wiring_poll()
            self.sim_row.pack_forget()
        if name != "account":
            self._stop_auth_poll()

    def _apply_language(self) -> None:
        self.eyebrow.configure(text=self._tr("raspberry_pi"))
        self.title_label.configure(
            text=f"{self._tr('setup_title')}  {self._version_display}"
        )
        for name, pill in self.step_pills.items():
            pill.configure(text=self._tr(f"step_{name}"))
        if self.step in STEPS:
            self.step_hint.configure(text=self._tr(f"step_{self.step}_hint"))
        self.add_manual_btn.configure(text=self._tr("add_manually"))
        self.finish_btn.configure(text=self._tr("finish_setup"))
        # Rebuild step frames so static copy updates
        current = self.step
        for frame in self.frames.values():
            frame.destroy()
        self.frames["boot"] = self._frame_boot()
        self.frames["project"] = self._frame_project()
        self.frames["account"] = self._frame_account()
        self.frames["device"] = self._frame_device()
        self.frames["wiring"] = self._frame_wiring()
        self.frames["done"] = self._frame_done()
        # Rebuild footer sim buttons with new labels
        was_sim = bool(self.sim_row.winfo_ismapped())
        menu_values = list(self.manual_menu.cget("values") or ["—"])
        menu_value = self.manual_menu.get()
        finish_state = str(self.finish_btn.cget("state"))
        self._build_wiring_footer()
        if menu_values:
            self.manual_menu.configure(values=menu_values)
            if menu_value in menu_values:
                self.manual_menu.set(menu_value)
            else:
                self.manual_menu.set(menu_values[0])
        self.finish_btn.configure(state=finish_state)
        if was_sim:
            self.sim_row.pack(side="left")
        if current == "wiring" and self.pins:
            self._build_header_board()
        self._show(current)
        if current == "wiring":
            self._start_wiring_poll()
        if current == "device":
            self._load_devices()

    def _toggle_profile_menu(self) -> None:
        if self._profile_menu is not None:
            self._close_profile_menu()
            return
        ctk = self.ctk
        menu = ctk.CTkToplevel(self.root)
        menu.withdraw()
        menu.overrideredirect(True)
        menu.attributes("-topmost", True)
        menu.configure(fg_color=_CARD)
        frame = ctk.CTkFrame(
            menu,
            fg_color=_CARD,
            corner_radius=12,
            border_width=1,
            border_color=_LINE,
        )
        frame.pack(fill="both", expand=True, padx=1, pady=1)

        email = self.user_email or self._tr("not_signed_in")
        ctk.CTkLabel(
            frame,
            text=email,
            text_color=_TEXT,
            font=ctk.CTkFont(size=13, weight="bold"),
            anchor="w",
            wraplength=220,
            justify="left",
        ).pack(fill="x", padx=14, pady=(12, 8))

        ctk.CTkButton(
            frame,
            text=self._tr("settings"),
            height=34,
            fg_color="transparent",
            text_color=_TEXT,
            hover_color="#E8F5F3",
            anchor="w",
            command=lambda: (self._close_profile_menu(), self._open_settings()),
        ).pack(fill="x", padx=8, pady=2)

        ctk.CTkButton(
            frame,
            text=self._tr("log_out"),
            height=34,
            fg_color="transparent",
            text_color=_DANGER,
            hover_color="#FCEBEA",
            anchor="w",
            command=self._logout,
        ).pack(fill="x", padx=8, pady=(2, 10))

        self.root.update_idletasks()
        ax = self.avatar_btn.winfo_rootx()
        ay = self.avatar_btn.winfo_rooty() + self.avatar_btn.winfo_height() + 6
        width = 240
        menu.geometry(f"{width}x150+{ax + self.avatar_btn.winfo_width() - width}+{ay}")
        menu.deiconify()
        self._profile_menu = menu

    def _close_profile_menu(self) -> None:
        if self._profile_menu is not None:
            try:
                self._profile_menu.destroy()
            except Exception:  # noqa: BLE001
                pass
            self._profile_menu = None

    def _logout(self) -> None:
        self._close_profile_menu()
        services.logout()
        self.user_email = None
        self._update_avatar()
        self._set_banner(self._tr("signed_out"))
        self._show("account")

    def _open_settings(self) -> None:
        if self._settings_win is not None:
            try:
                self._settings_win.lift()
                self._settings_win.focus()
                return
            except Exception:  # noqa: BLE001
                self._settings_win = None

        ctk = self.ctk
        win = ctk.CTkToplevel(self.root)
        win.title(self._tr("settings"))
        win.geometry("460x620")
        win.minsize(420, 520)
        win.configure(fg_color=_BG)
        win.transient(self.root)
        win.grab_set()
        self._settings_win = win

        def on_close() -> None:
            self._settings_win = None
            win.destroy()

        win.protocol("WM_DELETE_WINDOW", on_close)

        body = ctk.CTkScrollableFrame(win, fg_color="transparent")
        body.pack(fill="both", expand=True, padx=20, pady=16)

        ctk.CTkLabel(
            body,
            text=self._tr("settings"),
            font=ctk.CTkFont(size=20, weight="bold"),
            text_color=_TEXT,
        ).pack(anchor="w", pady=(0, 12))

        # Language
        ctk.CTkLabel(
            body,
            text=self._tr("language"),
            font=ctk.CTkFont(size=14, weight="bold"),
            text_color=_TEXT,
        ).pack(anchor="w")
        lang_labels = [f"{native} ({label})" for _code, label, native in LANGUAGE_OPTIONS]
        lang_by_label = {
            f"{native} ({label})": code for code, label, native in LANGUAGE_OPTIONS
        }
        current_label = next(
            (f"{native} ({label})" for code, label, native in LANGUAGE_OPTIONS if code == self.lang),
            lang_labels[0],
        )
        lang_menu = ctk.CTkOptionMenu(body, values=lang_labels, width=280)
        lang_menu.set(current_label)
        lang_menu.pack(anchor="w", pady=(6, 16))

        def on_lang(choice: str) -> None:
            code = lang_by_label.get(choice, "en")
            services.set_language(code)
            self.lang = normalize_language(code)
            on_close()
            self._apply_language()
            self._open_settings()

        lang_menu.configure(command=on_lang)

        # Updates
        ctk.CTkLabel(
            body,
            text=self._tr("updates"),
            font=ctk.CTkFont(size=14, weight="bold"),
            text_color=_TEXT,
        ).pack(anchor="w")
        update_status = ctk.CTkLabel(body, text="", text_color=_MUTED, wraplength=400, justify="left")
        update_status.pack(anchor="w", pady=(4, 8))
        update_row = ctk.CTkFrame(body, fg_color="transparent")
        update_row.pack(fill="x", pady=(0, 16))
        update_btn = ctk.CTkButton(
            update_row,
            text=self._tr("update_now"),
            height=34,
            fg_color=_ACCENT,
            hover_color=_ACCENT_HOVER,
            state="disabled",
            width=130,
        )
        check_btn = ctk.CTkButton(
            update_row,
            text=self._tr("check_updates"),
            height=34,
            fg_color="transparent",
            border_width=1,
            border_color=_LINE,
            text_color=_ACCENT,
            width=150,
        )
        check_btn.pack(side="left", padx=(0, 8))
        update_btn.pack(side="left")

        def do_check() -> None:
            check_btn.configure(state="disabled", text=self._tr("checking"))
            update_status.configure(text="")

            def ok(result: dict[str, Any]) -> None:
                def apply() -> None:
                    check_btn.configure(state="normal", text=self._tr("check_updates"))
                    if not result.get("ok"):
                        update_status.configure(
                            text=str(result.get("error") or self._tr("update_failed")),
                            text_color=_DANGER,
                        )
                        update_btn.configure(state="disabled")
                        return
                    if result.get("update_available"):
                        update_status.configure(
                            text=self._tr(
                                "update_available",
                                remote=result.get("remote_display"),
                                current=result.get("current_display"),
                            ),
                            text_color=_ACCENT,
                        )
                        update_btn.configure(state="normal")
                    else:
                        update_status.configure(
                            text=self._tr(
                                "up_to_date",
                                version=result.get("current_display") or self._version_display,
                            ),
                            text_color=_MUTED,
                        )
                        update_btn.configure(state="disabled")

                win.after(0, apply)

            def err(exc: Exception) -> None:
                win.after(
                    0,
                    lambda: (
                        check_btn.configure(state="normal", text=self._tr("check_updates")),
                        update_status.configure(text=str(exc), text_color=_DANGER),
                    ),
                )

            _run_sync(lambda: services.update_status(self.settings), on_ok=ok, on_err=err)

        def do_update() -> None:
            update_btn.configure(state="disabled", text=self._tr("updating"))
            check_btn.configure(state="disabled")

            def ok(result: dict[str, Any]) -> None:
                def apply() -> None:
                    update_btn.configure(text=self._tr("update_now"))
                    check_btn.configure(state="normal")
                    msg = result.get("message") or "OK"
                    update_status.configure(text=str(msg), text_color=_ACCENT)
                    if result.get("current_display"):
                        self._version_display = str(result["current_display"])
                        self.title_label.configure(
                            text=f"{self._tr('setup_title')}  {self._version_display}"
                        )

                win.after(0, apply)

            def err(exc: Exception) -> None:
                win.after(
                    0,
                    lambda: (
                        update_btn.configure(state="normal", text=self._tr("update_now")),
                        check_btn.configure(state="normal"),
                        update_status.configure(text=str(exc), text_color=_DANGER),
                    ),
                )

            _run_sync(lambda: services.update_apply(self.settings), on_ok=ok, on_err=err)

        check_btn.configure(command=do_check)
        update_btn.configure(command=do_update)

        # Agent service
        ctk.CTkLabel(
            body,
            text=self._tr("agent_service"),
            font=ctk.CTkFont(size=14, weight="bold"),
            text_color=_TEXT,
        ).pack(anchor="w")
        service_status = ctk.CTkLabel(body, text="", text_color=_MUTED)
        service_status.pack(anchor="w", pady=(4, 8))
        svc_row = ctk.CTkFrame(body, fg_color="transparent")
        svc_row.pack(fill="x", pady=(0, 8))
        start_btn = ctk.CTkButton(
            svc_row,
            text=self._tr("start_service"),
            height=34,
            width=100,
            fg_color=_ACCENT,
            hover_color=_ACCENT_HOVER,
        )
        stop_btn = ctk.CTkButton(
            svc_row,
            text=self._tr("stop_service"),
            height=34,
            width=100,
            fg_color="transparent",
            border_width=1,
            border_color=_LINE,
            text_color=_TEXT,
        )
        start_btn.pack(side="left", padx=(0, 8))
        stop_btn.pack(side="left")

        def refresh_service(st: dict[str, Any] | None = None) -> None:
            data = st or services.agent_service_status()
            if not data.get("installed"):
                label = self._tr("service_missing")
            elif data.get("active"):
                label = self._tr("service_running")
            elif data.get("state") in ("inactive", "failed", "dead"):
                label = self._tr("service_stopped")
            else:
                label = f"{self._tr('service_unknown')} ({data.get('state')})"
            service_status.configure(text=label)
            installed = bool(data.get("installed"))
            start_btn.configure(state="normal" if installed and not data.get("active") else "disabled")
            stop_btn.configure(state="normal" if installed and data.get("active") else "disabled")

        def svc_action(fn: Callable[[], dict[str, Any]]) -> None:
            start_btn.configure(state="disabled")
            stop_btn.configure(state="disabled")
            service_status.configure(text=self._tr("working"))

            def ok(result: dict[str, Any]) -> None:
                win.after(0, lambda: refresh_service(result))

            def err(exc: Exception) -> None:
                win.after(
                    0,
                    lambda: (
                        service_status.configure(text=str(exc), text_color=_DANGER),
                        refresh_service(),
                    ),
                )

            _run_sync(fn, on_ok=ok, on_err=err)

        start_btn.configure(command=lambda: svc_action(services.agent_service_start))
        stop_btn.configure(command=lambda: svc_action(services.agent_service_stop))
        refresh_service()

        # Danger zone
        ctk.CTkLabel(
            body,
            text=self._tr("danger_zone"),
            font=ctk.CTkFont(size=14, weight="bold"),
            text_color=_DANGER,
        ).pack(anchor="w", pady=(12, 6))

        def confirm_action(message: str, action: Callable[[], dict[str, Any]], after: Callable[[], None]) -> None:
            dialog = ctk.CTkToplevel(win)
            dialog.title(self._tr("confirm"))
            dialog.geometry("420x220")
            dialog.configure(fg_color=_BG)
            dialog.transient(win)
            dialog.grab_set()
            ctk.CTkLabel(
                dialog,
                text=message,
                wraplength=380,
                justify="left",
                text_color=_TEXT,
            ).pack(fill="x", padx=20, pady=(20, 12))
            row = ctk.CTkFrame(dialog, fg_color="transparent")
            row.pack(fill="x", padx=20, pady=12)

            def go() -> None:
                dialog.destroy()
                service_status.configure(text=self._tr("working"))

                def ok(_r: dict[str, Any]) -> None:
                    win.after(0, after)

                def err(exc: Exception) -> None:
                    win.after(0, lambda: self._set_banner(str(exc)))

                _run_sync(action, on_ok=ok, on_err=err)

            ctk.CTkButton(
                row,
                text=self._tr("cancel"),
                height=34,
                fg_color="transparent",
                border_width=1,
                border_color=_LINE,
                text_color=_MUTED,
                command=dialog.destroy,
            ).pack(side="left")
            ctk.CTkButton(
                row,
                text=self._tr("confirm"),
                height=34,
                fg_color=_DANGER,
                hover_color="#912018",
                command=go,
            ).pack(side="right")

        ctk.CTkButton(
            body,
            text=self._tr("delete_service"),
            height=36,
            fg_color="transparent",
            border_width=1,
            border_color=_DANGER,
            text_color=_DANGER,
            hover_color="#FCEBEA",
            command=lambda: confirm_action(
                self._tr("confirm_delete_service"),
                services.agent_service_delete,
                lambda: refresh_service(),
            ),
        ).pack(fill="x", pady=(0, 8))

        def after_uninstall() -> None:
            on_close()
            self._set_banner(self._tr("delete_app"))
            self.root.after(400, self._on_close)

        ctk.CTkButton(
            body,
            text=self._tr("delete_app"),
            height=36,
            fg_color=_DANGER,
            hover_color="#912018",
            command=lambda: confirm_action(
                self._tr("confirm_delete_app"),
                lambda: services.uninstall_app(self.settings),
                after_uninstall,
            ),
        ).pack(fill="x", pady=(0, 16))

        ctk.CTkButton(
            body,
            text=self._tr("close"),
            height=36,
            fg_color="transparent",
            border_width=1,
            border_color=_LINE,
            text_color=_MUTED,
            command=on_close,
        ).pack(anchor="e", pady=(8, 0))

        # Kick off an update check quietly
        do_check()

    def _frame_boot(self):
        ctk = self.ctk
        f = ctk.CTkFrame(self.content, fg_color="transparent")
        ctk.CTkLabel(
            f,
            text=self._tr("boot_title"),
            font=ctk.CTkFont(size=18, weight="bold"),
            text_color=_TEXT,
        ).pack(anchor="w", pady=(8, 4))
        ctk.CTkLabel(
            f,
            text=self._tr("boot_sub"),
            text_color=_MUTED,
        ).pack(anchor="w")
        return f

    def _frame_project(self):
        ctk = self.ctk
        f = ctk.CTkFrame(self.content, fg_color="transparent")
        ctk.CTkLabel(
            f,
            text=self._tr("project_title"),
            font=ctk.CTkFont(size=20, weight="bold"),
            text_color=_TEXT,
        ).pack(anchor="w")
        ctk.CTkLabel(
            f,
            text=self._tr("project_sub"),
            text_color=_MUTED,
            wraplength=700,
            justify="left",
        ).pack(anchor="w", pady=(6, 16))
        ctk.CTkLabel(f, text=self._tr("supabase_url"), text_color=_MUTED).pack(anchor="w")
        self.project_url = ctk.CTkEntry(f, height=40, placeholder_text="https://xxxx.supabase.co")
        self.project_url.pack(fill="x", pady=(4, 12))
        ctk.CTkLabel(f, text=self._tr("anon_key"), text_color=_MUTED).pack(anchor="w")
        self.project_key = ctk.CTkEntry(f, height=40, show="•")
        self.project_key.pack(fill="x", pady=(4, 16))
        ctk.CTkButton(
            f,
            text=self._tr("continue"),
            height=42,
            fg_color=_ACCENT,
            hover_color=_ACCENT_HOVER,
            command=self._save_project,
        ).pack(anchor="w")
        return f

    def _frame_account(self):
        ctk = self.ctk
        f = ctk.CTkFrame(self.content, fg_color="transparent")
        ctk.CTkLabel(
            f, text=self._tr("sign_in_title"), font=ctk.CTkFont(size=20, weight="bold"), text_color=_TEXT
        ).pack(anchor="w")
        ctk.CTkLabel(
            f,
            text=self._tr("sign_in_sub"),
            text_color=_MUTED,
            wraplength=700,
            justify="left",
        ).pack(anchor="w", pady=(6, 16))

        self.email = ctk.CTkEntry(f, height=42, placeholder_text=self._tr("email"))
        self.email.pack(fill="x", pady=4)
        self.password = ctk.CTkEntry(f, height=42, placeholder_text=self._tr("password"), show="•")
        self.password.pack(fill="x", pady=4)

        row = ctk.CTkFrame(f, fg_color="transparent")
        row.pack(fill="x", pady=(12, 8))
        ctk.CTkButton(
            row,
            text=self._tr("sign_in"),
            height=42,
            fg_color=_ACCENT,
            hover_color=_ACCENT_HOVER,
            font=ctk.CTkFont(size=15, weight="bold"),
            command=self._local_login,
        ).pack(side="left", padx=(0, 8))
        ctk.CTkButton(
            row,
            text=self._tr("create_account"),
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
        ctk.CTkLabel(divider, text=self._tr("or"), text_color=_MUTED).pack()

        ctk.CTkButton(
            f,
            text=self._tr("continue_google"),
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
        f = ctk.CTkFrame(self.content, fg_color="transparent")
        head = ctk.CTkFrame(f, fg_color="transparent")
        head.pack(fill="x")
        ctk.CTkLabel(
            head, text=self._tr("device_title"), font=ctk.CTkFont(size=20, weight="bold"), text_color=_TEXT
        ).pack(side="left")
        ctk.CTkButton(
            head,
            text=self._tr("refresh"),
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
            text=self._tr("device_sub"),
            text_color=_MUTED,
        ).pack(anchor="w", pady=(6, 12))

        create = ctk.CTkFrame(f, fg_color="#F7FAF9", corner_radius=12)
        create.pack(fill="x", pady=(0, 14))
        ctk.CTkLabel(
            create,
            text=self._tr("create_new_device"),
            text_color=_TEXT,
            font=ctk.CTkFont(size=14, weight="bold"),
        ).pack(anchor="w", padx=14, pady=(12, 6))
        create_row = ctk.CTkFrame(create, fg_color="transparent")
        create_row.pack(fill="x", padx=14, pady=(0, 14))
        self.new_device_name = ctk.CTkEntry(
            create_row, height=38, placeholder_text=self._tr("device_name_ph")
        )
        self.new_device_name.pack(side="left", fill="x", expand=True, padx=(0, 8))
        ctk.CTkButton(
            create_row,
            text=self._tr("create_continue"),
            width=150,
            height=38,
            fg_color=_ACCENT,
            hover_color=_ACCENT_HOVER,
            command=self._create_device,
        ).pack(side="right")

        ctk.CTkLabel(
            f,
            text=self._tr("existing_devices"),
            text_color=_TEXT,
            font=ctk.CTkFont(size=14, weight="bold"),
        ).pack(anchor="w", pady=(4, 6))
        self.device_list = ctk.CTkScrollableFrame(f, fg_color="transparent")
        self.device_list.pack(fill="both", expand=True)
        return f

    def _frame_wiring(self):
        ctk = self.ctk
        f = ctk.CTkFrame(self.content, fg_color="transparent")
        ctk.CTkLabel(
            f, text=self._tr("gpio_title"), font=ctk.CTkFont(size=20, weight="bold"), text_color=_TEXT
        ).pack(anchor="w")
        ctk.CTkLabel(
            f,
            text=self._tr("gpio_sub"),
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
            left, text=self._tr("header_40"), font=ctk.CTkFont(size=14, weight="bold"), text_color=_TEXT
        ).pack(anchor="w", padx=12, pady=(12, 6))
        self.header_board = ctk.CTkScrollableFrame(left, fg_color="transparent", height=360)
        self.header_board.pack(fill="both", expand=True, padx=8, pady=(0, 8))

        right = ctk.CTkFrame(grid, fg_color="transparent")
        right.grid(row=0, column=1, sticky="nsew", padx=(8, 0))
        ctk.CTkLabel(
            right, text=self._tr("detected"), font=ctk.CTkFont(size=14, weight="bold"), text_color=_TEXT
        ).pack(anchor="w")
        self.guess_box = ctk.CTkScrollableFrame(right, fg_color="#F7FAF9", corner_radius=12, height=200)
        self.guess_box.pack(fill="both", expand=True, pady=(6, 10))
        conf_head = ctk.CTkFrame(right, fg_color="transparent")
        conf_head.pack(fill="x")
        ctk.CTkLabel(
            conf_head,
            text=self._tr("confirmed"),
            font=ctk.CTkFont(size=14, weight="bold"),
            text_color=_TEXT,
        ).pack(side="left")
        self.clear_confirmed_btn = ctk.CTkButton(
            conf_head,
            text=self._tr("clear_all"),
            width=80,
            height=26,
            fg_color="transparent",
            border_width=1,
            border_color=_LINE,
            text_color=_DANGER,
            hover_color="#FCEBEA",
            font=ctk.CTkFont(size=11),
            command=self._clear_confirmed,
        )
        self.clear_confirmed_btn.pack(side="right")
        self.confirmed_box = ctk.CTkScrollableFrame(right, fg_color="#F7FAF9", corner_radius=12, height=120)
        self.confirmed_box.pack(fill="both", expand=True, pady=(6, 10))
        return f

    def _frame_done(self):
        ctk = self.ctk
        f = ctk.CTkFrame(self.content, fg_color="transparent")
        ctk.CTkLabel(
            f, text=self._tr("done_title"), font=ctk.CTkFont(size=22, weight="bold"), text_color=_TEXT
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
            self._version_display = str(st["version_display"])
            self.title_label.configure(
                text=f"{self._tr('setup_title')}  {self._version_display}"
            )
        if st.get("language"):
            self.lang = normalize_language(str(st["language"]))
        self.user_email = st.get("email")
        self._update_avatar()
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
        self.auth_wait.configure(text=self._tr("auth_google_wait"))
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
            self.user_email = st.get("email")
            self._update_avatar()
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
            self._set_banner(self._tr("enter_email_password"))
            return

        def ok(_r: Any) -> None:
            self.user_email = email
            self._update_avatar()
            self._show("device")
            self._load_devices()

        _run_async(
            services.sign_in(self.settings, email, password),
            on_ok=lambda r: self.root.after(0, lambda: ok(r)),
            on_err=lambda e: self.root.after(0, lambda: self._set_banner(str(e))),
        )

    def _local_signup(self) -> None:
        self._clear_banner()
        email = self.email.get().strip()
        password = self.password.get()
        if not email or not password:
            self._set_banner(self._tr("enter_email_password"))
            return

        def ok(data: dict[str, Any]) -> None:
            if data.get("needs_confirmation"):
                self._set_banner("Check your email to confirm, then sign in.")
                return
            self.user_email = email
            self._update_avatar()
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
        self.ctk.CTkLabel(self.device_list, text=self._tr("loading"), text_color=_MUTED).pack(anchor="w")

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
                text=self._tr("no_devices"),
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
            self._set_banner(self._tr("enter_device_name"))
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
            self.sim_row.pack(side="left", before=self.manual_menu)
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
                self.guess_box, text=self._tr("waiting_connection"), text_color=_MUTED
            ).pack(anchor="w", padx=8, pady=8)
        for guess in pending:
            card = self.ctk.CTkFrame(self.guess_box, fg_color=_CARD, corner_radius=10)
            card.pack(fill="x", padx=6, pady=6)
            self.ctk.CTkLabel(
                card,
                text=self._tr("is_this", label=guess.get("label")),
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
                text=self._tr("confirm_btn"),
                width=100,
                height=30,
                fg_color=_ACCENT,
                hover_color=_ACCENT_HOVER,
                command=lambda g=guess, m=menu: self._confirm_guess(g, m.get()),
            ).pack(side="left", padx=(0, 6))
            self.ctk.CTkButton(
                row,
                text=self._tr("ignore_btn"),
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
        if not confirmed:
            self.ctk.CTkLabel(
                self.confirmed_box,
                text=self._tr("confirmed_empty"),
                text_color=_MUTED,
            ).pack(anchor="w", padx=8, pady=8)
        for w in confirmed:
            row = self.ctk.CTkFrame(self.confirmed_box, fg_color=_CARD, corner_radius=8)
            row.pack(fill="x", padx=6, pady=4)
            self.ctk.CTkLabel(
                row,
                text=(
                    f"{w.get('name')} · {w.get('driver')} · "
                    f"BCM {w.get('bcm') if w.get('bcm') is not None else '—'} · "
                    f"pins {', '.join(map(str, w.get('physical') or []))}"
                ),
                text_color=_TEXT,
                anchor="w",
                wraplength=260,
                justify="left",
            ).pack(side="left", fill="x", expand=True, padx=8, pady=8)
            idx = int(w.get("index", -1))
            self.ctk.CTkButton(
                row,
                text=self._tr("remove"),
                width=70,
                height=28,
                fg_color="transparent",
                border_width=1,
                border_color=_LINE,
                text_color=_DANGER,
                hover_color="#FCEBEA",
                font=self.ctk.CTkFont(size=11),
                command=lambda i=idx: self._remove_confirmed(i),
            ).pack(side="right", padx=6, pady=6)
        if self.step == "wiring":
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

    def _remove_confirmed(self, index: int) -> None:
        try:
            services.gpio_remove_confirmed(index)
        except Exception as exc:  # noqa: BLE001
            self._set_banner(str(exc))

    def _clear_confirmed(self) -> None:
        try:
            services.gpio_clear_confirmed()
        except Exception as exc:  # noqa: BLE001
            self._set_banner(str(exc))

    def _manual_add(self) -> None:
        label = self.manual_menu.get()
        peripheral_id = self._catalog_by_label.get(label)
        if not peripheral_id:
            return
        item = next((c for c in self.catalog if c.get("id") == peripheral_id), None)
        if not item:
            return
        self._open_manual_wiring_popup(item)

    def _pin_menu_values(self) -> list[str]:
        values = [self._tr("manual_pick_pin")]
        for pin in self.pins:
            values.append(f"{pin['physical']} · {pin['label']}")
        return values

    def _parse_pin_choice(self, choice: str) -> int | None:
        if not choice or choice == self._tr("manual_pick_pin") or "·" not in choice:
            return None
        try:
            return int(choice.split("·", 1)[0].strip())
        except ValueError:
            return None

    def _default_pin_for_lead(self, item: dict[str, Any], lead: dict[str, Any]) -> str | None:
        """Suggest a sensible default pin label for a cable."""
        from bioversee_pi.gpio.header import BCM_TO_PHYSICAL, HEADER_PINS

        by_phys = {p.physical: p for p in HEADER_PINS}
        kind = lead.get("kind")
        default_bcm = item.get("default_bcm")
        pick: int | None = None
        if kind == "data" or kind == "signal":
            if default_bcm is not None:
                pick = BCM_TO_PHYSICAL.get(int(default_bcm))
        elif kind == "sda":
            pick = BCM_TO_PHYSICAL.get(2)
        elif kind == "scl":
            pick = BCM_TO_PHYSICAL.get(3)
        elif kind == "power":
            pick = 1  # 3V3
        elif kind == "gnd":
            # Prefer GND near the default data pin
            if default_bcm is not None:
                data_phys = BCM_TO_PHYSICAL.get(int(default_bcm))
                if data_phys:
                    for candidate in (data_phys + 2, data_phys - 1, data_phys + 1, 6, 9, 14):
                        pin = by_phys.get(candidate)
                        if pin and pin.kind == "gnd":
                            pick = candidate
                            break
            if pick is None:
                pick = 6
        if pick is None:
            return None
        pin = by_phys.get(pick)
        if not pin:
            return None
        return f"{pin.physical} · {pin.label}"

    def _open_manual_wiring_popup(self, item: dict[str, Any]) -> None:
        ctk = self.ctk
        wires = item.get("wires") or []
        if not wires:
            # Fallback for older catalog entries without wire metadata
            try:
                services.gpio_manual(str(item["id"]))
            except Exception as exc:  # noqa: BLE001
                self._set_banner(str(exc))
            return

        win = ctk.CTkToplevel(self.root)
        win.title(self._tr("manual_wiring_title"))
        win.geometry("480x520")
        win.minsize(440, 420)
        win.configure(fg_color=_BG)
        win.transient(self.root)
        win.grab_set()

        body = ctk.CTkScrollableFrame(win, fg_color="transparent")
        body.pack(fill="both", expand=True, padx=20, pady=16)

        ctk.CTkLabel(
            body,
            text=item.get("label") or item.get("id"),
            font=ctk.CTkFont(size=18, weight="bold"),
            text_color=_TEXT,
        ).pack(anchor="w")
        ctk.CTkLabel(
            body,
            text=self._tr("manual_wiring_sub"),
            text_color=_MUTED,
            wraplength=420,
            justify="left",
        ).pack(anchor="w", pady=(4, 14))

        pin_values = self._pin_menu_values()
        menus: dict[str, Any] = {}
        for lead in wires:
            card = ctk.CTkFrame(body, fg_color=_CARD, corner_radius=10)
            card.pack(fill="x", pady=5)
            req = " *" if lead.get("required", True) else ""
            ctk.CTkLabel(
                card,
                text=f"{lead.get('label')}{req}",
                font=ctk.CTkFont(size=13, weight="bold"),
                text_color=_TEXT,
                anchor="w",
            ).pack(fill="x", padx=12, pady=(10, 2))
            ctk.CTkLabel(
                card,
                text=f"{self._tr('manual_pin')}",
                text_color=_MUTED,
                font=ctk.CTkFont(size=11),
                anchor="w",
            ).pack(fill="x", padx=12)
            menu = ctk.CTkOptionMenu(card, values=pin_values, width=280)
            suggested = self._default_pin_for_lead(item, lead)
            menu.set(suggested if suggested in pin_values else pin_values[0])
            menu.pack(anchor="w", padx=12, pady=(4, 12))
            menus[str(lead["id"])] = (menu, lead)

        err = ctk.CTkLabel(body, text="", text_color=_DANGER, wraplength=400, justify="left")
        err.pack(anchor="w", pady=(8, 0))

        actions = ctk.CTkFrame(body, fg_color="transparent")
        actions.pack(fill="x", pady=(16, 0))

        def save() -> None:
            pin_map: dict[str, int] = {}
            for lead_id, (menu, lead) in menus.items():
                pin = self._parse_pin_choice(menu.get())
                if pin is None:
                    if lead.get("required", True):
                        err.configure(text=self._tr("manual_need_pins"))
                        return
                    continue
                pin_map[lead_id] = pin
            try:
                services.gpio_manual(str(item["id"]), pin_map=pin_map)
            except Exception as exc:  # noqa: BLE001
                err.configure(text=str(exc))
                return
            win.destroy()

        ctk.CTkButton(
            actions,
            text=self._tr("cancel"),
            height=36,
            fg_color="transparent",
            border_width=1,
            border_color=_LINE,
            text_color=_MUTED,
            command=win.destroy,
        ).pack(side="left")
        ctk.CTkButton(
            actions,
            text=self._tr("manual_save"),
            height=36,
            fg_color=_ACCENT,
            hover_color=_ACCENT_HOVER,
            command=save,
        ).pack(side="right")

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
            msg = self._tr("done_enabled")
        else:
            msg = agent.get("message") or self._tr("done_fallback")
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
