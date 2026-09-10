import { useEffect } from "react";
import {
  getLatestSwitchState,
  insertSwitchState,
} from "../../lib/actuators";
import type { AppUser } from "../../lib/user";
import "./Switch.css";

type SwitchProps = {
  name: string;
  label: string;
  val: boolean;
  setVal: (value: boolean) => void;
  user: AppUser;
};

function Switch(props: SwitchProps) {
  useEffect(() => {
    getLatestSwitchState(props.name)
      .then((state) => props.setVal(Boolean(state)))
      .catch((error) => console.log(error));
  }, [props.name, props.user.id]);

  const sendSwitchStateToDatabase = (newValue: boolean) => {
    insertSwitchState(props.name, newValue, props.user.id).catch((error) =>
      console.log(error),
    );
  };

  return (
    <label className={`bv-switch${props.val ? " bv-switch--on" : ""}`} htmlFor={props.name}>
      <div className="bv-switch__copy">
        <span className="bv-switch__label">{props.label}</span>
        <span className="bv-switch__state">{props.val ? "On" : "Off"}</span>
      </div>
      <input
        type="checkbox"
        className="bv-switch__input"
        checked={props.val}
        id={props.name}
        onChange={(event) => {
          const newValue = event.target.checked;
          props.setVal(newValue);
          sendSwitchStateToDatabase(newValue);
        }}
      />
      <span className="bv-switch__track" aria-hidden="true">
        <span className="bv-switch__thumb" />
      </span>
    </label>
  );
}

Switch.displayName = "Switch";
export default Switch;
