import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import "./EmptyDeviceState.css";

type EmptyDeviceStateProps = {
  processLabel: string;
};

function EmptyDeviceState({ processLabel }: EmptyDeviceStateProps) {
  const { t } = useTranslation();

  return (
    <div className="empty-device">
      <div className="empty-device__card">
        <p className="empty-device__eyebrow">{t("emptyDevice.title")}</p>
        <h1 className="empty-device__title">
          {t("emptyDevice.heading", { process: processLabel })}
        </h1>
        <p className="empty-device__body">{t("emptyDevice.body")}</p>
        <Link className="empty-device__hint" to="/bioreactor">
          {t("emptyDevice.hint")}
        </Link>
      </div>
    </div>
  );
}

export default EmptyDeviceState;
