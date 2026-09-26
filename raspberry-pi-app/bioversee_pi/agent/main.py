from __future__ import annotations

import asyncio
import logging
from pathlib import Path

from bioversee_pi.agent.drivers import read_sensor, set_actuator
from bioversee_pi.config import AppSettings, load_local_config
from bioversee_pi.devices import DevicesError, pi_ingest

log = logging.getLogger("bioversee.agent")


async def run_loop(poll_seconds: float = 5.0) -> None:
    settings = AppSettings()
    cfg = load_local_config()
    if cfg.supabase_url:
        settings.supabase_url = cfg.supabase_url
    if cfg.supabase_anon_key:
        settings.supabase_anon_key = cfg.supabase_anon_key

    if not cfg.api_key or not cfg.device_id:
        log.error(
            "Missing device binding in %s — run bioversee-wizard first",
            Path.home() / ".config" / "bioversee" / "config.toml",
        )
        return

    log.info("Agent started for device %s (%s)", cfg.device_id, cfg.device_name)
    last_switches: dict[str, bool] = {}
    last_sliders: dict[str, float] = {}

    while True:
        cfg = load_local_config()
        settings.supabase_url = cfg.supabase_url or settings.supabase_url
        settings.supabase_anon_key = cfg.supabase_anon_key or settings.supabase_anon_key

        readings = []
        for wire in cfg.wiring:
            if wire.role != "sensor" or not wire.confirmed:
                continue
            try:
                value = read_sensor(wire)
            except Exception as exc:  # noqa: BLE001
                log.warning("Sensor %s read failed: %s", wire.name, exc)
                continue
            if value is None:
                continue
            readings.append({"name": wire.name, "value": value})

        if readings:
            try:
                await pi_ingest(
                    settings,
                    cfg.api_key,  # type: ignore[arg-type]
                    {"action": "sensors", "readings": readings},
                )
                log.debug("Pushed %s readings", len(readings))
            except DevicesError as exc:
                log.warning("Ingest sensors failed: %s", exc)

        try:
            actuators = await pi_ingest(
                settings,
                cfg.api_key,  # type: ignore[arg-type]
                {"action": "actuators"},
            )
        except DevicesError as exc:
            log.warning("Fetch actuators failed: %s", exc)
            actuators = {}

        switches = actuators.get("switches") or {}
        sliders = actuators.get("sliders") or {}

        for wire in cfg.wiring:
            if wire.role != "actuator" or not wire.confirmed:
                continue
            if wire.name in switches:
                desired = bool(switches[wire.name])
                if last_switches.get(wire.name) != desired:
                    set_actuator(wire, on=desired, level=None)
                    last_switches[wire.name] = desired
            elif wire.name in sliders:
                level = float(sliders[wire.name])
                if last_sliders.get(wire.name) != level:
                    set_actuator(wire, on=level > 0, level=level)
                    last_sliders[wire.name] = level

        await asyncio.sleep(poll_seconds)


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    try:
        asyncio.run(run_loop())
    except KeyboardInterrupt:
        log.info("Agent stopped")


if __name__ == "__main__":
    main()
