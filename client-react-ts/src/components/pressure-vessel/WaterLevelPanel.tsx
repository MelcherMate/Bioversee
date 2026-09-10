import type { CSSProperties, ChangeEvent } from "react";
import AnimatedNumber from "../AnimatedNumber";
import "../Slider/Slider.css";
import {
  fillUnitsToPercent,
  VESSEL_MAX_FILL_UNITS,
} from "./constants";
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

  const bindHoldButton = (onHoldChange?: (held: boolean) => void) => ({
    type: "button" as const,
    onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      onHoldChange?.(true);
    },
    onPointerUp: (event: React.PointerEvent<HTMLButtonElement>) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      onHoldChange?.(false);
    },
    onPointerCancel: (event: React.PointerEvent<HTMLButtonElement>) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      onHoldChange?.(false);
    },
    onLostPointerCapture: () => onHoldChange?.(false),
  });

  const handleSliderChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextPercent = parseInt(event.target.value, 10);
    onChange(percentToFillUnits(nextPercent));
  };

  const atFull = fillUnits >= VESSEL_MAX_FILL_UNITS;
  const atEmpty = fillUnits <= 0;

  return (
    <div className="controlPanel pv-panel">
      <h4 className="boxTitle">{title}</h4>

      <div className="bv-slider pv-panel__slider">
        <div className="bv-slider__meta">
          <span className="bv-slider__label">Level</span>
          {showPercent ? (
            <AnimatedNumber
              className="bv-slider__value"
              value={percent}
              decimals={0}
              suffix="%"
            />
          ) : null}
        </div>
        <input
          type="range"
          className="bv-slider__input"
          min={0}
          max={100}
          value={percent}
          onChange={handleSliderChange}
          aria-label="Water level"
          style={{ "--bv-slider-progress": `${percent}%` } as CSSProperties}
        />
      </div>

      <div className="pv-panel__actions">
        <button
          {...bindHoldButton(onFillHoldChange)}
          disabled={atFull || fillDisabled}
          aria-label={`${fillLabel} tank`}
          aria-pressed={isFillHeld}
          className={`pv-panel__btn pv-panel__btn--fill${isFillHeld ? " is-active" : ""}`}
        >
          {fillLabel}
        </button>
        <button
          {...bindHoldButton(onDrainHoldChange)}
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

function percentToFillUnits(percent: number) {
  const clamped = Math.min(100, Math.max(0, percent));
  return Math.round((clamped / 100) * VESSEL_MAX_FILL_UNITS);
}
