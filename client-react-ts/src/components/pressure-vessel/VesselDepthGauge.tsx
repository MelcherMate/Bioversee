import {
  APPLE_DEPTH_COLORS,
  APPLE_TICK_COUNT,
  fillUnitsToDepthLabel,
} from "./apple-depth-style";
import { VESSEL_MAX_FILL_UNITS } from "./constants";

type VesselDepthGaugeProps = {
  fillUnits: number;
};

const VIEW_WIDTH = 296;
const VIEW_HEIGHT = 426;

export function VesselDepthGauge({ fillUnits }: VesselDepthGaugeProps) {
  const depthLabel = fillUnitsToDepthLabel(fillUnits);
  const gradientId = "depth-tick-gradient";

  return (
    <>
      <svg
        className="depth-gauge"
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        preserveAspectRatio="none"
        aria-hidden
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={APPLE_DEPTH_COLORS.cyan} />
            <stop offset="100%" stopColor={APPLE_DEPTH_COLORS.blue} />
          </linearGradient>
        </defs>

        {Array.from({ length: APPLE_TICK_COUNT }, (_, index) => {
          const y = (index / (APPLE_TICK_COUNT - 1)) * VIEW_HEIGHT;
          const isMajor = index % 10 === 0;
          const tickLength = isMajor ? 80 : 40;

          return (
            <g key={index}>
              <line
                x1={0}
                y1={y}
                x2={tickLength}
                y2={y}
                stroke={`url(#${gradientId})`}
                strokeWidth={isMajor ? 4 : 3}
                strokeLinecap="round"
              />
              <line
                x1={VIEW_WIDTH}
                y1={y}
                x2={VIEW_WIDTH - tickLength}
                y2={y}
                stroke={`url(#${gradientId})`}
                strokeWidth={isMajor ? 4 : 3}
                strokeLinecap="round"
              />
            </g>
          );
        })}

        <text
          className="depth-label"
          x={VIEW_WIDTH / 2}
          y={VIEW_HEIGHT / 2}
          textAnchor="middle"
          dominantBaseline="middle"
        >
          {depthLabel}
        </text>
      </svg>

      <style>{`
        .depth-gauge {
          position: absolute;
          inset: 2px;
          z-index: 3;
          pointer-events: none;
          /* CSS equivalent of Compose BlendMode.Xor for depth overlays. */
          mix-blend-mode: difference;
        }
        .depth-label {
          fill: ${APPLE_DEPTH_COLORS.cyan};
          font-size: 54px;
          font-weight: 700;
          font-family:
            system-ui,
            -apple-system,
            "SF Pro Display",
            sans-serif;
          letter-spacing: -0.03em;
        }
      `}</style>
    </>
  );
}
