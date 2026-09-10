import {
  MBR_INNER_LEFT,
  MBR_INNER_TOP,
  MBR_MODULE_COUNT,
  MBR_MODULE_HEIGHT,
  MBR_MODULE_TOP,
  MBR_MODULE_WIDTH,
  mbrModuleCenterX,
} from "./constants";

const FIBER_COUNT = 7;

export function MembraneModules() {
  const modules = Array.from({ length: MBR_MODULE_COUNT }, (_, index) => {
    const centerX = mbrModuleCenterX(index);
    return {
      index,
      left: centerX - MBR_MODULE_WIDTH / 2 - MBR_INNER_LEFT,
    };
  });

  const headerY = MBR_MODULE_TOP - MBR_INNER_TOP - 12;
  const firstLeft = mbrModuleCenterX(0) - MBR_INNER_LEFT;
  const lastLeft = mbrModuleCenterX(MBR_MODULE_COUNT - 1) - MBR_INNER_LEFT;

  return (
    <div className="mbr-modules" aria-hidden>
      {/* Permeate collection header spanning the modules */}
      <div
        className="mbr-permeate-header"
        style={{
          left: `${firstLeft - MBR_MODULE_WIDTH / 2}px`,
          top: `${headerY}px`,
          width: `${lastLeft - firstLeft + MBR_MODULE_WIDTH}px`,
        }}
      />

      {modules.map(({ index, left }) => (
        <div
          key={index}
          className="mbr-module"
          style={{
            left: `${left}px`,
            top: `${MBR_MODULE_TOP - MBR_INNER_TOP}px`,
            width: `${MBR_MODULE_WIDTH}px`,
            height: `${MBR_MODULE_HEIGHT}px`,
          }}
        >
          <div className="mbr-module-cap mbr-module-cap-top" />
          <div className="mbr-module-fibers">
            {Array.from({ length: FIBER_COUNT }, (_, f) => (
              <span key={f} className="mbr-fiber" />
            ))}
          </div>
          <div className="mbr-module-cap mbr-module-cap-bottom" />
        </div>
      ))}

      <style>{`
        .mbr-modules {
          position: absolute;
          left: 0;
          top: 0;
          right: 0;
          bottom: 0;
          pointer-events: none;
          z-index: 3;
        }
        .mbr-permeate-header {
          position: absolute;
          height: 12px;
          border-radius: 4px;
          background: linear-gradient(to bottom, #e4e4e7, #a1a1aa);
          border: 1.5px solid #52525b;
          box-shadow: 1px 2px 4px rgba(0, 0, 0, 0.2);
          z-index: 4;
        }
        .mbr-module {
          position: absolute;
          display: flex;
          flex-direction: column;
        }
        .mbr-module-cap {
          height: 12px;
          border-radius: 3px;
          background: linear-gradient(to bottom, #d4d4d8, #a1a1aa);
          border: 1.5px solid #52525b;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4);
          z-index: 2;
        }
        .mbr-module-fibers {
          position: relative;
          flex: 1;
          display: flex;
          justify-content: space-between;
          padding: 0 3px;
          margin: -2px 0;
          border-left: 1.5px solid rgba(82, 82, 91, 0.35);
          border-right: 1.5px solid rgba(82, 82, 91, 0.35);
          background: linear-gradient(
            to right,
            rgba(228, 228, 231, 0.55),
            rgba(212, 212, 216, 0.35)
          );
        }
        .mbr-fiber {
          width: 2px;
          height: 100%;
          background: linear-gradient(
            to bottom,
            #d4d4d8 0%,
            #a1a1aa 50%,
            #d4d4d8 100%
          );
          border-radius: 1px;
          opacity: 0.85;
        }
      `}</style>
    </div>
  );
}
