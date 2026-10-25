import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
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
 * Zero-size handle on a pipe's open end, so React Flow attaches the connecting
 * pipe exactly there whatever side it faces. The ring is drawn in CSS.
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
  return (
    <Handle
      id={id}
      type={id === "outlet" ? "source" : "target"}
      position={SIDE_POSITION[port.side]}
      isConnectable={connectable}
      isConnectableStart={connectable}
      isConnectableEnd={connectable}
      className="bp-port"
      style={{
        left: (layout.wrapperMarginLeft + port.x) * REACTOR_SCALE,
        top: (layout.wrapperMarginTop + port.y) * REACTOR_SCALE,
      }}
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

/**
 * Stroke that paints like `border: 1.5px dashed`: width snapped to whole
 * device pixels, dashes 3x and gaps 2x the width.
 */
function ringStroke() {
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.floor(1.5 * dpr)) / dpr;
  return { width, dash: width * 3, gap: width * 2 };
}

/** Dashed frame around the selected reactor; SVG so edit mode can march it. */
function SelectionRing() {
  const rectRef = useRef<SVGRectElement>(null);
  const [{ width, dash, gap }] = useState(ringStroke);
  const period = dash + gap;
  const [pathLength, setPathLength] = useState<number>();

  // Whole dash periods per lap: no seam, and the march loops without a jump.
  useLayoutEffect(() => {
    const rect = rectRef.current;
    const svg = rect?.ownerSVGElement;
    if (!rect || !svg) return;
    const fit = () => {
      const length = rect.getTotalLength();
      if (length > 0) {
        setPathLength(Math.max(1, Math.round(length / period)) * period);
      }
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(svg);
    return () => observer.disconnect();
  }, [period]);

  return (
    <span
      className="bp-reactor__ring"
      style={
        {
          "--bp-ring-w": `${width}px`,
          "--bp-ring-period": `${period}px`,
        } as CSSProperties
      }
      aria-hidden
    >
      <svg focusable="false">
        <rect
          ref={rectRef}
          width="100%"
          height="100%"
          rx={14 - width / 2}
          pathLength={pathLength}
          strokeWidth={width}
          strokeDasharray={`${dash} ${gap}`}
        />
      </svg>
    </span>
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
  // One pipe per open end.
  const inletLinked =
    useNodeConnections({ handleType: "target", handleId: "inlet" }).length > 0;
  const outletLinked =
    useNodeConnections({ handleType: "source", handleId: "outlet" }).length > 0;
  const updateNodeInternals = useUpdateNodeInternals();

  // Handles move with the pipe directions without resizing the node.
  useEffect(() => {
    updateNodeInternals(id);
  }, [id, layout, hasOutlet, updateNodeInternals]);

  return (
    <div className={`bp-reactor ${selected ? "is-selected" : ""}`}>
      {selected ? <SelectionRing /> : null}
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
