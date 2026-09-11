import { useEffect, useId, useState } from "react";
import { VESSEL_MAX_FILL_UNITS } from "../pressure-vessel/constants";
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

/** Warm = reddish; cold = solid blue. */
const FLOW_WARM = "#e11d48";
const FLOW_COLD = "#0284c7";

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
/** Diagonal cut depth on both tops. */
const JACKET_DIAG = 26;
/** Inlet / outlet height — meets the outer (lower) corner of the diagonal. */
const JACKET_PORT_Y = JACKET_TOP + JACKET_DIAG;

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

/** Filled U jacket with diagonal tops, following the vessel bottom. */
function buildJacketShellPath(): string {
  const { inner, outer } = jacketRadii();
  const top = JACKET_TOP;
  const diag = JACKET_DIAG;

  const oLeft = outer.left;
  const oRight = outer.right;
  const iLeft = inner.left;
  const iRight = inner.right;

  // Diagonal slopes down away from the vessel (inner high, outer low).
  return [
    `M ${oLeft} ${top + diag}`,
    `L ${oLeft} ${outer.cy}`,
    `A ${outer.r} ${outer.r} 0 0 0 ${outer.leftCx} ${outer.bottom}`,
    `L ${outer.rightCx} ${outer.bottom}`,
    `A ${outer.r} ${outer.r} 0 0 0 ${oRight} ${outer.cy}`,
    `L ${oRight} ${top + diag}`,
    // Right diagonal: outer low → inner high
    `L ${iRight} ${top}`,
    `L ${iRight} ${inner.cy}`,
    `A ${inner.r} ${inner.r} 0 0 1 ${inner.rightCx} ${inner.bottom}`,
    `L ${inner.leftCx} ${inner.bottom}`,
    `A ${inner.r} ${inner.r} 0 0 1 ${iLeft} ${inner.cy}`,
    `L ${iLeft} ${top}`,
    // Left diagonal: inner high → outer low
    `L ${oLeft} ${top + diag}`,
    "Z",
  ].join(" ");
}

/** Flow centerline through the jacket channel. */
function buildJacketFlowPath(): string {
  const { inner, outer } = jacketRadii();
  const midLeft = (inner.left + outer.left) / 2;
  const midRight = (inner.right + outer.right) / 2;
  const midR = (inner.r + outer.r) / 2;
  const midBottom = (inner.bottom + outer.bottom) / 2;
  const leftCx = inner.leftCx;
  const rightCx = inner.rightCx;
  const yPort = JACKET_PORT_Y;

  return [
    `M -100 ${yPort}`,
    `L ${midLeft} ${yPort}`,
    `L ${midLeft} ${inner.cy}`,
    `A ${midR} ${midR} 0 0 0 ${leftCx} ${midBottom}`,
    `L ${rightCx} ${midBottom}`,
    `A ${midR} ${midR} 0 0 0 ${midRight} ${inner.cy}`,
    `L ${midRight} ${yPort}`,
    `L 542 ${yPort}`,
  ].join(" ");
}

type ThermalJacketProps = {
  mode: JacketMode;
};

function ThermalJacket({ mode }: ThermalJacketProps) {
  const prefix = useId().replace(/:/g, "");
  const flowing = mode !== "idle";
  const flowColor = mode === "warm" ? FLOW_WARM : FLOW_COLD;
  const modeClass =
    mode === "warm"
      ? "thermal-jacket--warm"
      : mode === "cold"
        ? "thermal-jacket--cold"
        : "thermal-jacket--idle";

  const shellPath = buildJacketShellPath();
  const flowPath = buildJacketFlowPath();
  const yPort = JACKET_PORT_Y;
  const { outer } = jacketRadii();
  // Horizontal stubs meet the outer jacket face (left inlet, right outlet).
  const supplyPath = `M -110 ${yPort} L ${outer.left} ${yPort}`;
  const dischargePath = `M ${outer.right} ${yPort} L 552 ${yPort}`;

  const paintPipe = (d: string) => (
    <>
      <path
        d={d}
        fill="none"
        stroke={PIPE_METAL.stroke}
        strokeWidth={PIPE_OD + 3}
        strokeLinecap="butt"
      />
      <path
        d={d}
        fill="none"
        stroke={PIPE_FILL}
        strokeWidth={PIPE_OD}
        strokeLinecap="butt"
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

        {/* Inlet (left) + outlet (right) — behind jacket at the joint */}
        <g filter={`url(#${prefix}-metal)`}>{paintPipe(supplyPath)}</g>
        <g filter={`url(#${prefix}-metal)`}>{paintPipe(dischargePath)}</g>

        {/* Jacket shell covers the pipe ends at the connection */}
        <g filter={`url(#${prefix}-metal)`}>
          <path
            d={shellPath}
            fill={`url(#${prefix}-jacket-fill)`}
            stroke={PIPE_METAL.stroke}
            strokeWidth={2}
            strokeLinejoin="round"
          />
        </g>

        {flowing ? (
          <g className="thermal-jacket__flow-group">
            <path
              className="thermal-jacket__water"
              d={flowPath}
              fill="none"
              stroke={flowColor}
              strokeWidth={11}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              className="thermal-jacket__flow-pulse"
              d={flowPath}
              fill="none"
              stroke="rgba(255, 255, 255, 0.55)"
              strokeWidth={4.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
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
