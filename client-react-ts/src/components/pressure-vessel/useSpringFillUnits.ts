import { useEffect, useRef, useState } from "react";
import { createSpringState } from "./wave-path";

type UseSpringFillUnitsOptions = {
  stiffness?: number;
  damping?: number;
};

export function useSpringFillUnits(
  target: number,
  { stiffness = 160, damping = 0.74 }: UseSpringFillUnitsOptions = {},
) {
  const springRef = useRef(createSpringState(target));
  const [displayValue, setDisplayValue] = useState(target);
  const [fillVelocity, setFillVelocity] = useState(0);
  const [flowRate, setFlowRate] = useState(0);
  const targetRef = useRef(target);
  const prevTargetRef = useRef(target);

  useEffect(() => {
    const delta = target - prevTargetRef.current;
    if (delta !== 0) {
      const magnitude = Math.abs(delta);
      setFillVelocity((current) => Math.max(current, magnitude * 8));
      // Kick the signed flow immediately so the pipes react on the same frame
      // the target changes (positive = filling, negative = draining).
      const kick = Math.sign(delta) * Math.min(magnitude * 12, 320);
      setFlowRate((current) => (Math.abs(kick) > Math.abs(current) ? kick : current));
    }
    prevTargetRef.current = target;
    targetRef.current = target;
  }, [target]);

  useEffect(() => {
    let frame = 0;
    let lastTime = 0;

    const tick = (now: number) => {
      if (!lastTime) lastTime = now;
      const deltaSeconds = Math.min(0.04, (now - lastTime) / 1000);
      lastTime = now;

      const prev = springRef.current.value;
      let next = springRef.current.step(targetRef.current, deltaSeconds, stiffness, damping);
      // Snap when nearly settled so empty/full targets don't leave a residual puddle.
      if (
        Math.abs(next - targetRef.current) < 0.35 &&
        Math.abs(springRef.current.velocity) < 2.5
      ) {
        springRef.current.snap(targetRef.current);
        next = targetRef.current;
      }
      const signedRate = (next - prev) / Math.max(deltaSeconds, 0.001);
      const velocity = Math.abs(signedRate);

      setDisplayValue(next);
      setFillVelocity((current) => current * 0.85 + velocity * 0.15);
      setFlowRate((current) => current * 0.8 + signedRate * 0.2);

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [stiffness, damping]);

  return { displayFillUnits: displayValue, fillVelocity, flowRate };
}
