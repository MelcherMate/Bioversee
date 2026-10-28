import { useId } from "react";
import type { XYPosition } from "@xyflow/react";
import { waterWidthForOd } from "../../../components/Canvas/bioreactorLayout";
import { APPLE_DEPTH_COLORS } from "../../../components/pressure-vessel/apple-depth-style";
import { PIPE_FILL, PIPE_METAL } from "../../../components/pressure-vessel/pipe-style";
import type { PipeRoute } from "./pipeRoute";

function polyLength(pts: XYPosition[]): number {
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    total += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return total;
}

/** Fitting sizes in drawing px, the units of the reactor pipes before `scale`. */
const FLANGE_THICK = 7;
const FLANGE_OVERHANG = 5;
const COLLAR_THICK = 4;
const COLLAR_OVERHANG = 2;
/** Short collar at the tip — long mid-run cones looked wrong into fittings. */
const REDUCER_LENGTH = 16;

export type PipeFlowVisual = {
  /** Leading edge 0..1 along the flow direction. */
  progress01: number;
  /** Trailing edge 0..1 — water occupies [tail01, progress01]. */
  tail01?: number;
  /** Stroke width in drawing px (pre-scale); defaults to sourceOd. */
  od?: number;
  /**
   * How full the bore runs relative to a single-stream capacity (1 = nominal,
   * 2 = two drains merged). Grows the water stroke toward the pipe walls.
   */
  rateFill01?: number;
  /** When false, water enters at the target end (path is drawn reversed). */
  alongSource?: boolean;
  /** Last edge into a reactor inlet — blend outlet blue → inlet cyan. */
  blendToInlet?: boolean;
};

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
  /** Live water moving through this plant pipe. */
  flow?: PipeFlowVisual | null;
};

/** Plant pipe water — outlet blue; inlet approach blends to cyan. */
const PIPE_WATER_OUTLET = APPLE_DEPTH_COLORS.blue;
const PIPE_WATER_INLET = APPLE_DEPTH_COLORS.cyan;

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
  flow = null,
}: PipeShapeProps) {
  const filterId = `bp-pipe-${useId().replace(/:/g, "")}`;
  const { points, path, length } = route;
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const beforeLast = points[points.length - 2] ?? first;
  const outDir = towards(first, points[1] ?? last);
  const inDir = towards(beforeLast, last);
  const backDir = { x: -inDir.x, y: -inDir.y };

  const lastRun = Math.hypot(last.x - beforeLast.x, last.y - beforeLast.y);
  // Reach past the tip into the unit's painted nozzle so plant + unit meet flush.
  // Bury a bit deeper into the thinner fitting ports so the OD step sits inside.
  const tipOverlap = Math.max(
    3 * scale,
    0.45 * Math.min(sourceOd, targetOd) * scale,
    sourceOd !== targetOd ? 0.35 * Math.max(sourceOd, targetOd) * scale : 0
  );
  const flangeLength = targetJoint ? FLANGE_THICK * scale : 0;
  const reducerLength =
    sourceOd === targetOd
      ? 0
      : Math.max(
          0,
          Math.min(REDUCER_LENGTH * scale, lastRun - flangeLength - tipOverlap - 2 * scale)
        );
  // Cone ends at the tip; a short target-OD stub continues into the nozzle.
  const reducer =
    reducerLength > 0
      ? {
          wide: along(last, backDir, flangeLength + reducerLength),
          narrow: along(last, backDir, flangeLength),
        }
      : null;
  const tipStubEnd = along(last, inDir, tipOverlap);
  const tipStub =
    reducer && flangeLength === 0
      ? polyline([reducer.narrow, tipStubEnd])
      : null;
  const body = polyline([
    along(first, outDir, -tipOverlap),
    ...points.slice(1, -1),
    reducer
      ? along(reducer.wide, inDir, 0.5 * scale)
      : tipStubEnd,
  ]);

  const pad = (Math.max(sourceOd, targetOd) / 2 + FLANGE_OVERHANG + 8) * scale;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs) - pad;
  const minY = Math.min(...ys) - pad;

  const flowAlongSource = flow?.alongSource !== false;
  const flowHead = Math.min(1, Math.max(0, flow?.progress01 ?? 0));
  const flowTail = Math.min(flowHead, Math.max(0, flow?.tail01 ?? 0));
  const flowSpan = flowHead - flowTail;
  const showFlow = Boolean(flow && flowSpan > 0.01 && length > 0);

  // Same fill ratio as the vessel outflow (water/OD = 20/30) on every bore.
  const sourceWater = Math.max(2, waterWidthForOd(sourceOd) * scale);
  const targetWater = Math.max(2, waterWidthForOd(targetOd) * scale);
  const bore = flow?.od ?? Math.min(sourceOd, targetOd);
  const nominalWater = Math.max(2, waterWidthForOd(bore) * scale);
  // Single stream keeps the nominal stroke; merged drains thicken toward the bore.
  const rateFill = Math.min(2, Math.max(0, flow?.rateFill01 ?? 1));
  const maxWater = Math.max(nominalWater, bore * scale * 0.88);
  const uniformWater =
    nominalWater + (maxWater - nominalWater) * Math.max(0, rateFill - 1);

  const bodyPts = [
    along(first, outDir, -tipOverlap),
    ...points.slice(1, -1),
    reducer
      ? along(reducer.wide, inDir, 0.5 * scale)
      : tipStubEnd,
  ];
  const bodyLen = Math.max(1, polyLength(bodyPts));
  const stubLen = reducer
    ? Math.max(
        1,
        Math.hypot(tipStubEnd.x - reducer.narrow.x, tipStubEnd.y - reducer.narrow.y)
      )
    : 0;
  const coneLen = reducerLength;
  const totalFlowLen = bodyLen + coneLen + stubLen;

  // Map edge progress onto body → cone → thin stub for reducer runs.
  const headDist = flowHead * totalFlowLen;
  const tailDist = flowTail * totalFlowLen;
  const bodyHead = Math.min(1, Math.max(0, headDist / bodyLen));
  const bodyTail = Math.min(bodyHead, Math.max(0, tailDist / bodyLen));
  const bodySpan = bodyHead - bodyTail;
  const coneVisible = Boolean(reducer && headDist > bodyLen && tailDist < bodyLen + coneLen);
  const stubStart = bodyLen + coneLen;
  const stubHead = Math.min(1, Math.max(0, (headDist - stubStart) / stubLen));
  const stubTail = Math.min(stubHead, Math.max(0, (tailDist - stubStart) / stubLen));
  const stubSpan = stubHead - stubTail;

  const waterPath = flowAlongSource ? path : polyline([...points].reverse());
  const bodyWaterPath = flowAlongSource ? body : polyline([...bodyPts].reverse());
  const stubPath = reducer
    ? flowAlongSource
      ? polyline([reducer.narrow, tipStubEnd])
      : polyline([tipStubEnd, reducer.narrow])
    : "";

  const blendToInlet = Boolean(flow?.blendToInlet);
  const gradId = `${filterId}-inlet`;
  const gradFrom = flowAlongSource ? first : last;
  const gradTo = flowAlongSource ? last : first;
  const waterPaint = blendToInlet ? `url(#${gradId})` : PIPE_WATER_OUTLET;

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
        {blendToInlet ? (
          <linearGradient
            id={gradId}
            gradientUnits="userSpaceOnUse"
            x1={gradFrom.x}
            y1={gradFrom.y}
            x2={gradTo.x}
            y2={gradTo.y}
          >
            <stop offset="0%" stopColor={PIPE_WATER_OUTLET} />
            <stop offset="45%" stopColor={PIPE_WATER_OUTLET} />
            <stop offset="100%" stopColor={PIPE_WATER_INLET} />
          </linearGradient>
        ) : null}
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
        {tipStub ? (
          <path
            d={tipStub}
            fill="none"
            stroke={PIPE_METAL.stroke}
            strokeWidth={(targetOd + 2) * scale}
            strokeLinecap="butt"
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
        {tipStub ? (
          <path
            d={tipStub}
            fill="none"
            stroke={PIPE_FILL}
            strokeWidth={targetOd * scale}
            strokeLinecap="butt"
          />
        ) : null}
        {sourceJoint ? <JointFlange at={first} dir={outDir} od={sourceOd} scale={scale} /> : null}
        {targetJoint ? <JointFlange at={last} dir={backDir} od={targetOd} scale={scale} /> : null}
      </g>
      {showFlow && !reducer ? (
        <path
          className="bp-pipe__water"
          d={waterPath}
          fill="none"
          stroke={waterPaint}
          strokeWidth={uniformWater}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={`${flowSpan * length} ${length}`}
          strokeDashoffset={-flowTail * length}
          opacity={1}
          style={{ pointerEvents: "none" }}
        />
      ) : null}
      {showFlow && reducer ? (
        <g className="bp-pipe__water" style={{ pointerEvents: "none" }}>
          {bodySpan > 0.01 ? (
            <path
              d={bodyWaterPath}
              fill="none"
              stroke={waterPaint}
              strokeWidth={sourceWater}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={`${bodySpan * bodyLen} ${bodyLen}`}
              strokeDashoffset={-bodyTail * bodyLen}
            />
          ) : null}
          {coneVisible ? (
            <polygon
              points={cone(
                reducer.wide,
                reducer.narrow,
                sourceWater / 2,
                targetWater / 2
              )}
              fill={waterPaint}
            />
          ) : null}
          {stubSpan > 0.01 ? (
            <path
              d={stubPath}
              fill="none"
              stroke={blendToInlet ? PIPE_WATER_INLET : waterPaint}
              strokeWidth={targetWater}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={`${stubSpan * stubLen} ${stubLen}`}
              strokeDashoffset={-stubTail * stubLen}
            />
          ) : null}
        </g>
      ) : null}
    </g>
  );
}
