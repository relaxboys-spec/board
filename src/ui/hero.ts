import { avatarSvg } from '../avatar';
import { EMOTES, emoteById, playEmote } from '../emotes';
import type { EmoteId, Look } from '../types';
import { el, prefersReducedMotion } from '../util';

/**
 * The board's hero column (Main.dc.html): Nova at 1.25× on her stand, the status line,
 * Locker and Emotes. Completing a quest plays her ★ victory emote with confetti, the
 * ring and the XP pop.
 */

const LOCKER =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3l4 3 4-3 5 4-3 4h-2v10H8V11H6L3 7z"/></svg>';
const SMILE =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M9 9h.01M15 9h.01"/></svg>';
const CLOSE =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

const CONF_C = ['#FFE14D', '#3BE0FF', '#FF6FAE', '#7CF59A', '#D06BFF', '#FFFFFF'];

/** The celebration layer: ring + 16 confetti + "+XP" pop (tokens.css av-ring / av-conf / av-pop). */
export function celebrationLayer(label: string): HTMLElement {
  const layer = el('div', 'qb-celebrate');
  layer.setAttribute('aria-hidden', 'true');
  layer.append(el('div', 'av-ring qb-ring'));
  for (let i = 0; i < 16; i++) {
    const wrap = el('span', 'qb-conf-wrap');
    wrap.style.transform = `rotate(${i * 22.5 - 90 + (i % 2 ? 6 : -6)}deg)`;
    const piece = el('span', 'av-conf qb-conf');
    piece.style.width = (i % 3 === 0 ? 10 : 7) + 'px';
    piece.style.height = (i % 3 === 0 ? 5 : 12) + 'px';
    piece.style.background = CONF_C[i % CONF_C.length];
    piece.style.animationDelay = (i % 4) * 0.04 + 's';
    wrap.append(piece);
    layer.append(wrap);
  }
  layer.append(el('span', 'av-pop qb-pop', label));
  return layer;
}

export class Hero {
  readonly el: HTMLElement;
  private stage: HTMLElement;
  private figure: HTMLElement;
  private line: HTMLElement;
  private list: HTMLElement | null = null;
  private look: Look | null = null;
  private victory: EmoteId = 'victory';
  private celebrateTimer: number | undefined;
  private floatTimer: number | undefined;
  private lockerBadge: HTMLElement;

  constructor(parent: HTMLElement, h: { onLocker(): void }) {
    this.el = el('section', 'qb-hero');
    this.el.setAttribute('aria-label', 'Hello Moduuu');
    const head = el('div', 'qb-hero-head');
    head.append(el('span', 'qb-eyebrow', 'Hello'), el('span', 'qb-hero-name', 'Moduuu'));
    this.stage = el('div', 'qb-hero-stage');
    this.stage.append(el('div', 'qb-beam'), el('div', 'qb-pedestal'));
    const holder = el('div', 'qb-figure-holder');
    this.figure = el('div', 'qb-figure av-idle');
    holder.append(this.figure);
    this.stage.append(holder);
    this.line = el('div', 'qb-hero-line', 'Ready for action');
    this.line.setAttribute('aria-live', 'polite');
    const btns = el('div', 'qb-hero-btns');
    const locker = el('button', 'qb-skew qb-herobtn');
    locker.type = 'button';
    locker.innerHTML = `<span>${LOCKER}Locker</span>`;
    locker.addEventListener('click', h.onLocker);
    this.lockerBadge = el('i', 'qb-badge');
    this.lockerBadge.hidden = true;
    locker.append(this.lockerBadge);
    const emotes = el('button', 'qb-skew qb-herobtn');
    emotes.type = 'button';
    emotes.innerHTML = `<span>${SMILE}Emotes</span>`;
    emotes.addEventListener('click', () => (this.list ? this.closeList() : this.openList()));
    btns.append(locker, emotes);
    this.el.append(head, this.stage, this.line, btns);
    parent.append(this.el);
  }

  setLook(look: Look, victory: EmoteId) {
    this.look = look;
    this.victory = victory;
    this.figure.innerHTML = avatarSvg(look, { width: 250 });
    if (this.list) this.openList(); // refresh the ★
  }

  /** NEW rewards waiting in the Locker. */
  setBadge(n: number) {
    this.lockerBadge.hidden = n === 0;
    this.lockerBadge.textContent = String(n);
  }

  /** Play an emote (no confetti). */
  play(id: EmoteId) {
    this.stage.querySelector('.qb-celebrate')?.remove();
    clearTimeout(this.celebrateTimer);
    this.setLine(emoteById(id).name, false);
    playEmote(this.figure, id, () => this.setLine('Ready for action', false));
  }

  /** Completing a quest: ★ victory emote + confetti + ring + XP pop. Floats in a corner if the column is hidden. */
  celebrate(xp: number) {
    const label = xp ? `+${xp} XP` : 'GG!';
    if (this.el.offsetParent === null) {
      this.floating(label);
      return;
    }
    this.closeList();
    this.setLine('Quest complete!', true);
    this.stage.querySelector('.qb-celebrate')?.remove();
    if (!prefersReducedMotion()) this.stage.append(celebrationLayer(label));
    clearTimeout(this.celebrateTimer);
    const ms = emoteById(this.victory).ms;
    playEmote(this.figure, this.victory, () => {
      this.stage.querySelector('.qb-celebrate')?.remove();
      this.setLine('Ready for action', false);
    });
    // The confetti layer finishes on its own even if the emote is shorter.
    this.celebrateTimer = window.setTimeout(() => this.stage.querySelector('.qb-celebrate')?.remove(), Math.max(ms, 1700) + 250);
  }

  private setLine(text: string, done: boolean) {
    this.line.textContent = text;
    this.line.classList.toggle('done', done);
  }

  private openList() {
    this.list?.remove();
    const panel = el('div', 'qb-emotelist');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Emotes');
    const head = el('div', 'qb-emotelist-head');
    const close = el('button', 'qb-emotelist-close');
    close.type = 'button';
    close.innerHTML = CLOSE;
    close.setAttribute('aria-label', 'Close emotes');
    close.addEventListener('click', () => this.closeList());
    head.append(el('span', 'qb-emotelist-title', 'Emotes'), close);
    const grid = el('div', 'qb-emotelist-grid');
    for (const e of EMOTES) {
      const b = el('button', 'qb-emotelist-item' + (e.id === this.victory ? ' victory' : ''));
      b.type = 'button';
      b.textContent = (e.id === this.victory ? '★ ' : '') + e.name;
      b.addEventListener('click', () => {
        this.closeList();
        this.play(e.id);
      });
      grid.append(b);
    }
    panel.append(head, el('span', 'qb-emotelist-hint', 'Tap to play · ★ plays when you complete a quest'), grid);
    this.stage.append(panel);
    this.list = panel;
  }

  private closeList() {
    this.list?.remove();
    this.list = null;
  }

  private floating(label: string) {
    if (!this.look || prefersReducedMotion()) return;
    document.querySelector('.qb-floathero')?.remove();
    clearTimeout(this.floatTimer);
    const box = el('div', 'qb-floathero');
    const stage = el('div', 'qb-floathero-stage');
    const fig = el('div', 'qb-figure av-idle');
    fig.innerHTML = avatarSvg(this.look, { width: 180 });
    stage.append(fig, celebrationLayer(label));
    box.append(stage);
    document.body.append(box);
    const ms = emoteById(this.victory).ms;
    playEmote(fig, this.victory);
    this.floatTimer = window.setTimeout(() => {
      box.classList.add('leaving');
      window.setTimeout(() => box.remove(), 300);
    }, Math.max(ms, 1700) + 250);
  }
}
