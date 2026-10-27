import {
  fillUnitsToStoredPercent,
  VESSEL_MAX_FILL_UNITS,
} from "../components/pressure-vessel/constants";
import { insertSensorReading, insertSliderState } from "./actuators";
import {
  applySinkBlocks,
  resolveDrainFlow,
  type FlowGraph,
  type FlowSink,
  type ResolvedFlow,
} from "./plantFlow";

const WATER_LEVEL_KEY = "water_level";

/** How many pipe segments the water front advances per second (after catch-up). */
const PIPE_FRONT_EDGES_PER_SEC = 1.8;

export type PlantTransferSnapshot = {
  sourceDeviceId: string;
  remainingUnits: number;
  requestedUnits: number;
  currentSourceUnits: number;
  flow: ResolvedFlow;
  /** @deprecated Prefer edgeProgress — kept for callers that expect a scalar. */
  pipeFill01: number;
  /** Per-edge leading fill 0..1 along each active path (source → sink). */
  edgeProgress: Record<string, number>;
  /** Per-edge trailing clear 0..1 — water occupies [tail, head] on each edge. */
  edgeTail: Record<string, number>;
  done: boolean;
};

/** Local same-tab notify when plant transfer changes a receiving tank level. */
export type PlantSinkLevelEvent = {
  deviceId: string;
  units: number;
  capacityL: number;
};

type SinkLevelListener = (event: PlantSinkLevelEvent) => void;

type DeviceLevel = {
  capacityL: number;
  units: number;
};

type Listener = (snap: PlantTransferSnapshot) => void;
type GlobalListener = (snap: PlantTransferSnapshot | null) => void;

type InternalJob = {
  userId: string;
  sourceDeviceId: string;
  plantId: string | null;
  graph: FlowGraph;
  sinkLevels: Map<string, DeviceLevel>;
  getSourceUnits: () => number;
  /** True once the vessel metal outlet is fully primed. */
  getOutletPrimed: () => boolean;
  /** True once the vessel metal outlet has finished emptying after valve close. */
  getOutletCleared: () => boolean;
  /** Latched once outletPrimed has been seen for this job. */
  wasOutletPrimed: boolean;
  lastSourceUnits: number;
  targetSourceUnits: number;
  requestedUnits: number;
  flow: ResolvedFlow;
  /** Distance the water front has traveled, in edge-lengths. */
  frontEdges: number;
  /** Trailing edge that clears pipes after the source dose finishes. */
  tailEdges: number;
  /** Volume waiting in the pipes per sink until the front arrives. */
  inTransit: Map<string, number>;
  edgeProgress: Record<string, number>;
  edgeTail: Record<string, number>;
  done: boolean;
  listeners: Set<Listener>;
  raf: number;
  lastTime: number;
  lastPersistAt: Map<string, number>;
  onComplete?: (snap: PlantTransferSnapshot) => void;
};

const jobs = new Map<string, InternalJob>();
const globalListeners = new Set<GlobalListener>();
const sinkLevelListeners = new Map<string, Set<SinkLevelListener>>();

function clampUnits(value: number) {
  return Math.min(VESSEL_MAX_FILL_UNITS, Math.max(0, value));
}

function sinkKey(sink: FlowSink): string {
  return `${sink.kind}:${sink.deviceId}:${sink.handleId}`;
}

function longestPathEdges(flow: ResolvedFlow): number {
  let max = 0;
  for (const sink of flow.sinks) {
    max = Math.max(max, sink.edgeIds.length);
  }
  return max;
}

function computeEdgeSpan(
  flow: ResolvedFlow,
  cursor: number
): Record<string, number> {
  const progress: Record<string, number> = {};
  for (const sink of flow.sinks) {
    sink.edgeIds.forEach((edgeId, index) => {
      const local = Math.min(1, Math.max(0, cursor - index));
      progress[edgeId] = Math.max(progress[edgeId] ?? 0, local);
    });
  }
  return progress;
}

function toSnapshot(job: InternalJob): PlantTransferSnapshot {
  const sourceUnits = job.getSourceUnits();
  const longest = Math.max(1, longestPathEdges(job.flow));
  return {
    sourceDeviceId: job.sourceDeviceId,
    remainingUnits: Math.max(0, sourceUnits - job.targetSourceUnits),
    requestedUnits: job.requestedUnits,
    currentSourceUnits: sourceUnits,
    flow: job.flow,
    pipeFill01: Math.min(1, job.frontEdges / longest),
    edgeProgress: job.edgeProgress,
    edgeTail: job.edgeTail,
    done: job.done,
  };
}

function emitSinkLevel(deviceId: string, level: DeviceLevel) {
  const listeners = sinkLevelListeners.get(deviceId);
  if (!listeners) return;
  const event: PlantSinkLevelEvent = {
    deviceId,
    units: level.units,
    capacityL: level.capacityL,
  };
  for (const listener of listeners) listener(event);
}

/** Same-tab: receiving reactors animate fill when plant water arrives. */
export function subscribePlantSinkLevel(
  deviceId: string,
  listener: SinkLevelListener
): () => void {
  let set = sinkLevelListeners.get(deviceId);
  if (!set) {
    set = new Set();
    sinkLevelListeners.set(deviceId, set);
  }
  set.add(listener);
  return () => {
    set!.delete(listener);
    if (set!.size === 0) sinkLevelListeners.delete(deviceId);
  };
}

function broadcast(snap: PlantTransferSnapshot | null) {
  for (const listener of globalListeners) listener(snap);
}

function notify(job: InternalJob) {
  const snap = toSnapshot(job);
  for (const listener of job.listeners) listener(snap);
  broadcast(snap);
}

function persistSink(job: InternalJob, deviceId: string, sensor: boolean) {
  const level = job.sinkLevels.get(deviceId);
  if (!level) return;
  const percent = fillUnitsToStoredPercent(level.units, level.capacityL);
  insertSliderState(deviceId, WATER_LEVEL_KEY, percent, job.userId).catch(
    console.error
  );
  if (sensor) {
    insertSensorReading(deviceId, WATER_LEVEL_KEY, percent, job.userId).catch(
      console.error
    );
  }
  job.lastPersistAt.set(deviceId, performance.now());
}

function maybeStreamPersist(job: InternalJob, deviceId: string) {
  const last = job.lastPersistAt.get(deviceId) ?? 0;
  if (performance.now() - last < 280) return;
  persistSink(job, deviceId, false);
}

function deliverToSink(job: InternalJob, sink: FlowSink, amount: number) {
  if (amount <= 0 || sink.kind !== "reactor") return;
  const level = job.sinkLevels.get(sink.deviceId);
  if (!level) return;
  const room = VESSEL_MAX_FILL_UNITS - level.units;
  const add = Math.min(room, amount);
  if (add <= 0) return;
  level.units = clampUnits(level.units + add);
  emitSinkLevel(sink.deviceId, level);
  maybeStreamPersist(job, sink.deviceId);
}

function finish(job: InternalJob) {
  // Flush any volume still sitting in the pipes into reached sinks.
  for (const sink of job.flow.sinks) {
    const key = sinkKey(sink);
    const pending = job.inTransit.get(key) ?? 0;
    if (pending > 0 && job.frontEdges >= sink.edgeIds.length) {
      deliverToSink(job, sink, pending);
      job.inTransit.set(key, 0);
    }
  }
  for (const id of job.sinkLevels.keys()) {
    persistSink(job, id, true);
  }
  job.done = true;
  job.edgeProgress = {};
  job.edgeTail = {};
  const snap = toSnapshot(job);
  for (const listener of job.listeners) listener(snap);
  broadcast(null);
  job.onComplete?.(snap);
  if (job.raf) cancelAnimationFrame(job.raf);
  jobs.delete(job.sourceDeviceId);
}

function refreshFlow(job: InternalJob) {
  const live = job.plantId ? getPlantFlowGraph(job.plantId) : null;
  if (live) job.graph = live;

  const blocked = new Set<string>();
  for (const [id, level] of job.sinkLevels) {
    if (level.units >= VESSEL_MAX_FILL_UNITS - 0.05) blocked.add(id);
  }
  const base = resolveDrainFlow(job.graph, job.sourceDeviceId);
  job.flow = applySinkBlocks(base, blocked);
}

function tick(job: InternalJob, now: number) {
  if (!jobs.has(job.sourceDeviceId)) return;

  if (!job.lastTime) job.lastTime = now;
  const dt = Math.min(0.05, (now - job.lastTime) / 1000);
  job.lastTime = now;

  refreshFlow(job);

  const longest = Math.max(1, longestPathEdges(job.flow));
  const sourceUnits = clampUnits(job.getSourceUnits());
  const outletPrimed = job.getOutletPrimed();
  const outletCleared = job.getOutletCleared();

  // Only count volume that leaves after the metal outlet is primed — otherwise
  // plant pipes would fill before the vessel outflow.
  let dV = 0;
  if (outletPrimed) {
    if (!job.wasOutletPrimed) {
      // Sync baseline so priming itself doesn't invent a volume dump.
      job.lastSourceUnits = sourceUnits;
      job.wasOutletPrimed = true;
    } else {
      dV = Math.max(0, job.lastSourceUnits - sourceUnits);
      job.lastSourceUnits = sourceUnits;
    }

    // Sequence: outflow first → then plant front.
    const dose = Math.max(0.01, job.requestedUnits);
    const drained = Math.min(
      dose,
      Math.max(0, dose - Math.max(0, sourceUnits - job.targetSourceUnits))
    );
    const catchUp = (drained / dose) * longest;
    job.frontEdges = Math.min(
      longest,
      Math.max(job.frontEdges + PIPE_FRONT_EDGES_PER_SEC * dt, catchUp)
    );
  }

  const sourceDone =
    sourceUnits <= job.targetSourceUnits + 0.05 || sourceUnits <= 0.05;
  // Sequence on close: empty metal outlet first, then trail plant pipes.
  if (sourceDone && outletCleared) {
    job.tailEdges = Math.min(
      job.frontEdges,
      job.tailEdges + PIPE_FRONT_EDGES_PER_SEC * dt
    );
  }

  job.edgeProgress = computeEdgeSpan(job.flow, job.frontEdges);
  job.edgeTail = computeEdgeSpan(job.flow, job.tailEdges);

  if (dV > 0 && job.flow.sinks.length > 0) {
    const sinkTotal = job.flow.sinks.reduce((s, x) => s + x.rate, 0) || 1;
    for (const sink of job.flow.sinks) {
      const share = (sink.rate / sinkTotal) * dV;
      const key = sinkKey(sink);
      job.inTransit.set(key, (job.inTransit.get(key) ?? 0) + share);
    }
  }

  // Deliver into sinks only after the front arrives, at the sink's flow rate.
  for (const sink of job.flow.sinks) {
    const key = sinkKey(sink);
    const pending = job.inTransit.get(key) ?? 0;
    if (pending <= 0 || job.frontEdges < sink.edgeIds.length) continue;
    const give = Math.min(pending, Math.max(sink.rate, 0.01) * dt);
    deliverToSink(job, sink, give);
    job.inTransit.set(key, pending - give);
  }

  notify(job);

  if (sourceDone) {
    let pending = 0;
    for (const v of job.inTransit.values()) pending += v;
    const frontDone = job.frontEdges >= longest - 0.01;
    const tailDone = job.tailEdges >= job.frontEdges - 0.01;
    // Wait for the vessel outlet to finish clearing before we consider the
    // plant trail done (and before we drop remaining in-pipe volume).
    if (pending > 0.05 || !frontDone || !outletCleared || !tailDone) {
      job.raf = requestAnimationFrame((t) => tick(job, t));
      return;
    }
    finish(job);
    return;
  }

  job.raf = requestAnimationFrame((t) => tick(job, t));
}

export type StartPlantDrainInput = {
  sourceDeviceId: string;
  userId: string;
  plantId?: string | null;
  graph: FlowGraph;
  sinkLevels: Record<string, DeviceLevel>;
  getSourceUnits: () => number;
  /** Defaults to always-true when the vessel has no outlet animation. */
  getOutletPrimed?: () => boolean;
  getOutletCleared?: () => boolean;
  startUnits: number;
  targetUnits: number;
  requestedUnits: number;
  onComplete?: (snap: PlantTransferSnapshot) => void;
};

export function startPlantDrainTransfer(
  input: StartPlantDrainInput
): ResolvedFlow {
  cancelPlantDrainTransfer(input.sourceDeviceId);

  const flow = resolveDrainFlow(input.graph, input.sourceDeviceId);
  if (flow.totalRate <= 0.01 && flow.sinks.length === 0) {
    return flow;
  }

  const sinkLevels = new Map<string, DeviceLevel>();
  for (const [id, level] of Object.entries(input.sinkLevels)) {
    sinkLevels.set(id, {
      capacityL: level.capacityL,
      units: clampUnits(level.units),
    });
  }

  const job: InternalJob = {
    userId: input.userId,
    sourceDeviceId: input.sourceDeviceId,
    plantId: input.plantId ?? null,
    graph: input.graph,
    sinkLevels,
    getSourceUnits: input.getSourceUnits,
    getOutletPrimed: input.getOutletPrimed ?? (() => true),
    getOutletCleared: input.getOutletCleared ?? (() => true),
    wasOutletPrimed: false,
    lastSourceUnits: clampUnits(input.startUnits),
    targetSourceUnits: input.targetUnits,
    requestedUnits: input.requestedUnits,
    flow,
    frontEdges: 0,
    tailEdges: 0,
    inTransit: new Map(),
    edgeProgress: {},
    edgeTail: {},
    done: false,
    listeners: new Set(),
    raf: 0,
    lastTime: 0,
    lastPersistAt: new Map(),
    onComplete: input.onComplete,
  };
  jobs.set(input.sourceDeviceId, job);
  notify(job);
  job.raf = requestAnimationFrame((t) => tick(job, t));
  return flow;
}

export function cancelPlantDrainTransfer(sourceDeviceId: string): void {
  const job = jobs.get(sourceDeviceId);
  if (!job) return;
  if (job.raf) cancelAnimationFrame(job.raf);
  job.done = true;
  broadcast(null);
  jobs.delete(sourceDeviceId);
}

/** Refresh peer tank levels once slider reads arrive (job already running). */
export function patchPlantDrainSinkLevels(
  sourceDeviceId: string,
  sinkLevels: Record<string, DeviceLevel>
): void {
  const job = jobs.get(sourceDeviceId);
  if (!job || job.done) return;
  for (const [id, level] of Object.entries(sinkLevels)) {
    const prev = job.sinkLevels.get(id);
    const fetched = clampUnits(level.units);
    // Job started at provisional 0; keep any volume already delivered.
    const alreadyDelivered = prev?.units ?? 0;
    const next: DeviceLevel = {
      capacityL: level.capacityL,
      units: clampUnits(fetched + alreadyDelivered),
    };
    job.sinkLevels.set(id, next);
    if (alreadyDelivered > 0.05) emitSinkLevel(id, next);
  }
}

export function getPlantDrainTransfer(
  sourceDeviceId: string
): PlantTransferSnapshot | null {
  const job = jobs.get(sourceDeviceId);
  return job ? toSnapshot(job) : null;
}

export function hasPlantDrainTransfer(sourceDeviceId: string): boolean {
  return jobs.has(sourceDeviceId);
}

export function isDeviceInPlantDrain(deviceId: string): boolean {
  for (const job of jobs.values()) {
    if (job.sourceDeviceId === deviceId) return true;
    if (
      job.flow.sinks.some(
        (s) => s.kind === "reactor" && s.deviceId === deviceId
      )
    ) {
      return true;
    }
  }
  return false;
}

export function subscribePlantDrainTransfer(
  sourceDeviceId: string,
  listener: Listener
): () => void {
  const job = jobs.get(sourceDeviceId);
  if (!job) return () => {};
  job.listeners.add(listener);
  listener(toSnapshot(job));
  return () => {
    job.listeners.delete(listener);
  };
}

export function subscribePlantFlowVisuals(
  listener: GlobalListener
): () => void {
  globalListeners.add(listener);
  const first = jobs.values().next().value as InternalJob | undefined;
  listener(first ? toSnapshot(first) : null);
  return () => {
    globalListeners.delete(listener);
  };
}

export function getActivePlantFlowVisual(): PlantTransferSnapshot | null {
  const first = jobs.values().next().value as InternalJob | undefined;
  return first ? toSnapshot(first) : null;
}

type GraphProvider = () => FlowGraph | null;
const graphProviders = new Map<string, GraphProvider>();

export function registerPlantFlowGraph(
  plantId: string,
  provider: GraphProvider
): () => void {
  graphProviders.set(plantId, provider);
  return () => {
    if (graphProviders.get(plantId) === provider) {
      graphProviders.delete(plantId);
    }
  };
}

export function getPlantFlowGraph(
  plantId: string | null | undefined
): FlowGraph | null {
  if (!plantId) return null;
  return graphProviders.get(plantId)?.() ?? null;
}
