import { restoreNote } from '../actions';
import { drawPage } from '../page';
import { store } from '../store';
import { BOARD_LABEL, PRIORITY, type Note } from '../types';
import { button, dayKey, el } from '../util';
import { openSheet, toast } from './overlay';

/** The Vault: every completed note, grouped by the day it was finished. */

function dayTitle(key: string): string {
  const today = dayKey(Date.now());
  const y = new Date();
  y.setDate(y.getDate() - 1);
  if (key === today) return 'Today';
  if (key === dayKey(y)) return 'Yesterday';
  const [yy, mm, dd] = key.split('-').map(Number);
  return new Date(yy, mm - 1, dd).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

const DAYS_PER_PAGE = 10;
const THUMB_W = 150;
const THUMB_H = 120;

export function openVault() {
  const sheet = openSheet('Vault', { wide: true, eyebrow: 'Completed notes' });
  const done = store.done().sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
  if (!done.length) {
    sheet.body.append(
      el('p', 'empty-msg', 'Nothing in the Vault yet. Complete a note (hold it, or open it and tap Complete) and it lands here at the end of the day.'),
    );
    return;
  }
  const groups = new Map<string, Note[]>();
  for (const n of done) {
    const k = dayKey(n.completedAt ?? n.updatedAt);
    const g = groups.get(k);
    if (g) g.push(n);
    else groups.set(k, [n]);
  }
  const keys = [...groups.keys()];
  let shown = 0;
  const list = el('div', 'qb-vault-list');
  sheet.body.append(list);
  const more = button('qb-ghostbtn', 'Show earlier days', () => renderPage());

  const renderPage = () => {
    for (const k of keys.slice(shown, shown + DAYS_PER_PAGE)) {
      const notes = groups.get(k)!;
      const xp = notes.reduce((s, n) => s + (n.xp ?? 0), 0);
      const sec = el('section', 'qb-vault-day');
      const h = el('h3', 'qb-vault-title', dayTitle(k));
      h.append(el('span', 'qb-vault-xp', `${notes.length} done · +${xp} XP`));
      const grid = el('div', 'qb-vault-grid');
      for (const n of notes) grid.append(vaultCard(n, sheet.close));
      sec.append(h, grid);
      list.append(sec);
    }
    shown += DAYS_PER_PAGE;
    if (shown < keys.length) list.after(more);
    else more.remove();
  };
  renderPage();
}

function vaultCard(n: Note, closeSheet: () => void): HTMLElement {
  const pr = PRIORITY[n.priority];
  const card = el('div', 'qb-vault-card');
  card.style.setProperty('--grad', pr.grad);
  const inner = el('div', 'qb-vault-card-in');
  const c = el('canvas');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  c.width = THUMB_W * dpr;
  c.height = THUMB_H * dpr;
  c.style.width = THUMB_W + 'px';
  c.style.height = THUMB_H + 'px';
  const draw = () =>
    drawPage(c.getContext('2d')!, n, { w: THUMB_W, h: THUMB_H, dpr, fit: 'content', photo: 'thumb', tiltDeg: -2, onAsset: () => requestAnimationFrame(draw) });
  draw();
  const meta = el('div', 'qb-vault-meta');
  const pri = el('span', 'qb-card-pri', pr.label);
  pri.style.color = pr.light;
  meta.append(pri, el('span', 'qb-card-xp', `+${n.xp ?? pr.xp} XP`));
  const foot = el('div', 'qb-vault-foot');
  foot.append(
    el('span', 'qb-vault-board', BOARD_LABEL[n.board]),
    button('qb-vault-back', 'Put back', () => {
      restoreNote(n.id);
      closeSheet();
      toast(`Back on ${BOARD_LABEL[n.board]}`);
    }),
  );
  inner.append(meta, c, foot);
  card.append(inner);
  return card;
}
