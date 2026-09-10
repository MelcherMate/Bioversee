import { PIPE_OD } from "./pipe-style";

const R = PIPE_OD / 2;
/** Room around the centerline for stroke half-width, round caps, and drop shadow. */
const PAD = 16;

type Point = [x: number, y: number];

type RunGeometry = {
  svgLeft: number;
  svgTop: number;
  viewW: number;
  viewH: number;
  centerline: string;
};

function buildRun(
  origin: Point,
  points: Point[],
  nominalW: number,
  nominalH: number,
): RunGeometry {
  const toLocal = ([x, y]: Point): Point => [x - origin[0] + PAD, y - origin[1] + PAD];
  const centerline = points
    .map((p, i) => {
      const [x, y] = toLocal(p);
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");

  return {
    svgLeft: origin[0] - PAD,
    svgTop: origin[1] - PAD,
    viewW: nominalW + PAD * 2,
    viewH: nominalH + PAD * 2,
    centerline,
  };
}

/** Inlet centerline segment lengths (scene units). */
export const INLET_HORIZONTAL_LENGTH = 181;
export const INLET_VERTICAL_LENGTH = 42;
export const INLET_PATH_LENGTH = INLET_HORIZONTAL_LENGTH + INLET_VERTICAL_LENGTH;

/** Inlet: open square end on the left; vessel end runs into the nozzle. */
export const INLET_RUN = buildRun(
  [74, -22],
  [
    [74 + R, -14],
    [263, -14],
    [263, 28],
  ],
  197,
  52,
);

/** Drain: open square end on the right; vessel end runs into the nozzle. */
export const DRAIN_VERTICAL_LENGTH = 24;
export const DRAIN_HORIZONTAL_LENGTH = 180;
export const DRAIN_PIPE_PATH_LENGTH = DRAIN_VERTICAL_LENGTH + DRAIN_HORIZONTAL_LENGTH;

export const DRAIN_RUN = buildRun(
  [308, 484],
  [
    [316, 476],
    [316, 500],
    [504 - R, 500],
  ],
  196,
  24,
);

export { R as PIPE_RADIUS };
