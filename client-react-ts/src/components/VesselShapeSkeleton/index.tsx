import type { VesselShapeId } from "../../lib/bioreactorGeometry";
import { vesselShapePreset } from "../../lib/bioreactorGeometry";
import "./VesselShapeSkeleton.css";

type VesselShapeSkeletonProps = {
  shape: VesselShapeId;
  /** ViewBox height for the preview card. */
  height?: number;
  className?: string;
};

/**
 * Outline-only vessel silhouette for the creation picker.
 * Uses the same outer size + corner radius as the live layout preset.
 */
export function VesselShapeSkeleton({
  shape,
  height = 112,
  className = "",
}: VesselShapeSkeletonProps) {
  const preset = vesselShapePreset(shape);
  const pad = 10;
  const scale = (height - pad * 2) / preset.outerH;
  const w = preset.outerW * scale;
  const h = preset.outerH * scale;
  const r = Math.max(2, preset.chamberRadius * scale);
  const stroke = Math.max(2.5, preset.border * scale * 0.55);
  const vbW = w + pad * 2;
  const vbH = height;
  const x = pad;
  const y = (vbH - h) / 2;

  return (
    <svg
      className={`vessel-shape-skel${className ? ` ${className}` : ""}`}
      viewBox={`0 0 ${vbW} ${vbH}`}
      width="100%"
      height={height}
      aria-hidden="true"
      focusable="false"
    >
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={r}
        ry={r}
        className="vessel-shape-skel__outline"
        strokeWidth={stroke}
      />
    </svg>
  );
}

export default VesselShapeSkeleton;
