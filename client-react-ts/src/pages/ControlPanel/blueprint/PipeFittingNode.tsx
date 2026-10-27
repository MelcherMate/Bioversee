import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
} from "react";
import { useTranslation } from "react-i18next";
import {
  Handle,
  Position,
  useNodeConnections,
  useNodeId,
  useUpdateNodeInternals,
  type Node,
  type NodeConnection,
  type NodeProps,
} from "@xyflow/react";
import { waterWidthForOd } from "../../../components/Canvas/bioreactorLayout";
import { APPLE_DEPTH_COLORS } from "../../../components/pressure-vessel/apple-depth-style";
import { PIPE_FILL, PIPE_METAL } from "../../../components/pressure-vessel/pipe-style";
import type { AccessibleDevice } from "../../../lib/devices";
import type { PlantTransferSnapshot } from "../../../lib/plantTransferJobs";
import {
  boreOd,
  fittingHandleOd,
  nextFittingRotation,
  parsePipeFittingConfig,
  type PipeFittingConfig,
  type PipeFittingRotation,
} from "../../../lib/pipeFittings";
import { useBlueprint } from "./BlueprintContext";
import { REACTOR_SCALE } from "./ReactorNode";
import { usePlantFlowVisual } from "./usePlantFlowVisual";
import "./PipeFittingNode.css";

export type PipeFittingNodeData = { device: AccessibleDevice };

export const FITTING_SCALE = REACTOR_SCALE;

/** Authoring size; rendered at FITTING_SCALE. */
const SIZE = 160;
const CX = SIZE / 2;
const CY = SIZE / 2;
/** Pipe ends sit on the node edge so routed pipes meet flush. */
const ARM = SIZE / 2;

type PortSide = "n" | "s" | "e" | "w";

type PortSpec = {
  id: string;
  /** Visual side before rotation (used for Position + rotation). */
  side: PortSide;
  /** End point in unscaled drawing coords (before rotation). */
  x: number;
  y: number;
  role: "source" | "target" | "either";
};

function rotatePoint(
  x: number,
  y: number,
  rotation: PipeFittingRotation
): { x: number; y: number } {
  const dx = x - CX;
  const dy = y - CY;
  switch (rotation) {
    case 90:
      return { x: CX - dy, y: CY + dx };
    case 180:
      return { x: CX - dx, y: CY - dy };
    case 270:
      return { x: CX + dy, y: CY - dx };
    default:
      return { x, y };
  }
}

/** Leave-direction from where the end sits on the node, after rotation. */
function positionForPoint(x: number, y: number): Position {
  const dx = x - CX;
  const dy = y - CY;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? Position.Right : Position.Left;
  }
  return dy >= 0 ? Position.Bottom : Position.Top;
}

function portsFor(config: PipeFittingConfig): PortSpec[] {
  switch (config.kind) {
    case "cross":
      return [
        { id: "n", side: "n", x: CX, y: CY - ARM, role: "either" },
        { id: "s", side: "s", x: CX, y: CY + ARM, role: "either" },
        { id: "e", side: "e", x: CX + ARM, y: CY, role: "either" },
        { id: "w", side: "w", x: CX - ARM, y: CY, role: "either" },
      ];
    case "wye_split": {
      // Square U-fork: stem in, then 90° out on two parallel legs (no 45° Y).
      const leg = ARM * 0.55;
      return [
        { id: "stem", side: "n", x: CX, y: CY - ARM, role: "target" },
        { id: "left", side: "s", x: CX - leg, y: CY + ARM, role: "source" },
        { id: "right", side: "s", x: CX + leg, y: CY + ARM, role: "source" },
      ];
    }
    case "wye_merge": {
      const leg = ARM * 0.55;
      return [
        { id: "left", side: "n", x: CX - leg, y: CY - ARM, role: "target" },
        { id: "right", side: "n", x: CX + leg, y: CY - ARM, role: "target" },
        { id: "stem", side: "s", x: CX, y: CY + ARM, role: "source" },
      ];
    }
    case "reducer":
      return [
        { id: "wide", side: "w", x: CX - ARM, y: CY, role: "either" },
        { id: "thin", side: "e", x: CX + ARM, y: CY, role: "either" },
      ];
  }
}

/** Shared U-fork geometry in authoring coords (pre-rotation). */
function wyeGeom(od: number) {
  const leg = ARM * 0.55;
  const barY = CY + ARM * 0.05;
  const bend = Math.min(
    leg * 0.5,
    (CY + ARM - barY) * 0.4,
    Math.max(14, od * 0.95)
  );
  return { leg, barY, bend };
}

type FittingWaterSeg = {
  key: string;
  d: string;
  head01: number;
  tail01: number;
};

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

/**
 * Fitting water lives on the seam between consecutive edges.
 * `enterFrac` weights the inbound arm so a long U-leg doesn't finish in the
 * same dash time as the short stem (steady visual speed through the fitting).
 */
function fittingCorridorSpan(
  inHead: number,
  inTail: number,
  outHead: number,
  outTail: number,
  enterFrac = 0.5
): { head01: number; tail01: number } {
  const seam = 0.85;
  const span = 1 - seam;
  const ef = clamp01(enterFrac);
  const lf = 1 - ef;
  const enter = clamp01((inHead - seam) / span);
  const leave = inHead >= seam ? clamp01(outHead) : 0;
  const enterTail = clamp01((inTail - seam) / span);
  const leaveTail = inTail >= seam ? clamp01(outTail) : 0;
  return {
    head01: clamp01(ef * enter + lf * leave),
    tail01: clamp01(ef * enterTail + lf * leaveTail),
  };
}

/** Half-corridor pieces that meet at the junction with butt caps (no T-blob). */
type CorridorParts = {
  enter: string;
  leave: string;
  /** Shared leave geometry key so dual merges don't double-paint the stem. */
  leaveKey: string;
  enterKey: string;
  /** Approximate enter length / (enter+leave) for steady dash speed. */
  enterFrac: number;
};

function wyeCorridorParts(
  config: PipeFittingConfig,
  from: string,
  to: string,
  od: number
): CorridorParts | null {
  if (from === to) return null;
  if (config.kind !== "wye_merge" && config.kind !== "wye_split") return null;

  const { leg, barY, bend } = wyeGeom(od);
  const merge = config.kind === "wye_merge";
  // Overlap stem into the crossbar like the metal path (avoids a dry notch).
  const join = od * 0.4;
  const leftEnter = merge
    ? `M ${CX - leg} ${CY - ARM} V ${barY - bend} A ${bend} ${bend} 0 0 0 ${CX - leg + bend} ${barY} H ${CX}`
    : `M ${CX - leg} ${CY + ARM} V ${barY + bend} A ${bend} ${bend} 0 0 1 ${CX - leg + bend} ${barY} H ${CX}`;
  const rightEnter = merge
    ? `M ${CX + leg} ${CY - ARM} V ${barY - bend} A ${bend} ${bend} 0 0 1 ${CX + leg - bend} ${barY} H ${CX}`
    : `M ${CX + leg} ${CY + ARM} V ${barY + bend} A ${bend} ${bend} 0 0 0 ${CX + leg - bend} ${barY} H ${CX}`;
  const stemEnter = merge
    ? `M ${CX} ${CY + ARM} V ${barY}`
    : `M ${CX} ${CY - ARM} V ${barY}`;
  const leftLeave = merge
    ? `M ${CX} ${barY} H ${CX - leg + bend} A ${bend} ${bend} 0 0 1 ${CX - leg} ${barY - bend} V ${CY - ARM}`
    : `M ${CX} ${barY} H ${CX - leg + bend} A ${bend} ${bend} 0 0 0 ${CX - leg} ${barY + bend} V ${CY + ARM}`;
  const rightLeave = merge
    ? `M ${CX} ${barY} H ${CX + leg - bend} A ${bend} ${bend} 0 0 0 ${CX + leg} ${barY - bend} V ${CY - ARM}`
    : `M ${CX} ${barY} H ${CX + leg - bend} A ${bend} ${bend} 0 0 1 ${CX + leg} ${barY + bend} V ${CY + ARM}`;
  // Stem overlaps the bar the same way the metal U does.
  const stemLeave = merge
    ? `M ${CX} ${barY - join} V ${CY + ARM}`
    : `M ${CX} ${barY + join} V ${CY - ARM}`;

  // U-leg (port→elbow→bar to junction) is ~2× the stem length.
  const armFrac = 0.68;
  const stemFrac = 0.45;

  const pair = `${from}>${to}`;
  if (pair === "left>stem")
    return {
      enter: leftEnter,
      leave: stemLeave,
      enterKey: "in:left",
      leaveKey: "out:stem",
      enterFrac: armFrac,
    };
  if (pair === "right>stem")
    return {
      enter: rightEnter,
      leave: stemLeave,
      enterKey: "in:right",
      leaveKey: "out:stem",
      enterFrac: armFrac,
    };
  if (pair === "stem>left")
    return {
      enter: stemEnter,
      leave: leftLeave,
      enterKey: "in:stem",
      leaveKey: "out:left",
      enterFrac: stemFrac,
    };
  if (pair === "stem>right")
    return {
      enter: stemEnter,
      leave: rightLeave,
      enterKey: "in:stem",
      leaveKey: "out:right",
      enterFrac: stemFrac,
    };
  // Open-arm sprinkle across the U cup (arm → other arm via the junction).
  if (pair === "left>right")
    return {
      enter: leftEnter,
      leave: rightLeave,
      enterKey: "in:left",
      leaveKey: "out:right",
      enterFrac: 0.5,
    };
  if (pair === "right>left")
    return {
      enter: rightEnter,
      leave: leftLeave,
      enterKey: "in:right",
      leaveKey: "out:left",
      enterFrac: 0.5,
    };
  return null;
}

/**
 * Continuous centerline from one port to another through the junction.
 * Drawn as a single path so water can dash in/out without T-junction blobs.
 */
function corridorPath(
  config: PipeFittingConfig,
  from: string,
  to: string,
  od: number
): string | null {
  if (from === to) return null;

  const wye = wyeCorridorParts(config, from, to, od);
  if (wye) return `${wye.enter} ${wye.leave.replace(/^M /, "L ")}`;

  if (config.kind === "cross") {
    const ns = new Set(["n", "s"]);
    const ew = new Set(["e", "w"]);
    if (ns.has(from) && ns.has(to)) {
      return from === "n"
        ? `M ${CX} ${CY - ARM} V ${CY + ARM}`
        : `M ${CX} ${CY + ARM} V ${CY - ARM}`;
    }
    if (ew.has(from) && ew.has(to)) {
      return from === "w"
        ? `M ${CX - ARM} ${CY} H ${CX + ARM}`
        : `M ${CX + ARM} ${CY} H ${CX - ARM}`;
    }
    return null;
  }

  if (config.kind === "reducer") {
    if (
      (from === "wide" && to === "thin") ||
      (from === "thin" && to === "wide")
    ) {
      return from === "wide"
        ? `M ${CX - ARM} ${CY} H ${CX + ARM}`
        : `M ${CX + ARM} ${CY} H ${CX - ARM}`;
    }
  }
  return null;
}

/**
 * Map a 0–1 corridor span onto the enter arm [0, split) or leave stem [split, 1].
 * `split` matches enterFrac so length-weighted corridors stay in sync.
 */
function halfSpan(
  head01: number,
  tail01: number,
  which: "enter" | "leave",
  split = 0.5
): { head01: number; tail01: number } | null {
  const cut = Math.min(0.9, Math.max(0.1, split));
  const lo = which === "enter" ? 0 : cut;
  const hi = which === "enter" ? cut : 1;
  const head = clamp01((head01 - lo) / (hi - lo));
  const tail = clamp01((tail01 - lo) / (hi - lo));
  if (head - tail < 0.01) return null;
  return { head01: head, tail01: tail };
}

function handleOnNode(
  connection: NodeConnection,
  nodeId: string
): string | null {
  if (connection.source === nodeId) return connection.sourceHandle ?? null;
  if (connection.target === nodeId) return connection.targetHandle ?? null;
  return null;
}

/** Animated water corridors through this fitting from the live plant slug. */
function fittingWaterSegments(
  nodeId: string,
  config: PipeFittingConfig,
  connections: NodeConnection[],
  plantFlow: PlantTransferSnapshot | null,
  od: number
): FittingWaterSeg[] {
  if (!plantFlow) return [];
  const byEdge = new Map(connections.map((c) => [c.edgeId, c]));
  const segments: FittingWaterSeg[] = [];
  const seen = new Set<string>();

  const upsert = (key: string, d: string, head01: number, tail01: number) => {
    if (head01 - tail01 < 0.01) return;
    if (seen.has(key)) {
      const existing = segments.find((s) => s.key === key);
      if (existing) {
        existing.head01 = Math.max(existing.head01, head01);
        existing.tail01 = Math.min(existing.tail01, tail01);
      }
      return;
    }
    seen.add(key);
    segments.push({ key, d, head01, tail01 });
  };

  const push = (from: string, to: string, head01: number, tail01: number) => {
    if (head01 - tail01 < 0.01) return;
    // Wye: butt-capped arm + stem. Shared leaveKey merges dual drains into one
    // stem stroke instead of stacking two desynced dashes.
    const parts = wyeCorridorParts(config, from, to, od);
    if (parts) {
      const split = parts.enterFrac;
      const enter = halfSpan(head01, tail01, "enter", split);
      if (enter) {
        upsert(parts.enterKey, parts.enter, enter.head01, enter.tail01);
      }
      const leave = halfSpan(head01, tail01, "leave", split);
      if (leave) {
        upsert(parts.leaveKey, parts.leave, leave.head01, leave.tail01);
      }
      return;
    }
    const d = corridorPath(config, from, to, od);
    if (!d) return;
    upsert(`${from}>${to}`, d, head01, tail01);
  };

  for (const sink of plantFlow.flow.sinks) {
    const edges = sink.edgeIds;
    const hits: { index: number; edgeId: string; handleId: string }[] = [];
    for (let index = 0; index < edges.length; index++) {
      const edgeId = edges[index]!;
      const conn = byEdge.get(edgeId);
      if (!conn) continue;
      const handleId = handleOnNode(conn, nodeId);
      if (!handleId) continue;
      hits.push({ index, edgeId, handleId });
    }

    // Consecutive edges that both touch this fitting = flow through a corridor.
    for (let h = 0; h < hits.length - 1; h++) {
      const a = hits[h]!;
      const b = hits[h + 1]!;
      if (b.index !== a.index + 1) continue;
      const inHead = plantFlow.edgeProgress[a.edgeId] ?? 0;
      const inTail = plantFlow.edgeTail[a.edgeId] ?? 0;
      const outHead = plantFlow.edgeProgress[b.edgeId] ?? 0;
      const outTail = plantFlow.edgeTail[b.edgeId] ?? 0;
      const parts = wyeCorridorParts(config, a.handleId, b.handleId, od);
      const { head01, tail01 } = fittingCorridorSpan(
        inHead,
        inTail,
        outHead,
        outTail,
        parts?.enterFrac ?? 0.5
      );
      push(a.handleId, b.handleId, head01, tail01);
    }

    // Sprinkle on an open port of this fitting: last edge arrives, then exits
    // through the fitting body to the open handle.
    if (
      sink.kind === "sprinkle" &&
      sink.deviceId === nodeId &&
      hits.length > 0
    ) {
      const last = hits[hits.length - 1]!;
      if (last.handleId !== sink.handleId) {
        const inHead = plantFlow.edgeProgress[last.edgeId] ?? 0;
        const inTail = plantFlow.edgeTail[last.edgeId] ?? 0;
        // No outbound pipe — once the slug arrives, treat the exit half as
        // filling with the same arrival so water runs the full corridor.
        const arrived = clamp01((inHead - 0.85) / 0.15);
        const cleared = clamp01((inTail - 0.85) / 0.15);
        const parts = wyeCorridorParts(
          config,
          last.handleId,
          sink.handleId,
          od
        );
        const { head01, tail01 } = fittingCorridorSpan(
          inHead,
          inTail,
          arrived,
          cleared,
          parts?.enterFrac ?? 0.5
        );
        push(last.handleId, sink.handleId, head01, tail01);
      }
    }
  }

  return segments;
}

/** Dash the water slug along a fitting corridor (same model as PipeShape). */
function FittingWaterStroke({
  d,
  head01,
  tail01,
  waterW,
}: {
  d: string;
  head01: number;
  tail01: number;
  waterW: number;
}) {
  const ref = useRef<SVGPathElement>(null);
  const [length, setLength] = useState(0);
  useLayoutEffect(() => {
    const path = ref.current;
    if (!path) return;
    setLength(path.getTotalLength());
  }, [d]);
  const span = Math.max(0, head01 - tail01);
  if (span < 0.01) return null;
  return (
    <path
      ref={ref}
      className="bp-fitting__water"
      d={d}
      fill="none"
      stroke={APPLE_DEPTH_COLORS.blue}
      strokeWidth={waterW}
      strokeLinecap="butt"
      strokeLinejoin="bevel"
      strokeDasharray={length > 0 ? `${span * length} ${length}` : undefined}
      strokeDashoffset={length > 0 ? -tail01 * length : undefined}
      opacity={length > 0 ? 1 : 0}
    />
  );
}

function FittingDrawing({
  config,
  waterSegs,
}: {
  config: PipeFittingConfig;
  waterSegs: FittingWaterSeg[];
}) {
  const od = config.kind === "reducer" ? null : boreOd(config.bore);
  const wide = fittingHandleOd(config, "wide");
  const thin = fittingHandleOd(config, "thin");
  const stroke = PIPE_METAL.stroke;
  const waterOd =
    config.kind === "reducer" ? Math.min(wide, thin) : (od ?? 16);
  const waterW = waterWidthForOd(waterOd);
  /** Half-spacing between the two parallel fork legs. */
  const leg = ARM * 0.55;
  /** Crossbar Y — stem meets the U here (split) / legs meet the stem (merge). */
  const barY = CY + ARM * 0.05;
  /** Elbow radius for square U corners (fits between leg spacing and drop). */
  const bend = Math.min(
    leg * 0.5,
    (CY + ARM - barY) * 0.4,
    Math.max(14, (od ?? 16) * 0.95)
  );
  // Continuous U crossbar + overlapping stem (separate M). Butt caps at a
  // T-junction leave a visible notch; one crossbar path + stem overlap fixes it.
  const join = (od ?? 16) * 0.4;
  const splitPath = [
    `M ${CX - leg} ${CY + ARM}`,
    `V ${barY + bend}`,
    `A ${bend} ${bend} 0 0 1 ${CX - leg + bend} ${barY}`,
    `H ${CX + leg - bend}`,
    `A ${bend} ${bend} 0 0 1 ${CX + leg} ${barY + bend}`,
    `V ${CY + ARM}`,
    `M ${CX} ${barY + join}`,
    `V ${CY - ARM}`,
  ].join(" ");
  const mergePath = [
    `M ${CX - leg} ${CY - ARM}`,
    `V ${barY - bend}`,
    `A ${bend} ${bend} 0 0 0 ${CX - leg + bend} ${barY}`,
    `H ${CX + leg - bend}`,
    `A ${bend} ${bend} 0 0 0 ${CX + leg} ${barY - bend}`,
    `V ${CY - ARM}`,
    `M ${CX} ${barY - join}`,
    `V ${CY + ARM}`,
  ].join(" ");

  return (
    <svg
      className="bp-fitting__svg"
      width={SIZE * FITTING_SCALE}
      height={SIZE * FITTING_SCALE}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      aria-hidden="true"
    >
      <g transform={`rotate(${config.rotation} ${CX} ${CY})`}>
        {config.kind === "cross" && od != null ? (
          <>
            <line
              x1={CX - ARM}
              y1={CY}
              x2={CX + ARM}
              y2={CY}
              stroke={stroke}
              strokeWidth={od + 2}
              strokeLinecap="butt"
            />
            <line
              x1={CX - ARM}
              y1={CY}
              x2={CX + ARM}
              y2={CY}
              stroke={PIPE_FILL}
              strokeWidth={od}
              strokeLinecap="butt"
            />
            <line
              x1={CX}
              y1={CY - ARM}
              x2={CX}
              y2={CY + ARM}
              stroke={stroke}
              strokeWidth={od + 2}
              strokeLinecap="butt"
            />
            <line
              x1={CX}
              y1={CY - ARM}
              x2={CX}
              y2={CY + ARM}
              stroke={PIPE_FILL}
              strokeWidth={od}
              strokeLinecap="butt"
            />
          </>
        ) : null}

        {config.kind === "wye_split" && od != null ? (
          <>
            <path
              d={splitPath}
              fill="none"
              stroke={stroke}
              strokeWidth={od + 2}
              strokeLinecap="butt"
              strokeLinejoin="round"
            />
            <path
              d={splitPath}
              fill="none"
              stroke={PIPE_FILL}
              strokeWidth={od}
              strokeLinecap="butt"
              strokeLinejoin="round"
            />
          </>
        ) : null}

        {config.kind === "wye_merge" && od != null ? (
          <>
            <path
              d={mergePath}
              fill="none"
              stroke={stroke}
              strokeWidth={od + 2}
              strokeLinecap="butt"
              strokeLinejoin="round"
            />
            <path
              d={mergePath}
              fill="none"
              stroke={PIPE_FILL}
              strokeWidth={od}
              strokeLinecap="butt"
              strokeLinejoin="round"
            />
          </>
        ) : null}

        {config.kind === "reducer" ? (
          <>
            <line
              x1={CX - ARM}
              y1={CY}
              x2={CX - 18}
              y2={CY}
              stroke={stroke}
              strokeWidth={wide + 2}
              strokeLinecap="butt"
            />
            <line
              x1={CX - ARM}
              y1={CY}
              x2={CX - 18}
              y2={CY}
              stroke={PIPE_FILL}
              strokeWidth={wide}
              strokeLinecap="butt"
            />
            <polygon
              points={`${CX - 18},${CY - wide / 2 - 1} ${CX + 18},${CY - thin / 2 - 1} ${CX + 18},${CY + thin / 2 + 1} ${CX - 18},${CY + wide / 2 + 1}`}
              fill={PIPE_METAL.stroke}
            />
            <polygon
              points={`${CX - 18},${CY - wide / 2} ${CX + 18},${CY - thin / 2} ${CX + 18},${CY + thin / 2} ${CX - 18},${CY + wide / 2}`}
              fill={PIPE_FILL}
            />
            <line
              x1={CX + 18}
              y1={CY}
              x2={CX + ARM}
              y2={CY}
              stroke={stroke}
              strokeWidth={thin + 2}
              strokeLinecap="butt"
            />
            <line
              x1={CX + 18}
              y1={CY}
              x2={CX + ARM}
              y2={CY}
              stroke={PIPE_FILL}
              strokeWidth={thin}
              strokeLinecap="butt"
            />
          </>
        ) : null}

        {waterSegs.map((seg) => (
          <FittingWaterStroke
            key={seg.key}
            d={seg.d}
            head01={seg.head01}
            tail01={seg.tail01}
            waterW={waterW}
          />
        ))}
      </g>
    </svg>
  );
}

function FittingHandle({
  id,
  x,
  y,
  connectable,
  title,
}: {
  id: string;
  x: number;
  y: number;
  connectable: boolean;
  title?: string;
}) {
  // Tip position; CSS sizes the open ring and centers it via translate.
  // Always `source` — Loose mode + normalizePipeConnection fix polarity.
  // Target-typed handles often refuse to start a drag, so open fork rings
  // looked connectable but could not begin a pipe.
  const style: CSSProperties = {
    left: x * FITTING_SCALE,
    top: y * FITTING_SCALE,
    transform: "translate(-50%, -50%)",
  };
  return (
    <Handle
      id={id}
      type="source"
      position={positionForPoint(x, y)}
      isConnectable={connectable}
      isConnectableStart={connectable}
      isConnectableEnd={connectable}
      className={`bp-port nodrag nopan${connectable ? " bp-port--open" : ""}`}
      style={style}
      aria-label={connectable ? title : undefined}
      title={connectable ? title : undefined}
    />
  );
}

/**
 * True when THIS node's handle already has a plant pipe.
 * sourceHandle/targetHandle alone are not enough — they also name the
 * other end's seat on the remote node.
 */
function useHandleBusy(handleId: string): boolean {
  const nodeId = useNodeId();
  const connections = useNodeConnections();
  return connections.some(
    (c) =>
      (c.source === nodeId && c.sourceHandle === handleId) ||
      (c.target === nodeId && c.targetHandle === handleId)
  );
}

function FittingPort({
  port,
  rotation,
  editing,
}: {
  port: PortSpec;
  rotation: PipeFittingRotation;
  editing: boolean;
}) {
  const { t } = useTranslation();
  const busy = useHandleBusy(port.id);
  const point = rotatePoint(port.x, port.y, rotation);
  return (
    <FittingHandle
      id={port.id}
      x={point.x}
      y={point.y}
      connectable={editing && !busy}
      title={t("controlPanel.fittingPortHint")}
    />
  );
}

export default function PipeFittingNode({
  id,
  data,
}: NodeProps<Node<PipeFittingNodeData>>) {
  const { t } = useTranslation();
  const { editing } = useBlueprint();
  const updateNodeInternals = useUpdateNodeInternals();
  const plantFlow = usePlantFlowVisual();
  const connections = useNodeConnections();
  const config = useMemo(
    () => parsePipeFittingConfig(data.device.config),
    [data.device.config]
  );
  const ports = useMemo(() => portsFor(config), [config]);
  const waterOd = useMemo(() => {
    if (config.kind === "reducer") {
      return Math.min(
        fittingHandleOd(config, "wide"),
        fittingHandleOd(config, "thin")
      );
    }
    return boreOd(config.bore);
  }, [config]);
  // Continuous corridors animated from the incoming edge's slug (in → through → out).
  const waterSegs = useMemo(
    () => fittingWaterSegments(id, config, connections, plantFlow, waterOd),
    [id, config, connections, plantFlow, waterOd]
  );

  // Handles move when the fitting rotates; tell React Flow to remeasure.
  useEffect(() => {
    updateNodeInternals(id);
  }, [id, config.rotation, updateNodeInternals]);

  const onRotate = (event: MouseEvent) => {
    event.stopPropagation();
    window.dispatchEvent(
      new CustomEvent("bp-rotate-fitting", {
        detail: {
          deviceId: id,
          rotation: nextFittingRotation(config.rotation),
        },
      })
    );
  };

  return (
    <div className={`bp-fitting ${editing ? "is-editing" : ""}`}>
      <FittingDrawing config={config} waterSegs={waterSegs} />
      {ports.map((port) => (
        <FittingPort
          key={port.id}
          port={port}
          rotation={config.rotation}
          editing={editing}
        />
      ))}
      {editing && (config.kind === "wye_split" || config.kind === "wye_merge") ? (
        <button
          type="button"
          className="bp-fitting__rotate nodrag nopan"
          onClick={onRotate}
          title={t("piping.rotate")}
          aria-label={t("piping.rotate")}
        >
          ↻
        </button>
      ) : null}
      <p className="bp-fitting__name">{data.device.name}</p>
    </div>
  );
}
