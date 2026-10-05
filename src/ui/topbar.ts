import { avatarSvg } from '../avatar';
import { BOARDS, BOARD_LABEL, type BoardId, type Look } from '../types';
import { el } from '../util';
import type { Stats } from '../xp';

const ICON = {
  flame:
    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FF9A3C" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-4 2.5-5 .5 2 1.5 3 2.5 3 0-3-1-5 0-8z"/></svg>',
  vault:
    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFE14D" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11V9a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v2"/><rect x="3" y="11" width="18" height="9" rx="1"/><path d="M10 11v3h4v-3"/></svg>',
  backlog:
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3BE0FF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="16" height="5" rx="1"/><rect x="4" y="11" width="16" height="9" rx="1"/><path d="M10 15h4"/></svg>',
  undo: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></svg>',
  settings:
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/></svg>',
};

function skewButton(cls: string, label: string, onClick: () => void): HTMLButtonElement {
  const b = el('button', 'qb-skew ' + cls);
  b.type = 'button';
  b.addEventListener('click', onClick);
  if (label) {
    const s = el('span', '', label);
    b.append(s);
  }
  return b;
}

export interface TopbarHandlers {
  onTab(b: BoardId): void;
  onBacklog(): void;
  onVault(): void;
  onUndo(): void;
  onSettings(): void;
  onHero(): void;
  onLevel(): void;
}

export class Topbar {
  readonly el: HTMLElement;
  private tabs = new Map<BoardId, HTMLButtonElement>();
  private hex: HTMLElement;
  private levelLabel: HTMLElement;
  private xpInto: HTMLElement;
  private xpNeed: HTMLElement;
  private heroBadge: HTMLElement;
  private fill: HTMLElement;
  private streakNum: HTMLElement;
  private vaultNum: HTMLElement;
  private backlogNum: HTMLElement;
  private heroMini: HTMLButtonElement;
  private lastLevel = 0;

  constructor(parent: HTMLElement, h: TopbarHandlers) {
    this.el = el('header', 'qb-top');
    const nav = el('nav', 'qb-tabs');
    nav.setAttribute('aria-label', 'Boards');
    for (const b of BOARDS) {
      const t = skewButton('qb-tab', BOARD_LABEL[b], () => h.onTab(b));
      t.dataset.board = b;
      this.tabs.set(b, t);
      nav.append(t);
    }

    const level = el('button', 'qb-level');
    level.type = 'button';
    level.setAttribute('aria-label', 'Level and XP — open the Reward Track');
    level.addEventListener('click', h.onLevel);
    this.hex = el('div', 'qb-hex qb-levelhex', '1');
    this.hex.setAttribute('aria-hidden', 'true');
    const lvlText = el('div', 'qb-level-text');
    const row = el('div', 'qb-level-row');
    this.levelLabel = el('span', 'qb-level-label', 'Level 1');
    const xpSpan = el('span', 'qb-level-xp');
    this.xpInto = el('span', '', '0');
    this.xpNeed = el('span', 'dim', ' / 300 XP');
    xpSpan.append(this.xpInto, this.xpNeed);
    row.append(this.levelLabel, xpSpan);
    const bar = el('div', 'qb-xpbar');
    this.fill = el('div', 'qb-xpbar-fill');
    bar.append(this.fill, el('div', 'qb-xpbar-ticks'));
    lvlText.append(row, bar);
    level.append(this.hex, lvlText);

    const streak = el('div', 'qb-skew qb-streak');
    const sIn = el('span', 'qb-streak-in');
    sIn.innerHTML = ICON.flame;
    this.streakNum = el('span', 'qb-streak-num', '0');
    const sLbl = el('span', 'qb-streak-label');
    sLbl.innerHTML = 'Day<br>Streak';
    sIn.append(this.streakNum, sLbl);
    streak.append(sIn);

    this.heroMini = el('button', 'qb-skew qb-heromini');
    this.heroMini.type = 'button';
    this.heroMini.setAttribute('aria-label', 'Your hero — open Locker');
    this.heroMini.addEventListener('click', h.onHero);
    this.heroBadge = el('i', 'qb-badge');
    this.heroBadge.hidden = true;

    const backlog = el('button', 'qb-skew qb-chipbtn qb-backlog');
    backlog.type = 'button';
    backlog.setAttribute('aria-label', 'Open backlog (someday notes)');
    const bIn = el('span', 'qb-chip-in');
    bIn.innerHTML = ICON.backlog;
    this.backlogNum = el('span', 'qb-chip-num', '0');
    bIn.append(el('span', 'qb-chip-label', 'Backlog'), this.backlogNum);
    backlog.append(bIn);
    backlog.addEventListener('click', h.onBacklog);

    const vault = el('button', 'qb-skew qb-chipbtn qb-vault');
    vault.type = 'button';
    vault.setAttribute('aria-label', 'Open vault of completed notes');
    const vIn = el('span', 'qb-chip-in');
    vIn.innerHTML = ICON.vault;
    this.vaultNum = el('span', 'qb-chip-num', '0');
    vIn.append(el('span', 'qb-chip-label', 'Vault'), this.vaultNum);
    vault.append(vIn);
    vault.addEventListener('click', h.onVault);

    const undo = skewButton('qb-iconbtn', '', h.onUndo);
    undo.innerHTML = `<span>${ICON.undo}</span>`;
    undo.setAttribute('aria-label', 'Undo (or tap with two fingers)');
    const settings = skewButton('qb-iconbtn', '', h.onSettings);
    settings.innerHTML = `<span>${ICON.settings}</span>`;
    settings.setAttribute('aria-label', 'Settings');

    this.el.append(nav, level, streak, el('div', 'qb-flex'), this.heroMini, backlog, vault, undo, settings);
    parent.append(this.el);
  }

  setBoard(b: BoardId) {
    for (const [id, t] of this.tabs) {
      t.classList.toggle('active', id === b);
      t.setAttribute('aria-pressed', String(id === b));
    }
  }

  /** Returns true when this update crossed into a new level. */
  setStats(s: Stats, vaultCount: number): boolean {
    this.hex.textContent = String(s.level);
    this.levelLabel.textContent = `Level ${s.level}`;
    this.xpInto.textContent = String(s.into);
    this.xpNeed.textContent = ` / ${s.need} XP`;
    this.fill.style.width = `${(s.into / s.need) * 100}%`;
    this.streakNum.textContent = String(s.streak);
    this.vaultNum.textContent = String(vaultCount);
    const leveled = this.lastLevel > 0 && s.level > this.lastLevel;
    this.lastLevel = s.level;
    if (leveled) {
      this.hex.classList.remove('qb-levelup');
      void this.hex.offsetWidth;
      this.hex.classList.add('qb-levelup');
    }
    return leveled;
  }

  setBacklogCount(n: number) {
    this.backlogNum.textContent = String(n);
  }

  setHero(look: Look) {
    this.heroMini.innerHTML = `<span>${avatarSvg({ ...look, lite: true }, { width: 36 })}</span>`;
    this.heroMini.append(this.heroBadge);
  }

  setBadge(n: number) {
    this.heroBadge.hidden = n === 0;
    this.heroBadge.textContent = String(n);
  }

  /** Drop targets while dragging a card. */
  tabAt(x: number, y: number): BoardId | null {
    for (const [b, t] of this.tabs) if (inside(t, x, y, 8)) return b;
    return null;
  }

  vaultAt(x: number, y: number) {
    return inside(this.el.querySelector('.qb-vault')!, x, y, 10);
  }

  backlogAt(x: number, y: number) {
    return inside(this.el.querySelector('.qb-backlog')!, x, y, 10);
  }

  setDropHover(target: 'vault' | 'backlog' | BoardId | null) {
    for (const [b, t] of this.tabs) t.classList.toggle('drop-hover', target === b);
    this.el.querySelector('.qb-vault')!.classList.toggle('drop-hover', target === 'vault');
    this.el.querySelector('.qb-backlog')!.classList.toggle('drop-hover', target === 'backlog');
  }

  pulse(target: 'vault' | BoardId) {
    const node = target === 'vault' ? this.el.querySelector<HTMLElement>('.qb-vault') : this.tabs.get(target);
    if (!node) return;
    node.classList.remove('qb-pulse');
    void node.offsetWidth;
    node.classList.add('qb-pulse');
  }

  vaultCenter() {
    const r = this.el.querySelector('.qb-vault')!.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  levelCenter() {
    const r = this.hex.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
}

function inside(node: Element, x: number, y: number, pad: number) {
  const r = node.getBoundingClientRect();
  return r.width > 0 && x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad;
}
