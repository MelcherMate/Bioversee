from __future__ import annotations

import logging
from pathlib import Path

from bioversee_pi.config import WiringEntry, is_raspberry_pi

log = logging.getLogger("bioversee.drivers")


def read_sensor(wire: WiringEntry) -> float | None:
    if wire.driver == "ds18b20":
        return _read_ds18b20(wire.one_wire_id)
    if wire.driver in ("ph_i2c", "pressure_i2c"):
        return _read_i2c_stub(wire)
    return None


def set_actuator(wire: WiringEntry, *, on: bool, level: float | None) -> None:
    if not is_raspberry_pi():
        log.info(
            "Simulated actuator %s → on=%s level=%s (bcm=%s)",
            wire.name,
            on,
            level,
            wire.bcm,
        )
        return
    if wire.bcm is None:
        return
    try:
        from gpiozero import DigitalOutputDevice, PWMOutputDevice  # type: ignore
    except ImportError:
        log.warning("gpiozero not installed — cannot drive BCM %s", wire.bcm)
        return

    if wire.driver == "digital_pwm" and level is not None:
        duty = max(0.0, min(1.0, float(level) / 100.0))
        device = PWMOutputDevice(wire.bcm)
        device.value = duty if on else 0.0
        return

    device = DigitalOutputDevice(wire.bcm)
    if on:
        device.on()
    else:
        device.off()


def _read_ds18b20(one_wire_id: str | None) -> float | None:
    root = Path("/sys/bus/w1/devices")
    if not root.exists():
        if not is_raspberry_pi():
            return 25.0 + (hash(one_wire_id or "sim") % 20) / 10.0
        return None

    candidates: list[Path] = []
    if one_wire_id:
        candidates.append(root / one_wire_id / "w1_slave")
    else:
        candidates.extend(root.glob("28-*/w1_slave"))

    for path in candidates:
        if not path.exists():
            continue
        try:
            text = path.read_text()
        except OSError:
            continue
        if "YES" not in text:
            continue
        for part in text.split():
            if part.startswith("t="):
                return int(part[2:]) / 1000.0
    return None


def _read_i2c_stub(wire: WiringEntry) -> float | None:
    """Placeholder until a concrete ADC driver is wired for the chosen HAT."""
    if not is_raspberry_pi():
        base = 7.0 if wire.name == "ph" else 14.7
        return base
    log.debug("I2C driver stub for %s @ 0x%02X", wire.name, wire.i2c_address or 0)
    return None
