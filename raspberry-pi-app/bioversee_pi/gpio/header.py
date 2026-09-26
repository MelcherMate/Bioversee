"""Raspberry Pi 40-pin header: physical pin ↔ BCM GPIO mapping."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class HeaderPin:
    physical: int
    label: str
    bcm: int | None = None  # None for power / ground / ID pins
    kind: str = "gpio"  # gpio | 3v3 | 5v | gnd | id


# Physical pin 1 is top-left when USB ports face down / SD card faces you,
# looking at the board with the header along the edge.
# Odd pins = left column, even pins = right column.
HEADER_PINS: tuple[HeaderPin, ...] = (
    HeaderPin(1, "3V3", kind="3v3"),
    HeaderPin(2, "5V", kind="5v"),
    HeaderPin(3, "GPIO2", bcm=2),
    HeaderPin(4, "5V", kind="5v"),
    HeaderPin(5, "GPIO3", bcm=3),
    HeaderPin(6, "GND", kind="gnd"),
    HeaderPin(7, "GPIO4", bcm=4),
    HeaderPin(8, "GPIO14", bcm=14),
    HeaderPin(9, "GND", kind="gnd"),
    HeaderPin(10, "GPIO15", bcm=15),
    HeaderPin(11, "GPIO17", bcm=17),
    HeaderPin(12, "GPIO18", bcm=18),
    HeaderPin(13, "GPIO27", bcm=27),
    HeaderPin(14, "GND", kind="gnd"),
    HeaderPin(15, "GPIO22", bcm=22),
    HeaderPin(16, "GPIO23", bcm=23),
    HeaderPin(17, "3V3", kind="3v3"),
    HeaderPin(18, "GPIO24", bcm=24),
    HeaderPin(19, "GPIO10", bcm=10),
    HeaderPin(20, "GND", kind="gnd"),
    HeaderPin(21, "GPIO9", bcm=9),
    HeaderPin(22, "GPIO25", bcm=25),
    HeaderPin(23, "GPIO11", bcm=11),
    HeaderPin(24, "GPIO8", bcm=8),
    HeaderPin(25, "GND", kind="gnd"),
    HeaderPin(26, "GPIO7", bcm=7),
    HeaderPin(27, "ID_SD", kind="id"),
    HeaderPin(28, "ID_SC", kind="id"),
    HeaderPin(29, "GPIO5", bcm=5),
    HeaderPin(30, "GND", kind="gnd"),
    HeaderPin(31, "GPIO6", bcm=6),
    HeaderPin(32, "GPIO12", bcm=12),
    HeaderPin(33, "GPIO13", bcm=13),
    HeaderPin(34, "GND", kind="gnd"),
    HeaderPin(35, "GPIO19", bcm=19),
    HeaderPin(36, "GPIO16", bcm=16),
    HeaderPin(37, "GPIO26", bcm=26),
    HeaderPin(38, "GPIO20", bcm=20),
    HeaderPin(39, "GND", kind="gnd"),
    HeaderPin(40, "GPIO21", bcm=21),
)

BCM_TO_PHYSICAL: dict[int, int] = {
    p.bcm: p.physical for p in HEADER_PINS if p.bcm is not None
}

PHYSICAL_TO_PIN: dict[int, HeaderPin] = {p.physical: p for p in HEADER_PINS}

# Typical companion power/ground pins when a sensor plugs into a data GPIO.
COMPANION_POWER_GROUND = {
    4: [1, 6, 9],  # GPIO4 (1-Wire temp): 3V3 + nearby GND
    2: [1, 6],  # I2C SDA
    3: [1, 6],  # I2C SCL
}


def header_as_dict() -> list[dict]:
    return [
        {
            "physical": p.physical,
            "label": p.label,
            "bcm": p.bcm,
            "kind": p.kind,
            "row": (p.physical - 1) // 2,
            "col": 0 if p.physical % 2 == 1 else 1,
        }
        for p in HEADER_PINS
    ]


def physical_pins_for_bcm(bcm: int) -> list[int]:
    phys = BCM_TO_PHYSICAL.get(bcm)
    if phys is None:
        return []
    companions = COMPANION_POWER_GROUND.get(bcm, [])
    return [phys, *companions]
