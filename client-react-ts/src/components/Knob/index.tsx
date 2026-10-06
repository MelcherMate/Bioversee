import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import {
  getLatestSliderState,
  insertSliderState,
} from "../../lib/actuators";
import { subscribeDeviceActuators } from "../../lib/actuatorsSync";
import type { AppUser } from "../../lib/user";
import AnimatedNumber from "../AnimatedNumber";
import "./Knob.css";

type KnobProps = {
  deviceId: string;
  name: string;
  label: string;
  val: number;
  setVal: (value: number) => void;
  user: AppUser;
  min?: number;
  max?: number;
  /** Display unit after the value. Defaults to "%". */
  unit?: string;
  /** Decimal places for the readout (charts use 2). */
  decimals?: number;
  /**
   * Snap / tick interval. When set (e.g. 10 for %), dots mark each step
   * and values snap. Omit for free-spinning continuous control.
   */
  step?: number;
  disabled?: boolean;
};

/** Sweep from 7 o'clock to 5 o'clock (270° range). */
const START_DEG = -135;
const SWEEP_DEG = 270;

function valueToAngle(value: number, min: number, max: number): number {
  const t = max === min ? 0 : (value - min) / (max - min);
  return START_DEG + t * SWEEP_DEG;
}

function angleToValue(deg: number, min: number, max: number): number {
  const clamped = Math.min(SWEEP_DEG, Math.max(0, deg - START_DEG));
  const t = clamped / SWEEP_DEG;
  return min + t * (max - min);
}

function pointerAngle(
  clientX: number,
  clientY: number,
  rect: DOMRect,
): number {
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  // 0° at top, positive clockwise
  return (Math.atan2(clientX - cx, cy - clientY) * 180) / Math.PI;
}

function quantize(value: number, min: number, max: number, step?: number) {
  if (!step || step <= 0) {
    return Math.min(max, Math.max(min, value));
  }
  const snapped = Math.round((value - min) / step) * step + min;
  return Math.min(max, Math.max(min, snapped));
}

function Knob(props: KnobProps) {
  const disabled = Boolean(props.disabled);
  const min = props.min ?? 0;
  const max = props.max ?? 100;
  const unit = props.unit ?? "%";
  const decimals = props.decimals ?? 0;
  const step = props.step;
  const freeSpin = !(step && step > 0);
  const value = Number.isFinite(props.val) ? props.val : min;

  const ticks = useMemo(() => {
    if (freeSpin || !step) return [];
    const marks: number[] = [];
    const count = Math.round((max - min) / step);
    for (let i = 0; i <= count; i += 1) {
      marks.push(min + i * step);
    }
    return marks;
  }, [freeSpin, step, min, max]);

  const [dragging, setDragging] = useState(false);
  const [displayValue, setDisplayValue] = useState(value);
  const setValRef = useRef(props.setVal);
  setValRef.current = props.setVal;
  const draggingRef = useRef(false);
  const localWriteUntilRef = useRef(0);
  const dialRef = useRef<HTMLDivElement | null>(null);
  const dragValueRef = useRef(value);
  const displayValueRef = useRef(value);
  const easeRafRef = useRef(0);

  // Ease the dial toward remote / committed values; stay instant while dragging.
  useEffect(() => {
    if (dragging) {
      if (easeRafRef.current) {
        cancelAnimationFrame(easeRafRef.current);
        easeRafRef.current = 0;
      }
      displayValueRef.current = value;
      setDisplayValue(value);
      return;
    }

    const from = displayValueRef.current;
    const to = value;
    if (Math.abs(from - to) < 0.001) {
      displayValueRef.current = to;
      setDisplayValue(to);
      return;
    }

    if (easeRafRef.current) cancelAnimationFrame(easeRafRef.current);
    const start = performance.now();
    const duration = 480;
    const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const next = from + (to - from) * easeOutCubic(p);
      displayValueRef.current = next;
      setDisplayValue(next);
      if (p < 1) {
        easeRafRef.current = requestAnimationFrame(tick);
      } else {
        easeRafRef.current = 0;
        displayValueRef.current = to;
        setDisplayValue(to);
      }
    };
    easeRafRef.current = requestAnimationFrame(tick);

    return () => {
      if (easeRafRef.current) {
        cancelAnimationFrame(easeRafRef.current);
        easeRafRef.current = 0;
      }
    };
  }, [value, dragging]);

  const visualValue = dragging ? value : displayValue;
  const angle = valueToAngle(visualValue, min, max);
  const t =
    max === min ? 0 : (visualValue - min) / (max - min);

  useEffect(() => {
    if (!props.deviceId) return;

    let cancelled = false;

    const pull = () => {
      if (draggingRef.current) return;
      getLatestSliderState(props.deviceId, props.name)
        .then((state) => {
          if (cancelled) return;
          if (draggingRef.current) return;
          const next = Number(state);
          // During our own write echo window, ignore only matching values we just sent.
          if (Date.now() < localWriteUntilRef.current) {
            if (Math.abs(next - dragValueRef.current) < 0.001) return;
          }
          setValRef.current(next);
        })
        .catch((error) => console.log(error));
    };

    pull();

    const unsubscribe = subscribeDeviceActuators(props.deviceId, (change) => {
      if (cancelled) return;
      if (draggingRef.current) return;

      if (change) {
        if (change.kind !== "slider" || change.name !== props.name) return;
        const next = Number(change.state);
        // Accept other users/devices immediately; only skip our own echo briefly.
        const fromSelf =
          change.userId != null &&
          change.userId.toLowerCase() === props.user.id.toLowerCase();
        if (
          fromSelf &&
          Date.now() < localWriteUntilRef.current &&
          Math.abs(next - dragValueRef.current) < 0.001
        ) {
          return;
        }
        setValRef.current(next);
        return;
      }

      pull();
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [props.deviceId, props.name, props.user.id]);

  const commitTimerRef = useRef<number | null>(null);

  const roundDisplay = (next: number) => {
    if (step && step > 0) {
      return quantize(next, min, max, step);
    }
    if (decimals > 0) {
      return Number(Math.min(max, Math.max(min, next)).toFixed(decimals));
    }
    return Math.round(Math.min(max, Math.max(min, next)));
  };

  const commit = (next: number) => {
    if (disabled) return;
    const clamped = roundDisplay(next);
    dragValueRef.current = clamped;
    localWriteUntilRef.current = Date.now() + 1500;
    props.setVal(clamped);
    insertSliderState(
      props.deviceId,
      props.name,
      clamped,
      props.user.id,
    ).catch((error) => console.log(error));
  };

  const applyFromPointer = (clientX: number, clientY: number) => {
    const el = dialRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const dial = pointerAngle(clientX, clientY, rect);
    let along = dial - START_DEG;
    along = Math.min(SWEEP_DEG, Math.max(0, along));
    const next = angleToValue(START_DEG + along, min, max);
    const rounded = roundDisplay(next);
    dragValueRef.current = rounded;
    props.setVal(rounded);
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    event.preventDefault();
    draggingRef.current = true;
    setDragging(true);
    dragValueRef.current = value;
    event.currentTarget.setPointerCapture(event.pointerId);
    applyFromPointer(event.clientX, event.clientY);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current || disabled) return;
    applyFromPointer(event.clientX, event.clientY);
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setDragging(false);
    commit(dragValueRef.current);
  };

  const onWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (disabled) return;
    event.preventDefault();
    const wheelStep =
      step && step > 0
        ? step
        : Math.max((max - min) / 100, decimals > 0 ? 0.01 : 1);
    const delta = event.deltaY > 0 ? -wheelStep : wheelStep;
    const rounded = roundDisplay(value + delta);
    dragValueRef.current = rounded;
    props.setVal(rounded);
    if (commitTimerRef.current != null) {
      window.clearTimeout(commitTimerRef.current);
    }
    commitTimerRef.current = window.setTimeout(() => {
      commit(rounded);
      commitTimerRef.current = null;
    }, 180);
  };

  // SVG ring geometry (viewBox 0–100). Stroke starts at 3 o'clock; rotate to match START_DEG.
  // Match stepped-knob dot diameter (5px on a 62px dial → viewBox units).
  const arcR = 42;
  const arcStroke = (5 / 62) * 100;
  const arcC = 2 * Math.PI * arcR;
  const arcTrack = arcC * (SWEEP_DEG / 360);
  const arcProgress = arcTrack * t;
  const arcRotate = START_DEG - 90;

  // Reserve width for the widest readout (e.g. "100" / "300") so % digits don't grow the row
  const maxAbs = Math.max(Math.abs(min), Math.abs(max));
  const valueChars =
    Math.floor(maxAbs).toString().length + (decimals > 0 ? decimals + 1 : 0);

  return (
    <div
      className={`bv-knob${disabled ? " bv-knob--disabled" : ""}${
        dragging ? " is-dragging" : ""
      }${freeSpin ? " bv-knob--free" : " bv-knob--stepped"}`}
      style={
        {
          ["--bv-knob-value-ch" as string]: String(valueChars),
        } as CSSProperties
      }
    >
      <div className="bv-knob__meta">
        <span className="bv-knob__label">{props.label}</span>
        <div className="bv-knob__reading">
          <AnimatedNumber
            className="bv-knob__value"
            value={value}
            decimals={decimals}
          />
          {unit ? <span className="bv-knob__unit">{unit.trim()}</span> : null}
        </div>
      </div>

      <div
        ref={dialRef}
        className="bv-knob__dial"
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={props.label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-disabled={disabled || undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
      >
        {freeSpin ? (
          <svg
            className="bv-knob__arc"
            viewBox="0 0 100 100"
            aria-hidden="true"
          >
            <g transform={`rotate(${arcRotate} 50 50)`}>
              <circle
                className="bv-knob__arc-track"
                cx="50"
                cy="50"
                r={arcR}
                fill="none"
                strokeWidth={arcStroke}
                strokeLinecap="round"
                strokeDasharray={`${arcTrack} ${arcC}`}
              />
              {t > 0.002 ? (
                <circle
                  className="bv-knob__arc-progress"
                  cx="50"
                  cy="50"
                  r={arcR}
                  fill="none"
                  strokeWidth={arcStroke}
                  strokeLinecap="round"
                  strokeDasharray={`${arcProgress} ${arcC}`}
                />
              ) : null}
            </g>
          </svg>
        ) : (
          <div className="bv-knob__ticks" aria-hidden="true">
            {ticks.map((tick) => {
              const tickAngle = valueToAngle(tick, min, max);
              const active =
                Math.abs(tick - visualValue) < (step ?? 0) / 2 + 0.001;
              return (
                <span
                  key={tick}
                  className={`bv-knob__tick${active ? " is-active" : ""}`}
                  style={{
                    transform: `rotate(${tickAngle}deg) translateY(calc(-1 * var(--bv-knob-tick-r))) rotate(${-tickAngle}deg)`,
                  }}
                />
              );
            })}
          </div>
        )}
        <div className="bv-knob__face" aria-hidden="true">
          <div
            className="bv-knob__needle"
            style={{ transform: `rotate(${angle}deg)` }}
          />
          <div className="bv-knob__cap" />
        </div>
      </div>
    </div>
  );
}

Knob.displayName = "Knob";
export default Knob;
