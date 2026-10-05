import { hasText } from './actions';
import { cachedBitmap, knownSize, loadBitmap } from './images';
import { drawMarkupStroke, drawStroke } from './ink';
import { PAGE_H, PAGE_W, type Note, type Stroke } from './types';

/**
 * A note is a page (PAGE_W × PAGE_H units) holding, bottom to top: its photo(s) as a
 * taped polaroid, its typed/dictated text, then Pencil ink. Every surface draws the
 * same page — the editor shows all of it; cards zoom to the part with content — so
 * ink always lines up with the text and photo it annotates.
 */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const TEXT_FONT = '"Barlow", system-ui, sans-serif';
const TEXT_SIZES = [124, 108, 96, 86, 76, 66, 58, 50, 44, 38, 32, 28];
const LINE = 1.12;
const TEXT_COLOR = '#F2F6FF';

export interface TextBlock {
  size: number;
  lines: string[];
  /** Box the text is centred in. */
  box: Rect;
  /** Actual extent of the laid-out lines. */
  used: Rect;
}

export interface PageLayout {
  /** Box the main polaroid is fitted into (centre + size), before its tilt. */
  photo?: Rect;
  text?: TextBlock;
}

let measureCtx: CanvasRenderingContext2D | null = null;
function mctx() {
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d')!;
  return measureCtx;
}

function wrap(text: string, size: number, maxW: number): string[] {
  const ctx = mctx();
  ctx.font = `600 ${size}px ${TEXT_FONT}`;
  const out: string[] = [];
  for (const para of text.split('\n')) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) {
      out.push('');
      continue;
    }
    let line = '';
    for (const word of words) {
      const trial = line ? line + ' ' + word : word;
      if (ctx.measureText(trial).width <= maxW) {
        line = trial;
        continue;
      }
      if (line) out.push(line);
      // A single word wider than the box: break it.
      let w = word;
      while (ctx.measureText(w).width > maxW && w.length > 1) {
        let cut = w.length - 1;
        while (cut > 1 && ctx.measureText(w.slice(0, cut)).width > maxW) cut--;
        out.push(w.slice(0, cut));
        w = w.slice(cut);
      }
      line = w;
    }
    out.push(line);
  }
  return out;
}

function layoutText(text: string, box: Rect): TextBlock {
  const ctx = mctx();
  let lines: string[] = [];
  let size = TEXT_SIZES[TEXT_SIZES.length - 1];
  for (const s of TEXT_SIZES) {
    const l = wrap(text, s, box.w);
    if (l.length * s * LINE <= box.h) {
      lines = l;
      size = s;
      break;
    }
  }
  if (!lines.length) {
    lines = wrap(text, size, box.w);
    const max = Math.max(1, Math.floor(box.h / (size * LINE)));
    if (lines.length > max) lines = [...lines.slice(0, max - 1), lines[max - 1] + '…'];
  }
  ctx.font = `600 ${size}px ${TEXT_FONT}`;
  const widest = Math.max(...lines.map((l) => ctx.measureText(l).width), 1);
  const h = lines.length * size * LINE;
  return {
    size,
    lines,
    box,
    used: { x: box.x + (box.w - widest) / 2, y: box.y + (box.h - h) / 2, w: widest, h },
  };
}

/** The page area text is laid out in (below the photo when there is one). */
export function textBox(hasPhotos: boolean): Rect {
  return hasPhotos ? { x: 70, y: 450, w: 860, h: 320 } : { x: 60, y: 60, w: 880, h: 680 };
}

const layoutCache = new Map<string, PageLayout>();

/** Where the photo and text go. Depends only on text + whether there are photos, never on ink. */
export function pageLayout(n: Pick<Note, 'text' | 'imageIds'>): PageLayout {
  const photos = !!n.imageIds?.length;
  const text = hasText(n) ? n.text!.trim() : '';
  const k = (photos ? '1' : '0') + text;
  const hit = layoutCache.get(k);
  if (hit) return hit;
  const out: PageLayout = {};
  if (photos) out.photo = text ? { x: 500 - 290, y: 40, w: 580, h: 360 } : { x: 500 - 330, y: 60, w: 660, h: 470 };
  if (text) out.text = layoutText(text, textBox(photos));
  if (layoutCache.size > 300) layoutCache.clear();
  layoutCache.set(k, out);
  return out;
}

/** Call after the text font loads: earlier layouts used a fallback font's metrics. */
export function resetPageLayouts() {
  layoutCache.clear();
}

// ---- polaroid geometry -------------------------------------------------------------

const FRAME = 16;
const FRAME_BOTTOM = 26;
const TILT = (-3 * Math.PI) / 180;

/** The image rect inside the main polaroid (unrotated, centred in the photo box). */
export function photoImageRect(box: Rect, imageId: string): Rect {
  const size = knownSize(imageId);
  const maxW = box.w - FRAME * 2;
  const maxH = box.h - FRAME - FRAME_BOTTOM;
  let w = maxW;
  let h = maxH;
  if (size) {
    const k = Math.min(maxW / size.w, maxH / size.h);
    w = size.w * k;
    h = size.h * k;
  }
  const fw = w + FRAME * 2;
  const fh = h + FRAME + FRAME_BOTTOM;
  return { x: box.x + (box.w - fw) / 2 + FRAME, y: box.y + (box.h - fh) / 2 + FRAME, w, h };
}

/** Is a page point on the main photo? (for "tap the photo to open it") */
export function hitPhoto(n: Note, px: number, py: number): boolean {
  const lay = pageLayout(n);
  if (!lay.photo || !n.imageIds?.length) return false;
  const r = photoImageRect(lay.photo, n.imageIds[0]);
  const pad = FRAME * 2;
  return px >= r.x - pad && px <= r.x + r.w + pad && py >= r.y - pad && py <= r.y + r.h + pad + FRAME_BOTTOM;
}

// ---- content bounds -------------------------------------------------------------------

function inkBounds(strokes: Stroke[]): Rect | null {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const s of strokes) {
    const r = s.size;
    for (const [x, y] of s.points) {
      if (x - r < x0) x0 = x - r;
      if (y - r < y0) y0 = y - r;
      if (x + r > x1) x1 = x + r;
      if (y + r > y1) y1 = y + r;
    }
  }
  return x0 === Infinity ? null : { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

function union(a: Rect | null, b: Rect | null): Rect | null {
  if (!a) return b;
  if (!b) return a;
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
}

/** The part of the page that has something on it. */
export function contentBounds(n: Note): Rect | null {
  const lay = pageLayout(n);
  let r = inkBounds(n.strokes);
  if (lay.text) r = union(r, lay.text.used);
  if (lay.photo && n.imageIds?.length) {
    const img = photoImageRect(lay.photo, n.imageIds[0]);
    r = union(r, { x: img.x - FRAME - 30, y: img.y - FRAME - 24, w: img.w + FRAME * 2 + 60, h: img.h + FRAME + FRAME_BOTTOM + 48 });
  }
  return r;
}

// ---- drawing ----------------------------------------------------------------------------

export interface DrawOptions {
  /** CSS size of the target area and device pixel ratio of the canvas. */
  w: number;
  h: number;
  dpr: number;
  /** 'page' shows the whole page; 'content' zooms to what's on it (cards). */
  fit: 'page' | 'content';
  /** Use full-resolution photos (sheets) or thumbnails (cards). */
  photo: 'thumb' | 'full';
  /** Tilt the whole content (the design's -2° handwriting). */
  tiltDeg?: number;
  hideText?: boolean;
  /** Stroke indices to skip (eraser preview) or offset (lasso drag preview). */
  skip?: Set<number>;
  offset?: { indices: Set<number>; dx: number; dy: number };
  /** Called when a photo finishes decoding, so the caller can draw again. */
  onAsset?: () => void;
}

/** The page → target transform: [scale, translateX, translateY] in CSS px. */
export function pageTransform(n: Note, o: Pick<DrawOptions, 'w' | 'h' | 'fit'>): { k: number; tx: number; ty: number } {
  if (o.fit === 'page') {
    const k = Math.min(o.w / PAGE_W, o.h / PAGE_H);
    return { k, tx: (o.w - PAGE_W * k) / 2, ty: (o.h - PAGE_H * k) / 2 };
  }
  const b = contentBounds(n) ?? { x: 0, y: 0, w: PAGE_W, h: PAGE_H };
  const pad = 28;
  const bw = b.w + pad * 2;
  const bh = b.h + pad * 2;
  // Don't blow tiny scribbles up: never show less than ~28% of the page width.
  const k = Math.min(o.w / bw, o.h / bh, o.w / (PAGE_W * 0.28));
  return { k, tx: o.w / 2 - (b.x + b.w / 2) * k, ty: o.h / 2 - (b.y + b.h / 2) * k };
}

export function drawPage(ctx: CanvasRenderingContext2D, n: Note, o: DrawOptions) {
  const { k, tx, ty } = pageTransform(n, o);
  ctx.save();
  ctx.setTransform(o.dpr, 0, 0, o.dpr, 0, 0);
  ctx.clearRect(0, 0, o.w, o.h);
  if (o.tiltDeg) {
    ctx.translate(o.w / 2, o.h / 2);
    ctx.rotate((o.tiltDeg * Math.PI) / 180);
    ctx.translate(-o.w / 2, -o.h / 2);
  }
  ctx.translate(tx, ty);
  ctx.scale(k, k);

  const lay = pageLayout(n);
  if (lay.photo && n.imageIds?.length) drawPhotos(ctx, n, lay.photo, o, k * o.dpr);
  if (lay.text && !o.hideText) {
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = `600 ${lay.text.size}px ${TEXT_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const t = lay.text;
    const lh = t.size * LINE;
    t.lines.forEach((line, i) => ctx.fillText(line, t.box.x + t.box.w / 2, t.used.y + i * lh + (lh - t.size) / 2));
  }
  n.strokes.forEach((s, i) => {
    if (o.skip?.has(i)) return;
    if (o.offset?.indices.has(i)) {
      ctx.save();
      ctx.translate(o.offset.dx, o.offset.dy);
      drawStroke(ctx, s);
      ctx.restore();
    } else drawStroke(ctx, s);
  });
  ctx.restore();
}

function drawPhotos(ctx: CanvasRenderingContext2D, n: Note, box: Rect, o: DrawOptions, devicePxPerUnit: number) {
  const ids = n.imageIds!;
  // Extra photos peek out behind the main one.
  const behind = [
    { dx: 30, dy: 18, rot: (5 * Math.PI) / 180 },
    { dx: -30, dy: 26, rot: (-8 * Math.PI) / 180 },
  ];
  for (let i = Math.min(ids.length, 3) - 1; i >= 1; i--) {
    const b = behind[i - 1];
    drawPolaroid(ctx, n, ids[i], { ...box, x: box.x + b.dx, y: box.y + b.dy }, b.rot, o, devicePxPerUnit, false);
  }
  drawPolaroid(ctx, n, ids[0], box, TILT, o, devicePxPerUnit, true);
  if (ids.length > 1) {
    const r = photoImageRect(box, ids[0]);
    const cx = r.x + r.w + FRAME;
    const cy = r.y - FRAME;
    ctx.save();
    ctx.translate(box.x + box.w / 2, box.y + box.h / 2);
    ctx.rotate(TILT);
    ctx.translate(-(box.x + box.w / 2), -(box.y + box.h / 2));
    ctx.beginPath();
    ctx.arc(cx, cy, 34, 0, Math.PI * 2);
    ctx.fillStyle = '#FFE14D';
    ctx.fill();
    ctx.fillStyle = '#0A1430';
    ctx.font = `900 italic 40px "Barlow Condensed", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(ids.length), cx, cy + 2);
    ctx.restore();
  }
}

function drawPolaroid(
  ctx: CanvasRenderingContext2D,
  n: Note,
  id: string,
  box: Rect,
  rot: number,
  o: DrawOptions,
  devicePxPerUnit: number,
  main: boolean,
) {
  const r = photoImageRect(box, id);
  ctx.save();
  ctx.translate(box.x + box.w / 2, box.y + box.h / 2);
  ctx.rotate(rot);
  ctx.translate(-(box.x + box.w / 2), -(box.y + box.h / 2));
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 30 * devicePxPerUnit;
  ctx.shadowOffsetY = 14 * devicePxPerUnit;
  ctx.fillStyle = '#F2F6FF';
  ctx.fillRect(r.x - FRAME, r.y - FRAME, r.w + FRAME * 2, r.h + FRAME + FRAME_BOTTOM);
  ctx.shadowColor = 'transparent';
  // Prefer the sharper bitmap if it's ready; fall back to the thumbnail, then a placeholder.
  const bmp = cachedBitmap(id, o.photo) ?? (o.photo === 'full' ? cachedBitmap(id, 'thumb') : undefined);
  if (bmp) {
    ctx.drawImage(bmp, r.x, r.y, r.w, r.h);
  } else {
    ctx.fillStyle = '#22305C';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    void loadBitmap(id, o.photo).then((b) => b && o.onAsset?.());
    if (o.photo === 'full') void loadBitmap(id, 'thumb').then((b) => b && o.onAsset?.());
  }
  if (!knownSize(id)) void loadBitmap(id, 'thumb').then((b) => b && o.onAsset?.());
  const markup = n.markup?.[id];
  if (markup?.length) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x, r.y, r.w, r.h);
    ctx.clip();
    ctx.translate(r.x, r.y);
    const longest = Math.max(r.w, r.h);
    for (const s of markup) drawMarkupStroke(ctx, s, longest);
    ctx.restore();
  }
  if (main) {
    // Yellow tape across the top.
    ctx.translate(r.x + r.w / 2, r.y - FRAME);
    ctx.rotate((2 * Math.PI) / 180);
    ctx.fillStyle = 'rgba(255,225,77,0.75)';
    ctx.fillRect(-80, -20, 160, 40);
  }
  ctx.restore();
}
