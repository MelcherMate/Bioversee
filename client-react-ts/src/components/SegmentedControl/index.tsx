import type { CSSProperties, ReactNode } from "react";
import "./SegmentedControl.css";

export type SegmentOption<T extends string | number> = {
  value: T;
  label: ReactNode;
  ariaLabel?: string;
};

type SegmentedControlProps<T extends string | number> = {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  className?: string;
  /** Visual shape: pill (login) or rounded (intensity). */
  shape?: "pill" | "rounded";
  /** Active text uses accent teal when true. */
  accent?: boolean;
  "aria-label"?: string;
};

function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  disabled = false,
  className = "",
  shape = "rounded",
  accent = false,
  "aria-label": ariaLabel,
}: SegmentedControlProps<T>) {
  const index = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );

  return (
    <div
      className={[
        "bv-segment",
        shape === "pill" ? "bv-segment--pill" : "bv-segment--rounded",
        accent ? "bv-segment--accent" : "",
        disabled ? "bv-segment--disabled" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      role="tablist"
      aria-label={ariaLabel}
      style={
        {
          "--bv-segment-count": options.length,
          "--bv-segment-index": index,
        } as CSSProperties
      }
    >
      <span className="bv-segment__thumb" aria-hidden="true" />
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={option.ariaLabel}
            disabled={disabled}
            className={`bv-segment__btn${active ? " is-active" : ""}`}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export default SegmentedControl;
