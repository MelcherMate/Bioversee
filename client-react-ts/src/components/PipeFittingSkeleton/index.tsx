import { PIPE_FILL, PIPE_METAL } from "../pressure-vessel/pipe-style";
import {
  boreOd,
  type PipeBore,
  type PipeFittingTileKind,
} from "../../lib/pipeFittings";

type PipeFittingSkeletonProps = {
  kind: PipeFittingTileKind;
  bore?: PipeBore;
  height?: number;
};

/** Compact SVG preview for device-library piping tiles. */
export default function PipeFittingSkeleton({
  kind,
  bore = "thin",
  height = 72,
}: PipeFittingSkeletonProps) {
  const od = kind === "reducer" ? undefined : boreOd(bore);
  const wide = boreOd("wide");
  const thin = boreOd("thin");
  const stroke = PIPE_METAL.stroke;

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
          <line
            x1="12"
            y1="36"
            x2="60"
            y2="36"
            stroke={stroke}
            strokeWidth={(od ?? thin) + 2}
            strokeLinecap="butt"
          />
          <line
            x1="12"
            y1="36"
            x2="60"
            y2="36"
            stroke={PIPE_FILL}
            strokeWidth={od ?? thin}
            strokeLinecap="butt"
          />
          <line
            x1="36"
            y1="12"
            x2="36"
            y2="60"
            stroke={stroke}
            strokeWidth={(od ?? thin) + 2}
            strokeLinecap="butt"
          />
          <line
            x1="36"
            y1="12"
            x2="36"
            y2="60"
            stroke={PIPE_FILL}
            strokeWidth={od ?? thin}
            strokeLinecap="butt"
          />
        </>
      ) : null}

      {kind === "wye_split" ? (
        <>
          <path
            d="M36 10 V38 H30 A8 8 0 0 0 22 46 V62 M36 38 H42 A8 8 0 0 1 50 46 V62"
            fill="none"
            stroke={stroke}
            strokeWidth={(od ?? thin) + 2}
            strokeLinecap="butt"
            strokeLinejoin="round"
          />
          <path
            d="M36 10 V38 H30 A8 8 0 0 0 22 46 V62 M36 38 H42 A8 8 0 0 1 50 46 V62"
            fill="none"
            stroke={PIPE_FILL}
            strokeWidth={od ?? thin}
            strokeLinecap="butt"
            strokeLinejoin="round"
          />
        </>
      ) : null}

      {kind === "wye_merge" ? (
        <>
          <path
            d="M22 10 V26 A8 8 0 0 0 30 34 H36 M50 10 V26 A8 8 0 0 1 42 34 H36 M36 34 V62"
            fill="none"
            stroke={stroke}
            strokeWidth={(od ?? thin) + 2}
            strokeLinecap="butt"
            strokeLinejoin="round"
          />
          <path
            d="M22 10 V26 A8 8 0 0 0 30 34 H36 M50 10 V26 A8 8 0 0 1 42 34 H36 M36 34 V62"
            fill="none"
            stroke={PIPE_FILL}
            strokeWidth={od ?? thin}
            strokeLinecap="butt"
            strokeLinejoin="round"
          />
        </>
      ) : null}

      {kind === "reducer" ? (
        <>
          <line
            x1="8"
            y1="36"
            x2="28"
            y2="36"
            stroke={stroke}
            strokeWidth={wide + 2}
            strokeLinecap="butt"
          />
          <line
            x1="8"
            y1="36"
            x2="28"
            y2="36"
            stroke={PIPE_FILL}
            strokeWidth={wide}
            strokeLinecap="butt"
          />
          <polygon
            points={`28,${36 - wide / 2 - 1} 44,${36 - thin / 2 - 1} 44,${36 + thin / 2 + 1} 28,${36 + wide / 2 + 1}`}
            fill={PIPE_METAL.stroke}
          />
          <polygon
            points={`28,${36 - wide / 2} 44,${36 - thin / 2} 44,${36 + thin / 2} 28,${36 + wide / 2}`}
            fill={PIPE_FILL}
          />
          <line
            x1="44"
            y1="36"
            x2="64"
            y2="36"
            stroke={stroke}
            strokeWidth={thin + 2}
            strokeLinecap="butt"
          />
          <line
            x1="44"
            y1="36"
            x2="64"
            y2="36"
            stroke={PIPE_FILL}
            strokeWidth={thin}
            strokeLinecap="butt"
          />
        </>
      ) : null}
    </svg>
  );
}
