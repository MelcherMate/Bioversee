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
};

function clampFillUnits(value: number) {
  return Math.min(VESSEL_MAX_FILL_UNITS, Math.max(0, value));
}

function riseHeight(fillUnits: number) {
  const fillRatio = Math.min(1, Math.max(0, fillUnits / VESSEL_MAX_FILL_UNITS));
  return fillRatio * VESSEL_COMPOSITE_HEIGHT;
}

/** Full path length: vessel column + drain pipe to the open end. */
function totalHead(fillUnits: number) {
  return riseHeight(fillUnits) + DRAIN_PIPE_PATH_LENGTH;
}

function riseEnd(fillUnits: number) {
  return riseHeight(fillUnits);
}

export function useDrainAnimation(
  fillUnits: number,
  onFillUnitsChange: (value: number) => void,
  isDrainHeld: boolean,
): DrainVisualState {
  const [visual, setVisual] = useState<DrainVisualState>({
    tail: 0,
    head: 0,
    connectedToNozzle: false,
    isLevelFrozen: false,
    frozenFillUnits: null,
    isAnimating: false,
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

  isHeldRef.current = isDrainHeld;
  fillUnitsRef.current = fillUnits;
  onChangeRef.current = onFillUnitsChange;

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
      setVisual((current) => {
        if (
          current.tail === tail &&
          current.head === head &&
          current.connectedToNozzle === connectedToNozzle &&
          current.isLevelFrozen === isLevelFrozen &&
          current.frozenFillUnits === frozenFillUnits &&
          current.isAnimating === isAnimating
        ) {
          return current;
        }
        return { tail, head, connectedToNozzle, isLevelFrozen, frozenFillUnits, isAnimating };
      });
    };

    const transferFromTank = (deltaSeconds: number) => {
      if (!hasReachedNozzleRef.current || !isHeldRef.current) return;
      const next = clampFillUnits(fillUnitsRef.current - VESSEL_FILL_DRAIN_RATE * deltaSeconds);
      if (next !== fillUnitsRef.current) {
        fillUnitsRef.current = next;
        onChangeRef.current(next);
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
      tailRef.current = riseHeight(frozenFill);
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
      const atEmpty = fillUnitsRef.current <= 0;
      const pathEnd = totalHead(fillUnitsRef.current);
      const nozzleEnd = riseEnd(fillUnitsRef.current);
      let phase = phaseRef.current;

      if (phase === "idle" && held && !atEmpty) {
        phase = "advance";
        tailRef.current = 0;
        headRef.current = 0;
        hasReachedNozzleRef.current = false;
      }

      switch (phase) {
        case "advance": {
          if (held) {
            tailRef.current = 0;
            headRef.current = Math.min(
              pathEnd,
              headRef.current + DRAIN_PIPE_WATER_SPEED * deltaSeconds,
            );
            if (headRef.current >= nozzleEnd - 0.5) {
              hasReachedNozzleRef.current = true;
            }
            if (headRef.current >= pathEnd - 0.5) {
              phase = "steady";
            } else if (hasReachedNozzleRef.current) {
              transferFromTank(deltaSeconds);
            }
          } else if (hasReachedNozzleRef.current) {
            phase = closeValve();
          } else {
            phase = resetToIdle();
          }
          break;
        }
        case "steady": {
          if (held) {
            tailRef.current = 0;
            headRef.current = pathEnd;
            if (!atEmpty) {
              transferFromTank(deltaSeconds);
            }
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
            tailRef.current + DRAIN_PIPE_WATER_SPEED * deltaSeconds,
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

  return visual;
}
