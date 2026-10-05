import { getStroke } from 'perfect-freehand';
import type { InkPoint, Stroke } from './types';

/**
 * Pencil ink. Pressure drives width (perfect-freehand thinning); tilt — the pencil
 * leaning over like a marker on its side — widens the nib and lowers opacity.
 */

export function strokeOptions(size: number, tilt: number, last: boolean, simulatePressure = false, tool: Stroke['tool'] = 'pen') {
  if (tool === 'highlighter') {
    // Flat, even marker: no pressure thinning, no tilt.
    return {
      size,
      thinning: 0,
      smoothing: 0.6,
      streamline: 0.4,
      simulatePressure: false,
      last,
      start: { cap: true, taper: 0 },
      end: { cap: true, taper: 0 },
    };
  }
  return {
    size: size * (1 + 1.1 * tilt),
    thinning: 0.62 - 0.3 * tilt,
    smoothing: 0.55,
    streamline: 0.32,
    simulatePressure,
    last,
    start: { cap: true, taper: 0 },
    end: { cap: true, taper: 0 },
  };
}

export function strokeAlpha(tilt: number, tool: Stroke['tool'] = 'pen') {
  return tool === 'highlighter' ? 0.38 : 1 - 0.32 * tilt;
}

function outlineToPath(outline: number[][]): Path2D {
  const path = new Path2D();
  const len = outline.length;
  if (len < 2) return path;
  // Quadratic curves through the outline midpoints — smooth at any zoom.
  path.moveTo(outline[0][0], outline[0][1]);
  for (let i = 0; i < len; i++) {
    const [x0, y0] = outline[i];
    const [x1, y1] = outline[(i + 1) % len];
    path.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
  }
  path.closePath();
  return path;
}

export function pathFor(
  points: InkPoint[],
  size: number,
  tilt: number,
  last: boolean,
  simulate = false,
  tool: Stroke['tool'] = 'pen',
): Path2D {
  // A single tap (a dot) still needs two points to produce an outline.
  const pts = points.length === 1 ? [points[0], [points[0][0] + 0.01, points[0][1] + 0.01, points[0][2]]] : points;
  return outlineToPath(getStroke(pts, strokeOptions(size, tilt, last, simulate, tool)));
}

// Committed strokes never change, so their outline paths are cached by identity.
const pathCache = new WeakMap<Stroke, Path2D>();

export function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke) {
  let path = pathCache.get(s);
  if (!path) {
    path = pathFor(s.points, s.size, s.tilt, true, false, s.tool);
    pathCache.set(s, path);
  }
  ctx.globalAlpha = strokeAlpha(s.tilt, s.tool);
  ctx.fillStyle = s.color;
  ctx.fill(path);
  ctx.globalAlpha = 1;
}

/**
 * Map PointerEvent tilt to the stroke's "on its side" amount. Normal handwriting
 * holds the pencil ~50–60° off the page, so the effect only starts below that.
 */
export function tiltAmount(e: PointerEvent): number {
  const anyE = e as PointerEvent & { altitudeAngle?: number };
  let altitude: number | undefined = anyE.altitudeAngle;
  if (altitude === undefined || Number.isNaN(altitude)) {
    if (!e.tiltX && !e.tiltY) return 0;
    const tx = Math.tan((e.tiltX * Math.PI) / 180);
    const ty = Math.tan((e.tiltY * Math.PI) / 180);
    altitude = Math.atan(1 / Math.hypot(tx, ty));
  }
  const lean = 1 - altitude / (Math.PI / 2); // 0 upright … 1 flat
  return Math.min(Math.max((lean - 0.45) / 0.45, 0), 1);
}

// ---- photo markup ----------------------------------------------------------------
// Markup strokes are stored normalised to the photo's longest edge (0..1). They are
// drawn in a fixed 0..MARKUP_SPACE space so perfect-freehand's tuning stays the same.

export const MARKUP_SPACE = 1000;
const markupCache = new WeakMap<Stroke, Path2D>();

/** `pxPerUnit`: canvas pixels per normalised unit (the photo's longest edge in canvas px). */
export function drawMarkupStroke(ctx: CanvasRenderingContext2D, s: Stroke, pxPerUnit: number) {
  let path = markupCache.get(s);
  if (!path) {
    const pts = s.points.map(([x, y, p]) => [x * MARKUP_SPACE, y * MARKUP_SPACE, p] as InkPoint);
    path = pathFor(pts, s.size * MARKUP_SPACE, s.tilt, true);
    markupCache.set(s, path);
  }
  const k = pxPerUnit / MARKUP_SPACE;
  ctx.save();
  ctx.transform(k, 0, 0, k, 0, 0);
  ctx.globalAlpha = strokeAlpha(s.tilt);
  ctx.fillStyle = s.color;
  ctx.fill(path);
  ctx.restore();
}

/** Stroke captured in MARKUP_SPACE units → normalised for storage. */
export function normaliseMarkup(s: Stroke): Stroke {
  const k = 1 / MARKUP_SPACE;
  return {
    ...s,
    size: Math.round(s.size * k * 1e5) / 1e5,
    points: s.points.map(([x, y, p]) => [Math.round(x * k * 1e5) / 1e5, Math.round(y * k * 1e5) / 1e5, p]),
  };
}
