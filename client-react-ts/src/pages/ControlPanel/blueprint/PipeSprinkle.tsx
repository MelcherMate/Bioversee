import { useEffect, useMemo, useRef, useState } from "react";
import { useStore, type ReactFlowState } from "@xyflow/react";
import type { PlantTransferSnapshot } from "../../../lib/plantTransferJobs";
import "./PipeSprinkle.css";

type Particle = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
};

type SprinklePoint = {
  key: string;
  x: number;
  y: number;
  dx: number;
  dy: number;
  rate: number;
};

function leaveDirection(handleId: string): { dx: number; dy: number } {
  switch (handleId) {
    case "outlet":
    case "s":
      return { dx: 0, dy: 1 };
    case "stem":
      // Stem faces up on split, down on merge — default down; good enough for spray.
      return { dx: 0, dy: 1 };
    case "inlet":
    case "n":
      return { dx: 0, dy: -1 };
    case "e":
    case "right":
    case "thin":
      return { dx: 1, dy: 0 };
    case "w":
    case "left":
    case "wide":
      return { dx: -1, dy: 0 };
    default:
      return { dx: 0, dy: 1 };
  }
}

type PipeSprinkleProps = {
  snap: PlantTransferSnapshot | null;
};

/**
 * Atmosphere spray at open pipe ends while a plant drain has sprinkle sinks.
 * Coordinates are in React Flow viewport space (use inside ViewportPortal).
 */
export default function PipeSprinkle({ snap }: PipeSprinkleProps) {
  const nodeLookup = useStore((s: ReactFlowState) => s.nodeLookup);
  const [particles, setParticles] = useState<Particle[]>([]);
  const nextId = useRef(0);
  const pointsRef = useRef<SprinklePoint[]>([]);

  const points = useMemo((): SprinklePoint[] => {
    if (!snap || snap.done) return [];
    const result: SprinklePoint[] = [];
    for (const sink of snap.flow.sinks) {
      if (sink.kind !== "sprinkle" || sink.rate < 0.01) continue;
      // Wait until the water front reaches this open end.
      const pathLen = sink.edgeIds.length;
      if (pathLen > 0) {
        const lastEdge = sink.edgeIds[pathLen - 1]!;
        if ((snap.edgeProgress[lastEdge] ?? 0) < 0.98) continue;
      }
      const node = nodeLookup.get(sink.deviceId);
      if (!node) continue;
      const w = node.measured.width ?? 0;
      const h = node.measured.height ?? 0;
      const abs = node.internals.positionAbsolute;
      const dir = leaveDirection(sink.handleId);
      let x = abs.x + w / 2;
      let y = abs.y + h / 2;
      if (dir.dx < 0) x = abs.x;
      if (dir.dx > 0) x = abs.x + w;
      if (dir.dy < 0) y = abs.y;
      if (dir.dy > 0) y = abs.y + h;
      result.push({
        key: `${sink.deviceId}:${sink.handleId}`,
        x,
        y,
        dx: dir.dx,
        dy: dir.dy,
        rate: sink.rate,
      });
    }
    return result;
  }, [snap, nodeLookup]);

  pointsRef.current = points;
  const active = points.length > 0;

  useEffect(() => {
    if (!active) {
      setParticles([]);
      return;
    }

    let frame = 0;
    let last = 0;

    const tick = (now: number) => {
      if (!last) last = now;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      setParticles((prev) => {
        const alive = prev
          .map((p) => ({
            ...p,
            x: p.x + p.vx * dt,
            y: p.y + p.vy * dt,
            vy: p.vy + 220 * dt,
            life: p.life - dt,
          }))
          .filter((p) => p.life > 0);

        const spawned: Particle[] = [];
        for (const point of pointsRef.current) {
          const n = Math.min(4, Math.ceil(point.rate / 25));
          for (let i = 0; i < n; i++) {
            if (Math.random() > 0.55) continue;
            const spray = 40 + Math.random() * 70;
            const jitter = (Math.random() - 0.5) * 50;
            const ox = -point.dy;
            const oy = point.dx;
            spawned.push({
              id: nextId.current++,
              x: point.x + (Math.random() - 0.5) * 4,
              y: point.y + (Math.random() - 0.5) * 4,
              vx: point.dx * spray + ox * jitter,
              vy: point.dy * spray + oy * jitter,
              life: 0.35 + Math.random() * 0.35,
              maxLife: 0.7,
              size: 2 + Math.random() * 2.5,
            });
          }
        }
        return [...alive, ...spawned].slice(-120);
      });

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active]);

  if (particles.length === 0) return null;

  return (
    <div className="bp-sprinkle" aria-hidden="true">
      {particles.map((p) => (
        <span
          key={p.id}
          className="bp-sprinkle__drop"
          style={{
            left: p.x,
            top: p.y,
            width: p.size * 2,
            height: p.size * 2,
            opacity: Math.max(0, p.life / p.maxLife),
          }}
        />
      ))}
    </div>
  );
}
