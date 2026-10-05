import { deleteImages, getImage, imageKeys, putImage, type ImageRecord } from './db';
import { uid } from './util';

/**
 * Photos, processed entirely on the device:
 *   decode (respecting EXIF orientation) → downscale to ≤ 2048 px → re-encode as JPEG.
 * Re-encoding through a canvas drops every byte of metadata (camera, time, GPS).
 * A ≤ 400 px thumbnail is made for the board.
 */

const FULL_EDGE = 2048;
const THUMB_EDGE = 400;
const QUALITY = 0.82;

export class ImageDecodeError extends Error {}

interface Decoded {
  source: CanvasImageSource;
  w: number;
  h: number;
  close(): void;
}

async function decode(file: Blob): Promise<Decoded> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { source: bmp, w: bmp.width, h: bmp.height, close: () => bmp.close() };
    } catch {
      /* fall through to <img> */
    }
  }
  // <img> applies EXIF orientation by default (CSS image-orientation: from-image).
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    if (!img.naturalWidth) throw new Error('empty');
    return { source: img, w: img.naturalWidth, h: img.naturalHeight, close: () => {} };
  } catch {
    throw new ImageDecodeError('That picture couldn’t be opened.');
  } finally {
    URL.revokeObjectURL(url);
  }
}

function fit(w: number, h: number, edge: number) {
  const k = Math.min(1, edge / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}

function drawTo(source: CanvasImageSource, w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  // JPEG has no alpha: paint transparent PNGs onto white rather than black.
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(source, 0, 0, w, h);
  return c;
}

function encode(c: HTMLCanvasElement): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) =>
    c.toBlob(
      (b) => (b ? b.arrayBuffer().then(resolve, reject) : reject(new ImageDecodeError('Couldn’t save that picture.'))),
      'image/jpeg',
      QUALITY,
    ),
  );
}

/** Let the Pencil and UI breathe between heavy steps. */
const yieldFrame = () => new Promise((r) => setTimeout(r, 0));

export async function processImage(file: Blob): Promise<ImageRecord> {
  const d = await decode(file);
  try {
    const full = fit(d.w, d.h, FULL_EDGE);
    const fullCanvas = drawTo(d.source, full.w, full.h);
    await yieldFrame();
    const fullBytes = await encode(fullCanvas);
    await yieldFrame();
    const th = fit(full.w, full.h, THUMB_EDGE);
    const thumbBytes = await encode(drawTo(fullCanvas, th.w, th.h));
    fullCanvas.width = fullCanvas.height = 0; // free the backing store promptly (iPad canvas memory)
    return {
      id: uid(),
      type: 'image/jpeg',
      w: full.w,
      h: full.h,
      full: fullBytes,
      tw: th.w,
      th: th.h,
      thumb: thumbBytes,
      bytes: fullBytes.byteLength + thumbBytes.byteLength,
      createdAt: Date.now(),
    };
  } finally {
    d.close();
  }
}

export async function saveImage(rec: ImageRecord) {
  await putImage(rec);
  meta.set(rec.id, { w: rec.w, h: rec.h });
}

// ---- dimensions + object URLs ------------------------------------------------------

const meta = new Map<string, { w: number; h: number }>();

interface UrlEntry {
  url: Promise<string | null>;
  refs: number;
  timer?: number;
}
const urls = new Map<string, UrlEntry>();

function key(id: string, kind: 'thumb' | 'full') {
  return kind + ':' + id;
}

export function knownSize(id: string) {
  return meta.get(id);
}

/**
 * Get an object URL for a photo, counting references. Every acquire must be paired
 * with a release; URLs are revoked shortly after the last release.
 */
export function acquireUrl(id: string, kind: 'thumb' | 'full'): Promise<{ url: string; w: number; h: number } | null> {
  const k = key(id, kind);
  let e = urls.get(k);
  if (!e) {
    e = {
      refs: 0,
      url: getImage(id).then((rec) => {
        if (!rec) return null;
        meta.set(id, { w: rec.w, h: rec.h });
        const bytes = kind === 'thumb' ? rec.thumb : rec.full;
        return URL.createObjectURL(new Blob([bytes], { type: rec.type }));
      }),
    };
    urls.set(k, e);
  }
  e.refs++;
  clearTimeout(e.timer);
  return e.url.then((url) => {
    const m = meta.get(id);
    return url && m ? { url, ...m } : null;
  });
}

export function releaseUrl(id: string, kind: 'thumb' | 'full') {
  const k = key(id, kind);
  const e = urls.get(k);
  if (!e) return;
  e.refs = Math.max(0, e.refs - 1);
  if (e.refs > 0) return;
  // Small grace period so re-renders don't thrash create/revoke.
  e.timer = window.setTimeout(() => {
    if (e.refs > 0 || urls.get(k) !== e) return;
    urls.delete(k);
    void e.url.then((u) => u && URL.revokeObjectURL(u));
  }, 1500);
}

/**
 * Startup clean-up: delete photos no note refers to. Removing a photo or deleting a
 * note only drops the reference (so undo works); the bytes go here, next launch,
 * once no undo history can bring them back.
 */
export async function collectGarbage(referenced: Set<string>): Promise<number> {
  const keys = await imageKeys();
  const orphans = keys.filter((k) => !referenced.has(k));
  await deleteImages(orphans);
  return orphans.length;
}

// ---- decoded bitmaps (for drawing photos into note canvases) -------------------------

const bitmaps = new Map<string, { bmp: ImageBitmap; used: number }>();
const pendingBitmaps = new Map<string, Promise<ImageBitmap | null>>();
const BITMAP_LIMIT = { thumb: 48, full: 4 };

/** A decoded photo if it's already cached (sync, for drawing). */
export function cachedBitmap(id: string, kind: 'thumb' | 'full'): ImageBitmap | undefined {
  const e = bitmaps.get(key(id, kind));
  if (e) e.used = performance.now();
  return e?.bmp;
}

/** Decode a stored photo into an ImageBitmap (cached, least-recently-used evicted). */
export function loadBitmap(id: string, kind: 'thumb' | 'full'): Promise<ImageBitmap | null> {
  const k = key(id, kind);
  const hit = bitmaps.get(k);
  if (hit) return Promise.resolve(hit.bmp);
  const p = pendingBitmaps.get(k);
  if (p) return p;
  const job = getImage(id)
    .then(async (rec) => {
      if (!rec) return null;
      meta.set(id, { w: rec.w, h: rec.h });
      const bmp = await createImageBitmap(new Blob([kind === 'thumb' ? rec.thumb : rec.full], { type: rec.type }));
      bitmaps.set(k, { bmp, used: performance.now() });
      const same = [...bitmaps.entries()].filter(([kk]) => kk.startsWith(kind + ':'));
      if (same.length > BITMAP_LIMIT[kind]) {
        same.sort((a, b) => a[1].used - b[1].used);
        for (const [kk, v] of same.slice(0, same.length - BITMAP_LIMIT[kind])) {
          v.bmp.close();
          bitmaps.delete(kk);
        }
      }
      return bmp;
    })
    .catch(() => null)
    .finally(() => pendingBitmaps.delete(k));
  pendingBitmaps.set(k, job);
  return job;
}

export function isImageFile(f: File | Blob) {
  return f.type.startsWith('image/') || /\.(heic|heif|jpe?g|png|gif|webp|avif|tiff?|bmp)$/i.test((f as File).name ?? '');
}
