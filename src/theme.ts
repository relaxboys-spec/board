import { acquireUrl, forgetUrls, releaseUrl } from './images';
import type { Settings } from './types';

/**
 * Appearance: light, dark, or liquid glass over a wallpaper; plus an accent colour.
 *
 * The choice lives in Settings (IndexedDB) and is mirrored to localStorage so it can be
 * applied synchronously before the first paint. CSS reads it from <html data-appearance
 * data-accent>; canvases ask this module for theme-correct colours (her ink included).
 */

export type Appearance = 'light' | 'dark' | 'glass';
export type AccentId = 'indigo' | 'blue' | 'teal' | 'green' | 'orange' | 'rose' | 'purple' | 'graphite';
export type WallpaperId = 'dusk' | 'lagoon' | 'meadow' | 'graphite' | 'custom';

export const APPEARANCES: [Appearance, string][] = [
  ['light', 'Light'],
  ['dark', 'Dark'],
  ['glass', 'Glass'],
];

/** [id, name, deep shade (fills on light), bright shade (text/icons on dark)] */
export const ACCENTS: [AccentId, string, string, string][] = [
  ['indigo', 'Indigo', '#5B5BD6', '#8D8EF7'],
  ['blue', 'Blue', '#2F6FEB', '#6FA3FF'],
  ['teal', 'Teal', '#0F8C84', '#3CCDBF'],
  ['green', 'Green', '#2F9E44', '#62D27A'],
  ['orange', 'Orange', '#DD6110', '#FF9F57'],
  ['rose', 'Rose', '#D6336C', '#F57EA8'],
  ['purple', 'Purple', '#8E44D9', '#BD8DF6'],
  ['graphite', 'Graphite', '#4B5563', '#A9AFBA'],
];

/** Built-in wallpapers: original gradient meshes, nothing downloaded. */
export const WALLPAPERS: [Exclude<WallpaperId, 'custom'>, string, string][] = [
  ['dusk', 'Dusk', 'radial-gradient(at 18% 22%, #ff9a8b 0, transparent 46%), radial-gradient(at 82% 26%, #7b6cff 0, transparent 52%), radial-gradient(at 55% 92%, #ffc46b 0, transparent 50%), linear-gradient(160deg, #3a2f6b, #1b1834)'],
  ['lagoon', 'Lagoon', 'radial-gradient(at 15% 80%, #00c2b8 0, transparent 50%), radial-gradient(at 80% 15%, #3b82f6 0, transparent 55%), radial-gradient(at 70% 85%, #a7f3d0 0, transparent 40%), linear-gradient(160deg, #0b3b5e, #062033)'],
  ['meadow', 'Meadow', 'radial-gradient(at 20% 25%, #f9e27a 0, transparent 45%), radial-gradient(at 80% 70%, #4ade80 0, transparent 50%), radial-gradient(at 40% 95%, #16a34a 0, transparent 45%), linear-gradient(160deg, #6b8f3a, #1f3d1f)'],
  ['graphite', 'Graphite', 'radial-gradient(at 25% 20%, #6b7280 0, transparent 45%), radial-gradient(at 80% 80%, #374151 0, transparent 50%), linear-gradient(160deg, #2b2f36, #0f1115)'],
];

/** The uploaded wallpaper is stored as a photo record under this id (never garbage-collected). */
export const WALLPAPER_IMAGE_ID = 'wallpaper';

const LS_KEY = 'qb-theme';

let current: { appearance: Appearance; accent: AccentId } = { appearance: 'light', accent: 'indigo' };
const listeners = new Set<() => void>();

export function appearance(): Appearance {
  return current.appearance;
}

/** Re-render canvases when the theme changes (cards, open sheet). */
export function onThemeChange(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function isAppearance(v: unknown): v is Appearance {
  return v === 'light' || v === 'dark' || v === 'glass';
}
export function isAccent(v: unknown): v is AccentId {
  return ACCENTS.some(([id]) => id === v);
}
export function isWallpaper(v: unknown): v is WallpaperId {
  return v === 'custom' || WALLPAPERS.some(([id]) => id === v);
}

/** First run: follow the iPad's light/dark setting. */
export function defaultAppearance(): Appearance {
  try {
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

/** Before anything paints: apply what was last used (localStorage mirror). */
export function bootTheme() {
  let saved: Partial<Pick<Settings, 'appearance' | 'accent' | 'wallpaper'>> = {};
  try {
    saved = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
  } catch {
    /* blocked or corrupt: defaults */
  }
  applyTheme({
    appearance: isAppearance(saved.appearance) ? saved.appearance : defaultAppearance(),
    accent: isAccent(saved.accent) ? saved.accent : 'indigo',
    wallpaper: isWallpaper(saved.wallpaper) ? saved.wallpaper : 'dusk',
  });
}

let wallEl: HTMLElement | null = null;
let wallUrlHeld = false;

export function applyTheme(s: Pick<Settings, 'appearance' | 'accent' | 'wallpaper'>) {
  const changed = s.appearance !== current.appearance || s.accent !== current.accent;
  current = { appearance: s.appearance, accent: s.accent };
  const root = document.documentElement;
  root.dataset.appearance = s.appearance;
  root.dataset.accent = s.accent;
  const [, , deep, bright] = ACCENTS.find(([id]) => id === s.accent) ?? ACCENTS[0];
  root.style.setProperty('--acc-deep', deep);
  root.style.setProperty('--acc-bright', bright);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', s.appearance === 'light' ? '#F7F7F8' : '#111113');
  setWallpaper(s.appearance === 'glass' ? s.wallpaper : null);
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(s));
  } catch {
    /* fine: Settings in IndexedDB is the source of truth */
  }
  if (changed) for (const fn of listeners) fn();
}

function setWallpaper(id: WallpaperId | null) {
  if (!wallEl) {
    wallEl = document.createElement('div');
    wallEl.className = 'qb-wallpaper';
    wallEl.setAttribute('aria-hidden', 'true');
    document.body.prepend(wallEl);
  }
  if (wallUrlHeld && id !== 'custom') {
    releaseUrl(WALLPAPER_IMAGE_ID, 'full');
    wallUrlHeld = false;
  }
  wallEl.hidden = !id;
  if (!id) return;
  const preset = WALLPAPERS.find(([w]) => w === id) ?? WALLPAPERS[0];
  wallEl.style.backgroundImage = preset[2];
  if (id === 'custom' && !wallUrlHeld) {
    wallUrlHeld = true;
    void acquireUrl(WALLPAPER_IMAGE_ID, 'full').then((r) => {
      if (r && wallEl && wallUrlHeld) wallEl.style.backgroundImage = `url("${r.url}")`;
    });
  }
}

/** Show a freshly uploaded wallpaper (its object URL changed). */
export function reloadCustomWallpaper() {
  wallUrlHeld = false;
  forgetUrls(WALLPAPER_IMAGE_ID);
  if (current.appearance === 'glass') setWallpaper('custom');
}

// ---- canvas colours ------------------------------------------------------------------

/** Her four inks are stored as fixed values; each theme draws them in a readable shade. */
const INK: Record<string, Record<Appearance, string>> = {
  '#f2f6ff': { light: '#1F2433', dark: '#ECEFF6', glass: '#FFFFFF' },
  '#ffe14d': { light: '#B26A00', dark: '#F5C84B', glass: '#FFE38A' },
  '#3be0ff': { light: '#0A7EA4', dark: '#5CCFE6', glass: '#9BE9FF' },
  '#ff6fae': { light: '#C2347A', dark: '#F27BB2', glass: '#FFB0D3' },
  // older notes (migrated from the first version) may also use these two
  '#7cf59a': { light: '#1E8E3E', dark: '#7CE59A', glass: '#B6F5C8' },
  '#dda0ff': { light: '#7B3FC4', dark: '#C9A2F5', glass: '#E6CCFF' },
};

export function inkColor(stored: string): string {
  return INK[stored.toLowerCase()]?.[current.appearance] ?? stored;
}

/** Colours used when drawing a task's page (text, photo frame, placeholders). */
export function pageColors() {
  const a = current.appearance;
  return {
    text: a === 'light' ? '#1F2433' : a === 'dark' ? '#ECEFF6' : '#FFFFFF',
    frame: a === 'light' ? '#FFFFFF' : a === 'dark' ? '#F2F3F6' : 'rgba(255,255,255,0.92)',
    frameShadow: a === 'light' ? 'rgba(16,16,28,0.18)' : 'rgba(0,0,0,0.45)',
    placeholder: a === 'light' ? '#E7E8EC' : '#2A2C33',
    tape: a === 'light' ? 'rgba(91,91,214,0.22)' : 'rgba(255,255,255,0.28)',
    badge: getComputedStyle(document.documentElement).getPropertyValue('--acc-deep').trim() || '#5B5BD6',
    badgeText: '#FFFFFF',
  };
}

/** The accent as drawn on a canvas (deep on light pages, bright on dark/glass). */
export function accentColor(): string {
  const [, , deep, bright] = ACCENTS.find(([id]) => id === current.accent) ?? ACCENTS[0];
  return current.appearance === 'light' ? deep : bright;
}

export const TEXT_FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif';
