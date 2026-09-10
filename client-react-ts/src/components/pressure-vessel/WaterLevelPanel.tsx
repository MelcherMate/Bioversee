import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
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
  /** Fired when the user finishes a manual slider drag. */
  onCommit?: (value: number) => void;
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
  /** Viewer / read-only — gray controls, no interaction. */
  disabled?: boolean;
};

export function WaterLevelPanel({
  fillUnits,
  onChange,
  onCommit,
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
  disabled = false,
}: WaterLevelPanelProps) {
  const [isDragging, setIsDragging] = useState(false);
  // Local visual level updated every frame so the thumb never freezes/jumps
  // while React state catches up from fill/drain animation.
  const [visualUnits, setVisualUnits] = useState(fillUnits);
  const targetRef = useRef(fillUnits);
  const visualRef = useRef(fillUnits);
  const draggingRef = useRef(false);

  targetRef.current = fillUnits;
  draggingRef.current = isDragging;

  useEffect(() => {
    let frame = 0;
    let lastTime = 0;

    const tick = (now: number) => {
      if (!lastTime) lastTime = now;
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      const target = targetRef.current;
      let next = visualRef.current;

      if (draggingRef.current) {
        next = target;
      } else {
        // Critically damped-ish follow: smooth while fill/drain updates arrive.
        const follow = 1 - Math.exp(-14 * dt);
        next = next + (target - next) * follow;
        if (Math.abs(target - next) < 0.05) next = target;
      }

      if (next !== visualRef.current) {
        visualRef.current = next;
        setVisualUnits(next);
      }

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const displayPercent = fillUnitsToPercent(visualUnits);
  const progress = Math.min(
    100,
    Math.max(0, (visualUnits / VESSEL_MAX_FILL_UNITS) * 100),
  );

  const bindHoldButton = (onHoldChange?: (held: boolean) => void) => ({
    type: "button" as const,
    onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (disabled) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      onHoldChange?.(true);
    },
    onPointerUp: (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      onHoldChange?.(false);
    },
    onPointerCancel: (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      onHoldChange?.(false);
    },
    onLostPointerCapture: () => onHoldChange?.(false),
  });

  const handleSliderChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    const nextPercent = Number(event.target.value);
    const nextUnits = percentToFillUnits(nextPercent);
    visualRef.current = nextUnits;
    setVisualUnits(nextUnits);
    onChange(nextUnits);
  };

  const endDrag = useCallback(() => {
    setIsDragging(false);
    if (!disabled) onCommit?.(visualRef.current);
  }, [disabled, onCommit]);

  const atFull = fillUnits >= VESSEL_MAX_FILL_UNITS;
  const atEmpty = fillUnits <= 0;
  const controlsLocked = disabled;

  return (
    <div
      className={`controlPanel pv-panel${controlsLocked ? " pv-panel--disabled" : ""}`}
    >
      <h4 className="boxTitle">{title}</h4>

      <div className="bv-slider pv-panel__slider">
        <div className="bv-slider__meta">
          <span className="bv-slider__label">Level</span>
          {showPercent ? (
            <AnimatedNumber
              className="bv-slider__value"
              value={displayPercent}
              decimals={0}
              suffix="%"
            />
          ) : null}
        </div>

        <div className={`pv-hslider${isDragging ? " is-dragging" : ""}`}>
          <div className="pv-hslider__rail" aria-hidden="true">
            <div
              className="pv-hslider__fill"
              style={{ width: `${progress}%` }}
            />
            <div
              className="pv-hslider__thumb"
              style={{ left: `${progress}%` }}
            />
          </div>
          <input
            type="range"
            className="pv-hslider__input"
            min={0}
            max={100}
            step="any"
            value={progress}
            disabled={controlsLocked}
            onChange={handleSliderChange}
            onPointerDown={() => {
              if (!controlsLocked) setIsDragging(true);
            }}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onBlur={endDrag}
            aria-label="Water level"
          />
        </div>
      </div>

      <div className="pv-panel__actions">
        <button
          {...bindHoldButton(onFillHoldChange)}
          disabled={controlsLocked || atFull || fillDisabled}
          aria-label={`${fillLabel} tank`}
          aria-pressed={isFillHeld}
          className={`pv-panel__btn pv-panel__btn--fill${isFillHeld ? " is-active" : ""}`}
        >
          {fillLabel}
        </button>
        <button
          {...bindHoldButton(onDrainHoldChange)}
          disabled={controlsLocked || atEmpty || drainDisabled}
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
