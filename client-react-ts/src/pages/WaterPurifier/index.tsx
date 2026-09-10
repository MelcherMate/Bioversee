import { useEffect, useState } from "react";
import Canvas2 from "../../components/Canvas2";
import Chart from "../../components/Chart";
import Slider from "../../components/Slider";
import Switch from "../../components/Switch";
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

  return (
    <div className="container">
      <aside id="actuatorSide">
        <div className="switchBox">
          <h4 className="boxTitle">Swicth settings</h4>
          <Switch
            name="switchPump1"
            setVal={setPump1Val}
            val={pump1Val}
            label="Puffer to Active pump"
            user={user}
          />
          <Switch
            name="switchPump2"
            setVal={setPump2Val}
            val={pump2Val}
            label="Additive to Active pump"
            user={user}
          />
          <Switch
            name="switchPump3"
            setVal={setPump3Val}
            val={pump3Val}
            label="Active to Clean pump"
            user={user}
          />
        </div>
        <div className="sliderBox">
          <h4 className="boxTitle">Agitator settings</h4>
          <Slider
            name="agitator"
            setVal={setRotorVal}
            val={rotorVal}
            label="Agitator"
            user={user}
          />
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
          <Chart name="pufferwtlvl" label="Puffer Water Level" />
        </div>
      </aside>
    </div>
  );
}

export default WaterPurifier;
