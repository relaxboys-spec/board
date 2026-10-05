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

const SCROLLABLE = '.qb-col-scroll, .qb-rail, .sheet-body, .qb-locker-scroll, .menu, textarea, .viewer.select-mode';

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
      const target = e.target as HTMLElement | null;
      if (!target?.closest(SCROLLABLE)) e.preventDefault(); // no page bounce
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
