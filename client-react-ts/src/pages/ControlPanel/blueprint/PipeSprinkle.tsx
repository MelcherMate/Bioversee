import { useEffect, useMemo, useRef, useState } from "react";
import {
  useStore,
  type Edge,
  type InternalNode,
  type ReactFlowState,
} from "@xyflow/react";
import { parseBioreactorConfig } from "../../../lib/bioreactorGeometry";
import type { AccessibleDevice } from "../../../lib/devices";
import {
  fittingHandleOutward,
  fittingHandlePoint,
  isPipeFittingDeviceType,
  parsePipeFittingConfig,
} from "../../../lib/pipeFittings";
import type { PlantTransferSnapshot } from "../../../lib/plantTransferJobs";
import { FITTING_SCALE } from "./PipeFittingNode";
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

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

/** Fallback when we only know the handle id (no fitting/reactor geometry). */
function leaveDirectionFallback(handleId: string): { dx: number; dy: number } {
  switch (handleId) {
    case "outlet":
    case "s":
    case "stem":
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

function bioreactorOutletDir(device: AccessibleDevice): { dx: number; dy: number } {
  const { piping } = parseBioreactorConfig(device.config);
  if (piping.outlet === "left") return { dx: -1, dy: 0 };
  if (piping.outlet === "right") return { dx: 1, dy: 0 };
  return { dx: 0, dy: 1 };
}

/** Painted tip of a React Flow handle in flow coordinates. */
function handleTip(
  node: InternalNode,
  handleId: string
): { x: number; y: number } | null {
  const bounds = [
    ...(node.internals.handleBounds?.source ?? []),
    ...(node.internals.handleBounds?.target ?? []),
  ];
  const handle = bounds.find((b) => b.id === handleId);
  if (!handle) return null;
  const { x: ax, y: ay } = node.internals.positionAbsolute;
  return {
    x: ax + handle.x + handle.width / 2,
    y: ay + handle.y + handle.height / 2,
  };
}

function sprinklePointForSink(
  node: InternalNode,
  handleId: string,
  rate: number,
  key: string
): SprinklePoint {
  const abs = node.internals.positionAbsolute;
  const device = (node.data as { device?: AccessibleDevice } | undefined)?.device;

  let dx = 0;
  let dy = 1;
  if (device && isPipeFittingDeviceType(device.type)) {
    const config = parsePipeFittingConfig(device.config);
    const dir = fittingHandleOutward(config, handleId);
    dx = dir.dx;
    dy = dir.dy;
  } else if (device?.type === "bioreactor" && handleId === "outlet") {
    const dir = bioreactorOutletDir(device);
    dx = dir.dx;
    dy = dir.dy;
  } else {
    const dir = leaveDirectionFallback(handleId);
    dx = dir.dx;
    dy = dir.dy;
  }

  // Prefer the live handle tip — AABB edges sit on the vessel body and put
  // spray in empty space next to the tank instead of at the open pipe end.
  const tip = handleTip(node, handleId);
  if (tip) {
    return {
      key,
      x: tip.x + dx * 6,
      y: tip.y + dy * 6,
      dx,
      dy,
      rate,
    };
  }

  if (device && isPipeFittingDeviceType(device.type)) {
    const config = parsePipeFittingConfig(device.config);
    const point = fittingHandlePoint(config, handleId);
    if (point) {
      return {
        key,
        x: abs.x + point.x * FITTING_SCALE + dx * 6,
        y: abs.y + point.y * FITTING_SCALE + dy * 6,
        dx,
        dy,
        rate,
      };
    }
  }

  // Last resort: edge of the measured box facing the leave direction.
  const w = node.measured.width ?? 0;
  const h = node.measured.height ?? 0;
  let x = abs.x + w / 2;
  let y = abs.y + h / 2;
  if (dx < 0) x = abs.x;
  if (dx > 0) x = abs.x + w;
  if (dy < 0) y = abs.y;
  if (dy > 0) y = abs.y + h;

  return { key, x: x + dx * 6, y: y + dy * 6, dx, dy, rate };
}

/** Handle of `deviceId` that the edge attaches to, if any. */
function edgeHandleOnDevice(
  edge: Edge | undefined,
  deviceId: string
): string | null {
  if (!edge) return null;
  if (edge.source === deviceId) return edge.sourceHandle ?? null;
  if (edge.target === deviceId) return edge.targetHandle ?? null;
  return null;
}

/**
 * How much water is at the open tip (0 = dry, 1 = pouring).
 * - Plant pipe to the open handle: last-edge slug must have reached the end
 *   and not yet cleared.
 * - Open fitting port reached via another handle: wait until water has crossed
 *   the fitting body into the exit half, then clear with the incoming tail.
 * - Direct vessel outlet (no plant pipe): metal outlet primed → cleared.
 */
function tipWet01(
  snap: PlantTransferSnapshot,
  sink: { deviceId: string; handleId: string; edgeIds: string[] },
  edgeLookup: Map<string, Edge>
): number {
  const pathLen = sink.edgeIds.length;

  if (pathLen === 0) {
    if (sink.handleId !== "outlet") return 0;
    const outlet = snap.sourceOutlet[sink.deviceId];
    if (!outlet?.primed || outlet.cleared) return 0;
    return 1;
  }

  const lastEdgeId = sink.edgeIds[pathLen - 1]!;
  const head = snap.edgeProgress[lastEdgeId] ?? 0;
  const tail = snap.edgeTail[lastEdgeId] ?? 0;
  const attachHandle = edgeHandleOnDevice(
    edgeLookup.get(lastEdgeId),
    sink.deviceId
  );

  // Last plant pipe lands on the open port itself.
  if (attachHandle === sink.handleId) {
    if (head < 0.995) return 0;
    return Math.max(0, head - tail);
  }

  // Arrived on another seat of this fitting — water must cross the body first.
  // Enter half tracks the end of the incoming edge; leave half is the open arm.
  const seam = 0.9;
  const span = 1 - seam;
  const enter = clamp01((head - seam) / span);
  const leave = head >= seam ? clamp01((head - seam) / span) : 0;
  const enterTail = clamp01((tail - seam) / span);
  const leaveTail = tail >= seam ? clamp01((tail - seam) / span) : 0;
  const head01 = clamp01(0.5 * enter + 0.5 * leave);
  const tail01 = clamp01(0.5 * enterTail + 0.5 * leaveTail);
  const exitHead = clamp01((head01 - 0.5) / 0.5);
  const exitTail = clamp01((tail01 - 0.5) / 0.5);
  return Math.max(0, exitHead - exitTail);
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
  const edgeLookup = useStore((s: ReactFlowState) => s.edgeLookup);
  const [particles, setParticles] = useState<Particle[]>([]);
  const nextId = useRef(0);
  const pointsRef = useRef<SprinklePoint[]>([]);

  const points = useMemo((): SprinklePoint[] => {
    if (!snap || snap.done) return [];
    const result: SprinklePoint[] = [];
    for (const sink of snap.flow.sinks) {
      if (sink.kind !== "sprinkle" || sink.rate < 0.01) continue;
      // Never spray out of a fill port.
      if (sink.handleId === "inlet") continue;

      const tipWet = tipWet01(snap, sink, edgeLookup);
      // Start only once water is at the tip; stop once the tip is dry.
      if (tipWet < 0.02) continue;

      const node = nodeLookup.get(sink.deviceId);
      if (!node) continue;
      result.push(
        sprinklePointForSink(
          node,
          sink.handleId,
          sink.rate * Math.min(1, tipWet / 0.25),
          `${sink.deviceId}:${sink.handleId}`
        )
      );
    }
    return result;
  }, [snap, nodeLookup, edgeLookup]);

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
