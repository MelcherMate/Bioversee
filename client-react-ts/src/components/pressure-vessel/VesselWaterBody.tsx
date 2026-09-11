import { VESSEL_MAX_FILL_UNITS } from "./constants";
import { WaterSurfaceWave } from "./WaterSurfaceWave";
import "./vessel-water.css";

type VesselWaterBodyProps = {
  fillUnits: number;
  fillVelocity: number;
  /** When false, omit the surface wave (e.g. bioreactor at 100% so it cannot sit above the lid). */
  showSurface?: boolean;
};

export function VesselWaterBody({
  fillUnits,
  fillVelocity,
  showSurface = true,
}: VesselWaterBodyProps) {
  const fillRatio = Math.min(1, Math.max(0, fillUnits / VESSEL_MAX_FILL_UNITS));

  // Hide residual spring/wave puddles; surface wave alone is ~40px tall.
  if (fillRatio < 0.005) return null;

  return (
    <div className="vessel-water-mask">
      <div className="vessel-water" style={{ height: `${fillRatio * 100}%` }}>
        <div className="water-texture" />
        {showSurface ? (
          <WaterSurfaceWave className="water-surface" fillVelocity={fillVelocity} />
        ) : null}
        <div className="bubble-field" aria-hidden>
          <div className="bubble bubble-1" />
          <div className="bubble bubble-2" />
          <div className="bubble bubble-3" />
          <div className="bubble bubble-4" />
          <div className="bubble bubble-5" />
          <div className="bubble bubble-6" />
          <div className="bubble bubble-7" />
        </div>
      </div>
    </div>
  );
}
