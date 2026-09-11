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

/**
 * Centerline: left supply → down jacket wall → around bottom U → up right → discharge.
 * Coordinates are wrapper-local (jacket outer box 0..442, top at 0).
 */
const JACKET_FLOW_PATH =
  "M -100 40 L 10 40 L 10 300 A 211 211 0 0 0 432 300 L 432 250 L 542 250";

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

  return (
    <div className={`thermal-jacket ${modeClass}`}>
      <div className="thermal_jacket_shell" />
      <div className="thermal_jacket_lower_cap" />

      <svg
        className="thermal-jacket__flow-svg"
        viewBox="-120 -20 682 560"
        aria-hidden
      >
        <defs>
          <filter
            id={`${prefix}-pipe`}
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
        </defs>

        {/* Metal supply + discharge stubs */}
        <g filter={`url(#${prefix}-pipe)`}>
          <path
            d="M -100 40 L 10 40"
            fill="none"
            stroke={PIPE_METAL.stroke}
            strokeWidth={PIPE_OD + 3}
            strokeLinecap="butt"
          />
          <path
            d="M -100 40 L 10 40"
            fill="none"
            stroke={PIPE_FILL}
            strokeWidth={PIPE_OD}
            strokeLinecap="butt"
          />
          <path
            d="M 432 250 L 542 250"
            fill="none"
            stroke={PIPE_METAL.stroke}
            strokeWidth={PIPE_OD + 3}
            strokeLinecap="butt"
          />
          <path
            d="M 432 250 L 542 250"
            fill="none"
            stroke={PIPE_FILL}
            strokeWidth={PIPE_OD}
            strokeLinecap="butt"
          />
        </g>

        {flowing ? (
          <g className="thermal-jacket__flow-group">
            {/* Solid water body in the jacket channel + stubs */}
            <path
              className="thermal-jacket__water"
              d={JACKET_FLOW_PATH}
              fill="none"
              stroke={flowColor}
              strokeWidth={12}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Brighter moving highlight on top of the solid stream */}
            <path
              className="thermal-jacket__flow-pulse"
              d={JACKET_FLOW_PATH}
              fill="none"
              stroke="rgba(255, 255, 255, 0.55)"
              strokeWidth={5}
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
