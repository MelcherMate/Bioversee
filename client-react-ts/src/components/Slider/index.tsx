import { useEffect, useState, type ChangeEvent, type MouseEvent } from "react";
import {
  getLatestSliderState,
  insertSliderState,
} from "../../lib/actuators";
import type { AppUser } from "../../lib/user";
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

  const handleMouseUp = (event: MouseEvent<HTMLInputElement>) => {
    const newValue = parseInt((event.target as HTMLInputElement).value, 10);
    setIsSliding(false);
    insertSliderState(props.name, newValue, props.user.id).catch((error) =>
      console.log(error)
    );
  };

  return (
    <div className="slider">
      <input
        type="range"
        min={props.min || 0}
        max={props.max || 100}
        value={props.val}
        onChange={handleChange}
        onMouseUp={handleMouseUp}
        className="slider"
        id={props.name}
      />
      <span className="sliderValue">{props.val}%</span>
      <span>{props.label}</span>
    </div>
  );
}

Slider.displayName = "Slider";
export default Slider;
