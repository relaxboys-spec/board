import type { AccessoryId, EmoteId, HairStyle, OutfitId, Player } from './types';

/**
 * The Reward Track: what Nova starts with and what each level unlocks.
 *
 * Keys are "kind:id" — outfit:<OutfitId>, style:<HairStyle>, hair:<hex>, color:<palette hex>,
 * acc:<AccessoryId>, emote:<EmoteId>. Skin tones are never locked.
 *
 * Unlocks are kept forever: they follow the highest level she has reached (player.best),
 * so un-completing a note never takes clothes away. Anything she was already wearing when
 * the track arrived is kept too (player.kept).
 */

export type RewardKind = 'outfit' | 'style' | 'hair' | 'color' | 'acc' | 'emote';

export const STARTER: string[] = [
  'outfit:runner', 'outfit:hoodie', 'outfit:summer', 'outfit:shirtslacks', 'outfit:athleisure',
  'style:braid', 'style:ponytail',
  'hair:#1A1420', 'hair:#2A1A14', 'hair:#5A3220',
  'color:#F2F6FF', 'color:#1B1F2A', 'color:#4A6FA5', 'color:#C9B79C',
  'acc:crossbody', 'acc:watch',
  'emote:victory', 'emote:wave', 'emote:clap',
];

export interface TrackLevel {
  level: number;
  /** Milestones (every 5 levels) get a name and a bigger reveal. */
  title?: string;
  keys: string[];
}

export const TRACK: TrackLevel[] = [
  { level: 2, keys: ['outfit:denim', 'emote:dab', 'color:#B3122E'] },
  { level: 3, keys: ['outfit:knit', 'style:bun', 'hair:#8A4B26'] },
  { level: 4, keys: ['outfit:tennis', 'acc:sunglasses', 'emote:namaste'] },
  { level: 5, title: 'Festive Pack', keys: ['outfit:saree', 'acc:jhumkas', 'acc:bindi', 'emote:thumkas'] },
  { level: 6, keys: ['outfit:cardigan', 'color:#FFC83D', 'emote:heart'] },
  { level: 7, keys: ['outfit:cargo', 'style:long', 'acc:cap'] },
  { level: 8, keys: ['outfit:trench', 'color:#2BA36B', 'emote:spin'] },
  { level: 9, keys: ['outfit:skater', 'acc:hoops', 'hair:#C98A3E'] },
  { level: 10, title: 'Party Night', keys: ['outfit:sareeParty', 'acc:bangles', 'emote:garba', 'color:#6B3FD0'] },
  { level: 11, keys: ['outfit:coverall', 'acc:headphones', 'emote:floss'] },
  { level: 12, keys: ['outfit:officeknit', 'style:curly', 'color:#1F7F86'] },
  { level: 13, keys: ['outfit:shirtdress', 'acc:glasses', 'emote:salute'] },
  { level: 14, keys: ['outfit:boardroom', 'acc:necklace', 'color:#2F5BD8'] },
  { level: 15, title: 'Nine Yards', keys: ['outfit:nauvari', 'emote:bhangra', 'hair:#E8D3A0'] },
  { level: 16, keys: ['outfit:track', 'style:bob', 'emote:jacks'] },
  { level: 17, keys: ['outfit:mono', 'acc:backpack', 'color:#FF6FAE'] },
  { level: 18, keys: ['outfit:utility', 'emote:shrug'] },
  { level: 19, keys: ['outfit:festival', 'acc:beanie', 'color:#FF8A3C'] },
  { level: 20, title: 'Temple Silk', keys: ['outfit:sareeKanji', 'emote:disco', 'hair:#FF6FAE'] },
  { level: 21, keys: ['outfit:rock', 'emote:laugh'] },
  { level: 22, keys: ['outfit:puffer', 'style:pixie'] },
  { level: 23, keys: ['outfit:jumpsuit', 'emote:flex'] },
  { level: 24, keys: ['outfit:lbd', 'hair:#7B5CFF'] },
  { level: 25, title: 'Varsity Legend', keys: ['outfit:varsity', 'emote:robot'] },
  { level: 26, keys: ['outfit:sundress', 'emote:headbang'] },
  { level: 27, keys: ['outfit:biker', 'style:spacebuns'] },
  { level: 28, keys: ['outfit:bodycon'] },
  { level: 29, keys: ['emote:bow'] },
  { level: 30, title: 'Boss Mode', keys: ['outfit:powershorts'] },
];

export const TRACK_END = TRACK[TRACK.length - 1].level;

const LEVEL_OF = new Map<string, number>();
for (const k of STARTER) LEVEL_OF.set(k, 1);
for (const t of TRACK) for (const k of t.keys) LEVEL_OF.set(k, t.level);

export const ALL_KEYS = [...LEVEL_OF.keys()];

export const key = {
  outfit: (id: OutfitId) => 'outfit:' + id,
  style: (id: HairStyle) => 'style:' + id,
  hair: (hex: string) => 'hair:' + hex.toUpperCase(),
  color: (hex: string) => 'color:' + hex.toUpperCase(),
  acc: (id: AccessoryId) => 'acc:' + id,
  emote: (id: EmoteId) => 'emote:' + id,
};

export function kindOf(k: string): RewardKind {
  return k.slice(0, k.indexOf(':')) as RewardKind;
}

export function idOf(k: string): string {
  return k.slice(k.indexOf(':') + 1);
}

/** The level a reward unlocks at (1 = from the start; anything not on the track is free). */
export function levelOf(k: string): number {
  return LEVEL_OF.get(k) ?? 1;
}

export function isRewardKey(k: unknown): k is string {
  return typeof k === 'string' && LEVEL_OF.has(k);
}

export function isUnlocked(p: Pick<Player, 'best' | 'kept'>, k: string): boolean {
  return levelOf(k) <= Math.max(1, p.best) || p.kept.includes(k);
}

/** Rewards for the levels after `from`, up to and including `to`. */
export function rewardsBetween(from: number, to: number): string[] {
  return TRACK.filter((t) => t.level > from && t.level <= to).flatMap((t) => t.keys);
}

export function trackLevel(level: number): TrackLevel | undefined {
  return TRACK.find((t) => t.level === level);
}

/** The next level on the track after `best` (undefined once the track is complete). */
export function nextOnTrack(best: number): TrackLevel | undefined {
  return TRACK.find((t) => t.level > best);
}

/** The headline reward of a level: its outfit if it has one, else its first reward. */
export function headline(t: TrackLevel): string {
  return t.keys.find((k) => kindOf(k) === 'outfit') ?? t.keys[0];
}

/** What she is wearing that the track would lock — kept when the track first arrives. */
export function wornKeys(p: Player): string[] {
  return [
    key.outfit(p.outfit),
    key.style(p.hairStyle),
    key.hair(p.hair),
    ...p.accessories.map(key.acc),
    key.emote(p.victoryEmote),
  ].filter(isRewardKey);
}

export function unlockedCount(p: Pick<Player, 'best' | 'kept'>): number {
  return ALL_KEYS.filter((k) => isUnlocked(p, k)).length;
}
