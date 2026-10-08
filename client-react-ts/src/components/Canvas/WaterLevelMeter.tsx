import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  fillUnitsToLiters,
  VESSEL_MAX_FILL_UNITS,
} from "../pressure-vessel/constants";

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

/** Continuous % for the bar (smooth while animating). */
function levelPercentContinuous(fillUnits: number): number {
  return Math.min(100, Math.max(0, (fillUnits / VESSEL_MAX_FILL_UNITS) * 100));
}

function formatLitersLabel(liters: number, locale: string): string {
  return liters.toLocaleString(locale, {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  });
}

function formatPercentLabel(percent: number): string {
  return `${percent.toFixed(1)}%`;
}

/**
 * Water-level controls: bar width is DOM-driven every frame.
 * Percent / liters use plain text — the odometer ghosted badly on large doses.
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
  const litersRef = useRef<HTMLSpanElement>(null);
  const getLiveRef = useRef(getLiveFillUnits);
  const fillUnitsPropRef = useRef(fillUnits);
  const capacityRef = useRef(capacityLiters);
  const localeRef = useRef(i18n.language || "en");
  const [displayUnits, setDisplayUnits] = useState(fillUnits);

  getLiveRef.current = getLiveFillUnits;
  fillUnitsPropRef.current = fillUnits;
  capacityRef.current = capacityLiters;
  localeRef.current = i18n.language || "en";

  const paint = (units: number) => {
    const capacity = capacityRef.current;
    const liters = fillUnitsToLiters(units, capacity);
    const pct =
      capacity > 0
        ? Math.round((liters / capacity) * 1000) / 10
        : levelPercentContinuous(units);
    const barPct = levelPercentContinuous(units);

    if (barRef.current) barRef.current.style.width = `${barPct}%`;
    if (meterRef.current) {
      meterRef.current.setAttribute("aria-valuenow", String(Math.round(pct)));
    }
    if (pctRef.current) pctRef.current.textContent = formatPercentLabel(pct);
    if (litersRef.current) {
      litersRef.current.textContent = formatLitersLabel(
        liters,
        localeRef.current,
      );
    }
  };

  useLayoutEffect(() => {
    paint(fillUnits);
  }, []);

  useEffect(() => {
    let frame = 0;
    let lastPublished = Number.NaN;

    const tick = () => {
      const units = getLiveRef.current?.() ?? fillUnitsPropRef.current;
      paint(units);
      if (
        Number.isNaN(lastPublished) ||
        Math.abs(units - lastPublished) >= 0.15
      ) {
        lastPublished = units;
        setDisplayUnits(units);
      }
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (busy) return;
    paint(fillUnits);
    setDisplayUnits(fillUnits);
  }, [fillUnits, busy, capacityLiters, i18n.language]);

  const currentLiters = fillUnitsToLiters(displayUnits, capacityLiters);
  const pctRounded =
    capacityLiters > 0
      ? Math.round((currentLiters / capacityLiters) * 1000) / 10
      : 0;
  const capacityLabel = Math.round(capacityLiters).toLocaleString(
    i18n.language || "en",
  );

  return (
    <div className="br-level">
      <div className="br-level__head">
        <h4 className="br-level__title">{t("process.waterLevel")}</h4>
        <span
          ref={pctRef}
          className="br-level__pct"
          aria-label={formatPercentLabel(pctRounded)}
        >
          {formatPercentLabel(pctRounded)}
        </span>
      </div>
      <div
        ref={meterRef}
        className={`br-level__meter${busy ? " is-busy" : ""}`}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pctRounded}
        aria-label={t("process.waterLevel")}
      >
        <div ref={barRef} className="br-level__meter-fill" />
      </div>
      <p className="br-level__volume" aria-live="polite">
        <span ref={litersRef} className="br-level__volume-current">
          {formatLitersLabel(currentLiters, i18n.language || "en")}
        </span>
        <span className="br-level__volume-rest">
          {` ${t("process.literUnit")} / ${capacityLabel} ${t("process.literUnit")}`}
        </span>
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
            max={capacityLiters}
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
