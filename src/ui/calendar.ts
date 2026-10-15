import { addDaysKey, dayStart, weekStartKey } from '../days';
import { dayKey, el } from '../util';

/**
 * A small month calendar for planning Backlog tasks. Day mode picks a date; week mode
 * picks a whole Monday–Sunday row (returned as its Monday). Earlier dates are disabled.
 */

const CHEV = (d: string) =>
  `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;

export interface CalendarOptions {
  mode: 'day' | 'week';
  /** Selected day, or the selected week's Monday. */
  value?: string;
  /** Earliest pickable day (week mode: earliest Monday). */
  min: string;
  onPick(key: string): void;
}

export function calendar(o: CalendarOptions): HTMLElement {
  const box = el('div', 'qb-cal' + (o.mode === 'week' ? ' weeks' : ''));
  // Show the month of the selection, or of the first pickable day.
  const start = new Date(dayStart(o.value ?? o.min));
  let year = start.getFullYear();
  let month = start.getMonth();

  const head = el('div', 'qb-cal-head');
  const title = el('span', 'qb-cal-title');
  const prev = el('button', 'qb-iconbtn');
  prev.type = 'button';
  prev.innerHTML = CHEV('M15 5l-7 7 7 7');
  prev.setAttribute('aria-label', 'Previous month');
  const next = el('button', 'qb-iconbtn');
  next.type = 'button';
  next.innerHTML = CHEV('M9 5l7 7-7 7');
  next.setAttribute('aria-label', 'Next month');
  head.append(title, el('span', 'qb-flex'), prev, next);
  const grid = el('div', 'qb-cal-grid');
  grid.setAttribute('role', 'grid');
  box.append(head, grid);

  const minMonth = (() => {
    const d = new Date(dayStart(o.min));
    return d.getFullYear() * 12 + d.getMonth();
  })();

  function render() {
    const first = new Date(year, month, 1);
    title.textContent = first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    prev.disabled = year * 12 + month <= minMonth;
    const cells: HTMLElement[] = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => el('span', 'qb-cal-dow', d));
    // Six Monday-first rows covering the month.
    let day = weekStartKey(first.getTime());
    const today = dayKey(Date.now());
    for (let row = 0; row < 6; row++) {
      const monday = day;
      const rowPickable = monday >= o.min;
      const rowOn = o.mode === 'week' && o.value === monday;
      for (let i = 0; i < 7; i++) {
        const d = new Date(dayStart(day));
        const inMonth = d.getMonth() === month;
        const pickable = o.mode === 'day' ? day >= o.min : rowPickable;
        const on = o.mode === 'day' ? o.value === day : rowOn;
        const b = el(
          'button',
          'qb-cal-day' +
            (inMonth ? '' : ' out') +
            (on ? ' on' : '') +
            (day === today ? ' today' : '') +
            (o.mode === 'week' && i === 0 ? ' wk-first' : '') +
            (o.mode === 'week' && i === 6 ? ' wk-last' : ''),
          String(d.getDate()),
        );
        b.type = 'button';
        b.disabled = !pickable;
        const key = day;
        b.setAttribute('aria-label', d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }));
        b.setAttribute('aria-pressed', String(on));
        b.addEventListener('click', () => o.onPick(o.mode === 'week' ? monday : key));
        cells.push(b);
        day = addDaysKey(day, 1);
      }
    }
    grid.replaceChildren(...cells);
  }

  prev.addEventListener('click', () => {
    month--;
    if (month < 0) {
      month = 11;
      year--;
    }
    render();
  });
  next.addEventListener('click', () => {
    month++;
    if (month > 11) {
      month = 0;
      year++;
    }
    render();
  });
  render();
  return box;
}
