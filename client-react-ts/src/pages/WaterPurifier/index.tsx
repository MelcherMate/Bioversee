import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Canvas2 from "../../components/Canvas2";
import Chart from "../../components/Chart";
import Slider from "../../components/Slider";
import Switch from "../../components/Switch";
import EmptyDeviceState from "../../components/EmptyDeviceState";
import { canOperateDevice } from "../../lib/devices";
import { useProcessDevice } from "../../lib/useProcessDevice";
import type { AppUser } from "../../lib/user";
import useDimensions from "../../utils/hooks/useDimensions";
import "./WaterPurifier.css";

interface Card {
  id: string;
  coordinates: { x: number; y: number };
  text: string;
}

interface WaterpurifierProps {
  user: AppUser;
}

function WaterPurifier({ user }: WaterpurifierProps) {
  const { t } = useTranslation();
  const [canvasRef, canvasSize] = useDimensions();
  const { device, ready } = useProcessDevice("water_purifier", user.id);
  const [cards, setCards] = useState<Card[]>([
    {
      id: "waterpurifier",
      coordinates: { x: 0, y: 0 },
      text: "",
    },
  ]);

  useEffect(() => {
    setCards([
      {
        id: "waterpurifier",
        coordinates: {
          x: canvasSize.width / 2 - 690 / 2,
          y: canvasSize.height / 2 - 670 / 2,
        },
        text: "",
      },
    ]);
  }, [canvasRef, canvasSize]);

  const [pump1Val, setPump1Val] = useState(false);
  const [pump2Val, setPump2Val] = useState(false);
  const [pump3Val, setPump3Val] = useState(false);
  const [rotorVal, setRotorVal] = useState(0);

  if (!ready) {
    return (
      <div className="container">
        <div className="process-loading">{t("process.loadingWaterPurifier")}</div>
      </div>
    );
  }

  if (!device) {
    return <EmptyDeviceState processLabel={t("devices.water_purifier")} />;
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
              name="switchPump1"
              setVal={setPump1Val}
              val={pump1Val}
              label={t("process.pumpPufferActive")}
              user={user}
              disabled={readOnly}
            />
            <Switch
              deviceId={device.id}
              name="switchPump2"
              setVal={setPump2Val}
              val={pump2Val}
              label={t("process.pumpAdditiveActive")}
              user={user}
              disabled={readOnly}
            />
            <Switch
              deviceId={device.id}
              name="switchPump3"
              setVal={setPump3Val}
              val={pump3Val}
              label={t("process.pumpActiveClean")}
              user={user}
              disabled={readOnly}
            />
          </section>
          <section className="controlPanel__section">
            <h4 className="boxTitle">{t("process.motion")}</h4>
            <Slider
              deviceId={device.id}
              name="agitator"
              setVal={setRotorVal}
              val={rotorVal}
              label={t("process.agitator")}
              user={user}
              disabled={readOnly}
            />
          </section>
        </div>
      </aside>
      <main id="waterpurifierBox" ref={canvasRef}>
        <Canvas2
          cards={cards}
          pump1Val={pump1Val}
          pump2Val={pump2Val}
          pump3Val={pump3Val}
        />
      </main>
      <aside id="sensorSide">
        <div className="chartBox">
          <Chart
            deviceId={device.id}
            name="pufferwtlvl"
            label={t("process.pufferLevel")}
          />
        </div>
      </aside>
    </div>
  );
}

export default WaterPurifier;
