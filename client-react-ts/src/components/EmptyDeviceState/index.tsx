import { useTranslation } from "react-i18next";
import { AddOutline } from "react-ionicons";
import type { DeviceType } from "../../lib/devices";
import { requestOpenAddDevice } from "../../lib/onboarding";
import "./EmptyDeviceState.css";

type EmptyDeviceStateProps = {
  /** Prefills the header add-device panel with this process type. */
  deviceType?: DeviceType;
};

function EmptyDeviceState({ deviceType = "bioreactor" }: EmptyDeviceStateProps) {
  const { t } = useTranslation();

  return (
    <div className="empty-device">
      <div className="empty-device__card">
        <p className="empty-device__eyebrow">{t("emptyDevice.title")}</p>
        <h1 className="empty-device__title">{t("emptyDevice.heading")}</h1>
        <div className="empty-device__actions">
          <button
            type="button"
            className="empty-device__add-btn"
            onClick={() => requestOpenAddDevice(deviceType)}
          >
            <AddOutline color="currentColor" height="18px" width="18px" />
            {t("emptyDevice.addButton")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default EmptyDeviceState;
