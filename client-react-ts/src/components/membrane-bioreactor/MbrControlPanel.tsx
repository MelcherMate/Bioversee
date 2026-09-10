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

  return (
    <div className="controlPanel mbr-panel">
      <section className="controlPanel__section">
        <h4 className="boxTitle">Flow</h4>
        <button
          type="button"
          onClick={() => onFlowChange(!isFlowOn)}
          disabled={disabled}
          aria-label="Flow"
          aria-pressed={isFlowOn}
          className={`mbr-panel__toggle${isFlowOn ? " is-on" : ""}`}
        >
          <span className="mbr-panel__toggle-label">Circulation</span>
          <span className="mbr-panel__toggle-state">
            {isFlowOn ? "On" : "Off"}
          </span>
        </button>
      </section>

      <section className="controlPanel__section">
        <h4 className="boxTitle">Aeration</h4>
        <button
          type="button"
          onClick={() => onAerationChange(!isAerationOn)}
          disabled={disabled}
          aria-label="Aeration"
          aria-pressed={isAerationOn}
          className={`mbr-panel__toggle${isAerationOn ? " is-on" : ""}`}
        >
          <span className="mbr-panel__toggle-label">Diffuser</span>
          <span className="mbr-panel__toggle-state">
            {isAerationOn ? "On" : "Off"}
          </span>
        </button>

        <div className="mbr-panel__levels" role="group" aria-label="Aeration level">
          {MBR_AERATION_LEVELS.map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => onAerationLevelChange(level)}
              disabled={aerationControlsDisabled}
              aria-label={`${level}% aeration`}
              aria-pressed={isAerationOn && aerationLevel === level}
              className={`mbr-panel__level${
                isAerationOn && aerationLevel === level ? " is-active" : ""
              }`}
            >
              {level}%
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
