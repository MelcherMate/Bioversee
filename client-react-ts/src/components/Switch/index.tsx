import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  getLatestSwitchState,
  insertSwitchState,
} from "../../lib/actuators";
import type { AppUser } from "../../lib/user";
import "./Switch.css";

type SwitchProps = {
  deviceId: string;
  name: string;
  label: string;
  val: boolean;
  setVal: (value: boolean) => void;
  user: AppUser;
  disabled?: boolean;
};

function Switch(props: SwitchProps) {
  const { t } = useTranslation();
  const disabled = Boolean(props.disabled);

  useEffect(() => {
    if (!props.deviceId) return;
    getLatestSwitchState(props.deviceId, props.name)
      .then((state) => props.setVal(Boolean(state)))
      .catch((error) => console.log(error));
  }, [props.deviceId, props.name, props.user.id]);

  const sendSwitchStateToDatabase = (newValue: boolean) => {
    if (disabled) return;
    insertSwitchState(
      props.deviceId,
      props.name,
      newValue,
      props.user.id,
    ).catch((error) => console.log(error));
  };

  return (
    <label
      className={`bv-switch${props.val ? " bv-switch--on" : ""}${
        disabled ? " bv-switch--disabled" : ""
      }`}
      htmlFor={`${props.deviceId}-${props.name}`}
    >
      <div className="bv-switch__copy">
        <span className="bv-switch__label">{props.label}</span>
        <span className="bv-switch__state">
          {props.val ? t("common.on") : t("common.off")}
        </span>
      </div>
      <input
        type="checkbox"
        className="bv-switch__input"
        checked={props.val}
        id={`${props.deviceId}-${props.name}`}
        disabled={disabled}
        onChange={(event) => {
          if (disabled) return;
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
