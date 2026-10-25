import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import {
  CreateOutline,
  ShareSocialOutline,
  TrashOutline,
} from "react-ionicons";
import type { Plant } from "../../lib/plants";
import "../../components/DeviceContextMenu/DeviceContextMenu.css";

type PlantContextMenuProps = {
  plant: Plant;
  x: number;
  y: number;
  canDelete: boolean;
  onClose: () => void;
  onRename: (plant: Plant) => void;
  onShare: (plant: Plant) => void;
  onDelete: (plant: Plant) => void;
};

function readCssVar(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  return (
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() ||
    fallback
  );
}

export default function PlantContextMenu({
  plant,
  x,
  y,
  canDelete,
  onClose,
  onRename,
  onShare,
  onDelete,
}: PlantContextMenuProps) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement | null>(null);
  const iconColor = readCssVar("--bv-text", "#1d1d1f");
  const dangerColor = readCssVar("--bv-danger", "#b42318");

  useEffect(() => {
    const handlePointer = (event: MouseEvent) => {
      if (
        ref.current &&
        event.target instanceof Node &&
        !ref.current.contains(event.target)
      ) {
        onClose();
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  const menuWidth = 200;
  const left = Math.min(x, window.innerWidth - menuWidth - 12);
  const top = Math.min(y, window.innerHeight - 220);

  return createPortal(
    <div
      ref={ref}
      className="device-ctx"
      style={{ left, top }}
      role="menu"
      aria-label={t("controlPanel.plantMenu", { name: plant.name })}
    >
      <p className="device-ctx__name">{plant.name}</p>
      <button
        type="button"
        className="device-ctx__item"
        role="menuitem"
        onClick={() => {
          onRename(plant);
          onClose();
        }}
      >
        <CreateOutline color={iconColor} height="16px" width="16px" title="" />
        {t("controlPanel.rename")}
      </button>
      <button
        type="button"
        className="device-ctx__item"
        role="menuitem"
        onClick={() => {
          onShare(plant);
          onClose();
        }}
      >
        <ShareSocialOutline
          color={iconColor}
          height="16px"
          width="16px"
          title=""
        />
        {t("controlPanel.share")}
      </button>
      {canDelete ? (
        <button
          type="button"
          className="device-ctx__item device-ctx__item--danger"
          role="menuitem"
          onClick={() => {
            onDelete(plant);
            onClose();
          }}
        >
          <TrashOutline
            color={dangerColor}
            height="16px"
            width="16px"
            title=""
          />
          {t("common.delete")}
        </button>
      ) : null}
    </div>,
    document.body,
  );
}
