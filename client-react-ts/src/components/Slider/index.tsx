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
  disabled?: boolean;
};

function Slider(props: SliderProps) {
  const [isSliding, setIsSliding] = useState(false);
  const disabled = Boolean(props.disabled);
  const min = props.min ?? 0;
  const max = props.max ?? 100;
  const value = Number.isFinite(props.val) ? props.val : min;
  const percent = max === min ? 0 : ((value - min) / (max - min)) * 100;

  const setValRef = useRef(props.setVal);
  setValRef.current = props.setVal;
  /** Ignore stale getLatest results after the user has taken control. */
  const touchedRef = useRef(false);
  const slidingRef = useRef(false);

  useEffect(() => {
    if (!props.deviceId) return;

    let cancelled = false;
    touchedRef.current = false;

    getLatestSliderState(props.deviceId, props.name)
      .then((state) => {
        if (cancelled || touchedRef.current || slidingRef.current) return;
        setValRef.current(Number(state));
      })
      .catch((error) => console.log(error));

    return () => {
      cancelled = true;
    };
  }, [props.deviceId, props.name, props.user.id]);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    const newValue = parseInt(event.target.value, 10);
    touchedRef.current = true;
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

    touchedRef.current = true;
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
    touchedRef.current = true;
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
            {Math.round(value)}%
          </span>
        ) : (
          <AnimatedNumber
            className="bv-slider__value"
            value={value}
            decimals={0}
            suffix="%"
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
