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
  fillUnitsToLiters,
  fillUnitsToPercent,
  fillUnitsToStoredPercent,
  storedPercentToFillUnits,
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
import { subscribeDeviceActuators } from "../../lib/actuatorsSync";
import { canOperateDevice } from "../../lib/devices";
import {
  getLevelTransfer,
  hasLevelTransfer,
  startLevelTransfer,
  subscribeLevelTransfer,
  type LevelTransferSnapshot,
} from "../../lib/levelTransferJobs";
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

function litersFromFillUnits(fillUnits: number, capacityL: number): number {
  return (fillUnits / VESSEL_MAX_FILL_UNITS) * capacityL;
}

function formatLiters(value: number, locale: string): string {
  return value.toLocaleString(locale, {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  });
}

/** Keep transfer amount editable while typing, but never above tank capacity. */
function clampTransferAmountInput(raw: string, capacityL: number): string {
  const trimmed = raw.trim();
  if (!trimmed) return raw;
  // Allow in-progress decimals like "12." / "12,"
  if (/^\d+[.,]$/.test(trimmed)) return raw;
  const normalized = trimmed.replace(",", ".");
  const value = Number(normalized);
  if (!Number.isFinite(value)) return raw;
  if (value < 0) return "0";
  if (capacityL > 0 && value > capacityL) {
    return Number.isInteger(capacityL)
      ? String(capacityL)
      : String(Math.round(capacityL * 10) / 10);
  }
  return raw;
}

type TransferJob = {
  kind: "fill" | "drain";
  startUnits: number;
  requestedLiters: number;
  capacityL: number;
};

function Bioreactor({ user }: BioreactorProps) {
  const { t, i18n } = useTranslation();
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
  const [fillUnits, setFillUnitsState] = useState(
    Math.round(VESSEL_MAX_FILL_UNITS * 0.92),
  );
  const [isFillHeld, setIsFillHeld] = useState(false);
  const [isDrainHeld, setIsDrainHeld] = useState(false);
  const isFillHeldRef = useRef(false);
  const isDrainHeldRef = useRef(false);
  isFillHeldRef.current = isFillHeld;
  isDrainHeldRef.current = isDrainHeld;
  const [fillTargetUnits, setFillTargetUnits] = useState<number | null>(null);
  const [drainTargetUnits, setDrainTargetUnits] = useState<number | null>(null);
  const fillTargetUnitsRef = useRef<number | null>(null);
  const drainTargetUnitsRef = useRef<number | null>(null);
  fillTargetUnitsRef.current = fillTargetUnits;
  drainTargetUnitsRef.current = drainTargetUnits;
  const [transferAmountText, setTransferAmountText] = useState("");
  const [pumpsHydrated, setPumpsHydrated] = useState(false);
  const fillUnitsRef = useRef(fillUnits);
  /**
   * When false, ignore animation ticks / water writes briefly while the UI
   * detaches from one vessel and attaches to another.
   */
  const acceptsLevelTicksRef = useRef(true);
  const setFillUnits = useCallback((value: number) => {
    if (!acceptsLevelTicksRef.current) return;
    fillUnitsRef.current = value;
    setFillUnitsState(value);
  }, []);
  const transferJobRef = useRef<TransferJob | null>(null);
  /** True while fill/drain was started from a remote water_level write (phone / other tab). */
  const remoteLevelAnimRef = useRef(false);
  const remoteEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastStreamPersistAtRef = useRef(0);
  const lastStreamPercentRef = useRef<number | null>(null);
  /** Ignore realtime/poll water_level while this tab drives a local dose (avoids echo fights). */
  const suppressRemoteWaterUntilRef = useRef(0);
  /** Previous vessel — hand off in-flight transfers when switching devices. */
  const activeVesselRef = useRef<{
    id: string;
    role: string;
    volume_m3: number | null;
  } | null>(null);
  const inletAnimatingRef = useRef(false);
  const drainAnimatingRef = useRef(false);
  const levelBusyRef = useRef(false);
  const aeratorLowWarnedRef = useRef(false);
  const rotorLowWarnedRef = useRef(false);
  const sensorLowWarnedRef = useRef(false);
  const aeratorWasLowRef = useRef<boolean | null>(null);
  const rotorWasLowRef = useRef<boolean | null>(null);
  const sensorWasLowRef = useRef<boolean | null>(null);
  const { toasts, push, dismiss } = useToasts();

  const vesselShape = useMemo(
    () =>
      device
        ? parseBioreactorConfig(device.config).vessel_shape
        : ("capsule" as const),
    [device],
  );

  const flowGeom = useMemo(() => {
    const layout = layoutFromGeometry(defaultBioreactorGeometry(), vesselShape);
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
  }, [vesselShape]);

  const notifyTransferCompleteFromSnap = useCallback(
    (snap: LevelTransferSnapshot) => {
      const endUnits = snap.currentUnits;
      const deltaUnits =
        snap.kind === "fill"
          ? Math.max(0, endUnits - snap.startUnits)
          : Math.max(0, snap.startUnits - endUnits);
      const actualL = litersFromFillUnits(deltaUnits, snap.capacityL);
      const locale = i18n.language || "en";
      const actualLabel = formatLiters(actualL, locale);
      const requestedLabel = formatLiters(snap.requestedLiters, locale);
      const clipped =
        snap.requestedLiters - actualL > 0.05 ||
        (snap.kind === "fill" && endUnits >= VESSEL_MAX_FILL_UNITS - 0.05) ||
        (snap.kind === "drain" && endUnits <= 0.05);

      if (clipped && snap.requestedLiters - actualL > 0.05) {
        if (snap.kind === "fill") {
          push(
            "warning",
            t("process.fillLimitedTitle"),
            t("process.fillLimitedDetail", {
              actual: actualLabel,
              requested: requestedLabel,
            }),
          );
        } else {
          push(
            "warning",
            t("process.drainLimitedTitle"),
            t("process.drainLimitedDetail", {
              actual: actualLabel,
              requested: requestedLabel,
            }),
          );
        }
        return;
      }

      if (snap.kind === "fill") {
        push(
          "success",
          t("process.fillCompleteTitle"),
          t("process.fillCompleteDetail", { actual: actualLabel }),
        );
      } else {
        push(
          "success",
          t("process.drainCompleteTitle"),
          t("process.drainCompleteDetail", { actual: actualLabel }),
        );
      }
    },
    [i18n.language, push, t],
  );
  const notifyTransferCompleteFromSnapRef = useRef(notifyTransferCompleteFromSnap);
  notifyTransferCompleteFromSnapRef.current = notifyTransferCompleteFromSnap;

  const notifyTransferComplete = useCallback(
    (kind: "fill" | "drain") => {
      const job = transferJobRef.current;
      transferJobRef.current = null;
      if (!job || job.kind !== kind) return;
      notifyTransferCompleteFromSnap({
        deviceId: "",
        kind: job.kind,
        capacityL: job.capacityL,
        startUnits: job.startUnits,
        targetUnits: fillUnitsRef.current,
        requestedLiters: job.requestedLiters,
        currentUnits: fillUnitsRef.current,
        done: true,
      });
    },
    [notifyTransferCompleteFromSnap],
  );

  const clearRemoteEndTimer = useCallback(() => {
    if (remoteEndTimerRef.current != null) {
      clearTimeout(remoteEndTimerRef.current);
      remoteEndTimerRef.current = null;
    }
  }, []);

  const suppressRemoteWater = useCallback((ms: number) => {
    suppressRemoteWaterUntilRef.current = Math.max(
      suppressRemoteWaterUntilRef.current,
      Date.now() + ms,
    );
  }, []);

  const persistWaterLevel = useCallback(
    (fillUnits: number, { sensor = true }: { sensor?: boolean } = {}) => {
      if (!acceptsLevelTicksRef.current) return;
      if (!device || !canOperateDevice(device.role)) return;
      const capacityL = tankCapacityLiters(
        parseBioreactorConfig(device.config).volume_m3,
      );
      const percent = fillUnitsToStoredPercent(fillUnits, capacityL);
      // Echoes of our own writes must not start a second fill/drain on this tab.
      suppressRemoteWater(2500);
      insertSliderState(device.id, WATER_LEVEL_KEY, percent, user.id).catch(
        console.error,
      );
      if (sensor) {
        insertSensorReading(device.id, WATER_LEVEL_KEY, percent, user.id).catch(
          console.error,
        );
      }
    },
    [device, suppressRemoteWater, user.id],
  );

  const finishFillJob = useCallback(() => {
    if (remoteLevelAnimRef.current) {
      // Phone may still be streaming — wait briefly before closing the inlet.
      clearRemoteEndTimer();
      remoteEndTimerRef.current = setTimeout(() => {
        remoteEndTimerRef.current = null;
        setIsFillHeld(false);
        setFillTargetUnits(null);
        remoteLevelAnimRef.current = false;
      }, 550);
      return;
    }
    setIsFillHeld(false);
    setFillTargetUnits(null);
    notifyTransferComplete("fill");
    suppressRemoteWater(2500);
    persistWaterLevel(fillUnitsRef.current);
  }, [
    clearRemoteEndTimer,
    notifyTransferComplete,
    persistWaterLevel,
    suppressRemoteWater,
  ]);

  const finishDrainJob = useCallback(() => {
    if (remoteLevelAnimRef.current) {
      clearRemoteEndTimer();
      remoteEndTimerRef.current = setTimeout(() => {
        remoteEndTimerRef.current = null;
        setIsDrainHeld(false);
        setDrainTargetUnits(null);
        remoteLevelAnimRef.current = false;
      }, 550);
      return;
    }
    setIsDrainHeld(false);
    setDrainTargetUnits(null);
    notifyTransferComplete("drain");
    suppressRemoteWater(2500);
    persistWaterLevel(fillUnitsRef.current);
  }, [
    clearRemoteEndTimer,
    notifyTransferComplete,
    persistWaterLevel,
    suppressRemoteWater,
  ]);

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
  inletAnimatingRef.current = inletFill.isAnimating;
  drainAnimatingRef.current = drainAnim.isAnimating;
  const levelBusy =
    isFillHeld ||
    isDrainHeld ||
    inletFill.isAnimating ||
    drainAnim.isAnimating;
  levelBusyRef.current = levelBusy;

  // Load actuator states before mounting animations so already-on pumps /
  // set levels start in their steady state instead of replaying fill.
  useEffect(() => {
    if (!device) {
      activeVesselRef.current = null;
      setPumpsHydrated(false);
      return;
    }

    const prev = activeVesselRef.current;
    const switched = Boolean(prev && prev.id !== device.id);

    // Leave an in-flight dose running on the previous vessel — the command was
    // already issued. Detach this view, hand the remainder to a background job.
    if (switched && prev) {
      const meta = transferJobRef.current;
      const filling =
        isFillHeldRef.current && fillTargetUnitsRef.current != null;
      const draining =
        isDrainHeldRef.current && drainTargetUnitsRef.current != null;
      const kind = filling ? "fill" : draining ? "drain" : null;
      const target = filling
        ? fillTargetUnitsRef.current
        : draining
          ? drainTargetUnitsRef.current
          : null;

      acceptsLevelTicksRef.current = false;
      isFillHeldRef.current = false;
      isDrainHeldRef.current = false;

      if (
        kind &&
        target != null &&
        canOperateDevice(prev.role) &&
        !getLevelTransfer(prev.id)
      ) {
        const capacityL =
          meta?.capacityL ?? tankCapacityLiters(prev.volume_m3);
        startLevelTransfer({
          deviceId: prev.id,
          userId: user.id,
          kind,
          capacityL,
          startUnits: meta?.startUnits ?? fillUnitsRef.current,
          targetUnits: target,
          requestedLiters: meta?.requestedLiters ?? 0,
          currentUnits: fillUnitsRef.current,
          onComplete: (snap) => notifyTransferCompleteFromSnapRef.current(snap),
        });
      }

      clearRemoteEndTimer();
      remoteLevelAnimRef.current = false;
      transferJobRef.current = null;
      setIsFillHeld(false);
      setIsDrainHeld(false);
      setFillTargetUnits(null);
      setDrainTargetUnits(null);
      suppressRemoteWaterUntilRef.current = 0;
      lastStreamPersistAtRef.current = 0;
      lastStreamPercentRef.current = null;
    }

    activeVesselRef.current = {
      id: device.id,
      role: device.role,
      volume_m3: parseBioreactorConfig(device.config).volume_m3,
    };

    let cancelled = false;
    setPumpsHydrated(false);

    const attachBackgroundJob = () => {
      const job = getLevelTransfer(device.id);
      if (!job) return false;
      // Job owns the tank level + DB writes. Keep local fill/drain held off so
      // inlet/drain animations don't double-advance the same dose.
      setFillUnits(job.currentUnits);
      setIsFillHeld(false);
      setIsDrainHeld(false);
      setFillTargetUnits(null);
      setDrainTargetUnits(null);
      transferJobRef.current = null;
      suppressRemoteWater(300_000);
      return true;
    };

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
        acceptsLevelTicksRef.current = true;
        if (!attachBackgroundJob()) {
          const percent = Math.min(100, Math.max(0, Number(waterLevel)));
          const capacityL = tankCapacityLiters(
            parseBioreactorConfig(device.config).volume_m3,
          );
          setFillUnits(storedPercentToFillUnits(percent, capacityL));
        }
        setAeratorVal(Number(aerator));
        setRotorVal(Number(rotor));
      })
      .catch((error) => console.log(error))
      .finally(() => {
        if (!cancelled) {
          acceptsLevelTicksRef.current = true;
          setPumpsHydrated(true);
        }
      });

    return () => {
      cancelled = true;
    };
    // Only re-hydrate when the selected vessel changes. Unstable callback
    // identities used to retrigger this every render and cancel the fetch,
    // leaving the UI stuck on "Loading your bioreactor...".
    // eslint-disable-next-line react-hooks/exhaustive-deps -- device fields read for the active id only
  }, [device?.id, user.id]);

  // Follow a background transfer when this vessel is on screen again.
  useEffect(() => {
    if (!device || !pumpsHydrated) return;
    if (!getLevelTransfer(device.id)) return;

    return subscribeLevelTransfer(device.id, (snap) => {
      if (!acceptsLevelTicksRef.current) return;
      setFillUnits(snap.currentUnits);
      if (!snap.done) return;
      setIsFillHeld(false);
      setIsDrainHeld(false);
      setFillTargetUnits(null);
      setDrainTargetUnits(null);
      transferJobRef.current = null;
      suppressRemoteWater(2500);
    });
  }, [device?.id, pumpsHydrated, setFillUnits, suppressRemoteWater]);

  // Keep vessel fill in sync with mobile / other tabs so level guards agree.
  // Remote level changes play the same inlet fill / drain animation as a local dose.
  useEffect(() => {
    if (!device || !pumpsHydrated) return;

    let cancelled = false;

    const capacityL = tankCapacityLiters(
      parseBioreactorConfig(device.config).volume_m3,
    );
    // ~0.25 L in fill-units — small enough to notice a 1 L remote step.
    const minDeltaUnits = Math.max(
      0.05,
      (0.25 / Math.max(capacityL, 1)) * VESSEL_MAX_FILL_UNITS,
    );

    const applyWaterPercent = (percent: number) => {
      if (cancelled) return;
      // Background job (possibly started on this vessel earlier) owns DB writes.
      if (hasLevelTransfer(device.id)) return;
      // Local dose (and its write echoes) own the level on this tab.
      if (Date.now() < suppressRemoteWaterUntilRef.current) return;

      const next = storedPercentToFillUnits(percent, capacityL);
      const current = fillUnitsRef.current;

      // Already following a remote stream — chase the latest published level.
      if (remoteLevelAnimRef.current) {
        if (isFillHeldRef.current && next > current + minDeltaUnits) {
          clearRemoteEndTimer();
          setFillTargetUnits(next);
          return;
        }
        if (isDrainHeldRef.current && next < current - minDeltaUnits) {
          clearRemoteEndTimer();
          setDrainTargetUnits(next);
          return;
        }
        if (isFillHeldRef.current || isDrainHeldRef.current) return;
      }

      // Don't interrupt a transfer this tab started (or pipe retreat still running).
      if (
        isFillHeldRef.current ||
        isDrainHeldRef.current ||
        inletAnimatingRef.current ||
        drainAnimatingRef.current
      ) {
        return;
      }

      if (Math.abs(next - current) < minDeltaUnits) return;

      remoteLevelAnimRef.current = true;
      transferJobRef.current = null;
      clearRemoteEndTimer();
      if (next > current) {
        setDrainTargetUnits(null);
        setIsDrainHeld(false);
        setFillTargetUnits(next);
        setIsFillHeld(true);
      } else {
        setFillTargetUnits(null);
        setIsFillHeld(false);
        setDrainTargetUnits(next);
        setIsDrainHeld(true);
      }
    };

    const pull = () => {
      if (Date.now() < suppressRemoteWaterUntilRef.current) return;
      if (
        isFillHeldRef.current ||
        isDrainHeldRef.current ||
        inletAnimatingRef.current ||
        drainAnimatingRef.current
      ) {
        return;
      }
      getLatestSliderState(device.id, WATER_LEVEL_KEY)
        .then((state) => {
          applyWaterPercent(Number(state));
        })
        .catch((error) => console.log(error));
    };

    const unsubscribe = subscribeDeviceActuators(device.id, (change) => {
      if (cancelled) return;
      if (change) {
        if (change.kind !== "slider" || change.name !== WATER_LEVEL_KEY) return;
        applyWaterPercent(Number(change.state));
        return;
      }
      pull();
    });

    return () => {
      cancelled = true;
      clearRemoteEndTimer();
      unsubscribe();
    };
  }, [clearRemoteEndTimer, device, pumpsHydrated]);

  // Publish live water_level while this tab runs a local fill/drain so the phone
  // can animate in parallel (sensor history still written once at the end).
  useEffect(() => {
    if (!acceptsLevelTicksRef.current) return;
    if (!device || !canOperateDevice(device.role)) return;
    // Background job already streams for this vessel.
    if (hasLevelTransfer(device.id)) return;
    if (remoteLevelAnimRef.current) return;
    if (!isFillHeld && !isDrainHeld) return;

    const capacityL = tankCapacityLiters(
      parseBioreactorConfig(device.config).volume_m3,
    );
    const percent = fillUnitsToStoredPercent(fillUnits, capacityL);
    const now = performance.now();
    if (now - lastStreamPersistAtRef.current < 280) return;
    // Stream at least every ~1 L so a 1 L dose is visible on the other client.
    const minStep = capacityL > 0 ? (1 / capacityL) * 100 : 1;
    if (
      lastStreamPercentRef.current != null &&
      Math.abs(percent - lastStreamPercentRef.current) < minStep * 0.9
    ) {
      return;
    }
    lastStreamPersistAtRef.current = now;
    lastStreamPercentRef.current = percent;
    persistWaterLevel(fillUnits, { sensor: false });
  }, [device, fillUnits, isDrainHeld, isFillHeld, persistWaterLevel]);

  const parseTransferLiters = (capacityL: number): number | null => {
    const normalized = transferAmountText.trim().replace(",", ".");
    if (!normalized) return null;
    const value = Number(normalized);
    if (!Number.isFinite(value) || value <= 0) return null;
    if (capacityL > 0) return Math.min(value, capacityL);
    return value;
  };

  const onTransferAmountChange = (value: string) => {
    const capacityL = device
      ? tankCapacityLiters(parseBioreactorConfig(device.config).volume_m3)
      : DEFAULT_TANK_CAPACITY_L;
    setTransferAmountText(clampTransferAmountInput(value, capacityL));
  };

  const startFill = () => {
    if (!device || !canOperateDevice(device.role)) return;
    if (hasLevelTransfer(device.id)) return;
    if (isFillHeld || isDrainHeld || inletFill.isAnimating || drainAnim.isAnimating) {
      return;
    }
    const capacityL = tankCapacityLiters(
      parseBioreactorConfig(device.config).volume_m3,
    );
    const liters = parseTransferLiters(capacityL);
    if (liters == null) return;
    const startUnits = fillUnitsRef.current;
    if (startUnits >= VESSEL_MAX_FILL_UNITS - 0.05) {
      push("warning", t("process.tankFullTitle"), t("process.tankFullDetail"));
      return;
    }
    // Snap dose targets to whole liters so 1 L lands exactly.
    const startLiters = fillUnitsToLiters(startUnits, capacityL);
    const targetLiters = Math.min(capacityL, startLiters + liters);
    if (targetLiters <= startLiters) {
      push("warning", t("process.tankFullTitle"), t("process.tankFullDetail"));
      return;
    }
    const target = storedPercentToFillUnits(
      (targetLiters / capacityL) * 100,
      capacityL,
    );
    remoteLevelAnimRef.current = false;
    clearRemoteEndTimer();
    lastStreamPersistAtRef.current = 0;
    lastStreamPercentRef.current = null;
    // Block echo/poll from reversing this dose for its whole duration.
    suppressRemoteWater(300_000);
    transferJobRef.current = {
      kind: "fill",
      startUnits,
      requestedLiters: liters,
      capacityL,
    };
    setDrainTargetUnits(null);
    setIsDrainHeld(false);
    setFillTargetUnits(target);
    setIsFillHeld(true);
  };

  const startDrain = () => {
    if (!device || !canOperateDevice(device.role)) return;
    if (hasLevelTransfer(device.id)) return;
    if (isFillHeld || isDrainHeld || inletFill.isAnimating || drainAnim.isAnimating) {
      return;
    }
    const capacityL = tankCapacityLiters(
      parseBioreactorConfig(device.config).volume_m3,
    );
    const liters = parseTransferLiters(capacityL);
    if (liters == null) return;
    const startUnits = fillUnitsRef.current;
    if (startUnits <= 0.05) {
      push("warning", t("process.tankEmptyTitle"), t("process.tankEmptyDetail"));
      return;
    }
    const startLiters = fillUnitsToLiters(startUnits, capacityL);
    const targetLiters = Math.max(0, startLiters - liters);
    if (targetLiters >= startLiters) {
      push("warning", t("process.tankEmptyTitle"), t("process.tankEmptyDetail"));
      return;
    }
    const target = storedPercentToFillUnits(
      (targetLiters / capacityL) * 100,
      capacityL,
    );
    remoteLevelAnimRef.current = false;
    clearRemoteEndTimer();
    lastStreamPersistAtRef.current = 0;
    lastStreamPercentRef.current = null;
    suppressRemoteWater(300_000);
    transferJobRef.current = {
      kind: "drain",
      startUnits,
      requestedLiters: liters,
      capacityL,
    };
    setFillTargetUnits(null);
    setIsFillHeld(false);
    setDrainTargetUnits(target);
    setIsDrainHeld(true);
  };

  // Shut off aeration only when the level drops below the sparger (edge), so
  // clients don't keep writing 0 and fighting remote setpoints.
  useEffect(() => {
    if (!device || !pumpsHydrated) return;
    if (!canOperateDevice(device.role)) return;

    const config = parseBioreactorConfig(device.config);
    if (!config.equipment.aerator) return;

    const levelPercent = fillUnitsToPercent(fillUnits);
    const tooLow = levelPercent <= flowGeom.aeratorMinFillPercent;
    // Track edges during a dose, but don't toast/zero until it settles.
    if (levelBusy) {
      aeratorWasLowRef.current = tooLow;
      return;
    }
    const wasLow = aeratorWasLowRef.current;

    if (wasLow === null) {
      aeratorWasLowRef.current = tooLow;
      if (!tooLow || aeratorVal <= 0) return;
      // Hydrated already-low with aerator on — shut off once.
    } else if (wasLow && !tooLow) {
      aeratorWasLowRef.current = false;
      aeratorLowWarnedRef.current = false;
      push(
        "success",
        t("process.aeratorLevelOk"),
        t("process.aeratorLevelOkDetail"),
      );
      return;
    } else {
      aeratorWasLowRef.current = tooLow;
      // Already low, or still high: don't re-zero on remote aerator writes.
      if (!tooLow || wasLow === true) {
        if (!tooLow) aeratorLowWarnedRef.current = false;
        return;
      }
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
    device,
    fillUnits,
    flowGeom.aeratorMinFillPercent,
    levelBusy,
    pumpsHydrated,
    push,
    t,
    user.id,
    aeratorVal,
  ]);

  // Shut off mixing only when the level drops below the lower impeller (edge).
  useEffect(() => {
    if (!device || !pumpsHydrated) return;
    if (!canOperateDevice(device.role)) return;

    const config = parseBioreactorConfig(device.config);
    if (!config.equipment.stirrer) return;

    const levelPercent = fillUnitsToPercent(fillUnits);
    const tooLow = levelPercent <= flowGeom.rotorMinFillPercent;
    if (levelBusy) {
      rotorWasLowRef.current = tooLow;
      return;
    }
    const wasLow = rotorWasLowRef.current;

    if (wasLow === null) {
      rotorWasLowRef.current = tooLow;
      if (!tooLow || rotorVal <= 0) return;
    } else if (wasLow && !tooLow) {
      rotorWasLowRef.current = false;
      rotorLowWarnedRef.current = false;
      push(
        "success",
        t("process.rotorLevelOk"),
        t("process.rotorLevelOkDetail"),
      );
      return;
    } else {
      rotorWasLowRef.current = tooLow;
      if (!tooLow || wasLow === true) {
        if (!tooLow) rotorLowWarnedRef.current = false;
        return;
      }
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
    levelBusy,
    pumpsHydrated,
    push,
    rotorVal,
    t,
    user.id,
  ]);

  // Warn when pH / temperature probe tips sit above the liquid; toast when recovered.
  useEffect(() => {
    if (!device || !pumpsHydrated) return;

    const config = parseBioreactorConfig(device.config);
    const hasTemp = config.equipment.sensor_temperature;
    const hasPh = config.equipment.sensor_ph;
    if (!hasTemp && !hasPh) return;

    const levelPercent = fillUnitsToPercent(fillUnits);
    const tooLow = levelPercent <= flowGeom.sensorMinFillPercent;
    if (levelBusy) {
      sensorWasLowRef.current = tooLow;
      return;
    }

    if (sensorWasLowRef.current === null) {
      sensorWasLowRef.current = tooLow;
    } else if (sensorWasLowRef.current && !tooLow) {
      const okKey =
        hasTemp && hasPh
          ? "process.sensorLevelOkBoth"
          : hasTemp
            ? "process.sensorLevelOkTemp"
            : "process.sensorLevelOkPh";
      push("success", t(okKey), t("process.sensorLevelOkDetail"));
      sensorLowWarnedRef.current = false;
    }
    sensorWasLowRef.current = tooLow;

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
    levelBusy,
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
  const capacityL = tankCapacityLiters(config.volume_m3);
  const transferLiters = parseTransferLiters(capacityL);
  const fillDisabled = readOnly || levelBusy || atFull || transferLiters == null;
  const drainDisabled =
    readOnly || levelBusy || atEmpty || transferLiters == null;
  const levelPercent = fillUnitsToPercent(fillUnits);
  const sensorLevelAlarm = levelPercent <= flowGeom.sensorMinFillPercent;
  const sensorAlarms = {
    temperature: Boolean(eq.sensor_temperature && sensorLevelAlarm),
    ph: Boolean(eq.sensor_ph && sensorLevelAlarm),
  };

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
                        disabled={
                          readOnly ||
                          levelPercent <= flowGeom.rotorMinFillPercent
                        }
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
                        disabled={
                          readOnly ||
                          levelPercent <= flowGeom.aeratorMinFillPercent
                        }
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
              onTransferAmountChange={onTransferAmountChange}
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
          vesselShape={config.vessel_shape}
          sensorAlarms={sensorAlarms}
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
