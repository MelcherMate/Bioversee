import { VESSEL_MAX_FILL_UNITS } from "../pressure-vessel/constants";

export {
  VESSEL_MAX_FILL_UNITS as MBR_MAX_FILL_UNITS,
  VESSEL_FILL_RATE as MBR_INFLOW_RATE,
  VESSEL_FILL_DRAIN_RATE as MBR_OUTFLOW_RATE,
} from "../pressure-vessel/constants";

/** Resting water level for the membrane separation tank. */
export const MBR_FIXED_FILL_RATIO = 0.95;

export function mbrFixedFillUnits() {
  return Math.round(VESSEL_MAX_FILL_UNITS * MBR_FIXED_FILL_RATIO);
}

/** Scene canvas (matches the drawing container). */
export const MBR_SCENE_WIDTH = 640;
export const MBR_SCENE_HEIGHT = 556;

/** Membrane separation tank shell (scene pixels). */
export const MBR_TANK_LEFT = 236;
export const MBR_TANK_TOP = 104;
export const MBR_TANK_WIDTH = 320;
export const MBR_TANK_HEIGHT = 356;
export const MBR_WALL = 10;

export const MBR_TANK_RIGHT = MBR_TANK_LEFT + MBR_TANK_WIDTH;
export const MBR_TANK_BOTTOM = MBR_TANK_TOP + MBR_TANK_HEIGHT;

/** Interior cavity (inside the walls) where water and modules live. */
export const MBR_INNER_LEFT = MBR_TANK_LEFT + MBR_WALL;
export const MBR_INNER_TOP = MBR_TANK_TOP + MBR_WALL;
export const MBR_INNER_WIDTH = MBR_TANK_WIDTH - MBR_WALL * 2;
export const MBR_INNER_HEIGHT = MBR_TANK_HEIGHT - MBR_WALL * 2;

/**
 * Baffle wall: separates a narrow influent/settling channel on the left from
 * the membrane compartment. Flow drops down the channel, passes under the wall
 * (bottom gap), then rises through the membrane zone.
 */
export const MBR_BAFFLE_CHANNEL = 48;
export const MBR_BAFFLE_THICKNESS = 8;
export const MBR_BAFFLE_BOTTOM_GAP = 48;
export const MBR_BAFFLE_X = MBR_INNER_LEFT + MBR_BAFFLE_CHANNEL;

/** Center of the influent/settling channel. */
export const MBR_CHANNEL_CENTER_X = MBR_INNER_LEFT + MBR_BAFFLE_CHANNEL / 2;

/** Left edge of the membrane compartment (right of the baffle). */
export const MBR_COMPARTMENT_LEFT = MBR_BAFFLE_X + MBR_BAFFLE_THICKNESS;
export const MBR_COMPARTMENT_RIGHT = MBR_INNER_LEFT + MBR_INNER_WIDTH;

/** Membrane zone within the composite (pixels from composite left). */
export const MBR_MEMBRANE_ZONE_LEFT = MBR_BAFFLE_CHANNEL + MBR_BAFFLE_THICKNESS;
export const MBR_SETTLING_CHANNEL_WIDTH = MBR_BAFFLE_CHANNEL;

/** Matches `.mbr-membrane-water-surface { top: -16px }` in MbrDrawing. */
export const MBR_MEMBRANE_WAVE_ZONE_TOP = -16;

/** Vertical membrane cassettes submerged in the membrane compartment. */
export const MBR_MODULE_COUNT = 5;
export const MBR_MODULE_WIDTH = 34;
export const MBR_MODULE_HEIGHT = 210;
/** Module top sits below the water surface headroom. */
export const MBR_MODULE_TOP = MBR_INNER_TOP + 44;

/** Horizontal center of module `index` within the membrane compartment. */
export function mbrModuleCenterX(index: number) {
  const pad = 26;
  const usableWidth = MBR_COMPARTMENT_RIGHT - MBR_COMPARTMENT_LEFT - pad * 2;
  const step = usableWidth / (MBR_MODULE_COUNT - 1);
  return MBR_COMPARTMENT_LEFT + pad + index * step;
}

/** Pipe / nozzle layout (scene pixels) — proportions match pressure-vessel fittings. */
export const MBR_NOZZLE_CROSS = 14;
export const MBR_NOZZLE_STUB = 26;
export const MBR_INNER_RIGHT = MBR_TANK_RIGHT - MBR_WALL;
export const MBR_INFLUENT_Y_TOP = 34;
export const MBR_EFFLUENT_Y = MBR_TANK_TOP + 44;
export const MBR_INFLUENT_NOZZLE_TOP = MBR_INNER_TOP - MBR_NOZZLE_CROSS;
export const MBR_EFFLUENT_OPEN_X = 632;
export const MBR_EFFLUENT_PIPE_START = MBR_INNER_RIGHT + MBR_NOZZLE_CROSS;

/** Unified flow path segment lengths (inlet pipe → fall → effluent pipe). */
export const MBR_INLET_PIPE_LEN = MBR_INFLUENT_NOZZLE_TOP - MBR_INFLUENT_Y_TOP;
export const MBR_INLET_FALL_LEN = MBR_INNER_HEIGHT * (1 - MBR_FIXED_FILL_RATIO);
export const MBR_EFFLUENT_PIPE_LEN = MBR_EFFLUENT_OPEN_X - MBR_EFFLUENT_PIPE_START;
export const MBR_FLOW_PATH_LEN = MBR_INLET_PIPE_LEN + MBR_INLET_FALL_LEN + MBR_EFFLUENT_PIPE_LEN;

export { DRAIN_VALVE_CLOSE_DELAY as MBR_VALVE_CLOSE_DELAY } from "../pressure-vessel/constants";

/** Bottom aerator geometry (composite-local pixels, matches `.mbr-diffuser`). */
export const MBR_DIFFUSER_LEFT = MBR_BAFFLE_CHANNEL + MBR_BAFFLE_THICKNESS;
export const MBR_DIFFUSER_RIGHT_INSET = 12;
export const MBR_DIFFUSER_BOTTOM_OFFSET = 14;
export const MBR_DIFFUSER_HEIGHT = 8;
export const MBR_DIFFUSER_BORDER_WIDTH = 1.5;
/** Bubbles emit from the top edge of the aerator bar. */
export const MBR_DIFFUSER_EMITTER_BOTTOM =
  MBR_DIFFUSER_BOTTOM_OFFSET + MBR_DIFFUSER_HEIGHT + MBR_DIFFUSER_BORDER_WIDTH * 2;

/** Aeration intensity steps shown in the control panel. */
export const MBR_AERATION_LEVELS = [25, 50, 75, 100] as const;
export type MbrAerationLevel = (typeof MBR_AERATION_LEVELS)[number];
export const MBR_DEFAULT_AERATION_LEVEL: MbrAerationLevel = 50;

export function mbrBubbleCount(level: MbrAerationLevel): number {
  switch (level) {
    case 25:
      return 9;
    case 50:
      return 27;
    case 75:
      return 81;
    case 100:
      return 243;
  }
}

export function mbrBubbleRiseRatio(level: MbrAerationLevel): number {
  return level / 100;
}

/** Same velocity scale as pressure-vessel fill/drain waves (40 = fully wavy). */
export function mbrAerationWaveVelocity(isOn: boolean, level: MbrAerationLevel): number {
  if (!isOn) return 0;
  return (level / 100) * 40;
}

export type MbrBubblePreset = {
  left: string;
  bottom: string;
  size: number;
  delay: number;
  duration: number;
};

/** Evenly spaced bubble origins along the aerator width (0–100% of emitter). */
export function mbrBubblesForCount(count: number): MbrBubblePreset[] {
  if (count <= 0) return [];

  return Array.from({ length: count }, (_, index) => {
    const t = count <= 1 ? 0.5 : index / (count - 1);
    const size = 3 + (index % 4);
    const delay = Number(((index * 0.37) % 2.8).toFixed(2));
    const duration = Number((2.9 + ((index * 0.19) % 1.4)).toFixed(2));

    return {
      left: `${(t * 100).toFixed(2)}%`,
      bottom: "0",
      size,
      delay,
      duration,
    };
  });
}
