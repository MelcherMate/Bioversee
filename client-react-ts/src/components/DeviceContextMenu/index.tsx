import { useEffect, useRef } from "react";
import {
  ExitOutline,
  SettingsOutline,
  ShareSocialOutline,
  TrashOutline,
} from "react-ionicons";
import type { AccessibleDevice } from "../../lib/devices";
import "./DeviceContextMenu.css";

type DeviceContextMenuProps = {
  device: AccessibleDevice;
  x: number;
  y: number;
  onClose: () => void;
  onSettings: (device: AccessibleDevice) => void;
  onShare: (device: AccessibleDevice) => void;
  onDelete: (device: AccessibleDevice) => void;
  onLeave: (device: AccessibleDevice) => void;
};

function DeviceContextMenu({
  device,
  x,
  y,
  onClose,
  onSettings,
  onShare,
  onDelete,
  onLeave,
}: DeviceContextMenuProps) {
  const ref = useRef<HTMLDivElement | null>(null);

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
  const top = Math.min(y, window.innerHeight - 200);

  return (
    <div
      ref={ref}
      className="device-ctx"
      style={{ left, top }}
      role="menu"
      aria-label={`${device.name} options`}
    >
      <p className="device-ctx__name">{device.name}</p>
      <button
        type="button"
        className="device-ctx__item"
        role="menuitem"
        onClick={() => {
          onSettings(device);
          onClose();
        }}
      >
        <SettingsOutline color="#1d1d1f" height="16px" width="16px" title="" />
        Device settings
      </button>
      <button
        type="button"
        className="device-ctx__item"
        role="menuitem"
        onClick={() => {
          onShare(device);
          onClose();
        }}
      >
        <ShareSocialOutline
          color="#1d1d1f"
          height="16px"
          width="16px"
          title=""
        />
        Share
      </button>
      {device.isOwner ? (
        <button
          type="button"
          className="device-ctx__item device-ctx__item--danger"
          role="menuitem"
          onClick={() => {
            onDelete(device);
            onClose();
          }}
        >
          <TrashOutline color="#b42318" height="16px" width="16px" title="" />
          Delete device
        </button>
      ) : (
        <button
          type="button"
          className="device-ctx__item device-ctx__item--danger"
          role="menuitem"
          onClick={() => {
            onLeave(device);
            onClose();
          }}
        >
          <ExitOutline color="#b42318" height="16px" width="16px" title="" />
          Leave device
        </button>
      )}
    </div>
  );
}

export default DeviceContextMenu;
