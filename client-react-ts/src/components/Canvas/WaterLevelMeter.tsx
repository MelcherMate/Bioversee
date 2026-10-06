import { useEffect, useLayoutEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { VESSEL_MAX_FILL_UNITS } from "../pressure-vessel/constants";

type WaterLevelMeterProps = {
  /** Fallback when no animation getter is active. */
  fillUnits: number;
  /** Read authoritative fill from the running fill/drain loop. */
  getLiveFillUnits?: () => number;
  capacityLiters: number;
  busy?: boolean;
  transferAmountText: string;
  onTransferAmountChange: (value: string) => void;
  onFill: () => void;
  onDrain: () => void;
  fillDisabled?: boolean;
  drainDisabled?: boolean;
  fillActive?: boolean;
  drainActive?: boolean;
  readOnly?: boolean;
};

function litersFromFillUnits(fillUnits: number, capacityL: number): number {
  return (fillUnits / VESSEL_MAX_FILL_UNITS) * capacityL;
}

function formatLiters(value: number, locale: string): string {
  return value.toLocaleString(locale, {
    maximumFractionDigits: value >= 100 ? 0 : 1,
    minimumFractionDigits: 0,
  });
}

function formatLevelPercent(fillUnits: number, locale: string): string {
  const pct = (fillUnits / VESSEL_MAX_FILL_UNITS) * 100;
  return pct.toLocaleString(locale, {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  });
}

function applyMeter(
  units: number,
  capacityL: number,
  locale: string,
  volumeTemplate: string,
  bar: HTMLDivElement | null,
  pct: HTMLSpanElement | null,
  volume: HTMLParagraphElement | null,
  meter: HTMLDivElement | null,
) {
  const ratio = Math.min(100, Math.max(0, (units / VESSEL_MAX_FILL_UNITS) * 100));
  if (bar) bar.style.width = `${ratio}%`;
  if (meter) meter.setAttribute("aria-valuenow", String(Math.round(ratio)));
  if (pct) pct.textContent = `${formatLevelPercent(units, locale)}%`;
  if (volume) {
    const currentL = litersFromFillUnits(units, capacityL);
    volume.textContent = volumeTemplate
      .replace("{{current}}", formatLiters(currentL, locale))
      .replace("{{capacity}}", formatLiters(capacityL, locale));
  }
}

/**
 * Water-level controls with a meter driven every frame from the fill/drain
 * animation refs via direct DOM writes (no React width state / CSS transition).
 */
export function WaterLevelMeter({
  fillUnits,
  getLiveFillUnits,
  capacityLiters,
  busy = false,
  transferAmountText,
  onTransferAmountChange,
  onFill,
  onDrain,
  fillDisabled = false,
  drainDisabled = false,
  fillActive = false,
  drainActive = false,
  readOnly = false,
}: WaterLevelMeterProps) {
  const { t, i18n } = useTranslation();
  const meterRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const pctRef = useRef<HTMLSpanElement>(null);
  const volumeRef = useRef<HTMLParagraphElement>(null);
  const getLiveRef = useRef(getLiveFillUnits);
  const fillUnitsPropRef = useRef(fillUnits);
  const capacityRef = useRef(capacityLiters);
  const localeRef = useRef(i18n.language || "en");
  const volumeTemplateRef = useRef(t("process.volumeReadout"));

  getLiveRef.current = getLiveFillUnits;
  fillUnitsPropRef.current = fillUnits;
  capacityRef.current = capacityLiters;
  localeRef.current = i18n.language || "en";
  volumeTemplateRef.current = t("process.volumeReadout");

  const paint = () => {
    applyMeter(
      getLiveRef.current?.() ?? fillUnitsPropRef.current,
      capacityRef.current,
      localeRef.current,
      volumeTemplateRef.current,
      barRef.current,
      pctRef.current,
      volumeRef.current,
      meterRef.current,
    );
  };

  useLayoutEffect(() => {
    paint();
  }, []);

  useEffect(() => {
    let frame = 0;
    let lastUnits = Number.NaN;

    const tick = () => {
      const units = getLiveRef.current?.() ?? fillUnitsPropRef.current;
      if (Number.isNaN(lastUnits) || Math.abs(units - lastUnits) >= 0.02) {
        lastUnits = units;
        paint();
      }
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  // Sync when idle props change (hydration / external set) without waiting a frame.
  useEffect(() => {
    if (busy) return;
    paint();
  }, [fillUnits, capacityLiters, busy, i18n.language, t]);

  const initialPct = Math.min(
    100,
    Math.max(0, (fillUnits / VESSEL_MAX_FILL_UNITS) * 100),
  );

  return (
    <div className="br-level">
      <div className="br-level__head">
        <h4 className="br-level__title">{t("process.waterLevel")}</h4>
        <span className="br-level__pct" ref={pctRef}>
          {formatLevelPercent(fillUnits, i18n.language || "en")}%
        </span>
      </div>
      <div
        ref={meterRef}
        className={`br-level__meter${busy ? " is-busy" : ""}`}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(initialPct)}
        aria-label={t("process.waterLevel")}
      >
        <div ref={barRef} className="br-level__meter-fill" />
      </div>
      <p className="br-level__volume" ref={volumeRef} aria-live="polite">
        {t("process.volumeReadout", {
          current: formatLiters(
            litersFromFillUnits(fillUnits, capacityLiters),
            i18n.language || "en",
          ),
          capacity: formatLiters(capacityLiters, i18n.language || "en"),
        })}
      </p>
      <label className="br-level__dose" htmlFor="br-transfer-amount">
        <span className="br-level__dose-label">{t("process.transferAmount")}</span>
        <span className="br-level__field">
          <input
            id="br-transfer-amount"
            type="text"
            inputMode="decimal"
            className="br-level__input"
            value={transferAmountText}
            onChange={(event) => onTransferAmountChange(event.target.value)}
            placeholder="0"
            disabled={readOnly || busy}
            autoComplete="off"
          />
          <span className="br-level__unit" aria-hidden="true">
            L
          </span>
        </span>
      </label>
      <div className="br-level__actions">
        <button
          type="button"
          onClick={onFill}
          disabled={fillDisabled}
          aria-label={t("process.fill")}
          aria-pressed={fillActive}
          className={`br-level__btn br-level__btn--fill${fillActive ? " is-active" : ""}`}
        >
          {t("process.fill")}
        </button>
        <button
          type="button"
          onClick={onDrain}
          disabled={drainDisabled}
          aria-label={t("process.drain")}
          aria-pressed={drainActive}
          className={`br-level__btn br-level__btn--drain${drainActive ? " is-active" : ""}`}
        >
          {t("process.drain")}
        </button>
      </div>
    </div>
  );
}
