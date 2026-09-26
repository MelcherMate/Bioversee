import { useTranslation } from "react-i18next";
import {
  EQUIPMENT_OPTIONS,
  type BioreactorEquipment,
} from "../../lib/bioreactorGeometry";
import "./EquipmentChecklist.css";

type EquipmentChecklistProps = {
  value: BioreactorEquipment;
  onChange: (next: BioreactorEquipment) => void;
  disabled?: boolean;
};

function EquipmentChecklist({
  value,
  onChange,
  disabled = false,
}: EquipmentChecklistProps) {
  const { t } = useTranslation();

  const toggle = (key: keyof BioreactorEquipment) => {
    if (disabled) return;
    onChange({ ...value, [key]: !value[key] });
  };

  return (
    <ul className="equip-list">
      {EQUIPMENT_OPTIONS.map((option) => {
        const on = value[option.key];
        return (
          <li key={option.key}>
            <label
              className={`equip-item${on ? " is-on" : ""}${
                disabled ? " is-disabled" : ""
              }`}
            >
              <input
                type="checkbox"
                className="equip-item__input"
                checked={on}
                disabled={disabled}
                onChange={() => toggle(option.key)}
              />
              <span className="equip-item__track" aria-hidden="true">
                <span className="equip-item__thumb" />
              </span>
              <span className="equip-item__copy">
                <span className="equip-item__label">{t(option.labelKey)}</span>
                <span className="equip-item__hint">{t(option.hintKey)}</span>
              </span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}

export default EquipmentChecklist;
