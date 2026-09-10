import { useEffect, useState } from "react";
import Canvas2 from "../../components/Canvas2";
import Chart from "../../components/Chart";
import Slider from "../../components/Slider";
import Switch from "../../components/Switch";
import { getMyDevice, type Device } from "../../lib/devices";
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
  const [canvasRef, canvasSize] = useDimensions();
  const [device, setDevice] = useState<Device | null>(null);
  const [cards, setCards] = useState<Card[]>([
    {
      id: "waterpurifier",
      coordinates: { x: 0, y: 0 },
      text: "",
    },
  ]);

  useEffect(() => {
    getMyDevice("water_purifier")
      .then(setDevice)
      .catch((error) => console.error(error));
  }, [user.id]);

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

  if (!device) {
    return (
      <div className="container">
        <div className="process-loading">Loading your water purifier…</div>
      </div>
    );
  }

  return (
    <div className="container">
      <aside id="actuatorSide">
        <div className="controlPanel">
          <section className="controlPanel__section">
            <h4 className="boxTitle">Pumps</h4>
            <Switch
              deviceId={device.id}
              name="switchPump1"
              setVal={setPump1Val}
              val={pump1Val}
              label="Puffer → Active"
              user={user}
            />
            <Switch
              deviceId={device.id}
              name="switchPump2"
              setVal={setPump2Val}
              val={pump2Val}
              label="Additive → Active"
              user={user}
            />
            <Switch
              deviceId={device.id}
              name="switchPump3"
              setVal={setPump3Val}
              val={pump3Val}
              label="Active → Clean"
              user={user}
            />
          </section>
          <section className="controlPanel__section">
            <h4 className="boxTitle">Motion</h4>
            <Slider
              deviceId={device.id}
              name="agitator"
              setVal={setRotorVal}
              val={rotorVal}
              label="Agitator"
              user={user}
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
            label="Puffer Water Level"
          />
        </div>
      </aside>
    </div>
  );
}

export default WaterPurifier;
