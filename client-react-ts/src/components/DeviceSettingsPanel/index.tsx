import { FormEvent, useEffect, useRef, useState } from "react";
import { TrashOutline } from "react-ionicons";
import {
  canAdminDevice,
  renameMyDevice,
  type AccessibleDevice,
} from "../../lib/devices";
import { DEVICE_TYPE_META } from "../../lib/deviceIcons";
import "./DeviceSettingsPanel.css";

type DeviceSettingsPanelProps = {
  device: AccessibleDevice | null;
  open: boolean;
  onClose: () => void;
  onRenamed: () => void;
  onRequestDelete: (device: AccessibleDevice) => void;
};

function DeviceSettingsPanel({
  device,
  open,
  onClose,
  onRenamed,
  onRequestDelete,
}: DeviceSettingsPanelProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!open || !device) return;
    setName(device.name);
    setError(null);
    setSaved(false);
  }, [open, device]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (
        panelRef.current &&
        event.target instanceof Node &&
        !panelRef.current.contains(event.target)
      ) {
        onClose();
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open, onClose]);

  if (!open || !device) return null;

  const meta = DEVICE_TYPE_META[device.type];
  const Icon = meta.Icon;
  const canRename = canAdminDevice(device.role);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canRename || busy) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await renameMyDevice(device.id, name.trim());
      setSaved(true);
      onRenamed();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="device-settings"
      ref={panelRef}
      role="dialog"
      aria-label="Device settings"
    >
      <div className="device-settings__head">
        <div className="device-settings__title-row">
          <span className="device-settings__icon">
            <Icon color="#0f766e" height="18px" width="18px" />
          </span>
          <div>
            <p className="device-settings__eyebrow">Settings</p>
            <h2 className="device-settings__title">{meta.label}</h2>
          </div>
        </div>
        <button
          type="button"
          className="device-settings__close"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
      </div>

      <form onSubmit={onSubmit}>
        <label className="device-settings__label" htmlFor="device-settings-name">
          Device name
        </label>
        <input
          id="device-settings-name"
          className="device-settings__input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          disabled={!canRename || busy}
          maxLength={80}
          required
        />
        {!canRename && (
          <p className="device-settings__hint">
            Only owners and admins can rename this device.
          </p>
        )}

        {canRename && (
          <button
            type="submit"
            className="device-settings__primary"
            disabled={busy || !name.trim() || name.trim() === device.name}
          >
            {busy ? "Saving…" : saved ? "Saved" : "Save name"}
          </button>
        )}
      </form>

      {device.isOwner && (
        <button
          type="button"
          className="device-settings__danger"
          onClick={() => onRequestDelete(device)}
        >
          <TrashOutline color="#b42318" height="16px" width="16px" title="" />
          Delete device
        </button>
      )}

      {error && <p className="device-settings__error">{error}</p>}
    </div>
  );
}

export default DeviceSettingsPanel;
