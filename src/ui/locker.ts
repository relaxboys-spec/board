import {
  ACCESSORIES,
  avatarSvg,
  CATEGORIES,
  colorsFor,
  HAIR_COLORS,
  HAIR_STYLES,
  lookFor,
  OUTFITS,
  outfitById,
  PALETTE,
  RARITY,
  SAREES,
  sareeLook,
  SKINS,
  toggleAccessory,
  type Outfit,
  type OutfitCategory,
} from '../avatar';
import { EMOTES, emoteById, playEmote } from '../emotes';
import { ALL_KEYS, isUnlocked, key, kindOf, levelOf, unlockedCount, type RewardKind } from '../rewards';
import { store } from '../store';
import type { OutfitColors, OutfitId, Player } from '../types';
import { el } from '../util';
import { xpToReach, type Stats } from '../xp';
import { toast } from './overlay';
import { rewardName } from './rewards';

/**
 * Locker (Locker.dc.html, AVATAR.md §4): preview Nova, browse 33 outfits by category,
 * restyle her (colours per outfit; hair, accessories, skin and the ★ victory emote are
 * global) and Equip. Every change saves straight away; Equip changes what she wears.
 *
 * Reward Track: locked outfits and options show the level that unlocks them. Tapping one
 * lets her try it on in the preview (nothing is saved). Newly unlocked things carry a NEW
 * badge until she has looked at them.
 */

const ICON = {
  back: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
  play: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4v16l13-8z"/></svg>',
  playFill: '<svg width="14" height="14" viewBox="0 0 24 24" fill="#FFFFFF" aria-hidden="true"><path d="M7 4v16l13-8z"/></svg>',
  lock: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#DCE6FF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="1"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  lockSm: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="1"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  trophy: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4"/><path d="M12 13v4M9 20h6"/></svg>',
  check: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0A1430" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>',
  star: (on: boolean) =>
    `<svg width="18" height="18" viewBox="0 0 24 24" fill="${on ? '#FFE14D' : 'none'}" stroke="${on ? '#FFE14D' : '#8EA3CF'}" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg>`,
};

type Tab = 'colors' | 'hair' | 'acc' | 'skin' | 'emotes';
const TABS: [Tab, string][] = [['colors', 'Colors'], ['hair', 'Hair'], ['acc', 'Extras'], ['skin', 'Skin'], ['emotes', 'Emotes']];
const TAB_KINDS: Record<Tab, RewardKind[]> = { colors: ['color'], hair: ['style', 'hair'], acc: ['acc'], skin: [], emotes: ['emote'] };
const tabFor = (k: string): Tab => (Object.keys(TAB_KINDS) as Tab[]).find((t) => TAB_KINDS[t].includes(kindOf(k))) ?? 'colors';

export interface LockerFocus {
  outfit?: OutfitId;
  /** A reward key: opens the tab it lives in. */
  key?: string;
}

function btn(cls: string, html: string, onClick: () => void, label?: string): HTMLButtonElement {
  const b = el('button', cls);
  b.type = 'button';
  b.innerHTML = html;
  if (label) b.setAttribute('aria-label', label);
  b.addEventListener('click', onClick);
  return b;
}

let current: { close(): void; focus(f: LockerFocus): void } | null = null;

export function lockerOpen() {
  return !!current;
}

export function openLocker(stats: Stats, onTrack: () => void, focus: LockerFocus = {}) {
  if (current) {
    current.focus(focus);
    return;
  }
  const level = stats.level;
  let sel: OutfitId = focus.outfit ?? store.player.outfit;
  let cat: 'All' | OutfitCategory = 'All';
  let tab: Tab = focus.key ? tabFor(focus.key) : 'colors';
  let playing: string | null = null;
  /** Trying on something locked: shown in the preview only, never saved. */
  let trial: { patch: Partial<Player>; key: string } | null = null;

  const has = (k: string) => isUnlocked(store.player, k);
  const isNew = (k: string) => store.player.unseen.includes(k);
  const toGo = (k: string) => Math.max(0, xpToReach(levelOf(k)) - stats.xp);
  function markSeen(keys: string[]) {
    const unseen = store.player.unseen;
    if (keys.some((k) => unseen.includes(k))) store.setPlayer({ unseen: unseen.filter((k) => !keys.includes(k)) });
  }
  const tabKeys = (t: Tab) => store.player.unseen.filter((k) => TAB_KINDS[t].includes(kindOf(k)));
  /** Save a change — or, if it needs a locked reward, try it on in the preview instead. */
  function apply(k: string, patch: Partial<Player>) {
    if (has(k)) {
      trial = null;
      store.setPlayer(patch);
      return;
    }
    trial = trial?.key === k ? null : { patch, key: k };
    if (trial) toast(`${rewardName(k)} unlocks at Level ${levelOf(k)} — trying it on`, undefined, 2000);
    render();
  }

  const root = el('div', 'qb-locker');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', 'Locker');

  // ---- header ------------------------------------------------------------------------
  const top = el('header', 'qb-locker-top');
  const back = btn('qb-skew qb-iconbtn', `<span>${ICON.back}</span>`, () => close(), 'Back to the board');
  const titles = el('div', 'qb-col-title');
  titles.append(
    el('span', 'qb-eyebrow', `Collection ${unlockedCount(store.player)} / ${ALL_KEYS.length} · Outfits · Styles · Extras`),
    el('h1', 'qb-display qb-locker-h1', 'Locker'),
  );
  const lvl = btn('qb-locker-level', '', () => onTrack(), 'Open the Reward Track');
  lvl.append(el('div', 'qb-hex qb-levelhex sm', String(level)), el('span', 'qb-level-label', `Level ${level}`));
  const trackBtn = btn('qb-skew qb-herobtn qb-lk-trackbtn', `<span>${ICON.trophy}Reward Track</span>`, () => onTrack());
  const equip = el('button', 'qb-skew qb-equip');
  equip.type = 'button';
  equip.addEventListener('click', () => {
    if (!has(key.outfit(sel)) || store.player.outfit === sel) return;
    trial = null;
    store.setPlayer({ outfit: sel });
  });
  top.append(back, titles, el('div', 'qb-flex'), lvl, trackBtn, equip);

  // ---- preview -------------------------------------------------------------------------
  const preview = el('section', 'qb-lk-preview');
  preview.setAttribute('aria-label', 'Preview');
  const tag = el('span', 'qb-skew qb-lk-tag');
  const name = el('span', 'qb-lk-name');
  const status = el('span', 'qb-lk-status');
  const pHead = el('div', 'qb-lk-phead');
  pHead.append(tag, name, status);
  const stage = el('div', 'qb-lk-stage');
  const figHolder = el('div', 'qb-lk-figure');
  const figure = el('div', 'av-idle');
  figHolder.append(figure);
  stage.append(el('div', 'qb-beam wide'), el('div', 'qb-pedestal big'), figHolder);
  const playVictory = btn('qb-skew qb-herobtn', '', () => play(store.player.victoryEmote));
  const changeVictory = btn('qb-skew qb-herobtn', `<span>${ICON.star(true)}Change</span>`, () => {
    if (tab === 'emotes') return;
    const seen = tabKeys(tab);
    tab = 'emotes';
    trial = null;
    render();
    markSeen(seen);
    styles.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, 'Change your victory emote');
  const vRow = el('div', 'qb-lk-vrow');
  vRow.append(playVictory, changeVictory);
  preview.append(pHead, stage, vRow);

  // ---- outfits ---------------------------------------------------------------------------
  const outfits = el('section', 'qb-lk-outfits');
  outfits.setAttribute('aria-label', 'Outfits');
  const oHead = el('div', 'qb-lk-ohead');
  const owned = OUTFITS.filter((o) => has(key.outfit(o.id))).length;
  const count = el('span', 'qb-lk-count');
  count.append(String(owned), el('span', 'dim', ` / ${OUTFITS.length} unlocked`));
  oHead.append(el('h2', 'qb-lk-h2', 'Outfits'), count);
  const cats = el('div', 'qb-lk-cats');
  cats.setAttribute('role', 'tablist');
  cats.setAttribute('aria-label', 'Category');
  const grid = el('div', 'qb-lk-grid');
  const gridScroll = el('div', 'qb-lk-scroll');
  gridScroll.append(grid);
  outfits.append(oHead, cats, gridScroll);

  // One card per outfit, kept; the avatar inside is redrawn only when its look changes.
  const cards = new Map<OutfitId, { el: HTMLButtonElement; art: HTMLElement; sig: string; tag: HTMLElement | null; nu: HTMLElement }>();
  // What she owns first, then everything else in the order it unlocks.
  const order = OUTFITS.map((o, i) => ({ o, i, at: has(key.outfit(o.id)) ? 0 : o.level }))
    .sort((x, y) => x.at - y.at || x.i - y.i)
    .map((x) => x.o);
  for (const o of order) {
    const r = RARITY[o.rarity];
    const locked = !has(key.outfit(o.id));
    const card = el('button', 'qb-lk-card');
    card.type = 'button';
    card.style.setProperty('--grad', r.grad);
    card.setAttribute('aria-label', `${o.name}, ${r.name}${locked ? `, unlocks at level ${o.level}` : ''}`);
    const inner = el('div', 'qb-lk-card-in');
    const art = el('div', 'qb-lk-card-art');
    const foot = el('div', 'qb-lk-card-foot');
    const rar = el('span', 'qb-lk-card-rar', r.name);
    rar.style.color = r.light;
    foot.append(el('span', 'qb-lk-card-name', o.name), rar);
    inner.append(el('div', 'qb-lk-card-glow'), art, foot);
    if (locked) {
      const lock = el('div', 'qb-lk-lock');
      lock.innerHTML = `${ICON.lock}<span>Lv ${o.level}</span>`;
      inner.append(lock);
    }
    const nu = el('span', 'qb-lk-newtag', 'New');
    inner.append(nu);
    card.append(inner);
    card.addEventListener('click', () => {
      sel = o.id;
      trial = null;
      render();
      markSeen([key.outfit(o.id)]);
    });
    grid.append(card);
    cards.set(o.id, { el: card, art, sig: '', tag: null, nu });
  }

  // ---- styles ------------------------------------------------------------------------------
  const styles = el('section', 'qb-lk-styles');
  styles.setAttribute('aria-label', 'Styles');
  const tabs = el('div', 'qb-lk-tabs');
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', 'Style');
  const panel = el('div', 'qb-lk-panel');
  styles.append(tabs, panel);

  const body = el('div', 'qb-locker-body');
  body.append(preview, outfits, styles);
  root.append(top, body);
  document.body.append(root);

  // ---- behaviour -------------------------------------------------------------------------------

  function play(id: (typeof EMOTES)[number]['id']) {
    playing = id;
    renderPanel();
    playEmote(figure, id, () => {
      playing = null;
      if (tab === 'emotes') renderPanel();
    });
  }

  const setColor = (id: OutfitId, slot: keyof OutfitColors, c: string, rk: string) => {
    const all = { ...store.player.outfitColors };
    all[id] = { ...(all[id] ?? {}), [slot]: c };
    apply(rk, { outfitColors: all });
  };

  function label(text: string, cls = 'qb-lk-label') {
    return el('span', cls, text);
  }

  /** Lock / NEW decoration for an option; returns the class suffix. */
  function deco(b: HTMLElement, k: string, pos: 'corner' | 'inline' = 'corner') {
    if (!has(k)) {
      b.classList.add('locked');
      const lk = el('span', 'qb-lk-lv ' + pos);
      lk.innerHTML = `${ICON.lockSm}<span>${levelOf(k)}</span>`;
      b.append(lk);
      b.setAttribute('aria-label', `${b.getAttribute('aria-label') ?? b.textContent ?? ''}, unlocks at level ${levelOf(k)}`);
      if (trial?.key === k) b.classList.add('trying');
    } else if (isNew(k)) {
      b.append(el('span', 'qb-lk-dot ' + pos, 'New'));
    }
  }

  function renderPanel() {
    const p = store.player;
    const v: Player = trial ? { ...p, ...trial.patch } : p;
    const o = outfitById(sel);
    const c = colorsFor(v, o.id);
    const out: HTMLElement[] = [];
    if (tab === 'colors') {
      const t = label(`${o.name} colors`);
      t.style.color = RARITY[o.rarity].light;
      out.push(t);
      for (const k of ['p', 's', 'a'] as const) {
        const group = el('div', 'qb-lk-group');
        const row = el('div', 'qb-lk-swatches');
        for (const [hex, nm] of PALETTE) {
          const on = c[k].toLowerCase() === hex.toLowerCase();
          const rk = key.color(hex);
          const b = btn('qb-lk-sq' + (on ? ' on' : ''), `<span style="background:${hex}"></span>`, () => setColor(o.id, k, hex, rk), `${o.labels[k]} ${nm}`);
          b.setAttribute('aria-pressed', String(on));
          deco(b, rk);
          row.append(b);
        }
        group.append(label(o.labels[k], 'qb-lk-sublabel'), row);
        out.push(group);
      }
      out.push(
        btn('qb-lk-reset', 'Reset colors', () => {
          const all = { ...store.player.outfitColors };
          delete all[o.id];
          trial = null;
          store.setPlayer({ outfitColors: all });
        }),
      );
      const lockedN = PALETTE.filter(([hex]) => !has(key.color(hex))).length;
      if (lockedN) out.push(el('span', 'qb-lk-note', `${lockedN} more colors unlock as you level up. Tap a locked one to try it on.`));
    } else if (tab === 'hair') {
      out.push(label('Hairstyle'));
      const styleGrid = el('div', 'qb-lk-two');
      for (const [id, nm] of HAIR_STYLES) {
        const on = v.hairStyle === id;
        const b = btn('qb-lk-opt' + (on ? ' on' : ''), `<span>${nm}</span>`, () => apply(key.style(id), { hairStyle: id }));
        b.setAttribute('aria-pressed', String(on));
        deco(b, key.style(id), 'inline');
        styleGrid.append(b);
      }
      out.push(styleGrid, label('Hair color'));
      const row = el('div', 'qb-lk-swatches');
      for (const hex of HAIR_COLORS) {
        const on = v.hair.toLowerCase() === hex.toLowerCase();
        const b = btn('qb-lk-round' + (on ? ' on' : ''), `<span style="background:${hex}"></span>`, () => apply(key.hair(hex), { hair: hex }), `Hair color ${rewardName(key.hair(hex))}`);
        b.setAttribute('aria-pressed', String(on));
        deco(b, key.hair(hex));
        row.append(b);
      }
      out.push(row);
    } else if (tab === 'acc') {
      out.push(label('Accessories · tap to toggle'));
      if (SAREES.includes(sel)) {
        // Only the parts of the suggested look she has unlocked (Festive Pack, Level 5).
        const cur = store.player;
        const look = sareeLook(cur.accessories);
        const accessories = look.accessories.filter((a) => has(key.acc(a)) || cur.accessories.includes(a));
        const hairStyle = has(key.style('bun')) ? look.hairStyle : cur.hairStyle;
        const gains = accessories.join() !== cur.accessories.join() || hairStyle !== cur.hairStyle;
        const tip = el('div', 'qb-lk-tip');
        if (has(key.acc('jhumkas'))) {
          tip.append(el('span', '', 'Pairs well with jhumkas, bangles, bindi and a bun'));
          if (gains) tip.append(btn('qb-lk-apply', 'Apply', () => store.setPlayer({ accessories, hairStyle })));
        } else {
          tip.append(el('span', '', `Jhumkas and bindi arrive with the Festive Pack at Level ${levelOf(key.acc('jhumkas'))}`));
        }
        out.push(tip);
      }
      const accGrid = el('div', 'qb-lk-two');
      for (const [id, nm] of ACCESSORIES) {
        const on = v.accessories.includes(id);
        const b = btn(
          'qb-lk-opt acc' + (on ? ' on' : ''),
          `<span>${nm}</span><span class="qb-lk-box">${on ? ICON.check : ''}</span>`,
          () => apply(key.acc(id), { accessories: toggleAccessory(store.player.accessories, id) }),
        );
        b.setAttribute('aria-pressed', String(on));
        deco(b, key.acc(id), 'inline');
        accGrid.append(b);
      }
      out.push(accGrid);
    } else if (tab === 'skin') {
      out.push(label('Skin tone'));
      const row = el('div', 'qb-lk-skins');
      SKINS.forEach((hex, i) => {
        const on = p.skin.toLowerCase() === hex.toLowerCase();
        const b = btn('qb-lk-round big' + (on ? ' on' : ''), `<span style="background:${hex}"></span>`, () => store.setPlayer({ skin: hex }), `Skin tone ${i + 1}`);
        b.setAttribute('aria-pressed', String(on));
        row.append(b);
      });
      out.push(row);
    } else {
      // Victory emote: pick from the emotes she has (it plays when she completes a quest).
      const owned = EMOTES.filter((e) => has(key.emote(e.id)) || p.victoryEmote === e.id);
      const vic = el('div', 'qb-lk-victory');
      const vHead = el('div', 'qb-lk-victory-head');
      vHead.append(
        el('span', 'qb-lk-victory-star', '★'),
        el('div', 'qb-lk-victory-text'),
        btn('qb-lk-apply', `${ICON.playFill} Play`, () => play(p.victoryEmote), `Play ${emoteById(p.victoryEmote).name}`),
      );
      (vHead.children[1] as HTMLElement).append(
        el('span', 'qb-lk-sublabel', 'Victory emote · plays when you complete a quest'),
        el('span', 'qb-lk-victory-name', emoteById(p.victoryEmote).name),
      );
      const chips = el('div', 'qb-lk-vchips');
      chips.setAttribute('role', 'radiogroup');
      chips.setAttribute('aria-label', 'Choose your victory emote');
      for (const e of owned) {
        const on = p.victoryEmote === e.id;
        const c = btn('qb-lk-vchip' + (on ? ' on' : ''), `${on ? '★ ' : ''}${e.name}`, () => {
          if (store.player.victoryEmote !== e.id) store.setPlayer({ victoryEmote: e.id });
          play(e.id);
        });
        c.setAttribute('role', 'radio');
        c.setAttribute('aria-checked', String(on));
        chips.append(c);
      }
      vic.append(vHead, chips);
      const lockedN = EMOTES.length - owned.length;
      if (lockedN) vic.append(el('span', 'qb-lk-note', `${lockedN} more unlock as you level up.`));
      out.push(vic, label(`All ${EMOTES.length} emotes · tap to preview`));

      const list = el('div', 'qb-lk-emotes');
      for (const e of EMOTES) {
        const k = key.emote(e.id);
        const unlocked = has(k);
        const isV = p.victoryEmote === e.id;
        const row = el('div', 'qb-lk-emote' + (unlocked ? '' : ' locked'));
        const playBtn = btn(
          'qb-lk-emote-play' + (playing === e.id ? ' on' : ''),
          `${ICON.playFill}<span>${e.name}</span>` +
            (isV ? '<span class="qb-lk-vtag">★ Victory</span>' : '') +
            (unlocked && isNew(k) ? '<span class="qb-lk-new">NEW</span>' : '') +
            (unlocked ? '' : `<span class="qb-lk-lv inline">${ICON.lockSm}<span>${levelOf(k)}</span></span>`),
          () => play(e.id),
          `Preview ${e.name}${unlocked ? '' : `, unlocks at level ${levelOf(k)}`}`,
        );
        row.append(playBtn);
        list.append(row);
      }
      out.push(list);
    }
    panel.replaceChildren(...out);
  }

  function render() {
    const p = store.player;
    const o: Outfit = outfitById(sel);
    const r = RARITY[o.rarity];
    const locked = !has(key.outfit(sel));
    const equipped = p.outfit === sel;
    const v: Player = trial ? { ...p, ...trial.patch } : p;

    // header button: Equip / Equipped / Unlocks at Lv N
    equip.className = 'qb-skew qb-equip' + (locked ? ' locked' : equipped ? ' equipped' : '');
    equip.innerHTML = `<span>${locked ? `Unlocks at Lv ${o.level}` : equipped ? 'Equipped' : 'Equip'}</span>`;
    equip.setAttribute('aria-disabled', String(locked || equipped));

    // preview
    tag.innerHTML = `<span>${r.name} · ${o.cat}</span>`;
    tag.style.background = r.grad;
    name.textContent = o.name;
    status.textContent = trial
      ? `Trying on ${rewardName(trial.key)} · unlocks at Level ${levelOf(trial.key)}`
      : locked
        ? `Locked · Level ${o.level} · ${toGo(key.outfit(sel))} XP to go`
        : equipped
          ? 'Equipped'
          : 'Previewing · tap Equip to wear';
    status.className = 'qb-lk-status' + (locked || trial ? ' locked' : equipped ? ' equipped' : '');
    figure.innerHTML = avatarSvg(lookFor(v, sel), { width: 280 });
    playVictory.innerHTML = `<span>${ICON.play}Play ${emoteById(p.victoryEmote).name}</span>`;

    // categories
    cats.replaceChildren(
      ...CATEGORIES.map((c) => {
        const b = btn('qb-skew qb-lk-cat' + (c === cat ? ' on' : ''), `<span>${c}</span>`, () => {
          cat = c;
          render();
        });
        b.setAttribute('role', 'tab');
        b.setAttribute('aria-selected', String(c === cat));
        return b;
      }),
    );

    // outfit cards
    const global = [p.hairStyle, p.hair, p.skin, p.accessories.join(',')].join('|');
    for (const out of OUTFITS) {
      const card = cards.get(out.id)!;
      card.el.hidden = cat !== 'All' && out.cat !== cat;
      card.el.classList.toggle('on', out.id === sel);
      card.nu.hidden = !isNew(key.outfit(out.id));
      card.el.setAttribute('aria-pressed', String(out.id === sel));
      const isEq = p.outfit === out.id;
      if (isEq && !card.tag) {
        card.tag = el('span', 'qb-lk-equipped', 'Equipped');
        card.el.firstElementChild!.append(card.tag);
      } else if (!isEq && card.tag) {
        card.tag.remove();
        card.tag = null;
      }
      const c = colorsFor(p, out.id);
      const sig = global + '|' + c.p + c.s + c.a;
      if (sig !== card.sig && !card.el.hidden) {
        card.sig = sig;
        card.art.innerHTML = avatarSvg(lookFor(p, out.id, true), { width: 110 });
      }
    }

    // tabs
    tabs.replaceChildren(
      ...TABS.map(([id, nm]) => {
        const n = id === tab ? 0 : tabKeys(id).length;
        const b = btn('qb-skew qb-lk-tab' + (id === tab ? ' on' : ''), `<span>${nm}${n ? `<i class="qb-lk-tabdot">${n}</i>` : ''}</span>`, () => {
          if (id === tab) return;
          const seen = tabKeys(tab);
          tab = id;
          trial = null;
          render();
          markSeen(seen); // she has seen the old tab's NEW things now
        });
        b.setAttribute('role', 'tab');
        b.setAttribute('aria-selected', String(id === tab));
        return b;
      }),
    );
    renderPanel();
  }

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
  };
  document.addEventListener('keydown', onKey);
  const unsub = store.on((e) => {
    if (e.type === 'player') render();
  });

  function close() {
    markSeen(tabKeys(tab));
    unsub();
    document.removeEventListener('keydown', onKey);
    root.remove();
    current = null;
  }

  current = {
    close,
    focus(f: LockerFocus) {
      if (f.outfit) {
        sel = f.outfit;
        cat = 'All';
      }
      if (f.key) {
        markSeen(tabKeys(tab));
        tab = tabFor(f.key);
      }
      trial = null;
      render();
      cards.get(sel)?.el.scrollIntoView({ block: 'nearest' });
      if (f.outfit) markSeen([key.outfit(f.outfit)]);
    },
  };
  render();
  // Keep the selected card in view when opening on an outfit far down the list.
  cards.get(sel)?.el.scrollIntoView({ block: 'nearest' });
  if (focus.outfit) markSeen([key.outfit(focus.outfit)]);
}
