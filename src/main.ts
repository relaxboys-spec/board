import '@fontsource/barlow/latin-500.css';
import '@fontsource/barlow/latin-600.css';
import '@fontsource/barlow/latin-700.css';
import '@fontsource/barlow-condensed/latin-700.css';
import '@fontsource/barlow-condensed/latin-800.css';
import '@fontsource/barlow-condensed/latin-900.css';
import '@fontsource/barlow-condensed/latin-800-italic.css';
import '@fontsource/barlow-condensed/latin-900-italic.css';
import './tokens.css';
import './emotes.css';
import './styles.css';

import { completeNote, createNote, deleteNote, moveNote, restoreNote, rollover } from './actions';
import { play, type SoundName } from './audio';
import { lookFor } from './avatar';
import { BoardView, type NewMode } from './board';
import { burst, xpPop } from './fx';
import { Gestures } from './gestures';
import { collectGarbage } from './images';
import { resetPageLayouts } from './page';
import { attachFiles, imageFilesFrom, pickPhotos } from './photos';
import { preventSafariGestures } from './safari';
import { store } from './store';
import { BOARD_LABEL, type BoardId, type ZoneId } from './types';
import { dayKey, prefersReducedMotion, uid } from './util';
import { levelOf, rewardsBetween, wornKeys } from './rewards';
import { computeStats } from './xp';
import { Hero } from './ui/hero';
import { lockerOpen, openLocker, type LockerFocus } from './ui/locker';
import { loginOpen, showLogin, signedIn } from './ui/login';
import { openTrack, showLevelUp, trackOpen, type RewardHandlers } from './ui/rewards';
import { NoteSheet } from './ui/noteSheet';
import { initOverlay, sheetOpen, toast } from './ui/overlay';
import { openReminderSheet } from './ui/reminder';
import { backupBanner, openSettings } from './ui/settings';
import { Topbar } from './ui/topbar';
import { openVault } from './ui/vault';
import { flushViewer, openViewer } from './ui/viewer';

// ---- shell: painted synchronously, before any data loads ---------------------------

const app = document.getElementById('app')!;
app.append(Object.assign(document.createElement('div'), { className: 'qb-stripes' }));
preventSafariGestures();

const topbar = new Topbar(app, {
  onTab: (b) => switchBoard(b),
  onBacklog: () => board.setDrawer(!board.drawerOpen),
  onVault: () => openVault(),
  onUndo: () => undo(),
  onSettings: () => openSettings(() => afterImport()),
  onHero: () => openLockerAt(),
  onLevel: () => openTrackNow(),
});
const board = new BoardView(app, {
  newNote: (zone, mode) => newNote(zone, mode),
  drawerChanged: (open) => document.body.classList.toggle('drawer-open', open),
});
const hero = new Hero(board.main, { onLocker: () => openLockerAt() });
const ui = document.createElement('div');
ui.className = 'ui';
app.append(ui);
initOverlay(ui);
let banner: { refresh(): void } = { refresh() {} };

// Sign-in: once per device. The board keeps loading underneath so it's ready when she's in.
let login = signedIn()
  ? null
  : showLogin(() => {
      login = null;
      hero.play('wave');
    });

function sound(name: SoundName) {
  if (store.settings.sound) play(name);
}

function stats() {
  return computeStats(store.done());
}

function refreshStats() {
  const s = stats();
  topbar.setStats(s, store.done().length);
  topbar.setBacklogCount(board.someCount());
  syncUnlocks(s.level);
}

// ---- Reward Track ------------------------------------------------------------------------

const rewardHandlers: RewardHandlers = {
  openLocker: (f) => openLockerAt(f),
  openTrack: () => openTrackNow(),
};

function openLockerAt(focus?: LockerFocus) {
  openLocker(stats(), () => openTrackNow(), focus);
}

function openTrackNow() {
  openTrack(stats(), rewardHandlers);
}

/** Set when a completion is in progress, so a new level gets the full reveal. */
let revealLevelUp = false;

/**
 * Unlocks follow the highest level reached. The first time the track runs it keeps
 * whatever she's wearing; after that, each new level adds its rewards (with NEW badges)
 * and, when a quest did it, shows the level-up reveal.
 */
function syncUnlocks(level: number) {
  const p = store.player;
  if (p.best === 0) {
    store.setPlayer({
      best: level,
      kept: wornKeys(p).filter((k) => levelOf(k) > level),
      unseen: rewardsBetween(1, level),
    });
    if (level > 1) toast(`Your Level ${level} rewards are waiting in the Locker`, { label: 'Open', run: () => openLockerAt() }, 4500);
    return;
  }
  if (level <= p.best) return;
  const from = p.best;
  const keys = rewardsBetween(from, level);
  store.setPlayer({ best: level, unseen: [...new Set([...p.unseen, ...keys])] });
  if (revealLevelUp) {
    // After Nova's victory emote and the confetti.
    window.setTimeout(() => showLevelUp(from, level, keys, rewardHandlers), prefersReducedMotion() ? 300 : 1900);
  } else if (keys.length) {
    toast(`Level ${level}! New rewards in the Locker`, { label: 'Open', run: () => openLockerAt() }, 4500);
  }
}

function refreshBadges() {
  const n = store.player.unseen.length;
  hero.setBadge(n);
  topbar.setBadge(n);
}

function switchBoard(b: BoardId) {
  if (b === board.board) return;
  store.setBoard(b);
  board.board = b;
  topbar.setBoard(b);
  board.render();
  topbar.setBacklogCount(board.someCount());
}

function undo() {
  const label = store.undo();
  if (label) {
    sound('undo');
    toast(`Undid ${UNDO_LABEL[label] ?? label}`, undefined, 1600);
  } else toast('Nothing to undo', undefined, 1200);
}

const UNDO_LABEL: Record<string, string> = {
  ink: 'ink',
  erase: 'erase',
  'move ink': 'move',
  create: 'new task',
  move: 'move',
  complete: 'complete',
  restore: 'un-complete',
  delete: 'delete',
  priority: 'priority',
  reminder: 'reminder',
  text: 'text',
  photo: 'photo',
  'remove photo': 'remove photo',
  markup: 'photo ink',
};

// ---- completing ------------------------------------------------------------------------

function complete(id: string, from: DOMRect | null) {
  const before = stats().level;
  revealLevelUp = true;
  let gained = 0;
  try {
    gained = completeNote(id);
  } finally {
    revealLevelUp = false;
  }
  if (!gained) return;
  sound('done');
  if (from && !prefersReducedMotion()) burst(from.left + from.width / 2, from.top + from.height / 2, gained >= 100 ? 1.3 : 0.9);
  hero.celebrate(gained);
  topbar.pulse('vault');
  refreshStats();
  if (stats().level > before) {
    window.setTimeout(() => {
      const c = topbar.levelCenter();
      xpPop(c.x + 60, c.y + 50, 'LEVEL UP!', 'level');
      if (!prefersReducedMotion()) burst(c.x, c.y, 0.8);
      sound('level');
    }, 650);
  }
}

// ---- notes ---------------------------------------------------------------------------------

const attachHooks = {
  setLoading: (_id: string, d: number) => {
    if (d > 0) toast(d > 1 ? `Adding ${d} photos…` : 'Adding photo…', undefined, 1800);
  },
};

const sheet = new NoteSheet({
  undo: () => undo(),
  redo: () => {
    if (store.redo()) sound('undo');
  },
  openViewer: (id, i) => openViewer(id, i, { undo }),
  pickPhotos: (id, camera, replace) =>
    pickPhotos((files) => void attachFiles(id, files, attachHooks, { mergeKey: 'photos:' + uid(), replace }), undefined, { camera }),
  complete: (id, from) => complete(id, from),
  uncomplete: (id) => restoreNote(id),
  remind: (id) => openReminderSheet(id),
  deleteNote: (id) => {
    deleteNote(id);
    toast('Note deleted', { label: 'Undo', run: undo });
  },
  // A day picked for today (e.g. "Mon" on a Monday) belongs in Today straight away.
  closed: () => dailyCheck(),
});

/**
 * New note in a column. Opening the sheet happens synchronously inside the tap so Speak
 * can open the keyboard and Photo can open the picker (iPadOS requires a user gesture).
 */
function newNote(zone: ZoneId, mode: NewMode) {
  const key = 'new:' + uid();
  const note = createNote(board.board, zone, { mergeKey: key });
  sound('pop');
  sheet.open(note.id, mode, { isNew: true, mergeKey: key, autoPick: mode === 'photo' });
}

function move(id: string, dest: { board?: BoardId; zone?: ZoneId; index?: number }) {
  const before = store.get(id);
  if (!before) return;
  moveNote(id, dest);
  sound('drop');
  if (dest.board && dest.board !== before.board) {
    topbar.pulse(dest.board);
    toast(`Moved to ${BOARD_LABEL[dest.board]}`, { label: 'Undo', run: undo });
  } else if (dest.zone === 'someday' && before.zone !== 'someday') {
    toast('Moved to the Backlog', { label: 'Undo', run: undo });
  }
}

const gestures = new Gestures(app, board, topbar, {
  openView: (id) => sheet.open(id, 'view'),
  openWrite: (id) => sheet.open(id, 'write'),
  newNoteAt: (zone) => newNote(zone, 'write'),
  complete,
  move,
  undo,
  sheetOpen: () => sheet.isOpen || lockerOpen() || trackOpen() || loginOpen() || sheetOpen(),
  heroRect: () => (hero.el.offsetParent ? hero.el.getBoundingClientRect() : null),
});
void gestures;

if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__qb = { store, board, sheet, hero };

store.on((e) => {
  if (e.type === 'notes') {
    board.render();
    refreshStats();
    banner.refresh();
  } else if (e.type === 'player') {
    applyPlayer();
  } else if (e.type === 'reset') {
    afterImport();
  }
});

function applyPlayer() {
  const look = lookFor(store.player);
  hero.setLook(look, store.player.victoryEmote);
  topbar.setHero(look);
  login?.setLook(look);
  refreshBadges();
}

function afterImport() {
  board.board = store.view.board;
  topbar.setBoard(board.board);
  board.render();
  applyPlayer();
  refreshStats();
  banner.refresh();
}

// ---- photos: drag-and-drop + paste ---------------------------------------------------------

app.addEventListener('dragover', (e) => {
  if (!e.dataTransfer?.types.includes('Files') || sheet.isOpen) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
  const card = (e.target as HTMLElement).closest('.qb-card');
  document.querySelectorAll('.qb-card.photo-drop').forEach((c) => c !== card && c.classList.remove('photo-drop'));
  card?.classList.add('photo-drop');
  board.setDropColumn(card ? null : board.columnAt(e.clientX, e.clientY));
});
app.addEventListener('dragleave', (e) => {
  if (e.target === app) {
    document.querySelectorAll('.qb-card.photo-drop').forEach((c) => c.classList.remove('photo-drop'));
    board.setDropColumn(null);
  }
});
app.addEventListener('drop', (e) => {
  if (!e.dataTransfer?.types.includes('Files') || sheet.isOpen) return;
  e.preventDefault();
  document.querySelectorAll('.qb-card.photo-drop').forEach((c) => c.classList.remove('photo-drop'));
  board.setDropColumn(null);
  const files = imageFilesFrom(e.dataTransfer);
  if (!files.length) {
    toast('Only pictures can be added to notes.');
    return;
  }
  const key = 'photos:' + uid();
  const id = (e.target as HTMLElement).closest<HTMLElement>('.qb-card')?.dataset.id;
  if (id && store.get(id)) {
    void attachFiles(id, files, attachHooks, { mergeKey: key });
    return;
  }
  const zone = board.columnAt(e.clientX, e.clientY) ?? 'today';
  const note = createNote(board.board, zone, { mergeKey: key });
  void attachFiles(note.id, files, attachHooks, { mergeKey: key, discardIfEmpty: true });
});
// The open note's photo area accepts drops too.
document.addEventListener('dragover', (e) => {
  if (sheet.isOpen && e.dataTransfer?.types.includes('Files')) e.preventDefault();
});
document.addEventListener('drop', (e) => {
  if (!sheet.isOpen || !sheet.noteId) return;
  const files = imageFilesFrom(e.dataTransfer);
  if (!files.length) return;
  e.preventDefault();
  void attachFiles(sheet.noteId, files, attachHooks, { mergeKey: 'photos:' + uid() });
});

document.addEventListener('paste', (e) => {
  const files = imageFilesFrom(e.clipboardData);
  if (!files.length) return; // plain text paste carries on as normal
  e.preventDefault();
  const key = 'photos:' + uid();
  if (sheet.isOpen && sheet.noteId) {
    void attachFiles(sheet.noteId, files, attachHooks, { mergeKey: key });
    return;
  }
  const note = createNote(board.board, 'today', { mergeKey: key });
  void attachFiles(note.id, files, attachHooks, { mergeKey: key, discardIfEmpty: true });
});

// ---- lifecycle -------------------------------------------------------------------------

function saveNow() {
  sheet.flush();
  flushViewer();
  void store.flush();
}

let lastDay = dayKey(Date.now());
/**
 * The daily check: This Week notes whose day has come move into Today (see rollover).
 * Runs on open, at midnight, when she comes back to the app, and when a note is closed.
 */
function dailyCheck(announce = true) {
  const moved = rollover();
  if (moved && announce) {
    toast(moved === 1 ? '1 note moved into Today — its day is here' : `${moved} notes moved into Today — their day is here`, undefined, 3500);
  }
}

function tick() {
  const today = dayKey(Date.now());
  if (today !== lastDay) {
    // Midnight: completed notes leave for the Vault, dated notes arrive in Today, ages tick up.
    lastDay = today;
    dailyCheck();
    board.render();
    board.refreshDay();
    refreshStats();
  } else board.updateClock();
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') saveNow();
  else {
    tick();
    banner.refresh();
  }
});
window.addEventListener('pagehide', saveNow);
window.setInterval(tick, 30_000);

store.onSaveError = () => toast('Couldn’t save just now — retrying…', undefined, 2500);

// ---- boot ------------------------------------------------------------------------------

async function boot() {
  try {
    await store.load();
  } catch (err) {
    toast('Couldn’t open storage: ' + (err as Error).message, undefined, 8000);
  }
  const arrived = rollover(); // before the first paint, so notes are already in the right column
  board.board = store.view.board;
  topbar.setBoard(board.board);
  board.render();
  applyPlayer();
  refreshStats();
  banner = backupBanner(ui);
  if (arrived) toast(arrived === 1 ? '1 note moved into Today — its day is here' : `${arrived} notes moved into Today — their day is here`, undefined, 3500);

  // Note text is laid out with a fallback font until Barlow arrives; redraw then.
  void document.fonts?.load('600 40px "Barlow"').then(() => {
    resetPageLayouts();
    board.redrawAll();
  });

  // Photos no note refers to any more (removed / deleted last session) are freed now.
  const referenced = new Set<string>();
  for (const n of store.notes.values()) for (const id of n.imageIds ?? []) referenced.add(id);
  void collectGarbage(referenced).catch(() => {});

  if (!store.install.persistRequested && navigator.storage?.persist) {
    try {
      await navigator.storage.persist();
    } catch {
      /* not supported */
    }
    store.markPersistRequested();
  }

  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    const register = () => navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {});
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }
}

void boot();
