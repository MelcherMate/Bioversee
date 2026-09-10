import { fillUnitsToPercent } from "./constants";

/** Apple Watch Depth app palette. */
export const APPLE_DEPTH_COLORS = {
  cyan: "#41E0E0",
  blue: "#279ED5",
} as const;

export const APPLE_TICK_COUNT = 61;

export function fillUnitsToDepthLabel(fillUnits: number): string {
  return `${fillUnitsToPercent(fillUnits)}%`;
}
