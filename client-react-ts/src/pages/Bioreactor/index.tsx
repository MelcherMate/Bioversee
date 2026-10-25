import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Canvas from "../../components/Canvas";
import EmptyDeviceState from "../../components/EmptyDeviceState";
import { ToastStack, useToasts } from "../../components/Toast";
import BioreactorCharts, {
  hasBioreactorCharts,
} from "../../components/bioreactor/BioreactorCharts";
import BioreactorControls from "../../components/bioreactor/BioreactorControls";
import { useBioreactorController } from "../../components/bioreactor/useBioreactorController";
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
  const { toasts, push, dismiss } = useToasts();
  const controller = useBioreactorController(device, user, push);
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

  if (!controller) {
    return (
      <div className="container">
        <div className="process-loading">{t("process.loadingBioreactor")}</div>
      </div>
    );
  }

  return (
    <div className="container">
      <ToastStack toasts={toasts} onDismiss={dismiss} />
      <aside id="actuatorSide">
        <BioreactorControls controller={controller} />
      </aside>
      <main id="reactorBox" ref={canvasRef}>
        <Canvas cards={cards} {...controller.vessel} />
      </main>
      {hasBioreactorCharts(controller.equipment) ? (
        <aside id="sensorSide">
          <BioreactorCharts
            deviceId={device.id}
            equipment={controller.equipment}
          />
        </aside>
      ) : null}
    </div>
  );
}

export default Bioreactor;
