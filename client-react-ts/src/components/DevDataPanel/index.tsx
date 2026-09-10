import { FormEvent, useEffect, useState } from "react";
import {
  insertSensorReading,
  insertSliderState,
  insertSwitchState,
} from "../../lib/actuators";
import {
  getMyDevicesByType,
  type Device,
  type DeviceType,
} from "../../lib/devices";
import type { AppUser } from "../../lib/user";
import { ToastStack, useToasts } from "../Toast";
import "./DevDataPanel.css";

type NamedPreset = { name: string; label: string; sample?: number };
type PresetGroup = {
  deviceType: DeviceType;
  device: string;
  items: NamedPreset[];
};

const SENSOR_GROUPS: PresetGroup[] = [
  {
    deviceType: "bioreactor",
    device: "Bioreactor",
    items: [
      { name: "temperature", label: "Temperature", sample: 28.4 },
      { name: "ph", label: "pH", sample: 6.8 },
    ],
  },
  {
    deviceType: "pressure_vessel",
    device: "Pressure Vessel",
    items: [{ name: "vesselLevel", label: "Water level %", sample: 52 }],
  },
  {
    deviceType: "membrane_bioreactor",
    device: "Membrane MBR",
    items: [{ name: "mbrTankLevel", label: "Tank level %", sample: 95 }],
  },
  {
    deviceType: "water_purifier",
    device: "Water Purifier",
    items: [
      { name: "pufferwtlvl", label: "Puffer water level", sample: 62 },
    ],
  },
];

const SLIDER_GROUPS: PresetGroup[] = [
  {
    deviceType: "bioreactor",
    device: "Bioreactor",
    items: [
      { name: "rotor", label: "Rotor", sample: 45 },
      { name: "aerator", label: "Aerator", sample: 55 },
    ],
  },
  {
    deviceType: "pressure_vessel",
    device: "Pressure Vessel",
    items: [{ name: "vesselLevel", label: "Water level", sample: 50 }],
  },
  {
    deviceType: "membrane_bioreactor",
    device: "Membrane MBR",
    items: [
      { name: "mbrAerationLevel", label: "Aeration intensity", sample: 50 },
    ],
  },
  {
    deviceType: "water_purifier",
    device: "Water Purifier",
    items: [{ name: "agitator", label: "Agitator", sample: 40 }],
  },
];

const SWITCH_GROUPS: PresetGroup[] = [
  {
    deviceType: "bioreactor",
    device: "Bioreactor",
    items: [
      { name: "switchWarmWaterPump", label: "Warm water pump" },
      { name: "switchColdWaterPump", label: "Cold water pump" },
      { name: "switchAcidPump", label: "Acid pump" },
      { name: "switchBasePump", label: "Base pump" },
    ],
  },
  {
    deviceType: "membrane_bioreactor",
    device: "Membrane MBR",
    items: [
      { name: "mbrFlow", label: "Circulation flow" },
      { name: "mbrAeration", label: "Diffuser aeration" },
    ],
  },
  {
    deviceType: "water_purifier",
    device: "Water Purifier",
    items: [
      { name: "switchPump1", label: "Puffer → Active" },
      { name: "switchPump2", label: "Additive → Active" },
      { name: "switchPump3", label: "Active → Clean" },
    ],
  },
];

const ALL_SENSORS = SENSOR_GROUPS.flatMap((g) =>
  g.items.map((item) => ({ ...item, deviceType: g.deviceType })),
);
const ALL_SLIDERS = SLIDER_GROUPS.flatMap((g) =>
  g.items.map((item) => ({ ...item, deviceType: g.deviceType })),
);
const ALL_SWITCHES = SWITCH_GROUPS.flatMap((g) =>
  g.items.map((item) => ({ ...item, deviceType: g.deviceType })),
);

type DevDataPanelProps = {
  open: boolean;
  onClose: () => void;
  user: AppUser;
};

function DevDataPanel({ open, onClose, user }: DevDataPanelProps) {
  const [devicesByType, setDevicesByType] = useState<
    Partial<Record<DeviceType, Device>>
  >({});
  const [sensorName, setSensorName] = useState(ALL_SENSORS[0].name);
  const [sensorValue, setSensorValue] = useState(
    String(ALL_SENSORS[0].sample ?? 0),
  );
  const [sliderName, setSliderName] = useState(ALL_SLIDERS[0].name);
  const [sliderValue, setSliderValue] = useState(
    String(ALL_SLIDERS[0].sample ?? 0),
  );
  const [switchName, setSwitchName] = useState(ALL_SWITCHES[0].name);
  const [switchValue, setSwitchValue] = useState(true);
  const [busy, setBusy] = useState(false);
  const { toasts, push, replace, dismiss } = useToasts();

  useEffect(() => {
    if (!open) return;
    getMyDevicesByType()
      .then(setDevicesByType)
      .catch((error) => console.error(error));
  }, [open, user.id]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const deviceIdFor = (type: DeviceType) => {
    const device = devicesByType[type];
    if (!device) throw new Error(`Device not ready: ${type}`);
    return device.id;
  };

  const run = async (
    action: () => Promise<void>,
    pendingTitle: string,
    okTitle: string,
    okDetail?: string,
  ) => {
    setBusy(true);
    const toastId = push("info", pendingTitle, "Writing to your devices…");
    try {
      await action();
      replace(toastId, "success", okTitle, okDetail ?? "Upload complete");
    } catch (err) {
      replace(
        toastId,
        "error",
        "Upload failed",
        err instanceof Error ? err.message : "Failed to write data",
      );
    } finally {
      setBusy(false);
    }
  };

  const onSensorSubmit = (event: FormEvent) => {
    event.preventDefault();
    const preset = ALL_SENSORS.find((p) => p.name === sensorName);
    if (!preset) return;
    const value = Number(sensorValue);
    void run(
      () =>
        insertSensorReading(
          deviceIdFor(preset.deviceType),
          sensorName,
          value,
          user.id,
        ),
      "Sending sensor…",
      "Sensor uploaded",
      `${sensorName} = ${value}`,
    );
  };

  const onSliderSubmit = (event: FormEvent) => {
    event.preventDefault();
    const preset = ALL_SLIDERS.find((p) => p.name === sliderName);
    if (!preset) return;
    const value = Number(sliderValue);
    void run(
      () =>
        insertSliderState(
          deviceIdFor(preset.deviceType),
          sliderName,
          value,
          user.id,
        ),
      "Sending slider…",
      "Slider uploaded",
      `${sliderName} = ${value}%`,
    );
  };

  const onSwitchSubmit = (event: FormEvent) => {
    event.preventDefault();
    const preset = ALL_SWITCHES.find((p) => p.name === switchName);
    if (!preset) return;
    void run(
      () =>
        insertSwitchState(
          deviceIdFor(preset.deviceType),
          switchName,
          switchValue,
          user.id,
        ),
      "Sending switch…",
      "Switch uploaded",
      `${switchName} = ${switchValue ? "ON" : "OFF"}`,
    );
  };

  const seedDemoBundle = () =>
    run(
      async () => {
        const byType = await getMyDevicesByType();
        setDevicesByType(byType);

        const bio = byType.bioreactor!.id;
        const vessel = byType.pressure_vessel!.id;
        const mbr = byType.membrane_bioreactor!.id;
        const water = byType.water_purifier!.id;

        await insertSensorReading(
          bio,
          "temperature",
          27 + Math.random() * 4,
          user.id,
        );
        await insertSensorReading(bio, "ph", 6.5 + Math.random() * 0.8, user.id);
        await insertSliderState(
          bio,
          "rotor",
          40 + Math.round(Math.random() * 40),
          user.id,
        );
        await insertSliderState(
          bio,
          "aerator",
          35 + Math.round(Math.random() * 45),
          user.id,
        );
        await insertSwitchState(bio, "switchWarmWaterPump", true, user.id);
        await insertSwitchState(bio, "switchColdWaterPump", false, user.id);

        const vesselPct = 35 + Math.round(Math.random() * 45);
        await insertSensorReading(vessel, "vesselLevel", vesselPct, user.id);
        await insertSliderState(vessel, "vesselLevel", vesselPct, user.id);

        const aerationLevels = [25, 50, 75, 100] as const;
        const aeration =
          aerationLevels[Math.floor(Math.random() * aerationLevels.length)];
        await insertSensorReading(
          mbr,
          "mbrTankLevel",
          92 + Math.random() * 6,
          user.id,
        );
        await insertSliderState(mbr, "mbrAerationLevel", aeration, user.id);
        await insertSwitchState(mbr, "mbrFlow", Math.random() > 0.4, user.id);
        await insertSwitchState(
          mbr,
          "mbrAeration",
          Math.random() > 0.35,
          user.id,
        );

        await insertSensorReading(
          water,
          "pufferwtlvl",
          50 + Math.random() * 30,
          user.id,
        );
        await insertSliderState(
          water,
          "agitator",
          30 + Math.round(Math.random() * 50),
          user.id,
        );
        await insertSwitchState(
          water,
          "switchPump1",
          Math.random() > 0.5,
          user.id,
        );
      },
      "Seeding your devices…",
      "Demo bundle uploaded",
      "Only your four devices were seeded",
    );

  const devicesReady = Object.keys(devicesByType).length >= 4;

  return (
    <>
      <div
        className={`dev-panel__veil ${open ? "is-open" : ""}`}
        onClick={onClose}
        aria-hidden={!open}
      />
      <aside
        className={`dev-panel ${open ? "is-open" : ""}`}
        aria-hidden={!open}
        aria-label="Dev data injector"
      >
        <header className="dev-panel__header">
          <div>
            <p className="dev-panel__eyebrow">Developer</p>
            <h2 className="dev-panel__title">Fake data injector</h2>
          </div>
          <button type="button" className="dev-panel__close" onClick={onClose}>
            Close
          </button>
        </header>

        <p className="dev-panel__hint">
          Shortcut <kbd>L</kbd> + <kbd>B</kbd> · Esc to dismiss · Writes only to{" "}
          <strong>your</strong> devices
        </p>

        {!devicesReady && (
          <p className="dev-panel__hint">Provisioning your devices…</p>
        )}

        <button
          type="button"
          className="dev-panel__seed"
          disabled={busy || !devicesReady}
          onClick={seedDemoBundle}
        >
          Seed random demo bundle
        </button>

        <form className="dev-panel__section" onSubmit={onSensorSubmit}>
          <h3>Sensor reading</h3>
          <label>
            <span>Name</span>
            <select
              value={sensorName}
              onChange={(e) => {
                const next = e.target.value;
                setSensorName(next);
                const preset = ALL_SENSORS.find((p) => p.name === next);
                if (preset?.sample != null) {
                  setSensorValue(String(preset.sample));
                }
              }}
            >
              {SENSOR_GROUPS.map((group) => (
                <optgroup key={group.device} label={group.device}>
                  {group.items.map((preset) => (
                    <option key={preset.name} value={preset.name}>
                      {preset.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label>
            <span>Value</span>
            <input
              type="number"
              step="any"
              value={sensorValue}
              onChange={(e) => setSensorValue(e.target.value)}
              required
            />
          </label>
          <button type="submit" disabled={busy || !devicesReady}>
            Send sensor
          </button>
        </form>

        <form className="dev-panel__section" onSubmit={onSliderSubmit}>
          <h3>Slider actuator</h3>
          <label>
            <span>Name</span>
            <select
              value={sliderName}
              onChange={(e) => {
                const next = e.target.value;
                setSliderName(next);
                const preset = ALL_SLIDERS.find((p) => p.name === next);
                if (preset?.sample != null) {
                  setSliderValue(String(preset.sample));
                }
              }}
            >
              {SLIDER_GROUPS.map((group) => (
                <optgroup key={group.device} label={group.device}>
                  {group.items.map((preset) => (
                    <option key={preset.name} value={preset.name}>
                      {preset.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label>
            <span>State %</span>
            <input
              type="number"
              min={0}
              max={100}
              value={sliderValue}
              onChange={(e) => setSliderValue(e.target.value)}
              required
            />
          </label>
          <button type="submit" disabled={busy || !devicesReady}>
            Send slider
          </button>
        </form>

        <form className="dev-panel__section" onSubmit={onSwitchSubmit}>
          <h3>Switch actuator</h3>
          <label>
            <span>Name</span>
            <select
              value={switchName}
              onChange={(e) => setSwitchName(e.target.value)}
            >
              {SWITCH_GROUPS.map((group) => (
                <optgroup key={group.device} label={group.device}>
                  {group.items.map((preset) => (
                    <option key={preset.name} value={preset.name}>
                      {preset.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="dev-panel__toggle">
            <input
              type="checkbox"
              checked={switchValue}
              onChange={(e) => setSwitchValue(e.target.checked)}
            />
            <span>{switchValue ? "ON" : "OFF"}</span>
          </label>
          <button type="submit" disabled={busy || !devicesReady}>
            Send switch
          </button>
        </form>
      </aside>

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </>
  );
}

export default DevDataPanel;
