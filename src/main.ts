import './avatar.css';
import './emotes.css';
import './styles.css';

import { completeNote, createNote, deleteNote, moveNote, restoreNote, rollover, setInProgress } from './actions';
import { play, type SoundName } from './audio';
import { lookFor } from './avatar';
import { BoardView, type NewMode } from './board';
import { Gestures } from './gestures';
import { collectGarbage } from './images';
import { resetPageLayouts } from './page';
import { attachFiles, imageFilesFrom, pickPhotos } from './photos';
import { enablePenTaps, preventSafariGestures, watchPenHover } from './safari';
import { store } from './store';
import { appearance, applyTheme, bootTheme, onThemeChange, WALLPAPER_IMAGE_ID } from './theme';
import { BOARD_LABEL, type BoardId, type ZoneId } from './types';
import { dayKey, el, prefersReducedMotion, uid } from './util';
import { levelOf, rewardsBetween, wornKeys } from './rewards';
import { computeStats } from './xp';
import { SMALL } from './ui/icons';
import { lockerOpen, openLocker, type LockerFocus } from './ui/locker';
import { loginOpen, showLogin, signedIn } from './ui/login';
import { openTrack, showLevelUp, trackOpen, type RewardHandlers } from './ui/rewards';
import { NoteSheet } from './ui/noteSheet';
import { initOverlay, sheetOpen, toast } from './ui/overlay';
import { Profile } from './ui/profile';
import { openReminderSheet } from './ui/reminder';
import { backupBanner, openSettings } from './ui/settings';
import { Sidebar } from './ui/sidebar';
import { openVault } from './ui/vault';
import { flushViewer, openViewer } from './ui/viewer';

// ---- shell: painted synchronously, before any data loads ---------------------------

bootTheme(); // last-used appearance + accent, before the first paint
const app = document.getElementById('app')!;
preventSafariGestures();
watchPenHover();
enablePenTaps();

const sidebar = new Sidebar(app, {
  onBoard: (b) => showBoard(b),
  onBacklog: () => {
    if (view !== 'board') showBoard(board.board);
    board.setDrawer(!board.drawerOpen);
  },
  onDone: () => openVault(),
  onProfile: () => showProfile(),
  onSettings: () => openSettings(() => afterImport()),
});

const content = el('div', 'qb-content');
const header = el('header', 'qb-header');
const title = el('h1', 'qb-title', 'Work');
const date = el('span', 'qb-date');
const undoBtn = el('button', 'qb-iconbtn');
undoBtn.type = 'button';
undoBtn.innerHTML = SMALL.undo;
undoBtn.setAttribute('aria-label', 'Undo (or tap with two fingers)');
undoBtn.addEventListener('click', () => undo());
const newBtn = el('button', 'btn primary qb-newbtn');
newBtn.type = 'button';
newBtn.innerHTML = `${SMALL.plus}<span>New task</span>`;
newBtn.addEventListener('click', () => newNote('today', 'write'));
header.append(title, date, el('span', 'qb-flex'), undoBtn, newBtn);
content.append(header);
app.append(content);

const board = new BoardView(content, {
  newNote: (zone, mode) => newNote(zone, mode),
  drawerChanged: (open) => {
    document.body.classList.toggle('drawer-open', open);
    sidebar.setBacklogOpen(open);
  },
});
const profile = new Profile(content, { onLocker: () => openLockerAt(), onRewards: () => openTrackNow() });
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
    });

// ---- views: a board, or Profile -----------------------------------------------------------

let view: 'board' | 'profile' = 'board';

function showBoard(b: BoardId) {
  view = 'board';
  profile.el.hidden = true;
  board.main.hidden = false;
  if (b !== board.board) {
    store.setBoard(b);
    board.board = b;
    board.render();
  }
  sidebar.setView(b);
  setHeader();
  refreshStats();
}

function showProfile() {
  view = 'profile';
  board.setDrawer(false);
  board.main.hidden = true;
  profile.el.hidden = false;
  sidebar.setView('profile');
  setHeader();
  refreshStats();
}

function setHeader() {
  title.textContent = view === 'profile' ? 'Profile' : BOARD_LABEL[board.board];
  date.textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  newBtn.hidden = view === 'profile';
}

function sound(name: SoundName) {
  if (store.settings.sound) play(name);
}

function stats() {
  return computeStats(store.done());
}

function refreshStats() {
  const s = stats();
  sidebar.setStats(s);
  const active = (b: BoardId) => [...store.notes.values()].filter((n) => n.board === b && n.status === 'active' && n.zone !== 'someday').length;
  const done = store.done();
  sidebar.setCounts({ work: active('work'), personal: active('personal') }, board.someCount(), done.length);
  const monday = new Date();
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  profile.setStats(s, store.player, { total: done.length, week: done.filter((n) => (n.completedAt ?? 0) >= monday.getTime()).length });
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
 * and, when a completed task did it, shows the level-up card.
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
    window.setTimeout(() => showLevelUp(from, level, keys, rewardHandlers), prefersReducedMotion() ? 200 : 900);
  } else if (keys.length) {
    toast(`Level ${level}! New rewards in the Locker`, { label: 'Open', run: () => openLockerAt() }, 4500);
  }
}

function refreshBadges() {
  const n = store.player.unseen.length;
  profile.setBadge(n);
  sidebar.setBadge(n);
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
  start: 'start',
  pause: 'pause',
  restore: 'un-complete',
  delete: 'delete',
  priority: 'priority',
  reminder: 'reminder',
  text: 'text',
  photo: 'photo',
  'remove photo': 'remove photo',
  markup: 'photo ink',
};

// ---- starting + completing -----------------------------------------------------------------

function start(id: string) {
  setInProgress(id, true);
  sound('pop');
  toast('In progress', { label: 'Undo', run: undo }, 2400);
}

function complete(id: string, _from: DOMRect | null) {
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
  board.card(id)?.el.classList.add('just-done');
  profile.celebrate(gained, store.settings.celebrate);
  sidebar.pulse('vault');
  toast(`Completed · +${gained} XP`, { label: 'Undo', run: undo }, 2800);
  refreshStats();
  if (stats().level > before) window.setTimeout(() => sound('level'), 500);
}

/** The status circle on a card: To do → In progress → Done (and back from Done). */
function statusTap(id: string) {
  const n = store.get(id);
  if (!n) return;
  if (n.status === 'done') {
    restoreNote(id);
    toast('Marked as not done', { label: 'Undo', run: undo }, 2200);
  } else if (n.startedAt) complete(id, null);
  else start(id);
}
app.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLElement>('.qb-card .qb-status');
  const id = btn?.closest<HTMLElement>('.qb-card')?.dataset.id;
  if (id) statusTap(id);
});

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
    toast('Task deleted', { label: 'Undo', run: undo });
  },
  // A day picked for today (e.g. "Mon" on a Monday) belongs in Today straight away.
  closed: () => dailyCheck(),
});

/**
 * New task in a column. Opening the sheet happens synchronously inside the tap so Speak
 * can open the keyboard and Photo can open the picker (iPadOS requires a user gesture).
 */
function newNote(zone: ZoneId, mode: NewMode) {
  if (view !== 'board') showBoard(board.board);
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
    sidebar.pulse(dest.board);
    toast(`Moved to ${BOARD_LABEL[dest.board]}`, { label: 'Undo', run: undo });
  } else if (dest.zone === 'someday' && before.zone !== 'someday') {
    toast('Moved to the Backlog', { label: 'Undo', run: undo });
  }
}

const gestures = new Gestures(app, board, sidebar, {
  openView: (id) => sheet.open(id, 'view'),
  openWrite: (id) => sheet.open(id, 'write'),
  newNoteAt: (zone) => newNote(zone, 'write'),
  complete,
  start,
  move,
  undo,
  sheetOpen: () => sheet.isOpen || lockerOpen() || trackOpen() || loginOpen() || sheetOpen(),
  heroRect: () => null,
});
void gestures;

if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__qb = { store, board, sheet, profile, sidebar };

store.on((e) => {
  if (e.type === 'notes') {
    board.render();
    refreshStats();
    banner.refresh();
  } else if (e.type === 'player') {
    applyPlayer();
    refreshStats();
  } else if (e.type === 'settings') {
    applyTheme(store.settings);
  } else if (e.type === 'reset') {
    afterImport();
  }
});

// Cards are canvases: redraw them in the new colours when the theme changes.
onThemeChange(() => board.redrawAll());

function applyPlayer() {
  const look = lookFor(store.player);
  profile.setLook(look, store.player.victoryEmote);
  sidebar.setHero(look);
  login?.setLook(look);
  refreshBadges();
}

function afterImport() {
  board.board = store.view.board;
  applyTheme(store.settings);
  showBoard(board.board);
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
    toast(moved === 1 ? '1 task moved into Today — its day is here' : `${moved} tasks moved into Today — their day is here`, undefined, 3500);
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
  // First launch of the redesign: keep the appearance she's already seeing (iPad light/dark).
  if (store.needsThemeDefaults) store.setSettings({ appearance: appearance() });
  applyTheme(store.settings);
  const arrived = rollover(); // before the first paint, so notes are already in the right column
  board.board = store.view.board;
  board.render();
  applyPlayer();
  showBoard(board.board);
  banner = backupBanner(ui);
  if (arrived) toast(arrived === 1 ? '1 task moved into Today — its day is here' : `${arrived} tasks moved into Today — their day is here`, undefined, 3500);

  // Text tasks use the system font; re-measure once fonts settle, just in case.
  void document.fonts?.ready.then(() => {
    resetPageLayouts();
    board.redrawAll();
  });

  // Photos no task refers to any more (removed / deleted last session) are freed now.
  // The uploaded wallpaper is kept.
  const referenced = new Set<string>([WALLPAPER_IMAGE_ID]);
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
