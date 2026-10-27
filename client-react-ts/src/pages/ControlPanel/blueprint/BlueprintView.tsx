import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import {
  Background,
  ConnectionMode,
  ReactFlow,
  ReactFlowProvider,
  ViewportPortal,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type IsValidConnection,
  type Node,
  type NodeProps,
  type OnConnect,
  type OnNodeDrag,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import AddDevicePanel from "../../../components/AddDevicePanel";
import DeviceContextMenu from "../../../components/DeviceContextMenu";
import DeviceSettingsPanel from "../../../components/DeviceSettingsPanel";
import SharePanel from "../../../components/SharePanel";
import { ToastStack, useToasts } from "../../../components/Toast";
import { hasBioreactorCharts } from "../../../components/bioreactor/BioreactorCharts";
import {
  createMyDevice,
  deleteMyDevice,
  listAccessibleDevicesInPlant,
  renameMyDevice,
  updateMyDeviceConfig,
  type AccessibleDevice,
  type DeviceType,
} from "../../../lib/devices";
import {
  isVesselShapeId,
  LEGACY_OUTER_HEIGHT_PX,
  LEGACY_OUTER_WIDTH_PX,
  parseBioreactorConfig,
  toBioreactorConfigPatch,
  type BioreactorPiping,
  type VesselShapeId,
} from "../../../lib/bioreactorGeometry";
import { notifyDeviceUpdated } from "../../../lib/deviceEvents";
import {
  DEVICES_CHANGED_EVENT,
  notifyDevicesChanged,
} from "../../../lib/onboarding";
import { useOptionalPlantContext } from "../../../lib/PlantContext";
import { leavePlant } from "../../../lib/sharing";
import {
  createPlantConnection,
  deletePlantConnection,
  listPlantConnections,
  listPlantLayouts,
  upsertPlantLayout,
} from "../../../lib/plantGraph";
import {
  defaultPipeFittingConfig,
  fittingDisplayNameKey,
  isPipeFittingDeviceType,
  parsePipeFittingConfig,
  type PipeBore,
  type PipeFittingRotation,
  type PipeFittingTileKind,
} from "../../../lib/pipeFittings";
import { registerPlantFlowGraph } from "../../../lib/plantTransferJobs";
import type { FlowGraph } from "../../../lib/plantFlow";
import type { AppUser } from "../../../lib/user";
import DeviceTypeGlyph from "../DeviceTypeGlyph";
import {
  BlueprintContext,
  useBlueprint,
  type BlueprintContextValue,
} from "./BlueprintContext";
import DeviceLibrary, {
  DEVICE_LIBRARY_MIME,
  type DeviceLibraryPayload,
} from "./DeviceLibrary";
import PipeEdge, { PipeConnectionLine, type PipeEdgeType } from "./PipeEdge";
import PipeFittingNode, {
  type PipeFittingNodeData,
} from "./PipeFittingNode";
import PipeSprinkle from "./PipeSprinkle";
import ReactorNode, { REACTOR_SCALE, type ReactorNodeData } from "./ReactorNode";
import { usePlantFlowVisual } from "./usePlantFlowVisual";
import "./Blueprint.css";

function PlantFlowOverlay() {
  const snap = usePlantFlowVisual();
  return (
    <ViewportPortal>
      <PipeSprinkle snap={snap} />
    </ViewportPortal>
  );
}

/** Approximate reactor node size so a drop centers the vessel on the cursor. */
const DROP_NODE_W = LEGACY_OUTER_WIDTH_PX * REACTOR_SCALE;
const DROP_NODE_H = LEGACY_OUTER_HEIGHT_PX * REACTOR_SCALE + 28;
const DROP_FITTING = 160 * REACTOR_SCALE;

type PendingDrop = {
  vesselShape: VesselShapeId;
  x: number;
  y: number;
};

function parseLibraryPayload(raw: string): DeviceLibraryPayload | null {
  try {
    const parsed = JSON.parse(raw) as Partial<DeviceLibraryPayload> & {
      kind?: PipeFittingTileKind;
      bore?: PipeBore;
    };
    if (parsed.type === "bioreactor" && isVesselShapeId(parsed.vesselShape)) {
      return { type: "bioreactor", vesselShape: parsed.vesselShape };
    }
    if (
      parsed.type === "pipe_fitting" &&
      (parsed.kind === "cross" ||
        parsed.kind === "wye_split" ||
        parsed.kind === "wye_merge" ||
        parsed.kind === "reducer") &&
      (parsed.bore === "wide" || parsed.bore === "thin")
    ) {
      return { type: "pipe_fitting", kind: parsed.kind, bore: parsed.bore };
    }
    return null;
  } catch {
    return null;
  }
}

function canBePipeSource(device: AccessibleDevice): boolean {
  if (isPipeFittingDeviceType(device.type)) return true;
  if (device.type === "bioreactor") {
    return parseBioreactorConfig(device.config).equipment.outflow;
  }
  return false;
}

function canBePipeTarget(device: AccessibleDevice): boolean {
  if (isPipeFittingDeviceType(device.type)) return true;
  return device.type === "bioreactor";
}

function handleBusy(
  edges: PipeEdgeType[],
  nodeId: string,
  handleId: string | null | undefined
): boolean {
  if (!handleId) return true;
  return edges.some(
    (e) =>
      (e.source === nodeId && e.sourceHandle === handleId) ||
      (e.target === nodeId && e.targetHandle === handleId)
  );
}

/** Charts dock follows device config so switching units does not flash closed. */
function deviceHasCharts(device: AccessibleDevice): boolean {
  if (device.type !== "bioreactor") return false;
  return hasBioreactorCharts(parseBioreactorConfig(device.config).equipment);
}

type DeviceNodeData = { device: AccessibleDevice };

function DeviceFlowNode({ id, data }: NodeProps<Node<DeviceNodeData>>) {
  const selected = useBlueprint().selectedId === id;
  return (
    <div className={`cp-flow-node ${selected ? "is-selected" : ""}`}>
      <div className="cp-flow-node__btn" title={data.device.name}>
        <span className="cp-flow-node__glyph">
          <DeviceTypeGlyph type={data.device.type} size={22} />
        </span>
        <span className="cp-flow-node__label">{data.device.name}</span>
      </div>
    </div>
  );
}

const nodeTypes = {
  device: DeviceFlowNode,
  reactor: ReactorNode,
  fitting: PipeFittingNode,
};
const edgeTypes = { pipe: PipeEdge };

/** Id prefix for a pipe whose row is still being inserted. */
const PENDING_PIPE = "pending:";

function toPipeEdge(
  id: string,
  source: string,
  target: string,
  sourceHandle = "outlet",
  targetHandle = "inlet"
): PipeEdgeType {
  return {
    id,
    type: "pipe",
    source,
    target,
    sourceHandle,
    targetHandle,
    deletable: false,
    focusable: false,
  };
}

/** Horizontal spacing sized for reactor nodes (≈240 px wide). */
const COLUMN_STEP = 340;

type BlueprintNodeData = ReactorNodeData | DeviceNodeData | PipeFittingNodeData;

function toNode(
  device: AccessibleDevice,
  position: { x: number; y: number }
): Node<BlueprintNodeData> {
  const type = isPipeFittingDeviceType(device.type)
    ? "fitting"
    : device.type === "bioreactor"
      ? "reactor"
      : "device";
  return {
    id: device.id,
    type,
    position,
    deletable: false,
    data: { device },
  };
}

/** Docks keep their content while sliding out; matches --bv-chrome-ms / --cp-view-ms. */
const DOCK_CLOSE_MS = 600;

type BlueprintInnerProps = {
  plantId: string;
  user: AppUser;
  editing: boolean;
};

function BlueprintInner({ plantId, user, editing }: BlueprintInnerProps) {
  const { t } = useTranslation();
  const plantCtx = useOptionalPlantContext();
  const { fitView, screenToFlowPosition } = useReactFlow();
  const fitViewRef = useRef(fitView);
  fitViewRef.current = fitView;
  const { toasts, push, dismiss } = useToasts();
  const [nodes, setNodes, onNodesChange] = useNodesState<
    Node<BlueprintNodeData>
  >([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<PipeEdgeType>([]);
  const edgesRef = useRef(edges);
  edgesRef.current = edges;
  /** Pending pipes removed before their insert finished. */
  const cancelledPipes = useRef(new Set<string>());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedPipeId, setSelectedPipeId] = useState<string | null>(null);
  const [dockedId, setDockedId] = useState<string | null>(null);
  const [controlsDock, setControlsDock] = useState<HTMLElement | null>(null);
  const [chartsDock, setChartsDock] = useState<HTMLElement | null>(null);
  const [pendingDrop, setPendingDrop] = useState<PendingDrop | null>(null);
  const pendingDropRef = useRef<PendingDrop | null>(null);
  pendingDropRef.current = pendingDrop;
  const droppingFitting = useRef(false);
  const [contextMenu, setContextMenu] = useState<{
    device: AccessibleDevice;
    x: number;
    y: number;
  } | null>(null);
  const [settingsDevice, setSettingsDevice] = useState<AccessibleDevice | null>(
    null,
  );
  const [shareDevice, setShareDevice] = useState<AccessibleDevice | null>(null);
  const [nameFocus, setNameFocus] = useState<{ id: string; key: number } | null>(
    null,
  );
  const knownIds = useRef<Set<string> | null>(null);

  // Keep dock content mounted while the panels slide closed (deselect or edit mode).
  useEffect(() => {
    if (!editing && selectedId) {
      setDockedId(selectedId);
      return;
    }
    const timer = window.setTimeout(() => setDockedId(null), DOCK_CLOSE_MS);
    return () => window.clearTimeout(timer);
  }, [editing, selectedId]);

  const rebuild = useCallback(async () => {
    setLoading(true);
    try {
      const [devices, layouts, connections] = await Promise.all([
        listAccessibleDevicesInPlant(plantId),
        listPlantLayouts(plantId),
        listPlantConnections(plantId),
      ]);

      const layoutByDevice = new Map(
        layouts.map((l) => [l.device_id, { x: l.x, y: l.y }])
      );
      const missing = devices.filter((d) => !layoutByDevice.has(d.id));
      if (missing.length > 0) {
        // Unplaced units line up to the right of what is already on the canvas.
        const placed = [...layoutByDevice.values()];
        const startX =
          placed.length > 0 ? Math.max(...placed.map((p) => p.x)) + COLUMN_STEP : 80;
        const y = placed.length > 0 ? Math.min(...placed.map((p) => p.y)) : 60;
        missing.forEach((d, index) => {
          const p = { x: startX + index * COLUMN_STEP, y };
          layoutByDevice.set(d.id, p);
          void upsertPlantLayout({ plantId, deviceId: d.id, ...p }).catch(() => {});
        });
      }

      setNodes(
        devices.map((d) => toNode(d, layoutByDevice.get(d.id) ?? { x: 80, y: 60 }))
      );

      const byId = new Map(devices.map((d) => [d.id, d]));
      const pipes = connections.filter((c) => {
        const source = byId.get(c.source_device_id);
        const target = byId.get(c.target_device_id);
        if (!source || !target) return false;
        return canBePipeSource(source) && canBePipeTarget(target);
      });
      setEdges(
        pipes.map((c) =>
          toPipeEdge(
            c.id,
            c.source_device_id,
            c.target_device_id,
            c.source_handle,
            c.target_handle
          )
        )
      );
      setSelectedPipeId((current) =>
        current && !pipes.some((c) => c.id === current) ? null : current
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
    setSelectedPipeId(null);
  }, [plantId]);

  useEffect(() => {
    if (!editing) {
      setSelectedPipeId(null);
      setPendingDrop(null);
      setContextMenu(null);
      setSettingsDevice(null);
      setShareDevice(null);
      setNameFocus(null);
    }
  }, [editing]);

  const onLibraryDragOver = useCallback((event: ReactDragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }, []);

  const onLibraryDrop = useCallback(
    (event: ReactDragEvent) => {
      if (!editing) return;
      const raw = event.dataTransfer.getData(DEVICE_LIBRARY_MIME);
      const plain = event.dataTransfer.getData("text/plain");
      const payload =
        parseLibraryPayload(raw) ??
        (isVesselShapeId(plain)
          ? { type: "bioreactor" as const, vesselShape: plain }
          : null);
      if (!payload) return;
      event.preventDefault();
      const flow = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      if (payload.type === "pipe_fitting") {
        if (droppingFitting.current) return;
        droppingFitting.current = true;
        const x = flow.x - DROP_FITTING / 2;
        const y = flow.y - DROP_FITTING / 2;
        const config = defaultPipeFittingConfig(payload.kind, payload.bore);
        const name = t(fittingDisplayNameKey(config));
        void (async () => {
          try {
            const deviceId = await createMyDevice({
              type: "pipe_fitting",
              name,
              plantId,
            });
            await updateMyDeviceConfig(deviceId, {
              kind: config.kind,
              ...(config.bore ? { bore: config.bore } : {}),
              rotation: config.rotation,
            });
            await upsertPlantLayout({ plantId, deviceId, x, y });
            notifyDevicesChanged();
          } catch (err) {
            push(
              "error",
              t("piping.placeFailed"),
              err instanceof Error ? err.message : String(err)
            );
          } finally {
            droppingFitting.current = false;
          }
        })();
        return;
      }

      setPendingDrop({
        vesselShape: payload.vesselShape,
        x: flow.x - DROP_NODE_W / 2,
        y: flow.y - DROP_NODE_H / 2,
      });
    },
    [editing, plantId, push, screenToFlowPosition, t]
  );

  const onAddDeviceCreated = useCallback(
    async (deviceId: string, _type: DeviceType) => {
      const drop = pendingDropRef.current;
      if (drop) {
        try {
          await upsertPlantLayout({
            plantId,
            deviceId,
            x: drop.x,
            y: drop.y,
          });
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
      setPendingDrop(null);
      notifyDevicesChanged();
    },
    [plantId]
  );

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

  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const pipingSaves = useRef(new Map<string, number>());
  const nameSaves = useRef(new Map<string, number>());

  // Live plant graph for drain → pipe → fill / sprinkle transfers.
  useEffect(() => {
    const provider = (): FlowGraph => {
      const devices = nodesRef.current.map((n) => ({
        id: n.data.device.id,
        type: n.data.device.type,
        config: n.data.device.config ?? {},
      }));
      const edges = edgesRef.current
        .filter((e) => e.source && e.target && !String(e.id).startsWith(PENDING_PIPE))
        .map((e) => ({
          id: String(e.id),
          sourceDeviceId: e.source,
          sourceHandle: e.sourceHandle || "outlet",
          targetDeviceId: e.target,
          targetHandle: e.targetHandle || "inlet",
        }));
      return { devices, edges };
    };
    return registerPlantFlowGraph(plantId, provider);
  }, [plantId]);

  const setPiping = useCallback(
    (deviceId: string, piping: BioreactorPiping) => {
      const device = nodesRef.current.find((n) => n.id === deviceId)?.data.device;
      if (!device) return;
      const patch = toBioreactorConfigPatch({
        ...parseBioreactorConfig(device.config),
        piping,
      });
      const replaceConfig = (config: Record<string, unknown>) =>
        setNodes((nds) =>
          nds.map((n) =>
            n.id === deviceId
              ? { ...n, data: { ...n.data, device: { ...n.data.device, config } } }
              : n
          )
        );
      const save = (pipingSaves.current.get(deviceId) ?? 0) + 1;
      pipingSaves.current.set(deviceId, save);
      replaceConfig({ ...device.config, ...patch });
      updateMyDeviceConfig(deviceId, patch)
        .then(() => notifyDeviceUpdated(deviceId))
        .catch((err: unknown) => {
          if (pipingSaves.current.get(deviceId) !== save) return;
          replaceConfig(device.config);
          push(
            "error",
            t("controlPanel.pipingSaveFailed"),
            err instanceof Error ? err.message : String(err)
          );
        });
    },
    [push, setNodes, t]
  );

  const patchDeviceName = useCallback(
    (deviceId: string, name: string) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === deviceId
            ? { ...n, data: { ...n.data, device: { ...n.data.device, name } } }
            : n
        )
      );
      setSettingsDevice((current) =>
        current?.id === deviceId ? { ...current, name } : current
      );
      setContextMenu((current) =>
        current?.device.id === deviceId
          ? { ...current, device: { ...current.device, name } }
          : current
      );
    },
    [setNodes]
  );

  const onNodeContextMenu = useCallback(
    (event: ReactMouseEvent, node: Node<BlueprintNodeData>) => {
      if (!editing) return;
      event.preventDefault();
      setSelectedId(node.id);
      setSelectedPipeId(null);
      setContextMenu({
        device: node.data.device,
        x: event.clientX,
        y: event.clientY,
      });
    },
    [editing]
  );

  const renameDevice = useCallback(
    (deviceId: string, name: string) => {
      const device = nodesRef.current.find((n) => n.id === deviceId)?.data.device;
      if (!device || device.name === name) return;
      const save = (nameSaves.current.get(deviceId) ?? 0) + 1;
      nameSaves.current.set(deviceId, save);
      patchDeviceName(deviceId, name);
      renameMyDevice(deviceId, name)
        .then(() => notifyDevicesChanged())
        .catch((err: unknown) => {
          if (nameSaves.current.get(deviceId) !== save) return;
          patchDeviceName(deviceId, device.name);
          push(
            "error",
            t("deviceSettings.couldNotSave"),
            err instanceof Error ? err.message : String(err)
          );
        });
    },
    [patchDeviceName, push, t]
  );

  const onRenameDevice = useCallback((device: AccessibleDevice) => {
    setNameFocus((current) => ({ id: device.id, key: (current?.key ?? 0) + 1 }));
  }, []);

  const onDeleteDevice = useCallback(
    async (device: AccessibleDevice) => {
      const ok = window.confirm(t("nav.deleteConfirm", { name: device.name }));
      if (!ok) return;
      try {
        await deleteMyDevice(device.id);
        setSettingsDevice(null);
        setShareDevice(null);
        setSelectedId((current) => (current === device.id ? null : current));
        notifyDevicesChanged();
      } catch (err) {
        push(
          "error",
          t("nav.couldNotDelete"),
          err instanceof Error ? err.message : String(err)
        );
      }
    },
    [push, t]
  );

  const onLeaveDevice = useCallback(
    async (device: AccessibleDevice) => {
      const plantName =
        plantCtx?.plants.find((p) => p.id === device.plant_id)?.name ??
        device.name;
      const ok = window.confirm(t("nav.leaveConfirm", { name: plantName }));
      if (!ok) return;
      try {
        if (!device.plant_id) throw new Error(t("nav.couldNotLeave"));
        await leavePlant(device.plant_id);
        setSettingsDevice(null);
        setShareDevice(null);
        setSelectedId((current) => (current === device.id ? null : current));
        notifyDevicesChanged();
      } catch (err) {
        push(
          "error",
          t("nav.couldNotLeave"),
          err instanceof Error ? err.message : String(err)
        );
      }
    },
    [plantCtx?.plants, push, t]
  );

  // Each open pipe end takes one pipe; a drain never feeds its own reactor.
  const isValidConnection: IsValidConnection<PipeEdgeType> = useCallback(
    (connection) => {
      const { source, target, sourceHandle, targetHandle } = connection;
      if (!source || !target || source === target) return false;
      if (!sourceHandle || !targetHandle) return false;
      const sourceDevice = nodesRef.current.find((n) => n.id === source)?.data
        .device;
      const targetDevice = nodesRef.current.find((n) => n.id === target)?.data
        .device;
      if (!sourceDevice || !targetDevice) return false;
      if (!canBePipeSource(sourceDevice) || !canBePipeTarget(targetDevice)) {
        return false;
      }
      if (
        sourceDevice.type === "bioreactor" &&
        sourceHandle !== "outlet"
      ) {
        return false;
      }
      if (
        targetDevice.type === "bioreactor" &&
        targetHandle !== "inlet"
      ) {
        return false;
      }
      return (
        !handleBusy(edgesRef.current, source, sourceHandle) &&
        !handleBusy(edgesRef.current, target, targetHandle)
      );
    },
    []
  );

  const onConnect: OnConnect = useCallback(
    ({ source, target, sourceHandle, targetHandle }) => {
      if (!source || !target || !sourceHandle || !targetHandle) return;
      const pendingId = `${PENDING_PIPE}${source}:${sourceHandle}:${target}:${targetHandle}`;
      setEdges((eds) => [
        ...eds,
        toPipeEdge(pendingId, source, target, sourceHandle, targetHandle),
      ]);
      createPlantConnection({
        plantId,
        sourceDeviceId: source,
        targetDeviceId: target,
        sourceHandle,
        targetHandle,
      })
        .then((created) => {
          if (cancelledPipes.current.delete(pendingId)) {
            void deletePlantConnection(created.id).catch(() => {});
            return;
          }
          // A reload during the insert may already list the new row.
          setEdges((eds) => [
            ...eds.filter((e) => e.id !== pendingId && e.id !== created.id),
            toPipeEdge(
              created.id,
              source,
              target,
              created.source_handle,
              created.target_handle
            ),
          ]);
          setSelectedPipeId((current) =>
            current === pendingId ? created.id : current
          );
        })
        .catch((err: unknown) => {
          cancelledPipes.current.delete(pendingId);
          setEdges((eds) => eds.filter((e) => e.id !== pendingId));
          push(
            "error",
            t("controlPanel.pipeConnectFailed"),
            err instanceof Error ? err.message : String(err)
          );
        });
    },
    [plantId, push, setEdges, t]
  );

  const removePipe = useCallback(
    (edgeId: string) => {
      const edge = edgesRef.current.find((e) => e.id === edgeId);
      if (!edge) return;
      setSelectedPipeId((current) => (current === edgeId ? null : current));
      setEdges((eds) => eds.filter((e) => e.id !== edgeId));
      if (edgeId.startsWith(PENDING_PIPE)) {
        cancelledPipes.current.add(edgeId);
        return;
      }
      deletePlantConnection(edgeId).catch((err: unknown) => {
        // Put it back unless one of its ends has been re-piped meanwhile.
        setEdges((eds) =>
          handleBusy(eds, edge.source, edge.sourceHandle) ||
          handleBusy(eds, edge.target, edge.targetHandle)
            ? eds
            : [...eds, edge]
        );
        push(
          "error",
          t("controlPanel.pipeRemoveFailed"),
          err instanceof Error ? err.message : String(err)
        );
      });
    },
    [push, setEdges, t]
  );

  useEffect(() => {
    const onRotate = (event: Event) => {
      const detail = (event as CustomEvent<{
        deviceId: string;
        rotation: PipeFittingRotation;
      }>).detail;
      if (!detail?.deviceId) return;
      const device = nodesRef.current.find((n) => n.id === detail.deviceId)
        ?.data.device;
      if (!device || !isPipeFittingDeviceType(device.type)) return;
      const previous = parsePipeFittingConfig(device.config);
      const nextConfig = { ...previous, rotation: detail.rotation };
      const replaceConfig = (config: Record<string, unknown>) =>
        setNodes((nds) =>
          nds.map((n) =>
            n.id === detail.deviceId
              ? {
                  ...n,
                  data: {
                    ...n.data,
                    device: { ...n.data.device, config },
                  },
                }
              : n
          )
        );
      replaceConfig({
        ...device.config,
        kind: nextConfig.kind,
        ...(nextConfig.bore ? { bore: nextConfig.bore } : {}),
        rotation: nextConfig.rotation,
      });
      updateMyDeviceConfig(detail.deviceId, {
        kind: nextConfig.kind,
        ...(nextConfig.bore ? { bore: nextConfig.bore } : {}),
        rotation: nextConfig.rotation,
      })
        .then(() => notifyDeviceUpdated(detail.deviceId))
        .catch((err: unknown) => {
          replaceConfig(device.config);
          push(
            "error",
            t("controlPanel.pipingSaveFailed"),
            err instanceof Error ? err.message : String(err)
          );
        });
    };
    window.addEventListener("bp-rotate-fitting", onRotate);
    return () => window.removeEventListener("bp-rotate-fitting", onRotate);
  }, [push, setNodes, t]);

  const onEdgeClick = useCallback((_event: ReactMouseEvent, edge: PipeEdgeType) => {
    setSelectedId(null);
    setSelectedPipeId(edge.id);
  }, []);

  useEffect(() => {
    if (!selectedId && !selectedPipeId) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest("input, textarea, select, [contenteditable]")) {
        return;
      }
      if (event.key === "Escape") {
        setSelectedId(null);
        setSelectedPipeId(null);
      } else if (selectedPipeId && (event.key === "Delete" || event.key === "Backspace")) {
        event.preventDefault();
        removePipe(selectedPipeId);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selectedId, selectedPipeId, removePipe]);

  const context = useMemo<BlueprintContextValue>(
    () => ({
      user,
      editing,
      selectedId,
      dockedId,
      controlsDock,
      chartsDock,
      setPiping,
      renameDevice,
      nameFocus,
      selectedPipeId,
      removePipe,
      push,
    }),
    [
      user,
      editing,
      selectedId,
      dockedId,
      controlsDock,
      chartsDock,
      setPiping,
      renameDevice,
      nameFocus,
      selectedPipeId,
      removePipe,
      push,
    ]
  );

  const deviceById = (id: string | null) =>
    nodes.find((n) => n.id === id)?.data.device ?? null;
  const selectedDevice = deviceById(selectedId);
  // Edit mode is layout-only; keep docks closed. While open, switching units
  // only swaps content — open state follows the selection, not a per-unit flag.
  const controlsOpen =
    !editing &&
    Boolean(selectedDevice && selectedDevice.type === "bioreactor");
  const chartsOpen =
    !editing && Boolean(selectedDevice && deviceHasCharts(selectedDevice));

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
          className={["cp-line__canvas", editing ? "is-editing" : ""]
            .filter(Boolean)
            .join(" ")}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeDragStop={onNodeDragStop}
            onNodeClick={(_event, node) => {
              setSelectedId(node.id);
              setSelectedPipeId(null);
              setContextMenu(null);
            }}
            onNodeContextMenu={editing ? onNodeContextMenu : undefined}
            onEdgeClick={editing ? onEdgeClick : undefined}
            onPaneClick={() => {
              setSelectedId(null);
              setSelectedPipeId(null);
              setContextMenu(null);
            }}
            onConnect={onConnect}
            isValidConnection={isValidConnection}
            connectionMode={ConnectionMode.Loose}
            onDragOver={editing ? onLibraryDragOver : undefined}
            onDrop={editing ? onLibraryDrop : undefined}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            connectionLineComponent={PipeConnectionLine}
            connectionRadius={28}
            nodesDraggable={editing}
            nodesConnectable={editing}
            edgesFocusable={false}
            elementsSelectable={false}
            deleteKeyCode={null}
            fitView
            fitViewOptions={{ padding: 0.25, maxZoom: 0.9 }}
            minZoom={0.2}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={18} size={1} color="var(--bv-border)" />
            <PlantFlowOverlay />
          </ReactFlow>

          {nodes.length === 0 ? (
            <div className="bp-empty">
              <p className="cp-empty__eyebrow">{t("controlPanel.lineEmptyEyebrow")}</p>
              <h2 className="cp-empty__title">{t("controlPanel.lineEmptyTitle")}</h2>
              <p className="cp-empty__body">{t("controlPanel.lineEmptyBody")}</p>
            </div>
          ) : null}

          <DeviceLibrary open={editing} />

          <AddDevicePanel
            open={Boolean(pendingDrop)}
            plantId={plantId}
            initialVesselShape={pendingDrop?.vesselShape}
            onClose={() => setPendingDrop(null)}
            onCreated={onAddDeviceCreated}
          />

          <DeviceSettingsPanel
            device={settingsDevice}
            open={Boolean(settingsDevice)}
            onClose={() => setSettingsDevice(null)}
            onRenamed={async () => {
              if (!settingsDevice) return;
              const devices = await listAccessibleDevicesInPlant(plantId);
              const updated = devices.find((d) => d.id === settingsDevice.id);
              if (updated) {
                patchDeviceName(updated.id, updated.name);
                setSettingsDevice(updated);
              }
              notifyDevicesChanged();
            }}
            onRequestDelete={(device) => {
              void onDeleteDevice(device);
            }}
          />

          <SharePanel
            user={user}
            open={Boolean(shareDevice)}
            plantId={shareDevice?.plant_id || plantId}
            onClose={() => setShareDevice(null)}
            onChanged={() => {
              notifyDevicesChanged();
            }}
          />

          <div
            className={`bp-dock bp-dock--controls ${controlsOpen ? "is-open" : ""}`}
            aria-label={t("controlPanel.unitControls")}
            aria-hidden={!controlsOpen}
          >
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
      {contextMenu
        ? createPortal(
            <DeviceContextMenu
              device={contextMenu.device}
              x={contextMenu.x}
              y={contextMenu.y}
              onClose={() => setContextMenu(null)}
              onSettings={(device) => setSettingsDevice(device)}
              onRename={onRenameDevice}
              onShare={(device) => setShareDevice(device)}
              onDelete={onDeleteDevice}
              onLeave={onLeaveDevice}
            />,
            document.body
          )
        : null}
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
