import { PAGE_H, PAGE_W, type Note, type Priority, type Settings, type Stroke } from './types';

/**
 * Upgrading data from the free-form board (schema ≤ 2, backups ≤ 2) to the grid design.
 * Used by the IndexedDB v3 migration and by importing older backups, so both paths
 * produce identical notes.
 *
 *   rarity → priority      common/rare → normal, uncommon → low, epic → high, legendary → urgent
 *   ink                    240×240 card units → the 1000×800 page (centred, scaled to its height)
 *   dark inks              → light equivalents (cards are dark now)
 *   x / y / stackId        dropped (the grid places notes; stacks are gone)
 */

const RARITY_TO_PRIORITY: Record<string, Priority> = {
  common: 'normal',
  uncommon: 'low',
  rare: 'normal',
  epic: 'high',
  legendary: 'urgent',
};

/** The old palette (dark on light cards) → the new light inks. */
const INK_MAP: Record<string, string> = {
  '#1d1b2e': '#F2F6FF',
  '#1f3a93': '#3BE0FF',
  '#c62828': '#FF6FAE',
  '#17803a': '#7CF59A',
  '#6a1b9a': '#DDA0FF',
  '#b4530a': '#FFE14D',
};

function luminance(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return 1;
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => c / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function lightInk(color: string): string {
  const mapped = INK_MAP[color.toLowerCase()];
  if (mapped) return mapped;
  return luminance(color) < 0.45 ? '#F2F6FF' : color;
}

const OLD_CARD = 240;
const K = PAGE_H / OLD_CARD;
const OFFSET_X = (PAGE_W - OLD_CARD * K) / 2;

function upgradeStroke(s: Stroke): Stroke {
  return {
    color: lightInk(s.color),
    size: Math.round(s.size * K * 100) / 100,
    tilt: s.tilt ?? 0,
    points: s.points.map(([x, y, p]) => [Math.round((x * K + OFFSET_X) * 100) / 100, Math.round(y * K * 100) / 100, p]),
  };
}

export function isLegacyNote(raw: any): boolean {
  return !!raw && raw.priority === undefined && typeof raw.rarity === 'string';
}

/** Convert one stored/backed-up note to the current shape. Already-current notes pass through. */
export function upgradeNote(raw: any): Note {
  if (!isLegacyNote(raw)) return raw as Note;
  const note: Note = {
    id: raw.id,
    board: raw.board,
    zone: raw.zone,
    z: raw.z,
    priority: RARITY_TO_PRIORITY[raw.rarity] ?? 'normal',
    strokes: (raw.strokes ?? []).map(upgradeStroke),
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    status: raw.status,
  };
  if (raw.reminder) note.reminder = raw.reminder;
  if (raw.completedAt) note.completedAt = raw.completedAt;
  if (raw.xp) note.xp = raw.xp;
  if (raw.text) note.text = raw.text;
  if (raw.imageIds?.length) note.imageIds = raw.imageIds;
  if (raw.markup) note.markup = raw.markup;
  return note;
}

export function upgradeSettings(raw: any): Partial<Settings> {
  if (!raw) return {};
  const out: Partial<Settings> = { sound: !!raw.sound };
  if (typeof raw.inkColor === 'string') out.inkColor = lightInk(raw.inkColor);
  if (raw.tool) out.tool = raw.tool;
  return out;
}
