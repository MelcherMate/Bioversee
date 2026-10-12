"""Supported peripherals and guess metadata for the wiring wizard.

Includes common wastewater-treatment sensors with Pi-friendly wiring presets
(1-Wire, I2C / Atlas-style EZO, analog 0–5 V / 4–20 mA via ADC, pulse, float).
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class WireLead:
    """One cable / lead on a peripheral that the user maps to a header pin."""

    id: str
    label: str
    kind: str  # power | gnd | data | sda | scl | signal | trig | echo
    required: bool = True


@dataclass(frozen=True)
class Peripheral:
    id: str
    label: str
    role: str  # sensor | actuator
    name: str  # canonical cloud metric / actuator name
    driver: str
    bus: str  # onewire | i2c | digital | analog | ultrasonic | pulse
    default_bcm: int | None = None
    i2c_addresses: tuple[int, ...] = ()
    wires: tuple[WireLead, ...] = ()
    category: str = "general"  # water_quality | hydraulic | actuator


# --- Wire presets -----------------------------------------------------------

_ONEWIRE_WIRES = (
    WireLead("vcc", "VCC / 3.3V", "power"),
    WireLead("data", "Data (1-Wire)", "data"),
    WireLead("gnd", "GND", "gnd"),
)
_I2C_WIRES = (
    WireLead("vcc", "VCC / 3.3V", "power"),
    WireLead("gnd", "GND", "gnd"),
    WireLead("sda", "SDA", "sda"),
    WireLead("scl", "SCL", "scl"),
)
_ANALOG_WIRES = (
    WireLead("vcc", "VCC / 5V or 3.3V", "power"),
    WireLead("signal", "Signal (0–5 V / 4–20 mA via ADC)", "signal"),
    WireLead("gnd", "GND", "gnd"),
)
_PULSE_WIRES = (
    WireLead("vcc", "VCC (optional)", "power", required=False),
    WireLead("signal", "Pulse / frequency", "signal"),
    WireLead("gnd", "GND", "gnd"),
)
_FLOAT_WIRES = (
    WireLead("signal", "Switch contact", "signal"),
    WireLead("gnd", "GND / common", "gnd"),
)
_ULTRASONIC_WIRES = (
    WireLead("vcc", "VCC / 5V", "power"),
    WireLead("trig", "TRIG", "trig"),
    WireLead("echo", "ECHO", "echo"),
    WireLead("gnd", "GND", "gnd"),
)
_DIGITAL_WIRES = (
    WireLead("vcc", "VCC (optional)", "power", required=False),
    WireLead("signal", "Signal / PWM", "signal"),
    WireLead("gnd", "GND", "gnd"),
)


# Atlas Scientific EZO / common I2C add-ons (defaults; boards are often re-addressable)
_ATLAS_PH = (0x63,)
_ATLAS_ORP = (0x62,)
_ATLAS_DO = (0x61,)
_ATLAS_EC = (0x64,)
_ADS1115 = (0x48, 0x49, 0x4A, 0x4B)  # common ADC for 4–20 mA / analog probes
_BMP = (0x76, 0x77)


CATALOG: tuple[Peripheral, ...] = (
    # —— Water quality (wastewater process) ————————————————
    Peripheral(
        id="ds18b20",
        label="Temperature (DS18B20)",
        role="sensor",
        name="temperature",
        driver="ds18b20",
        bus="onewire",
        default_bcm=4,
        wires=_ONEWIRE_WIRES,
        category="water_quality",
    ),
    Peripheral(
        id="ph_i2c",
        label="pH probe (I2C / Atlas EZO)",
        role="sensor",
        name="ph",
        driver="ph_i2c",
        bus="i2c",
        i2c_addresses=(*_ATLAS_PH, *_ADS1115),
        wires=_I2C_WIRES,
        category="water_quality",
    ),
    Peripheral(
        id="do_i2c",
        label="Dissolved oxygen — DO (I2C)",
        role="sensor",
        name="dissolvedOxygen",
        driver="do_i2c",
        bus="i2c",
        i2c_addresses=_ATLAS_DO,
        wires=_I2C_WIRES,
        category="water_quality",
    ),
    Peripheral(
        id="orp_i2c",
        label="ORP / redox (I2C)",
        role="sensor",
        name="orp",
        driver="orp_i2c",
        bus="i2c",
        i2c_addresses=_ATLAS_ORP,
        wires=_I2C_WIRES,
        category="water_quality",
    ),
    Peripheral(
        id="conductivity_i2c",
        label="Conductivity / EC / TDS (I2C)",
        role="sensor",
        name="conductivity",
        driver="conductivity_i2c",
        bus="i2c",
        i2c_addresses=_ATLAS_EC,
        wires=_I2C_WIRES,
        category="water_quality",
    ),
    Peripheral(
        id="turbidity_analog",
        label="Turbidity / TSS (analog)",
        role="sensor",
        name="turbidity",
        driver="turbidity_analog",
        bus="analog",
        default_bcm=None,
        wires=_ANALOG_WIRES,
        category="water_quality",
    ),
    Peripheral(
        id="ammonia_i2c",
        label="Ammonia NH₃-N (I2C / ISE)",
        role="sensor",
        name="ammonia",
        driver="ammonia_i2c",
        bus="i2c",
        i2c_addresses=(0x68, 0x69, *_ADS1115),  # common ISE / ADC boards
        wires=_I2C_WIRES,
        category="water_quality",
    ),
    Peripheral(
        id="nitrate_i2c",
        label="Nitrate NO₃-N (I2C / ISE)",
        role="sensor",
        name="nitrate",
        driver="nitrate_i2c",
        bus="i2c",
        i2c_addresses=(0x6A, 0x6B, *_ADS1115),
        wires=_I2C_WIRES,
        category="water_quality",
    ),
    Peripheral(
        id="chlorine_i2c",
        label="Residual chlorine (I2C)",
        role="sensor",
        name="chlorine",
        driver="chlorine_i2c",
        bus="i2c",
        i2c_addresses=(0x6C, *_ADS1115),
        wires=_I2C_WIRES,
        category="water_quality",
    ),
    Peripheral(
        id="cod_analog",
        label="COD / UV254 (analog / 4–20 mA)",
        role="sensor",
        name="cod",
        driver="cod_analog",
        bus="analog",
        wires=_ANALOG_WIRES,
        category="water_quality",
    ),
    # —— Hydraulic / tank / pipe ————————————————
    Peripheral(
        id="pressure_i2c",
        label="Pressure (I2C)",
        role="sensor",
        name="pressure",
        driver="pressure_i2c",
        bus="i2c",
        i2c_addresses=_BMP,
        wires=_I2C_WIRES,
        category="hydraulic",
    ),
    Peripheral(
        id="level_ultrasonic",
        label="Level — ultrasonic (TRIG/ECHO)",
        role="sensor",
        name="level",
        driver="level_ultrasonic",
        bus="ultrasonic",
        default_bcm=5,  # TRIG; ECHO defaults to neighboring GPIO in the popup
        wires=_ULTRASONIC_WIRES,
        category="hydraulic",
    ),
    Peripheral(
        id="level_hydrostatic",
        label="Level — hydrostatic (analog / 4–20 mA)",
        role="sensor",
        name="levelHydrostatic",
        driver="level_hydrostatic",
        bus="analog",
        wires=_ANALOG_WIRES,
        category="hydraulic",
    ),
    Peripheral(
        id="flow_pulse",
        label="Flow meter (pulse)",
        role="sensor",
        name="flow",
        driver="flow_pulse",
        bus="pulse",
        default_bcm=25,
        wires=_PULSE_WIRES,
        category="hydraulic",
    ),
    Peripheral(
        id="float_switch",
        label="Float level switch (high / low)",
        role="sensor",
        name="floatLevel",
        driver="float_switch",
        bus="digital",
        default_bcm=16,
        wires=_FLOAT_WIRES,
        category="hydraulic",
    ),
    # —— Actuators ————————————————
    Peripheral(
        id="rotor",
        label="Rotor / stirrer motor driver",
        role="actuator",
        name="rotor",
        driver="digital_pwm",
        bus="digital",
        default_bcm=18,
        wires=_DIGITAL_WIRES,
        category="actuator",
    ),
    Peripheral(
        id="aerator",
        label="Aerator / blower driver",
        role="actuator",
        name="aerator",
        driver="digital_pwm",
        bus="digital",
        default_bcm=12,
        wires=_DIGITAL_WIRES,
        category="actuator",
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
        category="actuator",
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
        category="actuator",
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
        category="actuator",
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
        category="actuator",
    ),
    Peripheral(
        id="digital_unknown",
        label="Digital switch / motor driver",
        role="actuator",
        name="digital",
        driver="digital_out",
        bus="digital",
        wires=_DIGITAL_WIRES,
        category="actuator",
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
            "category": p.category,
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
