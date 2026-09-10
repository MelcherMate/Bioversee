import {
  MBR_CHANNEL_CENTER_X,
  MBR_EFFLUENT_OPEN_X,
  MBR_EFFLUENT_PIPE_START,
  MBR_EFFLUENT_Y,
  MBR_INFLUENT_NOZZLE_TOP,
  MBR_INFLUENT_Y_TOP,
  MBR_INLET_PIPE_LEN,
} from "./constants";
import { PIPE_OD } from "../pressure-vessel/pipe-style";

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

/** Influent: vertical run from the open end down to the inner top wall. */
export const MBR_INLET_RUN = buildRun(
  [MBR_CHANNEL_CENTER_X - 8, MBR_INFLUENT_Y_TOP - 8],
  [
    [MBR_CHANNEL_CENTER_X, MBR_INFLUENT_Y_TOP],
    [MBR_CHANNEL_CENTER_X, MBR_INFLUENT_NOZZLE_TOP],
  ],
  16,
  MBR_INLET_PIPE_LEN + 16,
);

/** Effluent: horizontal run from the nozzle outer face to the open end. */
export const MBR_EFFLUENT_RUN = buildRun(
  [MBR_EFFLUENT_PIPE_START - 8, MBR_EFFLUENT_Y - PIPE_OD],
  [
    [MBR_EFFLUENT_PIPE_START, MBR_EFFLUENT_Y],
    [MBR_EFFLUENT_OPEN_X, MBR_EFFLUENT_Y],
  ],
  MBR_EFFLUENT_OPEN_X - MBR_EFFLUENT_PIPE_START + 16,
  PIPE_OD + 16,
);
