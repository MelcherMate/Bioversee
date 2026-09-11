import { useTranslation } from "react-i18next";
import "./WebAppPreview.css";

function WebAppPreview() {
  const { t } = useTranslation();

  return (
    <div
      className="web-preview"
      aria-label={t("about.webLabel")}
      role="img"
    >
      <div className="web-preview__chrome" aria-hidden="true">
        <span className="web-preview__dot" />
        <span className="web-preview__dot" />
        <span className="web-preview__dot" />
        <span className="web-preview__url" />
      </div>
      <div className="web-preview__stage" aria-hidden="true">
        <aside className="web-preview__controls">
          <div className="web-preview__panel">
            <span className="web-preview__label" />
            <span className="web-preview__switch" />
            <span className="web-preview__switch" />
            <span className="web-preview__switch" />
            <span className="web-preview__switch" />
          </div>
          <div className="web-preview__panel">
            <span className="web-preview__label" />
            <span className="web-preview__slider">
              <span className="web-preview__slider-track" />
              <span className="web-preview__slider-thumb" />
            </span>
            <span className="web-preview__slider">
              <span className="web-preview__slider-track" />
              <span className="web-preview__slider-thumb web-preview__slider-thumb--alt" />
            </span>
          </div>
        </aside>

        <div className="web-preview__canvas">
          <span className="web-preview__vessel" />
          <span className="web-preview__vessel-pipe web-preview__vessel-pipe--l" />
          <span className="web-preview__vessel-pipe web-preview__vessel-pipe--r" />
          <span className="web-preview__vessel-base" />
        </div>

        <aside className="web-preview__charts">
          <div className="web-preview__panel web-preview__panel--chart">
            <span className="web-preview__label" />
            <span className="web-preview__chart-line" />
            <span className="web-preview__chart-axis" />
          </div>
          <div className="web-preview__panel web-preview__panel--chart">
            <span className="web-preview__label" />
            <span className="web-preview__chart-line web-preview__chart-line--b" />
            <span className="web-preview__chart-axis" />
          </div>
        </aside>
      </div>
    </div>
  );
}

export default WebAppPreview;
