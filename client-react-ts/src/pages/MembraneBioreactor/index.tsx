import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
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
import { canOperateDevice } from "../../lib/devices";
import { useProcessDevice } from "../../lib/useProcessDevice";
import type { AppUser } from "../../lib/user";
import EmptyDeviceState from "../../components/EmptyDeviceState";
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
  const { t } = useTranslation();
  const { device, ready } = useProcessDevice("membrane_bioreactor", user.id);
  const [isFlowOn, setIsFlowOn] = useState(false);
  const [isAerationOn, setIsAerationOn] = useState(false);
  const [aerationLevel, setAerationLevel] = useState<MbrAerationLevel>(
    MBR_DEFAULT_AERATION_LEVEL,
  );
  const flow = useMbrFlowAnimation(isFlowOn);

  useEffect(() => {
    if (!device) return;

    const pull = () => {
      getLatestSwitchState(device.id, FLOW_KEY)
        .then(setIsFlowOn)
        .catch(console.error);
      getLatestSwitchState(device.id, AERATION_KEY)
        .then(setIsAerationOn)
        .catch(console.error);
      getLatestSliderState(device.id, LEVEL_KEY)
        .then((value) => setAerationLevel(snapAerationLevel(value)))
        .catch(console.error);
    };

    pull();
    const interval = setInterval(pull, 4000);
    return () => clearInterval(interval);
  }, [device]);

  const onFlowChange = (on: boolean) => {
    if (!device || !canOperateDevice(device.role)) return;
    setIsFlowOn(on);
    insertSwitchState(device.id, FLOW_KEY, on, user.id).catch(console.error);
  };

  const onAerationChange = (on: boolean) => {
    if (!device || !canOperateDevice(device.role)) return;
    setIsAerationOn(on);
    insertSwitchState(device.id, AERATION_KEY, on, user.id).catch(
      console.error,
    );
  };

  const onAerationLevelChange = (level: MbrAerationLevel) => {
    if (!device || !canOperateDevice(device.role)) return;
    setAerationLevel(level);
    insertSliderState(device.id, LEVEL_KEY, level, user.id).catch(
      console.error,
    );
  };

  if (!ready) {
    return (
      <div className="container">
        <div className="process-loading">{t("process.loadingMbr")}</div>
      </div>
    );
  }

  if (!device) {
    return <EmptyDeviceState processLabel={t("devices.membrane_bioreactor")} />;
  }

  const readOnly = !canOperateDevice(device.role);

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
          disabled={readOnly || (flow.isAnimating && !isFlowOn)}
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
