import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  getLatestSwitchState,
  insertSwitchState,
} from "../../lib/actuators";
import { subscribeDeviceActuators } from "../../lib/actuatorsSync";
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
  const setValRef = useRef(props.setVal);
  setValRef.current = props.setVal;
  const localWriteUntilRef = useRef(0);
  const lastLocalValueRef = useRef(props.val);

  useEffect(() => {
    if (!props.deviceId) return;

    let cancelled = false;

    const pull = () => {
      getLatestSwitchState(props.deviceId, props.name)
        .then((state) => {
          if (cancelled) return;
          const next = Boolean(state);
          if (
            Date.now() < localWriteUntilRef.current &&
            next === lastLocalValueRef.current
          ) {
            return;
          }
          setValRef.current(next);
        })
        .catch((error) => console.log(error));
    };

    pull();

    const unsubscribe = subscribeDeviceActuators(props.deviceId, (change) => {
      if (cancelled) return;

      if (change) {
        if (change.kind !== "switch" || change.name !== props.name) return;
        const next = Boolean(change.state);
        const fromSelf =
          change.userId != null &&
          change.userId.toLowerCase() === props.user.id.toLowerCase();
        if (
          fromSelf &&
          Date.now() < localWriteUntilRef.current &&
          next === lastLocalValueRef.current
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

  const sendSwitchStateToDatabase = (newValue: boolean) => {
    if (disabled) return;
    lastLocalValueRef.current = newValue;
    localWriteUntilRef.current = Date.now() + 1500;
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
      <span className="bv-switch__title">{props.label}</span>
      <span className="bv-switch__row">
        <span className="bv-switch__status">
          <span className="bv-switch__dot" aria-hidden="true" />
          <span className="bv-switch__state">
            {props.val ? t("common.on") : t("common.off")}
          </span>
        </span>
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
      </span>
    </label>
  );
}

Switch.displayName = "Switch";
export default Switch;
