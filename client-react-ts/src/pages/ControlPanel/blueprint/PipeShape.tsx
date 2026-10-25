import { useId } from "react";
import type { XYPosition } from "@xyflow/react";
import { PIPE_FILL, PIPE_METAL } from "../../../components/pressure-vessel/pipe-style";
import type { PipeRoute } from "./pipeRoute";

/** Fitting sizes in drawing px, the units of the reactor pipes before `scale`. */
const FLANGE_THICK = 7;
const FLANGE_OVERHANG = 5;
const COLLAR_THICK = 4;
const COLLAR_OVERHANG = 2;
const REDUCER_LENGTH = 40;

type PipeShapeProps = {
  route: PipeRoute;
  /** Bore at each end, drawing px. */
  sourceOd: number;
  targetOd: number;
  /** Drawing px → canvas units. */
  scale: number;
  /** Joined ends get a flange; a drag preview's loose end has none. */
  sourceJoint?: boolean;
  targetJoint?: boolean;
  selected?: boolean;
  className?: string;
};

function towards(from: XYPosition, to: XYPosition): XYPosition {
  const length = Math.hypot(to.x - from.x, to.y - from.y) || 1;
  return { x: (to.x - from.x) / length, y: (to.y - from.y) / length };
}

function along(point: XYPosition, dir: XYPosition, distance: number): XYPosition {
  return { x: point.x + dir.x * distance, y: point.y + dir.y * distance };
}

function polyline(points: XYPosition[]): string {
  return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
}

/** Concentric reducer outline from the `wide` end centre to the `narrow` one. */
function cone(
  wide: XYPosition,
  narrow: XYPosition,
  wideHalf: number,
  narrowHalf: number
): string {
  const dir = towards(wide, narrow);
  const normal = { x: -dir.y, y: dir.x };
  return [
    along(wide, normal, wideHalf),
    along(narrow, normal, narrowHalf),
    along(narrow, normal, -narrowHalf),
    along(wide, normal, -wideHalf),
  ]
    .map((p) => `${p.x},${p.y}`)
    .join(" ");
}

/** Flange + collar on a joint, reaching from `at` along `dir`, like the vessel nozzles. */
function JointFlange({
  at,
  dir,
  od,
  scale,
}: {
  at: XYPosition;
  dir: XYPosition;
  od: number;
  scale: number;
}) {
  const plate = (thick: number, overhang: number, inset: number) => {
    const half = (od / 2 + overhang) * scale;
    const a = along(at, dir, inset * scale);
    const b = along(at, dir, (inset + thick) * scale);
    return Math.abs(dir.x) > Math.abs(dir.y)
      ? { x: Math.min(a.x, b.x), y: at.y - half, width: thick * scale, height: half * 2 }
      : { x: at.x - half, y: Math.min(a.y, b.y), width: half * 2, height: thick * scale };
  };
  return (
    <>
      <rect
        {...plate(FLANGE_THICK, FLANGE_OVERHANG, 0)}
        rx={1.5 * scale}
        fill={PIPE_FILL}
        stroke={PIPE_METAL.stroke}
        strokeWidth={1.5 * scale}
      />
      <rect
        {...plate(COLLAR_THICK, COLLAR_OVERHANG, (FLANGE_THICK - COLLAR_THICK) / 2)}
        rx={scale}
        fill={PIPE_METAL.mid}
        stroke={PIPE_METAL.stroke}
        strokeWidth={scale}
      />
    </>
  );
}

/**
 * A plant pipe drawn like the reactor pipes. Ends with different bores get a
 * concentric reducer on the run into the target end.
 */
export default function PipeShape({
  route,
  sourceOd,
  targetOd,
  scale,
  sourceJoint = true,
  targetJoint = true,
  selected = false,
  className,
}: PipeShapeProps) {
  const filterId = `bp-pipe-${useId().replace(/:/g, "")}`;
  const { points } = route;
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const beforeLast = points[points.length - 2] ?? first;
  const outDir = towards(first, points[1] ?? last);
  const inDir = towards(beforeLast, last);
  const backDir = { x: -inDir.x, y: -inDir.y };

  const lastRun = Math.hypot(last.x - beforeLast.x, last.y - beforeLast.y);
  const flangeLength = targetJoint ? FLANGE_THICK * scale : 0;
  const reducerLength =
    sourceOd === targetOd
      ? 0
      : Math.max(0, Math.min(REDUCER_LENGTH * scale, lastRun - flangeLength - 2 * scale));
  const reducer =
    reducerLength > 0
      ? {
          wide: along(last, backDir, flangeLength + reducerLength),
          narrow: along(last, backDir, flangeLength),
        }
      : null;

  // Overlap the reactor pipe end and the reducer slightly so no seam shows.
  const body = polyline([
    along(first, outDir, -0.5 * scale),
    ...points.slice(1, -1),
    reducer ? along(reducer.wide, inDir, 0.5 * scale) : last,
  ]);

  const pad = (Math.max(sourceOd, targetOd) / 2 + FLANGE_OVERHANG + 8) * scale;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs) - pad;
  const minY = Math.min(...ys) - pad;

  return (
    <g className={["bp-pipe", selected ? "is-selected" : "", className].filter(Boolean).join(" ")}>
      <defs>
        {/* User-space region: a straight run has a zero-height bounding box. */}
        <filter
          id={filterId}
          filterUnits="userSpaceOnUse"
          x={minX}
          y={minY}
          width={Math.max(...xs) + pad - minX}
          height={Math.max(...ys) + pad - minY}
        >
          <feDropShadow
            dx={scale}
            dy={2 * scale}
            stdDeviation={1.1 * scale}
            floodColor="#000"
            floodOpacity="0.18"
          />
        </filter>
      </defs>
      {selected ? (
        <path
          className="bp-pipe__halo"
          d={route.path}
          strokeWidth={(Math.max(sourceOd, targetOd) + 22) * scale}
        />
      ) : null}
      <g filter={`url(#${filterId})`}>
        <path
          d={body}
          fill="none"
          stroke={PIPE_METAL.stroke}
          strokeWidth={(sourceOd + 2) * scale}
          strokeLinecap="butt"
          strokeLinejoin="round"
        />
        {reducer ? (
          <polygon
            points={cone(
              reducer.wide,
              reducer.narrow,
              (sourceOd / 2 + 1) * scale,
              (targetOd / 2 + 1) * scale
            )}
            fill={PIPE_METAL.stroke}
          />
        ) : null}
        <path
          d={body}
          fill="none"
          stroke={PIPE_FILL}
          strokeWidth={sourceOd * scale}
          strokeLinecap="butt"
          strokeLinejoin="round"
        />
        {reducer ? (
          <polygon
            points={cone(reducer.wide, reducer.narrow, (sourceOd / 2) * scale, (targetOd / 2) * scale)}
            fill={PIPE_FILL}
          />
        ) : null}
        {sourceJoint ? <JointFlange at={first} dir={outDir} od={sourceOd} scale={scale} /> : null}
        {targetJoint ? <JointFlange at={last} dir={backDir} od={targetOd} scale={scale} /> : null}
      </g>
    </g>
  );
}
