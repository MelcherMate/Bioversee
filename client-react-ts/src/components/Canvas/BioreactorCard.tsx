import { useEffect, useId, useRef, useState, memo, type CSSProperties } from "react";
import { APPLE_DEPTH_COLORS } from "../pressure-vessel/apple-depth-style";
import { VESSEL_MAX_FILL_UNITS } from "../pressure-vessel/constants";
import { PIPE_FILL, PIPE_METAL, PIPE_OD } from "../pressure-vessel/pipe-style";
import { useSpringFillUnits } from "../pressure-vessel/useSpringFillUnits";
import { VesselWaterBody } from "../pressure-vessel/VesselWaterBody";
import { StirredBubbleField } from "./StirredBubbleField";
import "./Bioreactor.css";

export type JacketMode = "idle" | "warm" | "cold";
export type DoseMode = "idle" | "acid" | "base";

/** Bioreactor impeller speed range (matches web + iOS controls). */
export const ROTOR_MAX_RPM = 300;

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
const DOSE_PIPE_SPEED = (DOSE_FLOW_CYCLE / DOSE_FLOW_CYCLE_SECONDS) * 2;
/** Matches .base-acid-pipe-run { top }. */
const DOSE_SVG_TOP = -163;
/** Matches .br-water-clip { top, height }. */
const WATER_CLIP_TOP = -100;
const WATER_CLIP_HEIGHT = 510;
/** Drop fall speed — fixed so drips never speed up/slow down with level. */
const DOSE_DRIP_SPEED = 320;
/**
 * Fixed vertical travel for the drip cycle (covers empty→surface).
 * Water level only clips visibility; speed and spacing stay constant.
 */
const DOSE_DRIP_TRAVEL = 480;
const DOSE_DRIP_DURATION = DOSE_DRIP_TRAVEL / DOSE_DRIP_SPEED;
/** Stagger between drips — keeps spacing constant at DOSE_DRIP_SPEED. */
const DOSE_DRIP_STAGGER = 0.4;
const DOSE_DRIP_COUNT = 3;

type BaseAcidSupplyPipeProps = {
  mode: DoseMode;
  fillUnits: number;
};

function doseColor(mode: DoseMode) {
  if (mode === "acid") return DOSE_ACID;
  if (mode === "base") return DOSE_BASE;
  return null;
}

function doseDripFallPx(fillUnits: number) {
  const fillRatio = Math.min(1, Math.max(0, fillUnits / VESSEL_MAX_FILL_UNITS));
  const tipAbsY = DOSE_SVG_TOP + DOSE_TIP_Y;
  const surfaceAbsY = WATER_CLIP_TOP + WATER_CLIP_HEIGHT * (1 - fillRatio);
  return Math.max(0, surfaceAbsY - tipAbsY);
}

/**
 * Dose tube sequencer: on acid↔base switch, finish draining the current
 * fluid (and drips) before the new fluid starts filling.
 */
function BaseAcidSupplyPipe({ mode, fillUnits }: BaseAcidSupplyPipeProps) {
  const prefix = useId().replace(/:/g, "");
  const [liquidColor, setLiquidColor] = useState(DOSE_ACID);
  const [feeding, setFeeding] = useState(false);
  const liquidColorRef = useRef(liquidColor);
  const pendingRef = useRef<"acid" | "base" | "idle">("idle");
  const headAmtRef = useRef(0);
  const tailAmtRef = useRef(0);

  const { tail, head } = usePipeSlug(
    feeding,
    DOSE_PATH_LENGTH,
    DOSE_PIPE_SPEED,
  );
  headAmtRef.current = head;
  tailAmtRef.current = tail;
  liquidColorRef.current = liquidColor;

  useEffect(() => {
    const desiredColor = doseColor(mode);
    const empty = headAmtRef.current <= 0.5 && tailAmtRef.current <= 0.5;

    if (mode === "idle") {
      pendingRef.current = "idle";
      setFeeding(false);
      return;
    }

    if (desiredColor === liquidColorRef.current) {
      pendingRef.current = "idle";
      setFeeding(true);
      return;
    }

    // Different fluid requested — drain current first if anything remains.
    if (empty) {
      setLiquidColor(desiredColor!);
      liquidColorRef.current = desiredColor!;
      pendingRef.current = "idle";
      setFeeding(true);
    } else {
      pendingRef.current = mode;
      setFeeding(false);
    }
  }, [mode]);

  useEffect(() => {
    if (head > 0.5 || tail > 0.5) return;
    const pending = pendingRef.current;
    if (pending !== "acid" && pending !== "base") return;

    const next = doseColor(pending)!;
    setLiquidColor(next);
    liquidColorRef.current = next;
    pendingRef.current = "idle";
    if (mode === pending) setFeeding(true);
  }, [head, tail, mode]);

  const segStart = Math.max(0, tail);
  const segEnd = Math.max(segStart, head);
  const segLen = Math.max(0, Math.min(segEnd, DOSE_PATH_LENGTH) - segStart);
  const showLiquid = segLen > 0;
  const dripFallPx = doseDripFallPx(fillUnits);
  const showDrips =
    showLiquid && head >= DOSE_PATH_LENGTH - 1 && dripFallPx > 4;

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

        {showDrips ? (
          <g className="base-acid-drips">
            <defs>
              <clipPath id={`${prefix}-drip-clip`}>
                <rect
                  x={256}
                  y={DOSE_TIP_Y - 3}
                  width={16}
                  height={dripFallPx + 6}
                />
              </clipPath>
            </defs>
            <g clipPath={`url(#${prefix}-drip-clip)`}>
              <g transform={`translate(264 ${DOSE_TIP_Y})`}>
                {Array.from({ length: DOSE_DRIP_COUNT }, (_, i) => (
                  <circle
                    key={i}
                    className="base-acid-drip"
                    cx={0}
                    cy={0}
                    r={2.1}
                    fill={liquidColor}
                  >
                    <animate
                      attributeName="opacity"
                      values="0;1;1;0"
                      keyTimes="0;0.08;0.72;1"
                      dur={`${DOSE_DRIP_DURATION}s`}
                      begin={`${i * DOSE_DRIP_STAGGER}s`}
                      repeatCount="indefinite"
                    />
                    <animateTransform
                      attributeName="transform"
                      type="translate"
                      from="0 0"
                      to={`0 ${DOSE_DRIP_TRAVEL}`}
                      dur={`${DOSE_DRIP_DURATION}s`}
                      begin={`${i * DOSE_DRIP_STAGGER}s`}
                      repeatCount="indefinite"
                    />
                  </circle>
                ))}
              </g>
            </g>
          </g>
        ) : null}
      </svg>
    </div>
  );
}

/**
 * Sparger centered under the impeller; riser left of the blade sweep
 * (agitator left ≈ 124) and clear of the curved dish wall (~x 58 at sparger Y).
 */
const AERATOR_PIPE_OD = Math.round(PIPE_OD * 0.75); // ~25% thinner
const AERATOR_SPARGER_WIDTH = 200;
const AERATOR_SPARGER_LEFT = 221 - AERATOR_SPARGER_WIDTH / 2;
const AERATOR_SPARGER_HEIGHT = AERATOR_PIPE_OD;
/** Higher in the dish = more wall clearance at the elbow. */
const AERATOR_SPARGER_Y = 358;
const AERATOR_SPARGER_TOP = AERATOR_SPARGER_Y - AERATOR_SPARGER_HEIGHT / 2;
/** Between curved wall and blade sweep. */
const AERATOR_PIPE_DROP_X = 96;
/** Pipe runs into the coupling so the joint reads continuous. */
const AERATOR_PIPE_END_X = AERATOR_SPARGER_LEFT + 10;
const AERATOR_SUPPLY_PATH = [
  `M -100 -42`,
  `L ${AERATOR_PIPE_DROP_X} -42`,
  `L ${AERATOR_PIPE_DROP_X} ${AERATOR_SPARGER_Y}`,
  `L ${AERATOR_PIPE_END_X} ${AERATOR_SPARGER_Y}`,
].join(" ");
const AERATOR_SUPPLY_PATH_LENGTH = 640;
const AERATOR_FLOW_DASH = 12;
const AERATOR_FLOW_GAP = 24;
const AERATOR_AIR = "#f8fafc";
const AERATOR_AIR_DASH = "rgba(255, 255, 255, 0.92)";
const AERATOR_COUPLING_W = 16;

function aeratorDiffuserLevel(val: number) {
  if (val <= 0) return 0;
  if (val <= 25) return 25;
  if (val <= 50) return 50;
  if (val <= 75) return 75;
  return 100;
}

type AeratorSupplyProps = {
  aeratorVal: number;
};

function AeratorSupply({ aeratorVal }: AeratorSupplyProps) {
  const prefix = useId().replace(/:/g, "");
  const active = aeratorVal > 0;
  const level = aeratorDiffuserLevel(aeratorVal);
  const airWidth = Math.max(3, AERATOR_PIPE_OD - 5);
  const glow =
    level === 0
      ? 0
      : level === 25
        ? 0.25
        : level === 50
          ? 0.35
          : level === 75
            ? 0.45
            : 0.55;

  return (
    <div className="aerator-supply">
      <svg
        className="aerator-supply__pipe"
        viewBox="-110 -55 360 500"
        aria-hidden
        overflow="visible"
      >
        <defs>
          <filter
            id={`${prefix}-metal`}
            x="-20%"
            y="-20%"
            width="140%"
            height="140%"
          >
            <feDropShadow
              dx="1"
              dy="2"
              stdDeviation="1.2"
              floodColor="#000"
              floodOpacity="0.18"
            />
          </filter>
          <pattern
            id={`${prefix}-diffuser`}
            width="10"
            height={AERATOR_SPARGER_HEIGHT}
            patternUnits="userSpaceOnUse"
          >
            <rect
              width="4"
              height={AERATOR_SPARGER_HEIGHT}
              fill={PIPE_METAL.mid}
            />
            <rect
              x="4"
              width="6"
              height={AERATOR_SPARGER_HEIGHT}
              fill={PIPE_FILL}
            />
          </pattern>
        </defs>

        {/* Supply riser */}
        <g filter={`url(#${prefix}-metal)`}>
          <path
            d={AERATOR_SUPPLY_PATH}
            fill="none"
            stroke={PIPE_METAL.stroke}
            strokeWidth={AERATOR_PIPE_OD + 2}
            strokeLinecap="butt"
            strokeLinejoin="round"
          />
          <path
            d={AERATOR_SUPPLY_PATH}
            fill="none"
            stroke={PIPE_FILL}
            strokeWidth={AERATOR_PIPE_OD}
            strokeLinecap="butt"
            strokeLinejoin="round"
          />
        </g>

        {active ? (
          <g>
            <path
              d={AERATOR_SUPPLY_PATH}
              pathLength={AERATOR_SUPPLY_PATH_LENGTH}
              fill="none"
              stroke={AERATOR_AIR}
              strokeWidth={airWidth}
              strokeLinecap="butt"
              strokeLinejoin="round"
            />
            <path
              className="aerator-supply__flow-dash"
              d={AERATOR_SUPPLY_PATH}
              pathLength={AERATOR_SUPPLY_PATH_LENGTH}
              fill="none"
              stroke={AERATOR_AIR_DASH}
              strokeWidth={Math.max(2, airWidth - 2)}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={`${AERATOR_FLOW_DASH} ${AERATOR_FLOW_GAP}`}
            />
          </g>
        ) : null}

        {/* Sparger bar — same OD as pipe for a flush joint */}
        <g filter={`url(#${prefix}-metal)`}>
          <rect
            x={AERATOR_SPARGER_LEFT}
            y={AERATOR_SPARGER_TOP}
            width={AERATOR_SPARGER_WIDTH}
            height={AERATOR_SPARGER_HEIGHT}
            rx={3}
            fill={`url(#${prefix}-diffuser)`}
            stroke={PIPE_METAL.stroke}
            strokeWidth={1.5}
            style={
              active
                ? {
                    filter: `drop-shadow(0 0 ${4 + level / 20}px rgba(56, 189, 248, ${glow}))`,
                  }
                : undefined
            }
          />
          {/* Coupling sleeve: bridges pipe OD into the perforated bar */}
          <rect
            x={AERATOR_SPARGER_LEFT - 3}
            y={AERATOR_SPARGER_Y - (AERATOR_PIPE_OD + 2) / 2}
            width={AERATOR_COUPLING_W}
            height={AERATOR_PIPE_OD + 2}
            rx={2}
            fill={PIPE_FILL}
            stroke={PIPE_METAL.stroke}
            strokeWidth={1.5}
          />
        </g>
      </svg>
    </div>
  );
}

const IMPELLER_BLADES = 6;
const IMPELLER_CX = 100;
const IMPELLER_INNER_R = 24; // discRx(34) - 10
const IMPELLER_OUTER_R = 82;
const IMPELLER_BLADE_H = 50;
const IMPELLER_CY = 32;

type BladeLayout = { x: number; width: number; depth: number };

function layoutImpellerBlades(
  angleRad: number,
  phaseRad: number,
): BladeLayout[] {
  const blades: BladeLayout[] = [];
  for (let i = 0; i < IMPELLER_BLADES; i++) {
    const a = angleRad + phaseRad + (i * Math.PI * 2) / IMPELLER_BLADES;
    const cos = Math.cos(a);
    const span = Math.abs(cos) * (IMPELLER_OUTER_R - IMPELLER_INNER_R);
    const width = Math.max(8, span);
    const mid = IMPELLER_CX + cos * ((IMPELLER_INNER_R + IMPELLER_OUTER_R) / 2);
    blades.push({ x: mid - width / 2, width, depth: Math.sin(a) });
  }
  return blades;
}

/** Apply blade geometry to existing <rect> nodes without React re-render. */
function paintImpellerBlades(
  svg: SVGSVGElement | null,
  angleRad: number,
  phaseRad: number,
) {
  if (!svg) return;
  const blades = layoutImpellerBlades(angleRad, phaseRad).sort(
    (a, b) => a.depth - b.depth,
  );
  const rects = svg.querySelectorAll<SVGRectElement>("[data-blade]");
  for (let k = 0; k < blades.length; k++) {
    const rect = rects[k];
    if (!rect) continue;
    rect.setAttribute("x", String(blades[k].x));
    rect.setAttribute("width", String(blades[k].width));
  }
}

/**
 * Side-view Rushton: thin disc, rectangular blades standing on the rim.
 * Memoized + static JSX so parent slider re-renders never reset blade attrs.
 */
const ImpellerRotorSvg = memo(function ImpellerRotorSvg({
  phaseRad = 0,
}: {
  phaseRad?: number;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const initial = layoutImpellerBlades(0.35, phaseRad).sort(
    (a, b) => a.depth - b.depth,
  );

  return (
    <svg
      ref={svgRef}
      className="agitator__rotor"
      viewBox="0 0 200 64"
      width="190"
      height="64"
      aria-hidden
      data-impeller-rotor
      data-phase={phaseRad}
    >
      {initial.map((blade, i) => (
        <rect
          key={i}
          data-blade={i}
          x={blade.x}
          y={IMPELLER_CY - IMPELLER_BLADE_H / 2}
          width={blade.width}
          height={IMPELLER_BLADE_H}
          rx={1.5}
          fill="#2c2c2c"
          stroke="#0a0a0a"
          strokeWidth={1}
        />
      ))}
      <ellipse
        cx={IMPELLER_CX}
        cy={IMPELLER_CY}
        rx={34}
        ry={4.5}
        fill="#1c1c1c"
        stroke="#0a0a0a"
        strokeWidth={1}
      />
      <ellipse
        cx={IMPELLER_CX}
        cy={IMPELLER_CY - 1}
        rx={29}
        ry={1.6}
        fill="#3a3a3a"
        opacity={0.55}
      />
      <circle
        cx={IMPELLER_CX}
        cy={IMPELLER_CY}
        r={7}
        fill="#3a3a3a"
        stroke="#0a0a0a"
        strokeWidth={1}
      />
    </svg>
  );
});

/**
 * Owns the impeller rAF loop. Updates SVG attributes directly — no setState.
 */
function SpinningAgitator({
  rotorNorm,
  cavitationStrength,
}: {
  rotorNorm: number;
  cavitationStrength: number;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const angleRef = useRef(0.35);
  const speedRef = useRef(rotorNorm);
  speedRef.current = rotorNorm;

  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    const root = rootRef.current;
    const svgs = root
      ? Array.from(
          root.querySelectorAll<SVGSVGElement>("[data-impeller-rotor]"),
        )
      : [];

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const speed = speedRef.current;
      if (speed > 0) {
        angleRef.current += (0.7 + speed * 11) * dt;
        for (const svg of svgs) {
          const phase = Number(svg.dataset.phase || 0);
          paintImpellerBlades(svg, angleRef.current, phase);
        }
      }
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="agitator" aria-hidden ref={rootRef}>
      <div className="agitator__shaft" />
      <div className="agitator__stage agitator__stage--upper">
        <ImpellerRotorSvg />
      </div>
      <div className="agitator__stage agitator__stage--lower">
        <ImpellerRotorSvg phaseRad={Math.PI / IMPELLER_BLADES} />
      </div>
      {cavitationStrength > 0 ? (
        <>
          <div
            className="agitator__cavitation agitator__cavitation--upper is-on"
            style={
              {
                ["--cavitation-strength" as string]: String(
                  0.35 + cavitationStrength * 0.65,
                ),
              } as CSSProperties
            }
          />
          <div
            className="agitator__cavitation agitator__cavitation--lower is-on"
            style={
              {
                ["--cavitation-strength" as string]: String(
                  0.4 + cavitationStrength * 0.6,
                ),
              } as CSSProperties
            }
          />
        </>
      ) : null}
    </div>
  );
}

function BioreactorCard(props: BioreactorCardProps) {
  const rotorVal = props.rotorVal ?? 0;
  const rotorNorm = Math.min(1, Math.max(0, rotorVal / ROTOR_MAX_RPM));
  const aeratorVal = props.aeratorVal ?? 0;
  const jacketMode = props.jacketMode ?? "idle";
  const doseMode = props.doseMode ?? "idle";
  const waterLevelVal = Math.min(100, Math.max(0, props.waterLevelVal ?? 92));
  const targetFillUnits = (waterLevelVal / 100) * VESSEL_MAX_FILL_UNITS;

  const { displayFillUnits, fillVelocity: levelVelocity } = useSpringFillUnits(
    targetFillUnits,
    { stiffness: 120, damping: 0.68 },
  );

  const waveVelocity =
    levelVelocity + (aeratorVal / 100) * 28 + rotorNorm * 20;

  // Water clip is 510px tall; sparger sits ~52px above the dish floor.
  const fillRatio = Math.max(0.05, displayFillUnits / VESSEL_MAX_FILL_UNITS);
  const spargerSpawnBottomPct = Math.min(
    22,
    Math.max(9, (52 / (fillRatio * 510)) * 100),
  );
  const cavitationStrength =
    rotorNorm > 0.5 ? Math.min(1, (rotorNorm - 0.5) / 0.5) : 0;

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

        <SpinningAgitator
          rotorNorm={rotorNorm}
          cavitationStrength={cavitationStrength}
        />

        {/* Under the water layer so tips read as submerged */}
        <div className="sensor sensor1 sensor--temp" aria-hidden>
          <div className="sensor__port">
            <span className="sensor__lamp sensor__lamp--ok" />
          </div>
          <div className="sensor__collar" />
          <div className="sensor__shaft" />
          <div className="sensor__tip" />
        </div>
        <div className="sensor sensor2 sensor--ph" aria-hidden>
          <div className="sensor__port">
            <span className="sensor__lamp sensor__lamp--ok" />
          </div>
          <div className="sensor__collar" />
          <div className="sensor__shaft" />
          <div className="sensor__tip" />
        </div>

        <div className="br-water-clip">
          <VesselWaterBody
            fillUnits={displayFillUnits}
            fillVelocity={waveVelocity}
            showSurface={displayFillUnits / VESSEL_MAX_FILL_UNITS < 0.98}
            bubbleCount={0}
          />
          <StirredBubbleField
            aeratorVal={aeratorVal}
            rotorNorm={rotorNorm}
            fillRatio={Math.min(1, displayFillUnits / VESSEL_MAX_FILL_UNITS)}
            spawnBottomPct={spargerSpawnBottomPct}
            spawnLeftRange={[26, 74]}
          />
        </div>

        <BaseAcidSupplyPipe mode={doseMode} fillUnits={displayFillUnits} />

        <AeratorSupply aeratorVal={aeratorVal} />
      </div>
    </div>
  );
}

BioreactorCard.displayName = "BioreactorCard";
export default BioreactorCard;

export { CARD_HEIGHT, CARD_WIDTH };
