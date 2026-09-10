import { useRef } from "react";
import {
  fillUnitsToPercent,
  VESSEL_MAX_FILL_UNITS,
} from "./constants";
import { VerticalSlider } from "./VerticalSlider";
import AnimatedNumber from "../AnimatedNumber";
import "./WaterLevelPanel.css";

type WaterLevelPanelProps = {
  fillUnits: number;
  onChange: (value: number) => void;
  title?: string;
  fillLabel?: string;
  drainLabel?: string;
  showPercent?: boolean;
  isFillHeld?: boolean;
  onFillHoldChange?: (held: boolean) => void;
  fillDisabled?: boolean;
  isDrainHeld?: boolean;
  onDrainHoldChange?: (held: boolean) => void;
  drainDisabled?: boolean;
};

export function WaterLevelPanel({
  fillUnits,
  onChange,
  title = "Water level",
  fillLabel = "Fill",
  drainLabel = "Drain",
  showPercent = true,
  isFillHeld = false,
  onFillHoldChange,
  fillDisabled = false,
  isDrainHeld = false,
  onDrainHoldChange,
  drainDisabled = false,
}: WaterLevelPanelProps) {
  const percent = fillUnitsToPercent(fillUnits);
  const fillUnitsRef = useRef(fillUnits);
  const onChangeRef = useRef(onChange);

  fillUnitsRef.current = fillUnits;
  onChangeRef.current = onChange;

  const bindFillButton = () => ({
    type: "button" as const,
    onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      onFillHoldChange?.(true);
    },
    onPointerUp: (event: React.PointerEvent<HTMLButtonElement>) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      onFillHoldChange?.(false);
    },
    onPointerCancel: (event: React.PointerEvent<HTMLButtonElement>) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      onFillHoldChange?.(false);
    },
    onLostPointerCapture: () => onFillHoldChange?.(false),
  });

  const bindDrainButton = () => ({
    type: "button" as const,
    onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      onDrainHoldChange?.(true);
    },
    onPointerUp: (event: React.PointerEvent<HTMLButtonElement>) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      onDrainHoldChange?.(false);
    },
    onPointerCancel: (event: React.PointerEvent<HTMLButtonElement>) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      onDrainHoldChange?.(false);
    },
    onLostPointerCapture: () => onDrainHoldChange?.(false),
  });

  const atFull = fillUnits >= VESSEL_MAX_FILL_UNITS;
  const atEmpty = fillUnits <= 0;

  return (
    <div className="controlPanel pv-panel">
      <h4 className="boxTitle">{title}</h4>
      {showPercent ? (
        <div className="pv-panel__level">
          <AnimatedNumber
            className="pv-panel__percent"
            value={percent}
            decimals={0}
            suffix="%"
          />
        </div>
      ) : null}

      <div className="pv-panel__slider-row">
        <div className="pv-panel__ends">
          <span>Full</span>
          <span>Empty</span>
        </div>
        <VerticalSlider
          min={0}
          max={VESSEL_MAX_FILL_UNITS}
          value={fillUnits}
          onChange={onChange}
          aria-label="Water level"
          className="pv-panel__slider"
        />
      </div>

      <div className="pv-panel__actions">
        <button
          {...bindFillButton()}
          disabled={atFull || fillDisabled}
          aria-label={`${fillLabel} tank`}
          aria-pressed={isFillHeld}
          className={`pv-panel__btn pv-panel__btn--fill${isFillHeld ? " is-active" : ""}`}
        >
          {fillLabel}
        </button>
        <button
          {...bindDrainButton()}
          disabled={atEmpty || drainDisabled}
          aria-label={`${drainLabel} tank`}
          aria-pressed={isDrainHeld}
          className={`pv-panel__btn pv-panel__btn--drain${isDrainHeld ? " is-active" : ""}`}
        >
          {drainLabel}
        </button>
      </div>
    </div>
  );
}
