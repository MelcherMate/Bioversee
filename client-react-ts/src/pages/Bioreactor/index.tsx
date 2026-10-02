import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Canvas from "../../components/Canvas";
import Chart from "../../components/Chart/index";
import ControlClock from "../../components/ControlClock";
import Knob from "../../components/Knob";
import Switch from "../../components/Switch";
import EmptyDeviceState from "../../components/EmptyDeviceState";
import { getLatestSliderState, getLatestSwitchState, insertSwitchState } from "../../lib/actuators";
import { canOperateDevice } from "../../lib/devices";
import {
  defaultBioreactorGeometry,
  parseBioreactorConfig,
} from "../../lib/bioreactorGeometry";
import { useProcessDevice } from "../../lib/useProcessDevice";
import type { AppUser } from "../../lib/user";
import useDimensions from "../../utils/hooks/useDimensions";
import "./Bioreactor.css";

interface Card {
  id: string;
  coordinates: { x: number; y: number };
  text: string;
}

interface BioreactorProps {
  user: AppUser;
}

function Bioreactor({ user }: BioreactorProps) {
  const { t } = useTranslation();
  const [canvasRef, canvasSize] = useDimensions();
  const { device, ready } = useProcessDevice("bioreactor", user.id);
  const [cards, setCards] = useState<Card[]>([
    {
      id: "bioreactor",
      coordinates: { x: 0, y: 0 },
      text: "",
    },
  ]);

  useEffect(() => {
    setCards([
      {
        id: "bioreactor",
        coordinates: {
          x: canvasSize.width / 2 - 800 / 2,
          y: canvasSize.height / 2 - 750 / 2,
        },
        text: "",
      },
    ]);
  }, [canvasRef, canvasSize]);

  const [warmWVal, setWarmWVal] = useState(false);
  const [coldWVal, setColdWVal] = useState(false);
  const [acidVal, setAcidVal] = useState(false);
  const [baseVal, setBaseVal] = useState(false);
  const [rotorVal, setRotorVal] = useState(0);
  const [aeratorVal, setAeratorVal] = useState(0);
  const [waterLevelVal, setWaterLevelVal] = useState(92);
  const [pumpsHydrated, setPumpsHydrated] = useState(false);

  // Load actuator states before mounting animations so already-on pumps /
  // set levels start in their steady state instead of replaying fill.
  useEffect(() => {
    if (!device) {
      setPumpsHydrated(false);
      return;
    }

    let cancelled = false;
    setPumpsHydrated(false);

    Promise.all([
      getLatestSwitchState(device.id, "switchWarmWaterPump"),
      getLatestSwitchState(device.id, "switchColdWaterPump"),
      getLatestSwitchState(device.id, "switchAcidPump"),
      getLatestSwitchState(device.id, "switchBasePump"),
      getLatestSliderState(device.id, "water_level"),
      getLatestSliderState(device.id, "aerator"),
      getLatestSliderState(device.id, "rotor"),
    ])
      .then(([warm, cold, acid, base, waterLevel, aerator, rotor]) => {
        if (cancelled) return;
        setWarmWVal(Boolean(warm));
        setColdWVal(Boolean(cold));
        setAcidVal(Boolean(acid));
        setBaseVal(Boolean(base));
        setWaterLevelVal(Number(waterLevel));
        setAeratorVal(Number(aerator));
        setRotorVal(Number(rotor));
      })
      .catch((error) => console.log(error))
      .finally(() => {
        if (!cancelled) setPumpsHydrated(true);
      });

    return () => {
      cancelled = true;
    };
  }, [device?.id]);

  if (!ready) {
    return (
      <div className="container">
        <div className="process-loading">{t("process.loadingBioreactor")}</div>
      </div>
    );
  }

  if (!device) {
    return <EmptyDeviceState deviceType="bioreactor" />;
  }

  if (!pumpsHydrated) {
    return (
      <div className="container">
        <div className="process-loading">{t("process.loadingBioreactor")}</div>
      </div>
    );
  }

  const readOnly = !canOperateDevice(device.role);
  const config = parseBioreactorConfig(device.config);
  const eq = config.equipment;
  const jacketMode = eq.thermal_jacket
    ? warmWVal
      ? "warm"
      : coldWVal
        ? "cold"
        : "idle"
    : "idle";
  const doseMode = eq.dosing
    ? acidVal
      ? "acid"
      : baseVal
        ? "base"
        : "idle"
    : "idle";

  const showPumps =
    eq.thermal_jacket || eq.dosing;
  const showMotion = true; // water level always; rotor/aerator conditional inside

  const setWarmExclusive = (next: boolean) => {
    setWarmWVal(next);
    if (next && coldWVal) {
      setColdWVal(false);
      insertSwitchState(
        device.id,
        "switchColdWaterPump",
        false,
        user.id,
      ).catch((error) => console.log(error));
    }
  };

  const setColdExclusive = (next: boolean) => {
    setColdWVal(next);
    if (next && warmWVal) {
      setWarmWVal(false);
      insertSwitchState(
        device.id,
        "switchWarmWaterPump",
        false,
        user.id,
      ).catch((error) => console.log(error));
    }
  };

  const setAcidExclusive = (next: boolean) => {
    setAcidVal(next);
    if (next && baseVal) {
      setBaseVal(false);
      insertSwitchState(
        device.id,
        "switchBasePump",
        false,
        user.id,
      ).catch((error) => console.log(error));
    }
  };

  const setBaseExclusive = (next: boolean) => {
    setBaseVal(next);
    if (next && acidVal) {
      setAcidVal(false);
      insertSwitchState(
        device.id,
        "switchAcidPump",
        false,
        user.id,
      ).catch((error) => console.log(error));
    }
  };

  const showCharts =
    eq.sensor_temperature || eq.sensor_ph || eq.sensor_pressure;

  return (
    <div className="container">
      <aside id="actuatorSide">
        <div className="controlPanel">
          <ControlClock />
          {showPumps ? (
            <section className="controlPanel__section">
              <h4 className="boxTitle">{t("process.pumps")}</h4>
              <div className="controlPanel__switch-grid">
                {eq.thermal_jacket ? (
                  <>
                    <Switch
                      deviceId={device.id}
                      name="switchWarmWaterPump"
                      setVal={setWarmExclusive}
                      val={warmWVal}
                      label={t("process.warmWater")}
                      user={user}
                      disabled={readOnly}
                    />
                    <Switch
                      deviceId={device.id}
                      name="switchColdWaterPump"
                      setVal={setColdExclusive}
                      val={coldWVal}
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
                      setVal={setAcidExclusive}
                      val={acidVal}
                      label={t("process.acid")}
                      user={user}
                      disabled={readOnly}
                    />
                    <Switch
                      deviceId={device.id}
                      name="switchBasePump"
                      setVal={setBaseExclusive}
                      val={baseVal}
                      label={t("process.base")}
                      user={user}
                      disabled={readOnly}
                    />
                  </>
                ) : null}
              </div>
            </section>
          ) : null}
          {showMotion ? (
            <section className="controlPanel__section">
              <h4 className="boxTitle">{t("process.motion")}</h4>
              <div className="controlPanel__knob-grid">
                {eq.stirrer ? (
                  <Knob
                    deviceId={device.id}
                    name="rotor"
                    setVal={setRotorVal}
                    val={rotorVal}
                    label={t("process.rotor")}
                    user={user}
                    min={0}
                    max={300}
                    unit="rpm"
                    disabled={readOnly}
                  />
                ) : null}
                <Knob
                  deviceId={device.id}
                  name="water_level"
                  setVal={setWaterLevelVal}
                  val={waterLevelVal}
                  label={t("process.waterLevel")}
                  user={user}
                  unit="%"
                  step={10}
                  disabled={readOnly}
                />
                {eq.aerator ? (
                  <Knob
                    deviceId={device.id}
                    name="aerator"
                    setVal={setAeratorVal}
                    val={aeratorVal}
                    label={t("process.aerator")}
                    user={user}
                    unit="%"
                    step={10}
                    disabled={readOnly}
                  />
                ) : null}
              </div>
            </section>
          ) : null}
        </div>
      </aside>
      <main id="reactorBox" ref={canvasRef}>
        <Canvas
          cards={cards}
          rotorVal={eq.stirrer ? rotorVal : 0}
          aeratorVal={eq.aerator ? aeratorVal : 0}
          waterLevelVal={waterLevelVal}
          jacketMode={jacketMode}
          doseMode={doseMode}
          equipment={eq}
          geometry={defaultBioreactorGeometry()}
        />
      </main>
      {showCharts ? (
        <aside id="sensorSide">
          <div className="chartBox">
            {eq.sensor_temperature ? (
              <Chart
                deviceId={device.id}
                name="temperature"
                label={t("process.temperature")}
              />
            ) : null}
            {eq.sensor_ph ? (
              <Chart deviceId={device.id} name="ph" label={t("process.ph")} />
            ) : null}
            {eq.sensor_pressure ? (
              <Chart
                deviceId={device.id}
                name="pressure"
                label={t("process.pressure")}
                unit="psi"
              />
            ) : null}
          </div>
        </aside>
      ) : null}
    </div>
  );
}

export default Bioreactor;
