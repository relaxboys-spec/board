import { el, button } from '../util';

/** Popovers (menus near a finger), modal sheets, and toasts. */

let uiRoot: HTMLElement;
export function initOverlay(root: HTMLElement) {
  uiRoot = root;
}

// ---- popover -----------------------------------------------------------------

let pop: { el: HTMLElement; onClose?: () => void } | null = null;

function outside(e: PointerEvent) {
  if (pop && !pop.el.contains(e.target as Node)) closePopover();
}

export function openPopover(content: HTMLElement, sx: number, sy: number, onClose?: () => void) {
  closePopover();
  const box = el('div', 'popover');
  box.append(content);
  uiRoot.append(box);
  // Place beside the finger, flipped/clamped to stay on screen.
  const r = box.getBoundingClientRect();
  const W = window.innerWidth;
  const H = window.innerHeight;
  let x = sx + 18;
  let y = sy - r.height / 2;
  if (x + r.width > W - 10) x = sx - r.width - 18;
  x = Math.min(Math.max(x, 10), W - r.width - 10);
  y = Math.min(Math.max(y, 10 + safeTop()), H - r.height - 10);
  box.style.left = x + 'px';
  box.style.top = y + 'px';
  box.style.transformOrigin = `${sx - x}px ${sy - y}px`;
  pop = { el: box, onClose };
  // Defer so the finger that opened it doesn't immediately close it.
  setTimeout(() => document.addEventListener('pointerdown', outside, true), 0);
}

export function closePopover() {
  if (!pop) return;
  const p = pop;
  pop = null;
  document.removeEventListener('pointerdown', outside, true);
  p.el.classList.add('closing');
  setTimeout(() => p.el.remove(), 140);
  p.onClose?.();
}

export function popoverOpen() {
  return !!pop;
}

function safeTop() {
  return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sat')) || 0;
}

// ---- sheet ---------------------------------------------------------------------

export interface Sheet {
  el: HTMLElement;
  body: HTMLElement;
  close(): void;
}

let sheetCount = 0;

export function openSheet(title: string, opts: { wide?: boolean; eyebrow?: string; onClose?: () => void } = {}): Sheet {
  closePopover();
  const scrim = el('div', 'scrim');
  const card = el('div', 'sheet qb-cut' + (opts.wide ? ' wide' : ''));
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'true');
  card.setAttribute('aria-label', title);
  const head = el('div', 'sheet-head');
  const titles = el('div', 'qb-col-title');
  if (opts.eyebrow) titles.append(el('span', 'qb-eyebrow', opts.eyebrow));
  titles.append(el('h2', 'sheet-title qb-display', title));
  head.append(titles);
  const body = el('div', 'sheet-body');
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    sheetCount--;
    scrim.classList.add('closing');
    setTimeout(() => scrim.remove(), 180);
    opts.onClose?.();
  };
  const x = button('qb-skew qb-iconbtn sheet-close', '', close);
  x.innerHTML =
    '<span><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></span>';
  x.setAttribute('aria-label', 'Close');
  head.append(x);
  card.append(head, body);
  scrim.append(card);
  scrim.addEventListener('pointerdown', (e) => {
    if (e.target === scrim) close();
  });
  uiRoot.append(scrim);
  sheetCount++;
  return { el: card, body, close };
}

export function sheetOpen() {
  return sheetCount > 0;
}

// ---- toast ---------------------------------------------------------------------

let toastEl: HTMLElement | null = null;
let toastTimer: number | undefined;

export function toast(message: string, action?: { label: string; run: () => void }, ms = 3200) {
  toastEl?.remove();
  clearTimeout(toastTimer);
  const t = el('div', 'toast');
  t.setAttribute('role', 'status');
  t.append(el('span', '', message));
  if (action) {
    t.append(
      button('toast-action', action.label, () => {
        t.remove();
        action.run();
      }),
    );
  }
  uiRoot.append(t);
  toastEl = t;
  toastTimer = window.setTimeout(() => {
    t.classList.add('closing');
    setTimeout(() => t.remove(), 200);
  }, ms);
}
