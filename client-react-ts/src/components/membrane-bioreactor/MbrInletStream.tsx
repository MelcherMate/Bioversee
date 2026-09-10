import { APPLE_DEPTH_COLORS } from "../pressure-vessel/apple-depth-style";
import {
  MBR_BAFFLE_CHANNEL,
  MBR_FIXED_FILL_RATIO,
  MBR_INLET_PIPE_LEN,
  MBR_INNER_HEIGHT,
} from "./constants";

const STREAM_WIDTH = 10;

type MbrInletStreamProps = {
  tail: number;
  head: number;
  connectedToWater: boolean;
};

export function MbrInletStream({ tail, head, connectedToWater }: MbrInletStreamProps) {
  const fallTail = Math.max(MBR_INLET_PIPE_LEN, tail);
  const streamTop = fallTail - MBR_INLET_PIPE_LEN;
  const leadingFall = head - fallTail;
  const waterSurfaceY = MBR_INNER_HEIGHT * (1 - MBR_FIXED_FILL_RATIO);
  const airGap = waterSurfaceY - streamTop;

  if (head <= MBR_INLET_PIPE_LEN) return null;

  const streamHeight = connectedToWater ? Math.max(0, airGap) : leadingFall;
  if (streamHeight < 2) return null;

  return (
    <div
      className="mbr-inlet-stream"
      style={{
        left: `${MBR_BAFFLE_CHANNEL / 2 - STREAM_WIDTH / 2}px`,
        top: `${streamTop}px`,
        height: `${streamHeight}px`,
      }}
      aria-hidden
    />
  );
}
