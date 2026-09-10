import { useEffect, useRef, useState } from "react";
import {
  MBR_FLOW_PATH_LEN,
  MBR_INLET_FALL_LEN,
  MBR_INLET_PIPE_LEN,
  MBR_VALVE_CLOSE_DELAY,
} from "./constants";
import { INLET_PIPE_WATER_SPEED } from "../pressure-vessel/constants";

type Phase = "idle" | "advance" | "steady" | "valveClose" | "retreat";

export type MbrFlowVisualState = {
  tail: number;
  head: number;
  connectedToWater: boolean;
  connectedToEffluent: boolean;
  isAnimating: boolean;
};

const FALL_START = MBR_INLET_PIPE_LEN;
const EFFLUENT_START = MBR_INLET_PIPE_LEN + MBR_INLET_FALL_LEN;

export function useMbrFlowAnimation(isFlowOn: boolean): MbrFlowVisualState {
  const [visual, setVisual] = useState<MbrFlowVisualState>({
    tail: 0,
    head: 0,
    connectedToWater: false,
    connectedToEffluent: false,
    isAnimating: false,
  });

  const phaseRef = useRef<Phase>("idle");
  const tailRef = useRef(0);
  const headRef = useRef(0);
  const releaseHeadRef = useRef(0);
  const valveCloseElapsedRef = useRef(0);
  const isOnRef = useRef(isFlowOn);

  isOnRef.current = isFlowOn;

  useEffect(() => {
    let frame = 0;
    let lastTime = 0;

    const publish = () => {
      const tail = tailRef.current;
      const head = headRef.current;
      const connectedToWater = head >= FALL_START - 0.5;
      const connectedToEffluent = head >= EFFLUENT_START - 0.5;
      const isAnimating = phaseRef.current !== "idle";
      setVisual((current) => {
        if (
          current.tail === tail &&
          current.head === head &&
          current.connectedToWater === connectedToWater &&
          current.connectedToEffluent === connectedToEffluent &&
          current.isAnimating === isAnimating
        ) {
          return current;
        }
        return { tail, head, connectedToWater, connectedToEffluent, isAnimating };
      });
    };

    const closeValve = (): Phase => {
      releaseHeadRef.current = headRef.current;
      headRef.current = releaseHeadRef.current;
      valveCloseElapsedRef.current = 0;
      return "valveClose";
    };

    const beginRetreat = (): Phase => {
      tailRef.current = 0;
      return "retreat";
    };

    const resetToIdle = (): Phase => {
      tailRef.current = 0;
      headRef.current = 0;
      return "idle";
    };

    const tick = (now: number) => {
      if (!lastTime) lastTime = now;
      const deltaSeconds = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      const on = isOnRef.current;
      const pathEnd = MBR_FLOW_PATH_LEN;
      let phase = phaseRef.current;

      if (phase === "idle" && on) {
        phase = "advance";
        tailRef.current = 0;
        headRef.current = 0;
      }

      switch (phase) {
        case "advance": {
          if (on) {
            tailRef.current = 0;
            headRef.current = Math.min(
              pathEnd,
              headRef.current + INLET_PIPE_WATER_SPEED * deltaSeconds,
            );
            if (headRef.current >= pathEnd - 0.5) {
              phase = "steady";
            }
          } else if (headRef.current >= FALL_START - 0.5) {
            phase = closeValve();
          } else {
            phase = resetToIdle();
          }
          break;
        }
        case "steady": {
          if (on) {
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
          if (valveCloseElapsedRef.current >= MBR_VALVE_CLOSE_DELAY) {
            phase = beginRetreat();
          }
          break;
        }
        case "retreat": {
          headRef.current = releaseHeadRef.current;
          tailRef.current = Math.min(
            headRef.current,
            tailRef.current + INLET_PIPE_WATER_SPEED * deltaSeconds,
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
