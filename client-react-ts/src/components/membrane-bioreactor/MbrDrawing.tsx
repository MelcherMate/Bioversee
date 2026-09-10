import { APPLE_DEPTH_COLORS } from "../pressure-vessel/apple-depth-style";
import { PIPE_CSS } from "../pressure-vessel/pipe-style";
import { useSpringFillUnits } from "../pressure-vessel/useSpringFillUnits";
import { MbrInletStream } from "./MbrInletStream";
import { MbrPipeRuns } from "./MbrPipeRuns";
import { MbrWaterBody } from "./MbrWaterBody";
import type { MbrFlowVisualState } from "./useMbrFlowAnimation";
import { MembraneModules } from "./MembraneModules";
import {
  MBR_BAFFLE_BOTTOM_GAP,
  MBR_BAFFLE_THICKNESS,
  MBR_BAFFLE_X,
  MBR_CHANNEL_CENTER_X,
  MBR_DIFFUSER_BOTTOM_OFFSET,
  MBR_DIFFUSER_EMITTER_BOTTOM,
  MBR_DIFFUSER_HEIGHT,
  MBR_DIFFUSER_LEFT,
  MBR_DIFFUSER_RIGHT_INSET,
  MBR_EFFLUENT_PIPE_LEN,
  MBR_EFFLUENT_Y,
  MBR_INLET_FALL_LEN,
  MBR_INLET_PIPE_LEN,
  MBR_INNER_HEIGHT,
  MBR_INNER_LEFT,
  MBR_INNER_RIGHT,
  MBR_INNER_TOP,
  MBR_INNER_WIDTH,
  MBR_INFLUENT_NOZZLE_TOP,
  MBR_MEMBRANE_ZONE_LEFT,
  MBR_MEMBRANE_WAVE_ZONE_TOP,
  MBR_NOZZLE_CROSS,
  MBR_NOZZLE_STUB,
  MBR_TANK_HEIGHT,
  MBR_TANK_LEFT,
  MBR_TANK_TOP,
  MBR_TANK_WIDTH,
  MBR_WALL,
  mbrBubbleCount,
  type MbrAerationLevel,
} from "./constants";

type MbrDrawingProps = {
  fillUnits: number;
  flow: MbrFlowVisualState;
  isAerationOn: boolean;
  aerationLevel: MbrAerationLevel;
};

const BAFFLE_LEFT_INNER = MBR_BAFFLE_X - MBR_INNER_LEFT;
const BAFFLE_HEIGHT = MBR_INNER_HEIGHT - MBR_BAFFLE_BOTTOM_GAP;
const EFFLUENT_PATH_START = MBR_INLET_PIPE_LEN + MBR_INLET_FALL_LEN;

export function MbrDrawing({ fillUnits, flow, isAerationOn, aerationLevel }: MbrDrawingProps) {
  const { displayFillUnits } = useSpringFillUnits(fillUnits, {
    stiffness: 120,
    damping: 0.68,
  });
  const bubbleCount = isAerationOn ? mbrBubbleCount(aerationLevel) : 0;

  const showFlow = flow.head > flow.tail;
  const inletPipeTail = showFlow ? Math.min(flow.tail, MBR_INLET_PIPE_LEN) : 0;
  const inletPipeHead = showFlow ? Math.min(flow.head, MBR_INLET_PIPE_LEN) : 0;
  const effluentTail = showFlow
    ? Math.max(0, Math.min(flow.tail - EFFLUENT_PATH_START, MBR_EFFLUENT_PIPE_LEN))
    : 0;
  const effluentHead = showFlow
    ? Math.max(0, Math.min(flow.head - EFFLUENT_PATH_START, MBR_EFFLUENT_PIPE_LEN))
    : 0;

  return (
    <>
      {/* Tank shell */}
      <div className="mbr-shell">
        <div className="mbr-wall" />
        <div className="mbr-composite">
          <MbrInletStream
            tail={showFlow ? flow.tail : 0}
            head={showFlow ? flow.head : 0}
            connectedToWater={flow.connectedToWater}
          />
          <MbrWaterBody
            fillUnits={displayFillUnits}
            bubbleCount={bubbleCount}
            aerationLevel={aerationLevel}
            isAerationOn={isAerationOn}
          />
          <MembraneModules />
          <div
            className={[
              "mbr-diffuser",
              isAerationOn ? `mbr-diffuser--level-${aerationLevel}` : "",
            ].join(" ")}
          />

          {/* Baffle wall — creates the influent settling channel */}
          <div className="mbr-baffle" />
        </div>
      </div>

      <MbrPipeRuns
        inletWaterTail={inletPipeTail}
        inletWaterHead={inletPipeHead}
        effluentWaterTail={effluentTail}
        effluentWaterHead={effluentHead}
      />

      {/* Pipe/tank connections */}
      <div className="pipe-assembly">
        <div className="pipe-nozzle mbr-influent-nozzle" />
        <div className="pipe-nozzle mbr-effluent-nozzle" />
      </div>

      <div className="mbr-label mbr-label-tank">Membrane separation tank</div>

      <style>{`
        .mbr-composite .mbr-inlet-stream {
          position: absolute;
          width: 10px;
          z-index: 0;
          pointer-events: none;
          background: ${APPLE_DEPTH_COLORS.cyan};
        }
        .mbr-composite .vessel-water-mask {
          position: absolute;
          inset: 0;
          z-index: 2;
        }
        .mbr-composite .vessel-water {
          position: absolute;
          left: 0;
          width: 100%;
          bottom: 0;
          overflow: visible;
          --bubble-surface-fade: 46px;
          background: linear-gradient(
            to top,
            ${APPLE_DEPTH_COLORS.blue} 0%,
            ${APPLE_DEPTH_COLORS.blue} 32%,
            ${APPLE_DEPTH_COLORS.cyan} 100%
          );
          opacity: 0.9;
        }
        .mbr-composite .vessel-water .bubble-field {
          position: absolute;
          left: ${MBR_DIFFUSER_LEFT}px;
          right: ${MBR_DIFFUSER_RIGHT_INSET}px;
          bottom: ${MBR_DIFFUSER_EMITTER_BOTTOM}px;
          top: calc(-1 * var(--bubble-surface-fade));
          overflow: hidden;
          z-index: 2;
          pointer-events: none;
          --bubble-rise-ratio: 1;
          -webkit-mask-image: linear-gradient(
            to top,
            #000 0,
            #000 calc(var(--bubble-rise-ratio) * 100% - var(--bubble-surface-fade) * 0.15),
            transparent calc(var(--bubble-rise-ratio) * 100% + var(--bubble-surface-fade) * 0.35)
          );
          mask-image: linear-gradient(
            to top,
            #000 0,
            #000 calc(var(--bubble-rise-ratio) * 100% - var(--bubble-surface-fade) * 0.15),
            transparent calc(var(--bubble-rise-ratio) * 100% + var(--bubble-surface-fade) * 0.35)
          );
        }
        .mbr-composite .vessel-water .bubble {
          position: absolute;
          border-radius: 9999px;
          background: rgba(255, 255, 255, 0.6);
          opacity: 0;
          bottom: 0;
          animation: mbr-bubble-rise 3.6s ease-in infinite;
          pointer-events: none;
        }
        @keyframes mbr-bubble-rise {
          0% {
            bottom: 0;
            transform: translateX(-50%) scale(0.6);
            opacity: 0;
          }
          14% {
            opacity: 0.8;
          }
          70% {
            opacity: 0.5;
          }
          100% {
            bottom: calc(var(--bubble-rise-ratio) * (100% + var(--bubble-surface-fade)));
            transform: translateX(-50%) scale(1);
            opacity: 0;
          }
        }
        .mbr-composite .vessel-water .mbr-channel-water-surface {
          position: absolute;
          left: 0;
          width: calc(${MBR_MEMBRANE_ZONE_LEFT}px + 1px);
          z-index: 4;
          pointer-events: none;
          background: ${APPLE_DEPTH_COLORS.cyan};
        }
        .mbr-composite .vessel-water .mbr-membrane-water-surface {
          position: absolute;
          top: ${MBR_MEMBRANE_WAVE_ZONE_TOP}px;
          left: ${MBR_MEMBRANE_ZONE_LEFT}px;
          right: 0;
          height: 40px;
          z-index: 4;
          overflow: hidden;
          pointer-events: none;
        }
        .mbr-composite .vessel-water .water-surface {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          z-index: 1;
          pointer-events: none;
        }
        .mbr-composite .vessel-water .water-texture {
          position: absolute;
          inset: 0;
          z-index: 1;
          background: linear-gradient(
            to top,
            transparent 0%,
            rgba(255, 255, 255, 0.08) 45%,
            transparent 100%
          );
          background-size: 100% 220%;
          animation: mbr-shimmer 6s ease-in-out infinite;
          pointer-events: none;
        }
        @keyframes mbr-shimmer {
          0%,
          100% {
            background-position: 0% 0%;
          }
          50% {
            background-position: 0% 18%;
          }
        }
      `}</style>

      <style>{`
        .mbr-shell {
          position: absolute;
          left: ${MBR_TANK_LEFT}px;
          top: ${MBR_TANK_TOP}px;
          width: ${MBR_TANK_WIDTH}px;
          height: ${MBR_TANK_HEIGHT}px;
          z-index: 2;
        }
        .mbr-wall {
          position: absolute;
          inset: 0;
          border: ${MBR_WALL}px solid #b8bcc2;
          border-top-color: #cfd3d8;
          border-radius: 14px;
          background: linear-gradient(to bottom, #eceef1, #dfe2e6);
          box-shadow:
            inset 0 2px 4px rgba(255, 255, 255, 0.6),
            0 6px 18px rgba(0, 0, 0, 0.12);
        }
        .mbr-composite {
          position: absolute;
          left: ${MBR_WALL}px;
          top: ${MBR_WALL}px;
          width: ${MBR_INNER_WIDTH}px;
          height: ${MBR_INNER_HEIGHT}px;
          overflow: hidden;
          border-radius: 6px;
          background: linear-gradient(to bottom, #f2f4f6, #e6e9ec);
          isolation: isolate;
        }
        .mbr-baffle {
          position: absolute;
          left: ${BAFFLE_LEFT_INNER}px;
          top: 0;
          width: ${MBR_BAFFLE_THICKNESS}px;
          height: ${BAFFLE_HEIGHT}px;
          background: linear-gradient(to right, #cfd3d8, #b8bcc2);
          border: 1.5px solid #9aa0a8;
          border-top: none;
          border-radius: 0 0 3px 3px;
          box-shadow: 1px 0 3px rgba(0, 0, 0, 0.12);
          z-index: 3;
        }
        .mbr-diffuser {
          position: absolute;
          left: ${MBR_DIFFUSER_LEFT}px;
          right: ${MBR_DIFFUSER_RIGHT_INSET}px;
          bottom: ${MBR_DIFFUSER_BOTTOM_OFFSET}px;
          height: ${MBR_DIFFUSER_HEIGHT}px;
          border-radius: 4px;
          background: repeating-linear-gradient(
            to right,
            #71717a 0,
            #71717a 4px,
            #a1a1aa 4px,
            #a1a1aa 10px
          );
          border: 1.5px solid #52525b;
          z-index: 2;
          transition: box-shadow 0.25s ease;
        }
        .mbr-diffuser--level-25 {
          box-shadow: 0 0 6px rgba(56, 189, 248, 0.25);
        }
        .mbr-diffuser--level-50 {
          box-shadow: 0 0 8px rgba(56, 189, 248, 0.35);
        }
        .mbr-diffuser--level-75 {
          box-shadow: 0 0 10px rgba(56, 189, 248, 0.45);
        }
        .mbr-diffuser--level-100 {
          box-shadow: 0 0 12px rgba(56, 189, 248, 0.55);
        }
        .mbr-influent-nozzle {
          left: ${MBR_CHANNEL_CENTER_X - MBR_NOZZLE_STUB / 2}px;
          top: ${MBR_INFLUENT_NOZZLE_TOP}px;
          width: ${MBR_NOZZLE_STUB}px;
          height: ${MBR_NOZZLE_CROSS}px;
        }
        .mbr-effluent-nozzle {
          left: ${MBR_INNER_RIGHT}px;
          top: ${MBR_EFFLUENT_Y - MBR_NOZZLE_STUB / 2}px;
          width: ${MBR_NOZZLE_CROSS}px;
          height: ${MBR_NOZZLE_STUB}px;
        }
        .pipe-assembly {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 6;
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
        .mbr-label {
          position: absolute;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.03em;
          color: #3f3f46;
          z-index: 6;
          pointer-events: none;
        }
        .mbr-label-tank {
          left: ${MBR_TANK_LEFT}px;
          top: ${MBR_TANK_TOP + MBR_TANK_HEIGHT + 12}px;
          width: ${MBR_TANK_WIDTH}px;
          text-align: center;
          text-transform: uppercase;
          font-size: 11px;
          letter-spacing: 0.05em;
          color: #71717a;
        }
      `}</style>
    </>
  );
}
