import { useEffect, useMemo, useRef, useState } from "react";
import "./AnimatedNumber.css";

type AnimatedNumberProps = {
  value: number;
  /** Digits after the decimal point. Default 0. */
  decimals?: number;
  /** Static text after the animated digits, e.g. `%`. */
  suffix?: string;
  /** Static text before the animated digits. */
  prefix?: string;
  className?: string;
  /** Accessible name; falls back to the formatted value. */
  "aria-label"?: string;
};

/**
 * Design-language rolling number — each digit scrolls vertically
 * with a soft top/bottom fade (odometer style).
 */
function AnimatedNumber({
  value,
  decimals = 0,
  suffix = "",
  prefix = "",
  className = "",
  "aria-label": ariaLabel,
}: AnimatedNumberProps) {
  const safeValue = Number.isFinite(value) ? value : 0;
  const formatted = formatNumber(safeValue, decimals);
  const chars = useMemo(() => [...formatted], [formatted]);

  const prevValueRef = useRef(safeValue);
  const [direction, setDirection] = useState<1 | -1>(1);

  useEffect(() => {
    if (safeValue > prevValueRef.current) setDirection(1);
    else if (safeValue < prevValueRef.current) setDirection(-1);
    prevValueRef.current = safeValue;
  }, [safeValue]);

  const label = ariaLabel ?? `${prefix}${formatted}${suffix}`;

  return (
    <span
      className={`bv-num${className ? ` ${className}` : ""}`}
      aria-label={label}
      data-direction={direction > 0 ? "up" : "down"}
    >
      <span className="bv-num__visual" aria-hidden="true">
        {prefix && <span className="bv-num__static">{prefix}</span>}
        {chars.map((char, index) =>
          isDigit(char) ? (
            <DigitColumn key={`d-${index}-${chars.length}`} digit={Number(char)} />
          ) : (
            <span key={`s-${index}-${char}`} className="bv-num__static">
              {char}
            </span>
          ),
        )}
        {suffix && <span className="bv-num__static bv-num__suffix">{suffix}</span>}
      </span>
    </span>
  );
}

function DigitColumn({ digit }: { digit: number }) {
  return (
    <span className="bv-num__digit">
      <span
        className="bv-num__reel"
        style={{ transform: `translate3d(0, ${-digit * 10}%, 0)` }}
      >
        {DIGITS.map((n) => (
          <span key={n} className="bv-num__glyph">
            {n}
          </span>
        ))}
      </span>
    </span>
  );
}

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

function isDigit(char: string) {
  return char >= "0" && char <= "9";
}

function formatNumber(value: number, decimals: number) {
  const fixed = Math.abs(value).toFixed(Math.max(0, decimals));
  const sign = value < 0 ? "-" : "";
  return `${sign}${fixed}`;
}

export default AnimatedNumber;
