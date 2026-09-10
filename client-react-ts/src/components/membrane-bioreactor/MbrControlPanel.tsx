import AnimatedNumber from "../AnimatedNumber";
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
  const aerationControlsDisabled = disabled || !isAerationOn;
  const displayLevel = isAerationOn ? aerationLevel : 0;

  return (
    <div className="controlPanel mbr-panel">
      <section className="controlPanel__section">
        <h4 className="boxTitle">Flow</h4>
        <LocalToggle
          id="mbr-flow"
          label="Circulation"
          checked={isFlowOn}
          disabled={disabled}
          onChange={onFlowChange}
        />
      </section>

      <section className="controlPanel__section">
        <h4 className="boxTitle">Aeration</h4>
        <LocalToggle
          id="mbr-aeration"
          label="Diffuser"
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
            <span className="mbr-panel__intensity-label">Intensity</span>
            <AnimatedNumber
              className="mbr-panel__intensity-value"
              value={displayLevel}
              decimals={0}
              suffix="%"
            />
          </div>

          <div
            className="mbr-panel__segment"
            role="group"
            aria-label="Aeration level"
          >
            {MBR_AERATION_LEVELS.map((level) => {
              const active = aerationLevel === level;
              return (
                <button
                  key={level}
                  type="button"
                  onClick={() => onAerationLevelChange(level)}
                  disabled={aerationControlsDisabled}
                  aria-label={`${level}% aeration`}
                  aria-pressed={isAerationOn && active}
                  className={`mbr-panel__segment-btn${active ? " is-active" : ""}`}
                >
                  {level}
                </button>
              );
            })}
          </div>
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
  return (
    <label
      className={`bv-switch${checked ? " bv-switch--on" : ""}${
        disabled ? " bv-switch--disabled" : ""
      }`}
      htmlFor={id}
    >
      <div className="bv-switch__copy">
        <span className="bv-switch__label">{label}</span>
        <span className="bv-switch__state">{checked ? "On" : "Off"}</span>
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
