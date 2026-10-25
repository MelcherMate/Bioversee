import type { CSSProperties, DragEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  VESSEL_SHAPE_OPTIONS,
  vesselShapePreset,
  type VesselShapeId,
} from "../../../lib/bioreactorGeometry";
import { DEVICE_TYPE_META } from "../../../lib/deviceIcons";
import VesselShapeSkeleton from "../../../components/VesselShapeSkeleton";
import "./DeviceLibrary.css";

export const DEVICE_LIBRARY_MIME = "application/x-bioversee-device";

export type DeviceLibraryPayload = {
  type: "bioreactor";
  vesselShape: VesselShapeId;
};

type DeviceLibraryProps = {
  open: boolean;
};

function DeviceLibrary({ open }: DeviceLibraryProps) {
  const { t } = useTranslation();
  const bioreactorMeta = DEVICE_TYPE_META.bioreactor;

  const onTileDragStart = (
    event: DragEvent<HTMLButtonElement>,
    vesselShape: VesselShapeId,
  ) => {
    const payload: DeviceLibraryPayload = {
      type: "bioreactor",
      vesselShape,
    };
    event.dataTransfer.setData(DEVICE_LIBRARY_MIME, JSON.stringify(payload));
    event.dataTransfer.setData("text/plain", vesselShape);
    event.dataTransfer.effectAllowed = "copy";
    event.currentTarget.classList.add("is-dragging");
  };

  const onTileDragEnd = (event: DragEvent<HTMLButtonElement>) => {
    event.currentTarget.classList.remove("is-dragging");
  };

  return (
    <aside
      className={`bp-library ${open ? "is-open" : ""}`}
      aria-label={t("controlPanel.deviceLibrary")}
      aria-hidden={!open}
    >
      <div className="bp-library__inner">
        <nav
          className="bp-library__rail"
          aria-label={t("controlPanel.deviceTypes")}
        >
          <p className="bp-library__eyebrow">{t("controlPanel.deviceLibrary")}</p>
          <div
            className="bp-library__types"
            role="listbox"
            aria-label={t("controlPanel.deviceTypes")}
          >
            <button
              type="button"
              role="option"
              aria-selected
              className="bp-library__type is-active"
              tabIndex={open ? 0 : -1}
            >
              {t(bioreactorMeta.labelKey)}
            </button>
          </div>
        </nav>

        <div className="bp-library__stage">
          <div className="bp-library__tiles" role="list">
            {VESSEL_SHAPE_OPTIONS.map((shapeId, index) => {
              const preset = vesselShapePreset(shapeId);
              return (
                <button
                  key={shapeId}
                  type="button"
                  role="listitem"
                  className="bp-library__tile"
                  style={{ "--bp-tile-i": index } as CSSProperties}
                  draggable={open}
                  tabIndex={open ? 0 : -1}
                  onDragStart={(event) => onTileDragStart(event, shapeId)}
                  onDragEnd={onTileDragEnd}
                  aria-label={t(preset.labelKey)}
                >
                  <span className="bp-library__tile-figure">
                    <VesselShapeSkeleton shape={shapeId} height={72} />
                  </span>
                  <span className="bp-library__tile-name">{t(preset.labelKey)}</span>
                  <span className="bp-library__tile-hint">{t(preset.hintKey)}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
}

export default DeviceLibrary;
