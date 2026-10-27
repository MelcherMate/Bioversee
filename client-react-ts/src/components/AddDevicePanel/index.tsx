import { FormEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import {
  createMyDevice,
  updateMyDeviceConfig,
  type DeviceType,
} from "../../lib/devices";
import { DEVICE_TYPE_META } from "../../lib/deviceIcons";
import {
  defaultBioreactorConfig,
  parseVolumeInput,
  toBioreactorConfigPatch,
  VESSEL_SHAPE_OPTIONS,
  vesselShapePreset,
  type BioreactorConfig,
  type BioreactorEquipment,
  type BioreactorFluid,
  type VesselShapeId,
  type VolumeUnit,
} from "../../lib/bioreactorGeometry";
import EquipmentChecklist from "../EquipmentChecklist";
import FluidPropertiesFields from "../FluidPropertiesFields";
import VesselShapeSkeleton from "../VesselShapeSkeleton";
import "./AddDevicePanel.css";

/** Creation is bioreactor-only for now. */
const CREATE_DEVICE_TYPE: DeviceType = "bioreactor";

type AddDevicePanelProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (deviceId: string, type: DeviceType) => void;
  defaultType?: DeviceType;
  /** Plant to attach the new device to (active plant). */
  plantId?: string | null;
  /** Prefill vessel shape (e.g. from the Blueprint device library). */
  initialVesselShape?: VesselShapeId;
};

function AddDevicePanel({
  open,
  onClose,
  onCreated,
  plantId,
  initialVesselShape,
}: AddDevicePanelProps) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const [name, setName] = useState("");
  const [config, setConfig] = useState<BioreactorConfig>(() =>
    defaultBioreactorConfig(),
  );
  const [volumeText, setVolumeText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(t(DEVICE_TYPE_META[CREATE_DEVICE_TYPE].labelKey));
    const next = defaultBioreactorConfig();
    if (initialVesselShape) {
      next.vessel_shape = initialVesselShape;
    }
    setConfig(next);
    setVolumeText("");
    setError(null);
  }, [open, t, initialVesselShape]);

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

  const setVolumeUnit = (unit: VolumeUnit) => {
    setVolumeText("");
    setConfig((prev) => ({ ...prev, volume_unit: unit, volume_m3: null }));
  };

  const onVolumeTextChange = (raw: string) => {
    const cleaned = raw.replace(/[^\d.,]/g, "").replace(",", ".");
    setVolumeText(raw);
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

  const setVesselShape = (vessel_shape: VesselShapeId) => {
    setConfig((prev) => ({ ...prev, vessel_shape }));
  };

  const setEquipment = (equipment: BioreactorEquipment) => {
    setConfig((prev) => ({ ...prev, equipment }));
  };

  const setFluid = (fluid: BioreactorFluid) => {
    setConfig((prev) => ({ ...prev, fluid }));
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const deviceId = await createMyDevice({
        type: CREATE_DEVICE_TYPE,
        name: name.trim(),
        plantId: plantId ?? null,
      });
      await updateMyDeviceConfig(deviceId, toBioreactorConfigPatch(config));
      onCreated(deviceId, CREATE_DEVICE_TYPE);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("addDevice.couldNotCreate"));
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  const meta = DEVICE_TYPE_META[CREATE_DEVICE_TYPE];
  const volumePlaceholder =
    config.volume_unit === "L"
      ? t("deviceSettings.volumePlaceholderL")
      : t("deviceSettings.volumePlaceholderM3");

  return createPortal(
    <div className="add-device" role="presentation">
      <button
        type="button"
        className="add-device__backdrop"
        aria-label={t("common.close")}
        onClick={onClose}
      />
      <div
        className="add-device__dialog"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t("nav.addDevice")}
      >
        <div className="add-device__head">
          <div>
            <p className="add-device__eyebrow">{t("addDevice.eyebrow")}</p>
            <h2 className="add-device__title">{t("addDevice.title")}</h2>
          </div>
          <button
            type="button"
            className="add-device__close"
            onClick={onClose}
            aria-label={t("common.close")}
          >
            ×
          </button>
        </div>

        <form className="add-device__form" onSubmit={onSubmit}>
          <p className="add-device__label">{t("addDevice.type")}</p>
          <div className="add-device__type-static">
            <span className="add-device__type-label">{t(meta.labelKey)}</span>
          </div>
          <p className="add-device__hint">{t(meta.descriptionKey)}</p>

          <label className="add-device__label" htmlFor="add-device-name">
            {t("addDevice.name")}
          </label>
          <input
            id="add-device-name"
            className="add-device__input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t("addDevice.namePlaceholder")}
            maxLength={80}
            required
            autoFocus
          />

          <div className="add-device__geometry">
            <p className="add-device__label" id="add-vessel-shape-label">
              {t("vesselShape.title")}
            </p>
            <p className="add-device__hint">{t("vesselShape.hint")}</p>
            <div
              className="add-device__shapes"
              role="radiogroup"
              aria-labelledby="add-vessel-shape-label"
            >
              {VESSEL_SHAPE_OPTIONS.map((shapeId) => {
                const preset = vesselShapePreset(shapeId);
                const active = config.vessel_shape === shapeId;
                return (
                  <button
                    key={shapeId}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    className={`add-device__shape-btn${active ? " is-active" : ""}`}
                    disabled={busy}
                    onClick={() => setVesselShape(shapeId)}
                  >
                    <VesselShapeSkeleton shape={shapeId} height={104} />
                    <span className="add-device__shape-name">
                      {t(preset.labelKey)}
                    </span>
                    <span className="add-device__shape-hint">
                      {t(preset.hintKey)}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="add-device__volume-row">
              <label className="add-device__label" htmlFor="add-geo-volume">
                {t("deviceSettings.volume")}
              </label>
              <div className="add-device__unit-toggle" role="group">
                <button
                  type="button"
                  className={
                    config.volume_unit === "L" ? "is-active" : undefined
                  }
                  disabled={busy}
                  onClick={() => setVolumeUnit("L")}
                >
                  L
                </button>
                <button
                  type="button"
                  className={
                    config.volume_unit === "m3" ? "is-active" : undefined
                  }
                  disabled={busy}
                  onClick={() => setVolumeUnit("m3")}
                >
                  m³
                </button>
              </div>
            </div>
            <p className="add-device__hint">
              {t("deviceSettings.volumeHint")}
            </p>
            <input
              id="add-geo-volume"
              className="add-device__input"
              type="text"
              inputMode="decimal"
              value={volumeText}
              placeholder={volumePlaceholder}
              disabled={busy}
              onChange={(event) => onVolumeTextChange(event.target.value)}
            />
          </div>

          <section className="add-device__equipment">
            <p className="add-device__label">{t("equipment.title")}</p>
            <p className="add-device__hint">{t("equipment.hint")}</p>
            <EquipmentChecklist
              value={config.equipment}
              onChange={setEquipment}
              disabled={busy}
            />
          </section>

          <FluidPropertiesFields
            value={config.fluid}
            onChange={setFluid}
            disabled={busy}
            variant="add"
          />

          <button
            type="submit"
            className="add-device__primary"
            disabled={busy || !name.trim()}
          >
            {busy ? t("addDevice.creating") : t("addDevice.create")}
          </button>
          {error && <p className="add-device__error">{error}</p>}
        </form>
      </div>
    </div>,
    document.body,
  );
}

export default AddDevicePanel;
