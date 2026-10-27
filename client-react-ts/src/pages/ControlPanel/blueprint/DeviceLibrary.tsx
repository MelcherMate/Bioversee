import type { CSSProperties, DragEvent } from "react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDownOutline, ChevronUpOutline } from "react-ionicons";
import {
  VESSEL_SHAPE_OPTIONS,
  vesselShapePreset,
  type VesselShapeId,
} from "../../../lib/bioreactorGeometry";
import { DEVICE_TYPE_META } from "../../../lib/deviceIcons";
import {
  PIPE_FITTING_TILES,
  type PipeBore,
  type PipeFittingTileKind,
} from "../../../lib/pipeFittings";
import VesselShapeSkeleton from "../../../components/VesselShapeSkeleton";
import "./DeviceLibrary.css";

export const DEVICE_LIBRARY_MIME = "application/x-bioversee-device";

export type DeviceLibraryPayload =
  | { type: "bioreactor"; vesselShape: VesselShapeId }
  | { type: "pipe_fitting"; kind: PipeFittingTileKind; bore: PipeBore };

type LibraryCategory = "bioreactor" | "piping";

type DeviceLibraryProps = {
  open: boolean;
};

function DeviceLibrary({ open }: DeviceLibraryProps) {
  const { t } = useTranslation();
  const bioreactorMeta = DEVICE_TYPE_META.bioreactor;
  const [collapsed, setCollapsed] = useState(false);
  const [category, setCategory] = useState<LibraryCategory>("bioreactor");
  const [pipeBore, setPipeBore] = useState<PipeBore>("wide");

  useEffect(() => {
    if (!open) {
      setCollapsed(false);
      setCategory("bioreactor");
    }
  }, [open]);

  const interactive = open && !collapsed;

  const onBioreactorDragStart = (
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

  const onFittingDragStart = (
    event: DragEvent<HTMLButtonElement>,
    kind: PipeFittingTileKind,
  ) => {
    const payload: DeviceLibraryPayload = {
      type: "pipe_fitting",
      kind,
      bore: pipeBore,
    };
    event.dataTransfer.setData(DEVICE_LIBRARY_MIME, JSON.stringify(payload));
    event.dataTransfer.setData("text/plain", `pipe_fitting:${kind}:${pipeBore}`);
    event.dataTransfer.effectAllowed = "copy";
    event.currentTarget.classList.add("is-dragging");
  };

  const onTileDragEnd = (event: DragEvent<HTMLButtonElement>) => {
    event.currentTarget.classList.remove("is-dragging");
  };

  return (
    <aside
      className={[
        "bp-library",
        open ? "is-open" : "",
        collapsed ? "is-collapsed" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={t("controlPanel.deviceLibrary")}
      aria-hidden={!open}
    >
      <div className="bp-library__sheet">
        <button
          type="button"
          className="bp-library__toggle"
          aria-expanded={open && !collapsed}
          aria-controls="bp-library-panel"
          tabIndex={open ? 0 : -1}
          onClick={() => setCollapsed((value) => !value)}
          title={
            collapsed
              ? t("controlPanel.showDeviceLibrary")
              : t("controlPanel.hideDeviceLibrary")
          }
          aria-label={
            collapsed
              ? t("controlPanel.showDeviceLibrary")
              : t("controlPanel.hideDeviceLibrary")
          }
        >
          <span className="bp-library__notch" aria-hidden="true" />
          <span className="bp-library__toggle-icon">
            {collapsed ? (
              <ChevronUpOutline
                color="currentColor"
                height="16px"
                width="16px"
              />
            ) : (
              <ChevronDownOutline
                color="currentColor"
                height="16px"
                width="16px"
              />
            )}
          </span>
        </button>

        <div className="bp-library__inner" id="bp-library-panel">
          <nav
            className="bp-library__rail"
            aria-label={t("controlPanel.deviceTypes")}
          >
            <p className="bp-library__eyebrow">
              {t("controlPanel.deviceLibrary")}
            </p>
            <div
              className="bp-library__types"
              role="listbox"
              aria-label={t("controlPanel.deviceTypes")}
            >
              <button
                type="button"
                role="option"
                aria-selected={category === "bioreactor"}
                className={`bp-library__type ${category === "bioreactor" ? "is-active" : ""}`}
                tabIndex={interactive ? 0 : -1}
                onClick={() => setCategory("bioreactor")}
              >
                {t(bioreactorMeta.labelKey)}
              </button>
              <button
                type="button"
                role="option"
                aria-selected={category === "piping"}
                className={`bp-library__type ${category === "piping" ? "is-active" : ""}`}
                tabIndex={interactive ? 0 : -1}
                onClick={() => setCategory("piping")}
              >
                {t("piping.section")}
              </button>
              {category === "piping" ? (
                <ul
                  className="bp-library__dots"
                  role="listbox"
                  aria-label={t("piping.boreSelect")}
                >
                  <li>
                    <button
                      type="button"
                      role="option"
                      aria-selected={pipeBore === "wide"}
                      className={`bp-library__dot ${pipeBore === "wide" ? "is-active" : ""}`}
                      tabIndex={interactive ? 0 : -1}
                      onClick={() => setPipeBore("wide")}
                    >
                      {t("piping.widePipe")}
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      role="option"
                      aria-selected={pipeBore === "thin"}
                      className={`bp-library__dot ${pipeBore === "thin" ? "is-active" : ""}`}
                      tabIndex={interactive ? 0 : -1}
                      onClick={() => setPipeBore("thin")}
                    >
                      {t("piping.thinPipe")}
                    </button>
                  </li>
                </ul>
              ) : null}
            </div>
          </nav>

          <div className="bp-library__stage">
            {category === "bioreactor" ? (
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
                      draggable={interactive}
                      tabIndex={interactive ? 0 : -1}
                      onDragStart={(event) =>
                        onBioreactorDragStart(event, shapeId)
                      }
                      onDragEnd={onTileDragEnd}
                      aria-label={t(preset.labelKey)}
                    >
                      <span className="bp-library__tile-figure">
                        <VesselShapeSkeleton shape={shapeId} height={72} />
                      </span>
                      <span className="bp-library__tile-name">
                        {t(preset.labelKey)}
                      </span>
                      <span className="bp-library__tile-hint">
                        {t(preset.hintKey)}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <ul className="bp-library__fit-list" role="list">
                {PIPE_FITTING_TILES.map((tile) => (
                  <li key={tile.kind}>
                    <button
                      type="button"
                      className="bp-library__fit"
                      draggable={interactive}
                      tabIndex={interactive ? 0 : -1}
                      onDragStart={(event) =>
                        onFittingDragStart(event, tile.kind)
                      }
                      onDragEnd={onTileDragEnd}
                      aria-label={t(tile.labelKey)}
                    >
                      <span className="bp-library__fit-name">
                        {t(tile.labelKey)}
                      </span>
                      <span className="bp-library__fit-hint">
                        {t(tile.hintKey)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}

export default DeviceLibrary;
