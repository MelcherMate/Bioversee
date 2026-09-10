import { useId } from "react";
import { APPLE_DEPTH_COLORS } from "../pressure-vessel/apple-depth-style";
import {
  MBR_EFFLUENT_RUN,
  MBR_INLET_RUN,
} from "./pipe-geometry";
import {
  MBR_EFFLUENT_PIPE_LEN,
  MBR_INLET_PIPE_LEN,
} from "./constants";
import { PIPE_FILL, PIPE_METAL, PIPE_OD } from "../pressure-vessel/pipe-style";

const FLOW_WIDTH = PIPE_OD - 6;

function PipeRunDefs({
  prefix,
  viewW,
  viewH,
}: {
  prefix: string;
  viewW: number;
  viewH: number;
}) {
  return (
    <defs>
      <filter
        id={`${prefix}-shadow`}
        filterUnits="userSpaceOnUse"
        x="0"
        y="0"
        width={viewW}
        height={viewH}
      >
        <feDropShadow dx="1" dy="2" stdDeviation="1.5" floodColor="#000" floodOpacity="0.2" />
      </filter>
    </defs>
  );
}

type RunLayout = {
  svgLeft: number;
  svgTop: number;
  viewW: number;
  viewH: number;
  centerline: string;
};

function runStyle(run: RunLayout, zIndex: number): React.CSSProperties {
  return {
    position: "absolute",
    left: run.svgLeft,
    top: run.svgTop,
    width: run.viewW,
    height: run.viewH,
    overflow: "visible",
    pointerEvents: "none",
    zIndex,
  };
}

function PipeRun({
  prefix,
  run,
  className,
  zIndex,
  pathLength,
  waterTail = 0,
  waterHead = 0,
  waterColor = APPLE_DEPTH_COLORS.cyan,
}: {
  prefix: string;
  run: RunLayout;
  className: string;
  zIndex: number;
  pathLength: number;
  waterTail?: number;
  waterHead?: number;
  waterColor?: string;
}) {
  const segStart = Math.max(0, waterTail);
  const segEnd = Math.max(segStart, waterHead);
  const segLen = Math.max(0, Math.min(segEnd, pathLength) - segStart);

  return (
    <svg
      className={className}
      style={runStyle(run, zIndex)}
      viewBox={`0 0 ${run.viewW} ${run.viewH}`}
      aria-hidden
      overflow="visible"
    >
      <PipeRunDefs prefix={prefix} viewW={run.viewW} viewH={run.viewH} />
      <g filter={`url(#${prefix}-shadow)`}>
        <path
          d={run.centerline}
          fill="none"
          stroke={PIPE_METAL.stroke}
          strokeWidth={PIPE_OD + 3}
          strokeLinecap="butt"
          strokeLinejoin="round"
        />
        <path
          d={run.centerline}
          fill="none"
          stroke={PIPE_FILL}
          strokeWidth={PIPE_OD}
          strokeLinecap="butt"
          strokeLinejoin="round"
        />
      </g>
      {segLen > 0 ? (
        <path
          d={run.centerline}
          pathLength={pathLength}
          fill="none"
          stroke={waterColor}
          strokeWidth={FLOW_WIDTH}
          strokeLinecap="butt"
          strokeLinejoin="round"
          strokeDasharray={`${segLen} ${pathLength}`}
          strokeDashoffset={-segStart}
        />
      ) : null}
    </svg>
  );
}

type MbrPipeRunsProps = {
  inletWaterTail?: number;
  inletWaterHead?: number;
  effluentWaterTail?: number;
  effluentWaterHead?: number;
};

export function MbrPipeRuns({
  inletWaterTail = 0,
  inletWaterHead = 0,
  effluentWaterTail = 0,
  effluentWaterHead = 0,
}: MbrPipeRunsProps) {
  const inletPrefix = useId().replace(/:/g, "");
  const effluentPrefix = useId().replace(/:/g, "");

  return (
    <>
      <PipeRun
        prefix={inletPrefix}
        run={MBR_INLET_RUN}
        className="pipe-run-svg pipe-run-mbr-inlet"
        zIndex={5}
        pathLength={MBR_INLET_PIPE_LEN}
        waterTail={inletWaterTail}
        waterHead={inletWaterHead}
      />
      <PipeRun
        prefix={effluentPrefix}
        run={MBR_EFFLUENT_RUN}
        className="pipe-run-svg pipe-run-mbr-effluent"
        zIndex={5}
        pathLength={MBR_EFFLUENT_PIPE_LEN}
        waterTail={effluentWaterTail}
        waterHead={effluentWaterHead}
        waterColor={APPLE_DEPTH_COLORS.blue}
      />
    </>
  );
}
