import { ACCESSORIES, avatarSvg, HAIR_STYLES, lookFor, outfitById, PALETTE, RARITY, toggleAccessory } from '../avatar';
import { emoteById, playEmote } from '../emotes';
import {
  headline,
  idOf,
  isUnlocked,
  kindOf,
  levelOf,
  nextOnTrack,
  TRACK,
  STARTER,
  TRACK_END,
  unlockedCount,
  ALL_KEYS,
  type RewardKind,
  type TrackLevel,
} from '../rewards';
import { store } from '../store';
import type { AccessoryId, EmoteId, HairStyle, OutfitId, Player } from '../types';
import { el, prefersReducedMotion } from '../util';
import { xpToReach, type Stats } from '../xp';

/**
 * Reward Track UI: how a reward looks (tile), the Reward Track screen, and the
 * level-up reveal that opens after a quest pushes her into a new level.
 */

export const HAIR_NAMES: Record<string, string> = {
  '#1A1420': 'Jet', '#2A1A14': 'Espresso', '#5A3220': 'Chestnut', '#8A4B26': 'Auburn',
  '#C98A3E': 'Caramel', '#E8D3A0': 'Honey Blonde', '#FF6FAE': 'Bubblegum', '#7B5CFF': 'Ultraviolet',
};

const KIND_LABEL: Record<RewardKind, string> = {
  outfit: 'Outfit', style: 'Hairstyle', hair: 'Hair color', color: 'Outfit color', acc: 'Accessory', emote: 'Emote',
};

export function rewardName(k: string): string {
  const id = idOf(k);
  switch (kindOf(k)) {
    case 'outfit':
      return outfitById(id as OutfitId).name;
    case 'style':
      return HAIR_STYLES.find(([h]) => h === id)?.[1] ?? id;
    case 'hair':
      return HAIR_NAMES[id] ?? id;
    case 'color': {
      const nm = PALETTE.find(([h]) => h.toUpperCase() === id)?.[1] ?? id;
      return nm.replace(/\b\w/g, (c) => c.toUpperCase());
    }
    case 'acc':
      return ACCESSORIES.find(([a]) => a === id)?.[1] ?? id;
    case 'emote':
      return emoteById(id as EmoteId).name;
  }
}

export function rewardKindLabel(k: string): string {
  return KIND_LABEL[kindOf(k)];
}

/** Nova as she'd look with this reward on (for outfit, hairstyle, hair colour and accessory tiles). */
function lookWith(p: Player, k: string) {
  const id = idOf(k);
  const kind = kindOf(k);
  const q: Player = { ...p };
  if (kind === 'style') q.hairStyle = id as HairStyle;
  if (kind === 'hair') q.hair = id;
  if (kind === 'acc' && !q.accessories.includes(id as AccessoryId)) q.accessories = toggleAccessory(q.accessories, id as AccessoryId);
  return lookFor(q, kind === 'outfit' ? (id as OutfitId) : q.outfit, true);
}

const EMOTE_ICON =
  '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M9 9h.01M15 9h.01"/></svg>';
const LOCK =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="1"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
const CHECK =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>';
const CLOSE =
  '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

/** The art for a reward: Nova (outfit), her head (hair, accessories), a swatch or an emote badge. */
export function rewardArt(k: string, p: Player, big = false): HTMLElement {
  const kind = kindOf(k);
  const id = idOf(k);
  const art = el('div', `qb-rw-art ${kind}`);
  if (kind === 'outfit') {
    art.innerHTML = avatarSvg(lookWith(p, k), { width: big ? 150 : 74 });
  } else if (kind === 'style' || kind === 'hair' || kind === 'acc') {
    art.classList.add('head');
    art.innerHTML = avatarSvg(lookWith(p, k), { width: big ? 210 : 132 });
  } else if (kind === 'color') {
    const sw = el('span', 'qb-rw-swatch');
    sw.style.background = id;
    art.append(sw);
  } else {
    art.innerHTML = EMOTE_ICON;
  }
  return art;
}

/** A reward tile: art, name, kind; rarity-coloured for outfits. */
export function rewardTile(k: string, p: Player, opts: { big?: boolean; state?: 'owned' | 'locked' | 'next' } = {}): HTMLElement {
  const kind = kindOf(k);
  const tile = el('div', `qb-rw-tile ${kind}` + (opts.big ? ' big' : '') + (opts.state ? ' ' + opts.state : ''));
  if (kind === 'outfit') {
    const r = RARITY[outfitById(idOf(k) as OutfitId).rarity];
    tile.style.setProperty('--grad', r.grad);
    tile.style.setProperty('--light', r.light);
  }
  const text = el('div', 'qb-rw-text');
  text.append(el('span', 'qb-rw-name', rewardName(k)), el('span', 'qb-rw-kind', rewardKindLabel(k)));
  tile.append(rewardArt(k, p, opts.big), text);
  if (opts.state === 'owned' || opts.state === 'locked') {
    const mark = el('span', 'qb-rw-mark');
    mark.innerHTML = opts.state === 'owned' ? CHECK : LOCK;
    tile.append(mark);
  }
  return tile;
}

// ---- level-up reveal -------------------------------------------------------------------

export interface RewardHandlers {
  openLocker(focus?: { outfit?: OutfitId; key?: string }): void;
  openTrack(): void;
}

let reveal: HTMLElement | null = null;

/**
 * "LEVEL UP!" — shows what the new level(s) unlocked, the headline outfit on Nova, and
 * offers to wear it straight away.
 */
export function showLevelUp(from: number, to: number, keys: string[], h: RewardHandlers) {
  reveal?.remove();
  const p = store.player;
  const levels = TRACK.filter((t) => t.level > from && t.level <= to);
  const milestone = [...levels].reverse().find((t) => t.title);
  const outfitKey = keys.find((k) => kindOf(k) === 'outfit');

  const root = el('div', 'qb-lvup');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', `Level ${to} reached`);
  const rays = el('div', 'qb-lvup-rays');
  const card = el('div', 'qb-lvup-card' + (milestone ? ' milestone' : ''));

  const head = el('div', 'qb-lvup-head');
  head.append(el('div', 'qb-hex qb-levelhex lg', String(to)));
  const titles = el('div', 'qb-lvup-titles');
  titles.append(
    el('span', 'qb-eyebrow cyan', milestone ? `Milestone · ${milestone.title}` : keys.length ? 'Rewards unlocked' : 'Keep going'),
    el('h2', 'qb-display qb-lvup-h', 'Level up!'),
  );
  head.append(titles);
  card.append(head);

  if (outfitKey) {
    const stage = el('div', 'qb-lvup-stage');
    const fig = el('div', 'qb-lvup-fig av-idle');
    const id = idOf(outfitKey) as OutfitId;
    fig.innerHTML = avatarSvg(lookFor(p, id), { width: 170 });
    const o = outfitById(id);
    const r = RARITY[o.rarity];
    const info = el('div', 'qb-lvup-info');
    const tag = el('span', 'qb-skew qb-lk-tag');
    tag.innerHTML = `<span>${r.name} · ${o.cat}</span>`;
    tag.style.background = r.grad;
    info.append(tag, el('span', 'qb-lk-name', o.name), el('span', 'qb-lvup-sub', 'New outfit for Nova'));
    stage.append(el('div', 'qb-pedestal'), fig, info);
    card.append(stage);
    // Nova shows off the new emote if this level brought one.
    const emote = keys.find((k) => kindOf(k) === 'emote');
    if (emote && !prefersReducedMotion()) window.setTimeout(() => fig.isConnected && playEmote(fig, idOf(emote) as EmoteId), 700);
  }

  const rest = keys.filter((k) => k !== outfitKey);
  if (rest.length || !keys.length) {
    const grid = el('div', 'qb-lvup-grid');
    rest.forEach((k, i) => {
      const t = rewardTile(k, p);
      t.style.animationDelay = `${0.35 + i * 0.12}s`;
      grid.append(t);
    });
    if (!keys.length) grid.append(el('span', 'qb-lvup-sub', 'You’ve collected the whole Reward Track. Nova salutes you!'));
    card.append(grid);
  }

  const next = nextOnTrack(to);
  if (next) {
    const nx = el('div', 'qb-lvup-next');
    nx.textContent = `Next: Level ${next.level} · ${rewardName(headline(next))}`;
    card.append(nx);
  }

  const btns = el('div', 'qb-lvup-btns');
  const close = () => {
    root.classList.add('closing');
    window.setTimeout(() => root.remove(), 180);
    document.removeEventListener('keydown', onKey);
    if (reveal === root) reveal = null;
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
  };
  document.addEventListener('keydown', onKey);
  if (outfitKey) {
    const id = idOf(outfitKey) as OutfitId;
    const wear = button('qb-skew8 qb-cta qb-lvup-cta', `Wear ${outfitById(id).name}`, () => {
      store.setPlayer({ outfit: id, unseen: store.player.unseen.filter((k) => k !== outfitKey) });
      close();
    });
    btns.append(wear);
  }
  const row = el('div', 'qb-lvup-row');
  row.append(
    button('qb-skew qb-herobtn', 'Locker', () => {
      close();
      h.openLocker(outfitKey ? { outfit: idOf(outfitKey) as OutfitId } : { key: keys[0] });
    }),
    button('qb-skew qb-herobtn', outfitKey ? 'Later' : 'Collect', () => close()),
  );
  btns.append(row);
  card.append(btns);
  const x = el('button', 'qb-lvup-x');
  x.type = 'button';
  x.innerHTML = CLOSE;
  x.setAttribute('aria-label', 'Close');
  x.addEventListener('click', close);
  card.append(x);

  root.append(rays, card);
  document.body.append(root);
  reveal = root;
  if (prefersReducedMotion()) root.classList.add('still');
}

function button(cls: string, label: string, onClick: () => void) {
  const b = el('button', cls);
  b.type = 'button';
  b.append(el('span', '', label));
  b.addEventListener('click', onClick);
  return b;
}

// ---- Reward Track screen ---------------------------------------------------------------

let trackEl: HTMLElement | null = null;

export function trackOpen() {
  return !!trackEl;
}

/**
 * The whole road from Level 1 to 30: what she has, where she is, what's next. Tapping a
 * reward opens it in the Locker (locked ones can be previewed there).
 */
export function openTrack(s: Stats, h: RewardHandlers) {
  trackEl?.remove();
  const p = store.player;
  const best = Math.max(1, p.best);

  const root = el('div', 'qb-track');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', 'Reward Track');
  const top = el('header', 'qb-locker-top');
  const back = el('button', 'qb-skew qb-iconbtn');
  back.type = 'button';
  back.innerHTML = `<span>${CLOSE}</span>`;
  back.setAttribute('aria-label', 'Close the Reward Track');
  back.addEventListener('click', () => close());
  const titles = el('div', 'qb-col-title');
  titles.append(
    el('span', 'qb-eyebrow', `Collection ${unlockedCount(p)} / ${ALL_KEYS.length} · Complete quests to level up`),
    el('h1', 'qb-display qb-locker-h1', 'Reward Track'),
  );
  const lvl = el('div', 'qb-track-lvl');
  const bar = el('div', 'qb-xpbar');
  const fill = el('div', 'qb-xpbar-fill');
  fill.style.width = `${(s.into / s.need) * 100}%`;
  bar.append(fill, el('div', 'qb-xpbar-ticks'));
  const lvlText = el('div', 'qb-level-text');
  const row = el('div', 'qb-level-row');
  row.append(el('span', 'qb-level-label', `Level ${s.level}`), el('span', 'qb-level-xp', `${s.into} / ${s.need} XP`));
  lvlText.append(row, bar);
  lvl.append(el('div', 'qb-hex qb-levelhex sm', String(s.level)), lvlText);
  top.append(back, titles, el('div', 'qb-flex'), lvl);

  const scroller = el('div', 'qb-track-scroll');
  const road = el('div', 'qb-track-road');
  const levels: TrackLevel[] = [{ level: 1, title: 'Starter Kit', keys: [] }, ...TRACK];
  let currentCol: HTMLElement | null = null;
  for (const t of levels) {
    const reached = t.level <= best;
    const isNext = !reached && t.level === nextOnTrack(best)?.level;
    const col = el('section', 'qb-track-col' + (reached ? ' reached' : '') + (isNext ? ' next' : '') + (t.title ? ' milestone' : ''));
    col.setAttribute('aria-label', `Level ${t.level}${t.title ? ', ' + t.title : ''}${reached ? ', unlocked' : ''}`);
    const node = el('div', 'qb-track-node');
    node.append(el('div', 'qb-hex qb-levelhex sm', String(t.level)));
    if (t.title) node.append(el('span', 'qb-track-title', t.title));
    else if (isNext) node.append(el('span', 'qb-track-title next', `${Math.max(0, xpToReach(t.level) - s.xp)} XP to go`));
    col.append(node);
    const stack = el('div', 'qb-track-stack');
    const keys = t.level === 1 ? STARTER.filter((k) => kindOf(k) === 'outfit') : t.keys;
    for (const k of keys) {
      const owned = isUnlocked(p, k);
      const tile = rewardTile(k, p, { state: owned ? 'owned' : isNext ? 'next' : 'locked' });
      tile.tabIndex = 0;
      tile.setAttribute('role', 'button');
      tile.setAttribute('aria-label', `${rewardName(k)}, ${rewardKindLabel(k)}, ${owned ? 'unlocked' : `level ${levelOf(k)}`}`);
      const go = () => {
        close();
        h.openLocker(kindOf(k) === 'outfit' ? { outfit: idOf(k) as OutfitId } : { key: k });
      };
      tile.addEventListener('click', go);
      tile.addEventListener('keydown', (e) => e.key === 'Enter' && go());
      stack.append(tile);
    }
    if (t.level === 1) {
      const sum = el('div', 'qb-rw-tile starter owned');
      sum.append(
        el('span', 'qb-rw-name', 'Plus'),
        el('span', 'qb-rw-kind', '2 hairstyles · 3 hair colors · 4 outfit colors · 2 extras · 3 emotes · every skin tone'),
      );
      stack.append(sum);
    }
    col.append(stack);
    road.append(col);
    if (isNext || (!currentCol && t.level === best && t.level === TRACK_END)) currentCol = col;
  }
  scroller.append(road);
  root.append(top, scroller);
  document.body.append(root);
  trackEl = root;

  // Start with the next level in view, a little in from the left.
  // (Portrait runs the road downwards, so scroll whichever way it goes.)
  if (currentCol) {
    scroller.scrollLeft = Math.max(0, currentCol.offsetLeft - 220);
    scroller.scrollTop = Math.max(0, currentCol.offsetTop - 160);
  }

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
  };
  document.addEventListener('keydown', onKey);
  function close() {
    document.removeEventListener('keydown', onKey);
    root.remove();
    if (trackEl === root) trackEl = null;
  }
}
