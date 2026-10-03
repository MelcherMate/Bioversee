import type { CSSProperties } from "react";
import type { BioreactorGeometry } from "../../lib/bioreactorGeometry";
import {
  LEGACY_BORDER_PX,
  LEGACY_CHAMBER_RADIUS_PX,
  LEGACY_INNER_HEIGHT_PX,
  LEGACY_INNER_WIDTH_PX,
  LEGACY_OUTER_HEIGHT_PX,
  LEGACY_OUTER_WIDTH_PX,
  LEGACY_WATER_RADIUS_PX,
  defaultBioreactorGeometry,
} from "../../lib/bioreactorGeometry";

const JACKET_THICK = 18;

/** Fitting size caps (px). */
const MAX_AGITATOR_WIDTH = 210;
const MIN_AGITATOR_WIDTH = 90;
const MAX_SENSOR_WIDTH = 18;
const MIN_SENSOR_WIDTH = 12;
const MAX_BLADE_SPAN = 190;

export type BioreactorLayout = {
  /** Card host size */
  cardWidth: number;
  cardHeight: number;
  /** Wrapper box (relative origin for absolute children) */
  wrapperWidth: number;
  wrapperHeight: number;
  wrapperMarginTop: number;
  wrapperMarginLeft: number;
  /** Chamber outer (border-box), relative to wrapper */
  chamber: {
    left: number;
    top: number;
    width: number;
    height: number;
    border: number;
    radius: number;
  };
  /** Inner water clip */
  waterClip: {
    left: number;
    top: number;
    width: number;
    height: number;
    radius: number;
  };
  /** Jacket / VESSEL outer box (matches historical VESSEL constants) */
  vessel: {
    left: number;
    right: number;
    top: number;
    bottom: number;
    radius: number;
  };
  jacketThick: number;
  jacketPipeY: number;
  jacketSvg: {
    left: number;
    top: number;
    width: number;
    height: number;
    viewBox: string;
    gradX0: number;
    gradX1: number;
    pathEndX: number;
  };
  agitator: {
    left: number;
    top: number;
    width: number;
    height: number;
    shaftHeight: number;
    stageWidth: number;
    stageHeight: number;
    upperTop: number;
    lowerTop: number;
    cavitationWidth: number;
  };
  /** Impeller disc Y offsets from water-clip bottom (for bubble field). */
  impeller: {
    lowerFromBottom: number;
    upperFromBottom: number;
    clipHeight: number;
    /** Fill % below which even the lower Rushton disc is dry. */
    minFillPercent: number;
  };
  sensors: {
    top: number;
    width: number;
    height: number;
    right1: number;
    right2: number;
    /** Headspace pressure transmitter on the lid. */
    pressureLeft: number;
    pressureTop: number;
    /** Fill % below which pH / temperature tips are dry. */
    minFillPercent: number;
  };
  outflow: {
    centerX: number;
    vesselBottom: number;
    drop: number;
    run: number;
    pipeOd: number;
    /** Metal pipe centerline length (nozzle → open end). */
    pipePathLength: number;
    /** Rising-column height scale (water clip height). */
    columnHeight: number;
  };
  aerator: {
    spargerWidth: number;
    spargerY: number;
    spargerLeft: number;
    dropX: number;
    pipeEndX: number;
    viewBox: string;
    svgLeft: number;
    svgTop: number;
    svgWidth: number;
    svgHeight: number;
    spawnBottomPctAtFull: number;
    /** Fill % below which the sparger is uncovered. */
    minFillPercent: number;
  };
  dose: {
    tipX: number;
    tipY: number;
    svgLeft: number;
    svgTop: number;
    dripTravel: number;
  };
  /**
   * Lid fill nozzle — vertical penetration on the flat apex (inner + outer
   * walls still horizontal), just clear of the agitator shaft.
   */
  fillInlet: {
    /** Pipe centerline X in wrapper coords. */
    centerX: number;
    /** Y where the vertical run meets the outer lid. */
    lidY: number;
    /** Y of the open tip inside the headspace. */
    tipY: number;
    /** Y of the top elbow / horizontal run. */
    elbowY: number;
    /** Open square end of the horizontal supply run. */
    runEndX: number;
    pipeOd: number;
    /** Metal pipe centerline length (open end → tip). */
    pipePathLength: number;
    /** Falling-column height scale (water clip height). */
    columnHeight: number;
    svgLeft: number;
    svgTop: number;
    svgWidth: number;
    svgHeight: number;
    viewBox: string;
    centerline: string;
  };
  /** CSS custom properties for Bioreactor.css */
  cssVars: Record<string, string>;
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * Fixed legacy capsule layout. Volume is data-only and does not affect drawing.
 */
export function layoutFromGeometry(
  _geometry: Pick<BioreactorGeometry, "height_m" | "diameter_m"> = defaultBioreactorGeometry(),
): BioreactorLayout {
  const innerW = LEGACY_INNER_WIDTH_PX;
  const innerH = LEGACY_INNER_HEIGHT_PX;
  const border = LEGACY_BORDER_PX;
  const outerW = LEGACY_OUTER_WIDTH_PX;
  const outerH = LEGACY_OUTER_HEIGHT_PX;
  const radius = LEGACY_CHAMBER_RADIUS_PX;
  const innerRadius = LEGACY_WATER_RADIUS_PX;

  const jacketPadX = 130;
  const jacketPadTop = 140;
  const jacketPadBottom = 40;
  const wrapperWidth = 442;
  const wrapperHeight = 521;
  const chamberLeft = 20;
  const chamberTop = -120;

  const waterLeft = chamberLeft + border;
  const waterTop = chamberTop + border;
  const waterW = innerW;
  const waterH = innerH;

  const vessel = {
    left: chamberLeft,
    right: chamberLeft + outerW,
    top: chamberTop,
    bottom: chamberTop + outerH,
    radius,
  };

  const jacketPipeY = chamberTop + outerH * 0.44;
  const jacketSvgLeft = chamberLeft - jacketPadX;
  const jacketSvgTop = chamberTop - 20;
  const jacketSvgW = outerW + jacketPadX * 2 + 40;
  const jacketSvgH = outerH + jacketPadTop * 0.5 + jacketPadBottom + 80;
  const pathEndX = vessel.right + jacketPadX - 20;
  const gradX0 = jacketSvgLeft;
  const gradX1 = pathEndX + 20;

  const vesselCenterX = chamberLeft + outerW / 2;
  const agitatorWidth = clamp(innerW * 0.54, MIN_AGITATOR_WIDTH, MAX_AGITATOR_WIDTH);
  const agitatorLeft = vesselCenterX - agitatorWidth / 2;
  const agitatorTop = chamberTop - 40;
  const stageHeight = clamp(agitatorWidth * 0.34, 48, 72);
  const stageWidth = clamp(agitatorWidth * 0.97, 80, MAX_BLADE_SPAN);

  // Impeller planes as fractions of water column (match legacy ~0.20 / 0.345 at full fill)
  const lowerFrac = 0.202;
  const upperFrac = 0.345;
  const lowerFromBottom = waterH * lowerFrac;
  const upperFromBottom = waterH * upperFrac;
  // Stage top relative to agitator (disc center ≈ stage mid)
  const waterBottomAbs = waterTop + waterH;
  const lowerDiscAbsY = waterBottomAbs - lowerFromBottom;
  const upperDiscAbsY = waterBottomAbs - upperFromBottom;
  const lowerTop = lowerDiscAbsY - agitatorTop - stageHeight / 2;
  const upperTop = upperDiscAbsY - agitatorTop - stageHeight / 2;
  const shaftHeight = lowerDiscAbsY - agitatorTop + stageHeight * 0.35;
  const agitatorHeight = Math.max(shaftHeight + 40, waterBottomAbs - agitatorTop + 20);

  const sensorW = clamp(innerW * 0.045, MIN_SENSOR_WIDTH, MAX_SENSOR_WIDTH);
  const sensorTop = chamberTop - 40;
  // Tip ends just below the upper impeller — short enough to clear the dish wall.
  const sensorTipY = waterBottomAbs - upperFromBottom + 28;
  const sensorHeight = Math.max(280, sensorTipY - sensorTop);
  const chamberRight = chamberLeft + outerW;
  const sensorRight1 = wrapperWidth - (chamberRight - innerW * 0.22);
  const sensorRight2 = wrapperWidth - (chamberRight - innerW * 0.14);
  /** Headspace TX on the flat apex of the lid, left of the agitator. */
  const pressureLeft = vesselCenterX - 58;
  const pressureTop = chamberTop - 42;
  /** Tip height from dish floor as a fraction of the full water column. */
  const sensorTipFrac = Math.max(0, (waterBottomAbs - sensorTipY) / waterH);
  const sensorsMinFillPercent = Math.ceil(sensorTipFrac * 100);

  const outflowDrop = 100;
  const outflowRun = 110;
  const outflowPipeOd = 30;

  const spargerWidth = clamp(innerW * 0.55, 80, 220);
  const spargerY = waterBottomAbs - waterH * 0.1; // ~10% up from dish floor in abs Y... wait waterBottomAbs is bottom
  // sparger near bottom of water: absolute Y from wrapper
  const spargerAbsY = waterTop + waterH * 0.9;
  const spargerLeft = vesselCenterX - spargerWidth / 2;
  const dropX = chamberLeft + border + innerW * 0.16;
  const pipeEndX = spargerLeft + 10;
  const spawnBottomPctAtFull = 10;
  /** Minimum fill % so the sparger bar stays submerged. */
  const aeratorMinFillPercent = spawnBottomPctAtFull;

  const doseTipX = vesselCenterX + innerW * 0.12;
  const doseTipY = 88; // in dose SVG coords — scaled below
  const dripTravel = waterH * 0.95;

  // Flat lid apex (outer + inner): x ∈ [chamberLeft+radius, chamberRight−radius]
  // = [189, 253]. Shaft is 6px wide at vesselCenterX — place fill OD clear of it.
  const fillPipeOd = 16;
  const shaftHalf = 3;
  const fillGapFromShaft = 8;
  const fillCenterX =
    vesselCenterX + shaftHalf + fillGapFromShaft + fillPipeOd / 2;
  const fillLidY = chamberTop;
  // Stop the nozzle at the inner lid face — do not poke a metal tip into the water body.
  const fillTipY = waterTop + 2;
  const fillElbowY = chamberTop - 58;
  const fillRunEndX = fillCenterX + 72;
  const fillPad = 20;
  const fillSvgLeft = fillCenterX - fillPad;
  const fillSvgTop = fillElbowY - fillPad;
  const fillSvgW = fillRunEndX - fillCenterX + fillPad * 2 + fillPipeOd;
  const fillSvgH = fillTipY - fillElbowY + fillPad * 2;
  const fillLocalX = fillPad;
  const fillLocalElbowY = fillPad;
  const fillLocalTipY = fillTipY - fillElbowY + fillPad;
  const fillLocalRunEndX = fillRunEndX - fillCenterX + fillPad;
  const fillHoriz = fillRunEndX - fillCenterX;
  const fillVert = fillTipY - fillElbowY;
  const fillPipePathLength = fillHoriz + fillVert;
  // Open end → elbow → tip (matches inlet fill advance direction).
  const fillCenterline = [
    `M ${fillLocalRunEndX} ${fillLocalElbowY}`,
    `L ${fillLocalX} ${fillLocalElbowY}`,
    `L ${fillLocalX} ${fillLocalTipY}`,
  ].join(" ");

  const wrapperMarginTop = 200;
  const wrapperMarginLeft = 175;

  const cardWidth = 800;
  const cardHeight = Math.max(
    750,
    wrapperMarginTop +
      wrapperHeight +
      Math.max(0, chamberTop + outerH - wrapperHeight) +
      outflowDrop +
      40,
  );

  const cssVars: Record<string, string> = {
    "--br-wrapper-w": `${wrapperWidth}px`,
    "--br-wrapper-h": `${wrapperHeight}px`,
    "--br-wrapper-mt": `${wrapperMarginTop}px`,
    "--br-wrapper-ml": `${wrapperMarginLeft}px`,
    "--br-chamber-left": `${chamberLeft}px`,
    "--br-chamber-top": `${chamberTop}px`,
    "--br-chamber-w": `${outerW}px`,
    "--br-chamber-h": `${outerH}px`,
    "--br-chamber-border": `${border}px`,
    "--br-chamber-radius": `${radius}px`,
    "--br-water-left": `${waterLeft}px`,
    "--br-water-top": `${waterTop}px`,
    "--br-water-w": `${waterW}px`,
    "--br-water-h": `${waterH}px`,
    "--br-water-radius": `${innerRadius}px`,
    "--br-agitator-left": `${agitatorLeft}px`,
    "--br-agitator-top": `${agitatorTop}px`,
    "--br-agitator-w": `${agitatorWidth}px`,
    "--br-agitator-h": `${agitatorHeight}px`,
    "--br-shaft-h": `${shaftHeight}px`,
    "--br-stage-w": `${stageWidth}px`,
    "--br-stage-h": `${stageHeight}px`,
    "--br-stage-upper-top": `${upperTop}px`,
    "--br-stage-lower-top": `${lowerTop}px`,
    "--br-cavitation-w": `${stageWidth + 20}px`,
    "--br-sensor-top": `${sensorTop}px`,
    "--br-sensor-w": `${sensorW}px`,
    "--br-sensor-h": `${sensorHeight}px`,
    "--br-sensor-right-1": `${sensorRight1}px`,
    "--br-sensor-right-2": `${sensorRight2}px`,
    "--br-pressure-left": `${pressureLeft}px`,
    "--br-pressure-top": `${pressureTop}px`,
    "--br-jacket-svg-left": `${jacketSvgLeft}px`,
    "--br-jacket-svg-top": `${jacketSvgTop}px`,
    "--br-jacket-svg-w": `${jacketSvgW}px`,
    "--br-jacket-svg-h": `${jacketSvgH}px`,
    "--br-aerator-left": `${jacketSvgLeft}px`,
    "--br-aerator-top": `${chamberTop - 20}px`,
    "--br-aerator-w": `${jacketSvgW * 0.7}px`,
    "--br-aerator-h": `${outerH + 60}px`,
    "--br-dose-left": `${chamberLeft - 128}px`,
    "--br-dose-top": `${chamberTop - 43}px`,
    "--br-fill-left": `${fillSvgLeft}px`,
    "--br-fill-top": `${fillSvgTop}px`,
    "--br-fill-w": `${fillSvgW}px`,
    "--br-fill-h": `${fillSvgH}px`,
  };

  return {
    cardWidth,
    cardHeight,
    wrapperWidth,
    wrapperHeight,
    wrapperMarginTop,
    wrapperMarginLeft,
    chamber: {
      left: chamberLeft,
      top: chamberTop,
      width: outerW,
      height: outerH,
      border,
      radius,
    },
    waterClip: {
      left: waterLeft,
      top: waterTop,
      width: waterW,
      height: waterH,
      radius: innerRadius,
    },
    vessel,
    jacketThick: JACKET_THICK,
    jacketPipeY,
    jacketSvg: {
      left: jacketSvgLeft,
      top: jacketSvgTop,
      width: jacketSvgW,
      height: jacketSvgH,
      viewBox: `${jacketSvgLeft} ${jacketSvgTop} ${jacketSvgW} ${jacketSvgH}`,
      gradX0,
      gradX1,
      pathEndX,
    },
    agitator: {
      left: agitatorLeft,
      top: agitatorTop,
      width: agitatorWidth,
      height: agitatorHeight,
      shaftHeight,
      stageWidth,
      stageHeight,
      upperTop,
      lowerTop,
      cavitationWidth: stageWidth + 20,
    },
    impeller: {
      lowerFromBottom,
      upperFromBottom,
      clipHeight: waterH,
      minFillPercent: Math.ceil(lowerFrac * 100),
    },
    sensors: {
      top: sensorTop,
      width: sensorW,
      height: sensorHeight,
      right1: sensorRight1,
      right2: sensorRight2,
      pressureLeft,
      pressureTop,
      minFillPercent: sensorsMinFillPercent,
    },
    outflow: {
      centerX: vesselCenterX,
      vesselBottom: vessel.bottom,
      drop: outflowDrop,
      run: outflowRun,
      pipeOd: outflowPipeOd,
      pipePathLength: outflowDrop + outflowRun,
      columnHeight: waterH,
    },
    aerator: {
      spargerWidth,
      spargerY: spargerAbsY,
      spargerLeft,
      dropX,
      pipeEndX,
      viewBox: `${jacketSvgLeft} ${chamberTop - 20} ${jacketSvgW * 0.7} ${outerH + 60}`,
      svgLeft: jacketSvgLeft,
      svgTop: chamberTop - 20,
      svgWidth: jacketSvgW * 0.7,
      svgHeight: outerH + 60,
      spawnBottomPctAtFull,
      minFillPercent: aeratorMinFillPercent,
    },
    dose: {
      tipX: doseTipX,
      tipY: doseTipY,
      svgLeft: chamberLeft - 128,
      svgTop: chamberTop - 43,
      dripTravel,
    },
    fillInlet: {
      centerX: fillCenterX,
      lidY: fillLidY,
      tipY: fillTipY,
      elbowY: fillElbowY,
      runEndX: fillRunEndX,
      pipeOd: fillPipeOd,
      pipePathLength: fillPipePathLength,
      columnHeight: waterH,
      svgLeft: fillSvgLeft,
      svgTop: fillSvgTop,
      svgWidth: fillSvgW,
      svgHeight: fillSvgH,
      viewBox: `0 0 ${fillSvgW} ${fillSvgH}`,
      centerline: fillCenterline,
    },
    cssVars,
  };
}

export function layoutCssVars(layout: BioreactorLayout): CSSProperties {
  return layout.cssVars as CSSProperties;
}
