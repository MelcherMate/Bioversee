import { APPLE_DEPTH_COLORS } from "./apple-depth-style";
import { VESSEL_COMPOSITE_HEIGHT, VESSEL_MAX_FILL_UNITS } from "./constants";
import { INLET_PATH_LENGTH } from "./pipe-geometry";

const STREAM_X = 92.5;
const STREAM_WIDTH = 10;
/** Keep a little overlap so the stream blends into the vessel water. */
const SURFACE_OVERLAP = 16;

type InletFillStreamProps = {
  tail: number;
  head: number;
  displayFillUnits: number;
  connectedToSurface: boolean;
};

export function InletFillStream({
  tail,
  head,
  displayFillUnits,
  connectedToSurface,
}: InletFillStreamProps) {
  const fillRatio = Math.min(1, Math.max(0, displayFillUnits / VESSEL_MAX_FILL_UNITS));
  const surfaceY = (1 - fillRatio) * VESSEL_COMPOSITE_HEIGHT;

  const fallTail = Math.max(INLET_PATH_LENGTH, tail);
  const streamTop = fallTail - INLET_PATH_LENGTH;
  const leadingFall = head - fallTail;
  const airGap = surfaceY - streamTop;

  const streamHeight = connectedToSurface
    ? airGap + SURFACE_OVERLAP
    : leadingFall;

  if (head <= INLET_PATH_LENGTH || streamHeight < 2) return null;

  return (
    <>
      <div
        className="inlet-falling-stream"
        style={{
          left: `${STREAM_X - STREAM_WIDTH / 2}px`,
          top: `${streamTop}px`,
          height: `${streamHeight}px`,
        }}
        aria-hidden
      />

      <style>{`
        .inlet-falling-stream {
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
