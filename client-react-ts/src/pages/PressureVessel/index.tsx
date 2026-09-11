import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
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
import { canOperateDevice } from "../../lib/devices";
import { useProcessDevice } from "../../lib/useProcessDevice";
import type { AppUser } from "../../lib/user";
import EmptyDeviceState from "../../components/EmptyDeviceState";
import "../Bioreactor/Bioreactor.css";
import "./ProcessScene.css";

const VESSEL_LEVEL_KEY = "vesselLevel";

type PressureVesselProps = {
  user: AppUser;
};

function PressureVessel({ user }: PressureVesselProps) {
  const { t } = useTranslation();
  const { device, ready } = useProcessDevice("pressure_vessel", user.id);
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
    if (!device || !canOperateDevice(device.role)) return;
    const percent = fillUnitsToPercent(units);
    insertSliderState(
      device.id,
      VESSEL_LEVEL_KEY,
      percent,
      user.id,
    ).catch(console.error);
    insertSensorReading(
      device.id,
      VESSEL_LEVEL_KEY,
      percent,
      user.id,
    ).catch(console.error);
  };

  useEffect(() => {
    if (!device) return;

    const pull = () => {
      if (
        isFillHeld ||
        isDrainHeld ||
        inletFill.isAnimating ||
        drainAnim.isAnimating
      ) {
        return;
      }
      getLatestSliderState(device.id, VESSEL_LEVEL_KEY)
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
    device,
    isFillHeld,
    isDrainHeld,
    inletFill.isAnimating,
    drainAnim.isAnimating,
  ]);

  const onLevelChange = (units: number) => {
    if (!device || !canOperateDevice(device.role)) return;
    setFillUnits(units);
  };

  const onLevelCommit = (units: number) => {
    if (!device || !canOperateDevice(device.role)) return;
    persistLevel(units);
  };

  const onFillHoldChange = (held: boolean) => {
    if (!device || !canOperateDevice(device.role)) return;
    setIsFillHeld(held);
    if (!held) persistLevel(fillUnitsRef.current);
  };

  const onDrainHoldChange = (held: boolean) => {
    if (!device || !canOperateDevice(device.role)) return;
    setIsDrainHeld(held);
    if (!held) persistLevel(fillUnitsRef.current);
  };

  if (!ready) {
    return (
      <div className="container">
        <div className="process-loading">{t("process.loadingPressureVessel")}</div>
      </div>
    );
  }

  if (!device) {
    return <EmptyDeviceState deviceType="pressure_vessel" />;
  }

  const readOnly = !canOperateDevice(device.role);

  return (
    <div className="container">
      <aside id="actuatorSide">
        <WaterLevelPanel
          fillUnits={panelFillUnits}
          onChange={onLevelChange}
          onCommit={onLevelCommit}
          isFillHeld={isFillHeld}
          onFillHoldChange={onFillHoldChange}
          fillDisabled={readOnly || (inletFill.isAnimating && !isFillHeld)}
          isDrainHeld={isDrainHeld}
          onDrainHoldChange={onDrainHoldChange}
          drainDisabled={readOnly || (drainAnim.isAnimating && !isDrainHeld)}
          disabled={readOnly}
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
