import { VESSEL_MAX_FILL_UNITS } from "./constants";
import { WaterSurfaceWave } from "./WaterSurfaceWave";
import type { CSSProperties } from "react";
import "./vessel-water.css";

type BubbleSpec = {
  left: string;
  bottom: string;
  size: number;
  delay: number;
  duration: number;
  phase: number;
};

type VesselWaterBodyProps = {
  fillUnits: number;
  fillVelocity: number;
  /** When false, omit the surface wave (e.g. bioreactor at 100% so it cannot sit above the lid). */
  showSurface?: boolean;
  /**
   * Number of rising bubbles. Omit for the default decorative set (pressure vessel).
   * Pass 0 to hide bubbles (aerator off).
   */
  bubbleCount?: number;
  /** 0–1 horizontal swirl amount (driven by agitator speed). */
  bubbleSwirl?: number;
};

const DEFAULT_BUBBLES: BubbleSpec[] = [
  { left: "22%", bottom: "12%", size: 6, delay: 0.8, duration: 3.8, phase: 0 },
  { left: "48%", bottom: "22%", size: 4, delay: 2.1, duration: 4.2, phase: 1 },
  { left: "71%", bottom: "16%", size: 5, delay: 0.2, duration: 3.4, phase: 2 },
  { left: "36%", bottom: "8%", size: 3, delay: 3.3, duration: 4.6, phase: 3 },
  { left: "58%", bottom: "10%", size: 4, delay: 1.4, duration: 3.6, phase: 4 },
  { left: "34%", bottom: "6%", size: 4, delay: 0.6, duration: 3.0, phase: 5 },
  { left: "68%", bottom: "9%", size: 5, delay: 2.4, duration: 3.5, phase: 6 },
];

function bubblesForCount(count: number): BubbleSpec[] {
  if (count <= 0) return [];

  return Array.from({ length: count }, (_, index) => {
    const t = count <= 1 ? 0.5 : index / (count - 1);
    // Keep origins near the bottom (sparger band).
    const bottom = 2 + (index % 5) * 1.4;
    const size = 3 + (index % 4);
    const delay = Number(((index * 0.37) % 2.8).toFixed(2));
    const duration = Number((2.9 + ((index * 0.19) % 1.4)).toFixed(2));

    return {
      left: `${(8 + t * 84).toFixed(2)}%`,
      bottom: `${bottom.toFixed(1)}%`,
      size,
      delay,
      duration,
      phase: index % 6,
    };
  });
}

export function VesselWaterBody({
  fillUnits,
  fillVelocity,
  showSurface = true,
  bubbleCount,
  bubbleSwirl = 0,
}: VesselWaterBodyProps) {
  const fillRatio = Math.min(1, Math.max(0, fillUnits / VESSEL_MAX_FILL_UNITS));

  // Hide residual spring/wave puddles; surface wave alone is ~40px tall.
  if (fillRatio < 0.005) return null;

  const bubbles =
    bubbleCount === undefined ? DEFAULT_BUBBLES : bubblesForCount(bubbleCount);
  const swirlPx = Math.max(0, Math.min(1, bubbleSwirl)) * 36;

  return (
    <div className="vessel-water-mask">
      <div className="vessel-water" style={{ height: `${fillRatio * 100}%` }}>
        <div className="water-texture" />
        {showSurface ? (
          <WaterSurfaceWave className="water-surface" fillVelocity={fillVelocity} />
        ) : null}
        {bubbles.length > 0 ? (
          <div
            className="bubble-field"
            style={
              {
                ["--bubble-swirl" as string]: `${swirlPx}px`,
              } as CSSProperties
            }
            aria-hidden
          >
            {bubbles.map((bubble, index) => (
              <div
                key={`${bubble.left}-${index}`}
                className={`bubble bubble-phase-${bubble.phase}`}
                style={{
                  left: bubble.left,
                  bottom: bubble.bottom,
                  width: bubble.size,
                  height: bubble.size,
                  animationDelay: `${bubble.delay}s`,
                  animationDuration: `${bubble.duration}s`,
                  ["--bubble-bottom" as string]: bubble.bottom,
                }}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
