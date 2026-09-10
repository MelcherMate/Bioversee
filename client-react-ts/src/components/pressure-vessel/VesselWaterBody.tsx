import { VESSEL_MAX_FILL_UNITS } from "./constants";
import { WaterSurfaceWave } from "./WaterSurfaceWave";

type VesselWaterBodyProps = {
  fillUnits: number;
  fillVelocity: number;
};

export function VesselWaterBody({ fillUnits, fillVelocity }: VesselWaterBodyProps) {
  const fillRatio = Math.min(1, Math.max(0, fillUnits / VESSEL_MAX_FILL_UNITS));

  if (fillRatio <= 0) return null;

  return (
    <div className="vessel-water-mask">
      <div className="vessel-water" style={{ height: `${fillRatio * 100}%` }}>
        <div className="water-texture" />
        <WaterSurfaceWave className="water-surface" fillVelocity={fillVelocity} />
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
