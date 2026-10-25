import { useEffect, useMemo, type ReactNode, type SyntheticEvent } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import BioreactorCard from "../../../components/Canvas/BioreactorCard";
import { layoutFromGeometry } from "../../../components/Canvas/bioreactorLayout";
import BioreactorCharts, {
  hasBioreactorCharts,
} from "../../../components/bioreactor/BioreactorCharts";
import BioreactorControls from "../../../components/bioreactor/BioreactorControls";
import { useBioreactorController } from "../../../components/bioreactor/useBioreactorController";
import { fillUnitsToPercent } from "../../../components/pressure-vessel/constants";
import {
  defaultBioreactorGeometry,
  parseBioreactorConfig,
} from "../../../lib/bioreactorGeometry";
import type { AccessibleDevice } from "../../../lib/devices";
import { useBlueprint } from "./BlueprintContext";

/** Reactor drawing is authored at 800 px wide; this fits it into a canvas node. */
export const REACTOR_SCALE = 0.3;

export type ReactorNodeData = { device: AccessibleDevice };

const stop = (event: SyntheticEvent) => event.stopPropagation();

/**
 * Dock content is portaled out of the node, but React events still bubble to
 * the React Flow node wrapper (arrow keys would move the node, clicks would
 * re-select it). Stop them at the portal root.
 */
function DockPortal({ target, children }: { target: HTMLElement; children: ReactNode }) {
  return createPortal(
    <div
      className="bp-dock__portal"
      onKeyDown={stop}
      onKeyUp={stop}
      onClick={stop}
      onDoubleClick={stop}
      onMouseDown={stop}
      onPointerDown={stop}
      onContextMenu={stop}
    >
      {children}
    </div>,
    target
  );
}

export default function ReactorNode({ id, data }: NodeProps<Node<ReactorNodeData>>) {
  const { t } = useTranslation();
  const {
    user,
    selectedId,
    dockedId,
    controlsDock,
    chartsDock,
    setHasCharts,
    push,
  } = useBlueprint();
  const controller = useBioreactorController(data.device, user, push);
  const shape = parseBioreactorConfig(data.device.config).vessel_shape;
  const layout = useMemo(
    () => layoutFromGeometry(defaultBioreactorGeometry(), shape),
    [shape]
  );
  const width = layout.cardWidth * REACTOR_SCALE;
  const height = layout.cardHeight * REACTOR_SCALE;
  const selected = selectedId === id;
  const docked = dockedId === id;
  const charts = controller ? hasBioreactorCharts(controller.equipment) : false;

  useEffect(() => {
    if (selected) setHasCharts(id, charts);
  }, [selected, charts, id, setHasCharts]);

  const levelPercent = controller
    ? Math.round(fillUnitsToPercent(controller.level.fillUnits))
    : null;

  return (
    <div className={`bp-reactor ${selected ? "is-selected" : ""}`}>
      <Handle
        type="target"
        id="inlet"
        position={Position.Left}
        className="cp-flow-handle"
        style={{ top: "22%" }}
        title={t("controlPanel.inlet")}
      />
      <div className="bp-reactor__stage" style={{ width, height }} aria-hidden>
        {controller ? (
          <BioreactorCard
            {...controller.vessel}
            translateX={-(layout.cardWidth * (1 - REACTOR_SCALE)) / 2}
            translateY={-(layout.cardHeight * (1 - REACTOR_SCALE)) / 2}
            scale={REACTOR_SCALE}
            onMouseDown={() => {}}
          />
        ) : (
          <span className="bp-reactor__loading">{t("common.loading")}</span>
        )}
      </div>
      <div className="bp-reactor__label">
        <span className="bp-reactor__name">{data.device.name}</span>
        {levelPercent != null ? (
          <span className="bp-reactor__level">{levelPercent}%</span>
        ) : null}
      </div>
      <Handle
        type="source"
        id="outlet"
        position={Position.Right}
        className="cp-flow-handle"
        style={{ top: "78%" }}
        title={t("controlPanel.outlet")}
      />

      {docked && controller && controlsDock ? (
        <DockPortal target={controlsDock}>
          <BioreactorControls controller={controller} />
        </DockPortal>
      ) : null}
      {docked && controller && chartsDock && charts ? (
        <DockPortal target={chartsDock}>
          <BioreactorCharts
            deviceId={controller.device.id}
            equipment={controller.equipment}
          />
        </DockPortal>
      ) : null}
    </div>
  );
}
