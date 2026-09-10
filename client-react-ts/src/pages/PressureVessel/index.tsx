import { useState } from "react";
import { VESSEL_MAX_FILL_UNITS } from "../../components/pressure-vessel/constants";
import { PressureVesselDrawing } from "../../components/pressure-vessel/PressureVesselDrawing";
import { useDrainAnimation } from "../../components/pressure-vessel/useDrainAnimation";
import { useInletFillAnimation } from "../../components/pressure-vessel/useInletFillAnimation";
import { WaterLevelPanel } from "../../components/pressure-vessel/WaterLevelPanel";
import "../Bioreactor/Bioreactor.css";
import "./ProcessScene.css";

function PressureVessel() {
  const [fillUnits, setFillUnits] = useState(
    Math.round(VESSEL_MAX_FILL_UNITS / 2),
  );
  const [isFillHeld, setIsFillHeld] = useState(false);
  const [isDrainHeld, setIsDrainHeld] = useState(false);
  const inletFill = useInletFillAnimation(fillUnits, setFillUnits, isFillHeld);
  const drainAnim = useDrainAnimation(fillUnits, setFillUnits, isDrainHeld);
  const panelFillUnits =
    drainAnim.isLevelFrozen && drainAnim.frozenFillUnits != null
      ? drainAnim.frozenFillUnits
      : fillUnits;

  return (
    <div className="container">
      <aside id="actuatorSide">
        <WaterLevelPanel
          fillUnits={panelFillUnits}
          onChange={setFillUnits}
          isFillHeld={isFillHeld}
          onFillHoldChange={setIsFillHeld}
          fillDisabled={inletFill.isAnimating && !isFillHeld}
          isDrainHeld={isDrainHeld}
          onDrainHoldChange={setIsDrainHeld}
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
