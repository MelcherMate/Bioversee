import {
  useEffect,
  useState,
  type CSSProperties,
  type ChangeEvent,
  type MouseEvent,
} from "react";
import {
  getLatestSliderState,
  insertSliderState,
} from "../../lib/actuators";
import type { AppUser } from "../../lib/user";
import AnimatedNumber from "../AnimatedNumber";
import "./Slider.css";

type SliderProps = {
  name: string;
  label: string;
  val: number;
  setVal: (value: number) => void;
  user: AppUser;
  min?: number;
  max?: number;
};

function Slider(props: SliderProps) {
  const [isSliding, setIsSliding] = useState(false);
  const min = props.min ?? 0;
  const max = props.max ?? 100;
  const value = Number.isFinite(props.val) ? props.val : min;
  const percent = max === min ? 0 : ((value - min) / (max - min)) * 100;

  useEffect(() => {
    if (isSliding) return;

    getLatestSliderState(props.name)
      .then((state) => props.setVal(Number(state)))
      .catch((error) => console.log(error));
  }, [props.name, props.user.id, isSliding]);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const newValue = parseInt(event.target.value, 10);
    props.setVal(newValue);
    setIsSliding(true);
  };

  const commitValue = (raw: string) => {
    const newValue = parseInt(raw, 10);
    setIsSliding(false);
    insertSliderState(props.name, newValue, props.user.id).catch((error) =>
      console.log(error)
    );
  };

  const handleMouseUp = (event: MouseEvent<HTMLInputElement>) => {
    commitValue((event.target as HTMLInputElement).value);
  };

  return (
    <div className="bv-slider">
      <div className="bv-slider__meta">
        <span className="bv-slider__label">{props.label}</span>
        <AnimatedNumber
          className="bv-slider__value"
          value={value}
          decimals={0}
          suffix="%"
        />
      </div>
      <input
        type="range"
        className="bv-slider__input"
        min={min}
        max={max}
        value={value}
        onChange={handleChange}
        onMouseUp={handleMouseUp}
        onTouchEnd={(event) => commitValue(event.currentTarget.value)}
        id={props.name}
        style={{ "--bv-slider-progress": `${percent}%` } as CSSProperties}
        aria-label={props.label}
      />
    </div>
  );
}

Slider.displayName = "Slider";
export default Slider;
