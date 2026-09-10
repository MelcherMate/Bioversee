import { FormEvent, useEffect, useState } from "react";
import {
  insertSensorReading,
  insertSliderState,
  insertSwitchState,
} from "../../lib/actuators";
import type { AppUser } from "../../lib/user";
import "./DevDataPanel.css";

const SENSOR_PRESETS = [
  { name: "temperature", label: "Temperature", sample: 28.4 },
  { name: "ph", label: "pH", sample: 6.8 },
  { name: "pufferwtlvl", label: "Puffer water level", sample: 62 },
];

const SLIDER_PRESETS = [
  { name: "rotor", label: "Rotor", sample: 45 },
  { name: "aerator", label: "Aerator", sample: 55 },
  { name: "agitator", label: "Agitator", sample: 40 },
];

const SWITCH_PRESETS = [
  { name: "switchWarmWaterPump", label: "Warm water pump" },
  { name: "switchColdWaterPump", label: "Cold water pump" },
  { name: "switchAcidPump", label: "Acid pump" },
  { name: "switchBasePump", label: "Base pump" },
  { name: "switchPump1", label: "Puffer → Active" },
  { name: "switchPump2", label: "Additive → Active" },
  { name: "switchPump3", label: "Active → Clean" },
];

type DevDataPanelProps = {
  open: boolean;
  onClose: () => void;
  user: AppUser;
};

function DevDataPanel({ open, onClose, user }: DevDataPanelProps) {
  const [sensorName, setSensorName] = useState(SENSOR_PRESETS[0].name);
  const [sensorValue, setSensorValue] = useState(String(SENSOR_PRESETS[0].sample));
  const [sliderName, setSliderName] = useState(SLIDER_PRESETS[0].name);
  const [sliderValue, setSliderValue] = useState(String(SLIDER_PRESETS[0].sample));
  const [switchName, setSwitchName] = useState(SWITCH_PRESETS[0].name);
  const [switchValue, setSwitchValue] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const run = async (action: () => Promise<void>, okMessage: string) => {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      await action();
      setStatus(okMessage);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to write data");
    } finally {
      setBusy(false);
    }
  };

  const onSensorSubmit = (event: FormEvent) => {
    event.preventDefault();
    const value = Number(sensorValue);
    void run(
      () => insertSensorReading(sensorName, value),
      `Sensor “${sensorName}” = ${value}`
    );
  };

  const onSliderSubmit = (event: FormEvent) => {
    event.preventDefault();
    const value = Number(sliderValue);
    void run(
      () => insertSliderState(sliderName, value, user.id),
      `Slider “${sliderName}” = ${value}%`
    );
  };

  const onSwitchSubmit = (event: FormEvent) => {
    event.preventDefault();
    void run(
      () => insertSwitchState(switchName, switchValue, user.id),
      `Switch “${switchName}” = ${switchValue ? "ON" : "OFF"}`
    );
  };

  const seedDemoBundle = () =>
    run(async () => {
      await insertSensorReading("temperature", 27 + Math.random() * 4);
      await insertSensorReading("ph", 6.5 + Math.random() * 0.8);
      await insertSensorReading("pufferwtlvl", 50 + Math.random() * 30);
      await insertSliderState("rotor", 40 + Math.round(Math.random() * 40), user.id);
      await insertSliderState(
        "aerator",
        35 + Math.round(Math.random() * 45),
        user.id
      );
      await insertSwitchState("switchWarmWaterPump", true, user.id);
      await insertSwitchState("switchColdWaterPump", false, user.id);
    }, "Demo bundle written");

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
          Shortcut <kbd>L</kbd> + <kbd>B</kbd> · Esc to dismiss
        </p>

        <button
          type="button"
          className="dev-panel__seed"
          disabled={busy}
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
                const preset = SENSOR_PRESETS.find((p) => p.name === next);
                if (preset) setSensorValue(String(preset.sample));
              }}
            >
              {SENSOR_PRESETS.map((preset) => (
                <option key={preset.name} value={preset.name}>
                  {preset.label}
                </option>
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
          <button type="submit" disabled={busy}>
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
                const preset = SLIDER_PRESETS.find((p) => p.name === next);
                if (preset) setSliderValue(String(preset.sample));
              }}
            >
              {SLIDER_PRESETS.map((preset) => (
                <option key={preset.name} value={preset.name}>
                  {preset.label}
                </option>
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
          <button type="submit" disabled={busy}>
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
              {SWITCH_PRESETS.map((preset) => (
                <option key={preset.name} value={preset.name}>
                  {preset.label}
                </option>
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
          <button type="submit" disabled={busy}>
            Send switch
          </button>
        </form>

        {status && <p className="dev-panel__status">{status}</p>}
        {error && <p className="dev-panel__error">{error}</p>}
      </aside>
    </>
  );
}

export default DevDataPanel;
