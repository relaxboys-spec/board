import { renderAvatarSvg, type AvatarVals } from './avatarSvg.gen';
import { isRewardKey, levelOf } from './rewards';
import {
  DEFAULT_PLAYER,
  type AccessoryId,
  type EmoteId,
  type HairStyle,
  type Look,
  type OutfitColors,
  type OutfitId,
  type Player,
} from './types';

/**
 * Nova, the hero (design/quest-board/AVATAR.md). The drawing itself is generated from
 * screens/Avatar.dc.html into avatarSvg.gen.ts; this module is the port of that file's
 * OUTFITS table and renderVals(), merged with the Locker's outfit metadata
 * (screens/Locker.dc.html: name, category, rarity, unlock level, colour-slot labels).
 */

// ---- wardrobe ------------------------------------------------------------------------

export type OutfitCategory = 'Casual' | 'Street' | 'Work' | 'Active' | 'Evening' | 'Traditional';
export type Rarity = 'uncommon' | 'rare' | 'epic' | 'legendary';
type Top = 'tee' | 'tank' | 'shirt' | 'blouse' | 'longsleeve' | 'turtle' | 'sweater' | 'hoodie' | 'sareeb' | 'sareebsl';
type Outer = '' | 'bomber' | 'denim' | 'blazer' | 'leather' | 'trench' | 'puffer' | 'vest' | 'cardigan';
type Bottom =
  | 'joggers' | 'cargo' | 'jeans' | 'leggings' | 'wide' | 'shorts' | 'pleated' | 'midi' | 'pencil' | 'aline' | 'saree' | 'nauvari';
type Shoes = 'sneakers' | 'hightops' | 'boots' | 'heels' | 'loafers' | 'sandals' | 'flats';
/** Where a garment takes its colour: a player slot, or a fixed hex. */
type Src = 'p' | 's' | 'a' | string;

export interface Outfit {
  id: OutfitId;
  name: string;
  cat: OutfitCategory;
  rarity: Rarity;
  /** Level needed to wear it (1 = from the start). */
  level: number;
  top: Top;
  outer: Outer;
  bottom: Bottom;
  shoes: Shoes;
  c: { top: Src; outer?: Src; bottom: Src; shoe: Src };
  def: Required<OutfitColors>;
  /** Locker labels for the three colour slots. */
  labels: { p: string; s: string; a: string };
  denim?: boolean;
  belt?: boolean;
  sleeves?: Src;
  stripes?: boolean;
  drape?: 'nivi' | 'kanjivaram' | 'party' | 'nauvari';
}

type Recipe = Omit<Outfit, 'id' | 'name' | 'cat' | 'rarity' | 'level' | 'labels' | 'def'>;

/** From Avatar.dc.html → OUTFITS. */
const RECIPES: Record<OutfitId, Recipe> = {
  runner: { top: 'tee', outer: 'bomber', bottom: 'joggers', shoes: 'sneakers', c: { top: '#F2F6FF', outer: 'p', bottom: 's', shoe: '#F2F6FF' } },
  denim: { top: 'tee', outer: 'denim', bottom: 'jeans', shoes: 'hightops', c: { top: 'a', outer: 'p', bottom: 's', shoe: '#F2F6FF' } },
  boardroom: { top: 'blouse', outer: 'blazer', bottom: 'wide', shoes: 'loafers', c: { top: 's', outer: 'p', bottom: 'p', shoe: '#1B1F2A' } },
  biker: { top: 'tank', outer: 'leather', bottom: 'leggings', shoes: 'boots', c: { top: 'a', outer: 'p', bottom: 's', shoe: '#1B1F2A' } },
  hoodie: { top: 'hoodie', outer: '', bottom: 'joggers', shoes: 'sneakers', c: { top: 'p', bottom: 's', shoe: '#F2F6FF' } },
  trench: { top: 'turtle', outer: 'trench', bottom: 'jeans', shoes: 'boots', c: { top: 's', outer: 'p', bottom: '#2A3F6B', shoe: '#3A2A1E' } },
  summer: { top: 'tank', outer: '', bottom: 'shorts', shoes: 'sandals', denim: true, c: { top: 'p', bottom: 's', shoe: 'a' } },
  tennis: { top: 'shirt', outer: '', bottom: 'pleated', shoes: 'sneakers', c: { top: 'p', bottom: 's', shoe: '#F2F6FF' } },
  cargo: { top: 'tank', outer: 'vest', bottom: 'cargo', shoes: 'boots', c: { top: 'a', outer: 'p', bottom: 's', shoe: '#3A2A1E' } },
  knit: { top: 'sweater', outer: '', bottom: 'midi', shoes: 'boots', c: { top: 'p', bottom: 's', shoe: '#3A2A1E' } },
  puffer: { top: 'turtle', outer: 'puffer', bottom: 'leggings', shoes: 'boots', c: { top: 's', outer: 'p', bottom: '#1B1F2A', shoe: '#1B1F2A' } },
  athleisure: { top: 'tank', outer: '', bottom: 'leggings', shoes: 'sneakers', c: { top: 'p', bottom: 's', shoe: '#F2F6FF' } },
  lbd: { top: 'tank', outer: '', bottom: 'pencil', shoes: 'heels', c: { top: 'p', bottom: 'p', shoe: 's' } },
  sundress: { top: 'tank', outer: '', bottom: 'midi', shoes: 'sandals', c: { top: 'p', bottom: 'p', shoe: 's' } },
  jumpsuit: { top: 'tank', outer: '', bottom: 'wide', shoes: 'heels', belt: true, c: { top: 'p', bottom: 'p', shoe: 's' } },
  coverall: { top: 'longsleeve', outer: '', bottom: 'cargo', shoes: 'boots', c: { top: 'p', bottom: 'p', shoe: 's' } },
  cardigan: { top: 'tee', outer: 'cardigan', bottom: 'jeans', shoes: 'loafers', c: { top: 's', outer: 'p', bottom: '#4A6FA5', shoe: '#7A4B2A' } },
  varsity: { top: 'tee', outer: 'bomber', bottom: 'pleated', shoes: 'hightops', sleeves: 'a', c: { top: '#F2F6FF', outer: 'p', bottom: 's', shoe: '#F2F6FF' } },
  shirtslacks: { top: 'blouse', outer: '', bottom: 'wide', shoes: 'loafers', belt: true, c: { top: 'p', bottom: 's', shoe: '#1B1F2A' } },
  mono: { top: 'turtle', outer: '', bottom: 'wide', shoes: 'boots', c: { top: 'p', bottom: 'p', shoe: 's' } },
  skater: { top: 'tee', outer: '', bottom: 'shorts', shoes: 'hightops', c: { top: 'p', bottom: 's', shoe: '#1B1F2A' } },
  festival: { top: 'tank', outer: '', bottom: 'shorts', shoes: 'boots', denim: true, c: { top: 'p', bottom: 's', shoe: '#7A4B2A' } },
  officeknit: { top: 'sweater', outer: '', bottom: 'wide', shoes: 'loafers', c: { top: 'p', bottom: 's', shoe: '#1B1F2A' } },
  bodycon: { top: 'longsleeve', outer: '', bottom: 'pencil', shoes: 'heels', c: { top: 'p', bottom: 'p', shoe: 's' } },
  shirtdress: { top: 'shirt', outer: '', bottom: 'aline', shoes: 'sneakers', belt: true, c: { top: 'p', bottom: 'p', shoe: 's' } },
  track: { top: 'tee', outer: 'bomber', bottom: 'joggers', shoes: 'sneakers', stripes: true, c: { top: 's', outer: 'p', bottom: 'p', shoe: '#F2F6FF' } },
  rock: { top: 'tee', outer: 'leather', bottom: 'pleated', shoes: 'boots', c: { top: 'a', outer: 'p', bottom: 's', shoe: '#1B1F2A' } },
  powershorts: { top: 'blouse', outer: 'blazer', bottom: 'shorts', shoes: 'heels', c: { top: 's', outer: 'p', bottom: 'p', shoe: '#1B1F2A' } },
  utility: { top: 'hoodie', outer: 'vest', bottom: 'cargo', shoes: 'sneakers', c: { top: 's', outer: 'p', bottom: '#1B1F2A', shoe: '#F2F6FF' } },
  saree: { top: 'sareeb', outer: '', bottom: 'saree', shoes: 'flats', drape: 'nivi', c: { top: 's', bottom: 'p', shoe: 'a' } },
  sareeKanji: { top: 'sareeb', outer: '', bottom: 'saree', shoes: 'flats', drape: 'kanjivaram', c: { top: 's', bottom: 'p', shoe: 'a' } },
  sareeParty: { top: 'sareebsl', outer: '', bottom: 'saree', shoes: 'heels', drape: 'party', c: { top: 's', bottom: 'p', shoe: 'a' } },
  nauvari: { top: 'sareeb', outer: '', bottom: 'nauvari', shoes: 'flats', drape: 'nauvari', c: { top: 's', bottom: 'p', shoe: 'a' } },
};

/** From Locker.dc.html → OUTFITS (also the Locker's display order). */
// The unlock-level column is the design's; the Reward Track (rewards.ts) decides the real one.
const META: [OutfitId, string, OutfitCategory, Rarity, number, string, string, string, string, string, string][] = [
  ['runner', 'Street Runner', 'Street', 'rare', 1, '#1F7F86', '#2A3142', '#FFC83D', 'Jacket', 'Joggers', 'Trims'],
  ['saree', 'Nivi Silk Saree', 'Traditional', 'legendary', 1, '#B3122E', '#FFC83D', '#FFC83D', 'Saree', 'Blouse', 'Border & juttis'],
  ['sareeKanji', 'Kanjivaram Silk', 'Traditional', 'legendary', 1, '#C2185B', '#FFC83D', '#FFC83D', 'Silk', 'Blouse', 'Juttis'],
  ['sareeParty', 'Party Saree', 'Traditional', 'epic', 1, '#6B3FD0', '#1B1F2A', '#E2C8FF', 'Sheer saree', 'Sleeveless blouse', 'Border, sequins & heels'],
  ['nauvari', 'Nauvari Saree', 'Traditional', 'legendary', 1, '#2BA36B', '#6B3FD0', '#FFC83D', 'Saree', 'Blouse', 'Zari border & juttis'],
  ['denim', 'Denim Daze', 'Street', 'rare', 1, '#4A6FA5', '#2A3F6B', '#F2F6FF', 'Jacket', 'Jeans', 'Tee'],
  ['boardroom', 'Boardroom', 'Work', 'epic', 1, '#2A3142', '#F2F6FF', '#FFC83D', 'Suit', 'Blouse', 'Button'],
  ['hoodie', 'Cozy Hoodie', 'Casual', 'uncommon', 1, '#C9B79C', '#2A3142', '#F2F6FF', 'Hoodie', 'Joggers', 'Drawstrings'],
  ['trench', 'Trench Classic', 'Work', 'epic', 1, '#C9B79C', '#1B1F2A', '#FFC83D', 'Trench', 'Turtleneck', 'Buttons'],
  ['summer', 'Summer Sun', 'Casual', 'uncommon', 1, '#FFC83D', '#4A6FA5', '#C9B79C', 'Tank', 'Shorts', 'Sandals'],
  ['tennis', 'Tennis Club', 'Active', 'rare', 1, '#F2F6FF', '#F2F6FF', '#2BA36B', 'Polo', 'Skirt', 'Trims'],
  ['cargo', 'Cargo Ops', 'Street', 'rare', 1, '#5A6B3A', '#C9B79C', '#1B1F2A', 'Vest', 'Cargo pants', 'Tank'],
  ['knit', 'Knit Weekend', 'Casual', 'uncommon', 1, '#FF8A3C', '#C9B79C', '#FFC83D', 'Sweater', 'Midi skirt', 'Trims'],
  ['athleisure', 'Athleisure', 'Active', 'rare', 1, '#6B3FD0', '#1B1F2A', '#2BA36B', 'Sports top', 'Leggings', 'Trims'],
  ['lbd', 'Little Black Dress', 'Evening', 'epic', 1, '#1B1F2A', '#1B1F2A', '#FFC83D', 'Dress', 'Heels', 'Trims'],
  ['sundress', 'Sundress', 'Casual', 'rare', 1, '#FFC83D', '#C9B79C', '#F2F6FF', 'Dress', 'Sandals', 'Trims'],
  ['coverall', 'Mechanic', 'Work', 'uncommon', 1, '#2F5BD8', '#1B1F2A', '#FF8A3C', 'Coverall', 'Boots', 'Trims'],
  ['cardigan', 'Cardigan Café', 'Casual', 'uncommon', 1, '#FFC83D', '#F2F6FF', '#F2F6FF', 'Cardigan', 'Tee', 'Buttons'],
  ['shirtslacks', 'Shirt & Slacks', 'Work', 'uncommon', 1, '#F2F6FF', '#2A3142', '#FFC83D', 'Shirt', 'Trousers', 'Trims'],
  ['mono', 'Monochrome', 'Evening', 'rare', 1, '#1B1F2A', '#1B1F2A', '#FFC83D', 'Outfit', 'Boots', 'Trims'],
  ['skater', 'Skater', 'Street', 'uncommon', 1, '#FF8A3C', '#C9B79C', '#F2F6FF', 'Tee', 'Shorts', 'Trims'],
  ['officeknit', 'Office Knit', 'Work', 'uncommon', 1, '#C9B79C', '#2A3142', '#FFC83D', 'Sweater', 'Trousers', 'Trims'],
  ['shirtdress', 'Shirt Dress', 'Casual', 'rare', 1, '#C9B79C', '#F2F6FF', '#7A4B2A', 'Dress', 'Sneakers', 'Trims'],
  ['track', 'Track Star', 'Active', 'rare', 1, '#2F5BD8', '#F2F6FF', '#F2F6FF', 'Tracksuit', 'Tee', 'Stripes'],
  ['utility', 'Utility Hoodie', 'Street', 'epic', 1, '#5A6B3A', '#2A3142', '#FF8A3C', 'Vest', 'Hoodie', 'Trims'],
  ['rock', 'Rock Edit', 'Street', 'epic', 13, '#1B1F2A', '#B3122E', '#F2F6FF', 'Leather', 'Skirt', 'Tee'],
  ['biker', 'Biker Night', 'Street', 'legendary', 14, '#1B1F2A', '#2A3142', '#B3122E', 'Leather', 'Leggings', 'Tank'],
  ['festival', 'Festival', 'Casual', 'rare', 15, '#F2F6FF', '#4A6FA5', '#FF6FAE', 'Tank', 'Shorts', 'Trims'],
  ['puffer', 'Puffer Peak', 'Casual', 'epic', 16, '#FF8A3C', '#1B1F2A', '#FFC83D', 'Puffer', 'Turtleneck', 'Zip'],
  ['jumpsuit', 'Jumpsuit', 'Evening', 'epic', 18, '#2BA36B', '#C9B79C', '#FFC83D', 'Jumpsuit', 'Heels', 'Belt'],
  ['varsity', 'Varsity', 'Street', 'legendary', 20, '#B3122E', '#1B1F2A', '#F2F6FF', 'Jacket', 'Skirt', 'Sleeves'],
  ['bodycon', 'Evening Bodycon', 'Evening', 'legendary', 22, '#B3122E', '#1B1F2A', '#FFC83D', 'Dress', 'Heels', 'Trims'],
  ['powershorts', 'Power Shorts', 'Work', 'legendary', 25, '#FF6FAE', '#F2F6FF', '#FFC83D', 'Suit', 'Blouse', 'Buttons'],
];

export const OUTFITS: Outfit[] = META.map(([id, name, cat, rarity, , p, s, a, lp, ls, la]) => ({
  id,
  name,
  cat,
  rarity,
  level: levelOf('outfit:' + id),
  def: { p, s, a },
  labels: { p: lp, s: ls, a: la },
  ...RECIPES[id],
}));

const BY_ID = new Map(OUTFITS.map((o) => [o.id, o]));

export function outfitById(id: OutfitId): Outfit {
  return BY_ID.get(id) ?? BY_ID.get('runner')!;
}

export function isOutfitId(v: unknown): v is OutfitId {
  return typeof v === 'string' && BY_ID.has(v as OutfitId);
}

export const CATEGORIES: ('All' | OutfitCategory)[] = ['All', 'Casual', 'Street', 'Work', 'Active', 'Evening', 'Traditional'];

export const RARITY: Record<Rarity, { name: string; grad: string; light: string }> = {
  uncommon: { name: 'Uncommon', grad: 'var(--qb-low)', light: '#7CF59A' },
  rare: { name: 'Rare', grad: 'var(--qb-normal)', light: '#7DCBFF' },
  epic: { name: 'Epic', grad: 'var(--qb-high)', light: '#DDA0FF' },
  legendary: { name: 'Legendary', grad: 'var(--qb-urgent)', light: '#FFC46B' },
};

/** The 12 outfit colours (AVATAR.md §3). */
export const PALETTE: [string, string][] = [
  ['#F2F6FF', 'white'], ['#1B1F2A', 'black'], ['#4A6FA5', 'denim'], ['#C9B79C', 'camel'],
  ['#B3122E', 'crimson'], ['#FF6FAE', 'pink'], ['#FF8A3C', 'orange'], ['#FFC83D', 'gold'],
  ['#2BA36B', 'green'], ['#1F7F86', 'teal'], ['#2F5BD8', 'royal blue'], ['#6B3FD0', 'purple'],
];
export const HAIR_COLORS = ['#1A1420', '#2A1A14', '#5A3220', '#8A4B26', '#C98A3E', '#E8D3A0', '#FF6FAE', '#7B5CFF'];
export const SKINS = ['#F8DCC8', '#F1C6A7', '#E2A985', '#C98B66', '#A86D4A', '#8A5638', '#6A3F28', '#4A2C1C'];
export const HAIR_STYLES: [HairStyle, string][] = [
  ['braid', 'Braid'], ['ponytail', 'Ponytail'], ['bun', 'Bun'], ['bob', 'Bob'],
  ['long', 'Long'], ['curly', 'Curly'], ['pixie', 'Pixie'], ['spacebuns', 'Space buns'],
];
export const ACCESSORIES: [AccessoryId, string][] = [
  ['glasses', 'Glasses'], ['sunglasses', 'Sunglasses'], ['hoops', 'Hoops'], ['jhumkas', 'Jhumkas'],
  ['necklace', 'Necklace'], ['cap', 'Cap'], ['beanie', 'Beanie'], ['headphones', 'Headphones'],
  ['crossbody', 'Crossbody'], ['backpack', 'Backpack'], ['watch', 'Watch'], ['bangles', 'Bangles'], ['bindi', 'Bindi'],
];
const EXCLUSIVE: Partial<Record<AccessoryId, AccessoryId>> = {
  glasses: 'sunglasses', sunglasses: 'glasses', hoops: 'jhumkas', jhumkas: 'hoops', cap: 'beanie', beanie: 'cap',
};
export const SAREES: OutfitId[] = ['saree', 'sareeKanji', 'sareeParty', 'nauvari'];

/** Toggle an accessory, dropping its mutually exclusive partner. */
export function toggleAccessory(list: AccessoryId[], k: AccessoryId): AccessoryId[] {
  if (list.includes(k)) return list.filter((x) => x !== k);
  const other = EXCLUSIVE[k];
  return [...list.filter((x) => x !== other), k];
}

/** The Locker's suggested look for a saree: jhumkas, bangles, bindi and a bun. */
export function sareeLook(list: AccessoryId[]): { accessories: AccessoryId[]; hairStyle: HairStyle } {
  const drop: AccessoryId[] = ['hoops', 'crossbody', 'backpack', 'cap', 'beanie', 'headphones'];
  const keep = list.filter((k) => !drop.includes(k));
  for (const k of ['jhumkas', 'bangles', 'bindi'] as AccessoryId[]) if (!keep.includes(k)) keep.push(k);
  return { accessories: keep, hairStyle: 'bun' };
}

// ---- player ↔ look -----------------------------------------------------------------------

const HEX = /^#[0-9a-f]{6}$/i;

export function colorsFor(player: Player, id: OutfitId): Required<OutfitColors> {
  return { ...outfitById(id).def, ...(player.outfitColors[id] ?? {}) };
}

/** Nova as the player has styled her, optionally in another outfit (Locker previews). */
export function lookFor(player: Player, outfit: OutfitId = player.outfit, lite = false): Look {
  const c = colorsFor(player, outfit);
  return {
    outfit,
    primary: c.p,
    secondary: c.s,
    accent: c.a,
    hairStyle: player.hairStyle,
    hair: player.hair,
    skin: player.skin,
    accessories: player.accessories,
    lite,
  };
}

const OLD_DEFAULTS = { hair: '#3A2218', skin: '#E8B48F' };
const HAIR_STYLE_IDS = HAIR_STYLES.map(([h]) => h);
const ACCESSORY_IDS = ACCESSORIES.map(([a]) => a);
const EMOTE_IDS: EmoteId[] = [
  'victory', 'thumkas', 'wave', 'dab', 'floss', 'clap', 'spin', 'jacks', 'salute', 'namaste',
  'bhangra', 'shrug', 'laugh', 'flex', 'heart', 'headbang', 'disco', 'robot', 'garba', 'bow',
];

/**
 * Turn whatever is stored (or imported) into a valid player. Handles the earlier
 * six-outfit Nova: unknown outfits fall back to Street Runner and old colour overrides
 * are dropped (they were for different garments); the old default hair and skin become
 * the new defaults, anything she picked is kept.
 */
export function normalizePlayer(raw: unknown): Player {
  const p = (raw && typeof raw === 'object' ? raw : {}) as Record<string, any>;
  const colors: Player['outfitColors'] = {};
  if (p.outfitColors && typeof p.outfitColors === 'object' && p.hairStyle) {
    for (const [id, c] of Object.entries(p.outfitColors as Record<string, any>)) {
      if (!isOutfitId(id) || !c || typeof c !== 'object') continue;
      const o: OutfitColors = {};
      for (const k of ['p', 's', 'a'] as const) if (typeof c[k] === 'string' && HEX.test(c[k])) o[k] = c[k];
      if (Object.keys(o).length) colors[id] = o;
    }
  }
  const hex = (v: unknown, old: string, def: string) => (typeof v === 'string' && HEX.test(v) && v.toUpperCase() !== old ? v : def);
  return {
    outfit: isOutfitId(p.outfit) ? p.outfit : DEFAULT_PLAYER.outfit,
    outfitColors: colors,
    hairStyle: HAIR_STYLE_IDS.includes(p.hairStyle) ? p.hairStyle : DEFAULT_PLAYER.hairStyle,
    hair: hex(p.hair, OLD_DEFAULTS.hair, DEFAULT_PLAYER.hair),
    skin: hex(p.skin, OLD_DEFAULTS.skin, DEFAULT_PLAYER.skin),
    accessories: Array.isArray(p.accessories)
      ? [...new Set((p.accessories as unknown[]).filter((a): a is AccessoryId => ACCESSORY_IDS.includes(a as AccessoryId)))]
      : [...DEFAULT_PLAYER.accessories],
    victoryEmote: EMOTE_IDS.includes(p.victoryEmote) ? p.victoryEmote : DEFAULT_PLAYER.victoryEmote,
    best: Number.isInteger(p.best) && p.best > 0 ? Math.min(p.best, 9999) : 0,
    unseen: Array.isArray(p.unseen) ? [...new Set((p.unseen as unknown[]).filter(isRewardKey))] : [],
    kept: Array.isArray(p.kept) ? [...new Set((p.kept as unknown[]).filter(isRewardKey))] : [],
  };
}

// ---- drawing ------------------------------------------------------------------------------

const SLEEVE: Record<Top, 'none' | 'short' | 'long'> = {
  tee: 'short', tank: 'none', shirt: 'short', sareeb: 'short', sareebsl: 'none',
  longsleeve: 'long', turtle: 'long', blouse: 'long', hoodie: 'long', sweater: 'long',
};

function hexToRgb(h: string): [number, number, number] {
  let s = String(h || '#000000').replace('#', '');
  if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
  let n = parseInt(s, 16);
  if (Number.isNaN(n)) n = 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(h: string, t: string, amt: number): string {
  const a = hexToRgb(h);
  const b = hexToRgb(t);
  return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * amt).toString(16).padStart(2, '0')).join('');
}
const L = (h: string, a: number) => mix(h, '#FFFFFF', a);
const D = (h: string, a: number) => mix(h, '#000000', a);
function lum(h: string) {
  const c = hexToRgb(h);
  return (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255;
}

let instance = 0;
/** Random per page load, so ids can't collide even across separately loaded copies of this module. */
const SESSION = Math.random().toString(36).slice(2, 6);

/** The port of Avatar.dc.html renderVals(): which layers to draw and in what colours. */
function vals(look: Look, w: number, h: number): AvatarVals {
  // Every gradient, pattern and filter id gets a per-instance prefix: many Novas share a page.
  const uid = 'nv' + SESSION + (++instance).toString(36);
  const o = outfitById(look.outfit);
  const p = look.primary || o.def.p;
  const s = look.secondary || o.def.s;
  const a = look.accent || o.def.a;
  const col = (k: Src | undefined) => (k === 'p' ? p : k === 's' ? s : k === 'a' ? a : k || p);
  const topC = col(o.c.top);
  const outC = col(o.c.outer);
  const botC = col(o.c.bottom);
  const shoeC = col(o.c.shoe);
  const hasOuter = !!o.outer;
  const sleeveKind = hasOuter && o.outer !== 'vest' ? 'long' : SLEEVE[o.top] || 'none';
  const slvC = hasOuter && o.outer !== 'vest' ? (o.sleeves ? col(o.sleeves) : outC) : topC;
  const acc = new Set(look.accessories);
  const hs = look.hairStyle || 'braid';
  const hat = acc.has('cap') || acc.has('beanie');
  const hair = look.hair || '#2A1A14';
  const skin = look.skin || '#C98B66';
  const full = !look.lite;
  const b = o.bottom;
  const capC = a;
  return {
    w,
    h,
    uid,
    label: 'Nova wearing ' + o.name,
    full,
    rimFilter: full ? `url(#${uid}Rim)` : 'none',
    accent: a,
    skin, skinL: L(skin, 0.22), skinD: D(skin, 0.22),
    hair, hairL: L(hair, 0.3), hairD: D(hair, 0.4),
    topC, topL: L(topC, 0.22), topD: D(topC, 0.28),
    outC, outL: L(outC, 0.25), outD: D(outC, 0.35),
    botC, botL: L(botC, 0.18), botD: D(botC, 0.32),
    slvC, slvL: L(slvC, 0.25), slvD: D(slvC, 0.32),
    shoeL: L(shoeC, 0.25), shoeD: D(shoeC, 0.22),
    sole: lum(shoeC) > 0.6 ? '#8A93A6' : '#E6E9F0',
    beltC: b === 'wide' && o.top === 'tank' ? a : '#1B1F2A',
    beltL: '#3A4152',
    capC, capD: D(capC, 0.3),

    sSneakers: o.shoes === 'sneakers', sHigh: o.shoes === 'hightops', sBoots: o.shoes === 'boots',
    sHeels: o.shoes === 'heels', sLoafers: o.shoes === 'loafers', sSandals: o.shoes === 'sandals', sFlats: o.shoes === 'flats',
    shoesUnder: b === 'wide' || b === 'saree',
    shoesOver: !(b === 'wide' || b === 'saree'),

    bPants: b === 'joggers' || b === 'cargo' || b === 'jeans',
    bJoggers: b === 'joggers', bCargo: b === 'cargo', bJeans: b === 'jeans',
    bLeggings: b === 'leggings', bWide: b === 'wide', bShorts: b === 'shorts', bPleated: b === 'pleated',
    bMidi: b === 'midi', bPencil: b === 'pencil', bAline: b === 'aline',
    skirtSaree: b === 'saree', bNauvari: b === 'nauvari',
    kanji: o.drape === 'kanjivaram', party: o.drape === 'party',
    niviBorder: o.drape === 'nivi',
    sheerSkirt: o.drape === 'party' ? 0.62 : 1,
    sheerPallu: o.drape === 'party' ? 0.48 : 1,
    palluBack: !!o.drape,
    palluDiag: !!o.drape,
    palluEdge: o.drape === 'kanjivaram' ? `url(#${uid}Gold)` : a,
    borderW: o.drape === 'kanjivaram' ? 6 : o.drape === 'party' ? 2 : 3,
    blouseD:
      o.top === 'sareebsl'
        ? 'M79 67 C82 64.5 85 63 87.5 62.5 C92 73 108 73 112.5 62.5 C115 63 118 64.5 121 67 L126 104 C112 107 88 107 74 104 Z'
        : 'M71 72 C77 66 85 63 88 62 C93 70 107 70 112 62 C115 63 123 66 129 72 L126 104 C112 107 88 107 74 104 Z',
    botDenim: b === 'jeans' || (b === 'shorts' && !!o.denim),
    belt: !!o.belt || b === 'jeans' || b === 'cargo' || (b === 'shorts' && !!o.denim) || o.id === 'runner',

    tTeeBody: ['tee', 'longsleeve', 'turtle', 'blouse', 'shirt', 'sweater'].includes(o.top),
    tTank: o.top === 'tank', tTurtle: o.top === 'turtle', tCollar: o.top === 'blouse' || o.top === 'shirt',
    tSweater: o.top === 'sweater', tHoodie: o.top === 'hoodie', tSareeB: o.top === 'sareeb' || o.top === 'sareebsl',

    hasOuter,
    oBomber: o.outer === 'bomber', oDenim: o.outer === 'denim', oBlazer: o.outer === 'blazer', oLeather: o.outer === 'leather',
    oTrench: o.outer === 'trench', oPuffer: o.outer === 'puffer', oVest: o.outer === 'vest', oCardigan: o.outer === 'cardigan',
    oBadge: o.outer === 'bomber' && !o.stripes && !o.sleeves,
    slvLong: sleeveKind === 'long', slvShort: sleeveKind === 'short',
    slvPuffy: o.outer === 'puffer', slvStripe: !!o.stripes,

    hBraid: hs === 'braid', hPony: hs === 'ponytail', hLong: hs === 'long', hCurly: hs === 'curly',
    hBob: hs === 'bob', hPixie: hs === 'pixie',
    hCapBack: ['braid', 'ponytail', 'bun', 'long', 'spacebuns'].includes(hs),
    hBangsPart: hs === 'braid' || hs === 'long',
    hSleek: hs === 'ponytail' || hs === 'bun' || hs === 'spacebuns',
    showBun: hs === 'bun' && !hat, showBuns: hs === 'spacebuns' && !hat,
    hTie: (hs === 'braid' || hs === 'ponytail') && !hat,

    aGlasses: acc.has('glasses') && !acc.has('sunglasses'), aSunglasses: acc.has('sunglasses'),
    aHoops: acc.has('hoops'), aJhumkas: acc.has('jhumkas') && !acc.has('hoops'), aStuds: !acc.has('hoops') && !acc.has('jhumkas'),
    aNecklace: acc.has('necklace'), aCap: acc.has('cap'), aBeanie: acc.has('beanie') && !acc.has('cap'),
    aHeadphones: acc.has('headphones'), aCrossbody: acc.has('crossbody'), aBackpack: acc.has('backpack'),
    aWatch: acc.has('watch'), aBangles: acc.has('bangles'), aBindi: acc.has('bindi'),
  };
}

/**
 * SVG markup for Nova in a look. `width`/`height` scale her (viewBox stays 200 × 300, so
 * the emote keyframes, written in SVG units, scale with her).
 */
export function avatarSvg(look: Look, size: { width?: number; height?: number } = {}): string {
  const w = size.width ?? 200;
  const h = size.height ?? (w * 300) / 200;
  return renderAvatarSvg(vals(look, w, h));
}
