import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import "./Bioreactor.css";

function BioreactorCard(props, key) {
  const { t } = useTranslation();
  const SLOWEST_ROTOR_SPEED = 4;
  const FASTEST_ROTOR_SPEED = 0.5;

  const [rotorSpeed, setRotorSpeed] = useState(0);

  useEffect(() => {
    if (props.rotorVal == 100) {
      // console.log("top boundry");
      setRotorSpeed(0.5);
    } else if (props.rotorVal == 0) {
      // console.log("bottom boundry");
      setRotorSpeed(0);
    } else {
      // console.log("normal values");
      setRotorSpeed(
        SLOWEST_ROTOR_SPEED -
          ((SLOWEST_ROTOR_SPEED - FASTEST_ROTOR_SPEED) / 99) *
            (props.rotorVal - 1)
      );
    }
  }, [props.rotorVal]);

  return (
    <>
      <div
        key={key}
        style={{
          position: "absolute",
          width: 690,
          height: 670,
          transform: `translate(${props.translateX}px, ${props.translateY}px) scale(${props.scale})`,
          // border: "1px solid red",
          // cursor: "move",
          userSelect: "none",
        }}
        onMouseDown={(event) => {
          props.onMouseDown(event);
        }}
      >
        <div className="wrapper">
          {/* <!--   TEMPERATURE CONTROL WATER SYSTEM --> */}
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
          {/* <!--   REACTOR BODY --> */}
          <div className="reaction_chamber"></div>
          {/* <!--   WATER WAVE --> */}
          <div className="reaction_medium_waves">
            <svg
              className="wave"
              version="1.1"
              xmlns="http://www.w3.org/2000/svg"
              xmlnsXlink="http://www.w3.org/1999/xlink"
              x="0px"
              y="0px"
              width="100%"
              height="100%"
              viewBox="0 0 1600 900"
            >
              <defs>
                <linearGradient id="bg" x2="0%" y2="100%">
                  <stop offset="0%" style={{ stopColor: "#7b9fe2" }}></stop>
                  <stop
                    offset="100%"
                    style={{ stopColor: "rgba(38, 89, 190, 0.06)" }}
                  ></stop>
                </linearGradient>
                <path
                  id="wave"
                  fill="url(#bg)"
                  d="M-363.852,502.589c0,0,236.988-41.997,505.475,0
  s371.981,38.998,575.971,0s293.985-39.278,505.474,5.859s493.475,48.368,716.963-4.995v560.106H-363.852V502.589z"
                />
              </defs>
              <g>
                <use xlinkHref="#wave" opacity=".3">
                  <animateTransform
                    attributeName="transform"
                    attributeType="XML"
                    type="translate"
                    dur="4s"
                    calcMode="spline"
                    values="270 230; -334 180; 270 230"
                    keyTimes="0; .5; 1"
                    keySplines="0.42, 0, 0.58, 1.0;0.42, 0, 0.58, 1.0"
                    repeatCount="indefinite"
                  />
                </use>
                <use xlinkHref="#wave" opacity=".6">
                  <animateTransform
                    attributeName="transform"
                    attributeType="XML"
                    type="translate"
                    dur="2s"
                    calcMode="spline"
                    values="-270 230;243 220;-270 230"
                    keyTimes="0; .6; 1"
                    keySplines="0.42, 0, 0.58, 1.0;0.42, 0, 0.58, 1.0"
                    repeatCount="indefinite"
                  />
                </use>
                <use xlinkHref="#wave" opacity=".9">
                  <animateTransform
                    attributeName="transform"
                    attributeType="XML"
                    type="translate"
                    dur="1s"
                    calcMode="spline"
                    values="0 230;-140 200;0 230"
                    keyTimes="0; .4; 1"
                    keySplines="0.42, 0, 0.58, 1.0;0.42, 0, 0.58, 1.0"
                    repeatCount="indefinite"
                  />
                </use>
              </g>
            </svg>
          </div>
          <div className="reaction_medium"></div>
          <div className="reaction_medium_lower_cap"></div>
          {/* <!--   SENSORS --> */}
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
          {/* <!--   AGIGATOR --> */}
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
          {/* <!--   BASE-ACID SUPPLY PIPE --> */}
          <div className="base_acid_supply_pipe_h"></div>
          <div className="base_acid_supply_pipe_v"></div>
          <div className="base_acid_supply_pipe-text">
            {t("process.baseAcidSupply")}
          </div>
          {/* <!--   AERATOR SUPPLY PIPE --> */}
          <div className="aerator_submerged"></div>
          <div className="aerator_supply_pipe_h"></div>
          <div className="aerator_supply_pipe_v"></div>
          <div className="aerator_supply_pipe-text">{t("process.airSupply")}</div>
          {/* <!--   BUBBLES --> */}
          <div className="bubble_frame">
            <div className="bubble-1 bubble-container anim bubble-animation-x">
              <div className="bubble bubble-animation-y"></div>
            </div>
            <div className="bubble-2 bubble-container anim bubble-animation-x">
              <div className="bubble bubble-animation-y"></div>
            </div>
            <div className="bubble-3 bubble-container anim bubble-animation-x">
              <div className="bubble bubble-animation-y"></div>
            </div>
            <div className="bubble-4 bubble-container anim bubble-animation-x">
              <div className="bubble bubble-animation-y"></div>
            </div>
            <div className="bubble-5 bubble-container anim bubble-animation-x">
              <div className="bubble bubble-animation-y"></div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

BioreactorCard.displayName = "BioreactorCard";
export default BioreactorCard;
