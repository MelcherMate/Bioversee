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
} from "@xyflow/react";
import { TrashOutline } from "react-ionicons";
import { parsePipeFittingConfig, fittingHandleOd } from "../../../lib/pipeFittings";
import type { AccessibleDevice } from "../../../lib/devices";
import { useBlueprint } from "./BlueprintContext";
import PipeShape from "./PipeShape";
import { routePipe } from "./pipeRoute";
import { PORT_PIPE_OD, REACTOR_SCALE, isPipePort } from "./ReactorNode";

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
  const route = routePipe(
    { x: sourceX, y: sourceY, position: sourcePosition, box: sourceBox },
    { x: targetX, y: targetY, position: targetPosition, box: targetBox }
  );
  const sourceDevice = (sourceNode?.data as { device?: AccessibleDevice } | undefined)
    ?.device;
  const targetDevice = (targetNode?.data as { device?: AccessibleDevice } | undefined)
    ?.device;
  const sourceOd = portOd(sourceHandleId, sourceDevice);
  const targetOd = portOd(targetHandleId, targetDevice);
  const selected = editing && selectedPipeId === id;

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
        selected={selected}
      />
      {editing ? (
        <path
          className="bp-pipe__hit"
          d={route.path}
          strokeWidth={Math.max(sourceOd, targetOd) * REACTOR_SCALE + 10}
        />
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
  const fromOutlet = fromHandle.type === "source";
  const snapped = connectionStatus === "valid" && toHandle !== null;
  const fromDevice = (fromNode?.data as { device?: AccessibleDevice } | undefined)
    ?.device;
  const toDevice = (toNode?.data as { device?: AccessibleDevice } | undefined)
    ?.device;
  const fromOd = portOd(fromHandle.id, fromDevice);
  const toOd = snapped && toHandle ? portOd(toHandle.id, toDevice) : fromOd;
  const from = { x: fromX, y: fromY, position: fromPosition, box: nodeBox(fromNode) };
  const to = { x: toX, y: toY, position: toPosition, box: snapped ? nodeBox(toNode) : null };
  // Route outlet → inlet like the saved pipe, whichever end the drag started at.
  const route = fromOutlet ? routePipe(from, to) : routePipe(to, from);

  return (
    <PipeShape
      route={route}
      sourceOd={fromOutlet ? fromOd : toOd}
      targetOd={fromOutlet ? toOd : fromOd}
      scale={REACTOR_SCALE}
      sourceJoint={fromOutlet || snapped}
      targetJoint={!fromOutlet || snapped}
      className={connectionStatus === "invalid" ? "is-invalid" : "is-preview"}
    />
  );
}
