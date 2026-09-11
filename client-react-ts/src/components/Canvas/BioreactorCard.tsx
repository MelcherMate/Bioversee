import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { VESSEL_MAX_FILL_UNITS } from "../pressure-vessel/constants";
import { VesselWaterBody } from "../pressure-vessel/VesselWaterBody";
import "./Bioreactor.css";

/** Fixed fill matching the old chamber liquid footprint. */
const BIOREACTOR_FILL_UNITS = VESSEL_MAX_FILL_UNITS * 0.92;

type BioreactorCardProps = {
  rotorVal?: number;
  aeratorVal?: number;
  translateX: number;
  translateY: number;
  scale: number;
  onMouseDown: (event: React.MouseEvent) => void;
};

function BioreactorCard(props: BioreactorCardProps) {
  const { t } = useTranslation();
  const SLOWEST_ROTOR_SPEED = 4;
  const FASTEST_ROTOR_SPEED = 0.5;
  const rotorVal = props.rotorVal ?? 0;
  const aeratorVal = props.aeratorVal ?? 0;

  const [rotorSpeed, setRotorSpeed] = useState(0);

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

  // Same scale as pressure-vessel wave intensity (~0–40).
  const waveVelocity =
    (aeratorVal / 100) * 36 + (rotorVal / 100) * 8;

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

        <div className="br-water-clip">
          <VesselWaterBody
            fillUnits={BIOREACTOR_FILL_UNITS}
            fillVelocity={waveVelocity}
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

        <div className="base_acid_supply_pipe_h"></div>
        <div className="base_acid_supply_pipe_v"></div>
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
