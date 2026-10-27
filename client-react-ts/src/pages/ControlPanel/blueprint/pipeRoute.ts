import { Position, type Rect, type XYPosition } from "@xyflow/react";

/** Straight run past a unit's box before the route may turn (canvas units). */
export const PIPE_ROUTE_OFFSET = 16;

export type PipeEnd = XYPosition & {
  position: Position;
  /** Box of the unit this end belongs to; the pipe leaves it before turning. */
  box?: Rect | null;
};

export type PipeRoute = {
  /** Source end, corners, target end; collinear runs are merged. */
  points: XYPosition[];
  /** Polyline through `points`. */
  path: string;
  length: number;
  /** Middle of the longest run, for edit controls. */
  label: XYPosition;
  /** Unit vector along the longest run, source → target (flow direction). */
  labelDir: XYPosition;
};

const DIRECTION: Record<Position, XYPosition> = {
  [Position.Left]: { x: -1, y: 0 },
  [Position.Right]: { x: 1, y: 0 },
  [Position.Top]: { x: 0, y: -1 },
  [Position.Bottom]: { x: 0, y: 1 },
};

const EPSILON = 1e-6;

/** Pipe ends sit inside their unit's drawing, so the first turn waits until the box is cleared. */
function leadOut({ x, y, position, box }: PipeEnd): number {
  if (!box) return PIPE_ROUTE_OFFSET;
  const inside =
    position === Position.Left
      ? x - box.x
      : position === Position.Right
        ? box.x + box.width - x
        : position === Position.Top
          ? y - box.y
          : box.y + box.height - y;
  return PIPE_ROUTE_OFFSET + Math.max(0, inside);
}

/**
 * Corner placement of React Flow's step edges (`getSmoothStepPath`), kept as
 * points so fittings can be placed on a known run. Each end gets its own lead-out.
 */
function stepPoints(source: PipeEnd, target: PipeEnd): XYPosition[] {
  const sourcePosition = source.position;
  const targetPosition = target.position;
  const sourceDir = DIRECTION[sourcePosition];
  const targetDir = DIRECTION[targetPosition];
  const sourceOffset = leadOut(source);
  const targetOffset = leadOut(target);
  const sourceGapped = {
    x: source.x + sourceDir.x * sourceOffset,
    y: source.y + sourceDir.y * sourceOffset,
  };
  const targetGapped = {
    x: target.x + targetDir.x * targetOffset,
    y: target.y + targetDir.y * targetOffset,
  };
  const horizontal = sourcePosition === Position.Left || sourcePosition === Position.Right;
  const axis = horizontal ? "x" : "y";
  const cross = horizontal ? "y" : "x";
  const heading = sourceGapped[axis] < targetGapped[axis] ? 1 : -1;

  let corners: XYPosition[];
  if (sourceDir[axis] * targetDir[axis] === -1) {
    // Ends face opposite ways along the main axis: turn halfway between them.
    const centerX = (sourceGapped.x + targetGapped.x) / 2;
    const centerY = (sourceGapped.y + targetGapped.y) / 2;
    const verticalSplit = [
      { x: centerX, y: sourceGapped.y },
      { x: centerX, y: targetGapped.y },
    ];
    const horizontalSplit = [
      { x: sourceGapped.x, y: centerY },
      { x: targetGapped.x, y: centerY },
    ];
    if (sourceDir[axis] === heading) {
      corners = axis === "x" ? verticalSplit : horizontalSplit;
    } else {
      corners = axis === "x" ? horizontalSplit : verticalSplit;
    }
  } else {
    const sourceTarget = [{ x: sourceGapped.x, y: targetGapped.y }];
    const targetSource = [{ x: targetGapped.x, y: sourceGapped.y }];
    if (axis === "x") {
      corners = sourceDir.x === heading ? targetSource : sourceTarget;
    } else {
      corners = sourceDir.y === heading ? sourceTarget : targetSource;
    }
    if (sourcePosition !== targetPosition) {
      const sameDir = sourceDir[axis] === targetDir[cross];
      const sourceAfter = sourceGapped[cross] > targetGapped[cross];
      const sourceBefore = sourceGapped[cross] < targetGapped[cross];
      const flip =
        (sourceDir[axis] === 1 &&
          ((!sameDir && sourceAfter) || (sameDir && sourceBefore))) ||
        (sourceDir[axis] !== 1 &&
          ((!sameDir && sourceBefore) || (sameDir && sourceAfter)));
      if (flip) corners = axis === "x" ? sourceTarget : targetSource;
    }
  }

  return [
    { x: source.x, y: source.y },
    sourceGapped,
    ...corners,
    targetGapped,
    { x: target.x, y: target.y },
  ];
}

/** Drops repeated points and joins runs that continue in the same direction. */
function mergeRuns(points: XYPosition[]): XYPosition[] {
  const merged: XYPosition[] = [];
  for (const point of points) {
    const last = merged[merged.length - 1];
    if (last && Math.abs(last.x - point.x) < EPSILON && Math.abs(last.y - point.y) < EPSILON) {
      continue;
    }
    const beforeLast = merged[merged.length - 2];
    if (last && beforeLast) {
      const sameLine =
        (Math.abs(beforeLast.x - last.x) < EPSILON && Math.abs(last.x - point.x) < EPSILON) ||
        (Math.abs(beforeLast.y - last.y) < EPSILON && Math.abs(last.y - point.y) < EPSILON);
      const forward =
        (last.x - beforeLast.x) * (point.x - last.x) +
          (last.y - beforeLast.y) * (point.y - last.y) >
        0;
      if (sameLine && forward) {
        merged[merged.length - 1] = point;
        continue;
      }
    }
    merged.push(point);
  }
  return merged;
}

export function routePipe(source: PipeEnd, target: PipeEnd): PipeRoute {
  const points = mergeRuns(stepPoints(source, target));
  let length = 0;
  let longest = -1;
  let label: XYPosition = points[0]!;
  let labelDir: XYPosition = { x: 1, y: 0 };
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const run = Math.hypot(b.x - a.x, b.y - a.y);
    length += run;
    if (run > longest) {
      longest = run;
      label = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const inv = run > EPSILON ? 1 / run : 1;
      labelDir = { x: (b.x - a.x) * inv, y: (b.y - a.y) * inv };
    }
  }
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  return { points, path, length, label, labelDir };
}
