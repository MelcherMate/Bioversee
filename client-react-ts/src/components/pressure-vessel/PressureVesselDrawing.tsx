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
