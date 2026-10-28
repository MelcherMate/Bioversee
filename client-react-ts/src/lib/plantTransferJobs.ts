import {
  fillUnitsToStoredPercent,
  VESSEL_MAX_FILL_UNITS,
} from "../components/pressure-vessel/constants";
import { insertSensorReading, insertSliderState } from "./actuators";
import {
  applySinkBlocks,
  liveDrainRateForFront,
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
  /**
   * Live vessel drain rate (units/s): wide outlet until the front hits a
   * narrower bore, then that bore's capacity.
   */
  liveDrainRate: number;
  /** @deprecated Prefer edgeProgress — kept for callers that expect a scalar. */
  pipeFill01: number;
  /** Per-edge leading fill 0..1 along each active path (source → sink). */
  edgeProgress: Record<string, number>;
  /** Per-edge trailing clear 0..1 — water occupies [tail, head] on each edge. */
  edgeTail: Record<string, number>;
  /**
   * Per source vessel: metal outlet primed (water at tip) / cleared (empty).
   * Used to gate atmosphere spray on a direct open outlet (no plant pipe).
   */
  sourceOutlet: Record<string, { primed: boolean; cleared: boolean }>;
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
  /** Source fill when the job started (immutable). */
  startSourceUnits: number;
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
  /** Source units committed into inTransit (must equal delivered + pending). */
  volumeOut: number;
  /** Units delivered into reactor sinks (or vented as sprinkle). */
  volumeDelivered: number;
  edgeProgress: Record<string, number>;
  edgeTail: Record<string, number>;
  done: boolean;
  listeners: Set<Listener>;
  raf: number;
  lastTime: number;
  lastPersistAt: Map<string, number>;
  /** Sink ids whose server baseline has been applied onto the shared level. */
  patchedSinkBaselines: Set<string>;
  lastEmittedRate: number;
  onLiveRate?: (rate: number) => void;
  onComplete?: (snap: PlantTransferSnapshot) => void;
};

const jobs = new Map<string, InternalJob>();
const globalListeners = new Set<GlobalListener>();
const sinkLevelListeners = new Map<string, Set<SinkLevelListener>>();
/** Live sink fill shared across concurrent drain jobs (so volumes accumulate). */
const sharedSinkLevels = new Map<string, DeviceLevel>();
/** Total units delivered into each sink across all active jobs this session. */
const sharedSinkDelivered = new Map<string, number>();

function clampUnits(value: number) {
  return Math.min(VESSEL_MAX_FILL_UNITS, Math.max(0, value));
}

function clearSharedSinksIfIdle() {
  if (jobs.size > 0) return;
  sharedSinkLevels.clear();
  sharedSinkDelivered.clear();
}

/**
 * Merge every active drain into one pipe visual so multi-source flows join on
 * shared edges instead of flickering between single-job snapshots.
 */
function mergeVisualSnapshot(): PlantTransferSnapshot | null {
  const active: InternalJob[] = [];
  for (const job of jobs.values()) {
    if (!job.done) active.push(job);
  }
  if (active.length === 0) return null;
  if (active.length === 1) return toSnapshot(active[0]!);

  const edgeProgress: Record<string, number> = {};
  const edgeTail: Record<string, number> = {};
  const edgeRates: Record<string, number> = {};
  const edgeOd: Record<string, number> = {};
  const edgeAlongSource: Record<string, boolean> = {};
  const sinks: FlowSink[] = [];
  let totalRate = 0;
  let remainingUnits = 0;
  let requestedUnits = 0;
  let currentSourceUnits = 0;
  let sprinkleOnly = true;

  for (const job of active) {
    remainingUnits += Math.max(
      0,
      job.getSourceUnits() - job.targetSourceUnits
    );
    requestedUnits += job.requestedUnits;
    currentSourceUnits += job.getSourceUnits();
    totalRate += job.flow.totalRate;
    if (!job.flow.sprinkleOnly) sprinkleOnly = false;
    for (const sink of job.flow.sinks) sinks.push(sink);

    for (const [id, rate] of Object.entries(job.flow.edgeRates)) {
      edgeRates[id] = (edgeRates[id] ?? 0) + rate;
    }
    for (const [id, od] of Object.entries(job.flow.edgeOd)) {
      edgeOd[id] = Math.max(edgeOd[id] ?? 0, od);
    }
    for (const [id, along] of Object.entries(job.flow.edgeAlongSource)) {
      if (edgeAlongSource[id] === undefined) edgeAlongSource[id] = along;
    }
    for (const [id, head] of Object.entries(job.edgeProgress)) {
      edgeProgress[id] = Math.max(edgeProgress[id] ?? 0, head);
    }
    for (const [id, tail] of Object.entries(job.edgeTail)) {
      const head = job.edgeProgress[id] ?? 0;
      if (head - tail < 0.01) continue;
      edgeTail[id] = Math.min(edgeTail[id] ?? 1, tail);
    }
  }

  for (const id of Object.keys(edgeProgress)) {
    if (edgeTail[id] === undefined) edgeTail[id] = 0;
  }

  const frontLike = Math.max(
    ...active.map((j) => j.frontEdges / Math.max(1, longestPathEdges(j.flow))),
    0
  );

  const sourceOutlet: Record<string, { primed: boolean; cleared: boolean }> =
    {};
  for (const job of active) {
    sourceOutlet[job.sourceDeviceId] = {
      primed: job.getOutletPrimed(),
      cleared: job.getOutletCleared(),
    };
  }

  const liveDrainRate = Math.min(
    ...active.map((j) => liveDrainRateForFront(j.flow, j.frontEdges))
  );

  return {
    sourceDeviceId: active.map((j) => j.sourceDeviceId).join("+"),
    remainingUnits,
    requestedUnits,
    currentSourceUnits,
    flow: {
      sourceDeviceId: active[0]!.sourceDeviceId,
      totalRate,
      sinks,
      edgeRates,
      edgeOd,
      edgeAlongSource,
      sprinkleOnly,
    },
    liveDrainRate,
    pipeFill01: Math.min(1, frontLike),
    edgeProgress,
    edgeTail,
    sourceOutlet,
    done: false,
  };
}

function broadcastVisual() {
  const snap = mergeVisualSnapshot();
  for (const listener of globalListeners) listener(snap);
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
    liveDrainRate: liveDrainRateForFront(job.flow, job.frontEdges),
    pipeFill01: Math.min(1, job.frontEdges / longest),
    edgeProgress: job.edgeProgress,
    edgeTail: job.edgeTail,
    sourceOutlet: {
      [job.sourceDeviceId]: {
        primed: job.getOutletPrimed(),
        cleared: job.getOutletCleared(),
      },
    },
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

function notify(job: InternalJob) {
  const snap = toSnapshot(job);
  for (const listener of job.listeners) listener(snap);
  broadcastVisual();
}

function persistSink(job: InternalJob, deviceId: string, sensor: boolean) {
  const level =
    sharedSinkLevels.get(deviceId) ?? job.sinkLevels.get(deviceId);
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
  if (amount <= 0 || sink.kind !== "reactor") return 0;
  const level =
    sharedSinkLevels.get(sink.deviceId) ?? job.sinkLevels.get(sink.deviceId);
  if (!level) return 0;
  const room = VESSEL_MAX_FILL_UNITS - level.units;
  const add = Math.min(room, amount);
  if (add <= 0) return 0;
  level.units = clampUnits(level.units + add);
  sharedSinkDelivered.set(
    sink.deviceId,
    (sharedSinkDelivered.get(sink.deviceId) ?? 0) + add
  );
  // Keep per-job map on the same object so concurrent drains share units.
  job.sinkLevels.set(sink.deviceId, level);
  sharedSinkLevels.set(sink.deviceId, level);
  job.volumeDelivered += add;
  emitSinkLevel(sink.deviceId, level);
  maybeStreamPersist(job, sink.deviceId);
  return add;
}

function finish(job: InternalJob) {
  // Flush any volume still sitting in the pipes into reached sinks.
  for (const sink of job.flow.sinks) {
    const key = sinkKey(sink);
    const pending = job.inTransit.get(key) ?? 0;
    if (pending > 0 && job.frontEdges >= sink.edgeIds.length) {
      if (sink.kind === "reactor") {
        const got = deliverToSink(job, sink, pending);
        job.inTransit.set(key, Math.max(0, pending - got));
      } else {
        // Atmosphere: vent remaining.
        job.volumeDelivered += pending;
        job.inTransit.set(key, 0);
      }
    }
  }
  // Precision: every unit that left the source must land in a reactor sink
  // (merger accumulation) unless the receiver is truly full. Prefer actual
  // tank delta over the tick ledger so priming/rAF races cannot leak liters.
  let pendingLeft = 0;
  for (const v of job.inTransit.values()) pendingLeft += v;
  const endUnits = clampUnits(job.getSourceUnits());
  const drained = Math.max(0, job.startSourceUnits - endUnits);
  const shortfall = Math.max(
    0,
    Math.max(drained, job.volumeOut) - job.volumeDelivered - pendingLeft
  );
  if (shortfall > 0.001) {
    const reactorSink = job.flow.sinks.find((s) => s.kind === "reactor");
    if (reactorSink) deliverToSink(job, reactorSink, shortfall);
  }
  // Anything still queued with nowhere to go (full tank) is dropped here.
  for (const key of job.inTransit.keys()) job.inTransit.set(key, 0);

  // Final emit so the receiver UI snaps to the shared accumulated level.
  for (const sink of job.flow.sinks) {
    if (sink.kind !== "reactor") continue;
    const level = sharedSinkLevels.get(sink.deviceId);
    if (level) emitSinkLevel(sink.deviceId, level);
  }
  for (const id of job.sinkLevels.keys()) {
    persistSink(job, id, true);
  }
  job.done = true;
  job.edgeProgress = {};
  job.edgeTail = {};
  const snap = toSnapshot(job);
  for (const listener of job.listeners) listener(snap);
  job.onComplete?.(snap);
  if (job.raf) cancelAnimationFrame(job.raf);
  jobs.delete(job.sourceDeviceId);
  clearSharedSinksIfIdle();
  broadcastVisual();
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

  // Count volume that left the source once the metal outlet is primed.
  // Include any decrease since job start on the first primed tick — the drain
  // rAF can run several steady frames before we observe prime, and discarding
  // that window dropped ~1 L per job (broken merger accumulation).
  let dV = 0;
  if (outletPrimed) {
    dV = Math.max(0, job.lastSourceUnits - sourceUnits);
    job.lastSourceUnits = sourceUnits;
    job.wasOutletPrimed = true;

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

  // Throttle vessel drain once the front reaches a narrower bore.
  const liveRate = liveDrainRateForFront(job.flow, job.frontEdges);
  if (Math.abs(liveRate - job.lastEmittedRate) > 0.05) {
    job.lastEmittedRate = liveRate;
    job.onLiveRate?.(liveRate);
  }

  if (dV > 0 && job.flow.sinks.length > 0) {
    const live = job.flow.sinks.filter((s) => s.rate >= 0.01);
    const queue = live.length > 0 ? live : job.flow.sinks;
    const sinkTotal = queue.reduce((s, x) => s + Math.max(x.rate, 0.01), 0);
    for (const sink of queue) {
      const share = (Math.max(sink.rate, 0.01) / sinkTotal) * dV;
      const key = sinkKey(sink);
      job.inTransit.set(key, (job.inTransit.get(key) ?? 0) + share);
      job.volumeOut += share;
    }
  }

  // Deliver into sinks only after the front arrives, at the sink's flow rate.
  for (const sink of job.flow.sinks) {
    const key = sinkKey(sink);
    const pending = job.inTransit.get(key) ?? 0;
    // Full receiver — keep volume queued; finish() tops up remaining room.
    if (sink.kind === "reactor" && sink.rate < 0.01) {
      continue;
    }
    if (pending <= 0 || job.frontEdges < sink.edgeIds.length) continue;
    const give = Math.min(pending, Math.max(sink.rate, 0.01) * dt);
    if (give <= 0) continue;
    if (sink.kind === "reactor") {
      const got = deliverToSink(job, sink, give);
      job.inTransit.set(key, Math.max(0, pending - got));
    } else {
      // Sprinkle = atmosphere: volume leaves the pipes, nothing to store.
      job.volumeDelivered += give;
      job.inTransit.set(key, Math.max(0, pending - give));
    }
  }

  notify(job);

  if (sourceDone) {
    let pending = 0;
    for (const v of job.inTransit.values()) pending += v;
    const frontDone = job.frontEdges >= longest - 0.01;
    const tailDone = job.tailEdges >= job.frontEdges - 0.01;
    // Wait for the vessel outlet to finish clearing before we consider the
    // plant trail done (and before we drop remaining in-pipe volume).
    if (!frontDone || !outletCleared || !tailDone) {
      job.raf = requestAnimationFrame((t) => tick(job, t));
      return;
    }
    if (pending > 0.05) {
      const canDeliver = job.flow.sinks.some((sink) => {
        if (job.frontEdges < sink.edgeIds.length) return false;
        if (sink.kind === "sprinkle") return true;
        return sink.kind === "reactor" && sink.rate >= 0.01;
      });
      if (canDeliver) {
        job.raf = requestAnimationFrame((t) => tick(job, t));
        return;
      }
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
  /** Fired when the front hits a narrower bore and drain should slow. */
  onLiveRate?: (rate: number) => void;
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

  // Share sink fill objects across concurrent drains so volumes accumulate.
  const sinkLevels = new Map<string, DeviceLevel>();
  for (const [id, level] of Object.entries(input.sinkLevels)) {
    let shared = sharedSinkLevels.get(id);
    if (!shared) {
      shared = {
        capacityL: level.capacityL,
        units: clampUnits(level.units),
      };
      sharedSinkLevels.set(id, shared);
      if (!sharedSinkDelivered.has(id)) sharedSinkDelivered.set(id, 0);
    } else {
      shared.capacityL = level.capacityL || shared.capacityL;
    }
    sinkLevels.set(id, shared);
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
    startSourceUnits: clampUnits(input.startUnits),
    lastSourceUnits: clampUnits(input.startUnits),
    targetSourceUnits: input.targetUnits,
    requestedUnits: input.requestedUnits,
    flow,
    frontEdges: 0,
    tailEdges: 0,
    inTransit: new Map(),
    volumeOut: 0,
    volumeDelivered: 0,
    edgeProgress: {},
    edgeTail: {},
    done: false,
    listeners: new Set(),
    raf: 0,
    lastTime: 0,
    lastPersistAt: new Map(),
    patchedSinkBaselines: new Set(),
    lastEmittedRate: liveDrainRateForFront(flow, 0),
    onLiveRate: input.onLiveRate,
    onComplete: input.onComplete,
  };
  jobs.set(input.sourceDeviceId, job);
  // Start at wide-outlet rate; tick() will drop when the front hits a reducer.
  input.onLiveRate?.(job.lastEmittedRate);
  notify(job);
  job.raf = requestAnimationFrame((t) => tick(job, t));
  return flow;
}

export function cancelPlantDrainTransfer(sourceDeviceId: string): void {
  const job = jobs.get(sourceDeviceId);
  if (!job) return;
  if (job.raf) cancelAnimationFrame(job.raf);
  job.done = true;
  jobs.delete(sourceDeviceId);
  clearSharedSinksIfIdle();
  broadcastVisual();
}

/** Refresh peer tank levels once slider reads arrive (job already running). */
export function patchPlantDrainSinkLevels(
  sourceDeviceId: string,
  sinkLevels: Record<string, DeviceLevel>
): void {
  const job = jobs.get(sourceDeviceId);
  if (!job || job.done) return;
  for (const [id, level] of Object.entries(sinkLevels)) {
    const fetched = clampUnits(level.units);
    const delivered = sharedSinkDelivered.get(id) ?? 0;
    if (job.patchedSinkBaselines.has(id)) {
      const shared = sharedSinkLevels.get(id);
      if (shared) shared.capacityL = level.capacityL || shared.capacityL;
      continue;
    }
    job.patchedSinkBaselines.add(id);
    // Baseline from server + everything already poured by any active job.
    const next: DeviceLevel = {
      capacityL: level.capacityL,
      units: clampUnits(fetched + delivered),
    };
    sharedSinkLevels.set(id, next);
    job.sinkLevels.set(id, next);
    if (delivered > 0.05) emitSinkLevel(id, next);
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
  listener(mergeVisualSnapshot());
  return () => {
    globalListeners.delete(listener);
  };
}

export function getActivePlantFlowVisual(): PlantTransferSnapshot | null {
  return mergeVisualSnapshot();
}

/** Debug: shared receiver fill + liters delivered this multi-drain session. */
export function getSharedPlantSinkDebug(): Record<
  string,
  { units: number; capacityL: number; deliveredUnits: number }
> {
  const out: Record<
    string,
    { units: number; capacityL: number; deliveredUnits: number }
  > = {};
  for (const [id, level] of sharedSinkLevels) {
    out[id] = {
      units: level.units,
      capacityL: level.capacityL,
      deliveredUnits: sharedSinkDelivered.get(id) ?? 0,
    };
  }
  return out;
}

if (typeof window !== "undefined") {
  const w = window as unknown as {
    __plantJobs?: () => string[];
    __plantSinks?: () => ReturnType<typeof getSharedPlantSinkDebug>;
  };
  w.__plantJobs = () => [...jobs.keys()];
  w.__plantSinks = getSharedPlantSinkDebug;
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
