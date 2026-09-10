/** Pipe metal tokens — shared by CSS nozzles/flanges and SVG runs. */
export const PIPE_METAL = {
  dark: "#52525b",
  mid: "#71717a",
  base: "#a1a1aa",
  light: "#d4d4d8",
  highlight: "#e4e4e7",
  stroke: "#52525b",
} as const;

export const PIPE_OD = 16;

/** Flat pipe body — matches vessel shell grey. */
export const PIPE_FILL = "#a1a1aa";

export const PIPE_CSS = {
  stroke: PIPE_METAL.stroke,
  strokeWidth: 2,
  od: PIPE_OD,
  gradNozzle: "linear-gradient(to bottom, #d4d4d8 0%, #a1a1aa 55%, #71717a 100%)",
  insetHighlight: "inset 0 1px 3px rgba(255, 255, 255, 0.28)",
  dropShadow: "1px 2px 4px rgba(0, 0, 0, 0.18)",
} as const;
