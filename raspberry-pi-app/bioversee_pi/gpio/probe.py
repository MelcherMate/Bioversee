"""GPIO / bus probing with simulation fallback for non-Pi hosts."""

from __future__ import annotations

import asyncio
import os
import time
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

from bioversee_pi.config import should_simulate
from bioversee_pi.gpio.catalog import CATALOG_BY_ID, Peripheral
from bioversee_pi.gpio.header import physical_pins_for_bcm


@dataclass
class ProbeGuess:
    id: str
    event_id: str
    label: str
    role: str
    name: str
    driver: str
    bus: str
    bcm: int | None
    physical: list[int]
    confidence: float
    detail: str
    i2c_address: int | None = None
    one_wire_id: str | None = None
    seen_at: float = field(default_factory=time.time)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class ProbeService:
    def __init__(self) -> None:
        self.simulate = should_simulate()
        self._known_onewire: set[str] = set()
        self._known_i2c: set[int] = set()
        self._known_digital: set[int] = set()
        self._pending: dict[str, ProbeGuess] = {}
        self._confirmed_event_ids: set[str] = set()
        self._ignored_event_ids: set[str] = set()
        self._sim_step = 0
        self._lock = asyncio.Lock()

    def snapshot(self) -> dict[str, Any]:
        return {
            "simulate": self.simulate,
            "pending": [g.to_dict() for g in self._pending.values()],
            "active_physical": sorted(
                {p for g in self._pending.values() for p in g.physical}
            ),
        }

    async def poll_once(self) -> list[ProbeGuess]:
        async with self._lock:
            if self.simulate:
                return self._poll_simulate()
            new: list[ProbeGuess] = []
            new.extend(self._scan_onewire())
            new.extend(self._scan_i2c())
            new.extend(self._scan_digital_activity())
            return new

    def confirm(self, event_id: str, peripheral_id: str | None = None) -> ProbeGuess | None:
        guess = self._pending.pop(event_id, None)
        if not guess:
            return None
        if peripheral_id and peripheral_id in CATALOG_BY_ID:
            p = CATALOG_BY_ID[peripheral_id]
            guess = ProbeGuess(
                id=p.id,
                event_id=event_id,
                label=p.label,
                role=p.role,
                name=p.name,
                driver=p.driver,
                bus=p.bus,
                bcm=guess.bcm if guess.bcm is not None else p.default_bcm,
                physical=guess.physical
                or (physical_pins_for_bcm(p.default_bcm) if p.default_bcm is not None else []),
                confidence=1.0,
                detail="Confirmed by user",
                i2c_address=guess.i2c_address,
                one_wire_id=guess.one_wire_id,
            )
        self._confirmed_event_ids.add(event_id)
        return guess

    def ignore(self, event_id: str) -> None:
        self._pending.pop(event_id, None)
        self._ignored_event_ids.add(event_id)

    def inject_simulation(self, peripheral_id: str = "ds18b20") -> ProbeGuess:
        """Manual trigger used by the wizard 'Simulate connect' button."""
        p = CATALOG_BY_ID[peripheral_id]
        event_id = f"sim-{peripheral_id}-{int(time.time() * 1000)}"
        bcm = p.default_bcm
        if p.bus == "i2c":
            bcm = 2
            addr = p.i2c_addresses[0] if p.i2c_addresses else 0x48
            guess = self._make_guess(
                p,
                event_id=event_id,
                bcm=bcm,
                confidence=0.7,
                detail=f"Simulated I2C device at 0x{addr:02X}",
                i2c_address=addr,
            )
        elif p.bus == "onewire":
            guess = self._make_guess(
                p,
                event_id=event_id,
                bcm=4,
                confidence=0.9,
                detail="Simulated 1-Wire DS18B20",
                one_wire_id="28-00000SIM0001",
            )
        else:
            bcm = p.default_bcm or 17
            guess = self._make_guess(
                p,
                event_id=event_id,
                bcm=bcm,
                confidence=0.55,
                detail=f"Simulated digital activity on BCM {bcm}",
            )
        self._pending[event_id] = guess
        return guess

    def _poll_simulate(self) -> list[ProbeGuess]:
        # Auto-advance a demo sequence slowly so UI can be exercised without clicks.
        self._sim_step += 1
        if self._sim_step == 3 and "sim-auto-temp" not in self._pending:
            g = self.inject_simulation("ds18b20")
            # rewrite id for auto demo uniqueness control
            self._pending.pop(g.event_id, None)
            g.event_id = "sim-auto-temp"
            self._pending[g.event_id] = g
            return [g]
        return []

    def _scan_onewire(self) -> list[ProbeGuess]:
        root = Path("/sys/bus/w1/devices")
        if not root.exists():
            return []
        found: list[ProbeGuess] = []
        for entry in root.iterdir():
            name = entry.name
            if not name.startswith("28-"):
                continue
            if name in self._known_onewire:
                continue
            self._known_onewire.add(name)
            event_id = f"ow-{name}"
            if event_id in self._ignored_event_ids or event_id in self._confirmed_event_ids:
                continue
            p = CATALOG_BY_ID["ds18b20"]
            guess = self._make_guess(
                p,
                event_id=event_id,
                bcm=4,
                confidence=0.92,
                detail=f"1-Wire device {name}",
                one_wire_id=name,
            )
            self._pending[event_id] = guess
            found.append(guess)
        return found

    def _scan_i2c(self) -> list[ProbeGuess]:
        bus_path = Path("/dev/i2c-1")
        if not bus_path.exists():
            return []
        try:
            # Prefer smbus2 if available; otherwise parse i2cdetect output.
            addresses = self._i2c_scan_addresses()
        except OSError:
            return []

        found: list[ProbeGuess] = []
        for addr in addresses:
            if addr in self._known_i2c:
                continue
            self._known_i2c.add(addr)
            event_id = f"i2c-{addr:02x}"
            if event_id in self._ignored_event_ids or event_id in self._confirmed_event_ids:
                continue
            peripheral = self._guess_i2c(addr)
            guess = self._make_guess(
                peripheral,
                event_id=event_id,
                bcm=2,
                confidence=0.75 if peripheral.id != "ph_i2c" or addr in peripheral.i2c_addresses else 0.45,
                detail=f"I2C ACK at 0x{addr:02X}",
                i2c_address=addr,
            )
            # Also highlight SCL
            if 5 not in guess.physical:
                guess.physical = sorted(set(guess.physical + physical_pins_for_bcm(3)))
            self._pending[event_id] = guess
            found.append(guess)
        return found

    def _i2c_scan_addresses(self) -> list[int]:
        try:
            from smbus2 import SMBus  # type: ignore

            addrs: list[int] = []
            with SMBus(1) as bus:
                for addr in range(0x08, 0x78):
                    try:
                        bus.write_quick(addr)
                        addrs.append(addr)
                    except OSError:
                        continue
            return addrs
        except ImportError:
            pass

        # Fallback: i2cdetect -y 1
        import subprocess

        try:
            out = subprocess.check_output(
                ["i2cdetect", "-y", "1"],
                text=True,
                timeout=5,
            )
        except (subprocess.SubprocessError, FileNotFoundError):
            return []
        addrs: list[int] = []
        for line in out.splitlines()[1:]:
            parts = line.split(":")
            if len(parts) != 2:
                continue
            for token in parts[1].split():
                if len(token) == 2 and token != "--" and token != "UU":
                    try:
                        addrs.append(int(token, 16))
                    except ValueError:
                        continue
        return addrs

    def _guess_i2c(self, addr: int) -> Peripheral:
        for pid in ("ph_i2c", "pressure_i2c"):
            p = CATALOG_BY_ID[pid]
            if addr in p.i2c_addresses:
                return p
        return CATALOG_BY_ID["ph_i2c"]

    def _scan_digital_activity(self) -> list[ProbeGuess]:
        """Best-effort: watch exported GPIOs for unexpected pulls (optional)."""
        # Without gpiozero / dedicated HAT, digital plug detection is weak.
        # We only report pins that appear under /sys/class/gpio with value flips
        # if BIOVERSEE_WATCH_GPIO is set.
        watch = os.environ.get("BIOVERSEE_WATCH_GPIO", "")
        if not watch:
            return []
        found: list[ProbeGuess] = []
        for token in watch.split(","):
            token = token.strip()
            if not token.isdigit():
                continue
            bcm = int(token)
            if bcm in self._known_digital:
                continue
            value_path = Path(f"/sys/class/gpio/gpio{bcm}/value")
            if not value_path.exists():
                continue
            try:
                val = value_path.read_text().strip()
            except OSError:
                continue
            if val not in ("0", "1"):
                continue
            self._known_digital.add(bcm)
            event_id = f"dio-{bcm}"
            if event_id in self._ignored_event_ids or event_id in self._confirmed_event_ids:
                continue
            p = CATALOG_BY_ID["digital_unknown"]
            guess = self._make_guess(
                p,
                event_id=event_id,
                bcm=bcm,
                confidence=0.4,
                detail=f"Digital level seen on BCM {bcm}",
            )
            self._pending[event_id] = guess
            found.append(guess)
        return found

    def _make_guess(
        self,
        p: Peripheral,
        *,
        event_id: str,
        bcm: int | None,
        confidence: float,
        detail: str,
        i2c_address: int | None = None,
        one_wire_id: str | None = None,
    ) -> ProbeGuess:
        physical: list[int] = []
        if bcm is not None:
            physical = physical_pins_for_bcm(bcm)
        return ProbeGuess(
            id=p.id,
            event_id=event_id,
            label=p.label,
            role=p.role,
            name=p.name,
            driver=p.driver,
            bus=p.bus,
            bcm=bcm,
            physical=physical,
            confidence=confidence,
            detail=detail,
            i2c_address=i2c_address,
            one_wire_id=one_wire_id,
        )


# Process-wide probe singleton for the wizard process.
probe_service = ProbeService()
