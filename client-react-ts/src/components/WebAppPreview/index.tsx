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
      <header className="web-preview__nav" aria-hidden="true">
        <div className="web-preview__nav-left">
          <span className="web-preview__brand-dot" />
          <span className="web-preview__brand-bar" />
          <span className="web-preview__nav-add" />
          <span className="web-preview__nav-device" />
          <span className="web-preview__nav-device" />
          <span className="web-preview__nav-device" />
          <span className="web-preview__nav-device" />
        </div>
        <div className="web-preview__nav-right">
          <span className="web-preview__nav-tool" />
          <span className="web-preview__nav-tool web-preview__nav-tool--badge" />
          <span className="web-preview__nav-avatar" />
        </div>
      </header>

      <div className="web-preview__stage" aria-hidden="true">
        <aside className="web-preview__controls">
          <div className="web-preview__panel">
            <span className="web-preview__section-label" />
            <span className="web-preview__row">
              <span className="web-preview__row-text" />
              <span className="web-preview__toggle is-on" />
            </span>
            <span className="web-preview__row">
              <span className="web-preview__row-text" />
              <span className="web-preview__toggle" />
            </span>
            <span className="web-preview__row">
              <span className="web-preview__row-text" />
              <span className="web-preview__toggle" />
            </span>
            <span className="web-preview__row">
              <span className="web-preview__row-text" />
              <span className="web-preview__toggle" />
            </span>

            <span className="web-preview__section-label web-preview__section-label--spaced" />
            <span className="web-preview__slider-block">
              <span className="web-preview__row-text" />
              <span className="web-preview__slider">
                <span className="web-preview__slider-track" />
                <span className="web-preview__slider-thumb" style={{ left: "50%" }} />
              </span>
            </span>
            <span className="web-preview__slider-block">
              <span className="web-preview__row-text" />
              <span className="web-preview__slider">
                <span className="web-preview__slider-track web-preview__slider-track--alt" />
                <span className="web-preview__slider-thumb" style={{ left: "53%" }} />
              </span>
            </span>
          </div>
        </aside>

        <div className="web-preview__canvas">
          <div className="web-preview__reactor">
            <span className="web-preview__pipe web-preview__pipe--l1" />
            <span className="web-preview__pipe web-preview__pipe--l2" />
            <span className="web-preview__pipe web-preview__pipe--l3" />
            <span className="web-preview__pipe web-preview__pipe--r1" />
            <span className="web-preview__tank">
              <span className="web-preview__liquid" />
              <span className="web-preview__agitator" />
              <span className="web-preview__paddle" />
              <span className="web-preview__probe" />
              <span className="web-preview__sparger" />
            </span>
            <span className="web-preview__anno web-preview__anno--a" />
            <span className="web-preview__anno web-preview__anno--b" />
            <span className="web-preview__anno web-preview__anno--c" />
            <span className="web-preview__anno web-preview__anno--d" />
          </div>
          <div className="web-preview__zoom">
            <span />
            <span />
          </div>
        </div>

        <aside className="web-preview__charts">
          <div className="web-preview__panel web-preview__panel--chart">
            <span className="web-preview__chart-head">
              <span className="web-preview__row-text" />
              <span className="web-preview__chart-value" />
            </span>
            <svg
              className="web-preview__spark"
              viewBox="0 0 120 48"
              preserveAspectRatio="none"
            >
              <path
                d="M0 30 C12 28, 18 18, 28 22 S48 36, 58 28 S78 10, 90 18 S110 34, 120 22"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              />
              <path
                d="M0 48 L0 30 C12 28, 18 18, 28 22 S48 36, 58 28 S78 10, 90 18 S110 34, 120 22 L120 48 Z"
                fill="currentColor"
                opacity="0.12"
              />
            </svg>
          </div>
          <div className="web-preview__panel web-preview__panel--chart">
            <span className="web-preview__chart-head">
              <span className="web-preview__row-text" />
              <span className="web-preview__chart-value" />
            </span>
            <svg
              className="web-preview__spark"
              viewBox="0 0 120 48"
              preserveAspectRatio="none"
            >
              <path
                d="M0 24 C14 20, 22 32, 34 28 S54 12, 66 20 S86 38, 98 26 S112 16, 120 22"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              />
              <path
                d="M0 48 L0 24 C14 20, 22 32, 34 28 S54 12, 66 20 S86 38, 98 26 S112 16, 120 22 L120 48 Z"
                fill="currentColor"
                opacity="0.12"
              />
            </svg>
          </div>
        </aside>
      </div>

      <footer className="web-preview__footer" aria-hidden="true">
        <span className="web-preview__footer-bar" />
        <span className="web-preview__footer-links">
          <span />
          <span />
        </span>
      </footer>
    </div>
  );
}

export default WebAppPreview;
