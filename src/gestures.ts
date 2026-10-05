import type { BoardView } from './board';
import { setScrollLock } from './safari';
import { store } from './store';
import type { BoardId, ZoneId } from './types';
import type { Topbar } from './ui/topbar';
import { prefersReducedMotion } from './util';

/**
 * Board input. Pencil only ever writes; fingers only ever move things.
 *
 *   Pencil on a card ............ open it for writing
 *   Pencil on empty column space  new note there, open for writing
 *   Finger tap on a card ......... open it (note info)
 *   Finger hold (still) .......... card lifts; keep holding → the bar fills → a to-do task
 *                                  starts (In progress); an in-progress one completes
 *   Finger hold, then move ....... drag: to another column, the other board's tab,
 *                                  the Backlog, or the Vault / hero (= complete)
 *   Finger swipe sideways ........ drag straight away
 *   Two-finger tap ............... undo
 *   Finger swipe up/down ......... scrolls the column (native)
 */

export interface GestureHost {
  openView(id: string): void;
  openWrite(id: string): void;
  newNoteAt(zone: ZoneId): void;
  complete(id: string, from: DOMRect | null): void;
  start(id: string): void;
  move(id: string, dest: { board?: BoardId; zone?: ZoneId; index?: number }): void;
  undo(): void;
  sheetOpen(): boolean;
  heroRect(): DOMRect | null;
}

const LIFT_MS = 280;
const COMPLETE_MS = 820;
const SLOP = 10;

type DropTarget =
  | { kind: 'column'; zone: ZoneId }
  | { kind: 'tab'; board: BoardId }
  | { kind: 'vault' }
  | { kind: 'backlog' }
  | { kind: 'hero' }
  | null;

interface Press {
  pointerId: number;
  id: string;
  card: HTMLElement;
  sx: number;
  sy: number;
  x: number;
  y: number;
  t0: number;
  lifted: boolean;
  liftTimer: number;
  doneTimer: number;
}

interface Drag {
  pointerId: number;
  id: string;
  card: HTMLElement;
  ghost: HTMLElement;
  offX: number;
  offY: number;
  target: DropTarget;
  index: number;
  scroll: number;
}

export class Gestures {
  private press: Press | null = null;
  private drag: Drag | null = null;
  private touches = new Map<number, { sx: number; sy: number; t0: number }>();
  private twoTap: { t0: number; ok: boolean } | null = null;
  private hoverCard: HTMLElement | null = null;

  constructor(
    root: HTMLElement,
    private board: BoardView,
    private top: Topbar,
    private host: GestureHost,
  ) {
    root.addEventListener('pointerdown', this.onDown);
    root.addEventListener('pointermove', this.onMove);
    root.addEventListener('pointerup', this.onUp);
    root.addEventListener('pointercancel', this.onCancel);
    root.addEventListener('pointerleave', () => this.setHover(null));
  }

  private isPen(e: PointerEvent) {
    return e.pointerType === 'pen';
  }

  // ---- dispatch -------------------------------------------------------------------------

  private onDown = (e: PointerEvent) => {
    if (this.host.sheetOpen()) return;
    const target = e.target as HTMLElement;
    if (target.closest('button:not(.qb-card)')) return; // real buttons handle their own clicks

    if (this.isPen(e)) {
      this.setHover(null);
      const card = target.closest<HTMLElement>('.qb-card');
      if (card?.dataset.id) {
        e.preventDefault();
        this.host.openWrite(card.dataset.id);
        return;
      }
      const col = target.closest<HTMLElement>('.qb-col');
      if (col?.dataset.zone && target.closest('.qb-col-scroll')) {
        e.preventDefault();
        this.host.newNoteAt(col.dataset.zone as ZoneId);
      }
      return;
    }

    // Finger (or mouse)
    this.touches.set(e.pointerId, { sx: e.clientX, sy: e.clientY, t0: performance.now() });
    if (this.touches.size === 2 && !this.drag) {
      this.cancelPress();
      const first = [...this.touches.values()][0];
      this.twoTap = { t0: first.t0, ok: performance.now() - first.t0 < 260 };
      return;
    }
    if (this.touches.size > 2 && this.twoTap) this.twoTap.ok = false;
    if (this.touches.size !== 1 || this.drag) return;

    const card = target.closest<HTMLElement>('.qb-card');
    if (!card?.dataset.id) return;
    if (e.pointerType === 'mouse') e.preventDefault();
    const p: Press = {
      pointerId: e.pointerId,
      id: card.dataset.id,
      card,
      sx: e.clientX,
      sy: e.clientY,
      x: e.clientX,
      y: e.clientY,
      t0: performance.now(),
      lifted: false,
      liftTimer: 0,
      doneTimer: 0,
    };
    p.liftTimer = window.setTimeout(() => this.lift(p), LIFT_MS);
    this.press = p;
  };

  private onMove = (e: PointerEvent) => {
    if (this.isPen(e)) {
      if (e.buttons === 0) this.setHover((e.target as HTMLElement).closest<HTMLElement>('.qb-card'));
      return;
    }
    const t = this.touches.get(e.pointerId);
    if (this.twoTap && t && Math.hypot(e.clientX - t.sx, e.clientY - t.sy) > 14) this.twoTap.ok = false;

    if (this.drag && e.pointerId === this.drag.pointerId) {
      this.moveDrag(e.clientX, e.clientY);
      return;
    }
    const p = this.press;
    if (!p || e.pointerId !== p.pointerId) return;
    p.x = e.clientX;
    p.y = e.clientY;
    const dx = p.x - p.sx;
    const dy = p.y - p.sy;
    const dist = Math.hypot(dx, dy);
    if (p.lifted) {
      if (dist > 8) this.startDrag(p);
      return;
    }
    // Sideways swipe: drag right away (vertical moves are left to native scrolling).
    if (Math.abs(dx) > 14 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      this.startDrag(p);
      return;
    }
    if (dist > SLOP) {
      if (e.pointerType === 'mouse') this.startDrag(p);
      else this.cancelPress();
    }
  };

  private onUp = (e: PointerEvent) => {
    if (this.isPen(e)) return;
    this.touches.delete(e.pointerId);
    if (this.twoTap && this.touches.size === 0) {
      const ok = this.twoTap.ok && performance.now() - this.twoTap.t0 < 380;
      this.twoTap = null;
      if (ok) this.host.undo();
      return;
    }
    if (this.drag && e.pointerId === this.drag.pointerId) {
      this.endDrag(true);
      return;
    }
    const p = this.press;
    if (!p || e.pointerId !== p.pointerId) return;
    const quick = !p.lifted && performance.now() - p.t0 < LIFT_MS + 60;
    this.cancelPress();
    if (quick) this.host.openView(p.id);
  };

  private onCancel = (e: PointerEvent) => {
    this.touches.delete(e.pointerId);
    if (this.drag && e.pointerId === this.drag.pointerId) this.endDrag(false);
    else if (this.press && e.pointerId === this.press.pointerId) this.cancelPress();
    this.twoTap = null;
  };

  // ---- hold → lift → start / complete ---------------------------------------------------------------

  private lift(p: Press) {
    if (this.press !== p) return;
    p.lifted = true;
    setScrollLock(true); // the finger now owns this card; stop the column scrolling
    p.card.classList.add('lifted');
    if (prefersReducedMotion()) p.card.classList.add('rm');
    const note = store.get(p.id);
    if (note?.status === 'active') {
      // Two steps: hold a to-do task to start it, hold an in-progress one to complete it.
      const starting = !note.startedAt;
      p.card.classList.add('holding');
      if (starting) p.card.classList.add('to-start');
      p.doneTimer = window.setTimeout(() => {
        if (this.press !== p) return;
        const rect = p.card.getBoundingClientRect();
        this.cancelPress();
        if (starting) this.host.start(p.id);
        else this.host.complete(p.id, rect);
      }, COMPLETE_MS - LIFT_MS);
    }
  }

  private cancelPress() {
    const p = this.press;
    if (!p) return;
    clearTimeout(p.liftTimer);
    clearTimeout(p.doneTimer);
    p.card.classList.remove('lifted', 'holding', 'to-start', 'rm');
    this.press = null;
    if (!this.drag) setScrollLock(false);
  }

  // ---- drag ----------------------------------------------------------------------------------

  private startDrag(p: Press) {
    const rect = p.card.getBoundingClientRect();
    clearTimeout(p.liftTimer);
    clearTimeout(p.doneTimer);
    p.card.classList.remove('holding', 'to-start', 'lifted', 'rm');
    this.press = null;
    setScrollLock(true);
    const card = this.board.card(p.id);
    const ghost = card ? card.ghost() : (p.card.cloneNode(true) as HTMLElement);
    ghost.classList.add('qb-ghost');
    ghost.classList.remove('holding', 'to-start', 'lifted');
    ghost.style.width = rect.width + 'px';
    ghost.style.height = rect.height + 'px';
    document.body.append(ghost);
    p.card.classList.add('dragging-source');
    this.drag = {
      pointerId: p.pointerId,
      id: p.id,
      card: p.card,
      ghost,
      offX: p.sx - rect.left,
      offY: p.sy - rect.top,
      target: null,
      index: 0,
      scroll: 0,
    };
    this.moveDrag(p.x, p.y);
    this.autoScroll();
  }

  private targetAt(x: number, y: number): DropTarget {
    if (this.top.vaultAt(x, y)) return { kind: 'vault' };
    if (this.top.backlogAt(x, y)) return { kind: 'backlog' };
    const tab = this.top.tabAt(x, y);
    if (tab) return tab === this.board.board ? null : { kind: 'tab', board: tab };
    const hero = this.host.heroRect();
    if (hero && x >= hero.left && x <= hero.right && y >= hero.top && y <= hero.bottom && !this.board.drawerOpen) return { kind: 'hero' };
    const zone = this.board.columnAt(x, y);
    return zone ? { kind: 'column', zone } : null;
  }

  private moveDrag(x: number, y: number) {
    const d = this.drag!;
    d.ghost.style.transform = `translate(${x - d.offX}px, ${y - d.offY}px) rotate(-3deg) scale(1.04)`;
    d.target = this.targetAt(x, y);
    this.board.setDropColumn(d.target?.kind === 'column' ? d.target.zone : null);
    this.top.setDropHover(
      d.target?.kind === 'vault' ? 'vault' : d.target?.kind === 'backlog' ? 'backlog' : d.target?.kind === 'tab' ? d.target.board : null,
    );
    document.querySelector('.qb-hero')?.classList.toggle('drop-hover', d.target?.kind === 'hero');
    if (d.target?.kind === 'column') d.index = this.board.insertIndex(d.target.zone, x, y, d.id);
    (d as Drag & { x?: number; y?: number }).x = x;
    (d as Drag & { x?: number; y?: number }).y = y;
  }

  /** Scroll a column while a card is held near its top or bottom edge. */
  private autoScroll() {
    const step = () => {
      const d = this.drag as (Drag & { x?: number; y?: number }) | null;
      if (!d) return;
      if (d.target?.kind === 'column' && d.y !== undefined) {
        const sc = this.board.scrollerFor(d.target.zone);
        const r = sc.getBoundingClientRect();
        const edge = 60;
        if (d.y < r.top + edge) sc.scrollTop -= ((r.top + edge - d.y) / edge) * 14;
        else if (d.y > r.bottom - edge) sc.scrollTop += ((d.y - (r.bottom - edge)) / edge) * 14;
      }
      d.scroll = requestAnimationFrame(step);
    };
    this.drag!.scroll = requestAnimationFrame(step);
  }

  private endDrag(commit: boolean) {
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    cancelAnimationFrame(d.scroll);
    setScrollLock(false);
    this.board.setDropColumn(null);
    this.top.setDropHover(null);
    document.querySelector('.qb-hero')?.classList.remove('drop-hover');
    d.card.classList.remove('dragging-source');
    const ghostRect = d.ghost.getBoundingClientRect();
    d.ghost.remove();
    if (!commit || !d.target) return;
    const t = d.target;
    if (t.kind === 'vault' || t.kind === 'hero') this.host.complete(d.id, ghostRect);
    else if (t.kind === 'backlog') this.host.move(d.id, { zone: 'someday' });
    else if (t.kind === 'tab') this.host.move(d.id, { board: t.board });
    else this.host.move(d.id, { zone: t.zone, index: d.index });
  }

  // ---- pencil hover --------------------------------------------------------------------------

  private setHover(card: HTMLElement | null) {
    if (card === this.hoverCard) return;
    this.hoverCard?.classList.remove('pen-hover');
    this.hoverCard = card;
    card?.classList.add('pen-hover');
  }
}
