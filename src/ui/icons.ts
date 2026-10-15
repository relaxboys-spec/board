import type { Priority } from '../types';

/** Status and priority glyphs shared by cards, the task sheet and Done (Linear-style). */

export type TaskStatus = 'todo' | 'progress' | 'done';

export const STATUS_ICON: Record<TaskStatus, string> = {
  todo: '<svg class="qb-st todo" width="18" height="18" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
  progress:
    '<svg class="qb-st progress" width="18" height="18" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 4a4 4 0 0 1 0 8z" fill="currentColor"/></svg>',
  done: '<svg class="qb-st done" width="18" height="18" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="currentColor"/><path class="qb-st-check" d="M5 8.2l2 2 4-4.3" fill="none" stroke="var(--on-accent)" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

export const STATUS_LABEL: Record<TaskStatus, string> = { todo: 'To do', progress: 'In progress', done: 'Done' };

/** Priority icons (original): flame, double up-arrow, dot, down-arrow. Coloured by CSS (.qb-prio.<p>). */
const pico = (p: Priority, body: string, size = 14) =>
  `<svg class="qb-prio ${p}" width="${size}" height="${size}" viewBox="0 0 16 16" aria-hidden="true">${body}</svg>`;
const ICON_BODY: Record<Priority, string> = {
  urgent: '<path d="M8.4 1.2c.5 2.3 3.6 3.4 3.6 7.1a4 4 0 0 1-8 0c0-1.8 1-2.9 1.8-3.6.3 1.4 1 2.1 1.8 2.1 0-2.2-.6-3.6.8-5.6z" fill="currentColor"/>',
  high: '<path d="M4 8.5 8 4.5l4 4M4 12.5l4-4 4 4" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>',
  normal: '<circle cx="8" cy="8" r="3.4" fill="currentColor"/>',
  low: '<path d="M4 6.5l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>',
};

export const PRIORITY_ICON: Record<Priority, string> = {
  urgent: pico('urgent', ICON_BODY.urgent),
  high: pico('high', ICON_BODY.high),
  normal: pico('normal', ICON_BODY.normal),
  low: pico('low', ICON_BODY.low),
};

const PRIORITY_WORD: Record<Priority, string> = { urgent: 'Urgent', high: 'High', normal: 'Normal', low: 'Low' };

/** The coloured label on cards: icon + word ("🔥 Urgent"). */
export function priorityPill(p: Priority): string {
  return `<span class="qb-pill ${p}">${pico(p, ICON_BODY[p], 12)}<span>${PRIORITY_WORD[p]}</span></span>`;
}

export function statusOf(n: { status: string; startedAt?: number }): TaskStatus {
  return n.status === 'done' ? 'done' : n.startedAt ? 'progress' : 'todo';
}

const line = (d: string, size = 14) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

export const SMALL = {
  cal: line('<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/>', 12),
  bell: line('<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>', 12),
  photo: line('<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M21 16l-5-5-8 8"/>', 12),
  plus: line('<path d="M12 5v14M5 12h14"/>', 16),
  mic: line('<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>', 16),
  cam: line('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>', 16),
  x: line('<path d="M6 6l12 12M18 6L6 18"/>', 18),
  undo: line('<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>', 18),
};
