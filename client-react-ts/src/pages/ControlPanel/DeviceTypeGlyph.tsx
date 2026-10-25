import type { DeviceType } from "../../lib/devices";

type DeviceTypeGlyphProps = {
  type: DeviceType;
  size?: number;
  className?: string;
};

/** Compact SVG mark per device type for cards and flow nodes. */
export default function DeviceTypeGlyph({
  type,
  size = 28,
  className,
}: DeviceTypeGlyphProps) {
  const stroke = "currentColor";
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 32 32",
    fill: "none",
    className,
    "aria-hidden": true as const,
  };

  switch (type) {
    case "bioreactor":
      return (
        <svg {...common}>
          <rect
            x="8"
            y="6"
            width="16"
            height="20"
            rx="6"
            stroke={stroke}
            strokeWidth="1.75"
          />
          <path
            d="M12 14c1.5 2 6.5 2 8 0M12 19c1.5 2 6.5 2 8 0"
            stroke={stroke}
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path d="M16 3v4" stroke={stroke} strokeWidth="1.75" strokeLinecap="round" />
        </svg>
      );
    case "pressure_vessel":
      return (
        <svg {...common}>
          <ellipse cx="16" cy="9" rx="8" ry="3.5" stroke={stroke} strokeWidth="1.75" />
          <path
            d="M8 9v12c0 2.5 3.6 4.5 8 4.5s8-2 8-4.5V9"
            stroke={stroke}
            strokeWidth="1.75"
          />
          <path d="M11 16h10" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "membrane_bioreactor":
      return (
        <svg {...common}>
          <rect
            x="5"
            y="8"
            width="22"
            height="16"
            rx="3"
            stroke={stroke}
            strokeWidth="1.75"
          />
          <path
            d="M11 8v16M16 8v16M21 8v16"
            stroke={stroke}
            strokeWidth="1.4"
            opacity="0.7"
          />
        </svg>
      );
    case "water_purifier":
    default:
      return (
        <svg {...common}>
          <path
            d="M16 5c0 0-7 8-7 13a7 7 0 0014 0c0-5-7-13-7-13z"
            stroke={stroke}
            strokeWidth="1.75"
            strokeLinejoin="round"
          />
          <path
            d="M13.5 18.5c.8 1.6 4.2 1.6 5 0"
            stroke={stroke}
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      );
  }
}
