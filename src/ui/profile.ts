import { avatarSvg, OUTFITS } from '../avatar';
import { EMOTES, emoteById, playEmote } from '../emotes';
import { ALL_KEYS, headline, isUnlocked, key, nextOnTrack, unlockedCount } from '../rewards';
import type { EmoteId, Look, Player } from '../types';
import { el, prefersReducedMotion } from '../util';
import { xpToReach, type Stats } from '../xp';
import { rewardName } from './rewards';

/**
 * Profile: the quiet home of the game parts — her avatar, level and streak, and the way
 * into the Locker, Emotes and Rewards. Completing a task pops her up in a corner for about
 * 3.5 seconds to play her ★ victory emote (Settings → Celebrate with my avatar turns it off).
 */

const svg = (d: string, size = 18) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICON = {
  shirt: svg('<path d="M8.5 3 12 5.3 15.5 3 21 6.8l-2.6 3.8-1.8-.9V21H7.4V9.7l-1.8.9L3 6.8z"/>'),
  smile: svg('<circle cx="12" cy="12" r="9"/><path d="M8 13.5s1.4 2 4 2 4-2 4-2M9 9.5h.01M15 9.5h.01"/>'),
  road: svg('<path d="M4 20 9 4M20 20 15 4M12 6v2.5M12 11v2.5M12 16v2.5"/>'),
  chev: svg('<path d="M9 5l7 7-7 7"/>', 16),
  play: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4v16l13-8z"/></svg>',
  x: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
};

const CELEBRATE_MS = 3500;

export interface ProfileHandlers {
  onLocker(): void;
  onRewards(): void;
}

export class Profile {
  readonly el: HTMLElement;
  private figure: HTMLElement;
  private stage: HTMLElement;
  private hero: HTMLElement;
  private levelLine: HTMLElement;
  private fill: HTMLElement;
  private playBtn: HTMLButtonElement;
  private stats: HTMLElement;
  private lockerSub: HTMLElement;
  private emotesSub: HTMLElement;
  private rewardsSub: HTMLElement;
  private lockerBadge: HTMLElement;
  private list: HTMLElement | null = null;
  private look: Look | null = null;
  private victory: EmoteId = 'victory';
  private floatTimer: number | undefined;

  constructor(parent: HTMLElement, h: ProfileHandlers) {
    this.el = el('section', 'qb-profile');
    this.el.setAttribute('aria-label', 'Profile');
    this.el.hidden = true;

    const hero = el('div', 'qb-panel qb-profile-hero');
    this.hero = hero;
    this.stage = el('div', 'qb-profile-stage');
    this.figure = el('div', 'qb-figure av-idle');
    this.stage.append(this.figure);
    this.levelLine = el('p', 'qb-profile-level');
    const bar = el('span', 'qb-bar');
    this.fill = el('i');
    bar.append(this.fill);
    const btns = el('div', 'qb-profile-btns');
    this.playBtn = el('button', 'btn');
    this.playBtn.type = 'button';
    this.playBtn.addEventListener('click', () => this.play(this.victory));
    const emotes = el('button', 'btn');
    emotes.type = 'button';
    emotes.innerHTML = `${ICON.smile}<span>Emotes</span>`;
    emotes.addEventListener('click', () => (this.list ? this.closeList() : this.openList()));
    btns.append(this.playBtn, emotes);
    hero.append(this.stage, el('h2', 'qb-profile-name', 'Moduuu'), this.levelLine, bar, btns);

    const side = el('div', 'qb-profile-side');
    this.stats = el('div', 'qb-panel qb-stats');
    const rows = el('div', 'qb-panel qb-rows');
    const row = (icon: string, title: string, sub: HTMLElement, on: () => void) => {
      const r = el('button', 'qb-row');
      r.type = 'button';
      const t = el('span', 'qb-row-text');
      t.append(el('b', '', title), sub);
      const ic = el('span', 'qb-row-icon');
      ic.innerHTML = icon;
      const chev = el('span', 'qb-row-chev');
      chev.innerHTML = ICON.chev;
      r.append(ic, t, chev);
      r.addEventListener('click', on);
      return r;
    };
    this.lockerSub = el('span');
    this.emotesSub = el('span');
    this.rewardsSub = el('span');
    const lockerRow = row(ICON.shirt, 'Locker', this.lockerSub, h.onLocker);
    this.lockerBadge = el('i', 'qb-badge');
    this.lockerBadge.hidden = true;
    lockerRow.querySelector('.qb-row-icon')!.append(this.lockerBadge);
    rows.append(
      lockerRow,
      row(ICON.smile, 'Emotes', this.emotesSub, () => this.openList()),
      row(ICON.road, 'Rewards', this.rewardsSub, h.onRewards),
    );
    side.append(this.stats, rows);

    const grid = el('div', 'qb-profile-grid');
    grid.append(hero, side);
    this.el.append(grid);
    parent.append(this.el);
  }

  setLook(look: Look, victory: EmoteId) {
    this.look = look;
    this.victory = victory;
    this.figure.innerHTML = avatarSvg(look, { width: 200 });
    this.playBtn.innerHTML = `${ICON.play}<span>Play ${emoteById(victory).name}</span>`;
    if (this.list) this.openList();
  }

  /** Level, XP and the counts in the side panels. */
  setStats(s: Stats, p: Player, done: { total: number; week: number }) {
    this.levelLine.textContent = `Level ${s.level} · ${s.into} / ${s.need} XP`;
    this.fill.style.width = `${(s.into / s.need) * 100}%`;
    this.stats.replaceChildren(
      ...[
        [s.streak ? `${s.streak} day${s.streak === 1 ? '' : 's'}` : '—', 'Current streak'],
        [String(done.total), 'Tasks done'],
        [String(done.week), 'Done this week'],
      ].map(([v, l]) => {
        const st = el('div', 'qb-stat');
        st.append(el('b', '', v), el('span', '', l));
        return st;
      }),
    );
    const outfits = OUTFITS.filter((o) => isUnlocked(p, key.outfit(o.id))).length;
    this.lockerSub.textContent = `Outfits, hair, colours and accessories · ${outfits} of ${OUTFITS.length} outfits`;
    const emotes = EMOTES.filter((e) => isUnlocked(p, key.emote(e.id))).length;
    this.emotesSub.textContent = `${emotes} of ${EMOTES.length} unlocked · completing a task plays ${emoteById(p.victoryEmote).name}`;
    const next = nextOnTrack(Math.max(1, p.best, s.level));
    this.rewardsSub.textContent = next
      ? `Next at Level ${next.level}: ${rewardName(headline(next))} · ${Math.max(0, xpToReach(next.level) - s.xp)} XP to go`
      : `All ${ALL_KEYS.length} rewards collected (${unlockedCount(p)})`;
  }

  setBadge(n: number) {
    this.lockerBadge.hidden = n === 0;
    this.lockerBadge.textContent = String(n);
  }

  play(id: EmoteId) {
    playEmote(this.figure, id);
  }

  /** A task was completed: if she wants it, her avatar pops up to celebrate. */
  celebrate(xp: number, enabled: boolean) {
    if (!this.el.hidden) {
      this.play(this.victory);
      return;
    }
    if (!enabled || !this.look || prefersReducedMotion()) return;
    document.querySelector('.qb-floathero')?.remove();
    clearTimeout(this.floatTimer);
    const box = el('div', 'qb-floathero');
    const fig = el('div', 'qb-figure av-idle');
    fig.innerHTML = avatarSvg(this.look, { width: 120 });
    box.append(fig, el('span', 'qb-floathero-xp', `+${xp} XP`));
    document.body.append(box);
    playEmote(fig, this.victory);
    // On screen for about 3.5 s, whichever emote it is, then it fades away.
    this.floatTimer = window.setTimeout(() => {
      box.classList.add('leaving');
      window.setTimeout(() => box.remove(), 300);
    }, CELEBRATE_MS);
  }

  private openList() {
    this.list?.remove();
    const panel = el('div', 'qb-emotelist');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Emotes');
    const head = el('div', 'qb-emotelist-head');
    const close = el('button', 'qb-iconbtn');
    close.type = 'button';
    close.innerHTML = ICON.x;
    close.setAttribute('aria-label', 'Close emotes');
    close.addEventListener('click', () => this.closeList());
    head.append(el('span', 'qb-emotelist-title', 'Emotes'), el('span', 'qb-emotelist-hint', 'Tap to play · choose your ★ victory emote in the Locker'), close);
    const grid = el('div', 'qb-emotelist-grid');
    for (const e of EMOTES) {
      const b = el('button', 'qb-emotelist-item' + (e.id === this.victory ? ' victory' : ''));
      b.type = 'button';
      b.textContent = (e.id === this.victory ? '★ ' : '') + e.name;
      b.addEventListener('click', () => this.play(e.id));
      grid.append(b);
    }
    panel.append(head, grid);
    this.hero.append(panel);
    this.list = panel;
  }

  private closeList() {
    this.list?.remove();
    this.list = null;
  }
}
