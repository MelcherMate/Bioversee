from __future__ import annotations

import logging
from pathlib import Path

from bioversee_pi.config import WiringEntry, is_raspberry_pi

log = logging.getLogger("bioversee.drivers")


# Simulation baselines for off-Pi / stub drivers (wastewater-typical ranges).
_SIM_VALUES: dict[str, float] = {
    "temperature": 22.5,
    "ph": 7.1,
    "dissolvedOxygen": 3.8,
    "orp": 180.0,
    "conductivity": 1250.0,
    "turbidity": 12.0,
    "ammonia": 2.4,
    "nitrate": 8.0,
    "chlorine": 0.4,
    "cod": 85.0,
    "pressure": 14.7,
    "level": 1.25,
    "levelHydrostatic": 1.8,
    "flow": 4.2,
    "floatLevel": 0.0,
}


def read_sensor(wire: WiringEntry) -> float | None:
    if wire.driver == "ds18b20":
        return _read_ds18b20(wire.one_wire_id)
    if wire.driver == "float_switch":
        return _read_float_switch(wire)
    if wire.driver == "flow_pulse":
        return _read_stub(wire, metric="flow")
    if wire.driver == "level_ultrasonic":
        return _read_stub(wire, metric="level")
    if wire.driver.endswith("_i2c") or wire.driver.endswith("_analog") or wire.driver in (
        "level_hydrostatic",
        "turbidity_analog",
        "cod_analog",
    ):
        return _read_stub(wire)
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


def _read_stub(wire: WiringEntry, *, metric: str | None = None) -> float | None:
    """Placeholder until a concrete hardware driver is wired for the probe."""
    key = metric or wire.name
    if not is_raspberry_pi():
        base = _SIM_VALUES.get(key, 1.0)
        jitter = (hash(f"{key}:{wire.bcm}:{wire.i2c_address}") % 17) / 10.0
        return round(base + jitter - 0.8, 3)
    log.debug(
        "Sensor stub for %s driver=%s bcm=%s i2c=0x%02X",
        wire.name,
        wire.driver,
        wire.bcm,
        wire.i2c_address or 0,
    )
    return None


def _read_float_switch(wire: WiringEntry) -> float | None:
    """Digital float: 1.0 = closed/high, 0.0 = open/low (or simulated)."""
    if not is_raspberry_pi() or wire.bcm is None:
        return _SIM_VALUES.get("floatLevel", 0.0)
    try:
        from gpiozero import DigitalInputDevice  # type: ignore

        pin = DigitalInputDevice(wire.bcm, pull_up=True)
        return 1.0 if pin.value else 0.0
    except Exception as exc:  # noqa: BLE001
        log.debug("Float switch read failed on BCM %s: %s", wire.bcm, exc)
        return None
