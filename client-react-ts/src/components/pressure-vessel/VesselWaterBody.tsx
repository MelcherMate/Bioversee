import { useEffect, useRef, useState, type CSSProperties } from "react";
import { VESSEL_MAX_FILL_UNITS } from "./constants";
import { WaterSurfaceWave } from "./WaterSurfaceWave";
import "./vessel-water.css";

type BubbleSpec = {
  id: number;
  left: string;
  bottom: string;
  size: number;
  duration: number;
  phase: number;
  lane: number;
};

type VesselWaterBodyProps = {
  fillUnits: number;
  fillVelocity: number;
  showSurface?: boolean;
  /**
   * Target steady-state bubble count for the sparger plume.
   * Omit for the default decorative looping set (pressure vessel).
   * Pass 0 to stop spawning — bubbles already rising still finish.
   */
  bubbleCount?: number;
  bubbleSwirl?: number;
  bubbleSpawnBottomPct?: number;
  bubbleSpawnLeftRange?: [number, number];
};

type DecorativeBubble = {
  left: string;
  bottom: string;
  size: number;
  delay: number;
  duration: number;
  phase: number;
  lane: number;
};

const DEFAULT_BUBBLES: DecorativeBubble[] = [
  { left: "22%", bottom: "12%", size: 6, delay: 0.8, duration: 3.8, phase: 0, lane: -1 },
  { left: "48%", bottom: "22%", size: 4, delay: 2.1, duration: 4.2, phase: 1, lane: -1 },
  { left: "71%", bottom: "16%", size: 5, delay: 0.2, duration: 3.4, phase: 2, lane: 1 },
  { left: "36%", bottom: "8%", size: 3, delay: 3.3, duration: 4.6, phase: 3, lane: -1 },
  { left: "58%", bottom: "10%", size: 4, delay: 1.4, duration: 3.6, phase: 4, lane: 1 },
  { left: "34%", bottom: "6%", size: 4, delay: 0.6, duration: 3.0, phase: 5, lane: -1 },
  { left: "68%", bottom: "9%", size: 5, delay: 2.4, duration: 3.5, phase: 0, lane: 1 },
];

const MEAN_BUBBLE_DURATION_S = 2.8;

function createSpargerBubble(
  id: number,
  swirl: number,
  spawnBottomPct: number,
  leftRange: [number, number],
): BubbleSpec {
  const speed = Math.max(0, Math.min(1, swirl));
  const durationScale = 1 - speed * 0.22;
  const [left0, left1] = leftRange;
  const span = Math.max(4, left1 - left0);
  const leftPct = left0 + Math.random() * span + (Math.random() - 0.5) * 2.2;
  const clampedLeft = Math.min(left1, Math.max(left0, leftPct));
  const bottom = spawnBottomPct + (Math.random() - 0.5) * 1.2;

  return {
    id,
    left: `${clampedLeft.toFixed(2)}%`,
    bottom: `${Math.max(0.5, bottom).toFixed(1)}%`,
    size: 2.2 + Math.random() * 2.8,
    duration: Math.max(1.8, (2.6 + Math.random() * 1.2) * durationScale),
    phase: id % 6,
    lane: clampedLeft < 50 ? -1 : 1,
  };
}

export function VesselWaterBody({
  fillUnits,
  fillVelocity,
  showSurface = true,
  bubbleCount,
  bubbleSwirl = 0,
  bubbleSpawnBottomPct,
  bubbleSpawnLeftRange,
}: VesselWaterBodyProps) {
  const fillRatio = Math.min(1, Math.max(0, fillUnits / VESSEL_MAX_FILL_UNITS));
  const liveMode = bubbleCount !== undefined;

  const [liveBubbles, setLiveBubbles] = useState<BubbleSpec[]>([]);
  const nextIdRef = useRef(1);
  const swirlRef = useRef(bubbleSwirl);
  const spawnBottomRef = useRef(bubbleSpawnBottomPct ?? 2);
  const leftRangeRef = useRef(bubbleSpawnLeftRange ?? ([24, 76] as [number, number]));

  swirlRef.current = bubbleSwirl;
  spawnBottomRef.current = bubbleSpawnBottomPct ?? 2;
  leftRangeRef.current = bubbleSpawnLeftRange ?? ([24, 76] as [number, number]);

  // Aerator % only changes how often we spawn. Never clears in-flight bubbles.
  useEffect(() => {
    if (!liveMode) return;

    const target = bubbleCount ?? 0;
    if (target <= 0) return;

    const spawnPerSec = target / MEAN_BUBBLE_DURATION_S;
    const intervalMs = Math.max(16, 1000 / spawnPerSec);
    const softCap = Math.max(24, Math.round(target * 1.4));

    const timer = window.setInterval(() => {
      setLiveBubbles((prev) => {
        if (prev.length >= softCap) return prev;
        const id = nextIdRef.current++;
        return [
          ...prev,
          createSpargerBubble(
            id,
            swirlRef.current,
            spawnBottomRef.current,
            leftRangeRef.current,
          ),
        ];
      });
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [liveMode, bubbleCount]);

  if (fillRatio < 0.005) return null;

  const swirl = Math.max(0, Math.min(1, bubbleSwirl));
  const swirlPx = swirl * 72;
  const bubbles = liveMode ? liveBubbles : DEFAULT_BUBBLES;

  const dismiss = (id: number) => {
    setLiveBubbles((prev) => prev.filter((b) => b.id !== id));
  };

  return (
    <div className="vessel-water-mask">
      <div className="vessel-water" style={{ height: `${fillRatio * 100}%` }}>
        <div className="water-texture" />
        {showSurface ? (
          <WaterSurfaceWave className="water-surface" fillVelocity={fillVelocity} />
        ) : null}
        {bubbles.length > 0 ? (
          <div
            className={`bubble-field${swirl > 0.05 ? " bubble-field--turbulent" : ""}`}
            style={
              {
                ["--bubble-swirl" as string]: `${swirlPx}px`,
                ["--bubble-turb" as string]: String(swirl),
              } as CSSProperties
            }
            aria-hidden
          >
            {liveMode
              ? liveBubbles.map((bubble) => (
                  <div
                    key={bubble.id}
                    className={`bubble bubble--once bubble-phase-${bubble.phase}`}
                    style={{
                      left: bubble.left,
                      bottom: bubble.bottom,
                      width: bubble.size,
                      height: bubble.size,
                      animationDuration: `${bubble.duration}s`,
                      ["--bubble-bottom" as string]: bubble.bottom,
                      ["--bubble-lane" as string]: String(bubble.lane),
                    }}
                    onAnimationEnd={() => dismiss(bubble.id)}
                  />
                ))
              : DEFAULT_BUBBLES.map((bubble, index) => (
                  <div
                    key={`deco-${index}`}
                    className={`bubble bubble-phase-${bubble.phase}`}
                    style={{
                      left: bubble.left,
                      bottom: bubble.bottom,
                      width: bubble.size,
                      height: bubble.size,
                      animationDelay: `${bubble.delay}s`,
                      animationDuration: `${bubble.duration}s`,
                      ["--bubble-bottom" as string]: bubble.bottom,
                      ["--bubble-lane" as string]: String(bubble.lane),
                    }}
                  />
                ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
