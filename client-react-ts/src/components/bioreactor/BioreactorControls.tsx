import { useTranslation } from "react-i18next";
import ControlClock from "../ControlClock";
import Knob from "../Knob";
import Switch from "../Switch";
import { WaterLevelMeter } from "../Canvas/WaterLevelMeter";
import "../pressure-vessel/WaterLevelPanel.css";
import type { BioreactorController } from "./useBioreactorController";
import "./BioreactorControls.css";

type BioreactorControlsProps = {
  controller: BioreactorController;
  showClock?: boolean;
};

export default function BioreactorControls({
  controller,
  showClock = true,
}: BioreactorControlsProps) {
  const { t } = useTranslation();
  const { device, user, readOnly, equipment: eq, pumps, rotor, aerator, level } =
    controller;
  const showPumps = eq.thermal_jacket || eq.dosing;
  const showMotion = eq.stirrer || eq.aerator;

  return (
    <div className="controlPanel">
      {showClock ? <ControlClock /> : null}
      {showPumps ? (
        <section className="controlPanel__section controlPanel__section--pumps">
          <div className="br-pumps">
            <h4 className="br-pumps__title">{t("process.pumps")}</h4>
            <div className="br-pumps__grid">
              {eq.thermal_jacket ? (
                <>
                  <Switch
                    deviceId={device.id}
                    name="switchWarmWaterPump"
                    setVal={pumps.setWarm}
                    val={pumps.warm}
                    label={t("process.warmWater")}
                    user={user}
                    disabled={readOnly}
                  />
                  <Switch
                    deviceId={device.id}
                    name="switchColdWaterPump"
                    setVal={pumps.setCold}
                    val={pumps.cold}
                    label={t("process.coldWater")}
                    user={user}
                    disabled={readOnly}
                  />
                </>
              ) : null}
              {eq.dosing ? (
                <>
                  <Switch
                    deviceId={device.id}
                    name="switchAcidPump"
                    setVal={pumps.setAcid}
                    val={pumps.acid}
                    label={t("process.acid")}
                    user={user}
                    disabled={readOnly}
                  />
                  <Switch
                    deviceId={device.id}
                    name="switchBasePump"
                    setVal={pumps.setBase}
                    val={pumps.base}
                    label={t("process.base")}
                    user={user}
                    disabled={readOnly}
                  />
                </>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}
      {showMotion ? (
        <section className="controlPanel__section controlPanel__section--mixing">
          <div className="br-mixing">
            <h4 className="br-mixing__title">{t("process.motion")}</h4>
            <div className="br-mixing__grid">
              {eq.stirrer ? (
                <div className="br-mixing__card">
                  <Knob
                    deviceId={device.id}
                    name="rotor"
                    setVal={rotor.set}
                    val={rotor.value}
                    label={t("process.rotor")}
                    user={user}
                    min={0}
                    max={300}
                    unit="rpm"
                    disabled={rotor.disabled}
                  />
                </div>
              ) : null}
              {eq.aerator ? (
                <div className="br-mixing__card">
                  <Knob
                    deviceId={device.id}
                    name="aerator"
                    setVal={aerator.set}
                    val={aerator.value}
                    label={t("process.aerator")}
                    user={user}
                    unit="%"
                    step={10}
                    disabled={aerator.disabled}
                  />
                </div>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}
      <section className="controlPanel__section controlPanel__section--level">
        <WaterLevelMeter {...level} />
      </section>
    </div>
  );
}
