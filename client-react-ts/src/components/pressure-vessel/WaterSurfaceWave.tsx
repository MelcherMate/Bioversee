import { useEffect, useId, useRef } from "react";
import { APPLE_DEPTH_COLORS } from "./apple-depth-style";
import {
  buildWaveSurfacePath,
  calculateWaveSegmentYs,
  createSpringState,
  WAVE_IDLE_AMPLITUDE,
  WAVE_LAYERS,
  WAVE_SURFACE_Y,
  WAVE_VIEW_HEIGHT,
  waveSloshTarget,
  waveVelocityBoost,
} from "./wave-path";

const VIEW_WIDTH = 300;

type WaterSurfaceWaveProps = {
  phase?: number;
  fillVelocity?: number;
  /** When set, uses this baseline instead of an internal spring (keeps paired surfaces in sync). */
  baselineY?: number;
  className?: string;
  /** Placement when nested inside another SVG scene. */
  x?: number;
  y?: number;
  width?: number;
  height?: number;
};

export function WaterSurfaceWave({
  phase = 0,
  fillVelocity = 0,
  baselineY,
  className = "",
  x,
  y,
  width,
  height,
}: WaterSurfaceWaveProps) {
  const gradId = useId().replace(/:/g, "");
  const layerRefs = useRef<(SVGPathElement | null)[]>([]);
  const surfaceSpringRef = useRef(createSpringState(WAVE_SURFACE_Y));
  const velocityRef = useRef(fillVelocity);
  const baselineYRef = useRef(baselineY);

  useEffect(() => {
    velocityRef.current = fillVelocity;
  }, [fillVelocity]);

  useEffect(() => {
    baselineYRef.current = baselineY;
  }, [baselineY]);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const flat = `M 0 ${WAVE_VIEW_HEIGHT} L 0 ${WAVE_SURFACE_Y} L ${VIEW_WIDTH} ${WAVE_SURFACE_Y} L ${VIEW_WIDTH} ${WAVE_VIEW_HEIGHT} Z`;

    if (reducedMotion) {
      layerRefs.current.forEach((node) => node?.setAttribute("d", flat));
      return;
    }

    let frame = 0;
    let lastTime = 0;

    const tick = (now: number) => {
      if (!lastTime) lastTime = now;
      const deltaSeconds = Math.min(0.04, (now - lastTime) / 1000);
      lastTime = now;
      const t = now / 1000 + phase;

      const velocityBoost = waveVelocityBoost(velocityRef.current);
      const amplitude = WAVE_IDLE_AMPLITUDE + velocityBoost * 12;
      const baseline =
        baselineYRef.current ??
        surfaceSpringRef.current.step(
          waveSloshTarget(velocityRef.current),
          deltaSeconds,
          200,
          0.65,
        );

      WAVE_LAYERS.forEach((layer, index) => {
        const segmentYs = calculateWaveSegmentYs(
          t,
          baseline,
          layer.intensityMultiplier,
          layer.layerSeed,
          amplitude,
        );
        layerRefs.current[index]?.setAttribute(
          "d",
          buildWaveSurfacePath(VIEW_WIDTH, WAVE_VIEW_HEIGHT, baseline, segmentYs),
        );
      });

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [phase]);

  return (
    <svg
      className={className}
      x={x}
      y={y}
      width={width}
      height={height}
      viewBox={`0 0 ${VIEW_WIDTH} ${WAVE_VIEW_HEIGHT}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <linearGradient
          id={gradId}
          x1="0"
          y1="0"
          x2="0"
          y2={WAVE_VIEW_HEIGHT}
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor={APPLE_DEPTH_COLORS.cyan} stopOpacity="1" />
          <stop
            offset={`${(WAVE_SURFACE_Y / WAVE_VIEW_HEIGHT) * 100}%`}
            stopColor={APPLE_DEPTH_COLORS.cyan}
            stopOpacity="1"
          />
          <stop offset="100%" stopColor={APPLE_DEPTH_COLORS.cyan} stopOpacity="0" />
        </linearGradient>
      </defs>
      {WAVE_LAYERS.map((layer, index) => (
        <path
          key={layer.layerSeed}
          ref={(node) => {
            layerRefs.current[index] = node;
          }}
          fill={`url(#${gradId})`}
          opacity={layer.opacity}
        />
      ))}
    </svg>
  );
}
