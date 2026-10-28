import {
  FILL_PIPE_OD,
  OUTFLOW_PIPE_OD,
} from "../components/Canvas/bioreactorLayout";
import { VESSEL_FILL_DRAIN_RATE } from "../components/pressure-vessel/constants";
import {
  fittingHandleOd,
  isPipeFittingDeviceType,
  parsePipeFittingConfig,
  type PipeFittingConfig,
} from "./pipeFittings";

/** Wide bore carries the baseline drain rate; thin scales with area (OD²). */
export function odVolumetricRate(od: number): number {
  const wide = OUTFLOW_PIPE_OD;
  if (od <= 0 || wide <= 0) return 0;
  return VESSEL_FILL_DRAIN_RATE * (od / wide) ** 2;
}

export type FlowGraphDevice = {
  id: string;
  type: string;
  config: Record<string, unknown>;
};

export type FlowGraphEdge = {
  id: string;
  sourceDeviceId: string;
  sourceHandle: string;
  targetDeviceId: string;
  targetHandle: string;
};

export type FlowGraph = {
  devices: FlowGraphDevice[];
  edges: FlowGraphEdge[];
};

type PortRef = { deviceId: string; handleId: string };

type Link = {
  edgeId: string;
  a: PortRef;
  b: PortRef;
  capacity: number;
  od: number;
};

export type FlowSink =
  | {
      kind: "reactor";
      deviceId: string;
      handleId: string;
      rate: number;
      edgeIds: string[];
    }
  | {
      kind: "sprinkle";
      deviceId: string;
      handleId: string;
      rate: number;
      edgeIds: string[];
    };

export type ResolvedFlow = {
  sourceDeviceId: string;
  totalRate: number;
  sinks: FlowSink[];
  edgeRates: Record<string, number>;
  edgeOd: Record<string, number>;
  /** True when water travels React Flow source → target on that edge. */
  edgeAlongSource: Record<string, boolean>;
  sprinkleOnly: boolean;
};

function portKey(p: PortRef): string {
  return `${p.deviceId}::${p.handleId}`;
}

function handleOd(device: FlowGraphDevice | undefined, handleId: string): number {
  if (!device) return FILL_PIPE_OD;
  if (device.type === "bioreactor") {
    if (handleId === "outlet") return OUTFLOW_PIPE_OD;
    if (handleId === "inlet") return FILL_PIPE_OD;
    return FILL_PIPE_OD;
  }
  if (isPipeFittingDeviceType(device.type)) {
    return fittingHandleOd(parsePipeFittingConfig(device.config), handleId);
  }
  return FILL_PIPE_OD;
}

function formalPorts(config: PipeFittingConfig): string[] {
  switch (config.kind) {
    case "cross":
      return ["n", "s", "e", "w"];
    case "reducer":
      return ["wide", "thin"];
    case "wye_split":
    case "wye_merge":
      return ["stem", "left", "right"];
  }
}

/**
 * Ports water may leave through after arriving on `arrived`.
 * Cross is non-mixing: only the opposite port (N↔S, E↔W).
 */
export function fittingExitHandles(
  config: PipeFittingConfig,
  arrived: string,
  discoveredHandles: string[] = []
): string[] {
  const formal = formalPorts(config);
  const all = [...new Set([...formal, ...discoveredHandles])];

  switch (config.kind) {
    case "wye_split":
      if (arrived === "stem") return ["left", "right"];
      if (arrived === "left" || arrived === "right") return ["stem"];
      break;
    case "wye_merge":
      if (arrived === "left" || arrived === "right") return ["stem"];
      if (arrived === "stem") return ["left", "right"];
      break;
    case "reducer":
      if (arrived === "wide") return ["thin"];
      if (arrived === "thin") return ["wide"];
      break;
    case "cross": {
      // Two independent passages — never leak into the crossing axis.
      if (arrived === "n") return ["s"];
      if (arrived === "s") return ["n"];
      if (arrived === "e") return ["w"];
      if (arrived === "w") return ["e"];
      break;
    }
  }

  // Unknown / mis-labeled arrival: only leave via other formal ports that are
  // opposite-ish; never fan out a cross into every discovered handle.
  if (config.kind === "cross") return [];
  return all.filter((h) => h !== arrived);
}

function buildLinks(graph: FlowGraph): {
  byId: Map<string, FlowGraphDevice>;
  linksByPort: Map<string, Link[]>;
  handlesByDevice: Map<string, Set<string>>;
} {
  const byId = new Map(graph.devices.map((d) => [d.id, d]));
  const linksByPort = new Map<string, Link[]>();
  const handlesByDevice = new Map<string, Set<string>>();

  const noteHandle = (deviceId: string, handleId: string) => {
    let set = handlesByDevice.get(deviceId);
    if (!set) {
      set = new Set();
      handlesByDevice.set(deviceId, set);
    }
    set.add(handleId);
  };

  const add = (link: Link) => {
    const ka = portKey(link.a);
    const kb = portKey(link.b);
    const la = linksByPort.get(ka) ?? [];
    la.push(link);
    linksByPort.set(ka, la);
    const lb = linksByPort.get(kb) ?? [];
    lb.push(link);
    linksByPort.set(kb, lb);
    noteHandle(link.a.deviceId, link.a.handleId);
    noteHandle(link.b.deviceId, link.b.handleId);
  };

  for (const edge of graph.edges) {
    // Ensure edge endpoints exist even if a node was missing from the device list.
    if (!byId.has(edge.sourceDeviceId)) {
      byId.set(edge.sourceDeviceId, {
        id: edge.sourceDeviceId,
        type: "unknown",
        config: {},
      });
    }
    if (!byId.has(edge.targetDeviceId)) {
      byId.set(edge.targetDeviceId, {
        id: edge.targetDeviceId,
        type: "unknown",
        config: {},
      });
    }
    const aDev = byId.get(edge.sourceDeviceId);
    const bDev = byId.get(edge.targetDeviceId);
    const odA = handleOd(aDev, edge.sourceHandle);
    const odB = handleOd(bDev, edge.targetHandle);
    const od = Math.min(odA, odB);
    add({
      edgeId: edge.id,
      a: { deviceId: edge.sourceDeviceId, handleId: edge.sourceHandle },
      b: { deviceId: edge.targetDeviceId, handleId: edge.targetHandle },
      capacity: odVolumetricRate(od),
      od,
    });
  }

  return { byId, linksByPort, handlesByDevice };
}

type BranchResult = {
  capacity: number;
  sinks: Array<Omit<FlowSink, "rate"> & { capacity: number }>;
  edgeCaps: Record<string, number>;
  edgeOd: Record<string, number>;
  /** True = water enters at React Flow source end of the edge. */
  edgeAlongSource: Record<string, boolean>;
};

function emptyBranch(): BranchResult {
  return {
    capacity: 0,
    sinks: [],
    edgeCaps: {},
    edgeOd: {},
    edgeAlongSource: {},
  };
}

function capacityFromPort(
  byId: Map<string, FlowGraphDevice>,
  linksByPort: Map<string, Link[]>,
  handlesByDevice: Map<string, Set<string>>,
  port: PortRef,
  visitedEdges: Set<string>,
  edgePath: string[]
): BranchResult {
  const device = byId.get(port.deviceId);
  if (!device) return emptyBranch();

  if (device.type === "bioreactor" && port.handleId === "inlet") {
    const cap = odVolumetricRate(FILL_PIPE_OD);
    return {
      capacity: cap,
      sinks: [
        {
          kind: "reactor",
          deviceId: port.deviceId,
          handleId: "inlet",
          edgeIds: [...edgePath],
          capacity: cap,
        },
      ],
      edgeCaps: {},
      edgeOd: {},
      edgeAlongSource: {},
    };
  }

  const links = linksByPort.get(portKey(port)) ?? [];
  const openLinks = links.filter((l) => !visitedEdges.has(l.edgeId));

  if (openLinks.length === 0) {
    // Open fitting/reactor-outlet port → atmosphere.
    if (device.type === "bioreactor" && port.handleId === "outlet") {
      const cap = odVolumetricRate(OUTFLOW_PIPE_OD);
      return {
        capacity: cap,
        sinks: [
          {
            kind: "sprinkle",
            deviceId: port.deviceId,
            handleId: "outlet",
            edgeIds: [...edgePath],
            capacity: cap,
          },
        ],
        edgeCaps: {},
        edgeOd: {},
        edgeAlongSource: {},
      };
    }
    if (isPipeFittingDeviceType(device.type) || device.type === "unknown") {
      const od = handleOd(device, port.handleId);
      const cap = odVolumetricRate(od);
      if (cap <= 0) return emptyBranch();
      return {
        capacity: cap,
        sinks: [
          {
            kind: "sprinkle",
            deviceId: port.deviceId,
            handleId: port.handleId,
            edgeIds: [...edgePath],
            capacity: cap,
          },
        ],
        edgeCaps: {},
        edgeOd: {},
        edgeAlongSource: {},
      };
    }
    return emptyBranch();
  }

  let totalCap = 0;
  const sinks: BranchResult["sinks"] = [];
  const edgeCaps: Record<string, number> = {};
  const edgeOd: Record<string, number> = {};
  const edgeAlongSource: Record<string, boolean> = {};

  for (const link of openLinks) {
    const alongSource =
      link.a.deviceId === port.deviceId && link.a.handleId === port.handleId;
    const next: PortRef = alongSource ? link.b : link.a;
    const nextVisited = new Set(visitedEdges);
    nextVisited.add(link.edgeId);
    const path = [...edgePath, link.edgeId];
    const nextDevice = byId.get(next.deviceId);
    let branch: BranchResult;

    if (!nextDevice) {
      branch = emptyBranch();
    } else if (nextDevice.type === "bioreactor") {
      if (next.handleId === "outlet") {
        // Connected onto another reactor's outlet — no forward sink.
        branch = emptyBranch();
      } else {
        // Inlet (or a mis-labeled fill port) — accept as a fill sink.
        const inletCap = odVolumetricRate(FILL_PIPE_OD);
        const cap = Math.min(link.capacity, inletCap);
        branch = {
          capacity: cap,
          sinks: [
            {
              kind: "reactor",
              deviceId: next.deviceId,
              handleId: next.handleId || "inlet",
              edgeIds: path,
              capacity: cap,
            },
          ],
          edgeCaps: { [link.edgeId]: cap },
          edgeOd: { [link.edgeId]: link.od },
          edgeAlongSource: { [link.edgeId]: alongSource },
        };
      }
    } else if (
      isPipeFittingDeviceType(nextDevice.type) ||
      nextDevice.type === "unknown"
    ) {
      const config = parsePipeFittingConfig(nextDevice.config);
      const discovered = [
        ...(handlesByDevice.get(next.deviceId) ?? []),
      ];
      const exits = fittingExitHandles(config, next.handleId, discovered);
      const childBranches: BranchResult[] = [];
      for (const exit of exits) {
        childBranches.push(
          capacityFromPort(
            byId,
            linksByPort,
            handlesByDevice,
            { deviceId: next.deviceId, handleId: exit },
            nextVisited,
            path
          )
        );
      }
      // Mis-labeled connections (non-cross only): try other discovered handles.
      if (
        config.kind !== "cross" &&
        childBranches.every((b) => b.capacity <= 0) &&
        discovered.length > 0
      ) {
        for (const exit of discovered) {
          if (exit === next.handleId) continue;
          if (exits.includes(exit)) continue;
          childBranches.push(
            capacityFromPort(
              byId,
              linksByPort,
              handlesByDevice,
              { deviceId: next.deviceId, handleId: exit },
              nextVisited,
              path
            )
          );
        }
      }
      const childCap = childBranches.reduce((s, b) => s + b.capacity, 0);
      const cap = Math.min(link.capacity, childCap);
      const scale = childCap > 0 ? cap / childCap : 0;
      const mergedSinks: BranchResult["sinks"] = [];
      const mergedCaps: Record<string, number> = { [link.edgeId]: cap };
      const mergedOd: Record<string, number> = { [link.edgeId]: link.od };
      const mergedAlong: Record<string, boolean> = {
        [link.edgeId]: alongSource,
      };
      for (const child of childBranches) {
        for (const sink of child.sinks) {
          mergedSinks.push({
            ...sink,
            capacity: sink.capacity * scale,
          });
        }
        for (const [id, c] of Object.entries(child.edgeCaps)) {
          mergedCaps[id] = (mergedCaps[id] ?? 0) + c * scale;
        }
        Object.assign(mergedOd, child.edgeOd);
        Object.assign(mergedAlong, child.edgeAlongSource);
      }
      branch = {
        capacity: cap,
        sinks: mergedSinks,
        edgeCaps: mergedCaps,
        edgeOd: mergedOd,
        edgeAlongSource: mergedAlong,
      };
    } else {
      branch = emptyBranch();
    }

    totalCap += branch.capacity;
    sinks.push(...branch.sinks);
    for (const [id, c] of Object.entries(branch.edgeCaps)) {
      edgeCaps[id] = (edgeCaps[id] ?? 0) + c;
    }
    Object.assign(edgeOd, branch.edgeOd);
    Object.assign(edgeAlongSource, branch.edgeAlongSource);
  }

  return { capacity: totalCap, sinks, edgeCaps, edgeOd, edgeAlongSource };
}

export function resolveDrainFlow(
  graph: FlowGraph,
  sourceDeviceId: string
): ResolvedFlow {
  const { byId, linksByPort, handlesByDevice } = buildLinks(graph);
  const source = byId.get(sourceDeviceId);
  if (!source || source.type !== "bioreactor") {
    return {
      sourceDeviceId,
      totalRate: 0,
      sinks: [],
      edgeRates: {},
      edgeOd: {},
      edgeAlongSource: {},
      sprinkleOnly: true,
    };
  }

  const outlet: PortRef = { deviceId: sourceDeviceId, handleId: "outlet" };
  const branch = capacityFromPort(
    byId,
    linksByPort,
    handlesByDevice,
    outlet,
    new Set(),
    []
  );

  const outletCap = odVolumetricRate(OUTFLOW_PIPE_OD);
  const totalRate = Math.min(outletCap, branch.capacity);
  const scale = branch.capacity > 0 ? totalRate / branch.capacity : 0;

  const sinks: FlowSink[] = branch.sinks
    .map((s) => ({
      kind: s.kind,
      deviceId: s.deviceId,
      handleId: s.handleId,
      edgeIds: s.edgeIds,
      rate: s.capacity * scale,
    }))
    .filter((s) => s.rate > 0.001);

  const edgeRates: Record<string, number> = {};
  for (const [id, c] of Object.entries(branch.edgeCaps)) {
    const rate = c * scale;
    if (rate > 0.001) edgeRates[id] = rate;
  }

  const hasReactor = sinks.some((s) => s.kind === "reactor");
  const sprinkleOnly = sinks.length > 0 && !hasReactor;

  return {
    sourceDeviceId,
    totalRate,
    sinks,
    edgeRates,
    edgeOd: { ...branch.edgeOd },
    edgeAlongSource: { ...branch.edgeAlongSource },
    sprinkleOnly,
  };
}

/**
 * Vessel drain rate as the water front advances. Starts at the wide outlet
 * capacity; drops to a narrower bore's capacity once the front reaches that
 * section (≈ 70% along the edge, where reducers meet thin fittings).
 */
export function liveDrainRateForFront(
  flow: ResolvedFlow,
  frontEdges: number
): number {
  const outletCap = odVolumetricRate(OUTFLOW_PIPE_OD);
  if (flow.sinks.length === 0) return outletCap;

  let limitingOd = OUTFLOW_PIPE_OD;
  for (const sink of flow.sinks) {
    for (let i = 0; i < sink.edgeIds.length; i++) {
      // Far end of edge i (often the reduced bore) around i + 0.7.
      if (frontEdges < i + 0.7) break;
      const od = flow.edgeOd[sink.edgeIds[i]!] ?? OUTFLOW_PIPE_OD;
      limitingOd = Math.min(limitingOd, od);
    }
  }
  return odVolumetricRate(limitingOd);
}

/**
 * A full receiving tank cannot take more water. We used to rewrite it as a
 * "sprinkle" on the inlet handle — that sprayed out the top of the fill pipe.
 * Instead: keep the reactor sink but zero its rate so delivery stops. Atmosphere
 * spray stays reserved for true open pipe ends (fittings), never tank nozzles.
 */
export function applySinkBlocks(
  flow: ResolvedFlow,
  blockedReactorIds: Set<string>
): ResolvedFlow {
  if (blockedReactorIds.size === 0) return flow;

  const sinks: FlowSink[] = flow.sinks.map((s) => {
    if (s.kind === "reactor" && blockedReactorIds.has(s.deviceId)) {
      return { ...s, rate: 0 };
    }
    return s;
  });

  const totalRate = sinks.reduce((sum, s) => sum + s.rate, 0);
  return {
    ...flow,
    sinks,
    totalRate,
    sprinkleOnly:
      totalRate < 0.01 &&
      sinks.some((s) => s.kind === "sprinkle" && s.rate >= 0.01),
  };
}
