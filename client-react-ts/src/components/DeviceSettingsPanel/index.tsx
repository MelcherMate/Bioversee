import { FormEvent, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
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
  /** Viewport coords — panel opens below this point (near the device icon). */
  anchor?: { x: number; y: number } | null;
};

function DeviceSettingsPanel({
  device,
  open,
  onClose,
  onRenamed,
  onRequestDelete,
  anchor = null,
}: DeviceSettingsPanelProps) {
  const { t } = useTranslation();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
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
    if (!open || !device) return;
    if (!canAdminDevice(device.role)) return;
    const id = window.setTimeout(() => {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    }, 30);
    return () => window.clearTimeout(id);
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
  const canRename = canAdminDevice(device.role);
  const panelWidth = Math.min(320, typeof window !== "undefined" ? window.innerWidth - 28 : 320);
  const left = anchor
    ? Math.max(
        12,
        Math.min(anchor.x, (typeof window !== "undefined" ? window.innerWidth : 400) - panelWidth - 12)
      )
    : undefined;
  const top = anchor ? Math.min(anchor.y + 8, (typeof window !== "undefined" ? window.innerHeight : 600) - 80) : undefined;

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
      setError(err instanceof Error ? err.message : t("deviceSettings.couldNotSave"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={`device-settings${anchor ? " device-settings--anchored" : ""}`}
      ref={panelRef}
      role="dialog"
      aria-label={t("deviceSettings.aria")}
      style={
        anchor
          ? { top, left, width: panelWidth }
          : undefined
      }
    >
      <div className="device-settings__head">
        <div className="device-settings__title-row">
          <div>
            <p className="device-settings__eyebrow">{t("deviceSettings.eyebrow")}</p>
            <h2 className="device-settings__title">{t(meta.labelKey)}</h2>
          </div>
        </div>
        <button
          type="button"
          className="device-settings__close"
          onClick={onClose}
          aria-label={t("common.close")}
        >
          ×
        </button>
      </div>

      <form onSubmit={onSubmit}>
        <label className="device-settings__label" htmlFor="device-settings-name">
          {t("deviceSettings.deviceName")}
        </label>
        <input
          id="device-settings-name"
          ref={nameInputRef}
          className="device-settings__input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          disabled={!canRename || busy}
          maxLength={80}
          required
        />
        {!canRename && (
          <p className="device-settings__hint">{t("deviceSettings.renameHint")}</p>
        )}

        {canRename && (
          <button
            type="submit"
            className="device-settings__primary"
            disabled={busy || !name.trim() || name.trim() === device.name}
          >
            {busy
              ? t("deviceSettings.saving")
              : saved
                ? t("deviceSettings.saved")
                : t("deviceSettings.saveName")}
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
          {t("deviceSettings.deleteDevice")}
        </button>
      )}

      {error && <p className="device-settings__error">{error}</p>}
    </div>
  );
}

export default DeviceSettingsPanel;
