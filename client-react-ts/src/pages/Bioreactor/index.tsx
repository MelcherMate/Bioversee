import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Canvas from "../../components/Canvas";
import Chart from "../../components/Chart/index";
import ControlClock from "../../components/ControlClock";
import Knob from "../../components/Knob";
import Switch from "../../components/Switch";
import EmptyDeviceState from "../../components/EmptyDeviceState";
import { ToastStack, useToasts } from "../../components/Toast";
import {
  fillUnitsToPercent,
  VESSEL_MAX_FILL_UNITS,
} from "../../components/pressure-vessel/constants";
import { useDrainAnimation } from "../../components/pressure-vessel/useDrainAnimation";
import { useInletFillAnimation } from "../../components/pressure-vessel/useInletFillAnimation";
import "../../components/pressure-vessel/WaterLevelPanel.css";
import {
  getLatestSliderState,
  getLatestSwitchState,
  insertSensorReading,
  insertSliderState,
  insertSwitchState,
} from "../../lib/actuators";
import { canOperateDevice } from "../../lib/devices";
import {
  defaultBioreactorGeometry,
  fluidMotionFactors,
  litersFromM3,
  parseBioreactorConfig,
} from "../../lib/bioreactorGeometry";
import { layoutFromGeometry } from "../../components/Canvas/bioreactorLayout";
import { WaterLevelMeter } from "../../components/Canvas/WaterLevelMeter";
import { useProcessDevice } from "../../lib/useProcessDevice";
import type { AppUser } from "../../lib/user";
import useDimensions from "../../utils/hooks/useDimensions";
import "./Bioreactor.css";

const WATER_LEVEL_KEY = "water_level";
/** Fallback tank size when device config has no working volume. */
const DEFAULT_TANK_CAPACITY_L = 1000;

interface Card {
  id: string;
  coordinates: { x: number; y: number };
  text: string;
}

interface BioreactorProps {
  user: AppUser;
}

function clampFillUnits(value: number) {
  return Math.min(VESSEL_MAX_FILL_UNITS, Math.max(0, value));
}

function tankCapacityLiters(volume_m3: number | null): number {
  if (volume_m3 != null && volume_m3 > 0) return litersFromM3(volume_m3);
  return DEFAULT_TANK_CAPACITY_L;
}

function fillUnitsFromLiters(liters: number, capacityL: number): number {
  if (capacityL <= 0) return 0;
  return clampFillUnits((liters / capacityL) * VESSEL_MAX_FILL_UNITS);
}

function Bioreactor({ user }: BioreactorProps) {
  const { t } = useTranslation();
  const [canvasRef, canvasSize] = useDimensions();
  const { device, ready } = useProcessDevice("bioreactor", user.id);
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

  const [warmWVal, setWarmWVal] = useState(false);
  const [coldWVal, setColdWVal] = useState(false);
  const [acidVal, setAcidVal] = useState(false);
  const [baseVal, setBaseVal] = useState(false);
  const [rotorVal, setRotorVal] = useState(0);
  const [aeratorVal, setAeratorVal] = useState(0);
  const [fillUnits, setFillUnits] = useState(
    Math.round(VESSEL_MAX_FILL_UNITS * 0.92),
  );
  const [isFillHeld, setIsFillHeld] = useState(false);
  const [isDrainHeld, setIsDrainHeld] = useState(false);
  const [fillTargetUnits, setFillTargetUnits] = useState<number | null>(null);
  const [drainTargetUnits, setDrainTargetUnits] = useState<number | null>(null);
  const [transferAmountText, setTransferAmountText] = useState("");
  const [pumpsHydrated, setPumpsHydrated] = useState(false);
  const fillUnitsRef = useRef(fillUnits);
  fillUnitsRef.current = fillUnits;
  const aeratorLowWarnedRef = useRef(false);
  const rotorLowWarnedRef = useRef(false);
  const sensorLowWarnedRef = useRef(false);
  const { toasts, push, dismiss } = useToasts();

  const flowGeom = useMemo(() => {
    const layout = layoutFromGeometry(defaultBioreactorGeometry());
    return {
      inlet: {
        pipePathLength: layout.fillInlet.pipePathLength,
        columnHeight: layout.fillInlet.columnHeight,
      },
      drain: {
        pipePathLength: layout.outflow.pipePathLength,
        columnHeight: layout.outflow.columnHeight,
      },
      aeratorMinFillPercent: layout.aerator.minFillPercent,
      rotorMinFillPercent: layout.impeller.minFillPercent,
      sensorMinFillPercent: layout.sensors.minFillPercent,
    };
  }, []);

  const finishFillJob = useCallback(() => {
    setIsFillHeld(false);
    setFillTargetUnits(null);
    if (!device || !canOperateDevice(device.role)) return;
    const percent = fillUnitsToPercent(fillUnitsRef.current);
    insertSliderState(device.id, WATER_LEVEL_KEY, percent, user.id).catch(
      console.error,
    );
    insertSensorReading(device.id, WATER_LEVEL_KEY, percent, user.id).catch(
      console.error,
    );
  }, [device, user.id]);

  const finishDrainJob = useCallback(() => {
    setIsDrainHeld(false);
    setDrainTargetUnits(null);
    if (!device || !canOperateDevice(device.role)) return;
    const percent = fillUnitsToPercent(fillUnitsRef.current);
    insertSliderState(device.id, WATER_LEVEL_KEY, percent, user.id).catch(
      console.error,
    );
    insertSensorReading(device.id, WATER_LEVEL_KEY, percent, user.id).catch(
      console.error,
    );
  }, [device, user.id]);

  const inletFill = useInletFillAnimation(
    fillUnits,
    setFillUnits,
    isFillHeld,
    flowGeom.inlet,
    {
      targetFillUnits: fillTargetUnits,
      onTargetReached: finishFillJob,
    },
  );
  const drainAnim = useDrainAnimation(
    fillUnits,
    setFillUnits,
    isDrainHeld,
    flowGeom.drain,
    {
      targetFillUnits: drainTargetUnits,
      onTargetReached: finishDrainJob,
    },
  );

  // Load actuator states before mounting animations so already-on pumps /
  // set levels start in their steady state instead of replaying fill.
  useEffect(() => {
    if (!device) {
      setPumpsHydrated(false);
      return;
    }

    let cancelled = false;
    setPumpsHydrated(false);

    Promise.all([
      getLatestSwitchState(device.id, "switchWarmWaterPump"),
      getLatestSwitchState(device.id, "switchColdWaterPump"),
      getLatestSwitchState(device.id, "switchAcidPump"),
      getLatestSwitchState(device.id, "switchBasePump"),
      getLatestSliderState(device.id, WATER_LEVEL_KEY),
      getLatestSliderState(device.id, "aerator"),
      getLatestSliderState(device.id, "rotor"),
    ])
      .then(([warm, cold, acid, base, waterLevel, aerator, rotor]) => {
        if (cancelled) return;
        setWarmWVal(Boolean(warm));
        setColdWVal(Boolean(cold));
        setAcidVal(Boolean(acid));
        setBaseVal(Boolean(base));
        const percent = Math.min(100, Math.max(0, Number(waterLevel)));
        setFillUnits(Math.round((percent / 100) * VESSEL_MAX_FILL_UNITS));
        setAeratorVal(Number(aerator));
        setRotorVal(Number(rotor));
      })
      .catch((error) => console.log(error))
      .finally(() => {
        if (!cancelled) setPumpsHydrated(true);
      });

    return () => {
      cancelled = true;
    };
  }, [device?.id]);

  const parseTransferLiters = (): number | null => {
    const normalized = transferAmountText.trim().replace(",", ".");
    if (!normalized) return null;
    const value = Number(normalized);
    if (!Number.isFinite(value) || value <= 0) return null;
    return value;
  };

  const startFill = () => {
    if (!device || !canOperateDevice(device.role)) return;
    if (isFillHeld || isDrainHeld || inletFill.isAnimating || drainAnim.isAnimating) {
      return;
    }
    const liters = parseTransferLiters();
    if (liters == null) return;
    const capacityL = tankCapacityLiters(
      parseBioreactorConfig(device.config).volume_m3,
    );
    const deltaUnits = fillUnitsFromLiters(liters, capacityL);
    if (deltaUnits <= 0) return;
    const target = clampFillUnits(fillUnitsRef.current + deltaUnits);
    if (target <= fillUnitsRef.current + 0.05) return;
    setDrainTargetUnits(null);
    setIsDrainHeld(false);
    setFillTargetUnits(target);
    setIsFillHeld(true);
  };

  const startDrain = () => {
    if (!device || !canOperateDevice(device.role)) return;
    if (isFillHeld || isDrainHeld || inletFill.isAnimating || drainAnim.isAnimating) {
      return;
    }
    const liters = parseTransferLiters();
    if (liters == null) return;
    const capacityL = tankCapacityLiters(
      parseBioreactorConfig(device.config).volume_m3,
    );
    const deltaUnits = fillUnitsFromLiters(liters, capacityL);
    if (deltaUnits <= 0) return;
    const target = clampFillUnits(fillUnitsRef.current - deltaUnits);
    if (target >= fillUnitsRef.current - 0.05) return;
    setFillTargetUnits(null);
    setIsFillHeld(false);
    setDrainTargetUnits(target);
    setIsDrainHeld(true);
  };

  // Shut off aeration when the sparger is uncovered.
  useEffect(() => {
    if (!device || !pumpsHydrated) return;
    if (!canOperateDevice(device.role)) return;

    const config = parseBioreactorConfig(device.config);
    if (!config.equipment.aerator) return;

    const levelPercent = fillUnitsToPercent(fillUnits);
    const tooLow = levelPercent <= flowGeom.aeratorMinFillPercent;

    if (!tooLow) {
      aeratorLowWarnedRef.current = false;
      return;
    }

    if (aeratorVal <= 0) return;

    setAeratorVal(0);
    insertSliderState(device.id, "aerator", 0, user.id).catch(console.error);

    if (!aeratorLowWarnedRef.current) {
      aeratorLowWarnedRef.current = true;
      push(
        "warning",
        t("process.aeratorLevelTooLow"),
        t("process.aeratorLevelTooLowDetail"),
      );
    }
  }, [
    aeratorVal,
    device,
    fillUnits,
    flowGeom.aeratorMinFillPercent,
    pumpsHydrated,
    push,
    t,
    user.id,
  ]);

  // Shut off agitation when even the lower impeller is dry.
  useEffect(() => {
    if (!device || !pumpsHydrated) return;
    if (!canOperateDevice(device.role)) return;

    const config = parseBioreactorConfig(device.config);
    if (!config.equipment.stirrer) return;

    const levelPercent = fillUnitsToPercent(fillUnits);
    const tooLow = levelPercent <= flowGeom.rotorMinFillPercent;

    if (!tooLow) {
      rotorLowWarnedRef.current = false;
      return;
    }

    if (rotorVal <= 0) return;

    setRotorVal(0);
    insertSliderState(device.id, "rotor", 0, user.id).catch(console.error);

    if (!rotorLowWarnedRef.current) {
      rotorLowWarnedRef.current = true;
      push(
        "warning",
        t("process.rotorLevelTooLow"),
        t("process.rotorLevelTooLowDetail"),
      );
    }
  }, [
    device,
    fillUnits,
    flowGeom.rotorMinFillPercent,
    pumpsHydrated,
    push,
    rotorVal,
    t,
    user.id,
  ]);

  // Warn when pH / temperature probe tips sit above the liquid.
  useEffect(() => {
    if (!device || !pumpsHydrated) return;

    const config = parseBioreactorConfig(device.config);
    const hasTemp = config.equipment.sensor_temperature;
    const hasPh = config.equipment.sensor_ph;
    if (!hasTemp && !hasPh) return;

    const levelPercent = fillUnitsToPercent(fillUnits);
    const tooLow = levelPercent <= flowGeom.sensorMinFillPercent;

    if (!tooLow) {
      sensorLowWarnedRef.current = false;
      return;
    }

    if (sensorLowWarnedRef.current) return;
    sensorLowWarnedRef.current = true;

    const titleKey =
      hasTemp && hasPh
        ? "process.sensorLevelTooLowBoth"
        : hasTemp
          ? "process.sensorLevelTooLowTemp"
          : "process.sensorLevelTooLowPh";

    push("warning", t(titleKey), t("process.sensorLevelTooLowDetail"));
  }, [
    device,
    fillUnits,
    flowGeom.sensorMinFillPercent,
    pumpsHydrated,
    push,
    t,
  ]);

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

  if (!pumpsHydrated) {
    return (
      <div className="container">
        <div className="process-loading">{t("process.loadingBioreactor")}</div>
      </div>
    );
  }

  const readOnly = !canOperateDevice(device.role);
  const config = parseBioreactorConfig(device.config);
  const eq = config.equipment;
  const fluidMotion = fluidMotionFactors(config.fluid);
  const jacketMode = eq.thermal_jacket
    ? warmWVal
      ? "warm"
      : coldWVal
        ? "cold"
        : "idle"
    : "idle";
  const doseMode = eq.dosing
    ? acidVal
      ? "acid"
      : baseVal
        ? "base"
        : "idle"
    : "idle";

  const showPumps = eq.thermal_jacket || eq.dosing;
  const showMotion = eq.stirrer || eq.aerator;
  const atFull = fillUnits >= VESSEL_MAX_FILL_UNITS;
  const atEmpty = fillUnits <= 0;
  const levelBusy =
    isFillHeld ||
    isDrainHeld ||
    inletFill.isAnimating ||
    drainAnim.isAnimating;
  const transferLiters = parseTransferLiters();
  const fillDisabled = readOnly || levelBusy || atFull || transferLiters == null;
  const drainDisabled =
    readOnly || levelBusy || atEmpty || transferLiters == null;

  const capacityL = tankCapacityLiters(config.volume_m3);
  const getLiveFillUnits = () => {
    if (isFillHeld || inletFill.isAnimating) return inletFill.getLiveFillUnits();
    if (isDrainHeld || drainAnim.isAnimating) return drainAnim.getLiveFillUnits();
    return fillUnits;
  };

  const setWarmExclusive = (next: boolean) => {
    setWarmWVal(next);
    if (next && coldWVal) {
      setColdWVal(false);
      insertSwitchState(
        device.id,
        "switchColdWaterPump",
        false,
        user.id,
      ).catch((error) => console.log(error));
    }
  };

  const setColdExclusive = (next: boolean) => {
    setColdWVal(next);
    if (next && warmWVal) {
      setWarmWVal(false);
      insertSwitchState(
        device.id,
        "switchWarmWaterPump",
        false,
        user.id,
      ).catch((error) => console.log(error));
    }
  };

  const setAcidExclusive = (next: boolean) => {
    setAcidVal(next);
    if (next && baseVal) {
      setBaseVal(false);
      insertSwitchState(
        device.id,
        "switchBasePump",
        false,
        user.id,
      ).catch((error) => console.log(error));
    }
  };

  const setBaseExclusive = (next: boolean) => {
    setBaseVal(next);
    if (next && acidVal) {
      setAcidVal(false);
      insertSwitchState(
        device.id,
        "switchAcidPump",
        false,
        user.id,
      ).catch((error) => console.log(error));
    }
  };

  const showCharts =
    eq.sensor_temperature || eq.sensor_ph || eq.sensor_pressure;

  return (
    <div className="container">
      <ToastStack toasts={toasts} onDismiss={dismiss} />
      <aside id="actuatorSide">
        <div className="controlPanel">
          <ControlClock />
          {showPumps ? (
            <section className="controlPanel__section controlPanel__section--pumps">
              <div className="br-pumps">
                <h4 className="br-pumps__title">{t("process.pumps")}</h4>
                <div className="br-pumps__grid">
                  {eq.thermal_jacket ? (
                    <>
                      <Switch
                        deviceId={device.id}
                        name="switchWarmWaterPump"
                        setVal={setWarmExclusive}
                        val={warmWVal}
                        label={t("process.warmWater")}
                        user={user}
                        disabled={readOnly}
                      />
                      <Switch
                        deviceId={device.id}
                        name="switchColdWaterPump"
                        setVal={setColdExclusive}
                        val={coldWVal}
                        label={t("process.coldWater")}
                        user={user}
                        disabled={readOnly}
                      />
                    </>
                  ) : null}
                  {eq.dosing ? (
                    <>
                      <Switch
                        deviceId={device.id}
                        name="switchAcidPump"
                        setVal={setAcidExclusive}
                        val={acidVal}
                        label={t("process.acid")}
                        user={user}
                        disabled={readOnly}
                      />
                      <Switch
                        deviceId={device.id}
                        name="switchBasePump"
                        setVal={setBaseExclusive}
                        val={baseVal}
                        label={t("process.base")}
                        user={user}
                        disabled={readOnly}
                      />
                    </>
                  ) : null}
                </div>
              </div>
            </section>
          ) : null}
          {showMotion ? (
            <section className="controlPanel__section controlPanel__section--mixing">
              <div className="br-mixing">
                <h4 className="br-mixing__title">{t("process.motion")}</h4>
                <div className="br-mixing__grid">
                  {eq.stirrer ? (
                    <div className="br-mixing__card">
                      <Knob
                        deviceId={device.id}
                        name="rotor"
                        setVal={(value) => {
                          if (value > 0) rotorLowWarnedRef.current = false;
                          setRotorVal(value);
                        }}
                        val={rotorVal}
                        label={t("process.rotor")}
                        user={user}
                        min={0}
                        max={300}
                        unit="rpm"
                        disabled={readOnly}
                      />
                    </div>
                  ) : null}
                  {eq.aerator ? (
                    <div className="br-mixing__card">
                      <Knob
                        deviceId={device.id}
                        name="aerator"
                        setVal={(value) => {
                          if (value > 0) aeratorLowWarnedRef.current = false;
                          setAeratorVal(value);
                        }}
                        val={aeratorVal}
                        label={t("process.aerator")}
                        user={user}
                        unit="%"
                        step={10}
                        disabled={readOnly}
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            </section>
          ) : null}
          <section className="controlPanel__section controlPanel__section--level">
            <WaterLevelMeter
              fillUnits={fillUnits}
              getLiveFillUnits={getLiveFillUnits}
              capacityLiters={capacityL}
              busy={levelBusy}
              transferAmountText={transferAmountText}
              onTransferAmountChange={setTransferAmountText}
              onFill={startFill}
              onDrain={startDrain}
              fillDisabled={fillDisabled}
              drainDisabled={drainDisabled}
              fillActive={isFillHeld}
              drainActive={isDrainHeld}
              readOnly={readOnly}
            />
          </section>
        </div>
      </aside>
      <main id="reactorBox" ref={canvasRef}>
        <Canvas
          cards={cards}
          rotorVal={eq.stirrer ? rotorVal : 0}
          aeratorVal={eq.aerator ? aeratorVal : 0}
          fillUnits={fillUnits}
          inletFill={inletFill}
          drainAnim={drainAnim}
          jacketMode={jacketMode}
          doseMode={doseMode}
          equipment={eq}
          fluidMotion={fluidMotion}
          geometry={defaultBioreactorGeometry()}
        />
      </main>
      {showCharts ? (
        <aside id="sensorSide">
          <div className="chartBox">
            {eq.sensor_temperature ? (
              <Chart
                deviceId={device.id}
                name="temperature"
                label={t("process.temperature")}
              />
            ) : null}
            {eq.sensor_ph ? (
              <Chart deviceId={device.id} name="ph" label={t("process.ph")} />
            ) : null}
            {eq.sensor_pressure ? (
              <Chart
                deviceId={device.id}
                name="pressure"
                label={t("process.pressure")}
                unit="psi"
              />
            ) : null}
          </div>
        </aside>
      ) : null}
    </div>
  );
}

export default Bioreactor;
