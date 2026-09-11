import { useEffect, useId, useRef, useState } from "react";
import { APPLE_DEPTH_COLORS } from "../pressure-vessel/apple-depth-style";
import {
  INLET_PIPE_WATER_SPEED,
  VESSEL_MAX_FILL_UNITS,
} from "../pressure-vessel/constants";
import { PIPE_FILL, PIPE_METAL, PIPE_OD } from "../pressure-vessel/pipe-style";
import { useSpringFillUnits } from "../pressure-vessel/useSpringFillUnits";
import { VesselWaterBody } from "../pressure-vessel/VesselWaterBody";
import "./Bioreactor.css";

export type JacketMode = "idle" | "warm" | "cold";

type BioreactorCardProps = {
  rotorVal?: number;
  aeratorVal?: number;
  waterLevelVal?: number;
  jacketMode?: JacketMode;
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

/** Chamber outer box (matches .reaction_chamber, border-box). */
const VESSEL = {
  left: 20,
  right: 422,
  top: -120,
  bottom: 430,
  radius: 169,
} as const;

/** Jacket wall thickness — matches pipe OD language. */
const JACKET_THICK = 18;
/** Jacket starts on the straight wall (below top dome). */
const JACKET_TOP = 52;
/** Horizontal run height of inlet/outlet L-pipes (above jacket top). */
const JACKET_PIPE_Y = JACKET_TOP - 36;

/**
 * Pressure-vessel-style pipe water: solid slug with head advancing on pump-on
 * and tail clearing on pump-off.
 */
function useJacketPipeWater(active: boolean) {
  const [tail, setTail] = useState(0);
  const [head, setHead] = useState(0);
  const phaseRef = useRef<"idle" | "advance" | "steady" | "retreat">("idle");
  const tailRef = useRef(0);
  const headRef = useRef(0);
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    let frame = 0;
    let lastTime = 0;

    const tick = (now: number) => {
      if (!lastTime) lastTime = now;
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      const on = activeRef.current;
      let phase = phaseRef.current;
      const pathEnd = JACKET_FLOW_PATH_LENGTH;

      if (phase === "idle" && on) {
        phase = "advance";
        tailRef.current = 0;
        headRef.current = 0;
      }

      switch (phase) {
        case "advance": {
          tailRef.current = 0;
          if (on) {
            headRef.current = Math.min(
              pathEnd,
              headRef.current + INLET_PIPE_WATER_SPEED * dt,
            );
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
            // Pump turned back on mid-drain — refill from current water body.
            phase = "advance";
            break;
          }
          tailRef.current = Math.min(
            headRef.current,
            tailRef.current + INLET_PIPE_WATER_SPEED * dt,
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

/** Filled U jacket with flat tops, following the vessel bottom. */
function buildJacketShellPath(): string {
  const { inner, outer } = jacketRadii();
  const top = JACKET_TOP;
  const oLeft = outer.left;
  const oRight = outer.right;
  const iLeft = inner.left;
  const iRight = inner.right;

  return [
    `M ${oLeft} ${top}`,
    `L ${oLeft} ${outer.cy}`,
    `A ${outer.r} ${outer.r} 0 0 0 ${outer.leftCx} ${outer.bottom}`,
    `L ${outer.rightCx} ${outer.bottom}`,
    `A ${outer.r} ${outer.r} 0 0 0 ${oRight} ${outer.cy}`,
    `L ${oRight} ${top}`,
    `L ${iRight} ${top}`,
    `L ${iRight} ${inner.cy}`,
    `A ${inner.r} ${inner.r} 0 0 1 ${inner.rightCx} ${inner.bottom}`,
    `L ${inner.leftCx} ${inner.bottom}`,
    `A ${inner.r} ${inner.r} 0 0 1 ${iLeft} ${inner.cy}`,
    `L ${iLeft} ${top}`,
    "Z",
  ].join(" ");
}

/** Flow: inlet L → down jacket → around bottom → up → outlet L. */
function buildJacketFlowPath(): string {
  const { inner, outer } = jacketRadii();
  const midLeft = (inner.left + outer.left) / 2;
  const midRight = (inner.right + outer.right) / 2;
  const midR = (inner.r + outer.r) / 2;
  const midBottom = (inner.bottom + outer.bottom) / 2;
  const leftCx = inner.leftCx;
  const rightCx = inner.rightCx;
  const pipeY = JACKET_PIPE_Y;
  const top = JACKET_TOP;

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
  const waterColorRef = useRef(APPLE_DEPTH_COLORS.cyan);
  if (mode === "warm") waterColorRef.current = "#f97316";
  else if (mode === "cold") waterColorRef.current = APPLE_DEPTH_COLORS.cyan;
  const waterColor = waterColorRef.current;
  const modeClass =
    mode === "warm"
      ? "thermal-jacket--warm"
      : mode === "cold"
        ? "thermal-jacket--cold"
        : "thermal-jacket--idle";

  const shellPath = buildJacketShellPath();
  const flowPath = buildJacketFlowPath();
  const { outer } = jacketRadii();
  const midLeft = (outer.left + VESSEL.left) / 2;
  const midRight = (outer.right + VESSEL.right) / 2;
  const pipeY = JACKET_PIPE_Y;
  const top = JACKET_TOP;

  const { tail, head } = useJacketPipeWater(active);
  const segStart = Math.max(0, tail);
  const segEnd = Math.max(segStart, head);
  const segLen = Math.max(
    0,
    Math.min(segEnd, JACKET_FLOW_PATH_LENGTH) - segStart,
  );

  // L-turns like base/acid: horizontal then vertical into the jacket top.
  const supplyPath = `M -110 ${pipeY} L ${midLeft} ${pipeY} L ${midLeft} ${top}`;
  const dischargePath = `M ${midRight} ${top} L ${midRight} ${pipeY} L 552 ${pipeY}`;

  const paintPipe = (d: string) => (
    <>
      <path
        d={d}
        fill="none"
        stroke={PIPE_METAL.stroke}
        strokeWidth={PIPE_OD + 3}
        strokeLinecap="butt"
        strokeLinejoin="round"
      />
      <path
        d={d}
        fill="none"
        stroke={PIPE_FILL}
        strokeWidth={PIPE_OD}
        strokeLinecap="butt"
        strokeLinejoin="round"
      />
    </>
  );

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
          <linearGradient
            id={`${prefix}-jacket-fill`}
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop offset="0%" stopColor={PIPE_METAL.light} />
            <stop offset="55%" stopColor={PIPE_FILL} />
            <stop offset="100%" stopColor={PIPE_METAL.mid} />
          </linearGradient>
        </defs>

        <g filter={`url(#${prefix}-metal)`}>{paintPipe(supplyPath)}</g>
        <g filter={`url(#${prefix}-metal)`}>{paintPipe(dischargePath)}</g>

        <g filter={`url(#${prefix}-metal)`}>
          <path
            d={shellPath}
            fill={`url(#${prefix}-jacket-fill)`}
            stroke={PIPE_METAL.stroke}
            strokeWidth={2}
            strokeLinejoin="round"
          />
        </g>

        {/* Solid water slug — same technique as pressure-vessel pipe runs */}
        {segLen > 0 ? (
          <path
            d={flowPath}
            pathLength={JACKET_FLOW_PATH_LENGTH}
            fill="none"
            stroke={waterColor}
            strokeWidth={JACKET_WATER_WIDTH}
            strokeLinecap="butt"
            strokeLinejoin="round"
            strokeDasharray={`${segLen} ${JACKET_FLOW_PATH_LENGTH}`}
            strokeDashoffset={-segStart}
          />
        ) : null}
      </svg>
    </div>
  );
}

function BaseAcidSupplyPipe() {
  const prefix = useId().replace(/:/g, "");
  const centerline = "M 16 16 L 264 16 L 264 273";

  return (
    <div className="base-acid-supply">
      <svg
        className="base-acid-pipe-run"
        viewBox="0 0 280 289"
        aria-hidden
        overflow="visible"
      >
        <defs>
          <filter
            id={`${prefix}-shadow`}
            filterUnits="userSpaceOnUse"
            x="0"
            y="0"
            width="280"
            height="289"
          >
            <feDropShadow
              dx="1"
              dy="2"
              stdDeviation="1.5"
              floodColor="#000"
              floodOpacity="0.2"
            />
          </filter>
        </defs>
        <g filter={`url(#${prefix}-shadow)`}>
          <path
            d={centerline}
            fill="none"
            stroke={PIPE_METAL.stroke}
            strokeWidth={PIPE_OD + 3}
            strokeLinecap="butt"
            strokeLinejoin="round"
          />
          <path
            d={centerline}
            fill="none"
            stroke={PIPE_FILL}
            strokeWidth={PIPE_OD}
            strokeLinecap="butt"
            strokeLinejoin="round"
          />
        </g>
      </svg>
      <div className="base-acid-flange" />
    </div>
  );
}

function BioreactorCard(props: BioreactorCardProps) {
  const SLOWEST_ROTOR_SPEED = 4;
  const FASTEST_ROTOR_SPEED = 0.5;
  const rotorVal = props.rotorVal ?? 0;
  const aeratorVal = props.aeratorVal ?? 0;
  const jacketMode = props.jacketMode ?? "idle";
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

        <BaseAcidSupplyPipe />

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
