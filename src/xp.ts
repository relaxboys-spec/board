import type { Note } from './types';
import { dayKey } from './util';

/**
 * XP and streak are derived from completed notes rather than stored separately,
 * so undo, "put back", and import can never leave them out of sync.
 */

export interface Stats {
  xp: number;
  level: number;
  /** XP earned inside the current level, and XP the level needs in total. */
  into: number;
  need: number;
  streak: number;
  doneToday: number;
}

export const XP_PER_LEVEL = 1000;

/**
 * XP a level needs: 300 for Level 1, then 100 more each level up to the full 1000 from
 * Level 8 on, so the first rewards come within a day or two of normal use.
 */
export function needFor(level: number) {
  return Math.min(XP_PER_LEVEL, 200 + 100 * level);
}

export function levelFor(xp: number) {
  let level = 1;
  let rest = Math.max(0, xp);
  while (rest >= needFor(level)) {
    rest -= needFor(level);
    level++;
  }
  return { level, into: rest, need: needFor(level) };
}

/** Total XP needed to reach a level. */
export function xpToReach(level: number) {
  let xp = 0;
  for (let l = 1; l < level; l++) xp += needFor(l);
  return xp;
}

export function computeStats(done: Note[], now = Date.now()): Stats {
  let xp = 0;
  const days = new Set<string>();
  const today = dayKey(now);
  let doneToday = 0;
  for (const n of done) {
    xp += n.xp ?? 0;
    if (n.completedAt) {
      const k = dayKey(n.completedAt);
      days.add(k);
      if (k === today) doneToday++;
    }
  }
  // A streak survives until the end of today: if nothing's done yet today, count from yesterday.
  let streak = 0;
  const cursor = new Date(now);
  if (!days.has(today)) cursor.setDate(cursor.getDate() - 1);
  while (days.has(dayKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return { xp, ...levelFor(xp), streak, doneToday };
}
