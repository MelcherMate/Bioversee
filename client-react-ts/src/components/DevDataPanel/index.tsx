import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  insertSensorReading,
  insertSliderState,
  insertSwitchState,
} from "../../lib/actuators";
import {
  listAccessibleDevices,
  type AccessibleDevice,
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
      { name: "pressure", label: "Pressure (psi)", sample: 14.7 },
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

type DevDataPanelProps = {
  open: boolean;
  onClose: () => void;
  user: AppUser;
};

function presetsForType(groups: PresetGroup[], type: DeviceType | null) {
  if (!type) return [];
  return groups.find((g) => g.deviceType === type)?.items ?? [];
}

function DevDataPanel({ open, onClose, user }: DevDataPanelProps) {
  const [devices, setDevices] = useState<AccessibleDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [sensorName, setSensorName] = useState("");
  const [sensorValue, setSensorValue] = useState("0");
  const [sliderName, setSliderName] = useState("");
  const [sliderValue, setSliderValue] = useState("0");
  const [switchName, setSwitchName] = useState("");
  const [switchValue, setSwitchValue] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const { toasts, push, replace, dismiss } = useToasts();

  const selectedDevice =
    devices.find((device) => device.id === selectedDeviceId) ?? null;
  const selectedType = selectedDevice?.type ?? null;

  const sensorPresets = useMemo(
    () => presetsForType(SENSOR_GROUPS, selectedType),
    [selectedType],
  );
  const sliderPresets = useMemo(
    () => presetsForType(SLIDER_GROUPS, selectedType),
    [selectedType],
  );
  const switchPresets = useMemo(
    () => presetsForType(SWITCH_GROUPS, selectedType),
    [selectedType],
  );

  const applyPresetsForType = (type: DeviceType) => {
    const sensors = presetsForType(SENSOR_GROUPS, type);
    const sliders = presetsForType(SLIDER_GROUPS, type);
    const switches = presetsForType(SWITCH_GROUPS, type);
    setSensorName(sensors[0]?.name ?? "");
    setSensorValue(String(sensors[0]?.sample ?? 0));
    setSliderName(sliders[0]?.name ?? "");
    setSliderValue(String(sliders[0]?.sample ?? 0));
    setSwitchName(switches[0]?.name ?? "");
  };

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingDevices(true);
    listAccessibleDevices()
      .then((list) => {
        if (cancelled) return;
        setDevices(list);
        const stillValid =
          selectedDeviceId && list.some((device) => device.id === selectedDeviceId);
        const next = stillValid
          ? list.find((device) => device.id === selectedDeviceId)!
          : list[0];
        if (next) {
          setSelectedDeviceId(next.id);
          applyPresetsForType(next.type);
        } else {
          setSelectedDeviceId("");
        }
      })
      .catch((error) => console.error(error))
      .finally(() => {
        if (!cancelled) setLoadingDevices(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, user.id]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const requireSelectedDevice = () => {
    if (!selectedDevice) {
      throw new Error("Select a device first");
    }
    return selectedDevice;
  };

  const run = async (
    action: () => Promise<void>,
    pendingTitle: string,
    okTitle: string,
    okDetail?: string,
  ) => {
    setBusy(true);
    const toastId = push("info", pendingTitle, "Writing to selected device…");
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
    if (!sensorName) return;
    const value = Number(sensorValue);
    void run(
      async () => {
        const device = requireSelectedDevice();
        await insertSensorReading(device.id, sensorName, value, user.id);
      },
      "Sending sensor…",
      "Sensor uploaded",
      `${sensorName} = ${value}`,
    );
  };

  const onSliderSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!sliderName) return;
    const value = Number(sliderValue);
    void run(
      async () => {
        const device = requireSelectedDevice();
        await insertSliderState(device.id, sliderName, value, user.id);
      },
      "Sending slider…",
      "Slider uploaded",
      `${sliderName} = ${value}%`,
    );
  };

  const onSwitchSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!switchName) return;
    void run(
      async () => {
        const device = requireSelectedDevice();
        await insertSwitchState(device.id, switchName, switchValue, user.id);
      },
      "Sending switch…",
      "Switch uploaded",
      `${switchName} = ${switchValue ? "ON" : "OFF"}`,
    );
  };

  const seedDemoBundle = () =>
    run(
      async () => {
        const device = requireSelectedDevice();
        const id = device.id;

        if (device.type === "bioreactor") {
          await insertSensorReading(
            id,
            "temperature",
            27 + Math.random() * 4,
            user.id,
          );
          await insertSensorReading(
            id,
            "ph",
            6.5 + Math.random() * 0.8,
            user.id,
          );
          await insertSensorReading(
            id,
            "pressure",
            12 + Math.random() * 6,
            user.id,
          );
          await insertSliderState(
            id,
            "rotor",
            40 + Math.round(Math.random() * 40),
            user.id,
          );
          await insertSliderState(
            id,
            "aerator",
            35 + Math.round(Math.random() * 45),
            user.id,
          );
          await insertSwitchState(id, "switchWarmWaterPump", true, user.id);
          await insertSwitchState(id, "switchColdWaterPump", false, user.id);
          return;
        }

        if (device.type === "pressure_vessel") {
          const vesselPct = 35 + Math.round(Math.random() * 45);
          await insertSensorReading(id, "vesselLevel", vesselPct, user.id);
          await insertSliderState(id, "vesselLevel", vesselPct, user.id);
          return;
        }

        if (device.type === "membrane_bioreactor") {
          await insertSensorReading(id, "mbrTankLevel", 95, user.id);
          await insertSliderState(
            id,
            "mbrAerationLevel",
            50 + Math.round(Math.random() * 40),
            user.id,
          );
          await insertSwitchState(id, "mbrFlow", true, user.id);
          await insertSwitchState(id, "mbrAeration", true, user.id);
          return;
        }

        if (device.type === "water_purifier") {
          await insertSensorReading(
            id,
            "pufferwtlvl",
            50 + Math.round(Math.random() * 40),
            user.id,
          );
          await insertSliderState(
            id,
            "agitator",
            30 + Math.round(Math.random() * 50),
            user.id,
          );
          await insertSwitchState(id, "switchPump1", true, user.id);
        }
      },
      "Seeding demo data…",
      "Demo bundle uploaded",
      selectedDevice
        ? `Seeded ${selectedDevice.name}`
        : "Seed complete",
    );

  const devicesReady = devices.length > 0 && Boolean(selectedDeviceId);
  const canSend = devicesReady && !busy;

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
          Shortcut <kbd>L</kbd> + <kbd>B</kbd> · Esc to dismiss · Writes to the{" "}
          <strong>selected</strong> device
        </p>

        <label className="dev-panel__target">
          <span>Target device</span>
          <select
            value={selectedDeviceId}
            disabled={loadingDevices || devices.length === 0}
            onChange={(e) => {
              const nextId = e.target.value;
              setSelectedDeviceId(nextId);
              const next = devices.find((device) => device.id === nextId);
              if (next) applyPresetsForType(next.type);
            }}
          >
            {devices.length === 0 ? (
              <option value="">No devices available</option>
            ) : (
              devices.map((device) => (
                <option key={device.id} value={device.id}>
                  {device.name} · {device.type.replace(/_/g, " ")}
                  {device.isOwner ? "" : " · shared"}
                </option>
              ))
            )}
          </select>
        </label>

        {loadingDevices && (
          <p className="dev-panel__hint">Loading your devices…</p>
        )}
        {!loadingDevices && devices.length === 0 && (
          <p className="dev-panel__hint">
            Create or accept a device first, then reopen this panel.
          </p>
        )}

        <button
          type="button"
          className="dev-panel__seed"
          disabled={!canSend}
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
              disabled={sensorPresets.length === 0}
              onChange={(e) => {
                const next = e.target.value;
                setSensorName(next);
                const preset = sensorPresets.find((p) => p.name === next);
                if (preset?.sample != null) {
                  setSensorValue(String(preset.sample));
                }
              }}
            >
              {sensorPresets.length === 0 ? (
                <option value="">No sensors for this type</option>
              ) : (
                sensorPresets.map((preset) => (
                  <option key={preset.name} value={preset.name}>
                    {preset.label}
                  </option>
                ))
              )}
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
              disabled={sensorPresets.length === 0}
            />
          </label>
          <button type="submit" disabled={!canSend || !sensorName}>
            Send sensor
          </button>
        </form>

        <form className="dev-panel__section" onSubmit={onSliderSubmit}>
          <h3>Slider actuator</h3>
          <label>
            <span>Name</span>
            <select
              value={sliderName}
              disabled={sliderPresets.length === 0}
              onChange={(e) => {
                const next = e.target.value;
                setSliderName(next);
                const preset = sliderPresets.find((p) => p.name === next);
                if (preset?.sample != null) {
                  setSliderValue(String(preset.sample));
                }
              }}
            >
              {sliderPresets.length === 0 ? (
                <option value="">No sliders for this type</option>
              ) : (
                sliderPresets.map((preset) => (
                  <option key={preset.name} value={preset.name}>
                    {preset.label}
                  </option>
                ))
              )}
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
              disabled={sliderPresets.length === 0}
            />
          </label>
          <button type="submit" disabled={!canSend || !sliderName}>
            Send slider
          </button>
        </form>

        <form className="dev-panel__section" onSubmit={onSwitchSubmit}>
          <h3>Switch actuator</h3>
          <label>
            <span>Name</span>
            <select
              value={switchName}
              disabled={switchPresets.length === 0}
              onChange={(e) => setSwitchName(e.target.value)}
            >
              {switchPresets.length === 0 ? (
                <option value="">No switches for this type</option>
              ) : (
                switchPresets.map((preset) => (
                  <option key={preset.name} value={preset.name}>
                    {preset.label}
                  </option>
                ))
              )}
            </select>
          </label>
          <label className="dev-panel__toggle">
            <input
              type="checkbox"
              checked={switchValue}
              onChange={(e) => setSwitchValue(e.target.checked)}
              disabled={switchPresets.length === 0}
            />
            <span>{switchValue ? "ON" : "OFF"}</span>
          </label>
          <button type="submit" disabled={!canSend || !switchName}>
            Send switch
          </button>
        </form>
      </aside>

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </>
  );
}

export default DevDataPanel;
