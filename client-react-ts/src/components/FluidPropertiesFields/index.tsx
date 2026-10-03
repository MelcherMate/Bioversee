import { useTranslation } from "react-i18next";
import {
  FLUID_LIMITS,
  FLUID_PRESET_OPTIONS,
  fluidFromPreset,
  type BioreactorFluid,
  type FluidPresetId,
} from "../../lib/bioreactorGeometry";
import "./FluidPropertiesFields.css";

type FluidPropertiesFieldsProps = {
  value: BioreactorFluid;
  onChange: (next: BioreactorFluid) => void;
  disabled?: boolean;
  /** Compact class prefix for add-device vs device-settings. */
  variant?: "settings" | "add";
};

function sanitizeDecimal(raw: string): string {
  return raw.replace(/[^\d.,]/g, "").replace(",", ".");
}

export function FluidPropertiesFields({
  value,
  onChange,
  disabled = false,
  variant = "settings",
}: FluidPropertiesFieldsProps) {
  const { t } = useTranslation();
  const root =
    variant === "add" ? "fluid-fields fluid-fields--add" : "fluid-fields";

  const setPreset = (id: Exclude<FluidPresetId, "custom">) => {
    onChange(fluidFromPreset(id));
  };

  const patchNumber = (
    key: keyof Omit<BioreactorFluid, "preset">,
    raw: string,
  ) => {
    const cleaned = sanitizeDecimal(raw);
    if (!cleaned.trim()) return;
    const n = Number(cleaned);
    if (!Number.isFinite(n)) return;
    const lim = FLUID_LIMITS[key];
    const clamped = Math.min(lim.max, Math.max(lim.min, n));
    onChange({ ...value, preset: "custom", [key]: clamped });
  };

  return (
    <section className={root}>
      <p className="fluid-fields__label">{t("fluid.title")}</p>
      <p className="fluid-fields__hint">{t("fluid.hint")}</p>

      <div className="fluid-fields__presets" role="group" aria-label={t("fluid.presets")}>
        {FLUID_PRESET_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className={
              value.preset === opt.id
                ? "fluid-fields__chip is-active"
                : "fluid-fields__chip"
            }
            disabled={disabled}
            onClick={() => setPreset(opt.id)}
          >
            {t(opt.labelKey)}
          </button>
        ))}
        {value.preset === "custom" ? (
          <span className="fluid-fields__chip is-active is-static">
            {t("fluid.presetCustom")}
          </span>
        ) : null}
      </div>

      <div className="fluid-fields__grid">
        <label className="fluid-fields__field">
          <span>{t("fluid.viscosity")}</span>
          <span className="fluid-fields__unit">cP</span>
          <input
            type="number"
            inputMode="decimal"
            min={FLUID_LIMITS.viscosity_cP.min}
            max={FLUID_LIMITS.viscosity_cP.max}
            step="any"
            disabled={disabled}
            value={value.viscosity_cP}
            onChange={(event) => patchNumber("viscosity_cP", event.target.value)}
          />
        </label>
        <label className="fluid-fields__field">
          <span>{t("fluid.density")}</span>
          <span className="fluid-fields__unit">kg/m³</span>
          <input
            type="number"
            inputMode="decimal"
            min={FLUID_LIMITS.density_kg_m3.min}
            max={FLUID_LIMITS.density_kg_m3.max}
            step="any"
            disabled={disabled}
            value={value.density_kg_m3}
            onChange={(event) =>
              patchNumber("density_kg_m3", event.target.value)
            }
          />
        </label>
        <label className="fluid-fields__field fluid-fields__field--wide">
          <span>{t("fluid.surfaceTension")}</span>
          <span className="fluid-fields__unit">mN/m</span>
          <input
            type="number"
            inputMode="decimal"
            min={FLUID_LIMITS.surface_tension_mN_m.min}
            max={FLUID_LIMITS.surface_tension_mN_m.max}
            step="any"
            disabled={disabled}
            value={value.surface_tension_mN_m}
            onChange={(event) =>
              patchNumber("surface_tension_mN_m", event.target.value)
            }
          />
        </label>
      </div>
    </section>
  );
}

export default FluidPropertiesFields;
