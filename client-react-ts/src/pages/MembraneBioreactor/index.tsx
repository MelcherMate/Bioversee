import { useEffect, useState } from "react";
import { MbrControlPanel } from "../../components/membrane-bioreactor/MbrControlPanel";
import { MbrDrawing } from "../../components/membrane-bioreactor/MbrDrawing";
import {
  MBR_AERATION_LEVELS,
  MBR_DEFAULT_AERATION_LEVEL,
  mbrFixedFillUnits,
  type MbrAerationLevel,
} from "../../components/membrane-bioreactor/constants";
import { useMbrFlowAnimation } from "../../components/membrane-bioreactor/useMbrFlowAnimation";
import {
  getLatestSliderState,
  getLatestSwitchState,
  insertSliderState,
  insertSwitchState,
} from "../../lib/actuators";
import type { AppUser } from "../../lib/user";
import "../Bioreactor/Bioreactor.css";
import "../PressureVessel/ProcessScene.css";

const FIXED_FILL_UNITS = mbrFixedFillUnits();
const FLOW_KEY = "mbrFlow";
const AERATION_KEY = "mbrAeration";
const LEVEL_KEY = "mbrAerationLevel";

type MembraneBioreactorProps = {
  user: AppUser;
};

function snapAerationLevel(value: number): MbrAerationLevel {
  let best: MbrAerationLevel = MBR_DEFAULT_AERATION_LEVEL;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const level of MBR_AERATION_LEVELS) {
    const dist = Math.abs(level - value);
    if (dist < bestDist) {
      best = level;
      bestDist = dist;
    }
  }
  return best;
}

function MembraneBioreactor({ user }: MembraneBioreactorProps) {
  const [isFlowOn, setIsFlowOn] = useState(false);
  const [isAerationOn, setIsAerationOn] = useState(false);
  const [aerationLevel, setAerationLevel] = useState<MbrAerationLevel>(
    MBR_DEFAULT_AERATION_LEVEL,
  );
  const flow = useMbrFlowAnimation(isFlowOn);

  useEffect(() => {
    const pull = () => {
      getLatestSwitchState(FLOW_KEY)
        .then(setIsFlowOn)
        .catch(console.error);
      getLatestSwitchState(AERATION_KEY)
        .then(setIsAerationOn)
        .catch(console.error);
      getLatestSliderState(LEVEL_KEY)
        .then((value) => setAerationLevel(snapAerationLevel(value)))
        .catch(console.error);
    };

    pull();
    const interval = setInterval(pull, 4000);
    return () => clearInterval(interval);
  }, []);

  const onFlowChange = (on: boolean) => {
    setIsFlowOn(on);
    insertSwitchState(FLOW_KEY, on, user.id).catch(console.error);
  };

  const onAerationChange = (on: boolean) => {
    setIsAerationOn(on);
    insertSwitchState(AERATION_KEY, on, user.id).catch(console.error);
  };

  const onAerationLevelChange = (level: MbrAerationLevel) => {
    setAerationLevel(level);
    insertSliderState(LEVEL_KEY, level, user.id).catch(console.error);
  };

  return (
    <div className="container">
      <aside id="actuatorSide">
        <MbrControlPanel
          isFlowOn={isFlowOn}
          onFlowChange={onFlowChange}
          isAerationOn={isAerationOn}
          onAerationChange={onAerationChange}
          aerationLevel={aerationLevel}
          onAerationLevelChange={onAerationLevelChange}
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
