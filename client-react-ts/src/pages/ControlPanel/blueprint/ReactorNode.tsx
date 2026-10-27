import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type SyntheticEvent,
} from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import {
  Handle,
  NodeToolbar,
  Position,
  useNodeConnections,
  useUpdateNodeInternals,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import BioreactorCard from "../../../components/Canvas/BioreactorCard";
import {
  FILL_PIPE_OD,
  OUTFLOW_PIPE_OD,
  layoutFromGeometry,
  type BioreactorLayout,
  type PipePort,
  type PipePortSide,
} from "../../../components/Canvas/bioreactorLayout";
import BioreactorCharts, {
  hasBioreactorCharts,
} from "../../../components/bioreactor/BioreactorCharts";
import BioreactorControls from "../../../components/bioreactor/BioreactorControls";
import { useBioreactorController } from "../../../components/bioreactor/useBioreactorController";
import {
  defaultBioreactorGeometry,
  parseBioreactorConfig,
} from "../../../lib/bioreactorGeometry";
import { canAdminDevice, type AccessibleDevice } from "../../../lib/devices";
import { useBlueprint } from "./BlueprintContext";
import PipeDirectionPicker from "./PipeDirectionPicker";

/** Reactor drawing is authored at 800 px wide; this fits it into a canvas node. */
export const REACTOR_SCALE = 0.3;

/**
 * React Flow dragHandle: chamber + sensors + painted SVG shapes only.
 * Never the SVG root — its viewBox padding is much larger than the pipes.
 */
export const REACTOR_DRAG_HANDLE = [
  ".reaction_chamber",
  ".sensor",
  ".thermal-jacket__svg :is(path, circle, rect, ellipse)",
  ".br-fill-inlet__svg :is(path, circle, rect, ellipse)",
  ".br-outflow__svg :is(path, circle, rect, ellipse)",
  ".aerator-supply__pipe :is(path, circle, rect, ellipse)",
  ".base-acid-pipe-run :is(path, circle, rect, ellipse)",
].join(", ");

export type ReactorNodeData = { device: AccessibleDevice };

/** Handle ids: the drain is a connection source, the fill inlet a target. */
export type PipePortId = "inlet" | "outlet";

export const PORT_PIPE_OD: Record<PipePortId, number> = {
  inlet: FILL_PIPE_OD,
  outlet: OUTFLOW_PIPE_OD,
};

export function isPipePort(id: string | null | undefined): id is PipePortId {
  return id === "inlet" || id === "outlet";
}

const SIDE_POSITION: Record<PipePortSide, Position> = {
  left: Position.Left,
  right: Position.Right,
  top: Position.Top,
  bottom: Position.Bottom,
};

/**
 * Join handle on a pipe's open end. Open ports get `bp-port--open` (visible
 * ring + hit target in CSS). Occupied ports stay hidden and non-connectable.
 */
function PipePortHandle({
  id,
  port,
  layout,
  connectable,
  title,
}: {
  id: PipePortId;
  port: PipePort;
  layout: BioreactorLayout;
  connectable: boolean;
  title: string;
}) {
  const left = (layout.wrapperMarginLeft + port.x) * REACTOR_SCALE;
  const top = (layout.wrapperMarginTop + port.y) * REACTOR_SCALE;
  return (
    <Handle
      id={id}
      // Always source: Loose mode + normalizePipeConnection set polarity.
      // Target-typed inlet rings often cannot start a drag.
      type="source"
      position={SIDE_POSITION[port.side]}
      isConnectable={connectable}
      isConnectableStart={connectable}
      isConnectableEnd={connectable}
      className={`bp-port nodrag nopan${connectable ? " bp-port--open" : ""}`}
      style={{
        left,
        top,
        transform: "translate(-50%, -50%)",
      }}
      aria-label={connectable ? title : undefined}
      title={connectable ? title : undefined}
    />
  );
}

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

/** Edit mode: the caption is the rename field. Enter or blur saves, Escape cancels. */
function NameField({ id, name }: { id: string; name: string }) {
  const { t } = useTranslation();
  const { renameDevice, nameFocus } = useBlueprint();
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(name);

  useEffect(() => {
    setDraft(name);
  }, [name]);

  useEffect(() => {
    if (nameFocus?.id !== id) return;
    const input = inputRef.current;
    input?.focus();
    input?.select();
  }, [nameFocus, id]);

  const commit = () => {
    const next = draft.trim();
    if (!next || next === name) {
      setDraft(name);
      return;
    }
    renameDevice(id, next);
  };

  return (
    <label
      className="bp-reactor__name is-editable nodrag nopan"
      data-value={draft}
    >
      <input
        ref={inputRef}
        className="bp-reactor__name-input"
        value={draft}
        size={1}
        maxLength={80}
        spellCheck={false}
        aria-label={t("deviceSettings.deviceName")}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") {
            setDraft(name);
            requestAnimationFrame(() => inputRef.current?.blur());
          }
        }}
      />
    </label>
  );
}

export default function ReactorNode({ id, data }: NodeProps<Node<ReactorNodeData>>) {
  const { t } = useTranslation();
  const {
    user,
    editing,
    selectedId,
    dockedId,
    controlsDock,
    chartsDock,
    setPiping,
    push,
  } = useBlueprint();
  const controller = useBioreactorController(data.device, user, push);
  const config = useMemo(
    () => parseBioreactorConfig(data.device.config),
    [data.device.config]
  );
  const shape = config.vessel_shape;
  const piping = config.piping;
  const hasOutlet = config.equipment.outflow;
  const layout = useMemo(
    () => layoutFromGeometry(defaultBioreactorGeometry(), shape, piping),
    [shape, piping]
  );
  const width = layout.cardWidth * REACTOR_SCALE;
  const height = layout.cardHeight * REACTOR_SCALE;
  const selected = selectedId === id;
  const docked = dockedId === id;
  const canAdmin = canAdminDevice(data.device.role);
  const showPiping = editing && selected && canAdmin;
  const charts = controller ? hasBioreactorCharts(controller.equipment) : false;
  // One pipe per open end on THIS node. sourceHandle/targetHandle name the
  // remote end's seat too — only count when this node owns that seat.
  const reactorLinks = useNodeConnections();
  const inletLinked = reactorLinks.some(
    (c) =>
      (c.source === id && c.sourceHandle === "inlet") ||
      (c.target === id && c.targetHandle === "inlet")
  );
  const outletLinked = reactorLinks.some(
    (c) =>
      (c.source === id && c.sourceHandle === "outlet") ||
      (c.target === id && c.targetHandle === "outlet")
  );
  const updateNodeInternals = useUpdateNodeInternals();

  // Handles move with the pipe directions without resizing the node.
  useEffect(() => {
    updateNodeInternals(id);
  }, [id, layout, hasOutlet, updateNodeInternals]);

  return (
    <div className={`bp-reactor ${selected ? "is-selected" : ""}`}>
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
        {/* Above the scaled vessel card so open rings stay visible and clickable. */}
        <div className="bp-reactor__ports">
          <PipePortHandle
            id="inlet"
            port={layout.ports.inlet}
            layout={layout}
            connectable={editing && !inletLinked}
            title={t("controlPanel.inletPortHint")}
          />
          {hasOutlet ? (
            <PipePortHandle
              id="outlet"
              port={layout.ports.outlet}
              layout={layout}
              connectable={editing && !outletLinked}
              title={t("controlPanel.outletPortHint")}
            />
          ) : null}
        </div>
      </div>
      {editing && canAdmin ? (
        <NameField id={id} name={data.device.name} />
      ) : (
        <span className="bp-reactor__name">{data.device.name}</span>
      )}

      <NodeToolbar
        isVisible={showPiping}
        position={Position.Top}
        offset={12}
        className="nodrag nopan"
      >
        <PipeDirectionPicker
          end="inlet"
          value={piping.inlet}
          onChange={(inlet) => setPiping(id, { ...piping, inlet })}
        />
      </NodeToolbar>
      {hasOutlet ? (
        <NodeToolbar
          isVisible={showPiping}
          position={Position.Bottom}
          offset={12}
          className="nodrag nopan"
        >
          <PipeDirectionPicker
            end="outlet"
            value={piping.outlet}
            onChange={(outlet) => setPiping(id, { ...piping, outlet })}
          />
        </NodeToolbar>
      ) : null}

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
