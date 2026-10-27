import {
  FILL_PIPE_OD,
  OUTFLOW_PIPE_OD,
} from "../components/Canvas/bioreactorLayout";

export type PipeFittingKind =
  | "cross"
  | "wye_split"
  | "wye_merge"
  | "reducer";

export type PipeBore = "wide" | "thin";

export type PipeFittingRotation = 0 | 90 | 180 | 270;

export type PipeFittingConfig = {
  kind: PipeFittingKind;
  /** Bore for cross / wye. Reducer always spans wide↔thin. */
  bore?: PipeBore;
  rotation: PipeFittingRotation;
};

/** Kinds shown after the user picks Wide or Thin in the library. */
export type PipeFittingTileKind = "cross" | "wye_split" | "wye_merge" | "reducer";

export type PipeFittingCatalogItem = {
  kind: PipeFittingTileKind;
  /** When false, the tile ignores the Wide/Thin sublist (reducer). */
  usesBore: boolean;
  labelKey: string;
  hintKey: string;
  nameKey: string;
};

export const PIPE_FITTING_TILES: PipeFittingCatalogItem[] = [
  {
    kind: "cross",
    usesBore: true,
    labelKey: "piping.cross",
    hintKey: "piping.crossHint",
    nameKey: "piping.nameCross",
  },
  {
    kind: "wye_split",
    usesBore: true,
    labelKey: "piping.wyeSplit",
    hintKey: "piping.wyeSplitHint",
    nameKey: "piping.nameWyeSplit",
  },
  {
    kind: "wye_merge",
    usesBore: true,
    labelKey: "piping.wyeMerge",
    hintKey: "piping.wyeMergeHint",
    nameKey: "piping.nameWyeMerge",
  },
  {
    kind: "reducer",
    usesBore: false,
    labelKey: "piping.reducer",
    hintKey: "piping.reducerHint",
    nameKey: "piping.nameReducer",
  },
];

export function defaultPipeFittingConfig(
  kind: PipeFittingTileKind,
  bore: PipeBore
): PipeFittingConfig {
  if (kind === "reducer") {
    return { kind: "reducer", rotation: 0 };
  }
  return { kind, bore, rotation: 0 };
}

export function parsePipeFittingConfig(
  raw: Record<string, unknown> | null | undefined
): PipeFittingConfig {
  const kind = raw?.kind;
  const validKind =
    kind === "cross" ||
    kind === "wye_split" ||
    kind === "wye_merge" ||
    kind === "reducer"
      ? kind
      : "cross";
  const bore = raw?.bore === "wide" || raw?.bore === "thin" ? raw.bore : "thin";
  const rotationRaw = Number(raw?.rotation);
  const rotation: PipeFittingRotation =
    rotationRaw === 90 || rotationRaw === 180 || rotationRaw === 270
      ? rotationRaw
      : 0;
  return {
    kind: validKind,
    ...(validKind === "reducer" ? {} : { bore }),
    rotation,
  };
}

export function boreOd(bore: PipeBore | undefined): number {
  return bore === "wide" ? OUTFLOW_PIPE_OD : FILL_PIPE_OD;
}

/** Outside diameter for a fitting handle, drawing px (pre-scale). */
export function fittingHandleOd(
  config: PipeFittingConfig,
  handleId: string | null | undefined
): number {
  if (config.kind === "reducer") {
    if (handleId === "wide") return OUTFLOW_PIPE_OD;
    if (handleId === "thin") return FILL_PIPE_OD;
    return OUTFLOW_PIPE_OD;
  }
  return boreOd(config.bore);
}

export function nextFittingRotation(
  current: PipeFittingRotation
): PipeFittingRotation {
  return ((current + 90) % 360) as PipeFittingRotation;
}

/** Authoring size of a fitting drawing (matches PipeFittingNode). */
export const FITTING_DRAW_SIZE = 160;
const FITTING_CX = FITTING_DRAW_SIZE / 2;
const FITTING_CY = FITTING_DRAW_SIZE / 2;
const FITTING_ARM = FITTING_DRAW_SIZE / 2;

type FittingPortPoint = { id: string; x: number; y: number };

function rotateFittingPoint(
  x: number,
  y: number,
  rotation: PipeFittingRotation
): { x: number; y: number } {
  const dx = x - FITTING_CX;
  const dy = y - FITTING_CY;
  switch (rotation) {
    case 90:
      return { x: FITTING_CX - dy, y: FITTING_CY + dx };
    case 180:
      return { x: FITTING_CX - dx, y: FITTING_CY - dy };
    case 270:
      return { x: FITTING_CX + dy, y: FITTING_CY - dx };
    default:
      return { x, y };
  }
}

/** Unrotated handle seats for a fitting kind (drawing px). */
function fittingPortSeats(config: PipeFittingConfig): FittingPortPoint[] {
  const leg = FITTING_ARM * 0.55;
  switch (config.kind) {
    case "cross":
      return [
        { id: "n", x: FITTING_CX, y: FITTING_CY - FITTING_ARM },
        { id: "s", x: FITTING_CX, y: FITTING_CY + FITTING_ARM },
        { id: "e", x: FITTING_CX + FITTING_ARM, y: FITTING_CY },
        { id: "w", x: FITTING_CX - FITTING_ARM, y: FITTING_CY },
      ];
    case "wye_split":
      return [
        { id: "stem", x: FITTING_CX, y: FITTING_CY - FITTING_ARM },
        { id: "left", x: FITTING_CX - leg, y: FITTING_CY + FITTING_ARM },
        { id: "right", x: FITTING_CX + leg, y: FITTING_CY + FITTING_ARM },
      ];
    case "wye_merge":
      return [
        { id: "left", x: FITTING_CX - leg, y: FITTING_CY - FITTING_ARM },
        { id: "right", x: FITTING_CX + leg, y: FITTING_CY - FITTING_ARM },
        { id: "stem", x: FITTING_CX, y: FITTING_CY + FITTING_ARM },
      ];
    case "reducer":
      return [
        { id: "wide", x: FITTING_CX - FITTING_ARM, y: FITTING_CY },
        { id: "thin", x: FITTING_CX + FITTING_ARM, y: FITTING_CY },
      ];
  }
}

/** Handle seat in drawing px after rotation (node-local before FITTING_SCALE). */
export function fittingHandlePoint(
  config: PipeFittingConfig,
  handleId: string
): { x: number; y: number } | null {
  const seat = fittingPortSeats(config).find((p) => p.id === handleId);
  if (!seat) return null;
  return rotateFittingPoint(seat.x, seat.y, config.rotation);
}

/** Unit outward leave-direction from a fitting handle (after rotation). */
export function fittingHandleOutward(
  config: PipeFittingConfig,
  handleId: string
): { dx: number; dy: number } {
  const point = fittingHandlePoint(config, handleId);
  if (!point) return { dx: 0, dy: 1 };
  const dx = point.x - FITTING_CX;
  const dy = point.y - FITTING_CY;
  const len = Math.hypot(dx, dy) || 1;
  return { dx: dx / len, dy: dy / len };
}

export function isPipeFittingDeviceType(
  type: string
): type is "pipe_fitting" {
  return type === "pipe_fitting";
}

export function fittingDisplayNameKey(config: PipeFittingConfig): string {
  switch (config.kind) {
    case "cross":
      return "piping.nameCross";
    case "wye_split":
      return "piping.nameWyeSplit";
    case "wye_merge":
      return "piping.nameWyeMerge";
    case "reducer":
      return "piping.nameReducer";
  }
}
