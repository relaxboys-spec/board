import { WEEKDAYS, type Weekday } from './types';
import { dayKey } from './util';

/**
 * Local calendar-day helpers. Days are 'YYYY-MM-DD' keys in the iPad's time zone, which
 * compare correctly as strings and don't drift across daylight-saving changes.
 */

/** Midnight (local) at the start of a day key. */
export function dayStart(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}

/** Whole days from day `a` to day `b` (b later → positive). */
export function daysBetween(a: string, b: string): number {
  return Math.round((dayStart(b) - dayStart(a)) / 864e5);
}

function addDays(t: number, n: number): Date {
  const d = new Date(t);
  d.setDate(d.getDate() + n);
  return d;
}

/** Monday-first weekday of a timestamp. */
export function weekdayOf(t: number): Weekday {
  return WEEKDAYS[(new Date(t).getDay() + 6) % 7];
}

/** The next time `day` comes round, counting today: a Wed picked on a Thursday is next week's. */
export function nextDateFor(day: Weekday, now = Date.now()): string {
  const ahead = (WEEKDAYS.indexOf(day) - WEEKDAYS.indexOf(weekdayOf(now)) + 7) % 7;
  return dayKey(addDays(now, ahead));
}

/** That weekday within the Monday–Sunday week containing `t` (used to date old notes). */
export function weekdayInWeekOf(day: Weekday, t: number): string {
  const back = WEEKDAYS.indexOf(weekdayOf(t));
  return dayKey(addDays(t, WEEKDAYS.indexOf(day) - back));
}

/** Sunday of the current Monday–Sunday week. */
export function weekEndKey(now = Date.now()): string {
  return dayKey(addDays(now, 6 - WEEKDAYS.indexOf(weekdayOf(now))));
}
