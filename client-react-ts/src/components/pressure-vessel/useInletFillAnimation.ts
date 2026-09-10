import { useEffect, useRef, useState } from "react";
import {
  INLET_PIPE_WATER_SPEED,
  VESSEL_COMPOSITE_HEIGHT,
  VESSEL_FILL_RATE,
  VESSEL_MAX_FILL_UNITS,
} from "./constants";
import { INLET_PATH_LENGTH } from "./pipe-geometry";

type Phase = "idle" | "advance" | "steady" | "retreat";

export type InletFillVisualState = {
  /** Trailing edge of water along the inlet→vessel path (clears from left on release). */
  tail: number;
  /** Leading edge of water along the inlet→vessel path (grows toward vessel on fill). */
  head: number;
  /** Fall column has reached the vessel — stream extends through the visible surface. */
  connectedToSurface: boolean;
  isAnimating: boolean;
};

function clampFillUnits(value: number) {
  return Math.min(VESSEL_MAX_FILL_UNITS, Math.max(0, value));
}

function fallHeight(fillUnits: number) {
  const fillRatio = Math.min(1, Math.max(0, fillUnits / VESSEL_MAX_FILL_UNITS));
  return (1 - fillRatio) * VESSEL_COMPOSITE_HEIGHT;
}

/** Full path length: pipe centerline + falling column to the current surface. */
function totalHead(fillUnits: number) {
  return INLET_PATH_LENGTH + fallHeight(fillUnits);
}

export function useInletFillAnimation(
  fillUnits: number,
  onFillUnitsChange: (value: number) => void,
  isFillHeld: boolean,
): InletFillVisualState {
  const [visual, setVisual] = useState<InletFillVisualState>({
    tail: 0,
    head: 0,
    connectedToSurface: false,
    isAnimating: false,
  });

  const phaseRef = useRef<Phase>("idle");
  const tailRef = useRef(0);
  const headRef = useRef(0);
  const hasReachedSurfaceRef = useRef(false);
  const isHeldRef = useRef(isFillHeld);
  const fillUnitsRef = useRef(fillUnits);
  const onChangeRef = useRef(onFillUnitsChange);

  isHeldRef.current = isFillHeld;
  fillUnitsRef.current = fillUnits;
  onChangeRef.current = onFillUnitsChange;

  useEffect(() => {
    let frame = 0;
    let lastTime = 0;

    const publish = () => {
      const tail = tailRef.current;
      const head = headRef.current;
      const connectedToSurface = hasReachedSurfaceRef.current;
      const isAnimating = phaseRef.current !== "idle";
      setVisual((current) => {
        if (
          current.tail === tail &&
          current.head === head &&
          current.connectedToSurface === connectedToSurface &&
          current.isAnimating === isAnimating
        ) {
          return current;
        }
        return { tail, head, connectedToSurface, isAnimating };
      });
    };

    const transferToTank = (deltaSeconds: number) => {
      if (!hasReachedSurfaceRef.current) return;
      const next = clampFillUnits(fillUnitsRef.current + VESSEL_FILL_RATE * deltaSeconds);
      if (next !== fillUnitsRef.current) {
        fillUnitsRef.current = next;
        onChangeRef.current(next);
      }
    };

    const tick = (now: number) => {
      if (!lastTime) lastTime = now;
      const deltaSeconds = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      const held = isHeldRef.current;
      const atFull = fillUnitsRef.current >= VESSEL_MAX_FILL_UNITS;
      const pathEnd = totalHead(fillUnitsRef.current);
      let phase = phaseRef.current;

      if (phase === "idle" && held && !atFull) {
        phase = "advance";
        tailRef.current = 0;
        headRef.current = 0;
        hasReachedSurfaceRef.current = false;
      }

      switch (phase) {
        case "advance": {
          tailRef.current = 0;
          if (held) {
            headRef.current = Math.min(
              pathEnd,
              headRef.current + INLET_PIPE_WATER_SPEED * deltaSeconds,
            );
            if (headRef.current >= pathEnd - 0.5) {
              hasReachedSurfaceRef.current = true;
              phase = "steady";
            }
          } else {
            phase = "retreat";
          }
          break;
        }
        case "steady": {
          tailRef.current = 0;
          headRef.current = pathEnd;
          if (!held) {
            phase = "retreat";
          } else if (!atFull) {
            transferToTank(deltaSeconds);
          }
          break;
        }
        case "retreat": {
          headRef.current = pathEnd;
          tailRef.current = Math.min(
            headRef.current,
            tailRef.current + INLET_PIPE_WATER_SPEED * deltaSeconds,
          );
          transferToTank(deltaSeconds);

          if (tailRef.current >= headRef.current - 0.5) {
            tailRef.current = 0;
            headRef.current = 0;
            hasReachedSurfaceRef.current = false;
            phase = "idle";
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
