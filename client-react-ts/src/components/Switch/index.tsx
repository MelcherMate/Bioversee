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
      console.log(error)
    );
  };

  return (
    <div className="switch">
      <input
        type="checkbox"
        checked={props.val}
        id={props.name}
        onChange={(event) => {
          const newValue = event.target.checked;
          props.setVal(newValue);
          sendSwitchStateToDatabase(newValue);
        }}
      />
      <label htmlFor={props.name}></label>
      <span>{props.label}</span>
    </div>
  );
}

Switch.displayName = "Switch";
export default Switch;
