import type { CSSProperties } from "react";
import { VESSEL_MAX_FILL_UNITS } from "../pressure-vessel/constants";
import { useWaveSurfaceSlosh } from "../pressure-vessel/useWaveSurfaceSlosh";
import { WaterSurfaceWave } from "../pressure-vessel/WaterSurfaceWave";
import {
  mbrBubblesForCount,
  type MbrAerationLevel,
  mbrAerationWaveVelocity,
  mbrBubbleRiseRatio,
  MBR_MEMBRANE_WAVE_ZONE_TOP,
} from "./constants";
import { WAVE_VIEW_HEIGHT } from "../pressure-vessel/wave-path";

type MbrWaterBodyProps = {
  fillUnits: number;
  bubbleCount: number;
  aerationLevel: MbrAerationLevel;
  isAerationOn: boolean;
};

export function MbrWaterBody({
  fillUnits,
  bubbleCount,
  aerationLevel,
  isAerationOn,
}: MbrWaterBodyProps) {
  const fillRatio = Math.min(1, Math.max(0, fillUnits / VESSEL_MAX_FILL_UNITS));
  const bubbles = mbrBubblesForCount(bubbleCount);
  const riseRatio = mbrBubbleRiseRatio(aerationLevel);
  const waveVelocity = mbrAerationWaveVelocity(isAerationOn, aerationLevel);
  const { sloshRisePx, baselineY } = useWaveSurfaceSlosh(waveVelocity, WAVE_VIEW_HEIGHT);
  const channelSurfaceTop = MBR_MEMBRANE_WAVE_ZONE_TOP + baselineY;
  const bubbleFieldStyle = {
    "--bubble-rise-ratio": riseRatio,
  } as CSSProperties;

  if (fillRatio <= 0) return null;

  return (
    <div className="vessel-water-mask">
      <div
        className="vessel-water"
        style={
          {
            height: `${fillRatio * 100}%`,
            "--bubble-rise-ratio": riseRatio,
          } as CSSProperties
        }
      >
        <div className="water-texture" />
        <div
          className="mbr-channel-water-surface"
          style={{
            top: `${channelSurfaceTop}px`,
            height: `${sloshRisePx + 2}px`,
          }}
          aria-hidden
        />
        <div className="mbr-membrane-water-surface">
          <WaterSurfaceWave
            className="water-surface"
            fillVelocity={waveVelocity}
            baselineY={baselineY}
          />
        </div>
        {bubbles.length > 0 ? (
          <div className="bubble-field" style={bubbleFieldStyle} aria-hidden>
            {bubbles.map((bubble, index) => (
              <div
                key={index}
                className="bubble"
                style={
                  {
                    left: bubble.left,
                    width: bubble.size,
                    height: bubble.size,
                    animationDelay: `${bubble.delay}s`,
                    animationDuration: `${bubble.duration}s`,
                  } as CSSProperties
                }
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
