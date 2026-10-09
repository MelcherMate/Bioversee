import {
  fillUnitsToStoredPercent,
  VESSEL_FILL_DRAIN_RATE,
  VESSEL_FILL_RATE,
  VESSEL_MAX_FILL_UNITS,
} from "../components/pressure-vessel/constants";
import { insertSensorReading, insertSliderState } from "./actuators";

const WATER_LEVEL_KEY = "water_level";

export type LevelTransferKind = "fill" | "drain";

export type LevelTransferSnapshot = {
  deviceId: string;
  kind: LevelTransferKind;
  capacityL: number;
  startUnits: number;
  targetUnits: number;
  requestedLiters: number;
  currentUnits: number;
  done: boolean;
};

type Listener = (snap: LevelTransferSnapshot) => void;

type InternalJob = LevelTransferSnapshot & {
  userId: string;
  listeners: Set<Listener>;
  raf: number;
  lastTime: number;
  lastPersistAt: number;
  lastPersistPercent: number | null;
  onComplete?: (snap: LevelTransferSnapshot) => void;
};

const jobs = new Map<string, InternalJob>();

function clampFillUnits(value: number) {
  return Math.min(VESSEL_MAX_FILL_UNITS, Math.max(0, value));
}

function toSnapshot(job: InternalJob): LevelTransferSnapshot {
  return {
    deviceId: job.deviceId,
    kind: job.kind,
    capacityL: job.capacityL,
    startUnits: job.startUnits,
    targetUnits: job.targetUnits,
    requestedLiters: job.requestedLiters,
    currentUnits: job.currentUnits,
    done: job.done,
  };
}

function notify(job: InternalJob) {
  const snap = toSnapshot(job);
  for (const listener of job.listeners) listener(snap);
}

function persist(job: InternalJob, sensor: boolean) {
  const percent = fillUnitsToStoredPercent(job.currentUnits, job.capacityL);
  insertSliderState(job.deviceId, WATER_LEVEL_KEY, percent, job.userId).catch(
    console.error,
  );
  if (sensor) {
    insertSensorReading(
      job.deviceId,
      WATER_LEVEL_KEY,
      percent,
      job.userId,
    ).catch(console.error);
  }
  job.lastPersistPercent = percent;
  job.lastPersistAt = performance.now();
}

function maybeStreamPersist(job: InternalJob) {
  const now = performance.now();
  if (now - job.lastPersistAt < 280) return;
  const percent = fillUnitsToStoredPercent(job.currentUnits, job.capacityL);
  const minStep = job.capacityL > 0 ? (1 / job.capacityL) * 100 : 1;
  if (
    job.lastPersistPercent != null &&
    Math.abs(percent - job.lastPersistPercent) < minStep * 0.9
  ) {
    return;
  }
  persist(job, false);
}

function finish(job: InternalJob) {
  job.currentUnits = clampFillUnits(job.targetUnits);
  if (job.kind === "fill") {
    job.currentUnits = Math.min(job.currentUnits, VESSEL_MAX_FILL_UNITS);
  } else {
    job.currentUnits = Math.max(job.currentUnits, 0);
  }
  persist(job, true);
  job.done = true;
  const snap = toSnapshot(job);
  notify(job);
  job.onComplete?.(snap);
  if (job.raf) cancelAnimationFrame(job.raf);
  jobs.delete(job.deviceId);
}

function tick(job: InternalJob, now: number) {
  if (!jobs.has(job.deviceId)) return;

  if (!job.lastTime) job.lastTime = now;
  const dt = Math.min(0.05, (now - job.lastTime) / 1000);
  job.lastTime = now;

  const rate = job.kind === "fill" ? VESSEL_FILL_RATE : VESSEL_FILL_DRAIN_RATE;
  let next =
    job.kind === "fill"
      ? job.currentUnits + rate * dt
      : job.currentUnits - rate * dt;

  if (job.kind === "fill") next = Math.min(next, job.targetUnits);
  else next = Math.max(next, job.targetUnits);
  next = clampFillUnits(next);
  job.currentUnits = next;
  maybeStreamPersist(job);
  notify(job);

  const reached =
    job.kind === "fill"
      ? next >= job.targetUnits - 0.05 || next >= VESSEL_MAX_FILL_UNITS - 0.05
      : next <= job.targetUnits + 0.05 || next <= 0.05;

  if (reached) {
    finish(job);
    return;
  }

  job.raf = requestAnimationFrame((t) => tick(job, t));
}

export type StartLevelTransferInput = {
  deviceId: string;
  userId: string;
  kind: LevelTransferKind;
  capacityL: number;
  startUnits: number;
  targetUnits: number;
  requestedLiters: number;
  currentUnits: number;
  onComplete?: (snap: LevelTransferSnapshot) => void;
};

/** Begin or replace a background fill/drain for a device (survives UI navigation). */
export function startLevelTransfer(input: StartLevelTransferInput): void {
  const existing = jobs.get(input.deviceId);
  if (existing) {
    if (existing.raf) cancelAnimationFrame(existing.raf);
    jobs.delete(input.deviceId);
  }

  const job: InternalJob = {
    deviceId: input.deviceId,
    userId: input.userId,
    kind: input.kind,
    capacityL: input.capacityL,
    startUnits: input.startUnits,
    targetUnits: input.targetUnits,
    requestedLiters: input.requestedLiters,
    currentUnits: clampFillUnits(input.currentUnits),
    done: false,
    listeners: new Set(),
    raf: 0,
    lastTime: 0,
    lastPersistAt: 0,
    lastPersistPercent: null,
    onComplete: input.onComplete,
  };
  jobs.set(input.deviceId, job);
  // Immediate stream so other clients / return visits see movement.
  persist(job, false);
  job.raf = requestAnimationFrame((t) => tick(job, t));
}

export function getLevelTransfer(
  deviceId: string,
): LevelTransferSnapshot | null {
  const job = jobs.get(deviceId);
  return job ? toSnapshot(job) : null;
}

export function hasLevelTransfer(deviceId: string): boolean {
  return jobs.has(deviceId);
}

export function subscribeLevelTransfer(
  deviceId: string,
  listener: Listener,
): () => void {
  const job = jobs.get(deviceId);
  if (!job) return () => {};
  job.listeners.add(listener);
  listener(toSnapshot(job));
  return () => {
    job.listeners.delete(listener);
  };
}
