import { useTranslation } from "react-i18next";
import AnimatedNumber from "../AnimatedNumber";
import SegmentedControl from "../SegmentedControl";
import "../Switch/Switch.css";
import {
  MBR_AERATION_LEVELS,
  type MbrAerationLevel,
} from "./constants";
import "./MbrControlPanel.css";

type MbrControlPanelProps = {
  isFlowOn: boolean;
  onFlowChange: (on: boolean) => void;
  isAerationOn: boolean;
  onAerationChange: (on: boolean) => void;
  aerationLevel: MbrAerationLevel;
  onAerationLevelChange: (level: MbrAerationLevel) => void;
  disabled?: boolean;
};

export function MbrControlPanel({
  isFlowOn,
  onFlowChange,
  isAerationOn,
  onAerationChange,
  aerationLevel,
  onAerationLevelChange,
  disabled = false,
}: MbrControlPanelProps) {
  const { t } = useTranslation();
  const aerationControlsDisabled = disabled || !isAerationOn;
  const displayLevel = isAerationOn ? aerationLevel : 0;

  return (
    <div className="controlPanel mbr-panel">
      <section className="controlPanel__section">
        <h4 className="boxTitle">{t("process.flow")}</h4>
        <LocalToggle
          id="mbr-flow"
          label={t("process.circulation")}
          checked={isFlowOn}
          disabled={disabled}
          onChange={onFlowChange}
        />
      </section>

      <section className="controlPanel__section">
        <h4 className="boxTitle">{t("process.aeration")}</h4>
        <LocalToggle
          id="mbr-aeration"
          label={t("process.diffuser")}
          checked={isAerationOn}
          disabled={disabled}
          onChange={onAerationChange}
        />

        <div
          className={`mbr-panel__intensity${
            aerationControlsDisabled ? " is-disabled" : ""
          }`}
        >
          <div className="mbr-panel__intensity-meta">
            <span className="mbr-panel__intensity-label">
              {t("process.intensity")}
            </span>
            <AnimatedNumber
              className="mbr-panel__intensity-value"
              value={displayLevel}
              decimals={0}
              suffix="%"
            />
          </div>

          <SegmentedControl
            aria-label={t("process.aeration")}
            accent
            disabled={aerationControlsDisabled}
            value={aerationLevel}
            onChange={onAerationLevelChange}
            options={MBR_AERATION_LEVELS.map((level) => ({
              value: level,
              label: level,
              ariaLabel: `${level}%`,
            }))}
          />
        </div>
      </section>
    </div>
  );
}

function LocalToggle({
  id,
  label,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  const { t } = useTranslation();

  return (
    <label
      className={`bv-switch${checked ? " bv-switch--on" : ""}${
        disabled ? " bv-switch--disabled" : ""
      }`}
      htmlFor={id}
    >
      <div className="bv-switch__copy">
        <span className="bv-switch__label">{label}</span>
        <span className="bv-switch__state">
          {checked ? t("common.on") : t("common.off")}
        </span>
      </div>
      <input
        type="checkbox"
        className="bv-switch__input"
        checked={checked}
        id={id}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="bv-switch__track" aria-hidden="true">
        <span className="bv-switch__thumb" />
      </span>
    </label>
  );
}
