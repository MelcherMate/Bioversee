const SEGMENT_COUNT = 6;

/** Even swell weight across the tank (same amplitude at walls and center). */
export function segmentIntensity(
  _index: number,
  _total: number,
  multiplier: number,
): number {
  return multiplier;
}

function segmentDuration(index: number, layerSeed: number): number {
  return 0.3 + ((index * 47 + layerSeed * 13) % 300) / 1000;
}

function segmentPhase(index: number, layerSeed: number): number {
  return index * 1.23 + layerSeed * 2.7 + ((layerSeed * 17 + index * 31) % 100) / 50;
}

/**
 * Animated Y samples for cubic wave segments.
 * @see https://www.sinasamaki.com/made-in-compose-apple-watch-ultra-water-level-animation/
 */
export function calculateWaveSegmentYs(
  time: number,
  baselineY: number,
  intensityMultiplier: number,
  layerSeed: number,
  amplitude: number,
): number[] {
  const ys: number[] = [];

  for (let i = 0; i <= SEGMENT_COUNT; i++) {
    const intensity = segmentIntensity(i, SEGMENT_COUNT, intensityMultiplier);
    const duration = segmentDuration(i, layerSeed);
    const phase = segmentPhase(i, layerSeed);
    const noise =
      Math.sin((time / duration) * Math.PI * 2 + phase) * amplitude * intensity;
    ys.push(baselineY + noise);
  }

  return ys;
}

/** Closed path: cubic wave surface on top, filled straight down to the body below. */
export function buildWaveSurfacePath(
  width: number,
  height: number,
  edgeY: number,
  segmentYs: number[],
): string {
  if (segmentYs.length === 0) {
    return `M 0 ${height} L 0 ${edgeY} L ${width} ${edgeY} L ${width} ${height} Z`;
  }

  const n = segmentYs.length;
  let d = `M 0 ${height} L 0 ${segmentYs[0].toFixed(2)}`;

  for (let i = 1; i < n; i++) {
    const x = (width * i) / (n - 1);
    const y = segmentYs[i];
    const prevX = (width * (i - 1)) / (n - 1);
    const prevY = segmentYs[i - 1];
    const c1x = prevX + (x - prevX) / 3;
    const c2x = prevX + (2 * (x - prevX)) / 3;
    d += ` C ${c1x.toFixed(2)} ${prevY.toFixed(2)}, ${c2x.toFixed(2)} ${y.toFixed(2)}, ${x.toFixed(2)} ${y.toFixed(2)}`;
  }

  d += ` L ${width} ${height} Z`;
  return d;
}

export const WAVE_LAYERS = [
  { intensityMultiplier: 0.4, opacity: 1, layerSeed: 0 },
  { intensityMultiplier: 0.55, opacity: 0.45, layerSeed: 4 },
  { intensityMultiplier: 0.7, opacity: 0.25, layerSeed: 9 },
] as const;

export const WAVE_VIEW_HEIGHT = 40;
export const WAVE_SURFACE_Y = 16;
export const WAVE_IDLE_AMPLITUDE = 5;
export const WAVE_VELOCITY_SCALE = 40;
export const WAVE_SLOSH_LIFT = 6;
export const WAVE_SLOSH_STIFFNESS = 200;
export const WAVE_SLOSH_DAMPING = 0.65;

export function waveVelocityBoost(fillVelocity: number): number {
  return Math.min(1, fillVelocity / WAVE_VELOCITY_SCALE);
}

export function waveSloshTarget(fillVelocity: number): number {
  return WAVE_SURFACE_Y - waveVelocityBoost(fillVelocity) * WAVE_SLOSH_LIFT;
}

export function waveSloshRisePx(baselineY: number, containerHeightPx = WAVE_VIEW_HEIGHT): number {
  return ((WAVE_SURFACE_Y - baselineY) * containerHeightPx) / WAVE_VIEW_HEIGHT;
}

export function createSpringState(initial: number) {
  let value = initial;
  let velocity = 0;

  return {
    get value() {
      return value;
    },
    get velocity() {
      return velocity;
    },
    step(target: number, deltaSeconds: number, stiffness = 160, damping = 0.74) {
      const force = (target - value) * stiffness;
      velocity = (velocity + force * deltaSeconds) * damping;
      value += velocity * deltaSeconds;
      return value;
    },
    snap(next: number) {
      value = next;
      velocity = 0;
    },
  };
}
