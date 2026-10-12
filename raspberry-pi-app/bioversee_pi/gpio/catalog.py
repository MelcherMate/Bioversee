"""Supported peripherals and guess metadata for the wiring wizard."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class WireLead:
    """One cable / lead on a peripheral that the user maps to a header pin."""

    id: str
    label: str
    kind: str  # power | gnd | data | sda | scl | signal
    required: bool = True


@dataclass(frozen=True)
class Peripheral:
    id: str
    label: str
    role: str  # sensor | actuator
    name: str  # canonical cloud metric / actuator name
    driver: str
    bus: str  # onewire | i2c | digital
    default_bcm: int | None = None
    i2c_addresses: tuple[int, ...] = ()
    wires: tuple[WireLead, ...] = ()


_ONEWIRE_WIRES = (
    WireLead("vcc", "VCC / 3.3V", "power"),
    WireLead("data", "Data", "data"),
    WireLead("gnd", "GND", "gnd"),
)
_I2C_WIRES = (
    WireLead("vcc", "VCC / 3.3V", "power"),
    WireLead("gnd", "GND", "gnd"),
    WireLead("sda", "SDA", "sda"),
    WireLead("scl", "SCL", "scl"),
)
_DIGITAL_WIRES = (
    WireLead("vcc", "VCC (optional)", "power", required=False),
    WireLead("signal", "Signal / PWM", "signal"),
    WireLead("gnd", "GND", "gnd"),
)


CATALOG: tuple[Peripheral, ...] = (
    Peripheral(
        id="ds18b20",
        label="Temperature sensor (DS18B20)",
        role="sensor",
        name="temperature",
        driver="ds18b20",
        bus="onewire",
        default_bcm=4,
        wires=_ONEWIRE_WIRES,
    ),
    Peripheral(
        id="ph_i2c",
        label="pH probe (I2C ADC)",
        role="sensor",
        name="ph",
        driver="ph_i2c",
        bus="i2c",
        i2c_addresses=(0x48, 0x49, 0x4A, 0x4B, 0x63),  # ADS1115 / Atlas EZO common
        wires=_I2C_WIRES,
    ),
    Peripheral(
        id="pressure_i2c",
        label="Pressure sensor (I2C)",
        role="sensor",
        name="pressure",
        driver="pressure_i2c",
        bus="i2c",
        i2c_addresses=(0x76, 0x77),  # BMP280-ish
        wires=_I2C_WIRES,
    ),
    Peripheral(
        id="rotor",
        label="Rotor / stirrer motor driver",
        role="actuator",
        name="rotor",
        driver="digital_pwm",
        bus="digital",
        default_bcm=18,
        wires=_DIGITAL_WIRES,
    ),
    Peripheral(
        id="aerator",
        label="Aerator pump driver",
        role="actuator",
        name="aerator",
        driver="digital_pwm",
        bus="digital",
        default_bcm=12,
        wires=_DIGITAL_WIRES,
    ),
    Peripheral(
        id="warm_water",
        label="Warm water pump",
        role="actuator",
        name="switchWarmWaterPump",
        driver="digital_out",
        bus="digital",
        default_bcm=17,
        wires=_DIGITAL_WIRES,
    ),
    Peripheral(
        id="cold_water",
        label="Cold water pump",
        role="actuator",
        name="switchColdWaterPump",
        driver="digital_out",
        bus="digital",
        default_bcm=27,
        wires=_DIGITAL_WIRES,
    ),
    Peripheral(
        id="acid_pump",
        label="Acid dosing pump",
        role="actuator",
        name="switchAcidPump",
        driver="digital_out",
        bus="digital",
        default_bcm=22,
        wires=_DIGITAL_WIRES,
    ),
    Peripheral(
        id="base_pump",
        label="Base dosing pump",
        role="actuator",
        name="switchBasePump",
        driver="digital_out",
        bus="digital",
        default_bcm=23,
        wires=_DIGITAL_WIRES,
    ),
    Peripheral(
        id="digital_unknown",
        label="Digital switch / motor driver",
        role="actuator",
        name="digital",
        driver="digital_out",
        bus="digital",
        wires=_DIGITAL_WIRES,
    ),
)

CATALOG_BY_ID = {p.id: p for p in CATALOG}


def catalog_as_dict() -> list[dict]:
    return [
        {
            "id": p.id,
            "label": p.label,
            "role": p.role,
            "name": p.name,
            "driver": p.driver,
            "bus": p.bus,
            "default_bcm": p.default_bcm,
            "wires": [
                {
                    "id": w.id,
                    "label": w.label,
                    "kind": w.kind,
                    "required": w.required,
                }
                for w in p.wires
            ],
        }
        for p in CATALOG
        if p.id != "digital_unknown"
    ]
