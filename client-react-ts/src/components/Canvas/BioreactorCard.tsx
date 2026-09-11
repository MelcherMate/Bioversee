import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { VESSEL_MAX_FILL_UNITS } from "../pressure-vessel/constants";
import { PIPE_FILL, PIPE_METAL, PIPE_OD } from "../pressure-vessel/pipe-style";
import { useSpringFillUnits } from "../pressure-vessel/useSpringFillUnits";
import { VesselWaterBody } from "../pressure-vessel/VesselWaterBody";
import "./Bioreactor.css";

type BioreactorCardProps = {
  rotorVal?: number;
  aeratorVal?: number;
  waterLevelVal?: number;
  translateX: number;
  translateY: number;
  scale: number;
  onMouseDown: (event: React.MouseEvent) => void;
};

/** L-run matching pressure-vessel pipe stroke language (no flow fill). */
function BaseAcidSupplyPipe() {
  const prefix = useId().replace(/:/g, "");
  // Wrapper coords: open end (-92,-147) → elbow (120,-147) → tip (120,-35)
  const centerline = "M 16 16 L 228 16 L 228 128";

  return (
    <div className="base-acid-supply">
      <svg
        className="base-acid-pipe-run"
        viewBox="0 0 244 144"
        aria-hidden
        overflow="visible"
      >
        <defs>
          <filter
            id={`${prefix}-shadow`}
            filterUnits="userSpaceOnUse"
            x="0"
            y="0"
            width="244"
            height="144"
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
      <div className="base-acid-nozzle" />
    </div>
  );
}

function BioreactorCard(props: BioreactorCardProps) {
  const { t } = useTranslation();
  const SLOWEST_ROTOR_SPEED = 4;
  const FASTEST_ROTOR_SPEED = 0.5;
  const rotorVal = props.rotorVal ?? 0;
  const aeratorVal = props.aeratorVal ?? 0;
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
        width: 690,
        height: 670,
        transform: `translate(${props.translateX}px, ${props.translateY}px) scale(${props.scale})`,
        userSelect: "none",
      }}
      onMouseDown={(event) => {
        props.onMouseDown(event);
      }}
    >
      <div className="wrapper">
        <div className="cooling_water_supply_pipe"></div>
        <div className="cooling_water_discharge_pipe"></div>
        <div className="thermal_jacket"></div>
        <div className="thermal_jacket_lower_cap"></div>
        <div className="cooling_water_supply_pipe-text">
          {t("process.coolingSupply")}
        </div>
        <div className="cooling_water_discharge_pipe-text">
          {t("process.coolingDischarge")}
        </div>

        <div className="reaction_chamber"></div>

        <div className="agitator">
          <div className="agitator_stem"></div>
          <div
            className="agitator_blade0"
            style={{
              transform: "rotateY(0deg)",
              animation: `rotateProp0 ${rotorSpeed}s infinite`,
              animationTimingFunction: "linear",
            }}
          ></div>
          <div className="agitator_stem2"></div>
          <div
            className="agitator_blade90"
            style={{
              transform: "rotateY(90deg)",
              animation: `rotateProp90 ${rotorSpeed}s infinite`,
              animationTimingFunction: "linear",
            }}
          ></div>
        </div>
        <div className="agitator-text">{t("process.agitator")}</div>

        <div className="br-water-clip">
          <VesselWaterBody
            fillUnits={displayFillUnits}
            fillVelocity={waveVelocity}
            showSurface={displayFillUnits / VESSEL_MAX_FILL_UNITS < 0.98}
          />
        </div>

        <div className="sensor sensor1">
          <div className="sensor_base"></div>
          <div className="sensor_stem"></div>
          <div className="sensor_head"></div>
        </div>
        <div className="sensor sensor2">
          <div className="sensor_base"></div>
          <div className="sensor_stem"></div>
          <div className="sensor_head"></div>
        </div>
        <div className="sensor-text">{t("process.tempPhSensor")}</div>

        <BaseAcidSupplyPipe />
        <div className="base_acid_supply_pipe-text">
          {t("process.baseAcidSupply")}
        </div>

        <div className="aerator_submerged"></div>
        <div className="aerator_supply_pipe_h"></div>
        <div className="aerator_supply_pipe_v"></div>
        <div className="aerator_supply_pipe-text">{t("process.airSupply")}</div>
      </div>
    </div>
  );
}

BioreactorCard.displayName = "BioreactorCard";
export default BioreactorCard;
