import { columnNotes } from './actions';
import { Card, type CardKind } from './card';
import type { BoardId, ZoneId } from './types';
import { el } from './util';

/**
 * The board: Today and This week as columns of card grids, plus the Backlog (Someday)
 * panel that slides in from the left. Cards are keyed by task id and reused.
 */

export type NewMode = 'write' | 'speak' | 'photo';

import { SMALL } from './ui/icons';

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
    this.main.append(this.column('today', 'Today').section, this.column('week', 'This week').section);
    parent.append(this.main);

    // Backlog drawer (Someday notes)
    this.drawer = el('aside', 'qb-drawer');
    this.drawer.setAttribute('aria-label', 'Backlog');
    const col = this.column('someday', 'Backlog', true);
    const close = el('button', 'qb-iconbtn qb-drawer-close');
    close.type = 'button';
    close.innerHTML = SMALL.x;
    close.setAttribute('aria-label', 'Close backlog');
    close.addEventListener('click', () => this.setDrawer(false));
    col.section.querySelector('.qb-col-head')!.append(close);
    this.drawer.append(col.section);
    parent.append(this.drawer);
  }

  private column(zone: ZoneId, title: string, inDrawer = false): Column {
    const section = el('section', `qb-col col-${zone}`);
    section.dataset.zone = zone;
    section.setAttribute('aria-label', title);
    const head = el('div', 'qb-col-head');
    const count = el('span', 'qb-col-count');
    const sub = el('span', 'qb-col-sub');
    const add = el('button', 'qb-iconbtn');
    add.type = 'button';
    add.innerHTML = SMALL.plus;
    add.setAttribute('aria-label', `New task in ${title}`);
    add.addEventListener('click', () => this.h.newNote(zone, 'write'));
    head.append(el('h2', 'qb-col-title', title), count, sub, el('span', 'qb-flex'));
    if (!inDrawer) head.append(add);
    const scroller = el('div', 'qb-col-scroll');
    const grid = el('div', `qb-grid grid-${zone}`);
    scroller.append(grid);

    // "New task" row: write (tap anywhere), or straight into Speak / Photo.
    const tile = el('div', 'qb-newtile');
    const main = el('button', 'qb-newtile-main');
    main.type = 'button';
    main.innerHTML = `${SMALL.plus}<span>New task</span>`;
    main.addEventListener('click', () => this.h.newNote(zone, 'write'));
    const quick = el('div', 'qb-newtile-quick');
    const mic = el('button', 'qb-iconbtn');
    mic.type = 'button';
    mic.innerHTML = SMALL.mic;
    mic.setAttribute('aria-label', 'New spoken task — then tap the mic key on the keyboard');
    mic.addEventListener('click', () => this.h.newNote(zone, 'speak'));
    const cam = el('button', 'qb-iconbtn');
    cam.type = 'button';
    cam.innerHTML = SMALL.cam;
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
      const open = notes.filter((n) => n.status === 'active').length;
      col.count.textContent = open ? String(open) : '';
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

  /** The column subtitles: when Today's done tasks clear, and this week's dates. */
  updateClock() {
    const now = new Date();
    this.cols.get('today')!.sub.textContent = 'Done tasks clear at midnight';
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
