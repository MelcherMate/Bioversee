import { useEffect, useRef, useState } from "react";
import {
  createSpringState,
  waveSloshRisePx,
  waveSloshTarget,
  WAVE_SURFACE_Y,
} from "./wave-path";

export function useWaveSurfaceSlosh(fillVelocity: number, containerHeightPx = 40) {
  const springRef = useRef(createSpringState(WAVE_SURFACE_Y));
  const velocityRef = useRef(fillVelocity);
  const [state, setState] = useState({ sloshRisePx: 0, baselineY: WAVE_SURFACE_Y });

  useEffect(() => {
    velocityRef.current = fillVelocity;
  }, [fillVelocity]);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reducedMotion) {
      const baselineY = waveSloshTarget(fillVelocity);
      setState({
        sloshRisePx: waveSloshRisePx(baselineY, containerHeightPx),
        baselineY,
      });
      return;
    }

    let frame = 0;
    let lastTime = 0;

    const tick = (now: number) => {
      if (!lastTime) lastTime = now;
      const deltaSeconds = Math.min(0.04, (now - lastTime) / 1000);
      lastTime = now;

      const baselineY = springRef.current.step(
        waveSloshTarget(velocityRef.current),
        deltaSeconds,
        200,
        0.65,
      );
      setState({
        sloshRisePx: waveSloshRisePx(baselineY, containerHeightPx),
        baselineY,
      });

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [containerHeightPx, fillVelocity]);

  return state;
}
