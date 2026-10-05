import { daysInToday, hasText } from './actions';
import { weekEndKey } from './days';
import { drawPage } from './page';
import { PRIORITY, WEEKDAY_LABEL, type Note } from './types';
import { el, formatDue, isOverdue } from './util';

/** A note on the board: priority frame, dotted dark surface, header/footer chips, the page drawn to fit. */

export type CardKind = 'today' | 'week' | 'someday';

const CHECK =
  '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0A1430" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>';
const CLOCK =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';

const observer =
  typeof ResizeObserver !== 'undefined'
    ? new ResizeObserver((entries) => {
        for (const e of entries) {
          const card = (e.target as HTMLElement & { __card?: Card }).__card;
          card?.resized(e.contentRect.width, e.contentRect.height);
        }
      })
    : null;

export class Card {
  readonly el: HTMLDivElement;
  private body: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  private top: HTMLDivElement;
  private foot: HTMLDivElement | null = null;
  private stamp: HTMLDivElement | null = null;
  private w = 0;
  private h = 0;
  private frame = 0;
  private headKey = '';
  note: Note;
  kind: CardKind;

  constructor(note: Note, kind: CardKind) {
    this.note = note;
    this.kind = kind;
    this.el = el('div', 'qb-card');
    this.el.dataset.id = note.id;
    this.el.setAttribute('role', 'button');
    this.el.tabIndex = 0;
    const inner = el('div', 'qb-card-in');
    this.top = el('div', 'qb-card-top');
    this.body = el('div', 'qb-card-body');
    this.canvas = el('canvas', 'qb-card-ink');
    this.body.append(this.canvas);
    inner.append(this.top, this.body);
    this.el.append(inner);
    (this.body as HTMLElement & { __card?: Card }).__card = this;
    observer?.observe(this.body);
    this.update(note, kind, true);
  }

  update(note: Note, kind: CardKind, force = false) {
    const prev = this.note;
    this.note = note;
    const kindChanged = kind !== this.kind;
    this.kind = kind;
    const pr = PRIORITY[note.priority];
    this.el.className = `qb-card k-${kind}` + (note.status === 'done' ? ' is-done' : '');
    this.el.style.setProperty('--grad', pr.grad);
    this.el.style.setProperty('--light', pr.light);
    const what = hasText(note) ? note.text!.trim().slice(0, 80) : note.imageIds?.length ? 'photo note' : 'handwritten note';
    this.el.setAttribute(
      'aria-label',
      `${what}. ${pr.label} priority, ${pr.xp} XP${note.status === 'done' ? ', complete' : ''}. Tap to open, hold to complete.`,
    );

    const headKey = [kind, note.priority, note.due, note.dueDate, note.reminder?.due, note.status, this.ageDays(note), weekEndKey()].join('|');
    if (force || headKey !== this.headKey) {
      this.headKey = headKey;
      this.buildChrome(note, kind);
    }
    if (force || kindChanged || prev.strokes !== note.strokes || prev.text !== note.text || prev.imageIds !== note.imageIds || prev.markup !== note.markup) {
      this.schedule();
    }
  }

  private buildChrome(note: Note, kind: CardKind) {
    const pr = PRIORITY[note.priority];
    const pri = el('span', 'qb-card-pri', pr.label);
    const xp = el('span', 'qb-card-xp', `+${pr.xp} XP`);
    const pin = note.reminder ? this.pin(note) : null;
    if (kind === 'today') {
      const age = this.ageDays(note);
      const ageChip = age >= 1 ? el('span', 'qb-agechip' + (age >= 2 ? ' old' : ''), `Day ${age + 1}`) : null;
      ageChip?.setAttribute('title', `In Today for ${age + 1} days`);
      this.top.replaceChildren(pri, ...(ageChip ? [ageChip] : []), ...(pin ? [pin] : []), el('span', 'qb-flex'), xp);
      this.foot?.remove();
      this.foot = null;
    } else {
      const later = !!note.dueDate && note.dueDate > weekEndKey();
      const label = kind === 'someday' ? 'Someday' : note.due ? (later ? 'Next ' : '') + WEEKDAY_LABEL[note.due] : 'Any day';
      const chip = el('span', 'qb-daychip', label);
      this.top.replaceChildren(chip, el('span', 'qb-flex'), ...(pin ? [pin] : []));
      if (!this.foot) {
        this.foot = el('div', 'qb-card-foot');
        this.body.after(this.foot);
      }
      this.foot.replaceChildren(pri, xp);
    }
    if (note.status === 'done') {
      if (!this.stamp) {
        this.stamp = el('div', 'qb-stamp-wrap');
        const s = el('span', 'qb-stamp');
        s.innerHTML = CHECK;
        s.append('Complete');
        this.stamp.append(s);
        this.el.append(this.stamp);
      }
    } else {
      this.stamp?.remove();
      this.stamp = null;
    }
  }

  /** Days in Today, only for active Today notes (finished ones don't age). */
  private ageDays(note: Note) {
    return this.kind === 'today' && note.status === 'active' ? daysInToday(note) : 0;
  }

  /** Re-check date-dependent chips (called when the day changes). */
  refreshDay() {
    this.update(this.note, this.kind);
  }

  private pin(note: Note) {
    const p = el('span', 'qb-pin' + (isOverdue(note.reminder!.due) ? ' overdue' : ''));
    p.innerHTML = CLOCK;
    p.append(formatDue(note.reminder!.due));
    return p;
  }

  resized(w: number, h: number) {
    if (Math.abs(w - this.w) < 0.5 && Math.abs(h - this.h) < 0.5) return;
    this.w = w;
    this.h = h;
    this.schedule();
  }

  private schedule() {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.render();
    });
  }

  render() {
    if (!this.w || !this.h) {
      // Not measured by the observer yet: measure now rather than draw nothing.
      const r = this.body.getBoundingClientRect();
      this.w = r.width;
      this.h = r.height;
      if (!this.w || !this.h) return;
    }
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const pw = Math.round(this.w * dpr);
    const ph = Math.round(this.h * dpr);
    if (this.canvas.width !== pw || this.canvas.height !== ph) {
      this.canvas.width = pw;
      this.canvas.height = ph;
    }
    const ctx = this.canvas.getContext('2d')!;
    drawPage(ctx, this.note, {
      w: this.w,
      h: this.h,
      dpr,
      fit: 'content',
      photo: 'thumb',
      tiltDeg: -2,
      onAsset: () => this.schedule(),
    });
  }

  /** A static copy of the card (for the drag ghost). */
  ghost(): HTMLElement {
    const g = this.el.cloneNode(true) as HTMLElement;
    const src = this.canvas;
    const dst = g.querySelector('canvas');
    if (dst) {
      dst.width = src.width;
      dst.height = src.height;
      dst.getContext('2d')!.drawImage(src, 0, 0);
    }
    return g;
  }

  destroy() {
    observer?.unobserve(this.body);
    cancelAnimationFrame(this.frame);
    this.canvas.width = this.canvas.height = 1;
  }
}
