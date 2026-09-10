import { useEffect, useRef, useState } from "react";
import {
  fillUnitsToPercent,
  VESSEL_MAX_FILL_UNITS,
} from "../../components/pressure-vessel/constants";
import { PressureVesselDrawing } from "../../components/pressure-vessel/PressureVesselDrawing";
import { useDrainAnimation } from "../../components/pressure-vessel/useDrainAnimation";
import { useInletFillAnimation } from "../../components/pressure-vessel/useInletFillAnimation";
import { WaterLevelPanel } from "../../components/pressure-vessel/WaterLevelPanel";
import {
  getLatestSliderState,
  insertSensorReading,
  insertSliderState,
} from "../../lib/actuators";
import type { AppUser } from "../../lib/user";
import "../Bioreactor/Bioreactor.css";
import "./ProcessScene.css";

const VESSEL_LEVEL_KEY = "vesselLevel";

type PressureVesselProps = {
  user: AppUser;
};

function PressureVessel({ user }: PressureVesselProps) {
  const [fillUnits, setFillUnits] = useState(
    Math.round(VESSEL_MAX_FILL_UNITS / 2),
  );
  const [isFillHeld, setIsFillHeld] = useState(false);
  const [isDrainHeld, setIsDrainHeld] = useState(false);
  const fillUnitsRef = useRef(fillUnits);
  const inletFill = useInletFillAnimation(fillUnits, setFillUnits, isFillHeld);
  const drainAnim = useDrainAnimation(fillUnits, setFillUnits, isDrainHeld);
  const panelFillUnits =
    drainAnim.isLevelFrozen && drainAnim.frozenFillUnits != null
      ? drainAnim.frozenFillUnits
      : fillUnits;

  fillUnitsRef.current = fillUnits;

  const persistLevel = (units: number) => {
    const percent = fillUnitsToPercent(units);
    insertSliderState(VESSEL_LEVEL_KEY, percent, user.id).catch(console.error);
    insertSensorReading(VESSEL_LEVEL_KEY, percent).catch(console.error);
  };

  useEffect(() => {
    const pull = () => {
      if (
        isFillHeld ||
        isDrainHeld ||
        inletFill.isAnimating ||
        drainAnim.isAnimating
      ) {
        return;
      }
      getLatestSliderState(VESSEL_LEVEL_KEY)
        .then((percent) => {
          const next = Math.round(
            (Math.min(100, Math.max(0, percent)) / 100) * VESSEL_MAX_FILL_UNITS,
          );
          setFillUnits(next);
        })
        .catch(console.error);
    };

    pull();
    const interval = setInterval(pull, 4000);
    return () => clearInterval(interval);
  }, [
    isFillHeld,
    isDrainHeld,
    inletFill.isAnimating,
    drainAnim.isAnimating,
  ]);

  const onLevelChange = (units: number) => {
    setFillUnits(units);
  };

  const onLevelCommit = (units: number) => {
    persistLevel(units);
  };

  const onFillHoldChange = (held: boolean) => {
    setIsFillHeld(held);
    if (!held) persistLevel(fillUnitsRef.current);
  };

  const onDrainHoldChange = (held: boolean) => {
    setIsDrainHeld(held);
    if (!held) persistLevel(fillUnitsRef.current);
  };

  return (
    <div className="container">
      <aside id="actuatorSide">
        <WaterLevelPanel
          fillUnits={panelFillUnits}
          onChange={onLevelChange}
          onCommit={onLevelCommit}
          isFillHeld={isFillHeld}
          onFillHoldChange={onFillHoldChange}
          fillDisabled={inletFill.isAnimating && !isFillHeld}
          isDrainHeld={isDrainHeld}
          onDrainHoldChange={onDrainHoldChange}
          drainDisabled={drainAnim.isAnimating && !isDrainHeld}
        />
      </aside>
      <main className="process-scene" id="pressureVesselBox">
        <div className="process-scene__stage">
          <PressureVesselDrawing
            fillUnits={fillUnits}
            inletFill={inletFill}
            drainAnim={drainAnim}
          />
        </div>
      </main>
    </div>
  );
}

export default PressureVessel;
