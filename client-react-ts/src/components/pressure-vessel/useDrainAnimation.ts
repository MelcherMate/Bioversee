import { useEffect, useRef, useState } from "react";
import {
  DRAIN_PIPE_WATER_SPEED,
  DRAIN_VALVE_CLOSE_DELAY,
  VESSEL_COMPOSITE_HEIGHT,
  VESSEL_FILL_DRAIN_RATE,
  VESSEL_MAX_FILL_UNITS,
} from "./constants";
import { DRAIN_PIPE_PATH_LENGTH } from "./pipe-geometry";

type Phase = "idle" | "advance" | "steady" | "valveClose" | "retreat";

export type DrainVisualState = {
  /** Trailing edge along vessel→outlet path (advances through pipe on valve close). */
  tail: number;
  /** Leading edge along vessel→outlet path (grows toward open end on drain). */
  head: number;
  /** Column has reached the drain nozzle — stream extends through the visible surface. */
  connectedToNozzle: boolean;
  /** Tank level is locked while the pipe finishes draining. */
  isLevelFrozen: boolean;
  /** Fill units captured when the drain valve closes. */
  frozenFillUnits: number | null;
  isAnimating: boolean;
  /** Latest tank fill from the animation loop (for live meters). */
  liveFillUnits: number;
  /** Read fill from the rAF loop without waiting for React state. */
  getLiveFillUnits: () => number;
};

/** Vessel column + metal drain pipe geometry. */
export type DrainFlowGeometry = {
  /** Metal pipe centerline length (nozzle → open end). */
  pipePathLength: number;
  /** Interior height used for the rising column from the free surface. */
  columnHeight: number;
};

export type DrainAnimationOptions = {
  /** Stop transferring once the tank reaches this fill (click-to-dose). */
  targetFillUnits?: number | null;
  /** Fired once when the target is reached (or tank is empty). */
  onTargetReached?: () => void;
};

export const DEFAULT_DRAIN_FLOW_GEOMETRY: DrainFlowGeometry = {
  pipePathLength: DRAIN_PIPE_PATH_LENGTH,
  columnHeight: VESSEL_COMPOSITE_HEIGHT,
};

function clampFillUnits(value: number) {
  return Math.min(VESSEL_MAX_FILL_UNITS, Math.max(0, value));
}

function riseHeight(fillUnits: number, columnHeight: number) {
  const fillRatio = Math.min(1, Math.max(0, fillUnits / VESSEL_MAX_FILL_UNITS));
  return fillRatio * columnHeight;
}

/** Full path length: vessel column + drain pipe to the open end. */
function totalHead(fillUnits: number, geom: DrainFlowGeometry) {
  return riseHeight(fillUnits, geom.columnHeight) + geom.pipePathLength;
}

function riseEnd(fillUnits: number, columnHeight: number) {
  return riseHeight(fillUnits, columnHeight);
}

export function useDrainAnimation(
  fillUnits: number,
  onFillUnitsChange: (value: number) => void,
  isDrainHeld: boolean,
  geometry: DrainFlowGeometry = DEFAULT_DRAIN_FLOW_GEOMETRY,
  options: DrainAnimationOptions = {},
): DrainVisualState {
  const [visual, setVisual] = useState<Omit<DrainVisualState, "getLiveFillUnits">>({
    tail: 0,
    head: 0,
    connectedToNozzle: false,
    isLevelFrozen: false,
    frozenFillUnits: null,
    isAnimating: false,
    liveFillUnits: fillUnits,
  });

  const phaseRef = useRef<Phase>("idle");
  const tailRef = useRef(0);
  const headRef = useRef(0);
  const releaseHeadRef = useRef(0);
  const frozenFillUnitsRef = useRef<number | null>(null);
  const valveCloseElapsedRef = useRef(0);
  const hasReachedNozzleRef = useRef(false);
  const isHeldRef = useRef(isDrainHeld);
  const fillUnitsRef = useRef(fillUnits);
  const onChangeRef = useRef(onFillUnitsChange);
  const geomRef = useRef(geometry);
  const targetRef = useRef(options.targetFillUnits ?? null);
  const onTargetReachedRef = useRef(options.onTargetReached);
  const targetNotifiedRef = useRef(false);

  isHeldRef.current = isDrainHeld;
  onChangeRef.current = onFillUnitsChange;
  geomRef.current = geometry;
  targetRef.current =
    options.targetFillUnits === undefined ? null : options.targetFillUnits;
  onTargetReachedRef.current = options.onTargetReached;
  // Remote streams lower the target mid-dose — allow another onTargetReached later.
  if (
    targetRef.current != null &&
    targetRef.current < fillUnitsRef.current - 0.05 &&
    targetNotifiedRef.current
  ) {
    targetNotifiedRef.current = false;
  }
  // While animating, the rAF loop owns fillUnitsRef — don't clobber it with
  // a possibly-stale React state value mid-transfer.
  if (phaseRef.current === "idle") {
    fillUnitsRef.current = fillUnits;
  }

  useEffect(() => {
    if (isDrainHeld) targetNotifiedRef.current = false;
  }, [isDrainHeld]);

  useEffect(() => {
    let frame = 0;
    let lastTime = 0;

    const publish = () => {
      const tail = tailRef.current;
      const head = headRef.current;
      const connectedToNozzle = hasReachedNozzleRef.current;
      const phase = phaseRef.current;
      const isLevelFrozen = phase === "valveClose" || phase === "retreat";
      const frozenFillUnits = frozenFillUnitsRef.current;
      const isAnimating = phase !== "idle";
      const liveFillUnits = isLevelFrozen
        ? (frozenFillUnitsRef.current ?? fillUnitsRef.current)
        : fillUnitsRef.current;
      setVisual((current) => {
        if (
          current.tail === tail &&
          current.head === head &&
          current.connectedToNozzle === connectedToNozzle &&
          current.isLevelFrozen === isLevelFrozen &&
          current.frozenFillUnits === frozenFillUnits &&
          current.isAnimating === isAnimating &&
          Math.abs(current.liveFillUnits - liveFillUnits) < 0.01
        ) {
          return current;
        }
        return {
          tail,
          head,
          connectedToNozzle,
          isLevelFrozen,
          frozenFillUnits,
          isAnimating,
          liveFillUnits,
        };
      });
    };

    const notifyTarget = () => {
      if (targetNotifiedRef.current) return;
      targetNotifiedRef.current = true;
      onTargetReachedRef.current?.();
    };

    const atOrPastTarget = () => {
      const target = targetRef.current;
      if (target == null) return false;
      return fillUnitsRef.current <= target + 0.05;
    };

    const transferFromTank = (deltaSeconds: number) => {
      if (!hasReachedNozzleRef.current || !isHeldRef.current) return;
      const target = targetRef.current;
      if (target != null && fillUnitsRef.current <= target + 0.05) {
        notifyTarget();
        return;
      }
      let next = fillUnitsRef.current - VESSEL_FILL_DRAIN_RATE * deltaSeconds;
      if (target != null) next = Math.max(next, target);
      next = clampFillUnits(next);
      if (next !== fillUnitsRef.current) {
        fillUnitsRef.current = next;
        onChangeRef.current(next);
      }
      if (target != null && next <= target + 0.05) {
        notifyTarget();
      }
    };

    const closeValve = (): Phase => {
      frozenFillUnitsRef.current = fillUnitsRef.current;
      releaseHeadRef.current = headRef.current;
      headRef.current = releaseHeadRef.current;
      hasReachedNozzleRef.current = false;
      valveCloseElapsedRef.current = 0;
      return "valveClose";
    };

    const beginPipeDrain = (): Phase => {
      const frozenFill = frozenFillUnitsRef.current ?? fillUnitsRef.current;
      const geom = geomRef.current;
      tailRef.current = riseHeight(frozenFill, geom.columnHeight);
      return "retreat";
    };

    const resetToIdle = (): Phase => {
      tailRef.current = 0;
      headRef.current = 0;
      hasReachedNozzleRef.current = false;
      frozenFillUnitsRef.current = null;
      return "idle";
    };

    const tick = (now: number) => {
      if (!lastTime) lastTime = now;
      const deltaSeconds = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      const held = isHeldRef.current;
      const reached = atOrPastTarget();
      const active = held && !reached;
      const geom = geomRef.current;
      const atEmpty = fillUnitsRef.current <= 0;
      const pathEnd = totalHead(fillUnitsRef.current, geom);
      const nozzleEnd = riseEnd(fillUnitsRef.current, geom.columnHeight);
      const pipeSpeed =
        geom.columnHeight > 0
          ? (DRAIN_PIPE_WATER_SPEED * geom.columnHeight) / VESSEL_COMPOSITE_HEIGHT
          : DRAIN_PIPE_WATER_SPEED;
      let phase = phaseRef.current;

      if (phase === "idle" && active && !atEmpty) {
        phase = "advance";
        tailRef.current = 0;
        headRef.current = 0;
        hasReachedNozzleRef.current = false;
      }

      // Remote stream extended the drain target after valve close started — resume.
      if (
        active &&
        !atEmpty &&
        (phase === "valveClose" || phase === "retreat")
      ) {
        frozenFillUnitsRef.current = null;
        hasReachedNozzleRef.current = true;
        phase = "steady";
        tailRef.current = 0;
        headRef.current = pathEnd;
      }

      if ((reached || atEmpty) && held) {
        notifyTarget();
      }

      switch (phase) {
        case "advance": {
          if (active) {
            tailRef.current = 0;
            headRef.current = Math.min(
              pathEnd,
              headRef.current + pipeSpeed * deltaSeconds,
            );
            if (headRef.current >= nozzleEnd - 0.5) {
              hasReachedNozzleRef.current = true;
            }
            if (headRef.current >= pathEnd - 0.5) {
              phase = "steady";
            } else if (hasReachedNozzleRef.current) {
              transferFromTank(deltaSeconds);
            }
          } else if (held && targetRef.current != null) {
            // Waiting for a remote stream to extend the target.
          } else if (hasReachedNozzleRef.current) {
            phase = closeValve();
          } else {
            phase = resetToIdle();
          }
          break;
        }
        case "steady": {
          if (active) {
            tailRef.current = 0;
            headRef.current = pathEnd;
            if (!atEmpty) {
              transferFromTank(deltaSeconds);
            }
          } else if (held && targetRef.current != null) {
            // Hold the drain column open while a remote dose may still stream.
            tailRef.current = 0;
            headRef.current = pathEnd;
          } else {
            phase = closeValve();
          }
          break;
        }
        case "valveClose": {
          headRef.current = releaseHeadRef.current;
          valveCloseElapsedRef.current += deltaSeconds;
          if (valveCloseElapsedRef.current >= DRAIN_VALVE_CLOSE_DELAY) {
            phase = beginPipeDrain();
          }
          break;
        }
        case "retreat": {
          headRef.current = releaseHeadRef.current;
          tailRef.current = Math.min(
            headRef.current,
            tailRef.current + pipeSpeed * deltaSeconds,
          );

          if (tailRef.current >= headRef.current - 0.5) {
            phase = resetToIdle();
          }
          break;
        }
        default:
          break;
      }

      phaseRef.current = phase;
      publish();
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  return {
    ...visual,
    getLiveFillUnits: () =>
      phaseRef.current === "valveClose" || phaseRef.current === "retreat"
        ? (frozenFillUnitsRef.current ?? fillUnitsRef.current)
        : fillUnitsRef.current,
  };
}
