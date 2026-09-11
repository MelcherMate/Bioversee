import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Canvas from "../../components/Canvas";
import Chart from "../../components/Chart/index";
import Slider from "../../components/Slider";
import Switch from "../../components/Switch";
import EmptyDeviceState from "../../components/EmptyDeviceState";
import { canOperateDevice } from "../../lib/devices";
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

  const readOnly = !canOperateDevice(device.role);

  return (
    <div className="container">
      <aside id="actuatorSide">
        <div className="controlPanel">
          <section className="controlPanel__section">
            <h4 className="boxTitle">{t("process.pumps")}</h4>
            <Switch
              deviceId={device.id}
              name="switchWarmWaterPump"
              setVal={setWarmWVal}
              val={warmWVal}
              label={t("process.warmWater")}
              user={user}
              disabled={readOnly}
            />
            <Switch
              deviceId={device.id}
              name="switchColdWaterPump"
              setVal={setColdWVal}
              val={coldWVal}
              label={t("process.coldWater")}
              user={user}
              disabled={readOnly}
            />
            <Switch
              deviceId={device.id}
              name="switchAcidPump"
              setVal={setAcidVal}
              val={acidVal}
              label={t("process.acid")}
              user={user}
              disabled={readOnly}
            />
            <Switch
              deviceId={device.id}
              name="switchBasePump"
              setVal={setBaseVal}
              val={baseVal}
              label={t("process.base")}
              user={user}
              disabled={readOnly}
            />
          </section>
          <section className="controlPanel__section">
            <h4 className="boxTitle">{t("process.motion")}</h4>
            <Slider
              deviceId={device.id}
              name="rotor"
              setVal={setRotorVal}
              val={rotorVal}
              label={t("process.rotor")}
              user={user}
              disabled={readOnly}
            />
            <Slider
              deviceId={device.id}
              name="water_level"
              setVal={setWaterLevelVal}
              val={waterLevelVal}
              label={t("process.waterLevel")}
              user={user}
              disabled={readOnly}
            />
            <Slider
              deviceId={device.id}
              name="aerator"
              setVal={setAeratorVal}
              val={aeratorVal}
              label={t("process.aerator")}
              user={user}
              disabled={readOnly}
            />
          </section>
        </div>
      </aside>
      <main id="reactorBox" ref={canvasRef}>
        <Canvas
          cards={cards}
          rotorVal={rotorVal}
          aeratorVal={aeratorVal}
          waterLevelVal={waterLevelVal}
        />
      </main>
      <aside id="sensorSide">
        <div className="chartBox">
          <Chart
            deviceId={device.id}
            name="temperature"
            label={t("process.temperature")}
          />
          <Chart deviceId={device.id} name="ph" label={t("process.ph")} />
          <Chart
            deviceId={device.id}
            name="pressure"
            label={t("process.pressure")}
            unit="psi"
          />
        </div>
      </aside>
    </div>
  );
}

export default Bioreactor;
