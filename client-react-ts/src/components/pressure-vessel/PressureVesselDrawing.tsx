import {
  APPLE_DEPTH_COLORS,
} from "./apple-depth-style";
import { DrainStream } from "./DrainStream";
import { InletFillStream } from "./InletFillStream";
import { PIPE_CSS } from "./pipe-style";
import { VesselPipeRuns } from "./VesselPipeRuns";
import { useSpringFillUnits } from "./useSpringFillUnits";
import type { InletFillVisualState } from "./useInletFillAnimation";
import type { DrainVisualState } from "./useDrainAnimation";
import { VESSEL_COMPOSITE_HEIGHT, VESSEL_MAX_FILL_UNITS } from "./constants";
import { VesselDepthGauge } from "./VesselDepthGauge";
import { VesselWaterBody } from "./VesselWaterBody";

type PressureVesselDrawingProps = {
  fillUnits: number;
  inletFill: InletFillVisualState;
  drainAnim: DrainVisualState;
};

export function PressureVesselDrawing({
  fillUnits,
  inletFill,
  drainAnim,
}: PressureVesselDrawingProps) {
  const levelFillUnits =
    drainAnim.isLevelFrozen && drainAnim.frozenFillUnits != null
      ? drainAnim.frozenFillUnits
      : fillUnits;

  const { displayFillUnits, fillVelocity } = useSpringFillUnits(levelFillUnits, {
    stiffness: 120,
    damping: 0.68,
  });

  const showInletWater = inletFill.head > inletFill.tail;
  const showDrainWater = drainAnim.head > drainAnim.tail;
  const drainPathRiseLength =
    Math.min(1, Math.max(0, levelFillUnits / VESSEL_MAX_FILL_UNITS)) * VESSEL_COMPOSITE_HEIGHT;

  return (
    <>
      <div className="vessel-shell">
        <div className="vessel-composite">
          <div className="tank-bg" />
          <InletFillStream
            tail={showInletWater ? inletFill.tail : 0}
            head={showInletWater ? inletFill.head : 0}
            displayFillUnits={displayFillUnits}
            connectedToSurface={inletFill.connectedToSurface}
          />
          <DrainStream
            tail={showDrainWater ? drainAnim.tail : 0}
            head={showDrainWater ? drainAnim.head : 0}
            displayFillUnits={displayFillUnits}
            pathRiseLength={drainPathRiseLength}
            connectedToNozzle={drainAnim.connectedToNozzle}
          />
          <VesselWaterBody fillUnits={displayFillUnits} fillVelocity={fillVelocity} />
          <VesselDepthGauge fillUnits={levelFillUnits} />
        </div>
        <div className="head head-top" />
        <div className="cyl-body" />
        <div className="head head-bottom" />
      </div>

      <VesselPipeRuns
        inletWaterTail={showInletWater ? inletFill.tail : 0}
        inletWaterHead={showInletWater ? inletFill.head : 0}
        drainWaterTail={showDrainWater ? drainAnim.tail : 0}
        drainWaterHead={showDrainWater ? drainAnim.head : 0}
        drainRiseLength={drainPathRiseLength}
      />

      <div className="pipe-assembly pipe-inlet">
        <div className="pipe-flange pipe-flange-h inlet-flange-vessel" />
        <div className="inlet-nozzle pipe-nozzle" />
      </div>

      <div className="pipe-assembly pipe-drain">
        <div className="pipe-flange pipe-flange-h drain-flange-vessel" />
        <div className="drain-nozzle pipe-nozzle" />
      </div>

      <div className="leg leg-left" />
      <div className="leg leg-right" />
      <div className="baseplate" />

      <style>{`
        .vessel-water-mask {
          position: absolute;
          inset: 0;
          z-index: 1;
        }
        .vessel-water {
          position: absolute;
          left: -20px;
          width: calc(100% + 40px);
          bottom: 0;
          overflow: visible;
          --bubble-surface-fade: 50px;
          background: linear-gradient(
            to top,
            ${APPLE_DEPTH_COLORS.blue} 0%,
            ${APPLE_DEPTH_COLORS.blue} 35%,
            ${APPLE_DEPTH_COLORS.cyan} 100%
          );
        }
        .vessel-water .bubble-field {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          top: calc(-1 * var(--bubble-surface-fade));
          overflow: hidden;
          z-index: 1;
          pointer-events: none;
          -webkit-mask-image: linear-gradient(
            to top,
            #000 0,
            #000 calc(100% - var(--bubble-surface-fade)),
            transparent 100%
          );
          mask-image: linear-gradient(
            to top,
            #000 0,
            #000 calc(100% - var(--bubble-surface-fade)),
            transparent 100%
          );
        }
        .vessel-water .bubble {
          position: absolute;
          border-radius: 9999px;
          background: rgba(255, 255, 255, 0.55);
          opacity: 0;
          animation: vessel-bubble-rise 3.8s ease-in infinite;
          pointer-events: none;
        }
        .vessel-water .bubble-1 {
          --bubble-bottom: 12%;
          left: 22%;
          bottom: var(--bubble-bottom);
          width: 6px;
          height: 6px;
          animation-delay: 0.8s;
        }
        .vessel-water .bubble-2 {
          --bubble-bottom: 22%;
          left: 48%;
          bottom: var(--bubble-bottom);
          width: 4px;
          height: 4px;
          animation-delay: 2.1s;
          animation-duration: 4.2s;
        }
        .vessel-water .bubble-3 {
          --bubble-bottom: 16%;
          left: 71%;
          bottom: var(--bubble-bottom);
          width: 5px;
          height: 5px;
          animation-delay: 0.2s;
          animation-duration: 3.4s;
        }
        .vessel-water .bubble-4 {
          --bubble-bottom: 38%;
          left: 36%;
          bottom: var(--bubble-bottom);
          width: 3px;
          height: 3px;
          animation-delay: 3.3s;
          animation-duration: 4.6s;
        }
        .vessel-water .bubble-5 {
          --bubble-bottom: 52%;
          left: 58%;
          bottom: var(--bubble-bottom);
          width: 4px;
          height: 4px;
          animation-delay: 1.4s;
          animation-duration: 3.6s;
        }
        .vessel-water .bubble-6 {
          --bubble-bottom: 68%;
          left: 34%;
          bottom: var(--bubble-bottom);
          width: 4px;
          height: 4px;
          animation-delay: 0.6s;
          animation-duration: 3s;
        }
        .vessel-water .bubble-7 {
          --bubble-bottom: 74%;
          left: 68%;
          bottom: var(--bubble-bottom);
          width: 5px;
          height: 5px;
          animation-delay: 2.4s;
          animation-duration: 3.5s;
        }
        @keyframes vessel-water-shimmer {
          0%,
          100% {
            background-position: 0% 0%;
          }
          50% {
            background-position: 0% 18%;
          }
        }
        @keyframes vessel-bubble-rise {
          0% {
            bottom: var(--bubble-bottom);
            transform: scale(0.6);
            opacity: 0;
          }
          12% {
            opacity: 0.75;
          }
          62% {
            opacity: 0.5;
          }
          82% {
            bottom: calc(100% + 12px);
            opacity: 0.18;
          }
          100% {
            bottom: calc(100% + var(--bubble-surface-fade));
            transform: scale(1);
            opacity: 0;
          }
        }
        .vessel-water .water-surface {
          position: absolute;
          top: -16px;
          left: -4%;
          width: 108%;
          height: 40px;
          z-index: 2;
          pointer-events: none;
        }
        .vessel-water .water-texture {
          position: absolute;
          inset: 0;
          z-index: 1;
          background: linear-gradient(
            to top,
            transparent 0%,
            rgba(255, 255, 255, 0.06) 45%,
            transparent 100%
          );
          background-size: 100% 220%;
          animation: vessel-water-shimmer 6s ease-in-out infinite;
          pointer-events: none;
        }
      `}</style>

      <style>{`
        .vessel-shell {
          position: absolute;
          left: 170px;
          top: 40px;
          width: 300px;
          height: 430px;
          z-index: 2;
          overflow: hidden;
        }
        .vessel-composite {
          position: absolute;
          inset: 0;
          overflow: hidden;
          border-radius: 65px;
          opacity: 0.99;
          isolation: isolate;
        }
        .tank-bg {
          position: absolute;
          inset: 0;
          background: #d4d4d8;
          z-index: 0;
        }
        .head {
          position: absolute;
          left: 0;
          width: 100%;
          height: 64px;
          background: #d4d4d8;
          border: 2px solid #52525b;
          z-index: 5;
          overflow: hidden;
        }
        .head-top {
          top: 0;
          border-radius: 160px 160px 0 0;
          border-bottom: 0;
          background: transparent;
          z-index: 2;
        }
        .head-bottom {
          bottom: 0;
          border-radius: 0 0 160px 160px;
          border-top: 0;
          background: transparent;
          z-index: 2;
        }
        .cyl-body {
          position: absolute;
          top: 64px;
          bottom: 64px;
          width: 100%;
          border-left: 2px solid #52525b;
          border-right: 2px solid #52525b;
          background: transparent;
          overflow: hidden;
          z-index: 5;
          pointer-events: none;
        }
        .pipe-assembly {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 3;
        }
        .pipe-nozzle {
          position: absolute;
          background: ${PIPE_CSS.gradNozzle};
          border: ${PIPE_CSS.strokeWidth}px solid ${PIPE_CSS.stroke};
          border-radius: 3px;
          box-shadow: ${PIPE_CSS.insetHighlight}, ${PIPE_CSS.dropShadow};
          z-index: 5;
        }
        .pipe-nozzle::before {
          content: "";
          position: absolute;
          inset: -5px -4px;
          border: ${PIPE_CSS.strokeWidth}px solid ${PIPE_CSS.stroke};
          border-radius: 4px;
          background: linear-gradient(to bottom, #d4d4d8, #a1a1aa);
          z-index: -1;
          box-shadow: ${PIPE_CSS.dropShadow};
        }
        .pipe-flange {
          position: absolute;
          background: linear-gradient(to bottom, #e4e4e7, #a1a1aa);
          border: ${PIPE_CSS.strokeWidth}px solid ${PIPE_CSS.stroke};
          box-shadow: ${PIPE_CSS.dropShadow};
          z-index: 2;
        }
        .pipe-flange-h {
          width: 22px;
          height: 5px;
          border-radius: 2px;
        }
        .inlet-nozzle {
          left: 250px;
          top: 26px;
          width: 25px;
          height: 14px;
        }
        .inlet-flange-vessel {
          left: 252px;
          top: 5px;
        }
        .drain-nozzle {
          left: 303px;
          top: 470px;
          width: 26px;
          height: 14px;
        }
        .drain-flange-vessel {
          left: 305px;
          top: 486px;
        }
        .leg {
          position: absolute;
          top: 428px;
          width: 24px;
          height: 100px;
          background: #71717a;
          border: 1px solid #52525b;
          z-index: 1;
          transform-origin: bottom center;
        }
        .leg-left {
          left: 204px;
          transform: rotate(8deg);
        }
        .leg-right {
          left: 412px;
          transform: rotate(-8deg);
        }
        .baseplate {
          position: absolute;
          left: 168px;
          top: 524px;
          width: 304px;
          height: 10px;
          border-radius: 6px;
          background: #52525b;
          border: none;
          z-index: 2;
        }
      `}</style>
    </>
  );
}
