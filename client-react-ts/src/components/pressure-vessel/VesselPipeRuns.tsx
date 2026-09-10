import { useId } from "react";
import { APPLE_DEPTH_COLORS } from "./apple-depth-style";
import {
  DRAIN_PIPE_PATH_LENGTH,
  DRAIN_RUN,
  INLET_PATH_LENGTH,
  INLET_RUN,
} from "./pipe-geometry";
import { PIPE_FILL, PIPE_METAL, PIPE_OD } from "./pipe-style";

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

function PipeLRun({
  prefix,
  run,
  className,
  zIndex,
  pathLength,
  riseLength = 0,
  waterTail = 0,
  waterHead = 0,
  waterColor = APPLE_DEPTH_COLORS.cyan,
}: {
  prefix: string;
  run: RunLayout;
  className: string;
  zIndex: number;
  pathLength: number;
  riseLength?: number;
  waterTail?: number;
  waterHead?: number;
  waterColor?: string;
}) {
  const pipeTail = Math.max(riseLength, waterTail) - riseLength;
  const pipeHead = waterHead - riseLength;
  const segStart = Math.max(0, pipeTail);
  const segEnd = Math.max(segStart, pipeHead);
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

type VesselPipeRunsProps = {
  inletWaterTail?: number;
  inletWaterHead?: number;
  drainWaterTail?: number;
  drainWaterHead?: number;
  drainRiseLength?: number;
};

export function VesselPipeRuns({
  inletWaterTail = 0,
  inletWaterHead = 0,
  drainWaterTail = 0,
  drainWaterHead = 0,
  drainRiseLength = 0,
}: VesselPipeRunsProps) {
  const inletPrefix = useId().replace(/:/g, "");
  const drainPrefix = useId().replace(/:/g, "");

  return (
    <>
      <PipeLRun
        prefix={inletPrefix}
        run={INLET_RUN}
        className="pipe-run-svg pipe-run-inlet"
        zIndex={3}
        pathLength={INLET_PATH_LENGTH}
        waterTail={inletWaterTail}
        waterHead={inletWaterHead}
      />
      <PipeLRun
        prefix={drainPrefix}
        run={DRAIN_RUN}
        className="pipe-run-svg pipe-run-drain"
        zIndex={0}
        pathLength={DRAIN_PIPE_PATH_LENGTH}
        riseLength={drainRiseLength}
        waterTail={drainWaterTail}
        waterHead={drainWaterHead}
        waterColor={APPLE_DEPTH_COLORS.blue}
      />
    </>
  );
}
