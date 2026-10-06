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
  /** Latest tank fill from the animation loop (for live meters). */
  liveFillUnits: number;
  /** Read fill from the rAF loop without waiting for React state. */
  getLiveFillUnits: () => number;
};

/** Pipe + falling-column geometry for a vessel inlet. */
export type InletFillGeometry = {
  /** Metal pipe centerline length (open end → nozzle). */
  pipePathLength: number;
  /** Interior height used for the falling column to the free surface. */
  columnHeight: number;
};

export type InletFillOptions = {
  /** Stop transferring once the tank reaches this fill (click-to-dose). */
  targetFillUnits?: number | null;
  /** Fired once when the target is reached (or tank is full). */
  onTargetReached?: () => void;
};

export const DEFAULT_INLET_FILL_GEOMETRY: InletFillGeometry = {
  pipePathLength: INLET_PATH_LENGTH,
  columnHeight: VESSEL_COMPOSITE_HEIGHT,
};

function clampFillUnits(value: number) {
  return Math.min(VESSEL_MAX_FILL_UNITS, Math.max(0, value));
}

function fallHeight(fillUnits: number, columnHeight: number) {
  const fillRatio = Math.min(1, Math.max(0, fillUnits / VESSEL_MAX_FILL_UNITS));
  return (1 - fillRatio) * columnHeight;
}

/** Full path length: pipe centerline + falling column to the current surface. */
function totalHead(fillUnits: number, geom: InletFillGeometry) {
  return geom.pipePathLength + fallHeight(fillUnits, geom.columnHeight);
}

export function useInletFillAnimation(
  fillUnits: number,
  onFillUnitsChange: (value: number) => void,
  isFillHeld: boolean,
  geometry: InletFillGeometry = DEFAULT_INLET_FILL_GEOMETRY,
  options: InletFillOptions = {},
): InletFillVisualState {
  const [visual, setVisual] = useState<Omit<InletFillVisualState, "getLiveFillUnits">>({
    tail: 0,
    head: 0,
    connectedToSurface: false,
    isAnimating: false,
    liveFillUnits: fillUnits,
  });

  const phaseRef = useRef<Phase>("idle");
  const tailRef = useRef(0);
  const headRef = useRef(0);
  const hasReachedSurfaceRef = useRef(false);
  const isHeldRef = useRef(isFillHeld);
  const fillUnitsRef = useRef(fillUnits);
  const onChangeRef = useRef(onFillUnitsChange);
  const geomRef = useRef(geometry);
  const targetRef = useRef(options.targetFillUnits ?? null);
  const onTargetReachedRef = useRef(options.onTargetReached);
  const targetNotifiedRef = useRef(false);

  isHeldRef.current = isFillHeld;
  onChangeRef.current = onFillUnitsChange;
  geomRef.current = geometry;
  targetRef.current =
    options.targetFillUnits === undefined ? null : options.targetFillUnits;
  onTargetReachedRef.current = options.onTargetReached;
  // While animating, the rAF loop owns fillUnitsRef — don't clobber it with
  // a possibly-stale React state value mid-transfer.
  if (phaseRef.current === "idle") {
    fillUnitsRef.current = fillUnits;
  }

  useEffect(() => {
    if (isFillHeld) targetNotifiedRef.current = false;
  }, [isFillHeld]);

  useEffect(() => {
    let frame = 0;
    let lastTime = 0;

    const publish = () => {
      const tail = tailRef.current;
      const head = headRef.current;
      const connectedToSurface = hasReachedSurfaceRef.current;
      const isAnimating = phaseRef.current !== "idle";
      const liveFillUnits = fillUnitsRef.current;
      setVisual((current) => {
        if (
          current.tail === tail &&
          current.head === head &&
          current.connectedToSurface === connectedToSurface &&
          current.isAnimating === isAnimating &&
          Math.abs(current.liveFillUnits - liveFillUnits) < 0.01
        ) {
          return current;
        }
        return { tail, head, connectedToSurface, isAnimating, liveFillUnits };
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
      return fillUnitsRef.current >= target - 0.05;
    };

    const transferToTank = (deltaSeconds: number) => {
      if (!hasReachedSurfaceRef.current) return;
      const target = targetRef.current;
      if (target != null && fillUnitsRef.current >= target - 0.05) {
        notifyTarget();
        return;
      }
      let next = fillUnitsRef.current + VESSEL_FILL_RATE * deltaSeconds;
      if (target != null) next = Math.min(next, target);
      next = clampFillUnits(next);
      if (next !== fillUnitsRef.current) {
        fillUnitsRef.current = next;
        onChangeRef.current(next);
      }
      if (target != null && next >= target - 0.05) {
        notifyTarget();
      }
    };

    const tick = (now: number) => {
      if (!lastTime) lastTime = now;
      const deltaSeconds = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      const held = isHeldRef.current;
      const target = targetRef.current;
      const reached = atOrPastTarget();
      const active = held && !reached;
      const geom = geomRef.current;
      const atFull = fillUnitsRef.current >= VESSEL_MAX_FILL_UNITS;
      const pathEnd = totalHead(fillUnitsRef.current, geom);
      const pipeSpeed =
        geom.columnHeight > 0
          ? (INLET_PIPE_WATER_SPEED * geom.columnHeight) / VESSEL_COMPOSITE_HEIGHT
          : INLET_PIPE_WATER_SPEED;
      let phase = phaseRef.current;

      if (phase === "idle" && active && !atFull) {
        phase = "advance";
        tailRef.current = 0;
        headRef.current = 0;
        hasReachedSurfaceRef.current = false;
      }

      if ((reached || atFull) && held) {
        notifyTarget();
      }

      switch (phase) {
        case "advance": {
          tailRef.current = 0;
          if (active) {
            headRef.current = Math.min(
              pathEnd,
              headRef.current + pipeSpeed * deltaSeconds,
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
          if (!active) {
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
            tailRef.current + pipeSpeed * deltaSeconds,
          );
          // Hold mode keeps a short trickle; targeted doses stop at the set volume.
          if (target == null) {
            transferToTank(deltaSeconds);
          }

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

  return {
    ...visual,
    getLiveFillUnits: () => fillUnitsRef.current,
  };
}
