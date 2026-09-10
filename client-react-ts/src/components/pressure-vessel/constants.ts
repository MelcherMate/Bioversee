
export const VESSEL_MAX_FILL_UNITS = 426;
/** Vessel interior height in scene pixels (matches composite height). */
export const VESSEL_COMPOSITE_HEIGHT = 430;
/** Drain speed while the drain button is held (units per second). */
export const VESSEL_FILL_DRAIN_RATE = 60;
/** Fill speed while water transfers into the tank (units per second). */
export const VESSEL_FILL_RATE = 32;
/** Time for the falling column to reach the water surface (seconds). */
export const INLET_FALL_DURATION = 0.45;
export const INLET_PIPE_WATER_SPEED = VESSEL_COMPOSITE_HEIGHT / INLET_FALL_DURATION;
/** Time for the drain column to reach the nozzle (seconds). */
export const DRAIN_RISE_DURATION = 0.45;
/** Pipe travel speed — matches inlet / drain column. */
export const DRAIN_PIPE_WATER_SPEED = VESSEL_COMPOSITE_HEIGHT / DRAIN_RISE_DURATION;
/** Pause after valve close before pipe water flows out (seconds). */
export const DRAIN_VALVE_CLOSE_DELAY = 0.22;
export const VESSEL_DISH_UNITS = 62;
export const VESSEL_CYL_UNITS = 302;
export const VESSEL_TOP_UNITS = 62;

export type VesselWaterHeights = {
  dish: number;
  cyl: number;
  top: number;
};

export function getVesselWaterHeights(fillUnits: number): VesselWaterHeights {
  const clamped = Math.min(VESSEL_MAX_FILL_UNITS, Math.max(0, fillUnits));

  return {
    dish: Math.min(100, (clamped / VESSEL_DISH_UNITS) * 100),
    cyl: Math.min(
      100,
      Math.max(0, ((clamped - VESSEL_DISH_UNITS) / VESSEL_CYL_UNITS) * 100),
    ),
    top: Math.min(
      100,
      Math.max(
        0,
        ((clamped - VESSEL_DISH_UNITS - VESSEL_CYL_UNITS) / VESSEL_TOP_UNITS) * 100,
      ),
    ),
  };
}

export function fillUnitsToPercent(fillUnits: number): number {
  return Math.round((fillUnits / VESSEL_MAX_FILL_UNITS) * 100);
}
