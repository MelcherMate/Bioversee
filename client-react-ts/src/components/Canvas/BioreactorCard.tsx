import { useEffect, useId, useRef, useState } from "react";
import { APPLE_DEPTH_COLORS } from "../pressure-vessel/apple-depth-style";
import { VESSEL_MAX_FILL_UNITS } from "../pressure-vessel/constants";
import { PIPE_FILL, PIPE_METAL, PIPE_OD } from "../pressure-vessel/pipe-style";
import { useSpringFillUnits } from "../pressure-vessel/useSpringFillUnits";
import { VesselWaterBody } from "../pressure-vessel/VesselWaterBody";
import "./Bioreactor.css";

export type JacketMode = "idle" | "warm" | "cold";
export type DoseMode = "idle" | "acid" | "base";

type BioreactorCardProps = {
  rotorVal?: number;
  aeratorVal?: number;
  waterLevelVal?: number;
  jacketMode?: JacketMode;
  doseMode?: DoseMode;
  translateX: number;
  translateY: number;
  scale: number;
  onMouseDown: (event: React.MouseEvent) => void;
};

const CARD_WIDTH = 800;
const CARD_HEIGHT = 750;

/** Same solid pipe-water stroke as pressure-vessel runs. */
const JACKET_WATER_WIDTH = PIPE_OD - 6;
/** Nominal centerline length for dash mapping (matches pathLength). */
const JACKET_FLOW_PATH_LENGTH = 1280;
/** Warm jacket water — previous red that read better than orange. */
const JACKET_WATER_WARM = "#e11d48";
const JACKET_WATER_COLD: string = APPLE_DEPTH_COLORS.cyan;
/** Left→right color sweep duration when switching warm ↔ cold. */
const JACKET_COLOR_BLEND_SECONDS = 7.5;

/**
 * Simple dashes traveling left→right along the jacket pipe.
 */
const JACKET_FLOW_DASH = 28;
const JACKET_FLOW_GAP = 72;
const JACKET_FLOW_CYCLE = JACKET_FLOW_DASH + JACKET_FLOW_GAP;
const JACKET_FLOW_CYCLE_SECONDS = 1.4;
/** Pipe fill/clear speed — 2× dash travel. */
const JACKET_PIPE_WATER_SPEED =
  (JACKET_FLOW_CYCLE / JACKET_FLOW_CYCLE_SECONDS) * 2;
const JACKET_FLOW_LINE_WIDTH = 2.5;

function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function lerpHex(from: string, to: string, t: number) {
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  const u = Math.min(1, Math.max(0, t));
  const r = Math.round(a.r + (b.r - a.r) * u);
  const g = Math.round(a.g + (b.g - a.g) * u);
  const bl = Math.round(a.b + (b.b - a.b) * u);
  return `#${[r, g, bl].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

/** Soft band width as a fraction of jacket width for the L→R color front. */
const JACKET_COLOR_SWEEP_BAND = 0.16;
/** Jacket SVG viewBox x-range (matches thermal-jacket__svg). */
const JACKET_GRAD_X0 = -130;
const JACKET_GRAD_X1 = 572;

type JacketWaterBlend = {
  fromColor: string;
  toColor: string;
  /** 0 → 1 left-to-right sweep; 1 means settled on toColor. */
  progress: number;
};

/**
 * First pump-on snaps to target color. Warm ↔ cold sweeps new color
 * left → right over 7.5s with a soft red↔blue fade at the front.
 */
function useJacketWaterBlend(mode: JacketMode): JacketWaterBlend {
  const [blend, setBlend] = useState<JacketWaterBlend>({
    fromColor: JACKET_WATER_COLD,
    toColor: JACKET_WATER_COLD,
    progress: 1,
  });
  const fromRef = useRef<string>(JACKET_WATER_COLD);
  const toRef = useRef<string>(JACKET_WATER_COLD);
  const progressRef = useRef(1);
  const prevActiveRef = useRef<"warm" | "cold" | null>(null);

  useEffect(() => {
    if (mode !== "warm" && mode !== "cold") return;

    const next = mode === "warm" ? JACKET_WATER_WARM : JACKET_WATER_COLD;
    const prev = prevActiveRef.current;
    prevActiveRef.current = mode;

    if (prev && prev !== mode) {
      const mid =
        progressRef.current < 1
          ? lerpHex(fromRef.current, toRef.current, progressRef.current)
          : toRef.current;
      fromRef.current = mid;
      toRef.current = next;
      progressRef.current = 0;
      setBlend({ fromColor: mid, toColor: next, progress: 0 });
      return;
    }

    if (!prev) {
      fromRef.current = next;
      toRef.current = next;
      progressRef.current = 1;
      setBlend({ fromColor: next, toColor: next, progress: 1 });
    }
  }, [mode]);

  useEffect(() => {
    let frame = 0;
    let lastTime = 0;

    const tick = (now: number) => {
      if (!lastTime) lastTime = now;
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      if (progressRef.current < 1) {
        progressRef.current = Math.min(
          1,
          progressRef.current + dt / JACKET_COLOR_BLEND_SECONDS,
        );
        setBlend({
          fromColor: fromRef.current,
          toColor: toRef.current,
          progress: progressRef.current,
        });
      }

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  return blend;
}

/** Chamber outer box (matches .reaction_chamber, border-box). */
const VESSEL = {
  left: 20,
  right: 422,
  top: -120,
  bottom: 430,
  radius: 169,
} as const;

/** Offset of jacket pipe centerline outside the vessel wall. */
const JACKET_THICK = 18;
/** Horizontal run height of inlet/outlet L (lower on the vessel). */
const JACKET_PIPE_Y = 120;

/**
 * Pressure-vessel-style pipe water: solid slug with head advancing on pump-on
 * and tail clearing on pump-off.
 */
function usePipeSlug(active: boolean, pathLength: number, speed: number) {
  const [tail, setTail] = useState(0);
  const [head, setHead] = useState(0);
  const phaseRef = useRef<"idle" | "advance" | "steady" | "retreat">("idle");
  const tailRef = useRef(0);
  const headRef = useRef(0);
  const activeRef = useRef(active);
  const pathLenRef = useRef(pathLength);
  const speedRef = useRef(speed);
  activeRef.current = active;
  pathLenRef.current = pathLength;
  speedRef.current = speed;

  useEffect(() => {
    let frame = 0;
    let lastTime = 0;

    const tick = (now: number) => {
      if (!lastTime) lastTime = now;
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      const on = activeRef.current;
      let phase = phaseRef.current;
      const pathEnd = pathLenRef.current;
      const spd = speedRef.current;

      if (phase === "idle" && on) {
        phase = "advance";
        tailRef.current = 0;
        headRef.current = 0;
      }

      switch (phase) {
        case "advance": {
          tailRef.current = 0;
          if (on) {
            headRef.current = Math.min(pathEnd, headRef.current + spd * dt);
            if (headRef.current >= pathEnd - 0.5) {
              headRef.current = pathEnd;
              phase = "steady";
            }
          } else {
            phase = "retreat";
          }
          break;
        }
        case "steady": {
          tailRef.current = 0;
          headRef.current = pathEnd;
          if (!on) phase = "retreat";
          break;
        }
        case "retreat": {
          headRef.current = pathEnd;
          if (on) {
            phase = "advance";
            break;
          }
          tailRef.current = Math.min(
            headRef.current,
            tailRef.current + spd * dt,
          );
          if (tailRef.current >= headRef.current - 0.5) {
            tailRef.current = 0;
            headRef.current = 0;
            phase = "idle";
          }
          break;
        }
        default:
          break;
      }

      phaseRef.current = phase;
      setTail(tailRef.current);
      setHead(headRef.current);
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  return { tail, head };
}

function jacketRadii() {
  const inner = {
    left: VESSEL.left,
    right: VESSEL.right,
    bottom: VESSEL.bottom,
    r: VESSEL.radius,
    leftCx: VESSEL.left + VESSEL.radius,
    rightCx: VESSEL.right - VESSEL.radius,
    cy: VESSEL.bottom - VESSEL.radius,
  };
  const outer = {
    left: VESSEL.left - JACKET_THICK,
    right: VESSEL.right + JACKET_THICK,
    bottom: VESSEL.bottom + JACKET_THICK,
    r: VESSEL.radius + JACKET_THICK,
    leftCx: inner.leftCx,
    rightCx: inner.rightCx,
    cy: inner.cy,
  };
  return { inner, outer };
}

/**
 * One seamless centerline: left inlet L → jacket U → right outlet L.
 * Same white-gray pipe language as base/acid and pressure-vessel runs.
 */
function buildJacketPipePath(): string {
  const { inner, outer } = jacketRadii();
  const midLeft = (inner.left + outer.left) / 2;
  const midRight = (inner.right + outer.right) / 2;
  const midR = (inner.r + outer.r) / 2;
  const midBottom = (inner.bottom + outer.bottom) / 2;
  const leftCx = inner.leftCx;
  const rightCx = inner.rightCx;
  const pipeY = JACKET_PIPE_Y;

  return [
    `M -110 ${pipeY}`,
    `L ${midLeft} ${pipeY}`,
    `L ${midLeft} ${inner.cy}`,
    `A ${midR} ${midR} 0 0 0 ${leftCx} ${midBottom}`,
    `L ${rightCx} ${midBottom}`,
    `A ${midR} ${midR} 0 0 0 ${midRight} ${inner.cy}`,
    `L ${midRight} ${pipeY}`,
    `L 552 ${pipeY}`,
  ].join(" ");
}

type ThermalJacketProps = {
  mode: JacketMode;
};

function ThermalJacket({ mode }: ThermalJacketProps) {
  const prefix = useId().replace(/:/g, "");
  const active = mode !== "idle";
  const { fromColor, toColor, progress } = useJacketWaterBlend(mode);
  const modeClass =
    mode === "warm"
      ? "thermal-jacket--warm"
      : mode === "cold"
        ? "thermal-jacket--cold"
        : "thermal-jacket--idle";

  const pipePath = buildJacketPipePath();
  const { tail, head } = usePipeSlug(
    active,
    JACKET_FLOW_PATH_LENGTH,
    JACKET_PIPE_WATER_SPEED,
  );
  const segStart = Math.max(0, tail);
  const segEnd = Math.max(segStart, head);
  const segLen = Math.max(
    0,
    Math.min(segEnd, JACKET_FLOW_PATH_LENGTH) - segStart,
  );

  const sweeping = progress < 1 && fromColor !== toColor;
  const settledColor = progress >= 1 ? toColor : fromColor;
  const waterStroke = sweeping ? `url(#${prefix}-color-sweep)` : settledColor;

  // Soft L→R front: new color on the left, old on the right.
  const softStart = Math.max(0, progress - JACKET_COLOR_SWEEP_BAND / 2);
  const softEnd = Math.min(1, progress + JACKET_COLOR_SWEEP_BAND / 2);

  return (
    <div className={`thermal-jacket ${modeClass}`}>
      <svg
        className="thermal-jacket__svg"
        viewBox="-130 -140 702 620"
        aria-hidden
      >
        <defs>
          <filter
            id={`${prefix}-metal`}
            x="-30%"
            y="-30%"
            width="160%"
            height="160%"
          >
            <feDropShadow
              dx="1"
              dy="2"
              stdDeviation="1.2"
              floodColor="#000"
              floodOpacity="0.18"
            />
          </filter>
          {sweeping ? (
            <linearGradient
              id={`${prefix}-color-sweep`}
              gradientUnits="userSpaceOnUse"
              x1={JACKET_GRAD_X0}
              y1={0}
              x2={JACKET_GRAD_X1}
              y2={0}
            >
              <stop offset={0} stopColor={toColor} />
              <stop offset={softStart} stopColor={toColor} />
              <stop offset={softEnd} stopColor={fromColor} />
              <stop offset={1} stopColor={fromColor} />
            </linearGradient>
          ) : null}
        </defs>

        {/* Single continuous white-gray pipe (inlet + jacket + outlet) */}
        <g filter={`url(#${prefix}-metal)`}>
          <path
            d={pipePath}
            fill="none"
            stroke={PIPE_METAL.stroke}
            strokeWidth={PIPE_OD + 3}
            strokeLinecap="butt"
            strokeLinejoin="round"
          />
          <path
            d={pipePath}
            fill="none"
            stroke={PIPE_FILL}
            strokeWidth={PIPE_OD}
            strokeLinecap="butt"
            strokeLinejoin="round"
          />
        </g>

        {/* Solid water slug + moving flow lines (masked to the water body) */}
        {segLen > 0 ? (
          <g>
            <defs>
              <mask
                id={`${prefix}-water-mask`}
                maskUnits="userSpaceOnUse"
                x="-130"
                y="-140"
                width="702"
                height="620"
              >
                <path
                  d={pipePath}
                  pathLength={JACKET_FLOW_PATH_LENGTH}
                  fill="none"
                  stroke="#fff"
                  strokeWidth={JACKET_WATER_WIDTH + 2}
                  strokeLinecap="butt"
                  strokeLinejoin="round"
                  strokeDasharray={`${segLen} ${JACKET_FLOW_PATH_LENGTH}`}
                  strokeDashoffset={-segStart}
                />
              </mask>
            </defs>
            <path
              d={pipePath}
              pathLength={JACKET_FLOW_PATH_LENGTH}
              fill="none"
              stroke={waterStroke}
              strokeWidth={JACKET_WATER_WIDTH}
              strokeLinecap="butt"
              strokeLinejoin="round"
              strokeDasharray={`${segLen} ${JACKET_FLOW_PATH_LENGTH}`}
              strokeDashoffset={-segStart}
            />
            <path
              className="thermal-jacket__flow-dash"
              d={pipePath}
              pathLength={JACKET_FLOW_PATH_LENGTH}
              fill="none"
              stroke="rgba(255, 255, 255, 0.55)"
              strokeWidth={JACKET_FLOW_LINE_WIDTH}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={`${JACKET_FLOW_DASH} ${JACKET_FLOW_GAP}`}
              mask={`url(#${prefix}-water-mask)`}
            />
          </g>
        ) : null}
      </svg>
    </div>
  );
}

/** Litmus-style acid (red) / base (blue) dosing colors. */
const DOSE_ACID = "#e11d48";
const DOSE_BASE = "#2563eb";
/** Tip past the vessel wall into the headspace (SVG y; outer rim ≈ 43). */
const DOSE_TIP_Y = 88;
const DOSE_PATH = `M 16 16 L 264 16 L 264 ${DOSE_TIP_Y}`;
const DOSE_PATH_LENGTH = 300;
const DOSE_TUBE_OD = 4;
const DOSE_WATER_WIDTH = 2.5;
const DOSE_FLOW_DASH = 10;
const DOSE_FLOW_GAP = 22;
const DOSE_FLOW_CYCLE = DOSE_FLOW_DASH + DOSE_FLOW_GAP;
const DOSE_FLOW_CYCLE_SECONDS = 0.9;
const DOSE_PIPE_SPEED =
  (DOSE_FLOW_CYCLE / DOSE_FLOW_CYCLE_SECONDS) * 2;

type BaseAcidSupplyPipeProps = {
  mode: DoseMode;
};

function BaseAcidSupplyPipe({ mode }: BaseAcidSupplyPipeProps) {
  const prefix = useId().replace(/:/g, "");
  const active = mode !== "idle";
  const colorRef = useRef(DOSE_ACID);
  if (mode === "acid") colorRef.current = DOSE_ACID;
  if (mode === "base") colorRef.current = DOSE_BASE;
  const liquidColor = colorRef.current;
  const { tail, head } = usePipeSlug(active, DOSE_PATH_LENGTH, DOSE_PIPE_SPEED);
  const segStart = Math.max(0, tail);
  const segEnd = Math.max(segStart, head);
  const segLen = Math.max(0, Math.min(segEnd, DOSE_PATH_LENGTH) - segStart);
  const showLiquid = segLen > 0;

  return (
    <div className="base-acid-supply">
      <svg
        className="base-acid-pipe-run"
        viewBox="0 0 280 140"
        aria-hidden
        overflow="visible"
      >
        <defs>
          <linearGradient
            id={`${prefix}-plastic`}
            gradientUnits="userSpaceOnUse"
            x1="0"
            y1="0"
            x2="0"
            y2="140"
          >
            <stop offset="0%" stopColor="#f8fafc" />
            <stop offset="45%" stopColor="#e2e8f0" />
            <stop offset="100%" stopColor="#cbd5e1" />
          </linearGradient>
          {showLiquid ? (
            <mask
              id={`${prefix}-dose-mask`}
              maskUnits="userSpaceOnUse"
              x="0"
              y="0"
              width="280"
              height="140"
            >
              <path
                d={DOSE_PATH}
                pathLength={DOSE_PATH_LENGTH}
                fill="none"
                stroke="#fff"
                strokeWidth={DOSE_WATER_WIDTH + 1}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={`${segLen} ${DOSE_PATH_LENGTH}`}
                strokeDashoffset={-segStart}
              />
            </mask>
          ) : null}
        </defs>

        <path
          d={DOSE_PATH}
          fill="none"
          stroke="#94a3b8"
          strokeWidth={DOSE_TUBE_OD + 1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.55}
        />
        <path
          d={DOSE_PATH}
          fill="none"
          stroke={`url(#${prefix}-plastic)`}
          strokeWidth={DOSE_TUBE_OD}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {showLiquid ? (
          <g>
            <path
              d={DOSE_PATH}
              pathLength={DOSE_PATH_LENGTH}
              fill="none"
              stroke={liquidColor}
              strokeWidth={DOSE_WATER_WIDTH}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={`${segLen} ${DOSE_PATH_LENGTH}`}
              strokeDashoffset={-segStart}
            />
            <path
              className="base-acid-flow-dash"
              d={DOSE_PATH}
              pathLength={DOSE_PATH_LENGTH}
              fill="none"
              stroke="rgba(255, 255, 255, 0.65)"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={`${DOSE_FLOW_DASH} ${DOSE_FLOW_GAP}`}
              mask={`url(#${prefix}-dose-mask)`}
            />
          </g>
        ) : null}

        {active && showLiquid && head >= DOSE_PATH_LENGTH - 1 ? (
          <g className="base-acid-drips">
            {[0, 1, 2].map((i) => (
              <circle
                key={i}
                className="base-acid-drip"
                cx={264}
                cy={DOSE_TIP_Y}
                r={2.1}
                fill={liquidColor}
                style={{ animationDelay: `${i * 0.4}s` }}
              />
            ))}
          </g>
        ) : null}
      </svg>
    </div>
  );
}

function BioreactorCard(props: BioreactorCardProps) {
  const SLOWEST_ROTOR_SPEED = 4;
  const FASTEST_ROTOR_SPEED = 0.5;
  const rotorVal = props.rotorVal ?? 0;
  const aeratorVal = props.aeratorVal ?? 0;
  const jacketMode = props.jacketMode ?? "idle";
  const doseMode = props.doseMode ?? "idle";
  const waterLevelVal = Math.min(100, Math.max(0, props.waterLevelVal ?? 92));
  const targetFillUnits = (waterLevelVal / 100) * VESSEL_MAX_FILL_UNITS;

  const [rotorSpeed, setRotorSpeed] = useState(0);
  const { displayFillUnits, fillVelocity: levelVelocity } = useSpringFillUnits(
    targetFillUnits,
    { stiffness: 120, damping: 0.68 }
  );

  useEffect(() => {
    if (rotorVal == 100) {
      setRotorSpeed(0.5);
    } else if (rotorVal == 0) {
      setRotorSpeed(0);
    } else {
      setRotorSpeed(
        SLOWEST_ROTOR_SPEED -
          ((SLOWEST_ROTOR_SPEED - FASTEST_ROTOR_SPEED) / 99) * (rotorVal - 1)
      );
    }
  }, [rotorVal]);

  const waveVelocity =
    levelVelocity + (aeratorVal / 100) * 28 + (rotorVal / 100) * 20;

  return (
    <div
      style={{
        position: "absolute",
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        transform: `translate(${props.translateX}px, ${props.translateY}px) scale(${props.scale})`,
        userSelect: "none",
      }}
      onMouseDown={(event) => {
        props.onMouseDown(event);
      }}
    >
      <div className="wrapper">
        <ThermalJacket mode={jacketMode} />

        <div className="reaction_chamber" />

        <div className="agitator">
          <div className="agitator_stem" />
          <div
            className="agitator_blade0"
            style={{
              transform: "rotateY(0deg)",
              animation: `rotateProp0 ${rotorSpeed}s infinite`,
              animationTimingFunction: "linear",
            }}
          />
          <div className="agitator_stem2" />
          <div
            className="agitator_blade90"
            style={{
              transform: "rotateY(90deg)",
              animation: `rotateProp90 ${rotorSpeed}s infinite`,
              animationTimingFunction: "linear",
            }}
          />
        </div>

        <div className="br-water-clip">
          <VesselWaterBody
            fillUnits={displayFillUnits}
            fillVelocity={waveVelocity}
            showSurface={displayFillUnits / VESSEL_MAX_FILL_UNITS < 0.98}
          />
        </div>

        <div className="sensor sensor1">
          <div className="sensor_base" />
          <div className="sensor_stem" />
          <div className="sensor_head" />
        </div>
        <div className="sensor sensor2">
          <div className="sensor_base" />
          <div className="sensor_stem" />
          <div className="sensor_head" />
        </div>

        <BaseAcidSupplyPipe mode={doseMode} />

        <div className="aerator_submerged" />
        <div className="aerator_supply_pipe_h" />
        <div className="aerator_supply_pipe_v" />
      </div>
    </div>
  );
}

BioreactorCard.displayName = "BioreactorCard";
export default BioreactorCard;

export { CARD_WIDTH, CARD_HEIGHT };
