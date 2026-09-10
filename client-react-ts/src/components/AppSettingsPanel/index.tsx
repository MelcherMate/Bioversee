import { useEffect, useRef } from "react";
import {
  ACCENT_PRESETS,
  LANGUAGE_OPTIONS,
  type ThemePreference,
} from "../../lib/appearance";
import { useAppearance } from "../../lib/AppearanceProvider";
import SegmentedControl from "../SegmentedControl";
import "./AppSettingsPanel.css";

type AppSettingsPanelProps = {
  open: boolean;
  onClose: () => void;
};

function AppSettingsPanel({ open, onClose }: AppSettingsPanelProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const { settings, setTheme, setAccent, setLanguage } = useAppearance();

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (
        panelRef.current &&
        event.target instanceof Node &&
        !panelRef.current.contains(event.target)
      ) {
        onClose();
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="app-settings"
      ref={panelRef}
      role="dialog"
      aria-label="Settings"
    >
      <div className="app-settings__head">
        <div>
          <p className="app-settings__eyebrow">Settings</p>
          <h2 className="app-settings__title">Appearance</h2>
        </div>
        <button
          type="button"
          className="app-settings__close"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
      </div>

      <section className="app-settings__section">
        <p className="app-settings__label">Theme</p>
        <SegmentedControl
          aria-label="Theme"
          shape="rounded"
          accent
          value={settings.theme}
          onChange={(value) => setTheme(value as ThemePreference)}
          options={[
            { value: "light", label: "Light" },
            { value: "dark", label: "Dark" },
            { value: "system", label: "System" },
          ]}
        />
      </section>

      <section className="app-settings__section">
        <p className="app-settings__label">Accent color</p>
        <div
          className="app-settings__swatches"
          role="listbox"
          aria-label="Accent color"
        >
          {ACCENT_PRESETS.map((preset) => {
            const selected =
              settings.accent.toLowerCase() === preset.value.toLowerCase();
            return (
              <button
                key={preset.id}
                type="button"
                role="option"
                aria-selected={selected}
                className={`app-settings__swatch${selected ? " is-selected" : ""}`}
                style={{ background: preset.value }}
                title={preset.label}
                aria-label={preset.label}
                onClick={() => setAccent(preset.value)}
              />
            );
          })}
        </div>
        <div className="app-settings__swatch-labels">
          {ACCENT_PRESETS.map((preset) => (
            <span key={preset.id}>{preset.label}</span>
          ))}
        </div>
      </section>

      <section className="app-settings__section">
        <label className="app-settings__label" htmlFor="app-settings-language">
          Language
        </label>
        <select
          id="app-settings-language"
          className="app-settings__select"
          value={settings.language}
          onChange={(event) =>
            setLanguage(event.target.value as typeof settings.language)
          }
        >
          {LANGUAGE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.native} ({option.label})
            </option>
          ))}
        </select>
        <p className="app-settings__hint">
          Saved to your account. Full UI translation comes next.
        </p>
      </section>
    </div>
  );
}

export default AppSettingsPanel;
