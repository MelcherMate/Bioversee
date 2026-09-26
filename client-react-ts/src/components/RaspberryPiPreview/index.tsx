import { useTranslation } from "react-i18next";
import "./RaspberryPiPreview.css";

function RaspberryPiPreview() {
  const { t } = useTranslation();

  return (
    <div className="pi-preview">
      <div
        className="pi-preview__device"
        aria-label={t("about.piLabel")}
        role="img"
      >
        <div className="pi-preview__board" aria-hidden="true">
          <span className="pi-preview__chip">
            <span className="pi-preview__chip-die" />
            <span className="pi-preview__chip-mark">{t("common.brand")}</span>
          </span>
          <span className="pi-preview__gpio" />
          <span className="pi-preview__ports">
            <span className="pi-preview__port pi-preview__port--usb" />
            <span className="pi-preview__port pi-preview__port--usb" />
            <span className="pi-preview__port pi-preview__port--hdmi" />
            <span className="pi-preview__port pi-preview__port--power" />
          </span>
          <span className="pi-preview__leds">
            <span className="pi-preview__led pi-preview__led--pwr" />
            <span className="pi-preview__led pi-preview__led--act" />
          </span>
        </div>

        <div className="pi-preview__screen" aria-hidden="true">
          <div className="pi-preview__screen-bezel">
            <div className="pi-preview__ui">
              <span className="pi-preview__ui-title" />
              <span className="pi-preview__ui-row">
                <span className="pi-preview__ui-dot is-on" />
                <span className="pi-preview__ui-bar" />
              </span>
              <span className="pi-preview__ui-row">
                <span className="pi-preview__ui-dot" />
                <span className="pi-preview__ui-bar pi-preview__ui-bar--short" />
              </span>
              <span className="pi-preview__ui-gauge">
                <span className="pi-preview__ui-gauge-fill" />
              </span>
              <span className="pi-preview__ui-chart">
                <span />
                <span />
                <span />
                <span />
                <span />
              </span>
            </div>
          </div>
        </div>
      </div>
      <p className="pi-preview__caption">{t("about.piCaption")}</p>
    </div>
  );
}

export default RaspberryPiPreview;
