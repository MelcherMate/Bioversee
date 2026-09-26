/**
 * Bioreactor device config: working volume (data only) + optional equipment.
 * Vessel drawing always uses the fixed legacy capsule — volume does not resize it.
 */

export type VolumeUnit = "L" | "m3";

/** Fixed visual capsule (pre-parametric drawing). */
export const LEGACY_INNER_WIDTH_PX = 362;
export const LEGACY_INNER_HEIGHT_PX = 510;
export const LEGACY_OUTER_WIDTH_PX = 402;
export const LEGACY_OUTER_HEIGHT_PX = 550;
export const LEGACY_BORDER_PX = 20;
export const LEGACY_CHAMBER_RADIUS_PX = 169;
export const LEGACY_WATER_RADIUS_PX = 149;

/** Physical stand-ins for layout math (drawing uses legacy pixels 1:1). */
export const DEFAULT_DIAMETER_M = 0.5;
export const DEFAULT_HEIGHT_M =
  DEFAULT_DIAMETER_M * (LEGACY_INNER_HEIGHT_PX / LEGACY_INNER_WIDTH_PX);

export type BioreactorEquipment = {
  thermal_jacket: boolean;
  stirrer: boolean;
  aerator: boolean;
  dosing: boolean;
  outflow: boolean;
  sensor_temperature: boolean;
  sensor_ph: boolean;
  sensor_pressure: boolean;
};

export type BioreactorConfig = {
  /** Working volume in m³; null = unset (UI shows placeholder). */
  volume_m3: number | null;
  volume_unit: VolumeUnit;
  equipment: BioreactorEquipment;
};

/** @deprecated Prefer BioreactorConfig — kept for layout callers that only need H/D. */
export type BioreactorGeometry = {
  height_m: number;
  diameter_m: number;
  volume_m3: number;
  volume_unit: VolumeUnit;
};

export type GeometryEditedField = "height_m" | "diameter_m" | "volume_m3";

export const EQUIPMENT_OPTIONS: {
  key: keyof BioreactorEquipment;
  labelKey: string;
  hintKey: string;
}[] = [
  {
    key: "thermal_jacket",
    labelKey: "equipment.thermalJacket",
    hintKey: "equipment.thermalJacketHint",
  },
  {
    key: "stirrer",
    labelKey: "equipment.stirrer",
    hintKey: "equipment.stirrerHint",
  },
  {
    key: "aerator",
    labelKey: "equipment.aerator",
    hintKey: "equipment.aeratorHint",
  },
  {
    key: "dosing",
    labelKey: "equipment.dosing",
    hintKey: "equipment.dosingHint",
  },
  {
    key: "outflow",
    labelKey: "equipment.outflow",
    hintKey: "equipment.outflowHint",
  },
  {
    key: "sensor_temperature",
    labelKey: "equipment.sensorTemperature",
    hintKey: "equipment.sensorTemperatureHint",
  },
  {
    key: "sensor_ph",
    labelKey: "equipment.sensorPh",
    hintKey: "equipment.sensorPhHint",
  },
  {
    key: "sensor_pressure",
    labelKey: "equipment.sensorPressure",
    hintKey: "equipment.sensorPressureHint",
  },
];

export function defaultEquipment(): BioreactorEquipment {
  return {
    thermal_jacket: true,
    stirrer: true,
    aerator: true,
    dosing: true,
    outflow: true,
    sensor_temperature: true,
    sensor_ph: true,
    sensor_pressure: true,
  };
}

export function litersFromM3(m3: number): number {
  return m3 * 1000;
}

export function m3FromLiters(L: number): number {
  return L / 1000;
}

export function formatVolume(m3: number, unit: VolumeUnit): number {
  return unit === "L" ? litersFromM3(m3) : m3;
}

export function parseVolumeInput(value: number, unit: VolumeUnit): number {
  return unit === "L" ? m3FromLiters(value) : value;
}

/** Drawing geometry is always the fixed default capsule. */
export function defaultBioreactorGeometry(): BioreactorGeometry {
  return {
    height_m: DEFAULT_HEIGHT_M,
    diameter_m: DEFAULT_DIAMETER_M,
    volume_m3: 0,
    volume_unit: "L",
  };
}

export function defaultBioreactorConfig(): BioreactorConfig {
  return {
    volume_m3: null,
    volume_unit: "L",
    equipment: defaultEquipment(),
  };
}

function asBool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function parseBioreactorConfig(raw: unknown): BioreactorConfig {
  const base = defaultBioreactorConfig();
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  const nested =
    o.bioreactor && typeof o.bioreactor === "object"
      ? (o.bioreactor as Record<string, unknown>)
      : o;

  const volume_unit: VolumeUnit =
    nested.volume_unit === "m3" || nested.volume_unit === "L"
      ? nested.volume_unit
      : base.volume_unit;

  let volume_m3: number | null = null;
  if (typeof nested.volume_m3 === "number" && Number.isFinite(nested.volume_m3)) {
    volume_m3 = Math.max(0, nested.volume_m3);
  }

  const eqRaw =
    nested.equipment && typeof nested.equipment === "object"
      ? (nested.equipment as Record<string, unknown>)
      : {};

  const equipment: BioreactorEquipment = {
    thermal_jacket: asBool(eqRaw.thermal_jacket, true),
    stirrer: asBool(eqRaw.stirrer, true),
    aerator: asBool(eqRaw.aerator, true),
    dosing: asBool(eqRaw.dosing, true),
    outflow: asBool(eqRaw.outflow, true),
    sensor_temperature: asBool(eqRaw.sensor_temperature, true),
    sensor_ph: asBool(eqRaw.sensor_ph, true),
    sensor_pressure: asBool(eqRaw.sensor_pressure, true),
  };

  return { volume_m3, volume_unit, equipment };
}

/** @deprecated Use parseBioreactorConfig — drawing always uses default capsule. */
export function parseBioreactorGeometry(raw: unknown): BioreactorGeometry {
  const cfg = parseBioreactorConfig(raw);
  return {
    ...defaultBioreactorGeometry(),
    volume_m3: cfg.volume_m3 ?? 0,
    volume_unit: cfg.volume_unit,
  };
}

export function toBioreactorConfigPatch(
  config: BioreactorConfig,
): { bioreactor: BioreactorConfig } {
  return { bioreactor: config };
}

/** @deprecated Volume no longer resizes the vessel. */
export function normalizeGeometry(
  input: BioreactorGeometry,
  _edited: GeometryEditedField,
): BioreactorGeometry {
  return {
    ...defaultBioreactorGeometry(),
    volume_m3: Math.max(0, input.volume_m3),
    volume_unit: input.volume_unit,
  };
}

export function isDefaultVesselShape(_geometry: BioreactorGeometry): boolean {
  return true;
}
