import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ChangeEvent,
  type PointerEvent,
} from "react";
import {
  getLatestSliderState,
  insertSliderState,
} from "../../lib/actuators";
import { subscribeDeviceActuators } from "../../lib/actuatorsSync";
import type { AppUser } from "../../lib/user";
import AnimatedNumber from "../AnimatedNumber";
import "./Slider.css";

type SliderProps = {
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
  disabled?: boolean;
};

function Slider(props: SliderProps) {
  const [isSliding, setIsSliding] = useState(false);
  const disabled = Boolean(props.disabled);
  const min = props.min ?? 0;
  const max = props.max ?? 100;
  const unit = props.unit ?? "%";
  const value = Number.isFinite(props.val) ? props.val : min;
  const percent = max === min ? 0 : ((value - min) / (max - min)) * 100;

  const setValRef = useRef(props.setVal);
  setValRef.current = props.setVal;
  const slidingRef = useRef(false);
  /** Skip remote updates briefly after a local commit so we don't snap back. */
  const localWriteUntilRef = useRef(0);

  useEffect(() => {
    if (!props.deviceId) return;

    let cancelled = false;

    const pull = () => {
      if (slidingRef.current || Date.now() < localWriteUntilRef.current) return;
      getLatestSliderState(props.deviceId, props.name)
        .then((state) => {
          if (cancelled) return;
          if (slidingRef.current || Date.now() < localWriteUntilRef.current) {
            return;
          }
          setValRef.current(Number(state));
        })
        .catch((error) => console.log(error));
    };

    pull();

    const unsubscribe = subscribeDeviceActuators(props.deviceId, (change) => {
      if (cancelled) return;
      if (slidingRef.current || Date.now() < localWriteUntilRef.current) return;

      if (change) {
        if (change.kind !== "slider" || change.name !== props.name) return;
        setValRef.current(Number(change.state));
        return;
      }

      pull();
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [props.deviceId, props.name, props.user.id]);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    const newValue = parseInt(event.target.value, 10);
    slidingRef.current = true;
    setIsSliding(true);
    props.setVal(newValue);
  };

  const commitValue = (raw: string) => {
    slidingRef.current = false;
    setIsSliding(false);
    if (disabled) return;

    const newValue = parseInt(raw, 10);
    if (!Number.isFinite(newValue)) return;

    localWriteUntilRef.current = Date.now() + 1500;
    props.setVal(newValue);
    insertSliderState(
      props.deviceId,
      props.name,
      newValue,
      props.user.id,
    ).catch((error) => console.log(error));
  };

  const handlePointerDown = (event: PointerEvent<HTMLInputElement>) => {
    if (disabled) return;
    slidingRef.current = true;
    setIsSliding(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerUp = (event: PointerEvent<HTMLInputElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    commitValue(event.currentTarget.value);
  };

  return (
    <div className={`bv-slider${disabled ? " bv-slider--disabled" : ""}`}>
      <div className="bv-slider__meta">
        <span className="bv-slider__label">{props.label}</span>
        {isSliding ? (
          <span className="bv-slider__value bv-slider__value--live">
            {Math.round(value)}
            {unit}
          </span>
        ) : (
          <AnimatedNumber
            className="bv-slider__value"
            value={value}
            decimals={0}
            suffix={unit}
          />
        )}
      </div>
      <input
        type="range"
        className="bv-slider__input"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        onChange={handleChange}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        id={`${props.deviceId}-${props.name}`}
        style={{ "--bv-slider-progress": `${percent}%` } as CSSProperties}
        aria-label={props.label}
      />
    </div>
  );
}

Slider.displayName = "Slider";
export default Slider;
