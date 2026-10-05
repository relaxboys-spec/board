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
