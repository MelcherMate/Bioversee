import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Background,
  Controls,
  Handle,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
  type OnConnect,
  type OnEdgesDelete,
  type OnNodeDrag,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { AddOutline, CloseOutline, OpenOutline } from "react-ionicons";
import { ToastStack, useToasts } from "../../../components/Toast";
import {
  listAccessibleDevicesInPlant,
  type AccessibleDevice,
} from "../../../lib/devices";
import { DEVICE_TYPE_META } from "../../../lib/deviceIcons";
import { DEVICES_CHANGED_EVENT, requestOpenAddDevice } from "../../../lib/onboarding";
import {
  createPlantConnection,
  deletePlantConnection,
  listPlantConnections,
  listPlantLayouts,
  upsertPlantLayout,
  type PlantConnection,
} from "../../../lib/plantGraph";
import { pathForDeviceType } from "../../../lib/sharing";
import type { AppUser } from "../../../lib/user";
import DeviceTypeGlyph from "../DeviceTypeGlyph";
import {
  BlueprintContext,
  useBlueprint,
  type BlueprintContextValue,
} from "./BlueprintContext";
import ReactorNode, { type ReactorNodeData } from "./ReactorNode";
import "./Blueprint.css";

type DeviceNodeData = { device: AccessibleDevice };

function DeviceFlowNode({ id, data }: NodeProps<Node<DeviceNodeData>>) {
  const { t } = useTranslation();
  const selected = useBlueprint().selectedId === id;
  return (
    <div className={`cp-flow-node ${selected ? "is-selected" : ""}`}>
      <Handle
        type="target"
        id="inlet"
        position={Position.Left}
        className="cp-flow-handle"
        title={t("controlPanel.inlet")}
      />
      <div className="cp-flow-node__btn" title={data.device.name}>
        <span className="cp-flow-node__glyph">
          <DeviceTypeGlyph type={data.device.type} size={22} />
        </span>
        <span className="cp-flow-node__label">{data.device.name}</span>
      </div>
      <Handle
        type="source"
        id="outlet"
        position={Position.Right}
        className="cp-flow-handle"
        title={t("controlPanel.outlet")}
      />
    </div>
  );
}

const nodeTypes = { device: DeviceFlowNode, reactor: ReactorNode };

/** Grid spacing sized for reactor nodes (≈240 × 230 px). */
const COLUMN_STEP = 340;
const ROW_STEP = 300;

function autoLayoutPositions(
  devices: AccessibleDevice[],
  connections: PlantConnection[]
): Map<string, { x: number; y: number }> {
  const indeg = new Map(devices.map((d) => [d.id, 0]));
  const outs = new Map<string, string[]>(devices.map((d) => [d.id, []]));
  for (const c of connections) {
    if (!indeg.has(c.source_device_id) || !indeg.has(c.target_device_id)) continue;
    indeg.set(c.target_device_id, (indeg.get(c.target_device_id) ?? 0) + 1);
    outs.get(c.source_device_id)?.push(c.target_device_id);
  }

  const layers = new Map<string, number>();
  const queue = devices
    .filter((d) => (indeg.get(d.id) ?? 0) === 0)
    .map((d) => d.id);
  for (const id of queue) layers.set(id, 0);

  let i = 0;
  while (i < queue.length) {
    const id = queue[i++]!;
    const layer = layers.get(id) ?? 0;
    for (const next of outs.get(id) ?? []) {
      const prev = layers.get(next);
      if (prev === undefined || layer + 1 > prev) {
        layers.set(next, layer + 1);
      }
      if (!queue.includes(next)) queue.push(next);
    }
  }

  for (const d of devices) {
    if (!layers.has(d.id)) layers.set(d.id, 0);
  }

  const byLayer = new Map<number, string[]>();
  for (const [id, layer] of layers) {
    const list = byLayer.get(layer) ?? [];
    list.push(id);
    byLayer.set(layer, list);
  }

  const pos = new Map<string, { x: number; y: number }>();
  for (const [layer, ids] of byLayer) {
    ids.forEach((id, index) => {
      pos.set(id, { x: 80 + layer * COLUMN_STEP, y: 60 + index * ROW_STEP });
    });
  }
  return pos;
}

function toNode(
  device: AccessibleDevice,
  position: { x: number; y: number }
): Node<ReactorNodeData | DeviceNodeData> {
  return {
    id: device.id,
    type: device.type === "bioreactor" ? "reactor" : "device",
    position,
    deletable: false,
    data: { device },
  };
}

/** Docks keep their content while sliding out; matches --cp-view-ms. */
const DOCK_CLOSE_MS = 600;

type BlueprintInnerProps = {
  plantId: string;
  user: AppUser;
  editing: boolean;
};

function BlueprintInner({ plantId, user, editing }: BlueprintInnerProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { fitView } = useReactFlow();
  const fitViewRef = useRef(fitView);
  fitViewRef.current = fitView;
  const { toasts, push, dismiss } = useToasts();
  const [nodes, setNodes, onNodesChange] = useNodesState<
    Node<ReactorNodeData | DeviceNodeData>
  >([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dockedId, setDockedId] = useState<string | null>(null);
  const [controlsDock, setControlsDock] = useState<HTMLElement | null>(null);
  const [chartsDock, setChartsDock] = useState<HTMLElement | null>(null);
  const [chartsFor, setChartsFor] = useState<Record<string, boolean>>({});
  const knownIds = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (selectedId) {
      setDockedId(selectedId);
      return;
    }
    const timer = window.setTimeout(() => setDockedId(null), DOCK_CLOSE_MS);
    return () => window.clearTimeout(timer);
  }, [selectedId]);

  const rebuild = useCallback(async () => {
    setLoading(true);
    try {
      const [devices, connections, layouts] = await Promise.all([
        listAccessibleDevicesInPlant(plantId),
        listPlantConnections(plantId),
        listPlantLayouts(plantId),
      ]);

      const layoutByDevice = new Map(
        layouts.map((l) => [l.device_id, { x: l.x, y: l.y }])
      );
      const missing = devices.filter((d) => !layoutByDevice.has(d.id));
      if (missing.length > 0) {
        if (layoutByDevice.size === 0) {
          const auto = autoLayoutPositions(devices, connections);
          for (const d of missing) {
            layoutByDevice.set(d.id, auto.get(d.id) ?? { x: 80, y: 80 });
          }
        } else {
          // New units go to the right of the existing line, not on top of it.
          const placed = [...layoutByDevice.values()];
          const right = Math.max(...placed.map((p) => p.x)) + COLUMN_STEP;
          const top = Math.min(...placed.map((p) => p.y));
          missing.forEach((d, index) => {
            const p = { x: right, y: top + index * ROW_STEP };
            layoutByDevice.set(d.id, p);
            void upsertPlantLayout({ plantId, deviceId: d.id, ...p }).catch(
              () => {}
            );
          });
        }
      }

      setNodes(
        devices.map((d) => toNode(d, layoutByDevice.get(d.id) ?? { x: 80, y: 80 }))
      );
      setEdges(
        connections.map((c) => ({
          id: c.id,
          source: c.source_device_id,
          target: c.target_device_id,
          sourceHandle: "outlet",
          targetHandle: "inlet",
          animated: true,
        }))
      );

      const ids = new Set(devices.map((d) => d.id));
      const previous = knownIds.current;
      knownIds.current = ids;
      const added = previous ? [...ids].filter((id) => !previous.has(id)) : [];
      if (added.length === 1) {
        setSelectedId(added[0]!);
        window.setTimeout(() => {
          void fitViewRef.current({ padding: 0.25, maxZoom: 0.9, duration: 500 });
        }, 60);
      }
      setSelectedId((current) => (current && !ids.has(current) ? null : current));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [plantId, setNodes, setEdges]);

  useEffect(() => {
    knownIds.current = null;
    setSelectedId(null);
  }, [plantId]);

  useEffect(() => {
    void rebuild();
    const onDevicesChanged = () => {
      void rebuild();
    };
    window.addEventListener(DEVICES_CHANGED_EVENT, onDevicesChanged);
    return () => {
      window.removeEventListener(DEVICES_CHANGED_EVENT, onDevicesChanged);
    };
  }, [rebuild]);

  useEffect(() => {
    if (!selectedId) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable]")) return;
      setSelectedId(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selectedId]);

  const edgeKeys = useMemo(
    () => new Set(edges.map((e) => `${e.source}->${e.target}`)),
    [edges]
  );

  const onConnect: OnConnect = useCallback(
    async (connection: Connection) => {
      if (!editing) return;
      if (!connection.source || !connection.target) return;
      if (connection.source === connection.target) return;
      if (edgeKeys.has(`${connection.source}->${connection.target}`)) return;
      try {
        const created = await createPlantConnection({
          plantId,
          sourceDeviceId: connection.source,
          targetDeviceId: connection.target,
        });
        setEdges((eds) =>
          addEdge({ ...connection, id: created.id, animated: true }, eds)
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [editing, plantId, edgeKeys, setEdges]
  );

  const onEdgesDelete: OnEdgesDelete = useCallback(async (deleted) => {
    for (const edge of deleted) {
      try {
        await deletePlantConnection(edge.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    }
  }, []);

  const onNodeDragStop: OnNodeDrag = useCallback(
    async (_event, node) => {
      try {
        await upsertPlantLayout({
          plantId,
          deviceId: node.id,
          x: node.position.x,
          y: node.position.y,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [plantId]
  );

  const setHasCharts = useCallback((deviceId: string, hasCharts: boolean) => {
    setChartsFor((prev) =>
      prev[deviceId] === hasCharts ? prev : { ...prev, [deviceId]: hasCharts }
    );
  }, []);

  const context = useMemo<BlueprintContextValue>(
    () => ({
      user,
      selectedId,
      dockedId,
      controlsDock,
      chartsDock,
      setHasCharts,
      push,
    }),
    [user, selectedId, dockedId, controlsDock, chartsDock, setHasCharts, push]
  );

  const deviceById = (id: string | null) =>
    nodes.find((n) => n.id === id)?.data.device ?? null;
  const selectedDevice = deviceById(selectedId);
  const dockedDevice = deviceById(dockedId);
  const controlsOpen = Boolean(selectedDevice);
  const chartsOpen = Boolean(
    selectedDevice?.type === "bioreactor" && selectedId && chartsFor[selectedId]
  );
  const meta = dockedDevice ? DEVICE_TYPE_META[dockedDevice.type] : null;

  const openDevicePage = (device: AccessibleDevice) => {
    navigate(`${pathForDeviceType(device.type)}?device=${device.id}`);
  };

  if (loading && nodes.length === 0) {
    return (
      <div className="cp-empty">
        <p>{t("common.loading")}</p>
      </div>
    );
  }

  return (
    <BlueprintContext.Provider value={context}>
      <div className="cp-line">
        {error && <p className="cp-line__error">{error}</p>}
        <div
          className={[
            "cp-line__canvas",
            editing ? "is-editing" : "",
            chartsOpen ? "has-charts" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onEdgesDelete={onEdgesDelete}
            onNodeDragStop={onNodeDragStop}
            onNodeClick={(_event, node) => setSelectedId(node.id)}
            onPaneClick={() => setSelectedId(null)}
            nodeTypes={nodeTypes}
            nodesDraggable={editing}
            nodesConnectable={editing}
            elementsSelectable={editing}
            edgesFocusable={editing}
            deleteKeyCode={editing ? ["Backspace", "Delete"] : null}
            fitView
            fitViewOptions={{ padding: 0.25, maxZoom: 0.9 }}
            minZoom={0.2}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={18} size={1} color="var(--bv-border)" />
            <Controls showInteractive={false} position="bottom-right" />
            {editing ? (
              <Panel position="top-right">
                <button
                  type="button"
                  className="bp-add"
                  onClick={() => requestOpenAddDevice("bioreactor")}
                >
                  <AddOutline color="currentColor" height="16px" width="16px" />
                  {t("controlPanel.addReactor")}
                </button>
              </Panel>
            ) : null}
          </ReactFlow>

          {nodes.length === 0 ? (
            <div className="bp-empty">
              <p className="cp-empty__eyebrow">{t("controlPanel.lineEmptyEyebrow")}</p>
              <h2 className="cp-empty__title">{t("controlPanel.lineEmptyTitle")}</h2>
              <p className="cp-empty__body">{t("controlPanel.lineEmptyBody")}</p>
            </div>
          ) : null}

          <div
            className={`bp-dock bp-dock--controls ${controlsOpen ? "is-open" : ""}`}
            aria-label={t("controlPanel.unitControls")}
            aria-hidden={!controlsOpen}
          >
            {dockedDevice ? (
              <div className="bp-dock__head">
                <span className="bp-dock__glyph">
                  <DeviceTypeGlyph type={dockedDevice.type} size={18} />
                </span>
                <span className="bp-dock__titles">
                  <span className="bp-dock__name">{dockedDevice.name}</span>
                  <span className="bp-dock__type">
                    {meta ? t(meta.labelKey) : dockedDevice.type}
                  </span>
                </span>
                <button
                  type="button"
                  className="bp-dock__icon-btn"
                  title={t("controlPanel.openDevicePage")}
                  aria-label={t("controlPanel.openDevicePage")}
                  onClick={() => openDevicePage(dockedDevice)}
                >
                  <OpenOutline color="currentColor" height="16px" width="16px" />
                </button>
                <button
                  type="button"
                  className="bp-dock__icon-btn"
                  title={t("controlPanel.closeControls")}
                  aria-label={t("controlPanel.closeControls")}
                  onClick={() => setSelectedId(null)}
                >
                  <CloseOutline color="currentColor" height="16px" width="16px" />
                </button>
              </div>
            ) : null}
            <div className="bp-dock__body" ref={setControlsDock} />
          </div>

          <div
            className={`bp-dock bp-dock--charts ${chartsOpen ? "is-open" : ""}`}
            aria-label={t("controlPanel.unitCharts")}
            aria-hidden={!chartsOpen}
          >
            <div className="bp-dock__body" ref={setChartsDock} />
          </div>
        </div>
      </div>
      {createPortal(<ToastStack toasts={toasts} onDismiss={dismiss} />, document.body)}
    </BlueprintContext.Provider>
  );
}

type BlueprintViewProps = {
  plantId: string | null;
  user: AppUser;
  /** Moving, wiring and adding units is edit-mode only; operating is always allowed. */
  editing: boolean;
};

export default function BlueprintView({ plantId, user, editing }: BlueprintViewProps) {
  const { t } = useTranslation();
  if (!plantId) {
    return (
      <div className="cp-empty">
        <p>{t("controlPanel.noPlant")}</p>
      </div>
    );
  }
  return (
    <ReactFlowProvider>
      <BlueprintInner plantId={plantId} user={user} editing={editing} />
    </ReactFlowProvider>
  );
}
