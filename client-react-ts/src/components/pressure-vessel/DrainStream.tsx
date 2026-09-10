import { APPLE_DEPTH_COLORS } from "./apple-depth-style";
import { VESSEL_COMPOSITE_HEIGHT, VESSEL_MAX_FILL_UNITS } from "./constants";

/** Drain center within the vessel composite (matches nozzle at page x ≈ 316). */
const STREAM_X = 146;
const STREAM_WIDTH = 10;
/** Overlap so the column blends into the vessel water below the surface. */
const SURFACE_OVERLAP = 16;

type DrainStreamProps = {
  tail: number;
  head: number;
  displayFillUnits: number;
  /** Matches drain animation path coords (actual fill, not spring display). */
  pathRiseLength: number;
  connectedToNozzle: boolean;
};

export function DrainStream({
  tail,
  head,
  displayFillUnits,
  pathRiseLength,
  connectedToNozzle,
}: DrainStreamProps) {
  const displayFillRatio = Math.min(1, Math.max(0, displayFillUnits / VESSEL_MAX_FILL_UNITS));
  const surfaceY = (1 - displayFillRatio) * VESSEL_COMPOSITE_HEIGHT;

  if (pathRiseLength < 2 || head <= 0) return null;
  // Valve closed — tank column is gone; only pipe water remains.
  if (!connectedToNozzle && head > pathRiseLength) return null;

  const riseTail = Math.min(tail, pathRiseLength);
  const riseHead = Math.min(head, pathRiseLength);
  const streamTop = surfaceY + riseTail;
  const leadingRise = riseHead - riseTail;
  const columnSpan = pathRiseLength - riseTail;

  const streamHeight =
    connectedToNozzle || head > pathRiseLength
      ? columnSpan + SURFACE_OVERLAP
      : leadingRise;

  if (riseHead <= riseTail && head <= pathRiseLength) return null;
  if (streamHeight < 2) return null;

  return (
    <>
      <div
        className="drain-rising-stream"
        style={{
          left: `${STREAM_X - STREAM_WIDTH / 2}px`,
          top: `${streamTop}px`,
          height: `${streamHeight}px`,
        }}
        aria-hidden
      />

      <style>{`
        .drain-rising-stream {
          position: absolute;
          width: ${STREAM_WIDTH}px;
          z-index: 0;
          pointer-events: none;
          background: ${APPLE_DEPTH_COLORS.cyan};
        }
      `}</style>
    </>
  );
}
