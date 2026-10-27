import { useEffect, useMemo, type CSSProperties, type MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  Handle,
  Position,
  useUpdateNodeInternals,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { PIPE_FILL, PIPE_METAL } from "../../../components/pressure-vessel/pipe-style";
import type { AccessibleDevice } from "../../../lib/devices";
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
      const leg = ARM * 0.85;
      // Legs open downward; leave-direction follows the end, not the east/west wall.
      return [
        { id: "stem", side: "n", x: CX, y: CY - ARM, role: "target" },
        { id: "left", side: "s", x: CX - leg, y: CY + ARM, role: "source" },
        { id: "right", side: "s", x: CX + leg, y: CY + ARM, role: "source" },
      ];
    }
    case "wye_merge": {
      const leg = ARM * 0.85;
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

function FittingDrawing({ config }: { config: PipeFittingConfig }) {
  const od = config.kind === "reducer" ? null : boreOd(config.bore);
  const wide = fittingHandleOd(config, "wide");
  const thin = fittingHandleOd(config, "thin");
  const stroke = PIPE_METAL.stroke;
  const leg = ARM * 0.85;

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
              d={`M ${CX} ${CY - ARM} V ${CY} L ${CX - leg} ${CY + ARM} M ${CX} ${CY} L ${CX + leg} ${CY + ARM}`}
              fill="none"
              stroke={stroke}
              strokeWidth={od + 2}
              strokeLinecap="butt"
              strokeLinejoin="round"
            />
            <path
              d={`M ${CX} ${CY - ARM} V ${CY} L ${CX - leg} ${CY + ARM} M ${CX} ${CY} L ${CX + leg} ${CY + ARM}`}
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
              d={`M ${CX - leg} ${CY - ARM} L ${CX} ${CY} L ${CX + leg} ${CY - ARM} M ${CX} ${CY} V ${CY + ARM}`}
              fill="none"
              stroke={stroke}
              strokeWidth={od + 2}
              strokeLinecap="butt"
              strokeLinejoin="round"
            />
            <path
              d={`M ${CX - leg} ${CY - ARM} L ${CX} ${CY} L ${CX + leg} ${CY - ARM} M ${CX} ${CY} V ${CY + ARM}`}
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
      </g>
    </svg>
  );
}

function FittingHandle({
  id,
  x,
  y,
  role,
  connectable,
}: {
  id: string;
  x: number;
  y: number;
  role: PortSpec["role"];
  connectable: boolean;
}) {
  // Zero-size handle at the pipe end (same pattern as reactor ports).
  const style: CSSProperties = {
    left: x * FITTING_SCALE,
    top: y * FITTING_SCALE,
  };
  const type = role === "target" ? "target" : "source";
  return (
    <Handle
      id={id}
      type={type}
      position={positionForPoint(x, y)}
      isConnectable={connectable}
      isConnectableStart={connectable}
      isConnectableEnd={connectable}
      className="bp-port"
      style={style}
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
  const config = useMemo(
    () => parsePipeFittingConfig(data.device.config),
    [data.device.config]
  );
  const ports = useMemo(() => portsFor(config), [config]);
  const connectable = editing;

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
      <FittingDrawing config={config} />
      {ports.map((port) => {
        const point = rotatePoint(port.x, port.y, config.rotation);
        return (
          <FittingHandle
            key={port.id}
            id={port.id}
            x={point.x}
            y={point.y}
            role={port.role}
            connectable={connectable}
          />
        );
      })}
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
