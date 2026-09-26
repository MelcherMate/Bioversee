import { FormEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { TrashOutline } from "react-ionicons";
import {
  canAdminDevice,
  renameMyDevice,
  updateMyDeviceConfig,
  type AccessibleDevice,
} from "../../lib/devices";
import { DEVICE_TYPE_META } from "../../lib/deviceIcons";
import {
  defaultBioreactorConfig,
  formatVolume,
  parseBioreactorConfig,
  parseVolumeInput,
  toBioreactorConfigPatch,
  type BioreactorConfig,
  type BioreactorEquipment,
  type VolumeUnit,
} from "../../lib/bioreactorGeometry";
import { notifyDeviceUpdated } from "../../lib/deviceEvents";
import EquipmentChecklist from "../EquipmentChecklist";
import "./DeviceSettingsPanel.css";

type DeviceSettingsPanelProps = {
  device: AccessibleDevice | null;
  open: boolean;
  onClose: () => void;
  onRenamed: () => void;
  onRequestDelete: (device: AccessibleDevice) => void;
  anchor?: { x: number; y: number } | null;
};

function DeviceSettingsPanel({
  device,
  open,
  onClose,
  onRenamed,
  onRequestDelete,
}: DeviceSettingsPanelProps) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [cfgBusy, setCfgBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [cfgSaved, setCfgSaved] = useState(false);
  const [config, setConfig] = useState<BioreactorConfig>(() =>
    defaultBioreactorConfig(),
  );
  const [volumeText, setVolumeText] = useState("");

  useEffect(() => {
    if (!open || !device) return;
    setName(device.name);
    setError(null);
    setSaved(false);
    setCfgSaved(false);
    const next = parseBioreactorConfig(device.config);
    setConfig(next);
    setVolumeText(
      next.volume_m3 == null
        ? ""
        : String(
            Number(
              formatVolume(next.volume_m3, next.volume_unit).toPrecision(6),
            ),
          ),
    );
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
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open || !device) return null;

  const meta = DEVICE_TYPE_META[device.type];
  const canRename = canAdminDevice(device.role);
  const isBioreactor = device.type === "bioreactor";

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
      notifyDeviceUpdated(device.id);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("deviceSettings.couldNotSave"),
      );
    } finally {
      setBusy(false);
    }
  };

  const setVolumeUnit = (unit: VolumeUnit) => {
    setVolumeText("");
    setConfig((prev) => ({ ...prev, volume_unit: unit, volume_m3: null }));
    setCfgSaved(false);
  };

  const onVolumeTextChange = (raw: string) => {
    const cleaned = raw.replace(/[^\d.,]/g, "").replace(",", ".");
    setVolumeText(raw);
    setCfgSaved(false);
    if (!cleaned.trim()) {
      setConfig((prev) => ({ ...prev, volume_m3: null }));
      return;
    }
    const n = Number(cleaned);
    if (!Number.isFinite(n)) return;
    setConfig((prev) => ({
      ...prev,
      volume_m3: parseVolumeInput(n, prev.volume_unit),
    }));
  };

  const setEquipment = (equipment: BioreactorEquipment) => {
    setConfig((prev) => ({ ...prev, equipment }));
    setCfgSaved(false);
  };

  const onSaveConfig = async () => {
    if (!canRename || cfgBusy) return;
    setCfgBusy(true);
    setError(null);
    setCfgSaved(false);
    try {
      await updateMyDeviceConfig(device.id, toBioreactorConfigPatch(config));
      setCfgSaved(true);
      onRenamed();
      notifyDeviceUpdated(device.id);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("deviceSettings.couldNotSave"),
      );
    } finally {
      setCfgBusy(false);
    }
  };

  const volumePlaceholder =
    config.volume_unit === "L"
      ? t("deviceSettings.volumePlaceholderL")
      : t("deviceSettings.volumePlaceholderM3");

  return createPortal(
    <div className="device-settings" role="presentation">
      <button
        type="button"
        className="device-settings__backdrop"
        aria-label={t("common.close")}
        onClick={onClose}
      />
      <div
        className="device-settings__dialog"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t("deviceSettings.aria")}
      >
        <div className="device-settings__head">
          <div className="device-settings__title-row">
            <div>
              <p className="device-settings__eyebrow">
                {t("deviceSettings.eyebrow")}
              </p>
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
          <label
            className="device-settings__label"
            htmlFor="device-settings-name"
          >
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
            <p className="device-settings__hint">
              {t("deviceSettings.renameHint")}
            </p>
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

        {isBioreactor ? (
          <div className="device-settings__geometry">
            <div className="device-settings__volume-row">
              <label className="device-settings__label" htmlFor="geo-volume">
                {t("deviceSettings.volume")}
              </label>
              <div className="device-settings__unit-toggle" role="group">
                <button
                  type="button"
                  className={
                    config.volume_unit === "L" ? "is-active" : undefined
                  }
                  disabled={!canRename || cfgBusy}
                  onClick={() => setVolumeUnit("L")}
                >
                  L
                </button>
                <button
                  type="button"
                  className={
                    config.volume_unit === "m3" ? "is-active" : undefined
                  }
                  disabled={!canRename || cfgBusy}
                  onClick={() => setVolumeUnit("m3")}
                >
                  m³
                </button>
              </div>
            </div>
            <p className="device-settings__hint">
              {t("deviceSettings.volumeHint")}
            </p>
            <input
              id="geo-volume"
              className="device-settings__input"
              type="text"
              inputMode="decimal"
              value={volumeText}
              placeholder={volumePlaceholder}
              disabled={!canRename || cfgBusy}
              onChange={(event) => onVolumeTextChange(event.target.value)}
            />

            <p className="device-settings__label device-settings__equip-label">
              {t("equipment.title")}
            </p>
            <p className="device-settings__hint">{t("equipment.hint")}</p>
            <EquipmentChecklist
              value={config.equipment}
              onChange={setEquipment}
              disabled={!canRename || cfgBusy}
            />

            {canRename ? (
              <button
                type="button"
                className="device-settings__primary"
                disabled={cfgBusy}
                onClick={() => void onSaveConfig()}
              >
                {cfgBusy
                  ? t("deviceSettings.saving")
                  : cfgSaved
                    ? t("deviceSettings.saved")
                    : t("deviceSettings.saveGeometry")}
              </button>
            ) : (
              <p className="device-settings__hint">
                {t("deviceSettings.geometryReadOnly")}
              </p>
            )}
          </div>
        ) : null}

        {device.isOwner && (
          <button
            type="button"
            className="device-settings__danger"
            onClick={() => onRequestDelete(device)}
          >
            <TrashOutline
              color={
                getComputedStyle(document.documentElement)
                  .getPropertyValue("--bv-danger")
                  .trim() || "#b42318"
              }
              height="16px"
              width="16px"
              title=""
            />
            {t("deviceSettings.deleteDevice")}
          </button>
        )}

        {error && <p className="device-settings__error">{error}</p>}
      </div>
    </div>,
    document.body,
  );
}

export default DeviceSettingsPanel;
