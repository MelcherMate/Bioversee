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
          <span className="web-preview__brand-name">{t("common.brand")}</span>
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
            <span className="web-preview__switch-grid">
              <span className="web-preview__switch-card">
                <span className="web-preview__row-text" />
                <span className="web-preview__switch-foot">
                  <span className="web-preview__switch-status" />
                  <span className="web-preview__toggle" />
                </span>
              </span>
              <span className="web-preview__switch-card">
                <span className="web-preview__row-text" />
                <span className="web-preview__switch-foot">
                  <span className="web-preview__switch-status" />
                  <span className="web-preview__toggle" />
                </span>
              </span>
              <span className="web-preview__switch-card">
                <span className="web-preview__row-text" />
                <span className="web-preview__switch-foot">
                  <span className="web-preview__switch-status" />
                  <span className="web-preview__toggle" />
                </span>
              </span>
              <span className="web-preview__switch-card">
                <span className="web-preview__row-text" />
                <span className="web-preview__switch-foot">
                  <span className="web-preview__switch-status" />
                  <span className="web-preview__toggle" />
                </span>
              </span>
            </span>

            <span className="web-preview__section-label web-preview__section-label--spaced" />
            <span className="web-preview__knob-grid">
              <span className="web-preview__knob">
                <span className="web-preview__knob-meta" />
                <span className="web-preview__knob-value" />
                <span className="web-preview__knob-dial">
                  <svg viewBox="0 0 36 36" aria-hidden="true">
                    <circle
                      className="web-preview__knob-track"
                      cx="18"
                      cy="18"
                      r="14"
                      pathLength="100"
                    />
                    <circle
                      className="web-preview__knob-progress"
                      cx="18"
                      cy="18"
                      r="14"
                      pathLength="100"
                      strokeDasharray="25 100"
                    />
                  </svg>
                </span>
              </span>
              <span className="web-preview__knob">
                <span className="web-preview__knob-meta" />
                <span className="web-preview__knob-value" />
                <span className="web-preview__knob-dial">
                  <svg viewBox="0 0 36 36" aria-hidden="true">
                    <circle
                      className="web-preview__knob-track"
                      cx="18"
                      cy="18"
                      r="14"
                      pathLength="100"
                    />
                    <circle
                      className="web-preview__knob-progress"
                      cx="18"
                      cy="18"
                      r="14"
                      pathLength="100"
                      strokeDasharray="40 100"
                    />
                  </svg>
                </span>
              </span>
              <span className="web-preview__knob">
                <span className="web-preview__knob-meta" />
                <span className="web-preview__knob-value" />
                <span className="web-preview__knob-dial">
                  <svg viewBox="0 0 36 36" aria-hidden="true">
                    <circle
                      className="web-preview__knob-track"
                      cx="18"
                      cy="18"
                      r="14"
                      pathLength="100"
                    />
                    <circle
                      className="web-preview__knob-progress"
                      cx="18"
                      cy="18"
                      r="14"
                      pathLength="100"
                      strokeDasharray="8 100"
                    />
                  </svg>
                </span>
              </span>
            </span>
          </div>
        </aside>

        <div className="web-preview__canvas">
          <div className="web-preview__reactor">
            <span className="web-preview__tank">
              <span className="web-preview__liquid" />
              <span className="web-preview__agitator" />
              <span className="web-preview__paddle web-preview__paddle--top" />
              <span className="web-preview__paddle web-preview__paddle--bottom" />
              <span className="web-preview__probe web-preview__probe--a" />
              <span className="web-preview__probe web-preview__probe--b" />
              <span className="web-preview__pressure" />
            </span>
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
    </div>
  );
}

export default WebAppPreview;
