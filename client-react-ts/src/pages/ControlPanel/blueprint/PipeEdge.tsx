import type { MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  EdgeToolbar,
  useInternalNode,
  type ConnectionLineComponentProps,
  type Edge,
  type EdgeProps,
  type InternalNode,
  type Rect,
  type XYPosition,
} from "@xyflow/react";
import { TrashOutline } from "react-ionicons";
import { parsePipeFittingConfig, fittingHandleOd } from "../../../lib/pipeFittings";
import { odVolumetricRate } from "../../../lib/plantFlow";
import type { AccessibleDevice } from "../../../lib/devices";
import { useBlueprint } from "./BlueprintContext";
import PipeShape from "./PipeShape";
import { routePipe } from "./pipeRoute";
import { PORT_PIPE_OD, REACTOR_SCALE, isPipePort } from "./ReactorNode";
import { usePlantFlowVisual } from "./usePlantFlowVisual";

/** Edit-mode cue: arrow above the longest run, pointing source → target. */
function PipeFlowArrow({
  at,
  dir,
  offset = 14,
}: {
  at: XYPosition;
  dir: XYPosition;
  offset?: number;
}) {
  const len = Math.hypot(dir.x, dir.y) || 1;
  const ux = dir.x / len;
  const uy = dir.y / len;
  // Prefer the side toward the top of the canvas ("above" the pipe).
  let nx = -uy;
  let ny = ux;
  if (ny > 0.01) {
    nx = -nx;
    ny = -ny;
  }
  const x = at.x + nx * offset;
  const y = at.y + ny * offset;
  const angle = (Math.atan2(uy, ux) * 180) / Math.PI;
  return (
    <g
      className="bp-pipe__flow-arrow"
      transform={`translate(${x} ${y}) rotate(${angle})`}
      aria-hidden
    >
      <path d="M -7 0 H 5 M 0 -4.5 L 8 0 L 0 4.5 Z" />
    </g>
  );
}

export type PipeEdgeType = Edge<Record<string, unknown>, "pipe">;

function portOd(
  handleId: string | null | undefined,
  device?: AccessibleDevice | null
): number {
  if (device?.type === "pipe_fitting") {
    return fittingHandleOd(parsePipeFittingConfig(device.config), handleId);
  }
  return isPipePort(handleId) ? PORT_PIPE_OD[handleId] : PORT_PIPE_OD.outlet;
}

function nodeBox(node: InternalNode | null | undefined): Rect | null {
  if (!node) return null;
  return {
    ...node.internals.positionAbsolute,
    width: node.measured.width ?? 0,
    height: node.measured.height ?? 0,
  };
}

/**
 * React Flow anchors edges to the Position side of the handle box (bottom of a
 * Bottom handle, etc.). Our ports are centered on the painted tip, so the
 * side-anchor sits a half-box away and the plant pipe never meets the unit.
 * Route from the handle centre (= tip) instead.
 */
function handleTip(
  node: InternalNode | null | undefined,
  handleId: string | null | undefined,
  fallbackX: number,
  fallbackY: number
): XYPosition {
  if (!node || !handleId) return { x: fallbackX, y: fallbackY };
  const bounds = [
    ...(node.internals.handleBounds?.source ?? []),
    ...(node.internals.handleBounds?.target ?? []),
  ];
  const handle = bounds.find((b) => b.id === handleId);
  if (!handle) return { x: fallbackX, y: fallbackY };
  const { x: ax, y: ay } = node.internals.positionAbsolute;
  return {
    x: ax + handle.x + handle.width / 2,
    y: ay + handle.y + handle.height / 2,
  };
}

/** Outlet → inlet pipe between two units, routed with square turns. */
export default function PipeEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  sourceHandleId,
  targetHandleId,
}: EdgeProps<PipeEdgeType>) {
  const { t } = useTranslation();
  const { editing, selectedPipeId, removePipe } = useBlueprint();
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  const sourceBox = nodeBox(sourceNode);
  const targetBox = nodeBox(targetNode);
  const sourceTip = handleTip(sourceNode, sourceHandleId, sourceX, sourceY);
  const targetTip = handleTip(targetNode, targetHandleId, targetX, targetY);
  const route = routePipe(
    { x: sourceTip.x, y: sourceTip.y, position: sourcePosition, box: sourceBox },
    { x: targetTip.x, y: targetTip.y, position: targetPosition, box: targetBox }
  );
  const sourceDevice = (sourceNode?.data as { device?: AccessibleDevice } | undefined)
    ?.device;
  const targetDevice = (targetNode?.data as { device?: AccessibleDevice } | undefined)
    ?.device;
  const sourceOd = portOd(sourceHandleId, sourceDevice);
  const targetOd = portOd(targetHandleId, targetDevice);
  const selected = editing && selectedPipeId === id;
  const plantFlow = usePlantFlowVisual();
  const edgeRate = plantFlow?.flow.edgeRates[id] ?? 0;
  const edgeProgress = plantFlow?.edgeProgress[id] ?? 0;
  const edgeTail = plantFlow?.edgeTail[id] ?? 0;
  const blendToInlet = Boolean(
    plantFlow?.flow.sinks.some(
      (sink) =>
        sink.kind === "reactor" &&
        sink.edgeIds.length > 0 &&
        sink.edgeIds[sink.edgeIds.length - 1] === id
    )
  );
  const boreOd = plantFlow?.flow.edgeOd[id] ?? Math.min(sourceOd, targetOd);
  // Combined drains sum into edgeRates — grow the water stroke toward the bore.
  const pipeCap = odVolumetricRate(boreOd);
  const rateFill = pipeCap > 0.01 ? Math.min(2, edgeRate / pipeCap) : 1;
  // Show the slug whenever the edge still holds water — even if the sink is
  // full and edgeRates were zeroed (otherwise the U goes dry mid-merge).
  const flow =
    plantFlow && edgeProgress - edgeTail > 0.01
      ? {
          progress01: edgeProgress,
          tail01: edgeTail,
          od: boreOd,
          rateFill01: edgeRate > 0.01 ? rateFill : 1,
          alongSource: plantFlow.flow.edgeAlongSource[id] !== false,
          blendToInlet,
        }
      : null;

  const onRemove = (event: MouseEvent) => {
    // The edge wrapper would select the removed pipe again on the way up.
    event.stopPropagation();
    removePipe(id);
  };

  return (
    <>
      <PipeShape
        route={route}
        sourceOd={sourceOd}
        targetOd={targetOd}
        scale={REACTOR_SCALE}
        // Units already paint their own nozzle; a second flange left a visible
        // gap between plant pipe and tip. Overlap alone makes a flush joint.
        sourceJoint={false}
        targetJoint={false}
        selected={selected}
        flow={flow}
      />
      {editing ? (
        <>
          <path
            className="bp-pipe__hit"
            d={route.path}
            strokeWidth={Math.max(sourceOd, targetOd) * REACTOR_SCALE + 10}
          />
          <PipeFlowArrow at={route.label} dir={route.labelDir} />
        </>
      ) : null}
      <EdgeToolbar
        edgeId={id}
        x={route.label.x}
        y={route.label.y}
        isVisible={selected}
        className="nodrag nopan"
      >
        <button type="button" className="bp-pipe-remove" onClick={onRemove}>
          <TrashOutline color="currentColor" height="14px" width="14px" />
          {t("controlPanel.removePipe")}
        </button>
      </EdgeToolbar>
    </>
  );
}

/**
 * All ports are RF `source` handles so either end can start a drag. Preview
 * polarity follows vessel seats (outlet → inlet), not the handle type.
 */
function previewForward(
  fromId: string | null | undefined,
  fromDevice: AccessibleDevice | undefined,
  toId: string | null | undefined,
  toDevice: AccessibleDevice | undefined,
  snapped: boolean
): boolean {
  if (fromDevice?.type === "bioreactor") return fromId === "outlet";
  if (snapped && toDevice?.type === "bioreactor") return toId === "inlet";
  return true;
}

/** Drag preview: the same pipe, gaining its reducer once it snaps onto a matching end. */
export function PipeConnectionLine({
  fromX,
  fromY,
  toX,
  toY,
  fromPosition,
  toPosition,
  fromHandle,
  toHandle,
  fromNode,
  toNode,
  connectionStatus,
}: ConnectionLineComponentProps) {
  const snapped = connectionStatus === "valid" && toHandle !== null;
  const fromDevice = (fromNode?.data as { device?: AccessibleDevice } | undefined)
    ?.device;
  const toDevice = (toNode?.data as { device?: AccessibleDevice } | undefined)
    ?.device;
  const forward = previewForward(
    fromHandle.id,
    fromDevice,
    toHandle?.id,
    toDevice,
    snapped
  );
  const fromOd = portOd(fromHandle.id, fromDevice);
  const toOd = snapped && toHandle ? portOd(toHandle.id, toDevice) : fromOd;
  const fromTip = handleTip(fromNode, fromHandle.id, fromX, fromY);
  const toTip = snapped
    ? handleTip(toNode, toHandle?.id, toX, toY)
    : { x: toX, y: toY };
  const from = {
    x: fromTip.x,
    y: fromTip.y,
    position: fromPosition,
    box: nodeBox(fromNode),
  };
  const to = {
    x: toTip.x,
    y: toTip.y,
    position: toPosition,
    box: snapped ? nodeBox(toNode) : null,
  };
  // Route outlet → inlet like the saved pipe, whichever end the drag started at.
  const route = forward ? routePipe(from, to) : routePipe(to, from);

  return (
    <PipeShape
      route={route}
      sourceOd={forward ? fromOd : toOd}
      targetOd={forward ? toOd : fromOd}
      scale={REACTOR_SCALE}
      // Preview matches saved pipes: no extra flange, tip overlap only.
      sourceJoint={false}
      targetJoint={false}
      className={connectionStatus === "invalid" ? "is-invalid" : "is-preview"}
    />
  );
}
