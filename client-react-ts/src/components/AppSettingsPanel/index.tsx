import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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
      aria-label={t("nav.settings")}
    >
      <div className="app-settings__head">
        <div>
          <p className="app-settings__eyebrow">{t("appearance.eyebrow")}</p>
          <h2 className="app-settings__title">{t("appearance.title")}</h2>
        </div>
        <button
          type="button"
          className="app-settings__close"
          onClick={onClose}
          aria-label={t("common.close")}
        >
          ×
        </button>
      </div>

      <section className="app-settings__section">
        <p className="app-settings__label">{t("appearance.theme")}</p>
        <SegmentedControl
          aria-label={t("appearance.theme")}
          shape="rounded"
          accent
          value={settings.theme}
          onChange={(value) => setTheme(value as ThemePreference)}
          options={[
            { value: "light", label: t("appearance.light") },
            {
              value: "dark",
              label: (
                <span className="app-settings__seg-label">
                  {t("appearance.dark")}
                  <span className="app-settings__beta">{t("common.beta")}</span>
                </span>
              ),
              ariaLabel: `${t("appearance.dark")} (${t("common.beta")})`,
            },
            { value: "system", label: t("appearance.system") },
          ]}
        />
      </section>

      <section className="app-settings__section">
        <p className="app-settings__label">{t("appearance.accent")}</p>
        <div
          className="app-settings__swatches"
          role="listbox"
          aria-label={t("appearance.accent")}
        >
          {ACCENT_PRESETS.map((preset) => {
            const selected =
              settings.accent.toLowerCase() === preset.value.toLowerCase();
            const label = t(`appearance.${preset.id}`);
            return (
              <button
                key={preset.id}
                type="button"
                role="option"
                aria-selected={selected}
                className={`app-settings__swatch${selected ? " is-selected" : ""}`}
                style={{ background: preset.value }}
                title={label}
                aria-label={label}
                onClick={() => setAccent(preset.value)}
              />
            );
          })}
        </div>
        <div className="app-settings__swatch-labels">
          {ACCENT_PRESETS.map((preset) => (
            <span key={preset.id}>{t(`appearance.${preset.id}`)}</span>
          ))}
        </div>
      </section>

      <section className="app-settings__section">
        <p className="app-settings__label">{t("appearance.language")}</p>
        <SegmentedControl
          aria-label={t("appearance.language")}
          shape="rounded"
          accent
          className="app-settings__lang"
          value={settings.language}
          onChange={(value) =>
            setLanguage(value as typeof settings.language)
          }
          options={LANGUAGE_OPTIONS.map((option) => {
            const isBeta = option.value === "de" || option.value === "hu";
            return {
              value: option.value,
              ariaLabel: isBeta
                ? `${option.native} (${t("common.beta")})`
                : option.native,
              label: (
                <span className="app-settings__seg-label">
                  <span className="app-settings__lang-code">
                    {option.value.toUpperCase()}
                  </span>
                  {isBeta ? (
                    <span className="app-settings__beta">
                      {t("common.beta")}
                    </span>
                  ) : null}
                </span>
              ),
            };
          })}
        />
        <p className="app-settings__hint">{t("appearance.hint")}</p>
      </section>
    </div>
  );
}

export default AppSettingsPanel;
