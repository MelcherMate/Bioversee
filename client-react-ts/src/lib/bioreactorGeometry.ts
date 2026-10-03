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

/** Named media presets — “custom” when the user edits values by hand. */
export type FluidPresetId =
  | "water"
  | "buffer"
  | "culture_broth"
  | "viscous"
  | "custom";

export type BioreactorFluid = {
  preset: FluidPresetId;
  /** Dynamic viscosity in centipoise (mPa·s). Water ≈ 1. */
  viscosity_cP: number;
  /** Density in kg/m³. Water ≈ 998. */
  density_kg_m3: number;
  /** Surface tension in mN/m. Water ≈ 72. */
  surface_tension_mN_m: number;
};

export type BioreactorConfig = {
  /** Working volume in m³; null = unset (UI shows placeholder). */
  volume_m3: number | null;
  volume_unit: VolumeUnit;
  equipment: BioreactorEquipment;
  fluid: BioreactorFluid;
};

export const FLUID_PRESET_OPTIONS: {
  id: Exclude<FluidPresetId, "custom">;
  labelKey: string;
}[] = [
  { id: "water", labelKey: "fluid.presetWater" },
  { id: "buffer", labelKey: "fluid.presetBuffer" },
  { id: "culture_broth", labelKey: "fluid.presetCultureBroth" },
  { id: "viscous", labelKey: "fluid.presetViscous" },
];

export const FLUID_PRESETS: Record<
  Exclude<FluidPresetId, "custom">,
  Omit<BioreactorFluid, "preset">
> = {
  water: { viscosity_cP: 1, density_kg_m3: 998, surface_tension_mN_m: 72 },
  buffer: { viscosity_cP: 1.1, density_kg_m3: 1010, surface_tension_mN_m: 70 },
  culture_broth: {
    viscosity_cP: 4,
    density_kg_m3: 1025,
    surface_tension_mN_m: 55,
  },
  viscous: { viscosity_cP: 80, density_kg_m3: 1100, surface_tension_mN_m: 45 },
};

export const FLUID_LIMITS = {
  viscosity_cP: { min: 0.3, max: 1000 },
  density_kg_m3: { min: 700, max: 2000 },
  surface_tension_mN_m: { min: 20, max: 100 },
} as const;

export function defaultFluid(): BioreactorFluid {
  return { preset: "water", ...FLUID_PRESETS.water };
}

export function fluidFromPreset(
  preset: Exclude<FluidPresetId, "custom">,
): BioreactorFluid {
  return { preset, ...FLUID_PRESETS[preset] };
}

function clampFluidNumber(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

export function parseBioreactorFluid(raw: unknown): BioreactorFluid {
  const base = defaultFluid();
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  const viscosity_cP = clampFluidNumber(
    o.viscosity_cP,
    FLUID_LIMITS.viscosity_cP.min,
    FLUID_LIMITS.viscosity_cP.max,
    base.viscosity_cP,
  );
  const density_kg_m3 = clampFluidNumber(
    o.density_kg_m3,
    FLUID_LIMITS.density_kg_m3.min,
    FLUID_LIMITS.density_kg_m3.max,
    base.density_kg_m3,
  );
  const surface_tension_mN_m = clampFluidNumber(
    o.surface_tension_mN_m,
    FLUID_LIMITS.surface_tension_mN_m.min,
    FLUID_LIMITS.surface_tension_mN_m.max,
    base.surface_tension_mN_m,
  );
  const presetRaw = o.preset;
  const preset: FluidPresetId =
    presetRaw === "water" ||
    presetRaw === "buffer" ||
    presetRaw === "culture_broth" ||
    presetRaw === "viscous" ||
    presetRaw === "custom"
      ? presetRaw
      : "custom";

  return { preset, viscosity_cP, density_kg_m3, surface_tension_mN_m };
}

/** Relative damping vs water for free-surface motion (1 = water). */
export function fluidWaveDamping(fluid: BioreactorFluid): number {
  return fluidMotionFactors(fluid).waveDamping;
}

/**
 * Motion scales for free-surface waves and bubble advection vs water (= 1).
 * Viscosity slows / damps; density adds buoyancy drive; surface tension
 * tunes ripple speed and bubble size.
 */
export type FluidMotionFactors = {
  waveDamping: number;
  waveSpeed: number;
  bubbleSpeed: number;
  bubbleWander: number;
  bubbleSize: number;
  bubbleFollow: number;
};

export function fluidMotionFactors(fluid: BioreactorFluid): FluidMotionFactors {
  const visc = Math.max(0.3, fluid.viscosity_cP);
  const dens = Math.max(700, fluid.density_kg_m3) / 998;
  const st = Math.max(20, fluid.surface_tension_mN_m) / 72;

  // Stokes-ish rise: ∝ buoyancy(ρ) / drag(μ)
  const bubbleSpeed = clampRange(
    Math.pow(dens, 0.55) / Math.pow(visc, 0.5),
    0.18,
    1.85,
  );
  const waveDamping = clampRange(
    Math.pow(visc, 0.45) * Math.pow(dens, 0.2),
    0.45,
    8,
  );
  // Capillary ripples faster with surface tension; viscosity slows them.
  const waveSpeed = clampRange(
    Math.pow(st, 0.35) / Math.pow(visc, 0.25),
    0.35,
    1.6,
  );
  const bubbleWander = clampRange(1 / Math.pow(visc, 0.35), 0.2, 1.4);
  // Higher ST → slightly larger stable bubbles; dense fluids a touch smaller.
  const bubbleSize = clampRange(
    Math.pow(st, 0.3) / Math.pow(dens, 0.15),
    0.55,
    1.55,
  );
  // Viscous fluids track the impeller field more sluggishly.
  const bubbleFollow = clampRange(1 / Math.pow(visc, 0.3), 0.35, 1.35);

  return {
    waveDamping,
    waveSpeed,
    bubbleSpeed,
    bubbleWander,
    bubbleSize,
    bubbleFollow,
  };
}

function clampRange(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

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
    fluid: defaultFluid(),
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

  const fluid = parseBioreactorFluid(nested.fluid);

  return { volume_m3, volume_unit, equipment, fluid };
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
