import { useEffect, useId, useMemo, useRef, useState, memo, type CSSProperties } from "react";
import { APPLE_DEPTH_COLORS } from "../pressure-vessel/apple-depth-style";
import { VESSEL_MAX_FILL_UNITS } from "../pressure-vessel/constants";
import { PIPE_FILL, PIPE_METAL, PIPE_OD } from "../pressure-vessel/pipe-style";
import { useSpringFillUnits } from "../pressure-vessel/useSpringFillUnits";
import type { InletFillVisualState } from "../pressure-vessel/useInletFillAnimation";
import type { DrainVisualState } from "../pressure-vessel/useDrainAnimation";
import { VesselWaterBody } from "../pressure-vessel/VesselWaterBody";
import type {
  BioreactorEquipment,
  BioreactorGeometry,
  FluidMotionFactors,
} from "../../lib/bioreactorGeometry";
import { defaultBioreactorGeometry, defaultEquipment } from "../../lib/bioreactorGeometry";
import {
  layoutFromGeometry,
  layoutCssVars,
  type BioreactorLayout,
} from "./bioreactorLayout";
import { StirredBubbleField } from "./StirredBubbleField";
import "./Bioreactor.css";

export type JacketMode = "idle" | "warm" | "cold";
export type DoseMode = "idle" | "acid" | "base";

/** Bioreactor impeller speed range (matches web + iOS controls). */
export const ROTOR_MAX_RPM = 300;

type BioreactorCardProps = {
  rotorVal?: number;
  aeratorVal?: number;
  /** Tank level in vessel fill units (same scale as pressure vessel). */
  fillUnits?: number;
  inletFill?: InletFillVisualState;
  drainAnim?: DrainVisualState;
  jacketMode?: JacketMode;
  doseMode?: DoseMode;
  /** Optional fittings; omitted keys default to enabled. */
  equipment?: Partial<BioreactorEquipment>;
  /** Wave + bubble motion scales vs water (from fluid config). */
  fluidMotion?: FluidMotionFactors;
  geometry?: BioreactorGeometry;
  translateX: number;
  translateY: number;
  scale: number;
  onMouseDown: (event: React.MouseEvent) => void;
};

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
const JACKET_FLOW_CYCLE_SECONDS = 0.7;
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

type VesselBox = BioreactorLayout["vessel"];

function jacketRadii(vessel: VesselBox, jacketThick: number) {
  const inner = {
    left: vessel.left,
    right: vessel.right,
    bottom: vessel.bottom,
    r: vessel.radius,
    leftCx: vessel.left + vessel.radius,
    rightCx: vessel.right - vessel.radius,
    cy: vessel.bottom - vessel.radius,
  };
  const outer = {
    left: vessel.left - jacketThick,
    right: vessel.right + jacketThick,
    bottom: vessel.bottom + jacketThick,
    r: vessel.radius + jacketThick,
    leftCx: inner.leftCx,
    rightCx: inner.rightCx,
    cy: inner.cy,
  };
  return { inner, outer };
}

/**
 * One seamless centerline: left inlet → jacket U → right outlet.
 */
function buildJacketPipePath(
  vessel: VesselBox,
  jacketThick: number,
  pipeY: number,
  pathEndX: number,
  pathStartX: number,
): string {
  const { inner, outer } = jacketRadii(vessel, jacketThick);
  const midLeft = (inner.left + outer.left) / 2;
  const midRight = (inner.right + outer.right) / 2;
  const midR = (inner.r + outer.r) / 2;
  const midBottom = (inner.bottom + outer.bottom) / 2;

  return [
    `M ${pathStartX} ${pipeY}`,
    `L ${midLeft} ${pipeY}`,
    `L ${midLeft} ${inner.cy}`,
    `A ${midR} ${midR} 0 0 0 ${inner.leftCx} ${midBottom}`,
    `L ${inner.rightCx} ${midBottom}`,
    `A ${midR} ${midR} 0 0 0 ${midRight} ${inner.cy}`,
    `L ${midRight} ${pipeY}`,
    `L ${pathEndX} ${pipeY}`,
  ].join(" ");
}

/**
 * Pressure-vessel-style pipe water: solid slug with head advancing on pump-on
 * and tail clearing on pump-off.
 *
 * If the pump is already on at mount (page load / refresh), start in the
 * steady full-flow state. Fill/drain animations still run for later toggles.
 */
function usePipeSlug(active: boolean, pathLength: number, speed: number) {
  const [tail, setTail] = useState(0);
  const [head, setHead] = useState(() => (active ? pathLength : 0));
  const phaseRef = useRef<"idle" | "advance" | "steady" | "retreat">(
    active ? "steady" : "idle",
  );
  const tailRef = useRef(0);
  const headRef = useRef(active ? pathLength : 0);
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

type ThermalJacketProps = {
  mode: JacketMode;
  layout: BioreactorLayout;
};

/** Yellow industrial TX with green status lamp in a black box — for pipe flowmeters. */
function PipeFlowmeter({
  x,
  y,
  pipeOd,
  lit = true,
}: {
  x: number;
  y: number;
  pipeOd: number;
  lit?: boolean;
}) {
  const headY = -pipeOd / 2 - 34;
  return (
    <g className="br-flowmeter" transform={`translate(${x}, ${y})`}>
      <rect
        x={-7}
        y={-pipeOd / 2 - 2}
        width={14}
        height={pipeOd + 4}
        rx={2}
        fill={PIPE_FILL}
        stroke={PIPE_METAL.stroke}
        strokeWidth={1.2}
      />
      <rect
        x={-4}
        y={-pipeOd / 2 - 16}
        width={8}
        height={14}
        rx={1}
        fill="#e8e8e8"
        stroke="#9a9a9a"
        strokeWidth={0.8}
      />
      <rect
        x={-10}
        y={headY}
        width={20}
        height={16}
        rx={3}
        fill="#e8b923"
        stroke="#c99212"
        strokeWidth={0.8}
      />
      {/* Cable boss */}
      <rect x={8} y={headY + 4} width={6} height={8} rx={1} fill="#2a2a2a" />
      {/* Green lamp in black box on the yellow head */}
      <rect
        x={-7}
        y={headY + 3}
        width={11}
        height={10}
        rx={1.5}
        fill="#1a1a1a"
        stroke="#0a0a0a"
        strokeWidth={0.6}
      />
      <circle
        cx={-1.5}
        cy={headY + 8}
        r={2.8}
        fill={lit ? "#3dd68c" : "#4a4a4a"}
        style={
          lit
            ? {
                filter:
                  "drop-shadow(0 0 3px color-mix(in srgb, #3dd68c 70%, transparent))",
              }
            : undefined
        }
      />
    </g>
  );
}

function ThermalJacket({ mode, layout }: ThermalJacketProps) {
  const prefix = useId().replace(/:/g, "");
  const active = mode !== "idle";
  const { fromColor, toColor, progress } = useJacketWaterBlend(mode);
  const modeClass =
    mode === "warm"
      ? "thermal-jacket--warm"
      : mode === "cold"
        ? "thermal-jacket--cold"
        : "thermal-jacket--idle";

  const pathStartX = layout.jacketSvg.gradX0 + 20;
  const pipePath = buildJacketPipePath(
    layout.vessel,
    layout.jacketThick,
    layout.jacketPipeY,
    layout.jacketSvg.pathEndX,
    pathStartX,
  );
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

  const softStart = Math.max(0, progress - JACKET_COLOR_SWEEP_BAND / 2);
  const softEnd = Math.min(1, progress + JACKET_COLOR_SWEEP_BAND / 2);
  const { viewBox, gradX0, gradX1, left, top, width, height } = layout.jacketSvg;

  // Inlet flowmeter on the left horizontal run
  const midLeft =
    (layout.vessel.left + (layout.vessel.left - layout.jacketThick)) / 2;
  const inletMeterX = pathStartX + (midLeft - pathStartX) * 0.55;
  const inletMeterY = layout.jacketPipeY;

  return (
    <div className={`thermal-jacket ${modeClass}`}>
      <svg className="thermal-jacket__svg" viewBox={viewBox} aria-hidden>
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
              x1={gradX0}
              y1={0}
              x2={gradX1}
              y2={0}
            >
              <stop offset={0} stopColor={toColor} />
              <stop offset={softStart} stopColor={toColor} />
              <stop offset={softEnd} stopColor={fromColor} />
              <stop offset={1} stopColor={fromColor} />
            </linearGradient>
          ) : null}
        </defs>

        {/* Left inlet → jacket U → right outlet */}
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

        {segLen > 0 ? (
          <g>
            <defs>
              <mask
                id={`${prefix}-water-mask`}
                maskUnits="userSpaceOnUse"
                x={left}
                y={top}
                width={width}
                height={height}
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

        {/* Flowmeter above the inlet flow */}
        <PipeFlowmeter
          x={inletMeterX}
          y={inletMeterY}
          pipeOd={PIPE_OD}
          lit={active}
        />
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
  layout: BioreactorLayout;
};

function doseColor(mode: DoseMode) {
  if (mode === "acid") return DOSE_ACID;
  if (mode === "base") return DOSE_BASE;
  return null;
}

function doseDripFallPx(fillUnits: number, layout: BioreactorLayout) {
  const fillRatio = Math.min(1, Math.max(0, fillUnits / VESSEL_MAX_FILL_UNITS));
  const tipAbsY = layout.dose.svgTop + layout.dose.tipY;
  const surfaceAbsY =
    layout.waterClip.top + layout.waterClip.height * (1 - fillRatio);
  return Math.max(0, surfaceAbsY - tipAbsY);
}

/**
 * Dose tube sequencer: on acid↔base switch, finish draining the current
 * fluid (and drips) before the new fluid starts filling.
 */
function BaseAcidSupplyPipe({ mode, fillUnits, layout }: BaseAcidSupplyPipeProps) {
  const prefix = useId().replace(/:/g, "");
  const [liquidColor, setLiquidColor] = useState(
    () => doseColor(mode) ?? DOSE_ACID,
  );
  const [feeding, setFeeding] = useState(
    () => mode === "acid" || mode === "base",
  );
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
  const dripFallPx = doseDripFallPx(fillUnits, layout);
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
const AERATOR_FLOW_CYCLE = AERATOR_FLOW_DASH + AERATOR_FLOW_GAP;
/** Air advances ~12× faster than jacket water along a shorter run. */
const AERATOR_AIR_SPEED = (AERATOR_FLOW_CYCLE / 0.55) * 12.8;
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
  layout: BioreactorLayout;
  onAirAtSpargerChange?: (ready: boolean) => void;
};

function AeratorSupply({
  aeratorVal,
  layout,
  onAirAtSpargerChange,
}: AeratorSupplyProps) {
  const prefix = useId().replace(/:/g, "");
  const active = aeratorVal > 0;
  const { tail, head } = usePipeSlug(
    active,
    AERATOR_SUPPLY_PATH_LENGTH,
    AERATOR_AIR_SPEED,
  );
  const airAtSparger =
    active &&
    head >= AERATOR_SUPPLY_PATH_LENGTH - 0.5 &&
    tail < AERATOR_SUPPLY_PATH_LENGTH - 1;
  const onReadyRef = useRef(onAirAtSpargerChange);
  onReadyRef.current = onAirAtSpargerChange;
  const wasReadyRef = useRef(false);

  useEffect(() => {
    if (wasReadyRef.current === airAtSparger) return;
    wasReadyRef.current = airAtSparger;
    onReadyRef.current?.(airAtSparger);
  }, [airAtSparger]);

  const level = airAtSparger ? aeratorDiffuserLevel(aeratorVal) : 0;
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

  const {
    spargerWidth,
    spargerY,
    spargerLeft,
    dropX,
    pipeEndX,
    viewBox,
    svgLeft,
    svgTop,
    svgWidth,
    svgHeight,
  } = layout.aerator;
  const spargerTop = spargerY - AERATOR_SPARGER_HEIGHT / 2;
  const supplyPath = [
    `M ${svgLeft + 10} ${svgTop + 13}`,
    `L ${dropX} ${svgTop + 13}`,
    `L ${dropX} ${spargerY}`,
    `L ${pipeEndX} ${spargerY}`,
  ].join(" ");

  const segStart = Math.max(0, tail);
  const segEnd = Math.max(segStart, head);
  const segLen = Math.max(
    0,
    Math.min(segEnd, AERATOR_SUPPLY_PATH_LENGTH) - segStart,
  );

  return (
    <div className="aerator-supply">
      <svg
        className="aerator-supply__pipe"
        viewBox={viewBox}
        style={{
          left: svgLeft,
          top: svgTop,
          width: svgWidth,
          height: svgHeight,
        }}
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
            d={supplyPath}
            fill="none"
            stroke={PIPE_METAL.stroke}
            strokeWidth={AERATOR_PIPE_OD + 2}
            strokeLinecap="butt"
            strokeLinejoin="round"
          />
          <path
            d={supplyPath}
            fill="none"
            stroke={PIPE_FILL}
            strokeWidth={AERATOR_PIPE_OD}
            strokeLinecap="butt"
            strokeLinejoin="round"
          />
        </g>

        {segLen > 0 ? (
          <g>
            <defs>
              <mask
                id={`${prefix}-air-mask`}
                maskUnits="userSpaceOnUse"
                x={svgLeft}
                y={svgTop}
                width={svgWidth}
                height={svgHeight}
              >
                <path
                  d={supplyPath}
                  pathLength={AERATOR_SUPPLY_PATH_LENGTH}
                  fill="none"
                  stroke="#fff"
                  strokeWidth={airWidth + 2}
                  strokeLinecap="butt"
                  strokeLinejoin="round"
                  strokeDasharray={`${segLen} ${AERATOR_SUPPLY_PATH_LENGTH}`}
                  strokeDashoffset={-segStart}
                />
              </mask>
            </defs>
            <path
              d={supplyPath}
              pathLength={AERATOR_SUPPLY_PATH_LENGTH}
              fill="none"
              stroke={AERATOR_AIR}
              strokeWidth={airWidth}
              strokeLinecap="butt"
              strokeLinejoin="round"
              strokeDasharray={`${segLen} ${AERATOR_SUPPLY_PATH_LENGTH}`}
              strokeDashoffset={-segStart}
            />
            <path
              className="aerator-supply__flow-dash"
              d={supplyPath}
              pathLength={AERATOR_SUPPLY_PATH_LENGTH}
              fill="none"
              stroke={AERATOR_AIR_DASH}
              strokeWidth={Math.max(2, airWidth - 2)}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={`${AERATOR_FLOW_DASH} ${AERATOR_FLOW_GAP}`}
              mask={`url(#${prefix}-air-mask)`}
            />
          </g>
        ) : null}

        {/* Sparger bar — same OD as pipe for a flush joint */}
        <g filter={`url(#${prefix}-metal)`}>
          <rect
            x={spargerLeft}
            y={spargerTop}
            width={spargerWidth}
            height={AERATOR_SPARGER_HEIGHT}
            rx={3}
            fill={`url(#${prefix}-diffuser)`}
            stroke={PIPE_METAL.stroke}
            strokeWidth={1.5}
            style={
              airAtSparger
                ? {
                    filter: `drop-shadow(0 0 ${4 + level / 20}px rgba(56, 189, 248, ${glow}))`,
                  }
                : undefined
            }
          />
          {/* Coupling sleeve: bridges pipe OD into the perforated bar */}
          <rect
            x={spargerLeft - 3}
            y={spargerY - (AERATOR_PIPE_OD + 2) / 2}
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

/** Flange + collar where a vertical pipe penetrates the vessel shell. */
function PipeShellJoint({
  cx,
  cy,
  pipeOd,
}: {
  cx: number;
  cy: number;
  pipeOd: number;
}) {
  const flangeW = pipeOd + 10;
  const flangeH = 7;
  return (
    <>
      <rect
        x={cx - flangeW / 2}
        y={cy - flangeH / 2}
        width={flangeW}
        height={flangeH}
        rx={1.5}
        fill={PIPE_FILL}
        stroke={PIPE_METAL.stroke}
        strokeWidth={1.5}
      />
      <rect
        x={cx - (pipeOd + 4) / 2}
        y={cy - 2}
        width={pipeOd + 4}
        height={4}
        rx={1}
        fill={PIPE_METAL.mid}
        stroke={PIPE_METAL.stroke}
        strokeWidth={1}
      />
    </>
  );
}

const PIPE_WATER_WIDTH = PIPE_OD - 6;

/** True when the water slug covers a point `sensorDist` along the pipe centerline. */
function pipeFlowAtSensor(tail: number, head: number, sensorDist: number) {
  return head > sensorDist + 0.5 && tail < sensorDist - 0.5;
}

/**
 * Lid fill nozzle on the flat apex (inner + outer still horizontal),
 * just clear of the agitator shaft — vertical drop + short horizontal run.
 */
function FillInletPipe({
  layout,
  waterTail = 0,
  waterHead = 0,
}: {
  layout: BioreactorLayout;
  waterTail?: number;
  waterHead?: number;
}) {
  const prefix = useId().replace(/:/g, "");
  const {
    centerline,
    pipeOd,
    pipePathLength,
    svgLeft,
    svgTop,
    svgWidth,
    svgHeight,
    viewBox,
    lidY,
    elbowY,
    centerX,
    runEndX,
  } = layout.fillInlet;
  const pad = 20;
  const localX = pad;
  const localLidY = lidY - elbowY + pad;
  const localElbowY = pad;
  const localRunEndX = runEndX - centerX + pad;
  const horizLen = Math.max(1, runEndX - centerX);
  // Flowmeter on the horizontal supply run (open end → elbow).
  const sensorFrac = 0.55;
  const sensorDist = horizLen * sensorFrac;
  const txX = localRunEndX + (localX - localRunEndX) * sensorFrac;
  const txY = localElbowY;
  const pipeTail = Math.max(0, waterTail);
  const pipeHead = Math.max(pipeTail, waterHead);
  const segStart = Math.max(0, pipeTail);
  const segEnd = Math.max(segStart, Math.min(pipeHead, pipePathLength));
  const segLen = Math.max(0, segEnd - segStart);
  const flowLit = pipeFlowAtSensor(pipeTail, pipeHead, sensorDist);

  return (
    <div className="br-fill-inlet" aria-hidden>
      <svg
        className="br-fill-inlet__svg"
        viewBox={viewBox}
        style={{ left: svgLeft, top: svgTop, width: svgWidth, height: svgHeight }}
        overflow="visible"
      >
        <defs>
          <filter
            id={`${prefix}-metal`}
            x="-40%"
            y="-40%"
            width="180%"
            height="180%"
          >
            <feDropShadow
              dx="1"
              dy="2"
              stdDeviation="1.1"
              floodColor="#000"
              floodOpacity="0.18"
            />
          </filter>
        </defs>
        <g filter={`url(#${prefix}-metal)`}>
          <path
            d={centerline}
            fill="none"
            stroke={PIPE_METAL.stroke}
            strokeWidth={pipeOd + 2}
            strokeLinecap="butt"
            strokeLinejoin="round"
          />
          <path
            d={centerline}
            fill="none"
            stroke={PIPE_FILL}
            strokeWidth={pipeOd}
            strokeLinecap="butt"
            strokeLinejoin="round"
          />
          <PipeShellJoint cx={localX} cy={localLidY} pipeOd={pipeOd} />
        </g>
        {segLen > 0 ? (
          <path
            d={centerline}
            pathLength={pipePathLength}
            fill="none"
            stroke={APPLE_DEPTH_COLORS.cyan}
            strokeWidth={PIPE_WATER_WIDTH}
            strokeLinecap="butt"
            strokeLinejoin="round"
            strokeDasharray={`${segLen} ${pipePathLength}`}
            strokeDashoffset={-segStart}
          />
        ) : null}
        <PipeFlowmeter x={txX} y={txY} pipeOd={pipeOd} lit={flowLit} />
      </svg>
    </div>
  );
}

/** Bottom drain elbow — metal pipe with flowmeter on the horizontal run. */
function BottomOutflow({
  layout,
  waterTail = 0,
  waterHead = 0,
  riseLength = 0,
}: {
  layout: BioreactorLayout;
  waterTail?: number;
  waterHead?: number;
  riseLength?: number;
}) {
  const prefix = useId().replace(/:/g, "");
  const { centerX, vesselBottom, drop, run, pipeOd, pipePathLength } =
    layout.outflow;
  const pad = 28;
  const svgLeft = centerX - pad;
  const svgTop = vesselBottom - 4;
  const svgW = pad + run + 36;
  const svgH = drop + 48;
  const x0 = pad;
  const y0 = 4;
  const y1 = y0 + drop;
  const x1 = x0 + run;
  const path = `M ${x0} ${y0} L ${x0} ${y1} L ${x1} ${y1}`;
  const sensorFrac = 0.62;
  const txX = x0 + run * sensorFrac;
  const txY = y1;
  /** Distance along pipe centerline from vessel nozzle to the TX. */
  const sensorDist = drop + run * sensorFrac;
  const pipeTail = Math.max(riseLength, waterTail) - riseLength;
  const pipeHead = waterHead - riseLength;
  const segStart = Math.max(0, pipeTail);
  const segEnd = Math.max(segStart, pipeHead);
  const segLen = Math.max(0, Math.min(segEnd, pipePathLength) - segStart);
  const flowLit = pipeFlowAtSensor(pipeTail, pipeHead, sensorDist);

  return (
    <div className="br-outflow" aria-hidden>
      <svg
        className="br-outflow__svg"
        viewBox={`0 0 ${svgW} ${svgH}`}
        style={{ left: svgLeft, top: svgTop, width: svgW, height: svgH }}
        overflow="visible"
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
              stdDeviation="1.1"
              floodColor="#000"
              floodOpacity="0.18"
            />
          </filter>
        </defs>
        <g filter={`url(#${prefix}-metal)`}>
          <path
            d={path}
            fill="none"
            stroke={PIPE_METAL.stroke}
            strokeWidth={pipeOd + 2}
            strokeLinecap="butt"
            strokeLinejoin="round"
          />
          <path
            d={path}
            fill="none"
            stroke={PIPE_FILL}
            strokeWidth={pipeOd}
            strokeLinecap="butt"
            strokeLinejoin="round"
          />
          <PipeShellJoint cx={x0} cy={y0} pipeOd={pipeOd} />
        </g>
        {segLen > 0 ? (
          <path
            d={path}
            pathLength={pipePathLength}
            fill="none"
            stroke={APPLE_DEPTH_COLORS.blue}
            strokeWidth={Math.max(8, pipeOd - 10)}
            strokeLinecap="butt"
            strokeLinejoin="round"
            strokeDasharray={`${segLen} ${pipePathLength}`}
            strokeDashoffset={-segStart}
          />
        ) : null}
        <PipeFlowmeter x={txX} y={txY} pipeOd={pipeOd} lit={flowLit} />
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
  /** 0–1 foam intensity on the discs (≥40% fill & high RPM). */
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

  // Faster boil as tip speed rises — ~0.28s at onset, ~0.08s at 300 rpm
  const cavitationPeriod = `${(0.28 - cavitationStrength * 0.2).toFixed(3)}s`;

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
                  0.55 + cavitationStrength * 0.45,
                ),
                ["--cavitation-period" as string]: cavitationPeriod,
              } as CSSProperties
            }
          />
          <div
            className="agitator__cavitation agitator__cavitation--lower is-on"
            style={
              {
                ["--cavitation-strength" as string]: String(
                  0.6 + cavitationStrength * 0.4,
                ),
                ["--cavitation-period" as string]: cavitationPeriod,
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
  const equipment = { ...defaultEquipment(), ...props.equipment };
  const geometry = props.geometry ?? defaultBioreactorGeometry();
  const layout = useMemo(
    () => layoutFromGeometry(geometry),
    [geometry.height_m, geometry.diameter_m],
  );
  const airActive = Boolean(equipment.aerator && aeratorVal > 0);
  const [airAtSparger, setAirAtSparger] = useState(airActive);
  useEffect(() => {
    if (!equipment.aerator || aeratorVal <= 0) setAirAtSparger(false);
  }, [equipment.aerator, aeratorVal]);
  const bubbleAeratorVal = airActive && airAtSparger ? aeratorVal : 0;

  const drainAnim = props.drainAnim;
  const inletFill = props.inletFill;
  const rawFillUnits = props.fillUnits ?? Math.round(VESSEL_MAX_FILL_UNITS * 0.92);
  const levelFillUnits =
    drainAnim?.isLevelFrozen && drainAnim.frozenFillUnits != null
      ? drainAnim.frozenFillUnits
      : rawFillUnits;

  const { displayFillUnits, fillVelocity: levelVelocity } = useSpringFillUnits(
    levelFillUnits,
    { stiffness: 120, damping: 0.68 },
  );

  const waveVelocity =
    levelVelocity + (bubbleAeratorVal / 100) * 28 + rotorNorm * 20;

  const fillRatioRaw = displayFillUnits / VESSEL_MAX_FILL_UNITS;
  const fillRatio = Math.max(0.05, fillRatioRaw);
  const waterPct = Math.max(0, fillRatioRaw) * 100;
  // Sparger sits at a fixed absolute height. The bubble canvas is only as tall as
  // the current water column, so convert that absolute height into a % of the
  // filled column — do not clamp down or the plume slides with the level.
  const spargerSpawnBottomPct = Math.min(
    92,
    Math.max(
      2,
      layout.aerator.spawnBottomPctAtFull / Math.max(0.05, fillRatioRaw),
    ),
  );
  /** Soft foam on the discs — ≥40% fill and rotor above half speed. */
  const cavitationStrength =
    waterPct >= 40 && rotorNorm > 0.5
      ? Math.min(1, (rotorNorm - 0.5) / 0.5)
      : 0;

  const showInletWater = Boolean(inletFill && inletFill.head > inletFill.tail);
  const showDrainWater = Boolean(drainAnim && drainAnim.head > drainAnim.tail);
  const drainRiseLength =
    Math.min(1, Math.max(0, levelFillUnits / VESSEL_MAX_FILL_UNITS)) *
    layout.outflow.columnHeight;
  const inletPipeLen = layout.fillInlet.pipePathLength;
  const columnH = layout.waterClip.height;
  const surfaceYInClip = (1 - fillRatioRaw) * columnH;
  const fillStreamX =
    layout.fillInlet.centerX - layout.waterClip.left - 5;
  const STREAM_W = 10;

  // Falling fill column — air gap only (never draw through the water body).
  let fillStream: { top: number; height: number } | null = null;
  if (showInletWater && inletFill) {
    const fallTail = Math.max(inletPipeLen, inletFill.tail);
    const streamTop = Math.max(
      0,
      layout.fillInlet.tipY - layout.waterClip.top + (fallTail - inletPipeLen),
    );
    const leadingFall = inletFill.head - fallTail;
    const airGap = surfaceYInClip - streamTop;
    const streamHeight = inletFill.connectedToSurface
      ? Math.max(0, airGap)
      : Math.min(leadingFall, Math.max(0, airGap));
    if (inletFill.head > inletPipeLen && streamHeight >= 2 && airGap > 1) {
      fillStream = { top: streamTop, height: streamHeight };
    }
  }

  // In-vessel drain column omitted — water in the outlet pipe is enough,
  // and a cyan strip through the tank reads as a bug.

  return (
    <div
      style={{
        position: "absolute",
        width: layout.cardWidth,
        height: layout.cardHeight,
        transform: `translate(${props.translateX}px, ${props.translateY}px) scale(${props.scale})`,
        userSelect: "none",
        ...layoutCssVars(layout),
      }}
      onMouseDown={(event) => {
        props.onMouseDown(event);
      }}
    >
      <div className="wrapper" style={layoutCssVars(layout)}>
        {equipment.thermal_jacket ? (
          <ThermalJacket mode={jacketMode} layout={layout} />
        ) : null}

        <div className="reaction_chamber" />

        <FillInletPipe
          layout={layout}
          waterTail={showInletWater && inletFill ? Math.min(inletFill.tail, inletPipeLen) : 0}
          waterHead={showInletWater && inletFill ? Math.min(inletFill.head, inletPipeLen) : 0}
        />

        {equipment.stirrer ? (
          <SpinningAgitator
            rotorNorm={rotorNorm}
            cavitationStrength={cavitationStrength}
          />
        ) : null}

        {equipment.sensor_temperature ? (
          <div className="sensor sensor1 sensor--temp" aria-hidden>
            <div className="sensor__port">
              <span className="sensor__lamp sensor__lamp--ok" />
            </div>
            <div className="sensor__collar" />
            <div className="sensor__shaft" />
            <div className="sensor__tip" />
          </div>
        ) : null}
        {equipment.sensor_ph ? (
          <div className="sensor sensor2 sensor--ph" aria-hidden>
            <div className="sensor__port">
              <span className="sensor__lamp sensor__lamp--ok" />
            </div>
            <div className="sensor__collar" />
            <div className="sensor__shaft" />
            <div className="sensor__tip" />
          </div>
        ) : null}
        {equipment.sensor_pressure ? (
          <div className="sensor sensor--pressure" aria-hidden>
            <div className="sensor__tx-head">
              <span className="sensor__tx-lamp-box">
                <span className="sensor__lamp sensor__lamp--ok" />
              </span>
              <span className="sensor__tx-boss" />
            </div>
            <div className="sensor__tx-neck" />
            <div className="sensor__port" />
          </div>
        ) : null}

        {equipment.outflow ? (
          <BottomOutflow
            layout={layout}
            waterTail={showDrainWater && drainAnim ? drainAnim.tail : 0}
            waterHead={showDrainWater && drainAnim ? drainAnim.head : 0}
            riseLength={drainRiseLength}
          />
        ) : null}

        <div className="br-water-clip">
          {fillStream ? (
            <div
              className="br-fill-stream"
              style={{
                left: fillStreamX,
                top: fillStream.top,
                width: STREAM_W,
                height: fillStream.height,
              }}
              aria-hidden
            />
          ) : null}
          <VesselWaterBody
            fillUnits={displayFillUnits}
            fillVelocity={waveVelocity}
            showSurface={displayFillUnits / VESSEL_MAX_FILL_UNITS < 0.98}
            waveDamping={props.fluidMotion?.waveDamping ?? 1}
            waveSpeed={props.fluidMotion?.waveSpeed ?? 1}
            bubbleCount={0}
          />
          {equipment.aerator || equipment.stirrer ? (
            <StirredBubbleField
              aeratorVal={equipment.aerator ? bubbleAeratorVal : 0}
              rotorNorm={equipment.stirrer ? rotorNorm : 0}
              fillRatio={Math.min(1, displayFillUnits / VESSEL_MAX_FILL_UNITS)}
              spawnBottomPct={spargerSpawnBottomPct}
              spawnLeftRange={[26, 74]}
              impellerLowerFromBottom={layout.impeller.lowerFromBottom}
              impellerUpperFromBottom={layout.impeller.upperFromBottom}
              clipHeightPx={layout.impeller.clipHeight}
              bubbleSpeed={props.fluidMotion?.bubbleSpeed ?? 1}
              bubbleWander={props.fluidMotion?.bubbleWander ?? 1}
              bubbleSize={props.fluidMotion?.bubbleSize ?? 1}
              bubbleFollow={props.fluidMotion?.bubbleFollow ?? 1}
            />
          ) : null}
        </div>

        {equipment.dosing ? (
          <BaseAcidSupplyPipe
            mode={doseMode}
            fillUnits={displayFillUnits}
            layout={layout}
          />
        ) : null}

        {equipment.aerator ? (
          <AeratorSupply
            aeratorVal={aeratorVal}
            layout={layout}
            onAirAtSpargerChange={setAirAtSparger}
          />
        ) : null}
      </div>
    </div>
  );
}

BioreactorCard.displayName = "BioreactorCard";
export default BioreactorCard;

export const CARD_WIDTH = 800;
export const CARD_HEIGHT = 750;
