import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Canvas from "../../components/Canvas";
import Chart from "../../components/Chart/index";
import Slider from "../../components/Slider";
import Switch from "../../components/Switch";
import { getDeviceForPage, type Device } from "../../lib/devices";
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
  const [searchParams] = useSearchParams();
  const preferredDeviceId = searchParams.get("device");
  const [canvasRef, canvasSize] = useDimensions();
  const [device, setDevice] = useState<Device | null>(null);
  const [cards, setCards] = useState<Card[]>([
    {
      id: "bioreactor",
      coordinates: { x: 0, y: 0 },
      text: "",
    },
  ]);

  useEffect(() => {
    getDeviceForPage("bioreactor", preferredDeviceId)
      .then(setDevice)
      .catch((error) => console.error(error));
  }, [user.id, preferredDeviceId]);

  useEffect(() => {
    setCards([
      {
        id: "bioreactor",
        coordinates: {
          x: canvasSize.width / 2 - 690 / 2,
          y: canvasSize.height / 2 - 670 / 2,
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

  if (!device) {
    return (
      <div className="container">
        <div className="process-loading">Loading your bioreactor…</div>
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
              name="switchWarmWaterPump"
              setVal={setWarmWVal}
              val={warmWVal}
              label="Warm water"
              user={user}
            />
            <Switch
              deviceId={device.id}
              name="switchColdWaterPump"
              setVal={setColdWVal}
              val={coldWVal}
              label="Cold water"
              user={user}
            />
            <Switch
              deviceId={device.id}
              name="switchAcidPump"
              setVal={setAcidVal}
              val={acidVal}
              label="Acid"
              user={user}
            />
            <Switch
              deviceId={device.id}
              name="switchBasePump"
              setVal={setBaseVal}
              val={baseVal}
              label="Base"
              user={user}
            />
          </section>
          <section className="controlPanel__section">
            <h4 className="boxTitle">Motion</h4>
            <Slider
              deviceId={device.id}
              name="rotor"
              setVal={setRotorVal}
              val={rotorVal}
              label="Rotor"
              user={user}
            />
            <Slider
              deviceId={device.id}
              name="aerator"
              setVal={setAeratorVal}
              val={aeratorVal}
              label="Aerator"
              user={user}
            />
          </section>
        </div>
      </aside>
      <main id="reactorBox" ref={canvasRef}>
        <Canvas cards={cards} rotorVal={rotorVal} />
      </main>
      <aside id="sensorSide">
        <div className="chartBox">
          <Chart
            deviceId={device.id}
            name="temperature"
            label="Temperature"
          />
          <Chart deviceId={device.id} name="ph" label="pH value" />
        </div>
      </aside>
    </div>
  );
}

export default Bioreactor;
