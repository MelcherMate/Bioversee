import { useState } from "react";
import { MbrControlPanel } from "../../components/membrane-bioreactor/MbrControlPanel";
import { MbrDrawing } from "../../components/membrane-bioreactor/MbrDrawing";
import {
  MBR_DEFAULT_AERATION_LEVEL,
  mbrFixedFillUnits,
  type MbrAerationLevel,
} from "../../components/membrane-bioreactor/constants";
import { useMbrFlowAnimation } from "../../components/membrane-bioreactor/useMbrFlowAnimation";
import "../Bioreactor/Bioreactor.css";
import "../PressureVessel/ProcessScene.css";

const FIXED_FILL_UNITS = mbrFixedFillUnits();

function MembraneBioreactor() {
  const [isFlowOn, setIsFlowOn] = useState(false);
  const [isAerationOn, setIsAerationOn] = useState(false);
  const [aerationLevel, setAerationLevel] = useState<MbrAerationLevel>(
    MBR_DEFAULT_AERATION_LEVEL,
  );
  const flow = useMbrFlowAnimation(isFlowOn);

  return (
    <div className="container">
      <aside id="actuatorSide">
        <MbrControlPanel
          isFlowOn={isFlowOn}
          onFlowChange={setIsFlowOn}
          isAerationOn={isAerationOn}
          onAerationChange={setIsAerationOn}
          aerationLevel={aerationLevel}
          onAerationLevelChange={setAerationLevel}
          disabled={flow.isAnimating && !isFlowOn}
        />
      </aside>
      <main className="process-scene" id="membraneBioreactorBox">
        <div className="process-scene__stage">
          <MbrDrawing
            fillUnits={FIXED_FILL_UNITS}
            flow={flow}
            isAerationOn={isAerationOn}
            aerationLevel={aerationLevel}
          />
        </div>
      </main>
    </div>
  );
}

export default MembraneBioreactor;
