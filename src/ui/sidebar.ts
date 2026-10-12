import { avatarSvg } from '../avatar';
import { BOARD_LABEL, BOARDS, type BoardId, type Look } from '../types';
import { el } from '../util';
import type { Stats } from '../xp';

/**
 * The bar across the top: her name and avatar, the two boards, Backlog and Done, then
 * a small level + streak card (opens Profile) and Settings. Boards, Backlog and Done
 * are also drop targets for a dragged task.
 */

const svg = (d: string, size = 18) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

export const ICON = {
  backlog: svg('<path d="M3.5 13.5 6 5h12l2.5 8.5V19h-17z"/><path d="M3.5 13.5H8l1.5 2h5l1.5-2h4.5"/>'),
  done: svg('<circle cx="12" cy="12" r="8.5"/><path d="M8.3 12.2l2.6 2.6 5-5.3"/>'),
  settings: svg('<circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/>'),
  flame: '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.5c.9 3.9 5.4 5.1 5.4 10.2a5.4 5.4 0 0 1-10.8 0c0-2.6 1.5-4.1 2.6-5.1.4 2 1.5 3 2.5 3 0-3-.9-5 .3-8.1z"/></svg>',
};

const BOARD_DOT: Record<BoardId, string> = { work: 'var(--board-work)', personal: 'var(--board-personal)' };

export interface SidebarHandlers {
  onBoard(b: BoardId): void;
  onBacklog(): void;
  onDone(): void;
  onProfile(): void;
  onSettings(): void;
}

export type SidebarView = BoardId | 'profile';

export class Sidebar {
  readonly el: HTMLElement;
  private boards = new Map<BoardId, { btn: HTMLButtonElement; n: HTMLElement }>();
  private backlogBtn: HTMLButtonElement;
  private backlogN: HTMLElement;
  private doneBtn: HTMLButtonElement;
  private doneN: HTMLElement;
  private avatar: HTMLElement;
  private me: HTMLButtonElement;
  private levelText: HTMLElement;
  private streakText: HTMLElement;
  private fill: HTMLElement;
  private xpText: HTMLElement;
  private badge: HTMLElement;
  private lastLevel = 0;

  constructor(parent: HTMLElement, h: SidebarHandlers) {
    this.el = el('aside', 'qb-side');
    this.el.setAttribute('aria-label', 'Sidebar');

    const ws = el('button', 'qb-ws');
    ws.type = 'button';
    ws.setAttribute('aria-label', 'Moduuu — open Profile');
    ws.addEventListener('click', h.onProfile);
    this.avatar = el('span', 'qb-av');
    const name = el('span', 'qb-ws-text');
    name.append(el('span', 'qb-ws-name', 'Moduuu'), el('span', 'qb-ws-sub', 'Board'));
    ws.append(this.avatar, name);

    const nav = el('nav', 'qb-nav');
    nav.setAttribute('aria-label', 'Boards and lists');
    const boards = el('div', 'qb-nav-group');
    boards.append(el('span', 'qb-nav-label', 'Boards'));
    for (const b of BOARDS) {
      const btn = el('button', 'qb-nav-item');
      btn.type = 'button';
      btn.dataset.board = b;
      const dot = el('span', 'qb-nav-dot');
      dot.style.background = BOARD_DOT[b];
      const n = el('span', 'qb-nav-n');
      btn.append(dot, el('span', 'qb-nav-name', BOARD_LABEL[b]), n);
      btn.addEventListener('click', () => h.onBoard(b));
      this.boards.set(b, { btn, n });
      boards.append(btn);
    }
    const lists = el('div', 'qb-nav-group');
    lists.append(el('span', 'qb-nav-label', 'Lists'));
    this.backlogBtn = el('button', 'qb-nav-item qb-backlog');
    this.backlogBtn.type = 'button';
    this.backlogN = el('span', 'qb-nav-n');
    this.backlogBtn.innerHTML = ICON.backlog;
    this.backlogBtn.append(el('span', 'qb-nav-name', 'Backlog'), this.backlogN);
    this.backlogBtn.addEventListener('click', h.onBacklog);
    this.doneBtn = el('button', 'qb-nav-item qb-vault');
    this.doneBtn.type = 'button';
    this.doneN = el('span', 'qb-nav-n');
    this.doneBtn.innerHTML = ICON.done;
    this.doneBtn.append(el('span', 'qb-nav-name', 'Done'), this.doneN);
    this.doneBtn.addEventListener('click', h.onDone);
    lists.append(this.backlogBtn, this.doneBtn);
    nav.append(boards, lists);

    const foot = el('div', 'qb-side-foot');
    this.me = el('button', 'qb-me');
    this.me.type = 'button';
    this.me.addEventListener('click', h.onProfile);
    const top = el('span', 'qb-me-top');
    this.levelText = el('b', '', 'Level 1');
    this.streakText = el('span', 'qb-me-streak');
    top.append(this.levelText, this.streakText);
    const bar = el('span', 'qb-bar');
    this.fill = el('i');
    bar.append(this.fill);
    this.xpText = el('small', 'qb-me-xp');
    this.badge = el('i', 'qb-badge');
    this.badge.hidden = true;
    this.me.append(top, bar, this.xpText, this.badge);
    const settings = el('button', 'qb-nav-item');
    settings.type = 'button';
    settings.innerHTML = ICON.settings;
    settings.append(el('span', 'qb-nav-name', 'Settings'));
    settings.addEventListener('click', h.onSettings);
    foot.append(this.me, settings);

    this.el.append(ws, nav, foot);
    parent.append(this.el);
  }

  /** Which page is showing: a board or Profile. */
  setView(v: SidebarView) {
    for (const [b, { btn }] of this.boards) {
      btn.classList.toggle('on', v === b);
      btn.setAttribute('aria-current', v === b ? 'page' : 'false');
    }
    this.me.classList.toggle('on', v === 'profile');
  }

  setBacklogOpen(open: boolean) {
    this.backlogBtn.classList.toggle('on', open);
    this.backlogBtn.setAttribute('aria-pressed', String(open));
  }

  setCounts(counts: Record<BoardId, number>, backlog: number, done: number) {
    for (const [b, { n }] of this.boards) n.textContent = counts[b] ? String(counts[b]) : '';
    this.backlogN.textContent = backlog ? String(backlog) : '';
    this.doneN.textContent = done ? String(done) : '';
  }

  /** Returns true when this update crossed into a new level. */
  setStats(s: Stats): boolean {
    this.levelText.textContent = `Level ${s.level}`;
    this.streakText.innerHTML = s.streak ? `${ICON.flame}<span>${s.streak} day${s.streak === 1 ? '' : 's'}</span>` : '';
    this.fill.style.width = `${(s.into / s.need) * 100}%`;
    this.xpText.textContent = `${s.into} / ${s.need} XP`;
    this.me.setAttribute('aria-label', `Level ${s.level}, ${s.into} of ${s.need} XP${s.streak ? `, ${s.streak}-day streak` : ''}. Open Profile.`);
    const leveled = this.lastLevel > 0 && s.level > this.lastLevel;
    this.lastLevel = s.level;
    return leveled;
  }

  setHero(look: Look) {
    this.avatar.innerHTML = avatarSvg({ ...look, lite: true }, { width: 60 });
  }

  /** NEW rewards waiting in the Locker. */
  setBadge(n: number) {
    this.badge.hidden = n === 0;
    this.badge.textContent = String(n);
  }

  // ---- drop targets while dragging a card -------------------------------------------------

  tabAt(x: number, y: number): BoardId | null {
    for (const [b, { btn }] of this.boards) if (inside(btn, x, y, 4)) return b;
    return null;
  }

  vaultAt(x: number, y: number) {
    return inside(this.doneBtn, x, y, 4);
  }

  backlogAt(x: number, y: number) {
    return inside(this.backlogBtn, x, y, 4);
  }

  setDropHover(target: 'vault' | 'backlog' | BoardId | null) {
    for (const [b, { btn }] of this.boards) btn.classList.toggle('drop-hover', target === b);
    this.doneBtn.classList.toggle('drop-hover', target === 'vault');
    this.backlogBtn.classList.toggle('drop-hover', target === 'backlog');
  }

  pulse(target: 'vault' | BoardId) {
    const node = target === 'vault' ? this.doneBtn : this.boards.get(target)?.btn;
    if (!node) return;
    node.classList.remove('qb-pulse');
    void node.offsetWidth;
    node.classList.add('qb-pulse');
  }
}

function inside(node: Element, x: number, y: number, pad: number) {
  const r = node.getBoundingClientRect();
  return r.width > 0 && x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad;
}
