"""Simple UI translations for the Pi desktop app (en / de / hu)."""

from __future__ import annotations

from typing import Literal

AppLanguage = Literal["en", "de", "hu"]

LANGUAGE_OPTIONS: list[tuple[AppLanguage, str, str]] = [
    ("en", "English", "English"),
    ("de", "German", "Deutsch"),
    ("hu", "Hungarian", "Magyar"),
]

_STRINGS: dict[AppLanguage, dict[str, str]] = {
    "en": {
        "raspberry_pi": "RASPBERRY PI",
        "setup_title": "Bioversee setup",
        "step_account": "1 · Account",
        "step_device": "2 · Device",
        "step_wiring": "3 · Wiring",
        "step_done": "4 · Done",
        "step_account_hint": "Connecting the account",
        "step_device_hint": "Choosing the device",
        "step_wiring_hint": "Wiring sensors",
        "step_done_hint": "Done",
        "boot_title": "Starting Bioversee…",
        "boot_sub": "Loading your local setup.",
        "project_title": "Connect to Bioversee",
        "project_sub": (
            "Paste the same Supabase URL and anon key used by the web app "
            "(only needed if not baked into the installer)."
        ),
        "supabase_url": "Supabase URL",
        "anon_key": "Anon / publishable key",
        "continue": "Continue",
        "sign_in_title": "Sign in",
        "sign_in_sub": "Sign in or create an account in this app. No system browser required.",
        "email": "Email",
        "password": "Password",
        "sign_in": "Sign in",
        "create_account": "Create account",
        "or": "or",
        "continue_google": "Continue with Google",
        "device_title": "Your device",
        "refresh": "Refresh",
        "device_sub": "Create a new bioreactor device or select one from your profile.",
        "create_new_device": "Create new device",
        "device_name_ph": "Device name (e.g. Bench reactor 1)",
        "create_continue": "Create & continue",
        "existing_devices": "Existing devices",
        "no_devices": "No devices yet — create one above.",
        "loading": "Loading…",
        "gpio_title": "GPIO live status",
        "gpio_sub": (
            "All 40 pins update live: HIGH / LOW / idle. "
            "Detected sensors highlight automatically."
        ),
        "header_40": "40-pin header",
        "detected": "Detected",
        "confirmed": "Confirmed",
        "waiting_connection": "Waiting for a connection…",
        "simulate_temp": "Simulate temp",
        "simulate_ph": "Simulate pH",
        "add_manually": "Add manually",
        "finish_setup": "Finish setup",
        "manual_wiring_title": "Map sensor cables",
        "manual_wiring_sub": "For each cable, choose which pin it is connected to on the 40-pin header.",
        "manual_cable": "Cable",
        "manual_pin": "Pin on Pi",
        "manual_save": "Add to confirmed",
        "manual_pick_pin": "— select pin —",
        "manual_need_pins": "Select a pin for every required cable.",
        "remove": "Remove",
        "clear_all": "Clear all",
        "confirmed_empty": "Nothing confirmed yet.",
        "done_title": "You're set",
        "settings": "Settings",
        "log_out": "Log out",
        "not_signed_in": "Not signed in",
        "language": "Language",
        "updates": "Updates",
        "check_updates": "Check for updates",
        "update_now": "Update now",
        "checking": "Checking…",
        "updating": "Updating…",
        "up_to_date": "You're up to date ({version})",
        "update_available": "Update available: {remote} (installed {current})",
        "update_failed": "Update check failed",
        "agent_service": "Background services",
        "agent_service_sub": "Create named agent service files, then choose which one to start or stop.",
        "service_select": "Active service",
        "service_name_ph": "Name (e.g. Bench reactor)",
        "service_create": "Create",
        "service_need_name": "Enter a name for the new service.",
        "service_file": "File: {file}",
        "service_running": "Running",
        "service_stopped": "Stopped",
        "service_missing": "Not installed",
        "service_unknown": "Unknown",
        "service_autostart": "Start on boot",
        "service_autostart_sub": "When on, this service starts automatically when the Raspberry Pi boots.",
        "start_service": "Start",
        "stop_service": "Stop",
        "delete_service": "Delete selected service file",
        "delete_app": "Delete app from this Pi",
        "danger_zone": "Danger zone",
        "confirm_delete_service": (
            "Remove the bioversee-agent systemd unit from this Pi?\n"
            "The background service will stop and will not start on boot."
        ),
        "confirm_delete_app": (
            "Permanently delete Bioversee from this Raspberry Pi?\n"
            "This removes the app, agent service, desktop shortcut, and local install.\n"
            "Your cloud account and devices are not deleted."
        ),
        "close": "Close",
        "cancel": "Cancel",
        "confirm": "Confirm",
        "working": "Working…",
        "signed_out": "Signed out.",
        "enter_email_password": "Enter email and password.",
        "enter_device_name": "Enter a device name.",
        "auth_google_wait": "Complete Google sign-in in the window that opened… (keep this app open)",
        "is_this": "Is this a {label}?",
        "confirm_btn": "Confirm",
        "ignore_btn": "Ignore",
        "done_enabled": (
            "Monitoring will start automatically when this Pi boots. "
            "Control this device from the Bioversee website."
        ),
        "done_fallback": "Setup saved. Enable the agent service manually.",
        "profile": "Profile",
    },
    "de": {
        "raspberry_pi": "RASPBERRY PI",
        "setup_title": "Bioversee Setup",
        "step_account": "1 · Konto",
        "step_device": "2 · Gerät",
        "step_wiring": "3 · Verdrahtung",
        "step_done": "4 · Fertig",
        "step_account_hint": "Konto verbinden",
        "step_device_hint": "Gerät wählen",
        "step_wiring_hint": "Sensoren verdrahten",
        "step_done_hint": "Fertig",
        "boot_title": "Bioversee wird gestartet…",
        "boot_sub": "Lokale Einrichtung wird geladen.",
        "project_title": "Mit Bioversee verbinden",
        "project_sub": (
            "Füge dieselbe Supabase-URL und den Anon-Key der Web-App ein "
            "(nur nötig, wenn sie nicht im Installer hinterlegt sind)."
        ),
        "supabase_url": "Supabase-URL",
        "anon_key": "Anon- / Publishable-Key",
        "continue": "Weiter",
        "sign_in_title": "Anmelden",
        "sign_in_sub": "Melde dich an oder erstelle ein Konto in dieser App. Kein Systembrowser nötig.",
        "email": "E-Mail",
        "password": "Passwort",
        "sign_in": "Anmelden",
        "create_account": "Konto erstellen",
        "or": "oder",
        "continue_google": "Mit Google fortfahren",
        "device_title": "Dein Gerät",
        "refresh": "Aktualisieren",
        "device_sub": "Erstelle ein neues Bioreaktor-Gerät oder wähle eines aus deinem Profil.",
        "create_new_device": "Neues Gerät erstellen",
        "device_name_ph": "Gerätename (z. B. Bench-Reaktor 1)",
        "create_continue": "Erstellen & weiter",
        "existing_devices": "Vorhandene Geräte",
        "no_devices": "Noch keine Geräte — erstelle oben eines.",
        "loading": "Laden…",
        "gpio_title": "GPIO Live-Status",
        "gpio_sub": (
            "Alle 40 Pins aktualisieren sich live: HIGH / LOW / idle. "
            "Erkannte Sensoren werden automatisch hervorgehoben."
        ),
        "header_40": "40-Pin-Header",
        "detected": "Erkannt",
        "confirmed": "Bestätigt",
        "waiting_connection": "Warte auf eine Verbindung…",
        "simulate_temp": "Temp. simulieren",
        "simulate_ph": "pH simulieren",
        "add_manually": "Manuell hinzufügen",
        "finish_setup": "Setup abschließen",
        "manual_wiring_title": "Kabel zuordnen",
        "manual_wiring_sub": "Wähle für jedes Kabel den Pin auf dem 40-Pin-Header.",
        "manual_cable": "Kabel",
        "manual_pin": "Pin am Pi",
        "manual_save": "Zu Bestätigt hinzufügen",
        "manual_pick_pin": "— Pin wählen —",
        "manual_need_pins": "Wähle für jedes erforderliche Kabel einen Pin.",
        "remove": "Entfernen",
        "clear_all": "Alles löschen",
        "confirmed_empty": "Noch nichts bestätigt.",
        "done_title": "Fertig",
        "settings": "Einstellungen",
        "log_out": "Abmelden",
        "not_signed_in": "Nicht angemeldet",
        "language": "Sprache",
        "updates": "Updates",
        "check_updates": "Nach Updates suchen",
        "update_now": "Jetzt aktualisieren",
        "checking": "Prüfen…",
        "updating": "Aktualisieren…",
        "up_to_date": "Aktuell ({version})",
        "update_available": "Update verfügbar: {remote} (installiert {current})",
        "update_failed": "Update-Prüfung fehlgeschlagen",
        "agent_service": "Hintergrunddienste",
        "agent_service_sub": "Erstelle benannte Agent-Service-Dateien und wähle, welche gestartet oder gestoppt wird.",
        "service_select": "Aktiver Dienst",
        "service_name_ph": "Name (z. B. Bench-Reaktor)",
        "service_create": "Erstellen",
        "service_need_name": "Gib einen Namen für den neuen Dienst ein.",
        "service_file": "Datei: {file}",
        "service_running": "Läuft",
        "service_stopped": "Gestoppt",
        "service_missing": "Nicht installiert",
        "service_unknown": "Unbekannt",
        "service_autostart": "Beim Start starten",
        "service_autostart_sub": "Wenn aktiv, startet dieser Dienst automatisch beim Booten des Raspberry Pi.",
        "start_service": "Starten",
        "stop_service": "Stoppen",
        "delete_service": "Ausgewählte Service-Datei löschen",
        "delete_app": "App von diesem Pi löschen",
        "danger_zone": "Gefahrenzone",
        "confirm_delete_service": (
            "Die systemd-Unit bioversee-agent von diesem Pi entfernen?\n"
            "Der Hintergrunddienst wird gestoppt und startet nicht mehr beim Booten."
        ),
        "confirm_delete_app": (
            "Bioversee dauerhaft von diesem Raspberry Pi löschen?\n"
            "App, Agent-Dienst, Desktop-Verknüpfung und lokale Installation werden entfernt.\n"
            "Cloud-Konto und Geräte bleiben erhalten."
        ),
        "close": "Schließen",
        "cancel": "Abbrechen",
        "confirm": "Bestätigen",
        "working": "Bitte warten…",
        "signed_out": "Abgemeldet.",
        "enter_email_password": "E-Mail und Passwort eingeben.",
        "enter_device_name": "Gerätenamen eingeben.",
        "auth_google_wait": "Google-Anmeldung im geöffneten Fenster abschließen… (App offen lassen)",
        "is_this": "Ist das ein {label}?",
        "confirm_btn": "Bestätigen",
        "ignore_btn": "Ignorieren",
        "done_enabled": (
            "Die Überwachung startet automatisch beim Booten dieses Pi. "
            "Steuere das Gerät über die Bioversee-Website."
        ),
        "done_fallback": "Setup gespeichert. Agent-Dienst manuell aktivieren.",
        "profile": "Profil",
    },
    "hu": {
        "raspberry_pi": "RASPBERRY PI",
        "setup_title": "Bioversee telepítés",
        "step_account": "1 · Fiók",
        "step_device": "2 · Eszköz",
        "step_wiring": "3 · Kábelezés",
        "step_done": "4 · Kész",
        "step_account_hint": "Fiók csatlakoztatása",
        "step_device_hint": "Eszköz választása",
        "step_wiring_hint": "Szenzorok kábelezése",
        "step_done_hint": "Kész",
        "boot_title": "Bioversee indítása…",
        "boot_sub": "Helyi beállítások betöltése.",
        "project_title": "Kapcsolódás a Bioversee-hez",
        "project_sub": (
            "Illeszd be ugyanazt a Supabase URL-t és anon kulcsot, amit a webapp használ "
            "(csak akkor kell, ha az installer nem tartalmazza)."
        ),
        "supabase_url": "Supabase URL",
        "anon_key": "Anon / publishable kulcs",
        "continue": "Tovább",
        "sign_in_title": "Bejelentkezés",
        "sign_in_sub": "Jelentkezz be vagy hozz létre fiókot az appban. Nincs szükség böngészőre.",
        "email": "E-mail",
        "password": "Jelszó",
        "sign_in": "Bejelentkezés",
        "create_account": "Fiók létrehozása",
        "or": "vagy",
        "continue_google": "Folytatás Google-lel",
        "device_title": "Az eszközöd",
        "refresh": "Frissítés",
        "device_sub": "Hozz létre új bioreaktor eszközt, vagy válassz egyet a profilodból.",
        "create_new_device": "Új eszköz létrehozása",
        "device_name_ph": "Eszköz neve (pl. Pad reaktor 1)",
        "create_continue": "Létrehozás & folytatás",
        "existing_devices": "Meglévő eszközök",
        "no_devices": "Még nincs eszköz — hozz létre egyet fent.",
        "loading": "Betöltés…",
        "gpio_title": "GPIO élő állapot",
        "gpio_sub": (
            "Mind a 40 pin élőben frissül: HIGH / LOW / idle. "
            "Az észlelt szenzorok automatikusan kiemelkednek."
        ),
        "header_40": "40-pines header",
        "detected": "Észlelve",
        "confirmed": "Megerősítve",
        "waiting_connection": "Várakozás kapcsolatra…",
        "simulate_temp": "Hőmérséklet szimulálása",
        "simulate_ph": "pH szimulálása",
        "add_manually": "Kézi hozzáadás",
        "finish_setup": "Telepítés befejezése",
        "manual_wiring_title": "Kábelek hozzárendelése",
        "manual_wiring_sub": "Minden kábelhez válaszd ki, melyik pinre van csatlakoztatva a 40-pines headeren.",
        "manual_cable": "Kábel",
        "manual_pin": "Pin a Pi-n",
        "manual_save": "Hozzáadás a megerősítettekhez",
        "manual_pick_pin": "— válassz pint —",
        "manual_need_pins": "Minden kötelező kábelhez válassz pint.",
        "remove": "Eltávolítás",
        "clear_all": "Összes törlése",
        "confirmed_empty": "Még nincs megerősített elem.",
        "done_title": "Készen állsz",
        "settings": "Beállítások",
        "log_out": "Kijelentkezés",
        "not_signed_in": "Nincs bejelentkezve",
        "language": "Nyelv",
        "updates": "Frissítések",
        "check_updates": "Frissítések keresése",
        "update_now": "Frissítés most",
        "checking": "Ellenőrzés…",
        "updating": "Frissítés…",
        "up_to_date": "Naprakész ({version})",
        "update_available": "Frissítés elérhető: {remote} (telepítve: {current})",
        "update_failed": "A frissítés ellenőrzése sikertelen",
        "agent_service": "Háttérszolgáltatások",
        "agent_service_sub": "Hozz létre elnevezett agent szolgáltatásfájlokat, majd válaszd ki, melyiket indítod vagy állítod le.",
        "service_select": "Aktív szolgáltatás",
        "service_name_ph": "Név (pl. Pad reaktor)",
        "service_create": "Létrehozás",
        "service_need_name": "Add meg az új szolgáltatás nevét.",
        "service_file": "Fájl: {file}",
        "service_running": "Fut",
        "service_stopped": "Leállítva",
        "service_missing": "Nincs telepítve",
        "service_unknown": "Ismeretlen",
        "service_autostart": "Indítás bootoláskor",
        "service_autostart_sub": "Ha be van kapcsolva, a szolgáltatás automatikusan elindul a Raspberry Pi bootolásakor.",
        "start_service": "Indítás",
        "stop_service": "Leállítás",
        "delete_service": "Kiválasztott szolgáltatásfájl törlése",
        "delete_app": "App törlése erről a Pi-ről",
        "danger_zone": "Veszélyes zóna",
        "confirm_delete_service": (
            "Eltávolítod a bioversee-agent systemd unitot erről a Pi-ről?\n"
            "A háttérszolgáltatás leáll, és bootoláskor nem indul el."
        ),
        "confirm_delete_app": (
            "Véglegesen törlöd a Bioversee-t erről a Raspberry Pi-ről?\n"
            "Az app, az agent szolgáltatás, az asztali parancsikon és a helyi telepítés törlődik.\n"
            "A felhős fiók és az eszközök megmaradnak."
        ),
        "close": "Bezárás",
        "cancel": "Mégse",
        "confirm": "Megerősítés",
        "working": "Folyamatban…",
        "signed_out": "Kijelentkezve.",
        "enter_email_password": "Add meg az e-mailt és a jelszót.",
        "enter_device_name": "Add meg az eszköz nevét.",
        "auth_google_wait": "Fejezd be a Google bejelentkezést a megnyílt ablakban… (hagyd nyitva az appot)",
        "is_this": "Ez egy {label}?",
        "confirm_btn": "Megerősítés",
        "ignore_btn": "Kihagyás",
        "done_enabled": (
            "A monitorozás automatikusan elindul, amikor ez a Pi bootol. "
            "Az eszközt a Bioversee weboldalról vezérelheted."
        ),
        "done_fallback": "Beállítás mentve. Az agent szolgáltatást manuálisan kapcsold be.",
        "profile": "Profil",
    },
}


def normalize_language(value: str | None) -> AppLanguage:
    if value in ("en", "de", "hu"):
        return value  # type: ignore[return-value]
    return "en"


def t(key: str, lang: AppLanguage = "en", **kwargs: object) -> str:
    table = _STRINGS.get(lang) or _STRINGS["en"]
    text = table.get(key) or _STRINGS["en"].get(key) or key
    if kwargs:
        try:
            return text.format(**kwargs)
        except (KeyError, ValueError):
            return text
    return text
