/**
 * Suppress every Safari behaviour that could interrupt writing: double-tap zoom,
 * native pinch zoom, text selection + loupe, long-press callouts, rubber-band
 * scrolling. Columns, drawers and sheets keep their own vertical scrolling; while a
 * finger is holding or dragging a card, even that is locked.
 */

let scrollLocked = false;

/** Lock all touch scrolling (a card is being held or dragged). */
export function setScrollLock(on: boolean) {
  scrollLocked = on;
}

// Everything that scrolls by finger. Keep in step with the overflow:auto containers in styles.css.
const SCROLLABLE = [
  '.qb-col-scroll', '.qb-rail', '.sheet-body', '.menu', 'textarea', '.viewer.select-mode', '.qb-toolbar', '.qb-main',
  '.qb-locker-body', '.qb-lk-scroll', '.qb-lk-panel', '.qb-emotelist-grid', '.qb-lvup-card',
  '.qb-track-scroll', '.qb-track-stack', '.qb-login',
].join(', ');

/** Is the touch inside something that actually scrolls right now (not just could, at another size)? */
function canScroll(target: HTMLElement | null): boolean {
  for (let n = target?.closest<HTMLElement>(SCROLLABLE); n; n = n.parentElement?.closest<HTMLElement>(SCROLLABLE) ?? null) {
    if (n.matches('textarea, .viewer.select-mode, .menu')) return true;
    if (n.scrollHeight > n.clientHeight + 1 || n.scrollWidth > n.clientWidth + 1) return true;
  }
  return false;
}

export function preventSafariGestures() {
  const stop = (e: Event) => e.preventDefault();

  // WebKit's proprietary pinch/rotate gesture events.
  for (const t of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(t, stop, { passive: false });

  document.addEventListener(
    'touchmove',
    (e) => {
      if (scrollLocked || e.touches.length > 1) {
        e.preventDefault();
        return;
      }
      if (!canScroll(e.target as HTMLElement | null)) e.preventDefault(); // no page bounce
    },
    { passive: false },
  );

  document.addEventListener('dblclick', stop, { passive: false });
  document.addEventListener('contextmenu', (e) => {
    if (!(e.target as HTMLElement)?.closest('input, textarea, .viewer.select-mode')) e.preventDefault();
  });
  document.addEventListener('selectstart', (e) => {
    if (!(e.target as HTMLElement)?.closest?.('input, textarea, .viewer.select-mode')) e.preventDefault();
  });
}

/**
 * While the Pencil hovers near the screen (iPads with Pencil hover), hide the pointer
 * iPadOS would otherwise draw: the whole app gets `pen-near`, which sets cursor: none.
 */
export function watchPenHover() {
  const root = document.documentElement;
  let timer: number | undefined;
  const near = (e: PointerEvent) => {
    if (e.pointerType !== 'pen') {
      if (e.pointerType === 'mouse') root.classList.remove('pen-near');
      return;
    }
    root.classList.add('pen-near');
    clearTimeout(timer);
    timer = window.setTimeout(() => root.classList.remove('pen-near'), 1500);
  };
  document.addEventListener('pointerover', near, { passive: true });
  document.addEventListener('pointermove', near, { passive: true });
  document.addEventListener('pointerdown', near, { passive: true });
}

/**
 * Make the Pencil press buttons reliably. Safari only turns a Pencil touch into a click
 * when the tip barely moves, and a quick Pencil tap often drifts — so a tap on a toolbar
 * button (eraser, inks, undo…) could do nothing. Here a Pencil down + up on the same
 * button (within a generous 24 px) presses it; if Safari also sends its own click, that
 * duplicate is swallowed so nothing happens twice.
 */
export function enablePenTaps() {
  let down: { id: number; btn: HTMLButtonElement; x: number; y: number } | null = null;
  let pressed: { btn: HTMLButtonElement; until: number } | null = null;
  const buttonAt = (t: EventTarget | null) => (t instanceof Element ? t.closest<HTMLButtonElement>('button') : null);

  document.addEventListener(
    'pointerdown',
    (e) => {
      if (e.pointerType !== 'pen') return;
      const btn = buttonAt(e.target);
      down = btn && !btn.disabled ? { id: e.pointerId, btn, x: e.clientX, y: e.clientY } : null;
    },
    true,
  );
  document.addEventListener(
    'pointerup',
    (e) => {
      if (!down || e.pointerId !== down.id) return;
      const d = down;
      down = null;
      const btn = buttonAt(document.elementFromPoint(e.clientX, e.clientY)) ?? buttonAt(e.target);
      if (btn !== d.btn || d.btn.disabled || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 24) return;
      pressed = { btn: d.btn, until: performance.now() + 700 };
      d.btn.click();
    },
    true,
  );
  document.addEventListener('pointercancel', () => (down = null), true);
  // Swallow Safari's own click for a button we just pressed.
  document.addEventListener(
    'click',
    (e) => {
      if (!pressed || !e.isTrusted) return;
      if (performance.now() > pressed.until) {
        pressed = null;
        return;
      }
      if (buttonAt(e.target) === pressed.btn) {
        e.stopImmediatePropagation();
        e.preventDefault();
        pressed = null;
      }
    },
    true,
  );
}
