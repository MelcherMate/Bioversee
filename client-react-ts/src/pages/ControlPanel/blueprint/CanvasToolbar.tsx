import { GridOutline } from "react-ionicons";
import { useTranslation } from "react-i18next";

export const CANVAS_GRID_GAP = 18;

type CanvasToolbarProps = {
  snapToGrid: boolean;
  onSnapToGridChange: (next: boolean) => void;
};

/**
 * Compact top-center canvas chrome. Snap is first; add more icon toggles
 * beside it as peers in `.bp-canvas-toolbar__group`.
 */
export default function CanvasToolbar({
  snapToGrid,
  onSnapToGridChange,
}: CanvasToolbarProps) {
  const { t } = useTranslation();

  return (
    <div className="bp-canvas-toolbar" role="toolbar" aria-label={t("controlPanel.canvasToolbar")}>
      <div className="bp-canvas-toolbar__group">
        <button
          type="button"
          className={[
            "bp-canvas-toolbar__btn",
            snapToGrid ? "is-active" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-pressed={snapToGrid}
          aria-label={t("controlPanel.snapToGrid")}
          title={t("controlPanel.snapToGrid")}
          onClick={() => onSnapToGridChange(!snapToGrid)}
        >
          <span className="bp-canvas-toolbar__icon" aria-hidden="true">
            <GridOutline color="currentColor" height="16px" width="16px" />
          </span>
        </button>
      </div>
    </div>
  );
}
