export type BoardId = 'work' | 'personal';
/** today / week are the board's columns; someday lives in the Backlog drawer. */
export type ZoneId = 'today' | 'week' | 'someday';
export type Priority = 'low' | 'normal' | 'high' | 'urgent';
export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export type NoteStatus = 'active' | 'done';
export type Tool = 'pen' | 'highlighter' | 'eraser' | 'lasso';

export const BOARDS: BoardId[] = ['work', 'personal'];
export const ZONES: ZoneId[] = ['today', 'week', 'someday'];
export const PRIORITIES: Priority[] = ['low', 'normal', 'high', 'urgent'];
export const WEEKDAYS: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export const BOARD_LABEL: Record<BoardId, string> = { work: 'Work', personal: 'Personal' };
export const ZONE_LABEL: Record<ZoneId, string> = { today: 'Today', week: 'This Week', someday: 'Someday' };
export const WEEKDAY_LABEL: Record<Weekday, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
};

export interface PriorityStyle {
  label: string;
  xp: number;
  /** Frame gradient (CSS) and the solid stops it's made of (canvas). */
  grad: string;
  from: string;
  to: string;
  /** Label colour on dark surfaces. */
  light: string;
}

export const PRIORITY: Record<Priority, PriorityStyle> = {
  low: { label: 'Low', xp: 25, grad: 'var(--qb-low)', from: '#5BE07A', to: '#1F8F3C', light: '#7CF59A' },
  normal: { label: 'Normal', xp: 50, grad: 'var(--qb-normal)', from: '#4CB8FF', to: '#1652C4', light: '#7DCBFF' },
  high: { label: 'High', xp: 100, grad: 'var(--qb-high)', from: '#D06BFF', to: '#5E1FC0', light: '#DDA0FF' },
  urgent: { label: 'Urgent', xp: 150, grad: 'var(--qb-urgent)', from: '#FFB547', to: '#D2550E', light: '#FFC46B' },
};

/** A single point: x, y in page units (PAGE_W × PAGE_H), pressure 0..1. */
export type InkPoint = [number, number, number];

export interface Stroke {
  color: string;
  /** Base nib width in page units. */
  size: number;
  /** Average pencil tilt 0 (upright) .. 1 (flat on its side). Widens + softens the stroke. */
  tilt: number;
  points: InkPoint[];
  /** Missing = pen. */
  tool?: 'pen' | 'highlighter';
}

export interface Reminder {
  label: string;
  /** ISO 8601 with UTC offset, e.g. 2026-10-05T15:30:00+05:30 */
  due: string;
}

export interface Note {
  id: string;
  board: BoardId;
  zone: ZoneId;
  /** Day chip for This Week notes. */
  due?: Weekday;
  /** The actual date behind `due` ('YYYY-MM-DD'): on that day the note moves into Today. */
  dueDate?: string;
  /** When the note last entered Today (for the "Day 2" age chip). Missing = createdAt. */
  todaySince?: number;
  /** In progress since (active tasks only; cleared when completed or paused). */
  startedAt?: number;
  /** Order within its column (ascending). */
  z: number;
  priority: Priority;
  /** Pencil ink on the note's page (PAGE_W × PAGE_H units). */
  strokes: Stroke[];
  createdAt: number;
  updatedAt: number;
  reminder?: Reminder;
  status: NoteStatus;
  completedAt?: number;
  /** XP awarded when completed (priority at that moment). */
  xp?: number;
  /** Typed or dictated text. */
  text?: string;
  /** Ordered photo ids (bytes live in the `images` store). */
  imageIds?: string[];
  /** Pencil markup per photo, normalised to the photo's longest edge (0..1). */
  markup?: Record<string, Stroke[]>;
}

export interface InkColor {
  id: string;
  label: string;
  value: string;
}

/** Light inks: notes are dark cards now. */
export const INK_COLORS: InkColor[] = [
  { id: 'white', label: 'White', value: '#F2F6FF' },
  { id: 'yellow', label: 'Yellow', value: '#FFE14D' },
  { id: 'cyan', label: 'Cyan', value: '#3BE0FF' },
  { id: 'pink', label: 'Pink', value: '#FF6FAE' },
];

/** Nib sizes in page units (the page is 1000 units wide). */
export const PEN_SIZE = 11;
export const HIGHLIGHTER_SIZE = 38;

export interface Settings {
  inkColor: string;
  tool: Tool;
  sound: boolean;
}

export interface ViewState {
  board: BoardId;
}

/** Nova's wardrobe (design/quest-board/AVATAR.md §2). */
export type OutfitId =
  | 'runner' | 'denim' | 'boardroom' | 'biker' | 'hoodie' | 'trench' | 'summer' | 'tennis' | 'cargo'
  | 'knit' | 'puffer' | 'athleisure' | 'lbd' | 'sundress' | 'jumpsuit' | 'coverall' | 'cardigan'
  | 'varsity' | 'shirtslacks' | 'mono' | 'skater' | 'festival' | 'officeknit' | 'bodycon' | 'shirtdress'
  | 'track' | 'rock' | 'powershorts' | 'utility' | 'saree' | 'sareeKanji' | 'sareeParty' | 'nauvari';

export type HairStyle = 'braid' | 'ponytail' | 'bun' | 'bob' | 'long' | 'curly' | 'pixie' | 'spacebuns';

export type AccessoryId =
  | 'glasses' | 'sunglasses' | 'hoops' | 'jhumkas' | 'necklace' | 'cap' | 'beanie'
  | 'headphones' | 'crossbody' | 'backpack' | 'watch' | 'bangles' | 'bindi';

export type EmoteId =
  | 'victory' | 'thumkas' | 'wave' | 'dab' | 'floss' | 'clap' | 'spin' | 'jacks' | 'salute' | 'namaste'
  | 'bhangra' | 'shrug' | 'laugh' | 'flex' | 'heart' | 'headbang' | 'disco' | 'robot' | 'garba' | 'bow';

/** A player's overrides of an outfit's three colour slots (missing = the outfit's default). */
export interface OutfitColors {
  p?: string;
  s?: string;
  a?: string;
}

export interface Player {
  outfit: OutfitId;
  outfitColors: Partial<Record<OutfitId, OutfitColors>>;
  hairStyle: HairStyle;
  hair: string;
  skin: string;
  accessories: AccessoryId[];
  /** Played when a note is completed. */
  victoryEmote: EmoteId;
  /** Highest level reached — Reward Track unlocks follow it and are never taken back (0 = not set up yet). */
  best: number;
  /** Unlocked rewards she hasn't looked at yet (rewards.ts keys) — the NEW badges. */
  unseen: string[];
  /** Rewards kept regardless of level (what she was wearing when the track arrived). */
  kept: string[];
}

/** Everything needed to draw Nova (AVATAR.md). */
export interface Look {
  outfit: OutfitId;
  primary?: string;
  secondary?: string;
  accent?: string;
  hairStyle: HairStyle;
  hair: string;
  skin: string;
  accessories: AccessoryId[];
  /** Thumbnails: no blur filters, no rim light. */
  lite?: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  inkColor: INK_COLORS[0].value,
  tool: 'pen',
  sound: false,
};

export const DEFAULT_PLAYER: Player = {
  outfit: 'runner',
  outfitColors: {},
  hairStyle: 'braid',
  hair: '#2A1A14',
  skin: '#C98B66',
  accessories: ['crossbody'],
  victoryEmote: 'victory',
  best: 0,
  unseen: [],
  kept: [],
};

/** The note page every surface draws from (cards fit its content; the editor shows all of it). */
export const PAGE_W = 1000;
export const PAGE_H = 800;
