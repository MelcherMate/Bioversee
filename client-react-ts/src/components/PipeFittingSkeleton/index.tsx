import { PIPE_FILL, PIPE_METAL } from "../pressure-vessel/pipe-style";
import type { PipeBore, PipeFittingTileKind } from "../../lib/pipeFittings";

type PipeFittingSkeletonProps = {
  kind: PipeFittingTileKind;
  bore?: PipeBore;
  height?: number;
};

const STROKE = PIPE_METAL.stroke;
const FILL = PIPE_FILL;
const ARROW = "#6b7280";

/** Preview strokes sized for a 72×72 tile (not canvas ODs). */
function previewBores(bore: PipeBore) {
  const wide = 15;
  const thin = 8;
  if (bore === "wide") return { od: wide, wide, thin };
  return { od: thin, wide, thin };
}

function paintRun(
  d: string,
  od: number,
  join: "round" | "bevel" | "miter" = "round"
) {
  return (
    <>
      <path
        d={d}
        fill="none"
        stroke={STROKE}
        strokeWidth={od + 2}
        strokeLinecap="butt"
        strokeLinejoin={join}
      />
      <path
        d={d}
        fill="none"
        stroke={FILL}
        strokeWidth={od}
        strokeLinecap="butt"
        strokeLinejoin={join}
      />
    </>
  );
}

function chevron(x: number, y: number, angle: number, key: string) {
  return (
    <g
      key={key}
      transform={`translate(${x} ${y}) rotate(${angle})`}
      fill={ARROW}
    >
      <path d="M -3.2 0 H 1.8 M -0.4 -2 L 3.6 0 L -0.4 2 Z" />
    </g>
  );
}

/** Compact SVG preview for device-library piping tiles. */
export default function PipeFittingSkeleton({
  kind,
  bore = "thin",
  height = 72,
}: PipeFittingSkeletonProps) {
  const { od, wide, thin } = previewBores(bore);
  const cx = 36;
  const stemFace = wide / 2;
  const leg = 14;
  const barY = 34;
  const bend = 8;
  const armIn = stemFace + 7;

  // Splitter: wide stem in (top) → thin U legs out (bottom).
  const splitLeft = [
    `M ${cx - leg} 64`,
    `V ${barY + bend}`,
    `A ${bend} ${bend} 0 0 1 ${cx - leg + bend} ${barY}`,
    `H ${cx - stemFace}`,
  ].join(" ");
  const splitRight = [
    `M ${cx + leg} 64`,
    `V ${barY + bend}`,
    `A ${bend} ${bend} 0 0 0 ${cx + leg - bend} ${barY}`,
    `H ${cx + stemFace}`,
  ].join(" ");
  const splitStem = `M ${cx} ${barY + thin / 2 + 1} V 8`;

  // Merger: thin U legs in (top) → wide stem out (bottom).
  const mergeLeft = [
    `M ${cx - leg} 8`,
    `V ${barY - bend}`,
    `A ${bend} ${bend} 0 0 0 ${cx - leg + bend} ${barY}`,
    `H ${cx - stemFace}`,
  ].join(" ");
  const mergeRight = [
    `M ${cx + leg} 8`,
    `V ${barY - bend}`,
    `A ${bend} ${bend} 0 0 1 ${cx + leg - bend} ${barY}`,
    `H ${cx + stemFace}`,
  ].join(" ");
  const mergeStem = `M ${cx} ${barY - thin / 2 - 1} V 64`;

  return (
    <svg
      className="pipe-fitting-skel"
      width={height}
      height={height}
      viewBox="0 0 72 72"
      aria-hidden="true"
    >
      {kind === "cross" ? (
        <>
          {paintRun(`M 10 ${cx} H 62`, od)}
          {paintRun(`M ${cx} 10 V 62`, od)}
        </>
      ) : null}

      {kind === "wye_split" ? (
        <>
          {paintRun(splitLeft, thin)}
          {paintRun(splitRight, thin)}
          {paintRun(splitStem, wide, "bevel")}
          {chevron(cx, 18, 90, "s-stem")}
          {chevron(cx - armIn, barY, 180, "s-l")}
          {chevron(cx + armIn, barY, 0, "s-r")}
        </>
      ) : null}

      {kind === "wye_merge" ? (
        <>
          {paintRun(mergeLeft, thin)}
          {paintRun(mergeRight, thin)}
          {paintRun(mergeStem, wide, "bevel")}
          {chevron(cx - armIn, barY, 0, "m-l")}
          {chevron(cx + armIn, barY, 180, "m-r")}
          {chevron(cx, 52, 90, "m-stem")}
        </>
      ) : null}

      {kind === "reducer" ? (
        <>
          {paintRun("M 6 36 H 26", wide, "bevel")}
          <polygon
            points={`26,${36 - wide / 2 - 1} 46,${36 - thin / 2 - 1} 46,${36 + thin / 2 + 1} 26,${36 + wide / 2 + 1}`}
            fill={STROKE}
          />
          <polygon
            points={`26,${36 - wide / 2} 46,${36 - thin / 2} 46,${36 + thin / 2} 26,${36 + wide / 2}`}
            fill={FILL}
          />
          {paintRun("M 46 36 H 66", thin, "bevel")}
          {chevron(36, 36, 0, "red")}
        </>
      ) : null}
    </svg>
  );
}
