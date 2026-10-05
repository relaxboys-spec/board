import { tiltAmount } from './ink';
import type { InkPoint, Stroke } from './types';

/**
 * Captures one Pencil stroke for any surface (the board, the pop-up pad, the photo
 * viewer). The surface supplies the coordinate mapping and a live-drawing callback;
 * this class handles coalesced + predicted events, de-duplication, tilt averaging and
 * frame-paced live rendering.
 */

export interface StrokeSurface {
  /** Client (CSS px) → the surface's stroke units. */
  toLocal(clientX: number, clientY: number): { x: number; y: number };
  drawLive(points: InkPoint[], color: string, size: number, tilt: number, simulate: boolean): void;
  endLive(): void;
}

export interface FinishedStroke {
  stroke: Stroke;
  /** Barely moved and quick: a tap rather than a mark. */
  isTap: boolean;
}

export class StrokeCapture {
  private s: {
    pointerId: number;
    surface: StrokeSurface;
    points: InkPoint[];
    predicted: InkPoint[];
    tiltSum: number;
    tiltN: number;
    t0: number;
    simulate: boolean;
    color: string;
    size: number;
    frame: number;
  } | null = null;

  get active() {
    return !!this.s;
  }

  isPointer(id: number) {
    return this.s?.pointerId === id;
  }

  begin(e: PointerEvent, surface: StrokeSurface, color: string, size: number) {
    this.s = {
      pointerId: e.pointerId,
      surface,
      points: [],
      predicted: [],
      tiltSum: 0,
      tiltN: 0,
      t0: performance.now(),
      simulate: e.pointerType !== 'pen',
      color,
      size,
      frame: 0,
    };
    this.add(e);
    this.schedule();
  }

  move(e: PointerEvent) {
    const s = this.s;
    if (!s) return;
    const events = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
    if (events.length) for (const ce of events) this.add(ce);
    else this.add(e);
    const predicted = typeof e.getPredictedEvents === 'function' ? e.getPredictedEvents() : [];
    s.predicted = predicted
      .slice(0, 2)
      .map((pe) => this.point(pe))
      .filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));
    this.schedule();
  }

  /** End the stroke. Returns null if nothing was drawn. */
  end(): FinishedStroke | null {
    const s = this.s;
    if (!s) return null;
    this.s = null;
    if (s.frame) cancelAnimationFrame(s.frame);
    s.surface.endLive();
    if (!s.points.length) return null;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const [x, y] of s.points) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    const extent = Math.max(maxX - minX, maxY - minY);
    const tilt = s.tiltN ? Math.round((s.tiltSum / s.tiltN) * 1000) / 1000 : 0;
    return {
      stroke: { color: s.color, size: s.size, tilt, points: s.points },
      isTap: extent < s.size * 0.6 && performance.now() - s.t0 < 350,
    };
  }

  private point(e: { clientX: number; clientY: number; pressure: number }): InkPoint {
    const s = this.s!;
    const { x, y } = s.surface.toLocal(e.clientX, e.clientY);
    const pressure = s.simulate ? 0.5 : Math.max(e.pressure || 0, 0.05);
    return [Math.round(x * 100) / 100, Math.round(y * 100) / 100, Math.round(pressure * 1000) / 1000];
  }

  private add(e: PointerEvent) {
    const s = this.s!;
    const pt = this.point(e);
    if (!Number.isFinite(pt[0]) || !Number.isFinite(pt[1])) return; // surface not laid out: never store NaN
    const last = s.points[s.points.length - 1];
    if (last && Math.abs(last[0] - pt[0]) < 0.15 && Math.abs(last[1] - pt[1]) < 0.15) {
      last[2] = Math.max(last[2], pt[2]);
      return;
    }
    s.points.push(pt);
    if (e.pointerType === 'pen') {
      s.tiltSum += tiltAmount(e);
      s.tiltN++;
    }
  }

  private schedule() {
    const s = this.s;
    if (!s || s.frame) return;
    s.frame = requestAnimationFrame(() => {
      if (this.s !== s) return;
      s.frame = 0;
      const tilt = s.tiltN ? s.tiltSum / s.tiltN : 0;
      s.surface.drawLive(s.predicted.length ? [...s.points, ...s.predicted] : s.points, s.color, s.size, tilt, s.simulate);
    });
  }
}
