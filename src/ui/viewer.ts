import { addMarkup, removeImage } from '../actions';
import { acquireUrl, releaseUrl } from '../images';
import { drawMarkupStroke, MARKUP_SPACE, normaliseMarkup, pathFor, strokeAlpha } from '../ink';
import { store } from '../store';
import { StrokeCapture } from '../stroke';
import { PAGE_W, PEN_SIZE } from '../types';
import { button, el } from '../util';
import { toast } from './overlay';

/**
 * Full-screen photo viewer.
 *   Markup mode (default): Pencil draws on the photo; fingers pinch-zoom, pan, and swipe
 *   between the note's photos; two-finger tap undoes.
 *   Select-text mode: the app steps out of the way and the photo is a plain <img>, so
 *   iPadOS Live Text can select text in it.
 */

export interface ViewerHost {
  undo(): void;
}

let current: Viewer | null = null;

export function openViewer(noteId: string, index: number, host: ViewerHost) {
  current?.close();
  current = new Viewer(noteId, index, host);
}

export function viewerOpen() {
  return !!current;
}

class Viewer {
  private root: HTMLDivElement;
  private stage: HTMLDivElement;
  private frame: HTMLDivElement;
  private img: HTMLImageElement;
  private ink: HTMLCanvasElement;
  private live: HTMLCanvasElement;
  private counter: HTMLElement;
  private modeBtn: HTMLButtonElement;
  private ids: string[] = [];
  private index: number;
  private imageId: string | null = null;
  private dims: { w: number; h: number } | null = null;
  private mode: 'markup' | 'select' = 'markup';
  /** Fitted size of the photo at zoom 1 (CSS px) and the current transform. */
  private dw = 0;
  private dh = 0;
  private z = 1;
  private tx = 0;
  private ty = 0;
  private cap = new StrokeCapture();
  private touches = new Map<number, { x: number; y: number; sx: number; sy: number; t0: number }>();
  private gesture:
    | { kind: 'none' }
    | { kind: 'one'; id: number; tx0: number; ty0: number }
    | { kind: 'pinch'; a: number; b: number; d0: number; z0: number; lx: number; ly: number }
    | { kind: 'ignore' } = { kind: 'none' };
  private twoTap: { t0: number; ok: boolean } | null = null;
  private unsub: () => void;
  private inkTimer: number | undefined;

  constructor(
    private noteId: string,
    index: number,
    private host: ViewerHost,
  ) {
    this.index = index;
    this.root = el('div', 'viewer');
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-label', 'Photo');
    this.stage = el('div', 'viewer-stage');
    this.frame = el('div', 'viewer-frame');
    this.img = el('img', 'viewer-img');
    this.img.alt = 'Photo on note';
    this.img.draggable = false;
    this.ink = el('canvas', 'viewer-ink');
    this.live = el('canvas', 'viewer-ink live');
    this.frame.append(this.img, this.ink, this.live);
    this.stage.append(this.frame);

    const bar = el('div', 'viewer-bar');
    const close = button('viewer-btn', '✕', () => this.close());
    close.setAttribute('aria-label', 'Close photo');
    this.counter = el('span', 'viewer-count');
    this.modeBtn = button('viewer-btn wide', 'Select text', () => this.setMode(this.mode === 'markup' ? 'select' : 'markup'));
    const remove = button('viewer-btn wide danger', 'Remove photo', () => this.removeCurrent());
    bar.append(close, this.counter, el('span', 'viewer-spacer'), this.modeBtn, remove);
    const prev = button('viewer-nav prev', '‹', () => this.go(-1));
    prev.setAttribute('aria-label', 'Previous photo');
    const next = button('viewer-nav next', '›', () => this.go(1));
    next.setAttribute('aria-label', 'Next photo');
    this.root.append(this.stage, bar, prev, next);
    document.body.append(this.root);

    this.stage.addEventListener('pointerdown', this.onDown);
    this.stage.addEventListener('pointermove', this.onMove);
    this.stage.addEventListener('pointerup', this.onUp);
    this.stage.addEventListener('pointercancel', this.onCancel);
    this.stage.addEventListener('touchstart', this.onTouchStart, { passive: false });
    window.addEventListener('resize', this.onResize);
    document.addEventListener('keydown', this.onKey);

    this.unsub = store.on((e) => {
      if (e.type === 'reset') return this.close();
      if (e.type !== 'notes' || !e.ids.has(this.noteId)) return;
      this.refresh();
    });
    this.refresh();
  }

  /** Re-read the note: photo list (undo may bring photos back) and markup. */
  private refresh() {
    const n = store.get(this.noteId);
    if (!n || n.status !== 'active' || !n.imageIds?.length) {
      this.close();
      return;
    }
    this.ids = n.imageIds;
    if (this.imageId && this.ids.includes(this.imageId)) this.index = this.ids.indexOf(this.imageId);
    this.index = Math.min(Math.max(this.index, 0), this.ids.length - 1);
    this.counter.textContent = this.ids.length > 1 ? `${this.index + 1} / ${this.ids.length}` : '';
    this.root.classList.toggle('single', this.ids.length < 2);
    const id = this.ids[this.index];
    if (id !== this.imageId) this.load(id);
    else this.renderInk();
  }

  private load(id: string) {
    if (this.imageId) releaseUrl(this.imageId, 'full');
    this.imageId = id;
    this.dims = null;
    this.img.removeAttribute('src');
    this.clearInk();
    this.root.classList.add('loading');
    void acquireUrl(id, 'full').then((r) => {
      if (this.imageId !== id) return;
      this.root.classList.remove('loading');
      if (!r) {
        toast('That photo is missing.');
        return;
      }
      this.dims = { w: r.w, h: r.h };
      this.img.src = r.url;
      this.fit();
    });
  }

  private go(delta: number) {
    if (this.ids.length < 2) return;
    this.index = (this.index + delta + this.ids.length) % this.ids.length;
    this.counter.textContent = `${this.index + 1} / ${this.ids.length}`;
    this.load(this.ids[this.index]);
  }

  private removeCurrent() {
    if (!this.imageId) return;
    const id = this.imageId;
    removeImage(this.noteId, id);
    toast('Photo removed', { label: 'Undo', run: () => this.host.undo() });
  }

  private setMode(mode: 'markup' | 'select') {
    this.mode = mode;
    this.root.classList.toggle('select-mode', mode === 'select');
    this.modeBtn.textContent = mode === 'select' ? 'Draw' : 'Select text';
    if (mode === 'select') this.reset();
  }

  // ---- geometry -------------------------------------------------------------------

  private onResize = () => this.fit();

  /** Fit the photo inside the stage at zoom 1. */
  private fit() {
    if (!this.dims) return;
    const W = this.stage.clientWidth;
    const H = this.stage.clientHeight;
    const k = Math.min((W - 24) / this.dims.w, (H - 24) / this.dims.h);
    this.dw = this.dims.w * k;
    this.dh = this.dims.h * k;
    this.frame.style.width = this.img.style.width = this.dw + 'px';
    this.frame.style.height = this.img.style.height = this.dh + 'px';
    this.reset();
  }

  private reset() {
    this.z = 1;
    this.tx = (this.stage.clientWidth - this.dw) / 2;
    this.ty = (this.stage.clientHeight - this.dh) / 2;
    this.apply();
    this.renderInk();
  }

  private apply() {
    this.frame.style.transform = `translate(${this.tx}px, ${this.ty}px) scale(${this.z})`;
  }

  /** Keep the zoomed photo covering the stage (no flying off-screen). */
  private clampPan() {
    const W = this.stage.clientWidth;
    const H = this.stage.clientHeight;
    const w = this.dw * this.z;
    const h = this.dh * this.z;
    this.tx = w <= W ? (W - w) / 2 : Math.min(0, Math.max(W - w, this.tx));
    this.ty = h <= H ? (H - h) / 2 : Math.min(0, Math.max(H - h, this.ty));
  }

  private stagePoint(cx: number, cy: number) {
    const r = this.stage.getBoundingClientRect();
    return { x: cx - r.left, y: cy - r.top };
  }

  // ---- ink -----------------------------------------------------------------------------

  /** Canvas px per normalised unit at the current backing resolution. */
  private canvasScale() {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    return dpr * Math.min(this.z, 3);
  }

  private clearInk() {
    this.ink.width = this.ink.height = 1;
  }

  private renderInk() {
    if (!this.dims || !this.imageId) return;
    const s = this.canvasScale();
    const cw = Math.max(1, Math.round(this.dw * s));
    const ch = Math.max(1, Math.round(this.dh * s));
    this.ink.width = cw;
    this.ink.height = ch;
    this.ink.style.width = this.live.style.width = this.dw + 'px';
    this.ink.style.height = this.live.style.height = this.dh + 'px';
    const ctx = this.ink.getContext('2d')!;
    ctx.clearRect(0, 0, cw, ch);
    const strokes = store.get(this.noteId)?.markup?.[this.imageId] ?? [];
    const longest = Math.max(cw, ch);
    for (const st of strokes) drawMarkupStroke(ctx, st, longest);
  }

  private scheduleInk() {
    clearTimeout(this.inkTimer);
    this.inkTimer = window.setTimeout(() => this.renderInk(), 150);
  }

  private beginStroke(e: PointerEvent) {
    if (!this.dims || !this.imageId) return;
    const imageId = this.imageId;
    const s = this.canvasScale();
    this.live.width = Math.max(1, Math.round(this.dw * s));
    this.live.height = Math.max(1, Math.round(this.dh * s));
    const longestCss = Math.max(this.dw, this.dh);
    // Nib relative to the photo, similar to how it looks on a card, thinner when zoomed in.
    const size = (PEN_SIZE * (MARKUP_SPACE / PAGE_W)) / this.z;
    this.cap.begin(
      e,
      {
        toLocal: (cx, cy) => {
          const p = this.stagePoint(cx, cy);
          const fx = (p.x - this.tx) / this.z;
          const fy = (p.y - this.ty) / this.z;
          return { x: (fx / longestCss) * MARKUP_SPACE, y: (fy / longestCss) * MARKUP_SPACE };
        },
        drawLive: (pts, color, sz, tilt, sim) => {
          const ctx = this.live.getContext('2d')!;
          const k = Math.max(this.live.width, this.live.height) / MARKUP_SPACE;
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.clearRect(0, 0, this.live.width, this.live.height);
          ctx.setTransform(k, 0, 0, k, 0, 0);
          ctx.globalAlpha = strokeAlpha(tilt);
          ctx.fillStyle = color;
          ctx.fill(pathFor(pts, sz, tilt, false, sim));
          ctx.globalAlpha = 1;
        },
        endLive: () => {
          this.live.width = this.live.height = 1;
        },
      },
      store.settings.inkColor,
      size,
    );
    this.stroking = imageId;
  }

  private stroking: string | null = null;

  private commitStroke() {
    const res = this.cap.end();
    const imageId = this.stroking;
    this.stroking = null;
    if (res && imageId) addMarkup(this.noteId, imageId, normaliseMarkup(res.stroke));
  }

  // ---- input ---------------------------------------------------------------------------

  private onTouchStart = (e: TouchEvent) => {
    if (this.mode === 'markup') e.preventDefault();
  };

  private onDown = (e: PointerEvent) => {
    if (this.mode === 'select') return; // native behaviour for Live Text
    e.preventDefault();
    try {
      this.stage.setPointerCapture(e.pointerId);
    } catch {
      /* synthetic */
    }
    if (e.pointerType !== 'touch') {
      if (this.cap.active) this.commitStroke();
      this.cancelTouches();
      this.beginStroke(e);
      return;
    }
    if (this.cap.active) return; // palm
    const p = this.stagePoint(e.clientX, e.clientY);
    this.touches.set(e.pointerId, { x: p.x, y: p.y, sx: p.x, sy: p.y, t0: performance.now() });
    const n = this.touches.size;
    if (n === 1) {
      this.gesture = { kind: 'one', id: e.pointerId, tx0: this.tx, ty0: this.ty };
      this.twoTap = null;
    } else if (n === 2) {
      const first = [...this.touches.values()][0];
      this.twoTap = { t0: first.t0, ok: performance.now() - first.t0 < 260 };
      this.startPinch();
    } else if (this.twoTap) this.twoTap.ok = false;
  };

  private startPinch() {
    const [a, b] = [...this.touches.keys()];
    const A = this.touches.get(a)!;
    const B = this.touches.get(b)!;
    const mx = (A.x + B.x) / 2;
    const my = (A.y + B.y) / 2;
    this.gesture = {
      kind: 'pinch',
      a,
      b,
      d0: Math.max(Math.hypot(A.x - B.x, A.y - B.y), 1),
      z0: this.z,
      lx: (mx - this.tx) / this.z,
      ly: (my - this.ty) / this.z,
    };
  }

  private onMove = (e: PointerEvent) => {
    if (this.mode === 'select') return;
    if (this.cap.isPointer(e.pointerId)) {
      this.cap.move(e);
      return;
    }
    const t = this.touches.get(e.pointerId);
    if (!t) return;
    const p = this.stagePoint(e.clientX, e.clientY);
    t.x = p.x;
    t.y = p.y;
    if (this.twoTap && Math.hypot(t.x - t.sx, t.y - t.sy) > 14) this.twoTap.ok = false;
    const g = this.gesture;
    if (g.kind === 'one' && g.id === e.pointerId) {
      if (this.z > 1.01) {
        this.tx = g.tx0 + (t.x - t.sx);
        this.ty = g.ty0 + (t.y - t.sy);
        this.clampPan();
        this.apply();
      } else {
        // Swipe preview: slide the photo with the finger.
        this.frame.style.transform = `translate(${this.tx + (t.x - t.sx) * 0.6}px, ${this.ty}px)`;
      }
    } else if (g.kind === 'pinch') {
      const A = this.touches.get(g.a);
      const B = this.touches.get(g.b);
      if (!A || !B) return;
      const d = Math.max(Math.hypot(A.x - B.x, A.y - B.y), 1);
      const mx = (A.x + B.x) / 2;
      const my = (A.y + B.y) / 2;
      this.z = Math.min(Math.max(g.z0 * (d / g.d0), 1), 6);
      this.tx = mx - g.lx * this.z;
      this.ty = my - g.ly * this.z;
      this.apply();
    }
  };

  private onUp = (e: PointerEvent) => {
    if (this.mode === 'select') return;
    if (this.cap.isPointer(e.pointerId)) {
      this.cap.move(e);
      this.commitStroke();
      return;
    }
    const t = this.touches.get(e.pointerId);
    if (!t) return;
    this.touches.delete(e.pointerId);
    const g = this.gesture;
    if (this.touches.size === 0) {
      const now = performance.now();
      if (this.twoTap) {
        const ok = this.twoTap.ok && now - this.twoTap.t0 < 380;
        this.twoTap = null;
        this.gesture = { kind: 'none' };
        this.clampPan();
        this.apply();
        if (ok) this.host.undo();
        else this.scheduleInk();
        return;
      }
      if (g.kind === 'one' && this.z <= 1.01) {
        const dx = t.x - t.sx;
        const dy = t.y - t.sy;
        this.apply();
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.3) this.go(dx < 0 ? 1 : -1);
      }
      if (this.z < 1.02) this.reset();
      else {
        this.clampPan();
        this.apply();
        this.scheduleInk();
      }
      this.gesture = { kind: 'none' };
    } else if (g.kind === 'pinch') {
      this.gesture = { kind: 'ignore' };
    }
  };

  private onCancel = (e: PointerEvent) => {
    if (this.cap.isPointer(e.pointerId)) this.commitStroke();
    this.touches.delete(e.pointerId);
    if (!this.touches.size) {
      this.gesture = { kind: 'none' };
      this.twoTap = null;
      this.clampPan();
      this.apply();
    }
  };

  private cancelTouches() {
    this.touches.clear();
    this.twoTap = null;
    this.gesture = { kind: 'none' };
    this.clampPan();
    this.apply();
  }

  private onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') this.close();
    else if (e.key === 'ArrowRight') this.go(1);
    else if (e.key === 'ArrowLeft') this.go(-1);
  };

  flush() {
    if (this.cap.active) this.commitStroke();
  }

  close() {
    if (current !== this) return;
    current = null;
    if (this.cap.active) this.commitStroke();
    this.unsub();
    window.removeEventListener('resize', this.onResize);
    document.removeEventListener('keydown', this.onKey);
    clearTimeout(this.inkTimer);
    if (this.imageId) releaseUrl(this.imageId, 'full');
    this.root.remove();
  }
}

export function flushViewer() {
  current?.flush();
}
