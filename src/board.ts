import { columnNotes } from './actions';
import { Card, type CardKind } from './card';
import type { BoardId, ZoneId } from './types';
import { el } from './util';

/**
 * The board: Today (Daily Quests) and This Week (Weekly Challenges) as panels of card
 * grids, plus the Backlog (Someday) drawer. Cards are keyed by note id and reused.
 */

export type NewMode = 'write' | 'speak' | 'photo';

const PLUS =
  '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#DCE6FF" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
const MIC =
  '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';
const CAM =
  '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>';
const CLOCK =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#B9C8EA" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
const CLOSE =
  '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

interface Column {
  zone: ZoneId;
  section: HTMLElement;
  scroller: HTMLElement;
  grid: HTMLElement;
  tile: HTMLElement;
  count: HTMLElement;
  sub: HTMLElement;
}

export interface BoardHandlers {
  newNote(zone: ZoneId, mode: NewMode): void;
  drawerChanged(open: boolean): void;
}

export class BoardView {
  readonly main: HTMLElement;
  readonly drawer: HTMLElement;
  private cols = new Map<ZoneId, Column>();
  private cards = new Map<string, Card>();
  board: BoardId = 'work';

  constructor(parent: HTMLElement, private h: BoardHandlers) {
    this.main = el('main', 'qb-main');
    this.main.append(
      this.column('today', 'Daily Quests', 'Today').section,
      this.column('week', 'Weekly Challenges', 'This Week').section,
    );
    parent.append(this.main);

    // Backlog drawer (Someday notes)
    this.drawer = el('aside', 'qb-drawer');
    this.drawer.setAttribute('aria-label', 'Backlog');
    const col = this.column('someday', 'Someday', 'Backlog', true);
    const close = el('button', 'qb-skew qb-iconbtn qb-drawer-close');
    close.type = 'button';
    close.innerHTML = `<span>${CLOSE}</span>`;
    close.setAttribute('aria-label', 'Close backlog');
    close.addEventListener('click', () => this.setDrawer(false));
    col.section.querySelector('.qb-col-head')!.append(close);
    this.drawer.append(col.section);
    parent.append(this.drawer);
  }

  private column(zone: ZoneId, eyebrow: string, title: string, inDrawer = false): Column {
    const section = el('section', `qb-panel qb-cut qb-col col-${zone}`);
    section.dataset.zone = zone;
    const head = el('div', 'qb-col-head');
    const left = el('div', 'qb-col-title');
    const eb = el('span', 'qb-eyebrow', eyebrow);
    if (zone === 'week') eb.classList.add('cyan');
    left.append(eb, el('h2', 'qb-display qb-h2', title));
    const right = el('div', 'qb-col-meta');
    const count = el('span', 'qb-col-count');
    const sub = el('span', 'qb-col-sub');
    right.append(count, sub);
    head.append(left);
    if (!inDrawer) head.append(right);
    const scroller = el('div', 'qb-col-scroll');
    const grid = el('div', `qb-grid grid-${zone}`);
    scroller.append(grid);

    const tile = el('div', 'qb-newtile');
    const main = el('button', 'qb-newtile-main');
    main.type = 'button';
    main.innerHTML = `${PLUS}<span>New Task</span>`;
    main.addEventListener('click', () => this.h.newNote(zone, 'write'));
    const quick = el('div', 'qb-newtile-quick');
    const mic = el('button', 'qb-quick');
    mic.type = 'button';
    mic.innerHTML = MIC;
    mic.setAttribute('aria-label', 'New voice task — then tap the mic key on the keyboard');
    mic.addEventListener('click', () => this.h.newNote(zone, 'speak'));
    const cam = el('button', 'qb-quick');
    cam.type = 'button';
    cam.innerHTML = CAM;
    cam.setAttribute('aria-label', 'New photo task');
    cam.addEventListener('click', () => this.h.newNote(zone, 'photo'));
    quick.append(mic, cam);
    tile.append(main, quick);
    grid.append(tile);

    section.append(head, scroller);
    const c: Column = { zone, section, scroller, grid, tile, count, sub };
    this.cols.set(zone, c);
    return c;
  }

  setDrawer(open: boolean) {
    if (open === this.drawerOpen) return;
    this.drawer.classList.toggle('open', open);
    this.h.drawerChanged(open);
  }

  get drawerOpen() {
    return this.drawer.classList.contains('open');
  }

  // ---- rendering ----------------------------------------------------------------------

  render() {
    const seen = new Set<string>();
    const now = Date.now();
    for (const [zone, col] of this.cols) {
      const notes = columnNotes(this.board, zone, now);
      const kind: CardKind = zone;
      if (col.grid.firstElementChild !== col.tile) col.grid.prepend(col.tile);
      notes.forEach((n, i) => {
        seen.add(n.id);
        let card = this.cards.get(n.id);
        if (!card) {
          card = new Card(n, kind);
          this.cards.set(n.id, card);
        } else if (card.note !== n || card.kind !== kind) {
          card.update(n, kind);
        }
        // Keep DOM order = note order, after the new-note tile (which comes first).
        const at = col.grid.children[i + 1];
        if (at !== card.el) col.grid.insertBefore(card.el, at ?? null);
      });
      if (zone !== 'someday') {
        const done = notes.filter((n) => n.status === 'done').length;
        col.count.replaceChildren(String(done), el('span', 'dim', ` / ${notes.length} Complete`));
      }
    }
    for (const [id, card] of this.cards) {
      if (!seen.has(id)) {
        card.el.remove();
        card.destroy();
        this.cards.delete(id);
      }
    }
    this.updateClock();
  }

  /** "Resets in 9h 12m" and the week's date range. */
  updateClock() {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const mins = Math.max(0, Math.ceil((midnight.getTime() - now.getTime()) / 60000));
    this.cols.get('today')!.sub.innerHTML = `${CLOCK}<span>Resets in ${Math.floor(mins / 60)}h ${mins % 60}m</span>`;
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const f = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    this.cols.get('week')!.sub.textContent = `${f(monday)} – ${f(sunday)}`;
  }

  card(id: string) {
    return this.cards.get(id);
  }

  /** A new day: refresh age chips and "Next Mon" labels. */
  refreshDay() {
    for (const c of this.cards.values()) c.refreshDay();
    this.updateClock();
  }

  /** Redraw every card (e.g. once the text font has loaded). */
  redrawAll() {
    for (const c of this.cards.values()) c.render();
  }

  someCount() {
    return columnNotes(this.board, 'someday').filter((n) => n.status === 'active').length;
  }

  // ---- hit testing (for gestures) ---------------------------------------------------------

  /** Column under a point; the drawer (on top) wins when it's open. */
  columnAt(x: number, y: number): ZoneId | null {
    const cols = [...this.cols.values()].filter((c) => (c.zone === 'someday' ? this.drawerOpen : c.section.offsetParent !== null));
    cols.sort((a) => (a.zone === 'someday' ? -1 : 1));
    for (const c of cols) {
      const r = c.section.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return c.zone;
    }
    return null;
  }

  scrollerFor(zone: ZoneId) {
    return this.cols.get(zone)!.scroller;
  }

  /** Where a dragged card would land among a column's other cards. */
  insertIndex(zone: ZoneId, x: number, y: number, excludeId: string): number {
    const col = this.cols.get(zone)!;
    const cards = [...col.grid.querySelectorAll<HTMLElement>('.qb-card')].filter((c) => c.dataset.id !== excludeId);
    for (let i = 0; i < cards.length; i++) {
      const r = cards[i].getBoundingClientRect();
      if (y < r.top) return i;
      if (y <= r.bottom && x < r.left + r.width / 2) return i;
    }
    return cards.length;
  }

  setDropColumn(zone: ZoneId | null) {
    for (const c of this.cols.values()) c.section.classList.toggle('drop-hover', c.zone === zone);
  }
}
